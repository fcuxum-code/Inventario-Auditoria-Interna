package com.fcuxum.mascota

import android.content.Context

class Prefs(ctx: Context) {
    private val sp = ctx.getSharedPreferences("mascota", Context.MODE_PRIVATE)

    var name: String
        get() = sp.getString("name", null)?.takeIf { it.isNotBlank() } ?: "Abejorro"
        set(v) = sp.edit().putString("name", v.trim()).apply()

    var apiKey: String
        get() = sp.getString("apiKey", "") ?: ""
        set(v) = sp.edit().putString("apiKey", v.trim()).apply()

    var model: String
        get() = sp.getString("model", MODEL_SMART) ?: MODEL_SMART
        set(v) = sp.edit().putString("model", v).apply()

    var speak: Boolean
        get() = sp.getBoolean("speak", false)
        set(v) = sp.edit().putBoolean("speak", v).apply()

    companion object {
        const val MODEL_SMART = "claude-opus-5-5"
        const val MODEL_CHEAP = "claude-haiku-5-5"
    }
}
