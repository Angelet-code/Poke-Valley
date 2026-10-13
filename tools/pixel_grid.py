"""Convierte una imagen "pixel art" generada por IA (Flux/SDXL, con rejilla de píxel gorda pero
no exacta) en un sprite de pixel art limpio, muestreando UN color por celda de la rejilla.

Uso:
  python -I tools/pixel_grid.py entrada.png salida.png [--w 120] [--pitch 0] [--colors 24]
      [--bg auto|R,G,B|alpha] [--bg-tol 70] [--bg2 R,G,B --bg2-tol 60] [--largest] [--pad 2]
      [--outline none|inner|outer] [--despeckle 1] [--preview salida_x6.png] [--zoom 6]
      [--grass 150,176,95]

Pasos:
  1. Alfa por color de fondo (como pixel_sprite.py: `--bg auto` = mediana de las esquinas).
     `--bg2 R,G,B` quita además un segundo color (la sombra proyectada que Flux pinta sobre el
     fondo). `--shadow R,G,B` hace lo mismo pero solo donde ese color toca el fondo (conexo),
     así no se pierden sombras interiores del mismo tono. Con `--largest` solo se conserva la
     mancha conexa más grande. Al final, `--demagenta` recolorea los píxeles opacos de tono
     magenta/morado (fondo colado en las sombras interiores) a un marrón de igual luminancia.
  2. Detección del paso de la rejilla (pitch) y su fase, por separado en X e Y: perfil de
     gradiente g(x) = suma por filas de |I[x+1]-I[x]|; para cada paso candidato p (3..24 px, en
     cuartos de píxel) y fase o se mide cuánta energía de borde cae sobre las líneas o+k*p
     respecto a la media; el mejor (p, o) es la rejilla. `--pitch N` fuerza el paso.
     Se imprime el paso detectado y su "nitidez" (ratio; >1.6 = rejilla clara, ~1 = no hay).
  3. Muestreo: cada celda de la rejilla da un píxel, con la mediana del centro de la celda
     (50 % interior) en color y alfa binaria (mayoría del centro opaca).
  4. Recorte a la silueta, limpieza (píxeles sueltos fuera, huecos dentro), cuantización a
     --colors colores sin tramado, despeckle, contorno opcional y aclarado de negros puros
     (los colores con luminancia < 28 se mezclan con un morado oscuro: nunca negro puro).
  5. Tamaño final `--w`: si --w / ancho_celdas es casi entero (±0.12) se amplía con vecino más
     cercano por ese factor; si no, se vuelve a muestrear la imagen de origen con un paso
     ajustado para que salgan exactamente --w celdas (re-render). Sin --w, tamaño nativo de celdas.
  6. Guarda PNG RGBA y una previsualización ×zoom sobre césped (--grass) en --preview
     (por defecto <salida>_x6.png; si la salida está en assets/game, en assets/gen).
"""
import argparse
import sys
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage

sys.path.insert(0, str(Path(__file__).resolve().parent))
from pixel_sprite import clean_silhouette, despeckle, key_background, largest_component, outline, quantize  # noqa: E402

DARK_TINT = np.array([44, 32, 54], np.float32)


def grad_profile(gray, axis):
    """Energía de borde entre columnas (axis=1) o filas (axis=0): g[i] = borde entre i e i+1."""
    d = np.abs(np.diff(gray, axis=axis))
    return d.sum(axis=1 - axis)


def detect_pitch(g, pmin=3.0, pmax=24.0, step=0.25):
    """Devuelve (pitch, fase, ratio) que maximiza la energía de borde sobre las líneas fase+k*pitch."""
    n = len(g)
    mean = g.mean() + 1e-6
    cands = []
    for p in np.arange(pmin, pmax + 1e-9, step):
        k = np.arange(0, int(n / p) + 2)
        best_o, best_r = 0.0, 0.0
        for o in np.arange(0, p, max(step, 0.25)):
            # la frontera entre la celda que empieza en o+k*p y la anterior está en índice o+k*p-1
            idx = np.round(o + k * p - 1).astype(int)
            idx = idx[(idx >= 0) & (idx < n)]
            if len(idx) < 4:
                continue
            r = g[idx].mean() / mean
            if r > best_r:
                best_o, best_r = float(o), float(r)
        cands.append((float(p), best_o, best_r))
    # los múltiplos del paso real también puntúan alto (armónicos): se elige el paso MÁS PEQUEÑO
    # cuyo ratio llegue al 70 % del máximo
    rmax = max(c[2] for c in cands)
    for c in cands:
        if c[2] >= 0.7 * rmax:
            return c
    return max(cands, key=lambda c: c[2])


def refine_phase(g, p):
    """Fase óptima para un paso dado (en 1/8 de píxel)."""
    n = len(g)
    mean = g.mean() + 1e-6
    k = np.arange(0, int(n / p) + 2)
    best = (0.0, 0.0)
    for o in np.arange(0, p, 0.125):
        idx = np.round(o + k * p - 1).astype(int)
        idx = idx[(idx >= 0) & (idx < n)]
        r = g[idx].mean() / mean
        if r > best[1]:
            best = (float(o), float(r))
    return best


def cell_edges(n, p, o):
    """Fronteras de celda [e0, e1, ...] que cubren 0..n con paso p y fase o."""
    start = o - p * np.ceil(o / p)
    e = np.round(np.arange(start, n + p, p)).astype(int)
    e = np.clip(e, 0, n)
    e = np.unique(e)
    return e


def sample_cells(rgb, alpha, ex, ey):
    """Un píxel por celda: mediana del 50 % central (color) y mayoría (alfa)."""
    H = len(ey) - 1
    W = len(ex) - 1
    out = np.zeros((H, W, 3), np.float32)
    msk = np.zeros((H, W), bool)
    for j in range(H):
        y0, y1 = ey[j], ey[j + 1]
        if y1 - y0 < 1:
            continue
        cy0 = y0 + (y1 - y0) // 4
        cy1 = max(cy0 + 1, y1 - (y1 - y0) // 4)
        for i in range(W):
            x0, x1 = ex[i], ex[i + 1]
            if x1 - x0 < 1:
                continue
            cx0 = x0 + (x1 - x0) // 4
            cx1 = max(cx0 + 1, x1 - (x1 - x0) // 4)
            a = alpha[cy0:cy1, cx0:cx1]
            op = a > 0.5
            if op.mean() >= 0.5:
                msk[j, i] = True
                out[j, i] = np.median(rgb[cy0:cy1, cx0:cx1][op].reshape(-1, 3), axis=0)
    return np.clip(out, 0, 255).astype(np.uint8), msk


def lighten_blacks(rgb, mask):
    lum = rgb[..., 0] * 0.299 + rgb[..., 1] * 0.587 + rgb[..., 2] * 0.114
    dark = mask & (lum < 28)
    if dark.any():
        rgb = rgb.copy()
        rgb[dark] = np.clip(rgb[dark].astype(np.float32) * 0.35 + DARK_TINT * 0.65, 0, 255).astype(np.uint8)
    return rgb


def demagenta(rgb, mask, target):
    """Píxeles magenta/morados (R > B > G, saturados) -> tono `target` con la misma luminancia."""
    r, g, b = [rgb[..., i].astype(np.int32) for i in range(3)]
    # magenta de verdad: azul alto respecto a la media de rojo y verde (un tejado granate no entra)
    mag = mask & (r > b) & (b > g + 15) & (r - g > 45) & (b * 2 > r + g + 10)
    if not mag.any():
        return rgb
    t = np.array(target, np.float32)
    tl = t @ np.array([0.299, 0.587, 0.114], np.float32)
    lum = rgb.astype(np.float32) @ np.array([0.299, 0.587, 0.114], np.float32)
    out = rgb.copy()
    out[mag] = np.clip(t[None, :] * (lum[mag] / tl)[:, None], 0, 255).astype(np.uint8)
    return out


def crop_mask(rgb, mask, pad=0):
    ys, xs = np.nonzero(mask)
    y0, y1 = max(0, ys.min() - pad), min(mask.shape[0], ys.max() + 1 + pad)
    x0, x1 = max(0, xs.min() - pad), min(mask.shape[1], xs.max() + 1 + pad)
    return rgb[y0:y1, x0:x1], mask[y0:y1, x0:x1]


def main():
    p = argparse.ArgumentParser()
    p.add_argument("src")
    p.add_argument("dst")
    p.add_argument("--w", type=int, help="ancho final en píxeles (p. ej. 120)")
    p.add_argument("--pitch", type=float, default=0, help="forzar paso de rejilla (0 = detectar)")
    p.add_argument("--colors", type=int, default=24)
    p.add_argument("--bg", default="auto")
    p.add_argument("--bg-tol", type=float, default=70)
    p.add_argument("--bg2", help="segundo color a quitar (p. ej. la sombra proyectada sobre el fondo), R,G,B")
    p.add_argument("--bg2-tol", type=float, default=60)
    p.add_argument("--shadow", help="color de sombra proyectada: se quita solo donde toca el fondo (conexo), R,G,B")
    p.add_argument("--shadow-tol", type=float, default=50)
    p.add_argument("--demagenta", default="70,46,36",
                   help="los píxeles opacos magenta/morados (fondo que se cuela en sombras interiores) se pasan a este tono, conservando luminancia; 'no' para desactivar")
    p.add_argument("--largest", action="store_true")
    p.add_argument("--pad", type=int, default=0, help="margen de celdas alrededor de la silueta al recortar")
    p.add_argument("--outline", choices=["inner", "outer", "none"], default="none")
    p.add_argument("--outline-dark", type=float, default=0.45)
    p.add_argument("--despeckle", type=int, default=1)
    p.add_argument("--preview")
    p.add_argument("--zoom", type=int, default=6)
    p.add_argument("--grass", default="150,176,95")
    a = p.parse_args()

    im = Image.open(a.src).convert("RGBA")
    arr = np.array(im)
    rgb, alpha = arr[..., :3], arr[..., 3].astype(np.float32) / 255
    if a.bg != "alpha":
        if a.bg == "auto":
            h, w = rgb.shape[:2]
            corners = np.stack([rgb[4, 4], rgb[4, w - 5], rgb[h - 5, 4], rgb[h - 5, w - 5]]).astype(np.float32)
            bg = np.median(corners, 0)
        else:
            bg = np.array([float(v) for v in a.bg.split(",")], np.float32)
        rgb, alpha = key_background(rgb, bg, a.bg_tol)
    if a.bg2:
        bg2 = np.array([float(v) for v in a.bg2.split(",")], np.float32)
        d2 = np.sqrt(((rgb.astype(np.float32) - bg2) ** 2).sum(-1))
        alpha = alpha * np.clip((d2 - a.bg2_tol * 0.5) / (a.bg2_tol * 0.5), 0, 1)
    if a.shadow:
        sh = np.array([float(v) for v in a.shadow.split(",")], np.float32)
        near = np.sqrt(((rgb.astype(np.float32) - sh) ** 2).sum(-1)) < a.shadow_tol
        lab, n = ndimage.label((alpha < 0.5) | near, structure=np.ones((3, 3)))
        touching = np.unique(lab[(alpha < 0.5) & (lab > 0)])
        kill = near & np.isin(lab, touching)
        alpha = np.where(kill, 0, alpha)
    solid = alpha > 0.5
    if a.largest:
        solid = largest_component(solid)
        alpha = alpha * solid

    # recorte grueso al contenido (con margen) para detectar la rejilla sobre el objeto
    ys, xs = np.nonzero(solid)
    m = 8
    y0, y1 = max(0, ys.min() - m), min(rgb.shape[0], ys.max() + 1 + m)
    x0, x1 = max(0, xs.min() - m), min(rgb.shape[1], xs.max() + 1 + m)
    rgb, alpha = rgb[y0:y1, x0:x1], alpha[y0:y1, x0:x1]

    gray = rgb.astype(np.float32) @ np.array([0.299, 0.587, 0.114], np.float32)
    gray = np.where(alpha > 0.5, gray, gray * 0 + 128)  # el fondo no aporta bordes
    gx, gy = grad_profile(gray, 1), grad_profile(gray, 0)
    if a.pitch > 0:
        px = py = a.pitch
        ox, rx = refine_phase(gx, px)
        oy, ry = refine_phase(gy, py)
    else:
        px, ox, rx = detect_pitch(gx)
        py, oy, ry = detect_pitch(gy)
        # si las dos direcciones no coinciden, se usa el paso más nítido para ambas
        if abs(px - py) > 0.5:
            pp = px if rx >= ry else py
            px = py = pp
            ox, rx = refine_phase(gx, px)
            oy, ry = refine_phase(gy, py)
    print(f"rejilla: paso x={px:.2f} (fase {ox:.2f}, ratio {rx:.2f})  paso y={py:.2f} (fase {oy:.2f}, ratio {ry:.2f})")

    ex = cell_edges(rgb.shape[1], px, ox)
    ey = cell_edges(rgb.shape[0], py, oy)
    srgb, mask = sample_cells(rgb, alpha, ex, ey)
    srgb, mask = crop_mask(srgb, mask, a.pad)
    cells_w, cells_h = mask.shape[1], mask.shape[0]
    print(f"celdas: {cells_w}x{cells_h}")

    scale = 1
    if a.w:
        f = a.w / cells_w
        if abs(f - round(f)) <= 0.12 and round(f) >= 1:
            scale = int(round(f))
        else:
            # re-render: volver a muestrear el origen con el paso que da exactamente --w celdas
            ys2, xs2 = np.nonzero(alpha > 0.5)
            cw = xs2.max() + 1 - xs2.min()
            p2 = cw / a.w
            ex = cell_edges(rgb.shape[1], p2, xs2.min() % p2)
            ey = cell_edges(rgb.shape[0], p2, ys2.min() % p2)
            srgb, mask = sample_cells(rgb, alpha, ex, ey)
            srgb, mask = crop_mask(srgb, mask, a.pad)
            print(f"re-render con paso {p2:.2f}: celdas {mask.shape[1]}x{mask.shape[0]}")

    srgb, mask = clean_silhouette(srgb, mask)
    srgb = quantize(srgb, mask, a.colors)
    if a.despeckle:
        srgb = despeckle(srgb, mask, a.despeckle)
    srgb, mask = outline(srgb, mask, a.outline, a.outline_dark, list(DARK_TINT))
    srgb = lighten_blacks(srgb, mask)
    if a.demagenta != "no":
        srgb = demagenta(srgb, mask, [float(v) for v in a.demagenta.split(",")])
    srgb, mask = crop_mask(srgb, mask)

    out = np.dstack([srgb, (mask * 255).astype(np.uint8)])
    res = Image.fromarray(out, "RGBA")
    if scale > 1:
        res = res.resize((res.width * scale, res.height * scale), Image.Resampling.NEAREST)
    dst = Path(a.dst)
    dst.parent.mkdir(parents=True, exist_ok=True)
    res.save(dst)

    prev = Path(a.preview) if a.preview else None
    if prev is None:
        base = dst
        if "assets\\game" in str(dst) or "assets/game" in str(dst):
            base = Path("assets/gen") / dst.relative_to(Path("assets/game"))
        prev = base.with_name(base.stem + f"_x{a.zoom}.png")
    prev.parent.mkdir(parents=True, exist_ok=True)
    grass = tuple(int(v) for v in a.grass.split(","))
    big = res.resize((res.width * a.zoom, res.height * a.zoom), Image.Resampling.NEAREST)
    bgim = Image.new("RGBA", (big.width + 12 * a.zoom, big.height + 12 * a.zoom), grass + (255,))
    bgim.alpha_composite(big, (6 * a.zoom, 6 * a.zoom))
    bgim.save(prev)
    ncol = len(set(map(tuple, srgb[mask])))
    print(f"{dst} {res.width}x{res.height} (x{scale})  colores={ncol}  preview={prev}")


if __name__ == "__main__":
    main()
