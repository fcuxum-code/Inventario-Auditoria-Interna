const LOCS = ["Oficinas Centrales","Anexo C.C. z.4","Anexo Torre Café","Archivo General"];
// Ubicaciones con nombre viejo (de antes de unificar "Nueva toma" con el campo rápido de cada bien) -> nombre nuevo
const LOC_ALIASES = {
  "A.I. EDIFICIO OFICINAS CENTRALES": "Oficinas Centrales",
  "ANEXO CENTRO COMERCIAL": "Anexo C.C. z.4",
  "TORRE CAFÉ": "Anexo Torre Café"
};

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
function emptyState(title, sub){
  return '<div class="empty">'+icon('inbox',40,'opacity:.45;margin-bottom:10px')
    +'<div class="emptytitle">'+esc(title)+'</div>'
    +(sub?'<div class="emptysub">'+esc(sub)+'</div>':'')+'</div>';
}
function norm(s){ return String(s==null?"":s).replace(/\s/g,"").toUpperCase(); }
function bienDocId(raw){ return norm(raw).replace(/\//g,"_").slice(0,300); }
function today(){ const d=new Date(); return String(d.getDate()).padStart(2,"0")+"/"+String(d.getMonth()+1).padStart(2,"0")+"/"+d.getFullYear(); }
function chipTipo(tp){ tp=tp||""; if(tp.indexOf("MPUTO")>=0)return '<span class="chip c-comp">CÓMPUTO</span>';
  if(tp.indexOf("BODEGA")>=0||tp.indexOf("GENERAL")>=0)return '<span class="chip c-bod">BODEGA</span>';
  return '<span class="chip c-ind">INDIVIDUAL</span>'; }

/* ================= CATEGORÍA DEL BIEN (estimada por palabras clave de la descripción) =================
   El campo "tipo" (INDIVIDUAL / GENERAL-BODEGA) es sobre custodia, no sobre qué clase de objeto es.
   Como casi todos los bienes reales quedan como "INDIVIDUAL" en ese campo, no sirve para distinguir
   cómputo de mobiliario, etc. Esta categoría se ADIVINA a partir del texto de la descripción — no es
   una clasificación oficial. Si el usuario marca una categoría manual (categoriaManual), esa manda. */
const CATEGORIAS_BIEN = [
  { cod:"COMPUTO", nombre:"Equipo de cómputo", kw:["COMPUTADOR","LAPTOP","NOTEBOOK","MONITOR","IMPRESORA","ESCANER","TECLADO","MOUSE","UPS","NO BREAK","NOBREAK","NO-BREAK","SERVIDOR","ROUTER","SWITCH","TABLET","PROYECTOR","VIDEO BEAM","VIDEOBEAM","DISCO DURO","MEMORIA RAM","ALL IN ONE","ALL-IN-ONE","ORDENADOR","CPU","REGULADOR DE VOLTAJE"] },
  { cod:"MOBILIARIO", nombre:"Mobiliario y equipo de oficina", kw:["ESCRITORIO","SILLA","SILLON","ARCHIVO METAL","ARCHIVADOR","MESA","ESTANTE","LIBRERA","LIBRERO","GABINETE","PERFORADORA","ENGRAPADORA","PIZARRA","CREDENZA","BANCA","BANCO","SOFA","VITRINA","MUEBLE","ANAQUEL","MODULO","COUNTER","MOSTRADOR"] },
  { cod:"COMUNICACION", nombre:"Equipo de comunicación", kw:["TELEFONO","RADIO COMUNICACION","CENTRAL TELEFONICA","FAX","WALKIE"] },
  { cod:"MEDICO", nombre:"Equipo médico", kw:["CAMILLA","TENSIOMETRO","OXIMETRO","ESTERILIZADOR","BASCULA","SILLA DE RUEDAS","ESTETOSCOPIO","GLUCOMETRO","NEBULIZADOR","ELECTROCARDIOGRAFO","EQUIPO MEDICO"] },
  { cod:"ELECTRO", nombre:"Electrodomésticos", kw:["REFRIGERADOR","MICROONDAS","CAFETERA","VENTILADOR","AIRE ACONDICIONADO","MINISPLIT","MINI SPLIT","DISPENSADOR DE AGUA","EXTRACTOR","LICUADORA","HORNO"] },
  { cod:"HERRAMIENTA", nombre:"Herramientas y equipo diverso", kw:["TALADRO","CAJA DE HERRAMIENTA","ESCALERA","EXTINTOR","COMPRESOR","SOLDADORA"] },
  { cod:"VEHICULO", nombre:"Vehículos", kw:["VEHICULO","MOTOCICLETA","MOTONETA","CAMIONETA","PICK UP","PICKUP","MICROBUS","CAMION"] }
];
function normTexto(s){ return String(s||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toUpperCase(); }
function categoriaBien(b){
  if(!b) return { cod:"OTROS", nombre:"Otros / sin clasificar" };
  if(b.categoriaManual){
    const m = CATEGORIAS_BIEN.find(function(c){ return c.cod===b.categoriaManual; });
    if(m) return m;
  }
  const desc = normTexto(b.descripcion);
  for(let i=0;i<CATEGORIAS_BIEN.length;i++){
    const c = CATEGORIAS_BIEN[i];
    if(c.kw.some(function(k){ return desc.indexOf(k)>=0; })) return c;
  }
  return { cod:"OTROS", nombre:"Otros / sin clasificar" };
}
function chipCategoria(b){
  const c = categoriaBien(b);
  const cls = {COMPUTO:"c-comp",MOBILIARIO:"c-bod",COMUNICACION:"c-ind",MEDICO:"c-dup",ELECTRO:"c-hz",HERRAMIENTA:"c-old",VEHICULO:"c-rev",OTROS:""}[c.cod]||"";
  // Sin confirmar se marca con borde punteado (antes se ponía un "?" que parecía un error de dedo).
  const estimada = !b.categoriaManual;
  return '<span class="chip '+cls+(estimada?" cat-est":"")+'" onclick="event.stopPropagation();abrirCategoriaPicker(\''+b.id+'\')"'
    + ' title="'+(estimada?"Categoría estimada por la descripción — toque para confirmarla o corregirla":"Categoría confirmada — toque para cambiarla")+'">'
    + esc(c.nombre.toUpperCase())+'</span>';
}
function abrirCategoriaPicker(id){
  const b = BIENES[id]; if(!b) return;
  const actual = categoriaBien(b).cod;
  let h = '<div class="grip"></div><h3>Categoría de '+esc(b.codigo)+'</h3>'
    + '<div class="hint" style="margin-top:-8px">'+esc(b.descripcion||"")+'</div>';
  if(!puedeEditar()){
    h += '<div class="note">Categoría estimada a partir de la descripción. No tiene permiso de edición para corregirla.</div>';
  } else {
    h += '<div class="note">Se calcula adivinando por palabras clave de la descripción — no es una clasificación oficial. Corríjala si no es correcta.</div>';
    h += CATEGORIAS_BIEN.map(function(c){
      return '<div class="tlist-item" onclick="fijarCategoriaManual(\''+id+'\',\''+c.cod+'\')"><div><b>'+esc(c.nombre)+'</b></div>'+(actual===c.cod?'<span style="color:#2E7D32">✓</span>':'')+'</div>';
    }).join("");
    if(b.categoriaManual) h += '<button class="act o" style="margin-top:8px" onclick="fijarCategoriaManual(\''+id+'\',null)">Quitar corrección (volver a la automática)</button>';
  }
  h += '<button class="act o" onclick="closeMenu()">Cerrar</button>';
  document.getElementById("sheet").innerHTML = h;
  showSheet();
}
function fijarCategoriaManual(id,cod){
  if(!requiereEdicion()) return;
  db.collection("bienes").doc(id).update({categoriaManual: cod||""}).then(function(){ closeMenu(); toast("Categoría actualizada ✓"); }).catch(function(){ toast("No se pudo guardar"); });
}
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

/* ================= ROL DEL USUARIO (editor / lector) ================= */
let MI_ROL = "editor";
function puedeEditar(){ return MI_ROL !== "lector"; }
function requiereEdicion(){
  if(!puedeEditar()){ toast("Su cuenta es de solo lectura — no puede hacer cambios"); return false; }
  return true;
}
function cargarMiRol(uid){
  return db.collection("usuarios").doc(uid).get().then(function(snap){
    MI_ROL = (snap.exists && snap.data().rol) ? snap.data().rol : "editor";
  }).catch(function(){ MI_ROL = "editor"; }).then(function(){ aplicarModoSoloLectura(); });
}
function aplicarModoSoloLectura(){
  const soloLectura = !puedeEditar();
  const fbses=document.getElementById("fbses"), fbhall=document.getElementById("fbhall");
  if(fbses) fbses.style.display = soloLectura? "none":"";
  if(fbhall) fbhall.style.display = soloLectura? "none":"";
  const dot=document.getElementById("rolDot");
  if(dot) dot.style.display = soloLectura? "inline-block":"none";
}

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
    cargarMiRol(user.uid);
    arrancar();
  } else {
    detenerListeners();
    firstSyncDone = false; ready = {t:false,b:false};
    TARJETAS={}; BIENES={}; HALLAZGOS={}; curSes=null; MI_ROL="editor";
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
/* Al guardar en lote (por ejemplo marcar 20 pendientes de una tarjeta) la nube responde
   varias veces seguidas y cada respuesta redibujaba toda la pantalla. Se agrupan en un solo
   dibujado por cuadro de animación: se ve igual de inmediato y trabaja mucho menos. */
let _pedidoRender = false;
function renderPronto(){
  if(_pedidoRender) return;
  _pedidoRender = true;
  requestAnimationFrame(function(){ _pedidoRender = false; render(); });
}
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
    if(firstSyncDone) renderPronto();
  }, function(e){ setSync("off","Error de sincronización"); }));

  _unsubs.push(db.collection("bienes").onSnapshot(function(snap){
    snap.docChanges().forEach(function(ch){
      if(ch.type==="removed"){ delete BIENES[ch.doc.id]; }
      else { BIENES[ch.doc.id] = Object.assign({id:ch.doc.id}, ch.doc.data()); }
    });
    ready.b = true; afterFirstSync();
    if(firstSyncDone){ refreshProgress(); renderPronto(); }
  }, function(e){ setSync("off","Error de sincronización"); }));

  _unsubs.push(db.collection("hallazgos").onSnapshot(function(snap){
    snap.docChanges().forEach(function(ch){
      if(ch.type==="removed"){ delete HALLAZGOS[ch.doc.id]; }
      else { HALLAZGOS[ch.doc.id] = Object.assign({id:ch.doc.id}, ch.doc.data()); }
    });
    if(firstSyncDone && (mode.view==="hall"||mode.q)) renderPronto();
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

/* ================= PANEL DE MÉTRICAS (inicio) ================= */
function statsGlobales(){
  const lista = Object.values(BIENES);
  const total = lista.length;
  const done = totalDone();
  const pct = total? Math.round(done/total*100):0;
  const disc = lista.filter(function(b){ return b.existe==="NO" || b.existe==="NO UBICADO"; }).length;
  const pend = bienesPendientes();
  const pendViejos = pend.filter(function(b){ return chipPendienteViejo(b); }).length;
  const valorTotal = lista.reduce(function(s,b){ return s+Number(b.valor||0); },0);
  const tarjs = tarjetasActivas();
  const as400Ok = tarjs.filter(function(t){ return t.as400Actualizado; }).length;
  return { total:total, done:done, pct:pct, disc:disc, pendCount:pend.length, pendViejos:pendViejos,
    valorTotal:valorTotal, tarjetas: tarjs.length,
    as400Ok: as400Ok, as400Pend: tarjs.length - as400Ok,
    as400Pct: tarjs.length ? Math.round(as400Ok/tarjs.length*100) : 0 };
}
function renderPanelMetricas(){
  const s = statsGlobales();
  return '<div class="kpigrid">'
    + '<div class="kpicard static"><div class="kpinum">'+s.pct+'%</div><div class="kpilbl">Avance de verificación</div><div class="kpisub">'+s.done+' / '+s.total+' bienes</div></div>'
    + '<div class="kpicard kpi-disc" onclick="abrirDiscrepancias()"><div class="kpinum">'+s.disc+'</div><div class="kpilbl">Discrepancias</div><div class="kpisub">Bienes marcados NO</div></div>'
    + '<div class="kpicard kpi-pend" onclick="openPendientes()"><div class="kpinum">'+s.pendCount+'</div><div class="kpilbl">Pendientes de asignar</div><div class="kpisub">'+(s.pendViejos?s.pendViejos+' con '+UMBRAL_DIAS_PENDIENTE+'+ días':'Sin atrasos')+'</div></div>'
    + '<div class="kpicard kpi-valor static"><div class="kpinum">'+money(s.valorTotal)+'</div><div class="kpilbl">Valor total</div><div class="kpisub">'+s.tarjetas+' responsable(s)</div></div>'
    + '</div>'
    + (s.tarjetas ? ('<div class="as400bar" onclick="abrirPendientesAS400()">'
        + '<div class="as400bartop"><b>Carga al AS-400</b><span>'+s.as400Ok+' de '+s.tarjetas+' tarjetas · '+s.as400Pct+'%</span></div>'
        + '<div class="locbarwrap"><div class="locbar" style="width:'+s.as400Pct+'%"></div></div>'
        + '<div class="as400barsub">'+(s.as400Pend
            ? (s.as400Pend+' tarjeta'+(s.as400Pend===1?'':'s')+' pendiente'+(s.as400Pend===1?'':'s')+' de cargar — toque para verlas')
            : 'Todas las tarjetas están cargadas al AS-400')+'</div>'
      +'</div>') : '');
}
/* ================= FILTROS DE BÚSQUEDA ================= */
let searchFiltros = { ubic:"", estado:"", categoria:"", as400:"" };
let mostrarFiltros = false;
function filtrosActivos(){ return !!(searchFiltros.ubic || searchFiltros.estado || searchFiltros.categoria || searchFiltros.as400); }
function resetFiltrosBusqueda(){ searchFiltros={ubic:"",estado:"",categoria:"",as400:""}; mostrarFiltros=false; }
function toggleFiltrosBusqueda(){ mostrarFiltros=!mostrarFiltros; render(); }
function setFiltroBusqueda(campo,val){ searchFiltros[campo]=val; render(); }
function limpiarFiltrosBusqueda(){ resetFiltrosBusqueda(); render(); }
function bienCoincideFiltros(b){
  if(searchFiltros.ubic && b.ubicacion!==searchFiltros.ubic) return false;
  if(searchFiltros.estado && b.estado!==searchFiltros.estado) return false;
  if(searchFiltros.categoria && categoriaBien(b).cod!==searchFiltros.categoria) return false;
  if(searchFiltros.as400){
    // El estado de carga al AS-400 es de la tarjeta; un bien sin tarjeta no puede estar cargado.
    const tj = b.tarjetaId ? TARJETAS[b.tarjetaId] : null;
    const cargado = !!(tj && tj.as400Actualizado);
    if(searchFiltros.as400==="SI" && !cargado) return false;
    if(searchFiltros.as400==="NO" && cargado) return false;
  }
  return true;
}
/* ================= NAVEGACIÓN / RENDER ================= */
// El buscador general solo tiene sentido en las pantallas que listan bienes.
function mostrarBuscador(visible){
  const sb = document.querySelector(".searchbar");
  if(sb) sb.style.display = visible ? "" : "none";
}
/* Al entrar a una ficha se recuerda dónde iba la lista, para volver al mismo lugar.
   Antes, con 48 responsables, volver siempre lo dejaba hasta arriba y había que buscar
   de nuevo por dónde iba. */
let _scrollInicio = 0;
function goHome(){
  mode={view:"home",tarjetaId:null,filter:"todos",q:""}; resetFiltrosBusqueda();
  document.getElementById("search").value=""; render();
  const y = _scrollInicio; _scrollInicio = 0;
  // Se recupera la posición tras dibujar. Se repite un instante después porque las fotos y
  // los módulos que agregan datos a las tarjetas cambian el alto de la página al terminar,
  // y si solo se hiciera una vez el listado quedaba más arriba de donde iba.
  requestAnimationFrame(function(){
    window.scrollTo(0, y);
    if(y > 0) setTimeout(function(){ if(mode.view==="home") window.scrollTo(0, y); }, 90);
  });
}
function render(){
  if(!firstSyncDone) return;
  const v=document.getElementById("view");
  const fbtn = document.getElementById("filterbtn"); if(fbtn) fbtn.classList.toggle("on", filtrosActivos()||mostrarFiltros);
  mostrarBuscador(mode.view!=="ses"); // en "Nueva toma" el buscador no aplica y solo estorba
  if(mode.q || filtrosActivos() || mostrarFiltros) return renderSearch(v);
  if(mode.view==="person") return renderPerson(v);
  if(mode.view==="hall") return renderHall(v);
  if(mode.view==="ses") return renderSession(v);
  if(mode.view==="pend") return renderPendientes(v);
  const tarjs = tarjetasActivas();
  let h = renderPanelMetricas();
  h+='<div class="hzrow" onclick="openHall()"><span class="ic">'+icon('camera',22)+'</span>'
    +'<div style="flex:1"><b>Hallazgos: bienes encontrados sin tarjeta</b><small>Toque Hallazgo para anotar uno</small></div>'
    +'<div style="color:#C99B62;font-size:20px">›</div></div>';
  h+='<div class="hint">Toque un responsable para verificar sus bienes. '+tarjs.length+' tarjetas · '+Object.keys(BIENES).length+' bienes.</div>';
  tarjs.forEach(function(t){
    const list = bienesDe(t.id); const d=doneCount(list); const n=list.length; const p=n?Math.round(d/n*100):0;
    h+='<div class="prow" onclick="openPerson(\''+t.id+'\')">'
      +'<div class="ring" style="--p:'+p+'"><span class="ringtxt">'+d+'/'+n+'</span></div>'
      +'<div class="pinfo"><div class="pname">'+esc(t.responsable||"(sin nombre)")+'</div>'
      +'<div class="pmeta">Tarjeta '+esc(t.numero||"(pendiente)")+' '+chipTipo(t.tipo)
      +(t.correo?' <span class="pill-mail">✉️</span>':'')
      +(t.as400Actualizado?' <span class="chip c-as400">'+icon('check',10,'margin-right:2px')+'AS-400</span>':'')+'</div></div>'
      +'<div style="color:#B8C0CC;font-size:20px">›</div></div>';
  });
  v.innerHTML=h;
}
function bienesPendientes(){ return Object.values(BIENES).filter(function(b){ return !b.tarjetaId; }); }
const UMBRAL_DIAS_PENDIENTE = 7;
function msActualizado(b){ return (b.actualizado && b.actualizado.toMillis) ? b.actualizado.toMillis() : null; }
function diasPendiente(b){ const ms=msActualizado(b); return ms===null ? null : Math.floor((Date.now()-ms)/86400000); }
function chipPendienteViejo(b){
  const dias = diasPendiente(b);
  if(dias===null || dias<UMBRAL_DIAS_PENDIENTE) return "";
  return '<span class="chip c-old">'+icon('clock',10,'margin-right:2px')+dias+' días sin asignar</span>';
}
function openPendientes(){ mode={view:"pend",tarjetaId:null,filter:"todos",q:""}; resetFiltrosBusqueda(); document.getElementById("search").value=""; render(); window.scrollTo(0,0); }
function renderPendientes(v){
  const pend = bienesPendientes().sort(function(a,b){
    const da=diasPendiente(a), db2=diasPendiente(b);
    if(da!==null && db2!==null && da!==db2) return db2-da; // el que lleva más tiempo, primero
    if(da!==null && db2===null) return -1;
    if(da===null && db2!==null) return 1;
    return (a.codigo||"").localeCompare(b.codigo||"");
  });
  const viejos = pend.filter(function(b){ return chipPendienteViejo(b); }).length;
  let h='<button class="backbtn" onclick="goHome()">‹ Responsables</button>';
  h+='<div style="margin:6px 2px 8px"><div style="font-size:18px;font-weight:800;color:#1F3864">'+icon('package',17,'margin-right:6px')+'Bienes pendientes de asignar</div>'
    +'<div style="font-size:12.5px;color:#8A929C;margin-top:2px">Bienes ya ingresados al sistema (por ejemplo, importados de Excel) que todavía no tienen responsable. Asígnelos con 🧍 Nueva toma cuando visite a la persona.</div></div>';
  if(pend.length===0){ h+=emptyState('No hay bienes pendientes de asignar'); v.innerHTML=h; return; }
  if(viejos>0){ h+='<div class="warnbox">'+icon('alertTriangle',13,'margin-right:4px')+viejos+' bien(es) llevan '+UMBRAL_DIAS_PENDIENTE+' días o más sin asignar.</div>'; }
  h += pend.map(function(b){ return itemCard(b, false, chipPendienteViejo(b)); }).join("");
  v.innerHTML=h; loadThumbs();
}
function openPerson(id){
  if(mode.view==="home") _scrollInicio = window.scrollY || 0;
  mode={view:"person",tarjetaId:id,filter:"todos",q:""}; resetFiltrosBusqueda(); document.getElementById("search").value=""; render(); window.scrollTo(0,0); }
/* ================= CONTROL "ACTUALIZADO EN AS-400" (por tarjeta) =================
   Marca que la tarjeta completa del responsable ya se cargó al sistema AS-400.
   Se guarda con fecha y con quién la marcó, para que quede constancia de auditoría. */
function as400Control(t){
  const puede = puedeEditar();
  if(t.as400Actualizado){
    const detalle = (t.as400Fecha?esc(t.as400Fecha):"") + (t.as400Por?(" · "+esc(t.as400Por)):"");
    return '<div class="as400box on"'+(puede?' onclick="marcarAS400(\''+t.id+'\',false)"':'')+'>'
      + '<span class="as400chk">'+icon('check',15)+'</span>'
      + '<div><b>Actualizado en AS-400</b>'+(detalle?'<small>'+detalle+'</small>':'')
      + (puede?'<small>Toque para desmarcar</small>':'')+'</div></div>';
  }
  if(!puede){
    return '<div class="as400box"><span class="as400chk"></span><div><b>Pendiente de actualizar en AS-400</b></div></div>';
  }
  return '<div class="as400box" onclick="marcarAS400(\''+t.id+'\',true)">'
    + '<span class="as400chk"></span>'
    + '<div><b>Marcar como actualizado en AS-400</b><small>Toque cuando ya haya cargado esta tarjeta al sistema</small></div></div>';
}
function abrirPendientesAS400(){
  const s = statsGlobales();
  const pend = tarjetasActivas().filter(function(t){ return !t.as400Actualizado; });
  const listos = tarjetasActivas().filter(function(t){ return t.as400Actualizado; })
    .sort(function(a,b){ return (b.as400Fecha||"").localeCompare(a.as400Fecha||""); });
  let h = '<div class="grip"></div><h3>Carga al AS-400</h3>'
    + '<div class="note">Tarjetas de responsabilidad que ya cargó al sistema AS-400 y las que todavía faltan. Toque una para abrir su ficha.</div>'
    + '<div class="hint">'+s.as400Ok+' de '+s.tarjetas+' cargadas ('+s.as400Pct+'%)</div>';
  if(!pend.length){
    h += emptyState("No queda ninguna tarjeta pendiente", "Todas están cargadas al AS-400");
  } else {
    h += '<div class="msec">Pendientes de cargar ('+pend.length+')</div>';
    h += pend.sort(function(a,b){ return (a.responsable||"").localeCompare(b.responsable||""); }).map(function(t){
      const items = bienesDe(t.id);
      return '<div class="tlist-item" onclick="closeMenu();openPerson(\''+t.id+'\')"><div><b>'+esc(t.responsable||"(sin nombre)")+'</b>'
        + '<small>Tarjeta '+esc(t.numero||"(pendiente)")+' · '+items.length+' bien(es)</small></div><span style="color:#B8C0CC">›</span></div>';
    }).join("");
  }
  if(listos.length){
    h += '<div class="msec">Ya cargadas ('+listos.length+')</div>';
    h += listos.map(function(t){
      return '<div class="tlist-item" onclick="closeMenu();openPerson(\''+t.id+'\')"><div><b>'+esc(t.responsable||"(sin nombre)")+'</b>'
        + '<small>Tarjeta '+esc(t.numero||"(pendiente)")+(t.as400Fecha?(' · cargada '+esc(t.as400Fecha)):"")+(t.as400Por?(' por '+esc(t.as400Por)):"")+'</small></div>'
        + '<span style="color:var(--verde)">'+icon('check',15)+'</span></div>';
    }).join("");
  }
  h += '<button class="act o" onclick="closeMenu()">Cerrar</button>';
  document.getElementById("sheet").innerHTML = h;
  showSheet();
}
function marcarAS400(tarjetaId, valor){
  if(!requiereEdicion()) return;
  const t = TARJETAS[tarjetaId]; if(!t) return;
  if(!valor && !confirm('¿Quitar la marca de "Actualizado en AS-400" de la tarjeta de '+(t.responsable||"esta persona")+'?')) return;
  const patch = valor
    ? { as400Actualizado:true, as400Fecha: today(), as400Por: META.by||"" }
    : { as400Actualizado:false, as400Fecha:"", as400Por:"" };
  patch.actualizada = firebase.firestore.FieldValue.serverTimestamp();
  db.collection("tarjetas").doc(tarjetaId).set(patch, {merge:true})
    .then(function(){ toast(valor?"Marcada como actualizada en AS-400 ✓":"Marca de AS-400 quitada"); })
    .catch(function(){ toast("No se pudo guardar (revise conexión)"); });
}
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
    +'<div style="margin-top:4px"><span class="moretog" onclick="editCorreoTarjeta(\''+t.id+'\')">✉️ '+(t.correo?esc(t.correo):"agregar correo")+'</span>'
    +' <span class="moretog" onclick="imprimirConstancia(\''+t.id+'\')">'+icon('download',13)+' Constancia (PDF)</span>'
    +(t.firmaRecibida?(' <span class="moretog" onclick="verFirma(\''+t.id+'\')">'+icon('check',13)+' Firmado'+(t.firmaFecha?(' ('+esc(t.firmaFecha)+')'):'')+'</span>'):'')
    +'</div></div>'
    + as400Control(t);
  h+='<div class="filters">'
    +'<div class="fp '+(mode.filter==="todos"?"on":"")+'" onclick="setFilter(\'todos\')">Todos ('+n+')</div>'
    +'<div class="fp '+(mode.filter==="pend"?"on":"")+'" onclick="setFilter(\'pend\')">Pendientes ('+(n-d)+')</div>'
    +'<div class="fp '+(mode.filter==="list"?"on":"")+'" onclick="setFilter(\'list\')">Hechos ('+d+')</div></div>';
  if(n===0){
    h+='<button class="act o" style="margin-bottom:12px" onclick="borrarTarjetaDefinitiva(\''+t.id+'\')">'+icon('trash',15,'margin-right:6px')+'Borrar este responsable (tarjeta vacía)</button>';
  } else if(puedeEditar() && (n-d)>0){
    h+='<button class="act p" style="margin-bottom:12px" onclick="abrirModoRapido(\''+t.id+'\')">'+icon('zap',16,'margin-right:7px')+'Modo rápido — verificar '+(n-d)+' pendiente'+((n-d)===1?'':'s')+'</button>';
  }
  if(show.length===0){ h+=emptyState('No hay bienes en este filtro'); v.innerHTML=h; loadThumbs(); return; }
  if(mode.filter!=="list" && (n-d)>1){
    h+='<button class="act o" style="margin-bottom:12px" onclick="marcarPendientesNo(\''+t.id+'\')">'+icon('x',15,'margin-right:6px')+'Ninguno de los pendientes está aquí (marcar todos NO)</button>';
  }
  h += show.map(function(b){ return itemCard(b); }).join("");
  v.innerHTML=h; loadThumbs();
}
function marcarPendientesNo(tarjetaId){
  if(!requiereEdicion()) return;
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
  if(!requiereEdicion()) return;
  const t = TARJETAS[id];
  if(!t) return;
  if(!confirm("¿Seguro que desea eliminar el registro de "+(t.responsable||"esta persona")+"? Esta acción no se puede deshacer.")){ return; }
  db.collection("tarjetas").doc(id).delete()
    .then(function(){ toast("Responsable eliminado ✓"); goHome(); })
    .catch(function(){ toast("Error al eliminar"); });
}
function setFilter(f){ mode.filter=f; render(); }

/* ================= CONSTANCIA DE RESPONSABILIDAD (imprimir / PDF) ================= */
/* ================= REPORTE EJECUTIVO (una página, para imprimir o enviar) ================= */
function imprimirReporteEjecutivo(){
  closeMenu();
  const s = statsGlobales();
  const lista = Object.values(BIENES);

  // Avance por ubicación
  const porUbic = {};
  lista.forEach(function(b){
    const u = b.ubicacion || "(sin ubicación registrada)";
    if(!porUbic[u]) porUbic[u] = {total:0, si:0, no:0, pend:0, valor:0};
    const g = porUbic[u]; g.total++; g.valor += Number(b.valor||0);
    if(b.existe==="SÍ") g.si++; else if(b.existe) g.no++; else g.pend++;
  });
  const filasUbic = Object.keys(porUbic).sort(function(a,b){ return porUbic[b].total-porUbic[a].total; }).map(function(u){
    const g = porUbic[u], pct = g.total?Math.round(g.si/g.total*100):0;
    return '<tr><td>'+esc(u)+'</td><td class="pdnum">'+g.total+'</td><td class="pdnum">'+g.si+'</td>'
      +'<td class="pdnum">'+g.no+'</td><td class="pdnum">'+g.pend+'</td><td class="pdnum">'+pct+'%</td></tr>';
  }).join("");

  // Diferencias por responsable
  const disc = discrepancias();
  const porResp = {};
  disc.forEach(function(b){
    const r = b.responsable || "(sin responsable)";
    if(!porResp[r]) porResp[r] = {n:0, valor:0};
    porResp[r].n++; porResp[r].valor += Number(b.valor||0);
  });
  const filasResp = Object.keys(porResp).sort(function(a,b){ return porResp[b].n-porResp[a].n; }).slice(0,12).map(function(r){
    return '<tr><td>'+esc(r)+'</td><td class="pdnum">'+porResp[r].n+'</td><td class="pdnum">'+money(porResp[r].valor)+'</td></tr>';
  }).join("");

  const kpi = function(etq, val, extra){
    return '<div class="pdkpi"><div class="pdkpinum">'+val+'</div><div class="pdkpilbl">'+etq+'</div>'
      + (extra?'<div class="pdkpisub">'+extra+'</div>':'') + '</div>';
  };

  const html = '<div class="pdhead">'
      +'<div class="pdtitle">Instituto Guatemalteco de Seguridad Social — Auditoría Interna</div>'
      +'<div class="pdsub">Reporte ejecutivo — Inventario físico de bienes</div>'
      +'<div class="pdfecha">Generado el '+today()+(META.by?('  ·  Por '+esc(META.by)):'')+'</div>'
    +'</div>'
    +'<div class="pdkpis">'
      + kpi("Avance de verificación", s.pct+"%", s.done+" de "+s.total+" bienes")
      + kpi("Diferencias", s.disc, "bienes marcados NO")
      + kpi("Sin responsable", s.pendCount, "pendientes de asignar")
      + kpi("Valor del inventario", money(s.valorTotal), s.tarjetas+" tarjeta(s)")
    +'</div>'
    +'<div class="pdsec">Avance por ubicación</div>'
    +'<table class="pdtabla"><thead><tr><th>Ubicación</th><th>Bienes</th><th>Verificados</th><th>Con diferencia</th><th>Pendientes</th><th>Avance</th></tr></thead>'
      +'<tbody>'+(filasUbic||'<tr><td colspan="6">Sin datos.</td></tr>')+'</tbody></table>'
    +'<div class="pdsec">Diferencias por responsable</div>'
    +'<table class="pdtabla"><thead><tr><th>Responsable</th><th>Bienes con diferencia</th><th>Valor</th></tr></thead>'
      +'<tbody>'+(filasResp||'<tr><td colspan="3">No se registraron diferencias.</td></tr>')+'</tbody>'
      +'<tfoot><tr><td><b>Total</b></td><td class="pdnum"><b>'+disc.length+'</b></td>'
      +'<td class="pdnum"><b>'+money(disc.reduce(function(a,b){return a+Number(b.valor||0);},0))+'</b></td></tr></tfoot></table>'
    +'<div class="pdsec">Carga al sistema AS-400</div>'
    +'<div class="pdtexto">'+s.as400Ok+' de '+s.tarjetas+' tarjetas de responsabilidad ya fueron cargadas al AS-400 ('+s.as400Pct+'%). '
      + (s.as400Pend? ('Quedan '+s.as400Pend+' pendiente'+(s.as400Pend===1?'':'s')+' de cargar.') : 'No queda ninguna pendiente.')+'</div>'
    +'<div class="pdfirmas">'
      +'<div class="pdfirma"><div class="pdline"></div>Elaboró — Auditoría Interna</div>'
      +'<div class="pdfirma"><div class="pdline"></div>Revisó</div>'
    +'</div>'
    +'<div class="pdnota">Revise el texto de este reporte antes de usarlo como documento oficial — el formato es un punto de partida, no un modelo institucional certificado.</div>';
  document.getElementById("printArea").innerHTML = html;
  setTimeout(function(){ window.print(); }, 80);
}
function imprimirConstancia(tarjetaId){
  const t = TARJETAS[tarjetaId]; if(!t) return;
  const list = bienesDe(t.id).slice().sort(function(a,b){ return (a.codigo||"").localeCompare(b.codigo||""); });
  const totalValor = list.reduce(function(s,b){ return s+Number(b.valor||0); },0);
  const filas = list.map(function(b){
    return '<tr>'
      +'<td>'+esc(b.codigo)+'</td>'
      +'<td>'+esc(b.descripcion||"")+'</td>'
      +'<td class="pdnum">'+money(b.valor)+'</td>'
      +'<td>'+esc(b.estado||"")+'</td>'
      +'</tr>';
  }).join("");
  fotoGet("S"+tarjetaId).then(function(firma){
    const firmaImg = firma ? '<img class="pdfirmaimg" src="data:image/jpeg;base64,'+firma.b64+'">' : '';
    const firmaNota = (firma && t.firmaFecha) ? ('<div class="pdfirmafecha">Firmado electrónicamente el '+esc(t.firmaFecha)+'</div>') : '';
    const html = '<div class="pdhead">'
        +'<div class="pdtitle">Instituto Guatemalteco de Seguridad Social — Auditoría Interna</div>'
        +'<div class="pdsub">Constancia de responsabilidad de bienes</div>'
      +'</div>'
      +'<table class="pdinfo"><tr><td><b>Responsable:</b> '+esc(t.responsable||"")+'</td><td><b>Tarjeta No.:</b> '+esc(t.numero||"(pendiente)")+'</td></tr>'
        +'<tr><td><b>Puesto:</b> '+esc(t.puesto||"—")+'</td><td><b>Correo:</b> '+esc(t.correo||"—")+'</td></tr>'
        +'<tr><td colspan="2"><b>Fecha de emisión:</b> '+today()+'</td></tr></table>'
      +'<table class="pdtabla"><thead><tr><th>No. Inventario</th><th>Descripción</th><th>Valor</th><th>Estado</th></tr></thead>'
        +'<tbody>'+(filas||'<tr><td colspan="4">Sin bienes registrados en esta tarjeta.</td></tr>')+'</tbody>'
        +'<tfoot><tr><td colspan="2"><b>Total ('+list.length+' bien(es))</b></td><td class="pdnum"><b>'+money(totalValor)+'</b></td><td></td></tr></tfoot>'
      +'</table>'
      +'<div class="pdfirmas">'
        +'<div class="pdfirma">'+firmaImg+'<div class="pdline"></div>Firma del responsable'+firmaNota+'</div>'
        +'<div class="pdfirma"><div class="pdline"></div>Firma de Auditoría Interna</div>'
      +'</div>'
      +'<div class="pdnota">Revise el texto de esta constancia antes de usarla como documento oficial — el formato es un punto de partida, no un modelo institucional certificado.</div>';
    document.getElementById("printArea").innerHTML = html;
    setTimeout(function(){ window.print(); }, 80);
  });
}
function verFirma(tarjetaId){
  const t = TARJETAS[tarjetaId]; if(!t) return;
  fotoGet("S"+tarjetaId).then(function(r){
    let h = '<div class="grip"></div><h3>Firma de recibido</h3>';
    if(r){
      h += '<img src="data:image/jpeg;base64,'+r.b64+'" style="width:100%;border:1px solid #E2E6EC;border-radius:10px;background:#fff">';
      h += '<div class="note">Firmado por '+esc(t.responsable||"")+(t.firmaFecha?(' el '+esc(t.firmaFecha)):"")+'.</div>';
      if(requiereEdicion()) h += '<button class="act o" onclick="quitarFirma(\''+tarjetaId+'\')">🗑️ Quitar firma</button>';
    } else {
      h += '<div class="note">No se encontró la imagen de la firma en este dispositivo.</div>';
    }
    h += '<button class="act o" onclick="closeMenu()">Cerrar</button>';
    document.getElementById("sheet").innerHTML = h;
    showSheet();
  });
}
function quitarFirma(tarjetaId){
  if(!requiereEdicion()) return;
  if(!confirm("¿Quitar la firma registrada de esta tarjeta?")) return;
  fotoDel("S"+tarjetaId).then(function(){
    return db.collection("tarjetas").doc(tarjetaId).update({firmaRecibida:false, firmaUrl:firebase.firestore.FieldValue.delete()});
  }).then(function(){ closeMenu(); toast("Firma eliminada"); render(); }).catch(function(){ toast("No se pudo quitar la firma"); });
}

/* ================= TARJETA DE BIEN ================= */
function itemCard(b, showOwner, extraChip){
  const cls = b.existe==="SÍ"?"done-si":b.existe==="NO"?"done-no":b.existe==="NO UBICADO"?"done-nu":"";
  const dup = b.notaDuplicado?'<span class="chip c-dup">⚠ REVISAR</span>':'';
  const nuevo = b.esNuevo?'<span class="chip c-hz">NUEVO</span>':'';
  const pendChip = !b.tarjetaId?'<span class="chip c-dup">SIN ASIGNAR</span>':'';
  const owner = (showOwner && b.tarjetaId)?'<div class="powner">'+esc(b.responsable||"")+' · Tarj. '+esc(b.tarjetaNumero||"")+'</div>':'';
  const id = b.id;
  const soloLectura = typeof puedeEditar==='function' && !puedeEditar();
  const descField = (b.esNuevo && !soloLectura)
    ? '<input type="text" value="'+esc(b.descripcion||"")+'" onchange="markCampo(\''+id+'\',\'descripcion\',this.value)" placeholder="Descripción del bien" style="width:100%;padding:9px 11px;border:1.4px solid #E2E6EC;border-radius:9px;font-size:14px;margin:4px 0 2px">'
    : '<div class="desc">'+esc(b.descripcion||"")+'</div>';
  const asignarBtn = (!b.tarjetaId && !soloLectura) ? '<button class="act p" style="margin:8px 0 0" onclick="asignarPendiente(\''+id+'\')">'+icon('user',15,'margin-right:6px')+'Asignar a una persona</button>' : '';
  const estadoActualTxt = {BUENO:"Bueno",REGULAR:"Regular",MALO:"Malo","PARA BAJA":"Para baja"}[b.estado] || "";
  const accionesExiste = soloLectura
    ? '<div class="powner" style="margin-top:6px">'+(b.existe?('Estado: <b>'+esc(b.existe)+'</b>'+(estadoActualTxt?" · "+esc(estadoActualTxt):"")):"Sin verificar todavía")+'</div>'
    : '<div class="bgrp">'
        +'<button class="btn b-si '+(b.existe==="SÍ"?"sel":"")+'" onclick="markExiste(\''+id+'\',\'SÍ\')">'+icon('check',16)+' SÍ<small>existe</small></button>'
        +'<button class="btn b-no '+(b.existe==="NO"?"sel":"")+'" onclick="markExiste(\''+id+'\',\'NO\')">'+icon('x',16)+' NO<small>no está</small></button>'
      +'</div>'
      +'<div class="bgrp estado" style="'+(b.existe==="SÍ"?"":"display:none")+'">'
        +['BUENO','REGULAR','MALO','PARA BAJA'].map(function(e){ const cl=e==="PARA BAJA"?"baja":e.toLowerCase();
          return '<button class="btn est e-'+cl+' '+(b.estado===e?"sel":"")+'" onclick="markEstado(\''+id+'\',\''+e+'\')">'+(e==="PARA BAJA"?"Baja":e.charAt(0)+e.slice(1).toLowerCase())+'</button>'; }).join("")
      +'</div>';
  return '<div class="item '+cls+'" id="it_'+id+'">'
    +'<div class="itop"><span class="inv">'+esc(b.codigo)+(b.codigoSiges?' <small style="font-weight:600;color:#8A929C">· SIGES '+esc(b.codigoSiges)+'</small>':'')+'</span><span class="val">'+money(b.valor)+'</span></div>'
    +'<div class="ochips">'+chipCategoria(b)+chipTipo(b.tipo)+nuevo+pendChip+dup+(extraChip||"")+'</div>'
    +descField
    +(b.existe==="NO UBICADO"?'<div class="warnbox">'+icon('alertTriangle',13,'margin-right:4px')+'Quedó marcado como “NO UBICADO”, opción que ya se retiró. Vuelva a marcarlo como SÍ o NO.</div>':'')
    +(b.notaDuplicado?'<div class="warnbox">'+esc(b.notaDuplicado)+'</div>':'')
    +(b.tarjetaAnteriorNumero?'<div class="warnbox">↩ Descargado de tarjeta '+esc(b.tarjetaAnteriorNumero)+' ('+esc(b.responsableAnterior||"")+')</div>':'')
    +owner
    +asignarBtn
    +accionesExiste
    +'<div class="tools">'
      +(soloLectura?'':'<button class="fotobtn" id="fb_B'+id+'" onclick="takePhoto(\'B'+id+'\')">'+icon('camera',15)+' Foto</button>')
      +'<img class="thumb" id="th_B'+id+'" style="display:none" onclick="viewPhoto(\'B'+id+'\')">'
       +(b.fotoUrl?'<a class="drivefoto" href="'+b.fotoUrl+'" target="_blank" rel="noopener"><img class="dthumb" src="'+driveThumbUrl(b.fotoUrl)+'" loading="lazy" alt="foto">🖼️ Ver foto</a>':'')
      +'<span class="moretog" onclick="toggleExtra(\''+id+'\')">＋ Ubicación / observación</span>'
      +'<span class="moretog" onclick="verHistorial(\''+id+'\')">'+icon('clock',13)+' Historial</span>'
      +(!soloLectura && b.existe==="NO" && b.tarjetaId?'<span class="moretog" style="color:var(--naranja)" onclick="descargarBien(\''+id+'\')">'+icon('logOut',13)+' Quitar de la tarjeta</span>':'')
      +(!soloLectura && b.esNuevo?'<span class="moretog" style="color:var(--rojo)" onclick="borrarBien(\''+id+'\')">'+icon('trash',13)+' Borrar</span>':'')
    +'</div>'
    +'<div class="extra" id="ex_'+id+'">'
      +'<label>Ubicación física real</label><input type="text" value="'+esc(b.ubicacion||"")+'" '+(soloLectura?'readonly':'onchange="markCampo(\''+id+'\',\'ubicacion\',this.value)"')+' placeholder="Ej. Oficina 3">'
      +'<label>Observaciones</label><input type="text" value="'+esc(b.observaciones||"")+'" '+(soloLectura?'readonly':'onchange="markCampo(\''+id+'\',\'observaciones\',this.value)"')+' placeholder="Ej. sin serie visible">'
    +'</div>'
    +(b.fechaVerificacion?'<div class="stamp">✓ '+esc(b.fechaVerificacion)+(b.verificadoPor?" · "+esc(b.verificadoPor):"")+'</div>':'')
  +'</div>';
}
function borrarBien(id){
  if(!requiereEdicion()) return;
  const b = BIENES[id]; if(!b) return;
  if(!confirm('¿Borrar el registro "'+b.codigo+'" ('+(b.descripcion||"sin descripción")+')? No se puede deshacer.')) return;
  fotoDel("B"+id);
  db.collection("bienes").doc(id).delete().then(function(){ toast("Registro borrado ✓"); }).catch(function(){ toast("No se pudo borrar"); });
}
function toggleExtra(id){ const e=document.getElementById("ex_"+id); if(e) e.classList.toggle("open"); }
function markExiste(id,val){
  if(!requiereEdicion()) return;
  const b = BIENES[id]; if(!b) return;
  const nuevo = b.existe===val ? "" : val;
  const patch = { existe: nuevo, actualizado: firebase.firestore.FieldValue.serverTimestamp() };
  if(nuevo){ patch.fechaVerificacion = today(); patch.verificadoPor = META.by||""; }
  db.collection("bienes").doc(id).update(patch).catch(function(){ toast("No se pudo guardar (revise conexión)"); });
  logMovimiento(b, {tipoMovimiento:"VERIFICACION", estado:b.estado||"", existe:nuevo, ubicacion:b.ubicacion||"", observaciones:b.observaciones||""});
}
function markEstado(id,val){
  if(!requiereEdicion()) return;
  const b = BIENES[id]; if(!b) return;
  const nuevo = b.estado===val? "" : val;
  db.collection("bienes").doc(id).update({estado:nuevo, actualizado: firebase.firestore.FieldValue.serverTimestamp()}).catch(function(){ toast("No se pudo guardar"); });
}
function markCampo(id,campo,val){
  if(!requiereEdicion()) return;
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

/* ================= HISTORIAL DE RESPONSABLES POR BIEN ================= */
const TIPO_MOV_TXT = {
  VERIFICACION: "Verificación de inventario",
  REASIGNACION: "Reasignado a otra persona",
  FUSION_TARJETAS: "Fusión de tarjetas duplicadas",
  HALLAZGO_ASIGNADO: "Asignado (era un hallazgo)",
  DESCARGADO: "Retirado de la tarjeta (ya no lo tenía)"
};
function descargarBien(id){
  if(!requiereEdicion()) return;
  const b = BIENES[id]; if(!b || !b.tarjetaId) return;
  if(!confirm('¿Quitar "'+b.codigo+'" de la tarjeta de '+(b.responsable||"esta persona")+'? Pasará a Bienes pendientes de asignar, y queda el registro de dónde salió.')) return;
  const tarjetaAnteriorNumero = b.tarjetaNumero||"", responsableAnterior = b.responsable||"";
  db.collection("bienes").doc(id).update({
    tarjetaId: null, tarjetaNumero: "", responsable: "", existe: "",
    tarjetaAnteriorNumero: tarjetaAnteriorNumero, responsableAnterior: responsableAnterior,
    actualizado: firebase.firestore.FieldValue.serverTimestamp()
  }).then(function(){ toast("Retirado de la tarjeta ✓ — pasó a pendientes de asignar"); })
    .catch(function(){ toast("No se pudo guardar (revise conexión)"); });
  db.collection("movimientos").add({
    codigo: b.codigo, tipoMovimiento: "DESCARGADO",
    tarjetaAnteriorNumero: tarjetaAnteriorNumero, responsableAnterior: responsableAnterior,
    tarjetaNuevaNumero: "", responsableNuevo: "",
    estado: b.estado||"", ubicacion: b.ubicacion||"", observaciones: "Ya no lo tenía físicamente",
    fecha: firebase.firestore.FieldValue.serverTimestamp(), fechaTxt: today(), capturadoPor: META.by||""
  }).catch(function(){});
}
function verHistorial(id){
  const b = BIENES[id];
  const codigo = b ? b.codigo : id;
  document.getElementById("sheet").innerHTML =
    '<div class="grip"></div><h3>Historial · '+esc(codigo)+'</h3>'
    +(b&&b.descripcion?'<div class="hint" style="margin-top:-8px">'+esc(b.descripcion)+'</div>':'')
    +'<div id="histBody"><div class="hint">Cargando…</div></div>'
    +'<button class="act o" onclick="closeMenu()">Cerrar</button>';
  showSheet();
  db.collection("movimientos").where("codigo","==",codigo).get().then(function(snap){
    const movs = snap.docs.map(function(d){ return d.data(); });
    movs.sort(function(a,b2){
      const ta = (a.fecha && a.fecha.toMillis) ? a.fecha.toMillis() : 0;
      const tb = (b2.fecha && b2.fecha.toMillis) ? b2.fecha.toMillis() : 0;
      return tb - ta;
    });
    const box = document.getElementById("histBody"); if(!box) return;
    if(!movs.length){ box.innerHTML = emptyState("Sin movimientos registrados para este bien", "Se anotará cada verificación o reasignación a partir de ahora"); return; }
    box.innerHTML = movs.map(function(m){
      const tipoTxt = TIPO_MOV_TXT[m.tipoMovimiento] || m.tipoMovimiento || "Movimiento";
      const cambioResp = (m.responsableAnterior && m.responsableNuevo && m.responsableAnterior!==m.responsableNuevo)
        ? (esc(m.responsableAnterior)+' → <b>'+esc(m.responsableNuevo)+'</b>')
        : ('<b>'+esc(m.responsableNuevo||m.responsable||m.responsableAnterior||"—")+'</b>');
      return '<div class="tlist-item" style="display:block">'
        +'<div style="display:flex;justify-content:space-between;gap:8px"><b>'+esc(tipoTxt)+'</b><small style="flex:none">'+esc(m.fechaTxt||"")+'</small></div>'
        +'<div class="powner">'+cambioResp+'</div>'
        +(m.existe?'<div class="powner">Estado: '+esc(m.existe)+(m.estado?" · "+esc(m.estado):"")+(m.ubicacion?" · "+esc(m.ubicacion):"")+'</div>':'')
        +(m.observaciones?'<div class="powner">'+esc(m.observaciones)+'</div>':'')
        +(m.capturadoPor?'<div class="stamp">Registrado por '+esc(m.capturadoPor)+'</div>':'')
      +'</div>';
    }).join("");
  }).catch(function(e){
    const box = document.getElementById("histBody"); if(box) box.innerHTML = '<div class="hint">No se pudo cargar: '+esc(e.message||e)+'</div>';
  });
}
/* ================= ACTIVIDAD RECIENTE (todos los bienes) ================= */
function abrirActividadReciente(){
  document.getElementById("sheet").innerHTML =
    '<div class="grip"></div><h3>'+icon('clock',18,'margin-right:6px;vertical-align:-3px')+'Actividad reciente</h3>'
    +'<div class="hint" style="margin-top:-8px">Últimos movimientos registrados en toda la auditoría. Toque uno para ver el historial completo de ese bien.</div>'
    +'<div id="actBody"><div class="hint">Cargando…</div></div>'
    +'<button class="act o" onclick="closeMenu()">Cerrar</button>';
  showSheet();
  db.collection("movimientos").get().then(function(snap){
    const movs = snap.docs.map(function(d){ return d.data(); });
    movs.sort(function(a,b){
      const ta = (a.fecha && a.fecha.toMillis) ? a.fecha.toMillis() : 0;
      const tb = (b.fecha && b.fecha.toMillis) ? b.fecha.toMillis() : 0;
      return tb - ta;
    });
    const box = document.getElementById("actBody"); if(!box) return;
    if(!movs.length){ box.innerHTML = emptyState("Aún no hay actividad registrada", "Se anotará cada verificación, reasignación o descargo a partir de ahora"); return; }
    box.innerHTML = movs.slice(0,60).map(actividadRow).join("");
  }).catch(function(e){
    const box = document.getElementById("actBody"); if(box) box.innerHTML = '<div class="hint">No se pudo cargar: '+esc(e.message||e)+'</div>';
  });
}
function actividadRow(m){
  const tipoTxt = TIPO_MOV_TXT[m.tipoMovimiento] || m.tipoMovimiento || "Movimiento";
  const quien = m.responsableNuevo || m.responsable || m.responsableAnterior || "—";
  return '<div class="tlist-item" style="display:block" onclick="verHistorial(\''+esc(bienDocId(m.codigo||""))+'\')">'
    +'<div style="display:flex;justify-content:space-between;gap:8px"><b>'+esc(tipoTxt)+'</b><small style="flex:none">'+esc(m.fechaTxt||"")+'</small></div>'
    +'<div class="powner">Bien '+esc(m.codigo||"")+' · '+esc(quien)+(m.ubicacion?" · "+esc(m.ubicacion):"")+'</div>'
    +(m.capturadoPor?'<div class="stamp">Registrado por '+esc(m.capturadoPor)+'</div>':'')
  +'</div>';
}
/* ================= ASISTENTE DEL INVENTARIO (preguntas en lenguaje natural, 100% local) =================
   No es una IA externa: no hay clave de API ni se envía información a internet. Reconoce preguntas
   comunes (cuántos, valor total, listados) combinando los mismos filtros que ya existen en la app
   (ubicación, categoría, estado, responsable) y responde con los datos ya cargados. Si no reconoce la
   pregunta, lo dice claramente en vez de inventar una respuesta. */
const CATEGORIA_ALIAS = {
  COMPUTO: ["COMPUTO","COMPUTACION"],
  MOBILIARIO: ["MOBILIARIO","MUEBLES"],
  COMUNICACION: ["COMUNICACION","TELEFONOS"],
  MEDICO: ["MEDICO","MEDICOS","SALUD"],
  ELECTRO: ["ELECTRODOMESTICO","ELECTRODOMESTICOS"],
  HERRAMIENTA: ["HERRAMIENTA","HERRAMIENTAS"],
  VEHICULO: ["VEHICULO","VEHICULOS","TRANSPORTE"]
};
function detectarUbicacion(t){
  for(let i=0;i<LOCS.length;i++){ if(t.indexOf(normTexto(LOCS[i]))>=0) return LOCS[i]; }
  return "";
}
function detectarCategoria(t){
  for(let i=0;i<CATEGORIAS_BIEN.length;i++){
    const c = CATEGORIAS_BIEN[i];
    const alias = (CATEGORIA_ALIAS[c.cod]||[]).concat([normTexto(c.nombre)]);
    if(alias.some(function(a){ return t.indexOf(a)>=0; })) return c.cod;
    if(c.kw.some(function(k){ return t.indexOf(k)>=0; })) return c.cod;
  }
  return "";
}
function detectarEstado(t){
  if(t.indexOf("PARA BAJA")>=0 || (t.indexOf("BAJA")>=0 && t.indexOf("TRABAJA")<0)) return "PARA BAJA";
  if(t.indexOf("BUEN ESTADO")>=0 || t.indexOf("BUENO")>=0) return "BUENO";
  if(t.indexOf("MAL ESTADO")>=0 || t.indexOf("MALO")>=0) return "MALO";
  if(t.indexOf("REGULAR")>=0) return "REGULAR";
  return "";
}
function detectarExiste(t){
  if(t.indexOf("NO UBICADO")>=0) return "NO UBICADO";
  if(t.indexOf("NO ENCONTRADO")>=0 || t.indexOf("FALTANTE")>=0 || t.indexOf("PERDIDO")>=0) return "NO";
  if(t.indexOf("SIN VERIFICAR")>=0) return "__VACIO__";
  if(t.indexOf("VERIFICADO")>=0 || t.indexOf("ENCONTRADO")>=0) return "SÍ";
  return "";
}
function detectarResponsable(t){
  let mejor=null;
  Object.values(TARJETAS).forEach(function(tj){
    if(mejor || !tj.responsable) return;
    if(t.indexOf(normTexto(tj.responsable))>=0) mejor=tj;
  });
  if(mejor) return mejor;
  const palabras = t.replace(/[^A-Z0-9Ñ\s]/g,"").split(/\s+/).filter(function(w){ return w.length>=4; });
  Object.values(TARJETAS).forEach(function(tj){
    if(mejor || !tj.responsable) return;
    const partes = normTexto(tj.responsable).split(/\s+/);
    if(palabras.some(function(w){ return partes.indexOf(w)>=0; })) mejor=tj;
  });
  return mejor;
}
function responderPregunta(pregunta){
  const t = normTexto(pregunta);
  const ubic = detectarUbicacion(t);
  const categoria = detectarCategoria(t);
  const estado = detectarEstado(t);
  const existe = detectarExiste(t);
  const tarjeta = detectarResponsable(t);
  function coincide(b){
    if(ubic && b.ubicacion!==ubic) return false;
    if(categoria && categoriaBien(b).cod!==categoria) return false;
    if(estado && b.estado!==estado) return false;
    if(existe==="__VACIO__" && b.existe) return false;
    if(existe && existe!=="__VACIO__" && b.existe!==existe) return false;
    if(tarjeta && b.tarjetaId!==tarjeta.id) return false;
    return true;
  }
  const descFiltro = [];
  if(tarjeta) descFiltro.push("de "+tarjeta.responsable);
  if(categoria) descFiltro.push("de "+((CATEGORIAS_BIEN.find(function(c){return c.cod===categoria;})||{}).nombre||"").toLowerCase());
  if(ubic) descFiltro.push("en "+ubic);
  if(estado) descFiltro.push("en estado "+estado.toLowerCase());
  if(existe==="NO UBICADO") descFiltro.push("marcados NO UBICADO (opción retirada)");
  else if(existe==="NO") descFiltro.push("marcados NO (no están)");
  else if(existe==="SÍ") descFiltro.push("verificados");
  else if(existe==="__VACIO__") descFiltro.push("sin verificar todavía");
  const sufijo = descFiltro.length ? (" "+descFiltro.join(" ")) : "";

  if(/AS.?400/.test(t)){
    const s = statsGlobales();
    if(!s.tarjetas) return "Todavía no hay tarjetas de responsabilidad registradas.";
    if(!s.as400Pend) return "Las "+s.tarjetas+" tarjetas ya están cargadas al AS-400.";
    const faltan = tarjetasActivas().filter(function(x){ return !x.as400Actualizado; })
      .map(function(x){ return x.responsable||"(sin nombre)"; }).sort();
    return "Van "+s.as400Ok+" de "+s.tarjetas+" tarjetas cargadas al AS-400 ("+s.as400Pct+"%). Faltan "+s.as400Pend+": "
      + faltan.slice(0,8).join(", ") + (faltan.length>8?"…":"") + ".";
  }
  if(/PENDIENTE.*ASIGNAR|SIN ASIGNAR/.test(t)){
    const pend = bienesPendientes();
    return pend.length+" bien(es) están pendientes de asignar."+(pend.length?" Puede verlos en el inicio, en la tarjeta de 'Pendientes de asignar'.":"");
  }
  if(/AVANCE|PORCENTAJE|CUANTO LLEVAMOS|COMO VAMOS/.test(t)){
    const s = statsGlobales();
    return "Llevan "+s.pct+"% de avance: "+s.done+" de "+s.total+" bienes verificados.";
  }
  if(/DISCREPANCIA/.test(t) && !existe && !categoria && !ubic){
    const s = statsGlobales();
    return "Hay "+s.disc+" bien(es) con discrepancia (marcados NO). Puede verlos en el menú, en 'Discrepancias'.";
  }
  if(/VALOR|CUANTO VALE|CUANTO CUESTA|CUANTO CUESTAN|MONTO/.test(t)){
    const lista = Object.values(BIENES).filter(coincide);
    if(lista.length===0) return "No encontré bienes"+sufijo+".";
    const total = lista.reduce(function(s,b){ return s+Number(b.valor||0); },0);
    return "El valor total de "+lista.length+" bien(es)"+sufijo+" es "+money(total)+".";
  }
  if(tarjeta && /QUE TIENE|BIENES DE|QUE BIENES/.test(t)){
    const lista = bienesDe(tarjeta.id);
    if(lista.length===0) return tarjeta.responsable+" no tiene bienes asignados todavía.";
    const nombres = lista.slice(0,8).map(function(b){ return b.codigo+" ("+(b.descripcion||"sin descripción")+")"; }).join(", ");
    return tarjeta.responsable+" tiene "+lista.length+" bien(es): "+nombres+(lista.length>8?"…":"")+".";
  }
  if(/CUANT[OA]S?|NUMERO DE|CANTIDAD DE/.test(t) || ubic || categoria || estado || existe || tarjeta){
    const lista = Object.values(BIENES).filter(coincide);
    return "Hay "+lista.length+" bien(es)"+sufijo+".";
  }
  return "__NO_ENTENDIDO__";
}
let asistenteHistorial = [];
function abrirAsistente(){
  asistenteHistorial = [];
  renderAsistente();
  showSheet();
}
function renderAsistente(){
  let h = '<div class="grip"></div><h3>'+icon('chat',18,'margin-right:6px;vertical-align:-3px')+'Asistente del inventario</h3>'
    + '<div class="hint" style="margin-top:-8px">Responde con los datos que ya están cargados en la app — no es una IA externa, no envía nada a internet. Ejemplos: "¿cuántos bienes de cómputo hay en Archivo General?", "¿cuánto vale lo que tiene María?", "¿qué falta de subir al AS-400?".</div>'
    + '<div id="asistChat" style="max-height:260px;overflow:auto;margin:10px 0"></div>'
    + '<div style="display:flex;gap:8px"><input id="asistIn" type="text" placeholder="Escriba su pregunta…" autocomplete="off" style="flex:1;padding:11px 13px;border:1.5px solid #E2E6EC;border-radius:10px;font-size:15px" onkeydown="if(event.key===\'Enter\'){event.preventDefault();asistPreguntar();}">'
    + '<button class="act p" style="margin:0;width:auto;padding:0 16px" onclick="asistPreguntar()">Preguntar</button></div>'
    + '<button class="act o" style="margin-top:10px" onclick="closeMenu()">Cerrar</button>';
  document.getElementById("sheet").innerHTML = h;
  pintarAsistChat();
  setTimeout(function(){ const el=document.getElementById("asistIn"); if(el) el.focus(); },150);
}
function pintarAsistChat(){
  const box = document.getElementById("asistChat"); if(!box) return;
  if(asistenteHistorial.length===0){ box.innerHTML = '<div class="hint">Aún no ha preguntado nada.</div>'; return; }
  box.innerHTML = asistenteHistorial.map(function(m){
    return '<div style="margin-bottom:10px"><div style="font-weight:700;font-size:13.5px;color:#1F3864">'+esc(m.q)+'</div>'
      + '<div style="font-size:13.5px;color:#333;margin-top:2px">'+esc(m.a)+'</div></div>';
  }).join("");
  box.scrollTop = box.scrollHeight;
}
function asistPreguntar(){
  const el = document.getElementById("asistIn"); const q = (el?el.value:"").trim(); if(!q) return;
  let a = responderPregunta(q);
  if(a==="__NO_ENTENDIDO__"){
    a = "No entendí esa pregunta. Puedo responder sobre cantidades, valores y listados combinando ubicación, categoría, estado o responsable. Ejemplo: \"¿cuántos bienes de cómputo hay en Archivo General?\".";
  }
  asistenteHistorial.push({q:q,a:a});
  el.value="";
  pintarAsistChat();
  setTimeout(function(){ const inp=document.getElementById("asistIn"); if(inp) inp.focus(); },10);
}
function editCorreoTarjeta(id){
  if(!requiereEdicion()) return;
  const t = TARJETAS[id]; if(!t) return;
  pedirTexto("Correo electrónico", "Correo de "+(t.responsable||"esta persona"), t.correo||"", "email", function(val){
    db.collection("tarjetas").doc(id).update({correo:val.trim(), actualizada: firebase.firestore.FieldValue.serverTimestamp()})
      .then(function(){ toast("Correo actualizado ✓"); }).catch(function(){ toast("No se pudo guardar"); });
  });
}

/* ================= BÚSQUEDA ================= */
/* Al escribir, se espera un momento antes de volver a dibujar la lista. Antes cada letra
   redibujaba todas las tarjetas: con 765 bienes, escribir una palabra tardaba ~19 s en un
   teléfono de gama media. Si se borra todo, se responde de inmediato. */
let _tSearch = null;
function onSearch(q){
  const val = q.trim();
  clearTimeout(_tSearch);
  if(!val){ mode.q = ""; render(); return; }
  _tSearch = setTimeout(function(){ mode.q = val; render(); }, 260);
}
function renderBarraFiltros(){
  const ESTADOS = [['BUENO','Bueno'],['REGULAR','Regular'],['MALO','Malo'],['PARA BAJA','Para baja']];
  let h = '<div class="filtrobar '+(mostrarFiltros||filtrosActivos()?"":"oculto")+'">';
  h += '<select onchange="setFiltroBusqueda(\'ubic\',this.value)"><option value="">Ubicación (todas)</option>'
     + LOCS.map(function(l){ return '<option value="'+esc(l)+'" '+(searchFiltros.ubic===l?"selected":"")+'>'+esc(l)+'</option>'; }).join("")
     + '</select>';
  h += '<select onchange="setFiltroBusqueda(\'estado\',this.value)"><option value="">Estado (todos)</option>'
     + ESTADOS.map(function(e){ return '<option value="'+e[0]+'" '+(searchFiltros.estado===e[0]?"selected":"")+'>'+e[1]+'</option>'; }).join("")
     + '</select>';
  h += '<select onchange="setFiltroBusqueda(\'categoria\',this.value)"><option value="">Categoría (todas)</option>'
     + CATEGORIAS_BIEN.map(function(c){ return '<option value="'+c.cod+'" '+(searchFiltros.categoria===c.cod?"selected":"")+'>'+esc(c.nombre)+'</option>'; }).join("")
     + '<option value="OTROS" '+(searchFiltros.categoria==="OTROS"?"selected":"")+'>Otros / sin clasificar</option>'
     + '</select>';
  h += '<select onchange="setFiltroBusqueda(\'as400\',this.value)"><option value="">AS-400 (todas)</option>'
     + '<option value="NO" '+(searchFiltros.as400==="NO"?"selected":"")+'>Pendientes de cargar</option>'
     + '<option value="SI" '+(searchFiltros.as400==="SI"?"selected":"")+'>Ya cargadas</option>'
     + '</select>';
  if(filtrosActivos()) h += '<span class="moretog" onclick="limpiarFiltrosBusqueda()">'+icon('x',12)+' Limpiar filtros</span>';
  h += '</div>';
  return h;
}
function renderSearch(v){
  /* Se compara sin tildes: en el teléfono nadie escribe "María" con tilde, y el dictado por
     voz tampoco es constante con ellas. Antes buscar "maria" no encontraba a "María López".
     Además se buscan todas las palabras por separado, así "lopez maria" también da con ella. */
  const q = normTexto(mode.q);
  const palabras = q.split(/\s+/).filter(Boolean);
  function coincide(campos){
    if(!palabras.length) return true;
    const texto = campos.map(normTexto).join(" ");
    return palabras.every(function(p){ return texto.indexOf(p)>=0; });
  }
  const ids = Object.keys(BIENES).filter(function(id){
    const b=BIENES[id];
    if(!bienCoincideFiltros(b)) return false;
    if(!q) return true;
    return coincide([b.codigo, b.descripcion, b.responsable, b.tarjetaNumero, b.codigoSiges, b.colaborador]);
  });
  const hz = q ? Object.values(HALLAZGOS).filter(function(z){
    return coincide([z.inv, z.desc]);
  }) : [];
  let h = renderBarraFiltros();
  h += '<div class="hint">'+(ids.length+hz.length)+' resultado(s)'+(q?' para "'+esc(mode.q)+'"':(filtrosActivos()?' con estos filtros':''))+'.</div>';
  if(hz.length) h += hz.map(hallCard).join("");
  if(ids.length===0 && hz.length===0) h += emptyState('Sin coincidencias', q?'Si el bien no está en el listado, use Nueva toma o Hallazgo':'Pruebe con otros filtros');
  else h += ids.slice(0,200).map(function(id){ return itemCard(BIENES[id], true); }).join("");
  v.innerHTML = h; loadThumbs();
}

/* ================= HALLAZGOS ================= */
function openHall(){ mode={view:"hall",tarjetaId:null,filter:"todos",q:""}; resetFiltrosBusqueda(); document.getElementById("search").value=""; render(); window.scrollTo(0,0); }
function renderHall(v){
  const list = Object.values(HALLAZGOS).sort(function(a,b){ return (b.creadoTs||0)-(a.creadoTs||0); });
  let h='<button class="backbtn" onclick="goHome()">‹ Responsables</button>';
  h+='<div style="margin:6px 2px 8px"><div style="font-size:18px;font-weight:800;color:#7A4508">'+icon('camera',17,'margin-right:6px')+'Hallazgos</div>'
    +'<div style="font-size:12.5px;color:#8A929C;margin-top:2px">Bienes encontrados que NO están en ninguna tarjeta.</div></div>';
  h+='<button class="act n" style="margin:4px 0 14px" onclick="newHallazgo()">'+icon('plusCircle',16,'margin-right:6px')+'Agregar bien encontrado</button>';
  if(list.length===0) h+=emptyState('Aún no hay hallazgos anotados');
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
    +'<div class="tools"><button class="fotobtn" id="fb_H'+z.id+'" onclick="takePhoto(\'H'+z.id+'\')">'+icon('camera',15)+' Foto</button>'
      +'<img class="thumb" id="th_H'+z.id+'" style="display:none" onclick="viewPhoto(\'H'+z.id+'\')">'
      +'<span class="moretog" onclick="editHallazgo(\''+z.id+'\')">✏️ Editar</span>'
      +'<span class="moretog" style="color:var(--rojo)" onclick="delHallazgo(\''+z.id+'\')">'+icon('trash',13)+' Borrar</span></div>'
    +'<div class="stamp">Anotado '+esc(z.f||"")+(z.by?" · "+esc(z.by):"")+'</div>'
  +'</div>';
}
function hfUbic(L){ const el=document.getElementById("hf_ubi"); if(el){ el.value=L; el.focus(); } }
function newHallazgo(){ if(!requiereEdicion()) return; hallForm(null); }
function editHallazgo(id){ hallForm(HALLAZGOS[id]||null); }
function hallForm(z){
  document.getElementById("sheet").innerHTML =
    '<div class="grip"></div><h3>'+(z?"Editar hallazgo":icon('plusCircle',17,'margin-right:6px')+"Bien encontrado (hallazgo)")+'</h3>'
    +'<div class="fform">'
    +'<label>No. de inventario (si tiene placa)</label><input id="hf_inv" type="text" value="'+esc(z?z.inv:"")+'" placeholder="Ej. 512345 o vacío">'
    +'<label>Descripción del bien *</label><input id="hf_desc" type="text" value="'+esc(z?z.desc:"")+'" placeholder="Ej. Silla secretarial negra">'
    +'<label>Cantidad</label><input id="hf_cant" type="number" min="1" value="'+(z?z.cant:1)+'">'
    +'<label>¿Con quién / dónde se encontró?</label><input id="hf_resp" type="text" value="'+esc(z?z.resp:"")+'" placeholder="Nombre de la persona o lugar">'
    // Se ofrecen las mismas ubicaciones que el resto de la app, para que los reportes no queden
    // con nombres distintos para el mismo lugar. Igual se puede escribir un detalle libre.
    +'<label>Ubicación física</label>'
    +'<div class="bgrp" style="flex-wrap:wrap;gap:6px;margin-bottom:6px">'
      + LOCS.map(function(L){ return '<button class="btn" style="flex:1 1 45%;font-size:12.5px;padding:9px 6px" onclick="hfUbic(\''+esc(L)+'\')">'+esc(L)+'</button>'; }).join("")
    +'</div>'
    +'<input id="hf_ubi" type="text" value="'+esc(z?z.ubi:"")+'" placeholder="Toque un lugar o escríbalo (ej. Bodega, pasillo 2)">'
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
  if(!requiereEdicion()) return;
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
  if(!requiereEdicion()) return;
  if(!confirm("¿Borrar este hallazgo?")) return;
  fotoDel("H"+id);
  db.collection("hallazgos").doc(id).delete().then(function(){ toast("Borrado"); }).catch(function(){ toast("No se pudo borrar"); });
}

/* ================= NUEVA TOMA (levantar por persona / reasignar) ================= */
function newSession(){
  if(!requiereEdicion()) return;
  fotoDel("Lses");
  curSes = { tipo:"existente", tarjetaId:null, numero:"", persona:"", empleado:"", correo:"", loc:"", foto:0, items:[], firmaB64:null };
  mode.view="ses"; mode.q=""; resetFiltrosBusqueda(); document.getElementById("search").value=""; render(); window.scrollTo(0,0);
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
    + '<div class="tbtn '+(s.tipo==="existente"?"sel":"")+'" onclick="sesSetTipo(\'existente\')">'+icon('refreshCw',15,'margin-right:5px')+'Tarjeta existente</div>'
    + '<div class="tbtn '+(s.tipo==="nueva"?"sel":"")+'" onclick="sesSetTipo(\'nueva\')">'+icon('plusCircle',15,'margin-right:5px')+'Tarjeta nueva</div>'
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
  LOCS.forEach(function(L){ h+='<button class="btn '+(s.loc===L?"b-si sel":"")+'" style="text-align:left;font-size:13px;display:flex;align-items:center;gap:8px" onclick="sesSetLoc(\''+esc(L)+'\')">'
    + icon(s.loc===L?'check':'mapPin',15) + esc(L)+'</button>'; });
  h += '</div>';
  h += '<div class="tools" style="margin-top:10px"><button class="fotobtn" id="fb_Lses" data-label="Foto del lugar" onclick="takePhoto(\'Lses\')">'+icon('camera',15)+' Foto del lugar</button>'
     + '<img class="thumb" id="th_Lses" style="display:none" onclick="viewPhoto(\'Lses\')"></div>';
  h += '<label style="margin-top:10px">Firma de recibido (opcional)</label>'
     + '<div style="font-size:11.5px;color:#8A929C;margin-bottom:6px">Si el responsable está presente, que firme aquí como constancia de que recibió los bienes.</div>'
     + '<canvas id="firmaPad" style="width:100%;height:140px;border:1.5px dashed #C7CEDA;border-radius:10px;background:#fff;touch-action:none;cursor:crosshair"></canvas>'
     + '<div style="display:flex;justify-content:space-between;align-items:center;margin-top:6px">'
     + '<span style="font-size:11.5px;color:#8A929C" id="firmaEstado">Sin firmar</span>'
     + '<span class="moretog" onclick="limpiarFirma()">Borrar firma</span></div>';
  h += '</div></div>';
  h += '<div class="item"><label style="font-size:12px;color:#5B6470;font-weight:700">Números de bien que tiene esta persona</label>'
     + '<div style="display:flex;gap:8px;margin-top:6px"><input id="invin" style="flex:1;padding:12px;border:1.5px solid #E2E6EC;border-radius:10px;font-size:17px;font-weight:700" placeholder="Léalo del bien y escríbalo" onkeydown="if(event.key===\'Enter\'){event.preventDefault();addInv();}">'
     + '<button class="act p" style="margin:0;width:auto;padding:0 18px" onclick="addInv()">Agregar</button></div>'
     + '<div style="font-size:11.5px;color:#8A929C;margin-top:6px"><span id="sescount">'+s.items.length+'</span> bien(es) en esta toma</div></div>';
  h += '<div id="sesitems">'+s.items.map(sesItemCard).join("")+'</div>';
  h += '<button class="act g" onclick="saveSession()">✓ Guardar toma y enviar correo (<span id="sessavecount">'+s.items.length+'</span> bienes)</button>';
  v.innerHTML = h; loadThumbs();
  setTimeout(initFirmaPad, 50);
}
/* ================= FIRMA DE RECIBIDO (canvas) ================= */
let firmaCtx=null, firmaDibujando=false, firmaTieneTrazo=false;
function initFirmaPad(){
  const cv = document.getElementById("firmaPad"); if(!cv || !curSes) return;
  const rect = cv.getBoundingClientRect();
  const w = Math.max(1, Math.round(rect.width)), h2 = Math.max(1, Math.round(rect.height));
  cv.width = w*2; cv.height = h2*2;
  firmaCtx = cv.getContext("2d");
  firmaCtx.scale(2,2);
  firmaCtx.fillStyle="#fff"; firmaCtx.fillRect(0,0,w,h2);
  firmaCtx.strokeStyle="#17202e"; firmaCtx.lineWidth=2.2; firmaCtx.lineCap="round"; firmaCtx.lineJoin="round";
  firmaDibujando=false; firmaTieneTrazo=false;
  if(curSes.firmaB64){
    const img=new Image();
    img.onload=function(){ firmaCtx.drawImage(img,0,0,w,h2); };
    img.src="data:image/jpeg;base64,"+curSes.firmaB64;
    firmaTieneTrazo=true;
  }
  actualizarFirmaEstado();
  function pos(e){
    const r=cv.getBoundingClientRect();
    const p = (e.touches&&e.touches[0]) ? e.touches[0] : e;
    return {x:p.clientX-r.left, y:p.clientY-r.top};
  }
  function start(e){ e.preventDefault(); firmaDibujando=true; const p=pos(e); firmaCtx.beginPath(); firmaCtx.moveTo(p.x,p.y); }
  function move(e){ if(!firmaDibujando) return; e.preventDefault(); const p=pos(e); firmaCtx.lineTo(p.x,p.y); firmaCtx.stroke(); firmaTieneTrazo=true; actualizarFirmaEstado(); }
  function end(){ if(!firmaDibujando) return; firmaDibujando=false; guardarFirmaCanvas(); }
  cv.onpointerdown=start; cv.onpointermove=move; cv.onpointerup=end; cv.onpointerleave=end; cv.onpointercancel=end;
}
function actualizarFirmaEstado(){
  const el=document.getElementById("firmaEstado"); if(el) el.textContent = firmaTieneTrazo?"✓ Firmado":"Sin firmar";
}
function guardarFirmaCanvas(){
  if(!curSes || !firmaTieneTrazo) return;
  const cv=document.getElementById("firmaPad"); if(!cv) return;
  curSes.firmaB64 = cv.toDataURL("image/jpeg",0.85).split(",")[1];
}
function limpiarFirma(){
  if(curSes) curSes.firmaB64=null;
  initFirmaPad();
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
function abrirFusion(){ if(!requiereEdicion()) return; _fusion = {origen:null, destino:null}; renderFusionSheet(); }
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
  if(!requiereEdicion()) return;
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
    +'<div class="tools"><button class="fotobtn" id="fb_A'+it.iid+'" onclick="takePhoto(\'A'+it.iid+'\')">'+icon('camera',15)+' Foto</button>'
      +'<img class="thumb" id="th_A'+it.iid+'" style="display:none" onclick="viewPhoto(\'A'+it.iid+'\')">'
       +(it.fotoUrl?'<a class="drivefoto" href="'+it.fotoUrl+'" target="_blank" rel="noopener"><img class="dthumb" src="'+driveThumbUrl(it.fotoUrl)+'" loading="lazy" alt="foto">🖼️ Ver foto</a>':'')
      +'<span class="moretog" style="color:var(--rojo)" onclick="delSesItem(\''+it.iid+'\')">'+icon('trash',13)+' Quitar</span></div>'
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
  if(!requiereEdicion()) return;
  const s = curSes;
  if(!s.persona || !s.persona.trim()){ toast("Escriba el nombre del responsable"); return; }
  if(!s.loc){ toast("Elija la ubicación"); return; }
  if(s.items.length===0){ toast("Agregue al menos un número de bien"); return; }
  toast("Guardando…");
  resolverTarjetaDestino(s).then(function(dest){
    const batch = db.batch();
    const nowTxt = today();
    if(s.firmaB64){
      batch.set(db.collection("tarjetas").doc(dest.id), {firmaRecibida:true, firmaFecha:nowTxt, firmaPersona:s.persona}, {merge:true});
    }
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
    if(s.firmaB64){
      const nombreFirma = "FIRMA_"+sanit(s.persona)+"_"+dest.id+".jpg";
      fotoPut({k:"S"+dest.id, b64:s.firmaB64, name:nombreFirma, ts:Date.now()});
      subirFoto(nombreFirma, s.firmaB64).then(function(url){
        if(url) db.collection("tarjetas").doc(dest.id).update({firmaUrl:url}).catch(function(){});
      });
    }
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
  if(s.firmaB64){ fotoPromesas.push(Promise.resolve({name: "FIRMA_"+sanit(s.persona)+".jpg", b64: s.firmaB64})); }
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
/* Las fotos se recuerdan en memoria: cada dibujado de una lista consultaba la base de fotos
   una vez por bien (una transacción por tarjeta, en cada dibujado). Al escribir o al
   sincronizar eso se repetía sin necesidad. El recuerdo se actualiza al guardar o borrar. */
const _fotoCache = new Map();
const _FOTO_CACHE_MAX = 60; // las fotos pesan; se recuerdan solo las últimas usadas
function _fotoCacheSet(k, r){
  if(_fotoCache.has(k)) _fotoCache.delete(k);   // reinsertar la deja como la más reciente
  _fotoCache.set(k, r);
  while(_fotoCache.size > _FOTO_CACHE_MAX){
    _fotoCache.delete(_fotoCache.keys().next().value); // sale la más antigua
  }
}
function fotoPut(rec){ return openIDB().then(function(d2){ return new Promise(function(res,rej){
  const tx=d2.transaction("fotos","readwrite"); tx.objectStore("fotos").put(rec);
  tx.oncomplete=function(){ _fotoCacheSet(rec.k, rec); res(); }; tx.onerror=rej; }); }); }
function fotoGet(k){
  if(_fotoCache.has(k)){
    const r = _fotoCache.get(k);
    _fotoCacheSet(k, r); // marcarla como recién usada
    return Promise.resolve(r);
  }
  return openIDB().then(function(d2){ return new Promise(function(res,rej){
    const rq=d2.transaction("fotos").objectStore("fotos").get(k);
    rq.onsuccess=function(){ const r=rq.result||null; _fotoCacheSet(k,r); res(r); }; rq.onerror=rej; }); });
}
function fotoDel(k){ return openIDB().then(function(d2){ return new Promise(function(res,rej){
  const tx=d2.transaction("fotos","readwrite"); tx.objectStore("fotos").delete(k);
  tx.oncomplete=function(){ _fotoCacheSet(k, null); res(); }; tx.onerror=rej; }); }); }
let camTarget=null;
function takePhoto(k){ if(!requiereEdicion()) return; camTarget=k; const c=document.getElementById("camin"); c.value=""; c.click(); }
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
  if(!requiereEdicion()) return;
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
/* El lector de Excel (SheetJS, ~500 KB) solo hace falta al importar, que es algo ocasional.
   Antes se bajaba en cada arranque de la app; ahora se pide en el momento. */
function cargarLectorExcel(){
  if(typeof XLSX!=="undefined") return Promise.resolve(true);
  if(window.__xlsxPromesa) return window.__xlsxPromesa;
  toast("Preparando el lector de Excel…");
  window.__xlsxPromesa = new Promise(function(res){
    const s = document.createElement("script");
    s.src = "https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js";
    s.onload = function(){ res(true); };
    s.onerror = function(){ window.__xlsxPromesa = null; res(false); };
    document.head.appendChild(s);
  });
  return window.__xlsxPromesa;
}
function importarExcel(){
  closeMenu();
  if(!requiereEdicion()) return;
  cargarLectorExcel().then(function(ok){
    if(!ok){ toast("No se pudo cargar el lector de Excel (revise su conexión)"); return; }
    mostrarImportarExcel();
  });
}
function mostrarImportarExcel(){
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
    // Se respeta la etiqueta propia del botón (p. ej. "Foto del lugar"); antes se perdía al refrescar.
    if(btn){ const etq=btn.getAttribute("data-label")||"Foto";
      btn.classList.toggle("has",!!r); btn.innerHTML=icon('camera',15)+(r?' '+etq+' '+icon('check',13,'margin-left:2px'):' '+etq); }
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
function deletePhoto(){ if(!requiereEdicion()) return; if(!photoKey) return;
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
  const sec = function(txt){ return '<div class="msec">'+txt+'</div>'; };
  document.getElementById("sheet").innerHTML =
    '<div class="grip"></div><h3>Menú</h3>'
    +'<div class="fld"><label>'+icon('user',14)+' ¿Quién realiza el inventario? (se anota en cada bien)</label>'
      +'<input id="byin" type="text" value="'+esc(META.by||"")+'" placeholder="Su nombre" oninput="META.by=this.value; saveMeta();"></div>'

    + sec("Revisar")
    +'<div class="mitem" onclick="abrirAvanceUbicacion()"><span class="ic">'+icon('mapPin',20)+'</span><div><b>Avance por ubicación</b><small>Cuánto falta por verificar en cada lugar</small></div></div>'
    +'<div class="mitem" onclick="abrirDiscrepancias()"><span class="ic">'+icon('alertTriangle',20)+'</span><div><b>Discrepancias</b><small>Todos los bienes marcados NO en un solo lugar</small></div></div>'
    +'<div class="mitem" onclick="abrirActividadReciente()"><span class="ic">'+icon('clock',20)+'</span><div><b>Actividad reciente</b><small>Últimos movimientos de todos los bienes</small></div></div>'
    +'<div class="mitem" onclick="abrirAsistente()"><span class="ic">'+icon('chat',20)+'</span><div><b>Asistente del inventario</b><small>Pregunte cantidades, valores o listados en lenguaje natural</small></div></div>'

    + sec("Herramientas")
    +'<div class="mitem" onclick="abrirFusion()"><span class="ic">'+icon('refreshCw',20)+'</span><div><b>Fusionar tarjetas duplicadas</b><small>Si la misma persona quedó con dos tarjetas</small></div></div>'

    + sec("Reportes")
    +'<div class="mitem" onclick="imprimirReporteEjecutivo()"><span class="ic">'+icon('clipboardCheck',20)+'</span><div><b>Reporte ejecutivo (PDF)</b><small>Resumen de una página: avance, diferencias y carga al AS-400</small></div></div>'
    +'<div class="mitem" onclick="generarExcel()"><span class="ic">'+icon('barChart',20)+'</span><div><b>Generar reporte en Excel</b><small>Resumen, bienes, discrepancias, tarjetas, personal, movimientos y hallazgos</small></div></div>'
    +'<div class="mitem" onclick="importarExcel()"><span class="ic">'+icon('upload',20)+'</span><div><b>Importar bienes nuevos desde Excel</b><small>Los crea como pendientes de asignar</small></div></div>'

    + sec("Configuración")
    +'<div class="fld"><label>'+icon('mail',14)+' URL de Apps Script (correos y fotos a Drive)</label>'
      +'<input id="gsin" type="url" value="'+esc(META.gsUrl||"")+'" placeholder="https://script.google.com/macros/s/…/exec" oninput="META.gsUrl=this.value; saveMeta();"></div>'
    +'<div class="mitem" onclick="verCodigoGS()"><span class="ic">'+icon('code',20)+'</span><div><b>Ver código para Apps Script</b><small>Cópielo y péguelo una sola vez</small></div></div>'
    +'<div class="mitem" onclick="probarGS()"><span class="ic">'+icon('zap',20)+'</span><div><b>Probar conexión de correo/fotos</b><small>'+(META.gsUrl?"Configurado":"Sin configurar")+'</small></div></div>'
    +'<div class="mitem" onclick="enviarCorreoPrueba()"><span class="ic">'+icon('mail',20)+'</span><div><b>Enviar correo de prueba (con foto)</b><small>Para confirmar que la foto sí llega adjunta</small></div></div>'

    + sec("Cuenta")
    +'<div class="mitem" onclick="cerrarSesion()"><span class="ic">'+icon('logOut',20)+'</span><div><b>Cerrar sesión</b><small>'+esc(firebase.auth().currentUser?firebase.auth().currentUser.email:"")+'</small></div></div>'
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
/* ================= AVANCE POR UBICACIÓN ================= */
function repararUbicaciones(){
  if(!requiereEdicion()) return;
  const updates = [];
  Object.values(BIENES).forEach(function(b){
    const raw = (b.ubicacion||"").trim();
    if(LOC_ALIASES[raw]) updates.push({id:b.id, nueva:LOC_ALIASES[raw]});
  });
  if(!updates.length){ toast("No había ubicaciones antiguas que corregir"); return; }
  if(!confirm('¿Actualizar la ubicación de '+updates.length+' bien(es) al nombre nuevo? (por ejemplo, "A.I. EDIFICIO OFICINAS CENTRALES" → "Oficinas Centrales")')) return;
  function chunk(arr,n){ const out=[]; for(let i=0;i<arr.length;i+=n) out.push(arr.slice(i,i+n)); return out; }
  const chunks = chunk(updates,400);
  let i=0;
  function next(){
    if(i>=chunks.length){ toast("✓ "+updates.length+" ubicación(es) actualizadas"); abrirAvanceUbicacion(); return; }
    const batch = db.batch();
    chunks[i].forEach(function(u){ batch.update(db.collection("bienes").doc(u.id), {ubicacion:u.nueva, actualizado: firebase.firestore.FieldValue.serverTimestamp()}); });
    i++;
    batch.commit().then(next).catch(function(e){ toast("Error: "+(e.message||e)); });
  }
  next();
}

/* ================= DISCREPANCIAS (los bienes marcados NO, en un solo lugar) =================
   "NO UBICADO" se retiró como opción, pero se siguen incluyendo los bienes que quedaron con ese
   valor de antes, para no esconder hallazgos ya registrados. Hay una herramienta para pasarlos a NO. */
function bienesNoUbicadoAntiguos(){
  return Object.values(BIENES).filter(function(b){ return b.existe==="NO UBICADO"; });
}
function discrepancias(){
  return Object.values(BIENES).filter(function(b){ return b.existe==="NO" || b.existe==="NO UBICADO"; })
    .sort(function(a,b){
      if(a.existe!==b.existe) return a.existe==="NO" ? -1 : 1;
      return (a.responsable||"").localeCompare(b.responsable||"");
    });
}
function convertirNoUbicado(){
  if(!requiereEdicion()) return;
  const items = bienesNoUbicadoAntiguos();
  if(!items.length){ toast("No hay bienes marcados NO UBICADO"); return; }
  if(!confirm('¿Pasar a "NO" los '+items.length+' bien(es) que quedaron marcados como NO UBICADO? Queda registrado en el historial de cada bien.')) return;
  closeMenu();
  toast("Actualizando "+items.length+" bien(es)…");
  function chunk(arr,n){ const out=[]; for(let i=0;i<arr.length;i+=n) out.push(arr.slice(i,i+n)); return out; }
  const chunks = chunk(items,200);
  let i=0;
  function next(){
    if(i>=chunks.length){ toast("✓ "+items.length+" bien(es) actualizados a NO"); render(); return; }
    const batch = db.batch();
    chunks[i].forEach(function(b){
      batch.update(db.collection("bienes").doc(b.id), {existe:"NO", actualizado: firebase.firestore.FieldValue.serverTimestamp()});
      const movRef = db.collection("movimientos").doc();
      batch.set(movRef, { codigo:b.codigo, tipoMovimiento:"VERIFICACION",
        tarjetaAnteriorNumero:"", responsableAnterior:"",
        tarjetaNuevaNumero:b.tarjetaNumero||"", responsableNuevo:b.responsable||"",
        existe:"NO", estado:b.estado||"", ubicacion:b.ubicacion||"",
        observaciones:'Se retiró la opción "NO UBICADO"; el bien pasó a NO',
        fecha: firebase.firestore.FieldValue.serverTimestamp(), fechaTxt: today(), capturadoPor: META.by||"" });
    });
    i++;
    batch.commit().then(next).catch(function(e){ toast("Error al actualizar: "+(e.message||e)); });
  }
  next();
}
function abrirDiscrepancias(){
  const items = discrepancias();
  const antiguos = bienesNoUbicadoAntiguos();
  const totalValor = items.reduce(function(s,b){ return s+Number(b.valor||0); },0);
  let h = '<div class="grip"></div><h3>Discrepancias</h3>'
    + '<div class="note">Todos los bienes marcados NO en la auditoría completa, para revisar sin entrar tarjeta por tarjeta.</div>';
  if(antiguos.length){
    h += '<div class="warnbox">'+icon('alertTriangle',13,'margin-right:4px')+antiguos.length+' bien(es) quedaron marcados como “NO UBICADO”, opción que ya se retiró.</div>'
      + (puedeEditar()?'<button class="act n" onclick="convertirNoUbicado()">Pasarlos todos a NO</button>':'');
  }
  if(!items.length){
    h += emptyState("No hay discrepancias registradas", "Todo lo verificado hasta ahora está en orden");
  } else {
    h += '<div class="hint">'+items.length+' bien(es) · '+money(totalValor)+' en total</div>';
    h += items.map(function(b){
      return '<div class="tlist-item" style="display:block">'
        + '<div style="display:flex;justify-content:space-between;gap:8px"><b>'+esc(b.codigo)+'</b>'
          + '<span style="font-weight:700;font-size:11.5px;color:'+(b.existe==="NO"?"var(--rojo)":"var(--naranja)")+'">'+esc(b.existe)+'</span></div>'
        + '<div class="powner">'+esc(b.descripcion||"(sin descripción)")+'</div>'
        + '<div class="powner">'+esc(b.responsable||"(sin responsable)")+(b.tarjetaNumero?" · Tarj. "+esc(b.tarjetaNumero):"")+' · '+money(b.valor)+'</div>'
      +'</div>';
    }).join("");
  }
  h += (items.length?'<button class="act p" onclick="exportarDiscrepancias()">Exportar discrepancias (CSV)</button>':"")
    + '<button class="act o" onclick="closeMenu()">Cerrar</button>';
  document.getElementById("sheet").innerHTML = h;
  showSheet();
}
function exportarDiscrepancias(){
  const items = discrepancias();
  const head=["No. INVENTARIO","DESCRIPCION","RESPONSABLE","No. TARJETA","ESTADO","VALOR","UBICACION","FECHA VERIFICACION","VERIFICADO POR"];
  function q(s){ s=(s==null?"":String(s)); return /[",\n]/.test(s)?'"'+s.replace(/"/g,'""')+'"':s; }
  const rows=[head.map(q).join(",")];
  items.forEach(function(b){
    rows.push([b.codigo,b.descripcion||"",b.responsable||"",b.tarjetaNumero||"",b.existe||"",b.valor||0,b.ubicacion||"",b.fechaVerificacion||"",b.verificadoPor||""].map(q).join(","));
  });
  const csv = "\uFEFF"+rows.join("\r\n");
  const blob = new Blob([csv],{type:"text/csv;charset=utf-8;"});
  const url = URL.createObjectURL(blob); const a=document.createElement("a");
  a.href=url; a.download="discrepancias_"+new Date().toISOString().slice(0,10)+".csv";
  document.body.appendChild(a); a.click();
  setTimeout(function(){URL.revokeObjectURL(url); a.remove();},1500);
  toast("Discrepancias exportadas ✓");
}
function abrirAvanceUbicacion(){
  const groups = {};
  let hayAliasViejos = false;
  Object.values(BIENES).forEach(function(b){
    const raw = (b.ubicacion||"").trim();
    if(LOC_ALIASES[raw]) hayAliasViejos = true;
    const label = raw || "Sin ubicación registrada";
    if(!groups[label]) groups[label] = { total:0, si:0, no:0, nu:0 };
    const g = groups[label];
    g.total++;
    if(b.existe==="SÍ") g.si++;
    else if(b.existe==="NO") g.no++;
    else if(b.existe==="NO UBICADO") g.nu++;
  });
  const keys = Object.keys(groups).sort(function(a,b){
    if(a==="Sin ubicación registrada") return 1;
    if(b==="Sin ubicación registrada") return -1;
    return groups[b].total - groups[a].total;
  });
  let h = '<div class="grip"></div><h3>Avance por ubicación</h3>'
    + '<div class="note">Según el campo "Ubicación física real" de cada bien — se llena al abrir "＋ Ubicación / observación" en la tarjeta, o automáticamente al hacer una Nueva toma.</div>'
    + (hayAliasViejos ? '<button class="act n" onclick="repararUbicaciones()">Unificar nombres antiguos de ubicación</button>' : '');
  if(!keys.length){
    h += emptyState("Todavía no hay bienes registrados");
  } else {
    h += keys.map(function(label){
      const g = groups[label];
      const pct = g.total ? Math.round(g.si/g.total*100) : 0;
      const pend = g.total-g.si-g.no-g.nu;
      const sub = [];
      if(g.si) sub.push(g.si+" verificado(s)");
      if(g.no) sub.push(g.no+" no está(n)");
      if(g.nu) sub.push(g.nu+" no ubicado(s)");
      if(pend) sub.push(pend+" pendiente(s)");
      const esSinUbicar = label==="Sin ubicación registrada";
      return '<div style="margin-bottom:16px">'
        +'<div style="display:flex;justify-content:space-between;align-items:baseline;gap:8px">'
          +'<b style="font-size:14px;color:'+(esSinUbicar?"var(--gris2)":"#17202e")+'">'+esc(label)+'</b>'
          +'<span style="font-size:12px;color:var(--gris2);flex:none">'+g.si+' / '+g.total+' ('+pct+'%)</span>'
        +'</div>'
        +'<div class="locbarwrap"><div class="locbar" style="width:'+pct+'%"></div></div>'
        +'<div style="font-size:11.5px;color:var(--gris2);margin-top:4px">'+sub.join(" · ")+'</div>'
      +'</div>';
    }).join("");
  }
  h += '<button class="act o" onclick="closeMenu()">Cerrar</button>';
  document.getElementById("sheet").innerHTML = h;
  showSheet();
}

/* El reporte en Excel se genera en js/excel-report.js, con formato institucional. */
