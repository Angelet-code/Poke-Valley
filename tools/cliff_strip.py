"""Tira de acantilado (pared de roca de los lagos) a partir de la referencia.

Uso:
  python -I tools/cliff_strip.py init <ref.png> <init.png>
  python -I tools/cliff_strip.py strip <repintada.png> <salida.png> [--h 96] [--x0 0 --x1 1536]

init: endereza la pared de arriba del lago de abajo a la izquierda (columnas X0..X1 de la
  referencia): en cada columna, de donde acaba el césped a donde empieza el agua, se
  remuestrea a la misma altura. La tira se repite (normal, espejo, normal) y se monta
  sobre césped arriba y agua abajo (contexto para img2img), ampliada x UP.
strip: de la imagen repintada (tools/comfy.py --init) recorta la banda de la pared
  (--y0/--y1: solo la roca; los bordes de arriba y del agua los dibuja la maqueta),
  la hace repetible en horizontal (fundido de los extremos), la aplana si se pide (--flat)
  y la reduce a --h px de alto.
"""
import argparse

import numpy as np
from PIL import Image

X0, X1, Y0, Y1 = 160, 250, 460, 560   # zona de la pared en la referencia
BAND = 45                              # alto enderezado, px de la referencia
UP = 6
TOP, CW, CH = 200, 1536, 768           # césped encima (px del init) y tamaño del init


def init(o):
    a = np.asarray(Image.open(o.ref).convert("RGB")).astype(np.float32)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    water = (b > r + 40) & (g > r + 30)
    grass = (g > r + 8) & (g > b + 40)
    cols = []
    for x in range(X0, X1):
        ys = np.arange(Y0, Y1)
        top = next(y for y in ys if not grass[y, x])
        bot = next(y for y in ys if y > top + 10 and water[y, x])
        col = Image.fromarray(a[top - 2:bot + 2, x:x + 1].astype(np.uint8)).resize((1, BAND), Image.BICUBIC)
        cols.append(np.asarray(col))
    strip = Image.fromarray(np.concatenate(cols, 1))
    strip = strip.resize((strip.width * UP, BAND * UP), Image.LANCZOS)
    G = tuple(int(v) for v in a[grass].mean(0))
    W_ = tuple(int(v) for v in np.median(a[water], 0))
    im = Image.new("RGB", (CW, CH), W_)
    im.paste(Image.new("RGB", (CW, TOP), G), (0, 0))
    x, k = 0, 0
    while x < CW:
        im.paste(strip.transpose(Image.FLIP_LEFT_RIGHT) if k % 2 else strip, (x, TOP))
        x += strip.width
        k += 1
    im.save(o.out)
    print(o.out, "pared en filas", TOP, TOP + BAND * UP)


def make_strip(o):
    im = Image.open(o.ref).convert("RGB")
    y0 = o.y0 if o.y0 is not None else TOP - o.pad
    y1 = o.y1 if o.y1 is not None else TOP + BAND * UP + o.pad
    band = np.asarray(im.crop((o.x0, y0, o.x1, y1)), np.float32)
    # Repetible: los últimos F px se funden con los primeros y se quitan.
    F = o.fade
    t = np.linspace(0, 1, F)[None, :, None]
    band[:, :F] = band[:, :F] * t + band[:, -F:] * (1 - t)
    band = band[:, :-F]
    if o.flat < 1:
        # Más plana: tono medio de cada fila (degradado de arriba abajo) + poco relieve;
        # lo oscuro (grietas) se conserva más.
        from scipy import ndimage
        base = ndimage.uniform_filter1d(band, size=band.shape[1] // 3, axis=1, mode="wrap")
        base = ndimage.gaussian_filter(base, (6, 0, 0))
        det = band - base
        lum = det.mean(-1, keepdims=True)
        k = np.where(lum < -o.crack, o.crack_keep, o.flat)
        band = base + det * k
    out = Image.fromarray(band.clip(0, 255).astype(np.uint8))
    out = out.resize((round(out.width * o.h / out.height), o.h), Image.LANCZOS)
    out.save(o.out)
    print(o.out, out.size)


def main():
    a = argparse.ArgumentParser()
    a.add_argument("stage", choices=["init", "strip"])
    a.add_argument("ref")
    a.add_argument("out")
    a.add_argument("--h", type=int, default=96)
    a.add_argument("--x0", type=int, default=0)
    a.add_argument("--x1", type=int, default=CW)
    a.add_argument("--pad", type=int, default=0, help="px de más arriba y abajo de la banda")
    a.add_argument("--y0", type=int, help="fila de arriba de la banda (solo roca, sin el césped)")
    a.add_argument("--y1", type=int, help="fila de abajo de la banda (sin el agua)")
    a.add_argument("--flat", type=float, default=1, help="relieve que queda (1 = todo, 0 = color plano)")
    a.add_argument("--crack", type=float, default=18, help="oscuridad a partir de la cual es grieta")
    a.add_argument("--crack-keep", type=float, default=.85, help="cuánto se conserva de las grietas")
    a.add_argument("--fade", type=int, default=120)
    o = a.parse_args()
    init(o) if o.stage == "init" else make_strip(o)


if __name__ == "__main__":
    main()
