"""Variantes de baldosa de suelo en pixel art, combinables entre sí.

Uso: python -I tools/grass_tiles.py --src a.png b.png ... --out assets/game/cesped
         [--size 96] [--border 12] [--margin 150] [--grid 2]
         [--ramp "R,G,B;R,G,B;..."] [--spread 1.0] [--smooth] [--preview prev.png]

1. De cada imagen de origen toma --grid x --grid recortes de su interior
   (dejando --margin px de margen, donde la IA a veces dibuja marcos).
2. Cada recorte se hace repetible y se reduce a --size px promediando bloques.
3. Se normaliza: misma luminosidad media y misma desviación en todas.
4. Mapa de degradado por luminosidad a la --ramp (de oscuro a claro, número
   impar de colores, el central es el tono base). Los cortes están a
   ±spread·(0.5, 1.5, ...) desviaciones: con --spread mayor, más píxeles caen
   en el tono central y la baldosa queda más plana.
5. Todas comparten una franja de borde de --border px (la de la primera),
   fundida hacia dentro con tramado ordenado: cualquier combinación encaja.
6. Limpieza de píxeles sueltos con envoltura. Guarda <out>_0.png, <out>_1.png...

--smooth: sin pixelizar (para suelos pintados). El color se interpola de forma
continua a lo largo de la rampa (sin cortes), el borde común se funde con una
máscara suave y no hay limpieza de píxeles.
"""
import argparse
import random
import statistics
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from pixelize import despeckle_wrap, tileable  # noqa: E402

from PIL import Image  # noqa: E402

BAYER = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]]


def luma(p):
    return 0.2126 * p[0] + 0.7152 * p[1] + 0.0722 * p[2]


def ramp_map(tile, ramp, spread):
    lums = [luma(p) for p in tile.get_flattened_data()]
    mu, sd = statistics.mean(lums), statistics.pstdev(lums) or 1
    half = len(ramp) // 2
    cuts = [spread * (i + 0.5) for i in range(half)]  # 0.5, 1.5, ... desviaciones
    out = Image.new("RGB", tile.size)
    o = out.load()
    w = tile.width
    for i, l in enumerate(lums):
        z = (l - mu) / sd
        step = sum(1 for c in cuts if abs(z) > c)
        o[i % w, i // w] = ramp[half + step if z > 0 else half - step]
    return out


def ramp_smooth(tile, ramp, spread):
    """Como ramp_map pero continuo: z se lleva a la rampa interpolando entre colores."""
    lums = [luma(p) for p in tile.get_flattened_data()]
    mu, sd = statistics.mean(lums), statistics.pstdev(lums) or 1
    half = len(ramp) // 2
    out = Image.new("RGB", tile.size)
    o = out.load()
    w = tile.width
    for i, l in enumerate(lums):
        pos = max(0.0, min(len(ramp) - 1.0, half + (l - mu) / sd / spread))
        k = min(int(pos), len(ramp) - 2)
        t = pos - k
        o[i % w, i // w] = tuple(round(ramp[k][c] + (ramp[k + 1][c] - ramp[k][c]) * t) for c in range(3))
    return out


def shared_border_smooth(tiles, size, border):
    mask = Image.new("L", (size, size))
    m = mask.load()
    for y in range(size):
        for x in range(size):
            t = 1 - min(x, size - 1 - x, y, size - 1 - y) / border
            m[x, y] = round(255 * max(0.0, min(1.0, t)) ** 1.5)
    return [tiles[0]] + [Image.composite(tiles[0], t, mask) for t in tiles[1:]]


def shared_border(tiles, size, border):
    mask = Image.new("L", (size, size))
    m = mask.load()
    for y in range(size):
        for x in range(size):
            t = 1 - min(x, size - 1 - x, y, size - 1 - y) / border
            m[x, y] = 255 if t > (BAYER[y & 3][x & 3] + 0.5) / 16 else 0
    return [tiles[0]] + [Image.composite(tiles[0], t, mask) for t in tiles[1:]]


def main():
    a = argparse.ArgumentParser()
    a.add_argument("--src", nargs="+", required=True)
    a.add_argument("--out", required=True)
    a.add_argument("--size", type=int, default=96)
    a.add_argument("--border", type=int, default=12)
    a.add_argument("--margin", type=int, default=150)
    a.add_argument("--grid", type=int, default=2)
    a.add_argument("--ramp", default="152,173,93;159,177,97;165,182,100;171,186,104;177,190,109")
    a.add_argument("--spread", type=float, default=1.0)
    a.add_argument("--smooth", action="store_true")
    a.add_argument("--preview")
    o = a.parse_args()
    ramp = [tuple(int(v) for v in c.split(",")) for c in o.ramp.split(";")]

    tiles = []
    for src in o.src:
        im = Image.open(src).convert("RGB")
        inner = im.crop((o.margin, o.margin, im.width - o.margin, im.height - o.margin))
        cw, ch = inner.width // o.grid, inner.height // o.grid
        for gy in range(o.grid):
            for gx in range(o.grid):
                crop = inner.crop((gx * cw, gy * ch, (gx + 1) * cw, (gy + 1) * ch))
                small = tileable(crop).resize((o.size, o.size), Image.BOX)
                tiles.append(ramp_smooth(small, ramp, o.spread) if o.smooth else ramp_map(small, ramp, o.spread))
    if o.smooth:
        tiles = shared_border_smooth(tiles, o.size, o.border)
    else:
        tiles = [despeckle_wrap(t) for t in shared_border(tiles, o.size, o.border)]

    out = Path(o.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    for i, t in enumerate(tiles):
        t.save(f"{out}_{i}.png")
    print(len(tiles), "variantes en", f"{out}_N.png")

    if o.preview:
        random.seed(1)
        cols, rows = 8, 4
        p = Image.new("RGBA", (o.size * cols, o.size * rows))
        for x in range(cols):
            for y in range(rows):
                p.paste(random.choice(tiles), (x * o.size, y * o.size))
        bulba = Image.open("assets/sprites/pokemon/0001/Idle-Anim.png").convert("RGBA").crop((0, 0, 32, 40))
        p.alpha_composite(bulba, (o.size * cols // 2, o.size * rows // 2))
        p.resize((p.width * 2, p.height * 2), Image.NEAREST).save(o.preview)


if __name__ == "__main__":
    main()
