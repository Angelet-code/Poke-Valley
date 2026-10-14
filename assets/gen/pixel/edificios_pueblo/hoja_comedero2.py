"""Comedero nuevo (2026-10-14): copia de hoja_edificios2.py (modo icono) para klein3/ (gen_comedero2.sh).
Máscara de fondo: tono magenta con G < 120, mancha mayor, huecos rellenos (bayas rosas/moradas no salen como fondo).
Reducción con reducir.py (BOX premultiplicado, alfa umbral 110, paleta corta, poda de bordes) + contorno tintado
(borde x0,62, no negro) porque a ~36 px el contorno de Klein se pierde en el BOX.

Uso: python -I assets/gen/pixel/edificios_pueblo/hoja_comedero2.py              → candidatos3/ + hoja_comedero2.png
     python -I assets/gen/pixel/edificios_pueblo/hoja_comedero2.py cm_tronco 3 38 → final/comedero.png (id, semilla, ancho)
"""
import sys
import numpy as np
from PIL import Image
from scipy import ndimage
sys.path.insert(0, str(__import__('pathlib').Path(__file__).parent))   # python -I no añade la carpeta del guion
import reducir as R

COLORES = 16
ANCHO = 38
IDEAS = ['cm_tronco', 'cm_mesa', 'cm_piedra']
SEMILLAS = [1, 2, 3, 4, 5]


def fondo(a):
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    bg = (r - g > 45) & (b - g > 30) & (abs(r - b) < 110) & (g < 120)
    lab, n = ndimage.label(~bg)
    big = lab == (np.bincount(lab.ravel())[1:].argmax() + 1)
    return ~ndimage.binary_fill_holes(big)


R.fondo = fondo
R.COLORES = COLORES
B = R.B
K = B / 'klein3'


def contorno(im, k=0.62):
    a = np.array(im)
    op = a[..., 3] > 0
    pad = np.pad(op, 1)
    borde = op & ~(pad[:-2, 1:-1] & pad[2:, 1:-1] & pad[1:-1, :-2] & pad[1:-1, 2:])
    a[borde, :3] = (a[borde, :3] * k).astype(np.uint8)
    return Image.fromarray(a, 'RGBA')


def uno(sid, s, w):
    return contorno(R.podar(R.reducir(K / f'{sid}_s{s}_0.png', w)))


def hoja():
    out = B / 'candidatos3'
    out.mkdir(exist_ok=True)
    Z, CW, CH = 6, 50, 40
    # cada celda: el reducido x6 y, a su lado arriba, la imagen original en miniatura (para ver el diseño)
    sheet = Image.new('RGBA', (len(SEMILLAS) * CW * Z, len(IDEAS) * (CH * Z + 20)), (150, 176, 96, 255))
    for fi, sid in enumerate(IDEAS):
        for si, s in enumerate(SEMILLAS):
            f = K / f'{sid}_s{s}_0.png'
            if not f.exists():
                continue
            r = uno(sid, s, ANCHO)
            r.save(out / f'{sid}_s{s}.png')
            big = r.resize((r.width * Z, r.height * Z), Image.NEAREST)
            x0, y0 = si * CW * Z, fi * (CH * Z + 20)
            mini = Image.open(f).convert('RGBA').resize((96, 96))
            sheet.alpha_composite(mini, (x0 + CW * Z - 100, y0 + 4))
            sheet.alpha_composite(r, (x0 + 8, y0 + 8))   # a escala 1
            sheet.alpha_composite(big, (x0 + (CW * Z - big.width) // 2, y0 + CH * Z - big.height))
            print(sid, s, r.size)
    sheet.save(B / 'hoja_comedero2.png')
    print('ok', sheet.size)


if __name__ == '__main__':
    if len(sys.argv) == 4:
        sid, s, w = sys.argv[1], sys.argv[2], int(sys.argv[3])
        r = uno(sid, s, w)
        r.save(B / 'final/comedero.png')
        print(sid, s, r.size)
    else:
        hoja()
