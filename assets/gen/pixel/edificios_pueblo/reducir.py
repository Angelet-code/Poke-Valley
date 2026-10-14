"""Nido y comedero (0.2b, 2026-10-13): de la imagen de Klein (klein/<id>_s<N>_0.png, fondo magenta) al sprite
a escala nativa. Misma receta que el tronco (assets/gen/pixel/tronco_klein/reducir.py): fondo magenta fuera,
reducción BOX premultiplicada al ancho pedido, alfa por umbral y paleta corta (MEDIANCUT).

Uso: python -I assets/gen/pixel/edificios_pueblo/reducir.py            → candidatos/ + hoja.png (×6 sobre césped)
     python -I assets/gen/pixel/edificios_pueblo/reducir.py nido 4 34  → un solo sprite (id, semilla, ancho) a final/,
     con los píxeles sueltos del borde podados (pixel_clean.py se come el dibujo: ramitas y bayas)
"""
import sys
from pathlib import Path
import numpy as np
from PIL import Image

B = Path('assets/gen/pixel/edificios_pueblo')
COLORES = 16
UMBRAL = 110
fondo = None   # máscara de fondo alternativa (la pone hoja_edificios.py)


def reducir(f, w):
    a = np.array(Image.open(f).convert('RGB')).astype(int)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    bg = fondo(a) if fondo else (r > 150) & (b > 110) & (g < 100) & (r - g > 90)  # magenta (varía de tono)
    ys, xs = np.where(~bg)
    y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
    rgba = np.dstack([a, np.where(bg, 0, 255)]).astype(np.uint8)[y0:y1, x0:x1]
    im = Image.fromarray(rgba, 'RGBA')
    h = round(w * im.height / im.width)
    p = np.array(im).astype(float)
    p[..., :3] *= p[..., 3:] / 255
    sm = np.array(Image.fromarray(p[..., :3].astype(np.uint8)).resize((w, h), Image.BOX)).astype(float)
    al = np.array(Image.fromarray(p[..., 3].astype(np.uint8)).resize((w, h), Image.BOX)).astype(float)
    m = al > UMBRAL
    rgb = np.where(m[..., None], np.clip(sm * 255 / np.maximum(al, 1)[..., None], 0, 255), 0).astype(np.uint8)
    q = Image.fromarray(rgb).quantize(COLORES, method=Image.Quantize.MEDIANCUT).convert('RGB')
    return Image.fromarray(np.dstack([np.array(q), np.where(m, 255, 0)]).astype(np.uint8), 'RGBA')


def podar(im, vecinos=2, pasadas=2):
    """Quita los píxeles sueltos del borde (con <= `vecinos` vecinos opacos de 8), sin tocar el interior."""
    a = np.array(im)
    for _ in range(pasadas):
        op = a[..., 3] > 0
        pad = np.pad(op, 1)
        n = sum(pad[1 + dy:pad.shape[0] - 1 + dy, 1 + dx:pad.shape[1] - 1 + dx]
                for dy in (-1, 0, 1) for dx in (-1, 0, 1) if dy or dx)
        a[op & (n <= vecinos)] = 0
    return Image.fromarray(a, 'RGBA')


def hoja():
    out = B / 'candidatos'
    out.mkdir(exist_ok=True)
    filas = [('nido', [2, 4, 5], [30, 34, 38]), ('comedero', [1, 2, 4], [28, 32, 36])]
    Z, CW, CH = 6, 44, 34
    sheet = Image.new('RGBA', (9 * CW * Z, 2 * CH * Z), (150, 176, 96, 255))
    for fi, (sid, semillas, anchos) in enumerate(filas):
        for si, s in enumerate(semillas):
            for wi, w in enumerate(anchos):
                r = reducir(B / f'klein/{sid}_s{s}_0.png', w)
                r.save(out / f'{sid}_s{s}_{w}.png')
                big = r.resize((r.width * Z, r.height * Z), Image.NEAREST)
                sheet.alpha_composite(big, ((si * 3 + wi) * CW * Z + 2 * Z, fi * CH * Z + 2 * Z))
    sheet.save(B / 'hoja.png')


if __name__ == '__main__':
    if len(sys.argv) == 4:
        sid, s, w = sys.argv[1], sys.argv[2], int(sys.argv[3])
        (B / 'final').mkdir(exist_ok=True)
        podar(reducir(B / f'klein/{sid}_s{s}_0.png', w)).save(B / f'final/{sid}.png')
    else:
        hoja()
