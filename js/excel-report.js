/* ================= REPORTE EN EXCEL CON FORMATO INSTITUCIONAL =================
   Usa xlsx-js-style (incluido en js/vendor/, no depende de un CDN externo) porque la
   versión gratuita de SheetJS que usa el resto de la app NO puede aplicar negritas,
   colores ni bordes a las celdas — se verificó y solo escribe datos sin formato.
   La librería se carga solo cuando se genera un reporte, para no hacer más pesada
   la app en el uso diario.
   Nota: esta librería tampoco puede congelar la fila de encabezado (no escribe el
   elemento <pane>), por eso se usa autofiltro, que da la misma facilidad para
   navegar hojas largas. */
(function(){
  "use strict";

  var LIB_URL = "js/vendor/xlsx-js-style.min.js";
  var _libPromise = null;

  // Carga la librería una sola vez, sin pisar el XLSX del CDN que usa la importación de Excel.
  function cargarLib(){
    if(window.XLSXStyle) return Promise.resolve(window.XLSXStyle);
    if(_libPromise) return _libPromise;
    _libPromise = new Promise(function(res, rej){
      var previo = window.XLSX;
      var s = document.createElement("script");
      s.src = LIB_URL;
      s.onload = function(){
        window.XLSXStyle = window.XLSX;
        if(previo) window.XLSX = previo; // devolver el XLSX original a la importación
        res(window.XLSXStyle);
      };
      s.onerror = function(){ _libPromise = null; rej(new Error("No se pudo cargar el generador de Excel")); };
      document.head.appendChild(s);
    });
    return _libPromise;
  }

  /* ---------- paleta y estilos ---------- */
  var AZUL = "1F3864", AZUL2 = "2F5496", GRIS = "5B6470", LINEA = "BFC7D5";
  var borde = { style:"thin", color:{rgb:LINEA} };
  var BORDES = { top:borde, bottom:borde, left:borde, right:borde };

  var S_TITULO   = { font:{bold:true, sz:13, color:{rgb:AZUL}}, alignment:{horizontal:"left", vertical:"center"} };
  var S_SUBTIT   = { font:{sz:10, color:{rgb:GRIS}}, alignment:{horizontal:"left", vertical:"center"} };
  var S_HEAD     = { font:{bold:true, sz:10.5, color:{rgb:"FFFFFF"}}, fill:{fgColor:{rgb:AZUL}},
                     alignment:{horizontal:"center", vertical:"center", wrapText:true}, border:BORDES };
  var S_CELDA    = { font:{sz:10}, alignment:{vertical:"top", wrapText:false}, border:BORDES };
  var S_ZEBRA    = { font:{sz:10}, fill:{fgColor:{rgb:"F4F6FA"}}, alignment:{vertical:"top"}, border:BORDES };
  var S_TOTAL    = { font:{bold:true, sz:10.5, color:{rgb:AZUL}}, fill:{fgColor:{rgb:"E7ECF6"}}, border:BORDES };
  var FMT_Q = '"Q"#,##0.00';
  var FMT_FECHA = "dd/mm/yyyy";

  // Colores por estado de verificación, para ubicar de un vistazo lo que está mal.
  var S_ESTADO = {
    "SÍ":         { font:{sz:10, bold:true, color:{rgb:"1E6B27"}}, fill:{fgColor:{rgb:"E4F3E5"}}, alignment:{horizontal:"center"}, border:BORDES },
    "NO":         { font:{sz:10, bold:true, color:{rgb:"9C1B25"}}, fill:{fgColor:{rgb:"FBE3E5"}}, alignment:{horizontal:"center"}, border:BORDES },
    "NO UBICADO": { font:{sz:10, bold:true, color:{rgb:"8A4A12"}}, fill:{fgColor:{rgb:"FCEBDA"}}, alignment:{horizontal:"center"}, border:BORDES }
  };

  function clonar(o){ return JSON.parse(JSON.stringify(o)); }
  function col(n){ var s=""; n++; while(n>0){ var r=(n-1)%26; s=String.fromCharCode(65+r)+s; n=(n-r-1)/26; } return s; }
  function hoyTxt(){ return (typeof today==="function") ? today() : new Date().toLocaleDateString("es-GT"); }
  function quien(){ return (typeof META==="object" && META && META.by) ? META.by : ""; }

  // Convierte "DD/MM/AAAA" a fecha real para que Excel pueda ordenar y filtrar por fecha.
  function aFecha(txt){
    var m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(String(txt||"").trim());
    if(!m) return null;
    var d = new Date(Number(m[3]), Number(m[2])-1, Number(m[1]));
    return isNaN(d.getTime()) ? null : d;
  }
  // La fecha de baja del personal se guarda como AAAA-MM-DD.
  function aFechaISO(txt){
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(txt||"").trim());
    if(!m) return null;
    var d = new Date(Number(m[1]), Number(m[2])-1, Number(m[3]));
    return isNaN(d.getTime()) ? null : d;
  }

  /* ---------- construcción de una hoja con encabezado institucional ---------- */
  /* cols: [{h:'Encabezado', w:18, tipo:'texto'|'moneda'|'entero'|'fecha'|'estado', get:function(fila){...}}] */
  function crearHoja(X, nombreReporte, cols, filas, opciones){
    opciones = opciones || {};
    var ws = {};
    var nCols = cols.length;
    var FILA_HEAD = 3; // 0-based: fila 1 título, fila 2 subtítulo, fila 3 vacía, fila 4 encabezados

    function set(r, c, v, estilo, z, tipo){
      var ref = col(c)+(r+1);
      var celda;
      if(v instanceof Date) celda = { t:"d", v:v };
      else if(typeof v === "number" && isFinite(v)) celda = { t:"n", v:v };
      else celda = { t:"s", v:(v==null?"":String(v)) };
      if(estilo) celda.s = estilo;
      if(z) celda.z = z;
      ws[ref] = celda;
    }

    // Encabezado institucional
    set(0, 0, "INSTITUTO GUATEMALTECO DE SEGURIDAD SOCIAL — AUDITORÍA INTERNA", S_TITULO);
    var sub = nombreReporte + "  ·  Generado el " + hoyTxt() + (quien() ? ("  ·  Por " + quien()) : "");
    set(1, 0, sub, S_SUBTIT);
    var merges = [
      { s:{r:0,c:0}, e:{r:0,c:Math.max(0,nCols-1)} },
      { s:{r:1,c:0}, e:{r:1,c:Math.max(0,nCols-1)} }
    ];

    // Encabezados de columna
    cols.forEach(function(c, i){ set(FILA_HEAD, i, c.h, S_HEAD); });

    // Datos
    filas.forEach(function(fila, iFila){
      var r = FILA_HEAD + 1 + iFila;
      var zebra = (iFila % 2 === 1);
      cols.forEach(function(c, i){
        var v = c.get(fila);
        var estilo, z = null;
        if(c.tipo === "moneda"){
          v = Number(v||0); z = FMT_Q;
          estilo = clonar(zebra ? S_ZEBRA : S_CELDA); estilo.alignment = {horizontal:"right"};
        } else if(c.tipo === "entero"){
          v = Number(v||0);
          estilo = clonar(zebra ? S_ZEBRA : S_CELDA); estilo.alignment = {horizontal:"center"};
        } else if(c.tipo === "fecha"){
          if(v instanceof Date) z = FMT_FECHA;
          estilo = clonar(zebra ? S_ZEBRA : S_CELDA); estilo.alignment = {horizontal:"center"};
        } else if(c.tipo === "estado"){
          estilo = S_ESTADO[v] || clonar(zebra ? S_ZEBRA : S_CELDA);
        } else {
          estilo = zebra ? S_ZEBRA : S_CELDA;
        }
        set(r, i, v, estilo, z);
      });
    });

    // Fila de totales (solo columnas de dinero y conteo)
    var filaTotal = null;
    if(opciones.totales && filas.length){
      filaTotal = FILA_HEAD + 1 + filas.length;
      cols.forEach(function(c, i){
        if(i === 0){
          set(filaTotal, i, "TOTAL ("+filas.length+")", S_TOTAL);
        } else if(c.tipo === "moneda"){
          var suma = filas.reduce(function(s, f){ return s + Number(c.get(f)||0); }, 0);
          var e = clonar(S_TOTAL); e.alignment = {horizontal:"right"};
          set(filaTotal, i, suma, e, FMT_Q);
        } else if(c.tipo === "entero"){
          var sumaN = filas.reduce(function(s, f){ return s + Number(c.get(f)||0); }, 0);
          var e2 = clonar(S_TOTAL); e2.alignment = {horizontal:"center"};
          set(filaTotal, i, sumaN, e2);
        } else {
          set(filaTotal, i, "", S_TOTAL);
        }
      });
    }

    var ultimaFila = filaTotal !== null ? filaTotal : (FILA_HEAD + Math.max(1, filas.length));
    ws["!ref"] = "A1:" + col(Math.max(0,nCols-1)) + (ultimaFila+1);
    ws["!cols"] = cols.map(function(c){ return { wch: c.w || 14 }; });
    ws["!rows"] = [{hpt:20},{hpt:15},{hpt:6},{hpt:26}];
    ws["!merges"] = merges;
    // Autofiltro sobre la fila de encabezados (sustituye a congelar la fila, que la librería no soporta)
    if(filas.length){
      ws["!autofilter"] = { ref: "A"+(FILA_HEAD+1)+":"+col(nCols-1)+(FILA_HEAD+1+filas.length) };
    }
    return ws;
  }

  /* ---------- hoja de resumen ejecutivo ---------- */
  function crearResumen(X, datos){
    var ws = {};
    var merges = [];
    var r = 0;
    function fila(txt, estilo, ancho){
      ws["A"+(r+1)] = { t:"s", v:txt==null?"":String(txt), s:estilo||S_CELDA };
      if(ancho) merges.push({ s:{r:r,c:0}, e:{r:r,c:ancho} });
      r++;
    }
    function par(etiqueta, valor, tipo){
      ws["A"+(r+1)] = { t:"s", v:etiqueta, s:{ font:{sz:10, color:{rgb:GRIS}}, border:BORDES } };
      var celda;
      if(tipo === "moneda") celda = { t:"n", v:Number(valor||0), z:FMT_Q, s:{ font:{bold:true, sz:11, color:{rgb:AZUL}}, alignment:{horizontal:"right"}, border:BORDES } };
      else if(typeof valor === "number") celda = { t:"n", v:valor, s:{ font:{bold:true, sz:11, color:{rgb:AZUL}}, alignment:{horizontal:"right"}, border:BORDES } };
      else celda = { t:"s", v:String(valor==null?"":valor), s:{ font:{bold:true, sz:11, color:{rgb:AZUL}}, alignment:{horizontal:"right"}, border:BORDES } };
      ws["B"+(r+1)] = celda;
      r++;
    }
    function seccion(txt){
      r++;
      ws["A"+(r+1)] = { t:"s", v:txt, s:{ font:{bold:true, sz:11, color:{rgb:"FFFFFF"}}, fill:{fgColor:{rgb:AZUL2}}, border:BORDES } };
      ws["B"+(r+1)] = { t:"s", v:"", s:{ fill:{fgColor:{rgb:AZUL2}}, border:BORDES } };
      r++;
    }

    fila("INSTITUTO GUATEMALTECO DE SEGURIDAD SOCIAL — AUDITORÍA INTERNA", S_TITULO, 1);
    fila("Reporte de inventario físico de bienes", { font:{sz:11, color:{rgb:AZUL2}} }, 1);
    fila("Generado el " + hoyTxt() + (quien() ? ("  ·  Por " + quien()) : ""), S_SUBTIT, 1);

    seccion("AVANCE DE LA TOMA DE INVENTARIO");
    par("Total de bienes registrados", datos.total);
    par("Bienes verificados", datos.verificados);
    par("Pendientes de verificar", datos.total - datos.verificados);
    par("Avance", (datos.total ? Math.round(datos.verificados/datos.total*100) : 0) + "%");

    seccion("HALLAZGOS Y DIFERENCIAS");
    par("Bienes marcados NO (no están)", datos.no);
    par("Bienes marcados NO UBICADO", datos.noUbicado);
    par("Bienes sin responsable asignado", datos.pendientesAsignar);
    par("Bienes encontrados sin tarjeta (hallazgos)", datos.hallazgos);

    seccion("VALORES");
    par("Valor total del inventario", datos.valorTotal, "moneda");
    par("Valor de los bienes con diferencia", datos.valorDiscrepancias, "moneda");

    seccion("RESPONSABLES");
    par("Tarjetas de responsabilidad activas", datos.tarjetas);
    par("Empleados registrados", datos.personalTotal);
    par("Empleados dados de baja", datos.personalBaja);

    if(datos.porUbicacion && datos.porUbicacion.length){
      seccion("AVANCE POR UBICACIÓN");
      datos.porUbicacion.forEach(function(u){
        par(u.nombre || "(sin ubicación)", u.verificados + " / " + u.total);
      });
    }
    if(datos.porCategoria && datos.porCategoria.length){
      seccion("BIENES POR CATEGORÍA");
      datos.porCategoria.forEach(function(c){ par(c.nombre, c.n); });
    }

    ws["!ref"] = "A1:B" + (r+1);
    ws["!cols"] = [{wch:42},{wch:22}];
    ws["!merges"] = merges;
    return ws;
  }

  /* ---------- reunir los datos ---------- */
  function reunirDatos(movs, personal){
    var bienes = Object.values(BIENES);
    var disc = bienes.filter(function(b){ return b.existe==="NO" || b.existe==="NO UBICADO"; });
    var porUbic = {};
    bienes.forEach(function(b){
      var u = b.ubicacion || "(sin ubicación)";
      if(!porUbic[u]) porUbic[u] = { nombre:u, total:0, verificados:0 };
      porUbic[u].total++;
      if(b.existe) porUbic[u].verificados++;
    });
    var porCat = {};
    bienes.forEach(function(b){
      var c = (typeof categoriaBien==="function") ? categoriaBien(b).nombre : "Sin clasificar";
      porCat[c] = (porCat[c]||0) + 1;
    });
    return {
      total: bienes.length,
      verificados: bienes.filter(function(b){ return b.existe; }).length,
      no: bienes.filter(function(b){ return b.existe==="NO"; }).length,
      noUbicado: bienes.filter(function(b){ return b.existe==="NO UBICADO"; }).length,
      pendientesAsignar: bienes.filter(function(b){ return !b.tarjetaId; }).length,
      hallazgos: Object.keys(HALLAZGOS).length,
      valorTotal: bienes.reduce(function(s,b){ return s+Number(b.valor||0); }, 0),
      valorDiscrepancias: disc.reduce(function(s,b){ return s+Number(b.valor||0); }, 0),
      tarjetas: (typeof tarjetasActivas==="function" ? tarjetasActivas().length : 0),
      personalTotal: personal.length,
      personalBaja: personal.filter(function(p){ return p.activo===false; }).length,
      porUbicacion: Object.values(porUbic).sort(function(a,b){ return b.total-a.total; }),
      porCategoria: Object.values(porCat).length
        ? Object.keys(porCat).map(function(k){ return {nombre:k, n:porCat[k]}; }).sort(function(a,b){ return b.n-a.n; })
        : []
    };
  }

  /* ---------- armado del libro ---------- */
  function construirLibro(X, movs, personal){
    var wb = X.utils.book_new();
    var datos = reunirDatos(movs, personal);
    var cat = function(b){ return (typeof categoriaBien==="function") ? categoriaBien(b).nombre : ""; };

    X.utils.book_append_sheet(wb, crearResumen(X, datos), "RESUMEN");

    var colsBienes = [
      { h:"No. Inventario", w:15, get:function(b){ return b.codigo||""; } },
      { h:"No. SIGES", w:13, get:function(b){ return b.codigoSiges||""; } },
      { h:"Descripción", w:44, get:function(b){ return b.descripcion||""; } },
      { h:"Categoría (estimada)", w:24, get:function(b){ return cat(b); } },
      { h:"Valor", w:13, tipo:"moneda", get:function(b){ return b.valor||0; } },
      { h:"No. Tarjeta", w:12, get:function(b){ return b.tarjetaNumero||""; } },
      { h:"Responsable", w:30, get:function(b){ return b.responsable||""; } },
      { h:"¿Existe?", w:12, tipo:"estado", get:function(b){ return b.existe||""; } },
      { h:"Estado físico", w:13, get:function(b){ return b.estado||""; } },
      { h:"Ubicación", w:22, get:function(b){ return b.ubicacion||""; } },
      { h:"Colaborador que lo tiene", w:26, get:function(b){ return b.colaborador||""; } },
      { h:"Observaciones", w:32, get:function(b){ return b.observaciones||""; } },
      { h:"Fecha verificación", w:15, tipo:"fecha", get:function(b){ return aFecha(b.fechaVerificacion) || (b.fechaVerificacion||""); } },
      { h:"Verificado por", w:20, get:function(b){ return b.verificadoPor||""; } },
      { h:"Tarjeta anterior", w:14, get:function(b){ return b.tarjetaAnteriorNumero||""; } },
      { h:"Responsable anterior", w:28, get:function(b){ return b.responsableAnterior||""; } },
      { h:"Tipo de custodia", w:16, get:function(b){ return b.tipo||""; } },
      { h:"Foto", w:34, get:function(b){ return b.fotoUrl||""; } },
      { h:"Nota / revisar", w:24, get:function(b){ return b.notaDuplicado||""; } }
    ];
    var bienesOrd = Object.values(BIENES).sort(function(a,b){
      var ra=(a.responsable||"").localeCompare(b.responsable||""); if(ra) return ra;
      return (a.codigo||"").localeCompare(b.codigo||"");
    });
    X.utils.book_append_sheet(wb, crearHoja(X, "Detalle de bienes", colsBienes, bienesOrd, {totales:true}), "BIENES");

    var disc = bienesOrd.filter(function(b){ return b.existe==="NO" || b.existe==="NO UBICADO"; });
    var colsDisc = [
      { h:"No. Inventario", w:15, get:function(b){ return b.codigo||""; } },
      { h:"Descripción", w:44, get:function(b){ return b.descripcion||""; } },
      { h:"Categoría (estimada)", w:24, get:function(b){ return cat(b); } },
      { h:"Valor", w:13, tipo:"moneda", get:function(b){ return b.valor||0; } },
      { h:"Situación", w:14, tipo:"estado", get:function(b){ return b.existe||""; } },
      { h:"No. Tarjeta", w:12, get:function(b){ return b.tarjetaNumero||""; } },
      { h:"Responsable", w:30, get:function(b){ return b.responsable||""; } },
      { h:"Ubicación", w:22, get:function(b){ return b.ubicacion||""; } },
      { h:"Observaciones", w:34, get:function(b){ return b.observaciones||""; } },
      { h:"Fecha verificación", w:15, tipo:"fecha", get:function(b){ return aFecha(b.fechaVerificacion) || (b.fechaVerificacion||""); } },
      { h:"Verificado por", w:20, get:function(b){ return b.verificadoPor||""; } }
    ];
    X.utils.book_append_sheet(wb, crearHoja(X, "Bienes con diferencia (NO / NO UBICADO)", colsDisc, disc, {totales:true}), "DISCREPANCIAS");

    var colsTarj = [
      { h:"No. Tarjeta", w:13, get:function(t){ return t.numero||"(pendiente)"; } },
      { h:"Responsable", w:32, get:function(t){ return t.responsable||""; } },
      { h:"No. Empleado", w:14, get:function(t){ return t.empleado||""; } },
      { h:"Puesto", w:24, get:function(t){ return t.puesto||""; } },
      { h:"Correo", w:28, get:function(t){ return t.correo||""; } },
      { h:"Tipo", w:16, get:function(t){ return t.tipo||""; } },
      { h:"Bienes cargados", w:15, tipo:"entero", get:function(t){ return t.__n; } },
      { h:"Verificados", w:13, tipo:"entero", get:function(t){ return t.__d; } },
      { h:"Valor asignado", w:15, tipo:"moneda", get:function(t){ return t.__q; } },
      { h:"Firma de recibido", w:16, get:function(t){ return t.firmaRecibida ? ("Sí"+(t.firmaFecha?(" · "+t.firmaFecha):"")) : "No"; } }
    ];
    var tarjs = (typeof tarjetasActivas==="function" ? tarjetasActivas() : []).map(function(t){
      var items = (typeof bienesDe==="function") ? bienesDe(t.id) : [];
      var o = Object.assign({}, t);
      o.__n = items.length;
      o.__d = items.filter(function(b){ return b.existe; }).length;
      o.__q = items.reduce(function(s,b){ return s+Number(b.valor||0); }, 0);
      return o;
    });
    X.utils.book_append_sheet(wb, crearHoja(X, "Tarjetas de responsabilidad", colsTarj, tarjs, {totales:true}), "TARJETAS");

    var colsPers = [
      { h:"No. Empleado", w:14, get:function(p){ return p.noEmpleado||""; } },
      { h:"Nombre", w:34, get:function(p){ return p.nombre||""; } },
      { h:"Renglón", w:10, get:function(p){ return p.renglon||""; } },
      { h:"Cargo nominal", w:28, get:function(p){ return p.cargo||""; } },
      { h:"DPI", w:16, get:function(p){ return p.dpi||""; } },
      { h:"Correo", w:28, get:function(p){ return p.correo||""; } },
      { h:"Situación", w:12, get:function(p){ return p.activo===false ? "Baja" : "Activo"; } },
      { h:"Fecha de baja", w:14, tipo:"fecha", get:function(p){ return aFechaISO(p.fechaBaja) || ""; } }
    ];
    var pers = personal.slice().sort(function(a,b){ return (a.nombre||"").localeCompare(b.nombre||""); });
    X.utils.book_append_sheet(wb, crearHoja(X, "Personal", colsPers, pers), "PERSONAL");

    var colsMov = [
      { h:"Fecha", w:13, tipo:"fecha", get:function(m){ return aFecha(m.fechaTxt) || (m.fechaTxt||""); } },
      { h:"No. Inventario", w:15, get:function(m){ return m.codigo||""; } },
      { h:"Movimiento", w:30, get:function(m){ return (typeof TIPO_MOV_TXT==="object" && TIPO_MOV_TXT[m.tipoMovimiento]) || m.tipoMovimiento || ""; } },
      { h:"Tarjeta anterior", w:14, get:function(m){ return m.tarjetaAnteriorNumero||""; } },
      { h:"Responsable anterior", w:28, get:function(m){ return m.responsableAnterior||""; } },
      { h:"Tarjeta nueva", w:14, get:function(m){ return m.tarjetaNuevaNumero||""; } },
      { h:"Responsable nuevo", w:28, get:function(m){ return m.responsableNuevo||m.responsable||""; } },
      { h:"¿Existe?", w:12, tipo:"estado", get:function(m){ return m.existe||""; } },
      { h:"Estado", w:12, get:function(m){ return m.estado||""; } },
      { h:"Ubicación", w:22, get:function(m){ return m.ubicacion||""; } },
      { h:"Observaciones", w:34, get:function(m){ return m.observaciones||""; } },
      { h:"Registrado por", w:20, get:function(m){ return m.capturadoPor||""; } }
    ];
    var movsOrd = movs.slice().sort(function(a,b){
      var ta=(a.fecha&&a.fecha.toMillis)?a.fecha.toMillis():0;
      var tb=(b.fecha&&b.fecha.toMillis)?b.fecha.toMillis():0;
      return tb-ta;
    });
    X.utils.book_append_sheet(wb, crearHoja(X, "Historial de movimientos", colsMov, movsOrd), "MOVIMIENTOS");

    var colsHz = [
      { h:"No. Inventario", w:15, get:function(z){ return z.inv||"S/N"; } },
      { h:"Cantidad", w:10, tipo:"entero", get:function(z){ return z.cant||1; } },
      { h:"Descripción", w:44, get:function(z){ return z.desc||""; } },
      { h:"Con quién / dónde", w:30, get:function(z){ return z.resp||""; } },
      { h:"Ubicación", w:22, get:function(z){ return z.ubi||""; } },
      { h:"Estado", w:12, get:function(z){ return z.est||""; } },
      { h:"Observaciones", w:34, get:function(z){ return z.obs||""; } },
      { h:"Fecha", w:13, tipo:"fecha", get:function(z){ return aFecha(z.f) || (z.f||""); } },
      { h:"Anotado por", w:20, get:function(z){ return z.by||""; } }
    ];
    X.utils.book_append_sheet(wb, crearHoja(X, "Bienes encontrados sin tarjeta", colsHz, Object.values(HALLAZGOS), {totales:true}), "HALLAZGOS");

    return wb;
  }

  // Expuesto para poder probar el armado del libro fuera del navegador.
  window.__construirLibroExcel = construirLibro;

  /* ---------- flujo de la app ---------- */
  window.generarExcel = function(){
    closeMenu();
    toast("Preparando el reporte…");
    var X = null, wb = null, filename = "";
    cargarLib().then(function(lib){
      X = lib;
      return Promise.all([
        db.collection("movimientos").get(),
        db.collection("personal").get().catch(function(){ return null; })
      ]);
    }).then(function(res){
      var movs = res[0].docs.map(function(d){ return d.data(); });
      var personal = res[1] ? res[1].docs.map(function(d){ return d.data(); }) : [];
      wb = construirLibro(X, movs, personal);
      filename = "Inventario_AI_" + new Date().toISOString().slice(0,10) + ".xlsx";
      X.writeFile(wb, filename, { cellDates:true });
      toast("Reporte generado ✓ (revise Descargas)");
      setTimeout(function(){ ofrecerEnvio(X, wb, filename); }, 500);
    }).catch(function(e){
      toast("No se pudo generar el reporte: " + (e.message||e));
    });
  };

  function ofrecerEnvio(X, wb, filename){
    pedirTexto("Enviar reporte por correo", "Escriba el correo, o cancele para omitir", "", "email", function(correo){
      if(!correo || !correo.trim()) return;
      if(!META.gsUrl){ toast("Falta configurar Apps Script para enviar correos (menú ☰)"); return; }
      toast("Verificando versión…");
      verificarVersionGS().then(function(r){
        if(!r.ok){
          if(r.motivo==="desactualizado") avisoGSDesactualizado();
          else toast("⚠️ No se pudo conectar con Apps Script.");
          return;
        }
        toast("Enviando reporte por correo…");
        var b64 = X.write(wb, { type:"base64", bookType:"xlsx", cellDates:true });
        fetch(META.gsUrl, { method:"POST", body: JSON.stringify({
          type:"correoExcel", correo: correo.trim(), filename: filename,
          asunto: "Reporte de Inventario Físico - Auditoría Interna",
          cuerpo: "Se adjunta el reporte de inventario físico generado el " + hoyTxt() + " desde la app."
            + (quien() ? ("\n\nGenerado por: " + quien()) : ""),
          b64: b64
        })})
          .then(function(r2){ return r2.json().catch(function(){ return null; }); })
          .then(function(j){
            if(j && j.ok===false) toast("⚠️ No se pudo enviar: " + (j.error||"error desconocido"));
            else toast("✉️ Reporte enviado a " + correo.trim());
          })
          .catch(function(){ toast("⚠️ No se pudo enviar el correo (revise conexión)"); });
      });
    });
  }
})();
