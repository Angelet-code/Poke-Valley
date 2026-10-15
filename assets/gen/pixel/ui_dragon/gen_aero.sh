#!/bin/sh
# Marco de élite del alfa con un Aerodactyl dorado (2026-10-15): Klein 4B + pixel-art-lora-klein4b, 512², magenta.
cd "/a/PROYECTOS/Pokemon Valley"; B=assets/gen/pixel/ui_dragon
TAIL="isolated and centered on a solid flat magenta background, no cast shadow, limited palette, golden yellow and orange tones, clean dark outlines, 16-bit SNES pixel art"
while IFS='|' read -r s d; do seed=${SEMILLA:-1}
  python -I tools/comfy.py "pixel art sprite, $d, $TAIL, game asset" --out $B/klein/${s}_s$seed --seed $seed \
    --model klein --lora pixel-art-lora-klein4b.safetensors:1.0 --w 512 --h 512 > $B/klein/log_${s}_s$seed.txt 2>&1
done < $B/sujetos_aero.txt
