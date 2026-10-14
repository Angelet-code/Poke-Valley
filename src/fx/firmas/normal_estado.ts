// Firmas de movimientos (ver LEEME.md). Grupo: Normal (movimientos de estado).
// Cada una enseña el objeto o la imagen del movimiento (espadas, cola, tambor, campana, mirilla, calavera…) y llama
// a `k.estado()` una vez, cuando el efecto "llega". Las de "sobre sí mismo" animan al usuario.
import {
  E, NEUTRAL_FX, TYPE_FX, easeIn, easeInOut, easeOut, easeOutCubic, lerp, pick, rand, withAlpha,
  type Firma, type FxPalette, type Kit, type SlotGeometry, type Vec,
} from './kit';
import { forma, type EstiloForma, type NombreForma } from './formas';

const TAU = Math.PI * 2;
const TINTA = '#2a1a10';
const PIEL = '#f6dcc0';
const ORO: FxPalette = { core: '#ffc23a', glow: '#ffe08a', hot: '#fff6d0', dark: '#8a5a00' };
const ROSA: FxPalette = { core: '#ff7ab0', glow: '#ffb8d6', hot: '#fff0f6', dark: '#7a1a44' };
const LILA: FxPalette = { core: '#b48aff', glow: '#dcc8ff', hot: '#f6f0ff', dark: '#4a2a8a' };
const SUBE = NEUTRAL_FX.up, BAJA = NEUTRAL_FX.down, CURA = NEUTRAL_FX.heal, ESCUDO = NEUTRAL_FX.shield;
const MANO: EstiloForma = { base: PIEL, claro: '#fff0e0', oscuro: '#d8b090', borde: TINTA };
const ARCOIRIS = ['#ff4a4a', '#ff9a2a', '#ffe23a', '#4ad84a', '#3a9aff', '#9a5aff'];

// ---- Utilidades ----
/** Sobre quién cae el estado: el objetivo si lo hay; si no, el propio usuario. */
const blanco = (k: Kit): SlotGeometry => (k.hayObjetivo ? k.target : k.user);
/** Opacidad que entra en la fracción `entra` del tiempo y sale en la última `sale`. */
const env = (t: number, entra = 0.15, sale = 0.25): number => Math.max(0, Math.min(1, t / entra, (1 - t) / sale));
/** La cara, lo de encima de la cabeza y los pies de un Pokémon, donde esté ahora su sprite. */
const cabeza = (k: Kit, g: SlotGeometry): Vec => { const p = k.posSprite(g); return { x: p.x, y: p.y - g.size * 0.2 }; };
const encima = (k: Kit, g: SlotGeometry, f = 0.3): Vec => { const p = k.posSprite(g); return { x: p.x, y: p.y - g.size * (0.4 + f) }; };
const pies = (k: Kit, g: SlotGeometry): Vec => { const p = k.posSprite(g); return { x: p.x, y: p.y + g.size * 0.3 }; };
/** La boca del usuario: un poco por delante de su cara, hacia el objetivo. */
const boca = (k: Kit): Vec => { const p = cabeza(k, k.user); return { x: p.x + k.dir.x * k.user.size * 0.25, y: p.y + k.dir.y * k.user.size * 0.18 }; };
/** Fotograma de transform para los gestos del sprite: desplazamiento (px), escala, giro (grados) y offset. */
function tf(x = 0, y = 0, sx = 1, sy = sx, rot = 0, offset?: number): Keyframe {
  const f: Keyframe = { transform: `translate(${x}px, ${y}px) scale(${sx}, ${sy}) rotate(${rot}deg)` };
  if (offset !== undefined) f.offset = offset;
  return f;
}
/** Tambaleo de lado a lado (Danza Caos, Canto, bailes): `n` vaivenes de `grados`. */
function vaiven(n: number, grados: number, px = 0): Keyframe[] {
  const f: Keyframe[] = [tf()];
  for (let i = 1; i <= n; i++) f.push(tf(i % 2 ? -px : px, 0, 1, 1, i % 2 ? -grados : grados, i / (n + 1)));
  f.push(tf());
  return f;
}

interface Pose { x: number; y: number; tam: number; ang?: number; a?: number; espejo?: boolean }
/** Una forma de formas.ts animada: `pose(t)` dice dónde, de qué tamaño, girada y con qué opacidad (null = no se ve). */
function figura(k: Kit, nombre: NombreForma, ms: number, estilo: EstiloForma, pose: (t: number) => Pose | null, o: { z?: number; delay?: number } = {}): void {
  k.dibujar(ms, (c, t) => {
    const p = pose(t);
    if (!p || (p.a ?? 1) <= 0.01 || p.tam <= 0.5) return;
    c.globalAlpha = p.a ?? 1;
    forma(c, nombre, p.x, p.y, p.tam, p.ang ?? 0, estilo, p.espejo);
  }, { z: o.z ?? 1, delay: o.delay });
}

/** Ondas de sonido: arcos que salen de `de` hacia `ang` y viajan `largo` px; 'liso', 'zigzag' (agudo) u 'ondulado' (grave). */
function ondas(k: Kit, de: Vec, ang: number, largo: number, o: {
  n: number; cada: number; ms: number; color: string; claro: string; grosor: number; abre: number; tipo?: 'liso' | 'zigzag' | 'ondulado'; amp?: number; r0?: number;
}): void {
  const pasos = o.tipo === 'zigzag' ? 14 : 24, amp = o.amp ?? 4;
  for (let i = 0; i < o.n; i++) {
    k.dibujar(o.ms, (c, t) => {
      const r = (o.r0 ?? 6) + largo * easeOut(t), w = o.grosor * (1 - 0.5 * t);
      c.globalAlpha = env(t, 0.1, 0.4);
      c.lineCap = 'round'; c.lineJoin = 'round';
      c.beginPath();
      for (let s = 0; s <= pasos; s++) {
        const a = ang - o.abre / 2 + o.abre * s / pasos;
        const d = o.tipo === 'zigzag' ? (s % 2 ? amp : -amp) : o.tipo === 'ondulado' ? amp * Math.sin(s * 1.4 + t * 18) : 0;
        const x = de.x + Math.cos(a) * (r + d), y = de.y + Math.sin(a) * (r + d);
        if (s) c.lineTo(x, y); else c.moveTo(x, y);
      }
      c.strokeStyle = o.color; c.lineWidth = w; c.stroke();
      c.strokeStyle = o.claro; c.lineWidth = w * 0.4; c.stroke();
    }, { delay: i * o.cada, z: 1 });
  }
}

// ---- Dibujos propios (lo que no está en formas.ts) ----
/** Cola que se agita: sale de (x, y) hacia `ang`, larga 2·tam, ondulando con `fase`, con un mechón en la punta. */
function cola(c: CanvasRenderingContext2D, x: number, y: number, tam: number, ang: number, fase: number): void {
  const n = 16, izq: Vec[] = [], der: Vec[] = [];
  const curva = (u: number) => Math.sin(u * 4 - fase) * tam * 0.32 * u;
  const pendiente = (u: number) => 0.16 * (Math.sin(u * 4 - fase) + 4 * u * Math.cos(u * 4 - fase));
  for (let i = 0; i <= n; i++) {
    const u = i / n, lx = u * tam * 2, ly = curva(u), w = tam * 0.2 * (1 - 0.6 * u) + 1, p = pendiente(u), l = Math.hypot(1, p);
    izq.push({ x: lx - p / l * w, y: ly + w / l }); der.push({ x: lx + p / l * w, y: ly - w / l });
  }
  c.save(); c.translate(x, y); c.rotate(ang);
  c.lineJoin = 'round'; c.lineWidth = Math.max(1.5, tam * 0.08); c.strokeStyle = TINTA;
  c.beginPath();
  [...izq, ...der.reverse()].forEach((p, i) => { if (i) c.lineTo(p.x, p.y); else c.moveTo(p.x, p.y); });
  c.closePath(); c.fillStyle = '#f0d49a'; c.fill(); c.stroke();
  c.beginPath(); c.ellipse(tam * 2, curva(1), tam * 0.3, tam * 0.2, Math.atan(pendiente(1)), 0, TAU);
  c.fillStyle = '#fff4dc'; c.fill(); c.stroke();
  c.restore();
}

/** Mano con el índice estirado hacia +x (Metrónomo); el puño en (x, y). */
function dedo(c: CanvasRenderingContext2D, x: number, y: number, tam: number, ang: number): void {
  c.save(); c.translate(x, y); c.rotate(ang); c.scale(tam, tam);
  c.lineJoin = 'round'; c.lineWidth = 0.09; c.strokeStyle = TINTA; c.fillStyle = PIEL;
  c.beginPath(); c.roundRect(0.25, -0.44, 1.1, 0.3, 0.15); c.fill(); c.stroke();
  c.beginPath(); c.roundRect(-0.5, -0.5, 0.95, 1.0, 0.32); c.fill(); c.stroke();
  c.fillStyle = '#ffe8d2';
  for (const yy of [-0.12, 0.1, 0.3]) { c.beginPath(); c.roundRect(0.2, yy - 0.09, 0.32, 0.19, 0.09); c.fill(); c.stroke(); }
  c.beginPath(); c.roundRect(-0.35, 0.28, 0.6, 0.2, 0.1); c.fill(); c.stroke();
  c.restore();
}

/** Calavera (Canto Mortal) de radio ≈ tam, con los ojos encendidos. */
function calavera(c: CanvasRenderingContext2D, x: number, y: number, tam: number): void {
  c.save(); c.translate(x, y); c.scale(tam, tam);
  c.lineJoin = 'round'; c.lineWidth = 0.08; c.strokeStyle = '#1a0a24'; c.fillStyle = '#efe8d8';
  c.beginPath(); c.arc(0, -0.15, 0.72, 0, TAU); c.fill(); c.stroke();
  c.beginPath(); c.roundRect(-0.4, 0.3, 0.8, 0.42, 0.12); c.fill(); c.stroke();
  c.fillStyle = '#2a0f3a';
  for (const s of [-1, 1]) { c.beginPath(); c.ellipse(s * 0.28, -0.1, 0.19, 0.22, 0, 0, TAU); c.fill(); }
  c.beginPath(); c.moveTo(0, 0.12); c.lineTo(-0.09, 0.3); c.lineTo(0.09, 0.3); c.closePath(); c.fill();
  c.beginPath(); for (const xx of [-0.2, 0, 0.2]) { c.moveTo(xx, 0.42); c.lineTo(xx, 0.7); } c.stroke();
  c.fillStyle = '#ff3a5a';
  for (const s of [-1, 1]) { c.beginPath(); c.arc(s * 0.28, -0.08, 0.06, 0, TAU); c.fill(); }
  c.restore();
}

/** Tambor rojo visto en 3/4: parche arriba en (x, y), radio `tam`; `golpe` (0-1) hunde el parche. */
function tambor(c: CanvasRenderingContext2D, x: number, y: number, tam: number, golpe: number): void {
  const h = tam * 0.75, ry = tam * 0.34, borde = Math.max(1.5, tam * 0.08);
  c.save(); c.lineJoin = 'round'; c.lineWidth = borde; c.strokeStyle = TINTA;
  c.beginPath(); c.moveTo(x - tam, y); c.lineTo(x - tam, y + h); c.ellipse(x, y + h, tam, ry, 0, Math.PI, 0, true); c.lineTo(x + tam, y); c.closePath();
  c.fillStyle = '#d0402c'; c.fill(); c.stroke();
  c.beginPath();
  for (let i = 0; i <= 8; i++) {
    const xx = -0.9 + i * 0.225, curva = ry * Math.sqrt(1 - xx * xx), yy = i % 2 ? y + h + curva - tam * 0.12 : y + curva + tam * 0.08;
    if (i) c.lineTo(x + xx * tam, yy); else c.moveTo(x + xx * tam, yy);
  }
  c.strokeStyle = '#fff4dc'; c.lineWidth = borde * 0.8; c.stroke();
  c.beginPath(); c.ellipse(x, y, tam, ry, 0, 0, TAU); c.fillStyle = '#f6ecd4'; c.fill(); c.strokeStyle = TINTA; c.lineWidth = borde; c.stroke();
  if (golpe > 0) { c.globalAlpha *= golpe; c.beginPath(); c.ellipse(x, y, tam * 0.55, ry * 0.5, 0, 0, TAU); c.fillStyle = '#d8b884'; c.fill(); }
  c.restore();
}

/** Botella de leche (Batido), boca hacia −y, girada `ang`; `nivel` 0-1 de leche. */
function botella(c: CanvasRenderingContext2D, x: number, y: number, tam: number, ang: number, nivel: number): void {
  const vidrio = () => {
    c.beginPath(); c.moveTo(-0.22, -0.85); c.lineTo(0.22, -0.85); c.lineTo(0.22, -0.5); c.quadraticCurveTo(0.5, -0.38, 0.5, -0.1);
    c.lineTo(0.5, 0.85); c.quadraticCurveTo(0.5, 1, 0.35, 1); c.lineTo(-0.35, 1); c.quadraticCurveTo(-0.5, 1, -0.5, 0.85);
    c.lineTo(-0.5, -0.1); c.quadraticCurveTo(-0.5, -0.38, -0.22, -0.5); c.closePath();
  };
  c.save(); c.translate(x, y); c.rotate(ang); c.scale(tam, tam); c.lineJoin = 'round';
  vidrio(); c.fillStyle = 'rgba(214,236,255,0.55)'; c.fill();
  c.save(); vidrio(); c.clip();
  c.fillStyle = '#fbfaf2'; c.fillRect(-0.6, 1 - 1.9 * nivel, 1.2, 1.9 * nivel + 0.1);
  c.fillStyle = '#4a8ae0'; c.fillRect(-0.6, 0.15, 1.2, 0.32);
  c.fillStyle = '#ffffff'; c.beginPath(); c.arc(0, 0.31, 0.11, 0, TAU); c.fill();
  c.restore();
  vidrio(); c.lineWidth = 0.08; c.strokeStyle = '#1e2a3a'; c.stroke();
  c.beginPath(); c.ellipse(0, -0.85, 0.26, 0.07, 0, 0, TAU); c.stroke();
  c.strokeStyle = 'rgba(255,255,255,0.85)'; c.lineCap = 'round'; c.beginPath(); c.moveTo(-0.33, -0.05); c.lineTo(-0.33, 0.75); c.stroke();
  c.restore();
}

const PUNTOS_CRUZ: [number, number][] = [[-0.32, -1], [0.32, -1], [0.32, -0.32], [1, -0.32], [1, 0.32], [0.32, 0.32], [0.32, 1], [-0.32, 1], [-0.32, 0.32], [-1, 0.32], [-1, -0.32], [-0.32, -0.32]];
/** Cruz verde de curación (Recuperación, Tragar). */
function cruz(c: CanvasRenderingContext2D, x: number, y: number, tam: number, brillo = true): void {
  c.save(); c.translate(x, y); c.scale(tam, tam); c.lineJoin = 'round';
  const trazo = (s: number) => { c.beginPath(); PUNTOS_CRUZ.forEach(([a, b], i) => { if (i) c.lineTo(a * s, b * s); else c.moveTo(a * s, b * s); }); c.closePath(); };
  if (brillo) { c.shadowColor = CURA.core; c.shadowBlur = tam * 0.6; }
  trazo(1);
  const g = c.createLinearGradient(0, -1, 0, 1); g.addColorStop(0, '#9affb8'); g.addColorStop(1, '#22b85a');
  c.fillStyle = g; c.fill();
  c.shadowBlur = 0; c.lineWidth = 0.1; c.strokeStyle = '#0d5a2a'; c.stroke();
  trazo(0.55); c.fillStyle = 'rgba(255,255,255,0.55)'; c.fill();
  c.restore();
}

/** Bastón de relevos amarillo con franjas rojas. */
function baston(c: CanvasRenderingContext2D, x: number, y: number, tam: number, ang: number): void {
  c.save(); c.translate(x, y); c.rotate(ang); c.scale(tam, tam);
  c.beginPath(); c.roundRect(-1, -0.22, 2, 0.44, 0.22); c.fillStyle = '#f2c94a'; c.fill();
  c.save(); c.clip();
  c.fillStyle = '#e0503a'; for (const sx of [-0.8, -0.1, 0.6]) c.fillRect(sx, -0.3, 0.22, 0.6);
  c.fillStyle = 'rgba(255,255,255,0.55)'; c.fillRect(-1, -0.15, 2, 0.1);
  c.restore();
  c.lineWidth = 0.1; c.strokeStyle = TINTA; c.beginPath(); c.roundRect(-1, -0.22, 2, 0.44, 0.22); c.stroke();
  c.restore();
}

/** Campana dorada colgada de (x, y), balanceada `ang` (Cascabel Cura). */
function cascabel(c: CanvasRenderingContext2D, x: number, y: number, tam: number, ang: number): void {
  c.save(); c.translate(x, y); c.rotate(ang); c.scale(tam, tam);
  c.lineJoin = 'round'; c.lineWidth = 0.08; c.strokeStyle = '#4a3000';
  c.beginPath(); c.arc(0, 0.1, 0.12, 0, TAU); c.stroke();
  c.beginPath(); c.arc(0, 1.36, 0.15, 0, TAU); c.fillStyle = '#b07a10'; c.fill(); c.stroke();
  c.beginPath(); c.arc(0, 0.62, 0.42, Math.PI, 0); c.quadraticCurveTo(0.45, 1.05, 0.74, 1.2); c.lineTo(-0.74, 1.2); c.quadraticCurveTo(-0.45, 1.05, -0.42, 0.62); c.closePath();
  const g = c.createLinearGradient(-0.7, 0, 0.7, 0); g.addColorStop(0, '#c8901a'); g.addColorStop(0.35, '#fff0a0'); g.addColorStop(1, '#b07a10');
  c.fillStyle = g; c.fill(); c.stroke();
  c.beginPath(); c.roundRect(-0.8, 1.12, 1.6, 0.16, 0.08); c.fillStyle = '#e0a830'; c.fill(); c.stroke();
  c.restore();
}

/** Mirilla: dos círculos y cuatro marcas (Fijar Blanco). */
function mira(c: CanvasRenderingContext2D, x: number, y: number, r: number, rot: number, color: string): void {
  c.save(); c.translate(x, y); c.rotate(rot); c.lineCap = 'round';
  c.beginPath(); c.arc(0, 0, r, 0, TAU);
  c.moveTo(r * 0.55, 0); c.arc(0, 0, r * 0.55, 0, TAU);
  for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2; c.moveTo(Math.cos(a) * r * 0.7, Math.sin(a) * r * 0.7); c.lineTo(Math.cos(a) * r * 1.3, Math.sin(a) * r * 1.3); }
  const w = Math.max(2, r * 0.07);
  c.strokeStyle = 'rgba(30,0,0,0.6)'; c.lineWidth = w + 2.5; c.stroke();
  c.strokeStyle = color; c.lineWidth = w; c.stroke();
  c.fillStyle = color; c.beginPath(); c.arc(0, 0, w * 1.2, 0, TAU); c.fill();
  c.restore();
}

/** Señal de prohibido: aro rojo y barra diagonal (Anulación). */
function prohibido(c: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  c.save(); c.translate(x, y);
  c.beginPath(); c.arc(0, 0, r, 0, TAU); c.fillStyle = 'rgba(255,255,255,0.3)'; c.fill();
  c.beginPath(); c.arc(0, 0, r * 0.88, 0, TAU); c.moveTo(-r * 0.62, -r * 0.62); c.lineTo(r * 0.62, r * 0.62);
  c.strokeStyle = TINTA; c.lineWidth = r * 0.27; c.stroke();
  c.strokeStyle = '#e0202a'; c.lineWidth = r * 0.19; c.stroke();
  c.restore();
}

/** Tres flechas verdes en círculo (Reciclaje). */
function reciclaje(c: CanvasRenderingContext2D, x: number, y: number, r: number, rot: number): void {
  c.save(); c.translate(x, y); c.rotate(rot); c.lineCap = 'round'; c.lineJoin = 'round';
  const w = r * 0.2;
  for (let i = 0; i < 3; i++) {
    const a0 = i * TAU / 3 + 0.2, a1 = a0 + TAU / 3 - 0.75;
    for (const [ancho, color] of [[w + 3, TINTA], [w, '#3cc860']] as const) {
      c.beginPath(); c.arc(0, 0, r, a0, a1); c.lineWidth = ancho; c.strokeStyle = color; c.stroke();
    }
    c.beginPath();
    c.moveTo(Math.cos(a1 + 0.34) * r, Math.sin(a1 + 0.34) * r);
    c.lineTo(Math.cos(a1) * (r + w * 1.2), Math.sin(a1) * (r + w * 1.2));
    c.lineTo(Math.cos(a1) * (r - w * 1.2), Math.sin(a1) * (r - w * 1.2));
    c.closePath(); c.fillStyle = '#3cc860'; c.fill(); c.lineWidth = 1.5; c.strokeStyle = TINTA; c.stroke();
  }
  c.restore();
}

/** Baya Aranja (Reciclaje): bola azul con una hoja. */
function baya(c: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  forma(c, 'hoja', x + r * 0.5, y - r * 1.05, r * 0.6, -0.5, { base: '#5ac83a', borde: '#1d5c17' });
  const g = c.createRadialGradient(x - r * 0.35, y - r * 0.35, r * 0.1, x, y, r);
  g.addColorStop(0, '#bfe0ff'); g.addColorStop(0.45, '#4a8ae8'); g.addColorStop(1, '#1e3a9a');
  c.fillStyle = g; c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill();
  c.lineWidth = Math.max(1.5, r * 0.12); c.strokeStyle = '#0e1e4a'; c.stroke();
}

/** Bola de energía naranja (Reserva, Tragar). */
function orbe(c: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  const halo = c.createRadialGradient(x, y, r * 0.5, x, y, r * 2.2);
  halo.addColorStop(0, 'rgba(255,190,80,0.6)'); halo.addColorStop(1, 'rgba(255,190,80,0)');
  c.fillStyle = halo; c.beginPath(); c.arc(x, y, r * 2.2, 0, TAU); c.fill();
  const g = c.createRadialGradient(x - r * 0.35, y - r * 0.35, r * 0.1, x, y, r);
  g.addColorStop(0, '#fffbe0'); g.addColorStop(0.5, '#ffc24a'); g.addColorStop(1, '#e07a10');
  c.fillStyle = g; c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill();
  c.lineWidth = 1.5; c.strokeStyle = '#7a3a00'; c.stroke();
}

/** Cara terrorífica (Cara Susto): ojos rasgados con pupilas rojas y una boca dentada que se abre (`abre` 0-1). */
function caraSusto(c: CanvasRenderingContext2D, x: number, y: number, tam: number, abre: number): void {
  c.save(); c.translate(x, y); c.scale(tam, tam); c.lineJoin = 'round';
  const fondo = c.createRadialGradient(0, 0, 0.2, 0, 0, 1.25);
  fondo.addColorStop(0, 'rgba(40,8,56,0.9)'); fondo.addColorStop(0.7, 'rgba(40,8,56,0.6)'); fondo.addColorStop(1, 'rgba(40,8,56,0)');
  c.fillStyle = fondo; c.beginPath(); c.arc(0, 0, 1.25, 0, TAU); c.fill();
  c.lineWidth = 0.07; c.strokeStyle = '#120018';
  for (const s of [-1, 1]) {
    c.beginPath(); c.moveTo(s * 0.12, -0.22); c.lineTo(s * 0.8, -0.55); c.lineTo(s * 0.7, -0.12); c.quadraticCurveTo(s * 0.4, 0.02, s * 0.12, -0.1); c.closePath();
    c.fillStyle = '#fff6b0'; c.fill(); c.stroke();
    c.shadowColor = '#ff2020'; c.shadowBlur = 10;
    c.fillStyle = '#ff2a1a'; c.beginPath(); c.arc(s * 0.42, -0.2, 0.09, 0, TAU); c.fill();
    c.shadowBlur = 0;
  }
  const arriba = (xx: number) => 0.2 + 0.125 * (1 - (xx / 0.75) ** 2), abajo = (xx: number) => 0.2 + (0.125 + 0.45 * abre) * (1 - (xx / 0.75) ** 2);
  c.beginPath(); c.moveTo(-0.75, 0.2); c.quadraticCurveTo(0, 0.45, 0.75, 0.2); c.quadraticCurveTo(0, 0.45 + 0.9 * abre, -0.75, 0.2); c.closePath();
  c.fillStyle = '#3a0010'; c.fill(); c.stroke();
  c.fillStyle = '#ffffff';
  for (let i = 0; i < 6; i++) {
    const x0 = -0.6 + i * 0.2, x1 = x0 + 0.2, xm = (x0 + x1) / 2;
    c.beginPath(); c.moveTo(x0, arriba(x0)); c.lineTo(xm, arriba(xm) + 0.16); c.lineTo(x1, arriba(x1)); c.closePath(); c.fill();
    if (abre > 0.3) { c.beginPath(); c.moveTo(x0, abajo(x0)); c.lineTo(xm, abajo(xm) - 0.13); c.lineTo(x1, abajo(x1)); c.closePath(); c.fill(); }
  }
  c.restore();
}

/** Marca de enfado (cuatro venas rojas en cruz). */
function venas(c: CanvasRenderingContext2D, x: number, y: number, tam: number): void {
  c.save(); c.translate(x, y); c.scale(tam, tam); c.lineCap = 'round';
  for (const [ancho, color] of [[0.42, TINTA], [0.26, '#ff3a2a']] as const) {
    c.lineWidth = ancho; c.strokeStyle = color;
    for (let q = 0; q < 4; q++) { c.save(); c.rotate(q * Math.PI / 2); c.beginPath(); c.moveTo(0.25, -0.95); c.quadraticCurveTo(0.3, -0.3, 0.95, -0.25); c.stroke(); c.restore(); }
  }
  c.restore();
}

/** Corona dorada con joyas (Fanfarronear). */
function corona(c: CanvasRenderingContext2D, x: number, y: number, tam: number, ang: number): void {
  c.save(); c.translate(x, y); c.rotate(ang); c.scale(tam, tam);
  c.lineJoin = 'round'; c.lineWidth = 0.09; c.strokeStyle = '#5a3a00';
  c.beginPath(); c.moveTo(-1, 0.5); c.lineTo(-1, -0.45); c.lineTo(-0.5, 0); c.lineTo(0, -0.7); c.lineTo(0.5, 0); c.lineTo(1, -0.45); c.lineTo(1, 0.5); c.closePath();
  const g = c.createLinearGradient(0, -0.7, 0, 0.5); g.addColorStop(0, '#fff2a0'); g.addColorStop(1, '#e0a020');
  c.fillStyle = g; c.fill(); c.stroke();
  c.fillStyle = '#c8202a'; c.beginPath(); c.arc(0, 0.25, 0.14, 0, TAU); c.fill(); c.stroke();
  c.fillStyle = '#2a7ae0'; for (const s of [-1, 1]) { c.beginPath(); c.arc(s * 0.55, 0.28, 0.1, 0, TAU); c.fill(); c.stroke(); }
  c.fillStyle = '#fff6d0'; for (const [px, py] of [[-1, -0.45], [0, -0.7], [1, -0.45]]) { c.beginPath(); c.arc(px, py, 0.1, 0, TAU); c.fill(); c.stroke(); }
  c.restore();
}

/** Antebrazo con el puño en la punta (Bloqueo): de (x, y) hacia `ang`, largo L. */
function brazo(c: CanvasRenderingContext2D, x: number, y: number, L: number, ang: number): void {
  c.save(); c.translate(x, y); c.rotate(ang);
  c.beginPath(); c.roundRect(-L * 0.95, -L * 0.15, L * 1.6, L * 0.3, L * 0.15);
  c.fillStyle = PIEL; c.fill(); c.lineWidth = Math.max(2, L * 0.06); c.strokeStyle = TINTA; c.stroke();
  c.restore();
  forma(c, 'puno', x + Math.cos(ang) * L * 0.85, y + Math.sin(ang) * L * 0.85, L * 0.36, ang, MANO);
}

export const FIRMAS: Record<string, Firma> = {
  // Cede Paso: el usuario hace una reverencia y una flecha dorada se curva desde él hasta el otro, que da un saltito.
  async afteryou(k) {
    const g = blanco(k), u = k.user, p0 = k.posSprite(u), w = Math.max(3, u.size * 0.07), ms = 560;
    void k.animar(u.sprite, [tf(), tf(0, 3, 1.04, 0.86, -10, 0.45), tf()], 480);
    const camino = (s: number): Vec => (k.hayObjetivo
      ? k.punto(0.12 + 0.72 * s, -k.s(0.55) * Math.sin(Math.PI * s))
      : k.alrededor(p0, u.size * 0.75, Math.PI * (0.9 + 1.2 * s), 0.7));
    k.dibujar(ms, (c, t) => {
      const fin = easeOutCubic(Math.min(1, t / 0.55)), ini = fin * Math.max(0, (t - 0.6) / 0.4);
      if (fin - ini < 0.03) return;
      c.globalAlpha = env(t, 0.05, 0.3);
      c.lineCap = 'round'; c.lineJoin = 'round';
      c.beginPath();
      for (let i = 0; i <= 20; i++) { const p = camino(lerp(ini, fin, i / 20)); if (i) c.lineTo(p.x, p.y); else c.moveTo(p.x, p.y); }
      c.strokeStyle = TINTA; c.lineWidth = w + 3; c.stroke();
      c.strokeStyle = ORO.core; c.lineWidth = w; c.stroke();
      c.strokeStyle = ORO.hot; c.lineWidth = w * 0.35; c.stroke();
      const f = camino(fin), b = camino(Math.max(0, fin - 0.03)), an = Math.atan2(f.y - b.y, f.x - b.x), L = w * 2.4;
      c.beginPath();
      c.moveTo(f.x + Math.cos(an) * L, f.y + Math.sin(an) * L);
      c.lineTo(f.x + Math.cos(an + 2.3) * L, f.y + Math.sin(an + 2.3) * L);
      c.lineTo(f.x + Math.cos(an - 2.3) * L, f.y + Math.sin(an - 2.3) * L);
      c.closePath(); c.fillStyle = ORO.core; c.fill(); c.lineWidth = 2; c.strokeStyle = TINTA; c.stroke();
    }, { z: 1 });
    await k.esperar(320);
    k.add(E.ring({ at: k.posSprite(g), from: 4, to: g.size * 0.6, width: 3, color: ORO.glow, duration: 320 }));
    E.sparks(k.fx, encima(k, g, 0), { count: 10, speed: [60, 160], palette: ORO, shape: 'star', size: [3, 5], spread: [-Math.PI, 0] });
    void k.saltar(g.sprite, g.size * 0.12, 260);
    await k.esperar(120);
    await k.estado();
  },

  // Relevo: lanza al aire un bastón de relevos que gira; el usuario se desvanece en luz roja (vuelve a su Poké Ball)
  // y reaparece con un destello cuando el bastón cae.
  async batonpass(k) {
    const u = k.user, p0 = k.posSprite(u), ms = 600, alto = u.size * 1.2;
    k.dibujar(ms, (c, t) => {
      const x = p0.x + u.size * 0.25 * Math.sin(Math.PI * t), y = p0.y - u.size * 0.15 - alto * Math.sin(Math.PI * t);
      c.globalAlpha = env(t, 0.08, 0.08);
      baston(c, x, y, u.size * 0.22, t * TAU * 2.5);
      if (Math.random() < 0.5) k.emit({ x, y, vx: rand(-30, 30), vy: rand(-20, 30), life: 300, size: rand(2, 3.5), color: pick([ORO.glow, '#ffffff']), shape: 'star', spin: rand(-6, 6) });
    }, { z: 1 });
    void k.animar(u.sprite, [tf(), tf(0, 0, 0.3, 0.3, 0, 0.35), tf(0, 0, 0.3, 0.3, 0, 0.7), tf(0, 0, 1.1, 0.92, 0, 0.9), tf()], ms + 80);
    void k.animar(u.sprite, [{ opacity: 1 }, { opacity: 0.15, offset: 0.35 }, { opacity: 0.15, offset: 0.7 }, { opacity: 1, offset: 0.85 }, { opacity: 1 }], ms + 80);
    k.sombra(u.sprite, { x: 0, y: 0 }, '#ff5a4a', 0, 260);
    k.add(E.bloom({ at: p0, radius: u.size * 0.5, color: '#ff8a7a', duration: 300 }));
    await k.esperar(ms - 60);
    k.add(E.bloom({ at: p0, radius: u.size * 0.7, color: '#ffffff', duration: 280 }));
    k.add(E.ring({ at: pies(k, u), from: 6, to: u.size * 0.8, width: 3, color: ORO.glow, duration: 360, squash: 0.4 }));
    E.sparks(k.fx, p0, { count: 12, speed: [80, 200], palette: ORO, shape: 'star', size: [2.5, 4.5] });
    await k.estado();
  },

  // Tambor: un tambor rojo aparece en la barriga y dos baquetas lo aporrean cuatro veces (onda a cada golpe); al final
  // el usuario se tiñe de rojo (paga vida) y estalla de fuerza.
  async bellydrum(k) {
    const u = k.user, p0 = k.posSprite(u), tam = u.size * 0.3, cx = p0.x, cy = p0.y + u.size * 0.08, golpes = 4, cada = 115, ms = golpes * cada + 160;
    const fr: Keyframe[] = [tf()];
    for (let i = 0; i < golpes; i++) { const o = (i * cada + 30) / ms; fr.push(tf(0, 2, 1.08, 0.92, 0, o), tf(0, 0, 1, 1, 0, o + 50 / ms)); }
    fr.push(tf());
    void k.animar(u.sprite, fr, ms);
    k.dibujar(ms, (c, t) => {
      const T = t * ms, i = Math.floor(T / cada), fase = (T % cada) / cada;
      c.globalAlpha = env(t, 0.06, 0.15);
      tambor(c, cx, cy, tam, i < golpes ? Math.max(0, 1 - fase * 3) : 0);
      for (const lado of [-1, 1]) {
        const pega = i < golpes && (i % 2 === 0 ? -1 : 1) === lado, sigue = i + 1 < golpes && ((i + 1) % 2 === 0 ? -1 : 1) === lado;
        const alza = pega ? (fase < 0.5 ? Math.sin(Math.PI * fase) : 1) : sigue ? (fase < 0.5 ? 1 : Math.cos(Math.PI * (fase - 0.5))) : 0.9;
        const px = cx + lado * tam * 1.35, py = cy - tam * 1.05, tx = cx + lado * tam * 0.4, ty = cy;
        const L = Math.hypot(tx - px, ty - py), a = Math.atan2(ty - py, tx - px) + lado * alza * 0.9;
        const ex = px + Math.cos(a) * L, ey = py + Math.sin(a) * L;
        c.lineCap = 'round';
        c.beginPath(); c.moveTo(px, py); c.lineTo(ex, ey);
        c.strokeStyle = TINTA; c.lineWidth = tam * 0.16 + 3; c.stroke();
        c.strokeStyle = '#a8703a'; c.lineWidth = tam * 0.16; c.stroke();
        c.beginPath(); c.arc(ex, ey, tam * 0.14, 0, TAU); c.fillStyle = '#f4e4c4'; c.fill(); c.lineWidth = 1.5; c.strokeStyle = TINTA; c.stroke();
      }
    }, { z: 1 });
    for (let i = 0; i < golpes; i++) {
      k.add(E.ring({ at: { x: cx, y: cy }, from: tam * 0.6, to: tam * 2.4, width: 3, color: i === golpes - 1 ? SUBE.core : '#ffe0b0', duration: 280, squash: 0.45, delay: i * cada }));
      k.burst(4, () => ({ x: cx + rand(-tam * 0.5, tam * 0.5), y: cy, vx: rand(-80, 80), vy: -rand(60, 140), ay: 300, life: 300, delay: i * cada, size: rand(2, 3.5), color: '#fff2c0', shape: 'star', spin: 6 }));
    }
    await k.esperar(golpes * cada + 40);
    // Paga la mitad de su vida (destello rojo) y su Ataque sube al máximo.
    k.sombra(u.sprite, { x: 0, y: 0 }, '#ff2a1a', 0, 380);
    k.add(E.bloom({ at: p0, radius: u.size * 0.8, color: '#ff6a3a', duration: 380 }));
    k.add(E.ring({ at: p0, from: u.size * 0.3, to: u.size * 1.1, width: 5, color: SUBE.core, duration: 360 }));
    k.burst(14, i => { const a = i / 14 * TAU; return { x: p0.x + Math.cos(a) * u.size * 0.3, y: p0.y + Math.sin(a) * u.size * 0.25, vx: Math.cos(a) * 40, vy: -rand(140, 220), life: 420, size: rand(4, 7), sizeEnd: 1, color: pick([SUBE.core, '#ff5a2a', SUBE.glow]), shape: 'glow' }; });
    await k.estado();
  },

  // Bloqueo: dos brazos cruzados en X caen de golpe sobre el objetivo, una barrera que no le deja escapar.
  async block(k) {
    const g = blanco(k), ms = 620, golpe = 0.3;
    await k.anticipar(70);
    void k.embestida({ hasta: 0.2, ida: 110, vuelta: 220 });
    k.dibujar(ms, (c, t) => {
      const p = k.posSprite(g), e = t < golpe ? 1.9 - 0.9 * easeIn(t / golpe) : 1 + 0.06 * Math.sin((t - golpe) * 40) * (1 - t);
      c.globalAlpha = t < golpe ? t / golpe : env(t, 0.1, 0.25);
      const L = g.size * 0.5 * e;
      brazo(c, p.x, p.y, L, -Math.PI * 0.75);
      brazo(c, p.x, p.y, L, -Math.PI * 0.25);
    }, { z: 1 });
    await k.esperar(ms * golpe);
    const p = k.posSprite(g);
    k.add(E.bloom({ at: p, radius: g.size * 0.7, color: '#ff7a5a', duration: 300, z: 0 }));
    k.add(E.ring({ at: p, from: g.size * 0.3, to: g.size, width: 5, color: '#ff6a4a', duration: 320 }));
    k.add(E.ring({ at: pies(k, g), from: g.size * 0.2, to: g.size * 0.9, width: 3, color: '#ffd0a0', duration: 380, squash: 0.35 }));
    E.dust(k.stage, pies(k, g), g.size);
    void k.agitar(g.sprite, 3, 200);
    await k.esperar(220);
    await k.estado();
  },

  // Copión: aparece un espejo dorado junto al usuario con su reflejo dentro; el reflejo salta del espejo al usuario.
  async copycat(k) {
    const u = k.user, p0 = k.posSprite(u), m = { x: p0.x + u.size * 0.85, y: p0.y - u.size * 0.05 }, rx = u.size * 0.3, ry = u.size * 0.44, ms = 640;
    k.dibujar(ms, (c, t) => {
      const ab = easeOutCubic(Math.min(1, t / 0.25));
      c.globalAlpha = env(t, 0.12, 0.25);
      c.save(); c.translate(m.x, m.y); c.scale(Math.max(0.05, ab), 1);
      const vidrio = c.createLinearGradient(-rx, -ry, rx, ry);
      vidrio.addColorStop(0, 'rgba(232,246,255,0.5)'); vidrio.addColorStop(0.5, 'rgba(158,207,238,0.35)'); vidrio.addColorStop(1, 'rgba(216,240,255,0.5)');
      c.beginPath(); c.ellipse(0, 0, rx, ry, 0, 0, TAU); c.fillStyle = vidrio; c.fill();
      c.save(); c.clip(); c.rotate(0.5);
      const sx = lerp(-rx * 2, rx * 2, (t * 1.6) % 1);
      c.fillStyle = 'rgba(255,255,255,0.7)'; c.fillRect(sx, -ry * 2, rx * 0.25, ry * 4);
      c.restore();
      c.beginPath(); c.ellipse(0, 0, rx, ry, 0, 0, TAU);
      c.strokeStyle = TINTA; c.lineWidth = u.size * 0.08 + 3; c.stroke();
      c.strokeStyle = '#e0a830'; c.lineWidth = u.size * 0.08; c.stroke();
      c.strokeStyle = '#fff0b0'; c.lineWidth = u.size * 0.025; c.stroke();
      c.beginPath(); c.arc(0, -ry - u.size * 0.05, u.size * 0.06, 0, TAU); c.fillStyle = '#e0a830'; c.fill(); c.lineWidth = 2; c.strokeStyle = TINTA; c.stroke();
      c.restore();
    }, { z: 1 });
    const v = { x: m.x - p0.x, y: m.y - p0.y };
    k.sombra(u.sprite, v, '#cfeaff', 90, 300);
    k.sombra(u.sprite, v, '#cfeaff', 220, 260);
    for (let i = 1; i <= 3; i++) k.sombra(u.sprite, { x: v.x * (1 - i / 4), y: v.y * (1 - i / 4) }, '#e8f6ff', 360 + i * 35, 220);
    await k.esperar(480);
    k.destello(u.sprite);
    k.add(E.ring({ at: p0, from: 6, to: u.size * 0.7, width: 3, color: '#bfe6ff', duration: 300 }));
    E.sparks(k.fx, p0, { count: 10, speed: [60, 180], palette: ORO, shape: 'star', size: [2.5, 4] });
    await k.esperar(60);
    await k.estado();
  },

  // Rizo Defensa: el usuario se hace una bola; una esfera con el dibujo de una concha enrollada lo envuelve y se mece.
  async defensecurl(k) {
    const u = k.user, ms = 560;
    void k.animar(u.sprite, [tf(), tf(0, 4, 1.12, 0.78, 0, 0.25), tf(-4, 4, 1.06, 0.84, -14, 0.5), tf(4, 4, 1.06, 0.84, 14, 0.75), tf()], ms + 100);
    k.dibujar(ms, (c, t) => {
      const p = k.posSprite(u), r = u.size * 0.46 * (1.3 - 0.3 * easeOutCubic(Math.min(1, t / 0.3))), cy = p.y + u.size * 0.06;
      c.globalAlpha = env(t, 0.15, 0.3);
      const gr = c.createRadialGradient(p.x - r * 0.35, cy - r * 0.4, r * 0.1, p.x, cy, r);
      gr.addColorStop(0, 'rgba(255,250,235,0.55)'); gr.addColorStop(0.7, 'rgba(232,214,170,0.35)'); gr.addColorStop(1, 'rgba(160,130,80,0.6)');
      c.fillStyle = gr; c.beginPath(); c.arc(p.x, cy, r, 0, TAU); c.fill();
      c.lineWidth = 2.5; c.strokeStyle = 'rgba(90,64,30,0.9)'; c.stroke();
      c.save(); c.translate(p.x, cy); c.rotate(Math.sin(t * TAU) * 0.6);
      c.strokeStyle = 'rgba(120,88,40,0.75)'; c.lineWidth = 2; c.lineCap = 'round';
      c.beginPath();
      for (let i = 0; i <= 40; i++) { const a = i * 0.3, rr = r * (0.92 - i * 0.02); if (i) c.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); else c.moveTo(Math.cos(a) * rr, Math.sin(a) * rr); }
      c.stroke();
      c.restore();
      c.fillStyle = 'rgba(255,255,255,0.75)'; c.beginPath(); c.ellipse(p.x - r * 0.4, cy - r * 0.45, r * 0.18, r * 0.1, -0.6, 0, TAU); c.fill();
    }, { z: 1 });
    await k.esperar(170);
    k.add(E.ring({ at: pies(k, u), from: u.size * 0.2, to: u.size * 0.7, width: 3, color: '#e8d6aa', duration: 320, squash: 0.35 }));
    await k.esperar(300);
    E.sparks(k.fx, encima(k, u, 0), { count: 8, speed: [60, 140], palette: ORO, shape: 'star', size: [2.5, 4], spread: [-Math.PI, 0] });
    await k.estado();
  },

  // Anulación: un rayito rojo señala al objetivo y una señal de prohibido se estampa sobre él, tachando el destello de
  // su movimiento; el objetivo se queda gris un instante.
  async disable(k) {
    const g = blanco(k), ms = 640, golpe = 0.28;
    await k.anticipar(60);
    void k.recuperar({ x: -k.dir.x * 8, y: -k.dir.y * 8 }, 180);
    if (k.hayObjetivo) k.dibujar(220, (c, t) => {
      const a = k.punto(0.15), b = k.punto(Math.min(0.9, 0.15 + t * 1.2));
      c.globalAlpha = env(t, 0.1, 0.4); c.lineCap = 'round';
      c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(b.x, b.y);
      c.strokeStyle = '#e0202a'; c.lineWidth = 3; c.stroke(); c.strokeStyle = '#ffd0d0'; c.lineWidth = 1; c.stroke();
    }, { z: 1 });
    k.dibujar(ms, (c, t) => {
      const p = cabeza(k, g), r = g.size * 0.42 * (t < golpe ? 2 - easeIn(t / golpe) : 1 + 0.08 * Math.sin((t - golpe) * 30) * (1 - t));
      c.globalAlpha = (t < golpe ? t / golpe : 1) * env(t, 0.01, 0.25);
      forma(c, 'estrella', p.x, p.y, r * 0.55, 0, { base: '#d8d8e0', claro: '#f0f0f8', borde: '#5a5a66', alpha: 0.9 });
      prohibido(c, p.x, p.y, r);
    }, { z: 1 });
    await k.esperar(ms * golpe);
    const p = cabeza(k, g);
    k.add(E.ring({ at: p, from: g.size * 0.35, to: g.size * 0.8, width: 4, color: '#ff4a4a', duration: 280 }));
    E.sparks(k.fx, p, { count: 10, speed: [80, 200], palette: { core: '#c8c8d0', glow: '#e8e8f0', hot: '#ffffff', dark: '#5a5a66' }, shape: 'shard', size: [2, 4] });
    k.sombra(g.sprite, { x: 0, y: 0 }, '#8a8a99', 0, 420);
    void k.agitar(g.sprite, 2, 200);
    await k.esperar(200);
    await k.estado();
  },

  // Doble Equipo: el usuario parpadea y deja copias de sí mismo en corro a su alrededor, una tras otra, en dos vueltas.
  async doubleteam(k) {
    const u = k.user, p0 = k.posSprite(u), n = 6, r = u.size * 0.75;
    void k.animar(u.sprite, [{ opacity: 1 }, { opacity: 0.3, offset: 0.15 }, { opacity: 1, offset: 0.3 }, { opacity: 0.3, offset: 0.45 }, { opacity: 1, offset: 0.6 }, { opacity: 0.4, offset: 0.75 }, { opacity: 1 }], 600);
    for (let vuelta = 0; vuelta < 2; vuelta++) for (let i = 0; i < n; i++) {
      const a = i / n * TAU + vuelta * Math.PI / n, d = r * (vuelta ? 1.15 : 0.8), off = { x: Math.cos(a) * d, y: Math.sin(a) * d * 0.55 }, ret = vuelta * 200 + i * 35;
      k.sombra(u.sprite, off, vuelta ? '#d8e8ff' : '#ffffff', ret, 420);
      k.emit({ x: p0.x + off.x, y: p0.y + off.y, vx: -Math.sin(a) * 160, vy: Math.cos(a) * 90, drag: 4, life: 260, delay: ret, size: 2, color: '#ffffff', shape: 'streak', stretch: 50 });
    }
    k.add(E.ring({ at: pies(k, u), from: r * 0.3, to: r * 1.3, width: 2.5, color: '#d8e8ff', duration: 420, squash: 0.4 }));
    await k.esperar(520);
    await k.estado();
  },

  // Otra Vez: un foco cae sobre el objetivo y dos manos aplauden encima de él pidiendo bis; el objetivo baila al compás.
  async encore(k) {
    const g = blanco(k), ms = 620, palmas = 3;
    k.add(E.spotlight({ at: k.posSprite(g), palette: ORO, duration: ms + 200 }));
    k.dibujar(ms, (c, t) => {
      const p = encima(k, g, 0.25), ab = Math.abs(Math.cos(Math.PI * ((t * palmas) % 1))), gap = g.size * (0.07 + 0.28 * ab), tam = g.size * 0.26;
      c.globalAlpha = env(t, 0.1, 0.15);
      forma(c, 'mano', p.x - gap, p.y, tam, -Math.PI / 2 + 0.25 * ab, MANO);
      forma(c, 'mano', p.x + gap, p.y, tam, -Math.PI / 2 - 0.25 * ab, MANO, true);
    }, { z: 1 });
    for (let j = 0; j < palmas; j++) {
      const d = (j + 0.5) / palmas * ms, p = encima(k, g, 0.25);
      k.add(E.ring({ at: p, from: 4, to: g.size * 0.45, width: 2.5, color: ORO.glow, duration: 220, delay: d }));
      k.burst(5, () => ({ x: p.x, y: p.y, vx: rand(-120, 120), vy: rand(-120, 20), drag: 3, life: 300, delay: d, size: rand(2.5, 4), color: pick([ORO.core, '#ffffff']), shape: 'star', spin: rand(-8, 8) }));
    }
    void k.animar(g.sprite, [tf(), tf(0, -6, 1, 1, -8, 0.17), tf(0, 0, 1, 1, 0, 0.33), tf(0, -6, 1, 1, 8, 0.5), tf(0, 0, 1, 1, 0, 0.67), tf(0, -6, 1, 1, -8, 0.83), tf()], ms);
    await k.esperar(ms * 0.85);
    await k.estado();
  },

  // Aguante: el usuario se planta y aprieta: tiembla agachado con un aura roja que sube, grietas bajo sus pies y una
  // vena de rabia latiendo junto a la cabeza.
  async endure(k) {
    const u = k.user, p0 = k.posSprite(u), ms = 560;
    const fr: Keyframe[] = [tf(), tf(0, 3, 1.1, 0.88, 0, 0.15)];
    for (let i = 1; i <= 8; i++) fr.push(tf(i % 2 ? 2 : -2, 3, 1.1, 0.88, 0, 0.15 + i * 0.08));
    fr.push(tf());
    void k.animar(u.sprite, fr, ms + 120);
    k.add(E.cracks({ at: pies(k, u), length: u.size * 0.55, color: '#5a3a1a', duration: 700 }));
    E.dust(k.stage, pies(k, u), u.size * 0.8);
    k.dibujar(ms, (c, t) => {
      const p = k.posSprite(u);
      if (Math.random() < 0.7) { const a = rand(0, TAU); k.emit({ x: p.x + Math.cos(a) * u.size * 0.38, y: p.y + Math.sin(a) * u.size * 0.3 + u.size * 0.05, vx: rand(-15, 15), vy: -rand(80, 150), life: 320, size: rand(5, 9), sizeEnd: 1, color: pick(['#ff3a2a', '#ff7a3a', '#ffb070']), alpha: 0.8, shape: 'glow' }); }
      c.globalAlpha = env(t, 0.1, 0.2);
      venas(c, p.x + u.size * 0.3, p.y - u.size * 0.38, u.size * 0.13 * (1 + 0.25 * Math.abs(Math.sin(t * Math.PI * 5))));
    }, { z: 1 });
    for (let i = 0; i < 3; i++) k.sombra(u.sprite, { x: 0, y: 0 }, '#ff4a2a', 120 + i * 140, 220);
    await k.esperar(ms - 60);
    k.add(E.ring({ at: p0, from: u.size * 0.3, to: u.size, width: 4, color: '#ff6a4a', duration: 320 }));
    await k.estado();
  },

  // Foco Energía: el aire se recoge hacia el usuario en rayas que convergen y un aro que se cierra; luego estalla una
  // columna de luz de concentración y le brilla un destello en la cara.
  async focusenergy(k) {
    const u = k.user, p0 = k.posSprite(u);
    k.burst(22, i => {
      const a = i / 22 * TAU + rand(-0.1, 0.1), R = u.size * rand(0.9, 1.2), v = R / 0.28;
      return { x: p0.x + Math.cos(a) * R, y: p0.y + Math.sin(a) * R * 0.7, vx: -Math.cos(a) * v, vy: -Math.sin(a) * v * 0.7, life: 260, delay: (i % 4) * 25, size: 2, color: pick(['#ffffff', SUBE.glow]), shape: 'streak', stretch: 50, fadeIn: 0.3 };
    });
    k.add(E.ring({ at: p0, from: u.size * 1.1, to: u.size * 0.25, width: 3, color: '#ffffff', duration: 300 }));
    void k.animar(u.sprite, [tf(), tf(0, 2, 1.08, 0.9, 0, 0.45), tf(0, -4, 0.94, 1.12, 0, 0.65), tf()], 600);
    await k.esperar(300);
    k.dibujar(380, (c, t) => {
      const p = k.posSprite(u), h = u.size * 1.1, w = u.size * 0.55 * (1 - 0.3 * t);
      c.globalAlpha = env(t, 0.1, 0.4);
      const gr = c.createLinearGradient(p.x, p.y + u.size * 0.3, p.x, p.y - h);
      gr.addColorStop(0, withAlpha(SUBE.core, 0.4)); gr.addColorStop(1, withAlpha(SUBE.glow, 0));
      c.fillStyle = gr; c.beginPath(); c.ellipse(p.x, p.y - h * 0.2, w, h * 0.6, 0, 0, TAU); c.fill();
      for (let i = 0; i < 2; i++) k.emit({ x: p.x + rand(-w, w) * 0.7, y: p.y + u.size * 0.25, vy: -rand(220, 360), life: 260, size: rand(2, 3), color: pick([SUBE.glow, '#ffffff', SUBE.core]), shape: 'streak', stretch: 40 });
    }, { z: 0 });
    const ojo = cabeza(k, u);
    figura(k, 'estrella', 280, { base: '#ffffff', borde: '#c88a20', brillo: '#fff0b0', brilloTam: 10 }, t => ({ x: ojo.x + u.size * 0.15, y: ojo.y - u.size * 0.05, tam: u.size * 0.12 * Math.sin(Math.PI * t), ang: t * 2 }), { delay: 60 });
    await k.esperar(160);
    await k.estado();
  },

  // Señuelo: un foco ilumina al usuario, que da saltitos saludando con la mano; flechas desde todos lados le señalan.
  async followme(k) {
    const u = k.user, p0 = k.posSprite(u);
    k.add(E.spotlight({ at: p0, palette: ORO, duration: 760 }));
    void k.animar(u.sprite, [tf(), tf(0, -u.size * 0.12, 0.95, 1.06, 0, 0.25), tf(0, 0, 1.06, 0.94, 0, 0.5), tf(0, -u.size * 0.12, 0.95, 1.06, 0, 0.75), tf()], 520);
    figura(k, 'mano', 560, MANO, t => ({ x: p0.x + u.size * 0.42, y: p0.y - u.size * 0.45, tam: u.size * 0.2, ang: -Math.PI / 2 + 0.45 * Math.sin(t * TAU * 2.5), a: env(t, 0.1, 0.2) }));
    for (let ola = 0; ola < 2; ola++) for (let i = 0; i < 8; i++) {
      const a = (i + ola * 0.5) / 8 * TAU, R = u.size * 1.25, from = { x: p0.x + Math.cos(a) * R, y: p0.y + Math.sin(a) * R * 0.7 };
      const hacia = Math.atan2(p0.y - from.y, p0.x - from.x), v = (Math.hypot(p0.x - from.x, p0.y - from.y) - u.size * 0.55) / 0.34;
      k.emit({ x: from.x, y: from.y, vx: Math.cos(hacia) * v, vy: Math.sin(hacia) * v, life: 340, delay: ola * 170, size: u.size * 0.08, color: i % 2 ? '#ffffff' : ORO.core, fadeIn: 0.2, shape: 'chevron', rot: hacia + Math.PI / 2 });
    }
    await k.esperar(500);
    await k.estado();
  },

  // Gruñido: el usuario se inclina y suelta ondas graves, gruesas y onduladas, con notas oscuras que tiemblan hasta el
  // objetivo, que se encoge.
  async growl(k) {
    const g = blanco(k), u = k.user;
    await k.anticipar(80);
    void k.animar(u.sprite, [tf(), tf(k.dir.x * 4, k.dir.y * 4, 1.06, 0.95, 0, 0.2), tf(k.dir.x * 5, k.dir.y * 5 + 1, 1.06, 0.95, 0, 0.5), tf(k.dir.x * 4, k.dir.y * 4, 1.06, 0.95, 0, 0.8), tf()], 420);
    const largo = k.hayObjetivo ? k.dist * 0.85 : u.size * 1.4;
    ondas(k, boca(k), k.angle, largo, { n: 3, cada: 110, ms: 420, color: '#a8642a', claro: '#ffd8a8', grosor: u.size * 0.09, abre: 0.9, tipo: 'ondulado', amp: u.size * 0.04 });
    for (let i = 0; i < 3; i++) figura(k, 'nota', 440, { base: '#6a3a1a', claro: '#9a6a3a', borde: '#fff0d8' }, t => {
      const p = k.punto(0.15 + 0.75 * easeOut(t), (i - 1) * k.s(0.3) + Math.sin(t * 25) * 4);
      return { x: p.x, y: p.y - k.s(0.2), tam: u.size * 0.14, ang: 0.2 * Math.sin(t * 30), a: env(t, 0.1, 0.3) };
    }, { delay: i * 90 });
    await k.esperar(380);
    void k.animar(g.sprite, [tf(), tf(k.dir.x * 5, k.dir.y * 5 + 2, 0.94, 0.9, 0, 0.4), tf()], 280);
    await k.estado();
  },

  // Desarrollo: brotan tallos con hojas alrededor de los pies del usuario, un rayo de sol le baña y crece de golpe.
  async growth(k) {
    const u = k.user, base = pies(k, u), n = 5, ms = 640, VERDE = TYPE_FX.Grass;
    k.add(E.sunbeam({ at: k.posSprite(u), palette: VERDE, duration: ms, width: u.size * 1.1 }));
    const tallos = Array.from({ length: n }, (_, i) => ({ x: (i - (n - 1) / 2) * u.size * 0.24 + rand(-4, 4), h: u.size * rand(0.35, 0.6), curva: rand(-0.4, 0.4), d: i % 2 ? 70 : 0 }));
    const hoja: EstiloForma = { base: '#6ad84a', claro: '#b8f08a', borde: VERDE.dark };
    k.dibujar(ms, (c, t) => {
      c.globalAlpha = env(t, 0.05, 0.25);
      c.lineCap = 'round';
      for (const s of tallos) {
        const cr = easeOutCubic(Math.min(1, Math.max(0, (t * ms - s.d) / 320)));
        if (cr <= 0) continue;
        const x0 = base.x + s.x, y0 = base.y + 2, h = s.h * cr, px = x0 + s.curva * h, py = y0 - h;
        c.beginPath(); c.moveTo(x0, y0); c.quadraticCurveTo(x0, y0 - h * 0.6, px, py);
        c.strokeStyle = VERDE.dark; c.lineWidth = 4; c.stroke();
        c.strokeStyle = '#5ac83a'; c.lineWidth = 2.2; c.stroke();
        const tam = u.size * 0.1 * cr, hx = lerp(x0, px, 0.7), hy = lerp(y0, py, 0.7);
        forma(c, 'hoja', hx + Math.cos(-Math.PI * 0.8) * tam, hy + Math.sin(-Math.PI * 0.8) * tam, tam, -Math.PI * 0.8, hoja);
        forma(c, 'hoja', px + Math.cos(-Math.PI * 0.25) * tam, py + Math.sin(-Math.PI * 0.25) * tam, tam, -Math.PI * 0.25, hoja);
      }
    }, { z: 1 });
    k.burst(14, i => ({ x: base.x + rand(-u.size * 0.5, u.size * 0.5), y: base.y - rand(0, u.size * 0.3), vy: -rand(50, 110), vx: rand(-15, 15), life: 520, delay: 100 + i * 20, size: rand(2, 3.5), color: pick([VERDE.glow, VERDE.hot, '#ffe08a']), shape: 'glow', fadeIn: 0.2 }));
    void k.animar(u.sprite, [tf(), tf(0, 0, 1, 1, 0, 0.35), tf(0, 0, 1.2, 1.2, 0, 0.6), tf(0, 0, 1.12, 1.12, 0, 0.8), tf()], ms + 120);
    await k.esperar(420);
    k.add(E.ring({ at: base, from: u.size * 0.2, to: u.size * 0.9, width: 3, color: VERDE.glow, duration: 360, squash: 0.35 }));
    await k.esperar(80);
    await k.estado();
  },

  // Fortaleza: el cuerpo se vuelve de metal: una coraza gris se ciñe a él, un brillo la recorre en diagonal y suena
  // un "ting" de estrella.
  async harden(k) {
    const u = k.user, p0 = k.posSprite(u), rx = u.size * 0.42, ry = u.size * 0.48, ms = 560;
    void k.animar(u.sprite, [tf(), tf(0, 0, 1.06, 1.06, 0, 0.3), tf(0, 0, 0.98, 0.98, 0, 0.5), tf()], 420);
    k.sombra(u.sprite, { x: 0, y: 0 }, '#9aa8b8', 150, 420);
    k.sombra(u.sprite, { x: 0, y: 0 }, '#dfe8f0', 320, 260);
    k.dibujar(ms, (c, t) => {
      const p = k.posSprite(u), ci = 1.35 - 0.35 * easeOutCubic(Math.min(1, t / 0.3));
      c.globalAlpha = env(t, 0.1, 0.3);
      c.save(); c.translate(p.x, p.y);
      c.beginPath(); c.ellipse(0, 0, rx * ci, ry * ci, 0, 0, TAU);
      const gr = c.createLinearGradient(-rx, -ry, rx, ry);
      gr.addColorStop(0, 'rgba(230,238,246,0.35)'); gr.addColorStop(0.5, 'rgba(140,156,172,0.22)'); gr.addColorStop(1, 'rgba(70,84,100,0.4)');
      c.fillStyle = gr; c.fill();
      c.lineWidth = 3; c.strokeStyle = '#5a6a7a'; c.stroke(); c.lineWidth = 1.2; c.strokeStyle = '#eef4fa'; c.stroke();
      c.save(); c.clip();
      c.strokeStyle = 'rgba(90,106,122,0.5)'; c.lineWidth = 1.5;
      for (const f of [-0.35, 0.35]) { c.beginPath(); c.ellipse(0, ry * f * ci, rx * ci, ry * 0.25 * ci, 0, 0, Math.PI); c.stroke(); }
      c.rotate(-0.6);
      const sx = lerp(-rx * 1.8, rx * 1.8, Math.min(1, Math.max(0, (t - 0.25) / 0.45)));
      const band = c.createLinearGradient(sx - rx * 0.3, 0, sx + rx * 0.3, 0);
      band.addColorStop(0, 'rgba(255,255,255,0)'); band.addColorStop(0.5, 'rgba(255,255,255,0.85)'); band.addColorStop(1, 'rgba(255,255,255,0)');
      c.fillStyle = band; c.fillRect(sx - rx * 0.3, -ry * 2, rx * 0.6, ry * 4);
      c.restore();
      c.restore();
    }, { z: 1 });
    await k.esperar(380);
    const brillo = { x: p0.x + rx * 0.55, y: p0.y - ry * 0.55 };
    figura(k, 'estrella', 280, { base: '#ffffff', borde: '#8aa0b4', brillo: '#cfe6ff', brilloTam: 10 }, t => ({ x: brillo.x, y: brillo.y, tam: u.size * 0.16 * Math.sin(Math.PI * t), ang: t * 1.5 }));
    E.sparks(k.fx, brillo, { count: 8, speed: [60, 160], palette: TYPE_FX.Steel, shape: 'streak', size: [1.5, 2.5] });
    await k.esperar(100);
    await k.estado();
  },

  // Cascabel Cura: una campana dorada se balancea sobre el usuario; cada tañido suelta una onda clara y notas, y cae
  // polvo de luz verde que cura.
  async healbell(k) {
    const u = k.user, ms = 620, p0 = k.posSprite(u);
    k.dibujar(ms, (c, t) => {
      const p = k.posSprite(u);
      c.globalAlpha = env(t, 0.1, 0.2);
      cascabel(c, p.x, p.y - u.size * 1.0, u.size * 0.3, 0.55 * Math.sin(t * TAU * 2) * env(t, 0.1, 0.1));
    }, { z: 1 });
    const b = { x: p0.x, y: p0.y - u.size * 0.65 };
    [0.125, 0.375, 0.625, 0.875].forEach((f, j) => {
      const d = f * ms, lado = j % 2 ? 1 : -1;
      k.add(E.ring({ at: b, from: u.size * 0.2, to: u.size * 1.0, width: 3, color: '#9af0e0', duration: 380, squash: 0.85, delay: d }));
      figura(k, 'nota', 520, { base: pick(['#7ad8ff', '#9af0b0', '#ffd27a']), borde: '#1e3a4a' }, t => ({
        x: b.x + lado * u.size * (0.3 + 0.6 * t), y: b.y - u.size * (0.2 + 0.4 * t) + Math.sin(t * 12) * 3, tam: u.size * 0.12, ang: lado * 0.2, a: env(t, 0.1, 0.35),
      }), { delay: d });
    });
    k.burst(18, i => ({ x: p0.x + rand(-u.size * 0.5, u.size * 0.5), y: p0.y - u.size * rand(0.5, 0.9), vy: rand(30, 70), life: 600, delay: 150 + i * 20, size: rand(2, 3.5), color: pick([CURA.core, CURA.glow, '#ffffff']), shape: 'star', fadeIn: 0.2, spin: rand(-4, 4) }));
    await k.esperar(520);
    k.add(E.bloom({ at: p0, radius: u.size * 0.7, color: CURA.glow, duration: 360 }));
    await k.estado();
  },

  // Refuerzo: dos manos chocan los cinco a medio camino entre el usuario y su aliado; del choque sale un estallido de
  // energía que vuela hasta el aliado y le enciende.
  async helpinghand(k) {
    const g = blanco(k), u = k.user, tam = u.size * 0.24;
    const medio = k.hayObjetivo ? k.punto(0.5) : k.posSprite(u), m = { x: medio.x, y: medio.y - u.size * 0.55 };
    k.dibujar(520, (c, t) => {
      const T = t * 520, gap = u.size * (0.9 - 0.78 * easeIn(Math.min(1, T / 300))), rebote = T > 300 ? Math.sin(Math.min(1, (T - 300) / 120) * Math.PI) * u.size * 0.06 : 0;
      c.globalAlpha = env(t, 0.1, 0.25);
      forma(c, 'mano', m.x - gap - rebote, m.y, tam, -Math.PI / 2 + 0.45, MANO);
      forma(c, 'mano', m.x + gap + rebote, m.y, tam, -Math.PI / 2 - 0.45, MANO, true);
    }, { z: 1 });
    await k.esperar(300);
    k.add(E.starburst({ at: m, rays: 10, length: u.size * 0.7, width: 3, palette: ORO, duration: 320 }));
    k.add(E.ring({ at: m, from: 4, to: u.size * 0.6, width: 3, color: ORO.glow, duration: 280 }));
    E.sparks(k.fx, m, { count: 10, speed: [80, 220], palette: ORO, shape: 'star', size: [2.5, 4.5] });
    const destino = k.posSprite(g);
    k.burst(10, i => ({ x: m.x, y: m.y, vx: (destino.x - m.x) / 0.26, vy: (destino.y - m.y) / 0.26, life: 260, delay: i * 14, size: rand(4, 6), sizeEnd: 2, color: pick([SUBE.core, SUBE.glow]), shape: 'glow' }));
    await k.esperar(220);
    k.add(E.bloom({ at: destino, radius: g.size * 0.7, color: SUBE.glow, duration: 320 }));
    k.sombra(g.sprite, { x: 0, y: 0 }, SUBE.core, 0, 300);
    await k.estado();
  },

  // Aullido: el usuario alza la cabeza y aúlla al cielo: ondas que suben y una luna que asoma por encima.
  async howl(k) {
    const u = k.user, p0 = k.posSprite(u);
    void k.animar(u.sprite, [tf(), tf(0, -4, 0.94, 1.1, -8, 0.3), tf(0, -4, 0.94, 1.1, -8, 0.8), tf()], 600);
    figura(k, 'luna', 720, { base: '#fff2c0', claro: '#fffbe8', borde: '#b89a4a', brillo: '#ffe8a0', brilloTam: 16 }, t => ({ x: p0.x + u.size * 0.2, y: p0.y - u.size * 1.35 - 6 * t, tam: u.size * 0.3, ang: -0.4, a: env(t, 0.25, 0.3) * 0.9 }), { z: 0 });
    ondas(k, { x: p0.x, y: p0.y - u.size * 0.35 }, -Math.PI / 2, u.size * 1.1, { n: 4, cada: 100, ms: 460, color: '#ffb84a', claro: '#fff4d8', grosor: u.size * 0.06, abre: 1.4, r0: 4 });
    await k.esperar(480);
    await k.estado();
  },

  // Malicioso: dos ojos rojos se entornan sobre la cara del usuario, destellan y lanzan una mirada afilada (dos rayas
  // rojas) al objetivo, que tirita.
  async leer(k) {
    const u = k.user, g = blanco(k), ms = 540;
    k.dibujar(ms, (c, t) => {
      const p = cabeza(k, u), ab = Math.min(1, t / 0.25) * 0.55 * (t > 0.85 ? (1 - t) / 0.15 : 1);
      for (const lado of [-1, 1]) {
        c.save(); c.translate(p.x + lado * u.size * 0.15, p.y); c.rotate(-lado * 0.3); c.scale(1, Math.max(0.05, ab));
        forma(c, 'ojo', 0, 0, u.size * 0.13, 0, { base: '#e01a1a', borde: '#3a0000', brillo: '#ff3030', brilloTam: 8 });
        c.restore();
      }
    }, { z: 1 });
    await k.esperar(170);
    for (const lado of [-1, 1]) {
      const a = cabeza(k, u), from = { x: a.x + lado * u.size * 0.15, y: a.y };
      k.emit({ x: from.x, y: from.y, life: 240, size: u.size * 0.12, color: '#ffffff', shape: 'star', spin: 4 });
      if (k.hayObjetivo) k.dibujar(260, (c, t) => {
        const to = cabeza(k, g), h = easeOutCubic(Math.min(1, t / 0.5)), cola0 = Math.max(0, (t - 0.5) / 0.5);
        c.lineCap = 'round';
        c.beginPath(); c.moveTo(lerp(from.x, to.x, cola0), lerp(from.y, to.y, cola0)); c.lineTo(lerp(from.x, to.x, h), lerp(from.y, to.y, h));
        c.strokeStyle = '#e01a1a'; c.lineWidth = 3.5; c.stroke(); c.strokeStyle = '#ffd0d0'; c.lineWidth = 1.2; c.stroke();
      }, { z: 1 });
    }
    await k.esperar(160);
    void k.agitar(g.sprite, 2, 260);
    k.sombra(g.sprite, { x: 0, y: 0 }, BAJA.core, 0, 260);
    await k.esperar(80);
    await k.estado();
  },

  // Fijar Blanco: una mira láser une al usuario con el objetivo y una mirilla roja gira y se cierra sobre él hasta
  // fijarlo; parpadea dos veces.
  async lockon(k) {
    const g = blanco(k), ms = 640;
    if (k.hayObjetivo) k.dibujar(ms, (c, t) => {
      const a = cabeza(k, k.user), b = k.posSprite(g);
      c.globalAlpha = env(t, 0.1, 0.2) * 0.8;
      c.setLineDash([6, 6]); c.lineDashOffset = -t * 80;
      c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(b.x, b.y); c.strokeStyle = '#ff3030'; c.lineWidth = 1.5; c.stroke();
    }, { z: 0 });
    k.dibujar(ms, (c, t) => {
      const p = k.posSprite(g), ci = easeOutCubic(Math.min(1, t / 0.55)), parpadeo = t > 0.6 ? (Math.floor((t - 0.6) / 0.07) % 2 ? 0.35 : 1) : 1;
      c.globalAlpha = env(t, 0.1, 0.1) * parpadeo;
      mira(c, p.x, p.y, g.size * lerp(1.3, 0.48, ci), (1 - ci) * 2.5, '#ff3030');
    }, { z: 1 });
    await k.esperar(ms * 0.55);
    k.add(E.ring({ at: k.posSprite(g), from: g.size * 0.45, to: g.size * 0.8, width: 2, color: '#ff6a6a', duration: 240 }));
    await k.esperar(ms * 0.25);
    await k.estado();
  },

  // Mal de Ojo: la vista se oscurece y un ojo enorme de pupila roja se abre sobre el objetivo y lo mira fijo; un aro de
  // cadenas se le cierra a los pies.
  async meanlook(k) {
    const g = blanco(k), ms = 700;
    k.add(E.dim({ at: k.posSprite(g), duration: ms + 150, strength: 0.55 }));
    k.dibujar(ms, (c, t) => {
      const p = k.posSprite(g), ab = t < 0.3 ? easeOutCubic(t / 0.3) : t > 0.85 ? 1 - (t - 0.85) / 0.15 : 1;
      c.save(); c.translate(p.x, p.y - g.size * 0.85); c.scale(1, Math.max(0.03, ab * 0.85));
      forma(c, 'ojo', 0, 0, g.size * 0.6, 0, { base: '#3a1050', borde: '#0a0010', brillo: '#a050ff', brilloTam: 18 });
      c.fillStyle = '#ff2a2a'; c.beginPath(); c.ellipse(0, 0, g.size * 0.04, g.size * 0.16, 0, 0, TAU); c.fill();
      c.restore();
      // Aro de eslabones que se cierra en el suelo.
      const f = pies(k, g), r = g.size * lerp(1.2, 0.6, easeOutCubic(Math.min(1, t / 0.5))), n = 18, L = r * TAU / n * 0.32;
      c.globalAlpha = env(t, 0.15, 0.2);
      for (let i = 0; i < n; i++) {
        const a = i / n * TAU + t, x = f.x + Math.cos(a) * r, y = f.y + Math.sin(a) * r * 0.4, tan = Math.atan2(Math.cos(a) * 0.4, -Math.sin(a));
        c.save(); c.translate(x, y); c.rotate(tan);
        c.beginPath(); c.ellipse(0, 0, L, i % 2 ? L * 0.45 : L * 0.2, 0, 0, TAU);
        c.strokeStyle = '#1a1020'; c.lineWidth = 4; c.stroke(); c.strokeStyle = '#9a8aaa'; c.lineWidth = 2; c.stroke();
        c.restore();
      }
    }, { z: 1 });
    await k.esperar(ms * 0.32);
    void k.agitar(g.sprite, 2, 320);
    k.sombra(g.sprite, { x: 0, y: 0 }, '#5a2a8a', 0, 380);
    await k.esperar(280);
    await k.estado();
  },

  // Metrónomo: un dedo índice oscila como un metrónomo sobre el usuario con un tic a cada lado; al final salta un "?"
  // y chispas de colores (un movimiento al azar).
  async metronome(k) {
    const u = k.user, ms = 560, R = u.size * 0.62;
    const base = (): Vec => { const p = k.posSprite(u); return { x: p.x, y: p.y - u.size * 0.55 }; };
    k.dibujar(ms + 200, (c, t) => {
      const T = t * (ms + 200), osc = T < ms ? Math.sin(T / ms * TAU * 1.5) : 0, b = base();
      c.globalAlpha = env(t, 0.08, 0.2);
      c.strokeStyle = 'rgba(255,255,255,0.6)'; c.lineWidth = 2; c.beginPath(); c.arc(b.x, b.y, R, -Math.PI / 2 - 0.65, -Math.PI / 2 + 0.65); c.stroke();
      dedo(c, b.x, b.y, u.size * 0.24, -Math.PI / 2 + osc * 0.6);
    }, { z: 1 });
    [1 / 6, 1 / 2, 5 / 6].forEach((f, i) => {
      const b = base(), a = -Math.PI / 2 + (i % 2 ? -0.6 : 0.6), q = { x: b.x + Math.cos(a) * R, y: b.y + Math.sin(a) * R };
      k.add(E.ring({ at: q, from: 2, to: u.size * 0.18, width: 2, color: '#ffffff', duration: 200, delay: f * ms }));
    });
    await k.esperar(ms);
    const q = { x: base().x + u.size * 0.32, y: base().y - u.size * 0.45 };
    k.dibujar(420, (c, t) => {
      const s = 1 + 0.4 * Math.sin(Math.min(1, t / 0.3) * Math.PI);
      c.globalAlpha = env(t, 0.05, 0.3);
      c.font = `bold ${Math.round(u.size * 0.38 * s)}px "Segoe UI", sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.lineWidth = 4; c.lineJoin = 'round'; c.strokeStyle = TINTA; c.strokeText('?', q.x, q.y);
      c.fillStyle = '#ffe066'; c.fillText('?', q.x, q.y);
    }, { z: 1 });
    k.burst(14, i => { const a = i / 14 * TAU; return { x: q.x, y: q.y, vx: Math.cos(a) * rand(90, 180), vy: Math.sin(a) * rand(90, 180), drag: 3, life: 420, size: rand(3, 4.5), color: ARCOIRIS[i % ARCOIRIS.length], shape: 'star', spin: rand(-8, 8) }; });
    await k.estado();
  },

  // Batido: una botella de leche aparece sobre el usuario, se inclina y le vierte un chorro de gotas blancas; brilla
  // verde al curarse.
  async milkdrink(k) {
    const u = k.user, ms = 640, tam = u.size * 0.22;
    k.dibujar(ms, (c, t) => {
      const p = k.posSprite(u), b = { x: p.x + u.size * 0.28, y: p.y - u.size * 0.85 }, a = -easeInOut(Math.min(1, t / 0.35)) * 2.1, nivel = 1 - 0.7 * Math.max(0, (t - 0.3) / 0.7);
      c.globalAlpha = env(t, 0.1, 0.2);
      botella(c, b.x, b.y, tam, a, nivel);
      if (t > 0.32 && t < 0.92) {
        const m = { x: b.x + 0.95 * tam * Math.sin(a), y: b.y - 0.95 * tam * Math.cos(a) };
        for (let i = 0; i < 2; i++) k.emit({ x: m.x, y: m.y, vx: rand(-50, -20), vy: rand(20, 60), ay: 900, life: 300, size: rand(2.5, 4), color: pick(['#ffffff', '#f0f4ff']), shape: 'drop', stretch: 25 });
      }
    }, { z: 1 });
    await k.esperar(ms * 0.5);
    const p0 = k.posSprite(u);
    k.burst(12, i => ({ x: p0.x + rand(-u.size * 0.4, u.size * 0.4), y: p0.y + rand(-u.size * 0.2, u.size * 0.3), vy: -rand(40, 90), life: 480, delay: i * 18, size: rand(2.5, 4), color: pick([CURA.core, CURA.glow, '#ffffff']), shape: 'star', spin: rand(-4, 4) }));
    await k.esperar(ms * 0.38);
    k.add(E.bloom({ at: p0, radius: u.size * 0.75, color: CURA.glow, duration: 360 }));
    k.add(E.ring({ at: p0, from: 6, to: u.size * 0.7, width: 3, color: CURA.core, duration: 320 }));
    await k.estado();
  },

  // Mimético: una línea de escáner recorre al objetivo y copias fantasma de él vuelan hasta el usuario, que las absorbe
  // con un destello.
  async mimic(k) {
    const g = blanco(k), u = k.user;
    k.dibujar(240, (c, t) => {
      const p = k.posSprite(g), y = lerp(p.y - g.size * 0.45, p.y + g.size * 0.32, easeInOut(t)), w = g.size * 0.5;
      c.globalAlpha = env(t, 0.1, 0.15);
      const gr = c.createLinearGradient(0, y - 6, 0, y + 6);
      gr.addColorStop(0, 'rgba(120,220,255,0)'); gr.addColorStop(0.5, 'rgba(160,235,255,0.9)'); gr.addColorStop(1, 'rgba(120,220,255,0)');
      c.fillStyle = gr; c.fillRect(p.x - w, y - 6, w * 2, 12);
      c.strokeStyle = '#ffffff'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(p.x - w, y); c.lineTo(p.x + w, y); c.stroke();
    }, { z: 1 });
    await k.esperar(220);
    if (k.hayObjetivo) {
      const v = { x: u.center.x - g.center.x, y: u.center.y - g.center.y };
      for (let i = 0; i < 5; i++) { const f = (i + 1) / 6; k.sombra(g.sprite, { x: v.x * f, y: v.y * f }, '#bfe0ff', i * 55, 280); }
      k.burst(12, i => { const a = k.posSprite(g), b = k.posSprite(u); return { x: a.x, y: a.y, vx: (b.x - a.x) / 0.3, vy: (b.y - a.y) / 0.3, life: 300, delay: i * 18, size: rand(2.5, 4), sizeEnd: 1.5, color: pick(['#bfe0ff', '#ffffff']), shape: 'glow' }; });
    }
    await k.esperar(300);
    k.destello(u.sprite);
    k.add(E.ring({ at: k.posSprite(u), from: u.size * 0.7, to: u.size * 0.2, width: 3, color: '#a8e0ff', duration: 260 }));
    E.sparks(k.fx, k.posSprite(u), { count: 10, speed: [60, 160], palette: TYPE_FX.Ice, shape: 'star', size: [2.5, 4] });
    await k.estado();
  },

  // Reducción: el usuario se encoge de golpe hasta ser diminuto dejando copias de su tamaño que se desvanecen y aros
  // que se cierran; un "pop" de estrellitas.
  async minimize(k) {
    const u = k.user, p0 = k.posSprite(u);
    k.sombra(u.sprite, { x: 0, y: 0 }, '#ffffff', 0, 360);
    k.sombra(u.sprite, { x: 0, y: 0 }, '#d8e8ff', 90, 320);
    void k.animar(u.sprite, [tf(), tf(0, 0, 1.1, 1.1, 0, 0.12), tf(0, 0, 0.32, 0.32, 0, 0.35), tf(0, 0, 0.36, 0.36, 0, 0.78), tf()], 900);
    for (let i = 0; i < 3; i++) k.add(E.ring({ at: p0, from: u.size * 0.8, to: u.size * 0.1, width: 2.5, color: '#d8e8ff', duration: 260, delay: i * 70 }));
    await k.esperar(320);
    const f = pies(k, u);
    k.burst(10, i => { const a = -Math.PI * (i / 9); return { x: f.x, y: f.y - 4, vx: Math.cos(a) * rand(60, 130), vy: Math.sin(a) * rand(60, 130), drag: 3, life: 320, size: rand(2, 3.5), color: pick(['#ffffff', '#ffe08a']), shape: 'star', spin: 6 }; });
    await k.esperar(60);
    await k.estado();
  },

  // Rugido de Guerra: tras el usuario se despliega una melena dorada de puntas, como la de un león, y ruge ondas
  // doradas que hacen encogerse al objetivo.
  async nobleroar(k) {
    const u = k.user, g = blanco(k);
    void k.animar(u.sprite, [tf(), tf(-k.dir.x * 6, -k.dir.y * 6 - 3, 0.95, 1.1, 0, 0.3), tf(k.dir.x * 4, k.dir.y * 4, 1.08, 0.95, 0, 0.5), tf(k.dir.x * 4, k.dir.y * 4, 1.08, 0.95, 0, 0.8), tf()], 640);
    k.dibujar(700, (c, t) => {
      const p = k.posSprite(u), cy = p.y - u.size * 0.1, R = u.size * (0.45 + 0.28 * easeOutCubic(Math.min(1, t / 0.35))), n = 14;
      c.globalAlpha = env(t, 0.1, 0.3) * 0.9;
      c.beginPath();
      for (let i = 0; i <= n * 2; i++) {
        const a = i / (n * 2) * TAU + t * 0.8, r = i % 2 ? R * 0.62 : R * (1 + 0.08 * Math.sin(i * 1.7)), x = p.x + Math.cos(a) * r, y = cy + Math.sin(a) * r;
        if (i) c.lineTo(x, y); else c.moveTo(x, y);
      }
      c.closePath();
      const gr = c.createRadialGradient(p.x, cy, 0, p.x, cy, R);
      gr.addColorStop(0, 'rgba(255,200,60,0)'); gr.addColorStop(0.55, 'rgba(255,200,60,0)'); gr.addColorStop(0.7, 'rgba(255,190,50,0.7)'); gr.addColorStop(1, 'rgba(255,232,140,0.95)');
      c.fillStyle = gr; c.fill(); c.lineJoin = 'round'; c.lineWidth = 2; c.strokeStyle = '#b07a10'; c.stroke();
    }, { z: 0 });
    await k.esperar(200);
    ondas(k, boca(k), k.angle, k.hayObjetivo ? k.dist * 0.85 : u.size * 1.5, { n: 3, cada: 90, ms: 380, color: '#e0a020', claro: '#fff4c0', grosor: u.size * 0.1, abre: 1.0 });
    k.burst(10, () => { const p = boca(k), v = rand(300, 480), a = k.angle + rand(-0.4, 0.4); return { x: p.x, y: p.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, drag: 2, life: 320, size: rand(2.5, 4), color: pick([ORO.core, ORO.glow]), shape: 'star', spin: 6 }; });
    await k.esperar(300);
    void k.animar(g.sprite, [tf(), tf(k.dir.x * 6, k.dir.y * 6 + 2, 0.9, 0.88, 0, 0.4), tf()], 320);
    k.sombra(g.sprite, { x: 0, y: 0 }, BAJA.core, 0, 260);
    await k.estado();
  },

  // Divide Dolor: entre los dos aparece un gran corazón, se agrieta por la mitad y cada mitad vuela a uno; los dos
  // destellan al repartirse la vida.
  async painsplit(k) {
    const g = blanco(k), u = k.user, a0 = k.posSprite(u), b0 = k.posSprite(g);
    const m0 = { x: (a0.x + b0.x) / 2, y: (a0.y + b0.y) / 2 - u.size * 0.6 }, tam = u.size * 0.42, aparece = 200, grieta = 120, vuela = 260, ms = aparece + grieta + vuela;
    const izqEsUsuario = a0.x <= b0.x;
    const est: EstiloForma = { base: '#ff5a7a', claro: '#ff9ab0', borde: '#5a0a1a' };
    k.dibujar(ms, (c, t) => {
      const T = t * ms;
      if (T < aparece + grieta) {
        const s = easeOutCubic(Math.min(1, T / aparece));
        c.globalAlpha = Math.min(1, T / 80);
        forma(c, 'corazon', m0.x, m0.y, tam * s, 0, { ...est, brillo: '#ff8aa8', brilloTam: 12 });
        if (T > aparece) {
          const f = (T - aparece) / grieta, n = 7, pts = Math.max(2, Math.ceil(n * f));
          c.beginPath();
          for (let i = 0; i < pts; i++) { const y = m0.y + tam * (-0.42 + 1.27 * i / (n - 1)), x = m0.x + (i % 2 ? 0.12 : -0.12) * tam; if (i) c.lineTo(x, y); else c.moveTo(x, y); }
          c.lineJoin = 'round'; c.strokeStyle = '#3a0010'; c.lineWidth = 3; c.stroke();
        }
      } else {
        const f = easeIn((T - aparece - grieta) / vuela);
        for (const lado of [-1, 1]) {
          const destino = (lado < 0) === izqEsUsuario ? k.posSprite(u) : k.posSprite(g);
          const x = lerp(m0.x + lado * tam * 0.15, destino.x, f), y = lerp(m0.y, destino.y, f), s = tam * (1 - 0.5 * f);
          c.save(); c.translate(x, y); c.rotate(lado * 0.5 * f);
          c.beginPath(); c.rect(lado < 0 ? -s * 1.2 : 0, -s * 1.2, s * 1.2, s * 2.4); c.clip();
          c.globalAlpha = 1 - f * 0.3;
          forma(c, 'corazon', 0, 0, s, 0, est);
          c.restore();
        }
      }
    }, { z: 1 });
    await k.esperar(ms);
    for (const q of k.hayObjetivo ? [u, g] : [u]) {
      k.add(E.bloom({ at: k.posSprite(q), radius: q.size * 0.6, color: ROSA.glow, duration: 320 }));
      k.destello(q.sprite);
    }
    await k.estado();
  },

  // Canto Mortal: la vista se oscurece y notas negras giran en espiral alrededor de los dos; sobre cada uno aparece una
  // calavera con la cuenta atrás (3).
  async perishsong(k) {
    const u = k.user, g = blanco(k), ms = 720;
    k.add(E.dim({ at: k.posSprite(u), duration: ms + 200, strength: 0.5 }));
    for (const q of k.hayObjetivo ? [u, g] : [u]) {
      for (let i = 0; i < 4; i++) figura(k, 'nota', ms, { base: '#2a1438', claro: '#5a3a6a', borde: '#d8c8ff' }, t => {
        const p = k.posSprite(q), a = i / 4 * TAU + t * 5, r = q.size * (0.75 - 0.2 * t);
        return { x: p.x + Math.cos(a) * r, y: p.y - q.size * 0.1 + Math.sin(a) * r * 0.55 - t * q.size * 0.3, tam: q.size * 0.13, ang: 0.2 * Math.sin(t * 20 + i), a: env(t, 0.15, 0.25) };
      });
      k.dibujar(ms - 150, (c, t) => {
        const p = encima(k, q, 0.3), s = easeOutCubic(Math.min(1, t / 0.3)), tam = q.size * 0.22 * s;
        c.globalAlpha = env(t, 0.15, 0.2);
        calavera(c, p.x, p.y + (1 - s) * 10, tam);
        c.font = `bold ${Math.round(q.size * 0.26)}px "Segoe UI", sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle';
        c.lineWidth = 4; c.lineJoin = 'round'; c.strokeStyle = '#2a1438'; c.strokeText('3', p.x + tam * 1.5, p.y);
        c.fillStyle = '#ffffff'; c.fillText('3', p.x + tam * 1.5, p.y);
      }, { z: 1, delay: 150 });
    }
    await k.esperar(560);
    await k.estado();
  },

  // Camaradería: el usuario da un saltito y le lanza un gran corazón rosa al objetivo, que estalla en corazoncitos y
  // le calma (se mece contento).
  async playnice(k) {
    const g = blanco(k), u = k.user, ms = 380;
    void k.saltar(u.sprite, u.size * 0.1, 260);
    figura(k, 'corazon', ms, { base: ROSA.core, claro: ROSA.glow, borde: ROSA.dark, brillo: ROSA.glow, brilloTam: 10 }, t => {
      const p = k.punto(0.1 + 0.85 * t);
      return { x: p.x, y: p.y - k.s(0.5) * Math.sin(Math.PI * t) - k.s(0.1), tam: u.size * (0.16 + 0.04 * Math.sin(t * 18)), ang: 0.3 * Math.sin(t * 10), a: env(t, 0.1, 0.05) };
    });
    await k.esperar(ms);
    const p = k.posSprite(g);
    k.burst(10, i => { const a = -Math.PI * (0.1 + 0.8 * i / 9); return { x: p.x, y: p.y - g.size * 0.1, vx: Math.cos(a) * rand(60, 130), vy: Math.sin(a) * rand(60, 130), drag: 2, life: 520, size: rand(4, 6), color: pick([ROSA.core, ROSA.glow]), shape: 'heart', rot: rand(-0.3, 0.3) }; });
    k.add(E.ring({ at: p, from: 6, to: g.size * 0.7, width: 3, color: ROSA.glow, duration: 320 }));
    void k.animar(g.sprite, vaiven(3, 6), 480);
    await k.esperar(120);
    await k.estado();
  },

  // Protección: el usuario se cubre y un gran escudo de luz salta delante de él dentro de la cúpula de hexágonos.
  async protect(k) {
    const u = k.user, p0 = k.posSprite(u), ms = 720;
    void k.animar(u.sprite, [tf(), tf(0, 2, 1.06, 0.92, 0, 0.3), tf()], 300);
    k.add(E.shield({ at: p0, rx: u.size * 0.72, ry: u.size * 0.66, palette: ESCUDO, duration: ms }));
    figura(k, 'escudo', ms, { base: ESCUDO.core, claro: ESCUDO.hot, borde: ESCUDO.dark, brillo: ESCUDO.glow, brilloTam: 14, alpha: 0.55 }, t => {
      const s = t < 0.2 ? 1.25 * easeOutCubic(t / 0.2) : t < 0.3 ? lerp(1.25, 1, (t - 0.2) / 0.1) : 1;
      return { x: p0.x, y: p0.y + u.size * 0.05, tam: u.size * 0.4 * s, a: env(t, 0.05, 0.25) };
    });
    await k.esperar(200);
    k.add(E.ring({ at: p0, from: u.size * 0.3, to: u.size * 0.85, width: 3, color: ESCUDO.hot, duration: 260 }));
    E.sparks(k.fx, p0, { count: 10, speed: [120, 220], palette: ESCUDO, shape: 'star', size: [2, 3.5] });
    await k.esperar(220);
    await k.estado();
  },

  // Autosugestión: anillos rosas se cierran sobre la cabeza del usuario mientras un hilo de chispas le trae los ánimos
  // del objetivo; acaba con un halo naranja girando sobre él.
  async psychup(k) {
    const u = k.user, g = blanco(k);
    for (let i = 0; i < 3; i++) k.add(E.ring({ at: cabeza(k, u), from: u.size * 0.9, to: u.size * 0.15, width: 2.5, color: '#ffb0d0', duration: 300, delay: i * 110, squash: 0.6 }));
    void k.animar(u.sprite, [tf(), tf(0, 1, 1.04, 0.96, 0, 0.5), tf()], 500);
    if (k.hayObjetivo) {
      const T = 0.34, ay = 600;
      k.burst(14, i => { const a = cabeza(k, g), b = cabeza(k, u); return { x: a.x, y: a.y, vx: (b.x - a.x) / T, vy: (b.y - a.y) / T - 0.5 * ay * T, ay, life: T * 1000, delay: i * 20, size: rand(3, 5), sizeEnd: 1.5, color: pick(['#ffb0d0', SUBE.glow, '#ffffff']), shape: 'glow', fadeIn: 0.2 }; });
    }
    await k.esperar(380);
    k.dibujar(420, (c, t) => {
      const p = encima(k, u, 0.12);
      c.globalAlpha = env(t, 0.15, 0.35);
      c.beginPath(); c.ellipse(p.x, p.y, u.size * 0.3, u.size * 0.09, 0, 0, TAU);
      c.strokeStyle = TINTA; c.lineWidth = 6; c.stroke(); c.strokeStyle = SUBE.core; c.lineWidth = 3.5; c.stroke(); c.strokeStyle = SUBE.hot; c.lineWidth = 1.2; c.stroke();
      for (let i = 0; i < 3; i++) { const a = t * 8 + i * TAU / 3; c.fillStyle = '#ffffff'; c.beginPath(); c.arc(p.x + Math.cos(a) * u.size * 0.3, p.y + Math.sin(a) * u.size * 0.09, 2.2, 0, TAU); c.fill(); }
    }, { z: 1 });
    k.sombra(u.sprite, { x: 0, y: 0 }, SUBE.core, 0, 300);
    await k.esperar(80);
    await k.estado();
  },

  // Recuperación: puntos de luz verde convergen en el usuario y forman una gran cruz verde que late y se funde en él.
  async recover(k) {
    const u = k.user, p0 = k.posSprite(u);
    k.burst(18, i => { const a = i / 18 * TAU, R = u.size * rand(0.8, 1.1), T = 0.3; return { x: p0.x + Math.cos(a) * R, y: p0.y + Math.sin(a) * R * 0.75, vx: -Math.cos(a) * R / T, vy: -Math.sin(a) * R * 0.75 / T, life: T * 1000, delay: (i % 3) * 40, size: rand(3, 5), sizeEnd: 1.5, color: pick([CURA.core, CURA.glow, '#ffffff']), shape: 'glow', fadeIn: 0.3 }; });
    k.dibujar(560, (c, t) => {
      const p = k.posSprite(u), s = t < 0.35 ? easeOutCubic(t / 0.35) : 1 + 0.12 * Math.sin((t - 0.35) * 30) * (1 - t), sube = t > 0.6 ? (t - 0.6) / 0.4 : 0;
      c.globalAlpha = env(t, 0.1, 0.35);
      cruz(c, p.x, p.y - u.size * 0.1 - sube * u.size * 0.2, u.size * 0.32 * s * (1 - 0.4 * sube));
    }, { delay: 150, z: 1 });
    await k.esperar(420);
    k.add(E.bloom({ at: p0, radius: u.size * 0.8, color: CURA.glow, duration: 380 }));
    k.burst(12, () => ({ x: p0.x + rand(-u.size * 0.4, u.size * 0.4), y: p0.y + rand(-u.size * 0.2, u.size * 0.3), vy: -rand(50, 110), life: 480, size: rand(2.5, 4), color: pick([CURA.core, '#ffffff']), shape: 'star', spin: rand(-4, 4) }));
    await k.esperar(100);
    await k.estado();
  },

  // Reciclaje: tres flechas verdes giran en círculo alrededor del usuario y de su centro brota una baya que vuelve a él.
  async recycle(k) {
    const u = k.user, ms = 640;
    k.dibujar(ms, (c, t) => {
      const p = k.posSprite(u), r = u.size * 0.55 * (0.6 + 0.4 * easeOutCubic(Math.min(1, t / 0.3)));
      c.globalAlpha = env(t, 0.1, 0.25);
      c.save(); c.translate(p.x, p.y); c.scale(1, 0.62); reciclaje(c, 0, 0, r, t * TAU * 1.2); c.restore();
    }, { z: 1 });
    k.dibujar(420, (c, t) => {
      const p = k.posSprite(u), s = t < 0.3 ? easeOutCubic(t / 0.3) * 1.2 : t < 0.45 ? lerp(1.2, 1, (t - 0.3) / 0.15) : 1, cae = t > 0.6 ? easeIn((t - 0.6) / 0.4) : 0;
      c.globalAlpha = t > 0.85 ? (1 - t) / 0.15 : 1;
      baya(c, p.x, p.y - u.size * 0.75 + cae * u.size * 0.6, u.size * 0.13 * s * (1 - 0.4 * cae));
    }, { delay: 220, z: 1 });
    await k.esperar(520);
    const p0 = k.posSprite(u);
    k.add(E.ring({ at: p0, from: 6, to: u.size * 0.6, width: 3, color: '#7ae08a', duration: 280 }));
    E.sparks(k.fx, p0, { count: 8, speed: [60, 150], palette: CURA, shape: 'star', size: [2.5, 4] });
    await k.esperar(60);
    await k.estado();
  },

  // Clonatipo: un prisma de cristal aparece entre los dos; la luz del objetivo entra en él y sale en un arcoíris que
  // tiñe al usuario de colores.
  async reflecttype(k) {
    const g = blanco(k), u = k.user, ms = 640;
    const pr = k.hayObjetivo ? k.punto(0.5) : { x: k.posSprite(u).x, y: k.posSprite(u).y - u.size * 0.85 }, R = u.size * 0.24;
    k.dibujar(ms, (c, t) => {
      const tp = k.posSprite(g), up = k.posSprite(u);
      c.globalAlpha = env(t, 0.1, 0.25);
      c.lineCap = 'round';
      const h1 = easeOutCubic(Math.min(1, t / 0.3));
      if (k.hayObjetivo) { c.strokeStyle = 'rgba(255,255,255,0.9)'; c.lineWidth = 4; c.beginPath(); c.moveTo(tp.x, tp.y); c.lineTo(lerp(tp.x, pr.x, h1), lerp(tp.y, pr.y, h1)); c.stroke(); }
      const h2 = easeOutCubic(Math.max(0, Math.min(1, (t - 0.3) / 0.3)));
      if (h2 > 0) ARCOIRIS.forEach((col, i) => {
        const off = (i - 2.5) * u.size * 0.05, fin = { x: up.x + k.perp.x * off, y: up.y + k.perp.y * off };
        c.strokeStyle = col; c.lineWidth = 3; c.beginPath(); c.moveTo(pr.x, pr.y); c.lineTo(lerp(pr.x, fin.x, h2), lerp(pr.y, fin.y, h2)); c.stroke();
      });
      c.save(); c.translate(pr.x, pr.y); c.rotate(Math.sin(t * 6) * 0.2);
      c.beginPath(); c.moveTo(0, -R); c.lineTo(R * 0.7, 0); c.lineTo(0, R); c.lineTo(-R * 0.7, 0); c.closePath();
      const gr = c.createLinearGradient(-R, -R, R, R); gr.addColorStop(0, 'rgba(255,255,255,0.9)'); gr.addColorStop(0.5, 'rgba(170,230,255,0.7)'); gr.addColorStop(1, 'rgba(220,200,255,0.85)');
      c.fillStyle = gr; c.fill(); c.lineJoin = 'round'; c.lineWidth = 2; c.strokeStyle = '#3a5a8a'; c.stroke();
      c.beginPath(); c.moveTo(0, -R); c.lineTo(0, R); c.moveTo(-R * 0.7, 0); c.lineTo(R * 0.7, 0); c.lineWidth = 1; c.strokeStyle = 'rgba(58,90,138,0.6)'; c.stroke();
      c.restore();
    }, { z: 1 });
    await k.esperar(ms * 0.6);
    ARCOIRIS.slice(0, 4).forEach((col, i) => k.sombra(u.sprite, { x: 0, y: 0 }, col, i * 50, 220));
    await k.esperar(140);
    await k.estado();
  },

  // Rugido: el usuario se echa atrás y ruge: enormes ondas de choque blancas y ráfagas de viento que tumban y arrastran
  // al objetivo lejos.
  async roar(k) {
    const u = k.user, g = blanco(k);
    void k.animar(u.sprite, [tf(), tf(-k.dir.x * 8, -k.dir.y * 8 - 2, 0.94, 1.1, 0, 0.3), tf(k.dir.x * 6, k.dir.y * 6, 1.12, 0.92, 0, 0.45), tf(k.dir.x * 6, k.dir.y * 6, 1.12, 0.92, 0, 0.8), tf()], 640);
    await k.esperar(170);
    ondas(k, boca(k), k.angle, k.hayObjetivo ? k.dist * 1.05 : u.size * 2, { n: 4, cada: 70, ms: 400, color: '#e8e4da', claro: '#ffffff', grosor: u.size * 0.16, abre: 1.3 });
    void k.stage.shake(8, 300);
    k.dibujar(380, () => {
      for (let i = 0; i < 3; i++) {
        const p = k.punto(rand(0.1, 0.9), rand(-k.s(0.6), k.s(0.6))), v = rand(500, 800);
        k.emit({ x: p.x, y: p.y, vx: k.dir.x * v, vy: k.dir.y * v, life: 200, size: 2, color: '#ffffff', alpha: 0.8, shape: 'streak', stretch: 40 });
      }
    }, { z: 1 });
    await k.esperar(250);
    if (k.hayObjetivo) {
      const lejos = k.s(0.9), giro = k.dir.x >= 0 ? 20 : -20;
      void k.animar(g.sprite, [tf(), tf(k.dir.x * lejos, k.dir.y * lejos, 0.9, 0.9, giro, 0.4), tf(k.dir.x * lejos, k.dir.y * lejos, 0.9, 0.9, giro, 0.6), tf()], 620);
      void k.animar(g.sprite, [{ opacity: 1 }, { opacity: 0.35, offset: 0.4 }, { opacity: 0.35, offset: 0.6 }, { opacity: 1 }], 620);
      E.dust(k.stage, pies(k, g), g.size);
    }
    await k.esperar(160);
    await k.estado();
  },

  // Velo Sagrado: una cúpula de luz lila se alza sobre el usuario desde el suelo, con destellos que caen como un velo.
  async safeguard(k) {
    const u = k.user, ms = 760;
    k.dibujar(ms, (c, t) => {
      const f = pies(k, u), rx = u.size * 0.85, ry = rx * 0.38, alto = u.size * 1.25 * easeOutCubic(Math.min(1, t / 0.4));
      c.globalAlpha = env(t, 0.05, 0.3);
      c.beginPath(); c.ellipse(f.x, f.y, rx, ry, 0, 0, TAU); c.fillStyle = 'rgba(200,170,255,0.25)'; c.fill(); c.strokeStyle = LILA.glow; c.lineWidth = 2; c.stroke();
      if (alto < 2) return;
      c.beginPath(); c.moveTo(f.x - rx, f.y); c.bezierCurveTo(f.x - rx, f.y - alto * 1.33, f.x + rx, f.y - alto * 1.33, f.x + rx, f.y); c.ellipse(f.x, f.y, rx, ry, 0, 0, Math.PI); c.closePath();
      const gr = c.createLinearGradient(0, f.y - alto, 0, f.y);
      gr.addColorStop(0, 'rgba(255,240,255,0.4)'); gr.addColorStop(1, 'rgba(190,150,255,0.15)');
      c.fillStyle = gr; c.fill();
      c.strokeStyle = LILA.hot; c.lineWidth = 2.5; c.stroke();
      c.beginPath(); c.moveTo(f.x - rx * 0.5, f.y + ry * 0.85); c.bezierCurveTo(f.x - rx * 0.5, f.y - alto * 1.2, f.x + rx * 0.5, f.y - alto * 1.2, f.x + rx * 0.5, f.y + ry * 0.85);
      c.moveTo(f.x, f.y + ry); c.lineTo(f.x, f.y - alto);
      c.strokeStyle = withAlpha(LILA.glow, 0.5); c.lineWidth = 1.5; c.stroke();
      if (Math.random() < 0.6) k.emit({ x: f.x + rand(-rx * 0.8, rx * 0.8), y: f.y - alto * rand(0.6, 0.95), vy: rand(40, 90), life: 420, size: rand(2, 3.5), color: pick([LILA.glow, '#ffffff', LILA.core]), shape: 'star', spin: rand(-4, 4) });
    }, { z: 1 });
    await k.esperar(320);
    k.add(E.ring({ at: pies(k, u), from: u.size * 0.3, to: u.size * 1.0, width: 3, color: LILA.glow, duration: 360, squash: 0.38 }));
    await k.esperar(160);
    await k.estado();
  },

  // Cara Susto: la vista se oscurece y una cara terrorífica (ojos rasgados de pupila roja y boca dentada) se abalanza
  // sobre el objetivo, que retrocede temblando y suda.
  async scaryface(k) {
    const g = blanco(k), u = k.user, ms = 640, ref = k.hayObjetivo ? g : u;
    k.add(E.dim({ at: k.posSprite(g), duration: ms + 100, strength: 0.5 }));
    void k.animar(u.sprite, [tf(), tf(0, -2, 1.12, 1.12, 0, 0.3), tf(0, -2, 1.12, 1.12, 0, 0.7), tf()], 520);
    k.dibujar(ms, (c, t) => {
      const a = cabeza(k, u), b = cabeza(k, g), q = k.hayObjetivo ? { x: lerp(a.x, b.x, 0.62), y: lerp(a.y, b.y, 0.62) - ref.size * 0.15 } : encima(k, u, 0.35);
      const cr = t < 0.3 ? 0.3 + 0.9 * easeOutCubic(t / 0.3) : 1.2 + 0.05 * Math.sin(t * 50), tiembla = t > 0.3 ? rand(-1.5, 1.5) : 0;
      c.globalAlpha = env(t, 0.08, 0.25);
      caraSusto(c, q.x + tiembla, q.y, ref.size * 0.55 * cr, Math.min(1, t / 0.3));
    }, { z: 1 });
    await k.esperar(ms * 0.3);
    if (k.hayObjetivo) {
      const fr: Keyframe[] = [tf(), tf(k.dir.x * 10, k.dir.y * 10, 0.95, 0.95, 0, 0.2)];
      for (let i = 1; i <= 6; i++) fr.push(tf(k.dir.x * 10 + (i % 2 ? 2 : -2), k.dir.y * 10, 0.95, 0.95, 0, 0.2 + i * 0.1));
      fr.push(tf());
      void k.animar(g.sprite, fr, 520);
      k.sombra(g.sprite, { x: 0, y: 0 }, '#5a2a8a', 0, 320);
      const p = cabeza(k, g);
      k.burst(4, i => ({ x: p.x + (i % 2 ? 1 : -1) * g.size * 0.3, y: p.y - g.size * 0.1, vx: (i % 2 ? 1 : -1) * rand(40, 80), vy: -rand(60, 120), ay: 500, life: 420, delay: i * 40, size: rand(3, 4.5), color: '#8ad0ff', shape: 'drop', stretch: 20 }));
    }
    await k.esperar(260);
    await k.estado();
  },

  // Chirrido: ondas en zigzag, agudas y rapidísimas, rojas y blancas; el objetivo tiembla con fuerza y saltan esquirlas
  // como de cristal roto alrededor de su cabeza.
  async screech(k) {
    const u = k.user, g = blanco(k);
    const fr: Keyframe[] = [tf(), tf(0, -2, 0.92, 1.1, 0, 0.2)];
    for (let i = 1; i <= 5; i++) fr.push(tf(i % 2 ? 1.5 : -1.5, -2, 0.92, 1.1, 0, 0.2 + i * 0.12));
    fr.push(tf());
    void k.animar(u.sprite, fr, 520);
    ondas(k, boca(k), k.angle, k.hayObjetivo ? k.dist * 0.9 : u.size * 1.6, { n: 6, cada: 55, ms: 300, color: '#ff4a6a', claro: '#ffffff', grosor: u.size * 0.05, abre: 0.7, tipo: 'zigzag', amp: u.size * 0.05 });
    await k.esperar(260);
    void k.agitar(g.sprite, 5, 360);
    k.sombra(g.sprite, { x: 0, y: 0 }, '#ffffff', 0, 200);
    const p = cabeza(k, g);
    E.sparks(k.fx, p, { count: 12, speed: [100, 240], palette: { core: '#ffffff', glow: '#ffd0e0', hot: '#ffffff', dark: '#ff4a6a' }, shape: 'shard', size: [2, 4] });
    const rayas = Array.from({ length: 6 }, (_, i) => i / 6 * TAU + rand(-0.2, 0.2));
    k.dibujar(260, (c, t) => {
      c.globalAlpha = 1 - t; c.lineJoin = 'round'; c.strokeStyle = '#ff4a6a'; c.lineWidth = 2;
      for (const a of rayas) {
        c.beginPath();
        for (let s = 0; s <= 3; s++) { const r = g.size * (0.35 + 0.12 * s), d = s % 2 ? 0.12 : -0.12; const x = p.x + Math.cos(a + d) * r, y = p.y + Math.sin(a + d) * r; if (s) c.lineTo(x, y); else c.moveTo(x, y); }
        c.stroke();
      }
    }, { z: 1 });
    await k.esperar(200);
    await k.estado();
  },

  // Rompecoraza: una coraza de placas envuelve al usuario, se agrieta y estalla en pedazos que salen volando; queda
  // libre y encendido de fuerza.
  async shellsmash(k) {
    const u = k.user, p0 = k.posSprite(u), rx = u.size * 0.5, ry = u.size * 0.52, msForma = 200, msGrieta = 160, ms = msForma + msGrieta;
    const grietas = Array.from({ length: 6 }, (_, i) => {
      const a0 = i / 6 * TAU + rand(-0.3, 0.3), pts: Vec[] = [];
      for (let s = 0; s <= 4; s++) { const r = 0.12 + 0.22 * s, a = a0 + rand(-0.35, 0.35); pts.push({ x: Math.cos(a) * r, y: Math.sin(a) * r }); }
      return pts;
    });
    const fr: Keyframe[] = [tf(), tf(0, 1, 1.04, 0.96, 0, 0.5)];
    for (let i = 1; i <= 4; i++) fr.push(tf(i % 2 ? 2 : -2, 1, 1.04, 0.96, 0, 0.5 + i * 0.1));
    fr.push(tf(0, 0, 1.15, 1.15, 0, 0.95), tf());
    void k.animar(u.sprite, fr, ms + 120);
    k.dibujar(ms, (c, t) => {
      const T = t * ms, p = k.posSprite(u), ap = easeOutCubic(Math.min(1, T / msForma)), e = 1.3 - 0.3 * ap;
      c.globalAlpha = Math.min(1, T / 80);
      c.save(); c.translate(p.x, p.y); c.scale(rx * e, ry * e);
      c.beginPath(); c.arc(0, 0, 1, 0, TAU);
      const gr = c.createRadialGradient(-0.3, -0.35, 0.1, 0, 0, 1);
      gr.addColorStop(0, 'rgba(216,200,150,0.75)'); gr.addColorStop(1, 'rgba(120,100,60,0.85)');
      c.fillStyle = gr; c.fill();
      c.lineWidth = 0.06; c.strokeStyle = '#3a2e1a'; c.stroke();
      c.beginPath(); c.arc(0, 0, 0.5, 0, TAU);
      for (let i = 0; i < 6; i++) { const a = i / 6 * TAU + 0.5; c.moveTo(Math.cos(a) * 0.5, Math.sin(a) * 0.5); c.lineTo(Math.cos(a), Math.sin(a)); }
      c.lineWidth = 0.04; c.strokeStyle = 'rgba(58,46,26,0.7)'; c.stroke();
      if (T > msForma) {
        const f = (T - msForma) / msGrieta;
        c.lineJoin = 'round';
        for (const [ancho, color] of [[0.09, '#fff6d0'], [0.04, '#1a1206']] as const) {
          c.lineWidth = ancho; c.strokeStyle = color;
          for (const pts of grietas) {
            const n = Math.max(2, Math.ceil(pts.length * f));
            c.beginPath(); pts.slice(0, n).forEach((q, i) => { if (i) c.lineTo(q.x, q.y); else c.moveTo(q.x, q.y); }); c.stroke();
          }
        }
      }
      c.restore();
    }, { z: 1 });
    await k.esperar(ms);
    k.burst(26, i => {
      const a = i / 26 * TAU + rand(-0.1, 0.1), sp = rand(200, 380);
      return { x: p0.x + Math.cos(a) * rx * 0.8, y: p0.y + Math.sin(a) * ry * 0.8, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 80, ay: 600, drag: 1, life: rand(450, 650), size: rand(4, 8), color: pick(['#a89870', '#8a7a5a', '#c8b890']), accent: '#3a2e1a', shape: 'rock', spin: rand(-10, 10) };
    });
    k.add(E.flash({ color: '#ffffff', alpha: 0.35, duration: 180 }));
    k.add(E.ring({ at: p0, from: rx * 0.6, to: u.size * 1.3, width: 5, color: SUBE.core, duration: 360 }));
    k.add(E.bloom({ at: p0, radius: u.size * 0.8, color: '#ff7a3a', duration: 340 }));
    k.sombra(u.sprite, { x: 0, y: 0 }, '#ff4a2a', 0, 360);
    void k.stage.shake(5, 200);
    await k.esperar(120);
    await k.estado();
  },

  // Canto: el usuario se mece y de él salen notas de colores que ondulan como una melodía hasta el objetivo, que se
  // balancea adormecido.
  async sing(k) {
    const u = k.user, g = blanco(k), n = 6, viaje = 480;
    void k.animar(u.sprite, vaiven(3, 7), 640);
    const cols = ['#ff7ab0', '#7ac8ff', '#ffd25a', '#8ae07a', '#c89aff', '#ff9a6a'];
    for (let i = 0; i < n; i++) {
      const lado = (i % 3 - 1) * k.s(0.22), fase = i * 1.3;
      figura(k, 'nota', viaje, { base: cols[i], claro: '#ffffff', borde: TINTA }, t => {
        const p = k.punto(0.12 + 0.82 * t, lado + Math.sin(t * 9 + fase) * k.s(0.15));
        return { x: p.x, y: p.y - k.s(0.25) - Math.sin(Math.PI * t) * k.s(0.2), tam: u.size * 0.13 * (0.7 + 0.3 * Math.sin(Math.PI * t)), ang: 0.25 * Math.sin(t * 12 + fase), a: env(t, 0.12, 0.2) };
      }, { delay: i * 45 });
    }
    k.dibujar(viaje, () => { if (Math.random() < 0.5) { const p = k.punto(rand(0.15, 0.9), rand(-k.s(0.3), k.s(0.3))); k.emit({ x: p.x, y: p.y - k.s(0.25), vy: -rand(10, 30), life: 360, size: rand(1.5, 2.5), color: pick(cols), shape: 'star', spin: 4 }); } }, { z: 1 });
    await k.esperar(viaje);
    void k.animar(g.sprite, vaiven(2, 8), 600);
    k.add(E.ring({ at: cabeza(k, g), from: 4, to: g.size * 0.6, width: 2.5, color: '#ffc8e4', duration: 320 }));
    await k.esperar(80);
    await k.estado();
  },

  // Sonámbulo: el usuario duerme (zetas que suben, se mece) y, sin despertar, le sale un bocadillo con un "!" que
  // destella: va a usar otro movimiento.
  async sleeptalk(k) {
    const u = k.user;
    void k.animar(u.sprite, [tf(), tf(0, 1, 1.04, 0.96, -5, 0.3), tf(0, 0, 0.98, 1.03, 5, 0.65), tf()], 700);
    for (let i = 0; i < 3; i++) figura(k, 'z', 520, { base: '#cfe0ff', claro: '#ffffff', borde: '#2a3a6a' }, t => {
      const p = cabeza(k, u);
      return { x: p.x + u.size * (0.25 + 0.25 * t) + Math.sin(t * 8) * 3, y: p.y - u.size * (0.15 + 0.55 * t), tam: u.size * (0.06 + 0.05 * t + i * 0.015), ang: -0.2, a: env(t, 0.15, 0.3) };
    }, { delay: i * 120 });
    k.dibujar(520, (c, t) => {
      const p = cabeza(k, u), s = t < 0.25 ? easeOutCubic(t / 0.25) * 1.1 : t < 0.35 ? lerp(1.1, 1, (t - 0.25) / 0.1) : 1;
      const x = p.x - u.size * 0.45, y = p.y - u.size * 0.55, w = u.size * 0.26 * s, h = u.size * 0.2 * s;
      c.globalAlpha = env(t, 0.05, 0.25);
      c.beginPath(); c.ellipse(x, y, w, h, 0, 0, TAU);
      c.moveTo(x + w * 0.35, y + h * 0.8); c.lineTo(x + w * 0.9, y + h * 1.6); c.lineTo(x + w * 0.7, y + h * 0.6);
      c.fillStyle = '#ffffff'; c.fill(); c.lineWidth = 2; c.lineJoin = 'round'; c.strokeStyle = TINTA; c.stroke();
      c.font = `bold ${Math.round(h * 1.4)}px "Segoe UI", sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillStyle = '#e0302a'; c.fillText('!', x, y + 1);
    }, { delay: 260, z: 1 });
    await k.esperar(420);
    E.sparks(k.fx, { x: cabeza(k, u).x - u.size * 0.45, y: cabeza(k, u).y - u.size * 0.55 }, { count: 8, speed: [60, 150], palette: ORO, shape: 'star', size: [2, 3.5] });
    await k.esperar(140);
    await k.estado();
  },

  // Pantallahumo: bocanadas de humo negro salen en arco hacia el objetivo y lo envuelven en una nube espesa que casi lo
  // oculta.
  async smokescreen(k) {
    const g = blanco(k);
    await k.anticipar(60);
    void k.recuperar({ x: -k.dir.x * 8, y: -k.dir.y * 8 }, 200);
    for (let j = 0; j < 3; j++) k.dibujar(300, (c, t, engine) => {
      const p = k.punto(0.1 + 0.85 * t, (j - 1) * k.s(0.25) * Math.sin(Math.PI * t)), y = p.y - k.s(0.4) * Math.sin(Math.PI * t), r = k.s(0.12);
      c.globalAlpha = 0.85;
      c.drawImage(engine.glow('#3a3a42'), p.x - r * 1.5, y - r * 1.5, r * 3, r * 3);
      if (Math.random() < 0.7) k.emit({ x: p.x, y, vx: rand(-20, 20), vy: rand(-20, 10), life: 380, size: k.s(0.08), sizeEnd: k.s(0.16), color: '#4a4a52', alpha: 0.6, shape: 'smoke' });
    }, { delay: j * 60, z: 1 });
    await k.esperar(360);
    const p = k.posSprite(g);
    k.burst(22, i => {
      const a = rand(0, TAU), r = g.size * rand(0.05, 0.45);
      return { x: p.x + Math.cos(a) * r, y: p.y + Math.sin(a) * r * 0.8, vx: Math.cos(a) * rand(20, 60), vy: Math.sin(a) * rand(10, 40) - 10, drag: 1.5, life: rand(800, 1100), delay: i * 8, size: g.size * rand(0.18, 0.28), sizeEnd: g.size * rand(0.35, 0.5), color: pick(['#3a3a42', '#55555e', '#2a2a30']), alpha: 0.75, fadeIn: 0.1, shape: 'smoke' };
    });
    void k.animar(g.sprite, [{ opacity: 1 }, { opacity: 0.45, offset: 0.3 }, { opacity: 0.45, offset: 0.7 }, { opacity: 1 }], 900);
    void k.agitar(g.sprite, 2, 240);
    await k.esperar(150);
    await k.estado();
  },

  // Salpicadura: el usuario da tres saltitos torpes salpicando gotas a su alrededor… y no pasa nada.
  async splash(k) {
    const u = k.user, salto = 180, n = 3, alto = u.size * 0.25;
    const fr: Keyframe[] = [];
    for (let i = 0; i < n; i++) { const o = i / n; fr.push(tf(0, 0, 1.08, 0.92, 0, o), tf(0, -alto, 0.94, 1.08, i % 2 ? 8 : -8, o + 0.5 / n)); }
    fr.push(tf());
    void k.animar(u.sprite, fr, n * salto);
    const AGUA = TYPE_FX.Water;
    for (let i = 0; i <= n; i++) {
      const d = i * salto, f = pies(k, u);
      k.burst(8, () => ({ x: f.x + rand(-u.size * 0.25, u.size * 0.25), y: f.y, vx: rand(-110, 110), vy: -rand(120, 240), ay: 900, life: 420, delay: d, size: rand(2.5, 4), color: pick([AGUA.core, AGUA.glow, '#ffffff']), shape: 'drop', stretch: 20 }));
      k.add(E.ring({ at: f, from: 4, to: u.size * 0.5, width: 2, color: AGUA.glow, duration: 300, squash: 0.35, delay: d }));
    }
    await k.esperar(n * salto);
    await k.estado();
  },

  // Reserva: tres bolas de energía aparecen alrededor del usuario, giran y se meten una a una en su barriga, que se
  // hincha a cada una.
  async stockpile(k) {
    const u = k.user, ms = 560, entran = [0, 1, 2].map(i => (0.35 + i * 0.12 + 0.3) * ms);
    for (let i = 0; i < 3; i++) {
      k.dibujar(ms, (c, t) => {
        const p = k.posSprite(u), dentro = easeIn(Math.max(0, Math.min(1, (t - 0.35 - i * 0.12) / 0.3)));
        if (dentro >= 1) return;
        const a = i / 3 * TAU + t * 6, r = u.size * 0.7 * (1 - dentro);
        c.globalAlpha = env(t, 0.1, 0.01);
        orbe(c, p.x + Math.cos(a) * r, p.y + u.size * 0.08 + Math.sin(a) * r * 0.5, u.size * 0.11 * (1 - 0.5 * dentro));
      }, { z: 1 });
      k.add(E.ring({ at: { x: k.posSprite(u).x, y: k.posSprite(u).y + u.size * 0.08 }, from: 4, to: u.size * 0.45, width: 2.5, color: '#ffc24a', duration: 240, delay: entran[i] }));
    }
    const total = ms + 120, fr: Keyframe[] = [tf()];
    entran.forEach((d, i) => { const s = 1.04 + i * 0.03; fr.push(tf(0, 0, 1, 1, 0, Math.max(0.01, d / total - 0.04)), tf(0, 0, s, 1 / s + 0.06, 0, d / total + 0.03)); });
    fr.push(tf());
    void k.animar(u.sprite, fr, total);
    await k.esperar(ms - 40);
    await k.estado();
  },

  // Supersónico: anillos finísimos y rapidísimos (ultrasonido) viajan en fila hasta el objetivo, que se queda con
  // estrellitas girando sobre la cabeza.
  async supersonic(k) {
    const g = blanco(k), n = 9, viaje = 260;
    for (let i = 0; i < n; i++) k.dibujar(viaje, (c, t) => {
      const p = k.punto(0.12 + 0.8 * t), r = k.user.size * (0.1 + 0.18 * t);
      c.globalAlpha = env(t, 0.1, 0.2);
      c.save(); c.translate(p.x, p.y); c.rotate(k.angle);
      c.beginPath(); c.ellipse(0, 0, r * 0.3, r, 0, 0, TAU);
      c.strokeStyle = '#5ae0ff'; c.lineWidth = 2.2; c.stroke(); c.strokeStyle = '#ffffff'; c.lineWidth = 0.8; c.stroke();
      c.restore();
    }, { delay: i * 35, z: 1 });
    await k.esperar(viaje + 4 * 35);
    k.dibujar(560, (c, t) => {
      const p = encima(k, g, 0.05);
      c.globalAlpha = env(t, 0.1, 0.25);
      for (let i = 0; i < 3; i++) { const a = i / 3 * TAU + t * 10; forma(c, 'estrella', p.x + Math.cos(a) * g.size * 0.28, p.y + Math.sin(a) * g.size * 0.1, g.size * 0.07, a, { base: '#ffe23a', borde: '#6a4a00' }); }
    }, { z: 1 });
    void k.agitar(g.sprite, 2, 200);
    await k.esperar(100);
    await k.estado();
  },

  // Fanfarronear: el usuario saca pecho con una corona dorada y destellos; el objetivo se enfada: venas rojas, vapor y
  // un fogonazo rojo de rabia.
  async swagger(k) {
    const u = k.user, g = blanco(k);
    void k.animar(u.sprite, [tf(), tf(0, -3, 1.14, 1.1, -6, 0.25), tf(0, -3, 1.14, 1.1, 6, 0.55), tf(0, -2, 1.1, 1.08, 0, 0.75), tf()], 620);
    k.dibujar(560, (c, t) => {
      const p = encima(k, u, 0.1), s = t < 0.25 ? easeOutCubic(t / 0.25) : 1;
      c.globalAlpha = env(t, 0.05, 0.25);
      corona(c, p.x, p.y - 4 * Math.abs(Math.sin(t * 12)), u.size * 0.2 * s, 0.1 * Math.sin(t * 10));
    }, { z: 1 });
    k.burst(10, i => { const a = i / 10 * TAU, p = k.posSprite(u); return { x: p.x + Math.cos(a) * u.size * 0.5, y: p.y + Math.sin(a) * u.size * 0.4, vy: -rand(20, 50), life: 420, delay: i * 25, size: rand(3, 4.5), color: pick([ORO.core, '#ffffff']), shape: 'star', spin: 5 }; });
    await k.esperar(320);
    if (k.hayObjetivo) {
      k.dibujar(420, (c, t) => { const p = cabeza(k, g); c.globalAlpha = env(t, 0.1, 0.3); venas(c, p.x + g.size * 0.28, p.y - g.size * 0.25, g.size * 0.14 * (1 + 0.2 * Math.sin(t * 30))); }, { z: 1 });
      k.sombra(g.sprite, { x: 0, y: 0 }, '#ff3a2a', 0, 360);
      void k.agitar(g.sprite, 3, 300);
      const p = encima(k, g, 0);
      k.burst(4, i => ({ x: p.x + (i - 1.5) * g.size * 0.15, y: p.y, vx: rand(-15, 15), vy: -rand(50, 90), life: 480, delay: i * 50, size: g.size * 0.08, sizeEnd: g.size * 0.18, color: '#f4f0ea', alpha: 0.7, shape: 'smoke' }));
    }
    await k.esperar(200);
    await k.estado();
  },

  // Tragar: las bolas de energía guardadas salen sobre la cabeza del usuario, que alza la cara y se las traga de un
  // bocado; crucecitas verdes le curan.
  async swallow(k) {
    const u = k.user, ms = 560;
    void k.animar(u.sprite, [tf(), tf(0, -2, 0.95, 1.08, -6, 0.45), tf(0, 3, 1.12, 0.88, 0, 0.72), tf()], 640);
    for (let i = 0; i < 3; i++) k.dibujar(ms, (c, t) => {
      const p = k.posSprite(u), sale = easeOutCubic(Math.min(1, t / 0.3)), cae = easeIn(Math.max(0, (t - 0.4 - i * 0.08) / 0.25));
      if (cae >= 1) return;
      const yArriba = p.y - u.size * (0.4 + 0.45 * sale);
      c.globalAlpha = Math.min(1, t / 0.1);
      orbe(c, p.x + (i - 1) * u.size * 0.25 * (1 - cae), lerp(yArriba, p.y - u.size * 0.22, cae), u.size * 0.1 * (1 - 0.5 * cae));
    }, { z: 1 });
    await k.esperar(ms * 0.75);
    const p0 = k.posSprite(u);
    k.add(E.bloom({ at: p0, radius: u.size * 0.75, color: CURA.glow, duration: 360 }));
    for (let i = 0; i < 3; i++) k.dibujar(420, (c, t) => {
      const p = k.posSprite(u);
      c.globalAlpha = env(t, 0.15, 0.4);
      cruz(c, p.x + (i - 1) * u.size * 0.32, p.y - u.size * (0.1 + 0.5 * t) - (i === 1 ? u.size * 0.12 : 0), u.size * 0.08, false);
    }, { delay: i * 60, z: 1 });
    await k.esperar(100);
    await k.estado();
  },

  // Dulce Aroma: una estela rosa y perfumada, con pétalos y corazoncitos, serpentea hasta el objetivo y lo envuelve en
  // una nube dulce.
  async sweetscent(k) {
    const g = blanco(k);
    k.dibujar(420, (_c, t) => {
      for (let i = 0; i < 2; i++) {
        const v = Math.min(1, t * 1.2) * rand(0.6, 1), p = k.punto(0.1 + 0.85 * v, Math.sin(v * 10 + t * 6) * k.s(0.2));
        k.emit({ x: p.x, y: p.y, vx: rand(-15, 15), vy: rand(-25, 5), life: 600, size: k.s(0.07), sizeEnd: k.s(0.15), color: pick(['#ffb0d8', '#ffc8e4', '#ff9ac8']), alpha: 0.45, shape: 'smoke' });
      }
      if (Math.random() < 0.35) { const p = k.punto(rand(0.15, 0.9), rand(-k.s(0.25), k.s(0.25))); k.emit({ x: p.x, y: p.y, vx: k.dir.x * 40, vy: k.dir.y * 40 + rand(-10, 20), life: 600, size: rand(3, 5), color: pick(['#ffc0dc', '#ff8ac0', '#ffffff']), accent: '#e05a9a', shape: Math.random() < 0.5 ? 'leaf' : 'heart', rot: rand(0, TAU), spin: rand(-5, 5) }); }
    }, { z: 0 });
    await k.esperar(400);
    const p = k.posSprite(g);
    k.burst(14, () => { const a = rand(0, TAU), r = g.size * rand(0.1, 0.5); return { x: p.x + Math.cos(a) * r, y: p.y + Math.sin(a) * r * 0.7, vx: Math.cos(a) * 20, vy: -rand(5, 25), drag: 1, life: rand(700, 900), size: g.size * 0.15, sizeEnd: g.size * 0.3, color: pick(['#ffb0d8', '#ffc8e4']), alpha: 0.5, fadeIn: 0.15, shape: 'smoke' }; });
    k.burst(8, i => ({ x: p.x + rand(-g.size * 0.35, g.size * 0.35), y: p.y - rand(0, g.size * 0.3), vy: -rand(40, 80), vx: rand(-20, 20), life: 600, delay: i * 30, size: rand(3.5, 5.5), color: pick([ROSA.core, ROSA.glow]), shape: 'heart', fadeIn: 0.2 }));
    void k.animar(g.sprite, vaiven(2, 6), 500);
    await k.esperar(140);
    await k.estado();
  },

  // Danza Espada: cuatro espadas giran en corro alrededor del usuario mientras baila; al final dos se cruzan sobre su
  // cabeza con un destello.
  async swordsdance(k) {
    const u = k.user, ms = 620, gira = 0.6, n = 4;
    void k.girar(u.sprite, 1, 420);
    const acero = (c: CanvasRenderingContext2D) => { const g = c.createLinearGradient(-0.35, -0.1, 1.05, 0.1); g.addColorStop(0, '#b8c6d4'); g.addColorStop(0.6, '#f4f8fc'); g.addColorStop(1, '#ffffff'); return g; };
    const est: EstiloForma = { base: acero, claro: '#ffffff', oscuro: '#8a5a1a', borde: '#1e2a36' };
    k.dibujar(ms, (c, t) => {
      const p = k.posSprite(u);
      c.globalAlpha = env(t, 0.1, 0.15);
      if (t < gira) {
        const f = t / gira, r = u.size * (0.85 - 0.25 * f);
        for (let i = 0; i < n; i++) { const a = i / n * TAU + f * TAU * 1.5, q = k.alrededor(p, r, a, 0.5); forma(c, 'espada', q.x, q.y - u.size * 0.1, u.size * 0.3, a + Math.PI / 2, est); }
      } else {
        const f = easeOutCubic((t - gira) / (1 - gira)), X = { x: p.x, y: p.y - u.size * 0.75 }, tam = u.size * 0.36 * (0.6 + 0.4 * f);
        for (const lado of [-1, 1]) {
          const ang = -Math.PI / 2 + lado * lerp(1.2, 0.5, f);
          forma(c, 'espada', X.x - Math.cos(ang) * tam * 0.4, X.y - Math.sin(ang) * tam * 0.4, tam, ang, lado > 0 ? { ...est, brillo: '#ffffff', brilloTam: 10 } : est);
        }
      }
    }, { z: 1 });
    await k.esperar(ms * gira);
    const X = { x: k.posSprite(u).x, y: k.posSprite(u).y - u.size * 0.75 };
    k.add(E.starburst({ at: X, rays: 8, length: u.size * 0.5, width: 2.5, palette: TYPE_FX.Steel, duration: 300, delay: 120 }));
    k.burst(8, i => ({ x: X.x, y: X.y, vx: Math.cos(i / 8 * TAU) * 140, vy: Math.sin(i / 8 * TAU) * 140, drag: 3, life: 320, delay: 120, size: 3, color: '#ffffff', shape: 'star', spin: 6 }));
    await k.esperar(160);
    await k.estado();
  },

  // Látigo: detrás del usuario aparece su cola, que se menea de lado a lado con arcos de movimiento; el objetivo baja
  // la guardia.
  async tailwhip(k) {
    const u = k.user, g = blanco(k), ms = 560;
    void k.animar(u.sprite, vaiven(5, 7), ms);
    const atras = k.angle + Math.PI;
    k.dibujar(ms, (c, t) => {
      const p = k.posSprite(u), wag = Math.sin(t * TAU * 3.5) * 0.7, base = { x: p.x + Math.cos(atras) * u.size * 0.25, y: p.y + u.size * 0.12 + Math.sin(atras) * u.size * 0.2 };
      c.globalAlpha = env(t, 0.1, 0.2);
      c.lineCap = 'round'; c.strokeStyle = 'rgba(255,255,255,0.75)'; c.lineWidth = 2;
      for (const r of [0.6, 0.7]) { c.beginPath(); c.arc(base.x, base.y, u.size * r, atras - 0.8, atras + 0.8); c.stroke(); }
      cola(c, base.x, base.y, u.size * 0.26, atras + wag, t * 30);
    }, { z: 1 });
    await k.esperar(380);
    void k.agitar(g.sprite, 2, 200);
    k.add(E.ring({ at: k.posSprite(g), from: 6, to: g.size * 0.6, width: 2.5, color: BAJA.glow, duration: 300 }));
    await k.esperar(100);
    await k.estado();
  },

  // Ojos Llorosos: sobre la cara del usuario aparecen dos ojazos brillantes y temblorosos de los que caen lágrimas; el
  // objetivo se ablanda.
  async tearfullook(k) {
    const u = k.user, g = blanco(k), ms = 620;
    k.dibujar(ms, (c, t) => {
      const p = cabeza(k, u), ab = Math.min(1, t / 0.2), tiembla = Math.sin(t * 60) * 0.8;
      c.globalAlpha = env(t, 0.1, 0.2);
      for (const lado of [-1, 1]) {
        c.save(); c.translate(p.x + lado * u.size * 0.16 + tiembla, p.y); c.scale(0.85, Math.max(0.05, ab));
        c.beginPath(); c.ellipse(0, 0, u.size * 0.13, u.size * 0.15, 0, 0, TAU); c.fillStyle = '#ffffff'; c.fill(); c.lineWidth = 2; c.strokeStyle = TINTA; c.stroke();
        const gr = c.createRadialGradient(0, u.size * 0.05, 0, 0, u.size * 0.02, u.size * 0.12);
        gr.addColorStop(0, '#9ad8ff'); gr.addColorStop(1, '#1a4a9a');
        c.beginPath(); c.ellipse(0, u.size * 0.02, u.size * 0.1, u.size * 0.12, 0, 0, TAU); c.fillStyle = gr; c.fill();
        c.fillStyle = '#ffffff';
        c.beginPath(); c.arc(-u.size * 0.035, -u.size * 0.03, u.size * 0.035, 0, TAU); c.fill();
        c.beginPath(); c.arc(u.size * 0.03, u.size * 0.05, u.size * 0.018, 0, TAU); c.fill();
        c.strokeStyle = 'rgba(122,200,255,0.9)'; c.lineWidth = 2; c.beginPath(); c.ellipse(0, u.size * 0.02, u.size * 0.12, u.size * 0.13, 0, 0.3, Math.PI - 0.3); c.stroke();
        c.restore();
        if (t > 0.25 && Math.random() < 0.15) k.emit({ x: p.x + lado * u.size * 0.24, y: p.y + u.size * 0.1, vx: lado * rand(10, 30), vy: rand(10, 40), ay: 500, life: 380, size: rand(2, 3), color: '#7ac8ff', shape: 'drop', stretch: 20 });
      }
    }, { z: 1 });
    await k.esperar(380);
    k.add(E.ring({ at: k.posSprite(g), from: 6, to: g.size * 0.6, width: 2.5, color: '#a8d8ff', duration: 320 }));
    void k.animar(g.sprite, [tf(), tf(0, 2, 0.96, 0.94, 0, 0.5), tf()], 360);
    k.sombra(g.sprite, { x: 0, y: 0 }, '#a8d8ff', 0, 300);
    await k.esperar(120);
    await k.estado();
  },

  // Danza Caos: el usuario baila tambaleándose con notas torcidas; una onda ondulante alcanza al objetivo, que se
  // tambalea con una espiral mareante sobre la cabeza.
  async teeterdance(k) {
    const u = k.user, g = blanco(k);
    void k.animar(u.sprite, vaiven(4, 16, 5), 680);
    for (let i = 0; i < 3; i++) figura(k, 'nota', 520, { base: pick(['#c89aff', '#ff9ac8', '#9ad8ff']), borde: TINTA }, t => {
      const p = cabeza(k, u), lado = i - 1;
      return { x: p.x + lado * u.size * (0.2 + 0.4 * t) + Math.sin(t * 14 + i) * 5, y: p.y - u.size * (0.2 + 0.5 * t), tam: u.size * 0.12, ang: Math.sin(t * 16 + i) * 0.6, a: env(t, 0.1, 0.3) };
    }, { delay: i * 80 });
    ondas(k, cabeza(k, u), k.angle, k.hayObjetivo ? k.dist * 0.85 : u.size * 1.2, { n: 2, cada: 140, ms: 420, color: '#c89aff', claro: '#ffffff', grosor: u.size * 0.06, abre: 1.1, tipo: 'ondulado', amp: u.size * 0.07 });
    await k.esperar(360);
    void k.animar(g.sprite, vaiven(3, 12, 3), 600);
    figura(k, 'espiral', 560, { base: '#c89aff', borde: '#8a4ae0' }, t => { const p = encima(k, g, 0.1); return { x: p.x, y: p.y, tam: g.size * 0.2, ang: t * 12, a: env(t, 0.1, 0.25) }; });
    await k.esperar(160);
    await k.estado();
  },

  // Remolino: ráfagas de viento cruzan hasta el objetivo y se levanta un tornado que lo hace girar y lo lanza lejos.
  async whirlwind(k) {
    const g = blanco(k), ms = 560;
    k.dibujar(220, () => {
      for (let i = 0; i < 3; i++) { const p = k.punto(rand(0, 0.6), rand(-k.s(0.4), k.s(0.4))), v = rand(500, 700); k.emit({ x: p.x, y: p.y, vx: k.dir.x * v, vy: k.dir.y * v, life: 220, size: 2, color: '#ffffff', alpha: 0.8, shape: 'streak', stretch: 45 }); }
    }, { z: 1 });
    await k.esperar(200);
    const f0 = pies(k, g);
    k.dibujar(ms, (c, t) => {
      const alto = g.size * 1.3 * easeOutCubic(Math.min(1, t / 0.3));
      c.globalAlpha = env(t, 0.05, 0.3); c.lineCap = 'round';
      for (let i = 0; i < 9; i++) {
        const v = i / 8, rx = g.size * (0.18 + 0.5 * v), sway = Math.sin(v * 4 + t * 10) * g.size * 0.08, a0 = t * 16 + i * 0.9;
        c.beginPath(); c.ellipse(f0.x + sway, f0.y - alto * v, rx, rx * 0.3, 0, a0, a0 + Math.PI * 1.3);
        c.strokeStyle = i % 2 ? 'rgba(220,235,245,0.85)' : 'rgba(255,255,255,0.9)'; c.lineWidth = 3 - v; c.stroke();
      }
      if (Math.random() < 0.4) { const a = rand(0, TAU); k.emit({ x: f0.x + Math.cos(a) * g.size * 0.3, y: f0.y - rand(0, alto), vx: -Math.sin(a) * 200, vy: -rand(60, 140), life: 360, size: rand(2.5, 4), color: pick(['#a8c890', '#d8c8a0']), accent: '#5a6a3a', shape: 'leaf', spin: 12 }); }
    }, { z: 1 });
    if (k.hayObjetivo) {
      const lejos = g.size * 0.8;
      void k.animar(g.sprite, [tf(), tf(0, -g.size * 0.25, 1, 1, 360, 0.45), tf(k.dir.x * lejos, k.dir.y * lejos - g.size * 0.2, 0.85, 0.85, 620, 0.7), tf(0, 0, 1, 1, 720)], 820);
      void k.animar(g.sprite, [{ opacity: 1 }, { opacity: 1, offset: 0.45 }, { opacity: 0.35, offset: 0.7 }, { opacity: 1 }], 820);
    }
    await k.esperar(360);
    await k.estado();
  },

  // Deseo: una estrella fugaz cae desde lo alto del cielo dejando una estela brillante y se posa sobre el usuario en
  // un estallido de estrellitas.
  async wish(k) {
    const u = k.user, viaje = 420, p0 = k.posSprite(u), destino = { x: p0.x, y: p0.y - u.size * 0.75 }, origen = { x: p0.x + u.size * 1.4, y: k.stage.top };
    const estrella: EstiloForma = { base: '#ffe23a', claro: '#fff6b0', borde: '#8a5a00', brillo: '#fff0a0', brilloTam: 16 };
    k.dibujar(viaje, (c, t) => {
      const f = easeInOut(t), x = lerp(origen.x, destino.x, f), y = lerp(origen.y, destino.y, f);
      for (let i = 0; i < 2; i++) k.emit({ x: x + rand(-4, 4), y: y + rand(-4, 4), vx: rand(-20, 20), vy: rand(-20, 20), life: 380, size: rand(2, 4), sizeEnd: 0.5, color: pick(['#fff6b0', '#ffe23a', '#ffffff']), shape: i ? 'star' : 'glow', spin: 5 });
      forma(c, 'estrella', x, y, u.size * 0.2, t * 8, estrella);
    }, { z: 1 });
    await k.esperar(viaje);
    figura(k, 'estrella', 420, estrella, t => ({ x: destino.x, y: destino.y, tam: u.size * 0.2 * (1 + 0.3 * Math.sin(t * 20) * (1 - t)), ang: t * 2, a: 1 - easeIn(t) }));
    k.add(E.starburst({ at: destino, rays: 10, length: u.size * 0.6, width: 2.5, palette: ORO, duration: 360 }));
    k.burst(12, i => ({ x: destino.x + rand(-u.size * 0.3, u.size * 0.3), y: destino.y, vx: rand(-30, 30), vy: rand(40, 110), life: 520, delay: i * 20, size: rand(2.5, 4), color: pick(['#fff6b0', '#ffffff', ORO.core]), shape: 'star', spin: 4 }));
    await k.esperar(140);
    await k.estado();
  },

  // Bostezo: el usuario bosteza a lo grande y suelta una burbuja con una Z dentro que flota perezosa hasta el objetivo
  // y le estalla en la cara; el objetivo se queda mustio.
  async yawn(k) {
    const u = k.user, g = blanco(k), viaje = 380;
    void k.animar(u.sprite, [tf(), tf(0, -2, 0.94, 1.12, -8, 0.35), tf(0, 0, 1.04, 0.95, 0, 0.6), tf()], 520);
    await k.esperar(160);
    k.dibujar(viaje, (c, t) => {
      const a = cabeza(k, u), b = cabeza(k, g), f = easeInOut(t), ola = Math.sin(t * TAU) * k.s(0.15);
      const x = lerp(a.x, b.x, f) + k.perp.x * ola, y = lerp(a.y, b.y, f) + k.perp.y * ola - Math.sin(Math.PI * t) * k.s(0.35);
      const R = u.size * (0.1 + 0.12 * Math.min(1, t * 3)), w = 1 + 0.08 * Math.sin(t * 25);
      c.beginPath(); c.ellipse(x, y, R * w, R / w, 0, 0, TAU);
      c.fillStyle = 'rgba(200,225,255,0.35)'; c.fill(); c.lineWidth = 2; c.strokeStyle = '#ffffff'; c.stroke();
      c.beginPath(); c.arc(x - R * 0.4, y - R * 0.4, R * 0.18, 0, TAU); c.fillStyle = 'rgba(255,255,255,0.85)'; c.fill();
      forma(c, 'z', x, y, R * 0.5, -0.15, { base: '#6a8ae0', claro: '#a8c0ff', borde: '#1e2a5a' });
    }, { z: 1 });
    await k.esperar(viaje);
    const p = cabeza(k, g);
    k.add(E.ring({ at: p, from: u.size * 0.2, to: g.size * 0.6, width: 2.5, color: '#ffffff', duration: 240 }));
    k.burst(8, i => { const a = i / 8 * TAU; return { x: p.x, y: p.y, vx: Math.cos(a) * 110, vy: Math.sin(a) * 110, drag: 3, life: 360, size: rand(3, 5), color: '#d8ecff', accent: '#ffffff', shape: 'bubble' }; });
    void k.animar(g.sprite, [tf(), tf(0, 3, 1.04, 0.9, 0, 0.5), tf()], 520);
    await k.estado();
  },
};
