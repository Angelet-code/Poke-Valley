"""Barreras y piezas para construir en estilo Arcane (docs/art/ARCANE.md, "Muros y barreras").

Uso: python -I lab/tools/tiras_arcane.py [--solo <bioma>/<pieza>[_v] ...] [--hoja]      (desde la raíz del repo)
     python -I lab/tools/tiras_arcane.py --semillas            → assets/gen/arcane/muros/<bioma>/hoja.png (las 2 semillas)

Entrada: assets/gen/arcane/muros/<bioma>/<pieza>[_v]_s<N>_0.png (gen.sh, piezas.txt) y la semilla elegida de cada una
en muros/elegidos.json ({"<bioma>/<pieza>[_v]": N}, 1 si no está).

Cada imagen se amplía ×2 (ampliar.py, se reutiliza <img>_x2.png) y se recorta con recortar.py. Luego, según su forma:
- **S (suelta)**: montaña y arboleda, una pieza grande que no se cruza. Id `<pieza>_<bioma>`.
- **H (tira horizontal)**: acantilado, muro, valla y puente. Se endereza (la base de cada columna sobre una recta) y se
  parte en tres: `<pieza>_<bioma>_izq`, `_tramo` y `_der`. El tramo se repite sin junta: su final pasa al principio por
  una costura de corte mínimo (el camino de menor diferencia entre las dos bandas, como en el quilting), y el extremo
  derecho empieza con otra costura desde el principio del tramo. Así izq + tramo × n + der se lee como una sola pieza.
  Se buscan los cortes con menos error (rejilla de 8 px).
- **V (tira vertical)**: lo mismo a lo largo de y (`_arr`, `_tramo`, `_abj`). Antes se corrige la perspectiva: cada fila
  se estira para que los bordes izquierdo y derecho (rectas ajustadas) queden paralelos.
- **Inserto** (escalera en el acantilado, portón en el muro): el centro de la imagen, escalado al alto del tramo de su
  tira, con costuras al tramo por los dos lados: va entre dos tramos.

Todas las piezas de una tira comparten alto (H) o ancho (V) y la misma base, para encadenarlas con la misma y (o x).
Tamaño en el mundo: ALTO (H, alto de la tira) / ANCHO_V (V, ancho) / ANCHO_S (suelta). Salen en
lab/assets/elementos_arcane/ (tipo "muro", "puente" o "roca") y se añaden a elementos.json con "tira": {...}.
`--hoja`: lab/assets/elementos_arcane/hoja_muros.png, cada tira montada izq + 3 tramos + der.
"""
import argparse
import json
import subprocess
import sys
from pathlib import Path

import cv2
import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage as ndi

RAIZ = Path(__file__).resolve().parents[1]          # lab/
REPO = RAIZ.parent
OUT = RAIZ / "assets/elementos_arcane"
MUROS = REPO / "assets/gen/arcane/muros"
F, PNG_X = 1 / 3, 2
sys.path.insert(0, str(RAIZ / "tools"))
from recortar import recortar  # noqa: E402

# Alto en el mundo (px) de cada tira horizontal, ancho de cada vertical y ancho de las sueltas.
ALTO = {"acantilado": 76, "muro": 40, "valla": 26, "puente": 46}
ANCHO_V = {"acantilado": 70, "muro": 30, "valla": 16, "puente": 44}
ANCHO_S = {"montana": 190, "arboleda": 170}
INSERTO = {"escalera": "acantilado", "porton": "muro"}   # inserto → la tira donde va
HUECOS = {"valla", "puente", "arboleda"}                 # se abren los huecos de fondo entre tablas, postes y ramas
TIPO = {"puente": "puente", "montana": "roca", "arboleda": "roca"}   # el resto, "muro"


# ---------- utilidades de imagen (RGBA float, color premultiplicado para mezclar sin halo verde) ----------
def pre(a):
    f = a.astype(np.float32) / 255
    f[..., :3] *= f[..., 3:4]
    return f


def post(f):
    al = f[..., 3:4]
    rgb = np.where(al > 1e-3, f[..., :3] / np.maximum(al, 1e-3), 0)
    return (np.clip(np.dstack([rgb, al]), 0, 1) * 255 + 0.5).astype(np.uint8)


def costura(A, B):
    """Banda de transición de A (izquierda) a B (derecha), mismo tamaño (h, o, 4) premultiplicadas. Camino vertical de
    menor diferencia (programación dinámica, ±1 px por fila); a su izquierda A, a su derecha B, fundido de 3 px.
    Devuelve (banda, coste medio por fila)."""
    h, o = A.shape[:2]
    e = np.abs(A - B).sum(-1)
    e[:, :2] += 1e3
    e[:, -2:] += 1e3   # el camino no puede ir por el borde de la banda
    acu = e.copy()
    for y in range(1, h):
        p = acu[y - 1]
        m = np.minimum(p, np.minimum(np.r_[np.inf, p[:-1]], np.r_[p[1:], np.inf]))
        acu[y] += m
    cam = np.zeros(h, int)
    cam[-1] = int(np.argmin(acu[-1]))
    for y in range(h - 2, -1, -1):
        x = cam[y + 1]
        lo, hi = max(0, x - 1), min(o, x + 2)
        cam[y] = lo + int(np.argmin(acu[y, lo:hi]))
    xs = np.arange(o)[None, :]
    mB = np.clip((xs - cam[:, None] + 1.5) / 3, 0, 1)[..., None]
    coste = float(e[np.arange(h), cam].sum() / h) if h else 0.0
    return A * (1 - mB) + B * mB, coste


def extremos(m, eje):
    """Primera y última fila (eje=0) o columna (eje=1) con alfa."""
    idx = np.nonzero(m.any(1 - eje))[0]
    return int(idx.min()), int(idx.max()) + 1


def nivelar(rgba):
    """Tira horizontal: desplaza cada columna en vertical para que la base (última fila opaca) quede sobre una recta
    horizontal (recta ajustada a las bases del 80 % central, sin los extremos)."""
    m = rgba[..., 3] > 128
    H, W = m.shape
    x0, x1 = extremos(m, 1)
    cols = np.arange(x0, x1)
    base = np.array([np.nonzero(m[:, c])[0].max() if m[:, c].any() else -1 for c in cols], float)
    ok = base >= 0
    c80 = (cols > x0 + (x1 - x0) * 0.1) & (cols < x1 - (x1 - x0) * 0.1) & ok
    pend, cte = np.polyfit(cols[c80], ndi.median_filter(base, 31)[c80], 1)
    pad = int(abs(pend) * W) + 4
    out = np.zeros((H + 2 * pad, W, 4), np.uint8)
    xm = (x0 + x1) / 2
    for c in range(W):
        d = int(round(-pend * (c - xm)))
        out[pad + d:pad + d + H, c] = rgba[:, c]
    return out


def enderezar_v(rgba):
    """Tira vertical: los bordes izquierdo y derecho de cada fila (rectas ajustadas al 80 % central) pasan a ser
    verticales y paralelos; cada fila se reescala en horizontal (corrige la perspectiva que estrecha lo lejano)."""
    m = rgba[..., 3] > 128
    H, W = m.shape
    y0, y1 = extremos(m, 0)
    filas = np.arange(y0, y1)
    iz = np.array([np.nonzero(m[f])[0].min() if m[f].any() else -1 for f in filas], float)
    de = np.array([np.nonzero(m[f])[0].max() if m[f].any() else -1 for f in filas], float)
    ok = (iz >= 0) & (filas > y0 + (y1 - y0) * 0.1) & (filas < y1 - (y1 - y0) * 0.1)
    pi = np.polyfit(filas[ok], ndi.median_filter(iz, 41)[ok], 1)
    pd = np.polyfit(filas[ok], ndi.median_filter(de, 41)[ok], 1)
    ym = (y0 + y1) / 2
    L0, R0 = np.polyval(pi, ym), np.polyval(pd, ym)
    ancho0 = R0 - L0
    Wn = int(W * 1.3)
    out = np.zeros((H, Wn, 4), np.uint8)
    xs_out = np.arange(Wn, dtype=np.float32)
    cx = Wn / 2
    for f in range(H):
        L, R = np.polyval(pi, f), np.polyval(pd, f)
        esc = (R - L) / ancho0
        # x de salida → x de entrada: el centro de la fila al centro y la anchura a ancho0
        src = (L + R) / 2 + (xs_out - cx) * esc
        mapx = src[None, :].astype(np.float32)
        mapy = np.full_like(mapx, f)
        out[f] = cv2.remap(rgba, mapx, mapy, cv2.INTER_LINEAR, borderMode=cv2.BORDER_CONSTANT, borderValue=0)[0]
    return out


def recorte_x2(img, tipo_hueco, min_hueco=None):
    x2 = img.with_name(img.stem + "_x2.png")
    if not x2.exists():
        subprocess.run([sys.executable, "-I", str(RAIZ / "tools/ampliar.py"), "--modelo", "RealESRGAN_x4plus_anime_6B.safetensors",
                        "--entrada", str(img), "--salida", str(x2)], check=True)
    tmp = MUROS / "_recortes"
    e = recortar(x2, img.stem, "roca", tmp, abrir_huecos=tipo_hueco, min_hueco=min_hueco or (40 if tipo_hueco else 1500))
    return np.asarray(Image.open(tmp / e["archivo"]).convert("RGBA")).copy(), e, tmp


# ---------- kit de una tira horizontal ----------
def kit_h(rgba):
    """rgba: tira ya nivelada. Devuelve (izq, tramo, der) premultiplicados y recortados al mismo alto, y los costes."""
    S = pre(rgba)
    m = rgba[..., 3] > 128
    x0, x1 = extremos(m, 1)
    y0, y1 = extremos(m, 0)
    S = S[y0:y1]
    Wt = x1 - x0
    alto = y1 - y0
    O = int(np.clip(alto * 0.35, 48, 200))   # banda de costura
    cap = int(Wt * 0.12)
    # búsqueda en ×1/4 (S4) con rejilla de 8 px (2 px en S4)
    S4 = cv2.resize(S, (S.shape[1] // 4, S.shape[0] // 4), interpolation=cv2.INTER_AREA)
    o4 = O // 4

    def c4(xa, xb):   # coste de pasar de la columna xa a la xb (bandas de ancho O)
        return costura(S4[:, xa // 4:xa // 4 + o4], S4[:, xb // 4:xb // 4 + o4])[1]

    mejor = (np.inf, None)
    for P in range(int(Wt * 0.32), int(Wt * 0.5), 16):
        for a in range(x0 + cap + O, x1 - cap - P - O, 16):
            if a + P + O > x1:
                break
            ct = c4(a + P - O, a - O)            # final del tramo → su principio (repetición)
            if ct >= mejor[0]:
                continue
            # extremo derecho: del principio del tramo (a) a una b del último cuarto
            cb = min((c4(a, b), b) for b in range(max(a + P, x1 - cap - O - int(Wt * 0.12)), x1 - cap - O + 1, 16))
            tot = ct + 0.6 * cb[0]
            if tot < mejor[0]:
                mejor = (tot, (P, a, cb[1]))
    P, a, b = mejor[1]
    a -= x0
    b -= x0
    S = S[:, x0:x1]
    t, ct = costura(S[:, a + P - O:a + P], S[:, a - O:a])
    tramo = np.concatenate([S[:, a:a + P - O], t], 1)
    izq = S[:, :a]
    r, cr = costura(S[:, a:a + O], S[:, b:b + O])
    der = np.concatenate([r, S[:, b + O:]], 1)
    return izq, tramo, der, (ct, cr)


def inserto(rgba, tramo):
    """Escalera o portón: el centro de la imagen al alto del tramo, con costuras al tramo a los dos lados (el tramo es
    periódico: lo que sigue a su final es su principio)."""
    m = rgba[..., 3] > 128
    x0, x1 = extremos(m, 1)
    y0, y1 = extremos(m, 0)
    E = pre(rgba[y0:y1, x0:x1])
    W = x1 - x0
    E = E[:, int(W * 0.2):int(W * 0.8)]
    hT = tramo.shape[0]
    E = cv2.resize(E, (int(E.shape[1] * hT / E.shape[0]), hT), interpolation=cv2.INTER_AREA)
    O = min(int(hT * 0.35), tramo.shape[1] // 3, E.shape[1] // 4)
    iz, _ = costura(tramo[:, :O], E[:, :O])                  # después de un tramo viene su principio
    de, _ = costura(E[:, -O:], tramo[:, -O:])                # antes de un tramo, su final
    return np.concatenate([iz, E[:, O:-O], de], 1)


# ---------- catálogo ----------
def guardar(id_, f, tipo, k, out, extra):
    a = post(f)
    al = a[..., 3]
    al[al < 4] = 0
    Image.fromarray(a).save(out / f"{id_}.png")
    h, w = a.shape[:2]
    m = al > 128
    base = int(np.nonzero(m.any(1))[0].max()) + 1
    return {"id": id_, "tipo": tipo, "archivo": f"{id_}.png", "w": w, "h": h, "ancla": [w // 2, base], "k": round(k, 4), **extra}


def huella_h(pieza, w, h, base):
    """Banda del suelo que ocupa una tira horizontal en 3/4: el pie del muro (un tercio del alto en el acantilado)."""
    if pieza == "puente":
        return None
    prof = {"acantilado": 0.34, "muro": 0.42, "valla": 0.35}.get(pieza, 0.4)
    return [0, int(base - h * prof), w, base]


def procesar(bio, pieza, forma, sel, hechos):
    n = pieza + ("_v" if forma == "V" else "")
    img = MUROS / bio / f"{n}_s{sel.get(f'{bio}/{n}', 1)}_0.png"
    if not img.exists():
        print("falta", img)
        return
    if pieza in INSERTO:
        return   # se hacen después de su tira
    rgba, er, tmp = recorte_x2(img, pieza in HUECOS)
    tipo = TIPO.get(pieza, "muro")
    base_id = f"{pieza}_{bio}"
    org = img.resolve().as_posix().replace(REPO.resolve().as_posix() + "/", "")
    if forma == "S":
        f = pre(rgba)
        k = ANCHO_S[pieza] / (rgba.shape[1] * F / PNG_X)
        e = guardar(base_id, f, tipo, k, OUT, {"origen": org})
        if er.get("sombra"):   # la sombra pintada por Klein, aparte (como en catalogo_arcane.py)
            so = dict(er["sombra"], archivo=f"{base_id}_sombra.png")
            Image.open(tmp / er["sombra"]["archivo"]).save(OUT / so["archivo"])
            e["sombra"] = so
        h, w, b = e["h"], e["w"], e["ancla"][1]
        e["huella"] = [int(w * 0.08), int(b - h * 0.5), int(w * 0.92), int(b - h * 0.03)]
        hechos[base_id] = e
        print(f"{base_id:24s} {w}x{h} k={e['k']}")
        return
    if forma == "H":
        izq, tramo, der, cos = kit_h(nivelar(rgba))
        k = ALTO[pieza] / (tramo.shape[0] * F / PNG_X)
        partes = {"izq": izq, "tramo": tramo, "der": der}
        # insertos de esta tira
        for ins, tira in INSERTO.items():
            if tira != pieza:
                continue
            ii = MUROS / bio / f"{ins}_s{sel.get(f'{bio}/{ins}', 1)}_0.png"
            if ii.exists():
                r2, _, _ = recorte_x2(ii, ins == "porton", 1500)   # el hueco de la puerta, transparente
                partes[ins] = inserto(nivelar(r2), tramo)
    else:
        rv = enderezar_v(rgba)
        tr = lambda f: np.ascontiguousarray(np.transpose(f, (1, 0, 2)))
        # la tira vertical es una horizontal traspuesta (sin nivelar: ya está enderezada)
        izq, tramo, der, cos = kit_h(np.ascontiguousarray(np.transpose(rv, (1, 0, 2))))
        partes = {"arr": tr(izq), "tramo": tr(tramo), "abj": tr(der)}
        k = ANCHO_V[pieza] / (partes["tramo"].shape[1] * F / PNG_X)
        base_id = f"{pieza}_v_{bio}"
    for nom, f in partes.items():
        id_ = f"{base_id}_{nom}" if nom in ("izq", "tramo", "der", "arr", "abj") else f"{nom}_{bio}"
        e = guardar(id_, f, tipo, k, OUT, {"origen": org, "tira": {"id": base_id, "parte": nom, "forma": forma}})
        h, w, b = e["h"], e["w"], e["ancla"][1]
        if forma == "H":
            e["huella"] = huella_h(pieza, w, h, b) if nom != "porton" else None
            if nom in ("porton", "escalera"):   # se pasa por el centro: huella solo en los lados
                e["huella"] = None
                e["huellas"] = [[0, int(b - h * 0.4), int(w * 0.3), b], [int(w * 0.7), int(b - h * 0.4), w, b]]
                if nom == "escalera":
                    e["huellas"] = [[0, int(b - h * 0.34), int(w * 0.32), b], [int(w * 0.68), int(b - h * 0.34), w, b]]
        else:
            e["huella"] = None if pieza == "puente" else [int(w * 0.12), int(h * 0.05) if nom != "arr" else int(h * 0.3), int(w * 0.88), b]
        hechos[id_] = e
        print(f"{id_:28s} {w}x{h} k={e['k']}" + (f"  costuras {cos[0]:.1f}/{cos[1]:.1f}" if nom == "tramo" else ""))


def hoja_muros(hechos):
    """Cada tira montada: H = izq + tramo×3 + der (y una fila con su inserto), V = arr + tramo×3 + abj; sueltas aparte."""
    Z = 2.0   # px de la hoja por px de mundo (cada pieza a su tamaño real)
    filas = []
    bios = ["comun", "costa", "cantera", "pantano", "ruinas", "volcan", "nieve"]
    bios += sorted({e["id"].rsplit("_", 1)[-1] for e in hechos.values() if "tira" in e and e["tira"]["forma"] == "S"} - set(bios))
    bios += sorted({e["tira"]["id"].rsplit("_", 1)[-1] for e in hechos.values() if "tira" in e} - set(bios))
    for bio in bios:
        ims = []
        for p in ("acantilado", "muro", "valla", "puente"):
            g = lambda s: hechos.get(f"{p}_{bio}_{s}")
            if g("tramo"):
                seq = [g("izq")] + [g("tramo")] * 3 + [g("der")]
                ins = [k for k, t in INSERTO.items() if t == p and f"{k}_{bio}" in hechos]
                if ins:
                    seq = [g("izq"), g("tramo"), hechos[f"{ins[0]}_{bio}"], g("tramo"), g("der")]
                ims.append(montar(seq, 1, Z))
        for p in ("acantilado", "muro", "valla", "puente"):
            g = lambda s: hechos.get(f"{p}_v_{bio}_{s}")
            if g("tramo"):
                ims.append(montar([g("arr")] + [g("tramo")] * 3 + [g("abj")], 0, Z))
        for p in ("montana", "arboleda"):
            if f"{p}_{bio}" in hechos:
                ims.append(montar([hechos[f"{p}_{bio}"]], 1, Z))
        if ims:
            filas.append((bio, ims))
    W = 1900
    bloques = []
    for bio, ims in filas:
        x = y = hfila = 0
        pos = []
        for im in ims:
            if x + im.width > W:
                x, y, hfila = 0, y + hfila + 10, 0
            pos.append((x, y))
            x += im.width + 14
            hfila = max(hfila, im.height)
        b = Image.new("RGB", (W, y + hfila + 30), (108, 128, 84))
        for im, (px, py) in zip(ims, pos):
            b.paste(im, (px, py + 24), im)
        ImageDraw.Draw(b).text((6, 4), bio, fill=(250, 250, 240))
        bloques.append(b)
    if not bloques:
        return
    hoja = Image.new("RGB", (W, sum(b.height for b in bloques)))
    y = 0
    for b in bloques:
        hoja.paste(b, (0, y))
        y += b.height
    hoja.save(OUT / "hoja_muros.png")
    print("hoja_muros", hoja.size)


def montar(seq, eje, Z):
    ims = [Image.open(OUT / e["archivo"]) for e in seq if e]
    if eje == 1:
        h = max(i.height for i in ims)
        out = Image.new("RGBA", (sum(i.width for i in ims), h))
        x = 0
        for i in ims:   # alineadas por la base
            out.alpha_composite(i, (x, h - i.height))
            x += i.width
    else:
        w = max(i.width for i in ims)
        out = Image.new("RGBA", (w, sum(i.height for i in ims)))
        y = 0
        for i in ims:
            out.alpha_composite(i, ((w - i.width) // 2, y))
            y += i.height
    z = Z * seq[0]["k"] * F / PNG_X
    return out.resize((max(1, int(out.width * z)), max(1, int(out.height * z))), Image.LANCZOS)


def hoja_semillas():
    for d in sorted(p for p in MUROS.iterdir() if p.is_dir() and not p.name.startswith("_") and p.name != "pruebas"):
        fs = sorted(d.glob("*_s[0-9]_0.png"))
        ids = sorted({f.name.rsplit("_s", 1)[0] for f in fs})
        Z = 300
        sheet = Image.new("RGB", (Z * 4, ((len(ids) + 1) // 2) * (Z // 2 + 70)), (40, 40, 40))
        dr = ImageDraw.Draw(sheet)
        for n, id_ in enumerate(ids):
            for s in (1, 2):
                f = d / f"{id_}_s{s}_0.png"
                x, y = ((n % 2) * 2 + s - 1) * Z, (n // 2) * (Z // 2 + 70)
                if f.exists():
                    im = Image.open(f).convert("RGB")
                    im.thumbnail((Z - 6, Z // 2 + 50))
                    sheet.paste(im, (x, y))
                dr.text((x + 4, y + Z // 2 + 54), f"{id_} s{s}", fill=(240, 240, 200))
        sheet.save(d / "hoja.png")
        print(d.name, len(ids))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--solo", nargs="*", default=[])
    ap.add_argument("--hoja", action="store_true")
    ap.add_argument("--semillas", action="store_true")
    o = ap.parse_args()
    if o.semillas:
        hoja_semillas()
        return
    cat_path = OUT / "elementos.json"
    cat = json.loads(cat_path.read_text(encoding="utf-8"))
    hechos = {e["id"]: e for e in cat["elementos"]}
    sel_p = MUROS / "elegidos.json"
    sel = json.loads(sel_p.read_text(encoding="utf-8")) if sel_p.exists() else {}
    if not o.hoja:
        for l in (MUROS / "piezas.txt").read_text(encoding="utf-8").splitlines():
            if not l.strip():
                continue
            bio, pieza, forma, _ = l.split("|", 3)
            n = pieza + ("_v" if forma == "V" else "")
            if o.solo and f"{bio}/{n}" not in o.solo:
                continue
            try:
                procesar(bio, pieza, forma, sel, hechos)
            except Exception as ex:   # una pieza mala no para las demás
                print("ERROR", bio, n, ex)
            cat_path.write_text(json.dumps({"escala": cat.get("escala", PNG_X), "elementos": list(hechos.values())}, indent=1, ensure_ascii=False), encoding="utf-8")
    hoja_muros(hechos)


if __name__ == "__main__":
    main()
