"""Recorta las matas de flores amarillas de la imagen de referencia.

Uso: python -I tools/cut_flowers.py <ref.png> [<ref2.png> ...] <salida_dir> [--min 150]
         [--scale 1] [--px 1] [--sheet hoja.png]

1. Flor = píxel amarillo-anaranjado. Las flores cercanas se agrupan en matas.
2. Solo se guardan las matas rodeadas de césped (fuera de caminos, rocas y agua).
3. Cada píxel se separa del césped que tiene debajo: el color local del césped
   (media de lo que no es flor alrededor) y el de la flor definen una recta;
   la posición del píxel en ella es su alfa y, quitando el césped, queda el
   color propio de la flor. Así la mata se puede poner sobre cualquier césped
   sin arrastrar un recuadro del fondo de la referencia.
Salida: <salida_dir>/flor_N.png (RGBA) + flores.json. --scale reduce cada mata
(para imágenes generadas a mayor tamaño: reducir mucho deja la pintura nítida);
flores.json guarda "scale" = px de la imagen por px de la referencia.
"""
import argparse
import json
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage


def main():
    a = argparse.ArgumentParser()
    a.add_argument("refs", nargs="+")
    a.add_argument("--px", type=float, default=1, help="px de la referencia por px de salida guardado en flores.json")
    a.add_argument("--min", type=int, default=150, help="píxeles de flor mínimos por mata")
    a.add_argument("--group", type=int, default=4, help="distancia para unir flores en una mata, px")
    a.add_argument("--gain", type=float, default=1.15, help="refuerzo del alfa (flores más macizas)")
    a.add_argument("--scale", type=float, default=1)
    a.add_argument("--sheet")
    o = a.parse_args()
    *refs, out = o.refs
    out = Path(out)
    out.mkdir(parents=True, exist_ok=True)
    keep = []
    for ref in refs:
        keep += cut(ref, o)
    for i, im in enumerate(keep):
        im.save(out / f"flor_{i}.png")
    (out / "flores.json").write_text(json.dumps({"count": len(keep), "scale": o.px}))
    print(len(keep), "matas guardadas en", out)
    if o.sheet and keep:
        cols = 8
        cw, ch = max(t.width for t in keep) + 4, max(t.height for t in keep) + 4
        sh = Image.new("RGBA", (cols * cw, -(-len(keep) // cols) * ch), (150, 185, 95, 255))
        for i, t in enumerate(keep):
            sh.alpha_composite(t, ((i % cols) * cw + 2, (i // cols) * ch + 2))
        sh.resize((sh.width * 3, sh.height * 3), Image.LANCZOS).save(o.sheet)


def cut(ref, o):
    rgb = np.asarray(Image.open(ref).convert("RGB"), np.float32)
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    flower = (r > 200) & (g > 130) & (g < 215) & (b < 110) & (r - g > 25)
    grass = (g > r + 8) & (g > b + 40) & (g > 120)
    F = rgb[flower].mean(0)

    # Césped local: media de los píxeles de césped alrededor.
    w = grass.astype(np.float32)
    num = np.stack([ndimage.gaussian_filter(rgb[..., c] * w, 6) for c in range(3)], -1)
    den = ndimage.gaussian_filter(w, 6)[..., None]
    G = num / np.maximum(den, 1e-4)
    G = np.where(den > 1e-3, G, rgb[grass].mean(0))
    d = F - G
    t = ((rgb - G) * d).sum(-1) / np.maximum((d * d).sum(-1), 1)
    alpha = np.clip(t * o.gain, 0, 1)
    color = np.clip(G + (rgb - G) / np.maximum(t, 0.25)[..., None], 0, 255)

    lab, n = ndimage.label(ndimage.binary_dilation(flower, iterations=o.group))
    ok_ground = ndimage.binary_dilation(grass | flower, iterations=2)
    keep = []
    for k, sl in enumerate(ndimage.find_objects(lab), 1):
        m = lab[sl] == k
        if (flower[sl] & m).sum() < o.min:
            continue
        if sl[0].start == 0 or sl[1].start == 0 or sl[0].stop == rgb.shape[0] or sl[1].stop == rgb.shape[1]:
            continue  # cortada por el borde de la imagen
        pad = 6
        y0, x0 = max(0, sl[0].start - pad), max(0, sl[1].start - pad)
        y1, x1 = min(rgb.shape[0], sl[0].stop + pad), min(rgb.shape[1], sl[1].stop + pad)
        zone = ndimage.binary_dilation(lab[y0:y1, x0:x1] == k, iterations=3)
        ring = ndimage.binary_dilation(zone, iterations=4) & ~zone
        if ok_ground[y0:y1, x0:x1][ring].mean() < 0.9:  # mata pegada a camino, roca o agua
            continue
        al = alpha[y0:y1, x0:x1] * ndimage.gaussian_filter(zone.astype(np.float32), 1)
        al[al < 0.08] = 0
        im = Image.fromarray(np.dstack([color[y0:y1, x0:x1], al * 255]).astype(np.uint8), "RGBA")
        im = im.crop(im.getbbox())
        if o.scale != 1:
            im = im.convert("RGBa").resize((max(1, round(im.width * o.scale)), max(1, round(im.height * o.scale))),
                                           Image.LANCZOS).convert("RGBA")
        keep.append(im)
    print(ref, n, "matas,", len(keep), "válidas")
    return keep


if __name__ == "__main__":
    main()
