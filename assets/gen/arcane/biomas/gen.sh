#!/bin/bash
# Biomas del mundo (docs/GDD-mundo.md §4, 2026-10-15): piezas y suelos en estilo Arcane para las zonas futuras.
# Misma receta que el lago (assets/gen/arcane/lago/gen.sh): Klein 4B --edit con la referencia docs/art/ref/arcane_lago.png
# sola y la pieza descrita con palabras, fondo verde liso, 3 semillas. Suelos: textura en ese estilo, 2 semillas
# (luego repetibles con quilt, como en la fase 0).
# piezas.txt: bioma|id|tipo|ancho en el mundo|descripción. suelos.txt: bioma|id|descripción.
cd "/a/PROYECTOS/Pokemon Valley"; B=assets/gen/arcane/biomas; REF=docs/art/ref/arcane_lago.png
EST="game asset in exactly the painterly style of this reference (Arcane animated series style): hand-painted digital painting, visible textured brushstrokes, confident dark ink linework, muted colors with warm highlights and cool shadows."
FIN="3/4 top-down view, centered alone on a flat plain green background, standing directly on the background without any ground patch, no other objects"
while IFS='|' read -r bio id tipo ancho que; do mkdir -p $B/$bio; for s in ${SEMILLAS:-1 2 3}; do
  [ -f $B/$bio/${id}_s${s}_0.png ] && continue
  python -I tools/comfy.py "$EST $que, $FIN" --model klein --edit $REF --out $B/$bio/${id}_s$s --seed $s --w 1024 --h 1024 > $B/$bio/log_${id}_s$s.txt 2>&1
done; done < $B/piezas.txt
while IFS='|' read -r bio id que; do mkdir -p $B/$bio/suelo; for s in 1 2; do
  [ -f $B/$bio/suelo/${id}_s${s}_0.png ] && continue
  python -I tools/comfy.py "a seamless flat top-down ground texture of $que, painted in exactly the painterly style of this reference (Arcane animated series style): soft visible brushstrokes, muted colors, subtle variation, calm and simple, no objects, no lines, no shadows, fills the whole image" --model klein --edit $REF --out $B/$bio/suelo/${id}_s$s --seed $s --w 1024 --h 1024 > $B/$bio/suelo/log_${id}_s$s.txt 2>&1
done; done < $B/suelos.txt
echo FIN > $B/FIN.txt
