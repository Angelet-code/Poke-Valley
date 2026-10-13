"""Aplica las paletas reales de Pokémon Esmeralda a los sprites de bayas.

Los PNG de pret/pokeemerald (graphics/object_events/pics/berry_trees) traen una paleta provisional;
en el juego cada fase usa una paleta NPC según gBerryTreePaletteSlotTable_<Baya> = {tierra, brote,
alta, flor, bayas}. Slot 2..5 = npc_1..npc_4.pal.

Entrada:  assets/sprites/bayas/orig/{fases,paletas}
Salida:   assets/sprites/bayas/fases/*.png (RGBA, índice 0 transparente)
          assets/sprites/bayas/iconos/*.png (iconos de inventario, índice 0 transparente)
          assets/sprites/bayas/bayas.json (fotogramas y fases)
Uso: python -I tools/bayas_colorear.py
"""
import json
import os
import re

from PIL import Image

RAIZ = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'assets', 'sprites', 'bayas')
ORIG = os.path.join(RAIZ, 'orig')


def paleta(n):
    lineas = open(os.path.join(ORIG, 'paletas', f'npc_{n}.pal')).read().split('\n')[3:19]
    return [tuple(map(int, l.split())) for l in lineas]


PAL = {slot: paleta(slot - 1) for slot in (2, 3, 4, 5)}


def pintar(ruta, colores, caja=None):
    im = Image.open(ruta)
    if caja:
        im = im.crop(caja)
    p = im.load()
    out = Image.new('RGBA', im.size, (0, 0, 0, 0))
    o = out.load()
    for y in range(im.size[1]):
        for x in range(im.size[0]):
            if p[x, y]:
                o[x, y] = tuple(colores[p[x, y]][:3]) + (255,)
    return out


def main():
    fases = os.path.join(RAIZ, 'fases')
    iconos = os.path.join(RAIZ, 'iconos')
    os.makedirs(fases, exist_ok=True)
    os.makedirs(iconos, exist_ok=True)
    tabla = dict(re.findall(r'PaletteSlotTable_(\w+)\[\] = \{([0-9, ]*)\}',
                            open(os.path.join(ORIG, 'paletas', 'berry_tree_graphics_tables.h')).read()))
    slots0 = None
    bayas = []
    for nombre, s in sorted(tabla.items()):
        slots = [int(v) for v in s.split(',')]
        slots0 = slots0 or slots
        n = nombre.lower()
        out = Image.new('RGBA', (96, 32), (0, 0, 0, 0))
        for f in range(6):  # 2 fotogramas por fase: alta, flor, bayas
            out.alpha_composite(pintar(os.path.join(ORIG, 'fases', f'{n}.png'), PAL[slots[2 + f // 2]],
                                       (f * 16, 0, f * 16 + 16, 32)), (f * 16, 0))
        out.save(os.path.join(fases, f'{n}.png'))
        bayas.append(n)
    pintar(os.path.join(ORIG, 'fases', 'dirt_pile.png'), PAL[slots0[0]]).save(os.path.join(fases, 'dirt_pile.png'))
    pintar(os.path.join(ORIG, 'fases', 'sprout.png'), PAL[slots0[1]]).save(os.path.join(fases, 'sprout.png'))
    for f in os.listdir(os.path.join(ORIG, 'iconos')):
        im = Image.open(os.path.join(ORIG, 'iconos', f))
        pintar(os.path.join(ORIG, 'iconos', f), [im.getpalette()[i:i + 3] for i in range(0, 48, 3)]) \
            .save(os.path.join(iconos, f))
    json.dump({
        'fuente': 'pret/pokeemerald (Pokémon Esmeralda)',
        'fases': ['tierra', 'brote', 'alta', 'flor', 'bayas'],
        'tierra': {'png': 'fases/dirt_pile.png', 'frame': [16, 16], 'frames': 1},
        'brote': {'png': 'fases/sprout.png', 'frame': [16, 16], 'frames': 2},
        'arbol': {'frame': [16, 32], 'frames_por_fase': 2, 'orden': ['alta', 'flor', 'bayas']},
        'bayas': {n: {'png': f'fases/{n}.png', 'icono': f'iconos/{n}_berry.png'} for n in bayas},
    }, open(os.path.join(RAIZ, 'bayas.json'), 'w'), indent=1, ensure_ascii=False)
    print(len(bayas), 'bayas')


if __name__ == '__main__':
    main()
