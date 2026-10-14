#!/bin/sh
# Decorados del pueblo (2026-10-14): receta del nido/caja (edificios_pueblo/gen.sh): Flux.2 Klein 4B +
# pixel-art-lora-klein4b a 512² sobre magenta liso, de frente. Luego hoja.py (reducir.py de edificios_pueblo).
cd "/a/PROYECTOS/Pokemon Valley"; B=assets/gen/pixel/decor_pueblo
TAIL="straight-on front view facing the viewer, not isometric, no corner facing the camera, top-down 3/4 RPG view like Stardew Valley, isolated and centered on a solid flat magenta background, no cast shadow, limited palette, clean dark outlines"
while IFS='|' read -r s d; do for seed in ${SEMILLAS:-1 2 3 4}; do
  [ -f $B/klein/${s}_s${seed}_0.png ] && continue
  python -I tools/comfy.py "pixel art sprite, $d, $TAIL, game asset" --out $B/klein/${s}_s$seed --seed $seed \
    --model klein --lora pixel-art-lora-klein4b.safetensors:1.0 --w 512 --h 512 > $B/klein/log_${s}_s$seed.txt 2>&1
done; done < $B/sujetos.txt
echo FIN > $B/klein/FIN.txt
