#!/bin/bash
# Fase 1 del plan Arcane (docs/art/ARCANE.md): las piezas del Lago Celeste.
# Receta: Klein 4B --edit con la referencia de estilo docs/art/ref/arcane_lago.png sola y la pieza descrita con palabras.
# (Editar la pieza dibujo con la referencia como 2.ª imagen apenas cambiaba el estilo: pruebas/prueba_conservador_arbol.png.)
# Salidas: assets/gen/arcane/lago/<id>_s<N>_0.png (1024², fondo verde liso, para lab/tools/recortar.py).
cd "/a/PROYECTOS/Pokemon Valley"; B=assets/gen/arcane/lago; REF=docs/art/ref/arcane_lago.png
EST="game asset in exactly the painterly style of this reference (Arcane animated series style): hand-painted digital painting, visible textured brushstrokes, confident dark ink linework, muted colors with warm highlights and cool shadows."
FIN="3/4 top-down view, centered alone on a flat plain green background, standing directly on the background without any ground patch, no other objects"
while IFS='|' read -r id que; do for s in ${SEMILLAS:-1 2 3}; do
  [ -f $B/${id}_s${s}_0.png ] && continue
  python -I tools/comfy.py "$EST $que, $FIN" --model klein --edit $REF --out $B/${id}_s$s --seed $s --w 1024 --h 1024 > $B/log_${id}_s$s.txt 2>&1
done; done <<'LISTA'
arbol_alto|A single tall round leafy tree with a dense dark teal-green canopy and a short brown trunk
arbol_bajo|A single small round leafy tree with a dense teal-green canopy and a short brown trunk
arbusto|A single round green bush
roca_0|A single grey boulder with a few facets
roca_2|A single flat-topped grey boulder
roca_4|A cluster of three small grey rocks of different sizes
roca_6|A single rounded grey boulder
tocon|A cut tree stump with visible rings on top and a few roots
flores|A small cluster of orange and yellow wildflowers with a few green leaves, flat on the ground
piedras_0|An irregular patch of rounded pale cobblestones set in brown earth, flat on the ground, organic uneven outline
sauce|A single weeping willow tree with long drooping curtains of pale green leaves hanging down to the ground and a short brown trunk
juncos|A small clump of tall cattail reeds: thin upright green blades and a few brown cattail heads
muelle|A small wooden pier seen straight-on from the front: a short rectangular deck of weathered brown planks on wooden posts, one mooring post with a rope coil
nenufar|A small floating cluster of three round green lily pads with one pink water lily flower, flat on the ground
LISTA
echo FIN > $B/FIN.txt
