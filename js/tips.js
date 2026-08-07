/* ================= TIPS Y RECOMENDACIONES =================
   Apuntes cortos para hacer bien el trabajo de inventario: cómo saber que todo está
   cuadrado y cómo llenar la descripción de una tarjeta. No son procedimientos paso a paso
   (para eso están las otras guías), sino las reglas que conviene tener siempre presentes.

   El contenido lleva la cita del numeral del Manual 40/2019 que lo respalda, para que sea
   una recomendación con base y no una opinión. Los textos traen negritas a propósito, así
   que no se escapan: son constantes de este archivo, no algo que escriba el usuario. */
(function(){
  "use strict";

  var TIPS = [
    {
      id: "cuadratura", ic: "layers",
      titulo: "La regla de oro: físico = tarjeta = sistema",
      cuerpo: [
        { t:"p", txt:"Para que el inventario de un responsable esté al día, tres cifras tienen que coincidir:" },
        { t:"lista", items:[
          "Lo <b>físico</b>: los bienes que la persona realmente tiene en su puesto.",
          "Su <b>Tarjeta de Responsabilidad</b>: lo que está cargado a su nombre.",
          "El <b>Sistema</b>: lo registrado en el AS-400 y en el Módulo del SICOIN."
        ]},
        { t:"ejemplo", txt:"Si el empleado tiene <b>10</b> bienes → su tarjeta debe decir <b>10</b> → y el sistema debe decir <b>10</b>." },
        { t:"nota", txt:"Entre la <b>tarjeta</b> y el <b>sistema</b>, además de la cantidad también coincide el <b>monto</b>: la tarjeta se alimenta de lo que está en el sistema, así que el saldo (valor) de una es el mismo de la otra. El conteo físico, en cambio, es de cantidad de bienes, no de su valor." },
        { t:"aviso", txt:"Si las tres cifras no cuadran, algo quedó a medias: un bien que se movió en físico pero no se operó en el sistema, o una tarjeta sin actualizar. Ahí es donde hay que corregir antes de dar por cerrado el inventario." },
        { t:"base", items:[
          "Manual 40/2019, numeral 24: toma física anual y conciliación entre lo registrado y lo verificado físicamente.",
          "Numeral 30: el saldo de la tarjeta representa el valor total de los bienes de esa persona.",
          "Numeral 32: la suma de todas las tarjetas de la UAIAF es igual al total del inventario de la Unidad.",
          "Numeral 23: el Módulo (SICOIN) y el Sistema Auxiliar (AS-400) se revisan mensualmente para mantenerlos conciliados."
        ]}
      ]
    },
    {
      id: "descripcion", ic: "clipboardCheck",
      titulo: "Cómo llenar la Descripción en la tarjeta",
      cuerpo: [
        { t:"p", txt:"En la casilla de Descripción de cada bien, escriba en este orden:" },
        { t:"lista", items:[
          "<b>Descripción del bien</b> — qué es (por ejemplo: computadora, silla secretarial, impresora).",
          "<b>+ Marca</b> — cuando el bien la tenga.",
          "<b>+ Número de serie</b> — cuando el bien lo tenga."
        ]},
        { t:"ejemplo", txt:"COMPUTADORA PERSONAL DE ESCRITORIO, MARCA DELL, SERIE 5CG1234ABC" },
        { t:"nota", txt:"<b>“Cuando proceda”</b> quiere decir cuando el bien cuente con ese dato. Hay bienes sin marca visible o sin número de serie (una silla, por ejemplo): en esos casos se omite lo que no aplique y se deja solo la descripción." },
        { t:"aviso", txt:"Con la marca y la serie, la descripción sirve para <b>identificar el bien físicamente</b>, no solo para saber qué es. Es el mismo detalle que ya se exige al recibirlo en almacén." },
        { t:"base", items:[
          "Manual 40/2019, numeral 8: la Tarjeta de Responsabilidad debe contener como mínimo número, descripción y valor del bien.",
          "Numeral 13.1: el recibo de almacén consigna el modelo, la marca y el número de serie para los bienes que cuenten con esos datos."
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

  /* ---------- pantalla ---------- */
  function cont(){
    var c = document.getElementById("tips");
    if(!c){
      c = document.createElement("div");
      c.id = "tips";
      document.body.appendChild(c);
      document.body.style.overflow = "hidden";
    }
    return c;
  }

  window.abrirTips = function(){ pintar(); };
  window.tipsCerrar = function(){
    var c = document.getElementById("tips");
    if(c) c.remove();
    document.body.style.overflow = "";
  };
  window.tipsImprimir = function(){
    var vieja = document.getElementById("tipsPrint");
    if(vieja) vieja.remove();
    var d = document.createElement("div");
    d.id = "tipsPrint";
    d.innerHTML = htmlImpresion();
    document.body.appendChild(d);
    document.body.classList.add("imprimiendo-guias");
    window.print();
    setTimeout(function(){
      document.body.classList.remove("imprimiendo-guias");
      var x = document.getElementById("tipsPrint"); if(x) x.remove();
    }, 700);
  };

  function pintar(){
    var c = cont();
    c.innerHTML =
      '<div class="gtop">'
      + '<button class="mrx" onclick="tipsCerrar()" aria-label="Cerrar">' + ic("x", 20) + '</button>'
      + '<div class="gtoptit">Tips y recomendaciones<small>Para mantener el inventario cuadrado</small></div>'
      + '<button class="mrx" onclick="tipsImprimir()" aria-label="Imprimir">' + ic("download", 19) + '</button>'
      + '</div>'
      + '<div class="gbody">' + htmlTips() + '</div>';
  }

  function htmlTips(){
    var h = '<div class="gintro">' + ic("idea", 17, "margin-right:7px;color:var(--amar)")
      + 'Las reglas que conviene tener siempre presentes al trabajar el inventario. '
      + 'Cada una lleva el numeral del Manual que la respalda.</div>';
    h += TIPS.map(tarjetaTip).join("");
    h += '<div class="abfuentes">Base: Manual de normas para el registro y control administrativo del '
      + 'inventario general (Acuerdo 40/2019 de Gerencia). Ante cualquier duda, manda el Manual.</div>';
    return h;
  }

  function tarjetaTip(t){
    var h = '<div class="tipcard"><div class="tiphead"><span class="tipic">' + ic(t.ic, 20) + '</span>'
      + '<b>' + esca(t.titulo) + '</b></div>';
    t.cuerpo.forEach(function(s){
      if(s.t === "p"){
        h += '<p class="tiptxt">' + s.txt + '</p>';
      } else if(s.t === "lista"){
        h += '<ul class="ablista">' + s.items.map(function(x){ return '<li>' + x + '</li>'; }).join("") + '</ul>';
      } else if(s.t === "ejemplo"){
        h += '<div class="tipej"><span>Ejemplo</span>' + s.txt + '</div>';
      } else if(s.t === "nota"){
        h += '<div class="abnota">' + ic("helpCircle", 15, "margin-right:7px;flex:none;color:var(--azul2)")
          + '<span>' + s.txt + '</span></div>';
      } else if(s.t === "aviso"){
        h += '<div class="abaviso">' + ic("alertTriangle", 15, "margin-right:7px;flex:none")
          + '<span>' + s.txt + '</span></div>';
      } else if(s.t === "base"){
        h += '<div class="abbase"><b>' + ic("book", 13, "margin-right:5px") + 'Base normativa</b>'
          + s.items.map(function(x){ return '<span>' + esca(x) + '</span>'; }).join("") + '</div>';
      }
    });
    return h + '</div>';
  }

  /* ---------- versión para imprimir ---------- */
  function htmlImpresion(){
    var h = '<h1>Tips y recomendaciones de inventario</h1>'
      + '<div class="gpsub">Departamento de Auditoría Interna · Instituto Guatemalteco de Seguridad Social</div>';
    TIPS.forEach(function(t){
      h += '<h3>' + esca(t.titulo) + '</h3>';
      t.cuerpo.forEach(function(s){
        if(s.t === "p"){ h += '<p>' + s.txt + '</p>'; }
        else if(s.t === "lista"){ h += '<ul>' + s.items.map(function(x){ return '<li>' + x + '</li>'; }).join("") + '</ul>'; }
        else if(s.t === "ejemplo"){ h += '<p class="tipejp"><b>Ejemplo:</b> ' + s.txt + '</p>'; }
        else if(s.t === "nota"){ h += '<p class="gpnota">' + s.txt + '</p>'; }
        else if(s.t === "aviso"){ h += '<p class="gpnota">Atención: ' + s.txt + '</p>'; }
        else if(s.t === "base"){ h += '<p class="abpbase">' + esca(s.items.join(" · ")) + '</p>'; }
      });
    });
    return h;
  }

  /* ---------- entrada en el menú ---------- */
  function inyectarEnMenu(){
    var orig = window.openMenu;
    if(typeof orig !== "function") return;
    window.openMenu = function(){
      var r = orig.apply(this, arguments);
      try {
        var sheet = document.getElementById("sheet");
        if(!sheet || document.getElementById("itemTips")) return r;
        var html = '<div class="mitem" id="itemTips" onclick="closeMenu();abrirTips()">'
          + '<span class="ic">' + ic("idea", 20) + '</span>'
          + '<div><b>Tips y recomendaciones</b>'
          + '<small>Cómo saber que todo cuadra y cómo describir un bien en la tarjeta</small></div></div>';
        // va junto a las otras guías, en la sección "Procedimientos"
        var ancla = document.getElementById("itemAltasBajas") || document.getElementById("itemGuias");
        if(ancla) ancla.insertAdjacentHTML("afterend", html);
        else {
          var secciones = sheet.querySelectorAll(".msec");
          var s = secciones.length ? secciones[secciones.length - 1] : null;
          if(s) s.insertAdjacentHTML("beforebegin", '<div class="msec">Procedimientos</div>' + html);
          else sheet.insertAdjacentHTML("beforeend", html);
        }
      } catch(e){}
      return r;
    };
  }

  if(document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded", function(){ setTimeout(inyectarEnMenu, 0); });
  } else {
    setTimeout(inyectarEnMenu, 0);
  }
})();
