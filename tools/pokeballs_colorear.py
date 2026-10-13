"""Aplica las paletas reales de Pokémon Esmeralda a los sprites de Poké Balls.

Fuentes (pret/pokeemerald, originales en assets/sprites/pokeballs/orig/):
  - iconos/<bola>.png (24×24, iconos de mochila, graphics/items/icons) + paletas/<bola>.pal
    (graphics/items/icon_palettes; Honor Ball = premier_ball.png con luxury_ball.pal, como en
    src/data/item_icon_table.h).
  - suelo/item_ball.png (16×16, la bola que hay en el suelo en el juego, con npc_3.pal (paletteTag NPC_3 en object_event_graphics_info.h)).

Salida (RGBA, índice 0 transparente, recortados al contenido):
  - assets/game/pixel/items/<id>.png: bola del suelo 10×10 para el mundo. Esmeralda solo tiene
    una (roja); las otras cuatro son recolores de la mitad superior con los colores de las
    paletas de los iconos de mochila (Super: azul + marcas rojas; Ultra: gris + franjas
    amarillas; Master: morado + puntos rosas; Honor: blanca + línea roja).
  - assets/game/pixel/items/iconos/<id>.png: icono de mochila 18×18 (inventario).
  - assets/sprites/pokeballs/suelo/item_ball.png: la bola del suelo original coloreada.
Uso: python -I tools/pokeballs_colorear.py
"""
import os

from PIL import Image

RAIZ = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'assets', 'sprites', 'pokeballs')
ORIG = os.path.join(RAIZ, 'orig')
ITEMS = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'assets', 'game', 'pixel', 'items')
# id del juego -> (png de icono, paleta)
BOLAS = {
    'pokeball': ('poke_ball', 'poke_ball'),
    'superball': ('great_ball', 'great_ball'),
    'ultraball': ('ultra_ball', 'ultra_ball'),
    'masterball': ('master_ball', 'master_ball'),
    'honorball': ('premier_ball', 'luxury_ball'),
}


def paleta(nombre):
    lineas = open(os.path.join(ORIG, 'paletas', nombre + '.pal')).read().split('\n')[3:19]
    return [tuple(map(int, l.split())) for l in lineas]


def colorear(png, pal, recortar=True):
    im = Image.open(png).convert('P')
    idx = im.load()
    out = Image.new('RGBA', im.size, (0, 0, 0, 0))
    px = out.load()
    for y in range(im.height):
        for x in range(im.width):
            i = idx[x, y]
            if i:
                px[x, y] = pal[i] + (255,)
    return out.crop(out.getbbox()) if recortar else out


# Recolor de la bola del suelo: índices b, c, d (claro, medio, oscuro de la mitad roja) y
# píxeles sueltos (x, y) -> RGB de marcas. La mitad blanca (5, 6, 7, e) y el contorno (f) no cambian.
GRIS = {'claro': (255, 255, 255), 'medio': (222, 205, 246), 'oscuro': (164, 164, 197)}
SUELO = {
    'pokeball': (None, {}),
    'superball': (((57, 148, 255), (49, 82, 213), (49, 65, 148)),
                  {(5, 7): (246, 74, 74), (4, 8): (246, 74, 74), (10, 7): (246, 74, 74), (11, 8): (246, 74, 74)}),
    'ultraball': (((115, 131, 148), (82, 98, 106), (57, 74, 90)),
                  {(6, 6): (255, 213, 57), (9, 6): (255, 213, 57), (5, 7): (255, 213, 57), (10, 7): (255, 213, 57),
                   (4, 8): (255, 213, 57), (11, 8): (255, 213, 57)}),
    'masterball': (((180, 57, 246), (115, 49, 205), (106, 49, 197)),
                   {(5, 7): (255, 197, 255), (10, 7): (255, 197, 255)}),
    'honorball': (((255, 255, 255), (222, 205, 246), (164, 164, 197)),
                  {(x, 10): (222, 90, 57) for x in (4, 5, 6, 9, 10, 11)}),
}


def bola_suelo(id_):
    pal = paleta('npc_3')
    tonos, marcas = SUELO[id_]
    if tonos:
        pal = list(pal)
        pal[0xb], pal[0xc], pal[0xd] = tonos
    im = Image.open(os.path.join(ORIG, 'suelo', 'item_ball.png')).convert('P')
    idx = im.load()
    out = Image.new('RGBA', im.size, (0, 0, 0, 0))
    px = out.load()
    for y in range(im.height):
        for x in range(im.width):
            if idx[x, y]:
                px[x, y] = marcas.get((x, y), pal[idx[x, y]]) + (255,)
    return out.crop(out.getbbox())


def main():
    os.makedirs(os.path.join(ITEMS, 'iconos'), exist_ok=True)
    os.makedirs(os.path.join(RAIZ, 'suelo'), exist_ok=True)
    for id_, (png, pal) in BOLAS.items():
        ic = colorear(os.path.join(ORIG, 'iconos', png + '.png'), paleta(pal))
        ic.save(os.path.join(ITEMS, 'iconos', id_ + '.png'))
        su = bola_suelo(id_)
        su.save(os.path.join(ITEMS, id_ + '.png'))
        print(id_, 'icono', ic.size, 'suelo', su.size)
    colorear(os.path.join(ORIG, 'suelo', 'item_ball.png'), paleta('npc_3')).save(os.path.join(RAIZ, 'suelo', 'item_ball.png'))


if __name__ == '__main__':
    main()
