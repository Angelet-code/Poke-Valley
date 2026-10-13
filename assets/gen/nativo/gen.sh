#!/bin/sh
# Prueba "tamano justo" 2026-10-13: generar pequeno para que el sprite salga de 24-48 celdas.
cd "/a/PROYECTOS/Pokemon Valley"; B=assets/gen/nativo
TAIL="top-down 3/4 RPG view like Stardew Valley, single small object isolated and centered on a solid flat magenta background, no text, no cast shadow, 16-bit pixel art, clean outlines, limited palette"
NEG="blurry, photo, realistic, 3d render, text, watermark, signature, frame, border, ui, jpeg artifacts, people, humans, characters, multiple objects, isometric, noise, dither, gradient"
for s in "pokeball|a red and white poke ball" "troncos|a small pile of three cut wood logs" "piedra|a small grey rock" "mesa|a small wooden workbench with a hammer on top"; do
  n=${s%%|*}; d=${s#*|}
  python -I tools/comfy.py "pixel art, $d, $TAIL" --out $B/xl512_$n --seed 1 --n 2 --model sdxl --lora pixel-art-xl.safetensors:1.0 --steps 25 --cfg 5 --w 512 --h 512 --neg "$NEG" > $B/log_xl_$n.txt 2>&1
  python -I tools/comfy.py "top-down pixel art of $d, $TAIL, big chunky pixels, flat shading" --out $B/flux320_$n --seed 1 --n 2 --model flux --lora Top-Down_Pixel_Art_Flux_Lora_r1.safetensors:0.8 --steps 20 --w 320 --h 320 > $B/log_flux_$n.txt 2>&1
done
echo FIN > $B/FIN.txt
