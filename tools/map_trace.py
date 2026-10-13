"""Mapa de terreno trazado a mano sobre la referencia (más limpio que map_from_ref.py).

Uso: python -I tools/map_trace.py <salida.json> [--n 24] [--preview prev.png --ref ref.png]

Los caminos de losas son polilíneas con semiancho, medidas en px de la referencia
(1024 x 1024); alrededor llevan un margen de tierra, como en la imagen. Las zonas de
tierra lisa son elipses. Cada esquina de casilla toma: 2 (losas) si cae dentro de un
camino, 1 (tierra) si cae en su margen o en una zona de tierra, 0 (césped) si no.
"""
import argparse
import json

import numpy as np
from PIL import Image, ImageDraw

REF = 1024
# Caminos de losas: (semiancho, puntos).
PATHS = [
    (36, [(600, -40), (600, 110), (540, 190), (420, 230), (330, 285), (292, 370), (305, 450), (380, 505),
          (500, 525), (640, 520), (720, 560), (758, 640), (762, 740), (830, 795), (1060, 805)]),
    (34, [(1060, 415), (920, 412), (858, 460), (845, 560), (880, 650), (960, 690), (1060, 700)]),
    (42, [(630, 1060), (630, 990)]),
]
DIRT_MARGIN = 12
# Tierra lisa: elipses (cx, cy, rx, ry).
DIRT = [(140, 215, 150, 115), (215, 75, 95, 50), (470, 340, 125, 70), (610, 690, 140, 48), (930, 545, 70, 95),
        (40, 330, 60, 45)]

# Lagos: polígonos en px de la referencia.
LAKES = [
    [(805, -40), (800, 0), (770, 80), (720, 150), (680, 200), (670, 250), (700, 300), (760, 332), (840, 326),
     (905, 290), (935, 230), (945, 150), (955, 60), (950, -40)],
    [(120, 500), (200, 482), (290, 498), (300, 560), (310, 635), (400, 645), (455, 665), (478, 720), (470, 770),
     (420, 820), (340, 870), (260, 905), (222, 960), (212, 1060), (-40, 1060), (-40, 925), (60, 932), (145, 905),
     (155, 800), (140, 720), (110, 650), (100, 560)],
]


def in_poly(x, y, pts):
    ins = False
    for (x0, y0), (x1, y1) in zip(pts, pts[1:] + pts[:1]):
        if (y0 > y) != (y1 > y) and x < x0 + (y - y0) * (x1 - x0) / (y1 - y0):
            ins = not ins
    return ins


def seg_dist(p, a, b):
    p, a, b = map(np.asarray, (p, a, b))
    ab = b - a
    t = np.clip(np.dot(p - a, ab) / max(1e-9, np.dot(ab, ab)), 0, 1)
    return np.linalg.norm(p - (a + t * ab))


def terrain(x, y):
    if any(in_poly(x, y, p) for p in LAKES):
        return 3
    best = 0
    for hw, pts in PATHS:
        d = min(seg_dist((x, y), pts[i], pts[i + 1]) for i in range(len(pts) - 1))
        if d <= hw:
            return 2
        if d <= hw + DIRT_MARGIN:
            best = 1
    for cx, cy, rx, ry in DIRT:
        if ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1:
            best = 1
    return best


def main():
    a = argparse.ArgumentParser()
    a.add_argument("out")
    a.add_argument("--n", type=int, default=24)
    a.add_argument("--preview")
    a.add_argument("--ref")
    o = a.parse_args()
    step = REF / o.n
    vert = [[terrain(vx * step, vy * step) for vx in range(o.n + 1)] for vy in range(o.n + 1)]
    json.dump({"mw": o.n, "mh": o.n, "vert": vert}, open(o.out, "w"))
    for row in vert:
        print("".join(".-#~"[v] for v in row))
    if o.preview and o.ref:
        im = Image.open(o.ref).convert("RGB")
        d = ImageDraw.Draw(im)
        for vy, row in enumerate(vert):
            for vx, v in enumerate(row):
                c = [(0, 160, 0), (230, 150, 0), (220, 0, 0), (0, 80, 255)][v]
                x, y = vx * step, vy * step
                d.ellipse((x - 5, y - 5, x + 5, y + 5), fill=c)
        im.save(o.preview)


if __name__ == "__main__":
    main()
