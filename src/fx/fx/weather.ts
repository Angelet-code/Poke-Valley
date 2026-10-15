/**
 * Weather while it lasts: rain, sun, sand, snow or hail on its own canvas, under the move effects.
 * From Pokémon Colleja (fx/weather.ts). Pokémon Valley: it covers the whole view (screen space, it does not scroll
 * with the camera), denser and more visible than in Colleja, where it only had to hint at the weather behind a
 * battle; rain also leaves small splashes on the ground, and hail is its own look.
 */
import { type FxEngine, rand } from './engine';

export type WeatherLook = 'rain' | 'sun' | 'sand' | 'snow' | 'hail';

/** Seconds a weather takes to build up, and to die down when it goes. */
const FADE_IN = 4, FADE_OUT = 3;

export class WeatherLayer {
  private look: WeatherLook | null = null;
  /** How strong each weather is right now (0–1): the new one builds up while the old one dies down. */
  private level = new Map<WeatherLook, number>();
  private budget: Partial<Record<WeatherLook, number>> = {};
  private splashes = 0;

  constructor(readonly engine: FxEngine) {}

  get current(): WeatherLook | null {
    return this.look;
  }

  /** `instant`: already there (entering a map with weather), without building up. */
  set(look: WeatherLook | null, instant = false): void {
    if (look === this.look) return;
    this.look = look;
    if (instant) {
      this.level.clear();
      this.engine.clear();
      if (look) {
        this.level.set(look, 1);
        // Fill the screen at once instead of waiting for the first drops to fall.
        for (let i = 0; i < 40; i++) this.spawn(look, this.engine, 120, true);
      }
    } else if (look && !this.level.has(look)) this.level.set(look, 0);
    if (this.level.size) {
      this.engine.persistent = (engine, dt) => this.step(engine, dt);
      this.engine.underlay = (ctx, engine) => this.underlay(ctx, engine);
      this.engine.wake();
    } else this.stop();
  }

  dispose(): void {
    this.engine.dispose();
  }

  private stop(): void {
    this.engine.persistent = null;
    this.engine.underlay = null;
  }

  private step(engine: FxEngine, dt: number): void {
    dt = Math.max(0, dt);
    for (const [look, level] of this.level) {
      const next = look === this.look ? Math.min(1, level + dt / 1000 / FADE_IN) : Math.max(0, level - dt / 1000 / FADE_OUT);
      if (next <= 0 && look !== this.look) { this.level.delete(look); continue; }
      this.level.set(look, next);
      this.spawn(look, engine, dt * smooth(next));
    }
    // The last drops keep falling on their own once the weather is gone.
    if (!this.level.size) this.stop();
  }

  private underlay(ctx: CanvasRenderingContext2D, engine: FxEngine): void {
    for (const [look, level] of this.level) {
      const k = smooth(level);
      ctx.save();
      if (look === 'sun') sunlight(ctx, engine, k);
      else if (look === 'sand') dust(ctx, engine, k);
      else if (look === 'rain') haze(ctx, engine, `rgba(40, 60, 90, ${0.06 * k})`);
      ctx.restore();
    }
  }

  private spawn(look: WeatherLook, engine: FxEngine, dt: number, prewarm = false): void {
    const area = (engine.width * engine.height) / (900 * 420);
    const rate = { rain: 110, sun: 4, sand: 90, snow: 30, hail: 60 }[look] * area;
    let budget = (this.budget[look] ?? 0) + (rate * dt) / 1000;
    const { width, height } = engine;
    if (look === 'rain') {
      this.splashes += (30 * area * dt) / 1000;
      while (this.splashes >= 1) {
        this.splashes -= 1;
        engine.emit({
          x: rand(0, width),
          y: rand(0, height),
          life: 280,
          size: 1,
          sizeEnd: 4,
          color: '#cfe6ff',
          accent: '#ffffff',
          alpha: 0.45,
          shape: 'bubble',
        });
      }
    }
    while (budget >= 1) {
      budget -= 1;
      const y = prewarm ? rand(0, height) : -10;
      switch (look) {
        case 'rain':
          engine.emit({
            x: rand(-40, width + 120),
            y,
            vx: -160,
            vy: 1250,
            life: 900,
            size: 1.4,
            color: '#a8d0ff',
            alpha: 0.5,
            shape: 'streak',
            stretch: 30,
          });
          break;
        case 'hail':
          engine.emit({
            x: rand(-40, width + 80),
            y,
            vx: -90,
            vy: rand(700, 900),
            life: 1400,
            size: rand(1.6, 2.6),
            color: '#f4faff',
            alpha: 0.85,
            shape: 'dot',
          });
          break;
        case 'snow':
          engine.emit({
            x: rand(0, width),
            y,
            vx: rand(-22, 22),
            vy: rand(40, 80),
            life: 12000,
            size: rand(1.4, 3),
            color: '#f6faff',
            alpha: 0.8,
            fadeIn: 0.05,
            shape: 'dot',
          });
          break;
        case 'sand':
          // Born anywhere on screen and short-lived (fading in and out), so the grains cover the whole view
          // evenly instead of being bright at the left edge and spent by the time they reach the right.
          engine.emit({
            x: rand(-60, width),
            y: rand(-10, height + 10),
            vx: rand(380, 600),
            vy: rand(-30, 50),
            life: rand(900, 1700),
            size: rand(1, 2.2),
            color: '#d9a35c',
            alpha: 0.6,
            fadeIn: 0.3,
            shape: 'streak',
            stretch: 14,
          });
          // Now and then a puff of dust blowing past.
          if (Math.random() < 0.08)
            engine.emit({
              x: rand(-80, width),
              y: rand(0, height),
              vx: rand(260, 380),
              vy: rand(-10, 20),
              life: rand(1600, 2600),
              size: rand(30, 60),
              sizeEnd: rand(70, 110),
              color: '#c9925a',
              alpha: 0.12,
              fadeIn: 0.4,
              shape: 'smoke',
            });
          break;
        case 'sun':
          engine.emit({
            x: rand(width * 0.3, width),
            y: rand(0, height * 0.7),
            vx: rand(-6, 6),
            vy: rand(4, 14),
            life: 4200,
            size: rand(1.5, 3),
            color: '#fff1b0',
            alpha: 0.6,
            fadeIn: 0.3,
            shape: 'glow',
          });
          break;
      }
    }
    this.budget[look] = budget;
  }
}

const smooth = (u: number) => (u = Math.min(1, Math.max(0, u))) * u * (3 - 2 * u);

/** Warm light from the top right corner, breathing slowly. */
function sunlight(ctx: CanvasRenderingContext2D, engine: FxEngine, k: number): void {
  const { width, height } = engine;
  const pulse = (0.85 + 0.15 * Math.sin(engine.now / 900)) * k;
  const gradient = ctx.createRadialGradient(width * 0.9, -height * 0.1, 0, width * 0.9, -height * 0.1, height * 1.3);
  gradient.addColorStop(0, `rgba(255, 214, 120, ${0.4 * pulse})`);
  gradient.addColorStop(0.5, `rgba(255, 170, 60, ${0.14 * pulse})`);
  gradient.addColorStop(1, 'rgba(255, 170, 60, 0)');
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
}

/** A flat veil over the view (the grey of rain). */
function haze(ctx: CanvasRenderingContext2D, engine: FxEngine, color: string): void {
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, engine.width, engine.height);
}

/** The dust of a sandstorm: an even veil plus thicker gusts sweeping left to right. */
function dust(ctx: CanvasRenderingContext2D, engine: FxEngine, k: number): void {
  const { width, height } = engine;
  haze(ctx, engine, `rgba(214, 160, 90, ${0.12 * k})`);
  const band = width * 0.9, shift = ((engine.now * 0.22) % band + band) % band;
  for (let x0 = shift - band; x0 < width; x0 += band) {
    const g = ctx.createLinearGradient(x0, 0, x0 + band, 0);
    g.addColorStop(0, 'rgba(214, 160, 90, 0)');
    g.addColorStop(0.5, `rgba(214, 160, 90, ${0.1 * k})`);
    g.addColorStop(1, 'rgba(214, 160, 90, 0)');
    ctx.fillStyle = g;
    ctx.fillRect(x0, 0, band, height);
  }
}
