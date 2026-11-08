package com.fcuxum.mascota

import android.content.Context

class Prefs(ctx: Context) {
    private val sp = ctx.getSharedPreferences("mascota", Context.MODE_PRIVATE)

    private fun str(k: String, def: String) = sp.getString(k, null)?.takeIf { it.isNotBlank() } ?: def
    private fun put(k: String, v: String) = sp.edit().putString(k, v.trim()).apply()

    var name: String
        get() = str("name", "Mangobeja")
        set(v) = put("name", v)

    /** "gemini" (gratis), "claude" o "ninguno". */
    var brain: String
        get() = str("brain", BRAIN_GEMINI)
        set(v) = put("brain", v)

    var geminiKey: String
        get() = sp.getString("geminiKey", "") ?: ""
        set(v) = put("geminiKey", v)

    var apiKey: String
        get() = sp.getString("apiKey", "") ?: ""
        set(v) = put("apiKey", v)

    var model: String
        get() = str("model", MODEL_SMART)
        set(v) = put("model", v)

    var speak: Boolean
        get() = sp.getBoolean("speak", false)
        set(v) = sp.edit().putBoolean("speak", v).apply()

    var sounds: Boolean
        get() = sp.getBoolean("sounds", true)
        set(v) = sp.edit().putBoolean("sounds", v).apply()

    var toy: String
        get() = str("toy", Toys.ARO)
        set(v) = put("toy", v)

    companion object {
        const val BRAIN_GEMINI = "gemini"
        const val BRAIN_CLAUDE = "claude"
        const val BRAIN_NONE = "ninguno"
        const val MODEL_SMART = "claude-opus-5-5"
        const val MODEL_CHEAP = "claude-haiku-5-5"
    }
}
