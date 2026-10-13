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
  `npm install` la primera vez). `?mapa=aldea_b` elige otro mapa de `docs/art/mapas/`, `?nueva`
  empieza partida nueva. `npm run check` = comprobación de tipos. Código: `src/sim/World.ts`
  (simulación pura: reloj, energía, inventario, plantas, caja de envío, guardado en localStorage),
  `src/render/Terrain.ts` (suelo portado de la maqueta), `src/scenes/*` (Boot → Preload → Title →
  World + UI), `src/data/items.ts` (objetos y precios). En la consola del navegador, `pv` es el juego.
  Controles: clic izq. = Látigo Cepa (solo cosecha); F / espacio / clic der. = recoger, caja, dormir o
  sembrar (sembrar crea la tierra bajo la semilla; nunca se ara "a secas"). La lluvia riega sola; la tierra mojada (óvalo tenue,
  `Terrain.regar`) solo se ve bajo la semilla, no cuando la planta ya ha brotado; el riego manual espera a Marill.
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
