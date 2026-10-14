"""Vectorizado por capas con vtracer: las lineas aparte de los rellenos, y los rellenos simplificados.

Uso: python -I lab/tools/vectorizar2.py casa_grande [--colores 22] [--linea 26] [--mota 80] [--sufijo capas]
     python -I lab/tools/vectorizar2.py --todos

El vectorizado directo (vectorizar.py) hace lo contrario de lo que se quiere: trocea los degradados
en muchas manchas (mas detalle) y se come las lineas finas (tejas). Aqui:
1. Lineas: pixeles bastante mas oscuros que su entorno (black-hat de la luminancia, nucleo 11 px)
   o muy oscuros (contorno). Se les asigna un tono de entre --tonos (k-means de su color, suavizado
   por mayoria) y cada tono se traza en modo binario: trazos continuos y nitidos.
2. Rellenos: la imagen con las lineas rellenadas (inpaint) y suavizada, reducida a --colores colores
   (k-means en Lab), agrupando los que se parecen (dE < --agrupar) y fundiendo cada mancha de menos
   de --mota px con su vecina mayoritaria. Se traza con un color por capa, sin degradados.
3. SVG = rellenos + lineas encima. Mismo tamano en px que el PNG (lab/assets/elementos/).
Salida: lab/assets/vector/<id>_<sufijo>.svg  (y, con --todos y sin sufijo, <id>.svg + vector.json).
"""
import argparse
import json
import re
import time
from pathlib import Path

import cv2
import numpy as np
import vtracer
from PIL import Image
from scipy import ndimage as ndi

RAIZ = Path(__file__).resolve().parents[1]
ELEM = RAIZ / "assets/elementos"
OUT = RAIZ / "assets/vector"
GRANDES = ("casa", "arbol", "roca", "estanque", "piedras")
PATH_RE = re.compile(r"<path [^>]*/>")


def trazar(png, out, binario, mota):
    # Argumentos posicionales (con nombre, vtracer 0.6.15 revienta en Python 3.14).
    args = ("binary" if binario else "color", "stacked", "spline", mota, 8, 4, 60, 4.0, 10, 45, 2)
    vtracer.convert_image_to_svg_py(str(png), str(out), *args)
    return PATH_RE.findall(out.read_text(encoding="utf-8"))


def mascara_lineas(rgb, solido, umbral, oscuro):
    gris = cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY)
    k = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (11, 11))
    cierre = cv2.morphologyEx(gris, cv2.MORPH_CLOSE, k)      # el entorno sin las lineas finas
    bh = (cierre.astype(int) - gris.astype(int)).clip(0, 255).astype(np.uint8)
    # Solo el nucleo del trazo: mas oscuro que el umbral y cerca del maximo local (la penumbra de la
    # linea suavizada se queda fuera; si no, los trazos salen el doble de gordos).
    pico = cv2.dilate(bh, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (7, 7)))
    m = (((bh > umbral) & (bh >= 0.55 * pico)) | (gris < oscuro)) & solido
    lab, n = ndi.label(m)
    tam = ndi.sum(m, lab, index=np.arange(1, n + 1))
    m = np.isin(lab, [i + 1 for i, t in enumerate(tam) if t >= 14])  # motas fuera
    return m


def kmeans(pts, k, semilla=1):
    rng = np.random.default_rng(semilla)
    k = max(1, min(k, len(np.unique(pts, axis=0))))
    if k == 1:
        return pts.mean(0, keepdims=True).astype(np.float32)
    idx = rng.choice(len(pts), min(len(pts), 60000), replace=False)
    crit = (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 40, 0.3)
    _, _, centros = cv2.kmeans(pts[idx].astype(np.float32), k, None, crit, 4, cv2.KMEANS_PP_CENTERS)
    return centros


def asignar(pts, centros):
    out = np.empty(len(pts), np.int32)
    for i in range(0, len(pts), 200000):
        d = ((pts[i:i + 200000, None, :] - centros[None]) ** 2).sum(-1)
        out[i:i + 200000] = d.argmin(1)
    return out


def de_lab(c1, c2):
    # Lab de OpenCV (uint8): L 0..255 = 0..100, a/b con +128.
    return np.sqrt(((c1[0] - c2[0]) * 100 / 255) ** 2 + (c1[1] - c2[1]) ** 2 + (c1[2] - c2[2]) ** 2)


def agrupar(centros, umbral):
    """Une los centros a menos de 'umbral' dE (union-find); devuelve indice de grupo por centro."""
    g = list(range(len(centros)))

    def raiz(i):
        while g[i] != i:
            g[i] = g[g[i]]
            i = g[i]
        return i
    for i in range(len(centros)):
        for j in range(i + 1, len(centros)):
            if de_lab(centros[i], centros[j]) < umbral:
                g[raiz(j)] = raiz(i)
    grupos = {}
    return np.array([grupos.setdefault(raiz(i), len(grupos)) for i in range(len(centros))])


def fundir_motas(et, solido, mota, k):
    """Cada mancha de una etiqueta con menos de 'mota' px pasa a la etiqueta mayoritaria de su borde."""
    for _ in range(2):
        for c in range(k):
            m = et == c
            if not m.any():
                continue
            lab, n = ndi.label(m)
            tam = ndi.sum(m, lab, index=np.arange(1, n + 1))
            for i, t in enumerate(tam):
                if t >= mota:
                    continue
                comp = lab == i + 1
                anillo = ndi.binary_dilation(comp, iterations=2) & ~comp & solido
                v = et[anillo]
                v = v[v != c]
                if len(v):
                    et[comp] = np.bincount(v).argmax()
    return et


def mayoria(et, m, k, tam=5, veces=1):
    """Suaviza una imagen de etiquetas (dentro de la mascara m) por mayoria en una ventana tam x tam.
    Ventana pequena: las franjas finas (el brillo de un tablon, 8-10 px) tienen que sobrevivir."""
    for _ in range(veces):
        votos = np.stack([cv2.boxFilter((et == i).astype(np.float32), -1, (tam, tam)) for i in range(k)])
        et = np.where(m, votos.argmax(0), -1)
    return et


def rellenar_celdas(base, solido, ml, colores, mota, agrupar_de, plano_de=10.0):
    """Relleno plano por celdas: cada zona cerrada por lineas recibe un color (su mediana); si la celda
    tiene sombreado claro (muchos pixeles lejos de la mediana), 2-3 colores (k-means suavizado). Los
    pixeles de linea toman el color de la celda mas cercana (el relleno pasa por debajo del trazo).
    Despues se funden las manchas pequenas y se agrupa la paleta a <= `colores` tonos."""
    H, W = solido.shape
    lab = cv2.cvtColor(base, cv2.COLOR_RGB2LAB).astype(np.float32)
    pared = ndi.binary_dilation(ml, iterations=1)
    celdas, nc = ndi.label(solido & ~pared)
    col = np.zeros((H, W, 3), np.float32)
    sub = np.full((H, W), -1, np.int64)
    peso = np.array([100 / 255, 1, 1], np.float32)
    for c, sl in enumerate(ndi.find_objects(celdas), start=1):
        if sl is None:
            continue
        m = celdas[sl] == c
        px = lab[sl][m]
        med = np.median(px, axis=0)
        de = np.sqrt((((px - med) * peso) ** 2).sum(1))
        vista_col, vista_sub = col[sl], sub[sl]
        if len(px) < 600 or (de < plano_de).mean() > 0.8:
            vista_col[m] = med
            vista_sub[m] = c * 4
            continue
        k = 3 if len(px) > 20000 else 2
        et = np.full(m.shape, -1, np.int32)
        et[m] = asignar(px, kmeans(px, k))
        et = mayoria(et, m, k, 5, 1)
        for i in range(k):
            mi = et == i
            if mi.any():
                vista_col[mi] = lab[sl][mi].mean(0)
                vista_sub[mi] = c * 4 + i
    libre = sub >= 0
    _, (iy, ix) = ndi.distance_transform_edt(~libre, return_indices=True)
    col, sub = col[iy, ix], sub[iy, ix]
    vals, inv = np.unique(sub[solido], return_inverse=True)
    etq = np.full((H, W), -1, np.int32)
    etq[solido] = inv
    etq = fundir_motas(etq, solido, mota, len(vals))
    # Paleta: media de cada etiqueta, agrupada por parecido y, si aun hay muchas, k-means a `colores`.
    ids = np.arange(len(vals))
    medias = np.nan_to_num(np.stack([ndi.mean(col[..., ch], etq, index=ids) for ch in range(3)], 1).astype(np.float32))
    cuenta = np.bincount(etq[solido], minlength=len(vals)).astype(np.float32)
    vivos = cuenta > 0     # etiquetas que se quedaron sin pixeles al fundir motas
    grupo = agrupar(medias, agrupar_de)
    if len(np.unique(grupo[vivos])) > colores:
        muestra = np.repeat(medias[vivos], np.minimum(50, 1 + (cuenta[vivos] // 400)).astype(int), axis=0)
        cent = kmeans(muestra, colores, 3)
        grupo = asignar(medias, cent)
    ng = grupo.max() + 1
    pal = np.zeros((ng, 3), np.float32)
    for g in range(ng):
        sel = grupo == g
        pal[g] = (medias[sel] * cuenta[sel, None]).sum(0) / max(1.0, cuenta[sel].sum())
    etq_g = np.where(etq >= 0, grupo[np.maximum(etq, 0)], -1)
    pal_rgb = cv2.cvtColor(pal.reshape(-1, 1, 3).astype(np.uint8), cv2.COLOR_LAB2RGB).reshape(-1, 3)
    plano = np.zeros((H, W, 4), np.uint8)
    plano[solido, :3] = pal_rgb[etq_g[solido]]
    plano[solido, 3] = 255
    return plano, ng, nc


def rellenar_meanshift(base, solido, colores, mota, agrupar_de, sp=14, sr=28):
    """Relleno plano sin celdas: mean-shift (aplana los degradados suaves y respeta los bordes de color
    fuertes, puerta frente a pared), k-means a `colores` en Lab, colores parecidos agrupados y motas
    fundidas. Robusto cuando las lineas tienen huecos (las celdas se fugan y mezclan colores)."""
    H, W = solido.shape
    bgr = cv2.cvtColor(base, cv2.COLOR_RGB2BGR)
    ms = cv2.cvtColor(cv2.pyrMeanShiftFiltering(bgr, sp, sr, maxLevel=1), cv2.COLOR_BGR2RGB)
    lab = cv2.cvtColor(ms, cv2.COLOR_RGB2LAB).astype(np.float32)
    # El anillo exterior de 2 px (antialias con el verde del fondo) no vota: toma el color del
    # interior mas cercano. Si no, sale un filo verde alrededor de la silueta.
    interior = ndi.binary_erosion(solido, iterations=2)
    pts = lab[interior]
    centros = kmeans(pts, colores, 2)
    grupo = agrupar(centros, agrupar_de)
    ng = grupo.max() + 1
    et = grupo[asignar(pts, centros)]
    cg = np.stack([pts[et == g].mean(0) if (et == g).any() else centros[np.nonzero(grupo == g)[0][0]] for g in range(ng)])
    et = asignar(pts, cg)
    etq = np.full((H, W), -1, np.int32)
    etq[interior] = et
    _, (iy, ix) = ndi.distance_transform_edt(~interior, return_indices=True)
    etq = np.where(solido, etq[iy, ix], -1)
    etq = fundir_motas(etq, solido, mota, ng)
    pal_rgb = cv2.cvtColor(cg.clip(0, 255).reshape(-1, 1, 3).astype(np.uint8), cv2.COLOR_LAB2RGB).reshape(-1, 3)
    plano = np.zeros((H, W, 4), np.uint8)
    plano[solido, :3] = pal_rgb[etq[solido]]
    plano[solido, 3] = 255
    return plano, ng, 0


def vectorizar(nombre, colores=16, linea=18, oscuro=60, mota=100, tonos=6, agrupar_de=9.0, sufijo="capas", debug=False, relleno="meanshift"):
    t0 = time.time()
    src = ELEM / f"{nombre}.png"
    rgba = np.asarray(Image.open(src).convert("RGBA")).copy()
    solido = rgba[..., 3] >= 128
    rgb = rgba[..., :3].copy()
    rgb[~solido] = 0
    H, W = solido.shape
    OUT.mkdir(parents=True, exist_ok=True)

    # 1. Lineas. Fondo sin lineas (inpaint + suavizado): sirve para el relleno y para dar a cada
    # linea un color relativo a su fondo (al menos 22 de L mas oscura: una teja clara sobre el tejado
    # claro sigue viendose).
    ml = mascara_lineas(rgb, solido, linea, oscuro)
    tapar = ndi.binary_dilation(ml, iterations=1).astype(np.uint8)
    base = cv2.inpaint(rgb, tapar, 4, cv2.INPAINT_TELEA)
    base = cv2.bilateralFilter(base, 9, 28, 7)
    base = cv2.bilateralFilter(base, 7, 22, 5)
    lab_img = cv2.cvtColor(rgb, cv2.COLOR_RGB2LAB).astype(np.float32)
    lab_base = cv2.cvtColor(base, cv2.COLOR_RGB2LAB).astype(np.float32)
    lcol = lab_img.copy()
    lcol[..., 0] = np.minimum(lab_img[..., 0], lab_base[..., 0] - 22 * 255 / 100)
    pts = lcol[ml]
    ct = kmeans(pts, min(tonos, max(1, len(pts) // 50)))
    tono = np.full((H, W), -1, np.int32)
    tono[ml] = asignar(pts, ct)
    tono = mayoria(tono, ml, len(ct), 7, 2)   # que un trazo no cambie de tono a cada pixel
    tonos_rgb = cv2.cvtColor(ct.clip(0, 255).reshape(-1, 1, 3).astype(np.uint8), cv2.COLOR_LAB2RGB).reshape(-1, 3)
    if debug:
        dbg = np.full((H, W, 3), 200, np.uint8)
        dbg[solido] = 150
        for i, col in enumerate(tonos_rgb):
            dbg[tono == i] = col
        Image.fromarray(dbg).save(OUT / f"_{nombre}_lineas.png")
        print("tonos de linea:", [(tuple(int(v) for v in c), int((tono == i).sum())) for i, c in enumerate(tonos_rgb)])

    # 2. Rellenos planos por celdas (zonas cerradas por lineas), paleta corta, sin motas.
    if relleno == "celdas":
        plano, ng, nc = rellenar_celdas(base, solido, ml, colores, mota, agrupar_de)
    else:
        plano, ng, nc = rellenar_meanshift(base, solido, colores, mota, agrupar_de)
    tmp = OUT / f"_{nombre}_plano.png"
    Image.fromarray(plano).save(tmp)
    paths = trazar(tmp, OUT / f"_{nombre}_plano.svg", False, 6)
    if not debug:
        tmp.unlink()
    (OUT / f"_{nombre}_plano.svg").unlink()

    # 3. Cada tono de linea en binario, recoloreado.
    n_lin = 0
    for i, col in enumerate(tonos_rgb):
        m = tono == i
        if m.sum() < 14:
            continue
        bn = np.full((H, W, 3), 255, np.uint8)
        bn[m] = 0
        tmp = OUT / f"_{nombre}_lin{i}.png"
        Image.fromarray(bn).save(tmp)
        p = trazar(tmp, OUT / f"_{nombre}_lin{i}.svg", True, 8)
        tmp.unlink()
        (OUT / f"_{nombre}_lin{i}.svg").unlink()
        hexc = "#%02X%02X%02X" % tuple(int(v) for v in col)
        p = [re.sub(r'fill="[^"]*"', f'fill="{hexc}"', q) if 'fill="' in q else q.replace("<path ", f'<path fill="{hexc}" ') for q in p]
        paths += p
        n_lin += len(p)

    svg = ['<?xml version="1.0" encoding="UTF-8"?>',
           f'<svg version="1.1" xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}">', *paths, "</svg>"]
    dst = OUT / f"{nombre}{('_' + sufijo) if sufijo else ''}.svg"
    dst.write_text("\n".join(svg), encoding="utf-8")
    print(f"{dst.name}: {nc} celdas, {ng} colores, {len(paths) - n_lin} rellenos + {n_lin} lineas ({len(ct)} tonos), "
          f"{dst.stat().st_size // 1024} KB, {time.time() - t0:.1f} s")
    return dst


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("nombre", nargs="?")
    ap.add_argument("--todos", action="store_true")
    ap.add_argument("--colores", type=int, default=16)
    ap.add_argument("--relleno", choices=["meanshift", "celdas"], default="meanshift")
    ap.add_argument("--linea", type=int, default=18, help="umbral del black-hat (0-255)")
    ap.add_argument("--oscuro", type=int, default=60, help="luminancia bajo la que todo es contorno")
    ap.add_argument("--mota", type=int, default=100, help="manchas menores (px del PNG x2) se funden")
    ap.add_argument("--tonos", type=int, default=6)
    ap.add_argument("--agrupar", type=float, default=9.0, help="dE bajo el que dos colores se unen")
    ap.add_argument("--sufijo", default="capas")
    ap.add_argument("--debug", action="store_true", help="deja _<id>_plano.png y _<id>_lineas.png en assets/vector/")
    ap.add_argument("--carpeta", help="otra carpeta de elementos (p. ej. elementos_klein_edit_casa_s1_0); el SVG va a vector/<carpeta>/")
    o = ap.parse_args()
    global ELEM, OUT
    if o.carpeta:
        ELEM = RAIZ / "assets" / o.carpeta
        OUT = RAIZ / "assets/vector" / o.carpeta
    kw = dict(colores=o.colores, linea=o.linea, oscuro=o.oscuro, mota=o.mota, tonos=o.tonos, agrupar_de=o.agrupar, sufijo=o.sufijo, debug=o.debug, relleno=o.relleno)
    if o.todos:
        cat = json.loads((ELEM / "elementos.json").read_text(encoding="utf-8"))
        hechos = []
        for e in cat["elementos"]:
            if e["tipo"] in GRANDES:
                vectorizar(e["id"], **kw)
                hechos.append(e["id"])
        if not o.sufijo:
            (OUT / "vector.json").write_text(json.dumps(hechos), encoding="utf-8")
            print("vector.json:", len(hechos), "elementos")
    elif o.nombre:
        vectorizar(o.nombre, **kw)
    else:
        ap.error("nombre o --todos")


if __name__ == "__main__":
    main()
