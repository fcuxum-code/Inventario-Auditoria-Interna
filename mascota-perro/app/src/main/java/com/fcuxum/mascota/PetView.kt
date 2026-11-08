package com.fcuxum.mascota

import android.content.Context
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.Path
import android.graphics.RectF
import android.view.View
import kotlin.math.PI
import kotlin.math.abs
import kotlin.math.min
import kotlin.math.sin

/** Poses de la mascota. */
enum class Pose { SIT, WALK, LIE, SLEEP, FLY, HAPPY, DRAG, THINK }

/**
 * Dibuja al perrito (versión caricatura del perro real: pelaje gris oscuro esponjado,
 * ojos color miel, orejas medio dobladas y su disfraz de abeja con antenitas).
 * Se dibuja en un lienzo de 100x100 unidades mirando a la derecha; se voltea si mira a la izquierda.
 */
class PetView(ctx: Context) : View(ctx) {

    var pose = Pose.SIT
    var facingLeft = false
    var withToy = false

    private var t = 0f
    private var tilt = 0f
    private var blinkTimer = 3f
    private var blinking = 0f

    private fun paint(c: Int, stroke: Float = 0f) = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = c
        if (stroke > 0f) {
            style = Paint.Style.STROKE
            strokeWidth = stroke
            strokeCap = Paint.Cap.ROUND
            strokeJoin = Paint.Join.ROUND
        }
    }

    private val fur = paint(0xFF35383E.toInt())
    private val furFar = paint(0xFF26282D.toInt())
    private val furLight = paint(0xFF4B5058.toInt())
    private val earIn = paint(0xFF767B84.toInt())
    private val spike = paint(0xFF2A2C31.toInt())
    private val yellow = paint(0xFFF5D90A.toInt())
    private val stripe = paint(0xFF1C1C1E.toInt())
    private val iris = paint(0xFFE2A54E.toInt())
    private val black = paint(0xFF111111.toInt())
    private val white = paint(Color.WHITE)
    private val lid = paint(0xFF111111.toInt(), 1.2f)
    private val mouth = paint(0xFF111111.toInt(), 0.9f)
    private val tailStroke = paint(0xFF35383E.toInt(), 7f)
    private val tailTip = paint(0xFF4B5058.toInt(), 4f)
    private val antenna = paint(0xFF1C1C1E.toInt(), 1.6f)
    private val toyRed = paint(0xFFC62828.toInt())
    private val toyDark = paint(0xFF7F1414.toInt())
    private val wing = paint(0x99D6ECFF.toInt())
    private val wingEdge = paint(0xCC9CC7EE.toInt(), 0.8f)
    private val shadow = paint(0x33000000)
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
            Pose.SIT -> sin(t * 0.7f) * 4f
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

    override fun onDraw(c: Canvas) {
        val s = width / 100f
        c.save()
        if (facingLeft) c.scale(-1f, 1f, width / 2f, 0f)
        c.scale(s, s)
        when (pose) {
            Pose.WALK -> standing(c, walking = true, bob = 0f, wagFast = false)
            Pose.HAPPY -> standing(c, walking = false, bob = -abs(sin(t * 7f)) * 9f, wagFast = true)
            Pose.FLY, Pose.DRAG -> flying(c)
            Pose.LIE -> lying(c, sleeping = false)
            Pose.SLEEP -> lying(c, sleeping = true)
            Pose.SIT, Pose.THINK -> sitting(c)
        }
        c.restore()
        if (pose == Pose.SLEEP) zzz(c, s)
    }

    // ---------- piezas ----------

    private fun leg(c: Canvas, x: Float, top: Float, len: Float, angle: Float, p: Paint) {
        c.save()
        c.rotate(angle, x, top)
        c.drawRoundRect(x - 3.2f, top, x + 3.2f, top + len, 3f, 3f, p)
        c.drawOval(x - 4f, top + len - 3.5f, x + 5.5f, top + len + 1.5f, p)
        c.restore()
    }

    private fun tail(c: Canvas, x: Float, y: Float, angle: Float) {
        c.save()
        c.rotate(angle, x, y)
        val p1 = Path().apply { moveTo(x, y); quadTo(x - 11f, y - 2f, x - 12f, y - 17f) }
        c.drawPath(p1, tailStroke)
        val p2 = Path().apply { moveTo(x - 8f, y - 7f); quadTo(x - 12f, y - 11f, x - 12f, y - 17f) }
        c.drawPath(p2, tailTip)
        c.restore()
    }

    /** Cuerpo con la sudadera de abeja (amarilla con rayas negras y capucha negra al frente). */
    private fun body(c: Canvas, r: RectF, rot: Float) {
        c.save()
        c.rotate(rot, r.centerX(), r.centerY())
        val path = Path().apply { addOval(r, Path.Direction.CW) }
        c.drawPath(path, fur)
        c.save()
        c.clipPath(path)
        val w = r.width()
        val hx = r.left + w * 0.28f
        c.drawRect(hx, r.top - 5f, r.right + 5f, r.bottom + 5f, yellow)
        for (i in 0..1) {
            val sx = hx + w * 0.1f + i * w * 0.2f
            c.drawRect(sx, r.top - 5f, sx + w * 0.09f, r.bottom + 5f, stripe)
        }
        c.drawRect(r.right - w * 0.17f, r.top - 5f, r.right + 5f, r.bottom + 5f, stripe)
        c.restore()
        c.restore()
    }

    private fun neck(c: Canvas, x: Float, y: Float) {
        c.drawOval(x - 11f, y - 8f, x + 5f, y + 10f, stripe) // capucha
        c.drawCircle(x + 1f, y, 8f, fur)
    }

    private fun ear(c: Canvas, dx: Float, p: Paint, inner: Paint?) {
        val path = Path().apply {
            moveTo(dx - 6f, -9f); lineTo(dx - 1f, -24f); lineTo(dx + 6f, -22f); lineTo(dx + 5f, -8f); close()
        }
        c.drawPath(path, p)
        if (inner != null) {
            val ip = Path().apply {
                moveTo(dx - 3.5f, -10f); lineTo(dx, -19f); lineTo(dx + 3f, -18f); lineTo(dx + 3f, -10f); close()
            }
            c.drawPath(ip, inner)
        }
        // punta doblada hacia adelante
        val fold = Path().apply {
            moveTo(dx - 1f, -24f); lineTo(dx + 6f, -22f); lineTo(dx + 3.5f, -17.5f); close()
        }
        c.drawPath(fold, if (inner != null) furLight else furFar)
    }

    private fun eye(c: Canvas, x: Float, y: Float, mode: Int) {
        when (mode) {
            0 -> {
                c.drawCircle(x, y, 3.4f, iris)
                c.drawCircle(x + 0.9f, y, 1.7f, black)
                c.drawCircle(x - 0.4f, y - 1.3f, 0.8f, white)
            }
            1 -> { // mirada aburrida, de reojo
                c.drawCircle(x, y, 3.4f, iris)
                c.drawCircle(x + 1.4f, y + 0.6f, 1.6f, black)
                c.drawRect(x - 4f, y - 4f, x + 4f, y - 0.4f, fur)
                c.drawLine(x - 3.5f, y - 0.4f, x + 3.5f, y - 0.4f, lid)
            }
            else -> {
                val p = Path().apply { moveTo(x - 3f, y); quadTo(x, y + 2.2f, x + 3f, y) }
                c.drawPath(p, lid)
            }
        }
    }

    private fun toy(c: Canvas, x: Float, y: Float) {
        c.drawCircle(x, y, 4.2f, toyRed)
        c.drawCircle(x + 6.5f, y + 1.5f, 4.8f, toyRed)
        c.drawCircle(x + 6.5f, y + 1.5f, 1.5f, toyDark)
        c.drawCircle(x - 0.5f, y - 0.5f, 1.1f, toyDark)
    }

    private fun head(c: Canvas, cx: Float, cy: Float, rot: Float, eyeMode: Int, mouthToy: Boolean) {
        c.save()
        c.translate(cx, cy)
        c.rotate(rot)
        ear(c, -9f, furFar, null)
        c.drawCircle(-3f, 5f, 13f, fur) // melena
        c.drawCircle(0f, 0f, 14.5f, fur)
        // pelitos parados
        val xs = floatArrayOf(-10f, -5f, 0f, 5f)
        for (i in xs.indices) {
            val sx = xs[i]
            val tall = if (i % 2 == 0) 19.5f else 21f
            val p = Path().apply {
                moveTo(sx - 2.5f, -12f); lineTo(sx + 0.5f, -tall); lineTo(sx + 2.8f, -12.5f); close()
            }
            c.drawPath(p, spike)
        }
        ear(c, 0f, fur, earIn)
        // hocico
        c.drawOval(4f, -2f, 23f, 10f, furLight)
        c.drawOval(4f, -3f, 15f, 6f, fur)
        c.drawOval(19.5f, -1.2f, 25.5f, 4.2f, black)
        c.drawCircle(21.4f, 0.3f, 0.8f, furLight)
        if (mouthToy) {
            toy(c, 15f, 10f)
        } else {
            val m = Path().apply { moveTo(21f, 7.5f); quadTo(17f, 9.5f, 13f, 7.5f) }
            c.drawPath(m, mouth)
        }
        eye(c, 8f, -3f, eyeMode)
        // antenitas de abeja
        val bob = sin(t * 6f) * 1.5f
        c.drawLine(-3f, -13f, -9f, -29f + bob, antenna)
        c.drawCircle(-9f, -29f + bob, 2.6f, yellow)
        c.drawLine(3f, -14f, 7f, -30f - bob, antenna)
        c.drawCircle(7f, -30f - bob, 2.6f, yellow)
        c.restore()
    }

    // ---------- poses ----------

    private fun standing(c: Canvas, walking: Boolean, bob: Float, wagFast: Boolean) {
        c.drawOval(22f, 90f, 78f, 95f, shadow)
        c.save()
        c.translate(0f, bob)
        val ph = if (walking) t * 9f else 0f
        val sw = if (walking) 22f else 0f
        val pi = PI.toFloat()
        val wag = sin(t * (if (wagFast) 18f else 5f)) * (if (wagFast) 22f else 10f)
        leg(c, 34f, 66f, 22f, sin(ph + pi) * sw, furFar)
        leg(c, 62f, 66f, 22f, sin(ph) * sw, furFar)
        tail(c, 24f, 58f, wag)
        body(c, RectF(21f, 48f, 71f, 76f), 0f)
        leg(c, 28f, 66f, 22f, sin(ph) * sw, fur)
        leg(c, 57f, 66f, 22f, sin(ph + pi) * sw, fur)
        neck(c, 63f, 52f)
        val hb = if (walking) sin(ph * 2f) else 0f
        head(c, 73f, 38f + hb, tilt, eyes(), withToy && pose == Pose.HAPPY)
        c.restore()
    }

    private fun sitting(c: Canvas) {
        c.drawOval(20f, 89f, 74f, 95f, shadow)
        c.save()
        c.rotate(sin(t * 4f) * 6f, 30f, 84f)
        val tp = Path().apply { moveTo(30f, 84f); quadTo(18f, 88f, 10f, 82f) }
        c.drawPath(tp, tailStroke)
        c.restore()
        c.drawRoundRect(58f, 60f, 64.5f, 88f, 3f, 3f, furFar)
        c.drawOval(57.5f, 85f, 67f, 90f, furFar)
        body(c, RectF(30f, 50f, 70f, 74f), -62f)
        c.drawOval(24f, 64f, 52f, 90f, fur)
        c.drawOval(38f, 85f, 52f, 91f, fur)
        c.drawRoundRect(52f, 62f, 58.5f, 88f, 3f, 3f, fur)
        c.drawOval(51.5f, 85f, 61f, 90.5f, fur)
        neck(c, 58f, 42f)
        head(c, 64f, 30f, tilt, eyes(), false)
    }

    private fun lying(c: Canvas, sleeping: Boolean) {
        c.drawOval(12f, 88f, 92f, 95f, shadow)
        val breathe = sin(t * (if (sleeping) 2f else 3f)) * 0.8f
        c.save()
        c.rotate(if (sleeping) 0f else sin(t * 3f) * 6f, 20f, 84f)
        val tp = Path().apply { moveTo(20f, 84f); quadTo(10f, 90f, 2f, 86f) }
        c.drawPath(tp, tailStroke)
        c.restore()
        c.drawRoundRect(56f, 83f, 90f, 89f, 3f, 3f, furFar)
        body(c, RectF(16f, 68f - breathe, 70f, 90f), 0f)
        c.drawOval(18f, 76f, 40f, 91f, fur)
        c.drawRoundRect(54f, 85f, 88f, 91f, 3f, 3f, fur)
        c.drawOval(83f, 85f, 93f, 91.5f, fur)
        neck(c, 64f, 76f)
        head(c, 74f, 73f, 12f, eyes(), false)
    }

    private fun flying(c: Canvas) {
        c.save()
        c.translate(0f, sin(t * 5f) * 3f)
        val flap = sin(t * 40f) * 25f
        leg(c, 34f, 66f, 16f, 50f, furFar)
        leg(c, 62f, 66f, 16f, -40f, furFar)
        tail(c, 24f, 58f, sin(t * 8f) * 15f)
        body(c, RectF(21f, 48f, 71f, 76f), 0f)
        leg(c, 28f, 66f, 16f, 55f, fur)
        leg(c, 57f, 66f, 16f, -35f, fur)
        neck(c, 63f, 52f)
        head(c, 73f, 38f, tilt, eyes(), false)
        c.save()
        c.rotate(-20f + flap, 44f, 50f)
        c.drawOval(22f, 28f, 46f, 50f, wing)
        c.drawOval(22f, 28f, 46f, 50f, wingEdge)
        c.restore()
        c.save()
        c.rotate(10f + flap * 0.7f, 46f, 50f)
        c.drawOval(30f, 22f, 50f, 50f, wing)
        c.drawOval(30f, 22f, 50f, 50f, wingEdge)
        c.restore()
        c.restore()
    }

    /** Las "z" se dibujan sin voltear para que se lean bien. */
    private fun zzz(c: Canvas, s: Float) {
        for (i in 0..2) {
            val ph = (t * 0.6f + i / 3f) % 1f
            zPaint.alpha = (255 * (1f - ph)).toInt()
            zPaint.textSize = (6f + 6f * ph) * s
            val lx = 78f + ph * 12f
            val x = if (facingLeft) 100f - lx - 6f else lx
            c.drawText("z", x * s, (56f - ph * 30f) * s, zPaint)
        }
    }
}
