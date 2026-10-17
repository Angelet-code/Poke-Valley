// El pueblo del modo aventura (docs/GDD-mundo.md §1), distribuido por zonas (2026-10-15). El del modo granja sigue en
// mapaDibujo.ts, sin cambios. Mismo tamaño (42×38 casillas). La boca está al norte (2026-10-15): el pueblo queda al
// sur del mundo y el bosque encima (data/mundo.ts), y la salida del bosque al pueblo está abajo.
//
//   ┌─────────────────── bosque ─────────────────────┐
//   │  cabaña     TU CASA    avenida     casa larga  │   ← calle del norte (tierra), con las puertas
//   │      ╲         ╲          │          ╱         │
//   │ chimenea ── PLAZA (hoguera, tablón, pozo) ── tienda
//   │      │                    │              │     │
//   │  HUERTO (6             calle del sur  almacén  │
//   │  parcelas)  estanque      │                    │
//   │      solar                │     solar          │
//   └────────────────────────────────────────────────┘
//
// Suelo: 2 (losas) en la plaza y la avenida principal, 1 (tierra) en las calles y dentro de las parcelas del huerto.
// Las parcelas son corrales de valla con tierra dentro: el sitio para sembrar bayas cuando el modo aventura las tenga.
// Los solares quedan libres (césped) para edificios futuros.
import type { MapData } from './types';
import type { Colocado } from './mapaDibujo';
import { enRellano } from './rellano';

export const T = 24;
export const MW = 42, MH = 38;
export const W = MW * T, H = MH * T;

type P = [number, number];
interface Rect { x0: number; y0: number; x1: number; y1: number }

// ---- Puntos clave (px de mundo) ----
export const PLAZA: P = [504, 470];                 // centro de la plaza
const R_PLAZA = 78;
export const TABLON = { x: 440, y: 452 };           // tablón de misiones, al oeste de la hoguera
export const TENDERO = { x: 838, y: 562 };          // Kecleon, el tendero: delante del mostrador del puesto de la tienda
export const BAYERO = { x: 712, y: 468 };           // Aipom, el obseso de las bayas: en el césped al este de la plaza, junto al camino a la tienda
export const MUNECO = { x: 650, y: 585 };           // el muñeco de prácticas (Sudowoodo): césped al sureste de la plaza, junto al camino a la tienda
export const INICIO: P = [504, 540];                // donde apareces (en la plaza, al sur de la hoguera)
export const SALIDA_X: [number, number] = [520, 600]; // boca norte del pueblo (al bosque)
export const SALIDA_ESTE_Y: [number, number] = [314, 374]; // boca este (a la ciudad, 2026-10-16): la calle del norte sigue hasta el borde
export const RELLANO_PUEBLO: P = [724, 150];          // rellano de vuelo, a la derecha de la boca norte (data/rellano.ts)
// Parcelas del huerto (centro de cada corral) y solares libres para construir.
export const PARCELAS: P[] = [[150, 640], [222, 640], [294, 640], [150, 712], [222, 712], [294, 712]];
export const SOLARES: Rect[] = [{ x0: 640, y0: 760, x1: 900, y1: 870 }, { x0: 330, y0: 760, x1: 480, y1: 870 }];

// ---- Calles (polilíneas) ----
const AVENIDA: P[] = [[560, -10], [562, 120], [552, 240], [536, 334], [516, 400]];                        // losas: boca norte → plaza
const CALLES: P[][] = [
  [[110, 334], [300, 330], [470, 326], [640, 330], [900, 334], [960, 342], [1030, 344]],   // calle del norte, delante de las puertas, hasta la boca este
  [[510, 540], [540, 640], [556, 780]],                              // calle del sur: plaza → solares
  [[566, 168], [640, 160], [680, 154]],                              // avenida → rellano de vuelo
  [[582, 478], [700, 500], [780, 548], [800, 620], [800, 780]],      // plaza → tienda → almacén
  [[426, 478], [330, 520], [262, 560], [222, 600]],                  // plaza → huerto
  [[330, 520], [250, 500], [190, 500]],                              // → casa de la chimenea
  [[222, 600], [360, 600], [430, 700], [540, 700]],                  // huerto → avenida (pasando junto al estanque)
];

function distSeg(x: number, y: number, [ax, ay]: P, [bx, by]: P): number {
  const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy, t = l2 ? Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / l2)) : 0;
  return Math.hypot(x - ax - t * dx, y - ay - t * dy);
}
const distLinea = (x: number, y: number, l: P[]) => Math.min(...l.slice(1).map((b, i) => distSeg(x, y, l[i], b)));
// Ondulación suave del borde de las calles (que no queden como tubos).
const onda = (x: number, y: number) => Math.sin(x * 0.031 + y * 0.017) * 3 + Math.sin(x * 0.011 - y * 0.027) * 2;

export function terrenoPueblo(): MapData {
  const vert: number[][] = [];
  for (let vy = 0; vy <= MH; vy++) {
    const fila: number[] = [];
    for (let vx = 0; vx <= MW; vx++) {
      const x = vx * T, y = vy * T, o = onda(x, y);
      const plaza = Math.hypot(x - PLAZA[0], (y - PLAZA[1]) * 1.25) < R_PLAZA + o;
      const avenida = distLinea(x, y, AVENIDA) < 26 + o;
      const calle = CALLES.some(l => distLinea(x, y, l) < 17 + o);
      // El huerto: una mancha de tierra orgánica bajo los seis corrales (no casillas rectangulares).
      const parcela = Math.hypot((x - 222) / 140, (y - 664) / 78) < 1 + o * 0.03;
      const rellano = enRellano({ x: RELLANO_PUEBLO[0], y: RELLANO_PUEBLO[1] }, x, y, -14 + o);
      fila.push(plaza || avenida || rellano ? 2 : calle || parcela ? 1 : 0);
    }
    vert.push(fila);
  }
  return { mw: MW, mh: MH, vert, inicio: INICIO, entrada: [560, 20], solares: SOLARES.map(s => [s.x0, s.y0, s.x1, s.y1]) };
}

// ---- Lo colocado ----
const EDIFICIOS: Colocado[] = [
  // Calle del norte: las puertas dan a la calle (quedan ~30 px a la izquierda y ~15 por encima del pie de la casa).
  // Entre tu casa y la casa larga, la avenida sube a la boca norte.
  { id: 'casa_cabana', x: 190, y: 306 },
  { id: 'casa_grande', x: 380, y: 304, rol: 'casa' },     // tu casa, al noroeste de la plaza
  { id: 'casa_larga', x: 800, y: 306 },
  // Oeste: la casa de la chimenea. Este: el mercado.
  { id: 'casa_chimenea', x: 150, y: 486 },
  { id: 'tienda', x: 836, y: 540, rol: 'tienda' },
  { id: 'almacen', x: 850, y: 744, rol: 'almacen' },
];
const PLAZA_COSAS: Colocado[] = [
  { id: 'hoguera', x: PLAZA[0], y: PLAZA[1] + 6 },
  { id: 'pozo', x: 574, y: 452 },
  // Farolas alrededor de la plaza y a la entrada de cada calle.
  { id: 'farola', x: 436, y: 404 }, { id: 'farola', x: 574, y: 404, flip: true },
  { id: 'farola', x: 432, y: 530 }, { id: 'farola', x: 580, y: 530, flip: true },
  { id: 'farola_madera', x: 640, y: 352 }, { id: 'farola_madera', x: 284, y: 352, flip: true },
  { id: 'farola_madera', x: 760, y: 610 }, { id: 'farola_madera', x: 300, y: 560, flip: true },
  { id: 'farola', x: 514, y: 176 }, { id: 'farola', x: 606, y: 176, flip: true },   // boca del pueblo
  { id: 'farola', x: 520, y: 700 },
  { id: 'poste', x: 500, y: 130 },
];
// Huerto: un corral de valla por parcela (con tierra dentro), el estanque para regar y algún detalle.
const HUERTO: Colocado[] = [
  ...PARCELAS.map(([x, y]) => ({ id: 'valla', x, y })),
  { id: 'estanque', x: 380, y: 680 },
  { id: 'tocon', x: 96, y: 590 }, { id: 'arbusto', x: 100, y: 760 }, { id: 'flores', x: 340, y: 620 },
];
// Verde: árboles en grupos por los rincones y entre zonas, arbustos junto a las casas, flores a los lados de las calles.
const VERDE: Colocado[] = [
  { id: 'arbol_alto', x: 260, y: 248 }, { id: 'arbusto', x: 652, y: 236, flip: true },   // un árbol aquí taparía el rellano de vuelo
  { id: 'arbol_alto', x: 660, y: 440 }, { id: 'arbol_bajo', x: 690, y: 690, flip: true },
  { id: 'arbol_alto', x: 340, y: 450, flip: true }, { id: 'arbol_bajo', x: 440, y: 800 },
  { id: 'arbusto', x: 300, y: 300 }, { id: 'arbusto', x: 640, y: 296, flip: true }, { id: 'arbusto', x: 940, y: 640 },
  { id: 'flores', x: 470, y: 360 }, { id: 'flores', x: 610, y: 600, flip: true }, { id: 'flores', x: 460, y: 620 },
  { id: 'flores', x: 760, y: 380 }, { id: 'flores', x: 250, y: 380, flip: true }, { id: 'flores', x: 620, y: 760 },
  { id: 'roca_4', x: 720, y: 830 }, { id: 'roca_6', x: 860, y: 860, s: 0.8 }, { id: 'roca_1', x: 380, y: 840, s: 0.8 },
  { id: 'tocon', x: 700, y: 400 },
];
// Borde: dos filas de árboles (y alguna roca) alrededor, con la boca del norte y la del este libres.
function borde(): Colocado[] {
  const out: Colocado[] = [];
  let n = 0;
  const id = () => (n++ % 3 === 0 ? 'arbol_bajo' : 'arbol_alto');
  for (let x = 20; x <= W - 10; x += 44) {
    if (x < SALIDA_X[0] - 70 || x > SALIDA_X[1] + 30) out.push({ id: id(), x, y: 40 + (n % 2) * 14, flip: n % 2 === 0 });
    if (x + 22 < SALIDA_X[0] - 50 || x + 22 > SALIDA_X[1] + 40) out.push({ id: id(), x: x + 22, y: 96 + (n % 3) * 8 });
    out.push({ id: id(), x, y: H + 10 - (n % 2) * 10, flip: n % 2 === 1 });
  }
  for (let y = 150; y <= H - 30; y += 46) {
    const este = y > SALIDA_ESTE_Y[0] - 30 && y < SALIDA_ESTE_Y[1] + 40;   // la boca este
    out.push({ id: id(), x: 24 + (n % 2) * 8, y });
    if (!este) out.push({ id: id(), x: W - 20 - (n % 2) * 8, y, flip: true });
    // Fila interior, salvo donde están la casa de la chimenea y el huerto (oeste) y el mercado (este).
    if (y < 360 || y > 800) out.push({ id: id(), x: 64, y: y + 22, flip: true });
    if ((y < 400 || y > 820) && !(y + 22 > SALIDA_ESTE_Y[0] - 30 && y + 22 < SALIDA_ESTE_Y[1] + 40)) out.push({ id: id(), x: W - 62, y: y + 22 });
  }
  out.push({ id: 'roca_0', x: 120, y: 880, s: 0.9 }, { id: 'roca_2', x: 940, y: 190, s: 0.8 }, { id: 'roca_5', x: 70, y: 200 });
  return out;
}

export const COLOCADOS_PUEBLO: Colocado[] = [...EDIFICIOS, ...PLAZA_COSAS, ...HUERTO, ...VERDE, ...borde()];
