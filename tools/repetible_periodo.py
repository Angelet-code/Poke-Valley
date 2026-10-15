"""Textura repetible para suelos con un dibujo regular (adoquines, losas, ladrillo, baldosas), sin romper la rejilla.

Uso: python -I tools/repetible_periodo.py <entrada.png> <salida.png> [--size 512] [--min 0.55] [--banda 16]

quilt.py mezcla bloques sueltos y en un suelo con juntas regulares deja juntas torcidas. Aquí se recorta la imagen
(reducida a --size) a un ancho w y un alto h en los que la textura "vuelve a empezar": la columna w se parece a la 0 y
la fila h a la 0 (se busca el w y el h, entre --min·size y size, con menos diferencia en una banda de --banda px).
Después, en la primera banda, una costura de corte mínimo pasa de lo que seguía a la columna w-1 (src[:, w:w+b]) a lo
que hay en la 0 (src[:, 0:b]); igual en vertical. Así el borde derecho enlaza con el izquierdo y el de abajo con el de
arriba. Comprobación: <salida>_2x2.png con la textura repetida 2×2.
"""
import argparse

import numpy as np
from PIL import Image


def mejor_periodo(a, eje, lo, hi, b):
    """w (o h) en [lo, hi] con menos diferencia entre la banda que empieza en w y la que empieza en 0."""
    n = a.shape[eje]
    mejor, err = hi, 1e9
    for w in range(lo, min(hi, n - b) + 1):
        if eje == 1:
            e = np.abs(a[:, w:w + b] - a[:, :b]).mean()
        else:
            e = np.abs(a[w:w + b] - a[:b]).mean()
        if e < err:
            mejor, err = w, e
    return mejor, err


def costura_v(A, B):
    """Banda de A (izquierda) a B (derecha), (h, b, 3): camino vertical de menor diferencia, ±1 px por fila."""
    h, b = A.shape[:2]
    e = np.abs(A - B).sum(-1)
    e[:, 0] += 1e4
    e[:, -1] += 1e4
    acu = e.copy()
    for y in range(1, h):
        p = acu[y - 1]
        acu[y] += np.minimum(p, np.minimum(np.r_[np.inf, p[:-1]], np.r_[p[1:], np.inf]))
    cam = np.zeros(h, int)
    cam[-1] = int(np.argmin(acu[-1]))
    for y in range(h - 2, -1, -1):
        c = cam[y + 1]
        lo, hi = max(c - 1, 0), min(c + 2, b)
        cam[y] = lo + int(np.argmin(acu[y, lo:hi]))
    x = np.arange(b)[None, :]
    t = np.clip((x - cam[:, None] + 1.5) / 3, 0, 1)[..., None]   # fundido de 3 px sobre el camino
    return A * (1 - t) + B * t


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("entrada")
    ap.add_argument("salida")
    ap.add_argument("--size", type=int, default=512)
    ap.add_argument("--min", type=float, default=0.55)
    ap.add_argument("--banda", type=int, default=16)
    o = ap.parse_args()
    im = Image.open(o.entrada).convert("RGB").resize((o.size, o.size), Image.LANCZOS)
    a = np.asarray(im, np.float32)
    b = o.banda
    lo = int(o.size * o.min)
    w, ew = mejor_periodo(a, 1, lo, o.size, b)
    h, eh = mejor_periodo(a, 0, lo, o.size, b)
    # horizontal: columnas 0..b pasan de src[:, w:w+b] a src[:, 0:b]
    r = a[: h + b, :w].copy()
    r[:, :b] = costura_v(a[: h + b, w:w + b], a[: h + b, :b])
    # vertical: filas 0..b pasan de r[h:h+b] a r[0:b] (sobre la imagen ya cerrada en horizontal)
    t = costura_v(r[h:h + b].transpose(1, 0, 2), r[:b].transpose(1, 0, 2)).transpose(1, 0, 2)
    r = r[:h]
    r[:b] = t
    out = Image.fromarray(np.clip(r + 0.5, 0, 255).astype(np.uint8))
    out.save(o.salida)
    t2 = Image.new("RGB", (w * 2, h * 2))
    for i in range(2):
        for j in range(2):
            t2.paste(out, (i * w, j * h))
    t2.save(o.salida.replace(".png", "_2x2.png"))
    print(f"{o.salida} {w}x{h} (error banda {ew:.1f}, {eh:.1f})")


if __name__ == "__main__":
    main()
