#!/bin/bash
# Suelos repetibles de la ciudad (docs/art/ARCANE.md, "Ciudad"): textura elegida (semilla) → tools/repetible_periodo.py →
# lab/assets/suelo_arcane/ciudad/<id>.png (+ prueba/<id>_2x2.png). id:semilla:size:min
cd "/a/PROYECTOS/Pokemon Valley"; O=lab/assets/suelo_arcane/ciudad; mkdir -p $O/prueba
for e in adoquin:2:256:0.55 losas_plaza:1:220:0.55 ladrillo:1:256:0.55 calzada:2:220:0.55 baldosa:1:256:0.55 \
         tierra_batida:1:360:0.8 cesped_parque:1:360:0.8 canal:1:360:0.8; do
  IFS=: read -r id s z m <<< "$e"
  python -I tools/repetible_periodo.py assets/gen/arcane/ciudad/suelo/${id}_s${s}_0.png $O/$id.png --size $z --min $m --banda 12
  mv -f $O/${id}_2x2.png $O/prueba/
done
