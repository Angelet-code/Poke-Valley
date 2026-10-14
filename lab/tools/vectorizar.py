"""Vectoriza un elemento (PNG con alfa de lab/assets/elementos/) a SVG con vtracer.

Uso: python -I lab/tools/vectorizar.py casa_grande [--precision 6] [--capa 16] [--mota 4] [--sufijo p6]
     python -I lab/tools/vectorizar.py --todos          (todos los elementos grandes, ajuste por defecto)

vtracer (Rust, local): agrupa los pixeles por color (2^precision niveles por canal), apila las capas
(hierarchical=stacked) y traza cada zona con curvas (mode=spline). Los degradados suaves quedan en
bandas de color; con precision 6-7 y capa 8-16 pasan casi desapercibidas en este dibujo plano.
El fondo transparente del PNG se queda fuera del SVG.
Salida: lab/assets/vector/<id>[_<sufijo>].svg (mismo tamano en px que el PNG, viewBox = PNG).
"""
import argparse
import json
import re
import time
from pathlib import Path

import numpy as np
import vtracer
from PIL import Image

RAIZ = Path(__file__).resolve().parents[1]
ELEM = RAIZ / "assets/elementos"
OUT = RAIZ / "assets/vector"
GRANDES = ("casa", "arbol", "roca", "estanque", "piedras")


def vectorizar(nombre, precision=6, capa=16, mota=4, sufijo=""):
    src = ELEM / f"{nombre}.png"
    dst = OUT / f"{nombre}{('_' + sufijo) if sufijo else ''}.svg"
    OUT.mkdir(parents=True, exist_ok=True)
    t0 = time.time()
    # Argumentos posicionales: con nombre, vtracer 0.6.15 revienta en Python 3.14 (violacion de acceso).
    # Orden: colormode, hierarchical, mode, filter_speckle, color_precision, layer_difference,
    # corner_threshold, length_threshold, max_iterations, splice_threshold, path_precision.
    # Alfa a todo o nada: vtracer toma el color RGB de los pixeles semitransparentes del borde (mezclas
    # raras del desmezclado) y los convierte en trazados opacos (filo rosado). El antialias lo pone el
    # navegador al rasterizar el vector.
    a = np.asarray(Image.open(src).convert("RGBA")).copy()
    solido = a[..., 3] >= 128
    a[~solido] = 0
    a[solido, 3] = 255
    tmp = OUT / f"_{nombre}_solido.png"
    Image.fromarray(a).save(tmp)
    src = tmp
    vtracer.convert_image_to_svg_py(str(src), str(dst), "color", "stacked", "spline", mota, precision, capa, 60, 4.0, 10, 45, 2)
    tmp.unlink(missing_ok=True)
    svg = dst.read_text(encoding="utf-8")
    n = svg.count("<path")
    print(f"{dst.name}: {n} trazados, {dst.stat().st_size // 1024} KB, {time.time() - t0:.1f} s")
    return dst


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("nombre", nargs="?")
    ap.add_argument("--todos", action="store_true")
    ap.add_argument("--precision", type=int, default=7)   # p7: 128 niveles por canal, capas de 8: casi sin bandas
    ap.add_argument("--capa", type=int, default=8)
    ap.add_argument("--mota", type=int, default=4)
    ap.add_argument("--sufijo", default="")
    o = ap.parse_args()
    if o.todos:
        cat = json.loads((ELEM / "elementos.json").read_text(encoding="utf-8"))
        hechos = []
        for e in cat["elementos"]:
            if e["tipo"] in GRANDES:
                vectorizar(e["id"], o.precision, o.capa, o.mota, o.sufijo)
                hechos.append(e["id"])
        if not o.sufijo:
            # Lista de los que tienen vector (la lee el lab con ?vector=1).
            (OUT / "vector.json").write_text(json.dumps(hechos), encoding="utf-8")
            print("vector.json:", len(hechos), "elementos")
    elif o.nombre:
        vectorizar(o.nombre, o.precision, o.capa, o.mota, o.sufijo)
    else:
        ap.error("nombre o --todos")


if __name__ == "__main__":
    main()
