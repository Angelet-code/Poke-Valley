"""Reproduce de principio a fin la prueba del kit de edificios (desde la raíz del proyecto):

    python -I assets/gen/edificios/kit/hacer.py

1. Piezas del kit: hacer_kit.py -> assets/gen/pixel/src/kit/*.txt -> pixel_build -> assets/game/pixel/kit/
   (+ hoja piezas_x6.png y catálogo kit.json).
2. Los cuatro planos de planos/*.json -> tools/edificio.py -> <id>.png, <id>.txt, <id>_x4.png y el
   catálogo edificios_kit.json (NO se toca assets/game/pixel/edificios.json).
3. Comprobación pixel_clean --check --runs de cada edificio (0 huérfanos / 0 dobles) y tiempos.
4. Hoja preview_kit.png (x4 sobre césped, con la caja de 24x40 de referencia) y detalle_x12.png (recortes).
"""
import json
import re
import subprocess
import sys
import time
from pathlib import Path

from PIL import Image, ImageDraw

RAIZ = Path(__file__).resolve().parents[4]
AQUI = Path(__file__).resolve().parent
KIT_SRC = RAIZ / "assets/gen/pixel/src/kit"
KIT_PNG = RAIZ / "assets/game/pixel/kit"
PY = [sys.executable, "-I"]
GRASS = (150, 176, 95)

TIPOS = {"muestra": ["muro_madera", "muro_tablas_oscuro", "muro_esquina_izq", "muro_esquina_der", "zocalo",
                     "poste", "balda", "teja_roja"],
         "tramo": ["mostrador"]}
DESCRIPCION = {
    "muro_madera": "muro de tablones de la casa (periodo 6 filas; se repite)",
    "muro_tablas_oscuro": "pared trasera oscura de la tienda (periodo 6 filas)",
    "muro_esquina_izq": "poste de esquina izquierdo (se repite en vertical)",
    "muro_esquina_der": "poste de esquina derecho (se repite en vertical)",
    "zocalo": "sombra + línea de base bajo el muro",
    "poste": "pie derecho (toldo); se repite en vertical",
    "balda": "balda de madera; se repite en horizontal",
    "teja_roja": "muestra de referencia de las tejas (el compositor las dibuja)",
    "mostrador": "tramo de mostrador de 24 px; el compositor añade los contornos laterales",
    "puerta": "puerta con marco (casa V6)", "porton": "portón de dos hojas (granero)",
    "ventana": "ventana lisa", "ventana_jardinera": "ventana con jardinera",
    "chimenea": "chimenea de mampostería (casa V6)", "letrero": "letrero colgado sin texto",
    "tarro": "tarro de cristal", "saco": "saco de arpillera", "saquito": "saquito de arpillera",
    "caja": "caja de listones vacía", "caja_manzanas": "caja con manzanas", "caja_peras": "caja con peras y limas",
    "troncos": "pila de tres troncos de canto",
}


def run(args, **kw):
    print("$", " ".join(str(a) for a in args))
    return subprocess.run([str(a) for a in args], cwd=RAIZ, check=True, capture_output=True, text=True, **kw).stdout


def main():
    # 1. piezas
    print(run(PY + [KIT_SRC / "hacer_kit.py"]))
    print(run(PY + [RAIZ / "tools/pixel_build.py", KIT_SRC, "--out", KIT_PNG, "--sheet", AQUI / "piezas_x6.png", "--zoom", "6"]))
    cat = {}
    for txt in sorted(KIT_SRC.glob("*.txt")):
        im = Image.open(KIT_PNG / f"{txt.stem}.png")
        tipo = next((t for t, ids in TIPOS.items() if txt.stem in ids), "pieza")
        cat[txt.stem] = {"archivo": f"kit/{txt.stem}.png", "tamano": [im.width, im.height], "tipo": tipo,
                         "fuente": f"assets/gen/pixel/src/kit/{txt.stem}.txt", "descripcion": DESCRIPCION.get(txt.stem, "")}
    (KIT_PNG / "kit.json").write_text(json.dumps(cat, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    for txt in sorted(KIT_SRC.glob("*.txt")):
        out = run(PY + [RAIZ / "tools/pixel_clean.py", KIT_PNG / f"{txt.stem}.png", "--check"])
        m = re.search(r"huerfanos=(\d+) dobles=(\d+)", out)
        print(f"  pieza {txt.stem:20s} huerfanos={m.group(1)} dobles={m.group(2)}")

    # 2-3. edificios
    tiempos = {}
    nombres = ["casa", "tienda", "granero", "taller"]
    for n in nombres:
        t0 = time.perf_counter()
        out = run(PY + [RAIZ / "tools/edificio.py", AQUI / "planos" / f"{n}.json", "--out", AQUI / f"{n}_kit.png",
                        "--txt", AQUI / f"{n}_kit.txt", "--preview", "4", "--catalogo", AQUI / "edificios_kit.json"])
        tiempos[n] = (time.perf_counter() - t0, float(re.search(r"([\d.]+) s", out).group(1)))
        print(out.strip())
        chk = run(PY + [RAIZ / "tools/pixel_clean.py", AQUI / f"{n}_kit.png", "--check", "--runs"])
        print("   ", re.search(r"\[entrada\].*", chk).group(0))
        sup = re.search(r"contorno superior \(tramo, valor\): (.*)", chk)
        if sup:
            print("    contorno superior:", sup.group(1)[:200], "...")
    print("tiempos (proceso entero / solo montaje):", {k: f"{a:.2f} s / {b:.2f} s" for k, (a, b) in tiempos.items()})

    # 4. hoja x4 con caja de 24x40 y detalle x12
    z = 4
    ims = [(n, Image.open(AQUI / f"{n}_kit.png").convert("RGBA")) for n in nombres]
    gap, top = 10 * z, 16
    ancho = sum(im.width * z + gap for _, im in ims) + gap + 24 * z + gap
    alto = max(im.height * z for _, im in ims) + top + 2 * gap
    hoja = Image.new("RGBA", (ancho, alto), GRASS + (255,))
    d = ImageDraw.Draw(hoja)
    for x in range(0, ancho, 24 * z):
        d.line([(x, 0), (x, alto)], fill=(140, 166, 88, 255))
    for y in range(0, alto, 24 * z):
        d.line([(0, y), (ancho, y)], fill=(140, 166, 88, 255))
    x = gap
    for n, im in ims:
        big = im.resize((im.width * z, im.height * z), Image.NEAREST)
        y = alto - gap - big.height
        hoja.alpha_composite(big, (x, y))
        d.text((x, y - top), f"{n}_kit {im.width}x{im.height}", fill=(30, 40, 20, 255))
        x += big.width + gap
    y = alto - gap - 40 * z
    d.rectangle([x, y, x + 24 * z, y + 40 * z], outline=(30, 40, 20, 255))
    d.text((x, y - top), "24x40", fill=(30, 40, 20, 255))
    hoja.save(AQUI / "preview_kit.png")
    print("hoja:", AQUI / "preview_kit.png")

    casa, granero, taller, tienda = (AQUI / "casa_kit.png", AQUI / "granero_kit.png", AQUI / "taller_kit.png", AQUI / "tienda_kit.png")
    paneles = [
        f"casa: tejas faldon izq (juntas 5:3)={casa}:14,96,54,130",
        f"casa: vertice del alero={casa}:60,108,98,142",
        f"casa: hastial (muro)={casa}:40,122,118,150",
        f"casa: chimenea y sombra={casa}:96,0,142,70",
        f"granero: tejas 2:1 y alero={granero}:8,110,60,150",
        f"granero: cumbrera con jitter={granero}:88,20,118,60",
        f"taller: un agua={taller}:0,0,48,60",
        f"tienda: toldo y festones={tienda}:0,36,48,70",
    ]
    print(run(PY + [RAIZ / "tools/pixel_detalle.py", AQUI / "detalle_x12.png"] + paneles + ["--cols", "4"]))


if __name__ == "__main__":
    main()
