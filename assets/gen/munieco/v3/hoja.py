"""Muñeco de prácticas v3 (2026-10-17): Klein 512² (mc_s<N>_0.png, receta de decor_pueblo/gen.sh) → reducir.py de
edificios_pueblo (BOX premultiplicado, 16 colores, poda) con la máscara de fondo de hoja_edificios_fondo.
Uso: python -I assets/gen/munieco/v3/hoja.py            → candidatos/ + hoja_reducida.png
     python -I assets/gen/munieco/v3/hoja.py 1 32       → final/munieco.png (semilla 1, 32 px de ancho)
"""
import sys
from pathlib import Path
R0 = Path(__file__).resolve().parents[2] / 'pixel'
sys.path.insert(0, str(R0 / 'edificios_pueblo')); sys.path.insert(0, str(R0 / 'decor_pueblo'))
from PIL import Image, ImageDraw
import reducir as R
from hoja_edificios_fondo import fondo
R.fondo = fondo
B = Path('assets/gen/munieco/v3')

def hacer(s, w): return R.podar(R.reducir(B / f'klein_mc_s{s}_0.png' if (B / f'klein_mc_s{s}_0.png').exists() else B / f'mc_s{s}_0.png', w))

if len(sys.argv) == 3:
    (B / 'final').mkdir(exist_ok=True); r = hacer(sys.argv[1], int(sys.argv[2])); r.save(B / 'final/munieco.png'); print(r.size); sys.exit()
SEM, ANCHOS, Z = [1, 2, 3, 4, 5, 6], [28, 32, 36], 4
(B / 'candidatos').mkdir(exist_ok=True)
CW, CH = 48, 80
sheet = Image.new('RGBA', (len(SEM) * CW * Z, len(ANCHOS) * CH * Z), (150, 176, 96, 255)); dr = ImageDraw.Draw(sheet)
for fi, w in enumerate(ANCHOS):
    for si, s in enumerate(SEM):
        r = hacer(s, w); r.save(B / f'candidatos/s{s}_w{w}.png')
        big = r.resize((r.width * Z, r.height * Z), Image.NEAREST)
        sheet.alpha_composite(big, (si * CW * Z + (CW * Z - big.width) // 2, fi * CH * Z + CH * Z - big.height - 2 * Z))
        dr.text((si * CW * Z + 6, fi * CH * Z + 4), f's{s} w{w} {r.width}x{r.height}', fill=(30, 40, 20, 255))
sheet.save(B / 'hoja_reducida.png'); print('ok', sheet.size)
