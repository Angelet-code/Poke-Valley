"""Hoja de detalle: recortes de sprites ampliados con vecino más cercano, en rejilla y con rótulo,
para comparar "antes | después" píxel a píxel (p. ej. la diagonal del tejado o la puerta).

Uso:
  python -I tools/pixel_detalle.py salida.png "rótulo=imagen.png:x0,y0,x1,y1" ... [--zoom 12]
      [--cols 2] [--grass 150,176,95]

Cada argumento es un panel: rótulo, archivo y rectángulo (incluido) a recortar. Los paneles se
colocan por filas de --cols columnas, todos a la misma escala; el fondo es el verde del césped.
"""
import argparse

from PIL import Image, ImageDraw


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("dst")
    ap.add_argument("paneles", nargs="+")
    ap.add_argument("--zoom", type=int, default=12)
    ap.add_argument("--cols", type=int, default=2)
    ap.add_argument("--grass", default="150,176,95")
    a = ap.parse_args()
    grass = tuple(int(v) for v in a.grass.split(","))
    z = a.zoom
    tiles = []
    for p in a.paneles:
        label, rest = p.split("=", 1)
        path, box = rest.rsplit(":", 1)
        x0, y0, x1, y1 = [int(v) for v in box.split(",")]
        im = Image.open(path).convert("RGBA").crop((x0, y0, x1 + 1, y1 + 1))
        im = im.resize((im.width * z, im.height * z), Image.Resampling.NEAREST)
        tiles.append((label, im))
    cw = max(im.width for _, im in tiles)
    ch = max(im.height for _, im in tiles)
    gap, top = 16, 18
    cols = min(a.cols, len(tiles))
    rows = (len(tiles) + cols - 1) // cols
    out = Image.new("RGBA", (gap + cols * (cw + gap), gap + rows * (ch + top + gap)), grass + (255,))
    d = ImageDraw.Draw(out)
    for i, (label, im) in enumerate(tiles):
        cx = gap + (i % cols) * (cw + gap)
        cy = gap + (i // cols) * (ch + top + gap)
        d.text((cx, cy), label, fill=(30, 40, 20, 255))
        out.alpha_composite(im, (cx, cy + top))
    out.save(a.dst)
    print(a.dst, out.size)


if __name__ == "__main__":
    main()
