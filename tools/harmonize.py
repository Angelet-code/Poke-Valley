"""Armoniza el escenario: una sola paleta y menos detalle.

Uso: python -I tools/harmonize.py [--colors 32] [--tones 5] [--ref imagen] [--only Tree]

--ref:  imagen de la que sale la paleta (por defecto, Treasure Town).
--only: si se da, solo se procesan los objetos cuyo nombre empieza así;
        el resto se copia tal cual.

1. Extrae una paleta de --colors colores de la referencia de ambiente
   (Treasure Town, solo la parte del mapa).
2. Para cada objeto de assets/pmd/object/: lo reduce a --tones tonos,
   lleva cada tono al color más cercano de la paleta (en OKLab) y quita
   los píxeles sueltos (sin ningún vecino del mismo color).
3. Para el tileset plano: lleva cada color a la paleta, sin reducir tonos
   (la textura sutil de la hierba se mantiene si su color existe).
Escribe todo en assets/pmd/harmonized/ con los mismos nombres, y la
paleta en assets/pmd/harmonized/palette.png.
"""
import sys
from pathlib import Path

from PIL import Image

REF = Path("assets/pmd/ref/treasure-town-b.png")
REF_BOX = (0, 40, 1120, 460)  # mapa de Treasure Town, sin ríos sueltos ni textos
OBJECTS = Path("assets/pmd/object")
TILESET = Path("assets/pmd/dtef/TinyMeadow-flat.png")
OUT = Path("assets/pmd/harmonized")


def srgb_to_oklab(c):
    def lin(v):
        v /= 255
        return v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4

    r, g, b = (lin(v) for v in c[:3])
    l = (0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b) ** (1 / 3)
    m = (0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b) ** (1 / 3)
    s = (0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b) ** (1 / 3)
    return (
        0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s,
        1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s,
        0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s,
    )


def extract_palette(n, ref_path=None):
    ref = Image.open(ref_path).convert("RGB") if ref_path else Image.open(REF).convert("RGB").crop(REF_BOX)
    # Fuera el blanco del fondo del rip.
    px = [p for p in ref.get_flattened_data() if p != (255, 255, 255)]
    strip = Image.new("RGB", (len(px), 1))
    strip.putdata(px)
    q = strip.quantize(colors=n, method=Image.Quantize.MEDIANCUT)
    pal = q.getpalette()[: n * 3]
    return [tuple(pal[i : i + 3]) for i in range(0, len(pal), 3)]


class Mapper:
    def __init__(self, palette):
        self.palette = palette
        self.lab = [srgb_to_oklab(c) for c in palette]
        self.cache = {}

    def __call__(self, c):
        key = c[:3]
        if key not in self.cache:
            L = srgb_to_oklab(key)
            i = min(range(len(self.lab)), key=lambda j: sum((a - b) ** 2 for a, b in zip(L, self.lab[j])))
            self.cache[key] = self.palette[i]
        return self.cache[key]


def remap(im, mapper):
    out = im.copy()
    px = out.load()
    for y in range(im.height):
        for x in range(im.width):
            p = px[x, y]
            if p[3] > 0:
                px[x, y] = mapper(p) + (255,)
    return out


def is_green(c):
    import colorsys

    h, s, v = colorsys.rgb_to_hsv(*(x / 255 for x in c[:3]))
    return 60 <= h * 360 <= 170 and s > 0.2


def reduce_tones(im, tones):
    """Reduce a `tones` colores solo los verdes (copas); el resto (troncos, frutos) no se toca."""
    out = im.copy()
    px = out.load()
    greens = [px[x, y][:3] for y in range(im.height) for x in range(im.width) if px[x, y][3] and is_green(px[x, y])]
    if not greens:
        return out
    strip = Image.new("RGB", (len(greens), 1))
    strip.putdata(greens)
    q = strip.quantize(colors=tones, method=Image.Quantize.MEDIANCUT).convert("RGB")
    lut = dict(zip(greens, q.get_flattened_data()))
    for y in range(im.height):
        for x in range(im.width):
            p = px[x, y]
            if p[3] and p[:3] in lut:
                px[x, y] = lut[p[:3]] + (255,)
    return out


def despeckle(im):
    out = im.copy()
    src, px = im.load(), out.load()
    for y in range(im.height):
        for x in range(im.width):
            p = src[x, y]
            if p[3] == 0:
                continue
            neigh = [
                src[x + dx, y + dy]
                for dx in (-1, 0, 1) for dy in (-1, 0, 1)
                if (dx or dy) and 0 <= x + dx < im.width and 0 <= y + dy < im.height and src[x + dx, y + dy][3] > 0
            ]
            if neigh and p not in neigh:
                px[x, y] = max(set(neigh), key=neigh.count)
    return out


def main(colors=32, tones=5, ref=None, only=None):
    OUT.mkdir(parents=True, exist_ok=True)
    palette = extract_palette(colors, ref)
    sw = Image.new("RGB", (colors * 8, 8))
    for i, c in enumerate(palette):
        sw.paste(c, (i * 8, 0, i * 8 + 8, 8))
    sw.save(OUT / "palette.png")
    mapper = Mapper(palette)

    for p in sorted(OBJECTS.glob("*.png")):
        im = Image.open(p).convert("RGBA")
        if only and not p.name.startswith(only):
            im.save(OUT / p.name)
            continue
        out = despeckle(remap(reduce_tones(im, tones), mapper))
        out.save(OUT / p.name)
        print("objeto", p.name)

    tiles = Image.open(TILESET).convert("RGBA")
    remap(tiles, mapper).save(OUT / TILESET.name)
    print("tileset", TILESET.name, "· paleta de", colors, "colores")


if __name__ == "__main__":
    a = sys.argv[1:]
    opts = {k[2:]: v if k in ("--ref", "--only") else int(v) for k, v in zip(a[0::2], a[1::2])}
    main(**opts)
