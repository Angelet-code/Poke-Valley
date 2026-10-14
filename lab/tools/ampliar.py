"""Amplia el dibujo de referencia con un modelo de superresolucion local (ComfyUI, RealESRGAN).

Uso: python -I lab/tools/ampliar.py [--modelo RealESRGAN_x4plus.safetensors] [--entrada ...] [--salida ...]

LoadImage -> UpscaleModelLoader -> ImageUpscaleWithModel (x4) -> SaveImage; despues se reduce a x2
(LANCZOS) y se guarda en lab/assets/ref/aldea_dibujo_x2.png (o --salida). Los modelos estan en
ComfyUI/models/upscale_models/ como .safetensors (convertidos del .pth oficial con weights_only=True).
"""
import argparse
import shutil
import sys
import time
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(RAIZ.parent / "tools"))
from comfy import COMFY_DIR, get, post  # noqa: E402

from PIL import Image  # noqa: E402


def ampliar(src, modelo):
    name = "lab_" + Path(src).name
    shutil.copy(src, COMFY_DIR / "input" / name)
    g = {
        "img": {"class_type": "LoadImage", "inputs": {"image": name}},
        "um": {"class_type": "UpscaleModelLoader", "inputs": {"model_name": modelo}},
        "up": {"class_type": "ImageUpscaleWithModel", "inputs": {"upscale_model": ["um", 0], "image": ["img", 0]}},
        "save": {"class_type": "SaveImage", "inputs": {"images": ["up", 0], "filename_prefix": "lab_ampliado"}},
    }
    pid = post("/prompt", {"prompt": g})["prompt_id"]
    while pid not in (h := get(f"/history/{pid}")):
        time.sleep(0.5)
    status = h[pid].get("status", {})
    if status.get("status_str") == "error":
        raise SystemExit(str(status)[:2000])
    im = h[pid]["outputs"]["save"]["images"][0]
    return Image.open(COMFY_DIR / "output" / im.get("subfolder", "") / im["filename"]).convert("RGB")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--modelo", default="RealESRGAN_x4plus.safetensors")
    ap.add_argument("--entrada", default=str(RAIZ / "assets/ref/aldea_dibujo.png"))
    ap.add_argument("--salida", default=str(RAIZ / "assets/ref/aldea_dibujo_x2.png"))
    ap.add_argument("--x", type=int, default=2, help="ampliacion final respecto al original")
    o = ap.parse_args()
    t0 = time.time()
    big = ampliar(o.entrada, o.modelo)
    w, h = Image.open(o.entrada).size
    out = big.resize((w * o.x, h * o.x), Image.LANCZOS)
    out.save(o.salida)
    print(o.salida, out.size, f"{time.time() - t0:.0f} s", o.modelo)


if __name__ == "__main__":
    main()
