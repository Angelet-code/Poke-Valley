"""Horno, guardería, ladrillo y plato (2026-10-14): copia de hoja_edificios.py para klein2/ (gen_edificios2.sh).
Misma máscara de fondo (tono magenta con G < 120 + mancha mayor, por las sombras moradas de Klein); en los iconos
sin apertura (conserva el contorno) y los huecos de la mancha se rellenan (el guiso morado del plato tiene tono magenta y no debe salir como fondo).
Reducción con reducir.py (BOX premultiplicado, alfa umbral 110, paleta corta, poda de bordes).

Uso: python -I assets/gen/pixel/edificios_pueblo/hoja_edificios2.py          → candidatos2/ + hoja_horno_guarderia.png
     python -I assets/gen/pixel/edificios_pueblo/hoja_edificios2.py horno 3 86   → final/horno.png (id, semilla, ancho)
"""
import sys
import numpy as np
from PIL import Image
from scipy import ndimage
sys.path.insert(0, str(__import__('pathlib').Path(__file__).parent))   # python -I no añade la carpeta del guion
import reducir as R

ICONOS = {'ladrillo', 'plato'}
modo = {'icono': False}


def fondo(a):
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    bg = (r - g > 45) & (b - g > 30) & (abs(r - b) < 110) & (g < 120)   # G bajo: no come flores rosas
    # iconos (512²): sin apertura, que se come el contorno oscuro de 3-4 px de los ladrillos
    lab, n = ndimage.label(~bg if modo['icono'] else ndimage.binary_opening(~bg, iterations=2))
    big = lab == (np.bincount(lab.ravel())[1:].argmax() + 1)
    lleno = ndimage.binary_fill_holes(big)
    return ~lleno if modo['icono'] else ~lleno | (bg & ~big)


R.fondo = fondo
B = R.B
K = B / 'klein2'
FILAS = [('horno', [1, 2, 3, 4, 5, 6], 86, 24), ('guarderia', [1, 2, 3, 4, 5, 6], 96, 24),
         ('ladrillo', [7, 8, 9, 10, 11, 12], 21, 14), ('plato', [1, 2, 3, 4, 5, 6], 20, 16)]


def contorno(im, k=0.62):
    """Iconos: a ~20 px el contorno oscuro de Klein (3-4 px a 512²) se pierde en la reducción BOX; se oscurece
    el color propio de cada píxel del borde (contorno tintado, no negro, como el del tronco)."""
    a = np.array(im)
    op = a[..., 3] > 0
    pad = np.pad(op, 1)
    borde = op & ~(pad[:-2, 1:-1] & pad[2:, 1:-1] & pad[1:-1, :-2] & pad[1:-1, 2:])
    a[borde, :3] = (a[borde, :3] * k).astype(np.uint8)
    return Image.fromarray(a, 'RGBA')


def uno(sid, s, w, colores):
    modo['icono'] = sid in ICONOS
    R.COLORES = colores
    r = R.podar(R.reducir(K / f'{sid}_s{s}_0.png', w))
    return contorno(r) if modo['icono'] else r


def hoja():
    out = B / 'candidatos2'
    out.mkdir(exist_ok=True)
    CW, CH = 104, 110
    sheet = Image.new('RGBA', (6 * CW * 3, 2 * CH * 3 + 2 * 40 * 8), (150, 176, 96, 255))
    y0 = 0
    for sid, semillas, w, col in FILAS:
        Z, cw, ch = (3, CW, CH) if sid not in ICONOS else (8, CW * 3 // 8, 40)
        for si, s in enumerate(semillas):
            r = uno(sid, s, w, col)
            r.save(out / f'{sid}_s{s}.png')
            big = r.resize((r.width * Z, r.height * Z), Image.NEAREST)
            x = si * cw * Z + (cw * Z - big.width) // 2
            sheet.alpha_composite(big, (x, y0 + max(0, ch * Z - big.height - 3 * Z)))
        y0 += ch * Z
    sheet.save(B / 'hoja_horno_guarderia.png')
    print('ok', sheet.size)


if __name__ == '__main__':
    if len(sys.argv) == 4:
        sid, s, w = sys.argv[1], sys.argv[2], int(sys.argv[3])
        col = {f[0]: f[3] for f in FILAS}[sid]
        r = uno(sid, s, w, col)
        r.save(B / f'final/{sid}.png')
        print(sid, r.size)
    else:
        hoja()
