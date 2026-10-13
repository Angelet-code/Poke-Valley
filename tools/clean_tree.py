"""Limpia un árbol generado: trazos nítidos, relleno limpio y silueta afilada.

Uso: python -I tools/clean_tree.py <limpio.png> <salida.png> [--h 360] [--debug d.png]

La imagen de img2img sale blanda (viene de un recorte ampliado de la referencia).
Se separa en dos capas y se vuelve a montar a resolución x2:
1. Silueta: máscara de BiRefNet, suavizada y cortada en 0.5 (borde limpio), sin
   pegotes sueltos ni agujeros.
2. Trazos: oscuridad respecto al tono local (cierre en gris). Se corta con una
   rampa de ~1 px, así las líneas quedan definidas pero antialiasadas.
3. Relleno: los colores sin las líneas (convolución normalizada), suavizado para
   quitar el ruido de la ampliación.
4. Contorno exterior: línea por dentro de la silueta, del mismo color que los trazos.
Después se reduce a --h px de alto (LANCZOS, alfa premultiplicado).
"""
import argparse
import sys
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage

sys.path.insert(0, str(Path(__file__).parent))
from cutout import mask_for  # noqa: E402


def norm_blur(img, w, s):
    """Media gaussiana de img con pesos w (ignora donde w = 0). Devuelve también el peso."""
    num = np.stack([ndimage.gaussian_filter(img[..., c] * w, s) for c in range(3)], -1)
    den = ndimage.gaussian_filter(w, s)[..., None]
    return num / np.maximum(den, 1e-6), den


def fill_holes(img, w, s):
    """Rellena donde w = 0 con lo de alrededor: primero a escala s y, donde no llega, a escalas mayores."""
    out, den = norm_blur(img, w, s)
    k = np.clip(den / 0.3, 0, 1)
    for big in (4 * s, 12 * s):
        far, _ = norm_blur(img, w, big)
        out = far + (out - far) * k
        k = np.maximum(k, np.clip(den / 0.3, 0, 1))
    return out


def main():
    a = argparse.ArgumentParser()
    a.add_argument("src")
    a.add_argument("dst")
    a.add_argument("--h", type=int, default=360)
    a.add_argument("--up", type=int, default=2, help="supermuestreo de trabajo")
    a.add_argument("--reach", type=int, default=71, help="tamaño del cierre que mide el tono local, px de la fuente")
    a.add_argument("--line", type=float, default=26, help="oscuridad mínima para ser trazo")
    a.add_argument("--soft", type=float, default=6, help="anchura de la rampa del trazo, en oscuridad")
    a.add_argument("--outline", type=float, default=4.5, help="grosor del contorno exterior, px de la fuente")
    a.add_argument("--fill-blur", type=float, default=2.5, help="suavizado del relleno, px de la fuente")
    a.add_argument("--line-dark", type=float, default=0.6, help="color del trazo = relleno x este factor")
    a.add_argument("--shrink", type=float, default=2, help="cuánto se mete la silueta, px de la fuente")
    a.add_argument("--mask", help="caché de la máscara de BiRefNet (se crea si no existe)")
    a.add_argument("--min-line", type=float, default=0, help="área mínima de un trazo, px² de la fuente")
    a.add_argument("--smooth", type=float, default=1.5, help="suavizado de los trazos, px de la fuente")
    a.add_argument("--erase", type=float, default=15, help="oscuridad que se borra del relleno (también trazos descartados)")
    a.add_argument("--debug")
    o = a.parse_args()

    src = Image.open(o.src).convert("RGB")
    if o.mask and Path(o.mask).exists():
        mask = Image.open(o.mask).convert("L")
    else:
        mask = mask_for(o.src)
        if o.mask:
            mask.save(o.mask)
    mask = mask.resize(src.size, Image.BILINEAR)
    U = o.up
    size = (src.width * U, src.height * U)
    rgb = np.asarray(src.resize(size, Image.BICUBIC), np.float32)
    m = np.asarray(mask.resize(size, Image.BICUBIC), np.float32) / 255

    # 1. Silueta limpia: suavizar, cortar, quitar islas y agujeros.
    m = ndimage.gaussian_filter(m, 1.5 * U)
    solid = m > 0.5
    solid = ndimage.binary_opening(solid, iterations=3 * U)
    lab, n = ndimage.label(solid)
    if n > 1:
        sizes = ndimage.sum(solid, lab, range(1, n + 1))
        solid = lab == (1 + int(np.argmax(sizes)))
    solid = ndimage.binary_fill_holes(solid)
    # La máscara de BiRefNet se pasa un poco del contorno pintado: recortar.
    solid = ndimage.binary_erosion(solid, iterations=round(o.shrink * U))
    # Borde antialiasado a partir de la distancia con signo (px de trabajo).
    sd = ndimage.distance_transform_edt(solid) - ndimage.distance_transform_edt(~solid)
    sd = ndimage.gaussian_filter(sd, 0.7 * U)
    alpha = np.clip(sd / U + 0.5, 0, 1)

    # 2. Trazos: cuánto más oscuro que su entorno claro. Las líneas de la fuente
    # son valles anchos y blandos (40-60 px), así que el entorno se mide lejos.
    lum = rgb @ np.array([0.2126, 0.7152, 0.0722], np.float32)
    lum_in = np.where(solid, lum, lum[solid].mean())
    base = ndimage.grey_closing(lum_in, size=(o.reach * U, o.reach * U))
    base = ndimage.gaussian_filter(base, 4 * U)
    dark = ndimage.gaussian_filter(base - lum, o.smooth * U)
    line = np.clip((dark - o.line) / o.soft + 0.5, 0, 1)
    line *= ndimage.binary_erosion(solid, iterations=U)  # el contorno se pone aparte
    # Copa = zona verde (saturada); el tronco gris queda fuera y conserva su pintura.
    sat = ndimage.gaussian_filter(rgb.max(-1) - rgb.min(-1), 4 * U)
    canopy = ndimage.binary_fill_holes(ndimage.binary_closing(sat > 30, iterations=25 * U)) & solid
    canopy = ndimage.gaussian_filter(canopy.astype(np.float32), 3 * U)
    line *= canopy
    # Menos detalle: fuera los trazos cortos (ramitas, grietas sueltas).
    lab, n = ndimage.label(line > 0.5)
    if n:
        sizes = ndimage.sum(np.ones_like(line), lab, range(1, n + 1))
        keep = np.r_[False, sizes >= o.min_line * U * U]
        line *= ndimage.grey_dilation(keep[lab].astype(np.float32), size=(3, 3))

    # 3. Relleno sin líneas, suavizado.
    # Fuera también la penumbra de los trazos y el borde (ahí se cuela el fondo).
    edge = ndimage.distance_transform_edt(solid) > (o.outline + 3) * U
    w = (1 - np.clip((dark - o.erase) / 4, 0, 1)) * edge
    fill = fill_holes(rgb, w.astype(np.float32), o.fill_blur * U)
    fill = rgb + (fill - rgb) * canopy[..., None]

    # 4. Contorno exterior por dentro de la silueta.
    # Más grueso por abajo (lado de sombra), como una pincelada.
    gy = ndimage.sobel(ndimage.gaussian_filter(sd, 8 * U), 0)
    gx = ndimage.sobel(ndimage.gaussian_filter(sd, 8 * U), 1)
    down = np.clip(-gy / np.maximum(np.hypot(gx, gy), 1e-6), 0, 1)  # normal exterior hacia abajo
    width = o.outline * U * (0.75 + 0.75 * down)
    inside = np.clip(width - ndimage.distance_transform_edt(solid) + 0.5, 0, 1) * solid
    line = np.maximum(line, inside)

    ink = fill * o.line_dark
    out = fill + (ink - fill) * line[..., None]

    rgba = np.dstack([out * alpha[..., None], alpha * 255]).clip(0, 255).astype(np.uint8)
    im = Image.fromarray(rgba, "RGBa")
    im = im.crop(Image.fromarray((alpha * 255).astype(np.uint8)).getbbox())
    wdt = max(1, round(im.width * o.h / im.height))
    im = im.resize((wdt, o.h), Image.LANCZOS).convert("RGBA")
    Path(o.dst).parent.mkdir(parents=True, exist_ok=True)
    im.save(o.dst)
    print(o.dst, im.size)
    if o.debug:
        Image.fromarray((line * 255).astype(np.uint8)).save(o.debug)


if __name__ == "__main__":
    main()
