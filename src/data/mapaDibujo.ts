// Mapa «dibujo» (?mapa=dibujo, el de por defecto desde 2026-10-14): el pueblo del lab (lab/src/mapa.ts) con los
// elementos reinterpretados con Flux.2 Klein y vectorizados (lab/assets/elementos_klein/, vector/elementos_klein/),
// llevado al juego. La composición del lab se conserva (desplazada por OX, OY) y alrededor se añade sitio para
// jugar: un prado al sur con la entrada del valle (por donde llegan los visitantes), bosque y rocas en los bordes
// (madera y piedra) y más farolas, que se encienden al caer la noche (WorldScene.luzDelDia).
import type { MapData } from './types';
import type { Paleta } from '../render/TerrainCore';
import { hash } from '../util';
import { ARCANE } from '../config';

export const T = 24;
export const MW = 42, MH = 38;
export const W = MW * T, H = MH * T;
const OX = 96, OY = 48;          // dónde cae el (0, 0) del mapa del lab
const K = 2 / 3;                 // las posiciones del lab se pensaron con F = 0,5 (como allí)

// Px de mundo por px del dibujo de referencia (como el lab: a zoom 3, 1 px del dibujo = 1 px de pantalla).
export const F = 1 / 3;
export const PNG_X = 2;          // los PNG de elementos están a ×2 del dibujo

// Colores del suelo medidos en el dibujo (los mismos que LabScene).
const PALETA_KLEIN: Paleta = {
  grassTones: [[164, 186, 122], [178, 196, 134]], dirtTones: [[212, 190, 116], [228, 206, 134]],
  stone: [214, 206, 170], stoneLight: [232, 226, 192], crack: [178, 158, 124], dirtMean: [218, 194, 126],
  water: [87, 180, 185], waterTones: [[70, 164, 176], [110, 196, 200]], waterShadow: [62, 142, 160], shoreDark: [62, 84, 64], shoreLight: [214, 204, 140],
  sinPared: true,   // la pared de roca del agua es pixel art: aquí el agua acaba en la línea de orilla (lago del modo aventura)
};
// Estilo Arcane (?set=arcane, docs/art/ARCANE.md): tonos medidos en las texturas de lab/assets/suelo_arcane/ y el agua,
// la arena y la línea de tinta de la orilla en la referencia docs/art/ref/arcane_lago.png.
const PALETA_ARCANE: Paleta = {
  grassTones: [[112, 118, 86], [140, 146, 106]], dirtTones: [[190, 158, 116], [214, 182, 138]],
  stone: [176, 166, 146], stoneLight: [200, 190, 166], crack: [120, 104, 86], dirtMean: [205, 172, 130],
  water: [78, 116, 125], waterTones: [[64, 100, 110], [100, 136, 144]], waterShadow: [52, 82, 92], shoreDark: [38, 36, 34], shoreLight: [214, 184, 140],
  sinPared: true,
};
export const PALETA_DIBUJO: Paleta = ARCANE ? PALETA_ARCANE : PALETA_KLEIN;

// rol: lo que hace en el juego (casa = tu casa, panel de dormir/cocinar; almacen = donde se dejan los recursos;
// tienda = la caja de Pelipper, para vender). luz: tipo (src/render/luces.ts) de las farolas.
export interface Colocado { id: string; x: number; y: number; flip?: boolean; s?: number; luz?: string; rol?: 'casa' | 'almacen' | 'tienda';
  tira?: { hasta: number; inserto?: string; en?: number } }   // una tira entera (muro, valla, puente…): Dibujo.expandirTiras

// Manchas de arena del lab (centro y radios, coordenadas de su composición original) y alguna nueva.
const ARENA_LAB: [number, number, number, number][] = [
  [560, 60, 420, 70], [1080, 300, 110, 130], [150, 520, 120, 80], [900, 520, 150, 90], [520, 740, 140, 70], [60, 300, 70, 110],
];
const ARENA_MAS: [number, number, number, number][] = [
  [560, 905, 60, 40],    // la boca del camino del sur, por donde se entra al valle
];

export function terrenoDibujo(): MapData {
  const elipses = [...ARENA_LAB.map(([x, y, rx, ry]) => [x * K + OX, y * K + OY, rx * K, ry * K]), ...ARENA_MAS];
  const vert: number[][] = [];
  for (let vy = 0; vy <= MH; vy++) {
    const row: number[] = [];
    for (let vx = 0; vx <= MW; vx++) {
      const x = vx * T, y = vy * T;
      row.push(elipses.some(([cx, cy, rx, ry]) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 < 1) ? 1 : 0);
    }
    vert.push(row);
  }
  return { mw: MW, mh: MH, vert, inicio: [469, 400], entrada: [560, H - 20], solares: [[300, 740, 820, 870]] };
}

// La composición del lab (lab/src/mapa.ts: FIJOS a escala K, EXTRA.klein y FAROLAS), tal cual.
const LAB_ORIG: Colocado[] = [
  { id: 'casa_grande', x: 560, y: 480, rol: 'casa' },
  { id: 'casa_cabana', x: 250, y: 260 },
  { id: 'casa_larga', x: 850, y: 280 },
  { id: 'casa_chimenea', x: 930, y: 740 },
  { id: 'estanque', x: 270, y: 720 },
  { id: 'piedras_0', x: 712, y: 392 }, { id: 'piedras_0', x: 420, y: 640, flip: true }, { id: 'piedras_0', x: 820, y: 590 },
  { id: 'arbol_alto', x: 420, y: 190 }, { id: 'arbol_bajo', x: 700, y: 170, flip: true }, { id: 'arbol_alto', x: 140, y: 430, flip: true },
  { id: 'arbol_bajo', x: 1060, y: 440 }, { id: 'arbol_alto', x: 1090, y: 620, flip: true }, { id: 'arbol_bajo', x: 620, y: 830 },
  { id: 'arbol_alto', x: 110, y: 830 }, { id: 'arbol_bajo', x: 330, y: 560, flip: true }, { id: 'arbol_alto', x: 980, y: 140 },
  { id: 'roca_0', x: 375, y: 90 }, { id: 'roca_2', x: 1010, y: 170, flip: true }, { id: 'roca_3', x: 120, y: 160 },
  { id: 'roca_4', x: 760, y: 650 }, { id: 'roca_5', x: 1095, y: 800, flip: true }, { id: 'roca_6', x: 990, y: 460 },
  { id: 'roca_1', x: 130, y: 640 }, { id: 'roca_7', x: 690, y: 770 }, { id: 'roca_3', x: 360, y: 350, flip: true, s: 0.8 },
  { id: 'roca_6', x: 230, y: 90, s: 0.9 },
];
const LAB_ESCALADO: Colocado[] = [
  { id: 'tienda', x: 400, y: 178, rol: 'tienda' },
  { id: 'almacen', x: 150, y: 650, rol: 'almacen' },
  { id: 'pozo', x: 470, y: 420 },
  { id: 'hoguera', x: 360, y: 472 },
  { id: 'tocon', x: 400, y: 530 },
  { id: 'arbusto', x: 650, y: 360 }, { id: 'arbusto', x: 690, y: 372, flip: true },
  { id: 'valla', x: 560, y: 640 }, { id: 'valla', x: 618, y: 640 },
  { id: 'camino_c', x: 160, y: 250 },
  { id: 'camino_d', x: 300, y: 566, flip: true },
  { id: 'camino_e', x: 470, y: 578 },
  { id: 'flores', x: 520, y: 300 }, { id: 'flores', x: 150, y: 350, flip: true }, { id: 'flores', x: 700, y: 520 }, { id: 'flores', x: 330, y: 620 },
  // Farolas del lab (junto a los caminos y las puertas).
  { id: 'farola', x: 300, y: 300 }, { id: 'farola', x: 468, y: 332, flip: true },
  { id: 'farola', x: 540, y: 470 }, { id: 'farola', x: 236, y: 560 },
  { id: 'farola_madera', x: 630, y: 290 }, { id: 'farola_madera', x: 110, y: 410, flip: true },
  { id: 'farola', x: 330, y: 222 }, { id: 'farola_madera', x: 560, y: 590 },
];

// Lo nuevo del juego (px de mundo finales): más farolas por el pueblo, el camino de entrada del sur y, en los
// bordes, árboles y rocas de los que sacar madera y piedra.
const NUEVOS: Colocado[] = [
  // Farolas: junto al almacén, la tienda, la casa de la chimenea y a los dos lados de la entrada del valle.
  { id: 'farola', x: 352, y: 728 }, { id: 'farola_madera', x: 598, y: 238 }, { id: 'farola', x: 806, y: 600, flip: true },
  { id: 'farola', x: 520, y: 878 }, { id: 'farola', x: 602, y: 878, flip: true },
  // Camino de entrada: losas sueltas del prado del sur hacia el pueblo.
  { id: 'camino_e', x: 560, y: 860 }, { id: 'camino_d', x: 548, y: 770, flip: true },
  // Bosque del borde izquierdo y derecho.
  { id: 'arbol_alto', x: 36, y: 170 }, { id: 'arbol_bajo', x: 40, y: 330, flip: true }, { id: 'arbol_alto', x: 30, y: 520 },
  { id: 'arbol_bajo', x: 44, y: 700 }, { id: 'arbol_alto', x: 70, y: 880, flip: true },
  { id: 'arbol_alto', x: 960, y: 120, flip: true }, { id: 'arbol_bajo', x: 980, y: 300 }, { id: 'arbol_alto', x: 950, y: 500 },
  { id: 'arbol_bajo', x: 975, y: 690, flip: true }, { id: 'arbol_alto', x: 940, y: 880 },
  // Prado del sur: un par de árboles y rocas, dejando sitio para construir.
  { id: 'arbol_bajo', x: 200, y: 870 }, { id: 'arbol_alto', x: 860, y: 790, flip: true },
  { id: 'roca_2', x: 250, y: 790 }, { id: 'roca_6', x: 880, y: 880, s: 0.9 }, { id: 'roca_4', x: 990, y: 400, flip: true },
  { id: 'roca_7', x: 120, y: 790, s: 0.8 },
];

const ajusta = (c: Colocado, k: number): Colocado => ({ ...c, x: Math.round(c.x * k + OX), y: Math.round(c.y * k + OY) });
export const COLOCADOS: Colocado[] = [...LAB_ORIG.map(c => ajusta(c, K)), ...LAB_ESCALADO.map(c => ajusta(c, 1)), ...NUEVOS];

// Detalles (flores, matitas): dispersos por el césped con semilla fija, donde `libre` deje.
export function detalles(ids: string[], libre: (x: number, y: number) => boolean, n = 70): Colocado[] {
  const out: Colocado[] = [];
  for (let i = 0; i < n * 6 && out.length < n; i++) {
    const x = 30 + hash(i * 1.7 + 3, 11.3) * (W - 60), y = 30 + hash(7.1, i * 2.3 + 5) * (H - 60);
    if (!libre(x, y)) continue;
    out.push({ id: ids[Math.floor(hash(i * 0.37, i * 1.91) * ids.length)], x: Math.round(x), y: Math.round(y), flip: hash(i, 0.5) < 0.5 });
  }
  return out;
}
