"""Convierte una textura generada en una baldosa de pixel art limpia y repetible.

Uso: python -I tools/pixelize.py <entrada.png> <salida.png> [--size 48] [--colors 5]
                                 [--palette R,G,B;R,G,B;...] [--preview prev.png]

1. Repetible: mezcla con una copia desplazada media textura (ver make_tileable).
2. Reduce a --size px promediando bloques (BOX): cada píxel final resume una
   zona del original, sin el aliasing de reducir saltando píxeles.
3. Paleta: --colors colores sacados de la propia imagen, o --palette fija.
   Sin tramado: cada píxel toma un color exacto.
4. Limpieza: un píxel sin ningún vecino (8 direcciones) de su mismo color
   toma el color más frecuente a su alrededor. Los vecinos se miran con
   envoltura (la baldosa se repite), así que los bordes también quedan limpios.
--preview guarda la baldosa repetida 4x3 y ampliada x4 para revisarla.
"""
import argparse

from PIL import Image, ImageChops


def tileable(im):
    """Repetible en dos pasadas: primero en horizontal y luego en vertical.

    En cada pasada se mezcla la imagen con una copia desplazada media
    anchura (o altura). La copia enlaza en los bordes y tiene su costura en
    la línea central; la máscara usa la copia junto a los bordes y el
    original en la franja central, así que ninguna costura queda a la vista.
    """
    w, h = im.size
    for axis in (0, 1):
        n = w if axis == 0 else h
        shifted = ImageChops.offset(im, w // 2 if axis == 0 else 0, h // 2 if axis == 1 else 0)
        mask = Image.new("L", (w, h))
        m = mask.load()
        for y in range(h):
            for x in range(w):
                c = x if axis == 0 else y
                d = min(c, n - 1 - c) / (n / 2)  # 0 en el borde, 1 en el centro
                m[x, y] = int(255 * min(1.0, d * 2))
        im = Image.composite(im, shifted, mask)
    return im


def quantize(im, colors, palette):
    if palette:
        pal_img = Image.new("P", (1, 1))
        flat = [v for c in palette for v in c]
        pal_img.putpalette(flat + flat[:3] * (256 - len(palette)))
        return im.quantize(palette=pal_img, dither=Image.Dither.NONE).convert("RGB")
    return im.quantize(colors=colors, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).convert("RGB")


def despeckle_wrap(im, passes=2):
    w, h = im.size
    for _ in range(passes):
        src = im.copy().load()
        px = im.load()
        for y in range(h):
            for x in range(w):
                neigh = [src[(x + dx) % w, (y + dy) % h] for dx in (-1, 0, 1) for dy in (-1, 0, 1) if dx or dy]
                if src[x, y] not in neigh:
                    px[x, y] = max(set(neigh), key=neigh.count)
    return im


def main():
    a = argparse.ArgumentParser()
    a.add_argument("src")
    a.add_argument("dst")
    a.add_argument("--size", type=int, default=48)
    a.add_argument("--colors", type=int, default=5)
    a.add_argument("--palette")
    a.add_argument("--preview")
    o = a.parse_args()
    palette = [tuple(int(v) for v in c.split(",")) for c in o.palette.split(";")] if o.palette else None
    im = tileable(Image.open(o.src).convert("RGB"))
    im = im.resize((o.size, o.size), Image.BOX)
    im = despeckle_wrap(quantize(im, o.colors, palette))
    im.save(o.dst)
    if o.preview:
        s = o.size
        p = Image.new("RGB", (s * 4, s * 3))
        for i in range(4):
            for j in range(3):
                p.paste(im, (i * s, j * s))
        p.resize((p.width * 4, p.height * 4), Image.NEAREST).save(o.preview)
    print(o.dst, im.size, len(set(im.get_flattened_data())), "colores")


if __name__ == "__main__":
    main()
