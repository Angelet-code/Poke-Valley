"""Hoja de contacto de las casas generadas con Klein (lab/assets/gen/klein_*.png) a 1/4."""
from pathlib import Path
from PIL import Image, ImageDraw
D = Path(__file__).parent
import sys
files = sorted(D.glob((sys.argv[1] if len(sys.argv) > 1 else "klein_*") + "_0.png"))
k = 4
celdas = [(f.stem, Image.open(f).convert("RGB").resize((1024 // k, 1024 // k), Image.LANCZOS)) for f in files]
cols = 4
rows = (len(celdas) + cols - 1) // cols
out = Image.new("RGB", (cols * (1024 // k + 6) + 6, rows * (1024 // k + 22) + 6), (40, 40, 40))
d = ImageDraw.Draw(out)
for i, (n, im) in enumerate(celdas):
    x, y = 6 + (i % cols) * (1024 // k + 6), 6 + (i // cols) * (1024 // k + 22)
    out.paste(im, (x, y + 16)); d.text((x, y + 2), n, fill=(255, 255, 0))
out.save(D / (sys.argv[2] if len(sys.argv) > 2 else "hoja_klein.png")); print(D / "hoja_klein.png", len(celdas))
