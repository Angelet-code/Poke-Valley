"""Mapas de normales para sprites PMD (píxel a píxel), para el pipeline Light2D de Phaser.

Uso:  python -I tools/normales_pokemon.py 0001 Idle Walk Sleep Eat [--fuerza 1.6] [--vista]

Para cada hoja `assets/sprites/pokemon/<dex>/<Anim>-Anim.png` escribe `<Anim>-Normal.png` al lado,
con la misma rejilla de fotogramas (lee FrameWidth/FrameHeight de AnimData.xml). Con `--vista`
guarda una comparativa en `assets/gen/normales/<dex>_<Anim>.png` (sprite, normal y 4 luces).

Cómo se calcula la altura de cada píxel (no hay modelo 3D: se "infla" el dibujo):
  1. silueta: distancia al borde del sprite → perfil de semiesfera (todo el cuerpo abomba);
  2. piezas: los contornos oscuros del sprite separan cabeza, bulbo, patas…; cada pieza se infla
     por su cuenta, así la luz las distingue;
  3. detalle: el sombreado propio del sprite (paso alto de la luminancia) añade relieve fino.
De la altura salen las normales (gradiente). Convención OpenGL (verde = arriba), la de Phaser.

Además escribe `<Anim>-Luz.png`: el mismo sprite con el contorno negro teñido hacia el color de sus vecinos
(verde oscuro en el cuerpo, rojo oscuro junto al ojo). El negro puro no puede aclararse con luz (multiplica),
así que es esta variante la que hay que cargar como textura cuando se usa el normal map. El original no se toca.
"""
import argparse
import os
import sys
import xml.etree.ElementTree as ET

import numpy as np
from PIL import Image
from scipy import ndimage as ndi

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def tam_fotograma(carpeta: str, anim: str) -> tuple[int, int]:
    xml = ET.parse(os.path.join(carpeta, 'AnimData.xml')).getroot()
    for a in xml.iter('Anim'):
        if a.findtext('Name') == anim:
            fw, fh = a.findtext('FrameWidth'), a.findtext('FrameHeight')
            if fw is None:  # animación copiada de otra (CopyOf)
                return tam_fotograma(carpeta, a.findtext('CopyOf'))
            return int(fw), int(fh)
    raise SystemExit(f'No hay animación {anim} en {carpeta}')


def inflar(mascara: np.ndarray, escala: float = 1.0) -> np.ndarray:
    """Altura en píxeles: semiesfera de radio = grosor de cada componente conexa (×escala)."""
    h = np.zeros(mascara.shape, np.float32)
    if not mascara.any():
        return h
    d = ndi.distance_transform_edt(mascara)
    etiq, n = ndi.label(mascara)
    for i in range(1, n + 1):
        sel = etiq == i
        dmax = d[sel].max()
        if dmax <= 0:
            continue
        t = np.clip(d[sel] / (dmax + 0.5), 0, 1)
        h[sel] = np.sqrt(1 - (1 - t) ** 2) * dmax * escala  # semiesfera: vertical en el borde, plana en el centro
    return h


def contorno_tintado(rgba: np.ndarray, factor: float = 0.3, umbral: float = 0.08) -> np.ndarray:
    """Contorno (píxeles casi negros) → color medio de los vecinos no negros × factor. Varias pasadas para líneas gruesas."""
    out = rgba.copy()
    a = out[..., 3] > 0
    rgb = out[..., :3].astype(np.float32)
    lum = (0.299 * rgb[..., 0] + 0.587 * rgb[..., 1] + 0.114 * rgb[..., 2]) / 255
    negro = a & (lum < umbral)
    fuente = a & ~negro
    col = rgb.copy()
    for _ in range(4):
        if not negro.any():
            break
        peso = ndi.uniform_filter(fuente.astype(np.float32), 3) * 9
        suma = np.stack([ndi.uniform_filter(np.where(fuente, col[..., c], 0), 3) * 9 for c in range(3)], -1)
        listo = negro & (peso > 0)
        col[listo] = suma[listo] / peso[listo][:, None] * factor
        fuente |= listo
        negro &= ~listo
    out[..., :3] = np.clip(np.round(col), 0, 255).astype(np.uint8)
    return out


def altura_fotograma(rgba: np.ndarray, umbral_contorno: float = 0.08) -> tuple[np.ndarray, np.ndarray]:
    a = rgba[..., 3] > 0
    rgb = rgba[..., :3].astype(np.float32) / 255
    lum = 0.299 * rgb[..., 0] + 0.587 * rgb[..., 1] + 0.114 * rgb[..., 2]
    # 1. silueta
    h_sil = inflar(a, 0.9)
    # 2. piezas: el contorno oscuro separa partes. Se inflan y la altura del contorno se rellena
    #    con la de su vecino más bajo (es un surco, no un pico).
    contorno = a & (lum < umbral_contorno)
    interior = a & ~contorno
    h_pz = inflar(interior, 1.0)
    if contorno.any():
        # mínimo de los vecinos del interior (surco suave)
        hp = np.where(interior, h_pz, 1e9)
        vecino_min = ndi.minimum_filter(hp, size=3)
        vecino_min = np.where(vecino_min > 1e8, 0, vecino_min)  # contorno sin vecino interior
        h_pz = np.where(contorno, np.maximum(vecino_min - 0.6, 0), h_pz)
    # 3. detalle: paso alto de la luminancia (solo dentro, para no inventar relieve en el borde)
    lum_in = np.where(a, lum, 0)
    peso = ndi.gaussian_filter(a.astype(np.float32), 1.2)
    suave = ndi.gaussian_filter(lum_in, 1.2) / np.maximum(peso, 1e-3)
    detalle = np.where(a, lum - suave, 0)
    h = 0.5 * h_sil + 0.9 * h_pz + 2.0 * detalle  # todo en píxeles de altura; sin suavizar: cada píxel es una faceta
    h = np.where(a, h, 0)
    return h.astype(np.float32), a


def normales(h: np.ndarray, a: np.ndarray, fuerza: float) -> np.ndarray:
    """Normal RGB (0..255) desde la altura. Fuera del sprite, normal plana (128,128,255)."""
    # gradiente por diferencias centrales (por píxel, sin el emborronado del Sobel)
    gy, gx = np.gradient(h)
    nx, ny, nz = -gx * fuerza, gy * fuerza, np.ones_like(h)  # ny positivo = hacia arriba (OpenGL); gy crece hacia abajo en la imagen
    # En el borde de la silueta el gradiente sale enorme (cae a 0): se recorta la inclinación máxima.
    inclin = np.hypot(nx, ny)
    lim = 4.0
    esc = np.where(inclin > lim, lim / np.maximum(inclin, 1e-6), 1.0)
    nx, ny = nx * esc, ny * esc
    n = np.stack([nx, ny, nz], -1)
    n /= np.linalg.norm(n, axis=-1, keepdims=True)
    out = np.round((n * 0.5 + 0.5) * 255).astype(np.uint8)
    out[~a] = (128, 128, 255)
    return out


def iluminar(rgba: np.ndarray, nrm: np.ndarray, luz: tuple[float, float, float], ambiente: float = 0.35) -> np.ndarray:
    """Vista previa: Lambert con una luz direccional, como la haría el pipeline (aprox.)."""
    n = nrm.astype(np.float32) / 127.5 - 1
    l = np.array(luz, np.float32)
    l /= np.linalg.norm(l)
    dif = np.clip((n * l).sum(-1), 0, 1)
    col = rgba[..., :3].astype(np.float32) * (ambiente + (1 - ambiente) * dif * 1.25)[..., None]
    out = rgba.copy()
    out[..., :3] = np.clip(col, 0, 255).astype(np.uint8)
    return out


def procesar(dex: str, anim: str, fuerza: float, vista: bool, tinte: float = 0.6) -> str:
    carpeta = os.path.join(RAIZ, 'assets', 'sprites', 'pokemon', dex)
    fw, fh = tam_fotograma(carpeta, anim)
    img = Image.open(os.path.join(carpeta, f'{anim}-Anim.png')).convert('RGBA')
    rgba = np.asarray(img)
    H, W = rgba.shape[:2]
    salida = np.zeros((H, W, 3), np.uint8)
    salida[:] = (128, 128, 255)
    for y in range(0, H, fh):
        for x in range(0, W, fw):
            cel = rgba[y:y + fh, x:x + fw]
            h, a = altura_fotograma(cel)
            salida[y:y + fh, x:x + fw] = normales(h, a, fuerza)
    destino = os.path.join(carpeta, f'{anim}-Normal.png')
    Image.fromarray(salida).save(destino)
    luz = contorno_tintado(rgba, tinte)
    Image.fromarray(luz).save(os.path.join(carpeta, f'{anim}-Luz.png'))
    if vista:
        # Primer fotograma de la primera fila a ×4: sprite original, con contorno teñido, normal y luz desde 4 direcciones
        cel, nrm = luz[:fh, :fw], salida[:fh, :fw]
        fichas = [rgba[:fh, :fw], cel, np.dstack([nrm, np.full((fh, fw), 255, np.uint8)])]
        for luz in [(-1, 1, 0.6), (1, 1, 0.6), (-1, -1, 0.6), (0, 0, 1)]:
            fichas.append(iluminar(cel, nrm, luz))
        tira = np.concatenate(fichas, axis=1)
        im = Image.fromarray(tira).resize((tira.shape[1] * 4, tira.shape[0] * 4), Image.NEAREST)
        carpeta_v = os.path.join(RAIZ, 'assets', 'gen', 'normales')
        os.makedirs(carpeta_v, exist_ok=True)
        im.save(os.path.join(carpeta_v, f'{dex}_{anim}.png'))
    return destino


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('dex', help='carpeta en assets/sprites/pokemon, p. ej. 0001')
    ap.add_argument('anims', nargs='+', help='Idle Walk Sleep Eat…')
    ap.add_argument('--fuerza', type=float, default=1.5, help='multiplica la pendiente de las normales (1 = geometría tal cual)')
    ap.add_argument('--tinte', type=float, default=0.6, help='brillo del contorno teñido respecto a su vecino (0.3 = oscuro)')
    ap.add_argument('--vista', action='store_true', help='guardar comparativa en assets/gen/normales/')
    args = ap.parse_args()
    for anim in args.anims:
        print(procesar(args.dex, anim, args.fuerza, args.vista, args.tinte))


if __name__ == '__main__':
    sys.exit(main())
