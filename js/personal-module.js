/* ===== MODULO PERSONAL + ALARMAS INTELIGENTES (anadido; no altera logica existente) ===== */
(function(){
  function db(){ return firebase.firestore(); }
  var PERSONAL=[], PACTIVOS=null, lastLoad=0, perFiltro='todos';
  function esc(x){ return (x==null?'':String(x)).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
  function normNombre(s){ return String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' ').trim().toUpperCase(); }
  var STOP={de:1,la:1,los:1,las:1,y:1,del:1,e:1};
  // La fecha de baja se guarda como AAAA-MM-DD (formato del <input type="date">) y se muestra DD/MM/AAAA.
  function hoyISO(){ var d=new Date(); return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); }
  function fmtFechaISO(iso){ var m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso||'')); return m?(m[3]+'/'+m[2]+'/'+m[1]):''; }
  // Antigüedad en el departamento. Se mide desde la fecha de ingreso hasta hoy, o
  // hasta la fecha de baja si el empleado ya no labora (así el dato queda congelado).
  function parseISO(iso){ var m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso||'')); if(!m)return null;
    var d=new Date(Number(m[1]),Number(m[2])-1,Number(m[3])); return isNaN(d)?null:d; }
  function antiguedad(desdeISO,hastaISO){
    var a=parseISO(desdeISO); if(!a)return null;
    var b=hastaISO?parseISO(hastaISO):new Date(); if(!b)b=new Date();
    if(b<a) return null; // ingreso posterior a la baja: dato inconsistente, no se muestra
    var anios=b.getFullYear()-a.getFullYear(), meses=b.getMonth()-a.getMonth();
    if(b.getDate()<a.getDate()) meses--;
    if(meses<0){ anios--; meses+=12; }
    return {anios:anios,meses:meses};
  }
  function antiguedadTexto(desdeISO,hastaISO){
    var r=antiguedad(desdeISO,hastaISO); if(!r)return '';
    var pa=r.anios===1?'1 año':(r.anios+' años'), pm=r.meses===1?'1 mes':(r.meses+' meses');
    if(r.anios&&r.meses) return pa+' y '+pm;
    if(r.anios) return pa;
    return pm;
  }
  function antiguedadCorta(desdeISO,hastaISO){
    var r=antiguedad(desdeISO,hastaISO); if(!r)return '';
    if(r.anios&&r.meses) return r.anios+'a '+r.meses+'m';
    if(r.anios) return r.anios+(r.anios===1?' año':' años');
    return r.meses+(r.meses===1?' mes':' meses');
  }
  function diasDesde(iso){ var m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso||'')); if(!m)return null;
    var d=new Date(Number(m[1]),Number(m[2])-1,Number(m[3])); if(isNaN(d))return null;
    return Math.floor((Date.now()-d.getTime())/86400000); }
  function tset(s){ var o={}; String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z\s]/g,' ').split(/\s+/).forEach(function(w){ if(w&&!STOP[w])o[w]=1; }); return o; }
  // ---- Foto de empleado: se guarda como dataURL JPEG comprimido en el campo "foto" ----
  var perFotoActual='';
  function comprimirImagen(file,cb){
    var reader=new FileReader();
    reader.onload=function(e){
      var img=new Image();
      img.onload=function(){
        var max=480,w=img.width,h=img.height;
        if(w>h){ if(w>max){ h=Math.round(h*max/w); w=max; } }
        else    { if(h>max){ w=Math.round(w*max/h); h=max; } }
        try{
          var c=document.createElement('canvas'); c.width=w; c.height=h;
          c.getContext('2d').drawImage(img,0,0,w,h);
          cb(c.toDataURL('image/jpeg',0.8));
        }catch(err){ console.error(err); cb(null); }
      };
      img.onerror=function(){ cb(null); };
      img.src=e.target.result;
    };
    reader.onerror=function(){ cb(null); };
    reader.readAsDataURL(file);
  }
  function plBien(n){ return n+(n===1?' bien':' bienes'); }
  function inicialNombre(n){
    // Iniciales del nombre y del primer apellido: "JUAN PEREZ" -> "JP"
    var ps=String(n||'').trim().split(/\s+/).filter(Boolean);
    if(!ps.length) return '?';
    if(ps.length===1) return ps[0].charAt(0).toUpperCase();
    return (ps[0].charAt(0)+ps[1].charAt(0)).toUpperCase();
  }
  // estado: true=activo, false=baja, null/undefined=no mostrar punto (p.ej. en el formulario)
  function avatarHtml(p,size,estado){
    size=size||46;
    var dot = (estado===true||estado===false)
      ? '<span class="per-dot'+(estado?'':' off')+'" title="'+(estado?'Activo':'De baja')+'"></span>' : '';
    var inner = (p&&p.foto)
      ? '<img class="per-av-img" src="'+esc(p.foto)+'" alt="" style="width:'+size+'px;height:'+size+'px">'
      : '<div class="per-av-ini" style="width:'+size+'px;height:'+size+'px;font-size:'+Math.round(size*0.36)+'px">'+esc(inicialNombre(p&&p.nombre))+'</div>';
    return '<div class="per-avatar" style="width:'+size+'px;height:'+size+'px">'+inner+dot+'</div>';
  }
  function pintarPreviewFoto(){
    var wrap=document.getElementById('pf_fotoWrap'); if(!wrap)return;
    wrap.innerHTML=avatarHtml({foto:perFotoActual,nombre:(document.getElementById('pf_nombre')||{}).value},104);
    var qb=document.getElementById('pf_fotoQuitar'); if(qb)qb.style.display=perFotoActual?'inline-block':'none';
  }
  window.perFotoSeleccionar=function(input){
    var f=input&&input.files&&input.files[0]; if(!f){return;}
    if(!/^image\//.test(f.type)){ if(window.toast)toast('Selecciona una imagen'); input.value=''; return; }
    comprimirImagen(f,function(dataUrl){
      input.value='';
      if(!dataUrl){ if(window.toast)toast('No se pudo procesar la imagen'); return; }
      perFotoActual=dataUrl; pintarPreviewFoto();
    });
  };
  window.perFotoQuitar=function(){ perFotoActual=''; pintarPreviewFoto(); };
  // ---- Ubicación física de la persona (dónde se encuentra) ----
  // Se reusan las mismas opciones que el resto de la app (LOCS de app.js) para que
  // coincidan con la ubicación de los bienes; con respaldo por si aún no cargó app.js.
  var LOCS_PER = (typeof LOCS!=='undefined' && LOCS && LOCS.length) ? LOCS : ["Oficinas Centrales","Anexo C.C. z.4","Anexo Torre Café","Archivo General"];
  var perUbicActual='';
  function ubicBotonesPer(actual){
    var a=(actual||'').trim();
    var vals=LOCS_PER.slice();
    if(a && vals.indexOf(a)<0) vals.unshift(a);   // conserva un valor no estándar
    return vals.map(function(L){
      var jl=String(L).replace(/\\/g,'\\\\').replace(/'/g,"\\'");
      return '<button type="button" class="per-ubicbtn'+(a===L?' sel':'')+'" onclick="perSetUbic(\''+jl+'\')">'+esc(L)+'</button>';
    }).join('');
  }
  window.perSetUbic=function(val){
    perUbicActual = (perUbicActual===val ? '' : val);   // volver a tocar la misma la quita
    var wrap=document.getElementById('pf_ubicWrap'); if(wrap) wrap.innerHTML=ubicBotonesPer(perUbicActual);
  };
  /* ===== IMPORTAR PERSONAL DESDE EXCEL =====
     Reconoce las columnas No. Empleado / Nombre / Renglón / Cargo / DPI / Ubicación (en
     cualquier orden) y crea o actualiza los empleados. Se usa MERGE para no borrar datos
     ya cargados (foto, fecha de ingreso, situación laboral); solo refresca los campos del
     archivo. No da de baja a nadie. */
  function normHdr(s){ return String(s||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/\s+/g,' ').trim(); }
  function hallarCol(hdr, incluye){
    for(var i=0;i<hdr.length;i++){ var h=normHdr(hdr[i]); for(var j=0;j<incluye.length;j++){ if(h.indexOf(incluye[j])>=0) return i; } }
    return -1;
  }
  window.perImportarExcel=function(){
    if(typeof requiereEdicion==='function' && !requiereEdicion())return;
    var inp=document.createElement('input'); inp.type='file'; inp.accept='.xlsx,.xls,.csv'; inp.style.display='none';
    document.body.appendChild(inp);
    inp.onchange=function(){
      var f=inp.files&&inp.files[0]; if(!f){ document.body.removeChild(inp); return; }
      var listo = (typeof cargarLectorExcel==='function') ? cargarLectorExcel() : Promise.resolve(typeof XLSX!=='undefined');
      listo.then(function(){
        if(typeof XLSX==='undefined'){ toast('No se pudo cargar el lector de Excel (revise conexión)'); return; }
        var rd=new FileReader();
        rd.onload=function(e){
          try{
            var wb=XLSX.read(e.target.result,{type:'array'});
            var ws=wb.Sheets[wb.SheetNames[0]];
            var filas=XLSX.utils.sheet_to_json(ws,{header:1,defval:''});
            perProcesarFilas(filas);
          }catch(err){ console.error(err); toast('No se pudo leer el archivo: '+(err.message||err)); }
          finally{ if(inp.parentNode) document.body.removeChild(inp); }
        };
        rd.onerror=function(){ toast('No se pudo leer el archivo'); if(inp.parentNode) document.body.removeChild(inp); };
        rd.readAsArrayBuffer(f);
      });
    };
    inp.click();
  };
  function perProcesarFilas(filas){
    if(!filas || !filas.length){ toast('El archivo no tiene filas'); return; }
    // Buscar la fila de encabezados (la que tiene Nombre y No. de empleado)
    var hi=-1, hdr=null;
    for(var i=0;i<Math.min(filas.length,15);i++){
      var fila=filas[i]||[];
      var tieneNom=fila.some(function(c){return normHdr(c).indexOf('nombre')>=0;});
      var tieneEmp=fila.some(function(c){return normHdr(c).indexOf('emplead')>=0;});
      if(tieneNom&&tieneEmp){ hi=i; hdr=fila; break; }
    }
    if(hi<0){ toast('No encontré columnas de Nombre y No. de empleado en el archivo'); return; }
    var cEmp=hallarCol(hdr,['emplead']), cNom=hallarCol(hdr,['nombre']),
        cRen=hallarCol(hdr,['rengl']), cCar=hallarCol(hdr,['cargo']),
        cDpi=hallarCol(hdr,['dpi']), cUbi=hallarCol(hdr,['ubicac']);
    var val=function(fila,idx){ return idx>=0 ? String(fila[idx]==null?'':fila[idx]).trim() : ''; };
    var existentesId={}; PERSONAL.forEach(function(x){ existentesId[x.__id]=1; if(x.noEmpleado) existentesId[String(x.noEmpleado).replace(/[^\w-]/g,'_')]=1; });
    var upserts=[], nuevos=0, actualizados=0, omitidos=0, vistos={}, porUbic={};
    for(var r=hi+1;r<filas.length;r++){
      var fila=filas[r]||[];
      var noEmp=val(fila,cEmp), nom=val(fila,cNom);
      if(!noEmp && !nom){ continue; }               // fila vacía
      if(!noEmp){ omitidos++; continue; }           // sin No. no se puede identificar
      var docId=noEmp.replace(/[^\w-]/g,'_');
      if(vistos[docId]){ continue; } vistos[docId]=1;
      var esNuevo=!existentesId[docId];
      if(esNuevo) nuevos++; else actualizados++;
      var ubic=val(fila,cUbi);
      if(ubic) porUbic[ubic]=(porUbic[ubic]||0)+1;
      upserts.push({docId:docId, esNuevo:esNuevo,
        data:{ nombre:nom, noEmpleado:noEmp, renglon:val(fila,cRen), cargo:val(fila,cCar), dpi:val(fila,cDpi), ubicacion:ubic }});
    }
    if(!upserts.length){ toast('No hay empleados válidos en el archivo'); return; }
    window.__perImport=upserts;
    var ubicTxt=Object.keys(porUbic).sort().map(function(u){ return esc(u)+': '+porUbic[u]; }).join(' · ');
    var sheet=document.getElementById('sheet');
    if(!sheet){ perImportConfirmar(); return; }   // sin hoja de UI, importa directo
    sheet.innerHTML='<div class="grip"></div><h3>Confirmar importación de personal</h3>'
      +'<div class="note">Se procesarán <b>'+upserts.length+'</b> empleado(s): <b>'+nuevos+'</b> nuevo(s) y <b>'+actualizados+'</b> que se actualizan.'
      +(omitidos?' ('+omitidos+' fila(s) sin No. de empleado se omiten.)':'')+'</div>'
      +(ubicTxt?'<div class="note">Por ubicación — '+ubicTxt+'</div>':'')
      +'<div class="note">No se borra ninguna foto, fecha de ingreso ni situación laboral ya registradas; solo se refrescan nombre, cargo, renglón, DPI y ubicación.</div>'
      +'<button class="per-guardar" style="margin-top:12px" onclick="perImportConfirmar()">Importar '+upserts.length+' empleado(s)</button>'
      +'<button class="per-toggle" style="color:var(--gris)" onclick="if(typeof closeMenu===\'function\')closeMenu()">Cancelar</button>';
    if(typeof showSheet==='function') showSheet();
  }
  window.perImportConfirmar=function(){
    if(typeof requiereEdicion==='function' && !requiereEdicion())return;
    var lista=window.__perImport||[]; if(!lista.length) return;
    if(typeof closeMenu==='function') closeMenu();
    toast('Importando '+lista.length+' empleado(s)...');
    var ahora=new Date().toISOString();
    var grupos=[]; for(var i=0;i<lista.length;i+=400) grupos.push(lista.slice(i,i+400));
    grupos.reduce(function(cad,grupo){
      return cad.then(function(){
        var lote=db().batch();
        grupo.forEach(function(u){
          var d=Object.assign({},u.data,{actualizado:ahora});
          if(u.esNuevo){ d.activo=true; d.creado=ahora; }   // los nuevos entran activos; a los existentes no se les toca la situación
          lote.set(db().collection('personal').doc(u.docId), d, {merge:true});
        });
        return lote.commit();
      });
    },Promise.resolve()).then(function(){
      window.__perImport=null;
      toast('✓ Importados '+lista.length+' empleado(s)');
      cargarPersonal(openPersonal);
    }).catch(function(e){ console.error(e); toast('Error al importar: '+(e.message||e)); });
  };
  function esActivo(nombre){ if(!PACTIVOS)return true; var ns=tset(nombre),ka=Object.keys(ns); if(!ka.length)return true;
    return PACTIVOS.some(function(p){ var i=0,kb=Object.keys(p); ka.forEach(function(t){if(p[t])i++;}); return (i/Math.min(ka.length,kb.length))>=0.6; }); }
  function cargarPersonal(cb){ db().collection('personal').orderBy('nombre').get().then(function(s){
      PERSONAL=[]; s.forEach(function(d){ PERSONAL.push(Object.assign({__id:d.id},d.data())); });
      PACTIVOS=PERSONAL.filter(function(p){return p.activo!==false;}).map(function(p){return tset(p.nombre);});
      lastLoad=Date.now(); if(cb)cb(); marcarAlarmas(); actualizarResumen();
    }).catch(function(e){ console.error(e); if(window.toast)toast('Error al cargar personal'); }); }

  // Expuesto para que otros módulos (p.ej. el campo "Colaborador actual") puedan
  // sugerir nombres de empleados sin depender de su propia consulta a Firestore.
  window.listaNombresPersonal=function(){
    return PERSONAL.filter(function(p){return p.activo!==false;}).map(function(p){return p.nombre;}).filter(Boolean);
  };
  // Lista de personal activo con sus datos, para elegir a la persona en "Nueva toma" y no
  // reescribir el nombre (evita duplicados por diferencias de escritura).
  window.listaPersonal=function(){
    return PERSONAL.filter(function(p){return p.activo!==false && p.nombre;}).map(function(p){
      return { nombre:p.nombre, empleado:p.noEmpleado||"", correo:p.correo||"", puesto:p.cargo||"" };
    });
  };
  // Asegura que el personal esté cargado (por si aún no se abrió esa pantalla).
  window.asegurarPersonal=function(cb){
    if(PERSONAL.length){ if(cb) cb(); return; }
    cargarPersonal(function(){ if(cb) cb(); });
  };

  window.openPersonal=function(){ var view=document.getElementById('view'); if(!view)return;
    if(typeof mostrarBuscador==='function') mostrarBuscador(false);
    view.innerHTML='<div style="padding:8px 2px 20px"><button class="backbtn" onclick="goHome()">&lsaquo; Volver</button>'
      +'<div class="per-head"><h2 id="perTitulo">Personal</h2><span class="per-count" id="perCount"></span></div>'
      +'<div class="per-search"><span class="per-searchic">&#128269;</span>'
        +'<input id="perSearch" placeholder="Buscar por nombre, No., cargo o correo..." oninput="filtrarPersonal()" autocomplete="off"></div>'
      +'<div class="per-tabs">'
        +'<div class="perTab sel" data-f="todos" onclick="perSetFiltro(\'todos\')">Todos <span class="per-tabn" id="perN_todos"></span></div>'
        +'<div class="perTab" data-f="activos" onclick="perSetFiltro(\'activos\')">Activos <span class="per-tabn" id="perN_activos"></span></div>'
        +'<div class="perTab" data-f="inactivos" onclick="perSetFiltro(\'inactivos\')">Baja <span class="per-tabn" id="perN_inactivos"></span></div>'
      +'</div>'
      +((typeof puedeEditar!=='function'||puedeEditar())?'<div class="per-acc">'+'<button class="per-add" onclick="editarPersonal(null)">&#65291; Agregar empleado</button>'+'<button class="per-import" onclick="perImportarExcel()" title="Importar desde Excel">&#128228; Importar Excel</button>'+'</div>':'')
      +'<div id="perList"></div></div>';
    if(Date.now()-lastLoad>4000||!PERSONAL.length){ cargarPersonal(pintarPersonal); } else { pintarPersonal(); } };
  window.perSetFiltro=function(f){ perFiltro=f;
    document.querySelectorAll('.perTab').forEach(function(el){
      el.classList.toggle('sel', el.getAttribute('data-f')===f);
    });
    pintarPersonal(); };
  window.filtrarPersonal=function(){ pintarPersonal(); };
  /* ===== PANEL DE ANTIGÜEDAD =====
     La fecha de ingreso sirve para trámites (bono de antigüedad, días de vacaciones,
     reconocimientos), así que conviene ver de un vistazo quién cumple años de servicio
     este mes y a quién le falta el dato. Solo aparece si hay algo que mostrar. */
  var MESES=['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
  function aniversariosDelMes(){
    var hoy=new Date(), mes=hoy.getMonth(), anio=hoy.getFullYear(), diaHoy=hoy.getDate();
    return PERSONAL.filter(function(p){ return p.activo!==false && p.fechaIngreso; })
      .map(function(p){
        var d=parseISO(p.fechaIngreso); if(!d||d.getMonth()!==mes)return null;
        var cumple=anio-d.getFullYear(); if(cumple<=0)return null; // ingresó este mismo año
        return {p:p, dia:d.getDate(), anios:cumple, estado:(d.getDate()<diaHoy?'pasado':(d.getDate()===diaHoy?'hoy':'proximo'))};
      }).filter(Boolean)
      .sort(function(a,b){ return a.dia-b.dia; });
  }
  function panelAntiguedad(){
    var aniv=aniversariosDelMes();
    var sinFecha=PERSONAL.filter(function(p){ return p.activo!==false && !p.fechaIngreso; }).length;
    if(!aniv.length && !sinFecha) return '';
    var filas=aniv.slice(0,4).map(function(a){
      var etq = a.estado==='hoy' ? '<span class="per-chip verde">&#127881; hoy</span>'
              : a.estado==='pasado' ? '<span class="per-chip">'+a.dia+' '+MESES[new Date().getMonth()].slice(0,3)+'</span>'
              : '<span class="per-chip azul">'+a.dia+' '+MESES[new Date().getMonth()].slice(0,3)+'</span>';
      return '<div class="per-aniv-fila" onclick="editarPersonal(\''+esc(a.p.__id)+'\')">'
        +avatarHtml(a.p,30,true)
        +'<div class="per-aniv-info"><div class="per-aniv-nom">'+esc(a.p.nombre)+'</div>'
        +'<div class="per-aniv-sub">cumple '+a.anios+(a.anios===1?' año':' años')+' de servicio</div></div>'
        +etq+'</div>';
    }).join('');
    var masAniv = aniv.length>4 ? '<div class="per-aniv-mas">y '+(aniv.length-4)+' más este mes</div>' : '';
    var cab = aniv.length
      ? '<div class="per-panel-t">&#127874; Aniversarios de '+MESES[new Date().getMonth()]+'</div>' : '';
    var falta = sinFecha
      ? '<div class="per-panel-falta" onclick="perSetFiltro(\'sinfecha\')">&#9888;&#65039; '
        +sinFecha+(sinFecha===1?' empleado activo sin fecha de ingreso':' empleados activos sin fecha de ingreso')
        +' <span class="per-panel-ver">Ver &rsaquo;</span></div>' : '';
    return '<div class="per-panel">'+cab+filas+masAniv+falta+'</div>';
  }

  function pintarPersonal(){ var cont=document.getElementById('perList'); if(!cont)return;
    var q=((document.getElementById('perSearch')||{}).value||'').toLowerCase().trim();
    var arr=PERSONAL.filter(function(p){ if(perFiltro==='activos'&&p.activo===false)return false; if(perFiltro==='inactivos'&&p.activo!==false)return false;
      if(perFiltro==='sinfecha'&&(p.activo===false||p.fechaIngreso))return false;
      return !q||(p.nombre||'').toLowerCase().indexOf(q)>=0||(p.noEmpleado||'').toLowerCase().indexOf(q)>=0
        ||(p.correo||'').toLowerCase().indexOf(q)>=0||(p.cargo||'').toLowerCase().indexOf(q)>=0; });

    // Contadores del encabezado y de cada pestaña
    var nAct=PERSONAL.filter(function(p){return p.activo!==false;}).length, nIna=PERSONAL.length-nAct;
    var tit=document.getElementById('perTitulo'); if(tit) tit.textContent='Personal';
    var cnt=document.getElementById('perCount');
    if(cnt) cnt.textContent=PERSONAL.length+' registrados · '+nAct+' activos'+(nIna?' · '+nIna+' de baja':'');
    var setN=function(id,n){ var e=document.getElementById(id); if(e)e.textContent=n; };
    setN('perN_todos',PERSONAL.length); setN('perN_activos',nAct); setN('perN_inactivos',nIna);

    var panel=(perFiltro==='sinfecha')
      ? '<div class="per-filtro-act">Mostrando solo <b>sin fecha de ingreso</b>'
        +'<span class="per-filtro-x" onclick="perSetFiltro(\'todos\')">Quitar filtro</span></div>'
      : panelAntiguedad();
    if(!arr.length){
      cont.innerHTML=panel+'<div class="per-vacio"><div class="per-vacio-ic">&#128101;</div>'
        +'<div class="per-vacio-t">'+(q?'Sin coincidencias':'Nada por aquí')+'</div>'
        +'<div class="per-vacio-s">'+(q?'No hay empleados que coincidan con “'+esc(q)+'”.':'Agregue al primer empleado con el botón de arriba.')+'</div></div>';
      return;
    }

    cont.innerHTML=panel+arr.map(function(p){ var ina=p.activo===false;
      var fb=ina?fmtFechaISO(p.fechaBaja):'';
      // La antigüedad se congela en la fecha de baja cuando el empleado ya no labora.
      var ant=antiguedadCorta(p.fechaIngreso, ina?p.fechaBaja:'');
      var chips='';
      if(p.noEmpleado) chips+='<span class="per-chip azul">No. '+esc(p.noEmpleado)+'</span>';
      if(p.renglon)    chips+='<span class="per-chip">Renglón '+esc(p.renglon)+'</span>';
      if(p.ubicacion)  chips+='<span class="per-chip azul" title="Ubicación física">&#128205; '+esc(p.ubicacion)+'</span>';
      if(ant)          chips+='<span class="per-chip'+(ina?'':' verde')+'" title="Antigüedad en el departamento">&#128197; '+esc(ant)+'</span>';
      if(ina)          chips+='<span class="per-chip roja">&#9679; Baja'+(fb?' '+esc(fb):'')+'</span>';
      return '<div class="per-card'+(ina?' baja':'')+'" onclick="editarPersonal(\''+esc(p.__id)+'\')">'
        +avatarHtml(p,48,!ina)
        +'<div class="per-body">'
          +'<div class="per-nombre">'+esc(p.nombre)+'</div>'
          +'<div class="per-linea">'+esc(p.cargo||'Sin cargo asignado')+'</div>'
          +(chips?'<div class="per-chips">'+chips+'</div>':'')
        +'</div><div class="per-chev">&rsaquo;</div></div>';
    }).join(''); }
  function tarjetasDePersonal(p){
    if(!p||typeof TARJETAS!=='object') return [];
    var nn=normNombre(p.nombre);
    return Object.values(TARJETAS).filter(function(t){
      if(t.activa===false) return false;
      if(p.noEmpleado&&t.empleado&&String(t.empleado).trim()===String(p.noEmpleado).trim()) return true;
      return nn&&normNombre(t.responsable)===nn;
    });
  }
  function bienesAsignadosHtml(p){
    var tarjs=tarjetasDePersonal(p);
    if(!tarjs.length){
      return '<div class="per-vacio" style="padding:20px 12px"><div class="per-vacio-ic">&#128230;</div>'
        +'<div class="per-vacio-t">Sin bienes asignados</div>'
        +'<div class="per-vacio-s">No se encontró ninguna tarjeta de responsabilidad a su nombre.</div></div>';
    }
    var totalBienes=0, totalQ=0;
    var estColor={'SÍ':'var(--verde)','NO':'var(--rojo)','NO UBICADO':'var(--naranja,#B5651D)'};
    var estTxt={'SÍ':'✓ verificado','NO':'✗ no encontrado','NO UBICADO':'? no ubicado'};
    var bloques=tarjs.map(function(t){
      var items=(typeof BIENES==='object'?Object.values(BIENES):[]).filter(function(b){return b.tarjetaId===t.id;})
        .sort(function(a,b){return (a.codigo||'').localeCompare(b.codigo||'');});
      totalBienes+=items.length;
      items.forEach(function(b){ totalQ+=Number(b.valor||0); });
      var head='<div class="per-tarj-h">'
        +'<b>Tarjeta '+esc(t.numero||'(pendiente)')+' &middot; '+plBien(items.length)+'</b>'
        +'<span class="per-vf" onclick="openPerson(\''+t.id+'\')">Ver ficha &rsaquo;</span></div>';
      var rows=items.length?items.map(function(b){
        return '<div class="per-bien">'
          +'<div class="per-bien-h"><span class="per-bien-cod">'+esc(b.codigo)+'</span>'
          +'<span class="per-bien-est" style="color:'+(estColor[b.existe]||'var(--gris2)')+'">'+(estTxt[b.existe]||'pendiente')+'</span></div>'
          +(b.descripcion?'<div class="per-bien-desc">'+esc(b.descripcion)+'</div>':'')
          +(b.valor?'<div class="per-bien-val">Q'+Number(b.valor).toLocaleString('es-GT',{minimumFractionDigits:2})+'</div>':'')
        +'</div>';
      }).join(''):'<div class="per-bien-val" style="padding:4px 2px">Tarjeta sin bienes cargados.</div>';
      return head+rows;
    }).join('');
    var resumen='<div class="per-resumen">'+plBien(totalBienes)+' en '+tarjs.length+(tarjs.length===1?' tarjeta':' tarjetas')
      +(totalQ?' &middot; Q'+totalQ.toLocaleString('es-GT',{minimumFractionDigits:2})+' en total':'')+'</div>';
    return resumen+bloques;
  }
  // Si el empleado ya está de baja pero todavía tiene bienes a su nombre, hay que reasignarlos.
  function avisoBajaPendiente(p){
    if(!p||p.activo!==false) return '';
    var tarjs=tarjetasDePersonal(p); if(!tarjs.length) return '';
    var ids={}; tarjs.forEach(function(t){ ids[t.id]=1; });
    var n=(typeof BIENES==='object'?Object.values(BIENES):[]).filter(function(b){return ids[b.tarjetaId];}).length;
    if(!n) return '';
    var d=diasDesde(p.fechaBaja);
    var cuando=p.fechaBaja?('Está de baja desde el '+esc(fmtFechaISO(p.fechaBaja))+(d!==null&&d>0?' ('+d+(d===1?' día':' días')+')':'')):'Está de baja (sin fecha registrada)';
    return '<div class="per-aviso roja">'
      +'<b>&#9888;&#65039; '+plBien(n)+(n===1?' sigue':' siguen')+' a su nombre</b>'
      +'<div class="per-aviso-s">'+cuando+'. Hay que reasignar estos bienes a otro responsable.</div>'
      +((typeof puedeEditar!=='function'||puedeEditar())
        ? '<button class="per-reasignar" onclick="perReasignar(\''+esc(p.__id)+'\')">&#8644; Reasignar '+(n===1?'este bien':'estos bienes')+'</button>' : '')
      +'</div>'; }
  /* ===== REASIGNACIÓN DE BIENES EN UN TOQUE =====
     Cuando alguien causa baja, sus bienes siguen a su nombre hasta que alguien más los
     reciba. Antes el aviso solo decía "hay que reasignar"; ahora deja hacerlo aquí mismo.
     Se sigue el mismo camino que usa "Nueva toma" en app.js: se actualiza cada bien con
     su nueva tarjeta y responsable, y se registra un movimiento REASIGNACION por bien,
     para que el historial de cada bien no pierda el rastro de dónde venía. */
  function bienesDePersonal(p){
    var tarjs=tarjetasDePersonal(p); if(!tarjs.length) return [];
    var ids={}; tarjs.forEach(function(t){ ids[t.id]=1; });
    return (typeof BIENES==='object'?Object.values(BIENES):[]).filter(function(b){ return ids[b.tarjetaId]; });
  }
  // Tarjeta a la que llegarán los bienes. Si la persona ya tiene una, se reutiliza;
  // si no, se crea provisional (sin número) igual que hace resolverTarjetaDestino en app.js.
  function resolverDestino(dest){
    var previa = (typeof buscarTarjetaPorNombre==='function') ? buscarTarjetaPorNombre(dest.nombre) : null;
    if(previa) return Promise.resolve({id:previa.id, numero:previa.numero||''});
    var docId = 'PEND_'+((typeof bienDocId==='function')?bienDocId(dest.nombre):normNombre(dest.nombre).replace(/[^\w-]/g,'_'));
    var ts=firebase.firestore.FieldValue.serverTimestamp();
    return db().collection('tarjetas').doc(docId).set({
      numero:'', responsable:dest.nombre, empleado:dest.noEmpleado||'', correo:dest.correo||'',
      puesto:dest.cargo||'', tipo:'INDIVIDUAL', activa:true, provisional:true,
      creada:ts, actualizada:ts
    },{merge:true}).then(function(){ return {id:docId, numero:''}; });
  }

  window.perReasignar=function(origenId){
    if(typeof requiereEdicion==='function' && !requiereEdicion())return;
    var org=PERSONAL.find(function(x){return x.__id===origenId;}); if(!org)return;
    var bienes=bienesDePersonal(org);
    if(!bienes.length){ toast('Esta persona ya no tiene bienes a su nombre'); return; }
    var candidatos=PERSONAL.filter(function(x){ return x.activo!==false && x.nombre && x.__id!==origenId; })
      .sort(function(a,b){ return (a.nombre||'').localeCompare(b.nombre||''); });
    if(!candidatos.length){ toast('No hay empleados activos para recibir los bienes'); return; }
    var sheet=document.getElementById('sheet'); if(!sheet){ toast('No se puede abrir el selector'); return; }
    sheet.innerHTML='<div class="grip"></div><h3>Reasignar '+plBien(bienes.length)+'</h3>'
      +'<div class="note">Salen de <b>'+esc(org.nombre)+'</b>. Elija quién los recibe; queda registrado el movimiento de cada bien.</div>'
      +'<input id="perReasQ" placeholder="Buscar empleado..." oninput="perReasFiltrar()" autocomplete="off"'
        +' style="width:100%;padding:11px;border:1.4px solid var(--linea);border-radius:9px;font-size:15px;margin-top:10px;box-sizing:border-box;background:var(--card);color:var(--ink,#1a1f26)">'
      +'<div id="perReasLista" style="max-height:46vh;overflow:auto;margin-top:10px">'+perReasFilas(candidatos,origenId)+'</div>'
      +'<button class="act o" onclick="closeMenu()">Cancelar</button>';
    window.__perReasCands=candidatos; window.__perReasOrigen=origenId;
    if(typeof showSheet==='function') showSheet();
  };
  function perReasFilas(arr,origenId){
    if(!arr.length) return '<div class="per-vacio" style="padding:18px"><div class="per-vacio-s">Sin coincidencias</div></div>';
    return arr.map(function(c){
      return '<div class="per-card" style="margin-bottom:7px" onclick="perReasConfirmar(\''+esc(origenId)+'\',\''+esc(c.__id)+'\')">'
        +avatarHtml(c,40,true)
        +'<div class="per-body"><div class="per-nombre">'+esc(c.nombre)+'</div>'
        +'<div class="per-linea">'+esc(c.cargo||'Sin cargo')+(c.noEmpleado?' · No. '+esc(c.noEmpleado):'')+'</div></div>'
        +'<div class="per-chev">&rsaquo;</div></div>';
    }).join('');
  }
  window.perReasFiltrar=function(){
    var q=((document.getElementById('perReasQ')||{}).value||'').toLowerCase().trim();
    var arr=(window.__perReasCands||[]).filter(function(c){
      return !q||(c.nombre||'').toLowerCase().indexOf(q)>=0||(c.cargo||'').toLowerCase().indexOf(q)>=0||(c.noEmpleado||'').toLowerCase().indexOf(q)>=0; });
    var cont=document.getElementById('perReasLista'); if(cont)cont.innerHTML=perReasFilas(arr,window.__perReasOrigen);
  };
  window.perReasConfirmar=function(origenId,destinoId){
    var org=PERSONAL.find(function(x){return x.__id===origenId;});
    var dst=PERSONAL.find(function(x){return x.__id===destinoId;});
    if(!org||!dst)return;
    var n=bienesDePersonal(org).length;
    if(!confirm('¿Pasar '+plBien(n)+' de '+org.nombre+' a '+dst.nombre+'?\n\nSe registrará el movimiento de cada bien.')) return;
    if(typeof closeMenu==='function') closeMenu();
    perEjecutarReasignacion(org,dst);
  };
  function perEjecutarReasignacion(org,dst){
    var bienes=bienesDePersonal(org);
    if(!bienes.length){ toast('Ya no hay bienes que reasignar'); return; }
    toast('Reasignando '+plBien(bienes.length)+'...');
    resolverDestino(dst).then(function(destino){
      var ts=firebase.firestore.FieldValue.serverTimestamp();
      var fechaTxt=(typeof today==='function')?today():fmtFechaISO(hoyISO());
      var quien=(typeof META==='object'&&META&&META.by)||'';
      // Firestore admite 500 operaciones por lote y cada bien usa 2 (el bien y su
      // movimiento), así que se parte de 200 en 200 para no pasarse.
      var grupos=[]; for(var i=0;i<bienes.length;i+=200) grupos.push(bienes.slice(i,i+200));
      return grupos.reduce(function(cadena,grupo){
        return cadena.then(function(){
          var lote=db().batch();
          grupo.forEach(function(b){
            var idBien=b.id||b.__id||((typeof bienDocId==='function')?bienDocId(b.codigo):b.codigo);
            lote.set(db().collection('bienes').doc(idBien),{
              tarjetaId:destino.id, tarjetaNumero:destino.numero||'', responsable:dst.nombre,
              tarjetaAnteriorNumero:b.tarjetaNumero||'', responsableAnterior:b.responsable||org.nombre,
              actualizado:ts
            },{merge:true});
            lote.set(db().collection('movimientos').doc(),{
              codigo:b.codigo, tipoMovimiento:'REASIGNACION',
              tarjetaAnteriorNumero:b.tarjetaNumero||'', responsableAnterior:b.responsable||org.nombre,
              tarjetaNuevaNumero:destino.numero||'', responsableNuevo:dst.nombre,
              estado:b.estado||'', ubicacion:b.ubicacion||'',
              observaciones:'Reasignado por baja de '+org.nombre,
              fecha:ts, fechaTxt:fechaTxt, capturadoPor:quien
            });
          });
          return lote.commit();
        });
      },Promise.resolve()).then(function(){ return destino; });
    }).then(function(){
      toast('✓ '+plBien(bienes.length)+(bienes.length===1?' pasó a ':' pasaron a ')+dst.nombre);
      cargarPersonal(function(){ editarPersonal(org.__id); });
    }).catch(function(e){ console.error(e); toast('No se pudo reasignar (revise conexión)'); });
  }

  window.editarPersonal=function(id){ var p=id?PERSONAL.find(function(x){return x.__id===id;}):{renglon:'011',cargo:'',noEmpleado:'',nombre:'',dpi:'',correo:'',activo:true,fechaIngreso:'',fechaBaja:''}; if(!p)return;
    perFotoActual=p.foto||'';
    perUbicActual=p.ubicacion||'';
    var view=document.getElementById('view');
    function f(l,k,val,tipo,hint){
      return '<label class="per-fld"><span class="per-lbl">'+l+'</span>'
        +'<input type="'+(tipo||'text')+'" id="pf_'+k+'" value="'+esc(val||'')+'"'+(tipo==='date'?' max="'+hoyISO()+'"':'')+'>'
        +(hint?'<span class="per-hint">'+hint+'</span>':'')+'</label>'; }

    var act=p.activo!==false;
    var antTxt=antiguedadTexto(p.fechaIngreso, act?'':p.fechaBaja);
    var hintIngreso=antTxt
      ? '&#128197; '+(act?'Lleva ':'Estuvo ')+antTxt+' en el departamento.'
      : 'Sirve para calcular la antigüedad en el departamento.';

    var fotoBox='<div class="per-foto-box">'
      +'<div id="pf_fotoWrap">'+avatarHtml(p,104)+'</div>'
      +'<div class="per-foto-acc">'
        +'<label class="per-fbtn prim">&#128247; Tomar foto'
          +'<input type="file" accept="image/*" capture="user" onchange="perFotoSeleccionar(this)" style="display:none"></label>'
        +'<label class="per-fbtn sec">&#128444;&#65039; Subir foto'
          +'<input type="file" accept="image/*" onchange="perFotoSeleccionar(this)" style="display:none"></label>'
        +'<button type="button" class="per-fbtn del" id="pf_fotoQuitar" onclick="perFotoQuitar()" style="display:'+(perFotoActual?'inline-flex':'none')+'">Quitar</button>'
      +'</div></div>';

    view.innerHTML='<div class="per-form"><button class="backbtn" onclick="openPersonal()">&lsaquo; Personal</button>'
      +'<h2>'+(id?'Editar empleado':'Nuevo empleado')+'</h2>'
      +fotoBox
      +'<div class="per-sec"><h3>&#128100; Datos personales</h3>'
        +f('Nombre completo','nombre',p.nombre)
        +f('DPI','dpi',p.dpi)
        +f('Correo','correo',p.correo,'email')
      +'</div>'
      +'<div class="per-sec"><h3>&#128188; Datos laborales</h3>'
        +f('No. de empleado','noEmpleado',p.noEmpleado)
        +f('Renglón','renglon',p.renglon)
        +f('Cargo nominal','cargo',p.cargo)
        +'<div class="per-fld"><span class="per-lbl">Ubicación física (dónde se encuentra)</span>'
          +'<div id="pf_ubicWrap" class="per-ubicgrp">'+ubicBotonesPer(perUbicActual)+'</div></div>'
        +f('Fecha de ingreso al departamento','fechaIngreso',p.fechaIngreso,'date',hintIngreso)
      +'</div>'
      +'<div class="per-sec"><h3>&#128203; Situación laboral</h3>'
        +'<label class="per-switch"><input type="checkbox" id="pf_activo" '+(act?'checked':'')+'>'
          +'<span><span class="per-sw-t">Empleado activo</span>'
          +'<span class="per-sw-s">Desmárquelo si la persona ya no labora en el departamento.</span></span></label>'
        +f('Fecha de baja','fechaBaja',p.fechaBaja,'date','Déjela vacía si sigue laborando.')
      +'</div>'
      +'<button class="per-guardar" onclick="guardarPersonal(\''+(id||'')+'\')">Guardar</button>'
      +(id?'<button class="per-toggle" onclick="togglePersonal(\''+id+'\','+act+')">'+(act?'Marcar INACTIVO (ya no labora)':'Reactivar empleado')+'</button>':'')
      +(id?avisoBajaPendiente(p):'')
      +(id?'<div class="per-sec"><h3>&#128230; Bienes asignados</h3>'+bienesAsignadosHtml(p)+'</div>':'')
      +'</div>'; };
  window.guardarPersonal=function(id){ if(typeof requiereEdicion==='function' && !requiereEdicion())return;
    var g=function(k){var el=document.getElementById('pf_'+k);return el?el.value.trim():'';};
    var noEmp=g('noEmpleado'),nom=g('nombre'); if(!nom){toast('El nombre es obligatorio');return;} if(!noEmp){toast('El No. de empleado es obligatorio');return;}
    var dup=PERSONAL.find(function(x){return x.noEmpleado===noEmp&&x.__id!==id;}); if(dup){toast('Ya existe un empleado con ese No.: '+dup.nombre);return;}
    var act=document.getElementById('pf_activo').checked;
    var fIng=g('fechaIngreso');
    if(fIng && parseISO(fIng) && parseISO(fIng)>new Date()){ toast('La fecha de ingreso no puede ser futura'); return; }
    // Si sigue activo no puede quedar fecha de baja; si se marca de baja sin fecha, se asume hoy.
    var fBaja=act?'':(g('fechaBaja')||hoyISO());
    // La baja no puede ser anterior al ingreso: dejaría una antigüedad negativa.
    if(fIng && fBaja && parseISO(fIng) && parseISO(fBaja) && parseISO(fBaja)<parseISO(fIng)){
      toast('La fecha de baja no puede ser anterior al ingreso'); return; }
    var data={nombre:nom,noEmpleado:noEmp,renglon:g('renglon'),cargo:g('cargo'),dpi:g('dpi'),correo:g('correo'),ubicacion:perUbicActual||'',foto:perFotoActual||'',fechaIngreso:fIng,activo:act,fechaBaja:fBaja,actualizado:new Date().toISOString()};
    var docId=id||noEmp.replace(/[^\w-]/g,'_'); if(!id)data.creado=new Date().toISOString();
    db().collection('personal').doc(docId).set(data,{merge:true}).then(function(){toast('Empleado guardado');cargarPersonal(openPersonal);}).catch(function(e){toast('Error al guardar');console.error(e);}); };
  function aplicarBaja(id,activo,fechaBaja){
    return db().collection('personal').doc(id).set({activo:activo,fechaBaja:fechaBaja,actualizado:new Date().toISOString()},{merge:true})
      .then(function(){ toast(activo?'Reactivado':('Marcado de baja'+(fechaBaja?' el '+fmtFechaISO(fechaBaja):'')));cargarPersonal(openPersonal); })
      .catch(function(e){ console.error(e); toast('No se pudo guardar'); }); }
  window.togglePersonal=function(id,a){ if(typeof requiereEdicion==='function' && !requiereEdicion())return;
    if(!a){ aplicarBaja(id,true,''); return; } // reactivar: se limpia la fecha de baja
    var p=PERSONAL.find(function(x){return x.__id===id;});
    var sug=(p&&p.fechaBaja)||hoyISO();
    if(typeof pedirTexto==='function'){
      pedirTexto('Fecha de baja','¿Desde qué fecha ya no labora '+((p&&p.nombre)||'este empleado')+'? Se guarda para dejar constancia de cuándo dejó de ser responsable de sus bienes.',sug,'date',function(val){
        aplicarBaja(id,false,(val||'').trim()||sug);
      });
    } else { aplicarBaja(id,false,sug); } };

  function addBtn(){ var bar=document.querySelector('.fabbar'); if(!bar||document.getElementById('fb-personal'))return;
    var b=document.createElement('button'); b.id='fb-personal'; b.className='fb-home'; b.style.background='#3B4E6B'; b.style.color='#fff';
    b.innerHTML=(typeof icon==='function'?icon('user',20):'')+'<span>Personal</span>'; b.onclick=function(){openPersonal();}; bar.appendChild(b); }

  function marcarAlarmas(){ if(typeof TARJETAS==='undefined'||!PACTIVOS)return;
    document.querySelectorAll('#view .prow').forEach(function(row){ var old=row.querySelector('.alarma-badge'); if(old)old.remove(); row.style.background=''; row.style.border='';
      var m=(row.getAttribute('onclick')||'').match(/openPerson\('([^']+)'\)/); if(!m)return; var t=TARJETAS[m[1]]; if(!t)return;
      if(!esActivo(t.responsable||'')){ row.style.background='var(--rojobg)'; row.style.border='1px solid var(--rojob)';
        var b=document.createElement('div'); b.className='alarma-badge'; b.style.cssText='color:var(--rojo);font-size:12px;font-weight:700;margin-top:3px'; b.innerHTML='&#9888;&#65039; Ya no está en el listado — reasignar bienes';
        var info=row.querySelector('.pinfo'); if(info)info.appendChild(b); } }); }
  function actualizarResumen(){ var view=document.getElementById('view'); if(!view||!document.querySelector('#view .prow')||!PACTIVOS)return;
    var ex=document.getElementById('resumenAlerta'); if(ex)ex.remove();
    var resp={}; Object.keys(TARJETAS).forEach(function(id){ var t=TARJETAS[id]; var n=(t.responsable||'').trim(); if(n&&!esActivo(n))resp[n]=1; });
    var nResp=Object.keys(resp).length; if(!nResp)return; var nB=0;
    if(typeof BIENES==='object'){ Object.keys(BIENES).forEach(function(id){ var b=BIENES[id]; if(b&&resp[(b.responsable||'').trim()])nB++; }); }
    var box=document.createElement('div'); box.id='resumenAlerta'; box.style.cssText='background:var(--rojobg);border:1px solid var(--rojob);border-radius:12px;padding:12px 14px;margin:0 2px 10px;display:flex;align-items:center;gap:10px';
    box.innerHTML='<span style="font-size:20px;line-height:1">&#9888;&#65039;</span><div style="flex:1">'
      +'<b style="color:var(--rojo);font-size:14px;display:block;line-height:1.3">'+nResp+(nResp===1?' responsable ya no está':' responsables ya no están')+' en el listado</b>'
      +'<div style="font-size:12.5px;color:var(--gris);margin-top:2px">'+nB+(nB===1?' bien':' bienes')+' por reasignar. Revise las tarjetas marcadas abajo.</div></div>';
    var hz=view.querySelector('.hzrow'), first=document.querySelector('#view .prow'); var ref=hz||first; if(ref&&ref.parentNode)ref.parentNode.insertBefore(box,ref); }
  function sugerirEnFicha(){ var view=document.getElementById('view'); if(!view||typeof TARJETAS==='undefined'||!PACTIVOS)return;
    var back=view.querySelector('.backbtn'); if(!back||back.textContent.indexOf('Responsables')<0)return; if(document.getElementById('sugCambio'))return;
    var header=view.children[1]; if(!header)return; var nombre=(header.textContent||'').trim();
    var orphanNom=null; Object.keys(TARJETAS).forEach(function(id){ var rn=(TARJETAS[id].responsable||'').trim(); if(rn&&nombre.indexOf(rn)>=0&&!esActivo(rn))orphanNom=rn; }); if(!orphanNom)return;
    var cand={}; if(typeof BIENES==='object'){ Object.keys(BIENES).forEach(function(id){ var b=BIENES[id]; if(b&&(b.responsable||'').trim()===orphanNom){ var v=(b.observaciones||'').trim(); if(v)cand[v]=(cand[v]||0)+1; } }); }
    var lista=Object.keys(cand).sort(function(a,b){return cand[b]-cand[a];});
    var box=document.createElement('div'); box.id='sugCambio'; box.style.cssText='background:var(--amarbg);border:1px solid var(--naranjab);border-radius:12px;padding:12px 14px;margin:8px 2px';
    box.innerHTML='<b style="color:var(--amar)">&#9888;&#65039; Este responsable ya no está en el listado</b><div style="font-size:13px;color:var(--gris);margin-top:4px">Hay que reasignar sus bienes.'
      +(lista.length?' Según tus anotaciones, posibles nuevos responsables:</div><div style="margin-top:6px">'+lista.slice(0,5).map(function(c){return '<span style="display:inline-block;background:var(--amarbg);border:1px solid var(--naranjab);border-radius:8px;padding:3px 9px;margin:2px;font-size:12.5px;color:var(--amar)">'+esc(c)+' ('+cand[c]+')</span>';}).join('')+'</div>':' No hay anotaciones de quién los tiene.</div>');
    header.parentNode.insertBefore(box,header.nextSibling); }

  ['render','renderPerson'].forEach(function(fn){ var orig=window[fn]; if(typeof orig==='function'){ window[fn]=function(){ var r=orig.apply(this,arguments); setTimeout(function(){ marcarAlarmas(); if(fn==='render')actualizarResumen(); if(fn==='renderPerson')sugerirEnFicha(); },20); return r; }; } });
  var iv=setInterval(function(){ addBtn(); if(document.getElementById('fb-personal'))clearInterval(iv); },700);
  setTimeout(function(){ addBtn(); cargarPersonal(); },1200);
})();
