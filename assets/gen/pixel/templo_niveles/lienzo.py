"""Deja sitio para crecer: el nivel anterior (klein/nNN.png) escalado para que su lado mayor ocupe ~75 % del lienzo
(si ya llenaba el lienzo, se encoge; nunca más de ×0,85 ni menos de ×1,25 de aumento), apoyado abajo en el centro
de un lienzo de 1024² del magenta de esa imagen → klein/pad_nNN.png (referencia de la edición). Escribe la escala
en escalas.txt: hoja.py la acumula para que cada nivel salga en el juego al tamaño que le toca.
Uso: python -I lienzo.py 04"""
import sys
from pathlib import Path
import numpy as np
from PIL import Image
from scipy import ndimage
B = Path(__file__).parent
desde = sys.argv[1]
im = Image.open(B / f'klein/n{desde}.png').convert('RGB')
S = im.width
a = np.array(im).astype(int)
bg = (a[..., 0] - a[..., 1] > 45) & (a[..., 2] - a[..., 1] > 30) & (a[..., 1] < 120)
fg = ndimage.binary_opening(~bg, iterations=3)
ys, xs = np.where(fg)
lado = max(xs.max() - xs.min(), ys.max() - ys.min()) + 1
esc = float(np.clip(0.75 * S / lado, 0.6, 1.25))
esq = [im.getpixel(q) for q in [(4, 4), (S - 5, 4), (4, S - 5), (S - 5, S - 5)]]
c = Image.new('RGB', (S, S), tuple(sorted(e[i] for e in esq)[1] for i in range(3)))   # el magenta de esta imagen
p = im.resize((round(S * esc), round(S * esc)), Image.LANCZOS)
if esc > 1:   # recorta al lienzo manteniendo el pie del dibujo abajo
    cx = (p.width - S) // 2
    pie = round(ys.max() * esc)
    y0 = min(max(pie - round(S * 0.97), 0), p.height - S)
    p = p.crop((cx, y0, cx + S, y0 + S))
    c = p
else:
    c.paste(p, ((S - p.width) // 2, round(S * 0.97 - ys.max() * esc)))
c.save(B / f'klein/pad_n{desde}.png')
f = B / 'escalas.txt'
lin = [l for l in f.read_text().splitlines() if l and not l.startswith(desde + ' ')] if f.exists() else []
f.write_text('\n'.join(sorted(lin + [f'{desde} {esc:.4f}'])) + '\n')
print('lienzo', desde, round(esc, 3))
