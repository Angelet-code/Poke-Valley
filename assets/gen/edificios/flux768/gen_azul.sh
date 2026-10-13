#!/bin/sh
# Cola extra: casa con fondo azul claro (el magenta tiñe de rosa la madera y el tejado rojo). Espera al lote principal.
cd "/a/PROYECTOS/Pokemon Valley"
D=assets/gen/edificios/flux768
while [ ! -f $D/FIN.txt ]; do sleep 10; done
for s in 2 7 8; do
  python -I tools/comfy.py "$(cat $D/prompt_casa_azul.txt)" --out $D/casaazul_s$s --model flux --lora Top-Down_Pixel_Art_Flux_Lora_r1.safetensors:0.8 --w 768 --h 768 --seed $s --steps 20 > $D/log_casaazul_s$s.txt 2>&1
done
echo FIN > $D/FIN_AZUL.txt
