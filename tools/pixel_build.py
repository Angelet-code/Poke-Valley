"""
pixel_build.py: convierte mapas de píxeles en texto (editables a mano) a PNG.

Formato del archivo fuente (`.txt`):

    ; comentario (las líneas que empiezan por ';' se ignoran)
    o=#4a2c18          <- una entrada de paleta por línea: <carácter>=#rrggbb
    m=#94602f             (también se admite #rrggbbaa para píxeles semitransparentes)
    s=#2c442280
                       <- línea en blanco: separa la paleta de los píxeles
    ....oo....         <- filas de caracteres; '.' = transparente
    ...ommo...            todas las filas deben tener la misma anchura
    ....oo....

Cada carácter de la rejilla es un píxel de la imagen: 1 píxel de imagen = 1 píxel de mundo
(misma escala que los sprites PMD, casilla de 24×24). El PNG resultante tiene exactamente el
tamaño de la rejilla (RGBA) y no se reescala: el juego lo amplía con zoom entero y filtro
"nearest", así que cada píxel debe estar puesto a propósito.

Uso:
    python -I tools/pixel_build.py <fuente.txt | carpeta> [...] [--out carpeta] [--preview N]
                                   [--sheet ruta.png] [--zoom N] [--bg r,g,b]

  (se pueden pasar varios archivos o carpetas; todos van a la misma carpeta --out)

  --out      carpeta de salida (por defecto, la misma del .txt). Escribe <nombre>.png.
  --preview  además escribe <nombre>_xN.png ampliado ×N con "nearest", para revisar.
  --sheet    compone todos los sprites construidos en una hoja de revisión (×--zoom, sobre
             el color --bg, por defecto el verde del césped del juego 150,176,95).

Errores claros: filas de distinta anchura, caracteres sin paleta, paleta mal formada.

Construcción de los sprites del juego (fuentes en assets/gen/pixel/src/):
    python -I tools/pixel_build.py assets/gen/pixel/src/items --out assets/game/pixel/items
    python -I tools/pixel_build.py assets/gen/pixel/src/estaciones --out assets/game/pixel/estaciones
    python -I tools/pixel_build.py assets/gen/pixel/src/items assets/gen/pixel/src/estaciones         --out assets/gen/pixel/build --preview 8 --sheet assets/gen/pixel/preview_items.png
"""

import argparse
import sys
from pathlib import Path

from PIL import Image, ImageDraw


class ErrorFuente(Exception):
    """Error de formato en un archivo fuente, con archivo y línea."""


def parsear_color(texto, archivo, n_linea):
    """Convierte '#rrggbb' o '#rrggbbaa' en una tupla RGBA."""
    t = texto.strip().lower()
    if not t.startswith("#") or len(t) not in (7, 9):
        raise ErrorFuente(f"{archivo}:{n_linea}: color inválido {texto!r} (esperado #rrggbb o #rrggbbaa)")
    try:
        valores = [int(t[i:i + 2], 16) for i in range(1, len(t), 2)]
    except ValueError:
        raise ErrorFuente(f"{archivo}:{n_linea}: color inválido {texto!r}")
    if len(valores) == 3:
        valores.append(255)
    return tuple(valores)


def leer_fuente(ruta):
    """Lee un .txt y devuelve (paleta, filas). Lanza ErrorFuente si algo no cuadra."""
    ruta = Path(ruta)
    lineas = ruta.read_text(encoding="utf-8").splitlines()
    paleta = {".": (0, 0, 0, 0)}
    filas = []
    en_paleta = True
    for i, linea in enumerate(lineas, start=1):
        if linea.startswith(";"):
            continue
        if en_paleta:
            if linea.strip() == "":
                if len(paleta) > 1:
                    en_paleta = False
                continue
            if "=" not in linea or len(linea.split("=", 1)[0].strip()) != 1:
                raise ErrorFuente(f"{ruta}:{i}: entrada de paleta mal formada {linea!r} (esperado <carácter>=#rrggbb)")
            clave, color = linea.split("=", 1)
            clave = clave.strip()
            if clave == ".":
                raise ErrorFuente(f"{ruta}:{i}: el carácter '.' está reservado para transparente")
            if clave in paleta:
                raise ErrorFuente(f"{ruta}:{i}: el carácter {clave!r} está repetido en la paleta")
            paleta[clave] = parsear_color(color, ruta, i)
        else:
            if linea.strip() == "":
                continue  # líneas en blanco entre filas se ignoran (fin de archivo, etc.)
            fila = linea.rstrip("\r\n")
            for col, ch in enumerate(fila):
                if ch not in paleta:
                    raise ErrorFuente(f"{ruta}:{i}: carácter {ch!r} sin paleta (columna {col + 1})")
            filas.append(fila)
    if not filas:
        raise ErrorFuente(f"{ruta}: no hay filas de píxeles (falta la línea en blanco tras la paleta?)")
    ancho = len(filas[0])
    for k, fila in enumerate(filas):
        if len(fila) != ancho:
            raise ErrorFuente(f"{ruta}: la fila {k + 1} mide {len(fila)} y la primera {ancho}; todas deben medir igual")
    return paleta, filas


def construir(ruta):
    """Devuelve la imagen RGBA de un .txt."""
    paleta, filas = leer_fuente(ruta)
    im = Image.new("RGBA", (len(filas[0]), len(filas)), (0, 0, 0, 0))
    px = im.load()
    for y, fila in enumerate(filas):
        for x, ch in enumerate(fila):
            px[x, y] = paleta[ch]
    return im


def hoja(imagenes, zoom, bg, ruta):
    """Compone una hoja de revisión: sprites ampliados ×zoom sobre fondo bg, con su nombre."""
    margen = 6 * zoom
    sep = 4 * zoom
    filas, fila, ancho_fila, alto_fila = [], [], 0, 0
    max_ancho = 160 * zoom
    for nombre, im in imagenes:
        w, h = im.width * zoom, im.height * zoom
        if fila and ancho_fila + w + sep > max_ancho:
            filas.append((fila, alto_fila))
            fila, ancho_fila, alto_fila = [], 0, 0
        fila.append((nombre, im))
        ancho_fila += w + sep
        alto_fila = max(alto_fila, h)
    if fila:
        filas.append((fila, alto_fila))
    ancho_total = max(sum(im.width * zoom + sep for _, im in f) for f, _ in filas) + margen * 2
    alto_total = sum(h + 14 + sep for _, h in filas) + margen * 2
    out = Image.new("RGBA", (ancho_total, alto_total), bg + (255,))
    d = ImageDraw.Draw(out)
    y = margen
    for f, h in filas:
        x = margen
        for nombre, im in f:
            grande = im.resize((im.width * zoom, im.height * zoom), Image.NEAREST)
            out.alpha_composite(grande, (x, y))
            d.text((x, y + h + 2), nombre, fill=(40, 50, 30, 255))
            x += grande.width + sep
        y += h + 14 + sep
    out.save(ruta)


def main():
    ap = argparse.ArgumentParser(description="Convierte mapas de píxeles en texto a PNG.")
    ap.add_argument("fuente", nargs="+", help="archivos .txt o carpetas con .txt")
    ap.add_argument("--out", help="carpeta de salida (por defecto la del .txt)")
    ap.add_argument("--preview", type=int, default=0, metavar="N", help="escribe también <nombre>_xN.png ampliado ×N")
    ap.add_argument("--sheet", help="ruta de la hoja de revisión con todos los sprites")
    ap.add_argument("--zoom", type=int, default=6, help="ampliación de la hoja (por defecto 6)")
    ap.add_argument("--bg", default="150,176,95", help="color de fondo de la hoja r,g,b (por defecto césped)")
    args = ap.parse_args()

    fuentes = []
    for f in args.fuente:
        origen = Path(f)
        fuentes += sorted(origen.glob("*.txt")) if origen.is_dir() else [origen]
    if not fuentes:
        sys.exit(f"No hay archivos .txt en {args.fuente}")
    salida = Path(args.out) if args.out else None
    if salida:
        salida.mkdir(parents=True, exist_ok=True)

    hechas = []
    for f in fuentes:
        try:
            im = construir(f)
        except ErrorFuente as e:
            sys.exit(f"ERROR: {e}")
        carpeta = salida or f.parent
        destino = carpeta / (f.stem + ".png")
        im.save(destino)
        print(f"{destino}  {im.width}x{im.height}")
        if args.preview > 1:
            n = args.preview
            im.resize((im.width * n, im.height * n), Image.NEAREST).save(carpeta / f"{f.stem}_x{n}.png")
        hechas.append((f.stem, im))

    if args.sheet:
        bg = tuple(int(v) for v in args.bg.split(","))
        Path(args.sheet).parent.mkdir(parents=True, exist_ok=True)
        hoja(hechas, args.zoom, bg, args.sheet)
        print(f"hoja: {args.sheet}")


if __name__ == "__main__":
    main()
