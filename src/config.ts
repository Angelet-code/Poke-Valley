// Constantes globales de presentación (GDD §15): casilla de 24 px, resolución base 480×270
// escalada a un zoom entero S que quepa en la ventana.
export const A = '/assets/';
export const VW = 480, VH = 270;
export const S = Math.max(1, Math.floor(Math.min(innerWidth / VW, innerHeight / VH)));

const params = new URLSearchParams(location.search);
export const MAPA = params.get('mapa') || 'aldea_a';
export const NUEVA = params.has('nueva');

// Claves del registro de Phaser donde Boot deja los datos cargados.
export const REG = { mapa: 'mapa', objs: 'objs', bayas: 'bayas', anims: 'anims' } as const;

// Animaciones PMD (AnimData.xml) que usamos: ancho/alto de fotograma y duraciones (en 1/60 s).
export interface AnimInfo { fw: number; fh: number; durs: number[] }
export type AnimSet = Record<string, AnimInfo>;

// Fila de la hoja PMD según el ángulo de movimiento (8 direcciones): 0 abajo, 1 abajo-der,
// 2 der, 3 arriba-der, 4 arriba, 5 arriba-izq, 6 izq, 7 abajo-izq.
export const ROW_FROM_ANGLE = [2, 1, 0, 7, 6, 5, 4, 3];
export const DIR_VEC: [number, number][] = [[0, 1], [1, 1], [1, 0], [1, -1], [0, -1], [-1, -1], [-1, 0], [-1, 1]];
