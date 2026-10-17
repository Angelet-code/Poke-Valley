// Gachapón de Meowth (docs/GDD-progreso.md §D2): en la ciudad, F junto a Meowth y una Moneda Meowth por tirada. Las
// monedas las sueltan los alfas (MundoAventura.recompensa). Casi siempre sale algo sencillo (bayas, Balls, curas,
// equipables); a veces una piedra, un Caramelo Raro o un Huevo; y, muy de vez en cuando, uno de los Pokémon del casino
// de Azulona. Dratini es el premio gordo: 1 de cada 5 000 tiradas. Sin Phaser y con la semilla de quien tira (`rnd`).
import { BAYAS_SALVAJES } from '../data/items';
import { EQUIPABLES, type Rareza } from './objetos';
import { PIEDRAS } from './botin';

export const MONEDA = 'moneda_meowth';
export const MONEDAS_ALFA = 1, PROB_MONEDA_EXTRA = 0.3;   // un alfa suelta una moneda y, a veces, otra más
export const HUEVO_DERROTAS = 25;                        // derrotas con el huevo en la mochila hasta que se abre

export type Premio =
  | { tipo: 'item'; id: string; n: number }
  | { tipo: 'poke'; linea: string; nivel: number };
// Una casilla de la tabla: lo que da (o cómo se sortea) y su peso, sobre 10 000.
type Casilla = { nombre: string; peso: number; clase: Clase; tira: (rnd: () => number) => Premio };
export type Clase = 'comun' | 'raro' | 'epico' | 'especial';   // el color con que se abre la cápsula (y el de la tabla)

const item = (id: string, n = 1) => () => ({ tipo: 'item' as const, id, n });
const de = <T>(l: readonly T[], rnd: () => number): T => l[Math.floor(rnd() * l.length)];
const equipable = (r: Rareza) => (rnd: () => number): Premio => ({ tipo: 'item', id: de(Object.values(EQUIPABLES).filter(e => e.rareza === r), rnd).id, n: 1 });
const poke = (linea: string, nivel: number) => () => ({ tipo: 'poke' as const, linea, nivel });

// Los niveles de los Pokémon del casino, los de Rojo Fuego/Verde Hoja (Clefairy, 10: el de su forma; Cleffa es antes).
export const TABLA: Casilla[] = [
  { nombre: 'Bayas ×2', peso: 3000, clase: 'comun', tira: rnd => ({ tipo: 'item', id: de(BAYAS_SALVAJES, rnd), n: 2 }) },
  { nombre: 'Poké Ball ×3', peso: 1400, clase: 'comun', tira: item('pokeball', 3) },
  { nombre: 'Super Ball ×2', peso: 700, clase: 'comun', tira: item('superball', 2) },
  { nombre: 'Ultra Ball', peso: 300, clase: 'raro', tira: item('ultraball') },
  { nombre: 'Poción ×2', peso: 600, clase: 'comun', tira: item('pocion', 2) },
  { nombre: 'Superpoción', peso: 400, clase: 'comun', tira: item('superpocion') },
  { nombre: 'Hiperpoción', peso: 200, clase: 'raro', tira: item('hiperpocion') },
  { nombre: 'Equipable común', peso: 1500, clase: 'comun', tira: equipable('comun') },
  { nombre: 'Equipable raro', peso: 700, clase: 'raro', tira: equipable('raro') },
  { nombre: 'Equipable épico', peso: 250, clase: 'epico', tira: equipable('epico') },
  { nombre: 'Piedra evolutiva', peso: 300, clase: 'raro', tira: rnd => ({ tipo: 'item', id: de(PIEDRAS, rnd), n: 1 }) },
  { nombre: 'Caramelo Raro', peso: 250, clase: 'epico', tira: item('rarecandy') },
  { nombre: 'Huevo', peso: 150, clase: 'epico', tira: item('huevo') },
  { nombre: 'Master Ball', peso: 20, clase: 'especial', tira: item('masterball') },
  { nombre: 'Abra', peso: 40, clase: 'especial', tira: poke('abra', 9) },
  { nombre: 'Clefairy', peso: 30, clase: 'especial', tira: poke('clefairy', 10) },
  { nombre: 'Scyther', peso: 15, clase: 'especial', tira: poke('scyther', 25) },
  { nombre: 'Pinsir', peso: 15, clase: 'especial', tira: poke('pinsir', 25) },
  { nombre: 'Dratini', peso: 2, clase: 'especial', tira: poke('dratini', 18) },
];
const TOTAL = TABLA.reduce((s, c) => s + c.peso, 0);
export const probDe = (c: Casilla): number => c.peso / TOTAL;

export function tirar(rnd: () => number): { premio: Premio; clase: Clase } {
  let r = rnd() * TOTAL;
  for (const c of TABLA) if ((r -= c.peso) < 0) return { premio: c.tira(rnd), clase: c.clase };
  const c = TABLA[0];
  return { premio: c.tira(rnd), clase: c.clase };
}

// Lo que sale de un huevo: un bebé (o el primero de su línea) a nivel 1. Las líneas, las de data/pokedex.ts.
export const HUEVOS = ['pikachu', 'clefairy', 'marill', 'togepi', 'elekid', 'magby', 'smoochum', 'riolu', 'munchlax', 'eevee'];
export const abrirHuevo = (rnd: () => number): string => de(HUEVOS, rnd);
