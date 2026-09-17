/* =========================================================================
   GENERADOR DE OFICIO EN WORD (.docx) REAL
   -------------------------------------------------------------------------
   Reutiliza la plantilla oficial (plantillas/oficio_egreso_base.docx): mismo
   membrete de página completa, márgenes, pie de página y tipografía Arial.
   Solo se reemplaza el contenido de word/document.xml (fecha, tabla de bienes,
   bloque de fungibles, destino y fecha del traslado) usando tokens.

   No usa librerías: hace la "cirugía" del ZIP a mano copiando tal cual los
   demás archivos del .docx (imagen, encabezado, pie, estilos) y solo re-empaca
   el document.xml nuevo (sin comprimir). Funciona sin conexión una vez que la
   app guardó los archivos en el dispositivo.
   ========================================================================= */
(function(){
  "use strict";
  var _enc = new TextEncoder();
  var _dec = new TextDecoder();
  function u8(s){ return _enc.encode(s); }

  // ---- CRC32 ----
  var _crc;
  function crc32(bytes){
    if(!_crc){ _crc=new Uint32Array(256);
      for(var n=0;n<256;n++){ var c=n; for(var k=0;k<8;k++){ c=(c&1)?(0xEDB88320^(c>>>1)):(c>>>1); } _crc[n]=c>>>0; } }
    var crc=0xFFFFFFFF;
    for(var i=0;i<bytes.length;i++){ crc=(crc>>>8)^_crc[(crc^bytes[i])&0xFF]; }
    return (crc^0xFFFFFFFF)>>>0;
  }

  // ---- Leer un ZIP (por su directorio central) ----
  function parseZip(buf){
    var dv=new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
    var eocd=-1;
    for(var i=buf.length-22;i>=0;i--){ if(dv.getUint32(i,true)===0x06054b50){ eocd=i; break; } }
    if(eocd<0) throw new Error("ZIP sin EOCD");
    var total=dv.getUint16(eocd+10,true), cdOff=dv.getUint32(eocd+16,true), p=cdOff, ents=[];
    for(var e=0;e<total;e++){
      if(dv.getUint32(p,true)!==0x02014b50) throw new Error("dir central");
      var method=dv.getUint16(p+10,true), crc=dv.getUint32(p+16,true),
          comp=dv.getUint32(p+20,true), uncomp=dv.getUint32(p+24,true),
          fnLen=dv.getUint16(p+28,true), exLen=dv.getUint16(p+30,true),
          cmLen=dv.getUint16(p+32,true), lho=dv.getUint32(p+42,true);
      var name=_dec.decode(buf.subarray(p+46,p+46+fnLen));
      ents.push({name:name,method:method,crc:crc,comp:comp,uncomp:uncomp,lho:lho});
      p+=46+fnLen+exLen+cmLen;
    }
    ents.forEach(function(en){
      if(dv.getUint32(en.lho,true)!==0x04034b50) throw new Error("cabecera local");
      var fnLen=dv.getUint16(en.lho+26,true), exLen=dv.getUint16(en.lho+28,true);
      var start=en.lho+30+fnLen+exLen;
      en.raw=buf.subarray(start,start+en.comp);
    });
    return ents;
  }

  // ---- Escribir un ZIP a partir de entradas {name,method,crc,comp,uncomp,raw} ----
  function buildZip(ents){
    function u16(v){ return [v&0xFF,(v>>>8)&0xFF]; }
    function u32(v){ return [v&0xFF,(v>>>8)&0xFF,(v>>>16)&0xFF,(v>>>24)&0xFF]; }
    var chunks=[], offset=0;
    ents.forEach(function(en){
      var nb=u8(en.name);
      var lh=[].concat(u32(0x04034b50),u16(20),u16(0x800),u16(en.method),u16(0),u16(0x21),
        u32(en.crc),u32(en.comp),u32(en.uncomp),u16(nb.length),u16(0));
      var lhb=new Uint8Array(lh);
      en._off=offset;
      chunks.push(lhb,nb,en.raw);
      offset+=lhb.length+nb.length+en.raw.length;
    });
    var cdStart=offset, cdLen=0;
    ents.forEach(function(en){
      var nb=u8(en.name);
      var ch=[].concat(u32(0x02014b50),u16(20),u16(20),u16(0x800),u16(en.method),u16(0),u16(0x21),
        u32(en.crc),u32(en.comp),u32(en.uncomp),u16(nb.length),u16(0),u16(0),u16(0),u16(0),u32(0),u32(en._off));
      var chb=new Uint8Array(ch);
      chunks.push(chb,nb);
      cdLen+=chb.length+nb.length; offset+=chb.length+nb.length;
    });
    var eocd=[].concat(u32(0x06054b50),u16(0),u16(0),u16(ents.length),u16(ents.length),u32(cdLen),u32(cdStart),u16(0));
    chunks.push(new Uint8Array(eocd));
    var len=chunks.reduce(function(a,c){return a+c.length;},0), out=new Uint8Array(len), o=0;
    chunks.forEach(function(c){ out.set(c,o); o+=c.length; });
    return out;
  }

  function escX(s){ return String(s==null?"":s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;"); }
  function rep(str, token, valor){ return str.replace(token, function(){ return valor; }); }

  // ---- Construir el word/document.xml con los datos ----
  function construirDocumentXml(tpl, info){
    var P=info.P, d=info.d, bienes=info.bienes, fung=info.fungibles;
    var filasA = bienes.map(function(b,i){
      var r = rep(tpl.rowActivo, "{{N}}", String(i+1));
      r = rep(r, "{{BIEN}}", escX(b.codigo||""));
      r = rep(r, "{{DESC}}", escX(P.descBien?P.descBien(b):(b.descripcion||"")));
      return r;
    }).join("");
    var bloqueF = "";
    if(fung && fung.length){
      var filasF = fung.map(function(f){
        var r = rep(tpl.rowFung, "{{CANT}}", escX(f.cantidad));
        r = rep(r, "{{DESCF}}", escX(f.descripcion));
        return r;
      }).join("");
      bloqueF = rep(tpl.bloqueFungible, "{{FILAS_FUNG}}", filasF);
    }
    var destino = (d.ubicacion==="__OTRA__") ? (d.destinoOtro||"") : (d.ubicacion||"");
    var xml = tpl.documentTmpl;
    xml = rep(xml, "{{FECHA_OFICIO}}", escX(d.fechaOficio||""));
    xml = rep(xml, "{{DESTINO}}", escX(destino));
    xml = rep(xml, "{{ACT_FECHA}}", escX(d.fechaActividad||""));
    xml = rep(xml, "{{FILAS_ACTIVO}}", filasA);
    xml = rep(xml, "{{BLOQUE_FUNGIBLE}}", bloqueF);
    return xml;
  }

  // ---- Cargar (y cachear) la plantilla ----
  var _pkg=null;
  function cargarPaquete(){
    if(_pkg) return Promise.resolve(_pkg);
    return Promise.all([
      fetch("plantillas/oficio_docx.json").then(function(r){ if(!r.ok) throw new Error("json"); return r.json(); }),
      fetch("plantillas/oficio_egreso_base.docx").then(function(r){ if(!r.ok) throw new Error("docx"); return r.arrayBuffer(); })
    ]).then(function(a){ _pkg={ tpl:a[0], base:new Uint8Array(a[1]) }; return _pkg; });
  }

  // API pública: devuelve una Promesa con los bytes (Uint8Array) del .docx
  window.oficioGenerarDocx = function(info){
    return cargarPaquete().then(function(pkg){
      var docXml = construirDocumentXml(pkg.tpl, info);
      var ents = parseZip(pkg.base);
      var docBytes = u8(docXml);
      var hay=false;
      ents.forEach(function(en){
        if(en.name==="word/document.xml"){ hay=true; en.method=0; en.raw=docBytes; en.crc=crc32(docBytes); en.comp=docBytes.length; en.uncomp=docBytes.length; }
      });
      if(!hay) throw new Error("document.xml no encontrado");
      return buildZip(ents);
    });
  };
})();
