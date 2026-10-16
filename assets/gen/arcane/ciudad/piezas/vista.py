"""Vista previa de la ciudad por piezas, fuera del juego: el suelo (ciudad_suelo.jpg) y las piezas de src/data/ciudad.ts
(PIEZAS) con su ancla y escala del catálogo Arcane, ordenadas por el pie. Aproximada (sin sombras ni luz), para juzgar
sitio y tamaño. Uso: python -I assets/gen/arcane/ciudad/piezas/vista.py [zoom] → piezas/vista.jpg"""
import json, re, sys
from pathlib import Path
from PIL import Image
Z = float(sys.argv[1]) if len(sys.argv) > 1 else 1.5     # px de la vista por px de mundo
W, H = 1248, 936; K = W / 1536
cat = {e['id']: e for e in json.loads(Path('lab/assets/elementos_arcane/elementos.json').read_text(encoding='utf-8'))['elementos']}
src = Path('src/data/ciudad.ts').read_text(encoding='utf-8')
bloque = src[src.index('const PIEZAS'):src.index('];', src.index('const PIEZAS'))]
piezas = [(m[0], float(m[1]), float(m[2]), float(m[3] or 1), m[4] == 'true') for m in re.findall(r"\['(\w+)', ([\d.]+), ([\d.]+)(?:, ([\d.]+))?(?:, (true))?\]", bloque)]
vista = Image.open('lab/assets/mapas_arcane/ciudad_suelo.jpg').convert('RGBA').resize((round(W * Z), round(H * Z)), Image.LANCZOS)
faltan = []
for id_, x, y, s, flip in sorted(piezas, key=lambda p: p[2]):
    e = cat.get(id_)
    if not e: faltan.append(id_); continue
    im = Image.open(Path('lab/assets/elementos_arcane') / e['archivo']).convert('RGBA')
    if flip: im = im.transpose(Image.FLIP_LEFT_RIGHT)
    f = e.get('k', 1) / 6 * s * Z
    ax = (im.width - e['ancla'][0]) if flip else e['ancla'][0]
    im2 = im.resize((max(1, round(im.width * f)), max(1, round(im.height * f))), Image.LANCZOS)
    vista.alpha_composite(im2, (round(x * K * Z - ax * f), round(y * K * Z - e['ancla'][1] * f)))
vista.convert('RGB').save(Path(__file__).parent / 'vista.jpg', quality=88)
print('faltan', sorted(set(faltan)))
