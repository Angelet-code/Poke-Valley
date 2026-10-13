"""Mapa de degradado: recolorea una imagen según la luminosidad de cada píxel.

Uso: python -I tools/gradient_map.py <entrada> <salida> <rampa> [--section 0]

<rampa> es una lista de colores de oscuro a claro: "40,62,82;52,96,110;84,131,134".
Cada píxel opaco toma el color de la rampa que le toca por su luminosidad,
normalizada entre los percentiles 2 y 98 de la imagen (o de la sección).
Sin interpolar: el resultado solo tiene los colores de la rampa.

--section N: en tilesets DTEF de PMD (3 secciones de 144 px), procesa solo
la sección N (0 muro, 1 agua, 2 suelo) y deja el resto transparente.
Además, los píxeles cuyo color aparece en la sección de suelo (2) se
vuelven transparentes: así debajo se ve nuestro propio suelo.

--hollow: también vuelve transparente el color dominante de la baldosa
central (1,1) de la sección, es decir, el relleno interior del muro.
"""
import sys

from PIL import Image

SEC_W = 144


def luma(p):
    return 0.2126 * p[0] + 0.7152 * p[1] + 0.0722 * p[2]


def main(src, dst, ramp, section=None, hollow=False):
    ramp = [tuple(int(v) for v in c.split(",")) for c in ramp.split(";")]
    im = Image.open(src).convert("RGBA")
    floor = set()
    if section is not None:
        floor = set(im.crop((2 * SEC_W, 0, 3 * SEC_W, im.height)).get_flattened_data())
        im = im.crop((section * SEC_W, 0, (section + 1) * SEC_W, im.height))
        if hollow:
            center = im.crop((24, 24, 48, 48)).get_flattened_data()
            floor.add(max(set(center), key=center.count))
    px = im.load()
    for y in range(im.height):
        for x in range(im.width):
            if px[x, y] in floor:
                px[x, y] = (0, 0, 0, 0)
    opaque = [(x, y) for y in range(im.height) for x in range(im.width) if px[x, y][3] > 0]
    ls = sorted(luma(px[x, y]) for x, y in opaque)
    lo, hi = ls[len(ls) * 2 // 100], ls[len(ls) * 98 // 100]
    out = Image.new("RGBA", im.size)
    o = out.load()
    for x, y in opaque:
        t = (luma(px[x, y]) - lo) / max(1, hi - lo)
        i = max(0, min(len(ramp) - 1, int(t * len(ramp))))
        o[x, y] = ramp[i] + (255,)
    out.save(dst)
    print(dst, im.size, len(ramp), "tonos")


if __name__ == "__main__":
    a = sys.argv[1:]
    sec = int(a[a.index("--section") + 1]) if "--section" in a else None
    main(a[0], a[1], a[2], sec, "--hollow" in a)
