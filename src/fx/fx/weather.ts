/**
 * Weather while it lasts: rain, sun, sand, snow or hail on its own canvas, under the move effects.
 * From Pokémon Colleja (fx/weather.ts). Pokémon Valley: it covers the whole view (screen space, it does not scroll
 * with the camera), denser and more visible than in Colleja, where it only had to hint at the weather behind a
 * battle; rain also leaves small splashes on the ground, and hail is its own look.
 */
import { type FxEngine, rand } from './engine';

export type WeatherLook = 'rain' | 'sun' | 'sand' | 'snow' | 'hail';

export class WeatherLayer {
  private look: WeatherLook | null = null;
  private budget = 0;
  private splashes = 0;

  constructor(readonly engine: FxEngine) {}

  get current(): WeatherLook | null {
    return this.look;
  }

  set(look: WeatherLook | null): void {
    if (look === this.look) return;
    this.look = look;
    this.engine.clear();
    this.engine.persistent = look ? (engine, dt) => this.spawn(engine, dt) : null;
    this.engine.underlay = look === 'sun' ? sunlight : look === 'sand' ? haze('rgba(214, 160, 90, 0.16)') : look === 'rain' ? haze('rgba(40, 60, 90, 0.06)') : null;
    if (look) {
      // Fill the screen at once instead of waiting for the first drops to fall.
      for (let i = 0; i < 40; i++) this.spawn(this.engine, 120, true);
      this.engine.wake();
    }
  }

  dispose(): void {
    this.engine.dispose();
  }

  private spawn(engine: FxEngine, dt: number, prewarm = false): void {
    const area = (engine.width * engine.height) / (900 * 420);
    const rate = { rain: 110, sun: 4, sand: 70, snow: 30, hail: 60 }[this.look ?? 'rain'] * area;
    this.budget += (rate * dt) / 1000;
    const { width, height } = engine;
    if (this.look === 'rain') {
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
    while (this.budget >= 1) {
      this.budget -= 1;
      const y = prewarm ? rand(0, height) : -10;
      switch (this.look) {
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
          engine.emit({
            x: prewarm ? rand(0, width) : -10,
            y: rand(0, height),
            vx: rand(320, 520),
            vy: rand(-20, 40),
            life: 3600,
            size: rand(1, 2.2),
            color: '#d9a35c',
            alpha: 0.6,
            shape: 'streak',
            stretch: 14,
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
  }
}

/** Warm light from the top right corner, breathing slowly. */
function sunlight(ctx: CanvasRenderingContext2D, engine: FxEngine): void {
  const { width, height } = engine;
  const pulse = 0.85 + 0.15 * Math.sin(engine.now / 900);
  const gradient = ctx.createRadialGradient(width * 0.9, -height * 0.1, 0, width * 0.9, -height * 0.1, height * 1.3);
  gradient.addColorStop(0, `rgba(255, 214, 120, ${0.4 * pulse})`);
  gradient.addColorStop(0.5, `rgba(255, 170, 60, ${0.14 * pulse})`);
  gradient.addColorStop(1, 'rgba(255, 170, 60, 0)');
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
}

/** A flat veil over the view (the dust of a sandstorm, the grey of rain). */
function haze(color: string) {
  return (ctx: CanvasRenderingContext2D, engine: FxEngine): void => {
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, engine.width, engine.height);
  };
}
