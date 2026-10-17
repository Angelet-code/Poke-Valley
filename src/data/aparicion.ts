// Qué Pokémon salen en cada zona del modo aventura y con qué probabilidad (docs/GDD-mundo.md §4c).
// Todas las líneas (de data/pokedex.ts) son del bioma de su zona. De día y de noche salen especies distintas:
// - 7 comunes, que salen igual de a menudo: 3 de siempre (`siempre`) y 4 de su momento (`dia` / `noche`);
// - 7 raras de su momento (`raras.dia` / `raras.noche`), cada una menos que la anterior, hasta la rarísima (0,5 %);
// - las ultra raras (`ultra`: pseudolegendarios y otras joyas, a cualquier hora): entre todas, PROB_ULTRA (1 de cada
//   1000). Antes eran las últimas raras y salían demasiado pronto (Axew al 6 % en el volcán; cambiado el 2026-10-18);
// - con el clima de la zona (o uno de un movimiento), el PROB_CLIMA de los que salen son de su lista (`clima`), que
//   solo salen entonces.
// Se tira con la semilla del mundo al entrar y cada vez que un salvaje reaparece (combate/mundo.ts); al hacerse de
// noche (o de día) y al cambiar el clima, los salvajes que pasean lejos de ti se cambian poco a poco por los que tocan.
// El mapa se genera con las de siempre (sin hora ni clima), así las misiones piden especies que salen a todas horas.
// Aparte, cada zona de bioma tiene su rareza en el rincón secreto (`diseno.rara` en biomas.ts): solo sale con un
// PROB_SECRETO de las veces que aparece alguien allí; si no, una de las últimas raras del momento (`tirarSecreto`).
import type { MapaId } from './bosque';
import type { Clima } from '../combate/reglas';

export type Momento = 'dia' | 'noche';
// De noche desde las 20:00 hasta que amanece (el día del modo aventura va de las 6:00 a las 2:00).
export const NOCHE_DESDE = 20 * 60;
export const momentoDe = (minuto: number): Momento => minuto >= NOCHE_DESDE || minuto < 6 * 60 ? 'noche' : 'dia';

// Probabilidad de cada rara, de la menos rara a la rarísima (en tanto por uno). Las comunes se reparten el resto.
export const PROB_RARAS = [0.06, 0.045, 0.035, 0.025, 0.015, 0.01, 0.005];
const PROB_COMUN = (1 - PROB_RARAS.reduce((a, b) => a + b, 0)) / 7;   // 11,5 % cada una
// Desde qué rara se avisa al salir (las dos últimas: 1 % y 0,5 %).
export const RAREZA_AVISO = 5;
// Ultra raras: la parte de los que salen que son una de ellas (todas juntas), y su índice de rareza.
export const PROB_ULTRA = 0.001;
export const RAREZA_ULTRA = PROB_RARAS.length;
// Rincón secreto: la parte de las veces que sale su rareza.
export const PROB_SECRETO = 0.01;
// Con clima, la parte de los que salen que son de su lista.
export const PROB_CLIMA = 0.35;

export interface Tabla {
  siempre: string[]; dia: string[]; noche: string[];
  raras: Record<Momento, string[]>;
  ultra: string[];
  clima?: Partial<Record<Clima, string[]>>;
}
export const APARICION: Partial<Record<MapaId, Tabla>> = {
  bosque: {
    siempre: ['caterpie', 'bidoof', 'wooloo'],
    dia: ['pidgey', 'combee', 'sunkern', 'bounsweet'],
    noche: ['hoothoot', 'spinarak', 'oddish', 'venonat'],
    raras: {
      dia: ['growlithe', 'flabebe', 'ralts', 'pikachu', 'scyther', 'pinsir', 'heracross'],
      noche: ['poochyena', 'murkrow', 'gastly', 'ralts', 'pinsir', 'heracross', 'noibat'],
    },
    ultra: ['munchlax'],
    clima: { lluvia: ['surskit', 'shroomish', 'paras'] },
  },
  lago: {
    siempre: ['psyduck', 'magikarp', 'marill'],
    dia: ['pachirisu', 'wooper', 'lotad', 'wingull'],
    noche: ['poochyena', 'murkrow', 'hoothoot', 'chinchou'],
    raras: {
      dia: ['natu', 'flabebe', 'ralts', 'poliwag', 'buizel', 'barboach', 'eevee'],
      noche: ['natu', 'gastly', 'ralts', 'poliwag', 'shuppet', 'barboach', 'eevee'],
    },
    ultra: ['goomy'],
    clima: { lluvia: ['tympole', 'surskit', 'poliwag'] },
  },
  costa: {
    siempre: ['magikarp', 'wailmer', 'krabby'],
    dia: ['wingull', 'pidgey', 'rookidee', 'psyduck'],
    noche: ['tentacool', 'chinchou', 'zubat', 'staryu'],
    raras: {
      dia: ['marill', 'corsola', 'horsea', 'pachirisu', 'carvanha', 'shellder', 'skrelp'],
      noche: ['corsola', 'shellder', 'horsea', 'carvanha', 'mareanie', 'clauncher', 'skrelp'],
    },
    ultra: ['feebas', 'lapras'],
    clima: { lluvia: ['shellos', 'clauncher', 'mantyke'] },
  },
  cantera: {
    siempre: ['geodude', 'machop', 'roggenrola'],
    dia: ['diglett', 'drilbur', 'mudbray', 'timburr'],
    noche: ['zubat', 'woobat', 'nosepass', 'makuhita'],
    raras: {
      dia: ['magnemite', 'onix', 'sudowoodo', 'rhyhorn', 'mawile', 'carbink', 'riolu'],
      noche: ['magnemite', 'onix', 'sableye', 'rhyhorn', 'carbink', 'mawile', 'riolu'],
    },
    ultra: ['larvitar', 'aron'],
    clima: { arena: ['sandshrew', 'hippopotas', 'trapinch'] },
  },
  pantano: {
    siempre: ['grimer', 'trubbish', 'croagunk'],
    dia: ['poochyena', 'skorupi', 'ekans', 'paras'],
    noche: ['gastly', 'zubat', 'murkrow', 'litwick'],
    raras: {
      dia: ['spinarak', 'koffing', 'shuppet', 'sableye', 'duskull', 'yamask', 'zorua'],
      noche: ['koffing', 'shuppet', 'sableye', 'duskull', 'phantump', 'yamask', 'zorua'],
    },
    ultra: ['dreepy', 'misdreavus'],
    clima: { lluvia: ['barboach', 'tympole', 'wooper'] },
  },
  ruinas: {
    siempre: ['abra', 'natu', 'ralts'],
    dia: ['flabebe', 'espurr', 'snubbull', 'mawile'],
    noche: ['clefairy', 'drowzee', 'munna', 'elgyem'],
    raras: {
      dia: ['meditite', 'chingling', 'bronzor', 'gothita', 'sigilyph', 'solrock', 'hatenna'],
      noche: ['gastly', 'meditite', 'bronzor', 'gothita', 'sigilyph', 'lunatone', 'hatenna'],
    },
    ultra: ['togepi'],
    clima: { arena: ['baltoy', 'yamask', 'sandile'] },
  },
  volcan: {
    siempre: ['slugma', 'torkoal', 'numel'],
    dia: ['growlithe', 'ponyta', 'magby', 'charcadet'],
    noche: ['houndour', 'litwick', 'heatmor', 'salandit'],
    raras: {
      dia: ['vulpix', 'darumaka', 'sizzlipede', 'houndour', 'turtonator', 'salandit', 'druddigon'],
      noche: ['ponyta', 'darumaka', 'sizzlipede', 'magby', 'turtonator', 'charcadet', 'druddigon'],
    },
    ultra: ['axew', 'bagon', 'gible', 'deino', 'larvesta', 'dratini'],
    clima: { sol: ['vulpix', 'sizzlipede', 'fletchling'] },
  },
  nieve: {
    siempre: ['vanillite', 'swinub', 'snover'],
    dia: ['bergmite', 'spheal', 'cubchoo', 'delibird'],
    noche: ['snorunt', 'sneasel', 'smoochum', 'snom'],
    raras: {
      dia: ['teddiursa', 'cetoddle', 'cryogonal', 'swablu', 'amaura', 'eiscue', 'absol'],
      noche: ['cetoddle', 'cryogonal', 'teddiursa', 'duskull', 'amaura', 'eiscue', 'absol'],
    },
    ultra: ['frigibax', 'beldum'],
    clima: { granizo: ['eiscue', 'snorunt', 'bergmite'] },
  },
  llanura: {
    siempre: ['mareep', 'shinx', 'electrike'],
    dia: ['pikachu', 'plusle', 'minun', 'helioptile'],
    noche: ['voltorb', 'joltik', 'hoothoot', 'tynamo'],
    raras: {
      dia: ['yamper', 'tauros', 'miltank', 'emolga', 'pawmi', 'elekid', 'dedenne'],
      noche: ['yamper', 'chinchou', 'emolga', 'magnemite', 'pawmi', 'elekid', 'rotom'],
    },
    ultra: ['eevee', 'munchlax'],
    clima: { lluvia: ['tympole', 'chinchou', 'tynamo'] },
  },
};

// Cuándo se tira: la hora del día y el clima que hace (null = despejado).
export interface Cuando { momento: Momento; clima: Clima | null }

// Una línea al azar según la tabla de la zona; `rareza` = índice en `raras[momento]` (−1 si es común o de clima).
// Sin `cuando` (al generar el mapa), solo las de siempre.
export function tirarEspecie(mapa: MapaId, r: () => number, cuando?: Cuando): { linea: string; rareza: number } | null {
  const t = APARICION[mapa];
  if (!t) return null;
  if (!cuando) return { linea: t.siempre[Math.floor(r() * t.siempre.length)], rareza: -1 };
  const deClima = lineasClima(mapa, cuando.clima);
  if (deClima.length && r() < PROB_CLIMA) return { linea: deClima[Math.floor(r() * deClima.length)], rareza: -1 };
  if (t.ultra.length && r() < PROB_ULTRA) return { linea: t.ultra[Math.floor(r() * t.ultra.length)], rareza: RAREZA_ULTRA };
  const comunes = [...t.siempre, ...t[cuando.momento]], raras = t.raras[cuando.momento];
  let x = r();
  for (let i = 0; i < comunes.length; i++) { x -= PROB_COMUN; if (x < 0) return { linea: comunes[i], rareza: -1 }; }
  for (let i = 0; i < raras.length; i++) { x -= PROB_RARAS[i]; if (x < 0) return { linea: raras[i], rareza: i }; }
  return { linea: raras[raras.length - 1], rareza: raras.length - 1 };   // redondeo
}
// Si la especie puede salir ahora (si no, al cambiar la hora o el clima se cambia por otra).
export function puedeSalir(mapa: MapaId, linea: string, cuando: Cuando): boolean {
  const t = APARICION[mapa];
  if (!t) return true;
  return t.siempre.includes(linea) || t[cuando.momento].includes(linea) || t.raras[cuando.momento].includes(linea) || t.ultra.includes(linea)
    || (!!cuando.clima && !!t.clima?.[cuando.clima]?.includes(linea));
}
// Las que solo salen con ese clima en la zona.
export const lineasClima = (mapa: MapaId, clima: Clima | null): string[] => (clima && APARICION[mapa]?.clima?.[clima]) || [];
// Índice de rareza de una línea ahora (−1 si no es rara en este momento).
export function rarezaDe(mapa: MapaId, linea: string, momento: Momento): number {
  const t = APARICION[mapa];
  if (!t) return -1;
  return t.ultra.includes(linea) ? RAREZA_ULTRA : t.raras[momento].indexOf(linea);
}
// Quién sale en el rincón secreto: su rareza (`rara`) con un PROB_SECRETO; si no, una de las 3 últimas raras del momento.
export function tirarSecreto(mapa: MapaId, rara: string, r: () => number, momento: Momento): string {
  const raras = APARICION[mapa]?.raras[momento].slice(-3) ?? [];
  return !raras.length || r() < PROB_SECRETO ? rara : raras[Math.floor(r() * raras.length)];
}
// Todas las líneas que pueden salir en la zona, a cualquier hora y con cualquier clima (para cargar sus sprites).
export function lineasDe(mapa: MapaId): string[] {
  const t = APARICION[mapa];
  if (!t) return [];
  return [...new Set([...t.siempre, ...t.dia, ...t.noche, ...t.raras.dia, ...t.raras.noche, ...t.ultra, ...Object.values(t.clima ?? {}).flat()])];
}
// Las raras de verdad de la zona (las ultra y las tres últimas de día y de noche: 1,5 % o menos).
export const muyRaras = (t: Tabla): string[] => [...t.ultra, ...t.raras.dia.slice(4), ...t.raras.noche.slice(4)];
