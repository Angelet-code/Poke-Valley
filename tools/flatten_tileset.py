"""Genera una versión plana de un tileset DTEF de PMD.

Uso: python -I tools/flatten_tileset.py assets/pmd/dtef/TinyMeadow.png [--grass R,G,B] [--water R,G,B] [--shore R,G,B] [--detail 0.2]

Sin colores, usa los del propio tileset. Con ellos, por ejemplo los de
Treasure Town (--grass 200,216,80 --water 128,216,224 --shore 88,176,200).

- La hierba (píxeles verdes) de las tres secciones pasa a un único verde.
  Con --detail k conserva la textura original con su contraste reducido
  a k (0 = plana, 1 = original) alrededor de ese verde.
- El agua (sección central) pasa a un color base, con un tono más oscuro
  a 1-2 px de la orilla.
- Escribe <nombre>-flat.png junto al original.
"""
import colorsys
import statistics
import sys
from pathlib import Path

from PIL import Image

T = 24
SEC_W = 6 * T  # cada sección DTEF tiene 6 columnas


def hsv(px):
    r, g, b = (c / 255 for c in px[:3])
    h, s, v = colorsys.rgb_to_hsv(r, g, b)
    return h * 360, s, v


def is_grass(px):
    h, s, v = hsv(px)
    return px[3] > 0 and 55 <= h <= 165 and s > 0.2 and v > 0.25


def is_water(px):
    h, s, v = hsv(px)
    return px[3] > 0 and 170 <= h <= 235 and s > 0.2


def median_color(pixels):
    return tuple(int(statistics.median(p[i] for p in pixels)) for i in range(3)) + (255,)


def darker(c, f):
    return tuple(int(x * f) for x in c[:3]) + (255,)


def parse_color(arg):
    return tuple(int(c) for c in arg.split(",")) + (255,)


def main(src, grass=None, water=None, shore=None, detail=0.0):
    src = Path(src)
    im = Image.open(src).convert("RGBA")
    px = im.load()
    w, h = im.size

    # Colores base: mediana del tile central de suelo (1,1) y de agua (1,1).
    floor_c = [px[2 * SEC_W + T + x, T + y] for y in range(T) for x in range(T)]
    water_c = [px[SEC_W + T + x, T + y] for y in range(T) for x in range(T)]
    src_grass = median_color([p for p in floor_c if is_grass(p)])
    grass = grass or src_grass
    water = water or median_color([p for p in water_c if is_water(p)])
    shore = shore or darker(water, 0.82)

    out = im.copy()
    o = out.load()
    for y in range(h):
        for x in range(w):
            p = px[x, y]
            if is_grass(p):
                o[x, y] = tuple(
                    max(0, min(255, round(grass[i] + detail * (p[i] - src_grass[i])))) for i in range(3)
                ) + (255,)
            elif SEC_W <= x < 2 * SEC_W and is_water(p):
                # Solo dentro de la misma baldosa: la vecina en la hoja no es la vecina en el mapa.
                tx, ty = x // T * T, y // T * T
                near_shore = any(
                    tx <= x + dx < tx + T and ty <= y + dy < ty + T
                    and not is_water(px[x + dx, y + dy])
                    for dx in (-2, -1, 0, 1, 2) for dy in (-2, -1, 0, 1, 2)
                )
                o[x, y] = shore if near_shore else water

    # Tile de suelo (1,1) sin flores: lo que no es hierba pasa al verde base.
    for y in range(T):
        for x in range(T):
            if not is_grass(px[2 * SEC_W + T + x, T + y]):
                o[2 * SEC_W + T + x, T + y] = grass

    dst = src.with_name(src.stem + "-flat.png")
    out.save(dst)
    print(f"{dst}  hierba={grass[:3]} agua={water[:3]}")


if __name__ == "__main__":
    args = sys.argv[1:]
    opts = {k[2:]: float(v) if k == "--detail" else parse_color(v) for k, v in zip(args[1::2], args[2::2])}
    main(args[0], **opts)
