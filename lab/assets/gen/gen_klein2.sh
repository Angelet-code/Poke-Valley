#!/bin/bash
# Elementos nuevos en el estilo del dibujo (Klein, el dibujo entero como referencia de estilo), sobre verde liso.
cd "/a/PROYECTOS/Pokemon Valley"
EST="in exactly the same hand-drawn cartoon game-art style as this reference village (thick irregular dark outlines, flat cel shading, muted palette), 3/4 top-down view, clean and readable, no artifacts, centered alone on a flat plain green background:"
declare -A SUJ
SUJ[arbol]="a single round leafy tree with a dark teal-green canopy and a short brown trunk"
SUJ[roca]="a single grey-purple boulder with a few facets"
SUJ[estanque]="a small rounded-square pond edged with grey stones, light blue water inside"
SUJ[camino]="a patch of cobblestone path, pale rounded stones with brown mortar between them, irregular edge"
SUJ[cabana]="a tiny wooden hut with an orange tiled roof held by two wooden posts at the front, grey plank walls, a clearly readable front door"
for k in arbol roca estanque camino cabana; do
  for s in 1 2; do
    python -I tools/comfy.py "$EST ${SUJ[$k]}" --model klein --edit lab/assets/ref/aldea_dibujo.png --out lab/assets/gen/klein_${k}_s$s --seed $s --w 1024 --h 1024 2>&1 | tail -1
  done
done
echo FIN
