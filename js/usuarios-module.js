(function(){
  "use strict";
  // Administración de usuarios: crear cuentas y asignarles rol (editor / lector),
  // sin depender de la consola de Firebase para cada persona nueva.
  //
  // Nota importante de seguridad: esto controla lo que la APP deja hacer en pantalla.
  // Para que quede bloqueado también del lado del servidor (y no solo escondido en la
  // interfaz), hay que pegar las reglas de Firestore que aparecen en "Ver reglas de
  // seguridad" dentro de este mismo menú, en Firebase Console → Firestore Database →
  // Reglas. Sin ese paso, esta pantalla ordena el acceso pero no lo hace a prueba de
  // alguien que sepa usar la API de Firestore directamente.

  function db(){ return firebase.firestore(); }

  function appSecundaria(){
    var existente = firebase.apps.filter(function(a){ return a.name==='secundaria'; })[0];
    if(existente) return existente;
    return firebase.initializeApp(firebaseConfig, 'secundaria');
  }

  window.abrirUsuarios = function(){
    if(typeof requiereEdicion==='function' && !requiereEdicion()) return;
    var h = '<div class="grip"></div><h3>Usuarios y permisos</h3>'
      + '<div class="note">Editor: puede ver y modificar todo, igual que hoy. Lector: puede entrar y ver todo, pero no puede marcar bienes, tomar fotos, ni guardar cambios de ningún tipo.</div>'
      + '<div id="usrList"><div class="hint">Cargando…</div></div>'
      + '<div style="border-top:1px solid var(--linea);margin-top:14px;padding-top:12px">'
        + '<label style="font-size:13px;font-weight:700;color:#1F3864;display:block;margin-bottom:8px">Agregar usuario nuevo</label>'
        + '<label>Correo</label><input id="usrEmail" type="email" placeholder="nombre@igss.gob.gt" style="width:100%;padding:10px;border:1.4px solid var(--linea);border-radius:9px;margin-bottom:8px">'
        + '<label>Contraseña temporal (mínimo 6 caracteres)</label><input id="usrPass" type="text" placeholder="La persona la puede cambiar después" style="width:100%;padding:10px;border:1.4px solid var(--linea);border-radius:9px;margin-bottom:8px">'
        + '<label>Rol</label><div class="toggle2" style="margin-bottom:10px">'
          + '<div class="tbtn sel" id="usrRolEditor" onclick="usrElegirRol(\'editor\')">Editor</div>'
          + '<div class="tbtn" id="usrRolLector" onclick="usrElegirRol(\'lector\')">Lector (solo ver)</div>'
        + '</div>'
        + '<button class="act g" onclick="usrCrear()">Crear usuario</button>'
        + '<div id="usrMsg" style="margin-top:8px;font-size:13px;font-weight:600"></div>'
      + '</div>'
      + '<button class="act o" style="margin-top:10px" onclick="verReglasFirestore()">Ver reglas de seguridad para pegar en Firebase</button>'
      + '<button class="act q" onclick="closeMenu()">Cerrar</button>';
    document.getElementById('sheet').innerHTML = h;
    showSheet();
    window.__usrRolNuevo = 'editor';
    usrCargarLista();
  };

  window.usrElegirRol = function(rol){
    window.__usrRolNuevo = rol;
    var eEditor = document.getElementById('usrRolEditor'), eLector = document.getElementById('usrRolLector');
    if(eEditor) eEditor.classList.toggle('sel', rol==='editor');
    if(eLector) eLector.classList.toggle('sel', rol==='lector');
  };

  function usrCargarLista(){
    var box = document.getElementById('usrList'); if(!box) return;
    db().collection('usuarios').get().then(function(snap){
      if(snap.empty){
        box.innerHTML = '<div class="hint">Todavía no hay usuarios con rol asignado. Cualquier cuenta creada antes de esto se trata como Editor.</div>';
        return;
      }
      var rows = [];
      snap.forEach(function(doc){ rows.push(Object.assign({uid:doc.id}, doc.data())); });
      rows.sort(function(a,b){ return (a.email||'').localeCompare(b.email||''); });
      box.innerHTML = rows.map(function(u){
        return '<div class="tlist-item"><div><b>'+esc(u.email||u.uid)+'</b>'
          + '<small>'+(u.rol==='lector'?'Lector (solo ver)':'Editor')+'</small></div>'
          + '<select onchange="usrCambiarRol(\''+u.uid+'\',this.value)" style="padding:7px 9px;border:1.4px solid var(--linea);border-radius:8px;font-size:13px">'
            + '<option value="editor" '+(u.rol!=='lector'?'selected':'')+'>Editor</option>'
            + '<option value="lector" '+(u.rol==='lector'?'selected':'')+'>Lector</option>'
          + '</select></div>';
      }).join('');
    }).catch(function(e){
      box.innerHTML = '<div class="hint">No se pudo cargar: '+esc(e.message||e)+'</div>';
    });
  }

  window.usrCambiarRol = function(uid, rol){
    if(!requiereEdicion()) return;
    db().collection('usuarios').doc(uid).set({ rol: rol, actualizado: firebase.firestore.FieldValue.serverTimestamp() }, {merge:true})
      .then(function(){ toast('Rol actualizado ✓'); })
      .catch(function(e){ toast('No se pudo actualizar: '+(e.message||e)); });
  };

  window.usrCrear = function(){
    if(!requiereEdicion()) return;
    var email = (document.getElementById('usrEmail').value||'').trim();
    var pass = document.getElementById('usrPass').value||'';
    var rol = window.__usrRolNuevo || 'editor';
    var msg = document.getElementById('usrMsg');
    if(!email){ msg.style.color='var(--rojo)'; msg.textContent='Escriba el correo.'; return; }
    if(pass.length<6){ msg.style.color='var(--rojo)'; msg.textContent='La contraseña debe tener al menos 6 caracteres.'; return; }
    msg.style.color='var(--gris)'; msg.textContent='Creando…';
    var sec = appSecundaria();
    sec.auth().createUserWithEmailAndPassword(email, pass).then(function(cred){
      var uid = cred.user.uid;
      return db().collection('usuarios').doc(uid).set({
        email: email, rol: rol,
        creado: firebase.firestore.FieldValue.serverTimestamp(),
        creadoPor: META.by || (firebase.auth().currentUser?firebase.auth().currentUser.email:'')
      }).then(function(){ return sec.auth().signOut(); });
    }).then(function(){
      msg.style.color='var(--verde)'; msg.textContent='✓ Usuario creado ('+(rol==='lector'?'lector':'editor')+'). Comparta el correo y la contraseña con la persona.';
      document.getElementById('usrEmail').value=''; document.getElementById('usrPass').value='';
      usrCargarLista();
    }).catch(function(e){
      let m = e && e.message ? e.message : String(e);
      if(e && e.code==='auth/email-already-in-use') m='Ya existe una cuenta con ese correo.';
      msg.style.color='var(--rojo)'; msg.textContent='Error: '+m;
    });
  };

  const REGLAS_FIRESTORE =
'rules_version = \'2\';\n'+
'service cloud.firestore {\n'+
'  match /databases/{database}/documents {\n'+
'\n'+
'    function autenticado() { return request.auth != null; }\n'+
'    function esEditor() {\n'+
'      return autenticado() && (\n'+
'        !exists(/databases/$(database)/documents/usuarios/$(request.auth.uid))\n'+
'        || get(/databases/$(database)/documents/usuarios/$(request.auth.uid)).data.rol == \'editor\'\n'+
'      );\n'+
'    }\n'+
'\n'+
'    match /usuarios/{uid} {\n'+
'      allow read: if autenticado();\n'+
'      allow write: if esEditor();\n'+
'    }\n'+
'    match /bienes/{id} {\n'+
'      allow read: if autenticado();\n'+
'      allow write: if esEditor();\n'+
'    }\n'+
'    match /tarjetas/{id} {\n'+
'      allow read: if autenticado();\n'+
'      allow write: if esEditor();\n'+
'    }\n'+
'    match /hallazgos/{id} {\n'+
'      allow read: if autenticado();\n'+
'      allow write: if esEditor();\n'+
'    }\n'+
'    match /movimientos/{id} {\n'+
'      allow read: if autenticado();\n'+
'      allow write: if esEditor();\n'+
'    }\n'+
'    match /personal/{id} {\n'+
'      allow read: if autenticado();\n'+
'      allow write: if esEditor();\n'+
'    }\n'+
'  }\n'+
'}\n';

  window.verReglasFirestore = function(){
    document.getElementById('sheet').innerHTML = '<div class="grip"></div><h3>Reglas de seguridad de Firestore</h3>'
      + '<div class="note b">Esto es lo que de verdad bloquea a un "Lector" a nivel de servidor, no solo en la pantalla. Cópielo y péguelo en Firebase Console → Firestore Database → Reglas → Publicar. Sin este paso, el rol "Lector" solo esconde botones en la app.</div>'
      + '<button class="act p" onclick="copyReglasFirestore()">Copiar reglas</button>'
      + '<textarea class="csv" style="height:280px" onclick="this.select()">'+esc(REGLAS_FIRESTORE)+'</textarea>'
      + '<button class="act q" onclick="abrirUsuarios()">‹ Volver</button>';
    showSheet();
  };
  window.copyReglasFirestore = function(){
    if(navigator.clipboard && navigator.clipboard.writeText){
      navigator.clipboard.writeText(REGLAS_FIRESTORE).then(function(){ toast('Reglas copiadas ✓'); }).catch(function(){ toast('Selecciónelas y copie manual'); });
    } else toast('Selecciónelas y copie manual');
  };

  var origOpenMenu = window.openMenu;
  if(typeof origOpenMenu==='function'){
    window.openMenu = function(){
      origOpenMenu.apply(this, arguments);
      var sheet = document.getElementById('sheet'); if(!sheet) return;
      if(sheet.querySelector('#usrMenuMarker')) return;
      var anchor = sheet.querySelector('[onclick="cerrarSesion()"]');
      var html = '<div class="mitem" onclick="abrirUsuarios()"><span class="ic" id="usrMenuMarker">'+icon('users',20)+'</span><div><b>Usuarios y permisos</b><small>Crear cuentas y decidir quién solo puede ver</small></div></div>';
      if(anchor) anchor.insertAdjacentHTML('beforebegin', html);
      else sheet.insertAdjacentHTML('beforeend', html);
    };
  }
})();
