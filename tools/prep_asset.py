"""Prepara un objeto generado (fondo blanco) para el juego.

Uso: python -I tools/prep_asset.py <entrada.png> <salida.png> --h 64 [--tol 28]

1. Quita el fondo: rellena desde los bordes los píxeles casi blancos
   (diferencia con el blanco < --tol) y los vuelve transparentes.
2. Suaviza el borde: los píxeles opacos pegados al fondo se aclaran del
   halo blanco (se oscurecen hacia su vecino interior) para que no quede
   un contorno blanco.
3. Recorta al contenido y reduce a --h píxeles de alto (LANCZOS).
"""
import argparse
from collections import deque

from PIL import Image


def remove_bg(im, tol):
    w, h = im.size
    px = im.load()
    near_white = lambda p: (255 - min(p[:3])) < tol
    seen = bytearray(w * h)
    q = deque((x, y) for x in range(w) for y in (0, h - 1))
    q.extend((x, y) for y in range(h) for x in (0, w - 1))
    while q:
        x, y = q.popleft()
        i = y * w + x
        if seen[i] or not near_white(px[x, y]):
            continue
        seen[i] = 1
        px[x, y] = (255, 255, 255, 0)
        for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
            if 0 <= nx < w and 0 <= ny < h and not seen[ny * w + nx]:
                q.append((nx, ny))
    # Halo: píxeles opacos junto al fondo con mezcla de blanco -> semitransparentes.
    for y in range(h):
        for x in range(w):
            p = px[x, y]
            if p[3] == 0:
                continue
            if any(0 <= nx < w and 0 <= ny < h and px[nx, ny][3] == 0
                   for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1))):
                whiteness = min(p[:3]) / 255
                if whiteness > 0.75:
                    px[x, y] = p[:3] + (int(255 * (1 - whiteness) * 2),)
    return im


def main():
    a = argparse.ArgumentParser()
    a.add_argument("src")
    a.add_argument("dst")
    a.add_argument("--h", type=int, required=True)
    a.add_argument("--tol", type=int, default=28)
    o = a.parse_args()
    im = remove_bg(Image.open(o.src).convert("RGBA"), o.tol)
    im = im.crop(im.getbbox())
    w = max(1, round(im.width * o.h / im.height))
    # Reducir con alfa premultiplicado para no ensuciar los bordes.
    im = im.convert("RGBa").resize((w, o.h), Image.LANCZOS).convert("RGBA")
    im.save(o.dst)
    print(o.dst, im.size)


if __name__ == "__main__":
    main()
