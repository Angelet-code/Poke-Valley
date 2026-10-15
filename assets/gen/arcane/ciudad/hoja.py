"""Hojas de contacto de la ciudad (gen.sh): una fila por pieza con sus semillas.
Uso: python -I assets/gen/arcane/ciudad/hoja.py   (desde la raíz) → ciudad/hoja_piezas.png, hoja_suelos.png, hoja_tiras.png"""
from pathlib import Path

from PIL import Image, ImageDraw

B = Path(__file__).resolve().parent
M = B.parent / "muros/ciudad"


def hoja(filas, salida, celda=(256, 256)):
    filas = [(n, fs) for n, fs in filas if fs]
    if not filas:
        return
    cols = max(len(fs) for _, fs in filas)
    W, H = 150 + cols * (celda[0] + 6), len(filas) * (celda[1] + 6)
    im = Image.new("RGB", (W, H), (28, 30, 34))
    d = ImageDraw.Draw(im)
    for i, (n, fs) in enumerate(filas):
        y = i * (celda[1] + 6)
        d.text((6, y + celda[1] // 2), n, fill=(230, 230, 230))
        for j, f in enumerate(fs):
            t = Image.open(f).convert("RGB")
            t.thumbnail(celda)
            x = 150 + j * (celda[0] + 6)
            im.paste(t, (x, y))
            d.text((x + 4, y + 4), f.stem.split("_s")[-1][:1], fill=(255, 255, 0))
    im.save(salida)
    print(salida, len(filas))


def filas(carpeta, lista, sufijos=("",)):
    out = []
    for linea in lista.read_text(encoding="utf-8").splitlines():
        if not linea.strip():
            continue
        p = linea.split("|")
        nombres = [p[0] + ("_v" if len(p) > 2 and p[1] == "V" else "")] if lista.name == "tiras.txt" else [p[0]]
        for n in nombres:
            out.append((n, sorted(carpeta.glob(f"{n}_s[0-9]_0.png"))))
    return out


hoja(filas(B, B / "piezas.txt"), B / "hoja_piezas.png")
hoja(filas(B / "suelo", B / "suelos.txt"), B / "hoja_suelos.png")
hoja(filas(M, B / "tiras.txt"), B / "hoja_tiras.png", celda=(384, 192))
