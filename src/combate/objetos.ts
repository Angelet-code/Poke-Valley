// Objetos equipables del modo aventura (docs/GDD-combate.md §3.4): cada Pokémon lleva uno (Miembro.objeto), que se
// pone y se quita en el inventario (I). Lo que hacen está en MundoAventura (danar, aplicar, vivir y lanzarMov); aquí,
// sus datos. Iconos: los de Pokémon Colleja (assets/game/pixel/items/equipables/, ids de Showdown).
// Como en un MMO, no se gastan: la Banda Focus se recarga.
import type { TypeName } from '../data/movimientos';
import { ITEMS } from '../data/items';

export interface Equipable { id: string; nombre: string; desc: string; tipo?: TypeName }

export const RECARGA_BANDA = 60;           // s hasta que la Banda Focus vuelve a salvarte
export const POTENCIA_TIPO = 1.2;          // los que potencian un tipo

const TIPO_OBJ: [string, string, TypeName, string][] = [
  ['charcoal', 'Carbón', 'Fire', 'Fuego'], ['mysticwater', 'Agua Mística', 'Water', 'Agua'], ['miracleseed', 'Semilla Milagro', 'Grass', 'Planta'],
  ['magnet', 'Imán', 'Electric', 'Eléctrico'], ['nevermeltice', 'Antiderretir', 'Ice', 'Hielo'], ['blackbelt', 'Cinturón Negro', 'Fighting', 'Lucha'],
  ['poisonbarb', 'Flecha Venenosa', 'Poison', 'Veneno'], ['softsand', 'Arena Fina', 'Ground', 'Tierra'], ['sharpbeak', 'Pico Afilado', 'Flying', 'Volador'],
  ['twistedspoon', 'Cuchara Torcida', 'Psychic', 'Psíquico'], ['silverpowder', 'Polvo Plata', 'Bug', 'Bicho'], ['hardstone', 'Piedra Dura', 'Rock', 'Roca'],
  ['spelltag', 'Hechizo', 'Ghost', 'Fantasma'], ['dragonfang', 'Colmillo Dragón', 'Dragon', 'Dragón'], ['blackglasses', 'Gafas de Sol', 'Dark', 'Siniestro'],
  ['metalcoat', 'Revestimiento Metálico', 'Steel', 'Acero'], ['silkscarf', 'Pañuelo Seda', 'Normal', 'Normal'], ['fairyfeather', 'Pluma Hada', 'Fairy', 'Hada'],
];

export const EQUIPABLES: Record<string, Equipable> = Object.fromEntries([
  { id: 'leftovers', nombre: 'Restos', desc: 'En combate, recupera 1/16 de su vida cada 3 s' },
  { id: 'focussash', nombre: 'Banda Focus', desc: `Con la vida entera, aguanta con 1 PS un golpe que lo debilitaría. Se recarga en ${RECARGA_BANDA} s` },
  { id: 'focusband', nombre: 'Cinta Focus', desc: 'A veces (1 de cada 10) aguanta con 1 PS un golpe que lo debilitaría' },
  { id: 'lifeorb', nombre: 'Vidasfera', desc: 'Sus ataques hacen ×1,3 de daño, pero cada uno le quita 1/10 de su vida' },
  { id: 'muscleband', nombre: 'Cinta Fuerte', desc: 'Sus ataques físicos hacen ×1,1 de daño' },
  { id: 'wiseglasses', nombre: 'Gafas Especiales', desc: 'Sus ataques especiales hacen ×1,1 de daño' },
  { id: 'expertbelt', nombre: 'Cinta Experto', desc: 'Sus ataques supereficaces hacen ×1,2 de daño' },
  { id: 'scopelens', nombre: 'Periscopio', desc: 'Más críticos: sube un nivel la probabilidad de crítico' },
  { id: 'shellbell', nombre: 'Campana Concha', desc: 'Recupera 1/8 del daño que hace' },
  { id: 'rockyhelmet', nombre: 'Casco Dentado', desc: 'Quien lo golpea cuerpo a cuerpo pierde 1/6 de su vida' },
  ...TIPO_OBJ.map(([id, nombre, tipo, es]) => ({ id, nombre, tipo, desc: `Sus ataques de tipo ${es} hacen ×${String(POTENCIA_TIPO).replace('.', ',')} de daño` })),
].map(e => [e.id, e as Equipable]));

// Lo que suelta un alfa o, muy de vez en cuando, un salvaje.
export const sortearEquipable = (rnd: () => number): string => { const ids = Object.keys(EQUIPABLES); return ids[Math.floor(rnd() * ids.length)]; };

// Al catálogo de objetos (data/items.ts), para la mochila y los iconos (Preload los carga como icono_<id>).
for (const e of Object.values(EQUIPABLES)) ITEMS[e.id] = { id: e.id, nombre: e.nombre, precio: 100, tipo: 'equipable', icono: 'icono_' + e.id };
