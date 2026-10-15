// El mapa del mundo (M y luego rueda abajo o clic derecho): las zonas del modo aventura en una cuadrícula, unidas por
// los caminos de sus salidas (docs/GDD-mundo.md). La colocación es a mano: hacer todas las zonas para leer sus salidas
// tarda casi un segundo. Al añadir una zona: su casilla aquí y su camino.
import type { MapaId } from './bosque';
import { ARCANE } from '../config';

export interface ZonaMundo { id: MapaId; col: number; fila: number; nivel: string }
export const COLS_MUNDO = 3, FILAS_MUNDO = 4;
export const ZONAS_MUNDO: ZonaMundo[] = [
  { id: 'volcan', col: 0, fila: 0, nivel: 'Nv 18-24' }, { id: 'ruinas', col: 1, fila: 0, nivel: 'Nv 14-20' }, { id: 'nieve', col: 2, fila: 0, nivel: 'Nv 20-26' },
  { id: 'cantera', col: 0, fila: 1, nivel: 'Nv 10-16' }, { id: 'pantano', col: 1, fila: 1, nivel: 'Nv 12-18' },
  { id: 'bosque', col: 0, fila: 2, nivel: 'Nv 1-7' }, { id: 'lago', col: 1, fila: 2, nivel: 'Nv 5-10' }, { id: 'costa', col: 2, fila: 2, nivel: 'Nv 8-14' },
  { id: 'pueblo', col: 0, fila: 3, nivel: 'Tu hogar' },
];
export const CAMINOS: [MapaId, MapaId][] = [
  ['pueblo', 'bosque'], ['bosque', 'lago'], ['lago', 'costa'], ['bosque', 'cantera'], ['cantera', 'pantano'],
  ['pantano', 'ruinas'], ['ruinas', 'volcan'], ['ruinas', 'nieve'],
];

// Miniaturas de las zonas visitadas (JPEG en base64), por estilo y semilla del mundo: las hace Aventura al entrar en
// cada zona y el mapa del mundo las enseña; una zona sin miniatura sale en niebla.
const CLAVE = 'pokemon-valley/miniaturas';
interface Guardadas { clave: string; zonas: Partial<Record<MapaId, string>> }
const claveDe = (semilla: number) => `${ARCANE ? 'arcane' : 'dibujo'}-${semilla}`;
export function miniaturas(semilla: number): Partial<Record<MapaId, string>> {
  try {
    const g = JSON.parse(localStorage.getItem(CLAVE) ?? 'null') as Guardadas | null;
    return g?.clave === claveDe(semilla) ? g.zonas : {};
  } catch { return {}; }
}
export function guardarMiniatura(semilla: number, id: MapaId, datos: string): void {
  try { localStorage.setItem(CLAVE, JSON.stringify({ clave: claveDe(semilla), zonas: { ...miniaturas(semilla), [id]: datos } })); } catch { /* sin almacenamiento: solo esta sesión */ }
}

// Cada salida tiene que estar en el lado por el que queda su zona en el mundo (si sales del pueblo por el norte, el
// bosque está encima y su salida al pueblo, abajo). Aventura lo revisa al montar cada zona y avisa en la consola.
export function revisarSalidas(m: { id: MapaId; W: number; H: number; salidas: { x0: number; y0: number; x1: number; y1: number; a: MapaId }[] }): string[] {
  const aqui = ZONAS_MUNDO.find(z => z.id === m.id), mal: string[] = [];
  if (!aqui) return mal;
  for (const s of m.salidas) {
    const alla = ZONAS_MUNDO.find(z => z.id === s.a);
    if (!alla) continue;
    const cx = (s.x0 + s.x1) / 2, cy = (s.y0 + s.y1) / 2, d = [cy, m.H - cy, m.W - cx, cx], lado = ['n', 's', 'e', 'o'][d.indexOf(Math.min(...d))];
    const dc = alla.col - aqui.col, df = alla.fila - aqui.fila;
    const toca = Math.abs(dc) + Math.abs(df) !== 1 ? null : df === -1 ? 'n' : df === 1 ? 's' : dc === 1 ? 'e' : 'o';
    if (!CAMINOS.some(([a, b]) => (a === m.id && b === s.a) || (b === m.id && a === s.a))) mal.push(`${m.id} → ${s.a}: falta el camino en data/mundo.ts`);
    if (toca !== lado) mal.push(`${m.id} → ${s.a}: la salida está al ${lado} pero en el mundo ${s.a} ${toca ? `queda al ${toca}` : 'no es vecina'}`);
  }
  return mal;
}
