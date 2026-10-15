// Reglas del combate en tiempo real (docs/GDD-combate.md §3): las fórmulas oficiales de los juegos (stats, daño,
// eficacia, experiencia) con lo que el tiempo real necesita: enfriamiento de cada movimiento, estados que duran
// segundos y cambios de stats que se pasan solos. Puras: no saben nada de Phaser.
import { LINEAS, expNivel, forma, type Base6, type Linea } from '../data/pokedex';
import { eficacia, getMove, tiposDe, type Boosts, type MoveData, type Stat6, type TypeName } from '../data/movimientos';

export const GCD = 1.1;                  // s: enfriamiento global tras cualquier movimiento (como en un MMO)
export const ALCANCE_CUERPO = 30;        // px: movimientos de contacto
export const ALCANCE_DISTANCIA = 150;    // px: el resto
export const IV = 15;                    // valor individual medio (0-31) para todos: sin crianza

export type StatId = 'atk' | 'def' | 'spa' | 'spd' | 'spe';
export interface Stats { hp: number; atk: number; def: number; spa: number; spd: number; spe: number }

// Stats a un nivel (fórmulas oficiales, sin esfuerzo ni naturaleza).
export function statsDe(base: Base6, nv: number): Stats {
  const s = (b: number) => Math.floor((2 * b + IV) * nv / 100) + 5;
  return { hp: Math.floor((2 * base[0] + IV) * nv / 100) + nv + 10, atk: s(base[1]), def: s(base[2]), spa: s(base[3]), spd: s(base[4]), spe: s(base[5]) };
}
export const lineaDe = (id: string): Linea => LINEAS[id];
export const formaDe = (linea: string, nv: number) => forma(LINEAS[linea], nv);

// Multiplicador de una etapa de stat (−6…+6); precisión y evasión van por tercios.
export const etapa = (n: number, precision = false) => {
  const b = precision ? 3 : 2;
  return n >= 0 ? (b + n) / b : b / (b - n);
};

// Enfriamiento de un movimiento (s): los flojos van a ritmo del global, los fuertes tardan más en volver.
export function enfriamiento(m: MoveData): number {
  if (m.category === 'Status') return m.status ? 12 : m.heal ? 14 : 8;
  const hits = Array.isArray(m.multihit) ? (m.multihit[0] + m.multihit[1]) / 2 : m.multihit ?? 1;
  const p = m.basePower * hits + (m.flags.includes('charge') || m.flags.includes('recharge') ? 40 : 0);
  return Math.max(GCD, Math.round((1.1 + Math.max(0, p - 40) / 16) * 10) / 10);
}
export const alcance = (m: MoveData) => m.flags.includes('contact') ? ALCANCE_CUERPO : ALCANCE_DISTANCIA;
// ¿Se lanza sobre otro? (los de estado sobre uno mismo, como Desarrollo, no necesitan objetivo).
export const necesitaObjetivo = (m: MoveData) => !['self', 'allySide', 'allies', 'adjacentAllyOrSelf', 'all'].includes(m.target);

export interface Atacante { nivel: number; stats: Stats; tipos: TypeName[]; boosts: Boosts; estado: string | null }
export interface Golpe { dano: number; eficacia: number; critico: boolean; falla: boolean }

// Daño de un movimiento (fórmula oficial de la Gen. V en adelante), con su precisión, sus críticos y el clima.
export function golpe(m: MoveData, a: Atacante, d: Atacante, clima: Clima | null = null, rnd = Math.random): Golpe {
  const ef = eficacia(m.type, d.tipos);
  const prec = precision(m, clima) === true ? Infinity : (precision(m, clima) as number) * etapa((a.boosts.accuracy ?? 0) - (d.boosts.evasion ?? 0), true);
  if (rnd() * 100 >= prec) return { dano: 0, eficacia: ef, critico: false, falla: true };
  if (m.category === 'Status' || ef === 0) return { dano: 0, eficacia: ef, critico: false, falla: false };
  if (m.fixedDamage === 'level') return { dano: a.nivel, eficacia: ef, critico: false, falla: false };
  if (typeof m.fixedDamage === 'number') return { dano: m.fixedDamage, eficacia: ef, critico: false, falla: false };
  const fis = m.category === 'Physical', crit = rnd() < [1 / 24, 1 / 8, 1 / 2, 1][Math.min(3, m.critRatio - 1)];
  // Un crítico ignora las bajadas propias y las subidas del rival.
  let ba = (fis ? a.boosts.atk : a.boosts.spa) ?? 0, bd = (fis ? d.boosts.def : d.boosts.spd) ?? 0;
  if (crit) { ba = Math.max(0, ba); bd = Math.min(0, bd); }
  // Tormenta de arena: los de Roca, Def. Esp. ×1,5. Nieve: los de Hielo, Defensa ×1,5.
  const climaD = (clima === 'arena' && !fis && d.tipos.includes('Rock')) || (clima === 'nieve' && fis && d.tipos.includes('Ice')) ? 1.5 : 1;
  const A = (fis ? a.stats.atk : a.stats.spa) * etapa(ba), D = Math.max(1, (fis ? d.stats.def : d.stats.spd) * etapa(bd) * climaD);
  const hits = Array.isArray(m.multihit) ? m.multihit[0] + Math.floor(rnd() * (m.multihit[1] - m.multihit[0] + 1)) : m.multihit ?? 1;
  let dano = Math.floor(Math.floor(Math.floor(2 * a.nivel / 5 + 2) * m.basePower * A / D) / 50) + 2;
  dano *= (crit ? 1.5 : 1) * (0.85 + rnd() * 0.15) * (a.tipos.includes(m.type) ? 1.5 : 1) * ef * climaTipo(m.type, clima);
  if (fis && a.estado === 'brn') dano *= 0.5;   // quemado: la mitad de daño físico
  return { dano: Math.max(1, Math.floor(dano)) * hits, eficacia: ef, critico: crit, falla: false };
}

// Experiencia por derrotar a un Pokémon (fórmula clásica b·L/7). b, la experiencia base, ≈ stats base totales / 5
// (Bulbasaur 318 → 64, la oficial).
export function expPor(linea: string, nv: number): number {
  const b = Math.round(formaDe(linea, nv).base.reduce((t, v) => t + v, 0) / 5);
  return Math.max(1, Math.floor(b * nv / 7));
}
export function nivelPorExp(linea: string, exp: number): number {
  const g = LINEAS[linea].exp;
  let n = 1;
  while (n < 100 && expNivel(g, n + 1) <= exp) n++;
  return n;
}
export const expDeNivel = (linea: string, nv: number) => expNivel(LINEAS[linea].exp, nv);

// Captura: lo fácil que es la especie × la Ball × lo debilitado que esté (a vida llena, un tercio; casi sin vida,
// casi entera) × 1,5 si está dormido, paralizado o congelado.
export function probCaptura(atrapa: number, ball: number, ps: number, psMax: number, estado: string | null): number {
  if (ball === Infinity) return 1;
  const vida = 1 - (2 / 3) * (ps / psMax), est = estado && ['slp', 'par', 'frz'].includes(estado) ? 1.5 : 1;
  return Math.min(1, atrapa * ball * vida * est * 1.25);
}

// Estados en tiempo real, como en los juegos con un "turno" de TURNO s:
// - Quemado: la mitad de daño físico y pierde 1/16 de su vida por turno.
// - Paralizado: se mueve a la mitad de velocidad y a veces no puede atacar (25 %).
// - Envenenado: pierde 1/8 por turno; gravemente envenenado, 1/16, 2/16, 3/16… (cada vez más).
// - Dormido o congelado: ni se mueve ni ataca. Un ataque de Fuego descongela; con sol no se congela.
// Son debufos con duración (como en un MMO): se pasan solos. Los que dañan siguen haciéndolo fuera de combate.
export const TURNO = 3;
export const DURA_ESTADO: Record<string, number> = { slp: 4, frz: 4, par: 30, psn: 24, tox: 21, brn: 30 };
export const DANO_ESTADO: Record<string, number> = { psn: 1 / 8, tox: 1 / 16, brn: 1 / 16 };
export const VEL_PARALIZADO = 0.5;
export const NOMBRE_ESTADO: Record<string, string> = { slp: 'Dormido', frz: 'Congelado', par: 'Paralizado', psn: 'Envenenado', tox: 'Gravemente envenenado', brn: 'Quemado' };
export const CORTO_ESTADO: Record<string, string> = { slp: 'DOR', frz: 'CON', par: 'PAR', psn: 'ENV', tox: 'TÓX', brn: 'QUE' };
export const COLOR_ESTADO: Record<string, number> = { slp: 0x8a93a8, frz: 0x7cc8f0, par: 0xe8c22c, psn: 0xa04fc0, tox: 0x7a2f9a, brn: 0xe0602c };

// ---- Clima (Danza Lluvia, Día Soleado, Tormenta Arena, Paisaje Nevado, Granizo) ----
// Dura DURA_CLIMA s en todo el mapa. Lluvia: Agua ×1,5 y Fuego ×½. Sol: Fuego ×1,5 y Agua ×½. Arena: Def. Esp. ×1,5 a
// los de Roca y daña 1/16 por turno a quien no sea Roca, Tierra ni Acero. Nieve: Defensa ×1,5 a los de Hielo. Granizo:
// daña 1/16 por turno a quien no sea de Hielo. Trueno y Vendaval no fallan con lluvia (50 % con sol); Ventisca no falla
// con nieve o granizo. Síntesis, Luz Lunar y Sol Matinal curan 2/3 con sol y 1/4 con otro clima.
export type Clima = 'lluvia' | 'sol' | 'arena' | 'nieve' | 'granizo';
export const DURA_CLIMA = 40;
export const CLIMA_DE: Record<string, Clima> = { raindance: 'lluvia', sunnyday: 'sol', sandstorm: 'arena', snowscape: 'nieve', hail: 'granizo' };
export const NOMBRE_CLIMA: Record<Clima, string> = { lluvia: 'Lluvia', sol: 'Sol intenso', arena: 'Tormenta de arena', nieve: 'Nieve', granizo: 'Granizo' };
export const FIN_CLIMA: Record<Clima, string> = { lluvia: 'Ha dejado de llover', sol: 'El sol vuelve a ser normal', arena: 'La tormenta de arena amaina', nieve: 'Ha dejado de nevar', granizo: 'Ha dejado de granizar' };
export function climaTipo(t: TypeName, c: Clima | null): number {
  if (c === 'lluvia') return t === 'Water' ? 1.5 : t === 'Fire' ? 0.5 : 1;
  if (c === 'sol') return t === 'Fire' ? 1.5 : t === 'Water' ? 0.5 : 1;
  return 1;
}
export function precision(m: MoveData, c: Clima | null): number | true {
  if (m.id === 'thunder' || m.id === 'hurricane') return c === 'lluvia' ? true : c === 'sol' ? 50 : m.accuracy;
  if (m.id === 'blizzard' && (c === 'nieve' || c === 'granizo')) return true;
  return m.accuracy;
}
// ¿Le hace daño este clima? (1/16 por turno)
export const danaClima = (c: Clima | null, tipos: TypeName[]) =>
  c === 'arena' ? !tipos.some(t => t === 'Rock' || t === 'Ground' || t === 'Steel') : c === 'granizo' ? !tipos.includes('Ice') : false;
// Curas que dependen del sol (fracción de la vida máxima), o null si el movimiento no es de esos.
export function curaClima(id: string, c: Clima | null): number | null {
  if (!['synthesis', 'moonlight', 'morningsun'].includes(id)) return null;
  return c === 'sol' ? 2 / 3 : c ? 1 / 4 : 1 / 2;
}
export const DURA_BOOST = 15;            // s que dura un cambio de stats
export const NOMBRE_STAT: Record<Stat6, string> = { atk: 'Atq', def: 'Def', spa: 'At. Esp', spd: 'Def. Esp', spe: 'Vel', accuracy: 'Precisión', evasion: 'Evasión' };

export { getMove, tiposDe };
