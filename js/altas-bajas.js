/* ================= ALTAS Y BAJAS DEL INVENTARIO =================
   Guía de la normativa del Instituto para dar de alta o de baja un bien, según el tipo de
   bien y el motivo. Está armada sobre cuatro documentos:

     - Acuerdo 1560 de Junta Directiva (29/04/2025) — Reglamento para dar de baja del
       inventario general a los bienes muebles en desuso. Deroga el Acuerdo 1206.
     - Acuerdo 40/2019 de Gerencia (10/09/2019) — Manual de normas para el registro y
       control administrativo del inventario general de bienes muebles e inmuebles.
     - Acuerdo 19/2025 de Gerencia (11/06/2025) — Reforma los numerales 17.1, 19, 19.1,
       19.2 y 21 incisos a) y d) del apartado BAJAS AL INVENTARIO del Manual 40/2019.
     - Acuerdo 23/2025 de Gerencia (27/08/2025) — Instructivo para el tratamiento de
       diversos desechos producto de la baja de bienes en desuso.

   Todo lo que dice esta guía sale de esos textos y lleva su cita. Donde los acuerdos no
   coinciden entre sí, se dice y se deja la decisión a quien consulta: la guía no resuelve
   lo que la normativa no resolvió.

   El avance se guarda en el teléfono mientras se arma el expediente y se puede reiniciar,
   igual que en la guía de AS-400. */
(function(){
  "use strict";

  var LLAVE = "inv_abajas_avance_v1";

  /* ---------- Qué dictamen necesita cada tipo de bien ----------
     Acuerdo 1560, artículo 2 (quién dictamina) y Acuerdo 23/2025, norma específica 1
     (cuáles obligan al tratamiento de desechos). */
  var TIPOS = [
    { id:"computo", nom:"Equipo de cómputo",
      quien:"Subgerencia de Tecnología", toxicos:true },
    { id:"mecanico", nom:"Equipo mecánico",
      quien:"División de Mantenimiento", toxicos:true },
    { id:"electrico", nom:"Equipo eléctrico",
      quien:"División de Mantenimiento", toxicos:true },
    { id:"electronico", nom:"Equipo electrónico",
      quien:"División de Mantenimiento", toxicos:true },
    { id:"medico", nom:"Equipo médico-sanitario y de laboratorio",
      quien:"División de Mantenimiento", toxicos:true },
    { id:"produccion", nom:"Equipo de producción",
      quien:"División de Mantenimiento", toxicos:"equipo" },
    { id:"comunicacion", nom:"Equipo de comunicación",
      quien:"División de Mantenimiento", toxicos:"equipo" },
    { id:"transporte", nom:"Maquinaria y equipo de transporte, tracción y elevación",
      quien:"División de Transportes", toxicos:true },
    { id:"mobiliario", nom:"Mobiliario de oficina",
      quien:null, toxicos:false },
    { id:"educacional", nom:"Material educacional, cultural y recreativo",
      quien:null, toxicos:false },
    { id:"fungible", nom:"Bienes muebles fungibles",
      quien:"fungible", toxicos:false },
    { id:"militar", nom:"Equipo militar (armas y municiones)",
      quien:"militar", toxicos:false }
  ];

  /* ---------- Los casos ----------
     Un renglón de "pasos" que empieza con ">" es lo que resulta o lo que hay que tener
     presente, no una acción: se muestra aparte y no lleva casilla.
     [[id|texto]] enlaza con otro caso de esta misma guía. */
  var CASOS = [

    /* ===================== ANTES DE EMPEZAR ===================== */
    { id:"dictamen", grupo:"antes", nom:"Pasos completos según el tipo de bien", ic:"helpCircle",
      resumen:"Elija el tipo y le arma el trámite entero, ya resuelto",
      herramienta:"tipos" },

    { id:"cambios", grupo:"antes", nom:"Qué cambió con los acuerdos de 2025", ic:"clock",
      resumen:"El Acuerdo 1206 ya no existe y la autorización cambió de instancia",
      secciones:[
        { t:"aviso", txt:"El Manual 40/2019 sigue citando el <b>Acuerdo 1206</b> en su texto original. Ese acuerdo fue derogado. Si lo consulta sin las reformas de 2025, se va a guiar por un procedimiento que ya no está vigente." },
        { t:"lista", nom:"Lo que cambió", items:[
          "<b>El Acuerdo 1206 quedó derogado.</b> En su lugar rige el Acuerdo 1560 de Junta Directiva, del 29 de abril de 2025 (Acuerdo 1560, artículo 19).",
          "<b>La subasta privada desapareció.</b> Los expedientes que no culminaron el proceso de subasta privada del Acuerdo 1206 quedaron sin efecto y se sustituyen por subasta pública u otro método que designe la Gerencia (Acuerdo 1560, artículo 18).",
          "<b>Ya no se solicita a la Gerencia.</b> La solicitud de autorización de baja se remite a la Subgerencia de la que dependa jerárquicamente la dependencia interesada (Acuerdo 19/2025, numeral 17.1).",
          "<b>Apareció el tratamiento de desechos.</b> Los bienes que generan desechos tóxicos llevan pasos adicionales antes de destruirse (Acuerdo 23/2025). Vea [[toxicos|Bienes que generan desechos tóxicos]].",
          "<b>Plazo transitorio ya vencido.</b> El 16 de junio de 2025 fue la fecha máxima para remitir a Gerencia los expedientes iniciados bajo el Acuerdo 1206. Después de esa fecha, todo trámite inicia conforme al Acuerdo 1560 (Acuerdo 19/2025, artículo 6)."
        ]},
        { t:"nota", txt:"Mientras la Subgerencia de Tecnología termina los ajustes al Sistema Auxiliar AS-400 para que los encargados de las UAIAF puedan efectuar las actividades del Manual, el Departamento de Contabilidad queda facultado para efectuarlas (Acuerdo 19/2025, artículo 5)." },
        { t:"base", items:["Acuerdo 1560 de J.D., artículos 18 y 19","Acuerdo 19/2025 de Gerencia, artículos 5 y 6 y numeral 17.1","Acuerdo 23/2025 de Gerencia"] }
      ]},

    { id:"auditoria", grupo:"antes", nom:"Dónde entra Auditoría Interna", ic:"clipboardCheck",
      resumen:"Los seis momentos en que la normativa llama al Departamento",
      secciones:[
        { t:"nota", txt:"Reunido de los cuatro acuerdos, para saber cuándo el trámite de otra dependencia toca al Departamento y cuándo no." },
        { t:"lista", nom:"Cuando sí interviene", items:[
          "<b>Comprobación física para la baja.</b> La Subgerencia puede requerir a la Jefatura del Departamento que nombre a un Auditor para que compruebe la existencia física de los bienes para su baja definitiva (Acuerdo 1560, artículo 3).",
          "<b>Destrucción y desintegración.</b> El Departamento señala día y hora, nombra con la debida antelación a un Auditor Interno, y este hace constar la destrucción en acta pormenorizada (Acuerdo 1560, artículo 14).",
          "<b>Desastre natural.</b> La Autoridad Superior y el Encargado de Inventario solicitan la participación del Departamento para evaluar los daños causados a los bienes (Manual 40/2019, numeral 20).",
          "<b>Robo o hurto.</b> El Departamento dictamina; tras las averiguaciones define si los indicios son suficientes para determinar responsabilidad administrativa del funcionario o empleado a cargo (Manual 40/2019, numeral 21 inciso c).",
          "<b>Deducible del seguro.</b> El pago del deducible que cobra la aseguradora se realiza según determine la responsabilidad el Departamento (Acuerdo 19/2025, numeral 21 inciso a).",
          "<b>Diferencias en la toma física.</b> Las diferencias entre los bienes registrados y los verificados físicamente se reportan al Departamento de Contabilidad y al Departamento de Auditoría Interna, con la documentación de soporte (Manual 40/2019, numeral 24).",
          "<b>Cambios de personal.</b> De existir bienes faltantes al hacer el recuento físico en la entrega y recepción de un puesto, se notifica inmediatamente al Departamento (Manual 40/2019, numeral 34)."
        ]},
        { t:"lista", nom:"Cuando no interviene", items:[
          "<b>Bienes muebles fungibles en desuso.</b> No se requiere dictamen técnico ni la intervención del Departamento de Auditoría Interna. Queda bajo la estricta responsabilidad de la Máxima Autoridad y del Encargado de Inventarios evaluar si son susceptibles de baja, dejando constancia en Acta Administrativa (Acuerdo 1560, artículo 15)."
        ]},
        { t:"base", items:["Acuerdo 1560 de J.D., artículos 3, 14 y 15","Manual 40/2019, numerales 20, 21 c), 24 y 34","Acuerdo 19/2025, numeral 21 a)"] }
      ]},

    /* ===================== ALTAS ===================== */
    { id:"alta-compra", grupo:"alta", nom:"Alta de un bien comprado", ic:"plusCircle",
      resumen:"Bienes que entran por proceso de compra o adquisición",
      secciones:[
        { t:"quien", txt:"Aprueba el alta en el Módulo la <b>Autoridad Superior de la UAIAF</b> donde se lleve a cabo el proceso de compra, o la persona que esta designe (Manual 40/2019, numeral 14)." },
        { t:"docs", nom:"Lo que debe pedirle al encargado de compras", items:[
          "Fotocopia de la orden de compra",
          "Fotocopia de la factura del proveedor",
          "Fotocopia del recibo de almacén",
          "Número de la liquidación o de fondo rotativo con el cual se registra la adquisición",
          "Si el bien vino por convenio con una ONG u organismo internacional: fotocopia del acta administrativa de recepción de bienes"
        ]},
        { t:"pasos", nom:"Pasos", items:[
          "Revise que el recibo de almacén consigne como mínimo el modelo, la marca y el número de serie, aun cuando la factura del proveedor no los incluya",
          "> El recibo de almacén se emite como garantía de que los bienes se recibieron e ingresaron físicamente (numeral 13.1)",
          "Si el bien tiene dos o más componentes con número de serie diferente, incluya al menos el del componente principal",
          "Registre el bien en el Módulo de Inventarios del SICOIN con la información requerida",
          "Registre simultáneamente los mismos datos en el Sistema Auxiliar (AS-400)",
          "La Autoridad Superior de la UAIAF, o quien designe, aprueba el registro de alta en el Módulo",
          "Consigne en lugar visible el número de bien asignado según el Módulo, y vele por su permanencia y visibilidad con el tiempo"
        ]},
        { t:"nota", txt:"Para operar el registro en el AS-400 vea la guía de procedimientos, en <b>Cargar bienes a una tarjeta</b>." },
        { t:"base", items:["Manual 40/2019, numerales 13, 13.1, 13.2, 13.3, 14 y 15"] }
      ]},

    { id:"alta-otras", grupo:"alta", nom:"Alta por donación, adjudicación en pago u otra modalidad", ic:"inbox",
      resumen:"Bienes que no entran por compra",
      secciones:[
        { t:"nota", txt:"Forman parte del Inventario General todos los bienes adquiridos por proceso de compra, donación, adjudicación de bienes en pago o por cualquier otra modalidad de adquisición (Manual 40/2019, norma general 4)." },
        { t:"docs", nom:"Documentación base", items:[
          "Certificación del Acta Administrativa y/o el documento notarial que corresponda, con la descripción pormenorizada del bien: la marca, el modelo y el número de serie para los bienes que cuenten con esos datos, la fecha de ingreso y el valor",
          "Recibo de almacén",
          "Documentación adicional que, por la naturaleza de la adquisición, se requiera como parte del soporte legal"
        ]},
        { t:"pasos", nom:"Pasos", items:[
          "Reúna la documentación base completa",
          "Registre el alta en el Módulo y en el Sistema Auxiliar",
          "Traslade la información al Departamento de Contabilidad mediante oficio, para el registro contable"
        ]},
        { t:"aviso", txt:"Si el bien se obtuvo por <b>permuta</b>, se inventaría con el valor tasado en que fue aceptada la permuta, no con otro (Acuerdo 1560, artículo 7)." },
        { t:"nota", txt:"Este mismo procedimiento es el que se usa para dar de alta el bien con que se repone un faltante. Vea [[baja-repone|Bien faltante que el responsable repone]]." },
        { t:"base", items:["Manual 40/2019, numerales 16 y 16.1","Acuerdo 1560 de J.D., artículo 7"] }
      ]},

    /* ===================== BAJAS ===================== */
    { id:"baja-desuso", grupo:"baja", nom:"Baja de un bien en desuso", ic:"trash",
      resumen:"Desgaste, deterioro por uso normal, caso fortuito u otras causas",
      secciones:[
        { t:"nota", txt:"Aplica a los bienes muebles en desuso por desgaste, deterioro por su uso normal, deterioro o destrucción por caso fortuito u otras causas justificadas, que por ello ya no sean funcionales para los fines del Instituto (Acuerdo 1560, artículo 1)." },
        { t:"quien", txt:"La solicitud de autorización se remite a la <b>Subgerencia de la que dependa jerárquicamente</b> la dependencia interesada; en el caso de las Subgerencias, a sus mismos Subgerentes.<br><br>Para Junta Directiva, Gerencia, Consejo Técnico, Contraloría General del Instituto <b>y las dependencias que se encuentren bajo la línea jerárquica de cada una</b>, es la <b>Subgerencia Administrativa</b> quien recibe la solicitud y emite la Resolución (Acuerdo 19/2025, numeral 17.1)." },
        { t:"pasos", nom:"Pasos", items:[
          "La máxima autoridad de la dependencia, con el Encargado de Inventarios, elabora un listado con la descripción de los bienes considerados en desuso",
          "Pida el dictamen técnico que corresponda al tipo de bien: vea [[dictamen|Pasos completos según el tipo de bien]]",
          "> El dictamen debe indicar si los bienes son susceptibles de baja y, luego de la evaluación, sugerir si son objeto de permuta, donación, desintegración, acoplamiento o destrucción",
          "> El dictamen debe considerar que los bienes observados físicamente son los que se relacionan con el Módulo y el Sistema Auxiliar, conforme a las justificaciones del Acta Administrativa (Acuerdo 19/2025, numeral 19.1)",
          "Si el bien está incompleto y por eso se dificulta identificarlo físicamente contra el Módulo y el Sistema Auxiliar (plaqueta o etiqueta deteriorada, distintivos de la marca ilegibles, partes accesorias), inicie con un Acta Administrativa suscrita por la Autoridad Superior y el Encargado de Inventarios, donde se describa con detalle la dificultad y se supla bajo su responsabilidad la identificación física del bien",
          "Conforme el expediente y remita la solicitud de autorización a la Subgerencia que corresponda",
          "> Mientras tanto los bienes quedan bajo la guarda y custodia del Encargado de Inventarios y la Máxima Autoridad de la Dependencia",
          "La Subgerencia emite la Resolución autorizando, denegando o modificando lo solicitado, e indica el destino de los bienes",
          "La Subgerencia puede requerir a la Jefatura del Departamento de Auditoría Interna que nombre a un Auditor para comprobar la existencia física de los bienes para su baja definitiva",
          "Se facciona acta con la Máxima Autoridad, el Encargado de Inventarios y el Auditor Interno si fue nombrado",
          "Envíe copia certificada de esa acta al Departamento de Contabilidad para que efectúe los ajustes en el inventario general del Instituto",
          "Registre la baja en el Módulo y en el Sistema Auxiliar; la aprobación la efectúa el Departamento de Contabilidad"
        ]},
        { t:"docs", nom:"Lo que debe llevar el acta de las actuaciones", items:[
          "Cantidad",
          "Descripción",
          "Número de bien",
          "Número y fecha de despacho",
          "Valor según costo de adquisición"
        ]},
        { t:"aviso", txt:"<b>No descargue el bien de la tarjeta de responsabilidad todavía.</b> Los bienes en proceso de baja deben cargarse al Encargado de Inventario de la UAIAF, y únicamente se descargan hasta que esté aprobado el registro de la baja en el Módulo y en el Sistema Auxiliar (Manual 40/2019, numeral 28)." },
        { t:"nota", txt:"Si el bien genera desechos tóxicos, hay pasos adicionales antes de destruirlo: vea [[toxicos|Bienes que generan desechos tóxicos]]. Para saber qué se puede hacer con el bien una vez autorizada la baja, vea [[destinos|Qué se puede hacer con el bien dado de baja]]." },
        { t:"base", items:["Acuerdo 1560 de J.D., artículos 1, 2 y 3","Acuerdo 19/2025, numerales 17.1, 19 y 19.1","Manual 40/2019, numerales 18 y 28"] }
      ]},

    { id:"baja-resarcido", grupo:"baja", nom:"Bien faltante que fue pagado o resarcido", ic:"check",
      resumen:"El valor del faltante se resarció al Instituto",
      secciones:[
        { t:"quien", txt:"El expediente conformado se presenta ante la <b>Subgerencia</b> que corresponda según el numeral 17.1, para que autorice por Resolución la baja definitiva de los bienes (Acuerdo 19/2025, numeral 21 inciso a)." },
        { t:"pasos", nom:"Pasos", items:[
          "La Autoridad Superior y el Encargado de Inventarios de la UAIAF faccionan Acta Administrativa relacionando los hechos",
          "Consigne los documentos que demuestren el pago de los bienes faltantes",
          "Presente el expediente conformado ante la Subgerencia que corresponda, para que autorice por Resolución la baja definitiva",
          "El Encargado de Inventarios, una vez tenga el expediente en su poder, registra la baja en el Módulo y en el Sistema Auxiliar",
          "Traslade el expediente al Departamento de Contabilidad para su aprobación"
        ]},
        { t:"lista", nom:"Cómo se puede demostrar el pago", items:[
          "Recibo de ingresos diversos",
          "Descuentos realizados en nómina",
          "Descuento en la liquidación de prestaciones laborales del empleado o funcionario responsable del bien faltante"
        ]},
        { t:"docs", nom:"Si el bien fue reclamado e indemnizado por la aseguradora", items:[
          "Copia del Recibo de Ingresos Diversos certificado que demuestre que se pagó el valor correspondiente",
          "Copia certificada del Acta Administrativa",
          "Copia de la documentación relacionada"
        ]},
        { t:"aviso", txt:"El pago del <b>deducible</b> que cobra la aseguradora será realizado según determine la responsabilidad el <b>Departamento de Auditoría Interna</b> (Acuerdo 19/2025, numeral 21 inciso a)." },
        { t:"base", items:["Acuerdo 19/2025, numeral 21 inciso a)"] }
      ]},

    { id:"baja-reparos", grupo:"baja", nom:"Bien faltante con pliego de reparos", ic:"alertTriangle",
      resumen:"Se confirmó un pliego de reparos por el valor total del bien",
      secciones:[
        { t:"nota", txt:"Este inciso no fue reformado por el Acuerdo 19/2025: sigue vigente tal como quedó en el Manual 40/2019." },
        { t:"pasos", nom:"Pasos", items:[
          "Se confirma un pliego de reparos por el valor total del bien faltante",
          "> La Resolución de la Subgerencia Financiera ordena la apertura de la cuenta deudora o la suscripción de un convenio de pagos",
          "Esa Resolución debe notificarse a la UAIAF en la que se encuentre de alta el bien faltante",
          "El Encargado de Inventario registra la baja",
          "Remita el expediente al Departamento de Contabilidad para que, una vez analizado el caso, se proceda a su aprobación"
        ]},
        { t:"base", items:["Manual 40/2019, numeral 21 inciso b)"] }
      ]},

    { id:"baja-robo", grupo:"baja", nom:"Bien faltante por robo o hurto", ic:"x",
      resumen:"La falta del bien se relaciona a hechos delictivos",
      secciones:[
        { t:"aviso", txt:"La <b>denuncia</b> ante la Policía Nacional Civil o el Ministerio Público la presenta el empleado o funcionario responsable del bien, y es una <b>acción independiente y diferente</b> de la gestión que determinará la responsabilidad administrativa." },
        { t:"pasos", nom:"Pasos", items:[
          "El empleado o funcionario responsable del bien presenta la denuncia del hecho a la Policía Nacional Civil o al Ministerio Público",
          "Se procede conforme a lo que dictamine el Departamento de Auditoría Interna",
          "> Auditoría Interna, luego de las averiguaciones pertinentes, define si los indicios son suficientes para determinar la responsabilidad administrativa del funcionario o empleado a cargo del bien faltante",
          "Las actuaciones por medio de las cuales se determinó la falta de responsabilidad administrativa se trasladan al Encargado de Inventario de la UAIAF",
          "El Encargado de Inventario conforma el expediente y lo remite solicitando que se autorice la baja del bien faltante",
          "Si el bien estuviere asegurado y se hiciere el reclamo correspondiente, el trámite de baja se inicia con copia del recibo de ingresos diversos",
          "Autorizada la baja, regístrela en el Módulo y en el Sistema Auxiliar",
          "Remita el expediente al Departamento de Contabilidad para la aprobación respectiva"
        ]},
        { t:"aviso", txt:"<b>Aquí la normativa no es clara y conviene preguntar.</b> El Manual 40/2019 dice, en este inciso, que el expediente se remite <b>a la Gerencia</b>. El Acuerdo 19/2025 cambió la instancia a la Subgerencia que corresponda, pero solo reformó los numerales 17.1, 19, 19.1, 19.2 y 21 incisos a) y d): <b>no reformó el inciso c)</b>. Antes de remitirlo, confirme con la Subgerencia Financiera qué instancia autoriza hoy este caso." },
        { t:"base", items:["Manual 40/2019, numeral 21 inciso c)","Acuerdo 19/2025, artículo 1 (alcance de la reforma)"] }
      ]},

    { id:"baja-repone", grupo:"baja", nom:"Bien faltante que el responsable repone", ic:"refreshCw",
      resumen:"El responsable manifiesta su disposición a reponerlo",
      secciones:[
        { t:"aviso", txt:"<b>Hay un plazo:</b> el responsable debe informar a la Autoridad Superior de la UAIAF dentro de los <b>quince días posteriores</b> a la fecha en que se determinó el faltante, haciendo al mismo tiempo la propuesta de reposición total del bien." },
        { t:"quien", txt:"Autoriza la baja del bien faltante la <b>Subgerencia</b> que corresponda según el numeral 17.1, si el dictamen resulta favorable (Acuerdo 19/2025, numeral 21 inciso d)." },
        { t:"pasos", nom:"Pasos", items:[
          "El responsable informa a la Autoridad Superior de la UAIAF dentro de los quince días posteriores a la fecha en que se determinó el faltante, con la propuesta de reposición total del bien",
          "El Encargado de Inventarios solicita el dictamen técnico que establezca si las características y condiciones del bien propuesto son iguales o superiores al bien faltante",
          "> Quién emite ese dictamen depende del tipo de bien a reponer: vea [[dictamen|Pasos completos según el tipo de bien]]",
          "> Para los bienes que no requieren dictamen técnico, queda bajo la responsabilidad de la autoridad superior evaluar las características y condiciones del bien propuesto y solicitar autorización a la Subgerencia que corresponda",
          "Si el dictamen resulta favorable, la Subgerencia autoriza la baja del bien faltante",
          "Notifique a la UAIAF para el registro correspondiente en el Módulo y en el Sistema Auxiliar",
          "Traslade el expediente al Departamento de Contabilidad para su aprobación",
          "Registre el alta del bien repuesto por el procedimiento de incorporación de bienes: vea [[alta-otras|Alta por donación, adjudicación en pago u otra modalidad]]"
        ]},
        { t:"base", items:["Acuerdo 19/2025, numeral 21 inciso d)","Manual 40/2019, numeral 16"] }
      ]},

    { id:"baja-desastre", grupo:"baja", nom:"Bienes dañados por un desastre natural", ic:"zap",
      resumen:"Evaluación de daños con Auditoría Interna",
      secciones:[
        { t:"pasos", nom:"Pasos", items:[
          "La Autoridad Superior y el Encargado de Inventario de la UAIAF solicitan la participación del Departamento de Auditoría Interna para realizar la evaluación de los daños causados a los bienes",
          "Se deja constancia de la evaluación en Acta Administrativa",
          "El expediente se traslada para la autorización de la baja"
        ]},
        { t:"aviso", txt:"El Manual 40/2019 dice que el expediente se traslada <b>a la Gerencia</b>. Este numeral tampoco fue reformado por el Acuerdo 19/2025, que cambió la instancia únicamente en los numerales 17.1 y 21 incisos a) y d). Confirme la instancia antes de remitirlo." },
        { t:"base", items:["Manual 40/2019, numeral 20"] }
      ]},

    { id:"baja-judicial", grupo:"baja", nom:"Bien hospitalario entregado a un paciente por orden judicial", ic:"clipboardCheck",
      resumen:"Caso especial de bienes de tipo hospitalario",
      secciones:[
        { t:"pasos", nom:"Pasos", items:[
          "La Autoridad Superior de la UAIAF gestiona ante la Gerencia la autorización para el registro de la baja del bien"
        ]},
        { t:"nota", txt:"Es el único caso del Manual que no describe más trámite que este. Si necesita el detalle del expediente, consúltelo con el Departamento de Contabilidad." },
        { t:"base", items:["Manual 40/2019, numeral 22"] }
      ]},

    { id:"toxicos", grupo:"baja", nom:"Bienes que generan desechos tóxicos", ic:"alertTriangle",
      resumen:"Pasos obligatorios antes de destruir equipo con circuitos, ácidos o líquidos",
      secciones:[
        { t:"nota", txt:"Aplica cuando se da de baja equipo mecánico, eléctrico, electrónico, médico-sanitario y de laboratorio, vehículos, equipo de cómputo, y cualquier otro equipo que contenga placa con circuitos electrónicos, ácidos o líquidos." },
        { t:"pasos", nom:"Lo que debe hacer la dependencia que solicitó la baja", items:[
          "Considere la normativa vigente que dicte lineamientos para el manejo de desechos tóxicos para el medio ambiente: es de aplicación obligatoria y hay que apegarse estrictamente a ella",
          "Revise que el dictamen técnico de la Subgerencia de Tecnología, la División de Mantenimiento o la División de Transportes incluya la descripción de los componentes considerados tóxicos para el medio ambiente",
          "Verifique que en los bienes dados de baja no permanezca visible ni legible ningún logotipo, número de serie, placa o señalamiento similar que los relacione con el IGSS, a fin de prevenir su eventual circulación dentro del territorio nacional",
          "Solicite a la Subgerencia de Tecnología, la División de Mantenimiento o la División de Transportes, según corresponda, la asignación de personal técnico que realice la extracción de los componentes tóxicos",
          "> Los componentes extraídos quedan bajo el resguardo de la dependencia técnica que los extrajo",
          "Gestione con entidades autorizadas y debidamente certificadas la disposición final de los componentes tóxicos extraídos",
          "Requiera la constancia de disposición correspondiente, como respaldo de que fueron retirados y manejados conforme a la normativa ambiental vigente"
        ]},
        { t:"aviso", txt:"La dependencia que solicita la baja debe utilizar <b>una entidad debidamente certificada y autorizada</b> para el manejo de desechos tóxicos. No es opcional." },
        { t:"nota", txt:"Este instructivo es complemento de la normativa vigente sobre gestión y manejo de desechos sólidos hospitalarios, desechos hospitalarios contaminantes, peligrosos, bioinfecciosos y especiales, así como de desechos sólidos hospitalarios comunes." },
        { t:"base", items:["Acuerdo 23/2025 de Gerencia, normas generales 1 a 5 y norma específica 1"] }
      ]},

    { id:"destinos", grupo:"baja", nom:"Qué se puede hacer con el bien dado de baja", ic:"layers",
      resumen:"Subasta, permuta, donación, desintegración, acoplamiento o destrucción",
      secciones:[
        { t:"nota", txt:"El destino lo indica la Resolución de la Subgerencia. El dictamen técnico lo sugiere, pero no lo decide (Acuerdo 1560, artículos 2 y 3)." },
        { t:"lista", nom:"Venta por subasta pública", items:[
          "El precio base estimado lo fija la dependencia responsable de Inteligencia de Mercados de la Subgerencia Administrativa, de acuerdo con el precio del mercado.",
          "La dependencia encargada convoca a los postores interesados, quienes asumen todos los gastos del trámite de la venta, si los hubiere.",
          "Interviene una Junta integrada al menos por tres miembros, nombrados por la Gerencia.",
          "Si no se presenta postor en el término de diez días, la Gerencia fija un nuevo plazo. Si aun así no concurre postor, la Gerencia queda facultada para realizar la venta por unidad, equipo, conjunto o a granel, autorizada por Resolución.",
          "Se incluyen los bienes en desuso que no hayan sido destruidos, y también las piezas de hierro, acero, bronce, aluminio, metales y otros materiales resultantes de la destrucción."
        ]},
        { t:"lista", nom:"Permuta", items:[
          "Requisito previo: que Inteligencia de Mercados estime el precio de oferta para determinar con exactitud el valor de la negociación, atendiendo los artículos 1852, 1853 y 1854 del Código Civil.",
          "Se debe obtener dictamen del Departamento Legal y, si la clase de los bienes lo exige, también de la División de Mantenimiento, la División de Transportes o la Subgerencia de Tecnología.",
          "Los bienes obtenidos por permuta se inventarían con el valor tasado en que sea aceptada la permuta."
        ]},
        { t:"lista", nom:"Donación", items:[
          "Procede cuando los bienes presentan un estado de deterioro o desgaste que aún permita su aprovechamiento y exista solicitud previa.",
          "Siempre es a título gratuito.",
          "Que los bienes, por su estado, modelo, uso, deterioro u otra causa, ya no cumplan la finalidad que tenían destinada en la Institución.",
          "Que aún sean aprovechables en todo o en parte.",
          "Que se donen a entidades estatales o privadas de beneficencia sin ánimo de lucro (asilos, guarderías, centros de salud u otros similares) que previamente lo hubieran solicitado.",
          "Toda donación será estimada según su valor en inventario."
        ]},
        { t:"lista", nom:"Desintegración y acoplamiento", items:[
          "La desintegración procede cuando exista solicitud previa de las dependencias, sobre bienes en desuso que contengan piezas en buenas condiciones y funcionales para usarse como repuestos de otros bienes muebles que estén en uso. Se deja constancia en Acta Administrativa.",
          "El acoplamiento procede cuando determinados bienes en desuso no pueden funcionar por sí mismos pero, al combinarse con otros aparatos o sistemas para formar una sola unidad, producen un resultado conveniente y ofrecen servicio por algún tiempo más."
        ]},
        { t:"lista", nom:"Destrucción", items:[
          "Procede después de dar cumplimiento a lo establecido en los artículos 3, 11 y 12 del Reglamento, y cuando por el deterioro sufrido ya no sea posible su uso.",
          "El Departamento de Auditoría Interna señala día y hora, nombrando con la debida antelación a un Auditor Interno, quien hace constar la destrucción en acta pormenorizada.",
          "Si los materiales resultantes son aprovechables para reciclaje, la Subgerencia puede ordenar por Resolución su subasta pública, venta, donación o permuta."
        ]},
        { t:"aviso", txt:"Todo esto se legaliza por medio de <b>Acta Administrativa</b>, o según lo que proceda atendiendo a la naturaleza, importancia y valor de los bienes (Acuerdo 1560, artículo 16)." },
        { t:"base", items:["Acuerdo 1560 de J.D., artículos 5 a 17"] }
      ]},

    /* ===================== TRASLADOS ===================== */
    { id:"traslado", grupo:"traslado", nom:"Traslado de bienes entre UAIAF", ic:"refreshCw",
      resumen:"Cuando el bien cambia de unidad administrativa",
      secciones:[
        { t:"quien", txt:"Se requiere la aprobación de la <b>Autoridad Superior de cada una de las UAIAF</b> involucradas, lo cual se comprueba con las firmas en el formulario respectivo." },
        { t:"docs", nom:"Lo que debe llevar el formulario de traslado", items:[
          "Nombre y clave administrativa de la UAIAF de destino",
          "Nombre y clave administrativa de la UAIAF de origen",
          "Número de bien",
          "Descripción",
          "Valor de cada bien y valor total del traslado",
          "Nombre, firma y sello de la Autoridad Superior de cada UAIAF"
        ]},
        { t:"pasos", nom:"Pasos", items:[
          "Use el formulario de traslado que para el efecto establece el Departamento de Contabilidad",
          "El Encargado de Inventario de la UAIAF que origina el traslado inicia el proceso de registro en el Módulo y en el Sistema Auxiliar",
          "Traslade copia del formulario a la UAIAF de destino para que continúe con el proceso de registro",
          "Completado el registro, traslade mediante oficio al Departamento de Contabilidad el reporte de traslado del Módulo y el formulario de Traslado de Bienes en original y dos copias, para su aprobación y archivo"
        ]},
        { t:"nota", txt:"El Departamento de Contabilidad registra contablemente el traslado <b>solo</b> cuando es entre UAIAF de <b>diferente Unidad Ejecutora</b>, adjuntando la documentación original al Comprobante Único de Registro. Entre UAIAF de una misma Unidad Ejecutora no se realiza registro contable: únicamente la aprobación en el Módulo y en el Sistema Auxiliar (numeral 38)." },
        { t:"aviso", txt:"Cuando se justifique la <b>salida de un bien</b> de la UAIAF, debe constar por escrito el conocimiento del Encargado de Inventario y la autorización de la Autoridad Superior (numeral 39)." },
        { t:"nota", txt:"Para operarlo en el AS-400 vea la guía de procedimientos, en <b>Pasar bienes de una tarjeta a otra</b>; y para el registro en SICOIN, las cuatro etapas del alta por traslado." },
        { t:"base", items:["Manual 40/2019, numerales 36, 37, 38 y 39"] }
      ]}
  ];

  var GRUPOS = [
    { cod:"antes",    nom:"Antes de empezar", clase:"gsis-antes",
      nota:"Dos consultas rápidas que ahorran devoluciones del expediente." },
    { cod:"alta",     nom:"Altas al inventario", clase:"gsis-alta",
      nota:"Bienes que entran al Inventario General del Instituto." },
    { cod:"baja",     nom:"Bajas al inventario", clase:"gsis-baja",
      nota:"Elija por el motivo de la baja: el trámite y los documentos cambian bastante entre un caso y otro." },
    { cod:"traslado", nom:"Traslados", clase:"gsis-traslado",
      nota:"El bien no sale del Instituto, cambia de unidad administrativa." }
  ];

  /* ---------- utilidades ---------- */
  function ic(n, s, e){ return (typeof icon === "function") ? icon(n, s || 20, e) : ""; }
  function esca(s){
    return (typeof esc === "function") ? esc(s)
      : String(s == null ? "" : s).replace(/[&<>"]/g, function(c){
          return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]; });
  }
  function esResultado(p){ return p.charAt(0) === ">"; }
  function textoPaso(p){ return esResultado(p) ? p.slice(1).trim() : p; }

  /* Los textos de esta guía llevan negritas y enlaces a propósito, así que no se escapan;
     son constantes de este archivo, no algo que escriba el usuario. Lo único que se
     transforma es [[id|texto]], que se vuelve un enlace a otro caso de la misma guía. */
  function enlaces(html){
    return String(html || "").replace(/\[\[([a-z0-9\-]+)\|([^\]]+)\]\]/gi, function(m, id, txt){
      return '<span class="ablink" onclick="event.stopPropagation();abAbrir(\'' + id + '\')">' + txt + '</span>';
    });
  }

  function buscarCaso(id){
    for(var i=0;i<CASOS.length;i++){ if(CASOS[i].id === id) return CASOS[i]; }
    return null;
  }
  function buscarTipo(id){
    for(var i=0;i<TIPOS.length;i++){ if(TIPOS[i].id === id) return TIPOS[i]; }
    return null;
  }
  /* Solo cuentan como marcables las secciones de pasos y de documentos. */
  function seccionesMarcables(caso){
    var out = [];
    (caso.secciones || []).forEach(function(s, i){
      if(s.t === "pasos" || s.t === "docs") out.push({ s:s, i:i });
    });
    return out;
  }
  function accionesDe(sec){
    return (sec.items || []).filter(function(x){ return !esResultado(x); });
  }
  function totalAcciones(caso){
    var n = 0;
    seccionesMarcables(caso).forEach(function(x){ n += accionesDe(x.s).length; });
    return n;
  }

  /* ---------- avance guardado ---------- */
  function leerAvance(){
    try { return JSON.parse(localStorage.getItem(LLAVE) || "{}") || {}; } catch(e){ return {}; }
  }
  function guardarAvance(a){ try { localStorage.setItem(LLAVE, JSON.stringify(a)); } catch(e){} }
  function marcados(clave){
    var a = leerAvance();
    return Array.isArray(a[clave]) ? a[clave] : [];
  }
  function totalMarcados(caso){
    var n = 0;
    seccionesMarcables(caso).forEach(function(x){
      var lista = marcados(caso.id + ":" + x.i);
      lista.forEach(function(i){ if(!esResultado(x.s.items[i])) n++; });
    });
    return n;
  }
  function alternar(clave, i){
    var a = leerAvance(), lista = Array.isArray(a[clave]) ? a[clave] : [];
    var k = lista.indexOf(i);
    if(k >= 0) lista.splice(k, 1); else lista.push(i);
    a[clave] = lista; guardarAvance(a);
  }
  function limpiarCaso(caso){
    var a = leerAvance();
    seccionesMarcables(caso).forEach(function(x){ delete a[caso.id + ":" + x.i]; });
    guardarAvance(a);
  }

  /* ---------- pantalla ---------- */
  var vista = { caso:null, tipo:null, q:"" };

  function cont(){
    var c = document.getElementById("abajas");
    if(!c){
      c = document.createElement("div");
      c.id = "abajas";
      document.body.appendChild(c);
      document.body.style.overflow = "hidden";
    }
    return c;
  }

  window.abrirAltasBajas = function(casoId){
    vista = { caso: casoId || null, tipo:null, q:"" };
    pintar();
  };
  window.abCerrar = function(){
    var c = document.getElementById("abajas");
    if(c) c.remove();
    document.body.style.overflow = "";
  };
  window.abAbrir = function(id){ vista.caso = id; vista.tipo = null; pintar(); };
  window.abVolver = function(){
    if(vista.tipo){ vista.tipo = null; pintar(); return; }
    vista.caso = null; pintar();
  };
  window.abTipo = function(id){ vista.tipo = id; pintar(); };
  window.abBuscar = function(v){
    vista.q = v || "";
    var cuerpo = document.querySelector("#abajas .gbody");
    if(cuerpo) cuerpo.innerHTML = htmlLista();
  };
  window.abMarcar = function(clave, i){ alternar(clave, i); pintar(); };
  window.abReiniciar = function(id){
    var c = buscarCaso(id); if(!c) return;
    limpiarCaso(c); pintar();
    if(typeof toast === "function") toast("Expediente en blanco otra vez");
  };
  window.abImprimir = function(){
    var vieja = document.getElementById("abPrint");
    if(vieja) vieja.remove();
    var d = document.createElement("div");
    d.id = "abPrint";
    d.innerHTML = htmlImpresion();
    document.body.appendChild(d);
    document.body.classList.add("imprimiendo-guias");
    window.print();
    setTimeout(function(){
      document.body.classList.remove("imprimiendo-guias");
      var x = document.getElementById("abPrint"); if(x) x.remove();
    }, 700);
  };

  function pintar(){
    var c = cont();
    var caso = vista.caso ? buscarCaso(vista.caso) : null;
    var titulo, sub, cuerpo;
    if(caso && caso.herramienta){
      var tp = vista.tipo ? buscarTipo(vista.tipo) : null;
      titulo = tp ? tp.nom : caso.nom;
      sub = tp ? "Qué necesita este bien" : "Toque el tipo de bien";
      cuerpo = tp ? htmlTipo(tp) : htmlTipos();
    } else if(caso){
      titulo = caso.nom;
      sub = (GRUPOS.filter(function(g){ return g.cod === caso.grupo; })[0] || {}).nom || "";
      cuerpo = htmlCaso(caso);
    } else {
      titulo = "Altas y bajas";
      sub = "Qué hacer según el tipo de bien y el motivo";
      cuerpo = htmlLista();
    }
    c.innerHTML =
      '<div class="gtop">'
      + '<button class="mrx" onclick="' + (caso ? 'abVolver()' : 'abCerrar()') + '" aria-label="Volver">'
      + ic(caso ? "arrowLeft" : "x", 20) + '</button>'
      + '<div class="gtoptit">' + esca(titulo) + '<small>' + esca(sub) + '</small></div>'
      + (caso ? '' : '<button class="mrx" onclick="abImprimir()" aria-label="Imprimir">' + ic("download", 19) + '</button>')
      + '</div>'
      + '<div class="gbody">' + cuerpo + '</div>';
  }

  /* ---------- listado ---------- */
  function textoBuscable(caso){
    var t = caso.nom + " " + (caso.resumen || "");
    (caso.secciones || []).forEach(function(s){
      if(s.txt) t += " " + s.txt;
      if(s.nom) t += " " + s.nom;
      (s.items || []).forEach(function(x){ t += " " + textoPaso(x); });
    });
    if(caso.herramienta) TIPOS.forEach(function(x){ t += " " + x.nom + " " + (x.quien || ""); });
    return t.replace(/<[^>]+>/g, " ").toLowerCase();
  }

  function htmlLista(){
    var q = vista.q.trim().toLowerCase();
    var h = "";
    if(!q){
      h += '<div class="gintro">' + ic("book", 17, "margin-right:7px;color:var(--azul2)")
        + 'Lo que dicen los acuerdos del Instituto sobre altas y bajas, ordenado por el motivo. '
        + 'Cada paso y cada documento se puede ir marcando mientras arma el expediente.</div>';
    }
    h += '<div class="gbuscar">' + ic("search", 17)
      + '<input type="search" placeholder="Buscar (faltante, permuta, dictamen…)" value="' + esca(vista.q) + '" '
      + 'oninput="abBuscar(this.value)">'
      + '</div>';

    var hubo = false;
    GRUPOS.forEach(function(g){
      var casos = CASOS.filter(function(c){
        if(c.grupo !== g.cod) return false;
        if(!q) return true;
        return textoBuscable(c).indexOf(q) >= 0;
      });
      if(!casos.length) return;
      hubo = true;
      h += '<div class="gsis ' + g.clase + '">'
        + '<div class="gsisnom">' + esca(g.nom) + '</div>'
        + (q ? '' : '<div class="gsisnota">' + esca(g.nota) + '</div>')
        + '</div>';
      h += casos.map(function(c){
        var acc = c.herramienta ? 0 : totalAcciones(c);
        var hechos = c.herramienta ? 0 : totalMarcados(c);
        var enCurso = hechos > 0 && hechos < acc;
        var listo = acc > 0 && hechos >= acc;
        var pie = c.herramienta ? esca(c.resumen)
          : (esca(c.resumen) + (enCurso ? ' · va en el ' + hechos + ' de ' + acc : (listo ? ' · completo' : '')));
        return '<button class="gcard' + (enCurso ? ' encurso' : '') + '" onclick="abAbrir(\'' + c.id + '\')">'
          + '<span class="gcardic gcardic-' + c.grupo + '">' + ic(c.ic, 20) + '</span>'
          + '<span class="gcardtxt"><b>' + esca(c.nom) + '</b><small>' + pie + '</small></span>'
          + '<span class="gcardch">' + (listo ? ic("check", 17) : '›') + '</span>'
          + '</button>';
      }).join("");
    });
    if(!hubo){
      h += (typeof emptyState === "function")
        ? emptyState("Sin coincidencias", "Pruebe con otra palabra, por ejemplo \"faltante\", \"donación\" o \"dictamen\"")
        : '<div class="gintro">Sin coincidencias.</div>';
    }
    h += '<div class="abfuentes">Fuentes: Acuerdo 1560 de Junta Directiva (29/04/2025) · '
      + 'Acuerdo 40/2019 de Gerencia (10/09/2019) · Acuerdo 19/2025 de Gerencia (11/06/2025) · '
      + 'Acuerdo 23/2025 de Gerencia (27/08/2025). Ante cualquier duda, mandan los acuerdos.</div>';
    return h;
  }

  /* ---------- un caso ---------- */
  function htmlCaso(caso){
    var h = "";
    var acc = totalAcciones(caso);
    var hechos = totalMarcados(caso);
    if(acc){
      var pct = Math.round(hechos / acc * 100);
      h += '<div class="gprog"><div class="gprogtxt"><span>' + hechos + ' de ' + acc + '</span>'
        + (hechos ? '<span class="gprogre" onclick="abReiniciar(\'' + caso.id + '\')">Empezar de nuevo</span>' : '')
        + '</div><div class="gprogbar"><i style="width:' + pct + '%"></i></div></div>';
    }

    (caso.secciones || []).forEach(function(s, idx){
      if(s.t === "nota"){
        h += '<div class="abnota">' + ic("helpCircle", 15, "margin-right:7px;flex:none;color:var(--azul2)")
          + '<span>' + enlaces(s.txt) + '</span></div>';
      } else if(s.t === "aviso"){
        h += '<div class="abaviso">' + ic("alertTriangle", 15, "margin-right:7px;flex:none")
          + '<span>' + enlaces(s.txt) + '</span></div>';
      } else if(s.t === "quien"){
        h += '<div class="abquien"><div class="abquientit">' + ic("user", 14, "margin-right:6px")
          + 'Quién autoriza</div><div>' + enlaces(s.txt) + '</div></div>';
      } else if(s.t === "lista"){
        h += '<div class="abtit">' + esca(s.nom) + '</div><ul class="ablista">'
          + (s.items || []).map(function(x){ return '<li>' + enlaces(x) + '</li>'; }).join("")
          + '</ul>';
      } else if(s.t === "pasos" || s.t === "docs"){
        var clave = caso.id + ":" + idx;
        var listos = marcados(clave);
        h += '<div class="abtit">' + esca(s.nom) + '</div>';
        h += '<ol class="gpasos">';
        var n = 0;
        (s.items || []).forEach(function(txt, i){
          if(esResultado(txt)){
            h += '<li class="gres">' + ic("helpCircle", 15, "margin-right:6px;flex:none")
              + '<span>' + enlaces(textoPaso(txt)) + '</span></li>';
            return;
          }
          n++;
          var ok = listos.indexOf(i) >= 0;
          // los documentos llevan casilla cuadrada; los pasos, su número
          h += '<li class="gpaso' + (s.t === "docs" ? " doc" : "") + (ok ? ' ok' : '') + '"'
            + ' onclick="abMarcar(\'' + clave + '\',' + i + ')">'
            + '<span class="gnum">' + (ok ? ic("check", 15) : (s.t === "docs" ? "" : n)) + '</span>'
            + '<span class="gtxt">' + enlaces(txt) + '</span></li>';
        });
        h += '</ol>';
      } else if(s.t === "base"){
        h += '<div class="abbase"><b>' + ic("book", 13, "margin-right:5px") + 'Base normativa</b>'
          + (s.items || []).map(function(x){ return '<span>' + esca(x) + '</span>'; }).join("")
          + '</div>';
      }
    });

    if(acc && hechos >= acc){
      h += '<div class="gfin">' + ic("check", 26) + '<b>Expediente completo</b>'
        + '<small>' + esca(caso.nom) + '</small>'
        + '<button class="act o" style="margin-top:12px" onclick="abReiniciar(\'' + caso.id + '\')">Empezar otro</button>'
        + '<button class="act p" style="margin-top:8px" onclick="abVolver()">Ver los demás casos</button></div>';
    } else {
      h += '<button class="act o" style="margin-top:16px" onclick="abVolver()">Ver los demás casos</button>';
    }
    return h;
  }

  /* ---------- herramienta: el trámite completo según el tipo de bien ----------
     El esqueleto de la baja por desuso es el mismo para todos (Acuerdo 1560, artículos 2 y
     3), pero cambia según el tipo: si lleva dictamen y de quién, si el acta administrativa
     lo sustituye, si interviene Auditoría Interna, y si obliga al tratamiento de desechos.
     En vez de mandar a leer un procedimiento genérico y descontar mentalmente lo que no
     aplica, aquí se arma la lista ya resuelta para el bien que se tiene enfrente.

     Son tres bloques distintos y conviene no confundirlos:
       1. Autorizar la baja (Acuerdo 1560, artículos 2 y 3) — para todos.
       2. Ejecutar el destino, si es destrucción o desintegración (artículos 11 a 17) —
          también para todos: cualquier bien puede terminar destruido.
       3. Tratamiento de desechos tóxicos (Acuerdo 23/2025) — solo para EQUIPO. El
          instructivo dice "equipo mecánico, eléctrico, electrónico, médico sanitario y de
          laboratorio, vehículos, equipo de cómputo y cualquier otro EQUIPO que contenga
          placa con circuitos electrónicos, ácidos o líquidos". Un escritorio o una silla no
          son equipo, así que a mobiliario y a material educacional no les toca. */

  var P_INCOMPLETO = "Si el bien está incompleto y por eso se dificulta identificarlo contra el Módulo y el Sistema Auxiliar (plaqueta o etiqueta deteriorada, distintivos de la marca ilegibles, partes accesorias), faccione Acta Administrativa suscrita por la Autoridad Superior y el Encargado de Inventarios describiendo la dificultad, y adjunte su certificación a la solicitud";
  var P_SOLICITUD = "Conforme el expediente y remita la solicitud de autorización a la Subgerencia que corresponda";
  var P_CUSTODIA  = "> Mientras tanto, los bienes quedan bajo la guarda y custodia del Encargado de Inventarios y la Máxima Autoridad de la Dependencia";
  var P_RESOLUCION= "La Subgerencia emite la Resolución autorizando, denegando o modificando lo solicitado, e indica el destino de los bienes";
  var P_AUDITOR   = "> La Subgerencia puede requerir a la Jefatura del Departamento de Auditoría Interna que nombre a un Auditor para comprobar la existencia física de los bienes";
  var P_ACTA      = "Se facciona acta con la Máxima Autoridad, el Encargado de Inventarios y el Auditor Interno si fue nombrado, con la cantidad, descripción, número de bien, número y fecha de despacho y valor según costo de adquisición";
  var P_CONTA     = "Envíe copia certificada de esa acta al Departamento de Contabilidad para los ajustes en el inventario general del Instituto";
  var P_REGISTRO  = "Registre la baja en el Módulo y en el Sistema Auxiliar; la aprobación la efectúa el Departamento de Contabilidad";
  var P_TARJETA   = "Descargue el bien de la tarjeta de responsabilidad solo hasta que la baja esté aprobada en el Módulo y en el Sistema Auxiliar";
  var P_LISTADO   = "La máxima autoridad de la dependencia, bajo su responsabilidad y con la intervención del Encargado de Inventarios, elabora un listado con la descripción de los bienes considerados en desuso";
  var P_SUGIERE   = "> El dictamen debe indicar si los bienes son susceptibles de baja y, luego de la evaluación, sugerir si son objeto de permuta, donación, desintegración, acoplamiento o destrucción";

  function esEquipo(t){ return t.toxicos === true || t.toxicos === "equipo"; }

  function rutaDe(t){
    if(t.quien === "militar"){
      return { clave:"militar",
        aviso:"El Acuerdo 1560 no describe ningún trámite propio para este tipo de bien: remite por completo a una ley especial. Antes de iniciar, consúltelo con el Departamento Legal.",
        pasos:[
          "Atienda lo que establece la <b>Ley de Armas y Municiones</b>, Decreto 15-2009 del Congreso de la República de Guatemala, y su respectivo Reglamento",
          "> El artículo 4 del Acuerdo 1560 se agota en esa remisión: no fija pasos, plazos ni instancia dentro del Instituto"
        ],
        destino:false,
        base:["Acuerdo 1560 de J.D., artículo 4","Ley de Armas y Municiones, Decreto 15-2009"] };
    }
    if(t.quien === "fungible"){
      return { clave:"fungible",
        nota:"El artículo 15 exime <b>únicamente</b> del dictamen técnico y de la intervención de Auditoría Interna. El resto del trámite —expediente, solicitud y Resolución— sigue siendo el general del artículo 2, que no distingue por tipo de bien.",
        pasos:[
          "La Máxima Autoridad y el Encargado de Inventarios evalúan, bajo su estricta responsabilidad, si los bienes son susceptibles de darles de baja",
          "> No se requiere dictamen técnico ni la intervención del Departamento de Auditoría Interna",
          "Deje constancia de lo actuado en <b>Acta Administrativa</b>",
          P_SOLICITUD, P_CUSTODIA, P_RESOLUCION, P_REGISTRO, P_TARJETA
        ],
        destino:true,
        base:["Acuerdo 1560 de J.D., artículos 2 y 15","Manual 40/2019, numerales 18 y 28"] };
    }
    if(t.quien === null){
      return { clave:"sindictamen",
        pasos:[
          P_LISTADO,
          "<b>No se requiere dictamen previo.</b> Suscriba el <b>Acta Administrativa</b> entre la máxima autoridad y el Encargado de Inventarios de la dependencia interesada: eso es lo que documenta la baja en lugar del dictamen",
          P_INCOMPLETO, P_SOLICITUD, P_CUSTODIA, P_RESOLUCION, P_AUDITOR,
          P_ACTA, P_CONTA, P_REGISTRO, P_TARJETA
        ],
        destino:true,
        base:["Acuerdo 1560 de J.D., artículos 2 y 3","Acuerdo 19/2025, numerales 17.1 y 19","Manual 40/2019, numerales 18 y 28"] };
    }
    var pasos = [ P_LISTADO, "Solicite el dictamen técnico a <b>la " + t.quien + "</b>", P_SUGIERE ];
    if(esEquipo(t)){
      pasos.push("> El dictamen debe indicar además los componentes que contengan desechos tóxicos y que requieran tratamiento especial por entidades debidamente certificadas y autorizadas (Acuerdo 23/2025, norma general 2)");
    }
    pasos = pasos.concat([
      "> El dictamen debe considerar que los bienes observados físicamente son los que se relacionan con el Módulo y el Sistema Auxiliar, conforme a las justificaciones del Acta Administrativa",
      P_INCOMPLETO, P_SOLICITUD, P_CUSTODIA, P_RESOLUCION, P_AUDITOR,
      P_ACTA, P_CONTA, P_REGISTRO, P_TARJETA
    ]);
    return { clave:"condictamen", pasos:pasos, destino:true,
      base:["Acuerdo 1560 de J.D., artículos 2 y 3","Acuerdo 19/2025, numerales 17.1, 19 y 19.1","Manual 40/2019, numerales 18 y 28"] };
  }

  /* Ejecutar el destino cuando es destrucción o desintegración. Vale para cualquier bien:
     el Acuerdo 1560 no lo limita a los que generan desechos. */
  function pasosDestino(t){
    var items = [
      "> La destrucción procede después de dar cumplimiento a los artículos 3, 11 y 12 del Reglamento, y cuando por el deterioro sufrido ya no sea posible su uso. Es decir: primero hay que haber agotado la desintegración y el acoplamiento",
      "Descarte la desintegración: procede si alguna Dependencia del Instituto lo solicitó previamente y el bien contiene piezas en buenas condiciones y funcionales para usarse como repuestos de otros bienes muebles que estén en uso",
      "Descarte el acoplamiento: procede cuando el bien no puede funcionar por sí mismo pero, al combinarlo con otros aparatos o sistemas para formar una sola unidad, produce un resultado conveniente y ofrece servicio por algún tiempo más",
      "> Tanto la desintegración como el acoplamiento se hacen constar en Acta Administrativa"
    ];
    if(esEquipo(t)){
      items.push("Antes de destruir, cumpla el tratamiento de desechos tóxicos del bloque siguiente");
    }
    return items.concat([
      "El Departamento de Auditoría Interna señala día y hora para llevar a cabo la desintegración o destrucción, y nombra con la debida antelación a un Auditor Interno",
      "El Auditor Interno hace constar la destrucción de los bienes en acta pormenorizada",
      "Legalice lo actuado por medio de Acta Administrativa, o según lo que proceda atendiendo a la naturaleza, importancia y valor de los bienes",
      "> Si los materiales resultantes son aprovechables para reciclaje, la Subgerencia puede ordenar por Resolución su subasta pública, venta, donación o permuta (artículo 17)"
    ]);
  }

  /* Tratamiento de desechos tóxicos: solo para equipo (Acuerdo 23/2025). */
  function pasosToxicos(t){
    return [
      "Considere la normativa vigente que dicte lineamientos para el manejo de desechos tóxicos: es de aplicación obligatoria y hay que apegarse estrictamente a ella",
      "Revise que el dictamen técnico incluya la descripción de los componentes considerados tóxicos para el medio ambiente",
      "Verifique que en el bien no permanezca visible ni legible ningún logotipo, número de serie, placa o señalamiento similar que lo relacione con el IGSS, para prevenir su eventual circulación dentro del territorio nacional",
      "Solicite a <b>la " + (t.quien || "dependencia técnica que corresponda") + "</b> la asignación de personal técnico que realice la extracción de los componentes tóxicos",
      "> Los componentes extraídos quedan bajo el resguardo de esa dependencia técnica",
      "Gestione con una entidad autorizada y debidamente certificada la disposición final de los componentes tóxicos extraídos",
      "Requiera la constancia de disposición correspondiente, como respaldo de que fueron retirados y manejados conforme a la normativa ambiental vigente"
    ];
  }

  /* Quiénes intervienen, resuelto para el tipo. Es la otra pregunta que se hace siempre. */
  function intervienenEn(t){
    if(t.quien === "militar"){
      return ["<b>Máxima Autoridad</b> de la Dependencia y <b>Encargado de Inventarios</b> de la UAIAF",
              "<b>Departamento Legal</b>, para encuadrar el trámite en la Ley de Armas y Municiones",
              "> El Acuerdo 1560 no nombra a nadie más para este tipo de bien"];
    }
    var l = ["<b>Máxima Autoridad</b> de la Dependencia interesada: elabora el listado bajo su responsabilidad y suscribe las actas",
             "<b>Encargado de Inventarios</b> de la UAIAF: interviene en el listado, arma el expediente y registra la baja en el Módulo y en el Sistema Auxiliar"];
    if(t.quien && t.quien !== "fungible"){
      l.push("<b>La " + t.quien + "</b>: emite el dictamen técnico"
        + (esEquipo(t) ? ", indicando además los componentes con desechos tóxicos, y asigna al personal que los extrae" : ""));
    }
    l.push("<b>La Subgerencia</b> que corresponda según el numeral 17.1: emite la Resolución que autoriza, deniega o modifica, e indica el destino");
    if(t.quien === "fungible"){
      l.push("> <b>El Departamento de Auditoría Interna no interviene</b> en la evaluación ni en la baja de los bienes fungibles (artículo 15)");
    } else {
      l.push("<b>Departamento de Auditoría Interna</b>: nombra al Auditor que comprueba la existencia física, si la Subgerencia se lo requiere");
    }
    l.push("<b>Departamento de Auditoría Interna</b>: señala día y hora de la desintegración o destrucción y nombra al Auditor que la hace constar en acta pormenorizada (artículo 14)");
    l.push("<b>Departamento de Contabilidad</b>: efectúa los ajustes en el inventario general y aprueba el registro de la baja");
    if(esEquipo(t)){
      l.push("<b>Entidad certificada y autorizada</b> para el manejo de desechos tóxicos: recibe los componentes extraídos y extiende la constancia de disposición");
    }
    return l;
  }

  function bloqueMarcable(clave, titulo, items){
    var listos = marcados(clave);
    var h = '<div class="abtit">' + esca(titulo) + '</div><ol class="gpasos">';
    var n = 0;
    items.forEach(function(txt, i){
      if(esResultado(txt)){
        h += '<li class="gres">' + ic("helpCircle", 15, "margin-right:6px;flex:none")
          + '<span>' + enlaces(textoPaso(txt)) + '</span></li>';
        return;
      }
      n++;
      var ok = listos.indexOf(i) >= 0;
      h += '<li class="gpaso' + (ok ? ' ok' : '') + '" onclick="abMarcar(\'' + clave + '\',' + i + ')">'
        + '<span class="gnum">' + (ok ? ic("check", 15) : n) + '</span>'
        + '<span class="gtxt">' + enlaces(txt) + '</span></li>';
    });
    return h + '</ol>';
  }
  function cuentaMarcable(clave, items){
    var listos = marcados(clave), n = 0;
    listos.forEach(function(i){ if(items[i] !== undefined && !esResultado(items[i])) n++; });
    return n;
  }
  function accionesEn(items){
    return items.filter(function(x){ return !esResultado(x); }).length;
  }
  /* Los bloques de un tipo, cada uno con su llave de guardado. */
  function bloquesDe(t){
    var r = rutaDe(t), out = [{ k:"p", nom:"1. Autorizar la baja", items:r.pasos }];
    if(r.destino) out.push({ k:"d", nom:"2. Si el destino es destrucción o desintegración", items:pasosDestino(t) });
    if(esEquipo(t)) out.push({ k:"x", nom:"3. Tratamiento de desechos tóxicos", items:pasosToxicos(t) });
    return { ruta:r, bloques:out };
  }
  function totalDe(t){
    var B = bloquesDe(t), tot = 0, hech = 0;
    B.bloques.forEach(function(b){
      tot += accionesEn(b.items);
      hech += cuentaMarcable("tipo:" + t.id + ":" + b.k, b.items);
    });
    return { tot:tot, hech:hech, B:B };
  }

  window.abReiniciarTipo = function(id){
    var a = leerAvance();
    ["p","d","x"].forEach(function(k){ delete a["tipo:" + id + ":" + k]; });
    guardarAvance(a); pintar();
    if(typeof toast === "function") toast("Trámite en blanco otra vez");
  };

  function htmlTipos(){
    var h = '<div class="gintro">' + ic("helpCircle", 17, "margin-right:7px;color:var(--azul2)")
      + 'Toque el tipo de bien y le arma el trámite completo para ese caso: quiénes intervienen, '
      + 'los pasos para autorizar la baja, los de la destrucción si procede, y los de desechos '
      + 'tóxicos solo si al bien le tocan.</div>';
    h += TIPOS.map(function(t){
      var etq = t.quien === null ? "Sin dictamen; con acta administrativa"
        : t.quien === "fungible" ? "Sin dictamen ni Auditoría Interna"
        : t.quien === "militar" ? "Se rige por la Ley de Armas y Municiones"
        : "Dictamen de la " + t.quien;
      var x = totalDe(t);
      var enCurso = x.hech > 0 && x.hech < x.tot;
      return '<button class="gcard' + (enCurso ? ' encurso' : '') + '" onclick="abTipo(\'' + t.id + '\')">'
        + '<span class="gcardtxt"><b>' + esca(t.nom) + '</b><small>' + esca(etq)
        + (enCurso ? ' · va en el ' + x.hech + ' de ' + x.tot : '') + '</small></span>'
        + '<span class="gcardch">›</span></button>';
    }).join("");
    h += '<div class="abfuentes">Acuerdo 1560 de Junta Directiva, artículos 2, 3, 4 y 11 a 17 · '
      + 'Acuerdo 19/2025 de Gerencia, numerales 17.1, 19 y 19.1 · Manual 40/2019, numerales 18 y 28 · '
      + 'Acuerdo 23/2025 de Gerencia.</div>';
    h += '<button class="act o" style="margin-top:14px" onclick="abVolver()">Volver</button>';
    return h;
  }

  function htmlTipo(t){
    var x = totalDe(t), r = x.B.ruta;
    var h = "";
    if(x.tot){
      var pct = Math.round(x.hech / x.tot * 100);
      h += '<div class="gprog"><div class="gprogtxt"><span>' + x.hech + ' de ' + x.tot + '</span>'
        + (x.hech ? '<span class="gprogre" onclick="abReiniciarTipo(\'' + t.id + '\')">Empezar de nuevo</span>' : '')
        + '</div><div class="gprogbar"><i style="width:' + pct + '%"></i></div></div>';
    }

    h += '<div class="abtit">Dictamen técnico</div>';
    if(t.quien === null){
      h += '<div class="abresp abresp-no">' + ic("check", 22)
        + '<div><b>No requiere dictamen previo</b>'
        + '<small>Se documenta con <b>acta administrativa</b> suscrita por la máxima autoridad y el Encargado de Inventarios de la dependencia interesada (Acuerdo 1560, artículo 2).</small></div></div>';
    } else if(t.quien === "fungible"){
      h += '<div class="abresp abresp-no">' + ic("check", 22)
        + '<div><b>No requiere dictamen técnico ni intervención de Auditoría Interna</b>'
        + '<small>Queda bajo la estricta responsabilidad de la Máxima Autoridad y del Encargado de Inventarios evaluar si son susceptibles de baja, dejando constancia en <b>Acta Administrativa</b> (Acuerdo 1560, artículo 15).</small></div></div>';
    } else if(t.quien === "militar"){
      h += '<div class="abresp abresp-ojo">' + ic("alertTriangle", 22)
        + '<div><b>Se rige por ley especial</b>'
        + '<small>Debe atenderse a lo que establece la <b>Ley de Armas y Municiones</b>, Decreto 15-2009 del Congreso de la República de Guatemala, y su respectivo Reglamento (Acuerdo 1560, artículo 4).</small></div></div>';
    } else {
      h += '<div class="abresp abresp-si">' + ic("clipboardCheck", 22)
        + '<div><b>La ' + esca(t.quien) + '</b>'
        + '<small>Es quien emite el dictamen técnico para este tipo de bien (Acuerdo 1560, artículo 2).</small></div></div>';
    }

    h += '<div class="abtit">Desechos tóxicos</div>';
    if(t.toxicos === true){
      h += '<div class="abresp abresp-ojo">' + ic("alertTriangle", 22)
        + '<div><b>Sí, y el Acuerdo 23/2025 lo nombra</b>'
        + '<small>Antes de destruirlo hay que extraer los componentes tóxicos y gestionar su disposición final con una entidad certificada.</small></div></div>';
    } else if(t.toxicos === "equipo"){
      h += '<div class="abresp abresp-ojo">' + ic("alertTriangle", 22)
        + '<div><b>Solo si trae circuitos, ácidos o líquidos</b>'
        + '<small>El Acuerdo 23/2025 no nombra este equipo, pero sí alcanza a <b>cualquier otro equipo que contenga placa con circuitos electrónicos, ácidos o líquidos</b>. Revise el bien antes de descartarlo.</small></div></div>';
    } else {
      h += '<div class="abresp abresp-no">' + ic("check", 22)
        + '<div><b>No aplica</b>'
        + '<small>El Acuerdo 23/2025 rige para <b>equipo</b>: mecánico, eléctrico, electrónico, médico-sanitario y de laboratorio, vehículos, de cómputo, y cualquier otro equipo con placa de circuitos, ácidos o líquidos. Este tipo de bien no entra ahí.</small></div></div>';
    }

    if(r.aviso){
      h += '<div class="abaviso">' + ic("alertTriangle", 15, "margin-right:7px;flex:none")
        + '<span>' + enlaces(r.aviso) + '</span></div>';
    }

    h += '<div class="abtit">Quiénes intervienen</div><ul class="ablista">'
      + intervienenEn(t).map(function(y){
          return esResultado(y)
            ? '<li class="abli-no">' + enlaces(textoPaso(y)) + '</li>'
            : '<li>' + enlaces(y) + '</li>';
        }).join("") + '</ul>';

    x.B.bloques.forEach(function(b){
      h += bloqueMarcable("tipo:" + t.id + ":" + b.k, b.nom, b.items);
      if(b.k === "d"){
        h += '<div class="abnota">' + ic("helpCircle", 15, "margin-right:7px;flex:none;color:var(--azul2)")
          + '<span>El destino lo indica la Resolución de la Subgerencia. Los demás destinos posibles '
          + '(subasta, permuta, donación) están en [[destinos|Qué se puede hacer con el bien dado de baja]].</span></div>';
        if(t.quien === "fungible"){
          h += '<div class="abaviso">' + ic("alertTriangle", 15, "margin-right:7px;flex:none")
            + '<span>Aquí los acuerdos no coinciden: el artículo 15 dice que en los bienes fungibles no interviene '
            + 'Auditoría Interna, y el artículo 14 encarga a ese mismo Departamento señalar día y hora de la '
            + 'destrucción, sin exceptuar a nadie. Confírmelo antes de programar una destrucción de fungibles.</span></div>';
        }
      }
    });

    if(r.nota){
      h += '<div class="abnota">' + ic("helpCircle", 15, "margin-right:7px;flex:none;color:var(--azul2)")
        + '<span>' + enlaces(r.nota) + '</span></div>';
    }

    h += '<div class="abbase"><b>' + ic("book", 13, "margin-right:5px") + 'Base normativa</b>'
      + r.base.map(function(y){ return '<span>' + esca(y) + '</span>'; }).join("")
      + (r.destino ? '<span>Acuerdo 1560 de J.D., artículos 11, 12, 13, 14, 16 y 17</span>' : '')
      + (esEquipo(t) ? '<span>Acuerdo 23/2025 de Gerencia, normas generales 2 y 3 y norma específica 1</span>' : '')
      + '</div>';

    if(x.tot && x.hech >= x.tot){
      h += '<div class="gfin">' + ic("check", 26) + '<b>Trámite completo</b>'
        + '<small>' + esca(t.nom) + '</small>'
        + '<button class="act o" style="margin-top:12px" onclick="abReiniciarTipo(\'' + t.id + '\')">Empezar otro</button>'
        + '<button class="act p" style="margin-top:8px" onclick="abVolver()">Ver otro tipo de bien</button></div>';
    } else {
      h += '<button class="act o" style="margin-top:14px" onclick="abVolver()">Ver otro tipo de bien</button>';
    }
    return h;
  }

  /* ---------- versión para imprimir ---------- */
  function htmlImpresion(){
    var h = '<h1>Altas y bajas del inventario</h1>'
      + '<div class="gpsub">Departamento de Auditoría Interna · Instituto Guatemalteco de Seguridad Social</div>'
      + '<p class="gpnota">Elaborado con el Acuerdo 1560 de Junta Directiva (29/04/2025), el Acuerdo 40/2019 de '
      + 'Gerencia (10/09/2019), el Acuerdo 19/2025 de Gerencia (11/06/2025) y el Acuerdo 23/2025 de Gerencia '
      + '(27/08/2025). Ante cualquier duda, mandan los acuerdos.</p>';

    var NOMRUTA = { condictamen:"A", sindictamen:"B", fungible:"C", militar:"D" };
    h += '<h2>Qué le toca a cada tipo de bien</h2><table class="abtabla">'
      + '<tr><th>Tipo de bien</th><th>Dictamen</th><th>Desechos tóxicos</th><th>Ruta</th></tr>';
    TIPOS.forEach(function(t){
      var q = t.quien === null ? "No requiere; acta administrativa"
        : t.quien === "fungible" ? "No requiere; tampoco Auditoría Interna"
        : t.quien === "militar" ? "Ley de Armas y Municiones, Dto. 15-2009"
        : "La " + t.quien;
      var tox = t.toxicos === true ? "Sí"
        : t.toxicos === "equipo" ? "Solo si trae circuitos, ácidos o líquidos"
        : "No aplica";
      h += '<tr><td>' + esca(t.nom) + '</td><td>' + esca(q) + '</td><td>' + esca(tox)
        + '</td><td>' + NOMRUTA[rutaDe(t).clave] + '</td></tr>';
    });
    h += '</table>';

    /* Las cuatro rutas de baja, completas. Doce listas casi iguales no sirven en papel:
       se imprime una por ruta y la tabla de arriba dice cuál le toca a cada tipo. */
    var RUTAS = [
      { letra:"A", nom:"Equipo que lleva dictamen técnico",
        pie:"Equipo de cómputo, mecánico, eléctrico, electrónico, médico-sanitario y de laboratorio, de producción, de comunicación, y maquinaria y equipo de transporte, tracción y elevación. Solicite el dictamen a la dependencia que indica la tabla.",
        tipo:{ id:"__A", nom:"Equipo con dictamen", quien:"dependencia que corresponda según la tabla", toxicos:true } },
      { letra:"B", nom:"Bienes que no llevan dictamen",
        pie:"Mobiliario de oficina y material educacional, cultural y recreativo. No les alcanza el Acuerdo 23/2025: no son equipo.",
        tipo:{ id:"__B", nom:"Sin dictamen", quien:null, toxicos:false } },
      { letra:"C", nom:"Bienes muebles fungibles",
        pie:"No llevan dictamen técnico ni intervención de Auditoría Interna en la evaluación de la baja.",
        tipo:{ id:"__C", nom:"Fungibles", quien:"fungible", toxicos:false } },
      { letra:"D", nom:"Equipo militar",
        pie:"Armas y municiones.",
        tipo:{ id:"__D", nom:"Militar", quien:"militar", toxicos:false } }
    ];
    h += '<h2>Las cuatro rutas de baja por desuso</h2>';
    RUTAS.forEach(function(R){
      var B = bloquesDe(R.tipo), r = B.ruta;
      h += '<h3>Ruta ' + R.letra + ' — ' + esca(R.nom) + '</h3>';
      h += '<p class="gpnota">' + esca(R.pie) + '</p>';
      if(r.aviso) h += '<p class="gpnota">Atención: ' + r.aviso + '</p>';
      h += '<h4>Quiénes intervienen</h4><ul>'
        + intervienenEn(R.tipo).map(function(y){ return '<li>' + textoPaso(y) + '</li>'; }).join("")
        + '</ul>';
      B.bloques.forEach(function(b){
        h += '<h4>' + esca(b.nom) + '</h4><ol>' + b.items.map(function(y){
          return esResultado(y) ? '<li class="gpres">' + textoPaso(y) + '</li>' : '<li>' + y + '</li>';
        }).join("") + '</ol>';
      });
      if(r.nota) h += '<p class="gpnota">' + r.nota + '</p>';
      h += '<p class="abpbase">' + esca(r.base.join(" · ")) + '</p>';
    });

    GRUPOS.forEach(function(g){
      var casos = CASOS.filter(function(c){ return c.grupo === g.cod && !c.herramienta; });
      if(!casos.length) return;
      h += '<h2>' + esca(g.nom) + '</h2>';
      casos.forEach(function(c){
        h += '<h3>' + esca(c.nom) + '</h3>';
        (c.secciones || []).forEach(function(s){
          if(s.t === "nota" || s.t === "aviso"){
            h += '<p class="gpnota">' + (s.t === "aviso" ? "Atención: " : "") + enlacesPlano(s.txt) + '</p>';
          } else if(s.t === "quien"){
            h += '<p class="gpnota"><b>Quién autoriza:</b> ' + enlacesPlano(s.txt) + '</p>';
          } else if(s.t === "lista"){
            h += '<h4>' + esca(s.nom) + '</h4><ul>'
              + (s.items || []).map(function(x){ return '<li>' + enlacesPlano(x) + '</li>'; }).join("") + '</ul>';
          } else if(s.t === "pasos" || s.t === "docs"){
            h += '<h4>' + esca(s.nom) + '</h4><ol>'
              + (s.items || []).map(function(x){
                  return esResultado(x) ? '<li class="gpres">' + enlacesPlano(textoPaso(x)) + '</li>'
                                        : '<li>' + enlacesPlano(x) + '</li>';
                }).join("") + '</ol>';
          } else if(s.t === "base"){
            h += '<p class="abpbase">' + esca((s.items || []).join(" · ")) + '</p>';
          }
        });
      });
    });
    return h;
  }
  // en papel no hay a dónde tocar: el enlace se queda solo con su texto
  function enlacesPlano(t){
    return String(t || "").replace(/\[\[[a-z0-9\-]+\|([^\]]+)\]\]/gi, "$1");
  }

  /* ---------- entrada en el menú ---------- */
  function inyectarEnMenu(){
    var orig = window.openMenu;
    if(typeof orig !== "function") return;
    window.openMenu = function(){
      var r = orig.apply(this, arguments);
      try {
        var sheet = document.getElementById("sheet");
        if(!sheet || document.getElementById("itemAltasBajas")) return r;
        var html = '<div class="mitem" id="itemAltasBajas" onclick="closeMenu();abrirAltasBajas()">'
          + '<span class="ic">' + ic("clipboardCheck", 20) + '</span>'
          + '<div><b>Altas y bajas del inventario</b>'
          + '<small>Qué trámite y qué papeles según el tipo de bien y el motivo</small></div></div>';
        // va junto a la guía de AS-400, que es de la misma naturaleza
        var guias = document.getElementById("itemGuias");
        if(guias) guias.insertAdjacentHTML("afterend", html);
        else {
          var secciones = sheet.querySelectorAll(".msec");
          var ancla = secciones.length ? secciones[secciones.length - 1] : null;
          if(ancla) ancla.insertAdjacentHTML("beforebegin", '<div class="msec">Procedimientos</div>' + html);
          else sheet.insertAdjacentHTML("beforeend", html);
        }
      } catch(e){}
      return r;
    };
  }

  if(document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded", function(){ setTimeout(inyectarEnMenu, 0); });
  } else {
    setTimeout(inyectarEnMenu, 0);
  }
})();
