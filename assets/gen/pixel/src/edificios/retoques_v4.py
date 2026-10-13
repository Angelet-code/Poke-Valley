"""Retoques a mano (reproducibles) de los edificios, VERSION 4: el dibujo de la IA INTACTO, solo
bordes limpios. (La V3 rediseñaba/simplificaba y fue rechazada.)

Entrada: casa_v4_raw.txt y tienda_v4_raw.txt (originales Flux 1024 -> pixel_grid.py SIN --w, paso 4
         -> pixel_clean.py --smooth 1 --islands 2 --jaggy all -> png_to_txt.py).
Salida:  casa_v4.txt, tienda_v4.txt -> pixel_build.py -> assets/game/pixel/edificios/.

Solo se tocan defectos locales (cada bloque dice qué y por qué); nada se redibuja ni se espeja:
  CASA (154x170)
    1. Contorno superior del tejado: los dos faldones traseros a 2:1 exacto (contorno de 1 px),
       anclados en la cumbrera; codo vertical en x=19 (como en la IA); hombros curvos simétricos
       (tramos 1,1,...,2,2,3) hasta las esquinas (0,64)/(153,64); el borde tras la chimenea
       arranca en (126,51). Pendiente original ~1,7:1 -> los extremos suben <= 4 px.
    2. Alero en V: se conserva tal cual (pendiente ~1,7:1 de la IA); solo se rellenan los
       pellizcos y el hueco de la fascia naranja (izq. y=113-115 y 127-130; der. y=109-118 y
       129-130) y dos escalones de 1 px. Probado y descartado: desplazar la banda por columnas.
    3. Ventanas: marco de 2 px recto y cristales 3x3 alineados (la derecha tenía un cristal roto).
    4. Chimenea: contorno izquierdo completo (98,16) y esquina inferior derecha de 1 px.
    5. Base: borde inferior recto en y=168 (antes bailaba entre 167 y 169).
  TIENDA (151x126)
    1. Bordes laterales del toldo a 5:1 regular y simétricos (contorno de 1 px), tramo de la viga incluido.
    2. Costuras de las franjas (verde/crema) con Bresenham entre sus extremos reales (abanico de la IA).
    3. Línea de sombra bajo el toldo (y=47-48) continua.
    4. Remate: huérfanos/dobles que dejan los retoques (tabla), incluido el doble de las cajas (38,118).
Uso: python -I assets/gen/pixel/src/edificios/retoques_v4.py   (desde la raíz del proyecto)
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[5] / "tools"))
from pixel_txt import Mapa  # noqa: E402

AQUI = Path(__file__).resolve().parent


def lin(x0, y0, x1, y1):
    """y(x) por redondeo (= tramos de Bresenham) para columnas entre x0 y x1."""
    return {x: y0 + round((x - x0) * (y1 - y0) / (x1 - x0)) for x in range(min(x0, x1), max(x0, x1) + 1)}


# =============================================================================== CASA
def casa():
    m = Mapa.leer(AQUI / "casa_v4_raw.txt")
    base = [r[:] for r in m.filas]
    OSC = set("01245")  # morados/azules oscuros de contorno (no los rojos oscuros de sombra)
    cambios = {}

    # ---- 1. contorno superior del tejado --------------------------------------------------
    tops = {}
    for x in range(19, 74):            # faldón trasero izquierdo, 2:1 desde la cumbrera (73,11)
        tops[x] = 11 + (73 - x) // 2   # llega a (19,38); la IA lo tenía a ~1,76:1 (codo en y=42)
    tops[74] = tops[75] = 10           # vértice de la cumbrera
    for x in range(76, 98):            # faldón trasero derecho hasta la chimenea (x=98)
        tops[x] = 11 + (x - 76) // 2
    hombro_izq = {18: 52, 17: 53, 16: 54, 15: 55, 14: 56, 13: 57, 12: 58, 11: 59, 10: 59, 9: 60, 8: 60,
                  7: 61, 6: 61, 5: 62, 4: 62, 3: 63, 2: 63, 1: 63, 0: 64}   # curva: 1,1,..,2,2,3
    tops.update(hombro_izq)
    for x in range(126, 150):          # tras la chimenea, 2:1 desde (126,51)
        tops[x] = 51 + (x - 126) // 2
    tops.update({150: 63, 151: 63, 152: 63, 153: 64})   # hombro derecho (espejo del izquierdo)
    n = m.contorno_superior(tops, "0", OSC)
    # codo vertical en x=19 (y=38..51): contorno de 1 px, lo oscuro de más a la derecha -> relleno
    for y in range(38, 52):
        m.set(19, y, "0")
        for x in (20, 21):
            if m.get(x, y) in OSC or m.get(x, y) == ".":
                m.set(x, y, next(m.get(k, y) for k in range(22, 30) if m.get(k, y) not in OSC))
    cambios["contorno tejado"] = m.diff(base)

    # ---- 4. chimenea ----------------------------------------------------------------------
    ant = m.diff(base)
    m.set(98, 16, "0")                       # hueco en el contorno izquierdo
    for y in (49, 50):                       # esquina inferior derecha: contorno de 1 px en x=125
        m.set(125, y, "0")
        m.set(124, y, m.get(124, 48))
    cambios["chimenea"] = m.diff(base) - ant

    # ---- 2. alero: solo los pellizcos y huecos de la fascia naranja ('p'), banda de ~5-7 px ---
    # (Se probó desplazar la banda entera por columnas para dejarla a 2:1 exacto y quedó
    #  deshilachada: cada columna tiene otro grosor. El alero conserva la pendiente de la IA.)
    ant = m.diff(base)
    # izquierda: borde interior en (61,103); escalón del borde exterior en y=109-110
    m.set(61, 103, "p")
    m.set(57, 109, "g")
    m.hlinea(55, 56, 110, "g")
    # izquierda: pellizco y hueco en y=113-115 (la fascia se interrumpía en la fila 115)
    m.set(42, 113, "5")
    m.hlinea(43, 48, 113, "p")
    m.hlinea(41, 48, 114, "p")
    m.hlinea(40, 45, 115, "p")
    # izquierda: pellizco en y=127-130 (la fascia quedaba en 1-3 px)
    m.hlinea(20, 26, 127, "p")
    m.hlinea(19, 25, 128, "p")
    m.hlinea(17, 23, 129, "p")
    m.set(24, 129, "1")
    m.hlinea(16, 22, 130, "p")
    # izquierda: escalón en y=134-135
    m.hlinea(14, 15, 134, "p")
    m.set(13, 135, "p")
    # derecha: borde interior estancado en y=105-106
    m.set(86, 105, "7")
    m.hlinea(86, 87, 106, "7")
    # derecha: HUECO de la fascia en y=109-118 (la IA la cortaba y la retomaba 10 px más allá):
    # banda de 4-6 px entre el borde interior (2:1) y el exterior, con su línea oscura fuera
    for y, a, b, c in ((109, 94, 98, None), (110, 95, 100, None), (111, 97, 102, 103), (112, 99, 103, 104),
                       (113, 101, 105, 106), (114, 103, 106, None), (115, 105, 108, 109), (116, 107, 110, None),
                       (117, 108, 111, None), (118, 108, 113, None)):
        m.hlinea(a, b, y, "p")
        if c:
            m.set(c, y, "6")
    m.set(104, 115, "2")
    m.set(107, 117, "7")
    m.set(107, 118, "1")
    m.set(112, 121, "1")
    # derecha: pellizco en y=129-130
    m.hlinea(127, 131, 129, "p")
    m.hlinea(129, 133, 130, "p")
    cambios["alero"] = m.diff(base) - ant

    # ---- 3. ventanas ----------------------------------------------------------------------
    ant = m.diff(base)
    for x0 in (32, 107):                      # x0 = marco izquierdo (2 px); cristales 2x2 de 3x3
        m.hlinea(x0, x0 + 10, 140, "r")
        m.hlinea(x0, x0 + 10, 148, "r")
        for y in range(141, 148):
            for x in (x0, x0 + 1, x0 + 5, x0 + 9, x0 + 10):
                m.set(x, y, "r")
            for x in list(range(x0 + 2, x0 + 5)) + list(range(x0 + 6, x0 + 9)):
                m.set(x, y, "r" if y == 144 else "1")
            if m.get(x0 - 1, y) in "rq":      # fuera del marco, la sombra marrón de la IA
                m.set(x0 - 1, y, "o")
            if m.get(x0 + 11, y) in "rq":
                m.set(x0 + 11, y, "a" if x0 == 32 else "o")
    cambios["ventanas"] = m.diff(base) - ant

    # ---- 5. base recta --------------------------------------------------------------------
    ant = m.diff(base)
    for x in range(m.w):
        if any(m.get(x, y) != "." for y in (167, 168, 169)):
            m.set(x, 168, "0")
            m.set(x, 169, ".")
            if m.get(x, 167) == ".":
                m.set(x, 167, m.get(x, 166))
    cambios["base"] = m.diff(base) - ant

    # ---- 6. remate: huérfanos y dobles que dejan los retoques anteriores (lo que haría
    #      pixel_clean --islands 1 --jaggy all, horneado aquí para que el txt sea la única fuente;
    #      5 esquinas biestables resueltas con un tercer color vecino)
    ant = m.diff(base)
    FINAL_CASA = [  # (x, y, char): huérfanos/dobles que dejaron los retoques, según pixel_clean --islands 1 --jaggy all
        (46, 29, "7"), (13, 59, "m"), (126, 79, "9"), (60, 102, "7"), (138, 105, "b"), (102, 107, "a"),
        (98, 108, "p"), (101, 110, "p"), (96, 112, "l"), (42, 113, "p"), (106, 113, "p"), (107, 119, "g"),
        (107, 120, "l"), (112, 121, "p"), (29, 127, "l"), (108, 139, "4"), (30, 145, "a"), (31, 148, "r"),
        (43, 148, "a"), (10, 167, "l"), (95, 167, "0"), (137, 167, "l"), (144, 167, "0"),
    ]
    for x, y, c in FINAL_CASA:
        m.set(x, y, c)
    cambios["remate"] = m.diff(base) - ant

    m.escribir(AQUI / "casa_v4.txt", "V4: retoques de retoques_v4.py (ver cabecera del guion)")
    print("casa: pixeles cambiados a mano por bloque:", cambios, "total", m.diff(base))


# =============================================================================== TIENDA
def tienda():
    m = Mapa.leer(AQUI / "tienda_v4_raw.txt")
    base = [r[:] for r in m.filas]
    OSC = set("012")
    cambios = {}

    # ---- 1. bordes laterales del toldo a 5:1 (viga incluida), simétricos ---------------------
    def x_izq(y):
        return max(0, 8 - (y + 1) // 5)

    for y in range(0, 47):
        xl, xr = x_izq(y), 150 - x_izq(y)
        fila = m.filas[y]
        # relleno: primer color no oscuro desde dentro
        fi = next((fila[k] for k in range(xl + 1, 30) if fila[k] not in OSC and fila[k] != "."), "1")
        fd = next((fila[k] for k in range(xr - 1, 120, -1) if fila[k] not in OSC and fila[k] != "."), "1")
        for x in range(0, xl):
            fila[x] = "."
        for x in range(xr + 1, m.w):
            fila[x] = "."
        fila[xl] = "1"
        fila[xr] = "0"
        for x in (xl + 1, xl + 2):          # contorno viejo pegado -> tela / viga
            if fila[x] in OSC or fila[x] == ".":
                fila[x] = fi
        for x in (xr - 1, xr - 2):
            if fila[x] in OSC or fila[x] == ".":
                fila[x] = fd
    m.hlinea(x_izq(0), 150 - x_izq(0), 0, "1")      # borde superior de la viga completo
    cambios["bordes toldo"] = m.diff(base)

    # ---- 2. costuras de las franjas: Bresenham entre sus extremos reales (fila 12 -> 41) -----
    ant = m.diff(base)
    costuras = [(25, 22, "6"), (43, 40, "8"), (64, 64, "6"), (84, 85, "8"), (103, 108, "6"), (125, 129, "6")]
    for xt, xb, c in costuras:
        xs = {y: xt + round((y - 12) * (xb - xt) / (41 - 12)) for y in range(12, 42)}
        for y in range(12, 42):
            fila = m.filas[y]
            xn = xs[y]
            # costura vieja: el píxel de color de costura más cercano en +-3
            cand = [k for k in range(xn - 3, xn + 4) if fila[k] in "689"]
            xo = min(cand, key=lambda k: abs(k - xn)) if cand else xn
            if xo < xn:                      # se mueve a la derecha: la franja izquierda crece
                izq = fila[xo - 1]
                for k in range(xo, xn):
                    fila[k] = izq
            elif xo > xn:                    # a la izquierda: la franja derecha crece
                der = fila[xo + 1]
                for k in range(xn + 1, xo + 1):
                    fila[k] = der
            fila[xn] = c
    cambios["costuras"] = m.diff(base) - ant

    # ---- 3. línea de sombra bajo el toldo ---------------------------------------------------
    ant = m.diff(base)
    m.hlinea(1, 150, 47, "0")
    m.hlinea(2, 149, 48, "0")
    cambios["sombra toldo"] = m.diff(base) - ant

    # ---- 4. remate: huérfanos y dobles que dejan los retoques (ídem casa) ------------------
    ant = m.diff(base)
    FINAL_TIENDA = [
        (104, 11, "8"), (124, 15, "6"), (106, 20, "q"), (126, 24, "q"), (128, 28, "e"), (4, 29, "i"),
        (129, 36, "i"), (148, 39, "e"), (41, 41, "e"), (130, 41, "f"), (38, 118, "6"),
    ]
    for x, y, c in FINAL_TIENDA:
        m.set(x, y, c)
    cambios["remate"] = m.diff(base) - ant

    m.escribir(AQUI / "tienda_v4.txt", "V4: retoques de retoques_v4.py (ver cabecera del guion)")
    print("tienda: pixeles cambiados a mano por bloque:", cambios, "total", m.diff(base))


if __name__ == "__main__":
    casa()
    tienda()
