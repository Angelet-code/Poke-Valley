"""Quita el suelo pintado (la sombra verde de Klein) de los elementos Arcane aprendiendo el color de los recortes a mano.

Uso:
  python -I tools/recorte_suelo_color.py --entrenar arbol_alto arbol_bajo …     # modelo desde los pares v1_con_suelo/ ↔ limpio
  python -I tools/recorte_suelo_color.py --validar arbol_alto arbol_bajo …      # deja fuera cada uno y mide cuánto acierta (IoU)
  python -I tools/recorte_suelo_color.py --aplicar arboleda_comun pino_seco …   # borra el suelo de esos PNG (original a v1_con_suelo/)

Idea (usuario, 2026-10-18): la sombra pintada es siempre un verde muy concreto; basta quitar ese color sin confundirlo con el
verde de las hojas. Modelo = histograma 3D (RGB, 32 niveles por canal) de los píxeles que el usuario borró frente a los que
dejó, en sus recortes a mano (`lab/assets/elementos_arcane/v1_con_suelo/<id>.png` = original, `<id>.png` = limpio). De ahí
sale P(suelo | color), suavizada. Se guarda en `assets/gen/normales/modelo_suelo.npz`.
Al aplicar: P(suelo) > 0.5 → candidato; después, limpieza espacial para no tocar las hojas: solo la mitad de abajo, nunca la
tinta ni lo que encierra la tinta (copas, raíces), solo las manchas que llegan a la base, sin motas, borde suavizado.
"""
import argparse
import os
import sys

import numpy as np
from PIL import Image
from scipy import ndimage as ndi

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from normales_elementos import CARPETA, reducir, tinta  # noqa: E402

MODELO = os.path.join(RAIZ, 'assets', 'gen', 'normales', 'modelo_suelo.npz')
VISTAS = os.path.join(RAIZ, 'assets', 'gen', 'normales', 'elementos')
NIVELES = 32
RED = 2   # se trabaja a 1/2 del PNG (como las normales); la máscara se amplía al final


def par(id_: str) -> tuple[np.ndarray, np.ndarray]:
    """(original, limpio) reducidos, RGBA uint8."""
    o = reducir(Image.open(os.path.join(CARPETA, 'v1_con_suelo', f'{id_}.png')).convert('RGBA'), RED)
    c = reducir(Image.open(os.path.join(CARPETA, f'{id_}.png')).convert('RGBA'), RED)
    return o, c


def indices(rgb: np.ndarray) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    q = (rgb.astype(np.int32) * NIVELES) // 256
    return q[..., 0], q[..., 1], q[..., 2]


def acumular(ids: list[str]) -> tuple[np.ndarray, np.ndarray]:
    """Histogramas (quitado, dejado) de color sobre los pares."""
    quit = np.zeros((NIVELES,) * 3, np.float64)
    dej = np.zeros_like(quit)
    for i in ids:
        o, c = par(i)
        a_o, a_c = o[..., 3] > 128, c[..., 3] > 128
        borrado, dejado = a_o & ~a_c, a_o & a_c
        r, g, b = indices(o[..., :3])
        np.add.at(quit, (r[borrado], g[borrado], b[borrado]), 1)
        np.add.at(dej, (r[dejado], g[dejado], b[dejado]), 1)
    return quit, dej


def probabilidad(quit: np.ndarray, dej: np.ndarray) -> np.ndarray:
    """P(suelo | color): histogramas suavizados (gauss en el cubo de color) y normalizados por clase."""
    q = ndi.gaussian_filter(quit, 1.0)
    d = ndi.gaussian_filter(dej, 1.0)
    # cada clase pesa igual (hay muchos más píxeles dejados que borrados); prior 0.5
    q = q / max(q.sum(), 1); d = d / max(d.sum(), 1)
    return q / np.maximum(q + d, 1e-12)


def mascara(rgba: np.ndarray, p_color: np.ndarray, umbral: float = 0.5) -> np.ndarray:
    """Suelo a borrar (resolución reducida): color de suelo + limpieza espacial."""
    a, lum, contorno = tinta(rgba)
    r, g, b = indices(rgba[..., :3])
    p = p_color[r, g, b]
    H = a.shape[0]
    ys = np.arange(H)[:, None]
    cerrado = ndi.binary_fill_holes(ndi.binary_dilation(contorno, iterations=2))
    cand = a & (p > umbral) & ~contorno & ~cerrado & (ys > 0.4 * H)
    cand = ndi.binary_opening(cand, iterations=2)
    etiq, n = ndi.label(cand)
    if not n:
        return cand
    # manchas que llegan a la base (el suelo siempre toca el pie) y con tamaño
    ymax = ndi.maximum(np.broadcast_to(ys, a.shape), etiq, index=np.arange(1, n + 1))
    tam = np.bincount(etiq.ravel())[1:]
    ok = 1 + np.flatnonzero((np.asarray(ymax) > 0.8 * H) & (tam > 200))
    m = np.isin(etiq, ok)
    # lo que queda del suelo entre lo borrado (huecos pequeños y hierba suelta) se va también
    m = ndi.binary_closing(m, iterations=3) & a & ~contorno & ~cerrado
    return m


def aplicar(id_: str, p_color: np.ndarray, vista: bool) -> int:
    ruta = os.path.join(CARPETA, f'{id_}.png')
    img = Image.open(ruta).convert('RGBA')
    copia = os.path.join(CARPETA, 'v1_con_suelo', f'{id_}.png')
    os.makedirs(os.path.dirname(copia), exist_ok=True)
    if not os.path.exists(copia):
        img.save(copia)
    m = mascara(reducir(img, RED), p_color)
    W, H = img.size
    mf = np.asarray(Image.fromarray(m.astype(np.uint8) * 255).resize((W, H), Image.BILINEAR)).astype(np.float32) / 255
    mf = np.clip(ndi.gaussian_filter(mf, 1.5) * 1.3, 0, 1)
    rgba = np.asarray(img).copy()
    rgba[..., 3] = np.clip(np.round(rgba[..., 3] * (1 - mf)), 0, 255).astype(np.uint8)
    Image.fromarray(rgba).save(ruta, optimize=True)
    if vista:
        os.makedirs(VISTAS, exist_ok=True)
        o = np.asarray(img)
        q = mf > 0.5
        vis = o[..., :3].copy(); vis[q] = (vis[q] * 0.3 + np.array([255, 0, 0]) * 0.7).astype(np.uint8); vis[o[..., 3] <= 128] = 100
        al = rgba[..., 3:4] / 255.0
        lim = (rgba[..., :3] * al + 100 * (1 - al)).astype(np.uint8)
        y0 = int(H * 0.4)
        tira = np.concatenate([vis[y0:], np.full((H - y0, 8, 3), 40, np.uint8), lim[y0:]], 1)
        im = Image.fromarray(tira)
        im.resize((im.width // 4, im.height // 4), Image.LANCZOS).save(os.path.join(VISTAS, f'suelo_{id_}.png'))
    return int(m.sum())


def iou(a: np.ndarray, b: np.ndarray) -> float:
    u = (a | b).sum()
    return float((a & b).sum() / u) if u else 1.0


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('ids', nargs='+')
    ap.add_argument('--entrenar', action='store_true', help='construir el modelo con los pares de esos ids')
    ap.add_argument('--validar', action='store_true', help='leave-one-out sobre esos ids: IoU de la máscara frente a la del usuario')
    ap.add_argument('--aplicar', action='store_true', help='borrar el suelo de esos ids con el modelo guardado')
    ap.add_argument('--vista', action='store_true', help='comparativa en assets/gen/normales/elementos/suelo_<id>.png')
    args = ap.parse_args()
    if args.validar:
        for i in args.ids:
            otros = [j for j in args.ids if j != i]
            p = probabilidad(*acumular(otros))
            o, c = par(i)
            real = (o[..., 3] > 128) & (c[..., 3] <= 128)
            pred = mascara(o, p)
            a = o[..., 3] > 128
            # lo que se borraría de más (de lo que el usuario dejó) y de menos
            demas = int((pred & ~real & a).sum()); demenos = int((real & ~pred).sum())
            print(f'{i:18} IoU {iou(pred, real):.2f}  usuario borró {int(real.sum()):7d} px  modelo: de más {demas:6d}, de menos {demenos:6d}')
    if args.entrenar:
        quit, dej = acumular(args.ids)
        os.makedirs(os.path.dirname(MODELO), exist_ok=True)
        np.savez_compressed(MODELO, quit=quit, dej=dej, ids=np.array(args.ids))
        print('modelo guardado en', MODELO, 'con', len(args.ids), 'elementos')
    if args.aplicar:
        d = np.load(MODELO)
        p = probabilidad(d['quit'], d['dej'])
        for i in args.ids:
            print(i, 'borrados', aplicar(i, p, args.vista), 'px (reducidos)')


if __name__ == '__main__':
    sys.exit(main())
