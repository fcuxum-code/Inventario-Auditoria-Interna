(function(){
  "use strict";
  // Módulo: 3 campos por bien -> Ubicación física (4 botones), Colaborador actual (editable), Observaciones.
  // Aditivo: usa markCampo() de la app para guardar. No borra nada.
  var UBIC = ["Oficinas Centrales","Anexo C.C. z.4","Anexo Torre Café","Archivo General"];
  var COLAB = {};
  var loaded = false;

  function db(){ try { return firebase.firestore(); } catch(e){ return null; } }

  async function loadColab(){
    var d = db(); if(!d) return;
    try {
      var snap = await d.collection('bienes').get();
      var m = {};
      snap.forEach(function(doc){ var c=(doc.data().colaborador||'').toString().trim(); if(c) m[doc.id]=c; });
      COLAB = m; loaded = true;
    } catch(e){}
  }

  function fUbic(card){ return Array.prototype.slice.call(card.querySelectorAll('input')).find(function(el){ return /ubicacion/.test(el.getAttribute('onchange')||''); }); }
  function fObs(card){ return Array.prototype.slice.call(card.querySelectorAll('input')).find(function(el){ return /observaciones/.test(el.getAttribute('onchange')||''); }); }

  function enhance(){
    var cards = document.querySelectorAll('div.item[id^="it_"]');
    for(var k=0;k<cards.length;k++){
      var card = cards[k];
      var id = card.id.replace('it_','');
      var ubic = fUbic(card);
      if(!ubic) continue; // sección extra cerrada

      // (1) botones de ubicación
      if(!card.querySelector('.ubic-quick')){
        var wrap = document.createElement('div');
        wrap.className = 'ubic-quick';
        wrap.style.cssText = 'display:flex;flex-wrap:wrap;gap:6px;margin:4px 0 6px;';
        (function(ubic){
          UBIC.forEach(function(opt){
            var b = document.createElement('button');
            b.type='button'; b.textContent=opt;
            b.style.cssText='padding:6px 10px;border:1px solid #b6d4fe;border-radius:8px;background:#eef6ff;color:#084298;font-size:12px;font-weight:600;cursor:pointer;';
            b.addEventListener('click', function(){
              ubic.value = opt;
              if(typeof markCampo==='function') markCampo(id,'ubicacion',opt);
              var kids = wrap.children;
              for(var j=0;j<kids.length;j++){ kids[j].style.background='#eef6ff'; kids[j].style.color='#084298'; }
              b.style.background='#084298'; b.style.color='#fff';
            });
            if((ubic.value||'').trim()===opt){ b.style.background='#084298'; b.style.color='#fff'; }
            wrap.appendChild(b);
          });
        })(ubic);
        ubic.parentNode.insertBefore(wrap, ubic);
      }

      // (2) campo Colaborador actual (editable)
      if(!card.querySelector('.colab-field')){
        var obs = fObs(card);
        var box = document.createElement('div');
        box.className='colab-field'; box.style.cssText='margin:6px 0;';
        var lbl = document.createElement('div');
        lbl.textContent='Colaborador actual (el que lo tiene)';
        lbl.style.cssText='font-size:12px;color:#586470;margin-bottom:2px;';
        var inp = document.createElement('input');
        inp.type='text'; inp.value = COLAB[id]||''; inp.placeholder='Ej. Nombre del colaborador';
        inp.style.cssText='width:100%;padding:8px 10px;border:1px solid #E2E6EC;border-radius:8px;font-size:14px;';
        (function(id,inp){
          inp.addEventListener('change', function(){ if(typeof markCampo==='function') markCampo(id,'colaborador', inp.value.trim()); COLAB[id]=inp.value.trim(); });
        })(id,inp);
        box.appendChild(lbl); box.appendChild(inp);
        if(obs){
          var obsLabel = (obs.previousElementSibling && /observ/i.test(obs.previousElementSibling.textContent||'')) ? obs.previousElementSibling : obs;
          obs.parentNode.insertBefore(box, obsLabel);
        } else {
          ubic.parentNode.appendChild(box);
        }
      }
    }
  }

  var mo = new MutationObserver(function(){ if(loaded) enhance(); });

  async function start(){
    await loadColab();
    try { mo.observe(document.body, {childList:true, subtree:true}); } catch(e){}
    enhance();
    var tries=0;
    var iv=setInterval(function(){ tries++; if(!loaded){ loadColab(); } enhance(); if(tries>20) clearInterval(iv); }, 1500);
  }

  if(document.readyState==='complete' || document.readyState==='interactive'){ setTimeout(start,900); }
  else { window.addEventListener('DOMContentLoaded', function(){ setTimeout(start,900); }); }
})();
