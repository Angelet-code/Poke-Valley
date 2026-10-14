"""Templo en 10 niveles: klein/nNN.png (1024², fondo magenta) → final/templo_NN.png a escala nativa + hoja.png.
Misma reducción que los edificios del pueblo (edificios_pueblo/reducir.py con la máscara de sombras moradas de
hoja_edificios.py, 24 colores, poda). Tamaño de cada nivel en TAM (nivel 1 = 112×152 = santuario actual).

Uso: python -I assets/gen/pixel/templo_niveles/hoja.py   (desde la raíz del repo)
"""
import sys
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw
sys.path.insert(0, 'assets/gen/pixel/edificios_pueblo')
import reducir as R
from scipy import ndimage


def fondo(a):
    """Fondo = lo de color de fondo CONECTADO AL BORDE (relleno desde fuera que se para en el contorno oscuro del
    dibujo), así los pétalos rosas de dentro de la copa no se borran aunque su matiz se parezca al fondo.
    Color de fondo: el magenta de Klein (y su deriva en la cadena, p. ej. 176,110,130: mediana de las esquinas) y sus
    sombras moradas (mismo matiz, más oscuras). Luego solo la mancha opaca mayor, con sus huecos rellenos."""
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    h, w = g.shape
    c0 = np.median(np.array([a[4, 4], a[4, w - 5], a[h - 5, 4], a[h - 5, w - 5]]), 0)
    su = a.sum(-1)
    mat = np.abs(a / su.clip(1)[..., None] - c0 / c0.sum()).sum(-1) < 0.06
    cand = ((r - g > 45) & (b - g > 30) & (g < 120)) | (np.abs(a - c0).sum(-1) < 50) | (mat & (su <= c0.sum() * 1.05))
    cand |= (r - g > 30) & (b - g > 18) & (su < c0.sum())   # sombra morada (más saturada que el fondo: 98,52,80)
    cand &= su > 120                      # el contorno oscuro nunca es fondo: frena el relleno
    lab, n = ndimage.label(cand)
    borde = np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))
    bg = np.isin(lab, borde[borde > 0])
    lab, n = ndimage.label(ndimage.binary_opening(~bg, iterations=2))
    big = ndimage.binary_fill_holes(lab == (np.bincount(lab.ravel())[1:].argmax() + 1))
    return ~big


R.fondo = fondo
R.COLORES = 24
B = Path('assets/gen/pixel/templo_niveles')
# Tamaño en el juego de cada nivel: progresión fija de la raíz del área (√(ancho×alto), px); nivel 1 = 131 (el
# santuario actual, 112×152). Por área y no por ancho porque el muro del nivel 5 lo ensancha sin hacerlo más alto.
# (La escala acumulada de escalas.txt daba saltos —nivel 10 a 869 px— porque la IA no llena el sitio que se le
# deja; escalas.txt queda solo como registro.)
TAM = [131, 136, 142, 150, 160, 172, 186, 200, 216, 234]



niveles = sorted(B.glob('klein/n[0-9][0-9].png'))

(B / 'final').mkdir(exist_ok=True)
sprites = []
for f in niveles:
    t = TAM[int(f.stem[1:]) - 1]
    p = R.reducir(f, 100)
    r = R.podar(R.reducir(f, round(t * (p.width / p.height) ** 0.5)))
    r.save(B / f'final/templo_{f.stem[1:]}.png')
    sprites.append(r)
Z, CW = 2, max(s.width for s in sprites) + 8
CH = max(s.height for s in sprites) + 14
cols = 5
sheet = Image.new('RGBA', (cols * CW * Z, ((len(sprites) + cols - 1) // cols) * CH * Z), (150, 176, 96, 255))
d = ImageDraw.Draw(sheet)
for i, s in enumerate(sprites):
    cx, cy = (i % cols) * CW * Z, (i // cols) * CH * Z
    big = s.resize((s.width * Z, s.height * Z), Image.NEAREST)
    sheet.alpha_composite(big, (cx + (CW * Z - big.width) // 2, cy + CH * Z - big.height - 2 * Z))
    d.text((cx + 6, cy + 4), f'Nivel {i + 1}  ({s.width}x{s.height})', fill=(255, 255, 255, 255))
sheet.save(B / 'hoja.png')
print('ok', [s.size for s in sprites])
