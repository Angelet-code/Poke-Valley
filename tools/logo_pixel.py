"""Logo pixel art "Pok of Warcraft Forever" (cabecera tipo WoW, paleta Arcane: oro + hextech turquesa).

python -I tools/logo_pixel.py  ->  assets/ui/logo/logo_pow.png (nativo) y logo_pow_x4.png (ampliado, vecino más próximo).
Las letras salen de Book Antiqua Bold rasterizada a la rejilla de píxeles; el resto (relleno, bisel, contorno,
cinta y emblema) se pinta píxel a píxel con una paleta cerrada.
"""
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw, ImageFont

RAIZ = Path(__file__).resolve().parent.parent
SALIDA = RAIZ / 'assets' / 'ui' / 'logo'
FUENTE = 'C:/Windows/Fonts/BOOKOSB.TTF'
SS = 8  # superresolución para rasterizar las letras

# Paleta cerrada (RGBA)
ORO = [(92, 56, 24), (140, 88, 32), (196, 136, 48), (232, 184, 80), (250, 226, 150), (255, 248, 214)]
CONTORNO = (46, 26, 20)        # marrón muy oscuro, no negro
HEX = [(18, 62, 74), (34, 120, 132), (72, 196, 196), (176, 246, 236)]  # turquesa hextech
AZUL = [(16, 20, 44), (30, 38, 78), (48, 60, 112), (74, 88, 150)]       # cinta
ROJO = [(110, 28, 36), (176, 44, 48), (226, 82, 72)]
BLANCO = [(150, 150, 170), (214, 214, 226), (246, 244, 236)]


def mascara_texto(txt, alto_px, fuente=FUENTE):
    """Máscara booleana de un texto con altura de mayúscula ~alto_px (en píxeles de la rejilla)."""
    f = ImageFont.truetype(fuente, alto_px * SS * 1.38)
    x0, y0, x1, y1 = f.getbbox(txt)
    im = Image.new('L', (x1 - x0 + 4 * SS, y1 - y0 + 4 * SS), 0)
    ImageDraw.Draw(im).text((2 * SS - x0, 2 * SS - y0), txt, font=f, fill=255)
    w, h = im.size
    im = im.resize((max(1, w // SS), max(1, h // SS)), Image.BOX)
    m = np.array(im) > 110
    ys, xs = np.nonzero(m)
    return m[ys.min():ys.max() + 1, xs.min():xs.max() + 1]


def palabra_arqueada(txt, alto_borde, alto_centro, espacio, arco):
    """Letras grandes en los extremos y más bajas en el centro (como WARCRAFT), base en arco suave."""
    n = len(txt)
    letras = []
    for i, c in enumerate(txt):
        t = abs(i - (n - 1) / 2) / ((n - 1) / 2)          # 0 centro, 1 extremos
        alto = round(alto_centro + (alto_borde - alto_centro) * t ** 2.2)
        letras.append(mascara_texto(c, alto))
    ancho = sum(m.shape[1] for m in letras) + espacio * (n - 1)
    alto_max = max(m.shape[0] for m in letras)
    lienzo = np.zeros((alto_max + arco + 2, ancho), bool)
    x = 0
    for i, m in enumerate(letras):
        t = abs(i - (n - 1) / 2) / ((n - 1) / 2)
        base = alto_max + round(arco * t ** 2)          # extremos más abajo: la base sube en el centro
        y = base - m.shape[0]
        lienzo[y:y + m.shape[0], x:x + m.shape[1]] |= m
        x += m.shape[1] + espacio
    return lienzo


def dilatar(m, r=1, cruz=False):
    out = m.copy()
    for dy in range(-r, r + 1):
        for dx in range(-r, r + 1):
            if cruz and abs(dx) + abs(dy) > r:
                continue
            out |= np.roll(np.roll(m, dy, 0), dx, 1)
    return out


def pintar_metal(img, m, oy, ox, bandas, contorno=CONTORNO, brillo=HEX[2], glow=HEX[1]):
    """Relleno metálico por bandas duras + bisel 1px + contorno + halo hextech."""
    h, w = m.shape
    pad = 3
    M = np.zeros((h + 2 * pad, w + 2 * pad), bool)
    M[pad:pad + h, pad:pad + w] = m
    oy -= pad; ox -= pad
    halo = dilatar(M, 2, cruz=True) & ~dilatar(M, 1)
    borde = dilatar(M, 1) & ~M
    sombra = np.roll(np.roll(M | borde, 2, 0), 1, 1) & ~(M | borde | halo)
    ys, xs = np.nonzero(M)
    top = {}
    bot = {}
    for y, x in zip(ys, xs):  # banda según la altura relativa dentro de cada columna de la letra
        top[x] = min(top.get(x, y), y); bot[x] = max(bot.get(x, y), y)
    P = img.load()
    def put(y, x, c):
        Y, X = oy + y, ox + x
        if 0 <= Y < img.height and 0 <= X < img.width:
            P[X, Y] = c + (255,) if len(c) == 3 else c
    for y, x in zip(*np.nonzero(sombra)):
        put(y, x, (10, 12, 28, 150))
    for y, x in zip(*np.nonzero(halo)):
        put(y, x, glow + (200,))
    for y, x in zip(*np.nonzero(borde)):
        put(y, x, contorno)
    altura = max(1, ys.max() - ys.min())
    for y, x in zip(ys, xs):
        f = (y - ys.min()) / altura
        # metal: claro arriba, línea de horizonte oscura a ~55 %, rebote cálido abajo
        if f < 0.18: c = bandas[4]
        elif f < 0.40: c = bandas[3]
        elif f < 0.52: c = bandas[2]
        elif f < 0.58: c = bandas[1]
        elif f < 0.80: c = bandas[2]
        else: c = bandas[1]
        if not M[y - 1, x] or not M[y, x - 1]:
            c = bandas[5] if f < 0.5 else bandas[3]        # bisel de luz arriba-izquierda
        elif not M[y + 1, x] or not M[y, x + 1]:
            c = bandas[0]                                   # bisel de sombra abajo-derecha
        put(y, x, c)
    # destellos hextech sobre las letras grandes
    return M


def bola(img, cx, cy):
    """Poké Ball 16x16 en píxeles con gema hextech en el botón y anillo de oro (emblema central)."""
    filas_ext = [(5, 10), (3, 12), (2, 13), (1, 14), (1, 14), (0, 15), (0, 15), (0, 15),
                 (0, 15), (0, 15), (0, 15), (1, 14), (1, 14), (2, 13), (3, 12), (5, 10)]
    filas_int = {1: (5, 10), 2: (3, 12), 3: (2, 13), 4: (2, 13), 5: (1, 14), 6: (1, 14),
                 9: (1, 14), 10: (1, 14), 11: (2, 13), 12: (2, 13), 13: (3, 12), 14: (5, 10)}
    S = 2  # cada píxel de la bola = 2 píxeles del logo, para que se lea al lado de las letras
    m = np.zeros((16, 16), bool)
    for y, (a, b) in enumerate(filas_ext):
        m[y, a:b + 1] = True
    big = np.kron(m, np.ones((S, S), bool))
    anillo = dilatar(big, 3, cruz=True) & ~dilatar(big, 1)
    P = img.load()
    ox, oy = cx - 8 * S, cy - 8 * S
    def put(y, x, c):
        P[ox + x, oy + y] = c + (255,)
    for y, x in zip(*np.nonzero(dilatar(big, 4, cruz=True) & ~dilatar(big, 3, cruz=True))):
        put(y, x, CONTORNO)
    for y, x in zip(*np.nonzero(anillo)):
        put(y, x, ORO[4] if y < 16 else ORO[2] if y < 24 else ORO[1])
    for y, x in zip(*np.nonzero(dilatar(big, 1) & ~big)):
        put(y, x, CONTORNO)
    def celda(y, x, c):
        for dy in range(S):
            for dx in range(S):
                put(y * S + dy, x * S + dx, c)
    for y in range(16):
        a, b = filas_ext[y]
        for x in range(a, b + 1):
            c = (40, 24, 30)
            if y in filas_int and filas_int[y][0] <= x <= filas_int[y][1]:
                if y <= 6:
                    c = ROJO[2] if (y <= 3 and x <= 6) else ROJO[1] if y <= 5 else ROJO[0]
                else:
                    c = BLANCO[2] if y <= 11 else BLANCO[1] if y <= 12 else BLANCO[0]
            celda(y, x, c)
    celda(2, 4, (255, 200, 180)); celda(3, 3, (255, 160, 140))  # brillo
    # botón: aro oscuro + gema hextech
    for y in range(5, 11):
        for x in range(5, 11):
            if (y in (5, 10)) and (x in (5, 10)):
                continue
            celda(y, x, (40, 24, 30))
    for y in range(6, 10):
        for x in range(6, 10):
            celda(y, x, HEX[3] if (y, x) == (6, 6) else HEX[2] if y <= 7 else HEX[1])


def cinta(img, x0, y0, ancho, alto, texto_m):
    """Cinta azul con ribete de oro y puntas plegadas, con FOREVER encima."""
    P = img.load()
    def put(x, y, c):
        if 0 <= x < img.width and 0 <= y < img.height:
            P[x, y] = c + (255,)
    # colas en cola de golondrina (detrás), más bajas, con el pliegue oscuro que las une al cuerpo
    cola, baja, muesca = 18, 5, 6
    mitad = alto // 2
    for lado in (-1, 1):
        m = np.zeros((alto, cola), bool)
        for y in range(alto):
            # d = distancia desde el extremo exterior; la muesca en V se come el centro del extremo
            for d in range(cola):
                if d < muesca - abs(y - mitad) * muesca // mitad:
                    continue
                m[y, d] = True
        borde = (dilatar(np.pad(m, 1), 1, cruz=True) & ~np.pad(m, 1))
        for y in range(-1, alto + 1):
            for d in range(-1, cola + 1):
                dentro = 0 <= y < alto and 0 <= d < cola and m[y, d]
                if not dentro and not borde[y + 1, d + 1]:
                    continue
                X = x0 - cola + 6 + d if lado < 0 else x0 + ancho - 6 + (cola - 1 - d)
                if not dentro:
                    c = CONTORNO
                elif d >= cola - 6:
                    c = AZUL[0]                                # pliegue a la sombra del cuerpo
                else:
                    c = AZUL[2] if y < alto * 0.45 else AZUL[1]
                put(X, y0 + baja + y, c)
    # cuerpo
    for y in range(alto):
        for x in range(ancho):
            if y in (0, alto - 1) or x in (0, ancho - 1):
                c = CONTORNO
            elif y in (1, alto - 2):
                c = ORO[3] if y == 1 else ORO[1]
            elif y == 2:
                c = AZUL[3]
            else:
                c = AZUL[2] if y < alto * 0.55 else AZUL[1]
            put(x0 + x, y0 + y, c)
    # sombra del pliegue
    for y in range(alto - 2):
        put(x0 + 1, y0 + 1 + y, AZUL[0]); put(x0 + ancho - 2, y0 + 1 + y, AZUL[0])
    h, w = texto_m.shape
    tx, ty = x0 + (ancho - w) // 2, y0 + (alto - h) // 2
    borde = dilatar(np.pad(texto_m, 1), 1) & ~np.pad(texto_m, 1)
    for y, x in zip(*np.nonzero(borde)):
        put(tx - 1 + x, ty - 1 + y, AZUL[0])
    ys = np.nonzero(texto_m)[0]
    for y, x in zip(*np.nonzero(texto_m)):
        f = (y - ys.min()) / max(1, ys.max() - ys.min())
        put(tx + x, ty + y, HEX[3] if f < 0.45 else HEX[2])


def main():
    warcraft = palabra_arqueada('WARCRAFT', alto_borde=46, alto_centro=31, espacio=1, arco=5)
    pok = mascara_texto('POK', 21)
    of = mascara_texto('OF', 21)
    forever = mascara_texto('FOREVER', 9)

    W = warcraft.shape[1] + 40
    H = 150
    img = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    cx = W // 2
    # cinta detrás de WARCRAFT (abajo)
    cinta_w = forever.shape[1] + 44
    y_war = 50
    cinta(img, cx - cinta_w // 2, y_war + warcraft.shape[0] - 6, cinta_w, 19, forever)
    pintar_metal(img, warcraft, y_war, (W - warcraft.shape[1]) // 2, ORO)
    # POK  OF a los lados del emblema
    y_pok = 30 - pok.shape[0] // 2
    pintar_metal(img, pok, y_pok, cx - 30 - pok.shape[1], ORO, glow=HEX[0])
    pintar_metal(img, of, y_pok, cx + 30, ORO, glow=HEX[0])
    bola(img, cx, 30)

    # recorta lo transparente
    a = np.array(img)[:, :, 3]
    ys, xs = np.nonzero(a)
    img = img.crop((xs.min() - 2, ys.min() - 2, xs.max() + 3, ys.max() + 3))
    SALIDA.mkdir(parents=True, exist_ok=True)
    img.save(SALIDA / 'logo_pow.png')
    img.resize((img.width * 4, img.height * 4), Image.NEAREST).save(SALIDA / 'logo_pow_x4.png')
    print('logo', img.size, '->', SALIDA)


if __name__ == '__main__':
    main()
