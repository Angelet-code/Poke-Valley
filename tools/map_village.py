"""Genera mapas de aldea para la maqueta (docs/art/mapas/aldea_<letra>.json).

Uso: python -I tools/map_village.py [--solo a|b|c]

Cada mapa lleva:
- `vert`: terreno en las esquinas de las casillas (0 césped, 1 tierra, 2 losas, 3 agua),
  como el resto de mapas de la maqueta.
- `objetos`: edificios, mesa de trabajo y recolectables (anclas en px de mundo).
- `arboles` y `rocas`: posiciones en px de mundo (la maqueta las usa en vez de las fijas).

Tres variantes (todas 40x30 casillas, semilla fija para que salgan siempre igual):
  a "pradera":   casa arriba a la izquierda, tienda a la derecha, lago abajo a la izquierda.
  b "lago":      lago en el centro, casa arriba, tienda abajo, camino rodeando el lago.
  c "orilla":    agua por todo el lado derecho, aldea a la izquierda, bosque arriba.
Las reglas: nada sobre agua, edificios y mesa sobre césped/tierra (nunca sobre losas), árboles
en anillo por el borde y en corros, recolectables cerca de lo suyo (palos/troncos junto a
árboles, piedras junto a rocas, Poké Balls cerca de la tienda) y el centro del mapa libre
(ahí aparece Bulbasaur).
"""
import argparse
import json
import math
import random
from pathlib import Path

T = 24
MW, MH = 40, 30
OUT = Path(__file__).resolve().parent.parent / "docs" / "art" / "mapas"

# Huellas (ancho, alto) en px de mundo, centradas en el ancla y hacia arriba (como en los catálogos).
FOOT = {"casa": (144, 72), "tienda": (144, 72), "mesa_trabajo": (48, 20)}  # casa/tienda V4: 154 px de ancho, huella 6x3
ITEM_TILES = {"palo": 1, "palo_1": 1, "tronco": 1, "piedra": 1, "piedra_1": 1,
              "pokeball": 1, "superball": 1, "ultraball": 1, "masterball": 1, "honorball": 1}


class Mapa:
    def __init__(self, seed):
        self.rng = random.Random(seed)
        self.vert = [[0] * (MW + 1) for _ in range(MH + 1)]
        self.objetos, self.arboles, self.rocas = [], [], []
        self.inicio = None  # [x, y] px de mundo donde aparece Bulbasaur
        self.ocupado = []  # rectángulos (x0, y0, x1, y1) en px de mundo que nada más puede pisar

    # --- terreno -------------------------------------------------------------
    def rect(self, x0, y0, x1, y1, v):
        for y in range(max(0, y0), min(MH, y1) + 1):
            for x in range(max(0, x0), min(MW, x1) + 1):
                self.vert[y][x] = v

    def blob(self, cx, cy, rx, ry, v, wobble=.18):
        """Elipse con el borde ondulado (ruido por ángulo) para que no parezca un dibujo de código."""
        ph = [self.rng.uniform(0, math.tau) for _ in range(3)]
        for y in range(MH + 1):
            for x in range(MW + 1):
                dx, dy = (x - cx) / rx, (y - cy) / ry
                a = math.atan2(dy, dx)
                r = 1 + wobble * (math.sin(3 * a + ph[0]) * .6 + math.sin(5 * a + ph[1]) * .3 + math.sin(2 * a + ph[2]) * .4)
                if dx * dx + dy * dy <= r * r:
                    self.vert[y][x] = v

    def camino(self, puntos, ancho=None, losas=True):
        """Camino por una polilínea: losas (2) con un filo de tierra (1) alrededor, o solo tierra (sendero estrecho)."""
        if ancho is None:
            ancho = 0  # 1 vértice de losas (como la referencia) con filo de tierra; senderos de tierra igual de finos
        celdas = set()
        for (ax, ay), (bx, by) in zip(puntos, puntos[1:]):
            n = int(max(abs(bx - ax), abs(by - ay)) * 2) + 1
            for i in range(n + 1):
                t = i / n
                x, y = ax + (bx - ax) * t, ay + (by - ay) * t
                for dy in range(-ancho, ancho + 1):
                    for dx in range(-ancho, ancho + 1):
                        if dx * dx + dy * dy <= ancho * ancho + .5:
                            celdas.add((round(x + dx), round(y + dy)))
        for x, y in (celdas if losas else ()):  # el filo de tierra solo en los caminos de losas
            for dy in (-1, 0, 1):
                for dx in (-1, 0, 1):
                    if 0 <= x + dx <= MW and 0 <= y + dy <= MH and self.vert[y + dy][x + dx] == 0:
                        self.vert[y + dy][x + dx] = 1
        for x, y in celdas:
            if 0 <= x <= MW and 0 <= y <= MH and self.vert[y][x] != 3:
                self.vert[y][x] = 2 if losas else 1

    def mancha_tierra(self, cx, cy, rx, ry):
        self.blob(cx, cy, rx, ry, 1, wobble=.3)

    # --- consultas -----------------------------------------------------------
    def terreno(self, px, py):
        """Terreno 'dominante' bajo un punto en px de mundo (la esquina más cercana)."""
        x, y = min(MW, max(0, round(px / T))), min(MH, max(0, round(py / T)))
        return self.vert[y][x]

    def zona(self, x0, y0, x1, y1):
        """Conjunto de terrenos en un rectángulo de px de mundo."""
        vs = set()
        for y in range(max(0, int(y0 // T)), min(MH, int(math.ceil(y1 / T))) + 1):
            for x in range(max(0, int(x0 // T)), min(MW, int(math.ceil(x1 / T))) + 1):
                vs.add(self.vert[y][x])
        return vs

    def libre(self, x0, y0, x1, y1, margen=0):
        return not any(x0 - margen < bx1 and x1 + margen > bx0 and y0 - margen < by1 and y1 + margen > by0
                       for bx0, by0, bx1, by1 in self.ocupado)

    def centro_libre(self, x0, y0, x1, y1):
        cx, cy = MW * T / 2, MH * T / 2
        return not (x0 - 30 < cx < x1 + 30 and y0 - 30 < cy < y1 + 30)

    # --- colocación ----------------------------------------------------------
    def edificio(self, id, tx, ty):
        """Ancla en la casilla (tx, ty): x al borde de casilla, y al borde inferior de la casilla."""
        w, h = FOOT[id]
        x, y = tx * T, ty * T
        box = (x - w / 2, y - h - 48, x + w / 2, y + 4)  # +48 arriba: el tejado también tapa
        assert self.zona(x - w / 2, y - h, x + w / 2, y) <= {0, 1}, f"{id} sobre agua/losas"
        assert self.libre(*box), f"{id} choca"
        self.objetos.append({"id": id, "x": x, "y": y})
        self.ocupado.append(box)
        return x, y

    def item(self, id, tx, ty):
        x, y = tx * T + T // 2, ty * T + T - 2
        box = (x - 8, y - 16, x + 8, y + 2)
        if self.terreno(x, y) == 3 or not self.libre(*box, margen=4):
            return False
        self.objetos.append({"id": id, "x": x, "y": y})
        self.ocupado.append(box)
        return True

    def arbol(self, px, py, k=None, h=None):
        r = 14
        box = (px - r, py - 10, px + r, py + 6)
        if self.terreno(px, py) == 3 or self.terreno(px, py) == 2 or not self.libre(*box, margen=6) or not self.centro_libre(*box):
            return False
        a = {"x": int(px), "y": int(py), "k": self.rng.randrange(4) if k is None else k}
        if h:
            a["h"] = h
        self.arboles.append(a)
        self.ocupado.append(box)
        return True

    def roca(self, px, py, s=None):
        box = (px - 12, py - 14, px + 12, py + 4)
        if self.terreno(px, py) in (2, 3) or not self.libre(*box, margen=6) or not self.centro_libre(*box):
            return False
        self.rocas.append({"x": int(px), "y": int(py), "k": self.rng.randrange(4), "s": s or round(self.rng.choice([.5, .6, .7, .8, .9, 1]), 1)})
        self.ocupado.append(box)
        return True

    # --- rellenos aleatorios -------------------------------------------------
    def anillo_arboles(self, cada=2.2, borde=1.2, huecos=()):
        """Árboles por todo el borde del mapa, con jaleo; `huecos` = lista de (x0, x1, lado) en casillas sin árboles."""
        per = 2 * (MW + MH)
        n = int(per / cada)
        for i in range(n):
            d = i * cada
            if d < MW:
                tx, ty, lado = d, borde, "n"
            elif d < MW + MH:
                tx, ty, lado = MW - borde, d - MW, "e"
            elif d < 2 * MW + MH:
                tx, ty, lado = MW - (d - MW - MH), MH - borde, "s"
            else:
                tx, ty, lado = borde, MH - (d - 2 * MW - MH), "w"
            if any(l == lado and a <= (tx if lado in "ns" else ty) <= b for a, b, l in huecos):
                continue
            px = (tx + self.rng.uniform(-.6, .6)) * T
            py = (ty + self.rng.uniform(-.6, .6)) * T
            self.arbol(min(MW * T - 6, max(6, px)), min(MH * T - 2, max(30, py)))

    def corro(self, cx, cy, r, n):
        for _ in range(n * 3):
            if n <= 0:
                break
            a, d = self.rng.uniform(0, math.tau), self.rng.uniform(0, r)
            if self.arbol((cx + math.cos(a) * d) * T, (cy + math.sin(a) * d * .7) * T):
                n -= 1

    def esparcir(self, fn, n, intentos=400, zona=None):
        x0, y0, x1, y1 = zona or (1, 1, MW - 1, MH - 1)
        for _ in range(intentos):
            if n <= 0:
                return
            if fn(self.rng.uniform(x0, x1), self.rng.uniform(y0, y1)):
                n -= 1

    def items_cerca(self, ids, puntos, n, radio=3):
        """Recolectables en casillas al azar alrededor de unos puntos (en casillas)."""
        for _ in range(n * 8):
            if n <= 0:
                return
            px, py = self.rng.choice(puntos)
            tx = int(px + self.rng.uniform(-radio, radio))
            ty = int(py + self.rng.uniform(-radio, radio))
            if 1 <= tx < MW - 1 and 1 <= ty < MH - 1 and self.terreno(tx * T + T // 2, ty * T + T // 2) == 0:
                if self.item(self.rng.choice(ids), tx, ty):
                    n -= 1

    def json(self):
        d = {"mw": MW, "mh": MH, "vert": self.vert, "objetos": self.objetos, "arboles": self.arboles, "rocas": self.rocas}
        if self.inicio:
            d["inicio"] = self.inicio
        return d


# ----------------------------------------------------------------------------- variantes
def pradera():
    m = Mapa(11)
    m.blob(7, 24, 6.5, 4.5, 3)                       # lago abajo a la izquierda
    m.mancha_tierra(12, 7, 4, 2.5)
    m.mancha_tierra(31, 20, 3.5, 2.5)
    casa = m.edificio("casa", 11, 10)                # ancla casilla (11,10): huella 6-16 x 7-10
    tienda = m.edificio("tienda", 30, 13)
    mesa = m.edificio("mesa_trabajo", 16, 12)
    m.camino([(11, 10.5), (11, 14), (20, 15), (30, 14)])    # casa -> tienda
    m.inicio = [11 * T, 13 * T]                      # delante de la casa
    m.camino([(20, 15), (20, 22), (14, 26)], losas=False)   # tienda/casa -> lago (tierra)
    m.camino([(30, 14), (30, 26)], losas=False)
    m.anillo_arboles(huecos=[(10, 14, "s")])
    m.corro(33, 5, 4, 7)
    m.corro(5, 15, 2.5, 4)
    m.corro(22, 26, 3, 5)
    m.esparcir(lambda x, y: m.roca(x * T, y * T), 7)
    m.items_cerca(["palo", "palo_1", "tronco"], [(33, 6), (5, 15), (22, 26)], 7)
    m.items_cerca(["piedra", "piedra_1"], [(r["x"] / T, r["y"] / T) for r in m.rocas], 4, radio=2)
    m.items_cerca(["pokeball", "superball", "ultraball", "honorball", "masterball"], [(27, 16), (33, 16)], 5, radio=2)
    return m


def lago():
    m = Mapa(23)
    m.blob(20, 15, 7, 4.5, 3)                        # lago en el centro
    m.mancha_tierra(20, 5, 5, 2)
    m.mancha_tierra(33, 24, 3, 2)
    m.edificio("casa", 13, 7)
    m.edificio("tienda", 29, 25)
    m.edificio("mesa_trabajo", 7, 10)
    m.camino([(13, 7.5), (13, 10), (10, 15), (12, 21), (20, 24), (29, 24.5)])  # rodea el lago por la izquierda
    m.inicio = [13 * T, 10 * T]
    m.camino([(13, 10), (22, 9), (31, 12), (32, 20), (29, 24.5)], losas=False)  # por la derecha, de tierra
    m.anillo_arboles(cada=2, huecos=[(26, 32, "s")])
    m.corro(6, 22, 3, 6)
    m.corro(34, 6, 3.5, 6)
    m.esparcir(lambda x, y: m.roca(x * T, y * T), 8)
    m.items_cerca(["palo", "palo_1", "tronco"], [(6, 22), (34, 6), (20, 3)], 7)
    m.items_cerca(["piedra", "piedra_1"], [(r["x"] / T, r["y"] / T) for r in m.rocas], 4, radio=2)
    m.items_cerca(["pokeball", "superball", "ultraball", "honorball", "masterball"], [(26, 27), (32, 27)], 5, radio=2)
    return m


def orilla():
    m = Mapa(37)
    m.rect(33, 0, MW, MH, 3)                         # agua por la derecha
    for y in range(MH + 1):                          # orilla ondulada
        m.rng.seed(y * 7 + 1)
        for x in range(31, 34):
            if x >= 33 - round(1.2 * math.sin(y * .55) + .6 * math.sin(y * 1.3)):
                m.vert[y][x] = 3
    m.rng.seed(37)
    m.blob(8, 26, 3.5, 2.5, 3)                       # charca pequeña
    m.mancha_tierra(10, 9, 4, 2.5)
    m.mancha_tierra(24, 19, 4, 2.5)
    m.edificio("casa", 9, 12)
    m.edificio("tienda", 24, 9)
    m.edificio("mesa_trabajo", 14, 14)
    m.camino([(9, 12.5), (9, 17), (18, 19), (24, 10)])
    m.inicio = [9 * T, 16 * T]
    m.camino([(18, 19), (28, 22), (30, 15)], losas=False)
    m.anillo_arboles(huecos=[(0, MH, "e")])
    m.corro(20, 4, 6, 10)                            # bosque arriba
    m.corro(5, 20, 2.5, 4)
    m.esparcir(lambda x, y: m.roca(x * T, y * T), 7, zona=(2, 2, 30, MH - 2))
    m.items_cerca(["palo", "palo_1", "tronco"], [(20, 4), (5, 20), (16, 6)], 8)
    m.items_cerca(["piedra", "piedra_1"], [(r["x"] / T, r["y"] / T) for r in m.rocas], 4, radio=2)
    m.items_cerca(["pokeball", "superball", "ultraball", "honorball", "masterball"], [(21, 11), (27, 11)], 5, radio=2)
    return m


VARIANTES = {"a": pradera, "b": lago, "c": orilla}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--solo", choices=list(VARIANTES))
    a = ap.parse_args()
    for letra, fn in VARIANTES.items():
        if a.solo and letra != a.solo:
            continue
        m = fn()
        out = OUT / f"aldea_{letra}.json"
        out.write_text(json.dumps(m.json(), separators=(",", ":")), encoding="utf-8")
        print(out.name, f"objetos={len(m.objetos)} arboles={len(m.arboles)} rocas={len(m.rocas)}")
        for row in m.vert:
            print("".join(".#=~"[v] for v in row))


if __name__ == "__main__":
    main()
