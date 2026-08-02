/* ================= SIN CONEXIÓN Y ACTUALIZACIONES =================
   1) Registra el service worker, que es lo que permite abrir la app sin señal.
   2) Muestra un aviso claro cuando no hay conexión, explicando que lo que marque
      se guarda en el teléfono y se sube solo al volver la señal.
   3) Avisa cuando hay una versión nueva publicada y ofrece actualizar. */
(function(){
  "use strict";

  /* ---------- barra de aviso ---------- */
  function barra(){
    var b = document.getElementById("avisoBar");
    if(!b){
      b = document.createElement("div");
      b.id = "avisoBar";
      document.body.appendChild(b);
    }
    return b;
  }
  function mostrarAviso(clase, html){
    var b = barra();
    b.className = clase + " show";
    b.innerHTML = html;
    // Se coloca justo encima de la barra de navegación, midiéndola, para no taparla
    // ni depender de selectores CSS que no existen en todos los teléfonos.
    var nav = document.getElementById("fabbar");
    b.style.bottom = (nav ? nav.getBoundingClientRect().height : 0) + "px";
    document.body.classList.add("con-aviso");
  }
  function ocultarAviso(){
    var b = document.getElementById("avisoBar");
    if(b){ b.className = ""; b.style.bottom = ""; }
    document.body.classList.remove("con-aviso");
  }

  /* ---------- sin conexión ---------- */
  var ic = function(n,s){ return (typeof icon==="function") ? icon(n,s||15,"margin-right:7px;flex:none") : ""; };

  function pintarEstadoRed(){
    if(navigator.onLine){
      ocultarAviso();
    } else {
      // El indicador del encabezado solo cambiaba al PERDER la señal; si la app se abría
      // ya sin conexión seguía diciendo "Sincronizado", que era falso.
      if(typeof setSync === "function") setSync("off","Sin conexión");
      mostrarAviso("av-off",
        ic("alertTriangle",16) +
        '<div><b>Sin conexión</b><small>Puede seguir trabajando: lo que marque se guarda en este teléfono y se sube solo al volver la señal.</small></div>');
    }
  }
  window.addEventListener("online", function(){
    pintarEstadoRed();
    if(typeof toast === "function") toast("Conexión restablecida — sincronizando…");
  });
  window.addEventListener("offline", pintarEstadoRed);

  /* ---------- versión nueva disponible ---------- */
  window.__aplicarActualizacion = function(){
    var b = document.getElementById("avisoBar");
    if(b) b.innerHTML = ic("refreshCw",16) + "<div><b>Actualizando…</b></div>";
    if(navigator.serviceWorker && navigator.serviceWorker.controller && window.__swEspera){
      window.__swEspera.postMessage("actualizar");
      // El evento controllerchange recarga; este respaldo cubre el caso en que no llegue.
      setTimeout(function(){ location.reload(); }, 1200);
    } else {
      location.reload();
    }
  };
  function avisarActualizacion(reg){
    window.__swEspera = reg.waiting;
    mostrarAviso("av-new",
      ic("download",16) +
      '<div><b>Hay una versión nueva</b><small>Toque aquí para actualizar la app.</small></div>');
    var b = document.getElementById("avisoBar");
    if(b) b.onclick = window.__aplicarActualizacion;
  }

  /* ---------- registro ---------- */
  if("serviceWorker" in navigator && location.protocol !== "file:"){
    window.addEventListener("load", function(){
      navigator.serviceWorker.register("sw.js").then(function(reg){
        if(reg.waiting && navigator.serviceWorker.controller) avisarActualizacion(reg);
        reg.addEventListener("updatefound", function(){
          var nuevo = reg.installing;
          if(!nuevo) return;
          nuevo.addEventListener("statechange", function(){
            // Solo se avisa si YA había una versión funcionando; en la primera
            // instalación no tiene sentido pedirle al usuario que actualice.
            if(nuevo.state === "installed" && navigator.serviceWorker.controller){
              avisarActualizacion(reg);
            }
          });
        });
      }).catch(function(e){ console.warn("service worker:", e && e.message); });

      var recargando = false;
      navigator.serviceWorker.addEventListener("controllerchange", function(){
        if(recargando) return;
        recargando = true;
        location.reload();
      });
    });
  }

  if(document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded", pintarEstadoRed);
  } else {
    pintarEstadoRed();
  }
})();
