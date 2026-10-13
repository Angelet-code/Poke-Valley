"""edificio.py: compositor de edificios en pixel art a partir del KIT de piezas y de un plano JSON.

Las piezas (puerta, ventanas, chimenea, mercancía, muestras de muro...) se hacen y se limpian UNA vez
(`assets/gen/pixel/src/kit/*.txt`, construidas con `pixel_build.py` en `assets/game/pixel/kit/`); cada
edificio se describe en un plano pequeño y este guion lo monta aplicando las reglas de pixel art de
`docs/art/PIPELINE.md` §3b: contornos de 1 px con tramos regulares, bandas del alero paralelas al perfil,
tejas periódicas con jitter sembrado, hiladas paralelas a la cumbrera y juntas transversales con la
MISMA pendiente que el alero/hastial (escalonadas, nunca horizontales), triángulo del hastial = muro,
luz desde arriba a la izquierda, sin negro puro. Al final remata huérfanos y dobles (Mapa.rematar).

Uso:
    python -I tools/edificio.py plano.json --out salida.png [--txt salida.txt] [--catalogo edificios.json]
                                          [--kit assets/gen/pixel/src/kit] [--preview N]

  --out       PNG RGBA a 1 px = 1 px de mundo (casilla 24 px).
  --txt       además, la fuente txt del edificio montado (formato pixel_build), por si hay que retocar.
  --catalogo  JSON de catálogo donde se escribe/actualiza la entrada {"archivo","ancla","colision","tipo"}
              (la entrada se imprime siempre).
  --preview   también <salida>_xN.png ampliado.

FORMATO DEL PLANO (JSON; medidas en casillas de 24 px salvo donde dice px):
{
  "id": "casa",                      nombre (clave del catálogo; archivo = edificios/<id>.png)
  "ancho": 6, "fondo": 3,            huella en casillas (colisión por defecto = ancho*24 x fondo*24)
  "alto_muro": 26,                   px de muro visible en las esquinas (bajo la banda del alero)
  "margen": 1,                       px transparentes alrededor (por defecto 1)
  "tejado": {
    "tipo": "dos_aguas",             "dos_aguas" (cumbrera de delante a atrás, faldones a izq. y der.),
                                     "un_agua" (un faldón que mira al espectador, hiladas horizontales),
                                     "toldo" (toldo de rayas en abanico con festones, como la tienda)
    "material": "teja_roja",         clave de MATERIALES (teja_roja, teja_verde)
    "pendiente": [5, 3],             dos_aguas: a px en horizontal por b px de caída (5:3, 2:1, 3:1...);
                                     la misma pendiente para el alero frontal, el borde trasero y las
                                     juntas transversales de las tejas
    "vuelo": 6,                      px que el tejado/toldo sobresale del muro a cada lado
    "fondo_px": null,                dos_aguas: largo del tejado en la imagen (por defecto fondo*24+2*vuelo)
    "alto_px": null,                 un_agua: alto del faldón en la imagen (por defecto fondo*24+vuelo)
    "teja": [10, 8],                 ancho de hilada x largo de teja (px)
    "cumbrera": 8, "franja": 4,      dos_aguas: ancho de la cumbrera y de la franja clara a su derecha
    "cumbrera_jitter": true,         dos_aguas: desplazamientos de 1 px sembrados en los bordes de la cumbrera
    "semilla": 5                     semilla del jitter de las tejas (1/6 de tono, 1/8 junta corrida)
  },
  "muro": "muro_madera",             muestra repetible del muro (kit)
  "esquinas": true,                  postes de esquina (muro_esquina_izq/der) en dos_aguas y un_agua
  "zocalo": true,                    zócalo de 2 filas bajo el muro (sombra + línea de base)
  "postes": true,                    toldo: pies derechos (poste) en los dos extremos del cuerpo
  "piezas": [                        se pintan en este orden, con su propio contorno
    {"id": "puerta", "x": "centro", "y": "suelo"},
    {"id": "ventana_jardinera", "x": 18, "y": "suelo+14"},     x >= 0: px desde el borde izq. del muro
    {"id": "ventana_jardinera", "x": -18, "y": "suelo+14"},    x < 0: px desde el borde der. (a su borde der.)
    {"id": "chimenea", "x": -30, "y": "tejado", "sombra": true},   "tejado[+n]": sobre el faldón, al 30 %
    {"id": "mostrador", "x": 0, "y": "suelo+23", "ancho": 4},      del fondo hacia delante (+n px)
    {"id": "poste", "x": 88, "y": "suelo", "alto": 40}             "ancho" (casillas) / "alto" (px):
  ],                                                               la muestra se repite hasta ese tamaño;
  "colision": [144, 72]              opcional; por defecto [ancho*24, fondo*24]       "centro[+-n]" en x
}
  y admite también un número (fila absoluta del borde superior de la pieza). "suelo" = la pieza apoya
  sobre el zócalo. Las piezas del kit llevan un margen transparente: se coloca su caja opaca.

Salida: PNG RGBA + entrada de catálogo {"archivo": "edificios/<id>.png", "ancla": [ancho_img/2, alto_img],
"colision": [w, h], "tipo": "edificio"} (ancla = punto de apoyo abajo en el centro, como la casa V6).

Ejemplos: assets/gen/edificios/kit/planos/*.json; receta completa en docs/art/KIT.md.
"""
import argparse
import json
import sys
import time
from pathlib import Path

from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parent))
from pixel_txt import Mapa  # noqa: E402

CHARS = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ!$%&*+-/:<>?@^_|~"

# Materiales de tejado: rampa de 6 tonos (claro -> oscuro), juntas del faldón claro/oscuro, cumbrera.
# Las bandas del alero (fascia de madera) son comunes: contorno, fascia naranja 5, sombra 1, tabla clara 4,
# línea 1 (las de la casa V5/V6). Colores de la casa V6 (sin negro puro, sombras moradas).
MADERA = {"contorno": "#1e1a31", "fascia": "#c73a0b", "sombra": "#291b2c", "tabla": "#84210b", "linea": "#211a2f"}
MATERIALES = {
    "teja_roja": {"rampa": ["#c3080c", "#b7080d", "#9c070f", "#830812", "#6e0a15", "#4f0e1b"],
                  "junta_clara": "#590e1a", "junta_oscura": "#450f1c", "cumbrera": "#c73a0b"},
    "teja_verde": {"rampa": ["#9db54f", "#86a042", "#6f8a37", "#5a722d", "#465a24", "#33421b"],
                   "junta_clara": "#3b4c21", "junta_oscura": "#2a371a", "cumbrera": "#c73a0b"},
}
CAPAS_ALERO = [(0, 1, "contorno"), (1, 5, "fascia"), (6, 1, "sombra"), (7, 4, "tabla"), (11, 1, "linea")]
ALTO_ALERO = 12          # filas que ocupan las bandas del alero bajo el perfil (incluido el contorno)
# toldo (tienda V5/V6, "perfecto" según el usuario): colores y filas
TOLDO = {"contorno": "#2b2025", "viga": "#de9f5f", "viga_sombra": "#693f2f", "cenefa": "#a33542", "ribete": "#cb935e",
         "verde_alto": "#60772f", "crema_alto": "#dbc667", "verde": "#6b872f", "crema": "#faf2b6",
         "faldon_verde": "#3c3f2b", "faldon_crema": "#b2784d", "costura_verde": "#50342d", "sombra": "#222420"}


def clamp(v, a, b):
    return max(a, min(b, v))


def tramos_de(a, b):
    """Tramos de un perfil a:b (a columnas por b filas): b tramos que suman a, lo más iguales posible y
    repartidos de forma uniforme ([5,3] -> [2,2,1]; [2,1] -> [2]; [5,2] -> [3,2]; [1,1] -> [1])."""
    base, extra = divmod(a, b)
    out, acc = [], 0
    for i in range(b):
        acc += extra
        if acc >= b:
            acc -= b
            out.append(base + 1)
        else:
            out.append(base)
    return out[::-1]                      # los tramos largos primero (desde el vértice), como el alero de la V5


# ============================================================================================ lienzo
class Lienzo(Mapa):
    """Mapa con paleta dinámica por color hex: `ch('#rrggbb')` da (o crea) el carácter."""

    def __init__(self, w, h):
        super().__init__([], ["." * w] * h, [])
        self._ch = {}

    def ch(self, hexcolor):
        hexcolor = hexcolor.lower()
        if hexcolor not in self._ch:
            if len(self._ch) >= len(CHARS):
                raise SystemExit("demasiados colores en el edificio (máx %d)" % len(CHARS))
            c = CHARS[len(self._ch)]
            self._ch[hexcolor] = c
            self.color(c, hexcolor)
        return self._ch[hexcolor]

    def pegar_mapa(self, pieza, x, y, solo_sobre=None):
        """Estampa otro Mapa (sus colores se traducen a esta paleta) con su esquina (0,0) en (x, y)."""
        trad = {c: self.ch(hx) for c, hx in pieza.colores().items()}
        for j, fila in enumerate(pieza.filas):
            for i, c in enumerate(fila):
                if c != ".":
                    if solo_sobre is None or self.get(x + i, y + j) in solo_sobre:
                        self.set(x + i, y + j, trad[c])

    def mosaico(self, pieza, x0, y0, x1, y1, fase_x=0, fase_y=0, dentro=None):
        """Repite una muestra en el rectángulo (incluido); la muestra se ancla en (fase_x, fase_y)."""
        trad = {c: self.ch(hx) for c, hx in pieza.colores().items()}
        pw, ph = pieza.w, pieza.h
        for y in range(y0, y1 + 1):
            fila = pieza.filas[(y - fase_y) % ph]
            for x in range(x0, x1 + 1):
                if dentro is not None and not dentro(x, y):
                    continue
                c = fila[(x - fase_x) % pw]
                if c != ".":
                    self.set(x, y, trad[c])

    def imagen(self):
        cols = {c: hx for hx, c in self._ch.items()}
        im = Image.new("RGBA", (self.w, self.h), (0, 0, 0, 0))
        px = im.load()
        for y, fila in enumerate(self.filas):
            for x, c in enumerate(fila):
                if c != ".":
                    hx = cols[c]
                    px[x, y] = (int(hx[1:3], 16), int(hx[3:5], 16), int(hx[5:7], 16), 255)
        return im


# ============================================================================================ kit
class Kit:
    def __init__(self, carpeta):
        self.carpeta = Path(carpeta)
        self._cache = {}

    def pieza(self, nombre):
        if nombre not in self._cache:
            ruta = self.carpeta / f"{nombre}.txt"
            if not ruta.exists():
                raise SystemExit(f"pieza desconocida en el kit: {nombre} (no existe {ruta})")
            self._cache[nombre] = Mapa.leer(ruta)
        return self._cache[nombre]

    @staticmethod
    def caja(pieza):
        """Caja opaca (x0, y0, x1, y1) de una pieza (las piezas llevan margen transparente)."""
        xs = [x for y in range(pieza.h) for x in range(pieza.w) if pieza.filas[y][x] != "."]
        ys = [y for y in range(pieza.h) for x in range(pieza.w) if pieza.filas[y][x] != "."]
        return min(xs), min(ys), max(xs), max(ys)

    @staticmethod
    def recortada(pieza):
        """Copia sin margen transparente."""
        m = Mapa(list(pieza.paleta), ["".join(f) for f in pieza.filas], [])
        m.recortar()
        return m


# ============================================================================================ tejas
def tejas_faldon(m, dentro, w, h, tono, lado, x_arranque, perfil, semilla=1, p_tono=1 / 6, p_junta=1 / 8,
                 minimo=10, x_borde=None):
    """Tejas de un faldón de un tejado a dos aguas con la cumbrera VERTICAL, con las juntas transversales
    PARALELAS AL ALERO: hiladas = columnas de `w` px que arrancan en la cumbrera (`x_arranque` = primera
    columna de tejas junto a la cumbrera) y avanzan hacia el alero (`lado` 'izq' o 'der'); dentro de cada
    hilada las tejas miden `h` filas contadas desde el perfil del alero `perfil` {x: y} (línea escalonada
    a:b), de modo que cada límite entre tejas es el mismo escalón que el alero (la perspectiva del faldón),
    y las columnas impares van corridas media teja. Cada teja: columna del lado del alero y fila de abajo
    = junta (1 px, la costura entre hiladas es continua), fila de arriba y columna del lado de la cumbrera
    = luz (1 px), esquinas del lado del alero redondeadas; las tejas cortadas por la máscara a < `minimo`
    px solo llevan la base. Jitter sembrado: ~p_tono de tejas un tono arriba/abajo, ~p_junta con la junta
    de abajo corrida 1 px. `tono(xc, yc, dk) -> (base, luz, junta)`. `x_borde`: columna pegada al contorno
    lateral, donde la junta no se pinta (evitaría un borde oscuro de 2 px). Devuelve píxeles pintados."""
    s = -1 if lado == "izq" else 1          # sentido de avance hacia el alero
    celdas = {}
    for x, yp in perfil.items():
        c = (x - x_arranque) * s
        if c < 0:
            continue
        col, i = divmod(c, w)               # i = 0 junto a la cumbrera ... w-1 en el lado del alero
        i = w - 1 - i                       # i = 0 en el lado del alero (junta), w-1 junto a la cumbrera (luz)
        off = h // 2 if col % 2 else 0
        for y in range(m.h):
            if not dentro(x, y):
                continue
            d = yp - y                      # distancia por encima del alero (>= 1 dentro del faldón)
            if d < 1:
                continue
            r, j = divmod(d - 1 + off, h)
            j = h - 1 - j                   # j = h-1 fila de abajo (junta), 0 fila de arriba (luz)
            celdas.setdefault((col, r), []).append((x, y, i, j, yp))
    n = 0
    for (col, r), pts in celdas.items():
        filas = {y for _, y, _, _, _ in pts}
        cols = {x for x, _, _, _, _ in pts}
        astilla = len(pts) < minimo or len(filas) < 3
        u1, u2 = Mapa._azar(semilla, col + 1000, r + 1000)
        dk = -1 if u1 < p_tono / 2 else (1 if u1 < p_tono else 0)
        corrida = u2 < p_junta
        xc = x_arranque + s * (col * w + w // 2)
        yc = perfil[clamp(xc, min(perfil), max(perfil))] - (r * h + h // 2) - off
        base, luz, junta = tono(xc, yc, dk)
        yj = h - 2 if corrida else h - 1
        completa = len(cols) >= w           # la teja tiene su columna de junta y la de luz enteras
        for x, y, i, j, yp in pts:
            if i == 0:
                ch = base if x == x_borde else junta      # costura continua entre hiladas
            elif astilla:
                ch = base
            elif j == yj:
                ch = junta
            elif j == h - 1:
                ch = base                                   # fila bajo una junta corrida
            elif i == 1 and completa and (j == 0 or j == yj - 1):
                ch = junta                                  # esquinas redondeadas del lado del alero
            elif j == 0 and i == w - 1 and perfil.get(x + s, yp) == yp:
                ch = base                                   # esquina de la luz sin escalón del alero: se une en
            elif j == 0 or i == w - 1:                      # diagonal (si hay escalón, la esquina ya no hace "L")
                ch = luz
            else:
                ch = base
            m.set(x, y, ch)
            n += 1
    return n


# ============================================================================================ compositor
class Edificio:
    def __init__(self, plan, kit):
        self.p = plan
        self.kit = kit
        self.mg = int(plan.get("margen", 1))
        self.W = int(plan["ancho"]) * 24
        self.D = int(plan.get("fondo", 2)) * 24
        self.tej = dict(plan.get("tejado", {}))
        self.tipo = self.tej.get("tipo", "dos_aguas")
        self.vuelo = int(self.tej.get("vuelo", 6 if self.tipo != "toldo" else 4))
        self.alto_muro = int(plan.get("alto_muro", 26))
        self.zocalo = bool(plan.get("zocalo", self.tipo != "toldo"))
        self.mat = MATERIALES[self.tej.get("material", "teja_roja")]
        self.sombras = []            # rectángulos (x0, y0, x1, y1) que oscurecen las tejas (chimeneas)
        self.top_extra = 0           # filas añadidas arriba si alguna pieza (chimenea) sobresale del tejado
        self._geometria()
        self._preparar_piezas()
        sobra = self.mg - min([self.mg] + [caja[1] for _, _, _, _, caja in self.piezas])
        if sobra > 0:
            self.top_extra = sobra
            self._geometria()
            self._preparar_piezas()
        self.m = Lienzo(self.IW, self.IH)
        self.ch = self.m.ch
        self.protegidos = set()

    # ------------------------------------------------------------------------------ geometría
    def _geometria(self):
        mg, W, v = self.mg + self.top_extra, self.W, self.vuelo  # mg: fila superior del tejado/toldo
        self.IW = W + 2 * v + 2 * self.mg
        self.x0, self.x1 = self.mg, self.IW - 1 - self.mg        # bordes del tejado/toldo
        self.wx0, self.wx1 = self.mg + v, self.mg + v + W - 1    # bordes del muro
        self.cx = self.IW // 2                                   # eje: entre cx-1 y cx
        tw, th = self.tej.get("teja", [10, 8])
        self.tw, self.th = int(tw), int(th)
        if self.tipo == "dos_aguas":
            a, b = self.tej.get("pendiente", [5, 3])
            self.tramos = tramos_de(int(a), int(b))
            self.Dimg = int(self.tej.get("fondo_px") or (self.D + 2 * v))
            izq = Mapa.perfil_tramos(self.cx - 1, 0, self.tramos, self.x0)
            der = Mapa.perfil_tramos(self.cx, 0, self.tramos, self.x1)
            rel = {**izq, **der}                                 # perfil del alero relativo al vértice
            for xe, xv in ((self.x0, self.x0 + 1), (self.x1, self.x1 - 1)):
                if rel[xe] == rel[xv]:                           # el tramo que llega a la esquina mide 1 px:
                    rel[xe] += 1                                 # así el codo con el contorno lateral no es un "doble"
            yA = mg + self.Dimg                                  # vértice delantero
            self.perfil = {x: yA + d for x, d in rel.items()}
            self.y_back = {x: y - self.Dimg for x, y in self.perfil.items()}
            y_esq = self.perfil[self.wx0] + ALTO_ALERO           # primera fila de muro en la esquina
            self.y_base = y_esq + self.alto_muro - 1 + (2 if self.zocalo else 0)
        elif self.tipo == "un_agua":
            R = int(self.tej.get("alto_px") or (self.D + v))
            y_e = mg + R                                         # fila del contorno del alero
            self.perfil = {x: y_e for x in range(self.x0, self.x1 + 1)}
            self.y_top = mg
            self.y_base = y_e + ALTO_ALERO + self.alto_muro - 1 + (2 if self.zocalo else 0)
        else:                                                    # toldo
            self.y_toldo = mg                                    # fila superior del toldo (49 filas)
            self.y_cuerpo = mg + 49
            self.y_base = self.y_cuerpo + self.alto_muro - 1 + (2 if self.zocalo else 0)
        self.IH = self.y_base + 1 + self.mg
        self.y_suelo = self.y_base - 1 if self.zocalo else self.y_base

    # ------------------------------------------------------------------------------ piezas
    def _resolver(self, pz):
        """Posición (x, y) de la esquina superior izquierda de la caja opaca de una pieza."""
        pieza = self.kit.pieza(pz["id"])
        pieza = self._dimensionar(pz, pieza)
        bx0, by0, bx1, by1 = Kit.caja(pieza)
        bw, bh = bx1 - bx0 + 1, by1 - by0 + 1
        xs = pz.get("x", "centro")
        if isinstance(xs, str) and xs.startswith("centro"):
            d = int(xs[6:]) if len(xs) > 6 else 0
            x = self.cx - bw // 2 + d
        else:
            xs = int(xs)
            x = self.wx0 + xs if xs >= 0 else self.wx1 + xs - bw + 1
        ys = pz.get("y", "suelo")
        if isinstance(ys, str):
            if ys.startswith("suelo"):
                d = int(ys[5:]) if len(ys) > 5 else 0
                y = self.y_suelo - d - bh + 1
            elif ys.startswith("tejado"):
                d = int(ys[6:]) if len(ys) > 6 else 0
                xc = clamp(x + bw // 2, self.x0, self.x1)
                if self.tipo == "dos_aguas":
                    y = self.y_back[xc] + round(0.30 * self.Dimg) + d - bh + 1
                else:
                    y = self.mg + round(0.30 * (self.perfil[xc] - self.mg if self.tipo == "un_agua" else 49)) + d - bh + 1
            else:
                raise SystemExit(f"y desconocida en la pieza {pz}: {ys}")
        else:
            y = int(ys)
        return pieza, x - bx0, y - by0, (x, y, x + bw - 1, y + bh - 1)

    def _dimensionar(self, pz, pieza):
        """Piezas con "ancho" (casillas) o "alto" (px): la muestra se repite hasta ese tamaño; los tramos
        (mostrador) reciben además una columna de contorno a cada lado."""
        if "ancho" not in pz and "alto" not in pz:
            return pieza
        base = Kit.recortada(pieza)
        w = int(pz["ancho"]) * 24 if "ancho" in pz else base.w
        h = int(pz["alto"]) if "alto" in pz else base.h
        tramo = pz["id"] in ("mostrador",)
        out = Mapa(list(base.paleta), ["." * (w + (2 if tramo else 0))] * h, [])
        for y in range(h):
            fila = base.filas[y % base.h]
            for x in range(w):
                out.set(x + (1 if tramo else 0), y, fila[x % base.w])
        if tramo:
            oscuro = min(base.colores().items(), key=lambda kv: int(kv[1][1:3], 16) + int(kv[1][3:5], 16) + int(kv[1][5:7], 16))[0]
            out.vlinea(0, 0, h - 1, oscuro)
            out.vlinea(w + 1, 0, h - 1, oscuro)
        return out

    def _preparar_piezas(self):
        self.piezas = []
        for pz in self.p.get("piezas", []):
            pieza, x, y, caja = self._resolver(pz)
            self.piezas.append((pz, pieza, x, y, caja))
            if pz.get("sombra") and self.tipo == "dos_aguas":
                x0, y0, x1, y1 = caja
                self.sombras.append((x1 + 1, y1 - 11, x1 + 6, y1))     # sombra de la chimenea sobre las tejas

    def _pintar_piezas(self):
        for pz, pieza, x, y, caja in self.piezas:
            self.m.pegar_mapa(pieza, x, y)

    # ------------------------------------------------------------------------------ muro
    def _muro(self, y_de):
        """Muro entre wx0 y wx1 desde la fila y_de(x) hasta el zócalo; postes de esquina; zócalo."""
        m, ch = self.m, self.ch
        muro = self.kit.pieza(self.p.get("muro", "muro_madera"))
        y_fin = self.y_base - (2 if self.zocalo else 0)
        m.mosaico(muro, self.wx0, 0, self.wx1, y_fin, fase_x=self.wx0, fase_y=y_fin + 1,
                  dentro=lambda x, y: y >= y_de(x))
        if self.p.get("esquinas", self.tipo != "toldo"):
            for nombre, xa in (("muro_esquina_izq", self.wx0), ("muro_esquina_der", self.wx1 - 9)):
                pieza = self.kit.pieza(nombre)
                m.mosaico(pieza, xa, 0, xa + pieza.w - 1, y_fin, fase_x=xa, fase_y=0, dentro=lambda x, y: y >= y_de(x))
        if self.zocalo:
            z = self.kit.pieza(self.p.get("zocalo_pieza", "zocalo"))
            m.mosaico(z, self.wx0, self.y_base - 1, self.wx1, self.y_base, fase_x=self.wx0, fase_y=self.y_base - 1)
            m.hlinea(self.wx0, self.wx1, self.y_base, ch(MADERA["contorno"]))

    def _alero(self, perfil, filtro_extra=None):
        """Bandas del alero paralelas al perfil; en los bordes laterales, contorno."""
        capas = [(d, g, self.ch(MADERA[k])) for d, g, k in CAPAS_ALERO]
        cont = self.ch(MADERA["contorno"])

        def filtro(x, y, c):
            if x in (self.x0, self.x1):
                return cont
            return filtro_extra(x, y, c) if filtro_extra else c
        self.m.bandas(perfil, capas, filtro)

    def _tono(self, lado):
        rampa = [self.ch(c) for c in self.mat["rampa"]]
        junta = self.ch(self.mat["junta_clara" if lado == "izq" else "junta_oscura"])
        anchura = max(1, (self.x1 - self.x0) // 2)

        def tono(xc, yc, dk):
            u = clamp(abs(xc - self.cx) / anchura, 0, 1)        # 0 en la cumbrera, 1 en el alero lateral
            if lado == "izq":
                k = 1 if u < 0.5 else 2
                k = clamp(k + dk, 0, 3)
            else:
                k = 3 if u < 0.35 else (4 if u < 0.75 else 5)
                if any(a <= xc <= c and b <= yc <= d for a, b, c, d in self.sombras):
                    k += 1
                k = clamp(k + dk, 2, 5)
            return rampa[k], rampa[max(0, k - 1)], junta
        return tono

    # ------------------------------------------------------------------------------ tejado a dos aguas
    def _dos_aguas(self):
        m, ch = self.m, self.ch
        cont = ch(MADERA["contorno"])
        cumb = ch(self.mat["cumbrera"])
        franja = ch(self.mat["rampa"][1])
        rw = int(self.tej.get("cumbrera", 8))
        fw = int(self.tej.get("franja", 4))
        bx0, bx1 = self.cx - rw // 2, self.cx + rw - rw // 2 - 1
        semilla = int(self.tej.get("semilla", 5))
        perfil, y_back = self.perfil, self.y_back

        def plano(x, y):
            return self.x0 < x < self.x1 and y_back[x] < y < perfil[x]

        # tejas: faldón izquierdo (claro) y derecho (en sombra), juntas transversales con la pendiente del alero
        tejas_faldon(m, lambda x, y: x < bx0 and plano(x, y), self.tw, self.th, self._tono("izq"), "izq",
                     bx0 - 1, perfil, semilla=semilla, x_borde=self.x0 + 1)
        tejas_faldon(m, lambda x, y: x > bx1 + fw and plano(x, y), self.tw, self.th, self._tono("der"), "der",
                     bx1 + fw + 1, perfil, semilla=semilla, x_borde=self.x1 - 1)
        # franja clara y cumbrera
        for x in range(bx1 + 1, bx1 + fw + 1):
            m.vlinea(x, y_back[x] + 1, perfil[x] - 1, franja)
        for x in range(bx0, bx1 + 1):
            m.vlinea(x, y_back[x] + 1, perfil[x], cumb)          # baja hasta la fascia sin contorno entre medias
        if self.tej.get("cumbrera_jitter", True):
            # desplazamientos de 1 px en los bordes de la cumbrera, sembrados (tramos de 3 filas, alternando lado)
            y0 = max(y_back[bx0], y_back[bx1]) + 4
            y1 = min(perfil[bx0], perfil[bx1]) - 6
            k = 0
            y = y0
            while y + 3 <= y1:
                u, v = Mapa._azar(semilla + 7, k, 3)
                paso = 9 + int(u * 8)
                if v < 0.7:
                    lado = -1 if k % 2 == 0 else 1
                    xj = bx0 - 1 if lado < 0 else bx1 + 1
                    m.vlinea(xj, y, y + 2, cumb)
                y += paso
                k += 1
        # contornos: borde trasero (Λ a la misma pendiente), laterales y alero
        for x in range(self.x0, self.x1 + 1):
            m.set(x, y_back[x], cont)
            self.protegidos.add((x, y_back[x]))
            self.protegidos.add((x, perfil[x]))
        m.vlinea(self.x0, y_back[self.x0], perfil[self.x0], cont)
        m.vlinea(self.x1, y_back[self.x1], perfil[self.x1], cont)

        def filtro(x, y, c):
            if c == cont and y == perfil[x] and bx0 <= x <= bx1:
                return cumb
            return c
        self._alero(perfil, filtro)

    # ------------------------------------------------------------------------------ un agua
    def _un_agua(self):
        m, ch = self.m, self.ch
        cont = ch(MADERA["contorno"])
        y_e = self.perfil[self.x0]
        rampa = [ch(c) for c in self.mat["rampa"]]
        junta = ch(self.mat["junta_clara"])
        semilla = int(self.tej.get("semilla", 5))
        alto = y_e - self.y_top

        def tono(xc, yc, dk):
            v = clamp((yc - self.y_top) / max(1, alto), 0, 1)
            k = 1 if v < 0.45 else 2
            if (xc - self.x0) / max(1, self.x1 - self.x0) > 0.7:
                k += 1
            k = clamp(k + dk, 0, 4)
            return rampa[k], rampa[max(0, k - 1)], junta
        m.tejas(lambda x, y: self.x0 < x < self.x1 and self.y_top < y < y_e, self.tw, self.th, tono,
                ox=self.x0 + 1, oy=y_e - 1 - 20 * self.th, semilla=semilla)
        m.hlinea(self.x0, self.x1, self.y_top, cont)
        for y in (self.y_top + 1, self.y_top + 2):               # caballete: tabla del borde trasero
            m.hlinea(self.x0 + 1, self.x1 - 1, y, ch(self.mat["cumbrera"]))
        m.vlinea(self.x0, self.y_top, y_e, cont)
        m.vlinea(self.x1, self.y_top, y_e, cont)
        self._alero(self.perfil)

    # ------------------------------------------------------------------------------ toldo
    def _toldo(self):
        m, ch = self.m, self.ch
        T = {k: ch(v) for k, v in TOLDO.items()}
        ya = self.y_toldo
        AW = self.x1 - self.x0 + 1

        def e(y):                                   # inserción lateral (5:1 regular, como la tienda)
            return max(0, 8 - (y + 1) // 5)
        n = max(3, int(round(AW / 21.5)) | 1)       # franjas (impar): verde en los extremos
        xl_t, xr_t = self.x0 + e(12), self.x1 - e(12)
        xl_b, xr_b = self.x0 + e(42), self.x1 - e(42)
        arriba = [xl_t + round(k * (xr_t - xl_t) / n) for k in range(1, n)]
        abajo = [xl_b + round(k * (xr_b - xl_b) / n) for k in range(1, n)]
        xs = Mapa.abanico(list(zip(arriba, abajo)), ya + 12, ya + 42)
        xs[ya + 11] = xs[ya + 12]
        m.hlinea(self.x0 + e(0), self.x1 - e(0), ya, T["contorno"])
        for yy in range(1, 47):
            y = ya + yy
            xl, xr = self.x0 + e(yy), self.x1 - e(yy)
            if yy <= 6:
                relleno = T["viga"]
            elif yy <= 8:
                relleno = T["viga_sombra"]
            elif yy <= 10:
                relleno = T["cenefa"]
            elif yy == 11:
                relleno = T["ribete"]
            else:
                relleno = None
            if relleno:
                m.hlinea(xl + 1, xr - 1, y, relleno)
            if yy >= 11:
                if yy <= 18:
                    verde, crema = T["verde_alto"], T["crema_alto"]
                elif yy <= 42:
                    verde, crema = T["verde"], T["crema"]
                else:
                    verde, crema = T["faldon_verde"], T["faldon_crema"]
                cos = xs[y] if yy <= 42 else abajo
                bordes = [xl] + cos + [xr]
                for i in range(n):
                    m.hlinea(bordes[i] + 1, bordes[i + 1] - 1, y, crema if i % 2 else verde)
                for i, xc in enumerate(cos):
                    if yy <= 42:
                        c = T["viga_sombra"] if i % 2 == 0 else T["cenefa"]
                    else:
                        c = T["costura_verde"] if i % 2 == 0 else T["viga_sombra"]
                    if yy == 11:
                        c = T["cenefa"]
                    m.set(xc, y, c)
            m.set(xl, y, T["contorno"])
            m.set(xr, y, T["contorno"])
        # faldón: sombra y festones iguales de 7 px, centrados
        m.hlinea(self.x0, self.x1, ya + 47, T["sombra"])
        m.hlinea(self.x0 + 1, self.x1 - 1, ya + 48, T["sombra"])
        nf = (AW - 2) // 7
        fx0 = self.x0 + 1 + ((AW - 2) - nf * 7) // 2
        m.festones(fx0, self.x1 - 1, ya + 46, 7, [2, 1], T["sombra"])
        for x in (self.x0, self.x1):
            m.vlinea(x, ya + 45, ya + 46, T["sombra"])
        for x in range(self.x0 + 1, fx0):
            m.set(x, ya + 46, T["sombra"]), m.set(x, ya + 45, T["sombra"])
        for x in range(fx0 + nf * 7, self.x1):
            m.set(x, ya + 46, T["sombra"]), m.set(x, ya + 45, T["sombra"])

    def _cuerpo_toldo(self):
        m = self.m
        muro = self.kit.pieza(self.p.get("muro", "muro_tablas_oscuro"))
        y_fin = self.y_base - (2 if self.zocalo else 0)
        m.mosaico(muro, self.wx0, self.y_cuerpo, self.wx1, y_fin, fase_x=self.wx0, fase_y=self.y_cuerpo)
        if self.p.get("postes", True):
            poste = self.kit.pieza("poste")
            for xa in (self.wx0, self.wx1 - poste.w + 1):
                m.mosaico(poste, xa, self.y_cuerpo, xa + poste.w - 1, y_fin, fase_x=xa, fase_y=self.y_cuerpo)
        if self.zocalo:
            z = self.kit.pieza(self.p.get("zocalo_pieza", "zocalo"))
            m.mosaico(z, self.wx0, self.y_base - 1, self.wx1, self.y_base, fase_x=self.wx0, fase_y=self.y_base - 1)

    # ------------------------------------------------------------------------------ montaje
    def montar(self):
        if self.tipo == "dos_aguas":
            self._muro(lambda x: self.perfil[x] + ALTO_ALERO)
            self._dos_aguas()
        elif self.tipo == "un_agua":
            self._muro(lambda x: self.perfil[x] + ALTO_ALERO)
            self._un_agua()
        elif self.tipo == "toldo":
            self._toldo()
            self._cuerpo_toldo()
        else:
            raise SystemExit(f"tipo de tejado desconocido: {self.tipo}")
        self._pintar_piezas()
        n = self.m.rematar(proteger=lambda x, y: (x, y) in self.protegidos)
        return n

    def catalogo(self):
        col = self.p.get("colision", [self.W, self.D])
        return {"archivo": f"edificios/{self.p['id']}.png", "ancla": [self.IW // 2, self.IH],
                "colision": [int(col[0]), int(col[1])], "tipo": "edificio"}


# ============================================================================================ principal
def main():
    ap = argparse.ArgumentParser(description="Monta un edificio en pixel art a partir de un plano JSON y el kit.")
    ap.add_argument("plano")
    ap.add_argument("--out", required=True, help="PNG de salida")
    ap.add_argument("--txt", help="fuente txt del edificio montado")
    ap.add_argument("--catalogo", help="JSON de catálogo que actualizar con la entrada del edificio")
    ap.add_argument("--kit", default="assets/gen/pixel/src/kit", help="carpeta de las piezas (txt)")
    ap.add_argument("--preview", type=int, default=0)
    a = ap.parse_args()

    t0 = time.perf_counter()
    plan = json.loads(Path(a.plano).read_text(encoding="utf-8"))
    ed = Edificio(plan, Kit(a.kit))
    remate = ed.montar()
    im = ed.m.imagen()
    out = Path(a.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    im.save(out)
    dt = time.perf_counter() - t0
    if a.txt:
        ed.m.cabecera = [f"; {plan['id']}: montado por tools/edificio.py desde {Path(a.plano).as_posix()}"]
        ed.m.escribir(a.txt)
    if a.preview > 1:
        im.resize((im.width * a.preview, im.height * a.preview), Image.NEAREST).save(out.with_name(f"{out.stem}_x{a.preview}.png"))
    entrada = ed.catalogo()
    if a.catalogo:
        ruta = Path(a.catalogo)
        cat = json.loads(ruta.read_text(encoding="utf-8")) if ruta.exists() else {}
        cat[plan["id"]] = entrada
        ruta.parent.mkdir(parents=True, exist_ok=True)
        ruta.write_text(json.dumps(cat, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"{out}  {im.width}x{im.height}  colores={len(ed.m.paleta)}  remate={remate}  {dt:.2f} s")
    print(json.dumps({plan["id"]: entrada}, ensure_ascii=False))


if __name__ == "__main__":
    main()
