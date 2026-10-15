"""Recorte rapido de un elemento generado sobre fondo verde liso (Klein) -> PNG con alfa + huella.

Uso: python -I lab/tools/recortar.py <imagen_x2.png> <nombre> <tipo> <carpeta_salida>

Pensado para las imagenes de lab/assets/gen/ (1024², ampliadas x2 con ampliar.py): un solo elemento,
fondo liso. Mucho mas rapido que extraer.py (segundos):
1. Fondo = color mediano del borde; es fondo todo lo que esta a < tol de ese color y conecta con el borde.
2. La sombra proyectada que pinta Klein (verde apagado, mas oscuro que el fondo, FUERA de cualquier zona
   cerrada por contorno oscuro) se quita; las copas de los arboles, que tambien son verdes, estan dentro de
   su contorno y se respetan.
3. Se queda la mancha mayor con sus huecos rellenos; alfa con antialias de 1 px desmezclado del fondo.
4. Huella de colision por tipo (calcular_huella de extraer.py) y ancla en la base.
"""
import sys
from pathlib import Path

import cv2
import numpy as np
from PIL import Image
from scipy import ndimage as ndi

sys.path.insert(0, str(Path(__file__).resolve().parent))
from extraer import calcular_huella  # noqa: E402

CRUZ = [[0, 1, 0], [1, 1, 1], [0, 1, 0]]


def recortar(src, nombre, tipo, out_dir, tol=26.0, abrir_huecos=True, min_hueco=1500):
    a = np.asarray(Image.open(src).convert("RGB")).copy()
    H, W = a.shape[:2]
    borde = np.concatenate([a[0], a[-1], a[:, 0], a[:, -1]]).astype(np.float32)
    bg = np.median(borde, axis=0)
    af = a.astype(np.float32)
    d = np.sqrt(((af - bg) ** 2).sum(-1))
    es_fondo = d < tol
    lab, n = ndi.label(es_fondo, structure=CRUZ)
    etb = np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))
    exterior = np.isin(lab, etb[etb > 0])
    fg = ~exterior
    # Sombra proyectada: verde apagado fuera de lo que encierran contorno + cuerpo (el contorno se dilata
    # para puentear huecos; lo encerrado, como el suelo sombreado junto a una puerta, se queda).
    gris = cv2.cvtColor(a, cv2.COLOR_RGB2GRAY)
    r, g, b = (a[..., i].astype(int) for i in range(3))
    candidata = fg & (g - r >= 15) & (g - b >= 8) & (g < 175)
    cuerpo = fg & ~candidata
    cerrado = ndi.binary_fill_holes(ndi.binary_dilation(gris < 75, iterations=6) | ndi.binary_dilation(cuerpo, iterations=2))
    sombra = candidata & ~cerrado
    fg &= ~ndi.binary_dilation(sombra, iterations=2)
    comp, n = ndi.label(fg, structure=np.ones((3, 3)))
    if n == 0:
        raise SystemExit(f"{src}: no hay elemento")
    tam = ndi.sum(fg, comp, index=np.arange(1, n + 1))
    m = ndi.binary_fill_holes(comp == int(np.argmax(tam)) + 1)
    # Huecos grandes de color de fondo encerrados por el elemento (el interior de un corral de valla):
    # siguen siendo transparentes. abrir_huecos=False los deja opacos (estilo Arcane: el brillo verdoso de lo alto
    # de las rocas tiene el color del fondo y quedaba agujereado). min_hueco: area minima (px) de un hueco que se abre;
    # baja para ramas, juncos y tablas, donde los huecos entre piezas son pequenos.
    huecos = es_fondo & ~exterior
    lh, nh = ndi.label(huecos, structure=CRUZ)
    if nh and abrir_huecos:
        th = ndi.sum(huecos, lh, index=np.arange(1, nh + 1))
        m &= ~np.isin(lh, [i + 1 for i, t in enumerate(th) if t > min_hueco])
    nucleo = ndi.binary_erosion(m, iterations=1)
    anillo = ndi.binary_dilation(m, iterations=1) & ~nucleo
    alfa = nucleo.astype(np.float32)
    a_borde = np.clip((d - 8) / (tol - 8), 0, 1)
    alfa[anillo] = a_borde[anillo]
    alfa = cv2.GaussianBlur(alfa, (0, 0), 0.6)
    alfa = np.where(nucleo, 1.0, alfa)
    alfa = np.where(ndi.binary_dilation(m, iterations=2), alfa, 0.0).astype(np.float32)
    al = alfa[..., None]
    col = np.clip(np.where(al > 0.02, (af - (1 - al) * bg) / np.maximum(al, 0.02), af), 0, 255)
    rgba = np.dstack([col, alfa * 255]).astype(np.uint8)
    ys, xs = np.nonzero(alfa > 0.01)
    ex0, ey0 = int(xs.min()), int(ys.min())
    rgba = rgba[ey0:ys.max() + 1, ex0:xs.max() + 1]
    out_dir = Path(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    Image.fromarray(rgba).save(out_dir / f"{nombre}.png")
    base = int(np.nonzero((rgba[..., 3] > 128).any(1))[0].max()) + 1
    e = {"id": nombre, "tipo": tipo, "archivo": f"{nombre}.png", "w": int(rgba.shape[1]), "h": int(rgba.shape[0]),
         "ancla": [rgba.shape[1] // 2, base], "huella": calcular_huella(rgba, tipo, base), "origen": Path(src).name}
    # Capa de sombra: la sombra quitada, con la forma que pinto Klein, como mascara (alfa = cuanto oscurece
    # respecto al fondo). El juego la pinta aparte, con opacidad y mezcla multiply, para que quien pase por
    # delante quede a la sombra. Posicion relativa a la esquina superior izquierda del PNG del elemento.
    zona = ndi.binary_dilation(sombra, iterations=2)
    if sombra.sum() > 400:
        lum = cv2.cvtColor(a, cv2.COLOR_RGB2GRAY).astype(np.float32)
        lum_bg = float(0.299 * bg[0] + 0.587 * bg[1] + 0.114 * bg[2])
        fuerza = np.clip((lum_bg - lum) / 40.0, 0, 1) * zona
        fuerza = cv2.GaussianBlur(fuerza.astype(np.float32), (0, 0), 1.5)
        sy, sx = np.nonzero(fuerza > 0.02)
        sx0, sy0, sx1, sy1 = int(sx.min()), int(sy.min()), int(sx.max()) + 1, int(sy.max()) + 1
        capa = np.zeros((sy1 - sy0, sx1 - sx0, 4), np.uint8)
        capa[..., :3] = (40, 56, 40)
        capa[..., 3] = (fuerza[sy0:sy1, sx0:sx1] * 255).astype(np.uint8)
        Image.fromarray(capa).save(out_dir / f"{nombre}_sombra.png")
        e["sombra"] = {"archivo": f"{nombre}_sombra.png", "w": sx1 - sx0, "h": sy1 - sy0, "dx": sx0 - ex0, "dy": sy0 - ey0}
    return e


if __name__ == "__main__":
    src, nombre, tipo, out = sys.argv[1:5]
    print(recortar(src, nombre, tipo, out))
