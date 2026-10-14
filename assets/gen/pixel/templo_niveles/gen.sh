#!/bin/sh
# Templo en 10 niveles (2026-10-14): Klein 4B + pixel-art-lora-klein4b 1.0 en modo EDICIÓN (comfy.py --edit,
# ReferenceLatent): cada nivel parte del anterior (klein/nNN.png) encogido ×ESC (0.85) con lienzo.py para que
# tenga sitio para crecer. n01 = santuario s3 de edificios_pueblo (aprobado). Niveles y prompts en niveles.txt.
# Uso: sh gen.sh 05  → klein/n05_s1..s3 desde klein/pad_n04.png; elegir.py escoge cuál sigue la cadena (cadena.sh)
cd "/a/PROYECTOS/Pokemon Valley"; B=assets/gen/pixel/templo_niveles
L=$(grep "^$1|" $B/niveles.txt); desde=$(echo "$L" | cut -d'|' -f2); d=$(echo "$L" | cut -d'|' -f3)
TAIL="Make the change clearly visible and use the free space around it. The big pink blossoming cherry tree stays behind the building (the new taller parts may hide part of it, but its pink crown still shows around them). Same building design, same style and palette, same straight-on symmetrical front view (not isometric), same solid flat magenta background, no cast shadow, clean dark outlines, game asset"
python -I $B/lienzo.py $desde ${ESC:-0.85}
for seed in ${SEMILLAS:-1 2 3}; do
  python -I tools/comfy.py "pixel art sprite. The same shrine as in the reference image, $d. $TAIL" \
    --edit $B/klein/pad_n$desde.png --out $B/klein/n$1_s$seed --seed $seed \
    --model klein --lora pixel-art-lora-klein4b.safetensors:1.0 --w 1024 --h 1024 > $B/klein/log_n$1_s$seed.txt 2>&1
done
