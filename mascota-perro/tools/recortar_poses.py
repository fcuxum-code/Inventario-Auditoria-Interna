"""Recorta la hoja de poses de Mangobeja (fondo blanco) en sprites PNG con transparencia.
Uso: python3 tools/recortar_poses.py arte/mangobeja-poses.jpg app/src/main/res/drawable-nodpi
Orden (filas de izquierda a derecha): sentado, caminar1, caminar2, feliz, aro, acostado,
dormido, escuchando, volando.
"""
import sys
from collections import deque
import numpy as np
from PIL import Image

NAMES = ["mango_sentado", "mango_caminar1", "mango_caminar2", "mango_feliz", "mango_aro",
         "mango_acostado", "mango_dormido", "mango_escuchando", "mango_volando"]
OUT_H = 420  # alto del lienzo final (px)
DIL = 0  # dilatación para unir piezas sueltas
SCALE = 0.6  # tamaño final respecto al original (todas las poses con la misma escala)

src, out_dir = sys.argv[1], sys.argv[2]
im = Image.open(src).convert("RGB")
a = np.asarray(im).astype(np.int16)
H, W, _ = a.shape
mn = a.min(axis=2)
mx = a.max(axis=2)
whiteish = (mn > 228) & (mx - mn < 22)

# 1) fondo = blanco conectado con los bordes (en baja resolución para que sea rápido)
S = 4
small = whiteish[::S, ::S]
h, w = small.shape
bg = np.zeros_like(small)
q = deque()
for y in range(h):
    for x in (0, w - 1):
        if small[y, x] and not bg[y, x]:
            bg[y, x] = True; q.append((y, x))
for x in range(w):
    for y in (0, h - 1):
        if small[y, x] and not bg[y, x]:
            bg[y, x] = True; q.append((y, x))
while q:
    y, x = q.popleft()
    for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
        ny, nx = y + dy, x + dx
        if 0 <= ny < h and 0 <= nx < w and small[ny, nx] and not bg[ny, nx]:
            bg[ny, nx] = True; q.append((ny, nx))
# huecos blancos encerrados y grandes (p. ej. el centro del aro) también son fondo
very = (mn[::S, ::S] > 240) & (mx[::S, ::S] - mn[::S, ::S] < 15) & ~bg
seen = np.zeros_like(very)
for y in range(h):
    for x in range(w):
        if very[y, x] and not seen[y, x]:
            q = deque([(y, x)]); seen[y, x] = True; pts = []
            while q:
                cy, cx = q.popleft(); pts.append((cy, cx))
                for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    ny, nx = cy + dy, cx + dx
                    if 0 <= ny < h and 0 <= nx < w and very[ny, nx] and not seen[ny, nx]:
                        seen[ny, nx] = True; q.append((ny, nx))
            if len(pts) > 25:
                for cy, cx in pts:
                    bg[cy, cx] = True
# ampliar un poco el fondo para cubrir el borde escalonado; el alfa suave decide la opacidad real
grow = bg.copy()
for _ in range(2):
    g = grow.copy()
    g[1:, :] |= grow[:-1, :]; g[:-1, :] |= grow[1:, :]; g[:, 1:] |= grow[:, :-1]; g[:, :-1] |= grow[:, 1:]
    grow = g
bg_full = np.repeat(np.repeat(grow, S, axis=0), S, axis=1)[:H, :W]

# alfa suave: dentro del fondo, la opacidad depende de qué tan lejos está del blanco
dist = (255 - mn).astype(np.float32)
alpha = np.where(bg_full, np.clip((dist - 10) / 40.0, 0, 1), 1.0)
fg = alpha > 0.1

# 2) componentes (un perro cada uno), en baja resolución con dilatación para unir antenas/alas
fs = fg[::S, ::S]
dil = fs.copy()
for _ in range(DIL):
    d = dil.copy()
    d[1:, :] |= dil[:-1, :]; d[:-1, :] |= dil[1:, :]; d[:, 1:] |= dil[:, :-1]; d[:, :-1] |= dil[:, 1:]
    dil = d
lab = np.zeros(dil.shape, np.int32)
comps = []
n = 0
for y in range(dil.shape[0]):
    for x in range(dil.shape[1]):
        if dil[y, x] and not lab[y, x]:
            n += 1
            lab[y, x] = n
            q = deque([(y, x)]); cnt = 0
            ys, xs = [], []
            while q:
                cy, cx = q.popleft(); cnt += 1; ys.append(cy); xs.append(cx)
                for dy in (-1, 0, 1):
                    for dx in (-1, 0, 1):
                        ny, nx = cy + dy, cx + dx
                        if 0 <= ny < dil.shape[0] and 0 <= nx < dil.shape[1] and dil[ny, nx] and not lab[ny, nx]:
                            lab[ny, nx] = n; q.append((ny, nx))
            comps.append((cnt, n, min(ys), max(ys), min(xs), max(xs)))
comps.sort(reverse=True)
big = [c for c in comps if c[0] > 2000][:9]
small_c = [c for c in comps if c not in big]
# piezas sueltas (antenas, alas) -> al perro más cercano
for c in small_c:
    cy, cx = (c[2] + c[3]) / 2, (c[4] + c[5]) / 2
    def d(b):
        dy = 0 if b[2] <= cy <= b[3] else min(abs(cy - b[2]), abs(cy - b[3]))
        dx = 0 if b[4] <= cx <= b[5] else min(abs(cx - b[4]), abs(cx - b[5]))
        return dy * dy + dx * dx
    tgt = min(big, key=d)
    if d(tgt) < 40 ** 2:
        lab[lab == c[1]] = tgt[1]
print("componentes:", len(comps), "tamaños:", [c[0] for c in big])
# ordenar por fila y luego por columna
cell = H / 3
big.sort(key=lambda c: (int(((c[2] + c[3]) / 2 * S) // cell), (c[4] + c[5]) / 2))
lab_full = np.repeat(np.repeat(lab, S, axis=0), S, axis=1)[:H, :W]

rgba = np.dstack([a.astype(np.uint8), (alpha * 255).astype(np.uint8)])
scale_ref = None
for name, c in zip(NAMES, big):
    _, lid, y0, y1, x0, x1 = c
    m = (lab_full == lid) & fg
    ys, xs = np.where(m)
    Y0, Y1, X0, X1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
    crop = rgba[Y0:Y1, X0:X1].copy()
    crop[..., 3] = np.where(m[Y0:Y1, X0:X1], crop[..., 3], 0)
    img = Image.fromarray(crop, "RGBA")
    img = img.resize((round(img.width * SCALE), round(img.height * SCALE)), Image.LANCZOS)
    print(name, img.size)
    img.save(f"{out_dir}/{name}.png", optimize=True)
