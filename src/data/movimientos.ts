// Movimientos, aprendizaje por nivel y tabla de tipos del modo aventura (docs/GDD-combate.md). Los genera
// tools/datos_combate.mjs a partir de Pokémon Showdown (src/data/gen/combate.json): no se editan a mano.
import datos from './gen/combate.json';

export const TIPOS_EN = ['Normal', 'Fire', 'Water', 'Electric', 'Grass', 'Ice', 'Fighting', 'Poison', 'Ground', 'Flying', 'Psychic',
  'Bug', 'Rock', 'Ghost', 'Dragon', 'Dark', 'Steel', 'Fairy'] as const;
export type TypeName = (typeof TIPOS_EN)[number];
export const TIPO_ES: Record<TypeName, string> = {
  Normal: 'Normal', Fire: 'Fuego', Water: 'Agua', Electric: 'Eléctrico', Grass: 'Planta', Ice: 'Hielo', Fighting: 'Lucha',
  Poison: 'Veneno', Ground: 'Tierra', Flying: 'Volador', Psychic: 'Psíquico', Bug: 'Bicho', Rock: 'Roca', Ghost: 'Fantasma',
  Dragon: 'Dragón', Dark: 'Siniestro', Steel: 'Acero', Fairy: 'Hada',
};
export const COLOR_TIPO: Record<TypeName, number> = {
  Normal: 0xa8a77a, Fire: 0xee8130, Water: 0x6390f0, Electric: 0xf7d02c, Grass: 0x7ac74c, Ice: 0x96d9d6, Fighting: 0xc22e28,
  Poison: 0xa33ea1, Ground: 0xe2bf65, Flying: 0xa98ff3, Psychic: 0xf95587, Bug: 0xa6b91a, Rock: 0xb6a136, Ghost: 0x735797,
  Dragon: 0x6f35fc, Dark: 0x705746, Steel: 0xb7b7ce, Fairy: 0xd685ad,
};

export type Stat6 = 'atk' | 'def' | 'spa' | 'spd' | 'spe' | 'accuracy' | 'evasion';
export type Boosts = Partial<Record<Stat6, number>>;
export interface MoveData {
  id: string; name: string; nombre: string; num: number; type: TypeName; category: 'Physical' | 'Special' | 'Status';
  basePower: number; accuracy: number | true; pp: number; priority: number; target: string; flags: string[]; critRatio: number;
  multihit: number | [number, number] | null; drain: [number, number] | null; recoil: [number, number] | null; selfSwitch: boolean;
  heal: [number, number] | null; boosts: Boosts | null; selfBoosts: Boosts | null; status: string | null;
  secondary: { chance: number; status: string | null; boosts: Boosts | null; selfBoosts: Boosts | null } | null;
  ohko: boolean; fixedDamage: number | 'level' | null;
  /** Lo que usa el catálogo de animaciones (src/fx/catalog.ts). */
  secondaryChance?: number | null;
}
interface Aprende { especie: string; tipos: TypeName[]; gen: number; lista: [number, string][]; macho?: number }

const D = datos as unknown as { moves: Record<string, MoveData>; aprende: Record<string, Aprende>; tipos: Record<TypeName, Partial<Record<TypeName, number>>> };

export function getMove(id: string): MoveData | undefined { return D.moves[id]; }
// Tipos oficiales de una forma (id del juego: 'bulbasaur', 'pidgeotto'…).
export function tiposDe(forma: string): TypeName[] { return D.aprende[forma]?.tipos ?? ['Normal']; }
// Probabilidad de que una forma salga macho (oficial; −1 = sin sexo).
export function probMacho(forma: string): number { return D.aprende[forma]?.macho ?? 0.5; }
// Movimientos que aprende por nivel, en orden: [nivel, id].
export function aprendizaje(forma: string): [number, string][] { return D.aprende[forma]?.lista ?? []; }
// Multiplicador de un tipo atacante contra los tipos del defensor (0, ¼, ½, 1, 2, 4).
export function eficacia(atk: TypeName, def: TypeName[]): number {
  return def.reduce((k, t) => k * (D.tipos[t]?.[atk] ?? 1), 1);
}

// El ataque básico de una forma: el primer movimiento de daño que aprende (Placaje, Arañazo, Picotazo…).
export function ataqueBasico(forma: string): string {
  const l = aprendizaje(forma);
  return l.find(([, m]) => (getMove(m)?.basePower ?? 0) > 0)?.[1] ?? l[0]?.[1] ?? 'tackle';
}
