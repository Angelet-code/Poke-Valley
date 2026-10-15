# Iconos de Poción / Superpoción / Hiperpoción: la poción de Klein con el tono girado.
# Uso: python -I tools/iconos_pociones.py assets/gen/recursos/pokeitems/px/pocion_s2.png assets/game/pixel/items/iconos
import colorsys, sys
from PIL import Image
src, dst = sys.argv[1], sys.argv[2]
im = Image.open(src).convert('RGBA')
for nombre, tono in [('pocion', None), ('superpocion', (0.08, 1.35)), ('hiperpocion', (0.90, 1.2))]:
    out = im.copy(); px = out.load()
    for y in range(out.height):
        for x in range(out.width):
            r, g, b, a = px[x, y]
            if a == 0 or tono is None: continue
            h, s, v = colorsys.rgb_to_hsv(r/255, g/255, b/255)
            if s < 0.25 or v < 0.2: continue   # contorno oscuro y brillos: igual
            h = (h - 0.77 + tono[0]) % 1; v = min(1, v * tono[1])
            r2, g2, b2 = colorsys.hsv_to_rgb(h, s, v)
            px[x, y] = (round(r2*255), round(g2*255), round(b2*255), a)
    out.save(f'{dst}/{nombre}.png')
    out.resize((out.width*6, out.height*6), Image.NEAREST).save(f'{dst}/{nombre}_x6.png')
