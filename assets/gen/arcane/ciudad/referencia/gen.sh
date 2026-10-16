#!/bin/bash
# Referencia de la ciudad entera en estilo Arcane (2026-10-16), para montar el mapa 'ciudad' a partir de ella
# (el primer montaje con el kit suelto quedó incoherente: suelos que chocan, escalas y pegotes).
# Klein 4B --edit con la referencia de estilo docs/art/ref/arcane_lago.png, vista 3/4 de juego, 1536x1152.
# Dos ideas de trazado (A: plaza central y calles en cruz; B: calle mayor y canal) × semillas → ciudad_<idea>_s<N>_0.png.
cd "/a/PROYECTOS/Pokemon Valley"; D=assets/gen/arcane/ciudad/referencia; REF=docs/art/ref/arcane_lago.png
EST="A complete top-down video game map of a small Pokemon city, painted in exactly the painterly style of this reference (Arcane animated series style): hand-painted digital painting, visible textured brushstrokes, confident dark ink linework, muted colors with warm highlights and cool shadows."
VISTA="Seen from high above in a 3/4 top-down RPG view like Stardew Valley or Eastward: building fronts face the viewer and roofs are seen from above, consistent scale, every building the same perspective, not isometric, no corner facing the camera. Clean readable layout with clear walkable streets, one coherent paving per street with stone curbs where paving changes, no people, no text, no UI."
A="The city is enclosed by a stone city wall along the top edge with an arched gate in the middle. A central cobblestone plaza with a round fountain, benches and trees in planters. Around the plaza: a Pokemon Center with a red roof, a Poke Mart with a blue roof, a large gym building, a clock tower and rows of terraced houses. Two straight streets cross at the plaza. A small park with lawn, hedges and a music kiosk on the right. At the bottom, a canal of calm water with a stone embankment and an arched stone bridge. Iron street lamps as tall as a house door along the streets."
B="A wide main street of cobblestones runs from a stone city gate at the top to an arched stone bridge over a canal at the bottom. Along the street: a Pokemon Center with a red roof, a Poke Mart with a blue roof, a market square with covered stalls, a big gym and a town hall with a clock tower. Side alleys of terraced houses with small gardens. A green park with hedges and trees on one side. The canal crosses the whole bottom of the map with a stone embankment. Tall iron street lamps along the main street."
k() { [ -f $2_0.png ] || python -I tools/comfy.py "$1" --model klein --edit $REF --out $2 --seed $3 --w 1536 --h 1152 > $2.log 2>&1 < /dev/null; }
for s in ${SEMILLAS:-1 2 3}; do
  k "$EST $A $VISTA" $D/ciudad_A_s$s $s
  k "$EST $B $VISTA" $D/ciudad_B_s$s $s
  echo "semilla $s" >> $D/progreso.txt
done
echo FIN >> $D/progreso.txt
