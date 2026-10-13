"""Recorta losas sueltas del camino de la imagen de referencia.

Uso: python -I tools/cut_stones.py <ref.png> <salida_dir> [--scale 0.5625] [--sheet hoja.png]
         [--light 205] [--min 500] [--max 9000] [--debug d.png]

1. Losa = mancha clara (luminancia > --light) dentro de la arena, rellenando huecos.
   Las grietas oscuras que las separan quedan fuera, así cada losa es una
   componente conexa.
2. Se descartan las demasiado pequeñas o grandes, las poco compactas y las que
   tocan algo que no es arena (césped, árboles, rocas).
3. Cada losa se redibuja como roca limpia a la escala --scale (ver render): forma
   poligonal o redondeada, relleno plano con los colores de la referencia y sombra
   por debajo. PNG con alfa:
   <salida_dir>/losa_N.png (+ losas.json con el número). Los colores no se tocan.
   Para el juego se guardan a resolución de pantalla x3 (--scale 1.6875).
"""
import argparse
import json
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage


def radius_profile(full, n=180):
    """Radio de la losa desde su centro en n direcciones (las losas son casi convexas)."""
    cy, cx = ndimage.center_of_mass(full)
    h, w = full.shape
    r = np.zeros(n)
    for i, t in enumerate(np.linspace(0, 2 * np.pi, n, endpoint=False)):
        dy, dx = np.sin(t), np.cos(t)
        k = 0.0
        while True:
            y, x = int(round(cy + dy * (k + 1))), int(round(cx + dx * (k + 1)))
            if not (0 <= y < h and 0 <= x < w) or not full[y, x]:
                break
            k += 1
        r[i] = k + 0.5
    r = ndimage.uniform_filter1d(r, 9, mode="wrap")  # quita dientes del recorte
    return cy, cx, r


def render(crop, full, o, seed):
    """Losa como roca limpia, dibujada a la resolución final con supermuestreo x4.

    - Forma: polígono de 5-8 lados sobre el contorno real (esquinas algo redondeadas),
      o, a veces, el contorno redondeado original. Bordes nítidos.
    - Relleno: colores de la referencia acercados al medio (pintura plana y limpia),
      un solo tono, sin franjas.
    - Trazo: línea de grieta alrededor con grosor variable, como pincelada: un hilo
      que se afina hasta desaparecer arriba y a los lados, y que engorda por debajo
      (sombra) y se afila en punta hacia los extremos. Grosor = distancia al borde
      permitida según el ángulo desde el centro de la losa, con ruido suave.
    """
    rng = np.random.default_rng(seed)
    F = 4
    k = o.scale * F
    cy, cx, r = radius_profile(full)
    n = len(r)
    if rng.random() < o.angular:
        m = rng.integers(5, 9)
        idx = (np.linspace(0, n, m, endpoint=False) + rng.uniform(0, n / m) + rng.uniform(-.25, .25, m) * n / m).astype(int) % n
        idx.sort()
    else:
        idx = np.arange(0, n, 3)
    ang = idx * 2 * np.pi / n
    pad = 4 * F + int((o.shadow + o.hair) * F)
    pts = [(pad + (cx + np.cos(t) * r[i]) * k, pad + (cy + np.sin(t) * r[i]) * k) for t, i in zip(ang, idx)]
    W = int(full.shape[1] * k + 2 * pad)
    H = int(full.shape[0] * k + 2 * pad)
    poly = Image.new("L", (W, H))
    ImageDraw.Draw(poly).polygon(pts, fill=255)
    # Esquinas un poco redondeadas: desenfocar y volver a cortar.
    stone = ndimage.gaussian_filter(np.asarray(poly, float) / 255, o.round * F) > 0.5
    # Trazo de grosor variable.
    dist = ndimage.distance_transform_edt(~stone)            # px (supermuestreo) al borde
    yy, xx = np.mgrid[0:H, 0:W]
    scy, scx = np.argwhere(stone).mean(0)
    th = np.arctan2(yy - scy, xx - scx)                       # abajo = +pi/2
    ph = rng.uniform(0, 2 * np.pi, 4)
    n1 = 0.5 + 0.5 * np.sin(2 * th + ph[0]) * np.sin(3 * th + ph[1])        # ruido angular
    n2 = 0.5 + 0.5 * np.sin(1 * th + ph[2]) * np.cos(2 * th + ph[3])
    hair = F * o.hair * np.clip((n1 - 0.35) / 0.65, 0, 1)                   # 0 = sin línea
    below = np.clip(np.sin(th), 0, 1) ** 1.6                                # se afila hacia los lados
    width = hair + F * o.shadow * below * (0.45 + 0.55 * n2)
    shadow = ~stone & (dist <= width)

    ring = ndimage.binary_dilation(full, iterations=3) & ~full
    rgb = crop.astype(float)
    mean = rgb[full].mean(0)
    line = np.percentile(rgb[ring], 15, axis=0) * 0.88
    fill_img = Image.fromarray(crop.astype(np.uint8)).resize((int(full.shape[1] * k), int(full.shape[0] * k)), Image.BICUBIC)
    fill = np.empty((H, W, 3))
    fill[:] = mean
    fill[pad:pad + fill_img.height, pad:pad + fill_img.width] = mean + (np.asarray(fill_img, float) - mean) * o.detail
    fill = fill + (255 - fill) * o.light_up
    col = np.where(stone[..., None], fill, line)
    alpha = (stone | shadow).astype(float)
    big = np.dstack([col * alpha[..., None], alpha * 255])  # premultiplicado
    t = Image.fromarray(big.clip(0, 255).astype(np.uint8), "RGBa").resize((W // F, H // F), Image.BOX).convert("RGBA")
    return t.crop(t.getbbox())


def main():
    a = argparse.ArgumentParser()
    a.add_argument("ref")
    a.add_argument("out")
    a.add_argument("--scale", type=float, default=0.5625)
    a.add_argument("--light", type=float, default=205)
    a.add_argument("--min", type=int, default=500)
    a.add_argument("--max", type=int, default=9000)
    a.add_argument("--grow", type=int, default=3)
    a.add_argument("--shadow", type=float, default=5, help="grosor máximo del trazo por debajo, px finales")
    a.add_argument("--hair", type=float, default=2, help="grosor máximo del hilo arriba y a los lados, px finales")
    a.add_argument("--light-up", type=float, default=0.06, help="aclarado del relleno (luego el juego oscurece algunas)")
    a.add_argument("--round", type=float, default=1.5, help="redondeo de esquinas, px finales")
    a.add_argument("--angular", type=float, default=0.65, help="fracción de losas poligonales")
    a.add_argument("--detail", type=float, default=0.5, help="cuánto del sombreado original se conserva")
    a.add_argument("--sheet")
    a.add_argument("--debug")
    o = a.parse_args()
    im = Image.open(o.ref).convert("RGB")
    arr = np.asarray(im).astype(int)
    r, g, b = arr[..., 0], arr[..., 1], arr[..., 2]
    sand = (r > g + 4) & (r > 150) & (b < r - 35)
    lum = 0.2126 * r + 0.7152 * g + 0.0722 * b
    stone = ndimage.binary_opening(sand & (lum > o.light), iterations=2)
    stone = ndimage.binary_fill_holes(stone)
    lab, n = ndimage.label(stone)
    near_sand = ndimage.binary_erosion(sand | stone, iterations=o.grow + 3)
    out = Path(o.out)
    out.mkdir(parents=True, exist_ok=True)
    keep = []
    for k, sl in enumerate(ndimage.find_objects(lab), 1):
        m = lab[sl] == k
        area = m.sum()
        h, w = m.shape
        if not (o.min <= area <= o.max) or area < 0.55 * h * w or max(h, w) > 2.6 * min(h, w):
            continue
        # La losa con su borde de grieta debe quedar entera sobre arena.
        pad = o.grow + 4
        y0, x0 = max(0, sl[0].start - pad), max(0, sl[1].start - pad)
        y1, x1 = sl[0].stop + pad, sl[1].stop + pad
        full = lab[y0:y1, x0:x1] == k
        if not near_sand[y0:y1, x0:x1][ndimage.binary_dilation(full, iterations=1)].all():
            continue
        keep.append(render(arr[y0:y1, x0:x1], full, o, k))
    for i, t in enumerate(keep):
        t.save(out / f"losa_{i}.png")
    (out / "losas.json").write_text(json.dumps({"count": len(keep), "scale": o.scale}))
    print(n, "manchas,", len(keep), "losas guardadas en", out)
    if o.debug:
        d = np.asarray(im).copy()
        d[stone] = (d[stone] * 0.5 + np.array([255, 0, 0]) * 0.5).astype(np.uint8)
        Image.fromarray(d).save(o.debug)
    if o.sheet and keep:
        cols = 8
        cw = max(t.width for t in keep) + 4
        ch = max(t.height for t in keep) + 4
        rows = -(-len(keep) // cols)
        sh = Image.new("RGBA", (cols * cw, rows * ch), (120, 160, 90, 255))
        for i, t in enumerate(keep):
            sh.alpha_composite(t, ((i % cols) * cw + 2, (i // cols) * ch + 2))
        sh.resize((sh.width * 3, sh.height * 3), Image.NEAREST).save(o.sheet)


if __name__ == "__main__":
    main()
