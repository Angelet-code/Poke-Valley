// Zonas del modo aventura (docs/GDD-mundo.md): mapas en estilo dibujo (elementos Klein, render/Dibujo.ts) unidos por
// sus bordes. El mundo es fijo: cada zona procedural sale siempre igual con la semilla de la partida.
// - Pueblo: el de siempre (data/mapaDibujo.ts). Solo estás tú y los Pokémon que has capturado. Por el camino del sur
//   se sale al bosque.
// - Bosque Verde (nv 1-7): un borde espeso de árboles lo cierra; dentro, claros unidos por senderos de tierra que
//   salen de la entrada (abajo, en el centro), árboles sueltos, rocas, arbustos y quizá un estanque. Los salvajes
//   rondan por los claros; cuanto más lejos de la entrada, más nivel. Un sendero sale por el este al lago.
// - Lago Celeste (nv 5-10): un lago de agua del suelo (Terrain, vértices 3) con playas, un islote y un camino que lo
//   rodea. Se entra por el oeste, desde el bosque.
import type { MapData } from './types';
import { COLOCADOS, H as H_PUEBLO, W as W_PUEBLO, terrenoDibujo, type Colocado } from './mapaDibujo';
import { rng } from '../util';

export const T = 24;
export type MapaId = 'pueblo' | 'bosque' | 'lago';
export interface Punto { x: number; y: number }
export interface Llegada extends Punto { dir: number }   // dir: fila del sprite (0 abajo, 2 derecha, 4 arriba, 6 izquierda)
export interface Salida { x0: number; y0: number; x1: number; y1: number; a: MapaId; texto: string }
export interface Ronda { linea: string; nivel: number; x: number; y: number }
export interface MapaAventura {
  id: MapaId; nombre: string; datos: MapData; W: number; H: number;
  lema: string;                   // lo que dice el rótulo al entrar, bajo el nombre (nivel y tipos)
  bienvenida: string;             // aviso al entrar
  colocados: Colocado[];
  detalles: number;               // cuántos detalles (flores, matitas) se reparten por el césped libre
  llegada: Partial<Record<MapaId | 'inicio', Llegada>>;  // dónde apareces según de dónde vienes
  salidas: Salida[];
  salvajes: Ronda[];
}

export function pueblo(): MapaAventura {
  const datos = terrenoDibujo(), [ix, iy] = datos.inicio ?? [469, 400];
  return {
    id: 'pueblo', nombre: 'Pueblo', datos, W: W_PUEBLO, H: H_PUEBLO, colocados: COLOCADOS, detalles: 70,
    lema: 'Tu hogar · aquí esperan tus Pokémon', bienvenida: 'El pueblo. El camino del sur lleva al bosque.',
    llegada: { inicio: { x: ix, y: iy, dir: 0 }, bosque: { x: 560, y: H_PUEBLO - 46, dir: 4 } },
    salidas: [{ x0: 520, y0: H_PUEBLO - 14, x1: 600, y1: H_PUEBLO, a: 'bosque', texto: 'Al bosque' }],
    salvajes: [],
  };
}

// Especies del bosque (líneas de data/pokedex.ts). En cada bosque salen unas cuantas, por nivel en su forma.
export const ESPECIES_BOSQUE = ['caterpie', 'pidgey', 'oddish', 'bidoof', 'hoothoot', 'spinarak', 'zubat', 'pikachu', 'sunkern', 'combee',
  'bounsweet', 'poochyena', 'murkrow', 'flabebe', 'wooloo', 'natu', 'rookidee', 'growlithe', 'psyduck', 'gastly', 'clefairy', 'diglett', 'machop', 'ralts'];

const MW = 56, MH = 44;

export function bosque(semilla: number): MapaAventura {
  const r = rng(semilla), W = MW * T, H = MH * T;
  const entre = (a: number, b: number) => a + r() * (b - a);
  const entrada = { x: W / 2, y: H - 30 };
  const este = Math.round(H * 0.3);   // y de la salida del este (al lago), al fondo del bosque

  // Claros: el de la entrada y 5-7 más, repartidos por el interior sin pisarse.
  const claros: (Punto & { rad: number })[] = [{ x: W / 2, y: H - 120, rad: 90 }];
  for (let i = 0; i < 200 && claros.length < 7; i++) {
    const c = { x: entre(170, W - 170), y: entre(150, H - 260), rad: entre(80, 130) };
    if (claros.every(o => Math.hypot(o.x - c.x, o.y - c.y) > o.rad + c.rad + 50)) claros.push(c);
  }
  // Senderos: cada claro se une al más cercano de los ya unidos (un árbol desde la entrada), con curvas suaves.
  const unidos = [claros[0]], tramos: Punto[][] = [[entrada, claros[0]]];
  for (const c of claros.slice(1).sort((a, b) => Math.hypot(a.x - entrada.x, a.y - entrada.y) - Math.hypot(b.x - entrada.x, b.y - entrada.y))) {
    const o = unidos.reduce((m, u) => Math.hypot(u.x - c.x, u.y - c.y) < Math.hypot(m.x - c.x, m.y - c.y) ? u : m);
    const mid = { x: (o.x + c.x) / 2 + entre(-60, 60), y: (o.y + c.y) / 2 + entre(-60, 60) };
    tramos.push([o, mid, c]);
    unidos.push(c);
  }
  // Sendero al lago: del claro más cercano a la salida del este hasta el borde.
  const salidaE = { x: W + 10, y: este };
  const cE = claros.reduce((m, c) => Math.hypot(c.x - salidaE.x, c.y - salidaE.y) < Math.hypot(m.x - salidaE.x, m.y - salidaE.y) ? c : m);
  tramos.push([cE, { x: (cE.x + W) / 2, y: (cE.y + este) / 2 + entre(-30, 30) }, salidaE]);
  const puntos: Punto[] = [];
  for (const t of tramos) for (let i = 0; i < t.length - 1; i++) {
    const a = t[i], b = t[i + 1], n = Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 8);
    for (let k = 0; k <= n; k++) puntos.push({ x: a.x + (b.x - a.x) * k / n, y: a.y + (b.y - a.y) * k / n });
  }
  const aSendero = (x: number, y: number) => { let d = Infinity; for (const p of puntos) d = Math.min(d, Math.hypot(p.x - x, p.y - y)); return d; };
  const enClaro = (x: number, y: number, m = 0) => claros.some(c => Math.hypot((x - c.x) / (c.rad + m), (y - c.y) / ((c.rad + m) * 0.8)) < 1);

  // Suelo: césped, con tierra en los senderos y alguna mancha en los claros.
  const vert: number[][] = [];
  for (let vy = 0; vy <= MH; vy++) {
    const fila: number[] = [];
    for (let vx = 0; vx <= MW; vx++) fila.push(aSendero(vx * T, vy * T) < 22 ? 1 : 0);
    vert.push(fila);
  }

  const col: Colocado[] = [];
  const ocupado: (Punto & { r: number })[] = [];
  const libre = (x: number, y: number, rad: number) => ocupado.every(o => Math.hypot(o.x - x, (o.y - y) * 1.3) > o.r + rad);
  const poner = (c: Colocado, rad: number) => { col.push(c); ocupado.push({ x: c.x, y: c.y, r: rad }); };
  // Estanque en un claro lejano (la mitad de las veces).
  if (r() < 0.5 && claros.length > 2) {
    const c = claros[2 + Math.floor(r() * (claros.length - 2))];
    poner({ id: 'estanque', x: Math.round(c.x + entre(-30, 30)), y: Math.round(c.y + 20) }, 70);
  }
  // Borde: dos filas de árboles apretados, con algo de desorden; la boca de la entrada queda libre.
  const arbol = () => (r() < 0.5 ? 'arbol_alto' : 'arbol_bajo');
  for (let y = 10; y < H + 40; y += 30) for (const x of [entre(-6, 14), entre(30, 50), W - entre(-6, 14), W - entre(30, 50)]) if (x < W / 2 || Math.abs(y - este) > 64) poner({ id: arbol(), x: Math.round(x), y: Math.round(y), flip: r() < 0.5, s: entre(0.9, 1.15) }, 16);
  for (let x = 60; x < W - 50; x += 30) for (const y of [entre(16, 30), entre(52, 70), H + entre(4, 14)]) {
    if (y > H && Math.abs(x - entrada.x) < 70) continue;
    poner({ id: arbol(), x: Math.round(x), y: Math.round(y), flip: r() < 0.5, s: entre(0.9, 1.15) }, 16);
  }
  // Dentro: árboles sueltos donde no hay claro ni sendero.
  for (let i = 0; i < 2500; i++) {
    const x = entre(70, W - 70), y = entre(90, H - 30);
    if (enClaro(x, y, 25) || aSendero(x, y) < 46 || !libre(x, y, 26)) continue;
    poner({ id: arbol(), x: Math.round(x), y: Math.round(y), flip: r() < 0.5, s: entre(0.85, 1.2) }, 20);
  }
  // Rocas, arbustos y tocones por el borde de los claros; flores dentro.
  const extras: [string, number][] = [['arbusto', 14], ['roca_0', 4], ['roca_2', 3], ['roca_4', 3], ['roca_6', 3], ['roca_8', 2], ['tocon', 4], ['piedras_0', 3], ['flores', 8]];
  for (const [id, n] of extras) for (let k = 0, i = 0; k < n && i < 400; i++) {
    const c = claros[Math.floor(r() * claros.length)], a = r() * Math.PI * 2, d = id === 'flores' || id === 'piedras_0' ? entre(0, 0.7) : entre(0.75, 1.05);
    const x = c.x + Math.cos(a) * c.rad * d, y = c.y + Math.sin(a) * c.rad * 0.8 * d;
    const plano = id === 'flores' || id === 'piedras_0';
    if (aSendero(x, y) < 30 || (!plano && !libre(x, y, 16))) continue;
    if (plano) col.push({ id, x: Math.round(x), y: Math.round(y), flip: r() < 0.5 }); else poner({ id, x: Math.round(x), y: Math.round(y), flip: r() < 0.5, s: id.startsWith('roca') ? entre(0.6, 0.9) : 1 }, 16);
    k++;
  }

  // Salvajes: 2-3 por claro, de nivel según el orden de lejanía del claro: 1-2 en el de la entrada (empiezas a nivel 1)
  // y uno más por cada claro, hasta 7-8 en el del fondo.
  const especies = [...ESPECIES_BOSQUE].sort(() => r() - 0.5).slice(0, 7);
  const salvajes: Ronda[] = [];
  const orden = [...claros].sort((a, b) => Math.hypot(a.x - entrada.x, a.y - entrada.y) - Math.hypot(b.x - entrada.x, b.y - entrada.y));
  orden.forEach((c, i) => {
    const n = 2 + (r() < 0.5 ? 1 : 0);
    for (let k = 0; k < n; k++) {
      const a = r() * Math.PI * 2, rr = r() * c.rad * 0.6, nv = Math.max(1, i + 1 + (r() < 0.4 ? 1 : 0));
      salvajes.push({ linea: especies[Math.floor(r() * especies.length)], nivel: nv, x: Math.round(c.x + Math.cos(a) * rr), y: Math.round(c.y + Math.sin(a) * rr * 0.8) });
    }
  });

  return {
    id: 'bosque', nombre: 'Bosque Verde', datos: { mw: MW, mh: MH, vert, inicio: [entrada.x, entrada.y - 20] }, W, H, colocados: col, detalles: 90,
    lema: 'Nivel 1-7 · Bicho, Planta, Volador y más',
    bienvenida: 'El bosque. Elige a un salvaje (clic o Tab) y atácalo con los números. Al fondo, un sendero sale al este, hacia el lago.',
    llegada: { pueblo: { x: entrada.x, y: H - 50, dir: 4 }, inicio: { x: entrada.x, y: H - 50, dir: 4 }, lago: { x: W - 40, y: este, dir: 6 } },
    salidas: [{ x0: entrada.x - 50, y0: H - 12, x1: entrada.x + 50, y1: H, a: 'pueblo', texto: 'Al pueblo' },
      { x0: W - 14, y0: este - 50, x1: W, y1: este + 50, a: 'lago', texto: 'Al lago' }],
    salvajes,
  };
}

// Especies del lago: Agua y lo que ronda por las orillas.
export const ESPECIES_LAGO = ['psyduck', 'marill', 'magikarp', 'pachirisu', 'pikachu', 'flabebe', 'ralts', 'natu', 'hoothoot', 'murkrow', 'wooloo', 'poochyena'];

const LW = 52, LH = 44;

// Lago Celeste: el agua es la del suelo (vértices 3 de Terrain, colisión con Terrain.esAgua). Tres lóbulos con un
// islote, playas de arena a trozos, un camino que rodea el lago y sale al oeste (al bosque), árboles por tierra firme,
// rocas y arbustos en la orilla. Los salvajes rondan cerca del agua; el nivel sube con la distancia a la entrada.
export function lago(semilla: number): MapaAventura {
  const r = rng(semilla ^ 0x5a17c3), W = LW * T, H = LH * T;
  const entre = (a: number, b: number) => a + r() * (b - a);
  const entrada = { x: 0, y: Math.round(H * 0.55) };
  const cx = W * 0.6, cy = H * 0.48;
  const lobulos = [
    { x: cx, y: cy, rx: entre(230, 270), ry: entre(150, 175) },
    { x: cx + entre(-180, -120), y: cy + entre(60, 100), rx: entre(120, 160), ry: entre(80, 105) },
    { x: cx + entre(100, 160), y: cy + entre(-120, -70), rx: entre(110, 145), ry: entre(80, 100) },
  ];
  const isla = { x: cx + entre(10, 60), y: cy - entre(0, 30), rx: 48, ry: 30 };
  const enIsla = (x: number, y: number) => ((x - isla.x) / isla.rx) ** 2 + ((y - isla.y) / isla.ry) ** 2 < 1;
  // m > 0 agranda el lago (orilla); m < 0 lo encoge.
  const enAgua = (x: number, y: number, m = 0) => lobulos.some(e => ((x - e.x) / (e.rx + m)) ** 2 + ((y - e.y) / (e.ry + m)) ** 2 < 1) && !(m <= 0 && enIsla(x, y));

  // Camino: un anillo alrededor del lago a ~70 px de la orilla, y un tramo de la entrada al punto más al oeste.
  const anillo: Punto[] = [];
  for (let k = 0; k < 64; k++) {
    const a = k / 64 * Math.PI * 2, dx = Math.cos(a), dy = Math.sin(a) * 0.75;
    let d = 40;
    while (d < 900 && enAgua(cx + dx * d, cy + dy * d, 70)) d += 6;
    anillo.push({ x: Math.max(90, Math.min(W - 90, cx + dx * d)), y: Math.max(110, Math.min(H - 80, cy + dy * d)) });
  }
  const oeste = anillo.reduce((m, p) => p.x < m.x ? p : m);
  const tramos: Punto[][] = [anillo.concat(anillo[0]), [{ x: -10, y: entrada.y }, { x: (oeste.x) / 2, y: (entrada.y + oeste.y) / 2 + entre(-20, 20) }, oeste]];
  const puntos: Punto[] = [];
  for (const t of tramos) for (let i = 0; i < t.length - 1; i++) {
    const a = t[i], b = t[i + 1], n = Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 8);
    for (let k = 0; k <= n; k++) puntos.push({ x: a.x + (b.x - a.x) * k / n, y: a.y + (b.y - a.y) * k / n });
  }
  const aSendero = (x: number, y: number) => { let d = Infinity; for (const p of puntos) d = Math.min(d, Math.hypot(p.x - x, p.y - y)); return d; };

  // Suelo: agua, playas de arena a trozos junto al agua, tierra en el camino y césped en lo demás.
  const vert: number[][] = [];
  for (let vy = 0; vy <= LH; vy++) {
    const fila: number[] = [];
    for (let vx = 0; vx <= LW; vx++) {
      const x = vx * T, y = vy * T, playa = enAgua(x, y, 30) && Math.sin(x * 0.011 + y * 0.017 + semilla % 7) > -0.2;
      fila.push(enAgua(x, y) ? 3 : playa || aSendero(x, y) < 20 ? 1 : 0);
    }
    vert.push(fila);
  }

  const col: Colocado[] = [];
  const ocupado: (Punto & { r: number })[] = [];
  const libre = (x: number, y: number, rad: number) => ocupado.every(o => Math.hypot(o.x - x, (o.y - y) * 1.3) > o.r + rad);
  const poner = (c: Colocado, rad: number) => { col.push(c); ocupado.push({ x: c.x, y: c.y, r: rad }); };
  const arbol = () => (r() < 0.4 ? 'arbol_alto' : 'arbol_bajo');
  // Borde de árboles, con la boca del oeste libre.
  for (let y = 10; y < H + 40; y += 30) for (const x of [entre(-6, 14), entre(30, 50), W - entre(-6, 14), W - entre(30, 50)]) {
    if (x < W / 2 && Math.abs(y - entrada.y) < 64) continue;
    poner({ id: arbol(), x: Math.round(x), y: Math.round(y), flip: r() < 0.5, s: entre(0.9, 1.15) }, 16);
  }
  for (let x = 60; x < W - 50; x += 30) for (const y of [entre(16, 30), entre(52, 70), H + entre(4, 14)]) poner({ id: arbol(), x: Math.round(x), y: Math.round(y), flip: r() < 0.5, s: entre(0.9, 1.15) }, 16);
  // El islote: un árbol alto, inalcanzable (punto de referencia).
  poner({ id: 'arbol_alto', x: Math.round(isla.x), y: Math.round(isla.y + 10), s: 1.1 }, 20);
  // Árboles sueltos por tierra firme, lejos del agua y del camino (más claro que el bosque).
  for (let i = 0; i < 900; i++) {
    const x = entre(70, W - 70), y = entre(90, H - 30);
    if (enAgua(x, y, 60) || aSendero(x, y) < 44 || !libre(x, y, 34)) continue;
    poner({ id: arbol(), x: Math.round(x), y: Math.round(y), flip: r() < 0.5, s: entre(0.85, 1.15) }, 24);
  }
  // Orilla: rocas y arbustos (los juncos, cuando haya arte). Flores y piedras por el césped.
  const orilla: [string, number][] = [['roca_0', 4], ['roca_2', 3], ['roca_4', 3], ['roca_6', 3], ['arbusto', 12], ['tocon', 2]];
  for (const [id, n] of orilla) for (let k = 0, i = 0; k < n && i < 600; i++) {
    const x = entre(80, W - 80), y = entre(100, H - 60);
    if (!enAgua(x, y, 40) || enAgua(x, y, 12) || aSendero(x, y) < 26 || !libre(x, y, 16)) continue;
    poner({ id, x: Math.round(x), y: Math.round(y), flip: r() < 0.5, s: id.startsWith('roca') ? entre(0.6, 0.95) : 1 }, 16); k++;
  }
  for (const [id, n] of [['flores', 10], ['piedras_0', 4]] as [string, number][]) for (let k = 0, i = 0; k < n && i < 400; i++) {
    const x = entre(80, W - 80), y = entre(100, H - 60);
    if (enAgua(x, y, 20) || aSendero(x, y) < 28) continue;
    col.push({ id, x: Math.round(x), y: Math.round(y), flip: r() < 0.5 }); k++;
  }

  // Salvajes: 18 cerca del agua, de nivel 5 a 10 según lo lejos que estén de la entrada.
  const especies = [...ESPECIES_LAGO].sort(() => r() - 0.5).slice(0, 7);
  const salvajes: Ronda[] = [];
  const dmax = Math.hypot(W, H) * 0.75;
  for (let i = 0; i < 2000 && salvajes.length < 18; i++) {
    const x = entre(100, W - 100), y = entre(120, H - 80);
    if (!enAgua(x, y, 150) || enAgua(x, y, 26) || !libre(x, y, 10) || salvajes.some(s => Math.hypot(s.x - x, s.y - y) < 70)) continue;
    const nv = Math.min(10, 5 + Math.round(Math.hypot(x - entrada.x, y - entrada.y) / dmax * 4) + (r() < 0.4 ? 1 : 0));
    salvajes.push({ linea: especies[Math.floor(r() * especies.length)], nivel: nv, x: Math.round(x), y: Math.round(y) });
  }

  return {
    id: 'lago', nombre: 'Lago Celeste', datos: { mw: LW, mh: LH, vert, inicio: [40, entrada.y] }, W, H, colocados: col, detalles: 80,
    lema: 'Nivel 5-10 · Agua y orilla',
    bienvenida: 'El lago. Un camino lo rodea; cuanto más lejos de la entrada, más fuertes son los salvajes.',
    llegada: { bosque: { x: 40, y: entrada.y, dir: 2 }, inicio: { x: 40, y: entrada.y, dir: 2 } },
    salidas: [{ x0: 0, y0: entrada.y - 50, x1: 14, y1: entrada.y + 50, a: 'bosque', texto: 'Al bosque' }],
    salvajes,
  };
}

// La zona `id` del mundo de la partida (la semilla es fija: el mundo sale siempre igual).
export function crearMapa(id: MapaId, semilla: number): MapaAventura {
  return id === 'bosque' ? bosque(semilla) : id === 'lago' ? lago(semilla) : pueblo();
}
