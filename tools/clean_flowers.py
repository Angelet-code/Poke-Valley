"""Limpia las matas de flores recortadas (quita los defectos de JPG de la referencia).

Uso: python -I tools/clean_flowers.py <dir_flores> <dir_salida> [--denoise 0.35] [--seed 1]
         [--out-scale 2] [--sheet hoja.png]

1. Pone cada mata, ampliada x4, en una casilla de 256 px de una hoja 4x4 sobre un
   verde liso (así el fondo es conocido).
2. SDXL img2img repinta la hoja con poca fuerza: mismas matas, pintura limpia.
3. Cada casilla se separa del verde liso (alfa por proyección sobre la recta
   verde -> flor, como en cut_flowers.py) y se reduce a --out-scale x la
   resolución de la referencia.
Las matas originales no se tocan.

--method cel (por defecto) no usa SDXL (con poca fuerza deja la mancha blanda y con
más cambia las florecitas por flores grandes). Limpia los píxeles de la propia mata:
ampliada x4, alfa suavizado y cortado en 0.5 (borde nítido de cada florecita) y
color reducido a --tones tonos (sombra, medio, brillo) con los colores medios de la
mata, con transiciones de ~1 px. Quita el ruido de bloques del JPG.
"""
import argparse
import json
import subprocess
import sys
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage

BG = np.array([150, 182, 96], np.float32)
CELL, UP, COLS = 256, 4, 4
PROMPT = ("clusters of small round yellow-orange flowers seen from above on flat plain green background, "
          "clean painted 2d game art, soft cel shading, crisp, no noise")


def cel(f, o):
    """Mata limpia a partir de la recortada (RGBA a resolución de la referencia)."""
    size = (f.width * UP, f.height * UP)
    al = np.asarray(f.getchannel("A").resize(size, Image.BICUBIC), np.float32) / 255
    rgb = np.asarray(f.convert("RGB").resize(size, Image.BICUBIC), np.float32)
    al = ndimage.gaussian_filter(al, o.blur * UP)
    # Alfa: corte en o.cut, rampa de ~1 px de salida.
    A = np.clip((al - o.cut) / 0.12 + 0.5, 0, 1)
    solid = al > o.cut
    lum = rgb @ np.array([0.2126, 0.7152, 0.0722], np.float32)
    w = ndimage.binary_erosion(al > o.cut, iterations=UP).astype(np.float32)  # sin el borde, que mezcla con el fondo
    num = ndimage.gaussian_filter(lum * w, o.blur * UP)
    L = num / np.maximum(ndimage.gaussian_filter(w, o.blur * UP), 1e-4)
    qs = np.quantile(L[solid], np.linspace(0, 1, o.tones + 1)[1:-1])
    level = np.zeros_like(L)
    for q in qs:
        level += np.clip((L - q) / 2.5 + 0.5, 0, 1)        # transición suave pero corta
    hard = np.round(level).astype(int)
    cols = [rgb[solid & (hard == k)].mean(0) if (solid & (hard == k)).any() else rgb[solid].mean(0) for k in range(o.tones)]
    lo = np.clip(np.floor(level).astype(int), 0, o.tones - 1)
    hi = np.clip(lo + 1, 0, o.tones - 1)
    fr = (level - np.floor(level))[..., None]
    C = np.array(cols)
    col = C[lo] * (1 - fr) + C[hi] * fr
    im = Image.fromarray(np.dstack([col * A[..., None], A * 255]).clip(0, 255).astype(np.uint8), "RGBa")
    im = im.crop(im.getbbox())
    k = o.out_scale / UP
    return im.resize((max(1, round(im.width * k)), max(1, round(im.height * k))), Image.LANCZOS).convert("RGBA")


def main():
    a = argparse.ArgumentParser()
    a.add_argument("src")
    a.add_argument("out")
    a.add_argument("--denoise", type=float, default=0.35)
    a.add_argument("--seed", type=int, default=1)
    a.add_argument("--out-scale", type=float, default=2)
    a.add_argument("--gain", type=float, default=1.1)
    a.add_argument("--method", choices=["cel", "sdxl"], default="cel")
    a.add_argument("--tones", type=int, default=3)
    a.add_argument("--blur", type=float, default=0.6, help="suavizado (cel), px de la referencia")
    a.add_argument("--cut", type=float, default=0.45, help="corte del alfa (cel)")
    a.add_argument("--sheet")
    o = a.parse_args()
    src, out = Path(o.src), Path(o.out)
    n = json.loads((src / "flores.json").read_text())["count"]
    out.mkdir(parents=True, exist_ok=True)
    tmp = out / "_tmp"
    if o.method == "cel":
        for i in range(n):
            cel(Image.open(src / f"flor_{i}.png").convert("RGBA"), o).save(out / f"flor_{i}.png")
    else:
        tmp.mkdir(exist_ok=True)
    for page in range(-(-n // (COLS * COLS)) if o.method == "sdxl" else 0):
        ids = list(range(page * 16, min(n, page * 16 + 16)))
        sheet = Image.new("RGBA", (CELL * COLS, CELL * COLS), tuple(int(v) for v in BG) + (255,))
        for j, i in enumerate(ids):
            f = Image.open(src / f"flor_{i}.png").convert("RGBA")
            f = f.resize((f.width * UP, f.height * UP), Image.LANCZOS)
            sheet.alpha_composite(f, ((j % COLS) * CELL + (CELL - f.width) // 2, (j // COLS) * CELL + (CELL - f.height) // 2))
        init = tmp / f"init_{page}.png"
        sheet.convert("RGB").save(init)
        prefix = tmp / f"limpia_{page}"
        subprocess.run([sys.executable, "-I", str(Path(__file__).parent / "comfy.py"), PROMPT, "--init", str(init),
                        "--denoise", str(o.denoise), "--seed", str(o.seed), "--out", str(prefix)], check=True)
        rgb = np.asarray(Image.open(f"{prefix}_0.png").convert("RGB"), np.float32)
        # El repintado puede mover un poco el verde del fondo: se mide en las esquinas de cada casilla.
        for j, i in enumerate(ids):
            y0, x0 = (j // COLS) * CELL, (j % COLS) * CELL
            c = rgb[y0:y0 + CELL, x0:x0 + CELL]
            corners = np.concatenate([c[:12, :12].reshape(-1, 3), c[:12, -12:].reshape(-1, 3),
                                      c[-12:, :12].reshape(-1, 3), c[-12:, -12:].reshape(-1, 3)])
            G = np.median(corners, 0)
            r, g, b = c[..., 0], c[..., 1], c[..., 2]
            fl = (r > 190) & (b < 120) & (r - g > 20)
            F = c[fl].mean(0) if fl.sum() > 50 else np.array([225, 175, 75], np.float32)
            d = F - G
            t = ((c - G) * d).sum(-1) / max(float((d * d).sum()), 1)
            al = np.clip(t * o.gain, 0, 1)
            # Solo cerca de las flores (fuera, ruido del repintado sobre el verde).
            near = ndimage.gaussian_filter(ndimage.binary_dilation(fl, iterations=6).astype(np.float32), 3)
            al *= np.clip(near * 1.5, 0, 1)
            al[al < 0.06] = 0
            col = np.clip(G + (c - G) / np.maximum(t, 0.3)[..., None], 0, 255)
            im = Image.fromarray(np.dstack([col * al[..., None], al * 255]).astype(np.uint8), "RGBa")
            im = im.crop(im.getbbox())
            k = o.out_scale / UP
            im = im.resize((max(1, round(im.width * k)), max(1, round(im.height * k))), Image.LANCZOS).convert("RGBA")
            im.save(out / f"flor_{i}.png")
    (out / "flores.json").write_text(json.dumps({"count": n, "scale": o.out_scale}))
    print(n, "matas limpias en", out)
    if o.sheet:
        ims = [Image.open(out / f"flor_{i}.png") for i in range(n)]
        cw, ch = max(t.width for t in ims) + 6, max(t.height for t in ims) + 6
        sh = Image.new("RGBA", (8 * cw, -(-n // 8) * ch), (150, 185, 95, 255))
        for i, t in enumerate(ims):
            sh.alpha_composite(t, ((i % 8) * cw + 3, (i // 8) * ch + 3))
        sh.resize((sh.width * 2, sh.height * 2), Image.LANCZOS).save(o.sheet)


if __name__ == "__main__":
    main()
