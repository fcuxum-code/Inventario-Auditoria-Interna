/* ================= MODO RÁPIDO DE VERIFICACIÓN =================
   Recorre los bienes de una tarjeta uno por uno a pantalla completa, con botones grandes,
   para hacer la toma con el empleado enfrente sin ir buscando cada bien en la lista.
   Guarda exactamente igual que la pantalla normal (mismo campo y mismo movimiento de
   auditoría), así que lo marcado aquí y lo marcado allá es indistinguible en los reportes. */
(function(){
  "use strict";

  var cola = [], idx = 0, tarjetaId = null, hechos = {si:0, no:0, saltados:0};

  function el(){ return document.getElementById("mrap"); }

  window.abrirModoRapido = function(tid, incluirTodos){
    if(typeof requiereEdicion==="function" && !requiereEdicion()) return;
    var t = TARJETAS[tid]; if(!t) return;
    tarjetaId = tid;
    var todos = bienesDe(tid).slice().sort(function(a,b){ return (a.codigo||"").localeCompare(b.codigo||""); });
    var pendientes = todos.filter(function(b){ return !b.existe; });
    cola = (incluirTodos || !pendientes.length) ? todos : pendientes;
    if(!cola.length){ toast("Esta tarjeta no tiene bienes"); return; }
    idx = 0; hechos = {si:0, no:0, saltados:0};
    pintar();
  };

  function cerrar(){
    var c = el(); if(c) c.remove();
    document.body.style.overflow = "";
    if(typeof render==="function") render();
  }
  window.mrCerrar = cerrar;

  function contenedor(){
    var c = el();
    if(!c){
      c = document.createElement("div");
      c.id = "mrap";
      document.body.appendChild(c);
      document.body.style.overflow = "hidden";
    }
    return c;
  }

  function pintar(){
    var c = contenedor();
    if(idx >= cola.length){ c.innerHTML = htmlFinal(); return; }
    // Se relee de BIENES para reflejar lo ya guardado (la sincronización es en vivo).
    var b = BIENES[cola[idx].id] || cola[idx];
    var t = TARJETAS[tarjetaId] || {};
    var pct = Math.round(idx / cola.length * 100);
    var marcado = b.existe === "SÍ";

    c.innerHTML =
      '<div class="mrtop">'
      + '<button class="mrx" onclick="mrCerrar()" aria-label="Salir">'+icon('x',20)+'</button>'
      + '<div class="mrprog"><div class="mrprogtxt">'+(idx+1)+' de '+cola.length+' · '+esc(t.responsable||"")+'</div>'
      + '<div class="mrbarwrap"><div class="mrbar" style="width:'+pct+'%"></div></div></div>'
      + '</div>'
      + '<div class="mrbody">'
        + '<div class="mrcod">'+esc(b.codigo||"")+'</div>'
        + '<div class="mrdesc">'+esc(b.descripcion||"(sin descripción)")+'</div>'
        + '<div class="mrmeta">'+money(b.valor)+(b.ubicacion?('  ·  '+esc(b.ubicacion)):"")+'</div>'
        + (b.existe? '<div class="mrya">Ya estaba marcado como '+esc(b.existe)+'</div>' : '')
      + '</div>'
      + '<div class="mracc">'
        + '<div class="mrsino">'
          + '<button class="mrbtn si" onclick="mrMarcar(\'SÍ\')">'+icon('check',30)+'<span>SÍ</span><small>está aquí</small></button>'
          + '<button class="mrbtn no" onclick="mrMarcar(\'NO\')">'+icon('x',30)+'<span>NO</span><small>no está</small></button>'
          + '</div>'
        + '<div class="mrestopt">'
          + '<div class="mrestlbl">o toque el estado — marca SÍ y avanza</div>'
          + '<div class="mrest">'
          + ['BUENO','REGULAR','MALO','PARA BAJA'].map(function(e){
              var etq = e==="PARA BAJA" ? "Para baja" : e.charAt(0)+e.slice(1).toLowerCase();
              var cl = e==="PARA BAJA" ? "baja" : e.toLowerCase();
              return '<button class="mrestbtn e-'+cl+(b.estado===e?' sel':'')+'" onclick="mrMarcarEstado(\''+e+'\')">'+esc(etq)+'</button>';
            }).join("")
          + '</div>'
          + '</div>'
        + '<div class="mrnav">'
          + (idx>0 ? '<span class="mrlink" onclick="mrAtras()">‹ Anterior</span>' : '<span></span>')
          + '<span class="mrlink" onclick="mrSaltar()">Saltar por ahora ›</span>'
        + '</div>'
      + '</div>';
  }

  function htmlFinal(){
    var t = TARJETAS[tarjetaId] || {};
    var restantes = bienesDe(tarjetaId).filter(function(b){ return !b.existe; }).length;
    return '<div class="mrtop"><button class="mrx" onclick="mrCerrar()" aria-label="Cerrar">'+icon('x',20)+'</button>'
      + '<div class="mrprog"><div class="mrprogtxt">Listo · '+esc(t.responsable||"")+'</div>'
      + '<div class="mrbarwrap"><div class="mrbar" style="width:100%"></div></div></div></div>'
      + '<div class="mrfin">'
        + '<div class="mrfinic">'+icon('check',44)+'</div>'
        + '<div class="mrfintit">Recorrido terminado</div>'
        + '<div class="mrfinres">'
          + '<div><b>'+hechos.si+'</b><span>marcados SÍ</span></div>'
          + '<div><b>'+hechos.no+'</b><span>marcados NO</span></div>'
          + '<div><b>'+hechos.saltados+'</b><span>saltados</span></div>'
        + '</div>'
        + (restantes ? '<div class="mrfinnota">Quedan '+restantes+' bien(es) sin verificar en esta tarjeta.</div>' : '<div class="mrfinnota">Todos los bienes de esta tarjeta quedaron verificados.</div>')
        + (restantes ? '<button class="mrsig" onclick="abrirModoRapido(\''+tarjetaId+'\')">Seguir con los que faltan</button>' : '')
        + '<button class="mrsalir" onclick="mrCerrar()">Volver a la ficha</button>'
      + '</div>';
  }

  function guardarVerif(b, val, estado){
    var patch = { existe: val, actualizado: firebase.firestore.FieldValue.serverTimestamp(),
                  fechaVerificacion: today(), verificadoPor: (META.by||"") };
    if(estado) patch.estado = estado;
    firebase.firestore().collection("bienes").doc(b.id).update(patch)
      .catch(function(){ toast("No se pudo guardar (revise conexión)"); });
    if(typeof logMovimiento==="function"){
      logMovimiento(b, {tipoMovimiento:"VERIFICACION", estado: estado||b.estado||"", existe:val,
                        ubicacion:b.ubicacion||"", observaciones:b.observaciones||""});
    }
    if(BIENES[b.id]){ BIENES[b.id].existe = val; if(estado) BIENES[b.id].estado = estado; } // reflejar ya, sin esperar la nube
  }

  // SÍ o NO: un solo toque, marca y pasa al siguiente. El estado es opcional.
  window.mrMarcar = function(val){
    var b = cola[idx]; if(!b) return;
    guardarVerif(b, val);
    if(val==="SÍ") hechos.si++; else hechos.no++;
    avanzar();
  };

  // Tocar un estado = "está aquí, en este estado": marca SÍ + estado y avanza (un solo toque).
  window.mrMarcarEstado = function(e){
    var b = cola[idx]; if(!b) return;
    guardarVerif(b, "SÍ", e);
    hechos.si++;
    avanzar();
  };

  // Compatibilidad con nombres anteriores.
  window.mrEstado = window.mrMarcarEstado;
  window.mrSiguiente = function(){ avanzar(); };
  window.mrSaltar = function(){ hechos.saltados++; avanzar(); };
  window.mrAtras = function(){ if(idx>0){ idx--; pintar(); } };

  function avanzar(){ idx++; pintar(); }
})();
