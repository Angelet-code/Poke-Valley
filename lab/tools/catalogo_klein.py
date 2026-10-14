"""Monta el catalogo de elementos reinterpretados con Klein: lab/assets/elementos_klein/ (+ SVG por capas).

Uso: python -I lab/tools/catalogo_klein.py [--solo id ...] [--sin-vector]

Para cada fila de TABLA: amplia x2 la imagen generada (RealESRGAN, ampliar.py; se guarda <img>_x2.png y se
reutiliza), la recorta (recortar.py) a elementos_klein/<id>.png, calcula la escala `k` para que mida lo
que debe en el mundo (el ancho del original al que sustituye, o ANCHO_MUNDO para los nuevos; con F = 1/3)
y la vectoriza por capas (vectorizar2.py) a vector/elementos_klein/<id>.svg. Escribe elementos.json y
vector.json. Es el modo por defecto del lab (los ids que no esten aqui salen del catalogo original).
recortar.py guarda ademas la sombra proyectada que pinta Klein como capa aparte (<id>_sombra.png, campo
"sombra" del catalogo): el lab la dibuja con opacidad y multiply, asi quien pasa por delante queda a la sombra.
"""
import argparse
import json
import subprocess
import sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[1]
GEN = RAIZ / "assets/gen"
OUT = RAIZ / "assets/elementos_klein"
VEC = RAIZ / "assets/vector/elementos_klein"
ORIG = RAIZ / "assets/elementos/elementos.json"
PY = sys.executable
F, PNG_X = 1 / 3, 2   # como lab/src/config.ts
# Tamano respecto al original del dibujo (el usuario quiere los arboles bastante mas grandes, >= x2).
FACTOR = {"arbol_alto": 2.4, "arbol_bajo": 2.0}

# (id, tipo para la huella, imagen generada, ancho en px de mundo; None = el del original con ese id)
TABLA = [
    ("casa_grande", "casa", "klein_edit_casa_s1_0.png", None),
    ("casa_cabana", "casa", "klein_cabana_s1_0.png", None),
    ("casa_larga", "casa", "klein_edit_larga_s1_0.png", None),
    ("casa_chimenea", "casa", "klein_edit_chimenea_s1_0.png", None),
    ("arbol_alto", "arbol", "klein_arbol_s1_0.png", None),
    ("arbol_bajo", "arbol", "klein_arbol_s2_0.png", None),
    ("roca_0", "roca", "klein_roca_s1_0.png", None),
    ("roca_1", "roca", "klein_roca_s2_0.png", None),
    ("roca_2", "roca", "klein_roca_b_s1_0.png", None),
    ("roca_3", "roca", "klein_roca_b_s2_0.png", None),
    ("roca_4", "roca", "klein_roca_s1_0.png", None),
    ("roca_5", "roca", "klein_roca_c_s1_0.png", None),
    ("roca_6", "roca", "klein_roca_s2_0.png", None),
    ("roca_7", "roca", "klein_roca_b_s1_0.png", None),
    ("roca_8", "roca", "klein_roca_c_s2_0.png", None),
    ("estanque", "estanque", "klein_estanque_s1_0.png", None),
    ("piedras_0", "piedras", "klein_edit_piedras_s2_0.png", None),
    # Nuevos
    ("hoguera", "roca", "klein_hoguera_s1_0.png", 34),
    ("camino_c", "piedras", "klein_camino_c_s2_0.png", 70),
    ("camino_d", "piedras", "klein_camino_f_s3_0.png", 90),
    ("camino_e", "piedras", "klein_camino_f_s1_0.png", 80),
    ("tienda", "casa", "klein_tienda_s1_0.png", 150),
    ("almacen", "casa", "klein_almacen_s2_0.png", 165),
    ("pozo", "roca", "klein_pozo_s1_0.png", 42),
    ("arbusto", "roca", "klein_arbusto_s1_0.png", 30),
    ("valla", "roca", "klein_valla_s1_0.png", 60),
    ("tocon", "roca", "klein_tocon_s2_0.png", 24),
    ("flores", "detalle", "klein_flores_s1_0.png", 22),
    # Mapa de noche (tanda 5, gen_klein5.sh): farola de hierro sobre base de piedra y farola de madera con farolillo colgado.
    ("farola", "roca", "klein_farola_s1_0.png", 12),
    ("farola_madera", "roca", "klein_farola_b_s1_0.png", 10),
]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--solo", nargs="*", default=[])
    ap.add_argument("--sin-vector", action="store_true")
    o = ap.parse_args()
    sys.path.insert(0, str(RAIZ / "tools"))
    from recortar import recortar  # noqa: E402
    orig = {e["id"]: e for e in json.loads(ORIG.read_text(encoding="utf-8"))["elementos"]}
    cat_path = OUT / "elementos.json"
    previos = {e["id"]: e for e in json.loads(cat_path.read_text(encoding="utf-8"))["elementos"]} if cat_path.exists() else {}
    hechos = dict(previos)
    for id_, tipo, img, ancho in TABLA:
        if o.solo and id_ not in o.solo:
            continue
        src = GEN / img
        if not src.exists():
            print("falta", img)
            continue
        x2 = src.with_name(src.stem + "_x2.png")
        if not x2.exists():
            subprocess.run([PY, "-I", str(RAIZ / "tools/ampliar.py"), "--modelo", "RealESRGAN_x4plus_anime_6B.safetensors",
                            "--entrada", str(src), "--salida", str(x2)], check=True)
        e = recortar(x2, id_, tipo, OUT)
        objetivo = (ancho if ancho is not None else orig[id_]["w"] * F / PNG_X) * FACTOR.get(id_, 1)
        e["k"] = round(objetivo / (e["w"] * F / PNG_X), 4)
        hechos[id_] = e
        print(f"{id_:14s} {e['w']}x{e['h']}  k={e['k']}  ({img})", flush=True)
        cat_path.write_text(json.dumps({"escala": PNG_X, "elementos": list(hechos.values())}, indent=1, ensure_ascii=False), encoding="utf-8")
    print("catalogo:", len(hechos), "elementos", flush=True)
    VEC.mkdir(parents=True, exist_ok=True)
    if not o.sin_vector:
        for id_, *_ in TABLA:
            if (o.solo and id_ not in o.solo) or id_ not in hechos:
                continue
            subprocess.run([PY, "-I", str(RAIZ / "tools/vectorizar2.py"), id_, "--carpeta", "elementos_klein", "--sufijo", ""], check=True)
    # vector.json solo al final: si el lab lo carga mientras se reescribe, Vite devuelve index.html y falla el JSON.
    (VEC / "vector.json").write_text(json.dumps([i for i in hechos if (VEC / f"{i}.svg").exists()]), encoding="utf-8")


if __name__ == "__main__":
    main()
