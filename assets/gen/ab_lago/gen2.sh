#!/bin/bash
# Prueba A/B, ronda 2 (2026-10-15): dos estilos más para el Lago Celeste.
# C) "arcane": pintura digital con pinceladas visibles y línea de tinta (como la serie Arcane).
# D) "acuarela": acuarela y gouache suave, estilo película de animación japonesa acogedora.
# Piezas: Klein 4B txt2img sobre verde liso (para recortar con lab/tools/recortar.py), 3 semillas.
# Escena: Klein --edit de la captura del juego (capturas/A_dibujo.jpg) repintada entera en cada estilo (maqueta de ambiente).
cd "/a/PROYECTOS/Pokemon Valley"; B=assets/gen/ab_lago
declare -A EST
EST[arcane]="game asset in the painterly style of the Arcane animated series: hand-painted digital painting, visible textured brushstrokes, confident dark ink linework, rich muted colors with warm highlights and cool shadows, slightly gritty painted texture, 3/4 top-down view, centered alone on a flat plain green background, no cast shadow on the background:"
EST[acuarela]="game asset in a soft watercolor and gouache style like a cozy Japanese animated film background: gentle painted edges, soft light pencil lines, warm sunny palette, delicate color washes, 3/4 top-down view, centered alone on a flat plain green background, no cast shadow on the background:"
declare -A SUJ
SUJ[sauce]="a single weeping willow tree with long drooping curtains of pale green leaves hanging down to the ground and a short brown trunk"
SUJ[juncos]="a small clump of tall cattail reeds: thin upright green blades and a few brown cattail heads"
SUJ[muelle]="a small wooden pier seen straight-on from the front: a short rectangular deck of light brown planks on wooden posts, one mooring post with a rope coil"
declare -A ESC
ESC[arcane]="repaint this entire top-down game screenshot in the painterly style of the Arcane animated series: hand-painted digital painting, visible textured brushstrokes, confident dark ink linework, rich muted colors, warm highlights and cool shadows. Keep exactly the same layout, the same lake, pier, willow, reeds, rocks, trees, path and the small creatures in the same places"
ESC[acuarela]="repaint this entire top-down game screenshot as a soft watercolor and gouache painting like a cozy Japanese animated film background: gentle painted edges, soft light pencil lines, warm sunny palette, delicate color washes. Keep exactly the same layout, the same lake, pier, willow, reeds, rocks, trees, path and the small creatures in the same places"
for e in arcane acuarela; do
  for s in 1 2; do [ -f $B/escena/${e}_s${s}_0.png ] || python -I tools/comfy.py "${ESC[$e]}" --model klein --edit $B/capturas/A_dibujo.jpg --out $B/escena/${e}_s$s --seed $s --w 1344 --h 768 > $B/escena/log_${e}_s$s.txt 2>&1; done
  for k in sauce juncos muelle; do for s in 1 2 3; do
    [ -f $B/$e/${k}_s${s}_0.png ] || python -I tools/comfy.py "${EST[$e]} ${SUJ[$k]}" --model klein --out $B/$e/${k}_s$s --seed $s --w 1024 --h 1024 > $B/$e/log_${k}_s$s.txt 2>&1
  done; done
done
# La escena en estilo dibujo y en pixel art, con el mismo método, para comparar las cuatro igual.
[ -f $B/escena/pixel_s1_0.png ] || python -I tools/comfy.py "repaint this entire top-down game screenshot as 16-bit SNES pixel art like Stardew Valley, big chunky pixels, limited palette, clean dark outlines. Keep exactly the same layout, the same lake, pier, willow, reeds, rocks, trees, path and the small creatures in the same places" --model klein --lora pixel-art-lora-klein4b.safetensors:1.0 --edit $B/capturas/A_dibujo.jpg --out $B/escena/pixel_s1 --seed 1 --w 1344 --h 768 > $B/escena/log_pixel_s1.txt 2>&1
echo FIN > $B/FIN2.txt
