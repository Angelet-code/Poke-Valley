"""Dibuja los edificios (casa y tienda de Kecleon) en pixel art a escala nativa del juego.

Uso:
  python -I tools/draw_edificios.py --out assets/game/pixel/edificios [--zoom 6]
      [--init-dir assets/gen/edificios/init --init-scale 8]

Escala: 1 px de imagen = 1 px de mundo (casilla 24×24). Cada edificio mide 120 px de ancho
(5 casillas) y unos 112-120 px de alto, con la huella (colisión) de 5×3 casillas abajo y la
puerta/mostrador centrados en el borde inferior. Vista 3/4 desde arriba: tejado o toldo
visto desde arriba-delante y pared frontal debajo.

Estilo: cel plano con 3-4 tonos por material, luz desde arriba-izquierda, contorno de 1 px
oscuro pero tintado (no negro), sin tramado. Los colores están en la paleta de abajo.

Salidas:
  <out>/casa.png, <out>/tienda.png  (RGBA, tamaño exacto, fila inferior = suelo)
  <out>_x<zoom>/... previsualización ×zoom (vecino más cercano), en assets/gen si out está
  en assets/game.
  --init-dir: además guarda cada edificio ampliado ×init-scale y desenfocado sobre fondo
  magenta, para usarlo como --init de tools/comfy.py (img2img).

Nota: este dibujo es el plan B acordado si SDXL no da un pixel art limpio a 120 px
(ver docs/art/PIPELINE.md, sección edificios).
"""
import argparse
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

# ---- paleta (R, G, B) ------------------------------------------------------------
TEJA_L, TEJA_M, TEJA_D, TEJA_X = (226, 128, 92), (198, 96, 68), (160, 68, 54), (112, 46, 42)
MAD_L, MAD_M, MAD_D, MAD_X = (226, 188, 132), (206, 162, 106), (172, 128, 80), (132, 92, 58)
PUERTA_M, PUERTA_D = (126, 80, 50), (98, 60, 38)
CREMA, CREMA_D = (242, 228, 192), (214, 196, 156)
VIDRIO_L, VIDRIO_M, VIDRIO_D = (196, 230, 240), (128, 188, 214), (92, 148, 180)
PIEDRA_L, PIEDRA_M, PIEDRA_D = (190, 182, 170), (156, 148, 138), (118, 110, 102)
VERDE_L, VERDE_M, VERDE_D = (132, 196, 104), (96, 164, 80), (66, 124, 60)
ROJO_L, ROJO_M, ROJO_D = (226, 92, 84), (198, 60, 60), (150, 40, 46)
AMAR_L, AMAR_M = (246, 214, 110), (222, 178, 70)
AZUL_M, AZUL_D = (96, 132, 200), (62, 92, 160)
CONTORNO_CASA = (66, 42, 40)
CONTORNO_TIENDA = (54, 46, 44)


class Lienzo:
    """Lienzo RGBA con primitivas a nivel de píxel (x1, y1 exclusivos)."""

    def __init__(self, w, h):
        self.a = np.zeros((h, w, 4), np.uint8)

    def rect(self, x0, y0, x1, y1, c):
        self.a[max(y0, 0):y1, max(x0, 0):x1] = (*c, 255)

    def hline(self, x0, x1, y, c):
        self.rect(x0, y, x1, y + 1, c)

    def vline(self, x, y0, y1, c):
        self.rect(x, y0, x + 1, y1, c)

    def px(self, x, y, c):
        if 0 <= y < self.a.shape[0] and 0 <= x < self.a.shape[1]:
            self.a[y, x] = (*c, 255)

    def trapecio(self, y0, y1, x0_top, x1_top, x0_bot, x1_bot, c):
        """Trapecio relleno fila a fila (bordes interpolados y redondeados)."""
        n = max(y1 - y0 - 1, 1)
        for i, y in enumerate(range(y0, y1)):
            t = i / n
            xa = round(x0_top + (x0_bot - x0_top) * t)
            xb = round(x1_top + (x1_bot - x1_top) * t)
            self.hline(xa, xb, y, c)

    def mask(self):
        return self.a[..., 3] > 0

    def contorno(self, color, fuerza=0.65):
        """Oscurece 1 px del borde de la silueta mezclando con `color` (no negro)."""
        m = self.mask()
        p = np.pad(m, 1)
        n4 = p[:-2, 1:-1].astype(int) + p[2:, 1:-1] + p[1:-1, :-2] + p[1:-1, 2:]
        borde = m & (n4 < 4)
        rgb = self.a[..., :3].astype(np.float32)
        mez = rgb * (1 - fuerza) + np.array(color, np.float32) * fuerza
        self.a[..., :3][borde] = np.clip(mez[borde], 0, 255).astype(np.uint8)

    def imagen(self):
        return Image.fromarray(self.a, "RGBA")


def ventana(L, x, y, w=18, h=16):
    """Ventana con marco de madera, marco interior crema, cristal y cruceta."""
    L.rect(x, y, x + w, y + h, MAD_X)
    L.rect(x + 1, y + 1, x + w - 1, y + h - 1, CREMA)
    L.rect(x + 2, y + 2, x + w - 2, y + h - 2, VIDRIO_M)
    L.rect(x + 2, y + h - 5, x + w - 2, y + h - 2, VIDRIO_D)
    L.rect(x + 3, y + 3, x + 6, y + 5, VIDRIO_L)
    cx, cy = x + w // 2, y + h // 2
    L.vline(cx, y + 2, y + h - 2, CREMA)
    L.hline(x + 2, x + w - 2, cy, CREMA)
    L.hline(x - 1, x + w + 1, y + h, CREMA_D)  # alféizar
    L.hline(x - 1, x + w + 1, y + h + 1, MAD_X)


def casa():
    W, H = 120, 120
    L = Lienzo(W, H)
    # --- pared (se dibuja antes que el tejado para que el alero la tape) ---
    L.rect(6, 60, 114, 117, MAD_M)
    for y in range(72, 117, 6):  # tablones
        L.hline(6, 114, y, MAD_D)
    L.rect(6, 60, 114, 67, MAD_D)  # sombra bajo el alero
    L.rect(6, 60, 114, 65, MAD_X)
    L.vline(6, 60, 117, MAD_X)
    L.vline(113, 60, 117, MAD_X)
    L.rect(7, 67, 9, 117, MAD_L)  # canto iluminado a la izquierda
    # --- puerta ---
    L.rect(51, 86, 69, 117, MAD_X)
    L.rect(52, 87, 68, 117, PUERTA_M)
    L.vline(57, 88, 117, PUERTA_D)
    L.vline(62, 88, 117, PUERTA_D)
    L.hline(52, 68, 87, (146, 98, 62))
    L.rect(63, 102, 65, 104, AMAR_L)  # pomo
    # --- ventanas ---
    ventana(L, 16, 76)
    ventana(L, 86, 76)
    # --- escalón ---
    L.rect(47, 117, 73, 120, PIEDRA_M)
    L.hline(47, 73, 117, PIEDRA_L)
    L.hline(47, 73, 119, PIEDRA_D)
    # --- tejado (cadera visto desde arriba-delante) ---
    L.trapecio(2, 56, 30, 90, 0, 120, TEJA_M)
    for y in range(2, 14):  # parte alta iluminada (solo dentro del tejado)
        xs = np.nonzero(L.a[y, :, 3] > 0)[0]
        L.hline(xs[0], xs[-1] - 1, y, TEJA_L)
    for y in range(8, 56, 6):  # hileras de tejas
        row = L.a[y, :, 3] > 0
        xs = np.nonzero(row)[0]
        if len(xs):
            L.hline(xs[0] + 1, xs[-1], y, TEJA_D)
            off = 3 if (y // 6) % 2 else 0  # juntas verticales alternadas
            for x in range(xs[0] + 4 + off, xs[-1] - 2, 8):
                L.px(x, y + 1, TEJA_D)
                L.px(x, y + 2, TEJA_D)
    L.hline(30, 90, 2, TEJA_L)  # cumbrera
    L.hline(30, 90, 3, TEJA_L)
    # lado derecho en sombra
    L.trapecio(4, 56, 88, 90, 116, 120, TEJA_D)
    # alero: canto claro y sombra
    L.hline(0, 120, 56, TEJA_L)
    L.rect(0, 57, 120, 60, TEJA_X)
    L.hline(0, 120, 60, TEJA_D)
    # --- chimenea ---
    L.rect(84, 6, 96, 24, PIEDRA_M)
    L.rect(84, 6, 87, 24, PIEDRA_L)
    L.rect(93, 6, 96, 24, PIEDRA_D)
    L.rect(82, 4, 98, 8, PIEDRA_L)
    L.hline(82, 98, 7, PIEDRA_D)
    L.rect(84, 2, 96, 4, PIEDRA_D)
    L.contorno(CONTORNO_CASA)
    return L.imagen()


def caja(L, x, y, w=16, h=14):
    """Caja de madera con listones en X."""
    L.rect(x, y, x + w, y + h, MAD_X)
    L.rect(x + 1, y + 1, x + w - 1, y + h - 1, MAD_M)
    L.rect(x + 1, y + 1, x + w - 1, y + 3, MAD_L)
    L.hline(x + 1, x + w - 1, y + h - 2, MAD_D)
    n = min(w, h) - 4
    for i in range(n):
        L.px(x + 2 + i, y + 2 + i, MAD_D)
        L.px(x + w - 3 - i, y + 2 + i, MAD_D)


def producto(L, x, y, c_l, c_m, w=7, h=7):
    """Un artículo en la estantería: bloque redondeado con brillo."""
    L.rect(x + 1, y, x + w - 1, y + h, c_m)
    L.rect(x, y + 1, x + w, y + h - 1, c_m)
    L.rect(x + 1, y + 1, x + 3, y + 3, c_l)


def tienda():
    W, H = 120, 112
    L = Lienzo(W, H)
    # --- postes ---
    for x in (4, 112):
        L.rect(x, 40, x + 5, 108, MAD_M)
        L.vline(x, 40, 108, MAD_L)
        L.vline(x + 4, 40, 108, MAD_X)
    # --- pared trasera (interior en sombra) ---
    L.rect(9, 42, 112, 86, MAD_D)
    for y in range(50, 86, 6):
        L.hline(9, 112, y, MAD_X)
    L.rect(9, 42, 112, 48, MAD_X)  # sombra bajo el toldo
    # estantería con artículos
    L.rect(14, 66, 107, 69, MAD_M)
    L.hline(14, 107, 66, MAD_L)
    L.hline(14, 107, 69, MAD_X)
    producto(L, 22, 58, ROJO_L, ROJO_M)
    producto(L, 36, 58, AMAR_L, AMAR_M)
    producto(L, 50, 58, (150, 170, 230), AZUL_M)
    producto(L, 64, 58, VERDE_L, VERDE_M)
    producto(L, 78, 58, ROJO_L, ROJO_M)
    producto(L, 92, 58, AMAR_L, AMAR_M)
    # --- mostrador ---
    L.rect(9, 82, 112, 108, MAD_M)
    L.rect(9, 82, 112, 87, MAD_L)  # tablero superior
    L.hline(9, 112, 87, MAD_X)
    for y in range(93, 108, 6):
        L.hline(9, 112, y, MAD_D)
    L.vline(9, 82, 108, MAD_X)
    L.vline(111, 82, 108, MAD_X)
    L.rect(9, 108, 112, 112, MAD_X)  # zócalo
    # vallado del mostrador: tablas verticales tenues
    for x in range(21, 110, 12):
        L.vline(x, 88, 108, MAD_D)
    # --- cajas delante ---
    caja(L, 96, 96, 18, 16)
    caja(L, 6, 98, 16, 14)
    # --- toldo (trapecio) con rayas verdes/crema ---
    y0, y1 = 6, 40
    for i, y in enumerate(range(y0, y1)):
        t = i / (y1 - y0 - 1)
        xa = round(22 + (0 - 22) * t)
        xb = round(98 + (120 - 98) * t)
        for x in range(xa, xb):
            banda = ((x - xa) * 9 // max(xb - xa, 1)) % 2  # 9 rayas que siguen la perspectiva
            c = VERDE_M if banda == 0 else CREMA
            if y < y0 + 6:  # parte alta iluminada
                c = VERDE_L if banda == 0 else (250, 240, 210)
            if y >= y1 - 6:  # borde bajo en sombra
                c = VERDE_D if banda == 0 else CREMA_D
            L.px(x, y, c)
    L.hline(22, 98, 6, VERDE_L)
    # cenefa roja con zigzag (como el vientre de Kecleon)
    L.rect(0, 38, 120, 42, ROJO_M)
    L.hline(0, 120, 38, ROJO_L)
    for y, half in zip(range(42, 46), (3, 2, 1, 0)):
        for x in range(120):
            if abs((x % 8) - 3.5) <= half + 0.5:
                L.px(x, y, ROJO_M if y < 45 else ROJO_D)
    L.hline(0, 120, 41, ROJO_D)
    # --- rótulo sin texto: un tablón con rombo amarillo (color de Kecleon) ---
    L.rect(48, 0, 72, 10, MAD_X)
    L.rect(49, 1, 71, 9, MAD_M)
    L.hline(49, 71, 1, MAD_L)
    for i, w in enumerate((1, 3, 5, 3, 1)):
        L.hline(60 - w // 2, 60 + w // 2 + 1, 2 + i + 1, AMAR_L)
    L.contorno(CONTORNO_TIENDA)
    return L.imagen()


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--out", default="assets/game/pixel/edificios")
    p.add_argument("--zoom", type=int, default=6)
    p.add_argument("--init-dir")
    p.add_argument("--init-scale", type=int, default=8)
    a = p.parse_args()
    out = Path(a.out)
    out.mkdir(parents=True, exist_ok=True)
    prev_dir = out
    if "assets/game" in out.as_posix():
        prev_dir = Path("assets/gen") / out.relative_to(Path("assets/game"))
    prev_dir.mkdir(parents=True, exist_ok=True)
    for nombre, fn in (("casa", casa), ("tienda", tienda)):
        im = fn()
        im.save(out / f"{nombre}.png")
        im.resize((im.width * a.zoom, im.height * a.zoom), Image.Resampling.NEAREST).save(prev_dir / f"{nombre}_x{a.zoom}.png")
        print(out / f"{nombre}.png", im.size)
        if a.init_dir:
            d = Path(a.init_dir)
            d.mkdir(parents=True, exist_ok=True)
            s = a.init_scale
            fondo = Image.new("RGBA", (1024, 1024), (255, 0, 255, 255))
            big = im.resize((im.width * s, im.height * s), Image.Resampling.NEAREST)
            fondo.alpha_composite(big, ((1024 - big.width) // 2, (1024 - big.height) // 2))
            fondo.convert("RGB").filter(ImageFilter.GaussianBlur(2)).save(d / f"{nombre}_init.png")


if __name__ == "__main__":
    main()
