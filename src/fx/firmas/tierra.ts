// Firmas de movimientos (ver LEEME.md). Grupo: Lucha, Roca, Tierra y Acero.
import type { FxEngine } from '../fx/engine';
import { E, TYPE_FX, easeIn, easeOut, easeOutCubic, lerp, pick, rand, type Firma, type FxPalette, type Kit, type SlotGeometry, type Vec } from './kit';
import { forma, type EstiloForma, type NombreForma } from './formas';

// ---------------------------------------------------------------------------------------------
// Paletas

const LUCHA = TYPE_FX.Fighting, ROCA = TYPE_FX.Rock, TIERRA = TYPE_FX.Ground, ACERO = TYPE_FX.Steel;
const AURA: FxPalette = { core: '#3d8bff', glow: '#8cc8ff', hot: '#eef8ff', dark: '#123a8a' };
const IRA: FxPalette = { core: '#ff3a24', glow: '#ff9070', hot: '#fff0e8', dark: '#6a0a06' };
const BARRO: FxPalette = { core: '#6e4a2a', glow: '#a07448', hot: '#d8b48a', dark: '#3a2412' };
const ARENA: FxPalette = { core: '#d9b878', glow: '#f0dcaa', hot: '#fff6dc', dark: '#8a6a3a' };
const MAGMA: FxPalette = { core: '#ff6a1a', glow: '#ffb040', hot: '#fff0b0', dark: '#5a1a06' };
// Chispas que saltan del metal al rozar o chocar.
const CHISPA: FxPalette = { core: '#ffb43a', glow: '#ffe08a', hot: '#ffffff', dark: '#8a4a00' };
const BLANCO: FxPalette = { core: '#ffffff', glow: '#ffffff', hot: '#ffffff', dark: '#9a9a9a' };

/** Tonos de una piedra: cara iluminada, media, en sombra y contorno. */
interface Tono { claro: string; base: string; oscuro: string; borde: string }
const T_ROCA: Tono = { claro: '#e6dab6', base: '#a8996e', oscuro: '#5e5234', borde: '#2e2818' };
const T_TIERRA: Tono = { claro: '#dcb07a', base: '#9a6a3a', oscuro: '#4e3016', borde: '#2a180a' };
const T_ANTIGUA: Tono = { claro: '#e4dccb', base: '#988c76', oscuro: '#4c4436', borde: '#221e16' };

// ---------------------------------------------------------------------------------------------
// Dibujo (canvas, en coordenadas de escenario)

/** Número pseudoaleatorio fijo (0-1) para una semilla: las piedras no cambian de forma entre fotogramas. */
const azar = (n: number): number => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

/** Luz suave (sprite de brillo del motor) en `p`, de radio `r`. */
function luz(c: CanvasRenderingContext2D, engine: FxEngine, p: Vec, r: number, color: string, alpha = 1): void {
  if (r <= 0 || alpha <= 0) return;
  c.save();
  c.globalCompositeOperation = engine.blend;
  c.globalAlpha *= Math.min(1, alpha);
  c.drawImage(engine.glow(color), p.x - r, p.y - r, r * 2, r * 2);
  c.restore();
}

function lineal(c: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, colores: string[]): CanvasGradient {
  const g = c.createLinearGradient(x0, y0, x1, y1);
  colores.forEach((col, i) => g.addColorStop(i / (colores.length - 1), col));
  return g;
}

/** Acero pulido: bandas oscuras y claras con un reflejo blanco en `fase` (0-1) que puede correr. */
function degradadoMetal(c: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, fase: number): CanvasGradient {
  const f = Math.min(0.84, Math.max(0.16, fase)), g = c.createLinearGradient(x0, y0, x1, y1);
  g.addColorStop(0, '#3e5666'); g.addColorStop(f - 0.15, '#9dbacb'); g.addColorStop(f, '#ffffff'); g.addColorStop(f + 0.15, '#a8c3d2'); g.addColorStop(1, '#384c5a');
  return g;
}

const estiloMetal = (fase: number, brilloTam = 8): EstiloForma => ({
  base: c => degradadoMetal(c, -1, -1, 1, 1, fase), claro: '#e8f2f8', oscuro: '#58717f', borde: '#1c2a32', brillo: '#dcecf4', brilloTam,
});
// Energía de lucha: de la muñeca naranja oscura a los nudillos casi blancos.
const estiloLucha = (brilloTam = 10, brillo = '#ff9a3a'): EstiloForma => ({
  base: c => lineal(c, -1, 0, 0.8, 0, ['#c2440a', '#ff7a1a', '#ffbe6a', '#fff0d0']), claro: '#ffe2b4', oscuro: '#a83c08', borde: '#4e1a04', brillo, brilloTam,
});
// Rojo de rabia (Desquite, Contraataque).
const estiloIra = (brilloTam = 10): EstiloForma => ({
  base: c => lineal(c, -1, 0, 0.8, 0, ['#7a0a04', '#e02a18', '#ff7a5a', '#ffe0d4']), claro: '#ffc4b0', oscuro: '#7a0a04', borde: '#360402', brillo: '#ff3a24', brilloTam,
});
// Tierra prensada (Arremetida).
const estiloTierra = (brilloTam = 6): EstiloForma => ({
  base: c => lineal(c, -1, -1, 1, 1, ['#e6bf84', '#b07a42', '#6a4220']), claro: '#e8c890', oscuro: '#5a3818', borde: '#2a180a', brillo: '#7a4a1a', brilloTam,
});
// Palma o pie con su color de piel cálido y aura naranja.
const estiloPiel = (brilloTam = 8): EstiloForma => ({
  base: c => lineal(c, -1, 0, 1, 0, ['#d8864a', '#ffcf9a', '#fff0dc']), claro: '#fff0dc', oscuro: '#c06a30', borde: '#5a2a0c', brillo: '#ffb050', brilloTam,
});

/** Una piedra poligonal con luz de arriba a la izquierda. `aspecto` estira en vertical (losas, bloques). */
function piedra(c: CanvasRenderingContext2D, x: number, y: number, r: number, rot: number, semilla: number, tono: Tono = T_ROCA, aspecto = 0.86): void {
  if (r <= 0.5) return;
  const n = 8, pts: Vec[] = [];
  for (let i = 0; i < n; i++) {
    const a = rot + (i / n) * Math.PI * 2, rr = r * (0.74 + 0.32 * azar(semilla * 13 + i));
    pts.push({ x: x + Math.cos(a) * rr, y: y + Math.sin(a) * rr * aspecto });
  }
  c.save();
  c.beginPath();
  pts.forEach((p, i) => (i ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y)));
  c.closePath();
  c.fillStyle = lineal(c, x - r, y - r * aspecto, x + r * 0.8, y + r * aspecto, [tono.claro, tono.base, tono.oscuro]);
  c.fill();
  c.lineJoin = 'round'; c.lineWidth = Math.max(1.2, r * 0.1); c.strokeStyle = tono.borde; c.stroke();
  // Aristas: tres líneas desde un punto central.
  const m = { x: x + r * 0.08, y: y + r * 0.05 * aspecto };
  c.beginPath();
  for (const i of [1, 4, 6]) { c.moveTo(m.x, m.y); c.lineTo(lerp(m.x, pts[i].x, 0.85), lerp(m.y, pts[i].y, 0.85)); }
  c.globalAlpha *= 0.5; c.lineWidth = Math.max(0.8, r * 0.05); c.stroke();
  c.restore();
}

/** Estaca de piedra que brota del suelo: base en (x, y), punta `alto` px hacia arriba e inclinada `inc` px. */
function estaca(c: CanvasRenderingContext2D, x: number, y: number, alto: number, ancho: number, inc: number, tono: Tono = T_ROCA): void {
  if (alto <= 1 || ancho <= 0.5) return;
  const p = { x: x + inc, y: y - alto }, m = { x: x + ancho * 0.12, y: y + ancho * 0.22 };
  c.save();
  c.lineJoin = 'round';
  c.beginPath(); c.moveTo(x - ancho, y); c.lineTo(p.x, p.y); c.lineTo(m.x, m.y); c.closePath(); c.fillStyle = tono.claro; c.fill();
  c.beginPath(); c.moveTo(m.x, m.y); c.lineTo(p.x, p.y); c.lineTo(x + ancho, y); c.closePath(); c.fillStyle = tono.oscuro; c.fill();
  c.beginPath(); c.moveTo(x - ancho * 0.3, y + ancho * 0.1); c.lineTo(p.x, p.y); c.lineTo(m.x, m.y); c.closePath(); c.fillStyle = tono.base; c.fill();
  c.beginPath(); c.moveTo(x - ancho, y); c.lineTo(p.x, p.y); c.lineTo(x + ancho, y); c.lineTo(m.x, m.y); c.closePath();
  c.lineWidth = Math.max(1.2, ancho * 0.12); c.strokeStyle = tono.borde; c.stroke();
  c.restore();
}

/** Losa de piedra en 3/4 (cara de delante y tapa): base centrada en (x, y). */
function losa(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, semilla: number, tono: Tono = T_ROCA): void {
  if (h <= 1) return;
  const tapa = Math.min(h, w * 0.3), j = (i: number) => (azar(semilla * 7 + i) - 0.5) * w * 0.12;
  const a = { x: x - w / 2 + j(1), y: y - h }, b = { x: x + w / 2 + j(2), y: y - h + j(3) * 0.5 };
  c.save();
  c.lineJoin = 'round'; c.lineWidth = Math.max(1.2, w * 0.06); c.strokeStyle = tono.borde;
  c.beginPath(); c.moveTo(x - w / 2, y); c.lineTo(a.x, a.y); c.lineTo(b.x, b.y); c.lineTo(x + w / 2, y); c.closePath();
  c.fillStyle = lineal(c, x, y - h, x, y, [tono.base, tono.oscuro]); c.fill(); c.stroke();
  c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(a.x + w * 0.1, a.y - tapa); c.lineTo(b.x + w * 0.06, b.y - tapa); c.lineTo(b.x, b.y); c.closePath();
  c.fillStyle = tono.claro; c.fill(); c.stroke();
  // Una grieta en la cara.
  c.beginPath(); c.moveTo(x + j(4), y - h); c.lineTo(x + j(5) * 2, y - h * 0.6); c.lineTo(x + j(6) * 2, y - h * 0.35);
  c.globalAlpha *= 0.6; c.lineWidth *= 0.6; c.stroke();
  c.restore();
}

/** Montón de tierra removida (achatado, en el suelo). */
function monticulo(c: CanvasRenderingContext2D, x: number, y: number, r: number, tono: Tono = T_TIERRA): void {
  if (r <= 0.5) return;
  c.save();
  c.beginPath(); c.ellipse(x, y - r * 0.12, r, r * 0.42, 0, Math.PI, 0); c.lineTo(x + r, y); c.ellipse(x, y, r, r * 0.2, 0, 0, Math.PI); c.closePath();
  c.fillStyle = lineal(c, x, y - r * 0.55, x, y + r * 0.2, [tono.claro, tono.base, tono.oscuro]); c.fill();
  c.lineWidth = Math.max(1, r * 0.08); c.strokeStyle = tono.borde; c.stroke();
  c.restore();
}

/** Agujero en el suelo con su borde de tierra. */
function agujero(c: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  if (r <= 0.5) return;
  c.save();
  c.beginPath(); c.ellipse(x, y, r * 1.18, r * 0.5, 0, 0, Math.PI * 2); c.fillStyle = T_TIERRA.base; c.fill();
  c.lineWidth = Math.max(1, r * 0.07); c.strokeStyle = T_TIERRA.borde; c.stroke();
  c.beginPath(); c.ellipse(x, y + r * 0.04, r, r * 0.38, 0, 0, Math.PI * 2); c.fillStyle = lineal(c, x, y - r * 0.4, x, y + r * 0.4, ['#140a04', '#3a2210']); c.fill();
  c.restore();
}

/** Gema tallada (Joya de Luz) de color `color`, con sus facetas. */
function gema(c: CanvasRenderingContext2D, x: number, y: number, r: number, color: string, rot = 0): void {
  if (r <= 0.5) return;
  c.save();
  c.translate(x, y); c.rotate(rot); c.scale(r, r);
  const pts: [number, number][] = [[-0.5, -0.7], [0.5, -0.7], [0.92, -0.2], [0, 1], [-0.92, -0.2]];
  c.beginPath(); pts.forEach(([px, py], i) => (i ? c.lineTo(px, py) : c.moveTo(px, py))); c.closePath();
  c.fillStyle = lineal(c, -0.8, -0.8, 0.6, 1, ['#ffffff', color, color]); c.fill();
  c.lineJoin = 'round'; c.lineWidth = 0.09; c.strokeStyle = 'rgba(30, 20, 40, 0.75)'; c.stroke();
  c.beginPath();
  c.moveTo(-0.92, -0.2); c.lineTo(0.92, -0.2);
  c.moveTo(-0.5, -0.7); c.lineTo(-0.25, -0.2); c.lineTo(0, 1); c.lineTo(0.25, -0.2); c.lineTo(0.5, -0.7);
  c.lineWidth = 0.05; c.strokeStyle = 'rgba(255, 255, 255, 0.85)'; c.stroke();
  c.restore();
}

/** Engranaje de acero hueco (Giro Bola): corona dentada que deja ver al Pokémon por dentro. */
function engranaje(c: CanvasRenderingContext2D, x: number, y: number, r: number, rot: number, fase: number): void {
  if (r <= 1) return;
  const dientes = 12, hueco = r * 0.66;
  c.save();
  c.beginPath();
  for (let i = 0; i < dientes * 4; i++) {
    const a = rot + (i / (dientes * 4)) * Math.PI * 2, rr = i % 4 === 1 || i % 4 === 2 ? r : r * 0.84;
    if (i) c.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); else c.moveTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  c.closePath();
  c.moveTo(x + hueco, y); c.arc(x, y, hueco, 0, Math.PI * 2, true);
  c.fillStyle = degradadoMetal(c, x - r, y - r, x + r, y + r, fase); c.fill('evenodd');
  c.lineJoin = 'round'; c.lineWidth = Math.max(1.2, r * 0.05); c.strokeStyle = '#1c2a32'; c.stroke();
  // Remaches.
  c.fillStyle = '#2a3a44';
  for (let i = 0; i < 6; i++) { const a = rot + (i / 6) * Math.PI * 2 + 0.26; c.beginPath(); c.arc(x + Math.cos(a) * r * 0.75, y + Math.sin(a) * r * 0.75, Math.max(1, r * 0.045), 0, Math.PI * 2); c.fill(); }
  c.restore();
}

/** Herradura vista desde arriba, con la curva hacia `ang`. `huella`: marcada en el suelo (achatada y oscura). */
function herradura(c: CanvasRenderingContext2D, x: number, y: number, r: number, ang: number, huella: boolean, fase = 0.5): void {
  if (r <= 0.5) return;
  const a0 = Math.PI / 2 + 0.55, ri = r * 0.56;
  c.save();
  c.translate(x, y);
  if (huella) c.scale(1, 0.5);
  c.rotate(ang);
  c.beginPath(); c.arc(0, 0, r, -a0, a0); c.arc(0, 0, ri, a0, -a0, true); c.closePath();
  c.fillStyle = huella ? '#3a2410' : degradadoMetal(c, -r, -r, r, r, fase);
  c.fill();
  c.lineJoin = 'round'; c.lineWidth = Math.max(1, r * 0.08); c.strokeStyle = huella ? '#7a5228' : '#1c2a32'; c.stroke();
  // Clavos.
  c.fillStyle = huella ? '#7a5228' : '#2a3a44';
  for (let i = 0; i < 6; i++) { const a = lerp(-a0 + 0.35, a0 - 0.35, i / 5); c.beginPath(); c.arc(Math.cos(a) * (r + ri) / 2, Math.sin(a) * (r + ri) / 2, Math.max(0.8, r * 0.07), 0, Math.PI * 2); c.fill(); }
  c.restore();
}

/** Taladro de tierra que gira (las bandas en espiral corren con `giro`). */
function taladro(c: CanvasRenderingContext2D, x: number, y: number, tam: number, ang: number, giro: number): void {
  if (tam <= 1) return;
  c.save();
  c.translate(x, y); c.rotate(ang); c.scale(tam, tam);
  const cono = () => { c.beginPath(); c.moveTo(-0.8, -0.5); c.lineTo(1.05, 0); c.lineTo(-0.8, 0.5); c.closePath(); };
  cono();
  c.fillStyle = lineal(c, 0, -0.5, 0, 0.5, ['#f6dcae', '#c98a45', '#7a4a1e', '#3e2410']); c.fill();
  c.save(); cono(); c.clip();
  c.strokeStyle = 'rgba(60, 30, 10, 0.75)'; c.lineWidth = 0.1;
  for (let i = 0; i < 6; i++) { const x0 = -0.95 + (((i / 6 + giro) % 1) + 1) % 1 * 2; c.beginPath(); c.moveTo(x0 - 0.2, -0.55); c.quadraticCurveTo(x0 + 0.05, 0, x0 + 0.2, 0.55); c.stroke(); }
  c.restore();
  cono(); c.lineJoin = 'round'; c.lineWidth = 0.07; c.strokeStyle = '#2a180a'; c.stroke();
  c.beginPath(); c.rect(-1.0, -0.38, 0.2, 0.76); c.fillStyle = '#5e3a14'; c.fill(); c.stroke();
  c.restore();
}

// ---------------------------------------------------------------------------------------------
// Grietas en el suelo

/** Camino quebrado de `a` a `b` en `pasos` tramos, desviándose hasta `desvio` px a los lados. */
function trazaGrieta(a: Vec, b: Vec, pasos: number, desvio: number): Vec[] {
  const d = { x: b.x - a.x, y: b.y - a.y }, l = Math.hypot(d.x, d.y) || 1, n = { x: -d.y / l, y: d.x / l };
  const pts: Vec[] = [a];
  for (let i = 1; i < pasos; i++) { const t = i / pasos, o = rand(-desvio, desvio); pts.push({ x: a.x + d.x * t + n.x * o, y: a.y + d.y * t + n.y * o * 0.6 }); }
  pts.push(b);
  return pts;
}
/** La parte de un camino recorrida hasta `avance` (0-1). */
function parcial(pts: Vec[], avance: number): Vec[] {
  const tot = (pts.length - 1) * Math.max(0, Math.min(1, avance)), i = Math.floor(tot), out = pts.slice(0, i + 1);
  if (i < pts.length - 1) { const f = tot - i; out.push({ x: lerp(pts[i].x, pts[i + 1].x, f), y: lerp(pts[i].y, pts[i + 1].y, f) }); }
  return out;
}
/** Pinta una grieta: labio claro, raja oscura y, si se da, un brillo dentro (lava, energía). */
function pintaGrieta(c: CanvasRenderingContext2D, pts: Vec[], ancho: number, brillo?: string): void {
  if (pts.length < 2) return;
  const camino = (dy: number) => { c.beginPath(); c.moveTo(pts[0].x, pts[0].y + dy); for (let i = 1; i < pts.length; i++) c.lineTo(pts[i].x, pts[i].y + dy); };
  c.save();
  c.lineJoin = 'round'; c.lineCap = 'round';
  camino(ancho * 0.45); c.strokeStyle = 'rgba(240, 214, 160, 0.55)'; c.lineWidth = ancho * 1.25; c.stroke();
  camino(0); c.strokeStyle = '#24140a'; c.lineWidth = ancho; c.stroke();
  if (brillo) { camino(0); c.strokeStyle = brillo; c.lineWidth = ancho * 0.45; c.shadowColor = brillo; c.shadowBlur = ancho * 2; c.stroke(); }
  c.restore();
}

// ---------------------------------------------------------------------------------------------
// Partículas y gestos comunes

/** Polvo que se levanta del suelo en `p`. */
function polvo(k: Kit, p: Vec, n: number, tam: number, color = TIERRA.glow, alpha = 0.4, delay = 0): void {
  k.burst(n, () => ({
    x: p.x + rand(-tam, tam), y: p.y + rand(-tam * 0.25, tam * 0.25), vx: rand(-1, 1) * tam * 2.4, vy: -rand(0.3, 1.2) * tam,
    drag: 2.2, life: rand(450, 750), delay, size: tam * rand(0.35, 0.6), sizeEnd: tam * rand(0.8, 1.15), color, alpha, shape: 'smoke',
  }));
}
/** Cascotes que saltan hacia arriba y caen (gravedad). */
function cascotes(k: Kit, p: Vec, n: number, fuerza: number, tam = 3.5, tono: Tono = T_ROCA, delay = 0, empuje: Vec = { x: 0, y: 0 }): void {
  k.burst(n, () => {
    const a = rand(-Math.PI * 0.95, -Math.PI * 0.05), v = fuerza * rand(0.45, 1);
    return {
      x: p.x + rand(-4, 4), y: p.y + rand(-4, 4), vx: Math.cos(a) * v + empuje.x, vy: Math.sin(a) * v + empuje.y, ay: 950, life: rand(420, 700), delay,
      size: tam * rand(0.6, 1.3), color: pick([tono.base, tono.claro, tono.oscuro]), accent: tono.borde, shape: 'rock', rot: rand(0, 6), spin: rand(-10, 10), stretch: rand(0, 10),
    };
  });
}
/** Onda que corre por el suelo (anillo achatado). */
function ondaSuelo(k: Kit, p: Vec, r: number, color: string, ms = 380, ancho = 3, delay = 0): void {
  k.add(E.ring({ at: p, from: r * 0.12, to: r, width: ancho, color, duration: ms, squash: 0.42, delay }));
}
/** Aura de lucha: lenguas de energía que suben alrededor de un Pokémon durante `ms`. */
function aura(k: Kit, g: SlotGeometry, ms: number, pal: FxPalette = LUCHA, densidad = 0.6, delay = 0): void {
  k.dibujar(ms, () => {
    if (Math.random() > densidad) return;
    const p = k.posSprite(g), a = rand(0, Math.PI * 2);
    k.emit({ x: p.x + Math.cos(a) * g.size * 0.42, y: p.y + g.size * 0.3 + Math.sin(a) * g.size * 0.12, vx: rand(-10, 10), vy: -rand(90, 180), life: rand(260, 420), size: rand(1.6, 2.8), color: pick([pal.core, pal.glow, pal.hot]), shape: 'streak', stretch: 50 });
  }, { delay });
}
/** Punto del suelo entre los pies del usuario (t = 0) y los del objetivo (t = 1); `lado` px a la perpendicular. */
function suelo(k: Kit, t: number, lado = 0): Vec {
  const a = k.user.feet, b = k.hayObjetivo ? k.target.feet : { x: a.x + k.dir.x * k.dist, y: a.y + k.dir.y * k.dist };
  return { x: lerp(a.x, b.x, t) + k.perp.x * lado, y: lerp(a.y, b.y, t) + k.perp.y * lado * 0.55 };
}
/** Golpecito de luz y chispas (para los golpes de un multigolpe que no son el impacto). */
function chispazo(k: Kit, p: Vec, pal: FxPalette, tam: number, delay = 0, n = 6): void {
  k.add(E.ring({ at: p, from: 3, to: tam, width: 2.5, color: pal.hot, duration: 200, delay }));
  k.burst(n, () => {
    const a = rand(0, Math.PI * 2), v = rand(120, 240);
    return { x: p.x, y: p.y, vx: Math.cos(a) * v + k.dir.x * 80, vy: Math.sin(a) * v + k.dir.y * 80, drag: 3, life: 220, delay, size: rand(1.5, 2.6), color: pick([pal.glow, pal.hot]), shape: 'streak', stretch: 24 };
  });
}

interface Lanza {
  ms: number;
  tam: (t: number) => number;
  estilo: (t: number) => EstiloForma;
  desde?: number;
  hasta?: number;
  lado?: number;
  espejo?: boolean;
  angulo?: number;
  ease?: (t: number) => number;
  /** Lo que se pinta o emite en cada fotograma, antes de la forma. */
  cada?: (p: Vec, t: number, r: number, c: CanvasRenderingContext2D, engine: FxEngine) => void;
  /** Cuánto se queda clavada al llegar (ms) y cuánto crece mientras se desvanece. */
  queda?: number;
  crece?: number;
}
/** Una forma (puño, palma, pie…) que vuela del usuario al objetivo; al llegar se queda clavada un instante. */
async function lanzaForma(k: Kit, nombre: NombreForma, o: Lanza): Promise<Vec> {
  const desde = o.desde ?? 0.15, hasta = o.hasta ?? 0.85, lado = o.lado ?? 0, ang = o.angulo ?? k.angle, ease = o.ease ?? ((t: number) => t);
  let fin = k.punto(hasta);
  k.dibujar(o.ms, (c, t, engine) => {
    const u = ease(t), p = k.punto(lerp(desde, hasta, u), lado * (1 - u)), r = o.tam(u);
    fin = p;
    o.cada?.(p, u, r, c, engine);
    forma(c, nombre, p.x, p.y, r, ang, o.estilo(u), o.espejo);
  }, { z: 1 });
  await k.esperar(o.ms);
  const queda = o.queda ?? 160, crece = o.crece ?? 0.25, r1 = o.tam(1), p1 = fin;
  if (queda > 0) k.dibujar(queda, (c, t) => { c.globalAlpha = 1 - easeIn(t); forma(c, nombre, p1.x, p1.y, r1 * (1 + crece * easeOut(t)), ang, o.estilo(1), o.espejo); }, { z: 1 });
  return p1;
}
/** Líneas de velocidad detrás de algo que vuela hacia el objetivo. */
function estela(k: Kit, p: Vec, r: number, color: string, prob = 0.8): void {
  if (Math.random() > prob) return;
  const l = rand(-r * 0.5, r * 0.5);
  k.emit({ x: p.x - k.dir.x * r * 0.6 + k.perp.x * l, y: p.y - k.dir.y * r * 0.6 + k.perp.y * l, vx: -k.dir.x * 260, vy: -k.dir.y * 260, drag: 4, life: 180, size: rand(1.4, 2.4), color, shape: 'streak', stretch: 40 });
}

export const FIRMAS: Record<string, Firma> = {
  // ===========================================================================================
  // LUCHA

  // Empujón (15): palmas abiertas que golpean muy deprisa alternando de lado, cada una con un chasquido de luz.
  async armthrust(k) {
    const golpes = Math.min(5, Math.max(3, k.ctx.cue.hitCount)), cada = 90, ms = 100, r = k.s(0.2);
    const fr: Keyframe[] = [{ transform: 'translate(0px, 0px)' }];
    for (let i = 0; i < golpes; i++) fr.push({ transform: `translate(${k.dir.x * 7}px, ${k.dir.y * 7}px)` }, { transform: 'translate(0px, 0px)' });
    void k.animar(k.user.sprite, fr, golpes * cada + 60, 'linear');
    for (let i = 0; i < golpes; i++) {
      const lado = (i % 2 ? -1 : 1) * k.s(0.2), d = i * cada;
      k.dibujar(ms + 70, (c, t) => {
        const tt = t * (ms + 70) / ms, u = Math.min(1, tt), p = k.punto(lerp(0.45, 0.86, easeOut(u)), lado);
        c.globalAlpha = tt < 1 ? 1 : 1 - (tt - 1) / 0.7;
        forma(c, 'mano', p.x, p.y, r * (1 + Math.max(0, tt - 1) * 0.5), k.angle, estiloPiel(5), i % 2 === 1);
      }, { z: 1, delay: d });
      if (i > 0) chispazo(k, k.punto(0.86, lado), LUCHA, k.s(0.3), d + ms, 5);
    }
    await k.esperar(ms);
    await k.impacto(t => chispazo(k, k.punto(0.86, k.s(0.2)), LUCHA, t.size * 0.35, 0, 6));
    await k.esperar((golpes - 1) * cada + 40);
    await k.despues();
  },

  // Esfera Aural (80): el usuario reúne aura azul en una esfera que crece entre lenguas en espiral; sale disparada
  // con una estela ondulante y estalla en un fogonazo azul.
  async aurasphere(k) {
    const boca = () => { const u = k.posSprite(k.user); return { x: u.x + k.dir.x * k.user.size * 0.5, y: u.y + k.dir.y * k.user.size * 0.5 }; };
    const R = k.s(0.26), carga = 260;
    const esfera = (c: CanvasRenderingContext2D, engine: FxEngine, p: Vec, r: number, giro: number) => {
      luz(c, engine, p, r * 2.6, AURA.glow, 0.8);
      c.save();
      const g = c.createRadialGradient(p.x - r * 0.25, p.y - r * 0.25, r * 0.1, p.x, p.y, r);
      g.addColorStop(0, '#ffffff'); g.addColorStop(0.45, AURA.glow); g.addColorStop(0.85, AURA.core); g.addColorStop(1, AURA.dark);
      c.fillStyle = g; c.beginPath(); c.arc(p.x, p.y, r, 0, Math.PI * 2); c.fill();
      // Lenguas de aura que giran por fuera.
      c.lineCap = 'round'; c.strokeStyle = AURA.hot; c.lineWidth = Math.max(1.2, r * 0.12);
      for (let i = 0; i < 3; i++) { const a = giro + (i * Math.PI * 2) / 3; c.beginPath(); c.arc(p.x, p.y, r * 1.25, a, a + 1.1); c.stroke(); }
      c.restore();
    };
    void k.anticipar(80);
    k.dibujar(carga, (c, t, engine) => {
      const p = boca();
      esfera(c, engine, p, R * easeOut(t), t * 9);
      if (Math.random() < 0.7) { const a = rand(0, Math.PI * 2), d = k.user.size * rand(0.6, 0.9); k.emit({ x: p.x + Math.cos(a) * d, y: p.y + Math.sin(a) * d, vx: -Math.cos(a) * d * 4 - Math.sin(a) * 120, vy: -Math.sin(a) * d * 4 + Math.cos(a) * 120, drag: 3, life: 240, size: rand(1.5, 2.6), color: pick([AURA.glow, AURA.hot]), shape: 'streak', stretch: 40 }); }
    }, { z: 1 });
    await k.esperar(carga);
    void k.recuperar({ x: -k.dir.x * 8, y: -k.dir.y * 8 }, 200);
    const fin = k.acierta ? k.target.center : k.punto(1.5, k.s(0.4));
    const ini = boca(), viaje = 240;
    k.dibujar(viaje, (c, t, engine) => {
      const u = easeIn(t * 0.6 + t * 0.4), p = { x: lerp(ini.x, fin.x, u) + k.perp.x * Math.sin(t * 12) * k.s(0.05), y: lerp(ini.y, fin.y, u) + k.perp.y * Math.sin(t * 12) * k.s(0.05) };
      esfera(c, engine, p, R, 9 + t * 14);
      for (let i = 0; i < 2; i++) k.emit({ x: p.x + rand(-R, R) * 0.6, y: p.y + rand(-R, R) * 0.6, vx: -k.dir.x * 60 + rand(-30, 30), vy: -k.dir.y * 60 + rand(-30, 30), life: 300, size: R * rand(0.35, 0.6), sizeEnd: 0, color: pick([AURA.core, AURA.glow]), shape: 'glow' });
    }, { z: 1 });
    await k.esperar(viaje);
    await k.impacto(t => {
      k.add(E.bloom({ at: t.center, radius: t.size * 1.1, color: AURA.glow, duration: 360 }));
      k.add(E.starburst({ at: t.center, rays: 10, length: t.size * 0.9, width: 4, palette: AURA, duration: 300 }));
      k.add(E.ring({ at: t.center, from: 6, to: t.size * 1.1, width: 5, color: AURA.glow, duration: 360 }));
      k.add(E.ring({ at: t.center, from: 4, to: t.size * 0.7, width: 3, color: AURA.hot, duration: 260, delay: 60 }));
      E.sparks(k.fx, t.center, { count: 22, speed: [160, 380], palette: AURA, shape: 'glow', size: [2, 4] });
    });
    await k.esperar(120);
    await k.despues();
  },

  // Corpulencia: dos puños se alzan a los lados del usuario y bombean dos veces mientras el cuerpo se hincha; un aura
  // naranja sube y cada bombeo suelta un anillo.
  async bulkup(k) {
    const g = k.user, ms = 640, r = g.size * 0.26;
    aura(k, g, ms, LUCHA, 0.7);
    void k.animar(g.sprite, [
      { transform: 'translate(0px, 0px) scale(1, 1)' },
      { transform: 'translate(0px, 0px) scale(1.14, 0.93)', offset: 0.25 },
      { transform: 'translate(0px, 0px) scale(1.02, 1)', offset: 0.45 },
      { transform: 'translate(0px, 0px) scale(1.2, 0.9)', offset: 0.72 },
      { transform: 'translate(0px, 0px) scale(1, 1)' },
    ], ms);
    k.dibujar(ms, (c, t) => {
      const p = k.posSprite(g), bombeo = Math.max(0, Math.sin(t * Math.PI * 2 * 1.05)), entra = Math.min(1, t * 6), sale = t > 0.85 ? (1 - t) / 0.15 : 1;
      c.globalAlpha = entra * sale;
      for (const s of [-1, 1]) {
        const x = p.x + s * g.size * (0.55 + 0.08 * bombeo), y = p.y - g.size * (0.15 + 0.12 * bombeo);
        forma(c, 'puno', x, y, r * (1 + 0.22 * bombeo), -Math.PI / 2, estiloLucha(6 + 6 * bombeo), s < 0);
      }
    }, { z: 1 });
    for (const d of [140, 470]) {
      k.add(E.ring({ at: g.center, from: g.size * 0.3, to: g.size * 1.0, width: 3.5, color: LUCHA.glow, duration: 320, delay: d }));
      k.burst(8, i => ({ x: g.center.x + Math.cos(i * 0.785) * g.size * 0.4, y: g.center.y + Math.sin(i * 0.785) * g.size * 0.3, vx: Math.cos(i * 0.785) * 160, vy: Math.sin(i * 0.785) * 120 - 40, drag: 3, life: 300, delay: d, size: rand(2, 3), color: LUCHA.hot, shape: 'streak', stretch: 30 }));
    }
    await k.esperar(ms - 120);
    await k.estado();
  },

  // A Bocajarro (120): el usuario se planta delante y suelta una ráfaga de diez puños y patadas por todo el objetivo
  // con la vista oscurecida; remata con un puño enorme.
  async closecombat(k) {
    k.add(E.dim({ at: k.target.center, duration: 1150, strength: 0.42 }));
    await k.anticipar(90);
    const lejos = Math.max(0, k.dist - k.target.size * 0.55) * 0.6, v = { x: k.dir.x * lejos, y: k.dir.y * lejos };
    const fr: Keyframe[] = [{ transform: 'translate(0px, 0px) scale(1, 1)' }, { transform: `translate(${v.x}px, ${v.y}px) scale(1.08, 0.94)`, offset: 0.12 }];
    for (let i = 1; i <= 6; i++) { const e = i % 2 ? 6 : -3; fr.push({ transform: `translate(${v.x + k.dir.x * e}px, ${v.y + k.dir.y * e}px) scale(${i % 2 ? 1.1 : 1.02}, ${i % 2 ? 0.92 : 1})`, offset: 0.12 + i * 0.11 }); }
    fr.push({ transform: `translate(${v.x}px, ${v.y}px) scale(1, 1)`, offset: 0.85 }, { transform: 'translate(0px, 0px) scale(1, 1)' });
    void k.animar(k.user.sprite, fr, 1100, 'linear');
    const golpes = 10, cada = 55, vida = 120;
    for (let i = 0; i < golpes; i++) {
      const pie = i % 3 === 2, lado = rand(-1, 1) * k.s(0.42), hasta = rand(0.8, 0.96), r = k.s(rand(0.16, 0.24)), d = 80 + i * cada;
      k.dibujar(vida, (c, t) => {
        const u = Math.min(1, t / 0.55), p = k.punto(lerp(hasta - 0.3, hasta, easeOut(u)), lado);
        c.globalAlpha = t < 0.55 ? 1 : 1 - (t - 0.55) / 0.45;
        forma(c, pie ? 'pie' : 'puno', p.x, p.y, r * (1 + Math.max(0, t - 0.55)), k.angle, pie ? estiloPiel(6) : estiloLucha(6), lado < 0);
      }, { z: 1, delay: d });
      chispazo(k, k.punto(hasta, lado), LUCHA, k.s(0.3), d + vida * 0.55, 4);
    }
    await k.esperar(80 + golpes * cada - 40);
    await lanzaForma(k, 'puno', {
      ms: 110, desde: 0.4, hasta: 0.84, tam: t => k.s(0.3 + 0.22 * t), estilo: () => estiloLucha(18, '#ffd08a'), queda: 240, crece: 0.4,
      cada: (p, _t, r) => { estela(k, p, r, LUCHA.hot); estela(k, p, r, LUCHA.glow); },
    });
    await k.impacto(t => {
      k.add(E.flash({ color: LUCHA.hot, alpha: 0.3, duration: 200 }));
      k.add(E.starburst({ at: t.center, rays: 12, length: t.size * 1.2, width: 6, palette: LUCHA, duration: 340 }));
      for (let i = 0; i < 3; i++) k.add(E.ring({ at: t.center, from: 6, to: t.size * (0.9 + i * 0.35), width: 5 - i, color: i ? LUCHA.glow : LUCHA.hot, duration: 380, delay: i * 70 }));
      E.sparks(k.fx, t.center, { count: 26, speed: [220, 520], palette: LUCHA, shape: 'streak' });
    });
    await k.esperar(260);
    await k.despues();
  },

  // Contraataque: un escudo curvo y rojo encaja el golpe delante del usuario (destello), y la fuerza vuelve como un
  // puño rojo que sale disparado contra el agresor.
  async counter(k) {
    const ms = 260;
    k.dibujar(ms + 120, (c, t, engine) => {
      const u = k.posSprite(k.user), p = { x: u.x + k.dir.x * k.user.size * 0.55, y: u.y + k.dir.y * k.user.size * 0.55 };
      const ms2 = t * (ms + 120), abre = easeOutCubic(Math.min(1, ms2 / 120)), sale = ms2 > ms ? 1 - (ms2 - ms) / 120 : 1, golpe = ms2 > 150 && ms2 < 230;
      c.save();
      c.globalAlpha = sale;
      c.lineCap = 'round';
      c.strokeStyle = IRA.core; c.lineWidth = k.user.size * 0.16; c.shadowColor = IRA.core; c.shadowBlur = golpe ? 20 : 10;
      c.beginPath(); c.arc(u.x, u.y, k.user.size * 0.6, k.angle - 1.05 * abre, k.angle + 1.05 * abre); c.stroke();
      c.shadowBlur = 0; c.strokeStyle = IRA.hot; c.lineWidth = k.user.size * 0.05;
      c.beginPath(); c.arc(u.x, u.y, k.user.size * 0.6, k.angle - 1.0 * abre, k.angle + 1.0 * abre); c.stroke();
      c.restore();
      if (golpe) luz(c, engine, p, k.user.size * 0.7, IRA.glow, 0.9);
    }, { z: 1 });
    // El golpe encajado: chispas que se estrellan contra el escudo.
    const p = k.punto(0, k.user.size * 0.1);
    k.burst(10, () => ({ x: p.x + k.dir.x * k.user.size * 1.3, y: p.y + k.dir.y * k.user.size * 1.3, vx: -k.dir.x * 520 + rand(-80, 80), vy: -k.dir.y * 520 + rand(-80, 80), life: 150, delay: 30, size: rand(1.5, 2.5), color: IRA.hot, shape: 'streak', stretch: 30 }));
    await k.esperar(150);
    k.destello(k.user.sprite, 140);
    k.add(E.ring({ at: k.punto(0.12), from: 4, to: k.user.size * 0.8, width: 4, color: IRA.glow, duration: 240 }));
    await k.esperar(90);
    void k.embestida({ hasta: 0.35, ida: 120, vuelta: 240 });
    await lanzaForma(k, 'puno', { ms: 170, desde: 0.2, hasta: 0.84, tam: t => k.s(0.24 + 0.12 * t), estilo: () => estiloIra(12), cada: (q, _t, r) => estela(k, q, r, IRA.glow) });
    await k.impacto(t => {
      k.add(E.starburst({ at: t.center, rays: 9, length: t.size * 0.8, width: 4, palette: IRA, duration: 280 }));
      k.add(E.ring({ at: t.center, from: 6, to: t.size * 0.85, width: 4, color: IRA.glow, duration: 300 }));
      E.sparks(k.fx, t.center, { count: 16, speed: [180, 380], palette: IRA, shape: 'streak' });
    });
    await k.despues();
  },

  // Tajo Cruzado (100): dos manos de canto bajan cruzándose en X sobre el objetivo, cada una dejando un tajo de luz;
  // la X queda ardiendo un instante.
  async crosschop(k) {
    await k.anticipar(90);
    void k.embestida({ hasta: 0.5, ida: 140, vuelta: 320 });
    const c0 = k.target.center, L = k.s(0.75), ms = 140, entre = 120;
    const tajos = [-Math.PI / 4 + 0.15, Math.PI / 4 - 0.15].map(a => ({ a, u: { x: Math.cos(a + Math.PI / 2), y: Math.sin(a + Math.PI / 2) } }));
    const extremos = tajos.map(({ u }) => ({ ini: { x: c0.x - u.x * L, y: c0.y - u.y * L }, fin: { x: c0.x + u.x * L, y: c0.y + u.y * L } }));
    const pintaTajo = (c: CanvasRenderingContext2D, a: Vec, b: Vec, ancho: number, alpha: number) => {
      const d = { x: b.x - a.x, y: b.y - a.y }, l = Math.hypot(d.x, d.y) || 1, n = { x: -d.y / l, y: d.x / l };
      c.save();
      c.globalAlpha = alpha;
      for (const [col, w] of [[LUCHA.core, ancho], [LUCHA.hot, ancho * 0.45]] as const) {
        c.beginPath(); c.moveTo(a.x, a.y); c.lineTo((a.x + b.x) / 2 + n.x * w, (a.y + b.y) / 2 + n.y * w); c.lineTo(b.x, b.y); c.lineTo((a.x + b.x) / 2 - n.x * w * 0.4, (a.y + b.y) / 2 - n.y * w * 0.4); c.closePath();
        c.fillStyle = col; c.fill();
      }
      c.restore();
    };
    extremos.forEach(({ ini, fin }, i) => {
      k.dibujar(ms, (c, t) => {
        const u = easeIn(t), cab = { x: lerp(ini.x, fin.x, u), y: lerp(ini.y, fin.y, u) };
        pintaTajo(c, ini, cab, k.s(0.09), 1);
        forma(c, 'mano', cab.x, cab.y, k.s(0.26), Math.atan2(fin.y - ini.y, fin.x - ini.x), estiloLucha(10), i === 1);
      }, { z: 1, delay: 60 + i * entre });
      k.dibujar(420, (c, t) => pintaTajo(c, ini, fin, k.s(0.09) * (1 + t * 0.3), 1 - easeIn(t)), { z: 1, delay: 60 + i * entre + ms });
    });
    k.add(E.ring({ at: c0, from: 4, to: k.s(0.6), width: 3, color: LUCHA.glow, duration: 220, delay: 60 + ms }));
    await k.esperar(60 + entre + ms);
    await k.impacto(t => {
      k.add(E.bloom({ at: t.center, radius: t.size * 0.9, color: LUCHA.glow, duration: 360 }));
      E.sparks(k.fx, t.center, { count: 22, speed: [200, 460], palette: LUCHA, shape: 'streak' });
    });
    await k.esperar(200);
    await k.despues();
  },

  // Detección: un ojo se abre sobre el usuario, destella al fijar la mirada y salta a su alrededor un escudo naranja.
  async detect(k) {
    const g = k.user, ms = 520;
    k.dibujar(ms, (c, t) => {
      const p = k.posSprite(g), abre = t < 0.3 ? easeOut(t / 0.3) : t > 0.8 ? 1 - (t - 0.8) / 0.2 : 1;
      c.save();
      c.translate(p.x, p.y - g.size * 0.72);
      c.scale(1, Math.max(0.05, abre));
      c.globalAlpha = Math.min(1, t * 5);
      forma(c, 'ojo', 0, 0, g.size * 0.34, 0, { base: LUCHA.core, borde: '#3a1404', brillo: LUCHA.glow, brilloTam: 12 });
      c.restore();
    }, { z: 1 });
    const brillo = { x: g.center.x + g.size * 0.08, y: g.center.y - g.size * 0.78 };
    k.emit({ x: brillo.x, y: brillo.y, life: 260, delay: 170, size: g.size * 0.25, sizeEnd: 2, color: '#ffffff', shape: 'star', spin: 6 });
    k.add(E.shield({ at: g.center, rx: g.size * 0.75, ry: g.size * 0.7, palette: LUCHA, duration: 380, delay: 200 }));
    k.add(E.ring({ at: g.center, from: g.size * 0.3, to: g.size * 1.0, width: 3, color: LUCHA.hot, duration: 260, delay: 200 }));
    await k.esperar(300);
    await k.estado();
    await k.esperar(120);
  },

  // Doble Patada (30): dos pies, uno por cada lado, golpean en rápida sucesión.
  async doublekick(k) {
    await k.anticipar(60);
    const ms = 130, entre = 170;
    void k.animar(k.user.sprite, [
      { transform: 'translate(0px, 0px)' }, { transform: `translate(${k.dir.x * 10}px, ${k.dir.y * 10}px)`, offset: 0.25 },
      { transform: 'translate(0px, 0px)', offset: 0.5 }, { transform: `translate(${k.dir.x * 10}px, ${k.dir.y * 10}px)`, offset: 0.75 }, { transform: 'translate(0px, 0px)' },
    ], ms * 2 + entre);
    for (let i = 0; i < 2; i++) {
      const lado = (i ? -1 : 1) * k.s(0.18);
      k.dibujar(ms + 90, (c, t) => {
        const tt = t * (ms + 90) / ms, p = k.punto(lerp(0.45, 0.84, easeOut(Math.min(1, tt))), lado * (1 - Math.min(1, tt) * 0.5));
        c.globalAlpha = tt < 1 ? 1 : 1 - (tt - 1) / 0.69;
        forma(c, 'pie', p.x, p.y, k.s(0.24) * (1 + Math.max(0, tt - 1) * 0.4), k.angle, estiloPiel(6), i === 1);
      }, { z: 1, delay: i * entre });
    }
    chispazo(k, k.punto(0.84, -k.s(0.09)), LUCHA, k.s(0.4), entre + ms, 7);
    await k.esperar(ms);
    await k.impacto(t => chispazo(k, k.punto(0.84, k.s(0.09)), LUCHA, t.size * 0.4, 0, 7));
    await k.esperar(entre);
    await k.despues();
  },

  // Puño Dinámico (100): un puño enorme rodeado de un aura en estrella que vibra; al golpear, una explosión naranja
  // con humo y estrellitas de confusión girando sobre el objetivo.
  async dynamicpunch(k) {
    await k.anticipar(110);
    void k.embestida({ hasta: 0.3, ida: 110, vuelta: 280 });
    await lanzaForma(k, 'puno', {
      ms: 240, desde: 0.18, hasta: 0.82, tam: t => k.s(0.3 + 0.18 * t), estilo: () => estiloLucha(14, '#ff5a1a'), queda: 180, crece: 0.45,
      cada: (p, t, r, c, engine) => {
        luz(c, engine, p, r * 2.2, LUCHA.core, 0.6);
        c.save(); c.strokeStyle = LUCHA.hot; c.lineWidth = Math.max(1.5, r * 0.08); c.lineCap = 'round';
        for (let i = 0; i < 8; i++) { const a = i * 0.785 + t * 6, r0 = r * 1.15, r1 = r * (1.45 + 0.2 * Math.sin(t * 40 + i)); c.beginPath(); c.moveTo(p.x + Math.cos(a) * r0, p.y + Math.sin(a) * r0); c.lineTo(p.x + Math.cos(a) * r1, p.y + Math.sin(a) * r1); c.stroke(); }
        c.restore();
        estela(k, p, r, LUCHA.glow, 0.6);
      },
    });
    await k.impacto(t => {
      E.fireBurst(k.stage, t.center, LUCHA, t.size * 1.2);
      k.add(E.flash({ color: LUCHA.glow, alpha: 0.22, duration: 180 }));
      for (let i = 0; i < 3; i++) k.add(E.ring({ at: t.center, from: 6, to: t.size * (0.9 + i * 0.3), width: 5 - i, color: i ? LUCHA.glow : LUCHA.hot, duration: 360, delay: i * 60 }));
      // Estrellitas de confusión sobre la cabeza.
      const cab = t.top;
      k.dibujar(560, (c, tt) => {
        for (let i = 0; i < 3; i++) {
          const a = tt * 9 + (i * Math.PI * 2) / 3, p = { x: cab.x + Math.cos(a) * t.size * 0.3, y: cab.y + Math.sin(a) * t.size * 0.1 };
          c.globalAlpha = Math.min(1, tt * 6) * (1 - easeIn(tt));
          forma(c, 'estrella', p.x, p.y, t.size * 0.08, a, { base: '#ffe25a', borde: '#8a5a00' });
        }
      }, { z: 1, delay: 140 });
    });
    await k.esperar(220);
    await k.despues();
  },

  // Puño Certero (150): concentración con la vista a oscuras: un puño blanco se forma y tiembla delante del usuario
  // mientras la luz se le mete dentro; sale en un parpadeo y el impacto lo sacude todo.
  async focuspunch(k) {
    const foco = 560, g = k.user;
    k.add(E.dim({ at: g.center, duration: foco + 500, strength: 0.55 }));
    void k.agitar(g.sprite, 1.5, foco);
    const sitio = () => { const u = k.posSprite(g); return { x: u.x + k.dir.x * g.size * 0.6, y: u.y + k.dir.y * g.size * 0.6 }; };
    k.dibujar(foco, (c, t, engine) => {
      const p = sitio(), r = k.s(0.32) * easeOut(Math.min(1, t * 1.6)), tiembla = { x: rand(-1.5, 1.5) * t, y: rand(-1.5, 1.5) * t };
      luz(c, engine, p, r * 2.5 * (0.8 + 0.2 * Math.sin(t * 30)), LUCHA.glow, 0.5 + 0.4 * t);
      forma(c, 'puno', p.x + tiembla.x, p.y + tiembla.y, r, k.angle, { ...estiloLucha(10 + 14 * t, '#ffffff'), base: cc => lineal(cc, -1, 0, 0.8, 0, ['#ff8a2a', '#ffd8a0', '#ffffff']) });
      c.save(); c.globalAlpha = 0.6; c.strokeStyle = '#ffffff'; c.lineWidth = 2;
      c.beginPath(); c.arc(p.x, p.y, r * (2.4 - 1.4 * ((t * 3) % 1)), 0, Math.PI * 2); c.stroke(); c.restore();
      if (Math.random() < 0.8) { const a = rand(0, Math.PI * 2), d = g.size * rand(0.9, 1.4); k.emit({ x: p.x + Math.cos(a) * d, y: p.y + Math.sin(a) * d, vx: -Math.cos(a) * d * 5, vy: -Math.sin(a) * d * 5, drag: 4, life: 200, size: rand(1.5, 2.5), color: pick(['#ffffff', LUCHA.glow]), shape: 'streak', stretch: 40 }); }
    }, { z: 1 });
    await k.esperar(foco);
    void k.embestida({ hasta: 0.55, ida: 110, vuelta: 320, estela: '#ffffff' });
    await lanzaForma(k, 'puno', {
      ms: 120, desde: 0.25, hasta: 0.84, tam: t => k.s(0.36 + 0.24 * t), queda: 260, crece: 0.5,
      estilo: () => ({ ...estiloLucha(22, '#ffffff'), base: cc => lineal(cc, -1, 0, 0.8, 0, ['#ff7a1a', '#ffd8a0', '#ffffff']) }),
      cada: (p, _t, r) => { for (let i = 0; i < 3; i++) estela(k, p, r, i ? LUCHA.glow : '#ffffff', 1); },
    });
    await k.impacto(t => {
      k.add(E.flash({ color: '#ffffff', alpha: 0.4, duration: 220 }));
      k.add(E.starburst({ at: t.center, rays: 14, length: t.size * 1.5, width: 7, palette: LUCHA, duration: 380 }));
      k.add(E.bloom({ at: t.center, radius: t.size * 1.4, color: '#ffffff', duration: 320 }));
      for (let i = 0; i < 4; i++) k.add(E.ring({ at: t.center, from: 8, to: t.size * (1 + i * 0.45), width: 6 - i, color: i % 2 ? LUCHA.glow : '#ffffff', duration: 440, delay: i * 70 }));
      E.sparks(k.fx, t.center, { count: 34, speed: [260, 620], palette: LUCHA, shape: 'streak', spread: [k.angle - 1.2, k.angle + 1.2] });
      ondaSuelo(k, t.feet, t.size * 1.6, LUCHA.glow, 460, 4);
    });
    await k.esperar(300);
    await k.despues();
  },

  // Palmeo (60): una palma abierta empuja al objetivo; de ella salen ondas de presión que lo atraviesan.
  async forcepalm(k) {
    await k.anticipar(80);
    void k.embestida({ hasta: 0.45, ida: 140, vuelta: 260 });
    const fin = await lanzaForma(k, 'mano', { ms: 170, desde: 0.3, hasta: 0.8, tam: t => k.s(0.26 + 0.08 * t), estilo: () => estiloPiel(10), queda: 260, crece: 0.15 });
    await k.impacto(t => {
      for (let i = 0; i < 3; i++) k.add(E.ring({ at: fin, from: 4, to: t.size * (0.5 + i * 0.25), width: 3, color: i ? LUCHA.glow : LUCHA.hot, duration: 300, delay: i * 70 }));
      // La presión sale por detrás del objetivo: arcos que avanzan en la dirección del golpe.
      k.dibujar(380, (c, tt) => {
        c.save(); c.lineCap = 'round';
        for (let i = 0; i < 3; i++) {
          const u = Math.max(0, tt * 1.4 - i * 0.18); if (u <= 0 || u >= 1) continue;
          const d = t.size * (0.3 + 0.9 * u), p = { x: t.center.x + k.dir.x * d, y: t.center.y + k.dir.y * d };
          c.globalAlpha = 1 - u; c.strokeStyle = LUCHA.glow; c.lineWidth = 3;
          c.beginPath(); c.arc(p.x - k.dir.x * t.size * 0.5, p.y - k.dir.y * t.size * 0.5, t.size * 0.5, k.angle - 0.7, k.angle + 0.7); c.stroke();
        }
        c.restore();
      }, { z: 1 });
      E.sparks(k.fx, t.center, { count: 8, speed: [80, 200], palette: TYPE_FX.Electric, shape: 'star', size: [2, 3.5] });
    });
    await k.esperar(140);
    await k.despues();
  },

  // Machada (100): un puño enorme sube por encima del objetivo, tiembla un instante y cae como un martillo:
  // el suelo se agrieta bajo él con polvo y cascotes.
  async hammerarm(k) {
    await k.anticipar(80);
    void k.recuperar({ x: -k.dir.x * 8, y: -k.dir.y * 8 }, 220);
    const t0 = k.target.center, alto = k.s(1.25), r = k.s(0.42);
    const arriba = { x: t0.x - k.dir.x * k.s(0.1), y: t0.y - alto }, abajo = { x: t0.x, y: t0.y - k.s(0.12) };
    const sube = 200, quieto = 70, cae = 110;
    const ini = k.punto(0.1);
    k.dibujar(sube + quieto + cae, (c, t, engine) => {
      const ms = t * (sube + quieto + cae);
      let p: Vec;
      if (ms < sube) { const u = easeOut(ms / sube); p = { x: lerp(ini.x, arriba.x, u), y: lerp(ini.y, arriba.y, u) - Math.sin(Math.PI * u) * k.s(0.3) }; }
      else if (ms < sube + quieto) p = { x: arriba.x + rand(-1.5, 1.5), y: arriba.y + rand(-1.5, 1.5) };
      else {
        const u = easeIn((ms - sube - quieto) / cae);
        p = { x: lerp(arriba.x, abajo.x, u), y: lerp(arriba.y, abajo.y, u) };
        for (let i = 0; i < 2; i++) k.emit({ x: p.x + rand(-r, r) * 0.6, y: p.y - r, vy: -300, life: 120, size: 2, color: LUCHA.glow, shape: 'streak', stretch: 50 });
      }
      luz(c, engine, p, r * 1.8, LUCHA.core, 0.4);
      forma(c, 'puno', p.x, p.y, r * (0.6 + 0.4 * Math.min(1, ms / sube)), Math.PI / 2, estiloLucha(10, '#c25a1a'), k.dir.x < 0);
    }, { z: 1 });
    await k.esperar(sube + quieto + cae);
    k.dibujar(200, (c, t) => { c.globalAlpha = 1 - t; c.translate(abajo.x, abajo.y); c.scale(1.15, 0.85); forma(c, 'puno', 0, 0, r, Math.PI / 2, estiloLucha(10, '#c25a1a'), k.dir.x < 0); }, { z: 1 });
    await k.impacto(t => {
      const pies = t.feet;
      k.add(E.cracks({ at: pies, length: t.size * 0.9, color: '#2a1808', duration: 700 }));
      ondaSuelo(k, pies, t.size * 1.3, LUCHA.glow, 420, 4);
      polvo(k, pies, 10, t.size * 0.3);
      cascotes(k, pies, 12, 320, 3.5, T_TIERRA);
      void k.stage.shake(6, 260);
    });
    await k.esperar(160);
    await k.despues();
  },

  // Patada Salto Alta (130): el usuario salta muy alto, casi fuera de la vista, y cae en picado con un pie envuelto
  // en una estela naranja; el golpe estalla en luz.
  async highjumpkick(k) {
    const g = k.user, H = Math.max(k.s(1.6), g.size * 1.7);
    await k.anticipar(100);
    polvo(k, g.feet, 8, g.size * 0.25);
    ondaSuelo(k, g.feet, g.size * 0.8, LUCHA.glow, 300);
    await k.animar(g.sprite, [{ transform: 'translate(0px, 0px) scale(1, 1)' }, { transform: `translate(${-k.dir.x * 10}px, ${-H}px) scale(0.9, 1.12)` }], 300, 'cubic-bezier(0.2, 0.8, 0.3, 1)');
    const lejos = Math.max(0, k.dist - k.target.size * 0.5), v = { x: k.dir.x * lejos, y: k.dir.y * lejos }, ini = { x: -k.dir.x * 10, y: -H };
    const cae = 200, ang = Math.atan2(v.y - ini.y, v.x - ini.x);
    void k.animar(g.sprite, [{ transform: `translate(${ini.x}px, ${ini.y}px) scale(0.9, 1.12)` }, { transform: `translate(${v.x}px, ${v.y}px) scale(1.1, 0.9)` }], cae, 'cubic-bezier(0.6, 0, 1, 1)');
    k.dibujar(cae, (c, _t, engine) => {
      const p = k.posSprite(g), q = { x: p.x + Math.cos(ang) * g.size * 0.4, y: p.y + Math.sin(ang) * g.size * 0.4 };
      luz(c, engine, q, k.s(0.5), LUCHA.core, 0.6);
      forma(c, 'pie', q.x, q.y, k.s(0.34), ang, estiloLucha(14), Math.cos(ang) < 0);
      for (let i = 0; i < 3; i++) k.emit({ x: q.x + rand(-6, 6), y: q.y + rand(-6, 6), vx: -Math.cos(ang) * 200, vy: -Math.sin(ang) * 200, drag: 3, life: 260, size: rand(3, 6), sizeEnd: 0, color: pick([LUCHA.core, LUCHA.glow, LUCHA.hot]), shape: 'glow' });
    }, { z: 1 });
    await k.esperar(cae);
    await k.impacto(t => {
      k.add(E.flash({ color: LUCHA.glow, alpha: 0.3, duration: 200 }));
      E.fireBurst(k.stage, t.center, LUCHA, t.size);
      k.add(E.starburst({ at: t.center, rays: 12, length: t.size * 1.2, width: 6, palette: LUCHA, duration: 340 }));
      ondaSuelo(k, t.feet, t.size * 1.4, LUCHA.glow, 420, 4);
      polvo(k, t.feet, 8, t.size * 0.3);
    });
    void k.animar(g.sprite, [{ transform: `translate(${v.x}px, ${v.y}px) scale(1.1, 0.9)` }, { transform: `translate(${v.x * 0.5}px, ${v.y * 0.5 - g.size * 0.5}px) scale(1, 1)`, offset: 0.45 }, { transform: 'translate(0px, 0px) scale(1, 1)' }], 360);
    await k.esperar(220);
    await k.despues();
  },

  // Patada Baja (peso): un pie barre a ras de suelo hacia los tobillos del objetivo, levantando una raya de polvo.
  async lowkick(k) {
    await k.anticipar(70);
    void k.embestida({ hasta: 0.4, ida: 140, vuelta: 260 });
    const ms = 180, a = suelo(k, 0.25), b = suelo(k, 0.86), r = k.s(0.26);
    k.dibujar(ms + 140, (c, t) => {
      const tt = t * (ms + 140) / ms, u = easeIn(Math.min(1, tt)), p = { x: lerp(a.x, b.x, u), y: lerp(a.y, b.y, u) - r * 0.45 };
      if (tt < 1 && Math.random() < 0.8) k.emit({ x: p.x, y: p.y + r * 0.45, vx: -k.dir.x * 60 + rand(-20, 20), vy: -rand(10, 40), life: 400, size: r * 0.25, sizeEnd: r * 0.6, color: TIERRA.glow, alpha: 0.4, shape: 'smoke' });
      c.globalAlpha = tt < 1 ? 1 : 1 - (tt - 1) / 0.78;
      // Raya en el suelo.
      c.save(); c.strokeStyle = 'rgba(80, 50, 20, 0.45)'; c.lineWidth = 2; c.lineCap = 'round'; c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(lerp(a.x, b.x, u), lerp(a.y, b.y, u)); c.stroke(); c.restore();
      forma(c, 'pie', p.x, p.y, r, k.angle, estiloPiel(8), Math.cos(k.angle) < 0 && Math.abs(k.dir.y) < 0.7);
    }, { z: 1 });
    await k.esperar(ms);
    await k.impacto(t => {
      ondaSuelo(k, t.feet, t.size * 0.9, LUCHA.glow, 320, 3);
      polvo(k, t.feet, 8, t.size * 0.25);
      E.sparks(k.fx, { x: t.feet.x, y: t.feet.y - t.size * 0.15 }, { count: 12, speed: [140, 300], palette: LUCHA, shape: 'streak', spread: [k.angle - 0.8, k.angle + 0.8] });
    });
    await k.despues();
  },

  // Puntapié (65): un pie traza media luna a ras de suelo alrededor de los pies del objetivo, dejando un arco de
  // polvo que se abre hacia fuera.
  async lowsweep(k) {
    await k.anticipar(70);
    void k.embestida({ hasta: 0.45, ida: 150, vuelta: 280 });
    const c0 = k.target.feet, R = k.s(0.62), ms = 230, ach = 0.42;
    const a0 = k.angle + Math.PI * 0.95, a1 = k.angle + Math.PI * 0.05 - 0.3;
    const en = (a: number) => ({ x: c0.x + Math.cos(a) * R, y: c0.y + Math.sin(a) * R * ach });
    k.dibujar(ms + 220, (c, t) => {
      const tt = t * (ms + 220) / ms, u = easeOut(Math.min(1, tt)), a = lerp(a0, a1, u), p = en(a);
      c.save();
      c.globalAlpha = tt < 1 ? 0.75 : 0.75 * (1 - (tt - 1) / 0.96);
      c.lineCap = 'round'; c.strokeStyle = LUCHA.glow; c.lineWidth = k.s(0.08);
      c.beginPath(); c.ellipse(c0.x, c0.y, R, R * ach, 0, Math.min(a0, a), Math.max(a0, a)); c.stroke();
      c.strokeStyle = LUCHA.hot; c.lineWidth = k.s(0.03); c.stroke();
      c.restore();
      if (tt < 1) {
        const tang = a + (a1 > a0 ? Math.PI / 2 : -Math.PI / 2);
        forma(c, 'pie', p.x, p.y - k.s(0.12), k.s(0.24), Math.atan2(Math.sin(tang) * ach, Math.cos(tang)), estiloPiel(8), Math.cos(tang) < 0);
        if (Math.random() < 0.8) k.emit({ x: p.x, y: p.y, vx: Math.cos(a) * 80, vy: Math.sin(a) * 40 - 20, life: 420, size: k.s(0.08), sizeEnd: k.s(0.18), color: TIERRA.glow, alpha: 0.4, shape: 'smoke' });
      }
    }, { z: 1 });
    await k.esperar(ms * 0.85);
    await k.impacto(t => {
      E.sparks(k.fx, { x: t.feet.x, y: t.feet.y - t.size * 0.1 }, { count: 12, speed: [160, 320], palette: LUCHA, shape: 'streak' });
      polvo(k, t.feet, 6, t.size * 0.25);
    });
    await k.despues();
  },

  // Anticipo: el usuario adelanta la palma abierta y, al instante, un muro curvo de luz naranja se cierra delante de
  // él con líneas de velocidad corriendo por su borde.
  async quickguard(k) {
    const g = k.user, ms = 480, R = g.size * 0.9;
    const ang = k.hayObjetivo ? k.angle : (g.side === 'p1' ? 0 : Math.PI);
    k.dibujar(ms, (c, t) => {
      const p = k.posSprite(g), abre = easeOutCubic(Math.min(1, t / 0.2)), sale = t > 0.75 ? 1 - (t - 0.75) / 0.25 : 1, sweep = 1.15 * abre;
      c.save();
      c.globalAlpha = sale;
      c.lineCap = 'round';
      for (const [col, w, rr] of [[LUCHA.core, g.size * 0.14, R], [LUCHA.hot, g.size * 0.05, R], [LUCHA.glow, g.size * 0.04, R * 1.15]] as const) {
        c.strokeStyle = col; c.lineWidth = w;
        c.beginPath(); c.ellipse(p.x, p.y, rr, rr * 0.8, 0, ang - sweep, ang + sweep); c.stroke();
      }
      // Rayas de velocidad que corren por el borde.
      c.strokeStyle = '#ffffff'; c.lineWidth = 2;
      for (let i = 0; i < 4; i++) { const a = ang - sweep + ((t * 3 + i / 4) % 1) * sweep * 2; c.beginPath(); c.ellipse(p.x, p.y, R * 1.05, R * 0.84, 0, a, a + 0.18); c.stroke(); }
      c.restore();
      forma(c, 'mano', p.x + Math.cos(ang) * g.size * 0.55, p.y + Math.sin(ang) * g.size * 0.45, g.size * 0.26 * abre, ang, estiloPiel(10), Math.cos(ang) < 0);
    }, { z: 1 });
    await k.esperar(220);
    await k.estado();
    await k.esperar(120);
  },

  // Desquite (60): el usuario se enciende de rabia (aura roja y el símbolo de la vena hinchada que late) y devuelve
  // el golpe con un puño rojo.
  async revenge(k) {
    const g = k.user, rabia = 300;
    aura(k, g, rabia + 100, IRA, 0.8);
    void k.agitar(g.sprite, 2, rabia);
    k.dibujar(rabia + 120, (c, t) => {
      const p = k.posSprite(g), s = g.size * 0.16 * (1 + 0.25 * Math.abs(Math.sin(t * Math.PI * 3))), x = p.x + g.size * 0.38, y = p.y - g.size * 0.55;
      c.save(); c.globalAlpha = t > 0.8 ? (1 - t) / 0.2 : Math.min(1, t * 6); c.strokeStyle = IRA.core; c.lineWidth = Math.max(2, s * 0.35); c.lineCap = 'round';
      for (const [sx, sy] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) { const a = Math.atan2(-sy, -sx); c.beginPath(); c.arc(x + sx * s * 1.1, y + sy * s * 1.1, s * 0.75, a - 0.7, a + 0.7); c.stroke(); }
      c.restore();
    }, { z: 1 });
    await k.esperar(rabia);
    void k.embestida({ hasta: 0.4, ida: 120, vuelta: 260, estela: IRA.core });
    await lanzaForma(k, 'puno', { ms: 180, desde: 0.2, hasta: 0.84, tam: t => k.s(0.26 + 0.14 * t), estilo: () => estiloIra(14), cada: (q, _t, r) => estela(k, q, r, IRA.glow) });
    await k.impacto(t => {
      k.add(E.starburst({ at: t.center, rays: 9, length: t.size * 0.9, width: 4.5, palette: IRA, duration: 300 }));
      k.add(E.bloom({ at: t.center, radius: t.size * 0.8, color: IRA.core, duration: 280 }));
      E.sparks(k.fx, t.center, { count: 16, speed: [180, 400], palette: IRA, shape: 'streak' });
    });
    await k.despues();
  },

  // Inversión: el usuario, al límite, parpadea; un remolino de energía gira a su alrededor, se para y gira al revés,
  // y en esa vuelta embiste; el golpe estalla primero en sombra y luego en luz.
  async reversal(k) {
    const g = k.user, ms = 420;
    k.destello(g.sprite, 120);
    k.dibujar(ms + 160, (c, t, engine) => {
      const p = k.posSprite(g), giro = 5 * Math.sin(Math.PI * Math.min(1, t * 1.2)), r = g.size * (0.75 - 0.2 * t), sale = t > 0.75 ? (1 - t) / 0.25 : 1;
      c.save(); c.globalAlpha = sale; c.lineCap = 'round';
      for (let i = 0; i < 3; i++) {
        const a = giro + (i * Math.PI * 2) / 3;
        c.strokeStyle = i % 2 ? LUCHA.glow : '#ffffff'; c.lineWidth = g.size * 0.07;
        c.beginPath(); c.ellipse(p.x, p.y, r, r * 0.7, 0, a, a + 1.4); c.stroke();
        const q = { x: p.x + Math.cos(a + 1.4) * r, y: p.y + Math.sin(a + 1.4) * r * 0.7 };
        luz(c, engine, q, g.size * 0.18, LUCHA.hot, 0.9);
      }
      c.restore();
    }, { z: 1 });
    k.destello(g.sprite, 120);
    await k.esperar(200);
    k.destello(g.sprite, 100);
    await k.esperar(ms - 200);
    await k.embestida({ hasta: 0.85, ida: 150, vuelta: 260, estela: LUCHA.glow });
    await k.impacto(t => {
      k.add(E.ring({ at: t.center, from: t.size * 0.9, to: 4, width: 6, color: LUCHA.dark, duration: 160, alpha: 0.8 }));
      k.add(E.ring({ at: t.center, from: 6, to: t.size * 1.2, width: 5, color: '#ffffff', duration: 360, delay: 140 }));
      k.add(E.starburst({ at: t.center, rays: 10, length: t.size * 1.0, width: 5, palette: LUCHA, duration: 320, delay: 120 }));
      E.sparks(k.fx, t.center, { count: 20, speed: [200, 440], palette: LUCHA, shape: 'streak' });
    });
    await k.esperar(160);
    await k.despues();
  },

  // Golpe Roca (40): una piedra se forma delante del objetivo y un puño la revienta; los pedazos le dan de lleno.
  async rocksmash(k) {
    await k.anticipar(70);
    const p = k.punto(0.78), r = k.s(0.22);
    k.dibujar(330, (c, t) => {
      c.globalAlpha = Math.min(1, t * 4);
      piedra(c, p.x, p.y + Math.sin(t * 20) * 0.5, r * (0.7 + 0.3 * Math.min(1, t * 3)), 0.4, 7);
    }, { z: 1 });
    await k.esperar(130);
    void k.embestida({ hasta: 0.35, ida: 110, vuelta: 240 });
    await lanzaForma(k, 'puno', { ms: 200, desde: 0.18, hasta: 0.7, tam: () => k.s(0.24), estilo: () => estiloPiel(8), queda: 140, crece: 0.15 });
    await k.impacto(t => {
      k.burst(14, () => ({ x: p.x + rand(-r, r) * 0.5, y: p.y + rand(-r, r) * 0.5, vx: k.dir.x * rand(160, 360) + rand(-120, 120), vy: k.dir.y * rand(160, 360) + rand(-160, 60), ay: 600, drag: 1, life: rand(360, 560), size: rand(2.5, 5), color: pick([T_ROCA.base, T_ROCA.claro, T_ROCA.oscuro]), accent: T_ROCA.borde, shape: 'rock', rot: rand(0, 6), spin: rand(-12, 12) }));
      polvo(k, p, 5, r * 0.8, ROCA.glow, 0.35);
      E.sparks(k.fx, t.center, { count: 8, speed: [120, 260], palette: ROCA, shape: 'shard' });
    });
    await k.despues();
  },

  // Sísmico: el usuario agarra al objetivo y lo lanza muy alto dando vueltas; cae a plomo y el suelo retumba.
  async seismictoss(k) {
    await k.anticipar(80);
    await k.embestida({ hasta: 0.6, ida: 140, vuelta: 300 });
    const t = k.target, H = Math.max(k.s(1.6), 60), sube = 260, cae = 120;
    if (k.acierta && t.sprite) {
      k.add(E.ring({ at: t.center, from: 4, to: t.size * 0.6, width: 3, color: LUCHA.glow, duration: 200 }));
      void k.animar(t.sprite, [
        { transform: 'translate(0px, 0px) rotate(0deg)' },
        { transform: `translate(0px, ${-H}px) rotate(${k.dir.x < 0 ? -360 : 360}deg)`, offset: sube / (sube + cae) },
        { transform: `translate(0px, 0px) rotate(${k.dir.x < 0 ? -540 : 540}deg)` },
      ], sube + cae, 'linear');
      // Sombra en el suelo que se encoge y vuelve a crecer.
      k.dibujar(sube + cae, (c, tt) => {
        const ms = tt * (sube + cae), alto = ms < sube ? easeOut(ms / sube) : 1 - easeIn((ms - sube) / cae), r = t.size * 0.4 * (1 - 0.6 * alto);
        c.globalAlpha = 0.35; c.fillStyle = '#000000'; c.beginPath(); c.ellipse(t.feet.x, t.feet.y, r, r * 0.35, 0, 0, Math.PI * 2); c.fill();
        if (ms > sube && Math.random() < 0.7) { const q = k.posSprite(t); k.emit({ x: q.x + rand(-8, 8), y: q.y - t.size * 0.3, vy: -400, life: 120, size: 2, color: '#ffffff', shape: 'streak', stretch: 50 }); }
      }, { z: 0 });
      await k.esperar(sube + cae);
    }
    await k.impacto(g => {
      k.add(E.cracks({ at: g.feet, length: g.size * 1.0, color: '#2a1808', duration: 800 }));
      ondaSuelo(k, g.feet, g.size * 1.6, LUCHA.glow, 460, 4);
      ondaSuelo(k, g.feet, g.size * 1.1, '#ffffff', 340, 2, 60);
      polvo(k, g.feet, 12, g.size * 0.35);
      cascotes(k, g.feet, 10, 300, 3, T_TIERRA);
      void k.stage.shake(7, 300);
    });
    await k.esperar(160);
    await k.despues();
  },

  // Fuerza Bruta (120): el usuario se hincha con un aura roja que ruge y agrieta el suelo bajo sus pies; carga y
  // descarga dos puños a la vez con una onda que lo arrasa todo.
  async superpower(k) {
    const g = k.user, carga = 440;
    k.add(E.dim({ at: g.center, duration: carga + 600, strength: 0.45 }));
    aura(k, g, carga, IRA, 1);
    aura(k, g, carga, LUCHA, 0.8);
    k.add(E.cracks({ at: g.feet, length: g.size * 0.8, color: '#2a1808', duration: carga + 400 }));
    polvo(k, g.feet, 6, g.size * 0.25, TIERRA.glow, 0.35, carga * 0.5);
    const fr: Keyframe[] = [];
    for (let i = 0; i <= 8; i++) { const s = 1 + 0.2 * (i / 8); fr.push({ transform: `translate(${i % 2 ? 2 : -2}px, 0px) scale(${s}, ${2 - s * 0.95})` }); }
    void k.animar(g.sprite, fr, carga, 'linear');
    k.add(E.ring({ at: g.center, from: g.size * 1.2, to: g.size * 0.3, width: 4, color: IRA.glow, duration: carga }));
    await k.esperar(carga);
    void k.embestida({ hasta: 0.6, ida: 140, vuelta: 320, estela: IRA.core });
    const r = (t: number) => k.s(0.3 + 0.12 * t);
    void lanzaForma(k, 'puno', { ms: 150, desde: 0.2, hasta: 0.8, lado: k.s(0.25), tam: r, estilo: () => estiloLucha(10, IRA.core), queda: 220, crece: 0.3 });
    await lanzaForma(k, 'puno', { ms: 150, desde: 0.2, hasta: 0.8, lado: -k.s(0.25), tam: r, estilo: () => estiloLucha(10, IRA.core), espejo: true, queda: 220, crece: 0.3, cada: (p, _t, rr) => estela(k, p, rr, IRA.glow, 1) });
    await k.impacto(t => {
      k.add(E.flash({ color: IRA.glow, alpha: 0.3, duration: 220 }));
      k.add(E.starburst({ at: t.center, rays: 14, length: t.size * 1.4, width: 7, palette: IRA, duration: 360 }));
      for (let i = 0; i < 3; i++) k.add(E.ring({ at: t.center, from: 8, to: t.size * (1 + i * 0.4), width: 6 - i, color: i ? LUCHA.glow : IRA.hot, duration: 420, delay: i * 70 }));
      // Onda que sigue de largo detrás del objetivo.
      for (let i = 0; i < 3; i++) k.add(E.slash({ at: { x: t.center.x - k.dir.x * t.size * 0.3, y: t.center.y - k.dir.y * t.size * 0.3 }, radius: t.size * (0.8 + i * 0.35), angle: k.angle, sweep: 1.6, width: 6, palette: IRA, duration: 360, delay: 40 + i * 60 }));
      E.sparks(k.fx, t.center, { count: 30, speed: [240, 600], palette: LUCHA, shape: 'streak', spread: [k.angle - 1, k.angle + 1] });
    });
    await k.esperar(300);
    await k.despues();
  },

  // Tiro Vital (70): el usuario agarra al objetivo y lo voltea por encima en un arco de llave de judo, dejando una
  // estela naranja curva; aterriza de espaldas con un golpe seco.
  async vitalthrow(k) {
    await k.anticipar(80);
    await k.embestida({ hasta: 0.65, ida: 140, vuelta: 320 });
    const t = k.target, ms = 380, lado = k.s(0.7), alto = k.s(0.9);
    const camino = (u: number): Vec => ({ x: k.perp.x * lado * Math.sin(Math.PI * u), y: k.perp.y * lado * Math.sin(Math.PI * u) - alto * Math.sin(Math.PI * u) });
    if (k.acierta && t.sprite) {
      const fr: Keyframe[] = [];
      for (let i = 0; i <= 6; i++) { const u = i / 6, d = camino(u); fr.push({ transform: `translate(${d.x}px, ${d.y}px) rotate(${(k.perp.x >= 0 ? 1 : -1) * 360 * u}deg)` }); }
      void k.animar(t.sprite, fr, ms, 'cubic-bezier(0.4, 0, 0.7, 1)');
    }
    k.dibujar(ms + 200, (c, tt) => {
      const u = Math.min(1, tt * (ms + 200) / ms), n = 24;
      c.save(); c.globalAlpha = tt * (ms + 200) / ms < 1 ? 0.85 : 0.85 * (1 - (tt * (ms + 200) - ms) / 200);
      c.lineCap = 'round'; c.lineJoin = 'round';
      for (const [col, w] of [[LUCHA.core, k.s(0.1)], [LUCHA.hot, k.s(0.035)]] as const) {
        c.strokeStyle = col; c.lineWidth = w; c.beginPath();
        for (let i = 0; i <= n; i++) { const v = (i / n) * u, d = camino(v); if (i) c.lineTo(t.center.x + d.x, t.center.y + d.y); else c.moveTo(t.center.x + d.x, t.center.y + d.y); }
        c.stroke();
      }
      c.restore();
    }, { z: 1 });
    await k.esperar(ms);
    await k.impacto(g => {
      ondaSuelo(k, g.feet, g.size * 1.2, LUCHA.glow, 380, 4);
      polvo(k, g.feet, 10, g.size * 0.3);
      k.add(E.starburst({ at: g.center, rays: 8, length: g.size * 0.8, width: 4, palette: LUCHA, duration: 280 }));
    });
    await k.despues();
  },

  // ===========================================================================================
  // ROCA

  // Poder Pasado (60): cinco piedras antiguas con runas doradas se elevan y orbitan al usuario; luego salen
  // disparadas una tras otra contra el objetivo.
  async ancientpower(k) {
    await k.cargar(110);
    const n = 5, orbita = 300, cada = 45, viaje = 210, total = orbita + cada * (n - 1) + viaje + 40;
    const R = k.user.size * 0.72, tam = Math.max(5, k.s(0.13));
    const destino = Array.from({ length: n }, (_, i) => (k.acierta ? k.enCuerpo(k.target, 0.22) : k.punto(1.5, (i - 2) * k.s(0.2))));
    const llego = Array.from({ length: n }, () => false);
    const orbitaEn = (i: number, ms: number): Vec => {
      const u = k.posSprite(k.user), sube = easeOut(Math.min(1, ms / 220)), a = (i / n) * Math.PI * 2 + (ms / 1000) * 5;
      return { x: u.x + Math.cos(a) * R * (0.3 + 0.7 * sube), y: u.y - k.user.size * 0.35 * sube + Math.sin(a) * R * 0.42 };
    };
    k.dibujar(total, (c, t, engine) => {
      const ms = t * total;
      for (let i = 0; i < n; i++) {
        const sale = orbita + i * cada;
        let p = orbitaEn(i, ms);
        if (ms >= sale) {
          const v = (ms - sale) / viaje;
          if (v >= 1) {
            if (!llego[i]) { llego[i] = true; cascotes(k, destino[i], 5, 200, 3, T_ANTIGUA); k.emit({ x: destino[i].x, y: destino[i].y, life: 240, size: tam * 1.6, sizeEnd: 0, color: '#ffe6a0', shape: 'glow' }); }
            continue;
          }
          const o = orbitaEn(i, sale), e = easeIn(v);
          p = { x: lerp(o.x, destino[i].x, e), y: lerp(o.y, destino[i].y, e) };
          if (Math.random() < 0.6) k.emit({ x: p.x, y: p.y, vx: rand(-20, 20), vy: rand(-20, 20), life: 260, size: tam * 0.5, sizeEnd: 0, color: '#ffe6a0', shape: 'glow' });
        }
        luz(c, engine, p, tam * 2.4, '#ffd98a', 0.75);
        piedra(c, p.x, p.y, tam, i * 1.3 + ms / 400, i + 3, T_ANTIGUA);
        // Runa grabada: un aro con una raya.
        c.save(); c.strokeStyle = '#fff2b8'; c.lineWidth = Math.max(1, tam * 0.13);
        c.beginPath(); c.arc(p.x, p.y, tam * 0.35, 0, Math.PI * 2); c.moveTo(p.x, p.y - tam * 0.55); c.lineTo(p.x, p.y + tam * 0.55); c.stroke(); c.restore();
      }
    }, { z: 1 });
    await k.esperar(orbita + viaje);
    await k.impacto(t => {
      k.add(E.bloom({ at: t.center, radius: t.size * 0.8, color: '#ffe6a0', duration: 380 }));
      k.add(E.ring({ at: t.center, from: 6, to: t.size * 0.8, width: 3, color: ROCA.hot, duration: 320 }));
    });
    await k.esperar(cada * (n - 1) + 40);
    await k.despues();
  },

  // Pedrada (25): de tres a cinco piedras disparadas en ráfaga, en línea recta, que se deshacen al chocar.
  async rockblast(k) {
    const n = Math.min(5, Math.max(3, k.ctx.cue.hitCount)), cada = 100, ms = 170, r = k.s(0.15);
    await k.anticipar(60);
    void k.recuperar({ x: -k.dir.x * 8, y: -k.dir.y * 8 }, 160);
    for (let i = 0; i < n; i++) {
      const lado = (i % 2 ? -1 : 1) * k.s(0.1) * (i ? 1 : 0), fin = k.acierta ? k.punto(0.9, lado) : k.punto(1.5, lado * 3), ini = k.punto(0.15);
      k.dibujar(ms, (c, t) => {
        const p = { x: lerp(ini.x, fin.x, t), y: lerp(ini.y, fin.y, t) - Math.sin(Math.PI * t) * k.s(0.1) };
        estela(k, p, r, ROCA.glow, 0.5);
        piedra(c, p.x, p.y, r, t * 9 + i, 20 + i);
      }, { z: 1, delay: i * cada });
      if (i > 0 && k.acierta) {
        cascotes(k, fin, 6, 200, 2.5, T_ROCA, i * cada + ms);
        polvo(k, fin, 3, r * 0.8, ROCA.glow, 0.35, i * cada + ms);
      }
    }
    await k.esperar(ms);
    await k.impacto(() => { cascotes(k, k.punto(0.9), 7, 220, 2.8); polvo(k, k.punto(0.9), 3, r * 0.8, ROCA.glow, 0.35); });
    await k.esperar((n - 1) * cada + 40);
    await k.despues();
  },

  // Pulimento: una franja de brillo recorre el cuerpo del usuario dos veces entre destellos de estrellas; luego,
  // ya pulido, deja estelas como si fuera más rápido.
  async rockpolish(k) {
    const g = k.user, ms = 520;
    k.dibujar(ms, (c, t) => {
      const p = k.posSprite(g), r = g.size * 0.5;
      c.save();
      c.beginPath(); c.ellipse(p.x, p.y, r, r * 1.05, 0, 0, Math.PI * 2); c.clip();
      for (let i = 0; i < 2; i++) {
        const u = t * 2 - i * 0.9; if (u < 0 || u > 1) continue;
        const x = p.x - r * 1.6 + u * r * 3.2;
        c.globalAlpha = 0.8 * Math.sin(Math.PI * u);
        c.fillStyle = lineal(c, x - r * 0.4, 0, x + r * 0.4, 0, ['rgba(255,255,255,0)', '#ffffff', 'rgba(255,255,255,0)']);
        c.beginPath(); c.moveTo(x - r * 0.4 + r * 0.4, p.y - r * 1.1); c.lineTo(x + r * 0.4 + r * 0.4, p.y - r * 1.1); c.lineTo(x + r * 0.4 - r * 0.4, p.y + r * 1.1); c.lineTo(x - r * 0.4 - r * 0.4, p.y + r * 1.1); c.closePath(); c.fill();
      }
      c.restore();
    }, { z: 1 });
    k.burst(8, i => ({ x: g.center.x + rand(-g.size * 0.4, g.size * 0.4), y: g.center.y + rand(-g.size * 0.4, g.size * 0.3), life: 300, delay: 60 + i * 50, size: rand(4, 7), sizeEnd: 0, color: i % 2 ? '#ffffff' : ROCA.hot, shape: 'star', spin: 5 }));
    await k.esperar(ms - 160);
    const atras = k.hayObjetivo ? { x: -k.dir.x, y: -k.dir.y } : { x: -1, y: 0 };
    for (let i = 1; i <= 3; i++) k.sombra(g.sprite, { x: atras.x * g.size * 0.25 * i, y: atras.y * g.size * 0.25 * i }, ROCA.glow, i * 30, 260);
    k.burst(8, () => ({ x: g.center.x + rand(-g.size * 0.4, g.size * 0.4), y: g.center.y + rand(-g.size * 0.4, g.size * 0.4), vx: atras.x * 420, vy: atras.y * 420, life: 200, size: 2, color: ROCA.hot, shape: 'streak', stretch: 40 }));
    await k.estado();
  },

  // Avalancha (75): rocas de todos los tamaños caen desde lo alto de la vista sobre el objetivo y alrededor, cada una
  // con su sombra creciendo en el suelo y un golpe de polvo al aterrizar.
  async rockslide(k) {
    const n = 7, cada = 55, cae = 260, t0 = k.target;
    await k.anticipar(80);
    void k.recuperar({ x: -k.dir.x * 8, y: -k.dir.y * 8 }, 200);
    for (let i = 0; i < n; i++) {
      const suelo0 = i === 0 && k.acierta ? { x: t0.center.x, y: t0.feet.y } : { x: t0.feet.x + rand(-1, 1) * k.s(0.9), y: t0.feet.y + rand(-0.35, 0.35) * k.s(0.8) };
      const r = k.s(i === 0 ? 0.3 : rand(0.14, 0.26)), fin = i === 0 && k.acierta ? t0.center : { x: suelo0.x, y: suelo0.y - r * 0.6 };
      const ini = { x: fin.x + k.s(rand(-0.4, 0.4)), y: k.stage.top - r * 2 }, d = i * cada;
      k.dibujar(cae, (c, t) => {
        const u = easeIn(t);
        c.save(); c.globalAlpha = 0.35 * u; c.fillStyle = '#000000'; c.beginPath(); c.ellipse(suelo0.x, suelo0.y, r * (0.4 + 0.6 * u), r * 0.3 * (0.4 + 0.6 * u), 0, 0, Math.PI * 2); c.fill(); c.restore();
        piedra(c, lerp(ini.x, fin.x, u), lerp(ini.y, fin.y, u), r, t * 5 + i, 40 + i);
      }, { z: 1, delay: d });
      // Se queda un momento en el suelo y se desmorona.
      k.dibujar(200, (c, t) => { c.globalAlpha = 1 - easeIn(t); piedra(c, fin.x, fin.y + t * r * 0.3, r * (1 - 0.2 * t), 5 + i, 40 + i); }, { z: 1, delay: d + cae });
      if (i > 0) { polvo(k, suelo0, 4, r, ROCA.glow, 0.35, d + cae); cascotes(k, suelo0, 4, 220, r * 0.25, T_ROCA, d + cae); }
    }
    await k.esperar(cae);
    await k.impacto(t => { polvo(k, t.feet, 6, t.size * 0.3, ROCA.glow); cascotes(k, t.center, 8, 280, 3.5); ondaSuelo(k, t.feet, t.size, ROCA.glow, 320); });
    void k.stage.shake(4, (n - 1) * cada + 100);
    await k.esperar((n - 1) * cada + 120);
    await k.despues();
  },

  // Lanzarrocas (50): el usuario lanza una roca grande en una parábola alta; su sombra la sigue por el suelo y al
  // caer revienta en pedazos.
  async rockthrow(k) {
    await k.anticipar(90);
    void k.recuperar({ x: -k.dir.x * 8, y: -k.dir.y * 8 }, 220);
    const r = k.s(0.24), ms = 340, arco = Math.max(k.s(0.9), k.dist * 0.35);
    k.dibujar(ms, (c, t) => {
      const s = suelo(k, t * 0.95);
      c.save(); c.globalAlpha = 0.3; c.fillStyle = '#000000'; c.beginPath(); c.ellipse(s.x, s.y, r * 0.8, r * 0.28, 0, 0, Math.PI * 2); c.fill(); c.restore();
    });
    await k.proyectil(ms, (p, t, c) => piedra(c, p.x, p.y, r, t * 8, 11), { arco });
    await k.impacto(t => {
      cascotes(k, t.center, 14, 300, 4);
      polvo(k, t.feet, 6, t.size * 0.3, ROCA.glow);
      ondaSuelo(k, t.feet, t.size, ROCA.glow, 320);
    });
    await k.despues();
  },

  // Tumba Rocas (60): bloques de roca caen del cielo en corro alrededor del objetivo y lo encierran; se quedan un
  // momento y se derrumban.
  async rocktomb(k) {
    await k.anticipar(80);
    void k.recuperar({ x: -k.dir.x * 8, y: -k.dir.y * 8 }, 200);
    const t0 = k.target, n = 6, cada = 60, cae = 220, queda = 360, R = k.s(0.62);
    const sitios = Array.from({ length: n }, (_, i) => { const a = (i / n) * Math.PI * 2 + 0.3; return { a, p: k.alrededor(t0.feet, R, a, 0.5) }; }).sort((x, y) => x.p.y - y.p.y);
    sitios.forEach(({ p }, i) => {
      const r = k.s(rand(0.2, 0.26)), fin = { x: p.x, y: p.y - r * 0.9 }, ini = { x: p.x, y: k.stage.top - r * 2 }, d = i * cada;
      k.dibujar(cae + queda, (c, t) => {
        const ms = t * (cae + queda), u = easeIn(Math.min(1, ms / cae)), rompe = ms > cae + queda * 0.6 ? (ms - cae - queda * 0.6) / (queda * 0.4) : 0;
        c.globalAlpha = 1 - rompe;
        piedra(c, lerp(ini.x, fin.x, u), lerp(ini.y, fin.y, u) + rompe * r * 0.4, r * (1 - 0.2 * rompe), 0.3 + i, 60 + i, T_ROCA, 1.3);
      }, { z: 1, delay: d });
      polvo(k, p, 3, r, ROCA.glow, 0.35, d + cae);
      cascotes(k, p, 3, 160, 2.5, T_ROCA, d + cae + queda * 0.6);
    });
    await k.esperar(cae + cada * 2);
    await k.impacto(t => { ondaSuelo(k, t.feet, R * 1.4, ROCA.glow, 360); polvo(k, t.feet, 5, t.size * 0.3, ROCA.glow); });
    void k.stage.shake(3, cada * n);
    await k.esperar(cada * (n - 3) + queda * 0.6);
    await k.despues();
  },

  // Romperrocas (150): con la vista oscurecida, un bloque gigante se forma delante del usuario con grietas
  // incandescentes; sale lanzado girando y revienta contra el objetivo.
  async rockwrecker(k) {
    const g = k.user, forma0 = 460, viaje = 300, R = Math.max(k.s(0.55), g.size * 0.5);
    k.add(E.dim({ at: g.center, duration: forma0 + viaje + 400, strength: 0.5 }));
    const sitio = () => { const u = k.posSprite(g); return { x: u.x + k.dir.x * g.size * 0.7, y: u.y + k.dir.y * g.size * 0.7 - g.size * 0.35 }; };
    const grietas = Array.from({ length: 4 }, (_, i) => trazaGrieta({ x: 0, y: 0 }, { x: Math.cos(i * 1.6 + 0.4) * 0.85, y: Math.sin(i * 1.6 + 0.4) * 0.75 }, 3, 0.15));
    const bloque = (c: CanvasRenderingContext2D, engine: FxEngine, p: Vec, r: number, rot: number, calor: number) => {
      luz(c, engine, p, r * 1.8, MAGMA.core, 0.35 * calor);
      piedra(c, p.x, p.y, r, rot, 99, T_ROCA);
      c.save(); c.translate(p.x, p.y); c.rotate(rot);
      for (const gr of grietas) pintaGrieta(c, gr.map(q => ({ x: q.x * r, y: q.y * r })), Math.max(1.5, r * 0.06), calor > 0.2 ? MAGMA.glow : undefined);
      c.restore();
    };
    k.dibujar(forma0, (c, t, engine) => {
      const p = sitio();
      bloque(c, engine, p, R * easeOut(t), t * 0.6, t);
      if (Math.random() < 0.6) { const a = rand(0, Math.PI * 2), d = R * rand(1.6, 2.4); k.emit({ x: p.x + Math.cos(a) * d, y: p.y + Math.sin(a) * d, vx: -Math.cos(a) * d * 4, vy: -Math.sin(a) * d * 4, drag: 3, life: 220, size: rand(2.5, 4), color: T_ROCA.base, accent: T_ROCA.borde, shape: 'rock', spin: 8 }); }
    }, { z: 1 });
    void k.agitar(g.sprite, 2, forma0);
    await k.esperar(forma0);
    void k.embestida({ hasta: 0.15, ida: 90, vuelta: 260 });
    const ini = sitio(), fin = k.acierta ? k.target.center : k.punto(1.5);
    k.dibujar(viaje, (c, t, engine) => {
      const u = easeIn(t), p = { x: lerp(ini.x, fin.x, u), y: lerp(ini.y, fin.y, u) - Math.sin(Math.PI * u) * k.s(0.25) };
      bloque(c, engine, p, R * (1 + 0.1 * u), 0.6 + t * 7, 1);
      if (Math.random() < 0.7) k.emit({ x: p.x + rand(-R, R) * 0.5, y: p.y + rand(-R, R) * 0.5, vx: -k.dir.x * 120 + rand(-40, 40), vy: -k.dir.y * 120 + rand(-40, 40), ay: 500, life: 400, size: rand(2.5, 4.5), color: T_ROCA.base, accent: T_ROCA.borde, shape: 'rock', spin: 8 });
    }, { z: 1 });
    await k.esperar(viaje);
    await k.impacto(t => {
      k.add(E.flash({ color: ROCA.hot, alpha: 0.4, duration: 240 }));
      k.add(E.starburst({ at: t.center, rays: 14, length: t.size * 1.6, width: 8, palette: MAGMA, duration: 380 }));
      cascotes(k, t.center, 30, 460, 5.5);
      polvo(k, t.feet, 14, t.size * 0.45, ROCA.glow, 0.45);
      ondaSuelo(k, t.feet, t.size * 2, ROCA.glow, 480, 5);
      ondaSuelo(k, t.feet, t.size * 1.3, '#ffffff', 360, 3, 80);
      k.add(E.cracks({ at: t.feet, length: t.size * 1.2, color: '#2a1808', duration: 900 }));
      void k.stage.shake(10, 420);
    });
    await k.esperar(320);
    await k.despues();
  },

  // Rodar (30): el usuario se hace bola dentro de un corro de piedras y rueda dando vueltas hasta el objetivo,
  // dejando polvo y marcas de rodada.
  async rollout(k) {
    const g = k.user, ida = 300, vuelta = 260, s = k.dir.x >= 0 ? 1 : -1;
    const lejos = Math.max(0, k.dist - k.target.size * 0.5) * 0.85, v = { x: k.dir.x * lejos, y: k.dir.y * lejos };
    void k.animar(g.sprite, [{ transform: 'translate(0px, 0px) rotate(0deg) scale(0.9, 0.9)' }, { transform: `translate(${v.x}px, ${v.y}px) rotate(${s * 720}deg) scale(0.9, 0.9)` }], ida, 'cubic-bezier(0.5, 0, 0.9, 0.7)');
    k.dibujar(ida + vuelta, (c, t) => {
      const p = k.posSprite(g), r = g.size * 0.55, giro = t * s * 22, sale = t > 0.85 ? (1 - t) / 0.15 : 1;
      c.globalAlpha = sale;
      for (let i = 0; i < 8; i++) { const a = giro + (i / 8) * Math.PI * 2; piedra(c, p.x + Math.cos(a) * r, p.y + Math.sin(a) * r, g.size * 0.13, a, 80 + i); }
      if (Math.random() < 0.5) k.emit({ x: p.x, y: p.y + g.size * 0.45, vx: rand(-30, 30), vy: -rand(10, 40), life: 450, size: g.size * 0.12, sizeEnd: g.size * 0.3, color: TIERRA.glow, alpha: 0.35, shape: 'smoke' });
    }, { z: 1 });
    // Rodada en el suelo.
    k.dibujar(ida + 300, (c, t) => {
      const u = Math.min(1, (t * (ida + 300)) / ida), a = g.feet, b = { x: a.x + v.x * u, y: a.y + v.y * u };
      c.save(); c.globalAlpha = 0.35 * (1 - Math.max(0, (t * (ida + 300) - ida) / 300)); c.strokeStyle = '#4a3018'; c.lineWidth = 2; c.setLineDash([5, 4]);
      for (const l of [-1, 1]) { c.beginPath(); c.moveTo(a.x + k.perp.x * l * g.size * 0.2, a.y + k.perp.y * l * g.size * 0.1); c.lineTo(b.x + k.perp.x * l * g.size * 0.2, b.y + k.perp.y * l * g.size * 0.1); c.stroke(); }
      c.restore();
    });
    await k.esperar(ida);
    void k.animar(g.sprite, [{ transform: `translate(${v.x}px, ${v.y}px) rotate(0deg) scale(0.9, 0.9)` }, { transform: `translate(${v.x * 0.5}px, ${v.y * 0.5 - g.size * 0.3}px) rotate(${-s * 180}deg) scale(1, 1)`, offset: 0.5 }, { transform: 'translate(0px, 0px) rotate(-360deg) scale(1, 1)' }], vuelta);
    await k.impacto(t => { cascotes(k, t.feet, 6, 200, 2.5); polvo(k, t.feet, 5, t.size * 0.25, ROCA.glow); });
    await k.despues();
  },

  // Tormenta de Arena: se levanta un remolino de arena alrededor del usuario y una ráfaga barre la vista de lado a
  // lado (el resto lo pinta la capa del clima).
  async sandstorm(k) {
    const g = k.user, ms = 520;
    E.whirl(k.stage, g, ARENA.glow);
    k.dibujar(ms, (_c, t) => {
      for (let i = 0; i < 2; i++) {
        const a = rand(0, Math.PI * 2), r = g.size * rand(0.4, 0.8);
        k.emit({ x: g.center.x + Math.cos(a) * r, y: g.feet.y - rand(0, g.size) * t + Math.sin(a) * r * 0.3, vx: -Math.sin(a) * 260, vy: Math.cos(a) * 80 - 60, life: 360, size: rand(1.5, 2.5), color: pick([ARENA.core, ARENA.glow]), shape: 'streak', stretch: 40 });
      }
    });
    const st = k.stage;
    k.burst(46, i => ({ x: st.left - 20, y: st.top + rand(0, st.height), vx: rand(600, 900), vy: rand(-40, 60), life: rand(700, 1000), delay: 140 + i * 6, size: rand(1.4, 2.6), color: pick([ARENA.core, ARENA.glow, ARENA.hot]), alpha: 0.85, shape: 'streak', stretch: 45 }));
    k.burst(12, i => ({ x: st.left - 40, y: st.top + rand(0, st.height), vx: rand(380, 560), vy: rand(-20, 20), life: 1000, delay: 160 + i * 20, size: rand(20, 34), sizeEnd: 50, color: ARENA.core, alpha: 0.22, shape: 'smoke' }));
    await k.esperar(ms - 100);
    await k.estado();
  },

  // Antiaéreo (50): el usuario lanza una piedra hacia el cielo; vuelve a caer en picado desde lo alto de la vista
  // sobre el objetivo y lo aplasta contra el suelo.
  async smackdown(k) {
    await k.anticipar(80);
    void k.recuperar({ x: -k.dir.x * 8, y: -k.dir.y * 8 }, 200);
    const r = k.s(0.2), sube = 200, cae = 180, ini = k.punto(0.05), arriba = k.stage.top - r * 2;
    k.dibujar(sube, (c, t) => {
      const u = easeIn(t), p = { x: ini.x + k.dir.x * k.s(0.3) * u, y: lerp(ini.y, arriba, u) };
      k.emit({ x: p.x, y: p.y, vy: 200, life: 160, size: 2, color: ROCA.glow, shape: 'streak', stretch: 30 });
      piedra(c, p.x, p.y, r * 0.8, t * 6, 13);
    }, { z: 1 });
    await k.esperar(sube + 60);
    const t0 = k.target, fin = k.acierta ? { x: t0.center.x, y: t0.top.y } : k.punto(1.4);
    k.dibujar(cae, (c, t) => {
      const u = easeIn(t), p = { x: fin.x - k.dir.x * k.s(0.3) * (1 - u), y: lerp(arriba, fin.y, u) };
      for (let i = 0; i < 2; i++) k.emit({ x: p.x + rand(-r, r) * 0.6, y: p.y - r, vy: -260, life: 140, size: 2.2, color: ROCA.hot, shape: 'streak', stretch: 45 });
      c.save(); c.globalAlpha = 0.35 * u; c.fillStyle = '#000000'; c.beginPath(); c.ellipse(t0.feet.x, t0.feet.y, r * (0.4 + 0.8 * u), r * 0.35 * (0.4 + 0.8 * u), 0, 0, Math.PI * 2); c.fill(); c.restore();
      piedra(c, p.x, p.y, r * 1.1, t * 6, 13);
    }, { z: 1 });
    await k.esperar(cae);
    await k.impacto(t => {
      cascotes(k, t.top, 10, 260, 3.5);
      ondaSuelo(k, t.feet, t.size * 1.1, ROCA.glow, 340, 4);
      polvo(k, t.feet, 8, t.size * 0.3, ROCA.glow);
      // Aplastado hacia el suelo.
      k.burst(6, i => ({ x: t.center.x + (i - 2.5) * t.size * 0.15, y: t.top.y, vy: 420, drag: 3, life: 220, size: 2.2, color: ROCA.hot, shape: 'streak', stretch: 40 }));
    });
    await k.despues();
  },

  // Trampa Rocas: el usuario lanza piedras puntiagudas que se quedan flotando en corro alrededor del objetivo,
  // meciéndose y destellando.
  async stealthrock(k) {
    const n = 5, viaje = 260, flota = 520, c0 = k.hayObjetivo ? k.target.center : k.punto(1), R = k.s(0.75), r = k.s(0.13);
    await k.anticipar(80);
    void k.recuperar({ x: -k.dir.x * 8, y: -k.dir.y * 8 }, 200);
    const ini = k.punto(0.1);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 - Math.PI / 2, fin = k.alrededor({ x: c0.x, y: c0.y - k.s(0.1) }, R, a, 0.6), d = i * 40;
      k.dibujar(viaje + flota, (c, t) => {
        const ms = t * (viaje + flota), u = Math.min(1, ms / viaje), e = easeOut(u), mece = u >= 1 ? Math.sin((ms - viaje) / 120 + i * 1.7) * r * 0.5 : 0;
        const p = { x: lerp(ini.x, fin.x, e), y: lerp(ini.y, fin.y, e) - Math.sin(Math.PI * u) * k.s(0.5) + mece };
        c.globalAlpha = ms > viaje + flota * 0.75 ? 1 - (ms - viaje - flota * 0.75) / (flota * 0.25) : 1;
        // Sombra flotante y la piedra con dos puntas.
        c.save(); c.globalAlpha *= 0.25; c.fillStyle = '#000000'; c.beginPath(); c.ellipse(fin.x, fin.y + R * 0.3, r * 0.8, r * 0.25, 0, 0, Math.PI * 2); c.fill(); c.restore();
        estaca(c, p.x, p.y + r * 0.9, r * 1.8, r * 0.55, Math.sin(i) * r * 0.3);
      }, { z: 1, delay: d });
      k.emit({ x: fin.x, y: fin.y - r * 0.9, life: 260, delay: d + viaje + 120 + i * 60, size: r * 0.9, sizeEnd: 0, color: '#ffffff', shape: 'star', spin: 6 });
    }
    await k.esperar(viaje + 40);
    await k.estado();
    await k.esperar(flota * 0.5);
  },

  // Roca Afilada (100): una hilera de pinchos de piedra corre por el suelo hacia el objetivo y bajo él brota un
  // ramillete de estacas enormes que lo atraviesan; luego se desmoronan.
  async stoneedge(k) {
    await k.anticipar(90);
    void k.recuperar({ x: -k.dir.x * 8, y: -k.dir.y * 8 }, 200);
    const fila = 6, cada = 45, sube = 110;
    for (let i = 0; i < fila; i++) {
      const p = suelo(k, 0.15 + (0.7 * i) / fila, (i % 2 ? 1 : -1) * k.s(0.08)), h = k.s(0.3 + 0.05 * i), w = k.s(0.08), d = i * cada;
      k.dibujar(sube + 140, (c, t) => {
        const ms = t * (sube + 140), u = ms < sube ? easeOutCubic(ms / sube) : 1 - easeIn((ms - sube) / 140);
        monticulo(c, p.x, p.y, w * 1.4);
        estaca(c, p.x, p.y, h * u, w, w * 0.3);
      }, { z: 1, delay: d });
      cascotes(k, p, 2, 140, 2, T_ROCA, d);
    }
    const t0 = k.target.feet, gordas = 7, d0 = fila * cada, crece = 120, queda = 300;
    const sitios = Array.from({ length: gordas }, (_, i) => {
      const a = (i / gordas) * Math.PI * 2 + 0.2, rr = i === 0 ? 0 : k.s(rand(0.3, 0.55)), p = i === 0 ? { x: t0.x, y: t0.y + 1 } : k.alrededor(t0, rr, a, 0.5);
      return { p, h: k.s(i === 0 ? 1.3 : rand(0.75, 1.15)), w: k.s(i === 0 ? 0.2 : rand(0.12, 0.17)), inc: (p.x - t0.x) * 0.6, d: d0 + (i === 0 ? 0 : rand(0, 60)) };
    }).sort((a, b) => a.p.y - b.p.y);
    for (const s of sitios) {
      k.dibujar(crece + queda, (c, t) => {
        const ms = t * (crece + queda), u = easeOutCubic(Math.min(1, ms / crece)), rompe = ms > crece + queda * 0.6 ? (ms - crece - queda * 0.6) / (queda * 0.4) : 0;
        c.globalAlpha = 1 - rompe;
        monticulo(c, s.p.x, s.p.y, s.w * 1.5);
        estaca(c, s.p.x, s.p.y + rompe * s.h * 0.3, s.h * u * (1 - rompe * 0.3), s.w, s.inc * u);
      }, { z: 1, delay: s.d });
      cascotes(k, s.p, 3, 260, 3, T_ROCA, s.d);
      k.emit({ x: s.p.x + s.inc, y: s.p.y - s.h, life: 220, delay: s.d + crece, size: s.w * 1.4, sizeEnd: 0, color: '#ffffff', shape: 'star', spin: 6 });
    }
    await k.esperar(d0 + 60);
    await k.impacto(t => {
      polvo(k, t.feet, 10, t.size * 0.35, ROCA.glow);
      ondaSuelo(k, t.feet, t.size * 1.3, ROCA.glow, 360, 4);
      E.sparks(k.fx, t.center, { count: 14, speed: [180, 380], palette: ROCA, shape: 'shard', size: [2.5, 4.5] });
    });
    await k.esperar(crece + queda * 0.7);
    await k.despues();
  },

  // Vasta Guardia: un muro de losas de piedra brota del suelo en un arco ancho delante del usuario (cubre a todo el
  // equipo), aguanta un momento y se hunde.
  async wideguard(k) {
    const g = k.user, n = 7, cada = 35, sube = 160, queda = 420, R = g.size * 1.05;
    const ang = k.hayObjetivo ? k.angle : (g.side === 'p1' ? 0 : Math.PI);
    const losas = Array.from({ length: n }, (_, i) => { const a = ang + (i / (n - 1) - 0.5) * 2.3; return { p: k.alrededor(g.feet, R, a, 0.55), d: Math.abs(i - (n - 1) / 2) * cada, s: i }; }).sort((a, b) => a.p.y - b.p.y);
    for (const l of losas) {
      const w = g.size * 0.36, h = g.size * 0.75;
      k.dibujar(sube + queda, (c, t) => {
        const ms = t * (sube + queda), u = ms < sube ? easeOutCubic(ms / sube) : ms > sube + queda * 0.7 ? 1 - easeIn((ms - sube - queda * 0.7) / (queda * 0.3)) : 1;
        losa(c, l.p.x, l.p.y, w, h * u, 30 + l.s);
      }, { z: 1, delay: l.d });
      polvo(k, l.p, 2, w * 0.6, ROCA.glow, 0.35, l.d);
      cascotes(k, l.p, 2, 140, 2.2, T_ROCA, l.d);
    }
    k.add(E.ring({ at: g.feet, from: g.size * 0.4, to: R * 1.3, width: 3, color: ROCA.glow, duration: 360, squash: 0.5 }));
    await k.esperar(sube + 3 * cada);
    await k.estado();
    await k.esperar(140);
  },

  // Joya de Luz (80): cinco gemas de colores se forman en abanico delante del usuario, centellean y disparan a la vez
  // rayos finos que convergen en el objetivo en un estallido de destellos.
  async powergem(k) {
    const colores = ['#ff5aa0', '#5ae0ff', '#ffe04a', '#7aff8a', '#c08aff'], forma0 = 240, rayo = 300, R = k.user.size * 0.75;
    await k.cargar(80);
    const sitio = (i: number) => { const u = k.posSprite(k.user), a = k.angle + (i / 4 - 0.5) * 2.0; return { x: u.x + Math.cos(a) * R, y: u.y + Math.sin(a) * R * 0.8 - k.user.size * 0.15 }; };
    k.dibujar(forma0 + rayo, (c, t, engine) => {
      const ms = t * (forma0 + rayo), sale = ms > forma0 + rayo * 0.5 ? 1 - (ms - forma0 - rayo * 0.5) / (rayo * 0.5) : 1;
      colores.forEach((col, i) => {
        const p = sitio(i), r = k.user.size * 0.16 * easeOut(Math.min(1, ms / (forma0 * 0.6))) * (1 + 0.08 * Math.sin(ms / 40 + i));
        c.globalAlpha = sale;
        luz(c, engine, p, r * 2.4, col, 0.8);
        gema(c, p.x, p.y, r, col, Math.sin(ms / 200 + i) * 0.2);
      });
    }, { z: 1 });
    k.burst(10, i => { const p = sitio(i % 5); return { x: p.x + rand(-6, 6), y: p.y + rand(-6, 6), life: 240, delay: 80 + i * 15, size: rand(4, 6), sizeEnd: 0, color: '#ffffff', shape: 'star', spin: 6 }; });
    await k.esperar(forma0);
    const fin = k.acierta ? k.target.center : k.punto(1.5);
    colores.forEach((col, i) => k.add(E.beam({ from: sitio(i), to: fin, width: k.s(0.07), palette: { core: col, glow: col, hot: '#ffffff', dark: col }, duration: rayo, delay: i * 20 })));
    await k.esperar(90);
    await k.impacto(t => {
      k.add(E.bloom({ at: t.center, radius: t.size, color: '#ffffff', duration: 360 }));
      k.burst(18, () => { const a = rand(0, Math.PI * 2), v = rand(120, 300); return { x: t.center.x, y: t.center.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, drag: 3, life: rand(360, 520), size: rand(4, 7), sizeEnd: 0, color: pick(colores), shape: 'star', spin: rand(-6, 6) }; });
      k.add(E.ring({ at: t.center, from: 6, to: t.size * 0.9, width: 3, color: '#ffffff', duration: 300 }));
    });
    await k.esperar(160);
    await k.despues();
  },

  // Testarazo (150): con la vista a oscuras, piedras vuelan a la cabeza del usuario hasta formar un bloque-ariete;
  // embiste de cabeza y el choque hace saltar la roca en pedazos con un destello.
  async headsmash(k) {
    const g = k.user, carga = 360, R = g.size * 0.36;
    k.add(E.dim({ at: g.center, duration: carga + 700, strength: 0.5 }));
    await k.anticipar(120);
    const casco = () => { const u = k.posSprite(g); return { x: u.x + k.dir.x * g.size * 0.42, y: u.y + k.dir.y * g.size * 0.42 - g.size * 0.08 }; };
    let rompe = false;
    k.dibujar(carga + 400, (c, t, engine) => {
      if (rompe) return;
      const ms = t * (carga + 400), p = casco(), u = easeOut(Math.min(1, ms / carga));
      luz(c, engine, p, R * 2, ROCA.hot, 0.3 + 0.4 * u);
      piedra(c, p.x, p.y, R * u, k.angle, 77, T_ROCA, 0.9);
      if (ms < carga && Math.random() < 0.7) { const a = rand(0, Math.PI * 2), d = g.size * rand(1, 1.5); k.emit({ x: p.x + Math.cos(a) * d, y: p.y + Math.sin(a) * d, vx: -Math.cos(a) * d * 5, vy: -Math.sin(a) * d * 5, drag: 3, life: 180, size: rand(2.5, 4), color: T_ROCA.base, accent: T_ROCA.borde, shape: 'rock', spin: 8 }); }
    }, { z: 1 });
    await k.esperar(carga);
    await k.embestida({ hasta: 0.9, ida: 160, vuelta: 320, arco: 8, estela: ROCA.glow });
    rompe = true;
    await k.impacto(t => {
      k.add(E.flash({ color: ROCA.hot, alpha: 0.45, duration: 240 }));
      k.add(E.starburst({ at: t.center, rays: 16, length: t.size * 1.6, width: 8, palette: ROCA, duration: 400 }));
      for (let i = 0; i < 3; i++) k.add(E.ring({ at: t.center, from: 8, to: t.size * (1 + i * 0.5), width: 6 - i, color: i ? ROCA.glow : '#ffffff', duration: 440, delay: i * 70 }));
      cascotes(k, t.center, 32, 480, 6);
      polvo(k, t.feet, 12, t.size * 0.4, ROCA.glow, 0.45);
      k.add(E.cracks({ at: t.feet, length: t.size * 1.2, color: '#2a1808', duration: 900 }));
      void k.stage.shake(10, 420);
    });
    await k.esperar(300);
    await k.despues();
  },

  // ===========================================================================================
  // TIERRA

  // Terratemblor (60): el usuario pisa fuerte y una ola recorre el suelo: montículos de tierra que suben y bajan
  // camino del objetivo, con polvo, hasta levantarlo.
  async bulldoze(k) {
    const g = k.user;
    await k.saltar(g.sprite, g.size * 0.15, 180);
    ondaSuelo(k, g.feet, g.size * 0.9, TIERRA.glow, 320);
    polvo(k, g.feet, 5, g.size * 0.25);
    const ms = 340, paso = 0.07;
    k.dibujar(ms + 160, (c, t) => {
      const frente = (t * (ms + 160)) / ms;
      for (let s = 0.1; s <= 1.05; s += paso) {
        const d = frente - s, h = d > 0 && d < 0.35 ? Math.sin((d / 0.35) * Math.PI) : 0;
        if (h <= 0.02) continue;
        const p = suelo(k, s, Math.sin(s * 23) * k.s(0.06));
        monticulo(c, p.x, p.y, k.s(0.2) * (0.5 + 0.5 * h) * (0.8 + 0.4 * s));
      }
      if (frente <= 1.05 && Math.random() < 0.8) { const p = suelo(k, Math.min(1, frente)); k.emit({ x: p.x, y: p.y, vx: rand(-50, 50), vy: -rand(20, 60), life: 500, size: k.s(0.12), sizeEnd: k.s(0.3), color: TIERRA.glow, alpha: 0.4, shape: 'smoke' }); }
    });
    await k.esperar(ms);
    await k.impacto(t => {
      cascotes(k, t.feet, 12, 300, 3.2, T_TIERRA);
      polvo(k, t.feet, 8, t.size * 0.3);
      ondaSuelo(k, t.feet, t.size * 1.2, TIERRA.glow, 360, 4);
    });
    await k.esperar(100);
    await k.despues();
  },

  // Excavar (80, carga): el usuario se hunde en un agujero, un surco de tierra corre bajo el suelo hasta el objetivo
  // y sale de golpe bajo él entre cascotes; luego vuelve de un salto.
  async dig(k) {
    const g = k.user, hunde = 220, bajo = 340, f0 = g.feet, f1 = k.target.feet;
    k.dibujar(hunde + bajo + 500, (c, t) => {
      const ms = t * (hunde + bajo + 500), r = g.size * 0.4 * easeOut(Math.min(1, ms / 140)) * (ms > hunde + bajo + 300 ? 1 - (ms - hunde - bajo - 300) / 200 : 1);
      agujero(c, f0.x, f0.y, r);
    }, { z: 0 });
    polvo(k, f0, 6, g.size * 0.3);
    cascotes(k, f0, 8, 220, 3, T_TIERRA);
    void k.animar(g.sprite, [{ transform: 'translate(0px, 0px) scale(1, 1)' }, { transform: 'translate(0px, -6px) scale(0.9, 1.1)', offset: 0.3 }, { transform: `translate(0px, ${g.size * 0.35}px) scale(1.1, 0.4)` }], hunde, 'ease-in');
    void k.animar(g.sprite, [{ opacity: 1 }, { opacity: 1, offset: 0.4 }, { opacity: 0 }], hunde);
    await k.esperar(hunde - 20);
    // El surco que avanza bajo tierra.
    k.dibujar(bajo, (c, t) => {
      const u = easeOut(t) * 0.92 + t * 0.08, p = { x: lerp(f0.x, f1.x, u), y: lerp(f0.y, f1.y, u) };
      c.save(); c.strokeStyle = 'rgba(90, 58, 24, 0.55)'; c.lineWidth = k.s(0.08); c.lineCap = 'round';
      c.beginPath(); c.moveTo(f0.x, f0.y); c.lineTo(p.x, p.y); c.stroke(); c.restore();
      monticulo(c, p.x, p.y, k.s(0.22) * (1 + 0.15 * Math.sin(t * 40)));
      if (Math.random() < 0.7) cascotes(k, p, 1, 140, 2.5, T_TIERRA);
    }, { z: 0 });
    await k.esperar(bajo);
    const lejos = Math.max(0, k.dist - k.target.size * 0.35), v = { x: k.dir.x * lejos, y: k.dir.y * lejos + k.target.size * 0.05 };
    void k.animar(g.sprite, [{ opacity: 0 }, { opacity: 1 }], 80);
    void k.animar(g.sprite, [{ transform: `translate(${v.x}px, ${v.y + g.size * 0.3}px) scale(1.1, 0.4)` }, { transform: `translate(${v.x}px, ${v.y - g.size * 0.6}px) scale(0.92, 1.12)`, offset: 0.55 }, { transform: `translate(${v.x}px, ${v.y}px) scale(1, 1)` }], 260, 'ease-out');
    k.dibujar(500, (c, t) => agujero(c, f1.x, f1.y, k.s(0.42) * (t < 0.7 ? 1 : 1 - (t - 0.7) / 0.3)), { z: 0 });
    cascotes(k, f1, 20, 420, 4, T_TIERRA);
    polvo(k, f1, 10, k.s(0.35));
    await k.esperar(60);
    await k.impacto(t => {
      ondaSuelo(k, t.feet, t.size * 1.3, TIERRA.glow, 380, 4);
      k.add(E.starburst({ at: t.center, rays: 8, length: t.size * 0.8, width: 4, palette: TIERRA, duration: 280 }));
    });
    await k.esperar(160);
    void k.animar(g.sprite, [{ transform: `translate(${v.x}px, ${v.y}px) scale(1, 1)` }, { transform: `translate(${v.x * 0.5}px, ${v.y * 0.5 - g.size * 0.6}px) scale(0.95, 1.05)`, offset: 0.5 }, { transform: 'translate(0px, 0px) scale(1, 1)' }], 320);
    await k.despues();
  },

  // Taladradora (80): delante del usuario se forma un taladro de tierra que gira cada vez más rápido; embiste con él,
  // escupiendo tierra, y perfora al objetivo entre chispas.
  async drillrun(k) {
    const g = k.user, gira = 170, r = g.size * 0.45;
    let giro = 0, vel = 2;
    k.dibujar(gira + 160 + 220, (c, t) => {
      const ms = t * (gira + 160 + 220), p = k.posSprite(g), q = { x: p.x + k.dir.x * g.size * 0.6, y: p.y + k.dir.y * g.size * 0.6 };
      vel = Math.min(9, vel + 0.25); giro += vel / 60;
      c.globalAlpha = ms > gira + 160 + 120 ? 1 - (ms - gira - 280) / 100 : 1;
      taladro(c, q.x, q.y, r * easeOut(Math.min(1, ms / 120)), k.angle, giro);
      if (Math.random() < 0.6) { const a = k.angle + Math.PI + rand(-0.9, 0.9); k.emit({ x: q.x, y: q.y, vx: Math.cos(a) * 220, vy: Math.sin(a) * 220 - 60, ay: 700, life: 380, size: rand(2, 3.5), color: pick([T_TIERRA.base, T_TIERRA.claro]), accent: T_TIERRA.borde, shape: 'rock', spin: 10 }); }
    }, { z: 1 });
    await k.esperar(gira);
    await k.embestida({ hasta: 0.85, ida: 160, vuelta: 300, estela: TIERRA.glow });
    await k.impacto(t => {
      // Barrena: chispas y tierra que salen despedidas hacia atrás mientras sigue girando.
      k.dibujar(220, () => {
        for (let i = 0; i < 2; i++) { const a = k.angle + Math.PI + rand(-1, 1); k.emit({ x: t.center.x - k.dir.x * t.size * 0.3, y: t.center.y - k.dir.y * t.size * 0.3, vx: Math.cos(a) * 300, vy: Math.sin(a) * 300, drag: 3, life: 240, size: rand(1.5, 2.5), color: pick([CHISPA.glow, TIERRA.hot]), shape: 'streak', stretch: 30 }); }
      });
      cascotes(k, t.center, 12, 300, 3, T_TIERRA, 0, { x: -k.dir.x * 120, y: -k.dir.y * 120 });
      k.add(E.ring({ at: t.center, from: 4, to: t.size * 0.8, width: 3, color: TIERRA.glow, duration: 300 }));
    });
    await k.esperar(180);
    await k.despues();
  },

  // Tierra Viva (90): el suelo bajo el objetivo se resquebraja con grietas de lava que brillan; de ellas brotan
  // columnas de tierra incandescente que lo lanzan por los aires entre brasas.
  async earthpower(k) {
    await k.cargar(100);
    const f = k.target.feet, prep = 300, sube = 120, queda = 160, baja = 200;
    const grietas = Array.from({ length: 5 }, (_, i) => { const a = (i / 5) * Math.PI * 2 + rand(-0.3, 0.3); return trazaGrieta(f, k.alrededor(f, k.s(rand(0.7, 1.0)), a, 0.5), 4, k.s(0.08)); });
    k.dibujar(prep + sube + queda + baja, (c, t, engine) => {
      const ms = t * (prep + sube + queda + baja), u = Math.min(1, ms / (prep * 0.8)), fuera = ms > prep + sube + queda ? 1 - (ms - prep - sube - queda) / baja : 1;
      c.globalAlpha = fuera;
      luz(c, engine, f, k.s(0.9) * u, MAGMA.core, 0.35 + 0.2 * Math.sin(ms / 40));
      for (const g of grietas) pintaGrieta(c, parcial(g, u), Math.max(2, k.s(0.04)), MAGMA.glow);
    }, { z: 0 });
    void k.agitar(k.target.sprite, 2, prep);
    const columnas = [{ x: 0, d: 0 }, { x: -0.4, d: 60 }, { x: 0.42, d: 110 }].map(o => ({ p: { x: f.x + k.s(o.x), y: f.y + k.s(Math.abs(o.x) * 0.1) }, d: prep + o.d, h: k.s(o.x === 0 ? 1.5 : 1.1), w: k.s(o.x === 0 ? 0.22 : 0.15) })).sort((a, b) => a.p.y - b.p.y);
    for (const col of columnas) {
      k.dibujar(sube + queda + baja, (c, t, engine) => {
        const ms = t * (sube + queda + baja), u = ms < sube ? easeOutCubic(ms / sube) : ms < sube + queda ? 1 : 1 - easeIn((ms - sube - queda) / baja);
        const h = col.h * u, w = col.w * (0.7 + 0.3 * u), { x, y } = col.p;
        if (h < 1) return;
        c.save();
        c.beginPath(); c.moveTo(x - w, y); c.quadraticCurveTo(x - w * 0.8, y - h * 0.6, x - w * 0.55, y - h); c.arc(x, y - h, w * 0.55, Math.PI, 0); c.quadraticCurveTo(x + w * 0.8, y - h * 0.6, x + w, y); c.closePath();
        c.fillStyle = lineal(c, x - w, 0, x + w, 0, [T_TIERRA.oscuro, T_TIERRA.base, MAGMA.core, T_TIERRA.base, T_TIERRA.oscuro]); c.fill();
        c.lineWidth = Math.max(1.2, w * 0.1); c.strokeStyle = T_TIERRA.borde; c.stroke();
        c.restore();
        luz(c, engine, { x, y: y - h * 0.5 }, w * 1.6, MAGMA.glow, 0.5 * u);
        if (Math.random() < 0.6 * u) k.emit({ x: x + rand(-w, w) * 0.5, y: y - h, vx: rand(-60, 60), vy: -rand(80, 200), ay: 300, life: 500, size: rand(2, 4), sizeEnd: 0, color: pick([MAGMA.core, MAGMA.glow, MAGMA.hot]), shape: 'glow' });
      }, { z: 1, delay: col.d });
      cascotes(k, col.p, 5, 320, 3, T_TIERRA, col.d);
    }
    await k.esperar(prep + 40);
    await k.impacto(t => {
      E.fireBurst(k.stage, t.center, MAGMA, t.size * 0.9);
      polvo(k, t.feet, 8, t.size * 0.3);
      ondaSuelo(k, t.feet, t.size * 1.3, MAGMA.glow, 380, 4);
    });
    await k.esperar(sube + queda);
    await k.despues();
  },

  // Terremoto (100): el usuario salta y cae con todo su peso; la vista tiembla, ondas de choque recorren el suelo y
  // una grieta enorme con ramas corre hasta el objetivo levantando rocas.
  async earthquake(k) {
    const g = k.user, corre = 360;
    k.add(E.dim({ at: g.center, duration: 1200, strength: 0.4 }));
    await k.saltar(g.sprite, g.size * 0.6, 280);
    void k.stage.shake(7, 760);
    polvo(k, g.feet, 12, g.size * 0.4);
    for (let i = 0; i < 3; i++) ondaSuelo(k, g.feet, Math.max(k.dist * 1.4, g.size * 3) * (0.6 + i * 0.25), i ? TIERRA.glow : TIERRA.hot, 620, 5 - i, i * 120);
    const fin = suelo(k, 1.15), principal = trazaGrieta(g.feet, fin, 8, k.s(0.18));
    const ramas = principal.slice(2, -1).map((p, i) => trazaGrieta(p, { x: p.x + k.perp.x * k.s(0.6) * (i % 2 ? 1 : -1) + k.dir.x * k.s(0.3), y: p.y + k.perp.y * k.s(0.4) * (i % 2 ? 1 : -1) }, 3, k.s(0.08)));
    const cercanas = [0, 1, 2, 3].map(i => trazaGrieta(g.feet, k.alrededor(g.feet, g.size * rand(0.7, 1.1), i * 1.57 + rand(-0.4, 0.4) + 0.78, 0.5), 3, g.size * 0.06));
    let ultimo = 0;
    k.dibujar(corre + 600, (c, t) => {
      const ms = t * (corre + 600), u = Math.min(1, ms / corre), fuera = ms > corre + 300 ? 1 - (ms - corre - 300) / 300 : 1;
      c.globalAlpha = fuera;
      for (const cg of cercanas) pintaGrieta(c, parcial(cg, Math.min(1, ms / 120)), Math.max(2, g.size * 0.05));
      ramas.forEach((r, i) => { const v = (u * principal.length - (i + 2)) / 2; if (v > 0) pintaGrieta(c, parcial(r, v), Math.max(1.5, k.s(0.035))); });
      pintaGrieta(c, parcial(principal, u), Math.max(3, k.s(0.07)));
      // Rocas que saltan en la punta de la grieta.
      const n = Math.floor(u * 8);
      if (n > ultimo && u < 1) { ultimo = n; const cab = parcial(principal, u).at(-1)!; cascotes(k, cab, 3, 260, 3, T_TIERRA); polvo(k, cab, 2, k.s(0.2), TIERRA.glow, 0.35); }
    }, { z: 0 });
    void k.agitar(k.target.sprite, 3, corre);
    await k.esperar(corre);
    await k.impacto(t => {
      cascotes(k, t.feet, 22, 420, 4.5, T_TIERRA);
      polvo(k, t.feet, 12, t.size * 0.4, TIERRA.glow, 0.45);
      ondaSuelo(k, t.feet, t.size * 1.8, TIERRA.hot, 460, 5);
      k.add(E.starburst({ at: t.feet, rays: 10, length: t.size * 1.1, width: 5, palette: TIERRA, duration: 340 }));
    });
    await k.esperar(300);
    await k.despues();
  },

  // Fisura (KO directo): una grieta corre hasta el objetivo y bajo él la tierra se abre en una sima enorme, honda y
  // oscura con un resplandor rojo al fondo; el objetivo se hunde, el suelo ruge y la sima se vuelve a cerrar.
  async fissure(k) {
    const corre = 220, abre = 300, queda = 260, cierra = 260;
    k.add(E.dim({ at: k.target.center, duration: corre + abre + queda + cierra, strength: 0.5 }));
    await k.saltar(k.user.sprite, k.user.size * 0.2, 180);
    const camino = trazaGrieta(k.user.feet, k.target.feet, 6, k.s(0.12));
    k.dibujar(corre + 200, (c, t) => { c.globalAlpha = t > 0.6 ? 1 - (t - 0.6) / 0.4 : 1; pintaGrieta(c, parcial(camino, (t * (corre + 200)) / corre), Math.max(2.5, k.s(0.05))); }, { z: 0 });
    void k.stage.shake(5, corre + abre + queda);
    await k.esperar(corre);
    const f = k.target.feet, L = k.s(1.7), eje = { x: k.perp.x, y: k.perp.y * 0.55 }, ln = Math.hypot(eje.x, eje.y) || 1, e = { x: eje.x / ln, y: eje.y / ln };
    const n = 12, borde = Array.from({ length: n + 1 }, (_, i) => ({ s: i / n, a: rand(0.6, 1), b: rand(0.6, 1) }));
    const ancho = k.s(0.42);
    k.dibujar(abre + queda + cierra, (c, t, engine) => {
      const ms = t * (abre + queda + cierra), u = ms < abre ? easeOutCubic(ms / abre) : ms < abre + queda ? 1 : 1 - easeIn((ms - abre - queda) / cierra);
      const punto = (s: number, h: number) => ({ x: f.x + e.x * L * (s - 0.5), y: f.y + e.y * L * (s - 0.5) + h });
      const abierto = (s: number) => Math.sin(Math.PI * s) ** 0.6 * ancho * u;
      const arriba = borde.map(b => punto(b.s, -abierto(b.s) * 0.45 * b.a)), abajo = borde.map(b => punto(b.s, abierto(b.s) * 0.55 * b.b));
      c.save();
      c.beginPath(); arriba.forEach((p, i) => (i ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y))); for (let i = abajo.length - 1; i >= 0; i--) c.lineTo(abajo[i].x, abajo[i].y); c.closePath();
      c.fillStyle = lineal(c, 0, f.y - ancho * 0.45, 0, f.y + ancho * 0.55, ['#5e3a14', '#1a0c04', '#080302', '#2a1206']); c.fill();
      c.lineJoin = 'round'; c.lineWidth = Math.max(2, k.s(0.04)); c.strokeStyle = '#e8c890'; c.stroke();
      c.restore();
      luz(c, engine, { x: f.x, y: f.y + ancho * 0.1 * u }, k.s(0.6) * u, '#ff3a10', 0.35 * u);
      if (u > 0.3 && Math.random() < 0.5) { const p = punto(rand(0.1, 0.9), -abierto(0.5) * 0.4); k.emit({ x: p.x, y: p.y, vx: rand(-30, 30), vy: -rand(40, 90), life: 600, size: k.s(0.15), sizeEnd: k.s(0.35), color: TIERRA.glow, alpha: 0.4, shape: 'smoke' }); }
    }, { z: 0 });
    if (k.acierta && k.target.sprite) void k.animar(k.target.sprite, [{ transform: 'translate(0px, 0px) scale(1, 1)' }, { transform: `translate(0px, ${k.target.size * 0.35}px) scale(0.95, 0.8)` }], abre, 'ease-in');
    cascotes(k, f, 16, 380, 4, T_TIERRA);
    await k.esperar(abre + 60);
    await k.impacto(t => {
      k.add(E.flash({ color: '#ff6a2a', alpha: 0.2, duration: 220 }));
      polvo(k, t.feet, 14, t.size * 0.45, TIERRA.glow, 0.45);
      ondaSuelo(k, t.feet, t.size * 2, TIERRA.hot, 480, 5);
      void k.stage.shake(10, 400);
    });
    await k.esperar(queda + cierra - 120);
    await k.despues();
  },

  // Arremetida (120): el usuario se lanza tras un puño enorme de tierra prensada que ara el suelo abriendo un surco y
  // escupiendo tierra; el choque revienta en una explosión de rocas.
  async headlongrush(k) {
    const g = k.user, forma0 = 220;
    k.add(E.dim({ at: g.center, duration: 1000, strength: 0.4 }));
    await k.anticipar(110);
    const sitio = () => { const u = k.posSprite(g); return { x: u.x + k.dir.x * g.size * 0.62, y: u.y + k.dir.y * g.size * 0.62 }; };
    let fin = false;
    k.dibujar(forma0 + 300 + 260, (c, t, engine) => {
      const ms = t * (forma0 + 300 + 260), p = sitio(), r = k.s(0.4) * easeOut(Math.min(1, ms / forma0)) * (fin ? 1 + (ms - forma0 - 300) / 400 : 1);
      c.globalAlpha = fin ? Math.max(0, 1 - (ms - forma0 - 300) / 200) : 1;
      luz(c, engine, p, r * 1.6, TIERRA.core, 0.4);
      forma(c, 'puno', p.x, p.y, r, k.angle, estiloTierra(8), k.dir.x < 0 && Math.abs(k.dir.y) < 0.7);
      if (!fin && ms > forma0) {
        const s = { x: p.x, y: p.y + g.size * 0.35 };
        for (let i = 0; i < 2; i++) { const a = k.angle + Math.PI + rand(-0.8, 0.8); k.emit({ x: s.x, y: s.y, vx: Math.cos(a) * 220, vy: Math.sin(a) * 120 - rand(100, 240), ay: 900, life: 420, size: rand(2.5, 4), color: pick([T_TIERRA.base, T_TIERRA.claro]), accent: T_TIERRA.borde, shape: 'rock', spin: 10 }); }
        if (Math.random() < 0.6) k.emit({ x: s.x, y: s.y, vx: rand(-40, 40), vy: -rand(20, 60), life: 600, size: g.size * 0.15, sizeEnd: g.size * 0.4, color: TIERRA.glow, alpha: 0.4, shape: 'smoke' });
      }
    }, { z: 1 });
    // El surco que va abriendo.
    const f0 = g.feet;
    k.dibujar(300 + 500, (c, t) => {
      const ms = t * 800, u = Math.min(1, ms / 300) * 0.85, p = suelo(k, u);
      c.save(); c.globalAlpha = ms > 500 ? 1 - (ms - 500) / 300 : 1; c.lineCap = 'round';
      c.strokeStyle = T_TIERRA.claro; c.lineWidth = k.s(0.2); c.beginPath(); c.moveTo(f0.x, f0.y); c.lineTo(p.x, p.y); c.stroke();
      c.strokeStyle = '#3a2410'; c.lineWidth = k.s(0.1); c.stroke();
      c.restore();
    }, { z: 0, delay: forma0 });
    await k.esperar(forma0);
    await k.embestida({ hasta: 0.85, ida: 300, vuelta: 320, estela: TIERRA.glow });
    fin = true;
    await k.impacto(t => {
      k.add(E.flash({ color: TIERRA.glow, alpha: 0.3, duration: 220 }));
      k.add(E.starburst({ at: t.center, rays: 12, length: t.size * 1.3, width: 7, palette: TIERRA, duration: 360 }));
      cascotes(k, t.center, 26, 460, 5, T_TIERRA);
      polvo(k, t.feet, 14, t.size * 0.45, TIERRA.glow, 0.45);
      ondaSuelo(k, t.feet, t.size * 1.8, TIERRA.hot, 460, 5);
      void k.stage.shake(8, 360);
    });
    await k.esperar(280);
    await k.despues();
  },

  // Fuerza Equina (95): el usuario galopa dejando huellas de herradura en el suelo, y una herradura de acero gigante
  // cae como un casco sobre el objetivo.
  async highhorsepower(k) {
    const g = k.user, ida = 300;
    await k.anticipar(90);
    void k.embestida({ hasta: 0.6, ida, vuelta: 300, estela: TIERRA.glow });
    for (let i = 0; i < 6; i++) {
      const p = suelo(k, 0.1 + i * 0.1, (i % 2 ? 1 : -1) * g.size * 0.18), d = 30 + i * 45;
      k.dibujar(600, (c, t) => { c.globalAlpha = (t < 0.1 ? t * 10 : 1) * (1 - easeIn(t)) * 0.8; herradura(c, p.x, p.y, g.size * 0.14, k.angle, true); }, { z: 0, delay: d });
      polvo(k, p, 2, g.size * 0.15, TIERRA.glow, 0.35, d);
    }
    const t0 = k.target, R = k.s(0.42), ini = { x: t0.center.x - k.dir.x * k.s(0.2), y: t0.center.y - k.s(1.1) }, fin = { x: t0.center.x, y: t0.center.y - k.s(0.05) };
    const cae = 140, d0 = ida - 60;
    k.dibujar(cae + 200, (c, t, engine) => {
      const ms = t * (cae + 200), u = easeIn(Math.min(1, ms / cae)), p = { x: lerp(ini.x, fin.x, u), y: lerp(ini.y, fin.y, u) };
      c.globalAlpha = ms < cae ? Math.min(1, ms / 50) : 1 - (ms - cae) / 200;
      luz(c, engine, p, R * 1.6, CHISPA.glow, 0.4);
      // De canto, cayendo: la curva hacia abajo.
      c.save(); c.translate(p.x, p.y); c.scale(1, ms < cae ? 1 : 1 - 0.2 * ((ms - cae) / 200)); herradura(c, 0, 0, R, Math.PI / 2, false, (ms / (cae + 200)) * 0.8 + 0.1); c.restore();
      if (ms < cae) for (let i = 0; i < 2; i++) k.emit({ x: p.x + rand(-R, R) * 0.7, y: p.y - R, vy: -300, life: 120, size: 2, color: ACERO.glow, shape: 'streak', stretch: 50 });
    }, { z: 1, delay: d0 });
    await k.esperar(d0 + cae);
    await k.impacto(t => {
      ondaSuelo(k, t.feet, t.size * 1.4, TIERRA.hot, 400, 4);
      k.dibujar(700, (c, tt) => { c.globalAlpha = 0.8 * (1 - easeIn(tt)); herradura(c, t.feet.x, t.feet.y, t.size * 0.42, -Math.PI / 2, true); }, { z: 0 });
      cascotes(k, t.feet, 14, 320, 3.5, T_TIERRA);
      polvo(k, t.feet, 10, t.size * 0.35);
      E.sparks(k.fx, t.center, { count: 10, speed: [160, 320], palette: CHISPA, shape: 'streak' });
    });
    await k.esperar(160);
    await k.despues();
  },

  // Disparo Lodo (55): tres bolas de barro salen escupidas una tras otra, goteando, y revientan en salpicaduras
  // marrones sobre el objetivo.
  async mudshot(k) {
    await k.anticipar(70);
    void k.recuperar({ x: -k.dir.x * 8, y: -k.dir.y * 8 }, 220);
    const n = 3, cada = 90, ms = 230, r = k.s(0.15);
    const bola = (c: CanvasRenderingContext2D, p: Vec, rr: number, t: number) => {
      c.save(); c.beginPath();
      for (let i = 0; i <= 10; i++) { const a = (i / 10) * Math.PI * 2, q = rr * (0.85 + 0.15 * Math.sin(a * 3 + t * 20)); if (i) c.lineTo(p.x + Math.cos(a) * q, p.y + Math.sin(a) * q); else c.moveTo(p.x + Math.cos(a) * q, p.y + Math.sin(a) * q); }
      c.closePath(); c.fillStyle = lineal(c, p.x - rr, p.y - rr, p.x + rr, p.y + rr, [BARRO.hot, BARRO.glow, BARRO.core, BARRO.dark]); c.fill();
      c.lineWidth = Math.max(1, rr * 0.1); c.strokeStyle = '#24140a'; c.stroke();
      c.fillStyle = 'rgba(255, 240, 220, 0.6)'; c.beginPath(); c.ellipse(p.x - rr * 0.35, p.y - rr * 0.35, rr * 0.25, rr * 0.15, -0.6, 0, Math.PI * 2); c.fill();
      c.restore();
    };
    const salpica = (p: Vec, delay: number) => k.burst(10, () => { const a = rand(0, Math.PI * 2), v = rand(100, 260); return { x: p.x, y: p.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 60, ay: 700, life: rand(360, 520), delay, size: rand(2.5, 4.5), color: pick([BARRO.core, BARRO.glow]), shape: 'drop', stretch: 30 }; });
    for (let i = 0; i < n; i++) {
      const lado = (i - 1) * k.s(0.12), fin = k.acierta ? k.enCuerpo(k.target, 0.2) : k.punto(1.5, lado * 3), ini = k.punto(0.15);
      k.dibujar(ms, (c, t) => {
        const p = { x: lerp(ini.x, fin.x, t), y: lerp(ini.y, fin.y, t) - Math.sin(Math.PI * t) * k.s(0.2) };
        if (Math.random() < 0.5) k.emit({ x: p.x, y: p.y + r * 0.6, vy: 60, ay: 600, life: 300, size: 2.5, color: BARRO.core, shape: 'drop', stretch: 20 });
        bola(c, p, r, t);
      }, { z: 1, delay: i * cada });
      if (i > 0 && k.acierta) salpica(fin, i * cada + ms);
    }
    await k.esperar(ms);
    await k.impacto(t => {
      salpica(t.center, 0);
      // Manchas de barro que se le quedan pegadas un momento.
      const manchas = Array.from({ length: 5 }, () => ({ p: k.enCuerpo(t, 0.3), r: t.size * rand(0.06, 0.11) }));
      k.dibujar(700, (c, tt) => { c.globalAlpha = 0.85 * (1 - easeIn(tt)); c.fillStyle = BARRO.core; for (const m of manchas) { c.beginPath(); c.ellipse(m.p.x, m.p.y + tt * 4, m.r, m.r * 0.8, 0, 0, Math.PI * 2); c.fill(); } }, { z: 1 });
    });
    await k.esperar((n - 1) * cada + 60);
    await k.despues();
  },

  // Bofetón Lodo (20): un manotazo rápido lanza un abanico de gotitas de barro a la cara del objetivo.
  async mudslap(k) {
    await k.anticipar(60);
    void k.embestida({ hasta: 0.25, ida: 90, vuelta: 200 });
    const cara = k.hayObjetivo ? { x: k.target.center.x, y: k.target.top.y + k.target.size * 0.2 } : k.punto(1), ini = k.punto(0.2), viaje = 0.22;
    k.burst(18, i => {
      const fin = { x: cara.x + rand(-1, 1) * k.s(0.3), y: cara.y + rand(-1, 1) * k.s(0.2) };
      return { x: ini.x + rand(-4, 4), y: ini.y + rand(-4, 4), vx: (fin.x - ini.x) / viaje, vy: (fin.y - ini.y) / viaje - 80, ay: 700, life: viaje * 1000 + rand(0, 60), delay: i * 5, size: rand(2, 3.5), color: pick([BARRO.core, BARRO.glow, BARRO.dark]), shape: 'drop', stretch: 25 };
    });
    await k.esperar(viaje * 1000);
    await k.impacto(t => {
      k.burst(8, () => ({ x: cara.x + rand(-6, 6), y: cara.y + rand(-4, 4), vx: rand(-80, 80), vy: rand(-60, 20), ay: 500, life: 380, size: rand(2, 3.5), color: BARRO.core, shape: 'drop', stretch: 20 }));
      k.burst(4, () => ({ x: cara.x + rand(-t.size * 0.2, t.size * 0.2), y: cara.y + rand(-4, 4), vy: 12, life: 600, size: t.size * rand(0.05, 0.09), color: BARRO.core, alpha: 0.85, shape: 'dot' }));
    });
    await k.despues();
  },

  // Fertilizante: el suelo alrededor del usuario se remueve en surcos: terrones que saltan uno tras otro y, de cada
  // uno, un brote verde.
  async rototiller(k) {
    const g = k.user, filas = 3, porFila = 5, cada = 28;
    let i = 0;
    for (let f = 0; f < filas; f++) for (let j = 0; j < porFila; j++, i++) {
      const p = { x: g.feet.x + (j / (porFila - 1) - 0.5) * g.size * 1.8 + (f % 2 ? g.size * 0.15 : 0), y: g.feet.y + (f - 1) * g.size * 0.28 }, d = i * cada;
      k.dibujar(520, (c, t) => {
        const u = t < 0.25 ? easeOut(t / 0.25) : 1;
        c.globalAlpha = t > 0.75 ? 1 - (t - 0.75) / 0.25 : 1;
        monticulo(c, p.x, p.y, g.size * 0.13 * u);
        if (t > 0.3) { const b = Math.min(1, (t - 0.3) / 0.2); c.save(); c.strokeStyle = '#3a8a2a'; c.lineWidth = 1.6; c.beginPath(); c.moveTo(p.x, p.y - g.size * 0.04); c.lineTo(p.x, p.y - g.size * 0.14 * b); c.stroke(); c.restore(); forma(c, 'hoja', p.x + g.size * 0.05 * b, p.y - g.size * 0.14 * b, g.size * 0.06 * b, -0.6, { base: '#6ad04a', borde: '#1d5c17' }); }
      }, { delay: d });
      cascotes(k, p, 2, 120, 2, T_TIERRA, d);
    }
    await k.esperar(filas * porFila * cada);
    await k.estado();
  },

  // Ataque Arena: el usuario da una patada al suelo y una nube de arena vuela en abanico a la cara del objetivo.
  async sandattack(k) {
    await k.anticipar(70);
    void k.recuperar({ x: -k.dir.x * 8, y: -k.dir.y * 8 }, 200);
    const ini = suelo(k, 0.12), cara = k.hayObjetivo ? { x: k.target.center.x, y: k.target.top.y + k.target.size * 0.25 } : k.punto(1), viaje = 0.26;
    polvo(k, ini, 3, k.user.size * 0.2, ARENA.glow, 0.4);
    k.burst(32, i => {
      const fin = { x: cara.x + rand(-1, 1) * k.s(0.35), y: cara.y + rand(-1, 1) * k.s(0.25) };
      return { x: ini.x, y: ini.y, vx: (fin.x - ini.x) / viaje, vy: (fin.y - ini.y) / viaje - 120, ay: 900, life: viaje * 1000 + rand(0, 80), delay: i * 4, size: rand(1.2, 2.4), color: pick([ARENA.core, ARENA.glow, ARENA.dark]), shape: 'dot' };
    });
    await k.esperar(viaje * 1000);
    k.burst(6, () => ({ x: cara.x + rand(-k.s(0.2), k.s(0.2)), y: cara.y + rand(-4, 4), vx: rand(-30, 30), vy: rand(-20, 10), life: 700, size: k.s(0.12), sizeEnd: k.s(0.3), color: ARENA.glow, alpha: 0.45, shape: 'smoke' }));
    if (k.hayObjetivo) void k.agitar(k.target.sprite, 2, 260);
    await k.estado();
  },

  // Bucle Arena (35): un chorro de arena llega hasta el objetivo y lo envuelve en un embudo que gira y lo hunde.
  async sandtomb(k) {
    await k.anticipar(70);
    void k.recuperar({ x: -k.dir.x * 8, y: -k.dir.y * 8 }, 200);
    const t0 = k.target, f = t0.feet, viaje = 200, gira = 560;
    k.dibujar(viaje, (_c, t) => { for (let i = 0; i < 3; i++) { const p = k.punto(t * 0.9 * rand(0.85, 1), rand(-1, 1) * k.s(0.1)); k.emit({ x: p.x, y: p.y, vx: k.dir.x * 300, vy: k.dir.y * 300, drag: 3, life: 220, size: rand(1.5, 2.5), color: pick([ARENA.core, ARENA.glow]), shape: 'streak', stretch: 30 }); } });
    await k.esperar(viaje);
    if (k.acierta && t0.sprite) void k.animar(t0.sprite, [{ transform: 'translate(0px, 0px)' }, { transform: `translate(0px, ${t0.size * 0.12}px)` }], 260, 'ease-in');
    k.dibujar(gira, (c, t) => {
      const u = easeOut(Math.min(1, t * 3)), fuera = t > 0.75 ? 1 - (t - 0.75) / 0.25 : 1;
      c.save(); c.globalAlpha = fuera; c.lineCap = 'round';
      for (let i = 0; i < 4; i++) {
        const h = i * k.s(0.22) * u, r = k.s(0.42 + 0.14 * i), y = f.y - h;
        c.setLineDash([r * 0.5, r * 0.3]); c.lineDashOffset = -t * 300 * (i % 2 ? 1 : 1.3);
        c.strokeStyle = i % 2 ? ARENA.glow : ARENA.core; c.lineWidth = k.s(0.06);
        c.beginPath(); c.ellipse(f.x, y, r, r * 0.32, 0, 0, Math.PI * 2); c.stroke();
      }
      c.restore();
      for (let i = 0; i < 2; i++) { const a = rand(0, Math.PI * 2), r = k.s(rand(0.4, 0.8)); k.emit({ x: f.x + Math.cos(a) * r, y: f.y - rand(0, k.s(0.6)) + Math.sin(a) * r * 0.3, vx: -Math.sin(a) * 280, vy: Math.cos(a) * 90 - 30, life: 260, size: rand(1.5, 2.4), color: pick([ARENA.core, ARENA.hot]), shape: 'streak', stretch: 35 }); }
    }, { z: 1 });
    await k.esperar(180);
    await k.impacto(t => polvo(k, t.feet, 6, t.size * 0.3, ARENA.glow, 0.4));
    await k.esperar(gira - 260);
    await k.despues();
  },

  // Pataleta (75): el usuario pisa tres veces el suelo con rabia (un pie que baja de golpe, polvo y grietas cada vez)
  // y la sacudida acumulada revienta bajo el objetivo.
  async stompingtantrum(k) {
    const g = k.user, pisa = 140;
    for (let i = 0; i < 3; i++) {
      void k.saltar(g.sprite, g.size * 0.12, pisa);
      const p = { x: g.feet.x + (i - 1) * g.size * 0.2, y: g.feet.y }, r = g.size * 0.3, izq = k.dir.x < 0;
      k.dibujar(pisa + 80, (c, t) => {
        const ms = t * (pisa + 80), u = easeIn(Math.min(1, ms / (pisa * 0.7)));
        c.globalAlpha = ms > pisa ? 1 - (ms - pisa) / 80 : 1;
        forma(c, 'pie', p.x, lerp(p.y - g.size * 0.8, p.y - r * 0.45, u), r, izq ? Math.PI : 0, estiloIra(6), izq);
      }, { z: 1, delay: i * pisa });
      ondaSuelo(k, p, g.size * (0.6 + i * 0.2), IRA.glow, 280, 3, i * pisa + pisa * 0.7);
      polvo(k, p, 3, g.size * 0.22, TIERRA.glow, 0.4, i * pisa + pisa * 0.7);
      k.burst(2, () => ({ x: g.top.x + rand(-10, 10), y: g.top.y, vx: rand(-40, 40), vy: -rand(40, 80), life: 400, delay: i * pisa + 60, size: g.size * 0.12, sizeEnd: g.size * 0.22, color: '#5a4a44', alpha: 0.4, shape: 'smoke' }));
    }
    k.add(E.cracks({ at: g.feet, length: g.size * 0.7, color: '#2a1808', duration: 3 * pisa + 400 }));
    await k.esperar(3 * pisa);
    const camino = trazaGrieta(g.feet, k.target.feet, 5, k.s(0.1));
    k.dibujar(260, (c, t) => { c.globalAlpha = t > 0.5 ? 1 - (t - 0.5) / 0.5 : 1; pintaGrieta(c, parcial(camino, t * 2.2), Math.max(2, k.s(0.04)), IRA.glow); }, { z: 0 });
    await k.esperar(110);
    await k.impacto(t => {
      cascotes(k, t.feet, 16, 380, 3.8, T_TIERRA);
      polvo(k, t.feet, 8, t.size * 0.3);
      ondaSuelo(k, t.feet, t.size * 1.3, IRA.glow, 380, 4);
      k.add(E.cracks({ at: t.feet, length: t.size * 0.8, color: '#2a1808', duration: 700 }));
    });
    await k.esperar(140);
    await k.despues();
  },

  // ===========================================================================================
  // ACERO

  // Aligerar: placas de metal se desprenden del usuario y caen tintineando al suelo; ya ligero, se sacude y deja
  // estelas como si fuese mucho más rápido.
  async autotomize(k) {
    const g = k.user, cae = 360;
    void k.agitar(g.sprite, 3, 200);
    const placas = Array.from({ length: 7 }, (_, i) => ({ ini: k.enCuerpo(g, 0.32), fin: { x: g.feet.x + rand(-1, 1) * g.size * 0.6, y: g.feet.y + rand(-0.15, 0.25) * g.size }, giro: rand(-8, 8), d: i * 30, w: g.size * rand(0.12, 0.18) }));
    for (const pl of placas) {
      k.dibujar(cae + 240, (c, t) => {
        const ms = t * (cae + 240), u = Math.min(1, ms / cae), rebota = u >= 1 ? Math.sin(Math.min(1, (ms - cae) / 120) * Math.PI) * g.size * 0.05 : 0;
        const p = { x: lerp(pl.ini.x, pl.fin.x, u), y: lerp(pl.ini.y, pl.fin.y, easeIn(u)) - Math.sin(Math.PI * u) * g.size * 0.25 - rebota };
        c.save(); c.globalAlpha = ms > cae + 120 ? 1 - (ms - cae - 120) / 120 : 1;
        c.translate(p.x, p.y); c.rotate(pl.giro * Math.min(u, 1)); c.scale(1, 0.7);
        c.fillStyle = degradadoMetal(c, -pl.w, -pl.w, pl.w, pl.w, 0.3 + u * 0.5); c.fillRect(-pl.w, -pl.w * 0.6, pl.w * 2, pl.w * 1.2);
        c.lineWidth = 1.2; c.strokeStyle = '#1c2a32'; c.strokeRect(-pl.w, -pl.w * 0.6, pl.w * 2, pl.w * 1.2);
        c.restore();
      }, { z: 1, delay: pl.d });
      k.emit({ x: pl.fin.x, y: pl.fin.y - 3, life: 200, delay: pl.d + cae, size: 5, sizeEnd: 0, color: '#ffffff', shape: 'star', spin: 8 });
    }
    await k.esperar(cae + 120);
    const atras = k.hayObjetivo ? { x: -k.dir.x, y: -k.dir.y } : { x: g.side === 'p1' ? -1 : 1, y: 0 };
    void k.saltar(g.sprite, g.size * 0.25, 220);
    for (let i = 1; i <= 3; i++) k.sombra(g.sprite, { x: atras.x * g.size * 0.3 * i, y: atras.y * g.size * 0.3 * i }, ACERO.glow, i * 25, 260);
    k.burst(10, () => ({ x: g.center.x + rand(-g.size * 0.4, g.size * 0.4), y: g.center.y + rand(-g.size * 0.4, g.size * 0.4), vx: atras.x * 480, vy: atras.y * 480, life: 200, size: 2, color: ACERO.hot, shape: 'streak', stretch: 40 }));
    await k.estado();
  },

  // Puño Bala (40): un puño cromado sale disparado recto como una bala, con líneas de velocidad y dos fantasmas
  // detrás; "ping" metálico al golpear.
  async bulletpunch(k) {
    void k.embestida({ hasta: 0.25, ida: 70, vuelta: 200, estela: ACERO.glow });
    const ms = 140, r = k.s(0.2);
    const fantasmas: Vec[] = [];
    await lanzaForma(k, 'puno', {
      ms, desde: 0.2, hasta: 0.86, tam: () => r, estilo: t => estiloMetal(0.2 + 0.6 * t, 8), queda: 120, crece: 0.15,
      cada: (p, _t, rr, c) => {
        fantasmas.unshift(p); if (fantasmas.length > 6) fantasmas.pop();
        for (const [j, a] of [[3, 0.3], [5, 0.15]] as const) { const q = fantasmas[j]; if (q) forma(c, 'puno', q.x, q.y, rr, k.angle, { base: ACERO.glow, borde: ACERO.dark, alpha: a }); }
        for (let i = 0; i < 2; i++) estela(k, p, rr, i ? '#ffffff' : ACERO.glow, 1);
      },
    });
    await k.impacto(t => {
      k.add(E.starburst({ at: t.center, rays: 4, length: t.size * 0.7, width: 3, palette: BLANCO, duration: 200 }));
      k.add(E.ring({ at: t.center, from: 4, to: t.size * 0.55, width: 2.5, color: '#ffffff', duration: 220 }));
      E.sparks(k.fx, t.center, { count: 10, speed: [200, 380], palette: CHISPA, shape: 'streak' });
    });
    await k.despues();
  },

  // Cañón Resplandor (80): un anillo de acero se cierra delante del usuario concentrando luz plateada y dispara un
  // rayo blanco grueso por el que corren anillos; el destello ciega al llegar.
  async flashcannon(k) {
    const g = k.user, carga = 200, dura = 460, boca = () => { const u = k.posSprite(g); return { x: u.x + k.dir.x * g.size * 0.55, y: u.y + k.dir.y * g.size * 0.55 }; };
    k.dibujar(carga, (c, t, engine) => {
      const p = boca(), r = g.size * (0.7 - 0.4 * easeOut(t));
      luz(c, engine, p, g.size * 0.5 * t, '#ffffff', 0.9);
      c.save(); c.translate(p.x, p.y); c.rotate(k.angle); c.scale(0.4, 1);
      c.strokeStyle = degradadoMetal(c, -r, -r, r, r, t); c.lineWidth = g.size * 0.12; c.beginPath(); c.arc(0, 0, r, 0, Math.PI * 2); c.stroke();
      c.restore();
      if (Math.random() < 0.6) k.emit({ x: p.x + rand(-g.size, g.size) * 0.5, y: p.y + rand(-g.size, g.size) * 0.5, life: 180, size: rand(3, 5), sizeEnd: 0, color: '#ffffff', shape: 'star', spin: 6 });
    }, { z: 1 });
    await k.esperar(carga);
    void k.recuperar({ x: -k.dir.x * 10, y: -k.dir.y * 10 }, 300);
    const ini = boca(), fin = k.acierta ? k.target.center : k.punto(1.6);
    k.add(E.beam({ from: ini, to: fin, width: k.s(0.3), palette: { core: ACERO.core, glow: ACERO.glow, hot: '#ffffff', dark: ACERO.dark }, duration: dura }));
    k.add(E.starburst({ at: ini, rays: 4, length: g.size * 0.8, width: 3, palette: BLANCO, duration: 260 }));
    // Anillos que recorren el rayo.
    k.dibujar(dura * 0.75, (c, t) => {
      for (let i = 0; i < 3; i++) {
        const u = (t * 2.2 + i / 3) % 1, p = { x: lerp(ini.x, fin.x, u), y: lerp(ini.y, fin.y, u) };
        c.save(); c.globalAlpha = Math.sin(Math.PI * u) * 0.9; c.translate(p.x, p.y); c.rotate(k.angle); c.scale(0.35, 1);
        c.strokeStyle = '#ffffff'; c.lineWidth = 3.5; c.beginPath(); c.arc(0, 0, k.s(0.3), 0, Math.PI * 2); c.stroke(); c.restore();
      }
    }, { z: 1, delay: 60 });
    await k.esperar(140);
    await k.impacto(t => {
      k.add(E.flash({ color: '#ffffff', alpha: 0.3, duration: 220 }));
      k.add(E.bloom({ at: t.center, radius: t.size * 1.2, color: '#ffffff', duration: 360 }));
      k.add(E.starburst({ at: t.center, rays: 10, length: t.size, width: 4, palette: ACERO, duration: 300 }));
    });
    await k.esperar(dura - 180);
    await k.despues();
  },

  // Giro Bola: un engranaje de acero gira alrededor del usuario mientras éste da vueltas y rueda contra el objetivo,
  // soltando chispas al rozar el suelo.
  async gyroball(k) {
    const g = k.user, ms = 640;
    let giro = 0, vel = 0.1;
    k.dibujar(ms, (c, t) => {
      const p = k.posSprite(g), r = g.size * 0.68 * easeOut(Math.min(1, t * 5)), sale = t > 0.85 ? (1 - t) / 0.15 : 1;
      vel = Math.min(0.5, vel + 0.02); giro += vel;
      c.globalAlpha = sale;
      engranaje(c, p.x, p.y, r, giro, (Math.sin(giro * 0.5) + 1) / 2);
      if (Math.random() < 0.7) { const q = { x: p.x, y: p.y + r * 0.95 }; k.emit({ x: q.x, y: q.y, vx: -k.dir.x * 200 + rand(-80, 80), vy: -rand(60, 200), ay: 700, life: 300, size: rand(1.4, 2.4), color: pick([CHISPA.core, CHISPA.glow, '#ffffff']), shape: 'streak', stretch: 20 }); }
    }, { z: 1 });
    await k.esperar(140);
    await k.embestida({ hasta: 0.85, ida: 220, vuelta: 280, estela: ACERO.glow });
    await k.impacto(t => {
      E.sparks(k.fx, t.center, { count: 26, speed: [220, 480], palette: CHISPA, shape: 'streak', gravity: 500 });
      k.add(E.ring({ at: t.center, from: 6, to: t.size * 0.9, width: 4, color: ACERO.glow, duration: 320 }));
      k.add(E.bloom({ at: t.center, radius: t.size * 0.8, color: '#ffffff', duration: 260 }));
    });
    await k.esperar(200);
    await k.despues();
  },

  // Cuerpo Pesado: el usuario, con brillo de acero, salta muy alto y cae a plomo sobre el objetivo (su sombra crece
  // en el suelo); el golpe hunde el suelo en una onda de acero.
  async heavyslam(k) {
    const g = k.user, ms = 480;
    k.destello(g.sprite, 180);
    await k.anticipar(100);
    const lejos = Math.max(0, k.dist - k.target.size * 0.2), v = { x: k.dir.x * lejos, y: k.dir.y * lejos }, H = Math.max(k.s(1.3), g.size * 1.3);
    void k.animar(g.sprite, [
      { transform: 'translate(0px, 0px) scale(1.05, 0.95)' },
      { transform: `translate(${v.x * 0.5}px, ${v.y * 0.5 - H}px) scale(0.92, 1.1)`, offset: 0.55 },
      { transform: `translate(${v.x}px, ${v.y - H * 0.2}px) scale(0.95, 1.08)`, offset: 0.88 },
      { transform: `translate(${v.x}px, ${v.y}px) scale(1.3, 0.72)` },
    ], ms, 'cubic-bezier(0.3, 0, 0.8, 0.8)');
    k.dibujar(ms, (c, t) => {
      const f = k.target.feet, u = t < 0.55 ? 0 : (t - 0.55) / 0.45, r = k.target.size * (0.3 + 0.5 * u);
      c.globalAlpha = 0.15 + 0.3 * u; c.fillStyle = '#000000'; c.beginPath(); c.ellipse(f.x, f.y, r, r * 0.35, 0, 0, Math.PI * 2); c.fill();
      if (t > 0.6) { const p = k.posSprite(g); k.emit({ x: p.x + rand(-g.size, g.size) * 0.3, y: p.y - g.size * 0.5, vy: -340, life: 120, size: 2, color: ACERO.glow, shape: 'streak', stretch: 50 }); }
    }, { z: 0 });
    await k.esperar(ms);
    await k.impacto(t => {
      ondaSuelo(k, t.feet, t.size * 1.8, ACERO.glow, 440, 5);
      ondaSuelo(k, t.feet, t.size * 1.2, '#ffffff', 320, 3, 60);
      k.add(E.cracks({ at: t.feet, length: t.size * 1.1, color: '#2a1808', duration: 800 }));
      polvo(k, t.feet, 12, t.size * 0.38);
      cascotes(k, t.feet, 12, 300, 3.5, T_TIERRA);
      E.sparks(k.fx, t.center, { count: 14, speed: [160, 340], palette: CHISPA, shape: 'streak' });
      void k.stage.shake(8, 340);
    });
    void k.animar(g.sprite, [{ transform: `translate(${v.x}px, ${v.y}px) scale(1.3, 0.72)` }, { transform: `translate(${v.x * 0.5}px, ${v.y * 0.5 - g.size * 0.4}px) scale(1, 1)`, offset: 0.5 }, { transform: 'translate(0px, 0px) scale(1, 1)' }], 340);
    await k.esperar(200);
    await k.despues();
  },

  // Defensa Férrea: placas de acero vuelan desde fuera y encajan alrededor del usuario formando una coraza; un reflejo
  // la recorre de lado a lado con un destello.
  async irondefense(k) {
    const g = k.user, llega = 260, n = 8;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2, ini = { x: g.center.x + Math.cos(a) * g.size * 1.6, y: g.center.y + Math.sin(a) * g.size * 1.3 }, fin = { x: g.center.x + Math.cos(a) * g.size * 0.55, y: g.center.y + Math.sin(a) * g.size * 0.5 }, w = g.size * 0.16;
      k.dibujar(llega + 360, (c, t) => {
        const ms = t * (llega + 360), u = easeIn(Math.min(1, ms / llega)), p = { x: lerp(ini.x, fin.x, u), y: lerp(ini.y, fin.y, u) };
        c.save(); c.globalAlpha = ms > llega + 200 ? 1 - (ms - llega - 200) / 160 : 1;
        c.translate(p.x, p.y); c.rotate(a + Math.PI / 2);
        c.beginPath(); for (let j = 0; j < 6; j++) { const b = (j / 6) * Math.PI * 2; if (j) c.lineTo(Math.cos(b) * w, Math.sin(b) * w * 0.8); else c.moveTo(Math.cos(b) * w, Math.sin(b) * w * 0.8); } c.closePath();
        c.fillStyle = degradadoMetal(c, -w, -w, w, w, 0.5); c.fill(); c.lineWidth = 1.4; c.strokeStyle = '#1c2a32'; c.stroke();
        c.restore();
      }, { z: 1, delay: i * 15 });
    }
    k.burst(n, i => ({ x: g.center.x + Math.cos((i / n) * Math.PI * 2) * g.size * 0.55, y: g.center.y + Math.sin((i / n) * Math.PI * 2) * g.size * 0.5, life: 200, delay: llega + i * 15, size: 5, sizeEnd: 0, color: '#ffffff', shape: 'star', spin: 6 }));
    k.add(E.shield({ at: g.center, rx: g.size * 0.72, ry: g.size * 0.68, palette: ACERO, duration: 460, delay: llega }));
    // Reflejo que cruza la coraza.
    k.dibujar(300, (c, t) => {
      const p = g.center, r = g.size * 0.72, x = p.x - r + t * r * 2;
      c.save(); c.beginPath(); c.ellipse(p.x, p.y, r, r * 0.95, 0, 0, Math.PI * 2); c.clip();
      c.globalAlpha = 0.7 * Math.sin(Math.PI * t);
      c.fillStyle = lineal(c, x - r * 0.3, 0, x + r * 0.3, 0, ['rgba(255,255,255,0)', '#ffffff', 'rgba(255,255,255,0)']);
      c.fillRect(x - r * 0.3, p.y - r, r * 0.6, r * 2);
      c.restore();
    }, { z: 1, delay: llega + 60 });
    await k.esperar(llega + 80);
    await k.estado();
    await k.esperar(120);
  },

  // Cabeza de Hierro (80): una visera de acero brillante cubre la cabeza del usuario, que embiste; el choque suena a
  // campana: anillos plateados, chispas y un destello en estrella.
  async ironhead(k) {
    const g = k.user, prep = 160;
    let golpe = false;
    k.dibujar(prep + 160 + 200, (c, t, engine) => {
      const ms = t * (prep + 360), p = k.posSprite(g), q = { x: p.x + k.dir.x * g.size * 0.42, y: p.y + k.dir.y * g.size * 0.42 - g.size * 0.12 }, r = g.size * 0.42 * easeOut(Math.min(1, ms / 100));
      c.globalAlpha = golpe ? Math.max(0, 1 - (ms - prep - 160) / 160) : 1;
      luz(c, engine, q, r * 1.4, '#ffffff', 0.3);
      c.save(); c.translate(q.x, q.y); c.rotate(k.angle);
      c.beginPath(); c.ellipse(0, 0, r * 0.55, r, 0, -Math.PI / 2, Math.PI / 2); c.ellipse(-r * 0.12, 0, r * 0.3, r * 0.8, 0, Math.PI / 2, -Math.PI / 2, true); c.closePath();
      c.fillStyle = degradadoMetal(c, -r, -r, r * 0.5, r, (ms / (prep + 360)) * 1.2); c.fill(); c.lineWidth = Math.max(1.2, r * 0.07); c.strokeStyle = '#1c2a32'; c.stroke();
      c.restore();
    }, { z: 1 });
    k.emit({ x: g.center.x + k.dir.x * g.size * 0.5, y: g.center.y - g.size * 0.3, life: 220, delay: 90, size: g.size * 0.25, sizeEnd: 0, color: '#ffffff', shape: 'star', spin: 6 });
    await k.esperar(prep);
    await k.embestida({ hasta: 0.85, ida: 160, vuelta: 280, arco: 6, estela: ACERO.glow });
    golpe = true;
    await k.impacto(t => {
      for (let i = 0; i < 3; i++) k.add(E.ring({ at: t.center, from: 6, to: t.size * (0.7 + i * 0.3), width: 3, color: i % 2 ? ACERO.glow : '#ffffff', duration: 380, delay: i * 80 }));
      k.add(E.starburst({ at: t.center, rays: 4, length: t.size * 0.9, width: 4, palette: BLANCO, duration: 260 }));
      E.sparks(k.fx, t.center, { count: 18, speed: [200, 420], palette: CHISPA, shape: 'streak', gravity: 400 });
    });
    await k.esperar(150);
    await k.despues();
  },

  // Cola Férrea (100): el usuario se acerca y barre con una cola de acero reluciente en un arco amplio, dejando una
  // estela plateada; el golpe suelta chispas en la dirección del barrido.
  async irontail(k) {
    const g = k.user, ms = 240, s = k.perp.y >= 0 ? 1 : -1;
    await k.anticipar(80);
    void k.embestida({ hasta: 0.4, ida: 140, vuelta: 320 });
    await k.esperar(80);
    const a0 = k.angle - 1.7 * s, a1 = k.angle + 0.35 * s;
    const cola = (c: CanvasRenderingContext2D, piv: Vec, R: number, th: number, alpha: number, solida: boolean) => {
      const n = 12, izq: Vec[] = [], der: Vec[] = [], W = g.size * 0.18;
      for (let i = 0; i <= n; i++) {
        const u = i / n, a = th - 0.35 * s * u * u, r = R * (0.2 + 0.8 * u), p = { x: piv.x + Math.cos(a) * r, y: piv.y + Math.sin(a) * r }, w = W * Math.pow(1 - u, 0.7) + 0.5, nn = { x: -Math.sin(a), y: Math.cos(a) };
        izq.push({ x: p.x + nn.x * w, y: p.y + nn.y * w }); der.push({ x: p.x - nn.x * w, y: p.y - nn.y * w });
      }
      c.save(); c.globalAlpha = alpha;
      c.beginPath(); [...izq, ...der.reverse()].forEach((p, i) => (i ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y))); c.closePath();
      if (solida) { c.fillStyle = degradadoMetal(c, piv.x, piv.y, piv.x + Math.cos(th) * R, piv.y + Math.sin(th) * R, 0.6); c.fill(); c.lineWidth = 1.5; c.strokeStyle = '#1c2a32'; c.stroke(); }
      else { c.fillStyle = ACERO.glow; c.fill(); }
      c.restore();
    };
    k.dibujar(ms + 160, (c, t) => {
      const tt = (t * (ms + 160)) / ms, u = easeIn(Math.min(1, tt)), piv = k.posSprite(g), R = Math.hypot(k.target.center.x - piv.x, k.target.center.y - piv.y) * 1.05 + k.s(0.1);
      const th = lerp(a0, a1, u), sale = tt > 1 ? 1 - (tt - 1) / 0.66 : 1;
      cola(c, piv, R, th - 0.5 * s, 0.12 * sale, false);
      cola(c, piv, R, th - 0.25 * s, 0.25 * sale, false);
      cola(c, piv, R, th, sale, true);
      if (tt < 1) { const tip = { x: piv.x + Math.cos(th - 0.35 * s) * R, y: piv.y + Math.sin(th - 0.35 * s) * R }; k.emit({ x: tip.x, y: tip.y, life: 200, size: 3, sizeEnd: 0, color: '#ffffff', shape: 'glow' }); }
    }, { z: 1 });
    await k.esperar(ms);
    await k.impacto(t => {
      const tang = k.angle + (Math.PI / 2) * s;
      E.sparks(k.fx, t.center, { count: 22, speed: [220, 460], palette: CHISPA, shape: 'streak', spread: [tang - 0.7, tang + 0.7], gravity: 400 });
      k.add(E.ring({ at: t.center, from: 6, to: t.size * 0.9, width: 4, color: '#ffffff', duration: 300 }));
      k.add(E.starburst({ at: t.center, rays: 6, length: t.size * 0.9, width: 4, palette: ACERO, duration: 280 }));
    });
    await k.esperar(140);
    await k.despues();
  },

  // Represión Metal: el cuerpo del usuario se vuelve espejo y absorbe el golpe (anillos que se cierran sobre él);
  // al instante lo devuelve multiplicado en un cono de esquirlas de acero.
  async metalburst(k) {
    const g = k.user, absorbe = 280;
    for (let i = 0; i < 3; i++) k.add(E.ring({ at: g.center, from: g.size * 1.2, to: g.size * 0.2, width: 3, color: i % 2 ? ACERO.glow : '#ffffff', duration: 220, delay: i * 50 }));
    k.dibujar(absorbe, (c, t, engine) => luz(c, engine, k.posSprite(g), g.size * (0.4 + 0.5 * t), '#ffffff', 0.5 + 0.4 * t), { z: 1 });
    void k.agitar(g.sprite, 2, absorbe);
    await k.esperar(absorbe - 60);
    k.destello(g.sprite, 160);
    await k.esperar(60);
    const ini = k.punto(0.1), fin = k.acierta ? k.target.center : k.punto(1.5), viaje = 170;
    k.add(E.starburst({ at: ini, rays: 8, length: g.size * 0.9, width: 4, palette: ACERO, duration: 240 }));
    k.add(E.beam({ from: ini, to: fin, width: k.s(0.18), palette: ACERO, duration: 240 }));
    k.burst(18, i => {
      const a = k.angle + rand(-0.28, 0.28), v = (k.dist / (viaje / 1000)) * rand(0.9, 1.15);
      return { x: ini.x, y: ini.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: viaje * 1.2, delay: i * 4, size: rand(3, 5.5), color: pick([ACERO.core, ACERO.glow, '#ffffff']), shape: 'shard', rot: a, spin: rand(-10, 10) };
    });
    await k.esperar(viaje);
    await k.impacto(t => {
      k.add(E.flash({ color: '#ffffff', alpha: 0.25, duration: 200 }));
      k.add(E.starburst({ at: t.center, rays: 12, length: t.size * 1.1, width: 5, palette: ACERO, duration: 320 }));
      E.sparks(k.fx, t.center, { count: 16, speed: [180, 400], palette: ACERO, shape: 'shard', size: [2.5, 4.5] });
    });
    await k.esperar(160);
    await k.despues();
  },

  // Garra Metal (50): tres garras de acero relucientes arañan el objetivo en diagonal, con chispas metálicas.
  async metalclaw(k) {
    await k.anticipar(70);
    void k.embestida({ hasta: 0.55, ida: 120, vuelta: 240 });
    await k.esperar(80);
    const c0 = k.target.center, ms = 160, r = k.s(0.48), d = { x: Math.cos(Math.PI / 4), y: Math.sin(Math.PI / 4) };
    k.dibujar(ms + 160, (c, t) => {
      const tt = (t * (ms + 160)) / ms, u = easeOut(Math.min(1, tt)), off = lerp(-0.35, 0.25, u) * k.s(1);
      c.globalAlpha = tt < 1 ? 1 : 1 - (tt - 1) / 1;
      forma(c, 'garras', c0.x + d.x * off, c0.y + d.y * off, r, 0, estiloMetal(u, 10), k.dir.x < 0);
    }, { z: 1 });
    for (let i = -1; i <= 1; i++) k.add(E.slash({ at: { x: c0.x + i * k.s(0.18), y: c0.y - i * k.s(0.18) }, radius: k.s(0.5), angle: Math.PI * 0.75, sweep: 1.2, width: 3, palette: ACERO, duration: 240, delay: 30 }));
    await k.esperar(ms * 0.7);
    await k.impacto(t => {
      E.sparks(k.fx, t.center, { count: 14, speed: [180, 360], palette: CHISPA, shape: 'streak', gravity: 400 });
      k.emit({ x: t.center.x, y: t.center.y, life: 200, size: t.size * 0.3, sizeEnd: 0, color: '#ffffff', shape: 'star', spin: 6 });
    });
    await k.despues();
  },

  // Eco Metálico: ondas en zigzag, chirriantes y plateadas, salen del usuario hacia el objetivo, que tiembla.
  async metalsound(k) {
    const g = k.user, ondas = 5, cada = 70, viaje = 360, largo = k.hayObjetivo ? k.dist + k.target.size * 0.4 : g.size * 2.5;
    void k.agitar(g.sprite, 1.5, ondas * cada + 100);
    for (let i = 0; i < ondas; i++) {
      k.dibujar(viaje, (c, t) => {
        const p = g.center, r = lerp(g.size * 0.4, largo, t), amp = g.size * 0.06 * (1 - t * 0.5), n = 18, ab = 0.55;
        c.save(); c.globalAlpha = 1 - easeIn(t); c.lineJoin = 'miter';
        c.strokeStyle = i % 2 ? ACERO.glow : '#ffffff'; c.lineWidth = 2.5;
        c.beginPath();
        for (let j = 0; j <= n; j++) { const a = k.angle - ab + (2 * ab * j) / n, rr = r + (j % 2 ? amp : -amp); if (j) c.lineTo(p.x + Math.cos(a) * rr, p.y + Math.sin(a) * rr * 0.8); else c.moveTo(p.x + Math.cos(a) * rr, p.y + Math.sin(a) * rr * 0.8); }
        c.stroke(); c.restore();
      }, { z: 1, delay: i * cada });
    }
    await k.esperar(viaje * 0.8);
    if (k.hayObjetivo) {
      void k.agitar(k.target.sprite, 3, 360);
      k.burst(6, () => ({ x: k.target.center.x + rand(-k.s(0.4), k.s(0.4)), y: k.target.top.y + rand(-6, 6), vx: rand(-40, 40), vy: -rand(30, 70), life: 360, size: rand(1.5, 2.5), color: '#ffffff', shape: 'streak', stretch: 20 }));
    }
    await k.estado();
  },

  // Puño Meteoro (90): un puño de acero sube al cielo y vuelve a caer desde lo alto de la vista como un meteoro,
  // envuelto en luz azul y con cola de estrellas; deja un cráter al estrellarse.
  async meteormash(k) {
    const g = k.user, sube = 180, cae = 260, r = k.s(0.3), fase = (t: number) => 0.2 + 0.6 * t;
    await k.anticipar(80);
    void k.saltar(g.sprite, g.size * 0.15, 200);
    const ini = { x: g.center.x, y: g.top.y }, arriba = k.stage.top - r * 2;
    k.dibujar(sube, (c, t, engine) => {
      const p = { x: ini.x, y: lerp(ini.y, arriba, easeIn(t)) };
      luz(c, engine, p, r * 1.5, AURA.glow, 0.7);
      forma(c, 'puno', p.x, p.y, r * 0.7, -Math.PI / 2, estiloMetal(fase(t)));
    }, { z: 1 });
    await k.esperar(sube + 40);
    const fin = k.acierta ? k.target.center : k.punto(1.4), desde = { x: fin.x - k.dir.x * k.s(1.0) - k.s(0.5), y: arriba }, ang = Math.atan2(fin.y - desde.y, fin.x - desde.x);
    k.dibujar(cae, (c, t, engine) => {
      const u = easeIn(t), p = { x: lerp(desde.x, fin.x, u), y: lerp(desde.y, fin.y, u) };
      luz(c, engine, p, r * 2.6, AURA.core, 0.6);
      luz(c, engine, p, r * 1.5, '#ffffff', 0.6);
      for (let i = 0; i < 3; i++) k.emit({ x: p.x + rand(-r, r) * 0.5, y: p.y + rand(-r, r) * 0.5, vx: -Math.cos(ang) * 180 + rand(-40, 40), vy: -Math.sin(ang) * 180 + rand(-40, 40), drag: 2, life: 380, size: rand(3, 6), sizeEnd: 0, color: pick([AURA.glow, '#ffffff', ACERO.glow]), shape: i ? 'glow' : 'star', spin: 6 });
      forma(c, 'puno', p.x, p.y, r, ang, estiloMetal(fase(t), 14));
    }, { z: 1 });
    await k.esperar(cae);
    await k.impacto(t => {
      k.add(E.flash({ color: AURA.glow, alpha: 0.25, duration: 200 }));
      k.add(E.starburst({ at: t.center, rays: 10, length: t.size * 1.1, width: 5, palette: AURA, duration: 320 }));
      ondaSuelo(k, t.feet, t.size * 1.5, AURA.glow, 420, 4);
      k.add(E.cracks({ at: t.feet, length: t.size * 0.9, color: '#2a1808', duration: 700 }));
      k.burst(14, () => { const a = rand(0, Math.PI * 2), v = rand(100, 280); return { x: t.center.x, y: t.center.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, drag: 3, life: rand(380, 560), size: rand(4, 7), sizeEnd: 0, color: pick(['#ffffff', AURA.glow, '#ffe680']), shape: 'star', spin: rand(-6, 6) }; });
      polvo(k, t.feet, 8, t.size * 0.3);
    });
    await k.esperar(160);
    await k.despues();
  },

  // Ala de Acero (70): un ala metálica enorme barre el objetivo de lado a lado dejando un tajo plateado y esquirlas
  // como plumas de acero.
  async steelwing(k) {
    await k.anticipar(80);
    void k.embestida({ hasta: 0.55, ida: 140, vuelta: 280 });
    await k.esperar(60);
    const c0 = k.target.center, ms = 200, L = k.s(0.7), r = k.s(0.5), s = k.dir.x >= 0 ? 1 : -1;
    k.dibujar(ms + 140, (c, t) => {
      const tt = (t * (ms + 140)) / ms, u = easeOut(Math.min(1, tt)), lado = lerp(L, -L, u), p = { x: c0.x + k.perp.x * lado + k.dir.x * k.s(0.1), y: c0.y + k.perp.y * lado };
      c.globalAlpha = tt < 1 ? 1 : 1 - (tt - 1) / 0.7;
      forma(c, 'ala', p.x, p.y, r, k.angle - 0.4 * s + u * 0.6 * s, estiloMetal(u, 10), s < 0);
      if (tt < 1 && Math.random() < 0.7) k.emit({ x: p.x, y: p.y, vx: k.perp.x * 120 + rand(-60, 60), vy: k.perp.y * 120 + rand(-60, 60), drag: 2, life: 380, size: rand(3, 5), color: pick([ACERO.glow, '#ffffff', ACERO.core]), shape: 'shard', spin: 8 });
    }, { z: 1 });
    k.add(E.slash({ at: c0, radius: k.s(0.6), angle: k.angle, sweep: 2.2, width: 5, palette: ACERO, duration: 280, delay: 40 }));
    await k.esperar(ms * 0.6);
    await k.impacto(t => {
      E.sparks(k.fx, t.center, { count: 14, speed: [160, 340], palette: ACERO, shape: 'shard', size: [2.5, 4.5] });
      k.add(E.ring({ at: t.center, from: 4, to: t.size * 0.8, width: 3, color: '#ffffff', duration: 260 }));
    });
    await k.esperar(100);
    await k.despues();
  },
};
