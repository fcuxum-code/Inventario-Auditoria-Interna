package com.fcuxum.mascota

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.ServiceInfo
import android.content.res.Configuration
import android.graphics.PixelFormat
import android.graphics.Rect
import android.graphics.drawable.GradientDrawable
import android.graphics.drawable.Icon
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.os.SystemClock
import android.provider.Settings
import android.speech.tts.TextToSpeech
import android.util.DisplayMetrics
import android.util.Log
import android.view.Choreographer
import android.view.Gravity
import android.view.MotionEvent
import android.view.VelocityTracker
import android.view.View
import android.view.ViewConfiguration
import android.view.WindowManager
import android.widget.TextView
import java.util.Calendar
import java.util.Locale
import java.util.concurrent.Executors
import kotlin.math.PI
import kotlin.math.abs
import kotlin.math.hypot
import kotlin.math.sin
import kotlin.random.Random

/**
 * Mantiene viva a Mangobeja: una ventanita transparente del tamaño del perro (sin marco)
 * que pasea por la pantalla, un globito de diálogo y su juguete para lanzárselo.
 *
 * Profundidad: la parte de abajo de la pantalla es "cerca" (z=0) y hacia arriba es "lejos" (z=1);
 * lo que está lejos se dibuja más pequeño.
 */
class PetService : Service() {

    companion object {
        const val ACTION_STOP = "com.fcuxum.mascota.STOP"
        const val ACTION_WAKE = "com.fcuxum.mascota.WAKE"
        const val EXTRA_DEMO = "demo"
        private const val TAG = "Mangobeja"
        @Volatile var instance: PetService? = null
        val running get() = instance != null
        private const val CHANNEL = "mascota"
    }

    private lateinit var wm: WindowManager
    private lateinit var prefs: Prefs
    private lateinit var brain: Brain
    lateinit var sounds: Sounds
        private set
    private lateinit var pet: PetView
    private lateinit var petLp: WindowManager.LayoutParams
    private lateinit var bubble: TextView
    private lateinit var bubbleLp: WindowManager.LayoutParams
    private lateinit var toy: ToyView
    private lateinit var toyLp: WindowManager.LayoutParams
    private val main = Handler(Looper.getMainLooper())
    private val exec = Executors.newSingleThreadExecutor()
    private var tts: TextToSpeech? = null

    private var size = 0
    private var toySize = 0
    private var screenW = 0
    private var screenH = 0
    private var x = 0f
    private var y = 0f
    private var tx = 0f
    private var ty = 0f
    private var onArrive: (() -> Unit)? = null
    private var state = Pose.SIT
    private var stateLeft = 2f
    private var quiet = false
    private var perched = false
    private var busy = false
    private var hidden = false
    private var lowBattery = false
    private var bubbleShown = false
    private var toyShown = false
    private var lastInteraction = SystemClock.elapsedRealtime()
    private var awakeUntil = 0L
    private var nextBarkAt = SystemClock.elapsedRealtime() + 90_000L

    private var looping = false
    private var lastFrameNs = 0L
    private var acc = 0f

    private fun dp(v: Int): Float = v * resources.displayMetrics.density
    private fun maxX() = (screenW - size).toFloat().coerceAtLeast(0f)
    private fun groundY() = (screenH - size - dp(48)).coerceAtLeast(0f)
    /** "Suelo" de Mango: donde el usuario lo dejó la última vez (por defecto, abajo). */
    private var floorFrac = -1f
    private fun floor(): Float = if (floorFrac < 0f) groundY() else (floorFrac * screenH).coerceIn(dp(60), groundY())
    private fun rnd(a: Float, b: Float) = a + Random.nextFloat() * (b - a)
    private fun now() = SystemClock.elapsedRealtime()

    // ---------- profundidad ----------
    private fun depthRange() = (screenH * 0.42f).coerceAtMost(floor() - dp(40)).coerceAtLeast(dp(80))
    private fun scaleFor(z: Float) = 1f - 0.62f * z
    /** Línea del suelo (donde van las patas) a la profundidad z. */
    private fun floorLine(z: Float) = floor() + size * 0.93f - z * depthRange()
    private fun zForFloor(fy: Float) = ((floor() + size * 0.93f - fy) / depthRange()).coerceIn(0f, 1f)

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        startForegroundNotif()
        if (!Settings.canDrawOverlays(this)) {
            stopSelf()
            return
        }
        instance = this
        prefs = Prefs(this)
        brain = Brain(prefs, PhoneActions(this))
        sounds = Sounds(this, prefs)
        wm = getSystemService(Context.WINDOW_SERVICE) as WindowManager
        refreshScreen()
        size = dp(140).toInt()
        toySize = dp(60).toInt()
        floorFrac = prefs.floorFrac
        x = maxX() * 0.7f
        y = floor()
        setupPet()
        setupBubble()
        setupToy()
        registerReceivers()
        if (prefs.speak) initTts()
        startLoop()
        main.postDelayed({
            say("¡Hola! Soy ${prefs.name} 🐝🐶\nTócame para hablar · doble toque para jugar")
            sounds.play(Sounds.S.LADRIDO_DOBLE)
            setState(Pose.HAPPY, 2f)
        }, 700)
        Log.i(TAG, "servicio iniciado ${screenW}x$screenH")
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_STOP -> {
                stopSelf()
                return START_NOT_STICKY
            }
            ACTION_WAKE -> main.post { wakeUp() }
        }
        when (intent?.getStringExtra(EXTRA_DEMO)) {
            "fetch" -> main.postDelayed({ demoFetch() }, 3000)
        }
        return START_STICKY
    }

    override fun onDestroy() {
        looping = false
        instance = null
        try { unregisterReceiver(receiver) } catch (_: Exception) { }
        if (::pet.isInitialized) try { wm.removeView(pet) } catch (_: Exception) { }
        if (bubbleShown) try { wm.removeView(bubble) } catch (_: Exception) { }
        if (toyShown) try { wm.removeView(toy) } catch (_: Exception) { }
        if (::sounds.isInitialized) sounds.release()
        tts?.shutdown()
        exec.shutdownNow()
        super.onDestroy()
    }

    // ---------- notificación obligatoria ----------

    private fun startForegroundNotif() {
        val nm = getSystemService(NotificationManager::class.java)
        nm.createNotificationChannel(NotificationChannel(CHANNEL, "Mascota", NotificationManager.IMPORTANCE_LOW))
        val icon = Icon.createWithResource(this, R.drawable.ic_pata)
        val stop = PendingIntent.getService(
            this, 1, Intent(this, PetService::class.java).setAction(ACTION_STOP), PendingIntent.FLAG_IMMUTABLE
        )
        val wake = PendingIntent.getService(
            this, 3, Intent(this, PetService::class.java).setAction(ACTION_WAKE), PendingIntent.FLAG_IMMUTABLE
        )
        val open = PendingIntent.getActivity(
            this, 2, Intent(this, MainActivity::class.java), PendingIntent.FLAG_IMMUTABLE
        )
        val name = Prefs(this).name
        val n = Notification.Builder(this, CHANNEL)
            .setSmallIcon(R.drawable.ic_pata)
            .setContentTitle("$name está en tu pantalla 🐝")
            .setContentText("Toque: hablar · doble toque: jugar · mantener: dormir")
            .setContentIntent(open)
            .setOngoing(true)
            .addAction(Notification.Action.Builder(icon, "¡A jugar!", wake).build())
            .addAction(Notification.Action.Builder(icon, "Guardar", stop).build())
            .build()
        if (Build.VERSION.SDK_INT >= 34) {
            startForeground(1, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE)
        } else {
            startForeground(1, n)
        }
    }

    // ---------- ventanas ----------

    private fun refreshScreen() {
        if (Build.VERSION.SDK_INT >= 30) {
            val b = wm.currentWindowMetrics.bounds
            screenW = b.width()
            screenH = b.height()
        } else {
            val dm = DisplayMetrics()
            @Suppress("DEPRECATION")
            wm.defaultDisplay.getRealMetrics(dm)
            screenW = dm.widthPixels
            screenH = dm.heightPixels
        }
    }

    private fun overlayParams(w: Int, h: Int) = WindowManager.LayoutParams(
        w, h,
        WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY,
        WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or
            WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN or
            WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS,
        PixelFormat.TRANSLUCENT
    ).apply { gravity = Gravity.TOP or Gravity.START }

    private fun setupPet() {
        pet = PetView(this)
        pet.toyKind = prefs.toy
        petLp = overlayParams(size, size)
        petLp.x = x.toInt()
        petLp.y = y.toInt()
        pet.setOnTouchListener(PetTouch())
        wm.addView(pet, petLp)
    }

    private fun setupBubble() {
        bubble = TextView(this).apply {
            textSize = 15f
            setTextColor(0xFF222222.toInt())
            val p = dp(12).toInt()
            setPadding(p, dp(8).toInt(), p, dp(9).toInt())
            maxWidth = dp(260).toInt()
            background = GradientDrawable().apply {
                setColor(0xFFFFFFFF.toInt())
                cornerRadius = dp(16)
                setStroke(dp(2).toInt(), 0xFFF5D90A.toInt())
            }
            elevation = dp(4)
            setOnClickListener { hideBubble() }
        }
        bubbleLp = overlayParams(WindowManager.LayoutParams.WRAP_CONTENT, WindowManager.LayoutParams.WRAP_CONTENT)
    }

    private fun setupToy() {
        toy = ToyView(this)
        toyLp = overlayParams(toySize, toySize)
        toy.setOnTouchListener(ToyTouch())
    }

    private val hideBubbleRunnable = Runnable { hideBubble() }

    fun say(text: String, ms: Long = -1L) {
        if (!::bubble.isInitialized || hidden) return
        bubble.text = text
        if (!bubbleShown) {
            positionBubble()
            try { wm.addView(bubble, bubbleLp); bubbleShown = true } catch (_: Exception) { }
        }
        positionBubble()
        main.removeCallbacks(hideBubbleRunnable)
        val dur = if (ms > 0) ms else (2500L + text.length * 70L).coerceAtMost(16000L)
        main.postDelayed(hideBubbleRunnable, dur)
    }

    private fun hideBubble() {
        main.removeCallbacks(hideBubbleRunnable)
        if (bubbleShown) {
            try { wm.removeView(bubble) } catch (_: Exception) { }
            bubbleShown = false
        }
    }

    private fun positionBubble() {
        bubble.measure(
            View.MeasureSpec.makeMeasureSpec(dp(260).toInt(), View.MeasureSpec.AT_MOST),
            View.MeasureSpec.makeMeasureSpec(0, View.MeasureSpec.UNSPECIFIED)
        )
        val bw = bubble.measuredWidth
        val bh = bubble.measuredHeight
        val m = dp(8)
        val k = pet.scale
        val top = y + size * (1f - k * 0.95f) // parte de arriba del perro dibujado
        val bx = (x + size / 2f - bw / 2f).coerceIn(m, (screenW - bw - m).coerceAtLeast(m))
        var by = top - bh
        if (by < dp(28)) by = y + size
        val nx = bx.toInt()
        val ny = by.toInt()
        if (nx != bubbleLp.x || ny != bubbleLp.y) {
            bubbleLp.x = nx
            bubbleLp.y = ny
            if (bubbleShown) try { wm.updateViewLayout(bubble, bubbleLp) } catch (_: Exception) { }
        }
    }

    // ---------- bucle de animación (~30 fps) ----------

    private val frame = object : Choreographer.FrameCallback {
        override fun doFrame(now: Long) {
            if (!looping) return
            val dt = if (lastFrameNs == 0L) 0.016f else ((now - lastFrameNs) / 1e9f).coerceIn(0f, 0.1f)
            lastFrameNs = now
            acc += dt
            if (acc >= 1f / 30f) {
                try {
                    update(acc.coerceAtMost(0.1f))
                } catch (e: Exception) {
                    Log.e(TAG, "error en update", e)
                }
                acc = 0f
            }
            Choreographer.getInstance().postFrameCallback(this)
        }
    }

    private fun startLoop() {
        if (looping) return
        looping = true
        lastFrameNs = 0L
        Choreographer.getInstance().postFrameCallback(frame)
    }

    private fun update(dt: Float) {
        checkSensitive()
        checkTyping()
        stateLeft -= dt
        if (playing) {
            updatePlay(dt)
        } else {
            when (state) {
                Pose.WALK, Pose.RUN -> {
                    val d = tx - x
                    val step = dp(if (state == Pose.RUN) 200 else 75) * dt
                    if (abs(d) <= step) {
                        x = tx
                        setState(Pose.SIT, rnd(1.5f, 4f))
                    } else {
                        x += if (d > 0) step else -step
                        pet.facingLeft = d < 0
                    }
                }
                Pose.FLY -> {
                    val dx = tx - x
                    val dy = ty - y
                    val dist = hypot(dx, dy)
                    val step = dp(240) * dt
                    if (dist <= step) {
                        x = tx
                        y = ty
                        val cb = onArrive
                        onArrive = null
                        if (cb != null) cb() else setState(Pose.SIT, 2f)
                    } else {
                        x += dx / dist * step
                        y += dy / dist * step
                        if (abs(dx) > 1f) pet.facingLeft = dx < 0
                    }
                }
                Pose.DRAG -> {}
                else -> if (stateLeft <= 0f && !busy) {
                    if (typing) setState(if (Random.nextFloat() < 0.6f) Pose.SIT else Pose.LIE, rnd(4f, 8f)) else pickNext()
                }
            }
        }
        pet.pose = state
        pet.tick(dt)
        val nx = x.toInt()
        val ny = y.toInt()
        if (nx != petLp.x || ny != petLp.y) {
            petLp.x = nx
            petLp.y = ny
            try { wm.updateViewLayout(pet, petLp) } catch (_: Exception) { }
        }
        if (bubbleShown) positionBubble()
    }

    // ---------- quitarse del camino cuando escribes ----------

    private var typing = false

    /** Zona que Mango no debe tapar: el teclado y el campo donde escribes. */
    private fun petRect() = android.graphics.RectF(x, y, x + size, y + size)

    private fun checkTyping() {
        val imeTop = ScreenInfo.imeTop
        val now = imeTop > 0
        if (now && !typing) {
            typing = true
            if (playing) endPlay(false)
            onArrive = null
            val field = ScreenInfo.focusedField
            // subir a la parte de arriba, del lado contrario al campo de texto
            val leftSide = field?.let { it.centerX() > screenW / 2 } ?: (x + size / 2f > screenW / 2f)
            val nx = if (leftSide) dp(8) else maxX() - dp(8)
            var ny = dp(90)
            if (field != null && RectFIntersects(nx, ny, field)) ny = (field.bottom + dp(8)).coerceAtMost(imeTop - size.toFloat())
            flyTo(nx, ny) { setState(Pose.SIT, rnd(4f, 8f)) }
        } else if (!now && typing) {
            typing = false
            perched = false
            flyTo(x, floor()) { setState(Pose.SIT, 2f) }
        } else if (typing && state != Pose.FLY && state != Pose.DRAG) {
            // si aun así tapa el campo, moverse
            val f = ScreenInfo.focusedField
            if (f != null && RectFIntersects(x, y, f)) {
                flyTo(if (x > screenW / 2f) dp(8) else maxX() - dp(8), dp(90)) { setState(Pose.SIT, 6f) }
            }
        }
    }

    private fun RectFIntersects(px: Float, py: Float, r: Rect) =
        px < r.right && px + size > r.left && py < r.bottom && py + size > r.top

    /** Si hay una contraseña en pantalla, la mascota se esconde (y deja pasar los toques). */
    private fun checkSensitive() {
        val hide = ScreenInfo.sensitive
        if (hide == hidden) return
        hidden = hide
        petLp.alpha = if (hide) 0f else 1f
        petLp.flags = if (hide) {
            petLp.flags or WindowManager.LayoutParams.FLAG_NOT_TOUCHABLE
        } else {
            petLp.flags and WindowManager.LayoutParams.FLAG_NOT_TOUCHABLE.inv()
        }
        try { wm.updateViewLayout(pet, petLp) } catch (_: Exception) { }
        if (hide) {
            hideBubble()
            if (playing) endPlay(false)
        }
    }

    private fun setState(p: Pose, secs: Float) {
        state = p
        stateLeft = secs
        pet.pose = p
    }

    private fun walkTo(nx: Float, run: Boolean = false) {
        tx = nx.coerceIn(0f, maxX())
        setState(if (run) Pose.RUN else Pose.WALK, 60f)
    }

    private fun flyTo(nx: Float, ny: Float, then: (() -> Unit)? = null) {
        tx = nx.coerceIn(0f, maxX())
        ty = ny.coerceIn(0f, groundY())
        onArrive = then
        setState(Pose.FLY, 60f)
    }

    private fun goHome() {
        perched = false
        flyTo(rnd(0f, maxX()), floor()) { setState(Pose.SIT, 2f) }
    }

    private fun isSleepyTime(): Boolean {
        if (now() < awakeUntil) return false
        val idleSec = (now() - lastInteraction) / 1000
        val h = Calendar.getInstance().get(Calendar.HOUR_OF_DAY)
        return idleSec > 300 || h >= 22 || h < 6 || lowBattery
    }

    /** Decide qué hacer después (comportamiento de mascota). */
    private fun pickNext() {
        pet.withToy = false
        if (quiet) {
            setState(Pose.SLEEP, 1e9f)
            return
        }
        val g = floor()
        val onGround = abs(y - g) < dp(6)
        if (!onGround && !perched) {
            flyTo(x, g) { setState(Pose.SIT, 2f) }
            return
        }
        if (now() > nextBarkAt) {
            nextBarkAt = now() + (120_000L..360_000L).random()
            sounds.play(Sounds.S.LADRIDO, polite = true)
        }
        val r = Random.nextFloat()
        if (isSleepyTime() && r < 0.5f) {
            if (r < 0.25f) setState(Pose.SLEEP, rnd(15f, 40f)) else setState(Pose.LIE, rnd(8f, 20f))
            return
        }
        when {
            r < 0.32f -> if (perched) goHome() else walkTo(rnd(0f, maxX()))
            r < 0.42f -> if (perched) goHome() else walkTo(rnd(0f, maxX()), run = true)
            r < 0.54f -> if (!perchOnRandomButton()) walkTo(rnd(0f, maxX()))
            r < 0.70f -> setState(Pose.SIT, rnd(3f, 6f))
            r < 0.78f -> setState(Pose.LIE, rnd(4f, 8f))
            r < 0.87f -> {
                pet.withToy = Random.nextBoolean()
                setState(Pose.HAPPY, 2.5f)
            }
            r < 0.95f -> {
                perched = false
                flyTo(rnd(0f, maxX()), rnd(dp(100), g - dp(100))) { goHome() }
            }
            else -> setState(Pose.SLEEP, rnd(6f, 12f))
        }
    }

    private fun perchOnRandomButton(): Boolean {
        val list = ScreenInfo.clickables.filter {
            it.width() >= dp(40) && it.width() < screenW * 0.9f &&
                it.top > dp(80) && it.top < groundY() - dp(20)
        }
        if (list.isEmpty()) return false
        perchOn(list[Random.nextInt(list.size)], null, rnd(4f, 8f))
        return true
    }

    /** Vuela y se sienta encima del botón (o debajo si no cabe arriba). */
    fun perchOn(r: Rect, msg: String?, secs: Float = 12f) {
        if (playing) endPlay(false)
        val nx = r.centerX() - size / 2f
        var ny = r.top - size * 0.88f
        if (ny < dp(24)) ny = r.bottom - size * 0.1f
        flyTo(nx, ny) {
            perched = true
            setState(Pose.SIT, secs)
            if (msg != null) say(msg)
        }
    }

    fun perchOnFromAnyThread(r: Rect, msg: String?) = main.post { perchOn(r, msg) }

    fun trick(a: String) = main.post {
        when (a) {
            "dormir" -> setState(Pose.SLEEP, 20f)
            "sentarse" -> setState(Pose.SIT, 6f)
            "acostarse" -> setState(Pose.LIE, 10f)
            "ladrar" -> {
                sounds.play(Sounds.S.LADRIDO_DOBLE)
                setState(Pose.HAPPY, 2f)
            }
            "volar" -> {
                perched = false
                flyTo(rnd(0f, maxX()), rnd(dp(100), groundY() - dp(100))) { goHome() }
            }
            else -> startPlay()
        }
    }

    private fun wakeUp() {
        quiet = false
        lastInteraction = now()
        awakeUntil = now() + 5 * 60_000L
        if (state == Pose.SLEEP || state == Pose.LIE) {
            sounds.play(Sounds.S.GEMIDO)
            say(listOf("¡Guau! Ya desperté 🐶", "*bostezo* ¿Jugamos? 🟡", "¡Mango reportándose! 🐝").random())
        }
        setState(Pose.HAPPY, 2f)
    }

    // =====================================================================
    //  JUEGO: lanzarle el juguete
    // =====================================================================

    private enum class ToyState { GROUND, DRAG, FLY, BOUNCE, CARRIED }
    private enum class DogPhase { WAIT, CHASE, PICK, RETURN }

    private var playing = false
    private var toyState = ToyState.GROUND
    private var dogPhase = DogPhase.WAIT
    private var dz = 0f          // profundidad del perro
    private var toyCx = 0f       // centro x del juguete
    private var toyZ = 0f        // profundidad del juguete
    private var toyH = 0f        // altura sobre el suelo (px, a escala cercana)
    private var flyT = 0f
    private var flyDur = 1f
    private var flyX0 = 0f; private var flyX1 = 0f
    private var flyZ0 = 0f; private var flyZ1 = 0f
    private var flyHmax = 0f
    private var playIdle = 0f
    private var homeCx = 0f
    private var phaseT = 0f

    private fun dogCx() = x + size / 2f

    private fun startPlay() {
        if (playing) return
        playing = true
        perched = false
        quiet = false
        awakeUntil = now() + 10 * 60_000L
        lastInteraction = now()
        onArrive = null
        dz = 0f
        y = floor()
        homeCx = dogCx()
        pet.toyKind = prefs.toy
        toy.kind = prefs.toy
        dropToyInFront()
        sounds.play(Sounds.S.LADRIDO_DOBLE)
        say("¡Va pues, a jugar! Desliza el juguete hacia arriba para lanzármelo 👆")
    }

    private fun endPlay(talk: Boolean = true) {
        if (!playing) return
        playing = false
        hideToy()
        dz = 0f
        pet.scale = 1f
        y = floor()
        pet.withToy = true
        setState(Pose.LIE, 4f)
        if (talk) say("¡Uf, qué chilero! Ya me cansé 😮‍💨")
    }

    private fun dropToyInFront() {
        val dir = if (pet.facingLeft) -1f else 1f
        toyCx = (dogCx() + dir * size * 0.55f).coerceIn(toySize / 2f, screenW - toySize / 2f)
        toyZ = dz
        toyH = 0f
        toyState = ToyState.GROUND
        dogPhase = DogPhase.WAIT
        pet.withToy = false
        playIdle = 0f
        setState(Pose.SIT, 1e9f)
        showToy()
    }

    private fun showToy() {
        positionToy()
        if (!toyShown) {
            try { wm.addView(toy, toyLp); toyShown = true } catch (e: Exception) { Log.e(TAG, "toy", e) }
        }
    }

    private fun hideToy() {
        if (toyShown) {
            try { wm.removeView(toy) } catch (_: Exception) { }
            toyShown = false
        }
    }

    private fun positionToy() {
        val k = scaleFor(toyZ)
        toy.scale = k
        val bottom = floorLine(toyZ) - toyH * k + toySize * 0.06f
        toyLp.x = (toyCx - toySize / 2f).toInt()
        toyLp.y = (bottom - toySize).toInt()
        toy.invalidate()
        if (toyShown) try { wm.updateViewLayout(toy, toyLp) } catch (_: Exception) { }
    }

    /** Lanza el juguete con una velocidad (px/s) como la del dedo. */
    private fun throwToy(vx: Float, vy: Float) {
        flyX0 = toyCx
        flyZ0 = toyZ
        flyZ1 = (toyZ + (-vy) / dp(2400)).coerceIn(0f, 1f)
        flyX1 = (toyCx + vx * 0.35f).coerceIn(toySize / 2f, screenW - toySize / 2f)
        val speed = hypot(vx, vy)
        flyHmax = (dp(90) + speed * 0.06f).coerceAtMost(dp(260))
        flyDur = (0.55f + abs(flyZ1 - flyZ0) * 0.6f + abs(flyX1 - flyX0) / screenW * 0.4f).coerceIn(0.5f, 1.3f)
        flyT = 0f
        toyState = ToyState.FLY
        dogPhase = DogPhase.CHASE
        phaseT = 0f
        homeCx = dogCx()
        sounds.play(Sounds.S.YIP)
        hideBubble()
        Log.i(TAG, "lanzado: z ${"%.2f".format(flyZ1)} x ${flyX1.toInt()}")
    }

    private fun updatePlay(dt: Float) {
        // --- juguete ---
        when (toyState) {
            ToyState.FLY -> {
                flyT += dt
                val p = (flyT / flyDur).coerceAtMost(1f)
                toyCx = flyX0 + (flyX1 - flyX0) * p
                toyZ = flyZ0 + (flyZ1 - flyZ0) * p
                toyH = flyHmax * sin(PI.toFloat() * p)
                toy.rot += 540f * dt
                if (p >= 1f) {
                    toyState = ToyState.BOUNCE
                    flyT = 0f
                }
                positionToy()
            }
            ToyState.BOUNCE -> {
                flyT += dt
                val p = (flyT / 0.35f).coerceAtMost(1f)
                toyH = dp(22) * sin(PI.toFloat() * p)
                toy.rot += 200f * dt
                if (p >= 1f) {
                    toyH = 0f
                    toyState = ToyState.GROUND
                }
                positionToy()
            }
            else -> {}
        }

        // --- perro ---
        phaseT += dt
        when (dogPhase) {
            DogPhase.WAIT -> {
                if (toyState == ToyState.GROUND) {
                    playIdle += dt
                    // si el juguete quedó lejos (lo arrastraron), ir por él
                    val far = abs(toyCx - dogCx()) > size * 0.9f || abs(toyZ - dz) > 0.12f
                    if (far && toyShown) {
                        dogPhase = DogPhase.CHASE
                        phaseT = 0f
                    } else if (playIdle > 30f) {
                        endPlay()
                        return
                    } else if (playIdle % 9f < dt) {
                        sounds.play(Sounds.S.YIP)
                        setState(Pose.HAPPY, 1.2f)
                    }
                    if (state == Pose.HAPPY && stateLeft <= 0f) setState(Pose.SIT, 1e9f)
                    if (state == Pose.SIT && toyShown) pet.facingLeft = toyCx < dogCx()
                }
            }
            DogPhase.CHASE -> {
                if (phaseT < 0.25f) {
                    setState(Pose.HAPPY, 1f)
                } else {
                    val dir = if (toyCx >= dogCx()) 1f else -1f
                    val targetCx = toyCx - dir * size * 0.32f * scaleFor(toyZ)
                    if (moveDogTowards(targetCx, if (toyState == ToyState.GROUND) toyZ else flyZ1, dt, dp(330))) {
                        if (toyState == ToyState.GROUND) {
                            dogPhase = DogPhase.PICK
                            phaseT = 0f
                            toyState = ToyState.CARRIED
                            hideToy()
                            pet.withToy = true
                            pet.facingLeft = dir < 0
                            setState(Pose.HAPPY, 0.6f)
                        } else {
                            setState(Pose.HAPPY, 1f) // esperando que caiga
                        }
                    }
                }
            }
            DogPhase.PICK -> {
                if (phaseT > 0.6f) {
                    dogPhase = DogPhase.RETURN
                    phaseT = 0f
                }
            }
            DogPhase.RETURN -> {
                if (moveDogTowards(homeCx.coerceIn(size / 2f, screenW - size / 2f), 0f, dt, dp(280))) {
                    sounds.play(Sounds.S.LADRIDO)
                    say(listOf("¡Otra vez, otra vez! 🟡", "¡Aquí está! Lánzalo de nuevo 🐾", "¡Guau! ¿Más lejos? 😝", "¡Qué chilero! Otra 🙌").random())
                    dropToyInFront()
                    setState(Pose.HAPPY, 1.5f)
                }
            }
        }
        // aplicar posición con profundidad
        pet.scale = scaleFor(dz)
        y = floorLine(dz) - size * 0.93f
    }

    /** Mueve al perro en (x, profundidad). Devuelve true al llegar. */
    private fun moveDogTowards(targetCx: Float, targetZ: Float, dt: Float, speed: Float): Boolean {
        val dx = targetCx - dogCx()
        val dzp = (targetZ - dz) * depthRange()
        val dist = hypot(dx, dzp)
        val step = speed * dt * (0.55f + 0.45f * scaleFor(dz))
        if (dist <= step || dist < 2f) {
            x = targetCx - size / 2f
            dz = targetZ
            return true
        }
        x += dx / dist * step
        dz += (dzp / dist * step) / depthRange()
        if (abs(dx) > 2f) pet.facingLeft = dx < 0
        setState(Pose.RUN, 1e9f)
        return false
    }

    /** Para la prueba automática: saca el juguete y lo lanza solo. */
    private fun demoFetch() {
        startPlay()
        main.postDelayed({ if (playing) throwToy(dp(250), -dp(2600)) }, 2500)
        main.postDelayed({ if (playing && dogPhase == DogPhase.WAIT) throwToy(-dp(500), -dp(1200)) }, 11000)
    }

    // ---------- conversación ----------

    fun openChat() {
        if (playing) endPlay(false)
        setState(Pose.THINK, 30f)
        val i = Intent(this, ChatActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        try { startActivity(i) } catch (_: Exception) { say("No pude abrir el chat 😿") }
    }

    fun chatCancelled() {
        if (state == Pose.THINK && !busy) setState(Pose.SIT, 2f)
    }

    fun ask(text: String) {
        lastInteraction = now()
        awakeUntil = now() + 5 * 60_000L
        busy = true
        setState(Pose.THINK, 1e9f)
        say("🤔 …", 90_000)
        exec.execute {
            val ans = try {
                brain.ask(text)
            } catch (e: Exception) {
                brain.reset()
                "Ups, algo falló: ${e.message?.take(80)}"
            }
            main.post {
                busy = false
                if (state == Pose.THINK) setState(Pose.HAPPY, 1.5f)
                say(ans)
                speak(ans)
                if (Random.nextFloat() < 0.25f) sounds.play(Sounds.S.YIP)
            }
        }
    }

    private fun initTts() {
        tts = TextToSpeech(this) { status ->
            if (status == TextToSpeech.SUCCESS) tts?.language = Locale("es")
        }
    }

    private fun speak(text: String) {
        if (!prefs.speak) return
        if (tts == null) {
            initTts()
            return
        }
        val clean = text.replace(Regex("[^\\p{L}\\p{N}\\p{P}\\s]"), "")
        tts?.speak(clean, TextToSpeech.QUEUE_FLUSH, null, "mascota")
    }

    fun reloadSounds() = main.post { if (::sounds.isInitialized) sounds.reloadReal() }

    // ---------- toques sobre el perro ----------

    private inner class PetTouch : View.OnTouchListener {
        private var downX = 0f
        private var downY = 0f
        private var startX = 0f
        private var startY = 0f
        private var moved = false
        private var longFired = false
        private var pendingTap = false
        private val slop = ViewConfiguration.get(this@PetService).scaledTouchSlop

        private val longPress = Runnable {
            longFired = true
            lastInteraction = now()
            if (playing) endPlay(false)
            quiet = !quiet
            if (quiet) {
                setState(Pose.SLEEP, 1e9f)
                say("Me echo una siesta 💤 Tócame para despertarme.")
            } else {
                wakeUp()
            }
        }

        private val singleTap = Runnable {
            pendingTap = false
            if (state == Pose.SLEEP || quiet) wakeUp() else openChat()
        }

        override fun onTouch(v: View, e: MotionEvent): Boolean {
            when (e.actionMasked) {
                MotionEvent.ACTION_DOWN -> {
                    downX = e.rawX; downY = e.rawY
                    startX = x; startY = y
                    moved = false; longFired = false
                    main.postDelayed(longPress, 600)
                }
                MotionEvent.ACTION_MOVE -> {
                    val dx = e.rawX - downX
                    val dy = e.rawY - downY
                    if (!moved && hypot(dx, dy) > slop) {
                        moved = true
                        main.removeCallbacks(longPress)
                        if (playing) endPlay(false)
                        onArrive = null
                        setState(Pose.DRAG, 1e9f)
                    }
                    if (moved) {
                        x = (startX + dx).coerceIn(0f, maxX())
                        y = (startY + dy).coerceIn(0f, groundY())
                    }
                }
                MotionEvent.ACTION_UP, MotionEvent.ACTION_CANCEL -> {
                    main.removeCallbacks(longPress)
                    lastInteraction = now()
                    if (moved) {
                        // donde lo dejes, ahí se queda: ese es su nuevo suelo
                        perched = false
                        floorFrac = if (y >= groundY() - dp(8)) -1f else y / screenH
                        prefs.floorFrac = floorFrac
                        if (floorFrac < 0f) y = groundY()
                        setState(Pose.SIT, rnd(3f, 6f))
                    } else if (!longFired && e.actionMasked == MotionEvent.ACTION_UP) {
                        if (pendingTap) { // doble toque: ¡a jugar!
                            pendingTap = false
                            main.removeCallbacks(singleTap)
                            if (playing) endPlay() else startPlay()
                        } else {
                            pendingTap = true
                            main.postDelayed(singleTap, 280)
                        }
                    }
                }
            }
            return true
        }
    }

    // ---------- toques sobre el juguete ----------

    private inner class ToyTouch : View.OnTouchListener {
        private var vt: VelocityTracker? = null
        private var offX = 0f
        private var offY = 0f

        override fun onTouch(v: View, e: MotionEvent): Boolean {
            if (toyState != ToyState.GROUND && toyState != ToyState.DRAG) return true
            val ev = MotionEvent.obtain(e)
            ev.setLocation(e.rawX, e.rawY)
            when (e.actionMasked) {
                MotionEvent.ACTION_DOWN -> {
                    vt?.recycle()
                    vt = VelocityTracker.obtain()
                    vt?.addMovement(ev)
                    offX = toyCx - e.rawX
                    offY = (floorLine(toyZ) - toyH) - e.rawY
                    toyState = ToyState.DRAG
                    lastInteraction = now()
                    playIdle = 0f
                }
                MotionEvent.ACTION_MOVE -> {
                    vt?.addMovement(ev)
                    toyCx = (e.rawX + offX).coerceIn(toySize / 2f, screenW - toySize / 2f)
                    toyZ = zForFloor(e.rawY + offY)
                    toyH = 0f
                    positionToy()
                }
                MotionEvent.ACTION_UP, MotionEvent.ACTION_CANCEL -> {
                    vt?.addMovement(ev)
                    vt?.computeCurrentVelocity(1000)
                    val vx = vt?.xVelocity ?: 0f
                    val vy = vt?.yVelocity ?: 0f
                    vt?.recycle()
                    vt = null
                    if (hypot(vx, vy) > dp(700)) {
                        throwToy(vx, vy)
                    } else {
                        toyState = ToyState.GROUND // lo soltó: el perro irá por él si quedó lejos
                    }
                }
            }
            ev.recycle()
            return true
        }
    }

    // ---------- batería y pantalla ----------

    private val receiver = object : BroadcastReceiver() {
        override fun onReceive(c: Context, i: Intent) {
            when (i.action) {
                Intent.ACTION_SCREEN_OFF -> looping = false
                Intent.ACTION_SCREEN_ON -> startLoop()
                Intent.ACTION_POWER_CONNECTED -> {
                    lowBattery = false
                    if (!busy && !playing) setState(Pose.HAPPY, 3f)
                    sounds.play(Sounds.S.YIP, polite = true)
                    say("¡Ñam ñam! Gracias por la comida 🔌🦴")
                }
                Intent.ACTION_BATTERY_LOW -> {
                    lowBattery = true
                    sounds.play(Sounds.S.GEMIDO, polite = true)
                    say("Tengo poquita energía… ¿me cargas? 🔋")
                }
                Intent.ACTION_BATTERY_OKAY -> lowBattery = false
            }
        }
    }

    private fun registerReceivers() {
        val f = IntentFilter().apply {
            addAction(Intent.ACTION_SCREEN_OFF)
            addAction(Intent.ACTION_SCREEN_ON)
            addAction(Intent.ACTION_POWER_CONNECTED)
            addAction(Intent.ACTION_BATTERY_LOW)
            addAction(Intent.ACTION_BATTERY_OKAY)
        }
        if (Build.VERSION.SDK_INT >= 33) {
            registerReceiver(receiver, f, Context.RECEIVER_NOT_EXPORTED)
        } else {
            registerReceiver(receiver, f)
        }
    }

    override fun onConfigurationChanged(newConfig: Configuration) {
        super.onConfigurationChanged(newConfig)
        if (!::pet.isInitialized) return
        if (playing) endPlay(false)
        refreshScreen()
        x = x.coerceIn(0f, maxX())
        y = y.coerceIn(0f, groundY())
        if (!perched) y = floor()
    }
}
