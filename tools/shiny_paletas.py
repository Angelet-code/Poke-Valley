"""Hojas y paletas shiny de los Pokémon del juego.

Uso:  python -I tools/shiny_paletas.py [--sin-descarga]

Para cada especie de src/data/pokedex.ts descarga (si faltan) de SpriteCollab (sprite/<dex>/0000/0001/, misma fuente
y licencia que los sprites normales) sus hojas shiny `<Anim>-Anim.png` de las animaciones que usa el modo aventura
(las de ANIMS en src/combate/sprites.ts, siguiendo los CopyOf del AnimData) a `assets/sprites/pokemon/<dex>/shiny/`.
Una hoja vale si casa con la normal (mismo tamaño y silueta): el juego la carga tal cual.
Además, de la Idle (o la Walk) saca la paleta normal → shiny comparando píxel a píxel; con ella el juego recolorea la
hoja normal cuando falta la shiny. La paleta sola no basta en todas: a veces un mismo color normal es dos zonas que
en shiny cambian distinto (el verde del cuerpo y del bulbo de Bulbasaur); por eso se bajan las hojas.
Escribe `src/data/gen/shiny.json`: {pal: {dex: [[0xRRGGBB normal, 0xRRGGBB shiny], ...]}, hojas: {dex: [hoja, ...]}}.
"""
import json
import os
import re
import sys
import urllib.request
import xml.etree.ElementTree as ET
from collections import Counter

import numpy as np
from PIL import Image

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
URL = 'https://raw.githubusercontent.com/PMDCollab/SpriteCollab/master/sprite/{dex}/0000/0001/{anim}-Anim.png'


def especies() -> list[str]:
    with open(os.path.join(RAIZ, 'src', 'data', 'pokedex.ts'), encoding='utf-8') as f:
        return sorted(set(re.findall(r"\['(\d{4})'", f.read())))


ANIMS = ['Walk', 'Idle', 'Attack', 'Shoot', 'Charge', 'Hurt', 'Faint', 'Sleep']


def hojas_usadas(carpeta: str) -> list[str]:
    datos = {a.find('Name').text: a for a in ET.parse(os.path.join(carpeta, 'AnimData.xml')).getroot().iter('Anim')}
    out = set()
    for n in ANIMS:
        for _ in range(4):
            a = datos.get(n)
            if a is None:
                n = None
                break
            c = a.find('CopyOf')
            if c is None:
                break
            n = c.text
        if n:
            out.add(n)
    return sorted(out)


def casa(normal: str, shiny: str) -> bool:
    a = np.asarray(Image.open(normal).convert('RGBA'))
    b = np.asarray(Image.open(shiny).convert('RGBA'))
    return a.shape == b.shape and ((a[..., 3] > 0) != (b[..., 3] > 0)).mean() <= 0.002


def bajar(dex: str, anim: str, sin_descarga: bool) -> str | None:
    destino = os.path.join(RAIZ, 'assets', 'sprites', 'pokemon', dex, 'shiny', f'{anim}-Anim.png')
    if os.path.exists(destino):
        return destino
    if sin_descarga:
        return None
    try:
        with urllib.request.urlopen(URL.format(dex=dex, anim=anim), timeout=30) as r:
            datos = r.read()
    except Exception:
        return None
    os.makedirs(os.path.dirname(destino), exist_ok=True)
    with open(destino, 'wb') as f:
        f.write(datos)
    return destino


def paleta(normal: str, shiny: str) -> list[list[int]] | None:
    a = np.asarray(Image.open(normal).convert('RGBA')).astype(np.int64)
    b = np.asarray(Image.open(shiny).convert('RGBA')).astype(np.int64)
    if a.shape != b.shape:
        return None
    va, vb = a[..., 3] > 0, b[..., 3] > 0
    if (va != vb).mean() > 0.002:
        return None
    m = va & vb
    ca = (a[..., 0] << 16 | a[..., 1] << 8 | a[..., 2])[m]
    cb = (b[..., 0] << 16 | b[..., 1] << 8 | b[..., 2])[m]
    # Cada color normal → su shiny más frecuente (algún píxel suelto puede no casar).
    votos: dict[int, Counter] = {}
    for x, y in zip(ca.tolist(), cb.tolist()):
        votos.setdefault(x, Counter())[y] += 1
    return sorted([x, c.most_common(1)[0][0]] for x, c in votos.items())


def main() -> None:
    sin_descarga = '--sin-descarga' in sys.argv
    out, hojas, faltan, malas = {}, {}, [], []
    for dex in especies():
        carpeta = os.path.join(RAIZ, 'assets', 'sprites', 'pokemon', dex)
        for h in hojas_usadas(carpeta):
            s, n = bajar(dex, h, sin_descarga), os.path.join(carpeta, f'{h}-Anim.png')
            if s and os.path.exists(n) and casa(n, s):
                hojas.setdefault(dex, []).append(h)
            else:
                malas.append(f'{dex}/{h}')
        p = None
        for anim in ('Idle', 'Walk'):
            s = bajar(dex, anim, sin_descarga)
            if s and os.path.exists(os.path.join(carpeta, f'{anim}-Anim.png')):
                p = paleta(os.path.join(carpeta, f'{anim}-Anim.png'), s)
            if p:
                break
        if p and any(x != y for x, y in p):
            out[dex] = p
        else:
            faltan.append(dex)
    destino = os.path.join(RAIZ, 'src', 'data', 'gen', 'shiny.json')
    with open(destino, 'w', encoding='utf-8') as f:
        json.dump({'pal': out, 'hojas': hojas}, f, separators=(',', ':'))
    print(f'{len(out)} paletas, {sum(map(len, hojas.values()))} hojas: {destino}')
    if faltan:
        print('sin paleta:', ' '.join(faltan))
    if malas:
        print('sin hoja shiny (se recolorea con la paleta):', ' '.join(malas))


if __name__ == '__main__':
    main()
