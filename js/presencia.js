/* ================= PRESENCIA: QUIÉN ESTÁ EN LÍNEA =================
   Cada persona conectada deja una "señal de vida" (un documento en la colección
   'presencia' con su correo, su rol y la hora), que refresca cada cierto tiempo. La
   app cuenta cuántas señales son recientes y muestra "N en línea" en el encabezado;
   al tocarlo se ve quiénes son. Nadie tiene que cerrar sesión: si una señal deja de
   refrescarse por más de 2 minutos, esa persona se considera desconectada.

   Requiere una regla de Firestore para la colección 'presencia' (ver "Usuarios y
   permisos → Ver reglas de seguridad"). Si aún no se publica, esta función queda
   inactiva sin romper nada y avisa cómo activarla. */
(function(){
  "use strict";
  var FRESCO_MS = 120000;   // señal válida si se refrescó en los últimos 2 minutos
  var LATIDO_MS = 45000;    // cada cuánto se refresca la señal propia
  var timer = null, unsub = null, uidActual = null, denegado = false;
  var enLinea = [];          // [{email, rol, ultimoMs, uid}]

  function db(){ return firebase.firestore(); }
  function e(x){ return (x==null?'':String(x)).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

  function escribirSenal(){
    var u = firebase.auth().currentUser; if(!u) return;
    db().collection('presencia').doc(u.uid).set({
      email: u.email || '',
      rol: (typeof MI_ROL!=='undefined' ? MI_ROL : 'editor'),
      ultimo: firebase.firestore.FieldValue.serverTimestamp(),
      agente: (navigator.userAgent||'').slice(0,140)
    }, {merge:true}).catch(function(err){
      if(err && err.code==='permission-denied'){ denegado = true; pintarChip(); }
    });
  }

  function tsMs(v){
    if(!v) return 0;
    if(typeof v.toMillis==='function') return v.toMillis();
    if(v.seconds) return v.seconds*1000;
    return 0;
  }

  function suscribir(){
    if(unsub) return;
    unsub = db().collection('presencia').onSnapshot(function(snap){
      denegado = false;
      var ahora = Date.now(); var lista = [];
      snap.forEach(function(d){ var x=d.data()||{}; var ms=tsMs(x.ultimo);
        if(ms && (ahora-ms) < FRESCO_MS){ lista.push({uid:d.id, email:x.email||'(sin correo)', rol:x.rol||'editor', ultimoMs:ms}); }
      });
      lista.sort(function(a,b){ return b.ultimoMs-a.ultimoMs; });
      enLinea = lista; pintarChip();
      if(document.getElementById('enlineaSheetMark')) verEnLinea(); // refrescar si está abierto
    }, function(err){
      if(err && err.code==='permission-denied'){ denegado = true; pintarChip(); }
    });
  }

  function pintarChip(){
    var small = document.querySelector('.htitle small'); if(!small) return;
    var chip = document.getElementById('enlineaChip');
    if(!chip){
      chip = document.createElement('span');
      chip.id = 'enlineaChip'; chip.className = 'enlinea';
      chip.setAttribute('onclick','verEnLinea()');
      small.appendChild(chip);
    }
    if(denegado){ chip.innerHTML = '&#128101; activar'; chip.title='Toque para activar "en línea"'; return; }
    var n = enLinea.length || (firebase.auth().currentUser?1:0);
    chip.innerHTML = '&#128994; '+n+' en l&iacute;nea';
  }

  function haceCuanto(ms){
    var s = Math.max(0, Math.round((Date.now()-ms)/1000));
    if(s < 60) return 'hace '+s+'s';
    var m = Math.round(s/60); return 'hace '+m+' min';
  }

  window.verEnLinea = function(){
    var uMe = firebase.auth().currentUser; var miUid = uMe?uMe.uid:'';
    var h = '<div class="grip"></div><span id="enlineaSheetMark"></span><h3>&#128994; Conectados ahora</h3>';
    if(denegado){
      h += '<div class="note b">La vista de "en línea" necesita una regla de seguridad nueva en Firestore. '
        + 'Abra <b>Usuarios y permisos → Ver reglas de seguridad</b>, copie las reglas (ya actualizadas) y publíquelas en Firebase. Es un paso de una sola vez.</div>'
        + (typeof verReglasFirestore==='function' ? '<button class="act p" onclick="verReglasFirestore()">Ver reglas de seguridad</button>' : '')
        + '<button class="act q" onclick="closeMenu()">Cerrar</button>';
      document.getElementById('sheet').innerHTML = h; showSheet(); return;
    }
    if(!enLinea.length){
      h += '<div class="hint">Nadie más aparece conectado en este momento.</div>';
    } else {
      h += '<div class="note">'+enLinea.length+' persona(s) con actividad en los últimos 2 minutos.</div>';
      h += enLinea.map(function(u){
        var yo = (u.uid===miUid);
        var badge = u.rol==='lector'
          ? '<span class="chip c-old">Lector</span>'
          : '<span class="chip c-comp">Editor</span>';
        return '<div class="tlist-item"><div><b>'+e(u.email)+(yo?' <span style="color:var(--azul2)">(tú)</span>':'')+'</b>'
          + '<small>'+badge+' &middot; activo '+haceCuanto(u.ultimoMs)+'</small></div></div>';
      }).join('');
    }
    if(typeof puedeEditar==='function' && puedeEditar() && typeof abrirUsuarios==='function'){
      h += '<button class="act o" style="margin-top:10px" onclick="abrirUsuarios()">&#128100; Ver todos los usuarios y permisos</button>';
    }
    h += '<button class="act q" onclick="closeMenu()">Cerrar</button>';
    document.getElementById('sheet').innerHTML = h; showSheet();
  };

  function arrancar(uid){
    if(uidActual===uid) return;
    detener();
    uidActual = uid;
    setTimeout(escribirSenal, 1500);   // dar tiempo a que se cargue el rol real
    timer = setInterval(escribirSenal, LATIDO_MS);
    suscribir();
    pintarChip();
  }
  function detener(){
    if(timer){ clearInterval(timer); timer=null; }
    if(unsub){ try{unsub();}catch(_){} unsub=null; }
    uidActual = null; enLinea = [];
  }

  document.addEventListener('visibilitychange', function(){
    if(!document.hidden && firebase.auth().currentUser) escribirSenal();
  });
  window.addEventListener('online', function(){ if(firebase.auth().currentUser) escribirSenal(); });

  // Se engancha al estado de sesión: al entrar arranca, al salir se detiene.
  function iniciar(){
    if(!window.firebase || !firebase.auth) { setTimeout(iniciar, 400); return; }
    firebase.auth().onAuthStateChanged(function(u){
      if(u) arrancar(u.uid); else { detener(); pintarChip(); }
    });
  }
  iniciar();
})();
