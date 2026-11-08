package com.fcuxum.mascota

import android.content.Context
import android.media.AudioAttributes
import android.media.SoundPool
import java.io.File
import java.util.Calendar

/** Ladridos y sonidos de Mangobeja. Si grabaste el ladrido real, se usa ese. */
class Sounds(private val ctx: Context, private val prefs: Prefs) {

    enum class S { LADRIDO, LADRIDO_DOBLE, YIP, GEMIDO }

    private val pool = SoundPool.Builder()
        .setMaxStreams(3)
        .setAudioAttributes(
            AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_GAME)
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .build()
        ).build()

    private val ids = HashMap<S, Int>()
    private var realId = 0

    init {
        ids[S.LADRIDO] = pool.load(ctx, R.raw.ladrido, 1)
        ids[S.LADRIDO_DOBLE] = pool.load(ctx, R.raw.ladrido_doble, 1)
        ids[S.YIP] = pool.load(ctx, R.raw.yip, 1)
        ids[S.GEMIDO] = pool.load(ctx, R.raw.gemido, 1)
        reloadReal()
    }

    fun reloadReal() {
        if (realId != 0) pool.unload(realId)
        realId = 0
        val f = realBarkFile(ctx)
        if (f.exists() && f.length() > 0) realId = pool.load(f.absolutePath, 1)
    }

    /** [polite] = sonido espontáneo: no suena de noche. */
    fun play(s: S, polite: Boolean = false) {
        if (!prefs.sounds) return
        if (polite) {
            val h = Calendar.getInstance().get(Calendar.HOUR_OF_DAY)
            if (h >= 22 || h < 7) return
        }
        val id = if ((s == S.LADRIDO || s == S.LADRIDO_DOBLE) && realId != 0) realId else ids[s] ?: return
        val rate = 0.92f + Math.random().toFloat() * 0.16f
        pool.play(id, 1f, 1f, 1, 0, rate)
    }

    fun release() = pool.release()

    companion object {
        fun realBarkFile(ctx: Context) = File(ctx.filesDir, "ladrido_real.m4a")
    }
}
