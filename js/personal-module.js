/* ===== MODULO PERSONAL + ALARMAS INTELIGENTES (anadido; no altera logica existente) ===== */
(function(){
  function db(){ return firebase.firestore(); }
  var PERSONAL=[], PACTIVOS=null, lastLoad=0, perFiltro='todos';
  function esc(x){ return (x==null?'':String(x)).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
  function normNombre(s){ return String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' ').trim().toUpperCase(); }
  function fmtFecha(iso){ var m=/^(\d{4})-(\d{2})-(\d{2})/.exec(iso||''); return m?(m[3]+'/'+m[2]+'/'+m[1]):''; }
  function hoyISO(){ return new Date().toISOString().slice(0,10); }
  var STOP={de:1,la:1,los:1,las:1,y:1,del:1,e:1};
  function tset(s){ var o={}; String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z\s]/g,' ').split(/\s+/).forEach(function(w){ if(w&&!STOP[w])o[w]=1; }); return o; }
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

  window.openPersonal=function(){ var view=document.getElementById('view'); if(!view)return;
    view.innerHTML='<div style="padding:8px 2px"><button class="backbtn" onclick="goHome()">&lsaquo; Volver</button>'
      +'<h2 id="perTitulo" style="margin:10px 2px 6px;color:#1F3864">Personal</h2>'
      +'<input id="perSearch" placeholder="Buscar por nombre, No. o correo..." oninput="filtrarPersonal()" style="width:100%;padding:11px;border:1px solid #cdd6e4;border-radius:10px;margin-bottom:8px">'
      +'<div style="display:flex;gap:6px;margin-bottom:8px">'
        +'<div class="perTab" data-f="todos" onclick="perSetFiltro(\'todos\')" style="flex:1;text-align:center;padding:8px;border-radius:9px;background:#1F3864;color:#fff;font-weight:700;font-size:13px;cursor:pointer">Todos</div>'
        +'<div class="perTab" data-f="activos" onclick="perSetFiltro(\'activos\')" style="flex:1;text-align:center;padding:8px;border-radius:9px;background:#EAEEF4;color:#1F3864;font-weight:700;font-size:13px;cursor:pointer">Activos</div>'
        +'<div class="perTab" data-f="inactivos" onclick="perSetFiltro(\'inactivos\')" style="flex:1;text-align:center;padding:8px;border-radius:9px;background:#EAEEF4;color:#1F3864;font-weight:700;font-size:13px;cursor:pointer">Inactivos</div>'
      +'</div>'
      +((typeof puedeEditar!=='function'||puedeEditar())?'<button onclick="editarPersonal(null)" style="width:100%;padding:12px;border:none;border-radius:10px;background:#2E7D32;color:#fff;font-weight:700;margin-bottom:10px">&#65291; Agregar empleado</button>':'')
      +'<div id="perList"></div></div>';
    if(Date.now()-lastLoad>4000||!PERSONAL.length){ cargarPersonal(pintarPersonal); } else { pintarPersonal(); } };
  window.perSetFiltro=function(f){ perFiltro=f; document.querySelectorAll('.perTab').forEach(function(el){ var on=el.getAttribute('data-f')===f; el.style.background=on?'#1F3864':'#EAEEF4'; el.style.color=on?'#fff':'#1F3864'; }); pintarPersonal(); };
  window.filtrarPersonal=function(){ pintarPersonal(); };
  function pintarPersonal(){ var cont=document.getElementById('perList'); if(!cont)return;
    var q=((document.getElementById('perSearch')||{}).value||'').toLowerCase();
    var arr=PERSONAL.filter(function(p){ if(perFiltro==='activos'&&p.activo===false)return false; if(perFiltro==='inactivos'&&p.activo!==false)return false;
      return !q||(p.nombre||'').toLowerCase().indexOf(q)>=0||(p.noEmpleado||'').toLowerCase().indexOf(q)>=0||(p.correo||'').toLowerCase().indexOf(q)>=0; });
    var tit=document.getElementById('perTitulo'); if(tit){ var na=PERSONAL.filter(function(p){return p.activo!==false;}).length; tit.innerHTML='Personal &middot; '+PERSONAL.length+' <small style="color:#5E7196;font-weight:600">('+na+' activos)</small>'; }
    cont.innerHTML=arr.map(function(p){ var ina=p.activo===false;
      return '<div style="background:'+(ina?'#FFF4F4':'#fff')+';border:1px solid '+(ina?'#F3C6C6':'#e6e9f0')+';border-radius:12px;padding:12px;margin-bottom:8px;cursor:pointer" onclick="editarPersonal(\''+esc(p.__id)+'\')">'
        +'<div style="font-weight:700;color:#1F3864">'+esc(p.nombre)+(ina?' <span style="color:#c0392b;font-size:12px">&#9940; inactivo'+(p.fechaBaja?' desde '+esc(fmtFecha(p.fechaBaja)):'')+'</span>':'')+'</div>'
        +'<div style="font-size:12.5px;color:#5E7196">No. '+esc(p.noEmpleado)+' &middot; '+esc(p.cargo||'-')+' &middot; Renglon '+esc(p.renglon||'-')+'</div>'
        +'<div style="font-size:12.5px;color:#5E7196">'+esc(p.correo||'sin correo')+(p.dpi?' &middot; DPI '+esc(p.dpi):'')+'</div></div>';
    }).join('')||'<div style="color:#5E7196;padding:10px">Sin resultados</div>'; }
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
      return '<div style="color:#5E7196;font-size:13px;padding:8px 0">No se encontró ninguna tarjeta de responsabilidad a nombre de este empleado.</div>';
    }
    var totalBienes=0, totalQ=0;
    var estColor={'SÍ':'#2E7D32','NO':'#B4232F','NO UBICADO':'#B5651D'};
    var estTxt={'SÍ':'✓ verificado','NO':'✗ no encontrado','NO UBICADO':'? no ubicado'};
    var bloques=tarjs.map(function(t){
      var items=(typeof BIENES==='object'?Object.values(BIENES):[]).filter(function(b){return b.tarjetaId===t.id;})
        .sort(function(a,b){return (a.codigo||'').localeCompare(b.codigo||'');});
      totalBienes+=items.length;
      items.forEach(function(b){ totalQ+=Number(b.valor||0); });
      var head='<div style="display:flex;justify-content:space-between;align-items:center;margin:10px 0 6px">'
        +'<b style="font-size:13px;color:#1F3864">Tarjeta '+esc(t.numero||'(pendiente)')+' &middot; '+items.length+' bien(es)</b>'
        +'<span style="font-size:12px;color:#6d28d9;font-weight:700;cursor:pointer" onclick="openPerson(\''+t.id+'\')">Ver ficha &rsaquo;</span></div>';
      var rows=items.length?items.map(function(b){
        return '<div style="border:1px solid #e6e9f0;border-radius:10px;padding:9px 11px;margin-bottom:6px">'
          +'<div style="display:flex;justify-content:space-between;gap:8px"><b style="color:#17202e">'+esc(b.codigo)+'</b>'
          +'<span style="font-size:12px;font-weight:700;color:'+(estColor[b.existe]||'#8A929C')+'">'+(estTxt[b.existe]||'pendiente')+'</span></div>'
          +(b.descripcion?'<div style="font-size:12.5px;color:#5B6470;margin-top:2px">'+esc(b.descripcion)+'</div>':'')
          +'<div style="font-size:11.5px;color:#8A929C;margin-top:2px">'+(b.valor?'Q'+Number(b.valor).toLocaleString('es-GT',{minimumFractionDigits:2}):'')+'</div>'
        +'</div>';
      }).join(''):'<div style="color:#8A929C;font-size:12.5px">Tarjeta sin bienes cargados.</div>';
      return head+rows;
    }).join('');
    var resumen='<div style="font-size:12.5px;color:#5E7196;margin-bottom:4px">'+totalBienes+' bien(es) en '+tarjs.length+' tarjeta(s)'
      +(totalQ?' &middot; Q'+totalQ.toLocaleString('es-GT',{minimumFractionDigits:2})+' en total':'')+'</div>';
    return resumen+bloques;
  }
  window.editarPersonal=function(id){ var p=id?PERSONAL.find(function(x){return x.__id===id;}):{renglon:'011',cargo:'',noEmpleado:'',nombre:'',dpi:'',correo:'',activo:true,fechaBaja:''}; if(!p)return;
    var view=document.getElementById('view');
    function f(l,k,val){ return '<label style="display:block;font-size:12.5px;color:#5E7196;margin-top:8px">'+l+'<input id="pf_'+k+'" value="'+esc(val||'')+'" style="width:100%;padding:10px;border:1px solid #cdd6e4;border-radius:9px;margin-top:3px"></label>'; }
    function fFecha(l,k,val){ return '<label style="display:block;font-size:12.5px;color:#5E7196;margin-top:8px">'+l+'<input type="date" id="pf_'+k+'" value="'+esc(val||'')+'" style="width:100%;padding:10px;border:1px solid #cdd6e4;border-radius:9px;margin-top:3px"></label>'; }
    view.innerHTML='<div style="padding:8px 2px"><button class="backbtn" onclick="openPersonal()">&lsaquo; Personal</button>'
      +'<h2 style="margin:10px 2px;color:#1F3864">'+(id?'Editar empleado':'Nuevo empleado')+'</h2>'
      +f('Nombre completo','nombre',p.nombre)+f('No. de empleado','noEmpleado',p.noEmpleado)+f('Renglon','renglon',p.renglon)+f('Cargo nominal','cargo',p.cargo)+f('DPI','dpi',p.dpi)+f('Correo','correo',p.correo)
      +'<label style="display:block;margin-top:12px;font-size:13px;color:#1F3864"><input type="checkbox" id="pf_activo" '+(p.activo!==false?'checked':'')+'> Empleado activo</label>'
      +fFecha('Fecha de baja (si ya no labora)','fechaBaja',p.fechaBaja)
      +'<button onclick="guardarPersonal(\''+(id||'')+'\')" style="width:100%;padding:13px;border:none;border-radius:10px;background:#2E7D32;color:#fff;font-weight:700;margin-top:14px">Guardar</button>'
      +(id?'<button onclick="togglePersonal(\''+id+'\','+(p.activo!==false)+')" style="width:100%;padding:11px;border:1px solid #cdd6e4;border-radius:10px;background:#fff;color:#c0392b;font-weight:700;margin-top:8px">'+(p.activo!==false?'Marcar INACTIVO (ya no labora)':'Reactivar empleado')+'</button>':'')
      +(id?'<div style="margin-top:18px;border-top:1px solid #e6e9f0;padding-top:14px"><h3 style="margin:0 0 8px;color:#1F3864;font-size:16px">📦 Bienes asignados</h3>'+bienesAsignadosHtml(p)+'</div>':'')
      +'</div>'; };
  window.guardarPersonal=function(id){ if(typeof requiereEdicion==='function' && !requiereEdicion())return;
    var g=function(k){var el=document.getElementById('pf_'+k);return el?el.value.trim():'';};
    var noEmp=g('noEmpleado'),nom=g('nombre'); if(!nom){toast('El nombre es obligatorio');return;} if(!noEmp){toast('El No. de empleado es obligatorio');return;}
    var dup=PERSONAL.find(function(x){return x.noEmpleado===noEmp&&x.__id!==id;}); if(dup){toast('Ya existe un empleado con ese No.: '+dup.nombre);return;}
    var activoChk=document.getElementById('pf_activo').checked;
    var fechaBaja=g('fechaBaja');
    if(!activoChk && !fechaBaja) fechaBaja=hoyISO();
    if(activoChk) fechaBaja='';
    var data={nombre:nom,noEmpleado:noEmp,renglon:g('renglon'),cargo:g('cargo'),dpi:g('dpi'),correo:g('correo'),activo:activoChk,fechaBaja:fechaBaja,actualizado:new Date().toISOString()};
    var docId=id||noEmp.replace(/[^\w-]/g,'_'); if(!id)data.creado=new Date().toISOString();
    db().collection('personal').doc(docId).set(data,{merge:true}).then(function(){toast('Empleado guardado');cargarPersonal(openPersonal);}).catch(function(e){toast('Error al guardar');console.error(e);}); };
  window.togglePersonal=function(id,a){ if(typeof requiereEdicion==='function' && !requiereEdicion())return;
    var p=PERSONAL.find(function(x){return x.__id===id;});
    var nuevoActivo=!a;
    var patch={activo:nuevoActivo,actualizado:new Date().toISOString()};
    patch.fechaBaja=nuevoActivo?'':((p&&p.fechaBaja)||hoyISO());
    db().collection('personal').doc(id).set(patch,{merge:true}).then(function(){toast(a?'Marcado inactivo':'Reactivado');cargarPersonal(openPersonal);}).catch(function(e){console.error(e);}); };

  function addBtn(){ var bar=document.querySelector('.fabbar'); if(!bar||document.getElementById('fb-personal'))return;
    var b=document.createElement('button'); b.id='fb-personal'; b.className='fb-home'; b.style.background='#3B4E6B'; b.style.color='#fff';
    b.innerHTML=(typeof icon==='function'?icon('user',20):'')+'<span>Personal</span>'; b.onclick=function(){openPersonal();}; bar.appendChild(b); }

  function marcarAlarmas(){ if(typeof TARJETAS==='undefined'||!PACTIVOS)return;
    document.querySelectorAll('#view .prow').forEach(function(row){ var old=row.querySelector('.alarma-badge'); if(old)old.remove(); row.style.background=''; row.style.border='';
      var m=(row.getAttribute('onclick')||'').match(/openPerson\('([^']+)'\)/); if(!m)return; var t=TARJETAS[m[1]]; if(!t)return;
      if(!esActivo(t.responsable||'')){ row.style.background='#FFF4F4'; row.style.border='1px solid #F3C6C6';
        var b=document.createElement('div'); b.className='alarma-badge'; b.style.cssText='color:#c0392b;font-size:12px;font-weight:700;margin-top:3px'; b.innerHTML='&#9888;&#65039; Ya no esta en el listado - reasignar bienes';
        var info=row.querySelector('.pinfo'); if(info)info.appendChild(b); } }); }
  function actualizarResumen(){ var view=document.getElementById('view'); if(!view||!document.querySelector('#view .prow')||!PACTIVOS)return;
    var ex=document.getElementById('resumenAlerta'); if(ex)ex.remove();
    var resp={}; Object.keys(TARJETAS).forEach(function(id){ var t=TARJETAS[id]; var n=(t.responsable||'').trim(); if(n&&!esActivo(n))resp[n]=1; });
    var nResp=Object.keys(resp).length; if(!nResp)return; var nB=0;
    if(typeof BIENES==='object'){ Object.keys(BIENES).forEach(function(id){ var b=BIENES[id]; if(b&&resp[(b.responsable||'').trim()])nB++; }); }
    var box=document.createElement('div'); box.id='resumenAlerta'; box.style.cssText='background:#FFF4F4;border:1px solid #F3C6C6;border-radius:12px;padding:12px 14px;margin:0 2px 10px;display:flex;align-items:center;gap:10px';
    box.innerHTML='<span style="font-size:22px">&#9888;&#65039;</span><div style="flex:1"><b style="color:#c0392b">'+nResp+' responsable(s) ya no estan en el listado</b><div style="font-size:12.5px;color:#7a3b3b">'+nB+' bien(es) por reasignar. Revisa las tarjetas marcadas abajo.</div></div>';
    var hz=view.querySelector('.hzrow'), first=document.querySelector('#view .prow'); var ref=hz||first; if(ref&&ref.parentNode)ref.parentNode.insertBefore(box,ref); }
  function sugerirEnFicha(){ var view=document.getElementById('view'); if(!view||typeof TARJETAS==='undefined'||!PACTIVOS)return;
    var back=view.querySelector('.backbtn'); if(!back||back.textContent.indexOf('Responsables')<0)return; if(document.getElementById('sugCambio'))return;
    var header=view.children[1]; if(!header)return; var nombre=(header.textContent||'').trim();
    var orphanNom=null; Object.keys(TARJETAS).forEach(function(id){ var rn=(TARJETAS[id].responsable||'').trim(); if(rn&&nombre.indexOf(rn)>=0&&!esActivo(rn))orphanNom=rn; }); if(!orphanNom)return;
    var cand={}; if(typeof BIENES==='object'){ Object.keys(BIENES).forEach(function(id){ var b=BIENES[id]; if(b&&(b.responsable||'').trim()===orphanNom){ var v=(b.observaciones||'').trim(); if(v)cand[v]=(cand[v]||0)+1; } }); }
    var lista=Object.keys(cand).sort(function(a,b){return cand[b]-cand[a];});
    var box=document.createElement('div'); box.id='sugCambio'; box.style.cssText='background:#FFF8E6;border:1px solid #F0D68A;border-radius:12px;padding:12px 14px;margin:8px 2px';
    box.innerHTML='<b style="color:#8a6d00">&#9888;&#65039; Este responsable ya no esta en el listado</b><div style="font-size:13px;color:#6b5a1e;margin-top:4px">Hay que reasignar sus bienes.'
      +(lista.length?' Segun tus anotaciones, posibles nuevos responsables:</div><div style="margin-top:6px">'+lista.slice(0,5).map(function(c){return '<span style="display:inline-block;background:#F5E6B8;border-radius:8px;padding:3px 9px;margin:2px;font-size:12.5px;color:#6b5a1e">'+esc(c)+' ('+cand[c]+')</span>';}).join('')+'</div>':' No hay anotaciones de quien los tiene.</div>');
    header.parentNode.insertBefore(box,header.nextSibling); }

  ['render','renderPerson'].forEach(function(fn){ var orig=window[fn]; if(typeof orig==='function'){ window[fn]=function(){ var r=orig.apply(this,arguments); setTimeout(function(){ marcarAlarmas(); if(fn==='render')actualizarResumen(); if(fn==='renderPerson')sugerirEnFicha(); },20); return r; }; } });
  var iv=setInterval(function(){ addBtn(); if(document.getElementById('fb-personal'))clearInterval(iv); },700);
  setTimeout(function(){ addBtn(); cargarPersonal(); },1200);
})();
