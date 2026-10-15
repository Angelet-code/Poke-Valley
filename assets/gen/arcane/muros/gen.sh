#!/bin/bash
# Barreras y piezas para construir (docs/art/ARCANE.md, "Muros y barreras", 2026-10-15). Misma receta que los biomas:
# Klein 4B --edit con la referencia docs/art/ref/arcane_lago.png sola, la pieza descrita con palabras, fondo verde liso.
# piezas.txt: bioma|pieza|forma|descripción. Forma: H = tira horizontal (1280x640), V = tira vertical (640x1280),
# S = suelta (1024²). Las tiras se vuelven repetibles con lab/tools/tiras_arcane.py.
# Salida: <bioma>/<pieza>[_v]_s<N>_0.png. Primero la semilla 1 de todo, luego la 2.
cd "/a/PROYECTOS/Pokemon Valley"; B=assets/gen/arcane/muros; REF=docs/art/ref/arcane_lago.png
EST="game asset in exactly the painterly style of this reference (Arcane animated series style): hand-painted digital painting, visible textured brushstrokes, confident dark ink linework, muted colors with warm highlights and cool shadows."
H="3/4 top-down view, perfectly straight and horizontal, running the full width of the image from the left edge to the right edge, uniform height along its whole length, on a flat plain green background above and below, no ground patch, no other objects"
V="3/4 top-down view, running straight away from the viewer, perfectly vertical in the image from the top edge to the bottom edge, seen mostly from above so we see its top surface and one side, orthographic with parallel edges and no perspective, uniform width along its whole length, on a flat plain green background on the left and right, no ground patch, no other objects"
S="3/4 top-down view, centered alone on a flat plain green background, standing directly on the background without any ground patch, no other objects"
for s in ${SEMILLAS:-1 2}; do while IFS='|' read -r bio id forma que; do
  [ -z "$bio" ] && continue; mkdir -p $B/$bio
  case $forma in H) n=$id; fin=$H; w=1280; h=640;; V) n=${id}_v; fin=$V; w=640; h=1280;; S) n=$id; fin=$S; w=1024; h=1024;; esac
  [ -f $B/$bio/${n}_s${s}_0.png ] && continue
  python -I tools/comfy.py "$EST $que, $fin" --model klein --edit $REF --out $B/$bio/${n}_s$s --seed $s --w $w --h $h > $B/$bio/log_${n}_s$s.txt 2>&1
done < $B/piezas.txt; done
echo FIN > $B/FIN.txt
