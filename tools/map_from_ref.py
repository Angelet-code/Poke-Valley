"""Saca un mapa de terreno por esquinas (césped / tierra / losas) de la imagen de referencia.

Uso: python -I tools/map_from_ref.py <ref.png> <salida.json> [--scale 0.5625] [--tile 24]

La referencia se ve a --scale (576 px de mundo para 1024 px), así que da un mapa de
(1024*scale/tile) casillas por lado. Para cada esquina de casilla mira una ventana de
una casilla alrededor en la referencia y vota:
- losas: arena clara (luminancia > 191; máscara cerrada para tapar las grietas) en más
  del 30 % de la ventana (umbral bajo: las esquinas interpolan y estrechan los caminos);
- tierra: arena en más del 30 %;
- césped: el resto (también el agua, que aún no tenemos).
Árboles, sombras y rocas se rellenan con el suelo que tienen alrededor.
Salida: {"mw", "mh", "vert": [filas de (mw+1) valores 0/1/2]}.
"""
import argparse
import json

import numpy as np
from PIL import Image
from scipy import ndimage


def main():
    a = argparse.ArgumentParser()
    a.add_argument("ref")
    a.add_argument("out")
    a.add_argument("--scale", type=float, default=0.5625)
    a.add_argument("--tile", type=int, default=24)
    o = a.parse_args()
    arr = np.asarray(Image.open(o.ref).convert("RGB")).astype(int)
    r, g, b = arr[..., 0], arr[..., 1], arr[..., 2]
    sand = (r > g + 4) & (r > 150) & (b < r - 35)
    lum = 0.2126 * r + 0.7152 * g + 0.0722 * b
    flag = sand & (lum > 191)
    # Las grietas entre losas son oscuras: cerrar la máscara para tener la zona entera.
    flag = ndimage.binary_closing(flag, iterations=6)
    flag = ndimage.binary_opening(flag, iterations=8)
    sand = ndimage.binary_closing(sand | flag, iterations=4)
    # Árboles, sus sombras y rocas no son suelo: esos píxeles toman la clase del píxel de
    # suelo conocido más cercano (así no dejan manchas de tierra o césped a bloques).
    sat = arr.max(-1) - arr.min(-1)
    unknown = (lum < 135) | (sat < 40) | ((b > r + 5) & (g > r + 15))
    unknown = ndimage.binary_dilation(unknown, iterations=3)
    cls = np.where(flag, 2, np.where(sand, 1, 0))
    idx = ndimage.distance_transform_edt(unknown, return_distances=False, return_indices=True)
    cls = cls[idx[0], idx[1]]
    flag, sand = cls == 2, cls >= 1
    step = o.tile / o.scale  # px de referencia por casilla
    n = int(round(arr.shape[1] / step))
    vert = []
    for vy in range(n + 1):
        row = []
        for vx in range(n + 1):
            cx, cy = vx * step, vy * step
            y0, y1 = int(max(0, cy - step / 2)), int(min(arr.shape[0], cy + step / 2))
            x0, x1 = int(max(0, cx - step / 2)), int(min(arr.shape[1], cx + step / 2))
            fs, ff = sand[y0:y1, x0:x1].mean(), flag[y0:y1, x0:x1].mean()
            row.append(2 if ff > 0.3 else 1 if fs > 0.3 else 0)
        vert.append(row)
    json.dump({"mw": n, "mh": n, "vert": vert}, open(o.out, "w"))
    for row in vert:
        print("".join(".-#"[v] for v in row))


if __name__ == "__main__":
    main()
