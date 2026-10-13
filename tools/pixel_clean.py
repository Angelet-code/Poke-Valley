"""Limpieza automática de un sprite de pixel art (PNG RGBA de colores planos) según las reglas
del oficio: líneas de 1 px sin "dobles", sin píxeles huérfanos, simetría y filas de tejas
periódicas. Pensado para la salida de `pixel_grid.py` (IA muestreada a paso entero).

Uso:
  python -I tools/pixel_clean.py entrada.png salida.png [--colors 20] [--islands 2]
      [--jaggy all|dark|none] [--keep-arm 3] [--smooth 1] [--thin 0|4] [--line-lum 60]
      [--mirror left|right|none] [--keep x0,y0,x1,y1 ...] [--rows y0,y1,periodo[,y_src] ...]
      [--rows-x x0,x1] [--crop nombre:x0,y0,x1,y1 ...] [--zoom 6] [--grass 150,176,95] [--check] [--runs]

Pasos (orden real: 1, 4, 2, 3, 4b, 5, 6, 3 otra vez; cada uno se puede desactivar):
  1. Cuantización a <= --colors colores sin tramado y sin negro puro (luminancia < 28 se mezcla
     con un morado-marrón oscuro, nunca #000).
  2. Islas: componentes conexas (8 vecinos) de un mismo color con <= --islands píxeles se
     funden con el color vecino más frecuente. En la silueta: píxeles opacos sueltos fuera se
     quitan y agujeros de 1-2 px se rellenan.
  3. "Dobles" (--jaggy): un píxel de línea es "fino" si solo tiene 2 vecinos (de 8) de su mismo
     color. Si esos dos son 4-vecinos perpendiculares (forman una L), el píxel es la esquina de
     un escalón doblado: se quita (se rellena con el color de fuera de la L) y la línea sigue
     8-conexa en diagonal. Las esquinas de verdad (marcos de ventana) se respetan si los dos
     brazos de la L miden >= --keep-arm píxeles. Se itera hasta que no cambia nada.
     `dark` = solo colores de línea (luminancia < --line-lum); `all` = todos los colores.
  4. Ruido de relleno (--smooth N pasadas): un píxel de color de relleno (no de línea) cuyo 3x3
     tiene >= 5 vecinos de otro mismo color de relleno toma ese color. Quita regueros y motas
     dentro de superficies planas sin tocar líneas ni bandas de 1 px.
  4b. Líneas de 2 px de grosor (--thin N, desactivado por defecto): bandas de color de línea de
     exactamente 2 px a lo largo de >= N píxeles se dejan en 1 px quitando la fila/columna
     interior. Cuidado: en entradas ruidosas se come marcos de ventana.
  5. Simetría (--mirror left|right): se copia esa mitad espejada sobre la otra. Los rectángulos
     --keep x0,y0,x1,y1 (incluidos) se conservan tal cual del original (p. ej. la chimenea).
  6. Filas periódicas (--rows y0,y1,p[,ys[,x0,x1]]): la plantilla son las p filas que empiezan en ys
     (por defecto y0); se repite hacia abajo hasta y1 (incluida), solo sobre píxeles cuyo color
     ya esté en la plantilla (así no se pisan contornos, pared ni chimenea) y dentro de
     --rows-x x0,x1 (o el x0,x1 de la propia especificación) si se da. Los --keep también se respetan.
  7. Informe: huérfanos, dobles y bandas que quedan, con coordenadas; asimetría (píxeles que no
     coinciden con su espejo); con --runs, los tramos (longitud, valor) del contorno superior e
     izquierdo, para ver que las diagonales llevan escalones regulares (regla 2). Con --check solo
     se informa de la entrada y no se escribe nada.
  8. Previsualizaciones: <salida>_x6.png (×--zoom sobre césped) y, por cada --crop,
     <salida>_x12_<nombre>.png con antes | después ampliados ×12.
"""
import argparse
from collections import Counter
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage

DARK_TINT = np.array([44, 32, 54], np.float32)
EIGHT = np.ones((3, 3), bool)


# ----------------------------------------------------------------------------- utilidades

def lum(c):
    return c[0] * 0.299 + c[1] * 0.587 + c[2] * 0.114


def to_index(rgb, mask):
    """Imagen -> (índices, paleta). Índice 0 = transparente."""
    cols = sorted(Counter(map(tuple, rgb[mask])).items(), key=lambda kv: -kv[1])
    pal = [(0, 0, 0)] + [tuple(int(v) for v in c) for c, _ in cols]
    look = {c: i for i, c in enumerate(pal)}
    idx = np.zeros(mask.shape, np.int32)
    for y, x in zip(*np.nonzero(mask)):
        idx[y, x] = look[tuple(int(v) for v in rgb[y, x])]
    return idx, pal


def from_index(idx, pal):
    arr = np.array(pal, np.uint8)[idx]
    mask = idx > 0
    return arr, mask


def quantize(rgb, mask, colors):
    fill = Counter(map(tuple, rgb[mask])).most_common(1)[0][0]
    tmp = rgb.copy()
    tmp[~mask] = fill
    q = Image.fromarray(tmp, "RGB").quantize(colors=colors, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)
    out = np.array(q.convert("RGB"))
    l = out.astype(np.float32) @ np.array([0.299, 0.587, 0.114], np.float32)
    dark = mask & (l < 28)
    if dark.any():
        out[dark] = np.clip(out[dark].astype(np.float32) * 0.35 + DARK_TINT * 0.65, 0, 255).astype(np.uint8)
    return out


def neighbor_mode(idx, y, x, exclude=()):
    """Índice más frecuente entre los 4 vecinos (luego 8) distinto de `exclude`; None si no hay."""
    h, w = idx.shape
    for offs in (((0, 1), (0, -1), (1, 0), (-1, 0)), ((1, 1), (1, -1), (-1, 1), (-1, -1))):
        c = Counter()
        for dy, dx in offs:
            yy, xx = y + dy, x + dx
            if 0 <= yy < h and 0 <= xx < w and idx[yy, xx] not in exclude:
                c[int(idx[yy, xx])] += 1
        if c:
            return c.most_common(1)[0][0]
    return None


# ----------------------------------------------------------------------------- pasos

def fix_islands(idx, max_size):
    """Funde componentes de color de <= max_size píxeles con el color vecino dominante."""
    n_fixed = 0
    for k in range(1, idx.max() + 1):
        m = idx == k
        if not m.any():
            continue
        lab, n = ndimage.label(m, structure=EIGHT)
        sizes = ndimage.sum(m, lab, range(1, n + 1))
        for i, s in enumerate(sizes, start=1):
            if s <= max_size:
                for y, x in zip(*np.nonzero(lab == i)):
                    rep = neighbor_mode(idx, y, x, exclude=(k,))
                    if rep is not None:
                        idx[y, x] = rep
                        n_fixed += 1
    return n_fixed


def fix_silhouette(idx):
    """Quita opacos sueltos fuera (componentes de alfa pequeñas) y rellena agujeros de <= 2 px."""
    mask = idx > 0
    lab, n = ndimage.label(mask, structure=EIGHT)
    if n > 1:
        sizes = ndimage.sum(mask, lab, range(1, n + 1))
        big = 1 + int(np.argmax(sizes))
        idx[(lab > 0) & (lab != big)] = 0
    holes = ndimage.binary_fill_holes(idx > 0) & (idx == 0)
    lab, n = ndimage.label(holes, structure=EIGHT)
    for i in range(1, n + 1):
        pts = list(zip(*np.nonzero(lab == i)))
        if len(pts) <= 2:
            for y, x in pts:
                rep = neighbor_mode(idx, y, x, exclude=(0,))
                if rep is not None:
                    idx[y, x] = rep


def same8(idx, y, x, k):
    h, w = idx.shape
    out = []
    for dy in (-1, 0, 1):
        for dx in (-1, 0, 1):
            if dy == 0 and dx == 0:
                continue
            yy, xx = y + dy, x + dx
            if 0 <= yy < h and 0 <= xx < w and idx[yy, xx] == k:
                out.append((dy, dx))
    return out


def arm_len(idx, y, x, dy, dx, k):
    h, w = idx.shape
    n = 0
    yy, xx = y + dy, x + dx
    while 0 <= yy < h and 0 <= xx < w and idx[yy, xx] == k:
        n += 1
        yy, xx = yy + dy, xx + dx
    return n


def find_doubles(idx, colors, keep_arm, protected):
    """Lista de (y, x, relleno) de esquinas en L de píxeles finos (los "dobles")."""
    h, w = idx.shape
    out = []
    for y in range(h):
        for x in range(w):
            k = int(idx[y, x])
            if k not in colors or protected[y, x]:
                continue
            nb = same8(idx, y, x, k)
            if len(nb) != 2:
                continue
            (a, b) = nb
            # los dos deben ser 4-vecinos perpendiculares
            if abs(a[0]) + abs(a[1]) != 1 or abs(b[0]) + abs(b[1]) != 1 or a[0] == b[0] or a[1] == b[1]:
                continue
            if arm_len(idx, y, x, *a, k) >= keep_arm and arm_len(idx, y, x, *b, k) >= keep_arm:
                continue  # esquina de verdad
            # relleno: el color de los dos 4-vecinos de fuera de la L
            c = Counter()
            for dy, dx in ((-a[0], -a[1]), (-b[0], -b[1])):
                yy, xx = y + dy, x + dx
                if 0 <= yy < h and 0 <= xx < w:
                    c[int(idx[yy, xx])] += 1
                else:
                    c[0] += 1
            fill = c.most_common(1)[0][0]
            if fill == k:
                continue
            out.append((y, x, fill))
    return out


def fix_doubles(idx, colors, keep_arm, protected, max_iter=50):
    total, removed = 0, []
    touched = set()   # un píxel solo se cambia una vez (si no, dos colores pueden oscilar)
    for _ in range(max_iter):
        found = [f for f in find_doubles(idx, colors, keep_arm, protected) if (f[0], f[1]) not in touched]
        if not found:
            break
        # se quita uno por línea y pasada: nunca dos adyacentes a la vez (romperían la línea)
        done = set()
        changed = 0
        for y, x, fill in found:
            if any((y + dy, x + dx) in done for dy in (-1, 0, 1) for dx in (-1, 0, 1)):
                continue
            touched.add((y, x))
            idx[y, x] = fill
            done.add((y, x))
            removed.append((x, y))
            changed += 1
        total += changed
        if not changed:
            break
    return total, removed


def find_thick(idx, colors, min_run):
    """Bandas de color de línea de exactamente 2 px de grosor: devuelve [(k, orient, y, x0, x1)]."""
    h, w = idx.shape
    out = []
    for k in colors:
        m = idx == k
        if m.sum() < min_run * 2:
            continue
        # horizontales: fila y e y+1 ambas k, y-1 e y+2 no
        for y in range(h - 1):
            band = m[y] & m[y + 1]
            if y > 0:
                band &= ~m[y - 1]
            if y + 2 < h:
                band &= ~m[y + 2]
            x = 0
            while x < w:
                if band[x]:
                    x0 = x
                    while x < w and band[x]:
                        x += 1
                    if x - x0 >= min_run:
                        out.append((k, "h", y, x0, x - 1))
                else:
                    x += 1
        for x in range(w - 1):
            band = m[:, x] & m[:, x + 1]
            if x > 0:
                band &= ~m[:, x - 1]
            if x + 2 < w:
                band &= ~m[:, x + 2]
            y = 0
            while y < h:
                if band[y]:
                    y0 = y
                    while y < h and band[y]:
                        y += 1
                    if y - y0 >= min_run:
                        out.append((k, "v", x, y0, y - 1))
                else:
                    y += 1
    return out


def fix_thick(idx, colors, min_run, protected):
    n = 0
    for k, o, pos, a0, a1 in find_thick(idx, colors, min_run):
        h, w = idx.shape
        if o == "h":
            # elegir la fila a quitar: la que da al objeto (vecino opaco); si ambas, la de abajo
            up_t = pos - 1 < 0 or (idx[pos - 1, a0:a1 + 1] == 0).mean() > 0.5
            dn_t = pos + 2 >= h or (idx[pos + 2, a0:a1 + 1] == 0).mean() > 0.5
            yq = pos if (up_t is False and dn_t is True) else pos + 1
            for x in range(a0, a1 + 1):
                if protected[yq, x]:
                    continue
                rep = neighbor_mode(idx, yq, x, exclude=(k,))
                if rep is not None:
                    idx[yq, x] = rep
                    n += 1
        else:
            lf_t = pos - 1 < 0 or (idx[a0:a1 + 1, pos - 1] == 0).mean() > 0.5
            rt_t = pos + 2 >= w or (idx[a0:a1 + 1, pos + 2] == 0).mean() > 0.5
            xq = pos if (lf_t is False and rt_t is True) else pos + 1
            for y in range(a0, a1 + 1):
                if protected[y, xq]:
                    continue
                rep = neighbor_mode(idx, y, xq, exclude=(k,))
                if rep is not None:
                    idx[y, xq] = rep
                    n += 1
    return n


def smooth(idx, line_cols, protected, passes, need=5):
    """Filtro de mayoría solo entre colores de relleno: motas y regueros desaparecen, las líneas no."""
    h, w = idx.shape
    total = 0
    lines = set(line_cols)
    for _ in range(passes):
        out = idx.copy()
        changed = 0
        for y in range(h):
            for x in range(w):
                k = int(idx[y, x])
                if k == 0 or k in lines or protected[y, x]:
                    continue
                c = Counter()
                for dy in (-1, 0, 1):
                    for dx in (-1, 0, 1):
                        if dy == 0 and dx == 0:
                            continue
                        yy, xx = y + dy, x + dx
                        if 0 <= yy < h and 0 <= xx < w:
                            c[int(idx[yy, xx])] += 1
                best, n = c.most_common(1)[0]
                if best != k and best != 0 and best not in lines and n >= need:
                    out[y, x] = best
                    changed += 1
        idx[:] = out
        total += changed
        if not changed:
            break
    return total


def mirror(idx, side, protected):
    h, w = idx.shape
    src = idx[:, ::-1].copy()  # espejo
    half = w // 2
    out = idx.copy()
    if side == "left":
        out[:, w - half:] = src[:, w - half:]
    else:
        out[:, :half] = src[:, :half]
    out[protected] = idx[protected]
    return out


def asymmetry(idx):
    return int((idx != idx[:, ::-1]).sum() // 2)


def tile_rows(idx, spec, xr, protected):
    parts = [int(v) for v in spec.split(",")]
    y0, y1, p = parts[:3]
    ys = parts[3] if len(parts) > 3 else y0
    tpl = idx[ys:ys + p].copy()
    allowed = set(np.unique(tpl).tolist()) - {0}
    x0, x1 = (0, idx.shape[1] - 1) if xr is None else xr
    if len(parts) > 5:
        x0, x1 = parts[4], parts[5]
    n = 0
    for y in range(y0, y1 + 1):
        row = tpl[(y - y0) % p]
        for x in range(x0, x1 + 1):
            if protected[y, x] or idx[y, x] not in allowed or row[x] not in allowed:
                continue
            if idx[y, x] != row[x]:
                idx[y, x] = row[x]
                n += 1
    return n


def edge_runs(idx):
    """Tramos del contorno superior (y mínimo opaco por columna) e izquierdo (x mínimo por fila):
    lista de (longitud, valor) para comprobar la regularidad de las diagonales (regla 2)."""
    out = {}
    h, w = idx.shape
    for name, prof in (("superior", [int(np.argmax(idx[:, x] > 0)) if (idx[:, x] > 0).any() else -1 for x in range(w)]),
                       ("izquierdo", [int(np.argmax(idx[y] > 0)) if (idx[y] > 0).any() else -1 for y in range(h)])):
        runs = []
        for v in prof:
            if v < 0:
                continue
            if runs and runs[-1][1] == v:
                runs[-1][0] += 1
            else:
                runs.append([1, v])
        out[name] = [tuple(r) for r in runs]
    return out


def orphans(idx):
    """Píxeles opacos sin ningún 8-vecino de su color."""
    out = []
    h, w = idx.shape
    for y in range(h):
        for x in range(w):
            k = int(idx[y, x])
            if k and not same8(idx, y, x, k):
                out.append((x, y))
    return out


# ----------------------------------------------------------------------------- previsualización

def preview(res, zoom, grass, path):
    big = res.resize((res.width * zoom, res.height * zoom), Image.Resampling.NEAREST)
    bg = Image.new("RGBA", (big.width + 12 * zoom, big.height + 12 * zoom), grass + (255,))
    bg.alpha_composite(big, (6 * zoom, 6 * zoom))
    bg.save(path)


def crop_pair(before, after, box, grass, path, zoom=12):
    x0, y0, x1, y1 = box
    a = before.crop((x0, y0, x1 + 1, y1 + 1))
    b = after.crop((x0, y0, x1 + 1, y1 + 1))
    a = a.resize((a.width * zoom, a.height * zoom), Image.Resampling.NEAREST)
    b = b.resize((b.width * zoom, b.height * zoom), Image.Resampling.NEAREST)
    gap = 2 * zoom
    out = Image.new("RGBA", (a.width + b.width + gap * 3, a.height + gap * 2), grass + (255,))
    out.alpha_composite(a, (gap, gap))
    out.alpha_composite(b, (a.width + gap * 2, gap))
    out.save(path)


# ----------------------------------------------------------------------------- principal

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("src")
    ap.add_argument("dst", nargs="?")
    ap.add_argument("--colors", type=int, default=20)
    ap.add_argument("--islands", type=int, default=2, help="tamaño máximo de isla de color a fundir (0 = no)")
    ap.add_argument("--jaggy", choices=["all", "dark", "none"], default="all")
    ap.add_argument("--keep-arm", type=int, default=3, help="brazos >= N en ambos lados = esquina real, se respeta")
    ap.add_argument("--thin", type=int, default=0, help="longitud mínima de banda de 2 px a adelgazar (0 = no, por defecto)")
    ap.add_argument("--smooth", type=int, default=1, help="pasadas del filtro de mayoría sobre colores de relleno (0 = no)")
    ap.add_argument("--line-lum", type=float, default=60, help="luminancia máxima de los colores de línea")
    ap.add_argument("--mirror", choices=["left", "right", "none"], default="none")
    ap.add_argument("--keep", action="append", default=[], help="rectángulo x0,y0,x1,y1 (incluido) que no se toca")
    ap.add_argument("--rows", action="append", default=[], help="y0,y1,periodo[,y_src]: repetir la plantilla de filas")
    ap.add_argument("--rows-x", help="x0,x1 límite horizontal para --rows")
    ap.add_argument("--crop", action="append", default=[], help="nombre:x0,y0,x1,y1 -> <salida>_x12_<nombre>.png antes|después")
    ap.add_argument("--zoom", type=int, default=6)
    ap.add_argument("--grass", default="150,176,95")
    ap.add_argument("--check", action="store_true", help="solo informar, no escribir")
    ap.add_argument("--runs", action="store_true", help="informar de los tramos del contorno superior e izquierdo")
    a = ap.parse_args()

    im = Image.open(a.src).convert("RGBA")
    arr = np.array(im)
    rgb, mask = arr[..., :3].copy(), arr[..., 3] > 127
    before = Image.fromarray(np.dstack([rgb, (mask * 255).astype(np.uint8)]), "RGBA")

    if not a.check:
        rgb = quantize(rgb, mask, a.colors)
    idx, pal = to_index(rgb, mask)
    h, w = idx.shape
    protected = np.zeros((h, w), bool)
    for k in a.keep:
        x0, y0, x1, y1 = [int(v) for v in k.split(",")]
        protected[y0:y1 + 1, x0:x1 + 1] = True
    dark = [i for i, c in enumerate(pal) if i and lum(c) < a.line_lum]
    all_cols = list(range(1, len(pal)))

    def report(tag):
        o = orphans(idx)
        d = find_doubles(idx, all_cols, a.keep_arm, np.zeros_like(protected))
        t = find_thick(idx, dark, max(a.thin, 3))
        print(f"[{tag}] {w}x{h} colores={len(pal) - 1} huerfanos={len(o)} dobles={len(d)} bandas2px={len(t)} asimetria={asymmetry(idx)}")
        if o:
            print("   huerfanos (x,y):", o[:40])
        if d:
            print("   dobles (x,y):", [(x, y) for y, x, _ in d][:40])
        if t:
            print("   bandas (orient, pos, de, a):", [(k2, o2, p2, b0, b1) for k2, o2, p2, b0, b1 in t][:20])
        if a.runs:
            for name, runs in edge_runs(idx).items():
                print(f"   contorno {name} (tramo, valor):", runs)

    print("colores de linea (lum<%g):" % a.line_lum, [pal[i] for i in dark])
    report("entrada")
    if a.check:
        return

    if a.smooth:
        n = smooth(idx, dark, protected, a.smooth)
        print(f"ruido de relleno suavizado: {n}")
    if a.islands:
        fix_silhouette(idx)
        n = fix_islands(idx, a.islands)
        print(f"islas fundidas: {n}")
    if a.jaggy != "none":
        n, rem = fix_doubles(idx, dark if a.jaggy == "dark" else all_cols, a.keep_arm, protected)
        print(f"dobles quitados: {n}", rem[:60])
    if a.thin:
        n = fix_thick(idx, dark, a.thin, protected)
        print(f"pixeles adelgazados: {n}")
    if a.mirror != "none":
        idx = mirror(idx, a.mirror, protected)
        print(f"espejo {a.mirror} aplicado")
    xr = tuple(int(v) for v in a.rows_x.split(",")) if a.rows_x else None
    for spec in a.rows:
        n = tile_rows(idx, spec, xr, protected)
        print(f"filas {spec}: {n} pixeles cambiados")
    if a.jaggy != "none" and (a.mirror != "none" or a.rows):
        n, rem = fix_doubles(idx, dark if a.jaggy == "dark" else all_cols, a.keep_arm, protected)
        print(f"dobles quitados (2a pasada): {n}", rem[:60])
    if a.islands:
        fix_islands(idx, 1)
    fix_silhouette(idx)
    report("salida")

    rgb2, mask2 = from_index(idx, pal)
    res = Image.fromarray(np.dstack([rgb2, (mask2 * 255).astype(np.uint8)]), "RGBA")
    dst = Path(a.dst)
    dst.parent.mkdir(parents=True, exist_ok=True)
    res.save(dst)
    grass = tuple(int(v) for v in a.grass.split(","))
    base = dst
    if "assets\\game" in str(dst) or "assets/game" in str(dst):
        base = Path("assets/gen") / dst.relative_to(Path("assets/game"))
        base.parent.mkdir(parents=True, exist_ok=True)
    preview(res, a.zoom, grass, base.with_name(base.stem + f"_x{a.zoom}.png"))
    for c in a.crop:
        name, box = c.split(":")
        crop_pair(before, res, [int(v) for v in box.split(",")], grass, base.with_name(base.stem + f"_x12_{name}.png"))
    print(f"{dst} {res.width}x{res.height}  colores={len(set(map(tuple, rgb2[mask2])))}")


if __name__ == "__main__":
    main()
