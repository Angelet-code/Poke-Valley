// Constantes globales de presentación (GDD §15): casilla de 24 px, resolución base 480×270
// escalada a un zoom entero S que quepa en la ventana; luego la vista se estira a la ventana entera
// (VW×VH crece con la proporción de la ventana, sin márgenes).
export const A = '/assets/';
export const S = Math.max(1, Math.floor(Math.min(innerWidth / 480, innerHeight / 270)));
export const VW = Math.max(480, Math.ceil(innerWidth / S)), VH = Math.max(270, Math.ceil(innerHeight / S));

const params = new URLSearchParams(location.search);
export const MAPA = params.get('mapa') || 'dibujo'; // dibujo = el pueblo en el estilo del lab (src/data/mapaDibujo.ts); aldea_d = el pueblo pixel art
// Mapa en estilo dibujo: elementos Klein vectoriales, suelo con la paleta del dibujo, farolas y luz del día (Light2D).
export const DIBUJO = MAPA === 'dibujo';
export const NUEVA = params.has('nueva');
// ?modo=granja: el juego de antes (pueblo con aldeanos, cultivos y construcción). Sin él, el modo aventura
// (combate en tiempo real y capturas, docs/GDD-combate.md), el de por defecto desde 2026-10-14.
export const GRANJA = params.get('modo') === 'granja';
// ?galeria: galería de animaciones de movimientos (scenes/Galeria.ts) en lugar del título.
export const GALERIA = params.has('galeria');
// ?zona=<mapa>: entra directo a ese mapa del modo aventura sin pasar por el título (p. ej. ?zona=ciudad).
export const ZONA = params.get('zona');
// El escenario va en estilo Arcane (docs/art/ARCANE.md), el de siempre desde 2026-10-15: catálogo
// lab/assets/elementos_arcane/ (lo que aún no tenga sale del catálogo dibujo), suelo con lab/assets/suelo_arcane/ y
// PALETA_ARCANE. ?set=dibujo vuelve al estilo dibujo, solo para comparar.
export const ARCANE = params.get('set') !== 'dibujo';

// Claves del registro de Phaser donde Boot deja los datos cargados.
export const REG = { mapa: 'mapa', objs: 'objs', bayas: 'bayas', anims: 'anims', animsAldeanos: 'animsAldeanos', pelipper: 'animsPelipper', dibujo: 'dibujo' } as const;
// Pelipper (no es aldeano): trae las Pokécoins de la caja al amanecer (WorldScene.pelipperTrae).
export const PELIPPER_DEX = '0279';

// Especies que pueden vivir en el pueblo → carpeta PMD en assets/sprites/pokemon/.
export { ESPECIES } from './data/especies';

// Animaciones PMD (AnimData.xml) que usamos: ancho/alto de fotograma y duraciones (en 1/60 s).
export interface AnimInfo { fw: number; fh: number; durs: number[] }
export type AnimSet = Record<string, AnimInfo>;

// Fila de la hoja PMD según el ángulo de movimiento (8 direcciones): 0 abajo, 1 abajo-der,
// 2 der, 3 arriba-der, 4 arriba, 5 arriba-izq, 6 izq, 7 abajo-izq.
export const ROW_FROM_ANGLE = [2, 1, 0, 7, 6, 5, 4, 3];
export const DIR_VEC: [number, number][] = [[0, 1], [1, 1], [1, 0], [1, -1], [0, -1], [-1, -1], [-1, 0], [-1, 1]];
