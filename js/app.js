const LOCS = ["A.I. EDIFICIO OFICINAS CENTRALES","ANEXO CENTRO COMERCIAL","TORRE CAFÉ"];

/* ================= FIREBASE ================= */
const firebaseConfig = {
  apiKey: "AIzaSyA8mLKBD9KN_gID9igm40Ury8sgkrbJjPE",
  authDomain: "inventario-ai-igss.firebaseapp.com",
  projectId: "inventario-ai-igss",
  storageBucket: "inventario-ai-igss.firebasestorage.app",
  messagingSenderId: "10492115495",
  appId: "1:10492115495:web:0d1894bc8724e952112c02",
  measurementId: "G-3E08EV81WG"
};
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
try{ db.enablePersistence({synchronizeTabs:true}).catch(function(e){ console.warn("persistence:",e.code); }); }catch(e){}

let META = {};
const METAKEY = "inv_ai_v3_meta";
function loadMeta(){ try{ META = JSON.parse(localStorage.getItem(METAKEY)) || {}; }catch(e){ META={}; } }
function saveMeta(){ try{ localStorage.setItem(METAKEY, JSON.stringify(META)); }catch(e){} }
loadMeta();

/* ================= HELPERS ================= */
function esc(s){ return (s==null?"":String(s)).replace(/[&<>"]/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c];}); }
function money(v){ return "Q"+Number(v||0).toLocaleString("es-GT",{minimumFractionDigits:2,maximumFractionDigits:2}); }
function norm(s){ return String(s==null?"":s).replace(/\s/g,"").toUpperCase(); }
function bienDocId(raw){ return norm(raw).replace(/\//g,"_").slice(0,300); }
function today(){ const d=new Date(); return String(d.getDate()).padStart(2,"0")+"/"+String(d.getMonth()+1).padStart(2,"0")+"/"+d.getFullYear(); }
function chipTipo(tp){ tp=tp||""; if(tp.indexOf("MPUTO")>=0)return '<span class="chip c-comp">CÓMPUTO</span>';
  if(tp.indexOf("BODEGA")>=0||tp.indexOf("GENERAL")>=0)return '<span class="chip c-bod">BODEGA</span>';
  return '<span class="chip c-ind">INDIVIDUAL</span>'; }
let tt=null;
function toast(m){ const el=document.getElementById("toast"); el.textContent=m; el.classList.add("show");
  clearTimeout(tt); tt=setTimeout(function(){el.classList.remove("show");},2600); }
function showSheet(){ document.getElementById("overlay").classList.add("show"); document.getElementById("sheet").classList.add("show"); }
function closeMenu(){ document.getElementById("overlay").classList.remove("show"); document.getElementById("sheet").classList.remove("show"); }
function pedirTexto(titulo, mensaje, valorInicial, tipo, callback){
  document.getElementById("sheet").innerHTML = '<div class="grip"></div><h3>'+esc(titulo)+'</h3>'
    +(mensaje?'<div class="note">'+esc(mensaje)+'</div>':'')
    +'<input type="'+(tipo||"text")+'" id="pedirTextoInput" value="'+esc(valorInicial||"")+'" style="width:100%;padding:11px;border:1.4px solid #E2E6EC;border-radius:9px;font-size:15px;margin-top:8px;box-sizing:border-box" placeholder="Escriba aquí">'
    +'<button class="act g" style="margin-top:12px" onclick="_pedirTextoConfirmar()">✓ Continuar</button>'
    +'<button class="act o" onclick="_pedirTextoCancelar()">Cancelar</button>';
  window.__pedirTextoCb = callback;
  showSheet();
  setTimeout(function(){ const el=document.getElementById("pedirTextoInput"); if(el){ el.focus(); el.select(); } }, 150);
}
function _pedirTextoConfirmar(){
  const val = (document.getElementById("pedirTextoInput")||{}).value || "";
  const cb = window.__pedirTextoCb; window.__pedirTextoCb = null;
  closeMenu();
  if(cb) cb(val);
}
function _pedirTextoCancelar(){
  window.__pedirTextoCb = null;
  closeMenu();
}

/* ================= ESTADO EN VIVO ================= */
let TARJETAS = {};
let BIENES = {};
let HALLAZGOS = {};
let ready = {t:false, b:false};
let mode = {view:"home", tarjetaId:null, filter:"todos", q:""};
let curSes = null;

function setSync(state, txt){
  const dot=document.getElementById("syncdot"); const t=document.getElementById("synctxt");
  if(dot) dot.className="syncdot "+(state||"");
  if(t) t.textContent=txt||"";
}

/* ================= ARRANQUE / LOGIN ================= */
setSync("off","Sin iniciar sesión");
firebase.auth().onAuthStateChanged(function(user){
  const lo=document.getElementById("loginoverlay");
  if(user){
    if(lo) lo.style.display="none";
    const mo=document.getElementById("migoverlay"); if(mo) mo.style.display="flex";
    setSync("busy","Conectando…");
    arrancar();
  } else {
    detenerListeners();
    firstSyncDone = false; ready = {t:false,b:false};
    TARJETAS={}; BIENES={}; HALLAZGOS={}; curSes=null;
    const mo=document.getElementById("migoverlay"); if(mo) mo.style.display="none";
    if(lo) lo.style.display="flex";
    setSync("off","Sin iniciar sesión");
  }
});
function doLogin(){
  const email = document.getElementById("li_email").value.trim();
  const pass = document.getElementById("li_pass").value;
  const err = document.getElementById("li_err"); const btn=document.getElementById("li_btn");
  err.textContent="";
  if(!email || !pass){ err.textContent="Escriba su correo y contraseña."; return; }
  btn.textContent="Ingresando…"; btn.disabled=true;
  firebase.auth().signInWithEmailAndPassword(email, pass).catch(function(e){
    let msg = "No se pudo iniciar sesión.";
    if(e.code==="auth/wrong-password"||e.code==="auth/invalid-credential"||e.code==="auth/invalid-login-credentials") msg="Correo o contraseña incorrectos.";
    else if(e.code==="auth/user-not-found") msg="No existe ese usuario. Créelo primero en Firebase Console → Authentication.";
    else if(e.code==="auth/too-many-requests") msg="Demasiados intentos. Espere un momento.";
    else if(e.code==="auth/network-request-failed") msg="Sin conexión a internet.";
    err.textContent = msg;
  }).finally(function(){ btn.textContent="Iniciar sesión"; btn.disabled=false; });
}
function cerrarSesion(){
  if(!confirm("¿Cerrar sesión en este teléfono?")) return;
  closeMenu();
  firebase.auth().signOut();
}

function arrancar(){
  db.collection("bienes").limit(1).get().then(function(snap){
    if(snap.empty){
      const mt=document.getElementById("migtxt");
      if(mt) mt.textContent="No hay bienes registrados todavía en la base de datos.";
    }
    iniciarListeners();
  }).catch(function(e){
    const mt=document.getElementById("migtxt"); if(mt) mt.textContent="Error al conectar con la base de datos: "+e.message;
  });
}

/* ================= LISTENERS EN VIVO ================= */
let _unsubs = [];
function detenerListeners(){ _unsubs.forEach(function(fn){ try{ fn(); }catch(e){} }); _unsubs=[]; }
function iniciarListeners(){
  detenerListeners();
  _unsubs.push(db.collection("tarjetas").onSnapshot(function(snap){
    snap.docChanges().forEach(function(ch){
      if(ch.type==="removed"){ delete TARJETAS[ch.doc.id]; }
      else { TARJETAS[ch.doc.id] = Object.assign({id:ch.doc.id}, ch.doc.data()); }
    });
    ready.t = true; afterFirstSync();
    if(firstSyncDone) render();
  }, function(e){ setSync("off","Error de sincronización"); }));

  _unsubs.push(db.collection("bienes").onSnapshot(function(snap){
    snap.docChanges().forEach(function(ch){
      if(ch.type==="removed"){ delete BIENES[ch.doc.id]; }
      else { BIENES[ch.doc.id] = Object.assign({id:ch.doc.id}, ch.doc.data()); }
    });
    ready.b = true; afterFirstSync();
    if(firstSyncDone){ refreshProgress(); render(); }
  }, function(e){ setSync("off","Error de sincronización"); }));

  _unsubs.push(db.collection("hallazgos").onSnapshot(function(snap){
    snap.docChanges().forEach(function(ch){
      if(ch.type==="removed"){ delete HALLAZGOS[ch.doc.id]; }
      else { HALLAZGOS[ch.doc.id] = Object.assign({id:ch.doc.id}, ch.doc.data()); }
    });
    if(firstSyncDone && (mode.view==="hall"||mode.q)) render();
  }, function(){}));
}
let firstSyncDone=false;
function afterFirstSync(){
  if(firstSyncDone) return;
  if(ready.t && ready.b){
    firstSyncDone = true;
    const ov=document.getElementById("migoverlay"); if(ov) ov.style.display="none";
    setSync("on","Sincronizado");
    refreshProgress(); goHome();
    if(!META.by){ setTimeout(openMenu,500); }
  }
}
window.addEventListener("online", function(){ setSync("on","Sincronizado"); });
window.addEventListener("offline", function(){ setSync("off","Sin conexión — se guarda y sincroniza al volver"); });

/* ================= PROGRESO ================= */
function totalDone(){ let n=0; for(const k in BIENES){ if(BIENES[k].existe) n++; } return n; }
function refreshProgress(){
  const tot = Object.keys(BIENES).length, done = totalDone();
  const pct = tot? Math.round(done/tot*100):0;
  document.getElementById("pbar").style.width=pct+"%";
  document.getElementById("pbartxt").textContent = done+" / "+tot+"  ("+pct+"%)";
}

/* ================= AGRUPACIÓN ================= */
function tarjetasActivas(){
  return Object.values(TARJETAS).filter(function(t){return t.activa!==false;})
    .sort(function(a,b){ return (a.responsable||"").localeCompare(b.responsable||""); });
}
function bienesDe(tarjetaId){ return Object.values(BIENES).filter(function(b){ return b.tarjetaId===tarjetaId; }); }
function doneCount(list){ return list.filter(function(b){return b.existe;}).length; }

/* ================= NAVEGACIÓN / RENDER ================= */
function goHome(){ mode={view:"home",tarjetaId:null,filter:"todos",q:""}; document.getElementById("search").value=""; render(); window.scrollTo(0,0); }
function render(){
  if(!firstSyncDone) return;
  const v=document.getElementById("view");
  if(mode.q) return renderSearch(v);
  if(mode.view==="person") return renderPerson(v);
  if(mode.view==="hall") return renderHall(v);
  if(mode.view==="ses") return renderSession(v);
  if(mode.view==="pend") return renderPendientes(v);
  const tarjs = tarjetasActivas();
  const pend = bienesPendientes();
  let h='<div class="hzrow" onclick="openHall()"><span class="ic">📸</span>'
    +'<div style="flex:1"><b>Hallazgos: bienes encontrados sin tarjeta</b><small>Toque ➕ Hallazgo para anotar uno</small></div>'
    +'<div style="color:#C99B62;font-size:20px">›</div></div>';
  if(pend.length){
    h+='<div class="hzrow" style="background:linear-gradient(135deg,#EAF1FB,#DCE8F8);border-color:#B9CDE8" onclick="openPendientes()"><span class="ic">📦</span>'
      +'<div style="flex:1"><b style="color:#1F3864">Bienes nuevos pendientes de asignar</b><small style="color:#5E7196">'+pend.length+' bien(es) esperando responsable</small></div>'
      +'<div style="color:#9FB0CC;font-size:20px">›</div></div>';
  }
  h+='<div class="hint">Toque un responsable para verificar sus bienes. '+tarjs.length+' tarjetas · '+Object.keys(BIENES).length+' bienes.</div>';
  tarjs.forEach(function(t){
    const list = bienesDe(t.id); const d=doneCount(list); const n=list.length; const p=n?Math.round(d/n*100):0;
    h+='<div class="prow" onclick="openPerson(\''+t.id+'\')">'
      +'<div class="ring" style="--p:'+p+'"><span class="ringtxt">'+d+'/'+n+'</span></div>'
      +'<div class="pinfo"><div class="pname">'+esc(t.responsable||"(sin nombre)")+'</div>'
      +'<div class="pmeta">Tarjeta '+esc(t.numero||"(pendiente)")+' '+chipTipo(t.tipo)
      +(t.correo?' <span class="pill-mail">✉️</span>':'')+'</div></div>'
      +'<div style="color:#B8C0CC;font-size:20px">›</div></div>';
  });
  v.innerHTML=h;
}
function bienesPendientes(){ return Object.values(BIENES).filter(function(b){ return !b.tarjetaId; }); }
function openPendientes(){ mode={view:"pend",tarjetaId:null,filter:"todos",q:""}; document.getElementById("search").value=""; render(); window.scrollTo(0,0); }
function renderPendientes(v){
  const pend = bienesPendientes().sort(function(a,b){ return (a.codigo||"").localeCompare(b.codigo||""); });
  let h='<button class="backbtn" onclick="goHome()">‹ Responsables</button>';
  h+='<div style="margin:6px 2px 8px"><div style="font-size:18px;font-weight:800;color:#1F3864">📦 Bienes pendientes de asignar</div>'
    +'<div style="font-size:12.5px;color:#8A929C;margin-top:2px">Bienes ya ingresados al sistema (por ejemplo, importados de Excel) que todavía no tienen responsable. Asígnelos con 🧍 Nueva toma cuando visite a la persona.</div></div>';
  if(pend.length===0){ h+='<div class="empty">No hay bienes pendientes de asignar.</div>'; v.innerHTML=h; return; }
  h += pend.map(function(b){ return itemCard(b); }).join("");
  v.innerHTML=h; loadThumbs();
}
function openPerson(id){ mode={view:"person",tarjetaId:id,filter:"todos",q:""}; document.getElementById("search").value=""; render(); window.scrollTo(0,0); }
function renderPerson(v){
  const t = TARJETAS[mode.tarjetaId];
  if(!t){ goHome(); return; }
  const list = bienesDe(t.id);
  const d = doneCount(list), n=list.length;
  let show=list;
  if(mode.filter==="pend") show=list.filter(function(b){return !b.existe;});
  if(mode.filter==="list") show=list.filter(function(b){return b.existe;});
  show = show.slice().sort(function(a,b){return (a.codigo||"").localeCompare(b.codigo||"");});
  let h='<button class="backbtn" onclick="goHome()">‹ Responsables</button>';
  h+='<div style="margin:6px 2px 2px"><div style="font-size:18px;font-weight:800;color:#17202e">'+esc(t.responsable||"(sin nombre)")+'</div>'
    +'<div style="font-size:12.5px;color:#8A929C;margin-top:2px">Tarjeta '+esc(t.numero||"(pendiente)")+' · '+esc(t.puesto||"")+' '+chipTipo(t.tipo)+'</div>'
    +'<div style="margin-top:4px"><span class="moretog" onclick="editCorreoTarjeta(\''+t.id+'\')">✉️ '+(t.correo?esc(t.correo):"agregar correo")+'</span></div></div>';
  h+='<div class="filters">'
    +'<div class="fp '+(mode.filter==="todos"?"on":"")+'" onclick="setFilter(\'todos\')">Todos ('+n+')</div>'
    +'<div class="fp '+(mode.filter==="pend"?"on":"")+'" onclick="setFilter(\'pend\')">Pendientes ('+(n-d)+')</div>'
    +'<div class="fp '+(mode.filter==="list"?"on":"")+'" onclick="setFilter(\'list\')">Hechos ('+d+')</div></div>';
  if(n===0){
    h+='<button class="act o" style="margin-bottom:12px" onclick="borrarTarjetaDefinitiva(\''+t.id+'\')">🗑️ Borrar este responsable (tarjeta vacía)</button>';
  }
  if(show.length===0){ h+='<div class="empty">No hay bienes en este filtro.</div>'; v.innerHTML=h; loadThumbs(); return; }
  if(mode.filter!=="list" && (n-d)>1){
    h+='<button class="act o" style="margin-bottom:12px" onclick="marcarPendientesNo(\''+t.id+'\')">🚫 Ninguno de los pendientes está aquí (marcar todos NO)</button>';
  }
  h += show.map(function(b){ return itemCard(b); }).join("");
  v.innerHTML=h; loadThumbs();
}
function marcarPendientesNo(tarjetaId){
  const pend = bienesDe(tarjetaId).filter(function(b){ return !b.existe; });
  if(pend.length===0) return;
  if(!confirm("¿Marcar los "+pend.length+" bienes pendientes de esta tarjeta como NO (no están aquí)?")) return;
  const batch = db.batch();
  pend.forEach(function(b){
    batch.update(db.collection("bienes").doc(b.id), {existe:"NO", fechaVerificacion: today(), verificadoPor: META.by||"", actualizado: firebase.firestore.FieldValue.serverTimestamp()});
    const movRef = db.collection("movimientos").doc();
    batch.set(movRef, { codigo:b.codigo, tipoMovimiento:"VERIFICACION", tarjetaAnteriorNumero:"", responsableAnterior:"",
      tarjetaNuevaNumero:b.tarjetaNumero||"", responsableNuevo:b.responsable||"", existe:"NO", estado:b.estado||"",
      ubicacion:b.ubicacion||"", observaciones:"Marcado en lote: no se encontró en esta tarjeta",
      fecha: firebase.firestore.FieldValue.serverTimestamp(), fechaTxt: today(), capturadoPor: META.by||"" });
  });
  batch.commit().then(function(){ toast(pend.length+" bienes marcados como NO ✓"); }).catch(function(){ toast("No se pudo guardar"); });
}
function borrarTarjetaDefinitiva(id){
  const t = TARJETAS[id];
  if(!t) return;
  if(!confirm("¿Seguro que desea eliminar el registro de "+(t.responsable||"esta persona")+"? Esta acción no se puede deshacer.")){ return; }
  db.collection("tarjetas").doc(id).delete()
    .then(function(){ toast("Responsable eliminado ✓"); goHome(); })
    .catch(function(){ toast("Error al eliminar"); });
}
function setFilter(f){ mode.filter=f; render(); }

/* ================= TARJETA DE BIEN ================= */
function itemCard(b, showOwner){
  const cls = b.existe==="SÍ"?"done-si":b.existe==="NO"?"done-no":b.existe==="NO UBICADO"?"done-nu":"";
  const dup = b.notaDuplicado?'<span class="chip c-dup">⚠ REVISAR</span>':'';
  const nuevo = b.esNuevo?'<span class="chip c-hz">NUEVO</span>':'';
  const pendChip = !b.tarjetaId?'<span class="chip c-dup">SIN ASIGNAR</span>':'';
  const owner = (showOwner && b.tarjetaId)?'<div class="powner">'+esc(b.responsable||"")+' · Tarj. '+esc(b.tarjetaNumero||"")+'</div>':'';
  const id = b.id;
  const descField = b.esNuevo
    ? '<input type="text" value="'+esc(b.descripcion||"")+'" onchange="markCampo(\''+id+'\',\'descripcion\',this.value)" placeholder="Descripción del bien" style="width:100%;padding:9px 11px;border:1.4px solid #E2E6EC;border-radius:9px;font-size:14px;margin:4px 0 2px">'
    : '<div class="desc">'+esc(b.descripcion||"")+'</div>';
  const asignarBtn = !b.tarjetaId ? '<button class="act p" style="margin:8px 0 0" onclick="asignarPendiente(\''+id+'\')">🧍 Asignar a una persona</button>' : '';
  return '<div class="item '+cls+'" id="it_'+id+'">'
    +'<div class="itop"><span class="inv">'+esc(b.codigo)+(b.codigoSiges?' <small style="font-weight:600;color:#8A929C">· SIGES '+esc(b.codigoSiges)+'</small>':'')+'</span><span class="val">'+money(b.valor)+'</span></div>'
    +'<div class="ochips">'+chipTipo(b.tipo)+nuevo+pendChip+dup+'</div>'
    +descField
    +(b.notaDuplicado?'<div class="warnbox">'+esc(b.notaDuplicado)+'</div>':'')
    +(b.tarjetaAnteriorNumero?'<div class="warnbox">↩ Descargado de tarjeta '+esc(b.tarjetaAnteriorNumero)+' ('+esc(b.responsableAnterior||"")+')</div>':'')
    +owner
    +asignarBtn
    +'<div class="bgrp">'
      +'<button class="btn b-si '+(b.existe==="SÍ"?"sel":"")+'" onclick="markExiste(\''+id+'\',\'SÍ\')">✓ SÍ<small>existe</small></button>'
      +'<button class="btn b-no '+(b.existe==="NO"?"sel":"")+'" onclick="markExiste(\''+id+'\',\'NO\')">✗ NO<small>no está</small></button>'
      +'<button class="btn b-nu '+(b.existe==="NO UBICADO"?"sel":"")+'" onclick="markExiste(\''+id+'\',\'NO UBICADO\')">? NO<small>ubicado</small></button>'
    +'</div>'
    +'<div class="bgrp estado" style="'+(b.existe==="SÍ"?"":"display:none")+'">'
      +['BUENO','REGULAR','MALO','PARA BAJA'].map(function(e){ const cl=e==="PARA BAJA"?"baja":e.toLowerCase();
        return '<button class="btn est e-'+cl+' '+(b.estado===e?"sel":"")+'" onclick="markEstado(\''+id+'\',\''+e+'\')">'+(e==="PARA BAJA"?"Baja":e.charAt(0)+e.slice(1).toLowerCase())+'</button>'; }).join("")
    +'</div>'
    +'<div class="tools">'
      +'<button class="fotobtn" id="fb_B'+id+'" onclick="takePhoto(\'B'+id+'\')">📷 Foto</button>'
      +'<img class="thumb" id="th_B'+id+'" style="display:none" onclick="viewPhoto(\'B'+id+'\')">'
       +(b.fotoUrl?'<a class="drivefoto" href="'+b.fotoUrl+'" target="_blank" rel="noopener"><img class="dthumb" src="'+driveThumbUrl(b.fotoUrl)+'" loading="lazy" alt="foto">🖼️ Ver foto</a>':'')
      +'<span class="moretog" onclick="toggleExtra(\''+id+'\')">＋ Ubicación / observación</span>'
      +(b.esNuevo?'<span class="moretog" style="color:var(--rojo)" onclick="borrarBien(\''+id+'\')">🗑 Borrar</span>':'')
    +'</div>'
    +'<div class="extra" id="ex_'+id+'">'
      +'<label>Ubicación física real</label><input type="text" value="'+esc(b.ubicacion||"")+'" onchange="markCampo(\''+id+'\',\'ubicacion\',this.value)" placeholder="Ej. Oficina 3">'
      +'<label>Observaciones</label><input type="text" value="'+esc(b.observaciones||"")+'" onchange="markCampo(\''+id+'\',\'observaciones\',this.value)" placeholder="Ej. sin serie visible">'
    +'</div>'
    +(b.fechaVerificacion?'<div class="stamp">✓ '+esc(b.fechaVerificacion)+(b.verificadoPor?" · "+esc(b.verificadoPor):"")+'</div>':'')
  +'</div>';
}
function borrarBien(id){
  const b = BIENES[id]; if(!b) return;
  if(!confirm('¿Borrar el registro "'+b.codigo+'" ('+(b.descripcion||"sin descripción")+')? No se puede deshacer.')) return;
  fotoDel("B"+id);
  db.collection("bienes").doc(id).delete().then(function(){ toast("Registro borrado ✓"); }).catch(function(){ toast("No se pudo borrar"); });
}
function toggleExtra(id){ const e=document.getElementById("ex_"+id); if(e) e.classList.toggle("open"); }
function markExiste(id,val){
  const b = BIENES[id]; if(!b) return;
  const nuevo = b.existe===val ? "" : val;
  const patch = { existe: nuevo, actualizado: firebase.firestore.FieldValue.serverTimestamp() };
  if(nuevo){ patch.fechaVerificacion = today(); patch.verificadoPor = META.by||""; }
  db.collection("bienes").doc(id).update(patch).catch(function(){ toast("No se pudo guardar (revise conexión)"); });
  logMovimiento(b, {tipoMovimiento:"VERIFICACION", estado:b.estado||"", existe:nuevo, ubicacion:b.ubicacion||"", observaciones:b.observaciones||""});
}
function markEstado(id,val){
  const b = BIENES[id]; if(!b) return;
  const nuevo = b.estado===val? "" : val;
  db.collection("bienes").doc(id).update({estado:nuevo, actualizado: firebase.firestore.FieldValue.serverTimestamp()}).catch(function(){ toast("No se pudo guardar"); });
}
function markCampo(id,campo,val){
  const patch={actualizado: firebase.firestore.FieldValue.serverTimestamp()}; patch[campo]=val;
  db.collection("bienes").doc(id).update(patch).catch(function(){ toast("No se pudo guardar"); });
}
function logMovimiento(b, extra){
  const rec = Object.assign({
    codigo: b.codigo, tarjetaNumero: b.tarjetaNumero, responsable: b.responsable,
    fecha: firebase.firestore.FieldValue.serverTimestamp(), fechaTxt: today(), capturadoPor: META.by||""
  }, extra);
  db.collection("movimientos").add(rec).catch(function(){});
}
function editCorreoTarjeta(id){
  const t = TARJETAS[id]; if(!t) return;
  pedirTexto("Correo electrónico", "Correo de "+(t.responsable||"esta persona"), t.correo||"", "email", function(val){
    db.collection("tarjetas").doc(id).update({correo:val.trim(), actualizada: firebase.firestore.FieldValue.serverTimestamp()})
      .then(function(){ toast("Correo actualizado ✓"); }).catch(function(){ toast("No se pudo guardar"); });
  });
}

/* ================= BÚSQUEDA ================= */
function onSearch(q){ mode.q=q.trim(); render(); }
function renderSearch(v){
  const q = mode.q.toLowerCase();
  const ids = Object.keys(BIENES).filter(function(id){
    const b=BIENES[id];
    return String(b.codigo).toLowerCase().indexOf(q)>=0 || (b.descripcion||"").toLowerCase().indexOf(q)>=0
      || (b.responsable||"").toLowerCase().indexOf(q)>=0 || String(b.tarjetaNumero||"").toLowerCase().indexOf(q)>=0
      || String(b.codigoSiges||"").toLowerCase().indexOf(q)>=0;
  });
  const hz = Object.values(HALLAZGOS).filter(function(z){
    return (z.inv||"").toLowerCase().indexOf(q)>=0 || (z.desc||"").toLowerCase().indexOf(q)>=0;
  });
  let h = '<div class="hint">'+(ids.length+hz.length)+' resultado(s) para "'+esc(mode.q)+'".</div>';
  if(hz.length) h += hz.map(hallCard).join("");
  if(ids.length===0 && hz.length===0) h += '<div class="empty">Sin coincidencias.<br><br>Si el bien no está en el listado,<br>use 🧍 Nueva toma o ➕ Hallazgo.</div>';
  else h += ids.slice(0,200).map(function(id){ return itemCard(BIENES[id], true); }).join("");
  v.innerHTML = h; loadThumbs();
}

/* ================= HALLAZGOS ================= */
function openHall(){ mode={view:"hall",tarjetaId:null,filter:"todos",q:""}; document.getElementById("search").value=""; render(); window.scrollTo(0,0); }
function renderHall(v){
  const list = Object.values(HALLAZGOS).sort(function(a,b){ return (b.creadoTs||0)-(a.creadoTs||0); });
  let h='<button class="backbtn" onclick="goHome()">‹ Responsables</button>';
  h+='<div style="margin:6px 2px 8px"><div style="font-size:18px;font-weight:800;color:#7A4508">📸 Hallazgos</div>'
    +'<div style="font-size:12.5px;color:#8A929C;margin-top:2px">Bienes encontrados que NO están en ninguna tarjeta.</div></div>';
  h+='<button class="act n" style="margin:4px 0 14px" onclick="newHallazgo()">➕ Agregar bien encontrado</button>';
  if(list.length===0) h+='<div class="empty">Aún no hay hallazgos anotados.</div>';
  else h+=list.map(hallCard).join("");
  v.innerHTML=h; loadThumbs();
}
function hallCard(z){
  return '<div class="item hzitem" id="hz_'+z.id+'">'
    +'<div class="itop"><span class="inv">'+(z.inv?esc(z.inv):"S/N")+'</span>'
    +'<span class="chip c-hz" style="margin-left:8px">HALLAZGO</span></div>'
    +'<div class="desc">'+esc(z.desc)+(z.cant>1?"  ×"+z.cant:"")+'</div>'
    +'<div class="powner">'+(z.resp?"Con: "+esc(z.resp):"")+(z.ubi?" · "+esc(z.ubi):"")+(z.est?" · "+esc(z.est):"")+'</div>'
    +(z.obs?'<div class="powner">Obs: '+esc(z.obs)+'</div>':'')
    +'<div class="tools"><button class="fotobtn" id="fb_H'+z.id+'" onclick="takePhoto(\'H'+z.id+'\')">📷 Foto</button>'
      +'<img class="thumb" id="th_H'+z.id+'" style="display:none" onclick="viewPhoto(\'H'+z.id+'\')">'
      +'<span class="moretog" onclick="editHallazgo(\''+z.id+'\')">✏️ Editar</span>'
      +'<span class="moretog" style="color:var(--rojo)" onclick="delHallazgo(\''+z.id+'\')">🗑 Borrar</span></div>'
    +'<div class="stamp">Anotado '+esc(z.f||"")+(z.by?" · "+esc(z.by):"")+'</div>'
  +'</div>';
}
function newHallazgo(){ hallForm(null); }
function editHallazgo(id){ hallForm(HALLAZGOS[id]||null); }
function hallForm(z){
  document.getElementById("sheet").innerHTML =
    '<div class="grip"></div><h3>'+(z?"Editar hallazgo":"➕ Bien encontrado (hallazgo)")+'</h3>'
    +'<div class="fform">'
    +'<label>No. de inventario (si tiene placa)</label><input id="hf_inv" type="text" value="'+esc(z?z.inv:"")+'" placeholder="Ej. 512345 o vacío">'
    +'<label>Descripción del bien *</label><input id="hf_desc" type="text" value="'+esc(z?z.desc:"")+'" placeholder="Ej. Silla secretarial negra">'
    +'<label>Cantidad</label><input id="hf_cant" type="number" min="1" value="'+(z?z.cant:1)+'">'
    +'<label>¿Con quién / dónde se encontró?</label><input id="hf_resp" type="text" value="'+esc(z?z.resp:"")+'" placeholder="Nombre de la persona o lugar">'
    +'<label>Ubicación física</label><input id="hf_ubi" type="text" value="'+esc(z?z.ubi:"")+'" placeholder="Ej. Bodega, pasillo 2">'
    +'<label>Estado físico</label><div class="bgrp estado" id="hf_estwrap">'
      +['BUENO','REGULAR','MALO','PARA BAJA'].map(function(e){ const cl=e==="PARA BAJA"?"baja":e.toLowerCase();
        return '<button class="btn est e-'+cl+' '+((z&&z.est===e)?"sel":"")+'" onclick="hfEst(this,\''+e+'\')">'+(e==="PARA BAJA"?"Baja":e.charAt(0)+e.slice(1).toLowerCase())+'</button>'; }).join("")
    +'</div>'
    +'<label>Observaciones</label><input id="hf_obs" type="text" value="'+esc(z?z.obs:"")+'" placeholder="Ej. sin placa visible">'
    +'</div>'
    +'<button class="act n" onclick="saveHallazgo(\''+(z?z.id:"")+'\')">'+(z?"Guardar cambios":"Guardar hallazgo")+'</button>'
    +'<button class="act q" onclick="closeMenu()">Cancelar</button>';
  window.__hfEst = z?z.est:"";
  showSheet();
}
function hfEst(btn,val){
  const c=document.getElementById("hf_estwrap");
  if(window.__hfEst===val){ window.__hfEst=""; btn.classList.remove("sel"); return; }
  window.__hfEst=val; c.querySelectorAll(".btn").forEach(function(b){b.classList.remove("sel");}); btn.classList.add("sel");
}
function saveHallazgo(id){
  const g=function(x){return document.getElementById(x).value.trim();};
  const desc=g("hf_desc"); if(!desc){ toast("Escriba la descripción"); return; }
  const rec = { inv:g("hf_inv"), desc:desc, cant:Math.max(1,parseInt(g("hf_cant")||"1")||1),
    resp:g("hf_resp"), ubi:g("hf_ubi"), est:window.__hfEst||"", obs:g("hf_obs"),
    f: today(), by: META.by||"", creadoTs: Date.now(), foto: (id&&HALLAZGOS[id])?HALLAZGOS[id].foto||0:0 };
  const ref = id ? db.collection("hallazgos").doc(id) : db.collection("hallazgos").doc();
  ref.set(rec,{merge:true}).then(function(){
    closeMenu(); openHall(); toast(id?"Hallazgo actualizado ✓":"Hallazgo guardado ✓");
  }).catch(function(){ toast("No se pudo guardar (revise conexión)"); });
}
function delHallazgo(id){
  if(!confirm("¿Borrar este hallazgo?")) return;
  fotoDel("H"+id);
  db.collection("hallazgos").doc(id).delete().then(function(){ toast("Borrado"); }).catch(function(){ toast("No se pudo borrar"); });
}

/* ================= NUEVA TOMA (levantar por persona / reasignar) ================= */
function newSession(){
  fotoDel("Lses");
  curSes = { tipo:"existente", tarjetaId:null, numero:"", persona:"", empleado:"", correo:"", loc:"", foto:0, items:[] };
  mode.view="ses"; mode.q=""; document.getElementById("search").value=""; render(); window.scrollTo(0,0);
}
function cancelSession(){ fotoDel("Lses"); curSes=null; goHome(); }
function sesSetTipo(t){ curSes.tipo=t; if(t==="nueva"){ curSes.tarjetaId=null; } render(); }
function sesAutollenar(){
  if(!curSes || curSes.tipo!=="nueva") return;
  const m = buscarTarjetaPorNombre(curSes.persona);
  if(m){
    if(!curSes.correo) curSes.correo = m.correo||"";
    if(!curSes.empleado) curSes.empleado = m.empleado||"";
    if(!curSes.numero && m.numero) curSes.numero = m.numero;
  }
  render();
}
function sesSetLoc(l){ curSes.loc=l; render(); }
function renderSession(v){
  const s = curSes; if(!s){ goHome(); return; }
  let h = '<button class="backbtn" onclick="cancelSession()">‹ Cancelar</button>';
  h += '<div class="item" style="border-left-color:#1F3864"><div class="fform">';
  h += '<label>¿A qué tarjeta pasan estos bienes?</label>';
  h += '<div class="toggle2">'
    + '<div class="tbtn '+(s.tipo==="existente"?"sel":"")+'" onclick="sesSetTipo(\'existente\')">🔁 Tarjeta existente</div>'
    + '<div class="tbtn '+(s.tipo==="nueva"?"sel":"")+'" onclick="sesSetTipo(\'nueva\')">🆕 Tarjeta nueva</div>'
    + '</div>';
  if(s.tipo==="existente"){
    h += '<button class="tpickbtn" style="margin-top:10px" onclick="openTarjetaPicker()">'
       + (s.tarjetaId ? ('Tarjeta '+esc(s.numero||"(pendiente)")+' — '+esc(TARJETAS[s.tarjetaId]?TARJETAS[s.tarjetaId].responsable:"")) : "Toque para elegir la tarjeta")
       + '<span class="sub">'+(s.tarjetaId? "Puede cambiar el responsable abajo si la persona cambió":"Buscar por número o nombre actual")+'</span></button>';
    if(s.tarjetaId){
      h += '<label>Responsable (el mismo, o escriba uno nuevo si cambió)</label>'
         + '<input id="sp_persona" value="'+esc(s.persona)+'" oninput="curSes.persona=this.value">';
    }
  } else {
    h += '<label>No. de tarjeta nuevo (déjelo vacío si aún no lo asignan)</label>'
       + '<input id="sp_numero" value="'+esc(s.numero)+'" oninput="curSes.numero=this.value" placeholder="Ej. 40960">';
    h += '<label>Responsable (persona) *</label>'
       + '<input id="sp_persona" value="'+esc(s.persona)+'" oninput="curSes.persona=this.value" onblur="sesAutollenar()" placeholder="Nombre completo">';
    const coincide = s.persona ? buscarTarjetaPorNombre(s.persona) : null;
    if(coincide) h += '<div class="pill-mail">✓ Ya existe una tarjeta con el nombre exacto "'+esc(coincide.responsable)+'" y sin número asignado — se le agregarán estos bienes ahí (mismo correo, mismo empleado).</div>';
  }
  h += '<label>No. de empleado (opcional)</label><input id="sp_emp" value="'+esc(s.empleado)+'" oninput="curSes.empleado=this.value" inputmode="numeric">';
  h += '<label>Correo electrónico (para el aviso automático)</label><input id="sp_mail" type="email" value="'+esc(s.correo)+'" oninput="curSes.correo=this.value" placeholder="nombre@igss.gob.gt">';
  h += '<label>Ubicación *</label><div class="bgrp" style="flex-direction:column;gap:7px">';
  LOCS.forEach(function(L){ h+='<button class="btn '+(s.loc===L?"b-si sel":"")+'" style="text-align:left;font-size:13px" onclick="sesSetLoc(\''+esc(L)+'\')">'+(s.loc===L?"✓ ":"")+esc(L)+'</button>'; });
  h += '</div>';
  h += '<div class="tools" style="margin-top:10px"><button class="fotobtn" id="fb_Lses" onclick="takePhoto(\'Lses\')">📷 Foto del lugar</button>'
     + '<img class="thumb" id="th_Lses" style="display:none" onclick="viewPhoto(\'Lses\')"></div>';
  h += '</div></div>';
  h += '<div class="item"><label style="font-size:12px;color:#5B6470;font-weight:700">Números de bien que tiene esta persona</label>'
     + '<div style="display:flex;gap:8px;margin-top:6px"><input id="invin" style="flex:1;padding:12px;border:1.5px solid #E2E6EC;border-radius:10px;font-size:17px;font-weight:700" placeholder="Léalo del bien y escríbalo" onkeydown="if(event.key===\'Enter\'){event.preventDefault();addInv();}">'
     + '<button class="act p" style="margin:0;width:auto;padding:0 18px" onclick="addInv()">Agregar</button></div>'
     + '<div style="font-size:11.5px;color:#8A929C;margin-top:6px"><span id="sescount">'+s.items.length+'</span> bien(es) en esta toma</div></div>';
  h += '<div id="sesitems">'+s.items.map(sesItemCard).join("")+'</div>';
  h += '<button class="act g" onclick="saveSession()">✓ Guardar toma y enviar correo (<span id="sessavecount">'+s.items.length+'</span> bienes)</button>';
  v.innerHTML = h; loadThumbs();
}
function renderSesItems(){
  const c=document.getElementById("sesitems"); if(!c){ render(); return; }
  c.innerHTML = curSes.items.map(sesItemCard).join("");
  const cc=document.getElementById("sescount"); if(cc) cc.textContent=curSes.items.length;
  const sc=document.getElementById("sessavecount"); if(sc) sc.textContent=curSes.items.length;
  loadThumbs();
}
function openTarjetaPicker(){
  const list = tarjetasActivas();
  let h = '<div class="grip"></div><h3>Elegir tarjeta existente</h3>'
    + '<div class="fld"><input id="tpq" type="text" placeholder="Buscar por número o nombre…" oninput="filterTpick()" style="width:100%;padding:11px 13px;border:1.5px solid #E2E6EC;border-radius:10px;font-size:16px"></div>'
    + '<div id="tpicklist">' + list.map(tpickRow).join("") + '</div>'
    + '<button class="act o" onclick="closeMenu()">Cancelar</button>';
  document.getElementById("sheet").innerHTML = h;
  showSheet();
  setTimeout(function(){ const q=document.getElementById("tpq"); if(q) q.focus(); },150);
}
function tpickRow(t){
  return '<div class="tlist-item" onclick="pickTarjeta(\''+t.id+'\')"><div><b>'+esc(t.responsable||"(sin nombre)")+'</b>'
    +'<small>Tarjeta '+esc(t.numero||"(pendiente)")+' · '+esc(t.puesto||"")+'</small></div><span style="color:#B8C0CC">›</span></div>';
}
function filterTpick(){
  const q = document.getElementById("tpq").value.toLowerCase();
  const list = tarjetasActivas().filter(function(t){
    return (t.numero||"").toLowerCase().indexOf(q)>=0 || (t.responsable||"").toLowerCase().indexOf(q)>=0;
  });
  document.getElementById("tpicklist").innerHTML = list.map(tpickRow).join("") || '<div class="empty">Sin resultados</div>';
}
function pickTarjeta(id){
  const t = TARJETAS[id]; if(!t) return;
  curSes.tarjetaId=id; curSes.numero=t.numero||""; curSes.persona=t.responsable||""; curSes.empleado=t.empleado||""; curSes.correo=t.correo||"";
  closeMenu(); render();
}

/* ================= FUSIONAR TARJETAS DUPLICADAS ================= */
let _fusion = {origen:null, destino:null};
function abrirFusion(){ _fusion = {origen:null, destino:null}; renderFusionSheet(); }
function renderFusionSheet(){
  const list = tarjetasActivas();
  function rowFor(t, campo){
    const items = bienesDe(t.id);
    return '<div class="tlist-item" onclick="fusionElegir(\''+campo+'\',\''+t.id+'\')"><div><b>'+esc(t.responsable||"(sin nombre)")+'</b>'
      +'<small>Tarjeta '+esc(t.numero||"(pendiente)")+' · '+items.length+' bien(es)</small></div><span style="color:#B8C0CC">›</span></div>';
  }
  let h = '<div class="grip"></div><h3>🔀 Fusionar tarjetas duplicadas</h3>'
    +'<div class="note">Use esto cuando la misma persona quedó con dos tarjetas (por escribir el nombre distinto, por ejemplo). Todos los bienes de la tarjeta A pasan a la tarjeta B, y A queda inactiva (no se borra, por auditoría).</div>';
  h += '<label style="font-size:12px;font-weight:700;color:#5B6470;display:block;margin-top:10px">Tarjeta A (la que sobra)</label>';
  if(_fusion.origen){ const t=TARJETAS[_fusion.origen]; h += '<div class="tpickbtn" style="margin:6px 0 10px">'+esc(t.responsable)+' — Tarjeta '+esc(t.numero||"(pendiente)")+'</div>'; }
  else { h += '<div>'+list.map(function(t){return rowFor(t,'origen');}).join("")+'</div>'; }
  if(_fusion.origen){
    h += '<label style="font-size:12px;font-weight:700;color:#5B6470;display:block;margin-top:10px">Tarjeta B (a la que se une todo)</label>';
    if(_fusion.destino){ const t=TARJETAS[_fusion.destino]; h += '<div class="tpickbtn" style="margin:6px 0 10px">'+esc(t.responsable)+' — Tarjeta '+esc(t.numero||"(pendiente)")+'</div>'; }
    else { h += '<div>'+list.filter(function(t){return t.id!==_fusion.origen;}).map(function(t){return rowFor(t,'destino');}).join("")+'</div>'; }
  }
  if(_fusion.origen && _fusion.destino){ h += '<button class="act n" onclick="confirmarFusion()">Fusionar ahora</button>'; }
  h += '<button class="act o" onclick="closeMenu()">Cancelar</button>';
  document.getElementById("sheet").innerHTML = h;
  showSheet();
}
function fusionElegir(campo,id){ _fusion[campo]=id; renderFusionSheet(); }
function confirmarFusion(){
  const origen = TARJETAS[_fusion.origen], destino = TARJETAS[_fusion.destino];
  if(!origen || !destino) return;
  if(!confirm('¿Mover todos los bienes de "'+origen.responsable+'" (Tarj. '+(origen.numero||"pendiente")+') a "'+destino.responsable+'" (Tarj. '+(destino.numero||"pendiente")+')? No se puede deshacer.')) return;
  const items = bienesDe(origen.id);
  const batch = db.batch();
  items.forEach(function(b){
    batch.update(db.collection("bienes").doc(b.id), {
      tarjetaId: destino.id, tarjetaNumero: destino.numero||"", responsable: destino.responsable,
      actualizado: firebase.firestore.FieldValue.serverTimestamp()
    });
    const movRef = db.collection("movimientos").doc();
    batch.set(movRef, { codigo:b.codigo, tipoMovimiento:"FUSION_TARJETAS",
      tarjetaAnteriorNumero: origen.numero||"", responsableAnterior: origen.responsable,
      tarjetaNuevaNumero: destino.numero||"", responsableNuevo: destino.responsable,
      estado:b.estado||"", ubicacion:b.ubicacion||"", observaciones:"Fusión de tarjetas duplicadas",
      fecha: firebase.firestore.FieldValue.serverTimestamp(), fechaTxt: today(), capturadoPor: META.by||"" });
  });
  batch.update(db.collection("tarjetas").doc(origen.id), {activa:false, actualizada: firebase.firestore.FieldValue.serverTimestamp()});
  batch.commit().then(function(){ toast("Fusionadas ✓ ("+items.length+" bienes movidos)"); closeMenu(); goHome(); })
    .catch(function(){ toast("No se pudo fusionar"); });
}

function buscarBienPorCodigoOSiges(raw){
  const cn = bienDocId(raw);
  if(BIENES[cn]) return BIENES[cn];
  const n = norm(raw);
  return Object.values(BIENES).find(function(b){ return b.codigoSiges && norm(b.codigoSiges)===n; }) || null;
}
function addInv(){
  const el = document.getElementById("invin"); const raw = (el?el.value:"").trim(); if(!raw) return;
  const existing = buscarBienPorCodigoOSiges(raw);
  const cn = existing ? existing.id : bienDocId(raw);
  if(curSes.items.some(function(it){ return bienDocId(it.codigo)===cn; })){
    toast("Ese bien ya está en la lista de esta toma");
    el.value=""; el.focus();
    return;
  }
  const item = { iid: "i"+Date.now()+Math.random().toString(36).slice(2,6), codigo: existing? existing.codigo : raw,
    desc: existing? existing.descripcion : "", valor: existing? existing.valor:0,
    esNuevo: !existing,
    estabaPendiente: !!(existing && !existing.tarjetaId),
    origenTarjetaId: existing? existing.tarjetaId : null,
    origenTarjetaNumero: existing? existing.tarjetaNumero : "",
    origenResponsable: existing? existing.responsable : "",
    tipoOrig: existing? existing.tipo : "INDIVIDUAL",
    estado: existing? (existing.estado||"") : "",
    obs: existing? (existing.observaciones||"") : "",
    foto:0 };
  curSes.items.unshift(item);
  el.value=""; renderSesItems(); el.focus();
  // El bien ya es el mismo bien físico: si ya tenía foto guardada, se trae para que no se pierda al reasignarlo
  if(existing && existing.fotoBien){
    fotoGet("B"+existing.id).then(function(r){
      if(!r) return;
      return fotoPut({k:"A"+item.iid, b64:r.b64, name:r.name, ts:Date.now()}).then(function(){
        item.foto = 1; item.fotoB64 = r.b64; item.fotoName = r.name;
        if(existing.fotoUrl) item.fotoUrl = existing.fotoUrl;
        renderSesItems();
      });
    }).catch(function(){});
  }
}
function asignarPendiente(id){
  const b = BIENES[id]; if(!b) return;
  newSession();
  setTimeout(function(){
    const el = document.getElementById('invin');
    if(el){ el.value = b.codigo; addInv(); }
  }, 60);
}
function sesItemCard(it){
  let badge;
  if(it.esNuevo){ badge='<span class="chip c-hz">NUEVO · no está en el sistema</span>'; }
  else if(it.estabaPendiente){ badge='<span class="chip c-ind">PENDIENTE · se asigna ahora por primera vez</span>'; }
  else {
    let esTraslado;
    if(curSes.tipo==="nueva"){ esTraslado = true; }
    else { esTraslado = it.origenTarjetaId !== curSes.tarjetaId; }
    badge = '<span class="chip '+(esTraslado?"c-dup":"c-ind")+'">'+(esTraslado?"TRASLADO":"YA ESTABA AQUÍ")+'</span>'
      + '<div class="powner">Estaba cargado a: '+esc(it.origenResponsable||"—")+' (Tarj. '+esc(it.origenTarjetaNumero||"—")+')</div>';
  }
  return '<div class="item" style="border-left-color:'+(it.esNuevo?"#B5651D":"#1F3864")+'">'
    +'<div class="itop"><span class="inv">'+esc(it.codigo)+'</span></div>'
    +'<div class="ochips">'+badge+'</div>'
    +(it.esNuevo
      ? '<input type="text" value="'+esc(it.desc||"")+'" oninput="sesItemDesc(\''+it.iid+'\',this.value)" placeholder="Descripción del bien *" style="width:100%;padding:9px 11px;border:1.4px solid #E2E6EC;border-radius:9px;font-size:14px;margin:4px 0 2px">'
      : (it.desc?'<div class="desc">'+esc(it.desc)+'</div>':''))
    +'<div class="bgrp estado">'
      +['BUENO','REGULAR','MALO','PARA BAJA'].map(function(e){ const cl=e==="PARA BAJA"?"baja":e.toLowerCase();
        return '<button class="btn est e-'+cl+' '+(it.estado===e?"sel":"")+'" onclick="sesItemEstado(\''+it.iid+'\',\''+e+'\')">'+(e==="PARA BAJA"?"Baja":e.charAt(0)+e.slice(1).toLowerCase())+'</button>'; }).join("")
    +'</div>'
    +'<div class="tools"><button class="fotobtn" id="fb_A'+it.iid+'" onclick="takePhoto(\'A'+it.iid+'\')">📷 Foto</button>'
      +'<img class="thumb" id="th_A'+it.iid+'" style="display:none" onclick="viewPhoto(\'A'+it.iid+'\')">'
       +(it.fotoUrl?'<a class="drivefoto" href="'+it.fotoUrl+'" target="_blank" rel="noopener"><img class="dthumb" src="'+driveThumbUrl(it.fotoUrl)+'" loading="lazy" alt="foto">🖼️ Ver foto</a>':'')
      +'<span class="moretog" style="color:var(--rojo)" onclick="delSesItem(\''+it.iid+'\')">🗑 Quitar</span></div>'
    +'<div class="extra open" style="margin-top:8px"><input type="text" value="'+esc(it.obs||"")+'" oninput="sesItemObs(\''+it.iid+'\',this.value)" placeholder="Observación (opcional)"></div>'
  +'</div>';
}
function sesItemEstado(iid,val){ const it=curSes.items.find(function(x){return x.iid===iid;}); if(!it) return; it.estado = it.estado===val?"":val; renderSesItems(); }
function sesItemObs(iid,val){ const it=curSes.items.find(function(x){return x.iid===iid;}); if(it) it.obs=val; }
function sesItemDesc(iid,val){ const it=curSes.items.find(function(x){return x.iid===iid;}); if(it) it.desc=val; }
function delSesItem(iid){ curSes.items = curSes.items.filter(function(x){return x.iid!==iid;}); fotoDel("A"+iid); renderSesItems(); }
function tarjetaDocId(numero){ return (numero && String(numero).trim()) ? bienDocId(numero) : null; }
function buscarTarjetaPorNombre(nombre){
  const n = norm(nombre);
  if(!n) return null;
  return Object.values(TARJETAS).find(function(t){ return t.activa!==false && norm(t.responsable)===n; }) || null;
}
function resolverTarjetaDestino(s){
  if(s.tipo==="existente" && s.tarjetaId){
    return db.collection("tarjetas").doc(s.tarjetaId).set({
      responsable: s.persona, empleado: s.empleado||"", correo: s.correo||"",
      actualizada: firebase.firestore.FieldValue.serverTimestamp()
    }, {merge:true}).then(function(){ return {id:s.tarjetaId, numero:s.numero||""}; });
  }
  let tid = tarjetaDocId(s.numero);
  let numeroFinal = s.numero||"";
  if(!tid){
    const previa = buscarTarjetaPorNombre(s.persona);
    if(previa){ tid = previa.id; numeroFinal = previa.numero||""; }
    else { tid = "PEND_"+bienDocId(s.persona); }
  }
  const ref = db.collection("tarjetas").doc(tid);
  return ref.set({
    numero: numeroFinal, responsable: s.persona, empleado: s.empleado||"", correo: s.correo||"",
    puesto: "", tipo: "INDIVIDUAL", activa: true,
    creada: firebase.firestore.FieldValue.serverTimestamp(), actualizada: firebase.firestore.FieldValue.serverTimestamp()
  }, {merge:true}).then(function(){ return {id:ref.id, numero:numeroFinal}; });
}
function saveSession(){
  const s = curSes;
  if(!s.persona || !s.persona.trim()){ toast("Escriba el nombre del responsable"); return; }
  if(!s.loc){ toast("Elija la ubicación"); return; }
  if(s.items.length===0){ toast("Agregue al menos un número de bien"); return; }
  toast("Guardando…");
  resolverTarjetaDestino(s).then(function(dest){
    const batch = db.batch();
    const nowTxt = today();
    s.items.forEach(function(it){
      const cn = bienDocId(it.codigo);
      const ref = db.collection("bienes").doc(cn);
      const huboTraslado = !it.esNuevo && it.origenTarjetaId && it.origenTarjetaId!==dest.id;
      const tieneFoto = !!(it.fotoB64 || it.foto);
      const datosBien = {
        codigo: it.codigo, descripcion: it.desc||it.codigo, valor: it.valor||0,
        tarjetaId: dest.id, tarjetaNumero: dest.numero||"", responsable: s.persona,
        tipo: it.esNuevo? "INDIVIDUAL": (it.tipoOrig||"INDIVIDUAL"),
        ubicacion: s.loc, estado: it.estado||"", existe: "SÍ",
        fechaVerificacion: nowTxt, verificadoPor: META.by||"",
        esNuevo: !!it.esNuevo, observaciones: it.obs||"", notaDuplicado: "",
        tarjetaAnteriorNumero: huboTraslado? (it.origenTarjetaNumero||"") : "",
        responsableAnterior: huboTraslado? (it.origenResponsable||"") : "",
        actualizado: firebase.firestore.FieldValue.serverTimestamp()
      };
      if(tieneFoto) datosBien.fotoBien = 1;
      if(it.fotoUrl) datosBien.fotoUrl = it.fotoUrl;
      batch.set(ref, datosBien, {merge:true});
      const movRef = db.collection("movimientos").doc();
      batch.set(movRef, {
        codigo: it.codigo, tipoMovimiento: it.esNuevo?"HALLAZGO_ASIGNADO":"REASIGNACION",
        tarjetaAnteriorNumero: it.origenTarjetaNumero||"", responsableAnterior: it.origenResponsable||"",
        tarjetaNuevaNumero: dest.numero||"", responsableNuevo: s.persona,
        estado: it.estado||"", ubicacion: s.loc, observaciones: it.obs||"",
        fecha: firebase.firestore.FieldValue.serverTimestamp(), fechaTxt: nowTxt, capturadoPor: META.by||""
      });
      // Mover la foto de la toma (clave temporal) a la clave permanente del bien, para que no se pierda al ver el bien después
      if(it.fotoB64){
        fotoPut({k:"B"+cn, b64:it.fotoB64, name: it.fotoName||("BIEN_"+cn+".jpg"), ts:Date.now()});
        fotoDel("A"+it.iid);
      } else if(it.foto){
        fotoGet("A"+it.iid).then(function(r){
          if(r){ fotoPut({k:"B"+cn, b64:r.b64, name:r.name, ts:Date.now()}); fotoDel("A"+it.iid); }
        }).catch(function(){});
      }
    });
    return batch.commit().then(function(){ return dest; });
  }).then(function(dest){
    toast("Toma guardada ✓ ("+s.items.length+" bienes)");
    return notificarPersona(s, dest.numero||"");
  }).then(function(){
    curSes = null; goHome();
  }).catch(function(e){
    toast("No se pudo guardar: "+(e.message||e));
  });
}
function notificarPersona(s, numeroReal){
  if(!s || !s.correo){ return Promise.resolve(); }
  if(!META.gsUrl){ toast("⚠️ Bienes guardados, pero falta configurar Apps Script para enviar el correo (menú ☰)"); return Promise.resolve(); }
  const itemsMail = s.items.map(function(it){
    return { codigo: it.codigo, desc: it.desc||"", valor: Number(it.valor||0), estado: it.estado||"", fotoUrl: it.fotoUrl||"" };
  });
  const detalle = s.items.map(function(it){
    return "• "+it.codigo+(it.desc?(" — "+it.desc):"")+(it.valor?(" — Q"+Number(it.valor).toLocaleString("es-GT",{minimumFractionDigits:2})):"")
      +(it.estado?(" — Estado: "+it.estado):"");
  }).join("\n");
  // Recolectar fotos: preferir el b64 en memoria (tomado en esta sesión); si no, leer de IndexedDB
  const fotoPromesas = [];
  s.items.forEach(function(it){
    if(it.fotoB64){ fotoPromesas.push(Promise.resolve({name: it.fotoName||("BIEN_"+it.codigo+".jpg"), b64: it.fotoB64})); }
    else if(it.foto){ fotoPromesas.push(fotoGet("A"+it.iid).then(function(r){ return r?{name:r.name,b64:r.b64}:null; }).catch(function(){return null;})); }
  });
  if(s.fotoB64){ fotoPromesas.push(Promise.resolve({name: s.fotoName||"LUGAR.jpg", b64: s.fotoB64})); }
  else if(s.foto){ fotoPromesas.push(fotoGet("Lses").then(function(r){ return r?{name:r.name,b64:r.b64}:null; }).catch(function(){return null;})); }
  const conFoto = fotoPromesas.length;
  return Promise.all(fotoPromesas).then(function(fotos){
    const payload = { type:"notificar", correo:s.correo, persona:s.persona, tarjeta:numeroReal||"(pendiente)",
      ubicacion:s.loc, fecha: today(), capturadoPor: META.by||"", detalle: detalle, items: itemsMail,
      fotos: fotos.filter(Boolean) };
    return fetch(META.gsUrl, {method:"POST", body: JSON.stringify(payload)});
  }).then(function(r){
    return r.json().catch(function(){ return null; });
  }).then(function(j){
    if(j && j.ok===false){ toast("⚠️ Los bienes SÍ se guardaron, pero Apps Script no pudo enviar el correo: "+(j.error||"error desconocido")); return; }
    toast("✉️ Correo enviado a "+s.correo+(conFoto?" con "+conFoto+" foto(s)":""));
  }).catch(function(e){
    toast("⚠️ Los bienes SÍ se guardaron, pero el correo no se pudo enviar (revise conexión/Apps Script)");
  });
}

/* ================= FOTOS (cámara + IndexedDB) ================= */
let idb=null;
function openIDB(){ return new Promise(function(res,rej){
  if(idb) return res(idb);
  const rq = indexedDB.open("inv_fotos_ai_v3",1);
  rq.onupgradeneeded=function(e){ e.target.result.createObjectStore("fotos",{keyPath:"k"}); };
  rq.onsuccess=function(e){ idb=e.target.result; res(idb); };
  rq.onerror=function(e){ rej(e); };
});}
function fotoPut(rec){ return openIDB().then(function(d2){ return new Promise(function(res,rej){
  const tx=d2.transaction("fotos","readwrite"); tx.objectStore("fotos").put(rec); tx.oncomplete=res; tx.onerror=rej; }); }); }
function fotoGet(k){ return openIDB().then(function(d2){ return new Promise(function(res,rej){
  const rq=d2.transaction("fotos").objectStore("fotos").get(k); rq.onsuccess=function(){res(rq.result||null);}; rq.onerror=rej; }); }); }
function fotoDel(k){ return openIDB().then(function(d2){ return new Promise(function(res,rej){
  const tx=d2.transaction("fotos","readwrite"); tx.objectStore("fotos").delete(k); tx.oncomplete=res; tx.onerror=rej; }); }); }
let camTarget=null;
function takePhoto(k){ camTarget=k; const c=document.getElementById("camin"); c.value=""; c.click(); }
document.getElementById("camin").addEventListener("change", function(){
  const f=this.files&&this.files[0]; if(!f||!camTarget) return;
  const tgt = camTarget;
  compressImage(f,function(b64){
    const name = fotoName(tgt);
    // Guardar el b64 en memoria para que el correo no dependa de releer IndexedDB
    if(tgt[0]==="A" && curSes){ const it=curSes.items.find(function(x){return x.iid===tgt.slice(1);}); if(it){ it.fotoB64=b64; it.fotoName=name; } }
    else if(tgt==="Lses" && curSes){ curSes.fotoB64=b64; curSes.fotoName=name; }
    fotoPut({k:tgt,b64:b64,name:name,ts:Date.now()}).then(function(){
      marcarFotoFlag(tgt);
      toast("Foto guardada ✓"); refreshFotoUI(tgt);
      subirFoto(name,b64).then(function(url){
        if(!url) return;
        if(tgt[0]==="B"){ db.collection("bienes").doc(tgt.slice(1)).update({fotoUrl:url}).catch(function(){}); }
        else if(tgt[0]==="A" && curSes){ const it=curSes.items.find(function(x){return x.iid===tgt.slice(1);}); if(it) it.fotoUrl=url; }
        else if(tgt[0]==="H"){ db.collection("hallazgos").doc(tgt.slice(1)).update({fotoUrl:url}).catch(function(){}); }
        else if(tgt==="Lses" && curSes){ curSes.fotoUrl=url; }
      });
    }).catch(function(){ toast("No se pudo guardar la foto"); });
  });
});

/* ================= IMPORTAR BIENES NUEVOS DESDE EXCEL ================= */
document.getElementById("excelin").addEventListener("change", function(){
  const f = this.files && this.files[0]; const self=this; if(!f) return;
  toast("Leyendo archivo…");
  const rd = new FileReader();
  rd.onload = function(e){
    try{
      const wb = XLSX.read(e.target.result, {type:"array"});
      const elegida = elegirMejorHoja(wb);
      if(!elegida){ toast("No encontré una hoja con una columna de No. de Inventario reconocible."); return; }
      procesarFilasImportadas(elegida.rows, elegida.nombre, wb.SheetNames.length);
    }catch(err){ toast("No se pudo leer el archivo: "+(err.message||err)); }
    self.value="";
  };
  rd.readAsArrayBuffer(f);
});
function elegirMejorHoja(wb){
  let mejor = null;
  wb.SheetNames.forEach(function(nombre){
    const ws = wb.Sheets[nombre];
    const rows = XLSX.utils.sheet_to_json(ws, {defval:""});
    if(!rows.length) return;
    const {colCod} = leerColumnas(rows);
    if(!colCod) return;
    const validas = rows.filter(function(r){ return esCodigoValido(r[colCod]); }).length;
    if(!mejor || validas > mejor.validas){ mejor = {nombre:nombre, rows:rows, validas:validas}; }
  });
  return mejor;
}
function esCodigoValido(v){
  const s = String(v==null?"":v).trim();
  if(!s) return false;
  if(s.length>20) return false;
  if((s.match(/ /g)||[]).length>1) return false;
  return true;
}
function hallarColumna(row, claves){
  const keys = Object.keys(row);
  for(let i=0;i<keys.length;i++){
    const kn = keys[i].toUpperCase().trim();
    for(let j=0;j<claves.length;j++){ if(kn===claves[j]) return keys[i]; }
  }
  for(let i=0;i<keys.length;i++){
    const kn = keys[i].toUpperCase();
    for(let j=0;j<claves.length;j++){ if(claves[j].length>=4 && kn.indexOf(claves[j])>=0) return keys[i]; }
  }
  return null;
}
function leerColumnas(rows){
  const first = rows[0];
  const colCod = hallarColumna(first, ["NO_BIEN","INVENTARIO","CÓDIGO","CODIGO","NO."]);
  const colDesc = hallarColumna(first, ["DESCRIPCION","DESCRIP"]);
  const colVal = hallarColumna(first, ["MONTO","VALOR","PRECIO","COSTO"]);
  const colNombre = hallarColumna(first, ["NOMBRE"]);
  const colTarjeta = hallarColumna(first, ["TARJETA"]);
  const colSiges = hallarColumna(first, ["BIESIC","SIGES"]);
  return {colCod, colDesc, colVal, colNombre, colTarjeta, colSiges};
}
function procesarFilasImportadas(rows, nombreHoja, totalHojas){
  if(!rows.length){ toast("El archivo no tiene filas de datos"); return; }
  const {colCod, colDesc, colVal, colSiges} = leerColumnas(rows);
  if(!colCod){ toast("No encontré una columna de No. de Inventario en el archivo"); return; }
  const nuevos = []; let vacios=0, existentes=0, invalidos=0;
  const vistos = {};
  rows.forEach(function(r){
    const cod = String(r[colCod]==null?"":r[colCod]).trim();
    if(!cod){ vacios++; return; }
    if(!esCodigoValido(cod)){ invalidos++; return; }
    const id = bienDocId(cod);
    if(vistos[id]) return; vistos[id]=1;
    if(BIENES[id]){ existentes++; return; }
    nuevos.push({ id:id, codigo:cod,
      codigoSiges: colSiges? String(r[colSiges]==null?"":r[colSiges]).trim() : "",
      descripcion: colDesc? String(r[colDesc]==null?"":r[colDesc]).trim() : "",
      valor: colVal? (Number(r[colVal])||0) : 0 });
  });
  if(nuevos.length===0){ toast("No hay bienes nuevos para importar (¿ya estaban todos en el sistema?)"); return; }
  document.getElementById("sheet").innerHTML = '<div class="grip"></div><h3>Confirmar importación</h3>'
    +(totalHojas>1?'<div class="note">Se leyó la hoja "<b>'+esc(nombreHoja)+'</b>" (el archivo tiene '+totalHojas+' hojas).</div>':'')
    +'<div class="note">Se importarán <b>'+nuevos.length+'</b> bien(es) nuevo(s), pendientes de asignar.'
    +(existentes?('<br>'+existentes+' número(s) ya existían en el sistema y se omiten (no se sobrescriben).'):'')
    +(vacios?('<br>'+vacios+' fila(s) sin número de inventario, se omiten.'):'')
    +(invalidos?('<br>'+invalidos+' fila(s) con un valor que no parece número de inventario, se omiten.'):'')+'</div>'
    +'<div style="max-height:220px;overflow:auto;border:1px solid #E2E6EC;border-radius:9px;margin-top:8px">'
    + nuevos.slice(0,30).map(function(n){ return '<div style="padding:8px 10px;border-bottom:1px solid #F0F2F6;font-size:13px"><b>'+esc(n.codigo)+'</b> — '+esc(n.descripcion||"(sin descripción)")+'</div>'; }).join("")
    + (nuevos.length>30?('<div style="padding:8px 10px;font-size:12px;color:#8A929C">…y '+(nuevos.length-30)+' más</div>'):'')
    +'</div>'
    +'<button class="act g" onclick="confirmarImportacion()">✓ Importar '+nuevos.length+' bien(es)</button>'
    +'<button class="act o" onclick="closeMenu()">Cancelar</button>';
  window.__importPend = nuevos;
  showSheet();
}
function confirmarImportacion(){
  const nuevos = window.__importPend||[];
  if(!nuevos.length) return;
  closeMenu();
  toast("Importando "+nuevos.length+" bien(es)…");
  function chunk(arr,n){ const out=[]; for(let i=0;i<arr.length;i+=n) out.push(arr.slice(i,i+n)); return out; }
  const chunks = chunk(nuevos,400);
  let i=0;
  function next(){
    if(i>=chunks.length){ toast("✓ Importación completa ("+nuevos.length+" bienes)"); window.__importPend=null; goHome(); return; }
    const batch = db.batch();
    chunks[i].forEach(function(n){
      batch.set(db.collection("bienes").doc(n.id), {
        codigo:n.codigo, codigoSiges:n.codigoSiges||"", descripcion:n.descripcion||n.codigo, valor:n.valor||0,
        tarjetaId:null, tarjetaNumero:"", responsable:"",
        tipo:"INDIVIDUAL", ubicacion:"", estado:"", existe:"", fechaVerificacion:"", verificadoPor:"",
        esNuevo:true, observaciones:"", notaDuplicado:"", fotoBien:0,
        actualizado: firebase.firestore.FieldValue.serverTimestamp()
      }, {merge:true});
    });
    i++;
    batch.commit().then(next).catch(function(e){ toast("Error al importar: "+(e.message||e)); });
  }
  next();
}
function importarExcel(){
  closeMenu();
  if(typeof XLSX==="undefined"){ toast("No se pudo cargar el lector de Excel (revise internet)"); return; }
  window.__excelMode = "importar";
  document.getElementById("sheet").innerHTML = '<div class="grip"></div><h3>📥 Importar bienes desde Excel</h3>'
    +'<div class="note">El archivo debe tener columnas con <b>No. de Inventario</b>, <b>Descripción</b> y opcionalmente <b>Valor</b>. No importa el nombre exacto de la columna ni el orden, la app las reconoce sola. Los bienes se crean <b>sin responsable</b> — después los asigna con 🧍 Nueva toma. Esta opción solo AGREGA, nunca elimina nada.</div>'
    +'<button class="act p" onclick="document.getElementById(\'excelin\').click()">📎 Elegir archivo Excel</button>'
    +'<button class="act o" onclick="closeMenu()">Cancelar</button>';
  showSheet();
}
function compressImage(file,cb){
  const rd=new FileReader();
  rd.onload=function(){ const img=new Image();
    img.onload=function(){
      const MAX=1100; let w=img.width,h=img.height;
      if(w>h && w>MAX){ h=Math.round(h*MAX/w); w=MAX; } else if(h>=w && h>MAX){ w=Math.round(w*MAX/h); h=MAX; }
      const cv=document.createElement("canvas"); cv.width=w; cv.height=h;
      cv.getContext("2d").drawImage(img,0,0,w,h);
      cb(cv.toDataURL("image/jpeg",0.65).split(",")[1]);
    };
    img.onerror=function(){ toast("Imagen no válida"); };
    img.src=rd.result;
  };
  rd.readAsDataURL(file);
}
function sanit(s){ return String(s||"").replace(/[^A-Za-z0-9._-]/g,"_").slice(0,40); }
function fotoName(k){
  if(k[0]==="B"){ const b=BIENES[k.slice(1)]; return "INV_"+sanit(b?b.codigo:k.slice(1))+"_T"+sanit(b?b.tarjetaNumero:"")+".jpg"; }
  if(k[0]==="H"){ return "HALLAZGO_"+sanit(k.slice(1))+".jpg"; }
  if(k==="Lses"){ return "LUGAR_"+sanit(curSes?curSes.loc:"")+"_"+sanit(curSes?curSes.persona:"")+"_"+Date.now()+".jpg"; }
  if(k[0]==="A"){ const it=curSes?curSes.items.find(function(x){return x.iid===k.slice(1);}):null; return "BIEN_"+sanit(it?it.codigo:k.slice(1))+"_"+sanit(curSes?curSes.persona:"")+".jpg"; }
  return "FOTO_"+sanit(k)+".jpg";
}
function marcarFotoFlag(k){
  if(k[0]==="B"){ db.collection("bienes").doc(k.slice(1)).update({fotoBien:1}).catch(function(){}); }
  else if(k[0]==="H"){ db.collection("hallazgos").doc(k.slice(1)).update({foto:1}).catch(function(){}); }
  else if(k[0]==="A" && curSes){ const it=curSes.items.find(function(x){return x.iid===k.slice(1);}); if(it) it.foto=1; }
  else if(k==="Lses" && curSes){ curSes.foto=1; }
}
function driveThumbUrl(u){ if(!u) return ""; var m=String(u).match(/[-\w]{25,}/); return m?("https://drive.google.com/thumbnail?id="+m[0]+"&sz=w160"):""; }
    function refreshFotoUI(k){
  fotoGet(k).then(function(r){
    const btn=document.getElementById("fb_"+k), th=document.getElementById("th_"+k);
    if(btn){ btn.classList.toggle("has",!!r); btn.textContent=r?"📷 ✓":"📷 Foto"; }
    if(th){ if(r){ th.src="data:image/jpeg;base64,"+r.b64; th.style.display=""; } else th.style.display="none"; }
  });
}
function loadThumbs(){ document.querySelectorAll("[id^='fb_']").forEach(function(el){ refreshFotoUI(el.id.slice(3)); }); }
let photoKey=null;
function viewPhoto(k){ photoKey=k; fotoGet(k).then(function(r){ if(!r) return;
  document.getElementById("pmimg").src="data:image/jpeg;base64,"+r.b64;
  document.getElementById("pmodal").classList.add("show"); }); }
function closePhoto(){ document.getElementById("pmodal").classList.remove("show"); }
function retakePhoto(){ closePhoto(); if(photoKey) takePhoto(photoKey); }
function deletePhoto(){ if(!photoKey) return;
  fotoDel(photoKey).then(function(){ closePhoto(); refreshFotoUI(photoKey); toast("Foto eliminada"); }); }
function subirFoto(name,b64){
  if(!META.gsUrl) return Promise.resolve(null);
  return fetch(META.gsUrl,{method:"POST", body: JSON.stringify({type:"foto", name:name, b64:b64})})
    .then(function(r){ return r.json().catch(function(){return null;}); })
    .then(function(j){ return (j && j.url) ? j.url : null; })
    .catch(function(){ return null; });
}

/* ================= APPS SCRIPT (correo + fotos a Drive) ================= */
const GS_CODE =
'function doGet(e){ return _out({ok:true, app:"Inventario AI IGSS", version:5}); }\n'+
'function doPost(e){\n'+
'  try{\n'+
'    var d = JSON.parse(e.postData.contents);\n'+
'    if(d.type === "notificar"){ enviarCorreo(d); return _out({ok:true}); }\n'+
'    else if(d.type === "foto"){ var url = guardarFoto(d.name, d.b64); return _out({ok:true, url:url}); }\n'+
'    else if(d.type === "correoExcel"){ enviarExcelPorCorreo(d); return _out({ok:true}); }\n'+
'    return _out({ok:true});\n'+
'  }catch(err){ return _out({ok:false, error:String(err)}); }\n'+
'}\n'+
'function enviarCorreo(d){\n'+
'  if(!d.correo) return;\n'+
'  var asunto = "IGSS Auditoria Interna: bien(es) cargado(s) a su nombre";\n'+
'  var filas = "";\n'+
'  var items = d.items || [];\n'+
'  for(var i=0;i<items.length;i++){\n'+
'    var it = items[i];\n'+
'    var val = it.valor ? ("Q" + Number(it.valor).toFixed(2)) : "";\n'+
'    var fotoCell = it.fotoUrl ? ("<a href=\\""+it.fotoUrl+"\\" target=\\"_blank\\">Ver foto</a>") : "";\n'+
'    filas += "<tr>"\n'+
'      + "<td style=\\"border:1px solid #ccc;padding:6px 8px;font-weight:bold\\">" + (it.codigo||"") + "</td>"\n'+
'      + "<td style=\\"border:1px solid #ccc;padding:6px 8px\\">" + (it.desc||"(sin descripcion)") + "</td>"\n'+
'      + "<td style=\\"border:1px solid #ccc;padding:6px 8px;text-align:right\\">" + val + "</td>"\n'+
'      + "<td style=\\"border:1px solid #ccc;padding:6px 8px\\">" + (it.estado||"") + "</td>"\n'+
'      + "<td style=\\"border:1px solid #ccc;padding:6px 8px\\">" + fotoCell + "</td>"\n'+
'      + "</tr>";\n'+
'  }\n'+
'  var tabla = "<table style=\\"border-collapse:collapse;width:100%;font-size:13px;margin:10px 0\\">"\n'+
'    + "<tr style=\\"background:#1F3864;color:#fff\\">"\n'+
'    + "<th style=\\"border:1px solid #ccc;padding:6px 8px;text-align:left\\">No. Inventario</th>"\n'+
'    + "<th style=\\"border:1px solid #ccc;padding:6px 8px;text-align:left\\">Descripcion del bien</th>"\n'+
'    + "<th style=\\"border:1px solid #ccc;padding:6px 8px;text-align:right\\">Valor</th>"\n'+
'    + "<th style=\\"border:1px solid #ccc;padding:6px 8px;text-align:left\\">Estado</th>"\n'+
'    + "<th style=\\"border:1px solid #ccc;padding:6px 8px;text-align:left\\">Foto</th>"\n'+
'    + "</tr>" + filas + "</table>";\n'+
'  var html = "<div style=\\"font-family:Arial,sans-serif;color:#222;font-size:14px\\">"\n'+
'    + "<p>Estimado(a) <b>" + d.persona + "</b>,</p>"\n'+
'    + "<p>Le informamos que el/los siguiente(s) bien(es) de inventario ha(n) sido cargado(s) a su tarjeta de responsabilidad:</p>"\n'+
'    + tabla\n'+
'    + "<p><b>Tarjeta No.:</b> " + (d.tarjeta || "(pendiente)") + "<br>"\n'+
'    + "<b>Ubicacion:</b> " + (d.ubicacion || "-") + "<br>"\n'+
'    + "<b>Fecha:</b> " + d.fecha + "<br>"\n'+
'    + "<b>Registrado por:</b> " + (d.capturadoPor || "Auditoria Interna") + "</p>"\n'+
'    + (d.fotos && d.fotos.length ? "<p>Se adjunta(n) " + d.fotos.length + " fotografia(s) de referencia. Tambien puede verlas desde los enlaces de la tabla.</p>" : "")\n'+
'    + "<p style=\\"color:#666\\">Si considera que esta asignacion es incorrecta, comuniquese con Auditoria Interna.<br>"\n'+
'    + "Este es un mensaje automatico, por favor no responda a este correo.</p></div>";\n'+
'  var cuerpo = "Estimado(a) " + d.persona + ",\\n\\n" + (d.detalle||"") + "\\n\\nTarjeta: " + (d.tarjeta||"") + " | Ubicacion: " + (d.ubicacion||"") + " | Fecha: " + d.fecha;\n'+
'  var opciones = { htmlBody: html };\n'+
'  if(d.fotos && d.fotos.length){\n'+
'    opciones.attachments = d.fotos.map(function(f){\n'+
'      var limpio = String(f.b64||"").replace(/^data:image\\/(png|jpe?g);base64,/, "");\n'+
'      return Utilities.newBlob(Utilities.base64Decode(limpio), "image/jpeg", f.name || "foto_inventario.jpg");\n'+
'    });\n'+
'  }\n'+
'  MailApp.sendEmail(d.correo, asunto, cuerpo, opciones);\n'+
'}\n'+
'function enviarExcelPorCorreo(d){\n'+
'  if(!d.correo || !d.b64) return;\n'+
'  var limpio = String(d.b64||"").replace(/^data:application\\/[^;]+;base64,/, "");\n'+
'  var blob = Utilities.newBlob(Utilities.base64Decode(limpio), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", d.filename || "Inventario.xlsx");\n'+
'  MailApp.sendEmail(d.correo, d.asunto || "Reporte de Inventario - Auditoria Interna", d.cuerpo || "Se adjunta el reporte de inventario generado desde la app.", {attachments:[blob]});\n'+
'}\n'+
'function guardarFoto(nombre, b64){\n'+
'  var CARPETA = "FOTOS_INVENTARIO_AI";\n'+
'  var it = DriveApp.getFoldersByName(CARPETA);\n'+
'  var fol = it.hasNext() ? it.next() : DriveApp.createFolder(CARPETA);\n'+
'  try{ fol.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); }catch(e){}\n'+
'  var viejos = fol.getFilesByName(nombre);\n'+
'  while(viejos.hasNext()){ viejos.next().setTrashed(true); }\n'+
'  var limpio = String(b64||"").replace(/^data:image\\/(png|jpe?g);base64,/, "");\n'+
'  var file = fol.createFile(Utilities.newBlob(Utilities.base64Decode(limpio), "image/jpeg", nombre));\n'+
'  return file.getUrl();\n'+
'}\n'+
'function _out(o){ return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }';

/* ================= MENÚ ================= */
function openMenu(){
  document.getElementById("sheet").innerHTML =
    '<div class="grip"></div><h3>Menú</h3>'
    +'<div class="fld"><label>👤 ¿Quién realiza el inventario? (se anota en cada bien)</label>'
      +'<input id="byin" type="text" value="'+esc(META.by||"")+'" placeholder="Su nombre" oninput="META.by=this.value; saveMeta();"></div>'
    +'<div class="fld" style="margin-top:14px"><label>✉️ URL de Apps Script (correos y fotos a Drive)</label>'
      +'<input id="gsin" type="url" value="'+esc(META.gsUrl||"")+'" placeholder="https://script.google.com/macros/s/…/exec" oninput="META.gsUrl=this.value; saveMeta();"></div>'
    +'<div class="mitem" onclick="verCodigoGS()"><span class="ic">📋</span><div><b>Ver código para Apps Script</b><small>Cópielo y péguelo una sola vez</small></div></div>'
    +'<div class="mitem" onclick="probarGS()"><span class="ic">🔌</span><div><b>Probar conexión de correo/fotos</b><small>'+(META.gsUrl?"Configurado":"Sin configurar")+'</small></div></div>'
    +'<div class="mitem" onclick="enviarCorreoPrueba()"><span class="ic">📧</span><div><b>Enviar correo de prueba (con foto)</b><small>Para confirmar que la foto sí llega adjunta</small></div></div>'
    +'<div class="mitem" onclick="abrirFusion()"><span class="ic">🔀</span><div><b>Fusionar tarjetas duplicadas</b><small>Si la misma persona quedó con dos tarjetas</small></div></div>'
    +'<div class="mitem" onclick="openExportBackup()"><span class="ic">⬇️</span><div><b>Respaldo CSV (opcional)</b><small>Exportar una copia de lo verificado hasta ahora</small></div></div>'
    +'<div class="mitem" onclick="generarExcel()"><span class="ic">📊</span><div><b>Generar Excel (todos los movimientos)</b><small>Libro con bienes, movimientos, hallazgos y tarjetas</small></div></div>'
    +'<div class="mitem" onclick="importarExcel()"><span class="ic">📥</span><div><b>Importar bienes nuevos desde Excel</b><small>Los crea como pendientes de asignar</small></div></div>'

    +'<div class="mitem" onclick="cerrarSesion()"><span class="ic">🚪</span><div><b>Cerrar sesión</b><small>'+esc(firebase.auth().currentUser?firebase.auth().currentUser.email:"")+'</small></div></div>'
    +'<div class="note">Los datos viven en la nube (Firestore) y se sincronizan solos entre dispositivos, aunque cierre la app. No hace falta exportar para no perderlos — el respaldo es solo un extra.</div>';
  showSheet();
}
function verCodigoGS(){
  document.getElementById("sheet").innerHTML = '<div class="grip"></div><h3>Código para Apps Script</h3>'
    +'<div class="note b">Péguelo en Extensiones → Apps Script de una hoja de Google (aunque no la use para nada más), guarde, e Implemente como Aplicación web con acceso "Cualquier persona". Copie la URL que termina en /exec y péguela en el menú.</div>'
    +'<button class="act p" onclick="copyGS()">📋 Copiar código</button>'
    +'<textarea class="csv" style="height:220px" onclick="this.select()">'+esc(GS_CODE)+'</textarea>'
    +'<button class="act q" onclick="openMenu()">‹ Volver</button>';
  showSheet();
}
function copyGS(){
  if(navigator.clipboard && navigator.clipboard.writeText){
    navigator.clipboard.writeText(GS_CODE).then(function(){ toast("Código copiado ✓"); }).catch(function(){ toast("Selecciónelo y copie manual"); });
  } else toast("Selecciónelo y copie manual");
}
const GS_VERSION_ESPERADA = 5;
function verificarVersionGS(){
  if(!META.gsUrl) return Promise.resolve({ok:false, motivo:"sin-url"});
  return fetch(META.gsUrl,{method:"GET"}).then(function(r){return r.json();}).then(function(j){
    if(!j || !j.ok) return {ok:false, motivo:"sin-conexion"};
    const version = Number(j.version||0);
    if(version < GS_VERSION_ESPERADA) return {ok:false, motivo:"desactualizado", version:version};
    return {ok:true, version:version};
  }).catch(function(){ return {ok:false, motivo:"sin-conexion"}; });
}
function avisoGSDesactualizado(){
  toast("⚠️ El código de Apps Script está desactualizado. ☰ → \"Ver código para Apps Script\" → copiar → pegar en Apps Script → Implementar → Nueva versión.");
}
function probarGS(){
  if(!META.gsUrl){ toast("Primero pegue la URL en el menú"); return; }
  toast("Probando…");
  verificarVersionGS().then(function(r){
    if(r.ok) toast("✓ Conexión correcta (versión "+r.version+")");
    else if(r.motivo==="desactualizado") avisoGSDesactualizado();
    else toast("Sin conexión o mal configurado");
  });
}
function enviarCorreoPrueba(){
  closeMenu();
  if(!META.gsUrl){ toast("Primero pegue la URL de Apps Script"); return; }
  const def = (firebase.auth().currentUser && firebase.auth().currentUser.email) || "";
  pedirTexto("Correo de prueba", "¿A qué correo enviamos la prueba (con foto adjunta)?", def, "email", function(correo){
    if(!correo) return;
    toast("Verificando versión…");
    verificarVersionGS().then(function(r){
      if(!r.ok){ if(r.motivo==="desactualizado") avisoGSDesactualizado(); else toast("⚠️ No se pudo conectar con Apps Script."); return; }
      toast("Enviando correo de prueba…");
      const testB64 = "iVBORw0KGgoAAAANSUhEUgAAADAAAAAwCAYAAABXAvmHAAAACXBIWXMAAAsTAAALEwEAmpwYAAAA0UlEQVR4nO3XMQ6CQBCF4YdaeQEb44m8g6ewsPEy1nZ6BBs9giewsdEjeAJ6D2NhpQ0JZmB2Zwb+xEQTdb+ssMwCJRUYgAvQBXTgfsAA9MCFylwvsLGA57WzgAtwWzsBLwt4rZ2CJws4rB2FBws4rp0HYCyc9Q7My4Nmyz3wKrz1yYznWl94Y8lzL2biuXbAI3PWD8DBcu0FMBmgb8DAn9oZmA3QN2DgxeYd6IEbcAeewNXwrhbwWjsBLxbwXDsBLwt4qp2AJwt4qJ2AhwUcauc7HYA7cKid77QDDsC+dr7TB2SjLYktbMB2AAAAAElFTkSuQmCC";
      const payload = { type:"notificar", correo: correo, persona:"Prueba de sistema",
        tarjeta:"(prueba)", ubicacion:"(prueba de conexión)", fecha: today(), capturadoPor: META.by||"Sistema",
        detalle: "• 512345 — Silla secretarial de prueba — Q450.00 — Estado: BUENO",
        items: [{codigo:"512345", desc:"Silla secretarial de prueba", valor:450, estado:"BUENO"},
                {codigo:"512346", desc:"Escritorio de prueba con gavetas", valor:1200, estado:"REGULAR"}],
        fotos: [{name:"prueba.jpg", b64:testB64}] };
      fetch(META.gsUrl, {method:"POST", body: JSON.stringify(payload)})
        .then(function(r){ return r.json().catch(function(){ return null; }); })
        .then(function(j){
          if(j===null) toast("Enviado (no se pudo leer la respuesta, pero probablemente llegó). Revise "+correo);
          else if(j.ok===false) toast("⚠️ Apps Script respondió con error: "+(j.error||"desconocido"));
          else toast("✓ Enviado. Revise "+correo+" (y la carpeta de spam) en un minuto.");
        })
        .catch(function(){ toast("⚠️ No se pudo conectar. Revise la URL y que el acceso sea 'Cualquier persona'."); });
    });
  });
}
function openExportBackup(){
  closeMenu();
  const head=["No. INVENTARIO","No. TARJETA","RESPONSABLE","EXISTE","ESTADO","UBICACION","OBSERVACIONES","FECHA","VERIFICADO POR"];
  function q(s){ s=(s==null?"":String(s)); return /[",\n]/.test(s)?'"'+s.replace(/"/g,'""')+'"':s; }
  const rows=[head.map(q).join(",")];
  Object.values(BIENES).forEach(function(b){
    rows.push([b.codigo,b.tarjetaNumero,b.responsable,b.existe||"",b.estado||"",b.ubicacion||"",b.observaciones||"",b.fechaVerificacion||"",b.verificadoPor||""].map(q).join(","));
  });
  const csv = "\uFEFF"+rows.join("\r\n");
  const blob = new Blob([csv],{type:"text/csv;charset=utf-8;"});
  const url = URL.createObjectURL(blob); const a=document.createElement("a");
  a.href=url; a.download="respaldo_inventario_"+new Date().toISOString().slice(0,10)+".csv";
  document.body.appendChild(a); a.click();
  setTimeout(function(){URL.revokeObjectURL(url); a.remove();},1500);
  toast("Respaldo descargado ✓");
}

/* ================= GENERAR EXCEL (libro completo) ================= */
function generarExcel(){
  closeMenu();
  if(typeof XLSX==="undefined"){ toast("No se pudo cargar el generador de Excel (revise internet)"); return; }
  toast("Preparando el libro de Excel…");
  db.collection("movimientos").get().then(function(snap){
    const movs = snap.docs.map(function(d){ return d.data(); });
    const wb = XLSX.utils.book_new();

    const base = Object.values(BIENES).sort(function(a,b){return (a.tarjetaNumero||"").localeCompare(b.tarjetaNumero||"");}).map(function(b){
      return {
        "No. Inventario": b.codigo, "No. SIGES": b.codigoSiges||"", "No. Tarjeta": b.tarjetaNumero||"", "Responsable": b.responsable||"",
        "Descripción": b.descripcion||"", "Valor Q": Number(b.valor||0), "Tipo": b.tipo||"",
        "¿Existe?": b.existe||"", "Estado físico": b.estado||"", "Ubicación": b.ubicacion||"", "Colaborador actual": b.colaborador||"",
        "Observaciones": b.observaciones||"", "Fecha verificación": b.fechaVerificacion||"", "Verificado por": b.verificadoPor||"",
        "Descargado de tarjeta": b.tarjetaAnteriorNumero||"", "Responsable anterior": b.responsableAnterior||"",
        "Foto": b.fotoUrl||"", "Nota / revisar": b.notaDuplicado||""
      };
    });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(base), "BASE");

    const tarjs = tarjetasActivas().map(function(t){
      const items = bienesDe(t.id);
      return { "No. Tarjeta": t.numero||"(pendiente)", "Responsable": t.responsable||"", "No. Empleado": t.empleado||"",
        "Correo": t.correo||"", "Puesto": t.puesto||"", "Tipo": t.tipo||"", "Bienes cargados": items.length,
        "Verificados": doneCount(items) };
    });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(tarjs), "TARJETAS");

    const mv = movs.sort(function(a,b){return (a.fechaTxt||"").localeCompare(b.fechaTxt||"");}).map(function(m){
      return { "Código": m.codigo||"", "Tipo movimiento": m.tipoMovimiento||"",
        "Tarjeta anterior": m.tarjetaAnteriorNumero||"", "Responsable anterior": m.responsableAnterior||"",
        "Tarjeta nueva": m.tarjetaNuevaNumero||"", "Responsable nuevo": m.responsableNuevo||"",
        "Existe": m.existe||"", "Estado": m.estado||"", "Ubicación": m.ubicacion||"",
        "Observaciones": m.observaciones||"", "Fecha": m.fechaTxt||"", "Capturado por": m.capturadoPor||"" };
    });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(mv), "MOVIMIENTOS");

    const hz = Object.values(HALLAZGOS).map(function(z){
      return { "No. Inventario": z.inv||"S/N", "Cantidad": z.cant||1, "Descripción": z.desc||"",
        "Con quién / dónde": z.resp||"", "Ubicación": z.ubi||"", "Estado": z.est||"",
        "Observaciones": z.obs||"", "Fecha": z.f||"", "Anotado por": z.by||"" };
    });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(hz), "HALLAZGOS");

    const filename = "Inventario_AI_"+new Date().toISOString().slice(0,10)+".xlsx";
    XLSX.writeFile(wb, filename);
    toast("Excel generado ✓ (revise Descargas)");
    setTimeout(function(){
      pedirTexto("Enviar Excel por correo", "Escriba el correo, o cancele para omitir", "", "email", function(correo){
        if(!correo || !correo.trim()) return;
        if(!META.gsUrl){ toast("Falta configurar Apps Script para enviar correos (menú ☰)"); return; }
        toast("Verificando versión…");
        verificarVersionGS().then(function(r){
          if(!r.ok){
            if(r.motivo==="desactualizado") avisoGSDesactualizado();
            else toast("⚠️ No se pudo conectar con Apps Script.");
            return;
          }
          toast("Enviando Excel por correo…");
          const b64 = XLSX.write(wb, {type:"base64", bookType:"xlsx"});
          fetch(META.gsUrl, {method:"POST", body: JSON.stringify({
            type:"correoExcel", correo: correo.trim(), filename: filename,
            asunto: "Reporte de Inventario - Auditoría Interna",
            cuerpo: "Se adjunta el reporte de inventario generado el "+today()+" desde la app.",
            b64: b64
          })})
            .then(function(r){ return r.json().catch(function(){return null;}); })
            .then(function(j){
              if(j && j.ok===false) toast("⚠️ No se pudo enviar: "+(j.error||"error desconocido"));
              else toast("✉️ Excel enviado a "+correo.trim());
            })
            .catch(function(){ toast("⚠️ No se pudo enviar el correo (revise conexión)"); });
        });
      });
    }, 500);
  }).catch(function(e){
    toast("No se pudo generar: "+(e.message||e));
  });
}
