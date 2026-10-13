"""Contorno nítido para sprites de roca (el de SDXL queda blando al reducir).

Uso: python -I tools/rock_outline.py <roca.png> <salida.png> [--w 2.5] [--bottom 1.8] [--dark .45]

1. Silueta: alfa ampliado x4, cortado en 0.5 y con borde antialiasado (distancia con signo).
2. Contorno por dentro de la silueta, de --w px (de la imagen) de grueso, --bottom veces más
   grueso por abajo (lado de sombra), como una pincelada.
3. Color del contorno: tono medio de la roca x --dark (gris oscuro, no negro).
"""
import argparse

import numpy as np
from PIL import Image
from scipy import ndimage


def main():
    a = argparse.ArgumentParser()
    a.add_argument("src")
    a.add_argument("dst")
    a.add_argument("--w", type=float, default=2.5)
    a.add_argument("--bottom", type=float, default=1.8)
    a.add_argument("--dark", type=float, default=.45)
    o = a.parse_args()
    U = 4
    im = Image.open(o.src).convert("RGBA")
    size = (im.width * U, im.height * U)
    big = np.asarray(im.resize(size, Image.BICUBIC), np.float32)
    rgb, al = big[..., :3], big[..., 3] / 255
    solid = ndimage.gaussian_filter(al, U * .5) > .5
    sd = ndimage.distance_transform_edt(solid) - ndimage.distance_transform_edt(~solid)
    alpha = np.clip(sd / U + .5, 0, 1)
    # Normal exterior hacia abajo -> contorno más grueso.
    sm = ndimage.gaussian_filter(sd, 6 * U)
    gy, gx = ndimage.sobel(sm, 0), ndimage.sobel(sm, 1)
    down = np.clip(-gy / np.maximum(np.hypot(gx, gy), 1e-6), 0, 1)
    width = o.w * U * (1 + (o.bottom - 1) * down)
    line = np.clip((width - np.maximum(sd, 0)) / U + .5, 0, 1) * solid
    inner = ndimage.binary_erosion(solid, iterations=int(o.w * U * 2))
    ink = rgb[inner].mean(0) * o.dark
    # Donde el borde original era transparente a medias, el color no vale: se usa el de dentro.
    out = rgb + (ink - rgb) * line[..., None]
    rgba = np.dstack([out * alpha[..., None], alpha * 255]).clip(0, 255).astype(np.uint8)
    res = Image.fromarray(rgba, "RGBa").resize(im.size, Image.LANCZOS).convert("RGBA")
    res.save(o.dst)
    print(o.dst, res.size, "tinta", ink.astype(int))


if __name__ == "__main__":
    main()
