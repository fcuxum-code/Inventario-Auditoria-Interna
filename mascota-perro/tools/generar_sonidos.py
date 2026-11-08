"""Genera los sonidos sintetizados de Mangobeja (ladridos, yip, gemido) como WAV mono 22 kHz.
Uso: python3 tools/generar_sonidos.py app/src/main/res/raw
"""
import math, random, struct, sys, wave

SR = 22050
random.seed(7)


def biquad_bp(x, fc_fn, q):
    """Pasa-banda con frecuencia central variable en el tiempo."""
    y = [0.0] * len(x)
    x1 = x2 = y1 = y2 = 0.0
    for n, xn in enumerate(x):
        fc = fc_fn(n / SR)
        w0 = 2 * math.pi * fc / SR
        alpha = math.sin(w0) / (2 * q)
        b0, b2 = alpha, -alpha
        a0, a1, a2 = 1 + alpha, -2 * math.cos(w0), 1 - alpha
        yn = (b0 * xn + b2 * x2 - a1 * y1 - a2 * y2) / a0
        x2, x1 = x1, xn
        y2, y1 = y1, yn
        y[n] = yn
    return y


def voice(dur, f0_fn, env_fn, noise=0.3, formants=((900, 3.0, 1.0), (2300, 4.0, 0.5)), f1_glide=None):
    n = int(dur * SR)
    src = []
    ph = 0.0
    for i in range(n):
        t = i / SR
        f0 = f0_fn(t)
        ph += 2 * math.pi * f0 / SR
        s = sum(math.sin(k * ph) / k for k in range(1, 14))
        s += noise * (random.random() * 2 - 1)
        src.append(s * env_fn(t))
    out = [0.0] * n
    for fc, q, g in formants:
        fn = (lambda t, fc=fc: fc) if f1_glide is None or fc != formants[0][0] else f1_glide
        band = biquad_bp(src, fn, q)
        for i in range(n):
            out[i] += g * band[i]
    return out


def lerp(a, b, p):
    return a + (b - a) * max(0.0, min(1.0, p))


def bark(scale=1.0):
    dur = 0.24
    f0 = lambda t: lerp(380, 540, t / 0.025) if t < 0.025 else lerp(540, 300, (t - 0.025) / 0.2)
    env = lambda t: min(1.0, t / 0.008) * math.exp(-max(0.0, t - 0.03) * 14)
    f1 = lambda t: lerp(450, 950, t / 0.05)
    return voice(dur, lambda t: f0(t) * scale, env, noise=0.45, f1_glide=f1)


def yip():
    dur = 0.13
    f0 = lambda t: lerp(800, 1150, t / 0.03) if t < 0.03 else lerp(1150, 700, (t - 0.03) / 0.1)
    env = lambda t: min(1.0, t / 0.005) * math.exp(-max(0.0, t - 0.02) * 22)
    return voice(dur, f0, env, noise=0.2, formants=((1400, 3.0, 1.0), (3000, 4.0, 0.4)))


def whine():
    dur = 0.75
    f0 = lambda t: (lerp(650, 950, t / 0.3) if t < 0.3 else lerp(950, 600, (t - 0.3) / 0.45)) * (1 + 0.02 * math.sin(2 * math.pi * 7 * t))
    env = lambda t: min(1.0, t / 0.06) * min(1.0, (dur - t) / 0.15)
    return voice(dur, f0, env, noise=0.05, formants=((1300, 2.0, 1.0), (2600, 3.0, 0.3)))


def silence(s):
    return [0.0] * int(s * SR)


def save(path, x, peak=0.85):
    m = max(abs(v) for v in x) or 1.0
    with wave.open(path, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(b"".join(struct.pack("<h", int(v / m * peak * 32767)) for v in x))


if __name__ == "__main__":
    d = sys.argv[1]
    save(f"{d}/ladrido.wav", bark())
    save(f"{d}/ladrido_doble.wav", bark() + silence(0.08) + bark(1.12))
    save(f"{d}/yip.wav", yip())
    save(f"{d}/gemido.wav", whine(), peak=0.6)
    print("ok")
