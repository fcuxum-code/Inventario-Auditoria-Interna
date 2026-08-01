(function(){
  "use strict";
  // ==== Módulo: "Colaborador que lo tiene" (badge en cada bien) ====
  // Muestra, como campo separado y de solo lectura, el colaborador copiado desde observaciones.
  // NO modifica ni borra las observaciones: es puramente visual y aditivo.
  var COLAB = {};        // bienId -> nombre colaborador
  var loaded = false;

  function db(){ try { return firebase.firestore(); } catch(e){ return null; } }

  async function loadColab(){
    var d = db(); if(!d) return;
    try {
      var snap = await d.collection('bienes').get();
      var m = {};
      snap.forEach(function(doc){
        var c = (doc.data().colaborador||'').toString().trim();
        if(c) m[doc.id] = c;
      });
      COLAB = m; loaded = true;
      inject();
    } catch(e){ /* silencioso */ }
  }

  function inject(){
    if(!loaded) return;
    var cards = document.querySelectorAll('div.item[id^="it_"]');
    for(var i=0;i<cards.length;i++){
      var card = cards[i];
      var id = card.id.replace('it_','');
      var name = COLAB[id];
      if(!name) continue;
      if(card.querySelector('.colab-badge')) continue;
      var badge = document.createElement('div');
      badge.className = 'colab-badge';
      badge.style.cssText = 'margin:6px 0;padding:6px 10px;background:#eef6ff;border:1px solid #b6d4fe;border-radius:8px;font-size:13px;color:#084298;font-weight:600;line-height:1.3;';
      badge.textContent = '👤 Colaborador que lo tiene: ' + name;
      var ref = card.children.length>1 ? card.children[1] : null;
      card.insertBefore(badge, ref);
    }
  }

  // Observa el DOM para reinyectar cuando se rendericen/re-rendericen fichas
  var mo = new MutationObserver(function(){
    if(loaded) inject();
  });

  function start(){
    try { mo.observe(document.body, {childList:true, subtree:true}); } catch(e){}
    loadColab();
    // reintento por si firestore aún no está listo
    var tries = 0;
    var iv = setInterval(function(){
      tries++;
      if(loaded){ inject(); clearInterval(iv); return; }
      loadColab();
      if(tries>20) clearInterval(iv);
    }, 1500);
  }

  if(document.readyState==='complete' || document.readyState==='interactive'){
    setTimeout(start, 800);
  } else {
    window.addEventListener('DOMContentLoaded', function(){ setTimeout(start,800); });
  }
})();
