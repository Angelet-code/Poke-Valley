#!/bin/sh
# Comedero nuevo (2026-10-14): copia de la parte de iconos de gen_edificios2.sh (receta del nido/caja con FRENTE):
# Klein 4B + pixel-art-lora-klein4b 1.0 a 512², magenta liso, prompt de frente. 3 ideas (sujetos_comedero2.txt) x 5 semillas.
# Salidas en klein3/<id>_s<N>_0.png. Reducción y hoja: hoja_comedero2.py.
cd "/a/PROYECTOS/Pokemon Valley"; B=assets/gen/pixel/edificios_pueblo
TAILI="straight-on symmetrical front view facing the viewer, the long side parallel to the viewer, seen slightly from above, top-down 3/4 RPG view like Stardew Valley, not isometric, no corner facing the camera, isolated and centered on a solid flat magenta background, no cast shadow, limited palette, clean dark outlines, no text"
mkdir -p $B/klein3
while IFS='|' read -r s d; do for seed in ${SEMILLAS:-1 2 3 4 5}; do
  python -I tools/comfy.py "pixel art sprite, $d, $TAILI, game asset" --out $B/klein3/${s}_s$seed --seed $seed \
    --model klein --lora pixel-art-lora-klein4b.safetensors:1.0 --w 512 --h 512 > $B/klein3/log_${s}_s$seed.txt 2>&1
done; done < $B/sujetos_comedero2.txt
echo FIN > $B/klein3/FIN.txt
