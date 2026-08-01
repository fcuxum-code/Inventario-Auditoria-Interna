(function(){
  var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  var NUM = {cero:'0',uno:'1',una:'1',dos:'2',tres:'3',cuatro:'4',cinco:'5',seis:'6',siete:'7',ocho:'8',nueve:'9',
    diez:'10',once:'11',doce:'12',trece:'13',catorce:'14',quince:'15',dieciseis:'16',diecisiete:'17',dieciocho:'18',diecinueve:'19',veinte:'20',treinta:'30',cuarenta:'40',cincuenta:'50',sesenta:'60',setenta:'70',ochenta:'80',noventa:'90',cien:'100',mil:'1000'};
  var LET = {a:'A',be:'B',ve:'V',uve:'V',ce:'C',se:'C',de:'D',e:'E',efe:'F',ge:'G',je:'G',hache:'H',i:'I',jota:'J',ka:'K',ele:'L',eme:'M',ene:'N',o:'O',pe:'P',cu:'Q',ku:'Q',ere:'R',erre:'R',ese:'S',te:'T',u:'U',equis:'X',ye:'Y',zeta:'Z'};
  function normWord(w){ return w.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,''); }
  function convert(txt){
    if(!txt) return '';
    var raw = txt.trim();
    var compact = raw.replace(/\s+/g,'');
    if(/^[a-zA-Z0-9]{3,}$/.test(compact) && !/\s/.test(raw)) return compact.toUpperCase();
    var out='';
    raw.split(/[\s,\.\-]+/).forEach(function(w0){
      if(!w0) return;
      var w=normWord(w0);
      if(NUM[w]!==undefined){ out+=NUM[w]; return; }
      if(LET[w]!==undefined){ out+=LET[w]; return; }
      if(/^[a-z0-9]+$/.test(w)){ out+=w.toUpperCase(); return; }
      if(w.length===1 && /[a-z]/.test(w)){ out+=w.toUpperCase(); }
    });
    return out || compact.toUpperCase();
  }
  window.__voiceConvert=convert;
  function makeMic(title){
    var b=document.createElement('button');
    b.type='button'; b.className='__voiceMic'; b.title=title||'Dictar por voz'; b.textContent='\uD83C\uDF99\uFE0F';
    b.style.cssText='flex:none;width:46px;height:46px;border:1px solid #e6eaf1;background:#fff;border-radius:12px;font-size:19px;cursor:pointer;box-shadow:0 1px 2px rgba(20,30,60,.05);transition:transform .14s,background .18s;';
    return b;
  }
  function fire(el){ ['input','keyup','change'].forEach(function(ev){ el.dispatchEvent(new Event(ev,{bubbles:true})); }); }
  function listen(btn, onResult){
    if(!SR){ alert('Tu navegador no permite dictado por voz. Usa Chrome (celular o computadora).'); return; }
    var rec=new SR(); rec.lang='es-GT'; rec.interimResults=false; rec.maxAlternatives=4; rec.continuous=false;
    var old=btn.textContent; btn.textContent='\uD83D\uDD34'; btn.style.background='#fdecec';
    var reset=function(){ btn.textContent=old; btn.style.background='#fff'; };
    rec.onresult=function(e){
      var alts=e.results[0]; var best='';
      for(var i=0;i<alts.length;i++){ var c=convert(alts[i].transcript); if(c.length>best.length) best=c; }
      onResult(best, alts[0].transcript);
    };
    rec.onerror=reset; rec.onend=reset;
    try{ rec.start(); }catch(err){ reset(); }
  }
  function attachSearch(){
    var s=document.getElementById('search'); if(!s) return;
    if(document.getElementById('__searchMic')) return;
    var wrap=document.createElement('div'); wrap.id='__searchWrap'; wrap.style.cssText='display:flex;gap:8px;align-items:center;';
    s.parentNode.insertBefore(wrap,s); wrap.appendChild(s); s.style.flex='1'; s.style.width='auto';
    var mic=makeMic('Dictar No. de bien o codigo'); mic.id='__searchMic'; wrap.appendChild(mic);
    mic.onclick=function(){ listen(mic,function(v){ if(v){ s.value=v; s.focus(); fire(s); } }); };
  }
  function attachToma(){
    var inputs=[].slice.call(document.querySelectorAll('#view input[type=text],#view input:not([type]),#sheet input[type=text],#sheet input:not([type])'));
    var target=inputs.filter(function(i){ return /l\u00e9alo del bien|numero de bien|n\u00famero de bien/i.test((i.placeholder||'')); })[0];
    if(!target) return;
    if(target.parentNode.querySelector('.__voiceMic')) return;
    var mic=makeMic('Dictar No. de bien'); mic.style.marginLeft='6px';
    target.insertAdjacentElement('afterend', mic);
    mic.onclick=function(){ listen(mic,function(v){ if(v){ target.value=v; target.focus(); fire(target); } }); };
  }
  function tick(){ try{ attachSearch(); attachToma(); }catch(e){} }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',tick); else tick();
  var view=document.getElementById('view'); if(view){ new MutationObserver(tick).observe(view,{childList:true,subtree:true}); }
  var sheet=document.getElementById('sheet'); if(sheet){ new MutationObserver(tick).observe(sheet,{childList:true,subtree:true,attributes:true}); }
  setInterval(tick,1500);
})();
