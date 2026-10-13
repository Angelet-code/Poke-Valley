"""Genera las PIEZAS del kit de edificios (fuentes txt editables en esta carpeta) a partir del arte
ya limpio de los edificios V6 (`../edificios/casa_v6.txt`, `tienda_v6.txt`), de los bloques a píxel
de `retoques_v6.py` y de unos pocos dibujos a mano (troncos). Determinista; no toca las fuentes V6.

Cada pieza sale como un txt independiente (formato de `pixel_build.py`, paleta propia, '.' =
transparente) con un margen de 1 px transparente alrededor cuando tiene sentido. Luego:

    python -I assets/gen/pixel/src/kit/hacer_kit.py                      (desde la raíz)
    python -I tools/pixel_build.py assets/gen/pixel/src/kit --out assets/game/pixel/kit

Piezas (ver docs/art/KIT.md):
  muestras (se repiten en mosaico): muro_madera 24x12 (dos hiladas de tablones de 6 filas, juntas
    verticales alternas, tonos del muro de la casa), muro_tablas_oscuro 24x6 (pared de la tienda),
    muro_esquina_izq / muro_esquina_der 10x6 (poste de esquina con su sombra), zocalo 24x2,
    poste 5x6 (pie derecho de la tienda), balda 24x4, mostrador 24x24 (tramo de mostrador: tablero +
    frontal de listones), teja_roja 20x16 (muestra de referencia de las tejas; el compositor las dibuja).
  piezas: puerta 36x39 (la de la casa V6, con su marco), ventana_jardinera 21x19 y ventana 18x13
    (ventana izquierda de la casa V6), chimenea 28x51 (corona + mampostería irregular, receta de la V6
    con Mapa.piedras sobre la silueta de la chimenea de la V4), letrero 19x13, tarro 9x11, saco 14x19,
    saquito 11x11, caja_manzanas 25x20, caja_peras 25x20, troncos 24x17 (pila de 3 troncos vistos de
    canto, estilo de items/tronco.txt).
Las piezas extraídas de la casa se "rematan" (huérfanos y dobles, Mapa.rematar); el dibujo no se
rediseña.
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[5] / "tools"))
from pixel_txt import Mapa  # noqa: E402

AQUI = Path(__file__).resolve().parent
EDIF = AQUI.parent / "edificios"


# ------------------------------------------------------------------------------------ utilidades
def nuevo(w, h, paleta):
    """Mapa vacío w x h con la paleta dada ({char: '#hex'})."""
    pal = [f"{c}={hx}" for c, hx in paleta.items()]
    return Mapa(pal, ["." * w] * h, [])


def recortar(src, x0, y0, x1, y1, dentro=None, margen=1):
    """Copia el rectángulo (incluido) de `src` a un Mapa nuevo con margen transparente; `dentro(x, y)`
    (coordenadas de src) limita la silueta: lo de fuera queda transparente. Solo lleva a la paleta
    los colores usados."""
    w, h = x1 - x0 + 1, y1 - y0 + 1
    filas = []
    usados = set()
    for y in range(y0, y1 + 1):
        fila = ""
        for x in range(x0, x1 + 1):
            ch = src.get(x, y)
            if dentro is not None and not dentro(x, y):
                ch = "."
            fila += ch
            if ch != ".":
                usados.add(ch)
        filas.append(fila)
    cols = src.colores()
    pal = {c: cols[c] for c in sorted(usados)}
    m = nuevo(w + 2 * margen, h + 2 * margen, pal)
    m.pegar(margen, margen, filas)
    return m


def guardar(m, nombre, comentario):
    m.cabecera = [f"; {nombre}: {comentario}", "; generado por hacer_kit.py (kit de edificios); editable a mano"]
    m.escribir(AQUI / f"{nombre}.txt")
    print(f"{nombre}.txt  {m.w}x{m.h}  {len(m.paleta)} colores")


def en_rects(rects):
    return lambda x, y: any(a <= x <= c and b <= y <= d for a, b, c, d in rects)


# ------------------------------------------------------------------------------------ casa
def piezas_casa():
    C = Mapa.leer(EDIF / "casa_v6.txt")
    P = C.colores()

    # puerta con marco (x=57..92, y=129..167 de la V6; el borde inferior y=167 es su propio contorno)
    m = recortar(C, 57, 129, 92, 167)
    m.set(35, 39, "8"), m.set(36, 39, "1")          # esquina inferior derecha: el contorno llega hasta abajo
    m.rematar()
    guardar(m, "puerta", "puerta de la casa V6 con su marco (36x39); apoya en el zócalo")

    # portón de granero: dos hojas de tablones verticales con travesaño y tirante en diagonal (paleta de la
    # puerta: marco o, tablones l / junta 7, sombra 4, contorno 1)
    pal = {"o": P["o"], "l": P["l"], "7": P["7"], "4": P["4"], "1": P["1"], "r": P["r"]}
    m = nuevo(52, 44, pal)
    x0, y0, x1, y1 = 1, 1, 50, 42
    m.marco(x0, y0, x1, y1, "1")
    m.rect(x0 + 1, y0 + 1, x1 - 1, y0 + 4, "o")              # dintel
    m.hlinea(x0 + 1, x1 - 1, y0 + 1, "r")
    m.rect(x0 + 1, y0 + 5, x0 + 3, y1 - 1, "o")              # jambas
    m.rect(x1 - 3, y0 + 5, x1 - 1, y1 - 1, "o")
    m.vlinea(x0 + 4, y0 + 5, y1 - 1, "4")                    # sombra bajo el dintel y junto a las jambas
    m.hlinea(x0 + 4, x1 - 4, y0 + 5, "4")
    for hx0, hx1 in ((x0 + 5, 24), (26, x1 - 4)):            # dos hojas
        for y in range(y0 + 6, y1):
            m.hlinea(hx0, hx1, y, "l")
        for x in range(hx0 + 5, hx1, 6):                     # tablones verticales
            m.vlinea(x, y0 + 6, y1 - 1, "7")
        m.hlinea(hx0, hx1, y0 + 14, "7")                     # travesaño alto
        m.hlinea(hx0, hx1, y0 + 15, "o")
        m.hlinea(hx0, hx1, y0 + 16, "4")
        m.hlinea(hx0, hx1, y1 - 8, "7")                      # travesaño bajo
        m.hlinea(hx0, hx1, y1 - 7, "o")
        m.hlinea(hx0, hx1, y1 - 6, "4")
        m.linea(hx0, y1 - 9, hx1, y0 + 17, "o")              # tirante en diagonal (Bresenham)
        m.linea(hx0, y1 - 8, hx1, y0 + 18, "4")
    m.vlinea(25, y0 + 5, y1 - 1, "1")                        # junta entre las hojas
    m.hlinea(x0 + 4, x1 - 4, y1 - 1, "4")
    m.rematar()
    guardar(m, "porton", "portón de granero de dos hojas con travesaños y tirantes (50x42)")

    # ventana con jardinera: marco x=29..45 y=136..148 + jardinera x=27..47 y=149..154
    m = recortar(C, 27, 136, 47, 154, en_rects([(29, 136, 45, 148), (27, 149, 47, 154)]))
    m.rematar()
    guardar(m, "ventana_jardinera", "ventana izquierda de la casa V6 con su jardinera (21x19)")

    # ventana lisa: solo marco, cristales y alféizar
    m = recortar(C, 29, 136, 46, 148)
    m.rematar()
    guardar(m, "ventana", "ventana de la casa V6 sin jardinera (18x13)")

    # chimenea: silueta de la V4 (x=98..125, y=0..50), corona lisa + mampostería irregular (receta V6)
    def chim(x, y):
        if y == 0:
            return 100 <= x <= 123
        if y == 1:
            return 99 <= x <= 124
        return True
    m = recortar(C, 98, 0, 125, 50, chim)
    guardar(m, "chimenea", "chimenea de la casa V6: corona lisa, boca, mampostería irregular (28x51)")

    # muro de madera: dos hiladas de tablones de 6 filas (canto claro, cuerpo, sombra, junta), juntas
    # verticales alternas, con los tonos del muro de la casa V6 (g canto, 8 cuerpo, 4 sombra, 2 junta)
    pal = {"g": P["g"], "8": P["8"], "4": P["4"], "2": P["2"]}
    m = nuevo(24, 12, pal)
    for k in range(2):
        y0 = k * 6
        for j, c in enumerate("g88842"):
            m.hlinea(0, 23, y0 + j, c)
        xj = 5 if k == 0 else 17                     # junta vertical (fin de tablón), alterna
        m.vlinea(xj, y0, y0 + 4, "2")
        m.set(xj + 1, y0, "8")                       # el canto claro no cruza la junta
    guardar(m, "muro_madera", "muestra repetible del muro de tablones (24x12, periodo 6 filas)")

    # postes de esquina: contorno + 7 px de madera clara + sombra de 2 px contra el muro
    pal = {"0": P["0"], "l": P["l"]}
    m = nuevo(10, 6, pal)
    for y in range(6):
        m.pegar(0, y, ["0lllllll00"])
    guardar(m, "muro_esquina_izq", "poste de esquina izquierdo (10x6, se repite en vertical)")
    m = nuevo(10, 6, pal)
    for y in range(6):
        m.pegar(0, y, ["00lllllll0"])
    guardar(m, "muro_esquina_der", "poste de esquina derecho (10x6, se repite en vertical)")

    # zócalo: fila de sombra + contorno de la base
    pal = {"2": P["2"], "0": P["0"]}
    m = nuevo(24, 2, pal)
    m.hlinea(0, 23, 0, "2")
    m.hlinea(0, 23, 1, "0")
    guardar(m, "zocalo", "zócalo: sombra + línea de base (24x2, se repite en horizontal)")

    # muestra de tejas (referencia visual; el compositor las dibuja él con la misma receta)
    pal = {"n": P["n"], "m": P["m"], "j": P["j"], "i": P["i"], "9": P["9"], "6": P["6"], "7": P["7"], "3": P["3"]}
    m = nuevo(20, 16, pal)
    m.tejas_v(lambda x, y: x < 10, 10, 8, lambda xc, yc, dk: ("m", "n", "7"), "izq", ox=0, oy=0, semilla=5)
    m.tejas_v(lambda x, y: x >= 10, 10, 8, lambda xc, yc, dk: ("i", "j", "3"), "der", ox=10, oy=0, semilla=5)
    m.rematar()
    guardar(m, "teja_roja", "muestra de teja roja: hilada vertical clara (izq.) y en sombra (der.), 10x8 por teja")


# ------------------------------------------------------------------------------------ tienda
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


def piezas_tienda():
    T = Mapa.leer(EDIF / "tienda_v6.txt")
    P = T.colores()

    def desde_bloque(bloque, nombre, comentario):
        filas = bloque.splitlines()
        usados = sorted({c for f in filas for c in f if c != "."})
        m = nuevo(len(filas[0]) + 2, len(filas) + 2, {c: P[c] for c in usados})
        m.pegar(1, 1, filas)
        m.rematar()
        guardar(m, nombre, comentario)

    desde_bloque(TARRO, "tarro", "tarro de cristal azulado (9x11)")
    desde_bloque(SACO, "saco", "saco de arpillera (14x19)")
    desde_bloque(SAQUITO, "saquito", "saquito de arpillera (11x11)")

    # letrero colgado (sin texto) con sus dos cuerdas
    m = recortar(T, 66, 49, 84, 61, en_rects([(66, 52, 84, 61), (69, 49, 69, 51), (81, 49, 81, 51)]))
    guardar(m, "letrero", "letrero colgado sin texto, con cuerdas (19x13)")

    # cajas de fruta: la receta de retoques_v6 (fila trasera de 3 piezas asomando, 4 delante, caja de listones)
    def caja_fruta(nombre, estampas, comentario):
        usados = {"l", "b", "5", "1"} | {c for e in estampas for f in e.splitlines() for c in f if c != "."}
        m = nuevo(27, 22, {c: P[c] for c in sorted(usados)})
        x0, y0, x1, y1 = 1, 6, 25, 20
        tras = [(x0 + 5 + 6 * i, y0 - 5) for i in range(3)]
        delante = [(x0 + 2 + 6 * i, y0 - 3) for i in range(4)]
        for k, (x, y) in enumerate(tras + delante):
            m.pegar(x, y, estampas[k % len(estampas)])
        m.caja(x0, y0, x1, y1, "l", "b", "5", "1", periodo=5)
        m.rematar()                                   # los brillos de 1 px de la fruta se funden (regla 1)
        guardar(m, nombre, comentario)

    caja_fruta("caja_manzanas", [MANZANA], "caja de listones con manzanas rojas (25x20)")
    caja_fruta("caja_peras", [PERA, LIMA, PERA, LIMA, LIMA, PERA, PERA], "caja de listones con peras y limas (25x20)")

    # caja de listones vacía (la de abajo a la izquierda de la tienda V6)
    m = nuevo(21, 19, {c: P[c] for c in "lb51"})
    m.caja(1, 1, 19, 17, "l", "b", "5", "1", periodo=5)
    guardar(m, "caja", "caja de listones (19x17)")

    # poste (pie derecho): contorno, madera clara, media, sombra, contorno
    m = nuevo(5, 6, {c: P[c] for c in "1lh9"})
    for y in range(6):
        m.pegar(0, y, ["1lh91"])
    guardar(m, "poste", "pie derecho de la tienda (5x6, se repite en vertical)")

    # balda: canto claro, madera, sombra, línea
    m = nuevo(24, 4, {c: P[c] for c in "lh91"})
    for j, c in enumerate("lh91"):
        m.hlinea(0, 23, j, c)
    guardar(m, "balda", "balda de madera (24x4, se repite en horizontal)")

    # pared oscura de tablones de la tienda: 5 filas de tabla + 1 de junta
    m = nuevo(24, 6, {c: P[c] for c in "32"})
    for j in range(6):
        m.hlinea(0, 23, j, "2" if j == 5 else "3")
    guardar(m, "muro_tablas_oscuro", "pared trasera oscura de la tienda (24x6, periodo 6 filas)")

    # tramo de mostrador: tablero (o, m x4, l) + arista + 3 listones de 5 filas (l b b b 5) con una junta
    # vertical alterna por listón + remate + base. 24x24; el compositor añade los contornos laterales.
    m = nuevo(24, 24, {c: P[c] for c in "omlb51"})
    for j, c in enumerate("ommmml1"):
        m.hlinea(0, 23, j, c)
    for k in range(3):
        y0 = 7 + 5 * k
        for j, c in enumerate("lbbb5"):
            m.hlinea(0, 23, y0 + j, c)
        m.vlinea(14 if k % 2 == 0 else 2, y0 + 1, y0 + 3, "5")
    m.hlinea(0, 23, 22, "5")
    m.hlinea(0, 23, 23, "1")
    guardar(m, "mostrador", "tramo de mostrador: tablero + frontal de listones (24x24, se repite en horizontal)")


# ------------------------------------------------------------------------------------ troncos
TRONCO_CANTO = """...ooooo...
..olllllo..
.olpppppmo.
olpppppppmo
olpppqpppmo
olppqqqppdo
olpppqpppdo
omppppppddo
.ompppppdo.
..omddddo..
...ooooo..."""


def tronco_canto(m, cx, cy):
    """Un tronco visto de canto (11x11, a mano): círculo clásico de radio 5 (tramos 5-1-1-3, sin esquinas
    dobles), contorno o, corteza l (luz arriba-izquierda) / m / d (sombra abajo-derecha), corte claro p con
    el anillo q en cruz."""
    m.pegar(cx - 5, cy - 5, TRONCO_CANTO)


def piezas_mano():
    o = Mapa.leer(AQUI.parent / "items" / "tronco.txt").colores()
    m = nuevo(23, 21, {c: o[c] for c in "olmdpq"})
    tronco_canto(m, 6, 14)       # abajo izquierda
    tronco_canto(m, 16, 14)      # abajo derecha
    tronco_canto(m, 11, 6)       # arriba, en medio
    m.rematar()
    guardar(m, "troncos", "pila de tres troncos vistos de canto, paleta de items/tronco.txt (23x21)")


if __name__ == "__main__":
    piezas_casa()
    piezas_tienda()
    piezas_mano()
