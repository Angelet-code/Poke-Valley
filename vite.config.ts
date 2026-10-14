import { defineConfig } from 'vite';

// El juego vive en la raíz del repo: `src/` es el código y `assets/` (sprites PMD, bayas,
// arte generado) se sirve tal cual como `/assets/...`. No se copia nada: Vite sirve los
// archivos de la raíz en desarrollo. Para `vite build` habría que copiar assets/ a dist/.
// Aislamiento entre orígenes (COOP/COEP): permite SharedArrayBuffer, con el que el suelo se
// calcula en varios hilos a la vez (render/Terrain.ts). Al publicar el juego, el servidor tiene
// que mandar estas mismas cabeceras; sin ellas funciona igual, pero calcula en un solo hilo.
const aislado = { 'Cross-Origin-Opener-Policy': 'same-origin', 'Cross-Origin-Embedder-Policy': 'require-corp' };

export default defineConfig({
  publicDir: false,
  server: { host: '127.0.0.1', port: 5174, strictPort: true, headers: aislado },
  preview: { headers: aislado },
  worker: { format: 'es' },
  build: { target: 'es2022' },
});
