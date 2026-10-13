"""Textura repetible de suelo sacada directamente de la imagen de referencia.

Uso: python -I tools/quilt.py <ref.png> <salida.png> --kind sand|grass|flag
         [--size 512] [--block 96] [--scale 0.5625] [--seed 1] [--mask-out m.png]

Image quilting (Efros y Freeman) sobre un lienzo que enlaza en los bordes:
1. Clasifica cada píxel de la referencia por color (arena o césped) y toma
   como candidatos los bloques de --block px casi enteros de esa clase (sin
   árboles, rocas ni agua), también volteados.
2. Recorre el lienzo en una rejilla con solape. En cada casilla elige, entre
   los candidatos que mejor casan con lo ya pintado en el solape, uno al azar;
   después corta por el camino de mínimo error en cada lado ya pintado (con
   envoltura, así la última fila y columna casan con la primera) y funde el
   corte 1-2 px.
3. Reduce por --scale (la escala a la que se vio la referencia en la maqueta).
Los colores no se tocan: es la pintura original de la referencia.
"""
import argparse
import random

import numpy as np
from PIL import Image, ImageFilter


def class_mask(a, kind):
    r, g, b = (a[..., i].astype(int) for i in range(3))
    if kind in ("sand", "flag"):
        return (r > g + 4) & (r > 165) & (b < r - 45)
    return (g > r + 8) & (g > b + 40) & (g > 140)


def candidates(a, kind, block, step=6):
    # Arena: se aceptan ventanas con un poco de otra clase, pero no las del
    # camino de losas (más claras): solo la tierra lisa. Césped: muy estricto
    # para no arrastrar las piedrecitas sueltas.
    # Losas: lo contrario que la arena, solo las ventanas claras del camino.
    ok = 0.998 if kind == "grass" else 0.95
    m = class_mask(a, kind)
    S = np.pad(m.cumsum(0).cumsum(1), ((1, 0), (1, 0)))
    out = []
    h, w = m.shape
    for y in range(0, h - block, step):
        for x in range(0, w - block, step):
            n = S[y + block, x + block] - S[y, x + block] - S[y + block, x] + S[y, x]
            if n >= ok * block * block:
                p = a[y:y + block, x:x + block].astype(np.float32)
                if kind == "sand" and p[..., 0].mean() > 196:
                    continue
                if kind == "flag" and p[..., 0].mean() <= 200:
                    continue
                out += [p, p[:, ::-1]]
    return np.stack(out), m


def min_cut(e):
    """Camino vertical de mínimo error en e (filas x columnas). Devuelve la columna por fila."""
    h, w = e.shape
    c = e.copy()
    for y in range(1, h):
        prev = c[y - 1]
        best = np.minimum(prev, np.minimum(np.r_[np.inf, prev[:-1]], np.r_[prev[1:], np.inf]))
        c[y] += best
    path = np.zeros(h, int)
    path[-1] = int(np.argmin(c[-1]))
    for y in range(h - 2, -1, -1):
        x = path[y + 1]
        lo, hi = max(0, x - 1), min(w, x + 2)
        path[y] = lo + int(np.argmin(c[y, lo:hi]))
    return path


def main():
    a = argparse.ArgumentParser()
    a.add_argument("ref")
    a.add_argument("dst")
    a.add_argument("--kind", choices=["sand", "grass", "flag"], required=True)
    a.add_argument("--size", type=int, default=512)
    a.add_argument("--block", type=int, default=96)
    a.add_argument("--scale", type=float, default=0.5625)
    a.add_argument("--seed", type=int, default=1)
    a.add_argument("--mask-out")
    o = a.parse_args()
    rng = random.Random(o.seed)
    ref = np.asarray(Image.open(o.ref).convert("RGB"))
    B = o.block
    O = B // 3
    s = B - O
    n = max(2, round(o.size / s))
    size = n * s
    cands, m = candidates(ref, o.kind, B)
    print(len(cands), "candidatos")
    if o.mask_out:
        Image.fromarray((m * 255).astype(np.uint8)).save(o.mask_out)

    canvas = np.zeros((size, size, 3), np.float32)
    filled = np.zeros((size, size), bool)
    used = np.zeros(len(cands))
    for j in range(n):
        for i in range(n):
            ys = (j * s + np.arange(B)) % size
            xs = (i * s + np.arange(B)) % size
            old, f = canvas[np.ix_(ys, xs)], filled[np.ix_(ys, xs)]
            if f.any():
                err = (((cands - old) ** 2).sum(-1) * f).sum((1, 2))
                # Entre los que mejor casan, uno al azar (y penalizando repetir),
                # para conservar las manchas de la referencia y no quedarse con
                # el bloque más plano.
                err = err * (1 + 0.5 * used)
                good = np.argsort(err)[:max(1, len(cands) // 6)]
            else:
                good = np.arange(len(cands))
            k = rng.choice(list(good))
            used[k] += 1
            cand = cands[k]
            e = ((cand - old) ** 2).sum(-1)
            keep = np.ones((B, B), np.float32)
            if f[:, :O].all():  # izquierda
                p = min_cut(e[:, :O])
                for y in range(B):
                    keep[y, :p[y]] = 0
            if f[:, -O:].all():  # derecha (envoltura)
                p = min_cut(e[:, -O:])
                for y in range(B):
                    keep[y, B - O + p[y] + 1:] = 0
            if f[:O, :].all():  # arriba
                p = min_cut(e[:O, :].T)
                for x in range(B):
                    keep[:p[x], x] = 0
            if f[-O:, :].all():  # abajo (envoltura)
                p = min_cut(e[-O:, :].T)
                for x in range(B):
                    keep[B - O + p[x] + 1:, x] = 0
            keep = np.asarray(Image.fromarray((keep * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(1.2)),
                              np.float32)[..., None] / 255
            keep = np.where(f[..., None], keep, 1.0)
            canvas[np.ix_(ys, xs)] = old * (1 - keep) + cand * keep
            filled[np.ix_(ys, xs)] = True

    img = Image.fromarray(canvas.clip(0, 255).astype(np.uint8))
    # Reducir con la textura repetida 3x3 y quedarse con el centro: así el
    # filtro también enlaza en los bordes.
    big = Image.new("RGB", (size * 3, size * 3))
    for bx in range(3):
        for by in range(3):
            big.paste(img, (bx * size, by * size))
    t = round(size * o.scale)
    out = big.resize((t * 3, t * 3), Image.LANCZOS).crop((t, t, 2 * t, 2 * t))
    out.save(o.dst)
    print(o.dst, out.size)


if __name__ == "__main__":
    main()
