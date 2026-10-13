#!/bin/sh
# Lote VERSION 3: Flux + LoRA pixel art a 768x768 (paso de rejilla nativo 4 px -> ~115 celdas de edificio)
cd "/a/PROYECTOS/Pokemon Valley"
D=assets/gen/edificios/flux768
for s in 1 2 3 4 5 6; do
  python -I tools/comfy.py "$(cat $D/prompt_casa.txt)" --out $D/casa_s$s --model flux --lora Top-Down_Pixel_Art_Flux_Lora_r1.safetensors:0.8 --w 768 --h 768 --seed $s --steps 20 > $D/log_casa_s$s.txt 2>&1
done
for s in 1 2 3 4 5 6; do
  python -I tools/comfy.py "$(cat $D/prompt_tienda.txt)" --out $D/tienda_s$s --model flux --lora Top-Down_Pixel_Art_Flux_Lora_r1.safetensors:0.8 --w 768 --h 768 --seed $s --steps 20 > $D/log_tienda_s$s.txt 2>&1
done
echo FIN > $D/FIN.txt
