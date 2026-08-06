/* ================= SERVICE WORKER =================
   Permite que la app ABRA sin internet. Sin esto, aunque Firestore tenga los datos
   guardados en el teléfono, la pantalla queda en blanco porque el HTML, el CSS y el
   JavaScript se piden a la red cada vez. Con esto la app se guarda en el dispositivo
   y arranca igual en un sótano o un archivo sin señal.

   Estrategias:
   - Navegación (el HTML): primero la red, y si no hay, lo guardado. Así una versión
     nueva se toma apenas hay señal, sin quedar pegado a una vieja.
   - Archivos propios (js, css): se sirve lo guardado al instante y en segundo plano
     se refresca, para que abra rápido pero no se quede atrás.
   - Firebase, fuentes y demás dominios: no se tocan. Firestore maneja su propio
     modo sin conexión y encolar sus peticiones aquí solo estorbaría.
   El nombre del caché lleva versión: al cambiarla se borra el anterior. */

var VERSION = "v33";
var CACHE = "inventario-ai-" + VERSION;

// Rutas relativas para que funcione sin importar la carpeta donde se publique.
var APP_SHELL = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./icons/icono-192x192.png",
  "./icons/icono-512x512.png",
  "./css/styles.css",
  "./css/ui-redesign.css",
  "./js/icons.js",
  "./js/app.js",
  "./js/personal-module.js",
  "./js/colaborador-badge-module.js",
  "./js/tres-campos-module.js",
  "./js/herramientas-module.js",
  "./js/usuarios-module.js",
  "./js/ui-redesign.js",
  "./js/voice-search-module.js",
  "./js/excel-report.js",
  "./js/modo-rapido.js",
  "./js/guias.js",
  "./js/offline.js",
  "./js/instalar.js",
  "./js/navegacion.js",
  "./js/vendor/xlsx-js-style.min.js"
];

self.addEventListener("install", function(e){
  e.waitUntil(
    caches.open(CACHE).then(function(c){
      // addAll falla entero si un archivo falla; se guardan uno por uno para que
      // un recurso faltante no impida instalar el resto.
      return Promise.all(APP_SHELL.map(function(u){
        return c.add(new Request(u, {cache:"reload"})).catch(function(){});
      }));
    }).then(function(){ return self.skipWaiting(); })
  );
});

self.addEventListener("activate", function(e){
  e.waitUntil(
    caches.keys().then(function(ks){
      return Promise.all(ks.map(function(k){
        if(k !== CACHE && k.indexOf("inventario-ai-") === 0) return caches.delete(k);
      }));
    }).then(function(){ return self.clients.claim(); })
  );
});

self.addEventListener("message", function(e){
  if(e.data === "actualizar") self.skipWaiting();
});

self.addEventListener("fetch", function(e){
  var req = e.request;
  if(req.method !== "GET") return;

  var url;
  try { url = new URL(req.url); } catch(err){ return; }

  // Solo se administran los archivos propios de la app.
  if(url.origin !== self.location.origin) return;

  // El HTML: primero la red para tomar versiones nuevas; si no hay, lo guardado.
  if(req.mode === "navigate"){
    e.respondWith(
      fetch(req).then(function(r){
        var copia = r.clone();
        caches.open(CACHE).then(function(c){ c.put("./index.html", copia); });
        return r;
      }).catch(function(){
        return caches.match("./index.html", {ignoreSearch:true})
          .then(function(r){ return r || caches.match("./", {ignoreSearch:true}); });
      })
    );
    return;
  }

  // Resto de archivos propios: lo guardado primero (ignorando el ?v=), refrescando atrás.
  e.respondWith(
    caches.match(req, {ignoreSearch:true}).then(function(guardado){
      var red = fetch(req).then(function(r){
        if(r && r.status === 200 && r.type === "basic"){
          var copia = r.clone();
          caches.open(CACHE).then(function(c){ c.put(req, copia); });
        }
        return r;
      }).catch(function(){ return guardado; });
      return guardado || red;
    })
  );
});
