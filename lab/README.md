# Lab (I+D): el valle en estilo «dibujo»

Versión paralela del juego en el estilo de `assets/ref/aldea_dibujo.png` (cartoon plano con línea
oscura, **no** pixel art; solo los Pokémon siguen siendo pixel art PMD). Si gusta, el juego pivota a
este estilo. No toca el juego de `src/` salvo que `Terrain` ahora admite otra paleta y otras texturas
(con los valores de siempre por defecto; el juego sale idéntico).

## Arrancar

- Servidor `lab` de `.claude/launch.json` (`npm run lab`, Vite en http://127.0.0.1:5179/lab/).
  También vale cualquier servidor del juego: http://127.0.0.1:5174/lab/.
- **Modo por defecto (2026-10-14): catálogo Klein en SVG** (`set=klein`, `vector=1`). `?set=original` enseña los
  recortes del dibujo original; `?vector=0` (o `?png=1`) usa los PNG en vez de los SVG.
- `?noche=1`: mapa de noche con farolas (ver abajo); `?luces=1`: banco de pruebas de los tipos de luz.
- `?zoom=2` fuerza el zoom (por defecto el entero que quepa en la ventana, 3 en 1440×810);
  `?escala=0.5` cambia los px de mundo por px del dibujo (1/3 por defecto).
- Controles: WASD / flechas; M = mapa entero. `pv` en la consola es el juego.
- `npm run check:lab` = tipos.

## Qué hay

- `assets/ref/aldea_dibujo.png`: el dibujo de referencia (1024², webp original al lado);
  `aldea_dibujo_x2.png`: ampliado ×2 con RealESRGAN (`tools/ampliar.py`: ComfyUI, modelo
  `RealESRGAN_x4plus_anime_6B` a ×4 y reducido a ×2; líneas nítidas y color plano). Alternativas:
  `x2_realesrgan.png` (x4plus, algo más de grano), `v1_bilateral/` (LANCZOS + bilateral, la primera
  versión, más blanda). Comparativa de los tres: `comparativa_ampliacion.png`.
- `assets/elementos/`: cada elemento del dibujo recortado con alfa, a ×2 (1 px del dibujo = 2 px del
  PNG): `casa_cabana`, `casa_larga`, `casa_grande`, `casa_chimenea`, `arbol_alto`, `arbol_bajo`,
  `roca_0..8`, `estanque`, `piedras_0` (el suelo de piedras con su argamasa), `losa_n` (losas sueltas)
  y `detalle_n` (flores y matitas). `elementos.json`: tamaño, ancla (centro-base) y huella (rectángulo
  que bloquea el paso) de cada uno; `hoja.png`: hoja de contacto.
- `assets/suelo/`: césped y arena **de este dibujo**, sacados con `tools/quilt.py` (image quilting,
  288²) y limpios de matitas repetidas; los pinta el mismo `src/render/Terrain.ts` del juego con la
  paleta `PALETA_DIBUJO` (`src/scenes/LabScene.ts`).
- `tools/ampliar.py`: superresolución local (ComfyUI + RealESRGAN en `.safetensors`, convertidos del
  `.pth` oficial con `torch.load(weights_only=True)`; en `ComfyUI/models/upscale_models/`).
- `tools/extraer.py`: el extractor (ver cabecera). Lee `aldea_dibujo_x2.png` si existe (`--fuente-x2 no`
  para LANCZOS + bilateral). Retoques por elemento en `POST`: polígono de recorte, quitar verde de parche o
  arena, desvanecer una zona en elipse (`degradado`, la sombra del árbol alto) y pintar la línea oscura del
  dibujo sobre un corte (`contorno`, el parche de la casa larga) para que no se vea un borde recto.
  Las piedrecitas marrones del dibujo salen como `piedrecita_n`: se guardan pero no se dispersan por el césped. Fondo = césped/arena/mar por color, inundado desde
  el borde; cada componente conexa es un elemento; cortes a mano (`CORTES`) donde dos se tocan;
  nombres fijos (`NOMBRES`); alfa con antialias desmezclado del fondo.
- `tools/vectorizar.py` + `assets/vector/*.svg`: los 17 elementos grandes vectorizados con **vtracer**
  (pip, local; precisión 7, capas de 8: las casas quedan en ~2000 trazados / ~1 MB, las rocas en 15-50 KB).
  En vtracer 0.6.15 con Python 3.14 los argumentos con nombre revientan: se pasan posicionales.
  `vector.json` lista los que tienen SVG. **`?vector=1`** en el juego los carga como SVG rasterizados por
  el navegador al tamaño exacto de pantalla (`load.svg` con `scale`), así se ven nítidos a cualquier zoom;
  sin el parámetro se usan los PNG. Comparador PNG/SVG: `/lab/vector.html?el=casa_grande&v=p6,p7,p8&w=927&h=779`.
- `tools/vectorizar2.py` (**vectorizado por capas**, 2026-10-14): el directo troceaba los degradados en
  manchas y perdía las tejas. Este separa (1) las **líneas** (píxeles más oscuros que su entorno, black-hat
  11 px, solo el núcleo del trazo; color relativo a su fondo, 6 tonos, trazadas en binario) de (2) los
  **rellenos**, planos por celdas (cada zona cerrada por líneas = un color, 2-3 si tiene sombreado), con las
  motas fundidas y la paleta agrupada a ≤ 18 colores. `--debug` deja `_<id>_lineas.png` / `_<id>_plano.png`.
  Salida `<id>_capas.svg`; comparar con `/lab/vector.html?el=casa_grande&v=p7,capas&w=927&h=779`;
  solo la capa de líneas: `/lab/lineas.html`.
- `src/mapa.ts`: el mapa (48×36 casillas): manchas de arena y dónde va cada elemento (px de mundo).
  Los detalles se reparten solos por el césped con semilla fija.
- `src/scenes/LabScene.ts`: suelo + elementos (reducidos al tamaño exacto en pantalla con
  `screenTex`, orden por la y de la base, colisión por huella) + Bulbasaur.

## Reinterpretar los elementos con Klein (2026-10-14)

El dibujo original tiene fallos de diseño (puertas que no son puertas, dobles líneas, el tejado que se
funde con la fachada). Antes de vectorizar, se rediseña cada elemento con **Flux.2 Klein 4B** (local)
manteniendo el estilo, y sale limpio:
- `assets/gen/gen_klein.sh`: A) editar un elemento (`--edit` = ReferenceLatent sobre el recorte puesto
  en verde liso, `ref_casa_grande.png`): mismo diseño, limpio. B) elemento nuevo con el dibujo entero
  como referencia de estilo. `gen_klein2.sh`: árbol, roca, estanque, camino y cabaña nuevos (2 semillas).
  ~11 s por imagen con el modelo cargado. Hojas: `hoja_klein.png` (casas), `hoja_klein2.png` (resto).
- Pipeline de un elemento generado: `tools/ampliar.py --entrada X.png --salida X_x2.png` →
  `tools/extraer.py --imagen X.png` (sin los ajustes a mano de la referencia; quita la sombra verde que
  pinta Klein; salida `assets/elementos_<X>/`) → `tools/vectorizar2.py casa_0 --carpeta elementos_<X>`
  → comparar en `/lab/vector.html?el=casa_0&v=capas&d=elementos_<X>&w=..&h=..&k=0.5`.
- Hecho con `klein_edit_casa_s1_0`: `assets/elementos/casa_klein.png` (catálogo `elementos/extra.json`, que
  Boot añade al principal) y `assets/vector/casa_klein.svg`. **`?klein=1`** en el juego pone esa casa en el sitio
  de `casa_grande` (`SUSTITUTOS` en `src/config.ts`, escalada a 0,69 para ocupar lo mismo); con `&vector=1`, su SVG.
- Vectorizado por capas, relleno por defecto `meanshift` (mean-shift + k-means a 16 colores): robusto con
  líneas que tienen huecos. `--relleno celdas` (un color por zona cerrada) se fuga por los huecos y mezcla
  la puerta con la pared: descartado como defecto.

### Catálogo Klein completo (`?set=klein`)

- `tools/recortar.py`: recorte rápido (segundos) de una imagen generada sobre verde liso: fondo por color
  del borde, sombra proyectada fuera (verde apagado fuera de lo que encierran contorno + cuerpo; lo encerrado,
  como el suelo sombreado junto a una puerta, se queda), mancha mayor, alfa desmezclado, huella por tipo.
- **Sombras (2026-10-14, tarde):** la sombra proyectada que pinta Klein no se tira: se guarda como máscara
  aparte `<id>_sombra.png` (alfa = cuánto oscurece respecto al fondo, con la forma real de Klein; campo `sombra`
  del catálogo con su desplazamiento `dx,dy` respecto al PNG). `LabScene.colocar` la pinta con opacidad
  (`SOMBRA_ALFA = 0.45`) y mezcla *multiply* sobre el suelo. Al Pokémon no lo tapa la capa (no cubriría la parte
  del sprite que se superpone a la pared): sobre él se dibuja una silueta de su propio sprite (`copiaSombra`,
  tintFill + multiply, misma opacidad) recortada con `setCrop` a las columnas cuyo punto a la altura de los pies
  cae en la máscara (`sombraEn`, `textures.getPixelAlpha`). Sombra dura, como la del suelo, que le cubre entero
  en esas columnas, también sobre la pared. (Probado y descartado: tinte entero = todo o nada; tinte por
  esquinas = degradado blando, el usuario quería sombra dura.) Es lo que faltaba en la esquina inferior derecha de `casa_chimenea`
  (Klein pintó ahí sombra, no parche de hierba). 21 de 28 elementos tienen sombra.
- Tamaño: `FACTOR` en `catalogo_klein.py` escala respecto al original (árboles ×2.4 / ×2; el usuario los quería
  "como mínimo el doble").
- Colisión del estanque: rombo redondeado (superelipse p = 1.5, medida sobre su silueta) dentro de su huella, y
  el estanque va a ras de suelo (como los caminos): quien pasa a su lado se dibuja siempre encima y nunca
  queda tapado por el muro de piedras del lado sur; por el norte no llega a solaparlo.
- `tools/catalogo_klein.py`: tabla `TABLA` (id, tipo, imagen generada, ancho en el mundo) → amplía ×2
  (RealESRGAN), recorta a `assets/elementos_klein/<id>.png`, calcula `k` (escala para medir lo que el original
  al que sustituye, o el ancho dado para los nuevos) y vectoriza por capas a `assets/vector/elementos_klein/`.
  Los ids que coinciden con el catálogo original lo sustituyen; los nuevos (`tienda`, `almacen`, `pozo`,
  `hoguera`, `tocon`, `arbusto`, `valla`, `camino_c/d`, `flores`) se colocan con `EXTRA.klein` de `src/mapa.ts`.
- Caminos empedrados (tanda 4, `gen_klein4.sh`): pedidos como "patch" salían rectangulares. Soluciones que
  funcionan: `piedras_0` = **edición Klein del parche del dibujo original** puesto en verde liso
  (`ref_piedras_0.png`: conserva su silueta irregular), y senderos de piedras sueltas ("scattered stepping
  stones", `camino_d`, `camino_e`). Las "S" sinuosas salen demasiado literales (`klein_camino_e_s*`, sin usar).
- En el juego es el modo por defecto (`?set=original`, `?vector=0` para comparar). Tandas de generación: `assets/gen/gen_klein*.sh`,
  hojas `hoja_klein*.png`.
- Escala (2026-10-14): `F = 1/3` (a zoom 3, 1 px del dibujo = 1 px de pantalla); el mapa pasa a 32×24 y las
  posiciones se escalan por `K = 2/3` en `src/mapa.ts`.

## Mapa de noche (`?noche=1`, 2026-10-14)

http://127.0.0.1:5179/lab/?noche=1 — el mismo valle de noche, aprovechando los mapas de normales de los Pokémon
(`tools/normales_pokemon.py`, PIPELINE §6c). Capturas: `assets/captura_noche_mapa.jpg`, `captura_noche_farola.jpg`,
`captura_noche_hoguera.jpg`.
- **Luz:** Light2D de Phaser. Ambiente azul oscuro (`AMBIENTE_NOCHE`), el suelo y todos los elementos con el pipeline
  `Light2D` (sin normales: solo distancia a la luz). `render.maxLights = 16` en `main.ts`.
- **Farolas:** dos elementos nuevos del catálogo Klein (`tools/gen_klein5.sh`, hoja `gen/hoja_klein5.png`): `farola`
  (hierro sobre base de piedra) y `farola_madera` (farolillo colgado a la derecha del poste). Posiciones en
  `FAROLAS` de `src/mapa.ts` (de día también se ven, apagadas). Cada una lleva una luz cálida en el farol
  (`LUZ_FAROLA`: radio 120, intensidad 1,25) y un halo (degradado radial en ADD, `encender`). La hoguera lleva la
  suya, naranja y con más parpadeo (`LUZ_HOGUERA`). Parpadeo = suma de tres senos con fase distinta por luz (`update`).
- **Bulbasaur:** se carga la hoja `-Luz.png` (contorno teñido) con su `-Normal.png` y el pipeline «cel» de la demo,
  ahora en `src/render/CelPipeline.ts` (compartido con `/normales.html`): la luz de cada farola le da por su lado, en
  bandas. Dos ajustes salidos de aquí: la atenuación usa solo la distancia en el plano (`length(lightDir.xy)`; con la
  altura dentro, a zoom 3 ningún radio llegaba) y una ganancia por pipeline (`ganancia = 0.55`; con la atenuación
  plana del cel, un sprite claro se quemaba bajo la farola).
- **Tipos de luz** (`src/render/luces.ts`, `TIPOS_LUZ`): `farol`, `vela`, `hoguera`, `luna`, `electrica`, `espectral`,
  `cristal`. Cada uno fija color, radio e intensidad, cómo le da al sprite con normales (altura 0 = rasante con mucha
  sombra lateral, 1 = frontal; bandas, umbral y suavidad del cel; ahora son **uniformes por luz**, `CelPipeline.onRender`
  los lee del campo `cel` de cada `Light`) y la animación (`animarLuz`: parpadeo rápido, pulso lento, chispa = apagones).
  Una farola del mapa elige el suyo con `luz: 'vela'` en `Colocado`. **Banco de pruebas: `?luces=1`**: el valle vacío de
  noche con una farola por tipo, en fila y con su nombre encima (capturas `assets/captura_luces_a.png`, `_b.png`).
- Las sombras proyectadas de Klein se pintan con menos opacidad (0,2) de noche.
- Pendiente: normales para los elementos (casas, árboles) para que la luz les dé volumen; luces por ventanas; ciclo
  día/noche real (hoy es un modo fijo).

## Receta para añadir elementos de otro dibujo

1. Dibujo en `assets/ref/`, con los mismos colores de fondo (césped, arena o mar lisos).
2. `python -I lab/tools/extraer.py --hoja` y mirar `assets/elementos/hoja.png`. Si dos elementos
   salen pegados, añadir un corte a `CORTES`; si uno sale mal clasificado, `AJUSTES`; nombre fijo en
   `NOMBRES`.
3. Colocarlo en `src/mapa.ts` (`FIJOS`).

## Pendiente / ideas

- ~~Ampliar con IA el dibujo~~ Hecho (RealESRGAN anime_6B). ~~Vectorizar~~ Hecho (`?vector=1`); decidir
  si pasa a ser el modo por defecto (los degradados suaves quedan en bandas muy finas, casi invisibles).
- Más elementos del estilo (generar con SDXL + IP-Adapter sobre este dibujo y pasarlos por el extractor).
- Si el lab carga `vector/elementos_klein/vector.json` mientras `catalogo_klein.py` lo reescribe, Vite devuelve
  index.html y Phaser avisa "Failed to process file json setVectores": el set se pinta en PNG esa vez. Recargar.
- Agua del terreno (mar/lagos) con el estilo del dibujo: hoy la pared de roca es la del valle pixel.
