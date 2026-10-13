"""Retoques reproducibles de los edificios, VERSION 6: sobre la V5, corregida según el veredicto del
usuario (toldo de la tienda perfecto; tienda en sí caótica; dirección de las tejas de la casa mal;
chimenea plana y sin textura).

Entrada: casa_v5.txt y tienda_v5.txt. Salida: casa_v6.txt, tienda_v6.txt -> pixel_build.py ->
assets/game/pixel/edificios/. Todo determinista (semillas fijas), nada a mano. Sin IA.

  CASA (154x170)
    1. Tejas: el tejado es un hastial con la cumbrera de delante a atrás (la columna naranja x=68..77):
       los dos faldones bajan hacia la IZQUIERDA y la DERECHA. La V5 dibujaba hiladas horizontales como si
       el faldón mirase al espectador. Ahora las hiladas son paralelas a la cumbrera (columnas verticales de
       10 px, tejas de 8 filas, media teja de desfase cada dos columnas), escalonadas hacia los aleros
       laterales: la costura continua oscura (junta) va en el lado del alero de cada columna, la luz de 1 px
       en la fila superior y en el lado de la cumbrera (luz desde arriba-izquierda). Se conservan el
       gradiente de la V5 (faldón izq. claro m/n -> j, der. oscuro i -> 9 -> 6), la franja clara x=78..82, la
       cumbrera con su irregularidad de arriba, el alero frontal (bandas 5:3) y el jitter sembrado (1/6 de
       tono, 1/8 de junta corrida). Sombra de la chimenea igual (x=126..131, y=51..62).
    2. Hastial pequeño sobre la puerta: el triángulo oscuro de la IA bajo las bandas del alero (entre la
       línea interior de las bandas y y=125) pasa a ser un tejadito a dos aguas con el mismo tratamiento
       (cumbrera 'p' de 2 px en x=72..73, columnas de 10 px bajando a los lados, tonos del faldón en sombra),
       con fascia 'p' de 1 px en y=126 y línea oscura en y=127; el muro sigue debajo (y=128 liso).
    3. Chimenea: corona lisa (y=2..17) con la boca de la V5, sombra de 1 px bajo la corona (y=18) y
       mampostería irregular trabada (Mapa.piedras: 5 hiladas de 5-6 px, piedras de 3-6 px de ancho, esquinas
       redondeadas, luz arriba-izquierda, 3 tonos r/q/o + luz 'R' nueva + mortero '8'); la cara derecha
       (x=123..124) un tono más oscura ('u' nuevo para la piedra oscura). Contorno de 1 px y base en y=50
       como la V5; posición y tamaño intactos.
    4. Remate (Mapa.rematar) protegiendo la chimenea (en las tejas solo toca los recortes de los bordes).
  TIENDA (151x126)
    Toldo (y<=48) intacto. Todo lo demás (y>=49) se redibuja como pixel art legible, manteniendo la silueta:
    postes rectos de 5 px (contorno 1, l, h, 9, contorno 1) a la izquierda (x=9..13), en medio (x=97..101) y
    a la derecha (x=142..146); pared trasera oscura de tablones ('3' con juntas '2' cada 6 filas) con un
    ventanuco abierto a la derecha (x=102..141, y=49..65, se conserva el hueco de la IA) y su repisa; balda
    con dos tarros (nuevos tonos s/t/x) y un letrero colgado sin texto; mostrador recto (tablero o/m/l,
    frontal de listones l/b/5 con juntas verticales alternas, contornos de 1 px, base en y=102) con una caja
    de manzanas rojas (nuevos v/u/w) y un saco de arpillera (m/k/9); mesa baja a la derecha (misma receta,
    base en y=110) con una caja de fruta amarilla/verde (p/y nuevos, j/z nuevo); las dos cajas de abajo a la
    izquierda y el saquito que llevan encima, redibujados limpios (listones, contorno 1 px, 3 tonos, sombra
    de 1 px en el suelo). Remate fuera del toldo.
Uso: python -I assets/gen/pixel/src/edificios/retoques_v6.py   (desde la raíz del proyecto)
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[5] / "tools"))
from pixel_txt import Mapa  # noqa: E402

AQUI = Path(__file__).resolve().parent


def clamp(v, a, b):
    return max(a, min(b, v))


# =============================================================================== CASA
def casa():
    m = Mapa.leer(AQUI / "casa_v5.txt")
    base = [r[:] for r in m.filas]
    cambios = {}

    def paso(nombre):
        cambios[nombre] = m.diff(base) - sum(cambios.values())

    m.color("R", "#f2cda4")   # luz de la piedra clara de la chimenea
    m.color("u", "#4b2a1b")   # piedra oscura en sombra (cara derecha)

    # ---- medidas (las de la V5): borde superior por columna y perfil del alero 5:3 ------------------
    y_top = {}
    for x in range(m.w):
        y_top[x] = next((y for y in range(m.h) if m.get(x, y) != "."), None)
    izq = Mapa.perfil_tramos(72, 96, [2, 2, 1], 1)
    der = Mapa.perfil_tramos(73, 96, [2, 2, 1], 152)
    y_out = {**izq, **der}

    def chimenea(x, y):
        if not (98 <= x <= 125 and 0 <= y <= 50):
            return False
        if y == 0:
            return 100 <= x <= 123
        if y == 1:
            return 99 <= x <= 124
        return True

    def techo(x, y):
        if not (1 <= x <= 152) or y_top[x] is None:
            return False
        return y_top[x] < y < y_out[x] and not (68 <= x <= 82) and not chimenea(x, y)

    # ---- 1. tejas en hiladas verticales ---------------------------------------------------------------
    RAMPA = "nmji96"   # claro -> oscuro

    def tono(xc, yc, dk):
        x = clamp(xc, 1, 152)
        yt, ye = (y_top[x] if y_top[x] is not None else 11), y_out[x]
        v = clamp((yc - yt) / max(1, ye - yt), 0, 1)   # 0 arriba, 1 en el alero
        if x < 72:                                    # faldón izquierdo, claro
            k = 1 if v < 0.55 else 2
            k = clamp(k + dk, 0, 3)
            junta = "7"
        else:                                         # faldón derecho, en sombra
            s = 0.6 * v + 0.4 * clamp((x - 83) / 69, 0, 1)
            k = 3 if s < 0.4 else (4 if s < 0.75 else 5)
            if 126 <= xc <= 131 and 51 <= yc <= 62:
                k += 1                                # sombra de la chimenea
            k = clamp(k + dk, 2, 5)
            junta = "3"
        return RAMPA[k], RAMPA[max(0, k - 1)], junta

    # izq.: columnas 58..67, 48..57, ... (la luz pegada a la cumbrera, la junta hacia el alero)
    m.tejas_v(lambda x, y: x < 68 and techo(x, y), 10, 8, tono, "izq", ox=58, oy=11, semilla=5)
    # der.: junta en x=83 (pegada a la franja clara), columnas 84..93, ..., 144..152 (cortada)
    m.tejas_v(lambda x, y: x > 82 and techo(x, y), 10, 8, tono, "der", ox=84, oy=11, semilla=5)
    for x in range(78, 83):                           # franja clara junto a la cumbrera (de la IA)
        for y in range(y_top[x] + 1, y_out[x]):
            m.set(x, y, "m")
    paso("tejas")

    # ---- 2. hastial pequeño sobre la puerta -----------------------------------------------------------
    def hastial(x, y):
        return 10 <= x <= 143 and y_out[x] + 11 < y <= 125

    def tono_h(xc, yc, dk):
        k = 4 if xc < 72 else 5
        k = clamp(k + dk, 3, 5)
        return RAMPA[k], RAMPA[k - 1], "3"

    m.tejas_v(lambda x, y: x <= 71 and hastial(x, y), 10, 8, tono_h, "izq", ox=62, oy=108, semilla=9)
    m.tejas_v(lambda x, y: x >= 74 and hastial(x, y), 10, 8, tono_h, "der", ox=74, oy=108, semilla=9)
    for y in range(108, 126):
        m.set(72, y, "p"), m.set(73, y, "p")          # cumbrera del tejadito
    for x in range(10, 144):
        if y_out[x] + 11 < 126:
            m.set(x, 126, "p")                        # fascia de 1 px
        if y_out[x] + 11 < 127:
            m.set(x, 127, "1")                        # línea oscura bajo la fascia
        if y_out[x] + 11 < 128:
            m.set(x, 128, "4")                        # muro liso debajo
    paso("hastial")

    # ---- 3. chimenea: corona lisa + mampostería irregular ----------------------------------------------
    for y in range(0, 51):
        for x in range(98, 126):
            if chimenea(x, y):
                m.set(x, y, "r")
    m.hlinea(100, 123, 0, "0")
    m.set(99, 1, "0"), m.set(124, 1, "0")
    m.vlinea(98, 2, 50, "0"), m.vlinea(125, 2, 50, "0")
    m.hlinea(100, 123, 1, "o")                        # canto superior
    m.rect(123, 2, 124, 17, "q")                      # cara derecha de la corona en sombra
    m.marco(105, 6, 120, 15, "g")                     # boca: marco 1 px (como la V5)
    m.rect(106, 7, 119, 8, "8")
    m.rect(106, 9, 119, 14, "2")
    m.hlinea(106, 119, 14, "o"), m.vlinea(119, 7, 14, "o")
    m.hlinea(99, 124, 18, "o")                        # sombra del vuelo de la corona

    def tono_piedra(k, b, u):
        if u < 0.28:
            return "r", "R"
        if u < 0.80:
            return "q", "r"
        return "o", "q"

    n_piedras = m.piedras(99, 19, 124, 49, [6, 7, 6, 6, 6], [4, 5, 6, 7], tono_piedra, semilla=11)
    OSCURECER = {"R": "r", "r": "q", "q": "o", "o": "u"}
    for x in (123, 124):                              # cara derecha: piedras un tono más oscuras
        for y in range(19, 50):
            m.set(x, y, OSCURECER.get(m.get(x, y), m.get(x, y)))
    m.hlinea(99, 124, 50, "0")                        # base recta
    paso("chimenea")

    # ---- 4. remate -------------------------------------------------------------------------------------
    n = m.rematar(proteger=chimenea)
    paso("remate")
    m.escribir(AQUI / "casa_v6.txt", "V6: retoques de retoques_v6.py (ver cabecera del guion)")
    print("casa: pixeles cambiados por bloque:", cambios, "total", m.diff(base), "remate", n, "piedras", n_piedras)


# =============================================================================== TIENDA
MANZANA = """\
.vvv.
vwvvv
vvvvu
vvvuu
.uuu."""
PERA = """\
.ppp.
pqppp
ppppy
pppyy
.yyy."""
LIMA = """\
.jjj.
jzjjj
jjjj4
jjj44
.444."""
SACO = """\
.....1111.....
....1mkkk1....
....1kkk91....
...11kkkk11...
..1mmmkkkkk1..
.1mmmmkkkkk91.
1mmmmmkkkkkk91
1mmmmkkkkkkk91
1mmmmkkkkkkk91
1mmmkkkkkkkk91
1mmmkkkkkkkk91
1mmmkkkkkkk991
1mmkkkkkkkk991
1mmkkkkkkkk991
1mkkkkkkkk9991
1kkkkkkkk99991
.1kkkkkk99991.
..1kkkk99991..
...11111111..."""
SAQUITO = """\
....111....
...1mkk1...
...1kk91...
..11kkk11..
.1mmkkkk91.
1mmmkkkkk91
1mmkkkkkk91
1mkkkkkk991
1kkkkkk9991
.1kkkk9991.
..1111111.."""
TARRO = """\
...111...
..1hhh1..
..1ttt1..
.1sstttx1
1sstttttx1
1ssttttxx1
1sstttttx1
1ssttttxx1
.1stttxx1.
..1ttxx1..
...1111..."""


def tienda():
    m = Mapa.leer(AQUI / "tienda_v5.txt")
    base = [r[:] for r in m.filas]
    cambios = {}

    def paso(nombre):
        cambios[nombre] = m.diff(base) - sum(cambios.values())

    for c, hx in (("u", "#7b2630"), ("v", "#cf3f3f"), ("w", "#f08c7e"),      # manzanas
                  ("y", "#b09a3a"), ("z", "#9fbe4e"),                         # fruta amarilla / verde
                  ("s", "#95b9c3"), ("t", "#5b7f8c"), ("x", "#3a5560")):      # tarros
        m.color(c, hx)

    # ---- 0. todo el cuerpo (y >= 49) en blanco; el toldo (y <= 48) no se toca ---------------------------
    for y in range(49, m.h):
        for x in range(m.w):
            m.set(x, y, ".")

    def poste(x0, y0, y1):
        for i, c in enumerate("1lh91"):
            m.vlinea(x0 + i, y0, y1, c)

    def pared(x0, y0, x1, y1):
        for y in range(y0, y1 + 1):
            m.hlinea(x0, x1, y, "2" if (y - 49) % 6 == 5 else "3")

    def frontal(x0, y0, x1, y1, fase=0):
        """Listones horizontales de 5 filas (l, b, b, b, 5) con juntas verticales alternas."""
        for y in range(y0, y1 + 1):
            j = (y - y0) % 5
            m.hlinea(x0, x1, y, "l" if j == 0 else ("5" if j == 4 else "b"))
        for k, y in enumerate(range(y0, y1 + 1, 5)):
            for x in range(x0 + 14 + (24 if (k + fase) % 2 else 0), x1 - 2, 48):
                m.vlinea(x, y + 1, min(y + 3, y1), "5")

    # ---- 1. pared trasera, repisa del ventanuco, balda, letrero -----------------------------------------
    pared(14, 49, 96, 78)                             # tramo izquierdo, hasta el mostrador
    pared(102, 71, 141, 87)                           # bajo el ventanuco, hasta la mesa baja
    for y, c in ((66, "o"), (67, "l"), (68, "h"), (69, "9"), (70, "1")):
        m.hlinea(102, 141, y, c)                      # repisa del ventanuco (x=102..141, y=49..65 abierto)
    for y, c in ((60, "l"), (61, "h"), (62, "9"), (63, "1")):
        m.hlinea(16, 56, y, c)                        # balda
    m.pegar(19, 49, TARRO)                            # dos tarros sobre la balda
    m.pegar(31, 49, TARRO)
    for x in (69, 81):
        m.vlinea(x, 49, 51, "1")                      # cuerdas del letrero
    m.marco(66, 52, 84, 61, "1")                      # letrero colgado, sin texto
    m.rect(67, 53, 83, 60, "l")
    m.hlinea(67, 83, 60, "h"), m.vlinea(83, 53, 60, "h")
    m.marco(68, 54, 82, 59, "9")
    paso("pared")

    # ---- 2. postes ------------------------------------------------------------------------------------------
    poste(9, 49, 78)
    poste(97, 49, 87)
    poste(142, 49, 87)
    paso("postes")

    # ---- 3. mostrador (tablero y frontal) y mesa baja de la derecha ------------------------------------------
    m.hlinea(10, 96, 79, "o")                         # canto trasero del tablero
    m.rect(10, 80, 96, 83, "m")
    m.hlinea(10, 96, 84, "l")
    m.hlinea(10, 96, 85, "1")                         # arista del frontal
    frontal(10, 86, 96, 100)
    m.hlinea(10, 96, 101, "5")
    m.hlinea(9, 96, 102, "1")                         # base
    m.vlinea(9, 79, 102, "1")
    m.hlinea(98, 145, 88, "o")                        # mesa baja (x=97..146, base en y=110)
    m.rect(98, 89, 145, 92, "m")
    m.hlinea(98, 145, 93, "l")
    m.hlinea(98, 145, 94, "1")
    frontal(98, 95, 145, 109, fase=1)
    m.hlinea(98, 145, 109, "5")
    m.marco(97, 88, 146, 110, "1")
    paso("mostrador")

    # ---- 4. mercancía: caja de manzanas, saco, caja de fruta amarilla/verde --------------------------------
    def caja_fruta(x0, y0, x1, y1, estampas):
        """Caja de listones con la fruta asomando por encima del canto: fila trasera (3 piezas, solo
        asoman) y fila delantera (4 piezas separadas 1 px); la caja se dibuja después y tapa lo de abajo."""
        tras = [(x0 + 5 + 6 * i, y0 - 5) for i in range(3)]
        delante = [(x0 + 2 + 6 * i, y0 - 3) for i in range(4)]
        for k, (x, y) in enumerate(tras + delante):
            m.pegar(x, y, estampas[k % len(estampas)])
        m.caja(x0, y0, x1, y1, "l", "b", "5", "1", periodo=5)

    caja_fruta(15, 68, 39, 82, [MANZANA])                       # manzanas rojas sobre el mostrador
    m.pegar(46, 63, SACO)                                       # saco de arpillera
    caja_fruta(104, 77, 128, 91, [PERA, LIMA, PERA, LIMA, LIMA, PERA, PERA])   # fruta amarilla/verde en la mesa baja
    paso("mercancia")

    # ---- 5. cajas de abajo a la izquierda (la silueta de la V5) + saquito encima ------------------------------
    m.caja(24, 108, 42, 124, "l", "b", "5", "1", periodo=5)    # caja derecha
    m.caja(7, 113, 23, 124, "l", "b", "5", "1", periodo=5)     # caja izquierda
    m.pegar(14, 103, SAQUITO)                                   # saquito encima
    m.hlinea(8, 43, 125, "0")                                   # sombra de 1 px en el suelo
    paso("cajas")

    # ---- 6. remate fuera del toldo -------------------------------------------------------------------------------
    n = m.rematar(proteger=lambda x, y: y <= 48)
    paso("remate")
    m.escribir(AQUI / "tienda_v6.txt", "V6: retoques de retoques_v6.py (ver cabecera del guion)")
    print("tienda: pixeles cambiados por bloque:", cambios, "total", m.diff(base), "remate", n)


if __name__ == "__main__":
    casa()
    tienda()
