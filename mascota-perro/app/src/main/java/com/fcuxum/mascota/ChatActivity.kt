package com.fcuxum.mascota

import android.app.Activity
import android.content.Intent
import android.graphics.Typeface
import android.os.Bundle
import android.speech.RecognizerIntent
import android.text.InputType
import android.view.Gravity
import android.view.ViewGroup
import android.view.WindowManager
import android.view.inputmethod.EditorInfo
import android.widget.Button
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.TextView
import android.widget.Toast
import java.util.Locale

/** Cajita para escribirle o hablarle a la mascota. Se cierra al enviar. */
class ChatActivity : Activity() {

    private var sent = false
    private lateinit var input: EditText

    private fun dp(v: Int) = (v * resources.displayMetrics.density).toInt()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val prefs = Prefs(this)
        val box = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(18), dp(16), dp(18), dp(12))
        }
        box.addView(TextView(this).apply {
            text = "Pregúntale a ${prefs.name} 🐝🐶"
            textSize = 18f
            setTypeface(null, Typeface.BOLD)
        })
        input = EditText(this).apply {
            hint = "Ej: ¿cómo activo el bluetooth?"
            inputType = InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_FLAG_CAP_SENTENCES
            imeOptions = EditorInfo.IME_ACTION_SEND
            setOnEditorActionListener { _, id, _ ->
                if (id == EditorInfo.IME_ACTION_SEND) { send(text.toString()); true } else false
            }
        }
        box.addView(input)
        val sinIa = prefs.brain == Prefs.BRAIN_NONE ||
            (prefs.brain == Prefs.BRAIN_GEMINI && prefs.geminiKey.isBlank()) ||
            (prefs.brain == Prefs.BRAIN_CLAUDE && prefs.apiKey.isBlank())
        if (sinIa) {
            box.addView(TextView(this).apply {
                text = "Sin IA solo sé trucos: «juguemos», «ladra», «enciende la linterna», «alarma 6:30», «abre WhatsApp»."
                textSize = 13f
                setTextColor(0xFF666666.toInt())
                setPadding(0, dp(4), 0, dp(4))
            })
        }
        val row = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.END
        }
        row.addView(Button(this).apply {
            text = "🎤 Hablar"
            setOnClickListener { listen() }
        })
        row.addView(Button(this).apply {
            text = "Enviar"
            setOnClickListener { send(input.text.toString()) }
        })
        box.addView(row)
        setContentView(box)
        window.setLayout(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT)
        window.setGravity(Gravity.BOTTOM)
        window.setSoftInputMode(
            WindowManager.LayoutParams.SOFT_INPUT_STATE_VISIBLE or WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE
        )
        setFinishOnTouchOutside(true)
        input.requestFocus()
    }

    private fun send(t: String) {
        val q = t.trim()
        if (q.isEmpty()) return
        sent = true
        val svc = PetService.instance
        if (svc == null) {
            Toast.makeText(this, "La mascota no está activa", Toast.LENGTH_SHORT).show()
        } else {
            svc.ask(q)
        }
        finish()
    }

    @Suppress("DEPRECATION")
    private fun listen() {
        val i = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH)
            .putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
            .putExtra(RecognizerIntent.EXTRA_LANGUAGE, Locale.getDefault().toLanguageTag())
            .putExtra(RecognizerIntent.EXTRA_PROMPT, "Te escucho 🐶")
        try {
            startActivityForResult(i, 7)
        } catch (e: Exception) {
            Toast.makeText(this, "Este teléfono no tiene reconocimiento de voz", Toast.LENGTH_SHORT).show()
        }
    }

    @Deprecated("Deprecated in Java")
    @Suppress("DEPRECATION")
    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        if (requestCode == 7 && resultCode == RESULT_OK) {
            val txt = data?.getStringArrayListExtra(RecognizerIntent.EXTRA_RESULTS)?.firstOrNull()
            if (!txt.isNullOrBlank()) send(txt)
        }
    }

    override fun onDestroy() {
        if (!sent && isFinishing) PetService.instance?.chatCancelled()
        super.onDestroy()
    }
}
