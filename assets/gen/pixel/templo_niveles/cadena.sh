#!/bin/sh
# Genera los niveles indicados en cadena; cada uno parte de la semilla que elige elegir.py (la que conserva más
# cerezo; provisional: si se prefiere otra semilla, copiarla a klein/nNN.png y relanzar desde el nivel siguiente). Uso: sh cadena.sh 04 05 06 ...
B="/a/PROYECTOS/Pokemon Valley/assets/gen/pixel/templo_niveles"
for n in "$@"; do sh "$B/gen.sh" $n; (cd "/a/PROYECTOS/Pokemon Valley" && python -I "$B/elegir.py" $n) || exit 1; echo "nivel $n ok"; done
