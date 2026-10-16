#!/bin/bash
# Ciudad por piezas (2026-10-16): la distribución de la ciudad pintada (ciudad_D_s1) se queda, pero cada cosa pasa a
# ser un elemento suelto, como en el resto del juego.
# - Piezas: recortes.py saca cada edificio por su polígono sobre verde; Klein --edit con el recorte y la referencia de
#   estilo lo repinta entero a 1024² ("misma forma, mismo sitio", receta "repintado" de la fase 3 del pueblo).
# - Suelo: Klein --edit de la ciudad entera pidiendo quitar todo lo que no es suelo (edificios, árboles, farolas…).
cd "/a/PROYECTOS/Pokemon Valley"; D=assets/gen/arcane/ciudad/piezas; REF=docs/art/ref/arcane_lago.png; CIU=docs/art/ref/arcane_ciudad.png
EST="the painterly style of the second image: Arcane animated series style, hand-painted digital painting with clearly visible textured brushstrokes, confident dark ink linework, muted desaturated colors with warm highlights and cool shadows, gritty painted texture on every surface, crisp clean details"
k() { [ -f $2_0.png ] || python -I tools/comfy.py "$1" --model klein --edit "${@:5}" --out $2 --seed $3 --w $4 --h $4 > $2.log 2>&1 < /dev/null; }
for s in ${SEMILLAS:-1 2}; do
  while IFS='|' read -r id que; do
    [ -z "$id" ] && continue
    # Setos: con la receta de los edificios salían casas cubiertas de hiedra (v1_setos/). Instrucción propia, sin "building".
    case $id in seto_*)
      k "Completely repaint $que from the first image in $EST. It is only a living hedge: a solid block of dense trimmed green leaves with flat clipped top and sides, seen from the same 3/4 top-down view, with exactly the same outline, size and position in the image. Absolutely no building, no walls, no windows, no roof, no lamp. Flat plain green background around it, no ground" $D/${id}_s$s $s 1024 $D/recorte_$id.png $REF
      continue;; esac
    k "Completely repaint $que from the first image in $EST. Keep exactly the same building: same shape, same roof, same windows and door in the same places, same size and position in the image, same 3/4 top-down view. Remove any ground, grass or pavement around it: the building stands alone on a flat plain green background, no other objects" $D/${id}_s$s $s 1024 $D/recorte_$id.png $REF
  done < $D/piezas.txt
  [ -f $D/suelo_s${s}_0.png ] || python -I tools/comfy.py "Remove every building, house, roof, tree, hedge, bush, street lamp, bench, market stall, cart, barrel and the fountain from this city map, leaving only the bare ground exactly as it is: the same cobblestone streets, sidewalks, stone curbs, the octagonal plaza, dirt yards, lawns, the canal wall and water, all in exactly the same places. Where a building stood, continue the surrounding ground (lawn or packed dirt). Same top-down view, same painterly style, no objects at all" --model klein --edit $CIU --out $D/suelo_s$s --seed $s --w 1536 --h 1152 > $D/suelo_s$s.log 2>&1 < /dev/null
done
echo FIN >> $D/progreso.txt
