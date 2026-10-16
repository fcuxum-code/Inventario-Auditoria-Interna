/* ================= SINCRONIZAR CON EL REPORTE OFICIAL AS-400 =================
   Toma el reporte de bienes por tarjeta de responsabilidad extraído del AS-400 (Excel)
   como fuente oficial y, bien por bien, enlaza con la app usando la COLUMNA H (No. de
   bien según AS-400) como llave:

   - Asigna o actualiza el No. SICOIN (COLUMNA G). Si en el reporte viene vacío, se deja
     el que el bien ya tuviera.
   - Anota el responsable oficial: nombre, No. de tarjeta, No. de empleado y área.
   - Borra el historial intermedio de traslados entre personas (movimientos REASIGNACION,
     DESCARGADO, DESASIGNADO, HALLAZGO_ASIGNADO, FUSION_TARJETAS y los campos "tarjeta /
     responsable anterior" del bien). Antes de borrar se descarga un respaldo en Excel.

   NO toca el avance de la auditoría: verificación (SÍ/NO), estado, ubicación, fotos,
   observaciones, colaborador, fechas, quién verificó, ni la tarjeta en la que está el
   bien dentro de la app (que es con quién lo encontró la revisión). Tampoco toca las
   verificaciones registradas en el historial ni los movimientos de bajas y correcciones.
   Los bienes de la app que no aparecen en el reporte (ingresos recientes) quedan tal
   cual. Las filas del reporte que no están en la app solo se informan: no se crean. */
(function(){
  "use strict";

  var TIPOS_TRASLADO = { REASIGNACION:1, DESCARGADO:1, DESASIGNADO:1, HALLAZGO_ASIGNADO:1, FUSION_TARJETAS:1 };
  var COL_SICOIN = 6, COL_LLAVE = 7;   // G y H, por posición, tal como lo pide el procedimiento
  var LOTE = 400;                       // Firestore admite 500 operaciones por lote
  var _plan = null;

  function hoja(){ return document.getElementById("sheet"); }
  function quien(){
    var u = (window.firebase && firebase.auth && firebase.auth().currentUser) || null;
    return (META && META.by) || (u && u.email) || "";
  }
  function txt(r, i){ return (i==null || i<0 || !r) ? "" : String(r[i]==null?"":r[i]).trim(); }
  function letra(i){ return String.fromCharCode(65+i); }
  function plural(n, s, p){ return n+" "+(n===1?s:p); }

  /* ---------- Lectura del reporte ---------- */
  function filasDe(ws, raw){ return XLSX.utils.sheet_to_json(ws, {header:1, raw:raw, defval:""}); }
  function pareceEncabezado(r){
    var h = normTexto(txt(r, COL_LLAVE)), g = normTexto(txt(r, COL_SICOIN));
    return /AS.?400|BIEN/.test(h) || /SICOIN/.test(g);
  }
  function esReporteAS400(wb){
    try{
      return (wb.SheetNames||[]).some(function(n){
        return filasDe(wb.Sheets[n], false).slice(0,10).some(function(r){
          return /AS.?400/.test(normTexto(txt(r, COL_LLAVE))) && /SICOIN/.test(normTexto(txt(r, COL_SICOIN)));
        });
      });
    }catch(e){ return false; }
  }
  function elegirHoja(wb){
    var nombres = wb.SheetNames || [];
    var exacta = nombres.filter(function(n){ return normTexto(n).trim()==="BIENES"; })[0];
    if(exacta) return exacta;
    var conEnc = nombres.filter(function(n){ return filasDe(wb.Sheets[n], false).slice(0,10).some(pareceEncabezado); })[0];
    return conEnc || nombres[0];
  }
  function buscarCol(enc, prueba, defecto){
    for(var i=0;i<enc.length;i++){ if(prueba(normTexto(enc[i]).trim())) return i; }
    return enc.length > defecto ? defecto : -1;
  }
  function leerReporte(wb, nombreArchivo){
    var nom = elegirHoja(wb);
    var ws = wb.Sheets[nom];
    var tx = filasDe(ws, false), rw = filasDe(ws, true);
    var iEnc = -1;
    for(var i=0;i<Math.min(10, tx.length);i++){ if(pareceEncabezado(tx[i])){ iEnc = i; break; } }
    var enc = iEnc>=0 ? tx[iEnc].map(function(x){ return String(x==null?"":x); }) : [];
    var c = {
      tarjeta: buscarCol(enc, function(h){ return /TARJETA/.test(h); }, 1),
      empleado: buscarCol(enc, function(h){ return /EMPLEADO/.test(h) && !/NOMBRE/.test(h); }, 2),
      nombre: buscarCol(enc, function(h){ return /NOMBRE/.test(h); }, 3),
      area: buscarCol(enc, function(h){ return /^AREA|DEPENDENCIA|UNIDAD/.test(h); }, 4),
      desc: buscarCol(enc, function(h){ return /DESCRIP/.test(h); }, 9),
      monto: buscarCol(enc, function(h){ return /MONTO|VALOR/.test(h); }, 10),
      obs: buscarCol(enc, function(h){ return /OBSERV/.test(h); }, 13)
    };
    var filas = [], sinLlave = 0;
    for(var f=iEnc+1; f<tx.length; f++){
      var t = tx[f], r = rw[f] || [];
      if(!t || !t.some(function(x){ return String(x).trim(); })) continue;
      var llave = txt(t, COL_LLAVE);
      // Un número guardado como número se toma tal cual (sin separadores de miles del formato).
      if(typeof r[COL_LLAVE]==="number" && isFinite(r[COL_LLAVE]) && Math.floor(r[COL_LLAVE])===r[COL_LLAVE]) llave = String(r[COL_LLAVE]);
      if(!llave){ sinLlave++; continue; }
      var monto = typeof r[c.monto]==="number" ? r[c.monto] : (Number(txt(t, c.monto).replace(/[^0-9.\-]/g,""))||0);
      filas.push({ fila:f+1, llave:llave, sicoin:txt(t, COL_SICOIN), tarjeta:txt(t, c.tarjeta), empleado:txt(t, c.empleado),
        nombre:txt(t, c.nombre), area:txt(t, c.area), desc:txt(t, c.desc), monto:monto, obs:txt(t, c.obs) });
    }
    return { archivo:nombreArchivo||"", hoja:nom, hojas:(wb.SheetNames||[]).length, enc:enc, cols:c, filas:filas, sinLlave:sinLlave,
      encH: enc[COL_LLAVE]||"", encG: enc[COL_SICOIN]||"" };
  }

  /* ---------- Cruce con la app ---------- */
  function sinCeros(k){ return /^\d+$/.test(k) ? k.replace(/^0+(?=\d)/,"") : null; }
  function armarIndice(){
    var exacto = {}, alterno = {}, choques = {};
    function add(id, baja){
      exacto[id] = { id:id, baja:baja };
      var k = sinCeros(id);
      if(k!==null){ if(alterno[k] && alterno[k].id!==id) choques[k]=1; else alterno[k] = { id:id, baja:baja }; }
    }
    Object.keys(BIENES).forEach(function(id){ add(id, false); });
    Object.keys(BAJAS).forEach(function(id){ add(id, true); });
    Object.keys(choques).forEach(function(k){ delete alterno[k]; });
    return function(codigo){
      var id = bienDocId(codigo);
      if(exacto[id]) return exacto[id];
      var k = sinCeros(id);
      return (k!==null && alterno[k]) ? alterno[k] : null;
    };
  }
  function calcularPlan(rep, movs, errMovs){
    var buscar = armarIndice();
    var plan = { rep:rep, match:[], noEsta:[], duplicados:[], movs:[], errMovs:errMovs||"", soloApp:[],
      n:{ sicNuevo:0, sicCambia:0, sicIgual:0, sicVacio:0, misma:0, otra:0, sinAsig:0, baja:0, conAnterior:0, alterno:0 } };
    var usados = {};
    rep.filas.forEach(function(x){
      var hit = buscar(x.llave);
      if(!hit){ plan.noEsta.push(x); return; }
      if(usados[hit.id]){ plan.duplicados.push(x); return; }
      usados[hit.id] = 1;
      var b = BIENES[hit.id] || BAJAS[hit.id];
      var antes = b.codigoSiges || "";
      var sic = !x.sicoin ? "vacio" : !antes ? "nuevo" : norm(antes)===norm(x.sicoin) ? "igual" : "cambia";
      var simulado = Object.assign({}, b, { as400Responsable:x.nombre, as400Tarjeta:x.tarjeta });
      var pos = hit.baja ? null : mismoPoseedor(simulado);
      var m = { id:hit.id, b:b, x:x, baja:hit.baja, sic:sic, pos:pos, conAnterior: !!(b.tarjetaAnteriorNumero || b.responsableAnterior) };
      plan.match.push(m);
      if(bienDocId(x.llave)!==hit.id) plan.n.alterno++;
      plan.n[{nuevo:"sicNuevo", cambia:"sicCambia", igual:"sicIgual", vacio:"sicVacio"}[sic]]++;
      if(hit.baja) plan.n.baja++;
      else if(pos===true) plan.n.misma++;
      else if(pos===false) plan.n.otra++;
      else plan.n.sinAsig++;
      if(m.conAnterior) plan.n.conAnterior++;
    });
    // Filas sin match: ¿su SICOIN coincide con algún bien de la app que no se enlazó?
    var porSicoin = {};
    Object.values(BIENES).concat(Object.values(BAJAS)).forEach(function(b){
      if(usados[b.id]) return;
      porSicoin[norm(b.codigo)] = porSicoin[norm(b.codigo)] || b;
      if(b.codigoSiges) porSicoin[norm(b.codigoSiges)] = porSicoin[norm(b.codigoSiges)] || b;
    });
    plan.noEsta.forEach(function(x){ x.posible = (x.sicoin && porSicoin[norm(x.sicoin)]) || null; });
    plan.posibles = plan.noEsta.filter(function(x){ return x.posible; }).length;
    // Bienes de la app que no aparecen en el reporte: se dejan como están.
    Object.values(BIENES).concat(Object.values(BAJAS)).forEach(function(b){ if(!usados[b.id]) plan.soloApp.push(b); });
    // Historial intermedio de los bienes enlazados.
    (movs||[]).forEach(function(mv){
      var d = mv.data;
      if(!TIPOS_TRASLADO[d.tipoMovimiento]) return;
      var hit = buscar(d.codigo||"");
      if(hit && usados[hit.id]) plan.movs.push(mv);
    });
    plan.bienesConMovs = Object.keys(plan.movs.reduce(function(a,mv){ a[bienDocId(mv.data.codigo||"")]=1; return a; }, {})).length;
    return plan;
  }

  /* ---------- Pantallas ---------- */
  function abrirSyncAS400(){
    closeMenu();
    if(!requiereEdicion()) return;
    cargarLectorExcel().then(function(ok){
      if(!ok){ toast("No se pudo cargar el lector de Excel (revise su conexión)"); return; }
      hoja().innerHTML = '<div class="grip"></div><h3>'+icon('refreshCw',18,'margin-right:6px;vertical-align:-3px')+'Sincronizar con reporte AS-400</h3>'
        +'<div class="hint" style="margin-top:-8px">Use el Excel oficial de bienes por tarjeta de responsabilidad extraído del AS-400.</div>'
        +'<div class="syncbox"><b>Qué hace</b><ul>'
          +'<li>Enlaza cada bien por el <b>No. según AS-400 (columna H)</b>.</li>'
          +'<li>Le asigna o actualiza el <b>No. SICOIN (columna G)</b>.</li>'
          +'<li>Anota el <b>responsable oficial</b> y su <b>No. de tarjeta</b>; junto a él se ve <b>con quién está físicamente</b> según la revisión.</li>'
          +'<li>Borra el <b>historial intermedio</b> de traslados entre personas (antes descarga un respaldo).</li>'
        +'</ul></div>'
        +'<div class="syncbox ok"><b>Lo que no cambia</b><ul>'
          +'<li>El avance de la auditoría: verificación SÍ/NO, estado, ubicación, fotos, observaciones, colaborador y fechas.</li>'
          +'<li>Con quién quedó cada bien en la revisión (su tarjeta dentro de la app).</li>'
          +'<li>Los bienes nuevos que aún no salen en el AS-400: quedan tal cual.</li>'
        +'</ul></div>'
        +'<div class="hint">Primero verá una vista previa con los números. Nada se guarda hasta que lo confirme.</div>'
        +'<button class="act p" onclick="syncAS400ElegirArchivo()">'+icon('upload',16,'margin-right:6px')+'Elegir el Excel del AS-400</button>'
        +'<button class="act o" onclick="closeMenu()">Cancelar</button>';
      showSheet();
    });
  }
  function elegirArchivo(){
    var inp = document.getElementById("as400in");
    if(!inp){
      inp = document.createElement("input");
      inp.type = "file"; inp.id = "as400in"; inp.accept = ".xlsx,.xls"; inp.hidden = true;
      document.body.appendChild(inp);
      inp.addEventListener("change", function(){
        var f = inp.files && inp.files[0]; if(!f) return;
        var rd = new FileReader();
        rd.onload = function(e){
          inp.value = "";
          try{ syncDesdeLibro(XLSX.read(e.target.result, {type:"array"}), f.name); }
          catch(err){ toast("No se pudo leer el archivo: "+(err.message||err)); }
        };
        rd.readAsArrayBuffer(f);
      });
    }
    inp.click();
  }
  function syncDesdeLibro(wb, nombre){
    var rep;
    try{ rep = leerReporte(wb, nombre); }catch(err){ toast("No se pudo leer el reporte: "+(err.message||err)); return; }
    if(!rep.filas.length){ toast("El archivo no tiene filas con No. de bien en la columna H"); return; }
    hoja().innerHTML = '<div class="grip"></div><h3>Sincronizar con reporte AS-400</h3><div class="hint">Comparando '+rep.filas.length+' bienes del reporte con la app…</div>';
    showSheet();
    db.collection("movimientos").get().then(function(snap){
      var movs = snap.docs.map(function(d){ return { id:d.id, data:d.data() }; });
      _plan = calcularPlan(rep, movs, "");
      vistaPrevia();
    }).catch(function(e){
      _plan = calcularPlan(rep, [], (e && e.message) || String(e));
      vistaPrevia();
    });
  }
  function fila(num, txt1, sub, cls){
    return '<div class="syncrow '+(cls||"")+'"><span class="syncn">'+num+'</span><div>'+txt1+(sub?'<small>'+sub+'</small>':'')+'</div></div>';
  }
  function vistaPrevia(){
    var p = _plan, r = p.rep, n = p.n;
    var encOk = /AS.?400|BIEN/.test(normTexto(r.encH)) && /SICOIN/.test(normTexto(r.encG));
    var nAplicar = p.match.length;
    var h = '<div class="grip"></div><h3>Vista previa · AS-400</h3>'
      +'<div class="hint" style="margin-top:-8px">'+esc(r.archivo)+' · hoja «'+esc(r.hoja)+'» · '+plural(r.filas.length,"bien","bienes")+' en el reporte</div>'
      +'<div class="syncbox'+(encOk?'':' warn')+'">'
        +'Llave: <b>columna H</b> «'+esc(r.encH||"sin encabezado")+'» · SICOIN: <b>columna G</b> «'+esc(r.encG||"sin encabezado")+'»'
        +'<small>Responsable: «'+esc(r.enc[r.cols.nombre]||letra(r.cols.nombre))+'» · Tarjeta: «'+esc(r.enc[r.cols.tarjeta]||letra(r.cols.tarjeta))+'»'
        +(encOk?'':'<br><b>Revise:</b> los encabezados de G y H no dicen SICOIN y AS-400. Confirme que es el archivo correcto.')+'</small>'
      +'</div>'
      +'<div class="msec">Se actualizan</div>'
      +fila(nAplicar, '<b>bienes de la app encontrados</b> en el reporte', (n.alterno?plural(n.alterno,'enlazado','enlazados')+' ignorando ceros a la izquierda. ':'')+(n.baja?plural(n.baja,'está dado','están dados')+' de baja en la app: solo se anota SICOIN y responsable oficial.':''), 'ok')
      +fila(n.sicNuevo, 'reciben su No. SICOIN por primera vez')
      +fila(n.sicCambia, 'cambian de No. SICOIN', n.sicCambia?'Se reemplaza por el del reporte (el anterior queda en el respaldo).':'')
      +fila(n.sicIgual, 'ya tenían el mismo No. SICOIN')
      +fila(n.sicVacio, 'sin No. SICOIN en el reporte', n.sicVacio?'Se deja el que tengan en la app.':'')
      +'<div class="msec">Responsable oficial vs. quién lo tiene</div>'
      +fila(n.misma, 'los tiene la <b>misma persona</b> de la tarjeta oficial', '', 'ok')
      +fila(n.otra, 'los tiene <b>otra persona</b> según la revisión', n.otra?'Se marcan para que los vea con el filtro «Lo tiene otra persona».':'', n.otra?'warn':'')
      +fila(n.sinAsig, 'todavía <b>sin asignar</b> en la auditoría', n.sinAsig?'Mostrarán a quién están cargados oficialmente.':'')
      +'<div class="msec">Historial intermedio</div>'
      +(p.errMovs
        ? '<div class="syncbox warn">No se pudo leer el historial ('+esc(p.errMovs)+'). Solo se actualizarán los datos del bien.</div>'
        : fila(p.movs.length, 'movimientos de traslado entre personas', 'De '+plural(p.bienesConMovs,"bien","bienes")+'. Se conservan las verificaciones, bajas y correcciones.'+(n.conAnterior?' Además se limpia «tarjeta / responsable anterior» en '+plural(n.conAnterior,"bien","bienes")+'.':''))
          +'<label class="synccheck"><input type="checkbox" id="syncBorrarHist" checked><span>Borrar el historial intermedio (se descarga un respaldo en Excel antes de borrar)</span></label>')
      +'<div class="msec">No se tocan</div>'
      +fila(p.soloApp.length, 'bienes de la app <b>no aparecen</b> en el reporte', 'Ingresos recientes: quedan exactamente como están.')
      +fila(p.noEsta.length, 'filas del reporte <b>no están</b> en la app', p.noEsta.length?('No se crean; van en el detalle.'+(p.posibles?' '+plural(p.posibles,"coincide","coinciden")+' por No. SICOIN con un bien de la app registrado con otro número: revíselos.':'')):'', p.posibles?'warn':'')
      +(p.duplicados.length?fila(p.duplicados.length, 'filas repetidas en el reporte', 'Se tomó la primera de cada bien.', 'warn'):'')
      +(r.sinLlave?fila(r.sinLlave, 'filas sin número en la columna H', 'Se ignoran.'):'')
      +'<button class="act g" onclick="syncAS400Detalle()">'+icon('download',16,'margin-right:6px')+'Descargar el detalle en Excel (sin aplicar)</button>'
      +(nAplicar?'<button class="act p" onclick="syncAS400Aplicar()">'+icon('check',16,'margin-right:6px')+'Aplicar sincronización</button>':'')
      +'<button class="act o" onclick="closeMenu()">Cancelar</button>';
    hoja().innerHTML = h;
    showSheet();
  }

  /* ---------- Respaldo / detalle en Excel ---------- */
  function fechaTs(v){
    if(v && typeof v.toDate==="function"){ try{ return v.toDate().toISOString(); }catch(e){} }
    return v==null ? "" : v;
  }
  function jsonMov(d){
    var o = {}; Object.keys(d).forEach(function(k){ o[k] = fechaTs(d[k]); });
    return JSON.stringify(o);
  }
  function hojaDe(filas, anchos){
    var ws = XLSX.utils.aoa_to_sheet(filas);
    if(anchos) ws["!cols"] = anchos.map(function(w){ return {wch:w}; });
    return ws;
  }
  function libroDetalle(p, esRespaldo){
    var wb = XLSX.utils.book_new(), r = p.rep, n = p.n;
    var posTxt = function(m){ return m.baja ? "Dado de baja" : m.pos===true ? "SÍ" : m.pos===false ? "NO, otra persona" : "Sin asignar"; };
    XLSX.utils.book_append_sheet(wb, hojaDe([
      [esRespaldo ? "RESPALDO ANTES DE SINCRONIZAR CON AS-400" : "DETALLE DE LA SINCRONIZACIÓN CON AS-400 (vista previa, no aplicada)"],
      ["Fecha", new Date().toLocaleString("es-GT")],
      ["Usuario", quien()],
      ["Archivo", r.archivo + " · hoja " + r.hoja],
      ["Llave (columna H)", r.encH],
      ["SICOIN (columna G)", r.encG],
      [],
      ["Bienes del reporte", r.filas.length],
      ["Encontrados en la app (se actualizan)", p.match.length],
      ["SICOIN nuevo / cambia / igual / vacío", n.sicNuevo+" / "+n.sicCambia+" / "+n.sicIgual+" / "+n.sicVacio],
      ["Misma persona / otra persona / sin asignar / de baja", n.misma+" / "+n.otra+" / "+n.sinAsig+" / "+n.baja],
      ["Movimientos de traslado (historial intermedio)", p.movs.length],
      ["Filas del reporte que no están en la app", p.noEsta.length],
      ["Bienes de la app que no aparecen en el reporte (no se tocan)", p.soloApp.length]
    ], [52, 60]), "RESUMEN");

    var enc1 = ["No. bien (app)","No. AS-400 (col. H)","Descripción (app)","Valor (app)","SICOIN antes","SICOIN reporte (col. G)","Resultado SICOIN",
      "Tarjeta oficial","No. empleado","Responsable oficial","Área","Lo tiene (auditoría)","Tarjeta (auditoría)","¿Misma persona?",
      "¿Existe? (auditoría)","Estado","Tarjeta anterior (se limpia)","Responsable anterior (se limpia)"];
    var res = {nuevo:"Nuevo", cambia:"Cambia", igual:"Igual", vacio:"Vacío en reporte (se conserva)"};
    var filas1 = p.match.map(function(m){ var b=m.b, x=m.x;
      return [b.codigo||"", x.llave, b.descripcion||"", Number(b.valor)||0, b.codigoSiges||"", x.sicoin, res[m.sic],
        x.tarjeta, x.empleado, x.nombre, x.area, b.responsable||"", b.tarjetaNumero||"", posTxt(m),
        b.existe||"", b.estado||"", b.tarjetaAnteriorNumero||"", b.responsableAnterior||""]; });
    XLSX.utils.book_append_sheet(wb, hojaDe([enc1].concat(filas1), [14,14,38,11,12,14,16,10,11,30,22,30,11,16,10,10,14,28]), "SE ACTUALIZAN");

    var otras = p.match.filter(function(m){ return m.pos===false; });
    if(otras.length){
      XLSX.utils.book_append_sheet(wb, hojaDe([["No. bien","SICOIN","Descripción","Responsable oficial (AS-400)","Tarjeta oficial","Lo tiene (auditoría)","Tarjeta (auditoría)","¿Existe?"]]
        .concat(otras.map(function(m){ return [m.b.codigo||"", m.x.sicoin||m.b.codigoSiges||"", m.b.descripcion||"", m.x.nombre, m.x.tarjeta, m.b.responsable||"", m.b.tarjetaNumero||"", m.b.existe||""]; })),
        [14,12,38,30,12,30,12,10]), "OTRA PERSONA");
    }
    if(p.movs.length){
      XLSX.utils.book_append_sheet(wb, hojaDe([["Id movimiento","No. bien","Tipo","Fecha","Tarjeta anterior","Responsable anterior","Tarjeta nueva","Responsable nuevo","Estado","Ubicación","Observaciones","Registrado por","Datos completos (JSON)"]]
        .concat(p.movs.map(function(mv){ var d=mv.data;
          return [mv.id, d.codigo||"", d.tipoMovimiento||"", d.fechaTxt||fechaTs(d.fecha), d.tarjetaAnteriorNumero||"", d.responsableAnterior||"",
            d.tarjetaNuevaNumero||"", d.responsableNuevo||"", d.estado||"", d.ubicacion||"", d.observaciones||"", d.capturadoPor||"", jsonMov(d)]; })),
        [22,14,18,12,12,28,12,28,10,18,30,20,60]), esRespaldo ? "HISTORIAL BORRADO" : "HISTORIAL A BORRAR");
    }
    XLSX.utils.book_append_sheet(wb, hojaDe([["Fila Excel","No. AS-400 (col. H)","SICOIN (col. G)","Tarjeta","No. empleado","Responsable","Área","Descripción","Monto","Observación","Posible coincidencia por SICOIN en la app"]]
      .concat(p.noEsta.map(function(x){ return [x.fila, x.llave, x.sicoin, x.tarjeta, x.empleado, x.nombre, x.area, x.desc, x.monto, x.obs,
        x.posible ? ("Bien "+(x.posible.codigo||"")+(x.posible.codigoSiges?" · SICOIN "+x.posible.codigoSiges:"")+" · "+(x.posible.descripcion||"")) : ""]; })),
      [10,14,12,10,11,30,22,38,11,22,50]), "NO ESTÁN EN LA APP");
    XLSX.utils.book_append_sheet(wb, hojaDe([["No. bien","SICOIN","Descripción","Valor","Responsable (auditoría)","Tarjeta","¿Existe?","Nuevo (hallazgo)","Dado de baja"]]
      .concat(p.soloApp.map(function(b){ return [b.codigo||"", b.codigoSiges||"", b.descripcion||"", Number(b.valor)||0, b.responsable||"", b.tarjetaNumero||"", b.existe||"", b.esNuevo?"SÍ":"", b.bajaAutorizada?"SÍ":""]; })),
      [14,12,38,11,30,10,10,14,12]), "SOLO EN LA APP");
    if(p.duplicados.length){
      XLSX.utils.book_append_sheet(wb, hojaDe([["Fila Excel","No. AS-400","SICOIN","Tarjeta","Responsable","Descripción"]]
        .concat(p.duplicados.map(function(x){ return [x.fila, x.llave, x.sicoin, x.tarjeta, x.nombre, x.desc]; })), [10,14,12,10,30,38]), "REPETIDOS");
    }
    return wb;
  }
  function sello(){ var d=new Date(); return d.getFullYear()+String(d.getMonth()+1).padStart(2,"0")+String(d.getDate()).padStart(2,"0")+"_"+String(d.getHours()).padStart(2,"0")+String(d.getMinutes()).padStart(2,"0"); }
  function descargarDetalle(){
    if(!_plan) return;
    try{ XLSX.writeFile(libroDetalle(_plan, false), "Detalle_Sincronizacion_AS400_"+sello()+".xlsx"); toast("Detalle descargado ✓"); }
    catch(e){ toast("No se pudo generar el Excel: "+(e.message||e)); }
  }

  /* ---------- Aplicar ---------- */
  function progreso(t){
    var el = document.getElementById("syncProg");
    if(el) el.textContent = t;
  }
  function enLotes(ops){
    var grupos = [];
    for(var i=0;i<ops.length;i+=LOTE) grupos.push(ops.slice(i, i+LOTE));
    return grupos;
  }
  function aplicar(){
    if(!_plan || !requiereEdicion()) return;
    var p = _plan;
    var chk = document.getElementById("syncBorrarHist");
    var borrarHist = !!(chk && chk.checked && !p.errMovs);
    if(!confirm("Se actualizarán "+plural(p.match.length,"bien","bienes")+" con su No. SICOIN y responsable oficial."
      +(borrarHist?"\nSe borrarán "+plural(p.movs.length,"movimiento","movimientos")+" de traslado entre personas.":"")
      +"\n\nEl avance de la auditoría no se toca y los bienes que no están en el reporte quedan igual."
      +"\nAntes se descargará un respaldo en Excel.\n\n¿Continuar?")) return;
    // 1) Respaldo primero: si no se puede generar, no se cambia nada.
    try{ XLSX.writeFile(libroDetalle(p, true), "Respaldo_antes_de_AS400_"+sello()+".xlsx"); }
    catch(e){ toast("No se pudo generar el respaldo; no se cambió nada"); return; }

    hoja().innerHTML = '<div class="grip"></div><h3>Sincronizando con AS-400…</h3>'
      +'<div class="hint" id="syncProg">Preparando…</div>'
      +'<div class="hint">No cierre la app hasta que termine.</div>';
    showSheet();

    var FV = firebase.firestore.FieldValue;
    var hoyTxt = today(), por = quien();
    var ops = [], omitidos = 0;
    p.match.forEach(function(m){
      var b = BIENES[m.id] || BAJAS[m.id];
      if(!b){ omitidos++; return; }   // lo borraron mientras tanto: no se recrea
      var x = m.x;
      var upd = { as400Responsable:x.nombre, as400Tarjeta:x.tarjeta, as400Empleado:x.empleado, as400Area:x.area,
        as400Sync:hoyTxt, as400SyncPor:por, as400SyncTs:FV.serverTimestamp() };
      if(x.sicoin && norm(x.sicoin)!==norm(b.codigoSiges||"")) upd.codigoSiges = x.sicoin;
      if(borrarHist){
        if("tarjetaAnteriorNumero" in b) upd.tarjetaAnteriorNumero = FV.delete();
        if("responsableAnterior" in b) upd.responsableAnterior = FV.delete();
      }
      ops.push({ ref: db.collection("bienes").doc(m.id), upd: upd });
    });
    var movOps = borrarHist ? p.movs.map(function(mv){ return db.collection("movimientos").doc(mv.id); }) : [];
    var hechos = 0, borrados = 0;
    var cadena = Promise.resolve();
    enLotes(ops).forEach(function(g){
      cadena = cadena.then(function(){
        var lote = db.batch();
        g.forEach(function(o){ lote.update(o.ref, o.upd); });
        return lote.commit().then(function(){ hechos += g.length; progreso("Bienes actualizados: "+hechos+" de "+ops.length); });
      });
    });
    enLotes(movOps).forEach(function(g){
      cadena = cadena.then(function(){
        var lote = db.batch();
        g.forEach(function(ref){ lote.delete(ref); });
        return lote.commit().then(function(){ borrados += g.length; progreso("Historial intermedio borrado: "+borrados+" de "+movOps.length); });
      });
    });
    cadena.then(function(){ resultado(p, hechos, borrados, omitidos, ""); })
      .catch(function(e){ resultado(p, hechos, borrados, omitidos, (e && e.message) || String(e)); });
  }
  function resultado(p, hechos, borrados, omitidos, error){
    var otra = p.match.filter(function(m){ return m.pos===false; }).length;
    hoja().innerHTML = '<div class="grip"></div><h3>'+(error?'Sincronización incompleta':'Sincronización lista ✓')+'</h3>'
      +(error?'<div class="syncbox warn"><b>Se detuvo por un error:</b> '+esc(error)+'<small>Lo ya guardado queda bien. Puede volver a ejecutarla con el mismo archivo: no duplica nada.</small></div>':'')
      +fila(hechos, 'bienes actualizados con No. SICOIN y responsable oficial', '', 'ok')
      +fila(borrados, 'movimientos de historial intermedio borrados', borrados?'Quedaron en el Excel de respaldo que se descargó.':'')
      +fila(p.soloApp.length, 'bienes de la app sin cambios (no están en el reporte)')
      +fila(p.noEsta.length, 'filas del reporte que no están en la app (no se crearon)', p.noEsta.length?'Están en la hoja «NO ESTÁN EN LA APP» del respaldo.':'')
      +(omitidos?fila(omitidos, 'bienes omitidos porque ya no existían', '', 'warn'):'')
      +'<div class="hint">El avance de la auditoría (verificaciones, estados, ubicaciones, fotos y observaciones) quedó intacto.</div>'
      +(otra?'<button class="act p" onclick="verOtraPersonaAS400()">'+icon('alertTriangle',16,'margin-right:6px')+(otra===1?'Ver el bien que tiene otra persona':'Ver los '+otra+' bienes que tiene otra persona')+'</button>':'')
      +'<button class="act o" onclick="closeMenu()">Cerrar</button>';
    showSheet();
    if(!error) toast("Sincronización con AS-400 lista ✓");
  }

  window.abrirSyncAS400 = abrirSyncAS400;
  window.syncAS400ElegirArchivo = elegirArchivo;
  window.syncAS400DesdeLibro = syncDesdeLibro;
  window.syncAS400Detalle = descargarDetalle;
  window.syncAS400Aplicar = aplicar;
  window.esReporteAS400 = esReporteAS400;
  // Para pruebas: lectura y cruce sin tocar la base.
  window.__syncAS400 = { leerReporte:leerReporte, calcularPlan:calcularPlan, plan:function(){ return _plan; } };
})();
