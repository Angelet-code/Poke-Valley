"""Silueta reducida de cada elemento del catálogo Arcane, para saber qué tapa en el mundo (src/data/bordes.ts,
vestirMacizo: el macizo se viste con piezas que lo cubren entero sin tapar lo pisable).

Uso: python -I lab/tools/mascaras_arcane.py            (desde la raíz; tras catalogo_arcane.py o tiras_arcane.py)

Añade a cada elemento de lab/assets/elementos_arcane/elementos.json "cubre": {"c": columnas, "f": filas, "b": "0110…"}:
rejilla de COLS columnas sobre el PNG (celdas cuadradas), fila a fila desde arriba; 1 = la celda está pintada en más
de la mitad (alfa > 128).
"""
import json
from pathlib import Path

import numpy as np
from PIL import Image

OUT = Path(__file__).resolve().parents[1] / "assets/elementos_arcane"
COLS = 12


def main():
    p = OUT / "elementos.json"
    cat = json.loads(p.read_text(encoding="utf-8"))
    for e in cat["elementos"]:
        a = np.asarray(Image.open(OUT / e["archivo"]).getchannel("A")) > 128
        h, w = a.shape
        cel = w / COLS
        filas = max(1, int(round(h / cel)))
        bits = []
        for j in range(filas):
            for i in range(COLS):
                sub = a[int(j * h / filas):max(int(j * h / filas) + 1, int((j + 1) * h / filas)), int(i * cel):max(int(i * cel) + 1, int((i + 1) * cel))]
                bits.append("1" if sub.mean() > 0.5 else "0")
        e["cubre"] = {"c": COLS, "f": filas, "b": "".join(bits)}
    p.write_text(json.dumps(cat, indent=1, ensure_ascii=False), encoding="utf-8")
    print(len(cat["elementos"]), "máscaras")


if __name__ == "__main__":
    main()
