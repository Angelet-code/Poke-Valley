"""Genera imágenes con el ComfyUI local (http://127.0.0.1:8188).

Uso:
  python -I tools/comfy.py "prompt" --out assets/gen/prueba [--neg "..."]
      [--w 1024] [--h 1024] [--n 1] [--seed 1] [--steps 28] [--cfg 6]
      [--model sdxl|flux|klein] [--ckpt otro.safetensors] [--unet unet_diffusers.safetensors]
      [--sampler euler_ancestral --scheduler normal]
      [--lora archivo.safetensors[:fuerza] ...]
      [--ref imagen1 imagen2 ... --ref-weight 0.8 --ref-mode "style transfer"]
      [--init imagen.png --denoise 0.4]

--model flux usa Flux.1-dev GGUF (nodo ComfyUI-GGUF) con T5 fp8 + CLIP-L y el
VAE ae.safetensors; ignora el prompt negativo (cfg 1, guía Flux --guidance).
--model klein usa Flux.2 Klein 4B fp8 (4 pasos, cfg 1); acepta --lora.
--ckpt cambia el checkpoint SDXL (Illustrious, etc.); --unet carga un UNet suelto
(formato diffusers, p. ej. pixel-party-xl) con el CLIP y VAE de --ckpt.
--ref (IP-Adapter) solo funciona con SDXL.

--ref usa IP-Adapter (nodo ComfyUI_IPAdapter_plus) para tomar el estilo de
las imágenes de referencia. Las imágenes se copian a ComfyUI/input.
--init parte de una imagen (img2img, solo SDXL): se codifica y se repinta con
--denoise (0 = igual, 1 = nueva). Sirve para limpiar y ampliar un recorte sin
cambiar su diseño. Su tamaño manda sobre --w/--h.
Guarda los resultados como <out>_<n>.png.
"""
import argparse
import json
import shutil
import time
import urllib.parse
import urllib.request
from pathlib import Path

SERVER = "http://127.0.0.1:8188"
COMFY_DIR = Path(r"F:\ComfyUI\ComfyUI_windows_portable\ComfyUI")
CHECKPOINT = "sd_xl_base_1.0.safetensors"
FLUX_UNET = "flux1-dev-Q4_K_S.gguf"
KLEIN_UNET = "flux-2-klein-4b-fp8.safetensors"   # models/diffusion_models
KLEIN_TE = "qwen_3_4b.safetensors"               # models/text_encoders
NEGATIVE = "blurry, photo, realistic, 3d render, text, watermark, signature, frame, border, ui, jpeg artifacts"


def post(path, data):
    req = urllib.request.Request(SERVER + path, data=json.dumps(data).encode(), headers={"Content-Type": "application/json"})
    return json.load(urllib.request.urlopen(req))


def get(path):
    return json.load(urllib.request.urlopen(SERVER + path))


def build(a, ref_names):
    flux = a.model in ("flux", "klein")
    if a.model == "klein":
        # Flux.2 Klein 4B (destilado): fp8 en diffusion_models, Qwen3-4B en text_encoders, VAE flux2.
        # 4 pasos, cfg 1, euler/simple; sin FluxGuidance. Latente de 128 canales (EmptyFlux2LatentImage).
        g = {
            "unet": {"class_type": "UNETLoader", "inputs": {"unet_name": KLEIN_UNET, "weight_dtype": "default"}},
            "clips": {"class_type": "CLIPLoader", "inputs": {"clip_name": KLEIN_TE, "type": "flux2"}},
            "vae": {"class_type": "VAELoader", "inputs": {"vae_name": "flux2-vae.safetensors"}},
            "latent": {"class_type": "EmptyFlux2LatentImage", "inputs": {"width": a.w, "height": a.h, "batch_size": a.n}},
        }
        model, clip, vae = ["unet", 0], ["clips", 0], ["vae", 0]
    elif flux:
        g = {
            "unet": {"class_type": "UnetLoaderGGUF", "inputs": {"unet_name": FLUX_UNET}},
            "clips": {"class_type": "DualCLIPLoader", "inputs": {
                "clip_name1": "t5xxl_fp8_e4m3fn.safetensors", "clip_name2": "clip_l.safetensors", "type": "flux"}},
            "vae": {"class_type": "VAELoader", "inputs": {"vae_name": "ae.safetensors"}},
            "latent": {"class_type": "EmptySD3LatentImage", "inputs": {"width": a.w, "height": a.h, "batch_size": a.n}},
        }
        model, clip, vae = ["unet", 0], ["clips", 0], ["vae", 0]
    else:
        g = {
            "ckpt": {"class_type": "CheckpointLoaderSimple", "inputs": {"ckpt_name": a.ckpt}},
            "latent": {"class_type": "EmptyLatentImage", "inputs": {"width": a.w, "height": a.h, "batch_size": a.n}},
        }
        model, clip, vae = ["ckpt", 0], ["ckpt", 1], ["ckpt", 2]
        if a.unet:
            # UNet suelto (formato diffusers, p. ej. pixel-party-xl) + CLIP y VAE del checkpoint base.
            g["unet"] = {"class_type": "UNETLoader", "inputs": {"unet_name": a.unet, "weight_dtype": "default"}}
            model = ["unet", 0]
        if a.clip_skip > 1:
            # "clip skip 2" de A1111 = CLIPSetLastLayer -2 (Illustrious/Pony lo piden)
            g["clipskip"] = {"class_type": "CLIPSetLastLayer", "inputs": {"clip": clip, "stop_at_clip_layer": -a.clip_skip}}
            clip = ["clipskip", 0]
    for i, spec in enumerate(a.lora):
        name, _, strength = spec.partition(":")
        st = float(strength or 1.0)
        g[f"lora{i}"] = {"class_type": "LoraLoader", "inputs": {
            "model": model, "clip": clip, "lora_name": name, "strength_model": st, "strength_clip": st}}
        model, clip = [f"lora{i}", 0], [f"lora{i}", 1]
    if ref_names:
        for i, name in enumerate(ref_names):
            g[f"ref{i}"] = {"class_type": "LoadImage", "inputs": {"image": name}}
        img = ["ref0", 0]
        for i in range(1, len(ref_names)):
            g[f"batch{i}"] = {"class_type": "ImageBatch", "inputs": {"image1": img, "image2": [f"ref{i}", 0]}}
            img = [f"batch{i}", 0]
        g["ipa_loader"] = {"class_type": "IPAdapterUnifiedLoader", "inputs": {"model": model, "preset": "PLUS (high strength)"}}
        g["ipa"] = {"class_type": "IPAdapterAdvanced", "inputs": {
            "model": ["ipa_loader", 0], "ipadapter": ["ipa_loader", 1], "image": img,
            "weight": a.ref_weight, "weight_type": a.ref_mode, "combine_embeds": "average",
            "start_at": 0.0, "end_at": 1.0, "embeds_scaling": "V only"}}
        model = ["ipa", 0]
    if a.init:
        g["init"] = {"class_type": "LoadImage", "inputs": {"image": a.init_name}}
        g["enc"] = {"class_type": "VAEEncode", "inputs": {"pixels": ["init", 0], "vae": vae}}
        g["latent"] = {"class_type": "RepeatLatentBatch", "inputs": {"samples": ["enc", 0], "amount": a.n}}
    g["pos"] = {"class_type": "CLIPTextEncode", "inputs": {"text": a.prompt, "clip": clip}}
    g["neg"] = {"class_type": "CLIPTextEncode", "inputs": {"text": "" if flux else a.neg, "clip": clip}}
    positive = ["pos", 0]
    for i, name in enumerate(getattr(a, "edit_names", [])):
        # Flux.2 Klein como editor: cada imagen de --edit va como latente de referencia (ReferenceLatent),
        # el resultado conserva su diseño y aplica el prompt ("the same building, now ...").
        g[f"edimg{i}"] = {"class_type": "LoadImage", "inputs": {"image": name}}
        g[f"edscale{i}"] = {"class_type": "ImageScaleToTotalPixels", "inputs": {
            "image": [f"edimg{i}", 0], "upscale_method": "lanczos", "megapixels": 1.0, "resolution_steps": 16}}
        g[f"edenc{i}"] = {"class_type": "VAEEncode", "inputs": {"pixels": [f"edscale{i}", 0], "vae": vae}}
        g[f"edref{i}"] = {"class_type": "ReferenceLatent", "inputs": {"conditioning": positive, "latent": [f"edenc{i}", 0]}}
        positive = [f"edref{i}", 0]
    if a.model == "flux":
        g["guide"] = {"class_type": "FluxGuidance", "inputs": {"conditioning": positive, "guidance": a.guidance}}
        positive = ["guide", 0]
    g["sample"] = {"class_type": "KSampler", "inputs": {
        "model": model, "positive": positive, "negative": ["neg", 0], "latent_image": ["latent", 0],
        "seed": a.seed, "steps": a.steps, "cfg": 1.0 if flux else a.cfg,
        "sampler_name": a.sampler or ("euler" if flux else "dpmpp_2m"),
        "scheduler": a.scheduler or ("simple" if flux else "karras"),
        "denoise": a.denoise if a.init else 1.0}}
    g["decode"] = {"class_type": "VAEDecode", "inputs": {"samples": ["sample", 0], "vae": vae}}
    g["save"] = {"class_type": "SaveImage", "inputs": {"images": ["decode", 0], "filename_prefix": "valley"}}
    return g


def main():
    p = argparse.ArgumentParser()
    p.add_argument("prompt")
    p.add_argument("--out", required=True)
    p.add_argument("--neg", default=NEGATIVE)
    p.add_argument("--w", type=int, default=1024)
    p.add_argument("--h", type=int, default=1024)
    p.add_argument("--n", type=int, default=1)
    p.add_argument("--seed", type=int, default=1)
    p.add_argument("--steps", type=int)
    p.add_argument("--cfg", type=float, default=6.0)
    p.add_argument("--model", choices=["sdxl", "flux", "klein"], default="sdxl")
    p.add_argument("--ckpt", default=CHECKPOINT, help="checkpoint SDXL/Illustrious (models/checkpoints)")
    p.add_argument("--unet", help="UNet suelto en models/diffusion_models (p. ej. pixel-party-xl_unet.safetensors); CLIP/VAE del --ckpt")
    p.add_argument("--clip-skip", type=int, default=1, help="2 para Illustrious/Pony (CLIPSetLastLayer -2); solo SDXL")
    p.add_argument("--sampler", help="forzar sampler (euler, dpmpp_2m, euler_ancestral...)")
    p.add_argument("--scheduler", help="forzar scheduler (karras, simple, normal...)")
    p.add_argument("--guidance", type=float, default=3.5)
    p.add_argument("--lora", nargs="*", default=[])
    p.add_argument("--ref", nargs="*", default=[])
    p.add_argument("--ref-weight", type=float, default=0.8)
    p.add_argument("--ref-mode", default="style transfer")
    p.add_argument("--init")
    p.add_argument("--denoise", type=float, default=0.4)
    p.add_argument("--edit", nargs="*", default=[], help="solo klein: imágenes de referencia para editar (ReferenceLatent)")
    a = p.parse_args()
    a.steps = a.steps or {"flux": 20, "klein": 4}.get(a.model, 28)
    if a.ref and a.model != "sdxl":
        raise SystemExit("--ref (IP-Adapter) solo funciona con --model sdxl")

    if a.init:
        if a.model != "sdxl":
            raise SystemExit("--init solo funciona con --model sdxl")
        shutil.copy(a.init, COMFY_DIR / "input" / Path(a.init).name)
        a.init_name = Path(a.init).name
    if a.edit and a.model != "klein":
        raise SystemExit("--edit solo funciona con --model klein")
    a.edit_names = []
    for r in a.edit:
        shutil.copy(r, COMFY_DIR / "input" / Path(r).name)
        a.edit_names.append(Path(r).name)
    ref_names = []
    for r in a.ref:
        dst = COMFY_DIR / "input" / Path(r).name
        shutil.copy(r, dst)
        ref_names.append(dst.name)

    pid = post("/prompt", {"prompt": build(a, ref_names)})["prompt_id"]
    t0 = time.time()
    while True:
        h = get(f"/history/{pid}")
        if pid in h:
            break
        time.sleep(1)
    status = h[pid].get("status", {})
    if status.get("status_str") == "error":
        raise SystemExit(json.dumps(status, indent=1)[:3000])
    out = Path(a.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    i = 0
    for node in h[pid]["outputs"].values():
        for im in node.get("images", []):
            q = urllib.parse.urlencode({"filename": im["filename"], "subfolder": im["subfolder"], "type": im["type"]})
            data = urllib.request.urlopen(f"{SERVER}/view?{q}").read()
            dst = out.parent / f"{out.name}_{i}.png"
            dst.write_bytes(data)
            print(dst)
            i += 1
    print(f"{time.time() - t0:.1f}s")


if __name__ == "__main__":
    main()
