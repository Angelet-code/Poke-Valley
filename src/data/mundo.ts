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
