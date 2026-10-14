// Formas reconocibles para las firmas: un puño para los puñetazos, colmillos para los mordiscos, una rueda para Rueda
// Fuego… Dibujos vectoriales en coordenadas unidad (≈ −1…1, x hacia delante = hacia el objetivo, y hacia abajo) que
// se pintan con un estilo de dibujo animado (relleno, borde y brillo) a cualquier tamaño y ángulo, y cuyo contorno se
// puede muestrear para soltar partículas por él (un puño de fuego = el puño relleno de fuego y llamas por su borde).
// Galería: ?formas (scenes/Galeria.ts las enseña todas).
import type { Vec } from '../fx/engine';

type P = [number, number];
/** Una figura: polígonos rellenos (suaves o con picos), líneas de detalle y círculos. */
interface Dibujo {
  cuerpo: { pts: P[]; suave?: boolean; relleno?: 'base' | 'claro' | 'oscuro' | 'blanco' }[];
  lineas?: P[][];
  circulos?: { c: P; r: number; relleno: 'base' | 'claro' | 'oscuro' | 'blanco' | 'borde' }[];
}

const arco = (cx: number, cy: number, rx: number, ry: number, a0: number, a1: number, n = 10): P[] =>
  Array.from({ length: n + 1 }, (_, i) => { const a = a0 + (a1 - a0) * i / n; return [cx + Math.cos(a) * rx, cy + Math.sin(a) * ry] as P; });

// Un zarpazo: curva de arriba a la izquierda a abajo a la derecha, desplazada `d` en perpendicular, ancha en el medio.
function zarpazo(d: number): P[] {
  const n = 14, izq: P[] = [], der: P[] = [];
  for (let k = 0; k <= n; k++) {
    const t = k / n, x = -0.85 + 1.7 * t, y = -0.85 + 1.7 * t - 0.35 * Math.sin(Math.PI * t), w = 0.13 * Math.sin(Math.PI * Math.min(1, t * 1.15));
    const nx = 0.7071, ny = -0.7071;   // perpendicular a la diagonal
    izq.push([x + nx * (d + w), y + ny * (d + w)]); der.push([x + nx * (d - w), y + ny * (d - w)]);
  }
  return [...izq, ...der.reverse()];
}

const FORMAS = {
  // Puño de lado, nudillos hacia delante: muñeca, dorso, cuatro dedos doblados (uno por fila) y el pulgar cruzado.
  puno: {
    cuerpo: [
      { pts: [[-1.08, -0.3], [-0.45, -0.32], [-0.45, 0.34], [-1.08, 0.32]], suave: false, relleno: 'oscuro' },
      { pts: [[-0.62, -0.5], [-0.2, -0.68], [0.25, -0.64], [0.3, 0.58], [-0.2, 0.66], [-0.62, 0.5]], suave: true },
      ...[-0.47, -0.17, 0.13, 0.42].map((y, i) => ({ pts: [[0.0, y - 0.15], [0.55 + (i === 1 || i === 2 ? 0.08 : 0), y - 0.16], [0.74 + (i === 1 || i === 2 ? 0.08 : 0), y], [0.55 + (i === 1 || i === 2 ? 0.08 : 0), y + 0.16], [0.0, y + 0.15]] as P[], suave: true })),
      { pts: [[-0.42, 0.2], [0.05, 0.12], [0.42, 0.2], [0.5, 0.36], [0.35, 0.48], [-0.1, 0.5], [-0.42, 0.44]], suave: true, relleno: 'claro' },
    ],
    lineas: [[[-0.25, -0.5], [-0.1, -0.2]]],
  },
  // Mano abierta (Palmeo, Sorpresa): palma de frente, dedos hacia delante.
  mano: {
    cuerpo: [
      { pts: [[-0.75, -0.3], [-0.1, -0.42], [0.3, -0.36], [0.35, 0.36], [-0.1, 0.42], [-0.75, 0.32]], suave: true },
      ...[-0.27, -0.09, 0.09, 0.27].map((y, i) => ({ pts: [[0.25, y - 0.08], [0.6 + (i === 1 || i === 2 ? 0.12 : 0), y - 0.07], [0.72 + (i === 1 || i === 2 ? 0.12 : 0), y], [0.6 + (i === 1 || i === 2 ? 0.12 : 0), y + 0.07], [0.25, y + 0.08]] as P[], suave: true })),
      { pts: [[-0.2, -0.38], [0.05, -0.62], [0.22, -0.7], [0.3, -0.6], [0.12, -0.36]], suave: true },
    ],
  },
  // Pie de lado (patadas), la planta abajo y los dedos delante.
  pie: {
    cuerpo: [
      { pts: [[-0.45, -0.95], [0.05, -0.95], [0.1, -0.1], [0.55, 0.0], [0.85, 0.12], [0.92, 0.35], [0.8, 0.52], [-0.4, 0.52], [-0.5, 0.2]], suave: true },
      { pts: [[-0.48, 0.38], [0.86, 0.38], [0.8, 0.55], [-0.42, 0.56]], relleno: 'oscuro' },
    ],
    lineas: [[[0.55, 0.05], [0.58, 0.36]], [[0.72, 0.12], [0.74, 0.36]]],
  },
  // Colmillos: mandíbula de arriba y de abajo (se cierran con `apertura`, ver mandibula()).
  colmillos: { cuerpo: [] },
  // Tres zarpazos: trazos curvos que se afinan en las puntas (Garra Dragón, Cuchillada, Golpes Furia).
  garras: { cuerpo: [-1, 0, 1].map(i => ({ pts: zarpazo(i * 0.42) })) },
  // Rueda: aro, radios y buje (Rueda Fuego, Giro Rápido).
  rueda: {
    cuerpo: [
      { pts: [...arco(0, 0, 1, 1, 0, Math.PI * 2, 32), ...arco(0, 0, 0.72, 0.72, Math.PI * 2, 0, 32)] },
      { pts: arco(0, 0, 0.2, 0.2, 0, Math.PI * 2, 12), relleno: 'oscuro' },
      ...[0, 1, 2, 3, 4, 5].map(i => { const a = i * Math.PI / 3, s = 0.07; return { pts: [[Math.cos(a - s) * 0.2, Math.sin(a - s) * 0.2], [Math.cos(a - s * 0.4) * 0.74, Math.sin(a - s * 0.4) * 0.74], [Math.cos(a + s * 0.4) * 0.74, Math.sin(a + s * 0.4) * 0.74], [Math.cos(a + s) * 0.2, Math.sin(a + s) * 0.2]] as P[], relleno: 'claro' as const }; }),
    ],
  },
  // Cuerno curvado con la punta hacia delante y arriba.
  cuerno: {
    cuerpo: [{ pts: [[-0.8, -0.32], [-0.2, -0.42], [0.35, -0.55], [0.75, -0.75], [1.0, -0.98], [0.82, -0.52], [0.45, -0.18], [-0.1, 0.12], [-0.8, 0.3]] }],
    lineas: [[[-0.35, -0.38], [-0.3, 0.2]], [[0.1, -0.48], [0.18, -0.04]], [[0.48, -0.62], [0.55, -0.32]]],
  },
  // Pico abierto (Picotazo, Pico Taladro).
  pico: {
    cuerpo: [
      { pts: [[-0.75, -0.42], [0.0, -0.4], [0.6, -0.2], [1.0, 0.05], [0.2, 0.0], [-0.75, 0.06]], suave: true },
      { pts: [[-0.75, 0.12], [0.15, 0.1], [0.75, 0.2], [0.1, 0.38], [-0.75, 0.38]], suave: true, relleno: 'oscuro' },
    ],
    circulos: [{ c: [-0.45, -0.2], r: 0.07, relleno: 'borde' }],
  },
  // Taladro: cono con la espiral marcada (Pico Taladro, Taladradora, Perforador).
  taladro: {
    cuerpo: [{ pts: [[-0.8, -0.5], [1.0, 0], [-0.8, 0.5]] }, { pts: [[-1.0, -0.38], [-0.8, -0.5], [-0.8, 0.5], [-1.0, 0.38]], relleno: 'oscuro' }],
    lineas: [[[-0.55, -0.43], [-0.35, 0.38]], [[-0.15, -0.32], [0.05, 0.27]], [[0.25, -0.2], [0.42, 0.15]], [[0.6, -0.1], [0.72, 0.07]]],
  },
  // Aguijón / aguja (Picotazo Veneno, Pin Misil, Aguijón Letal).
  aguja: { cuerpo: [{ pts: [[-1, -0.14], [0.2, -0.1], [1, 0], [0.2, 0.1], [-1, 0.14]], suave: false }, { pts: [[-1, -0.14], [-0.6, -0.12], [-0.6, 0.12], [-1, 0.14]], relleno: 'oscuro' }] },
  // Ala con plumas (Ataque Ala, Ala de Acero, Pájaro Osado).
  ala: {
    cuerpo: [{ pts: [[-0.9, -0.2], [-0.4, -0.7], [0.3, -0.85], [0.95, -0.6], [0.75, -0.4], [0.85, -0.25], [0.55, -0.1], [0.65, 0.08], [0.3, 0.12], [0.35, 0.32], [-0.05, 0.3], [-0.1, 0.5], [-0.5, 0.35], [-0.85, 0.2]], suave: true }],
    lineas: [[[-0.7, -0.05], [0.7, -0.5]], [[-0.4, 0.15], [0.4, -0.05]], [[-0.3, 0.32], [0.2, 0.2]]],
  },
  // Pluma (Danza Pluma, Respiro).
  pluma: {
    cuerpo: [{ pts: [[-1, 0], [-0.6, -0.22], [0, -0.32], [0.6, -0.22], [1, 0], [0.6, 0.2], [0, 0.3], [-0.6, 0.2]], suave: true }],
    lineas: [[[-1.1, 0.02], [1, 0]], ...[-0.5, -0.1, 0.3, 0.6].flatMap(x => [[[x, 0], [x + 0.25, -0.24]] as P[], [[x, 0], [x + 0.25, 0.22]] as P[]])],
  },
  // Hoja con nervio (Hoja Afilada, Hoja Mágica, Lluevehojas).
  hoja: {
    cuerpo: [{ pts: [[-1, 0], [-0.5, -0.38], [0.2, -0.45], [1, 0], [0.2, 0.45], [-0.5, 0.38]], suave: true }],
    lineas: [[[-1.1, 0], [0.9, 0]], [[-0.3, 0], [0, -0.3]], [[-0.3, 0], [0, 0.3]], [[0.25, 0], [0.45, -0.25]], [[0.25, 0], [0.45, 0.25]]],
  },
  // Gota (Pistola Agua, Hidrobomba).
  gota: { cuerpo: [{ pts: [[1, 0], [0.2, -0.45], [-0.5, -0.55], [-0.95, 0], [-0.5, 0.55], [0.2, 0.45]], suave: true }], circulos: [{ c: [-0.45, -0.2], r: 0.14, relleno: 'blanco' }] },
  // Estrella de cinco puntas (Rapidez, Cometa).
  estrella: { cuerpo: [{ pts: Array.from({ length: 10 }, (_, i) => { const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 0.42 : 1; return [Math.cos(a) * r, Math.sin(a) * r] as P; }) }] },
  // Rayo en zigzag (Impactrueno, Puño Trueno).
  rayo: { cuerpo: [{ pts: [[-0.15, -1], [0.5, -1], [0.12, -0.18], [0.55, -0.18], [-0.38, 1], [-0.08, 0.1], [-0.52, 0.1]] }] },
  // Copo de nieve (Nieve Polvo, Puño Hielo).
  copo: { cuerpo: [{ pts: arco(0, 0, 0.18, 0.18, 0, Math.PI * 2, 6) }], lineas: [0, 1, 2, 3, 4, 5].flatMap(i => { const a = i * Math.PI / 3, c = Math.cos(a), s = Math.sin(a), r = (x: number, y: number): P => [c * x - s * y, s * x + c * y]; return [[r(0.15, 0), r(1, 0)], [r(0.55, 0), r(0.75, -0.22)], [r(0.55, 0), r(0.75, 0.22)], [r(0.78, 0), r(0.92, -0.14)], [r(0.78, 0), r(0.92, 0.14)]]; }) },
  // Nota musical (Canto, Gruñido, Ruido).
  nota: { cuerpo: [{ pts: arco(-0.3, 0.55, 0.38, 0.28, 0, Math.PI * 2, 14).map(([x, y]) => [x * Math.cos(-0.4) - (y - 0.55) * Math.sin(-0.4) - 0.0, (x + 0.3) * Math.sin(-0.4) + (y - 0.55) * Math.cos(-0.4) + 0.55] as P), suave: true }, { pts: [[0.0, 0.5], [0.0, -0.95], [0.14, -0.95], [0.14, 0.5]] }, { pts: [[0.14, -0.95], [0.6, -0.65], [0.62, -0.35], [0.4, -0.5], [0.14, -0.6]], suave: true }] },
  // Letra Z (Bostezo, Descanso, dormido).
  z: { cuerpo: [{ pts: [[-0.75, -0.8], [0.75, -0.8], [0.75, -0.5], [-0.25, 0.5], [0.75, 0.5], [0.75, 0.8], [-0.75, 0.8], [-0.75, 0.5], [0.25, -0.5], [-0.75, -0.5]] }] },
  // Ojo (Malicioso, Mal de Ojo, Psíquico).
  ojo: { cuerpo: [{ pts: [[-1, 0], [-0.5, -0.5], [0.5, -0.5], [1, 0], [0.5, 0.5], [-0.5, 0.5]], suave: true, relleno: 'blanco' }], circulos: [{ c: [0, 0], r: 0.36, relleno: 'base' }, { c: [0, 0], r: 0.16, relleno: 'borde' }, { c: [-0.1, -0.12], r: 0.07, relleno: 'blanco' }] },
  // Fantasma (Lengüetazo, Bola Sombra, Infortunio).
  fantasma: {
    cuerpo: [{ pts: [...arco(0, -0.2, 0.7, 0.75, Math.PI, Math.PI * 2, 12), [0.7, 0.75], [0.45, 0.55], [0.25, 0.8], [0, 0.58], [-0.25, 0.82], [-0.45, 0.55], [-0.7, 0.78]], suave: true }],
    circulos: [{ c: [-0.25, -0.2], r: 0.13, relleno: 'borde' }, { c: [0.22, -0.2], r: 0.13, relleno: 'borde' }],
    lineas: [arco(0, 0.12, 0.2, 0.12, 0.2, Math.PI - 0.2, 6)],
  },
  // Espada (Danza Espada, Tajo Umbrío como hoja).
  espada: {
    cuerpo: [{ pts: [[-0.35, -0.1], [0.85, -0.1], [1.05, 0], [0.85, 0.1], [-0.35, 0.1]] }, { pts: [[-0.4, -0.38], [-0.3, -0.38], [-0.3, 0.38], [-0.4, 0.38]], relleno: 'oscuro' }, { pts: [[-0.95, -0.07], [-0.4, -0.07], [-0.4, 0.07], [-0.95, 0.07]], relleno: 'oscuro' }],
    lineas: [[[-0.25, 0], [0.85, 0]]],
  },
  // Martillo (Martillazo, Mazazo).
  martillo: { cuerpo: [{ pts: [[-1, -0.08], [0.35, -0.08], [0.35, 0.08], [-1, 0.08]], relleno: 'oscuro' }, { pts: [[0.25, -0.55], [0.75, -0.55], [0.8, -0.45], [0.8, 0.45], [0.75, 0.55], [0.25, 0.55], [0.2, 0.45], [0.2, -0.45]] }] },
  // Luna creciente (Luz Lunar, Fuerza Lunar).
  luna: { cuerpo: [{ pts: [...arco(0, 0, 1, 1, -Math.PI * 0.7, Math.PI * 0.7, 20), ...arco(0.42, 0, 0.82, 0.82, Math.PI * 0.62, -Math.PI * 0.62, 20)], suave: true }] },
  // Corazón (Encanto, Beso Drenaje, Camaradería).
  corazon: { cuerpo: [{ pts: [[0, 0.85], [-0.9, -0.05], [-0.8, -0.6], [-0.35, -0.75], [0, -0.4], [0.35, -0.75], [0.8, -0.6], [0.9, -0.05]], suave: true }], circulos: [{ c: [-0.45, -0.38], r: 0.14, relleno: 'blanco' }] },
  // Espiral (Hipnosis, Rayo Confuso): solo línea.
  espiral: { cuerpo: [], lineas: [Array.from({ length: 60 }, (_, i) => { const a = i * 0.32, r = 0.05 + i * 0.016; return [Math.cos(a) * r, Math.sin(a) * r] as P; })] },
  // Escudo (Protección, Defensa Férrea).
  escudo: { cuerpo: [{ pts: [[-0.75, -0.85], [0.75, -0.85], [0.8, 0.0], [0.5, 0.55], [0, 0.95], [-0.5, 0.55], [-0.8, 0.0]], suave: true }, { pts: [[-0.5, -0.65], [0.5, -0.65], [0.55, 0.0], [0.32, 0.4], [0, 0.68], [-0.32, 0.4], [-0.55, 0.0]], suave: true, relleno: 'claro' }] },
} satisfies Record<string, Dibujo>;

export type NombreForma = keyof typeof FORMAS;
export const NOMBRES_FORMA = Object.keys(FORMAS) as NombreForma[];

/** Cómo se pinta: `base` (relleno principal), `claro` y `oscuro` (partes), `borde` (contorno y detalles), brillo exterior. */
export interface EstiloForma {
  base: string | ((c: CanvasRenderingContext2D) => string | CanvasGradient);
  claro?: string;
  oscuro?: string;
  borde?: string;
  /** Grosor del borde en px de escenario. */
  grosor?: number;
  /** Halo de color alrededor (px de desenfoque). */
  brillo?: string;
  brilloTam?: number;
  alpha?: number;
  /** Composición (por defecto 'source-over'; 'lighter' para formas de luz). */
  mezcla?: GlobalCompositeOperation;
}

function trazar(c: CanvasRenderingContext2D, pts: P[], suave: boolean): void {
  if (!suave || pts.length < 3) {
    c.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) c.lineTo(pts[i][0], pts[i][1]);
    c.closePath();
    return;
  }
  const m = (a: P, b: P): P => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const n = pts.length, ini = m(pts[n - 1], pts[0]);
  c.moveTo(ini[0], ini[1]);
  for (let i = 0; i < n; i++) { const p = pts[i], q = m(p, pts[(i + 1) % n]); c.quadraticCurveTo(p[0], p[1], q[0], q[1]); }
  c.closePath();
}

/**
 * Pinta la forma `nombre` centrada en (x, y), de radio `tam` px, girada `angulo` radianes (0 = mirando a la derecha).
 * `espejo` la voltea en vertical (un puño que viene por la izquierda). Para los colmillos usa `mandibula()`.
 */
export function forma(c: CanvasRenderingContext2D, nombre: NombreForma, x: number, y: number, tam: number, angulo: number, e: EstiloForma, espejo = false): void {
  const d: Dibujo = FORMAS[nombre];
  c.save();
  c.translate(x, y);
  c.rotate(angulo);
  c.scale(tam, espejo ? -tam : tam);
  c.globalAlpha *= e.alpha ?? 1;
  c.globalCompositeOperation = e.mezcla ?? 'source-over';
  const borde = e.borde ?? '#2a1a10', grosor = (e.grosor ?? Math.max(1.5, tam * 0.07)) / tam;
  const color = (r: 'base' | 'claro' | 'oscuro' | 'blanco' | 'borde' | undefined): string | CanvasGradient =>
    r === 'claro' ? e.claro ?? (typeof e.base === 'string' ? e.base : '#ffffff') : r === 'oscuro' ? e.oscuro ?? borde : r === 'blanco' ? '#fbfbff' : r === 'borde' ? borde
      : typeof e.base === 'string' ? e.base : e.base(c);
  c.lineJoin = 'round'; c.lineCap = 'round';
  if (e.brillo) { c.shadowColor = e.brillo; c.shadowBlur = e.brilloTam ?? tam * 0.5; }
  for (const parte of d.cuerpo) {
    c.beginPath(); trazar(c, parte.pts, parte.suave ?? false);
    c.fillStyle = color(parte.relleno ?? 'base'); c.fill();
    c.shadowBlur = 0;
    c.lineWidth = grosor; c.strokeStyle = borde; c.stroke();
  }
  for (const k of d.circulos ?? []) { c.beginPath(); c.arc(k.c[0], k.c[1], k.r, 0, Math.PI * 2); c.fillStyle = color(k.relleno); c.fill(); }
  c.shadowBlur = 0;
  c.strokeStyle = borde; c.lineWidth = grosor * (d.cuerpo.length ? 0.8 : 1.6);
  if (!d.cuerpo.length && e.brillo) { c.shadowColor = e.brillo; c.shadowBlur = e.brilloTam ?? tam * 0.5; }
  for (const l of d.lineas ?? []) { c.beginPath(); c.moveTo(l[0][0], l[0][1]); for (const p of l.slice(1)) c.lineTo(p[0], p[1]); c.stroke(); }
  c.restore();
}

/**
 * Mandíbulas con colmillos (Mordisco, Triturar, Colmillo Ígneo…), de frente: `apertura` 1 = abiertas, 0 = cerradas
 * (los dientes se cruzan). El color de la encía es `e.base`; los dientes, blancos (o `e.claro`).
 */
export function mandibula(c: CanvasRenderingContext2D, x: number, y: number, tam: number, apertura: number, e: EstiloForma): void {
  c.save();
  c.translate(x, y);
  c.scale(tam, tam);
  c.globalAlpha *= e.alpha ?? 1;
  const borde = e.borde ?? '#2a1a10', grosor = (e.grosor ?? Math.max(1.5, tam * 0.07)) / tam, encia = typeof e.base === 'string' ? e.base : e.base(c);
  c.lineJoin = 'round';
  if (e.brillo) { c.shadowColor = e.brillo; c.shadowBlur = e.brilloTam ?? tam * 0.5; }
  for (const lado of [-1, 1]) {
    const dy = lado * (0.12 + apertura * 0.55);
    // Dientes: de la encía hacia el centro; dos colmillos largos.
    c.beginPath();
    const n = 6;
    for (let i = 0; i < n; i++) {
      const x0 = -0.85 + i * (1.7 / n), x1 = x0 + 1.7 / n, largo = i === 1 || i === n - 2 ? 0.55 : 0.3;
      const yb = dy + lado * -0.05 * Math.abs(i - (n - 1) / 2) / n;
      c.moveTo(x0 + 0.02, yb); c.lineTo((x0 + x1) / 2, yb - lado * largo); c.lineTo(x1 - 0.02, yb); c.closePath();
    }
    c.fillStyle = e.claro ?? '#fbfbff'; c.fill(); c.lineWidth = grosor * 0.8; c.strokeStyle = borde; c.stroke();
    // Encía: un arco grueso por fuera.
    c.beginPath();
    for (let i = 0; i <= 16; i++) { const t = i / 16, xx = -0.95 + 1.9 * t; c.lineTo(xx, dy + lado * (0.08 + 0.32 * Math.sin(Math.PI * t))); }
    for (let i = 16; i >= 0; i--) { const t = i / 16, xx = -0.95 + 1.9 * t; c.lineTo(xx, dy - lado * 0.03 + lado * 0.06 * Math.sin(Math.PI * t)); }
    c.closePath();
    c.fillStyle = encia; c.fill(); c.shadowBlur = 0; c.lineWidth = grosor; c.strokeStyle = borde; c.stroke();
  }
  c.restore();
}

/** `n` puntos repartidos por el contorno del primer polígono de la forma (coordenadas unidad). */
export function contorno(nombre: NombreForma, n = 24): Vec[] {
  const cuerpo = (FORMAS[nombre] as Dibujo).cuerpo;
  const pts = cuerpo.length ? cuerpo.reduce((a, b) => (b.pts.length > a.pts.length ? b : a)).pts : ((FORMAS[nombre] as Dibujo).lineas ?? [[[0, 0]]]).flat();
  const seg: { a: P; b: P; l: number }[] = [];
  let total = 0;
  for (let i = 0; i < pts.length; i++) { const a = pts[i], b = pts[(i + 1) % pts.length], l = Math.hypot(b[0] - a[0], b[1] - a[1]); seg.push({ a, b, l }); total += l; }
  const out: Vec[] = [];
  for (let k = 0; k < n; k++) {
    let d = (k + 0.5) * total / n;
    for (const s of seg) { if (d <= s.l) { const t = s.l ? d / s.l : 0; out.push({ x: s.a[0] + (s.b[0] - s.a[0]) * t, y: s.a[1] + (s.b[1] - s.a[1]) * t }); break; } d -= s.l; }
  }
  return out;
}

/** De coordenadas unidad de una forma pintada en (x, y, tam, angulo) a px de escenario. */
export function aEscena(u: Vec, x: number, y: number, tam: number, angulo: number, espejo = false): Vec {
  const uy = espejo ? -u.y : u.y, c = Math.cos(angulo), s = Math.sin(angulo);
  return { x: x + (u.x * c - uy * s) * tam, y: y + (u.x * s + uy * c) * tam };
}
