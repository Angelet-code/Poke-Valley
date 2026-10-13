"""Mapa de prueba con lagos de formas difíciles, para buscar fallos del agua y la pared.

Uso: python -I tools/map_lakes_test.py docs/art/mapas/lagos_prueba.json [--n 24]
Se abre en la maqueta con ?mapa=lagos_prueba.

Formas (en esquinas de casilla, 0 césped, 1 tierra, 2 losas, 3 agua):
círculo grande con isla, diagonales a izquierda y derecha, canal de una casilla,
forma de L, charca mínima, lago junto a tierra y losas, y lagos tocando los bordes.
"""
import argparse
import json


def main():
    a = argparse.ArgumentParser()
    a.add_argument("out")
    a.add_argument("--n", type=int, default=24)
    o = a.parse_args()
    n = o.n
    V = [[0] * (n + 1) for _ in range(n + 1)]

    def put(x, y, v):
        if 0 <= x <= n and 0 <= y <= n:
            V[y][x] = v

    # Círculo con isla.
    for y in range(n + 1):
        for x in range(n + 1):
            if (x - 6) ** 2 + (y - 6) ** 2 <= 16:
                put(x, y, 3)
    for x, y in [(6, 6), (7, 6), (6, 7)]:
        put(x, y, 0)
    # Diagonal hacia la derecha (pared en escalera) y hacia la izquierda.
    for k in range(6):
        for w in range(3):
            put(13 + k + w, 2 + k, 3)
            put(22 - k - w, 9 + k, 3)
    # Canal de una casilla, vertical y horizontal.
    for y in range(13, 20):
        put(3, y, 3)
    for x in range(3, 10):
        put(x, 20, 3)
    # L.
    for y in range(13, 18):
        for x in range(7, 9):
            put(x, y, 3)
    for x in range(7, 12):
        for y in range(16, 18):
            put(x, y, 3)
    # Charca mínima (una esquina).
    put(14, 14, 3)
    # Lago junto a tierra y losas.
    for y in range(17, 20):
        for x in range(14, 18):
            put(x, y, 3)
    for y in range(15, 22):
        put(19, y, 1)
        put(20, y, 2)
        put(21, y, 1)
    for x in range(13, 19):
        put(x, 16, 1)
    # Bordes: abajo a la izquierda, abajo y arriba a la derecha.
    for y in range(22, n + 1):
        for x in range(0, 3):
            put(x, y, 3)
    for x in range(10, 16):
        put(x, n, 3)
        put(x, n - 1, 3 if x % 2 else 0)
    for y in range(0, 3):
        put(n, y, 3)
        put(n - 1, y, 3)
    json.dump({"mw": n, "mh": n, "vert": V}, open(o.out, "w"))
    for row in V:
        print("".join(".-#~"[v] for v in row))


if __name__ == "__main__":
    main()
