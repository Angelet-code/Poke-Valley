# Arte de Pokémon Valley: proceso y estado

Última actualización: 2026-10-13 (V7 de los edificios; nido y comedero del pueblo).

## 1. Idea general

- **Única referencia visual:** `assets/gen/prueba1_1.png` (1024×1024, mapa generado con SDXL que
  al usuario le encanta). Todo se compara con ella. Las demás referencias de `docs/art/ref/` y las
  maquetas antiguas (`maqueta.html`, `maqueta-ia.html`, etc.) están superadas.
- **Escala:** referencia 1024 px = mundo de 576 px (24×24 casillas de 24 px). Factor 0.5625.
- **Pokémon:** sprites de PMD de SpriteCollab (`assets/sprites/pokemon/<dex>/`), con `AnimData.xml`.
  Biblioteca completa descargada (2026-10-13): 981 especies, forma normal, todas las `*-Anim.png` +
  `credits.txt` (sin Offsets/Shadow, formas ni shiny), ~220 MB, fuera de git salvo las especies que usa
  el juego (`.gitignore`). Índice `assets/sprites/pokemon/indice.json` (dex → {anim: [ancho, alto]});
  catálogo animado: `docs/art/pokedex-pmd.html`. Licencia CC BY-NC 4.0 (`LICENSE.md` en esa carpeta).
- **El suelo no se pixela.** Se dibuja a resolución de pantalla (zoom entero S, 3 en la pantalla
  del usuario) para que los bordes queden nítidos.
- **Maqueta de trabajo:** `docs/art/maqueta-tiles.html` (Phaser 3, un solo archivo). Ahí se
  prueba todo antes de pasar al juego de verdad.

## 2. Gustos del usuario (aprendidos a base de rechazos)

- **Limpio y simple, no detallado.** "Una cosa es que estén limpios y otra que tengan mucho
  detalle". Si algo sale recargado, simplificar (menos trazos, colores más planos).
- **Integrado y sutil.** Flores y matorrales dan ambiente, no deben destacar.
- **Bordes definidos pero no negros.** Contornos gris/verde oscuro, nítidos, con antialias.
- **Sin defectos de JPG.** No usar recortes de la referencia tal cual en objetos pequeños.
- **Cuidado extremo con los bordes y los casos raros.** Los fallos visuales (agua que asoma,
  rendijas, cortes rectos) se notan mucho: probar con formas difíciles (mapa `lagos_prueba`).
- **Variación aleatoria** en escala, posición y tamaño, pero estable (semilla por posición).
- **Poder pintarlo todo** en la maqueta con el ratón.

## 3. Receta para crear un objeto nuevo (lo que funciona)

1. **Recorte de la referencia** del objeto (o de varios ejemplos), con algo de margen. Si hay un
   vecino pegado, taparlo con el color del suelo en el recorte.
2. **Repintado con SDXL** (`tools/comfy.py`):
   - img2img sobre el recorte ampliado a ~1024: `--init recorte.png --denoise .45-.5`. Mantiene
     la forma y limpia la pintura.
   - Si se quiere simplificar: reducir el recorte mucho (÷8-10), volver a ampliar y desenfocar,
     y entonces img2img a .45 (así se hicieron los árboles y la pared de los lagos).
   - Para objetos nuevos en el estilo: txt2img + IP-Adapter `--ref recorte.png --ref-weight .6`
     sobre fondo liso de un color que contraste (para recortar luego fácil).
   - Prompt base: `2d game asset, top-down 3/4 view, smooth bold dark outline, simple flat cel
     shading, clean painted cozy game art`. Negativo: `blurry, photo, realistic, text, watermark,
     noise, speckles, texture, ...`. Probar 2-3 semillas y elegir.
   - **Pixel art (edificios, objetos a escala nativa):** `--model flux --lora
     Top-Down_Pixel_Art_Flux_Lora_r1.safetensors:0.8 --steps 20`, prompt `top-down pixel art of
     <objeto>, 3/4 top-down RPG view like Stardew Valley, 16-bit SNES pixel art, big chunky pixels,
     limited palette, flat shading, dark outline, isolated and centered on a solid flat magenta
     background, no cast shadow, no text` (~3,5 min/imagen; 4-6 semillas, suele haber 1-2 buenas de
     frente). Luego `tools/pixel_grid.py --largest [--shadow <color sombra>] --bg-tol 30 --colors 20`
     **sin `--w`**: detecta la rejilla real (4 px a cualquier resolución) y toma un color por celda;
     el tamaño se controla con la resolución de generación (768² ≈ 105-120 celdas de edificio).
     Después `pixel_clean.py` (limpieza automática ligera: `--islands 2 --jaggy all --smooth 1`, sin
     `--mirror/--rows/--thin`) → `png_to_txt.py` → retoques a mano **solo locales** con `pixel_txt.py`
     (ver `assets/gen/pixel/src/edificios/retoques_v4.py`, para texturas y bandas `retoques_v5.py` y para tejas verticales, mampostería y mercancía a píxel `retoques_v6.py`, y para cambios quirúrgicos por zonas con comprobación de que fuera de ellas nada cambia `retoques_v7.py`; el dibujo de la IA no se rediseña salvo que el usuario pida redibujar una zona ilegible, como el cuerpo de la tienda en la V6) →
     `pixel_build.py`, y comprobar con `pixel_clean.py --check --runs` (0 huérfanos, 0 dobles, tramos regulares).
3. **Recorte del fondo:** BiRefNet (`tools/cutout.py`, `mask_for()`) o, si el fondo es liso,
   separación por color (proyección fondo→objeto: alfa + color sin fondo, ver `cut_flowers.py`).
4. **Limpieza de silueta:** `tools/clean_tree.py ... --line 999 --erase 999 --outline 0
   --fill-blur 0.3 --shrink 1 --h <alto>` (solo silueta limpia, sin tocar la pintura).
5. **Generar grande y reducir mucho** (LANCZOS): es lo que deja la pintura nítida.
6. **Contorno nítido** si el de SDXL queda blando: `tools/rock_outline.py --w 4.5 --bottom 1.6 --dark .5`.
7. **En la maqueta:** textura reducida a su tamaño exacto en pantalla con `screenTex(name, alto_px)`
   (reduce a mitades; sin esto WebGL dienta los trazos), `setScale(1/S)`, profundidad = y, sombra
   elipse 0x2c4422, colisión con un círculo en `this.trees`. No ponerlo en agua (`nearWater`) ni
   en el camino de losas (`PFIELD`).
8. **Verificar en el navegador** y con el mapa de pruebas; enseñar al usuario con enlaces.

### 3b. Reglas de pixel art (se exigen en todo sprite a escala nativa)

1. **Líneas de 1 px.** Sin "dobles" (el píxel de más en forma de L en un escalón) y sin píxeles
   huérfanos (sin ningún vecino de su color). `tools/pixel_clean.py --check` los cuenta y da coordenadas.
2. **Diagonales con escalones regulares:** 45° = 1:1, ~26,5° = 2:1, ~18° = 3:1; nunca mezclar
   tramos 1-2-1-3 en la misma línea; en las curvas la longitud de los tramos cambia de forma monótona.
3. **Simetría izquierda/derecha** en edificios, salvo que un elemento (chimenea) la rompa a
   propósito: se construye la mitad izquierda y se espeja (`--mirror left --keep` para la chimenea).
4. **Tejas y tablones estrictamente periódicos**, alineados a la rejilla, 2-3 tonos + una junta
   más oscura, sin ruido (`--rows y0,y1,periodo`).
5. **3-4 tonos por material** con ligero cambio de tono (sombras más frías/moradas, luces más
   cálidas); contornos de color oscuro tintado (nunca negro puro, luminancia ≥ 28); contorno
   selectivo (más claro donde da la luz).
6. **Luz desde arriba a la izquierda** y una sola proyección 3/4 top-down: pared frontal vertical,
   tejado visto desde arriba-delante, sin sesgo isométrico.
7. **Escala:** casilla 24 px, puerta ≈ 26-30 px de alto (Bulbasaur ≈ 24 px), edificio ≈ 5 casillas
   de ancho (120 px ± 8), huella 5×3 casillas; nada (cajas, etc.) sobresale de la huella por abajo.
   Excepción aceptada (V4): si el dibujo elegido sale a 150-155 celdas a su paso real, se conserva ese tamaño
   (huella 6×3, colisión 144×72) antes que re-renderizarlo.
8. **Muestreo 1:1.** De una imagen IA se toma exactamente un color por celda real de su rejilla
   (paso entero, fase correcta, `pixel_grid.py` sin `--w`); nunca se re-renderiza a un paso no
   entero (eso dobla los píxeles de todas las diagonales). Para que el edificio salga a ~120 celdas
   se ajusta la resolución de generación (768² con paso 4 px ≈ 110-120 celdas), no la reducción.
9. **Texturas: periódicas con jitter sembrado, nunca ruido.** Tejas, piedras, franjas y festones se
   dibujan con un patrón regular (periodo entero, alineado a la rejilla) y la "vida" se añade con una semilla
   fija: ~1 de cada 6 tejas un tono más claro/oscuro, alguna junta corrida 1 px, bloques de piedra de anchos
   distintos; nunca variando píxel a píxel. Las bandas de un alero o toldo se trazan paralelas a un perfil de
   tramos fijos (`Mapa.perfil_tramos` + `Mapa.bandas`, `tejas`, `festones`, `abanico` en `tools/pixel_txt.py`;
   ejemplo completo en `assets/gen/pixel/src/edificios/retoques_v5.py`).
10. **Tejas: hiladas paralelas a la cumbrera, bajando hacia los aleros.** En un hastial con la cumbrera de delante a
   atrás (columna vertical en la imagen) los faldones bajan a izquierda y derecha: las hiladas son columnas verticales
   escalonadas hacia los aleros laterales (media teja de desfase cada dos), la junta continua va en el lado del alero de
   cada teja y la luz en la fila superior y el lado de la cumbrera (`Mapa.tejas_v`); hiladas horizontales solo si el
   faldón mira al espectador. Piedra irregular (chimeneas): bloques trabados de anchos distintos con esquinas
   redondeadas, luz arriba-izquierda y mortero de 1 px (`Mapa.piedras`); nunca una rejilla de ladrillos iguales.

Lo que **no** funcionó (no repetir): rediseñar/simplificar al limpiar (V3 de los edificios): el usuario quiere el dibujo de la IA intacto, solo bordes limpios; desplazar por columnas la banda del alero para forzar un 2:1 exacto (cada columna tiene otro grosor y queda deshilachada: se corrigen solo los pellizcos locales); re-renderizar la salida de la IA a un paso no entero (`pixel_grid.py --w 120` sobre 150 celdas: dobles en todas las diagonales, V2 de los edificios); `pixel_clean.py --thin` sobre entradas ruidosas (se come marcos de ventana); edificios dibujados con primitivas de código (`draw_edificios.py`, rechazados: "feísimos"); SDXL base sin LoRA para pixel art (sin rejilla de píxel); SDXL para separar matas en grupos (hace manchas sueltas o
lo llena todo); limpiar recortes JPG pequeños con img2img (o queda blando o cambia el diseño);
trazos interiores nítidos en árboles (demasiado detalle); altura de pared variable por columna
(deja rendijas de agua).

### 3c. Kit de edificios (piezas + compositor), para no retocar cada sprite a mano

Ver `docs/art/KIT.md` (receta completa). Resumen: las piezas (puerta, ventanas, chimenea, portón,
mercancía, muestras de muro, mostrador…) se sacan UNA vez del arte limpio de la V6 o se dibujan a píxel
(`assets/gen/pixel/src/kit/hacer_kit.py` → `*.txt` → `pixel_build.py` → `assets/game/pixel/kit/` +
`kit.json`), y cada edificio se describe en un plano JSON pequeño que `tools/edificio.py` monta en
0,2-0,5 s aplicando las reglas de §3b: tejado a dos aguas con la cumbrera vertical, alero y borde trasero
con tramos regulares a la pendiente del plano (`[5,3]`, `[2,1]`…), bandas del alero paralelas, hiladas de
tejas paralelas a la cumbrera y **juntas transversales escalonadas con la misma pendiente que el alero**
(la perspectiva del faldón; nunca horizontales), faldón izquierdo claro / derecho en sombra con jitter
sembrado, franja clara y cumbrera con jitter, **hastial = muro**, zócalo y postes de esquina; también
`un_agua` (hiladas horizontales, cobertizos) y `toldo` (el de la tienda V5/V6 para cualquier anchura).
Remate final de costuras y comprobación `pixel_clean --check --runs` (0 / 0). Prueba (2026-10-13):
`assets/gen/edificios/kit/` (casa 6×3, tienda, granero 8×4 nuevo, taller un agua nuevo; `preview_kit.png`,
`detalle_x12.png`, `hacer.py` lo reproduce todo). Pendiente de visto bueno; no sustituye aún a los PNG
de `assets/game/pixel/edificios/`.

### 3d. Bake-off de modelos de pixel art (2026-10-13, `assets/gen/bakeoff/`)

3 sujetos (casa, tienda, banco) × 2 semillas por modelo; hojas `hoja_<sujeto>.png`, tabla en `RESUMEN.md`.
- **Flux.1-dev + `Top-Down_Pixel_Art_Flux_Lora_r1` 0.8, 768²**: paso 4 px, sprite aislado en magenta 6/6, estilo
  Stardew de frente (1 de cada 2-3 semillas sale isométrica: repetir semilla). ~90 s/imagen. **Es el método.**
- SDXL + `pixel-art-xl` 1.0 (25 pasos, cfg 5): paso 8 px perfecto, pero ignora el fondo magenta (gris, lila, tablones),
  casas de 2 plantas oscuras. ~20 s. Reserva para objetos pequeños pidiendo fondo gris.
- SDXL + `PixelArtRedmond-Lite64`: paso 16 px (64 celdas), escenas enteras borrosas. Descartado.
- Ningún modelo da líneas de 1 px con tramos regulares: `pixel_clean.py` + retoques siguen haciendo falta
  (dobles antes de limpiar: 17-200 por sprite).
- **Extractor de rejilla**: `pixel-art-fixer` (`tools/pixel_fixer.py`, envoltorio; el CLI del repo está roto) acierta el
  paso cuando `pixel_grid.py` coge el armónico (2/18 casos), pero no detecta fase, colorea por media y no tiene
  `--shadow` ni aclarado de negros. Pipeline: `pixel_fixer.py in.png fx.png --largest --colors 24 --despeckle 1`
  para leer el paso → `pixel_grid.py in.png px.png --largest --pitch N --bg-tol 30 --colors 24 [--shadow R,G,B]` → `pixel_clean.py`.

### 3e. Bake-off 2 y 3: modelos especializados (2026-10-13, `assets/gen/bakeoff2/`, `assets/gen/bakeoff3/`)

Investigación en `docs/art/ref/pixel-art-referencias.md` (no hay checkpoint abierto a píxel nativo; PixelLab/Retro
Diffusion son cerrados). Instalados y probados (rutas y recetas en `tools/comfy.py` y en la memoria `reference-comfyui-models`):
- **HaDeS Pixel Art v6 (Illustrious)** `--ckpt illustriousPixelart_v6SeriesV60.safetensors --clip-skip 2 --steps 30
  --cfg 5 --sampler euler_ancestral --scheduler normal`, etiquetas booru + "magenta background", neg con
  "isometric, sticker, white outline, white border, frame". **Ganador en rejilla**: paso 8 exacto a 768-1024², 1-6
  huérfanos, estilo Stardew de frente (`hades casa_s2`, `tienda_s1/s2`). Fallos: a veces contorno blanco "pegatina",
  marco con sujeto diminuto (Poké Ball, troncos), y fondo lila que `pixel_grid` no recorta (subir `--bg-tol` a 60).
- **Nova Pixels XL v3**: tiende a isométrico, bordes blancos, 20-50 huérfanos. Descartado.
- **LoRA `PixelArt_Icon_IL_v1`** (trigger `pixelarticon`, 0.9, 10 pasos, cfg 6, 512²): paso 16 → iconos 20-32 px
  limpios (Poké Ball 20×24 con 1 huérfano). Para objetos pequeños.
- **Flux.2 Klein 4B** (`--model klein`, 4 pasos) + `pixel-art-lora-klein4b`: **mejor dibujante** (casa de ronda 2 a
  1024² = diseño nivel PixelLab, de frente, 120×130 px tras fixer) pero paso no entero (5-6,5 px) → rejilla sucia.
  "transparent background" pinta tablero de ajedrez: pedir siempre magenta liso.
- **pixel-party-xl** (`--unet pixel-party-xl_unet.safetensors`, "… in pixel art style", neg "mixels. amateur.
  multiple", 25 pasos): como txt2img flojo; como repintador img2img (`--init --denoise 0.4-0.55`) limpia la rejilla
  de Klein (cadena `assets/gen/bakeoff2/cadena/`, casas 80×88, 0 huérfanos) pero tiñe el fondo de dos magentas
  (recortar 16 px de marco y `--bg 201,14,167 --bg-tol 80 --bg2 246,17,241 --bg2-tol 70`).
- **Cadena validada (`assets/gen/bakeoff3/cadena_hades/`, `gen.sh`, `gen_big.sh`, `procesar.py`)**: Klein+LoRA dibuja
  a 1024² → `pixel_fixer.py --largest` saca el sprite (~120 celdas) → se reescala a 150 celdas de ancho y se centra en
  un lienzo de 160 celdas del mismo magenta, ×8 NN (1280²) → HaDeS img2img `--init --denoise 0.4` (30 pasos, cfg 5,
  euler_ancestral/normal, clip skip 2) → `pixel_grid --pitch 8 --largest --bg-tol 60 --colors 24` → `pixel_clean`.
  Resultado: casas de 150×156 px (6,25 casillas), de frente, 0 huérfanos tras limpiar (`clean_big_casa_s*.png`,
  `hoja_big_clean.png`). Partir del PNG crudo de Klein (sin fixer) encaja peor el paso: 17-24 huérfanos.
- Geometría: `tools/pixel_geom.py` (Hough) sustituye círculos "a ojo" por el anillo clásico de 1 px; solo en objetos
  pequeños (en sprites complejos inventa círculos). Aplicar antes de `pixel_clean.py`.
- VRAM: con navegadores abiertos quedan ~4 GB de 8 → ComfyUI hace offload (3-5× más lento, misma calidad).

## 4. Estado de cada elemento

| Elemento | Archivos de juego | Cómo se hizo | Estado |
|---|---|---|---|
| Césped / tierra | `assets/game/cesped_ref.png`, `tierra_ref.png` | `tools/quilt.py --kind grass/sand --scale .5625` (image quilting de la referencia, colores intactos) + manchas lentas de tono en la maqueta | Hecho |
| Camino de losas | (procedural) | Mosaico en la maqueta (`MOS_*`, `mosaic()`), sobre tierra | Hecho |
| Árboles | `assets/game/arboles/arbol_0..3.png` | Recorte → simplificar → img2img .45 (seed 21) → `recolor_hue --target 110 --amount .35` → `clean_tree` (solo silueta, h 360). Fuentes `assets/gen/arboles/simple_*` | Hecho (versión simple aceptada) |
| Rocas grises | `assets/game/rocas/roca_0..3.png` | Recorte → img2img .5 (seed 9) → `clean_tree` (h 160) → `rock_outline`. Escala aleatoria 0.5-1 en pasos de 0.1 (`ROCK_H` = 32 px a escala 1) | Hecho. Anteriores en `assets/gen/rocas/v_borde_blando/`, la alta descartada en `descartadas/` |
| Flores amarillas | `assets/game/flores_nuevas/flor_0..32.png` | txt2img + IP-Adapter (`--ref assets/gen/flores_ref.png --ref-weight .6`, zona 500,380-720,480 de la referencia; fuentes `assets/gen/flores_gen_0/1.png`) → `cut_flowers.py --min 1500 --group 6 --scale .5 --px .5` | Hecho. Originales (JPG) en `assets/gen/descartadas/flores_originales/` |
| Matorrales | (procedural, `BUSH` en la maqueta) | Grupos de 2-3 hojas redondas con sombra abajo, posición y tamaño al azar por mata, capa entera al 50 % | Hecho. Intentos con IA en `assets/gen/matorrales/`; `tools/make_bushes.py` y `assets/game/matorrales/` ya no se usan |
| Lagos | `assets/game/lagos/pared.png` | Terreno 3 en el mapa. Agua de color medido + manchas; pared = tira de la referencia enderezada (`cliff_strip.py init`), repintada simple (`simple_s21_0.png`) y aplanada (`cliff_strip.py strip --y0 226 --y1 428 --h 202 --fade 140 --flat .15 --crack 26`); orilla con línea oscura y filo claro | Hecho. Versiones anteriores `assets/gen/lagos/pared_v1.png`, `pared_v2.png` |
| Bayas (cultivo): semilla, brote, alta, flor, bayas (2 fotogramas por fase) + iconos | `assets/sprites/bayas/fases/*.png`, `iconos/*.png`, `bayas.json` | Sprites de **Pokémon Esmeralda** (`pret/pokeemerald`, originales en `assets/sprites/bayas/orig/`) con sus paletas reales del juego: `tools/bayas_colorear.py`. 16×16 (tierra/brote) y 16×32 (árbol), escala nativa. Tierra regada = `tierra_ref` oscurecida (rgba(48,26,10,.42)). Prueba: `docs/art/bayas.html` | Hecho (2026-10-13), pendiente de visto bueno |
| Tronco (recolectable) | `assets/game/pixel/items/tronco.png` (26×21) | **2026-10-13:** sale de Klein (`assets/gen/bakeoff2/klein/troncos_s2_0.png`, pila de 3 troncos): fondo magenta recortado, reducción BOX premultiplicada a 26 px de ancho, alfa umbral 110, 14 colores (`assets/gen/pixel/tronco_klein/reducir.py`, candidatos en esa carpeta). Ancla [13, 19]. El de pixel a mano (rechazado) está en `items/v1_tronco/` y su fuente en `src/items/v1_tronco/` | Hecho, pendiente de visto bueno |
| Recolectables (palo ×2, piedra ×2) | `assets/game/pixel/items/*.png` + `assets/game/pixel/items.json` | **Pixel art a mano** a escala nativa (1 px = 1 px de mundo, como los sprites PMD): fuentes de texto editables en `assets/gen/pixel/src/items/*.txt` → `tools/pixel_build.py` | Hecho (2026-10-13), pendiente de visto bueno |
| Poké Balls (Poké, Super, Ultra, Master, Honor): bola del suelo + icono de mochila | `assets/game/pixel/items/<id>.png` (suelo, 10×10), `items/iconos/<id>.png` (mochila, 18×18) + `items.json` (`icono`) | **Sprites de Pokémon Esmeralda** (`pret/pokeemerald`, originales en `assets/sprites/pokeballs/orig/`): suelo = `graphics/object_events/pics/misc/item_ball.png` con `npc_3.pal` (la bola que hay en el suelo en el juego; solo existe la roja, las otras cuatro son recolores de la mitad superior con colores de las paletas de los iconos: Super azul + marcas rojas, Ultra gris + franjas amarillas, Master morada + puntos rosas, Honor blanca + línea roja); mochila = `graphics/items/icons/*_ball.png` con `graphics/items/icon_palettes/*.pal` (Honor = `premier_ball.png` + `luxury_ball.pal`, como en `item_icon_table.h`). Guion: `tools/pokeballs_colorear.py`. En el juego el icono de inventario es `icono_<id>` (campo `icono` de `items.json`, cargado en `Preload`) y el del suelo `obj_<id>`. Hoja comparativa (mano V1 \| suelo \| mochila): `docs/art/pokeballs_hoja.png`; captura en el juego: `docs/art/pokeballs_juego.png` | Hecho (2026-10-13), pendiente de visto bueno. V1 pixel art a mano (14×14) en `assets/game/pixel/items/v1_mano/` (fuentes `assets/gen/pixel/src/items/*ball.txt`) |
| Mesa de trabajo | `assets/game/pixel/estaciones/mesa_trabajo.png` (48×36) | Igual, fuente `assets/gen/pixel/src/estaciones/mesa_trabajo.txt` | Hecho, pendiente de visto bueno |
| Nido y Comedero (edificios del pueblo, 0.2b) | `assets/game/pixel/estaciones/nido.png` (34×30, ancla [17, 28], se pisa) y `comedero.png` (32×23, ancla [16, 22], colisión 30×8) en `items.json` | **2026-10-13**, receta del tronco: Flux.2 Klein 4B + `pixel-art-lora-klein4b` 1.0 a 512² sobre magenta, 6 semillas por objeto (`assets/gen/pixel/edificios_pueblo/gen.sh`, `sujetos.txt`, salidas en `klein/`); elegidos los de frente (nido s2 = ramitas y paja con cojín de hoja; comedero s1 = cajón con bayas rojas y hojas). `reducir.py`: magenta fuera, BOX premultiplicado a 34 / 32 px de ancho, alfa umbral 110, 16 colores y **poda** de píxeles sueltos del borde (≤ 2 vecinos). `pixel_clean.py --islands 2 --jaggy all --smooth 1` se probó y se descartó: borra las ramitas y empasta las bayas. Hoja de candidatos (3 semillas × 3 anchos): `edificios_pueblo/hoja.png` | Hecho, pendiente de visto bueno. Rechazadas por isométricas: comedero s3, s5, s6 |
| Comedero V2 (2026-10-14) | `assets/game/pixel/estaciones/comedero.png` (38×21, ancla [19, 20], colisión 36×8) en `items.json` | El cajón de la V1 no gustó: se descarta y se borra a petición del usuario (queda una copia en `estaciones/v1_comedero/` hasta que el usuario la borre). Receta del nido (Klein 4B + `pixel-art-lora-klein4b` 1.0, 512², magenta, de frente), 3 ideas × 5 semillas (`edificios_pueblo/gen_comedero2.sh`, `sujetos_comedero2.txt`, salidas en `klein3/`). `hoja_comedero2.py` (modo icono: contorno tintado ×0,62, 38 px, 16 colores) → hoja `hoja_comedero2.png`, candidatos en `candidatos3/`. Elegido **cm_tronco s1**: tronco vaciado alargado, de frente, lleno de bayas de colores (`hoja_comedero2.py cm_tronco 1 38`). Alternativa: cm_mesa s1 (banco con 3 cuencos) | Pendiente de visto bueno |
| Caja de envío de Pelipper (0.2d) | `assets/game/pixel/estaciones/caja_pelipper.png` (28×27, ancla [14, 26], colisión 26×8) en `items.json`; el juego la pone pegada a la mesa (`WorldScene.colocarCaja`) | **2026-10-13**, misma receta que el nido (`edificios_pueblo/gen_caja.sh`, línea `caja` de `sujetos.txt`). Semillas 1-6 salieron con la esquina hacia la cámara (isométricas, rechazadas); las 7-12 con `FRENTE=1` (añade "straight-on symmetrical front view… not isometric") salen de frente. Elegida la s8 (baúl con tapa, cuerda azul y cierre) reducida a 28 px con `reducir.py caja 8 28` (poda de bordes, sin `pixel_clean`). Hoja de candidatos: `edificios_pueblo/hoja_caja.png` | Hecho, pendiente de visto bueno |
| 5 edificios del pueblo (almacén, taller, nido grande, cobertizo, santuario) | `assets/gen/pixel/edificios_pueblo/final/{almacen,taller,nidogrande,cobertizo,santuario}.png` (140×145, 130×135, 84×78, 92×88, 112×152). **En el juego (2026-10-14):** el taller es la **casa** (`edificios/casa.png`, la V7 guardada en `edificios/v7_casa/`); almacén, nido grande, cobertizo y santuario en `edificios/*.png` + `edificios.json`, construibles con B (`src/data/edificios.ts`) | **2026-10-14**, receta del nido/caja pero a **1024²**: Klein 4B + `pixel-art-lora-klein4b` 1.0, magenta liso, prompt de frente "not isometric, no corner facing the camera" (`gen_edificios.sh`, `sujetos_edificios.txt`, 4 semillas). `hoja_edificios.py` reduce con `reducir.py` (BOX premultiplicado, 24 colores, poda) con una máscara de fondo nueva: Klein a 1024² pinta **sombras moradas** y motas sueltas, así que el fondo es todo tono magenta con G < 120 (no come las flores rosas) y se queda solo la mancha mayor. Elegidos: almacén s4, taller s4, nido grande s3, cobertizo s3, santuario s3 (hoja `hoja_edificios_elegidos.png`; todas las semillas en `hoja_edificios.png`). Pega: el cartel del taller lleva letras sin sentido | Visto bueno del usuario (2026-10-14) |
| Horno, guardería, ladrillo y plato (2026-10-14) | `assets/game/pixel/edificios/horno.png` (86×85, ancla [43, 84], colisión 78×28) y `guarderia.png` (96×113, ancla [48, 112], colisión 88×36) en `edificios.json`; `assets/game/pixel/items/ladrillo.png` (21×12, ancla [10, 11]) y `plato.png` (20×19, ancla [10, 18]) en `items.json` | **2026-10-14**, receta de los 5 edificios del pueblo: Klein 4B + `pixel-art-lora-klein4b` 1.0, magenta liso, prompt de frente "not isometric, no corner facing the camera" (`edificios_pueblo/gen_edificios2.sh`, copia de `gen_edificios.sh`; sujetos en `sujetos_edificios2.txt` a 1024² y `sujetos_iconos2.txt` a 512², 6 semillas; salidas en `klein2/`). El ladrillo s1-6 salió con 2 ladrillos en rombo (isométrico): s7-12 con `SOLO=ladrillo2` (`sujetos_ladrillo2.txt`, "two bricks side by side and one on top, long faces facing the viewer"). `hoja_edificios2.py` (copia de `hoja_edificios.py`, importa `reducir.py`): máscara de sombras moradas; en los iconos sin apertura y con huecos rellenos (el guiso morado tiene tono magenta) y un contorno tintado (borde ×0,62, no negro) porque a ~20 px el contorno de Klein se pierde en el BOX. Anchos/colores: horno 86/24, guardería 96/24, ladrillo 21/14, plato 20/16. Elegidos: horno s3 (cúpula de piedra gris, boca con fuego, chimenea corta, ladrillos al lado), guardería s4 (casita de troncos con tejado rojo, corralito con cojines y pelota), ladrillo s7 (3 ladrillos), plato s1 (cuenco con bayas rojas y azules). Hoja de candidatos `edificios_pueblo/hoja_horno_guarderia.png` (6 semillas por fila; reducidos en `candidatos2/`), elegidos `hoja_horno_guarderia_elegidos.png`, finales también en `final/` | Hecho, pendiente de visto bueno. El guiso del plato queda algo empastado a 20 px |
| 14 decorados del pueblo (farol, pozo, valla, barril, cajas, banco, maceta, carretilla, leña, saco, cartel, fuente, tocón con hacha, cubo) | `assets/gen/pixel/decor_pueblo/final/*.png` (escala nativa: barril 16×24, banco 34×24, pozo 38×52, fuente 40×39, farol 11×60…). Aún no están en el juego ni en `items.json` | **2026-10-14**, receta del nido a 512²: Klein 4B + `pixel-art-lora-klein4b` 1.0, magenta liso, "straight-on front view, not isometric" (`decor_pueblo/gen.sh`, `sujetos.txt`, 4 semillas, salidas en `klein/`). `hoja.py` reduce con `edificios_pueblo/reducir.py` + la máscara de `hoja_edificios.py` (copiada en `hoja_edificios_fondo.py`) al ancho de `ANCHOS`, poda de bordes; al farol se le quita el halo rosa (luz mezclada con el magenta). Todas las semillas: `hoja.png`; elegidos (farol s1, pozo s2, valla s4, barril s2, cajas s1, banco s2, maceta s2, carretilla s2, leña s1, saco s2, cartel s2, fuente s2, tocón s1, cubo s2): `hoja_elegidos.png`; `python -I .../hoja.py <id> <semilla>` cambia uno | Pendiente de visto bueno |
| Templo en 10 niveles (mejoras del santuario) | `assets/gen/pixel/templo_niveles/final/templo_01..10.png` (112×152 → 198×277); hoja `templo_niveles/hoja.png`, imágenes de IA `klein/n01..n10.png` | **2026-10-14**, Klein 4B + `pixel-art-lora-klein4b` 1.0 en **modo edición**: `comfy.py --edit img` (nuevo: `ReferenceLatent` de Flux.2, solo `--model klein`). Nivel 1 = santuario s3 aprobado; cada nivel edita el anterior ("the same shrine… upgraded to the next level: …", `niveles.txt`). `cadena.sh 03 04 …` = `gen.sh` (3 semillas) + `elegir.py` (entre las que conservan ≥ 40 % de la flor del cerezo, la que más cambia sin contar el fondo). `lienzo.py` reescala el anterior para que ocupe ~75 % del lienzo antes de editar: **sin sitio libre la edición casi no cambia nada**. `hoja.py` reduce con la receta de los edificios del pueblo, con otra máscara: fondo = color de fondo (magenta, su deriva en la cadena —mediana de las esquinas— y sombras moradas) **conectado al borde**, relleno que se para en el contorno oscuro (la máscara por matiz se comía los pétalos de dentro de la copa) a un tamaño fijo por nivel (`TAM`, raíz del área). Lo que no funcionó (en `klein/descartadas/`): bajar de nivel (la edición no encoge), prompt sin mencionar el árbol (lo quita), torii delante de la fachada (la tapa) | Hecho, pendiente de visto bueno. Pegas: niveles 9-10 empastados y con el cerezo desvaído (ya en la imagen de la IA); el puente del 6-8 sale del muro |
| Edificios (casa, tienda de Kecleon) | **Casa sustituida el 2026-10-14 por el taller de Klein (fila de arriba); la V7 está en `edificios/v7_casa/casa.png`.** `assets/game/pixel/edificios/casa.png` (154×170), `tienda.png` (151×126) + `edificios.json` | **V7 (2026-10-13):** la V6 con tres cambios quirúrgicos y nada más (el guion comprueba que fuera de las zonas la diferencia es 0), sin IA: `assets/gen/pixel/src/edificios/retoques_v7.py` (determinista) sobre `casa_v6.txt`/`tienda_v6.txt` → `casa_v7.txt`/`tienda_v7.txt` → `pixel_build.py`. Casa: chimenea = la ORIGINAL de la V4 (bloque x=98..125, y=0..49 pegado con `Mapa.pegar`: piedra beige irregular, mortero marrón, corona clara con la boca; solo 213 px distintos de la V4: contorno de 1 px, restos de teja y sombra residual a piedra oscura, cara derecha o|u), y el "tejadillo" sobre la puerta de la V6 vuelve a ser el muro de la V5 (copiado tal cual). Tienda: las cajas de abajo a la izquierda pasan a una pila de 3 troncos (18×9, corte crema con anillo, tonos de `items/tronco.png`, contorno 1 px, sombra 1 px); el saquito se quita. Tejado, alero, ventanas, puerta, toldo, mostrador y mercancía: intactos. Ficha en `params.txt` (VERSION 7) | Hecho, pendiente de visto bueno. 0 huérfanos / 0 dobles. Hoja V6\|V7 `limpio_v7/preview_v7.png`, detalle ×12 (chimenea V4\|V6\|V7, troncos, puerta V5\|V6\|V7) `limpio_v7/detalle_x12.png`. V6 en `edificios/v6_direccion/`; V5 en `v5_texturas/`; V4 en `v4_bordes/`; V2 en `v2_flux/`; V3 (rechazada) en `v3_limpio/`; dibujo a primitivas en `v1_dibujo/` |
| Kit de edificios (piezas + compositor) | `assets/game/pixel/kit/*.png` + `kit.json`; renders de prueba `assets/gen/edificios/kit/*_kit.png` | §3c y `docs/art/KIT.md`: `hacer_kit.py` (piezas desde la V6) + `tools/edificio.py` (planos JSON en `assets/gen/edificios/kit/planos/`) | Hecho (2026-10-13), pendiente de visto bueno; 0 huérfanos / 0 dobles en los 4 edificios |
| Mapas de aldea | `docs/art/mapas/aldea_a/b/c.json` | `tools/map_village.py` (40×30, semillas fijas; terreno + objetos + árboles + rocas + `inicio`) | 3 variantes para elegir |
| Detalles del suelo | — | — | Pendiente |

## 5. La maqueta por dentro (`docs/art/maqueta-tiles.html`)

- **Mapa:** `docs/art/mapas/<nombre>.json` (`?mapa=`), terreno en las esquinas de las casillas
  (`VERT`): 0 césped, 1 tierra, 2 losas, 3 agua. `referencia.json` sale de `tools/map_trace.py`
  (caminos, manchas de tierra y lagos trazados sobre la referencia); `lagos_prueba.json` de
  `tools/map_lakes_test.py`.
- **Campos por píxel** (interpolación de esquinas + ruido = bordes orgánicos):
  `FIELD` (tierra, pantalla), `PFIELD` (losas, mundo), `WFIELD` (agua, pantalla) y `UPD`
  (distancia hacia arriba al borde del agua, para la pared).
- **`redraw()`** pinta el suelo píxel a píxel en un canvas a resolución de pantalla; `water()`
  añade agua, pared, sombra y orilla. Encima, las calcomanías (`DECALS`: matorrales y flores),
  cada tipo en su capa opaca que se funde entera con su opacidad.
- **Pared de los lagos:** alto fijo `CLIFF_H` bajo cualquier orilla que mire hacia abajo
  (`CLIFF_FACING`, medido sobre la orilla lisa `waterSmooth`) y con tierra de verdad encima
  (`CLIFF_LAND`); rendijas de menos de `CLIFF_GAP` px junto a una pared se rellenan de roca;
  línea en los lados solo contra agua abierta; sombra suavizada en horizontal.
- **Sprites** (árboles, rocas, Pokémon) son objetos de Phaser con profundidad = y.
- **Capa de objetos** (pixel art a escala de mundo, 1 px de imagen = 1 px de mundo): los catálogos
  `assets/game/pixel/items.json` y `edificios.json` (`OBJS`: id → `archivo`, `ancla` [x, y] del
  punto de apoyo, `colision` [w, h] en px de mundo centrada en el ancla y hacia arriba —
  `[0, 0]` = se pisa—, `tipo` item/estacion/edificio, `suelo: true` = a ras de suelo, todo pasa
  por encima, p. ej. el nido) se cargan al arrancar; si faltan, aviso y se
  sigue. Cada objeto es `this.add.image` con origen = ancla, escala 1, filtro NEAREST y
  profundidad = y (los de `suelo`, y − 5000); estaciones y edificios llevan la sombra elíptica de las rocas. Items ajustados
  al centro de la casilla; estaciones/edificios con x en medias casillas e y en bordes. Las
  colisiones van en `this.blocks` (rectángulos) y el jugador no entra en ellas.
- **Mapa JSON, claves opcionales:** `inicio` `[x, y]` (donde aparece Bulbasaur; si falta, el centro); `objetos` `[{id, x, y}]` (ancla en px de mundo);
  `arboles` `[{x, y, k?, h?}]` y `rocas` `[{x, y, k?, s?}]` (k variante, h alto en px, s escala
  0.5..1) sustituyen a `TREES_REF`/`ROCKS_REF` (los de la referencia se saltan si caen en camino
  o agua; los del mapa se ponen siempre). Sin esas claves, se usan los de la referencia.
- **Teclas:** WASD mover · 1 césped · 2 tierra · 3 losas · 4 agua · 5 flores · 6 matorrales ·
  7 objetos (Q/E anterior/siguiente id del catálogo; el nombre sale en el rótulo del pincel) ·
  clic izq. pintar o poner · clic der. borrar / quitar (flores, matorrales u objetos bajo el
  cursor) · G rejilla · M mapa entero · X exportar: `{mw, mh, vert, objetos, arboles, rocas}` del
  estado actual a la consola y al portapapeles ("mapa copiado"), para pegarlo en
  `docs/art/mapas/<nombre>.json`. Lo pintado no se guarda al recargar si no se exporta.
- Todas las constantes de ajuste están arriba del script con un comentario.

## 6. Herramientas (`tools/`, todas con explicación al principio del archivo)

En uso: `comfy.py` (ComfyUI local: `--model sdxl|flux|klein`, `--ckpt`/`--unet`/`--clip-skip`/`--sampler`, `--lora`, `--init` img2img, `--ref` IP-Adapter), `pixel_geom.py` (corrector de círculos, ver §3e),
`pixel_build.py` (txt → PNG de pixel art), `pixel_grid.py` (imagen IA con rejilla de píxel → sprite, un color por celda),
`pixel_clean.py` (limpieza automática según las reglas de §3b: huérfanos, dobles, islas, suavizado, espejo, filas
periódicas; `--check --runs` informa con coordenadas), `png_to_txt.py` (PNG → txt editable), `pixel_txt.py` (módulo de
retoques sobre txt: líneas Bresenham, rectángulos, copiar/insertar columnas, espejo, `contorno_superior`, `desplazar_banda`, `diff`; V5: `perfil_tramos`, `bandas`, `tejas`, `festones`, `abanico`, `rematar`; V6: `tejas_v`, `piedras`, `caja`, `pegar`), `pixel_detalle.py` (recortes ×12 antes|después), `pixel_fixer.py` (envoltorio de pixel-art-fixer: detecta el paso, `--colors`, `--despeckle`; ver §3d),
`edificio.py` (compositor del kit de edificios: plano JSON + piezas de `assets/game/pixel/kit/` → PNG y entrada de catálogo; ver `KIT.md`),
`pixel_sprite.py` (imagen SDXL → sprite pixelado, promedio BOX),
`draw_edificios.py` (casa y tienda a píxel), `map_village.py` (mapas de aldea),
`cutout.py` (BiRefNet), `clean_tree.py`, `recolor_hue.py`, `rock_outline.py`, `cut_flowers.py`,
`cliff_strip.py`, `quilt.py`, `map_trace.py`, `map_lakes_test.py`, `cut_stones.py`.
Antiguas o sin uso: `clean_flowers.py`, `cut_bushes.py`, `make_bushes.py`, `pixelize.py`,
`grass_tiles.py`, `gradient_map.py`, `harmonize.py`, `flatten_tileset.py`, `extract_tiles.py`,
`make_tileable.py`, `map_from_ref.py`, `prep_asset.py`.

Carpetas: `assets/gen/` = todo lo generado e intermedio (incluye descartes); `assets/game/` = lo
que usa la maqueta/juego.

## 6b. Lab de estilo «dibujo» (2026-10-14, `lab/`)

El usuario trajo un dibujo cartoon plano con línea oscura (`lab/assets/ref/aldea_dibujo.png`: 4 casas,
árboles, rocas, suelo de piedras, estanque) y quiere probar el juego **exactamente** con esos elementos
(no pixel art; los Pokémon siguen siendo PMD). Es I+D: si gusta, se pivota. Todo está en `lab/README.md`.
Resumen del proceso (`lab/tools/extraer.py`): quitar el marco, ampliar ×2 con RealESRGAN (`lab/tools/ampliar.py`,
ComfyUI; modelos `RealESRGAN_x4plus` y `RealESRGAN_x4plus_anime_6B` en `.safetensors` en `models/upscale_models/`,
elegido anime_6B: líneas nítidas y color plano; antes LANCZOS + bilateral, más blando), fondo = colores de césped/arena/mar inundados desde el borde (lo que hay dentro de un contorno
queda dentro), componentes conexas = elementos, cortes a mano donde dos se tocan (`CORTES`), nombres
fijos (`NOMBRES`), alfa con antialias desmezclado del fondo, huella de colisión por tipo. Suelo: césped y
arena de ese dibujo con `quilt.py` (--kind grass / --kind flag, 288²) + inpaint de las matitas repetidas, y
`Terrain` con paleta propia (`OpcionesSuelo`). Hoja de contacto: `lab/assets/elementos/hoja.png`. **Vectorizado (2026-10-14):** `lab/tools/vectorizar.py` pasa los
elementos grandes a SVG con vtracer (pip, Rust; precisión 7 / capas 8; en Python 3.14 solo admite argumentos
posicionales) y el lab los carga con `?vector=1` rasterizados al tamaño de pantalla: nítidos a cualquier zoom. El usuario lo rechazó
(añade detalle y pierde las tejas): `lab/tools/vectorizar2.py` vectoriza **por capas** (líneas aparte, en binario y por
tonos; rellenos planos por mean-shift + k-means ≤ 16 colores). **Reinterpretación con Klein (2026-10-14):** antes de
vectorizar, cada elemento se rediseña con Flux.2 Klein 4B (`--edit`, el dibujo o el recorte como referencia) y sale limpio
en el mismo estilo (`lab/assets/gen/gen_klein*.sh`, hojas `hoja_klein*.png`). Catálogo completo reinterpretado (27 elementos: las 4 casas, 2
árboles, 9 rocas, estanque, caminos, y nuevos: tienda, almacén, pozo, hoguera, tocón, arbusto, valla, flores) con
`lab/tools/catalogo_klein.py` (ampliar → `recortar.py` → `vectorizar2.py`), en el juego con `?set=klein` y `&vector=1`.
Al usuario le gusta ("este es el camino"); escala bajada a `F = 1/3` (1 px del dibujo = 1 px de pantalla a zoom 3).

## 6c. Mapas de normales para los Pokémon (demo 2026-10-14)

`tools/normales_pokemon.py <dex> <Anim…> [--fuerza 1.0] [--vista]` genera `<Anim>-Normal.png` junto a cada hoja PMD
(misma rejilla de fotogramas, leída de `AnimData.xml`). No hay modelo 3D: la altura de cada píxel se "infla" a partir de
la silueta (semiesfera), de las piezas que separan los contornos negros (bulbo, cuerpo, patas: cada una abomba por su
cuenta) y del sombreado propio del sprite (paso alto de la luminancia). Convención OpenGL (verde = arriba), la del
pipeline `Light2D` de Phaser. También escribe `<Anim>-Luz.png`: el sprite con el contorno negro teñido hacia el color
de sus vecinos (`--tinte 0.6`), porque el negro puro no se aclara con luz; es esa variante la que se carga con el normal map.
Tarda ~1 s por Pokémon (4 hojas), así que hacerlo para todos es un bucle.
Pokémon-pelota (tabla `BOLAS` del script o `--bola 0.9`; 2026-10-14: Natu, Marill, Togepi, Cleffa, Swinub, Wailmer,
Glalie, Wooloo, y a 0.7 Gastly y Hoothoot; también Jigglypuff, Voltorb, Electrode, Koffing y Spheal, para cuando entren): la altura la marca un elipsoide
ajustado al cuerpo (sin patas ni penacho) y las piezas apenas lo abollan; sin esto, los contornos de ojos y pico partían
la cara en piezas y quedaba plana. `--bola 0` vuelve al cálculo de antes; los normales previos, en
`assets/gen/normales/v_antes_bola/`. Comparativas: `assets/gen/normales/bolas_*.png` (`bolas_descartados.png`: Azurill,
Magnemite, Geodude, Oddish y Munchlax, que no son una sola bola).
Demo: `/normales.html` en el servidor del juego (`src/paginas/normales.ts`): fila con normales / fila sin, luz con el
ratón o ciclo de día (D). Pipeline «Cel» propio (`CelPipeline`, mismo shader de luz de Phaser con el difuso cortado
en bandas: C alterna cel/suave, B número de bandas, U umbral de la sombra, H altura de la luz, S transición entre bandas); las normales van sin suavizar (una faceta por píxel). Vistas previas: `assets/gen/normales/` (`0001_*.png` = sprite, normal y 4 luces; `demo_*.png`).
**Primer uso real (2026-10-14, tarde): el mapa de noche del lab**, `http://127.0.0.1:5179/lab/?noche=1` (`lab/README.md`,
«Mapa de noche»): ambiente azul, farolas Klein (`farola`, `farola_madera`) y hoguera con luz Light2D cálida que parpadea, y
Bulbasaur con `-Luz.png` + `-Normal.png` en el pipeline cel, que pasa a `src/render/CelPipeline.ts` (compartido con la demo;
atenuación solo en el plano y ganancia por pipeline, ver README del lab).
Pendiente de decidir si entra en el juego (ver conversación 2026-10-14): si entra, el suelo y los edificios también
necesitan normales para que los Pokémon no "floten" en otro estilo, y el tinte de noche pasa a ser la luz ambiente.
Idea (usuario, 2026-10-14): varios tipos de luz según lo que pasa: sol alto y suave de día, faroles bajos y cálidos de noche,
y luces propias de ataques, partículas y efectos (destello eléctrico duro, llama parpadeante…). Requiere que la altura y
la transición sean por luz, no globales: ampliar `Phaser.GameObjects.Light` con esos campos y pasarlos al shader como
uniformes por luz (hoy `uAltura`/`uSuave` son únicos para todo el pipeline).

## 7. Pendiente

- Detalles del suelo (piedrecitas, matitas, manchas).
- Posibles retoques ofrecidos: sombras de árboles/rocas más marrones sobre tierra (ahora verdosas),
  flores algo más pequeñas, rocas fuera del borde del camino, guardar lo pintado en la maqueta.
- Visto bueno del usuario a los sprites pixel art (objetos, mesa, edificios) y elección de mapa de aldea.
- Nuevos objetos del GDD (cultivos, estaciones de trabajo, caja de envío, Árbol Santuario…) con
  la receta del apartado 3.
- ~~Pasar la maqueta al juego real~~ Hecho (2026-10-13): `src/render/Terrain.ts` es el suelo de la
  maqueta portado a TypeScript (mismo algoritmo, mismo resultado con el mismo mapa). La maqueta sigue
  siendo el sitio donde se prueba el arte nuevo y se pintan los mapas (`X` exporta el JSON que carga el juego).
- Sprites que el juego aún no tiene y usa sustitutos: **Árbol Santuario** (no aparece), **cama** (se duerme junto
  a la puerta de la casa). La **caja de envío de Pelipper** ya existe (0.2d; antes hacía de caja la mesa de trabajo).
