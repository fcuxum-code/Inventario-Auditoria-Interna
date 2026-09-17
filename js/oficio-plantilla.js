/* =========================================================================
   PLANTILLA DEL OFICIO DE SALIDA DE BIENES
   -------------------------------------------------------------------------
   ESTE ES EL ÚNICO ARCHIVO QUE HAY QUE TOCAR CUANDO LLEGUE EL MODELO REAL
   DEL OFICIO. Aquí se define: el membrete (encabezado), qué columnas lleva
   la tabla de bienes, el texto del cuerpo y las firmas. La lógica (buscar,
   seleccionar, generar el PDF) vive en app.js y NO hay que tocarla.

   No modifica nada en la base de datos: solo arma un documento para imprimir
   o compartir.
   ========================================================================= */
(function(){
  "use strict";

  // Filtra marcadores de "sin dato" (S/M, S/S, etc.). Reutiliza la de app.js si existe.
  function dato(v){ return (typeof _tieneDato==="function" && _tieneDato(v)) ? String(v).trim() : ""; }
  function e(s){ return (typeof esc==="function") ? esc(s) : String(s==null?"":s); }

  window.OFICIO_PLANTILLA = {

    /* 1) MEMBRETE ---------------------------------------------------------
       Pega aquí el encabezado del oficio. Puede ser:
       - Una imagen (lo más fiel):  '<img class="ofmembrete-img" src="data:image/png;base64,....">'
         (o una URL: '<img class="ofmembrete-img" src="https://....png">')
       - O texto/HTML directo.
       Mientras no esté el modelo, se muestra un marcador. */
    membreteHTML:
      '<div class="ofmembrete-ph">[ AQUÍ VA EL MEMBRETE ]'
      + '<div class="ofmembrete-ph-sub">Se reemplaza en js/oficio-plantilla.js cuando esté el modelo del oficio.</div></div>',

    /* 2) COLUMNAS de la tabla de bienes. Agregue o quite según el oficio.
       'th' = título de la columna; 'get' = de dónde sale el dato de cada bien;
       'num:true' la alinea a la derecha (para valores). */
    columnas: [
      { th:'No. de bien',  get:function(b){ return b.codigo||''; } },
      { th:'Descripción',  get:function(b){ return b.descripcion||''; } },
      { th:'Marca',        get:function(b){ return dato(b.marca); } },
      { th:'Modelo',       get:function(b){ return dato(b.modelo); } },
      { th:'No. de serie', get:function(b){ return dato(b.serie); } },
      { th:'Estado',       get:function(b){ return b.estado||''; } }
    ],

    /* 3) CUERPO del oficio (texto entre el membrete y la tabla).
       'd' trae lo que el usuario escribe en el formulario:
       d.fecha, d.dirigidoA, d.cargo, d.destino, d.motivo, d.lugar,
       d.cantidad (número de bienes seleccionados).
       ---- TEXTO PROVISIONAL: se cambia por el real cuando llegue el modelo ---- */
    cuerpo: function(d){
      return ''
        + '<p class="oftxt" style="text-align:right">'+e(d.lugar||'Guatemala')+', '+e(d.fecha)+'</p>'
        + (d.dirigidoA ? '<p class="oftxt"><b>'+e(d.dirigidoA)+'</b>'+(d.cargo?'<br>'+e(d.cargo):'')+'</p>' : '')
        + '<p class="oftxt">Por este medio se hace constar la salida '
          + (d.cantidad===1 ? 'del siguiente bien' : 'de los siguientes '+d.cantidad+' bienes')
          + ' del departamento'
          + (d.destino ? ', con destino a <b>'+e(d.destino)+'</b>' : '')
          + (d.motivo ? ', por motivo de <b>'+e(d.motivo)+'</b>' : '')
          + ':</p>';
    },

    /* 4) CIERRE + FIRMAS (debajo de la tabla).
       d.entrega y d.recibe = nombre/puesto de quien entrega y quien recibe. */
    cierre: function(d){
      return ''
        + '<p class="oftxt" style="margin-top:18px">Sin otro particular, atentamente.</p>'
        + '<div class="pdfirmas">'
          + '<div class="pdfirma"><div class="pdline"></div>'+(d.entrega?e(d.entrega):'Entrega')+'</div>'
          + '<div class="pdfirma"><div class="pdline"></div>'+(d.recibe?e(d.recibe):'Recibe')+'</div>'
        + '</div>';
    },

    /* Campos que pide el formulario antes de generar. Puede quitar los que
       el oficio real no necesite. 'req:true' lo hace obligatorio.
       (No hay número de oficio, tal como se indicó.) */
    campos: [
      { id:'fecha',     label:'Fecha',                   tipo:'text', def:'__HOY__' },
      { id:'lugar',     label:'Lugar',                   tipo:'text', def:'Guatemala' },
      { id:'dirigidoA', label:'Dirigido a (nombre)',     tipo:'text' },
      { id:'cargo',     label:'Cargo / puesto',          tipo:'text' },
      { id:'destino',   label:'Destino (oficina/área)',  tipo:'text' },
      { id:'motivo',    label:'Motivo',                  tipo:'text', def:'cambio de oficina' },
      { id:'entrega',   label:'Entrega (nombre y puesto)', tipo:'text' },
      { id:'recibe',    label:'Recibe (nombre y puesto)',  tipo:'text' }
    ]
  };
})();
