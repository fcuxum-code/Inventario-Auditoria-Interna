package com.fcuxum.mascota

import android.content.Context
import android.graphics.Canvas
import android.graphics.LinearGradient
import android.graphics.Paint
import android.graphics.Path
import android.graphics.RadialGradient
import android.graphics.RectF
import android.graphics.Shader
import android.view.View
import kotlin.math.PI
import kotlin.math.abs
import kotlin.math.cos
import kotlin.math.max
import kotlin.math.min
import kotlin.math.sin

/** Poses de la mascota. */
enum class Pose { SIT, WALK, RUN, LIE, SLEEP, FLY, HAPPY, DRAG, THINK }

/**
 * Mangobeja en "2.5D": volumen con degradados, brillos, pelo esponjado en los bordes,
 * orejas caídas de la mitad hacia abajo, ojos color miel, mancha blanca en el pecho
 * y su sudadera de abeja con antenitas.
 * Lienzo lógico de 100x100 mirando a la derecha. [scale] lo encoge (anclado abajo) para simular distancia.
 */
class PetView(ctx: Context) : View(ctx) {

    var pose = Pose.SIT
    var facingLeft = false
    var withToy = false
    var toyKind = Toys.ARO
    var scale = 1f

    private var t = 0f
    private var tilt = 0f
    private var blinkTimer = 3f
    private var blinking = 0f

    // ---------- colores ----------
    private val FUR = 0xFF3A3D44.toInt()
    private val FUR_LIGHT = 0xFF6A6F79.toInt()
    private val FUR_DARK = 0xFF1E2024.toInt()
    private val FAR = 0xFF26282D.toInt()
    private val FAR_DARK = 0xFF15161A.toInt()
    private val YEL = 0xFFF5D90A.toInt()
    private val YEL_LIGHT = 0xFFFFF59D.toInt()
    private val YEL_DARK = 0xFFB89A00.toInt()
    private val BLK = 0xFF1C1C1E.toInt()

    private val p = Paint(Paint.ANTI_ALIAS_FLAG)
    private val s = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        style = Paint.Style.STROKE
        strokeCap = Paint.Cap.ROUND
        strokeJoin = Paint.Join.ROUND
    }
    private val zPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = 0xFF5C6BC0.toInt()
        isFakeBoldText = true
    }

    fun tick(dt: Float) {
        t += dt
        blinkTimer -= dt
        if (blinking > 0f) blinking -= dt
        if (blinkTimer <= 0f) {
            blinking = 0.13f
            blinkTimer = 2.5f + (Math.random() * 3).toFloat()
        }
        val target = when (pose) {
            Pose.THINK -> 16f
            Pose.SIT -> sin(t * 0.7f) * 5f
            else -> 0f
        }
        tilt += (target - tilt) * min(1f, dt * 6f)
        invalidate()
    }

    private fun eyes(): Int = when {
        pose == Pose.SLEEP -> 2
        blinking > 0f -> 2
        pose == Pose.LIE -> 1
        else -> 0
    }

    // ---------- utilidades de sombreado ----------

    private fun radial(cx: Float, cy: Float, r: Float, light: Int, base: Int, dark: Int): Shader =
        RadialGradient(cx - r * 0.35f, cy - r * 0.45f, r * 1.45f, intArrayOf(light, base, dark),
            floatArrayOf(0f, 0.45f, 1f), Shader.TileMode.CLAMP)

    private fun fill(shader: Shader?, color: Int = 0) {
        p.shader = shader
        if (shader == null) p.color = color
    }

    private fun oval(l: Float, tp: Float, r: Float, b: Float, light: Int, base: Int, dark: Int) {
        val cx = (l + r) / 2f
        val cy = (tp + b) / 2f
        fill(radial(cx, cy, max(r - l, b - tp) / 2f, light, base, dark))
        p.alpha = 255
        draw?.drawOval(l, tp, r, b, p)
    }

    private fun circle(cx: Float, cy: Float, r: Float, light: Int, base: Int, dark: Int) {
        fill(radial(cx, cy, r, light, base, dark))
        draw?.drawCircle(cx, cy, r, p)
    }

    /** Pelitos en el borde de un círculo para que se vea esponjado. */
    private fun fluff(cx: Float, cy: Float, r: Float, from: Float, to: Float, n: Int, len: Float, color: Int) {
        val c = draw ?: return
        s.shader = null
        s.color = color
        s.strokeWidth = 1.6f
        for (i in 0 until n) {
            val a = (from + (to - from) * i / (n - 1)) * PI.toFloat() / 180f
            val j = 0.7f + 0.3f * abs(sin(i * 12.9898f + cx))
            val ca = cos(a)
            val sa = sin(a)
            c.drawLine(cx + ca * (r - 1.5f), cy + sa * (r - 1.5f), cx + ca * (r + len * j), cy + sa * (r + len * j), s)
        }
    }

    private var draw: Canvas? = null

    override fun onDraw(c: Canvas) {
        val u = width / 100f
        draw = c
        c.save()
        c.scale(scale, scale, width / 2f, height.toFloat())
        groundShadow(c, u)
        if (facingLeft) c.scale(-1f, 1f, width / 2f, 0f)
        c.scale(u, u)
        when (pose) {
            Pose.WALK -> standing(gait = 9f, swing = 22f, bob = 0f, wagFast = false, tongue = false)
            Pose.RUN -> standing(gait = 17f, swing = 34f, bob = -abs(sin(t * 17f)) * 4f, wagFast = true, tongue = true)
            Pose.HAPPY -> standing(gait = 0f, swing = 0f, bob = -abs(sin(t * 7f)) * 9f, wagFast = true, tongue = !withToy)
            Pose.FLY, Pose.DRAG -> flying()
            Pose.LIE -> lying()
            Pose.SLEEP -> curled()
            Pose.SIT, Pose.THINK -> sitting()
        }
        c.restore()
        if (pose == Pose.SLEEP) zzz(c, u)
        draw = null
    }

    private fun groundShadow(c: Canvas, u: Float) {
        val lift = when (pose) {
            Pose.FLY, Pose.DRAG -> 0.55f
            Pose.HAPPY -> 1f - abs(sin(t * 7f)) * 0.3f
            else -> 1f
        }
        val cx = width / 2f
        val cy = 92.5f * u
        val rx = 34f * u * lift
        p.shader = RadialGradient(cx, cy, rx, intArrayOf(0x55000000, 0x00000000), null, Shader.TileMode.CLAMP)
        c.save()
        c.scale(1f, 0.16f, cx, cy)
        c.drawCircle(cx, cy, rx, p)
        c.restore()
        p.shader = null
    }

    // ---------- piezas ----------

    private fun leg(x: Float, top: Float, len: Float, angle: Float, far: Boolean) {
        val c = draw ?: return
        c.save()
        c.rotate(angle, x, top)
        val base = if (far) FAR else FUR
        val dark = if (far) FAR_DARK else FUR_DARK
        fill(LinearGradient(x - 3.5f, 0f, x + 3.5f, 0f, intArrayOf(if (far) FAR else FUR_LIGHT, base, dark), null, Shader.TileMode.CLAMP))
        c.drawRoundRect(x - 3.4f, top, x + 3.4f, top + len, 3.4f, 3.4f, p)
        oval(x - 4.2f, top + len - 3.8f, x + 6f, top + len + 1.8f, if (far) FAR else FUR_LIGHT, base, dark)
        c.restore()
    }

    private fun tail(x: Float, y: Float, angle: Float) {
        val c = draw ?: return
        c.save()
        c.rotate(angle, x, y)
        s.shader = null
        s.color = FUR_DARK
        s.strokeWidth = 8.5f
        val p1 = Path().apply { moveTo(x, y); quadTo(x - 11f, y - 2f, x - 12f, y - 17f) }
        c.drawPath(p1, s)
        s.color = FUR
        s.strokeWidth = 6.5f
        c.drawPath(p1, s)
        s.color = FUR_LIGHT
        s.strokeWidth = 2.2f
        val p2 = Path().apply { moveTo(x - 6f, y - 5f); quadTo(x - 10.5f, y - 9f, x - 11.5f, y - 16f) }
        c.drawPath(p2, s)
        c.restore()
    }

    /** Cuerpo con la sudadera de abeja: amarilla con rayas negras, sombreada como un cilindro. */
    private fun body(r: RectF, rot: Float) {
        val c = draw ?: return
        c.save()
        c.rotate(rot, r.centerX(), r.centerY())
        val path = Path().apply { addOval(r, Path.Direction.CW) }
        fill(radial(r.centerX(), r.centerY(), r.width() / 2f, FUR_LIGHT, FUR, FUR_DARK))
        c.drawPath(path, p)
        c.save()
        c.clipPath(path)
        val w = r.width()
        val hx = r.left + w * 0.28f
        fill(LinearGradient(0f, r.top, 0f, r.bottom, intArrayOf(YEL_LIGHT, YEL, YEL_DARK), floatArrayOf(0f, 0.45f, 1f), Shader.TileMode.CLAMP))
        c.drawRect(hx, r.top - 5f, r.right + 5f, r.bottom + 5f, p)
        fill(LinearGradient(0f, r.top, 0f, r.bottom, intArrayOf(0xFF4A4A4E.toInt(), BLK, 0xFF050505.toInt()), floatArrayOf(0f, 0.45f, 1f), Shader.TileMode.CLAMP))
        for (i in 0..1) {
            val sx = hx + w * 0.1f + i * w * 0.2f
            c.drawRect(sx, r.top - 5f, sx + w * 0.09f, r.bottom + 5f, p)
        }
        c.drawRect(r.right - w * 0.17f, r.top - 5f, r.right + 5f, r.bottom + 5f, p)
        // brillo superior
        fill(LinearGradient(0f, r.top, 0f, r.top + r.height() * 0.45f, intArrayOf(0x55FFFFFF, 0x00FFFFFF), null, Shader.TileMode.CLAMP))
        c.drawRect(r.left, r.top, r.right, r.top + r.height() * 0.45f, p)
        c.restore()
        c.restore()
    }

    private fun neck(x: Float, y: Float) {
        oval(x - 11f, y - 8f, x + 5f, y + 10f, 0xFF4A4A4E.toInt(), BLK, 0xFF050505.toInt()) // capucha
        circle(x + 1f, y, 8.5f, FUR_LIGHT, FUR, FUR_DARK)
        oval(x + 1f, y + 1f, x + 8f, y + 9f, 0xFFFFFFFF.toInt(), 0xFFE6E6E6.toInt(), 0xFFB8B8B8.toInt()) // mancha blanca
    }

    /** Oreja caída de la mitad hacia abajo (como la de Mango en las fotos). */
    private fun ear(dx: Float, far: Boolean, sway: Float) {
        val c = draw ?: return
        val base = if (far) FAR else FUR
        val dark = if (far) FAR_DARK else FUR_DARK
        // mitad de abajo, parada
        val low = Path().apply {
            moveTo(dx - 6.5f, -8f); lineTo(dx - 3.5f, -18f); lineTo(dx + 4.5f, -18f); lineTo(dx + 6f, -7f); close()
        }
        fill(LinearGradient(dx - 6f, 0f, dx + 6f, 0f, intArrayOf(dark, base, if (far) FAR else FUR_LIGHT), null, Shader.TileMode.CLAMP))
        c.drawPath(low, p)
        if (!far) {
            val inner = Path().apply { moveTo(dx - 3.5f, -9f); lineTo(dx - 1.5f, -16.5f); lineTo(dx + 3f, -16.5f); lineTo(dx + 3.5f, -9f); close() }
            fill(LinearGradient(0f, -17f, 0f, -9f, intArrayOf(0xFF8E939B.toInt(), 0xFF6B7078.toInt()), null, Shader.TileMode.CLAMP))
            c.drawPath(inner, p)
        }
        // mitad de arriba, doblada hacia adelante
        c.save()
        c.rotate(sway, dx + 0.5f, -18f)
        val flap = Path().apply {
            moveTo(dx - 4f, -18.5f)
            lineTo(dx + 5f, -18.5f)
            quadTo(dx + 10f, -14f, dx + 9.5f, -8.5f)
            quadTo(dx + 4f, -11f, dx - 4f, -18.5f)
            close()
        }
        fill(LinearGradient(dx - 4f, -19f, dx + 9f, -9f, intArrayOf(if (far) FAR else FUR_LIGHT, base, dark), null, Shader.TileMode.CLAMP))
        c.drawPath(flap, p)
        s.shader = null
        s.color = if (far) FAR_DARK else 0xFF8E939B.toInt()
        s.strokeWidth = 0.9f
        c.drawLine(dx - 4f, -18.5f, dx + 5f, -18.5f, s)
        c.restore()
    }

    private fun eye(x: Float, y: Float, mode: Int) {
        val c = draw ?: return
        when (mode) {
            0 -> {
                circle(x, y, 3.8f, 0xFF3A2A10.toInt(), 0xFF2A1E0C.toInt(), 0xFF120C04.toInt())
                fill(RadialGradient(x, y, 3.4f, intArrayOf(0xFFFBD88E.toInt(), 0xFFE2A54E.toInt(), 0xFFA8701E.toInt()), floatArrayOf(0f, 0.6f, 1f), Shader.TileMode.CLAMP))
                c.drawCircle(x, y, 3.3f, p)
                fill(null, 0xFF0D0D0D.toInt())
                c.drawCircle(x + 0.9f, y + 0.1f, 1.7f, p)
                fill(null, 0xFFFFFFFF.toInt())
                c.drawCircle(x - 0.5f, y - 1.3f, 0.95f, p)
                c.drawCircle(x + 1.6f, y + 1.1f, 0.4f, p)
            }
            1 -> {
                fill(RadialGradient(x, y, 3.4f, intArrayOf(0xFFFBD88E.toInt(), 0xFFE2A54E.toInt(), 0xFFA8701E.toInt()), floatArrayOf(0f, 0.6f, 1f), Shader.TileMode.CLAMP))
                c.drawCircle(x, y, 3.3f, p)
                fill(null, 0xFF0D0D0D.toInt())
                c.drawCircle(x + 1.5f, y + 0.7f, 1.6f, p)
                fill(null, FUR)
                c.drawRect(x - 4.2f, y - 4.2f, x + 4.2f, y - 0.3f, p)
                s.shader = null; s.color = 0xFF111111.toInt(); s.strokeWidth = 1.2f
                c.drawLine(x - 3.6f, y - 0.3f, x + 3.6f, y - 0.3f, s)
            }
            else -> {
                s.shader = null; s.color = 0xFF111111.toInt(); s.strokeWidth = 1.2f
                c.drawPath(Path().apply { moveTo(x - 3f, y); quadTo(x, y + 2.2f, x + 3f, y) }, s)
            }
        }
    }

    private fun head(cx: Float, cy: Float, rot: Float, em: Int, mouthToy: Boolean, tongue: Boolean, earSway: Float) {
        val c = draw ?: return
        c.save()
        c.translate(cx, cy)
        c.rotate(rot)
        ear(-9f, true, earSway * 0.8f)
        // melena y cabeza
        circle(-3f, 5f, 13f, FUR_LIGHT, FUR, FUR_DARK)
        fluff(-3f, 5f, 13f, 90f, 230f, 12, 2.5f, FUR)
        circle(0f, 0f, 14.5f, FUR_LIGHT, FUR, FUR_DARK)
        fluff(0f, 0f, 14.5f, 200f, 300f, 10, 3.5f, FUR_DARK)
        // tono más claro (gris-café) en la cara, como en las fotos
        fill(RadialGradient(8f, 2f, 10f, intArrayOf(0x556E6458, 0x006E6458), null, Shader.TileMode.CLAMP))
        c.drawCircle(8f, 2f, 10f, p)
        ear(0f, false, earSway)
        // hocico
        oval(4f, -2.5f, 23.5f, 10.5f, 0xFF7A7F88.toInt(), 0xFF4B5058.toInt(), 0xFF2A2C31.toInt())
        oval(4f, -3.5f, 15f, 6f, FUR_LIGHT, FUR, FUR)
        // nariz
        fill(RadialGradient(21.5f, 0.2f, 3.5f, intArrayOf(0xFF555555.toInt(), 0xFF141414.toInt(), 0xFF000000.toInt()), floatArrayOf(0f, 0.5f, 1f), Shader.TileMode.CLAMP))
        c.drawOval(19.3f, -1.4f, 25.7f, 4.4f, p)
        fill(null, 0x99FFFFFF.toInt())
        c.drawCircle(21.2f, 0f, 0.8f, p)
        when {
            mouthToy -> Toys.draw(c, toyKind, 17f, 10f, 6f, -15f)
            tongue -> {
                fill(null, 0xFF2A0F0F.toInt())
                c.drawPath(Path().apply { moveTo(12.5f, 7f); quadTo(18f, 12.5f, 22.5f, 7.5f); close() }, p)
                val wag = sin(t * 9f) * 0.8f
                fill(LinearGradient(0f, 8f, 0f, 18f, intArrayOf(0xFFF48FB1.toInt(), 0xFFD8607F.toInt()), null, Shader.TileMode.CLAMP))
                c.drawRoundRect(14.5f + wag, 8f, 20f + wag, 17.5f, 3f, 3f, p)
                s.shader = null; s.color = 0x55A0304A; s.strokeWidth = 0.7f
                c.drawLine(17.2f + wag, 9.5f, 17.2f + wag, 15.5f, s)
            }
            else -> {
                s.shader = null; s.color = 0xFF111111.toInt(); s.strokeWidth = 0.9f
                c.drawPath(Path().apply { moveTo(21f, 7.5f); quadTo(17f, 9.5f, 13f, 7.5f) }, s)
            }
        }
        eye(8f, -3f, em)
        // antenitas de abeja
        val bob = sin(t * 6f) * 1.5f
        s.shader = null; s.color = BLK; s.strokeWidth = 1.6f
        c.drawLine(-3f, -13f, -9f, -29f + bob, s)
        c.drawLine(3f, -14f, 7f, -30f - bob, s)
        circle(-9f, -29f + bob, 2.8f, YEL_LIGHT, YEL, YEL_DARK)
        circle(7f, -30f - bob, 2.8f, YEL_LIGHT, YEL, YEL_DARK)
        c.restore()
    }

    // ---------- poses ----------

    private fun standing(gait: Float, swing: Float, bob: Float, wagFast: Boolean, tongue: Boolean) {
        val c = draw ?: return
        c.save()
        c.translate(0f, bob)
        val ph = t * gait
        val pi = PI.toFloat()
        val wag = sin(t * (if (wagFast) 18f else 5f)) * (if (wagFast) 22f else 10f)
        leg(34f, 66f, 22f, sin(ph + pi) * swing, true)
        leg(62f, 66f, 22f, sin(ph) * swing, true)
        tail(24f, 58f, wag)
        body(RectF(21f, 48f, 71f, 76f), if (gait > 12f) sin(ph) * 3f else 0f)
        leg(28f, 66f, 22f, sin(ph) * swing, false)
        leg(57f, 66f, 22f, sin(ph + pi) * swing, false)
        neck(63f, 52f)
        val hb = if (gait > 0f) sin(ph * 2f) * 1.2f else 0f
        val sway = if (gait > 0f) sin(ph * 2f) * (gait / 1.5f) else sin(t * 2f) * 3f
        head(73f, 38f + hb, tilt, eyes(), withToy, tongue, sway)
        c.restore()
    }

    private fun sitting() {
        val c = draw ?: return
        c.save()
        c.rotate(sin(t * 4f) * 6f, 30f, 84f)
        s.shader = null; s.color = FUR_DARK; s.strokeWidth = 8.5f
        val tp = Path().apply { moveTo(30f, 84f); quadTo(18f, 88f, 10f, 82f) }
        c.drawPath(tp, s)
        s.color = FUR; s.strokeWidth = 6.5f
        c.drawPath(tp, s)
        c.restore()
        leg(61f, 60f, 27f, 0f, true)
        body(RectF(30f, 50f, 70f, 74f), -62f)
        oval(24f, 64f, 52f, 90f, FUR_LIGHT, FUR, FUR_DARK) // muslo
        fluff(38f, 77f, 13f, 160f, 260f, 8, 2.5f, FUR)
        oval(38f, 85f, 53f, 91.5f, FUR_LIGHT, FUR, FUR_DARK)
        leg(55f, 62f, 26f, 0f, false)
        neck(58f, 42f)
        head(64f, 30f, tilt, eyes(), withToy, false, sin(t * 2f) * 3f)
    }

    private fun lying() {
        val c = draw ?: return
        val breathe = sin(t * 3f) * 0.8f
        c.save()
        c.rotate(sin(t * 3f) * 6f, 20f, 84f)
        s.shader = null; s.color = FUR; s.strokeWidth = 7f
        c.drawPath(Path().apply { moveTo(20f, 84f); quadTo(10f, 90f, 2f, 86f) }, s)
        c.restore()
        fill(null, FAR)
        c.drawRoundRect(56f, 83f, 90f, 89f, 3f, 3f, p)
        body(RectF(16f, 68f - breathe, 70f, 90f), 0f)
        oval(18f, 76f, 40f, 91f, FUR_LIGHT, FUR, FUR_DARK)
        fill(LinearGradient(0f, 85f, 0f, 91f, intArrayOf(FUR_LIGHT, FUR_DARK), null, Shader.TileMode.CLAMP))
        c.drawRoundRect(54f, 85f, 88f, 91f, 3f, 3f, p)
        oval(83f, 85f, 94f, 92f, FUR_LIGHT, FUR, FUR_DARK)
        neck(64f, 76f)
        head(74f, 73f, 12f, eyes(), false, false, 2f)
    }

    /** Dormido hecho bolita, como en la foto. */
    private fun curled() {
        val c = draw ?: return
        val breathe = sin(t * 2f) * 1f
        body(RectF(16f, 60f - breathe, 80f, 92f), -8f)
        fluff(48f, 76f, 30f, 200f, 330f, 16, 3f, FUR)
        // cola rodeando
        s.shader = null; s.color = FUR_DARK; s.strokeWidth = 8f
        val tp = Path().apply { moveTo(20f, 84f); quadTo(36f, 96f, 66f, 92f) }
        c.drawPath(tp, s)
        s.color = FUR; s.strokeWidth = 6f
        c.drawPath(tp, s)
        // patitas bajo la barbilla
        oval(64f, 86f, 80f, 93f, FUR_LIGHT, FUR, FUR_DARK)
        head(72f, 78f, 28f, 2, false, false, 3f)
    }

    private fun flying() {
        val c = draw ?: return
        c.save()
        c.translate(0f, sin(t * 5f) * 3f)
        val flap = sin(t * 40f) * 25f
        leg(34f, 66f, 16f, 50f, true)
        leg(62f, 66f, 16f, -40f, true)
        tail(24f, 58f, sin(t * 8f) * 15f)
        body(RectF(21f, 48f, 71f, 76f), 0f)
        leg(28f, 66f, 16f, 55f, false)
        leg(57f, 66f, 16f, -35f, false)
        neck(63f, 52f)
        head(73f, 38f, tilt, eyes(), withToy, false, sin(t * 10f) * 6f)
        for ((base, k, l, tp, r, b) in listOf(
            Wing(-20f, 1f, 22f, 28f, 46f, 50f),
            Wing(10f, 0.7f, 30f, 22f, 50f, 50f),
        )) {
            c.save()
            c.rotate(base + flap * k, 45f, 50f)
            fill(RadialGradient((l + r) / 2f, (tp + b) / 2f, 14f, intArrayOf(0xCCFFFFFF.toInt(), 0x88CFE8FF.toInt(), 0x559CC7EE), null, Shader.TileMode.CLAMP))
            c.drawOval(l, tp, r, b, p)
            s.shader = null; s.color = 0xAA8DB8E0.toInt(); s.strokeWidth = 0.8f
            c.drawOval(l, tp, r, b, s)
            c.restore()
        }
        c.restore()
    }

    private data class Wing(val a: Float, val k: Float, val l: Float, val t: Float, val r: Float, val b: Float)

    /** Las "z" se dibujan sin voltear para que se lean bien. */
    private fun zzz(c: Canvas, u: Float) {
        for (i in 0..2) {
            val ph = (t * 0.6f + i / 3f) % 1f
            zPaint.alpha = (255 * (1f - ph)).toInt()
            zPaint.textSize = (6f + 6f * ph) * u * scale
            val lx = 76f + ph * 12f
            val x = if (facingLeft) 100f - lx - 6f else lx
            val cx = width / 2f + (x * u - width / 2f) * scale
            val cy = height - (height - (60f - ph * 30f) * u) * scale
            c.drawText("z", cx, cy, zPaint)
        }
    }
}
