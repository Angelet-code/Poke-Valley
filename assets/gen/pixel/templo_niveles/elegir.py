"""Elige la semilla de un nivel para seguir la cadena. La edición a veces quita el cerezo y a veces no cambia
casi nada: entre las semillas que conservan al menos el 40 % de la flor (rosa claro) del nivel anterior, la que más
difiere de él. Copia klein/nNN_sK_0.png -> klein/nNN.png. Uso: python -I elegir.py 05"""
import shutil, sys
from pathlib import Path
import numpy as np
from PIL import Image
B = Path(__file__).parent / 'klein'
n = sys.argv[1]
leer = lambda f: np.array(Image.open(f).convert('RGB')).astype(int)
def flor(a):
    return int(((a[..., 0] > 225) & (a[..., 1] > 165) & (a[..., 2] > 195) & (a[..., 1] < a[..., 0] - 8)).sum())
def fondo(a):   # magenta y sombras moradas (el tono del fondo varía entre semillas: no cuenta como cambio)
    return (a[..., 0] - a[..., 1] > 45) & (a[..., 2] - a[..., 1] > 30) & (a[..., 1] < 120)
prev = leer(B / f'pad_n{int(n) - 1:02d}.png')
c = {}
for f in sorted(B.glob(f'n{n}_s*_0.png')):
    a = leer(f)
    c[f] = (flor(a), float(np.abs(a - prev).sum(-1)[~(fondo(a) & fondo(prev))].mean()))
ok = [f for f, (fl, _) in c.items() if fl >= 0.4 * flor(prev)] or list(c)
best = max(ok, key=lambda f: c[f][1])
shutil.copy(best, B / f'n{n}.png')
print('nivel', n, {f.name: (fl, round(d, 1)) for f, (fl, d) in c.items()}, '->', best.name)
