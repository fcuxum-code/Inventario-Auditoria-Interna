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
import android.view.Choreographer
import android.view.Gravity
import android.view.MotionEvent
import android.view.View
import android.view.ViewConfiguration
import android.view.WindowManager
import android.widget.TextView
import java.util.Calendar
import java.util.Locale
import java.util.concurrent.Executors
import kotlin.math.abs
import kotlin.math.hypot
import kotlin.random.Random

/**
 * Servicio que mantiene a la mascota viva: una ventanita transparente del tamaño
 * del perro (sin marco) que se mueve por la pantalla, y un globito de diálogo.
 */
class PetService : Service() {

    companion object {
        const val ACTION_STOP = "com.fcuxum.mascota.STOP"
        @Volatile var instance: PetService? = null
        val running get() = instance != null
        private const val CHANNEL = "mascota"
    }

    private lateinit var wm: WindowManager
    private lateinit var prefs: Prefs
    private lateinit var brain: Brain
    private lateinit var pet: PetView
    private lateinit var petLp: WindowManager.LayoutParams
    private lateinit var bubble: TextView
    private lateinit var bubbleLp: WindowManager.LayoutParams
    private val main = Handler(Looper.getMainLooper())
    private val exec = Executors.newSingleThreadExecutor()
    private var tts: TextToSpeech? = null

    private var size = 0
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
    private var lastInteraction = SystemClock.elapsedRealtime()

    private var looping = false
    private var lastFrameNs = 0L
    private var acc = 0f

    private fun dp(v: Int): Float = v * resources.displayMetrics.density
    private fun maxX() = (screenW - size).toFloat().coerceAtLeast(0f)
    private fun groundY() = (screenH - size - dp(48)).coerceAtLeast(0f)
    private fun rnd(a: Float, b: Float) = a + Random.nextFloat() * (b - a)

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
        wm = getSystemService(Context.WINDOW_SERVICE) as WindowManager
        refreshScreen()
        size = dp(96).toInt()
        x = maxX() * 0.7f
        y = groundY()
        setupPet()
        setupBubble()
        registerReceivers()
        if (prefs.speak) initTts()
        startLoop()
        main.postDelayed({ say("¡Hola! Soy ${prefs.name} 🐝🐶\nTócame para hablar conmigo.") }, 600)
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (intent?.action == ACTION_STOP) {
            stopSelf()
            return START_NOT_STICKY
        }
        return START_STICKY
    }

    override fun onDestroy() {
        looping = false
        instance = null
        try { unregisterReceiver(receiver) } catch (_: Exception) { }
        if (::pet.isInitialized) try { wm.removeView(pet) } catch (_: Exception) { }
        if (bubbleShown) try { wm.removeView(bubble) } catch (_: Exception) { }
        tts?.shutdown()
        exec.shutdownNow()
        super.onDestroy()
    }

    // ---------- notificación obligatoria ----------

    private fun startForegroundNotif() {
        val nm = getSystemService(NotificationManager::class.java)
        nm.createNotificationChannel(NotificationChannel(CHANNEL, "Mascota", NotificationManager.IMPORTANCE_LOW))
        val stop = PendingIntent.getService(
            this, 1, Intent(this, PetService::class.java).setAction(ACTION_STOP),
            PendingIntent.FLAG_IMMUTABLE
        )
        val open = PendingIntent.getActivity(
            this, 2, Intent(this, MainActivity::class.java), PendingIntent.FLAG_IMMUTABLE
        )
        val name = Prefs(this).name
        val n = Notification.Builder(this, CHANNEL)
            .setSmallIcon(R.drawable.ic_pata)
            .setContentTitle("$name está paseando por tu pantalla")
            .setContentText("Tócalo para hablar · mantenlo presionado para dormirlo")
            .setContentIntent(open)
            .setOngoing(true)
            .addAction(Notification.Action.Builder(Icon.createWithResource(this, R.drawable.ic_pata), "Guardar mascota", stop).build())
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

    private fun overlayParams(w: Int, h: Int, extra: Int) = WindowManager.LayoutParams(
        w, h,
        WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY,
        WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or
            WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN or
            WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS or extra,
        PixelFormat.TRANSLUCENT
    ).apply { gravity = Gravity.TOP or Gravity.START }

    private fun setupPet() {
        pet = PetView(this)
        petLp = overlayParams(size, size, 0)
        petLp.x = x.toInt()
        petLp.y = y.toInt()
        pet.setOnTouchListener(TouchHandler())
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
        bubbleLp = overlayParams(
            WindowManager.LayoutParams.WRAP_CONTENT, WindowManager.LayoutParams.WRAP_CONTENT, 0
        )
    }

    private val hideBubbleRunnable = Runnable { hideBubble() }

    fun say(text: String, ms: Long = -1L) {
        if (!::bubble.isInitialized) return
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
        val bx = (x + size / 2f - bw / 2f).coerceIn(m, (screenW - bw - m).coerceAtLeast(m))
        var by = y - bh + dp(4)
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
                update(acc.coerceAtMost(0.1f))
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
        stateLeft -= dt
        when (state) {
            Pose.WALK -> {
                val d = tx - x
                val step = dp(70) * dt
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
            else -> if (stateLeft <= 0f && !busy) pickNext()
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
        if (hide) hideBubble()
    }

    private fun setState(p: Pose, secs: Float) {
        state = p
        stateLeft = secs
        pet.pose = p
    }

    private fun walkTo(nx: Float) {
        tx = nx.coerceIn(0f, maxX())
        setState(Pose.WALK, 60f)
    }

    private fun flyTo(nx: Float, ny: Float, then: (() -> Unit)? = null) {
        tx = nx.coerceIn(0f, maxX())
        ty = ny.coerceIn(0f, groundY())
        onArrive = then
        setState(Pose.FLY, 60f)
    }

    private fun goHome() {
        perched = false
        flyTo(rnd(0f, maxX()), groundY()) { setState(Pose.SIT, 2f) }
    }

    /** Decide qué hacer después (comportamiento de mascota). */
    private fun pickNext() {
        pet.withToy = false
        if (quiet) {
            setState(Pose.SLEEP, 1e9f)
            return
        }
        val g = groundY()
        val onGround = abs(y - g) < dp(6)
        if (!onGround && !perched) {
            flyTo(x, g) { setState(Pose.SIT, 2f) }
            return
        }
        val idleSec = (SystemClock.elapsedRealtime() - lastInteraction) / 1000
        val h = Calendar.getInstance().get(Calendar.HOUR_OF_DAY)
        val sleepy = idleSec > 240 || h >= 22 || h < 6 || lowBattery
        val r = Random.nextFloat()
        if (sleepy && r < 0.5f) {
            if (r < 0.25f) setState(Pose.SLEEP, rnd(15f, 40f)) else setState(Pose.LIE, rnd(8f, 20f))
            return
        }
        when {
            r < 0.30f -> if (perched) goHome() else walkTo(rnd(0f, maxX()))
            r < 0.45f -> if (!perchOnRandomButton()) walkTo(rnd(0f, maxX()))
            r < 0.65f -> setState(Pose.SIT, rnd(3f, 7f))
            r < 0.77f -> setState(Pose.LIE, rnd(5f, 10f))
            r < 0.85f -> {
                pet.withToy = Random.nextBoolean()
                setState(Pose.HAPPY, 2.5f)
            }
            r < 0.92f -> {
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
        val nx = r.centerX() - size / 2f
        var ny = r.top - size * 0.86f
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
            "volar" -> {
                perched = false
                flyTo(rnd(0f, maxX()), rnd(dp(100), groundY() - dp(100))) { goHome() }
            }
            else -> {
                pet.withToy = true
                setState(Pose.HAPPY, 4f)
            }
        }
    }

    // ---------- conversación ----------

    fun openChat() {
        setState(Pose.THINK, 30f)
        val i = Intent(this, ChatActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        try { startActivity(i) } catch (_: Exception) { say("No pude abrir el chat 😿") }
    }

    fun chatCancelled() {
        if (state == Pose.THINK && !busy) setState(Pose.SIT, 2f)
    }

    fun ask(text: String) {
        lastInteraction = SystemClock.elapsedRealtime()
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

    // ---------- toques ----------

    private inner class TouchHandler : View.OnTouchListener {
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
            lastInteraction = SystemClock.elapsedRealtime()
            quiet = !quiet
            if (quiet) {
                setState(Pose.SLEEP, 1e9f)
                say("Me echo una siesta 💤 Tócame para despertarme.")
            } else {
                setState(Pose.HAPPY, 2f)
                say("¡A pasear! 🐾")
            }
        }

        private val singleTap = Runnable {
            pendingTap = false
            if (state == Pose.SLEEP || quiet) {
                quiet = false
                setState(Pose.HAPPY, 2f)
                say("¡Guau! Ya desperté 🐶")
            } else {
                openChat()
            }
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
                    lastInteraction = SystemClock.elapsedRealtime()
                    if (moved) {
                        perched = y < groundY() - dp(8)
                        setState(Pose.SIT, rnd(3f, 6f))
                    } else if (!longFired && e.actionMasked == MotionEvent.ACTION_UP) {
                        if (pendingTap) { // doble toque: ¡a jugar!
                            pendingTap = false
                            main.removeCallbacks(singleTap)
                            quiet = false
                            pet.withToy = true
                            setState(Pose.HAPPY, 4f)
                            say(listOf("¡Mi juguete! 🔴", "¡Otra vez, otra vez!", "¡Guau guau! 🐾").random())
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

    // ---------- batería y pantalla ----------

    private val receiver = object : BroadcastReceiver() {
        override fun onReceive(c: Context, i: Intent) {
            when (i.action) {
                Intent.ACTION_SCREEN_OFF -> looping = false
                Intent.ACTION_SCREEN_ON -> startLoop()
                Intent.ACTION_POWER_CONNECTED -> {
                    lowBattery = false
                    if (!busy) setState(Pose.HAPPY, 3f)
                    say("¡Ñam ñam! Gracias por la comida 🔌🦴")
                }
                Intent.ACTION_BATTERY_LOW -> {
                    lowBattery = true
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
        refreshScreen()
        x = x.coerceIn(0f, maxX())
        y = y.coerceIn(0f, groundY())
        if (!perched) y = groundY()
    }
}
