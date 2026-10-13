"""Retoques a mano (reproducibles) de la casa: VERSION 3 (Flux 768, seed 2, muestreo 1:1).

Entrada: casa_raw.txt (salida de pixel_grid -> pixel_clean --smooth 2 --mirror left -> png_to_txt).
Salida:  casa.txt (fuente editable definitiva) -> pixel_build -> assets/game/pixel/edificios/casa.png

Qué se corrige y por qué (reglas de docs/art/PIPELINE.md §3b):
  - Faroles laterales y sus brazos: se quitan (detalle suelto, rompen la silueta).
  - Cumbrera y faldones: contorno redibujado con pendiente 2:1 exacta (regla 2); el interior del
    tejado se rellena con cursos periódicos de 6 filas: junta oscura, fila clara, 4 de base (regla 4).
  - Alero en V: bandas paralelas a 2:1 de ancho constante (contorno, sombra, fascia, línea oscura)
    que se juntan en el vértice; el hastial queda liso.
  - Pared: cursos de troncos periódicos (6 filas) entre los postes, respetando puerta y ventanas.
  - Ventanas: marco de 1 px, cruz de 4 cristales, alféizar; iguales por espejo (regla 3).
  - Puerta: marco recto, ventanuco de 2 cristales, pomo, panel inferior.
  - Base: borde inferior recto, escalón solo bajo la puerta.
  - Paleta: la madera pasa de rojo-rosa (derrame del fondo magenta) a marrón cálido; sombras más
    frías; sin negro puro (regla 5).
Uso: python -I assets/gen/pixel/src/edificios/retoques_casa.py   (desde la raíz del proyecto)
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[5] / "tools"))
from pixel_txt import Mapa  # noqa: E402

AQUI = Path(__file__).resolve().parent
m = Mapa.leer(AQUI / "casa_raw.txt")
W, H = m.w, m.h          # 107 x 118
CX = W // 2              # 53, columna del eje

# ---------------------------------------------------------------- paleta final (mismos caracteres)
PAL = {
    "0": "#2a1c30", "1": "#2d1f34", "2": "#2a1c30", "3": "#3a2a44",   # contornos / sombras (morado oscuro)
    "4": "#5a3420", "6": "#6e4228", "8": "#7f5230", "a": "#9c6a3e", "g": "#b98650",  # madera de la pared
    "e": "#a3663c", "i": "#c98a55", "j": "#e8d2a6",                  # hastial / fascia y postes / marcos claros
    "5": "#6d1838", "7": "#8a1a3c", "9": "#b2233e", "c": "#c0263c", "h": "#d63a4c",  # tejado
    "b": "#c0263c", "d": "#c0263c", "f": "#c0263c",                  # (se funden en c)
}
for ch, hx in PAL.items():
    m.color(ch, hx)

ROOF = set("579bcdfh")
TEJA = ["h", "c", "c", "c", "c", "7"]   # curso de 6 filas: clara, base x4, junta

# ---------------------------------------------------------------- 1. quitar faroles (fuera del tejado)
for y in range(12, 36):
    for x in range(0, 19):
        m.set(x, y, ".")

# ---------------------------------------------------------------- 2. tejado: faldón izquierdo + interior
Y_RIDGE = 3            # fila de la cumbrera (interior 51..55)
X_EDGE = 1             # borde vertical izquierdo del tejado (contorno)
Y_V = 41               # vértice de la V del alero
Y_EAVE_END = 76        # última fila del alero en los laterales

# limpiar todo lo que haya por encima/izquierda del faldón y preparar el interior
for y in range(0, Y_EAVE_END + 1):
    # x del contorno del faldón izquierdo en esta fila (tramo de 2 px: xs, xs+1)
    xs = 49 - 2 * (y - Y_RIDGE)
    for x in range(0, CX + 1):
        if y < 2:
            m.set(x, y, ".")
            continue
        if y == 2:
            m.set(x, y, "2" if 51 <= x <= 55 else ".")
            continue
        if xs > X_EDGE:                        # zona del faldón inclinado (tramos de 2 px)
            if x < xs:
                m.set(x, y, ".")
            elif x <= xs + 1:
                m.set(x, y, "2")
            else:
                m.set(x, y, TEJA[(y - Y_RIDGE) % 6])
        elif xs == X_EDGE:                     # esquina: la diagonal acaba en un tramo de 1 px
            if x <= xs:
                m.set(x, y, ".")
            elif x == xs + 1:
                m.set(x, y, "2")
            else:
                m.set(x, y, TEJA[(y - Y_RIDGE) % 6])
        else:                                  # borde vertical
            if x < X_EDGE:
                m.set(x, y, ".")
            elif x == X_EDGE:
                m.set(x, y, "2")
            else:
                m.set(x, y, TEJA[(y - Y_RIDGE) % 6])
# línea de luz de 2 px pegada al faldón izquierdo (contorno selectivo: la luz viene de arriba-izq.)
for y in range(Y_RIDGE + 1, Y_RIDGE + 24):
    xs = 49 - 2 * (y - Y_RIDGE)
    for x in (xs + 2, xs + 3):
        if X_EDGE < x <= CX:
            m.set(x, y, "h")

POSTE = "01441eeiiee1"  # columnas x 7..18 del poste de la esquina (contorno, sombra, luz, contorno)

# ---------------------------------------------------------------- 3. alero en V (brazo izquierdo)
# bandas a 2:1 medidas desde el eje: tejado | contorno 2 | sombra 6 | fascia 10 | línea 2 | hastial
for y in range(Y_V, Y_EAVE_END + 1):
    u = 2 * (y - Y_V)
    for x in range(X_EDGE + 1, CX + 1):
        d = x - (52 - u)          # 0,1 = contorno
        if d < 0:
            c = TEJA[(y - Y_RIDGE) % 6]
        elif d <= 1:
            c = "2"
        elif d <= 7:
            c = "3"
        elif d <= 17:
            c = "i"
        elif d <= 19:
            c = "2"
        else:
            c = "e"
        if y <= 67:
            m.set(x, y, c)
        elif c != "e":            # en la zona de la pared las bandas pasan por delante de los postes
            m.set(x, y, c)
        elif x <= 18:             # y donde ya no hay alero, poste (x 7..18) o nada (voladizo)
            m.set(x, y, POSTE[x - 7] if x >= 7 else ".")
# borde vertical izquierdo: solo donde hay alero al lado (sin línea colgando)
for y in range(Y_V, Y_EAVE_END + 1):
    u = 2 * (y - Y_V)
    if 52 - u < X_EDGE + 1:
        m.set(X_EDGE, y, "2" if m.get(X_EDGE + 1, y) not in ".e01" else ".")
# esquina inferior: la vertical acaba una fila antes de que la diagonal del alero llegue al borde
# (último tramo de 1 px, sin esquina en L)
for y in range(Y_EAVE_END, Y_V, -1):
    if m.get(X_EDGE, y) == "2":
        if m.get(X_EDGE + 1, y) == "2":
            m.set(X_EDGE, y, ".")
        break
# por debajo del alero, a la izquierda del poste, nada
for y in range(Y_EAVE_END + 1, H):
    for x in range(0, 7):
        m.set(x, y, ".")

# ---------------------------------------------------------------- 4. pared: cursos de troncos
TRONCO = ["4", "g", "a", "a", "a", "8"]        # junta, luz, base x3, sombra
WALL = set("468ag")
Y_WALL0, Y_WALL1 = 68, 109
for y in range(Y_WALL0, Y_WALL1 + 1):
    for x in range(19, CX + 1):          # toda la pared; ventana y puerta se dibujan encima después
        m.set(x, y, TRONCO[(y - Y_WALL0) % 6])
# viga horizontal bajo el alero (fila 68) y borde inferior recto
m.hlinea(19, CX, 68, "4")
m.hlinea(18, CX, 110, "1")
for y in range(111, H):
    for x in range(18, 44):
        m.set(x, y, ".")

# postes (x 7..17): columnas limpias de 77 a 116 y pie recto
for y in range(77, 117):
    for x, c in zip(range(7, 19), POSTE):
        m.set(x, y, c)
m.hlinea(7, 17, 116, "1")
m.hlinea(8, 17, 117, ".") if H > 117 else None

# ---------------------------------------------------------------- 5. ventana izquierda (x 22..37, y 83..95)
WX0, WY0, WX1, WY1 = 22, 83, 37, 95
m.rect(WX0, WY0, WX1, WY1, "3")                # cristal (sombra fría)
m.marco(WX0, WY0, WX1, WY1, "j")               # marco claro
m.vlinea((WX0 + WX1) // 2, WY0, WY1, "j")      # cruz
m.hlinea(WX0, WX1, (WY0 + WY1) // 2, "j")
m.hlinea(WX0 - 1, WX1 + 1, WY1 + 1, "j")       # alféizar
m.hlinea(WX0 - 1, WX1 + 1, WY1 + 2, "1")       # sombra del alféizar
m.marco(WX0 - 1, WY0 - 1, WX1 + 1, WY1 + 1, "1")  # contorno oscuro exterior
m.hlinea(WX0 - 1, WX1 + 1, WY1 + 1, "j")
m.set(WX0 - 1, WY1 + 1, "1"); m.set(WX1 + 1, WY1 + 1, "1")
# brillo en el cristal superior izquierdo
m.set(WX0 + 1, WY0 + 1, "i"); m.set(WX0 + 2, WY0 + 1, "i")

# ---------------------------------------------------------------- 6. puerta (jambas 38..41 | marco 42,43 | hoja 44..60)
DY0, DY1 = 81, 109
m.rect(38, DY0, 41, DY1, "a")                   # jamba izquierda (madera)
m.vlinea(38, DY0, DY1, "g")                     # luz en la jamba
m.vlinea(42, DY0, DY1, "0")                     # contorno oscuro
m.vlinea(43, DY0 + 1, DY1, "1")
m.hlinea(38, CX, DY0, "0")                      # dintel oscuro
m.hlinea(38, CX, DY0 - 1, "g")                  # luz del dintel
m.rect(44, DY0 + 1, CX, DY1, "i")               # hoja
m.vlinea(44, DY0 + 1, DY1, "e")                 # sombra de la hoja junto al marco
# ventanuco de la puerta (x 47..52 mitad izq.; se completa por espejo), y 85..90
m.rect(47, 85, CX, 90, "3")
m.marco(47, 85, CX, 90, "6")
m.set(48, 86, "i"); m.set(49, 86, "i")
# panel inferior
m.marco(47, 96, CX, 106, "6")
m.rect(48, 97, CX, 105, "e")
# pomo (lado derecho de la hoja: se pondrá tras el espejo, ver abajo)
# umbral y escalón
m.hlinea(44, CX, DY1, "6")
m.hlinea(42, CX, 110, "1")
m.hlinea(42, CX, 111, "a")
m.hlinea(42, CX, 112, "8")
m.hlinea(42, CX, 113, "1")
for y in range(114, H):
    for x in range(18, CX + 1):
        m.set(x, y, ".")

# ---------------------------------------------------------------- 7. espejo y detalles asimétricos
m.espejo("izq")
m.set(58, 97, "0"); m.set(58, 98, "0")           # pomo (solo a la derecha)
m.set(59, 97, "j"); m.set(59, 98, "j")

m.recortar()
m.escribir(AQUI / "casa.txt", "retocado por retoques_casa.py (ver cabecera del guion)")
print(f"casa.txt {m.w}x{m.h}")
