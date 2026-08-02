/* ================= INSTALAR EN LA PANTALLA DE INICIO =================
   Antes había que saber hacerlo desde el menú del navegador. Ahora, cuando el teléfono
   ofrece instalar, aparece una opción clara dentro de la app. Al instalarla se abre en
   pantalla completa, sin la barra de direcciones, como cualquier otra aplicación.

   En Android/Chrome el navegador avisa con "beforeinstallprompt" y se puede lanzar el
   diálogo oficial. En iPhone eso no existe, así que se explican los pasos a mano. */
(function(){
  "use strict";

  var promptGuardado = null;

  function ic(n, s){ return (typeof icon === "function") ? icon(n, s || 20) : ""; }

  function esIOS(){
    return /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
  }
  function yaInstalada(){
    return window.matchMedia("(display-mode: standalone)").matches
        || window.matchMedia("(display-mode: fullscreen)").matches
        || navigator.standalone === true;
  }
  window.__estadoInstalacion = function(){
    return { instalada: yaInstalada(), sePuedeInstalar: !!promptGuardado, ios: esIOS() };
  };

  window.addEventListener("beforeinstallprompt", function(e){
    e.preventDefault();          // se guarda para lanzarlo desde el menú
    promptGuardado = e;
  });

  window.addEventListener("appinstalled", function(){
    promptGuardado = null;
    if(typeof toast === "function") toast("App instalada ✓ — búsquela en su pantalla de inicio");
  });

  window.instalarApp = function(){
    if(promptGuardado){
      var p = promptGuardado;
      promptGuardado = null;
      p.prompt();
      p.userChoice.then(function(r){
        if(r && r.outcome === "dismissed"){
          promptGuardado = p; // si la rechazó, se puede volver a ofrecer
          if(typeof toast === "function") toast("Instalación cancelada");
        }
      }).catch(function(){});
      if(typeof closeMenu === "function") closeMenu();
      return;
    }
    instruccionesManuales();
  };

  function instruccionesManuales(){
    var pasos = esIOS()
      ? '<div class="note">En iPhone o iPad se instala desde Safari:</div>'
        + '<ol class="pasosinst"><li>Toque el botón <b>Compartir</b> (el cuadro con la flecha hacia arriba), abajo en la pantalla.</li>'
        + '<li>Deslice y elija <b>Agregar a inicio</b>.</li>'
        + '<li>Confirme con <b>Agregar</b>.</li></ol>'
        + '<div class="note">Debe abrirla con Safari; desde otros navegadores iOS no aparece la opción.</div>'
      : '<div class="note">Si no aparece el aviso automático, se instala desde el menú del navegador:</div>'
        + '<ol class="pasosinst"><li>Abra el menú del navegador (los tres puntos, arriba a la derecha).</li>'
        + '<li>Elija <b>Instalar aplicación</b> o <b>Agregar a pantalla de inicio</b>.</li>'
        + '<li>Confirme.</li></ol>';
    document.getElementById("sheet").innerHTML =
      '<div class="grip"></div><h3>Instalar en la pantalla de inicio</h3>'
      + '<div class="note">Queda como una app más del teléfono: abre en pantalla completa, sin la barra '
      + 'de direcciones, y funciona aunque no haya señal.</div>'
      + pasos
      + '<button class="act o" onclick="closeMenu()">Cerrar</button>';
    if(typeof showSheet === "function") showSheet();
  }

  /* ---------- opción dentro del menú ---------- */
  function inyectarEnMenu(){
    var orig = window.openMenu;
    if(typeof orig !== "function") return;
    window.openMenu = function(){
      var r = orig.apply(this, arguments);
      try {
        if(yaInstalada()) return r;              // ya está instalada, no tiene sentido ofrecerlo
        var sheet = document.getElementById("sheet");
        if(!sheet || document.getElementById("itemInstalar")) return r;
        // se coloca antes de la sección "Cuenta", al final de las opciones
        var secciones = sheet.querySelectorAll(".msec");
        var ancla = secciones.length ? secciones[secciones.length-1] : null;
        var html = '<div class="msec">Aplicación</div>'
          + '<div class="mitem" id="itemInstalar" onclick="instalarApp()"><span class="ic">' + ic("download", 20) + '</span>'
          + '<div><b>Instalar en la pantalla de inicio</b><small>Para abrirla como app, en pantalla completa y sin señal</small></div></div>';
        if(ancla) ancla.insertAdjacentHTML("beforebegin", html);
        else sheet.insertAdjacentHTML("beforeend", html);
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
