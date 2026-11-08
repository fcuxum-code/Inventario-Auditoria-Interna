package com.fcuxum.mascota

import android.content.Context
import android.content.Intent
import android.hardware.camera2.CameraCharacteristics
import android.hardware.camera2.CameraManager
import android.net.Uri
import android.provider.AlarmClock
import android.provider.Settings
import org.json.JSONObject

/** Acciones que la mascota puede hacer en el teléfono (sin tocar botones por el usuario). */
class PhoneActions(private val svc: PetService) {

    private fun start(i: Intent) {
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        svc.startActivity(i)
    }

    fun run(name: String, a: JSONObject): String = try {
        when (name) {
            "poner_temporizador" -> timer(a.optInt("segundos", 60), a.optString("etiqueta", ""))
            "poner_alarma" -> alarm(a.optInt("hora", 7), a.optInt("minuto", 0), a.optString("etiqueta", ""))
            "abrir_app" -> openApp(a.optString("nombre"))
            "linterna" -> torch(a.optBoolean("encender", true))
            "abrir_ajustes" -> settings(a.optString("seccion", "general"))
            "buscar_en_web" -> {
                val q = a.optString("consulta")
                start(Intent(Intent.ACTION_VIEW, Uri.parse("https://www.google.com/search?q=" + Uri.encode(q))))
                "Abrí el navegador buscando: $q"
            }
            "leer_pantalla" -> readScreen()
            "senalar_en_pantalla" -> point(a.optString("texto"), a.optString("mensaje", "¡Toca aquí! 👇"))
            "truco" -> { svc.trick(a.optString("accion", "jugar")); "Hecho" }
            else -> "Herramienta desconocida: $name"
        }
    } catch (e: Exception) {
        "Error al hacerlo: ${e.message}"
    }

    fun timer(seconds: Int, label: String): String {
        start(Intent(AlarmClock.ACTION_SET_TIMER)
            .putExtra(AlarmClock.EXTRA_LENGTH, seconds)
            .putExtra(AlarmClock.EXTRA_MESSAGE, label)
            .putExtra(AlarmClock.EXTRA_SKIP_UI, true))
        return "Temporizador de $seconds segundos puesto"
    }

    fun alarm(h: Int, m: Int, label: String): String {
        start(Intent(AlarmClock.ACTION_SET_ALARM)
            .putExtra(AlarmClock.EXTRA_HOUR, h)
            .putExtra(AlarmClock.EXTRA_MINUTES, m)
            .putExtra(AlarmClock.EXTRA_MESSAGE, label)
            .putExtra(AlarmClock.EXTRA_SKIP_UI, true))
        return "Alarma puesta a las %02d:%02d".format(h, m)
    }

    fun openApp(name: String): String {
        val pm = svc.packageManager
        val q = ScreenInfo.norm(name)
        val apps = pm.queryIntentActivities(
            Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LAUNCHER), 0
        )
        val labeled = apps.map { it to ScreenInfo.norm(it.loadLabel(pm).toString()) }
        val hit = labeled.firstOrNull { it.second == q }
            ?: labeled.firstOrNull { it.second.startsWith(q) }
            ?: labeled.firstOrNull { it.second.contains(q) }
            ?: return "No encontré ninguna app llamada \"$name\""
        val launch = pm.getLaunchIntentForPackage(hit.first.activityInfo.packageName)
            ?: return "No pude abrir \"$name\""
        start(launch)
        return "Abrí ${hit.first.loadLabel(pm)}"
    }

    fun torch(on: Boolean): String {
        val cm = svc.getSystemService(Context.CAMERA_SERVICE) as CameraManager
        val id = cm.cameraIdList.firstOrNull {
            cm.getCameraCharacteristics(it).get(CameraCharacteristics.FLASH_INFO_AVAILABLE) == true
        } ?: return "Este teléfono no tiene linterna"
        cm.setTorchMode(id, on)
        return if (on) "Linterna encendida" else "Linterna apagada"
    }

    fun settings(section: String): String {
        val action = when (ScreenInfo.norm(section)) {
            "wifi" -> Settings.ACTION_WIFI_SETTINGS
            "bluetooth" -> Settings.ACTION_BLUETOOTH_SETTINGS
            "ubicacion" -> Settings.ACTION_LOCATION_SOURCE_SETTINGS
            "pantalla" -> Settings.ACTION_DISPLAY_SETTINGS
            "sonido" -> Settings.ACTION_SOUND_SETTINGS
            "bateria" -> Intent.ACTION_POWER_USAGE_SUMMARY
            "apps" -> Settings.ACTION_APPLICATION_SETTINGS
            "redes", "datos" -> Settings.ACTION_WIRELESS_SETTINGS
            "almacenamiento" -> Settings.ACTION_INTERNAL_STORAGE_SETTINGS
            "accesibilidad" -> Settings.ACTION_ACCESSIBILITY_SETTINGS
            "fecha" -> Settings.ACTION_DATE_SETTINGS
            "idioma" -> Settings.ACTION_LOCALE_SETTINGS
            "seguridad" -> Settings.ACTION_SECURITY_SETTINGS
            else -> Settings.ACTION_SETTINGS
        }
        start(Intent(action))
        return "Abrí los ajustes de $section"
    }

    fun readScreen(): String {
        if (ScreenInfo.service == null) {
            return "No tengo permiso de 'ayuda en pantalla' (accesibilidad). Dile al usuario que lo active en la app Mangobeja."
        }
        if (ScreenInfo.sensitive) return "En pantalla hay un campo de contraseña; por privacidad no la leo."
        val texts = ScreenInfo.lastTexts
        if (texts.isEmpty()) return "No veo textos en la pantalla."
        return "App: ${ScreenInfo.lastPackage}\nTextos visibles: " + texts.take(100).joinToString(" | ")
    }

    fun point(text: String, msg: String): String {
        val s = ScreenInfo.service
            ?: return "No tengo permiso de 'ayuda en pantalla' (accesibilidad). Explica el paso con palabras y sugiere activarlo en la app Mangobeja."
        Thread.sleep(1200) // dejar que se abra la pantalla
        repeat(4) {
            val r = s.find(text)
            if (r != null) {
                svc.perchOnFromAnyThread(r, msg)
                return "Listo: me paré encima de \"$text\". Dile al usuario que toque justo debajo de mí."
            }
            Thread.sleep(700)
        }
        return "No encontré \"$text\" en la pantalla actual. Explica el paso con palabras."
    }
}
