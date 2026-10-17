"""Mapas de normales para los elementos del escenario (catálogo Arcane), para el pipeline cel / Light2D.

Uso:  python -I tools/normales_elementos.py --arboles [--vista]
      python -I tools/normales_elementos.py arbol_alto sauce [--reduccion 2] [--fuerza 1.5] [--detalle 4] [--vista]
      python -I tools/normales_elementos.py tablon --quitar-suelo --piezas 0.25 [--vista]   (cosas planas: tablas, papeles)

Para cada `lab/assets/elementos_arcane/<id>.png` escribe `<id>_normal.png` al lado, a 1/`reduccion` del tamaño del
PNG (los PNG van a ×2 del dibujo y en pantalla se reducen mucho más; a la mitad sobra resolución y el archivo pesa
un cuarto). El juego lo carga como `el_<id>_nrm` (src/render/Dibujo.ts) y `screenTex` lo reduce junto al elemento y
lo cuelga como dataSource de la textura de pantalla; con eso Aventura/WorldScene le ponen el pipeline «Cel».
Con `--vista` guarda una comparativa en `assets/gen/normales/elementos/<id>.png` (elemento, normal y 4 luces).

Cómo se calcula la altura (el mismo "inflado" de tools/normales_pokemon.py, adaptado a un dibujo grande pintado):
  1. silueta: distancia al borde → semiesfera (la copa entera abomba; el tronco, estrecho, sale como un cilindro);
  2. piezas: las líneas de tinta (casi negras) separan las matas de hojas, las ramas y la corteza; cada pieza se
     infla por su cuenta y la línea queda como un surco (altura del vecino más bajo);
  3. detalle: paso alto de la luminancia (las pinceladas) añade relieve fino;
  4. suelo: la hierba y la sombra pintada que el recorte trae pegadas al pie (opacas, sin tinta alrededor: densidad de
     tinta casi nula en la mitad de abajo, manchas que llegan a la base) se aplanan, para que no salgan como un montículo.
Convención OpenGL (verde = arriba), la de Phaser. Fuera del elemento, normal plana (128,128,255).

`--quitar-suelo` (2026-10-17): además borra ese suelo pintado del PNG del elemento (alfa 0, borde suavizado), guardando
antes el original en `lab/assets/elementos_arcane/v1_con_suelo/<id>.png`. El sprite queda solo con el árbol; la sombra la
pone el juego (óvalo de día; de noche, sin sombra pintada que se encienda con las farolas). La máscara se calcula a la
resolución reducida y se amplía al PNG; se extiende a lo verdoso pegado a la mancha que no esté encerrado por tinta (el
ribete de hierba junto a las raíces), y respeta la tinta y lo que encierra (raíces, copas bajas). Después hay que pasar lab/tools/mascaras_arcane.py (la silueta `cubre` del catálogo cambia).
"""
import argparse
import json
import os
import sys

import numpy as np
from PIL import Image
from scipy import ndimage as ndi

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from normales_pokemon import inflar, iluminar, normales  # noqa: E402

CARPETA = os.path.join(RAIZ, 'lab', 'assets', 'elementos_arcane')
VISTAS = os.path.join(RAIZ, 'assets', 'gen', 'normales', 'elementos')
# Los árboles del catálogo (por id: las farolas también son `tipo: arbol` y las arboledas, `roca`).
PREFIJOS_ARBOL = ('arbol_', 'arboleda_', 'sauce', 'palmera', 'pino_')


def catalogo() -> dict[str, dict]:
    with open(os.path.join(CARPETA, 'elementos.json'), encoding='utf-8') as f:
        return {e['id']: e for e in json.load(f)['elementos']}


def arboles() -> list[str]:
    return sorted(i for i in catalogo() if i.startswith(PREFIJOS_ARBOL))


def tinta(rgba: np.ndarray, umbral: float = 0.07) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """Alfa, luminancia y líneas de tinta (casi negras) de un elemento."""
    a = rgba[..., 3] > 128
    rgb = rgba[..., :3].astype(np.float32) / 255
    lum = 0.299 * rgb[..., 0] + 0.587 * rgb[..., 1] + 0.114 * rgb[..., 2]
    return a, lum, a & (lum < umbral)


def mascara_suelo(a: np.ndarray, contorno: np.ndarray) -> np.ndarray:
    """Suelo pintado que el recorte trae pegado al pie: manchas opacas sin tinta alrededor (densidad de tinta casi nula
    en una ventana de 41 px), en la mitad de abajo y que llegan a la base (hierba, sombra pintada). Sin la banda de
    seguridad junto a la tinta: eso lo decide quien la use."""
    H = a.shape[0]
    dens = ndi.uniform_filter(contorno.astype(np.float32), 41)
    ys = np.arange(H)[:, None]
    tierra = a & (dens < 0.012) & (ys > 0.5 * H)
    tierra = ndi.binary_opening(tierra, iterations=4)
    etiq, n = ndi.label(tierra)
    if not n:
        return tierra
    ymax = ndi.maximum(np.broadcast_to(ys, a.shape), etiq, index=np.arange(1, n + 1))
    return np.isin(etiq, 1 + np.flatnonzero(np.asarray(ymax) > 0.85 * H))


def altura(rgba: np.ndarray, detalle_k: float, umbral: float = 0.07, piezas_k: float = 0.9) -> tuple[np.ndarray, np.ndarray]:
    a, lum, contorno = tinta(rgba, umbral)
    # 1. silueta
    h_sil = inflar(a, 0.9)
    # 2. piezas separadas por la tinta; la línea es un surco: altura del vecino interior más bajo
    interior = a & ~contorno
    h_pz = inflar(interior, 1.0)
    if contorno.any():
        hp = np.where(interior, h_pz, 1e9)
        vecino_min = ndi.minimum_filter(hp, size=5)
        vecino_min = np.where(vecino_min > 1e8, 0, vecino_min)
        h_pz = np.where(contorno, np.maximum(vecino_min - 1.0, 0), h_pz)
    # 3. detalle: paso alto de la luminancia, solo dentro (sin inventar relieve en el borde)
    sigma = 2.0
    lum_in = np.where(a, lum, 0)
    peso = ndi.gaussian_filter(a.astype(np.float32), sigma)
    suave = ndi.gaussian_filter(lum_in, sigma) / np.maximum(peso, 1e-3)
    detalle = np.where(a, lum - suave, 0)
    h = 0.5 * h_sil + piezas_k * h_pz
    # 4. suelo: se aplana (si el PNG ya está limpio con --quitar-suelo, la máscara sale vacía)
    tierra = mascara_suelo(a, contorno)
    if tierra.any():
        tierra = ndi.binary_dilation(tierra, iterations=6) & a
        h = h * (1 - ndi.gaussian_filter(tierra.astype(np.float32), 4))
    h = h + detalle_k * detalle
    return np.where(a, h, 0).astype(np.float32), a


def reducir(img: Image.Image, reduccion: int) -> np.ndarray:
    """RGBA reducido con el color desmezclado del alfa (sin halos oscuros del fondo transparente)."""
    W, H = img.size
    w, h = max(1, round(W / reduccion)), max(1, round(H / reduccion))
    src = np.asarray(img).astype(np.float32)
    prem = src.copy(); prem[..., :3] *= src[..., 3:4] / 255
    red = np.asarray(Image.fromarray(np.clip(prem, 0, 255).astype(np.uint8)).resize((w, h), Image.LANCZOS)).astype(np.float32)
    al = np.maximum(red[..., 3:4], 1)
    rgba = red.copy(); rgba[..., :3] = np.clip(red[..., :3] * 255 / al, 0, 255)
    return rgba.astype(np.uint8)


def quitar_suelo(id_: str, reduccion: int) -> bool:
    """Borra el suelo pintado del PNG (original a v1_con_suelo/). Devuelve si había algo que quitar."""
    ruta = os.path.join(CARPETA, f'{id_}.png')
    img = Image.open(ruta).convert('RGBA')
    a, _, contorno = tinta(reducir(img, reduccion))
    tierra = mascara_suelo(a, contorno)
    if not tierra.any():
        return False
    # Lo que rodea la mancha (ribete de hierba junto a las raíces, matas entre raíz y raíz) también se va si es verdoso,
    # no es tinta ni nieve y no está encerrado por tinta (las copas bajas y las raíces sí lo están).
    rgb = reducir(img, reduccion)[..., :3].astype(np.int16)
    _, lum, _ = tinta(reducir(img, reduccion))
    verdoso = (rgb[..., 1] >= rgb[..., 0] - 5) & (lum < 0.55)
    cerrado = ndi.binary_fill_holes(ndi.binary_dilation(contorno, iterations=2))
    ys = np.arange(a.shape[0])[:, None]
    candidata = a & verdoso & ~cerrado & ~contorno & (ys > 0.5 * a.shape[0])
    etiq, n = ndi.label(candidata | tierra)   # lo verdoso que toca la mancha (la tinta hace de barrera)
    toca = np.unique(etiq[tierra]); toca = toca[toca > 0]
    tierra = np.isin(etiq, toca)
    W, H = img.size
    m = np.asarray(Image.fromarray(tierra.astype(np.uint8) * 255).resize((W, H), Image.BILINEAR)).astype(np.float32) / 255
    m = np.clip(ndi.gaussian_filter(m, 1.5) * 1.3, 0, 1)   # borde suave sin dejar un halo de medio píxel
    copia = os.path.join(CARPETA, 'v1_con_suelo')
    os.makedirs(copia, exist_ok=True)
    if not os.path.exists(os.path.join(copia, f'{id_}.png')):
        img.save(os.path.join(copia, f'{id_}.png'))
    rgba = np.asarray(img).copy()
    rgba[..., 3] = np.clip(np.round(rgba[..., 3] * (1 - m)), 0, 255).astype(np.uint8)
    Image.fromarray(rgba).save(ruta, optimize=True)
    return True


def procesar(id_: str, reduccion: int, fuerza: float, detalle_k: float, vista: bool, piezas_k: float = 0.9) -> str:
    img = Image.open(os.path.join(CARPETA, f'{id_}.png')).convert('RGBA')
    rgba = reducir(img, reduccion)
    h, w = rgba.shape[:2]
    hh, a = altura(rgba, detalle_k, piezas_k=piezas_k)
    nrm = normales(hh, a, fuerza)
    destino = os.path.join(CARPETA, f'{id_}_normal.png')
    Image.fromarray(nrm).save(destino, optimize=True)
    if vista:
        os.makedirs(VISTAS, exist_ok=True)
        fichas = [rgba, np.dstack([nrm, np.full((h, w), 255, np.uint8)])]
        for luz in [(-1, 1, 0.5), (1, 1, 0.5), (-1, -1, 0.5), (0, 0, 1)]:
            fichas.append(iluminar(rgba, nrm, luz, ambiente=0.25))
        tira = np.concatenate(fichas, axis=1)
        fondo = np.zeros_like(tira); fondo[..., :3] = 70; fondo[..., 3] = 255
        al = tira[..., 3:4].astype(np.float32) / 255
        comp = (tira[..., :3] * al + fondo[..., :3] * (1 - al)).astype(np.uint8)
        im = Image.fromarray(comp)
        im = im.resize((im.width // 2, im.height // 2), Image.LANCZOS)
        im.save(os.path.join(VISTAS, f'{id_}.png'))
    return destino


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('ids', nargs='*', help='ids del catálogo Arcane (arbol_alto, sauce…)')
    ap.add_argument('--arboles', action='store_true', help='todos los árboles del catálogo')
    ap.add_argument('--reduccion', type=int, default=2, help='el normal sale a 1/N del PNG (2 = mitad)')
    ap.add_argument('--fuerza', type=float, default=1.5, help='multiplica la pendiente de las normales')
    ap.add_argument('--detalle', type=float, default=4.0, help='relieve de las pinceladas (0 = solo volumen)')
    ap.add_argument('--piezas', type=float, default=0.9, help='abombado de cada pieza cerrada por tinta (0.9 = árboles; 0.25 = tablas y papeles planos)')
    ap.add_argument('--vista', action='store_true', help='guardar comparativa en assets/gen/normales/elementos/')
    ap.add_argument('--quitar-suelo', action='store_true', help='borrar antes el suelo pintado del PNG (original a v1_con_suelo/)')
    ap.add_argument('--menos', nargs='*', default=[], help='ids que se saltan (p. ej. los que se limpian a mano)')
    args = ap.parse_args()
    ids = list(args.ids) + (arboles() if args.arboles else [])
    if not ids:
        ap.error('indica ids o --arboles')
    ids = [i for i in dict.fromkeys(ids) if i not in args.menos]
    for i in ids:
        if args.quitar_suelo:
            print('suelo quitado' if quitar_suelo(i, args.reduccion) else 'sin suelo que quitar', i)
        print(procesar(i, args.reduccion, args.fuerza, args.detalle, args.vista, args.piezas))


if __name__ == '__main__':
    sys.exit(main())
