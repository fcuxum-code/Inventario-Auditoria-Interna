(function(){
  "use strict";
  // Herramientas de administración: ver bienes por ubicación y asignar tarjeta en lote.
  // Se integran como dos entradas más del menú ☰ (mismo look que el resto de la app),
  // en vez de un botón flotante con un panel propio.
  var norm=function(s){return (s||'').toString().normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();};
  var UBIC = ["Oficinas Centrales","Anexo C.C. z.4","Anexo Torre Café","Archivo General"];

  var H={
    cache:null,
    getBienes:async function(force){
      if(this.cache&&!force) return this.cache;
      var snap=await firebase.firestore().collection('bienes').get();
      this.cache=snap.docs.map(function(d){var o=d.data();o.id=d.id;return o;});
      return this.cache;
    },
    byUbic:async function(u){var all=await this.getBienes();return all.filter(function(b){return (b.ubicacion||'')===u;});},
    findByPerson:async function(q){
      var all=await this.getBienes();var nq=norm(q);if(!nq)return [];
      return all.filter(function(b){return norm(b.responsable).indexOf(nq)>=0||norm(b.colaborador).indexOf(nq)>=0||norm(b.observaciones).indexOf(nq)>=0||norm(b.tarjetaNumero).indexOf(nq)>=0||norm(b.tarjetaId).indexOf(nq)>=0;});
    },
    assignTarjeta:async function(ids,numero,responsable){
      var db=firebase.firestore();numero=(numero||'').toString().trim();responsable=(responsable||'').toString().trim();
      if(!numero) throw new Error('Falta el número de tarjeta');
      var tref=db.collection('tarjetas').doc(numero);var tsnap=await tref.get();
      var FV=firebase.firestore.FieldValue;
      if(!tsnap.exists){await tref.set({numero:numero,activa:true,responsable:responsable||'',creada:FV.serverTimestamp(),actualizada:FV.serverTimestamp()},{merge:true});}
      else if(responsable){await tref.set({responsable:responsable,actualizada:FV.serverTimestamp()},{merge:true});}
      var done=0;
      for(var i=0;i<ids.length;i+=400){
        var batch=db.batch();
        ids.slice(i,i+400).forEach(function(id){var ref=db.collection('bienes').doc(id);var upd={tarjetaId:numero,tarjetaNumero:numero};if(responsable)upd.responsable=responsable;batch.set(ref,upd,{merge:true});});
        await batch.commit();done+=Math.min(400,ids.length-i);
      }
      this.cache=null;return done;
    }
  };
  window.__HERR=H;

  /* ---------- Ver bienes por ubicación ---------- */
  window.herrAbrirUbicacion=function(){
    var h='<div class="grip"></div><h3>Bienes por ubicación</h3>'
      +'<div class="note">Elige una ubicación para ver los bienes registrados ahí.</div>'
      +'<div style="display:flex;flex-wrap:wrap;gap:8px;margin:10px 0">'
      + UBIC.map(function(u){ return '<button type="button" class="herrUbicBtn btn" style="flex:0 0 auto;padding:9px 14px" data-u="'+u.replace(/"/g,'&quot;')+'">'+u+'</button>'; }).join('')
      +'</div>'
      +'<div id="herrUbicResult"></div>'
      +'<button class="act o" onclick="closeMenu()">Cerrar</button>';
    document.getElementById('sheet').innerHTML=h;
    showSheet();
    document.querySelectorAll('.herrUbicBtn').forEach(function(btn){
      btn.addEventListener('click', function(){ herrVerUbicacion(btn.dataset.u); });
    });
  };
  window.herrVerUbicacion=async function(u){
    var box=document.getElementById('herrUbicResult'); if(!box) return;
    box.innerHTML='<div class="hint">Cargando…</div>';
    var list=await H.byUbic(u);
    if(!list.length){ box.innerHTML='<div class="hint">'+esc(u)+'</div>'+emptyState('Sin bienes en esta ubicación'); return; }
    box.innerHTML='<div class="hint">'+esc(u)+' · '+list.length+' bien(es)</div>'
      + list.map(function(b){
          return '<div class="tlist-item"><div><b>'+esc(b.id)+'</b><small>'+esc((b.descripcion||'').slice(0,50))+' · '+esc(b.responsable||'—')+'</small></div>'
            +'<span style="color:#8A929C;font-size:12px;flex:none">Tarj. '+esc(b.tarjetaNumero||'—')+'</span></div>';
        }).join('');
  };

  /* ---------- Asignar tarjeta en lote ---------- */
  window.herrAbrirAsignarLote=function(){
    if(typeof requiereEdicion==='function' && !requiereEdicion()) return;
    var h='<div class="grip"></div><h3>Asignar tarjeta en lote</h3>'
      +'<div class="note">Busca por empleado o número de tarjeta, marca los bienes y asígnales un número de tarjeta a todos de una vez.</div>'
      +'<div class="fld"><input id="herrPersQ" type="text" placeholder="Nombre de empleado o No. de tarjeta"></div>'
      +'<button class="act p" onclick="herrBuscarLote()">Buscar</button>'
      +'<div id="herrPersResult" style="margin-top:8px"></div>'
      +'<div id="herrPersAssign" style="display:none;border-top:1px solid var(--linea);padding-top:10px;margin-top:10px">'
        +'<label>No. de tarjeta *</label><input id="herrAsgNum" type="text" style="width:100%;padding:10px;border:1.4px solid var(--linea);border-radius:9px;margin-bottom:8px">'
        +'<label>Responsable (opcional)</label><input id="herrAsgResp" type="text" style="width:100%;padding:10px;border:1.4px solid var(--linea);border-radius:9px;margin-bottom:10px">'
        +'<button class="act g" onclick="herrConfirmarLote()">Asignar a seleccionados</button>'
        +'<div id="herrAsgMsg" style="margin-top:8px;font-weight:600;font-size:13px"></div>'
      +'</div>'
      +'<button class="act o" onclick="closeMenu()">Cerrar</button>';
    document.getElementById('sheet').innerHTML=h;
    showSheet();
    setTimeout(function(){
      var q=document.getElementById('herrPersQ');
      if(q){ q.focus(); q.addEventListener('keydown',function(e){ if(e.key==='Enter') herrBuscarLote(); }); }
    },150);
  };
  window.herrBuscarLote=async function(){
    var q=document.getElementById('herrPersQ').value;
    var box=document.getElementById('herrPersResult');
    var asg=document.getElementById('herrPersAssign');
    if(!q.trim()){ box.innerHTML='<div class="hint">Escribe un nombre o número.</div>'; asg.style.display='none'; return; }
    box.innerHTML='<div class="hint">Buscando…</div>';
    var list=await H.findByPerson(q);
    if(!list.length){ box.innerHTML=emptyState('Sin resultados'); asg.style.display='none'; return; }
    box.innerHTML='<div class="hint">'+list.length+' bien(es) encontrados</div>'
      +'<label style="display:flex;align-items:center;gap:6px;font-size:13px;margin:4px 0 8px"><input type="checkbox" id="herrSelAll" checked> Seleccionar todos</label>'
      + list.map(function(b){
          return '<label class="tlist-item" style="cursor:pointer"><span style="display:flex;align-items:center;gap:10px;flex:1;min-width:0">'
            +'<input type="checkbox" class="herrBchk" data-id="'+esc(b.id)+'" checked>'
            +'<span style="min-width:0"><b>'+esc(b.id)+'</b><small style="display:block">'+esc(b.responsable||'—')+' · Tarj. '+esc(b.tarjetaNumero||'—')+(b.ubicacion?' · '+esc(b.ubicacion):'')+'</small></span></span></label>';
        }).join('');
    asg.style.display='block';
    var selAll=document.getElementById('herrSelAll');
    selAll.onchange=function(){ document.querySelectorAll('.herrBchk').forEach(function(c){c.checked=selAll.checked;}); };
    var cnt={}; list.forEach(function(b){ if(b.responsable) cnt[b.responsable]=(cnt[b.responsable]||0)+1; });
    var top=Object.entries(cnt).sort(function(a,b){return b[1]-a[1];})[0];
    if(top) document.getElementById('herrAsgResp').value=top[0];
  };
  window.herrConfirmarLote=async function(){
    if(typeof requiereEdicion==='function' && !requiereEdicion()) return;
    var num=document.getElementById('herrAsgNum').value.trim();
    var resp=document.getElementById('herrAsgResp').value.trim();
    var msg=document.getElementById('herrAsgMsg');
    var ids=Array.prototype.slice.call(document.querySelectorAll('.herrBchk')).filter(function(c){return c.checked;}).map(function(c){return c.dataset.id;});
    if(!num){ msg.style.color='var(--rojo)'; msg.textContent='Escribe el número de tarjeta.'; return; }
    if(!ids.length){ msg.style.color='var(--rojo)'; msg.textContent='Selecciona al menos un bien.'; return; }
    if(!confirm('¿Asignar la tarjeta '+num+' a '+ids.length+' bien(es)?')) return;
    msg.style.color='var(--gris)'; msg.textContent='Asignando…';
    try{
      var n=await H.assignTarjeta(ids,num,resp);
      msg.style.color='var(--verde)'; msg.textContent='✓ Tarjeta '+num+' asignada a '+n+' bien(es).';
      herrBuscarLote();
    }catch(e){ msg.style.color='var(--rojo)'; msg.textContent='Error: '+e.message; }
  };

  /* ---------- Inyectar entradas en el menú ☰ ---------- */
  var origOpenMenu=window.openMenu;
  if(typeof origOpenMenu==='function'){
    window.openMenu=function(){
      origOpenMenu.apply(this,arguments);
      var sheet=document.getElementById('sheet'); if(!sheet) return;
      if(sheet.querySelector('#herrMenuMarker')) return;
      /* Antes se colgaba de la opción "Fusionar tarjetas duplicadas". Al quitarse esa opción
         estas dos se iban al final del menú, debajo de Cerrar sesión, así que ahora se
         cuelgan del encabezado "Herramientas", que es su sección. */
      var anchor=null;
      var secciones=sheet.querySelectorAll('.msec');
      for(var i=0;i<secciones.length;i++){
        if(/Herramientas/i.test(secciones[i].textContent)){ anchor=secciones[i]; break; }
      }
      var html='<div class="mitem" onclick="herrAbrirUbicacion()"><span class="ic">'+icon('search',20)+'</span><div><b id="herrMenuMarker">Ver bienes por ubicación</b><small>Buscar todo lo que hay en un lugar</small></div></div>'
        +'<div class="mitem" onclick="herrAbrirAsignarLote()"><span class="ic">'+icon('layers',20)+'</span><div><b>Asignar tarjeta en lote</b><small>Por empleado o No. de tarjeta, varios bienes a la vez</small></div></div>';
      if(anchor) anchor.insertAdjacentHTML('afterend', html);
      else sheet.insertAdjacentHTML('beforeend', html);
    };
  }
})();
