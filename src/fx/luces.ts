// Luz de los ataques (2026-10-17): los efectos de fx/ se pintan en un <canvas> encima de Phaser, así que por sí solos no
// tocan la luz del mapa. Este puente crea focos Light2D a partir de ellos, y con eso la luz del ataque da en los mapas
// de normales (Pokémon con el pipeline cel, los árboles Arcane) y en el suelo:
// - Partículas: cada fotograma se agrupan las vivas (brillos, chispas, estrellas…; el humo y las rocas no dan luz) en
//   focos: posición media, color medio, radio según lo dispersas que están e intensidad según cuántas y qué grandes.
// - Destellos: las plantillas (templates.ts) piden un destello explícito en la carga, el impacto y el crítico, con el
//   perfil de su tipo (PERFIL_TIPO: cómo late, cuánto alcanza y cómo le da al cel).
// - Seguidores: una luz pegada a algo que se mueve (los proyectiles dirigidos), refrescada cada fotograma.
// Hay un cupo de focos (CUPO) dentro de `maxLights` (main.ts); si hay más candidatos, se quedan los más fuertes.
import Phaser from 'phaser';
import type { TypeName } from '../data/movimientos';
import type { TipoLuz } from '../render/luces';
import type { FxEngine, ParticleShape } from './fx/engine';

/** Lo que el pipeline cel lee de cada luz (CelPipeline.ts). */
export type CelLuz = Pick<TipoLuz, 'bandas' | 'umbral' | 'altura' | 'suave'>;

export interface PerfilLuz extends CelLuz {
  radio: number;       // ×: cuánto alcanza respecto al destello base
  intensidad: number;  // ×
  parpadeo: number;    // ruido rápido (fuego)
  chispa: number;      // apagones breves (eléctrico)
  cola: number;        // ×: cuánto dura la caída (fuego y veneno se apagan despacio; eléctrico y lucha, de golpe)
}

const BASE: PerfilLuz = { radio: 1, intensidad: 1, parpadeo: 0, chispa: 0, cola: 1, bandas: 3, umbral: 0.1, altura: 0.7, suave: 0.5 };
export const PERFIL_TIPO: Record<TypeName, PerfilLuz> = {
  Normal:   { ...BASE },
  Fire:     { ...BASE, radio: 1.15, intensidad: 1.15, parpadeo: 0.25, cola: 1.3, altura: 0.4, suave: 0.35 },
  Water:    { ...BASE, radio: 1.1, suave: 0.8, altura: 0.8 },
  Electric: { ...BASE, radio: 1.25, intensidad: 1.35, chispa: 0.7, cola: 0.6, bandas: 2, suave: 0, altura: 0.6, umbral: 0 },
  Grass:    { ...BASE, radio: 0.95, suave: 0.6 },
  Ice:      { ...BASE, radio: 1.1, bandas: 4, suave: 0.3, altura: 0.85 },
  Fighting: { ...BASE, radio: 0.85, intensidad: 1.1, cola: 0.55, altura: 0.5 },
  Poison:   { ...BASE, radio: 1.0, cola: 1.5, altura: 0.35, suave: 0.7 },
  Ground:   { ...BASE, radio: 1.1, intensidad: 0.7, altura: 0.3, cola: 1.2 },
  Flying:   { ...BASE, radio: 1.1, intensidad: 0.8, altura: 0.9, suave: 0.8 },
  Psychic:  { ...BASE, radio: 1.2, bandas: 4, altura: 0.75, cola: 1.3 },
  Bug:      { ...BASE, radio: 0.9, intensidad: 0.85 },
  Rock:     { ...BASE, radio: 0.9, intensidad: 0.7, altura: 0.3, cola: 0.8 },
  Ghost:    { ...BASE, radio: 1.2, intensidad: 1.0, altura: 0.25, suave: 0.6, cola: 1.6, umbral: -0.05 },
  Dragon:   { ...BASE, radio: 1.25, intensidad: 1.2, altura: 0.6 },
  Dark:     { ...BASE, radio: 1.0, intensidad: 0.6, altura: 0.2, cola: 1.4 },
  Steel:    { ...BASE, radio: 1.0, intensidad: 1.1, bandas: 2, suave: 0.15, altura: 0.8, cola: 0.6 },
  Fairy:    { ...BASE, radio: 1.1, bandas: 4, altura: 0.75, suave: 0.3, cola: 1.2 },
};

// Cuánto ilumina cada forma de partícula (0 = nada: humo, rocas, hojas casi nada).
const LUZ_FORMA: Record<ParticleShape, number> = {
  glow: 1, star: 0.9, streak: 0.7, dot: 0.5, drop: 0.4, heart: 0.4, shard: 0.35, chevron: 0.3, bubble: 0.25, leaf: 0.1, smoke: 0, rock: 0,
};

/** Focos de ataque que se pueden encender a la vez (dentro de `maxLights`; el resto son farolas y la luz del jugador). */
export const CUPO = 10;
const RADIO_GRUPO = 26;      // px de mundo: partículas más cerca que esto van al mismo foco
const MAX_GRUPOS = 24;

interface Destello { x: number; y: number; rgb: [number, number, number]; radio: number; intensidad: number; ms: number; t: number; perfil: PerfilLuz; fase: number }
interface Seguidor { x: number; y: number; rgb: [number, number, number]; radio: number; intensidad: number; perfil: PerfilLuz; vivo: boolean; fase: number }
interface Grupo { x: number; y: number; r: number; g: number; b: number; w: number; n: number; d2: number }
interface Candidato { x: number; y: number; rgb: [number, number, number]; radio: number; intensidad: number; cel: CelLuz }

type LuzCel = Phaser.GameObjects.Light & { cel?: CelLuz };

export class LuzFx {
  /** 0 = pleno día (la luz extra se nota poco sobre el ambiente blanco), 1 = noche cerrada. Lo pone la escena. */
  oscuro = 0;
  /** Escala total (0 apaga el puente). */
  ganancia = 1;
  private pool: LuzCel[] = [];
  private destellos: Destello[] = [];
  private seguidores = new Map<string, Seguidor>();
  private grupos: Grupo[] = [];
  private colores = new Map<string, [number, number, number]>();
  private t = 0;

  constructor(private readonly scene: Phaser.Scene) {}

  /**
   * Un destello en un punto del mundo: sube en 40 ms y se apaga en `ms` (× la cola del tipo). `radio` en px de mundo.
   * `color` acepta número (0xrrggbb) o CSS (#rrggbb, rgba()).
   */
  destello(x: number, y: number, color: number | string, radio: number, intensidad: number, ms: number, tipo?: TypeName): void {
    const perfil = tipo ? PERFIL_TIPO[tipo] : BASE;
    this.destellos.push({ x, y, rgb: this.rgb(color), radio: radio * perfil.radio, intensidad: intensidad * perfil.intensidad, ms: ms * perfil.cola, t: 0, perfil, fase: Math.random() * 100 });
  }
  /** Una luz pegada a algo que se mueve: hay que llamarla cada fotograma o se apaga. */
  seguir(id: string, x: number, y: number, color: number | string, radio: number, intensidad: number, tipo?: TypeName): void {
    const perfil = tipo ? PERFIL_TIPO[tipo] : BASE;
    const s = this.seguidores.get(id);
    if (s) { s.x = x; s.y = y; s.vivo = true; return; }
    this.seguidores.set(id, { x, y, rgb: this.rgb(color), radio: radio * perfil.radio, intensidad: intensidad * perfil.intensidad, perfil, vivo: true, fase: Math.random() * 100 });
  }

  /** Cada fotograma: agrupa las partículas del motor (en px de escenario; `k` = px de escenario por px de mundo). */
  actualizar(fx: FxEngine, k: number, dtMs: number): void {
    this.t += dtMs / 1000;
    const cand: Candidato[] = [];
    const dia = 0.45 + 0.55 * this.oscuro;   // de día el ambiente ya es blanco: la luz extra solo tiñe
    const g = this.ganancia * dia;
    // Destellos: envolvente (subida rápida, caída suave) y la animación del tipo.
    for (let i = this.destellos.length - 1; i >= 0; i--) {
      const d = this.destellos[i];
      d.t += dtMs;
      if (d.t >= d.ms) { this.destellos.splice(i, 1); continue; }
      const u = d.t / d.ms, env = d.t < 40 ? d.t / 40 : 1 - Math.pow((d.t - 40) / Math.max(1, d.ms - 40), 0.8);
      const f = Math.max(0, env) * this.latido(d.perfil, d.fase);
      if (f <= 0.01) continue;
      cand.push({ x: d.x, y: d.y, rgb: d.rgb, radio: d.radio * (0.85 + 0.3 * u), intensidad: d.intensidad * f * g, cel: d.perfil });
    }
    for (const [id, s] of this.seguidores) {
      if (!s.vivo) { this.seguidores.delete(id); continue; }
      s.vivo = false;
      cand.push({ x: s.x, y: s.y, rgb: s.rgb, radio: s.radio, intensidad: s.intensidad * this.latido(s.perfil, s.fase) * g, cel: s.perfil });
    }
    // Partículas → grupos.
    const gr = this.grupos; gr.length = 0;
    const r2 = RADIO_GRUPO * RADIO_GRUPO;
    fx.forEachLive((x, y, color, size, alpha, shape) => {
      const lf = LUZ_FORMA[shape];
      if (!lf) return;
      const wx = x / k, wy = y / k, w = lf * alpha * Math.min(10, size / k + 0.5);
      if (w <= 0.02) return;
      let mejor: Grupo | null = null, md = Infinity;
      for (const q of gr) { const dx = q.x / q.w - wx, dy = q.y / q.w - wy, d = dx * dx + dy * dy; if (d < md) { md = d; mejor = q; } }
      if (!mejor || (md > r2 && gr.length < MAX_GRUPOS)) { mejor = { x: 0, y: 0, r: 0, g: 0, b: 0, w: 0, n: 0, d2: 0 }; gr.push(mejor); md = 0; }
      const [r, gg, b] = this.rgb(color);
      mejor.x += wx * w; mejor.y += wy * w; mejor.r += r * w; mejor.g += gg * w; mejor.b += b * w; mejor.w += w; mejor.n++; mejor.d2 += md * w;
    });
    for (const q of gr) {
      if (q.w < 0.6) continue;
      const w = q.w, disp = Math.sqrt(q.d2 / w);
      const rgb: [number, number, number] = [q.r / w, q.g / w, q.b / w];
      const mx = Math.max(rgb[0], rgb[1], rgb[2], 1e-3);
      cand.push({ x: q.x / w, y: q.y / w, rgb: [rgb[0] / mx, rgb[1] / mx, rgb[2] / mx], radio: Math.min(200, 36 + disp * 1.6 + Math.sqrt(w) * 7), intensidad: 1.0 * (1 - Math.exp(-w / 10)) * g, cel: BASE });
    }
    // Los más fuertes al cupo; el resto del pool, apagado.
    cand.sort((a, b) => b.intensidad * b.radio - a.intensidad * a.radio);
    const n = Math.min(CUPO, cand.length);
    while (this.pool.length < n) { const l = this.scene.lights.addLight(0, 0, 60, 0xffffff, 0) as LuzCel; l.setVisible(false); this.pool.push(l); }
    for (let i = 0; i < this.pool.length; i++) {
      const l = this.pool[i], c = cand[i];
      if (!c || i >= n) { if (l.visible) l.setVisible(false); continue; }
      l.setVisible(true).setPosition(c.x, c.y).setRadius(c.radio).setIntensity(c.intensidad);
      l.color.set(c.rgb[0], c.rgb[1], c.rgb[2]);
      l.cel = c.cel;
    }
  }

  private latido(p: PerfilLuz, fase: number): number {
    let f = 1;
    const t = this.t;
    if (p.parpadeo) f += p.parpadeo * (0.5 * Math.sin(t * 23 + fase) + 0.3 * Math.sin(t * 41 + fase * 1.7) + 0.2 * Math.sin(t * 97 + fase * 0.3));
    if (p.chispa) { const r = Math.sin(t * 29 + fase) * Math.sin(t * 53 + fase * 3); if (r > 0.55) f *= 1 - p.chispa; }
    return Math.max(0, f);
  }

  // Color CSS o número → [r, g, b] en 0-1 (con caché: las plantillas repiten los mismos pocos colores).
  private rgb(c: number | string): [number, number, number] {
    if (typeof c === 'number') return [((c >> 16) & 255) / 255, ((c >> 8) & 255) / 255, (c & 255) / 255];
    let v = this.colores.get(c);
    if (!v) {
      if (c[0] === '#') {
        const h = c.length >= 7 ? c.slice(1, 7) : c.slice(1, 4).split('').map(ch => ch + ch).join(''), n = parseInt(h, 16);
        v = [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
      } else {
        const m = /rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/.exec(c);
        v = m ? [+m[1] / 255, +m[2] / 255, +m[3] / 255] : [1, 1, 1];
      }
      this.colores.set(c, v);
    }
    return v;
  }

  /** Todo apagado (al cambiar de mapa). */
  apagar(): void { this.destellos.length = 0; this.seguidores.clear(); for (const l of this.pool) l.setVisible(false); }
  dispose(): void {
    this.apagar();
    for (const l of this.pool) this.scene.lights.removeLight(l);
    this.pool.length = 0;
  }
}
