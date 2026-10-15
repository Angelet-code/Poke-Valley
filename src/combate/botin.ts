// Botín por nivel (docs/GDD-mundo.md §2b): lo que sueltan los salvajes y lo que hay tirado por el suelo de cada zona.
// Como en los juegos: en las primeras zonas solo Poké Balls, Pociones y Bayas Aranja; las Super y las Hiper salen
// cuando el nivel lo pide. El nivel es el del salvaje (lo que suelta) o el de la zona (lo del suelo, `nivelZona`).
import type { MapaAventura } from '../data/bosque';

export type Tier = 1 | 2 | 3;
export const tierDe = (nivel: number): Tier => nivel < 10 ? 1 : nivel < 18 ? 2 : 3;

// Peso de cada objeto por tier.
const TABLA: Record<Tier, [string, number][]> = {
  1: [['oran', 30], ['pocion', 30], ['pokeball', 30]],
  2: [['oran', 10], ['pocion', 20], ['superpocion', 15], ['sitrus', 10], ['pokeball', 25], ['superball', 12]],
  3: [['pocion', 5], ['superpocion', 25], ['hiperpocion', 12], ['sitrus', 18], ['pokeball', 8], ['superball', 20], ['ultraball', 10]],
};
// Lo mejor de cada tier: lo que suelta siempre un alfa.
export const MEJOR: Record<Tier, { ball: string; cura: string }> = {
  1: { ball: 'pokeball', cura: 'pocion' },
  2: { ball: 'superball', cura: 'superpocion' },
  3: { ball: 'ultraball', cura: 'hiperpocion' },
};

export function sortear(nivel: number, rnd: () => number): string {
  const t = TABLA[tierDe(nivel)], total = t.reduce((s, [, p]) => s + p, 0);
  let r = rnd() * total;
  for (const [id, p] of t) if ((r -= p) < 0) return id;
  return t[t.length - 1][0];
}

// Piedras evolutivas (data/pokedex.ts EVO_OBJETO): a veces en el suelo de cualquier zona y a veces del alfa, en
// lugar de lo de su nivel.
export const PIEDRAS = ['waterstone', 'thunderstone', 'firestone', 'leafstone', 'icestone'];
export const PROB_PIEDRA_SUELO = 0.12;
export const PROB_PIEDRA_ALFA = 0.3;
export const sortearPiedra = (rnd: () => number): string => PIEDRAS[Math.floor(rnd() * PIEDRAS.length)];

// Nivel de una zona: la mediana de sus salvajes (el pueblo, sin salvajes, 1).
export function nivelZona(m: MapaAventura): number {
  const n = m.salvajes.map(s => s.nivel).sort((a, b) => a - b);
  return n.length ? n[n.length >> 1] : 1;
}
