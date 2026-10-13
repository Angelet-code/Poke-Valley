"""Acerca al verde los tonos azulados de un sprite (respeta alfa y luminosidad).

Uso: python -I tools/recolor_hue.py <entrada.png> <salida.png> [--target 105] [--amount 0.6] [--sat 1.05]

Para cada píxel con tono entre amarillo-verde y azul (60°-240°), mueve el tono hacia
--target (grados) en la fracción --amount de la distancia. Los grises y oscuros casi no
cambian (el efecto se pondera por la saturación).
"""
import argparse
import colorsys

import numpy as np
from PIL import Image


def main():
    a = argparse.ArgumentParser()
    a.add_argument("src")
    a.add_argument("dst")
    a.add_argument("--target", type=float, default=105)
    a.add_argument("--amount", type=float, default=0.6)
    a.add_argument("--sat", type=float, default=1.05)
    o = a.parse_args()
    im = Image.open(o.src).convert("RGBA")
    arr = np.asarray(im).astype(float) / 255
    rgb = arr[..., :3]
    hsv = np.vectorize(colorsys.rgb_to_hsv, otypes=[float, float, float])(rgb[..., 0], rgb[..., 1], rgb[..., 2])
    h, s, v = (np.asarray(c) for c in hsv)
    deg = h * 360
    band = (deg > 60) & (deg < 240)
    w = np.clip(s / 0.25, 0, 1) * band
    deg = deg + (o.target - deg) * o.amount * w
    s = np.clip(s * (1 + (o.sat - 1) * w), 0, 1)
    out = np.vectorize(colorsys.hsv_to_rgb, otypes=[float, float, float])(deg / 360 % 1, s, v)
    res = np.dstack([*out, arr[..., 3]])
    Image.fromarray((res * 255).clip(0, 255).astype(np.uint8), "RGBA").save(o.dst)
    print(o.dst)


if __name__ == "__main__":
    main()
