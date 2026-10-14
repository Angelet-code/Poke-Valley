// El escenario de las animaciones de Pokémon Colleja (src/fx/templates.ts y compañía), llevado a Phaser.
// En Colleja era el lado DOM: medía los sprites con getBoundingClientRect y los movía con Web Animations. Aquí:
// - Las partículas y efectos se pintan en un <canvas> encima del de Phaser (#game), con el mismo motor (fx/engine.ts),
//   que avanza con el bucle del juego (`actualizar`) y se desplaza con la cámara.
// - Coordenadas del escenario = px de mundo × zoom de la cámara / ESCALA_FX, y `left`/`top` es dónde empieza la
//   vista. El canvas las pinta × ESCALA_FX: lo que se coloca respecto a los sprites cae en su sitio, y lo que en las
//   plantillas va en px fijos (grosores, partículas, recorridos) sale más grande que en Colleja.
// - Cada luchador tiene un `FxSprite`: desplazamiento, escala, giro, opacidad y destello que las animaciones cambian
//   (fotogramas tipo CSS: translate, scale, rotate) y que la escena suma a su posición al dibujarlo.
import Phaser from 'phaser';
import { FxEngine, type Vec } from './fx/engine';
import { WeatherLayer } from './fx/weather';
import type { SideId, SlotId } from './tipos';

// Cuánto más grandes que en Colleja se ven los efectos (grosores, partículas, recorridos) respecto a su sitio.
export const ESCALA_FX = 1.4;

export interface FxSprite {
  dx: number; dy: number;      // px de escenario
  sx: number; sy: number;
  rot: number;                 // grados
  alpha: number;
  flash: number;               // 1 = silueta blanca (golpe)
  obj: Phaser.GameObjects.Sprite | null;
}
export const fxSprite = (obj: Phaser.GameObjects.Sprite | null = null): FxSprite => ({ dx: 0, dy: 0, sx: 1, sy: 1, rot: 0, alpha: 1, flash: 0, obj });

export interface SlotGeometry {
  slot: SlotId;
  side: SideId;
  center: Vec;
  feet: Vec;
  top: Vec;
  size: number;
  sprite: FxSprite | null;
}

export type LabelTone = 'neutral' | 'strong' | 'weak' | 'good' | 'bad';
type Channel = 'transform' | 'filter' | 'opacity';
type Valores = Partial<Record<'dx' | 'dy' | 'sx' | 'sy' | 'rot' | 'alpha' | 'flash', number>>;
interface Clave { offset: number; v: Valores }
interface Anim { spr: FxSprite; canal: Channel; claves: Clave[]; dur: number; t: number; delay: number; ease: (t: number) => number; fin: () => void }

const NEUTRO: Required<Valores> = { dx: 0, dy: 0, sx: 1, sy: 1, rot: 0, alpha: 1, flash: 0 };
const COLOR_TONO: Record<LabelTone, string> = { neutral: '#fff6dc', strong: '#ffd65a', weak: '#c9d2dc', good: '#9be38a', bad: '#ff9a8a' };

// "translate(4px, -6px) scale(1.06, 0.93) rotate(7deg)" → valores (skew no se aplica a un sprite de Phaser).
function leerTransform(css: string): Valores {
  const v: Valores = { dx: 0, dy: 0, sx: 1, sy: 1, rot: 0 };
  for (const [, fn, args] of css.matchAll(/(\w+)\(([^)]*)\)/g)) {
    const n = args.split(',').map(a => parseFloat(a));
    if (fn === 'translate') { v.dx = n[0] || 0; v.dy = n[1] || 0; }
    else if (fn === 'translateX') v.dx = n[0] || 0;
    else if (fn === 'translateY') v.dy = n[0] || 0;
    else if (fn === 'scale') { v.sx = n[0]; v.sy = n[1] ?? n[0]; }
    else if (fn === 'rotate') v.rot = n[0] || 0;
  }
  return v;
}
// Filtros: la silueta blanca del golpe ("brightness(0) invert(1)"); el resto (brillos, sombras de color) no se ve aquí.
const leerFiltro = (css: string): Valores => ({ flash: /brightness\(0\)\s*invert\(1\)/.test(css) ? 1 : 0 });

function bezier(x1: number, y1: number, x2: number, y2: number): (t: number) => number {
  const c = (a: number, b: number, t: number) => 3 * a * t * (1 - t) ** 2 + 3 * b * t * t * (1 - t) + t ** 3;
  return (x: number) => {
    let lo = 0, hi = 1;
    for (let i = 0; i < 24; i++) { const m = (lo + hi) / 2; if (c(x1, x2, m) < x) lo = m; else hi = m; }
    return c(y1, y2, (lo + hi) / 2);
  };
}
function leerEase(e = 'cubic-bezier(0.2, 0.8, 0.2, 1)'): (t: number) => number {
  const m = /cubic-bezier\(([^)]*)\)/.exec(e);
  if (m) { const [a, b, c, d] = m[1].split(',').map(Number); return bezier(a, b, c, d); }
  if (e === 'linear') return t => t;
  if (e === 'ease-in') return bezier(0.42, 0, 1, 1);
  if (e === 'ease-out') return bezier(0, 0, 0.58, 1);
  if (e === 'ease-in-out') return bezier(0.42, 0, 0.58, 1);
  return bezier(0.25, 0.1, 0.25, 1);
}

export class Stage {
  readonly fx: FxEngine;
  readonly canvas: HTMLCanvasElement;
  // Clima (lluvia, sol, arena, nieve, granizo) mientras dura: otro canvas debajo del de los efectos, fijo en pantalla.
  readonly clima: WeatherLayer;
  private readonly canvasClima: HTMLCanvasElement;
  private anims: Anim[] = [];
  private zoom = 1;
  left = 0;
  top = 0;
  speed = 1;
  readonly skipped = false;

  constructor(private readonly scene: Phaser.Scene) {
    const juego = scene.game.canvas;
    this.canvas = document.createElement('canvas');
    this.canvas.dataset.fx = 'stage';
    // Encima del canvas de Phaser, del mismo tamaño (index.html: los dos en la misma celda de #game).
    this.canvas.style.cssText = `grid-area: 1 / 1; pointer-events: none; z-index: 1; width: ${juego.width}px; height: ${juego.height}px;`;
    juego.style.gridArea = '1 / 1';
    this.canvasClima = document.createElement('canvas');
    this.canvasClima.dataset.fx = 'clima';
    this.canvasClima.style.cssText = this.canvas.style.cssText;
    juego.parentElement!.appendChild(this.canvasClima);
    juego.parentElement!.appendChild(this.canvas);
    const motorClima = new FxEngine(this.canvasClima);
    motorClima.external = true;
    motorClima.resize(juego.width, juego.height);
    this.clima = new WeatherLayer(motorClima);
    this.fx = new FxEngine(this.canvas);
    this.fx.external = true;
    this.fx.blend = 'source-over';
    this.fx.scale = ESCALA_FX;
    this.fx.resize(juego.width, juego.height);
  }

  // Ocultar los dos canvas (p. ej. durante la cinemática de la evolución, que va en una escena de Phaser encima).
  visible(v: boolean): void { for (const c of [this.canvas, this.canvasClima]) c.style.visibility = v ? '' : 'hidden'; }

  get width(): number { return this.fx.width; }
  get height(): number { return this.fx.height; }
  // De px de mundo a px de escenario y al revés.
  aEscena(x: number, y: number): Vec { return { x: x * this.zoom, y: y * this.zoom }; }
  get k(): number { return this.zoom; }

  sideColor(side: SideId): string { return side === 'p1' ? '#d4ff3a' : '#ff4f8b'; }
  // Dónde está cada luchador (lo pone la escena): con él se pintan las flechas de stats y los estados tras un golpe.
  geometria: ((slot: SlotId) => SlotGeometry | null) | null = null;
  slot(slot: SlotId): SlotGeometry | null { return this.geometria?.(slot) ?? null; }

  // Cada fotograma: la vista sigue a la cámara (con su temblor), avanza el reloj de las partículas y los sprites.
  actualizar(time: number, dtMs: number): void {
    const cam = this.scene.cameras.main, z = cam.zoom / ESCALA_FX;
    this.zoom = z;
    const sh = cam.shakeEffect as unknown as { isRunning: boolean; _offsetX: number; _offsetY: number };
    const ox = sh.isRunning ? sh._offsetX : 0, oy = sh.isRunning ? sh._offsetY : 0;
    this.left = cam.worldView.x * z - ox / ESCALA_FX;
    this.top = cam.worldView.y * z - oy / ESCALA_FX;
    this.fx.offset.x = this.left;
    this.fx.offset.y = this.top;
    this.fx.frame_(time);
    this.clima.engine.frame_(time);
    const dt = dtMs * this.speed;
    for (let i = this.anims.length - 1; i >= 0; i--) {
      const a = this.anims[i];
      a.t += dt;
      const t = Math.min(1, Math.max(0, (a.t - a.delay) / a.dur));
      if (a.t < a.delay) continue;
      this.aplicar(a, a.ease(t));
      if (t >= 1) { this.anims.splice(i, 1); a.fin(); }
    }
  }

  private aplicar(a: Anim, t: number): void {
    const cl = a.claves;
    let i = 0;
    while (i < cl.length - 2 && t > cl[i + 1].offset) i++;
    const p = cl[i], q = cl[i + 1] ?? p, u = q.offset > p.offset ? Math.min(1, Math.max(0, (t - p.offset) / (q.offset - p.offset))) : 1;
    for (const k of Object.keys({ ...p.v, ...q.v }) as (keyof Valores)[]) {
      const a0 = p.v[k] ?? NEUTRO[k], a1 = q.v[k] ?? NEUTRO[k];
      a.spr[k] = k === 'flash' ? (u < 1 ? a0 : a1) : a0 + (a1 - a0) * u;
    }
  }

  // Fotogramas al estilo Web Animations sobre el FxSprite de un luchador. Uno nuevo en el mismo canal sustituye al anterior.
  animate(sprite: FxSprite | null | undefined, keyframes: Keyframe[], duration: number, options: { easing?: string; channel?: Channel; delay?: number } = {}): Promise<void> {
    if (!sprite) return Promise.resolve();
    const canal = options.channel ?? (keyframes.some(k => 'opacity' in k) ? 'opacity' : keyframes.some(k => 'filter' in k) ? 'filter' : 'transform');
    const n = keyframes.length;
    const claves: Clave[] = keyframes.map((k, i) => ({
      offset: typeof k.offset === 'number' ? k.offset : n === 1 ? 1 : NaN,
      v: canal === 'opacity' ? { alpha: Number(k.opacity ?? 1) } : canal === 'filter' ? leerFiltro(String(k.filter ?? 'none')) : leerTransform(String(k.transform ?? '')),
    }));
    // Offsets que faltan: repartidos entre los conocidos (como Web Animations).
    if (Number.isNaN(claves[0].offset)) claves[0].offset = 0;
    if (Number.isNaN(claves[n - 1].offset)) claves[n - 1].offset = 1;
    for (let i = 1; i < n - 1; i++) if (Number.isNaN(claves[i].offset)) {
      let j = i; while (Number.isNaN(claves[j].offset)) j++;
      const a = claves[i - 1].offset, b = claves[j].offset;
      for (let m = i; m < j; m++) claves[m].offset = a + (b - a) * (m - i + 1) / (j - i + 1);
    }
    const viejo = this.anims.findIndex(a => a.spr === sprite && a.canal === canal);
    if (viejo >= 0) { const [a] = this.anims.splice(viejo, 1); a.fin(); }
    return new Promise(fin => this.anims.push({ spr: sprite, canal, claves, dur: Math.max(1, duration), t: 0, delay: options.delay ?? 0, ease: leerEase(options.easing), fin }));
  }

  // Temblor de la cámara (los impactos fuertes); más suave que en Colleja: aquí hay golpes a cada momento.
  shake(strength: number, duration = 260): Promise<void> {
    const cam = this.scene.cameras.main;
    cam.shake(duration, Math.min(0.012, strength * 0.45 / Math.max(1, this.width)), false);
    return this.wait(duration);
  }

  hitFlash(sprite: FxSprite | null, duration = 160): Promise<void> {
    return this.animate(sprite, [{ filter: 'brightness(0) invert(1)' }, { filter: 'brightness(0) invert(1)', offset: 0.35 }, { filter: 'none' }], duration, { channel: 'filter', easing: 'linear' });
  }

  // Nombre del movimiento: un rótulo pequeño sobre quien lo usa (en Colleja entraba por un lado del escenario).
  banner(_side: SideId, _pokemon: string, _move: string, _typeColor: string): void { /* lo enseña el HUD */ }

  // Texto que sube y se desvanece ("Supereficaz", "Crítico", "−12"…), en px de escenario.
  label(at: Vec, text: string, tone: LabelTone = 'neutral', delay = 0): void {
    const z = this.zoom, t = this.scene.add.text(at.x / z, at.y / z - 4, text, {
      fontFamily: '"Pixelify Sans", "Segoe UI", sans-serif', fontSize: `${7 * z * ESCALA_FX}px`, color: COLOR_TONO[tone], fontStyle: 'bold', stroke: '#2a1a10', strokeThickness: 2 * z * ESCALA_FX,
    }).setOrigin(0.5, 1).setScale(1 / (z * ESCALA_FX)).setDepth(1e6).setAlpha(0);
    t.resetPipeline();
    this.scene.tweens.add({ targets: t, alpha: 1, y: t.y - 6, duration: 140, delay: delay / this.speed, onComplete: () => {
      this.scene.tweens.add({ targets: t, y: t.y - 10, alpha: 0, delay: 500, duration: 420, onComplete: () => t.destroy() });
    } });
  }

  // Copia que se desvanece del sprite (Agilidad, Doble Equipo, ataques rápidos), desplazada y teñida.
  afterimage(sprite: FxSprite | null, offset: Vec, color: string, delay = 0, duration = 360): void {
    const o = sprite?.obj;
    if (!o) return;
    const z = this.zoom, g = this.scene.add.image(o.x + offset.x / z, o.y + offset.y / z, o.texture.key, o.frame.name)
      .setOrigin(o.originX, o.originY).setScale(o.scaleX, o.scaleY).setDepth(o.depth - 0.5).setAlpha(0)
      .setTintFill(Phaser.Display.Color.HexStringToColor(color).color);
    g.resetPipeline();
    this.scene.tweens.add({ targets: g, alpha: { from: 0.55, to: 0 }, delay, duration, ease: 'Quad.easeOut', onComplete: () => g.destroy() });
  }

  wait(ms: number): Promise<void> { return this.fx.wait(ms); }
  nextFrame(): Promise<void> { return new Promise(r => this.scene.events.once(Phaser.Scenes.Events.POST_UPDATE, () => r())); }
  skip(): void { this.fx.skip(); this.settle(); this.fx.resume(); }
  resume(): void { this.fx.resume(); }

  // Todo a reposo (al cambiar de mapa o al desmayarse).
  settle(): void {
    for (const a of this.anims.splice(0)) { Object.assign(a.spr, { ...NEUTRO, obj: a.spr.obj }); a.fin(); }
  }

  dispose(): void {
    this.settle();
    this.fx.dispose();
    this.clima.dispose();
    this.canvas.remove();
    this.canvasClima.remove();
  }
}
