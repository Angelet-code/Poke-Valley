"""Prueba "tamaño justo" (2026-10-13): objetos pequeños generados a lienzo pequeño
(SDXL+pixel-art-xl 512² → paso 8 → 64 celdas; Flux+Top-Down 320² → paso 4 → 80 celdas).
Para cada PNG: pixel_grid.py con paso forzado, --largest, 16 colores; pixel_clean --check
(huérfanos/dobles); hoja: original | sprite ×4 sobre césped | ×12 | Bulbasaur ×4 al lado para escala.
Uso: python -I assets/gen/nativo/procesar.py  -> assets/gen/nativo/hoja_nativo.png y metricas.txt
"""
import re
import subprocess
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[3]
B = ROOT / "assets/gen/nativo"
GRASS = (150, 176, 95, 255)
PY = [sys.executable, "-I"]
try:
    FONT = ImageFont.truetype("arial.ttf", 14)
except OSError:
    FONT = ImageFont.load_default()


def run(args):
    r = subprocess.run(PY + args, cwd=ROOT, capture_output=True, text=True)
    return r.stdout + r.stderr


def bulbasaur():
    im = Image.open(ROOT / "assets/sprites/pokemon/0001/Idle-Anim.png").convert("RGBA")
    return im.crop((0, 0, 40, 40))


def on_grass(im, z, pad=1):
    big = im.resize((im.width * z, im.height * z), Image.Resampling.NEAREST)
    bg = Image.new("RGBA", (big.width + 2 * z * pad, big.height + 2 * z * pad), GRASS)
    bg.alpha_composite(big, (z * pad, z * pad))
    return bg


def main():
    rows = []
    metr = []
    for src in sorted(B.glob("*_*_*.png")):
        if src.name.startswith(("px_", "hoja")):
            continue
        pitch = 8 if src.name.startswith("xl512") else 4
        dst = B / f"px_{src.stem}.png"
        out = run(["tools/pixel_grid.py", str(src), str(dst), "--largest", "--pitch", str(pitch),
                   "--colors", "16", "--bg-tol", "40", "--despeckle", "1"])
        if not dst.exists():
            metr.append(f"{src.name}: FALLO {out[-200:]}")
            continue
        chk = run(["tools/pixel_clean.py", str(dst), "--check", "--colors", "16"])
        hu = re.search(r"hu[ée]rfanos\D*(\d+)", chk)
        do = re.search(r"dobles\D*(\d+)", chk)
        sp = Image.open(dst).convert("RGBA")
        info = f"{src.stem}: paso {pitch} -> {sp.width}x{sp.height} huerf {hu.group(1) if hu else '?'} dobles {do.group(1) if do else '?'}"
        metr.append(info)
        rows.append((src, sp, info))
    (B / "metricas.txt").write_text("\n".join(metr), encoding="utf-8")
    # hoja
    bulba = bulbasaur()
    Z, ZC = 4, 12
    cells = []
    for src, sp, info in rows:
        orig = Image.open(src).convert("RGBA").resize((160, 160), Image.Resampling.NEAREST)
        big = on_grass(sp, Z)
        bul = on_grass(bulba, Z)
        w, h = sp.size
        c = sp.crop((0, 0, min(w, 20), min(h, 20)))
        zoom = on_grass(c, ZC)
        cells.append((info, orig, big, bul, zoom))
    W = 160 + 8 + 260 + 8 + 180 + 8 + 260 + 16
    H = sum(max(c[2].height, c[3].height, c[4].height, 160) + 30 for c in cells) + 10
    sheet = Image.new("RGBA", (W, H), (40, 40, 44, 255))
    d = ImageDraw.Draw(sheet)
    y = 6
    for info, orig, big, bul, zoom in cells:
        d.text((6, y), info, fill=(255, 230, 120, 255), font=FONT)
        y += 20
        x = 6
        sheet.alpha_composite(orig, (x, y)); x += 168
        sheet.alpha_composite(big, (x, y)); x += 268
        sheet.alpha_composite(bul, (x, y)); x += 188
        sheet.alpha_composite(zoom, (x, y))
        y += max(big.height, bul.height, zoom.height, 160) + 10
    sheet.save(B / "hoja_nativo.png")
    print("\n".join(metr))


if __name__ == "__main__":
    main()
