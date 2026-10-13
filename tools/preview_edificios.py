"""Previsualización de los edificios de pixel art sobre el color del césped del juego.

Uso: python -I tools/preview_edificios.py [--dir assets/game/pixel/edificios]
         [--out assets/gen/edificios/preview_edificios.png] [--zoom 4]

Pone casa.png y tienda.png ampliados ×zoom (vecino más cercano) sobre el verde del césped
(150,176,95), con la rejilla de casillas de 24 px marcada, el rectángulo de colisión de
edificios.json en rojo translúcido y, al lado, una caja de 24×40 px (tamaño del sprite de
Bulbasaur de PMD) para comparar la escala. Si existe el sprite Idle de Bulbasaur también
lo pega (primer fotograma).
"""
import argparse
import json
from pathlib import Path

from PIL import Image, ImageDraw

CESPED = (150, 176, 95)


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--dir", default="assets/game/pixel/edificios")
    p.add_argument("--json", default="assets/game/pixel/edificios.json")
    p.add_argument("--out", default="assets/gen/edificios/preview_edificios.png")
    p.add_argument("--zoom", type=int, default=4)
    a = p.parse_args()
    z = a.zoom
    meta = json.loads(Path(a.json).read_text(encoding="utf-8")) if Path(a.json).exists() else {}
    ims = {n: Image.open(Path(a.dir) / f"{n}.png").convert("RGBA") for n in ("casa", "tienda")}

    # escena en píxeles de mundo: margen de 1 casilla, edificios sobre la misma línea de suelo
    suelo = 24 * 6
    W = 24 * 15
    H = suelo + 24 * 2
    esc = Image.new("RGBA", (W, H), (*CESPED, 255))
    d = ImageDraw.Draw(esc)
    for x in range(0, W, 24):
        d.line([(x, 0), (x, H)], fill=(140, 166, 88, 255))
    for y in range(0, H, 24):
        d.line([(0, y), (W, y)], fill=(140, 166, 88, 255))
    xs = {"casa": 24, "tienda": 24 * 7}
    for n, im in ims.items():
        x, y = xs[n], suelo - im.height
        esc.alpha_composite(im, (x, y))
        m = meta.get(n)
        if m:
            ax, ay = m["ancla"]
            cw, ch = m["colision"]
            capa = Image.new("RGBA", esc.size, (0, 0, 0, 0))
            ImageDraw.Draw(capa).rectangle(
                [x + ax - cw // 2, y + ay - ch, x + ax + cw // 2 - 1, y + ay - 1], outline=(220, 40, 40, 200), fill=(220, 40, 40, 50))
            esc.alpha_composite(capa)
            d.point((x + ax, y + ay - 1), fill=(255, 255, 0, 255))
    # caja de Bulbasaur (24×40) y sprite si existe
    bx, by = 24 * 13, suelo - 40
    d.rectangle([bx, by, bx + 23, by + 39], outline=(40, 40, 60, 255), fill=(255, 255, 255, 60))
    sprite = Path("assets/sprites/pokemon/0001/Idle-Anim.png")
    if sprite.exists():
        sp = Image.open(sprite).convert("RGBA")
        fw = 32
        fr = sp.crop((0, 0, fw, fw))  # primer fotograma (mirando abajo)
        esc.alpha_composite(fr, (bx - 4, suelo - 8 - fw + 8))
    esc.resize((W * z, H * z), Image.Resampling.NEAREST).save(a.out)
    print(a.out, f"{W * z}x{H * z}")


if __name__ == "__main__":
    main()
