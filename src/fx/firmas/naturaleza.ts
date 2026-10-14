// Firmas de movimientos (ver LEEME.md). Grupo: Planta, Bicho y Veneno.
import { E, NEUTRAL_FX, TYPE_FX, easeIn, easeInOut, easeOut, easeOutCubic, lerp, pick, rand, withAlpha, type Firma, type FxPalette, type Kit, type Vec } from './kit';
import { forma, mandibula } from './formas';
import type { FxEngine } from '../fx/engine';

const PLANTA = TYPE_FX.Grass, BICHO = TYPE_FX.Bug, VENENO = TYPE_FX.Poison, VIDA = NEUTRAL_FX.heal;
const SOL: FxPalette = { core: '#ffc928', glow: '#ffe88a', hot: '#fffbe0', dark: '#8a5a00' };
const ACIDO: FxPalette = { core: '#9ad21e', glow: '#d4f25a', hot: '#f6ffd0', dark: '#3e5a06' };
const ROSA: FxPalette = { core: '#ff7ab8', glow: '#ffc0dc', hot: '#fff0f6', dark: '#a02a6a' };
const MIEL: FxPalette = { core: '#ffb81a', glow: '#ffd86a', hot: '#fff4c8', dark: '#8a5a00' };
const VERDES = ['#58c43a', '#8ad84a', '#3e9a2a', '#a6e874'];
const MORADOS = ['#7b2cb4', '#a64ce0', '#5a1a8a', '#c27ef0'];

// ---------------------------------------------------------------------------------------------------------------
// Ayudas de dibujo (canvas, coordenadas de escenario)
// ---------------------------------------------------------------------------------------------------------------

/** Luz suave (sprite de brillo del motor) en `p`, de radio `r`. El color tiene que ser #rrggbb. */
function luz(c: CanvasRenderingContext2D, engine: FxEngine, p: Vec, r: number, color: string, alpha = 1): void {
  if (r <= 0) return;
  c.save();
  c.globalCompositeOperation = engine.blend;
  c.globalAlpha *= alpha;
  c.drawImage(engine.glow(color), p.x - r, p.y - r, r * 2, r * 2);
  c.restore();
}

/** Punto de la curva cuadrática a → b con control `m`. */
function bez(a: Vec, m: Vec, b: Vec, t: number): Vec {
  const u = 1 - t;
  return { x: u * u * a.x + 2 * u * t * m.x + t * t * b.x, y: u * u * a.y + 2 * u * t * m.y + t * t * b.y };
}
/** La curva a → b (control `m`) muestreada en `n` tramos hasta la fracción `hasta`. */
function curva(a: Vec, m: Vec, b: Vec, n: number, hasta = 1): Vec[] {
  return Array.from({ length: n + 1 }, (_, i) => bez(a, m, b, (i / n) * hasta));
}
/** Traza una polilínea. */
function trazo(c: CanvasRenderingContext2D, pts: Vec[], ancho: number, color: string): void {
  if (pts.length < 2) return;
  c.lineCap = 'round'; c.lineJoin = 'round';
  c.strokeStyle = color; c.lineWidth = ancho;
  c.beginPath(); c.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) c.lineTo(pts[i].x, pts[i].y);
  c.stroke();
}
/** Polilínea que se afina de `w0` a `w1` (raíces, lianas). */
function trazoAfilado(c: CanvasRenderingContext2D, pts: Vec[], w0: number, w1: number, color: string): void {
  c.lineCap = 'round'; c.strokeStyle = color;
  const n = pts.length - 1;
  for (let i = 0; i < n; i++) {
    c.lineWidth = Math.max(0.6, lerp(w0, w1, i / Math.max(1, n - 1)));
    c.beginPath(); c.moveTo(pts[i].x, pts[i].y); c.lineTo(pts[i + 1].x, pts[i + 1].y); c.stroke();
  }
}

interface ColLiana { oscuro: string; base: string; claro: string; hoja: string }
const LIANA: ColLiana = { oscuro: '#173f10', base: '#3e9a2a', claro: '#a6e874', hoja: '#58c43a' };

/** Una liana a lo largo de `pts`: tallo con borde y brillo que se afina hacia la punta, y hojitas alternas. */
function liana(c: CanvasRenderingContext2D, pts: Vec[], grosor: number, col: ColLiana = LIANA, hojas = 3): void {
  if (pts.length < 2) return;
  const n = pts.length - 1;
  for (const [color, f] of [[col.oscuro, 1.45], [col.base, 1], [col.claro, 0.3]] as const) trazoAfilado(c, pts, grosor * f, grosor * f * 0.35, color);
  if (n < 4) return;
  for (let j = 1; j <= hojas; j++) {
    const i = Math.max(1, Math.min(n - 1, Math.round((n * j) / (hojas + 1))));
    const a = pts[i - 1], b = pts[i + 1], tan = Math.atan2(b.y - a.y, b.x - a.x), lado = j % 2 ? 1 : -1;
    const tam = grosor * 1.5 * (1 - 0.45 * i / n), ang = tan + lado * 0.95;
    forma(c, 'hoja', pts[i].x + Math.cos(ang) * tam, pts[i].y + Math.sin(ang) * tam, tam, ang, { base: col.hoja, borde: col.oscuro, grosor: 1.1 });
  }
}

/**
 * Látigo de liana: sale del usuario abierta hacia `lado` (px, perpendicular), crece y restalla sobre el objetivo
 * (la curva cambia de lado, como un látigo) y se recoge. `alTope` se llama una vez, al restallar, con la punta.
 */
function latigo(k: Kit, ms: number, o: { lado: number; grosor: number; hojas?: number; delay?: number; col?: ColLiana; alTope?: (p: Vec) => void }): void {
  let restallo = false;
  k.dibujar(ms, (c, t) => {
    const crece = Math.min(1, t / 0.5), vuelve = t > 0.66 ? easeIn((t - 0.66) / 0.34) : 0;
    const u = k.posSprite(k.user), a = { x: u.x + k.dir.x * k.user.size * 0.25, y: u.y + k.dir.y * k.user.size * 0.25 };
    const m = k.punto(0.5, o.lado * (1 - 1.5 * easeIn(crece))), b = k.punto(1);
    const pts = curva(a, m, b, 22, Math.max(0.04, easeOut(crece) * (1 - vuelve)));
    for (let i = 1; i < pts.length; i++) {
      const w = Math.sin(i * 0.7 - t * 18) * o.grosor * 0.6 * (i / pts.length);
      pts[i] = { x: pts[i].x + k.perp.x * w, y: pts[i].y + k.perp.y * w };
    }
    liana(c, pts, o.grosor, o.col, o.hojas ?? 3);
    if (!restallo && crece >= 1) { restallo = true; o.alTope?.(pts[pts.length - 1]); }
  }, { z: 1, delay: o.delay });
}

/** El chasquido de un látigo en `p`: rayos blancos cortos. */
function chasquido(k: Kit, p: Vec, f = 1): void {
  k.add(E.starburst({ at: p, rays: 7, length: k.s(0.3 * f), width: 2 * f, palette: { ...PLANTA, hot: '#ffffff' }, duration: 180 }));
}

/** Hojas sueltas que saltan desde `p`. */
function hojas(k: Kit, p: Vec, n: number, tam: number, vel = 160, cols: readonly string[] = VERDES): void {
  k.burst(n, () => {
    const a = rand(0, Math.PI * 2), v = rand(vel * 0.4, vel);
    return { x: p.x, y: p.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 40, ay: 140, drag: 2, life: rand(450, 750), size: tam * rand(0.7, 1.2), color: pick(cols), accent: '#1d5c17', shape: 'leaf', rot: rand(0, 6), spin: rand(-9, 9) };
  });
}

/** Gotas (veneno, ácido, lodo) que salpican desde `p`, con gravedad. */
function salpicar(k: Kit, p: Vec, n: number, cols: readonly string[], vel = 220, tam = 3, haciaV?: Vec): void {
  k.burst(n, () => {
    const a = rand(0, Math.PI * 2), v = rand(vel * 0.4, vel);
    const vx = (haciaV?.x ?? 0) + Math.cos(a) * v, vy = (haciaV?.y ?? 0) + Math.sin(a) * v - v * 0.4;
    return { x: p.x, y: p.y, vx, vy, ay: 700, drag: 1, life: rand(380, 600), size: tam * rand(0.7, 1.3), color: pick(cols), shape: 'drop', stretch: 18 };
  });
}

/** Burbujas que suben y revientan desde un cuerpo (veneno, ácido). */
function burbujas(k: Kit, centro: Vec, r: number, n: number, color: string, claro: string, delay = 0): void {
  k.burst(n, i => ({ x: centro.x + rand(-r, r), y: centro.y + rand(-r * 0.5, r * 0.6), vx: rand(-12, 12), vy: -rand(30, 80), life: rand(380, 620), delay: delay + i * 18, size: rand(2.5, 5.5), color, accent: claro, shape: 'bubble', fadeIn: 0.15 }));
}

/** Semilla: almendra marrón con brillo, raya y (opcional) una puntita verde. */
function semilla(c: CanvasRenderingContext2D, x: number, y: number, tam: number, ang: number, verde = true): void {
  c.save(); c.translate(x, y); c.rotate(ang);
  const g = c.createRadialGradient(-tam * 0.3, -tam * 0.3, tam * 0.1, 0, 0, tam);
  g.addColorStop(0, '#f0d08a'); g.addColorStop(0.55, '#a8692c'); g.addColorStop(1, '#5e3510');
  c.fillStyle = g; c.strokeStyle = '#3a1e08'; c.lineWidth = Math.max(1, tam * 0.12);
  c.beginPath(); c.ellipse(0, 0, tam, tam * 0.66, 0, 0, Math.PI * 2); c.fill(); c.stroke();
  c.strokeStyle = 'rgba(58,30,8,0.55)'; c.lineWidth = Math.max(0.7, tam * 0.07);
  c.beginPath(); c.moveTo(-tam * 0.7, 0.05 * tam); c.quadraticCurveTo(0, -tam * 0.2, tam * 0.72, 0); c.stroke();
  if (verde) { c.fillStyle = '#5cc23e'; c.strokeStyle = '#1d5c17'; c.lineWidth = 0.8; c.beginPath(); c.ellipse(tam * 0.95, -tam * 0.18, tam * 0.4, tam * 0.17, -0.6, 0, Math.PI * 2); c.fill(); c.stroke(); }
  c.restore();
}

/** Brote: un tallito con dos hojas, de `alto` px, que nace en (x, y). */
function brote(c: CanvasRenderingContext2D, x: number, y: number, alto: number): void {
  if (alto < 2) return;
  trazo(c, [{ x, y }, { x: x + alto * 0.08, y: y - alto * 0.5 }, { x, y: y - alto }], Math.max(1.5, alto * 0.12), '#2e7a20');
  for (const s of [-1, 1]) forma(c, 'hoja', x + s * alto * 0.38, y - alto * 1.05, alto * 0.42, s < 0 ? Math.PI + 0.5 : -0.5, { base: '#6ad04a', borde: '#1d5c17', grosor: 1 });
}

/** Brizna de hierba que nace en (x, y). */
function brizna(c: CanvasRenderingContext2D, x: number, y: number, alto: number, inclina: number, color: string): void {
  if (alto < 1) return;
  const w = Math.max(1.2, alto * 0.13);
  c.beginPath();
  c.moveTo(x - w, y);
  c.quadraticCurveTo(x - w * 0.3 + inclina * 0.3, y - alto * 0.6, x + inclina, y - alto);
  c.quadraticCurveTo(x + w * 0.3 + inclina * 0.3, y - alto * 0.6, x + w, y);
  c.closePath();
  c.fillStyle = color; c.fill(); c.strokeStyle = '#1d5c17'; c.lineWidth = 0.8; c.stroke();
}

/** Flor de `n` pétalos con su centro. */
function flor(c: CanvasRenderingContext2D, x: number, y: number, r: number, rot: number, petalo: string, centro: string, n = 5, borde = '#8a2a5a'): void {
  if (r < 0.5) return;
  c.save(); c.translate(x, y); c.rotate(rot);
  c.fillStyle = petalo; c.strokeStyle = borde; c.lineWidth = Math.max(0.8, r * 0.08);
  for (let i = 0; i < n; i++) {
    const a = (i * 2 * Math.PI) / n;
    c.beginPath(); c.ellipse(Math.cos(a) * r * 0.55, Math.sin(a) * r * 0.55, r * 0.52, r * 0.34, a, 0, Math.PI * 2); c.fill(); c.stroke();
  }
  c.fillStyle = centro; c.beginPath(); c.arc(0, 0, r * 0.28, 0, Math.PI * 2); c.fill(); c.stroke();
  c.restore();
}

/** Pétalo suelto: óvalo con muesca en la punta. */
function petalo(c: CanvasRenderingContext2D, x: number, y: number, tam: number, ang: number, color: string, borde = '#c0507e'): void {
  c.save(); c.translate(x, y); c.rotate(ang);
  c.beginPath();
  c.moveTo(-tam, 0);
  c.bezierCurveTo(-tam * 0.4, -tam * 0.75, tam * 0.7, -tam * 0.7, tam, -tam * 0.14);
  c.lineTo(tam * 0.75, 0);
  c.lineTo(tam, tam * 0.14);
  c.bezierCurveTo(tam * 0.7, tam * 0.7, -tam * 0.4, tam * 0.75, -tam, 0);
  c.closePath();
  c.fillStyle = color; c.fill(); c.strokeStyle = borde; c.lineWidth = Math.max(0.7, tam * 0.1); c.stroke();
  c.restore();
}

interface ColLodo { oscuro: string; base: string; claro: string }
const LODO: ColLodo = { oscuro: '#2c0846', base: '#7b2cb4', claro: '#d49cf8' };
const MUGRE: ColLodo = { oscuro: '#1e0a28', base: '#4e2a5a', claro: '#9a7aa8' };
const COL_ACIDO: ColLodo = { oscuro: '#3a5206', base: '#9ad21e', claro: '#ecff9a' };
const COL_TOXICO: ColLodo = { oscuro: '#1e0430', base: '#5a1a8a', claro: '#b06ae0' };

/** Pegote de lodo que tiembla: borde ondulado, degradado, reflejo y burbujitas en la superficie. */
function pegote(c: CanvasRenderingContext2D, x: number, y: number, r: number, ahora: number, col: ColLodo = LODO, estira = 1, ang = 0): void {
  if (r < 1) return;
  c.save(); c.translate(x, y); c.rotate(ang); c.scale(estira, 1 / Math.sqrt(estira));
  c.beginPath();
  for (let i = 0; i <= 18; i++) {
    const a = (i / 18) * Math.PI * 2, rr = r * (1 + 0.1 * Math.sin(a * 3 + ahora / 90) + 0.06 * Math.sin(a * 5 - ahora / 60));
    if (i === 0) c.moveTo(Math.cos(a) * rr, Math.sin(a) * rr); else c.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
  }
  c.closePath();
  const g = c.createRadialGradient(-r * 0.35, -r * 0.35, r * 0.1, 0, 0, r * 1.1);
  g.addColorStop(0, col.claro); g.addColorStop(0.45, col.base); g.addColorStop(1, col.oscuro);
  c.fillStyle = g; c.fill(); c.strokeStyle = col.oscuro; c.lineWidth = Math.max(1, r * 0.09); c.stroke();
  c.fillStyle = 'rgba(255,255,255,0.55)';
  c.beginPath(); c.ellipse(-r * 0.35, -r * 0.42, r * 0.22, r * 0.11, -0.6, 0, Math.PI * 2); c.fill();
  c.strokeStyle = col.claro; c.lineWidth = Math.max(0.8, r * 0.06);
  for (let i = 0; i < 3; i++) {
    const a = i * 2.1 + ahora / 400, br = r * (0.1 + 0.05 * Math.sin(ahora / 120 + i));
    c.beginPath(); c.arc(Math.cos(a) * r * 0.45, Math.sin(a) * r * 0.4, br, 0, Math.PI * 2); c.stroke();
  }
  c.restore();
}

/** Mancha pegada (salpicón con picos irregulares, `radios` fijos por mancha). */
function mancha(c: CanvasRenderingContext2D, x: number, y: number, r: number, radios: number[], col: ColLodo, alpha = 1): void {
  if (r < 1 || alpha <= 0) return;
  const n = radios.length, pts: Vec[] = radios.map((f, i) => ({ x: x + Math.cos((i / n) * Math.PI * 2) * r * f, y: y + Math.sin((i / n) * Math.PI * 2) * r * f * 0.85 }));
  c.save(); c.globalAlpha *= alpha;
  c.beginPath();
  const mid = (a: Vec, b: Vec): Vec => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
  const ini = mid(pts[n - 1], pts[0]);
  c.moveTo(ini.x, ini.y);
  for (let i = 0; i < n; i++) { const q = mid(pts[i], pts[(i + 1) % n]); c.quadraticCurveTo(pts[i].x, pts[i].y, q.x, q.y); }
  c.closePath();
  const g = c.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r * 1.2);
  g.addColorStop(0, col.claro); g.addColorStop(0.5, col.base); g.addColorStop(1, col.oscuro);
  c.fillStyle = g; c.fill(); c.strokeStyle = col.oscuro; c.lineWidth = Math.max(1, r * 0.06); c.stroke();
  c.fillStyle = 'rgba(255,255,255,0.45)';
  c.beginPath(); c.ellipse(x - r * 0.3, y - r * 0.35, r * 0.2, r * 0.09, -0.5, 0, Math.PI * 2); c.fill();
  c.restore();
}
const radiosMancha = (n = 12): number[] => Array.from({ length: n }, (_, i) => (i % 2 ? rand(0.55, 0.8) : rand(0.95, 1.35)));

/** Abeja de dibujo: cuerpo amarillo a rayas, alas que baten, cabeza delante (+x) y aguijón detrás. */
function abeja(c: CanvasRenderingContext2D, x: number, y: number, tam: number, ang: number, ahora: number): void {
  c.save(); c.translate(x, y); c.rotate(ang);
  const bate = 0.5 + 0.5 * Math.sin(ahora / 16);
  c.fillStyle = 'rgba(235,248,255,0.85)'; c.strokeStyle = '#5a6a7a'; c.lineWidth = 0.8;
  for (const s of [-1, 1]) { c.beginPath(); c.ellipse(-tam * 0.1, s * tam * (0.42 + 0.18 * bate), tam * 0.45, tam * (0.18 + 0.14 * bate), s * 0.4, 0, Math.PI * 2); c.fill(); c.stroke(); }
  c.beginPath(); c.ellipse(0, 0, tam * 0.75, tam * 0.45, 0, 0, Math.PI * 2);
  c.fillStyle = '#ffcf2a'; c.fill();
  c.save(); c.clip(); c.fillStyle = '#2a1a06'; for (const sx of [-0.42, -0.02]) c.fillRect(sx * tam, -tam, tam * 0.2, tam * 2); c.restore();
  c.strokeStyle = '#2a1a06'; c.lineWidth = Math.max(1, tam * 0.1); c.stroke();
  c.fillStyle = '#2a1a06';
  c.beginPath(); c.arc(tam * 0.75, 0, tam * 0.27, 0, Math.PI * 2); c.fill();
  c.beginPath(); c.moveTo(-tam * 0.68, -tam * 0.12); c.lineTo(-tam * 1.08, 0); c.lineTo(-tam * 0.68, tam * 0.12); c.fill();
  c.restore();
}

/** Bichito diminuto (Acoso): puntito oscuro con dos alas que parpadean. */
function bichito(c: CanvasRenderingContext2D, x: number, y: number, r: number, ahora: number): void {
  const bate = Math.sin(ahora / 10) > 0 ? 1 : 0.4;
  c.fillStyle = 'rgba(240,250,230,0.85)';
  c.beginPath(); c.ellipse(x - r * 0.8, y - r * 0.7, r * 0.9, r * 0.45 * bate, -0.5, 0, Math.PI * 2); c.fill();
  c.beginPath(); c.ellipse(x + r * 0.8, y - r * 0.7, r * 0.9, r * 0.45 * bate, 0.5, 0, Math.PI * 2); c.fill();
  c.fillStyle = '#2a3006'; c.beginPath(); c.ellipse(x, y, r, r * 0.8, 0, 0, Math.PI * 2); c.fill();
  c.fillStyle = BICHO.core; c.beginPath(); c.arc(x - r * 0.3, y - r * 0.3, r * 0.3, 0, Math.PI * 2); c.fill();
}

/** Pinzas de insecto (mandíbulas curvas) apuntando a `ang`; `ap` 1 = abiertas, 0 = cerradas con las puntas juntas. */
function pinzas(c: CanvasRenderingContext2D, x: number, y: number, tam: number, ap: number, ang: number): void {
  c.save(); c.translate(x, y); c.rotate(ang); c.scale(tam, tam);
  c.lineJoin = 'round';
  for (const s of [-1, 1]) {
    c.save(); c.scale(1, s);
    c.translate(-0.8, 0.45); c.rotate(0.75 * ap); c.translate(0.8, -0.45);
    c.beginPath();
    c.moveTo(-0.85, 0.5);
    c.quadraticCurveTo(-0.05, 0.85, 0.6, 0.02);
    c.lineTo(0.42, 0.04);
    c.quadraticCurveTo(0.2, 0.2, 0.05, 0.26);
    c.lineTo(0.02, 0.36);
    c.quadraticCurveTo(-0.3, 0.42, -0.72, 0.28);
    c.closePath();
    const g = c.createLinearGradient(-0.8, 0.6, 0.5, 0);
    g.addColorStop(0, '#4e5c06'); g.addColorStop(0.5, '#a8c21a'); g.addColorStop(1, '#eaf6a0');
    c.fillStyle = g; c.fill();
    c.strokeStyle = '#1e2404'; c.lineWidth = 0.07; c.stroke();
    c.strokeStyle = 'rgba(255,255,255,0.55)'; c.lineWidth = 0.05;
    c.beginPath(); c.moveTo(-0.6, 0.55); c.quadraticCurveTo(-0.05, 0.7, 0.4, 0.12); c.stroke();
    c.restore();
  }
  c.restore();
}

/** Sol de dibujo: halo, rayos que giran y disco con degradado. */
function sol(c: CanvasRenderingContext2D, engine: FxEngine, x: number, y: number, r: number, giro: number, alpha = 1): void {
  if (r < 1 || alpha <= 0) return;
  luz(c, engine, { x, y }, r * 2.8, SOL.glow, 0.8 * alpha);
  c.save(); c.translate(x, y); c.rotate(giro); c.globalAlpha *= alpha;
  c.fillStyle = SOL.core; c.strokeStyle = '#c86a00'; c.lineWidth = Math.max(1, r * 0.05);
  for (let i = 0; i < 12; i++) {
    const a = (i * Math.PI) / 6, l = r * (i % 2 ? 1.5 : 1.85);
    c.beginPath(); c.moveTo(Math.cos(a - 0.13) * r * 1.05, Math.sin(a - 0.13) * r * 1.05); c.lineTo(Math.cos(a) * l, Math.sin(a) * l); c.lineTo(Math.cos(a + 0.13) * r * 1.05, Math.sin(a + 0.13) * r * 1.05); c.closePath(); c.fill(); c.stroke();
  }
  const g = c.createRadialGradient(-r * 0.3, -r * 0.3, r * 0.1, 0, 0, r);
  g.addColorStop(0, '#fffbe0'); g.addColorStop(0.5, '#ffd84a'); g.addColorStop(1, '#ff9a1a');
  c.beginPath(); c.arc(0, 0, r, 0, Math.PI * 2); c.fillStyle = g; c.fill(); c.lineWidth = Math.max(1, r * 0.08); c.stroke();
  c.restore();
}

/** Marca de enfado de cómic: cuatro arcos rojos. */
function enfado(c: CanvasRenderingContext2D, x: number, y: number, r: number, color: string): void {
  if (r < 1) return;
  c.lineCap = 'round';
  for (const [ancho, col] of [[r * 0.34, '#4a0a06'], [r * 0.2, color]] as const) {
    c.strokeStyle = col; c.lineWidth = ancho;
    for (let i = 0; i < 4; i++) {
      const a = Math.PI / 4 + (i * Math.PI) / 2, cx = x + Math.cos(a) * r * 1.05, cy = y + Math.sin(a) * r * 1.05;
      c.beginPath(); c.arc(cx, cy, r * 0.6, a + Math.PI - 0.75, a + Math.PI + 0.75); c.stroke();
    }
  }
}

/** Copo de algodón: racimo de bolitas blancas con sombra suave. */
function algodon(c: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  if (r < 1) return;
  for (const [dx, dy, f] of [[-0.45, 0.15, 0.6], [0.45, 0.15, 0.6], [0, -0.3, 0.65], [-0.2, 0.3, 0.55], [0.22, 0.3, 0.55], [0, 0, 0.7]] as const) {
    const cx = x + dx * r, cy = y + dy * r, rr = r * f;
    const g = c.createRadialGradient(cx - rr * 0.3, cy - rr * 0.35, rr * 0.1, cx, cy, rr);
    g.addColorStop(0, '#ffffff'); g.addColorStop(0.7, '#f2f2f8'); g.addColorStop(1, '#c8ccdc');
    c.fillStyle = g; c.beginPath(); c.arc(cx, cy, rr, 0, Math.PI * 2); c.fill();
  }
}

/** Espora de polen (Paralizador): bolita amarilla con pinchitos. */
function espora(c: CanvasRenderingContext2D, x: number, y: number, r: number, giro: number): void {
  c.save(); c.translate(x, y); c.rotate(giro);
  c.strokeStyle = '#8a6a00'; c.lineWidth = Math.max(0.8, r * 0.25);
  c.beginPath();
  for (let i = 0; i < 8; i++) { const a = (i * Math.PI) / 4; c.moveTo(Math.cos(a) * r * 0.7, Math.sin(a) * r * 0.7); c.lineTo(Math.cos(a) * r * 1.5, Math.sin(a) * r * 1.5); }
  c.stroke();
  c.fillStyle = '#ffe23a'; c.beginPath(); c.arc(0, 0, r, 0, Math.PI * 2); c.fill(); c.stroke();
  c.fillStyle = '#fffbe0'; c.beginPath(); c.arc(-r * 0.3, -r * 0.3, r * 0.3, 0, Math.PI * 2); c.fill();
  c.restore();
}

/** Fruta tropical: bola de color con brillo y una hojita. */
function fruta(c: CanvasRenderingContext2D, x: number, y: number, r: number, color: string): void {
  c.save();
  c.fillStyle = color; c.strokeStyle = '#4a1a06'; c.lineWidth = Math.max(1, r * 0.12);
  c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill(); c.stroke();
  c.fillStyle = 'rgba(255,255,255,0.6)'; c.beginPath(); c.ellipse(x - r * 0.35, y - r * 0.35, r * 0.28, r * 0.16, -0.6, 0, Math.PI * 2); c.fill();
  c.fillStyle = '#4cb83a'; c.strokeStyle = '#1d5c17'; c.lineWidth = 0.8;
  c.beginPath(); c.ellipse(x + r * 0.35, y - r * 1.0, r * 0.45, r * 0.2, -0.5, 0, Math.PI * 2); c.fill(); c.stroke();
  c.restore();
}

/** Púa venenosa clavada en el suelo: cono morado con luz por un lado y su sombrita. */
function pua(c: CanvasRenderingContext2D, x: number, y: number, tam: number, inclina = 0): void {
  c.save(); c.translate(x, y); c.rotate(inclina);
  c.fillStyle = 'rgba(30,6,48,0.35)'; c.beginPath(); c.ellipse(0, 0, tam * 0.6, tam * 0.2, 0, 0, Math.PI * 2); c.fill();
  const g = c.createLinearGradient(-tam * 0.5, 0, tam * 0.5, 0);
  g.addColorStop(0, '#e6b8ff'); g.addColorStop(0.45, '#a64ce0'); g.addColorStop(1, '#45106a');
  c.beginPath(); c.moveTo(-tam * 0.5, 0); c.quadraticCurveTo(-tam * 0.15, -tam * 0.6, 0, -tam * 1.4); c.quadraticCurveTo(tam * 0.15, -tam * 0.6, tam * 0.5, 0); c.closePath();
  c.fillStyle = g; c.fill(); c.strokeStyle = '#2a0640'; c.lineWidth = Math.max(1, tam * 0.1); c.stroke();
  c.restore();
}

/** Hilo de seda ondulado de a a b, visible hasta la fracción `hasta`. */
function hilo(c: CanvasRenderingContext2D, a: Vec, b: Vec, hasta: number, ondas: number, amp: number, fase: number, color: string, grosor: number): void {
  if (hasta <= 0) return;
  const d = Math.hypot(b.x - a.x, b.y - a.y) || 1, nx = -(b.y - a.y) / d, ny = (b.x - a.x) / d, pts: Vec[] = [];
  for (let i = 0; i <= 28; i++) {
    const u = (i / 28) * hasta, w = Math.sin(u * Math.PI * ondas + fase) * amp * Math.sin(Math.PI * Math.min(1, u));
    pts.push({ x: lerp(a.x, b.x, u) + nx * w, y: lerp(a.y, b.y, u) + ny * w });
  }
  trazo(c, pts, grosor, color);
}

/** Vueltas de hilo enrolladas alrededor de un cuerpo (de arriba abajo), hasta la fracción `prog`. */
function enrollado(c: CanvasRenderingContext2D, centro: Vec, tam: number, prog: number, color: string, grosor: number, vueltas = 4, ancho = 0.5): void {
  if (prog <= 0) return;
  const pts: Vec[] = [], n = Math.round(60 * prog);
  for (let i = 0; i <= n; i++) {
    const u = i / 60, a = u * vueltas * Math.PI * 2;
    pts.push({ x: centro.x + Math.cos(a) * tam * ancho * (0.85 + 0.15 * Math.sin(u * 9)), y: centro.y - tam * 0.38 + u * tam * 0.75 + Math.sin(a) * tam * 0.12 });
  }
  trazo(c, pts, grosor + 1.5, 'rgba(40,30,50,0.45)');
  trazo(c, pts, grosor, color);
}

/** Telaraña vista en 3/4 (achatada): radios y anillos combados que se tejen con `t` (0-1). */
function telarana(c: CanvasRenderingContext2D, x: number, y: number, r: number, t: number, color: string, achatado = 0.55, radios = 12): void {
  if (r < 2) return;
  const radio = Math.min(1, t * 2), anillos = 5, tejido = Math.max(0, (t - 0.25) / 0.75) * anillos;
  const p = (a: number, rr: number): Vec => ({ x: x + Math.cos(a) * rr, y: y + Math.sin(a) * rr * achatado });
  for (const [col, ancho] of [['rgba(40,40,60,0.45)', 2.6], [color, 1.3]] as const) {
    c.strokeStyle = col; c.lineWidth = ancho; c.lineCap = 'round';
    c.beginPath();
    for (let i = 0; i < radios; i++) { const a = (i / radios) * Math.PI * 2, q = p(a, r * radio); c.moveTo(x, y); c.lineTo(q.x, q.y); }
    c.stroke();
    c.beginPath();
    for (let j = 1; j <= Math.ceil(tejido); j++) {
      const rr = (r * j) / anillos, cuanto = Math.min(1, tejido - (j - 1)), tramos = Math.round(radios * cuanto);
      for (let i = 0; i < tramos; i++) {
        const a0 = (i / radios) * Math.PI * 2, a1 = ((i + 1) / radios) * Math.PI * 2, q0 = p(a0, rr), q1 = p(a1, rr), m = p((a0 + a1) / 2, rr * 0.86);
        c.moveTo(q0.x, q0.y); c.quadraticCurveTo(m.x, m.y, q1.x, q1.y);
      }
    }
    c.stroke();
  }
}

/** Alas de mariposa irisadas a la espalda (Danza Aleteo); `bate` 0-1 = cuánto se ven abiertas. */
function alasMariposa(c: CanvasRenderingContext2D, x: number, y: number, tam: number, bate: number): void {
  if (tam < 2) return;
  for (const s of [-1, 1]) {
    c.save(); c.translate(x, y); c.scale(s * Math.max(0.15, bate), 1);
    const g = c.createRadialGradient(0, 0, tam * 0.1, 0, 0, tam * 1.1);
    g.addColorStop(0, '#ffffff'); g.addColorStop(0.35, '#9ae0ff'); g.addColorStop(0.7, '#c46aff'); g.addColorStop(1, '#ff7ab8');
    c.globalAlpha *= 0.82; c.fillStyle = g; c.strokeStyle = '#3a1a5a'; c.lineWidth = Math.max(1, tam * 0.04); c.lineJoin = 'round';
    c.beginPath(); c.moveTo(0, 0); c.bezierCurveTo(tam * 0.3, -tam * 1.0, tam * 1.15, -tam * 0.95, tam * 0.98, -tam * 0.25); c.bezierCurveTo(tam * 0.88, 0, tam * 0.3, 0.02 * tam, 0, 0); c.fill(); c.stroke();
    c.beginPath(); c.moveTo(0, 0); c.bezierCurveTo(tam * 0.55, tam * 0.08, tam * 0.85, tam * 0.6, tam * 0.48, tam * 0.78); c.bezierCurveTo(tam * 0.25, tam * 0.85, tam * 0.05, tam * 0.4, 0, 0); c.fill(); c.stroke();
    c.fillStyle = '#ffffff';
    c.beginPath(); c.arc(tam * 0.72, -tam * 0.55, tam * 0.1, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.arc(tam * 0.4, tam * 0.45, tam * 0.07, 0, Math.PI * 2); c.fill();
    c.restore();
  }
}

/** Dónde caen las trampas de suelo (Púas Tóxicas, Red Viscosa): a los pies del rival, o delante si no hay. */
function destinoSuelo(k: Kit): Vec {
  if (k.hayObjetivo) return k.target.feet;
  return { x: k.user.feet.x + k.dir.x * k.user.size * 2.4, y: k.user.feet.y + k.dir.y * k.user.size * 2.4 };
}
/** Punto de un arco (parábola hacia arriba de la pantalla) a lo largo del camino. */
function enArco(k: Kit, u: number, lado: number, alto: number): Vec {
  const p = k.punto(u, lado * Math.sin(Math.PI * u));
  return { x: p.x, y: p.y - alto * Math.sin(Math.PI * u) };
}
/** Ángulo de la tangente de un camino `f` en u. */
function rumbo(f: (u: number) => Vec, u: number): number {
  const a = f(Math.max(0, u - 0.02)), b = f(Math.min(1, u + 0.02));
  return Math.atan2(b.y - a.y, b.x - a.x);
}
/** Degradado de veneno para rellenar formas (coordenadas unidad). */
const rellenoVeneno = (c: CanvasRenderingContext2D) => {
  const g = c.createLinearGradient(-1, 0, 1, 0);
  g.addColorStop(0, '#45106a'); g.addColorStop(0.5, '#a64ce0'); g.addColorStop(1, '#f0d0ff');
  return g;
};
/** Aguijón de avispa: bandas negras y amarillas y punta metálica. */
const rellenoAvispa = (c: CanvasRenderingContext2D) => {
  const g = c.createLinearGradient(-1, 0, 1, 0);
  for (const [o, col] of [[0, '#2a1a06'], [0.2, '#2a1a06'], [0.2, '#ffcf2a'], [0.38, '#ffcf2a'], [0.38, '#2a1a06'], [0.54, '#2a1a06'], [0.54, '#ffcf2a'], [0.7, '#ffcf2a'], [0.7, '#c8ccd4'], [1, '#ffffff']] as const) g.addColorStop(o, col);
  return g;
};
/** Madera para el mazo (Mazazo). */
const rellenoMadera = (c: CanvasRenderingContext2D) => {
  const g = c.createLinearGradient(0, -1, 0, 1);
  g.addColorStop(0, '#e0a868'); g.addColorStop(0.5, '#a8692c'); g.addColorStop(1, '#6a3a12');
  return g;
};
/** Si conviene voltear una forma con "arriba" (cuerno, pie, mazo) para que no quede boca abajo hacia la izquierda. */
const volteo = (k: Kit): boolean => Math.cos(k.angle) < 0;

export const FIRMAS: Record<string, Firma> = {
  // =============================================================================================================
  // PLANTA
  // =============================================================================================================

  // Látigo Cepa (45): dos lianas con hojitas salen del usuario, se abren a los lados y restallan cruzadas sobre el
  // objetivo, dejándole dos marcas verdes en X.
  async vinewhip(k) {
    await k.anticipar(70);
    void k.recuperar({ x: -k.dir.x * 6, y: -k.dir.y * 6 }, 220);
    const ms = 520, g = k.s(0.06);
    latigo(k, ms, { lado: k.dist * 0.45, grosor: g, alTope: p => chasquido(k, p, 0.7) });
    latigo(k, ms, { lado: -k.dist * 0.45, grosor: g, delay: 70, alTope: p => chasquido(k, p, 0.7) });
    await k.esperar(ms * 0.5 + 40);
    await k.impacto(t => {
      k.add(E.slash({ at: t.center, radius: t.size * 0.38, angle: k.angle + Math.PI / 2 + 0.7, sweep: 1.3, width: 4, palette: PLANTA, duration: 220 }));
      k.add(E.slash({ at: t.center, radius: t.size * 0.38, angle: k.angle - Math.PI / 2 - 0.7, sweep: 1.3, width: 4, palette: PLANTA, duration: 220, delay: 60 }));
      hojas(k, t.center, 5, k.s(0.07), 150);
    });
    await k.despues();
  },

  // Latigazo (120): carga épica; una liana enorme, gruesa y llena de hojas barre en un gran arco y restalla sobre el
  // objetivo: destello verde, onda en el suelo, grietas y una lluvia de hojas.
  async powerwhip(k) {
    await k.cargaEpica();
    void k.animar(k.user.sprite, [
      { transform: 'rotate(0deg) scale(1, 1)' },
      { transform: `rotate(${volteo(k) ? 14 : -14}deg) scale(1.08, 0.94)`, offset: 0.4 },
      { transform: `rotate(${volteo(k) ? -10 : 10}deg) scale(1.05, 0.95)`, offset: 0.65 },
      { transform: 'rotate(0deg) scale(1, 1)' },
    ], 760);
    const ms = 760;
    latigo(k, ms, {
      lado: k.dist * 0.95, grosor: k.s(0.16), hojas: 6,
      alTope: p => { chasquido(k, p, 1.7); k.add(E.flash({ color: PLANTA.glow, alpha: 0.3, duration: 220 })); },
    });
    await k.esperar(ms * 0.5);
    await k.impacto(t => {
      k.add(E.ring({ at: t.center, from: 10, to: t.size * 1.6, width: 7, color: PLANTA.glow, duration: 380 }));
      k.add(E.ring({ at: t.feet, from: 10, to: t.size * 1.9, width: 4, color: PLANTA.core, duration: 480, squash: 0.4 }));
      k.add(E.cracks({ at: t.feet, length: t.size * 1.1, color: '#3a2a14', duration: 700 }));
      hojas(k, t.center, 22, k.s(0.12), 340);
      void k.agitar(t.sprite, 6, 320);
    });
    await k.esperar(220);
    await k.despues();
  },

  // Absorber (20): un hilillo de luz verde une a los dos y sorbe un poco: el anillo se encoge sobre el objetivo y
  // unas motas salen de él. Sutil (las bolitas de vida las pone k.despues()).
  async absorb(k) {
    const ms = 400;
    k.dibujar(ms, (c, t, engine) => {
      const a = k.punto(0.95), b = k.punto(0.2), m = k.punto(0.55, k.s(0.15) * Math.sin(t * 9));
      c.globalCompositeOperation = engine.blend;
      c.globalAlpha = 0.6 * Math.sin(Math.PI * t);
      c.setLineDash([5, 7]); c.lineDashOffset = -t * 80;
      trazo(c, curva(a, m, b, 14), 2, VIDA.glow);
      c.setLineDash([]);
      if (Math.random() < 0.4) {
        const p = k.enCuerpo(k.target, 0.35), cc = k.target.center;
        k.emit({ x: p.x, y: p.y, vx: (cc.x - p.x) * 3, vy: (cc.y - p.y) * 3, life: 260, size: rand(2, 3.5), sizeEnd: 0.5, color: VIDA.core, shape: 'glow' });
      }
    }, { z: 1 });
    k.add(E.ring({ at: k.target.center, from: k.s(0.55), to: 4, width: 2, color: VIDA.glow, duration: 300 }));
    await k.esperar(250);
    await k.impacto(t => E.sparks(k.fx, t.center, { count: 6, speed: [40, 110], palette: VIDA, shape: 'glow', size: [1.5, 3] }));
    await k.despues();
  },

  // Megaagotar (40): tres zarcillos finos salen del usuario, se agarran al objetivo y bombean pulsos de luz verde
  // hacia el usuario.
  async megadrain(k) {
    await k.cargar(100);
    const ms = 600;
    for (const lado of [-1, 0, 1]) {
      k.dibujar(ms, (c, t, engine) => {
        const crece = easeOutCubic(Math.min(1, t / 0.35)), fuera = t > 0.8 ? (1 - t) / 0.2 : 1;
        const a = k.punto(0.18), b = k.punto(0.9, lado * k.s(0.14)), m = k.punto(0.55, lado * k.dist * 0.28 + k.s(0.06) * Math.sin(t * 12 + lado));
        const pts = curva(a, m, b, 18, crece);
        c.globalAlpha = fuera;
        trazo(c, pts, 3.4, PLANTA.dark); trazo(c, pts, 1.8, PLANTA.core);
        if (crece >= 1) for (let j = 0; j < 2; j++) {
          const u = 1 - ((t * 2.4 + j * 0.5 + lado * 0.17 + 3) % 1), p = pts[Math.round(u * (pts.length - 1))];
          luz(c, engine, p, 8, VIDA.glow);
        }
      }, { z: 1, delay: (lado + 1) * 40 });
    }
    await k.esperar(320);
    await k.impacto(t => {
      k.add(E.ring({ at: t.center, from: t.size * 0.7, to: 6, width: 3, color: VIDA.core, duration: 300 }));
      E.sparks(k.fx, t.center, { count: 8, speed: [60, 140], palette: VIDA, shape: 'glow', size: [2, 3.5] });
    });
    await k.esperar(120);
    await k.despues();
  },

  // Gigadrenado (75): un remolino verde gira sobre el objetivo y le arranca la energía, que vuela hacia el usuario
  // en dos hebras trenzadas de luz.
  async gigadrain(k) {
    await k.cargar(120);
    const ms = 680, c0 = k.target.center;
    k.dibujar(ms, (c, t, engine) => {
      const ap = Math.min(1, t / 0.25), fuera = t > 0.8 ? (1 - t) / 0.2 : 1;
      c.globalAlpha = ap * fuera;
      luz(c, engine, c0, k.s(0.85), VIDA.core, 0.5);
      forma(c, 'espiral', c0.x, c0.y, k.s(0.8) * (1.1 - 0.3 * t), -t * 16, { base: VIDA.core, borde: VIDA.core, grosor: 5, brillo: VIDA.glow, brilloTam: 10, mezcla: engine.blend });
      forma(c, 'espiral', c0.x, c0.y, k.s(0.55), -t * 16 + Math.PI, { base: '#ffffff', borde: '#e8ffe8', grosor: 2, mezcla: engine.blend });
      if (t > 0.2) {
        const hasta = Math.min(1, (t - 0.2) / 0.3), u0 = k.posSprite(k.user);
        for (const s of [-1, 1]) {
          const pts: Vec[] = [];
          for (let i = 0; i <= 24; i++) {
            const u = (i / 24) * hasta, w = Math.sin(u * Math.PI * 3 + t * 22 + (s > 0 ? Math.PI : 0)) * k.s(0.13) * Math.sin(Math.PI * u);
            pts.push({ x: lerp(c0.x, u0.x, u) + k.perp.x * w, y: lerp(c0.y, u0.y, u) + k.perp.y * w });
          }
          c.globalCompositeOperation = engine.blend;
          trazo(c, pts, 4, VIDA.core); trazo(c, pts, 1.6, '#ffffff');
        }
        luz(c, engine, u0, k.user.size * 0.6, VIDA.glow, 0.5 * hasta);
      }
      if (Math.random() < 0.6) {
        const a = rand(0, Math.PI * 2), p = k.alrededor(c0, k.s(0.75), a, 0.8);
        k.emit({ x: p.x, y: p.y, vx: (c0.x - p.x) * 4 - Math.sin(a) * 120, vy: (c0.y - p.y) * 4 + Math.cos(a) * 60, drag: 2, life: 280, size: rand(2.5, 4.5), sizeEnd: 0.5, color: pick([VIDA.core, VIDA.glow]), shape: 'glow' });
      }
    }, { z: 1 });
    await k.esperar(380);
    await k.impacto(t => {
      k.add(E.bloom({ at: t.center, radius: t.size * 0.8, color: VIDA.core, duration: 300 }));
      k.add(E.ring({ at: t.center, from: t.size * 0.9, to: 6, width: 4, color: VIDA.glow, duration: 320 }));
    });
    await k.esperar(160);
    await k.despues();
  },

  // Drenadoras (estado): una semilla vuela en parábola, cae sobre el objetivo, se abre y le brotan lianas que lo
  // enredan, con un brote en la cabeza.
  async leechseed(k) {
    await k.anticipar(60);
    void k.recuperar({ x: -k.dir.x * 6, y: -k.dir.y * 6 }, 200);
    await k.proyectil(340, (p, t, c) => {
      const suelo = k.punto(t);
      c.fillStyle = 'rgba(20,30,10,0.25)'; c.beginPath(); c.ellipse(suelo.x, suelo.y + k.s(0.25), k.s(0.08), k.s(0.03), 0, 0, Math.PI * 2); c.fill();
      semilla(c, p.x, p.y, k.s(0.1), t * 14);
    }, { arco: k.s(0.9) });
    const c0 = k.target.center, cab = k.target.top;
    k.add(E.vines({ at: c0, radius: k.s(0.55), palette: PLANTA, duration: 760, count: 6 }));
    k.dibujar(760, (c, t) => {
      c.globalAlpha = t > 0.75 ? (1 - t) / 0.25 : 1;
      brote(c, cab.x, cab.y + k.s(0.08), k.s(0.3) * easeOutCubic(Math.min(1, t * 2.5)));
    }, { z: 1 });
    k.burst(6, () => ({ x: c0.x, y: c0.y, vx: rand(-120, 120), vy: rand(-140, -40), ay: 500, life: 420, size: rand(2, 3.5), color: pick(['#a8692c', '#5e3510']), shape: 'shard', spin: rand(-10, 10) }));
    hojas(k, c0, 6, k.s(0.07), 90);
    await k.esperar(300);
    await k.estado();
  },

  // Semilladora (25, multigolpe): una ráfaga de seis semillas en fila, rápidas, cada una con su chasquido al dar; el
  // usuario retrocede un poco con cada disparo.
  async bulletseed(k) {
    const n = 6, cada = 55, vuelo = 170;
    const f: Keyframe[] = [];
    for (let i = 0; i < n; i++) { f.push({ transform: 'translate(0px, 0px)' }, { transform: `translate(${-k.dir.x * 4}px, ${-k.dir.y * 4}px) scale(1.04, 0.96)` }); }
    f.push({ transform: 'translate(0px, 0px)' });
    void k.animar(k.user.sprite, f, n * cada + 40, 'linear');
    for (let i = 0; i < n; i++) {
      const lado = rand(-1, 1) * k.s(0.14);
      let dio = false;
      k.dibujar(vuelo, (c, t) => {
        const p = k.punto(0.18 + 0.74 * t, lado * t), cola = { x: p.x - k.dir.x * k.s(0.3), y: p.y - k.dir.y * k.s(0.3) };
        trazo(c, [cola, p], 2, 'rgba(240,208,138,0.45)');
        semilla(c, p.x, p.y, k.s(0.065), k.angle, false);
        if (!dio && t > 0.86) {
          dio = true;
          k.add(E.ring({ at: p, from: 2, to: k.s(0.18), width: 2, color: '#f0d08a', duration: 160 }));
          k.burst(4, () => ({ x: p.x, y: p.y, vx: rand(-90, 90), vy: rand(-110, 10), ay: 400, life: 260, size: rand(1.5, 2.5), color: pick(['#a8692c', '#e8c27a']), shape: 'dot' }));
        }
      }, { z: 1, delay: i * cada });
    }
    await k.esperar(vuelo);
    await k.impacto(t => E.sparks(k.fx, t.center, { count: 5, speed: [60, 140], palette: PLANTA, shape: 'dot' }));
    await k.esperar(Math.max(0, (n - 1) * cada - 120));
    await k.despues();
  },

  // Bomba Germen (80): una semilla gorda vuela girando en un arco alto (con su sombra en el suelo) y estalla al caer:
  // cáscara rota, tierra y hojas.
  async seedbomb(k) {
    await k.anticipar(80);
    void k.recuperar({ x: -k.dir.x * 8, y: -k.dir.y * 8 }, 220);
    await k.proyectil(380, (p, t, c) => {
      const suelo = k.punto(t);
      c.fillStyle = 'rgba(20,30,10,0.25)'; c.beginPath(); c.ellipse(suelo.x, suelo.y + k.s(0.3), k.s(0.16), k.s(0.06), 0, 0, Math.PI * 2); c.fill();
      semilla(c, p.x, p.y, k.s(0.2), t * 10);
    }, { arco: k.s(1.1) });
    await k.impacto(t => {
      k.add(E.bloom({ at: t.center, radius: t.size * 0.9, color: '#ffe08a', duration: 280 }));
      k.add(E.ring({ at: t.center, from: 8, to: t.size * 1.1, width: 5, color: PLANTA.glow, duration: 320 }));
      k.burst(12, () => { const a = rand(0, Math.PI * 2), v = rand(150, 320); return { x: t.center.x, y: t.center.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 120, ay: 600, life: rand(400, 600), size: rand(3, 5.5), color: pick(['#a8692c', '#5e3510', '#d8a060']), shape: 'shard', spin: rand(-12, 12) }; });
      hojas(k, t.center, 12, k.s(0.1), 260);
      E.dust(k.stage, t.feet, t.size);
    });
    await k.despues();
  },

  // Abatidoras (estado): una semillita flota hasta la cabeza del objetivo, se planta y brota; encima le aparece un
  // garabato gris de preocupación que da vueltas y una gota de sudor (ya no podrá dormir).
  async worryseed(k) {
    await k.anticipar(60);
    void k.recuperar({ x: -k.dir.x * 5, y: -k.dir.y * 5 }, 200);
    await k.proyectil(320, (p, t, c) => semilla(c, p.x, p.y, k.s(0.08), Math.sin(t * 12) * 0.6), { arco: k.s(0.5), lado: k.s(0.3) });
    const cab = k.target.top;
    k.dibujar(760, (c, t) => {
      c.globalAlpha = t > 0.8 ? (1 - t) / 0.2 : 1;
      brote(c, cab.x, cab.y + k.s(0.05), k.s(0.22) * easeOutCubic(Math.min(1, t * 3)));
      const e = Math.min(1, Math.max(0, (t - 0.15) * 4));
      forma(c, 'espiral', cab.x + k.s(0.32), cab.y - k.s(0.3), k.s(0.17) * e, t * 14, { base: '#9a9aa8', borde: '#4a4a5a', grosor: 2.2 });
      if (t > 0.3) forma(c, 'gota', cab.x - k.s(0.3), cab.y - k.s(0.05) + (t - 0.3) * k.s(0.3), k.s(0.07), Math.PI / 2, { base: '#9ad4ff', borde: '#2a5a8a', grosor: 1 });
    }, { z: 1 });
    await k.esperar(320);
    await k.estado();
  },

  // Hoja Afilada (55): cinco hojas afiladas giran como cuchillas en arcos alternos y cortan al objetivo una tras otra.
  async razorleaf(k) {
    await k.anticipar(70);
    void k.recuperar({ x: -k.dir.x * 6, y: -k.dir.y * 6 }, 220);
    const n = 5, vuelo = 300, cada = 55;
    for (let i = 0; i < n; i++) {
      const lado = (i % 2 ? 1 : -1) * k.s(0.55) * rand(0.6, 1);
      let corto = false;
      k.dibujar(vuelo, (c, t) => {
        const p = k.punto(0.15 + 0.82 * t, lado * Math.sin(Math.PI * t)), giro = t * 32 + i;
        c.globalAlpha = 0.35;
        forma(c, 'hoja', p.x, p.y, k.s(0.14), giro - 0.5, { base: '#c8f59a', borde: '#c8f59a', grosor: 1 });
        c.globalAlpha = 1;
        forma(c, 'hoja', p.x, p.y, k.s(0.14), giro, { base: '#5cc23e', claro: '#c8f59a', borde: '#1d5c17', grosor: 1.4 });
        if (!corto && t > 0.86) {
          corto = true;
          k.add(E.slash({ at: p, radius: k.s(0.3), angle: k.angle + Math.PI / 2 + rand(-0.8, 0.8), sweep: 1.6, width: 3, palette: PLANTA, duration: 180 }));
        }
      }, { z: 1, delay: i * cada });
    }
    await k.esperar(vuelo);
    await k.impacto(t => E.sparks(k.fx, t.center, { count: 8, speed: [100, 220], palette: PLANTA, shape: 'streak' }));
    await k.esperar(Math.max(0, (n - 1) * cada - 100));
    await k.despues();
  },

  // Hoja Mágica (60): hojas brillantes de colores que cambian salen hacia los lados y vuelven en curvas amplias,
  // persiguiendo al objetivo y dejando estrellitas.
  async magicalleaf(k) {
    await k.cargar(100);
    const n = 6, vuelo = 440, tonos = ['#7cf0a0', '#ffe46a', '#ff9ad8', '#9ae0ff'];
    for (let i = 0; i < n; i++) {
      const lado = (i % 2 ? 1 : -1) * k.dist * (0.55 + 0.22 * Math.floor(i / 2)), atras = rand(-0.15, 0.2), tono = tonos[i % tonos.length];
      const camino = (u: number) => bez(k.punto(0.1), k.punto(atras, lado), k.punto(1), u);
      k.dibujar(vuelo, (c, t, engine) => {
        const u = easeInOut(t), p = camino(u);
        luz(c, engine, p, k.s(0.32), tono, 0.85);
        forma(c, 'hoja', p.x, p.y, k.s(0.13), rumbo(camino, u), { base: tono, claro: '#ffffff', borde: '#1d5c17', grosor: 1.2 });
        if (Math.random() < 0.45) k.emit({ x: p.x, y: p.y, vx: rand(-25, 25), vy: rand(-25, 25), life: 380, size: rand(2.5, 4.5), color: tono, shape: 'star', spin: rand(-6, 6) });
      }, { z: 1, delay: i * 40 });
    }
    await k.esperar(vuelo + 40);
    await k.impacto(t => {
      k.add(E.starburst({ at: t.center, rays: 9, length: t.size * 0.7, width: 3, palette: { core: '#ff9ad8', glow: '#ffe46a', hot: '#ffffff', dark: '#1d5c17' }, duration: 260 }));
      k.burst(10, () => { const a = rand(0, Math.PI * 2), v = rand(80, 200); return { x: t.center.x, y: t.center.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, drag: 2, life: 460, size: rand(3, 5), color: pick(tonos), shape: 'star', spin: rand(-6, 6) }; });
    });
    await k.esperar(140);
    await k.despues();
  },

  // Lluevehojas (130): carga épica y una tormenta de hojas que llena la vista: un río ancho de hojas grandes y
  // pequeñas barre hacia el objetivo y lo envuelve en un remolino; destello verde y sacudida.
  async leafstorm(k) {
    await k.cargaEpica();
    k.add(E.dim({ at: k.target.center, duration: 1000, strength: 0.35 }));
    void k.animar(k.user.sprite, [{ transform: 'scale(1, 1)' }, { transform: 'scale(1.1, 0.92)', offset: 0.2 }, { transform: 'scale(1.06, 0.96)', offset: 0.8 }, { transform: 'scale(1, 1)' }], 760);
    const ms = 760, tonosH = ['#58c43a', '#8ad84a', '#3e9a2a', '#c8e85a'];
    const grandes = Array.from({ length: 14 }, (_, i) => ({ fase: i / 14, lado: rand(-1, 1), giro: rand(8, 16) * (i % 2 ? 1 : -1), tam: rand(0.12, 0.24), tono: pick(tonosH), orb: rand(0.45, 0.85) }));
    k.dibujar(ms, (c, t) => {
      const fuera = t > 0.85 ? (1 - t) / 0.15 : 1;
      c.globalAlpha = fuera;
      for (const h of grandes) {
        const u = t * 2.2 - h.fase * 0.9;
        if (u < 0) continue;
        let p: Vec;
        if (u <= 1) p = k.punto(u, h.lado * k.s(0.7) * Math.sin(Math.PI * u) + Math.sin(u * 10 + h.fase * 6) * k.s(0.12));
        else p = k.alrededor(k.target.center, k.s(h.orb), (u - 1) * 9 + h.fase * Math.PI * 2, 0.6);
        forma(c, 'hoja', p.x, p.y, k.s(h.tam), t * h.giro + h.fase * 6, { base: h.tono, borde: '#173f10', grosor: 1.3 });
      }
      for (let i = 0; i < 3; i++) {
        const p = k.punto(rand(0, 0.55), rand(-1, 1) * k.s(0.7)), v = k.haciaV(rand(500, 820), rand(-80, 80));
        k.emit({ x: p.x, y: p.y, vx: v.x, vy: v.y, life: rand(320, 520), size: rand(4, 8), color: pick(tonosH), accent: '#1d5c17', shape: 'leaf', rot: rand(0, 6), spin: rand(-14, 14) });
      }
      if (Math.random() < 0.6) { const p = k.punto(rand(0, 0.6), rand(-1, 1) * k.s(0.6)), v = k.haciaV(rand(700, 1000)); k.emit({ x: p.x, y: p.y, vx: v.x, vy: v.y, life: 220, size: 1.6, color: '#f0ffd8', alpha: 0.7, shape: 'streak', stretch: 40 }); }
    }, { z: 1 });
    await k.esperar(400);
    await k.impacto(t => {
      k.add(E.flash({ color: PLANTA.glow, alpha: 0.28, duration: 240 }));
      E.whirl(k.stage, t, PLANTA.glow);
      hojas(k, t.center, 24, k.s(0.12), 380, tonosH);
      void k.agitar(t.sprite, 7, 400);
    });
    await k.esperar(260);
    await k.despues();
  },

  // Tormenta Floral (90): un vendaval de pétalos rosas y blancos gira alrededor del usuario y se abre en espiral
  // hacia fuera hasta barrer al objetivo, con rachas de viento.
  async petalblizzard(k) {
    await k.cargar(100);
    const ms = 760, S = k.user.size, R = k.dist + k.s(0.35);
    const petalos = Array.from({ length: 34 }, (_, i) => ({ a0: (i / 34) * Math.PI * 2, r0: rand(0, 0.35), v: rand(5, 8), tam: rand(0.05, 0.09), tono: pick(['#ffb8d8', '#ffffff', '#ff8ac0', '#ffd8ea']), giro: rand(-12, 12) }));
    k.dibujar(ms, (c, t) => {
      const u = k.posSprite(k.user), abre = easeIn(Math.min(1, t / 0.75)), al = t > 0.85 ? (1 - t) / 0.15 : Math.min(1, t * 6);
      c.globalAlpha = al * 0.7;
      c.strokeStyle = '#ffffff'; c.lineWidth = 2; c.lineCap = 'round';
      for (let j = 0; j < 3; j++) {
        const r = lerp(S * 0.6, R, abre) * (0.6 + j * 0.2), a = t * 9 + j * 2.1;
        c.beginPath(); c.ellipse(u.x, u.y, r, r * 0.6, 0, a, a + 1.1); c.stroke();
      }
      c.globalAlpha = al;
      for (const p of petalos) {
        const ang = p.a0 + t * p.v, r = lerp(S * (0.5 + p.r0), R * (0.65 + p.r0), abre);
        petalo(c, u.x + Math.cos(ang) * r, u.y + Math.sin(ang) * r * 0.6, k.s(p.tam), ang + t * p.giro, p.tono);
      }
    }, { z: 1 });
    void k.girar(k.user.sprite, 1, 620);
    await k.esperar(ms * 0.6);
    await k.impacto(t => {
      k.add(E.ring({ at: t.center, from: 8, to: t.size * 1.1, width: 4, color: ROSA.glow, duration: 320 }));
      hojas(k, t.center, 16, k.s(0.08), 260, ['#ffb8d8', '#ffffff', '#ff8ac0']);
    });
    await k.esperar(200);
    await k.despues();
  },

  // Danza Pétalo (120): el usuario baila girando mientras flores enteras orbitan a su alrededor; luego se lanza con
  // una estela rosa, las flores vuelan con él y estallan sobre el objetivo en una gran flor y una lluvia de pétalos.
  async petaldance(k) {
    k.add(E.dim({ at: k.user.center, duration: 1000, strength: 0.35 }));
    const baile = 460, vuela = 220, n = 6;
    void k.girar(k.user.sprite, 2, baile);
    k.dibujar(baile + vuela + 80, (c, t) => {
      const ms = t * (baile + vuela + 80), fase = ms / baile;
      for (let i = 0; i < n; i++) {
        let p: Vec;
        const a = (i / n) * Math.PI * 2 + fase * 9;
        if (fase < 1) p = k.alrededor(k.posSprite(k.user), k.user.size * (0.5 + 0.25 * fase), a, 0.6);
        else {
          const u = easeIn(Math.min(1, (ms - baile) / vuela)), p0 = k.alrededor(k.user.center, k.user.size * 0.75, (i / n) * Math.PI * 2 + 9, 0.6);
          const p1 = k.alrededor(k.target.center, k.s(0.3), a * 2, 0.6);
          p = { x: lerp(p0.x, p1.x, u), y: lerp(p0.y, p1.y, u) };
          c.globalAlpha = ms > baile + vuela ? Math.max(0, 1 - (ms - baile - vuela) / 80) : 1;
        }
        flor(c, p.x, p.y, k.s(0.13), ms / 120 + i, i % 2 ? '#ff8ac0' : '#ffc0dc', '#ffe46a');
      }
    }, { z: 1 });
    await k.esperar(baile);
    await k.embestida({ hasta: 0.8, ida: vuela, vuelta: 300, estela: '#ff8ac0' });
    await k.impacto(t => {
      k.add(E.flash({ color: ROSA.glow, alpha: 0.22, duration: 220 }));
      k.dibujar(420, (c, u) => {
        c.globalAlpha = 1 - easeIn(u);
        flor(c, t.center.x, t.center.y, t.size * (0.3 + 0.6 * easeOutCubic(u)), u * 2, '#ff8ac0', '#ffe46a', 6);
      }, { z: 1 });
      hojas(k, t.center, 24, k.s(0.1), 320, ['#ffb8d8', '#ff8ac0', '#ffffff', '#ff5aa0']);
      void k.agitar(t.sprite, 5, 300);
    });
    await k.esperar(220);
    await k.despues();
  },

  // Rayo Solar (120, de carga): un sol se forma sobre el usuario mientras la luz cae del cielo y el resto se
  // oscurece; luego, un rayo dorado enorme con dos hebras de luz en espiral y un destello que lo blanquea todo.
  async solarbeam(k) {
    const carga = 520, S = k.user.size;
    k.add(E.dim({ at: k.user.center, duration: carga + 300, strength: 0.5 }));
    k.add(E.sunbeam({ at: k.user.center, palette: SOL, duration: carga + 150, width: S * 1.6 }));
    const cima = { x: k.user.center.x, y: k.user.top.y - S * 0.35 };
    k.dibujar(carga + 120, (c, t, engine) => {
      const r = S * 0.3 * easeOutCubic(Math.min(1, t * 1.3)), fuera = t > 0.82 ? 1 - ((t - 0.82) / 0.18) * 0.8 : 1;
      sol(c, engine, cima.x, cima.y, r, t * 3, fuera);
      if (Math.random() < 0.7) {
        const a = rand(0, Math.PI * 2), d = S * rand(0.9, 1.5), p = { x: cima.x + Math.cos(a) * d, y: cima.y + Math.sin(a) * d };
        k.emit({ x: p.x, y: p.y, vx: (cima.x - p.x) * 3.2, vy: (cima.y - p.y) * 3.2, life: 300, size: rand(2.5, 4), sizeEnd: 1, color: pick([SOL.glow, SOL.hot]), shape: 'glow' });
      }
    }, { z: 1 });
    void k.animar(k.user.sprite, [{ transform: 'scale(1, 1)' }, { transform: 'scale(1.05, 0.96)', offset: 0.8 }, { transform: 'scale(1, 1)' }], carga);
    await k.esperar(carga);
    k.add(E.flash({ color: '#fff6c8', alpha: 0.42, duration: 240 }));
    const dura = 580, desde = k.punto(0.1);
    k.add(E.beam({ from: desde, to: k.target.center, width: k.s(0.3), palette: SOL, duration: dura }));
    k.dibujar(dura, (c, t, engine) => {
      const alcance = easeOutCubic(Math.min(1, t / 0.25)), al = t > 0.7 ? 1 - (t - 0.7) / 0.3 : 1;
      c.globalCompositeOperation = engine.blend; c.globalAlpha = al;
      for (const s of [0, Math.PI]) {
        const pts: Vec[] = [];
        for (let i = 0; i <= 30; i++) { const u = (i / 30) * alcance, w = Math.sin(u * 14 - t * 30 + s) * k.s(0.32); pts.push(k.punto(0.1 + 0.9 * u, w)); }
        trazo(c, pts, 2.4, '#fffbe0');
      }
      if (Math.random() < 0.6) { const p = k.punto(rand(0.1, alcance), rand(-1, 1) * k.s(0.3)), v = k.haciaV(rand(200, 400)); k.emit({ x: p.x, y: p.y, vx: v.x, vy: v.y, life: 260, size: rand(2, 3.5), color: SOL.hot, shape: 'star', spin: 5 }); }
    }, { z: 1 });
    void k.recuperar({ x: -k.dir.x * 12, y: -k.dir.y * 12 }, 360);
    await k.esperar(dura * 0.3);
    await k.impacto(t => {
      k.add(E.bloom({ at: t.center, radius: t.size * 1.4, color: SOL.glow, duration: 420 }));
      k.add(E.starburst({ at: t.center, rays: 12, length: t.size, width: 4, palette: SOL, duration: 320 }));
      k.add(E.ring({ at: t.center, from: 10, to: t.size * 1.5, width: 5, color: SOL.hot, duration: 380 }));
    });
    await k.esperar(dura * 0.45);
    await k.despues();
  },

  // Fotosíntesis (estado, sobre sí): un sol asoma sobre el usuario y le baña de rayos; hojitas y chispas verdes
  // suben de su cuerpo mientras se recupera.
  async synthesis(k) {
    const ms = 780, S = k.user.size, cima = { x: k.user.center.x, y: k.user.top.y - S * 0.6 };
    k.add(E.sunbeam({ at: k.user.feet, palette: SOL, duration: ms, width: S * 1.3 }));
    k.dibujar(ms, (c, t, engine) => {
      const al = Math.sin(Math.PI * t), r = S * 0.22, y = cima.y - (1 - easeOutCubic(Math.min(1, t * 2))) * S * 0.35;
      sol(c, engine, cima.x, y, r, t * 2, al);
      c.globalCompositeOperation = engine.blend; c.globalAlpha = al * 0.6; c.strokeStyle = SOL.glow; c.lineWidth = 2; c.lineCap = 'round';
      c.beginPath();
      for (let i = 0; i < 5; i++) { const a = Math.PI / 2 + (i - 2) * 0.3; c.moveTo(cima.x + Math.cos(a) * r * 1.5, y + Math.sin(a) * r * 1.5); c.lineTo(cima.x + Math.cos(a) * S * 1.05, y + Math.sin(a) * S * 1.05); }
      c.stroke();
      if (Math.random() < 0.4) {
        const p = k.enCuerpo(k.user, 0.35);
        if (Math.random() < 0.5) k.emit({ x: p.x, y: p.y, vx: rand(-15, 15), vy: -rand(40, 80), life: 520, size: rand(3, 5), color: pick(VERDES), accent: '#1d5c17', shape: 'leaf', rot: rand(0, 6), spin: rand(-4, 4), fadeIn: 0.2 });
        else k.emit({ x: p.x, y: p.y, vy: -rand(40, 90), life: 480, size: rand(2.5, 4), color: pick([VIDA.glow, SOL.glow]), shape: 'star', spin: 4, fadeIn: 0.2 });
      }
    }, { z: 1 });
    void k.animar(k.user.sprite, [{ transform: 'translate(0px, 0px) scale(1, 1)' }, { transform: 'translate(0px, -3px) scale(1.05, 1.05)', offset: 0.5 }, { transform: 'translate(0px, 0px) scale(1, 1)' }], ms);
    await k.esperar(ms * 0.55);
    await k.estado();
  },

  // Campo de Hierba (estado): desde los pies del usuario brota hierba que se extiende por todo el suelo, con flores
  // aquí y allá y un frente de luz verde que la recorre.
  async grassyterrain(k) {
    const ms = 900, c0 = k.user.feet, R = Math.max(k.stage.width, k.stage.height) * 0.6, S = k.user.size;
    const briznas = Array.from({ length: 110 }, () => {
      const a = rand(0, Math.PI * 2), d = Math.sqrt(rand(0.01, 1)) * R;
      return { x: c0.x + Math.cos(a) * d, y: c0.y + Math.sin(a) * d * 0.55, d, alto: rand(0.12, 0.26), inclina: rand(-0.08, 0.08), tono: pick(['#4cb83a', '#6ad04a', '#3a9a2c', '#82dc5a']), flor: Math.random() < 0.12 ? pick(['#ffe46a', '#ff9ad8', '#ffffff']) : '' };
    }).sort((a, b) => a.y - b.y);
    k.dibujar(ms, (c, t, engine) => {
      const frente = R * easeOut(Math.min(1, t / 0.6)), al = t > 0.75 ? 1 - (t - 0.75) / 0.25 : 1;
      c.save(); c.globalCompositeOperation = engine.blend; c.globalAlpha = al * 0.5 * (1 - t); c.strokeStyle = PLANTA.glow; c.lineWidth = 6;
      c.beginPath(); c.ellipse(c0.x, c0.y, Math.max(1, frente), Math.max(1, frente * 0.55), 0, 0, Math.PI * 2); c.stroke(); c.restore();
      c.globalAlpha = al;
      for (const b of briznas) {
        if (b.d > frente) continue;
        const h = S * b.alto * Math.min(1, (frente - b.d) / (R * 0.12));
        brizna(c, b.x, b.y, h, b.inclina * S, b.tono);
        if (b.flor && h > S * 0.1) flor(c, b.x + b.inclina * S, b.y - h, S * 0.06, b.x, b.flor, '#ffb81a', 5, '#7a5a20');
      }
    });
    await k.esperar(ms * 0.55);
    await k.estado();
  },

  // Arraigo (estado, sobre sí): el usuario se asienta y de sus pies salen raíces que se hunden y se ramifican por el
  // suelo; un pulso verde sube por ellas.
  async ingrain(k) {
    const pie = k.user.feet, S = k.user.size, ms = 840;
    const raices: { pts: Vec[]; ini: number; g: number }[] = [];
    for (let i = 0; i < 7; i++) {
      let a = (i / 7) * Math.PI * 2 + rand(-0.3, 0.3), p: Vec = { ...pie };
      const pts = [p];
      for (let s = 0; s < 7; s++) { a += rand(-0.45, 0.45); p = { x: p.x + Math.cos(a) * S * 0.13, y: p.y + Math.sin(a) * S * 0.065 }; pts.push(p); }
      raices.push({ pts, ini: 0, g: 1 });
      if (i % 2 === 0) {
        let b = a + rand(0.6, 1) * pick([-1, 1]), q: Vec = { ...pts[3] };
        const bp = [q];
        for (let s = 0; s < 4; s++) { b += rand(-0.4, 0.4); q = { x: q.x + Math.cos(b) * S * 0.1, y: q.y + Math.sin(b) * S * 0.05 }; bp.push(q); }
        raices.push({ pts: bp, ini: 0.35, g: 0.6 });
      }
    }
    void k.animar(k.user.sprite, [
      { transform: 'translate(0px, 0px) scale(1, 1)' },
      { transform: 'translate(0px, 4px) scale(1.1, 0.88)', offset: 0.3 },
      { transform: 'translate(0px, 2px) scale(1.03, 0.97)', offset: 0.7 },
      { transform: 'translate(0px, 0px) scale(1, 1)' },
    ], 720);
    E.dust(k.stage, pie, S * 0.8);
    k.dibujar(ms, (c, t, engine) => {
      const al = t > 0.8 ? (1 - t) / 0.2 : 1;
      c.globalAlpha = al;
      for (const r of raices) {
        const crece = easeOutCubic(Math.max(0, Math.min(1, (t - r.ini * 0.5) / 0.5)));
        const n = Math.round((r.pts.length - 1) * crece);
        if (n < 1) continue;
        const vis = r.pts.slice(0, n + 1);
        trazoAfilado(c, vis, 5 * r.g, 1.2, '#3a2410');
        trazoAfilado(c, vis, 3 * r.g, 0.7, '#8a5a2a');
        if (crece >= 1) luz(c, engine, vis[Math.min(vis.length - 1, Math.floor(((t * 2.5 + r.ini) % 1) * vis.length))], 7, VIDA.core, 0.8);
      }
    });
    await k.esperar(ms * 0.55);
    await k.estado();
  },

  // Rizo Algodón (estado, sobre sí): copos de algodón giran alrededor del usuario y se le pegan hasta envolverlo en
  // un capullo esponjoso, que lo deja mullido.
  async cottonguard(k) {
    const ms = 840, S = k.user.size;
    const copos = Array.from({ length: 14 }, (_, i) => ({ a: (i / 14) * Math.PI * 2, r0: rand(1.1, 1.5), r1: rand(0.28, 0.48), tam: rand(0.13, 0.2), dy: rand(-0.35, 0.3) }));
    k.dibujar(ms, (c, t) => {
      const u = k.posSprite(k.user), junta = easeInOut(Math.min(1, t / 0.6)), al = t > 0.82 ? (1 - t) / 0.18 : Math.min(1, t * 5);
      c.globalAlpha = al;
      for (const p of copos) {
        const ang = p.a + t * 5 * (1 - junta * 0.8), r = lerp(p.r0, p.r1, junta) * S;
        algodon(c, u.x + Math.cos(ang) * r, u.y + p.dy * S * junta + Math.sin(ang) * r * 0.5, S * p.tam * (1 + 0.3 * junta));
      }
    }, { z: 1 });
    void k.animar(k.user.sprite, [{ transform: 'scale(1, 1)' }, { transform: 'scale(1.12, 1.12)', offset: 0.6 }, { transform: 'scale(0.96, 1.04)', offset: 0.8 }, { transform: 'scale(1, 1)' }], ms);
    await k.esperar(ms * 0.62);
    k.burst(10, () => { const a = rand(0, Math.PI * 2); return { x: k.user.center.x + Math.cos(a) * S * 0.4, y: k.user.center.y + Math.sin(a) * S * 0.3, vx: Math.cos(a) * 60, vy: Math.sin(a) * 30 - 20, drag: 2, life: 500, size: rand(5, 9), sizeEnd: rand(10, 14), color: '#ffffff', alpha: 0.55, shape: 'smoke' }; });
    await k.estado();
  },

  // Somnífero (estado): una nube de polvo azul celeste vuela despacio hasta el objetivo y le cae encima en una
  // llovizna brillante, con dos Z que flotan.
  async sleeppowder(k) {
    await k.anticipar(60);
    void k.recuperar({ x: -k.dir.x * 5, y: -k.dir.y * 5 }, 220);
    const azul = ['#8ab8ff', '#b8d4ff', '#d8e6ff', '#7a9cf0'], vuelo = 380;
    k.dibujar(vuelo, (_c, t) => {
      const p = k.punto(0.15 + 0.8 * easeInOut(t), Math.sin(t * Math.PI) * k.s(0.2));
      for (let i = 0; i < 2; i++) k.emit({ x: p.x + rand(-k.s(0.15), k.s(0.15)), y: p.y + rand(-k.s(0.1), k.s(0.1)), vx: rand(-15, 15), vy: rand(-10, 15), life: 420, size: rand(6, 11), sizeEnd: rand(12, 18), color: pick(azul), alpha: 0.35, shape: 'smoke' });
      if (Math.random() < 0.5) k.emit({ x: p.x + rand(-10, 10), y: p.y + rand(-10, 10), vx: rand(-20, 20), vy: rand(-20, 20), life: 360, size: rand(2, 3.5), color: '#ffffff', shape: 'star', spin: 4 });
    });
    await k.esperar(vuelo);
    const c0 = k.target.center, top = k.target.top;
    k.burst(5, () => ({ x: c0.x + rand(-k.s(0.3), k.s(0.3)), y: top.y - k.s(0.25), vx: rand(-10, 10), vy: rand(-5, 5), life: 700, size: k.s(0.18), sizeEnd: k.s(0.3), color: pick(azul), alpha: 0.3, shape: 'smoke' }));
    k.burst(36, i => ({ x: c0.x + rand(-k.s(0.5), k.s(0.5)), y: top.y - k.s(0.2) - rand(0, k.s(0.25)), vx: rand(-10, 10), vy: rand(40, 90), life: rand(500, 700), delay: i * 8, size: rand(1.5, 3), color: pick([...azul, '#ffffff']), shape: 'dot', fadeIn: 0.2 }));
    k.dibujar(720, (c, t) => {
      c.globalAlpha = Math.sin(Math.PI * t);
      for (let i = 0; i < 2; i++) {
        const u = Math.max(0, t - i * 0.2);
        forma(c, 'z', top.x + k.s(0.25 + i * 0.15) + Math.sin(u * 8) * 4, top.y - k.s(0.1) - u * k.s(0.5), k.s(0.09 - i * 0.02), -0.2, { base: '#b8d4ff', borde: '#2a3a7a', grosor: 1.2 });
      }
    }, { z: 1 });
    await k.esperar(260);
    await k.estado();
  },

  // Paralizador (estado): el usuario se sacude y suelta de golpe una nube de esporas amarillas que cruza rápida;
  // las esporas, bolitas con pinchos, se quedan girando pegadas al objetivo.
  async stunspore(k) {
    void k.agitar(k.user.sprite, 3, 220);
    const amarillo = ['#ffe23a', '#fff07a', '#ffd000', '#f4ff9a'];
    k.burst(24, () => { const p = k.enCuerpo(k.user, 0.3), v = k.haciaV(rand(280, 420), rand(-90, 90)); return { x: p.x, y: p.y, vx: v.x, vy: v.y, drag: 1.4, life: rand(380, 520), delay: rand(0, 120), size: rand(2, 3.6), color: pick(amarillo), shape: 'dot' }; });
    k.burst(6, () => { const p = k.punto(0.2), v = k.haciaV(rand(200, 320), rand(-50, 50)); return { x: p.x, y: p.y, vx: v.x, vy: v.y, drag: 1.5, life: 600, size: k.s(0.12), sizeEnd: k.s(0.3), color: '#e8d040', alpha: 0.3, shape: 'smoke' }; });
    await k.esperar(300);
    const c0 = k.target.center, n = 9;
    const esporas = Array.from({ length: n }, (_, i) => ({ a: (i / n) * Math.PI * 2, r: rand(0.3, 0.5), dy: rand(-0.3, 0.25), v: rand(3, 5) }));
    k.dibujar(560, (c, t) => {
      c.globalAlpha = t > 0.7 ? (1 - t) / 0.3 : Math.min(1, t * 6);
      for (const e of esporas) {
        const p = k.alrededor({ x: c0.x, y: c0.y + k.s(e.dy) }, k.s(e.r) * (1.4 - 0.4 * easeOutCubic(Math.min(1, t * 3))), e.a + t * e.v, 0.6);
        espora(c, p.x, p.y, k.s(0.035), t * 8 + e.a);
      }
    }, { z: 1 });
    await k.esperar(140);
    await k.estado();
  },

  // Patada Tropical (70): un pie dorado describe un arco y patea dejando una estela de flores de hibisco; al golpear
  // estallan frutas tropicales y pétalos.
  async tropkick(k) {
    await k.anticipar(80);
    void k.embestida({ hasta: 0.5, ida: 150, vuelta: 260 });
    const ms = 220, esp = volteo(k), lado = k.s(0.5) * (esp ? -1 : 1);
    const estela: { p: Vec; rot: number; nace: number; col: string }[] = [];
    k.dibujar(ms + 160, (c, t) => {
      const ahora = t * (ms + 160), u = Math.min(1, ahora / ms), fuera = ahora > ms ? 1 - (ahora - ms) / 160 : 1;
      const p = k.punto(0.3 + 0.6 * easeIn(u), -lado * Math.sin(Math.PI * u)), r = k.s(0.3);
      if (u < 1 && Math.random() < 0.45) estela.push({ p: { ...p }, rot: rand(0, 6), nace: ahora, col: pick(['#ff4a6a', '#ff8a3a', '#ffd23a']) });
      for (const e of estela) {
        const vida = (ahora - e.nace) / 320;
        if (vida >= 1) continue;
        c.globalAlpha = 1 - vida;
        flor(c, e.p.x, e.p.y, k.s(0.09) * (1 - 0.3 * vida), e.rot + vida * 2, e.col, '#fff4a0', 5, '#7a1a1a');
      }
      c.globalAlpha = fuera;
      forma(c, 'pie', p.x, p.y, r, k.angle + (1 - u) * (esp ? 0.8 : -0.8), { base: '#ffcf6a', claro: '#ffe8a8', oscuro: '#c86a1a', borde: '#5a2a06', brillo: '#ff9a3a', brilloTam: r * 0.4 }, esp);
    }, { z: 1 });
    await k.esperar(ms);
    await k.impacto(t => {
      k.add(E.bloom({ at: t.center, radius: t.size * 0.8, color: '#ffd86a', duration: 300 }));
      k.add(E.ring({ at: t.center, from: 8, to: t.size, width: 4, color: '#ff8a5a', duration: 300 }));
      const frutas = Array.from({ length: 7 }, () => { const a = rand(0, Math.PI * 2), v = rand(140, 260); return { vx: Math.cos(a) * v, vy: Math.sin(a) * v - 200, col: pick(['#ff7a1a', '#ff3a5a', '#ffd21a', '#8ad83a']), r: k.s(rand(0.05, 0.08)) }; });
      k.dibujar(600, (c, u) => {
        const s = u * 0.6;
        c.globalAlpha = 1 - easeIn(u);
        for (const f of frutas) fruta(c, t.center.x + f.vx * s, t.center.y + f.vy * s + 450 * s * s, f.r, f.col);
      }, { z: 1 });
      hojas(k, t.center, 14, k.s(0.08), 240, ['#ff4a6a', '#ff8a3a', '#ffd23a', '#58c43a']);
    });
    await k.despues();
  },

  // Mazazo (120): carga épica; un mazo de madera enorme (con un par de hojas) se alza sobre el usuario, cae en arco
  // y aplasta al objetivo: astillas, hojas, grietas y el retroceso para el usuario.
  async woodhammer(k) {
    await k.cargaEpica();
    void k.embestida({ hasta: 0.45, ida: 300, vuelta: 320 });
    const alza = 240, cae = 130, resto = 220, esp = volteo(k);
    // Se alza por encima (arriba en pantalla); si el objetivo está justo arriba, se alza de lado para que haya golpe.
    let arriba = -Math.PI / 2, d = Math.atan2(Math.sin(k.angle - arriba), Math.cos(k.angle - arriba));
    if (Math.abs(d) < 0.8) { arriba = k.angle - (esp ? -1.6 : 1.6); d = k.angle - arriba; }
    k.dibujar(alza + cae + resto, (c, t) => {
      const ms = t * (alza + cae + resto), piv = k.posSprite(k.user);
      let phi: number, crece = 1;
      if (ms < alza) { const u = ms / alza; phi = arriba - d * 0.2 * easeOut(u); crece = easeOutCubic(Math.min(1, u * 1.6)); }
      else if (ms < alza + cae) phi = arriba - d * 0.2 + d * 1.2 * easeIn((ms - alza) / cae);
      else phi = k.angle;
      const L = Math.max(k.s(0.6), Math.hypot(k.target.center.x - piv.x, k.target.center.y - piv.y)), tam = Math.min(k.s(1.1), Math.max(k.s(0.5), L / 1.5)) * crece;
      const cabeza = { x: piv.x + Math.cos(phi) * L * 0.95, y: piv.y + Math.sin(phi) * L * 0.95 };
      const centro = { x: cabeza.x - Math.cos(phi) * tam * 0.5, y: cabeza.y - Math.sin(phi) * tam * 0.5 };
      c.globalAlpha = ms > alza + cae + 80 ? Math.max(0, 1 - (ms - alza - cae - 80) / 140) : 1;
      forma(c, 'martillo', centro.x, centro.y, tam, phi, { base: rellenoMadera, oscuro: '#5e3510', borde: '#2a1606', grosor: Math.max(2, tam * 0.05) }, esp);
      forma(c, 'hoja', cabeza.x - Math.cos(phi) * tam * 0.1 + Math.cos(phi - Math.PI / 2) * tam * 0.6, cabeza.y - Math.sin(phi) * tam * 0.1 + Math.sin(phi - Math.PI / 2) * tam * 0.6, tam * 0.16, phi - 2.2, { base: '#58c43a', borde: '#173f10', grosor: 1.2 });
    }, { z: 1 });
    await k.esperar(alza + cae);
    await k.impacto(t => {
      k.add(E.flash({ color: '#ffe0a0', alpha: 0.3, duration: 220 }));
      k.add(E.ring({ at: t.center, from: 10, to: t.size * 1.5, width: 6, color: '#ffd08a', duration: 360 }));
      k.add(E.ring({ at: t.feet, from: 10, to: t.size * 2, width: 4, color: '#a8692c', duration: 480, squash: 0.4 }));
      k.add(E.cracks({ at: t.feet, length: t.size * 1.2, color: '#3a2a14', duration: 760 }));
      k.burst(16, () => { const a = rand(0, Math.PI * 2), v = rand(160, 360); return { x: t.center.x, y: t.center.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 140, ay: 700, life: rand(420, 640), size: rand(3, 6), color: pick(['#a8692c', '#e0a868', '#6a3a12']), shape: 'shard', spin: rand(-14, 14) }; });
      hojas(k, t.center, 12, k.s(0.1), 280);
      E.dust(k.stage, t.feet, t.size);
      void k.agitar(t.sprite, 8, 360);
    });
    await k.esperar(200);
    await k.despues();
  },

  // Hierba Lazo (potencia según peso): bajo los pies del objetivo brotan dos matas de hierba que se anudan en un
  // lazo alrededor de sus pies y lo hacen tropezar.
  async grassknot(k) {
    await k.cargar(80);
    const pie = k.target.feet, S = k.target.size, ms = 640;
    k.dibujar(ms, (c, t) => {
      const crece = easeOutCubic(Math.min(1, t / 0.3)), anuda = Math.max(0, Math.min(1, (t - 0.22) / 0.3)), al = t > 0.85 ? (1 - t) / 0.15 : 1;
      c.globalAlpha = al;
      for (const s of [-1, 1]) for (let j = 0; j < 4; j++) brizna(c, pie.x + s * S * (0.28 + j * 0.06), pie.y + (j % 2) * 3, S * 0.32 * crece * (1 - 0.15 * j), -s * S * 0.14 * anuda, j % 2 ? '#4cb83a' : '#6ad04a');
      if (anuda > 0) {
        const a0 = Math.PI * 0.5, cy = pie.y - S * 0.06;
        for (const [col, w] of [['#173f10', 6], ['#4cb83a', 3.5], ['#a6e874', 1.2]] as const) {
          c.strokeStyle = col; c.lineWidth = w; c.lineCap = 'round';
          c.beginPath(); c.ellipse(pie.x, cy, S * 0.3, S * 0.11, 0, a0, a0 + Math.PI * 2 * anuda); c.stroke();
        }
        if (anuda >= 1) {
          const lazo = easeOutCubic(Math.min(1, (t - 0.52) / 0.12));
          for (const s of [-1, 1]) {
            c.strokeStyle = '#173f10'; c.fillStyle = '#58c43a'; c.lineWidth = 1.5;
            c.beginPath(); c.ellipse(pie.x + s * S * 0.08 * lazo, cy + S * 0.11, S * 0.08 * lazo, S * 0.045 * lazo, s * 0.4, 0, Math.PI * 2); c.fill(); c.stroke();
          }
        }
      }
    });
    await k.esperar(ms * 0.55);
    await k.impacto(t => {
      void k.animar(t.sprite, [{ transform: 'rotate(0deg)' }, { transform: 'rotate(-18deg) translate(0px, 5px)', offset: 0.35 }, { transform: 'rotate(6deg)', offset: 0.7 }, { transform: 'rotate(0deg)' }], 440);
      E.dust(k.stage, t.feet, t.size * 0.8);
      hojas(k, t.feet, 6, k.s(0.07), 120);
    });
    await k.despues();
  },

  // =============================================================================================================
  // BICHO
  // =============================================================================================================

  // Chupavidas (80): una trompa de mosquito se clava en el objetivo y bombea: latidos rojos suben por ella hacia
  // el usuario y el objetivo palpita.
  async leechlife(k) {
    await k.anticipar(80);
    void k.embestida({ hasta: 0.45, ida: 130, vuelta: 320 });
    const largo = k.s(0.5), ms = 640, entraMs = 140;
    k.dibujar(ms, (c, t, engine) => {
      const ahora = t * ms, entra = easeOutCubic(Math.min(1, ahora / entraMs)), fuera = t > 0.82 ? (1 - t) / 0.18 : 1;
      const punta = k.punto(lerp(0.4, 0.88, entra)), centro = { x: punta.x - k.dir.x * largo, y: punta.y - k.dir.y * largo };
      c.globalAlpha = fuera;
      forma(c, 'aguja', centro.x, centro.y, largo, k.angle, { base: '#8a5a2a', oscuro: '#3a1e08', borde: '#1e1004', grosor: 1.5 });
      if (entra >= 1) {
        for (let j = 0; j < 2; j++) {
          const u = (ahora / 260 + j * 0.5) % 1, p = { x: lerp(punta.x, centro.x - k.dir.x * largo, u), y: lerp(punta.y, centro.y - k.dir.y * largo, u) };
          luz(c, engine, p, k.s(0.09) * (1 - 0.4 * u), '#ff3a50', 0.9);
          c.fillStyle = '#d81a3a'; c.beginPath(); c.arc(p.x, p.y, k.s(0.035) * (1 - 0.4 * u), 0, Math.PI * 2); c.fill();
        }
      }
    }, { z: 1 });
    await k.esperar(entraMs);
    await k.impacto(t => {
      k.add(E.ring({ at: t.center, from: t.size * 0.6, to: 6, width: 3, color: '#ff5a6a', duration: 260 }));
      k.add(E.ring({ at: t.center, from: t.size * 0.6, to: 6, width: 3, color: '#ff5a6a', duration: 260, delay: 220 }));
      void k.animar(t.sprite, [{ transform: 'scale(1, 1)' }, { transform: 'scale(0.94, 0.94)', offset: 0.25 }, { transform: 'scale(1, 1)', offset: 0.5 }, { transform: 'scale(0.94, 0.94)', offset: 0.75 }, { transform: 'scale(1, 1)' }], 460);
      k.burst(6, () => ({ x: t.center.x + rand(-8, 8), y: t.center.y + rand(-8, 8), vx: rand(-60, 60), vy: rand(-100, -30), ay: 400, life: 360, size: rand(2, 3), color: '#ff3a50', shape: 'drop', stretch: 14 }));
    });
    await k.esperar(220);
    await k.despues();
  },

  // Picadura (60): unas pinzas de insecto se abren sobre el objetivo y muerden dos veces seguidas (ñam-ñam),
  // arrancando trocitos.
  async bugbite(k) {
    await k.anticipar(70);
    void k.embestida({ hasta: 0.4, ida: 120, vuelta: 280 });
    const tam = k.s(0.45), ms = 470, c0 = { x: k.target.center.x - k.dir.x * tam * 0.15, y: k.target.center.y - k.dir.y * tam * 0.15 };
    const trozos = (p: Vec) => k.burst(5, () => ({ x: p.x, y: p.y, vx: rand(-120, 120), vy: rand(-160, -20), ay: 600, life: 380, size: rand(2, 3.5), color: pick([BICHO.glow, '#ffffff', BICHO.core]), shape: 'shard', spin: rand(-12, 12) }));
    let mordidas = 0;
    k.dibujar(ms, (c, t) => {
      const a = t * ms;
      const ap = a < 100 ? a / 100 : a < 160 ? 1 - easeIn((a - 100) / 60) : a < 230 ? ((a - 160) / 70) * 0.7 : a < 280 ? 0.7 * (1 - easeIn((a - 230) / 50)) : 0;
      if (mordidas === 0 && a >= 160) { mordidas = 1; trozos(k.target.center); }
      if (mordidas === 1 && a >= 280) { mordidas = 2; trozos(k.target.center); void k.agitar(k.target.sprite, 3, 160); }
      c.globalAlpha = Math.min(1, a / 50) * (a > 360 ? 1 - (a - 360) / 110 : 1);
      pinzas(c, c0.x, c0.y, tam, ap, k.angle);
    }, { z: 1 });
    await k.esperar(160);
    await k.impacto(t => E.sparks(k.fx, t.center, { count: 8, speed: [100, 220], palette: BICHO, shape: 'shard', size: [2, 4] }));
    await k.esperar(140);
    await k.despues();
  },

  // Zumbido (90): el usuario vibra con las alas difuminadas y suelta ondas de zumbido en zigzag, verdes y amarillas,
  // que sacuden al objetivo.
  async bugbuzz(k) {
    await k.cargar(100);
    void k.agitar(k.user.sprite, 3, 620);
    const ms = 660, S = k.user.size;
    k.dibujar(ms, (c, t, engine) => {
      const u = k.posSprite(k.user), bate = Math.sin(engine.now / 12);
      c.globalAlpha = 0.5 * Math.sin(Math.PI * t);
      c.fillStyle = 'rgba(230,255,200,0.7)';
      for (const s of [-1, 1]) { c.beginPath(); c.ellipse(u.x + s * S * 0.38, u.y - S * 0.25, S * 0.36, S * (0.14 + 0.08 * bate), s * 0.6, 0, Math.PI * 2); c.fill(); }
    }, { z: 1 });
    for (let i = 0; i < 6; i++) {
      k.dibujar(380, (c, t) => {
        const p = k.punto(0.12 + 0.95 * t), r = k.s(0.3 + 0.45 * t), centro = { x: p.x - k.dir.x * r, y: p.y - k.dir.y * r };
        c.globalAlpha = (1 - t) * 0.95; c.lineJoin = 'round';
        for (const [col, w] of [[BICHO.dark, 5.5], [i % 2 ? BICHO.glow : BICHO.core, 3]] as const) {
          c.strokeStyle = col; c.lineWidth = w * (1 - t * 0.5);
          c.beginPath();
          for (let j = 0; j <= 16; j++) { const a = k.angle - 0.8 + (1.6 * j) / 16, rr = r + (j % 2 ? 1 : -1) * k.s(0.045); const x = centro.x + Math.cos(a) * rr, y = centro.y + Math.sin(a) * rr; if (j === 0) c.moveTo(x, y); else c.lineTo(x, y); }
          c.stroke();
        }
      }, { delay: i * 65, z: 1 });
    }
    await k.esperar(310);
    await k.impacto(t => {
      void k.agitar(t.sprite, 5, 380);
      k.add(E.ring({ at: t.center, from: 6, to: t.size * 0.9, width: 3, color: BICHO.glow, duration: 280 }));
      E.sparks(k.fx, t.center, { count: 10, speed: [120, 260], palette: BICHO, shape: 'streak' });
    });
    await k.esperar(220);
    await k.despues();
  },

  // Corte Furia (40): tres guadañas verdes en media luna cortan seguidas, cada una más grande y brillante que la
  // anterior.
  async furycutter(k) {
    await k.anticipar(60);
    void k.embestida({ hasta: 0.5, ida: 110, vuelta: 320 });
    await k.esperar(80);
    const c0 = k.target.center;
    for (let i = 0; i < 3; i++) {
      const f = 1 + i * 0.3, ang = k.angle + Math.PI / 2 + (i % 2 ? 0.9 : -0.9) + rand(-0.2, 0.2), radio = k.s(0.34 * f);
      k.add(E.slash({ at: c0, radius: radio, angle: ang, sweep: 2.2, width: 2.5 + i * 1.5, palette: BICHO, duration: 210, delay: i * 90 }));
      k.dibujar(200, (c, t) => {
        const a = ang - 1.1 + 2.2 * easeOut(t), p = { x: c0.x + Math.cos(a) * radio, y: c0.y + Math.sin(a) * radio };
        c.globalAlpha = 1 - easeIn(t);
        forma(c, 'luna', p.x, p.y, k.s(0.12 * f), a + Math.PI, { base: i === 2 ? '#f6ffd0' : BICHO.glow, borde: BICHO.dark, grosor: 1.2 });
      }, { z: 1, delay: i * 90 });
    }
    await k.esperar(60);
    await k.impacto(t => E.sparks(k.fx, t.center, { count: 6, speed: [80, 180], palette: BICHO, shape: 'streak' }));
    await k.esperar(140);
    await k.despues();
  },

  // Acoso (20): un enjambre de bichitos diminutos sale disparado y zumba en círculos alrededor del objetivo, sin
  // dejarlo en paz.
  async infestation(k) {
    const ms = 720, n = 12;
    const bichos = Array.from({ length: n }, (_, i) => ({ fase: rand(0, Math.PI * 2), r: rand(0.35, 0.6), v: rand(9, 14) * (i % 2 ? 1 : -1), dy: rand(-0.3, 0.2), retraso: i * 0.015 }));
    k.dibujar(ms, (c, t, engine) => {
      c.globalAlpha = t > 0.85 ? (1 - t) / 0.15 : 1;
      const desde = k.punto(0.15);
      for (const b of bichos) {
        const llega = Math.min(1, Math.max(0, (t - b.retraso) / 0.3)), orb = k.alrededor({ x: k.target.center.x, y: k.target.center.y + k.s(b.dy) }, k.s(b.r), b.fase + t * b.v, 0.5);
        const e = easeInOut(llega), p = { x: lerp(desde.x, orb.x, e), y: lerp(desde.y, orb.y, e) };
        bichito(c, p.x, p.y, k.s(0.035), engine.now + b.fase * 100);
      }
    }, { z: 1 });
    await k.esperar(300);
    await k.impacto(t => void k.agitar(t.sprite, 2, 300));
    await k.esperar(260);
    await k.despues();
  },

  // Al Ataque (90): un enjambre de abejas sale del usuario en formación abierta, zigzaguea y se lanza en picado
  // contra el objetivo, aguijones por delante; picotazos por todo el cuerpo.
  async attackorder(k) {
    await k.anticipar(70);
    void k.recuperar({ x: -k.dir.x * 6, y: -k.dir.y * 6 }, 240);
    const ms = 740, n = 9;
    const abejas = Array.from({ length: n }, (_, i) => ({ lado: (i - (n - 1) / 2) / n, fase: rand(0, Math.PI * 2), retraso: i * 0.02 }));
    k.dibujar(ms, (c, t, engine) => {
      for (const a of abejas) {
        const u = Math.max(0, Math.min(1, (t - a.retraso) / 0.62));
        if (u <= 0 || u >= 1) continue;
        const camino = (v: number) => k.punto(easeIn(v) * 0.92 + 0.1 * (1 - v), a.lado * k.dist * 0.9 * Math.sin(Math.PI * v) + Math.sin(v * 12 + a.fase) * k.s(0.1));
        const p = camino(u);
        c.globalAlpha = u > 0.9 ? (1 - u) / 0.1 : 1;
        abeja(c, p.x, p.y, k.s(0.09), rumbo(camino, u), engine.now + a.fase * 50);
      }
    }, { z: 1 });
    await k.esperar(ms * 0.62);
    await k.impacto(t => {
      for (let i = 0; i < 6; i++) k.add(E.starburst({ at: k.enCuerpo(t, 0.35), rays: 5, length: t.size * 0.22, width: 1.8, palette: MIEL, duration: 160, delay: i * 40 }));
      void k.agitar(t.sprite, 4, 340);
    });
    await k.esperar(200);
    await k.despues();
  },

  // A Defender (estado, sobre sí): un enjambre de abejas sale, da vueltas alrededor del usuario y se posa formando
  // un escudo de panal dorado.
  async defendorder(k) {
    const ms = 820, n = 10, S = k.user.size;
    k.dibujar(ms, (c, t, engine) => {
      const u = k.posSprite(k.user), junta = easeInOut(Math.min(1, t / 0.55));
      c.globalAlpha = t > 0.8 ? (1 - t) / 0.2 : 1;
      for (let i = 0; i < n; i++) {
        const ang = (i / n) * Math.PI * 2 + t * 9 * (1 - junta * 0.7), p = k.alrededor(u, lerp(S * 1.15, S * 0.62, junta), ang, 0.6);
        abeja(c, p.x, p.y, S * 0.1, ang + Math.PI / 2, engine.now + i * 40);
      }
    }, { z: 1 });
    k.add(E.shield({ at: k.user.center, rx: S * 0.7, ry: S * 0.62, palette: MIEL, duration: 540, delay: 360 }));
    await k.esperar(480);
    await k.estado();
  },

  // Danza Aleteo (estado, sobre sí): a la espalda del usuario se abren unas alas de mariposa irisadas que baten
  // mientras se mece; caen escamas brillantes en espiral.
  async quiverdance(k) {
    const ms = 880, S = k.user.size;
    void k.animar(k.user.sprite, [{ transform: 'rotate(0deg)' }, { transform: 'rotate(-8deg) translate(-3px, -2px)', offset: 0.25 }, { transform: 'rotate(8deg) translate(3px, -4px)', offset: 0.6 }, { transform: 'rotate(0deg)' }], ms);
    k.dibujar(ms, (c, t, engine) => {
      const u = k.posSprite(k.user), abre = easeOutCubic(Math.min(1, t / 0.25)) * (t > 0.8 ? (1 - t) / 0.2 : 1), bate = 0.6 + 0.4 * Math.cos(engine.now / 70);
      alasMariposa(c, u.x, u.y - S * 0.15, S * 0.72 * abre, bate);
      if (Math.random() < 0.6) {
        const p = k.alrededor(u, S * 0.7, t * 20 + rand(0, 0.5), 0.5);
        k.emit({ x: p.x, y: p.y - S * 0.3, vx: rand(-15, 15), vy: rand(20, 60), life: 520, size: rand(2.5, 4), color: pick(['#ff9ad8', '#9ae0ff', '#ffe46a', '#c4a6ff']), shape: 'star', spin: 6 });
      }
    });
    await k.esperar(ms * 0.6);
    await k.estado();
  },

  // Polvo Ira (estado, sobre sí): el usuario estalla en polvo rojo que se arremolina a su alrededor, un foco rojo le
  // cae encima y le asoma una marca de enfado: todos le miran.
  async ragepowder(k) {
    const S = k.user.size, u = k.user.center, rojo: FxPalette = { core: '#ff3a2a', glow: '#ff8a6a', hot: '#ffe0d0', dark: '#7a0a06' };
    k.add(E.spotlight({ at: k.user.feet, palette: rojo, duration: 820 }));
    void k.agitar(k.user.sprite, 4, 300);
    k.burst(34, i => { const a = (i / 34) * Math.PI * 2, v = rand(140, 240); return { x: u.x + Math.cos(a) * S * 0.3, y: u.y + Math.sin(a) * S * 0.2, vx: Math.cos(a) * v - Math.sin(a) * 120, vy: (Math.sin(a) * v + Math.cos(a) * 120) * 0.55, drag: 2.5, life: rand(500, 750), size: rand(2, 3.5), color: pick(['#ff3a2a', '#ff7a5a', '#c81a10', '#ffb08a']), shape: 'dot' }; });
    k.burst(8, () => ({ x: u.x + rand(-S * 0.3, S * 0.3), y: u.y + rand(-S * 0.2, S * 0.2), vx: rand(-40, 40), vy: -rand(10, 40), life: 700, size: S * 0.15, sizeEnd: S * 0.35, color: '#d8402a', alpha: 0.28, shape: 'smoke' }));
    k.dibujar(720, (c, t) => {
      const pop = t < 0.15 ? (t / 0.15) * 1.25 : t < 0.25 ? 1.25 - ((t - 0.15) / 0.1) * 0.25 : 1, late = 1 + 0.08 * Math.sin(t * 40);
      c.globalAlpha = t > 0.8 ? (1 - t) / 0.2 : 1;
      enfado(c, k.user.top.x + S * 0.32, k.user.top.y - S * 0.05, S * 0.17 * pop * late, '#ff2a2a');
    }, { z: 1 });
    await k.esperar(360);
    await k.estado();
  },

  // Estoicismo (50): el usuario patalea frenético y lanza un abanico de arañazos verdes que giran hacia delante.
  async strugglebug(k) {
    void k.agitar(k.user.sprite, 5, 380);
    const n = 9;
    for (let i = 0; i < n; i++) {
      const giro = rand(-0.6, 0.6), vuelo = rand(200, 280);
      k.dibujar(vuelo, (c, t) => {
        const a = k.angle + giro, d = k.dist * 1.05 * easeOut(t), u = k.posSprite(k.user), p = { x: u.x + Math.cos(a) * d, y: u.y + Math.sin(a) * d };
        c.globalAlpha = t > 0.8 ? (1 - t) / 0.2 : 1;
        forma(c, 'garras', p.x, p.y, k.s(0.11), t * 18 + i, { base: BICHO.glow, borde: BICHO.dark, grosor: 1 });
      }, { delay: i * 25, z: 1 });
    }
    await k.esperar(250);
    await k.impacto(t => {
      k.add(E.slash({ at: t.center, radius: t.size * 0.3, angle: k.angle + Math.PI / 2 + 0.5, sweep: 1.4, width: 3, palette: BICHO, duration: 180 }));
      E.sparks(k.fx, t.center, { count: 6, speed: [80, 180], palette: BICHO, shape: 'streak' });
    });
    await k.esperar(120);
    await k.despues();
  },

  // Pin Misil (25, multigolpe): agujas que salen como misiles, una tras otra en línea recta con su estela de humo y
  // fuego, y pinchan con un chispazo cada una.
  async pinmissile(k) {
    const n = 5, cada = 70, vuelo = 200;
    void k.agitar(k.user.sprite, 2, n * cada);
    for (let i = 0; i < n; i++) {
      const lado = rand(-1, 1) * k.s(0.15);
      let dio = false;
      k.dibujar(vuelo, (c, t, engine) => {
        const u = easeIn(t) * 0.75 + t * 0.25, p = k.punto(0.15 + 0.78 * u, lado * u), cola = { x: p.x - k.dir.x * k.s(0.13), y: p.y - k.dir.y * k.s(0.13) };
        luz(c, engine, cola, k.s(0.08), '#ffb03a', 0.9);
        forma(c, 'aguja', p.x, p.y, k.s(0.13), k.angle, { base: '#eef6c8', oscuro: BICHO.dark, borde: '#2a3006', grosor: 1.1 });
        if (Math.random() < 0.7) k.emit({ x: cola.x, y: cola.y, vx: rand(-15, 15), vy: rand(-25, -5), life: 360, size: 3, sizeEnd: 8, color: '#9a9a90', alpha: 0.35, shape: 'smoke' });
        if (!dio && t > 0.86) { dio = true; k.add(E.starburst({ at: p, rays: 5, length: k.s(0.2), width: 1.6, palette: BICHO, duration: 150 })); }
      }, { z: 1, delay: i * cada });
    }
    await k.esperar(vuelo);
    await k.impacto(t => E.sparks(k.fx, t.center, { count: 5, speed: [80, 160], palette: BICHO, shape: 'shard' }));
    await k.esperar(Math.max(0, (n - 1) * cada - 120));
    await k.despues();
  },

  // Aguijón Letal (50): un aguijón de avispa a rayas negras y amarillas destella en la punta y se clava de un golpe
  // seco.
  async fellstinger(k) {
    await k.anticipar(100);
    void k.recuperar({ x: -k.dir.x * 8, y: -k.dir.y * 8 }, 160);
    const largo = k.s(0.42), ms = 440, quieto = 180, va = 90;
    k.dibujar(ms, (c, t, engine) => {
      const a = t * ms, entra = a < quieto ? 0 : easeIn(Math.min(1, (a - quieto) / va)), fuera = a > 360 ? 1 - (a - 360) / 80 : 1;
      const punta = k.punto(lerp(0.32, 0.9, entra)), centro = { x: punta.x - k.dir.x * largo, y: punta.y - k.dir.y * largo };
      c.globalAlpha = Math.min(1, a / 60) * fuera;
      forma(c, 'aguja', centro.x, centro.y, largo, k.angle, { base: rellenoAvispa, oscuro: '#2a1a06', borde: '#1a1004', grosor: 1.4 });
      if (a < quieto + 20) {
        const g = Math.sin(Math.PI * Math.min(1, a / (quieto + 20)));
        luz(c, engine, punta, k.s(0.2) * g, '#ffffff', 0.9);
        c.globalCompositeOperation = engine.blend; c.fillStyle = '#ffffff';
        c.beginPath(); for (let i = 0; i < 8; i++) { const r = i % 2 ? k.s(0.03) * g : k.s(0.16) * g, an = (i * Math.PI) / 4 + a / 200; c.lineTo(punta.x + Math.cos(an) * r, punta.y + Math.sin(an) * r); } c.closePath(); c.fill();
      }
    }, { z: 1 });
    await k.esperar(quieto + va);
    await k.impacto(t => {
      k.add(E.starburst({ at: t.center, rays: 8, length: t.size * 0.5, width: 2.5, palette: MIEL, duration: 220 }));
      E.sparks(k.fx, t.center, { count: 8, speed: [140, 280], palette: NEUTRAL_FX.white, shape: 'shard' });
    });
    await k.despues();
  },

  // Megacuerno (120): carga épica; un cuerno gigante, verde y brillante, aparece delante del usuario, que embiste
  // con él; al golpear el cuerno crece, destella y revienta el suelo.
  async megahorn(k) {
    await k.cargaEpica();
    const ida = 200, esp = volteo(k), inclina = esp ? -0.5 : 0.5;
    const relleno = (c: CanvasRenderingContext2D) => { const g = c.createLinearGradient(-1, 0, 1, -1); g.addColorStop(0, BICHO.dark); g.addColorStop(0.5, BICHO.core); g.addColorStop(1, '#f6ffd0'); return g; };
    k.dibujar(60 + ida + 300, (c, t) => {
      const a = t * (60 + ida + 300), p = k.posSprite(k.user), golpe = a - 60 - ida;
      const r = k.s(0.38) * Math.min(1, a / 80) * (golpe > 0 ? 1 + 0.6 * easeOutCubic(Math.min(1, golpe / 120)) : 1);
      const delante = { x: p.x + k.dir.x * (k.user.size * 0.55 + r * 0.3), y: p.y + k.dir.y * (k.user.size * 0.55 + r * 0.3) };
      c.globalAlpha = golpe > 160 ? Math.max(0, 1 - (golpe - 160) / 140) : 1;
      forma(c, 'cuerno', delante.x, delante.y, r, k.angle + inclina, { base: relleno, claro: BICHO.glow, oscuro: BICHO.dark, borde: '#1e2404', brillo: BICHO.glow, brilloTam: r * 0.6 }, esp);
    }, { z: 1 });
    await k.esperar(60);
    await k.embestida({ hasta: 0.8, ida, vuelta: 320, estela: BICHO.glow });
    await k.impacto(t => {
      k.add(E.flash({ color: BICHO.glow, alpha: 0.3, duration: 220 }));
      k.add(E.starburst({ at: t.center, rays: 12, length: t.size * 1.1, width: 4, palette: BICHO, duration: 300 }));
      k.add(E.ring({ at: t.center, from: 10, to: t.size * 1.6, width: 6, color: BICHO.glow, duration: 360 }));
      k.add(E.ring({ at: t.feet, from: 10, to: t.size * 2, width: 4, color: BICHO.core, duration: 480, squash: 0.4 }));
      k.add(E.cracks({ at: t.feet, length: t.size * 1.2, color: '#3a2a14', duration: 700 }));
      E.sparks(k.fx, t.center, { count: 16, speed: [180, 380], palette: BICHO, shape: 'shard', size: [3, 5] });
      void k.agitar(t.sprite, 7, 380);
    });
    await k.esperar(240);
    await k.despues();
  },

  // Disparo Demora (estado): tres hebras de seda blanca salen en abanico, ondulando, y envuelven al objetivo en un
  // capullo de hilo que lo aprieta.
  async stringshot(k) {
    await k.anticipar(60);
    void k.recuperar({ x: -k.dir.x * 5, y: -k.dir.y * 5 }, 220);
    const ms = 760, c0 = k.target.center, S = k.target.size;
    k.dibujar(ms, (c, t, engine) => {
      const llega = Math.min(1, t / 0.32), enrolla = Math.max(0, Math.min(1, (t - 0.28) / 0.42)), al = t > 0.85 ? (1 - t) / 0.15 : 1;
      c.globalAlpha = al * (1 - enrolla * 0.6);
      for (const s of [-1, 0, 1]) hilo(c, k.punto(0.15), k.punto(0.95, s * k.s(0.2)), llega, 4, k.s(0.1), engine.now / 40 + s, '#f4f4ff', 1.6);
      c.globalAlpha = al;
      enrollado(c, c0, S, enrolla, '#f8f8ff', 2, 5, 0.5);
      enrollado(c, { x: c0.x, y: c0.y + S * 0.05 }, S, enrolla * 0.8, '#e0e0f0', 1.4, 3, 0.45);
    }, { z: 1 });
    await k.esperar(ms * 0.55);
    void k.animar(k.target.sprite, [{ transform: 'scale(1, 1)' }, { transform: 'scale(0.9, 1.04)', offset: 0.4 }, { transform: 'scale(1, 1)' }], 320);
    await k.estado();
  },

  // Red Viscosa (estado): una telaraña enorme sale disparada, se despliega en el aire y cae extendida en el suelo del
  // lado rival, con gotas pegajosas que brillan.
  async stickyweb(k) {
    await k.anticipar(70);
    void k.recuperar({ x: -k.dir.x * 6, y: -k.dir.y * 6 }, 220);
    const zona = destinoSuelo(k), R = k.s(1.15), vuelo = 320, total = vuelo + 560, desde = k.punto(0.12);
    const gotas = Array.from({ length: 8 }, () => ({ a: rand(0, Math.PI * 2), d: rand(0.3, 0.95) }));
    k.dibujar(total, (c, t, engine) => {
      const a = t * total, u = Math.min(1, a / vuelo);
      const p = { x: lerp(desde.x, zona.x, u), y: lerp(desde.y, zona.y, u) - Math.sin(Math.PI * u) * k.s(0.5) };
      const r = R * (0.2 + 0.8 * easeOutCubic(u)), achat = lerp(1, 0.5, easeOutCubic(u));
      c.globalAlpha = a > total - 220 ? (total - a) / 220 : 1;
      telarana(c, p.x, p.y, r, Math.min(1, a / (vuelo * 0.9)), '#f4f4ff', achat, 12);
      if (u >= 1) for (const g of gotas) luz(c, engine, { x: zona.x + Math.cos(g.a) * R * g.d, y: zona.y + Math.sin(g.a) * R * g.d * 0.5 }, 5 + 2 * Math.sin(a / 60 + g.a * 5), '#ffffff', 0.9);
    });
    await k.esperar(vuelo + 120);
    await k.estado();
  },

  // =============================================================================================================
  // VENENO
  // =============================================================================================================

  // Picotazo Veneno (15): un aguijón morado pequeño sale como un dardo y pica; un pinchazo y una gotita de veneno.
  async poisonsting(k) {
    await k.anticipar(50);
    void k.recuperar({ x: -k.dir.x * 4, y: -k.dir.y * 4 }, 160);
    const vuelo = 170;
    k.dibujar(vuelo, (c, t) => {
      const p = k.punto(0.2 + 0.66 * easeIn(t));
      forma(c, 'aguja', p.x, p.y, k.s(0.12), k.angle, { base: '#b65ae8', oscuro: '#45106a', borde: '#2a0640', grosor: 1.1 });
    }, { z: 1 });
    await k.esperar(vuelo);
    await k.impacto(t => {
      k.add(E.ring({ at: t.center, from: 2, to: t.size * 0.35, width: 2, color: VENENO.glow, duration: 200 }));
      salpicar(k, t.center, 3, MORADOS, 120, 2.5);
    });
    await k.despues();
  },

  // Puya Nociva (80): el usuario embiste con una púa enorme de veneno que brilla y gotea; al clavarse, el veneno
  // salpica por detrás del objetivo.
  async poisonjab(k) {
    await k.anticipar(90);
    void k.embestida({ hasta: 0.5, ida: 130, vuelta: 280, estela: VENENO.glow });
    const ms = 360, entraMs = 140, largo = k.s(0.45);
    k.dibujar(ms, (c, t) => {
      const a = t * ms, entra = easeOutCubic(Math.min(1, a / entraMs)), fuera = a > 240 ? 1 - (a - 240) / 120 : 1;
      const punta = k.punto(lerp(0.35, 0.92, entra)), centro = { x: punta.x - k.dir.x * largo, y: punta.y - k.dir.y * largo };
      c.globalAlpha = fuera;
      forma(c, 'aguja', centro.x, centro.y, largo, k.angle, { base: rellenoVeneno, oscuro: '#45106a', borde: '#2a0640', brillo: VENENO.core, brilloTam: 14 });
      if (Math.random() < 0.4) { const q = { x: lerp(punta.x, centro.x, rand(0, 0.8)), y: lerp(punta.y, centro.y, rand(0, 0.8)) }; k.emit({ x: q.x, y: q.y, vy: rand(20, 60), ay: 500, life: 360, size: 2.5, color: pick(MORADOS), shape: 'drop', stretch: 14 }); }
    }, { z: 1 });
    await k.esperar(entraMs);
    await k.impacto(t => {
      k.add(E.starburst({ at: t.center, rays: 8, length: t.size * 0.6, width: 3, palette: VENENO, duration: 240 }));
      k.add(E.ring({ at: t.center, from: 6, to: t.size * 0.9, width: 4, color: VENENO.glow, duration: 280 }));
      salpicar(k, t.center, 14, MORADOS, 220, 3.5, k.haciaV(260));
      burbujas(k, t.center, t.size * 0.3, 5, VENENO.glow, VENENO.hot, 80);
    });
    await k.despues();
  },

  // Colmillo Veneno (50): unas fauces de encías moradas, con los colmillos goteando veneno, se cierran sobre el
  // objetivo.
  async poisonfang(k) {
    await k.anticipar(80);
    void k.embestida({ hasta: 0.45, ida: 140, vuelta: 260 });
    const c0 = k.target.center, tam = k.s(0.48), abrir = 160, cerrar = 90, fin = 170;
    k.dibujar(abrir + cerrar + fin, (c, t) => {
      const ms = t * (abrir + cerrar + fin);
      const ap = ms < abrir ? Math.min(1, (ms / abrir) * 1.2) : ms < abrir + cerrar ? 1 - easeIn((ms - abrir) / cerrar) : 0;
      const fuera = ms > abrir + cerrar ? (ms - abrir - cerrar) / fin : 0;
      c.globalAlpha = Math.min(1, ms / 60) * (1 - fuera);
      mandibula(c, c0.x, c0.y - k.s(0.05), tam * (1 + fuera * 0.12), ap, { base: '#7a2a9a', claro: '#f6e8ff', borde: '#2a0640', brillo: VENENO.glow, brilloTam: 10 });
      if (ms < abrir + cerrar && Math.random() < 0.5) {
        const lado = pick([-1, 1]), y = c0.y - k.s(0.05) - (0.12 + ap * 0.55) * tam + 0.55 * tam;
        k.emit({ x: c0.x + lado * tam * 0.55, y, vy: rand(30, 70), ay: 600, life: 320, size: 2.5, color: pick(['#c27ef0', '#a64ce0']), shape: 'drop', stretch: 14 });
      }
    }, { z: 1 });
    await k.esperar(abrir + cerrar);
    await k.impacto(t => {
      E.sparks(k.fx, t.center, { count: 12, speed: [140, 280], palette: { ...VENENO, hot: '#ffffff' }, shape: 'shard', size: [2.5, 4.5] });
      salpicar(k, t.center, 10, MORADOS, 200, 3);
      void k.agitar(t.sprite, 3, 220);
    });
    await k.despues();
  },

  // Veneno X (70): dos tajos morados rectos se cruzan en X sobre el objetivo; la X queda brillando un instante y
  // gotea veneno.
  async crosspoison(k) {
    await k.anticipar(80);
    void k.embestida({ hasta: 0.55, ida: 120, vuelta: 280 });
    await k.esperar(90);
    const c0 = k.target.center, L = k.s(0.6), ms = 560;
    k.dibujar(ms, (c, t, engine) => {
      const fuera = t > 0.55 ? 1 - (t - 0.55) / 0.45 : 1;
      c.globalCompositeOperation = engine.blend; c.lineCap = 'round';
      for (const [i, giro] of [[0, Math.PI / 4], [1, -Math.PI / 4]] as const) {
        const u = easeOutCubic(Math.min(1, Math.max(0, (t - i * 0.12) / 0.18)));
        if (u <= 0) continue;
        const a = k.angle + Math.PI / 2 + giro, p0 = { x: c0.x - Math.cos(a) * L, y: c0.y - Math.sin(a) * L };
        const p1 = { x: p0.x + Math.cos(a) * L * 2 * u, y: p0.y + Math.sin(a) * L * 2 * u };
        c.globalAlpha = fuera;
        for (const [col, w] of [[VENENO.core, 14], [VENENO.glow, 7], ['#ffffff', 2.5]] as const) { c.strokeStyle = col; c.lineWidth = w * (0.6 + 0.4 * fuera); c.beginPath(); c.moveTo(p0.x, p0.y); c.lineTo(p1.x, p1.y); c.stroke(); }
      }
      if (t > 0.3 && Math.random() < 0.5) { const s = rand(-1, 1), a = k.angle + Math.PI / 2 + pick([1, -1]) * Math.PI / 4; k.emit({ x: c0.x + Math.cos(a) * L * s, y: c0.y + Math.sin(a) * L * s, vy: rand(10, 40), ay: 500, life: 380, size: 3, color: pick(MORADOS), shape: 'drop', stretch: 14 }); }
    }, { z: 1 });
    await k.esperar(ms * 0.3);
    await k.impacto(t => {
      E.sparks(k.fx, t.center, { count: 12, speed: [140, 300], palette: VENENO, shape: 'shard' });
      k.add(E.bloom({ at: t.center, radius: t.size * 0.6, color: VENENO.glow, duration: 260 }));
    });
    await k.esperar(160);
    await k.despues();
  },

  // Ácido (40): tres gotitas de ácido lima salen escupidas en arco y chisporrotean al tocar: burbujas y vapor.
  async acid(k) {
    await k.anticipar(60);
    void k.recuperar({ x: -k.dir.x * 5, y: -k.dir.y * 5 }, 180);
    const vuelo = 280;
    for (let i = 0; i < 3; i++) {
      const lado = (i - 1) * k.s(0.25), camino = (u: number) => enArco(k, 0.15 + 0.8 * u, lado, k.s(0.35));
      k.dibujar(vuelo, (c, t) => {
        const p = camino(t);
        forma(c, 'gota', p.x, p.y, k.s(0.08), rumbo(camino, t), { base: ACIDO.core, claro: ACIDO.glow, borde: '#2e4a04', grosor: 1.2 });
      }, { z: 1, delay: i * 60 });
    }
    await k.esperar(vuelo + 60);
    await k.impacto(t => {
      burbujas(k, t.center, t.size * 0.3, 9, ACIDO.core, ACIDO.hot);
      k.burst(6, () => ({ x: t.center.x + rand(-t.size * 0.3, t.size * 0.3), y: t.center.y, vx: rand(-10, 10), vy: -rand(30, 60), life: 600, size: 6, sizeEnd: 14, color: '#f0f4e0', alpha: 0.35, shape: 'smoke' }));
      k.burst(8, () => ({ x: t.center.x + rand(-t.size * 0.3, t.size * 0.3), y: t.center.y + rand(-t.size * 0.2, t.size * 0.2), vx: rand(-80, 80), vy: rand(-120, -30), ay: 300, life: 260, size: rand(1.5, 2.5), color: ACIDO.glow, shape: 'dot' }));
    });
    await k.despues();
  },

  // Bomba Ácida (40): una bola de ácido burbujeante vuela y revienta contra el objetivo dejándole una mancha lima
  // que humea y gotea.
  async acidspray(k) {
    await k.anticipar(70);
    void k.recuperar({ x: -k.dir.x * 6, y: -k.dir.y * 6 }, 200);
    await k.proyectil(300, (p, _t, c, engine) => {
      pegote(c, p.x, p.y, k.s(0.12), engine.now, COL_ACIDO);
      if (Math.random() < 0.4) k.emit({ x: p.x, y: p.y, vy: rand(10, 40), ay: 600, life: 300, size: 2.2, color: ACIDO.core, shape: 'drop', stretch: 12 });
    }, { arco: k.s(0.4) });
    const c0 = k.target.center, radios = radiosMancha();
    k.dibujar(680, (c, t) => {
      mancha(c, c0.x, c0.y, k.s(0.36) * easeOutCubic(Math.min(1, t * 5)), radios, COL_ACIDO, 1 - easeIn(t));
      c.globalAlpha = 1 - t;
      for (let i = 0; i < 3; i++) forma(c, 'gota', c0.x + (i - 1) * k.s(0.18), c0.y + k.s(0.15) + t * k.s(0.4) * (0.7 + i * 0.2), k.s(0.05), Math.PI / 2, { base: ACIDO.core, borde: '#2e4a04', grosor: 1 });
      if (Math.random() < 0.3) k.emit({ x: c0.x + rand(-k.s(0.3), k.s(0.3)), y: c0.y, vy: -rand(30, 60), life: 500, size: 5, sizeEnd: 12, color: '#f0f4e0', alpha: 0.3, shape: 'smoke' });
    }, { z: 1 });
    await k.impacto(t => {
      salpicar(k, t.center, 12, [ACIDO.core, ACIDO.glow], 220, 3);
      burbujas(k, t.center, t.size * 0.3, 5, ACIDO.core, ACIDO.hot, 100);
    });
    await k.despues();
  },

  // Armadura Ácida (estado, sobre sí): el usuario se derrite en un charco de ácido burbujeante (se aplasta y gotea)
  // y vuelve a cuajar, más duro.
  async acidarmor(k) {
    const S = k.user.size, pie = k.user.feet, ms = 840;
    void k.animar(k.user.sprite, [
      { transform: 'translate(0px, 0px) scale(1, 1)' },
      { transform: `translate(0px, ${S * 0.18}px) scale(1.3, 0.55)`, offset: 0.45 },
      { transform: `translate(0px, ${S * 0.16}px) scale(1.34, 0.5)`, offset: 0.65 },
      { transform: 'translate(0px, -4px) scale(0.92, 1.1)', offset: 0.85 },
      { transform: 'translate(0px, 0px) scale(1, 1)' },
    ], ms);
    void k.animar(k.user.sprite, [{ opacity: 1 }, { opacity: 0.6, offset: 0.5 }, { opacity: 1 }], ms);
    k.dibujar(ms, (c, t, engine) => {
      const charco = Math.sin(Math.PI * Math.min(1, t * 1.15));
      c.save(); c.translate(pie.x, pie.y); c.scale(1, 0.4); pegote(c, 0, 0, S * 0.75 * charco, engine.now, COL_ACIDO); c.restore();
      c.globalAlpha = charco;
      for (let i = 0; i < 4; i++) {
        const y = k.user.top.y + S * 0.2 + ((t * 2 + i * 0.27) % 1) * S * 0.6;
        forma(c, 'gota', pie.x + (i - 1.5) * S * 0.18, y, S * 0.06, Math.PI / 2, { base: ACIDO.core, claro: ACIDO.glow, borde: '#2e4a04', grosor: 1 });
      }
      if (Math.random() < 0.4) { const p = k.alrededor(pie, S * 0.6 * charco * rand(0, 1), rand(0, Math.PI * 2), 0.4); k.emit({ x: p.x, y: p.y, vy: -rand(20, 50), life: 320, size: rand(2, 4), color: ACIDO.core, accent: ACIDO.hot, shape: 'bubble' }); }
    });
    await k.esperar(ms * 0.8);
    k.add(E.ring({ at: k.user.center, from: S * 0.3, to: S * 0.8, width: 3, color: ACIDO.glow, duration: 260 }));
    await k.estado();
  },

  // Carga Tóxica (65): un chorro de líquido venenoso cruza hasta el objetivo y, al tocarlo, el veneno se carga y
  // estalla en chispazos morados que le recorren el cuerpo.
  async venoshock(k) {
    await k.cargar(100);
    const dura = 440;
    k.add(E.torrent({ from: k.punto(0.12), to: k.target.center, width: k.s(0.2), palette: VENENO, duration: dura }));
    void k.recuperar({ x: -k.dir.x * 8, y: -k.dir.y * 8 }, 300);
    await k.esperar(dura * 0.45);
    await k.impacto(t => {
      for (let i = 0; i < 4; i++) k.add(E.bolt({ from: k.enCuerpo(t, 0.55), to: k.enCuerpo(t, 0.15), palette: VENENO, duration: 200, width: 2.4, branches: 1, delay: i * 50 }));
      k.add(E.bloom({ at: t.center, radius: t.size * 0.8, color: VENENO.glow, duration: 300 }));
      burbujas(k, t.center, t.size * 0.35, 8, VENENO.glow, VENENO.hot, 60);
    });
    await k.esperar(160);
    await k.despues();
  },

  // Residuos (65): un pegote de lodo morado sale lanzado en parábola, tiembla en el aire y se aplasta contra el
  // objetivo en un salpicón que gotea.
  async sludge(k) {
    await k.anticipar(80);
    void k.recuperar({ x: -k.dir.x * 8, y: -k.dir.y * 8 }, 220);
    await k.proyectil(340, (p, t, c, engine) => {
      pegote(c, p.x, p.y, k.s(0.16), engine.now, LODO, 1 + 0.2 * Math.sin(t * Math.PI * 3), k.angle);
      if (Math.random() < 0.4) k.emit({ x: p.x, y: p.y, vy: rand(10, 40), ay: 700, life: 300, size: 2.6, color: pick(MORADOS), shape: 'drop', stretch: 14 });
    }, { arco: k.s(0.55) });
    const c0 = k.target.center, radios = radiosMancha();
    k.dibujar(620, (c, t) => {
      mancha(c, c0.x, c0.y, k.s(0.4) * easeOutCubic(Math.min(1, t * 5)), radios, LODO, 1 - easeIn(t));
      c.globalAlpha = 1 - t;
      for (let i = 0; i < 2; i++) forma(c, 'gota', c0.x + (i - 0.5) * k.s(0.3), c0.y + k.s(0.2) + t * k.s(0.35), k.s(0.06), Math.PI / 2, { base: LODO.base, claro: LODO.claro, borde: LODO.oscuro, grosor: 1 });
    }, { z: 1 });
    await k.impacto(t => {
      salpicar(k, t.center, 12, MORADOS, 240, 3.5);
      burbujas(k, t.center, t.size * 0.3, 5, VENENO.glow, VENENO.hot, 120);
    });
    await k.despues();
  },

  // Bomba Lodo (90): una bola grande de lodo deja un reguero de goterones y humo en su arco y explota sobre el
  // objetivo: destello morado, onda, pegotes volando y una mancha enorme.
  async sludgebomb(k) {
    await k.cargar(110);
    await k.anticipar(70);
    void k.recuperar({ x: -k.dir.x * 10, y: -k.dir.y * 10 }, 260);
    await k.proyectil(360, (p, _t, c, engine) => {
      pegote(c, p.x, p.y, k.s(0.26), engine.now, LODO);
      k.emit({ x: p.x + rand(-6, 6), y: p.y + rand(-6, 6), vy: rand(0, 40), ay: 700, life: 340, size: rand(2.5, 4), color: pick(MORADOS), shape: 'drop', stretch: 14 });
      if (Math.random() < 0.5) k.emit({ x: p.x, y: p.y, vx: rand(-15, 15), vy: -rand(10, 30), life: 500, size: k.s(0.1), sizeEnd: k.s(0.22), color: '#5a2a7a', alpha: 0.3, shape: 'smoke' });
    }, { arco: k.s(0.7) });
    const c0 = k.target.center, radios = radiosMancha(14);
    k.dibujar(720, (c, t) => mancha(c, c0.x, c0.y, k.s(0.6) * easeOutCubic(Math.min(1, t * 6)), radios, LODO, 1 - easeIn(t)), { z: 1 });
    await k.impacto(t => {
      k.add(E.flash({ color: VENENO.core, alpha: 0.2, duration: 200 }));
      k.add(E.bloom({ at: t.center, radius: t.size * 1.1, color: VENENO.glow, duration: 320 }));
      k.add(E.ring({ at: t.center, from: 10, to: t.size * 1.3, width: 6, color: VENENO.glow, duration: 360 }));
      k.burst(22, () => { const a = rand(0, Math.PI * 2), v = rand(140, 340); return { x: t.center.x, y: t.center.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 160, ay: 700, drag: 0.5, life: rand(420, 650), size: rand(3.5, 7), sizeEnd: 2, color: pick(MORADOS), shape: 'dot' }; });
      burbujas(k, t.center, t.size * 0.4, 8, VENENO.glow, VENENO.hot, 100);
      k.burst(6, () => ({ x: t.center.x + rand(-15, 15), y: t.center.y + rand(-15, 10), vy: -rand(20, 60), life: 700, delay: 120, size: k.s(0.15), sizeEnd: k.s(0.35), color: '#45106a', alpha: 0.35, shape: 'smoke' }));
      void k.agitar(t.sprite, 5, 300);
    });
    await k.esperar(140);
    await k.despues();
  },

  // Onda Tóxica (95): una marea de lodo morado brota alrededor del usuario y se expande en un anillo que avanza
  // ondulando por el suelo, con burbujas en la cresta, hasta pasar por encima del objetivo.
  async sludgewave(k) {
    await k.cargar(120);
    void k.saltar(k.user.sprite, k.user.size * 0.15, 260);
    const ms = 720, c0 = k.user.feet, R = k.dist + k.s(0.7);
    k.dibujar(ms, (c, t, engine) => {
      const r = R * easeOut(t), al = t > 0.75 ? 1 - (t - 0.75) / 0.25 : Math.min(1, t * 8), ancho = k.s(0.4) * (1 - 0.4 * t), dentro = Math.max(0, r - ancho);
      const ola = (a: number, base: number, amp: number) => base + Math.sin(a * 9 + engine.now / 60) * amp;
      c.save(); c.translate(c0.x, c0.y); c.scale(1, 0.55);
      c.globalAlpha = al * 0.88;
      c.beginPath();
      for (let i = 0; i <= 56; i++) { const a = (i / 56) * Math.PI * 2, rr = ola(a, r, k.s(0.06)); if (i === 0) c.moveTo(Math.cos(a) * rr, Math.sin(a) * rr); else c.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
      c.closePath();
      c.moveTo(dentro, 0);
      for (let i = 56; i >= 0; i--) { const a = (i / 56) * Math.PI * 2; c.lineTo(Math.cos(a) * dentro, Math.sin(a) * dentro); }
      c.closePath();
      const g = c.createRadialGradient(0, 0, dentro, 0, 0, Math.max(dentro + 1, r + k.s(0.06)));
      g.addColorStop(0, withAlpha(LODO.oscuro, 0)); g.addColorStop(0.5, LODO.base); g.addColorStop(0.85, LODO.claro); g.addColorStop(1, LODO.oscuro);
      c.fillStyle = g; c.fill('evenodd');
      c.strokeStyle = '#f0d0ff'; c.lineWidth = 2.5;
      c.beginPath();
      for (let i = 0; i <= 56; i++) { const a = (i / 56) * Math.PI * 2, rr = ola(a, r, k.s(0.06)) - 3; if (i === 0) c.moveTo(Math.cos(a) * rr, Math.sin(a) * rr); else c.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
      c.stroke();
      c.restore();
      for (let i = 0; i < 2; i++) { const p = k.alrededor(c0, r, rand(0, Math.PI * 2), 0.55); k.emit({ x: p.x, y: p.y, vy: -rand(20, 60), life: 320, size: rand(2.5, 5), color: VENENO.glow, accent: VENENO.hot, shape: 'bubble' }); }
    });
    const llega = 1 - Math.sqrt(Math.max(0, 1 - k.dist / R));
    await k.esperar(ms * llega);
    await k.impacto(t => {
      k.burst(14, () => ({ x: t.feet.x + rand(-t.size * 0.4, t.size * 0.4), y: t.feet.y, vx: rand(-80, 80), vy: -rand(200, 360), ay: 900, life: rand(400, 600), size: rand(3, 6), color: pick(MORADOS), shape: 'dot' }));
      void k.agitar(t.sprite, 5, 320);
    });
    await k.esperar(Math.max(0, ms * (1 - llega) - 200));
    await k.despues();
  },

  // Lanzamugre (120): carga épica y un cañonazo de mugre: una bola enorme de lodo negruzco con trozos de basura sale
  // disparada en línea recta, deja un reguero de goterones y revienta sobre el objetivo cubriéndolo de porquería.
  async gunkshot(k) {
    await k.cargaEpica();
    await k.anticipar(80);
    void k.recuperar({ x: -k.dir.x * 16, y: -k.dir.y * 16 }, 320);
    const trozos = Array.from({ length: 5 }, () => ({ a: rand(0, Math.PI * 2), d: rand(0.3, 0.7), tam: rand(0.18, 0.3), col: pick(['#5a5a52', '#7a6a48', '#4a3a2a', '#8a8a7a']) }));
    await k.proyectil(260, (p, t, c, engine) => {
      const r = k.s(0.34);
      pegote(c, p.x, p.y, r, engine.now, MUGRE, 1.25, k.angle);
      for (const tr of trozos) {
        const a = tr.a + t * 6, q = { x: p.x + Math.cos(a) * r * tr.d, y: p.y + Math.sin(a) * r * tr.d * 0.8 }, s = r * tr.tam;
        c.save(); c.translate(q.x, q.y); c.rotate(a * 2); c.fillStyle = tr.col; c.strokeStyle = '#1a1410'; c.lineWidth = 1;
        c.beginPath(); c.moveTo(-s, -s * 0.6); c.lineTo(s * 0.8, -s * 0.8); c.lineTo(s, s * 0.5); c.lineTo(-s * 0.6, s * 0.8); c.closePath(); c.fill(); c.stroke(); c.restore();
      }
      for (let i = 0; i < 2; i++) k.emit({ x: p.x - k.dir.x * r + rand(-8, 8), y: p.y - k.dir.y * r + rand(-8, 8), vx: -k.dir.x * 60, vy: -k.dir.y * 60 + rand(0, 40), ay: 800, life: 380, size: rand(3, 5), color: pick(['#4e2a5a', '#7b2cb4', '#2c0846']), shape: 'drop', stretch: 14 });
    });
    const c0 = k.target.center, radios = radiosMancha(14);
    k.dibujar(820, (c, t) => mancha(c, c0.x, c0.y, k.s(0.75) * easeOutCubic(Math.min(1, t * 6)), radios, MUGRE, 1 - easeIn(t)), { z: 1 });
    await k.impacto(t => {
      k.add(E.flash({ color: '#6a2a8a', alpha: 0.35, duration: 260 }));
      k.add(E.ring({ at: t.center, from: 10, to: t.size * 1.6, width: 7, color: VENENO.glow, duration: 380 }));
      k.add(E.ring({ at: t.feet, from: 10, to: t.size * 2.1, width: 4, color: MUGRE.base, duration: 500, squash: 0.4 }));
      k.add(E.cracks({ at: t.feet, length: t.size * 1.2, color: '#2a1a24', duration: 760 }));
      k.burst(26, () => { const a = rand(0, Math.PI * 2), v = rand(160, 400); return { x: t.center.x, y: t.center.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 180, ay: 800, drag: 0.5, life: rand(450, 700), size: rand(4, 8), sizeEnd: 2, color: pick(['#4e2a5a', '#7b2cb4', '#2c0846', '#9a7aa8']), shape: 'dot' }; });
      k.burst(8, () => { const a = rand(0, Math.PI * 2), v = rand(140, 300); return { x: t.center.x, y: t.center.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 140, ay: 700, life: 560, size: rand(4, 7), color: pick(['#5a5a52', '#7a6a48']), accent: '#1a1410', shape: 'rock', spin: rand(-10, 10) }; });
      k.burst(8, () => ({ x: t.center.x + rand(-20, 20), y: t.center.y + rand(-20, 10), vy: -rand(20, 60), life: 760, delay: 120, size: k.s(0.18), sizeEnd: k.s(0.4), color: '#2c0846', alpha: 0.35, shape: 'smoke' }));
      void k.agitar(t.sprite, 8, 420);
    });
    await k.esperar(240);
    await k.despues();
  },

  // Polución (30): tres bocanadas de humo sucio, pardo y violeta, salen a trompicones (el usuario tose) y ensucian al
  // objetivo.
  async smog(k) {
    void k.animar(k.user.sprite, [
      { transform: 'scale(1, 1)' }, { transform: 'scale(1.06, 0.94)', offset: 0.2 }, { transform: 'scale(1, 1)', offset: 0.35 },
      { transform: 'scale(1.06, 0.94)', offset: 0.55 }, { transform: 'scale(1, 1)', offset: 0.7 }, { transform: 'scale(1.06, 0.94)', offset: 0.85 }, { transform: 'scale(1, 1)' },
    ], 320);
    for (let i = 0; i < 3; i++) {
      const lado = (i - 1) * k.s(0.2);
      k.dibujar(300, (_c, t) => {
        const p = k.punto(0.15 + 0.8 * easeOut(t), lado * t);
        if (Math.random() < 0.8) k.emit({ x: p.x + rand(-4, 4), y: p.y + rand(-4, 4), vx: rand(-15, 15), vy: -rand(5, 25), life: 420, size: k.s(0.08), sizeEnd: k.s(0.18), color: pick(['#5a4a4a', '#6a5070', '#3e3434']), alpha: 0.42, shape: 'smoke' });
      }, { delay: i * 90 });
    }
    await k.esperar(300 + 60);
    await k.impacto(t => {
      k.burst(8, () => ({ x: t.center.x + rand(-t.size * 0.3, t.size * 0.3), y: t.center.y + rand(-t.size * 0.3, t.size * 0.2), vx: rand(-30, 30), vy: -rand(10, 30), life: 600, size: k.s(0.12), sizeEnd: k.s(0.25), color: pick(['#4a3a44', '#5a4a5a']), alpha: 0.45, shape: 'smoke' }));
    });
    await k.despues();
  },

  // Niebla Clara (50): una bola de niebla blanca y limpia vuela y estalla sobre el objetivo en un anillo de bruma
  // con destellos, como si lo lavara (le borra los cambios de stats).
  async clearsmog(k) {
    await k.anticipar(60);
    void k.recuperar({ x: -k.dir.x * 5, y: -k.dir.y * 5 }, 200);
    await k.proyectil(300, (p, _t, c, engine) => {
      luz(c, engine, p, k.s(0.32), '#e8f4ff');
      if (Math.random() < 0.7) k.emit({ x: p.x + rand(-5, 5), y: p.y + rand(-5, 5), vx: rand(-10, 10), vy: rand(-15, 5), life: 380, size: k.s(0.1), sizeEnd: k.s(0.2), color: pick(['#ffffff', '#e0ecf4']), alpha: 0.4, shape: 'smoke' });
    }, { arco: k.s(0.2) });
    await k.impacto(t => {
      k.burst(14, i => { const a = (i / 14) * Math.PI * 2; return { x: t.center.x, y: t.center.y, vx: Math.cos(a) * 140, vy: Math.sin(a) * 80, drag: 2.5, life: 620, size: k.s(0.14), sizeEnd: k.s(0.3), color: pick(['#ffffff', '#e0ecf4', '#d8e0ff']), alpha: 0.4, shape: 'smoke' }; });
      k.add(E.ring({ at: t.center, from: 6, to: t.size, width: 4, color: '#ffffff', duration: 360 }));
      E.sparks(k.fx, t.center, { count: 10, speed: [60, 160], palette: NEUTRAL_FX.white, shape: 'star', size: [2.5, 4] });
    });
    await k.despues();
  },

  // Eructo (120): el usuario se hincha como un globo y suelta un eructo enorme: un cono de gas verdoso y violeta con
  // ondas que retumban y sacuden al objetivo.
  async belch(k) {
    k.add(E.dim({ at: k.user.center, duration: 900, strength: 0.35 }));
    await k.animar(k.user.sprite, [{ transform: 'scale(1, 1)' }, { transform: 'scale(1.2, 1.16)', offset: 0.7 }, { transform: 'scale(1.26, 1.2)' }], 320, 'ease-out');
    void k.animar(k.user.sprite, [{ transform: 'scale(1.26, 1.2)' }, { transform: `translate(${-k.dir.x * 10}px, ${-k.dir.y * 10}px) scale(0.9, 1.08)`, offset: 0.25 }, { transform: 'translate(0px, 0px) scale(1, 1)' }], 440);
    const gas = ['#8ab84a', '#a86ad0', '#6a8a3a', '#7a4a9a'];
    for (let i = 0; i < 4; i++) {
      k.dibujar(400, (c, t) => {
        const p = k.punto(0.15 + 0.95 * t), r = k.s(0.25 + 0.55 * t), centro = { x: p.x - k.dir.x * r, y: p.y - k.dir.y * r };
        c.globalAlpha = (1 - t) * 0.9; c.lineCap = 'round';
        c.strokeStyle = i % 2 ? '#c08ae8' : '#b8e05a'; c.lineWidth = 6 * (1 - t * 0.6);
        c.beginPath(); c.arc(centro.x, centro.y, r, k.angle - 0.7, k.angle + 0.7); c.stroke();
      }, { delay: i * 70, z: 1 });
    }
    k.dibujar(420, (_c, t) => {
      for (let i = 0; i < 3; i++) {
        const a = k.angle + rand(-0.45, 0.45), v = rand(380, 560), p = k.punto(0.15);
        k.emit({ x: p.x, y: p.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, drag: 1.6, life: rand(450, 650), size: k.s(0.1), sizeEnd: k.s(rand(0.3, 0.45)), color: pick(gas), alpha: 0.35 * (1 - t * 0.5), shape: 'smoke' });
      }
    });
    await k.esperar(220);
    await k.impacto(t => {
      k.add(E.flash({ color: '#b8e05a', alpha: 0.18, duration: 220 }));
      k.add(E.ring({ at: t.center, from: 8, to: t.size * 1.4, width: 6, color: '#c08ae8', duration: 380 }));
      k.burst(10, () => { const a = rand(0, Math.PI * 2); return { x: t.center.x, y: t.center.y, vx: Math.cos(a) * rand(60, 160), vy: Math.sin(a) * rand(40, 100), drag: 2, life: 700, size: k.s(0.15), sizeEnd: k.s(0.4), color: pick(gas), alpha: 0.38, shape: 'smoke' }; });
      void k.agitar(t.sprite, 7, 420);
    });
    await k.esperar(260);
    await k.despues();
  },

  // Gas Venenoso (estado): una nube espesa de gas violáceo sale del usuario en volutas y se traga al objetivo
  // girando a su alrededor.
  async poisongas(k) {
    await k.anticipar(60);
    void k.recuperar({ x: -k.dir.x * 5, y: -k.dir.y * 5 }, 220);
    const ms = 560, gas = ['#8a4ab8', '#6a3a8a', '#a86ad0', '#5a5a7a'];
    k.dibujar(ms, (_c, t) => {
      for (let i = 0; i < 2; i++) {
        const u = rand(0.15, 0.3 + 0.7 * t), p = k.punto(u, rand(-1, 1) * k.s(0.25) * u);
        k.emit({ x: p.x, y: p.y, vx: k.dir.x * rand(60, 120) + rand(-20, 20), vy: k.dir.y * rand(60, 120) - rand(5, 25), drag: 1, life: rand(500, 800), size: k.s(rand(0.12, 0.2)), sizeEnd: k.s(rand(0.35, 0.5)), color: pick(gas), alpha: 0.3, shape: 'smoke' });
      }
    });
    await k.esperar(ms * 0.6);
    k.burst(14, i => { const a = (i / 14) * Math.PI * 2, p = k.alrededor(k.target.center, k.s(0.55), a); return { x: p.x, y: p.y, vx: -Math.sin(a) * 70, vy: Math.cos(a) * 35, life: 720, size: k.s(0.2), sizeEnd: k.s(0.4), color: pick(gas), alpha: 0.35, shape: 'smoke' }; });
    await k.esperar(160);
    await k.estado();
  },

  // Polvo Veneno (estado): un remolino de polvo morado baja en espiral sobre el objetivo, dejando una bruma violeta y
  // burbujas que revientan.
  async poisonpowder(k) {
    await k.anticipar(60);
    void k.recuperar({ x: -k.dir.x * 5, y: -k.dir.y * 5 }, 220);
    k.burst(8, () => { const p = k.punto(0.15), v = k.haciaV(rand(200, 320), rand(-60, 60)); return { x: p.x, y: p.y, vx: v.x, vy: v.y - 60, drag: 2, life: 420, size: rand(2, 3), color: pick(MORADOS), shape: 'dot' }; });
    const c0 = k.target.center, ms = 640;
    k.dibujar(ms, (_c, t) => {
      for (let j = 0; j < 2; j++) {
        const a = t * 14 + j * Math.PI, r = k.s(0.55) * (1 - 0.5 * t), y = k.target.top.y - k.s(0.35) * (1 - t) + t * k.s(0.3);
        const p = { x: c0.x + Math.cos(a) * r, y: y + Math.sin(a) * r * 0.4 };
        k.emit({ x: p.x, y: p.y, vx: rand(-10, 10), vy: rand(60, 120), life: 450, size: rand(1.6, 3), color: pick([...MORADOS, '#f0d0ff']), shape: 'dot' });
        if (Math.random() < 0.4) k.emit({ x: p.x, y: p.y, vy: rand(10, 30), life: 600, size: k.s(0.1), sizeEnd: k.s(0.22), color: '#8a4ab8', alpha: 0.25, shape: 'smoke' });
      }
    });
    await k.esperar(ms * 0.65);
    burbujas(k, c0, k.s(0.3), 8, VENENO.glow, VENENO.hot);
    await k.estado();
  },

  // Tóxico (estado): una gota de veneno espeso vuela hasta el objetivo y lo encierra en una burbuja oscura donde
  // hierven burbujas moradas, hasta que revienta.
  async toxic(k) {
    await k.anticipar(60);
    void k.recuperar({ x: -k.dir.x * 5, y: -k.dir.y * 5 }, 220);
    await k.proyectil(280, (p, _t, c, engine) => pegote(c, p.x, p.y, k.s(0.1), engine.now, COL_TOXICO), { arco: k.s(0.3) });
    const c0 = k.target.center, R = k.s(0.62), ms = 560;
    k.dibujar(ms, (c, t) => {
      const cubre = easeOutCubic(Math.min(1, t / 0.3)), r = R * cubre * (1 + 0.04 * Math.sin(t * 30));
      c.globalAlpha = t > 0.85 ? (1 - t) / 0.15 : 1;
      const g = c.createRadialGradient(c0.x, c0.y, R * 0.15, c0.x, c0.y, Math.max(1, r));
      g.addColorStop(0, withAlpha('#45106a', 0.12 + 0.3 * t)); g.addColorStop(0.75, withAlpha('#7a2cb4', 0.35)); g.addColorStop(1, withAlpha('#d895ff', 0.75));
      c.fillStyle = g; c.beginPath(); c.arc(c0.x, c0.y, Math.max(1, r), 0, Math.PI * 2); c.fill();
      c.strokeStyle = '#2a0640'; c.lineWidth = 2; c.stroke();
      c.fillStyle = 'rgba(255,255,255,0.5)'; c.beginPath(); c.ellipse(c0.x - r * 0.4, c0.y - r * 0.45, r * 0.22, r * 0.1, -0.6, 0, Math.PI * 2); c.fill();
      if (Math.random() < 0.6) { const p = k.enCuerpo(k.target, 0.35); k.emit({ x: p.x, y: p.y, vy: -rand(30, 60), life: 300, size: rand(2, 4.5), color: '#c27ef0', accent: '#f6e2ff', shape: 'bubble' }); }
    }, { z: 1 });
    await k.esperar(ms * 0.85);
    salpicar(k, c0, 14, ['#5a1a8a', '#7b2cb4', '#c27ef0'], 260, 3);
    k.add(E.ring({ at: c0, from: R * 0.9, to: R * 1.4, width: 3, color: VENENO.glow, duration: 240 }));
    await k.estado();
  },

  // Púas Tóxicas (estado): el usuario lanza un puñado de púas moradas que caen en arco y se clavan en el suelo
  // alrededor del rival, brillando con veneno.
  async toxicspikes(k) {
    await k.anticipar(60);
    void k.recuperar({ x: -k.dir.x * 5, y: -k.dir.y * 5 }, 220);
    const zona = destinoSuelo(k), n = 7, vuelo = 340, cada = 30, quieto = 340, total = vuelo + n * cada + quieto, desde = k.punto(0.1);
    const puntos = Array.from({ length: n }, (_, i) => ({ p: k.alrededor(zona, k.s(rand(0.3, 0.9)), (i / n) * Math.PI * 2 + rand(-0.3, 0.3)), inclina: rand(-0.25, 0.25) }));
    let cayeron = 0;
    k.dibujar(total, (c, t, engine) => {
      const a = t * total;
      c.globalAlpha = a > total - 200 ? (total - a) / 200 : 1;
      for (let i = 0; i < n; i++) {
        const u = Math.min(1, Math.max(0, (a - i * cada) / vuelo));
        if (u <= 0) continue;
        const b = puntos[i].p;
        if (u < 1) pua(c, lerp(desde.x, b.x, u), lerp(desde.y, b.y, u) - Math.sin(Math.PI * u) * k.s(0.6), k.s(0.09), u * 9);
        else {
          if (i >= cayeron) { cayeron = i + 1; k.burst(4, () => ({ x: b.x, y: b.y, vx: rand(-50, 50), vy: -rand(20, 70), ay: 300, life: 300, size: rand(1.5, 2.5), color: '#c27ef0', shape: 'dot' })); }
          pua(c, b.x, b.y, k.s(0.11), puntos[i].inclina);
          luz(c, engine, { x: b.x, y: b.y - k.s(0.12) }, k.s(0.1) * (0.6 + 0.4 * Math.sin(a / 70 + i)), VENENO.glow, 0.7);
        }
      }
    });
    await k.esperar(vuelo + n * cada);
    await k.estado();
  },

  // Hilo Venenoso (estado): un hilo morado y brillante sale ondulando, se enrolla en espiral alrededor del objetivo y
  // gotea veneno.
  async toxicthread(k) {
    await k.anticipar(60);
    void k.recuperar({ x: -k.dir.x * 5, y: -k.dir.y * 5 }, 220);
    const ms = 760, c0 = k.target.center, S = k.target.size;
    k.dibujar(ms, (c, t, engine) => {
      const llega = Math.min(1, t / 0.35), enrolla = Math.max(0, Math.min(1, (t - 0.3) / 0.4)), al = t > 0.85 ? (1 - t) / 0.15 : 1;
      c.globalAlpha = al * (1 - enrolla * 0.7);
      hilo(c, k.punto(0.15), k.punto(0.95), llega, 3, k.s(0.08), engine.now / 50, '#d895ff', 2.2);
      c.globalAlpha = al;
      luz(c, engine, c0, S * 0.5 * enrolla, VENENO.core, 0.4);
      enrollado(c, c0, S, enrolla, '#b45ae8', 2.6, 4, 0.48);
      if (enrolla > 0.3 && Math.random() < 0.35) { const p = k.enCuerpo(k.target, 0.35); k.emit({ x: p.x, y: p.y, vy: rand(10, 40), ay: 500, life: 360, size: 2.5, color: pick(MORADOS), shape: 'drop', stretch: 14 }); }
    }, { z: 1 });
    await k.esperar(ms * 0.65);
    await k.estado();
  },
};
