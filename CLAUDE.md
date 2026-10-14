# Pokémon Valley

Fangame personal y no comercial: un Stardew Valley en el que juegas con Pokémon (sin humanos,
sin diálogo, sin combate, muy tranquilo). Stack: Phaser 3 + TypeScript + Vite. El juego vive en
`src/` (prototipo 0.1 de recolección, fase 0a del GDD); el arte se sigue probando en la maqueta HTML.

## Leer antes de trabajar
- `docs/GDD.md`: diseño del juego (fuente de verdad).
- `docs/art/PIPELINE.md`: cómo se hace el arte, estado de cada elemento, herramientas con sus
  parámetros exactos y la receta para crear objetos nuevos. **Léelo entero antes de tocar arte.**

## Arrancar
- Juego: servidor `juego` de `.claude/launch.json` (`npm run dev`, Vite en http://127.0.0.1:5174;
  `npm install` la primera vez). **Mapa por defecto (2026-10-14): `dibujo`**, el pueblo del lab en estilo dibujo
  (elementos Klein en SVG, `src/data/mapaDibujo.ts` + `src/render/Dibujo.ts`; casa = `casa_grande`, almacén = `almacen`,
  tienda = caja de Pelipper; 13 farolas y la hoguera se encienden al anochecer con Light2D, `WorldScene.luzDelDia`;
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
  Poké Balls: invitar a Pokémon salvajes que rondan por el valle (puede fallar) y Honor Ball con visitantes: `docs/GDD-pueblo.md` §12.
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
