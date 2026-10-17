// Pokémon Valley: lo que se ve de un estado mientras dura (en Colleja solo se animaba al caer: allí el estado se
// leía en la ficha del Pokémon). Una pequeña ráfaga cada ESTADO_CADA ms sobre el cuerpo, con los colores de la
// animación de Colleja (TYPE_FX); el tinte del sprite lo pone la escena (TINTE_ESTADO).
import { pick, rand } from './fx/engine';
import { TYPE_FX } from './fx/palette';
import { bolt, flash, ring, sparks } from './fx/effects';
import type { SlotGeometry, Stage } from './stage';

export const ESTADO_CADA = 700;
// Tinte del sprite mientras dura (multiplica sus colores).
export const TINTE_ESTADO: Record<string, number> = { brn: 0xffb49c, par: 0xfff09a, psn: 0xdcb0ff, tox: 0xc89cff, frz: 0x9fd8ff, slp: 0xd8dcf0 };

// Drenadoras en el que la sufre: hojitas y motas verdes que giran alrededor del cuerpo y bajan hacia él.
export const TINTE_SEMILLA = 0xc8ecb0;   // Drenadoras, si no hay un estado que tiña
export function auraSemilla(stage: Stage, at: SlotGeometry): void {
  const s = at.size, p = TYPE_FX.Grass;
  stage.fx.burst(3, (i) => {
    const a = rand(0, Math.PI * 2), r = s * rand(0.3, 0.45);
    return {
      x: at.center.x + Math.cos(a) * r, y: at.center.y + Math.sin(a) * r * 0.7, vx: -Math.cos(a) * 30, vy: -Math.sin(a) * 22 + 8,
      life: rand(450, 650), delay: i * 120, size: rand(3.5, 5), sizeEnd: 1.5, color: pick([p.core, p.glow, p.dark]), shape: i ? 'leaf' : 'glow', spin: rand(-6, 6),
    };
  });
}
// Un turno de Drenadoras: orbes verdes que salen del sembrado y vuelan hasta quien sembró (y un destello al llegar).
export function drenaje(stage: Stage, de: SlotGeometry, a: SlotGeometry): void {
  const p = TYPE_FX.Grass, dx = a.center.x - de.center.x, dy = a.center.y - de.center.y;
  const life = Math.max(350, Math.min(900, Math.hypot(dx, dy) * 2.2));
  stage.fx.burst(10, (i) => {
    const ox = rand(-de.size * 0.2, de.size * 0.2), oy = rand(-de.size * 0.2, de.size * 0.2);
    return { x: de.center.x + ox, y: de.center.y + oy, vx: (dx - ox) / life * 1000, vy: (dy - oy) / life * 1000, life, delay: i * 50,
      size: rand(7, 10), sizeEnd: 4, color: pick([p.core, p.glow, p.hot]), fadeIn: 0.15, shape: 'glow' };
  });
  stage.fx.burst(6, (i) => ({
    x: de.center.x, y: de.center.y, vx: dx / life * 1000 + rand(-25, 25), vy: dy / life * 1000 + rand(-25, 25), life, delay: 20 + i * 80,
    size: rand(3, 4), sizeEnd: 2, color: pick([p.core, p.dark]), shape: 'leaf', spin: rand(-8, 8),
  }));
  stage.fx.burst(5, (i) => ({
    x: a.center.x + rand(-a.size * 0.25, a.size * 0.25), y: a.center.y + rand(-a.size * 0.1, a.size * 0.25), vy: -rand(30, 60),
    life: 500, delay: life + i * 60, size: rand(2.5, 4), sizeEnd: 0.5, color: pick([p.glow, p.hot]), shape: 'star', spin: rand(-3, 3),
  }));
}

// Rayo de la tormenta (combate/mundo.ts pasoRayos): cae del cielo al punto (x, y, en px de escenario) con fogonazo,
// anillo en el suelo y chispas; como el final de Trueno, sin la nube ni el oscurecido.
export function rayoTormenta(stage: Stage, x: number, y: number, s: number): void {
  const p = TYPE_FX.Electric, fx = stage.fx, desde = { x: x + rand(-s * 0.4, s * 0.4), y: stage.top - 10 }, a = { x, y };
  fx.add(bolt({ from: desde, to: a, palette: p, duration: 380, width: 9, branches: 4 }));
  fx.add(bolt({ from: { x: desde.x + s * 0.5, y: desde.y }, to: a, palette: p, duration: 300, width: 4, branches: 2, delay: 40 }));
  fx.add(flash({ color: '#ffffff', alpha: 0.45, duration: 240 }));
  fx.add(ring({ at: a, from: s * 0.2, to: s * 1.4, width: 5, color: p.glow, duration: 420, squash: 0.45 }));
  sparks(fx, a, { count: 22, speed: [180, 420], palette: p, shape: 'streak' });
  stage.luz(a, p.glow, s * 4, 1.6, 420, 'Electric');
}

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
