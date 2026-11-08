package com.fcuxum.mascota

import android.Manifest
import android.app.Activity
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Typeface
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.provider.Settings
import android.text.InputType
import android.widget.Button
import android.widget.CheckBox
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.RadioButton
import android.widget.RadioGroup
import android.widget.ScrollView
import android.widget.TextView
import android.widget.Toast

/** Pantalla de configuración: permisos, nombre, clave de IA y botón para soltar a la mascota. */
class MainActivity : Activity() {

    private lateinit var prefs: Prefs
    private lateinit var etName: EditText
    private lateinit var etKey: EditText
    private lateinit var rbSmart: RadioButton
    private lateinit var rbCheap: RadioButton
    private lateinit var cbSpeak: CheckBox
    private lateinit var btnOverlay: Button
    private lateinit var btnAcc: Button
    private lateinit var btnStart: Button

    private fun dp(v: Int) = (v * resources.displayMetrics.density).toInt()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        prefs = Prefs(this)
        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(20), dp(28), dp(20), dp(36))
        }
        fun text(s: String, size: Float = 15f, bold: Boolean = false, top: Int = 0, color: Int = 0xFF222222.toInt()) =
            TextView(this).apply {
                text = s
                textSize = size
                setTextColor(color)
                if (bold) setTypeface(null, Typeface.BOLD)
                setPadding(0, dp(top), 0, dp(4))
            }.also { root.addView(it) }

        text("🐝🐶 Mascota · beta", 26f, true)
        text("Un perrito con disfraz de abeja que vive encima de tus apps, juega y te ayuda con el teléfono.", top = 4)

        text("Nombre de la mascota", 14f, true, 18)
        etName = EditText(this).apply { setText(prefs.name); isSingleLine = true }
        root.addView(etName)

        text("Clave de la API de Claude (opcional)", 14f, true, 14)
        etKey = EditText(this).apply {
            setText(prefs.apiKey)
            hint = "sk-ant-…"
            isSingleLine = true
            inputType = InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_VARIATION_PASSWORD
        }
        root.addView(etKey)
        text("Sin clave solo hace trucos básicos. La clave se crea en console.anthropic.com y se guarda solo en este teléfono.", 12f, color = 0xFF666666.toInt())

        text("Cerebro", 14f, true, 10)
        val rg = RadioGroup(this)
        rbSmart = RadioButton(this).apply { text = "Más inteligente (Claude Opus 5.5)"; id = 101 }
        rbCheap = RadioButton(this).apply { text = "Más económico y rápido (Claude Haiku 5.5)"; id = 102 }
        rg.addView(rbSmart)
        rg.addView(rbCheap)
        if (prefs.model == Prefs.MODEL_CHEAP) rbCheap.isChecked = true else rbSmart.isChecked = true
        root.addView(rg)

        cbSpeak = CheckBox(this).apply { text = "Que hable en voz alta"; isChecked = prefs.speak }
        root.addView(cbSpeak)

        text("Permisos", 14f, true, 16)
        btnOverlay = Button(this).apply {
            setOnClickListener {
                startActivity(Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION, Uri.parse("package:$packageName")))
            }
        }
        root.addView(btnOverlay)
        btnAcc = Button(this).apply {
            setOnClickListener { startActivity(Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS)) }
        }
        root.addView(btnAcc)
        text("La «ayuda en pantalla» es opcional: permite que se pose sobre los botones y te señale dónde tocar. Busca «Mascota» en Accesibilidad. Si Android dice «Configuración restringida»: Ajustes › Apps › Mascota › menú ⋮ › «Permitir configuración restringida».", 12f, color = 0xFF666666.toInt())

        btnStart = Button(this).apply {
            textSize = 18f
            setOnClickListener { toggle() }
        }
        root.addView(btnStart, LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT
        ).apply { topMargin = dp(18) })

        text("Cómo jugar", 14f, true, 18)
        text("• Un toque: hablar con él (escribe o usa el micrófono).\n• Doble toque: juega con su juguete rojo.\n• Arrástralo: lo dejas donde quieras.\n• Mantenlo presionado: se duerme y deja de pasear (otro toque lo despierta).\n• Para guardarlo: botón de abajo o en la notificación.", 14f)

        setContentView(ScrollView(this).apply { addView(root) })

        if (Build.VERSION.SDK_INT >= 33 &&
            checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED
        ) {
            requestPermissions(arrayOf(Manifest.permission.POST_NOTIFICATIONS), 1)
        }
    }

    override fun onResume() {
        super.onResume()
        refresh()
    }

    override fun onPause() {
        save()
        super.onPause()
    }

    private fun save() {
        prefs.name = etName.text.toString()
        prefs.apiKey = etKey.text.toString()
        prefs.model = if (rbCheap.isChecked) Prefs.MODEL_CHEAP else Prefs.MODEL_SMART
        prefs.speak = cbSpeak.isChecked
    }

    private fun refresh() {
        val overlay = Settings.canDrawOverlays(this)
        btnOverlay.text = if (overlay) "✅ Puede aparecer sobre otras apps" else "1. Permitir que aparezca sobre otras apps"
        btnAcc.text = if (ScreenInfo.service != null) "✅ Ayuda en pantalla activa" else "2. (Opcional) Activar ayuda en pantalla"
        val name = etName.text.toString().ifBlank { prefs.name }
        btnStart.text = if (PetService.running) "🏠 Guardar a $name" else "🐾 ¡Soltar a $name!"
    }

    private fun toggle() {
        save()
        if (PetService.running) {
            stopService(Intent(this, PetService::class.java))
        } else {
            if (!Settings.canDrawOverlays(this)) {
                Toast.makeText(this, "Primero dale permiso para aparecer sobre otras apps", Toast.LENGTH_LONG).show()
                startActivity(Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION, Uri.parse("package:$packageName")))
                return
            }
            startForegroundService(Intent(this, PetService::class.java))
        }
        btnStart.postDelayed({ refresh() }, 400)
    }
}
