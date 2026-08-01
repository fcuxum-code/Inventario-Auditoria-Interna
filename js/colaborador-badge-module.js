(function(){
  "use strict";
  // ==== Módulo: "Colaborador que lo tiene" (badge en cada bien) ====
  // Lee directamente de BIENES (ya sincronizado en vivo por app.js) en vez de hacer
  // su propia consulta a Firestore: así nunca queda desactualizado respecto al campo
  // editable de tres-campos-module, que escribe en el mismo BIENES[id].colaborador.

  function inject(){
    if(typeof BIENES !== 'object' || !BIENES) return;
    var cards = document.querySelectorAll('div.item[id^="it_"]');
    for(var i=0;i<cards.length;i++){
      var card = cards[i];
      var id = card.id.replace('it_','');
      var b = BIENES[id];
      var name = b && (b.colaborador||'').toString().trim();
      var existing = card.querySelector('.colab-badge');
      if(!name){ if(existing) existing.remove(); continue; }
      var texto = '👤 Colaborador que lo tiene: ' + name;
      if(existing){ if(existing.textContent!==texto) existing.textContent=texto; continue; }
      var badge = document.createElement('div');
      badge.className = 'colab-badge';
      badge.style.cssText = 'margin:6px 0;padding:6px 10px;background:#eef6ff;border:1px solid #b6d4fe;border-radius:8px;font-size:13px;color:#084298;font-weight:600;line-height:1.3;';
      badge.textContent = texto;
      var ref = card.children.length>1 ? card.children[1] : null;
      card.insertBefore(badge, ref);
    }
  }

  // Observa el DOM para reinyectar cuando se rendericen/re-rendericen fichas
  var mo = new MutationObserver(inject);

  function start(){
    try { mo.observe(document.body, {childList:true, subtree:true}); } catch(e){}
    inject();
    // Respaldo liviano por si algún cambio no dispara el MutationObserver (ya no hace red, es barato)
    setInterval(inject, 2000);
  }

  if(document.readyState==='complete' || document.readyState==='interactive'){
    setTimeout(start, 800);
  } else {
    window.addEventListener('DOMContentLoaded', function(){ setTimeout(start,800); });
  }
})();
