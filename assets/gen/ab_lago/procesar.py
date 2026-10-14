"""Prueba A/B de estilo del Lago Celeste (2026-10-15): de las imágenes de gen.sh a los elementos que se colocan en el lago.

Uso (desde la raíz del repo):
  python -I assets/gen/ab_lago/procesar.py hoja                 → hoja.png: todas las semillas, dibujo arriba y pixel abajo
  python -I assets/gen/ab_lago/procesar.py hoja2                → hoja2.png: ronda 2 (arcane y acuarela, gen2.sh)
  python -I assets/gen/ab_lago/procesar.py pintado arcane sauce 2 → como el dibujo (ampliar + recortar) → final_arcane/
  python -I assets/gen/ab_lago/procesar.py final sauce 2 3      → id, semilla dibujo, semilla pixel:
       dibujo: ampliar ×2 (lab/tools/ampliar.py, anime_6B) + recortar (lab/tools/recortar.py) → final_dibujo/<id>.png,
               <id>_sombra.png y <id>.json (con `k` para que mida ANCHO[id] px de mundo, como catalogo_klein.py)
       pixel:  reducir.py de edificios_pueblo (BOX premultiplicado, 16 colores, poda) a PIXEL[id] px → final_pixel/<id>.png
"""
import json
import subprocess
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

RAIZ = Path('.').resolve()
B = RAIZ / 'assets/gen/ab_lago'
sys.path.insert(0, str(RAIZ / 'assets/gen/pixel/edificios_pueblo'))
sys.path.insert(0, str(RAIZ / 'assets/gen/pixel/decor_pueblo'))
sys.path.insert(0, str(RAIZ / 'lab/tools'))
import reducir as R  # noqa: E402
from hoja_edificios_fondo import fondo  # noqa: E402

R.fondo = fondo
IDS = ['sauce', 'juncos', 'muelle']
SEMILLAS = [1, 2, 3]
ANCHO = {'sauce': 84, 'juncos': 22, 'muelle': 72}      # dibujo: ancho en px de mundo
PIXEL = {'sauce': 72, 'juncos': 24, 'muelle': 64}      # pixel: ancho nativo (1 px = 1 px de mundo)
TIPO = {'sauce': 'arbol', 'juncos': 'roca', 'muelle': 'roca'}
F, PNG_X = 1 / 3, 2


def pixel(k, s):
    return R.podar(R.reducir(B / f'pixel/{k}_s{s}_0.png', PIXEL[k]))


def hoja():
    Z, C = 220, len(SEMILLAS)
    sheet = Image.new('RGBA', (len(IDS) * C * Z, 2 * Z + 20), (150, 176, 96, 255))
    dr = ImageDraw.Draw(sheet)
    for i, k in enumerate(IDS):
        for j, s in enumerate(SEMILLAS):
            x = (i * C + j) * Z
            f = B / f'dibujo/{k}_s{s}_0.png'
            if f.exists():
                sheet.paste(Image.open(f).convert('RGB').resize((Z, Z), Image.LANCZOS), (x, 0))
            if (B / f'pixel/{k}_s{s}_0.png').exists():
                p = pixel(k, s)
                z = max(1, min((Z - 20) // p.width, (Z - 20) // p.height))
                big = p.resize((p.width * z, p.height * z), Image.NEAREST)
                sheet.alpha_composite(big, (x + (Z - big.width) // 2, Z + 20 + Z - big.height - 6))
            dr.text((x + 6, Z + 4), f'{k} s{s}', fill=(20, 30, 10, 255))
    sheet.save(B / 'hoja.png')
    print('hoja', sheet.size)


def hoja2():
    Z, C, est = 220, len(SEMILLAS), ['arcane', 'acuarela']
    sheet = Image.new('RGB', (len(IDS) * C * Z, len(est) * (Z + 20)), (150, 176, 96))
    dr = ImageDraw.Draw(sheet)
    for fi, e in enumerate(est):
        for i, k in enumerate(IDS):
            for j, s in enumerate(SEMILLAS):
                f, x, y = B / f'{e}/{k}_s{s}_0.png', (i * C + j) * Z, fi * (Z + 20)
                if f.exists():
                    sheet.paste(Image.open(f).convert('RGB').resize((Z, Z), Image.LANCZOS), (x, y))
                dr.text((x + 6, y + Z + 4), f'{e} {k} s{s}', fill=(20, 30, 10))
    sheet.save(B / 'hoja2.png')
    print('hoja2', sheet.size)


def pintado(estilo, k, s):
    """Estilos pintados (arcane, acuarela): la misma receta que el dibujo, a final_<estilo>/."""
    sys.path.insert(0, str(RAIZ / 'lab/tools'))
    from recortar import recortar
    src = B / f'{estilo}/{k}_s{s}_0.png'
    x2 = src.with_name(src.stem + '_x2.png')
    if not x2.exists():
        subprocess.run([sys.executable, '-I', str(RAIZ / 'lab/tools/ampliar.py'), '--modelo', 'RealESRGAN_x4plus_anime_6B.safetensors',
                        '--entrada', str(src), '--salida', str(x2)], check=True)
    od = B / f'final_{estilo}'
    od.mkdir(exist_ok=True)
    e = recortar(x2, k, TIPO[k], od)
    e['k'] = round(ANCHO[k] / (e['w'] * F / PNG_X), 4)
    e['origen'] = f'{estilo}/{k}_s{s}_0.png'
    (od / f'{k}.json').write_text(json.dumps(e, ensure_ascii=False), encoding='utf-8')
    print(estilo, k, e['w'], 'x', e['h'], 'k', e['k'])


def final(k, sd, sp):
    sys.path.insert(0, str(RAIZ / 'lab/tools'))
    from recortar import recortar
    src = B / f'dibujo/{k}_s{sd}_0.png'
    x2 = src.with_name(src.stem + '_x2.png')
    if not x2.exists():
        subprocess.run([sys.executable, '-I', str(RAIZ / 'lab/tools/ampliar.py'), '--modelo', 'RealESRGAN_x4plus_anime_6B.safetensors',
                        '--entrada', str(src), '--salida', str(x2)], check=True)
    od = B / 'final_dibujo'
    od.mkdir(exist_ok=True)
    e = recortar(x2, k, TIPO[k], od)
    e['k'] = round(ANCHO[k] / (e['w'] * F / PNG_X), 4)
    e['origen'] = f'dibujo/{k}_s{sd}_0.png'
    (od / f'{k}.json').write_text(json.dumps(e, ensure_ascii=False), encoding='utf-8')
    op = B / 'final_pixel'
    op.mkdir(exist_ok=True)
    p = pixel(k, sp)
    p.save(op / f'{k}.png')
    print(k, 'dibujo', e['w'], 'x', e['h'], 'k', e['k'], '| pixel', p.size)


if __name__ == '__main__':
    if sys.argv[1] == 'hoja':
        hoja()
    elif sys.argv[1] == 'hoja2':
        hoja2()
    elif sys.argv[1] == 'pintado':
        pintado(*sys.argv[2:5])
    else:
        final(sys.argv[2], sys.argv[3], sys.argv[4])
