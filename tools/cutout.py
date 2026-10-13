"""Recorta objetos generados con BiRefNet (nodo local de ComfyUI) y los prepara.

Uso: python -I tools/cutout.py <entrada.png> <salida.png> [--h 64] [--mask-out m.png]

1. Envía la imagen a ComfyUI: LoadBackgroundRemovalModel(birefnet) ->
   RemoveBackground -> máscara del primer plano.
2. Aplica la máscara como canal alfa, recorta al contenido y, si se da --h,
   reduce a esa altura (LANCZOS con alfa premultiplicado).
"""
import argparse
import shutil
import sys
import urllib.parse
import urllib.request
from io import BytesIO
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from comfy import COMFY_DIR, SERVER, get, post  # noqa: E402

from PIL import Image  # noqa: E402


def mask_for(src):
    name = Path(src).name
    shutil.copy(src, COMFY_DIR / "input" / name)
    g = {
        "img": {"class_type": "LoadImage", "inputs": {"image": name}},
        "bgm": {"class_type": "LoadBackgroundRemovalModel", "inputs": {"bg_removal_name": "birefnet.safetensors"}},
        "rm": {"class_type": "RemoveBackground", "inputs": {"bg_removal_model": ["bgm", 0], "image": ["img", 0]}},
        "m2i": {"class_type": "MaskToImage", "inputs": {"mask": ["rm", 0]}},
        "save": {"class_type": "SaveImage", "inputs": {"images": ["m2i", 0], "filename_prefix": "mask"}},
    }
    pid = post("/prompt", {"prompt": g})["prompt_id"]
    while pid not in (h := get(f"/history/{pid}")):
        pass
    status = h[pid].get("status", {})
    if status.get("status_str") == "error":
        raise SystemExit(str(status)[:2000])
    im = h[pid]["outputs"]["save"]["images"][0]
    q = urllib.parse.urlencode({"filename": im["filename"], "subfolder": im["subfolder"], "type": im["type"]})
    return Image.open(BytesIO(urllib.request.urlopen(f"{SERVER}/view?{q}").read())).convert("L")


def main():
    a = argparse.ArgumentParser()
    a.add_argument("src")
    a.add_argument("dst")
    a.add_argument("--h", type=int)
    a.add_argument("--mask-out")
    o = a.parse_args()
    im = Image.open(o.src).convert("RGBA")
    mask = mask_for(o.src).resize(im.size)
    if o.mask_out:
        mask.save(o.mask_out)
    im.putalpha(mask)
    im = im.crop(im.getbbox())
    if o.h:
        w = max(1, round(im.width * o.h / im.height))
        im = im.convert("RGBa").resize((w, o.h), Image.LANCZOS).convert("RGBA")
    Path(o.dst).parent.mkdir(parents=True, exist_ok=True)
    im.save(o.dst)
    print(o.dst, im.size)


if __name__ == "__main__":
    main()
