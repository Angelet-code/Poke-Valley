#!/bin/bash
# Prueba A/B de estilo (2026-10-15): sauce, juncos y muelle del Lago Celeste en estilo dibujo y en pixel art.
# A) dibujo: receta del lab (lab/assets/gen/gen_klein3.sh): Klein 4B --edit con el dibujo entero como referencia, fondo verde.
# B) pixel: receta de los decorados (assets/gen/pixel/decor_pueblo/gen.sh): Klein 4B + pixel-art-lora-klein4b, magenta.
cd "/a/PROYECTOS/Pokemon Valley"; B=assets/gen/ab_lago
EST="in exactly the same hand-drawn cartoon game-art style as this reference village (thick irregular dark outlines, flat cel shading, muted palette), 3/4 top-down view, clean and readable, no artifacts, centered alone on a flat plain green background:"
TAIL="straight-on front view facing the viewer, not isometric, no corner facing the camera, top-down 3/4 RPG view like Stardew Valley, isolated and centered on a solid flat magenta background, no cast shadow, limited palette, clean dark outlines"
declare -A SUJ
SUJ[sauce]="a single weeping willow tree with long drooping curtains of pale green leaves hanging down to the ground and a short brown trunk"
SUJ[juncos]="a small clump of tall cattail reeds: thin upright green blades and a few brown cattail heads"
SUJ[muelle]="a small wooden pier: a short rectangular deck of light brown planks on wooden posts, one mooring post with a rope coil"
for k in sauce juncos muelle; do for s in ${SEMILLAS:-1 2 3}; do
  [ -f $B/dibujo/${k}_s${s}_0.png ] || python -I tools/comfy.py "$EST ${SUJ[$k]}" --model klein --edit lab/assets/ref/aldea_dibujo.png --out $B/dibujo/${k}_s$s --seed $s --w 1024 --h 1024 > $B/dibujo/log_${k}_s$s.txt 2>&1
  [ -f $B/pixel/${k}_s${s}_0.png ] || python -I tools/comfy.py "pixel art sprite, ${SUJ[$k]}, $TAIL, game asset" --model klein --lora pixel-art-lora-klein4b.safetensors:1.0 --out $B/pixel/${k}_s$s --seed $s --w 512 --h 512 > $B/pixel/log_${k}_s$s.txt 2>&1
done; done
echo FIN > $B/FIN.txt
