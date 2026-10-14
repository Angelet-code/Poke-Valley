"""Decorados del pueblo (2026-10-14): Klein 512² (gen.sh) → reducir.py de edificios_pueblo (BOX premultiplicado,
alfa umbral, 16 colores, poda de bordes) al ancho nativo de cada objeto → candidatos/ + hoja.png (4 semillas
por fila, ×4 sobre césped).

Uso: python -I assets/gen/pixel/decor_pueblo/hoja.py              (desde la raíz del repo)
     python -I assets/gen/pixel/decor_pueblo/hoja.py barril 3      → final/barril.png
"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / 'edificios_pueblo'))
sys.path.insert(0, str(Path(__file__).resolve().parent))
import numpy as np
from PIL import Image, ImageDraw
import reducir as R
from hoja_edificios_fondo import fondo

R.fondo = fondo
B = Path('assets/gen/pixel/decor_pueblo')
# ancho nativo en px de mundo (casilla 24 px; Bulbasaur ≈ 24 px de alto)
ANCHOS = {'farol': 11, 'pozo': 38, 'valla': 30, 'barril': 16, 'cajas': 20, 'banco': 34, 'maceta': 14,
          'carretilla': 30, 'lena': 30, 'saco': 16, 'cartel': 18, 'fuente': 40, 'tocon': 22, 'cubo': 13}
SEMILLAS = [1, 2, 3, 4]
SIN_ROSA = {'farol'}   # el halo de luz se mezcla con el magenta y queda rosa: fuera


def hacer(sid, s):
    r = R.reducir(B / f'klein/{sid}_s{s}_0.png', ANCHOS[sid])
    if sid in SIN_ROSA:
        a = np.array(r).astype(int)
        rosa = (a[..., 0] - a[..., 1] > 50) & (a[..., 2] - a[..., 1] > 25)
        a[rosa, 3] = 0
        r = Image.fromarray(a.astype(np.uint8), 'RGBA')
    return R.podar(r)

if len(sys.argv) == 3:
    sid, s = sys.argv[1], sys.argv[2]
    (B / 'final').mkdir(exist_ok=True)
    hacer(sid, s).save(B / f'final/{sid}.png')
    sys.exit()

Z, CW, CH = 4, 50, 56
out = B / 'candidatos'
out.mkdir(exist_ok=True)
cols = 2 * len(SEMILLAS)   # dos objetos por fila
filas = (len(ANCHOS) + 1) // 2
sheet = Image.new('RGBA', (cols * CW * Z, filas * CH * Z), (150, 176, 96, 255))
dr = ImageDraw.Draw(sheet)
for i, (sid, w) in enumerate(ANCHOS.items()):
    fi, base = i // 2, (i % 2) * len(SEMILLAS)
    for si, s in enumerate(SEMILLAS):
        f = B / f'klein/{sid}_s{s}_0.png'
        if not f.exists():
            continue
        r = hacer(sid, s)
        r.save(out / f'{sid}_s{s}.png')
        big = r.resize((r.width * Z, r.height * Z), Image.NEAREST)
        x = (base + si) * CW * Z + (CW * Z - big.width) // 2
        y = fi * CH * Z + CH * Z - big.height - 3 * Z
        sheet.alpha_composite(big, (x, max(y, fi * CH * Z + 12)))
        dr.text(((base + si) * CW * Z + 6, fi * CH * Z + 4), f'{sid} s{s}', fill=(30, 40, 20, 255))
sheet.save(B / 'hoja.png')
print('ok', sheet.size)
