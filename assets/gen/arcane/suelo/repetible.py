"""Textura repetible a partir de una imagen de Klein (fase 0 del plan Arcane, docs/art/ARCANE.md).

Uso: python -I assets/gen/arcane/suelo/repetible.py <entrada.png> <salida.png> [--tam 288]
Reduce la imagen a `tam` px (1 px = 1 px de mundo en Terrain) y la funde con su copia desplazada media vuelta: en
el centro manda la original y en los bordes la desplazada, cuyos bordes son el centro de la original, así que
enlaza sola. La mezcla es suave (coseno), sin costuras.
"""
import argparse

import numpy as np
from PIL import Image

ap = argparse.ArgumentParser()
ap.add_argument('entrada')
ap.add_argument('salida')
ap.add_argument('--tam', type=int, default=288)
o = ap.parse_args()
n = o.tam
a = np.asarray(Image.open(o.entrada).convert('RGB').resize((n, n), Image.LANCZOS)).astype(float)
b = np.roll(a, (n // 2, n // 2), (0, 1))
t = np.abs(np.arange(n) - (n - 1) / 2) / ((n - 1) / 2)          # 0 en el centro, 1 en el borde
w1 = np.cos(np.clip(t, 0, 1) * np.pi / 2) ** 2
w = np.outer(w1, w1)[..., None]
Image.fromarray((a * w + b * (1 - w)).round().astype(np.uint8)).save(o.salida)
print(o.salida, n)
