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

  /* Contenido del QR: la ficha completa del bien en texto legible, de modo que al
     escanearlo con cualquier lector se vea toda la información sin depender de la app.
     Se omiten los campos vacíos para no agrandar el código de más. */
  function datosQR(b){
    var l = [];
    function add(et, val){ val = (val==null?'':String(val)).trim(); if(val) l.push(et+': '+val); }
    add('No', b.codigo);
    if(b.codigoSiges) add('SIGES', b.codigoSiges);
    add('Descripcion', b.descripcion);
    add('Marca', b.marca);
    add('Modelo', b.modelo);
    add('Serie', b.serie);
    add('Compra', b.fechaCompra);
    if(b.valor) add('Valor', 'Q'+Number(b.valor).toLocaleString('es-GT',{minimumFractionDigits:2}));
    add('Estado', b.estado);
    add('Ubicacion', b.ubicacion);
    add('Responsable', b.responsable);
    add('Tarjeta', b.tarjetaNumero);
    return l.join('\n');
  }

  /* La librería codifica en Latin-1 por defecto y eso rompe los acentos y la ñ
     (descripciones como "Computadora portátil" o nombres como "MARÍA JOSÉ" salían
     ilegibles al escanear). Se cambia a UTF-8 una sola vez. */
  var utf8Listo = false;
  function usarUTF8(){
    if(utf8Listo) return;
    try{
      if(qrcode.stringToBytesFuncs && qrcode.stringToBytesFuncs['UTF-8']){
        qrcode.stringToBytes = qrcode.stringToBytesFuncs['UTF-8'];
      }
    }catch(e){}
    utf8Listo = true;
  }

  function qrSvg(texto){
    if(typeof qrcode!=="function") return '';
    usarUTF8();
    try{
      /* Tipo 0 = automático. Corrección "L": como el QR ahora lleva toda la ficha, se
         prioriza que quepa en pocos módulos y siga siendo legible impreso en 21 mm. */
      var qr = qrcode(0, 'L');
      qr.addData(String(texto||''));
      qr.make();
      /* El SVG sale escalable (solo con viewBox) y el tamaño lo pone el CSS del
         recuadro. Antes se le inyectaba un ancho fijo en píxeles: no coincidía con el
         recuadro en milímetros, el código quedaba recortado por un costado y dejaba
         de leerse. Se deja el suavizado normal: forzar 'crispEdges' deformaba la
         rejilla de módulos al escalar y el código dejaba de leerse. */
      /* margin:12 con celda 3 = zona de silencio de 4 módulos. La norma del QR la exige y sin ella
         los lectores fallan o leen vacío; es lo que hacía que el código no se leyera. */
      var svg = qr.createSvgTag({ cellSize:3, margin:12, scalable:true });
      return svg;
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
      + '<div class="etq-qr">'+qrSvg(datosQR(b))+'</div>'
    + '</div>';
  }

  function imprimir(lista, titulo){
    if(!lista || !lista.length){ if(window.toast) toast('No hay bienes para etiquetar'); return; }
    if(typeof qrcode!=="function"){ if(window.toast) toast('No se pudo cargar el generador de QR'); return; }
    var area = document.getElementById('printArea');
    if(!area){ if(window.toast) toast('No se puede imprimir aquí'); return; }
    area.setAttribute('data-modo','etiquetas');
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
