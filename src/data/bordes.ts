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
import { F, PNG_X } from './mapaDibujo';
import { rng } from '../util';

// Por bioma: qué tira horizontal (con su peso) y cuál vertical (solo las ruinas: en la naturaleza, un muro vertical
// parecía una tira de piedra fuera de sitio); `p`: probabilidad de usar un tramo de borde que valga.
const BORDES: Record<Bioma, { h: [string, number][]; v: [string, number][]; p: number }> = {
  costa: { h: [['acantilado', 1]], v: [], p: 0.75 },
  cantera: { h: [['acantilado', 0.8], ['muro', 0.2]], v: [], p: 0.85 },
  pantano: { h: [['acantilado', 0.6], ['muro', 0.4]], v: [], p: 0.7 },
  ruinas: { h: [['muro', 0.6], ['acantilado', 0.4]], v: [['muro_v', 1]], p: 0.8 },
  volcan: { h: [['acantilado', 0.8], ['muro', 0.2]], v: [], p: 0.8 },
  nieve: { h: [['acantilado', 0.7], ['muro', 0.3]], v: [], p: 0.75 },
};
const BANDA = 6;     // celdas que puede subir y bajar el borde dentro de un tramo (48 px); la tira lo endereza
const MAX = 80;      // celdas de largo máximo de un tramo (640 px): más largo, se parte

export interface Rect { x0: number; y0: number; x1: number; y1: number }

// Cuántos tramos de borde sur se pusieron o se descartaron, y por qué (para ajustar BANDA, `p`…; la última zona montada).
export const DIAG: Record<string, number> = {};
export function tirasDeBorde(mapa: MapaAventura, porId: Map<string, Elemento>, agua: (x: number, y: number) => boolean): Rect[] {
  const z = mapa.macizo, bio = mapa.suelo, def = bio && BORDES[bio];
  if (!z || !bio || !def) return [];
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

  // Trozos de lo que no es macizo (el agua cuenta como paso: los puentes aún no están), sin contar los de menos de 6
  // celdas. Enderezar un borde no puede aumentarlos.
  const trozos = () => {
    const visto = new Uint8Array(cols * filas), pila: number[] = [];
    let n = 0;
    for (let k0 = 0; k0 < cols * filas; k0++) {
      if (datos[k0] || visto[k0]) continue;
      let tam = 0;
      visto[k0] = 1; pila.push(k0);
      while (pila.length) {
        const k = pila.pop()!, i = k % cols, j = (k - i) / cols;
        tam++;
        for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const ni = i + di, nj = j + dj, nk = nj * cols + ni;
          if (ni < 0 || nj < 0 || ni >= cols || nj >= filas || datos[nk] || visto[nk]) continue;
          visto[nk] = 1; pila.push(nk);
        }
      }
      if (tam >= 6) n++;
    }
    return n;
  };
  // Sur: celda de macizo con suelo pisable debajo.
  const sur = tramos(cols, filas, (i, j) => maz(i, j) && pisa(i, j + 1));
  for (const k in DIAG) delete DIAG[k];
  const no = (m: string) => { DIAG[m] = (DIAG[m] ?? 0) + 1; };
  for (const t of sur) {
    if ((t.b - t.a + 1) * cel < 160) { no('corto'); continue; }
    if (r() > def.p) { no('azar'); continue; }
    const x0 = t.a * cel, x1 = (t.b + 1) * cel, base = (t.hi + 1) * cel + 2;
    const ops = def.h.filter(([p]) => {
      const m = medidasTira(`${p}_${bio}`, porId);
      return m && x1 - x0 >= m.minimo + m.tramo && macizoEn(x0 + 8, base - m.grueso, x1 - 8, (t.lo + 1) * cel);
    });
    // Delante, al menos 40 px de paso (enderezar no puede cerrar un pasillo).
    let libres = 0;
    for (let i = t.a; i <= t.b; i++) for (let j = t.hi + 1; j <= t.hi + 5; j++) if (pisa(i, j)) libres++;
    if (libres < (t.b - t.a + 1) * 5 * 0.85) { no('sin paso delante'); continue; }
    if (!ops.length) { no(def.h.some(([p]) => x1 - x0 >= (medidasTira(`${p}_${bio}`, porId)?.minimo ?? 1e9)) ? 'tapa paso' : 'no cabe'); continue; }
    const id = `${elegir(ops)}_${bio}`, m = medidasTira(id, porId)!;
    const q = { x0, y0: base - m.grueso, x1, y1: base + 4 };
    if (choca(q)) { no('choca'); continue; }
    // Enderezar: lo que quedaba pisable detrás de la cara (entre el borde y la base) pasa a macizo. Si con eso lo
    // pisable se parte en más trozos (un pasillo estrecho que cruzaba la banda), se deshace y no hay tira.
    const antes = trozos(), guardado: number[] = [];
    for (let i = t.a; i <= t.b; i++) for (let j = t.lo; j <= t.hi; j++) if (!datos[j * cols + i]) { guardado.push(j * cols + i); datos[j * cols + i] = 1; }
    if (guardado.length && trozos() > antes) { for (const k of guardado) datos[k] = 0; no('cortaría paso'); continue; }
    no('puesta');
    hechas.push(q);
    nuevas.push({ id, x: x0, y: base, tira: { hasta: x1 } });
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
  return hechas;
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

// ---- El macizo, vestido (2026-10-15) ----
// Antes se llenaba con ~900 piezas sueltas al azar (biomas.ts, pasos 4 y 6). Ahora se quitan las que caen en el macizo
// y se viste por capas, de mayor a menor: montañas y arboledas del bioma (los assets grandes de tiras_arcane.py), las
// mismas a media escala, piezas medianas en lo que quede y piezas bajas en el borde. Una pieza solo se pone si TODO lo que pinta (su silueta,
// `cubre` del catálogo: lab/tools/mascaras_arcane.py) cae en el macizo y fuera de las caras de las tiras: así nunca tapa
// un pasillo, y lo que se ve abierto se puede pisar. Y solo si cubre bastante macizo que aún no estaba cubierto.
const VESTIR: Record<Bioma, { grande: [string, number][]; medio: string[]; bajo: string[] }> = {
  costa: { grande: [['arboleda', 1], ['montana', 0.35]], medio: ['palmera', 'roca_costa', 'palmera'], bajo: ['roca_costa', 'hierba_duna'] },
  cantera: { grande: [['montana', 1], ['arboleda', 0.8]], medio: ['aguja_roca', 'roca_mineral', 'pino_seco'], bajo: ['roca_mineral', 'arbusto_seco'] },
  pantano: { grande: [['arboleda', 1], ['montana', 0.5]], medio: ['arbol_muerto', 'roca_musgo', 'arbol_muerto'], bajo: ['roca_musgo', 'tronco_podrido', 'juncos_secos'] },
  ruinas: { grande: [['arboleda', 1], ['montana', 0.45]], medio: ['arbol_flores', 'columna_rota', 'arbol_flores'], bajo: ['columna_rota', 'flores_hada'] },
  volcan: { grande: [['montana', 0.8], ['arboleda', 1]], medio: ['roca_basalto', 'roca_magma', 'arbol_quemado', 'obsidiana'], bajo: ['roca_magma', 'obsidiana'] },
  nieve: { grande: [['arboleda', 1], ['montana', 0.7]], medio: ['pino_nevado', 'roca_nevada', 'pino_nevado'], bajo: ['roca_nevada', 'monton_nieve', 'arbusto_nevado'] },
};
// Cuántas piezas se pusieron y cuánto macizo quedó sin cubrir (celdas) en la última zona, para ajustar.
export const VESTIDO: { piezas: number; sinCubrir: number } = { piezas: 0, sinCubrir: 0 };

export function vestirMacizo(mapa: MapaAventura, porId: Map<string, Elemento>, caras: Rect[]): void {
  const z = mapa.macizo, bio = mapa.suelo, def = bio && VESTIR[bio];
  if (!z || !bio || !def) return;
  const { cel, cols, filas, datos } = z, r = rng(cols * 104729 + filas * 7 + bio.charCodeAt(1));
  const enMaz = (i: number, j: number) => i < 0 || j < 0 || i >= cols || j >= filas || datos[j * cols + i] === 1;
  // Fuera lo suelto que cae en el macizo (las tiras y lo que está en lo pisable se quedan).
  mapa.colocados = mapa.colocados.filter(c => c.tira || !enMaz(Math.floor(c.x / cel), Math.floor(Math.min(c.y, mapa.H - 1) / cel)));
  // Celdas prohibidas: la cara de cada tira (su 60 % de abajo); por encima pueden asomar rocas o árboles de detrás.
  const prohibida = new Uint8Array(cols * filas), cubierta = new Uint8Array(cols * filas);
  for (const q of caras) for (let j = Math.max(0, Math.floor((q.y1 - (q.y1 - q.y0) * 0.6) / cel)); j <= Math.min(filas - 1, Math.floor(q.y1 / cel)); j++)
    for (let i = Math.max(0, Math.floor(q.x0 / cel)); i <= Math.min(cols - 1, Math.floor(q.x1 / cel)); i++) { prohibida[j * cols + i] = 1; cubierta[j * cols + i] = 1; }
  // Celdas que pinta una pieza puesta en (x, y): las de su silueta (rejilla `cubre`, o la caja si no la tiene); -1 si
  // caen fuera del mapa.
  const celdas = (e: Elemento, x: number, y: number, s: number, flip: boolean): number[] => {
    const u = F / PNG_X * (e.k ?? 1) * s, w = e.w * u, h = e.h * u, left = x - (flip ? e.w - e.ancla[0] : e.ancla[0]) * u, top = y - e.ancla[1] * u;
    const m = e.cubre, out: number[] = [];
    for (let j = Math.floor(top / cel); j <= Math.floor((top + h) / cel); j++) for (let i = Math.floor(left / cel); i <= Math.floor((left + w) / cel); i++) {
      const fx = ((i + 0.5) * cel - left) / w, fy = ((j + 0.5) * cel - top) / h;
      if (fx < 0 || fy < 0 || fx >= 1 || fy >= 1) continue;
      if (m) {
        const mi = Math.min(m.c - 1, Math.floor((flip ? 1 - fx : fx) * m.c)), mj = Math.min(m.f - 1, Math.floor(fy * m.f));
        if (m.b[mj * m.c + mi] !== '1') continue;
      }
      out.push(i < 0 || j < 0 || i >= cols || j >= filas ? -1 : j * cols + i);
    }
    return out;
  };
  const nuevas: Colocado[] = [];
  // Pone `id` en (x, y) si lo pintado cae en macizo (o fuera del mapa) salvo `tolerancia` (fracción), nada en las
  // caras, y si cubre al menos `minNuevo` (fracción) de macizo aún sin cubrir.
  const probar = (id: string, x: number, y: number, s: number, minNuevo: number, tolerancia: number): boolean => {
    const e = porId.get(id);
    if (!e) return false;
    const flip = r() < 0.5, cs = celdas(e, x, y, s, flip);
    if (cs.length < 3) return false;
    let malas = 0, nuevasC = 0;
    for (const k of cs) {
      if (k < 0) continue;
      if (prohibida[k]) return false;
      if (!datos[k]) malas++;
      else if (!cubierta[k]) nuevasC++;
    }
    if (malas > cs.length * tolerancia || nuevasC < cs.length * minNuevo) return false;
    for (const k of cs) if (k >= 0) cubierta[k] = 1;
    nuevas.push({ id, x: Math.round(x), y: Math.round(y), flip, s: Math.round(s * 100) / 100 });
    return true;
  };
  const elegir = (ops: [string, number][]) => {
    let t = r() * ops.reduce((a, o) => a + o[1], 0);
    for (const o of ops) if ((t -= o[1]) <= 0) return o[0];
    return ops[0][0];
  };
  const W = cols * cel, H = filas * cel;
  // 1. Grandes, en rejilla al tresbolillo; de arriba abajo (las de delante tapan el pie de las de detrás).
  for (let y = 40, f = 0; y < H + 140; y += 46, f++) for (let x = -50 + (f % 2) * 29; x < W + 60; x += 58)
    probar(`${elegir(def.grande)}_${bio}`, x + (r() - 0.5) * 36, y + (r() - 0.5) * 30, 0.75 + r() * 0.4, 0.3, 0.02);
  // 2. Las grandes a media escala en lo que quede (franjas estrechas: minibosques y montículos, no filas de piedras).
  for (let y = 20, f = 0; y < H + 80; y += 26, f++) for (let x = -20 + (f % 2) * 16; x < W + 30; x += 32) {
    const i = Math.floor(x / cel), j = Math.floor(y / cel);
    if (i >= 0 && j >= 0 && i < cols && j < filas && (cubierta[j * cols + i] || !datos[j * cols + i])) continue;
    probar(`${elegir(def.grande)}_${bio}`, x + (r() - 0.5) * 14, y + (r() - 0.5) * 10, 0.42 + r() * 0.2, 0.35, 0.03);
  }
  // 3. Medianas en lo que quede (rejilla más fina).
  for (let y = 10; y < H + 60; y += 16) for (let x = -10; x < W + 20; x += 16) {
    const i = Math.floor(x / cel), j = Math.floor(y / cel);
    if (i >= 0 && j >= 0 && i < cols && j < filas && (cubierta[j * cols + i] || !datos[j * cols + i])) continue;
    probar(def.medio[Math.floor(r() * def.medio.length)], x + (r() - 0.5) * 10, y + (r() - 0.5) * 8, 0.85 + r() * 0.35, 0.35, 0.04);
  }
  // 4. Bajas solo en el borde con lo pisable que siga sin cubrir (donde lo alto taparía lo de encima), separadas
  // entre sí. Lo que quede sin cubrir dentro no se ve desde los caminos; en el borde, la escena lo abre (abrirMacizo).
  const bajas: { x: number; y: number }[] = [];
  const pisableJunto = (i: number, j: number) => [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([di, dj]) => !enMaz(i + di, j + dj));
  for (let j = 0; j < filas; j++) for (let i = 0; i < cols; i++) {
    const k = j * cols + i;
    if (!datos[k] || cubierta[k] || prohibida[k] || !pisableJunto(i, j)) continue;
    const x = (i + 0.5) * cel, y = (j + 1) * cel;
    if (bajas.some(b => Math.abs(b.x - x) < 18 && Math.abs(b.y - y) < 12)) continue;
    bajas.push({ x, y });
    for (let t = 0; t < 3; t++) if (probar(def.bajo[Math.floor(r() * def.bajo.length)], x + (r() - 0.5) * 6, y + 2, 0.7 + r() * 0.3, 0.2, 0.15)) break;
  }
  let sin = 0;
  for (let k = 0; k < cols * filas; k++) if (datos[k] && !cubierta[k]) sin++;
  VESTIDO.piezas = nuevas.length; VESTIDO.sinCubrir = sin;
  mapa.colocados.push(...nuevas);
}
