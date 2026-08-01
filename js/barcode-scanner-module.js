(function(){
  "use strict";
  /* ================= ESCÁNER DE CÓDIGO DE BIEN (cámara) =================
   * Usa la BarcodeDetector API nativa del navegador (sin dependencias externas).
   * Se engancha junto al buscador y al campo "Léalo del bien y escríbalo" de
   * Nueva toma, igual que voice-search-module.js hace con el micrófono.
   * Si el navegador no la soporta (p. ej. iOS Safari), avisa y no rompe nada:
   * el dictado por voz y la escritura manual siguen funcionando igual.
   */
  var FORMATS = ['code_128','code_39','code_93','codabar','ean_13','ean_8','itf','upc_a','upc_e','qr_code','pdf417','data_matrix'];

  function supported(){
    return typeof window.BarcodeDetector === 'function' && !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
  }
  var detector = null;
  function getDetector(){
    if(detector) return detector;
    try{ detector = new BarcodeDetector({ formats: FORMATS }); }
    catch(e){ try{ detector = new BarcodeDetector(); }catch(e2){ detector = null; } }
    return detector;
  }

  var overlay=null, video=null, statusEl=null, chainChk=null;
  var stream=null, rafId=null, running=false;
  var currentCallback=null, lastCode=null, lastCodeTs=0;

  function buildOverlay(){
    if(overlay) return overlay;
    overlay=document.createElement('div');
    overlay.id='scanOverlay';
    overlay.style.cssText='display:none;position:fixed;inset:0;z-index:300;background:#000;';

    video=document.createElement('video');
    video.id='scanVideo'; video.autoplay=true; video.playsInline=true; video.muted=true;
    video.style.cssText='position:absolute;inset:0;width:100%;height:100%;object-fit:cover;';

    var frame=document.createElement('div');
    frame.style.cssText='position:absolute;left:10%;right:10%;top:30%;bottom:36%;border:3px solid #57c95f;border-radius:16px;box-shadow:0 0 0 2000px rgba(0,0,0,.45);pointer-events:none;';

    var top=document.createElement('div');
    top.style.cssText='position:absolute;top:0;left:0;right:0;padding:14px 14px calc(14px + env(safe-area-inset-top));display:flex;align-items:center;gap:10px;background:linear-gradient(180deg,rgba(0,0,0,.65),transparent);';
    var closeBtn=document.createElement('button');
    closeBtn.type='button'; closeBtn.innerHTML=icon('x',22);
    closeBtn.style.cssText='background:rgba(255,255,255,.15);border:none;color:#fff;width:38px;height:38px;border-radius:10px;flex:none;display:flex;align-items:center;justify-content:center;';
    closeBtn.onclick=function(){ closeScanner(); };
    statusEl=document.createElement('div');
    statusEl.id='scanStatus';
    statusEl.style.cssText='flex:1;color:#fff;font-size:14px;font-weight:600;text-shadow:0 1px 3px rgba(0,0,0,.5);';
    top.appendChild(closeBtn); top.appendChild(statusEl);

    var bottom=document.createElement('div');
    bottom.style.cssText='position:absolute;left:0;right:0;bottom:0;padding:16px 16px calc(16px + env(safe-area-inset-bottom));background:linear-gradient(0deg,rgba(0,0,0,.65),transparent);';
    var chainLabel=document.createElement('label');
    chainLabel.style.cssText='display:flex;align-items:center;gap:8px;color:#fff;font-size:13.5px;font-weight:600;justify-content:center;';
    chainChk=document.createElement('input'); chainChk.type='checkbox'; chainChk.id='scanChainChk';
    chainLabel.appendChild(chainChk);
    chainLabel.appendChild(document.createTextNode('Escaneo continuo (sin tocar la pantalla entre bienes)'));
    bottom.appendChild(chainLabel);

    overlay.appendChild(video); overlay.appendChild(frame); overlay.appendChild(top); overlay.appendChild(bottom);
    document.body.appendChild(overlay);
    return overlay;
  }

  function vibrate(){ try{ if(navigator.vibrate) navigator.vibrate(60); }catch(e){} }

  var lastDetectTs=0;
  var DETECT_INTERVAL_MS=160; // ~6 veces por segundo: de sobra para leer un código quieto, sin agotar la batería
  function loop(){
    if(!running) return;
    var det=getDetector();
    var now0=Date.now();
    if(det && video && video.readyState>=2 && (now0-lastDetectTs)>=DETECT_INTERVAL_MS){
      lastDetectTs=now0;
      det.detect(video).then(function(results){
        if(!running) return;
        if(results && results.length){
          var code=(results[0].rawValue||'').trim();
          var now=Date.now();
          if(code && (code!==lastCode || (now-lastCodeTs)>2500)){
            lastCode=code; lastCodeTs=now;
            vibrate();
            if(statusEl) statusEl.textContent='✓ '+code;
            var cb=currentCallback;
            var chain=chainChk && chainChk.checked;
            if(cb) cb(code);
            if(!chain){ closeScanner(); return; }
          }
        }
        rafId=requestAnimationFrame(loop);
      }).catch(function(){ rafId=requestAnimationFrame(loop); });
    } else {
      rafId=requestAnimationFrame(loop);
    }
  }

  window.openScanner=function(onResult, opts){
    opts=opts||{};
    if(!supported()){
      if(typeof toast==='function') toast('Este navegador no permite escanear con cámara. Use Chrome en Android, o escriba/dicte el número.');
      return;
    }
    buildOverlay();
    currentCallback=onResult;
    lastCode=null; lastCodeTs=0;
    chainChk.checked=!!opts.chainDefault;
    statusEl.textContent='Apunte al código del bien…';
    overlay.style.display='block';
    navigator.mediaDevices.getUserMedia({ video:{ facingMode:{ ideal:'environment' } }, audio:false }).then(function(s){
      stream=s; video.srcObject=s;
      running=true;
      rafId=requestAnimationFrame(loop);
    }).catch(function(err){
      overlay.style.display='none';
      if(typeof toast==='function') toast('No se pudo abrir la cámara: '+(err&&err.message?err.message:'permiso denegado'));
    });
  };
  window.closeScanner=function(){
    running=false;
    if(rafId) cancelAnimationFrame(rafId);
    if(stream){ stream.getTracks().forEach(function(t){ t.stop(); }); stream=null; }
    if(overlay) overlay.style.display='none';
    currentCallback=null;
  };

  /* ---------- Botones de acceso: buscador y "Nueva toma" ---------- */
  function makeScanBtn(title){
    var b=document.createElement('button');
    b.type='button'; b.className='__scanBtn'; b.title=title||'Escanear código';
    b.innerHTML=icon('scan',19);
    b.style.cssText='flex:none;width:46px;height:46px;border:1px solid #e6eaf1;background:#fff;color:var(--azul2);border-radius:12px;cursor:pointer;box-shadow:0 1px 2px rgba(20,30,60,.05);display:flex;align-items:center;justify-content:center;';
    return b;
  }
  function fire(el){ ['input','keyup','change'].forEach(function(ev){ el.dispatchEvent(new Event(ev,{bubbles:true})); }); }

  function attachSearchScan(){
    var s=document.getElementById('search'); if(!s) return;
    if(document.getElementById('__searchScan')) return;
    var wrap=document.getElementById('__searchWrap');
    if(!wrap){
      wrap=document.createElement('div'); wrap.id='__searchWrap'; wrap.style.cssText='display:flex;gap:8px;align-items:center;';
      s.parentNode.insertBefore(wrap,s); wrap.appendChild(s); s.style.flex='1'; s.style.width='auto';
    }
    var btn=makeScanBtn('Escanear código para buscar'); btn.id='__searchScan'; wrap.appendChild(btn);
    btn.onclick=function(){
      openScanner(function(code){ s.value=code; s.focus(); fire(s); }, { chainDefault:false });
    };
  }
  function attachTomaScan(){
    var inputs=[].slice.call(document.querySelectorAll('#view input[type=text],#view input:not([type]),#sheet input[type=text],#sheet input:not([type])'));
    var target=inputs.filter(function(i){ return /léalo del bien|numero de bien|número de bien/i.test((i.placeholder||'')); })[0];
    if(!target) return;
    if(target.parentNode.querySelector('.__scanBtn')) return;
    var btn=makeScanBtn('Escanear código de bien'); btn.style.marginLeft='6px';
    var mic=target.parentNode.querySelector('.__voiceMic');
    if(mic) mic.insertAdjacentElement('afterend', btn); else target.insertAdjacentElement('afterend', btn);
    btn.onclick=function(){
      openScanner(function(code){
        target.value=code; fire(target);
        if(typeof addInv==='function') addInv();
      }, { chainDefault:true });
    };
  }
  function tick(){ try{ attachSearchScan(); attachTomaScan(); }catch(e){} }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',tick); else tick();
  var view=document.getElementById('view'); if(view){ new MutationObserver(tick).observe(view,{childList:true,subtree:true}); }
  var sheet=document.getElementById('sheet'); if(sheet){ new MutationObserver(tick).observe(sheet,{childList:true,subtree:true,attributes:true}); }
  setInterval(tick,1500);
})();
