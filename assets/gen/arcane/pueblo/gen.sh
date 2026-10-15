#!/bin/bash
# Fase 3 del plan Arcane (docs/art/ARCANE.md): las piezas del pueblo.
# Receta "repintado": Klein 4B --edit con dos imágenes, la pieza del estilo dibujo (lab/assets/gen/klein_*) y la referencia
# docs/art/ref/arcane_lago.png, con un prompt de estilo fuerte y "misma forma, mismo sitio". Conserva la silueta, así que
# los polígonos del suelo de las casas (SUELOS en src/render/Dibujo.ts), la puerta y el punto de luz de las farolas
# siguen valiendo (comparativa: pruebas/). El tablón, que es nuevo, sale de la referencia sola (receta del lago).
cd "/a/PROYECTOS/Pokemon Valley"; B=assets/gen/arcane/pueblo; REF=docs/art/ref/arcane_lago.png; G=lab/assets/gen
EST="the painterly style of the second image: Arcane animated series style, hand-painted digital painting with clearly visible textured brushstrokes, confident dark ink linework, muted desaturated colors with warm highlights and cool shadows, gritty painted texture on every surface"
while IFS='|' read -r id src que; do for s in ${SEMILLAS:-1 2}; do
  [ -f $B/${id}_s${s}_0.png ] && continue
  if [ "$src" = "-" ]; then
    python -I tools/comfy.py "game asset in exactly the painterly style of this reference (Arcane animated series style): hand-painted digital painting, visible textured brushstrokes, confident dark ink linework, muted colors with warm highlights and cool shadows. $que, 3/4 top-down view, centered alone on a flat plain green background, no other objects" --model klein --edit $REF --out $B/${id}_s$s --seed $s --w 1024 --h 1024 > $B/log_${id}_s$s.txt 2>&1
  else
    python -I tools/comfy.py "Completely repaint $que from the first image in $EST. Keep exactly the same object: same shape, same outline, same parts in the same places, same size and position in the image, same view. Flat plain green background" --model klein --edit $G/$src $REF --out $B/${id}_s$s --seed $s --w 1024 --h 1024 > $B/log_${id}_s$s.txt 2>&1
  fi
done; done <<'LISTA'
casa_grande|klein_edit_casa_s1_0.png|the house
casa_cabana|klein_cabana_s1_0.png|the small wooden hut
casa_larga|klein_edit_larga_s1_0.png|the long wooden cabin
casa_chimenea|klein_edit_chimenea_s1_0.png|the wooden cabin with a stone chimney
tienda|klein_tienda_s1_0.png|the small market shop
almacen|klein_almacen_s2_0.png|the wooden storage barn
pozo|klein_pozo_s1_0.png|the stone water well
hoguera|klein_hoguera_s1_0.png|the campfire
valla|klein_valla_s1_0.png|the wooden fence
farola|klein_farola_s1_0.png|the street lamp post
farola_madera|klein_farola_b_s1_0.png|the wooden lamp post with its hanging lantern
camino_c|klein_camino_c_s2_0.png|the dirt path
camino_d|klein_camino_f_s3_0.png|the cobblestone trail
camino_e|klein_camino_f_s1_0.png|the cobblestone trail
tablon|-|A wooden village notice board on two posts with a small roof, a few blank paper notes pinned on it, no text
LISTA
echo FIN > $B/FIN.txt
