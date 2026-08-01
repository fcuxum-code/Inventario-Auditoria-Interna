(function(){
  if(document.getElementById('__herrBtn')) return;
  var norm=function(s){return (s||'').toString().normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();};
  var esc=function(s){return (s||'').toString().replace(/[&<>"]/g,function(c){return({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]);});};
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
  var btn=document.createElement('button');btn.id='__herrBtn';btn.textContent='🔧 Herramientas';
  btn.style.cssText='position:fixed;bottom:70px;right:14px;z-index:99998;background:#6d28d9;color:#fff;border:none;border-radius:24px;padding:12px 18px;font-size:15px;font-weight:700;box-shadow:0 3px 10px rgba(0,0,0,.3);cursor:pointer;';
  document.body.appendChild(btn);
  var panel=document.createElement('div');panel.id='__herrPanel';
  panel.style.cssText='display:none;position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,.55);overflow:auto;';
  panel.innerHTML='<div style="max-width:820px;margin:24px auto;background:#fff;border-radius:14px;padding:18px;font-family:system-ui">'+
    '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px"><h2 style="margin:0;font-size:20px;color:#1e293b">🔧 Herramientas</h2><button id="__herrClose" style="background:#e2e8f0;border:none;border-radius:8px;padding:8px 14px;font-size:16px;cursor:pointer">✕ Cerrar</button></div>'+
    '<div style="display:flex;gap:8px;margin-bottom:14px"><button class="__herrTab" data-t="ubic" style="flex:1;padding:10px;border:none;border-radius:8px;background:#6d28d9;color:#fff;font-weight:700;cursor:pointer">📍 Ver por ubicación</button><button class="__herrTab" data-t="pers" style="flex:1;padding:10px;border:none;border-radius:8px;background:#e2e8f0;color:#334155;font-weight:700;cursor:pointer">🎫 Asignar tarjeta en lote</button></div>'+
    '<div id="__herrUbic"><p style="color:#64748b;margin:0 0 10px">Elige una ubicación para ver todos los bienes que están allí:</p><div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:12px">'+
    '<button class="__ubicBtn" data-u="Oficinas Centrales" style="padding:9px 14px;border:1px solid #6d28d9;background:#fff;color:#6d28d9;border-radius:8px;cursor:pointer;font-weight:600">🏢 Oficinas Centrales</button>'+
    '<button class="__ubicBtn" data-u="Anexo C.C. z.4" style="padding:9px 14px;border:1px solid #6d28d9;background:#fff;color:#6d28d9;border-radius:8px;cursor:pointer;font-weight:600">🏬 Anexo C.C. z.4</button>'+
    '<button class="__ubicBtn" data-u="Anexo Torre Café" style="padding:9px 14px;border:1px solid #6d28d9;background:#fff;color:#6d28d9;border-radius:8px;cursor:pointer;font-weight:600">☕ Anexo Torre Café</button>'+
    '<button class="__ubicBtn" data-u="Archivo General" style="padding:9px 14px;border:1px solid #6d28d9;background:#fff;color:#6d28d9;border-radius:8px;cursor:pointer;font-weight:600">🗄️ Archivo General</button>'+
    '</div><div id="__ubicResult" style="max-height:52vh;overflow:auto"></div></div>'+
    '<div id="__herrPers" style="display:none"><p style="color:#64748b;margin:0 0 10px">Busca por <b>empleado</b> o <b>número de tarjeta</b>. Marca los bienes y asigna un número de tarjeta a todos de una vez:</p>'+
    '<div style="display:flex;gap:8px;margin-bottom:10px"><input id="__persQ" placeholder="Nombre de empleado o No. de tarjeta" style="flex:1;padding:10px;border:1px solid #cbd5e1;border-radius:8px;font-size:15px"><button id="__persSearch" style="padding:10px 16px;border:none;border-radius:8px;background:#6d28d9;color:#fff;font-weight:700;cursor:pointer">Buscar</button></div>'+
    '<div id="__persResult" style="max-height:38vh;overflow:auto;margin-bottom:10px"></div>'+
    '<div id="__persAssign" style="display:none;border-top:1px solid #e2e8f0;padding-top:10px"><div style="display:flex;gap:8px;flex-wrap:wrap;align-items:end">'+
    '<div><label style="font-size:12px;color:#64748b">No. de tarjeta *</label><br><input id="__asgNum" style="padding:9px;border:1px solid #cbd5e1;border-radius:8px;width:150px"></div>'+
    '<div><label style="font-size:12px;color:#64748b">Responsable (opcional)</label><br><input id="__asgResp" style="padding:9px;border:1px solid #cbd5e1;border-radius:8px;width:280px"></div>'+
    '<button id="__asgBtn" style="padding:11px 18px;border:none;border-radius:8px;background:#16a34a;color:#fff;font-weight:700;cursor:pointer">✔ Asignar a seleccionados</button></div>'+
    '<div id="__asgMsg" style="margin-top:8px;font-weight:600"></div></div></div></div>';
  document.body.appendChild(panel);
  btn.onclick=function(){panel.style.display='block';};
  panel.querySelector('#__herrClose').onclick=function(){panel.style.display='none';};
  panel.onclick=function(e){if(e.target===panel)panel.style.display='none';};
  panel.querySelectorAll('.__herrTab').forEach(function(tb){tb.onclick=function(){var t=tb.dataset.t;panel.querySelectorAll('.__herrTab').forEach(function(x){x.style.background='#e2e8f0';x.style.color='#334155';});tb.style.background='#6d28d9';tb.style.color='#fff';panel.querySelector('#__herrUbic').style.display=t==='ubic'?'block':'none';panel.querySelector('#__herrPers').style.display=t==='pers'?'block':'none';};});
  panel.querySelectorAll('.__ubicBtn').forEach(function(ub){ub.onclick=async function(){var u=ub.dataset.u;var box=panel.querySelector('#__ubicResult');box.innerHTML='<p style="color:#64748b">Cargando…</p>';var list=await H.byUbic(u);box.innerHTML='<p style="font-weight:700;color:#1e293b">'+esc(u)+': '+list.length+' bien(es)</p>'+(list.length?'<table style="width:100%;border-collapse:collapse;font-size:13px"><tr style="background:#f1f5f9;text-align:left"><th style="padding:6px">Bien</th><th style="padding:6px">Descripción</th><th style="padding:6px">Responsable</th><th style="padding:6px">Tarjeta</th></tr>'+list.map(function(b){return '<tr style="border-bottom:1px solid #eee"><td style="padding:6px">'+esc(b.id)+'</td><td style="padding:6px">'+esc((b.descripcion||'').slice(0,40))+'</td><td style="padding:6px">'+esc(b.responsable)+'</td><td style="padding:6px">'+esc(b.tarjetaNumero||'—')+'</td></tr>';}).join('')+'</table>':'<p style="color:#94a3b8">Sin bienes en esta ubicación.</p>');};});
  var lastResults=[];
  async function doSearch(){var q=panel.querySelector('#__persQ').value;var box=panel.querySelector('#__persResult');var asg=panel.querySelector('#__persAssign');if(!q.trim()){box.innerHTML='<p style="color:#94a3b8">Escribe un nombre o número.</p>';asg.style.display='none';return;}box.innerHTML='<p style="color:#64748b">Buscando…</p>';var list=await H.findByPerson(q);lastResults=list;if(!list.length){box.innerHTML='<p style="color:#94a3b8">Sin resultados.</p>';asg.style.display='none';return;}box.innerHTML='<p style="font-weight:700">'+list.length+' bien(es) encontrados <label style="font-weight:400;font-size:13px;margin-left:10px"><input type="checkbox" id="__selAll" checked> Seleccionar todos</label></p><table style="width:100%;border-collapse:collapse;font-size:13px"><tr style="background:#f1f5f9;text-align:left"><th style="padding:6px">✓</th><th style="padding:6px">Bien</th><th style="padding:6px">Responsable</th><th style="padding:6px">Colaborador</th><th style="padding:6px">Tarjeta actual</th><th style="padding:6px">Ubicación</th></tr>'+list.map(function(b){return '<tr style="border-bottom:1px solid #eee"><td style="padding:6px"><input type="checkbox" class="__bchk" data-id="'+esc(b.id)+'" checked></td><td style="padding:6px">'+esc(b.id)+'</td><td style="padding:6px">'+esc(b.responsable)+'</td><td style="padding:6px">'+esc(b.colaborador||'—')+'</td><td style="padding:6px">'+esc(b.tarjetaNumero||'—')+'</td><td style="padding:6px">'+esc(b.ubicacion||'—')+'</td></tr>';}).join('')+'</table>';asg.style.display='block';var selAll=box.querySelector('#__selAll');selAll.onchange=function(){box.querySelectorAll('.__bchk').forEach(function(c){c.checked=selAll.checked;});};var cnt={};list.forEach(function(b){if(b.responsable)cnt[b.responsable]=(cnt[b.responsable]||0)+1;});var top=Object.entries(cnt).sort(function(a,b){return b[1]-a[1];})[0];if(top)panel.querySelector('#__asgResp').value=top[0];}
  panel.querySelector('#__persSearch').onclick=doSearch;
  panel.querySelector('#__persQ').addEventListener('keydown',function(e){if(e.key==='Enter')doSearch();});
  panel.querySelector('#__asgBtn').onclick=async function(){var num=panel.querySelector('#__asgNum').value.trim();var resp=panel.querySelector('#__asgResp').value.trim();var msg=panel.querySelector('#__asgMsg');var ids=Array.prototype.slice.call(panel.querySelectorAll('.__bchk')).filter(function(c){return c.checked;}).map(function(c){return c.dataset.id;});if(!num){msg.style.color='#dc2626';msg.textContent='Escribe el número de tarjeta.';return;}if(!ids.length){msg.style.color='#dc2626';msg.textContent='Selecciona al menos un bien.';return;}if(!confirm('¿Asignar la tarjeta '+num+' a '+ids.length+' bien(es)?'))return;msg.style.color='#64748b';msg.textContent='Asignando…';try{var n=await H.assignTarjeta(ids,num,resp);msg.style.color='#16a34a';msg.textContent='✔ Tarjeta '+num+' asignada a '+n+' bien(es).';doSearch();}catch(e){msg.style.color='#dc2626';msg.textContent='Error: '+e.message;}};
})();
