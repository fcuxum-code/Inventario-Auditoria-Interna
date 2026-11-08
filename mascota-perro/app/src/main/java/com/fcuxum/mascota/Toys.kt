package com.fcuxum.mascota

import android.content.Context
import android.graphics.Canvas
import android.graphics.Paint
import android.graphics.Path
import android.graphics.RadialGradient
import android.graphics.Shader
import android.view.View
import kotlin.math.cos
import kotlin.math.sin

/** Juguetes de Mangobeja, inspirados en los reales: aro amarillo, pelota roja con asa y un hueso. */
object Toys {
    const val ARO = "aro"
    const val PELOTA = "pelota"
    const val HUESO = "hueso"

    private val p = Paint(Paint.ANTI_ALIAS_FLAG)
    private val stroke = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        style = Paint.Style.STROKE
        strokeCap = Paint.Cap.ROUND
    }

    private fun radial(cx: Float, cy: Float, r: Float, light: Int, base: Int, dark: Int) =
        RadialGradient(cx - r * 0.35f, cy - r * 0.4f, r * 1.4f, intArrayOf(light, base, dark),
            floatArrayOf(0f, 0.5f, 1f), Shader.TileMode.CLAMP)

    /** Dibuja el juguete centrado en (cx, cy) con radio aproximado r. */
    fun draw(c: Canvas, kind: String, cx: Float, cy: Float, r: Float, rotDeg: Float = 0f) {
        c.save()
        c.rotate(rotDeg, cx, cy)
        when (kind) {
            PELOTA -> {
                // asa
                stroke.shader = null
                stroke.color = 0xFFB71C1C.toInt()
                stroke.strokeWidth = r * 0.28f
                c.drawCircle(cx + r * 1.05f, cy + r * 0.25f, r * 0.62f, stroke)
                // pelota
                p.shader = radial(cx, cy, r, 0xFFFF8A80.toInt(), 0xFFE53935.toInt(), 0xFF8E1B1B.toInt())
                c.drawCircle(cx, cy, r, p)
                p.shader = null
                stroke.color = 0x66000000
                stroke.strokeWidth = r * 0.09f
                val z = Path()
                for (k in 0..2) {
                    val yy = cy - r * 0.5f + k * r * 0.5f
                    z.moveTo(cx - r * 0.7f, yy)
                    var xx = cx - r * 0.7f
                    var up = true
                    while (xx < cx + r * 0.7f) {
                        xx += r * 0.23f
                        z.lineTo(xx, yy + if (up) -r * 0.14f else r * 0.14f)
                        up = !up
                    }
                }
                c.save()
                val clip = Path().apply { addCircle(cx, cy, r * 0.95f, Path.Direction.CW) }
                c.clipPath(clip)
                c.drawPath(z, stroke)
                c.restore()
            }
            HUESO -> {
                p.shader = radial(cx, cy, r, 0xFFFFFDF5.toInt(), 0xFFF1E3C6.toInt(), 0xFFB9A57E.toInt())
                c.drawRoundRect(cx - r * 0.85f, cy - r * 0.28f, cx + r * 0.85f, cy + r * 0.28f, r * 0.2f, r * 0.2f, p)
                for (sx in floatArrayOf(-1f, 1f)) for (sy in floatArrayOf(-1f, 1f)) {
                    c.drawCircle(cx + sx * r * 0.9f, cy + sy * r * 0.28f, r * 0.34f, p)
                }
                p.shader = null
            }
            else -> { // aro amarillo
                stroke.shader = radial(cx, cy, r, 0xFFFFE082.toInt(), 0xFFF2B731.toInt(), 0xFFB07A10.toInt())
                stroke.strokeWidth = r * 0.42f
                c.drawCircle(cx, cy, r * 0.78f, stroke)
                stroke.shader = null
                stroke.color = 0x55804000
                stroke.strokeWidth = r * 0.07f
                for (k in 0 until 18) {
                    val a = k * (Math.PI * 2 / 18)
                    val ca = cos(a).toFloat()
                    val sa = sin(a).toFloat()
                    c.drawLine(cx + ca * r * 0.62f, cy + sa * r * 0.62f, cx + ca * r * 0.94f, cy + sa * r * 0.94f, stroke)
                }
            }
        }
        c.restore()
    }
}

/** Ventanita del juguete cuando está en el suelo o volando. Se dibuja anclado abajo y se encoge con la distancia. */
class ToyView(ctx: Context) : View(ctx) {
    var kind = Toys.ARO
    var scale = 1f
    var rot = 0f

    override fun onDraw(c: Canvas) {
        val w = width.toFloat()
        val r = w * 0.32f * scale
        val cy = height - r - height * 0.06f
        Toys.draw(c, kind, w / 2f, cy, r, rot)
    }
}
