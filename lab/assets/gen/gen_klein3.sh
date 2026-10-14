#!/bin/bash
# Tanda 3: ediciones Klein de las casas que faltan y elementos nuevos (estilo del dibujo), 2 semillas.
cd "/a/PROYECTOS/Pokemon Valley"
EST="in exactly the same hand-drawn cartoon game-art style as this reference village (thick irregular dark outlines, flat cel shading, muted palette), 3/4 top-down view, clean and readable, no artifacts, centered alone on a flat plain green background:"
ED="redrawn cleanly in exactly the same cartoon game-art style: thick irregular dark outlines, flat cel shading, clear tile lines, one clearly readable front door, no artifacts, no double lines, nothing blending together, centered on a flat plain green background, 3/4 top-down view"
for s in 1 2; do
  python -I tools/comfy.py "the same long wooden cabin, $ED" --model klein --edit lab/assets/gen/ref_casa_larga.png --out lab/assets/gen/klein_edit_larga_s$s --seed $s --w 1024 --h 1024 2>&1 | tail -1
  python -I tools/comfy.py "the same wooden cabin with a stone chimney, $ED" --model klein --edit lab/assets/gen/ref_casa_chimenea.png --out lab/assets/gen/klein_edit_chimenea_s$s --seed $s --w 1024 --h 1024 2>&1 | tail -1
done
declare -A SUJ
SUJ[hoguera]="a small campfire: a ring of grey stones around a few logs with orange flames"
SUJ[camino_b]="an irregular patch of cobblestone path, pale rounded stones with brown mortar between them, organic uneven outline, not rectangular"
SUJ[camino_c]="a short winding dirt path segment, brown earth with a few small pale stones, organic soft edges"
SUJ[roca_b]="a single flat-topped grey-purple boulder"
SUJ[roca_c]="a cluster of three small grey-purple rocks of different sizes"
SUJ[tienda]="a small wooden market shop with a striped red-and-white awning over a counter, wooden crates of fruit in front, orange tiled roof"
SUJ[almacen]="a wooden storage barn with a wide double door, orange tiled roof, two stacked barrels beside the door"
SUJ[pozo]="a round stone water well with a small wooden roof and a bucket hanging from a rope"
SUJ[arbusto]="a single round green bush"
SUJ[valla]="a short wooden fence segment with three posts and two rails"
SUJ[tocon]="a tree stump with an axe stuck in it"
SUJ[flores]="a small cluster of orange and yellow flowers with a few green leaves"
for k in hoguera camino_b camino_c roca_b roca_c tienda almacen pozo arbusto valla tocon flores; do
  for s in 1 2; do
    python -I tools/comfy.py "$EST ${SUJ[$k]}" --model klein --edit lab/assets/ref/aldea_dibujo.png --out lab/assets/gen/klein_${k}_s$s --seed $s --w 1024 --h 1024 2>&1 | tail -1
  done
done
echo FIN
