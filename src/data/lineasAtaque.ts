// Líneas de ataque (docs/GDD-combate.md §3.3): los movimientos que son "evoluciones" unos de otros, del más flojo al
// más fuerte (Absorber → Megaagotar → Gigadrenado), con la misma firma (firmaAtaque): solo cambia la potencia.
// Cada uno tiene un rango (I-V) que sale de su potencia y, dentro de su línea, siempre es mayor que el del anterior:
// cada rango rinde más potencia por segundo (reglas.ts, BONO_RANGO),
// así que el siguiente de la línea es mejor de verdad y no "el mismo ataque en el doble de tiempo".
// Los que no están en ninguna línea van solos, con el rango de su potencia. Comprobación: tools/lineas_ataque.ts.
import { getMove, type MoveData } from './movimientos';

export const LINEAS_ATAQUE: Record<string, string[]> = {
  'Picaduras': ['fellstinger', 'bugbite', 'xscissor'],
  'Golpes sucios': ['payback', 'assurance', 'knockoff', 'foulplay'],
  'Garras dragón': ['dragonclaw', 'outrage'],
  'Alientos dragón': ['dragonbreath', 'dragonpulse'],
  'Chispas': ['nuzzle', 'spark', 'thunderpunch'],
  'Rayos': ['thundershock', 'thunderbolt'],
  'Vientos feéricos': ['fairywind', 'moonblast'],
  'Palmas': ['rocksmash', 'forcepalm', 'brickbreak'],
  'Golpes múltiples': ['armthrust', 'doublekick'],
  'Golpes de fuego': ['flamewheel', 'firepunch'],
  'Llamas': ['ember', 'flamethrower'],
  'Picos': ['peck', 'pluck', 'drillpeck'],
  'Maleficios': ['hex', 'shadowball'],
  'Golpes planta': ['branchpoke', 'vinewhip', 'leafblade'],
  'Semillas': ['leafage', 'seedbomb'],
  'Drenajes': ['absorb', 'megadrain', 'gigadrain'],
  'Seísmos': ['bulldoze', 'earthquake'],
  'Taladros': ['drillrun', 'highhorsepower'],
  'Lodos': ['mudslap', 'earthpower'],
  'Golpes de hielo': ['icepunch', 'icespinner'],
  'Rayos de hielo': ['aurorabeam', 'icebeam'],
  'Embestidas': ['tackle', 'bodyslam'],
  'Garras': ['scratch', 'slash'],
  'Golpes': ['pound', 'strength'],
  'Topetazos': ['stomp', 'headbutt'],
  'Explosiones': ['selfdestruct', 'explosion'],
  'Voces': ['echoedvoice', 'round'],
  'Venenos': ['poisontail', 'crosspoison', 'poisonjab'],
  'Residuos': ['sludge', 'sludgebomb'],
  'Mentes': ['confusion', 'psybeam', 'extrasensory'],
  'Aceros': ['steelwing', 'meteormash'],
  'Golpes de agua': ['aquatail', 'crabhammer'],
  'Chorros': ['watergun', 'bubblebeam', 'snipeshot'],
};

// Firma de un ataque: lo que tiene que ser igual en toda una línea, para que solo cambie la potencia (y, como mucho, el
// efecto secundario por azar, que ya cuenta en la potencia efectiva). Llamarada no sigue a Lanzallamas: pega más pero
// falla (85 %), es otra apuesta, no una mejora.
export function firmaAtaque(m: MoveData): string {
  const ret = !!m.secondary?.chance && !m.secondary.status && !m.secondary.boosts && !m.secondary.selfBoosts;
  const propios = Object.values({ ...m.selfBoosts, ...m.secondary?.selfBoosts });
  return [m.type, m.category, m.accuracy === true ? 'no falla' : `${m.accuracy} %`, m.flags.includes('contact') ? 'cuerpo' : 'distancia',
    ['any', 'normal', 'randomNormal'].includes(m.target) ? 'objetivo' : m.target, m.multihit ? 'multigolpe' : '', m.drain ? 'drena' : '',
    m.recoil ? 'se daña' : '', m.priority > 0 ? 'prioridad' : m.priority < 0 ? 'lento' : '', m.flags.includes('charge') ? 'carga' : '',
    m.flags.includes('recharge') ? 'agota' : '', m.selfSwitch ? 'vuelve' : '', ret ? 'interrumpe' : '',
    propios.some(v => v! < 0) ? 'se baja stats' : propios.some(v => v! > 0) ? 'se sube stats' : '',
    m.fixedDamage || !m.basePower ? 'daño variable' : '', m.pp <= 5 && !m.flags.includes('recharge') ? 'burst' : ''].filter(Boolean).join(' · ');
}

// Rango por potencia (la total de los multigolpe): I ≤ 45, II ≤ 65, III ≤ 85, IV ≤ 105, V más.
export function rangoPotencia(m: MoveData): number {
  const golpes = Array.isArray(m.multihit) ? (m.multihit[0] + m.multihit[1]) / 2 : m.multihit ?? 1;
  const p = m.fixedDamage ? 45 : m.basePower * golpes;
  return p <= 45 ? 1 : p <= 65 ? 2 : p <= 85 ? 3 : p <= 105 ? 4 : 5;
}

const lineaDe = new Map<string, string>(), rangos = new Map<string, number>();
for (const [nombre, ids] of Object.entries(LINEAS_ATAQUE)) {
  let previo = 0;
  for (const id of ids) {
    const m = getMove(id);
    if (!m) continue;
    lineaDe.set(id, nombre);
    rangos.set(id, previo = Math.max(rangoPotencia(m), previo + 1));
  }
}
export const lineaAtaque = (id: string): string | undefined => lineaDe.get(id);
export const rangoAtaque = (m: MoveData): number => m.category === 'Status' ? 1 : rangos.get(m.id) ?? rangoPotencia(m);
export const ROMANO = ['', 'I', 'II', 'III', 'IV', 'V', 'VI'];
