// Objetos equipables del modo aventura (docs/GDD-combate.md §3.4): cada Pokémon lleva uno por ranura (SLOTS), que se
// pone y se quita en el inventario (I). Lo que hacen está en MundoAventura (danar, aplicar, vivir y lanzarMov); aquí,
// sus datos. Iconos: los de Pokémon Colleja (assets/game/pixel/items/equipables/, ids de Showdown).
// Como en un MMO, no se gastan: la Banda Focus se recarga.
// Rareza: cada objeto base (común) tiene su versión rara (`<id>_r`) y épica (`<id>_e`), con el mismo icono y un efecto
// más fuerte (ESCALA); la rareza solo escala el bonus, no cambia lo que hace.
import type { TypeName } from '../data/movimientos';
import { ITEMS } from '../data/items';

export type Slot = 'cabeza' | 'cuerpo' | 'arma' | 'amuleto' | 'accesorio';
export type Rareza = 'comun' | 'raro' | 'epico';

// El orden es el de los huecos de Miembro.objetos (índice = ranura).
export const SLOTS: { id: Slot; nombre: string }[] = [
  { id: 'cabeza', nombre: 'Cabeza' }, { id: 'cuerpo', nombre: 'Cuerpo' }, { id: 'arma', nombre: 'Arma' },
  { id: 'amuleto', nombre: 'Amuleto' }, { id: 'accesorio', nombre: 'Accesorio' },
];
export const slotIdx = (s: Slot): number => SLOTS.findIndex(q => q.id === s);

export interface Equipable { id: string; base: string; nombre: string; desc: string; tipo?: TypeName; slot: Slot; rareza: Rareza }

export const RECARGA_BANDA = 60;           // s hasta que la Banda Focus vuelve a salvarte (común)
export const POTENCIA_TIPO = 1.2;          // los que potencian un tipo (común)

export const RAREZAS: { id: Rareza; sufijo: string; nombre: string; escala: number; color: number; precio: number }[] = [
  { id: 'comun', sufijo: '', nombre: 'Común', escala: 1, color: 0xb8a98a, precio: 100 },
  { id: 'raro', sufijo: '_r', nombre: 'Raro', escala: 1.5, color: 0x4a8fd8, precio: 250 },
  { id: 'epico', sufijo: '_e', nombre: 'Épico', escala: 2, color: 0xb05ad0, precio: 600 },
];

const TIPO_OBJ: [string, string, TypeName, string][] = [
  ['charcoal', 'Carbón', 'Fire', 'Fuego'], ['mysticwater', 'Agua Mística', 'Water', 'Agua'], ['miracleseed', 'Semilla Milagro', 'Grass', 'Planta'],
  ['magnet', 'Imán', 'Electric', 'Eléctrico'], ['nevermeltice', 'Antiderretir', 'Ice', 'Hielo'], ['blackbelt', 'Cinturón Negro', 'Fighting', 'Lucha'],
  ['poisonbarb', 'Flecha Venenosa', 'Poison', 'Veneno'], ['softsand', 'Arena Fina', 'Ground', 'Tierra'], ['sharpbeak', 'Pico Afilado', 'Flying', 'Volador'],
  ['twistedspoon', 'Cuchara Torcida', 'Psychic', 'Psíquico'], ['silverpowder', 'Polvo Plata', 'Bug', 'Bicho'], ['hardstone', 'Piedra Dura', 'Rock', 'Roca'],
  ['spelltag', 'Hechizo', 'Ghost', 'Fantasma'], ['dragonfang', 'Colmillo Dragón', 'Dragon', 'Dragón'], ['blackglasses', 'Gafas de Sol', 'Dark', 'Siniestro'],
  ['metalcoat', 'Revestimiento Metálico', 'Steel', 'Acero'], ['silkscarf', 'Pañuelo Seda', 'Normal', 'Normal'], ['fairyfeather', 'Pluma Hada', 'Fairy', 'Hada'],
];

// Los objetos base (rareza común), cada uno en su ranura. Las cifras de las descripciones son las de común.
const BASE: Omit<Equipable, 'rareza' | 'base'>[] = [
  { id: 'wiseglasses', slot: 'cabeza', nombre: 'Gafas Especiales', desc: 'Sus ataques especiales hacen ×1,1 de daño' },
  { id: 'scopelens', slot: 'cabeza', nombre: 'Periscopio', desc: 'Más críticos: sube un nivel la probabilidad de crítico (el épico, dos)' },
  { id: 'focussash', slot: 'cuerpo', nombre: 'Banda Focus', desc: `Con la vida entera, aguanta con 1 PS un golpe que lo debilitaría. Se recarga en ${RECARGA_BANDA} s` },
  { id: 'focusband', slot: 'cuerpo', nombre: 'Cinta Focus', desc: 'A veces (1 de cada 10) aguanta con 1 PS un golpe que lo debilitaría' },
  { id: 'rockyhelmet', slot: 'cuerpo', nombre: 'Casco Dentado', desc: 'Quien lo golpea cuerpo a cuerpo pierde 1/6 de su vida' },
  { id: 'muscleband', slot: 'arma', nombre: 'Cinta Fuerte', desc: 'Sus ataques físicos hacen ×1,1 de daño' },
  { id: 'lifeorb', slot: 'arma', nombre: 'Vidasfera', desc: 'Sus ataques hacen ×1,3 de daño, pero cada uno le quita 1/10 de su vida' },
  { id: 'expertbelt', slot: 'arma', nombre: 'Cinta Experto', desc: 'Sus ataques supereficaces hacen ×1,2 de daño' },
  ...TIPO_OBJ.map(([id, nombre, tipo, es]) => ({ id, nombre, tipo, slot: 'amuleto' as Slot, desc: `Sus ataques de tipo ${es} hacen ×${String(POTENCIA_TIPO).replace('.', ',')} de daño` })),
  { id: 'leftovers', slot: 'accesorio', nombre: 'Restos', desc: 'En combate, recupera 1/16 de su vida cada 3 s' },
  { id: 'shellbell', slot: 'accesorio', nombre: 'Campana Concha', desc: 'Recupera 1/8 del daño que hace' },
];

export const EQUIPABLES: Record<string, Equipable> = Object.fromEntries(BASE.flatMap(b => RAREZAS.map(r => {
  const e: Equipable = { ...b, id: b.id + r.sufijo, base: b.id, rareza: r.id,
    nombre: r.id === 'comun' ? b.nombre : `${b.nombre} ${r.nombre.toLowerCase()}`,
    desc: r.id === 'comun' ? b.desc : `${b.desc}. ${r.nombre}: efecto ×${String(r.escala).replace('.', ',')}` };
  return [e.id, e] as const;
})));

const RAREZA_DE = (id: string): typeof RAREZAS[number] => RAREZAS.find(r => r.id === EQUIPABLES[id]?.rareza) ?? RAREZAS[0];
export const escalaDe = (id: string): number => RAREZA_DE(id).escala;
export const colorRareza = (id: string): number => RAREZA_DE(id).color;
export const baseDe = (id: string): string => EQUIPABLES[id]?.base ?? id;
// Un bonus b (p. ej. ×1,2) escalado por la rareza: 1 + (b - 1) × escala.
export const escalar = (b: number, id: string): number => 1 + (b - 1) * escalaDe(id);

// Lo que suelta un alfa (más raros) o, muy de vez en cuando, un salvaje: primero la rareza, luego el objeto.
export const sortearEquipable = (rnd: () => number, alfa = false): string => {
  const x = rnd(), pe = alfa ? 0.15 : 0.03, pr = alfa ? 0.45 : 0.22;
  const suf = x < pe ? '_e' : x < pe + pr ? '_r' : '';
  return BASE[Math.floor(rnd() * BASE.length)].id + suf;
};

// Al catálogo de objetos (data/items.ts), para la mochila y los iconos (Preload carga icono_<id base>).
for (const e of Object.values(EQUIPABLES)) ITEMS[e.id] = { id: e.id, nombre: e.nombre, precio: RAREZA_DE(e.id).precio, tipo: 'equipable', icono: 'icono_' + e.base };
