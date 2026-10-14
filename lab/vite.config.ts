import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

// Laboratorio (I+D) del estilo "dibujo": misma raíz que el juego (para servir /assets/ y poder
// importar ../src/render/Terrain.ts), otro puerto y la página en /lab/.
// Mismas cabeceras COOP/COEP que el juego: el suelo se calcula en varios hilos (SharedArrayBuffer).
const aislado = { 'Cross-Origin-Opener-Policy': 'same-origin', 'Cross-Origin-Embedder-Policy': 'require-corp' };
const raiz = fileURLToPath(new URL('..', import.meta.url));

export default defineConfig({
  root: raiz,
  publicDir: false,
  server: { host: '127.0.0.1', port: 5179, strictPort: true, headers: aislado, open: false },
  preview: { headers: aislado },
  worker: { format: 'es' },
  build: { target: 'es2022' },
});
