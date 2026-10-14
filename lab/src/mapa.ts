// Mapa del laboratorio: terreno (césped con manchas de arena, para el suelo de Terrain.ts) y dónde
// va cada elemento del dibujo. Posiciones en px de mundo (ancla = base del elemento), pensadas
// para F = 0,5 (mundo 1152×864 = 48×36 casillas).
import type { MapData } from '../../src/data/types';
import { T } from './config';
import { hash } from '../../src/util';

// Las posiciones de abajo se pensaron con F = 0,5 (mundo 1152×864); con F = 1/3 todo se escala por K
// para conservar la composición (mundo 768×576 = 32×24 casillas).
const K = 2 / 3;
export const MW = 32, MH = 28;   // 4 casillas más de alto para los edificios nuevos del set Klein
export const W = MW * T, H = MH * T;

export interface Colocado { id: string; x: number; y: number; flip?: boolean; s?: number; luz?: string }  // luz: tipo (src/render/luces.ts) si lleva

// Manchas de arena (elipses: centro y radios en px de mundo). Terrain pone el borde orgánico.
const ARENA: [number, number, number, number][] = [
  [560, 60, 420, 70],     // franja de arriba, como la playa del dibujo
  [1080, 300, 110, 130],
  [150, 520, 120, 80],
  [900, 520, 150, 90],
  [520, 740, 140, 70],
  [60, 300, 70, 110],
];

export function terreno(): MapData {
  const vert: number[][] = [];
  for (let vy = 0; vy <= MH; vy++) {
    const row: number[] = [];
    for (let vx = 0; vx <= MW; vx++) {
      const x = vx * T, y = vy * T;
      row.push(ARENA.some(([cx, cy, rx, ry]) => ((x - cx * K) / (rx * K)) ** 2 + ((y - cy * K) / (ry * K)) ** 2 < 1) ? 1 : 0);
    }
    vert.push(row);
  }
  return { mw: MW, mh: MH, vert, inicio: [560 * K, 560 * K] };
}

// Elementos grandes (con colisión), a mano (coordenadas de la composición original; se escalan por K).
const FIJOS_ORIG: Colocado[] = [
  { id: 'casa_grande', x: 560, y: 480 },
  { id: 'casa_cabana', x: 250, y: 260 },
  { id: 'casa_larga', x: 850, y: 280 },
  { id: 'casa_chimenea', x: 930, y: 740 },
  { id: 'estanque', x: 270, y: 720 },
  { id: 'piedras_0', x: 712, y: 392 },          // suelo de piedras entre la casa grande y la larga
  { id: 'piedras_0', x: 420, y: 640, flip: true },
  { id: 'piedras_0', x: 820, y: 590 },
  { id: 'arbol_alto', x: 420, y: 190 },
  { id: 'arbol_bajo', x: 700, y: 170, flip: true },
  { id: 'arbol_alto', x: 140, y: 430, flip: true },
  { id: 'arbol_bajo', x: 1060, y: 440 },
  { id: 'arbol_alto', x: 1090, y: 620, flip: true },
  { id: 'arbol_bajo', x: 620, y: 830 },
  { id: 'arbol_alto', x: 110, y: 830 },
  { id: 'arbol_bajo', x: 330, y: 560, flip: true },
  { id: 'arbol_alto', x: 980, y: 140 },
  { id: 'roca_0', x: 375, y: 90 },
  { id: 'roca_2', x: 1010, y: 170, flip: true },
  { id: 'roca_3', x: 120, y: 160 },
  { id: 'roca_4', x: 760, y: 650 },
  { id: 'roca_5', x: 1095, y: 800, flip: true },   // (antes en 830,700: quedaba detrás de la casa de la chimenea)
  { id: 'roca_6', x: 990, y: 460 },
  { id: 'roca_1', x: 130, y: 640 },
  { id: 'roca_7', x: 690, y: 770 },
  { id: 'roca_3', x: 360, y: 350, flip: true, s: 0.8 },
  { id: 'roca_6', x: 230, y: 90, s: 0.9 },
];

export const FIJOS: Colocado[] = FIJOS_ORIG.map(c => ({ ...c, x: Math.round(c.x * K), y: Math.round(c.y * K) }));

// Elementos que solo existen en un catálogo alternativo (?set=...), en huecos del mapa (px de mundo ya escalados).
export const EXTRA: Record<string, Colocado[]> = {
  klein: [
    { id: 'tienda', x: 400, y: 178 },
    { id: 'almacen', x: 150, y: 650 },
    { id: 'pozo', x: 470, y: 420 },
    { id: 'hoguera', x: 360, y: 472 },
    { id: 'tocon', x: 400, y: 530 },
    { id: 'arbusto', x: 650, y: 360 }, { id: 'arbusto', x: 690, y: 372, flip: true },
    { id: 'valla', x: 560, y: 640 }, { id: 'valla', x: 618, y: 640 },
    { id: 'camino_c', x: 160, y: 250 },
    { id: 'camino_d', x: 300, y: 566, flip: true },   // (antes en 620,500: se metía bajo la esquina de la casa de la chimenea)
    { id: 'camino_e', x: 470, y: 578 },
    { id: 'flores', x: 520, y: 300 }, { id: 'flores', x: 150, y: 350, flip: true }, { id: 'flores', x: 700, y: 520 }, { id: 'flores', x: 330, y: 620 },
  ],
};

// Farolas del mapa de noche (?noche=1): junto a los caminos y las puertas (px de mundo ya escalados). De día se ven
// apagadas; de noche cada una lleva una luz cálida en el farol. Solo existen en el set Klein (`farola`, de hierro; `farola_madera`, con el farolillo colgado a la derecha).
export const FAROLAS: Colocado[] = [
  { id: 'farola', x: 300, y: 300 }, { id: 'farola', x: 468, y: 332, flip: true },
  { id: 'farola', x: 540, y: 470 }, { id: 'farola', x: 236, y: 560 },
  { id: 'farola_madera', x: 630, y: 290 }, { id: 'farola_madera', x: 110, y: 410, flip: true },
  { id: 'farola', x: 330, y: 222 }, { id: 'farola_madera', x: 560, y: 590 },
];

// Detalles (flores, matitas, losas sueltas): dispersos por el césped con semilla fija.
export function detalles(ids: string[], libre: (x: number, y: number) => boolean, n = 45): Colocado[] {
  const out: Colocado[] = [];
  for (let i = 0; i < n * 6 && out.length < n; i++) {
    const x = 30 + hash(i * 1.7 + 3, 11.3) * (W - 60), y = 30 + hash(7.1, i * 2.3 + 5) * (H - 60);
    if (!libre(x, y)) continue;
    out.push({ id: ids[Math.floor(hash(i * 0.37, i * 1.91) * ids.length)], x: Math.round(x), y: Math.round(y), flip: hash(i, 0.5) < 0.5 });
  }
  return out;
}
