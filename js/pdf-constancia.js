/* ================= CONSTANCIA COMO PDF (archivo, para compartir) =================
   Antes la constancia se mandaba a "imprimir" del navegador. Ahora se genera un PDF de
   verdad y se comparte con la hoja de compartir del teléfono (WhatsApp, correo, Drive…);
   si el equipo no permite compartir directo, se descarga el archivo.

   jsPDF se carga desde CDN la primera vez (igual que el lector de Excel), así no pesa en el
   arranque; el navegador lo reutiliza después. Requiere conexión la primera vez. */
(function(){
  "use strict";

  var JS_PDF = "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";
  var AUTOTABLE = "https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js";

  function cargarScript(src){
    return new Promise(function(res, rej){
      var s = document.createElement("script");
      s.src = src; s.onload = function(){ res(true); };
      s.onerror = function(){ rej(new Error("No se pudo cargar "+src)); };
      document.head.appendChild(s);
    });
  }
  function jsPDFListo(){
    var ok = window.jspdf && window.jspdf.jsPDF && window.jspdf.jsPDF.API && window.jspdf.jsPDF.API.autoTable;
    if(ok) return Promise.resolve(true);
    if(window.__jspdfPromesa) return window.__jspdfPromesa;
    if(typeof toast==="function") toast("Preparando el PDF…");
    window.__jspdfPromesa = cargarScript(JS_PDF)
      .then(function(){ return cargarScript(AUTOTABLE); })
      .then(function(){ return true; })
      .catch(function(e){ window.__jspdfPromesa = null; throw e; });
    return window.__jspdfPromesa;
  }

  function construir(tarjetaId){
    var t = TARJETAS[tarjetaId];
    if(!t) return Promise.reject(new Error("Tarjeta no encontrada"));
    var list = bienesDe(t.id).slice().sort(function(a,b){ return (a.codigo||"").localeCompare(b.codigo||""); });
    var totalValor = list.reduce(function(s,b){ return s + Number(b.valor||0); }, 0);
    return fotoGet("S"+tarjetaId).then(function(firma){
      var jsPDF = window.jspdf.jsPDF;
      var doc = new jsPDF({ unit:"pt", format:"letter" });
      var W = doc.internal.pageSize.getWidth();
      var M = 48, y = 54;

      doc.setFont("helvetica","bold"); doc.setFontSize(13);
      doc.text("Instituto Guatemalteco de Seguridad Social — Auditoría Interna", W/2, y, {align:"center"}); y += 18;
      doc.setFontSize(12);
      doc.text("Constancia de responsabilidad de bienes", W/2, y, {align:"center"}); y += 10;
      doc.setDrawColor(180); doc.line(M, y, W-M, y); y += 20;

      doc.setFontSize(10);
      function campo(lbl, val, x, yy){
        doc.setFont("helvetica","bold"); doc.text(lbl, x, yy);
        var w = doc.getTextWidth(lbl + " ");
        doc.setFont("helvetica","normal"); doc.text(String(val==null?"—":val), x + w, yy);
      }
      campo("Responsable:", t.responsable||"", M, y); campo("Tarjeta No.:", t.numero||"(pendiente)", W/2, y); y += 15;
      campo("Puesto:", t.puesto||"—", M, y); campo("Correo:", t.correo||"—", W/2, y); y += 15;
      campo("Fecha de emisión:", today(), M, y); y += 16;

      doc.autoTable({
        startY: y, margin:{ left:M, right:M },
        head: [["No. Inventario","Descripción","Valor","Estado"]],
        body: list.length ? list.map(function(b){ return [ b.codigo||"", b.descripcion||"", money(b.valor), b.estado||"" ]; })
                          : [["", "Sin bienes registrados en esta tarjeta.", "", ""]],
        foot: [[{content:"Total ("+list.length+" bien(es))", colSpan:2}, money(totalValor), ""]],
        styles:{ fontSize:9, cellPadding:4, overflow:"linebreak" },
        headStyles:{ fillColor:[31,56,100], textColor:255 },
        footStyles:{ fillColor:[238,242,248], textColor:20, fontStyle:"bold" },
        columnStyles:{ 0:{cellWidth:95}, 2:{halign:"right", cellWidth:75}, 3:{cellWidth:62} }
      });

      var yF = (doc.lastAutoTable ? doc.lastAutoTable.finalY : y) + 46;
      if(yF > doc.internal.pageSize.getHeight() - 90){ doc.addPage(); yF = 90; }
      var colW = (W - 2*M - 30) / 2;
      if(firma && firma.b64){ try{ doc.addImage("data:image/jpeg;base64,"+firma.b64, "JPEG", M, yF-38, 120, 34); }catch(e){} }
      doc.setDrawColor(120);
      doc.line(M, yF, M+colW, yF); doc.line(W-M-colW, yF, W-M, yF); yF += 13;
      doc.setFont("helvetica","normal"); doc.setFontSize(9);
      doc.text("Firma del responsable", M, yF); doc.text("Firma de Auditoría Interna", W-M-colW, yF);
      if(firma && t.firmaFecha){ yF += 12; doc.setFontSize(8); doc.setTextColor(120);
        doc.text("Firmado electrónicamente el "+t.firmaFecha, M, yF); doc.setTextColor(0); }

      yF += 26; doc.setFontSize(7.5); doc.setTextColor(120);
      var nota = doc.splitTextToSize("Revise el texto de esta constancia antes de usarla como documento oficial — el formato es un punto de partida, no un modelo institucional certificado.", W - 2*M);
      doc.text(nota, M, yF); doc.setTextColor(0);

      var base = (t.responsable || t.numero || "tarjeta").replace(/[^\w\sÁÉÍÓÚÑáéíóúñ-]/g,"").trim().replace(/\s+/g,"_");
      return { blob: doc.output("blob"), nombre: "Constancia_"+base+".pdf" };
    });
  }

  function generar(tarjetaId){ return jsPDFListo().then(function(){ return construir(tarjetaId); }); }

  function descargar(r){
    var u = URL.createObjectURL(r.blob);
    var a = document.createElement("a"); a.href = u; a.download = r.nombre;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function(){ URL.revokeObjectURL(u); }, 4000);
  }

  // Genera y abre la hoja de compartir (WhatsApp, correo, Drive…). Si no se puede, descarga.
  window.compartirConstancia = function(tarjetaId){
    generar(tarjetaId).then(function(r){
      try{
        var file = new File([r.blob], r.nombre, {type:"application/pdf"});
        if(navigator.canShare && navigator.canShare({files:[file]})){
          navigator.share({ files:[file], title:"Constancia de responsabilidad",
            text:"Constancia de responsabilidad de bienes" }).catch(function(){});
          return;
        }
      }catch(e){}
      descargar(r);
      if(typeof toast==="function") toast("PDF listo (este equipo no comparte directo, se descargó)");
    }).catch(function(e){ if(typeof toast==="function") toast("No se pudo generar el PDF: "+(e.message||e)); });
  };

  // Solo descargar el PDF (sin compartir).
  window.descargarConstancia = function(tarjetaId){
    generar(tarjetaId).then(descargar).catch(function(e){
      if(typeof toast==="function") toast("No se pudo generar el PDF: "+(e.message||e));
    });
  };
})();
