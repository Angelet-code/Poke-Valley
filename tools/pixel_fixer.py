"""Reduce una imagen "pixel art" de IA a píxeles reales con pixel-art-fixer (Retro Diffusion, MIT,
clonado en tools/ext/pixel-art-fixer/) y luego quita el fondo liso (magenta) a escala nativa.

Uso:
  python -I tools/pixel_fixer.py entrada.png salida.png [--mode full|fast] [--step 0] [--k 0]
      [--bg auto|R,G,B|none] [--bg-tol 70] [--largest] [--preview salida_x6.png] [--zoom 6]
      [--grass 150,176,95] [--legacy] [--colors 0] [--despeckle 0]

Por qué un envoltorio: el `python -m pixelfixer.cli` del repo importa un paquete `detector` que no
existe (nombre antiguo), así que aquí se usa la API (`pixelfixer.api.process`) directamente.
  1. detect(): tres detectores de rejilla votan (autocorrelación, longitudes de tramo, autosimilitud);
     si no hay acuerdo arbitra una pila de evidencias. Devuelve step_x/step_y (puede ser no entero),
     cols/rows y `consensus` (fast:... = confianza alta). `--step N` fuerza el paso (sin fase).
  2. two_stage_pack(): rejilla uniforme (x*cols/w, sin fase), estructura por voto de etiquetas
     k-means (--k colores, 0 = adaptativo 16..48) y color = media de los píxeles originales de la
     etiqueta ganadora. `--legacy` usa el reconstructor antiguo (cortes ajustados + moda).
  3. Fondo: a escala nativa se quita el color --bg (auto = mediana de las esquinas) por distancia
     (--bg-tol) y, con --largest, solo queda la mancha conexa mayor; recorte a la silueta.
  4. `--colors N` (opcional): cuantiza sin tramado a N colores (MEDIANCUT, como pixel_grid.py) para
     comparar en igualdad de condiciones; sin él se conservan los colores medios del fixer (miles).
  5. `--despeckle N`: la misma limpieza de silueta y de píxeles sueltos (sin vecino de su color) que
     aplica pixel_grid.py (funciones de pixel_sprite.py), para medir ambos en igualdad de condiciones.
Imprime paso, celdas, consenso, tamaño del sprite y colores, y guarda una previsualización ×zoom
sobre césped.
"""
import argparse
import sys
import time
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE / "ext" / "pixel-art-fixer" / "python"))
from pixelfixer.api import process  # noqa: E402

sys.path.insert(0, str(HERE))
from pixel_sprite import clean_silhouette, despeckle  # noqa: E402


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("src")
    ap.add_argument("dst")
    ap.add_argument("--mode", choices=["full", "fast"], default="full")
    ap.add_argument("--step", type=float, default=0, help="forzar paso de rejilla (0 = detectar)")
    ap.add_argument("--k", type=int, default=0, help="colores k-means para la estructura (0 = adaptativo)")
    ap.add_argument("--bg", default="auto")
    ap.add_argument("--bg-tol", type=float, default=70)
    ap.add_argument("--largest", action="store_true")
    ap.add_argument("--legacy", action="store_true")
    ap.add_argument("--colors", type=int, default=0, help="cuantizar sin tramado a N colores (0 = no)")
    ap.add_argument("--despeckle", type=int, default=0, help="pasadas de limpieza de píxeles sueltos (como pixel_grid.py)")
    ap.add_argument("--preview")
    ap.add_argument("--zoom", type=int, default=6)
    ap.add_argument("--grass", default="150,176,95")
    a = ap.parse_args()

    rgba = np.array(Image.open(a.src).convert("RGBA"))
    t0 = time.time()
    r = process(rgba, mode=a.mode, two_stage=not a.legacy, k_colors=a.k,
                force_step=a.step or None, return_png=False)
    low = r["array"]
    print(f"pixelfixer: paso x={r['step_x']:.3f} y={r['step_y']:.3f}  celdas {r['cols']}x{r['rows']}  "
          f"consenso={r['consensus']} ({r['confidence']})  {time.time() - t0:.1f}s")

    rgb = low[..., :3]
    mask = low[..., 3] > 127 if low.shape[2] == 4 else np.ones(rgb.shape[:2], bool)
    if a.bg != "none":
        if a.bg == "auto":
            h, w = rgb.shape[:2]
            bg = np.median(np.stack([rgb[1, 1], rgb[1, w - 2], rgb[h - 2, 1], rgb[h - 2, w - 2]]).astype(np.float32), 0)
        else:
            bg = np.array([float(v) for v in a.bg.split(",")], np.float32)
        d = np.sqrt(((rgb.astype(np.float32) - bg) ** 2).sum(-1))
        mask &= d > a.bg_tol
    if a.largest:
        lab, n = ndimage.label(mask)
        if n > 1:
            sizes = ndimage.sum(mask, lab, range(1, n + 1))
            mask = lab == (1 + int(np.argmax(sizes)))
    if not mask.any():
        raise SystemExit("no queda nada tras quitar el fondo")
    ys, xs = np.nonzero(mask)
    y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
    rgb, mask = rgb[y0:y1, x0:x1].copy(), mask[y0:y1, x0:x1]
    if a.colors:
        fill = tuple(int(v) for v in np.median(rgb[mask], 0))
        tmp = rgb.copy(); tmp[~mask] = fill
        q = Image.fromarray(tmp, "RGB").quantize(colors=a.colors, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)
        rgb = np.array(q.convert("RGB"))
    if a.despeckle:
        rgb, mask = clean_silhouette(rgb, mask)
        rgb = despeckle(rgb, mask, a.despeckle)
    out = np.dstack([rgb, (mask * 255).astype(np.uint8)])
    res = Image.fromarray(out, "RGBA")
    dst = Path(a.dst)
    dst.parent.mkdir(parents=True, exist_ok=True)
    res.save(dst)

    prev = Path(a.preview) if a.preview else dst.with_name(dst.stem + f"_x{a.zoom}.png")
    grass = tuple(int(v) for v in a.grass.split(","))
    big = res.resize((res.width * a.zoom, res.height * a.zoom), Image.Resampling.NEAREST)
    bgim = Image.new("RGBA", (big.width + 12 * a.zoom, big.height + 12 * a.zoom), grass + (255,))
    bgim.alpha_composite(big, (6 * a.zoom, 6 * a.zoom))
    bgim.save(prev)
    ncol = len(set(map(tuple, rgb[mask])))
    print(f"{dst} {res.width}x{res.height}  colores={ncol}  preview={prev}")


if __name__ == "__main__":
    main()
