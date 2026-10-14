#!/bin/sh
# Horno, guardería, ladrillo y plato (2026-10-14): copia de gen_edificios.sh (edificios a 1024²) y de gen_caja.sh
# con FRENTE (iconos a 512², receta del tronco/nido). Klein 4B + pixel-art-lora-klein4b 1.0, magenta liso.
# Salidas en klein2/<id>_s<N>_0.png.
cd "/a/PROYECTOS/Pokemon Valley"; B=assets/gen/pixel/edificios_pueblo
E=$B/sujetos_edificios2.txt; I=$B/sujetos_iconos2.txt
[ "$SOLO" = ladrillo2 ] && { E=/dev/null; I=$B/sujetos_ladrillo2.txt; }
TAIL="straight-on symmetrical front view facing the viewer, the facade parallel to the viewer and the roof seen from above-front, top-down 3/4 RPG view like Stardew Valley, not isometric, no corner facing the camera, isolated and centered on a solid flat magenta background, no cast shadow, limited palette, clean dark outlines"
TAILI="straight-on front view facing the viewer, seen slightly from above, top-down 3/4 RPG view like Stardew Valley, not isometric, no corner facing the camera, isolated and centered on a solid flat magenta background, no cast shadow, limited palette, clean dark outlines, no text"
mkdir -p $B/klein2
while IFS='|' read -r s d; do for seed in ${SEMILLAS:-1 2 3 4 5 6}; do
  python -I tools/comfy.py "pixel art sprite, $d, $TAIL, game asset" --out $B/klein2/${s}_s$seed --seed $seed \
    --model klein --lora pixel-art-lora-klein4b.safetensors:1.0 --w 1024 --h 1024 > $B/klein2/log_${s}_s$seed.txt 2>&1
done; done < $E
while IFS='|' read -r s d; do for seed in ${SEMILLAS:-1 2 3 4 5 6}; do
  python -I tools/comfy.py "pixel art sprite, $d, $TAILI, game asset" --out $B/klein2/${s}_s$seed --seed $seed \
    --model klein --lora pixel-art-lora-klein4b.safetensors:1.0 --w 512 --h 512 > $B/klein2/log_${s}_s$seed.txt 2>&1
done; done < $I
echo FIN > $B/klein2/FIN.txt
# Ladrillo, semillas 7-12 (2026-10-14): las 1-6 salieron con 2 ladrillos en rombo (isométricos). Prompt reforzado:
# SOLO=ladrillo2 SEMILLAS="7 8 9 10 11 12" sh gen_edificios2.sh
