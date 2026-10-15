#!/bin/bash
# Ciudad en estilo Arcane (docs/art/ARCANE.md, "Ciudad", 2026-10-15). Receta de los biomas y los muros: Klein 4B --edit con
# la referencia docs/art/ref/arcane_lago.png sola, la pieza descrita con palabras, fondo verde liso.
# piezas.txt: id|tipo|ancho en el mundo|descripción (sueltas, 1024²) → <id>_s<N>_0.png.
# tiras.txt: pieza|forma|descripción → assets/gen/arcane/muros/ciudad/<pieza>[_v]_s<N>_0.png, el formato de los muros,
#   para lab/tools/tiras_arcane.py (H 1280x640, V 640x1280).
# suelos.txt: id|descripción → suelo/<id>_s<N>_0.png (luego repetibles con tools/quilt.py --kind color, como la fase 0).
# Primero la semilla 1 de todo, luego la 2 y la 3 (suelos y tiras, solo 1 y 2).
cd "/a/PROYECTOS/Pokemon Valley"; B=assets/gen/arcane/ciudad; M=assets/gen/arcane/muros/ciudad; REF=docs/art/ref/arcane_lago.png
mkdir -p $B/suelo $M
EST="game asset in exactly the painterly style of this reference (Arcane animated series style): hand-painted digital painting, visible textured brushstrokes, confident dark ink linework, muted colors with warm highlights and cool shadows."
S="3/4 top-down view, centered alone on a flat plain green background, standing directly on the background without any ground patch, no other objects, no people"
H="3/4 top-down view, perfectly straight and horizontal, running the full width of the image from the left edge to the right edge, uniform height along its whole length, on a flat plain green background above and below, no ground patch, no other objects, no people"
V="3/4 top-down view, running straight away from the viewer, perfectly vertical in the image from the top edge to the bottom edge, seen mostly from above so we see its top surface and one side, orthographic with parallel edges and no perspective, uniform width along its whole length, on a flat plain green background on the left and right, no ground patch, no other objects"
SU="painted in exactly the painterly style of this reference (Arcane animated series style): soft visible brushstrokes, muted colors, subtle variation, calm and simple, no objects, no shadows, fills the whole image"
k() { python -I tools/comfy.py "$1" --model klein --edit $REF --out $2 --seed $3 --w $4 --h $5 > $2.log 2>&1 < /dev/null; }
for s in ${SEMILLAS:-1 2 3}; do
  if [ $s -le 2 ]; then
    while IFS='|' read -r id que; do
      [ -z "$id" ] || [ -f $B/suelo/${id}_s${s}_0.png ] || k "a seamless flat top-down ground texture of $que, $SU" $B/suelo/${id}_s$s $s 1024 1024
    done < $B/suelos.txt
  fi
  while IFS='|' read -r id tipo ancho que; do
    [ -z "$id" ] || [ -f $B/${id}_s${s}_0.png ] || k "$EST $que, $S" $B/${id}_s$s $s 1024 1024
  done < $B/piezas.txt
  if [ $s -le 2 ]; then
    while IFS='|' read -r p forma que; do
      [ -z "$p" ] && continue
      case $forma in H) n=$p; f=$H; w=1280; h=640;; V) n=${p}_v; f=$V; w=640; h=1280;; esac
      [ -f $M/${n}_s${s}_0.png ] || k "$EST $que, $f" $M/${n}_s$s $s $w $h
    done < $B/tiras.txt
  fi
  echo "semilla $s" >> $B/progreso.txt
done
echo FIN >> $B/progreso.txt
