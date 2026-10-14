// Firmas de movimientos (ver LEEME.md). Grupo: Psíquico, Fantasma y Siniestro.
import { E, NEUTRAL_FX, TYPE_FX, easeIn, easeInOut, easeOut, easeOutCubic, lerp, mix, pick, rand, type Firma, type FxPalette, type Kit, type SlotGeometry, type Vec } from './kit';
import { aEscena, contorno, forma, mandibula } from './formas';
import type { FxEngine } from '../fx/engine';

const SINIESTRO = TYPE_FX.Dark;
const PSI = TYPE_FX.Psychic, FAN = TYPE_FX.Ghost;
const TAU = Math.PI * 2;
const ROJO: FxPalette = { core: '#d01830', glow: '#ff5060', hot: '#ffd0d0', dark: '#3a0410' };
const ARCOIRIS = ['#ff4f8f', '#ffb03a', '#ffe45a', '#6ff27a', '#5ab8ff', '#b07dff'];

// ---- Utilidades de dibujo (locales a este grupo) ----

/** Rebote al aparecer (easeOutBack): pasa un poco de 1 y vuelve. */
const rebote = (t: number) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); };
/** Entra en la primera fracción `a` y sale en la última `b` (para el alpha de un dibujo). */
const aparece = (t: number, a = 0.15, b = 0.25) => Math.max(0, Math.min(1, t / a, (1 - t) / b));
/** Formas con "arriba" (puño, mano): volteadas cuando el objetivo está a la izquierda, para que no queden del revés. */
const espejo = (k: Kit) => Math.cos(k.angle) < 0;

/** Luz suave (sprite de brillo del motor) en `p`, de radio `r`. */
function luz(c: CanvasRenderingContext2D, engine: FxEngine, color: string, p: Vec, r: number, a = 1): void {
  if (r <= 0 || a <= 0) return;
  c.save();
  c.globalCompositeOperation = engine.blend;
  c.globalAlpha *= a;
  c.drawImage(engine.glow(color), p.x - r, p.y - r, r * 2, r * 2);
  c.restore();
}

/** Bocanadas de humo que suben. */
function humo(k: Kit, p: Vec, n: number, color: string, tam: number, vida = 600, sube = 50, alpha = 0.35): void {
  k.burst(n, () => ({ x: p.x + rand(-tam, tam) * 0.6, y: p.y + rand(-tam, tam) * 0.3, vx: rand(-30, 30), vy: -rand(sube * 0.4, sube), drag: 1, life: vida * rand(0.7, 1.2), size: tam * rand(0.6, 1), sizeEnd: tam * 1.8, color, alpha, shape: 'smoke' }));
}

/** Llamita fantasma (fuego fatuo) que sube desde `p`. */
function fatuo(k: Kit, p: Vec, tam: number, vida = 520, color = FAN.core): void {
  k.emit({ x: p.x, y: p.y, vx: rand(-25, 25), vy: -rand(40, 100), life: vida * rand(0.8, 1.2), size: tam * rand(0.7, 1.2), sizeEnd: tam * 0.15, color: pick([color, FAN.glow, FAN.core]), shape: 'glow' });
}

/** Un signo de cómic (?, !) con borde. */
function signo(c: CanvasRenderingContext2D, txt: string, x: number, y: number, tam: number, relleno: string, borde: string, rot = 0): void {
  if (tam <= 1) return;
  c.save();
  c.translate(x, y); c.rotate(rot);
  c.font = `900 ${tam}px "Segoe UI", Arial, sans-serif`;
  c.textAlign = 'center'; c.textBaseline = 'middle'; c.lineJoin = 'round';
  c.lineWidth = Math.max(2, tam * 0.16); c.strokeStyle = borde; c.strokeText(txt, 0, 0);
  c.fillStyle = relleno; c.fillText(txt, 0, 0);
  c.restore();
}

/** Grietas sobre el cuerpo (no en el suelo): líneas quebradas que salen de `at`. */
function grietas(k: Kit, at: Vec, largo: number, color: string, brillo: string, ms = 500, n = 6): void {
  const lineas = Array.from({ length: n }, (_, i) => {
    const pts: Vec[] = [{ ...at }];
    let a = i / n * TAU + rand(-0.3, 0.3), x = at.x, y = at.y;
    for (let s = 0; s < 4; s++) { a += rand(-0.6, 0.6); const l = largo / 4 * rand(0.6, 1.2); x += Math.cos(a) * l; y += Math.sin(a) * l; pts.push({ x, y }); }
    return pts;
  });
  k.dibujar(ms, (c, t) => {
    const crece = easeOutCubic(Math.min(1, t / 0.25));
    c.globalAlpha = 1 - easeIn(Math.max(0, (t - 0.5) / 0.5));
    c.lineJoin = 'round'; c.lineCap = 'round';
    for (const [w, col] of [[3.4, color], [1.2, brillo]] as const) {
      c.lineWidth = w; c.strokeStyle = col;
      for (const pts of lineas) {
        const cuenta = Math.max(2, Math.ceil(pts.length * crece));
        c.beginPath(); pts.slice(0, cuenta).forEach((p, i) => (i ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y))); c.stroke();
      }
    }
  }, { z: 1 });
}

/** Nube de dibujo (bolas unidas con borde común). */
function nube(c: CanvasRenderingContext2D, x: number, y: number, r: number, relleno: string, borde: string, grosor = 2.5): void {
  const bolas: [number, number, number][] = [[-0.55, 0.1, 0.42], [-0.2, -0.22, 0.52], [0.25, -0.16, 0.48], [0.6, 0.12, 0.38], [0.05, 0.18, 0.5]];
  c.lineWidth = grosor * 2; c.strokeStyle = borde;
  for (const [bx, by, br] of bolas) { c.beginPath(); c.arc(x + bx * r, y + by * r, br * r, 0, TAU); c.stroke(); }
  c.fillStyle = relleno;
  for (const [bx, by, br] of bolas) { c.beginPath(); c.arc(x + bx * r, y + by * r, br * r, 0, TAU); c.fill(); }
}

/** Vena de enfado de cómic (cuatro arcos que se miran). */
function ira(c: CanvasRenderingContext2D, x: number, y: number, tam: number, color = '#ff3a3a', borde = '#5a0808'): void {
  if (tam <= 0) return;
  c.lineCap = 'round';
  for (const [w, col] of [[tam * 0.34, borde], [tam * 0.2, color]] as const) {
    c.lineWidth = w; c.strokeStyle = col;
    for (let q = 0; q < 4; q++) {
      const a = q * Math.PI / 2 + Math.PI / 4, cx = x + Math.cos(a) * tam * 0.75, cy = y + Math.sin(a) * tam * 0.75;
      c.beginPath(); c.arc(cx, cy, tam * 0.5, a + Math.PI - 0.75, a + Math.PI + 0.75); c.stroke();
    }
  }
}

/** Flor de loto vista en 3/4, que se abre con `ab` (0-1). */
function loto(c: CanvasRenderingContext2D, x: number, y: number, r: number, ab: number, relleno: string, claro: string, borde: string): void {
  const petalos: { a: number; L: number; col: string }[] = [];
  for (let i = 0; i < 8; i++) petalos.push({ a: i / 8 * TAU, L: r, col: relleno });
  for (let i = 0; i < 6; i++) petalos.push({ a: (i + 0.5) / 6 * TAU, L: r * 0.66, col: claro });
  petalos.sort((p, q) => (p.L === q.L ? Math.sin(p.a) - Math.sin(q.a) : q.L - p.L));
  c.lineJoin = 'round'; c.lineWidth = Math.max(1.2, r * 0.05); c.strokeStyle = borde;
  for (const p of petalos) {
    const L = p.L * (0.25 + 0.75 * ab), lev = L * 0.6 * ab;
    const tip = { x: x + Math.cos(p.a) * L, y: y + Math.sin(p.a) * L * 0.5 - lev };
    const w = L * 0.4, nx = -Math.sin(p.a), ny = Math.cos(p.a) * 0.5;
    const m = { x: (x + tip.x) / 2, y: (y + tip.y) / 2 };
    c.beginPath(); c.moveTo(x, y);
    c.quadraticCurveTo(m.x + nx * w, m.y + ny * w, tip.x, tip.y);
    c.quadraticCurveTo(m.x - nx * w, m.y - ny * w, x, y);
    c.fillStyle = p.col; c.fill(); c.stroke();
  }
}

/** Engranaje. */
function engranaje(c: CanvasRenderingContext2D, x: number, y: number, r: number, rot: number, relleno: string, borde: string): void {
  const n = 8;
  c.beginPath();
  for (let i = 0; i < n * 4; i++) { const a = rot + i / (n * 4) * TAU, rr = i % 4 < 2 ? r : r * 0.76; c.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
  c.closePath();
  c.fillStyle = relleno; c.fill(); c.lineWidth = Math.max(1.5, r * 0.1); c.strokeStyle = borde; c.lineJoin = 'round'; c.stroke();
  c.beginPath(); c.arc(x, y, r * 0.28, 0, TAU); c.fillStyle = borde; c.fill();
}

/** Clavo: `(x, y)` es la punta y `ang` hacia donde apunta. */
function clavo(c: CanvasRenderingContext2D, x: number, y: number, largo: number, ang: number): void {
  c.save(); c.translate(x, y); c.rotate(ang);
  const w = largo * 0.08;
  const g = c.createLinearGradient(0, -w, 0, w); g.addColorStop(0, '#e8e0f0'); g.addColorStop(0.5, '#9a90ac'); g.addColorStop(1, '#4a4058');
  c.beginPath(); c.moveTo(0, 0); c.lineTo(-largo * 0.22, -w); c.lineTo(-largo, -w); c.lineTo(-largo, w); c.lineTo(-largo * 0.22, w); c.closePath();
  c.fillStyle = g; c.fill(); c.lineWidth = 2; c.strokeStyle = '#140a1c'; c.lineJoin = 'round'; c.stroke();
  c.beginPath(); c.rect(-largo - w * 1.4, -w * 2.6, w * 1.6, w * 5.2); c.fillStyle = '#6a607c'; c.fill(); c.stroke();
  c.restore();
}

/** Cadena de eslabones a lo largo de `pts`; `alfa(i)` para los de detrás. */
function cadena(c: CanvasRenderingContext2D, pts: Vec[], tam: number, color: string, borde: string, alfa: (i: number) => number = () => 1): void {
  const base = c.globalAlpha;
  for (let i = 0; i < pts.length - 1; i++) {
    const p = pts[i], q = pts[i + 1], a = Math.atan2(q.y - p.y, q.x - p.x);
    c.save(); c.globalAlpha = base * alfa(i); c.translate((p.x + q.x) / 2, (p.y + q.y) / 2); c.rotate(a);
    c.beginPath(); c.ellipse(0, 0, tam, i % 2 ? tam * 0.2 : tam * 0.5, 0, 0, TAU);
    c.lineWidth = tam * 0.36 + 2; c.strokeStyle = borde; c.stroke(); c.lineWidth = tam * 0.3; c.strokeStyle = color; c.stroke();
    c.restore();
  }
}

/** Candado (abierto 1 = el arco levantado). */
function candado(c: CanvasRenderingContext2D, x: number, y: number, tam: number, abierto: number): void {
  const w = tam, h = tam * 0.8, sube = abierto * tam * 0.4, ra = w * 0.3;
  c.lineCap = 'butt';
  for (const [lw, col] of [[tam * 0.24, '#3a2400'], [tam * 0.15, '#c8c0d8']] as const) {
    c.beginPath(); c.moveTo(x - ra, y - h * 0.3 - sube); c.lineTo(x - ra, y - h * 0.5 - sube);
    c.arc(x, y - h * 0.5 - sube, ra, Math.PI, TAU); c.lineTo(x + ra, y - h * 0.3);
    c.lineWidth = lw; c.strokeStyle = col; c.stroke();
  }
  const g = c.createLinearGradient(x, y - h * 0.4, x, y + h * 0.5); g.addColorStop(0, '#ffe680'); g.addColorStop(1, '#d08a10');
  c.beginPath(); c.moveTo(x - w / 2 + 4, y - h * 0.4); c.lineTo(x + w / 2 - 4, y - h * 0.4); c.quadraticCurveTo(x + w / 2, y - h * 0.4, x + w / 2, y - h * 0.4 + 4);
  c.lineTo(x + w / 2, y + h * 0.45 - 4); c.quadraticCurveTo(x + w / 2, y + h * 0.45, x + w / 2 - 4, y + h * 0.45); c.lineTo(x - w / 2 + 4, y + h * 0.45);
  c.quadraticCurveTo(x - w / 2, y + h * 0.45, x - w / 2, y + h * 0.45 - 4); c.lineTo(x - w / 2, y - h * 0.4 + 4); c.quadraticCurveTo(x - w / 2, y - h * 0.4, x - w / 2 + 4, y - h * 0.4); c.closePath();
  c.fillStyle = g; c.fill(); c.lineWidth = Math.max(2, tam * 0.07); c.strokeStyle = '#3a2400'; c.stroke();
  c.beginPath(); c.arc(x, y - h * 0.02, tam * 0.09, 0, TAU); c.moveTo(x - tam * 0.05, y); c.lineTo(x + tam * 0.05, y); c.lineTo(x, y + h * 0.25); c.closePath();
  c.fillStyle = '#3a2400'; c.fill();
}

/** Cuchara (Kinético): `(x, y)` en el mango, `ang` hacia el cazo; `doblez` 0-1 dobla el cuello. */
function cuchara(c: CanvasRenderingContext2D, x: number, y: number, L: number, ang: number, doblez: number): void {
  c.save(); c.translate(x, y); c.rotate(ang);
  const curv = doblez * 1.25, cuello = { x: L * 0.2, y: 0 };
  const cazo = { x: cuello.x + Math.cos(curv) * L * 0.42, y: cuello.y + Math.sin(curv) * L * 0.42 };
  c.lineCap = 'round'; c.lineJoin = 'round';
  for (const [w, col] of [[L * 0.13, '#2a2438'], [L * 0.08, '#dcd8ec']] as const) {
    c.beginPath(); c.moveTo(-L * 0.7, 0); c.lineTo(cuello.x, cuello.y);
    c.quadraticCurveTo(cuello.x + L * 0.12, 0, cazo.x - Math.cos(curv) * L * 0.14, cazo.y - Math.sin(curv) * L * 0.14);
    c.lineWidth = w; c.strokeStyle = col; c.stroke();
  }
  const g = c.createRadialGradient(cazo.x - L * 0.06, cazo.y - L * 0.05, L * 0.02, cazo.x, cazo.y, L * 0.22);
  g.addColorStop(0, '#ffffff'); g.addColorStop(0.5, '#c8c4d8'); g.addColorStop(1, '#8a86a0');
  c.beginPath(); c.ellipse(cazo.x, cazo.y, L * 0.22, L * 0.14, curv, 0, TAU);
  c.fillStyle = g; c.fill(); c.lineWidth = Math.max(1.5, L * 0.04); c.strokeStyle = '#2a2438'; c.stroke();
  c.restore();
}

/** Máscara de teatro (Imitación). */
function mascara(c: CanvasRenderingContext2D, x: number, y: number, tam: number, rot: number, relleno: string, borde: string): void {
  if (tam <= 0) return;
  c.save(); c.translate(x, y); c.rotate(rot); c.scale(tam, tam);
  c.beginPath(); c.moveTo(-0.8, -0.6); c.quadraticCurveTo(0, -0.95, 0.8, -0.6); c.quadraticCurveTo(0.85, 0.4, 0, 0.95); c.quadraticCurveTo(-0.85, 0.4, -0.8, -0.6); c.closePath();
  c.fillStyle = relleno; c.fill(); c.lineWidth = 0.09; c.strokeStyle = borde; c.lineJoin = 'round'; c.stroke();
  c.fillStyle = borde;
  for (const s of [-1, 1]) { c.beginPath(); c.ellipse(s * 0.33, -0.22, 0.2, 0.1, s * 0.35, 0, TAU); c.fill(); }
  c.beginPath(); c.arc(0, 0.12, 0.38, 0.35, Math.PI - 0.35); c.lineWidth = 0.11; c.lineCap = 'round'; c.stroke();
  c.beginPath(); c.moveTo(-0.55, -0.62); c.quadraticCurveTo(0, -0.82, 0.55, -0.62); c.lineWidth = 0.05; c.strokeStyle = '#ffffff'; c.stroke();
  c.restore();
}

/** Una baya (el objeto equipado: Lanzamiento, Desarme, Ladrón). */
function baya(c: CanvasRenderingContext2D, x: number, y: number, tam: number, rot: number): void {
  c.save(); c.translate(x, y); c.rotate(rot);
  c.beginPath(); c.ellipse(tam * 0.4, -tam * 0.95, tam * 0.42, tam * 0.18, -0.5, 0, TAU);
  c.fillStyle = '#5ec24a'; c.fill(); c.lineWidth = Math.max(1, tam * 0.1); c.strokeStyle = '#1d4a14'; c.stroke();
  const g = c.createRadialGradient(-tam * 0.3, -tam * 0.3, tam * 0.1, 0, 0, tam);
  g.addColorStop(0, '#a8dcff'); g.addColorStop(0.55, '#3a7aff'); g.addColorStop(1, '#16307a');
  c.beginPath(); c.arc(0, 0, tam, 0, TAU); c.fillStyle = g; c.fill(); c.lineWidth = Math.max(1.5, tam * 0.13); c.strokeStyle = '#0c1a40'; c.stroke();
  c.beginPath(); c.ellipse(-tam * 0.35, -tam * 0.4, tam * 0.22, tam * 0.12, -0.6, 0, TAU); c.fillStyle = 'rgba(255,255,255,0.85)'; c.fill();
  c.restore();
}

/** Sello mágico en el suelo (círculos, estrella y runas), dibujado hasta `prog` (0-1). */
function sigilo(c: CanvasRenderingContext2D, x: number, y: number, r: number, rot: number, color: string, prog = 1): void {
  c.save(); c.translate(x, y); c.scale(1, 0.5);
  c.strokeStyle = color; c.lineWidth = 2.4; c.lineCap = 'round';
  c.beginPath(); c.arc(0, 0, r, rot, rot + TAU * prog); c.stroke();
  c.beginPath(); c.arc(0, 0, r * 0.8, -rot, -rot - TAU * prog, true); c.stroke();
  const pts = Array.from({ length: 5 }, (_, i) => { const a = rot - Math.PI / 2 + i * TAU / 5; return { x: Math.cos(a) * r * 0.8, y: Math.sin(a) * r * 0.8 }; });
  const lados = Math.floor(5 * prog);
  c.beginPath();
  for (let i = 0; i <= lados; i++) { const p = pts[(i * 2) % 5]; if (i) c.lineTo(p.x, p.y); else c.moveTo(p.x, p.y); }
  c.stroke();
  c.lineWidth = 1.6;
  for (let i = 0; i < Math.floor(16 * prog); i++) { const a = rot + i / 16 * TAU, m = r * 0.9; c.beginPath(); c.moveTo(Math.cos(a) * m, Math.sin(a) * m); c.lineTo(Math.cos(a + 0.12) * (m - 4), Math.sin(a + 0.12) * (m + 4)); c.stroke(); }
  c.restore();
}

/** Un ojo que se abre (`ap` 0-1), con el iris de color. */
function ojoQueSeAbre(c: CanvasRenderingContext2D, x: number, y: number, tam: number, ap: number, iris: string, brillo?: string): void {
  if (ap <= 0.02 || tam <= 0) return;
  c.save(); c.translate(x, y); c.scale(1, Math.max(0.05, ap));
  forma(c, 'ojo', 0, 0, tam, 0, { base: iris, borde: '#1a0820', brillo, brilloTam: tam * 0.4 });
  c.restore();
}

/** Sonrisa malvada de oreja a oreja con ojos rasgados (Maquinación). */
function caraMaliciosa(c: CanvasRenderingContext2D, x: number, y: number, tam: number, ojos: string, borde: string): void {
  if (tam <= 0) return;
  c.save(); c.translate(x, y); c.scale(tam, tam);
  c.lineJoin = 'round'; c.lineWidth = 0.08; c.strokeStyle = borde;
  for (const s of [-1, 1]) {
    c.beginPath(); c.moveTo(s * 0.12, -0.26); c.lineTo(s * 0.68, -0.55); c.lineTo(s * 0.58, -0.2); c.closePath();
    c.fillStyle = ojos; c.fill(); c.stroke();
  }
  c.beginPath(); c.moveTo(-0.85, -0.02);
  c.quadraticCurveTo(0, 0.95, 0.85, -0.02);
  c.quadraticCurveTo(0, 0.4, -0.85, -0.02); c.closePath();
  c.fillStyle = '#fbf6ff'; c.fill(); c.lineWidth = 0.09; c.stroke();
  c.lineWidth = 0.05;
  for (const tx of [-0.5, -0.25, 0, 0.25, 0.5]) { c.beginPath(); c.moveTo(tx, 0.2 + 0.18 * (1 - Math.abs(tx))); c.lineTo(tx * 1.05, 0.38 + 0.25 * (1 - Math.abs(tx))); c.stroke(); }
  c.restore();
}

/** Cristal afilado (Psicocarga, Manto Espejo), con la punta hacia `ang`. */
function cristal(c: CanvasRenderingContext2D, x: number, y: number, tam: number, ang: number, base: string, claro: string, borde: string): void {
  if (tam <= 0) return;
  c.save(); c.translate(x, y); c.rotate(ang); c.scale(tam, tam);
  c.lineJoin = 'round';
  c.beginPath(); c.moveTo(1, 0); c.lineTo(0.1, -0.36); c.lineTo(-0.7, 0); c.lineTo(0.1, 0.36); c.closePath();
  c.fillStyle = base; c.fill();
  c.beginPath(); c.moveTo(1, 0); c.lineTo(0.1, -0.36); c.lineTo(-0.7, 0); c.closePath(); c.fillStyle = claro; c.fill();
  c.beginPath(); c.moveTo(1, 0); c.lineTo(0.1, -0.36); c.lineTo(-0.7, 0); c.lineTo(0.1, 0.36); c.closePath();
  c.lineWidth = 0.09; c.strokeStyle = borde; c.stroke();
  c.restore();
}

/** Garra (zarpa con tres uñas curvas), las uñas hacia `ang`. */
function zarpa(c: CanvasRenderingContext2D, x: number, y: number, tam: number, ang: number, e: { base: string | ((c: CanvasRenderingContext2D) => string | CanvasGradient); borde: string; brillo?: string }, voltear = false): void {
  c.save(); c.translate(x, y); c.rotate(ang); c.scale(tam, voltear ? -tam : tam);
  const relleno = typeof e.base === 'string' ? e.base : e.base(c);
  const partes: (() => void)[] = [() => c.ellipse(-0.5, 0, 0.36, 0.52, 0, 0, TAU)];
  for (const off of [-0.42, 0, 0.42]) partes.push(() => {
    c.moveTo(-0.4, off - 0.14); c.quadraticCurveTo(0.35, off - 0.2, 1.0, off + 0.1 + Math.abs(off) * 0.12);
    c.quadraticCurveTo(0.35, off + 0.1, -0.4, off + 0.14); c.closePath();
  });
  if (e.brillo) { c.shadowColor = e.brillo; c.shadowBlur = tam * 0.35; }
  c.fillStyle = relleno;
  for (const p of partes) { c.beginPath(); p(); c.fill(); }
  c.shadowBlur = 0; c.lineJoin = 'round'; c.lineWidth = 0.07; c.strokeStyle = e.borde;
  for (const p of partes) { c.beginPath(); p(); c.stroke(); }
  c.restore();
}

/** Flecha curva alrededor de un punto (Cambio de Banda). */
function flechaCurva(c: CanvasRenderingContext2D, x: number, y: number, r: number, a0: number, largo: number, color: string, borde: string, ancho: number, achatado = 0.55): void {
  const n = 18, pts: Vec[] = [];
  for (let i = 0; i <= n; i++) { const a = a0 + largo * i / n; pts.push({ x: x + Math.cos(a) * r, y: y + Math.sin(a) * r * achatado }); }
  c.lineCap = 'round'; c.lineJoin = 'round';
  for (const [w, col] of [[ancho + 3, borde], [ancho, color]] as const) {
    c.beginPath(); pts.forEach((p, i) => (i ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y))); c.lineWidth = w; c.strokeStyle = col; c.stroke();
  }
  const p = pts[n], q = pts[n - 1], ang = Math.atan2(p.y - q.y, p.x - q.x), h = ancho * 1.9;
  c.beginPath(); c.moveTo(p.x + Math.cos(ang) * h, p.y + Math.sin(ang) * h);
  c.lineTo(p.x + Math.cos(ang + 2.3) * h, p.y + Math.sin(ang + 2.3) * h); c.lineTo(p.x + Math.cos(ang - 2.3) * h, p.y + Math.sin(ang - 2.3) * h); c.closePath();
  c.fillStyle = color; c.fill(); c.lineWidth = 1.5; c.strokeStyle = borde; c.stroke();
}

/** Galón (flecha de mejora en V invertida) apuntando hacia `ang`. */
function galon(c: CanvasRenderingContext2D, x: number, y: number, tam: number, ang: number, color: string, borde: string): void {
  c.save(); c.translate(x, y); c.rotate(ang); c.scale(tam, tam);
  c.beginPath(); c.moveTo(0.7, 0); c.lineTo(-0.3, -0.75); c.lineTo(-0.6, -0.5); c.lineTo(0.1, 0); c.lineTo(-0.6, 0.5); c.lineTo(-0.3, 0.75); c.closePath();
  c.fillStyle = color; c.fill(); c.lineWidth = 0.12; c.lineJoin = 'round'; c.strokeStyle = borde; c.stroke();
  c.restore();
}

/** Cruz de curación. */
function cruz(c: CanvasRenderingContext2D, x: number, y: number, tam: number, color: string, borde: string): void {
  const a = tam * 0.36;
  c.beginPath();
  c.moveTo(x - a, y - tam); c.lineTo(x + a, y - tam); c.lineTo(x + a, y - a); c.lineTo(x + tam, y - a); c.lineTo(x + tam, y + a); c.lineTo(x + a, y + a);
  c.lineTo(x + a, y + tam); c.lineTo(x - a, y + tam); c.lineTo(x - a, y + a); c.lineTo(x - tam, y + a); c.lineTo(x - tam, y - a); c.lineTo(x - a, y - a); c.closePath();
  c.fillStyle = color; c.fill(); c.lineWidth = Math.max(1.5, tam * 0.2); c.lineJoin = 'round'; c.strokeStyle = borde; c.stroke();
}

/** Bola Sombra: esfera negra con remolino morado y una cara fantasma que asoma. */
function bolaSombra(c: CanvasRenderingContext2D, engine: FxEngine, p: Vec, r: number, t: number): void {
  if (r <= 0) return;
  luz(c, engine, FAN.core, p, r * 2.1, 0.75);
  c.save();
  const g = c.createRadialGradient(p.x - r * 0.3, p.y - r * 0.3, r * 0.1, p.x, p.y, r);
  g.addColorStop(0, '#5a3a8a'); g.addColorStop(0.6, '#1e0f36'); g.addColorStop(1, '#0a0418');
  c.beginPath(); c.arc(p.x, p.y, r, 0, TAU); c.fillStyle = g; c.fill();
  c.clip();
  forma(c, 'espiral', p.x, p.y, r * 1.15, -t * 14, { base: FAN.glow, borde: '#9a72f0', grosor: Math.max(1.5, r * 0.12) });
  c.globalAlpha = 0.45 + 0.45 * Math.sin(t * 22);
  c.fillStyle = '#efe6ff';
  for (const s of [-1, 1]) { c.beginPath(); c.ellipse(p.x + s * r * 0.28, p.y - r * 0.15, r * 0.11, r * 0.16, 0, 0, TAU); c.fill(); }
  c.beginPath(); c.ellipse(p.x, p.y + r * 0.3, r * 0.18, r * 0.12, 0, 0, TAU); c.fill();
  c.restore();
  c.save(); c.lineWidth = 2; c.strokeStyle = FAN.glow; c.beginPath(); c.arc(p.x, p.y, r, 0, TAU); c.stroke(); c.restore();
}

/** Dos formas que viajan en arco entre el usuario y el objetivo e intercambian su sitio (Cambiadefensa, Cambiafuerza). */
function intercambio(k: Kit, ms: number, pinta: (c: CanvasRenderingContext2D, p: Vec, tam: number, deUsuario: boolean, t: number) => void): void {
  const A = k.user, B = k.target;
  k.dibujar(ms, (c, t) => {
    const f = easeInOut(Math.max(0, Math.min(1, (t - 0.15) / 0.65))), arco = k.s(0.7) * Math.sin(Math.PI * f);
    c.globalAlpha = aparece(t, 0.12, 0.15);
    const pa = { x: lerp(A.center.x, B.center.x, f) + k.perp.x * arco, y: lerp(A.center.y, B.center.y, f) + k.perp.y * arco - k.s(0.25) * Math.sin(Math.PI * f) };
    const pb = { x: lerp(B.center.x, A.center.x, f) - k.perp.x * arco, y: lerp(B.center.y, A.center.y, f) - k.perp.y * arco - k.s(0.25) * Math.sin(Math.PI * f) };
    pinta(c, pa, lerp(A.size, B.size, f) * 0.36, true, t);
    pinta(c, pb, lerp(B.size, A.size, f) * 0.36, false, t);
  }, { z: 1 });
}

export const FIRMAS: Record<string, Firma> = {
  // Mordisco (60): unas mandíbulas oscuras se abren sobre el objetivo y se cierran de golpe; el impacto llega al
  // cerrarse, con astillas blancas y un temblor.
  async bite(k) {
    await k.anticipar(80);
    void k.embestida({ hasta: 0.45, ida: 140, vuelta: 240 });
    const c0 = k.target.center, tam = k.s(0.55), abrir = 160, cerrar = 90;
    k.dibujar(abrir + cerrar + 180, (c, t) => {
      const ms = t * (abrir + cerrar + 180);
      const ap = ms < abrir ? Math.min(1, ms / abrir * 1.2) : ms < abrir + cerrar ? 1 - easeIn((ms - abrir) / cerrar) : 0;
      const fuera = ms > abrir + cerrar ? (ms - abrir - cerrar) / 180 : 0;
      c.globalAlpha = Math.min(1, ms / 60) * (1 - fuera);
      mandibula(c, c0.x, c0.y - k.s(0.05), tam * (1 + fuera * 0.15), ap, { base: '#3a2448', claro: '#fbf6ff', borde: '#140a1c', brillo: SINIESTRO.glow, brilloTam: 10 });
    }, { z: 1 });
    await k.esperar(abrir + cerrar);
    await k.impacto(t => {
      E.sparks(k.fx, t.center, { count: 14, speed: [140, 300], palette: { ...SINIESTRO, core: '#ffffff', glow: '#e8e0ff' }, shape: 'shard', size: [2.5, 4.5] });
      k.add(E.ring({ at: t.center, from: 4, to: t.size * 0.7, width: 4, color: SINIESTRO.glow, duration: 240 }));
      void k.agitar(t.sprite, 3, 220);
      for (let i = 0; i < 5; i++) k.emit({ x: t.center.x + rand(-10, 10), y: t.center.y, vx: rand(-60, 60), vy: rand(-80, -20), life: 500, size: 8, sizeEnd: 16, color: SINIESTRO.dark, alpha: 0.35, shape: 'smoke' });
    });
    await k.despues();
  },

  // ---- Psíquico ----

  // Agilidad: el usuario hace tres quiebros rapidísimos a los lados dejando estelas rosas y azules, con líneas de
  // velocidad y soplos de aire en los pies.
  async agility(k) {
    const u = k.user, s = u.size, ms = 480, lado = s * 0.35;
    void k.animar(u.sprite, [
      { transform: 'translate(0px, 0px) scale(1, 1)' },
      { transform: `translate(${lado}px, ${-s * 0.05}px) scale(0.88, 1.08)`, offset: 0.2 },
      { transform: `translate(${-lado}px, ${s * 0.02}px) scale(0.88, 1.08)`, offset: 0.45 },
      { transform: `translate(${lado * 0.6}px, ${-s * 0.04}px) scale(0.9, 1.06)`, offset: 0.7 },
      { transform: 'translate(0px, 0px) scale(1, 1)' },
    ], ms, 'linear');
    for (let i = 0; i < 6; i++) k.sombra(u.sprite, { x: (i % 2 ? -1 : 1) * lado * (0.5 + i * 0.1), y: 0 }, i % 2 ? PSI.glow : '#9ce8ff', i * 70, 280);
    k.dibujar(ms, () => {
      if (Math.random() < 0.8) {
        const y = u.center.y + rand(-s * 0.5, s * 0.4), d = Math.random() < 0.5 ? -1 : 1;
        k.emit({ x: u.center.x - d * s * 0.9, y, vx: d * rand(600, 900), life: 200, size: rand(1.2, 2.2), color: pick(['#ffffff', PSI.glow, '#9ce8ff']), shape: 'streak', stretch: 40 });
      }
    });
    for (let i = 0; i < 3; i++) k.add(E.ring({ at: u.feet, from: s * 0.2, to: s * 0.75, width: 2, color: '#ffffff', duration: 260, squash: 0.35, delay: i * 150 }));
    await k.esperar(ms);
    await k.estado();
  },

  // Cambio de Banda: dos flechas curvas giran alrededor del usuario mientras se estrecha y se desvanece; reaparece
  // en un destello rosa (ha cambiado de sitio).
  async allyswitch(k) {
    const u = k.user, s = u.size, c0 = u.center, ms = 600;
    k.dibujar(ms, (c, t) => {
      const giro = easeInOut(t) * TAU * 1.3;
      c.globalAlpha = Math.sin(Math.PI * t);
      for (const lado of [0, Math.PI]) flechaCurva(c, c0.x, c0.y, s * 0.68, giro + lado, 2.1, PSI.core, '#4a0c28', Math.max(3, s * 0.1));
    }, { z: 1 });
    void k.animar(u.sprite, [{ opacity: 1 }, { opacity: 0.1, offset: 0.42 }, { opacity: 0.1, offset: 0.58 }, { opacity: 1 }], ms);
    void k.animar(u.sprite, [{ transform: 'scale(1, 1)' }, { transform: 'scale(0.55, 1.2)', offset: 0.45 }, { transform: 'scale(1.15, 0.9)', offset: 0.72 }, { transform: 'scale(1, 1)' }], ms);
    await k.esperar(ms * 0.55);
    k.add(E.bloom({ at: c0, radius: s * 0.9, color: PSI.glow, duration: 300 }));
    k.add(E.ring({ at: c0, from: s * 0.2, to: s * 0.9, width: 3, color: '#ffffff', duration: 300, squash: 0.6 }));
    k.burst(10, () => { const a = rand(0, TAU); return { x: c0.x, y: c0.y, vx: Math.cos(a) * rand(120, 240), vy: Math.sin(a) * rand(80, 160), drag: 3, life: 380, size: rand(2.5, 4), color: pick([PSI.glow, '#ffffff']), shape: 'star' }; });
    await k.esperar(ms * 0.45);
    await k.estado();
  },

  // Amnesia: de la cabeza del usuario brotan interrogaciones que bailan mientras ladea la cabeza; una nubecilla las
  // borra (se le ha olvidado todo... y se relaja).
  async amnesia(k) {
    const u = k.user, s = u.size, cab = u.top;
    for (let i = 0; i < 3; i++) {
      const dx = (i - 1) * s * 0.36, tam = s * (i === 1 ? 0.55 : 0.36), d = i * 90;
      k.dibujar(600 - d, (c, t) => {
        const sc = rebote(Math.min(1, t * 3.2)), fuera = t > 0.72 ? (t - 0.72) / 0.28 : 0;
        c.globalAlpha = 1 - fuera;
        signo(c, '?', cab.x + dx, cab.y - s * 0.12 - t * s * 0.35, tam * sc * (1 - fuera * 0.4), '#9fd4ff', '#16324f', Math.sin(t * 12 + i) * 0.3);
      }, { z: 1, delay: d });
    }
    void k.animar(u.sprite, [{ transform: 'rotate(0deg)' }, { transform: 'rotate(-12deg)', offset: 0.3 }, { transform: 'rotate(10deg)', offset: 0.62 }, { transform: 'rotate(0deg)' }], 620, 'ease-in-out');
    await k.esperar(470);
    humo(k, { x: cab.x, y: cab.y - s * 0.4 }, 7, '#eef2ff', s * 0.16, 460, 40, 0.6);
    await k.esperar(150);
    await k.estado();
  },

  // Paz Mental: un loto rosa se abre bajo el usuario, que flota un poco con los ojos cerrados; de su cabeza suben
  // anillos de calma lentos y motas de luz.
  async calmmind(k) {
    const u = k.user, s = u.size, ms = 760;
    k.dibujar(ms, (c, t, engine) => {
      const ab = easeOutCubic(Math.min(1, t * 1.8)), a = aparece(t, 0.05, 0.2);
      luz(c, engine, PSI.glow, u.feet, s * 0.75 * ab, 0.45 * a);
      c.globalAlpha = a * 0.92;
      loto(c, u.feet.x, u.feet.y + s * 0.02, s * 0.5, ab, '#ff8ab8', '#ffd0e2', '#7a1240');
    });
    for (let i = 0; i < 3; i++) k.add(E.ring({ at: { x: u.top.x, y: u.top.y - s * 0.05 - i * s * 0.12 }, from: s * 0.12, to: s * 0.55, width: 2.5, color: i % 2 ? '#9ce8ff' : PSI.glow, duration: 520, squash: 0.35, delay: 140 + i * 140 }));
    k.burst(10, i => ({ x: u.center.x + rand(-s * 0.5, s * 0.5), y: u.feet.y - rand(0, s * 0.2), vy: -rand(30, 60), life: 650, delay: i * 40, size: rand(2, 3.5), color: pick([PSI.glow, '#c8f0ff', '#ffffff']), shape: 'star', fadeIn: 0.3 }));
    void k.animar(u.sprite, [{ transform: 'translate(0px, 0px)' }, { transform: `translate(0px, ${-s * 0.08}px)`, offset: 0.5 }, { transform: 'translate(0px, 0px)' }], ms, 'ease-in-out');
    await k.esperar(ms - 160);
    await k.estado();
  },

  // Confusión (50): tres anillos rosas se cierran sobre el objetivo, que se tambalea mareado entre brillos psíquicos.
  async confusion(k) {
    await k.cargar(100);
    const tt = k.target, s = tt.size;
    for (let i = 0; i < 3; i++) k.add(E.ring({ at: tt.center, from: s * 0.95, to: s * 0.18, width: 3, color: i % 2 ? '#ffffff' : PSI.core, duration: 260, delay: i * 70, squash: 0.6 }));
    k.dibujar(420, (c, t, engine) => luz(c, engine, PSI.core, tt.center, s * 0.6, 0.45 * Math.sin(Math.PI * t)));
    if (k.acierta) void k.animar(tt.sprite, [{ transform: 'rotate(0deg)' }, { transform: 'rotate(9deg)' }, { transform: 'rotate(-9deg)' }, { transform: 'rotate(5deg)' }, { transform: 'rotate(0deg)' }], 300);
    await k.esperar(300);
    await k.impacto(t => {
      E.sparks(k.fx, t.center, { count: 12, speed: [100, 240], palette: PSI, shape: 'star', size: [2, 4] });
      k.add(E.ring({ at: t.center, from: 6, to: t.size * 0.8, width: 3, color: PSI.glow, duration: 260, squash: 0.6 }));
    });
    await k.despues();
  },

  // Masa Cósmica: se abre un trozo de cielo nocturno alrededor del usuario; una constelación gira y cae sobre él, que
  // queda brillando como un astro.
  async cosmicpower(k) {
    const u = k.user, s = u.size, c0 = u.center, ms = 800;
    const estrellas = Array.from({ length: 7 }, (_, i) => ({ a: i / 7 * TAU + rand(-0.3, 0.3), r: s * rand(0.7, 1.05) }));
    k.dibujar(ms, (c, t, engine) => {
      const ap = aparece(t, 0.25, 0.25);
      c.save(); c.globalAlpha = 0.6 * ap;
      const g = c.createRadialGradient(c0.x, c0.y, 0, c0.x, c0.y, s * 1.3);
      g.addColorStop(0, 'rgba(40, 20, 100, 0.9)'); g.addColorStop(0.7, 'rgba(20, 10, 60, 0.6)'); g.addColorStop(1, 'rgba(10, 5, 30, 0)');
      c.fillStyle = g; c.beginPath(); c.ellipse(c0.x, c0.y, s * 1.3, s * 1.1, 0, 0, TAU); c.fill(); c.restore();
      const cae = easeIn(Math.max(0, (t - 0.55) / 0.4));
      const pts = estrellas.map(e => { const a = e.a + t * 1.2, r = e.r * (1 - cae * 0.85); return { x: c0.x + Math.cos(a) * r, y: c0.y + Math.sin(a) * r * 0.75 }; });
      c.save(); c.globalAlpha = ap * 0.7 * (1 - cae); c.strokeStyle = '#c8d8ff'; c.lineWidth = 1.2;
      c.beginPath(); pts.forEach((p, i) => (i ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y))); c.closePath(); c.stroke(); c.restore();
      for (const p of pts) {
        luz(c, engine, '#fff0a0', p, s * 0.14, ap);
        c.save(); c.globalAlpha = ap; forma(c, 'estrella', p.x, p.y, s * 0.085, t * 3, { base: '#fff6c0', borde: '#5a4a90', grosor: 1.5 }); c.restore();
      }
      if (Math.random() < 0.5) k.emit({ x: c0.x + rand(-s, s), y: c0.y + rand(-s * 0.8, s * 0.8), life: 300, size: rand(1.5, 3), color: '#ffffff', shape: 'star', fadeIn: 0.4 });
    }, { z: 1 });
    await k.esperar(ms * 0.9);
    k.add(E.bloom({ at: c0, radius: s * 0.9, color: '#b8a0ff', duration: 340 }));
    k.add(E.ring({ at: c0, from: s * 0.3, to: s * 1.0, width: 3, color: '#fff0a0', duration: 340, squash: 0.6 }));
    k.destello(u.sprite);
    await k.estado();
  },

  // Comesueños (100): con la vista en penumbra, del objetivo sale una burbuja de sueño (nube con luna y estrellas);
  // un remolino rosa la arranca (el golpe) y el usuario se la traga.
  async dreameater(k) {
    const tt = k.target, s = tt.size, u = k.user, ms = 600;
    k.add(E.dim({ at: tt.center, duration: 980, strength: 0.45 }));
    await k.cargar(100);
    const base = { x: tt.top.x + s * 0.15, y: tt.top.y - s * 0.1 };
    k.dibujar(ms, (c, t, engine) => {
      const m = t * ms, sale = easeOutCubic(Math.min(1, m / 200)), absorbe = easeIn(Math.max(0, (m - 260) / (ms - 260)));
      const pos = { x: lerp(base.x, u.center.x, absorbe), y: lerp(base.y - s * 0.4 * sale, u.center.y, absorbe) - Math.sin(Math.PI * absorbe) * s * 0.35 };
      const r = s * 0.42 * sale * (1 - absorbe * 0.8);
      if (absorbe < 0.3) {
        c.save(); c.globalAlpha = 0.85 * (1 - absorbe / 0.3); c.fillStyle = '#f4e6ff'; c.strokeStyle = '#7a3ab0'; c.lineWidth = 1.5;
        for (const f of [0.3, 0.6]) { const q = { x: lerp(base.x, pos.x, f), y: lerp(base.y, pos.y + r * 0.5, f) }; c.beginPath(); c.arc(q.x, q.y, s * 0.04 * (1 + f), 0, TAU); c.fill(); c.stroke(); }
        c.restore();
      }
      if (r <= 1) return;
      luz(c, engine, PSI.glow, pos, r * 1.6, 0.5);
      c.save(); c.globalAlpha = 0.95;
      nube(c, pos.x, pos.y, r, '#f4e6ff', '#7a3ab0', 1.8);
      forma(c, 'luna', pos.x - r * 0.22, pos.y, r * 0.3, Math.PI, { base: '#ffe680', borde: '#8a6a00', grosor: 1.5 });
      forma(c, 'estrella', pos.x + r * 0.3, pos.y - r * 0.12, r * 0.16, t * 4, { base: '#ffe680', borde: '#8a6a00', grosor: 1.2 });
      forma(c, 'estrella', pos.x + r * 0.15, pos.y + r * 0.22, r * 0.1, -t * 4, { base: '#ffffff', borde: '#8a6a00', grosor: 1 });
      if (absorbe > 0) forma(c, 'espiral', pos.x, pos.y, r * 1.3, m * 0.02, { base: PSI.core, borde: PSI.core, grosor: 2.5, alpha: Math.min(1, absorbe * 3) });
      c.restore();
      if (absorbe > 0 && Math.random() < 0.7) k.emit({ x: pos.x + rand(-r, r) * 0.5, y: pos.y + rand(-r, r) * 0.4, vx: rand(-30, 30), vy: rand(-30, 30), life: 320, size: rand(3, 6), sizeEnd: 0, color: pick([PSI.glow, '#e8c8ff', '#ffe680']), shape: 'glow' });
    }, { z: 1 });
    await k.esperar(280);
    await k.impacto(t => {
      k.add(E.ring({ at: t.top, from: 4, to: t.size * 0.7, width: 3, color: PSI.glow, duration: 280 }));
      E.sparks(k.fx, t.top, { count: 12, speed: [80, 200], palette: PSI, shape: 'star', size: [2, 4] });
    });
    await k.esperar(ms - 330);
    k.add(E.bloom({ at: u.center, radius: u.size * 0.85, color: PSI.glow, duration: 320 }));
    k.burst(12, () => { const a = rand(0, TAU); return { x: u.center.x, y: u.center.y, vx: Math.cos(a) * rand(80, 180), vy: Math.sin(a) * rand(60, 140), drag: 3, life: 420, size: rand(2.5, 4), color: pick(['#ffe680', PSI.glow, '#ffffff']), shape: 'star' }; });
    await k.despues();
  },

  // Paranormal (80): un gran ojo se abre delante del usuario, mira fijo y lanza ondas cuadradas de colores imposibles
  // (verde, rosa, violeta) que giran y estallan sobre el objetivo.
  async extrasensory(k) {
    const ojo = k.punto(0.2), te = k.user.size * 0.42, abrir = 160, viaje = 260, cierra = 220;
    k.dibujar(abrir + viaje + cierra, (c, t, engine) => {
      const m = t * (abrir + viaje + cierra), ap = Math.min(1, m / abrir) * (m > abrir + viaje ? 1 - (m - abrir - viaje) / cierra : 1);
      luz(c, engine, '#b07dff', ojo, te * 1.7, 0.55 * ap);
      ojoQueSeAbre(c, ojo.x, ojo.y, te, ap, '#2ec27a', '#7dffb0');
    }, { z: 1 });
    await k.esperar(abrir);
    const cols = ['#7dffb0', PSI.core, '#b07dff'];
    for (let i = 0; i < 3; i++) k.dibujar(viaje, (c, t) => {
      const p = k.punto(lerp(0.22, 1, t)), r = k.s(0.2 + 0.32 * t);
      c.save(); c.translate(p.x, p.y); c.rotate(t * 4 + i * 0.5); c.globalAlpha = 0.9 * (1 - t * 0.3);
      c.lineWidth = 5; c.strokeStyle = cols[i]; c.strokeRect(-r, -r, r * 2, r * 2);
      c.lineWidth = 1.5; c.strokeStyle = '#ffffff'; c.strokeRect(-r, -r, r * 2, r * 2);
      c.restore();
    }, { z: 1, delay: i * 55 });
    await k.esperar(viaje);
    await k.impacto(t => {
      for (let i = 0; i < 3; i++) k.dibujar(360, (c, u) => {
        const r = t.size * (0.3 + 0.7 * easeOutCubic(u));
        c.save(); c.translate(t.center.x, t.center.y); c.rotate(-u * 3 + i * 0.6); c.globalAlpha = 1 - easeIn(u);
        c.lineWidth = 4; c.strokeStyle = cols[i]; c.strokeRect(-r, -r, r * 2, r * 2); c.restore();
      }, { z: 1, delay: i * 50 });
      k.burst(14, () => { const a = rand(0, TAU), v = rand(120, 280); return { x: t.center.x, y: t.center.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, drag: 3, life: 420, size: rand(2.5, 4.5), color: pick(cols), shape: 'star' }; });
    });
    await k.despues();
  },

  // Premonición (120, épica): carga épica; en lo alto se abre un ojo enorme que mira al objetivo y deja caer sobre él
  // una columna de luz rosa que estalla en anillos por el suelo.
  async futuresight(k) {
    await k.cargaEpica();
    const tt = k.target, s = tt.size, abrir = 240, mira = 140, cae = 130, sale = 320;
    const cielo = { x: tt.center.x, y: Math.max(k.stage.top + s * 0.7, tt.center.y - s * 2.3) };
    k.add(E.dim({ at: tt.center, duration: abrir + mira + cae + 420, strength: 0.5 }));
    k.dibujar(abrir + mira + cae + sale, (c, t, engine) => {
      const m = t * (abrir + mira + cae + sale), ap = easeOutCubic(Math.min(1, m / abrir)) * (m > abrir + mira + cae ? 1 - (m - abrir - mira - cae) / sale : 1);
      luz(c, engine, PSI.core, cielo, s * 1.5 * ap, 0.6);
      ojoQueSeAbre(c, cielo.x, cielo.y, s * 0.9, ap, '#c02a8a', '#ff9cc2');
      if (m > abrir * 0.6 && Math.random() < 0.6) {
        const a = rand(0, TAU);
        k.emit({ x: cielo.x + Math.cos(a) * s * 0.9, y: cielo.y + Math.sin(a) * s * 0.5, vx: Math.cos(a) * 200, vy: Math.sin(a) * 120, life: 260, size: rand(1.5, 2.5), color: pick([PSI.glow, '#ffffff']), shape: 'streak', stretch: 30 });
      }
    }, { z: 1 });
    await k.esperar(abrir + mira);
    k.add(E.beam({ from: { x: cielo.x, y: cielo.y + s * 0.35 }, to: tt.center, width: s * 0.65, palette: PSI, duration: cae + 280 }));
    await k.esperar(cae);
    await k.impacto(t => {
      k.add(E.flash({ color: PSI.glow, alpha: 0.35, duration: 240 }));
      k.add(E.bloom({ at: t.center, radius: t.size * 1.2, color: PSI.core, duration: 360 }));
      for (let i = 0; i < 3; i++) k.add(E.ring({ at: t.feet, from: t.size * 0.2, to: t.size * (1 + i * 0.35), width: 4 - i, color: i % 2 ? '#ffffff' : PSI.glow, duration: 420, squash: 0.35, delay: i * 70 }));
      E.sparks(k.fx, t.center, { count: 22, speed: [160, 380], palette: PSI, shape: 'star', size: [2.5, 5] });
    });
    await k.esperar(160);
    await k.despues();
  },

  // Gravedad: la vista se oscurece y pesa: rayas que caen por todo el campo, anillos que se aplastan contra el suelo
  // bajo cada Pokémon y los sprites se achatan.
  async gravity(k) {
    const ms = 720, st = k.stage, u = k.user;
    k.add(E.dim({ at: u.center, duration: ms, strength: 0.35 }));
    k.dibujar(ms, (c, t) => {
      const y = st.top + st.height * easeIn(Math.min(1, t * 1.4));
      const g = c.createLinearGradient(0, y - st.height * 0.35, 0, y);
      g.addColorStop(0, 'rgba(120, 80, 220, 0)'); g.addColorStop(1, 'rgba(120, 80, 220, 0.22)');
      c.fillStyle = g; c.fillRect(st.left, y - st.height * 0.35, st.width, st.height * 0.35);
    });
    k.dibujar(ms * 0.8, () => {
      for (let i = 0; i < 2; i++) k.emit({ x: st.left + rand(0, st.width), y: st.top + rand(0, st.height * 0.6), vy: rand(650, 950), life: 240, size: rand(1.2, 2), color: pick(['#c8b0ff', '#ffffff', PSI.glow]), shape: 'streak', stretch: 40, alpha: 0.7 });
    });
    const gs: SlotGeometry[] = [u, ...(k.hayObjetivo ? k.ctx.targets : [])];
    for (const g of gs) {
      for (let i = 0; i < 3; i++) k.add(E.ring({ at: g.feet, from: g.size * 0.95, to: g.size * 0.25, width: 3, color: i % 2 ? '#ffffff' : '#a080ff', duration: 320, squash: 0.3, delay: 100 + i * 110 }));
      void k.animar(g.sprite, [{ transform: 'translate(0px, 0px) scale(1, 1)' }, { transform: 'translate(0px, 2px) scale(1.14, 0.82)', offset: 0.35 }, { transform: 'translate(0px, 2px) scale(1.1, 0.86)', offset: 0.78 }, { transform: 'translate(0px, 0px) scale(1, 1)' }], ms, 'ease-in-out');
    }
    await k.esperar(ms - 100);
    await k.estado();
  },

  // Isoguardia: un escudo azul sobre el usuario y uno rosa sobre el objetivo vuelan al centro, se funden en un
  // destello y vuelven a su sitio del mismo color (se reparten la defensa).
  async guardsplit(k) {
    const A = k.user, B = k.target, ms = 760;
    const mitad = { x: (A.center.x + B.center.x) / 2, y: (A.center.y + B.center.y) / 2 - k.s(0.3) };
    k.dibujar(ms, (c, t) => {
      const ida = easeInOut(Math.min(1, t / 0.4)), vuelta = easeInOut(Math.max(0, (t - 0.55) / 0.4)), f = ida * (1 - vuelta);
      const funde = Math.min(1, Math.max(0, (t - 0.4) / 0.12));
      c.globalAlpha = aparece(t, 0.1, 0.15);
      const pa = { x: lerp(A.center.x, mitad.x, f) - k.perp.x * k.s(0.12) * f, y: lerp(A.center.y, mitad.y, f) - k.perp.y * k.s(0.12) * f };
      const pb = { x: lerp(B.center.x, mitad.x, f) + k.perp.x * k.s(0.12) * f, y: lerp(B.center.y, mitad.y, f) + k.perp.y * k.s(0.12) * f };
      forma(c, 'escudo', pa.x, pa.y, A.size * 0.36, 0, { base: mix('#5aa8ff', '#a08cff', funde), claro: '#e0f0ff', borde: '#14304a', brillo: '#7ec8ff', brilloTam: 8 });
      forma(c, 'escudo', pb.x, pb.y, B.size * 0.36, 0, { base: mix('#ff7ab0', '#a08cff', funde), claro: '#ffe0f0', borde: '#4a1430', brillo: '#ff9cc2', brilloTam: 8 });
    }, { z: 1 });
    k.add(E.bloom({ at: mitad, radius: k.s(0.8), color: '#c8b8ff', duration: 300, delay: ms * 0.4 }));
    k.add(E.ring({ at: mitad, from: 6, to: k.s(0.8), width: 3, color: '#ffffff', duration: 300, delay: ms * 0.4 }));
    await k.esperar(ms - 100);
    await k.estado();
  },

  // Cambiadefensa: el escudo del usuario y el del objetivo se cruzan en arco, girando, y cada uno acaba en el otro.
  async guardswap(k) {
    const ms = 720;
    intercambio(k, ms, (c, p, tam, deUsuario, t) => {
      forma(c, 'escudo', p.x, p.y, tam, Math.sin(t * TAU) * 0.4 * (deUsuario ? 1 : -1), deUsuario
        ? { base: '#5aa8ff', claro: '#e0f0ff', borde: '#14304a', brillo: '#7ec8ff', brilloTam: 8 }
        : { base: '#ff7ab0', claro: '#ffe0f0', borde: '#4a1430', brillo: '#ff9cc2', brilloTam: 8 });
    });
    k.add(E.bloom({ at: k.punto(0.5), radius: k.s(0.5), color: PSI.glow, duration: 240, delay: ms * 0.42 }));
    await k.esperar(ms - 120);
    k.add(E.ring({ at: k.user.center, from: 6, to: k.user.size * 0.7, width: 3, color: '#ff9cc2', duration: 260 }));
    if (k.hayObjetivo) k.add(E.ring({ at: k.target.center, from: 6, to: k.target.size * 0.7, width: 3, color: '#7ec8ff', duration: 260 }));
    await k.estado();
  },

  // Deseo Cura: el usuario se eleva brillando y lanza al cielo una estrella de deseo; cae una lluvia de destellos y
  // corazones rosas mientras él se apaga (se sacrifica).
  async healingwish(k) {
    const u = k.user, s = u.size, ms = 900, sube = 380;
    void k.animar(u.sprite, [{ transform: 'translate(0px, 0px)' }, { transform: `translate(0px, ${-s * 0.25}px)`, offset: 0.45 }, { transform: 'translate(0px, 0px)' }], ms, 'ease-in-out');
    void k.animar(u.sprite, [{ opacity: 1 }, { opacity: 0.3, offset: 0.7 }, { opacity: 1 }], ms);
    k.dibujar(sube, (c, t, engine) => {
      const p = { x: u.center.x + Math.sin(t * 6) * s * 0.1, y: lerp(u.top.y, Math.min(u.top.y - s, k.stage.top + s * 0.3), easeIn(t)) };
      luz(c, engine, '#ffd0ec', p, s * 0.4);
      forma(c, 'estrella', p.x, p.y, s * 0.17, t * 8, { base: '#fff6c0', borde: '#c05a8a', brillo: '#ffd0ec', brilloTam: 12 });
      if (Math.random() < 0.8) k.emit({ x: p.x, y: p.y, vx: rand(-30, 30), vy: rand(20, 60), life: 360, size: rand(2, 3.5), color: pick(['#fff6c0', '#ffd0ec']), shape: 'star' });
    }, { z: 1 });
    await k.esperar(sube);
    k.add(E.flash({ color: '#ffd0ec', alpha: 0.22, duration: 260 }));
    k.burst(26, i => ({ x: u.center.x + rand(-s * 1.2, s * 1.2), y: u.center.y - s * rand(1.2, 2.2), vx: rand(-15, 15), vy: rand(150, 260), life: 620, delay: i * 14, size: rand(3, 5), color: pick(['#ffd0ec', '#fff6c0', '#ff9cc2', '#ffffff']), shape: i % 3 ? 'star' : 'heart', fadeIn: 0.2 }));
    await k.esperar(420);
    await k.estado();
  },

  // Pulso Cura: frentes de onda verdes y rosas salen del usuario hacia el objetivo; al llegar se ilumina y suben cruces
  // de curación.
  async healpulse(k) {
    await k.cargar(100);
    const tt = k.target, ms = 360;
    for (let i = 0; i < 3; i++) k.dibujar(ms, (c, t) => {
      const p = k.punto(easeOut(t) * 0.95), r = k.s(0.15 + 0.32 * t);
      c.globalAlpha = 0.9 * (1 - t * 0.5); c.lineWidth = 4; c.lineCap = 'round'; c.strokeStyle = i % 2 ? '#ff9cc2' : NEUTRAL_FX.heal.core;
      c.beginPath(); c.arc(p.x, p.y, r, k.angle - 0.9, k.angle + 0.9); c.stroke();
    }, { z: 1, delay: i * 90 });
    await k.esperar(ms + 90);
    k.dibujar(560, (c, t) => {
      for (let i = 0; i < 4; i++) {
        const p = { x: tt.center.x + (i - 1.5) * tt.size * 0.25, y: tt.center.y + tt.size * 0.2 - t * tt.size * 0.6 - (i % 2) * tt.size * 0.15 };
        c.save(); c.globalAlpha = aparece(t, 0.15, 0.4); cruz(c, p.x, p.y, tt.size * 0.08, '#6ff2a0', '#13703a'); c.restore();
      }
    }, { z: 1 });
    k.add(E.bloom({ at: tt.center, radius: tt.size * 0.75, color: NEUTRAL_FX.heal.glow, duration: 360 }));
    k.add(E.ring({ at: tt.center, from: 6, to: tt.size * 0.8, width: 3, color: NEUTRAL_FX.heal.core, duration: 320 }));
    await k.esperar(220);
    await k.estado();
  },

  // Hipnosis: del usuario salen ondas hipnóticas y sobre el objetivo gira una doble espiral rosa y violeta enorme;
  // el objetivo se balancea, adormecido.
  async hypnosis(k) {
    const tt = k.target, s = tt.size, ms = 680;
    for (let i = 0; i < 4; i++) k.dibujar(360, (c, t) => {
      const p = k.punto(t * 0.9), r = k.s(0.12 + 0.25 * t);
      c.globalAlpha = (1 - t) * 0.8; c.lineWidth = 2.5; c.strokeStyle = i % 2 ? '#d48cff' : PSI.glow;
      c.beginPath(); c.arc(p.x, p.y, r, k.angle - 1, k.angle + 1); c.stroke();
    }, { z: 1, delay: i * 70 });
    k.dibujar(ms, (c, t, engine) => {
      const a = aparece(t, 0.2, 0.25), r = s * 0.6 * (0.7 + 0.3 * t);
      luz(c, engine, '#b07dff', tt.center, s * 0.95, 0.35 * a);
      c.globalAlpha = a * 0.92;
      forma(c, 'espiral', tt.center.x, tt.center.y, r, -t * 14, { base: '#ff9cc2', borde: '#ff9cc2', grosor: 3.5, brillo: '#d48cff', brilloTam: 10 });
      forma(c, 'espiral', tt.center.x, tt.center.y, r, -t * 14 + Math.PI, { base: '#b07dff', borde: '#8a4ad0', grosor: 3 });
    }, { z: 1, delay: 200 });
    void k.animar(tt.sprite, [{ transform: 'rotate(0deg)' }, { transform: 'rotate(-7deg)', offset: 0.3 }, { transform: 'rotate(7deg)', offset: 0.65 }, { transform: 'rotate(0deg)' }], ms + 200, 'ease-in-out');
    await k.esperar(ms + 100);
    await k.estado();
  },

  // Sellar: un candado dorado se cierra de golpe sobre la cabeza del usuario ("clac") y un sello de runas rosas se
  // graba en el suelo a su alrededor.
  async imprison(k) {
    const u = k.user, s = u.size, p = { x: u.top.x, y: u.top.y - s * 0.2 }, ms = 720;
    k.dibujar(ms, (c, t) => {
      const cierra = easeIn(Math.min(1, Math.max(0, (t - 0.3) / 0.14))), e = rebote(Math.min(1, t * 4));
      c.globalAlpha = aparece(t, 0.08, 0.2);
      candado(c, p.x, p.y + (cierra > 0.99 ? Math.sin(Math.min(1, (t - 0.44) / 0.1) * Math.PI) * 3 : 0), s * 0.38 * e, 1 - cierra);
    }, { z: 1 });
    await k.esperar(ms * 0.44);
    k.add(E.starburst({ at: p, rays: 8, length: s * 0.5, width: 2.5, palette: PSI, duration: 220 }));
    k.dibujar(ms * 0.56, (c, t) => {
      c.globalAlpha = aparece(t, 0.1, 0.35);
      sigilo(c, u.feet.x, u.feet.y, s * 0.75 * easeOutCubic(Math.min(1, t * 2)), t * 1.5, PSI.core, Math.min(1, t * 2.2));
    });
    k.add(E.ring({ at: u.feet, from: s * 0.2, to: s * 1.0, width: 3, color: PSI.glow, duration: 360, squash: 0.45 }));
    await k.esperar(ms * 0.42);
    await k.estado();
  },

  // Kinético: una cuchara aparece flotando delante del usuario, brilla y se dobla sola; el objetivo, desconcertado,
  // pierde puntería.
  async kinesis(k) {
    const p = k.punto(0.3), tam = k.user.size * 0.55, ms = 760;
    k.dibujar(ms, (c, t, engine) => {
      const a = aparece(t, 0.12, 0.2), dob = easeInOut(Math.min(1, Math.max(0, (t - 0.3) / 0.35)));
      luz(c, engine, PSI.glow, p, tam * 0.9 * (0.7 + 0.3 * Math.sin(t * 20)), 0.55 * a);
      c.globalAlpha = a;
      cuchara(c, p.x, p.y + Math.sin(t * 8) * 3, tam, -Math.PI / 2 + 0.25, dob);
    }, { z: 1 });
    for (let i = 0; i < 3; i++) k.add(E.ring({ at: p, from: tam * 0.2, to: tam * 0.9, width: 2, color: PSI.glow, duration: 300, delay: 200 + i * 110 }));
    await k.esperar(ms * 0.65);
    if (k.hayObjetivo) {
      const tt = k.target;
      k.dibujar(360, (c, t) => {
        for (let i = 0; i < 3; i++) { const q = k.alrededor(tt.top, tt.size * 0.3, t * TAU + i * TAU / 3, 0.4); c.save(); c.globalAlpha = 1 - t; forma(c, 'estrella', q.x, q.y, tt.size * 0.07, t * 8, { base: '#fff0a0', borde: '#8a6a00', grosor: 1.2 }); c.restore(); }
      }, { z: 1 });
      void k.agitar(tt.sprite, 2, 280);
    }
    await k.esperar(ms * 0.3);
    await k.estado();
  },

  // Pantalla de Luz: una cortina de luz dorada y rosa, de franjas que ondulan como una aurora, se alza en corro
  // alrededor del usuario y destella (frena los ataques especiales).
  async lightscreen(k) {
    const u = k.user, s = u.size, ms = 820, n = 16, R = s * 0.85, H = s * 1.25;
    k.dibujar(ms, (c, t, engine) => {
      const sube = easeOutCubic(Math.min(1, t / 0.35)), a = aparece(t, 0.05, 0.3);
      const franjas = Array.from({ length: n }, (_, i) => i / n * TAU + t * 0.8).sort((p, q) => Math.sin(p) - Math.sin(q));
      c.globalCompositeOperation = engine.blend;
      for (const an of franjas) {
        const x = u.center.x + Math.cos(an) * R, base = u.feet.y + Math.sin(an) * R * 0.4;
        const h = H * sube * (0.8 + 0.2 * Math.sin(an * 3 + t * 9)), w = s * 0.18 * (0.35 + 0.65 * Math.abs(Math.sin(an))), ond = Math.sin(t * 10 + an * 2) * s * 0.05;
        const g = c.createLinearGradient(x, base, x, base - h);
        g.addColorStop(0, 'rgba(255, 230, 140, 0.8)'); g.addColorStop(0.6, 'rgba(255, 160, 210, 0.45)'); g.addColorStop(1, 'rgba(255, 200, 230, 0)');
        c.globalAlpha = a * (Math.sin(an) > 0 ? 0.75 : 0.4);
        c.fillStyle = g;
        c.beginPath(); c.moveTo(x - w / 2, base); c.quadraticCurveTo(x - w / 2 + ond, base - h / 2, x - w / 2 + ond * 0.5, base - h);
        c.lineTo(x + w / 2 + ond * 0.5, base - h); c.quadraticCurveTo(x + w / 2 + ond, base - h / 2, x + w / 2, base); c.closePath(); c.fill();
      }
      c.globalAlpha = a * 0.7; c.strokeStyle = '#ffe890'; c.lineWidth = 2.5;
      c.beginPath(); c.ellipse(u.center.x, u.feet.y, R, R * 0.4, 0, 0, TAU); c.stroke();
      if (Math.random() < 0.5) { const an = rand(0, TAU); k.emit({ x: u.center.x + Math.cos(an) * R, y: u.feet.y + Math.sin(an) * R * 0.4, vy: -rand(60, 120), life: 420, size: rand(2, 3.5), color: pick(['#ffe890', '#ffd0ec', '#ffffff']), shape: 'star' }); }
    }, { z: 1 });
    await k.esperar(ms * 0.45);
    k.add(E.flash({ color: '#ffe890', alpha: 0.16, duration: 220 }));
    await k.esperar(ms * 0.35);
    await k.estado();
  },

  // Manto Espejo: el usuario se cubre de un manto de espejo facetado por el que pasa un reflejo; destella y devuelve
  // el golpe como un rayo de arcoíris.
  async mirrorcoat(k) {
    const u = k.user, s = u.size, cubre = 340, se = 260;
    k.dibujar(cubre + se, (c, t) => {
      const m = t * (cubre + se), a = Math.min(1, m / 120) * (m > cubre ? 1 - (m - cubre) / se : 1);
      const p = k.posSprite(), r = s * 0.62;
      c.save(); c.globalAlpha = a * 0.4;
      const g = c.createLinearGradient(p.x - r, p.y - r, p.x + r, p.y + r);
      g.addColorStop(0, '#ffe4ef'); g.addColorStop(0.35, '#c8e8ff'); g.addColorStop(0.6, '#ffffff'); g.addColorStop(1, '#e0c8ff');
      c.fillStyle = g; c.beginPath(); c.ellipse(p.x, p.y, r, r, 0, 0, TAU); c.fill();
      c.clip(); c.globalAlpha = a * 0.75; c.strokeStyle = '#ffffff'; c.lineWidth = 1.2;
      for (let i = -3; i <= 3; i++) {
        c.beginPath(); c.moveTo(p.x + i * r * 0.35 - r, p.y - r); c.lineTo(p.x + i * r * 0.35 + r, p.y + r); c.stroke();
        c.beginPath(); c.moveTo(p.x + i * r * 0.35 + r, p.y - r); c.lineTo(p.x + i * r * 0.35 - r, p.y + r); c.stroke();
      }
      const bx = p.x - r * 1.5 + Math.min(1, m / cubre) * r * 3;
      c.fillStyle = 'rgba(255, 255, 255, 0.85)';
      c.beginPath(); c.moveTo(bx, p.y - r); c.lineTo(bx + r * 0.3, p.y - r); c.lineTo(bx - r * 0.2, p.y + r); c.lineTo(bx - r * 0.5, p.y + r); c.closePath(); c.fill();
      c.restore();
      c.save(); c.globalAlpha = a; c.lineWidth = 2.5; c.strokeStyle = '#ffffff'; c.beginPath(); c.ellipse(p.x, p.y, r, r, 0, 0, TAU); c.stroke(); c.restore();
    }, { z: 1 });
    await k.esperar(cubre);
    k.destello(u.sprite);
    k.add(E.bloom({ at: u.center, radius: s, color: '#ffffff', duration: 220 }));
    k.dibujar(380, (c, t) => {
      const a = Math.min(1, t * 6) * Math.min(1, (1 - t) / 0.45), from = k.punto(0.12), to = k.target.center, w = k.s(0.06);
      c.lineCap = 'round';
      ARCOIRIS.forEach((col, i) => {
        const off = (i - 2.5) * w * 0.9;
        c.globalAlpha = a * 0.9; c.strokeStyle = col; c.lineWidth = w;
        c.beginPath(); c.moveTo(from.x + k.perp.x * off * 0.4, from.y + k.perp.y * off * 0.4); c.lineTo(to.x + k.perp.x * off, to.y + k.perp.y * off); c.stroke();
      });
      c.globalAlpha = a; c.strokeStyle = '#ffffff'; c.lineWidth = w * 0.7;
      c.beginPath(); c.moveTo(from.x, from.y); c.lineTo(to.x, to.y); c.stroke();
    }, { z: 1 });
    await k.esperar(90);
    await k.impacto(t => {
      k.burst(18, () => { const a = rand(0, TAU), v = rand(140, 320); return { x: t.center.x, y: t.center.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, drag: 3, life: rand(320, 480), size: rand(3, 5.5), color: pick(ARCOIRIS), shape: 'shard', spin: rand(-10, 10) }; });
      k.add(E.bloom({ at: t.center, radius: t.size * 0.9, color: '#ffffff', duration: 280 }));
      k.add(E.ring({ at: t.center, from: 6, to: t.size * 0.9, width: 3, color: '#ffffff', duration: 280 }));
    });
    await k.esperar(120);
    await k.despues();
  },

  // Cambiafuerza: un puño naranja del usuario y uno rojo del objetivo vuelan en arco, chocan en el centro con chispas
  // y siguen cada uno hasta el otro.
  async powerswap(k) {
    const ms = 720;
    intercambio(k, ms, (c, p, tam, deUsuario, t) => {
      const ang = deUsuario ? k.angle : k.angle + Math.PI;
      forma(c, 'puno', p.x, p.y, tam, ang + Math.sin(t * TAU) * 0.3, deUsuario
        ? { base: '#ffb02e', claro: '#ffe0a0', oscuro: '#a85a00', borde: '#4a2400', brillo: '#ffb02e', brilloTam: 8 }
        : { base: '#ff5a4a', claro: '#ffc0b0', oscuro: '#a8200a', borde: '#4a0a04', brillo: '#ff5a4a', brilloTam: 8 }, Math.cos(ang) < 0);
    });
    const centro = k.punto(0.5);
    await k.esperar(ms * 0.5);
    E.sparks(k.fx, { x: centro.x, y: centro.y - k.s(0.25) }, { count: 14, speed: [140, 300], palette: NEUTRAL_FX.up, shape: 'streak' });
    k.add(E.starburst({ at: { x: centro.x, y: centro.y - k.s(0.25) }, rays: 8, length: k.s(0.5), width: 3, palette: NEUTRAL_FX.up, duration: 220 }));
    await k.esperar(ms * 0.4);
    await k.estado();
  },

  // Psicorrayo (65): un rayo ondulante hecho de anillos de colores (rosa, violeta, azul, amarillo) que avanza en onda
  // hasta el objetivo y estalla en aros de colores.
  async psybeam(k) {
    await k.cargar(110);
    const dura = 480, cols = ['#ff4f8f', '#b07dff', '#5ab8ff', '#ffe45a', '#6ff2a0'];
    k.dibujar(dura, (c, t) => {
      const frente = Math.min(1, t / 0.4), cola = Math.max(0, (t - 0.6) / 0.4), n = 22;
      c.lineCap = 'round';
      c.globalAlpha = 0.8; c.strokeStyle = '#ffffff'; c.lineWidth = 1.6; c.beginPath();
      for (let i = 0; i <= 40; i++) {
        const f = i / 40; if (f > frente || f < cola) continue;
        const p = k.punto(lerp(0.12, 1, f), Math.sin(f * TAU * 2.2 - t * 20) * k.s(0.16) * Math.sin(Math.PI * Math.min(1, f * 1.3)));
        c.lineTo(p.x, p.y);
      }
      c.stroke();
      for (let i = 0; i < n; i++) {
        const f = i / n; if (f > frente || f < cola) continue;
        const p = k.punto(lerp(0.12, 1, f), Math.sin(f * TAU * 2.2 - t * 20) * k.s(0.16) * Math.sin(Math.PI * Math.min(1, f * 1.3)));
        const r = k.s(0.08 + 0.06 * f);
        c.globalAlpha = 0.95; c.lineWidth = 3; c.strokeStyle = cols[(i + Math.floor(t * 30)) % cols.length];
        c.beginPath(); c.ellipse(p.x, p.y, r * 0.5, r, k.angle, 0, TAU); c.stroke();
      }
    }, { z: 1 });
    void k.recuperar({ x: -k.dir.x * 6, y: -k.dir.y * 6 }, 260);
    await k.esperar(dura * 0.42);
    await k.impacto(t => {
      cols.slice(0, 3).forEach((col, i) => k.add(E.ring({ at: t.center, from: 6, to: t.size * (0.6 + i * 0.2), width: 3, color: col, duration: 300, delay: i * 50 })));
      k.burst(12, () => { const a = rand(0, TAU), v = rand(100, 240); return { x: t.center.x, y: t.center.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, drag: 3, life: 380, size: rand(2.5, 4), color: pick(cols), shape: 'star' }; });
    });
    await k.esperar(140);
    await k.despues();
  },

  // Psíquico (90): la vista se oscurece; el objetivo, envuelto en un aura rosa y aros que lo deforman, se eleva
  // retorciéndose y cae de golpe contra el suelo (el impacto).
  async psychic(k) {
    const tt = k.target, s = tt.size, sube = 460;
    await k.cargar(120);
    k.add(E.dim({ at: tt.center, duration: 900, strength: 0.45 }));
    if (k.acierta) void k.animar(tt.sprite, [
      { transform: 'translate(0px, 0px) rotate(0deg)' },
      { transform: `translate(0px, ${-s * 0.32}px) rotate(-10deg) scale(1.06, 0.94)`, offset: 0.4 },
      { transform: `translate(0px, ${-s * 0.45}px) rotate(12deg) scale(0.92, 1.08)`, offset: 0.72 },
      { transform: `translate(0px, ${-s * 0.5}px) rotate(-8deg) scale(1.1, 0.9)` },
    ], sube, 'ease-out');
    k.dibujar(sube + 260, (c, t, engine) => {
      const m = t * (sube + 260), p = k.posSprite(tt), a = Math.min(1, m / 100) * (m > sube ? 1 - (m - sube) / 260 : 1);
      if (k.acierta) { c.save(); c.globalAlpha = a * 0.35 * (1 - (tt.center.y - p.y) / (s * 1.2)); c.fillStyle = '#1a0820'; c.beginPath(); c.ellipse(tt.feet.x, tt.feet.y, s * 0.4, s * 0.12, 0, 0, TAU); c.fill(); c.restore(); }
      luz(c, engine, PSI.core, p, s * 0.85, 0.55 * a);
      for (let i = 0; i < 3; i++) {
        c.save(); c.globalAlpha = a * 0.85; c.strokeStyle = i === 1 ? '#ffffff' : PSI.glow; c.lineWidth = 2.5;
        c.beginPath(); c.ellipse(p.x, p.y, s * (0.55 + 0.12 * Math.sin(m * 0.02 + i * 2)), s * (0.3 + 0.1 * Math.cos(m * 0.025 + i)), m * 0.004 + i * 1.05, 0, TAU); c.stroke(); c.restore();
      }
      if (Math.random() < 0.5) k.emit({ x: p.x + rand(-s * 0.5, s * 0.5), y: p.y + rand(-s * 0.4, s * 0.4), vy: -rand(20, 60), life: 320, size: rand(2, 3.5), color: pick([PSI.glow, '#ffffff']), shape: 'star' });
    }, { z: 1 });
    await k.esperar(sube);
    await k.impacto(t => {
      k.add(E.ring({ at: t.feet, from: t.size * 0.2, to: t.size * 1.15, width: 4, color: PSI.glow, duration: 360, squash: 0.35 }));
      k.add(E.ring({ at: t.feet, from: t.size * 0.1, to: t.size * 0.8, width: 3, color: '#ffffff', duration: 300, squash: 0.35, delay: 60 }));
      k.add(E.bloom({ at: t.center, radius: t.size, color: PSI.core, duration: 320 }));
      E.dust(k.stage, t.feet, t.size);
      E.sparks(k.fx, t.center, { count: 16, speed: [140, 320], palette: PSI, shape: 'star', size: [2.5, 4.5] });
    });
    await k.esperar(140);
    await k.despues();
  },

  // Psicocorte (70): el usuario forma dos cuchillas de luz rosa en media luna y las lanza girando en arco; se cruzan
  // en X sobre el objetivo.
  async psychocut(k) {
    await k.anticipar(80);
    const ms = 260;
    for (const lado of [-1, 1]) k.dibujar(ms, (c, t, engine) => {
      const f = easeIn(t), p = k.punto(lerp(0.15, 1, f), lado * k.s(0.45) * Math.sin(Math.PI * f)), r = k.s(0.3);
      luz(c, engine, PSI.core, p, r * 1.3, 0.6);
      forma(c, 'luna', p.x, p.y, r, t * 18 * lado, { base: '#ffd0e2', borde: PSI.core, grosor: 2.5, brillo: PSI.core, brilloTam: 10 });
      if (Math.random() < 0.7) k.emit({ x: p.x, y: p.y, vx: rand(-30, 30), vy: rand(-30, 30), life: 240, size: rand(3, 5), sizeEnd: 0, color: pick([PSI.glow, '#ffffff']), shape: 'glow' });
    }, { z: 1 });
    void k.recuperar({ x: -k.dir.x * 8, y: -k.dir.y * 8 }, 240);
    await k.esperar(ms);
    await k.impacto(t => {
      for (const a of [k.angle + 0.8, k.angle - 0.8]) {
        const r = t.size * 0.55;
        k.add(E.slash({ at: { x: t.center.x - Math.cos(a) * r, y: t.center.y - Math.sin(a) * r }, radius: r, angle: a, sweep: 1.5, width: 6, palette: PSI, duration: 300 }));
      }
      E.sparks(k.fx, t.center, { count: 14, speed: [160, 340], palette: PSI, shape: 'streak' });
    });
    await k.despues();
  },

  // Psicocambio: una burbuja rosa con un nudo oscuro dentro (el problema de estado) sale del usuario, que queda
  // limpio, y revienta sobre el objetivo.
  async psychoshift(k) {
    const u = k.user, ms = 460;
    k.add(E.bloom({ at: u.center, radius: u.size * 0.7, color: PSI.glow, duration: 260 }));
    await k.esperar(120);
    await k.proyectil(ms, (p, t, c, engine) => {
      const r = k.s(0.26);
      luz(c, engine, PSI.glow, p, r * 1.5, 0.4);
      c.save(); c.globalAlpha = 0.9;
      c.fillStyle = 'rgba(255, 156, 194, 0.25)'; c.beginPath(); c.arc(p.x, p.y, r, 0, TAU); c.fill();
      forma(c, 'espiral', p.x, p.y, r * 0.65, t * 12, { base: '#3a2448', borde: '#3a2448', grosor: 3 });
      c.lineWidth = 2.5; c.strokeStyle = PSI.core; c.beginPath(); c.arc(p.x, p.y, r, 0, TAU); c.stroke();
      c.fillStyle = 'rgba(255, 255, 255, 0.8)'; c.beginPath(); c.ellipse(p.x - r * 0.4, p.y - r * 0.45, r * 0.2, r * 0.1, -0.6, 0, TAU); c.fill();
      c.restore();
    }, { arco: k.s(0.5), ease: easeInOut });
    if (k.hayObjetivo) {
      const tt = k.target;
      k.add(E.ring({ at: tt.center, from: k.s(0.2), to: k.s(0.8), width: 3, color: PSI.glow, duration: 280 }));
      k.burst(10, () => { const a = rand(0, TAU), v = rand(100, 220); return { x: tt.center.x, y: tt.center.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, drag: 3, life: 380, size: rand(3, 6), color: PSI.glow, accent: '#ffffff', shape: 'bubble' }; });
      humo(k, tt.center, 6, '#3a2448', tt.size * 0.15, 520, 40, 0.45);
    }
    await k.estado();
  },

  // Psicocarga (80): la energía psíquica se solidifica en cristales rosas afilados que giran en corro alrededor del
  // usuario y salen disparados uno tras otro contra el objetivo.
  async psyshock(k) {
    const u = k.user, s = u.size, n = 6, gira = 260, cada = 55, vuela = 200;
    const tc = k.target.center;
    const destinos = Array.from({ length: n }, () => ({ x: tc.x + rand(-1, 1) * k.s(0.2), y: tc.y + rand(-1, 1) * k.s(0.2) }));
    const total = gira + n * cada + vuela;
    k.dibujar(total, (c, t) => {
      const m = t * total, aparece0 = easeOutCubic(Math.min(1, m / 160));
      for (let i = 0; i < n; i++) {
        const sale = gira + i * cada, a0 = i / n * TAU;
        if (m < sale) {
          const q = k.alrededor(u.center, s * 0.68, a0 + m * 0.006, 0.6);
          c.globalAlpha = aparece0; cristal(c, q.x, q.y, s * 0.2 * aparece0, k.angle, '#ff9cc2', '#ffe4ef', '#7a1240');
        } else {
          const f = (m - sale) / vuela; if (f >= 1) continue;
          const q0 = k.alrededor(u.center, s * 0.68, a0 + sale * 0.006, 0.6), q1 = destinos[i];
          const p = { x: lerp(q0.x, q1.x, easeIn(f)), y: lerp(q0.y, q1.y, easeIn(f)) };
          c.globalAlpha = 1; cristal(c, p.x, p.y, s * 0.22, Math.atan2(q1.y - q0.y, q1.x - q0.x), '#ff9cc2', '#ffe4ef', '#7a1240');
          if (Math.random() < 0.6) k.emit({ x: p.x, y: p.y, life: 200, size: rand(2, 4), sizeEnd: 0, color: PSI.glow, shape: 'glow' });
        }
      }
    }, { z: 1 });
    await k.esperar(gira + vuela);
    await k.impacto(t => {
      for (let i = 0; i < n; i++) k.burst(5, () => { const a = rand(0, TAU), v = rand(100, 260); return { x: destinos[i].x, y: destinos[i].y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, drag: 3, life: 340, delay: i * cada, size: rand(2.5, 4.5), color: pick(['#ff9cc2', '#ffe4ef', PSI.core]), shape: 'shard', spin: rand(-12, 12) }; });
      k.add(E.ring({ at: t.center, from: 6, to: t.size * 0.8, width: 3, color: PSI.glow, duration: 280 }));
    });
    await k.esperar(n * cada);
    await k.despues();
  },

  // Reflejo: paneles de espejo azul plateado llegan volando desde fuera, encajan en corro alrededor del usuario con un
  // tintineo y un reflejo blanco los recorre (frena los ataques físicos).
  async reflect(k) {
    const u = k.user, s = u.size, n = 6, R = s * 0.8, H = s * 0.95, llegan = 320, ms = 860;
    const paneles = Array.from({ length: n }, (_, i) => ({ an: i / n * TAU + Math.PI / n, d: i * 30 }));
    const orden = [...paneles].sort((p, q) => Math.sin(p.an) - Math.sin(q.an));
    k.dibujar(ms, (c, t) => {
      const m = t * ms, a = Math.min(1, (ms - m) / 200);
      for (const p of orden) {
        const f = easeOutCubic(Math.min(1, Math.max(0, (m - p.d) / llegan))); if (f <= 0) continue;
        const d = R * (1 + (1 - f) * 2.2), x = u.center.x + Math.cos(p.an) * d, base = u.feet.y + Math.sin(p.an) * d * 0.4;
        const w = s * 0.42 * (0.3 + 0.7 * Math.abs(Math.sin(p.an)));
        c.save(); c.globalAlpha = a * f * (Math.sin(p.an) > 0 ? 0.6 : 0.4);
        const g = c.createLinearGradient(x - w / 2, base - H, x + w / 2, base);
        g.addColorStop(0, '#e8f6ff'); g.addColorStop(0.5, '#8ec8f0'); g.addColorStop(1, '#4a7ab0');
        c.fillStyle = g; c.fillRect(x - w / 2, base - H, w, H);
        c.lineWidth = 2; c.strokeStyle = '#ffffff'; c.strokeRect(x - w / 2, base - H, w, H);
        const b = (m - llegan - p.d) / 280;
        if (b > 0 && b < 1) {
          c.beginPath(); c.rect(x - w / 2, base - H, w, H); c.clip();
          const bx = x - w + b * w * 2.4;
          c.globalAlpha = a * 0.9; c.fillStyle = 'rgba(255, 255, 255, 0.9)';
          c.beginPath(); c.moveTo(bx, base - H); c.lineTo(bx + w * 0.3, base - H); c.lineTo(bx + w * 0.3 - H * 0.4, base); c.lineTo(bx - H * 0.4, base); c.closePath(); c.fill();
        }
        c.restore();
      }
    }, { z: 1 });
    for (const p of paneles) {
      const q = { x: u.center.x + Math.cos(p.an) * R, y: u.feet.y + Math.sin(p.an) * R * 0.4 - H * 0.5 };
      k.burst(3, () => ({ x: q.x + rand(-6, 6), y: q.y + rand(-H * 0.4, H * 0.4), life: 260, delay: p.d + llegan * 0.85, size: rand(2.5, 4), color: '#ffffff', shape: 'star' }));
    }
    await k.esperar(ms * 0.75);
    await k.estado();
  },

  // Descanso: una nube mullida hace de cama bajo el usuario, que se acurruca; suben Z grandes y una luz verde lo cura.
  async rest(k) {
    const u = k.user, s = u.size, ms = 900;
    k.dibujar(ms, (c, t) => {
      c.save(); c.globalAlpha = aparece(t, 0.15, 0.2) * 0.92; c.translate(u.feet.x, u.feet.y - s * 0.02); c.scale(1, 0.5);
      nube(c, 0, 0, s * 0.6 * rebote(Math.min(1, t * 3)), '#ffffff', '#8aa0c8', 2.5);
      c.restore();
    });
    void k.animar(u.sprite, [
      { transform: 'translate(0px, 0px) scale(1, 1)' },
      { transform: 'translate(0px, 2px) scale(1.1, 0.86) rotate(-6deg)', offset: 0.3 },
      { transform: 'translate(0px, 2px) scale(1.06, 0.89) rotate(-6deg)', offset: 0.85 },
      { transform: 'translate(0px, 0px) scale(1, 1)' },
    ], ms, 'ease-in-out');
    for (let i = 0; i < 3; i++) k.dibujar(560, (c, t) => {
      const x = u.top.x + s * 0.25 + t * s * 0.35 + Math.sin(t * 6) * s * 0.05, y = u.top.y - t * s * 0.6;
      c.globalAlpha = aparece(t, 0.2, 0.4);
      forma(c, 'z', x, y, s * (0.09 + i * 0.04) * (0.6 + 0.4 * t), -0.2, { base: '#9fd4ff', claro: '#ffffff', borde: '#1a3a6a' });
    }, { z: 1, delay: 150 + i * 170 });
    k.burst(10, i => ({ x: u.center.x + rand(-s * 0.4, s * 0.4), y: u.feet.y - rand(0, s * 0.3), vy: -rand(40, 80), life: 520, delay: 300 + i * 30, size: rand(4, 7), sizeEnd: 0, color: pick([NEUTRAL_FX.heal.core, NEUTRAL_FX.heal.glow]), shape: 'glow' }));
    await k.esperar(ms - 150);
    await k.estado();
  },

  // Imitación: una máscara de teatro dorada se desprende de la cara del objetivo, vuela y se posa sobre el usuario,
  // que copia su habilidad.
  async roleplay(k) {
    const tt = k.target, u = k.user, ms = 420;
    const cara = (g: SlotGeometry) => ({ x: g.center.x, y: g.top.y + g.size * 0.28 });
    k.dibujar(200, (c, t) => { const p = cara(tt); c.globalAlpha = t; mascara(c, p.x, p.y, tt.size * 0.3 * rebote(t), 0, '#fff0c0', '#5a3a00'); }, { z: 1 });
    await k.esperar(200);
    k.dibujar(ms, (c, t) => {
      const f = easeInOut(t), a = cara(tt), b = cara(u);
      const p = { x: lerp(a.x, b.x, f) + k.perp.x * Math.sin(Math.PI * f) * k.s(0.3), y: lerp(a.y, b.y, f) - Math.sin(Math.PI * f) * k.s(0.5) };
      mascara(c, p.x, p.y, lerp(tt.size, u.size, f) * 0.3, Math.sin(t * TAU) * 0.5, '#fff0c0', '#5a3a00');
      if (Math.random() < 0.6) k.emit({ x: p.x, y: p.y, vx: rand(-30, 30), vy: rand(-30, 30), life: 280, size: rand(2, 3.5), color: pick(['#ffe680', '#ffffff']), shape: 'star' });
    }, { z: 1 });
    await k.esperar(ms);
    k.dibujar(320, (c, t) => { const p = cara(u); c.globalAlpha = 1 - easeIn(t); mascara(c, p.x, p.y, u.size * 0.3 * (1 + t * 0.2), 0, '#fff0c0', '#5a3a00'); }, { z: 1 });
    k.add(E.bloom({ at: u.center, radius: u.size * 0.7, color: '#ffe680', duration: 280 }));
    k.destello(u.sprite);
    await k.estado();
  },

  // Poder Reserva (20): orbes de colores (la energía guardada) giran alrededor del usuario cerrando el círculo, se
  // funden en una esfera arcoíris y sale disparada.
  async storedpower(k) {
    const u = k.user, s = u.size, gira = 360, cols = ['#ff4f8f', '#5ab8ff', '#ffd24a', '#6ff2a0', '#b07dff'];
    k.dibujar(gira, (c, t, engine) => {
      const r = s * 0.65 * (1 - easeIn(t) * 0.85);
      for (let i = 0; i < 5; i++) { const q = k.alrededor(u.center, r, t * TAU * 1.5 + i / 5 * TAU, 0.6); luz(c, engine, cols[i], q, s * 0.17); luz(c, engine, '#ffffff', q, s * 0.05); }
    }, { z: 1 });
    await k.esperar(gira);
    k.add(E.bloom({ at: u.center, radius: s * 0.5, color: '#ffffff', duration: 200 }));
    await k.proyectil(220, (p, t, c, engine) => {
      luz(c, engine, cols[Math.floor(t * 20) % 5], p, s * 0.3);
      luz(c, engine, '#ffffff', p, s * 0.12);
      if (Math.random() < 0.8) k.emit({ x: p.x, y: p.y, vx: rand(-30, 30), vy: rand(-30, 30), life: 260, size: rand(2.5, 4.5), sizeEnd: 0, color: pick(cols), shape: 'glow' });
    }, { ease: (t: number) => lerp(0.15, 1, t) });
    await k.impacto(t => {
      cols.slice(0, 3).forEach((col, i) => k.add(E.ring({ at: t.center, from: 4, to: t.size * (0.5 + i * 0.15), width: 2.5, color: col, duration: 260, delay: i * 40 })));
      k.burst(10, () => { const a = rand(0, TAU), v = rand(100, 220); return { x: t.center.x, y: t.center.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, drag: 3, life: 340, size: rand(2.5, 4), color: pick(cols), shape: 'star' }; });
    });
    await k.despues();
  },

  // Teletransporte: una columna de luz rosa envuelve al usuario, que se estira como un hilo y desaparece en un
  // destello de estrellas; reaparece igual.
  async teleport(k) {
    const u = k.user, s = u.size, ms = 700;
    void k.animar(u.sprite, [{ transform: 'scale(1, 1)' }, { transform: 'scale(0.15, 1.6)', offset: 0.35 }, { transform: 'scale(0.15, 1.6)', offset: 0.6 }, { transform: 'scale(1.15, 0.9)', offset: 0.85 }, { transform: 'scale(1, 1)' }], ms, 'ease-in-out');
    void k.animar(u.sprite, [{ opacity: 1 }, { opacity: 1, offset: 0.3 }, { opacity: 0, offset: 0.38 }, { opacity: 0, offset: 0.6 }, { opacity: 1, offset: 0.7 }, { opacity: 1 }], ms, 'linear');
    k.dibujar(ms, (c, t, engine) => {
      const a = Math.sin(Math.PI * t), w = s * 0.35 * (1 - 0.6 * Math.sin(Math.PI * Math.min(1, t / 0.7)));
      const g = c.createLinearGradient(0, u.feet.y, 0, u.top.y - s * 1.2);
      g.addColorStop(0, 'rgba(255, 156, 194, 0.7)'); g.addColorStop(1, 'rgba(255, 228, 239, 0)');
      c.save(); c.globalCompositeOperation = engine.blend; c.globalAlpha = a; c.fillStyle = g;
      c.fillRect(u.center.x - w / 2, u.top.y - s * 1.2, w, u.feet.y - u.top.y + s * 1.2); c.restore();
      luz(c, engine, PSI.glow, u.center, s * 0.6, a * 0.6);
    }, { z: 1 });
    await k.esperar(ms * 0.36);
    k.add(E.starburst({ at: u.center, rays: 8, length: s * 0.85, width: 2.5, palette: PSI, duration: 260 }));
    k.burst(14, () => { const a = rand(0, TAU), v = rand(140, 280); return { x: u.center.x, y: u.center.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, drag: 4, life: 360, size: rand(2.5, 4), color: pick([PSI.glow, '#ffffff']), shape: 'star' }; });
    await k.esperar(ms * 0.3);
    k.add(E.bloom({ at: u.center, radius: s * 0.8, color: PSI.glow, duration: 260 }));
    await k.esperar(ms * 0.34);
    await k.estado();
  },

  // Zona Extraña: el campo se tiñe de verde y violeta y aparece una sala imposible: un cubo de líneas que gira y se
  // deforma alrededor de todos, con el suelo en cuadrícula.
  async wonderroom(k) {
    const u = k.user, ms = 900, c0 = k.hayObjetivo ? k.punto(0.5) : u.center, h = Math.max(k.dist * 0.75, u.size * 1.4);
    const V = [-1, 1].flatMap(x => [-1, 1].flatMap(y => [-1, 1].map(z => [x, y, z])));
    const A = [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]];
    k.dibujar(ms, (c, t) => {
      const a = aparece(t, 0.2, 0.25), th = t * 1.6 + 0.4, crece = easeOutCubic(Math.min(1, t / 0.3));
      c.save(); c.globalAlpha = 0.16 * a; c.fillStyle = mix('#6ff2a0', '#b07dff', 0.5 + 0.5 * Math.sin(t * 8));
      c.fillRect(k.stage.left, k.stage.top, k.stage.width, k.stage.height); c.restore();
      const P = V.map(([x, y, z], i) => {
        const w = (1 + Math.sin(t * 7 + i * 1.7) * 0.08) * crece;
        const xr = x * Math.cos(th) - z * Math.sin(th), zr = x * Math.sin(th) + z * Math.cos(th);
        return { x: c0.x + xr * h * w, y: c0.y - y * h * 0.5 * w + zr * h * 0.4 * w };
      });
      c.globalAlpha = a; c.lineCap = 'round';
      c.lineWidth = 1.2; c.strokeStyle = 'rgba(255, 255, 255, 0.6)';
      for (let g = 1; g < 4; g++) {
        const f = g / 4, l = (p: Vec, q: Vec) => ({ x: lerp(p.x, q.x, f), y: lerp(p.y, q.y, f) });
        for (const [p, q, r, s2] of [[P[0], P[4], P[1], P[5]], [P[0], P[1], P[4], P[5]]] as const) {
          const m1 = l(p, q), m2 = l(r, s2); c.beginPath(); c.moveTo(m1.x, m1.y); c.lineTo(m2.x, m2.y); c.stroke();
        }
      }
      A.forEach(([i, j], n) => { c.strokeStyle = n % 2 ? '#6ff2a0' : '#b07dff'; c.lineWidth = 3; c.beginPath(); c.moveTo(P[i].x, P[i].y); c.lineTo(P[j].x, P[j].y); c.stroke(); });
    }, { z: 1 });
    await k.esperar(ms - 150);
    await k.estado();
  },

  // Cabezazo Zen (80): el usuario se envuelve en un aura azul y rosa con un tercer ojo brillando en la frente, embiste
  // de cabeza con un salto y al chocar se abre un loto de luz.
  async zenheadbutt(k) {
    const u = k.user, s = u.size;
    await k.anticipar(90);
    k.dibujar(560, (c, t, engine) => {
      const p = k.posSprite(), fr = { x: p.x + k.dir.x * s * 0.2, y: p.y - s * 0.25 }, a = aparece(t, 0.15, 0.3);
      luz(c, engine, '#7ec8ff', p, s * 0.8, 0.55 * a);
      luz(c, engine, PSI.core, p, s * 0.5, 0.45 * a);
      luz(c, engine, '#ffffff', fr, s * 0.18, a);
      c.globalAlpha = a; cristal(c, fr.x, fr.y, s * 0.08, -Math.PI / 2, '#ff9cc2', '#ffffff', '#7a1240');
      if (Math.random() < 0.6) k.emit({ x: p.x + rand(-s * 0.3, s * 0.3), y: p.y + rand(-s * 0.3, s * 0.3), vx: -k.dir.x * 80, vy: -k.dir.y * 80, life: 300, size: rand(3, 5), sizeEnd: 0, color: pick(['#7ec8ff', PSI.glow]), shape: 'glow' });
    }, { z: 1 });
    await k.esperar(120);
    await k.embestida({ hasta: 0.85, ida: 200, vuelta: 260, arco: s * 0.3, estela: '#7ec8ff' });
    await k.impacto(t => {
      const at = t.center;
      k.dibujar(520, (c, v, engine) => {
        const ab = easeOutCubic(Math.min(1, v / 0.35));
        luz(c, engine, '#ffd0e2', at, t.size * 0.9 * ab, 0.6 * (1 - v));
        c.globalAlpha = (1 - easeIn(Math.max(0, (v - 0.4) / 0.6))) * 0.9;
        loto(c, at.x, at.y + t.size * 0.25, t.size * 0.75 * ab, ab, '#ffb0d0', '#e8f4ff', '#7a1240');
      }, { z: 1 });
      k.add(E.ring({ at: t.center, from: 6, to: t.size, width: 4, color: '#7ec8ff', duration: 320 }));
      E.sparks(k.fx, t.center, { count: 14, speed: [140, 320], palette: PSI, shape: 'star', size: [2.5, 4] });
    });
    await k.despues();
  },

  // ---- Fantasma ----

  // Impresionar (30): un fantasmita salta de golpe delante del objetivo y sobre él estalla un "!" amarillo; el
  // objetivo pega un brinco del susto.
  async astonish(k) {
    const tt = k.target, s = tt.size, p = { x: tt.center.x - k.dir.x * s * 0.5, y: tt.center.y };
    k.dibujar(440, (c, t) => {
      const e = rebote(Math.min(1, t * 4));
      c.globalAlpha = aparece(t, 0.05, 0.3);
      forma(c, 'fantasma', p.x, p.y - e * s * 0.2, s * 0.42 * e, Math.sin(t * 30) * 0.08 * (1 - t), { base: '#efe6ff', claro: '#ffffff', borde: '#2a1450', brillo: FAN.glow, brilloTam: 10 });
    }, { z: 1 });
    k.dibujar(380, (c, t) => { c.globalAlpha = aparece(t, 0.05, 0.3); signo(c, '!', tt.top.x + s * 0.3, tt.top.y - s * 0.15, s * 0.5 * rebote(Math.min(1, t * 4)), '#ffe45a', '#3a2400', 0.15); }, { z: 1, delay: 110 });
    await k.esperar(130);
    await k.impacto(t => {
      k.add(E.ring({ at: p, from: 4, to: t.size * 0.6, width: 3, color: FAN.glow, duration: 240 }));
      E.sparks(k.fx, t.center, { count: 8, speed: [100, 220], palette: FAN, shape: 'star', size: [2, 3.5] });
    });
    if (k.acierta) void k.saltar(tt.sprite, s * 0.3, 260);
    await k.despues();
  },

  // Rayo Confuso: una lucecita amarilla y violeta va dando tumbos en bucles hasta el objetivo y le da vueltas
  // alrededor de la cabeza soltando espirales.
  async confuseray(k) {
    const tt = k.target, ms = 520;
    k.dibujar(ms, (c, t, engine) => {
      const p = k.punto(easeInOut(t)), r = k.s(0.28) * Math.sin(Math.PI * t), ang = t * TAU * 3;
      const q = { x: p.x + Math.cos(ang) * r, y: p.y + Math.sin(ang) * r * 0.7 - Math.sin(Math.PI * t) * k.s(0.25) };
      luz(c, engine, FAN.core, q, k.s(0.34), 0.6);
      luz(c, engine, '#ffe45a', q, k.s(0.22) * (1 + 0.2 * Math.sin(t * 40)));
      luz(c, engine, '#ffffff', q, k.s(0.08));
      if (Math.random() < 0.6) k.emit({ x: q.x, y: q.y, vx: rand(-20, 20), vy: rand(-20, 20), life: 300, size: rand(2, 4), sizeEnd: 0, color: pick(['#ffe45a', FAN.glow]), shape: 'glow' });
    }, { z: 1 });
    await k.esperar(ms);
    const cab = tt.top;
    k.dibujar(520, (c, t, engine) => {
      for (let i = 0; i < 3; i++) {
        const q = k.alrededor(cab, tt.size * 0.4, t * TAU * 2 + i * TAU / 3, 0.4);
        luz(c, engine, '#ffe45a', q, k.s(0.12), 1 - t);
        c.save(); c.globalAlpha = 1 - t; forma(c, 'espiral', q.x, q.y - k.s(0.12), k.s(0.13), t * 12 + i, { base: '#ffe45a', borde: '#ffd21a', grosor: 2 }); c.restore();
      }
    }, { z: 1 });
    void k.animar(tt.sprite, [{ transform: 'rotate(0deg)' }, { transform: 'rotate(-8deg)' }, { transform: 'rotate(8deg)' }, { transform: 'rotate(-5deg)' }, { transform: 'rotate(0deg)' }], 460, 'ease-in-out');
    await k.esperar(220);
    await k.estado();
  },

  // Maldición: si es de tipo Fantasma, un clavo enorme cae del cielo y se clava en la sombra del objetivo entre llamas
  // moradas (y el usuario se resiente); si no, una sombra pesada lo envuelve y se vuelve lento y duro.
  async curse(k) {
    const u = k.user;
    if (k.hayObjetivo) {
      const tt = k.target, s = tt.size, suelo = { x: tt.feet.x, y: tt.feet.y - s * 0.04 }, ms = 780, cae = 260;
      void k.animar(u.sprite, [{ transform: 'scale(1, 1)' }, { transform: 'scale(0.9, 0.85)', offset: 0.4 }, { transform: 'scale(1, 1)' }], 360);
      k.sombra(u.sprite, { x: 0, y: 0 }, FAN.core, 0, 360);
      k.dibujar(ms, (c, t) => {
        const m = t * ms, a = Math.min(1, m / 120) * Math.min(1, (ms - m) / 200);
        c.save(); c.globalAlpha = 0.55 * a; c.fillStyle = '#1a0830'; c.beginPath(); c.ellipse(suelo.x, suelo.y, s * 0.55, s * 0.2, 0, 0, TAU); c.fill(); c.restore();
        const f = Math.min(1, m / cae), y = lerp(Math.min(k.stage.top, suelo.y - s * 2), suelo.y + s * 0.12, easeIn(f));
        c.globalAlpha = a; clavo(c, suelo.x, y, s * 1.05, Math.PI / 2 - 0.12);
      }, { z: 1 });
      await k.esperar(cae);
      k.add(E.ring({ at: suelo, from: s * 0.1, to: s * 0.85, width: 3, color: FAN.glow, duration: 320, squash: 0.35 }));
      k.add(E.cracks({ at: suelo, length: s * 0.5, color: '#1a0830', duration: 500 }));
      k.dibujar(420, () => { if (Math.random() < 0.7) fatuo(k, k.alrededor(suelo, s * rand(0.15, 0.55), rand(0, TAU), 0.35), s * 0.12, 480); });
      void k.agitar(tt.sprite, 3, 300);
      await k.esperar(380);
      await k.estado();
    } else {
      const s = u.size, ms = 640;
      k.dibujar(ms, (c, t, engine) => {
        const a = Math.sin(Math.PI * t);
        c.save(); c.globalAlpha = 0.5 * a; c.fillStyle = '#1a0830'; c.beginPath(); c.ellipse(u.feet.x, u.feet.y, s * 0.6, s * 0.2, 0, 0, TAU); c.fill(); c.restore();
        luz(c, engine, '#3a2448', k.posSprite(), s * 0.8, 0.5 * a);
        if (Math.random() < 0.5) k.emit({ x: u.center.x + rand(-s * 0.4, s * 0.4), y: u.top.y - s * 0.2, vy: rand(80, 140), life: 300, size: rand(1.5, 2.5), color: '#5a4468', shape: 'streak', stretch: 30 });
      });
      void k.animar(u.sprite, [{ transform: 'translate(0px, 0px) scale(1, 1)' }, { transform: `translate(0px, ${s * 0.04}px) scale(1.12, 0.86)`, offset: 0.5 }, { transform: 'translate(0px, 0px) scale(1, 1)' }], ms, 'ease-in-out');
      k.sombra(u.sprite, { x: 0, y: s * 0.05 }, '#1a0830', 100, 420);
      await k.esperar(ms - 80);
      await k.estado();
    }
  },

  // Mismo Destino: una cadena fantasma brota del suelo y se enrosca en espiral alrededor del usuario hasta la cabeza;
  // en su sombra se encienden dos ojos rojos.
  async destinybond(k) {
    const u = k.user, s = u.size, c0 = u.center, ms = 820;
    k.dibujar(ms, (c, t, engine) => {
      const crece = easeOutCubic(Math.min(1, t / 0.55)), a = Math.min(1, (1 - t) / 0.25), aprieta = easeInOut(Math.max(0, (t - 0.55) / 0.3));
      const n = Math.floor(26 * crece), pts: Vec[] = [], frente: boolean[] = [];
      for (let i = 0; i <= n; i++) {
        const f = i / 26, an = f * TAU * 2.2 + t * 2, r = s * 0.58 * (1 - 0.18 * aprieta);
        pts.push({ x: c0.x + Math.cos(an) * r, y: u.feet.y - f * s * 0.95 + Math.sin(an) * r * 0.35 });
        frente.push(Math.sin(an) > 0);
      }
      c.save(); c.globalAlpha = 0.45 * a; c.fillStyle = '#140a24'; c.beginPath(); c.ellipse(u.feet.x, u.feet.y, s * 0.6, s * 0.2, 0, 0, TAU); c.fill(); c.restore();
      if (t > 0.4) for (const l of [-1, 1]) luz(c, engine, '#ff2a40', { x: u.feet.x + l * s * 0.14, y: u.feet.y }, s * 0.08, a * Math.min(1, (t - 0.4) * 5));
      c.globalAlpha = a * 0.9;
      if (pts.length > 1) cadena(c, pts, s * 0.075, '#c4a6ff', '#2a1450', i => (frente[i] ? 1 : 0.35));
      if (Math.random() < 0.5 && pts.length) fatuo(k, pts[pts.length - 1], s * 0.1, 360);
    }, { z: 1 });
    void k.animar(u.sprite, [{ transform: 'scale(1, 1)' }, { transform: 'scale(1, 1)', offset: 0.55 }, { transform: 'scale(0.92, 1.05)', offset: 0.75 }, { transform: 'scale(1, 1)' }], ms);
    await k.esperar(ms - 200);
    k.add(E.bloom({ at: c0, radius: s * 0.8, color: FAN.core, duration: 280 }));
    await k.estado();
  },

  // Infortunio (65): se dibuja un sello maldito morado en el suelo bajo el objetivo; de él brotan llamas fantasma que
  // lo engullen.
  async hex(k) {
    await k.cargar(100);
    const tt = k.target, s = tt.size, suelo = tt.feet, ms = 640;
    k.dibujar(ms, (c, t, engine) => {
      const dib = easeOutCubic(Math.min(1, t / 0.4)), a = Math.min(1, (1 - t) / 0.25);
      luz(c, engine, FAN.core, suelo, s * 0.85 * dib, 0.45 * a);
      c.globalAlpha = a;
      sigilo(c, suelo.x, suelo.y, s * 0.62, t * 2, FAN.glow, dib);
      if (t > 0.25 && Math.random() < 0.8) fatuo(k, k.alrededor(suelo, s * rand(0.1, 0.55), rand(0, TAU), 0.5), s * 0.13, 560);
    });
    await k.esperar(380);
    await k.impacto(t => {
      for (let i = 0; i < 16; i++) fatuo(k, k.enCuerpo(t, 0.35), t.size * 0.15, 560);
      k.add(E.bloom({ at: t.center, radius: t.size * 0.9, color: FAN.core, duration: 320 }));
      k.add(E.ring({ at: t.feet, from: t.size * 0.2, to: t.size * 0.9, width: 3, color: FAN.glow, duration: 320, squash: 0.45 }));
    });
    await k.esperar(120);
    await k.despues();
  },

  // Lengüetazo (30): una lengua enorme, rosa y babosa sale del usuario y lame al objetivo de abajo arriba; quedan babas
  // moradas goteando.
  async lick(k) {
    const sale = 170, lame = 150, vuelve = 140, total = sale + lame + vuelve, s = k.target.size, w = k.s(0.2);
    const boca = k.punto(0, 0);
    const desde = { x: boca.x + k.dir.x * k.user.size * 0.3, y: boca.y + k.dir.y * k.user.size * 0.3 };
    k.dibujar(total, (c, t) => {
      const m = t * total, L = m < sale ? easeOut(m / sale) : m < sale + lame ? 1 : 1 - easeIn((m - sale - lame) / vuelve);
      const lam = m < sale ? 0 : Math.min(1, (m - sale) / lame);
      const tc = k.target.center, fin = { x: tc.x + k.perp.x * lerp(0.4, -0.45, lam) * s - k.dir.x * s * 0.15, y: tc.y + lerp(0.25, -0.35, lam) * s - k.dir.y * s * 0.15 };
      const tip = { x: lerp(desde.x, fin.x, L), y: lerp(desde.y, fin.y, L) };
      const ctl = { x: (desde.x + tip.x) / 2 + k.perp.x * s * 0.25 * Math.sin(m * 0.02), y: (desde.y + tip.y) / 2 + k.perp.y * s * 0.25 * Math.sin(m * 0.02) + s * 0.15 };
      c.lineCap = 'round'; c.lineJoin = 'round';
      for (const [lw, col] of [[w + 4, '#5a0e38'], [w, '#ff7ab8']] as const) {
        c.lineWidth = lw; c.strokeStyle = col; c.beginPath(); c.moveTo(desde.x, desde.y); c.quadraticCurveTo(ctl.x, ctl.y, tip.x, tip.y); c.stroke();
      }
      const g = { x: lerp(ctl.x, tip.x, 0.1), y: lerp(ctl.y, tip.y, 0.1) }, gEnd = { x: lerp(ctl.x, tip.x, 0.85), y: lerp(ctl.y, tip.y, 0.85) };
      c.lineWidth = Math.max(1.5, w * 0.12); c.strokeStyle = '#d0408a'; c.beginPath(); c.moveTo(lerp(desde.x, ctl.x, 0.5), lerp(desde.y, ctl.y, 0.5)); c.quadraticCurveTo(g.x, g.y, gEnd.x, gEnd.y); c.stroke();
      c.lineWidth = Math.max(1.5, w * 0.15); c.strokeStyle = 'rgba(255, 255, 255, 0.7)'; c.beginPath(); c.moveTo(lerp(desde.x, ctl.x, 0.6), lerp(desde.y, ctl.y, 0.6) - w * 0.25); c.lineTo(lerp(ctl.x, tip.x, 0.4), lerp(ctl.y, tip.y, 0.4) - w * 0.25); c.stroke();
      if (L > 0.5 && Math.random() < 0.5) k.emit({ x: tip.x, y: tip.y, vx: rand(-20, 20), vy: rand(0, 40), ay: 600, life: 420, size: rand(2.5, 4), color: pick(['#c48cff', '#e0b0ff']), shape: 'drop', stretch: 18 });
    }, { z: 1 });
    await k.esperar(sale + lame * 0.4);
    await k.impacto(t => {
      k.burst(12, () => ({ x: t.center.x + rand(-t.size * 0.3, t.size * 0.3), y: t.center.y + rand(-t.size * 0.3, t.size * 0.1), vx: rand(-40, 40), vy: rand(-60, 0), ay: 700, life: rand(450, 650), size: rand(3, 5), color: pick(['#c48cff', '#e0b0ff', '#a060e0']), shape: 'drop', stretch: 20 }));
      k.burst(5, () => ({ x: t.center.x + rand(-t.size * 0.3, t.size * 0.3), y: t.center.y + rand(-t.size * 0.2, t.size * 0.2), vy: -rand(10, 30), life: 520, size: rand(3, 6), color: '#e0b0ff', accent: '#ffffff', shape: 'bubble' }));
    });
    await k.despues();
  },

  // Tinieblas: la vista se oscurece y un espectro enorme y translúcido se alza tras el objetivo con ojos rojos; se le
  // echa encima y lo cubre de oscuridad.
  async nightshade(k) {
    const tt = k.target, s = tt.size, ms = 480;
    k.add(E.dim({ at: tt.center, duration: 860, strength: 0.55 }));
    const base = { x: tt.center.x + k.dir.x * s * 0.35, y: tt.center.y - s * 0.2 };
    k.dibujar(ms + 220, (c, t, engine) => {
      const m = t * (ms + 220), sube = easeOutCubic(Math.min(1, m / 300)), cae = m > ms - 60 ? easeIn(Math.min(1, (m - ms + 60) / 220)) : 0;
      const tam = s * (0.6 + 0.6 * sube) * (1 - cae * 0.25), y = base.y - s * 0.7 * sube + cae * s * 0.6;
      c.globalAlpha = 0.78 * (1 - cae);
      forma(c, 'fantasma', base.x, y, tam, Math.sin(m * 0.01) * 0.06, { base: '#1a0c28', claro: '#2a1450', borde: '#000000', brillo: '#6a2a9a', brilloTam: 18 });
      for (const ex of [-0.25, 0.22]) luz(c, engine, '#ff2a40', { x: base.x + ex * tam, y: y - 0.2 * tam }, tam * 0.17 * (0.8 + 0.2 * Math.sin(m * 0.05)), 0.95 * (1 - cae));
    }, { z: 1 });
    await k.esperar(ms);
    await k.impacto(t => {
      humo(k, t.center, 12, '#140a20', t.size * 0.3, 700, 40, 0.55);
      k.add(E.ring({ at: t.center, from: t.size * 0.9, to: t.size * 0.2, width: 4, color: '#2a1450', duration: 260 }));
      k.add(E.bloom({ at: t.center, radius: t.size * 0.8, color: '#6a2a9a', duration: 320 }));
    });
    await k.esperar(120);
    await k.despues();
  },

  // Golpe Fantasma (90, épica): el usuario se deshace en niebla morada, la niebla cruza el campo, reaparece detrás del
  // objetivo y lo golpea por la espalda; luego vuelve a su sitio como un fantasma.
  async phantomforce(k) {
    const u = k.user, s = u.size, tt = k.target, T = 1100;
    k.add(E.dim({ at: tt.center, duration: T, strength: 0.4 }));
    const B = { x: k.dir.x * (k.dist + tt.size * 0.7), y: k.dir.y * (k.dist + tt.size * 0.7) };
    const H = { x: k.dir.x * (k.dist + tt.size * 0.25), y: k.dir.y * (k.dist + tt.size * 0.25) };
    void k.animar(u.sprite, [
      { transform: 'translate(0px, 0px) scale(1, 1)' },
      { transform: 'translate(0px, 0px) scale(0.7, 1.2)', offset: 0.22 },
      { transform: `translate(${B.x}px, ${B.y}px) scale(0.7, 1.2)`, offset: 0.5 },
      { transform: `translate(${B.x}px, ${B.y}px) scale(1, 1)`, offset: 0.56 },
      { transform: `translate(${H.x}px, ${H.y}px) scale(1.12, 0.9)`, offset: 0.62 },
      { transform: `translate(${H.x * 0.95}px, ${H.y * 0.95}px) scale(1, 1)`, offset: 0.75 },
      { transform: 'translate(0px, 0px) scale(1, 1)' },
    ], T, 'linear');
    void k.animar(u.sprite, [{ opacity: 1 }, { opacity: 0, offset: 0.22 }, { opacity: 0, offset: 0.5 }, { opacity: 1, offset: 0.57 }, { opacity: 1, offset: 0.78 }, { opacity: 0.3, offset: 0.86 }, { opacity: 1 }], T, 'linear');
    humo(k, u.center, 10, FAN.dark, s * 0.25, 500, 40, 0.5);
    const detras = { x: u.center.x + B.x, y: u.center.y + B.y };
    k.dibujar(T * 0.3, (c, t, engine) => {
      const f = easeInOut(t), p = { x: lerp(u.center.x, detras.x, f) + k.perp.x * Math.sin(Math.PI * f) * k.s(0.6), y: lerp(u.center.y, detras.y, f) + k.perp.y * Math.sin(Math.PI * f) * k.s(0.6) };
      luz(c, engine, FAN.core, p, s * 0.45, 0.7);
      for (let i = 0; i < 2; i++) k.emit({ x: p.x + rand(-s * 0.2, s * 0.2), y: p.y + rand(-s * 0.2, s * 0.2), vx: rand(-30, 30), vy: -rand(10, 40), life: 420, size: s * 0.15, sizeEnd: s * 0.3, color: pick(['#3a2060', '#5a3a8a']), alpha: 0.5, shape: 'smoke' });
    }, { delay: T * 0.22 });
    await k.esperar(T * 0.5);
    k.add(E.bloom({ at: detras, radius: s * 0.8, color: FAN.glow, duration: 260 }));
    k.add(E.ring({ at: detras, from: s * 0.8, to: s * 0.2, width: 3, color: FAN.glow, duration: 200 }));
    await k.esperar(T * 0.12);
    await k.impacto(t => {
      const a = k.angle + Math.PI, r = t.size * 0.55;
      k.add(E.slash({ at: { x: t.center.x - Math.cos(a + 1.2) * r, y: t.center.y - Math.sin(a + 1.2) * r }, radius: r, angle: a + 1.2, sweep: 1.6, width: 7, palette: FAN, duration: 320 }));
      for (let i = 0; i < 12; i++) fatuo(k, k.enCuerpo(t, 0.35), t.size * 0.14, 500);
      E.sparks(k.fx, t.center, { count: 18, speed: [180, 380], palette: FAN, shape: 'streak' });
    });
    await k.esperar(T * 0.3);
    await k.despues();
  },

  // Bola Sombra (80): una esfera negra con remolino morado y una cara fantasma que asoma crece ante el usuario, sale
  // disparada dejando jirones de sombra y estalla en espectros.
  async shadowball(k) {
    const r = k.user.size * 0.3, crece = 220, viaje = 260, p0 = k.punto(0.2);
    k.dibujar(crece, (c, t, engine) => {
      bolaSombra(c, engine, p0, r * easeOutCubic(t), t);
      if (Math.random() < 0.7) { const a = rand(0, TAU), d = r * 2.5; k.emit({ x: p0.x + Math.cos(a) * d, y: p0.y + Math.sin(a) * d, vx: -Math.cos(a) * d * 4, vy: -Math.sin(a) * d * 4, life: 250, size: rand(1.5, 2.5), color: FAN.glow, shape: 'streak', stretch: 30 }); }
    }, { z: 1 });
    await k.esperar(crece);
    void k.recuperar({ x: -k.dir.x * 8, y: -k.dir.y * 8 }, 220);
    await k.proyectil(viaje, (p, t, c, engine) => {
      bolaSombra(c, engine, p, r, 1 + t);
      if (Math.random() < 0.8) k.emit({ x: p.x + rand(-r, r) * 0.5, y: p.y + rand(-r, r) * 0.5, vx: -k.dir.x * 60 + rand(-20, 20), vy: -k.dir.y * 60 - rand(10, 40), life: 420, size: r * 0.5, sizeEnd: r * 0.9, color: pick(['#1e0f36', '#3a2060']), alpha: 0.45, shape: 'smoke' });
    }, { ease: (t: number) => lerp(0.2, 1, t) });
    await k.impacto(t => {
      const dirs = Array.from({ length: 5 }, (_, i) => i / 5 * TAU + rand(-0.3, 0.3));
      k.dibujar(520, (c, v) => {
        for (const a of dirs) {
          const d = t.size * 0.9 * easeOutCubic(v), q = { x: t.center.x + Math.cos(a) * d, y: t.center.y + Math.sin(a) * d * 0.7 - v * t.size * 0.3 };
          c.save(); c.globalAlpha = (1 - easeIn(v)) * 0.85; forma(c, 'fantasma', q.x, q.y, t.size * 0.16, Math.cos(a) * 0.3, { base: '#c4a6ff', borde: '#2a1450', grosor: 1.5 }); c.restore();
        }
      }, { z: 1 });
      humo(k, t.center, 10, '#1e0f36', t.size * 0.25, 600, 40, 0.5);
      k.add(E.ring({ at: t.center, from: 6, to: t.size * 0.9, width: 4, color: FAN.glow, duration: 300 }));
      k.add(E.bloom({ at: t.center, radius: t.size * 0.9, color: FAN.core, duration: 300 }));
    });
    await k.despues();
  },

  // Garra Umbría (70): una zarpa de sombra gigante cruza al objetivo de lado a lado y lo desgarra; quedan tres marcas
  // moradas que humean.
  async shadowclaw(k) {
    await k.anticipar(80);
    void k.embestida({ hasta: 0.35, ida: 120, vuelta: 240 });
    const tt = k.target, s = tt.size, ms = 200;
    const desde = { x: tt.center.x - k.perp.x * s * 0.85, y: tt.center.y - k.perp.y * s * 0.85 - s * 0.45 };
    const hasta = { x: tt.center.x + k.perp.x * s * 0.7, y: tt.center.y + k.perp.y * s * 0.7 + s * 0.35 };
    const ang = Math.atan2(hasta.y - desde.y, hasta.x - desde.x);
    const sombra = (c: CanvasRenderingContext2D) => { const g = c.createLinearGradient(-1, 0, 1, 0); g.addColorStop(0, '#1a0830'); g.addColorStop(0.6, '#4a2a8a'); g.addColorStop(1, '#a080f0'); return g; };
    k.dibujar(ms + 140, (c, t) => {
      const m = t * (ms + 140), f = easeIn(Math.min(1, m / ms)), p = { x: lerp(desde.x, hasta.x, f), y: lerp(desde.y, hasta.y, f) };
      c.globalAlpha = (m > ms ? 1 - (m - ms) / 140 : 1) * 0.9;
      zarpa(c, p.x, p.y, s * 0.75, ang, { base: sombra, borde: '#0a0418', brillo: FAN.core }, Math.cos(ang) < 0);
    }, { z: 1 });
    await k.esperar(ms * 0.7);
    await k.impacto(t => {
      k.dibujar(580, (c, v) => {
        c.globalAlpha = 1 - easeIn(Math.max(0, (v - 0.4) / 0.6));
        forma(c, 'garras', t.center.x, t.center.y, t.size * 0.55 * Math.min(1, v * 5), ang - Math.PI / 4, { base: FAN.core, claro: FAN.glow, borde: '#1a0830', brillo: FAN.glow, brilloTam: 12 });
        if (Math.random() < 0.4) k.emit({ x: t.center.x + rand(-t.size * 0.4, t.size * 0.4), y: t.center.y + rand(-t.size * 0.4, t.size * 0.4), vy: -rand(20, 50), life: 500, size: t.size * 0.08, sizeEnd: t.size * 0.18, color: '#3a2060', alpha: 0.4, shape: 'smoke' });
      }, { z: 1 });
      E.sparks(k.fx, t.center, { count: 16, speed: [160, 340], palette: FAN, shape: 'streak', spread: [ang - 0.6, ang + 0.6] });
    });
    await k.despues();
  },

  // Puño Sombra (60): se abre un charco de sombra a los pies del usuario y de él sale un puño fantasma translúcido,
  // con llamitas moradas por el borde, que avanza serpenteando (nunca falla) hasta el objetivo.
  async shadowpunch(k) {
    const u = k.user, s = u.size, charco = { x: u.feet.x + k.dir.x * s * 0.35, y: u.feet.y + k.dir.y * s * 0.35 };
    k.dibujar(600, (c, t) => {
      const a = aparece(t, 0.15, 0.35);
      c.save(); c.globalAlpha = 0.7 * a; c.fillStyle = '#1a0830'; c.beginPath(); c.ellipse(charco.x, charco.y, s * 0.45, s * 0.16, 0, 0, TAU); c.fill();
      c.globalAlpha = a; c.strokeStyle = FAN.core; c.lineWidth = 2; c.stroke(); c.restore();
      if (Math.random() < 0.4) fatuo(k, k.alrededor(charco, s * rand(0.1, 0.4), rand(0, TAU), 0.35), s * 0.08, 400);
    });
    await k.esperar(140);
    const ms = 300, borde = contorno('puno', 14), tc = k.target.center, r = k.s(0.34), esp = espejo(k);
    const pos = (f: number): Vec => {
      const ser = Math.sin(f * TAU * 1.2) * k.s(0.3) * (1 - f);
      return { x: lerp(charco.x, tc.x, f) + k.perp.x * ser, y: lerp(charco.y - s * 0.1, tc.y, f) + k.perp.y * ser - Math.sin(Math.PI * f) * k.s(0.15) };
    };
    const fantasmal = (c: CanvasRenderingContext2D) => { const g = c.createLinearGradient(-1, 0, 1, 0); g.addColorStop(0, '#4a2a8a'); g.addColorStop(0.6, '#8a5cf0'); g.addColorStop(1, '#d8c8ff'); return g; };
    k.dibujar(ms, (c, t) => {
      const p = pos(t), q = pos(Math.min(1, t + 0.03)), ang = Math.atan2(q.y - p.y, q.x - p.x), rr = r * (0.5 + 0.5 * Math.min(1, t * 3));
      c.globalAlpha = 0.75;
      forma(c, 'puno', p.x, p.y, rr, ang, { base: fantasmal, claro: '#d8c8ff', oscuro: '#3a1a6a', borde: '#1a0830', brillo: FAN.glow, brilloTam: rr * 0.7 }, esp);
      for (const b of borde) if (Math.random() < 0.3) fatuo(k, aEscena(b, p.x, p.y, rr, ang, esp), rr * 0.2, 300);
    }, { z: 1 });
    await k.esperar(ms);
    await k.impacto(t => {
      k.add(E.ring({ at: t.center, from: 6, to: t.size * 0.8, width: 4, color: FAN.glow, duration: 280 }));
      for (let i = 0; i < 10; i++) fatuo(k, k.enCuerpo(t, 0.3), t.size * 0.13, 460);
      E.sparks(k.fx, t.center, { count: 12, speed: [140, 300], palette: FAN, shape: 'star', size: [2, 4] });
    });
    await k.despues();
  },

  // Sombra Vil (40): la sombra del usuario se despega de sus pies, se desliza por el suelo hasta el objetivo y bajo él
  // se alza de golpe en púas de sombra.
  async shadowsneak(k) {
    const u = k.user, tt = k.target, ms = 280, desde = u.feet, hasta = tt.feet;
    const rumbo = Math.atan2(hasta.y - desde.y, hasta.x - desde.x);
    k.dibujar(ms, (c, t) => {
      const f = easeInOut(t);
      for (let i = 0; i < 3; i++) {
        const g = Math.max(0, f - i * 0.08), p = { x: lerp(desde.x, hasta.x, g), y: lerp(desde.y, hasta.y, g) };
        c.save(); c.translate(p.x, p.y); c.globalAlpha = 0.7 - i * 0.2; c.fillStyle = '#140a24';
        c.beginPath(); c.ellipse(0, 0, u.size * (0.45 + 0.25 * Math.sin(Math.PI * t)) * (1 - i * 0.25), u.size * 0.16 * (1 - i * 0.2), rumbo * 0.35, 0, TAU); c.fill(); c.restore();
      }
    });
    await k.esperar(ms);
    const pua = (c: CanvasRenderingContext2D, x: number, alto: number, ancho: number) => {
      c.beginPath(); c.moveTo(x - ancho, hasta.y); c.lineTo(x, hasta.y - alto); c.lineTo(x + ancho, hasta.y); c.closePath();
      c.fillStyle = '#1a0830'; c.fill(); c.lineWidth = 2; c.strokeStyle = FAN.core; c.lineJoin = 'round'; c.stroke();
    };
    k.dibujar(320, (c, t) => {
      const h = tt.size * 0.95 * easeOutCubic(Math.min(1, t / 0.3));
      c.save(); c.globalAlpha = 0.6 * (1 - t); c.fillStyle = '#140a24'; c.beginPath(); c.ellipse(hasta.x, hasta.y, tt.size * 0.5, tt.size * 0.17, 0, 0, TAU); c.fill(); c.restore();
      c.globalAlpha = 1 - easeIn(Math.max(0, (t - 0.4) / 0.6));
      pua(c, hasta.x - tt.size * 0.22, h * 0.55, tt.size * 0.08);
      pua(c, hasta.x + tt.size * 0.2, h * 0.65, tt.size * 0.09);
      pua(c, hasta.x, h, tt.size * 0.13);
    }, { z: 1 });
    await k.esperar(70);
    await k.impacto(t => {
      E.sparks(k.fx, t.center, { count: 12, speed: [140, 300], palette: FAN, shape: 'shard', spread: [-Math.PI * 0.85, -Math.PI * 0.15], size: [2.5, 4] });
      humo(k, t.feet, 6, '#140a24', t.size * 0.2, 500, 40, 0.45);
    });
    await k.despues();
  },

  // Rencor: un fantasmita con el ceño fruncido aparece junto al objetivo, le arranca unas lucecitas (sus PP) y las
  // apaga en humo.
  async spite(k) {
    const tt = k.target, s = tt.size, pg = { x: tt.center.x - k.dir.x * s * 0.5 + k.perp.x * s * 0.3, y: tt.top.y };
    k.dibujar(720, (c, t) => {
      const x = pg.x + Math.sin(t * 12) * 3, y = pg.y - t * s * 0.1, tam = s * 0.28, rot = Math.sin(t * 8) * 0.2;
      c.globalAlpha = aparece(t, 0.15, 0.2) * 0.92;
      forma(c, 'fantasma', x, y, tam, rot, { base: '#c4a6ff', borde: '#2a1450', brillo: FAN.core, brilloTam: 8 });
      c.save(); c.translate(x, y); c.rotate(rot); c.scale(tam, tam); c.lineWidth = 0.1; c.lineCap = 'round'; c.strokeStyle = '#2a1450';
      c.beginPath(); c.moveTo(-0.45, -0.48); c.lineTo(-0.12, -0.36); c.moveTo(0.42, -0.48); c.lineTo(0.09, -0.36); c.stroke(); c.restore();
    }, { z: 1 });
    k.burst(5, i => {
      const from = k.enCuerpo(tt, 0.25);
      return { x: from.x, y: from.y, vx: (pg.x - from.x) * 2.3, vy: (pg.y - from.y) * 2.3, life: 420, delay: 180 + i * 60, size: s * 0.07, sizeEnd: s * 0.02, color: '#9cf0ff', shape: 'glow', fadeIn: 0.2 };
    });
    void k.agitar(tt.sprite, 2, 300);
    await k.esperar(520);
    humo(k, pg, 6, '#4a3a58', s * 0.12, 500, 40);
    await k.esperar(100);
    await k.estado();
  },

  // ---- Siniestro ----

  // Buena Baza (60): una mano oscura se estampa contra el objetivo y, justo detrás, su eco morado repite el golpe
  // (el doble de daño si ya estaba herido).
  async assurance(k) {
    await k.anticipar(90);
    void k.embestida({ hasta: 0.5, ida: 130, vuelta: 240 });
    const r = k.s(0.42), llega = 200, esp = espejo(k);
    for (const [delay, col, a] of [[0, '#3a2a48', 1], [110, '#8a4ad0', 0.6]] as const) {
      k.dibujar(llega + 140, (c, t) => {
        const ms = t * (llega + 140), f = Math.min(1, ms / llega), p = k.punto(lerp(0.35, 0.9, easeIn(f))), golpe = ms > llega ? (ms - llega) / 140 : 0;
        c.globalAlpha = a * (1 - golpe);
        forma(c, 'mano', p.x, p.y, r * (1 + golpe * 0.3), k.angle, { base: col, claro: '#6a5080', borde: '#120818', brillo: SINIESTRO.glow, brilloTam: r * 0.4 }, esp);
      }, { z: 1, delay });
    }
    await k.esperar(llega);
    await k.impacto(t => {
      k.add(E.starburst({ at: t.center, rays: 8, length: t.size * 0.7, width: 3, palette: SINIESTRO, duration: 240 }));
      k.add(E.ring({ at: t.center, from: 4, to: t.size * 0.6, width: 4, color: SINIESTRO.glow, duration: 240 }));
      k.add(E.ring({ at: t.center, from: 4, to: t.size * 0.9, width: 3, color: '#b07dff', duration: 260, delay: 110 }));
      E.sparks(k.fx, t.center, { count: 12, speed: [140, 300], palette: SINIESTRO, shape: 'shard', size: [2.5, 4] });
    });
    await k.despues();
  },

  // Resarcimiento: esquirlas rojas (el daño recibido) vuelven volando al usuario y lo cargan de rojo; se lanza y lo
  // devuelve todo en un estallido carmesí de pinchos.
  async comeuppance(k) {
    const u = k.user, s = u.size;
    k.burst(16, i => { const a = rand(0, TAU), r = s * rand(0.9, 1.3); return { x: u.center.x + Math.cos(a) * r, y: u.center.y + Math.sin(a) * r * 0.7, vx: -Math.cos(a) * r * 4.2, vy: -Math.sin(a) * r * 0.7 * 4.2, life: 240, delay: i * 8, size: rand(3, 5), color: pick([ROJO.core, ROJO.glow, '#1a0408']), shape: 'shard', spin: rand(-10, 10) }; });
    k.dibujar(400, (c, t, engine) => luz(c, engine, ROJO.core, k.posSprite(), s * (0.5 + 0.3 * t), 0.6 * Math.sin(Math.PI * t)));
    void k.agitar(u.sprite, 2, 240);
    await k.esperar(260);
    await k.embestida({ hasta: 0.85, ida: 130, vuelta: 260, estela: ROJO.core });
    await k.impacto(t => {
      k.add(E.starburst({ at: t.center, rays: 12, length: t.size * 1.1, width: 5, palette: ROJO, duration: 320 }));
      k.add(E.bloom({ at: t.center, radius: t.size * 0.9, color: ROJO.core, duration: 300 }));
      k.add(E.ring({ at: t.center, from: 6, to: t.size, width: 5, color: '#1a0408', duration: 300 }));
      E.sparks(k.fx, t.center, { count: 20, speed: [200, 420], palette: ROJO, shape: 'shard', size: [3, 6] });
    });
    await k.despues();
  },

  // Triturar (80): unas mandíbulas mayores que las de Mordisco muerden dos veces; la segunda, más fuerte, agrieta al
  // objetivo.
  async crunch(k) {
    await k.anticipar(90);
    void k.embestida({ hasta: 0.5, ida: 140, vuelta: 260 });
    const tt = k.target, c0 = tt.center, tam = k.s(0.78), F = [130, 70, 110, 60, 200], total = F.reduce((a, b) => a + b, 0);
    k.dibujar(total, (c, t) => {
      const ms = t * total;
      let ap = 0, fuera = 0;
      if (ms < F[0]) ap = ms / F[0];
      else if (ms < F[0] + F[1]) ap = 1 - easeIn((ms - F[0]) / F[1]);
      else if (ms < F[0] + F[1] + F[2]) ap = 0.85 * easeOut((ms - F[0] - F[1]) / F[2]);
      else if (ms < total - F[4]) ap = 0.85 * (1 - easeIn((ms - F[0] - F[1] - F[2]) / F[3]));
      else fuera = (ms - (total - F[4])) / F[4];
      c.globalAlpha = Math.min(1, ms / 60) * (1 - fuera);
      const tiembla = ap < 0.05 ? rand(-2, 2) : 0;
      mandibula(c, c0.x + tiembla, c0.y - k.s(0.05), tam * (1 + fuera * 0.12), ap, { base: '#2a1636', claro: '#fffaf0', borde: '#0a0410', brillo: SINIESTRO.glow, brilloTam: 14 });
    }, { z: 1 });
    await k.esperar(F[0] + F[1]);
    E.sparks(k.fx, c0, { count: 8, speed: [120, 240], palette: { ...SINIESTRO, hot: '#ffffff', glow: '#e8e0ff' }, shape: 'shard', size: [2, 4] });
    k.add(E.ring({ at: c0, from: 4, to: k.s(0.5), width: 3, color: SINIESTRO.glow, duration: 200 }));
    if (k.acierta) k.destello(tt.sprite, 100);
    await k.esperar(F[2] + F[3]);
    await k.impacto(t => {
      grietas(k, t.center, t.size * 0.55, '#140a1c', '#b07dff', 520);
      E.sparks(k.fx, t.center, { count: 18, speed: [160, 340], palette: { ...SINIESTRO, core: '#ffffff', glow: '#e8e0ff' }, shape: 'shard', size: [3, 5] });
      k.add(E.ring({ at: t.center, from: 4, to: t.size * 0.9, width: 5, color: SINIESTRO.glow, duration: 280 }));
      humo(k, t.center, 6, SINIESTRO.dark, t.size * 0.18, 500, 50);
    });
    await k.despues();
  },

  // Pulso Umbrío (80): oleadas de anillos oscuros de borde morado y ondulado salen del usuario en todas direcciones y
  // barren hasta el objetivo.
  async darkpulse(k) {
    await k.cargar(120);
    const u = k.user.center, R = k.dist + k.s(0.7), dura = 420;
    for (let i = 0; i < 4; i++) {
      const fase = rand(0, TAU);
      k.dibujar(dura, (c, t) => {
        const r = k.user.size * 0.3 + R * easeOut(t);
        c.save(); c.globalAlpha = (1 - easeIn(t)) * 0.9; c.translate(u.x, u.y); c.scale(1, 0.75);
        c.beginPath();
        for (let j = 0; j <= 48; j++) { const an = j / 48 * TAU, rr = r * (1 + 0.05 * Math.sin(an * 12 + fase + t * 10)); if (j) c.lineTo(Math.cos(an) * rr, Math.sin(an) * rr); else c.moveTo(Math.cos(an) * rr, Math.sin(an) * rr); }
        c.closePath();
        c.lineWidth = 10 * (1 - t * 0.5); c.strokeStyle = '#1a0c24'; c.stroke();
        c.lineWidth = 3.5 * (1 - t * 0.5); c.strokeStyle = SINIESTRO.glow; c.stroke();
        c.restore();
      }, { z: 1, delay: i * 90 });
    }
    void k.recuperar({ x: -k.dir.x * 8, y: -k.dir.y * 8 }, 300);
    await k.esperar(240);
    await k.impacto(t => {
      k.add(E.bloom({ at: t.center, radius: t.size * 0.8, color: SINIESTRO.core, duration: 300 }));
      humo(k, t.center, 8, SINIESTRO.dark, t.size * 0.2, 600, 50, 0.45);
      E.sparks(k.fx, t.center, { count: 14, speed: [160, 340], palette: SINIESTRO, shape: 'shard' });
    });
    await k.esperar(160);
    await k.despues();
  },

  // Llanto Falso: el usuario llora a chorros, con dos fuentes de lágrimas de dibujo animado y lagrimones por la cara;
  // algunas salpican al objetivo, que se ablanda.
  async faketears(k) {
    const u = k.user, s = u.size, ojos = { x: u.top.x, y: u.top.y + s * 0.28 }, ms = 640;
    void k.animar(u.sprite, [
      { transform: 'translate(0px, 0px)' }, { transform: 'translate(0px, 2px) scale(1.03, 0.97)' }, { transform: 'translate(0px, 0px)' },
      { transform: 'translate(0px, 2px) scale(1.03, 0.97)' }, { transform: 'translate(0px, 0px)' }, { transform: 'translate(0px, 2px) scale(1.03, 0.97)' }, { transform: 'translate(0px, 0px)' },
    ], ms, 'linear');
    k.dibujar(ms, () => {
      for (const lado of [-1, 1]) if (Math.random() < 0.85) k.emit({ x: ojos.x + lado * s * 0.18, y: ojos.y, vx: lado * rand(80, 150), vy: -rand(120, 200), ay: 700, life: rand(380, 520), size: rand(2.5, 4), color: pick(['#7cc4ff', '#bfe6ff', '#4aa0ff']), shape: 'drop', stretch: 20 });
    });
    k.dibujar(ms, (c, t) => {
      for (const lado of [-1, 1]) {
        const f = (t * 3 + (lado > 0 ? 0.4 : 0)) % 1;
        c.save(); c.globalAlpha = 0.95 * Math.min(1, (1 - f) * 4);
        forma(c, 'gota', ojos.x + lado * s * 0.2, ojos.y + s * 0.05 + f * s * 0.35, s * 0.08, -Math.PI / 2, { base: '#8ccfff', borde: '#1a4a8a', grosor: 1.5 });
        c.restore();
      }
    }, { z: 1 });
    if (k.hayObjetivo) {
      const tt = k.target, T = 0.45, g = 700;
      k.burst(6, i => {
        const from = { x: ojos.x + (i % 2 ? 1 : -1) * s * 0.18, y: ojos.y }, to = k.enCuerpo(tt, 0.25);
        return { x: from.x, y: from.y, vx: (to.x - from.x) / T, vy: (to.y - from.y) / T - 0.5 * g * T, ay: g, life: T * 1000, delay: 120 + i * 50, size: rand(3, 4.5), color: pick(['#7cc4ff', '#bfe6ff']), shape: 'drop', stretch: 20 };
      });
    }
    await k.esperar(ms - 60);
    if (k.hayObjetivo) {
      const tt = k.target;
      k.burst(10, () => { const a = rand(-Math.PI, 0), v = rand(60, 160); return { x: tt.center.x, y: tt.center.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, ay: 600, life: 380, size: rand(2, 3.5), color: '#bfe6ff', shape: 'drop', stretch: 16 }; });
    }
    await k.estado();
  },

  // Lanzamiento: el usuario arroja con fuerza su objeto (una baya), que vuela girando en arco y rebota en el objetivo
  // con un ¡bonk! y estrellitas de mareo.
  async fling(k) {
    await k.anticipar(100);
    void k.animar(k.user.sprite, [{ transform: 'rotate(-12deg)' }, { transform: 'rotate(14deg) scale(1.05, 0.95)', offset: 0.4 }, { transform: 'rotate(0deg)' }], 260);
    const ms = 320, tam = k.s(0.14);
    await k.proyectil(ms, (p, t, c) => {
      baya(c, p.x, p.y, tam, t * 14);
      if (Math.random() < 0.5) k.emit({ x: p.x, y: p.y, vx: -k.dir.x * 120, vy: -k.dir.y * 120, life: 160, size: 1.6, color: '#ffffff', shape: 'streak', stretch: 30 });
    }, { arco: k.s(0.6) + k.dist * 0.15 });
    await k.impacto(t => {
      const p0 = { ...t.center };
      k.dibujar(440, (c, v) => {
        const x = p0.x - k.dir.x * t.size * 0.6 * v, y = p0.y - Math.sin(Math.PI * v) * t.size * 0.6 + v * t.size * 0.4;
        c.globalAlpha = 1 - easeIn(Math.max(0, (v - 0.5) / 0.5)); baya(c, x, y, tam, -v * 12);
      }, { z: 1 });
      k.dibujar(520, (c, v) => {
        for (let i = 0; i < 3; i++) { const q = k.alrededor(t.top, t.size * 0.3, v * TAU * 1.5 + i * TAU / 3, 0.4); c.save(); c.globalAlpha = 1 - easeIn(v); forma(c, 'estrella', q.x, q.y, t.size * 0.08, v * 6, { base: '#ffe45a', borde: '#6a4a00', grosor: 1.2 }); c.restore(); }
      }, { z: 1 });
      E.sparks(k.fx, t.center, { count: 10, speed: [120, 260], palette: NEUTRAL_FX.up, shape: 'star', size: [3, 5] });
    });
    await k.despues();
  },

  // Juego Sucio (95): la vista se oscurece; la sombra del propio objetivo se alza a su espalda con ojos rojos y lo
  // golpea con un puño hecho de su propia oscuridad.
  async foulplay(k) {
    const tt = k.target, s = tt.size;
    k.add(E.dim({ at: tt.center, duration: 860, strength: 0.5 }));
    void k.anticipar(80);
    const atras = { x: k.dir.x * s * 0.6, y: k.dir.y * s * 0.6 };
    for (let i = 0; i < 3; i++) k.sombra(tt.sprite, { x: atras.x * (1 - i * 0.3), y: atras.y * (1 - i * 0.3) }, '#1a0c24', i * 90, 320);
    k.dibujar(440, (c, t, engine) => {
      const p = { x: tt.center.x + atras.x * (1 - t * 0.6), y: tt.top.y + s * 0.25 + atras.y * (1 - t * 0.6) };
      for (const l of [-1, 1]) luz(c, engine, '#ff2a40', { x: p.x + l * s * 0.12, y: p.y }, s * 0.09, Math.sin(Math.PI * t));
    }, { z: 1 });
    await k.esperar(320);
    const ang = k.angle + Math.PI, ida = 140, se = 160;
    k.dibujar(ida + se, (c, t) => {
      const m = t * (ida + se), f = easeIn(Math.min(1, m / ida)), p = { x: tt.center.x + atras.x * (1.3 - f * 1.05), y: tt.center.y + atras.y * (1.3 - f * 1.05) };
      const golpe = m > ida ? (m - ida) / se : 0;
      c.globalAlpha = 1 - golpe;
      forma(c, 'puno', p.x, p.y, s * 0.42 * (1 + golpe * 0.3), ang, { base: '#2a1836', claro: '#4a3060', oscuro: '#120818', borde: '#000000', brillo: '#ff2a40', brilloTam: 12 }, Math.cos(ang) < 0);
    }, { z: 1 });
    await k.esperar(ida);
    await k.impacto(t => {
      k.add(E.starburst({ at: t.center, rays: 10, length: t.size * 1.0, width: 4.5, palette: ROJO, duration: 300 }));
      k.add(E.bloom({ at: t.center, radius: t.size, color: '#5a0a3a', duration: 320 }));
      k.add(E.ring({ at: t.center, from: 6, to: t.size, width: 5, color: '#1a0c24', duration: 300 }));
      grietas(k, t.center, t.size * 0.5, '#0a0410', '#ff5060', 480, 5);
      E.sparks(k.fx, t.center, { count: 18, speed: [180, 380], palette: SINIESTRO, shape: 'shard', size: [3, 5] });
    });
    await k.esperar(100);
    await k.despues();
  },

  // Afilagarras: dos zarpas oscuras aparecen a los lados del usuario y se raspan una contra otra soltando chispas
  // metálicas; acaban relucientes.
  async honeclaws(k) {
    const u = k.user, s = u.size, c0 = { x: u.center.x, y: u.center.y - s * 0.1 }, ms = 680;
    const metal = (c: CanvasRenderingContext2D) => { const g = c.createLinearGradient(-1, -0.5, 1, 0.5); g.addColorStop(0, '#2a1836'); g.addColorStop(0.6, '#6a5a80'); g.addColorStop(1, '#e8e0f8'); return g; };
    let ultimo = 0;
    k.dibujar(ms, (c, t) => {
      const roce = Math.sin(t * TAU * 3);
      c.globalAlpha = aparece(t, 0.12, 0.2);
      zarpa(c, c0.x - s * 0.32, c0.y + roce * s * 0.14, s * 0.4, 0.25, { base: metal, borde: '#120818', brillo: t > 0.75 ? '#ffffff' : undefined });
      zarpa(c, c0.x + s * 0.32, c0.y - roce * s * 0.14, s * 0.4, Math.PI - 0.25, { base: metal, borde: '#120818', brillo: t > 0.75 ? '#ffffff' : undefined }, true);
      const ahora = Math.floor(t * 6);
      if (ahora !== ultimo) { ultimo = ahora; E.sparks(k.fx, c0, { count: 8, speed: [120, 280], palette: { core: '#ffd27a', glow: '#fff0b0', hot: '#ffffff', dark: '#000000' }, shape: 'streak', size: [1.2, 2], life: [150, 260] }); }
    }, { z: 1 });
    await k.esperar(ms - 120);
    k.add(E.starburst({ at: c0, rays: 6, length: s * 0.6, width: 2, palette: NEUTRAL_FX.white, duration: 240 }));
    await k.estado();
  },

  // Desarme (65): un revés oscuro barre al objetivo de lado y le hace saltar el objeto que llevaba (una baya), que
  // sale girando lejos.
  async knockoff(k) {
    await k.anticipar(80);
    void k.embestida({ hasta: 0.55, ida: 140, vuelta: 260 });
    const tt = k.target, s = tt.size, ms = 220, ladoAng = Math.atan2(k.perp.y, k.perp.x);
    k.dibujar(ms + 120, (c, t) => {
      const m = t * (ms + 120), u = easeIn(Math.min(1, m / ms)), barre = lerp(-1.1, 1.1, u);
      const p = { x: tt.center.x - k.dir.x * s * 0.3 + k.perp.x * barre * s * 0.6, y: tt.center.y - k.dir.y * s * 0.3 + k.perp.y * barre * s * 0.6 };
      c.globalAlpha = m > ms ? 1 - (m - ms) / 120 : 1;
      forma(c, 'mano', p.x, p.y, s * 0.42, ladoAng + 0.3 * (1 - u), { base: '#2a1836', claro: '#4a3060', borde: '#000000', brillo: SINIESTRO.glow, brilloTam: 10 }, Math.cos(ladoAng) < 0);
    }, { z: 1 });
    await k.esperar(ms * 0.8);
    await k.impacto(t => {
      const v = { x: k.perp.x + k.dir.x * 0.4, y: k.perp.y + k.dir.y * 0.4 };
      k.dibujar(560, (c, f) => {
        const x = t.center.x + v.x * t.size * 1.6 * f, y = t.center.y + v.y * t.size * 1.6 * f - Math.sin(Math.PI * f) * t.size * 0.8;
        c.globalAlpha = 1 - easeIn(Math.max(0, (f - 0.6) / 0.4)); baya(c, x, y, t.size * 0.13, f * 18);
      }, { z: 1 });
      k.add(E.slash({ at: { x: t.center.x - k.dir.x * t.size * 0.5, y: t.center.y - k.dir.y * t.size * 0.5 }, radius: t.size * 0.5, angle: k.angle, sweep: 1.6, width: 6, palette: SINIESTRO, duration: 280 }));
      E.sparks(k.fx, t.center, { count: 12, speed: [140, 300], palette: SINIESTRO, shape: 'streak', spread: [ladoAng - 0.7, ladoAng + 0.7] });
    });
    await k.despues();
  },

  // Legado: el usuario se deshace en humo negro que toma forma de fantasma, vuela hasta el objetivo y lo envuelve en
  // un remolino oscuro (el usuario se debilita).
  async memento(k) {
    const u = k.user, s = u.size, ms = 420;
    void k.animar(u.sprite, [{ opacity: 1 }, { opacity: 0.15, offset: 0.35 }, { opacity: 0.15, offset: 0.8 }, { opacity: 1 }], 900);
    humo(k, u.center, 10, '#1a0c24', s * 0.25, 600, 60, 0.5);
    k.dibujar(ms, (c, t) => {
      const p = k.punto(easeInOut(t), Math.sin(Math.PI * t) * k.s(0.4));
      c.globalAlpha = 0.88;
      forma(c, 'fantasma', p.x, p.y - Math.sin(Math.PI * t) * k.s(0.3), s * 0.4, Math.sin(t * 10) * 0.15, { base: '#2a1836', claro: '#4a3060', borde: '#000000', brillo: SINIESTRO.glow, brilloTam: 10 });
      if (Math.random() < 0.7) k.emit({ x: p.x, y: p.y, vx: rand(-20, 20), vy: -rand(10, 30), life: 420, size: s * 0.12, sizeEnd: s * 0.25, color: '#1a0c24', alpha: 0.4, shape: 'smoke' });
    }, { z: 1, delay: 200 });
    await k.esperar(200 + ms);
    if (k.hayObjetivo) {
      E.whirl(k.stage, k.target, '#3a2448');
      humo(k, k.target.center, 10, '#140a20', k.target.size * 0.25, 600, 40, 0.5);
      k.add(E.ring({ at: k.target.center, from: k.target.size * 0.9, to: k.target.size * 0.2, width: 4, color: SINIESTRO.glow, duration: 300 }));
    }
    await k.esperar(220);
    await k.estado();
  },

  // Maquinación: sobre el usuario aparece una sonrisa malvada de oreja a oreja con ojos rasgados y, detrás, giran
  // engranajes oscuros (está tramando algo).
  async nastyplot(k) {
    const u = k.user, s = u.size, p = { x: u.top.x, y: u.top.y - s * 0.45 }, ms = 800;
    k.dibujar(ms, (c, t) => {
      const e = rebote(Math.min(1, t * 3));
      c.globalAlpha = aparece(t, 0.2, 0.25);
      engranaje(c, p.x - s * 0.36, p.y - s * 0.05, s * 0.28 * e, t * 4, '#4a3a58', '#120818');
      engranaje(c, p.x + s * 0.32, p.y - s * 0.2, s * 0.2 * e, -t * 5.5 + 0.2, '#5a4468', '#120818');
      engranaje(c, p.x + s * 0.06, p.y + s * 0.14, s * 0.16 * e, t * 7, '#3a2a48', '#120818');
      caraMaliciosa(c, p.x, p.y, s * 0.42 * e, '#ffd24a', '#120818');
    }, { z: 1 });
    void k.animar(u.sprite, [
      { transform: 'translate(0px, 0px)' }, { transform: 'translate(0px, -3px) scale(1.03, 0.97)' }, { transform: 'translate(0px, 0px)' },
      { transform: 'translate(0px, -3px) scale(1.03, 0.97)' }, { transform: 'translate(0px, 0px)' },
    ], ms * 0.6, 'ease-in-out');
    await k.esperar(ms - 120);
    await k.estado();
  },

  // Tajo Umbrío (70): el usuario cruza como una sombra a través del objetivo y deja un tajo negro en forma de luna
  // creciente con filo morado.
  async nightslash(k) {
    await k.anticipar(80);
    void k.embestida({ hasta: 1.25, ida: 140, vuelta: 300, estela: '#1a0c24' });
    await k.esperar(110);
    const tt = k.target, s = tt.size;
    k.dibujar(400, (c, t) => {
      const crece = easeOutCubic(Math.min(1, t / 0.3));
      c.globalAlpha = 1 - easeIn(Math.max(0, (t - 0.4) / 0.6));
      forma(c, 'luna', tt.center.x, tt.center.y, s * 0.7 * (0.7 + 0.3 * crece), k.angle, { base: '#120818', borde: '#b07dff', grosor: 3, brillo: '#8a4ad0', brilloTam: 14 });
    }, { z: 1 });
    await k.impacto(t => {
      E.sparks(k.fx, t.center, { count: 14, speed: [160, 340], palette: { ...SINIESTRO, hot: '#e0c8ff', glow: '#b07dff' }, shape: 'shard', size: [2.5, 4.5] });
      const glint = { x: t.center.x + k.perp.x * t.size * 0.5, y: t.center.y - t.size * 0.45 };
      k.dibujar(300, (c, v, engine) => { luz(c, engine, '#fff0b0', glint, t.size * 0.2, Math.sin(Math.PI * v)); c.globalAlpha = Math.sin(Math.PI * v); forma(c, 'luna', glint.x, glint.y, t.size * 0.12, -Math.PI * 0.75, { base: '#fff6c0', borde: '#8a6a00', grosor: 1.2 }); }, { z: 1 });
    });
    await k.despues();
  },

  // Vendetta (50): el usuario encaja primero un golpe (retrocede con un destello rojo) y responde con un arco oscuro
  // que vuelve como un bumerán contra el objetivo.
  async payback(k) {
    const u = k.user;
    void k.animar(u.sprite, [{ transform: 'translate(0px, 0px)' }, { transform: `translate(${-k.dir.x * 10}px, ${-k.dir.y * 10}px) rotate(-6deg)`, offset: 0.35 }, { transform: 'translate(0px, 0px)' }], 240);
    k.destello(u.sprite, 120);
    k.add(E.starburst({ at: u.center, rays: 5, length: u.size * 0.45, width: 2, palette: ROJO, duration: 200 }));
    await k.esperar(220);
    const ms = 230, lado = k.s(0.7);
    k.dibujar(ms + 160, (c, t) => {
      const m = t * (ms + 160), cab = Math.min(1, m / ms), cola = Math.max(0, cab - 0.45) + Math.max(0, (m - ms) / 160) * 0.55;
      if (cab <= cola) return;
      const pts: Vec[] = [];
      for (let i = 0; i <= 16; i++) { const f = lerp(cola, cab, i / 16); pts.push(k.punto(lerp(0.1, 0.95, f), -lado * Math.sin(Math.PI * f))); }
      c.lineCap = 'round'; c.lineJoin = 'round';
      for (const [w, col] of [[k.s(0.17), '#120818'], [k.s(0.08), SINIESTRO.glow]] as const) { c.lineWidth = w; c.strokeStyle = col; c.beginPath(); pts.forEach((p, i) => (i ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y))); c.stroke(); }
      const p = pts[16], q = pts[15], a = Math.atan2(p.y - q.y, p.x - q.x), h = k.s(0.2);
      c.beginPath(); c.moveTo(p.x + Math.cos(a) * h, p.y + Math.sin(a) * h); c.lineTo(p.x + Math.cos(a + 2.4) * h, p.y + Math.sin(a + 2.4) * h); c.lineTo(p.x + Math.cos(a - 2.4) * h, p.y + Math.sin(a - 2.4) * h); c.closePath();
      c.fillStyle = '#120818'; c.fill(); c.lineWidth = 2; c.strokeStyle = SINIESTRO.glow; c.stroke();
    }, { z: 1 });
    void k.embestida({ hasta: 0.35, ida: 120, vuelta: 240 });
    await k.esperar(ms);
    await k.impacto(t => {
      k.add(E.ring({ at: t.center, from: 4, to: t.size * 0.75, width: 4, color: SINIESTRO.glow, duration: 260 }));
      E.sparks(k.fx, t.center, { count: 12, speed: [140, 300], palette: SINIESTRO, shape: 'shard' });
    });
    await k.despues();
  },

  // Chulería (20): el usuario presume con una corona de flechas doradas de mejora que le gira sobre la cabeza y, de un
  // empujón chulesco, se las lanza al objetivo.
  async powertrip(k) {
    const u = k.user, s = u.size, gira = 340, cab = { x: u.top.x, y: u.top.y - s * 0.05 };
    k.dibujar(gira, (c, t) => {
      for (let i = 0; i < 5; i++) {
        const a = t * TAU * 1.2 + i / 5 * TAU, q = k.alrededor(cab, s * 0.42, a, 0.35);
        c.globalAlpha = (Math.sin(a) > 0 ? 1 : 0.5) * Math.min(1, t * 5);
        galon(c, q.x, q.y, s * 0.13, -Math.PI / 2, '#ffb02e', '#6a3a00');
      }
    }, { z: 1 });
    void k.animar(u.sprite, [{ transform: 'translate(0px, 0px) scale(1, 1)' }, { transform: `translate(0px, ${-s * 0.05}px) scale(1.08, 1.08)`, offset: 0.6 }, { transform: 'translate(0px, 0px) scale(1, 1)' }], gira);
    await k.esperar(gira);
    for (let i = 0; i < 5; i++) k.dibujar(230, (c, t) => {
      const p = k.punto(lerp(0.1, 1, easeIn(t)), (i - 2) * k.s(0.16) * (1 - t));
      galon(c, p.x, p.y - k.s(0.3) * (1 - t), s * 0.13, k.angle, '#ffb02e', '#6a3a00');
    }, { z: 1, delay: i * 25 });
    void k.embestida({ hasta: 0.3, ida: 110, vuelta: 200 });
    await k.esperar(240);
    await k.impacto(t => {
      E.sparks(k.fx, t.center, { count: 12, speed: [140, 280], palette: NEUTRAL_FX.up, shape: 'star', size: [2.5, 4] });
      k.burst(6, () => ({ x: t.center.x + rand(-t.size * 0.3, t.size * 0.3), y: t.center.y, vx: rand(-60, 60), vy: -rand(80, 160), life: 420, size: rand(5, 7), color: pick(['#ffb02e', '#ffd98a']), shape: 'chevron' }));
    });
    await k.despues();
  },

  // Último Lugar: una mano oscura enorme baja desde arriba y aplasta al objetivo contra el suelo (le obliga a esperar
  // su turno).
  async quash(k) {
    const tt = k.target, s = tt.size, baja = 280, ms = 640;
    k.dibujar(ms, (c, t) => {
      const m = t * ms, f = easeIn(Math.min(1, m / baja)), y = lerp(tt.top.y - s * 1.6, tt.top.y - s * 0.05, f);
      c.globalAlpha = Math.min(1, m / 80) * Math.min(1, (ms - m) / 180);
      forma(c, 'mano', tt.center.x, y, s * 0.6, Math.PI / 2, { base: '#3a2a48', claro: '#5a4468', borde: '#0a0410', brillo: SINIESTRO.glow, brilloTam: 12 });
    }, { z: 1 });
    await k.esperar(baja);
    void k.animar(tt.sprite, [{ transform: 'translate(0px, 0px) scale(1, 1)' }, { transform: 'translate(0px, 3px) scale(1.22, 0.74)', offset: 0.3 }, { transform: 'translate(0px, 2px) scale(1.15, 0.8)', offset: 0.75 }, { transform: 'translate(0px, 0px) scale(1, 1)' }], 380);
    k.add(E.ring({ at: tt.feet, from: s * 0.2, to: s * 0.9, width: 3, color: SINIESTRO.glow, duration: 300, squash: 0.3 }));
    E.dust(k.stage, tt.feet, s);
    await k.esperar(300);
    await k.estado();
  },

  // Alarido (55): el usuario ruge con rabia: ondas dentadas como sierras salen en abanico hacia el objetivo, al que le
  // saltan venas de enfado.
  async snarl(k) {
    const u = k.user.center;
    await k.anticipar(70);
    void k.animar(k.user.sprite, [{ transform: 'scale(1, 1)' }, { transform: 'scale(1.1, 1.06)', offset: 0.3 }, { transform: 'translate(-2px, 0px) scale(1.1, 1.06)', offset: 0.5 }, { transform: 'translate(2px, 0px) scale(1.08, 1.05)', offset: 0.7 }, { transform: 'scale(1, 1)' }], 400);
    for (let i = 0; i < 4; i++) k.dibujar(340, (c, t) => {
      const r = k.user.size * 0.3 + k.dist * easeOut(t), n = 14;
      c.globalAlpha = 1 - easeIn(t); c.lineWidth = 3.5; c.lineJoin = 'miter'; c.strokeStyle = i % 2 ? '#ff6a4a' : SINIESTRO.glow;
      c.beginPath();
      for (let j = 0; j <= n; j++) { const an = k.angle - 0.6 + 1.2 * j / n, rr = r + (j % 2 ? 1 : -1) * k.s(0.06); if (j) c.lineTo(u.x + Math.cos(an) * rr, u.y + Math.sin(an) * rr); else c.moveTo(u.x + Math.cos(an) * rr, u.y + Math.sin(an) * rr); }
      c.stroke();
    }, { z: 1, delay: i * 70 });
    await k.esperar(260);
    await k.impacto(t => {
      for (let i = 0; i < 2; i++) k.dibujar(420, (c, v) => { c.globalAlpha = 1 - easeIn(Math.max(0, (v - 0.6) / 0.4)); ira(c, t.top.x + (i ? t.size * 0.3 : -t.size * 0.22), t.top.y + (i ? 0 : t.size * 0.12), t.size * 0.15 * rebote(Math.min(1, v * 3.5))); }, { z: 1, delay: i * 90 });
      E.sparks(k.fx, t.center, { count: 12, speed: [140, 280], palette: ROJO, shape: 'streak' });
    });
    await k.despues();
  },

  // Golpe Bajo (70): sin aviso, el usuario se lanza agachado y un puño oscuro sube desde el suelo como un gancho y le
  // da al objetivo en la barbilla.
  async suckerpunch(k) {
    void k.embestida({ hasta: 0.6, ida: 110, vuelta: 240, estela: SINIESTRO.core });
    const tt = k.target, s = tt.size, ms = 170;
    k.dibujar(ms + 140, (c, t) => {
      const m = t * (ms + 140), f = easeIn(Math.min(1, m / ms)), x = tt.center.x - k.dir.x * s * 0.25, y = lerp(tt.feet.y + s * 0.25, tt.center.y - s * 0.05, f);
      const golpe = m > ms ? (m - ms) / 140 : 0;
      c.globalAlpha = 1 - golpe;
      forma(c, 'puno', x, y, s * 0.38 * (1 + golpe * 0.25), -Math.PI / 2, { base: '#2a1836', claro: '#4a3060', oscuro: '#120818', borde: '#000000', brillo: SINIESTRO.glow, brilloTam: 10 }, k.dir.x < 0);
      if (m < ms && Math.random() < 0.8) k.emit({ x: x + rand(-s * 0.15, s * 0.15), y: y + s * 0.3, vy: 300, life: 140, size: 1.6, color: '#d0c0e0', shape: 'streak', stretch: 30 });
    }, { z: 1, delay: 60 });
    await k.esperar(60 + ms);
    await k.impacto(t => {
      k.add(E.starburst({ at: { x: t.center.x, y: t.center.y - t.size * 0.1 }, rays: 7, length: t.size * 0.7, width: 3, palette: SINIESTRO, duration: 240 }));
      E.sparks(k.fx, t.center, { count: 14, speed: [160, 340], palette: SINIESTRO, shape: 'streak', spread: [-Math.PI * 0.85, -Math.PI * 0.15] });
    });
    await k.despues();
  },

  // Mofa: el usuario hace burla con un guante blanco que llama moviendo los dedos ("ven aquí") y al objetivo le saltan
  // venas de rabia mientras tiembla.
  async taunt(k) {
    const u = k.user, s = u.size, p = { x: u.center.x + k.dir.x * s * 0.5, y: u.top.y + s * 0.15 }, ms = 560;
    k.dibujar(ms, (c, t) => {
      c.globalAlpha = aparece(t, 0.12, 0.2);
      forma(c, 'mano', p.x, p.y, s * 0.32 * rebote(Math.min(1, t * 4)), -Math.PI / 2 + Math.sin(t * TAU * 3) * 0.35, { base: '#ffffff', claro: '#f0f0f8', borde: '#3a2a48' });
    }, { z: 1 });
    void k.animar(u.sprite, [{ transform: 'rotate(0deg)' }, { transform: 'translate(0px, -4px) rotate(-6deg)', offset: 0.25 }, { transform: 'rotate(0deg)', offset: 0.5 }, { transform: 'translate(0px, -4px) rotate(-6deg)', offset: 0.75 }, { transform: 'rotate(0deg)' }], ms);
    await k.esperar(ms * 0.55);
    if (k.hayObjetivo) {
      const tt = k.target, st = tt.size;
      for (let i = 0; i < 2; i++) k.dibujar(440, (c, t) => { c.globalAlpha = 1 - easeIn(Math.max(0, (t - 0.6) / 0.4)); ira(c, tt.top.x + (i ? st * 0.3 : -st * 0.2), tt.top.y + (i ? 0 : st * 0.12), st * 0.16 * rebote(Math.min(1, t * 3.5))); }, { z: 1, delay: i * 100 });
      void k.agitar(tt.sprite, 3, 320);
      k.sombra(tt.sprite, { x: 0, y: 0 }, '#ff3a3a', 0, 300);
    }
    await k.esperar(ms * 0.5);
    await k.estado();
  },

  // Ladrón (60): una mano oscura se cuela hasta el objetivo, le arrebata la baya que llevaba (brillando) y vuelve
  // corriendo con ella al usuario.
  async thief(k) {
    await k.anticipar(70);
    const tt = k.target, s = tt.size, ida = 200, vuelta = 280, tamM = k.s(0.32);
    const asa = { x: tt.center.x - k.dir.x * s * 0.2 + k.perp.x * s * 0.3, y: tt.center.y - k.dir.y * s * 0.2 + k.perp.y * s * 0.3 };
    const salida = k.punto(0.2);
    k.dibujar(ida + vuelta, (c, t, engine) => {
      const m = t * (ida + vuelta), f = m < ida ? easeIn(m / ida) : 1 - easeInOut((m - ida) / vuelta);
      const p = { x: lerp(salida.x, asa.x, f) - k.dir.x * tamM * 0.5, y: lerp(salida.y, asa.y, f) - k.dir.y * tamM * 0.5 - Math.sin(Math.PI * f) * k.s(0.2) };
      const conBaya = m >= ida, bp = conBaya ? { x: p.x + k.dir.x * tamM * 0.55, y: p.y + k.dir.y * tamM * 0.55 } : asa;
      luz(c, engine, '#ffe680', bp, s * 0.2, 0.6 + 0.3 * Math.sin(m * 0.05));
      baya(c, bp.x, bp.y, s * 0.11, conBaya ? m * 0.01 : 0);
      forma(c, 'mano', p.x, p.y, tamM, k.angle, { base: '#2a1836', claro: '#4a3060', borde: '#000000', brillo: SINIESTRO.glow, brilloTam: 8 }, espejo(k));
      if (Math.random() < 0.4) k.emit({ x: p.x, y: p.y, vx: rand(-20, 20), vy: -rand(10, 30), life: 300, size: tamM * 0.3, sizeEnd: tamM * 0.6, color: '#1a0c24', alpha: 0.35, shape: 'smoke' });
    }, { z: 1 });
    await k.esperar(ida);
    await k.impacto(t => {
      E.sparks(k.fx, asa, { count: 10, speed: [100, 240], palette: NEUTRAL_FX.up, shape: 'star', size: [2.5, 4] });
      k.add(E.ring({ at: t.center, from: 4, to: t.size * 0.6, width: 3, color: SINIESTRO.glow, duration: 240 }));
    });
    await k.esperar(vuelta - 45);
    k.add(E.bloom({ at: k.user.center, radius: k.user.size * 0.6, color: '#ffe680', duration: 260 }));
    await k.despues();
  },

  // Tormento: una nube negra de tormenta con ojos rojos se forma sobre la cabeza del objetivo y le descarga rayitos
  // rojos de rabia una y otra vez; el objetivo se retuerce.
  async torment(k) {
    const tt = k.target, s = tt.size, nb = { x: tt.top.x, y: tt.top.y - s * 0.35 }, ms = 800;
    k.dibujar(ms, (c, t) => {
      const x = nb.x + Math.sin(t * 20) * 2;
      c.globalAlpha = aparece(t, 0.15, 0.2);
      nube(c, x, nb.y, s * 0.42 * rebote(Math.min(1, t * 4)), '#3a2a48', '#0a0410', 2);
      c.fillStyle = '#ff3a3a';
      for (const l of [-1, 1]) { c.beginPath(); c.moveTo(x + l * s * 0.06, nb.y - s * 0.02); c.lineTo(x + l * s * 0.2, nb.y - s * 0.08); c.lineTo(x + l * s * 0.17, nb.y + s * 0.02); c.closePath(); c.fill(); }
    }, { z: 1 });
    for (let i = 0; i < 4; i++) k.add(E.bolt({ from: { x: nb.x + rand(-s * 0.25, s * 0.25), y: nb.y + s * 0.12 }, to: { x: tt.center.x + rand(-s * 0.2, s * 0.2), y: tt.center.y + rand(-s * 0.1, s * 0.15) }, palette: ROJO, duration: 160, width: 2, branches: 1, delay: 180 + i * 130 }));
    await k.esperar(180);
    void k.agitar(tt.sprite, 3, 520);
    await k.esperar(ms - 280);
    await k.estado();
  },
};
