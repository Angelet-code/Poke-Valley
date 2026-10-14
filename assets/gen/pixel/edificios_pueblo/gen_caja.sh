#!/bin/sh
# Caja de envío de Pelipper (0.2d, 2026-10-13): misma receta que nido/comedero (gen.sh), solo la última línea de sujetos.txt.
cd "/a/PROYECTOS/Pokemon Valley"; B=assets/gen/pixel/edificios_pueblo
TAIL="front view facing the viewer, top-down 3/4 RPG view like Stardew Valley, isolated and centered on a solid flat magenta background, no cast shadow, limited palette, clean dark outlines"
d=$(grep '^caja|' $B/sujetos.txt | cut -d'|' -f2)
# Semillas 7-12: refuerzo de frente (las 1-6 salieron con la esquina hacia la cámara).
[ -n "$FRENTE" ] && d="$d, straight-on symmetrical front view, the flat front face parallel to the viewer and the lid seen from above, not isometric, no corner facing the camera"
for seed in ${SEMILLAS:-1 2 3 4 5 6}; do
  python -I tools/comfy.py "pixel art sprite, $d, $TAIL, game asset" --out $B/klein/caja_s$seed --seed $seed \
    --model klein --lora pixel-art-lora-klein4b.safetensors:1.0 --w 512 --h 512 > $B/klein/log_caja_s$seed.txt 2>&1
done
echo FIN > $B/klein/FIN_caja.txt
