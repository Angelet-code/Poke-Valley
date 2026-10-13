"""Convierte una textura en repetible sin juntas.

Uso: python -I tools/make_tileable.py <entrada.png> <salida.png> [--size 96]

Mezcla la imagen A con B = A desplazada media anchura y media altura.
B enlaza perfectamente en sus bordes (vienen del centro continuo de A) y
tiene la junta en su centro; A no tiene junta en su centro. La máscara usa
B en los bordes y A en el centro, así que el resultado enlaza por los cuatro
lados y ninguna junta queda a la vista. Después se reduce a --size px.
"""
import argparse

from PIL import Image, ImageChops


def main():
    a = argparse.ArgumentParser()
    a.add_argument("src")
    a.add_argument("dst")
    a.add_argument("--size", type=int, default=96)
    o = a.parse_args()
    A = Image.open(o.src).convert("RGB")
    w, h = A.size
    B = ImageChops.offset(A, w // 2, h // 2)
    mask = Image.new("L", (w, h))
    m = mask.load()
    for y in range(h):
        for x in range(w):
            d = min(x, w - 1 - x, y, h - 1 - y) / (min(w, h) / 2)  # 0 en el borde, 1 en el centro
            m[x, y] = int(255 * min(1, d * 2.2))
    out = Image.composite(A, B, mask).resize((o.size, o.size), Image.LANCZOS)
    out.save(o.dst)
    print(o.dst, out.size)


if __name__ == "__main__":
    main()
