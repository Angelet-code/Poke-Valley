"""Huella (colisión) de los edificios de la ciudad por piezas, medida en su recorte del catálogo (cd_*.png): el cuerpo
(alfa sin el parche de suelo verdoso ni la sombra), de sus paredes de lado a lado y desde la base hasta FONDO de su
alto (en 3/4 la planta del edificio sube más que la fachada). La escribe como `caja` (fracciones) en elegidos.json;
luego: python -I lab/tools/catalogo_arcane.py --solo cd_<id> ...  Uso: python -I .../huellas.py [--ver]"""
import json, sys
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw
D = Path(__file__).parent
CAT = Path('lab/assets/elementos_arcane')
FONDO = 0.5
cat = {e['id']: e for e in json.loads((CAT / 'elementos.json').read_text(encoding='utf-8'))['elementos']}
sel = json.loads((D / 'elegidos.json').read_text(encoding='utf-8'))
ver = []
for id_, v in sel.items():
    if v[0] != 'casa':
        continue
    e = cat[f'cd_{id_}']
    a = np.asarray(Image.open(CAT / e['archivo']).convert('RGBA')).astype(int)
    r, g, b, al = a[..., 0], a[..., 1], a[..., 2], a[..., 3]
    verdoso = (g > r + 6) & (g > b + 2)                      # parche de césped y sombra verde pintados
    cuerpo = (al > 128) & ~verdoso
    h, w = cuerpo.shape
    filas = np.nonzero(cuerpo.sum(1) > w * 0.2)[0]
    base, top = int(filas.max()), int(filas.min())
    banda = cuerpo[int(base - (base - top) * 0.35):base + 1]   # columnas de las paredes (abajo), no del alero
    cols = np.nonzero(banda.sum(0) > banda.shape[0] * 0.3)[0]
    x0, x1 = int(cols.min()), int(cols.max())
    y0 = int(base - (base - top) * FONDO)
    sel[id_] = v[:3] + [[round(x0 / w, 3), round(y0 / h, 3), round(x1 / w, 3), round((base + 1) / h, 3)]]
    ver.append((id_, e, (x0, y0, x1, base)))
(D / 'elegidos.json').write_text(json.dumps(sel, indent=1), encoding='utf-8')
if '--ver' in sys.argv:
    Z = 240; hoja = Image.new('RGB', (6 * Z, 2 * (Z + 14)), (40, 40, 40)); d = ImageDraw.Draw(hoja)
    for n, (id_, e, (x0, y0, x1, y1)) in enumerate(ver):
        im = Image.open(CAT / e['archivo']).convert('RGBA'); f = Z / max(im.size)
        im2 = im.resize((round(im.width * f), round(im.height * f))); x, y = (n % 6) * Z, (n // 6) * (Z + 14)
        hoja.paste(im2, (x, y), im2); d.rectangle([x + x0 * f, y + y0 * f, x + x1 * f, y + y1 * f], outline=(255, 0, 0), width=2)
        d.text((x + 2, y + Z + 1), id_, fill=(230, 230, 230))
    hoja.save(D / 'huellas.jpg', quality=88)
print('\n'.join(f'{i}: {sel[i][3]}' for i, _, _ in ver))
