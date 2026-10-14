// Pokémon Valley: lo que se ve de un estado mientras dura (en Colleja solo se animaba al caer: allí el estado se
// leía en la ficha del Pokémon). Una pequeña ráfaga cada ESTADO_CADA ms sobre el cuerpo, con los colores de la
// animación de Colleja (TYPE_FX); el tinte del sprite lo pone la escena (TINTE_ESTADO).
import { pick, rand } from './fx/engine';
import { TYPE_FX } from './fx/palette';
import type { SlotGeometry, Stage } from './stage';

export const ESTADO_CADA = 700;
// Tinte del sprite mientras dura (multiplica sus colores).
export const TINTE_ESTADO: Record<string, number> = { brn: 0xffb49c, par: 0xfff09a, psn: 0xdcb0ff, tox: 0xc89cff, frz: 0x9fd8ff, slp: 0xd8dcf0 };

export function auraEstado(stage: Stage, at: SlotGeometry, estado: string): void {
  const s = at.size, fx = stage.fx;
  switch (estado) {
    case 'brn': {
      // Llamitas que suben del cuerpo.
      const p = TYPE_FX.Fire;
      fx.burst(5, (i) => ({
        x: at.center.x + rand(-s * 0.3, s * 0.3), y: at.feet.y - rand(0, s * 0.45), vx: rand(-15, 15), vy: -rand(70, 130),
        life: rand(380, 560), delay: i * 60, size: rand(4, 7), sizeEnd: 1, color: pick([p.core, p.glow, p.hot]), shape: 'glow',
      }));
      break;
    }
    case 'par': {
      // Chispas que saltan alrededor.
      const p = TYPE_FX.Electric;
      fx.burst(4, (i) => {
        const a = rand(0, Math.PI * 2), r = s * rand(0.25, 0.45);
        return {
          x: at.center.x + Math.cos(a) * r, y: at.center.y + Math.sin(a) * r * 0.8, vx: Math.cos(a + 1.6) * rand(120, 220), vy: Math.sin(a + 1.6) * rand(120, 220),
          life: 140, delay: i * 90, size: rand(1.4, 2.2), color: pick([p.hot, '#ffffff', p.glow]), shape: 'streak', stretch: 40,
        };
      });
      break;
    }
    case 'psn':
    case 'tox': {
      // Burbujas moradas que suben y revientan.
      const p = TYPE_FX.Poison, n = estado === 'tox' ? 5 : 3;
      fx.burst(n, (i) => ({
        x: at.center.x + rand(-s * 0.3, s * 0.3), y: at.center.y + rand(-s * 0.1, s * 0.25), vx: rand(-10, 10), vy: -rand(30, 60),
        life: rand(500, 700), delay: i * 110, size: rand(2.5, 4.5), sizeEnd: 5, color: estado === 'tox' ? p.dark : p.core, accent: p.hot, alpha: 0.9, shape: 'bubble',
      }));
      break;
    }
    case 'frz': {
      // Destellos de hielo.
      const p = TYPE_FX.Ice;
      fx.burst(3, (i) => ({
        x: at.center.x + rand(-s * 0.35, s * 0.35), y: at.center.y + rand(-s * 0.35, s * 0.2), life: 420, delay: i * 120,
        size: rand(3, 5), sizeEnd: 0.5, color: pick([p.hot, '#ffffff']), shape: 'star', spin: rand(-3, 3),
      }));
      break;
    }
    case 'slp':
      // La "Z" la pone la escena (texto); aquí, un halo tenue que respira.
      fx.emit({ x: at.top.x + s * 0.15, y: at.top.y, vx: 12, vy: -28, life: 900, size: 5, sizeEnd: 9, color: TYPE_FX.Psychic.glow, alpha: 0.35, shape: 'glow' });
      break;
  }
}
