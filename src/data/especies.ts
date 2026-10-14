// Especies que pueden vivir en el pueblo (GDD-pueblo §4). Cada una llega como visitante por el
// camino del sur, espera con una petición (un recurso del almacén) y, si se la das, se queda.
// `afinidad`: el trabajo que hace al doble de ritmo. `riega`: en un prado, riega antes lo sembrado.
// `trabajo`: animación PMD que pone al trabajar (no todas tienen Eat; sus evoluciones usan la primera
// que tengan de esa, Attack, Punch, Strike o Swing). `nivel`: con el que llega (5 si no se dice).
// La clave es también la de su línea evolutiva en data/pokedex.ts (stats, niveles y evoluciones).
// Sprites PMD de SpriteCollab en assets/sprites/pokemon/<dex>/.
// Ladrillos: los cuece el horno con piedra; platos: guiso de bayas que se cocina en la casa (GDD-pueblo §11).
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
  marill: { dex: '0183', nombre: 'Marill', pide: { r: 'bayas', n: 5 }, afinidad: 'planta', riega: true, trabajo: 'Eat' },
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

// Salvajes: cuanto más fácil de atrapar, más a menudo aparece.
export const SALVAJES = ['pidgey', 'psyduck', 'pikachu', 'machop'];

// Orden de llegada: uno cada vez, al amanecer siguiente a que se una el anterior.
export const ORDEN_VISITAS = ['marill', 'bidoof', 'geodude', 'oddish', 'growlithe'];
