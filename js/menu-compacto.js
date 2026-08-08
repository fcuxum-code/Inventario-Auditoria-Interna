/* ================= MENÚ MÁS COMPACTO =================
   El menú fue creciendo hasta 7 secciones y casi dos pantallas de alto. Este archivo lo
   reacomoda para que se recorra menos, SIN tocar los otros módulos: corre después de que
   todos ellos inyectaron sus opciones (envuelve openMenu y actúa al final), y solo mueve
   nodos que ya existen —no recrea nada, así que cada opción conserva su onclick.

   Tres cambios:
   1. Sube "Procedimientos" (las guías) justo debajo de "Revisar": se consulta a diario,
      más que Configuración, que se toca una sola vez.
   2. Funde la sección "Aplicación" (una sola opción: Instalar) dentro de "Configuración",
      para quitar un encabezado suelto.
   3. El apretado del espaciado va en el CSS (.mitem y .msec).

   Debe cargar DESPUÉS de todos los módulos que agregan opciones al menú, para verlas todas. */
(function(){
  "use strict";

  // Orden en que deben quedar las secciones. Las que no estén aquí van al final, en su orden.
  var ORDEN = ["Revisar", "Procedimientos", "Reportes", "Herramientas", "Configuración", "Cuenta"];

  function compactar(){
    var sheet = document.getElementById("sheet");
    if(!sheet) return;

    // Agrupar los hijos del menú en secciones: cada encabezado .msec y todo lo que le sigue
    // hasta el próximo .msec. Lo que va antes del primer encabezado (asa, título, campo del
    // nombre) es la cabecera y no se toca.
    var hijos = [].slice.call(sheet.children);
    var cabecera = [], grupos = [], actual = null;
    hijos.forEach(function(el){
      if(el.classList && el.classList.contains("msec")){
        actual = { nom: (el.textContent || "").trim(), header: el, items: [] };
        grupos.push(actual);
      } else if(actual){
        actual.items.push(el);
      } else {
        cabecera.push(el);
      }
    });
    if(grupos.length < 2) return;   // aún no hay secciones que reacomodar

    // Fundir "Aplicación" dentro de "Configuración".
    var apl = grupos.filter(function(g){ return /Aplicaci/i.test(g.nom); })[0];
    var cfg = grupos.filter(function(g){ return /Configuraci/i.test(g.nom); })[0];
    if(apl && cfg){
      cfg.items = cfg.items.concat(apl.items);
      if(apl.header && apl.header.parentNode) apl.header.parentNode.removeChild(apl.header);
      grupos = grupos.filter(function(g){ return g !== apl; });
    }

    // Ordenar según ORDEN; lo no listado se queda al final conservando su posición relativa.
    grupos.forEach(function(g, i){ g._i = i; });
    grupos.sort(function(a, b){
      var ia = ORDEN.indexOf(a.nom), ib = ORDEN.indexOf(b.nom);
      if(ia < 0) ia = 100 + a._i;
      if(ib < 0) ib = 100 + b._i;
      return ia - ib;
    });

    // Reanexar en el orden nuevo. appendChild mueve el nodo existente (no lo duplica), así
    // que la cabecera se queda arriba y las secciones caen después, ya ordenadas.
    grupos.forEach(function(g){
      sheet.appendChild(g.header);
      g.items.forEach(function(it){ sheet.appendChild(it); });
    });
  }

  // openMenu no existe todavía cuando este archivo se lee: app.js la define al arrancar y
  // otros módulos (p. ej. instalar.js) la envuelven en DOMContentLoaded + setTimeout(0).
  // Por eso se difiere el envoltorio igual que ellos. Como este archivo se carga DESPUÉS de
  // instalar.js, su setTimeout se encola después, así que este envoltorio queda por fuera y
  // compactar() corre al final, cuando ya están todas las opciones de todos los módulos.
  function envolver(){
    var orig = window.openMenu;
    if(typeof orig !== "function") return;
    window.openMenu = function(){
      var r = orig.apply(this, arguments);   // core + todas las inyecciones de los módulos
      try { compactar(); } catch(e){}
      return r;
    };
  }

  if(document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded", function(){ setTimeout(envolver, 0); });
  } else {
    setTimeout(envolver, 0);
  }
})();
