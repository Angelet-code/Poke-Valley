#!/bin/bash
# Reinterpretar elementos con Flux.2 Klein 4B (local), manteniendo el estilo del dibujo.
# A) editar la casa grande (ReferenceLatent): mismo diseño, limpio.  B) casa nueva con el dibujo entero como referencia de estilo.
cd "/a/PROYECTOS/Pokemon Valley"
PA="the same wooden cabin, redrawn cleanly in exactly the same cartoon game-art style: thick irregular dark outlines, flat cel shading, orange tiled roof with clear tile lines, grey wooden plank walls, one clearly readable front door, no artifacts, no double lines, nothing blending together, centered on a flat plain green background, 3/4 top-down view"
PB="in exactly the same hand-drawn cartoon game-art style as this reference village (thick irregular dark outlines, flat cel shading, muted palette), a single small wooden cabin with an orange tiled roof, grey plank walls and one clearly readable front door, seen from the front in 3/4 top-down view, well constructed and readable, clean, no artifacts, centered alone on a flat plain green background"
for s in 1 2 3 4; do
  python -I tools/comfy.py "$PA" --model klein --edit lab/assets/gen/ref_casa_grande.png --out lab/assets/gen/klein_edit_casa_s$s --seed $s --w 1024 --h 1024 2>&1 | tail -1
done
for s in 1 2 3 4; do
  python -I tools/comfy.py "$PB" --model klein --edit lab/assets/ref/aldea_dibujo.png --out lab/assets/gen/klein_nueva_casa_s$s --seed $s --w 1024 --h 1024 2>&1 | tail -1
done
echo FIN
