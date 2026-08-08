/* ================= MODO DE COLOR (claro / oscuro / automático) =================
   Agrega al menú (sección Configuración) un control para elegir el tema. La elección se
   guarda en el dispositivo. "Auto" sigue la preferencia del sistema. El atributo se aplica
   sobre <html data-theme="…">; el CSS de css/tema.css hace el resto.
   Sigue el patrón aditivo: envuelve openMenu al final, sin tocar el núcleo. */
(function(){
  "use strict";
  var KEY = "inv_ai_tema";

  function actual(){ try{ return localStorage.getItem(KEY) || "auto"; }catch(e){ return "auto"; } }
  function esOscuroEfectivo(){
    var t = document.documentElement.getAttribute("data-theme");
    if(t==="dark") return true;
    if(t==="light") return false;
    return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
  }
  function barraNavegador(){
    var meta = document.querySelector('meta[name="theme-color"]');
    if(meta) meta.setAttribute("content", esOscuroEfectivo() ? "#0f1522" : "#1F3864");
  }

  window.setTema = function(t){
    try{
      if(t==="auto"){ localStorage.removeItem(KEY); document.documentElement.removeAttribute("data-theme"); }
      else { localStorage.setItem(KEY, t); document.documentElement.setAttribute("data-theme", t); }
    }catch(e){}
    barraNavegador();
    var g = document.getElementById("temaCtl"); if(g) pintarCtl(g);
  };

  function ic(n,s){ return (typeof icon==="function") ? icon(n, s||20) : ""; }
  function pintarCtl(g){
    var a = actual();
    var opts = [["auto","Auto"],["light","Claro"],["dark","Oscuro"]];
    g.innerHTML = opts.map(function(o){
      return '<button class="temabtn'+(a===o[0]?" sel":"")+'" onclick="event.stopPropagation();setTema(\''+o[0]+'\')">'+o[1]+'</button>';
    }).join("");
  }

  function inyectar(){
    var orig = window.openMenu;
    if(typeof orig !== "function") return;
    window.openMenu = function(){
      var r = orig.apply(this, arguments);
      try{
        var sheet = document.getElementById("sheet");
        if(!sheet || document.getElementById("temaRow")) return r;
        var html = '<div class="mitem" id="temaRow" style="align-items:center">'
          + '<span class="ic">'+ic("moon",20)+'</span>'
          + '<div style="flex:1"><b>Modo de color</b><small>Claro, oscuro o automático</small></div>'
          + '<div class="temactl" id="temaCtl"></div></div>';
        // se coloca como primera opción de "Configuración" (queda en esa sección aunque el
        // menú se reordene después).
        var cfg = null, secs = sheet.querySelectorAll(".msec");
        secs.forEach(function(s){ if(/Configuraci/i.test(s.textContent)) cfg = s; });
        if(cfg){ cfg.insertAdjacentHTML("afterend", html); }
        else {
          var cuenta = null;
          secs.forEach(function(s){ if(/Cuenta/i.test(s.textContent)) cuenta = s; });
          if(cuenta) cuenta.insertAdjacentHTML("beforebegin", html); else sheet.insertAdjacentHTML("beforeend", html);
        }
        var g = document.getElementById("temaCtl"); if(g) pintarCtl(g);
      }catch(e){}
      return r;
    };
  }

  if(document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded", function(){ setTimeout(inyectar, 0); });
  } else {
    setTimeout(inyectar, 0);
  }
  barraNavegador();
  // si el usuario está en "auto", reaccionar al cambio del sistema para la barra del navegador
  if(window.matchMedia){
    try{ window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", function(){ if(actual()==="auto") barraNavegador(); }); }catch(e){}
  }
})();
