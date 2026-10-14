"""Saca los elementos (casas, árboles, rocas, suelo de piedras, estanque, detalles) del dibujo de
referencia lab/assets/ref/aldea_dibujo.png y los deja como PNG con alfa en lab/assets/elementos/.

Uso: python -I lab/tools/extraer.py [--tol 28] [--hoja]

1. Quita el marco marrón, amplía x2 (LANCZOS) y pasa un filtro bilateral: quita el grano del webp
   sin tocar los contornos (el dibujo es plano, con línea oscura).
2. Fondo = píxeles cercanos a los colores de césped, arena o mar (los colores más frecuentes de la
   imagen con tono de césped/arena/agua). Se inunda el fondo desde el borde (4-conexo, así no se
   cuela por una línea de contorno) y todo lo que no alcanza es un elemento: lo que hay dentro de
   un contorno (ventanas, parches de hierba de las casas) queda dentro aunque su color se parezca al
   fondo.
3. Cada componente conexa es un elemento. Se clasifica por tamaño y color (`clasificar`) y lo
   dudoso se fija a mano en AJUSTES (por el centro del componente, en px de la imagen original).
4. Alfa: 1 dentro; en el borde, según lo lejos que esté el color del fondo local (antialias de 1-2
   px); al color del borde se le quita la parte de fondo que lleva mezclada (desmezclado), para que
   no quede un halo verde al ponerlo sobre arena.
5. Salida: elementos/<tipo>_<n>.png (x2 respecto al dibujo original: 1 px del dibujo = 2 px del
   PNG) y elementos.json con ancla (base, px del PNG), huella y tipo. --hoja: hoja de contacto.
"""
import argparse
import json
from pathlib import Path

import cv2
import numpy as np
from PIL import Image
from scipy import ndimage as ndi

RAIZ = Path(__file__).resolve().parents[1]
REF = RAIZ / "assets/ref/aldea_dibujo.png"
OUT = RAIZ / "assets/elementos"
MARCO = 13          # px de marco marrón (+ antialias) que se quitan por cada lado
X = 2               # ampliación

# Ajustes a mano: centro aproximado del componente en el dibujo original (tras quitar el marco) -> tipo.
# None = descartar (p. ej. un árbol cortado por el marco).
AJUSTES: dict = {
    (92, 717): "roca",      # roca con parche de hierba (abajo a la izquierda)
    (76, 68): None,         # roca de arriba a la izquierda: lleva pegada la línea de la orilla
    (632, 72): None,        # roca pegada a la esquina del tejado de la casa larga (sin contorno por ese lado)
    (67, 444): None,        # montoncito de arena junto a la roca de la izquierda
}
# Nombres fijos (un punto bien dentro del elemento, px del dibujo sin marco), para que el mapa del
# lab no dependa del orden de extracción.
NOMBRES = {
    (217, 199): "casa_cabana", (751, 244): "casa_larga", (409, 529): "casa_grande", (780, 775): "casa_chimenea",
    (527, 220): "arbol_alto", (939, 630): "arbol_bajo", (295, 834): "estanque",
}
# Retoques por elemento tras el recorte (px del PNG, a x2): polígono que se conserva y si se quita
# el verde claro de parche de hierba (el árbol alto arrastra la cola del parche de la casa larga).
# "contorno": segmentos (px del PNG) sobre los que se pinta la línea oscura del dibujo, para que un
# borde cortado parezca dibujado; "contorno_poligono": lo mismo a lo largo del polígono de recorte.
POST = {
    # Árbol alto: fuera el verde del parche y la sombra se desvanece en elipse alrededor del pie del
    # tronco (un polígono con contorno dejaba un trazo recto).
    "arbol_alto": {"poligono": [(0, 0), (183, 0), (183, 150), (175, 230), (150, 250), (60, 250), (15, 205), (0, 160)],
                   "sin_verde_claro": True, "desde_y": 140, "sombra": {"centro": (112, 205), "rx": 70, "ry": 40, "desde_y": 140, "alfa": 0.85}},
    "casa_larga": {"contorno": [[(1, 383), (1, 524)]]},     # corte recto del parche (lado del árbol)
    "roca_5": {"sin_arena": True},                           # montoncito de arena pegado a su base
}
CONTORNO = (42, 60, 42)   # color de la línea del dibujo (verde muy oscuro)
CONTORNO_ANCHO = 5        # px del PNG (x2)
# Componentes que tocan el borde pero se quieren igual (centro aproximado, px del dibujo sin marco).
FORZAR = {(939, 643)}       # árbol de abajo a la derecha: roza el marco por 1 px
# Cortes a mano (polilíneas en px del dibujo original, 2 px de grosor) que separan elementos que se
# tocan: árbol | parche de la casa larga, parche | roca de abajo, tejado | roca de arriba.
CORTES = [
    [(554, 228), (554, 345)],   # hasta debajo de la sombra del árbol: la cola del parche se quedaba pegada
    [(878, 373), (892, 368), (897, 365), (956, 365)],
    [(669, 74), (669, 83), (652, 101), (647, 110)],
]
# Suelo de piedras: las losas de esta zona (px del dibujo sin marco) se unen con su argamasa en una
# sola pieza (ver `parche_piedras`). Las losas sueltas se guardan además como `losa_n`.
ZONAS_PIEDRAS = {"piedras_0": (550, 315, 690, 485)}


def hsv(rgb):
    return cv2.cvtColor(rgb.reshape(-1, 1, 3).astype(np.uint8), cv2.COLOR_RGB2HSV).reshape(rgb.shape).astype(int)


def colores_fondo(a):
    """Colores más frecuentes (cuantizados a 8) con tono de césped, arena o agua."""
    q = (a // 8) * 8 + 4
    cols, cnt = np.unique(q.reshape(-1, 3), axis=0, return_counts=True)
    orden = np.argsort(-cnt)
    out = {"cesped": [], "arena": [], "agua": []}
    for i in orden[:80]:
        c = cols[i]
        h, s, v = hsv(np.array([c]))[0]  # h en 0..179
        if cnt[i] < a.shape[0] * a.shape[1] * 0.0015:
            break
        # El césped liso; no los verdes oscuros de las sombras de los árboles (G - R >= 36), que
        # son parte del árbol.
        if 30 <= h <= 55 and 50 <= s <= 150 and v >= 150 and int(c[1]) - int(c[0]) < 36:
            out["cesped"].append(c)
        elif 15 <= h < 30 and 70 <= s <= 160 and v >= 170:
            out["arena"].append(c)
        elif 80 <= h <= 100 and s >= 90 and v >= 140:
            out["agua"].append(c)
    return out


def dist_min(a, cols):
    """Distancia RGB mínima de cada píxel a una lista de colores."""
    d = np.full(a.shape[:2], 1e9, np.float32)
    af = a.astype(np.float32)
    for c in cols:
        d = np.minimum(d, np.sqrt(((af - np.asarray(c, np.float32)) ** 2).sum(-1)))
    return d


def clasificar(area, medio, bbox, tiene_azul, toca_borde):
    """Tipo tentativo por tamaño y color (área en px del dibujo original)."""
    h, s, v = hsv(np.array([medio]))[0]
    if area > 40000:
        return "casa"
    if 35 <= h <= 85 and s > 80 and area > 6000:
        return "arbol"
    if tiene_azul and area > 8000:
        return "estanque"
    if s < 70 and area > 1200 and v < 170:
        return "roca"
    if area > 1500 and s < 90 and v >= 150:
        return "piedras"
    if area >= 40:
        return "detalle"
    return "ruido"


def partir_pegados(comp, n, maximo=480 * X):
    """Un componente más ancho o alto que `maximo` son varios elementos unidos por un puente fino
    (una roca pegada a un tejado): apertura morfológica creciente hasta que se parte en trozos
    grandes; los píxeles que quita la apertura vuelven al trozo más cercano (a <= 8 px) y el resto
    (puentes, hilos) se descarta."""
    objs = ndi.find_objects(comp)
    siguiente = n + 1
    for k, sl in enumerate(objs, start=1):
        if sl is None:
            continue
        h, w = sl[0].stop - sl[0].start, sl[1].stop - sl[1].start
        if w <= maximo and h <= maximo:
            continue
        m = comp[sl] == k
        for r in (3, 5, 7, 9, 13):
            ab = ndi.binary_opening(m, structure=np.ones((r, r)))
            lab2, n2 = ndi.label(ab, structure=np.ones((3, 3)))
            tam = ndi.sum(ab, lab2, index=np.arange(1, n2 + 1))
            grandes = [i + 1 for i, t in enumerate(tam) if t > 150 * X * X]
            if len(grandes) < 2:
                continue
            lab2[~np.isin(lab2, grandes)] = 0
            dist, (iy, ix) = ndi.distance_transform_edt(lab2 == 0, return_indices=True)
            resto = m & (lab2 == 0) & (dist <= 8)
            lab2[resto] = lab2[iy[resto], ix[resto]]
            nuevo = np.where(lab2 > 0, lab2 + siguiente - 1, 0)
            sub = comp[sl]
            sub[m] = nuevo[m]
            siguiente += n2
            print(f"  componente {k} ({w // X}x{h // X}) partido en {len(grandes)} con apertura {r}")
            break
        else:
            print(f"  componente {k} ({w // X}x{h // X}) no se pudo partir")
    # Etiquetas compactas sin volver a unir los trozos (son vecinos): numerar las que quedan.
    if siguiente == n + 1:
        return comp, n
    vals, inv = np.unique(comp, return_inverse=True)
    comp = inv.reshape(comp.shape).astype(np.int32)
    if vals[0] != 0:
        comp += 1
    return partir_pegados(comp, int(comp.max()), maximo)


def postprocesar(rgba, ajuste):
    """Recorta el sprite a un polígono y/o quita el verde claro de parche; se queda con la pieza
    mayor y vuelve a suavizar el borde (1 px)."""
    alfa = rgba[..., 3].astype(np.float32) / 255
    if "poligono" in ajuste:
        m = np.zeros(alfa.shape, np.uint8)
        cv2.fillPoly(m, [np.array(ajuste["poligono"], np.int32)], 1)
        alfa *= m
    if ajuste.get("sin_verde_claro"):
        r, g, b = (rgba[..., i].astype(int) for i in range(3))
        # Verde amarillento de parche (azul bajo), no el verde azulado claro de la copa; solo por
        # debajo de `desde_y`.
        claro = (g - r >= 36) & (g >= 150) & (b < g - 60) & (alfa > 0)
        claro[:ajuste.get("desde_y", 0)] = False
        claro = ndi.binary_dilation(claro, iterations=2) & (alfa > 0)
        alfa[claro] = 0
    if "sombra" in ajuste:
        # La sombra proyectada (verde oscuro, no el tronco marrón) se vuelve translúcida y se
        # desvanece en elipse desde el pie del tronco: sin bordes rectos.
        sb = ajuste["sombra"]
        r, g, b = (rgba[..., i].astype(int) for i in range(3))
        yy, xx = np.mgrid[0:alfa.shape[0], 0:alfa.shape[1]]
        es_sombra = (alfa > 0) & (yy >= sb["desde_y"]) & (g > r + 12) & (np.maximum(np.maximum(r, g), b) < 160)
        d = np.sqrt(((xx - sb["centro"][0]) / sb["rx"]) ** 2 + ((yy - sb["centro"][1]) / sb["ry"]) ** 2)
        fade = np.clip((1.0 - d) / 0.4, 0, 1).astype(np.float32) * sb.get("alfa", 1.0)
        fade = cv2.GaussianBlur(fade, (0, 0), 2.0)
        alfa = np.where(es_sombra, alfa * fade, alfa)
    if ajuste.get("sin_sombra_verde"):
        # Sombra proyectada de los dibujos generados sobre verde liso: verde apagado mas oscuro que el
        # fondo (no el parche de hierba claro ni la copa de un arbol, que son mas claros o azulados).
        r, g, b = (rgba[..., i].astype(int) for i in range(3))
        sombra = (g - r >= 20) & (g - b >= 10) & (g < 160) & (g > 100) & (alfa > 0)
        sombra = ndi.binary_dilation(sombra, iterations=2) & (alfa > 0)
        alfa[sombra] = 0
    if ajuste.get("sin_arena"):
        r, g, b = (rgba[..., i].astype(int) for i in range(3))
        arena = (r - b > 60) & (g > 150) & (r > 170) & (alfa > 0)
        arena = ndi.binary_dilation(arena, iterations=2) & (alfa > 0)
        alfa[arena] = 0
    lab, n = ndi.label(alfa > 0.05)
    if n > 1:
        tam = ndi.sum(alfa > 0.05, lab, index=np.arange(1, n + 1))
        alfa = np.where(lab == int(np.argmax(tam)) + 1, alfa, 0)
    out = rgba.copy()
    # Línea oscura a lo largo de los cortes (solo donde hay sprite).
    segs = [np.array(sg, np.int32) for sg in ajuste.get("contorno", [])]
    if ajuste.get("contorno_poligono") and "poligono" in ajuste:
        segs.append(np.array(ajuste["poligono"] + ajuste["poligono"][:1], np.int32))
    if segs:
        m = np.zeros(alfa.shape, np.uint8)
        cv2.polylines(m, segs, False, 1, thickness=CONTORNO_ANCHO)
        donde = (m > 0) & (alfa > 0.5)
        out[donde, :3] = CONTORNO
        # Pequeño desenfoque del color en la unión para que no quede un filo duro.
        borde = ndi.binary_dilation(donde, iterations=2) & (alfa > 0.5)
        suave = cv2.GaussianBlur(out[..., :3], (0, 0), 1.0)
        out[borde & ~donde, :3] = suave[borde & ~donde]
    nucleo = ndi.binary_erosion(alfa > 0.5)
    alfa = np.where(nucleo, alfa, cv2.GaussianBlur(alfa, (0, 0), 0.8) * (alfa > 0))
    out[..., 3] = (alfa * 255).astype(np.uint8)
    ys, xs = np.nonzero(alfa > 0.01)
    return out[ys.min():ys.max() + 1, xs.min():xs.max() + 1]


def calcular_huella(rgba, tipo, base):
    """Rectángulo que bloquea el paso [x0, y0, x1, y1] en px del PNG (None = se pisa).
    Casa: el cuerpo (todo lo que no es el parche de hierba ni flores), desde su base hasta ~1/3 de su
    alto (la parte de suelo que ocupa en perspectiva 3/4). Roca: su base. Árbol: el tronco.
    Estanque: casi todo."""
    h, w = rgba.shape[:2]
    if tipo in ("piedras", "losa", "detalle", "piedrecita"):
        return None
    if tipo == "casa":
        op = rgba[..., 3] > 128
        hs = hsv(rgba[..., :3])
        verde = (hs[..., 0] >= 30) & (hs[..., 0] <= 60) & (hs[..., 1] > 60)
        naranja = (hs[..., 0] < 25) & (hs[..., 1] > 120) & (hs[..., 2] > 150)
        cuerpo = op & ~verde & ~naranja
        # Filas y columnas con bastante cuerpo (fuera quedan contornos sueltos del parche).
        filas = np.nonzero(cuerpo.sum(1) > w * 0.25)[0]
        cols = np.nonzero(cuerpo.sum(0) > h * 0.12)[0]
        if not len(filas) or not len(cols):
            return [int(w * 0.15), int(base - h * 0.3), int(w * 0.85), base]
        y1, x0, x1 = int(filas.max()), int(cols.min()), int(cols.max())
        alto = y1 - int(filas.min())
        return [x0, int(y1 - alto * 0.32), x1, y1]
    if tipo == "roca":
        return [int(w * 0.12), int(base - h * 0.42), int(w * 0.88), int(base - h * 0.04)]
    if tipo == "arbol":
        return [int(w * 0.38), int(base - h * 0.14), int(w * 0.62), base]
    if tipo == "estanque":
        return [int(w * 0.04), int(base - h * 0.9), int(w * 0.96), int(base - h * 0.03)]
    return None


def parche_piedras(a, bg_local, zona, losas, nombre):
    """Suelo de piedras: las losas de la zona + la argamasa que las rodea (todo lo que no es césped a
    <= 9 px de una losa), en una pieza con el borde suavizado."""
    x0, y0, x1, y1 = [v * X for v in zona]
    sub = a[y0:y1, x0:x1].astype(np.float32)
    m = np.zeros(sub.shape[:2], bool)
    for (lx0, ly0, lx1, ly1), ml in losas:
        m[ly0 - y0:ly1 - y0, lx0 - x0:lx1 - x0] |= ml
    cerca = ndi.binary_dilation(m, iterations=9 * X)
    no_cesped = (sub[..., 1] - sub[..., 0]) < 6
    no_arena = (sub[..., 1] - sub[..., 2]) < 55   # la arena del dibujo (G - B ~ 75) no es argamasa (~35)
    patch = ndi.binary_fill_holes(cerca & no_cesped & no_arena)
    patch = ndi.binary_opening(patch, structure=np.ones((5, 5)))
    lab, n = ndi.label(patch)
    if n > 1:
        tam = ndi.sum(patch, lab, index=np.arange(1, n + 1))
        patch = lab == (int(np.argmax(tam)) + 1)
    alfa = cv2.GaussianBlur(patch.astype(np.float32), (0, 0), 2.0)
    alfa = np.clip((alfa - 0.3) / 0.4, 0, 1)
    al = alfa[..., None]
    bgl = bg_local[y0:y1, x0:x1]
    col = np.clip(np.where(al > 0.02, (sub - (1 - al) * bgl) / np.maximum(al, 0.02), sub), 0, 255)
    rgba = np.dstack([col, alfa * 255]).astype(np.uint8)
    ys, xs = np.nonzero(alfa > 0.01)
    rgba = rgba[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
    Image.fromarray(rgba).save(OUT / f"{nombre}.png")
    base = int(np.nonzero((rgba[..., 3] > 128).any(1))[0].max()) + 1
    print(f"  {nombre:12s} {rgba.shape[1]}x{rgba.shape[0]} ({len(losas)} losas)")
    return {"id": nombre, "tipo": "piedras", "archivo": f"{nombre}.png", "w": int(rgba.shape[1]), "h": int(rgba.shape[0]),
            "ancla": [rgba.shape[1] // 2, base], "origen": [zona[0] + MARCO, zona[1] + MARCO, zona[2] + MARCO, zona[3] + MARCO]}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--tol", type=float, default=28)
    ap.add_argument("--hoja", action="store_true")
    ap.add_argument("--min", type=int, default=40, help="área mínima (px del dibujo original)")
    ap.add_argument("--fuente-x2", default=str(RAIZ / "assets/ref/aldea_dibujo_x2.png"),
                    help="dibujo ya ampliado x2 (lab/tools/ampliar.py, RealESRGAN); con 'no', LANCZOS + bilateral")
    ap.add_argument("--imagen", help="otro dibujo (p. ej. generado con Klein sobre verde liso) en vez de la referencia")
    ap.add_argument("--marco", type=int, help="px de marco que quitar (con --imagen, 0 por defecto)")
    ap.add_argument("--salida", help="carpeta de salida (con --imagen, lab/assets/elementos_<nombre>/)")
    o = ap.parse_args()
    global REF, OUT, MARCO, AJUSTES, NOMBRES, CORTES, POST, FORZAR, ZONAS_PIEDRAS
    if o.imagen:
        # Dibujo generico: sin los ajustes a mano de la referencia.
        REF = Path(o.imagen)
        OUT = Path(o.salida) if o.salida else RAIZ / f"assets/elementos_{REF.stem}"
        MARCO = o.marco or 0
        AJUSTES, NOMBRES, CORTES, POST, FORZAR, ZONAS_PIEDRAS = {}, {}, [], {}, set(), {}
        POST = {"*": {"sin_sombra_verde": True}}   # Klein pinta una sombra proyectada verde: fuera
        if o.fuente_x2 == str(RAIZ / "assets/ref/aldea_dibujo_x2.png"):
            o.fuente_x2 = str(REF.with_name(REF.stem + "_x2.png"))   # si existe (ampliar.py --entrada/--salida)

    im = Image.open(REF).convert("RGB")
    W, H = im.size
    im = im.crop((MARCO, MARCO, W - MARCO, H - MARCO))
    a1 = np.asarray(im)
    if o.fuente_x2 != "no" and Path(o.fuente_x2).exists():
        big = Image.open(o.fuente_x2).convert("RGB")
        assert big.size == (W * X, H * X), f"{o.fuente_x2}: se esperaba {W * X}x{H * X}"
        a = np.asarray(big.crop((MARCO * X, MARCO * X, (W - MARCO) * X, (H - MARCO) * X))).copy()
        print("fuente x2:", o.fuente_x2)
    else:
        big = im.resize((im.width * X, im.height * X), Image.LANCZOS)
        a = np.asarray(big).copy()
        a = cv2.bilateralFilter(a, 7, 22, 5)
        a = cv2.bilateralFilter(a, 5, 16, 4)
        Image.fromarray(a).save(RAIZ / "assets/ref/x2_lanczos_bilateral.png")

    fondo = colores_fondo(a1)
    print("colores de fondo:", {k: [tuple(int(x) for x in c) for c in v] for k, v in fondo.items()})
    todos = [c for v in fondo.values() for c in v]
    d = dist_min(a, todos)
    es_fondo = d < o.tol
    # Inundar desde el borde (4-conexo): fondo exterior.
    lab, n = ndi.label(es_fondo, structure=[[0, 1, 0], [1, 1, 1], [0, 1, 0]])
    borde = np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))
    exterior = np.isin(lab, borde[borde > 0])
    # La línea de la orilla del mar (no la usamos) es fondo: todo lo que está a < 8 px del agua.
    agua = dist_min(a, fondo["agua"]) < o.tol
    cerca_agua = ndi.binary_dilation(agua, iterations=8 * X)
    exterior |= cerca_agua
    fg = ~exterior
    corte = np.zeros(fg.shape, np.uint8)
    for pts in CORTES:
        pts2 = np.array([[(x - MARCO) * X, (y - MARCO) * X] for x, y in pts], np.int32)
        cv2.polylines(corte, [pts2], False, 1, thickness=2 * X)
    fg &= corte == 0
    comp, n = ndi.label(fg, structure=np.ones((3, 3)))
    comp, n = partir_pegados(comp, n)
    areas = ndi.sum(np.ones_like(comp), comp, index=np.arange(1, n + 1))
    print(n, "componentes")

    # Color de fondo local (para el antialias): media gaussiana de los píxeles de fondo.
    peso = cv2.GaussianBlur(exterior.astype(np.float32), (0, 0), 12)
    suma = cv2.GaussianBlur(a.astype(np.float32) * exterior[..., None], (0, 0), 12)
    bg_local = suma / np.maximum(peso, 1e-4)[..., None]

    OUT.mkdir(parents=True, exist_ok=True)
    objetos = []
    cuenta = {}
    losas_zona = {}
    for k in range(1, n + 1):
        area1 = areas[k - 1] / (X * X)
        if area1 < o.min:
            continue
        m = comp == k
        ys, xs = np.nonzero(m)
        y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
        toca = x0 <= 1 or y0 <= 1 or x1 >= a.shape[1] - 1 or y1 >= a.shape[0] - 1
        if any(abs(fx - (x0 + x1) / 2 / X) < 25 and abs(fy - (y0 + y1) / 2 / X) < 25 for fx, fy in FORZAR):
            toca = False
        sub = a[y0:y1, x0:x1]
        msub = ndi.binary_fill_holes(m[y0:y1, x0:x1])
        medio = sub[msub].mean(0)
        hs = hsv(sub[msub])
        azul = ((hs[:, 0] >= 85) & (hs[:, 0] <= 105) & (hs[:, 1] > 100)).mean() > 0.05
        cx, cy = int((x0 + x1) / 2 / X), int((y0 + y1) / 2 / X)
        tipo = clasificar(area1, medio, (x0 / X, y0 / X, x1 / X, y1 / X), azul, toca)
        for (ax, ay), t in AJUSTES.items():
            if abs(ax - cx) < 25 and abs(ay - cy) < 25:
                tipo = t
        if tipo is None or tipo == "ruido":
            continue
        if toca and (tipo in ("arbol", "casa", "roca", "estanque", "piedras") or area1 > 1500):
            print(f"  (cortado por el borde, se descarta) {tipo} en ({cx},{cy})")
            continue
        hm, sm, vm = hsv(np.array([medio]))[0]
        if tipo == "detalle" and vm > 185 and sm < 70:
            tipo = "losa"
        # Piedrecitas y motas apagadas (marrón, poca saturación): se guardan pero no se dispersan.
        if tipo == "detalle" and (sm < 80 or (hm < 20 and vm < 170)):
            tipo = "piedrecita"
        # Hilos y líneas (restos de un corte, sombras finas): no son detalles.
        bw, bh = (x1 - x0) / X, (y1 - y0) / X
        if tipo in ("detalle", "piedrecita") and (bw / bh > 4 or bh / bw > 4 or area1 < 0.22 * bw * bh):
            print(f"  (hilo, se descarta) detalle en ({cx},{cy}) {int(bw)}x{int(bh)}")
            continue
        for nz, (zx0, zy0, zx1, zy1) in ZONAS_PIEDRAS.items():
            if tipo == "losa" and zx0 * X <= x0 and x1 <= zx1 * X and zy0 * X <= y0 and y1 <= zy1 * X:
                losas_zona.setdefault(nz, []).append(((x0, y0, x1, y1), msub))
        # Alfa: dentro 1; en el borde según la distancia al color del fondo local.
        pad = 4
        Y0, Y1, X0, X1 = max(0, y0 - pad), min(a.shape[0], y1 + pad), max(0, x0 - pad), min(a.shape[1], x1 + pad)
        rgb = a[Y0:Y1, X0:X1].astype(np.float32)
        bgl = bg_local[Y0:Y1, X0:X1]
        dl = np.sqrt(((rgb - bgl) ** 2).sum(-1))
        lleno = np.zeros((Y1 - Y0, X1 - X0), bool)
        lleno[y0 - Y0:y1 - Y0, x0 - X0:x1 - X0] = msub
        # Núcleo: la máscara erosionada 1 px es opaca; el anillo exterior toma el antialias por color.
        nucleo = ndi.binary_erosion(lleno, iterations=1)
        anillo = ndi.binary_dilation(lleno, iterations=1) & ~nucleo
        alfa = nucleo.astype(np.float32)
        a_borde = np.clip((dl - 8) / (o.tol - 8), 0, 1)
        alfa[anillo] = a_borde[anillo]
        alfa = cv2.GaussianBlur(alfa, (0, 0), 0.6)
        alfa = np.where(nucleo, 1.0, alfa)
        alfa = np.where(ndi.binary_dilation(lleno, iterations=2), alfa, 0.0)
        # Desmezclado del borde: quitar la parte de fondo.
        al = alfa[..., None]
        col = np.where(al > 0.02, (rgb - (1 - al) * bgl) / np.maximum(al, 0.02), rgb)
        col = np.clip(col, 0, 255)
        rgba = np.dstack([col, alfa * 255]).astype(np.uint8)
        ys2, xs2 = np.nonzero(alfa > 0.01)
        ry0, ry1, rx0, rx1 = ys2.min(), ys2.max() + 1, xs2.min(), xs2.max() + 1
        rgba = rgba[ry0:ry1, rx0:rx1]
        nombre = next((nm for (nx, ny), nm in NOMBRES.items() if x0 <= nx * X < x1 and y0 <= ny * X < y1 and msub[int(ny * X - y0), int(nx * X - x0)]), None)
        if nombre is None:
            i = cuenta.get(tipo, 0)
            cuenta[tipo] = i + 1
            nombre = f"{tipo}_{i}"
        if nombre in POST or "*" in POST:
            rgba = postprocesar(rgba, POST.get(nombre, POST.get("*")))
        Image.fromarray(rgba).save(OUT / f"{nombre}.png")
        base = int(np.nonzero((rgba[..., 3] > 128).any(1))[0].max()) + 1
        huella = calcular_huella(rgba, tipo, base)
        objetos.append({
            "id": nombre, "tipo": tipo, "archivo": f"{nombre}.png", "w": int(rgba.shape[1]), "h": int(rgba.shape[0]),
            "ancla": [rgba.shape[1] // 2, base], "huella": huella,
            "origen": [int(x0 / X + MARCO), int(y0 / X + MARCO), int(x1 / X + MARCO), int(y1 / X + MARCO)],
            "area": int(area1), "medio": [int(v) for v in medio],
        })
        print(f"  {nombre:12s} area {int(area1):6d}  bbox {int(x0/X)},{int(y0/X)}-{int(x1/X)},{int(y1/X)}  medio {tuple(int(v) for v in medio)}")

    for nz, zona in ZONAS_PIEDRAS.items():
        if nz in losas_zona:
            objetos.append(parche_piedras(a, bg_local, zona, losas_zona[nz], nz))
    (OUT / "elementos.json").write_text(json.dumps({"escala": X, "elementos": objetos}, indent=1, ensure_ascii=False), encoding="utf-8")
    print("guardado", OUT / "elementos.json", len(objetos), "elementos")

    if o.hoja:
        hoja(objetos)


def hoja(objetos):
    """Hoja de contacto: cada elemento sobre fondo gris a 1/2 (= tamaño del dibujo), con su id."""
    from PIL import ImageDraw
    celdas = []
    for ob in objetos:
        im = Image.open(OUT / ob["archivo"]).convert("RGBA")
        im = im.resize((max(1, im.width // 2), max(1, im.height // 2)), Image.LANCZOS)
        celdas.append((ob["id"], im))
    ancho = 1400
    x = y = 4
    filah = 0
    pos = []
    for nombre, im in celdas:
        w, h = im.width + 8, im.height + 22
        if x + w > ancho:
            x = 4
            y += filah
            filah = 0
        pos.append((x, y))
        x += w
        filah = max(filah, h)
    alto = y + filah + 4
    out = Image.new("RGBA", (ancho, alto), (120, 120, 120, 255))
    dr = ImageDraw.Draw(out)
    for (nombre, im), (px, py) in zip(celdas, pos):
        out.alpha_composite(im, (px + 4, py + 18))
        dr.text((px + 4, py + 2), nombre, fill=(255, 255, 255, 255))
    out.convert("RGB").save(OUT / "hoja.png")
    print("hoja:", OUT / "hoja.png")


if __name__ == "__main__":
    main()
