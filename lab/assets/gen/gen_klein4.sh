#!/bin/bash
# Caminos empedrados organicos (los de la tanda 2 salian rectangulares).
cd "/a/PROYECTOS/Pokemon Valley"
EST="in exactly the same hand-drawn cartoon game-art style as this reference village (thick irregular dark outlines, flat cel shading, muted palette), 3/4 top-down view, clean and readable, no artifacts, centered alone on a flat plain green background:"
for s in 1 2 3; do
  python -I tools/comfy.py "the same irregular patch of cobblestones, redrawn cleanly in exactly the same cartoon game-art style: rounded pale stones of different sizes set in brown earth, organic uneven outline exactly like the reference, thick irregular dark outlines, flat cel shading, centered on a flat plain green background" --model klein --edit lab/assets/gen/ref_piedras_0.png --out lab/assets/gen/klein_edit_piedras_s$s --seed $s --w 1024 --h 1024 2>&1 | tail -1
  python -I tools/comfy.py "$EST a winding cobblestone footpath: rounded pale stones of different sizes set in brown earth, the path curves like an S, with an organic uneven outline, no straight edges, not a rectangle, not a grid" --model klein --edit lab/assets/ref/aldea_dibujo.png --out lab/assets/gen/klein_camino_e_s$s --seed $s --w 1024 --h 1024 2>&1 | tail -1
  python -I tools/comfy.py "$EST a short loose cobblestone trail: a scattered handful of rounded pale stepping stones of different sizes, roughly following a gentle curve, with bits of brown earth around some of them, organic, no rectangle" --model klein --edit lab/assets/ref/aldea_dibujo.png --out lab/assets/gen/klein_camino_f_s$s --seed $s --w 1024 --h 1024 2>&1 | tail -1
done
echo FIN
