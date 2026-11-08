package com.fcuxum.mascota

import android.Manifest
import android.app.Activity
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Typeface
import android.media.MediaPlayer
import android.media.MediaRecorder
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.provider.Settings
import android.text.InputType
import android.view.View
import android.widget.Button
import android.widget.CheckBox
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.RadioButton
import android.widget.RadioGroup
import android.widget.ScrollView
import android.widget.TextView
import android.widget.Toast

/** Pantalla de configuración de Mangobeja. */
class MainActivity : Activity() {

    private lateinit var prefs: Prefs
    private lateinit var etName: EditText
    private lateinit var rgBrain: RadioGroup
    private lateinit var etGemini: EditText
    private lateinit var etClaude: EditText
    private lateinit var claudeBox: LinearLayout
    private lateinit var geminiBox: LinearLayout
    private lateinit var rbOpus: RadioButton
    private lateinit var rbHaiku: RadioButton
    private lateinit var rgToy: RadioGroup
    private lateinit var cbSpeak: CheckBox
    private lateinit var cbSounds: CheckBox
    private lateinit var btnOverlay: Button
    private lateinit var btnAcc: Button
    private lateinit var btnStart: Button
    private lateinit var btnRec: Button
    private lateinit var tvRec: TextView
    private var recorder: MediaRecorder? = null
    private val main = Handler(Looper.getMainLooper())

    private fun dp(v: Int) = (v * resources.displayMetrics.density).toInt()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        prefs = Prefs(this)
        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(20), dp(28), dp(20), dp(40))
        }
        fun text(s: String, size: Float = 15f, bold: Boolean = false, top: Int = 0, color: Int = 0xFF222222.toInt(), into: LinearLayout = root) =
            TextView(this).apply {
                text = s
                textSize = size
                setTextColor(color)
                if (bold) setTypeface(null, Typeface.BOLD)
                setPadding(0, dp(top), 0, dp(4))
            }.also { into.addView(it) }
        val gray = 0xFF666666.toInt()

        text("🐝🐶 ${prefs.name}", 28f, true)
        text("Tu perrito con disfraz de abeja vive encima de tus apps: pasea, juega, ladra y te ayuda con el teléfono. (beta)", top = 4)

        btnStart = Button(this).apply {
            textSize = 18f
            setOnClickListener { toggle() }
        }
        root.addView(btnStart, LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT
        ).apply { topMargin = dp(12) })

        // ---- permisos
        text("Permisos", 16f, true, 18)
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
        text("La «ayuda en pantalla» es opcional: le permite pararse sobre los botones y enseñarte dónde tocar. Busca «Mangobeja» en Accesibilidad. Si Android dice «Configuración restringida»: Ajustes › Apps › Mangobeja › menú ⋮ › «Permitir configuración restringida».", 12f, color = gray)

        // ---- nombre y juguete
        text("Nombre", 16f, true, 18)
        etName = EditText(this).apply { setText(prefs.name); isSingleLine = true }
        root.addView(etName)

        text("Juguete favorito", 16f, true, 12)
        rgToy = RadioGroup(this).apply { orientation = RadioGroup.HORIZONTAL }
        for ((id, pair) in listOf(201 to (Toys.ARO to "🟡 Aro"), 202 to (Toys.PELOTA to "🔴 Pelota"), 203 to (Toys.HUESO to "🦴 Hueso"))) {
            rgToy.addView(RadioButton(this).apply {
                this.id = id
                text = pair.second
                tag = pair.first
                isChecked = prefs.toy == pair.first
            })
        }
        root.addView(rgToy)

        // ---- sonidos
        text("Sonidos", 16f, true, 12)
        cbSounds = CheckBox(this).apply { text = "Que ladre y haga sonidos (de noche solo si juegas con él)"; isChecked = prefs.sounds }
        root.addView(cbSounds)
        cbSpeak = CheckBox(this).apply { text = "Que lea sus respuestas en voz alta"; isChecked = prefs.speak }
        root.addView(cbSpeak)
        val recRow = LinearLayout(this).apply { orientation = LinearLayout.HORIZONTAL }
        btnRec = Button(this).apply {
            text = "🎙️ Grabar ladrido real"
            setOnClickListener { recordBark() }
        }
        recRow.addView(btnRec)
        recRow.addView(Button(this).apply {
            text = "▶"
            setOnClickListener { playBark() }
        })
        recRow.addView(Button(this).apply {
            text = "🗑"
            setOnClickListener {
                Sounds.realBarkFile(this@MainActivity).delete()
                PetService.instance?.reloadSounds()
                refresh()
            }
        })
        root.addView(recRow)
        tvRec = text("", 12f, color = gray)

        // ---- cerebro
        text("Cerebro (IA)", 16f, true, 18)
        rgBrain = RadioGroup(this)
        rgBrain.addView(RadioButton(this).apply { id = 301; text = "Gemini de Google (gratis)" })
        rgBrain.addView(RadioButton(this).apply { id = 302; text = "Claude (de pago, más confiable)" })
        rgBrain.addView(RadioButton(this).apply { id = 303; text = "Sin IA (solo trucos)" })
        rgBrain.check(when (prefs.brain) { Prefs.BRAIN_CLAUDE -> 302; Prefs.BRAIN_NONE -> 303; else -> 301 })
        root.addView(rgBrain)

        geminiBox = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL }
        text("Clave de Gemini", 14f, true, 6, into = geminiBox)
        etGemini = EditText(this).apply {
            setText(prefs.geminiKey)
            hint = "AIza…"
            isSingleLine = true
            inputType = InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_VARIATION_PASSWORD
        }
        geminiBox.addView(etGemini)
        geminiBox.addView(Button(this).apply {
            text = "Obtener clave gratis (aistudio.google.com)"
            setOnClickListener { startActivity(Intent(Intent.ACTION_VIEW, Uri.parse("https://aistudio.google.com/apikey"))) }
        })
        text("Entra con tu cuenta de Google › «Create API key» › copia y pégala aquí. En el plan gratis Google puede usar las conversaciones para mejorar sus productos.", 12f, color = gray, into = geminiBox)
        root.addView(geminiBox)

        claudeBox = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL }
        text("Clave de Claude", 14f, true, 6, into = claudeBox)
        etClaude = EditText(this).apply {
            setText(prefs.apiKey)
            hint = "sk-ant-…"
            isSingleLine = true
            inputType = InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_VARIATION_PASSWORD
        }
        claudeBox.addView(etClaude)
        val rgModel = RadioGroup(this)
        rbOpus = RadioButton(this).apply { id = 101; text = "Más inteligente (Claude Opus 5.5)" }
        rbHaiku = RadioButton(this).apply { id = 102; text = "Más económico y rápido (Claude Haiku 5.5)" }
        rgModel.addView(rbOpus)
        rgModel.addView(rbHaiku)
        if (prefs.model == Prefs.MODEL_CHEAP) rbHaiku.isChecked = true else rbOpus.isChecked = true
        claudeBox.addView(rgModel)
        text("La clave se crea en console.anthropic.com (requiere saldo).", 12f, color = gray, into = claudeBox)
        root.addView(claudeBox)
        rgBrain.setOnCheckedChangeListener { _, _ -> updateBrainBoxes() }
        updateBrainBoxes()

        text("Cómo jugar", 16f, true, 18)
        text("• Un toque: hablarle (escribe o usa el micrófono).\n• Doble toque: saca su juguete. Deslízalo hacia arriba para lanzarlo lejos: irá corriendo por él y te lo traerá.\n• Arrástralo: lo dejas donde quieras.\n• Mantenlo presionado: se duerme. Un toque lo despierta (también de noche).\n• En la notificación: «¡A jugar!» o «Guardar».", 14f)
        text("Las claves se guardan solo en este teléfono.", 12f, color = gray, top = 10)

        setContentView(ScrollView(this).apply { addView(root) })

        if (Build.VERSION.SDK_INT >= 33 &&
            checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED
        ) {
            requestPermissions(arrayOf(Manifest.permission.POST_NOTIFICATIONS), 1)
        }

        // Arranque automático (lo usa la prueba en el emulador)
        if (intent.getBooleanExtra("autostart", false) && Settings.canDrawOverlays(this) && !PetService.running) {
            startForegroundService(Intent(this, PetService::class.java)
                .putExtra(PetService.EXTRA_DEMO, intent.getStringExtra(PetService.EXTRA_DEMO)))
        }
    }

    private fun updateBrainBoxes() {
        geminiBox.visibility = if (rgBrain.checkedRadioButtonId == 301) View.VISIBLE else View.GONE
        claudeBox.visibility = if (rgBrain.checkedRadioButtonId == 302) View.VISIBLE else View.GONE
    }

    override fun onResume() {
        super.onResume()
        refresh()
    }

    override fun onPause() {
        save()
        super.onPause()
    }

    override fun onDestroy() {
        recorder?.release()
        recorder = null
        super.onDestroy()
    }

    private fun save() {
        prefs.name = etName.text.toString()
        prefs.geminiKey = etGemini.text.toString()
        prefs.apiKey = etClaude.text.toString()
        prefs.brain = when (rgBrain.checkedRadioButtonId) {
            302 -> Prefs.BRAIN_CLAUDE
            303 -> Prefs.BRAIN_NONE
            else -> Prefs.BRAIN_GEMINI
        }
        prefs.model = if (rbHaiku.isChecked) Prefs.MODEL_CHEAP else Prefs.MODEL_SMART
        prefs.speak = cbSpeak.isChecked
        prefs.sounds = cbSounds.isChecked
        val toyBtn = rgToy.findViewById<RadioButton>(rgToy.checkedRadioButtonId)
        prefs.toy = (toyBtn?.tag as? String) ?: Toys.ARO
    }

    private fun refresh() {
        val overlay = Settings.canDrawOverlays(this)
        btnOverlay.text = if (overlay) "✅ Puede aparecer sobre otras apps" else "1. Permitir que aparezca sobre otras apps"
        btnAcc.text = if (ScreenInfo.service != null) "✅ Ayuda en pantalla activa" else "2. (Opcional) Activar ayuda en pantalla"
        val name = etName.text.toString().ifBlank { prefs.name }
        btnStart.text = if (PetService.running) "🏠 Guardar a $name" else "🐾 ¡Soltar a $name!"
        tvRec.text = if (Sounds.realBarkFile(this).exists())
            "✅ Usando el ladrido real grabado." else "Graba 3 segundos del ladrido de tu perro para que suene igualito."
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

    // ---------- grabar el ladrido real ----------

    private fun recordBark() {
        if (checkSelfPermission(Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(arrayOf(Manifest.permission.RECORD_AUDIO), 2)
            return
        }
        if (recorder != null) return
        val f = Sounds.realBarkFile(this)
        try {
            @Suppress("DEPRECATION")
            val r = if (Build.VERSION.SDK_INT >= 31) MediaRecorder(this) else MediaRecorder()
            r.setAudioSource(MediaRecorder.AudioSource.MIC)
            r.setOutputFormat(MediaRecorder.OutputFormat.MPEG_4)
            r.setAudioEncoder(MediaRecorder.AudioEncoder.AAC)
            r.setAudioSamplingRate(44100)
            r.setOutputFile(f.absolutePath)
            r.prepare()
            r.start()
            recorder = r
            btnRec.text = "🔴 Grabando… ¡que ladre!"
            main.postDelayed({ stopRecording() }, 3000)
        } catch (e: Exception) {
            Toast.makeText(this, "No pude grabar: ${e.message}", Toast.LENGTH_LONG).show()
        }
    }

    private fun stopRecording() {
        val r = recorder ?: return
        try { r.stop() } catch (_: Exception) { Sounds.realBarkFile(this).delete() }
        r.release()
        recorder = null
        btnRec.text = "🎙️ Grabar ladrido real"
        PetService.instance?.reloadSounds()
        refresh()
        Toast.makeText(this, "¡Listo! Toca ▶ para escucharlo", Toast.LENGTH_SHORT).show()
    }

    private fun playBark() {
        val f = Sounds.realBarkFile(this)
        if (!f.exists()) {
            Toast.makeText(this, "Aún no has grabado el ladrido", Toast.LENGTH_SHORT).show()
            return
        }
        try {
            MediaPlayer().apply {
                setDataSource(f.absolutePath)
                setOnCompletionListener { it.release() }
                prepare()
                start()
            }
        } catch (_: Exception) { }
    }

    override fun onRequestPermissionsResult(requestCode: Int, permissions: Array<out String>, grantResults: IntArray) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        if (requestCode == 2 && grantResults.firstOrNull() == PackageManager.PERMISSION_GRANTED) recordBark()
    }
}
