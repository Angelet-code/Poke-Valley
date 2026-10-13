"""Recorta matorrales (matas de hojas verdes) de una imagen generada sobre arena lisa.

Uso: python -I tools/cut_bushes.py <gen.png> [<gen2.png> ...] <salida_dir> [--scale .25] [--px .5]
         [--min 4000] [--sheet hoja.png]

1. Fondo = color de arena (mediana de lo que no es verde).
2. Cada píxel se separa del fondo: su posición en la recta arena -> verde medio de las hojas
   es el alfa, y quitando la arena queda el color propio (como tools/cut_flowers.py).
3. Cada mata = componente conexa; fuera las que tocan el borde o son pequeñas.
4. --tint: se recolorea al color medio dado (el de las matas de la referencia).
5. Se reduce por --scale (generar grande y reducir mucho deja la pintura nítida).
Salida: <salida_dir>/mata_N.png (RGBA) + matas.json {count, scale: px de la referencia por px}.
"""
import argparse
import json
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage


def cut(path, o):
    rgb = np.asarray(Image.open(path).convert("RGB"), np.float32)
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    green = g > r + 12
    B = np.median(rgb[~ndimage.binary_dilation(green, iterations=8)], 0)
    F = rgb[ndimage.binary_erosion(green, iterations=4)].mean(0)
    d = F - B
    t = ((rgb - B) * d).sum(-1) / max(float((d * d).sum()), 1)
    alpha = np.clip(t * o.gain, 0, 1)
    color = np.clip(B + (rgb - B) / np.maximum(t, .3)[..., None], 0, 255)
    solid = ndimage.binary_fill_holes(ndimage.binary_opening(alpha > .5, iterations=2))
    lab, n = ndimage.label(solid)
    out = []
    for k, sl in enumerate(ndimage.find_objects(lab), 1):
        m = lab[sl] == k
        if m.sum() < o.min or sl[0].start == 0 or sl[1].start == 0 or sl[0].stop == rgb.shape[0] or sl[1].stop == rgb.shape[1]:
            continue
        pad = 8
        y0, x0 = max(0, sl[0].start - pad), max(0, sl[1].start - pad)
        y1, x1 = min(rgb.shape[0], sl[0].stop + pad), min(rgb.shape[1], sl[1].stop + pad)
        zone = ndimage.binary_dilation(lab[y0:y1, x0:x1] == k, iterations=4)
        al = alpha[y0:y1, x0:x1] * ndimage.gaussian_filter(zone.astype(np.float32), 1.5)
        al[al < .06] = 0
        im = Image.fromarray(np.dstack([color[y0:y1, x0:x1] * al[..., None], al * 255]).astype(np.uint8), "RGBa")
        if o.tint:
            # Color medio de la mata -> --tint (el de la referencia), relieve x --contrast.
            T = np.array([float(v) for v in o.tint.split(",")])
            col = color[y0:y1, x0:x1]
            sel = al > .6
            mean = col[sel].mean(0)
            col = np.clip(T + (col - mean) * o.contrast, 0, 255)
            im = Image.fromarray(np.dstack([col * al[..., None], al * 255]).astype(np.uint8), "RGBa")
        im = im.crop(im.getbbox())
        im = im.resize((max(1, round(im.width * o.scale)), max(1, round(im.height * o.scale))), Image.LANCZOS).convert("RGBA")
        out.append(im)
    print(path, n, "manchas,", len(out), "matas")
    return out


def main():
    a = argparse.ArgumentParser()
    a.add_argument("files", nargs="+")
    a.add_argument("--scale", type=float, default=.25)
    a.add_argument("--px", type=float, default=.5)
    a.add_argument("--min", type=int, default=4000)
    a.add_argument("--gain", type=float, default=1.1)
    a.add_argument("--tint", help="color medio de destino, R,G,B")
    a.add_argument("--contrast", type=float, default=1)
    a.add_argument("--sheet")
    o = a.parse_args()
    *srcs, dst = o.files
    dst = Path(dst)
    dst.mkdir(parents=True, exist_ok=True)
    keep = []
    for s in srcs:
        keep += cut(s, o)
    for i, im in enumerate(keep):
        im.save(dst / f"mata_{i}.png")
    (dst / "matas.json").write_text(json.dumps({"count": len(keep), "scale": o.px}))
    print(len(keep), "matas en", dst)
    if o.sheet and keep:
        cw, ch = max(t.width for t in keep) + 6, max(t.height for t in keep) + 6
        sh = Image.new("RGBA", (8 * cw, -(-len(keep) // 8) * ch), (150, 182, 96, 255))
        for i, t in enumerate(keep):
            sh.alpha_composite(t, ((i % 8) * cw + 3, (i // 8) * ch + 3))
        sh.resize((sh.width * 3, sh.height * 3), Image.LANCZOS).save(o.sheet)


if __name__ == "__main__":
    main()
