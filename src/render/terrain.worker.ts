// Hilo de cálculo del suelo: Terrain.calcular le reparte trozos del mapa. Los campos y la imagen
// están en memoria compartida (SharedArrayBuffer), así que cada trozo se escribe en su sitio y el
// hilo solo contesta "hecho".
import { TerrainCore, type Bufs, type Paleta, type Seed } from './TerrainCore';

type Mensaje =
  | { tipo: 'init'; mw: number; mh: number; S: number; bufs: Bufs; paleta: Paleta }
  | { tipo: 'campos' | 'upd' | 'pintar'; a: number; b: number }
  | { tipo: 'pintura'; seeds: Seed[]; wet: [number, number][]; grass: Uint8ClampedArray; dirt: Uint8ClampedArray; cliff: Uint8ClampedArray; cliffW: number; out: SharedArrayBuffer };

let core: TerrainCore, wet: [number, number][] = [], out: Uint8ClampedArray;

self.onmessage = (e: MessageEvent<Mensaje>) => {
  const m = e.data;
  switch (m.tipo) {
    case 'init': core = new TerrainCore(m.mw, m.mh, m.S, m.bufs, m.paleta); break;
    case 'campos': core.calcularCampos(m.a, m.b); break;                  // filas de mundo
    case 'upd': core.computeUpd(m.a, m.b); break;                         // columnas de pantalla
    case 'pintura':
      core.seeds = m.seeds; core.setTexturas(m.grass, m.dirt, m.cliff, m.cliffW);
      wet = m.wet; out = new Uint8ClampedArray(m.out);
      break;
    case 'pintar': core.pintar(0, m.a, core.SW, m.b, out, 0, 0, core.SW, wet); break; // filas de pantalla
  }
  self.postMessage(0);
};
