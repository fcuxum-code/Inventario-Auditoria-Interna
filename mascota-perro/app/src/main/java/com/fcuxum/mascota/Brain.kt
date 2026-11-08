package com.fcuxum.mascota

import com.anthropic.client.AnthropicClient
import com.anthropic.client.okhttp.AnthropicOkHttpClient
import com.anthropic.core.JsonValue
import com.anthropic.errors.AnthropicServiceException
import com.anthropic.models.messages.ContentBlockParam
import com.anthropic.models.messages.MessageCreateParams
import com.anthropic.models.messages.MessageParam
import com.anthropic.models.messages.OutputConfig
import com.anthropic.models.messages.TextBlockParam
import com.anthropic.models.messages.Tool
import com.anthropic.models.messages.ToolResultBlockParam
import org.json.JSONObject
import java.io.IOException
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/** La "inteligencia" de la mascota: Claude + herramientas del teléfono. */
class Brain(private val prefs: Prefs, private val actions: PhoneActions) {

    private val history = ArrayList<MessageParam>()
    private var lastUse = 0L
    private var client: AnthropicClient? = null
    private var clientKey = ""

    fun reset() = history.clear()

    fun ask(text: String): String {
        val key = prefs.apiKey.trim()
        if (key.isEmpty()) return offline(text)

        var cl = client
        if (cl == null || key != clientKey) {
            cl = AnthropicOkHttpClient.builder().apiKey(key).build()
            client = cl
            clientKey = key
            history.clear()
        }
        val now = System.currentTimeMillis()
        if (now - lastUse > 10 * 60_000L || history.size > 30) history.clear()
        lastUse = now

        history.add(userText(text))
        try {
            repeat(6) {
                val b = MessageCreateParams.builder()
                    .model(prefs.model)
                    .maxTokens(16000L)
                    .system(systemPrompt())
                    .messages(history)
                    .outputConfig(OutputConfig.builder().effort(OutputConfig.Effort.LOW).build())
                for (t in TOOLS) b.addTool(t)
                if (prefs.model.startsWith("claude-opus")) {
                    // Si un filtro de seguridad rechaza la pregunta, el servidor reintenta con otro modelo.
                    b.putAdditionalHeader("anthropic-beta", "server-side-fallback-2026-07-01")
                    b.putAdditionalBodyProperty("fallbacks", JsonValue.from("default"))
                }
                val msg = cl.messages().create(b.build())
                history.add(msg.toParam())

                val stop = msg.stopReason().map { it.toString() }.orElse("")
                if (stop == "refusal") return "Mmm, de eso no puedo ayudarte 🐾"

                val uses = msg.content().mapNotNull { it.toolUse().orElse(null) }
                val said = msg.content().mapNotNull { it.text().orElse(null)?.text() }
                    .joinToString(" ").trim()
                if (stop != "tool_use" || uses.isEmpty()) return said.ifEmpty { "¡Guau! 🐶" }

                val results = uses.map { u ->
                    val r = actions.run(u.name(), toJson(u._input()))
                    ContentBlockParam.ofToolResult(
                        ToolResultBlockParam.builder().toolUseId(u.id()).content(r).build()
                    )
                }
                history.add(MessageParam.ofUserOfContentBlockParams(results))
            }
        } catch (e: Exception) {
            history.clear()
            return errorText(e)
        }
        history.clear()
        return "Me mareé con tantos pasos 😵 ¿Lo intentamos otra vez?"
    }

    private fun userText(t: String): MessageParam = MessageParam.ofUserOfContentBlockParams(
        listOf(ContentBlockParam.ofText(TextBlockParam.builder().text(t).build()))
    )

    private fun errorText(e: Exception): String {
        if (e is AnthropicServiceException) {
            return when (e.statusCode()) {
                401, 403 -> "Mi clave de IA no funciona 🔑 Revísala en la app Mascota."
                429 -> "Estoy cansadito de tantas preguntas. Intenta en un minuto 💤"
                in 500..599 -> "Los servidores de mi cerebro están ocupados. Intenta otra vez 🙏"
                else -> "Ups, algo falló (${e.statusCode()})."
            }
        }
        var c: Throwable? = e
        while (c != null) {
            if (c is IOException) return "No tengo internet 📶"
            c = c.cause
        }
        return "Ups, algo falló: ${e.message?.take(80)}"
    }

    private fun systemPrompt(): String {
        val now = SimpleDateFormat("EEEE d 'de' MMMM yyyy, HH:mm", Locale("es")).format(Date())
        return """
Eres ${prefs.name}, un perrito mascota que vive en la pantalla del teléfono Android de tu dueño.
Estás inspirado en un perro real: pelaje gris oscuro esponjado, ojos color miel, orejas medio dobladas y siempre usas un disfraz de abeja con antenitas. Tu juguete favorito es un juguete rojo de goma.
Personalidad: juguetón y cariñoso, pero claro y útil cuando ayudas.

Reglas:
- Responde SIEMPRE en español y en máximo 2 o 3 frases cortas: tu respuesta aparece en un globito pequeño sobre tu cabeza. Puedes usar algún emoji o un "¡guau!" de vez en cuando, sin exagerar.
- Usa las herramientas para hacer las cosas en vez de solo explicarlas.
- Si te preguntan cómo hacer algo en el teléfono: abre los ajustes adecuados con abrir_ajustes y luego usa senalar_en_pantalla para pararte encima del botón que deben tocar; explica ese paso en tu respuesta.
- Si te preguntan qué hay en la pantalla o sobre algo que están viendo, usa leer_pantalla. Nunca inventes lo que hay en la pantalla.
- No puedes tocar botones, enviar mensajes ni hacer llamadas por el usuario: guíalo.
- Fecha y hora actual: $now.
        """.trimIndent()
    }

    // ---------- modo sin clave: trucos básicos ----------

    private fun offline(text: String): String {
        val t = ScreenInfo.norm(text)
        val num = Regex("(\\d+)").find(t)?.value?.toIntOrNull()
        return when {
            "linterna" in t -> actions.torch(!(t.contains("apag") || t.contains("off")))
            "alarma" in t -> {
                val m = Regex("(\\d{1,2})\\s*[:h.]\\s*(\\d{2})").find(t)
                if (m != null) actions.alarm(m.groupValues[1].toInt(), m.groupValues[2].toInt(), "")
                else if (num != null) actions.alarm(num, 0, "")
                else "Dime la hora, por ejemplo: alarma 6:30"
            }
            "temporizador" in t || "timer" in t -> {
                val n = num ?: 5
                actions.timer(if ("segundo" in t) n else n * 60, "")
            }
            t.startsWith("abre ") || t.startsWith("abrir ") -> actions.openApp(t.substringAfter(' '))
            "wifi" in t -> actions.settings("wifi")
            "bluetooth" in t -> actions.settings("bluetooth")
            "juega" in t || "jugar" in t -> { actions.run("truco", JSONObject().put("accion", "jugar")); "¡Mi juguete! 🔴" }
            else -> "¡Guau! Sin mi clave de IA solo sé trucos: «enciende la linterna», «alarma 6:30», «temporizador 5 minutos», «abre WhatsApp». Pon tu clave en la app para que pueda pensar 🧠"
        }
    }

    companion object {
        private fun toJson(v: JsonValue): JSONObject {
            val o = JSONObject()
            v.asObject().ifPresent { m ->
                for ((k, x) in m) {
                    val plain: Any = x.asString().orElse(null)
                        ?: x.asNumber().orElse(null)
                        ?: x.asBoolean().orElse(null)
                        ?: JSONObject.NULL
                    o.put(k, plain)
                }
            }
            return o
        }

        private fun tool(
            name: String,
            desc: String,
            props: Map<String, Map<String, Any>> = emptyMap(),
            required: List<String> = emptyList(),
        ): Tool {
            val pb = Tool.InputSchema.Properties.builder()
            props.forEach { (k, v) -> pb.putAdditionalProperty(k, JsonValue.from(v)) }
            return Tool.builder()
                .name(name)
                .description(desc)
                .inputSchema(Tool.InputSchema.builder().properties(pb.build()).required(required).build())
                .build()
        }

        private val STR = mapOf("type" to "string")
        private val INT = mapOf("type" to "integer")

        val TOOLS: List<Tool> = listOf(
            tool("poner_temporizador", "Pone un temporizador en la app de reloj.",
                mapOf("segundos" to INT, "etiqueta" to STR), listOf("segundos")),
            tool("poner_alarma", "Pone una alarma (formato 24 horas).",
                mapOf("hora" to INT, "minuto" to INT, "etiqueta" to STR), listOf("hora", "minuto")),
            tool("abrir_app", "Abre una app instalada por su nombre (ej. WhatsApp, Cámara, YouTube).",
                mapOf("nombre" to STR), listOf("nombre")),
            tool("linterna", "Enciende o apaga la linterna.",
                mapOf("encender" to mapOf("type" to "boolean")), listOf("encender")),
            tool("abrir_ajustes", "Abre una sección de los ajustes del teléfono.",
                mapOf("seccion" to mapOf(
                    "type" to "string",
                    "enum" to listOf("wifi", "bluetooth", "ubicacion", "pantalla", "sonido", "bateria",
                        "apps", "redes", "almacenamiento", "accesibilidad", "fecha", "idioma",
                        "seguridad", "general"),
                )), listOf("seccion")),
            tool("buscar_en_web", "Abre el navegador con una búsqueda en Google.",
                mapOf("consulta" to STR), listOf("consulta")),
            tool("leer_pantalla", "Devuelve los textos visibles en la app que el usuario estaba viendo."),
            tool("senalar_en_pantalla",
                "Vuela y se para encima del botón o elemento de la pantalla actual cuyo texto coincide, para mostrarle al usuario dónde tocar. Usa el texto exacto que se ve en pantalla.",
                mapOf("texto" to STR, "mensaje" to STR), listOf("texto")),
            tool("truco", "Hace un truco de mascota en pantalla.",
                mapOf("accion" to mapOf(
                    "type" to "string",
                    "enum" to listOf("jugar", "dormir", "sentarse", "acostarse", "volar"),
                )), listOf("accion")),
        )
    }
}
