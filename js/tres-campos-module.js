(function(){
  "use strict";
  // Módulo: 3 campos por bien -> Ubicación física (4 botones), Colaborador actual (editable), Observaciones.
  // Aditivo: usa markCampo() de la app para guardar. No borra nada.
  // El valor inicial de "Colaborador" se lee de BIENES (ya sincronizado en vivo por app.js),
  // en vez de una consulta propia a Firestore, para no duplicar lecturas ni quedar desactualizado.
  // Usa la misma lista LOCS que "Nueva toma" (definida en app.js) para que ambas
  // pantallas guarden la ubicación con el mismo nombre exacto.
  var UBIC = (typeof LOCS!=='undefined') ? LOCS : ["Oficinas Centrales","Anexo C.C. z.4","Anexo Torre Café","Archivo General"];
  var COLAB_DATALIST_ID = '__colabPersonalList';

  function fUbic(card){ return Array.prototype.slice.call(card.querySelectorAll('input')).find(function(el){ return /ubicacion/.test(el.getAttribute('onchange')||''); }); }
  function fObs(card){ return Array.prototype.slice.call(card.querySelectorAll('input')).find(function(el){ return /observaciones/.test(el.getAttribute('onchange')||''); }); }

  function refrescarDatalistPersonal(){
    var dl = document.getElementById(COLAB_DATALIST_ID);
    if(!dl){
      dl = document.createElement('datalist');
      dl.id = COLAB_DATALIST_ID;
      document.body.appendChild(dl);
    }
    var nombres = (typeof listaNombresPersonal==='function') ? listaNombresPersonal() : [];
    var actuales = Array.prototype.map.call(dl.options, function(o){ return o.value; });
    if(actuales.length===nombres.length && actuales.every(function(v,i){return v===nombres[i];})) return; // sin cambios
    dl.innerHTML = '';
    nombres.forEach(function(n){
      var opt = document.createElement('option');
      opt.value = n;
      dl.appendChild(opt);
    });
  }

  function enhance(){
    refrescarDatalistPersonal();
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
        var actual = (typeof BIENES==='object' && BIENES[id] && BIENES[id].colaborador) || '';
        inp.type='text'; inp.value = actual; inp.placeholder='Ej. Nombre del colaborador';
        inp.setAttribute('list', COLAB_DATALIST_ID);
        inp.style.cssText='width:100%;padding:8px 10px;border:1px solid #E2E6EC;border-radius:8px;font-size:14px;';
        (function(id,inp){
          inp.addEventListener('change', function(){ if(typeof markCampo==='function') markCampo(id,'colaborador', inp.value.trim()); });
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

  var mo = new MutationObserver(enhance);

  function start(){
    try { mo.observe(document.body, {childList:true, subtree:true}); } catch(e){}
    enhance();
    // Respaldo liviano por si algún cambio no dispara el MutationObserver (ya no hace red, es barato)
    setInterval(enhance, 2000);
  }

  if(document.readyState==='complete' || document.readyState==='interactive'){ setTimeout(start,900); }
  else { window.addEventListener('DOMContentLoaded', function(){ setTimeout(start,900); }); }
})();
