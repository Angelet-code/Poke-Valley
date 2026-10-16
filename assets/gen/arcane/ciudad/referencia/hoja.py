# Hoja de contacto de las referencias de la ciudad (gen.sh, gen2.sh): una fila por idea, etiquetada.
import sys
from pathlib import Path
from PIL import Image, ImageDraw
D = Path(__file__).parent
ideas = ['C', 'D', 'A', 'B']
fil = [sorted(D.glob(f'ciudad_{i}_s*_0.png')) for i in ideas]
W, H = 512, 384; cols = max(len(f) for f in fil)
hoja = Image.new('RGB', (cols * (W + 8) + 8, len(ideas) * (H + 30) + 8), (24, 26, 22))
dib = ImageDraw.Draw(hoja)
for r, f in enumerate(fil):
    for c, p in enumerate(f):
        x, y = 8 + c * (W + 8), 8 + r * (H + 30)
        hoja.paste(Image.open(p).convert('RGB').resize((W, H), Image.LANCZOS), (x, y + 22))
        dib.text((x, y + 4), p.stem.replace('_0', ''), fill=(230, 220, 190))
hoja.save(D / 'hoja.jpg', quality=88)
