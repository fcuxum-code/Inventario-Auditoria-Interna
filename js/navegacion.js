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
  /* salir() difiere su history.back() un microtask. Muchas opciones del menú hacen
     "closeMenu();abrirX()": eso es un salir() seguido de un entrar() en el mismo turno.
     Si salir() hiciera back() (asíncrono) y entrar() hiciera pushState() (síncrono) en el
     mismo turno, las dos operaciones compiten y dejan el historial corrupto (un back
     posterior podía salirse de la app). Con el diferido, entrar() alcanza a fusionar el
     salir() pendiente en un solo replaceState: se cierra un nivel y se abre otro sin
     cambiar la profundidad del historial. Si nadie entra, el back() corre en el microtask. */
  var salidasPendientes = 0;
  /* Mientras se ejecuta el cierre de un nivel por haber retrocedido, no se debe retirar
     ningún otro: ese nivel ya salió de la pila. Sin esto, un cierre que llama a la misma
     función que usa la interfaz para volver (por ejemplo abVolver) hacía que se cerraran
     dos niveles de un solo toque de atrás. */
  var cerrandoDesdeAtras = false;

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
    if(salidasPendientes > 0){
      // Un salir() del mismo turno quedó pendiente (patrón "closeMenu();abrirX()"):
      // en vez de back()+pushState —que compiten— se reemplaza la entrada actual.
      salidasPendientes--;
      try { history.replaceState({inv:pila.length}, ""); } catch(e){}
      return;
    }
    try { history.pushState({inv:pila.length}, ""); } catch(e){}
  }

  // La interfaz cerró algo por su cuenta: se retira su entrada del historial.
  function salir(tipo){
    if(!listo || cerrandoDesdeAtras) return;
    var top = nivelActual();
    if(!top) return;
    if(tipo && top.tipo !== tipo) return; // no corresponde a este nivel, no se toca
    pila.pop();
    // Se difiere el back() (ver nota arriba): si en el mismo turno entra otro nivel,
    // entrar() lo fusiona en un replaceState y no se toca el historial físicamente.
    salidasPendientes++;
    Promise.resolve().then(function(){
      if(salidasPendientes <= 0) return;   // ya lo consumió un entrar()
      salidasPendientes--;
      ignorarPop = true;
      try { history.back(); } catch(e){ ignorarPop = false; }
    });
  }

  /* Cerrar de un golpe varios niveles seguidos (salir de las guías estando dentro de un
     procedimiento cierra el procedimiento y el listado a la vez). Se usa history.go(-n),
     que retrocede n pasos con un solo evento; llamar back() varias veces seguidas dejaría
     eventos sueltos que después cerrarían de más. */
  function salirVarios(tipos){
    if(!listo || cerrandoDesdeAtras) return;
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
      cerrandoDesdeAtras = true;
      try { nivel.cerrar(); } catch(e){}
      cerrandoDesdeAtras = false;
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

    /* Altas y bajas: tres niveles posibles — el listado, el caso abierto, y dentro de la
       herramienta de dictamen, el tipo de bien elegido. Atrás retrocede uno por uno. */
    envolver("abrirAltasBajas", null, function(){
      entrar("abajas", function(){ if(typeof abCerrar === "function") abCerrar(); });
    });
    envolver("abCerrar", function(){
      salirVarios(["abtipo", "abcaso", "abajas"]);
    });
    envolver("abAbrir", null, function(){
      var top = nivelActual();
      if(top && top.tipo === "abcaso") return;   // cambiar de caso no apila otro nivel
      entrar("abcaso", function(){ if(typeof abVolver === "function") abVolver(); });
    });
    envolver("abTipo", null, function(){
      var top = nivelActual();
      if(top && top.tipo === "abtipo") return;   // cambiar de tipo tampoco
      entrar("abtipo", function(){ if(typeof abVolver === "function") abVolver(); });
    });
    envolver("abVolver", function(){
      var top = nivelActual();
      if(top && top.tipo === "abtipo") salir("abtipo");
      else if(top && top.tipo === "abcaso") salir("abcaso");
    });

    // Tips y recomendaciones: una sola pantalla, atrás la cierra.
    envolver("abrirTips", null, function(){
      entrar("tips", function(){ if(typeof tipsCerrar === "function") tipsCerrar(); });
    });
    envolver("tipsCerrar", function(){
      var top = nivelActual();
      if(top && top.tipo === "tips") salir("tips");
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
