package com.fcuxum.mascota

import org.json.JSONObject
import java.io.IOException

/** Elige el "cerebro" según la configuración: Gemini (gratis), Claude, o trucos sin internet. */
class Brain(private val prefs: Prefs, private val actions: PhoneActions) {

    private val gemini = GeminiBrain(prefs, actions)
    private val claude = ClaudeBrain(prefs, actions)

    fun reset() {
        gemini.reset()
        claude.reset()
    }

    fun ask(text: String): String {
        return when {
            prefs.brain == Prefs.BRAIN_GEMINI && prefs.geminiKey.isNotBlank() -> gemini.ask(text)
            prefs.brain == Prefs.BRAIN_CLAUDE && prefs.apiKey.isNotBlank() -> claude.ask(text)
            else -> offline(text)
        }
    }

    // ---------- modo sin IA: trucos básicos ----------

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
            "jug" in t || "pelota" in t || "aro" in t -> {
                actions.run("truco", JSONObject().put("accion", "jugar")); "¡Va pues, a jugar! Lánzame el juguete 🟡"
            }
            "ladra" in t -> { actions.run("truco", JSONObject().put("accion", "ladrar")); "¡Guau guau! 🐶" }
            "dormi" in t || "duerme" in t -> { actions.run("truco", JSONObject().put("accion", "dormir")); "Zzz… 💤" }
            else -> "¡Guau! Sin cerebro de IA solo sé trucos: «juguemos», «ladra», «enciende la linterna», «alarma 6:30», «abre WhatsApp». Pon una clave gratis de Gemini en la app para que pueda pensar 🧠"
        }
    }

    companion object {
        fun networkError(e: Throwable): Boolean {
            var c: Throwable? = e
            while (c != null) {
                if (c is IOException) return true
                c = c.cause
            }
            return false
        }
    }
}
