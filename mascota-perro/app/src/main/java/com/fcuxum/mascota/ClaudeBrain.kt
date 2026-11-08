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

/** Cerebro opcional con Claude (de pago, más confiable). */
class ClaudeBrain(private val prefs: Prefs, private val actions: PhoneActions) {

    private val history = ArrayList<MessageParam>()
    private var lastUse = 0L
    private var client: AnthropicClient? = null
    private var clientKey = ""

    fun reset() = history.clear()

    fun ask(text: String): String {
        val key = prefs.apiKey.trim()
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

        history.add(MessageParam.ofUserOfContentBlockParams(
            listOf(ContentBlockParam.ofText(TextBlockParam.builder().text(text).build()))))
        try {
            repeat(6) {
                val b = MessageCreateParams.builder()
                    .model(prefs.model)
                    .maxTokens(16000L)
                    .system(ToolSpecs.systemPrompt(prefs.name))
                    .messages(history)
                    .outputConfig(OutputConfig.builder().effort(OutputConfig.Effort.LOW).build())
                for (t in TOOLS) b.addTool(t)
                if (prefs.model.startsWith("claude-opus")) {
                    b.putAdditionalHeader("anthropic-beta", "server-side-fallback-2026-07-01")
                    b.putAdditionalBodyProperty("fallbacks", JsonValue.from("default"))
                }
                val msg = cl.messages().create(b.build())
                history.add(msg.toParam())

                val stop = msg.stopReason().map { it.toString() }.orElse("")
                if (stop == "refusal") return "Mmm, de eso no puedo ayudarte 🐾"

                val uses = msg.content().mapNotNull { it.toolUse().orElse(null) }
                val said = msg.content().mapNotNull { it.text().orElse(null)?.text() }.joinToString(" ").trim()
                if (stop != "tool_use" || uses.isEmpty()) return said.ifEmpty { "¡Guau! 🐶" }

                val results = uses.map { u ->
                    val r = actions.run(u.name(), toJson(u._input()))
                    ContentBlockParam.ofToolResult(ToolResultBlockParam.builder().toolUseId(u.id()).content(r).build())
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

    private fun errorText(e: Exception): String {
        if (e is AnthropicServiceException) {
            return when (e.statusCode()) {
                401, 403 -> "Mi clave de Claude no funciona 🔑 Revísala en la app."
                429 -> "Estoy cansadito de tantas preguntas. Intenta en un minuto 💤"
                in 500..599 -> "Los servidores de mi cerebro están ocupados. Intenta otra vez 🙏"
                else -> "Ups, algo falló (${e.statusCode()})."
            }
        }
        return if (Brain.networkError(e)) "No tengo internet 📶" else "Ups, algo falló: ${e.message?.take(80)}"
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

        private val TOOLS: List<Tool> = ToolSpecs.ALL.map { t ->
            val pb = Tool.InputSchema.Properties.builder()
            for ((k, p) in t.params) {
                val m = HashMap<String, Any>()
                m["type"] = p.type
                p.enum?.let { m["enum"] = it }
                pb.putAdditionalProperty(k, JsonValue.from(m))
            }
            Tool.builder()
                .name(t.name)
                .description(t.desc)
                .inputSchema(Tool.InputSchema.builder().properties(pb.build()).required(t.required).build())
                .build()
        }
    }
}
