"""Pinta la estructura de las seis zonas de bioma (de tools/zonas/volcar.ts) en una imagen: transitable (arena),
macizo (verde oscuro), agua (azul), salvajes (rojo) y alfa (amarillo). Sirve para revisar el diseño (pasillos,
explanadas, bolsas, ríos) sin abrir el juego.

Uso (desde la raíz): python -I tools/zonas/estructura.py tools/zonas/estructura.json docs/img/estructura_zonas.png
"""
import json
import sys

from PIL import Image, ImageDraw

d = json.load(open(sys.argv[1], encoding='utf-8'))
tiles = []
for b, m in d.items():
    cols, filas, cel, vert = m['cols'], m['filas'], m['cel'], m['vert']
    im = Image.new('RGB', (cols, filas))
    px = im.load()
    for j in range(filas):
        for i in range(cols):
            vx, vy = min(len(vert[0]) - 1, round((i + .5) * cel / 24)), min(len(vert) - 1, round((j + .5) * cel / 24))
            px[i, j] = (60, 110, 170) if vert[vy][vx] == 3 else (40, 60, 40) if m['macizo'][j * cols + i] else (215, 200, 160)
    im = im.resize((cols * 2, filas * 2), Image.NEAREST)
    dr = ImageDraw.Draw(im)
    for x, y in m['salvajes']:
        dr.ellipse((x / cel * 2 - 3, y / cel * 2 - 3, x / cel * 2 + 3, y / cel * 2 + 3), fill=(200, 40, 40))
    a = m['alfa']
    dr.ellipse((a['x'] / cel * 2 - 6, a['y'] / cel * 2 - 6, a['x'] / cel * 2 + 6, a['y'] / cel * 2 + 6), fill=(250, 210, 30))
    dr.text((6, 4), b, fill=(255, 255, 255))
    tiles.append(im)
w, h = tiles[0].size
c = Image.new('RGB', (3 * w + 8, 2 * h + 4), (0, 0, 0))
for k, t in enumerate(tiles):
    c.paste(t, ((k % 3) * (w + 4), (k // 3) * (h + 4)))
c.save(sys.argv[2])
print(sys.argv[2], c.size)
