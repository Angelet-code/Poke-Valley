// Qué Pokémon salen en cada zona del modo aventura y con qué probabilidad (docs/GDD-mundo.md §4c).
// Cada zona tiene 14 líneas (de data/pokedex.ts), todas de su bioma: 7 comunes, que salen igual de a menudo, y 7 raras,
// cada una menos que la anterior, hasta la rarísima (0,5 %). Se tira con la semilla del mapa al generarlo y con la
// del mundo cada vez que un salvaje reaparece (mundo.ts), así que el raro puede salir en cualquier momento.
// Aparte, cada zona de bioma tiene su rareza fija en el rincón secreto (`diseno.rara` en biomas.ts), que no está aquí.
import type { MapaId } from './bosque';

// Probabilidad de cada rara, de la menos rara a la rarísima (en tanto por uno). Las comunes se reparten el resto.
export const PROB_RARAS = [0.06, 0.045, 0.035, 0.025, 0.015, 0.01, 0.005];
const PROB_COMUN = (1 - PROB_RARAS.reduce((a, b) => a + b, 0)) / 7;   // 11,5 % cada una
// Desde qué rara se avisa al salir (las dos últimas: 1 % y 0,5 %).
export const RAREZA_AVISO = 5;

export interface Tabla { comunes: string[]; raras: string[] }
export const APARICION: Partial<Record<MapaId, Tabla>> = {
  bosque: {
    comunes: ['caterpie', 'pidgey', 'oddish', 'bidoof', 'hoothoot', 'combee', 'sunkern'],
    raras: ['bounsweet', 'pikachu', 'growlithe', 'ralts', 'scyther', 'heracross', 'munchlax'],
  },
  lago: {
    comunes: ['psyduck', 'marill', 'magikarp', 'wooper', 'pachirisu', 'poochyena', 'wooloo'],
    raras: ['murkrow', 'natu', 'flabebe', 'lotad', 'poliwag', 'eevee', 'goomy'],
  },
  costa: {
    comunes: ['magikarp', 'wailmer', 'wingull', 'krabby', 'pidgey', 'psyduck', 'rookidee'],
    raras: ['marill', 'corsola', 'horsea', 'staryu', 'carvanha', 'skrelp', 'feebas'],
  },
  cantera: {
    comunes: ['geodude', 'diglett', 'machop', 'timburr', 'drilbur', 'mudbray', 'roggenrola'],
    raras: ['makuhita', 'magnemite', 'onix', 'sudowoodo', 'rhyhorn', 'riolu', 'larvitar'],
  },
  pantano: {
    comunes: ['grimer', 'trubbish', 'zubat', 'gastly', 'spinarak', 'poochyena', 'murkrow'],
    raras: ['croagunk', 'shuppet', 'litwick', 'sableye', 'duskull', 'zorua', 'dreepy'],
  },
  ruinas: {
    comunes: ['abra', 'ralts', 'natu', 'clefairy', 'flabebe', 'drowzee', 'espurr'],
    raras: ['mawile', 'snubbull', 'elgyem', 'bronzor', 'gothita', 'sigilyph', 'hatenna'],
  },
  volcan: {
    comunes: ['growlithe', 'slugma', 'torkoal', 'numel', 'ponyta', 'houndour', 'magby'],
    raras: ['axew', 'salandit', 'druddigon', 'turtonator', 'bagon', 'gible', 'larvesta'],
  },
  nieve: {
    comunes: ['vanillite', 'snorunt', 'swinub', 'bergmite', 'spheal', 'snover', 'cubchoo'],
    raras: ['sneasel', 'delibird', 'smoochum', 'snom', 'cryogonal', 'amaura', 'frigibax'],
  },
};

// Una línea al azar según la tabla de la zona; `rareza` = índice en `raras` (−1 si es común).
export function tirarEspecie(mapa: MapaId, r: () => number): { linea: string; rareza: number } | null {
  const t = APARICION[mapa];
  if (!t) return null;
  let x = r();
  for (let i = 0; i < t.comunes.length; i++) { x -= PROB_COMUN; if (x < 0) return { linea: t.comunes[i], rareza: -1 }; }
  for (let i = 0; i < t.raras.length; i++) { x -= PROB_RARAS[i]; if (x < 0) return { linea: t.raras[i], rareza: i }; }
  return { linea: t.raras[t.raras.length - 1], rareza: t.raras.length - 1 };   // redondeo
}
// Todas las líneas que pueden salir en la zona (para cargar sus sprites al entrar).
export const lineasDe = (mapa: MapaId): string[] => { const t = APARICION[mapa]; return t ? [...t.comunes, ...t.raras] : []; };
