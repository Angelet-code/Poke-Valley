// Tipos que las animaciones de Pokémon Colleja (src/fx/*, copiadas de su apps/web/src/features/battle/animation)
// importaban de sus paquetes (@colleja/core, @colleja/data, timeline.ts). Aquí no hay protocolo de Showdown: el
// combate en tiempo real (src/combate/) arma el `MoveCue` de cada golpe y `SlotId` es el id de un luchador.
export type { TypeName, MoveData } from '../data/movimientos';
export { getMove } from '../data/movimientos';

/** p1 = el jugador y los suyos; p2 = los salvajes. Solo decide colores y hacia dónde entran los rótulos. */
export type SideId = 'p1' | 'p2';
/** Un luchador en el mapa (su uid). */
export type SlotId = string;

export type Effectiveness = 'normal' | 'super' | 'resisted' | 'immune';
export interface HitCue { slot: SlotId; effectiveness: Effectiveness; crit: boolean; damaged: boolean }
export type BoostId = 'atk' | 'def' | 'spa' | 'spd' | 'spe' | 'accuracy' | 'evasion';
export interface BoostChange { stat: BoostId; amount: number }

export interface MoveCue {
  kind: 'move';
  user: SlotId;
  move: string;
  targets: SlotId[];
  spread: boolean;
  hits: HitCue[];
  missed: SlotId[];
  blocked: SlotId[];
  failed: boolean;
  hitCount: number;
  drained: boolean;
  recoil: boolean;
  boosts: { slot: SlotId; changes: BoostChange[] }[];
  statuses: { slot: SlotId; status: string }[];
}
