"""Matorrales: matas de hojas redondas que se superponen, cada una con su sombra abajo.

Uso: python -I tools/make_bushes.py <salida_dir> [--n 10] [--seed 1] [--px .5] [--sheet hoja.png]

Como las matas de la referencia (assets/gen/prueba1_1.png, junto a las flores del centro):
- Hoja = círculo de color liso (tonos medidos en la referencia), algo más claro arriba.
- Sombra = el mismo círculo bajado y algo mayor, más oscuro: asoma por debajo de cada hoja
  como un creciente grueso.
- Las hojas van en grupos irregulares de 2-3, con separación mínima entre centros (--pack); varios grupos se superponen para formar la mata.
  Se dibujan de atrás (arriba) adelante (abajo), así cada hoja tapa la parte de abajo de la de
  detrás y su sombra cae sobre ella.
Se dibuja x4 y se reduce (bordes nítidos con antialias). Radios en px de la referencia; la
imagen se guarda a 1/--px de la referencia (px = píxeles de la referencia por píxel).
"""
import argparse
import json
from pathlib import Path

import numpy as np
from PIL import Image

LEAF = [(124, 168, 72), (132, 174, 78), (118, 162, 70)]   # tonos de hoja (referencia)
LIGHT = (156, 190, 96)                                    # brillo de arriba
SHADOW = (72, 112, 50)                                    # sombra


def bush(rng, o):
    F = 4
    k = F / o.px                                          # px de dibujo por px de la referencia
    leaves = []
    groups = rng.integers(o.groups[0], o.groups[1] + 1)
    cx = cy = 0.0
    for gi in range(groups):
        # Cada grupo cerca de los anteriores, repartidos más a lo ancho que a lo alto.
        if gi:
            ang = rng.uniform(0, 2 * np.pi)
            dist = rng.uniform(.8, 1.4) * o.r[1]
            cx, cy = leaves[rng.integers(len(leaves))][:2]
            cx, cy = cx + np.cos(ang) * dist * 1.3, cy + np.sin(ang) * dist * .7
        want, tries = rng.integers(2, 4), 0
        while want and tries < 60:
            tries += 1
            r = rng.uniform(*o.r)
            x, y = cx + rng.uniform(-1, 1) * r, cy + rng.uniform(-.6, .6) * r
            # Separación mínima entre centros (como las semillas de las losas): ninguna hoja justo
            # encima de otra.
            if any(np.hypot(x - lx, y - ly) < o.pack * (r + lr) for lx, ly, lr, _ in leaves):
                continue
            leaves.append((x, y, r, rng.integers(len(LEAF))))
            want -= 1
        if not leaves:
            leaves.append((cx, cy, o.r[1], 0))
    L = np.array([l[:3] for l in leaves])
    pad = o.r[1] * (1 + o.shadow) + 2
    x0, y0 = (L[:, 0] - L[:, 2]).min() - pad, (L[:, 1] - L[:, 2]).min() - pad
    x1, y1 = (L[:, 0] + L[:, 2]).max() + pad, (L[:, 1] + L[:, 2]).max() + pad
    Wd, Ht = int((x1 - x0) * k), int((y1 - y0) * k)
    yy, xx = np.mgrid[0:Ht, 0:Wd] / k
    xx, yy = xx + x0, yy + y0
    col = np.zeros((Ht, Wd, 3))
    al = np.zeros((Ht, Wd))
    for x, y, r, t in sorted(leaves, key=lambda l: l[1]):
        # Sombra: círculo bajado y algo mayor.
        sd = np.hypot(xx - x, yy - (y + r * o.shadow)) < r * (1 + o.shadow * .35)
        col[sd] = col[sd] * (1 - o.shadow_a) + np.array(SHADOW) * o.shadow_a
        al[sd] = np.maximum(al[sd], o.shadow_a)
        d = np.hypot(xx - x, yy - y)
        inside = d < r
        tone = np.array(LEAF[t], float)
        up = np.clip((y - yy) / r, 0, 1) ** 1.5 * .35     # más claro arriba
        c = tone + (np.array(LIGHT) - tone) * up[..., None]
        col[inside] = c[inside]
        al[inside] = 1
    img = Image.fromarray(np.dstack([col * al[..., None], al * 255]).clip(0, 255).astype(np.uint8), "RGBa")
    img = img.resize((Wd // F, Ht // F), Image.LANCZOS).convert("RGBA")
    return img.crop(img.getbbox())


def main():
    a = argparse.ArgumentParser()
    a.add_argument("out")
    a.add_argument("--n", type=int, default=10)
    a.add_argument("--seed", type=int, default=1)
    a.add_argument("--px", type=float, default=.5)
    a.add_argument("--r", type=float, nargs=2, default=[7.5, 10], help="radio de hoja, px de la referencia")
    a.add_argument("--groups", type=int, nargs=2, default=[2, 5], help="grupos de 2-3 hojas por mata")
    a.add_argument("--pack", type=float, default=.6, help="distancia mínima entre centros, en (r1 + r2)")
    a.add_argument("--shadow", type=float, default=.3, help="cuánto baja la sombra (x radio)")
    a.add_argument("--shadow-a", type=float, default=.9)
    a.add_argument("--sheet")
    o = a.parse_args()
    out = Path(o.out)
    out.mkdir(parents=True, exist_ok=True)
    for f in out.glob("mata_*.png"):
        f.unlink()
    rng = np.random.default_rng(o.seed)
    ims = [bush(rng, o) for _ in range(o.n)]
    for i, im in enumerate(ims):
        im.save(out / f"mata_{i}.png")
    (out / "matas.json").write_text(json.dumps({"count": o.n, "scale": o.px}))
    print(o.n, "matas en", out, [im.size for im in ims])
    if o.sheet:
        cw, ch = max(t.width for t in ims) + 8, max(t.height for t in ims) + 8
        sh = Image.new("RGBA", (5 * cw, -(-o.n // 5) * ch), (150, 182, 96, 255))
        for i, t in enumerate(ims):
            sh.alpha_composite(t, ((i % 5) * cw + 4, (i // 5) * ch + 4))
        sh.save(o.sheet)


if __name__ == "__main__":
    main()
