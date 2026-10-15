"""Fondo de la pantalla de título (1440×810) montado con el catálogo Arcane.

python -I tools/fondo_titulo.py  ->  assets/ui/titulo/fondo_arcane.png
Césped Arcane repetido y elementos del catálogo (lab/assets/elementos_arcane/) a su escala de juego
(px de pantalla = px del PNG × k / 2, como Dibujo.dibujar con zoom 3), con su sombra en multiply.
El centro queda libre para el logo y el menú.
"""
import json
from pathlib import Path
import numpy as np
from PIL import Image

RAIZ = Path(__file__).resolve().parent.parent
CAT = RAIZ / 'lab' / 'assets' / 'elementos_arcane'
SUELO = RAIZ / 'lab' / 'assets' / 'suelo_arcane' / 'cesped_ref.png'
SALIDA = RAIZ / 'assets' / 'ui' / 'titulo'
W, H = 1440, 810
ESC_CESPED = 1.5

# id, x, y (pie del ancla en px de pantalla), espejo, escala extra
COLOCAR = [
    # fondo: muro de montañas y arboledas arriba
    ('montana_comun', 120, 230, False, 1.0), ('arboleda_comun', 420, 175, True, 0.9),
    ('montana_comun', 1330, 220, True, 1.0), ('arboleda_comun', 1030, 170, False, 0.9),
    ('arboleda_comun', 730, 120, False, 0.8),
    # lados
    ('arbol_viejo', 40, 520, False, 1.0), ('arbol_alto', 210, 400, True, 1.0),
    ('arbol_flores', 1250, 420, False, 1.0), ('arbol_viejo', 1420, 560, True, 1.0),
    ('arbusto', 300, 520, False, 1.0), ('arbusto', 1150, 540, True, 0.9),
    # abajo: casa a la izquierda, almacén a la derecha, farolas
    ('casa_grande', 150, 880, False, 1.0), ('almacen', 1300, 900, True, 0.9),
    ('farola', 420, 760, False, 1.0), ('farola', 1030, 770, True, 1.0),
    ('arbol_alto', 560, 905, False, 0.9), ('arbol_flores', 900, 920, True, 0.85),
    ('flores', 330, 690, False, 1.0), ('flores', 1110, 700, True, 1.0), ('flores', 720, 800, False, 0.9),
]


def main():
    cat = json.loads((CAT / 'elementos.json').read_text(encoding='utf-8'))
    els = {e['id']: e for e in (cat['elementos'] if isinstance(cat, dict) else cat)}

    teja = Image.open(SUELO).convert('RGB')
    teja = teja.resize((round(teja.width * ESC_CESPED),) * 2, Image.LANCZOS)
    lienzo = Image.new('RGB', (W, H))
    for y in range(0, H, teja.height):
        for x in range(0, W, teja.width):
            lienzo.paste(teja, (x, y))
    lienzo = lienzo.convert('RGBA')

    # de atrás adelante por la base
    for id_, x, y, espejo, extra in sorted(COLOCAR, key=lambda c: c[2]):
        e = els[id_]
        k = e.get('k', 1) / 2 * extra
        def cargar(nombre):
            im = Image.open(CAT / nombre).convert('RGBA')
            im = im.resize((max(1, round(im.width * k)), max(1, round(im.height * k))), Image.LANCZOS)
            return im.transpose(Image.FLIP_LEFT_RIGHT) if espejo else im
        ax, ay = e['ancla']
        if espejo:
            ax = e['w'] - ax
        ox, oy = round(x - ax * k), round(y - ay * k)
        if e.get('sombra'):
            so = cargar(e['sombra']['archivo'])
            # sombra: multiply con la máscara (verde oscuro) al 55 %
            base = lienzo.crop((ox, oy, ox + so.width, oy + so.height))
            b = np.asarray(base, float); s = np.asarray(so, float)
            a = s[..., 3:4] / 255 * 0.55
            mul = b[..., :3] * (s[..., :3] / 255)
            b[..., :3] = b[..., :3] * (1 - a) + mul * a
            lienzo.paste(Image.fromarray(b.astype(np.uint8), 'RGBA'), (ox, oy))
        lienzo.alpha_composite(cargar(e['archivo']), (ox, oy)) if 0 <= ox and 0 <= oy else \
            _pegar_recortado(lienzo, cargar(e['archivo']), ox, oy)

    SALIDA.mkdir(parents=True, exist_ok=True)
    lienzo.convert('RGB').save(SALIDA / 'fondo_arcane.png')
    lienzo.convert('RGB').save(SALIDA / 'fondo_arcane.jpg', quality=90)
    print('fondo', lienzo.size, '->', SALIDA)


def _pegar_recortado(lienzo, im, ox, oy):
    """alpha_composite no admite posiciones negativas: recorta lo que se sale."""
    x0, y0 = max(0, -ox), max(0, -oy)
    lienzo.alpha_composite(im.crop((x0, y0, im.width, im.height)), (ox + x0, oy + y0))


if __name__ == '__main__':
    main()
