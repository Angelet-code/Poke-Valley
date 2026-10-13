"""Retoques reproducibles de los edificios, VERSION 5: el dibujo de la V4 con sus texturas y bordes
redibujados "de oficio" (el usuario: "mejor, pero sigue sucio").

Entrada: casa_v4.txt y tienda_v4.txt (la V4 ya retocada). Salida: casa_v5.txt, tienda_v5.txt
-> pixel_build.py -> assets/game/pixel/edificios/. Todo determinista (semillas fijas), nada a mano.

Principio: lo que es textura (tejas, piedras, franjas, festones) se dibuja periódico con un jitter
sembrado; lo que es línea (contornos, costuras, bandas del alero) con tramos regulares. El diseño de
la IA (proporciones, ventanas, jardineras, puerta, chimenea, fruta, cajas, paleta) no se toca.

  CASA (154x170)
    1. Alero frontal: las dos diagonales a 5:3 exacto (tramos 2,2,1 desde el vértice, espejadas; la IA
       traía ~1,78:1 a la izquierda y ~1,64:1 a la derecha con escalones de 1-4 px). Bandas paralelas con
       los mismos tramos: contorno 1 px, fascia naranja 5, sombra 1, tabla clara 4, línea oscura 1.
       La cumbrera (x=68..77, con su irregularidad de arriba intacta) se funde con la fascia en el vértice.
       Esquinas: el alero termina en cuña limpia en x=0/153 (corte horizontal en y=143 bajo el vuelo).
    2. Tejas: hiladas periódicas de 10 filas, tejas de 8 (medio desfase cada dos hiladas), luz arriba-
       izquierda 1 px + base + junta 1 px; gradiente faldón izq. claro (m/n -> j), faldón der. oscuro
       (i -> 9 -> 6) con la franja clara de la cumbrera conservada; ~1/6 de tejas un tono distinto y
       ~1/8 con la junta corrida 1 px (semilla fija). Sombra de la chimenea = un tono más en 6x12 px.
    3. Chimenea: contorno de 1 px (antes doble a la derecha, torcido a la izquierda), remate recto,
       boca con marco, cuerpo liso con sombra derecha, piedras = 4 hiladas de bloques planos (3 tonos +
       juntas de 1 px), base recta en y=50 (el reguero que bajaba hasta y=57 pasa a ser tejas).
    4. Silueta: contorno lateral de 1 px (x=0 / x=153, antes 2 px), muesca de (152,65) rellena, contorno
       del muro de 1 px a la derecha (x=144; x=145 fuera) e izquierda (x=9).
    5. Remate: huérfanos y dobles (Mapa.rematar), protegiendo las tejas y la chimenea.
  TIENDA (151x126)
    1. Toldo: 7 franjas en abanico regular y simétrico (costuras arriba 26/46/65/85/104/124, abajo
       22/43/64/86/107/128, Bresenham), cada franja plana con 2 tonos (parte alta y=11-18 / cuerpo
       y=19-42); costura oscura a la izquierda de cada crema y roja a la derecha (como la IA);
       viga, línea oscura, cenefa roja y ribete lisos; 5 verdes y 2 cremas de cuantización fundidos.
    2. Faldón (y=43-46): 2 tonos planos con sus costuras verticales; 21 festones iguales de 7 px
       (muescas 1 y 2 px) sobre la sombra.
    3. Cajas: contornos dobles a 1 px (lista local). Mostrador: bordes ya de 1 px, se dejan.
    4. Remate (Mapa.rematar) fuera del toldo.
Uso: python -I assets/gen/pixel/src/edificios/retoques_v5.py   (desde la raíz del proyecto)
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
    m = Mapa.leer(AQUI / "casa_v4.txt")
    base = [r[:] for r in m.filas]
    cambios = {}

    def paso(nombre):
        cambios[nombre] = m.diff(base) - sum(cambios.values())

    # ---- 0. medidas de la V4: borde superior por columna (contorno 2:1 de la V4, se conserva) -----
    y_top = {}
    for x in range(m.w):
        col = [m.get(x, y) for y in range(m.h)]
        y_top[x] = next((y for y in range(m.h) if col[y] != "."), None)

    # ---- 4a. silueta lateral: contorno de 1 px en x=0 y x=153 desde el hombro hasta el alero ----------
    for y in range(64, 144):
        m.set(0, y, "0")
        m.set(153, y, "0")

    # ---- 1. alero: perfiles 5:3 espejados desde el vértice (cumbrera x=68..77, eje entre 72 y 73) --
    izq = Mapa.perfil_tramos(72, 96, [2, 2, 1], 1)
    der = Mapa.perfil_tramos(73, 96, [2, 2, 1], 152)
    y_out = {**izq, **der}
    CAPAS = [(0, 1, "1"), (1, 5, "p"), (6, 1, "4"), (7, 4, "l"), (11, 1, "1")]
    VUELO = lambda x: x <= 8 or x >= 145          # columnas del vuelo del alero, sin muro debajo

    def filtro(x, y, c):
        if VUELO(x):
            if y > 143:
                return None
            if y == 143:
                return "0"
        if c == "1" and y == y_out[x] and 68 <= x <= 77:
            return "p"                            # la cumbrera baja hasta la fascia sin contorno entre medias
        return c

    # ---- 2. tejas: máscara = tejado por encima del alero, fuera de cumbrera, franja clara y chimenea ---
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

    m.tejas(lambda x, y: x < 68 and techo(x, y), 8, 10, tono, ox=-4, oy=11, semilla=5)   # a ras de la cumbrera
    m.tejas(lambda x, y: x > 82 and techo(x, y), 8, 10, tono, ox=-5, oy=11, semilla=5)   # a ras de la franja clara
    for x in range(78, 83):                           # franja clara junto a la cumbrera (de la IA)
        for y in range(y_top[x] + 1, y_out[x]):
            m.set(x, y, "m")
    paso("tejas")

    m.bandas(y_out, CAPAS, filtro)
    # bajo el vuelo del alero no hay muro: fuera lo que quedara (salvo el poste de x=4-5)
    for x in list(range(0, 9)) + list(range(145, 154)):
        for y in range(144, m.h):
            if x not in (4, 5):
                m.set(x, y, ".")
    # restos de banda vieja (fascia/tabla) bajo la línea nueva -> el muro que hay debajo
    for x in range(17, 137):
        yl = y_out[x] + 11
        for y in range(yl + 1, yl + 4):
            if m.get(x, y) in "pl":
                rel = next((m.get(x, k) for k in range(y + 1, y + 9) if m.get(x, k) not in "pl"), "4")
                m.set(x, y, rel)
    # las tiras de esquina del muro (x=10-16 y 137-143) llevan su sombra oscura bajo el alero
    for x in list(range(9, 17)) + list(range(137, 145)):
        yl = y_out[x] + 11
        for y in range(yl + 1, 147):
            if m.get(x, y) != ".":
                m.set(x, y, "3" if x not in (9, 144) else "0")
    paso("alero")

    # ---- 3. chimenea -------------------------------------------------------------------------------
    for y in range(0, 51):
        for x in range(98, 126):
            if chimenea(x, y):
                m.set(x, y, "r")
    m.hlinea(100, 123, 0, "0")
    m.set(99, 1, "0"), m.set(124, 1, "0")
    m.vlinea(98, 2, 50, "0"), m.vlinea(125, 2, 50, "0")
    m.hlinea(99, 124, 50, "0")                        # base recta
    m.hlinea(100, 123, 1, "o")                        # canto superior
    m.rect(123, 2, 124, 20, "q")                      # cara derecha en sombra
    m.marco(105, 6, 120, 15, "g")                     # boca: marco 1 px
    m.rect(106, 7, 119, 8, "8")
    m.rect(106, 9, 119, 14, "2")
    m.hlinea(106, 119, 14, "o"), m.vlinea(119, 7, 14, "o")   # labio interior iluminado abajo-derecha
    # piedras: 4 hiladas de bloques planos, 3 tonos (r claro, q medio, o sombra) + juntas '8' de 1 px
    HILADAS = [  # (y0, y1, [x de las juntas verticales], [tonos de los bloques de izq. a der.])
        (21, 27, [107, 116], "qro"),
        (28, 34, [103, 111, 119], "rqqo"),
        (35, 42, [106, 115], "qqo"),
        (43, 49, [102, 110, 118], "oqqo"),
    ]
    for y0, y1, juntas, tonos in HILADAS:
        bordes = [98] + juntas + [125]
        for i, t in enumerate(tonos):
            m.rect(bordes[i] + 1, y0, bordes[i + 1] - 1, y1, t)
        for xj in juntas:
            m.vlinea(xj, y0, y1, "8")
        if y1 < 49:
            m.hlinea(99, 124, y1, "8")
    paso("chimenea")

    # ---- 4b. muro: contornos laterales de 1 px --------------------------------------------------------
    for y in range(144, m.h):
        m.set(145, y, ".")
        m.set(8, y, ".")
    m.hlinea(4, 144, 168, "0")
    paso("silueta")

    # ---- 5. remate -------------------------------------------------------------------------------------
    n = m.rematar(proteger=chimenea)
    paso("remate")
    m.escribir(AQUI / "casa_v5.txt", "V5: retoques de retoques_v5.py (ver cabecera del guion)")
    print("casa: pixeles cambiados por bloque:", cambios, "total", m.diff(base), "remate", n)


# =============================================================================== TIENDA
def tienda():
    m = Mapa.leer(AQUI / "tienda_v4.txt")
    base = [r[:] for r in m.filas]
    cambios = {}

    def paso(nombre):
        cambios[nombre] = m.diff(base) - sum(cambios.values())

    def x_izq(y):                                     # bordes laterales 5:1 de la V4
        return max(0, 8 - (y + 1) // 5)

    # ---- 1. toldo: viga, líneas y franjas en abanico regular ---------------------------------------
    ARRIBA = [26, 46, 65, 85, 104, 124]               # costuras en y=12 (simétricas respecto a x=75)
    ABAJO = [22, 43, 64, 86, 107, 128]                # costuras en y=42
    xs = Mapa.abanico(list(zip(ARRIBA, ABAJO)), 12, 42)
    xs[11] = xs[12]
    for y in range(1, 47):
        xl, xr = x_izq(y), 150 - x_izq(y)
        if y <= 6:
            relleno = "o"
        elif y <= 8:
            relleno = "6"
        elif y <= 10:
            relleno = "8"
        elif y == 11:
            relleno = "m"
        else:
            relleno = None
        if relleno:
            m.hlinea(xl + 1, xr - 1, y, relleno)
        if y >= 11:
            verde, crema = ("c", "p") if y <= 18 else (("e", "q") if y <= 42 else ("4", "k"))
            cos = xs[y] if y <= 42 else ABAJO
            bordes = [xl] + cos + [xr]
            for i in range(7):
                m.hlinea(bordes[i] + 1, bordes[i + 1] - 1, y, crema if i % 2 else verde)
            for i, xc in enumerate(cos):
                if y <= 42:
                    c = "6" if i % 2 == 0 else "8"    # oscura a la izq. de la crema, roja a la derecha
                else:
                    c = "3" if i % 2 == 0 else "6"
                if y == 11:
                    c = "8"
                m.set(xc, y, c)
        m.set(xl, y, "1"), m.set(xr, y, "0")
    paso("toldo")

    # ---- 2. faldón: festones iguales de 7 px (21 festones, x=2..148) sobre la sombra ---------------
    m.hlinea(1, 150, 47, "0"), m.hlinea(2, 149, 48, "0")
    m.festones(2, 148, 46, 7, [2, 1], "0")
    for x in (1, 149):
        m.vlinea(x, 45, 46, "0")
    paso("festones")

    # ---- 3. cajas: contornos dobles a 1 px ------------------------------------------------------------
    CAJAS = [(14, 103, "."), (14, 104, "."),            # saco de arriba: contorno izquierdo de 2 px
             (29, 104, "m"), (29, 105, "m"),            # saco | caja derecha: un solo contorno entre los dos
             (8, 113, "m"), (8, 114, "p"), (9, 114, "p")]  # caja izquierda: contorno de 2-3 px en el lateral
    for x, y, c in CAJAS:
        m.set(x, y, c)
    paso("cajas")

    # ---- 4. remate fuera del toldo ----------------------------------------------------------------------
    n = m.rematar(proteger=lambda x, y: y <= 48)
    paso("remate")
    m.escribir(AQUI / "tienda_v5.txt", "V5: retoques de retoques_v5.py (ver cabecera del guion)")
    print("tienda: pixeles cambiados por bloque:", cambios, "total", m.diff(base), "remate", n)


if __name__ == "__main__":
    casa()
    tienda()
