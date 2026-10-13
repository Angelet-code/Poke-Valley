"""Retoques a mano, reproducibles, sobre mapas de píxeles de texto (formato de `pixel_build.py`).

No es una herramienta de dibujo desde cero: sirve para corregir defectos concretos de un sprite
que viene de la IA (`png_to_txt.py`) sin tocar píxel a píxel con el ratón. Se usa como módulo
desde un guion de retoques (p. ej. `assets/gen/pixel/src/edificios/retoques_casa.py`):

    from pixel_txt import Mapa
    m = Mapa.leer("casa_raw.txt")
    m.linea(10, 40, 53, 3, "2")        # diagonal con tramos regulares (Bresenham)
    m.rect(44, 70, 62, 110, "a")       # relleno
    m.hlinea(0, 106, 66, "4")          # horizontal
    m.insertar_columnas(53, 6)         # duplica 6 veces la columna 53 (ensanchar)
    m.espejo("izq")                    # copia la mitad izquierda sobre la derecha
    m.escribir("casa.txt")

Coordenadas: x hacia la derecha, y hacia abajo, origen (0, 0) arriba a la izquierda, extremos
incluidos. Los caracteres son los de la paleta del txt ('.' = transparente).

`linea()` dibuja con Bresenham, que produce tramos regulares (1:1, 2:1, 3:1...) o, en pendientes
intermedias, una alternancia uniforme de dos longitudes (p. ej. 2,3,2,3), nunca 1-2-1-3.

V5 (edificios): `perfil_tramos` (perfil escalonado con tramos fijos, p. ej. [2,2,1] = 5:3) +
`bandas` (bandas paralelas al perfil), `tejas` (relleno periódico con jitter sembrado dentro de una
máscara), `festones` (festones iguales), `abanico` (costuras en abanico) y `rematar` (huérfanos y
dobles, como pixel_clean, horneados en el txt). Ver `assets/gen/pixel/src/edificios/retoques_v5.py`.
V6: `tejas_v` (tejas en hiladas verticales, paralelas a la cumbrera, bajando hacia un alero lateral),
`piedras` (mampostería irregular trabada), `caja` (caja de listones) y `pegar` (estampar un bloque de
texto). Ver `retoques_v6.py`.
"""
from pathlib import Path


class Mapa:
    def __init__(self, paleta_lineas, filas, cabecera):
        self.paleta = paleta_lineas  # lista de líneas "c=#rrggbb" tal cual
        self.filas = [list(f) for f in filas]
        self.cabecera = cabecera

    @classmethod
    def leer(cls, ruta):
        lineas = Path(ruta).read_text(encoding="utf-8").splitlines()
        cab, pal, filas, en_pal = [], [], [], True
        for ln in lineas:
            if ln.startswith(";"):
                if en_pal:
                    cab.append(ln)
                continue
            if en_pal:
                if ln.strip() == "":
                    if pal:
                        en_pal = False
                    continue
                pal.append(ln)
            elif ln.strip():
                filas.append(ln)
        return cls(pal, filas, cab)

    # ---------------------------------------------------------------- consultas
    @property
    def w(self):
        return len(self.filas[0])

    @property
    def h(self):
        return len(self.filas)

    def get(self, x, y):
        return self.filas[y][x]

    def colores(self):
        return {ln.split("=", 1)[0].strip(): ln.split("=", 1)[1].strip() for ln in self.paleta}

    # ---------------------------------------------------------------- paleta
    def color(self, c, hexcolor):
        """Cambia (o añade) el color hex del carácter c."""
        for i, ln in enumerate(self.paleta):
            if ln.split("=", 1)[0].strip() == c:
                self.paleta[i] = f"{c}={hexcolor}"
                return
        self.paleta.append(f"{c}={hexcolor}")

    def sustituir(self, de, a, x0=0, y0=0, x1=None, y1=None):
        """Cambia todos los píxeles del carácter `de` por `a` dentro del rectángulo."""
        x1 = self.w - 1 if x1 is None else x1
        y1 = self.h - 1 if y1 is None else y1
        n = 0
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1):
                if self.filas[y][x] == de:
                    self.filas[y][x] = a
                    n += 1
        return n

    # ---------------------------------------------------------------- dibujo
    def set(self, x, y, c):
        if 0 <= x < self.w and 0 <= y < self.h:
            self.filas[y][x] = c

    def hlinea(self, x0, x1, y, c):
        for x in range(min(x0, x1), max(x0, x1) + 1):
            self.set(x, y, c)

    def vlinea(self, x, y0, y1, c):
        for y in range(min(y0, y1), max(y0, y1) + 1):
            self.set(x, y, c)

    def rect(self, x0, y0, x1, y1, c):
        for y in range(y0, y1 + 1):
            self.hlinea(x0, x1, y, c)

    def marco(self, x0, y0, x1, y1, c):
        self.hlinea(x0, x1, y0, c)
        self.hlinea(x0, x1, y1, c)
        self.vlinea(x0, y0, y1, c)
        self.vlinea(x1, y0, y1, c)

    def linea(self, x0, y0, x1, y1, c, solo_sobre=None):
        """Bresenham de 1 px (8-conexa, tramos regulares). `solo_sobre`: solo pinta sobre esos chars."""
        dx, dy = abs(x1 - x0), -abs(y1 - y0)
        sx, sy = (1 if x0 < x1 else -1), (1 if y0 < y1 else -1)
        err = dx + dy
        x, y = x0, y0
        while True:
            if solo_sobre is None or self.get(x, y) in solo_sobre:
                self.set(x, y, c)
            if x == x1 and y == y1:
                break
            e2 = 2 * err
            if e2 >= dy:
                err += dy
                x += sx
            if e2 <= dx:
                err += dx
                y += sy

    def relleno_bajo_linea(self, x0, y0, x1, y1, c, hasta_y, solo_sobre=None):
        """Para cada columna de la línea (x0,y0)-(x1,y1), pinta desde la línea (excluida) hasta hasta_y."""
        pts = {}
        dx, dy = abs(x1 - x0), -abs(y1 - y0)
        sx, sy = (1 if x0 < x1 else -1), (1 if y0 < y1 else -1)
        err, x, y = dx + dy, x0, y0
        while True:
            pts[x] = max(pts.get(x, -1), y)
            if x == x1 and y == y1:
                break
            e2 = 2 * err
            if e2 >= dy:
                err += dy
                x += sx
            if e2 <= dx:
                err += dx
                y += sy
        for x, yl in pts.items():
            for yy in range(yl + 1, hasta_y + 1):
                if solo_sobre is None or self.get(x, yy) in solo_sobre:
                    self.set(x, yy, c)

    # ---------------------------------------------------------------- bloques
    def copiar(self, x0, y0, x1, y1, dx, dy, saltar="."):
        """Copia el bloque a (x0+dx, y0+dy); no copia los píxeles `saltar`."""
        bloque = [row[x0:x1 + 1] for row in self.filas[y0:y1 + 1]]
        for j, row in enumerate(bloque):
            for i, ch in enumerate(row):
                if ch not in saltar:
                    self.set(x0 + dx + i, y0 + dy + j, ch)

    def filas_periodicas(self, y0, y1, periodo, y_src=None, x0=0, x1=None, solo_sobre=None):
        """Repite la plantilla de `periodo` filas (desde y_src) entre y0 e y1 (incluidos)."""
        y_src = y0 if y_src is None else y_src
        x1 = self.w - 1 if x1 is None else x1
        tpl = [self.filas[y][:] for y in range(y_src, y_src + periodo)]
        for y in range(y0, y1 + 1):
            src = tpl[(y - y0) % periodo]
            for x in range(x0, x1 + 1):
                if src[x] == "." or (solo_sobre is not None and self.filas[y][x] not in solo_sobre):
                    continue
                self.filas[y][x] = src[x]

    def insertar_columnas(self, x, n):
        """Inserta n copias de la columna x justo a su derecha (ensanchar un sprite periódico)."""
        for row in self.filas:
            row[x + 1:x + 1] = [row[x]] * n

    def borrar_columnas(self, x0, x1):
        for row in self.filas:
            del row[x0:x1 + 1]

    def insertar_filas(self, y, n):
        for _ in range(n):
            self.filas.insert(y + 1, self.filas[y][:])

    def borrar_filas(self, y0, y1):
        del self.filas[y0:y1 + 1]

    def espejo(self, lado="izq", proteger=()):
        """Copia la mitad `izq`/`der` espejada sobre la otra. `proteger`: rectángulos (x0,y0,x1,y1) intactos."""
        w = self.w
        orig = [row[:] for row in self.filas]
        for y, row in enumerate(self.filas):
            for x in range(w):
                xm = w - 1 - x
                copiar = (x > xm) if lado == "izq" else (x < xm)
                if copiar and not any(a <= x <= c and b <= y <= d for a, b, c, d in proteger):
                    row[x] = orig[y][xm]

    def recortar(self):
        """Quita filas y columnas transparentes de los bordes."""
        while self.filas and all(c == "." for c in self.filas[0]):
            self.filas.pop(0)
        while self.filas and all(c == "." for c in self.filas[-1]):
            self.filas.pop()
        while all(row[0] == "." for row in self.filas):
            for row in self.filas:
                del row[0]
        while all(row[-1] == "." for row in self.filas):
            for row in self.filas:
                del row[-1]

    # ---------------------------------------------------------------- contornos (V4)
    def contorno_superior(self, tops, c, oscuros, fondo=3):
        """Fija el borde superior de las columnas: `tops` = {x: y_borde}. Por encima se borra,
        en y_borde se pone `c` (contorno de 1 px) y los píxeles oscuros (`oscuros`) pegados por
        debajo (el contorno viejo, hasta `fondo` filas) pasan al color de relleno de la columna
        (primer color no oscuro bajo el borde viejo). Devuelve píxeles cambiados."""
        n = 0
        for x, yt in tops.items():
            col = [self.get(x, y) for y in range(self.h)]
            old = next((y for y in range(self.h) if col[y] != "."), None)
            fill = None
            if old is not None:
                fill = next((col[y] for y in range(old, min(old + 10, self.h)) if col[y] != "." and col[y] not in oscuros), None)
            for y in range(0, yt):
                if col[y] != ".":
                    self.set(x, y, ".")
                    n += 1
            if col[yt] != c:
                self.set(x, yt, c)
                n += 1
            y = yt + 1
            lim = (max(old, yt) if old is not None else yt) + fondo
            while y < self.h and y <= lim and (self.get(x, y) in oscuros or self.get(x, y) == ".") and fill:
                self.set(x, y, fill)
                n += 1
                y += 1
        return n

    def desplazar_banda(self, x, y0, y1, d):
        """Mueve verticalmente el tramo de la columna x entre y0 e y1 (incluidos) `d` filas; el
        hueco que deja se rellena con el píxel vecino (de encima si baja, de debajo si sube)."""
        seg = [self.get(x, y) for y in range(y0, y1 + 1)]
        if d == 0:
            return 0
        if d < 0:
            relleno = self.get(x, y1 + 1) if y1 + 1 < self.h else "."
            for i, ch in enumerate(seg):
                self.set(x, y0 + d + i, ch)
            for y in range(y1 + d + 1, y1 + 1):
                self.set(x, y, relleno)
        else:
            relleno = self.get(x, y0 - 1) if y0 > 0 else "."
            for i, ch in reversed(list(enumerate(seg))):
                self.set(x, y0 + d + i, ch)
            for y in range(y0, y0 + d):
                self.set(x, y, relleno)
        return len(seg) + abs(d)

    # ---------------------------------------------------------------- V5: perfiles, bandas, tejas, festones
    @staticmethod
    def perfil_tramos(x0, y0, tramos, x1):
        """Perfil escalonado {x: y}: arranca en (x0, y0) y avanza hacia x1 (incluido) bajando una fila
        por tramo; cada tramo ocupa tramos[i % n] columnas ([2] = 2:1, [2, 2, 1] = 5:3, [3, 2] = 5:2).
        Dos perfiles con los mismos tramos desde columnas vecinas hacia lados opuestos quedan espejados."""
        paso = 1 if x1 >= x0 else -1
        out, x, y, i = {}, x0, y0, 0
        while (x - x1) * paso <= 0:
            for _ in range(tramos[i % len(tramos)]):
                if (x - x1) * paso > 0:
                    break
                out[x] = y
                x += paso
            y += 1
            i += 1
        return out

    def bandas(self, perfil, capas, filtro=None):
        """Bandas paralelas a un perfil {x: y}: capas = [(desplazamiento, grosor, char), ...], el
        desplazamiento en filas bajo el perfil. Todas las bandas llevan exactamente los tramos del
        perfil (paralelas de verdad). `filtro(x, y, char) -> char | None` cambia u omite píxeles.
        Devuelve píxeles pintados."""
        n = 0
        for x, yp in perfil.items():
            for d, g, c in capas:
                for y in range(yp + d, yp + d + g):
                    ch = c if filtro is None else filtro(x, y, c)
                    if ch is not None and 0 <= y < self.h:
                        self.set(x, y, ch)
                        n += 1
        return n

    @staticmethod
    def _azar(semilla, *claves):
        """Dos números en [0, 1) deterministas a partir de enteros (sin depender de random)."""
        v = semilla * 83492791
        for k in claves:
            v = (v ^ (k * 73856093)) * 19349663 & 0xFFFFFFFF
            v ^= v >> 13
        v = (v * 2654435761) & 0xFFFFFFFF
        return ((v >> 8) % 10000) / 10000.0, ((v >> 20) % 4096) / 4096.0

    def tejas(self, dentro, w, h, tono, ox=0, oy=0, semilla=1, p_tono=1 / 6, p_junta=1 / 8, minimo=10, redondeo=True):
        """Relleno periódico de tejas dentro de la máscara `dentro(x, y) -> bool`: hiladas de `h` filas
        (desde oy), tejas de `w` columnas (desde ox) desplazadas media teja en las hiladas impares.
        Cada teja = fila superior y columna izquierda claras (1 px) + base + fila inferior y columna
        derecha oscuras (junta de 1 px); con `redondeo`, las dos esquinas inferiores de la base también
        son junta (teja redondeada). `tono(xc, yc, dk) -> (base, luz, junta)` da los caracteres según el
        centro de la teja (gradiente) con un salto de tono dk. Vida controlada y determinista: ~p_tono
        de las tejas un tono más claro u oscuro, ~p_junta con la junta inferior 1 px más arriba (teja
        "corrida"). Las tejas cortadas por la máscara a menos de `minimo` píxeles o de 3 columnas se
        pintan solo con la base (sin luz ni junta: evita escalones y huérfanos en los bordes). Nunca
        ruido por píxel. Devuelve píxeles pintados."""
        celdas = {}
        for y in range(self.h):
            r = (y - oy) // h
            oxr = ox + (w // 2 if r % 2 else 0)
            for x in range(self.w):
                if dentro(x, y):
                    c = (x - oxr) // w
                    celdas.setdefault((r, c), []).append((x, y))
        n = 0
        for (r, c), pts in celdas.items():
            oxr = ox + (w // 2 if r % 2 else 0)
            cols = {x for x, _ in pts}
            astilla = len(pts) < minimo or len(cols) < 3
            u1, u2 = self._azar(semilla, r + 1000, c + 1000)
            dk = -1 if u1 < p_tono / 2 else (1 if u1 < p_tono else 0)
            corrida = u2 < p_junta
            base, luz, junta = tono(oxr + c * w + w // 2, oy + r * h + h // 2, dk)
            yj = h - 2 if corrida else h - 1
            for x, y in pts:
                i, j = x - oxr - c * w, y - oy - r * h
                if astilla:
                    ch = base
                elif j == yj or i == w - 1:
                    ch = junta
                elif j == h - 1:
                    ch = base
                elif redondeo and j == yj - 1 and i in (0, w - 2):
                    ch = junta
                elif j == 0 or i == 0:
                    ch = luz
                else:
                    ch = base
                self.set(x, y, ch)
                n += 1
        return n

    def tejas_v(self, dentro, w, h, tono, lado="izq", ox=0, oy=0, semilla=1, p_tono=1 / 6, p_junta=1 / 8, minimo=10, redondeo=True):
        """V6: tejas en hiladas VERTICALES, paralelas a una cumbrera vertical, para un faldón que baja
        hacia la izquierda o la derecha (`lado` = lado del alero). Columnas de `w` px (desde ox) con
        tejas de `h` filas (desde oy), desplazadas media teja en las columnas impares. Cada teja: fila
        superior y columna del lado de la cumbrera claras (luz, 1 px), base, fila inferior y columna del
        lado del alero oscuras (junta de 1 px; la columna de junta es la costura continua entre hiladas);
        con `redondeo`, las dos esquinas del lado del alero también son junta. Las tejas cortadas por la
        máscara sin su columna de junta no se redondean (evita huérfanos en los bordes). Jitter sembrado
        como en `tejas` (p_tono: un tono arriba/abajo; p_junta: junta inferior 1 px más arriba).
        `tono(xc, yc, dk) -> (base, luz, junta)` por el centro de la teja. Devuelve píxeles pintados."""
        celdas = {}
        for y in range(self.h):
            for x in range(self.w):
                if dentro(x, y):
                    c = (x - ox) // w
                    oyc = oy + (h // 2 if c % 2 else 0)
                    celdas.setdefault((c, (y - oyc) // h), []).append((x, y))
        n = 0
        for (c, r), pts in celdas.items():
            oyc = oy + (h // 2 if c % 2 else 0)
            filas = {y for _, y in pts}
            astilla = len(pts) < minimo or len(filas) < 3
            u1, u2 = self._azar(semilla, c + 1000, r + 1000)
            dk = -1 if u1 < p_tono / 2 else (1 if u1 < p_tono else 0)
            corrida = u2 < p_junta
            base, luz, junta = tono(ox + c * w + w // 2, oyc + r * h + h // 2, dk)
            yj = h - 2 if corrida else h - 1
            ya = oyc + r * h
            xi = (lambda i: ox + c * w + i) if lado != "der" else (lambda i: ox + c * w + (w - 1 - i))
            # las esquinas redondeadas solo si la junta a la que se pegan existe (si no, huérfanos/dobles)
            red_arriba = redondeo and dentro(xi(0), ya) and dentro(xi(0), ya - 1)
            red_abajo = redondeo and dentro(xi(0), ya + yj - 1) and dentro(xi(1), ya + yj)
            for x, y in pts:
                i, j = x - ox - c * w, y - oyc - r * h
                if lado == "der":
                    i = w - 1 - i                      # i=0 siempre del lado del alero
                if i == 0:
                    ch = junta                         # la costura entre hiladas es continua, también en astillas
                elif astilla:
                    ch = base
                elif j == yj:
                    ch = junta
                elif j == h - 1:
                    ch = base
                elif i == 1 and ((j == 0 and red_arriba) or (j == yj - 1 and red_abajo)):
                    ch = junta
                elif j == 0 or i == w - 1:
                    ch = luz
                else:
                    ch = base
                self.set(x, y, ch)
                n += 1
        return n

    def piedras(self, x0, y0, x1, y1, alturas, anchos, tono, semilla=1, mortero="8", redondeo=True):
        """V6: mampostería irregular en el rectángulo (incluido): hiladas de `alturas[k]` filas apiladas
        desde y0 (la última fila de cada hilada es mortero); en cada hilada, bloques de anchos tomados de
        `anchos` en orden sembrado (la última columna de cada bloque es mortero); las hiladas impares
        arrancan con un bloque recortado para trabar. Cada piedra: fila superior y columna izquierda
        claras (luz desde arriba-izquierda), esquinas redondeadas (mortero). `tono(k, b, u) -> (base, luz)`
        por hilada k, bloque b y azar u en [0, 1). Devuelve el número de piedras."""
        n, y, k = 0, y0, 0
        esquinas_rect = {(x0, y0), (x1, y0), (x0, y1), (x1, y1)}   # ahí no hay junta a la que redondear
        for hk in alturas:
            if y > y1:
                break
            ya, yb = y, min(y + hk - 1, y1)           # yb = fila de mortero (o borde)
            x, b = x0, 0
            while x <= x1:
                u1, u2 = self._azar(semilla, k + 500, b + 500)
                wb = anchos[int(u1 * len(anchos)) % len(anchos)]
                if b == 0 and k % 2:
                    wb = max(4, wb // 2 + 2)          # medio bloque para trabar las hiladas
                if b == 0 and k in (0, len(alturas) - 1):
                    wb = max(wb, 6)                   # la piedra de la esquina sin redondear necesita cuerpo >= 5
                resto = x1 - x + 1
                if resto <= 8:
                    wb = resto                        # sin astillas al final de la hilada
                elif resto - wb < 4:
                    wb = resto // 2
                xa, xb = x, min(x + wb - 1, x1)       # xb = columna de mortero (o borde)
                base, luz = tono(k, b, u2)
                bx1 = xb - 1 if xb < x1 else x1
                by1 = yb - 1 if yb < y1 else y1
                if bx1 >= xa and by1 >= ya:
                    self.rect(xa, ya, bx1, by1, base)
                    self.hlinea(xa, bx1, ya, luz)
                    self.vlinea(xa, ya, by1, luz)
                    if redondeo and bx1 - xa >= 2 and by1 - ya >= 2:
                        for cx, cy in ((xa, ya), (bx1, ya), (xa, by1), (bx1, by1)):
                            if (cx, cy) not in esquinas_rect:
                                self.set(cx, cy, mortero)
                    n += 1
                if xb < x1:
                    self.vlinea(xb, ya, by1, mortero)
                x, b = xb + 1, b + 1
            if yb < y1:
                self.hlinea(x0, x1, yb, mortero)
            y, k = yb + 1, k + 1
        return n

    def caja(self, x0, y0, x1, y1, claro, base, oscuro, contorno, periodo=4, tapa=True):
        """V6: caja de madera vista de frente (incluido): contorno de 1 px, listones horizontales (fila
        clara + base + junta oscura, `periodo` filas), sombra de 1 px por dentro a la derecha y abajo;
        con `tapa`, la fila bajo el contorno superior es clara (canto superior iluminado)."""
        self.marco(x0, y0, x1, y1, contorno)
        for y in range(y0 + 1, y1):
            j = (y - y0 - 1) % periodo
            self.hlinea(x0 + 1, x1 - 1, y, claro if j == 0 else (oscuro if j == periodo - 1 else base))
        if tapa:
            self.hlinea(x0 + 1, x1 - 1, y0 + 1, claro)
        self.vlinea(x1 - 1, y0 + 1, y1 - 1, oscuro)
        self.hlinea(x0 + 1, x1 - 1, y1 - 1, oscuro)

    def pegar(self, x, y, bloque, saltar="."):
        """V6: estampa un bloque de texto (lista de cadenas o cadena con saltos de línea) con su esquina
        superior izquierda en (x, y); los caracteres `saltar` no se pintan."""
        filas = bloque.splitlines() if isinstance(bloque, str) else bloque
        for j, fila in enumerate(filas):
            for i, ch in enumerate(fila):
                if ch not in saltar:
                    self.set(x + i, y + j, ch)

    def festones(self, x0, x1, y_fondo, ancho, muescas, c):
        """Festones iguales en el borde inferior de una banda: desde x0, de `ancho` columnas cada uno,
        mientras quepan enteros hasta x1. `muescas` = píxeles que se quitan por lado en cada fila,
        contando desde y_fondo hacia arriba (p. ej. [2, 1]: última fila 2 por lado, penúltima 1); se
        pintan con `c` (la sombra de detrás). Devuelve el x siguiente al último festón."""
        x = x0
        while x + ancho - 1 <= x1:
            for k, m in enumerate(muescas):
                for d in range(m):
                    self.set(x + d, y_fondo - k, c)
                    self.set(x + ancho - 1 - d, y_fondo - k, c)
            x += ancho
        return x

    @staticmethod
    def abanico(costuras, y0, y1):
        """{y: [x, ...]}: para cada costura (x_arriba, x_abajo), su columna en cada fila entre y0 e y1
        (redondeo = tramos regulares de Bresenham). Para franjas en abanico (toldos)."""
        return {y: [xa + round((y - y0) * (xb - xa) / (y1 - y0)) for xa, xb in costuras] for y in range(y0, y1 + 1)}

    # ---------------------------------------------------------------- remate (regla 1 de pixel art)
    def _vecinos8(self, x, y, c):
        return [(dx, dy) for dy in (-1, 0, 1) for dx in (-1, 0, 1)
                if (dx or dy) and 0 <= x + dx < self.w and 0 <= y + dy < self.h and self.filas[y + dy][x + dx] == c]

    def huerfanos(self):
        """Píxeles opacos sin ningún 8-vecino de su color: [(x, y)]."""
        return [(x, y) for y in range(self.h) for x in range(self.w)
                if self.filas[y][x] != "." and not self._vecinos8(x, y, self.filas[y][x])]

    def dobles(self, brazo=3):
        """Esquinas en L de píxeles finos (el píxel de más de un escalón "doblado"), como
        pixel_clean.find_doubles: [(x, y, relleno)]. Las esquinas reales (ambos brazos >= brazo) se respetan."""
        out = []
        for y in range(self.h):
            for x in range(self.w):
                c = self.filas[y][x]
                if c == ".":
                    continue
                nb = self._vecinos8(x, y, c)
                if len(nb) != 2:
                    continue
                a, b = nb
                if abs(a[0]) + abs(a[1]) != 1 or abs(b[0]) + abs(b[1]) != 1 or a[0] == b[0] or a[1] == b[1]:
                    continue

                def largo(d):
                    n, xx, yy = 0, x + d[0], y + d[1]
                    while 0 <= xx < self.w and 0 <= yy < self.h and self.filas[yy][xx] == c:
                        n, xx, yy = n + 1, xx + d[0], yy + d[1]
                    return n
                if largo(a) >= brazo and largo(b) >= brazo:
                    continue
                fuera = []
                for dx, dy in ((-a[0], -a[1]), (-b[0], -b[1])):
                    xx, yy = x + dx, y + dy
                    fuera.append(self.filas[yy][xx] if 0 <= xx < self.w and 0 <= yy < self.h else ".")
                rel = max(set(fuera), key=fuera.count)
                if rel != c:
                    out.append((x, y, rel))
        return out

    def rematar(self, brazo=3, pasadas=20, proteger=None):
        """Quita huérfanos (toman el 4-vecino opaco más frecuente) y dobles (como pixel_clean --jaggy
        all --islands 1), iterando; `proteger(x, y) -> bool` deja píxeles intactos. Devuelve cambios."""
        total, tocados = 0, set()
        for _ in range(pasadas):
            cambios = 0
            for x, y in self.huerfanos():
                if proteger and proteger(x, y):
                    continue
                vec = [self.filas[y + dy][x + dx] for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))
                       if 0 <= x + dx < self.w and 0 <= y + dy < self.h and self.filas[y + dy][x + dx] != "."]
                if vec:
                    self.filas[y][x] = max(set(vec), key=vec.count)
                    cambios += 1
            hechos = set()
            for x, y, rel in self.dobles(brazo):
                if (x, y) in tocados or (proteger and proteger(x, y)):
                    continue
                if any((x + dx, y + dy) in hechos for dx in (-1, 0, 1) for dy in (-1, 0, 1)):
                    continue
                self.filas[y][x] = rel
                tocados.add((x, y))
                hechos.add((x, y))
                cambios += 1
            total += cambios
            if not cambios:
                break
        return total

    def diff(self, otro):
        """Número de píxeles distintos respecto a otro Mapa del mismo tamaño (o lista de filas)."""
        filas = otro.filas if hasattr(otro, "filas") else otro
        return sum(1 for y in range(self.h) for x in range(self.w) if self.filas[y][x] != filas[y][x])

    # ---------------------------------------------------------------- salida
    def escribir(self, ruta, comentario=None):
        cab = list(self.cabecera)
        if comentario:
            cab.append("; " + comentario)
        texto = "\n".join(cab + self.paleta + [""] + ["".join(r) for r in self.filas]) + "\n"
        Path(ruta).parent.mkdir(parents=True, exist_ok=True)
        Path(ruta).write_text(texto, encoding="utf-8")

    def volcar(self, x0=0, y0=0, x1=None, y1=None):
        """Texto numerado de una zona, para mirarlo."""
        x1 = self.w - 1 if x1 is None else x1
        y1 = self.h - 1 if y1 is None else y1
        return "\n".join(f"{y:3d} " + "".join(self.filas[y][x0:x1 + 1]) for y in range(y0, y1 + 1))
