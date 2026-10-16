"""Recorta piezas de la referencia de la ciudad (docs/art/ref/arcane_ciudad.png = ciudad_D_s1) por su polígono, sobre
verde liso y centradas en 1024², para repintarlas con Klein como elementos sueltos (gen.sh).
Uso: python -I assets/gen/arcane/ciudad/piezas/recortes.py → piezas/recorte_<id>.png"""
from pathlib import Path
from PIL import Image, ImageDraw
D = Path(__file__).parent
REF = Image.open('docs/art/ref/arcane_ciudad.png').convert('RGB')
VERDE = (60, 170, 70)
# id: polígono en px de la referencia (los de src/data/ciudad.ts).
PIEZAS = {
  'centro_pokemon': [[88, 335], [195, 192], [228, 196], [302, 300], [300, 412], [128, 412], [128, 345]],
  'iglesia_reloj': [[903, 215], [998, 178], [998, 62], [1035, 38], [1082, 92], [1082, 185], [1152, 215], [1150, 330], [1142, 422], [1065, 442], [1003, 442], [912, 422], [903, 300]],
  'ayuntamiento': [[1102, 690], [1108, 560], [1158, 505], [1252, 505], [1262, 468], [1312, 468], [1332, 505], [1420, 518], [1478, 690], [1472, 808], [1312, 848], [1232, 848], [1118, 808]],
  'puesto': [[82, 515], [105, 410], [250, 412], [252, 520], [240, 572], [110, 572]],
  'tienda': [[383, 250], [400, 172], [598, 180], [600, 262], [602, 362], [410, 362], [383, 330]],
  'casa_norte': [[385, 0], [612, 0], [612, 78], [385, 78]],
  'casa_nordeste': [[912, 0], [1112, 0], [1112, 82], [912, 82]],
  'casa_oscura': [[1208, 245], [1262, 165], [1335, 165], [1432, 335], [1408, 418], [1232, 418], [1218, 300]],
  'tienda_morada': [[303, 700], [320, 572], [518, 572], [522, 700], [518, 842], [342, 842], [318, 792]],
  'cobertizo': [[1022, 690], [1048, 638], [1092, 638], [1122, 700], [1122, 788], [1032, 788]],
  'casa_este': [[1408, 505], [1428, 458], [1536, 458], [1536, 618], [1440, 618], [1428, 540]],
  'fuente': [[703, 520], [740, 503], [790, 503], [827, 520], [830, 570], [800, 605], [730, 605], [700, 570]],
  'farola': [[556, 684], [586, 684], [586, 716], [592, 842], [578, 842], [566, 716], [556, 716]],
  'seto_1': [[300, 35], [388, 35], [388, 95], [360, 272], [266, 272], [266, 150]],
  'seto_2': [[595, 92], [655, 92], [655, 255], [595, 255]],
  'seto_3': [[1105, 30], [1180, 30], [1180, 195], [1235, 200], [1235, 255], [1150, 255], [1110, 200]],
  'seto_4': [[1408, 195], [1536, 195], [1536, 398], [1408, 398]],
  'seto_5': [[238, 575], [270, 562], [312, 570], [312, 830], [242, 832]],
}
def recorte(id_, poli, lado=1024, ocupa=0.72):
    xs, ys = [p[0] for p in poli], [p[1] for p in poli]
    x0, y0, x1, y1 = min(xs), min(ys), max(xs), max(ys)
    m = Image.new('L', REF.size, 0); ImageDraw.Draw(m).polygon([tuple(p) for p in poli], fill=255)
    pieza = Image.composite(REF, Image.new('RGB', REF.size, VERDE), m).crop((x0, y0, x1, y1))
    k = ocupa * lado / max(x1 - x0, y1 - y0)
    pieza = pieza.resize((round((x1 - x0) * k), round((y1 - y0) * k)), Image.LANCZOS)
    lienzo = Image.new('RGB', (lado, lado), VERDE)
    lienzo.paste(pieza, ((lado - pieza.width) // 2, (lado - pieza.height) // 2))
    lienzo.save(D / f'recorte_{id_}.png')
if __name__ == '__main__':
    for k, v in PIEZAS.items(): recorte(k, v)
