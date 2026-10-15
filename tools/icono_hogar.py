# Icono pixel art de la piedra de hogar (modo aventura): piedra blanca con una runa azul, como la del WoW.
# Píxel a píxel, 16×16. Uso: python -I tools/icono_hogar.py [vista_ampliada.png]
import sys
from pathlib import Path
from PIL import Image

G = """
................
................
....oooooooo....
..ooHHWWWWWWoo..
.oHHWWWccccWLLo.
.oHWWWcbbbbcWLLo
oWWWWcbgggbcWLLo
oWWWcbgcccbbcLLo
oWWWcbgcbbcbcLSo
oWWWcbgcbccbcLSo
oWWWWcbgcbbcLLSo
.oWWWWcbgcccLLSo
.oLWWWWcbbbcLSSo
..ooLLLLccLLSoo.
....ooSSSSSSoo..
......oooooo....
"""
P = {'o': (52, 58, 74), 'W': (226, 228, 222), 'H': (250, 250, 246), 'L': (184, 188, 186), 'S': (138, 142, 146),
     'b': (34, 110, 220), 'g': (150, 220, 255), 'c': (196, 222, 240)}   # c: halo de la runa sobre la piedra

OUT = Path(__file__).resolve().parent.parent / 'assets/game/pixel/items/piedra_hogar.png'
im = Image.new('RGBA', (16, 16), (0, 0, 0, 0))
for y, fila in enumerate(G.strip().split('\n')):
    for x, c in enumerate(fila):
        if c != '.': im.putpixel((x, y), P[c] + (255,))
im.save(OUT)
if len(sys.argv) > 1: im.resize((192, 192), Image.NEAREST).save(sys.argv[1])
print(OUT)
