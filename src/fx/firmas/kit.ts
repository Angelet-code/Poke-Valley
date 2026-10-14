// Kit para las animaciones "firma" (src/fx/firmas/): una animación propia por movimiento, encima de las plantillas
// de Colleja (que quedan de respaldo para lo que no tenga firma). Reúne lo que todas comparten para que cada firma
// solo cuente lo suyo: la geometría atacante → objetivo en cualquier dirección (vista desde arriba), las fases
// (anticipar, cargar, impacto, después), los gestos del sprite y los efectos.
// Guía para escribir firmas: src/fx/firmas/LEEME.md.
import {
  beam, bloom, bolt, charge, cracks, dim, flash, panel, ring, shield, slash, sparks, spotlight, starburst, sunbeam, sweep, torrent, vines,
} from '../fx/effects';
import { type Effect, type FxEngine, type ParticleSpec, type Vec, easeIn, easeInOut, easeOut, easeOutCubic, lerp, pick, rand } from '../fx/engine';
import { type FxPalette, NEUTRAL_FX, TYPE_FX, mix, withAlpha } from '../fx/palette';
import { elementalImpact, elementalTrail, flames } from '../elements';
import {
  aftermath, aim, anticipate, bigCharge, chargeUp, direction, drainOrbs, dust, fireBurst, impactoFirma, outcome, recover, whirl,
  type MoveContext,
} from '../templates';
import type { SlotGeometry, Stage } from '../stage';
import type { TypeName } from '../tipos';

/** Una firma: la animación entera de un movimiento. Tiene que llamar a `k.impacto()` (o `k.estado()`) una vez. */
export type Firma = (k: Kit) => Promise<void>;

/** Los efectos de fx/effects.ts y los de las plantillas, a mano. */
export const E = {
  ring, flash, charge, beam, bolt, slash, starburst, bloom, shield, sweep, panel, spotlight, cracks, sparks, torrent, vines, dim, sunbeam,
  fireBurst, dust, whirl, drainOrbs, flames, elementalImpact, elementalTrail,
};
export { rand, pick, lerp, easeIn, easeOut, easeInOut, easeOutCubic, TYPE_FX, NEUTRAL_FX, withAlpha, mix };
export type { Effect, ParticleSpec, Vec, FxPalette, SlotGeometry, TypeName };

export class Kit {
  readonly ctx: MoveContext;
  readonly stage: Stage;
  readonly fx: FxEngine;
  readonly user: SlotGeometry;
  /** El objetivo principal (o un punto delante del usuario si el movimiento no tiene). */
  readonly target: SlotGeometry;
  readonly hayObjetivo: boolean;
  readonly palette: FxPalette;
  readonly type: TypeName;
  /** 0-1 según la potencia: (potencia base − 40) / 110. Ascuas 0, Lanzallamas 0,45, Hiperrayo 1. */
  readonly power: number;
  /** Movimiento grande (≥ 120 de potencia, o de carga): se permite más espectáculo. */
  readonly epic: boolean;
  /** Distancia y dirección (unitaria) del centro del usuario al del objetivo, y su perpendicular. */
  readonly dist: number;
  readonly dir: Vec;
  readonly perp: Vec;
  readonly angle: number;

  constructor(ctx: MoveContext) {
    this.ctx = ctx;
    this.stage = ctx.stage;
    this.fx = ctx.stage.fx;
    this.user = ctx.user;
    this.hayObjetivo = ctx.targets.length > 0;
    this.target = aim(ctx);
    this.palette = ctx.palette;
    this.type = ctx.animation.type;
    this.power = ctx.animation.power;
    this.epic = ctx.animation.epic;
    const d = this.hayObjetivo ? direction(this.user.center, this.target.center) : { x: 1, y: 0 };
    this.dir = d;
    this.perp = { x: -d.y, y: d.x };
    this.angle = Math.atan2(d.y, d.x);
    this.dist = this.hayObjetivo ? Math.hypot(this.target.center.x - this.user.center.x, this.target.center.y - this.user.center.y) : this.user.size;
  }

  // ---- Geometría (px de escenario) ----
  /** Punto del camino atacante → objetivo: t = 0 en el usuario, 1 en el objetivo; `lado` px hacia la perpendicular. */
  punto(t: number, lado = 0): Vec {
    const a = this.user.center, b = this.hayObjetivo ? this.target.center : { x: a.x + this.dir.x * this.dist, y: a.y };
    return { x: lerp(a.x, b.x, t) + this.perp.x * lado, y: lerp(a.y, b.y, t) + this.perp.y * lado };
  }
  /** Punto al azar dentro del cuerpo de un Pokémon (por defecto, el objetivo). */
  enCuerpo(g: SlotGeometry = this.target, k = 0.35): Vec {
    return { x: g.center.x + rand(-g.size * k, g.size * k), y: g.center.y + rand(-g.size * k, g.size * k * 0.8) };
  }
  /** Punto en un círculo (achatado en vertical, como el suelo visto en 3/4) alrededor de `c`. */
  alrededor(c: Vec, r: number, a: number, achatado = 0.55): Vec {
    return { x: c.x + Math.cos(a) * r, y: c.y + Math.sin(a) * r * achatado };
  }
  /** Dónde está ahora el centro de un Pokémon, con lo que le hayan movido las animaciones (embestidas, saltos…). */
  posSprite(g: SlotGeometry = this.user): Vec {
    const s = g.sprite;
    return { x: g.center.x + (s?.dx ?? 0), y: g.center.y + (s?.dy ?? 0) };
  }
  /** Vector de longitud `n` en la dirección del ataque (para velocidades: k.haciaV(600)). */
  haciaV(n: number, lado = 0): Vec { return { x: this.dir.x * n + this.perp.x * lado, y: this.dir.y * n + this.perp.y * lado }; }
  /** Tamaño relativo: `k.s(1)` = el tamaño del objetivo (px). Úsalo para que todo escale con el Pokémon. */
  s(f: number): number { return this.target.size * f; }
  /** Interpola con la potencia: k.porPotencia(flojo, fuerte). */
  porPotencia(flojo: number, fuerte: number): number { return lerp(flojo, fuerte, this.power); }
  /** ¿El golpe acierta al objetivo principal? (si falla, la animación puede pasar de largo) */
  get acierta(): boolean { return this.hayObjetivo && outcome(this.ctx, this.target.slot) === 'hit'; }
  get critico(): boolean { return this.ctx.cue.hits.some(h => h.crit); }

  // ---- Fases ----
  esperar(ms: number): Promise<void> { return this.stage.wait(ms); }
  /** Se encoge hacia atrás antes de actuar. */
  anticipar(ms = 90): Promise<void> { return anticipate(this.ctx, this.target.center, ms); }
  /** Vuelve a su sitio desde donde esté (desplazamiento en px de escenario). */
  recuperar(desde: Vec = { x: 0, y: 0 }, ms = 200): Promise<void> { return recover(this.ctx, desde, ms); }
  /** Concentra luz de su tipo antes de un ataque especial. */
  cargar(ms = 140): Promise<void> { return chargeUp(this.ctx, ms); }
  /** La gran carga de los movimientos épicos (oscurece la vista y concentra energía). */
  cargaEpica(): Promise<void> { return bigCharge(this.ctx); }
  /**
   * El impacto compartido: reacción de cada objetivo (golpe, esquiva, protección, "No afecta"), rótulos, el daño (commit)
   * y la sacudida de cámara según la potencia. `extra` añade lo propio de la firma en cada objetivo alcanzado.
   */
  impacto(extra?: (t: SlotGeometry) => void): Promise<void> { return impactoFirma(this.ctx, extra); }
  /** Después del golpe: absorber vida, retroceso, flechas de stats y estados. */
  despues(): Promise<void> { return aftermath(this.ctx); }
  /** Para movimientos de estado: aplica (commit) y enseña flechas y estados. */
  async estado(): Promise<void> { this.ctx.commit(); await aftermath(this.ctx); }

  // ---- Gestos del sprite (fotogramas tipo CSS en px de escenario) ----
  /**
   * Embestida: el usuario sale hacia el objetivo (fracción `hasta` del camino) y vuelve. Resuelve al llegar (el
   * momento del golpe); la vuelta sigue sola. `arco`: px de salto en la ida (cabezazos, placajes con salto).
   */
  async embestida(o: { hasta?: number; ida?: number; vuelta?: number; arco?: number; estela?: string } = {}): Promise<void> {
    const hasta = o.hasta ?? 0.75, ida = o.ida ?? 120, vuelta = o.vuelta ?? 220, arco = o.arco ?? 0;
    const lejos = Math.max(0, this.dist - this.target.size * 0.45) * hasta;
    const v = { x: this.dir.x * lejos, y: this.dir.y * lejos };
    if (o.estela) for (let i = 1; i <= 3; i++) this.stage.afterimage(this.user.sprite, { x: v.x * i / 4, y: v.y * i / 4 }, o.estela, i * 25, 220);
    await this.stage.animate(this.user.sprite, [
      { transform: 'translate(0px, 0px) scale(1, 1)' },
      { transform: `translate(${v.x * 0.5}px, ${v.y * 0.5 - arco}px) scale(1.05, 0.95)`, offset: 0.55 },
      { transform: `translate(${v.x}px, ${v.y}px) scale(1.1, 0.9)` },
    ], ida, { easing: 'cubic-bezier(0.5, 0, 0.9, 0.6)' });
    void this.stage.animate(this.user.sprite, [
      { transform: `translate(${v.x}px, ${v.y}px) scale(1.1, 0.9)` },
      { transform: 'translate(0px, 0px) scale(1, 1)' },
    ], vuelta, { easing: 'cubic-bezier(0.34, 1.4, 0.64, 1)' });
  }
  /** Salto en el sitio (px de alto). */
  saltar(sprite: SlotGeometry['sprite'], alto: number, ms = 260): Promise<void> {
    return this.stage.animate(sprite, [
      { transform: 'translate(0px, 0px) scale(1, 1)' },
      { transform: `translate(0px, ${-alto}px) scale(0.95, 1.06)`, offset: 0.45 },
      { transform: 'translate(0px, 0px) scale(1.08, 0.92)', offset: 0.85 },
      { transform: 'translate(0px, 0px) scale(1, 1)' },
    ], ms);
  }
  /** Temblor (px) de un sprite. */
  agitar(sprite: SlotGeometry['sprite'], px = 4, ms = 260): Promise<void> {
    const f: Keyframe[] = [];
    for (let i = 0; i <= 8; i++) f.push({ transform: `translate(${i % 2 ? px : -px}px, 0px)` });
    f.push({ transform: 'translate(0px, 0px)' });
    return this.stage.animate(sprite, f, ms, { easing: 'linear' });
  }
  /** Giro completo (vueltas) de un sprite. */
  girar(sprite: SlotGeometry['sprite'], vueltas = 1, ms = 400): Promise<void> {
    return this.stage.animate(sprite, [{ transform: 'rotate(0deg)' }, { transform: `rotate(${360 * vueltas}deg)` }], ms, { easing: 'ease-in-out' });
  }
  /** Fotogramas libres sobre un sprite (translate/scale/rotate; opacity va por su canal). */
  animar(sprite: SlotGeometry['sprite'], fotogramas: Keyframe[], ms: number, easing?: string): Promise<void> {
    return this.stage.animate(sprite, fotogramas, ms, easing ? { easing } : {});
  }
  /** Copia que se desvanece del sprite, desplazada (estelas, velocidad). */
  sombra(sprite: SlotGeometry['sprite'], desplaza: Vec, color: string, retraso = 0, ms = 300): void {
    this.stage.afterimage(sprite, desplaza, color, retraso, ms);
  }
  /** Silueta blanca de golpe en un sprite. */
  destello(sprite: SlotGeometry['sprite'], ms = 160): void { void this.stage.hitFlash(sprite, ms); }
  /** Rótulo flotante (rara vez: el impacto ya pone Crítico, Supereficaz…). */
  rotulo(at: Vec, txt: string, tono: 'neutral' | 'strong' | 'weak' | 'good' | 'bad' = 'neutral'): void { this.stage.label(at, txt, tono); }

  // ---- Partículas y efectos ----
  emit(p: ParticleSpec): void { this.fx.emit(p); }
  burst(n: number, f: (i: number) => ParticleSpec): void { this.fx.burst(n, f); }
  add(e: Effect): void { this.fx.add(e); }
  /** Efecto propio: draw(ctx, t 0-1, engine) en coordenadas de escenario, durante `ms`. */
  dibujar(ms: number, draw: (c: CanvasRenderingContext2D, t: number, engine: FxEngine) => void, o: { z?: number; delay?: number } = {}): void {
    this.fx.add({ duration: ms, z: o.z, delay: o.delay, draw });
  }
  /** Proyectil que viaja del usuario al objetivo en `ms` dibujando `cada` (posición, t) en cada fotograma. Resuelve al llegar. */
  async proyectil(ms: number, cada: (p: Vec, t: number, c: CanvasRenderingContext2D, engine: FxEngine) => void, o: { arco?: number; lado?: number; ease?: (t: number) => number } = {}): Promise<void> {
    const arco = o.arco ?? 0, lado = o.lado ?? 0, ease = o.ease ?? ((t: number) => t);
    this.dibujar(ms, (c, t, engine) => {
      const u = ease(t), p = this.punto(u, lado * Math.sin(Math.PI * u));
      cada({ x: p.x, y: p.y - arco * Math.sin(Math.PI * u) }, u, c, engine);
    }, { z: 1 });
    await this.esperar(ms);
  }
}
