#!/bin/sh
# Dragón del marco del alfa (HUD del modo aventura, 2026-10-15): receta del nido/caja (edificios_pueblo/gen.sh):
# Flux.2 Klein 4B + pixel-art-lora-klein4b a 512² sobre magenta liso. Luego reducir.py.
cd "/a/PROYECTOS/Pokemon Valley"; B=assets/gen/pixel/ui_dragon
TAIL="isolated and centered on a solid flat magenta background, no cast shadow, limited palette, golden yellow and orange tones, clean dark outlines, 16-bit SNES pixel art"
while IFS='|' read -r s d; do for seed in ${SEMILLAS:-1 2 3 4 5 6}; do
  [ -f $B/klein/${s}_s${seed}_0.png ] && continue
  python -I tools/comfy.py "pixel art sprite, $d, $TAIL, game asset" --out $B/klein/${s}_s$seed --seed $seed \
    --model klein --lora pixel-art-lora-klein4b.safetensors:1.0 --w 512 --h 512 > $B/klein/log_${s}_s$seed.txt 2>&1
done; done < $B/sujetos.txt
echo FIN > $B/klein/FIN.txt
