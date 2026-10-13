"""Extrae un tileset de mapas completos (rips de Spriters Resource).

Uso: python -I tools/extract_tiles.py assets/zelda/lon-lon-ranch.png [más mapas...]

Para cada mapa:
1. Busca el desplazamiento (0-15, 0-15) de la cuadrícula de 16 px que da
   menos baldosas distintas (algunos rips llevan borde o márgenes).
2. Corta el mapa en baldosas de 16x16 y elimina las repetidas.
Después junta las baldosas únicas de todos los mapas en
assets/zelda/tileset.png (32 columnas) y escribe assets/zelda/tileset.json
con, por cada baldosa, cuántas veces aparece y en qué mapas.
"""
import json
import sys
from collections import Counter, defaultdict
from pathlib import Path

from PIL import Image

T = 16
COLS = 32


def tiles_at(im, ox, oy):
    w, h = im.size
    for ty in range((h - oy) // T):
        for tx in range((w - ox) // T):
            box = (ox + tx * T, oy + ty * T, ox + tx * T + T, oy + ty * T + T)
            yield (tx, ty), im.crop(box).tobytes()


def best_offset(im):
    best = None
    for oy in range(T):
        for ox in range(T):
            n = len({b for _, b in tiles_at(im, ox, oy)})
            if best is None or n < best[0]:
                best = (n, ox, oy)
    return best


def main(paths):
    out_dir = Path("assets/zelda")
    counts = Counter()
    sources = defaultdict(set)
    order = []
    maps = {}
    for p in map(Path, paths):
        im = Image.open(p).convert("RGBA")
        n, ox, oy = best_offset(im)
        grid = {}
        for pos, b in tiles_at(im, ox, oy):
            if b not in counts:
                order.append(b)
            counts[b] += 1
            sources[b].add(p.stem)
            grid[pos] = b
        maps[p.stem] = (grid, ox, oy, im.size)
        print(f"{p.name}: desplazamiento ({ox},{oy}), {n} baldosas distintas")

    rows = (len(order) + COLS - 1) // COLS
    sheet = Image.new("RGBA", (COLS * T, rows * T))
    index = {}
    for i, b in enumerate(order):
        sheet.paste(Image.frombytes("RGBA", (T, T), b), ((i % COLS) * T, (i // COLS) * T))
        index[b] = i
    sheet.save(out_dir / "tileset.png")

    meta = {
        "tileSize": T,
        "columns": COLS,
        "tiles": [{"count": counts[b], "maps": sorted(sources[b])} for b in order],
        # Cada mapa como matriz de índices, para reconstruirlo y para sacar vecinos.
        "maps": {
            name: {
                "offset": [ox, oy],
                "width": max(x for x, _ in grid) + 1,
                "height": max(y for _, y in grid) + 1,
                "data": [index[grid[(x, y)]] for y in range(max(y for _, y in grid) + 1)
                         for x in range(max(x for x, _ in grid) + 1)],
            }
            for name, (grid, ox, oy, _) in maps.items()
        },
    }
    (out_dir / "tileset.json").write_text(json.dumps(meta), encoding="utf-8")
    print(f"tileset.png: {len(order)} baldosas únicas ({COLS}x{rows})")


if __name__ == "__main__":
    main(sys.argv[1:])
