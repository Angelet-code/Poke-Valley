#!/bin/bash
# Fase 2 del plan Arcane (docs/art/ARCANE.md): las piezas del Bosque Verde (y el poste de las salidas).
# Receta: Klein 4B --edit con la referencia de estilo docs/art/ref/arcane_lago.png sola y la pieza descrita con palabras.
# Salidas: assets/gen/arcane/bosque/<id>_s<N>_0.png (1024², fondo verde liso, para lab/tools/recortar.py).
cd "/a/PROYECTOS/Pokemon Valley"; B=assets/gen/arcane/bosque; REF=docs/art/ref/arcane_lago.png
EST="game asset in exactly the painterly style of this reference (Arcane animated series style): hand-painted digital painting, visible textured brushstrokes, confident dark ink linework, muted colors with warm highlights and cool shadows."
FIN="3/4 top-down view, centered alone on a flat plain green background, standing directly on the background without any ground patch, no other objects"
while IFS='|' read -r id que; do for s in ${SEMILLAS:-1 2 3}; do
  [ -f $B/${id}_s${s}_0.png ] && continue
  python -I tools/comfy.py "$EST $que, $FIN" --model klein --edit $REF --out $B/${id}_s$s --seed $s --w 1024 --h 1024 > $B/log_${id}_s$s.txt 2>&1
done; done <<'LISTA'
estanque|A small rounded-square pond edged with grey stones, calm blue-green water inside, flat on the ground
roca_1|A single rounded grey boulder with a few cracks
roca_3|A single wide flat-topped grey boulder
roca_5|A cluster of three small grey rocks of different sizes
roca_7|A single low flat grey stone slab
roca_8|A cluster of two medium grey rocks leaning together
seta|A small cluster of three brown-capped forest mushrooms with pale stems
tronco_caido|A fallen mossy tree log lying horizontally on the ground, with broken branch stubs and a cut end showing rings
arbol_viejo|A single huge ancient oak tree with a massive gnarled trunk, thick roots spreading on the ground, a wide dark green canopy and a hollow in the trunk
panal|A wild beehive: a large golden honeycomb mound built against a small rock, hexagonal cells, a few drips of honey
poste|A rustic wooden signpost with two blank wooden arrow boards pointing left and right, no text
LISTA
echo FIN > $B/FIN.txt
