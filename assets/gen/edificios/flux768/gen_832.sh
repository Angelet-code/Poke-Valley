#!/bin/sh
# Cola extra 2: seed 2 a 832 y 896 (mas celdas de edificio con el mismo paso de 4 px). Espera a las azules.
cd "/a/PROYECTOS/Pokemon Valley"
D=assets/gen/edificios/flux768
while [ ! -f $D/FIN_AZUL.txt ]; do sleep 10; done
for r in 832 896; do
  python -I tools/comfy.py "$(cat $D/prompt_casa.txt)" --out $D/casa${r}_s2 --model flux --lora Top-Down_Pixel_Art_Flux_Lora_r1.safetensors:0.8 --w $r --h $r --seed 2 --steps 20 > $D/log_casa${r}_s2.txt 2>&1
done
echo FIN > $D/FIN_832.txt
