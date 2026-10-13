"""Retoques reproducibles de los edificios, VERSION 7: tres cambios quirúrgicos sobre la V6 según el
veredicto del usuario (tienda mucho mejor, tejado de la casa bien). Nada más cambia: el guion comprueba
que la diferencia con la V6 fuera de las tres zonas es 0.

Entrada: casa_v6.txt (+ casa_v4.txt y casa_v5.txt como fuente de las zonas) y tienda_v6.txt.
Salida: casa_v7.txt, tienda_v7.txt -> pixel_build.py -> assets/game/pixel/edificios/. Determinista, sin IA.

  CASA (154x170)
    1. Chimenea = la ORIGINAL (V4, muestreo 1:1 del Flux: piedra beige/crema con formas irregulares,
       mortero marrón, corona clara con la boca oscura, lado derecho más oscuro). La mampostería regular
       de la V6 se rechazó. Se pega el bloque x=98..125, y=0..49 de casa_v4.txt sobre la V6 (Mapa.pegar
       con la máscara de la silueta V6: esquinas a 45º arriba, lados x=98/125) y se limpia lo mínimo:
       contorno de 1 px (la V4 lo tenía doble/torcido: '11' arriba a la izq., x=98->99 en y=23..42, sin
       contorno en y=43..49; a la derecha '2'+'0' y un escalón de 125->124 en y>=24), los píxeles de teja
       roja que invadían la esquina inferior izquierda (x=99..104, y=43..49) pasan a piedra oscura 'o',
       '4' se funde en '2' dentro de la boca (casi idénticos: #291b2c / #30191d) y en 'o' fuera (era sombra del contorno), la cara derecha queda o|u (1+1 px, un tono
       más oscura, sin doble línea) y se quitan huérfanos y dobles solo dentro de la chimenea. Formas y tonos
       de las piedras, corona y boca: los de la V4. Base recta de la V6 (y=50) y sombra sobre las tejas
       (x=126..131) intactas.
    2. El "hastial pequeño" sobre la puerta de la V6 (bloque 2 de retoques_v6.py) era un error: ese
       triángulo es muro de fachada ("murillo"), no tejado. Vuelve a ser EXACTAMENTE el muro de la V5:
       se copia casa_v5.txt en la región que tocó aquel bloque (x=10..143, y_alero[x]+12 .. 128; las bandas
       del alero de la V5 no se tocan).
  TIENDA (151x126)
    3. Abajo a la izquierda, las dos cajas (y el saquito) pasan a ser una PILA DE TRONCOS, que es lo que
       había en el Flux original: 3 troncos de 18x9 (2 abajo, 1 encima, en pirámide), horizontales, con el
       corte hacia el espectador a la izquierda como disco crema con anillo (tonos del item tronco.png:
       C=#e3c892, F=#c1a068), corteza en 3 marrones (k lit arriba 1 px, b, 6) con una veta, contorno de
       1 px '1' (como el resto del puesto) y sombra '0' de 1 px en el suelo. Misma huella que las cajas
       (x=7..42, y=108..125); el saquito no cabe junto a la pila y se quita. Toldo, mostrador, mercancía:
       intactos.
Uso: python -I assets/gen/pixel/src/edificios/retoques_v7.py   (desde la raíz del proyecto)
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[5] / "tools"))
from pixel_txt import Mapa  # noqa: E402

AQUI = Path(__file__).resolve().parent

# cajas (x0, y0, x1, y1) de las zonas que cambian; fuera de ellas la diferencia con la V6 debe ser 0
CAJA_CHIMENEA = (98, 0, 125, 49)
CAJA_TRONCOS = (7, 103, 43, 125)


def en_caja(caja, x, y):
    return caja[0] <= x <= caja[2] and caja[1] <= y <= caja[3]


# =============================================================================== CASA
def casa():
    m = Mapa.leer(AQUI / "casa_v6.txt")
    v4 = Mapa.leer(AQUI / "casa_v4.txt")
    v5 = Mapa.leer(AQUI / "casa_v5.txt")
    v6 = [r[:] for r in m.filas]

    # ---- silueta de la chimenea (la de la V6: esquinas a 45º, lados x=98 y x=125) ------------------------
    def chimenea(x, y):
        if not (98 <= x <= 125 and 0 <= y <= 49):
            return False
        if y == 0:
            return 100 <= x <= 123
        if y == 1:
            return 99 <= x <= 124
        return True

    def contorno(x, y):
        return chimenea(x, y) and (y == 0 or x in (98, 125) or (y == 1 and x in (99, 124)))

    def interior(x, y):
        return chimenea(x, y) and not contorno(x, y)

    # ---- 1. chimenea de la V4 pegada y limpiada ---------------------------------------------------------
    bloque = ["".join(v4.filas[y][98:126]) for y in range(0, 50)]
    m.pegar(98, 0, bloque, saltar="")                 # todo el bloque, también los '.'
    for y in range(0, 50):
        for x in range(98, 126):
            if contorno(x, y):
                m.set(x, y, "0")
            elif not chimenea(x, y):
                m.set(x, y, v6[y][x])                 # esquinas fuera de la silueta: como la V6 ('.')

    PIEDRA = set("rqogR82u")                          # colores legítimos dentro de la chimenea
    A_OSCURO = set("01345679abcdefhik.")              # contorno viejo y tejas rojas que invadían -> piedra oscura
    n_fund, n_teja = 0, 0
    for y in range(1, 50):
        for x in range(100, 123):
            c = m.get(x, y)
            if c == "4" and 105 <= x <= 120 and 6 <= y <= 16:
                m.set(x, y, "2")                      # dentro de la boca: casi idéntico a '2'
                n_fund += 1
            elif c == "4" or c not in PIEDRA:         # fuera de la boca el '4' era contorno/sombra residual
                m.set(x, y, "o" if c in A_OSCURO else "q")
                n_teja += 1
    for y in range(2, 50):                            # cara derecha: o | u (sombra), sin la doble línea 2/0 de la V4
        if m.get(123, y) in A_OSCURO or m.get(123, y) in "28":
            m.set(123, y, "o")
        m.set(124, y, "u")
    for y in range(2, 50):                            # columna izquierda: lo que era contorno/mortero toma la piedra vecina
        if m.get(99, y) not in PIEDRA or m.get(99, y) in "28":
            m.set(99, y, m.get(100, y))
    m.set(100, 1, "o"), m.set(123, 1, "o")            # canto de la corona bajo las esquinas
    n_rem = m.rematar(proteger=lambda x, y: not interior(x, y))
    assert all(m.get(x, y) != "0" for y in range(50) for x in range(126) if interior(x, y)), "contorno doble"

    # ---- 2. murillo sobre la puerta: el muro de la V5 ------------------------------------------------------
    izq = Mapa.perfil_tramos(72, 96, [2, 2, 1], 1)
    der = Mapa.perfil_tramos(73, 96, [2, 2, 1], 152)
    y_out = {**izq, **der}

    def murillo(x, y):
        return 10 <= x <= 143 and y_out[x] + 11 < y <= 128

    n_muro = 0
    for y in range(100, 129):
        for x in range(10, 144):
            if murillo(x, y) and m.get(x, y) != v5.get(x, y):
                m.set(x, y, v5.get(x, y))
                n_muro += 1

    # ---- contabilidad -----------------------------------------------------------------------------------------
    d_chim = sum(1 for y in range(m.h) for x in range(m.w) if m.get(x, y) != v6[y][x] and en_caja(CAJA_CHIMENEA, x, y))
    d_v4 = sum(1 for y in range(0, 50) for x in range(98, 126) if m.get(x, y) != v4.get(x, y))
    d_muro = sum(1 for y in range(m.h) for x in range(m.w) if m.get(x, y) != v6[y][x] and murillo(x, y))
    d_v5 = sum(1 for y in range(m.h) for x in range(m.w) if m.get(x, y) != v5.get(x, y) and murillo(x, y))
    d_fuera = sum(1 for y in range(m.h) for x in range(m.w)
                  if m.get(x, y) != v6[y][x] and not en_caja(CAJA_CHIMENEA, x, y) and not murillo(x, y))
    m.escribir(AQUI / "casa_v7.txt", "V7: retoques de retoques_v7.py (ver cabecera del guion)")
    print(f"casa: chimenea {d_chim} px distintos de la V6 en la caja, {d_v4} distintos de la V4 "
          f"(tejas->piedra {n_teja}, 4->2 {n_fund}, remate {n_rem}); murillo {d_muro} px vueltos a la V5 "
          f"(quedan {d_v5} distintos de la V5); FUERA de las zonas: {d_fuera}")
    assert d_fuera == 0 and d_v5 == 0


# =============================================================================== TIENDA
# tronco de 18x9 visto de lado, corte a la izquierda (estilo del item tronco.png)
TRONCO = """\
..111111111111111.
.1CCC1kkkkkkkkkkk1
1CCFCC1bbbbbbbbbb1
1CFCFC1bbbbbbbbbb1
1FCCCF1bbbbb66bbb1
1CFCFC1bbbbbbbbbb1
1CCFCC166666666661
.1CCC1666666666661
..111111111111111."""


def tienda():
    m = Mapa.leer(AQUI / "tienda_v6.txt")
    v6 = [r[:] for r in m.filas]
    m.color("C", "#e3c892")   # cara del corte (como tronco.png)
    m.color("F", "#c1a068")   # anillos del corte (como tronco.png)

    # ---- 3. pila de troncos en lugar de las cajas y el saquito ----------------------------------------------
    x0, y0, x1, y1 = CAJA_TRONCOS
    m.rect(x0, y0, x1, y1, ".")
    m.pegar(7, 116, TRONCO)                           # abajo izquierda
    m.pegar(24, 116, TRONCO)                          # abajo derecha (comparte la columna de contorno x=24)
    m.pegar(16, 108, TRONCO)                          # encima, apoyado en los dos (comparte la fila de contorno y=116)
    m.hlinea(8, 42, 125, "0")                         # sombra de 1 px en el suelo
    n_rem = m.rematar(proteger=lambda x, y: not en_caja(CAJA_TRONCOS, x, y))

    d_caja = sum(1 for y in range(m.h) for x in range(m.w) if m.get(x, y) != v6[y][x] and en_caja(CAJA_TRONCOS, x, y))
    d_fuera = sum(1 for y in range(m.h) for x in range(m.w) if m.get(x, y) != v6[y][x] and not en_caja(CAJA_TRONCOS, x, y))
    m.escribir(AQUI / "tienda_v7.txt", "V7: retoques de retoques_v7.py (ver cabecera del guion)")
    print(f"tienda: troncos {d_caja} px distintos de la V6 en la caja (remate {n_rem}); FUERA de la zona: {d_fuera}")
    assert d_fuera == 0


if __name__ == "__main__":
    casa()
    tienda()
