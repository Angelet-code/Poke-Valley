"""Máscara de fondo magenta de hoja_edificios.py (copiada para importarla sin generar su hoja)."""
import numpy as np
from scipy import ndimage


def fondo(a):
    """Magenta del fondo y sus sombras (Klein a 1024² pinta sombras moradas que la máscara de reducir.py no ve):
    todo píxel de tono magenta (R y B muy por encima de G), y luego solo la mancha opaca mayor (fuera motas)."""
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    bg = (r - g > 45) & (b - g > 30) & (abs(r - b) < 110) & (g < 120)   # G bajo: no come flores rosas
    lab, n = ndimage.label(ndimage.binary_opening(~bg, iterations=2))
    big = lab == (np.bincount(lab.ravel())[1:].argmax() + 1)
    return ~ndimage.binary_fill_holes(big) | (bg & ~big)
