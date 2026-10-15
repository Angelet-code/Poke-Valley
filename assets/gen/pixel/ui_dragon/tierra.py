"""Adorno del marco del alfa (HUD, 2026-10-15): el sprite de Aerodactyl (PMD, assets/sprites/pokemon/0142, Idle
mirando a la derecha) entero de color tierra, a su resolución (32×30). El HUD lo pinta más pequeño que el resto
(escala S − 1, HudAventura.ts), porque reducirlo a menos píxeles le borraba la cabeza y las alas (pruebas en
tierra_cmp.png).

Cada color pasa a una rampa de 5 marrones según su luminosidad: el contorno negro de PMD, al más oscuro; el resto,
por cuantiles a los 4 claros. Escribe assets/game/pixel/ui/aerodactyl_alfa.png (la versión anterior, a color, en
assets/game/pixel/ui/v1_aerodactyl/) y tierra_x8.png.

Uso: python -I assets/gen/pixel/ui_dragon/tierra.py
"""
import re
from pathlib import Path
import numpy as np
from PIL import Image

RAMPA = [(52, 34, 20), (96, 64, 38), (139, 96, 58), (176, 130, 82), (212, 172, 118)]   # tierra, de oscuro a claro
B = Path('assets/gen/pixel/ui_dragon')
OUT = Path('assets/game/pixel/ui/aerodactyl_alfa.png')

xml = open('assets/sprites/pokemon/0142/AnimData.xml').read()
m = re.search(r'<Name>Idle</Name>.*?<FrameWidth>(\d+)</FrameWidth>\s*<FrameHeight>(\d+)</FrameHeight>', xml, re.S)
fw, fh = int(m.group(1)), int(m.group(2))
fr = Image.open('assets/sprites/pokemon/0142/Idle-Anim.png').convert('RGBA').crop((0, fh * 2, fw, fh * 3))
fr = fr.crop(fr.getbbox())

src = np.array(fr).astype(float)
op = src[..., 3] > 0
lum = src[..., :3] @ [0.299, 0.587, 0.114]
contorno = op & (lum < 45)
cortes = np.quantile(lum[op & ~contorno], [0.25, 0.55, 0.85])
nivel = 1 + np.searchsorted(cortes, lum)
nivel[contorno] = 0
out = np.zeros((*op.shape, 4), np.uint8)
for i, c in enumerate(RAMPA):
    out[op & (nivel == i)] = (*c, 255)
im = Image.fromarray(out, 'RGBA')
im.save(OUT)

Z = 8
hoja = Image.new('RGBA', ((fr.width * 2 + 6) * Z, (fr.height + 4) * Z), (246, 231, 193, 255))
hoja.alpha_composite(fr.resize((fr.width * Z, fr.height * Z), Image.NEAREST), (2 * Z, 2 * Z))
hoja.alpha_composite(im.resize((fr.width * Z, fr.height * Z), Image.NEAREST), ((fr.width + 4) * Z, 2 * Z))
hoja.save(B / 'tierra_x8.png')
print(im.size)
