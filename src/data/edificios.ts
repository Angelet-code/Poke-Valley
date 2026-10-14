// Edificios que el jugador construye con lo que hay en el almacén (GDD-pueblo §4, prototipo 0.2b).
// `obj` es la clave del catálogo pixel art (assets/game/pixel/items.json): sprite, ancla y colisión.
// El coste se paga como las peticiones de los visitantes: primero del almacén y luego de lo que llevas.
import type { Recurso } from './especies';
import type { Tipo } from './pokedex';

// Cada edificio hace una de cuatro cosas (GDD-pueblo §11): sube un límite (nidos), convierte un recurso en
// otro mejor con un aldeano dentro (horno), abre un trabajo para un tipo (el horno, Fuego) o da algo cada
// día (comedero, guardería).

export interface DefEdificio {
  id: string;
  nombre: string;
  coste: Partial<Record<Recurso, number>>;
  obj: string;
  plazas?: number;   // aldeanos que duermen aquí (nidos)
  efecto?: string;   // lo que hace, para el aviso al construirlo
  puestos?: number;  // aldeanos que pueden trabajar dentro (se les asigna como a un árbol: clic en él y en el edificio)
  // Convierte: cada `min` minutos de juego gasta `de` del almacén y saca `n` de `a` (lo lleva al almacén).
  produce?: { de: Partial<Record<Recurso, number>>; a: Recurso; n: number; min: number };
  tipo?: Tipo;       // los aldeanos de este tipo trabajan aquí al doble de ritmo
  expMin?: number;   // guardería: experiencia por minuto dentro, sin producir (para los que trabajan mal)
}

export const CONSTRUIBLES: DefEdificio[] = [
  // +1 aldeano: cada aldeano duerme en su nido; un visitante solo se queda si hay un nido libre.
  { id: 'nido', nombre: 'Nido', coste: { madera: 6, piedra: 2 }, obj: 'nido', plazas: 1 },
  // Los aldeanos desayunan aquí (una baya del almacén cada uno); sin comedero no desayunan.
  { id: 'comedero', nombre: 'Comedero', coste: { madera: 4, piedra: 4 }, obj: 'comedero' },
  // Edificios del 2026-10-14 (sprites de Klein, assets/gen/pixel/edificios_pueblo).
  // Almacén: los aldeanos dejan lo que traen en el más cercano (la mesa o uno de estos), y así caminan menos.
  { id: 'almacen', nombre: 'Almacén', coste: { madera: 10, piedra: 6 }, obj: 'almacen',
    efecto: 'Los aldeanos dejarán aquí lo que traigan si les pilla más cerca que la mesa.' },
  // Nido grande: tres aldeanos en una sola obra.
  { id: 'nidogrande', nombre: 'Nido grande', coste: { madera: 14, piedra: 4 }, obj: 'nidogrande', plazas: 3 },
  // Sin efecto todavía: el cobertizo será la base del huerto y el santuario, el Árbol Santuario (GDD-pueblo §8).
  { id: 'cobertizo', nombre: 'Cobertizo', coste: { madera: 8, piedra: 2 }, obj: 'cobertizo' },
  { id: 'santuario', nombre: 'Santuario', coste: { madera: 10, piedra: 12 }, obj: 'santuario' },
  // Horno (2026-10-14): un aldeano cuece 2 piedras en 1 ladrillo cada 40 min; los de Fuego, al doble.
  { id: 'horno', nombre: 'Horno', coste: { madera: 8, piedra: 12 }, obj: 'horno', puestos: 1, tipo: 'fuego',
    produce: { de: { piedra: 2 }, a: 'ladrillos', n: 1, min: 40 },
    efecto: 'Haz clic en un aldeano y luego en el horno: cocerá ladrillos con la piedra del almacén (los de Fuego, al doble).' },
  // Guardería: dos aldeanos ganan experiencia sin trabajar (1,2 por minuto, como un buen trabajador): para
  // los que rinden poco en todo hasta que evolucionan (Magikarp, Beldum…).
  { id: 'guarderia', nombre: 'Guardería', coste: { madera: 16, ladrillos: 6 }, obj: 'guarderia', puestos: 2, expMin: 1.2,
    efecto: 'Lleva aquí (clic en él y en la guardería) a quien trabaje mal: subirá de nivel sin trabajar.' },
];

// Mejoras de la casa del jugador (F en la casa): cuestan recursos y Pokécoins y se compran en orden.
export interface MejoraCasa { nivel: number; nombre: string; coste: Partial<Record<Recurso, number>>; pokecoins: number; efecto: string }
export const MEJORAS_CASA: MejoraCasa[] = [
  { nivel: 2, nombre: 'Cocina', coste: { madera: 20, piedra: 10 }, pokecoins: 150,
    efecto: 'Cocina guisos: 3 bayas = 1 plato. Al desayunar un plato, el aldeano gana el doble de experiencia y trabaja un 25 % más rápido ese día.' },
  { nivel: 3, nombre: 'Ampliación', coste: { madera: 30, ladrillos: 12 }, pokecoins: 500,
    efecto: 'Habitación más grande: Bulbasaur descansa mejor y amanece con 150 de energía en vez de 100.' },
];
export const BAYAS_PLATO = 3, ENERGIA_PLATO = 4; // un plato: 3 bayas y 4 de energía

// La partida empieza con estos nidos ya hechos, en fila junto a la casa (WorldScene.nidosIniciales).
export const NIDOS_INICIALES = 3;

export const EDIFICIO: Record<string, DefEdificio> = Object.fromEntries(CONSTRUIBLES.map(d => [d.id, d]));
