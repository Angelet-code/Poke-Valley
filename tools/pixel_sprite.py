"""Convierte una imagen generada (SDXL) en un sprite de pixel art a escala nativa del juego.

Uso:
  python -I tools/pixel_sprite.py entrada.png salida.png --h 120 [--w 120]
      [--colors 16] [--bg auto|R,G,B|alpha] [--bg-tol 60] [--largest]
      [--outline inner|outer|none] [--outline-dark .45] [--outline-tint 40,30,50]
      [--despeckle 1] [--preview salida_x6.png] [--zoom 6]

Pasos (en este orden):
  1. Alfa. Si la imagen ya tiene alfa (`--bg alpha`) se usa tal cual. Si no, se separa
     el fondo liso por color: `--bg auto` toma el color de las esquinas; `--bg R,G,B` lo
     fija. La distancia de color se convierte en alfa (0 por debajo de bg-tol/2, 1 por
     encima de bg-tol) y se quita el "derrame" del fondo en los bordes (des-premultiplicado).
  2. Recorte al contenido (alfa > .5). Con `--largest` se queda solo la mancha conexa
     más grande (quita restos sueltos del fondo).
  3. Reducción con promedio de área (BOX, alfa premultiplicado) hasta --h de alto
     (y --w de ancho si se da; si no, proporcional). Así cada píxel final es la media de
     su bloque de origen: pixel art limpio sin artefactos de muestreo.
  4. Alfa binaria (umbral .5): sin flecos semitransparentes.
  5. Limpieza de silueta: se quitan píxeles opacos con menos de 2 vecinos opacos (en cruz)
     y se rellenan huecos transparentes con 3+ vecinos opacos (color = el más repetido).
  6. Cuantización a --colors colores con PIL (mediancut, sin tramado) solo sobre los
     píxeles opacos (los transparentes se rellenan con el color dominante para no gastar
     paleta en el fondo).
  7. `--despeckle N` (N pasadas): un píxel cuyo color no comparte ningún vecino de los 8
     se sustituye por el color más repetido de sus vecinos (quita "ruido" de un píxel).
  8. Contorno de 1 px alrededor de la silueta. `inner`: oscurece los píxeles opacos del
     borde (no cambia el tamaño); `outer`: añade un anillo fuera (crece 1 px por lado).
     El color no es negro puro: color_del_píxel * outline-dark mezclado con outline-tint.
  9. Guarda PNG RGBA al tamaño exacto y una previsualización ×--zoom (vecino más cercano)
     en --preview (por defecto <salida>_x6.png junto a la salida, o en assets/gen si la
     salida está en assets/game).

Parámetros usados para los edificios: ver docs/art/PIPELINE.md (sección edificios) y
assets/gen/edificios/params.txt.
"""
import argparse
from collections import Counter
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage


def key_background(rgb, bg, tol):
    """Alfa por distancia de color al fondo + quitar el derrame del fondo."""
    d = np.sqrt(((rgb.astype(np.float32) - bg) ** 2).sum(-1))
    a = np.clip((d - tol * 0.5) / (tol * 0.5), 0, 1)
    # des-premultiplicar: px = a*obj + (1-a)*bg  ->  obj = (px - (1-a)*bg) / a
    safe = np.where(a > 0.05, a, 1)[..., None]
    obj = (rgb.astype(np.float32) - (1 - a)[..., None] * bg) / safe
    obj = np.where(a[..., None] > 0.05, obj, rgb)
    return np.clip(obj, 0, 255).astype(np.uint8), a


def largest_component(mask):
    lab, n = ndimage.label(mask)
    if n <= 1:
        return mask
    sizes = ndimage.sum(mask, lab, range(1, n + 1))
    return lab == (1 + int(np.argmax(sizes)))


def neighbors4(mask):
    m = np.pad(mask, 1)
    return (m[:-2, 1:-1].astype(int) + m[2:, 1:-1] + m[1:-1, :-2] + m[1:-1, 2:])


def mode_color(rgb, mask, y, x):
    """Color más repetido entre los 8 vecinos opacos de (y, x)."""
    h, w = mask.shape
    cols = []
    for dy in (-1, 0, 1):
        for dx in (-1, 0, 1):
            if dy == 0 and dx == 0:
                continue
            yy, xx = y + dy, x + dx
            if 0 <= yy < h and 0 <= xx < w and mask[yy, xx]:
                cols.append(tuple(int(v) for v in rgb[yy, xx]))
    if not cols:
        return None
    return Counter(cols).most_common(1)[0][0]


def clean_silhouette(rgb, mask):
    for _ in range(3):
        n4 = neighbors4(mask)
        drop = mask & (n4 < 2)
        fill = (~mask) & (n4 >= 3)
        if not drop.any() and not fill.any():
            break
        mask = mask & ~drop
        for y, x in zip(*np.nonzero(fill)):
            c = mode_color(rgb, mask, y, x)
            if c is not None:
                rgb[y, x] = c
                mask[y, x] = True
    return rgb, mask


def quantize(rgb, mask, colors):
    fill = Counter(map(tuple, rgb[mask])).most_common(1)[0][0]
    tmp = rgb.copy()
    tmp[~mask] = fill
    q = Image.fromarray(tmp, "RGB").quantize(colors=colors, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)
    return np.array(q.convert("RGB"))


def despeckle(rgb, mask, passes):
    h, w = mask.shape
    for _ in range(passes):
        changed = 0
        out = rgb.copy()
        for y in range(h):
            for x in range(w):
                if not mask[y, x]:
                    continue
                me = tuple(int(v) for v in rgb[y, x])
                same = False
                cols = []
                for dy in (-1, 0, 1):
                    for dx in (-1, 0, 1):
                        if dy == 0 and dx == 0:
                            continue
                        yy, xx = y + dy, x + dx
                        if 0 <= yy < h and 0 <= xx < w and mask[yy, xx]:
                            c = tuple(int(v) for v in rgb[yy, xx])
                            cols.append(c)
                            if c == me:
                                same = True
                if not same and cols:
                    out[y, x] = Counter(cols).most_common(1)[0][0]
                    changed += 1
        rgb = out
        if not changed:
            break
    return rgb


def outline(rgb, mask, mode, dark, tint):
    tint = np.array(tint, np.float32)
    if mode == "inner":
        n4 = neighbors4(mask)
        border = mask & (n4 < 4)
        col = rgb.astype(np.float32) * dark * 0.7 + tint * 0.3
        rgb = rgb.copy()
        rgb[border] = np.clip(col[border], 0, 255).astype(np.uint8)
        return rgb, mask
    if mode == "outer":
        rgb = np.pad(rgb, ((1, 1), (1, 1), (0, 0)))
        mask = np.pad(mask, 1)
        ring = ndimage.binary_dilation(mask, structure=np.array([[0, 1, 0], [1, 1, 1], [0, 1, 0]])) & ~mask
        # color: el del píxel opaco vecino más cercano, oscurecido
        idx = ndimage.distance_transform_edt(~mask, return_distances=False, return_indices=True)
        near = rgb[idx[0], idx[1]].astype(np.float32)
        col = near * dark * 0.7 + tint * 0.3
        rgb = rgb.copy()
        rgb[ring] = np.clip(col[ring], 0, 255).astype(np.uint8)
        return rgb, mask | ring
    return rgb, mask


def main():
    p = argparse.ArgumentParser()
    p.add_argument("src")
    p.add_argument("dst")
    p.add_argument("--h", type=int, required=True)
    p.add_argument("--w", type=int)
    p.add_argument("--colors", type=int, default=16)
    p.add_argument("--bg", default="auto")
    p.add_argument("--bg-tol", type=float, default=60)
    p.add_argument("--largest", action="store_true")
    p.add_argument("--outline", choices=["inner", "outer", "none"], default="inner")
    p.add_argument("--outline-dark", type=float, default=0.45)
    p.add_argument("--outline-tint", default="40,30,50")
    p.add_argument("--despeckle", type=int, default=1)
    p.add_argument("--preview")
    p.add_argument("--zoom", type=int, default=6)
    a = p.parse_args()

    im = Image.open(a.src).convert("RGBA")
    arr = np.array(im)
    rgb, alpha = arr[..., :3], arr[..., 3].astype(np.float32) / 255

    if a.bg != "alpha":
        if a.bg == "auto":
            h, w = rgb.shape[:2]
            corners = np.stack([rgb[2, 2], rgb[2, w - 3], rgb[h - 3, 2], rgb[h - 3, w - 3]]).astype(np.float32)
            bg = np.median(corners, 0)
        else:
            bg = np.array([float(v) for v in a.bg.split(",")], np.float32)
        rgb, alpha = key_background(rgb, bg, a.bg_tol)

    solid = alpha > 0.5
    if a.largest:
        solid = largest_component(solid)
        alpha = alpha * solid
    ys, xs = np.nonzero(solid)
    y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
    rgb, alpha = rgb[y0:y1, x0:x1], alpha[y0:y1, x0:x1]

    # reducción con alfa premultiplicado
    prem = np.dstack([rgb.astype(np.float32) * alpha[..., None], alpha[..., None] * 255]).astype(np.uint8)
    src_h, src_w = alpha.shape
    tw = a.w or max(1, round(src_w * a.h / src_h))
    small = Image.fromarray(prem, "RGBA").resize((tw, a.h), Image.Resampling.BOX)
    s = np.array(small).astype(np.float32)
    sa = s[..., 3] / 255
    mask = sa > 0.5
    srgb = np.where(mask[..., None], s[..., :3] / np.maximum(sa, 1e-3)[..., None], 0)
    srgb = np.clip(srgb, 0, 255).astype(np.uint8)

    srgb, mask = clean_silhouette(srgb, mask)
    srgb = quantize(srgb, mask, a.colors)
    if a.despeckle:
        srgb = despeckle(srgb, mask, a.despeckle)
    tint = [float(v) for v in a.outline_tint.split(",")]
    srgb, mask = outline(srgb, mask, a.outline, a.outline_dark, tint)

    # recorte final (por si la limpieza vació filas/columnas)
    ys, xs = np.nonzero(mask)
    srgb, mask = srgb[ys.min():ys.max() + 1, xs.min():xs.max() + 1], mask[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
    out = np.dstack([srgb, (mask * 255).astype(np.uint8)])
    dst = Path(a.dst)
    dst.parent.mkdir(parents=True, exist_ok=True)
    res = Image.fromarray(out, "RGBA")
    res.save(dst)

    prev = Path(a.preview) if a.preview else None
    if prev is None:
        base = dst
        if "assets\\game" in str(dst) or "assets/game" in str(dst):
            base = Path("assets/gen") / dst.relative_to(Path("assets/game"))
        prev = base.with_name(base.stem + f"_x{a.zoom}.png")
    prev.parent.mkdir(parents=True, exist_ok=True)
    res.resize((res.width * a.zoom, res.height * a.zoom), Image.Resampling.NEAREST).save(prev)
    print(f"{dst} {res.width}x{res.height}  colores={len(set(map(tuple, srgb[mask])))}  preview={prev}")


if __name__ == "__main__":
    main()
