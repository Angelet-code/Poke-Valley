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
}
# Tipo en el juego distinto del de la huella: el nenúfar va a ras de suelo como un detalle, pero no puede ser
# "detalle", porque Aventura reparte los detalles por el césped (y saldrían nenúfares en la hierba).
TIPO_JUEGO = {"nenufar": "losa"}
# Ancho en px de mundo de los que no tienen equivalente en el catálogo dibujo.
ANCHO = {"sauce": 84, "juncos": 22, "muelle": 72, "nenufar": 30, "seta": 14, "tronco_caido": 48, "arbol_viejo": 130, "panal": 26, "poste": 20}


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
        e = recortar(x2, id_, tipo, OUT, abrir_huecos=False)
        e["k"] = round(ancho_mundo(id_, klein) / (e["w"] * F / PNG_X), 4)
        e["origen"] = img
        e["tipo"] = TIPO_JUEGO.get(id_, e["tipo"])
        hechos[id_] = e
        print(f"{id_:12s} {e['w']}x{e['h']}  k={e['k']}  ({img})", flush=True)
        cat_path.write_text(json.dumps({"escala": PNG_X, "elementos": list(hechos.values())}, indent=1, ensure_ascii=False), encoding="utf-8")
    print("catalogo arcane:", len(hechos), "elementos")


if __name__ == "__main__":
    main()
