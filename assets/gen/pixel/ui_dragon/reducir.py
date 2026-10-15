"""Marco de élite del alfa (HUD del modo aventura, 2026-10-15): de la imagen de Klein (klein/<id>_0.png, aro dorado
con un Aerodactyl dorado sobre magenta) al pixel art del HUD. Receta de los edificios del pueblo
(edificios_pueblo/reducir.py: magenta fuera, BOX premultiplicado, umbral de alfa, paleta corta y poda del borde).

El ancho se elige para que el hueco del aro mida HUECO px (lo justo para la cara del retrato). Escribe
final/<id>.png + final/<id>.json (centro del hueco, para colocarlo) y maqueta.png (las dos opciones sobre el marco
del HUD, ×4).

Uso: python -I assets/gen/pixel/ui_dragon/reducir.py
"""
import json
import sys
from pathlib import Path
import numpy as np
from PIL import Image
from scipy import ndimage

sys.path.insert(0, 'assets/gen/pixel/edificios_pueblo')
import reducir as R   # noqa: E402

B = Path('assets/gen/pixel/ui_dragon')
OPCIONES = {'aero_lado': 'aero_lado_r_0.png', 'aero_alas': 'aero_alas_r_0.png'}
HUECO = 30
R.COLORES = 20


def hueco(im):
    """Hueco del aro: la mancha transparente más grande que no toca el borde. Devuelve (cx, cy, ancho)."""
    tr = np.array(im)[..., 3] == 0
    lab, n = ndimage.label(tr)
    borde = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]])))
    mejor = None
    for i in range(1, n + 1):
        if i in borde:
            continue
        ys, xs = np.where(lab == i)
        if mejor is None or len(xs) > mejor[0]:
            mejor = (len(xs), (xs.min() + xs.max()) / 2, (ys.min() + ys.max()) / 2, xs.max() - xs.min() + 1)
    return mejor[1:] if mejor else None


def hacer(sid, f):
    for w in range(30, 90):
        im = R.podar(R.reducir(B / 'klein' / f, w))
        h = hueco(im)
        if h and h[2] >= HUECO:
            break
    (B / 'final').mkdir(exist_ok=True)
    im.save(B / f'final/{sid}.png')
    json.dump({'w': im.width, 'h': im.height, 'cx': h[0], 'cy': h[1], 'hueco': int(h[2])}, open(B / f'final/{sid}.json', 'w'))
    return im, h


def maqueta(piezas):
    Z, FW, FH = 4, 200, 64
    sheet = Image.new('RGBA', (FW * len(piezas) * Z, FH * Z), (58, 80, 52, 255))
    import re
    xml = open('assets/sprites/pokemon/0017/AnimData.xml').read()
    m = re.search(r'<Name>Idle</Name>.*?<FrameWidth>(\d+)</FrameWidth>\s*<FrameHeight>(\d+)</FrameHeight>', xml, re.S)
    fw, fh = int(m.group(1)), int(m.group(2))
    cara = Image.open('assets/sprites/pokemon/0017/Idle-Anim.png').convert('RGBA').crop((0, 0, fw, fh))
    cara = cara.crop(cara.getbbox())
    for k, (im, (cx, cy, _)) in enumerate(piezas):
        c = Image.new('RGBA', (FW, FH), (58, 80, 52, 255))
        x, y = 40, 16
        px = c.load()
        for i in range(128):
            for j in range(30):
                borde = i in (0, 127) or j in (0, 29)
                px[x + i, y + j] = (200, 150, 42, 255) if borde else (246, 231, 193, 255)
        for i in range(26, 90):
            for j in range(14, 18):
                px[x + i, y + j] = (143, 211, 106, 255)
        # Retrato: fondo oscuro redondo en el hueco y la cara encima; el aro, por encima de todo.
        ox, oy = x + 13, y + 15
        for i in range(-15, 16):
            for j in range(-15, 16):
                if i * i + j * j <= 15 * 15:
                    px[ox + i, oy + j] = (60, 44, 30, 255)
        c.alpha_composite(cara, (ox - cara.width // 2, oy - cara.height // 2))
        c.alpha_composite(im, (round(ox - cx), round(oy - cy)))
        sheet.alpha_composite(c.resize((FW * Z, FH * Z), Image.NEAREST), (k * FW * Z, 0))
    sheet.save(B / 'maqueta.png')


if __name__ == '__main__':
    piezas = []
    for sid, f in OPCIONES.items():
        im, h = hacer(sid, f)
        print(sid, im.size, 'hueco', h)
        piezas.append((im, h))
    maqueta(piezas)
