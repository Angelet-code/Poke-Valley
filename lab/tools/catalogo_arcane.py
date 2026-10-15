"""Monta el catálogo de elementos en estilo Arcane: lab/assets/elementos_arcane/ (plan docs/art/ARCANE.md).

Uso: python -I lab/tools/catalogo_arcane.py [--solo id ...]           (desde la raíz del repo)
     python -I lab/tools/catalogo_arcane.py --hoja <carpeta>           → <carpeta>/hoja.png con todas las semillas

Como catalogo_klein.py: por cada fila de ELEGIDOS amplía ×2 la imagen de Klein (RealESRGAN anime_6B, se guarda
<img>_x2.png y se reutiliza), la recorta con recortar.py (alfa + sombra aparte) y calcula `k` para que mida en el
mundo lo mismo que el elemento dibujo con ese id (elementos_klein/elementos.json), o ANCHO para los nuevos. Sin
vectorizar: el juego carga el PNG. El juego lo usa con ?set=arcane (src/render/Dibujo.ts: los ids que aún no estén
aquí salen del catálogo dibujo).
"""
import argparse
import json
import subprocess
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

RAIZ = Path(__file__).resolve().parents[1]          # lab/
REPO = RAIZ.parent
OUT = RAIZ / "assets/elementos_arcane"
KLEIN = RAIZ / "assets/elementos_klein/elementos.json"
F, PNG_X = 1 / 3, 2

# id → (tipo para la huella, imagen elegida relativa al repo). Fase 1: el lago (assets/gen/arcane/lago/gen.sh).
L = "assets/gen/arcane/lago"
BQ = "assets/gen/arcane/bosque"
ELEGIDOS = {
    "arbol_alto": ("arbol", f"{L}/arbol_alto_s1_0.png"),
    "arbol_bajo": ("arbol", f"{L}/arbol_bajo_s3_0.png"),
    "arbusto": ("roca", f"{L}/arbusto_s2_0.png"),
    "roca_0": ("roca", f"{L}/roca_0_s2_0.png"),
    "roca_2": ("roca", f"{L}/roca_2_s1_0.png"),
    "roca_4": ("roca", f"{L}/roca_4_s2_0.png"),
    "roca_6": ("roca", f"{L}/roca_6_s1_0.png"),
    "tocon": ("roca", f"{L}/tocon_s1_0.png"),
    "flores": ("detalle", f"{L}/flores_s1_0.png"),
    "piedras_0": ("piedras", f"{L}/piedras_0_s2_0.png"),
    "sauce": ("arbol", f"{L}/sauce_s2_0.png"),
    "juncos": ("roca", f"{L}/juncos_s2_0.png"),
    "muelle": ("roca", f"{L}/muelle_s2_0.png"),
    "nenufar": ("detalle", f"{L}/nenufar_s2_0.png"),
    # Fase 2: el Bosque Verde (assets/gen/arcane/bosque/gen.sh) y el poste de las salidas.
    "estanque": ("estanque", f"{BQ}/estanque_s3_0.png"),
    "roca_1": ("roca", f"{BQ}/roca_1_s2_0.png"),
    "roca_3": ("roca", f"{BQ}/roca_3_s1_0.png"),
    "roca_5": ("roca", f"{BQ}/roca_5_s2_0.png"),
    "roca_7": ("roca", f"{BQ}/roca_7_s1_0.png"),
    "roca_8": ("roca", f"{BQ}/roca_8_s1_0.png"),
    "seta": ("detalle", f"{BQ}/seta_s1_0.png"),
    "tronco_caido": ("roca", f"{BQ}/tronco_caido_s2_0.png"),
    "arbol_viejo": ("arbol", f"{BQ}/arbol_viejo_s2_0.png"),
    "panal": ("roca", f"{BQ}/panal_s1_0.png"),
    "poste": ("roca", f"{BQ}/poste_s2_0.png"),
    # Fase 3: el pueblo (assets/gen/arcane/pueblo/gen.sh, repintado de la pieza dibujo; semillas en ELEGIDOS_PUEBLO).
}
PB = "assets/gen/arcane/pueblo"
ELEGIDOS_PUEBLO = {   # id → (tipo, semilla)
    "casa_grande": ("casa", 1), "casa_cabana": ("casa", 2), "casa_larga": ("casa", 1), "casa_chimenea": ("casa", 1),
    "tienda": ("casa", 2), "almacen": ("casa", 2), "pozo": ("roca", 1), "hoguera": ("roca", 1), "valla": ("roca", 1),
    "farola": ("roca", 1), "farola_madera": ("roca", 1), "camino_c": ("piedras", 1), "camino_d": ("piedras", 1),
    "camino_e": ("piedras", 1), "tablon": ("roca", 2),
}
ELEGIDOS.update({id_: (t, f"{PB}/{id_}_s{s}_0.png") for id_, (t, s) in ELEGIDOS_PUEBLO.items()})
# Los que tienen polígonos de suelo (SUELOS en src/render/Dibujo.ts): se guarda el ancla y la escala del dibujo.
REPINTADOS = set(ELEGIDOS_PUEBLO) - {"tablon"}
CON_SUELO = {"casa_grande", "almacen", "tienda", "casa_cabana", "casa_larga", "casa_chimenea"}
# Los que tienen dentro un hueco grande del color del fondo que debe verse transparente (el corral de la valla). En el
# resto los huecos se rellenan: el brillo verdoso de lo alto de las rocas tiene el color del fondo.
ABRIR_HUECOS = {"valla"}
# Piezas de biomas con huecos entre ramas, juncos o tablas (el fondo verde se veia entre ellos): se abren todos los
# huecos de color del fondo a partir de HUECO_FINO px. Rocas, estatuas y columnas no: ahi es brillo, no hueco.
HUECOS_FINOS = {"arbol_muerto", "juncos_secos", "cerca_rota", "hierba_duna", "andamio", "arbusto_seco", "pino_seco",
                "arbol_flores", "arco_ruinas", "farol_fuego_fatuo", "red_pesca", "palmera", "arbol_quemado", "pino_nevado"}
HUECO_FINO = 40
# Tipo en el juego distinto del de la huella: el nenúfar va a ras de suelo como un detalle, pero no puede ser
# "detalle", porque Aventura reparte los detalles por el césped (y saldrían nenúfares en la hierba).
TIPO_JUEGO = {"nenufar": "losa", "seta": "losa"}
# Ancho en px de mundo de los que no tienen equivalente en el catálogo dibujo.
ANCHO = {"sauce": 84, "juncos": 22, "muelle": 72, "nenufar": 30, "seta": 14, "tronco_caido": 48, "arbol_viejo": 130, "panal": 26, "poste": 20, "tablon": 40}
# Biomas futuros (docs/GDD-mundo.md §4): assets/gen/arcane/biomas/piezas.txt (bioma|id|tipo|ancho|descripción) y la
# semilla elegida de cada pieza en biomas/elegidos.json ({id: semilla}).
_BIO = REPO / "assets/gen/arcane/biomas"
if (_BIO / "elegidos.json").exists():
    _sel = json.loads((_BIO / "elegidos.json").read_text(encoding="utf-8"))
    for _l in (_BIO / "piezas.txt").read_text(encoding="utf-8").splitlines():
        if not _l.strip():
            continue
        _bio, _id, _tipo, _ancho, _ = _l.split("|", 4)
        if _id in _sel:
            ELEGIDOS[_id] = ("detalle" if _tipo == "losa" else _tipo, f"assets/gen/arcane/biomas/{_bio}/{_id}_s{_sel[_id]}_0.png")
            ANCHO[_id] = int(_ancho)
            if _tipo in ("losa", "detalle"):   # a ras de suelo, pero fuera del reparto de detalles por el césped
                TIPO_JUEGO[_id] = "losa"
# La ciudad (docs/art/ARCANE.md, "Ciudad"): assets/gen/arcane/ciudad/piezas.txt (id|tipo|ancho|descripción) y la semilla
# elegida en ciudad/elegidos.json ({id: semilla}, 1 si no está). Tipo de la lista → tipo de la huella: los edificios
# como casa (el cuerpo), farolas y postes como árbol (solo el pie).
_CIU = REPO / "assets/gen/arcane/ciudad"
_HUELLA_CIU = {"edificio": "casa", "farola": "arbol", "poste": "arbol"}
if (_CIU / "piezas.txt").exists():
    _sel = json.loads((_CIU / "elegidos.json").read_text(encoding="utf-8")) if (_CIU / "elegidos.json").exists() else {}
    for _l in (_CIU / "piezas.txt").read_text(encoding="utf-8").splitlines():
        if not _l.strip():
            continue
        _id, _tipo, _ancho, _ = _l.split("|", 3)
        ELEGIDOS[_id] = (_HUELLA_CIU.get(_tipo, _tipo), f"assets/gen/arcane/ciudad/{_id}_s{_sel.get(_id, 1)}_0.png")
        ANCHO[_id] = int(_ancho)
        if _tipo == "losa":
            TIPO_JUEGO[_id] = "losa"


def alinear(id_, klein, e):
    """Repintados (el pueblo): la imagen nueva conserva la posición de la pieza dibujo dentro del lienzo, pero su recorte
    puede ser más ancho (la sombra pintada a un lado). Se busca el desplazamiento d entre los dos recortes (máscaras
    reducidas ×1/8, el que más solapa) y se toman del dibujo el ancla (+d), la escala y la huella (+d): la pieza queda en
    el mismo sitio y al mismo tamaño en el mundo, y sus colisiones son las de siempre."""
    kk = klein[id_]
    ma = np.asarray(Image.open(OUT / e["archivo"]).getchannel("A")) > 128
    mk = np.asarray(Image.open(KLEIN.parent / kk["archivo"]).getchannel("A")) > 128
    red = lambda m: np.asarray(Image.fromarray(m.astype(np.uint8) * 255).resize((max(1, m.shape[1] // 8), max(1, m.shape[0] // 8)), Image.BOX)) > 127
    a, k = red(ma), red(mk)
    mejor, d = -1, (0, 0)
    for dy in range(-12, 13):
        for dx in range(-40, 41):
            ys0, xs0 = max(0, dy), max(0, dx)
            ys1, xs1 = min(a.shape[0], k.shape[0] + dy), min(a.shape[1], k.shape[1] + dx)
            if ys1 <= ys0 or xs1 <= xs0:
                continue
            n = int((a[ys0:ys1, xs0:xs1] & k[ys0 - dy:ys1 - dy, xs0 - dx:xs1 - dx]).sum())
            if n > mejor:
                mejor, d = n, (dx * 8, dy * 8)
    e["ancla"] = [kk["ancla"][0] + d[0], kk["ancla"][1] + d[1]]
    e["k"] = kk.get("k", 1)
    if kk.get("huella"):
        h = kk["huella"]
        e["huella"] = [h[0] + d[0], h[1] + d[1], h[2] + d[0], h[3] + d[1]]
    return d


def ancho_mundo(id_, klein):
    if id_ in klein:
        e = klein[id_]
        return e["w"] * F / PNG_X * e.get("k", 1)
    return ANCHO[id_]


def hoja(carpeta):
    c = Path(carpeta)
    fs = sorted(c.glob("*_s[0-9]_0.png"))
    ids = sorted({f.name.rsplit("_s", 1)[0] for f in fs})
    Z, cols = 200, 3
    sheet = Image.new("RGB", (cols * Z * 2, ((len(ids) + 1) // 2) * (Z + 16)), (150, 176, 96))
    dr = ImageDraw.Draw(sheet)
    for n, id_ in enumerate(ids):
        for s in range(1, cols + 1):
            f = c / f"{id_}_s{s}_0.png"
            x, y = ((n % 2) * cols + s - 1) * Z, (n // 2) * (Z + 16)
            if f.exists():
                sheet.paste(Image.open(f).convert("RGB").resize((Z, Z), Image.LANCZOS), (x, y))
            dr.text((x + 4, y + Z + 2), f"{id_} s{s}", fill=(20, 30, 10))
    sheet.save(c / "hoja.png")
    print("hoja", sheet.size, len(ids), "piezas")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--solo", nargs="*", default=[])
    ap.add_argument("--hoja")
    o = ap.parse_args()
    if o.hoja:
        hoja(o.hoja)
        return
    sys.path.insert(0, str(RAIZ / "tools"))
    from recortar import recortar  # noqa: E402
    klein = {e["id"]: e for e in json.loads(KLEIN.read_text(encoding="utf-8"))["elementos"]}
    OUT.mkdir(parents=True, exist_ok=True)
    cat_path = OUT / "elementos.json"
    hechos = {e["id"]: e for e in json.loads(cat_path.read_text(encoding="utf-8"))["elementos"]} if cat_path.exists() else {}
    for id_, (tipo, img) in ELEGIDOS.items():
        if o.solo and id_ not in o.solo:
            continue
        src = REPO / img
        if not src.exists():
            print("falta", img)
            continue
        x2 = src.with_name(src.stem + "_x2.png")
        if not x2.exists():
            subprocess.run([sys.executable, "-I", str(RAIZ / "tools/ampliar.py"), "--modelo", "RealESRGAN_x4plus_anime_6B.safetensors",
                            "--entrada", str(src), "--salida", str(x2)], check=True)
        e = recortar(x2, id_, tipo, OUT, abrir_huecos=id_ in ABRIR_HUECOS or id_ in HUECOS_FINOS,
                     min_hueco=HUECO_FINO if id_ in HUECOS_FINOS else 1500)
        e["k"] = round(ancho_mundo(id_, klein) / (e["w"] * F / PNG_X), 4)
        if id_ in REPINTADOS:
            print("  alineado con el dibujo, desplazamiento", alinear(id_, klein, e))
        e["origen"] = img
        e["tipo"] = TIPO_JUEGO.get(id_, e["tipo"])
        if id_ in CON_SUELO:
            e["ref"] = {"ancla": klein[id_]["ancla"], "k": klein[id_].get("k", 1)}
        hechos[id_] = e
        print(f"{id_:12s} {e['w']}x{e['h']}  k={e['k']}  ({img})", flush=True)
        cat_path.write_text(json.dumps({"escala": PNG_X, "elementos": list(hechos.values())}, indent=1, ensure_ascii=False), encoding="utf-8")
    print("catalogo arcane:", len(hechos), "elementos")


if __name__ == "__main__":
    main()
