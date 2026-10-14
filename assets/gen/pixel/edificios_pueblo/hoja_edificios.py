"""5 edificios del pueblo (2026-10-14): Klein a 1024² (gen_edificios.sh) → reducir.py (BOX premultiplicado,
alfa umbral, paleta corta, poda de bordes) al ancho nativo de cada edificio → candidatos/ + hoja_edificios.png
(4 semillas por fila, ×3 sobre césped).

Uso: python -I assets/gen/pixel/edificios_pueblo/hoja_edificios.py   (desde la raíz del repo)
"""
import numpy as np
from PIL import Image
from scipy import ndimage
import reducir as R


def fondo(a):
    """Magenta del fondo y sus sombras (Klein a 1024² pinta sombras moradas que la máscara de reducir.py no ve):
    todo píxel de tono magenta (R y B muy por encima de G), y luego solo la mancha opaca mayor (fuera motas)."""
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    bg = (r - g > 45) & (b - g > 30) & (abs(r - b) < 110) & (g < 120)   # G bajo: no come flores rosas
    lab, n = ndimage.label(ndimage.binary_opening(~bg, iterations=2))
    big = lab == (np.bincount(lab.ravel())[1:].argmax() + 1)
    return ~ndimage.binary_fill_holes(big) | (bg & ~big)


R.fondo = fondo

B = R.B
ANCHOS = {'almacen': 140, 'taller': 130, 'nidogrande': 84, 'cobertizo': 92, 'santuario': 112}
SEMILLAS = [1, 2, 3, 4]
Z, CW, CH = 3, 150, 175

R.COLORES = 24
out = B / 'candidatos'
out.mkdir(exist_ok=True)
sheet = Image.new('RGBA', (len(SEMILLAS) * CW * Z, len(ANCHOS) * CH * Z), (150, 176, 96, 255))
for fi, (sid, w) in enumerate(ANCHOS.items()):
    for si, s in enumerate(SEMILLAS):
        f = B / f'klein/{sid}_s{s}_0.png'
        if not f.exists():
            continue
        r = R.podar(R.reducir(f, w))
        r.save(out / f'{sid}_s{s}.png')
        big = r.resize((r.width * Z, r.height * Z), Image.NEAREST)
        x = si * CW * Z + (CW * Z - big.width) // 2
        y = fi * CH * Z + CH * Z - big.height - 4 * Z
        sheet.alpha_composite(big, (x, max(y, fi * CH * Z)))
sheet.save(B / 'hoja_edificios.png')
print('ok', sheet.size)
