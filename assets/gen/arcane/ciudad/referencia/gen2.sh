#!/bin/bash
# Segunda tanda (2026-10-16): la primera (gen.sh) salió en vista isométrica/oblicua, y el juego es 3/4 de frente.
# Klein --edit con DOS imágenes: la de estilo (arcane_lago.png) y una captura del pueblo en el juego
# (docs/art/arcane/pueblo_vista.jpg) como referencia de cámara y escala. Calles paralelas a los bordes de la imagen.
# → ciudad_C_s<N>_0.png (plaza central) y ciudad_D_s<N>_0.png (calle mayor y canal).
cd "/a/PROYECTOS/Pokemon Valley"; D=assets/gen/arcane/ciudad/referencia
REF=docs/art/ref/arcane_lago.png; CAM=docs/art/arcane/pueblo_vista.jpg
EST="A complete top-down video game map of a small Pokemon city, painted in exactly the painterly style of the first image (Arcane animated series style): hand-painted digital painting, visible textured brushstrokes, confident dark ink linework, muted colors with warm highlights and cool shadows."
VISTA="Use exactly the camera angle and scale of the second image: straight-on high top-down 3/4 game view, the camera looks straight north, every building front faces down toward the viewer and is parallel to the bottom edge of the image, roofs seen from above, streets run perfectly horizontal and perfectly vertical parallel to the image edges, no diagonal streets, not isometric, no perspective convergence. Consistent scale: houses about one eighth of the image wide. Clean readable layout, one coherent paving per street with stone curbs where paving changes, no people, no text, no UI."
C="The city is enclosed by a straight stone city wall along the top edge with an arched gate in the middle. A central square plaza of cobblestones with a round fountain, benches and trees in planters. North of the plaza: a Pokemon Center with a red roof, a Poke Mart with a blue roof and a clock tower. West of the plaza a large gym. East a small park with lawn, hedges and a music kiosk. A straight horizontal street below the plaza with terraced houses and a market. Along the bottom edge a straight horizontal canal with a stone embankment and one stone bridge. Iron street lamps as tall as a house door."
Dd="A straight vertical main street of cobblestones runs from a stone city gate at the top edge to a stone bridge over a straight horizontal canal along the bottom edge. A straight horizontal cross street in the middle forms a square plaza with a fountain. Along the streets: a Pokemon Center with a red roof, a Poke Mart with a blue roof, a market with covered stalls, a big gym, a town hall with a clock tower and rows of terraced houses. A green park with hedges in one corner. Iron street lamps as tall as a house door."
k() { [ -f $2_0.png ] || python -I tools/comfy.py "$1" --model klein --edit $REF $CAM --out $2 --seed $3 --w 1536 --h 1152 > $2.log 2>&1 < /dev/null; }
for s in ${SEMILLAS:-1 2 3}; do
  k "$EST $C $VISTA" $D/ciudad_C_s$s $s
  k "$EST $Dd $VISTA" $D/ciudad_D_s$s $s
  echo "tanda2 semilla $s" >> $D/progreso.txt
done
echo FIN2 >> $D/progreso.txt
