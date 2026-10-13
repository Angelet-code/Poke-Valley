#!/bin/sh
# VERSION 3 de los edificios: receta completa y reproducible (ejecutar desde la raiz del proyecto).
# 1) Flux 768x768 (ver flux768/gen.sh) -> 2) un color por celda real (paso 4 px, sin re-render)
# -> 3) limpieza automatica (pixel_clean) -> 4) txt editable -> 5) retoques a mano (retoques_*.py)
# -> 6) pixel_build -> assets/game. Las previsualizaciones x6 y los recortes x12 de pixel_clean
# quedan en esta carpeta.
set -e
L=assets/gen/edificios/limpio
SRC=assets/gen/pixel/src/edificios
# 2) muestreo 1:1 (tolerancia de fondo baja: 30, los brillos rosados del tejado se parecen al magenta)
python -I tools/pixel_grid.py assets/gen/edificios/flux768/casa_s2_0.png   $L/casa_1a1.png   --largest --bg-tol 30 --colors 20 --despeckle 0 --preview $L/casa_1a1_x6.png
python -I tools/pixel_grid.py assets/gen/edificios/flux768/tienda_s2_0.png $L/tienda_1a1.png --largest --bg-tol 30 --shadow 128,52,84 --shadow-tol 40 --colors 20 --despeckle 0 --preview $L/tienda_1a1_x6.png
# 3) limpieza automatica: suavizado de relleno, islas, dobles; la casa ademas se espeja (mitad izquierda)
python -I tools/pixel_clean.py $L/casa_1a1.png   $L/casa_auto.png   --smooth 2 --mirror left --crop tejado:0,0,54,60 --crop puerta:30,70,80,117
python -I tools/pixel_clean.py $L/tienda_1a1.png $L/tienda_auto.png --smooth 2 --crop toldo:0,0,50,32 --crop mostrador:0,30,50,70
# 4) a texto editable (fuente de los retoques)
python -I tools/png_to_txt.py $L/casa_auto.png   $SRC/casa_raw.txt
python -I tools/png_to_txt.py $L/tienda_auto.png $SRC/tienda_raw.txt
# 5) retoques a mano documentados en cada guion
python -I $SRC/retoques_casa.py
python -I $SRC/retoques_tienda.py
# 6) construir y entregar
python -I tools/pixel_build.py $SRC/casa.txt $SRC/tienda.txt --out assets/game/pixel/edificios --preview 6 --sheet $L/hoja_x6.png
mv assets/game/pixel/edificios/casa_x6.png assets/game/pixel/edificios/tienda_x6.png $L/ 2>/dev/null || true
python -I tools/pixel_clean.py assets/game/pixel/edificios/casa.png   --check --runs
python -I tools/pixel_clean.py assets/game/pixel/edificios/tienda.png --check --runs
python -I tools/preview_edificios.py --out $L/preview_limpio.png --zoom 4
python -I tools/pixel_detalle.py $L/detalle_x12.png \
  "casa v2: faldon izq.=assets/game/pixel/edificios/v2_flux/casa.png:0,22,44,66" "casa v3: faldon izq.=assets/game/pixel/edificios/casa.png:0,0,44,44" \
  "casa v2: puerta=assets/game/pixel/edificios/v2_flux/casa.png:38,84,82,131" "casa v3: puerta=assets/game/pixel/edificios/casa.png:34,74,78,114" \
  "tienda v2: toldo=assets/game/pixel/edificios/v2_flux/tienda.png:0,0,44,40" "tienda v3: toldo=assets/game/pixel/edificios/tienda.png:0,0,44,40" \
  --zoom 12 --cols 2
