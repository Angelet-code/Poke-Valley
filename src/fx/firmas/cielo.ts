// Firmas de movimientos (ver LEEME.md). Grupo: Volador, Hada y Dragón.
import { E, NEUTRAL_FX, TYPE_FX, easeIn, easeInOut, easeOut, easeOutCubic, lerp, mix, pick, rand, withAlpha, type Firma, type FxPalette, type Kit, type SlotGeometry, type Vec } from './kit';
import { forma, mandibula, type EstiloForma } from './formas';

const VOLADOR = TYPE_FX.Flying;
const HADA = TYPE_FX.Fairy;
const DRAGON = TYPE_FX.Dragon;
const FUEGO = TYPE_FX.Fire;
const CURA = NEUTRAL_FX.heal;
// Morado de dragón (garras, ciclón, colas) y el rojo de la furia.
const MORADO: FxPalette = { core: '#8a4cff', glow: '#c2a0ff', hot: '#f4ecff', dark: '#2e0e6a' };
const RABIA: FxPalette = { core: '#ff3a3a', glow: '#ff9a7a', hot: '#fff0e0', dark: '#5a0a1a' };
const BLANCO = NEUTRAL_FX.white;
// El aire es blanco con un borde azul oscuro para que se lea sobre el suelo claro.
const AIRE_BORDE = '#3e5f8c';

const PICO: EstiloForma = { base: '#ffc93c', claro: '#ffe58a', oscuro: '#d9861c', borde: '#5a3208' };
// Paleta del pico (amarillo) para chispas y estallidos.
const PICO_FX: FxPalette = { core: '#ffc93c', glow: '#ffe58a', hot: '#ffffff', dark: '#5a3208' };
const ALA: EstiloForma = { base: '#f4f8ff', claro: '#ffffff', oscuro: '#a8c4e8', borde: AIRE_BORDE };
const PLUMA: EstiloForma = { base: '#fbfcff', claro: '#ffffff', borde: '#6a7c9c', grosor: 1.2 };
const CORAZON: EstiloForma = { base: '#ff6fb4', claro: '#ffd0ea', borde: '#8a1a50' };

const rellenoFuego = (c: CanvasRenderingContext2D) => {
  const g = c.createLinearGradient(-1, 0, 1, 0);
  g.addColorStop(0, '#d8280c'); g.addColorStop(0.45, '#ff7a18'); g.addColorStop(0.8, '#ffc23a'); g.addColorStop(1, '#fff3b0');
  return g;
};

// ---- Ayudas de geometría ----
/** Todos los objetivos en pantalla (los movimientos que dan a varios), o el principal. */
const blancos = (k: Kit): SlotGeometry[] => (k.ctx.targets.length ? k.ctx.targets : [k.target]);
/** Punto a `px` del usuario hacia el objetivo. */
const delante = (k: Kit, px: number, lado = 0): Vec => k.punto(px / Math.max(1, k.dist), lado);
/** Entra en `entra` y se apaga en la última `sale` parte de t (0-1). */
const aparece = (t: number, entra = 0.12, sale = 0.25): number => Math.min(1, t / entra) * (t > 1 - sale ? Math.max(0, (1 - t) / sale) : 1);
const entre = (a: Vec, b: Vec, t: number): Vec => ({ x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t) });
/** Desplazamiento (px) de una embestida que llega a la fracción `hasta` del camino (como k.embestida). */
const llegada = (k: Kit, hasta: number): Vec => {
  const lejos = Math.max(0, k.dist - k.target.size * 0.45) * hasta;
  return { x: k.dir.x * lejos, y: k.dir.y * lejos };
};

// ---- Dibujos propios (lo que no está en formas.ts) ----
/** Cinta de viento: línea ondulada de la cola a la cabeza, transparente en la cola y con un rizo en la cabeza. */
function cintaViento(c: CanvasRenderingContext2D, cola: Vec, cabeza: Vec, amp: number, fase: number, ancho: number, color: string, alpha = 1, rizo = true, borde = AIRE_BORDE): void {
  const dx = cabeza.x - cola.x, dy = cabeza.y - cola.y, L = Math.hypot(dx, dy) || 1, ux = dx / L, uy = dy / L, px = -uy, py = ux;
  const pts: Vec[] = [];
  for (let i = 0; i <= 14; i++) {
    const u = i / 14, o = Math.sin(u * Math.PI * 2 + fase) * amp * Math.sin(Math.PI * u);
    pts.push({ x: cola.x + dx * u + px * o, y: cola.y + dy * u + py * o });
  }
  if (rizo) {
    const r = amp * 0.7 + ancho * 2.5, cx = cabeza.x + px * r, cy = cabeza.y + py * r, a0 = Math.atan2(-py, -px);
    for (let i = 1; i <= 9; i++) { const a = a0 + i * (Math.PI * 1.5 / 9), rr = r * (1 - i * 0.05); pts.push({ x: cx + Math.cos(a) * rr, y: cy + Math.sin(a) * rr }); }
  }
  const camino = () => { c.beginPath(); c.moveTo(pts[0].x, pts[0].y); for (const p of pts.slice(1)) c.lineTo(p.x, p.y); };
  const degr = (col: string, a: number) => {
    const g = c.createLinearGradient(cola.x, cola.y, cabeza.x, cabeza.y);
    g.addColorStop(0, withAlpha(col, 0)); g.addColorStop(0.45, withAlpha(col, a)); g.addColorStop(1, withAlpha(col, a));
    return g;
  };
  c.lineCap = 'round'; c.lineJoin = 'round';
  camino(); c.strokeStyle = degr(borde, 0.4 * alpha); c.lineWidth = ancho + 2.5; c.stroke();
  camino(); c.strokeStyle = degr(color, alpha); c.lineWidth = ancho; c.stroke();
}

/** Torbellino en 3/4: un embudo de anillos que giran, estrecho abajo (en `base`) y ancho arriba. */
function torbellino(c: CanvasRenderingContext2D, base: Vec, r: number, alto: number, giro: number, alpha: number, claro: string, borde: string, cuerpo: string): void {
  const n = 9, niv: { x: number; y: number; r: number }[] = [];
  for (let i = 0; i < n; i++) {
    const f = i / (n - 1);
    niv.push({ x: base.x + Math.sin(giro * 0.35 + f * 3.2) * r * 0.22 * f, y: base.y - alto * f, r: r * (0.14 + 0.86 * Math.pow(f, 1.25)) });
  }
  c.globalAlpha = alpha * 0.3; c.fillStyle = cuerpo;
  c.beginPath();
  niv.forEach((q, i) => (i ? c.lineTo(q.x - q.r, q.y) : c.moveTo(q.x - q.r, q.y)));
  for (let i = n - 1; i >= 0; i--) c.lineTo(niv[i].x + niv[i].r, niv[i].y);
  c.closePath(); c.fill();
  c.lineCap = 'round';
  const lw = Math.max(1.4, r * 0.05);
  niv.forEach((q, i) => {
    const ry = q.r * 0.3;
    c.globalAlpha = alpha * 0.45; c.strokeStyle = borde; c.lineWidth = lw * 2;
    c.beginPath(); c.ellipse(q.x, q.y, q.r, ry, 0, 0, Math.PI * 2); c.stroke();
    c.globalAlpha = alpha * 0.8; c.strokeStyle = claro; c.lineWidth = lw;
    c.beginPath(); c.ellipse(q.x, q.y, q.r, ry, 0, 0, Math.PI * 2); c.stroke();
    // Un trazo grueso que da vueltas: es lo que hace que gire.
    const a0 = giro + i * 0.9;
    c.globalAlpha = alpha; c.lineWidth = lw * 2.2;
    c.beginPath(); c.ellipse(q.x, q.y, q.r, ry, 0, a0, a0 + 1.5); c.stroke();
  });
}

/** Cuchilla de aire en media luna, abombada hacia `ang`. `grueso` (0-0.5) es lo ancha que es en el centro. */
function mediaLuna(c: CanvasRenderingContext2D, x: number, y: number, r: number, ang: number, grueso: number, relleno: string, borde: string, alpha: number): void {
  const a = 1.2, d = r * grueso, ex = r * Math.cos(a), ey = r * Math.sin(a), R = Math.hypot(ex + d, ey), b = Math.atan2(ey, ex + d);
  c.save();
  c.translate(x, y); c.rotate(ang); c.globalAlpha *= alpha;
  c.beginPath(); c.arc(0, 0, r, -a, a); c.arc(-d, 0, R, b, -b, true); c.closePath();
  c.fillStyle = relleno; c.fill();
  c.lineWidth = Math.max(1.2, r * 0.05); c.strokeStyle = borde; c.stroke();
  c.restore();
}

/** Destello de cuatro puntas (cristal, estrellas de brillo). */
function destelloCruz(c: CanvasRenderingContext2D, x: number, y: number, r: number, rot: number, color: string, alpha: number): void {
  if (r <= 0.5 || alpha <= 0) return;
  c.save();
  c.translate(x, y); c.rotate(rot); c.globalAlpha *= alpha; c.fillStyle = color;
  c.beginPath();
  for (let i = 0; i < 4; i++) {
    const a = i * Math.PI / 2, b = a + Math.PI / 4, n = a + Math.PI / 2;
    if (i === 0) c.moveTo(Math.cos(a) * r, Math.sin(a) * r);
    c.quadraticCurveTo(Math.cos(b) * r * 0.12, Math.sin(b) * r * 0.12, Math.cos(n) * r, Math.sin(n) * r);
  }
  c.closePath(); c.fill();
  c.restore();
}

/** Labios de beso. `morro` 0-1 los frunce (más estrechos y altos). */
function labios(c: CanvasRenderingContext2D, x: number, y: number, tam: number, morro: number, alpha: number, giro = 0): void {
  c.save();
  c.translate(x, y); c.rotate(giro); c.scale(tam * (1 - 0.35 * morro), tam * (1 + 0.2 * morro)); c.globalAlpha *= alpha;
  c.lineJoin = 'round'; c.lineWidth = 0.09; c.strokeStyle = '#6a0a2e';
  c.beginPath(); c.moveTo(-1, 0.05);
  c.bezierCurveTo(-0.75, -0.35, -0.45, -0.58, -0.2, -0.44);
  c.quadraticCurveTo(0, -0.3, 0.2, -0.44);
  c.bezierCurveTo(0.45, -0.58, 0.75, -0.35, 1, 0.05);
  c.quadraticCurveTo(0, -0.04, -1, 0.05);
  c.fillStyle = '#ff2f6e'; c.fill(); c.stroke();
  c.beginPath(); c.moveTo(-1, 0.05);
  c.quadraticCurveTo(0, 0.14, 1, 0.05);
  c.bezierCurveTo(0.7, 0.6, -0.7, 0.6, -1, 0.05);
  c.fillStyle = '#ff5a8e'; c.fill(); c.stroke();
  c.beginPath(); c.ellipse(0.32, 0.3, 0.2, 0.06, -0.15, 0, Math.PI * 2); c.fillStyle = 'rgba(255,255,255,0.75)'; c.fill();
  c.restore();
}

/** Vena de ira (el símbolo de enfado de los dibujos animados). */
function venaIra(c: CanvasRenderingContext2D, x: number, y: number, tam: number, alpha: number): void {
  c.save();
  c.translate(x, y); c.scale(tam, tam); c.globalAlpha *= alpha; c.lineCap = 'round';
  for (const [w, col] of [[0.42, '#5a0808'], [0.24, '#ff3030']] as const) {
    c.lineWidth = w; c.strokeStyle = col;
    for (let i = 0; i < 4; i++) {
      c.save(); c.rotate(i * Math.PI / 2);
      c.beginPath(); c.moveTo(0.22, -0.95); c.quadraticCurveTo(0.22, -0.22, 0.95, -0.22); c.stroke();
      c.restore();
    }
  }
  c.restore();
}

/** Cola de dragón: un arco grueso que se afina de la base (a0) a la punta (a1), con escamas y punta de pica. */
function colaArco(c: CanvasRenderingContext2D, centro: Vec, r: number, a0: number, a1: number, grosor: number, pal: FxPalette, achatado = 1, alpha = 1): void {
  const n = 20, ext: Vec[] = [], int: Vec[] = [], mid: Vec[] = [];
  const en = (a: number, rr: number): Vec => ({ x: centro.x + Math.cos(a) * rr, y: centro.y + Math.sin(a) * rr * achatado });
  for (let i = 0; i <= n; i++) {
    const u = i / n, a = a0 + (a1 - a0) * u, w = grosor * (1 - 0.72 * u) / 2;
    ext.push(en(a, r + w)); int.push(en(a, r - w)); mid.push(en(a, r));
  }
  c.save();
  c.globalAlpha *= alpha; c.lineJoin = 'round'; c.lineCap = 'round';
  c.beginPath(); c.moveTo(ext[0].x, ext[0].y);
  for (const p of ext.slice(1)) c.lineTo(p.x, p.y);
  for (const p of int.reverse()) c.lineTo(p.x, p.y);
  c.closePath();
  const g = c.createLinearGradient(mid[0].x, mid[0].y, mid[n].x, mid[n].y);
  g.addColorStop(0, pal.dark); g.addColorStop(0.5, pal.core); g.addColorStop(1, pal.glow);
  c.fillStyle = g; c.fill();
  c.lineWidth = Math.max(1.5, grosor * 0.08); c.strokeStyle = pal.dark; c.stroke();
  // Escamas: uves claras a lo largo del lomo.
  c.strokeStyle = withAlpha(pal.hot, 0.8); c.lineWidth = Math.max(1, grosor * 0.05);
  for (let i = 2; i < n - 1; i += 2) {
    const p = mid[i], q = mid[i + 1], ang = Math.atan2(q.y - p.y, q.x - p.x), w = grosor * (1 - 0.72 * i / n) * 0.28;
    c.beginPath();
    c.moveTo(p.x + Math.cos(ang + 2.4) * w, p.y + Math.sin(ang + 2.4) * w); c.lineTo(p.x, p.y); c.lineTo(p.x + Math.cos(ang - 2.4) * w, p.y + Math.sin(ang - 2.4) * w);
    c.stroke();
  }
  // Punta de pica.
  const p = mid[n], q = mid[n - 1], ang = Math.atan2(p.y - q.y, p.x - q.x), L = grosor * 0.75;
  c.beginPath();
  c.moveTo(p.x + Math.cos(ang) * L, p.y + Math.sin(ang) * L);
  c.lineTo(p.x + Math.cos(ang + 1.9) * L * 0.5, p.y + Math.sin(ang + 1.9) * L * 0.5);
  c.lineTo(p.x - Math.cos(ang) * L * 0.15, p.y - Math.sin(ang) * L * 0.15);
  c.lineTo(p.x + Math.cos(ang - 1.9) * L * 0.5, p.y + Math.sin(ang - 1.9) * L * 0.5);
  c.closePath();
  c.fillStyle = pal.glow; c.fill(); c.lineWidth = Math.max(1.5, grosor * 0.08); c.strokeStyle = pal.dark; c.stroke();
  c.restore();
}

/** Taladro girando: la forma `taladro` con rayas en espiral que corren por el cono. */
function taladroGirando(c: CanvasRenderingContext2D, x: number, y: number, tam: number, ang: number, fase: number, e: EstiloForma): void {
  forma(c, 'taladro', x, y, tam, ang, e);
  c.save();
  c.translate(x, y); c.rotate(ang); c.scale(tam, tam);
  c.beginPath(); c.moveTo(-0.8, -0.5); c.lineTo(1, 0); c.lineTo(-0.8, 0.5); c.closePath(); c.clip();
  c.lineCap = 'round';
  for (let j = 0; j < 4; j++) {
    const x0 = -0.95 + (((j / 4 + fase) % 1 + 1) % 1) * 1.9;
    c.lineWidth = 0.13; c.strokeStyle = 'rgba(90,50,8,0.55)';
    c.beginPath(); c.moveTo(x0, -0.6); c.lineTo(x0 + 0.4, 0.6); c.stroke();
    c.lineWidth = 0.06; c.strokeStyle = 'rgba(255,250,220,0.85)';
    c.beginPath(); c.moveTo(x0 + 0.1, -0.6); c.lineTo(x0 + 0.5, 0.6); c.stroke();
  }
  c.restore();
}

/** Contorno cerrado suave por puntos (curvas por los puntos medios). */
function cerradoSuave(c: CanvasRenderingContext2D, pts: [number, number][]): void {
  const n = pts.length, m = (a: [number, number], b: [number, number]): [number, number] => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const ini = m(pts[n - 1], pts[0]);
  c.beginPath(); c.moveTo(ini[0], ini[1]);
  for (let i = 0; i < n; i++) { const p = pts[i], q = m(p, pts[(i + 1) % n]); c.quadraticCurveTo(p[0], p[1], q[0], q[1]); }
  c.closePath();
}

/** Espejo ovalado con marco plateado; `ancho` 0-1 lo estrecha (al voltearse) y `brillo` 0-1 pasa un reflejo. */
function espejo(c: CanvasRenderingContext2D, x: number, y: number, tam: number, ancho: number, brillo: number, alpha: number): void {
  c.save();
  c.translate(x, y); c.scale(Math.max(0.05, Math.abs(ancho)), 1); c.globalAlpha *= alpha;
  const rx = tam * 0.62, ry = tam;
  c.beginPath(); c.ellipse(0, 0, rx * 1.16, ry * 1.1, 0, 0, Math.PI * 2);
  c.fillStyle = ancho >= 0 ? '#d6dcea' : '#8e98b0'; c.fill(); c.lineWidth = 2.5; c.strokeStyle = '#3a4060'; c.stroke();
  c.beginPath(); c.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
  const g = c.createLinearGradient(-rx, -ry, rx, ry);
  g.addColorStop(0, '#eaf6ff'); g.addColorStop(0.5, '#9cc8ff'); g.addColorStop(1, '#d8ebff');
  c.fillStyle = g; c.fill(); c.lineWidth = 1.5; c.strokeStyle = '#4a6c9c'; c.stroke();
  c.clip();
  // Reflejo: una banda blanca en diagonal que cruza el cristal.
  const bx = lerp(-rx * 2, rx * 2, brillo);
  c.fillStyle = 'rgba(255,255,255,0.85)';
  c.beginPath(); c.moveTo(bx - rx * 0.3, -ry); c.lineTo(bx + rx * 0.05, -ry); c.lineTo(bx + rx * 0.35, ry); c.lineTo(bx, ry); c.closePath(); c.fill();
  c.fillStyle = 'rgba(255,255,255,0.5)';
  c.beginPath(); c.moveTo(bx + rx * 0.15, -ry); c.lineTo(bx + rx * 0.25, -ry); c.lineTo(bx + rx * 0.55, ry); c.lineTo(bx + rx * 0.45, ry); c.closePath(); c.fill();
  c.restore();
}

/** Brillitos (estrellas de partícula) alrededor de un punto. */
function brillos(k: Kit, at: Vec, n: number, r: number, colores: string[], retraso = 0): void {
  k.burst(n, i => {
    const a = rand(0, Math.PI * 2), d = rand(0.2, 1) * r;
    return { x: at.x + Math.cos(a) * d, y: at.y + Math.sin(a) * d * 0.8, vx: Math.cos(a) * 30, vy: -rand(20, 60), life: rand(380, 620), delay: retraso + i * 18, size: rand(3, 6), color: pick(colores), fadeIn: 0.25, shape: 'star', spin: rand(-3, 3) };
  });
}

/** Corazoncitos que salen disparados de un punto. */
function corazones(k: Kit, at: Vec, n: number, vel: number, retraso = 0): void {
  k.burst(n, i => {
    const a = rand(0, Math.PI * 2), v = rand(0.5, 1) * vel;
    return { x: at.x, y: at.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 40, drag: 2.5, ay: -40, life: rand(480, 700), delay: retraso + i * 12, size: rand(4.5, 7.5), color: pick(['#ff4f9a', '#ff8ac8', '#ffc4e4', '#ff2f6e']), fadeIn: 0.1, shape: 'heart', rot: rand(-0.4, 0.4) };
  });
}

/** Plumas sueltas (partículas) que salen de un punto y caen balanceándose. */
function plumasSueltas(k: Kit, at: Vec, n: number, vel: number, colores = ['#ffffff', '#e8f2ff', '#d0e2ff'], retraso = 0): void {
  k.burst(n, i => {
    const a = rand(0, Math.PI * 2), v = rand(0.4, 1) * vel;
    return { x: at.x, y: at.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 60, ay: 140, drag: 3, life: rand(520, 800), delay: retraso + i * 10, size: rand(4, 7), color: pick(colores), accent: '#8aa0c0', shape: 'leaf', rot: rand(0, 6), spin: rand(-6, 6) };
  });
}

export const FIRMAS: Record<string, Firma> = {
  // ============================== VOLADOR ==============================

  // Picotazo (35): un pico amarillo pequeño sale del usuario, da un picotazo seco y se retira; chispita blanca.
  async peck(k) {
    await k.anticipar(60);
    void k.embestida({ hasta: 0.3, ida: 110, vuelta: 200 });
    const tam = k.s(0.26), ms = 340, golpe = 0.5;
    const fin = Math.max(k.user.size * 0.4, k.dist - k.target.size * 0.2 - tam), ini = Math.max(k.user.size * 0.3, fin - k.s(0.9));
    k.dibujar(ms, (c, t) => {
      const u = t < golpe ? easeIn(t / golpe) : 1 - 0.4 * (t - golpe) / (1 - golpe);
      const p = delante(k, lerp(ini, fin, u));
      c.globalAlpha = aparece(t, 0.15, 0.3);
      forma(c, 'pico', p.x, p.y, tam, k.angle, PICO);
    }, { z: 1 });
    await k.esperar(ms * golpe);
    await k.impacto(t => {
      const p = { x: t.center.x - k.dir.x * t.size * 0.2, y: t.center.y - k.dir.y * t.size * 0.2 };
      k.add(E.starburst({ at: p, rays: 6, length: t.size * 0.35, width: 2, palette: PICO_FX, duration: 220 }));
      brillos(k, p, 3, t.size * 0.2, ['#ffffff', '#ffe58a']);
    });
    await k.despues();
  },

  // Picoteo (60): cuatro picotazos rápidos desde ángulos distintos y, con el último, le arranca una baya que vuela
  // hasta el usuario.
  async pluck(k) {
    await k.anticipar(60);
    void k.embestida({ hasta: 0.4, ida: 120, vuelta: 320 });
    const tam = k.s(0.22), cada = 90, n = 4, largo = k.s(0.6);
    for (let i = 0; i < n; i++) {
      const lado = (i % 2 ? 1 : -1) * k.s(i < 2 ? 0.2 : 0.1), ang = k.angle + (i % 2 ? -0.4 : 0.4);
      const blanco = { x: k.target.center.x + k.perp.x * lado - k.dir.x * k.s(0.15), y: k.target.center.y + k.perp.y * lado - k.dir.y * k.s(0.15) - (i === n - 1 ? k.s(0.15) : 0) };
      k.dibujar(160, (c, t) => {
        const u = t < 0.5 ? easeIn(t / 0.5) : 1 - (t - 0.5) / 0.5 * 0.7;
        const punta = { x: blanco.x - Math.cos(ang) * largo * (1 - u), y: blanco.y - Math.sin(ang) * largo * (1 - u) };
        c.globalAlpha = aparece(t, 0.15, 0.3);
        forma(c, 'pico', punta.x - Math.cos(ang) * tam, punta.y - Math.sin(ang) * tam, tam, ang, PICO);
      }, { delay: i * cada, z: 1 });
      if (i < n - 1) {
        k.add(E.ring({ at: blanco, from: 2, to: k.s(0.22), width: 2, color: '#ffffff', duration: 180, delay: i * cada + 80 }));
        k.burst(3, () => ({ x: blanco.x, y: blanco.y, vx: rand(-90, 90), vy: rand(-110, -20), drag: 3, life: 260, delay: i * cada + 80, size: rand(3, 4.5), color: pick(['#ffffff', '#ffe58a']), shape: 'star' }));
      }
    }
    await k.esperar((n - 1) * cada + 80);
    const acierta = k.acierta, desde = { x: k.target.center.x, y: k.target.center.y - k.s(0.15) };
    await k.impacto(t => {
      k.add(E.starburst({ at: desde, rays: 7, length: t.size * 0.4, width: 2.2, palette: PICO_FX, duration: 240 }));
      brillos(k, desde, 4, t.size * 0.25, ['#ffffff', '#ffe58a']);
    });
    // La baya arrancada salta hasta el usuario.
    if (acierta) {
      k.dibujar(420, (c, t) => {
        const p = entre(desde, k.posSprite(k.user), easeInOut(t)), y = p.y - k.s(0.6) * Math.sin(Math.PI * t), r = k.s(0.09);
        c.globalAlpha = aparece(t, 0.1, 0.2);
        c.beginPath(); c.arc(p.x, y, r, 0, Math.PI * 2); c.fillStyle = '#e8384a'; c.fill(); c.lineWidth = 1.5; c.strokeStyle = '#5a0a14'; c.stroke();
        c.beginPath(); c.arc(p.x - r * 0.35, y - r * 0.35, r * 0.28, 0, Math.PI * 2); c.fillStyle = '#ffc0c8'; c.fill();
        c.beginPath(); c.ellipse(p.x + r * 0.5, y - r * 1.05, r * 0.6, r * 0.25, -0.5, 0, Math.PI * 2); c.fillStyle = '#4caf3a'; c.fill(); c.strokeStyle = '#1d5c17'; c.lineWidth = 1; c.stroke();
      }, { z: 1 });
    }
    await k.despues();
  },

  // Pico Taladro (80): el usuario embiste con un taladro dorado girando delante, con espirales de aire alrededor; al
  // clavarse salen virutas y un anillo.
  async drillpeck(k) {
    const total = 600, tam = k.user.size * 0.5;
    const estilo: EstiloForma = { base: '#ffb84a', claro: '#ffe39a', oscuro: '#a8641a', borde: '#5a3208', brillo: '#fff0b0', brilloTam: tam * 0.4 };
    k.dibujar(total, (c, t, engine) => {
      const p = k.posSprite(k.user), d = k.user.size * 0.35 + tam * 0.85;
      const centro = { x: p.x + k.dir.x * d, y: p.y + k.dir.y * d };
      c.globalAlpha = aparece(t, 0.15, 0.2);
      // Espirales de aire alrededor del taladro.
      c.lineCap = 'round';
      for (const s of [0, Math.PI]) {
        c.beginPath();
        for (let i = 0; i <= 16; i++) {
          const u = i / 16, x = -u * tam * 2.4 + tam, o = Math.sin(u * 9 - engine.now / 30 + s) * tam * (0.3 + 0.5 * u);
          const q = { x: centro.x + k.dir.x * x + k.perp.x * o, y: centro.y + k.dir.y * x + k.perp.y * o };
          if (i) c.lineTo(q.x, q.y); else c.moveTo(q.x, q.y);
        }
        c.strokeStyle = withAlpha(AIRE_BORDE, 0.35); c.lineWidth = 4; c.stroke();
        c.strokeStyle = 'rgba(255,255,255,0.85)'; c.lineWidth = 2; c.stroke();
      }
      taladroGirando(c, centro.x, centro.y, tam, k.angle, engine.now / 70, estilo);
    }, { z: 1 });
    await k.esperar(120);
    await k.embestida({ hasta: 0.8, ida: 200, vuelta: 260, estela: VOLADOR.glow });
    await k.impacto(t => {
      const p = { x: t.center.x - k.dir.x * t.size * 0.25, y: t.center.y - k.dir.y * t.size * 0.25 };
      E.sparks(k.fx, p, { count: 14, speed: [140, 320], palette: PICO_FX, shape: 'shard', size: [2.5, 4.5] });
      k.add(E.ring({ at: p, from: 4, to: t.size * 0.75, width: 4, color: '#ffffff', duration: 260 }));
      // Virutas en espiral.
      k.burst(10, i => {
        const a = i / 10 * Math.PI * 2, v = rand(160, 260);
        return { x: p.x, y: p.y, vx: Math.cos(a) * v - Math.sin(a) * 120, vy: Math.sin(a) * v + Math.cos(a) * 120, drag: 3, life: 320, size: 2.2, color: pick(['#ffffff', '#ffe39a']), shape: 'streak', stretch: 40 };
      });
    });
    await k.esperar(100);
    await k.despues();
  },

  // Ataque Ala (60): dos alas grandes se abren a los lados del usuario y, mientras embiste, barren hacia delante y
  // golpean al objetivo como una palmada; salen plumas.
  async wingattack(k) {
    const abrir = 150, ida = 170, total = 620, tam = k.user.size * 0.6;
    k.dibujar(total, (c, t) => {
      const ms = t * total, p = k.posSprite(k.user);
      const abre = ms < abrir ? lerp(0.5, 2.0, easeOut(ms / abrir)) : ms < abrir + ida ? lerp(2.0, -0.1, easeIn((ms - abrir) / ida)) : -0.1;
      c.globalAlpha = Math.min(1, ms / 60) * (ms > abrir + ida + 80 ? Math.max(0, 1 - (ms - abrir - ida - 80) / 180) : 1);
      for (const s of [-1, 1]) {
        const a = k.angle + s * abre, raiz = { x: p.x + k.perp.x * s * k.user.size * 0.2, y: p.y + k.perp.y * s * k.user.size * 0.2 };
        forma(c, 'ala', raiz.x + Math.cos(a) * tam * 0.85, raiz.y + Math.sin(a) * tam * 0.85, tam, a, ALA, s < 0);
      }
    }, { z: 1 });
    await k.esperar(abrir);
    await k.embestida({ hasta: 0.7, ida, vuelta: 260, estela: VOLADOR.glow });
    await k.impacto(t => {
      for (const s of [-1, 1]) k.add(E.slash({ at: t.center, radius: t.size * 0.45, angle: k.angle + Math.PI + s * 1.2, sweep: 1.6, width: 6, palette: VOLADOR, duration: 260 }));
      plumasSueltas(k, t.center, 9, 220);
      k.add(E.ring({ at: t.center, from: 4, to: t.size * 0.8, width: 3, color: '#ffffff', duration: 260 }));
    });
    await k.despues();
  },

  // Pájaro Osado (120): el usuario se envuelve en un ave de fuego enorme (alas llameantes, pico y cola de llamas) y se
  // lanza contra el objetivo; estallido de llamas y plumas.
  async bravebird(k) {
    await k.cargaEpica();
    const total = 760, S = k.user.size, tamA = S * 0.95;
    const alaFuego: EstiloForma = { base: rellenoFuego, claro: '#ffe090', oscuro: '#a8200a', borde: '#6a1406', brillo: '#ff9a28', brilloTam: S * 0.5 };
    k.dibujar(total, (c, t, engine) => {
      const ms = t * total, p = k.posSprite(k.user);
      const abre = ms < 220 ? lerp(1.0, 1.75, easeOut(ms / 220)) : lerp(1.75, 2.25, Math.min(1, (ms - 220) / 200));
      const aleteo = ms < 220 ? Math.sin(ms / 35) * 0.25 : 0;
      c.globalAlpha = aparece(t, 0.12, 0.2);
      // Halo y cuerpo de fuego.
      c.drawImage(engine.glow(FUEGO.glow), p.x - S * 1.1, p.y - S * 1.1, S * 2.2, S * 2.2);
      // Cola de llamas detrás.
      for (let i = 0; i < 3; i++) {
        const q = { x: p.x - k.dir.x * S * 0.45 + k.perp.x * rand(-S * 0.2, S * 0.2), y: p.y - k.dir.y * S * 0.45 + k.perp.y * rand(-S * 0.2, S * 0.2) };
        k.emit({ x: q.x, y: q.y, vx: -k.dir.x * rand(160, 280) + rand(-30, 30), vy: -k.dir.y * rand(160, 280) - rand(10, 40), life: rand(240, 380), size: rand(6, 11), sizeEnd: 1.5, color: pick([FUEGO.core, FUEGO.glow, '#ffe08a']), shape: 'glow' });
      }
      for (const s of [-1, 1]) {
        const a = k.angle + s * (abre + aleteo), raiz = { x: p.x + k.perp.x * s * S * 0.15, y: p.y + k.perp.y * s * S * 0.15 };
        forma(c, 'ala', raiz.x + Math.cos(a) * tamA * 0.8, raiz.y + Math.sin(a) * tamA * 0.8, tamA, a, alaFuego, s < 0);
      }
      const cabeza = { x: p.x + k.dir.x * S * 0.62, y: p.y + k.dir.y * S * 0.62 };
      forma(c, 'pico', cabeza.x, cabeza.y, S * 0.32, k.angle, { base: '#ffd040', claro: '#fff0a0', oscuro: '#e06a10', borde: '#6a1406', brillo: '#ffb040', brilloTam: S * 0.2 });
    }, { z: 1 });
    void k.animar(k.user.sprite, [{ transform: 'translate(0px, 0px)' }, { transform: `translate(${-k.dir.x * 10}px, ${-k.dir.y * 10 - S * 0.25}px) scale(1.08, 1.08)` }], 220, 'ease-out');
    await k.esperar(220);
    await k.embestida({ hasta: 0.9, ida: 190, vuelta: 320, estela: FUEGO.glow });
    await k.impacto(t => {
      k.add(E.flash({ color: FUEGO.glow, alpha: 0.3, duration: 260 }));
      E.fireBurst(k.stage, t.center, FUEGO, t.size * 1.1);
      k.add(E.starburst({ at: t.center, rays: 12, length: t.size * 1.1, width: 4, palette: FUEGO, duration: 340 }));
      k.add(E.ring({ at: t.center, from: 6, to: t.size * 1.3, width: 6, color: FUEGO.glow, duration: 340 }));
      plumasSueltas(k, t.center, 12, 320, ['#ffd070', '#ff9a28', '#ffffff']);
    });
    await k.esperar(120);
    await k.despues();
  },

  // Ataque Aéreo (140): el usuario brilla, sube al cielo y desaparece; un destello crece en lo alto sobre el objetivo y
  // cae en picado como un ave de luz dorada; destello y onda enorme. Luego el usuario baja a su sitio.
  async skyattack(k) {
    await k.cargaEpica();
    const S = k.user.size, alto = k.user.center.y - k.stage.top + S * 1.6;
    void k.animar(k.user.sprite, [{ transform: 'translate(0px, 0px) scale(1, 1)' }, { transform: `translate(0px, ${-alto}px) scale(0.7, 1.35)` }], 220, 'cubic-bezier(0.5, 0, 0.9, 0.5)');
    k.burst(14, i => ({ x: k.user.center.x + rand(-S * 0.3, S * 0.3), y: k.user.center.y + rand(-S * 0.2, S * 0.3), vy: -rand(500, 800), life: 260, delay: i * 10, size: 2.4, color: pick(['#ffffff', '#ffe08a']), shape: 'streak', stretch: 50 }));
    await k.esperar(200);
    const cielo = { x: k.target.center.x - k.dir.x * k.s(0.4), y: Math.max(k.target.center.y - k.s(2.2), k.stage.top + k.s(0.6)) };
    // Estrella que se enciende en lo alto.
    k.dibujar(170, (c, t, engine) => {
      const r = k.s(0.5) * easeOut(t);
      c.drawImage(engine.glow('#ffe08a'), cielo.x - r * 2, cielo.y - r * 2, r * 4, r * 4);
      destelloCruz(c, cielo.x, cielo.y, r * 1.4, t * 2, '#ffffff', 1);
    }, { z: 1 });
    await k.esperar(160);
    // Picado: un ave de luz con las alas plegadas y una estela de luz desde el cielo.
    const dura = 170, a = Math.atan2(k.target.center.y - cielo.y, k.target.center.x - cielo.x), tam = k.s(0.6);
    const luz: EstiloForma = { base: '#fff6d0', claro: '#ffffff', oscuro: '#ffd060', borde: '#a87a10', brillo: '#ffe08a', brilloTam: tam * 0.6 };
    k.dibujar(dura + 120, (c, t, engine) => {
      const u = Math.min(1, t * (dura + 120) / dura), p = entre(cielo, k.target.center, easeIn(u));
      c.globalAlpha = t > 0.6 ? (1 - t) / 0.4 : 1;
      const g = c.createLinearGradient(cielo.x, cielo.y, p.x, p.y);
      g.addColorStop(0, 'rgba(255,224,138,0)'); g.addColorStop(1, 'rgba(255,248,220,0.9)');
      c.strokeStyle = g; c.lineCap = 'round'; c.lineWidth = tam * 0.5;
      c.beginPath(); c.moveTo(cielo.x, cielo.y); c.lineTo(p.x, p.y); c.stroke();
      if (u < 1) {
        c.drawImage(engine.glow('#ffe08a'), p.x - tam * 1.4, p.y - tam * 1.4, tam * 2.8, tam * 2.8);
        for (const s of [-1, 1]) {
          const aa = a + Math.PI + s * 0.45;
          forma(c, 'ala', p.x + Math.cos(aa) * tam * 0.7, p.y + Math.sin(aa) * tam * 0.7, tam, aa, luz, s > 0);
        }
      }
    }, { z: 1 });
    await k.esperar(dura);
    await k.impacto(t => {
      k.add(E.flash({ color: '#fff6d0', alpha: 0.5, duration: 300 }));
      k.add(E.starburst({ at: t.center, rays: 14, length: t.size * 1.4, width: 4, palette: { core: '#ffd060', glow: '#ffe08a', hot: '#ffffff', dark: '#a87a10' }, duration: 380 }));
      k.add(E.ring({ at: t.feet, from: 6, to: t.size * 1.8, width: 6, color: '#ffe08a', duration: 400, squash: 0.4 }));
      k.add(E.ring({ at: t.center, from: 4, to: t.size * 1.1, width: 4, color: '#ffffff', duration: 300 }));
      k.add(E.cracks({ at: t.feet, length: t.size * 0.9, color: '#5a4a30', duration: 600 }));
      plumasSueltas(k, t.center, 10, 300, ['#ffffff', '#fff0b0', '#ffe08a']);
    });
    // Vuelve: aparece encima de su sitio y baja.
    void k.animar(k.user.sprite, [{ opacity: 0 }, { opacity: 1 }], 220);
    void k.animar(k.user.sprite, [{ transform: `translate(0px, ${-S * 1.2}px) scale(1, 1)` }, { transform: 'translate(0px, 0px) scale(1.08, 0.92)', offset: 0.8 }, { transform: 'translate(0px, 0px) scale(1, 1)' }], 280, 'ease-out');
    await k.despues();
  },

  // Bote (85): el usuario se encoge y sale disparado hacia arriba fuera de la vista; su sombra corre hasta el
  // objetivo y crece, y cae aplastándolo; luego rebota de vuelta a su sitio.
  async bounce(k) {
    const S = k.user.size, spr = k.user.sprite;
    await k.animar(spr, [{ transform: 'scale(1, 1)' }, { transform: 'scale(1.25, 0.72)' }], 110, 'ease-out');
    const alto = Math.max(k.user.center.y, k.target.center.y) - k.stage.top + S * 1.8;
    void k.animar(spr, [{ transform: 'translate(0px, 0px) scale(1.25, 0.72)' }, { transform: `translate(0px, ${-alto * 0.3}px) scale(0.75, 1.3)`, offset: 0.25 }, { transform: `translate(0px, ${-alto}px) scale(0.8, 1.2)` }], 230, 'ease-out');
    k.add(E.ring({ at: k.user.feet, from: S * 0.2, to: S * 0.8, width: 3, color: '#ffffff', duration: 260, squash: 0.35 }));
    E.dust(k.stage, k.user.feet, S * 0.8);
    // La sombra: va de los pies del usuario a los del objetivo y crece mientras cae.
    const v = { x: k.target.center.x - k.user.center.x - k.dir.x * k.target.size * 0.1, y: k.target.center.y - k.user.center.y - k.target.size * 0.25 };
    const caida = 170, espera = 300;
    k.dibujar(espera + caida, (c, t) => {
      const ms = t * (espera + caida), u = Math.min(1, ms / 240), cae = ms > espera ? (ms - espera) / caida : 0;
      const p = entre(k.user.feet, k.target.feet, easeInOut(u)), r = k.target.size * lerp(0.15, 0.55, Math.max(easeIn(cae), u * 0.25));
      c.globalAlpha = 0.35 + 0.25 * cae; c.fillStyle = '#1a1420';
      c.beginPath(); c.ellipse(p.x, p.y, r, r * 0.35, 0, 0, Math.PI * 2); c.fill();
    });
    await k.esperar(espera);
    await k.animar(spr, [{ transform: `translate(${v.x}px, ${v.y - alto}px) scale(0.8, 1.25)` }, { transform: `translate(${v.x}px, ${v.y}px) scale(0.85, 1.2)` }], caida, 'cubic-bezier(0.55, 0, 1, 0.45)');
    void k.animar(spr, [
      { transform: `translate(${v.x}px, ${v.y}px) scale(1.3, 0.7)` },
      { transform: `translate(${v.x * 0.5}px, ${v.y * 0.5 - S * 1.2}px) scale(0.95, 1.05)`, offset: 0.55 },
      { transform: 'translate(0px, 0px) scale(1.1, 0.9)', offset: 0.9 },
      { transform: 'translate(0px, 0px) scale(1, 1)' },
    ], 420, 'ease-in-out');
    await k.impacto(t => {
      E.dust(k.stage, t.feet, t.size * 1.2);
      k.add(E.ring({ at: t.feet, from: t.size * 0.2, to: t.size * 1.2, width: 5, color: '#ffffff', duration: 320, squash: 0.35 }));
      k.add(E.starburst({ at: { x: t.center.x, y: t.top.y }, rays: 8, length: t.size * 0.6, width: 3, palette: VOLADOR, duration: 260 }));
      void k.animar(t.sprite, [{ transform: 'scale(1, 1)' }, { transform: 'translate(0px, 4px) scale(1.25, 0.7)', offset: 0.3 }, { transform: 'scale(1, 1)' }], 300);
    });
    await k.despues();
  },

  // Tornado (40): un torbellino pequeño de aire nace delante del usuario, avanza girando hasta el objetivo y lo zarandea.
  async gust(k) {
    await k.anticipar(60);
    const ms = 560, viaje = 300, r = k.s(0.32), alto = k.s(0.85), pies = { x: k.target.feet.x - k.target.center.x, y: k.target.feet.y - k.target.center.y };
    k.dibujar(ms, (c, t, engine) => {
      const tm = t * ms, u = Math.min(1, tm / viaje), p = k.punto(lerp(0.25, 1, easeInOut(u))), crece = lerp(0.5, 1, u);
      torbellino(c, { x: p.x + pies.x, y: p.y + pies.y }, r * crece, alto * crece, engine.now / 55, aparece(t, 0.12, 0.25), '#ffffff', AIRE_BORDE, VOLADOR.glow);
      if (Math.random() < 0.25) k.emit({ x: p.x + pies.x + rand(-r, r), y: p.y + pies.y, vx: rand(-60, 60), vy: -rand(40, 90), life: 400, size: 6, sizeEnd: 12, color: '#d8ccb8', alpha: 0.35, shape: 'smoke' });
    }, { z: 1 });
    await k.esperar(viaje);
    await k.impacto(t => {
      void k.animar(t.sprite, [{ transform: 'rotate(0deg)' }, { transform: 'translate(0px, -4px) rotate(-12deg)', offset: 0.3 }, { transform: 'translate(0px, -3px) rotate(10deg)', offset: 0.65 }, { transform: 'rotate(0deg)' }], 320);
      k.burst(6, () => { const a = rand(0, 6.28); return { x: t.center.x + Math.cos(a) * t.size * 0.4, y: t.center.y + Math.sin(a) * t.size * 0.2, vx: -Math.sin(a) * 220, vy: Math.cos(a) * 80 - 40, drag: 2, life: 300, size: 2, color: '#ffffff', shape: 'streak', stretch: 40 }; });
    });
    await k.esperar(140);
    await k.despues();
  },

  // Ciclón (40): dos torbellinos morados de dragón que avanzan enroscándose uno alrededor del otro y zarandean al
  // objetivo, con escamas de energía que saltan. Distinto de Tornado: doble, morado y en espiral.
  async twister(k) {
    await k.anticipar(60);
    const ms = 600, viaje = 320, r = k.s(0.24), alto = k.s(0.7), pies = { x: k.target.feet.x - k.target.center.x, y: k.target.feet.y - k.target.center.y };
    for (const fase of [0, Math.PI]) {
      k.dibujar(ms, (c, t, engine) => {
        const tm = t * ms, u = Math.min(1, tm / viaje), giro = fase + tm / 70, p = k.punto(lerp(0.2, 1, easeInOut(u)), Math.cos(giro) * k.s(0.3) * (1 - u * 0.6));
        torbellino(c, { x: p.x + pies.x, y: p.y + pies.y }, r, alto, engine.now / 45 + fase, aparece(t, 0.12, 0.25), MORADO.hot, MORADO.dark, MORADO.glow);
        if (Math.random() < 0.3) k.emit({ x: p.x + rand(-r, r), y: p.y + pies.y - rand(0, alto), vx: rand(-80, 80), vy: -rand(20, 80), life: 360, size: rand(2, 3.5), color: pick([DRAGON.glow, MORADO.core]), shape: 'shard', spin: rand(-8, 8) });
      }, { z: 1 });
    }
    await k.esperar(viaje);
    await k.impacto(t => {
      void k.girar(t.sprite, 1, 380);
      k.burst(8, () => { const a = rand(0, 6.28); return { x: t.center.x + Math.cos(a) * t.size * 0.45, y: t.center.y + Math.sin(a) * t.size * 0.22, vx: -Math.sin(a) * 240, vy: Math.cos(a) * 90 - 40, drag: 2, life: 320, size: 2, color: MORADO.glow, shape: 'streak', stretch: 40 }; });
    });
    await k.esperar(140);
    await k.despues();
  },

  // Vendaval (110): el cielo se oscurece, ráfagas de toda la vista convergen en el objetivo y un huracán gigante lo
  // engulle y lo levanta, con hojas y escombros girando.
  async hurricane(k) {
    k.add(E.dim({ at: k.target.center, duration: 1000, strength: 0.5 }));
    await k.cargar(140);
    const st = k.stage, b = k.target;
    // Ráfagas desde los bordes de la vista hacia el objetivo.
    for (let i = 0; i < 9; i++) {
      const a = k.angle + Math.PI + rand(-1.4, 1.4), lejos = Math.max(st.width, st.height) * 0.6;
      const ini = { x: b.center.x + Math.cos(a) * lejos, y: b.center.y + Math.sin(a) * lejos * 0.7 }, ret = rand(0, 160), fase = rand(0, 6);
      k.dibujar(420, (c, t) => {
        const cab = entre(ini, b.center, easeIn(t) * 0.92), cola = entre(ini, b.center, Math.max(0, easeIn(t) * 0.92 - 0.35));
        cintaViento(c, cola, cab, k.s(0.15), fase + t * 8, 3, '#ffffff', Math.sin(Math.PI * t));
      }, { delay: ret, z: 1 });
    }
    const ms = 900, R = k.s(0.9), alto = k.s(2.3);
    k.dibujar(ms, (c, t, engine) => {
      const tm = t * ms, crece = easeOutCubic(Math.min(1, tm / 260));
      torbellino(c, b.feet, R * crece, alto * crece, engine.now / 40, aparece(t, 0.08, 0.2), '#ffffff', '#2a3a5c', '#8aa0c0');
      // Hojas y escombros girando alrededor.
      if (Math.random() < 0.6) {
        const f = rand(0.1, 0.9), a = rand(0, 6.28), rr = R * (0.2 + 0.8 * f) * crece, y = b.feet.y - alto * f * crece;
        k.emit({ x: b.feet.x + Math.cos(a) * rr, y: y + Math.sin(a) * rr * 0.3, vx: -Math.sin(a) * 300, vy: Math.cos(a) * 90 - 60, drag: 1, life: 380, size: rand(3, 5.5), color: pick(['#6ab04a', '#a8c46a', '#8a6a44', '#ffffff']), accent: '#2a3a1a', shape: pick(['leaf', 'leaf', 'rock'] as const), spin: rand(-12, 12) });
      }
    }, { z: 1 });
    await k.esperar(340);
    await k.impacto(t => {
      void k.animar(t.sprite, [
        { transform: 'translate(0px, 0px) rotate(0deg)' },
        { transform: `translate(0px, ${-t.size * 0.45}px) rotate(-20deg)`, offset: 0.35 },
        { transform: `translate(0px, ${-t.size * 0.5}px) rotate(20deg)`, offset: 0.65 },
        { transform: 'translate(0px, 0px) rotate(0deg)' },
      ], 560, 'ease-in-out');
      k.add(E.ring({ at: t.feet, from: t.size * 0.3, to: t.size * 1.6, width: 5, color: '#ffffff', duration: 420, squash: 0.35 }));
      E.dust(k.stage, t.feet, t.size * 1.4);
    });
    await k.esperar(300);
    await k.despues();
  },

  // Aire Afilado (60): tres cuchillas de aire en media luna salen en abanico girando como bumeranes, se curvan y se
  // cruzan sobre el objetivo, dejando cortes finos.
  async aircutter(k) {
    await k.anticipar(70);
    const ms = 330;
    for (const b of blancos(k)) {
      const dx = b.center.x - k.user.center.x, dy = b.center.y - k.user.center.y, L = Math.hypot(dx, dy) || 1, px = -dy / L, py = dx / L;
      for (let i = 0; i < 3; i++) {
        const lado = (i - 1) * k.s(0.8) + (i === 1 ? k.s(0.25) : 0), r = k.s(0.2);
        k.dibujar(ms, (c, t, engine) => {
          const u = easeIn(t) * 0.6 + t * 0.4, o = lado * Math.sin(Math.PI * u);
          const p = { x: k.user.center.x + dx * u + px * o, y: k.user.center.y + dy * u + py * o };
          mediaLuna(c, p.x, p.y, r, engine.now / 35 + i * 2, 0.3, '#f4f9ff', AIRE_BORDE, Math.min(1, t * 6));
          if (Math.random() < 0.5) k.emit({ x: p.x, y: p.y, vx: -dx / L * 60, vy: -dy / L * 60, life: 180, size: 1.6, color: '#ffffff', shape: 'streak', stretch: 30 });
        }, { delay: i * 40, z: 1 });
      }
    }
    await k.esperar(ms + 80);
    await k.impacto(t => {
      for (let i = 0; i < 3; i++) k.add(E.slash({ at: t.center, radius: t.size * 0.35, angle: k.angle + Math.PI / 2 + (i - 1) * 0.9, sweep: 1.3, width: 3, palette: VOLADOR, duration: 220, delay: i * 40 }));
      E.sparks(k.fx, t.center, { count: 8, speed: [140, 260], palette: BLANCO, shape: 'streak', size: [1.5, 2.2] });
    });
    await k.despues();
  },

  // Tajo Aéreo (75): una única cuchilla de aire enorme, más alta que el objetivo, cruza a toda velocidad dejando
  // líneas de viento y lo parte con un tajo recto y largo.
  async airslash(k) {
    await k.anticipar(90);
    void k.animar(k.user.sprite, [{ transform: 'rotate(0deg)' }, { transform: 'rotate(-14deg)', offset: 0.35 }, { transform: 'rotate(10deg)', offset: 0.65 }, { transform: 'rotate(0deg)' }], 300);
    const ms = 220, R = k.s(0.7);
    k.dibujar(ms, (c, t, engine) => {
      const p = k.punto(lerp(0.15, 1, easeIn(t)));
      c.drawImage(engine.glow(VOLADOR.glow), p.x - R, p.y - R, R * 2, R * 2);
      mediaLuna(c, p.x, p.y, R, k.angle, 0.36, '#f8fbff', AIRE_BORDE, Math.min(1, t * 5));
      for (let i = 0; i < 2; i++) {
        const o = rand(-R, R), q = { x: p.x + k.perp.x * o - k.dir.x * R * 0.4, y: p.y + k.perp.y * o - k.dir.y * R * 0.4 };
        k.emit({ x: q.x, y: q.y, vx: k.dir.x * 80, vy: k.dir.y * 80, life: 220, size: 1.8, color: '#ffffff', shape: 'streak', stretch: 120 });
      }
    }, { z: 1 });
    await k.esperar(ms);
    await k.impacto(t => {
      // El corte: una línea larga que atraviesa al objetivo y se abre.
      const v = { x: k.perp.x * 0.95 + k.dir.x * 0.3, y: k.perp.y * 0.95 + k.dir.y * 0.3 }, L = t.size * 0.9;
      k.dibujar(320, (c, tt) => {
        const lar = easeOutCubic(Math.min(1, tt / 0.3)) * L, w = 6 * (1 - tt);
        c.globalAlpha = 1 - easeIn(tt); c.lineCap = 'round';
        for (const [col, ww] of [[AIRE_BORDE, w + 4], [VOLADOR.glow, w + 2], ['#ffffff', w]] as const) {
          c.strokeStyle = col; c.lineWidth = Math.max(0.5, ww);
          c.beginPath(); c.moveTo(t.center.x - v.x * lar, t.center.y - v.y * lar); c.lineTo(t.center.x + v.x * lar, t.center.y + v.y * lar); c.stroke();
        }
      }, { z: 1 });
      E.sparks(k.fx, t.center, { count: 12, speed: [180, 340], palette: VOLADOR, shape: 'streak', spread: [k.angle - 0.6, k.angle + 0.6] });
    });
    await k.despues();
  },

  // Danza Pluma (estado): el usuario gira y una lluvia de plumas blancas cae balanceándose sobre el objetivo hasta
  // cubrirlo.
  async featherdance(k) {
    void k.girar(k.user.sprite, 1, 420);
    plumasSueltas(k, k.user.center, 6, 160);
    const b = k.target, ms = 780;
    const plumas = Array.from({ length: 11 }, (_, i) => ({ x0: rand(-0.8, 0.8) * b.size, alto: rand(0.9, 1.6) * b.size, fase: rand(0, 6.28), ret: i * 32, tam: rand(0.13, 0.2) * b.size, fin: rand(-0.4, 0.4) * b.size, finY: rand(-0.3, 0.35) * b.size }));
    k.dibujar(ms, (c, t) => {
      const tm = t * ms;
      for (const f of plumas) {
        if (tm < f.ret) continue;
        const u = Math.min(1, (tm - f.ret) / (ms - 260)), e = easeOut(u), vaiven = Math.sin(u * Math.PI * 3 + f.fase);
        const x = b.center.x + lerp(f.x0, f.fin, e) + vaiven * b.size * 0.18 * (1 - e * 0.6), y = b.center.y + f.finY - f.alto * (1 - e);
        c.globalAlpha = Math.min(1, u * 5) * (t > 0.82 ? (1 - t) / 0.18 : 1);
        forma(c, 'pluma', x, y, f.tam, vaiven * 0.6 + 0.3, PLUMA);
      }
    }, { z: 1 });
    await k.esperar(560);
    await k.estado();
  },

  // Respiro (estado): el usuario se posa en el suelo, pliega dos alas sobre sí, caen unas plumas y una luz verde suave
  // lo cura.
  async roost(k) {
    const u = k.user, tam = u.size * 0.5;
    void k.animar(u.sprite, [{ transform: `translate(0px, ${-u.size * 0.25}px) scale(1, 1)` }, { transform: 'translate(0px, 0px) scale(1.12, 0.88)', offset: 0.5 }, { transform: 'translate(0px, 0px) scale(1, 1)' }], 380, 'ease-out');
    k.dibujar(820, (c, t) => {
      const p = k.posSprite(u), pliega = easeInOut(Math.min(1, t * 1.7));
      c.globalAlpha = aparece(t, 0.1, 0.25);
      for (const s of [-1, 1]) {
        const a = -Math.PI / 2 + s * lerp(1.35, 0.55, pliega), raiz = { x: p.x + s * u.size * 0.12, y: p.y + u.size * 0.05 };
        forma(c, 'ala', raiz.x + Math.cos(a) * tam * 0.7, raiz.y + Math.sin(a) * tam * 0.7, tam, a, ALA, s < 0);
      }
    }, { z: 1 });
    k.add(E.ring({ at: u.feet, from: u.size * 0.2, to: u.size * 0.8, width: 2.5, color: '#ffffff', duration: 300, squash: 0.35 }));
    plumasSueltas(k, { x: u.center.x, y: u.top.y }, 5, 90, undefined, 180);
    k.add(E.bloom({ at: u.center, radius: u.size * 0.8, color: CURA.glow, duration: 600, delay: 260 }));
    k.burst(12, i => ({ x: u.center.x + rand(-u.size * 0.4, u.size * 0.4), y: u.feet.y - rand(0, u.size * 0.3), vy: -rand(50, 90), life: 600, delay: 260 + i * 25, size: rand(4, 7), sizeEnd: 1, color: pick([CURA.core, CURA.glow, '#ffffff']), fadeIn: 0.3, shape: pick(['glow', 'star'] as const) }));
    await k.esperar(480);
    await k.estado();
  },

  // Viento Afín (estado): largas ráfagas con rizos soplan desde detrás del usuario y cruzan toda la vista a su favor,
  // arrastrando hojas; el usuario se inclina hacia delante.
  async tailwind(k) {
    const st = k.stage, d = k.dir, pp = k.perp, ms = 840, diag = Math.hypot(st.width, st.height);
    const cen = { x: st.left + st.width / 2, y: st.top + st.height / 2 };
    // La primera pasa por el usuario.
    const lu = (k.user.center.x - cen.x) * pp.x + (k.user.center.y - cen.y) * pp.y;
    const cintas = Array.from({ length: 10 }, (_, i) => ({ lado: i === 0 ? lu : (i / 9 - 0.5) * diag * 0.85 + rand(-20, 20), ret: i === 0 ? 0 : rand(40, 300), largo: rand(0.25, 0.45) * diag, amp: rand(6, 14), fase: rand(0, 6), ancho: i === 0 ? 4 : rand(2, 3.4) }));
    k.dibujar(ms, (c, t) => {
      const tm = t * ms;
      for (const q of cintas) {
        const u = (tm - q.ret) / 500;
        if (u < 0 || u > 1) continue;
        const s = lerp(-diag * 0.55, diag * 0.55 + q.largo, u);
        const cab = { x: cen.x + d.x * s + pp.x * q.lado, y: cen.y + d.y * s + pp.y * q.lado };
        cintaViento(c, { x: cab.x - d.x * q.largo, y: cab.y - d.y * q.largo }, cab, q.amp, q.fase + tm / 90, q.ancho, '#ffffff', 0.9 * Math.sin(Math.PI * u));
      }
    }, { z: 1 });
    k.burst(12, i => {
      const o = rand(-0.45, 0.45) * diag, s = -diag * rand(0.3, 0.55);
      return { x: cen.x + d.x * s + pp.x * o, y: cen.y + d.y * s + pp.y * o, vx: d.x * rand(380, 520), vy: d.y * rand(380, 520) + rand(-30, 30), life: 900, delay: i * 40, size: rand(3.5, 5.5), color: pick(['#6ab04a', '#a8c46a', '#ffffff']), accent: '#2a4a1a', shape: 'leaf', spin: rand(-8, 8) };
    });
    const g = d.x >= 0 ? 8 : -8;
    void k.animar(k.user.sprite, [{ transform: 'rotate(0deg)' }, { transform: `translate(${d.x * 6}px, ${d.y * 6}px) rotate(${g}deg)`, offset: 0.3 }, { transform: `translate(${d.x * 6}px, ${d.y * 6}px) rotate(${g}deg)`, offset: 0.75 }, { transform: 'rotate(0deg)' }], 720);
    await k.esperar(460);
    await k.estado();
  },

  // Despejar (estado): una niebla gris rodea al objetivo y una ráfaga ancha del usuario la barre y la deshace en jirones.
  async defog(k) {
    const b = k.target, ms = 860, barre = 330;
    const nubes = Array.from({ length: 10 }, () => ({ x: rand(-0.8, 0.8) * b.size, y: rand(-0.5, 0.6) * b.size, r: rand(0.3, 0.5) * b.size, v: rand(0.7, 1.4), lado: rand(-0.6, 0.6) }));
    k.dibujar(ms, (c, t) => {
      const tm = t * ms, llega = Math.min(1, tm / 160), empuje = tm < barre ? 0 : easeIn(Math.min(1, (tm - barre) / 420));
      for (const n of nubes) {
        const e = empuje * b.size * 2.4 * n.v, x = b.center.x + n.x + k.dir.x * e + k.perp.x * n.lado * e * 0.4, y = b.center.y + n.y + k.dir.y * e + k.perp.y * n.lado * e * 0.4;
        const a = 0.6 * llega * (1 - empuje), r = n.r * (1 + empuje * 0.8);
        if (a <= 0.01) continue;
        const g = c.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, `rgba(196, 200, 212, ${a})`); g.addColorStop(0.6, `rgba(180, 186, 200, ${a * 0.6})`); g.addColorStop(1, 'rgba(180, 186, 200, 0)');
        c.fillStyle = g; c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill();
      }
    });
    // La ráfaga que la barre.
    for (let i = 0; i < 5; i++) {
      const lado = (i - 2) * k.s(0.35), fase = rand(0, 6);
      k.dibujar(420, (c, t) => {
        const cab = k.punto(lerp(0.2, 1.6, easeOut(t)), lado), cola = k.punto(lerp(0, 1.0, easeOut(t)), lado);
        cintaViento(c, cola, cab, k.s(0.12), fase + t * 6, 3.5, '#ffffff', Math.sin(Math.PI * t));
      }, { delay: barre - 140 + i * 25, z: 1 });
    }
    await k.esperar(barre + 220);
    brillos(k, b.center, 6, b.size * 0.5, ['#ffffff', VOLADOR.glow]);
    await k.estado();
  },

  // Movimiento Espejo (estado): un espejo ovalado aparece delante del usuario, se voltea, un reflejo cruza el cristal y
  // destella mientras una copia del usuario se refleja en él.
  async mirrormove(k) {
    const p = delante(k, k.user.size * 0.8), tam = k.user.size * 0.5, ms = 760;
    k.dibujar(ms, (c, t) => {
      const tm = t * ms, gira = tm < 300 ? Math.cos(tm / 300 * Math.PI * 2) : 1;
      espejo(c, p.x, p.y - tam * 0.3, tam * Math.min(1, tm / 120), gira, tm < 320 ? 0 : (tm - 320) / 260, aparece(t, 0.1, 0.2));
    }, { z: 1 });
    k.sombra(k.user.sprite, { x: k.dir.x * k.user.size * 0.8, y: k.dir.y * k.user.size * 0.8 - tam * 0.3 }, VOLADOR.glow, 320, 360);
    await k.esperar(560);
    k.add(E.starburst({ at: { x: p.x, y: p.y - tam * 0.3 }, rays: 8, length: tam * 1.4, width: 2.5, palette: BLANCO, duration: 260 }));
    brillos(k, p, 6, tam, ['#ffffff', VOLADOR.glow]);
    await k.estado();
  },

  // ============================== HADA ==============================

  // Niebla Aromática (estado): volutas de perfume rosa suben enroscándose alrededor del compañero, con pétalos y brillos.
  async aromaticmist(k) {
    const b = k.hayObjetivo ? k.target : k.user, ms = 820;
    const volutas = Array.from({ length: 4 }, (_, i) => ({ fase: i * Math.PI / 2, x: (i / 3 - 0.5) * b.size * 0.8, alto: rand(1.1, 1.5) * b.size }));
    k.dibujar(ms, (c, t, engine) => {
      const crece = easeOut(Math.min(1, t * 1.6));
      c.globalAlpha = aparece(t, 0.1, 0.3); c.lineCap = 'round';
      for (const v of volutas) {
        c.beginPath();
        for (let i = 0; i <= 18; i++) {
          const u = i / 18 * crece, x = b.feet.x + v.x * (1 - u * 0.4) + Math.sin(u * Math.PI * 3 + v.fase + engine.now / 200) * b.size * 0.22, y = b.feet.y - u * v.alto;
          if (i) c.lineTo(x, y); else c.moveTo(x, y);
        }
        c.strokeStyle = 'rgba(176, 74, 146, 0.35)'; c.lineWidth = 5.5; c.stroke();
        c.strokeStyle = 'rgba(255, 196, 240, 0.95)'; c.lineWidth = 3; c.stroke();
      }
    }, { z: 1 });
    k.burst(6, i => ({ x: b.center.x + rand(-b.size * 0.4, b.size * 0.4), y: b.feet.y - rand(0, b.size * 0.4), vy: -rand(20, 50), life: 800, delay: i * 40, size: rand(12, 18), sizeEnd: 28, color: '#ffc4ec', alpha: 0.35, shape: 'smoke' }));
    k.burst(10, i => ({ x: b.center.x + rand(-b.size * 0.5, b.size * 0.5), y: b.feet.y - rand(0, b.size * 0.3), vx: rand(-30, 30), vy: -rand(50, 100), life: 800, delay: 100 + i * 30, size: rand(3, 5), color: pick(['#ffb6e6', '#ff8ad8', '#ffffff']), accent: '#b04a92', shape: 'leaf', spin: rand(-5, 5), fadeIn: 0.2 }));
    brillos(k, b.center, 6, b.size * 0.6, [HADA.glow, '#ffffff'], 200);
    await k.esperar(520);
    await k.estado();
  },

  // Campo de Niebla (estado): una neblina rosa pálido brota del usuario y se extiende por el suelo de toda la vista en
  // bandas bajas que ondulan, salpicada de destellos.
  async mistyterrain(k) {
    const st = k.stage, u = k.user, ms = 900;
    const bandas = Array.from({ length: 14 }, () => {
      const x = st.left + rand(0.05, 0.95) * st.width, y = st.top + rand(0.1, 0.95) * st.height;
      return { x, y, r: rand(0.18, 0.3) * st.width, ret: Math.hypot(x - u.center.x, y - u.center.y) / Math.max(st.width, st.height) * 360, fase: rand(0, 6) };
    });
    k.dibujar(ms, (c, t, engine) => {
      const tm = t * ms;
      for (const q of bandas) {
        const v = (tm - q.ret) / (ms - q.ret);
        if (v <= 0) continue;
        const a = 0.32 * Math.min(1, v * 3) * (t > 0.75 ? (1 - t) / 0.25 : 1), x = q.x + Math.sin(engine.now / 400 + q.fase) * 12;
        c.save(); c.translate(x, q.y); c.scale(1, 0.32);
        const g = c.createRadialGradient(0, 0, 0, 0, 0, q.r);
        g.addColorStop(0, `rgba(255, 214, 240, ${a})`); g.addColorStop(0.55, `rgba(255, 196, 236, ${a * 0.6})`); g.addColorStop(1, 'rgba(255, 196, 236, 0)');
        c.fillStyle = g; c.beginPath(); c.arc(0, 0, q.r, 0, Math.PI * 2); c.fill();
        c.restore();
      }
    });
    k.add(E.ring({ at: u.feet, from: u.size * 0.3, to: Math.max(st.width, st.height) * 0.5, width: 4, color: HADA.glow, duration: 600, squash: 0.4 }));
    k.burst(22, () => ({ x: st.left + rand(0.05, 0.95) * st.width, y: st.top + rand(0.1, 0.95) * st.height, vy: -rand(5, 20), life: rand(500, 700), delay: rand(100, 400), size: rand(3, 6), color: pick([HADA.glow, '#ffffff', HADA.core]), fadeIn: 0.4, shape: 'star', spin: rand(-2, 2) }));
    await k.esperar(520);
    await k.estado();
  },

  // Encanto (estado): el usuario se contonea, le sale un corazón enorme que late, vuela hasta el objetivo y estalla en
  // corazoncitos a su alrededor.
  async charm(k) {
    void k.animar(k.user.sprite, [{ transform: 'rotate(0deg)' }, { transform: 'rotate(-10deg)', offset: 0.25 }, { transform: 'rotate(10deg)', offset: 0.5 }, { transform: 'rotate(-6deg)', offset: 0.75 }, { transform: 'rotate(0deg)' }], 380);
    const T = 300, viaje = 260, tamB = k.user.size * 0.5, ini = { x: k.user.center.x, y: k.user.top.y - tamB * 0.4 };
    k.dibujar(T + viaje, (c, t) => {
      const tm = t * (T + viaje);
      let p = ini, tam: number;
      if (tm < T) tam = tamB * Math.min(1, tm / 120) * (1 + 0.16 * Math.abs(Math.sin(tm / 55)));
      else {
        const u = (tm - T) / viaje, e = easeIn(u);
        p = entre(ini, k.target.center, e); p = { x: p.x, y: p.y - k.s(0.6) * Math.sin(Math.PI * u) };
        tam = tamB * (1 - 0.25 * u);
      }
      forma(c, 'corazon', p.x, p.y, tam, 0, { ...CORAZON, brillo: HADA.core, brilloTam: tam * 0.6 });
    }, { z: 1 });
    await k.esperar(T + viaje);
    const b = k.target;
    k.add(E.ring({ at: b.center, from: 4, to: b.size * 0.9, width: 4, color: HADA.core, duration: 300 }));
    corazones(k, b.center, 14, 220);
    void k.agitar(b.sprite, 2, 300);
    await k.estado();
  },

  // Beso Dulce (estado): el usuario lanza un beso: unos labios rosas vuelan dejando corazoncitos, se estampan en el
  // objetivo y lo dejan mareado con corazones girando sobre su cabeza.
  async sweetkiss(k) {
    await k.anticipar(80);
    void k.recuperar({ x: -k.dir.x * 6, y: -k.dir.y * 6 }, 200);
    const viaje = 320, tam = k.s(0.2);
    k.dibujar(viaje, (c, t) => {
      const p = k.punto(lerp(0.15, 0.95, easeInOut(t)), k.s(0.3) * Math.sin(Math.PI * t));
      labios(c, p.x, p.y - k.s(0.2), tam, 1, Math.min(1, t * 5), Math.sin(t * 12) * 0.3);
      if (Math.random() < 0.4) k.emit({ x: p.x, y: p.y - k.s(0.2), vx: rand(-20, 20), vy: -rand(20, 50), life: 360, size: rand(3, 4.5), color: pick(['#ff6fb4', '#ffc4e4']), shape: 'heart' });
    }, { z: 1 });
    await k.esperar(viaje);
    const b = k.target, mejilla = { x: b.center.x + k.perp.x * b.size * 0.15, y: b.center.y - b.size * 0.1 };
    // El beso estampado.
    k.dibujar(600, (c, t) => {
      labios(c, mejilla.x, mejilla.y, tam * (1.6 - 0.5 * easeOutCubic(Math.min(1, t * 4))), 0.2, aparece(t, 0.05, 0.35), -0.2);
    }, { z: 1 });
    // Corazones que dan vueltas sobre la cabeza (mareo).
    k.dibujar(700, (c, t, engine) => {
      for (let i = 0; i < 3; i++) {
        const a = engine.now / 160 + i * Math.PI * 2 / 3, p = k.alrededor({ x: b.center.x, y: b.top.y }, b.size * 0.35, a, 0.35);
        c.globalAlpha = aparece(t, 0.15, 0.3);
        forma(c, 'corazon', p.x, p.y, b.size * 0.09, 0, CORAZON);
      }
    }, { z: 1, delay: 120 });
    corazones(k, mejilla, 6, 140);
    await k.esperar(300);
    await k.estado();
  },

  // Beso Drenaje (50): el usuario se acerca y unos labios grandes aparecen sobre el objetivo y le dan un beso sonoro
  // (se fruncen y chocan); después la vida vuelve al usuario.
  async drainingkiss(k) {
    await k.anticipar(70);
    void k.embestida({ hasta: 0.35, ida: 140, vuelta: 260 });
    const ms = 440, golpe = 250, b = k.target, at = { x: b.center.x, y: b.center.y - b.size * 0.05 };
    k.dibujar(ms, (c, t) => {
      const tm = t * ms, antes = tm < golpe;
      const morro = antes ? easeIn(tm / golpe) : 1 - 0.5 * (tm - golpe) / (ms - golpe);
      const tam = k.s(0.42) * (antes ? lerp(1.35, 0.85, easeIn(tm / golpe)) : 0.85 + 0.2 * easeOut((tm - golpe) / (ms - golpe)));
      labios(c, at.x, at.y, tam, morro, aparece(t, 0.1, 0.3));
    }, { z: 1 });
    await k.esperar(golpe);
    await k.impacto(t => {
      k.add(E.ring({ at: t.center, from: 4, to: t.size * 0.7, width: 3, color: HADA.core, duration: 260 }));
      corazones(k, t.center, 8, 200);
      brillos(k, t.center, 4, t.size * 0.4, ['#ffffff', HADA.glow]);
    });
    await k.despues();
  },

  // Voz Cautivadora (40): el usuario canta y de él salen ondas rosas en arco con notas y corazoncitos que flotan hasta
  // los objetivos.
  async disarmingvoice(k) {
    void k.animar(k.user.sprite, [{ transform: 'scale(1, 1)' }, { transform: 'scale(1.08, 0.94)', offset: 0.3 }, { transform: 'scale(0.96, 1.05)', offset: 0.6 }, { transform: 'scale(1, 1)' }], 360);
    const varios = blancos(k).length > 1, abre = varios ? 0.9 : 0.55;
    for (let i = 0; i < 4; i++) {
      k.dibujar(420, (c, t) => {
        const r = lerp(k.user.size * 0.4, k.dist * 1.05, easeOut(t));
        c.globalAlpha = Math.sin(Math.PI * t) * 0.9; c.lineCap = 'round';
        c.beginPath(); c.arc(k.user.center.x, k.user.center.y, r, k.angle - abre, k.angle + abre);
        c.strokeStyle = withAlpha(HADA.dark, 0.35); c.lineWidth = 6; c.stroke();
        c.strokeStyle = HADA.glow; c.lineWidth = 3; c.stroke();
      }, { delay: i * 70, z: 1 });
    }
    for (const b of blancos(k)) {
      for (let i = 0; i < 3; i++) {
        const lado = (i - 1) * k.s(0.35);
        k.dibujar(380, (c, t) => {
          const p = entre(k.user.center, b.center, easeOut(t)), o = lado * Math.sin(Math.PI * t) + Math.sin(t * 14 + i) * k.s(0.06);
          c.globalAlpha = aparece(t, 0.15, 0.2);
          forma(c, 'nota', p.x + k.perp.x * o, p.y + k.perp.y * o, k.s(0.16), Math.sin(t * 10 + i) * 0.3, { base: '#ff6fb4', borde: '#6a0a3a' });
        }, { delay: i * 60, z: 1 });
      }
    }
    await k.esperar(400);
    await k.impacto(t => {
      corazones(k, t.center, 6, 150);
      k.add(E.ring({ at: t.center, from: 4, to: t.size * 0.6, width: 3, color: HADA.glow, duration: 240 }));
    });
    await k.despues();
  },

  // Viento Feérico (40): una brisa rosa de cintas suaves con brillos sopla hacia el objetivo y lo rodea en una vuelta.
  async fairywind(k) {
    await k.anticipar(60);
    for (let i = 0; i < 3; i++) {
      const lado = (i - 1) * k.s(0.3), fase = i * 2;
      k.dibujar(340, (c, t) => {
        const cab = k.punto(lerp(0.15, 1, easeOut(t)), lado * Math.sin(Math.PI * t)), cola = k.punto(Math.max(0, lerp(0.15, 1, easeOut(t)) - 0.45), lado * 0.5);
        cintaViento(c, cola, cab, k.s(0.1), fase + t * 8, 3, '#ffd6f2', Math.sin(Math.PI * Math.min(1, t * 1.2)), true, HADA.dark);
        if (Math.random() < 0.3) k.emit({ x: cab.x, y: cab.y, vx: rand(-30, 30), vy: -rand(10, 40), life: 380, size: rand(2.5, 4), color: pick([HADA.glow, '#ffffff']), shape: 'star' });
      }, { delay: i * 40, z: 1 });
    }
    await k.esperar(330);
    await k.impacto(t => {
      // Una vuelta de brisa alrededor.
      k.dibujar(380, (c, tt) => {
        const a0 = tt * Math.PI * 2.4, r = t.size * 0.5;
        c.globalAlpha = Math.sin(Math.PI * tt); c.lineCap = 'round';
        for (const [col, w] of [[withAlpha(HADA.dark, 0.35), 5.5], ['#ffd6f2', 3]] as const) {
          c.strokeStyle = col; c.lineWidth = w;
          c.beginPath(); c.ellipse(t.center.x, t.center.y + t.size * 0.1, r, r * 0.4, 0, a0, a0 + 2.6); c.stroke();
        }
      }, { z: 1 });
      brillos(k, t.center, 6, t.size * 0.5, [HADA.glow, '#ffffff']);
    });
    await k.despues();
  },

  // Brillo Mágico (80): el usuario destella y la vista se llena de destellos de cristal rosas y blancos que barren
  // hasta los objetivos y estallan sobre ellos.
  async dazzlinggleam(k) {
    await k.cargar(120);
    k.add(E.flash({ color: HADA.hot, alpha: 0.35, duration: 280 }));
    const st = k.stage, u = k.user.center, lejos = Math.max(st.width, st.height);
    const glints = Array.from({ length: 18 }, () => {
      const x = st.left + rand(0.05, 0.95) * st.width, y = st.top + rand(0.05, 0.95) * st.height;
      return { x, y, r: rand(0.25, 0.6) * k.s(1), rot: rand(0, 0.8), ret: Math.hypot(x - u.x, y - u.y) / lejos * 320, col: pick(['#ffffff', HADA.glow, HADA.core, '#d8f4ff']) };
    });
    k.dibujar(720, (c, t, engine) => {
      const tm = t * 720;
      for (const g of glints) {
        const v = (tm - g.ret) / 280;
        if (v < 0 || v > 1) continue;
        const s = Math.sin(Math.PI * v), r = g.r * s;
        c.drawImage(engine.glow(HADA.glow), g.x - r, g.y - r, r * 2, r * 2);
        destelloCruz(c, g.x, g.y, r, g.rot + v, g.col, 1);
        destelloCruz(c, g.x, g.y, r * 0.5, g.rot + v + Math.PI / 4, '#ffffff', 0.9);
      }
    }, { z: 1 });
    k.add(E.sweep({ fromX: u.x, toX: u.x + k.dist + k.target.size, top: u.y - k.s(1.6), bottom: u.y + k.s(1.6), palette: HADA, duration: 460, look: 'light', rotate: { at: u, angle: k.angle } }));
    await k.esperar(300);
    await k.impacto(t => {
      k.add(E.starburst({ at: t.center, rays: 10, length: t.size * 0.9, width: 3, palette: HADA, duration: 320 }));
      k.dibujar(320, (c, tt) => { destelloCruz(c, t.center.x, t.center.y, t.size * 0.8 * Math.sin(Math.PI * tt), tt, '#ffffff', 1); }, { z: 1 });
      brillos(k, t.center, 8, t.size * 0.6, ['#ffffff', HADA.glow, '#d8f4ff']);
    });
    await k.esperar(150);
    await k.despues();
  },

  // Fuerza Lunar (95): la vista se oscurece, una gran luna creciente aparece sobre el usuario y se llena de luz, y
  // dispara un rayo rosa que estalla en el objetivo.
  async moonblast(k) {
    k.add(E.dim({ at: k.user.center, duration: 950, strength: 0.5 }));
    const R = k.user.size * 0.55, luna = { x: k.user.center.x - k.dir.x * k.user.size * 0.15, y: k.user.top.y - R * 1.2 };
    const estilo: EstiloForma = { base: (c) => { const g = c.createLinearGradient(-1, -1, 1, 1); g.addColorStop(0, '#fff8fe'); g.addColorStop(1, '#ffb4ea'); return g; }, borde: '#8a2a74', brillo: HADA.core, brilloTam: R * 0.8 };
    k.dibujar(880, (c, t, engine) => {
      const tm = t * 880, e = Math.min(1, tm / 200), carga = Math.min(1, tm / 420);
      c.globalAlpha = tm > 620 ? Math.max(0, 1 - (tm - 620) / 260) : 1;
      const h = R * (1.2 + 1.2 * carga);
      c.drawImage(engine.glow(HADA.glow), luna.x - h, luna.y - h, h * 2, h * 2);
      forma(c, 'luna', luna.x, luna.y, R * (0.4 + 0.6 * easeOutCubic(e)), -0.5, estilo);
      if (tm < 420 && Math.random() < 0.6) {
        const a = rand(0, 6.28), d = R * rand(1.6, 2.4);
        k.emit({ x: luna.x + Math.cos(a) * d, y: luna.y + Math.sin(a) * d, vx: -Math.cos(a) * d * 4, vy: -Math.sin(a) * d * 4, life: 240, size: 2.2, color: pick([HADA.glow, '#ffffff']), shape: 'streak', stretch: 30 });
      }
    }, { z: 1 });
    await k.esperar(420);
    k.add(E.beam({ from: luna, to: k.target.center, width: k.s(0.24), palette: HADA, duration: 400 }));
    await k.esperar(110);
    await k.impacto(t => {
      k.add(E.flash({ color: HADA.glow, alpha: 0.3, duration: 260 }));
      k.add(E.bloom({ at: t.center, radius: t.size * 1.2, color: HADA.core, duration: 380 }));
      k.add(E.starburst({ at: t.center, rays: 10, length: t.size * 1.0, width: 3.5, palette: HADA, duration: 340 }));
      for (let i = 0; i < 2; i++) k.add(E.ring({ at: t.center, from: 6, to: t.size * (0.9 + i * 0.5), width: 5 - i * 2, color: i ? '#ffffff' : HADA.core, duration: 320 + i * 80 }));
      brillos(k, t.center, 10, t.size * 0.7, ['#ffffff', HADA.glow, HADA.core]);
    });
    await k.esperar(160);
    await k.despues();
  },

  // Luz Lunar (estado): anochece un poco, una luna pequeña sale sobre el usuario y lo baña en un cono de luz plateada
  // con brillos que caen; se cura.
  async moonlight(k) {
    const u = k.user, R = u.size * 0.32, ms = 900;
    k.add(E.dim({ at: u.center, duration: ms, strength: 0.38 }));
    const estilo: EstiloForma = { base: '#fdfaff', claro: '#ffffff', borde: '#7a6a9a', brillo: '#e8e0ff', brilloTam: R * 0.9 };
    k.dibujar(ms, (c, t, engine) => {
      const sube = easeOutCubic(Math.min(1, t * 2)), luna = { x: u.center.x, y: u.top.y - u.size * (0.7 + 0.35 * sube) }, a = aparece(t, 0.15, 0.25);
      // Cono de luz de la luna a los pies.
      c.globalAlpha = a * 0.55;
      const g = c.createLinearGradient(luna.x, luna.y, luna.x, u.feet.y);
      g.addColorStop(0, 'rgba(240, 236, 255, 0.1)'); g.addColorStop(1, 'rgba(240, 236, 255, 0.7)');
      c.fillStyle = g;
      c.beginPath(); c.moveTo(luna.x - R * 0.4, luna.y); c.lineTo(luna.x + R * 0.4, luna.y); c.lineTo(u.feet.x + u.size * 0.55, u.feet.y); c.lineTo(u.feet.x - u.size * 0.55, u.feet.y); c.closePath(); c.fill();
      c.beginPath(); c.ellipse(u.feet.x, u.feet.y, u.size * 0.55, u.size * 0.18, 0, 0, Math.PI * 2); c.fill();
      c.globalAlpha = a;
      c.drawImage(engine.glow('#e8e0ff'), luna.x - R * 2.2, luna.y - R * 2.2, R * 4.4, R * 4.4);
      forma(c, 'luna', luna.x, luna.y, R, -0.4, estilo);
    });
    k.burst(14, i => ({ x: u.center.x + rand(-u.size * 0.45, u.size * 0.45), y: u.top.y - rand(0, u.size * 0.5), vy: rand(30, 60), life: 650, delay: 200 + i * 25, size: rand(3, 5.5), color: pick(['#ffffff', '#e8e0ff', HADA.glow]), fadeIn: 0.3, shape: 'star', spin: rand(-2, 2) }));
    k.add(E.bloom({ at: u.center, radius: u.size * 0.8, color: CURA.glow, duration: 500, delay: 380 }));
    await k.esperar(560);
    await k.estado();
  },

  // Carantoña (90): el usuario se lanza sobre el objetivo y los dos desaparecen en una nube de pelea de dibujos
  // animados, de la que salen estrellas, corazones, puños y pies.
  async playrough(k) {
    await k.anticipar(70);
    const v = llegada(k, 0.9), ida = 140, dentro = 440;
    const vaiven: Keyframe[] = [];
    for (let i = 1; i <= 5; i++) vaiven.push({ transform: `translate(${v.x + rand(-6, 6)}px, ${v.y + rand(-6, 6)}px) rotate(${rand(-20, 20)}deg)`, offset: (ida + dentro * i / 6) / (ida + dentro + 220) });
    void k.animar(k.user.sprite, [{ transform: 'translate(0px, 0px)' }, { transform: `translate(${v.x}px, ${v.y}px)`, offset: ida / (ida + dentro + 220) }, ...vaiven, { transform: `translate(${v.x}px, ${v.y}px)`, offset: (ida + dentro) / (ida + dentro + 220) }, { transform: 'translate(0px, 0px)' }], ida + dentro + 220);
    const c0 = { x: k.target.center.x - k.dir.x * k.s(0.2), y: k.target.center.y - k.s(0.05) }, R = k.s(0.75);
    const bolas = Array.from({ length: 11 }, (_, i) => ({ a: i / 11 * Math.PI * 2, d: rand(0.45, 0.65), r: rand(0.38, 0.5), f: rand(0, 6) }));
    const asoman: { t: number; a: number; que: 'puno' | 'pie' | 'estrella' | 'corazon' }[] = [
      { t: 80, a: -0.6, que: 'puno' }, { t: 170, a: 2.4, que: 'pie' }, { t: 250, a: 0.9, que: 'estrella' }, { t: 320, a: -2.2, que: 'puno' }, { t: 390, a: 1.9, que: 'corazon' },
    ];
    const total = dentro + 200;
    k.dibujar(total, (c, t, engine) => {
      const tm = t * total, entra = easeOutCubic(Math.min(1, tm / 100)), sale = tm > dentro ? (tm - dentro) / 200 : 0;
      c.globalAlpha = 1 - sale;
      const esc = R * entra * (1 + 0.3 * sale);
      // Lo que asoma por el borde (detrás de la nube).
      for (const q of asoman) {
        const u = (tm - q.t) / 120;
        if (u < 0 || u > 1) continue;
        const sal = Math.sin(Math.PI * u), p = { x: c0.x + Math.cos(q.a) * esc * (0.75 + 0.45 * sal), y: c0.y + Math.sin(q.a) * esc * 0.75 * (0.75 + 0.45 * sal) };
        const tam = k.s(0.2);
        if (q.que === 'puno' || q.que === 'pie') forma(c, q.que, p.x, p.y, tam, q.a, { base: '#fff0dc', claro: '#ffffff', oscuro: '#e0b890', borde: '#4a2a1a' }, Math.cos(q.a) < 0);
        else if (q.que === 'estrella') forma(c, 'estrella', p.x, p.y, tam, 0, { base: '#ffe14a', borde: '#8a5a00' });
        else forma(c, 'corazon', p.x, p.y, tam, 0, CORAZON);
      }
      // La nube: primero el borde de todas las bolas, luego el relleno (queda una silueta única).
      const bol = bolas.map(b => ({ x: c0.x + Math.cos(b.a + engine.now / 300) * esc * b.d, y: c0.y + Math.sin(b.a + engine.now / 300) * esc * b.d * 0.75, r: esc * b.r * (1 + 0.08 * Math.sin(engine.now / 50 + b.f)) }));
      bol.push({ x: c0.x, y: c0.y, r: esc * 0.6 });
      c.fillStyle = '#4a3a50';
      for (const b of bol) { c.beginPath(); c.arc(b.x, b.y, b.r + 2.5, 0, Math.PI * 2); c.fill(); }
      c.fillStyle = '#f8f0f6';
      for (const b of bol) { c.beginPath(); c.arc(b.x, b.y, b.r, 0, Math.PI * 2); c.fill(); }
      c.fillStyle = '#e8d8e6';
      for (const b of bol) { c.beginPath(); c.arc(b.x + b.r * 0.15, b.y + b.r * 0.2, b.r * 0.6, 0, Math.PI * 2); c.fill(); }
      // Líneas de pelea dentro.
      c.strokeStyle = '#4a3a50'; c.lineWidth = 2; c.lineCap = 'round';
      for (let i = 0; i < 3; i++) {
        const a = engine.now / 90 + i * 2.1, r = esc * 0.35;
        c.beginPath(); c.arc(c0.x + Math.cos(a * 1.3) * r * 0.4, c0.y + Math.sin(a) * r * 0.3, r * 0.5, a, a + 1.4); c.stroke();
      }
    }, { z: 1 });
    await k.esperar(ida + 180);
    await k.impacto(t => {
      k.burst(6, () => { const a = rand(0, 6.28); return { x: c0.x + Math.cos(a) * R * 0.8, y: c0.y + Math.sin(a) * R * 0.6, vx: Math.cos(a) * 200, vy: Math.sin(a) * 160 - 60, drag: 2, life: 420, size: rand(4, 6), color: pick(['#ffe14a', '#ffffff']), shape: 'star', spin: rand(-6, 6) }; });
      corazones(k, { x: t.center.x, y: t.top.y }, 5, 180);
    });
    await k.esperar(280);
    await k.despues();
  },

  // ============================== DRAGÓN ==============================

  // Dragoaliento (60): el usuario abre la boca y suelta un cono de aliento de llamas verdes y azules que se abre hasta
  // envolver al objetivo, con chispas.
  async dragonbreath(k) {
    await k.anticipar(80);
    void k.recuperar({ x: -k.dir.x * 8, y: -k.dir.y * 8 }, 420);
    const ms = 480, boca = delante(k, k.user.size * 0.35), abre = 0.3, L = Math.max(1, k.dist - k.user.size * 0.35 + k.target.size * 0.4);
    k.dibujar(ms, (c, t) => {
      const alc = easeOutCubic(Math.min(1, t / 0.4)) * L, a = t > 0.7 ? (1 - t) / 0.3 : 1;
      const g = c.createLinearGradient(boca.x, boca.y, boca.x + k.dir.x * L, boca.y + k.dir.y * L);
      g.addColorStop(0, 'rgba(200, 255, 230, 0.8)'); g.addColorStop(0.4, 'rgba(90, 230, 170, 0.5)'); g.addColorStop(1, 'rgba(60, 120, 255, 0.25)');
      c.globalAlpha = a; c.fillStyle = g;
      c.beginPath(); c.moveTo(boca.x, boca.y);
      for (let i = 0; i <= 10; i++) {
        const an = k.angle - abre + 2 * abre * i / 10, rr = alc * (0.92 + 0.08 * Math.sin(i * 2.3 + t * 30));
        c.lineTo(boca.x + Math.cos(an) * rr, boca.y + Math.sin(an) * rr);
      }
      c.closePath(); c.fill();
      for (let i = 0; i < 4; i++) {
        const an = k.angle + rand(-abre, abre), v = rand(1.6, 2.4) * L;
        k.emit({ x: boca.x, y: boca.y, vx: Math.cos(an) * v, vy: Math.sin(an) * v, drag: 1.5, life: rand(300, 420), size: rand(4, 7), sizeEnd: rand(10, 16), color: pick(['#5af0b0', '#3ad0ff', '#a8ffe0', '#4a7aff']), shape: 'glow' });
      }
    }, { z: 1 });
    await k.esperar(ms * 0.5);
    await k.impacto(t => {
      k.burst(18, () => { const a = rand(0, 6.28), v = rand(60, 220); return { x: t.center.x, y: t.center.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 60, ay: -200, drag: 2.5, life: rand(320, 520), size: rand(5, 9), sizeEnd: 2, color: pick(['#5af0b0', '#3ad0ff', '#a8ffe0']), shape: 'glow' }; });
      for (let i = 0; i < 2; i++) k.add(E.bolt({ from: k.enCuerpo(t, 0.4), to: k.enCuerpo(t, 0.4), palette: { core: '#7affd0', glow: '#c8fff0', hot: '#ffffff', dark: '#0a5a4a' }, duration: 160, width: 1.5, branches: 0, delay: i * 60 }));
    });
    await k.esperar(160);
    await k.despues();
  },

  // Garra Dragón (80): unas garras moradas enormes y brillantes desgarran al objetivo en diagonal (se dibujan de un
  // tirón) y dejan tres zarpazos que se apagan.
  async dragonclaw(k) {
    await k.anticipar(80);
    void k.embestida({ hasta: 0.55, ida: 130, vuelta: 260 });
    const c0 = k.target.center, tam = k.s(0.8), ms = 560, raja = 150, rot = k.dir.x >= 0 ? 0 : Math.PI / 2;
    const estilo: EstiloForma = { base: (c) => { const g = c.createLinearGradient(-1, -1, 1, 1); g.addColorStop(0, '#5a2ad8'); g.addColorStop(0.5, '#a070ff'); g.addColorStop(1, '#f0e4ff'); return g; }, borde: '#1e0a4a', brillo: MORADO.core, brilloTam: tam * 0.25 };
    k.dibujar(ms, (c, t, engine) => {
      const tm = t * ms - 80;
      if (tm < 0) return;
      const revela = easeOut(Math.min(1, tm / raja)), fuera = tm > raja + 120 ? (tm - raja - 120) / (ms - 80 - raja - 120) : 0;
      c.globalAlpha = 1 - easeIn(Math.min(1, fuera));
      c.save();
      c.translate(c0.x, c0.y); c.rotate(rot);
      c.beginPath(); c.rect(-1.3 * tam, -1.3 * tam, 2.6 * tam * revela, 2.6 * tam); c.clip();
      forma(c, 'garras', 0, 0, tam * (1 + 0.06 * fuera), 0, estilo);
      c.restore();
      // La punta que va rasgando.
      if (revela < 1) {
        const x = -1.1 * tam + 2.2 * tam * revela, cs = Math.cos(rot), sn = Math.sin(rot), p = { x: c0.x + x * cs - x * sn, y: c0.y + x * sn + x * cs };
        c.drawImage(engine.glow(MORADO.glow), p.x - tam * 0.5, p.y - tam * 0.5, tam, tam);
      }
    }, { z: 1 });
    await k.esperar(80 + raja * 0.8);
    await k.impacto(t => {
      E.sparks(k.fx, t.center, { count: 16, speed: [160, 340], palette: MORADO, shape: 'shard', size: [2.5, 4.5] });
      k.add(E.ring({ at: t.center, from: 4, to: t.size * 0.8, width: 4, color: MORADO.glow, duration: 260 }));
    });
    await k.esperar(120);
    await k.despues();
  },

  // Danza Dragón (estado): un dragón de energía morado y rojo se enrosca alrededor del usuario subiendo en espiral,
  // con llamas, y el usuario se crece.
  async dragondance(k) {
    const u = k.user, S = u.size, ms = 900;
    k.dibujar(ms, (c, t, engine) => {
      const p = k.posSprite(u), avance = easeInOut(Math.min(1, t * 1.25)), n = 22;
      c.globalAlpha = aparece(t, 0.08, 0.2);
      const pts: { x: number; y: number; r: number; delante: boolean; u: number }[] = [];
      for (let j = 0; j <= n; j++) {
        const f = j / n, s = avance * 1.25 - (1 - f) * 0.65;
        if (s < 0) continue;
        const ang = s * Math.PI * 4 + engine.now / 400;
        pts.push({ x: p.x + Math.cos(ang) * S * 0.6, y: p.y + S * 0.5 - Math.min(1, s) * S * 1.2 + Math.sin(ang) * S * 0.2, r: S * (0.04 + 0.07 * f), delante: Math.sin(ang) > 0, u: f });
      }
      for (const q of pts) {
        c.globalAlpha = aparece(t, 0.08, 0.2) * (q.delante ? 1 : 0.45);
        c.beginPath(); c.arc(q.x, q.y, q.r, 0, Math.PI * 2);
        c.fillStyle = mix('#ff4a6a', MORADO.core, q.u); c.fill();
        c.lineWidth = 1.5; c.strokeStyle = MORADO.dark; c.stroke();
        if (Math.random() < 0.08) k.emit({ x: q.x, y: q.y, vy: -rand(40, 90), life: 300, size: q.r * 1.2, sizeEnd: 1, color: pick(['#ff6a4a', MORADO.glow, '#ffd0a0']), shape: 'glow' });
      }
      // La cabeza: más grande, con cuernos y un ojo.
      const h = pts[pts.length - 1], g = pts[pts.length - 2];
      if (h && g) {
        const ang = Math.atan2(h.y - g.y, h.x - g.x), r = S * 0.14;
        c.globalAlpha = aparece(t, 0.08, 0.2);
        c.drawImage(engine.glow(MORADO.glow), h.x - r * 2.5, h.y - r * 2.5, r * 5, r * 5);
        for (const s of [-1, 1]) forma(c, 'cuerno', h.x - Math.cos(ang) * r * 0.6, h.y - Math.sin(ang) * r * 0.6, r * 0.9, ang + Math.PI + s * 0.5, { base: '#ffe0a0', borde: MORADO.dark }, s > 0);
        c.beginPath(); c.ellipse(h.x, h.y, r * 1.3, r, ang, 0, Math.PI * 2); c.fillStyle = MORADO.core; c.fill(); c.lineWidth = 1.5; c.strokeStyle = MORADO.dark; c.stroke();
        c.beginPath(); c.arc(h.x + Math.cos(ang) * r * 0.4, h.y + Math.sin(ang) * r * 0.4 - r * 0.3, r * 0.25, 0, Math.PI * 2); c.fillStyle = '#ffe14a'; c.fill();
      }
    }, { z: 1 });
    void k.animar(u.sprite, [{ transform: 'translate(0px, 0px) scale(1, 1)' }, { transform: `translate(0px, ${-S * 0.12}px) scale(1.06, 1.06) rotate(-6deg)`, offset: 0.35 }, { transform: `translate(0px, ${-S * 0.12}px) scale(1.1, 1.1) rotate(6deg)`, offset: 0.65 }, { transform: 'translate(0px, 0px) scale(1, 1)' }], 760, 'ease-in-out');
    await k.esperar(620);
    k.add(E.ring({ at: u.center, from: S * 0.3, to: S * 1.1, width: 4, color: MORADO.glow, duration: 300 }));
    await k.estado();
  },

  // Pulso Dragón (85): una serpiente de energía azul y morada sale ondulando del usuario con unas fauces de dragón
  // delante que se cierran sobre el objetivo.
  async dragonpulse(k) {
    await k.cargar(130);
    const viaje = 300, ms = 640, w = k.s(0.16), tamF = k.s(0.42);
    const fauces: EstiloForma = { base: '#4a3ad8', claro: '#f4f0ff', borde: '#140a4a', brillo: DRAGON.glow, brilloTam: 12 };
    const camino = (s: number, tm: number): Vec => k.punto(s, k.s(0.28) * Math.sin(s * 9 - tm / 45) * Math.min(1, s * 4) * (1 - s * 0.4));
    k.dibujar(ms, (c, t, engine) => {
      const tm = t * ms, u = Math.min(1, tm / viaje), cab = lerp(0.12, 0.85, easeInOut(u)), fade = tm > viaje + 120 ? Math.max(0, 1 - (tm - viaje - 120) / 200) : 1;
      c.globalAlpha = fade; c.lineCap = 'round'; c.lineJoin = 'round';
      const pts: Vec[] = [];
      for (let i = 0; i <= 24; i++) pts.push(camino(lerp(0.08, cab, i / 24), tm));
      const trazar = () => { c.beginPath(); c.moveTo(pts[0].x, pts[0].y); for (const p of pts.slice(1)) c.lineTo(p.x, p.y); };
      for (const [col, ww] of [[withAlpha(DRAGON.dark, 0.5), w * 1.7], [MORADO.core, w * 1.15], [DRAGON.core, w * 0.8], [DRAGON.hot, w * 0.3]] as const) { trazar(); c.strokeStyle = col; c.lineWidth = ww; c.stroke(); }
      const h = pts[24], g = pts[22], ang = Math.atan2(h.y - g.y, h.x - g.x);
      c.drawImage(engine.glow(DRAGON.glow), h.x - tamF * 1.4, h.y - tamF * 1.4, tamF * 2.8, tamF * 2.8);
      const ap = u < 1 ? 1 : Math.max(0, 1 - (tm - viaje) / 80);
      c.save(); c.translate(h.x + Math.cos(ang) * tamF * 0.5, h.y + Math.sin(ang) * tamF * 0.5); c.rotate(ang);
      mandibula(c, 0, 0, tamF, ap, fauces);
      c.restore();
      if (Math.random() < 0.5) k.emit({ x: h.x, y: h.y, vx: -Math.cos(ang) * 80 + rand(-40, 40), vy: -Math.sin(ang) * 80 + rand(-40, 40), life: 300, size: rand(3, 6), sizeEnd: 0, color: pick([DRAGON.glow, MORADO.glow]), shape: 'glow' });
    }, { z: 1 });
    await k.esperar(viaje + 70);
    await k.impacto(t => {
      k.add(E.bloom({ at: t.center, radius: t.size * 1.0, color: DRAGON.glow, duration: 320 }));
      for (let i = 0; i < 3; i++) k.add(E.ring({ at: t.center, from: 4, to: t.size * (0.6 + i * 0.3), width: 3, color: i % 2 ? MORADO.glow : DRAGON.glow, duration: 260, delay: i * 60 }));
      E.sparks(k.fx, t.center, { count: 14, speed: [140, 300], palette: DRAGON, shape: 'shard' });
    });
    await k.esperar(150);
    await k.despues();
  },

  // Carga Dragón (100): el usuario se cubre con la silueta de una cabeza de dragón de energía (cuernos y ojos rojos) y
  // embiste con fuerza aplastante: el suelo se agrieta y una onda lo sacude todo.
  async dragonrush(k) {
    k.add(E.dim({ at: k.user.center, duration: 760, strength: 0.4 }));
    const S = k.user.size, ms = 800, voltea = k.dir.x < 0 ? -1 : 1;
    const cabeza: [number, number][] = [[-0.75, -0.45], [-0.1, -0.55], [0.55, -0.35], [1.05, -0.12], [1.05, 0.12], [0.5, 0.25], [0.1, 0.45], [-0.75, 0.45]];
    k.dibujar(ms, (c, t, engine) => {
      const p = k.posSprite(k.user), a = aparece(t, 0.2, 0.2), T = S * 0.85;
      c.globalAlpha = a;
      c.drawImage(engine.glow(MORADO.core), p.x - S * 1.2, p.y - S * 1.2, S * 2.4, S * 2.4);
      if (Math.random() < 0.7) k.emit({ x: p.x + rand(-S * 0.4, S * 0.4), y: p.y + rand(-S * 0.2, S * 0.4), vx: -k.dir.x * 120, vy: -k.dir.y * 120 - rand(60, 120), life: 320, size: rand(6, 10), sizeEnd: 1, color: pick([MORADO.core, MORADO.glow, '#ff6a8a']), shape: 'glow' });
      c.save();
      c.translate(p.x + k.dir.x * S * 0.15, p.y + k.dir.y * S * 0.15 - S * 0.1); c.rotate(k.angle); c.scale(T, T * voltea);
      c.globalAlpha = a * 0.4;
      cerradoSuave(c, cabeza); c.fillStyle = MORADO.core; c.fill();
      c.globalAlpha = a * 0.9; c.lineWidth = 0.05; c.strokeStyle = MORADO.glow; c.stroke();
      // Ojo rojo rasgado.
      c.globalAlpha = a;
      c.beginPath(); c.ellipse(0.35, -0.2, 0.16, 0.05, -0.25, 0, Math.PI * 2); c.fillStyle = '#ff3040'; c.fill();
      c.restore();
      // Cuernos hacia atrás.
      for (const s of [0, 1]) {
        const base = aEscenaLocal(p, k, S, -0.45 - s * 0.2, -0.45, voltea);
        forma(c, 'cuerno', base.x, base.y, S * (0.32 - s * 0.06), k.angle + Math.PI, { base: '#f0e0c0', borde: MORADO.dark }, voltea > 0);
      }
    }, { z: 1 });
    void k.agitar(k.user.sprite, 2, 200);
    await k.esperar(220);
    await k.embestida({ hasta: 0.85, ida: 170, vuelta: 300, estela: MORADO.core });
    await k.impacto(t => {
      k.add(E.flash({ color: MORADO.glow, alpha: 0.28, duration: 240 }));
      k.add(E.cracks({ at: t.feet, length: t.size * 1.0, color: '#3a2a4a', duration: 650 }));
      for (let i = 0; i < 2; i++) k.add(E.ring({ at: i ? t.feet : t.center, from: 6, to: t.size * (1.0 + i * 0.6), width: 5, color: i ? '#ffffff' : MORADO.glow, duration: 340, squash: i ? 0.35 : 1 }));
      k.add(E.starburst({ at: t.center, rays: 10, length: t.size * 1.0, width: 4, palette: MORADO, duration: 300 }));
      E.dust(k.stage, t.feet, t.size * 1.2);
    });
    await k.esperar(120);
    await k.despues();
  },

  // Cola Dragón (60): el usuario gira sobre sí y una cola de dragón escamada barre en arco y golpea al objetivo, que
  // sale despedido hacia atrás.
  async dragontail(k) {
    await k.anticipar(70);
    const v = llegada(k, 0.4), s = k.perp.y >= 0 ? 1 : -1, ms = 560;
    void k.animar(k.user.sprite, [{ transform: 'translate(0px, 0px) rotate(0deg)' }, { transform: `translate(${v.x}px, ${v.y}px) rotate(${s * 220}deg)`, offset: 0.45 }, { transform: `translate(${v.x}px, ${v.y}px) rotate(${s * 360}deg)`, offset: 0.65 }, { transform: `translate(0px, 0px) rotate(${s * 360}deg)` }], 560, 'ease-out');
    const centro = { x: k.user.center.x + v.x, y: k.user.center.y + v.y }, r = Math.max(k.user.size * 0.6, Math.hypot(k.target.center.x - centro.x, k.target.center.y - centro.y));
    const inicio = 90, barre = 260;
    k.dibujar(ms, (c, t) => {
      const tm = t * ms - inicio;
      if (tm < 0) return;
      const e = easeInOut(Math.min(1, tm / barre)), punta = k.angle - s * 1.9 + s * 2.6 * e;
      c.globalAlpha = tm > barre ? Math.max(0, 1 - (tm - barre) / (ms - inicio - barre)) : Math.min(1, tm / 60);
      colaArco(c, centro, r, punta - s * 1.5, punta, k.s(0.38), MORADO, 0.8);
    }, { z: 1 });
    await k.esperar(inicio + barre * 0.73);
    await k.impacto(t => {
      k.add(E.slash({ at: t.center, radius: t.size * 0.5, angle: k.angle + Math.PI - s * 0.3, sweep: 1.8, width: 6, palette: MORADO, duration: 240 }));
      E.sparks(k.fx, t.center, { count: 12, speed: [180, 340], palette: MORADO, shape: 'streak', spread: [k.angle - 0.8, k.angle + 0.8] });
    });
    // Sale despedido hacia atrás.
    if (k.acierta) {
      const d = k.s(0.6);
      void k.animar(k.target.sprite, [{ transform: 'translate(0px, 0px) rotate(0deg)' }, { transform: `translate(${k.dir.x * d}px, ${k.dir.y * d - k.s(0.2)}px) rotate(${s * 25}deg)`, offset: 0.4 }, { transform: `translate(${k.dir.x * d * 1.1}px, ${k.dir.y * d * 1.1}px) rotate(0deg)`, offset: 0.6 }, { transform: 'translate(0px, 0px) rotate(0deg)' }], 520, 'ease-out');
      E.dust(k.stage, { x: k.target.feet.x + k.dir.x * d, y: k.target.feet.y + k.dir.y * d }, k.target.size * 0.8);
    }
    await k.despues();
  },

  // Vasto Impacto (60): una cola enorme y oscura barre a ras de suelo en un semicírculo gigante delante del usuario,
  // arrastrando polvo, y golpea a todos los rivales.
  async breakingswipe(k) {
    await k.anticipar(90);
    const s = k.perp.y >= 0 ? 1 : -1, oscuro: FxPalette = { core: '#4a2a8a', glow: '#9a7aff', hot: '#e0d4ff', dark: '#160830' };
    void k.animar(k.user.sprite, [{ transform: 'rotate(0deg)' }, { transform: `rotate(${-s * 25}deg)`, offset: 0.3 }, { transform: `rotate(${s * 35}deg)`, offset: 0.7 }, { transform: 'rotate(0deg)' }], 460, 'ease-in-out');
    const centro = k.user.feet;
    const R = Math.max(...blancos(k).map(b => Math.hypot(b.feet.x - centro.x, (b.feet.y - centro.y) / 0.55))) + k.s(0.2);
    const ms = 520, barre = 280;
    k.dibujar(ms, (c, t) => {
      const tm = t * ms, e = easeInOut(Math.min(1, tm / barre)), punta = k.angle - s * 1.9 + s * 3.8 * e;
      c.globalAlpha = tm > barre ? Math.max(0, 1 - (tm - barre) / (ms - barre)) : Math.min(1, tm / 50);
      // La estela barrida en el suelo.
      c.save(); c.globalAlpha *= 0.25; c.fillStyle = oscuro.glow;
      c.beginPath(); c.moveTo(centro.x, centro.y);
      for (let i = 0; i <= 16; i++) { const a = k.angle - s * 1.9 + (punta - (k.angle - s * 1.9)) * i / 16; c.lineTo(centro.x + Math.cos(a) * R, centro.y + Math.sin(a) * R * 0.55); }
      c.closePath(); c.fill(); c.restore();
      colaArco(c, centro, R, punta - s * 1.6, punta, k.s(0.5), oscuro, 0.55);
      if (tm < barre && Math.random() < 0.6) k.emit({ x: centro.x + Math.cos(punta) * R, y: centro.y + Math.sin(punta) * R * 0.55, vx: rand(-60, 60), vy: -rand(20, 60), life: 600, size: rand(10, 16), sizeEnd: 24, color: TYPE_FX.Ground.glow, alpha: 0.4, shape: 'smoke' });
    });
    await k.esperar(barre * 0.6);
    await k.impacto(t => {
      E.dust(k.stage, t.feet, t.size);
      E.sparks(k.fx, t.center, { count: 10, speed: [160, 300], palette: oscuro, shape: 'shard' });
      k.add(E.ring({ at: t.center, from: 4, to: t.size * 0.8, width: 4, color: oscuro.glow, duration: 260 }));
    });
    await k.esperar(140);
    await k.despues();
  },

  // Enfado (120): el usuario estalla de rabia (aura roja, venas de ira y temblor) y se lanza tres veces seguidas
  // contra el objetivo, cada vez más fuerte.
  async outrage(k) {
    await k.cargaEpica();
    const S = k.user.size, ms = 1000;
    k.dibujar(ms, (c, t, engine) => {
      const p = k.posSprite(k.user), a = aparece(t, 0.1, 0.15), lat = 1 + 0.15 * Math.sin(engine.now / 40);
      c.globalAlpha = a * 0.8;
      c.drawImage(engine.glow(RABIA.core), p.x - S * lat, p.y - S * lat, S * 2 * lat, S * 2 * lat);
      if (Math.random() < 0.7) k.emit({ x: p.x + rand(-S * 0.4, S * 0.4), y: p.y + rand(-S * 0.1, S * 0.4), vy: -rand(90, 160), life: 300, size: rand(6, 10), sizeEnd: 1, color: pick([RABIA.core, RABIA.glow, MORADO.core]), shape: 'glow' });
      c.globalAlpha = a;
      venaIra(c, p.x + S * 0.35, p.y - S * 0.45, S * 0.16 * lat, 1);
      venaIra(c, p.x - S * 0.3, p.y - S * 0.3, S * 0.11 * lat, t > 0.2 ? 1 : 0);
    }, { z: 1 });
    await k.agitar(k.user.sprite, 4, 150);
    for (let i = 0; i < 2; i++) {
      await k.embestida({ hasta: 0.75, ida: 90, vuelta: 100, estela: RABIA.core });
      const p = { x: k.target.center.x - k.dir.x * k.target.size * 0.3, y: k.target.center.y - k.dir.y * k.target.size * 0.3 };
      if (k.acierta) {
        k.add(E.starburst({ at: p, rays: 7, length: k.s(0.5 + i * 0.15), width: 3, palette: RABIA, duration: 200 }));
        k.destello(k.target.sprite, 100);
      }
      await k.esperar(95);
    }
    await k.embestida({ hasta: 0.9, ida: 90, vuelta: 300, estela: RABIA.core });
    await k.impacto(t => {
      k.add(E.flash({ color: RABIA.glow, alpha: 0.3, duration: 240 }));
      k.add(E.starburst({ at: t.center, rays: 12, length: t.size * 1.2, width: 4, palette: RABIA, duration: 320 }));
      k.add(E.cracks({ at: t.feet, length: t.size * 0.9, color: '#3a1a1a', duration: 600 }));
      E.fireBurst(k.stage, t.center, RABIA, t.size);
      k.add(E.ring({ at: t.center, from: 6, to: t.size * 1.2, width: 5, color: RABIA.glow, duration: 320 }));
    });
    await k.despues();
  },

  // Golpe Bis (40): dos manos de canto moradas cortan al objetivo en X, una detrás de otra, cada una con una raja de luz.
  async dualchop(k) {
    await k.anticipar(60);
    void k.embestida({ hasta: 0.5, ida: 110, vuelta: 320 });
    const c0 = k.target.center, tam = k.s(0.3), L = k.s(0.6), cada = 160, ini = 50;
    const mano: EstiloForma = { base: '#b090ff', claro: '#e8dcff', borde: '#2e0e6a', brillo: MORADO.core, brilloTam: tam * 0.4 };
    for (const [i, lado] of [[0, 1], [1, -1]] as const) {
      const v = { x: lado * 0.62, y: 0.78 }, a = Math.atan2(v.y, v.x);
      k.dibujar(240, (c, t) => {
        const u = easeIn(Math.min(1, t / 0.6)), p = { x: c0.x - v.x * L + v.x * 2 * L * u, y: c0.y - v.y * L + v.y * 2 * L * u };
        c.globalAlpha = aparece(t, 0.1, 0.35); c.lineCap = 'round';
        // Raja de luz detrás de la mano.
        const ini2 = { x: c0.x - v.x * L, y: c0.y - v.y * L };
        for (const [col, w] of [[MORADO.core, 6], ['#ffffff', 2.5]] as const) { c.strokeStyle = col; c.lineWidth = w; c.beginPath(); c.moveTo(ini2.x, ini2.y); c.lineTo(p.x, p.y); c.stroke(); }
        // La mano de canto (aplastada) con los dedos de lado.
        c.save(); c.translate(p.x, p.y); c.rotate(a - lado * Math.PI / 2); c.scale(1, 0.55);
        forma(c, 'mano', 0, 0, tam, 0, mano);
        c.restore();
      }, { delay: ini + i * cada, z: 1 });
    }
    // El segundo corte, con sus propias chispas.
    k.burst(6, () => { const an = rand(0, 6.28); return { x: c0.x, y: c0.y, vx: Math.cos(an) * 180, vy: Math.sin(an) * 180, drag: 3, life: 260, delay: ini + cada + 110, size: 2, color: pick([MORADO.glow, '#ffffff']), shape: 'streak', stretch: 30 }; });
    k.add(E.ring({ at: c0, from: 3, to: k.s(0.5), width: 3, color: MORADO.glow, duration: 220, delay: ini + cada + 110 }));
    await k.esperar(ini + 110);
    await k.impacto(t => {
      E.sparks(k.fx, t.center, { count: 8, speed: [140, 260], palette: MORADO, shape: 'streak' });
    });
    await k.esperar(Math.max(0, cada - 60));
    await k.despues();
  },
};


/** Punto de la cabeza de dragón de Carga Dragón (coordenadas locales de la cabeza → escenario). */
function aEscenaLocal(p: Vec, k: Kit, S: number, lx: number, ly: number, voltea: number): Vec {
  const T = S * 0.85, o = { x: p.x + k.dir.x * S * 0.15, y: p.y + k.dir.y * S * 0.15 - S * 0.1 }, y = ly * voltea;
  return { x: o.x + (lx * k.dir.x - y * k.dir.y) * T, y: o.y + (lx * k.dir.y + y * k.dir.x) * T };
}
