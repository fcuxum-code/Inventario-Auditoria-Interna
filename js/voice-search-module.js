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

  /* En la toma siempre se dicta un número de bien, y ahí convert() hace lo correcto:
     junta todo en un código. Pero el buscador de la pantalla principal también busca por
     nombre y descripción, y ahí juntar todo arruina la búsqueda: "María López" quedaba
     "MARIALOPEZ" y no encontraba nada. Se distingue mirando las palabras dictadas: si casi
     todas son nombres de dígitos o letras deletreadas ("eme uno dos tres"), es un código;
     si son palabras corrientes, se busca tal como se dijo. */
  function esCodigoDictado(raw){
    if(!raw) return true;
    var pal = raw.trim().split(/[\s,\.\-]+/).filter(Boolean);
    if(pal.length <= 1) return true;          // una sola palabra: convert() la deja igual
    var tecnicas = 0;
    pal.forEach(function(w0){
      var w = normWord(w0);
      if(NUM[w] !== undefined || LET[w] !== undefined || w.length === 1) tecnicas++;
    });
    return tecnicas >= pal.length * 0.6;
  }
  function textoParaBuscar(codigo, crudo){
    return esCodigoDictado(crudo) ? codigo : String(crudo || '').trim();
  }
  window.__voiceEsCodigo = esCodigoDictado;
  window.__voiceTextoBusqueda = textoParaBuscar;
  /* El microfono se dibuja con el mismo trazo que el resto de la app en vez de un emoji,
     que cambiaba de forma segun el telefono y no se entendia que fuera un boton. */
  function svgMic(){
    return (typeof icon === 'function')
      ? icon('mic', 20)
      : '<span style="font-size:18px;line-height:1">\uD83C\uDF99\uFE0F</span>';
  }
  function makeMic(title){
    var b=document.createElement('button');
    b.type='button'; b.className='__voiceMic'; b.title=title||'Dictar por voz';
    b.setAttribute('aria-label', title||'Dictar por voz');
    b.innerHTML=svgMic();
    return b;
  }
  function fire(el){ ['input','keyup','change'].forEach(function(ev){ el.dispatchEvent(new Event(ev,{bubbles:true})); }); }
  function aviso(msg){
    if(typeof toast === 'function') toast(msg); else alert(msg);
  }
  function listen(btn, onResult){
    if(!SR){ aviso('Este navegador no permite dictado por voz. Use Chrome.'); return; }
    if(btn.classList.contains('escuchando')) return;   // ya esta grabando, no abrir dos a la vez
    var rec=new SR(); rec.lang='es-GT'; rec.interimResults=false; rec.maxAlternatives=4; rec.continuous=false;
    var cerrado=false;
    btn.classList.add('escuchando');
    var reset=function(){ if(cerrado) return; cerrado=true; btn.classList.remove('escuchando'); };
    rec.onresult=function(e){
      var alts=e.results[0]; var best='', crudo=alts.length?alts[0].transcript:'';
      for(var i=0;i<alts.length;i++){
        var c=convert(alts[i].transcript);
        // se guarda el dictado tal cual de la MISMA alternativa elegida, no el de la primera
        if(c.length>best.length){ best=c; crudo=alts[i].transcript; }
      }
      onResult(best, crudo);
    };
    rec.onerror=function(e){
      reset();
      var c = e && e.error;
      if(c==='not-allowed' || c==='service-not-allowed') aviso('Permita el micr\u00F3fono para dictar');
      else if(c==='no-speech') aviso('No se escuch\u00F3 nada, intente de nuevo');
    };
    rec.onend=reset;
    try{ rec.start(); }catch(err){ reset(); }
  }
  function attachSearch(){
    var s=document.getElementById('search'); if(!s) return;
    if(document.getElementById('__searchMic')) return;
    var wrap=document.createElement('div'); wrap.id='__searchWrap'; wrap.style.cssText='display:flex;gap:8px;align-items:center;';
    s.parentNode.insertBefore(wrap,s); wrap.appendChild(s); s.style.flex='1'; s.style.width='auto';
    var mic=makeMic('Dictar el nombre o el No. de bien'); mic.id='__searchMic'; wrap.appendChild(mic);
    mic.onclick=function(){
      listen(mic,function(v, crudo){
        var texto = textoParaBuscar(v, crudo);
        if(texto){ s.value=texto; s.focus(); fire(s); }
        else aviso('No se entendió, intente de nuevo');
      });
    };
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
