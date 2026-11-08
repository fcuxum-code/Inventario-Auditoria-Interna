package com.fcuxum.mascota

import android.accessibilityservice.AccessibilityService
import android.content.Intent
import android.graphics.Rect
import android.os.SystemClock
import android.view.accessibility.AccessibilityEvent
import android.view.accessibility.AccessibilityNodeInfo
import java.text.Normalizer

/** Lo último que la mascota "vio" en la pantalla de otra app. */
object ScreenInfo {
    @Volatile var service: ScreenReaderService? = null
    @Volatile var clickables: List<Rect> = emptyList()
    @Volatile var lastPackage: String = ""
    @Volatile var lastTexts: List<String> = emptyList()
    /** Hay un campo de contraseña visible: la mascota se esconde y no lee nada. */
    @Volatile var sensitive: Boolean = false

    fun norm(s: String): String =
        Normalizer.normalize(s.lowercase(), Normalizer.Form.NFD).replace(Regex("\\p{Mn}+"), "").trim()
}

/**
 * Servicio de accesibilidad OPCIONAL. Sirve para:
 *  - saber dónde están los botones (la mascota se posa sobre ellos),
 *  - señalar el botón que el usuario debe tocar,
 *  - leer la pantalla solo cuando el usuario lo pide.
 * No toca nada por el usuario.
 */
class ScreenReaderService : AccessibilityService() {

    private var lastScan = 0L

    override fun onServiceConnected() {
        ScreenInfo.service = this
    }

    override fun onUnbind(intent: Intent?): Boolean {
        ScreenInfo.service = null
        return super.onUnbind(intent)
    }

    override fun onDestroy() {
        ScreenInfo.service = null
        super.onDestroy()
    }

    override fun onInterrupt() {}

    override fun onAccessibilityEvent(event: AccessibilityEvent?) {
        val now = SystemClock.uptimeMillis()
        if (now - lastScan < 700) return
        lastScan = now
        try { scan() } catch (_: Exception) { }
    }

    private fun walk(n: AccessibilityNodeInfo, depth: Int, f: (AccessibilityNodeInfo) -> Unit) {
        if (depth > 35) return
        f(n)
        for (i in 0 until n.childCount) {
            val ch = n.getChild(i) ?: continue
            walk(ch, depth + 1, f)
        }
    }

    fun scan() {
        val root = rootInActiveWindow ?: return
        val pkg = root.packageName?.toString() ?: ""
        if (pkg == packageName) return // nuestra propia ventana de chat: conservar lo anterior
        val rects = ArrayList<Rect>()
        val texts = ArrayList<String>()
        var pwd = false
        walk(root, 0) { n ->
            if (n.isPassword) pwd = true
            if (n.isClickable && n.isVisibleToUser) {
                val r = Rect()
                n.getBoundsInScreen(r)
                if (r.width() > 30 && r.height() > 30) rects.add(r)
            }
            val t = (n.text ?: n.contentDescription)?.toString()?.trim()
            if (!t.isNullOrEmpty() && !n.isPassword && n.isVisibleToUser && texts.size < 150) texts.add(t)
        }
        ScreenInfo.sensitive = pwd
        ScreenInfo.lastPackage = pkg
        ScreenInfo.clickables = rects
        ScreenInfo.lastTexts = if (pwd) emptyList() else texts
    }

    /** Busca en la pantalla actual un elemento cuyo texto coincida y devuelve dónde está. */
    fun find(query: String): Rect? {
        val root = rootInActiveWindow ?: return null
        if (root.packageName?.toString() == packageName) return null
        val nq = ScreenInfo.norm(query)
        if (nq.isEmpty()) return null
        var best: AccessibilityNodeInfo? = null
        var bestScore = 0
        walk(root, 0) { n ->
            if (!n.isVisibleToUser) return@walk
            val label = ScreenInfo.norm((n.text ?: n.contentDescription ?: "").toString())
            if (label.isEmpty()) return@walk
            val score = when {
                label == nq -> 3
                label.startsWith(nq) -> 2
                label.contains(nq) -> 1
                else -> 0
            }
            if (score > bestScore) {
                bestScore = score
                best = n
            }
        }
        val b = best ?: return null
        var target: AccessibilityNodeInfo? = b
        var hops = 0
        while (target != null && !target.isClickable && hops < 5) {
            target = target.parent
            hops++
        }
        val r = Rect()
        (if (target != null && target.isClickable) target else b).getBoundsInScreen(r)
        return if (r.isEmpty) null else r
    }
}
