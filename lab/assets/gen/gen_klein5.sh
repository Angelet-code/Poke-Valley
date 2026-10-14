#!/bin/bash
# Tanda 5 (2026-10-14): farola para el mapa de noche (Klein, el dibujo entero como referencia de estilo), sobre verde liso.
cd "/a/PROYECTOS/Pokemon Valley"
EST="in exactly the same hand-drawn cartoon game-art style as this reference village (thick irregular dark outlines, flat cel shading, muted palette), 3/4 top-down view, clean and readable, no artifacts, centered alone on a flat plain green background:"
declare -A SUJ
SUJ[farola]="a single old-fashioned village street lamp post: a slim dark wrought-iron pole on a small stone base, with a glass lantern on top holding a warm yellow glowing candle flame, tall and narrow"
SUJ[farola_b]="a single rustic wooden lamp post: a slim wooden pole with a hanging paper lantern glowing warm orange, tall and narrow"
for k in farola farola_b; do
  for s in 1 2; do
    python -I tools/comfy.py "$EST ${SUJ[$k]}" --model klein --edit lab/assets/ref/aldea_dibujo.png --out lab/assets/gen/klein_${k}_s$s --seed $s --w 1024 --h 1024 2>&1 | tail -1
  done
done
echo FIN
