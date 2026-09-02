/* ================= ETIQUETAS CON CÓDIGO QR =================
   Genera etiquetas pequeñas para pegar en cada bien: descripción, número de
   inventario, ubicación y un QR con el número de inventario. Se imprimen desde el
   navegador, así que sirven tanto en una impresora de etiquetas (rollo) como en una
   hoja de etiquetas adhesivas.

   El QR lleva el NÚMERO DE INVENTARIO en texto plano: cualquier lector lo entiende y
   coincide con lo que ya se busca dentro de la app. La librería (MIT, incluida en
   js/vendor) dibuja el QR como SVG, así imprime nítido a cualquier tamaño.

   Esta pantalla no modifica ningún dato: solo lee y arma la impresión. */
(function(){
  "use strict";

  function esc(x){ return (x==null?'':String(x)).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

  function qrSvg(texto, px){
    if(typeof qrcode!=="function") return '';
    try{
      // Tipo 0 = automático; corrección "M" aguanta bien el desgaste de una etiqueta.
      var qr = qrcode(0, 'M');
      qr.addData(String(texto||''));
      qr.make();
      var svg = qr.createSvgTag({ cellSize:3, margin:0, scalable:true });
      // Se fuerza el tamaño en la etiqueta (el SVG viene escalable).
      return svg.replace('<svg ', '<svg width="'+px+'" height="'+px+'" ');
    }catch(e){ console.error(e); return ''; }
  }

  /* Una etiqueta. Se replica la idea del ejemplo: texto a la izquierda, QR a la derecha. */
  function etiquetaHtml(b){
    var desc = b.descripcion || b.codigo || '';
    var ubic = b.ubicacion || '';
    var resp = b.responsable || '';
    var pie  = ubic || resp;
    return '<div class="etq">'
      + '<div class="etq-txt">'
        + '<div class="etq-desc">'+esc(desc)+'</div>'
        + '<div class="etq-cod">'+esc(b.codigo||'')+'</div>'
        + (pie?'<div class="etq-pie">'+esc(pie)+'</div>':'')
      + '</div>'
      + '<div class="etq-qr">'+qrSvg(b.codigo||'', 76)+'</div>'
    + '</div>';
  }

  function imprimir(lista, titulo){
    if(!lista || !lista.length){ if(window.toast) toast('No hay bienes para etiquetar'); return; }
    if(typeof qrcode!=="function"){ if(window.toast) toast('No se pudo cargar el generador de QR'); return; }
    var area = document.getElementById('printArea');
    if(!area){ if(window.toast) toast('No se puede imprimir aquí'); return; }
    area.innerHTML = '<div class="etq-hoja">' + lista.map(etiquetaHtml).join('') + '</div>';
    if(window.toast) toast('Preparando '+lista.length+' etiqueta'+(lista.length===1?'':'s')+'…');
    setTimeout(function(){ window.print(); }, 120);
  }

  /* ---------- puntos de entrada ---------- */

  // Etiqueta de un solo bien (desde su ficha).
  window.etiquetaBien = function(id){
    var b = (typeof BIENES==='object') ? BIENES[id] : null;
    if(!b){ if(window.toast) toast('Bien no encontrado'); return; }
    imprimir([b], b.codigo);
  };

  // Todas las etiquetas de un responsable (desde su ficha).
  window.etiquetasDeTarjeta = function(tarjetaId){
    var lista = (typeof bienesDe==='function') ? bienesDe(tarjetaId) : [];
    lista = lista.slice().sort(function(a,b){ return String(a.codigo||'').localeCompare(String(b.codigo||'')); });
    imprimir(lista, 'tarjeta');
  };

  // Etiquetas de lo que se esté viendo en una lista filtrada/buscada.
  window.etiquetasDeLista = function(ids){
    var lista = (ids||[]).map(function(id){ return BIENES[id]; }).filter(Boolean);
    imprimir(lista, 'selección');
  };
})();
