"""Retoques a mano (reproducibles) de la tienda de Kecleon: VERSION 3 (Flux 768, seed 2, muestreo 1:1).

Entrada: tienda_raw.txt (pixel_grid --bg-tol 30 --shadow 128,52,84 -> pixel_clean --smooth 2 -> png_to_txt),
         103x71. La IA da el diseño y la paleta: toldo a franjas verde/crema con festones, viga roja,
         postes, pared trasera oscura, mostrador de madera, cajas/letrero/saco.
Salida:  tienda.txt -> pixel_build -> assets/game/pixel/edificios/tienda.png (119x70)

Qué se regulariza (reglas de docs/art/PIPELINE.md §3b):
  - Ancho: 13 franjas de 9 px (7 verdes + 6 crema, simétrico) = 117 + 2 de contorno = 119 px (≈5 casillas).
    La IA daba 103 px con franjas de 8-9 px irregulares.
  - Festones del toldo: arcos iguales bajo cada franja (anchos 9,9,7,3), tono oscuro de cada color.
  - Viga, postes, pared trasera con juntas periódicas, tablero del mostrador y frontal de tablones: rectos.
  - Objetos: caja con etiqueta (izq.), letrero colgado (centro), cajita de manzanas y saco (der.), limpios,
    1 px de contorno.
    El resto de la mercancía ruidosa de la IA se quita (gusto del usuario: simple y limpio).
  - Nada sobresale de la huella por abajo; pies de los postes dentro del ancho.
Uso: python -I assets/gen/pixel/src/edificios/retoques_tienda.py   (desde la raíz del proyecto)
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[5] / "tools"))
from pixel_txt import Mapa  # noqa: E402

AQUI = Path(__file__).resolve().parent
m = Mapa.leer(AQUI / "tienda_raw.txt")
m.insertar_columnas(51, 16)          # 103 -> 119 columnas (el diseño se redibuja encima)
W, H = m.w, m.h                      # 119 x 71
CX = W // 2                          # 59

PAL = {
    "0": "#281c30", "1": "#2b2432", "2": "#3a2a36",                   # contornos, pared trasera
    "3": "#7a2e22", "4": "#6d3d26", "6": "#9f5831", "9": "#b06c38",   # viga roja, postes, tablones, tostado
    "b": "#c08f45", "c": "#dcbb6c", "d": "#f6f0b8",                   # mostrador / caja / etiqueta
    "5": "#5c6420", "7": "#5a8a26", "8": "#78a630", "a": "#8fb83a",   # verdes (sombra festón, oscuro, base, luz)
    "e": "#d9cc8c", "i": "#f4ecb2", "j": "#fbf6cc",                   # cremas (sombra festón, base, luz)
    "f": "#f4ecb2", "g": "#f4ecb2", "h": "#f4ecb2",
    "r": "#c9433a", "R": "#e8766a",                                   # fruta (manzanas) y su brillo
}
for ch, hx in PAL.items():
    m.color(ch, hx)

# lienzo en blanco: se redibuja todo
for y in range(H):
    for x in range(W):
        m.set(x, y, ".")

# ---------------------------------------------------------------- toldo (filas 0..25)
NF, AF = 13, 9                        # franjas y ancho de franja
m.hlinea(1, W - 2, 0, "0")            # contorno superior
for k in range(NF):
    x0 = 1 + k * AF
    verde = (k % 2 == 0)
    for y in range(1, 22):
        for x in range(x0, x0 + AF):
            if verde:
                c = "7" if x == x0 + AF - 1 else ("a" if x == x0 else "8")      # sombra a la derecha, luz a la izq.
            else:
                c = "e" if x == x0 + AF - 1 else ("j" if x == x0 else "i")
            m.set(x, y, c)
    # festón: semicírculo de 4 filas (9, 7, 5, 3) en el tono de sombra
    cs = "5" if verde else "e"
    for j, ancho in enumerate((9, 9, 7, 3)):   # arco: pasos 0,1,2 (curvatura monótona)
        off = (AF - ancho) // 2
        m.hlinea(x0 + off, x0 + off + ancho - 1, 22 + j, cs)
m.vlinea(0, 1, 21, "0")
m.vlinea(W - 1, 1, 21, "0")
m.hlinea(1, W - 2, 21, "0")           # borde inferior del toldo (línea oscura sobre la que cuelgan los festones)

# ---------------------------------------------------------------- caja del puesto (x 3..115, filas 26..68)
X0, X1 = 3, W - 4                     # 3 .. 115
m.hlinea(X0, X1, 26, "1")             # sombra del toldo
m.hlinea(X0, X1, 27, "3")             # viga roja
m.hlinea(X0, X1, 28, "3")
m.hlinea(X0, X1, 29, "2")             # sombra de la viga
# pared trasera con juntas de tablas cada 6 filas
for y in range(30, 50):
    m.hlinea(X0 + 5, X1 - 5, y, "1" if (y - 30) % 6 == 5 else "2")
m.hlinea(X0 + 5, X1 - 5, 30, "0")     # oscuridad bajo la viga
# tablero del mostrador (visto desde arriba-delante) y su frontal
m.hlinea(X0 + 5, X1 - 5, 50, "c")     # canto trasero claro
for y in range(51, 59):
    m.hlinea(X0 + 5, X1 - 5, y, "b")
m.hlinea(X0 + 5, X1 - 5, 59, "9")     # canto delantero
for y in range(60, 66):
    m.hlinea(X0 + 5, X1 - 5, y, "6" if y != 63 else "4")   # tablones del frontal con una junta
m.hlinea(X0 + 5, X1 - 5, 66, "0")     # base
# postes (contorno, 3 px de madera, contorno) de la viga al suelo, con pie
for y in range(27, 67):
    for x, c in zip(range(X0, X0 + 5), "04440"):
        m.set(x, y, c)
    for x, c in zip(range(X1 - 4, X1 + 1), "04440"):
        m.set(x, y, c)
for y in (67, 68):
    for x, c in zip(range(X0, X0 + 5), "04440" if y == 67 else ".000."):
        m.set(x, y, c)
    for x, c in zip(range(X1 - 4, X1 + 1), "04440" if y == 67 else ".000."):
        m.set(x, y, c)
m.hlinea(X0 + 1, X0 + 3, 66, "4")     # el poste tapa la base
m.hlinea(X1 - 3, X1 - 1, 66, "4")

# ---------------------------------------------------------------- objetos (izq. y centro; el saco a la derecha)
# caja con etiqueta, de pie sobre el mostrador (x 12..24, filas 43..58)
m.rect(12, 43, 24, 58, "c")
m.marco(12, 43, 24, 58, "1")
m.hlinea(13, 23, 44, "d")             # canto superior iluminado
m.hlinea(13, 23, 57, "9")             # sombra inferior
m.vlinea(23, 45, 56, "9")
m.rect(14, 47, 22, 53, "d")           # etiqueta
m.marco(14, 47, 22, 53, "9")
m.hlinea(16, 20, 49, "1")             # dos líneas de "texto"
m.hlinea(16, 20, 51, "1")
# letrero colgado en la pared (x 50..68, filas 33..42)
m.vlinea(53, 31, 32, "1")             # cuerdas
m.vlinea(65, 31, 32, "1")
m.rect(50, 33, 68, 42, "b")
m.marco(50, 33, 68, 42, "1")
m.hlinea(51, 67, 34, "c")
m.hlinea(53, 65, 37, "4")
m.hlinea(55, 63, 39, "4")
# saco (x 95..107, filas 45..58): luz arriba-izquierda, sombra abajo-derecha
SACO = [
    "....1111.....",
    "...1cbb91....",
    "..1ccbbb91...",
    ".1ccbbbbb91..",
    "1ccbbbbbbb91.",
    "1cbbbbbbbb991",
    "1cbbbbbbbb991",
    "1cbbbbbbbb991",
    "1bbbbbbbbb991",
    "1bbbbbbbb9991",
    "1bbbbbbb99991",
    ".1bbbbb99991.",
    "..111111111..",
]
for j, fila in enumerate(SACO):
    for i, c in enumerate(fila):
        if c != ".":
            m.set(95 + i, 46 + j, c)
m.hlinea(99, 102, 45, "1")            # cuello atado
m.hlinea(100, 101, 44, "4")

# cajita abierta con manzanas, sobre el mostrador (x 70..82, filas 51..58)
m.rect(70, 53, 82, 58, "6")
m.marco(70, 53, 82, 58, "1")
m.hlinea(71, 81, 54, "9")
m.hlinea(71, 81, 55, "4")             # interior en sombra
for x0 in (71, 75, 79):               # tres manzanas asomando tras el borde de la caja (3x2, sin contorno)
    m.rect(x0, 51, x0 + 2, 52, "r")
    m.set(x0, 51, "R")
    m.set(x0, 52, "R")

m.recortar()
m.escribir(AQUI / "tienda.txt", "retocado por retoques_tienda.py (ver cabecera del guion)")
print(f"tienda.txt {m.w}x{m.h}")
