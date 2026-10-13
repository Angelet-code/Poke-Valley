"""Corrige figuras geométricas en un sprite de pixel art: busca círculos dibujados "a ojo" por la IA
(contornos oscuros con dobles y bultos) con una transformada de Hough y los sustituye por el círculo
clásico de pixel art (1 px de grosor, sin dobles), rellenando lo que sobra con los colores vecinos.
Las líneas rectas y otros trazos oscuros (banda, botón...) se respetan.

Uso: python -I tools/pixel_geom.py in.png out.png [--line-lum 60] [--min-d 5] [--cover 0.8]
     [--preview out_x8.png]
  --line-lum  luminancia máxima de los colores de línea (como pixel_clean).
  --min-d     diámetro mínimo a buscar.
  --cover     fracción mínima del anillo clásico que debe estar cubierta por píxeles oscuros.
Imprime cada círculo sustituido: centro, diámetro, cobertura. Aplicar ANTES de pixel_clean.py.
Centro: píxel entero si el diámetro es impar, esquina (x.5) si es par, como en pixel art clásico.
"""
import argparse
import sys

import numpy as np
from PIL import Image
from scipy import ndimage

CROSS = np.array([[0, 1, 0], [1, 1, 1], [0, 1, 0]])


def lum(rgb):
    return 0.299 * rgb[..., 0] + 0.587 * rgb[..., 1] + 0.114 * rgb[..., 2]


def disc_mask(h, w, cx, cy, r):
    yy, xx = np.mgrid[0:h, 0:w]
    return (xx - cx) ** 2 + (yy - cy) ** 2 <= r * r


def classic_ring(h, w, cx, cy, d):
    """Anillo de 1 px del círculo clásico de diámetro entero d (disco menos su erosión en cruz)."""
    disc = disc_mask(h, w, cx, cy, d / 2.0)
    inner = ndimage.binary_erosion(disc, structure=CROSS, border_value=0)
    return disc & ~inner, disc


def score(line, ring, disc, cx, cy):
    """Fracción del anillo cubierta por línea; exige que los 8 octantes estén cubiertos (>= 55 % cada uno,
    para no confundir un borde recto o un arco suelto con un círculo) y penaliza discos macizos."""
    n = ring.sum()
    if n == 0:
        return 0.0
    cov = (line & ring).sum() / n
    ys, xs = np.nonzero(ring)
    oct_all = np.floor((np.arctan2(ys - cy, xs - cx) + np.pi) / (np.pi / 4)).astype(int) % 8
    hit = line[ys, xs]
    for o in range(8):
        sel = oct_all == o
        if sel.sum() and hit[sel].mean() < 0.4:
            return 0.0
    inner = ndimage.binary_erosion(disc, structure=CROSS, border_value=0)
    inner_ring = inner & ~ndimage.binary_erosion(inner, structure=CROSS, border_value=0)
    if inner_ring.sum() and (line & inner_ring).sum() / inner_ring.sum() > 0.6:
        return 0.0
    return float(cov)


def hough_circles(line, min_d, max_d, cover):
    """Devuelve [(cov, cx, cy, d)] ordenados por tamaño, no solapados, con cobertura >= cover."""
    h, w = line.shape
    ys, xs = np.nonzero(line)
    if len(xs) == 0:
        return []
    cands = []
    for d in range(min_d, min(max_d, min(h, w)) + 1):
        r = d / 2.0
        nang = max(24, int(2 * np.pi * r * 1.5))
        th = np.linspace(0, 2 * np.pi, nang, endpoint=False)
        cos, sin = np.cos(th), np.sin(th)
        # acumulador en rejilla de medio píxel: índice = 2*coord (+ margen)
        acc = np.zeros((2 * h + 3, 2 * w + 3), dtype=np.int32)
        # vectorizado: (N píxeles × nang ángulos) → cada píxel vota una vez por celda de centro
        cxi = np.round((xs[:, None] - r * cos[None, :]) * 2).astype(int) + 1
        cyi = np.round((ys[:, None] - r * sin[None, :]) * 2).astype(int) + 1
        ok = (cxi >= 0) & (cxi < acc.shape[1]) & (cyi >= 0) & (cyi < acc.shape[0])
        idx = np.where(ok, cyi * acc.shape[1] + cxi, -1)
        pid = np.repeat(np.arange(len(xs))[:, None], idx.shape[1], 1)
        pares = np.unique(np.stack([pid[ok], idx[ok]], 1), axis=0)  # (píxel, celda) únicos
        np.add.at(acc.ravel(), pares[:, 1], 1)
        acc = ndimage.uniform_filter(acc.astype(float), 3) * 9  # suma 3x3: junta los votos dispersos
        umbral = 0.35 * np.pi * d
        for cyi, cxi in zip(*np.nonzero(acc >= umbral)):
            cx, cy = (cxi - 1) / 2.0, (cyi - 1) / 2.0
            # centro válido según paridad del diámetro
            if d % 2 == 1:
                if cx != int(cx) or cy != int(cy):
                    continue
            else:
                if cx == int(cx) or cy == int(cy):
                    continue
            # el círculo entero debe caber en la imagen
            if cx - d / 2.0 < -0.5 or cy - d / 2.0 < -0.5 or cx + d / 2.0 > w - 0.5 or cy + d / 2.0 > h - 0.5:
                continue
            ring, disc = classic_ring(h, w, cx, cy, d)
            s = score(line, ring, disc, cx, cy)
            if s >= (cover if d >= 9 else max(cover, 0.9)):
                cands.append((s, cx, cy, d))
    cands.sort(key=lambda c: (-c[0], -c[3]))  # mejor cobertura primero; a igual cobertura, el mayor
    chosen = []
    for c in cands:
        s, cx, cy, d = c
        ok = True
        for _, cx2, cy2, d2 in chosen:
            dist = np.hypot(cx - cx2, cy - cy2)
            if dist < 2.5 and abs(d - d2) <= 3:  # mismo círculo, versión peor
                ok = False
                break
        if ok:
            chosen.append(c)
    chosen.sort(key=lambda c: -c[3])
    return chosen


def majority_fill(rgba, todo, allowed, passes=8):
    h, w = todo.shape
    todo = todo.copy()
    for _ in range(passes):
        if not todo.any():
            break
        done = np.zeros_like(todo)
        for y, x in zip(*np.nonzero(todo)):
            cols = {}
            for dy in (-1, 0, 1):
                for dx in (-1, 0, 1):
                    ny, nx = y + dy, x + dx
                    if (dy or dx) and 0 <= ny < h and 0 <= nx < w and allowed[ny, nx] and not todo[ny, nx]:
                        c = tuple(rgba[ny, nx])
                        cols[c] = cols.get(c, 0) + 1
            if cols:
                rgba[y, x] = max(cols.items(), key=lambda kv: kv[1])[0]
                done[y, x] = True
        todo &= ~done
    return rgba


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("src")
    ap.add_argument("dst")
    ap.add_argument("--line-lum", type=float, default=60)
    ap.add_argument("--min-d", type=int, default=5)
    ap.add_argument("--max-d", type=int, default=64, help="diámetro máximo a buscar (círculos mayores son raros en sprites)")
    ap.add_argument("--cover", type=float, default=0.8)
    ap.add_argument("--preview")
    a = ap.parse_args()

    im = Image.open(a.src).convert("RGBA")
    rgba = np.array(im)
    h, w = rgba.shape[:2]
    opaque = rgba[..., 3] > 127
    line = opaque & (lum(rgba[..., :3].astype(float)) <= a.line_lum)
    circles = hough_circles(line, a.min_d, min(a.max_d, max(h, w)), a.cover)
    for cov, cx, cy, d in circles:
        ring, disc = classic_ring(h, w, cx, cy, d)
        yy, xx = np.mgrid[0:h, 0:w]
        dist = np.abs(np.sqrt((xx - cx) ** 2 + (yy - cy) ** 2) - d / 2.0)
        near = line & (dist <= 1.3)           # trazo viejo del círculo (con sus dobles)
        if (near & ring).sum() == 0:
            continue
        # el trazo viejo puede ser grueso: extenderlo a los píxeles oscuros contiguos hasta 2,6 px del anillo
        near = ndimage.binary_propagation(near, mask=line & (dist <= 2.6), structure=np.ones((3, 3)))
        cols, cnt = np.unique(rgba[near & ring].reshape(-1, 4), axis=0, return_counts=True)
        line_col = cols[cnt.argmax()]
        todo = near & ~ring                     # sobrantes a rellenar
        rgba[ring] = line_col
        rgba[ring, 3] = 255
        fill_ok = opaque & ~line                # colores de relleno originales
        inside = todo & disc
        outside = todo & ~disc
        if inside.any():
            rgba = majority_fill(rgba, inside, fill_ok & disc)
        if outside.any():
            for y, x in zip(*np.nonzero(outside)):
                nb = []
                for dy in (-1, 0, 1):
                    for dx in (-1, 0, 1):
                        ny, nx = y + dy, x + dx
                        if (dy or dx) and 0 <= ny < h and 0 <= nx < w and not disc[ny, nx] and not outside[ny, nx] and not line[ny, nx]:
                            nb.append(tuple(rgba[ny, nx]))
                rgba[y, x] = max(set(nb), key=nb.count) if nb else (0, 0, 0, 0)
        opaque = rgba[..., 3] > 127
        line = opaque & (lum(rgba[..., :3].astype(float)) <= a.line_lum)
        print(f"circulo: centro ({cx}, {cy}) diametro {d} cobertura {cov:.2f}  trazo viejo {int(near.sum())} px -> anillo {int(ring.sum())} px")
    out = Image.fromarray(rgba, "RGBA")
    out.save(a.dst)
    print(f"{a.dst}: {len(circles)} circulo(s) sustituido(s)")
    if a.preview:
        g = Image.new("RGBA", (w * 8 * 2 + 24, h * 8 + 16), (150, 176, 95, 255))
        g.alpha_composite(im.resize((w * 8, h * 8), Image.Resampling.NEAREST), (8, 8))
        g.alpha_composite(out.resize((w * 8, h * 8), Image.Resampling.NEAREST), (w * 8 + 16, 8))
        g.save(a.preview)


if __name__ == "__main__":
    sys.exit(main())
