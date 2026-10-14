"""Montaje rápido de candidatos: python -I ver.py salida.png img1 img2 ... (a 384 px cada una)"""
import sys
from PIL import Image
fs = sys.argv[2:]; S = 384
m = Image.new('RGB', (S * len(fs), S), 'white')
for i, f in enumerate(fs):
    m.paste(Image.open(f).convert('RGB').resize((S, S), Image.LANCZOS), (i * S, 0))
m.save(sys.argv[1])
