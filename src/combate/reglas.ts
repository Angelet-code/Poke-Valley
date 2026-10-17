// Reglas del combate en tiempo real (docs/GDD-combate.md §3): las fórmulas oficiales de los juegos (stats, daño,
// eficacia, experiencia) con lo que el tiempo real necesita: enfriamiento de cada movimiento, estados que duran
// segundos y cambios de stats que se pasan solos. Puras: no saben nada de Phaser.
import { LINEAS, expNivel, forma, type Base6, type Linea } from '../data/pokedex';
import { eficacia, getMove, tiposDe, type Boosts, type MoveData, type Stat6, type TypeName } from '../data/movimientos';
import { firmaAtaque, rangoAtaque } from '../data/lineasAtaque';

export const GCD = 1.5;                  // s: enfriamiento global tras cualquier movimiento (como en el WoW)
// Ritmo del combate (§3.4): todos los tiempos de los movimientos (lanzamientos, CDs, agotado) se diseñaron con un
// global de 1,1 s y se alargan en proporción con él.
export const RITMO = GCD / 1.1;
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

// ---- Balance de los movimientos (docs/GDD-combate.md §3.2) ----
// Cada movimiento paga su potencia efectiva con tiempo: un instantáneo da gratis R_INST de potencia/s (el relleno:
// Placaje, Ascuas); lanzar quieto, un 25 % más; lo que sobra se paga con enfriamiento, R_CD de potencia por segundo.
// Así cualquier rotación queda entre 27 y 39 de potencia/s (con el global de 1,5 s) y cada movimiento tiene su papel. El estudio movimiento a
// movimiento lo hace tools/balance_movimientos.mjs (lleva una copia de este modelo: si cambia aquí, cámbialo allí).
// Rango (§3.3, data/lineasAtaque.ts): cada rango por encima del I rinde BONO_RANGO de potencia/s más, lanzando y
// pagando enfriamiento, para que el siguiente de una línea (Megaagotar → Gigadrenado) sea mejor de verdad.
const R_INST = 40 / GCD, R_CAST = R_INST * 1.25, R_CD = 6 / RITMO, CAST_MIN = 1.5 * RITMO, CAST_MAX = 3 * RITMO, CARGA_MIN = 2.5 * RITMO;
export const BONO_RANGO = 2 / RITMO;
// Como en el WoW (§3.4): un movimiento es relleno (sin CD) o tiene un CD que se note, nunca de 2-3 s; y lo que pega en
// área tiene su CD propio (Ventisca, Terremoto), porque a varios rinde más.
export const CD_MIN = Math.round(6 * RITMO * 10) / 10, CD_AREA = Math.round(8 * RITMO * 10) / 10;
const AREA = ['allAdjacentFoes', 'allAdjacent'];
// Áreas (§3.2 "Forma"): zona donde apuntas con el ratón (Ventisca), alrededor de ti (Terremoto, los de sonido) o cono
// delante (los de viento). Si tocan a más de uno, cada golpe ×AREA_VARIOS (la regla oficial de los dobles).
export type FormaArea = 'zona' | 'cono' | 'alrededor';
export const ZONA_RADIO = 40, ALREDEDOR_RADIO = 50, CONO_LARGO = 90, CONO_ANGULO = 0.6, AREA_VARIOS = 0.75;   // px, rad (medio cono)
// Dirigidos (§3.7): los "especial a distancia a uno" sin nada más (Ascuas, Pistola Agua, Lanzallamas, Rayo…) no van
// al objetivo: salen como un proyectil hacia donde apuntas (ratón, a lo LoL, o stick derecho) y dan al primer enemigo
// que tocan; si no tocan a nadie, fallan. Al lanzarlos se puede seguir apuntando hasta que salen.
export const VEL_PROYECTIL = 300, ALCANCE_PROYECTIL = ALCANCE_DISTANCIA + 30, RADIO_PROYECTIL = 7;   // px/s, px, px
const FIRMA_DIRIGIDO = 'Special · 100 % · distancia · objetivo';
export const dirigido = (m: MoveData) => m.category === 'Special' && firmaAtaque(m).split(' · ').slice(1).join(' · ') === FIRMA_DIRIGIDO;
export function formaArea(m: MoveData): FormaArea | null {
  if (m.category === 'Status') return null;
  if (m.target === 'allAdjacent') return 'alrededor';
  if (m.target !== 'allAdjacentFoes') return null;
  if (m.id === 'blizzard') return 'zona';   // la Ventisca del WoW: cae donde apuntas, aunque sea de viento
  return m.flags.includes('wind') ? 'cono' : m.flags.includes('sound') ? 'alrededor' : 'zona';
}
export const AGOTADO = Math.round(2 * RITMO * 10) / 10; // s sin poder actuar tras Hiperrayo y los de `recharge`
export type Lanzamiento = 'instant' | 'cast' | 'canal';
export interface Perfil {
  lanza: Lanzamiento; t: number;         // tiempo de lanzamiento o de canalizado (s; 0 = instantáneo)
  cd: number;                            // enfriamiento propio (s), sin celeridad
  tics: number;                          // canalizados: golpes en los que se reparte
  interrumpe: boolean;                   // corta el lanzamiento del objetivo (los que hacen retroceder)
  agotado: number;                       // s sin poder actuar después
  escudo?: number;                       // Protección y familia: s que dura la ventana (§3.5)
  sinGlobal?: boolean;                   // no gasta ni espera el global (para poder reaccionar)
  burst?: boolean;                       // 5 PP: instantáneo con CD largo, para guardarlo (§3.5)
}
const r1 = (x: number) => Math.round(x * 10) / 10;
const golpesMedios = (m: MoveData) => Array.isArray(m.multihit) ? (m.multihit[0] + m.multihit[1]) / 2 : m.multihit ?? 1;
// Retroceso: en los datos, un efecto secundario sin estado ni cambios de stats.
const retrocede = (m: MoveData) => !!m.secondary?.chance && !m.secondary.status && !m.secondary.boosts && !m.secondary.selfBoosts;
// Potencia efectiva: golpes medios × precisión, con lo que vale lo que hace además.
export function potenciaEfectiva(m: MoveData): number {
  if (m.fixedDamage) return 45;
  let p = m.basePower * golpesMedios(m) * (m.accuracy === true ? 1 : m.accuracy / 100);
  if (m.drain) p *= 1.15;                                                                       // cura
  if (m.recoil) p *= 0.85;                                                                      // se hace daño
  if (m.secondary?.selfBoosts && Object.values(m.secondary.selfBoosts).some(v => v < 0)) p *= 0.85;   // Fuerza Bruta, Sofoco
  if (m.secondary && (m.secondary.status || m.secondary.boosts)) p += m.secondary.chance / 100 * 25;  // quemar, bajar stats…
  if (m.critRatio > 1) p *= 1.06;
  return p;
}
// Protección y familia (§3.5): una ventana corta en la que los golpes no te hacen nada (Aguante: no te debilitan);
// no gastan global, para poder pulsarla justo cuando va a llegar un golpe. El CD sale de sus PP (Detección, 5, es más
// rara que Protección, 10) y baja a la mitad si bloquea algo.
export const ESCUDO: Record<string, number> = {
  protect: 0.9, detect: 1.4, endure: 2, kingsshield: 0.9, spikyshield: 0.9, banefulbunker: 0.9, obstruct: 0.9, silktrap: 0.9, burningbulwark: 0.9,
};
const CD_ESCUDO = 15 * RITMO;            // con 10 PP; con menos, más (× √(10 / PP))
// Burst (§3.5): los de 5 PP (Hidrobomba, Llamarada, A Bocajarro…) salen al instante y vuelven cada CD_BURST s.
export const CD_BURST = 30;
const perfiles = new Map<string, Perfil>();
export function perfil(m: MoveData): Perfil {
  let p = perfiles.get(m.id);
  if (!p) perfiles.set(m.id, p = calcularPerfil(m));
  return p;
}
function calcularPerfil(m: MoveData): Perfil {
  const base: Perfil = { lanza: 'instant', t: 0, cd: GCD, tics: 1, interrumpe: false, agotado: 0 };
  if (m.category === 'Status') {
    if (ESCUDO[m.id]) return { ...base, cd: r1(CD_ESCUDO * Math.sqrt(10 / m.pp)), escudo: ESCUDO[m.id], sinGlobal: true };
    if (m.id === 'teleport') return { ...base, cd: 12 };
    if ((m.boosts?.spe ?? 0) > 0 || (m.selfBoosts?.spe ?? 0) > 0) return { ...base, cd: 20 };
    if (m.status === 'slp') return { ...base, lanza: 'cast', t: 1.5, cd: 20 };
    if (m.status) return { ...base, cd: 12 };
    if (m.heal || curaClima(m.id, null)) return { ...base, lanza: 'cast', t: 1.5, cd: 20 };
    if (m.target === 'all') return { ...base, lanza: 'cast', t: 1.5, cd: 40 };   // climas y campos
    return { ...base, cd: m.target === 'self' ? 20 : 10 };
  }
  const pe = potenciaEfectiva(m), contacto = m.flags.includes('contact'), recarga = m.flags.includes('recharge');
  const bono = BONO_RANGO * (rangoAtaque(m) - 1), rCast = R_CAST + bono, rCd = R_CD + bono;
  let lanza: Lanzamiento = 'instant', t = 0;
  const burst = m.pp <= 5 && !recarga && !m.fixedDamage && m.basePower > 0;
  if (burst) { /* instantáneo */ }
  else if (m.flags.includes('charge')) { lanza = 'cast'; t = r1(Math.min(CAST_MAX, Math.max(CARGA_MIN, pe / rCast))); }
  else if (contacto || recarga || m.priority > 0 || retrocede(m) || formaArea(m) === 'alrededor' || pe <= R_INST * GCD * 1.15) { /* instantáneo */ }
  else { lanza = m.multihit || m.drain ? 'canal' : 'cast'; t = r1(Math.min(CAST_MAX, Math.max(CAST_MIN, pe / rCast))); }
  const T = Math.max(GCD, t) + (recarga ? AGOTADO : 0), gratis = (t > 0 ? rCast : R_INST) * T;
  let cd = Math.max(GCD, r1((pe - gratis) / rCd));
  if (cd > GCD) cd = Math.max(cd, CD_MIN);
  if (m.priority > 0) cd = Math.max(cd, CD_MIN);
  if (AREA.includes(m.target)) cd = Math.max(cd, CD_AREA);
  if (burst) cd = Math.max(cd, CD_BURST);
  const tics = lanza === 'canal' ? (m.multihit ? Math.round(golpesMedios(m)) : 3) : 1;
  return { lanza, t, cd, tics, interrumpe: retrocede(m), agotado: recarga ? AGOTADO : 0, burst };
}
export const enfriamiento = (m: MoveData) => perfil(m).cd;

// Celeridad (el haste del WoW): la Velocidad acorta el global, los lanzamientos y los enfriamientos. Sale de la
// Velocidad base (Shuckle 0,81, Snorlax 0,88, Pikachu 1,04, Ninjask 1,2) por su etapa, con la etapa entre ×0,5 y ×1,5.
const etapaVel = (n: number) => Math.min(1.5, Math.max(0.5, etapa(n)));
export const celeridad = (velBase: number, etapaSpe = 0) => (0.8 + 0.4 * Math.min(velBase, 150) / 150) * etapaVel(etapaSpe);
// Velocidad al andar (px/s): la de base de cada uno (`vel`) por la Velocidad base y su etapa.
export const velAndar = (vel: number, velBase: number, etapaSpe = 0) => vel * (0.9 + 0.2 * Math.min(velBase, 150) / 150) * etapaVel(etapaSpe);
export const alcance = (m: MoveData) => {
  const fa = formaArea(m);
  return fa === 'alrededor' ? ALREDEDOR_RADIO : fa === 'cono' ? CONO_LARGO : m.flags.includes('contact') ? ALCANCE_CUERPO : ALCANCE_DISTANCIA;
};
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
// Drenadoras: no es un estado (puede ir con uno). Cada turno quita 1/8 de la vida y cura eso a quien la sembró; a los
// de Planta no les prende. En los juegos dura hasta que cambias de Pokémon; aquí, DURA_SEMILLA s (7 turnos).
export const DURA_SEMILLA = 21;
export const DANO_SEMILLA = 1 / 8;
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
// Clima de base de una zona (MapaAventura.clima): cada CLIMA_TRAMO s se sortea si lo hace o no. No daña por turnos.
export const CLIMA_TRAMO = 60;
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

// Lo que hace un movimiento además del daño, en frases para su ficha (solo lo que la simulación aplica de verdad:
// MundoAventura.efectos y .aplicar). Un movimiento de estado que aquí no hace nada lo dice.
const STAT_LARGO: Record<Stat6, string> = { atk: 'Ataque', def: 'Defensa', spa: 'Ataque Especial', spd: 'Defensa Especial', spe: 'Velocidad', accuracy: 'Precisión', evasion: 'Evasión' };
const FRACCION: Record<string, string> = { '1/2': 'la mitad', '1/3': 'un tercio', '1/4': 'un cuarto', '2/3': 'dos tercios', '3/4': 'tres cuartos', '33/100': 'un tercio', '1/8': 'un octavo' };
const fraccion = ([a, b]: [number, number]) => FRACCION[`${a}/${b}`] ?? `${a}/${b}`;
const ESTADO_FRASE: Record<string, string> = {
  slp: 'Lo duerme', frz: 'Lo congela', par: 'Lo paraliza', psn: 'Lo envenena', tox: 'Lo envenena gravemente', brn: 'Lo quema',
};
const ESTADO_INF: Record<string, string> = {
  slp: 'dormirlo', frz: 'congelarlo', par: 'paralizarlo', psn: 'envenenarlo', tox: 'envenenarlo gravemente', brn: 'quemarlo',
};
const EFECTO_ESTADO: Record<string, string> = {
  slp: 'ni se mueve ni ataca', frz: 'ni se mueve ni ataca; el Fuego lo descongela', par: 'va a media velocidad y a veces no ataca',
  psn: 'pierde 1/8 de su vida cada 3 s', tox: 'pierde vida cada 3 s, cada vez más', brn: 'hace la mitad de daño físico y pierde 1/16 cada 3 s',
};
const EFECTO_CLIMA: Record<Clima, string> = {
  lluvia: 'Agua ×1,5 y Fuego ×½', sol: 'Fuego ×1,5 y Agua ×½', arena: 'daña a quien no sea Roca, Tierra ni Acero',
  nieve: 'Defensa ×1,5 a los de Hielo', granizo: 'daña a quien no sea de Hielo',
};
function fraseBoosts(b: Boosts, tuyo: boolean): string[] {
  const grupos = new Map<number, string[]>();
  for (const [s, n] of Object.entries(b) as [Stat6, number][]) if (n) grupos.set(n, [...(grupos.get(n) ?? []), STAT_LARGO[s]]);
  return [...grupos].sort((a, b) => b[0] - a[0]).map(([n, ss]) => {
    const lista = ss.length > 1 ? `${ss.slice(0, -1).join(', ')} y ${ss[ss.length - 1]}` : ss[0];
    const niv = `${Math.abs(n)} nivel${Math.abs(n) > 1 ? 'es' : ''}`;
    return `${n > 0 ? 'Sube' : 'Baja'} ${niv} ${tuyo ? 'tu' : ss[0].startsWith('Ataque') ? 'el' : 'la'} ${lista}${tuyo ? '' : ' del objetivo'} (${DURA_BOOST} s)`;
  });
}
export function descEfecto(m: MoveData): string[] {
  const out: string[] = [], aTi = !necesitaObjetivo(m);
  if (m.boosts) out.push(...fraseBoosts(m.boosts, aTi));
  if (m.selfBoosts) out.push(...fraseBoosts(m.selfBoosts, true));
  if (m.status) out.push(`${ESTADO_FRASE[m.status] ?? m.status} ${DURA_ESTADO[m.status]} s: ${EFECTO_ESTADO[m.status] ?? ''}`);
  if (m.id === 'leechseed') out.push(`Lo siembra ${DURA_SEMILLA} s: cada ${TURNO} s le quita 1/8 de su vida y te cura eso. No prende a los de Planta`);
  if (m.heal) out.push(`Te cura ${fraccion(m.heal)} de tus PS`);
  if (curaClima(m.id, null)) out.push('Te cura la mitad de tus PS (dos tercios con sol, un cuarto con otro clima)');
  const c = CLIMA_DE[m.id];
  if (c) out.push(`${NOMBRE_CLIMA[c]} en todo el mapa ${DURA_CLIMA} s: ${EFECTO_CLIMA[c]}`);
  if (m.drain) out.push(`Te cura ${fraccion(m.drain)} del daño que hace`);
  if (m.recoil) out.push(`Te dañas ${fraccion(m.recoil)} del daño que hace`);
  const s = m.secondary;
  if (s) {
    if (s.status) out.push(`${s.chance} % de ${ESTADO_INF[s.status] ?? s.status}`);
    if (s.boosts) out.push(...fraseBoosts(s.boosts, false).map(f => `${s.chance} %: ${f[0].toLowerCase()}${f.slice(1)}`));
    if (s.selfBoosts) out.push(...fraseBoosts(s.selfBoosts, true).map(f => `${s.chance} %: ${f[0].toLowerCase()}${f.slice(1)}`));
  }
  if (!out.length && m.category === 'Status') out.push('Aún no hace nada en este modo');
  return out;
}

export { getMove, tiposDe };
