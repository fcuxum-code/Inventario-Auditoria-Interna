/* ================= CÓMO SE HACE (AS-400 y SICOIN) =================
   Los pasos para operar los bienes vivían en documentos de Word que había que abrir en la
   computadora, justo cuando uno está frente a la terminal con las manos ocupadas. Aquí
   quedan dentro de la app, a pantalla completa, con las teclas resaltadas y con una casilla
   por paso para no perder el hilo a media operación.

   El contenido es transcripción literal de los procedimientos del Departamento: no se
   inventa ni se corrige ningún paso. Lo único que se agregó fue distinguir los renglones
   que describen lo que el sistema muestra (resultados) de los que son una acción a hacer,
   para que solo se marquen las acciones.

   El avance se guarda en el teléfono mientras se hace la operación y se limpia al terminar,
   porque el mismo procedimiento se repite decenas de veces y arrastrar las marcas de la vez
   anterior confundiría más de lo que ayuda. */
(function(){
  "use strict";

  var LLAVE = "inv_guias_avance_v1";

  /* Un renglón que empieza con ">" es lo que el sistema responde, no una acción del
     operador: se muestra como nota y no lleva casilla. */
  var GUIAS = [
    {
      cod: "as400",
      sis: "AS-400",
      nota: "Sistema donde se cargan y descargan los bienes de las tarjetas de responsabilidad.",
      procs: [
        { id:"as400-cargar", nom:"Cargar bienes a una tarjeta", ic:"download", pasos:[
          "Opción 2",
          "Opción 4",
          "En bienes pendientes de tarjeta seleccionar con opción 2",
          "Buscar el bien a asignar",
          "Ponerle al bien opción 1",
          "> Con la operatoria anterior se marca en blanco",
          "Con F9 asignar a qué persona, o con FX otras opciones según lo que se necesite",
          "Meter número de tarjeta y número de empleado y Enter",
          "Marcar F10",
          "Enter"
        ]},
        { id:"as400-descargar", nom:"Descargar bienes de una tarjeta", ic:"upload", pasos:[
          "Opción 4",
          "Buscar tarjeta de donde se va a descargar",
          "Marcarla con Opción 2",
          "Buscar número de bien a descargar y opción 3, que elimina de la tarjeta",
          "F10, que actualiza la operación"
        ]},
        { id:"as400-nueva", nom:"Crear tarjeta nueva", ic:"plusCircle", pasos:[
          "Opción 4",
          "Opción F6 para agregar tarjeta nueva. Colocar No. de tarjeta y número de empleado",
          "Enter",
          "Para continuar, cargar un número de bien. Esto con F8",
          "Ingresar número de bien, ya sea SICOIN o AS-400",
          "F11 despliega bienes sin asignar",
          "Marcar con 1 el bien a asignar",
          "Enter",
          "F10 guardar el cambio",
          "F12 salir",
          "F10 para guardar el número de bien asignado",
          "Enter"
        ]},
        { id:"as400-traslado", nom:"Pasar bienes de una tarjeta a otra", ic:"refreshCw", pasos:[
          "Opción 4",
          "Buscar tarjeta de donde se va a descargar el bien",
          "Marcar con 2 la tarjeta a descargársele el bien",
          "> Se despliegan los bienes",
          "Seleccionar con opción 1 el bien a trasladar",
          "Enter",
          "Marcar F9 para reasignar el bien a otra tarjeta",
          "> Se muestra tarjeta y empleado origen, y tarjeta y empleado nuevo en blanco",
          "Agregar número de tarjeta y de empleado nuevo a quien se traslada el bien",
          "Enter. Confirmará la persona y tarjeta nueva a donde va el bien",
          "Marcar F10, con esto se carga en la tarjeta nueva",
          "Enter. Finaliza la operación"
        ]},
        { id:"as400-tarjeta", nom:"Pasar una tarjeta completa a otra persona", ic:"users", pasos:[
          "Opción 4",
          "Marcar con Opción 2 la tarjeta que va a cambiar de persona",
          "Enter",
          "En la información del encabezado, colocar el número de empleado de la nueva persona a quien va a pasar la tarjeta",
          "F10 para actualizar",
          "> Aparecerá la nueva persona, con nombre, número de tarjeta y de empleado",
          "F10 para grabar",
          "Enter"
        ]},
        { id:"as400-reporte", nom:"Sacar reporte de altas y bajas del año", ic:"barChart", pasos:[
          "Opción 13, Inventarios",
          "Opción 3, Consulta Inventarios",
          "Opción 1, Consulta Movimiento",
          "Filtrar año y mes",
          "Opción 5, Detalle de bienes de alta o de baja"
        ]}
      ]
    },
    {
      cod: "sicoin",
      sis: "SICOIN",
      nota: "Registro del alta por traslado de bienes, con afectación del libro de inventarios. Las cuatro etapas van en orden: el traslado no queda solicitado hasta terminar la tercera.",
      procs: [
        { id:"sic-encabezado", nom:"1. Crear el encabezado del alta / traslado", ic:"plusCircle", pasos:[
          "Seleccionar en Inventario",
          "Seleccionar en Registros",
          "Seleccionar en Alta en traslado con afectación de libro de inventarios",
          "Seleccionar en Ejecutora 104",
          "Seleccionar en Icono Crear",
          "Desplegar listado y seleccionar número de traslado (el número de traslado de SICOIN lo proporciona el encargado de inventario de la unidad de origen)",
          "En Descripción del traslado consignar: unidad de origen - unidad de destino - número de traslado de AS-400",
          "Seleccionar en Icono Crear",
          "Seleccionar en Aceptar",
          "Verificar el número de traslado: tiene que aparecer en estado Alta Registrada"
        ]},
        { id:"sic-formar", nom:"2. Formar el traslado", ic:"layers", pasos:[
          "Seleccionar el traslado en estado Alta Registrada",
          "Seleccionar en siguiente nivel (icono flecha a la derecha)",
          "Seleccionar en icono Crear",
          "Seleccionar en Departamento de Auditoría Interna",
          "Seleccionar en Bienes a trasladar (icono flecha a la derecha)",
          "Seleccionar los bienes, los cuales deben coincidir con el Forma Cont. 04",
          "Seleccionar en Icono Crear",
          "Seleccionar en Aceptar",
          "Seleccionar en Icono Salir (icono con carpeta y flecha a la izquierda)",
          "> El número de traslado aún aparecerá en estado Alta Registrada"
        ]},
        { id:"sic-solicitar", nom:"3. Solicitar el traslado", ic:"mail", pasos:[
          "Seleccionar el número de traslado en estado Alta Registrada",
          "Seleccionar en Icono solicitar alta traslado",
          "Verificar que todo esté bien: unidad de origen - unidad de destino - número de traslado de AS-400",
          "Seleccionar en Icono solicitar alta traslado",
          "Seleccionar en Aceptar",
          "> El número de traslado ahora aparecerá en estado Alta Solicitada"
        ]},
        { id:"sic-reporte", nom:"4. Imprimir o guardar el reporte del traslado", ic:"download", pasos:[
          "Regresar al menú principal (parte superior derecha)",
          "Seleccionar en Inventarios",
          "Seleccionar en Registros",
          "Seleccionar en Reportes",
          "Seleccionar en Bajas y traslado Bienes afectos",
          "En el buscador consignar el número de traslado",
          "Continuar y descargar el documento"
        ]}
      ]
    }
  ];

  /* ---------- utilidades ---------- */
  function ic(n, s, e){ return (typeof icon === "function") ? icon(n, s || 20, e) : ""; }
  function esca(s){
    return (typeof esc === "function") ? esc(s)
      : String(s == null ? "" : s).replace(/[&<>"]/g, function(c){
          return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]; });
  }
  function esResultado(p){ return p.charAt(0) === ">"; }
  function textoPaso(p){ return esResultado(p) ? p.slice(1).trim() : p; }
  function accionesDe(proc){ return proc.pasos.filter(function(p){ return !esResultado(p); }); }

  /* Las teclas y los números de opción se resaltan como teclas de verdad: es lo que uno
     busca con la vista cuando ya hizo el procedimiento veinte veces. */
  function resaltar(txt){
    var h = esca(txt);
    h = h.replace(/\b(F\d{1,2})\b/g, '<b class="gk">$1</b>');
    h = h.replace(/\bEnter\b/g, '<b class="gk">Enter</b>');
    h = h.replace(/\b(Opci[oó]n)\s+(\d{1,2})\b/gi, '$1 <b class="gk">$2</b>');
    h = h.replace(/\bMarcar con (\d)\b/g, 'Marcar con <b class="gk">$1</b>');
    return h;
  }

  function buscarProc(id){
    for(var i=0;i<GUIAS.length;i++){
      for(var j=0;j<GUIAS[i].procs.length;j++){
        if(GUIAS[i].procs[j].id === id) return { g:GUIAS[i], p:GUIAS[i].procs[j] };
      }
    }
    return null;
  }

  /* ---------- avance guardado ---------- */
  function leerAvance(){
    try { return JSON.parse(localStorage.getItem(LLAVE) || "{}") || {}; } catch(e){ return {}; }
  }
  function guardarAvance(a){
    try { localStorage.setItem(LLAVE, JSON.stringify(a)); } catch(e){}
  }
  function marcados(id){
    var a = leerAvance();
    return Array.isArray(a[id]) ? a[id] : [];
  }
  function alternarPaso(id, i){
    var a = leerAvance(), lista = Array.isArray(a[id]) ? a[id] : [];
    var k = lista.indexOf(i);
    if(k >= 0) lista.splice(k, 1); else lista.push(i);
    a[id] = lista; guardarAvance(a);
  }
  function limpiar(id){
    var a = leerAvance(); delete a[id]; guardarAvance(a);
  }

  /* ---------- pantalla ---------- */
  var vista = { proc:null, q:"" };

  function cont(){
    var c = document.getElementById("guias");
    if(!c){
      c = document.createElement("div");
      c.id = "guias";
      document.body.appendChild(c);
      document.body.style.overflow = "hidden";
    }
    return c;
  }

  window.abrirGuias = function(procId){
    vista = { proc: procId || null, q:"" };
    pintar();
  };
  window.guiasCerrar = function(){
    var c = document.getElementById("guias");
    if(c) c.remove();
    document.body.style.overflow = "";
  };
  window.guiasAbrirProc = function(id){ vista.proc = id; pintar(); window.scrollTo(0,0); };
  window.guiasVolver = function(){ vista.proc = null; pintar(); };
  window.guiasBuscar = function(v){
    vista.q = v || "";
    var cuerpo = document.querySelector("#guias .gbody");
    if(cuerpo) cuerpo.innerHTML = htmlLista();
  };
  window.guiasPaso = function(id, i){
    alternarPaso(id, i);
    pintar();
  };
  window.guiasReiniciar = function(id){
    limpiar(id); pintar();
    if(typeof toast === "function") toast("Empezamos de nuevo");
  };
  window.guiasImprimir = function(){
    var vieja = document.getElementById("guiasPrint");
    if(vieja) vieja.remove();
    var d = document.createElement("div");
    d.id = "guiasPrint";
    d.innerHTML = htmlImpresion();
    document.body.appendChild(d);
    document.body.classList.add("imprimiendo-guias");
    window.print();
    setTimeout(function(){
      document.body.classList.remove("imprimiendo-guias");
      var x = document.getElementById("guiasPrint"); if(x) x.remove();
    }, 700);
  };

  function pintar(){
    var c = cont();
    var enProc = vista.proc ? buscarProc(vista.proc) : null;
    c.innerHTML =
      '<div class="gtop">'
      + '<button class="mrx" onclick="' + (enProc ? 'guiasVolver()' : 'guiasCerrar()') + '" aria-label="Volver">'
      + ic(enProc ? "arrowLeft" : "x", 20) + '</button>'
      + '<div class="gtoptit">' + (enProc ? esca(enProc.p.nom) : "Cómo se hace")
      + '<small>' + (enProc ? esca(enProc.g.sis) : "Pasos en AS-400 y SICOIN") + '</small></div>'
      + (enProc ? '' : '<button class="mrx" onclick="guiasImprimir()" aria-label="Imprimir">' + ic("download", 19) + '</button>')
      + '</div>'
      + '<div class="gbody">' + (enProc ? htmlProc(enProc) : htmlLista()) + '</div>';
  }

  function htmlLista(){
    var q = vista.q.trim().toLowerCase();
    var h = "";
    if(!q){
      h += '<div class="gintro">' + ic("helpCircle", 17, "margin-right:7px;color:var(--azul2)")
        + 'Los pasos tal como los usa el Departamento. Ábralos mientras opera: cada paso se '
        + 'puede ir marcando para no perder el hilo.</div>';
    }
    h += '<div class="gbuscar">' + ic("search", 17)
      + '<input type="search" placeholder="Buscar un paso o un procedimiento" value="' + esca(vista.q) + '" '
      + 'oninput="guiasBuscar(this.value)">'
      + '</div>';

    var hubo = false;
    GUIAS.forEach(function(g){
      var procs = g.procs.filter(function(p){
        if(!q) return true;
        if(p.nom.toLowerCase().indexOf(q) >= 0) return true;
        return p.pasos.some(function(x){ return textoPaso(x).toLowerCase().indexOf(q) >= 0; });
      });
      if(!procs.length) return;
      hubo = true;
      h += '<div class="gsis gsis-' + g.cod + '">'
        + '<div class="gsisnom">' + esca(g.sis) + '</div>'
        + (q ? '' : '<div class="gsisnota">' + esca(g.nota) + '</div>')
        + '</div>';
      h += procs.map(function(p){
        var acc = accionesDe(p).length;
        var hechos = marcados(p.id).length;
        var enCurso = hechos > 0 && hechos < acc;
        var listo = acc > 0 && hechos >= acc;
        var coincide = q ? p.pasos.filter(function(x){ return textoPaso(x).toLowerCase().indexOf(q) >= 0; }) : [];
        return '<button class="gcard' + (enCurso ? ' encurso' : '') + '" onclick="guiasAbrirProc(\'' + p.id + '\')">'
          + '<span class="gcardic gcardic-' + g.cod + '">' + ic(p.ic, 20) + '</span>'
          + '<span class="gcardtxt"><b>' + esca(p.nom) + '</b>'
          + '<small>' + acc + ' paso' + (acc === 1 ? '' : 's')
          + (enCurso ? ' · va en el ' + hechos : (listo ? ' · completado' : '')) + '</small>'
          + (coincide.length ? '<em class="gmatch">' + resaltar(textoPaso(coincide[0])) + '</em>' : '')
          + '</span>'
          + '<span class="gcardch">' + (listo ? ic("check", 17) : '›') + '</span>'
          + '</button>';
      }).join("");
    });
    if(!hubo){
      h += (typeof emptyState === "function")
        ? emptyState("Sin coincidencias", "Pruebe con otra palabra, por ejemplo \"tarjeta\" o \"traslado\"")
        : '<div class="gintro">Sin coincidencias.</div>';
    }
    return h;
  }

  function htmlProc(x){
    var p = x.p;
    var acc = accionesDe(p).length;
    var hechos = marcados(p.id).filter(function(i){ return !esResultado(p.pasos[i]); }).length;
    var pct = acc ? Math.round(hechos / acc * 100) : 0;
    var listos = marcados(p.id);

    var h = '<div class="gprog"><div class="gprogtxt"><span>' + hechos + ' de ' + acc + ' pasos</span>'
      + (hechos ? '<span class="gprogre" onclick="guiasReiniciar(\'' + p.id + '\')">Empezar de nuevo</span>' : '')
      + '</div><div class="gprogbar"><i style="width:' + pct + '%"></i></div></div>';

    var n = 0;
    h += '<ol class="gpasos">';
    p.pasos.forEach(function(txt, i){
      if(esResultado(txt)){
        h += '<li class="gres">' + ic("helpCircle", 15, "margin-right:6px;flex:none")
          + '<span>' + resaltar(textoPaso(txt)) + '</span></li>';
        return;
      }
      n++;
      var ok = listos.indexOf(i) >= 0;
      h += '<li class="gpaso' + (ok ? ' ok' : '') + '" onclick="guiasPaso(\'' + p.id + '\',' + i + ')">'
        + '<span class="gnum">' + (ok ? ic("check", 15) : n) + '</span>'
        + '<span class="gtxt">' + resaltar(txt) + '</span></li>';
    });
    h += '</ol>';

    if(acc && hechos >= acc){
      h += '<div class="gfin">' + ic("check", 26) + '<b>Procedimiento terminado</b>'
        + '<small>' + esca(p.nom) + '</small>'
        + '<button class="act o" style="margin-top:12px" onclick="guiasReiniciar(\'' + p.id + '\')">Hacerlo otra vez</button>'
        + '<button class="act p" style="margin-top:8px" onclick="guiasVolver()">Ver los demás procedimientos</button>'
        + '</div>';
    } else {
      h += '<button class="act o" style="margin-top:16px" onclick="guiasVolver()">Ver los demás procedimientos</button>';
    }
    return h;
  }

  /* ---------- versión para imprimir ---------- */
  function htmlImpresion(){
    var h = '<h1>Cómo operar los bienes en AS-400 y SICOIN</h1>'
      + '<div class="gpsub">Departamento de Auditoría Interna · procedimientos de inventario</div>';
    GUIAS.forEach(function(g){
      h += '<h2>' + esca(g.sis) + '</h2><p class="gpnota">' + esca(g.nota) + '</p>';
      g.procs.forEach(function(p){
        h += '<h3>' + esca(p.nom) + '</h3><ol>';
        p.pasos.forEach(function(t){
          h += esResultado(t)
            ? '<li class="gpres">' + esca(textoPaso(t)) + '</li>'
            : '<li>' + esca(t) + '</li>';
        });
        h += '</ol>';
      });
    });
    return h;
  }

  /* ---------- entradas: menú y panel de AS-400 ---------- */
  function inyectarEnMenu(){
    var orig = window.openMenu;
    if(typeof orig !== "function") return;
    window.openMenu = function(){
      var r = orig.apply(this, arguments);
      try {
        var sheet = document.getElementById("sheet");
        if(!sheet || document.getElementById("itemGuias")) return r;
        var secciones = sheet.querySelectorAll(".msec");
        var ancla = secciones.length ? secciones[secciones.length - 1] : null;
        var html = '<div class="msec">Procedimientos</div>'
          + '<div class="mitem" id="itemGuias" onclick="closeMenu();abrirGuias()"><span class="ic">'
          + ic("book", 20) + '</span>'
          + '<div><b>Cómo se hace en AS-400 y SICOIN</b>'
          + '<small>Cargar, descargar y trasladar bienes, y registrar el traslado en SICOIN</small></div></div>';
        if(ancla) ancla.insertAdjacentHTML("beforebegin", html);
        else sheet.insertAdjacentHTML("beforeend", html);
      } catch(e){}
      return r;
    };
  }

  /* Quien abre "Carga al AS-400" es exactamente quien va a necesitar los pasos, así que
     ahí se deja el acceso directo además del menú. */
  function inyectarEnAS400(){
    var orig = window.abrirPendientesAS400;
    if(typeof orig !== "function") return;
    window.abrirPendientesAS400 = function(){
      var r = orig.apply(this, arguments);
      try {
        var sheet = document.getElementById("sheet");
        if(!sheet || sheet.querySelector("#itemGuiasAS")) return r;
        var nota = sheet.querySelector(".note");
        var html = '<button class="gatajo" id="itemGuiasAS" onclick="closeMenu();abrirGuias()">'
          + ic("book", 17) + '<span>Ver los pasos para cargar en AS-400</span><i>›</i></button>';
        if(nota) nota.insertAdjacentHTML("afterend", html);
        else sheet.insertAdjacentHTML("beforeend", html);
      } catch(e){}
      return r;
    };
  }

  function iniciar(){ inyectarEnMenu(); inyectarEnAS400(); }
  if(document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded", function(){ setTimeout(iniciar, 0); });
  } else {
    setTimeout(iniciar, 0);
  }
})();
