#!/bin/sh
# 0.2b (2026-10-13): Nido y Comedero del pueblo. Misma receta que el tronco (PIPELINE §4): Flux.2 Klein 4B +
# pixel-art-lora-klein4b a 512² sobre magenta liso; luego reducir.py (BOX premultiplicado + paleta corta).
cd "/a/PROYECTOS/Pokemon Valley"; B=assets/gen/pixel/edificios_pueblo
TAIL="front view facing the viewer, top-down 3/4 RPG view like Stardew Valley, isolated and centered on a solid flat magenta background, no cast shadow, limited palette, clean dark outlines"
run() { s=$1; seed=$2; d=$3
  python -I tools/comfy.py "pixel art sprite, $d, $TAIL, game asset" --out $B/klein/${s}_s$seed --seed $seed \
    --model klein --lora pixel-art-lora-klein4b.safetensors:1.0 --w 512 --h 512 > $B/klein/log_${s}_s$seed.txt 2>&1; }
mkdir -p $B/klein
while IFS='|' read -r s d; do for seed in 1 2 3 4 5 6; do run "$s" $seed "$d"; done; done < $B/sujetos.txt
echo FIN > $B/klein/FIN.txt
