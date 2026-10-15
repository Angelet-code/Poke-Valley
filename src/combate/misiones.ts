// Misiones sin diálogo del modo aventura (docs/GDD-mundo.md §2): el tablón del pueblo ofrece 3 por zona, que se
// dicen solo con iconos (la cara del Pokémon, un número y la Ball o el objeto):
// - derrotar N de la especie más común de la zona;
// - capturar uno de otra especie de la zona;
// - derrotar al alfa de la zona.
// Salen de las zonas del mundo de la partida (data/bosque.ts, con su semilla), así que piden especies que de verdad
// están. Puras: el progreso se guarda en la partida (combate/partida.ts, `estado.misiones`).
import { crearMapa, type MapaAventura, type MapaId } from '../data/bosque';
import { FORMAS } from '../data/pokedex';
import { expPor, formaDe } from './reglas';

export type TipoMision = 'derrotar' | 'capturar' | 'alfa';
export type EstadoMision = 'nueva' | 'activa' | 'lista' | 'hecha';
export interface Mision {
  id: string; zona: MapaId; tipo: TipoMision;
  linea: string;               // línea que cuenta (cualquiera de sus formas)
  dex: string;                 // la cara del icono
  n: number;
  premio: { exp: number; items: [string, number][] };
}

export const ZONAS_MISION: MapaId[] = ['bosque', 'lago'];
export const NOMBRE_ZONA: Record<MapaId, string> = { pueblo: 'Pueblo', bosque: 'Bosque Verde', lago: 'Lago Celeste',
  costa: 'Costa Brisa', cantera: 'Cantera Gris', pantano: 'Pantano Umbrío', ruinas: 'Ruinas Antiguas', volcan: 'Volcán Ascua', nieve: 'Cumbres Heladas', taller: 'Taller', ciudad: 'Ciudad' };
// Por zona: cuántos derrotar y lo que da cada misión además de la experiencia.
const AJUSTE: Partial<Record<MapaId, { derrotar: number; items: Record<TipoMision, [string, number][]> }>> = {
// Acorde al nivel de la zona (combate/botin.ts): en el bosque nada mejor que Poké Balls y Pociones; el alfa del lago
// (Nv 12) ya da lo del siguiente escalón.
  bosque: { derrotar: 5, items: { derrotar: [['oran', 3]], capturar: [['pokeball', 3]], alfa: [['pokeball', 5], ['pocion', 3]] } },
  lago: { derrotar: 6, items: { derrotar: [['pocion', 3]], capturar: [['pokeball', 4]], alfa: [['superball', 2], ['superpocion', 2]] } },
};

function deZona(m: MapaAventura): Mision[] {
  const aj = AJUSTE[m.id];
  if (!aj) return [];
  // Especies por cuántas hay (y su nivel medio).
  const cuenta = new Map<string, { n: number; nv: number }>();
  for (const s of m.salvajes) { const c = cuenta.get(s.linea) ?? { n: 0, nv: 0 }; c.n++; c.nv += s.nivel; cuenta.set(s.linea, c); }
  const orden = [...cuenta.entries()].sort((a, b) => b[1].n - a[1].n || a[0].localeCompare(b[0]));
  const out: Mision[] = [];
  const nvMedio = (l: string) => Math.round(cuenta.get(l)!.nv / cuenta.get(l)!.n);
  if (orden[0]) {
    const l = orden[0][0], nv = nvMedio(l);
    out.push({ id: `${m.id}-derrotar-${l}`, zona: m.id, tipo: 'derrotar', linea: l, dex: formaDe(l, nv).dex, n: aj.derrotar,
      premio: { exp: expPor(l, nv) * 3, items: aj.items.derrotar } });
  }
  if (orden[1]) {
    const l = orden[1][0], nv = nvMedio(l);
    out.push({ id: `${m.id}-capturar-${l}`, zona: m.id, tipo: 'capturar', linea: l, dex: formaDe(l, nv).dex, n: 1,
      premio: { exp: expPor(l, nv) * 2, items: aj.items.capturar } });
  }
  if (m.alfa) {
    const a = m.alfa;
    out.push({ id: `${m.id}-alfa`, zona: m.id, tipo: 'alfa', linea: a.linea, dex: FORMAS[a.forma]?.dex ?? formaDe(a.linea, a.nivel).dex, n: 1,
      premio: { exp: expPor(a.linea, a.nivel) * 4, items: aj.items.alfa } });
  }
  return out;
}

// Las misiones del mundo de una partida (se calculan una vez por semilla: generar las zonas cuesta unos ms).
let cache: { semilla: number; lista: Mision[] } | null = null;
export function misionesDe(semilla: number): Mision[] {
  if (cache?.semilla !== semilla) cache = { semilla, lista: ZONAS_MISION.flatMap(z => deZona(crearMapa(z, semilla))) };
  return cache.lista;
}
