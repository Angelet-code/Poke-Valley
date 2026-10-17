# Pokémon Valley

Fangame personal y no comercial con Pokémon (sin humanos ni diálogo). Stack: Phaser 3 + TypeScript + Vite.
**Desde el 2026-10-14 la dirección es el modo aventura**: un "WoW PvE" de Pokémon muy simplificado. Manejas a un
Pokémon, combates en tiempo real con la barra de atajos, capturas salvajes y te conviertes en ellos. Los mapas son
cerrados (pueblo + bosque procedural). El juego de antes, estilo Stardew (granja, aldeanos, construir), sigue en
`?modo=granja`.

## Leer antes de trabajar
- `docs/GDD-combate.md`: diseño del modo aventura (fuente de verdad desde el pivote). Su código:
  - `src/scenes/Aventura.ts` + `HudAventura.ts`: montan el mapa, leen el teclado y dibujan;
  - `src/combate/mundo.ts`: la simulación (choques, IA, combate, capturas, clima, alfa, hogar), sin Phaser y con
    semilla (`rnd`). Avanza con `paso(dt, entrada)` y pasa sucesos a la escena: es la base para el multijugador;
  - `src/combate/`: reglas, partida y sprites;
  - `src/data/bosque.ts`: mapas (pueblo en `puebloAventura.ts`; las seis zonas de bioma en `biomas.ts`, generador común, ver `docs/GDD-mundo.md` §4b y §5);
  - `src/data/movimientos.ts`: datos de `src/data/gen/combate.json`, que genera
    `node tools/datos_combate.mjs` desde el Showdown de Pokémon Colleja;
  - `src/fx/`: animaciones de movimientos copiadas de Pokémon Colleja
    (`A:\PROYECTOS\OPENCODE\Pokemon Colleja Simulator\apps\web\src\features\battle\animation`) y adaptadas en
    `fx/stage.ts`.
- `docs/GDD-progreso.md`: propuesta (2026-10-17) para que el juego no se acabe en 3 h: mundos heroicos, Pokédex con premios,
  misiones diarias, botín por alfa y fusiones, logros, exp compartida. Nada hecho aún.
- `docs/GDD-mundo.md`: las zonas del modo aventura (pueblo, Bosque Verde, Lago Celeste), cómo se conectan, lo que
  viene (misiones sin diálogo, alfas, mundo continuo) y el arte que falta. Prueba directa de una zona:
  `pv.scene.getScene('title').scene.start('aventura', {mapa: 'lago', desde: 'bosque'})`, o en la URL `?zona=lago`
  (entra directo sin pasar por el título y aguanta las recargas al cambiar el tamaño de la ventana).
  La ciudad (`?zona=ciudad`): suelo de una imagen de IA y encima edificios, setos, fuente y farolas como piezas sueltas (`cd_*`; `src/data/ciudad.ts`, ARCANE.md «Ciudad por piezas»).
- `docs/art/ARCANE.md`: el escenario en estilo Arcane (decidido el 2026-10-15), por fases. **Es el estilo por defecto (2026-10-15); `?set=dibujo` vuelve al dibujo solo para comparar**
  (catálogo `lab/assets/elementos_arcane/`, suelo `lab/assets/suelo_arcane/`; lo que falte sale del estilo dibujo).
- `docs/GDD.md`: diseño del juego de granja (`?modo=granja`).
- `docs/art/PIPELINE.md`: cómo se hace el arte, estado de cada elemento, herramientas con sus
  parámetros exactos y la receta para crear objetos nuevos. **Léelo entero antes de tocar arte.**

## Arrancar
- Juego: servidor `juego` de `.claude/launch.json` (`npm run dev`, Vite en http://127.0.0.1:5174;
  `npm install` la primera vez).
  - El título arranca el **modo aventura**. Su partida se guarda en localStorage `pokemon-valley/aventura`.
  - En la consola, `pv.scene.getScene('aventura')` es la escena.
  - Para probar sin pasar por el título:
    `pv.scene.getScene('title').scene.start('aventura', {mapa: 'bosque', desde: 'pueblo'})`.
  - Lo que sigue describe el modo granja. **Mapa por defecto (2026-10-14): `dibujo`**, el pueblo del lab en estilo dibujo
  (elementos Klein en SVG, `src/data/mapaDibujo.ts` + `src/render/Dibujo.ts`; casa = `casa_grande`, almacén = `almacen`,
  tienda = caja de Pelipper; 13 farolas y la hoguera se encienden al anochecer (19:15-20:15) y se apagan al amanecer (6:15-7:15) con Light2D, `WorldScene.luzDelDia`;
  los Pokémon se cargan con su `-Luz.png` + `-Normal.png` (`Preload.NORMALES`) y van con el pipeline Cel (`WorldScene.iluminar`);
  `?muestra`: 48 Pokémon de adorno paseando por el pueblo, para ver cómo quedan (`src/data/muestra.ts`; no se guardan);
  la luz ambiente sigue la curva `World.luzAmbiente` (alba, amanecer, día, tarde dorada, atardecer, anochecer, hora azul, noche; también el velo del mapa pixel);
  partida guardada aparte). El día (6:00 → 2:00) dura 10 minutos (`SEG_POR_MINUTO = 0.5`).
  `?mapa=aldea_d` vuelve al pueblo pixel art; `?mapa=aldea_b` elige otro mapa de `docs/art/mapas/` (`aldea_d` es el pueblo pixel: `tools/map_village.py` variante `pueblo`, con nidos y solares para construir; un edificio nunca tapa el dibujo de otro, `WorldScene.dibujoDe`), `?nueva`
  empieza partida nueva. `npm run check` = comprobación de tipos. Código: `src/sim/World.ts`
  (simulación pura: reloj, energía, inventario, plantas, caja de envío, guardado en localStorage),
  `src/render/Terrain.ts` (suelo portado de la maqueta; el cálculo por píxel está en `TerrainCore.ts` y
  al entrar al mundo se reparte entre varios hilos, `terrain.worker.ts`, con SharedArrayBuffer: por eso
  `vite.config.ts` manda cabeceras COOP/COEP; sin ellas va en un hilo, más lento e idéntico. La consola
  dice "Suelo listo en X ms"; tras cambiar las cabeceras hay que abrir la URL de nuevo, no basta F5),
  `src/scenes/*` (Boot → Preload → Title →
  World + UI), `src/data/items.ts` (objetos y precios). En la consola del navegador, `pv` es el juego.
  Enfoque actual: pueblo al estilo Cult of the Lamb (`docs/GDD-pueblo.md`, prototipo 0.2b: almacén +
  aldeanos con trabajo + construir nidos y comedero; el estado de cada paso está al final de ese archivo).
  B = modo construcción (`src/data/edificios.ts`: costes; clic coloca, B/Esc/clic der. sale).
  Utilidad de cada edificio (horno → ladrillos, guardería, cocina y ampliación de la casa): `docs/GDD-pueblo.md` §11.
  Poké Balls: invitar a Pokémon salvajes que rondan por el valle (puede fallar; todas las líneas de la Pokédex, a veces ya evolucionados) y Honor Ball con visitantes: `docs/GDD-pueblo.md` §12.
  Quietos, los Pokémon reproducen su Idle entero en bucle (anim `<id>-Reposo-<dir>`); Bulbasaur, solo su primer fotograma.
  Controles: F, espacio y clic (izq. o der.) son la misma acción (`WorldScene.accion`), por orden:
  aldeano bajo el cursor (elegirlo y luego clic en un árbol/roca/planta = darle trabajo; al visitante, darle
  lo que pide), recoger, Látigo Cepa (cosechar bayas, rama de un árbol, piedra de una roca), en la mesa
  (= almacén) o en la caja de Pelipper (al lado) dejar los recursos y abrir la caja para vender (Pokécoins), en la casa abrir su panel (dormir, cocinar guisos, mejorarla) o sembrar (sembrar crea la tierra
  bajo la semilla; nunca se ara "a secas"). La lluvia riega sola; la tierra mojada (óvalo tenue,
  `Terrain.regar`) solo se ve bajo la semilla, no cuando la planta ya ha brotado; lo sembrado solo crece si se riega (lluvia o Marill asignado a ese prado). Visitantes: llegan con un bocadillo de petición; F a su lado se la das y se unen (`src/data/especies.ts`).
  Stats, niveles (1-100) y evolución de los Pokémon: `src/data/pokedex.ts` (stats base y grupos de
  experiencia oficiales, 3 líneas por tipo; GDD-pueblo §10). Consulta con gráfica: `/pokedex.html` en el
  servidor del juego. Ficha del aldeano en el HUD al pasar el ratón por él.
- **Lab (I+D, estilo dibujo, 2026-10-14):** `lab/` es una versión paralela del juego en el estilo cartoon
  plano de `lab/assets/ref/aldea_dibujo.png` (no pixel art; solo los Pokémon lo son). Servidor `lab`
  (`npm run lab`, http://127.0.0.1:5179/lab/; también http://127.0.0.1:5174/lab/). Todo en `lab/README.md`:
  extractor `lab/tools/extraer.py` (fuente ampliada ×2 con RealESRGAN, `lab/tools/ampliar.py`), elementos recortados en
  `lab/assets/elementos/`, versión SVG por capas (`lab/tools/vectorizar2.py`, `?vector=1`), mapa en `lab/src/mapa.ts`.
  **Camino elegido (2026-10-14):** cada elemento se reinterpreta con Flux.2 Klein manteniendo el estilo (limpio, sin
  artefactos) y se vectoriza: catálogo `lab/assets/elementos_klein/` (`lab/tools/catalogo_klein.py`), **modo por defecto del lab**
  (`?set=original` / `?vector=0` para comparar). Escala: 1 px del dibujo = 1 px de pantalla a zoom 3 (`F = 1/3`).
  Sombras proyectadas: capa aparte `<id>_sombra.png` (máscara de Klein) pintada con opacidad + multiply, para que el Pokémon quede a la sombra.
  `?noche=1`: mapa de noche (Light2D, farolas Klein, Bulbasaur con normales y pipeline cel `src/render/CelPipeline.ts`);
  `?luces=1`: banco de los tipos de luz (`src/render/luces.ts`: farol, vela, hoguera, luna, electrica, espectral, cristal).
  Si gusta, el juego pivota a este estilo. `Terrain` admite paleta/texturas distintas (`OpcionesSuelo`), sin cambios para el juego.
- Maqueta: servidor `bocetos` de `.claude/launch.json` (`python -m http.server 5180`, desde la raíz)
  → http://localhost:5180/docs/art/maqueta-tiles.html (añade `?v=algo` para saltar la caché;
  `?mapa=lagos_prueba` para el mapa de pruebas).
- ComfyUI (generación local): `F:\ComfyUI\ComfyUI_windows_portable`, en 127.0.0.1:8188.
  Arranque: `cd /f/ComfyUI/ComfyUI_windows_portable && ./python_embeded/python.exe -s ComfyUI/main.py --windows-standalone-build --listen 127.0.0.1 --port 8188 --disable-auto-launch`
  (en segundo plano). Las herramientas de `tools/` lo usan vía `tools/comfy.py`.
- Python de `tools/`: ejecutar con `python -I tools/<x>.py` (numpy, scipy, Pillow).

## Reglas del usuario (siempre)
- Hablar en español. Respuestas cortas.
- **Dar siempre los enlaces** a lo hecho: URL de la maqueta + enlaces markdown a los archivos.
- Solo modelos locales en `.safetensors` (GGUF aceptado). Nada de servicios de pago.
- Descargas: pedir permiso antes, diciendo archivo, origen y tamaño.
- Los tokens/credenciales los gestiona el usuario: no pegarlos nunca.
- **No borrar arte**: lo que se descarta se mueve a `assets/gen/descartadas/` o a una carpeta
  `v_*`/`v1_*` junto al original, para poder volver atrás.
- Escenario y Pokémon no se dibujan con formas de código; se generan con IA local o salen de la
  referencia y se procesan. Excepción acordada: losas del camino y matorrales (círculos con
  sombra), que el usuario pidió procedurales.
- Antes de dar algo por hecho, comprobarlo en el navegador (consola sin errores + captura).
