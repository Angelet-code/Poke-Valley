#!/bin/sh
# 5 edificios del pueblo (2026-10-14): receta del nido/caja (Klein 4B + pixel-art-lora-klein4b 1.0, magenta liso),
# a 1024² (edificios grandes: más detalle; PIPELINE §3b "mejor dibujante" a 1024²). Salidas en klein/<id>_s<N>_0.png.
cd "/a/PROYECTOS/Pokemon Valley"; B=assets/gen/pixel/edificios_pueblo
TAIL="straight-on symmetrical front view facing the viewer, the facade parallel to the viewer and the roof seen from above-front, top-down 3/4 RPG view like Stardew Valley, not isometric, no corner facing the camera, isolated and centered on a solid flat magenta background, no cast shadow, limited palette, clean dark outlines"
while IFS='|' read -r s d; do for seed in ${SEMILLAS:-1 2 3 4}; do
  python -I tools/comfy.py "pixel art sprite, $d, $TAIL, game asset" --out $B/klein/${s}_s$seed --seed $seed \
    --model klein --lora pixel-art-lora-klein4b.safetensors:1.0 --w 1024 --h 1024 > $B/klein/log_${s}_s$seed.txt 2>&1
done; done < $B/sujetos_edificios.txt
echo FIN > $B/klein/FIN_edificios.txt
