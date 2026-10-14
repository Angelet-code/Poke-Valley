// Especies que pueden vivir en el pueblo (GDD-pueblo §4). Cada una llega como visitante por el
// camino del sur, espera con una petición (un recurso del almacén) y, si se la das, se queda.
// `afinidad`: el trabajo que hace al doble de ritmo. `riega`: en un prado, riega antes lo sembrado.
// `trabajo`: animación PMD que pone al trabajar (no todas tienen Eat; sus evoluciones usan la primera
// que tengan de esa, Attack, Punch, Strike o Swing). `nivel`: con el que llega (5 si no se dice).
// La clave es también la de su línea evolutiva en data/pokedex.ts (stats, niveles y evoluciones).
// Sprites PMD de SpriteCollab en assets/sprites/pokemon/<dex>/.
// Ladrillos: los cuece el horno con piedra; platos: guiso de bayas que se cocina en la casa (GDD-pueblo §11).
import { LINEAS, type Tipo } from './pokedex';

export type Recurso = 'madera' | 'piedra' | 'bayas' | 'ladrillos' | 'platos';
export type TipoTarea = 'arbol' | 'roca' | 'planta';

export interface Especie {
  dex: string; nombre: string;
  pide?: { r: Recurso; n: number };         // solo los visitantes (ORDEN_VISITAS)
  afinidad: TipoTarea;
  riega?: boolean;
  trabajo: string;
  nivel?: number;
  atrapa?: number;                           // salvajes: probabilidad de que se quede con una Poké Ball (GDD-pueblo §12)
}
// Animaciones de trabajo que se prueban, en orden, si la forma no tiene la de su especie.
export const TRABAJOS = ['Attack', 'Punch', 'Strike', 'Swing', 'Eat'];

export const ESPECIES: Record<string, Especie> = {
  // Nivel 10: llega ya como Marill (su línea empieza en Azurill, data/pokedex.ts).
  marill: { dex: '0183', nombre: 'Marill', pide: { r: 'bayas', n: 5 }, afinidad: 'planta', riega: true, trabajo: 'Eat', nivel: 10 },
  bidoof: { dex: '0399', nombre: 'Bidoof', pide: { r: 'piedra', n: 4 }, afinidad: 'arbol', trabajo: 'Eat' },
  geodude: { dex: '0074', nombre: 'Geodude', pide: { r: 'madera', n: 6 }, afinidad: 'roca', trabajo: 'Punch' },
  oddish: { dex: '0043', nombre: 'Oddish', pide: { r: 'bayas', n: 8 }, afinidad: 'planta', trabajo: 'Attack' },
  // Fuego: en el horno cuece el doble (los edificios con `tipo` dan afinidad por tipo, data/edificios.ts).
  growlithe: { dex: '0058', nombre: 'Growlithe', pide: { r: 'piedra', n: 8 }, afinidad: 'roca', trabajo: 'Attack' },
  // Salvajes (GDD-pueblo §12): rondan por el valle y se les invita con una Poké Ball, que puede fallar.
  pidgey: { dex: '0016', nombre: 'Pidgey', afinidad: 'arbol', trabajo: 'Attack', atrapa: 0.6 },
  psyduck: { dex: '0054', nombre: 'Psyduck', afinidad: 'planta', riega: true, trabajo: 'Attack', atrapa: 0.45 },
  pikachu: { dex: '0025', nombre: 'Pikachu', afinidad: 'planta', trabajo: 'Eat', atrapa: 0.35 },
  machop: { dex: '0066', nombre: 'Machop', afinidad: 'roca', trabajo: 'Attack', atrapa: 0.25 },
};

// Orden de llegada: uno cada vez, al amanecer siguiente a que se una el anterior.
export const ORDEN_VISITAS = ['marill', 'bidoof', 'geodude', 'oddish', 'growlithe'];

// El resto de líneas de la Pokédex (data/pokedex.ts) también rondan por el valle como salvajes. Sus datos salen
// de la línea: afinidad por su tipo, riega si es de Agua, y cuanto más fuerte su última forma, más difícil de atrapar.
const AFINIDAD: Record<Tipo, TipoTarea> = {
  planta: 'planta', agua: 'planta', bicho: 'planta', hada: 'planta', electrico: 'planta', psiquico: 'planta',
  roca: 'roca', tierra: 'roca', acero: 'roca', lucha: 'roca', fuego: 'roca', hielo: 'roca', dragon: 'roca',
  normal: 'arbol', volador: 'arbol', veneno: 'arbol', fantasma: 'arbol', siniestro: 'arbol',
};
for (const l of Object.values(LINEAS)) {
  if (ESPECIES[l.id]) continue;
  const f0 = l.formas[0], bst = l.formas[l.formas.length - 1].base.reduce((t, v) => t + v, 0);
  ESPECIES[l.id] = { dex: f0.dex, nombre: f0.nombre, afinidad: AFINIDAD[l.tipo], riega: l.tipos.includes('agua') || undefined,
    trabajo: 'Attack', atrapa: Math.round(Math.min(0.6, Math.max(0.1, 1.05 - bst / 600)) * 100) / 100 };
}

// Salvajes: todas las especies salvo los visitantes. Cuanto más fácil de atrapar, más a menudo aparece.
export const SALVAJES = Object.keys(ESPECIES).filter(id => !ORDEN_VISITAS.includes(id));
// Probabilidad de que un salvaje aparezca ya evolucionado (a partir del nivel de una de sus evoluciones).
export const PROB_EVOLUCIONADO = 0.3;
