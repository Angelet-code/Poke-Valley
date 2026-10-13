import { defineConfig } from 'vite';

// El juego vive en la raíz del repo: `src/` es el código y `assets/` (sprites PMD, bayas,
// arte generado) se sirve tal cual como `/assets/...`. No se copia nada: Vite sirve los
// archivos de la raíz en desarrollo. Para `vite build` habría que copiar assets/ a dist/.
export default defineConfig({
  publicDir: false,
  server: { host: '127.0.0.1', port: 5174, strictPort: true },
  build: { target: 'es2022' },
});
