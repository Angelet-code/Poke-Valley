import { defineConfig, mergeConfig } from 'vite';
import base from './vite.config';

// Jugar por internet desde este PC (`npm run online` + `npm run mp` + un túnel de Cloudflare, docs/GDD-combate.md):
// el mismo servidor sirve el juego y lleva el WebSocket del multijugador por /mp (al servidor de tools/servidor_mp.mjs),
// así los amigos solo necesitan una dirección (https://…/?mp o ?mp=sala). Sin recarga automática (HMR): con el código
// a medio editar, sus pestañas no se recargan solas. Solo atiende a las direcciones del túnel.
export default mergeConfig(base, defineConfig({
  server: {
    port: 5185,
    strictPort: true,
    hmr: false,
    allowedHosts: ['.trycloudflare.com'],
    proxy: { '/mp': { target: 'ws://127.0.0.1:5190', ws: true } },
  },
}));
