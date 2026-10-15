// Bordes del macizo con tiras (2026-10-15, docs/art/ARCANE.md "Muros y barreras"): en las zonas de bioma, donde el
// borde del macizo va recto un buen trecho, un acantilado o un muro del bioma en lugar de solo piezas sueltas.
// - Borde sur (macizo arriba, se anda abajo): tira horizontal con la base en el borde y la cara hacia el jugador. Solo
//   si todo lo que tapa por encima (su alto) es macizo: nunca esconde un pasillo de detrás.
// - Bordes este y oeste: tira vertical metida en el macizo, pegada al borde.
// El borde sur puede ir en zigzag hasta 40 px: la tira se pone en lo más bajo y lo pisable que queda detrás de su cara
// pasa a macizo (la tira endereza el borde), siempre que delante queden 40 px de paso. Las piezas sueltas del macizo
// que quedarían delante de la cara se quitan. Va en la escena (Aventura) porque necesita las medidas del catálogo;
// sale igual cada vez (semilla por zona).
import type { Colocado } from './mapaDibujo';
import type { MapaAventura } from './bosque';
import type { Bioma } from './biomas';
import { medidasTira, type Elemento } from '../render/Dibujo';
import { rng } from '../util';

// Por bioma: qué tira horizontal (con su peso) y cuál vertical; `p`: probabilidad de usar un tramo de borde que valga.
const BORDES: Record<Bioma, { h: [string, number][]; v: [string, number][]; p: number }> = {
  costa: { h: [['acantilado', 1]], v: [['acantilado_v', 1], ['muro_v', 0.4]], p: 0.75 },
  cantera: { h: [['acantilado', 0.8], ['muro', 0.2]], v: [['acantilado_v', 1], ['muro_v', 0.5]], p: 0.85 },
  pantano: { h: [['acantilado', 0.6], ['muro', 0.4]], v: [['muro_v', 1], ['acantilado_v', 0.5]], p: 0.7 },
  ruinas: { h: [['muro', 0.6], ['acantilado', 0.4]], v: [['muro_v', 1]], p: 0.8 },
  volcan: { h: [['acantilado', 0.8], ['muro', 0.2]], v: [['acantilado_v', 1], ['muro_v', 0.4]], p: 0.8 },
  nieve: { h: [['acantilado', 0.7], ['muro', 0.3]], v: [['muro_v', 1], ['acantilado_v', 0.6]], p: 0.75 },
};
const BANDA = 6;     // celdas que puede subir y bajar el borde dentro de un tramo (48 px); la tira lo endereza
const MAX = 80;      // celdas de largo máximo de un tramo (640 px): más largo, se parte

interface Rect { x0: number; y0: number; x1: number; y1: number }

// Cuántos tramos de borde sur se pusieron o se descartaron, y por qué (para ajustar BANDA, `p`…; la última zona montada).
export const DIAG: Record<string, number> = {};
export function tirasDeBorde(mapa: MapaAventura, porId: Map<string, Elemento>, agua: (x: number, y: number) => boolean): number {
  const z = mapa.macizo, bio = mapa.suelo, def = bio && BORDES[bio];
  if (!z || !bio || !def) return 0;
  const { cel, cols, filas, datos } = z, r = rng(cols * 7919 + filas * 131 + bio.length * 17 + bio.charCodeAt(0));
  const maz = (i: number, j: number) => i < 0 || j < 0 || i >= cols || j >= filas || datos[j * cols + i] === 1;
  const pisa = (i: number, j: number) => i >= 0 && j >= 0 && i < cols && j < filas && !datos[j * cols + i] && !agua((i + 0.5) * cel, (j + 0.5) * cel);
  const hechas: Rect[] = [], nuevas: Colocado[] = [];
  const choca = (q: Rect) => hechas.some(h => q.x0 < h.x1 && q.x1 > h.x0 && q.y0 < h.y1 && q.y1 > h.y0);
  const elegir = (ops: [string, number][]) => {
    const tot = ops.reduce((a, o) => a + o[1], 0);
    let x = r() * tot;
    for (const o of ops) if ((x -= o[1]) <= 0) return o[0];
    return ops[ops.length - 1][0];
  };
  // ¿Es macizo (casi) todo el rectángulo de celdas? (lo que la tira tapa)
  const macizoEn = (x0: number, y0: number, x1: number, y1: number) => {
    let n = 0, m = 0;
    for (let j = Math.floor(y0 / cel); j <= Math.floor((y1 - 1) / cel); j++) for (let i = Math.floor(x0 / cel); i <= Math.floor((x1 - 1) / cel); i++) { n++; if (maz(i, j)) m++; }
    return n > 0 && m / n > 0.93;
  };
  // Tramos de borde: en cada línea (columna para el sur, fila para este/oeste) las celdas de borde, encadenadas con la
  // línea siguiente mientras el borde no se salga de una banda de BANDA celdas.
  type Tramo = { a: number; b: number; lo: number; hi: number };
  const tramos = (largo: number, ancho: number, borde: (t: number, s: number) => boolean): Tramo[] => {
    const out: Tramo[] = [], usado = new Uint8Array(largo * ancho), u = (t: number, s: number) => t * ancho + s;
    const libre = (t: number, s: number) => s >= 0 && s < ancho && !usado[u(t, s)] && borde(t, s);
    for (let t = 0; t < largo; t++) for (let s0 = 0; s0 < ancho; s0++) {
      if (!libre(t, s0)) continue;
      let lo = s0, hi = s0, b = t, s = s0;
      usado[u(t, s0)] = 1;
      while (b + 1 < largo && b + 1 - t < MAX) {
        let sig = -1;
        for (const d of [0, -1, 1, -2, 2, -3, 3, -4, 4]) if (Math.max(hi, s + d) - Math.min(lo, s + d) <= BANDA && libre(b + 1, s + d)) { sig = s + d; break; }
        if (sig < 0) break;
        b++; s = sig; lo = Math.min(lo, s); hi = Math.max(hi, s); usado[u(b, s)] = 1;
      }
      out.push({ a: t, b, lo, hi });
    }
    return out;
  };

  // Sur: celda de macizo con suelo pisable debajo.
  const sur = tramos(cols, filas, (i, j) => maz(i, j) && pisa(i, j + 1));
  for (const k in DIAG) delete DIAG[k];
  const no = (m: string) => { DIAG[m] = (DIAG[m] ?? 0) + 1; };
  for (const t of sur) {
    if ((t.b - t.a + 1) * cel < 96) { no('corto'); continue; }
    if (r() > def.p) { no('azar'); continue; }
    const x0 = t.a * cel, x1 = (t.b + 1) * cel, base = (t.hi + 1) * cel + 2;
    const ops = def.h.filter(([p]) => {
      const m = medidasTira(`${p}_${bio}`, porId);
      return m && x1 - x0 >= m.minimo && macizoEn(x0 + 8, base - m.grueso, x1 - 8, (t.lo + 1) * cel);
    });
    // Delante, al menos 40 px de paso (enderezar no puede cerrar un pasillo).
    let libres = 0;
    for (let i = t.a; i <= t.b; i++) for (let j = t.hi + 1; j <= t.hi + 5; j++) if (pisa(i, j)) libres++;
    if (libres < (t.b - t.a + 1) * 5 * 0.85) { no('sin paso delante'); continue; }
    if (!ops.length) { no(def.h.some(([p]) => x1 - x0 >= (medidasTira(`${p}_${bio}`, porId)?.minimo ?? 1e9)) ? 'tapa paso' : 'no cabe'); continue; }
    const id = `${elegir(ops)}_${bio}`, m = medidasTira(id, porId)!;
    const q = { x0, y0: base - m.grueso, x1, y1: base + 4 };
    if (choca(q)) { no('choca'); continue; }
    no('puesta');
    hechas.push(q);
    nuevas.push({ id, x: x0, y: base, tira: { hasta: x1 } });
    // Enderezar: lo que quedaba pisable detrás de la cara (entre el borde y la base) pasa a macizo.
    for (let i = t.a; i <= t.b; i++) for (let j = t.lo; j <= t.hi; j++) datos[j * cols + i] = 1;
  }

  // Este (macizo a la izquierda, se anda a la derecha) y oeste (al revés): la tira vertical dentro del macizo.
  for (const lado of [1, -1]) {
    const borde = (j: number, i: number) => maz(i, j) && pisa(i + lado, j);
    for (const t of tramos(filas, cols, borde)) {
      if (r() > def.p) continue;
      const y0 = t.a * cel, y1 = (t.b + 1) * cel, xb = lado > 0 ? (t.lo + 1) * cel : t.hi * cel;   // borde del macizo (lo más metido de la banda)
      const ops = def.v.filter(([p]) => {
        const m = medidasTira(`${p}_${bio}`, porId);
        if (!m || y1 - y0 < Math.max(m.minimo, 200)) return false;   // cortas parecen pilares sueltos
        const cx = xb - lado * m.grueso / 2;
        return macizoEn(cx - m.grueso / 2, y0 + 8, cx + m.grueso / 2, y1 - 8);
      });
      if (!ops.length) continue;
      const id = elegir(ops).replace('_v', `_v_${bio}`), m = medidasTira(id, porId)!;
      const cx = Math.round(xb - lado * m.grueso / 2);
      const q = { x0: cx - m.grueso / 2, y0, x1: cx + m.grueso / 2, y1 };
      if (choca(q)) continue;
      hechas.push(q);
      nuevas.push({ id, x: cx, y: y0, tira: { hasta: y1 } });
    }
  }

  // Fuera las piezas sueltas del macizo que quedan delante de una cara o dentro de una tira vertical.
  mapa.colocados = mapa.colocados.filter(c => c.tira || !hechas.some(h => c.x > h.x0 - 6 && c.x < h.x1 + 6 && c.y > h.y0 + (h.y1 - h.y0) * 0.55 && c.y < h.y1 + 6
    && maz(Math.floor(c.x / cel), Math.floor(Math.min(c.y, h.y1 - 6) / cel))));
  mapa.colocados.push(...nuevas);
  return nuevas.length;
}

// Puentes: la tabla mide al menos sus dos extremos y puede pasar del río a tierra; lo que tenga debajo (macizo, piezas
// sueltas) se despeja para que se pueda andar por ella hasta el final. Tras Dibujo.expandirTiras.
export function despejarPuentes(mapa: MapaAventura, pasos: Rect[]): void {
  const z = mapa.macizo;
  for (const q of pasos) {
    if (z) for (let j = Math.max(0, Math.floor((q.y0 - 6) / z.cel)); j <= Math.min(z.filas - 1, Math.floor((q.y1 + 6) / z.cel)); j++)
      for (let i = Math.max(0, Math.floor((q.x0 - 6) / z.cel)); i <= Math.min(z.cols - 1, Math.floor((q.x1 + 6) / z.cel)); i++) z.datos[j * z.cols + i] = 0;
    // también lo que está justo al sur: en 3/4 lo alto de delante taparía la tabla
    mapa.colocados = mapa.colocados.filter(c => /^puente_/.test(c.id) || !(c.x > q.x0 - 22 && c.x < q.x1 + 22 && c.y > q.y0 - 10 && c.y < q.y1 + 60));
  }
}
