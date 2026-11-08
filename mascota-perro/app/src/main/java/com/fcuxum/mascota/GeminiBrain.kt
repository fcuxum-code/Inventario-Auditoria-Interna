package com.fcuxum.mascota

import org.json.JSONArray
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL

/** Cerebro gratis con la API de Google Gemini (clave gratuita de aistudio.google.com). */
class GeminiBrain(private val prefs: Prefs, private val actions: PhoneActions) {

    private val history = JSONArray()
    private var lastUse = 0L
    private var model = MODELS[0]

    fun reset() {
        while (history.length() > 0) history.remove(history.length() - 1)
    }

    fun ask(text: String): String {
        val now = System.currentTimeMillis()
        if (now - lastUse > 10 * 60_000L || history.length() > 30) reset()
        lastUse = now
        history.put(JSONObject().put("role", "user").put("parts", JSONArray().put(JSONObject().put("text", text))))
        try {
            repeat(6) {
                val res = call()
                val cand = res.optJSONArray("candidates")?.optJSONObject(0)
                    ?: return blocked(res)
                val content = cand.optJSONObject("content") ?: return "Mmm, no se me ocurre nada 🐾"
                history.put(content) // tal cual (conserva las "firmas de pensamiento")
                val parts = content.optJSONArray("parts") ?: JSONArray()
                val calls = ArrayList<JSONObject>()
                val said = StringBuilder()
                for (i in 0 until parts.length()) {
                    val part = parts.getJSONObject(i)
                    part.optJSONObject("functionCall")?.let { calls.add(it) }
                    if (part.has("text") && !part.optBoolean("thought")) said.append(part.getString("text")).append(' ')
                }
                if (calls.isEmpty()) return said.toString().trim().ifEmpty { "¡Guau! 🐶" }
                val responses = JSONArray()
                for (fc in calls) {
                    val name = fc.optString("name")
                    val r = actions.run(name, fc.optJSONObject("args") ?: JSONObject())
                    responses.put(JSONObject().put("functionResponse",
                        JSONObject().put("name", name).put("response", JSONObject().put("resultado", r))))
                }
                history.put(JSONObject().put("role", "user").put("parts", responses))
            }
        } catch (e: HttpError) {
            reset()
            return when (e.code) {
                400 -> if (e.body.contains("API_KEY", true) || e.body.contains("API key", true))
                    "Mi clave de Gemini no funciona 🔑 Revísala en la app." else "Ups, me enredé (400). ¿Me lo dices de otra forma?"
                401, 403 -> "Mi clave de Gemini no funciona 🔑 Revísala en la app."
                429 -> "Ya usé mi cuota gratis por ahora 😴 Intenta en un rato."
                in 500..599 -> "El cerebro de Google está ocupado. Intenta otra vez 🙏"
                else -> "Ups, algo falló (${e.code})."
            }
        } catch (e: Exception) {
            reset()
            return if (Brain.networkError(e)) "No tengo internet 📶" else "Ups, algo falló: ${e.message?.take(80)}"
        }
        reset()
        return "Me mareé con tantos pasos 😵 ¿Lo intentamos otra vez?"
    }

    private fun blocked(res: JSONObject): String {
        val reason = res.optJSONObject("promptFeedback")?.optString("blockReason").orEmpty()
        reset()
        return if (reason.isNotEmpty()) "Mmm, de eso no puedo ayudarte 🐾" else "Mmm, no se me ocurre nada 🐾"
    }

    class HttpError(val code: Int, val body: String) : Exception("HTTP $code")

    private fun body(): JSONObject {
        val decls = JSONArray()
        for (t in ToolSpecs.ALL) {
            val props = JSONObject()
            for ((k, p) in t.params) {
                val o = JSONObject().put("type", p.type.uppercase())
                p.enum?.let { o.put("enum", JSONArray(it)) }
                props.put(k, o)
            }
            val fn = JSONObject().put("name", t.name).put("description", t.desc)
            if (t.params.isNotEmpty()) {
                fn.put("parameters", JSONObject().put("type", "OBJECT").put("properties", props)
                    .put("required", JSONArray(t.required)))
            }
            decls.put(fn)
        }
        return JSONObject()
            .put("systemInstruction", JSONObject().put("parts", JSONArray().put(JSONObject().put("text", ToolSpecs.systemPrompt(prefs.name)))))
            .put("contents", history)
            .put("tools", JSONArray().put(JSONObject().put("functionDeclarations", decls)))
    }

    private fun call(): JSONObject {
        var last: HttpError? = null
        val order = listOf(model) + MODELS.filter { it != model }
        for (m in order) {
            try {
                val r = post(m)
                model = m
                return r
            } catch (e: HttpError) {
                last = e
                if (e.code != 404) throw e // solo probamos otro modelo si este no existe
            }
        }
        throw last ?: HttpError(404, "sin modelo")
    }

    private fun post(m: String): JSONObject {
        val url = URL("https://generativelanguage.googleapis.com/v1beta/models/$m:generateContent")
        val con = url.openConnection() as HttpURLConnection
        con.requestMethod = "POST"
        con.connectTimeout = 20_000
        con.readTimeout = 90_000
        con.doOutput = true
        con.setRequestProperty("Content-Type", "application/json; charset=utf-8")
        con.setRequestProperty("x-goog-api-key", prefs.geminiKey.trim())
        con.outputStream.use { it.write(body().toString().toByteArray()) }
        val code = con.responseCode
        val txt = (if (code in 200..299) con.inputStream else con.errorStream)
            ?.bufferedReader()?.use { it.readText() }.orEmpty()
        con.disconnect()
        if (code !in 200..299) throw HttpError(code, txt)
        return JSONObject(txt)
    }

    companion object {
        /** Se prueba en orden; si Google retira uno, pasa al siguiente. */
        val MODELS = listOf("gemini-flash-latest", "gemini-2.5-flash", "gemini-flash-lite-latest", "gemini-2.5-flash-lite")
    }
}
