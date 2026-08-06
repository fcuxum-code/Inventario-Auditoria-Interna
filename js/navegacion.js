/* ================= BOTÓN ATRÁS DEL TELÉFONO =================
   Antes, estando dentro de una ficha o con un panel abierto, el botón atrás de Android
   cerraba la app entera y había que volver a entrar. Es lo que más delata que algo "no es
   una app de verdad". Ahora atrás retrocede un paso: cierra el panel abierto, o sale de la
   ficha al listado, y solo sale de la app cuando ya se está en el inicio.

   Cómo funciona: se lleva una pila propia de "cosas que se pueden cerrar". Al entrar a un
   nivel se agrega una entrada al historial del navegador; al retroceder se ejecuta el cierre
   correspondiente. Cuando el usuario cierra algo desde la interfaz (botón Cerrar, ‹ Volver),
   también se retira esa entrada para que las dos pilas no se desincronicen.

   Se implementa envolviendo las funciones que ya existen, sin tocarlas. */
(function(){
  "use strict";

  var pila = [];          // funciones que cierran cada nivel abierto
  var ignorarPop = false; // evita procesar dos veces cuando el cierre lo inicia la interfaz
  var listo = false;

  function nivelActual(){ return pila.length ? pila[pila.length-1] : null; }

  // Registra un nivel nuevo. 'tipo' sirve para no apilar dos veces lo mismo.
  function entrar(tipo, cerrar){
    if(!listo) return;
    var top = nivelActual();
    if(top && top.tipo === tipo && tipo === "sheet"){
      // Abrir un panel encima de otro reutiliza el mismo nivel: atrás cierra una sola vez.
      top.cerrar = cerrar;
      return;
    }
    pila.push({tipo:tipo, cerrar:cerrar});
    try { history.pushState({inv:pila.length}, ""); } catch(e){}
  }

  // La interfaz cerró algo por su cuenta: se retira su entrada del historial.
  function salir(tipo){
    if(!listo) return;
    var top = nivelActual();
    if(!top) return;
    if(tipo && top.tipo !== tipo) return; // no corresponde a este nivel, no se toca
    pila.pop();
    ignorarPop = true;
    try { history.back(); } catch(e){ ignorarPop = false; }
  }

  /* Cerrar de un golpe varios niveles seguidos (salir de las guías estando dentro de un
     procedimiento cierra el procedimiento y el listado a la vez). Se usa history.go(-n),
     que retrocede n pasos con un solo evento; llamar back() varias veces seguidas dejaría
     eventos sueltos que después cerrarían de más. */
  function salirVarios(tipos){
    if(!listo) return;
    var n = 0;
    while(pila.length && tipos.indexOf(pila[pila.length-1].tipo) >= 0){ pila.pop(); n++; }
    if(!n) return;
    ignorarPop = true;
    try { history.go(-n); } catch(e){ ignorarPop = false; }
  }

  window.addEventListener("popstate", function(){
    if(ignorarPop){ ignorarPop = false; return; }
    var nivel = pila.pop();
    if(nivel && typeof nivel.cerrar === "function"){
      try { nivel.cerrar(); } catch(e){}
    }
    // Si la pila queda vacía, el siguiente "atrás" sale de la app, como se espera.
  });

  /* ---------- se envuelven las funciones existentes ---------- */
  function envolver(nombre, antes, despues){
    var orig = window[nombre];
    if(typeof orig !== "function") return;
    window[nombre] = function(){
      if(antes) { try { antes.apply(null, arguments); } catch(e){} }
      var r = orig.apply(this, arguments);
      if(despues) { try { despues.apply(null, arguments); } catch(e){} }
      return r;
    };
  }

  function iniciar(){
    if(listo) return;
    listo = true;
    try { history.replaceState({inv:0}, ""); } catch(e){}

    var sheetAbierto = false;

    // Paneles deslizables (menú, discrepancias, historial, etc.)
    envolver("showSheet", null, function(){
      sheetAbierto = true;
      entrar("sheet", function(){
        sheetAbierto = false;
        var ov = document.getElementById("overlay"), sh = document.getElementById("sheet");
        if(ov) ov.classList.remove("show");
        if(sh) sh.classList.remove("show");
      });
    });
    envolver("closeMenu", function(){
      if(sheetAbierto){ sheetAbierto = false; salir("sheet"); }
    });

    // Pantallas: entrar a una ficha o sección deja un paso atrás hacia el inicio.
    ["openPerson","openHall","openPendientes","openPersonal","newSession"].forEach(function(fn){
      envolver(fn, null, function(){
        entrar("vista", function(){ if(typeof goHome === "function") goHome(); });
      });
    });
    // Volver al inicio desde la interfaz consume ese paso.
    envolver("goHome", function(){
      var top = nivelActual();
      if(top && top.tipo === "vista") salir("vista");
    });

    // Modo rápido de verificación: atrás lo cierra en vez de salir de la app.
    envolver("abrirModoRapido", null, function(){
      entrar("modorapido", function(){
        var c = document.getElementById("mrap");
        if(c) c.remove();
        document.body.style.overflow = "";
        if(typeof render === "function") render();
      });
    });
    envolver("mrCerrar", function(){
      var top = nivelActual();
      if(top && top.tipo === "modorapido") salir("modorapido");
    });

    // Guías de AS-400 y SICOIN: dos niveles, el listado y el procedimiento abierto.
    envolver("abrirGuias", null, function(){
      entrar("guias", function(){ if(typeof guiasCerrar === "function") guiasCerrar(); });
    });
    envolver("guiasCerrar", function(){
      // si se cierra estando dentro de un procedimiento hay dos entradas que retirar
      salirVarios(["guiasproc", "guias"]);
    });
    envolver("guiasAbrirProc", null, function(){
      var top = nivelActual();
      if(top && top.tipo === "guiasproc") return;  // cambiar de procedimiento no apila otro
      entrar("guiasproc", function(){ if(typeof guiasVolver === "function") guiasVolver(); });
    });
    envolver("guiasVolver", function(){
      var top = nivelActual();
      if(top && top.tipo === "guiasproc") salir("guiasproc");
    });
  }

  /* Este archivo es el último que carga, así que las funciones que envuelve ya existen.
     No se espera al evento "load": depender de él resultó poco confiable cuando algún
     recurso externo (la tipografía) falla y el documento no termina de cargar. */
  if(document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded", function(){ setTimeout(iniciar, 0); });
  } else {
    setTimeout(iniciar, 0);
  }

  window.__navPila = function(){ return pila.map(function(x){ return x.tipo; }); };
})();
