"""Convierte un PNG de pixel art (colores planos, pocos colores) en un mapa de píxeles de texto
editable con el formato de `pixel_build.py` (paleta `c=#rrggbb` + línea en blanco + filas).

Uso:
  python -I tools/png_to_txt.py entrada.png salida.txt [--max-colors 64]

- Transparente (alfa < 128) -> '.'; alfa parcial se escribe como #rrggbbaa.
- Los caracteres de paleta se asignan por luminancia creciente (0-9, a-z, A-Z y signos), así
  los oscuros son dígitos y los claros mayúsculas: se ve la forma al leer el texto.
- Escribe un comentario de cabecera con el origen y el tamaño. Luego:
  python -I tools/pixel_build.py salida.txt --out carpeta   reconstruye el PNG idéntico.
"""
import argparse
from collections import Counter
from pathlib import Path

import numpy as np
from PIL import Image

CHARS = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ!$%&*+-/:<>?@^_|~"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("src")
    ap.add_argument("dst")
    ap.add_argument("--max-colors", type=int, default=len(CHARS))
    a = ap.parse_args()

    im = Image.open(a.src).convert("RGBA")
    arr = np.array(im)
    h, w = arr.shape[:2]
    opaque = arr[..., 3] >= 128
    cols = Counter(tuple(int(v) for v in arr[y, x]) for y, x in zip(*np.nonzero(opaque)))
    if len(cols) > a.max_colors:
        raise SystemExit(f"{len(cols)} colores: demasiados para el formato (máx {a.max_colors}); cuantiza antes")
    orden = sorted(cols, key=lambda c: (c[0] * 0.299 + c[1] * 0.587 + c[2] * 0.114, c))
    ch = {c: CHARS[i] for i, c in enumerate(orden)}

    lines = [f"; {Path(a.src).as_posix()} -> {w}x{h}, {len(orden)} colores (generado por tools/png_to_txt.py)",
             "; caracteres ordenados por luminancia: dígitos = oscuros, mayúsculas = claros"]
    for c in orden:
        hexc = "#%02x%02x%02x" % c[:3] + ("" if c[3] == 255 else "%02x" % c[3])
        lines.append(f"{ch[c]}={hexc}")
    lines.append("")
    for y in range(h):
        lines.append("".join(ch[tuple(int(v) for v in arr[y, x])] if opaque[y, x] else "." for x in range(w)))
    Path(a.dst).parent.mkdir(parents=True, exist_ok=True)
    Path(a.dst).write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(f"{a.dst}: {w}x{h}, {len(orden)} colores")


if __name__ == "__main__":
    main()
