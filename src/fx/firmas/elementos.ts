// Firmas de movimientos (ver LEEME.md). Grupo: Fuego, Agua, Hielo y Eléctrico.
import type { FxEngine } from '../fx/engine';
import { E, NEUTRAL_FX, TYPE_FX, easeIn, easeOutCubic, lerp, pick, rand, withAlpha, type Firma, type FxPalette, type Kit, type SlotGeometry, type Vec } from './kit';
import { aEscena, contorno, forma, mandibula, type EstiloForma } from './formas';

const FUEGO = TYPE_FX.Fire;
// Degradado de fuego para rellenar formas (en coordenadas unidad de la forma: de la cola roja a la punta clara).
const rellenoFuego = (c: CanvasRenderingContext2D) => {
  const g = c.createLinearGradient(-1, 0, 1, 0);
  g.addColorStop(0, '#d8280c'); g.addColorStop(0.45, '#ff7a18'); g.addColorStop(0.8, '#ffc23a'); g.addColorStop(1, '#fff3b0');
  return g;
};
// Una llamita que sube desde `p` (para bordes de formas en llamas, cuerpos ardiendo…).
function llama(k: Kit, p: Vec, tam: number, vida = 320, empuje: Vec = { x: 0, y: 0 }): void {
  k.emit({ x: p.x, y: p.y, vx: empuje.x + rand(-20, 20), vy: empuje.y - rand(40, 110), life: vida * rand(0.7, 1.2), size: tam * rand(0.7, 1.2), sizeEnd: tam * 0.2, color: pick([FUEGO.core, FUEGO.glow, FUEGO.hot]), shape: 'glow' });
}

// ---- Paletas y rellenos del grupo ----
const AGUA = TYPE_FX.Water, HIELO = TYPE_FX.Ice, ELEC = TYPE_FX.Electric;
const LAVA: FxPalette = { core: '#e8400c', glow: '#ff9a2a', hot: '#ffe08a', dark: '#3a1008' };
const MAGIA: FxPalette = { core: '#b44cff', glow: '#e08aff', hot: '#ffe0ff', dark: '#3a0a5a' };
const FATUO: FxPalette = { core: '#3d7bff', glow: '#8cc8ff', hot: '#e8f6ff', dark: '#10205a' };
const CALOR_BLANCO: FxPalette = { core: '#ff8a2a', glow: '#ffe07a', hot: '#ffffff', dark: '#7a1606' };
const SAL: FxPalette = { core: '#2aa59a', glow: '#8ee0d4', hot: '#effffb', dark: '#0d4f5a' };
const rellenoAgua = (c: CanvasRenderingContext2D) => {
  const g = c.createLinearGradient(-1, -1, 1, 1);
  g.addColorStop(0, '#0b3d8a'); g.addColorStop(0.45, '#2f8dff'); g.addColorStop(0.8, '#7cc4ff'); g.addColorStop(1, '#e6f6ff');
  return g;
};
const rellenoHielo = (c: CanvasRenderingContext2D) => {
  const g = c.createLinearGradient(-1, -1, 1, 1);
  g.addColorStop(0, '#1d7c9c'); g.addColorStop(0.4, '#5fdcff'); g.addColorStop(0.75, '#bff4ff'); g.addColorStop(1, '#ffffff');
  return g;
};
const rellenoRayo = (c: CanvasRenderingContext2D) => {
  const g = c.createRadialGradient(0.2, 0, 0, 0, 0, 1.1);
  g.addColorStop(0, '#ffffff'); g.addColorStop(0.35, '#fff07a'); g.addColorStop(0.7, '#ffd21a'); g.addColorStop(1, '#e0a000');
  return g;
};

// ---- Ayudas comunes ----
// Ruido determinista en −1…1 (para que un rayo no cambie de forma en cada fotograma, solo cada pocos ms).
function ruido(i: number, semilla: number): number {
  const x = Math.sin(i * 12.9898 + semilla * 78.233) * 43758.5453;
  return (x - Math.floor(x)) * 2 - 1;
}
// Un valor que se rehace cada `ms` del reloj del motor (chisporroteo a ~20 fps, no a 60).
function cadaTanto<T>(ms: number, hacer: () => T): (ahora: number) => T {
  let paso = -1, valor = hacer();
  return ahora => { const p = Math.floor(ahora / ms); if (p !== paso) { paso = p; valor = hacer(); } return valor; };
}
// Ejecuta `fn` una vez dentro de `ms` (aterrizajes, rebotes, golpes secundarios sin parar la firma).
function alPasar(k: Kit, ms: number, fn: () => void): void {
  let hecho = false;
  k.dibujar(120, () => { if (!hecho) { hecho = true; fn(); } }, { delay: Math.max(0, ms) });
}
// Luz redonda de un tipo: halo, cuerpo y núcleo.
function orbe(c: CanvasRenderingContext2D, engine: FxEngine, p: Vec, r: number, pal: FxPalette, alpha = 1): void {
  c.globalCompositeOperation = engine.blend; c.globalAlpha = alpha;
  c.drawImage(engine.glow(pal.core), p.x - r * 2, p.y - r * 2, r * 4, r * 4);
  c.drawImage(engine.glow(pal.glow), p.x - r, p.y - r, r * 2, r * 2);
  c.drawImage(engine.glow(pal.hot), p.x - r * 0.5, p.y - r * 0.5, r, r);
  c.globalCompositeOperation = 'source-over';
}
// Camino quebrado de `a` a `b` (rayos).
function zigzag(a: Vec, b: Vec, n: number, amp: number, semilla = rand(0, 1000)): Vec[] {
  const dx = b.x - a.x, dy = b.y - a.y, l = Math.hypot(dx, dy) || 1, nx = -dy / l, ny = dx / l, pts: Vec[] = [];
  for (let i = 0; i <= n; i++) { const t = i / n, o = i === 0 || i === n ? 0 : ruido(i, semilla) * amp; pts.push({ x: a.x + dx * t + nx * o, y: a.y + dy * t + ny * o }); }
  return pts;
}
// Pinta un rayo por capas (halo, cuerpo, núcleo blanco).
function trazoRayo(c: CanvasRenderingContext2D, pts: Vec[], ancho: number, alpha = 1, pal: FxPalette = ELEC): void {
  if (pts.length < 2 || alpha <= 0) return;
  c.lineJoin = 'round'; c.lineCap = 'round';
  for (const [col, f, a] of [[pal.core, 2.6, 0.35], [pal.glow, 1.3, 0.9], [pal.hot, 0.5, 1]] as const) {
    c.globalAlpha = alpha * a; c.strokeStyle = col; c.lineWidth = Math.max(0.5, ancho * f);
    c.beginPath(); pts.forEach((p, i) => (i ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y))); c.stroke();
  }
}
// Arcos eléctricos que recorren el borde de un círculo (cuerpos cargados, bolas eléctricas).
interface Arco { a: number; b: number; sem: number }
const nuevosArcos = (n: number): Arco[] => Array.from({ length: n }, () => { const a = rand(0, Math.PI * 2); return { a, b: a + rand(0.7, 1.6), sem: rand(0, 1000) }; });
function arcosAlrededor(c: CanvasRenderingContext2D, p: Vec, r: number, arcos: Arco[], ancho: number, alpha = 1): void {
  for (const q of arcos) {
    const pts: Vec[] = [];
    for (let m = 0; m <= 4; m++) { const a = lerp(q.a, q.b, m / 4), rr = r * (1 + ruido(m, q.sem) * 0.22); pts.push({ x: p.x + Math.cos(a) * rr, y: p.y + Math.sin(a) * rr }); }
    trazoRayo(c, pts, ancho, alpha);
  }
}
// Anillo eléctrico dentado (Onda Trueno, Chispazo).
function anilloRayo(c: CanvasRenderingContext2D, x: number, y: number, r: number, achatado: number, n: number, amp: number, ancho: number, alpha: number, semilla: number): void {
  const pts: Vec[] = [];
  for (let i = 0; i <= n; i++) { const a = ((i % n) / n) * Math.PI * 2, rr = r + ruido(i % n, semilla) * amp; pts.push({ x: x + Math.cos(a) * rr, y: y + Math.sin(a) * rr * achatado }); }
  trazoRayo(c, pts, ancho, alpha);
}
// Unos rayitos que saltan de un punto.
function rayitos(k: Kit, at: Vec, r: number, n: number, ms = 200): void {
  for (let i = 0; i < n; i++) {
    const a = rand(0, Math.PI * 2), l = r * rand(0.7, 1.2);
    k.add(E.bolt({ from: at, to: { x: at.x + Math.cos(a) * l, y: at.y + Math.sin(a) * l }, palette: ELEC, duration: ms, width: 2.2, branches: 1, delay: i * 30 }));
  }
}
// Salpicadura de gotas que saltan y caen.
function salpicar(k: Kit, at: Vec, tam: number, n = 14, pal: FxPalette = AGUA): void {
  const e = Math.max(0.4, tam / 40);
  k.burst(n, () => {
    const a = rand(0, Math.PI * 2), v = rand(60, 200) * e;
    return { x: at.x + rand(-4, 4) * e, y: at.y + rand(-4, 4) * e, vx: Math.cos(a) * v, vy: Math.sin(a) * v * 0.6 - rand(120, 280) * Math.sqrt(e), ay: 900, life: rand(320, 520), size: rand(1.8, 3.4) * Math.min(1.6, Math.sqrt(e)), color: pick([pal.glow, pal.hot, pal.core]), shape: 'drop', stretch: 22 };
  });
}
// Burbuja de agua (aro, velo y brillo).
function burbuja(c: CanvasRenderingContext2D, x: number, y: number, r: number, alpha = 1): void {
  c.globalAlpha = alpha * 0.35; c.fillStyle = AGUA.glow; c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill();
  c.globalAlpha = alpha; c.strokeStyle = AGUA.core; c.lineWidth = Math.max(1, r * 0.14); c.stroke();
  c.strokeStyle = '#ffffff'; c.lineWidth = Math.max(1, r * 0.12); c.beginPath(); c.arc(x, y, r * 0.7, -2.6, -1.6); c.stroke();
  c.fillStyle = '#ffffff'; c.beginPath(); c.arc(x - r * 0.38, y - r * 0.38, r * 0.14, 0, Math.PI * 2); c.fill();
}
// Esfera de agua con volumen (Hidropulso, Salmuera, Empapar).
function esferaAgua(c: CanvasRenderingContext2D, x: number, y: number, r: number, pal: FxPalette = AGUA, alpha = 1): void {
  if (r <= 0.5) return;
  const g = c.createRadialGradient(x - r * 0.35, y - r * 0.35, r * 0.05, x, y, r);
  g.addColorStop(0, pal.hot); g.addColorStop(0.35, pal.glow); g.addColorStop(0.8, pal.core); g.addColorStop(1, pal.dark);
  c.globalAlpha = alpha * 0.9; c.fillStyle = g; c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill();
  c.globalAlpha = alpha; c.strokeStyle = pal.hot; c.lineWidth = Math.max(1, r * 0.08); c.stroke();
  c.fillStyle = '#ffffff'; c.beginPath(); c.ellipse(x - r * 0.38, y - r * 0.42, r * 0.22, r * 0.12, -0.6, 0, Math.PI * 2); c.fill();
}
// Charco en el suelo (óvalo achatado).
function charco(c: CanvasRenderingContext2D, x: number, y: number, rx: number, alpha = 1): void {
  if (rx <= 0.5 || alpha <= 0) return;
  const ry = rx * 0.42;
  c.globalAlpha = alpha * 0.75; c.fillStyle = AGUA.core; c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); c.fill();
  c.globalAlpha = alpha; c.strokeStyle = AGUA.glow; c.lineWidth = Math.max(1, rx * 0.07); c.stroke();
  c.globalAlpha = alpha * 0.6; c.strokeStyle = AGUA.hot; c.lineWidth = 1.5; c.beginPath(); c.ellipse(x - rx * 0.1, y - ry * 0.15, rx * 0.55, ry * 0.45, 0, Math.PI * 1.1, Math.PI * 1.7); c.stroke();
}
// Estela en cuña desde `desde` (fina) hasta `hasta` (ancha): chorros y cometas que acompañan una embestida.
function estelaCuna(c: CanvasRenderingContext2D, desde: Vec, hasta: Vec, ancho: number, cola: string, medio: string, punta: string, alpha = 1): void {
  const dx = hasta.x - desde.x, dy = hasta.y - desde.y, l = Math.hypot(dx, dy);
  if (l < 3 || alpha <= 0) return;
  const ux = dx / l, uy = dy / l, nx = -uy, ny = ux;
  const g = c.createLinearGradient(desde.x, desde.y, hasta.x, hasta.y);
  g.addColorStop(0, withAlpha(cola, 0)); g.addColorStop(0.6, withAlpha(medio, 0.8)); g.addColorStop(1, withAlpha(punta, 0.95));
  c.globalAlpha = alpha; c.fillStyle = g;
  c.beginPath(); c.moveTo(desde.x, desde.y); c.lineTo(hasta.x + nx * ancho, hasta.y + ny * ancho);
  c.quadraticCurveTo(hasta.x + ux * ancho * 1.4, hasta.y + uy * ancho * 1.4, hasta.x - nx * ancho, hasta.y - ny * ancho);
  c.closePath(); c.fill();
}
// Carámbano: base en (x, y), punta a `largo` px en la dirección `ang`.
function carambano(c: CanvasRenderingContext2D, x: number, y: number, largo: number, ancho: number, ang: number, alpha = 1): void {
  if (largo <= 0.5 || alpha <= 0) return;
  c.save(); c.translate(x, y); c.rotate(ang); c.globalAlpha *= alpha;
  const g = c.createLinearGradient(0, -ancho, 0, ancho);
  g.addColorStop(0, '#ffffff'); g.addColorStop(0.45, '#aeeeff'); g.addColorStop(1, '#3aa8d8');
  c.beginPath(); c.moveTo(0, -ancho); c.lineTo(largo, 0); c.lineTo(0, ancho); c.quadraticCurveTo(-ancho * 0.7, 0, 0, -ancho); c.closePath();
  c.fillStyle = g; c.fill(); c.lineJoin = 'round'; c.strokeStyle = '#1d6c8c'; c.lineWidth = Math.max(1, ancho * 0.22); c.stroke();
  c.strokeStyle = 'rgba(255, 255, 255, 0.9)'; c.lineWidth = Math.max(0.8, ancho * 0.18);
  c.beginPath(); c.moveTo(ancho * 0.2, -ancho * 0.45); c.lineTo(largo * 0.75, -ancho * 0.1); c.stroke();
  c.restore();
}
// Copo de nieve legible en cualquier suelo (contorno celeste y trazo blanco).
function copo(c: CanvasRenderingContext2D, x: number, y: number, tam: number, ang: number, alpha = 1): void {
  if (alpha <= 0) return;
  forma(c, 'copo', x, y, tam, ang, { base: HIELO.glow, borde: HIELO.dark, grosor: Math.max(2, tam * 0.22), alpha: alpha * 0.55 });
  forma(c, 'copo', x, y, tam, ang, { base: '#ffffff', borde: '#ffffff', grosor: Math.max(1.2, tam * 0.11), alpha });
}
// Bola de nieve con bultos y sombra azulada.
function bolaNieve(c: CanvasRenderingContext2D, x: number, y: number, r: number, giro: number, alpha = 1): void {
  c.globalAlpha = alpha;
  const g = c.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.1, x, y, r);
  g.addColorStop(0, '#ffffff'); g.addColorStop(0.7, '#e6f4fc'); g.addColorStop(1, '#a8cfe4');
  c.beginPath();
  for (let i = 0; i < 11; i++) { const a = giro + (i / 11) * Math.PI * 2, rr = r * (0.9 + 0.1 * Math.sin(i * 2.3)); const px = x + Math.cos(a) * rr, py = y + Math.sin(a) * rr; i ? c.lineTo(px, py) : c.moveTo(px, py); }
  c.closePath(); c.fillStyle = g; c.fill(); c.strokeStyle = '#7fb0cc'; c.lineWidth = Math.max(1, r * 0.06); c.stroke();
}
// Nube de bolas: `claro` arriba y `oscuro` por debajo.
const BOLAS_NUBE: [number, number, number][] = [[-0.62, 0.12, 0.5], [-0.25, -0.18, 0.62], [0.22, -0.26, 0.7], [0.65, 0.05, 0.52], [0, 0.18, 0.6]];
function nube(c: CanvasRenderingContext2D, x: number, y: number, r: number, claro: string, oscuro: string, alpha = 1): void {
  if (alpha <= 0 || r <= 0) return;
  c.globalAlpha = alpha;
  c.fillStyle = oscuro; c.beginPath();
  for (const [dx, dy, rr] of BOLAS_NUBE) { c.moveTo(x + dx * r + rr * r, y + dy * r + r * 0.12); c.arc(x + dx * r, y + dy * r + r * 0.12, rr * r, 0, Math.PI * 2); }
  c.fill();
  c.fillStyle = claro; c.beginPath();
  for (const [dx, dy, rr] of BOLAS_NUBE) { c.moveTo(x + dx * r + rr * r * 0.9, y + dy * r); c.arc(x + dx * r, y + dy * r, rr * r * 0.9, 0, Math.PI * 2); }
  c.fill();
}
// Imán de herradura (rojo con puntas plateadas), abierto hacia −y local.
function iman(c: CanvasRenderingContext2D, x: number, y: number, tam: number, ang: number, alpha = 1): void {
  if (alpha <= 0) return;
  c.save(); c.translate(x, y); c.rotate(ang); c.globalAlpha *= alpha; c.lineCap = 'butt';
  const u = () => { c.beginPath(); c.moveTo(-tam, -tam * 0.85); c.lineTo(-tam, 0); c.arc(0, 0, tam, Math.PI, 0, true); c.lineTo(tam, -tam * 0.85); };
  u(); c.strokeStyle = '#3a1418'; c.lineWidth = tam * 0.62; c.stroke();
  u(); c.strokeStyle = '#e8384a'; c.lineWidth = tam * 0.44; c.stroke();
  for (const sx of [-1, 1]) {
    c.fillStyle = '#2a2a30'; c.fillRect(sx * tam - tam * 0.31, -tam * 1.25, tam * 0.62, tam * 0.45);
    c.fillStyle = '#e4ebf2'; c.fillRect(sx * tam - tam * 0.22, -tam * 1.18, tam * 0.44, tam * 0.33);
  }
  c.restore();
}
// Llama en forma de gota: cabeza redonda en (x, y) y la cola hacia `cola` (radianes).
function llamaForma(c: CanvasRenderingContext2D, x: number, y: number, tam: number, cola: number, pal: FxPalette, alpha = 1): void {
  if (tam <= 0.5 || alpha <= 0) return;
  c.save(); c.translate(x, y); c.rotate(cola); c.globalAlpha *= alpha;
  const h = tam * 0.62, punta = tam * 1.9;
  const g = c.createRadialGradient(-tam * 0.15, 0, 0, 0, 0, tam * 1.2);
  g.addColorStop(0, pal.hot); g.addColorStop(0.4, pal.glow); g.addColorStop(1, pal.core);
  c.beginPath(); c.moveTo(punta, 0);
  c.quadraticCurveTo(tam * 0.7, -h * 1.05, 0, -h);
  c.arc(0, 0, h, -Math.PI / 2, Math.PI / 2, true);
  c.quadraticCurveTo(tam * 0.7, h * 1.05, punta, 0);
  c.closePath(); c.fillStyle = g; c.fill();
  c.restore();
}
// Llamita de cualquier color (fuego mágico, fuegos fatuos).
function llamaDe(k: Kit, pal: FxPalette, p: Vec, tam: number, vida = 320, empuje: Vec = { x: 0, y: 0 }): void {
  k.emit({ x: p.x, y: p.y, vx: empuje.x + rand(-20, 20), vy: empuje.y - rand(40, 110), life: vida * rand(0.7, 1.2), size: tam * rand(0.7, 1.2), sizeEnd: tam * 0.2, color: pick([pal.core, pal.glow, pal.hot]), shape: 'glow' });
}
// Escarcha: esquirlas que saltan y destellos blancos que se quedan.
function escarcha(k: Kit, at: Vec, tam: number, n = 14): void {
  E.sparks(k.fx, at, { count: n, speed: [tam * 2, tam * 6], palette: HIELO, shape: 'shard', size: [2.5, 5], life: [360, 600] });
  k.burst(Math.ceil(n / 2), () => ({ x: at.x + rand(-tam * 0.4, tam * 0.4), y: at.y + rand(-tam * 0.4, tam * 0.4), life: rand(300, 600), delay: rand(0, 200), size: rand(3, 6), color: '#ffffff', shape: 'star', rot: rand(0, 1), fadeIn: 0.3 }));
}
// Nube de nieve en polvo al reventar algo helado.
function nievePolvo(k: Kit, at: Vec, tam: number, n = 8): void {
  const e = Math.max(0.5, tam / 40);
  k.burst(n, () => { const a = rand(0, Math.PI * 2), v = rand(40, 140) * e; return { x: at.x, y: at.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v * 0.5 - rand(10, 50), drag: 2.5, life: rand(500, 800), size: tam * rand(0.18, 0.3), sizeEnd: tam * rand(0.4, 0.6), color: pick(['#ffffff', '#eef8ff', '#dff2ff']), alpha: 0.75, shape: 'smoke' }; });
  k.burst(n, () => { const a = rand(0, Math.PI * 2), v = rand(80, 200) * e; return { x: at.x, y: at.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v * 0.5 - rand(80, 180), ay: 600, life: rand(300, 500), size: rand(1.4, 2.6), color: pick(['#ffffff', HIELO.glow]), shape: 'dot' }; });
}
// Roca de lava al rojo (Estallido).
function bombaLava(c: CanvasRenderingContext2D, engine: FxEngine, x: number, y: number, r: number, giro: number): void {
  c.globalCompositeOperation = engine.blend; c.globalAlpha = 0.9;
  c.drawImage(engine.glow(LAVA.core), x - r * 2.2, y - r * 2.2, r * 4.4, r * 4.4);
  c.globalCompositeOperation = 'source-over'; c.globalAlpha = 1;
  c.save(); c.translate(x, y); c.rotate(giro);
  c.beginPath();
  for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2, rr = r * (0.82 + 0.18 * Math.sin(i * 2.7)); i ? c.lineTo(Math.cos(a) * rr, Math.sin(a) * rr) : c.moveTo(Math.cos(a) * rr, Math.sin(a) * rr); }
  c.closePath(); c.fillStyle = '#4a1608'; c.fill(); c.strokeStyle = '#1e0804'; c.lineWidth = Math.max(1, r * 0.12); c.stroke();
  c.strokeStyle = LAVA.glow; c.lineWidth = Math.max(1, r * 0.14); c.lineCap = 'round';
  c.beginPath(); c.moveTo(-r * 0.5, -r * 0.1); c.lineTo(0, r * 0.15); c.lineTo(r * 0.45, -r * 0.25); c.moveTo(0, r * 0.15); c.lineTo(r * 0.1, r * 0.6); c.stroke();
  c.restore();
}
// Caparazón (Refugio): domo marrón con placas, borde crema y un brillo que lo cruza (`brillo` 0-1; < 0 sin brillo).
function caparazon(c: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, alpha: number, brillo: number): void {
  if (alpha <= 0) return;
  c.save(); c.globalAlpha *= alpha;
  const domo = () => { c.beginPath(); c.ellipse(x, y, rx, ry, 0, Math.PI, Math.PI * 2); c.quadraticCurveTo(x, y + ry * 0.28, x - rx, y); c.closePath(); };
  const g = c.createLinearGradient(x, y - ry, x, y);
  g.addColorStop(0, '#e2a868'); g.addColorStop(1, '#94541f');
  domo(); c.fillStyle = g; c.fill(); c.lineJoin = 'round'; c.strokeStyle = '#4a2a10'; c.lineWidth = Math.max(1.5, rx * 0.06); c.stroke();
  // Placas: un hexágono arriba y costuras hacia el borde.
  const hx = x, hy = y - ry * 0.52, hr = rx * 0.24;
  c.strokeStyle = '#5a3414'; c.lineWidth = Math.max(1, rx * 0.045); c.beginPath();
  for (let i = 0; i <= 6; i++) { const a = (i / 6) * Math.PI * 2, px = hx + Math.cos(a) * hr, py = hy + Math.sin(a) * hr * 0.75; i ? c.lineTo(px, py) : c.moveTo(px, py); }
  for (const s of [-1, 1]) { c.moveTo(hx + s * hr, hy); c.lineTo(x + s * rx * 0.8, y - ry * 0.18); c.moveTo(hx + s * hr * 0.5, hy + hr * 0.65); c.lineTo(x + s * rx * 0.3, y + ry * 0.05); }
  c.stroke();
  // Borde crema.
  c.beginPath(); c.moveTo(x - rx, y); c.quadraticCurveTo(x, y + ry * 0.28, x + rx, y);
  c.strokeStyle = '#4a2a10'; c.lineWidth = rx * 0.2; c.stroke(); c.strokeStyle = '#f2dca0'; c.lineWidth = rx * 0.13; c.stroke();
  if (brillo >= 0 && brillo <= 1) {
    domo(); c.clip();
    const bx = lerp(x - rx * 1.4, x + rx * 1.4, brillo);
    c.fillStyle = 'rgba(255, 255, 255, 0.55)';
    c.beginPath(); c.moveTo(bx - rx * 0.1, y - ry * 1.1); c.lineTo(bx + rx * 0.14, y - ry * 1.1); c.lineTo(bx - rx * 0.2, y + ry * 0.4); c.lineTo(bx - rx * 0.44, y + ry * 0.4); c.closePath(); c.fill();
  }
  c.restore();
}
// Mandíbulas que se abren sobre el objetivo y se cierran de golpe (los colmillos elementales). `extra` pinta lo de
// cada elemento en cada fotograma (con la apertura y cuánto se ha ido); `golpe`, lo suyo en el impacto.
async function mordisco(
  k: Kit, estilo: EstiloForma,
  extra: (c: CanvasRenderingContext2D, centro: Vec, tam: number, apertura: number, engine: FxEngine, fuera: number) => void,
  golpe: (t: SlotGeometry) => void,
): Promise<void> {
  await k.anticipar(80);
  void k.embestida({ hasta: 0.45, ida: 140, vuelta: 240 });
  const c0 = { x: k.target.center.x, y: k.target.center.y - k.s(0.05) }, tam = k.s(0.6), abrir = 170, cerrar = 80, resto = 200, total = abrir + cerrar + resto;
  k.dibujar(total, (c, t, engine) => {
    const ms = t * total;
    const ap = ms < abrir ? Math.min(1, (ms / abrir) * 1.2) : ms < abrir + cerrar ? 1 - easeIn((ms - abrir) / cerrar) : 0;
    const fuera = ms > abrir + cerrar ? (ms - abrir - cerrar) / resto : 0;
    c.save();
    c.globalAlpha = Math.min(1, ms / 60) * (1 - fuera);
    mandibula(c, c0.x, c0.y, tam * (1 + fuera * 0.15), ap, estilo);
    c.restore();
    extra(c, c0, tam, ap, engine, fuera);
  }, { z: 1 });
  await k.esperar(abrir + cerrar);
  await k.impacto(golpe);
  await k.despues();
}

export const FIRMAS: Record<string, Firma> = {
  // Ascuas (40): tres brasas pequeñas que salen de un soplido, sutiles; chisporroteo al llegar. Nada de chorro.
  async ember(k) {
    await k.anticipar(70);
    void k.recuperar({ x: -k.dir.x * 6, y: -k.dir.y * 6 }, 160);
    for (let i = 0; i < 3; i++) {
      const lado = (i - 1) * k.s(0.18), ms = 260;
      k.dibujar(ms, (c, t, engine) => {
        const p = k.punto(t, lado * Math.sin(Math.PI * t));
        c.globalCompositeOperation = engine.blend;
        const r = 5 + 2 * Math.sin(t * 30);
        c.drawImage(engine.glow(FUEGO.core), p.x - r * 1.8, p.y - r * 1.8, r * 3.6, r * 3.6);
        c.drawImage(engine.glow(FUEGO.hot), p.x - r * 0.7, p.y - r * 0.7, r * 1.4, r * 1.4);
        if (Math.random() < 0.5) k.emit({ x: p.x, y: p.y, vx: -k.dir.x * 40 + rand(-25, 25), vy: -k.dir.y * 40 - rand(10, 50), life: 220, size: rand(1.2, 2.2), color: pick([FUEGO.glow, FUEGO.hot]), shape: 'dot' });
      }, { delay: i * 70, z: 1 });
    }
    await k.esperar(260 + 140);
    await k.impacto(t => {
      E.sparks(k.fx, t.center, { count: 10, speed: [60, 160], palette: FUEGO, shape: 'glow', size: [2, 3.5], gravity: -120 });
      for (let i = 0; i < 4; i++) llama(k, k.enCuerpo(t, 0.25), 6, 380);
    });
    await k.despues();
  },

  // Lanzallamas (90): carga breve y un chorro de fuego grueso y largo que se ensancha (cono de tres capas que tiembla),
  // con lenguas de llama a los lados, humo y el objetivo envuelto en llamas al final.
  async flamethrower(k) {
    await k.cargar(120);
    await k.anticipar(80);
    const dura = 520;
    // Chorro propio de fuego (no el de agua de E.torrent): un cono que se ensancha, rojo por fuera y blanco-amarillo
    // en la boca, con los bordes temblando como llamas. Sale, llega al objetivo y se recoge al final.
    k.dibujar(dura, (c, t, engine) => {
      const largo = Math.min(1, t / 0.22), cola = t > 0.8 ? (t - 0.8) / 0.2 : 0, n = 22;
      const capas: [number, string, number][] = [[1, FUEGO.core, 0.85], [0.62, FUEGO.glow, 0.9], [0.3, '#fff2b0', 0.95]];
      c.globalCompositeOperation = engine.blend === 'lighter' ? 'lighter' : 'source-over';
      for (const [w, color, alpha] of capas) {
        const izq: Vec[] = [], der: Vec[] = [];
        for (let i = 0; i <= n; i++) {
          const u = cola + (largo - cola) * i / n, ancho = (k.s(0.06) + k.s(0.42) * u) * w * (1 + 0.18 * Math.sin(u * 22 - engine.now / 35 + w * 3));
          izq.push(k.punto(0.08 + 0.92 * u, ancho)); der.push(k.punto(0.08 + 0.92 * u, -ancho));
        }
        c.globalAlpha = alpha * (1 - cola * 0.5);
        c.fillStyle = color;
        c.beginPath();
        c.moveTo(izq[0].x, izq[0].y);
        for (const q of izq) c.lineTo(q.x, q.y);
        for (const q of der.reverse()) c.lineTo(q.x, q.y);
        c.closePath(); c.fill();
      }
    }, { z: 0 });
    k.dibujar(dura, (_c, t) => {
      for (let i = 0; i < 6; i++) {
        const u = rand(0.1, 1), ancho = k.s(0.05 + 0.25 * u), p = k.punto(u, rand(-ancho, ancho));
        k.emit({ x: p.x, y: p.y, vx: k.dir.x * rand(80, 200) + rand(-30, 30), vy: k.dir.y * rand(80, 200) - rand(20, 80), life: rand(260, 420), size: rand(5, 11) * (0.6 + u), sizeEnd: 1.5, color: pick([FUEGO.core, FUEGO.glow, FUEGO.hot, '#ffe08a']), shape: 'glow' });
      }
      if (t > 0.3 && Math.random() < 0.35) { const p = k.punto(rand(0.4, 1), rand(-k.s(0.3), k.s(0.3))); k.emit({ x: p.x, y: p.y, vy: -rand(30, 60), life: 700, size: 8, sizeEnd: 18, color: '#5a4a44', alpha: 0.25, shape: 'smoke' }); }
    });
    void k.recuperar({ x: -k.dir.x * 10, y: -k.dir.y * 10 }, 300);
    await k.esperar(dura * 0.55);
    await k.impacto(t => {
      E.fireBurst(k.stage, t.center, FUEGO, t.size * 0.9);
      for (let i = 0; i < 14; i++) llama(k, k.enCuerpo(t, 0.4), 9, 520);
    });
    await k.esperar(160);
    await k.despues();
  },

  // Puño Fuego (75): un puño hecho de fuego sale disparado hacia el objetivo, con llamas saliendo de su borde, y
  // estalla al golpear.
  async firepunch(k) {
    await k.anticipar(90);
    void k.embestida({ hasta: 0.25, ida: 100, vuelta: 260 });
    const ms = 230, borde = contorno('puno', 18), tam = (t: number) => k.s(0.22 + 0.18 * t);
    let fin: Vec = k.target.center;
    k.dibujar(ms, (c, t) => {
      const p = k.punto(0.15 + 0.7 * t), r = tam(t);
      fin = p;
      forma(c, 'puno', p.x, p.y, r, k.angle, { base: rellenoFuego, claro: '#ffd070', oscuro: '#a8200a', borde: '#6a1406', brillo: '#ff7a18', brilloTam: r * 0.8 });
      for (const u of borde) if (Math.random() < 0.35) llama(k, aEscena(u, p.x, p.y, r, k.angle), r * 0.25, 260, k.haciaV(-60));
    }, { z: 1 });
    await k.esperar(ms);
    // El puño se queda un instante clavado, más grande, mientras explota.
    k.dibujar(160, (c, t) => {
      const r = tam(1) * (1 + 0.25 * t);
      c.globalAlpha = 1 - t;
      forma(c, 'puno', fin.x, fin.y, r, k.angle, { base: rellenoFuego, claro: '#ffe090', oscuro: '#a8200a', borde: '#6a1406', brillo: '#ffb040', brilloTam: r });
    }, { z: 1 });
    await k.impacto(t => {
      E.fireBurst(k.stage, t.center, FUEGO, t.size);
      k.add(E.ring({ at: t.center, from: 6, to: t.size * 0.9, width: 5, color: FUEGO.glow, duration: 300 }));
      for (let i = 0; i < 12; i++) llama(k, k.enCuerpo(t, 0.35), 8, 460);
    });
    await k.despues();
  },

  // Rueda Fuego (60): una rueda de llamas gira alrededor del usuario mientras rueda hasta el objetivo y vuelve.
  async flamewheel(k) {
    const total = 620, r = k.user.size * 0.62;
    k.dibujar(total, (c, t, engine) => {
      const p = k.posSprite(k.user), giro = t * 26, entra = Math.min(1, t * 5), sale = t > 0.85 ? (1 - t) / 0.15 : 1;
      c.globalCompositeOperation = engine.blend;
      c.globalAlpha = entra * sale;
      // Aro de fuego: anillo grueso con degradado y radios de llama que giran.
      c.lineWidth = r * 0.22; c.strokeStyle = FUEGO.core;
      c.beginPath(); c.ellipse(p.x, p.y, r, r, 0, 0, Math.PI * 2); c.stroke();
      c.lineWidth = r * 0.09; c.strokeStyle = FUEGO.hot;
      c.beginPath(); c.ellipse(p.x, p.y, r, r, 0, 0, Math.PI * 2); c.stroke();
      for (let i = 0; i < 8; i++) {
        const a = giro + i * Math.PI / 4, q = { x: p.x + Math.cos(a) * r, y: p.y + Math.sin(a) * r };
        c.drawImage(engine.glow(FUEGO.glow), q.x - r * 0.35, q.y - r * 0.35, r * 0.7, r * 0.7);
        if (Math.random() < 0.6) llama(k, q, r * 0.22, 280, { x: -Math.sin(a) * 120, y: Math.cos(a) * 120 });
      }
    }, { z: 1 });
    await k.esperar(140);
    await k.embestida({ hasta: 0.85, ida: 200, vuelta: 260, estela: FUEGO.glow });
    await k.impacto(t => {
      E.fireBurst(k.stage, t.center, FUEGO, t.size * 0.8);
      E.sparks(k.fx, t.center, { count: 18, speed: [160, 360], palette: FUEGO, shape: 'streak' });
    });
    await k.esperar(200);
    await k.despues();
  },

  // ======================================== FUEGO ========================================

  // Colmillo Ígneo (65): mandíbulas de fuego (encía en llamas, dientes candentes) se abren sobre el objetivo y se
  // cierran de golpe; brotan llamas de las encías y el mordisco estalla en fuego.
  async firefang(k) {
    await mordisco(k, { base: rellenoFuego, claro: '#ffe9a0', borde: '#6a1406', brillo: FUEGO.core, brilloTam: 12 }, (_c, c0, tam, ap, _e, fuera) => {
      if (fuera > 0.6) return;
      for (const lado of [-1, 1]) if (Math.random() < 0.6) llama(k, { x: c0.x + rand(-0.8, 0.8) * tam, y: c0.y + lado * tam * (0.25 + ap * 0.55) }, tam * 0.16, 260);
    }, t => {
      E.fireBurst(k.stage, t.center, FUEGO, t.size * 0.9);
      k.add(E.ring({ at: t.center, from: 4, to: t.size * 0.75, width: 4, color: FUEGO.glow, duration: 260 }));
      for (let i = 0; i < 10; i++) llama(k, k.enCuerpo(t, 0.35), 8, 440);
    });
  },

  // Giro Fuego (35): un hilo de fuego serpentea hasta el objetivo y se enrosca a su alrededor en un remolino de
  // llamas que sube desde el suelo y lo encierra.
  async firespin(k) {
    await k.anticipar(70);
    void k.recuperar({ x: -k.dir.x * 6, y: -k.dir.y * 6 }, 180);
    await k.proyectil(200, p => { llama(k, p, 7, 220); if (Math.random() < 0.5) llama(k, p, 5, 200); }, { lado: k.s(0.3) });
    const c0 = k.target.center, R = k.s(0.6), dura = 700, base = k.target.feet.y, alto = k.s(1);
    k.dibujar(dura, (c, t, engine) => {
      const sale = t > 0.75 ? 1 - (t - 0.75) / 0.25 : 1, entra = Math.min(1, t * 4), giro = engine.now / 90;
      c.globalCompositeOperation = engine.blend;
      for (let i = 0; i < 18; i++) {
        const u = i / 18, a = giro + u * Math.PI * 4, r = R * (1 - 0.35 * u) * entra, y = base - alto * u * entra;
        const q = { x: c0.x + Math.cos(a) * r, y: y + Math.sin(a) * r * 0.4 }, tam = k.s(0.17) * (1 - 0.4 * u);
        // Por delante del objetivo brilla más que por detrás.
        c.globalAlpha = sale * (Math.sin(a) > 0 ? 1 : 0.55);
        c.drawImage(engine.glow(i % 3 ? FUEGO.core : FUEGO.glow), q.x - tam, q.y - tam, tam * 2, tam * 2);
        if (Math.random() < 0.1 * sale) llama(k, q, tam * 0.6, 260, { x: -Math.sin(a) * 80, y: Math.cos(a) * 30 });
      }
    }, { z: 1 });
    await k.esperar(120);
    await k.impacto(t => { for (let i = 0; i < 6; i++) llama(k, k.enCuerpo(t, 0.3), 7, 380); });
    await k.esperar(420);
    await k.despues();
  },

  // Envite Ígneo (120): el usuario se prende entero (llamas que lo envuelven y crecen), embiste como un cometa con
  // una cola de fuego enorme y revienta contra el objetivo con fogonazo; después le llega el retroceso.
  async flareblitz(k) {
    k.add(E.dim({ at: k.user.center, duration: 900, strength: 0.4 }));
    const s = k.user.size, prender = 320, ini = k.user.center;
    k.dibujar(prender + 450, (c, t, engine) => {
      const p = k.posSprite(k.user), ms = t * (prender + 450), crece = Math.min(1, ms / prender), sale = t > 0.85 ? (1 - t) / 0.15 : 1;
      c.globalCompositeOperation = engine.blend; c.globalAlpha = 0.85 * crece * sale;
      const r = s * (0.55 + 0.25 * crece);
      c.drawImage(engine.glow(FUEGO.core), p.x - r * 1.4, p.y - r * 1.4, r * 2.8, r * 2.8);
      c.drawImage(engine.glow(FUEGO.hot), p.x - r * 0.5, p.y - r * 0.5, r, r);
      for (let i = 0; i < 2; i++) llama(k, k.alrededor(p, s * 0.42 * rand(0.3, 1), rand(0, Math.PI * 2), 1), s * 0.22 * (0.4 + crece), 300);
    }, { z: 1 });
    void k.agitar(k.user.sprite, 2, prender);
    await k.esperar(prender);
    // Cola de cometa desde donde salió hasta donde va.
    k.dibujar(420, (c, t) => {
      const p = k.posSprite(k.user), sale = t > 0.4 ? 1 - (t - 0.4) / 0.6 : 1;
      estelaCuna(c, ini, p, s * 0.5, FUEGO.dark, FUEGO.core, FUEGO.glow, sale);
      if (sale > 0.3) { const u = rand(0.2, 1); llama(k, { x: lerp(ini.x, p.x, u), y: lerp(ini.y, p.y, u) }, s * 0.2, 320, k.haciaV(-60)); }
    });
    await k.embestida({ hasta: 0.95, ida: 150, vuelta: 320, estela: FUEGO.core });
    await k.impacto(t => {
      k.add(E.flash({ color: FUEGO.glow, alpha: 0.3, duration: 240 }));
      E.fireBurst(k.stage, t.center, FUEGO, t.size * 1.5);
      k.add(E.starburst({ at: t.center, rays: 12, length: t.size * 1.2, width: 5, palette: FUEGO, duration: 300 }));
      k.add(E.ring({ at: t.center, from: 8, to: t.size * 1.3, width: 6, color: FUEGO.glow, duration: 340 }));
      for (let i = 0; i < 16; i++) llama(k, k.enCuerpo(t, 0.45), 10, 520);
    });
    await k.despues();
  },

  // Onda Ígnea (95): el usuario exhala una ola de aire ardiente: un frente de calor anaranjado barre hacia los
  // rivales con el aire temblando (líneas de calima onduladas) y brasas arrastradas.
  async heatwave(k) {
    await k.cargar(140);
    const at = k.user.center, largo = k.dist + k.s(1.6), ancho = Math.max(k.s(1.6), k.dist * 0.8), dura = 640;
    const cos = Math.cos(k.angle), sin = Math.sin(k.angle);
    k.add(E.sweep({ fromX: at.x, toX: at.x + largo, top: at.y - ancho, bottom: at.y + ancho, palette: FUEGO, duration: dura, look: 'heat', rotate: { at, angle: k.angle }, thickness: k.s(1.4) }));
    k.dibujar(dura, (c, t, engine) => {
      const frente = largo * (1 - (1 - t) * (1 - t)), sale = t > 0.8 ? 1 - (t - 0.8) / 0.2 : 1;
      c.translate(at.x, at.y); c.rotate(k.angle);
      c.strokeStyle = '#ffd27a'; c.lineWidth = 2;
      for (let i = 0; i < 4; i++) {
        const x = frente - i * k.s(0.35);
        if (x < 0) continue;
        c.globalAlpha = 0.55 * sale * (1 - i / 4);
        c.beginPath();
        for (let y = -ancho; y <= ancho; y += 6) { const xx = x + Math.sin(y / 10 + engine.now / 60 + i) * 4; if (y === -ancho) c.moveTo(xx, y); else c.lineTo(xx, y); }
        c.stroke();
      }
      // Brasas arrastradas por el frente.
      for (let i = 0; i < 2; i++) {
        const lx = frente - rand(0, k.s(0.6)), ly = rand(-ancho, ancho), v = rand(120, 260);
        if (lx > 0 && sale > 0.2) k.emit({ x: at.x + cos * lx - sin * ly, y: at.y + sin * lx + cos * ly, vx: cos * v, vy: sin * v - rand(10, 50), drag: 1.5, life: rand(260, 400), size: rand(2.5, 5), sizeEnd: 1, color: pick([FUEGO.core, FUEGO.glow, '#ffd27a']), shape: 'glow' });
      }
    });
    const llegada = 1 - Math.sqrt(1 - Math.min(1, k.dist / largo));
    await k.esperar(dura * llegada);
    await k.impacto(t => {
      k.add(E.bloom({ at: t.center, radius: t.size * 0.8, color: FUEGO.core, duration: 360 }));
      for (let i = 0; i < 10; i++) llama(k, k.enCuerpo(t, 0.4), 8, 420, k.haciaV(80));
    });
    await k.esperar(dura * (1 - llegada) * 0.6);
    await k.despues();
  },

  // Calcinación (60): una ráfaga en abanico de carbones encendidos que se abren y se clavan en el objetivo, donde
  // prenden en llamaradas cortas y sueltan humo negro.
  async incinerate(k) {
    await k.anticipar(80);
    void k.recuperar({ x: -k.dir.x * 8, y: -k.dir.y * 8 }, 200);
    const n = 9, viaje = 240, desde = k.punto(0.12), rc = Math.max(2.2, k.s(0.05));
    const brasas = Array.from({ length: n }, (_, i) => ({ lado: (i - (n - 1) / 2) * k.s(0.09), d: rand(0, 60), dest: k.enCuerpo(k.target, 0.35) }));
    k.dibujar(viaje + 60, (c, t, engine) => {
      const ms = t * (viaje + 60);
      for (const b of brasas) {
        const u = (ms - b.d) / viaje;
        if (u <= 0 || u >= 1) continue;
        const ab = Math.sin(Math.PI * u) * 2.2, p = { x: lerp(desde.x, b.dest.x, u) + k.perp.x * b.lado * ab, y: lerp(desde.y, b.dest.y, u) + k.perp.y * b.lado * ab };
        c.globalCompositeOperation = engine.blend; c.globalAlpha = 1;
        c.drawImage(engine.glow(FUEGO.core), p.x - rc * 3, p.y - rc * 3, rc * 6, rc * 6);
        c.globalCompositeOperation = 'source-over';
        c.fillStyle = '#3a1208'; c.beginPath(); c.arc(p.x, p.y, rc, 0, Math.PI * 2); c.fill();
        c.fillStyle = FUEGO.glow; c.beginPath(); c.arc(p.x - rc * 0.25, p.y - rc * 0.25, rc * 0.5, 0, Math.PI * 2); c.fill();
        if (Math.random() < 0.4) k.emit({ x: p.x, y: p.y, vx: -k.dir.x * 60 + rand(-20, 20), vy: -k.dir.y * 60 - rand(10, 40), life: 200, size: 1.6, color: FUEGO.hot, shape: 'dot' });
      }
    }, { z: 1 });
    await k.esperar(viaje + 30);
    await k.impacto(t => {
      // Cada carbón prende donde se clavó.
      for (const b of brasas) {
        const at = t === k.target ? b.dest : k.enCuerpo(t, 0.35);
        for (let j = 0; j < 3; j++) k.emit({ x: at.x, y: at.y, vx: rand(-25, 25), vy: -rand(60, 140), life: rand(300, 460), delay: b.d + j * 40, size: rand(5, 9), sizeEnd: 1.5, color: pick([FUEGO.core, FUEGO.glow, FUEGO.hot]), shape: 'glow' });
      }
      k.burst(6, i => ({ x: t.center.x + rand(-t.size * 0.3, t.size * 0.3), y: t.center.y + rand(-t.size * 0.2, t.size * 0.2), vy: -rand(30, 70), life: 800, delay: 120 + i * 30, size: 10, sizeEnd: 24, color: '#2a2020', alpha: 0.4, shape: 'smoke' }));
    });
    await k.esperar(220);
    await k.despues();
  },

  // Infierno (100): la vista se oscurece, una bola de fuego densa vuela al objetivo y estalla en una esfera de
  // llamas que lo engulle entero un instante, con lenguas de fuego saliendo por su borde.
  async inferno(k) {
    k.add(E.dim({ at: k.target.center, duration: 1000, strength: 0.45 }));
    await k.cargar(150);
    void k.recuperar({ x: -k.dir.x * 8, y: -k.dir.y * 8 }, 220);
    const r0 = k.s(0.2);
    await k.proyectil(240, (p, _t, c, engine) => { orbe(c, engine, p, r0, FUEGO); llama(k, p, r0 * 0.6, 240, k.haciaV(-80)); }, { arco: k.s(0.25) });
    const c0 = k.target.center, R = k.s(0.95), dura = 560;
    k.dibujar(dura, (c, t, engine) => {
      const ms = t * dura, crece = easeOutCubic(Math.min(1, ms / 140)), sale = t > 0.7 ? 1 - (t - 0.7) / 0.3 : 1, r = R * crece * (1 + 0.05 * Math.sin(engine.now / 30));
      if (r < 1) return;
      const g = c.createRadialGradient(c0.x, c0.y, 0, c0.x, c0.y, r);
      g.addColorStop(0, withAlpha('#fff1b0', 0.95)); g.addColorStop(0.35, withAlpha(FUEGO.glow, 0.9)); g.addColorStop(0.75, withAlpha(FUEGO.core, 0.85)); g.addColorStop(1, withAlpha(FUEGO.dark, 0));
      c.globalAlpha = sale; c.fillStyle = g; c.beginPath(); c.arc(c0.x, c0.y, r, 0, Math.PI * 2); c.fill();
      for (let i = 0; i < 3; i++) { const a = rand(0, Math.PI * 2); llama(k, { x: c0.x + Math.cos(a) * r * 0.85, y: c0.y + Math.sin(a) * r * 0.85 }, k.s(0.14), 380, { x: Math.cos(a) * 60, y: Math.sin(a) * 60 }); }
    });
    await k.esperar(100);
    await k.impacto(t => {
      k.add(E.flash({ color: FUEGO.core, alpha: 0.22, duration: 240 }));
      E.fireBurst(k.stage, t.center, FUEGO, t.size * 1.2);
      k.add(E.ring({ at: t.center, from: t.size * 0.3, to: t.size * 1.25, width: 5, color: FUEGO.glow, duration: 360 }));
    });
    await k.esperar(300);
    await k.despues();
  },

  // Humareda (80): el usuario revienta en una corona de lava y humo negro: un anillo de lava se abre por el suelo en
  // todas direcciones, salpicando goterones al rojo, y alcanza a todos los que tiene cerca.
  async lavaplume(k) {
    const u0 = k.user.center, s = k.user.size;
    void k.animar(k.user.sprite, [{ transform: 'scale(1, 1)' }, { transform: 'scale(1.12, 0.85)', offset: 0.6 }, { transform: 'scale(0.95, 1.08)', offset: 0.8 }, { transform: 'scale(1, 1)' }], 360);
    await k.cargar(130);
    const alcance = Math.max(k.dist + k.s(0.4), s * 2.4), dura = 520;
    k.dibujar(dura, (c, t) => {
      const r = alcance * easeOutCubic(t), a = 1 - easeIn(t);
      for (const [col, w] of [[LAVA.dark, 0.3], [LAVA.core, 0.2], [LAVA.glow, 0.08]] as const) {
        c.globalAlpha = a * 0.9; c.strokeStyle = col; c.lineWidth = Math.max(1, s * w * (1 - t * 0.6));
        c.beginPath(); c.ellipse(u0.x, u0.y + s * 0.2, r, r * 0.6, 0, 0, Math.PI * 2); c.stroke();
      }
    });
    k.burst(26, i => {
      const a = (i / 26) * Math.PI * 2 + rand(-0.1, 0.1), v = alcance * rand(1.4, 2.2);
      return { x: u0.x, y: u0.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v * 0.6 - rand(150, 300), ay: 900, drag: 1, life: rand(450, 620), size: rand(3, 5.5), sizeEnd: 2, color: pick([LAVA.core, LAVA.glow, '#c0280a']), shape: 'dot' };
    });
    k.burst(14, () => {
      const a = rand(0, Math.PI * 2), v = rand(80, 220);
      return { x: u0.x, y: u0.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v * 0.6 - 30, drag: 2, life: rand(700, 900), size: s * 0.25, sizeEnd: s * 0.7, color: pick(['#2a2020', '#3a2c28']), alpha: 0.45, shape: 'smoke' };
    });
    const llegada = 1 - Math.cbrt(1 - Math.min(0.99, k.dist / alcance));
    await k.esperar(dura * llegada);
    await k.impacto(t => {
      E.fireBurst(k.stage, t.center, LAVA, t.size * 0.8);
      k.burst(8, () => ({ x: t.center.x + rand(-t.size * 0.35, t.size * 0.35), y: t.center.y + rand(-t.size * 0.3, t.size * 0.2), vy: rand(10, 40), ay: 300, life: 500, size: rand(2.5, 4), color: pick([LAVA.core, LAVA.glow]), shape: 'dot' }));
    });
    await k.esperar(dura * (1 - llegada) * 0.5);
    await k.despues();
  },

  // Llama Embrujada (75): un círculo mágico morado gira bajo el usuario, sobre su cabeza nace una llama violeta con
  // destellos y salen tres llamas que se trenzan en espiral hasta el objetivo; estalla en fuego morado y estrellas.
  async mysticalfire(k) {
    const s = k.user.size, f = k.user.feet, prep = 300, cima = { x: k.user.center.x, y: k.user.top.y - s * 0.15 };
    k.dibujar(prep + 260, (c, t, engine) => {
      const abre = easeOutCubic(Math.min(1, t * 3)), sale = t > 0.7 ? 1 - (t - 0.7) / 0.3 : 1, R = s * 0.7 * abre, giro = engine.now / 400;
      if (R < 1) return;
      c.globalAlpha = 0.85 * sale; c.strokeStyle = MAGIA.glow; c.lineWidth = 2;
      c.beginPath(); c.ellipse(f.x, f.y, R, R * 0.4, 0, 0, Math.PI * 2); c.stroke();
      c.strokeStyle = MAGIA.core; c.lineWidth = 1.4;
      c.beginPath(); c.ellipse(f.x, f.y, R * 0.75, R * 0.3, 0, 0, Math.PI * 2); c.stroke();
      c.beginPath();
      for (let i = 0; i <= 5; i++) { const a = giro + (i * Math.PI * 4) / 5, x = f.x + Math.cos(a) * R * 0.75, y = f.y + Math.sin(a) * R * 0.3; if (i) c.lineTo(x, y); else c.moveTo(x, y); }
      c.stroke();
      c.fillStyle = MAGIA.hot;
      for (let i = 0; i < 8; i++) { const a = -giro + (i * Math.PI) / 4; c.fillRect(f.x + Math.cos(a) * R * 0.875 - 1.5, f.y + Math.sin(a) * R * 0.35 - 1.5, 3, 3); }
    });
    k.dibujar(prep, (c, t, engine) => {
      const r = k.s(0.16) * easeOutCubic(t);
      orbe(c, engine, cima, r * 1.1, MAGIA, 0.8);
      llamaForma(c, cima.x, cima.y, r, -Math.PI / 2 + Math.sin(engine.now / 60) * 0.15, MAGIA);
      if (Math.random() < 0.4) k.emit({ x: cima.x + rand(-s * 0.4, s * 0.4), y: cima.y + rand(-s * 0.3, s * 0.3), vy: -rand(10, 40), life: 320, size: rand(2.5, 4.5), color: pick([MAGIA.hot, '#ffffff']), shape: 'star', rot: rand(0, 1), fadeIn: 0.3 });
    }, { z: 1 });
    void k.animar(k.user.sprite, [{ transform: 'translate(0px, 0px)' }, { transform: 'translate(0px, -4px) scale(0.97, 1.05)', offset: 0.7 }, { transform: 'translate(0px, 0px)' }], prep + 120);
    await k.esperar(prep);
    const viaje = 280, dest = k.target.center;
    k.dibujar(viaje, (c, t, engine) => {
      for (let i = 0; i < 3; i++) {
        const base = { x: lerp(cima.x, dest.x, t), y: lerp(cima.y, dest.y, t) }, a = t * Math.PI * 4 + (i * Math.PI * 2) / 3, rr = k.s(0.25) * Math.sin(Math.PI * t);
        const p = { x: base.x + k.perp.x * Math.cos(a) * rr, y: base.y + k.perp.y * Math.cos(a) * rr - Math.sin(a) * rr * 0.5 };
        orbe(c, engine, p, k.s(0.1), MAGIA, 0.6);
        llamaForma(c, p.x, p.y, k.s(0.11), k.angle + Math.PI, MAGIA);
        if (Math.random() < 0.3) llamaDe(k, MAGIA, p, 5, 220);
      }
    }, { z: 1 });
    await k.esperar(viaje);
    await k.impacto(t => {
      for (let i = 0; i < 12; i++) llamaDe(k, MAGIA, k.enCuerpo(t, 0.4), 8, 460);
      k.burst(10, () => ({ x: t.center.x, y: t.center.y, vx: rand(-160, 160), vy: rand(-180, 80), drag: 3, life: rand(360, 560), size: rand(3, 5), color: pick([MAGIA.hot, '#ffffff', MAGIA.glow]), shape: 'star', spin: rand(-6, 6) }));
      k.add(E.ring({ at: t.center, from: 6, to: t.size * 0.9, width: 4, color: MAGIA.glow, duration: 320 }));
    });
    await k.esperar(200);
    await k.despues();
  },

  // Sofoco (130): el usuario se pone al rojo blanco (vista oscura, anillos de calor que tiemblan a su alrededor) y
  // suelta de golpe un haz de calor blanco cegador; después echa humo, agotado.
  async overheat(k) {
    await k.cargaEpica();
    const s = k.user.size, u0 = k.user.center;
    k.dibujar(280, (c, t, engine) => {
      const r = s * (0.5 + 0.5 * t);
      orbe(c, engine, k.posSprite(k.user), r, t < 0.5 ? FUEGO : CALOR_BLANCO, 0.5 + 0.4 * t);
    }, { z: 1 });
    for (let i = 0; i < 3; i++) k.add(E.ring({ at: u0, from: s * 0.3, to: s * 1.3, width: 3, color: '#ffe07a', duration: 300, delay: i * 80 }));
    void k.agitar(k.user.sprite, 3, 260);
    await k.esperar(220);
    k.add(E.flash({ color: '#fff4d0', alpha: 0.45, duration: 300 }));
    k.add(E.beam({ from: k.punto(0.1), to: k.target.center, width: k.s(0.55), palette: CALOR_BLANCO, duration: 520 }));
    k.add(E.beam({ from: k.punto(0.1), to: k.target.center, width: k.s(0.2), palette: { core: '#fff4d0', glow: '#ffffff', hot: '#ffffff', dark: FUEGO.dark }, duration: 480, delay: 30 }));
    // Lenguas de fuego que se desprenden de los bordes del haz.
    k.dibujar(450, () => {
      for (let i = 0; i < 3; i++) { const lado = pick([-1, 1]), u = rand(0.15, 1), p = k.punto(u, lado * k.s(0.3)); llama(k, p, k.s(0.13), 300, { x: k.perp.x * lado * 90 + k.dir.x * 60, y: k.perp.y * lado * 90 + k.dir.y * 60 }); }
    });
    void k.recuperar({ x: -k.dir.x * 18, y: -k.dir.y * 18 }, 380);
    await k.esperar(130);
    await k.impacto(t => {
      E.fireBurst(k.stage, t.center, CALOR_BLANCO, t.size * 1.4);
      k.add(E.starburst({ at: t.center, rays: 12, length: t.size * 1.3, width: 5, palette: CALOR_BLANCO, duration: 320 }));
      k.add(E.ring({ at: t.center, from: 8, to: t.size * 1.4, width: 6, color: '#fff4d0', duration: 360 }));
      for (let i = 0; i < 12; i++) llama(k, k.enCuerpo(t, 0.45), 10, 480);
    });
    // Agotado: humo que sale del usuario.
    k.burst(10, i => ({ x: u0.x + rand(-s * 0.3, s * 0.3), y: u0.y - rand(0, s * 0.3), vy: -rand(30, 70), vx: rand(-15, 15), life: 800, delay: 120 + i * 35, size: s * 0.18, sizeEnd: s * 0.45, color: '#6a6060', alpha: 0.4, shape: 'smoke' }));
    await k.esperar(260);
    await k.despues();
  },

  // Día Soleado (estado): en lo alto de la vista se abre un sol: el disco crece, los rayos se despliegan girando, una
  // luz cálida baña el escenario y un haz baja hasta el usuario.
  async sunnyday(k) {
    const dura = 900;
    void k.animar(k.user.sprite, [{ transform: 'translate(0px, 0px) scale(1, 1)' }, { transform: 'translate(0px, -5px) scale(0.97, 1.05)', offset: 0.5 }, { transform: 'translate(0px, 0px) scale(1, 1)' }], 420);
    k.dibujar(dura, (c, t, engine) => {
      const abre = easeOutCubic(Math.min(1, t * 2.2)), sale = t > 0.75 ? 1 - (t - 0.75) / 0.25 : 1, giro = t * 0.9;
      const sol = { x: engine.offset.x + engine.width * 0.5, y: engine.offset.y + engine.height * 0.14 }, R = engine.height * 0.08 * abre;
      c.globalAlpha = 0.16 * abre * sale; c.fillStyle = '#ffcf6a'; c.fillRect(engine.offset.x, engine.offset.y, engine.width, engine.height);
      if (R < 1) return;
      orbe(c, engine, sol, R * 2, FUEGO, 0.5 * sale);
      c.save(); c.translate(sol.x, sol.y); c.rotate(giro); c.globalAlpha = 0.9 * sale;
      for (let i = 0; i < 12; i++) {
        c.rotate(Math.PI / 6);
        const l = R * (1.35 + (i % 2 ? 0.45 : 1) * abre);
        c.fillStyle = i % 2 ? '#ffd24a' : '#ffb02e';
        c.beginPath(); c.moveTo(R * 0.9, -R * 0.17); c.lineTo(l, 0); c.lineTo(R * 0.9, R * 0.17); c.closePath(); c.fill();
      }
      c.restore();
      const g = c.createRadialGradient(sol.x - R * 0.3, sol.y - R * 0.3, R * 0.1, sol.x, sol.y, R);
      g.addColorStop(0, '#fffbe0'); g.addColorStop(0.55, '#ffd24a'); g.addColorStop(1, '#ff9a1a');
      c.globalAlpha = sale; c.fillStyle = g; c.beginPath(); c.arc(sol.x, sol.y, R, 0, Math.PI * 2); c.fill();
      c.strokeStyle = '#e07a10'; c.lineWidth = Math.max(1.5, R * 0.06); c.stroke();
    }, { z: 1 });
    k.add(E.sunbeam({ at: k.user.center, palette: FUEGO, duration: 640, width: k.user.size * 1.4 }));
    await k.esperar(520);
    await k.estado();
  },

  // Fuego Fatuo (estado): tres fuegos fatuos azules salen del usuario flotando en ondas, rodean al objetivo en
  // círculo cerrándose y se le meten dentro (la quemadura la enseña el estado).
  async willowisp(k) {
    const n = 3, viaje = 420, ronda = 240, total = viaje + ronda + 100, tam = k.s(0.12), R = Math.min(k.s(0.55), k.dist * 0.6);
    const u1 = Math.max(0.1, 1 - R / Math.max(1, k.dist));
    const prev: Vec[] = [], colas: number[] = [];
    k.dibujar(total, (c, t, engine) => {
      const ms = t * total;
      for (let i = 0; i < n; i++) {
        const m = ms - i * 50, fase = (i * Math.PI * 2) / 3;
        if (m < 0) continue;
        let p: Vec, esc = 1, alpha = 1;
        if (m < viaje) {
          const u = m / viaje;
          p = k.punto(0.1 + (u1 - 0.1) * u, Math.sin(u * Math.PI * 2 + fase) * k.s(0.4) * Math.sin(Math.PI * u));
        } else {
          const v = Math.min(1, (m - viaje) / ronda);
          p = k.alrededor(k.target.center, R * (1 - 0.85 * v), k.angle + Math.PI + v * Math.PI * 2.4, 0.6);
          esc = 1 - 0.5 * v;
          if (m > viaje + ronda) alpha = Math.max(0, 1 - (m - viaje - ronda) / 100);
        }
        p = { x: p.x, y: p.y + Math.sin(engine.now / 90 + fase) * 2 };
        const q = prev[i] ?? p;
        if (Math.hypot(q.x - p.x, q.y - p.y) > 0.5) colas[i] = Math.atan2(q.y - p.y, q.x - p.x);
        prev[i] = p;
        orbe(c, engine, p, tam * esc * 1.3, FATUO, 0.55 * alpha);
        llamaForma(c, p.x, p.y, tam * esc, colas[i] ?? -Math.PI / 2, FATUO, alpha);
        if (Math.random() < 0.2) llamaDe(k, FATUO, p, 4, 240);
      }
    }, { z: 1 });
    await k.esperar(viaje + ronda + 50);
    k.add(E.bloom({ at: k.target.center, radius: k.s(0.7), color: FATUO.glow, duration: 360 }));
    k.add(E.ring({ at: k.target.center, from: k.s(0.6), to: k.s(0.1), width: 3, color: FATUO.glow, duration: 260 }));
    await k.estado();
  },

  // Estallido (150): gran carga mientras el suelo se agrieta al rojo; revienta un volcán: una columna de lava sube
  // del usuario y caen bombas de lava ardiendo sobre los rivales, con fogonazo naranja.
  async eruption(k) {
    k.add(E.cracks({ at: k.user.feet, length: k.user.size * 1.3, color: '#ff5a1a', duration: 1200 }));
    await k.cargaEpica();
    const u0 = k.user.center, s = k.user.size, pies = k.user.feet, top = k.stage.top - 30;
    void k.saltar(k.user.sprite, s * 0.22, 300);
    k.add(E.flash({ color: '#ff9a2a', alpha: 0.3, duration: 280 }));
    k.dibujar(520, (c, t) => {
      const sube = easeOutCubic(Math.min(1, t * 2.5)), sale = t > 0.5 ? 1 - (t - 0.5) / 0.5 : 1, y = lerp(pies.y, top, sube), w = s * 0.5 * sale;
      if (w < 1) return;
      const g = c.createLinearGradient(u0.x - w, 0, u0.x + w, 0);
      g.addColorStop(0, withAlpha(LAVA.dark, 0)); g.addColorStop(0.25, withAlpha(LAVA.core, 0.9)); g.addColorStop(0.5, withAlpha(LAVA.hot, 1)); g.addColorStop(0.75, withAlpha(LAVA.core, 0.9)); g.addColorStop(1, withAlpha(LAVA.dark, 0));
      c.fillStyle = g; c.beginPath(); c.moveTo(u0.x - w * 0.6, pies.y); c.lineTo(u0.x - w, y); c.lineTo(u0.x + w, y); c.lineTo(u0.x + w * 0.6, pies.y); c.closePath(); c.fill();
      if (sale > 0.2) for (let i = 0; i < 2; i++) llama(k, { x: u0.x + rand(-w, w), y: lerp(pies.y, y, rand(0, 1)) }, s * 0.18, 320);
    });
    const objetivos = k.ctx.targets.length ? k.ctx.targets : [k.target], vuelo = 420;
    for (const o of objetivos) for (let j = 0; j < 4; j++) {
      const dest = j === 0 ? o.center : { x: o.center.x + rand(-1, 1) * o.size * 0.9, y: o.center.y + rand(-0.6, 0.6) * o.size * 0.6 };
      const r = o.size * (j === 0 ? 0.2 : 0.12), alto = s * rand(2.2, 3), d = j === 0 ? 0 : 60 + j * 50;
      let hecho = j === 0; // la bomba principal aterriza con el impacto
      k.dibujar(vuelo, (c, t, engine) => {
        const x = lerp(u0.x, dest.x, t), y = lerp(u0.y, dest.y, t) - alto * Math.sin(Math.PI * t);
        bombaLava(c, engine, x, y, r, t * 8);
        if (Math.random() < 0.5) k.emit({ x, y, vx: rand(-20, 20), vy: rand(-20, 20), life: 420, size: r * 0.9, sizeEnd: r * 1.8, color: '#3a2a26', alpha: 0.35, shape: 'smoke' });
        if (!hecho && t > 0.92) { hecho = true; E.fireBurst(k.stage, dest, LAVA, o.size * 0.6); k.add(E.ring({ at: dest, from: 4, to: o.size * 0.6, width: 3, color: LAVA.glow, duration: 260, squash: 0.5 })); }
      }, { delay: d, z: 1 });
    }
    await k.esperar(vuelo);
    await k.impacto(t => {
      k.add(E.flash({ color: LAVA.glow, alpha: 0.3, duration: 260 }));
      E.fireBurst(k.stage, t.center, LAVA, t.size * 1.5);
      k.add(E.cracks({ at: t.feet, length: t.size * 1.2, color: '#ff5a1a', duration: 700 }));
      k.add(E.ring({ at: t.feet, from: t.size * 0.2, to: t.size * 1.5, width: 6, color: LAVA.glow, duration: 420, squash: 0.45 }));
      k.add(E.starburst({ at: t.center, rays: 10, length: t.size * 1.2, width: 5, palette: LAVA, duration: 300 }));
      for (let i = 0; i < 12; i++) llama(k, k.enCuerpo(t, 0.45), 10, 520);
    });
    await k.esperar(260);
    await k.despues();
  },

  // ======================================== AGUA ========================================

  // Pistola Agua (40): un chorrito fino de gotas seguidas, unidas por un hilo de agua; salpica un poco al llegar.
  async watergun(k) {
    await k.anticipar(60);
    void k.recuperar({ x: -k.dir.x * 5, y: -k.dir.y * 5 }, 160);
    const viaje = 200, n = 12, cada = 16, desde = k.punto(0.12), v = k.haciaV(((k.dist * 0.88) / viaje) * 1000);
    for (let i = 0; i < n; i++) {
      const lado = Math.sin(i * 1.3) * k.s(0.03);
      k.emit({ x: desde.x + k.perp.x * lado, y: desde.y + k.perp.y * lado, vx: v.x, vy: v.y, life: viaje, delay: i * cada, size: rand(2, 3.2), color: i % 3 ? AGUA.core : AGUA.glow, shape: 'drop', stretch: 18 });
    }
    k.dibujar(viaje + n * cada, (c, t) => {
      const a = Math.max(0, t * 1.25 - 0.25), b = Math.min(1, t * 1.25), p = k.punto(0.12 + 0.88 * a), q = k.punto(0.12 + 0.88 * b);
      c.globalAlpha = 0.55 * Math.sin(Math.PI * t); c.strokeStyle = AGUA.glow; c.lineWidth = 2; c.lineCap = 'round';
      c.beginPath(); c.moveTo(p.x, p.y); c.lineTo(q.x, q.y); c.stroke();
    });
    await k.esperar(viaje + 40);
    await k.impacto(t => {
      salpicar(k, t.center, t.size * 0.6, 10);
      k.add(E.ring({ at: t.center, from: 4, to: t.size * 0.45, width: 2.5, color: AGUA.glow, duration: 260 }));
    });
    await k.despues();
  },

  // Hidrobomba (110): la vista se oscurece; el usuario se planta y suelta un chorro enorme a presión que lo empuja
  // hacia atrás: torrente ancho con núcleo claro, rocío y espuma por los lados y un reventón de agua en el objetivo.
  async hydropump(k) {
    k.add(E.dim({ at: k.user.center, duration: 900, strength: 0.35 }));
    await k.cargar(160);
    const dura = 620, desde = k.punto(0.1);
    void k.animar(k.user.sprite, [
      { transform: 'translate(0px, 0px) scale(1, 1)' },
      { transform: `translate(${-k.dir.x * 12}px, ${-k.dir.y * 12}px) scale(1.08, 0.92)`, offset: 0.15 },
      { transform: `translate(${-k.dir.x * 16}px, ${-k.dir.y * 16}px) scale(1.06, 0.94)`, offset: 0.8 },
      { transform: 'translate(0px, 0px) scale(1, 1)' },
    ], dura + 120);
    k.add(E.torrent({ from: desde, to: k.punto(1.08), width: k.s(0.62), palette: AGUA, duration: dura }));
    k.add(E.torrent({ from: desde, to: k.punto(1.04), width: k.s(0.24), palette: { ...AGUA, core: AGUA.glow, glow: AGUA.hot }, duration: dura - 40, delay: 40 }));
    k.dibujar(dura, (_c, t) => {
      if (t > 0.85) return;
      for (let i = 0; i < 3; i++) {
        const u = rand(0.15, Math.min(1, 0.2 + t * 4.5)), lado = pick([-1, 1]), p = k.punto(u, lado * k.s(0.2 + 0.4 * u)), v = rand(120, 260), w = rand(60, 160);
        k.emit({ x: p.x, y: p.y, vx: k.dir.x * v + k.perp.x * lado * w, vy: k.dir.y * v + k.perp.y * lado * w - rand(40, 120), ay: 700, life: rand(220, 380), size: rand(1.8, 3.2), color: pick([AGUA.glow, AGUA.hot]), shape: 'drop', stretch: 20 });
      }
      if (Math.random() < 0.5) { const p = k.punto(rand(0.2, 1), rand(-k.s(0.3), k.s(0.3))); k.emit({ x: p.x, y: p.y, vx: k.dir.x * 140, vy: k.dir.y * 140, life: 300, size: rand(3, 6), color: AGUA.hot, accent: '#ffffff', shape: 'bubble', alpha: 0.8 }); }
    });
    k.burst(6, () => ({ x: desde.x, y: desde.y, vx: k.perp.x * rand(-80, 80) - k.dir.x * 30, vy: k.perp.y * rand(-80, 80) - k.dir.y * 30 - 20, drag: 2, life: 600, size: 10, sizeEnd: 22, color: '#dcefff', alpha: 0.35, shape: 'smoke' }));
    await k.esperar(dura * 0.3);
    await k.impacto(t => {
      k.add(E.flash({ color: AGUA.glow, alpha: 0.2, duration: 220 }));
      salpicar(k, t.center, t.size * 1.3, 24);
      k.add(E.ring({ at: t.center, from: 8, to: t.size * 1.2, width: 6, color: AGUA.glow, duration: 360 }));
      k.add(E.ring({ at: t.feet, from: t.size * 0.3, to: t.size * 1.5, width: 4, color: AGUA.hot, duration: 480, squash: 0.4, delay: 80 }));
      k.burst(8, () => ({ x: t.center.x + rand(-t.size * 0.4, t.size * 0.4), y: t.center.y + rand(-t.size * 0.3, t.size * 0.3), vy: -rand(20, 50), drag: 1, life: 700, size: 12, sizeEnd: 28, color: '#e6f6ff', alpha: 0.35, shape: 'smoke' }));
    });
    await k.esperar(dura * 0.45);
    await k.despues();
  },

  // Rayo Burbuja (65): una ristra de burbujas de muchos tamaños que viajan ondulando hasta el objetivo y revientan
  // contra él una a una con chasquidos de espuma.
  async bubblebeam(k) {
    await k.cargar(100);
    void k.recuperar({ x: -k.dir.x * 6, y: -k.dir.y * 6 }, 200);
    const n = 20, viaje = 300, cada = 16, total = viaje + n * cada;
    const bur = Array.from({ length: n }, (_, i) => ({ d: i * cada, r: k.s(rand(0.05, 0.13)), f: rand(2, 4) * Math.PI, fase: rand(0, 6), amp: k.s(rand(0.08, 0.2)), reventada: false }));
    k.dibujar(total, (c, t) => {
      const ms = t * total;
      for (const b of bur) {
        const u = (ms - b.d) / viaje;
        if (u < 0) continue;
        if (u >= 1) {
          if (!b.reventada) {
            b.reventada = true;
            const p = k.punto(1, rand(-k.s(0.25), k.s(0.25)));
            k.add(E.ring({ at: p, from: b.r * 0.6, to: b.r * 2, width: 1.5, color: AGUA.hot, duration: 180 }));
            k.burst(3, () => ({ x: p.x, y: p.y, vx: rand(-90, 90), vy: rand(-90, 60), life: 200, size: 1.6, color: AGUA.hot, shape: 'dot' }));
          }
          continue;
        }
        const p = k.punto(0.12 + 0.88 * u, Math.sin(u * b.f + b.fase) * b.amp * Math.sin(Math.PI * Math.min(1, u * 1.3)));
        burbuja(c, p.x, p.y, b.r * (0.7 + 0.3 * Math.min(1, u * 4)));
      }
    }, { z: 1 });
    await k.esperar(viaje);
    await k.impacto(t => {
      k.burst(10, () => ({ x: t.center.x + rand(-t.size * 0.35, t.size * 0.35), y: t.center.y + rand(-t.size * 0.35, t.size * 0.3), vy: -rand(30, 80), vx: rand(-30, 30), life: rand(300, 500), size: rand(3, 7), color: AGUA.glow, accent: '#ffffff', shape: 'bubble' }));
      salpicar(k, t.center, t.size * 0.7, 10);
    });
    await k.esperar(n * cada - 40);
    await k.despues();
  },

  // Hidropulso (60): una esfera de agua que late mientras viaja soltando ondas; al chocar se abre en anillos de
  // agua concéntricos (los que confunden).
  async waterpulse(k) {
    await k.cargar(120);
    void k.recuperar({ x: -k.dir.x * 6, y: -k.dir.y * 6 }, 200);
    const r = k.s(0.2);
    let ultima = -1e9;
    await k.proyectil(280, (p, t, c, engine) => {
      esferaAgua(c, p.x, p.y, r * (1 + 0.15 * Math.sin(t * 30)));
      if (engine.now - ultima > 70) { ultima = engine.now; k.add(E.ring({ at: p, from: r, to: r * 2.2, width: 2.5, color: AGUA.glow, duration: 260 })); }
    });
    await k.impacto(t => {
      for (let i = 0; i < 3; i++) k.add(E.ring({ at: t.center, from: t.size * 0.15, to: t.size * (0.7 + i * 0.35), width: 5 - i, color: i % 2 ? AGUA.hot : AGUA.glow, duration: 380, delay: i * 90 }));
      salpicar(k, t.center, t.size * 0.8, 14);
    });
    await k.esperar(160);
    await k.despues();
  },

  // Cascada (80): una columna de agua cae del cielo sobre el objetivo y el usuario embiste remontándola; al tocar el
  // suelo rompe en espuma.
  async waterfall(k) {
    const caida = 240, dura = 620, ancho = k.s(0.55), base = k.target.feet, arriba = k.stage.top - 20;
    k.dibujar(dura, (c, t, engine) => {
      const ms = t * dura, frente = lerp(arriba, base.y, easeIn(Math.min(1, ms / caida))), sale = t > 0.7 ? 1 - (t - 0.7) / 0.3 : 1, w = ancho * sale;
      if (w < 1) return;
      const g = c.createLinearGradient(base.x - w / 2, 0, base.x + w / 2, 0);
      g.addColorStop(0, withAlpha(AGUA.dark, 0.7)); g.addColorStop(0.3, withAlpha(AGUA.core, 0.85)); g.addColorStop(0.5, withAlpha(AGUA.glow, 0.9)); g.addColorStop(0.7, withAlpha(AGUA.core, 0.85)); g.addColorStop(1, withAlpha(AGUA.dark, 0.7));
      c.fillStyle = g; c.beginPath();
      c.moveTo(base.x - w * 0.4, arriba); c.lineTo(base.x + w * 0.4, arriba); c.lineTo(base.x + w / 2, frente);
      c.quadraticCurveTo(base.x, frente + w * 0.25, base.x - w / 2, frente); c.closePath(); c.fill();
      // Hilos de espuma que bajan.
      c.strokeStyle = AGUA.hot; c.lineCap = 'round'; c.globalAlpha = 0.8 * sale;
      for (const [f, lw] of [[-0.25, 2], [0.05, 3], [0.3, 1.6]] as const) {
        c.lineWidth = lw; c.setLineDash([22, 14]); c.lineDashOffset = -engine.now * 0.9 * (1 + f);
        c.beginPath(); c.moveTo(base.x + f * w, arriba); c.lineTo(base.x + f * w * 1.1, frente); c.stroke();
      }
      c.setLineDash([]);
      if (ms > caida) {
        if (Math.random() < 0.7) k.emit({ x: base.x + rand(-w / 2, w / 2), y: base.y, vx: rand(-160, 160), vy: -rand(120, 300), ay: 900, life: rand(260, 420), size: rand(2, 3.5), color: pick([AGUA.glow, AGUA.hot]), shape: 'drop', stretch: 20 });
        c.globalAlpha = 0.7 * sale; c.fillStyle = AGUA.hot;
        c.beginPath(); c.ellipse(base.x, base.y, w * 0.75, w * 0.22, 0, 0, Math.PI * 2); c.fill();
      }
    });
    await k.esperar(caida - 140);
    await k.embestida({ hasta: 0.8, ida: 140, vuelta: 260, estela: AGUA.glow });
    await k.impacto(t => {
      salpicar(k, t.center, t.size * 1.1, 20);
      k.add(E.ring({ at: t.feet, from: t.size * 0.2, to: t.size * 1.2, width: 4, color: AGUA.glow, duration: 420, squash: 0.4 }));
    });
    await k.esperar(200);
    await k.despues();
  },

  // Acua Jet (40): el usuario sale disparado a toda velocidad dentro de un chorro de agua que deja estela; golpe
  // rápido y limpio con una salpicadura pequeña.
  async aquajet(k) {
    const ida = 110, ini = k.user.center, w = k.user.size * 0.28;
    k.dibujar(ida + 260, (c, t) => {
      const p = k.posSprite(k.user), sale = t > 0.4 ? 1 - (t - 0.4) / 0.6 : 1, dx = p.x - ini.x, dy = p.y - ini.y, l = Math.hypot(dx, dy);
      if (l < 4) return;
      estelaCuna(c, ini, p, w, AGUA.core, AGUA.core, AGUA.glow, 0.85 * sale);
      c.globalAlpha = sale; c.strokeStyle = AGUA.hot; c.lineWidth = 2; c.lineCap = 'round';
      c.beginPath(); c.moveTo(lerp(ini.x, p.x, 0.35), lerp(ini.y, p.y, 0.35)); c.lineTo(p.x, p.y); c.stroke();
      if (Math.random() < 0.6) { const o = rand(-w, w); k.emit({ x: p.x - (dy / l) * o, y: p.y + (dx / l) * o, vx: (-dx / l) * 120 + rand(-40, 40), vy: (-dy / l) * 120 - rand(20, 90), ay: 700, life: 300, size: rand(1.6, 2.8), color: AGUA.glow, shape: 'drop', stretch: 18 }); }
    });
    await k.embestida({ hasta: 0.9, ida, vuelta: 240, estela: AGUA.glow });
    await k.impacto(t => {
      salpicar(k, t.center, t.size * 0.7, 12);
      k.add(E.ring({ at: t.center, from: 4, to: t.size * 0.55, width: 3, color: AGUA.glow, duration: 240 }));
    });
    await k.despues();
  },

  // Acua Cola (90): el usuario gira y barre al objetivo con una gran cola de agua en arco, con espuma en el filo y
  // gotas que salen despedidas; revienta en una ola contra él.
  async aquatail(k) {
    await k.anticipar(80);
    void k.girar(k.user.sprite, 1, 380);
    void k.embestida({ hasta: 0.35, ida: 160, vuelta: 280 });
    const cen = k.punto(0.3), R = k.dist * 0.7, w = k.s(0.34), barre = 300, dura = 520, ini = k.angle - 1.1, fin = k.angle + 1.1;
    k.dibujar(dura, (c, t) => {
      const ms = t * dura, cab = ini + (fin - ini) * Math.min(1, ms / barre), col = ini + (fin - ini) * easeIn(Math.min(1, Math.max(0, (ms - 90) / (dura - 90))));
      if (cab - col < 0.02) return;
      const n = 20, ext: Vec[] = [], int: Vec[] = [];
      for (let i = 0; i <= n; i++) {
        const u = i / n, a = lerp(col, cab, u), g = w * Math.pow(Math.sin(Math.PI * (0.06 + 0.88 * u)), 0.7) * (0.6 + 0.4 * u);
        ext.push({ x: cen.x + Math.cos(a) * (R + g / 2), y: cen.y + Math.sin(a) * (R + g / 2) });
        int.push({ x: cen.x + Math.cos(a) * (R - g / 2), y: cen.y + Math.sin(a) * (R - g / 2) });
      }
      const gr = c.createRadialGradient(cen.x, cen.y, Math.max(0, R - w / 2), cen.x, cen.y, R + w / 2);
      gr.addColorStop(0, withAlpha(AGUA.dark, 0.85)); gr.addColorStop(0.4, withAlpha(AGUA.core, 0.95)); gr.addColorStop(0.75, AGUA.glow); gr.addColorStop(1, AGUA.hot);
      c.fillStyle = gr; c.beginPath();
      ext.forEach((p, i) => (i ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y)));
      for (let i = int.length - 1; i >= 0; i--) c.lineTo(int[i].x, int[i].y);
      c.closePath(); c.fill();
      c.strokeStyle = AGUA.hot; c.lineWidth = 2.5; c.lineCap = 'round'; c.beginPath();
      ext.forEach((p, i) => (i ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y))); c.stroke();
      if (ms < barre) for (let j = 0; j < 2; j++) {
        const h = ext[n], v = rand(200, 340);
        k.emit({ x: h.x, y: h.y, vx: -Math.sin(cab) * v + rand(-40, 40), vy: Math.cos(cab) * v - rand(40, 120), ay: 800, life: rand(260, 400), size: rand(2, 3.4), color: pick([AGUA.glow, AGUA.hot]), shape: 'drop', stretch: 20 });
      }
    }, { z: 1 });
    await k.esperar(barre / 2);
    await k.impacto(t => {
      salpicar(k, t.center, t.size * 1.2, 22);
      k.add(E.ring({ at: t.center, from: 6, to: t.size * 1.05, width: 5, color: AGUA.glow, duration: 340 }));
    });
    await k.esperar(200);
    await k.despues();
  },

  // Salmuera (65): una bola de agua de mar verdosa cae en arco sobre el objetivo, lo empapa y le deja una costra de
  // cristales de sal blancos que destellan.
  async brine(k) {
    await k.cargar(110);
    void k.recuperar({ x: -k.dir.x * 6, y: -k.dir.y * 6 }, 200);
    const r = k.s(0.22);
    await k.proyectil(300, (p, _t, c) => {
      esferaAgua(c, p.x, p.y, r, SAL);
      if (Math.random() < 0.4) k.emit({ x: p.x, y: p.y, vx: rand(-30, 30), vy: rand(0, 40), ay: 600, life: 260, size: rand(1.5, 2.5), color: SAL.glow, shape: 'drop', stretch: 16 });
    }, { arco: k.s(0.9) });
    await k.impacto(t => {
      salpicar(k, t.center, t.size, 18, SAL);
      k.add(E.ring({ at: t.center, from: 6, to: t.size * 0.85, width: 4, color: SAL.glow, duration: 320 }));
      const cristales = Array.from({ length: 9 }, () => ({ p: k.enCuerpo(t, 0.38), r: rand(2.5, 4.5), a: rand(0, Math.PI), d: rand(0, 0.25) }));
      k.dibujar(720, (c, u) => {
        const sale = u > 0.7 ? 1 - (u - 0.7) / 0.3 : 1;
        for (const q of cristales) {
          const e = Math.min(1, Math.max(0, (u - q.d) * 6));
          if (e <= 0) continue;
          c.save(); c.translate(q.p.x, q.p.y); c.rotate(q.a); c.globalAlpha = sale;
          c.fillStyle = '#ffffff'; c.strokeStyle = SAL.dark; c.lineWidth = 1;
          c.fillRect(-q.r * e, -q.r * e, q.r * 2 * e, q.r * 2 * e); c.strokeRect(-q.r * e, -q.r * e, q.r * 2 * e, q.r * 2 * e);
          c.restore();
          if (Math.random() < 0.04) k.emit({ x: q.p.x, y: q.p.y, life: 220, size: rand(3, 5), color: '#ffffff', shape: 'star', rot: rand(0, 1) });
        }
      }, { z: 1 });
    });
    await k.esperar(220);
    await k.despues();
  },

  // Torbellino (35): a los pies del objetivo se abre un remolino de agua oscura con brazos en espiral, y una cinta de
  // agua gira y sube a su alrededor atrapándolo.
  async whirlpool(k) {
    await k.anticipar(70);
    void k.recuperar({ x: -k.dir.x * 6, y: -k.dir.y * 6 }, 180);
    const c0 = k.target.feet, R = k.s(0.85), dura = 760;
    k.dibujar(dura, (c, t, engine) => {
      const abre = easeOutCubic(Math.min(1, t * 3)), sale = t > 0.75 ? 1 - (t - 0.75) / 0.25 : 1, r = R * abre, giro = engine.now / 130;
      if (r < 1) return;
      c.save(); c.translate(c0.x, c0.y); c.scale(1, 0.42);
      const g = c.createRadialGradient(0, 0, 0, 0, 0, r);
      g.addColorStop(0, withAlpha(AGUA.dark, 0.85)); g.addColorStop(0.6, withAlpha(AGUA.core, 0.6)); g.addColorStop(1, withAlpha(AGUA.glow, 0));
      c.globalAlpha = 0.85 * sale; c.fillStyle = g; c.beginPath(); c.arc(0, 0, r, 0, Math.PI * 2); c.fill();
      c.lineCap = 'round';
      for (let b = 0; b < 4; b++) {
        c.beginPath();
        for (let i = 0; i <= 20; i++) { const u = i / 20, a = giro + (b * Math.PI) / 2 + u * 3.4, rr = r * (1 - u * 0.88); if (i) c.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); else c.moveTo(Math.cos(a) * rr, Math.sin(a) * rr); }
        c.strokeStyle = b % 2 ? AGUA.hot : AGUA.glow; c.lineWidth = Math.max(1.5, r * 0.07); c.stroke();
      }
      c.restore();
      if (sale > 0.3 && Math.random() < 0.6) { const a = rand(0, Math.PI * 2), p = k.alrededor(c0, r, a, 0.42); k.emit({ x: p.x, y: p.y, vx: -Math.sin(a) * 120, vy: Math.cos(a) * 50 - rand(80, 160), ay: 500, life: 360, size: rand(1.8, 2.8), color: AGUA.glow, shape: 'drop', stretch: 16 }); }
    });
    // Cinta de agua que gira y sube alrededor del objetivo.
    k.dibujar(dura, (c, t, engine) => {
      const sube = easeOutCubic(Math.min(1, Math.max(0, t - 0.1) * 3)), sale = t > 0.75 ? 1 - (t - 0.75) / 0.25 : 1, giro = engine.now / 110;
      if (sube <= 0) return;
      c.lineCap = 'round';
      for (let b = 0; b < 2; b++) {
        c.beginPath();
        for (let i = 0; i <= 24; i++) {
          const u = i / 24, a = giro + b * Math.PI + u * Math.PI * 2.2, rr = R * 0.6 * (1 - 0.25 * u);
          const x = c0.x + Math.cos(a) * rr, y = c0.y - k.s(1.1) * u * sube + Math.sin(a) * rr * 0.42;
          if (i) c.lineTo(x, y); else c.moveTo(x, y);
        }
        c.globalAlpha = 0.45 * sale; c.strokeStyle = AGUA.core; c.lineWidth = 5; c.stroke();
        c.globalAlpha = 0.8 * sale; c.strokeStyle = AGUA.hot; c.lineWidth = 2; c.stroke();
      }
    }, { z: 1 });
    await k.esperar(320);
    await k.impacto(t => {
      salpicar(k, t.center, t.size * 0.6, 10);
      k.add(E.ring({ at: t.feet, from: t.size * 0.7, to: t.size * 0.2, width: 3, color: AGUA.glow, duration: 300, squash: 0.42 }));
    });
    await k.esperar(300);
    await k.despues();
  },

  // Salpicar (150): gran carga; el usuario lanza al cielo un géiser enorme y el agua cae en tromba sobre los rivales:
  // columna que sube, masa de agua que se desploma, olas en el suelo y destello azul.
  async waterspout(k) {
    await k.cargaEpica();
    const u0 = k.user.center, s = k.user.size, top = k.stage.top - 30, sube = 260;
    void k.animar(k.user.sprite, [{ transform: 'translate(0px, 0px) scale(1, 1)' }, { transform: 'translate(0px, 4px) scale(1.15, 0.85)', offset: 0.3 }, { transform: 'translate(0px, -6px) scale(0.92, 1.1)', offset: 0.6 }, { transform: 'translate(0px, 0px) scale(1, 1)' }], sube + 160);
    k.dibujar(sube + 260, (c, t, engine) => {
      const ms = t * (sube + 260), alto = easeOutCubic(Math.min(1, ms / sube)), sale = ms > sube ? 1 - (ms - sube) / 260 : 1, yTop = lerp(u0.y, top, alto), w = s * 0.55 * sale;
      if (w < 1) return;
      const g = c.createLinearGradient(u0.x - w, 0, u0.x + w, 0);
      g.addColorStop(0, withAlpha(AGUA.dark, 0.6)); g.addColorStop(0.3, withAlpha(AGUA.core, 0.9)); g.addColorStop(0.5, withAlpha(AGUA.glow, 0.95)); g.addColorStop(0.7, withAlpha(AGUA.core, 0.9)); g.addColorStop(1, withAlpha(AGUA.dark, 0.6));
      c.fillStyle = g; c.beginPath(); c.moveTo(u0.x - w * 0.7, u0.y); c.lineTo(u0.x - w, yTop); c.lineTo(u0.x + w, yTop); c.lineTo(u0.x + w * 0.7, u0.y); c.closePath(); c.fill();
      c.strokeStyle = AGUA.hot; c.lineWidth = 2.5; c.setLineDash([20, 12]); c.lineDashOffset = engine.now * 1.2; c.globalAlpha = 0.85 * sale;
      for (const f of [-0.4, 0, 0.4]) { c.beginPath(); c.moveTo(u0.x + f * w * 0.7, u0.y); c.lineTo(u0.x + f * w, yTop); c.stroke(); }
      c.setLineDash([]);
      if (Math.random() < 0.8) k.emit({ x: u0.x + rand(-w, w), y: u0.y + s * 0.2, vx: rand(-180, 180), vy: -rand(150, 320), ay: 900, life: rand(300, 450), size: rand(2, 3.5), color: pick([AGUA.glow, AGUA.hot]), shape: 'drop', stretch: 20 });
    });
    await k.esperar(sube);
    const objetivos = k.ctx.targets.length ? k.ctx.targets : [k.target], cae = 220;
    for (const o of objetivos) {
      k.dibujar(cae + 120, (c, t) => {
        const ms = t * (cae + 120), y = lerp(top, o.center.y, easeIn(Math.min(1, ms / cae))), r = o.size * 0.6 * (ms > cae ? 1 + ((ms - cae) / 120) * 0.8 : 1), a = ms > cae ? 1 - (ms - cae) / 120 : 1;
        const g = c.createLinearGradient(o.center.x - r, 0, o.center.x + r, 0);
        g.addColorStop(0, withAlpha(AGUA.dark, 0.7)); g.addColorStop(0.5, withAlpha(AGUA.glow, 0.95)); g.addColorStop(1, withAlpha(AGUA.dark, 0.7));
        c.globalAlpha = a; c.fillStyle = g; c.beginPath();
        c.moveTo(o.center.x - r * 0.55, y - r * 3.2); c.lineTo(o.center.x + r * 0.55, y - r * 3.2); c.lineTo(o.center.x + r, y - r * 0.2);
        c.quadraticCurveTo(o.center.x, y + r * 0.7, o.center.x - r, y - r * 0.2); c.closePath(); c.fill();
        c.strokeStyle = AGUA.hot; c.lineWidth = 2; c.stroke();
      }, { z: 1 });
    }
    await k.esperar(cae);
    await k.impacto(t => {
      k.add(E.flash({ color: AGUA.glow, alpha: 0.3, duration: 260 }));
      salpicar(k, t.feet, t.size * 1.6, 26);
      for (let i = 0; i < 3; i++) k.add(E.ring({ at: t.feet, from: t.size * 0.3, to: t.size * (1.2 + i * 0.5), width: 5 - i, color: i % 2 ? AGUA.hot : AGUA.glow, duration: 480, squash: 0.4, delay: i * 80 }));
      k.add(E.ring({ at: t.center, from: 8, to: t.size * 1.2, width: 6, color: AGUA.glow, duration: 360 }));
    });
    await k.esperar(220);
    await k.despues();
  },

  // Buceo (80): el usuario se hunde en un charco, una estela de burbujas cruza bajo el suelo y sale de un salto junto
  // al objetivo entre un surtidor de agua.
  async dive(k) {
    const pu = k.user.feet, s = k.user.size, hundir = 180, cruzar = 220, abajo = s * 0.3;
    const lejos = Math.max(0, k.dist - k.target.size * 0.5), v = k.haciaV(lejos), pv = { x: pu.x + v.x, y: pu.y + v.y };
    k.dibujar(hundir + 260, (c, t) => charco(c, pu.x, pu.y, s * 0.6 * easeOutCubic(Math.min(1, t * 3)), t > 0.6 ? 1 - (t - 0.6) / 0.4 : 1));
    void k.animar(k.user.sprite, [{ transform: 'translate(0px, 0px) scale(1, 1)' }, { transform: `translate(0px, ${-s * 0.15}px) scale(0.9, 1.12)`, offset: 0.35 }, { transform: `translate(0px, ${abajo}px) scale(1.2, 0.2)` }], hundir, 'ease-in');
    void k.animar(k.user.sprite, [{ opacity: 1 }, { opacity: 1, offset: 0.5 }, { opacity: 0 }], hundir);
    await k.esperar(hundir);
    salpicar(k, pu, s * 0.6, 10);
    // Bajo el agua: una onda y burbujas que cruzan hasta el objetivo.
    k.dibujar(cruzar, (c, t) => {
      const p = { x: lerp(pu.x, pv.x, t), y: lerp(pu.y, pv.y, t) };
      c.globalAlpha = 0.7; c.strokeStyle = AGUA.glow; c.lineWidth = 2;
      c.beginPath(); c.ellipse(p.x, p.y, s * 0.3, s * 0.12, 0, 0, Math.PI * 2); c.stroke();
      if (Math.random() < 0.6) k.emit({ x: p.x + rand(-s * 0.2, s * 0.2), y: p.y, vy: -rand(20, 50), life: 300, size: rand(2, 4), color: AGUA.glow, accent: '#ffffff', shape: 'bubble' });
    });
    void k.animar(k.user.sprite, [{ transform: `translate(0px, ${abajo}px) scale(1.2, 0.2)` }, { transform: `translate(${v.x}px, ${v.y + abajo}px) scale(1.2, 0.2)` }], cruzar, 'linear');
    await k.esperar(cruzar);
    k.dibujar(520, (c, t) => charco(c, pv.x, pv.y, s * 0.7 * easeOutCubic(Math.min(1, t * 4)), t > 0.5 ? 1 - (t - 0.5) / 0.5 : 1));
    void k.animar(k.user.sprite, [{ opacity: 0 }, { opacity: 1 }], 80);
    // Surtidor al salir.
    k.burst(16, () => ({ x: pv.x + rand(-s * 0.3, s * 0.3), y: pv.y, vx: rand(-90, 90), vy: -rand(280, 480), ay: 1100, life: rand(380, 520), size: rand(2, 3.6), color: pick([AGUA.glow, AGUA.hot, AGUA.core]), shape: 'drop', stretch: 22 }));
    await k.animar(k.user.sprite, [{ transform: `translate(${v.x}px, ${v.y + abajo}px) scale(0.8, 0.3)` }, { transform: `translate(${v.x}px, ${v.y - s * 0.5}px) scale(0.9, 1.15)` }], 120, 'ease-out');
    await k.impacto(t => {
      salpicar(k, t.center, t.size, 16);
      k.add(E.ring({ at: t.feet, from: t.size * 0.2, to: t.size * 1.1, width: 4, color: AGUA.glow, duration: 400, squash: 0.4 }));
    });
    void k.animar(k.user.sprite, [{ transform: `translate(${v.x}px, ${v.y - s * 0.5}px) scale(1, 1)` }, { transform: 'translate(0px, 0px) scale(1, 1)' }], 300, 'cubic-bezier(0.34, 1.2, 0.64, 1)');
    await k.despues();
  },

  // Danza Lluvia (estado): el usuario baila y nubes grises de tormenta se juntan desde los lados en lo alto de la
  // vista, que se oscurece; caen las primeras gotas (la lluvia de verdad la pinta la capa de clima).
  async raindance(k) {
    const dura = 820;
    void k.animar(k.user.sprite, [
      { transform: 'translate(0px, 0px) rotate(0deg)' },
      { transform: 'translate(-3px, -5px) rotate(-10deg)', offset: 0.25 },
      { transform: 'translate(3px, 0px) rotate(10deg)', offset: 0.5 },
      { transform: 'translate(-3px, -5px) rotate(-10deg)', offset: 0.75 },
      { transform: 'translate(0px, 0px) rotate(0deg)' },
    ], 560, 'ease-in-out');
    const nubes = Array.from({ length: 6 }, (_, i) => {
      const izq = i < 3, j = izq ? i : i - 3;
      return { x0: izq ? -0.25 : 1.25, x1: izq ? 0.12 + j * 0.15 : 0.58 + j * 0.15, y: 0.07 + ((i * 37) % 5) * 0.025, r: 0.07 + ((i * 53) % 3) * 0.012, d: j * 0.08 };
    });
    k.dibujar(dura, (c, t, engine) => {
      const sale = t > 0.8 ? 1 - (t - 0.8) / 0.2 : 1, x0 = engine.offset.x, y0 = engine.offset.y;
      c.globalAlpha = 0.2 * Math.min(1, t * 2) * sale; c.fillStyle = '#16243a'; c.fillRect(x0, y0, engine.width, engine.height);
      for (const n of nubes) {
        const u = easeOutCubic(Math.min(1, Math.max(0, (t - n.d) * 1.8))), x = x0 + engine.width * lerp(n.x0, n.x1, u), y = y0 + engine.height * n.y, r = engine.width * n.r;
        nube(c, x, y, r, '#7a8494', '#4a5262', 0.92 * sale);
        if (t > 0.4 && Math.random() < 0.35) k.emit({ x: x + rand(-r, r), y: y + r * 0.4, vx: -50, vy: rand(700, 900), life: rand(300, 450), size: 1.4, color: AGUA.glow, shape: 'streak', stretch: 28 });
      }
    }, { z: 1 });
    await k.esperar(560);
    await k.estado();
  },

  // Acua Aro (estado): un anillo de agua sube de los pies del usuario y gira a su alrededor como un aro, con gotas en
  // órbita y destellos que curan.
  async aquaring(k) {
    const dura = 820, s = k.user.size, R = s * 0.62;
    k.dibujar(dura, (c, t, engine) => {
      const p = k.posSprite(k.user), sube = easeOutCubic(Math.min(1, t * 2.2)), sale = t > 0.75 ? 1 - (t - 0.75) / 0.25 : 1;
      const cx = p.x, cy = lerp(k.user.feet.y, p.y + s * 0.08, sube), r = R * (0.6 + 0.4 * sube), giro = engine.now / 180;
      // Mitad de atrás más tenue, mitad de delante entera.
      for (const [a0, a1, al] of [[Math.PI, Math.PI * 2, 0.45], [0, Math.PI, 1]] as const) {
        c.globalAlpha = sale * al; c.strokeStyle = withAlpha(AGUA.core, 0.8); c.lineWidth = r * 0.16;
        c.beginPath(); c.ellipse(cx, cy, r, r * 0.35, 0, a0, a1); c.stroke();
        c.strokeStyle = AGUA.hot; c.lineWidth = r * 0.06; c.setLineDash([r * 0.4, r * 0.25]); c.lineDashOffset = -engine.now * 0.08;
        c.beginPath(); c.ellipse(cx, cy, r, r * 0.35, 0, a0, a1); c.stroke(); c.setLineDash([]);
      }
      for (let i = 0; i < 6; i++) {
        const a = giro + (i * Math.PI) / 3, q = { x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r * 0.35 };
        orbe(c, engine, q, r * 0.09, AGUA, sale * (Math.sin(a) > 0 ? 1 : 0.5));
      }
      if (Math.random() < 0.25 * sale) { const a = rand(0, Math.PI * 2); k.emit({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r * 0.35, vy: -rand(30, 60), life: 420, size: rand(2.5, 4), color: pick([NEUTRAL_FX.heal.glow, AGUA.hot]), shape: 'star', rot: rand(0, 1), fadeIn: 0.3 }); }
    }, { z: 1 });
    await k.esperar(500);
    await k.estado();
  },

  // Gota Vital (estado): una gota grande y brillante cae del cielo sobre el usuario (y sobre cada aliado) y estalla en
  // un rocío de destellos que cura.
  async lifedew(k) {
    const quienes = [k.user, ...k.ctx.targets.filter(t => t.slot !== k.user.slot)], cae = 300, CURA = NEUTRAL_FX.heal;
    quienes.forEach((q, i) => {
      const d = i * 70, tam = q.size * 0.17, y0 = k.stage.top - 20;
      k.dibujar(cae, (c, t) => {
        const y = lerp(y0, q.center.y, easeIn(t));
        forma(c, 'gota', q.center.x, y, tam, -Math.PI / 2, { base: rellenoAgua, claro: AGUA.hot, borde: AGUA.dark, brillo: '#c8fff0', brilloTam: tam });
      }, { delay: d, z: 1 });
      alPasar(k, cae + d, () => {
        salpicar(k, q.center, q.size * 0.6, 10);
        k.add(E.bloom({ at: q.center, radius: q.size * 0.6, color: CURA.core, duration: 400 }));
        k.add(E.ring({ at: q.feet, from: q.size * 0.15, to: q.size * 0.8, width: 3, color: CURA.glow, duration: 420, squash: 0.4 }));
        k.burst(12, j => ({ x: q.center.x + rand(-q.size * 0.4, q.size * 0.4), y: q.feet.y - rand(0, q.size * 0.5), vy: -rand(40, 90), life: rand(420, 620), delay: j * 20, size: rand(3, 5.5), color: pick([CURA.glow, AGUA.hot, '#ffffff']), shape: 'star', rot: rand(0, 1), fadeIn: 0.25 }));
      });
    });
    await k.esperar(cae + 140);
    await k.estado();
  },

  // Empapar (estado): una bola grande de agua vuela en arco y revienta encima del objetivo: lo cala entero, le chorrea
  // por el cuerpo y le deja un charco a los pies.
  async soak(k) {
    await k.anticipar(70);
    void k.recuperar({ x: -k.dir.x * 6, y: -k.dir.y * 6 }, 180);
    const r = k.s(0.26), c0 = k.target.center;
    await k.proyectil(300, (p, t, c) => {
      esferaAgua(c, p.x, p.y, r * (0.75 + 0.25 * t));
      if (Math.random() < 0.4) k.emit({ x: p.x, y: p.y, vx: rand(-30, 30), vy: rand(0, 40), ay: 600, life: 260, size: rand(1.5, 2.5), color: AGUA.glow, shape: 'drop', stretch: 16 });
    }, { arco: k.s(1.1) });
    salpicar(k, c0, k.s(1.1), 22);
    k.add(E.ring({ at: k.target.feet, from: k.s(0.2), to: k.s(0.9), width: 3, color: AGUA.glow, duration: 420, squash: 0.4 }));
    k.dibujar(700, (c, t) => {
      charco(c, k.target.feet.x, k.target.feet.y, k.s(0.6) * easeOutCubic(Math.min(1, t * 3)), t > 0.6 ? 1 - (t - 0.6) / 0.4 : 1);
      if (t < 0.7 && Math.random() < 0.5) k.emit({ x: c0.x + rand(-k.s(0.35), k.s(0.35)), y: c0.y + rand(-k.s(0.3), k.s(0.1)), vy: rand(20, 60), ay: 500, life: 380, size: rand(1.8, 2.8), color: pick([AGUA.glow, AGUA.core]), shape: 'drop', stretch: 18 });
    });
    void k.agitar(k.target.sprite, 2, 300);
    await k.esperar(200);
    await k.estado();
  },

  // Refugio (estado): el usuario se encoge y un caparazón le cae encima y se cierra con un golpe seco; un brillo
  // recorre la concha.
  async withdraw(k) {
    const dura = 760, s = k.user.size, c0 = k.user.center;
    void k.animar(k.user.sprite, [{ transform: 'translate(0px, 0px) scale(1, 1)' }, { transform: `translate(0px, ${s * 0.08}px) scale(0.82, 0.78)`, offset: 0.3 }, { transform: `translate(0px, ${s * 0.08}px) scale(0.82, 0.78)`, offset: 0.8 }, { transform: 'translate(0px, 0px) scale(1, 1)' }], dura);
    k.dibujar(dura, (c, t) => {
      const baja = easeOutCubic(Math.min(1, t * 3.5)), sale = t > 0.8 ? 1 - (t - 0.8) / 0.2 : 1, y = lerp(c0.y - s * 1.0, c0.y + s * 0.2, baja);
      caparazon(c, c0.x, y, s * 0.58, s * 0.55, Math.min(1, t * 6) * sale * 0.95, t > 0.42 ? (t - 0.42) / 0.36 : -1);
    }, { z: 1 });
    await k.esperar(300);
    k.add(E.ring({ at: k.user.feet, from: s * 0.3, to: s * 0.9, width: 3, color: '#f2dca0', duration: 300, squash: 0.4 }));
    E.dust(k.stage, k.user.feet, s * 0.6);
    await k.esperar(80);
    await k.estado();
  },

  // ======================================== HIELO ========================================

  // Colmillo Hielo (65): mandíbulas de hielo (encía celeste, dientes de cristal) con vaho frío; al cerrarse brotan
  // carámbanos cortos alrededor del mordisco y saltan esquirlas.
  async icefang(k) {
    await mordisco(k, { base: rellenoHielo, claro: '#f2fdff', borde: '#0e4a66', brillo: HIELO.core, brilloTam: 12 }, (_c, c0, tam, ap, _e, fuera) => {
      if (fuera > 0.5 || Math.random() > 0.35) return;
      k.emit({ x: c0.x + rand(-0.9, 0.9) * tam, y: c0.y + rand(-0.6, 0.6) * tam * (0.3 + ap), vx: rand(-20, 20), vy: rand(-30, 10), life: 400, size: tam * 0.12, sizeEnd: tam * 0.3, color: '#e8fbff', alpha: 0.5, shape: 'smoke' });
    }, t => {
      escarcha(k, t.center, t.size, 16);
      k.add(E.ring({ at: t.center, from: 4, to: t.size * 0.75, width: 4, color: HIELO.glow, duration: 260 }));
      k.dibujar(340, (c, u) => {
        const g = easeOutCubic(Math.min(1, u * 3)), a = 1 - easeIn(u);
        for (let i = 0; i < 6; i++) { const ang = (i * Math.PI) / 3 + 0.3; carambano(c, t.center.x + Math.cos(ang) * t.size * 0.15, t.center.y + Math.sin(ang) * t.size * 0.15, t.size * 0.45 * g, t.size * 0.08, ang, a); }
      }, { z: 1 });
    });
  },

  // Esquirla Helada (40): tres esquirlas de hielo pequeñas salen disparadas a toda velocidad, casi a la vez, y se
  // hacen añicos contra el objetivo.
  async iceshard(k) {
    await k.anticipar(50);
    void k.recuperar({ x: -k.dir.x * 5, y: -k.dir.y * 5 }, 140);
    const viaje = 130, L = k.s(0.24), w = k.s(0.06);
    for (let i = 0; i < 3; i++) {
      const lado = (i - 1) * k.s(0.15);
      k.dibujar(viaje, (c, t) => {
        const p = k.punto(0.15 + 0.8 * t, lado * (1 - t)), cola = { x: p.x - k.dir.x * k.s(0.6), y: p.y - k.dir.y * k.s(0.6) };
        c.globalAlpha = 0.6; c.strokeStyle = '#ffffff'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(cola.x, cola.y); c.lineTo(p.x, p.y); c.stroke();
        c.globalAlpha = 1;
        carambano(c, p.x - k.dir.x * L, p.y - k.dir.y * L, L, w, k.angle);
      }, { delay: i * 35, z: 1 });
    }
    await k.esperar(viaje + 70);
    await k.impacto(t => {
      E.sparks(k.fx, t.center, { count: 12, speed: [100, 260], palette: HIELO, shape: 'shard', size: [2, 3.5] });
      k.add(E.ring({ at: t.center, from: 3, to: t.size * 0.4, width: 2, color: '#ffffff', duration: 200 }));
    });
    await k.despues();
  },

  // Chuzos (85): tres carámbanos enormes caen en picado desde lo alto sobre el objetivo (su sombra crece en el suelo),
  // se clavan con un crujido y revientan en esquirlas.
  async iciclecrash(k) {
    await k.anticipar(80);
    void k.recuperar({ x: 0, y: 0 }, 200);
    const top = k.stage.top - 40, cae = 220, c0 = k.target.center, pie = k.target.feet;
    const lista = [{ dx: -0.42, d: 0, L: 0.8 }, { dx: 0.45, d: 60, L: 0.75 }, { dx: 0, d: 130, L: 1.05 }];
    for (const q of lista) {
      const x = c0.x + k.s(q.dx), dest = q.dx === 0 ? c0.y : pie.y - k.s(0.05), L = k.s(q.L), w = L * 0.2;
      k.dibujar(cae + 240, (c, t) => {
        const ms = t * (cae + 240), u = Math.min(1, ms / cae), y = lerp(top, dest, easeIn(u)), a = ms > cae ? 1 - (ms - cae) / 240 : 1;
        // Sombra en el suelo que crece mientras cae.
        c.globalAlpha = 0.3 * u * a; c.fillStyle = '#1d3a4a'; c.beginPath(); c.ellipse(x, pie.y, w * (0.6 + u), w * 0.35 * (0.6 + u), 0, 0, Math.PI * 2); c.fill();
        c.globalAlpha = 1;
        carambano(c, x, y - L, L, w, Math.PI / 2, a);
        if (u < 1) { c.globalAlpha = 0.5; c.strokeStyle = '#ffffff'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(x - w * 0.5, y - L * 1.6); c.lineTo(x - w * 0.5, y - L * 1.1); c.moveTo(x + w * 0.5, y - L * 1.5); c.lineTo(x + w * 0.5, y - L * 1.05); c.stroke(); }
      }, { delay: q.d, z: 1 });
      if (q.dx !== 0) alPasar(k, q.d + cae, () => { escarcha(k, { x, y: dest }, k.s(0.6), 8); k.add(E.cracks({ at: { x, y: pie.y }, length: k.s(0.5), color: '#5a8aa8', duration: 500 })); });
    }
    await k.esperar(130 + cae);
    await k.impacto(t => {
      escarcha(k, t.center, t.size * 1.2, 22);
      nievePolvo(k, t.feet, t.size * 0.8, 6);
      k.add(E.cracks({ at: t.feet, length: t.size * 0.9, color: '#5a8aa8', duration: 600 }));
      k.add(E.ring({ at: t.center, from: 6, to: t.size * 1.0, width: 5, color: HIELO.glow, duration: 320 }));
    });
    await k.esperar(220);
    await k.despues();
  },

  // Carámbano (25, varios golpes): el usuario dispara carámbanos finos y largos uno tras otro en ráfaga recta; cada uno
  // se clava con un chasquido de escarcha.
  async iciclespear(k) {
    const n = Math.min(5, Math.max(2, k.ctx.cue.hitCount)), viaje = 150, cada = 110, L = k.s(0.48), w = k.s(0.055);
    const llega = Math.max(0.2, 1 - (k.target.size * 0.2) / Math.max(1, k.dist));
    await k.anticipar(60);
    for (let i = 0; i < n; i++) {
      const lado = i === 0 ? 0 : (i % 2 ? 1 : -1) * k.s(0.1);
      k.dibujar(viaje + 140, (c, t) => {
        const ms = t * (viaje + 140), u = Math.min(1, ms / viaje), punta = k.punto(lerp(0.15, llega, u), lado), a = ms > viaje ? 1 - (ms - viaje) / 140 : 1;
        carambano(c, punta.x - k.dir.x * L, punta.y - k.dir.y * L, L, w, k.angle, a);
      }, { delay: i * cada, z: 1 });
      void k.animar(k.user.sprite, [{ transform: 'translate(0px, 0px)' }, { transform: `translate(${-k.dir.x * 4}px, ${-k.dir.y * 4}px)`, offset: 0.3 }, { transform: 'translate(0px, 0px)' }], 100);
      if (i > 0) alPasar(k, i * cada + viaje, () => {
        const p = k.punto(llega, lado);
        E.sparks(k.fx, p, { count: 8, speed: [80, 200], palette: HIELO, shape: 'shard', size: [2, 3.5] });
        k.add(E.ring({ at: p, from: 3, to: k.s(0.35), width: 2, color: '#ffffff', duration: 200 }));
        k.destello(k.target.sprite, 90);
      });
    }
    await k.esperar(viaje);
    await k.impacto(t => {
      E.sparks(k.fx, t.center, { count: 10, speed: [80, 220], palette: HIELO, shape: 'shard', size: [2, 3.5] });
      k.add(E.ring({ at: t.center, from: 3, to: t.size * 0.4, width: 2, color: '#ffffff', duration: 200 }));
    });
    await k.esperar((n - 1) * cada + 60);
    await k.despues();
  },

  // Alud (60): bolas de nieve enormes se desploman desde lo alto sobre el objetivo, una tras otra, y revientan en
  // nubes de nieve polvo.
  async avalanche(k) {
    await k.anticipar(90);
    void k.recuperar({ x: 0, y: 0 }, 200);
    const top = k.stage.top - 30, cae = 260, c0 = k.target.center;
    const bolas = [{ dx: 0, r: 0.42, d: 0 }, { dx: -0.55, r: 0.3, d: 70 }, { dx: 0.6, r: 0.34, d: 120 }, { dx: 0.15, r: 0.26, d: 190 }, { dx: -0.3, r: 0.22, d: 240 }];
    for (const b of bolas) {
      const dest = { x: c0.x + k.s(b.dx), y: c0.y + k.s(Math.abs(b.dx) * 0.3) }, r = k.s(b.r);
      k.dibujar(cae, (c, t) => {
        const y = lerp(top, dest.y, easeIn(t));
        c.globalAlpha = 0.5; c.strokeStyle = '#ffffff'; c.lineWidth = 2;
        c.beginPath(); c.moveTo(dest.x - r * 0.5, y - r * 2.2); c.lineTo(dest.x - r * 0.5, y - r * 1.1); c.moveTo(dest.x + r * 0.4, y - r * 2); c.lineTo(dest.x + r * 0.4, y - r); c.stroke();
        bolaNieve(c, dest.x, y, r, t * 6);
      }, { delay: b.d, z: 1 });
      if (b.d > 0) alPasar(k, b.d + cae, () => { nievePolvo(k, dest, r * 1.6, 6); k.add(E.ring({ at: dest, from: r * 0.4, to: r * 1.6, width: 3, color: '#ffffff', duration: 260, squash: 0.5 })); });
    }
    await k.esperar(cae);
    await k.impacto(t => {
      nievePolvo(k, t.center, t.size * 1.1, 10);
      escarcha(k, t.center, t.size, 10);
      k.add(E.ring({ at: t.center, from: 6, to: t.size, width: 4, color: '#ffffff', duration: 300 }));
    });
    await k.esperar(300);
    await k.despues();
  },

  // Ventisca (110): la vista se oscurece y se blanquea; una tormenta de nieve barre todo hacia los rivales: cortinas
  // de viento blanco, copos grandes que giran y muchísimos puntos de nieve; escarcha al final.
  async blizzard(k) {
    k.add(E.dim({ at: k.user.center, duration: 1000, strength: 0.4 }));
    await k.cargar(150);
    const dura = 760, at = k.user.center, largo = k.dist + k.s(2), ancho = Math.max(k.s(2), k.dist);
    const blanco: FxPalette = { core: '#dff6ff', glow: '#ffffff', hot: '#ffffff', dark: HIELO.dark };
    for (let i = 0; i < 2; i++) k.add(E.sweep({ fromX: at.x - k.s(0.5), toX: at.x + largo, top: at.y - ancho, bottom: at.y + ancho, palette: blanco, duration: 460, look: 'light', rotate: { at, angle: k.angle }, thickness: k.s(1.2), delay: i * 180 }));
    k.dibujar(dura, (c, t, engine) => {
      c.globalAlpha = 0.22 * Math.sin(Math.PI * t); c.fillStyle = '#eaf6ff'; c.fillRect(engine.offset.x, engine.offset.y, engine.width, engine.height);
      if (t > 0.85) return;
      for (let i = 0; i < 4; i++) {
        const p = k.punto(rand(-0.4, 0.3), rand(-1, 1) * ancho), v = rand(700, 1000);
        k.emit({ x: p.x, y: p.y, vx: k.dir.x * v + k.perp.x * rand(-60, 60), vy: k.dir.y * v + k.perp.y * rand(-60, 60) + rand(-20, 60), life: rand(380, 520), size: rand(1.2, 2.6), color: Math.random() < 0.7 ? '#ffffff' : HIELO.glow, shape: Math.random() < 0.5 ? 'streak' : 'dot', stretch: 40 });
      }
    }, { z: 1 });
    const copos = Array.from({ length: 7 }, () => ({ lado: rand(-1, 1) * Math.max(k.s(0.8), k.dist * 0.6), d: rand(0, 250), tam: k.s(rand(0.12, 0.22)), giro: rand(4, 9) }));
    k.dibujar(dura, (c, t) => {
      const ms = t * dura;
      for (const q of copos) {
        const u = (ms - q.d) / 420;
        if (u <= 0 || u >= 1) continue;
        const p = k.punto(-0.2 + 1.6 * u, q.lado + Math.sin(u * 6) * k.s(0.2));
        copo(c, p.x, p.y, q.tam, (ms / 1000) * q.giro, Math.sin(Math.PI * u));
      }
    }, { z: 1 });
    await k.esperar(300);
    await k.impacto(t => {
      escarcha(k, t.center, t.size * 1.2, 18);
      nievePolvo(k, t.center, t.size, 8);
      k.add(E.ring({ at: t.center, from: 6, to: t.size * 1.2, width: 5, color: '#ffffff', duration: 340 }));
    });
    await k.esperar(dura - 360);
    await k.despues();
  },

  // Liofilización (70): una niebla helada llega al objetivo y a su alrededor brotan ramas de cristal que crecen hacia
  // dentro y lo encierran en una red de escarcha; luego se rompe soltando vapor.
  async freezedry(k) {
    await k.cargar(100);
    const desde = k.punto(0.15), v = k.haciaV(((k.dist * 0.85) / 260) * 1000);
    k.burst(14, i => ({ x: desde.x, y: desde.y, vx: v.x + rand(-30, 30), vy: v.y + rand(-30, 30), life: 260, delay: i * 10, size: k.s(0.1), sizeEnd: k.s(0.25), color: '#e8fbff', alpha: 0.5, shape: 'smoke' }));
    await k.esperar(220);
    const c0 = k.target.center, R = k.s(0.75), crece = 260;
    const ramas = Array.from({ length: 7 }, (_, i) => { const a = (i / 7) * Math.PI * 2 + rand(-0.2, 0.2); return { ini: k.alrededor(c0, R, a, 0.8), f1: rand(0.3, 0.45), f2: rand(0.55, 0.7) }; });
    k.dibujar(crece + 380, (c, t, engine) => {
      const ms = t * (crece + 380), g = Math.min(1, ms / crece), sale = ms > crece + 180 ? 1 - (ms - crece - 180) / 200 : 1;
      if (sale <= 0) return;
      orbe(c, engine, c0, k.s(0.5), HIELO, 0.45 * g * sale);
      c.lineCap = 'round';
      for (const rm of ramas) {
        const dx = c0.x - rm.ini.x, dy = c0.y - rm.ini.y, l = Math.hypot(dx, dy) || 1, ux = dx / l, uy = dy / l, fin = { x: rm.ini.x + dx * g * 0.85, y: rm.ini.y + dy * g * 0.85 };
        const lineas: [Vec, Vec][] = [[rm.ini, fin]];
        for (const f of [rm.f1, rm.f2]) {
          const crec = Math.min(1, Math.max(0, (g * 0.85 - f) / 0.3));
          if (crec <= 0) continue;
          const b = { x: rm.ini.x + dx * f, y: rm.ini.y + dy * f }, lr = R * 0.22 * crec;
          for (const s of [-0.7, 0.7]) { const ca = Math.cos(s), sa = Math.sin(s); lineas.push([b, { x: b.x + (ux * ca - uy * sa) * lr, y: b.y + (ux * sa + uy * ca) * lr }]); }
        }
        for (const [col, lw, al] of [[HIELO.dark, 4, 0.6], ['#ffffff', 2, 1]] as const) {
          c.globalAlpha = sale * al; c.strokeStyle = col; c.lineWidth = lw; c.beginPath();
          for (const [a, b] of lineas) { c.moveTo(a.x, a.y); c.lineTo(b.x, b.y); }
          c.stroke();
        }
      }
      for (const rm of ramas) copo(c, rm.ini.x, rm.ini.y, k.s(0.09) * g, g * 2, sale);
    }, { z: 1 });
    await k.esperar(crece);
    await k.impacto(t => {
      escarcha(k, t.center, t.size, 14);
      k.add(E.ring({ at: t.center, from: t.size * 0.2, to: t.size * 0.95, width: 4, color: HIELO.glow, duration: 320 }));
      k.burst(8, i => ({ x: t.center.x + rand(-t.size * 0.35, t.size * 0.35), y: t.center.y + rand(-t.size * 0.3, t.size * 0.2), vy: -rand(40, 80), life: 700, delay: 160 + i * 25, size: t.size * 0.15, sizeEnd: t.size * 0.4, color: '#f2fbff', alpha: 0.5, shape: 'smoke' }));
    });
    await k.esperar(260);
    await k.despues();
  },

  // Vaho Gélido (60): el usuario sopla un cono de aliento helado: vaho blanco azulado que se abre en abanico y
  // arrastra cristalitos; el objetivo queda escarchado (siempre es crítico).
  async frostbreath(k) {
    await k.anticipar(90);
    void k.animar(k.user.sprite, [{ transform: `translate(${-k.dir.x * 8}px, ${-k.dir.y * 8}px) scale(1.06, 0.93)` }, { transform: `translate(${k.dir.x * 4}px, ${k.dir.y * 4}px) scale(0.96, 1.04)`, offset: 0.3 }, { transform: 'translate(0px, 0px) scale(1, 1)' }], 420);
    const dura = 420, boca = k.punto(0.1), abre = 0.28;
    k.dibujar(dura, (c, t) => {
      const a = Math.sin(Math.PI * t) * 0.35, p1 = k.punto(1.1, k.s(0.6)), p2 = k.punto(1.1, -k.s(0.6));
      const g = c.createLinearGradient(boca.x, boca.y, k.target.center.x, k.target.center.y);
      g.addColorStop(0, withAlpha('#ffffff', 0.7)); g.addColorStop(1, withAlpha(HIELO.glow, 0));
      c.globalAlpha = a; c.fillStyle = g; c.beginPath(); c.moveTo(boca.x, boca.y); c.lineTo(p1.x, p1.y); c.lineTo(p2.x, p2.y); c.closePath(); c.fill();
      if (t > 0.8) return;
      for (let i = 0; i < 3; i++) {
        const an = k.angle + rand(-abre, abre), v = rand(2.6, 3.6) * k.dist;
        k.emit({ x: boca.x, y: boca.y, vx: Math.cos(an) * v, vy: Math.sin(an) * v, drag: 1.6, life: rand(380, 520), size: k.s(0.08), sizeEnd: k.s(0.32), color: pick(['#e8fbff', HIELO.glow, '#ffffff']), alpha: 0.5, shape: 'smoke' });
      }
      if (Math.random() < 0.5) { const an = k.angle + rand(-abre, abre), v = rand(2.2, 3) * k.dist; k.emit({ x: boca.x, y: boca.y, vx: Math.cos(an) * v, vy: Math.sin(an) * v, drag: 1.6, life: 420, size: rand(2, 3.5), color: pick([HIELO.core, '#ffffff']), shape: 'shard', spin: rand(-10, 10) }); }
    });
    await k.esperar(dura * 0.5);
    await k.impacto(t => {
      escarcha(k, t.center, t.size, 14);
      k.add(E.bloom({ at: t.center, radius: t.size * 0.6, color: HIELO.glow, duration: 320 }));
    });
    await k.esperar(dura * 0.4);
    await k.despues();
  },

  // Rayo Hielo (90): un rayo celeste helado; según avanza brotan cristales a lo largo de su recorrido, y en el
  // objetivo crecen carámbanos hacia fuera que lo congelan y estallan.
  async icebeam(k) {
    await k.cargar(150);
    const dura = 520, desde = k.punto(0.1);
    k.add(E.beam({ from: desde, to: k.target.center, width: k.s(0.18), palette: HIELO, duration: dura }));
    k.add(E.flash({ color: HIELO.glow, alpha: 0.15, duration: 200 }));
    const crist = Array.from({ length: 9 }, (_, i) => ({ u: 0.18 + i * 0.09, lado: i % 2 ? 1 : -1, ang: rand(0.5, 1.1), largo: k.s(rand(0.18, 0.3)), t0: -1 }));
    k.dibujar(dura + 150, (c, t) => {
      const ms = t * (dura + 150), alcance = 0.1 + 0.9 * easeOutCubic(Math.min(1, ms / (dura * 0.25))), sale = t > 0.75 ? 1 - (t - 0.75) / 0.25 : 1;
      for (const q of crist) {
        if (alcance < q.u) continue;
        if (q.t0 < 0) q.t0 = ms;
        const g = easeOutCubic(Math.min(1, (ms - q.t0) / 120)), p = k.punto(q.u), a = k.angle + Math.PI + q.lado * (Math.PI - q.ang);
        carambano(c, p.x, p.y, q.largo * g, q.largo * 0.22 * g, a, sale);
      }
      if (Math.random() < 0.6) { const p = k.punto(rand(0.15, alcance), rand(-k.s(0.12), k.s(0.12))); k.emit({ x: p.x, y: p.y, vx: rand(-30, 30), vy: rand(-30, 30), life: 300, size: rand(2.5, 4.5), color: '#ffffff', shape: 'star', rot: rand(0, 1) }); }
    }, { z: 1 });
    await k.esperar(dura * 0.4);
    await k.impacto(t => {
      k.dibujar(340, (c, u) => {
        const g = easeOutCubic(Math.min(1, u * 3)), a = u > 0.6 ? 1 - (u - 0.6) / 0.4 : 1;
        for (let i = 0; i < 8; i++) { const ang = (i * Math.PI) / 4 + 0.2; carambano(c, t.center.x, t.center.y, t.size * (i % 2 ? 0.5 : 0.7) * g, t.size * 0.1, ang, a); }
      }, { z: 1 });
      alPasar(k, 300, () => escarcha(k, t.center, t.size * 1.1, 18));
      k.add(E.ring({ at: t.center, from: 6, to: t.size * 1.0, width: 4, color: HIELO.hot, duration: 320 }));
    });
    await k.esperar(dura * 0.5);
    await k.despues();
  },

  // Viento Hielo (55): ráfagas de viento helado en curvas largas (cintas blancas y celestes que serpentean) que
  // arrastran copitos hacia los rivales.
  async icywind(k) {
    await k.anticipar(70);
    void k.recuperar({ x: -k.dir.x * 6, y: -k.dir.y * 6 }, 200);
    const dura = 560, largo = k.dist + k.s(0.8), at = k.user.center;
    const rafagas = Array.from({ length: 5 }, (_, i) => ({ lado: (i - 2) * k.s(0.28), fase: rand(0, 6), d: i * 40, amp: k.s(rand(0.12, 0.25)) }));
    k.dibujar(dura, (c, t) => {
      const ms = t * dura;
      c.lineCap = 'round'; c.lineJoin = 'round';
      for (const r of rafagas) {
        const u = (ms - r.d) / 360;
        if (u <= 0 || u >= 1.45) continue;
        const cab = Math.min(1, u), col = Math.max(0, u - 0.45), pts: Vec[] = [];
        for (let i = 0; i <= 14; i++) {
          const s = lerp(col, cab, i / 14), lado = r.lado * (0.4 + 0.6 * s) + Math.sin(s * 7 + r.fase) * r.amp;
          pts.push({ x: at.x + k.dir.x * largo * s + k.perp.x * lado, y: at.y + k.dir.y * largo * s + k.perp.y * lado });
        }
        for (const [col2, lw, al] of [[HIELO.glow, 4, 0.55], ['#ffffff', 1.6, 0.9]] as const) {
          c.globalAlpha = al; c.strokeStyle = col2; c.lineWidth = lw; c.beginPath();
          pts.forEach((p, i) => (i ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y))); c.stroke();
        }
        if (u < 1 && Math.random() < 0.4) { const h = pts[pts.length - 1]; k.emit({ x: h.x, y: h.y, vx: k.dir.x * 200 + rand(-30, 30), vy: k.dir.y * 200 + rand(-30, 30), drag: 2, life: 380, size: rand(1.4, 2.4), color: '#ffffff', shape: 'dot' }); }
      }
    }, { z: 1 });
    await k.esperar(300);
    await k.impacto(t => {
      E.sparks(k.fx, t.center, { count: 10, speed: [80, 200], palette: HIELO, shape: 'shard', size: [2, 3.5] });
      k.burst(8, () => ({ x: t.center.x + rand(-t.size * 0.4, t.size * 0.4), y: t.center.y + rand(-t.size * 0.4, t.size * 0.3), life: 400, delay: rand(0, 150), size: rand(2.5, 4), color: '#ffffff', shape: 'star', rot: rand(0, 1) }));
    });
    await k.esperar(220);
    await k.despues();
  },

  // Nieve Polvo (40): un soplido suave de nieve en polvo: puntitos blancos y algún copito que flotan hasta el objetivo
  // y lo espolvorean.
  async powdersnow(k) {
    await k.anticipar(60);
    void k.recuperar({ x: -k.dir.x * 5, y: -k.dir.y * 5 }, 160);
    const desde = k.punto(0.12), viaje = 380;
    k.burst(26, i => {
      const fin = k.punto(1, rand(-1, 1) * k.s(0.35));
      return { x: desde.x + rand(-3, 3), y: desde.y + rand(-3, 3), vx: ((fin.x - desde.x) / viaje) * 1000, vy: ((fin.y - desde.y) / viaje) * 1000 - 20, ay: 40, life: viaje + rand(0, 120), delay: i * 8, size: rand(1.2, 2.4), color: Math.random() < 0.8 ? '#ffffff' : HIELO.glow, shape: 'dot', fadeIn: 0.1 };
    });
    for (let i = 0; i < 3; i++) {
      k.dibujar(viaje, (c, t) => {
        const p = k.punto(0.12 + 0.88 * t, (i - 1) * k.s(0.2) + Math.sin(t * 8 + i) * k.s(0.06));
        copo(c, p.x, p.y, k.s(0.07), t * 5 + i, Math.sin(Math.PI * Math.min(1, t * 1.2)));
      }, { delay: i * 50, z: 1 });
    }
    await k.esperar(viaje - 40);
    await k.impacto(t => {
      k.burst(12, () => ({ x: t.center.x + rand(-t.size * 0.4, t.size * 0.4), y: t.center.y - rand(0, t.size * 0.4), vy: rand(20, 50), vx: rand(-10, 10), life: rand(400, 600), size: rand(1.2, 2.2), color: '#ffffff', shape: 'dot' }));
      k.add(E.ring({ at: t.center, from: 4, to: t.size * 0.5, width: 2, color: '#ffffff', duration: 260, alpha: 0.7 }));
    });
    await k.despues();
  },

  // Frío Polar (fulminante): todo se oscurece y se tiñe de azul, el viento helado converge en el objetivo y un bloque
  // de hielo enorme crece desde el suelo hasta encerrarlo; brilla un instante y se hace añicos.
  async sheercold(k) {
    k.add(E.dim({ at: k.target.center, duration: 1300, strength: 0.5 }));
    await k.cargar(160);
    const c0 = k.target.center, s = k.target.size, forma_ = 300, total = forma_ + 320;
    k.dibujar(total + 160, (c, t, engine) => {
      c.globalAlpha = 0.16 * Math.sin(Math.PI * t); c.fillStyle = '#5fb8ff'; c.fillRect(engine.offset.x, engine.offset.y, engine.width, engine.height);
    });
    k.burst(30, i => {
      const a = rand(0, Math.PI * 2), r = s * rand(2.2, 3.2), p = k.alrededor(c0, r, a, 0.7);
      return { x: p.x, y: p.y, vx: ((c0.x - p.x) / 300) * 1000, vy: ((c0.y - p.y) / 300) * 1000, life: 300, delay: i * 6, size: rand(1.5, 2.6), color: pick(['#ffffff', HIELO.glow]), shape: 'streak', stretch: 50 };
    });
    const base = k.target.feet.y + s * 0.12, w = s * 0.62, h = s * 1.35;
    k.dibujar(total, (c, t) => {
      const ms = t * total, g = easeOutCubic(Math.min(1, ms / forma_)), yTop = base - h * g;
      if (g <= 0.01) return;
      c.globalAlpha = 1;
      const gr = c.createLinearGradient(c0.x - w, yTop, c0.x + w, base);
      gr.addColorStop(0, withAlpha('#ffffff', 0.6)); gr.addColorStop(0.4, withAlpha(HIELO.glow, 0.5)); gr.addColorStop(1, withAlpha(HIELO.dark, 0.6));
      c.fillStyle = gr; c.beginPath();
      c.moveTo(c0.x - w, base); c.lineTo(c0.x - w, yTop + w * 0.25); c.lineTo(c0.x - w * 0.6, yTop); c.lineTo(c0.x + w * 0.6, yTop); c.lineTo(c0.x + w, yTop + w * 0.25); c.lineTo(c0.x + w, base); c.closePath();
      c.fill(); c.lineJoin = 'round'; c.strokeStyle = '#ffffff'; c.lineWidth = 2.5; c.stroke();
      // Facetas.
      c.globalAlpha = 0.5; c.lineWidth = 1.5; c.beginPath();
      c.moveTo(c0.x - w * 0.6, yTop); c.lineTo(c0.x - w * 0.35, base); c.moveTo(c0.x + w * 0.6, yTop); c.lineTo(c0.x + w * 0.2, base); c.moveTo(c0.x - w, yTop + w * 0.25); c.lineTo(c0.x + w, yTop + h * 0.45 * g);
      c.stroke();
      // Brillo que cruza cuando ya está entero.
      if (g >= 1) {
        const bx = lerp(c0.x - w * 1.5, c0.x + w * 1.5, Math.min(1, (ms - forma_) / 260));
        c.save(); c.beginPath(); c.rect(c0.x - w, yTop, w * 2, base - yTop); c.clip();
        c.globalAlpha = 0.6; c.fillStyle = '#ffffff'; c.beginPath(); c.moveTo(bx, yTop); c.lineTo(bx + w * 0.25, yTop); c.lineTo(bx - w * 0.35, base); c.lineTo(bx - w * 0.6, base); c.closePath(); c.fill();
        c.restore();
      }
    }, { z: 1 });
    alPasar(k, total - 20, () => {
      escarcha(k, c0, s * 1.6, 30);
      k.add(E.starburst({ at: c0, rays: 10, length: s * 1.2, width: 4, palette: HIELO, duration: 300 }));
      nievePolvo(k, c0, s, 8);
    });
    await k.esperar(forma_);
    k.add(E.flash({ color: '#e8fbff', alpha: 0.35, duration: 260 }));
    await k.impacto(t => { k.add(E.ring({ at: t.center, from: 6, to: t.size * 1.3, width: 5, color: '#ffffff', duration: 360 })); });
    await k.esperar(total - forma_);
    await k.despues();
  },

  // Granizo (estado): nubes gris claro y frías bajan a lo alto de la vista y sueltan las primeras piedras de granizo,
  // que rebotan en el suelo (el granizo de verdad lo pinta la capa de clima).
  async hail(k) {
    const dura = 860;
    void k.animar(k.user.sprite, [{ transform: 'translate(0px, 0px) scale(1, 1)' }, { transform: 'translate(0px, -4px) scale(0.97, 1.05)', offset: 0.4 }, { transform: 'translate(0px, 0px) scale(1, 1)' }], 360);
    const nubes = Array.from({ length: 5 }, (_, i) => ({ x: 0.1 + i * 0.2, y: 0.08 + (i % 2) * 0.04, r: 0.085 + (i % 3) * 0.01, d: i * 0.06 }));
    k.dibujar(dura, (c, t, engine) => {
      const sale = t > 0.8 ? 1 - (t - 0.8) / 0.2 : 1, x0 = engine.offset.x, y0 = engine.offset.y, W = engine.width, H = engine.height;
      c.globalAlpha = 0.14 * Math.min(1, t * 2) * sale; c.fillStyle = '#9fb4c8'; c.fillRect(x0, y0, W, H);
      for (const n of nubes) {
        const u = easeOutCubic(Math.min(1, Math.max(0, (t - n.d) * 2.2))), x = x0 + W * n.x, y = y0 + H * lerp(-0.15, n.y, u), r = W * n.r;
        nube(c, x, y, r, '#c4cfdc', '#8392a6', 0.95 * sale);
        if (t > 0.35 && t < 0.8 && Math.random() < 0.12) {
          const px = x + rand(-r, r), py = y + r * 0.3, cae = H * rand(0.25, 0.7), vy = 800, ms = (cae / vy) * 1000;
          k.emit({ x: px, y: py, vy, life: ms, size: rand(2, 3), color: '#eef8ff', accent: '#7fa8c4', shape: 'rock', spin: rand(-6, 6) });
          k.emit({ x: px, y: py + cae, vx: rand(-60, 60), vy: -rand(120, 200), ay: 900, life: 320, delay: ms, size: rand(1.8, 2.6), color: '#eef8ff', accent: '#7fa8c4', shape: 'rock', spin: rand(-8, 8) });
        }
      }
    }, { z: 1 });
    await k.esperar(560);
    await k.estado();
  },

  // Paisaje Nevado (estado): nubes blancas y mullidas aparecen en lo alto y empiezan a soltar copos grandes que caen
  // meciéndose (la nevada sigue en la capa de clima).
  async snowscape(k) {
    const dura = 920;
    const nubes = Array.from({ length: 4 }, (_, i) => ({ x: 0.15 + i * 0.24, y: 0.09 + ((i * 3) % 2) * 0.035, r: 0.09 + (i % 2) * 0.015 }));
    const copos = Array.from({ length: 9 }, (_, i) => ({ x: 0.08 + i * 0.105 + rand(-0.03, 0.03), d: rand(0, 0.35), cae: rand(0.35, 0.75), tam: rand(0.012, 0.02), fase: rand(0, 6) }));
    k.dibujar(dura, (c, t, engine) => {
      const sale = t > 0.8 ? 1 - (t - 0.8) / 0.2 : 1, entra = Math.min(1, t * 3), x0 = engine.offset.x, y0 = engine.offset.y, W = engine.width, H = engine.height;
      c.globalAlpha = 0.12 * entra * sale; c.fillStyle = '#eef6ff'; c.fillRect(x0, y0, W, H);
      for (const n of nubes) nube(c, x0 + W * n.x, y0 + H * n.y, W * n.r * (0.7 + 0.3 * entra), '#f6f9fc', '#c8d6e4', entra * sale);
      for (const q of copos) {
        const u = (t - q.d) / 0.6;
        if (u <= 0 || u >= 1) continue;
        const x = x0 + W * q.x + Math.sin(u * 6 + q.fase) * W * 0.02, y = y0 + H * lerp(0.12, 0.12 + q.cae, u);
        copo(c, x, y, W * q.tam, u * 3 + q.fase, Math.sin(Math.PI * u) * sale);
      }
      if (t > 0.2 && t < 0.8 && Math.random() < 0.5) k.emit({ x: x0 + rand(0, W), y: y0 + H * 0.14, vx: rand(-20, 20), vy: rand(60, 120), life: 700, size: rand(1.2, 2.2), color: '#ffffff', shape: 'dot' });
    }, { z: 1 });
    await k.esperar(560);
    await k.estado();
  },

  // Niebla (estado): del usuario sale una humareda gris oscura que se extiende por toda la vista y lo enturbia todo un
  // momento; al disiparse, una onda gris borra los cambios de características.
  async haze(k) {
    const u0 = k.user.center, s = k.user.size, dura = 900;
    void k.animar(k.user.sprite, [{ transform: 'scale(1, 1)' }, { transform: 'scale(1.1, 0.9)', offset: 0.3 }, { transform: 'scale(1, 1)' }], 300);
    k.burst(24, i => {
      const a = rand(0, Math.PI * 2), v = rand(160, 420);
      return { x: u0.x, y: u0.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v * 0.7, drag: 1.4, life: rand(700, 900), delay: i * 10, size: s * 0.3, sizeEnd: s * rand(1, 1.4), color: pick(['#3a3a48', '#4a4658', '#2a2a34']), alpha: 0.5, fadeIn: 0.2, shape: 'smoke' };
    });
    k.dibujar(dura, (c, t, engine) => {
      const a = Math.sin(Math.PI * t);
      c.globalAlpha = 0.3 * a; c.fillStyle = '#22222c'; c.fillRect(engine.offset.x, engine.offset.y, engine.width, engine.height);
      c.strokeStyle = '#8a8a9a'; c.lineWidth = 2; c.lineCap = 'round';
      for (let i = 0; i < 3; i++) {
        const r = s * (0.8 + i * 0.6) * (0.5 + t), ang = engine.now / 300 + i * 2;
        c.globalAlpha = 0.35 * a; c.beginPath(); c.ellipse(u0.x, u0.y, r, r * 0.55, 0, ang, ang + 2.2); c.stroke();
      }
    });
    await k.esperar(480);
    k.add(E.ring({ at: { x: k.stage.left + k.stage.width / 2, y: k.stage.top + k.stage.height / 2 }, from: 10, to: k.stage.width * 0.6, width: 4, color: '#c9d2dc', duration: 420, squash: 0.45 }));
    await k.estado();
  },

  // Neblina (estado): una bruma blanca y brillante se posa alrededor del usuario como una cúpula de niebla fina, con
  // destellos de hielo que la protegen.
  async mist(k) {
    const u0 = k.user.center, s = k.user.size, dura = 820;
    k.burst(16, i => {
      const a = (i / 16) * Math.PI * 2, p = k.alrededor(u0, s * rand(0.5, 1), a, 0.5);
      return { x: p.x, y: p.y + s * 0.15, vx: -Math.sin(a) * 35, vy: Math.cos(a) * 12 - 8, life: rand(700, 850), delay: i * 14, size: s * 0.32, sizeEnd: s * 0.62, color: pick(['#ffffff', '#eefbff', HIELO.glow]), alpha: 0.42, fadeIn: 0.35, shape: 'smoke' };
    });
    k.burst(10, i => ({ x: u0.x + rand(-s * 0.9, s * 0.9), y: u0.y + rand(-s * 0.7, s * 0.5), life: 380, delay: 120 + i * 45, size: rand(3, 5), color: pick(['#ffffff', HIELO.glow]), shape: 'star', rot: rand(0, 1), fadeIn: 0.4 }));
    k.dibujar(dura, (c, t) => {
      const a = Math.sin(Math.PI * t), rx = s * 0.95, ry = s * 0.75;
      const g = c.createRadialGradient(u0.x, u0.y, rx * 0.2, u0.x, u0.y, rx);
      g.addColorStop(0, withAlpha('#ffffff', 0)); g.addColorStop(1, withAlpha('#eefbff', 0.3));
      c.globalAlpha = a; c.fillStyle = g; c.beginPath(); c.ellipse(u0.x, u0.y, rx, ry, 0, 0, Math.PI * 2); c.fill();
      c.globalAlpha = a * 0.5; c.strokeStyle = '#ffffff'; c.lineWidth = 1.5; c.stroke();
    }, { z: 1 });
    await k.esperar(460);
    await k.estado();
  },

  // ======================================== ELÉCTRICO ========================================

  // Colmillo Rayo (65): mandíbulas eléctricas (encía amarilla, dientes blancos) con rayos que saltan entre los
  // dientes de arriba y los de abajo; al cerrarse, descarga.
  async thunderfang(k) {
    const arcos = cadaTanto(45, () => [rand(-0.7, 0.7), rand(-0.7, 0.7), rand(0, 1000)]);
    await mordisco(k, { base: rellenoRayo, claro: '#ffffff', borde: '#5a4000', brillo: ELEC.core, brilloTam: 12 }, (c, c0, tam, ap, engine, fuera) => {
      if (fuera > 0.5) return;
      const [x1, x2, sem] = arcos(engine.now), hueco = tam * (0.12 + ap * 0.55);
      for (const xx of [x1, x2]) trazoRayo(c, zigzag({ x: c0.x + xx * tam, y: c0.y - hueco }, { x: c0.x + xx * tam * 0.8, y: c0.y + hueco }, 5, tam * 0.12, sem + xx), 1.6, 1 - fuera * 2);
      if (Math.random() < 0.3) k.emit({ x: c0.x + rand(-0.8, 0.8) * tam, y: c0.y + rand(-1, 1) * hueco, vx: rand(-120, 120), vy: rand(-120, 120), drag: 3, life: 220, size: 1.8, color: pick([ELEC.glow, ELEC.hot]), shape: 'streak', stretch: 26 });
    }, t => {
      rayitos(k, t.center, t.size * 0.7, 5, 240);
      E.sparks(k.fx, t.center, { count: 16, speed: [160, 380], palette: ELEC, shape: 'streak' });
    });
  },

  // Puño Trueno (75): un puño hecho de electricidad (amarillo y blanco, con rayitos que le saltan del borde) sale
  // disparado y descarga al golpear.
  async thunderpunch(k) {
    await k.anticipar(90);
    void k.embestida({ hasta: 0.25, ida: 100, vuelta: 260 });
    const ms = 220, borde = contorno('puno', 14), tam = (t: number) => k.s(0.22 + 0.18 * t);
    const saltos = cadaTanto(50, () => borde.filter(() => Math.random() < 0.35).map(u => ({ u, l: rand(0.35, 0.75), sem: rand(0, 1000) })));
    let fin: Vec = k.target.center;
    const puno = (c: CanvasRenderingContext2D, p: Vec, r: number, ahora: number, alpha: number) => {
      c.save(); c.globalAlpha = alpha;
      forma(c, 'puno', p.x, p.y, r, k.angle, { base: rellenoRayo, claro: '#ffffff', oscuro: '#c89a00', borde: '#6a4a00', brillo: ELEC.glow, brilloTam: r * 0.8 });
      c.restore();
      for (const sa of saltos(ahora)) {
        const a = aEscena(sa.u, p.x, p.y, r, k.angle), dx = a.x - p.x, dy = a.y - p.y, l = Math.hypot(dx, dy) || 1;
        trazoRayo(c, zigzag(a, { x: a.x + (dx / l) * r * sa.l, y: a.y + (dy / l) * r * sa.l }, 3, r * 0.12, sa.sem), Math.max(1, r * 0.05), alpha);
      }
    };
    k.dibujar(ms, (c, t, engine) => {
      const p = k.punto(0.15 + 0.7 * t), r = tam(t);
      fin = p;
      puno(c, p, r, engine.now, 1);
      if (Math.random() < 0.5) k.emit({ x: p.x, y: p.y, vx: -k.dir.x * 120 + rand(-60, 60), vy: -k.dir.y * 120 + rand(-60, 60), drag: 3, life: 220, size: 1.8, color: ELEC.hot, shape: 'streak', stretch: 24 });
    }, { z: 1 });
    await k.esperar(ms);
    k.dibujar(160, (c, t, engine) => puno(c, fin, tam(1) * (1 + 0.25 * t), engine.now, 1 - t), { z: 1 });
    await k.impacto(t => {
      rayitos(k, t.center, t.size * 0.7, 5, 240);
      E.sparks(k.fx, t.center, { count: 18, speed: [160, 400], palette: ELEC, shape: 'streak' });
      k.add(E.ring({ at: t.center, from: 6, to: t.size * 0.9, width: 4, color: ELEC.glow, duration: 280 }));
    });
    await k.despues();
  },

  // Impactrueno (40): un chispazo pequeño y rápido: chispitas en el usuario y un rayito fino sin ramas.
  async thundershock(k) {
    await k.anticipar(60);
    E.sparks(k.fx, k.punto(0.1), { count: 5, speed: [60, 140], palette: ELEC, shape: 'streak', size: [1.2, 2] });
    k.add(E.bolt({ from: k.punto(0.15), to: k.target.center, palette: ELEC, duration: 200, width: 2.2, branches: 0 }));
    void k.recuperar({ x: -k.dir.x * 5, y: -k.dir.y * 5 }, 160);
    await k.esperar(70);
    await k.impacto(t => { E.sparks(k.fx, t.center, { count: 8, speed: [80, 200], palette: ELEC, shape: 'streak', size: [1.2, 2] }); });
    await k.despues();
  },

  // Rayo (90): el usuario chisporrotea y suelta un relámpago grueso y ramificado directo al objetivo, con fogonazo
  // amarillo y chispas por todas partes.
  async thunderbolt(k) {
    await k.cargar(150);
    rayitos(k, k.user.center, k.user.size * 0.5, 3, 160);
    await k.esperar(60);
    k.add(E.bolt({ from: k.punto(0.1), to: k.target.center, palette: ELEC, duration: 380, width: 7, branches: 3 }));
    k.add(E.bolt({ from: k.punto(0.1), to: k.target.center, palette: ELEC, duration: 300, width: 3, branches: 1, delay: 60 }));
    k.add(E.flash({ color: ELEC.glow, alpha: 0.35, duration: 220 }));
    void k.recuperar({ x: -k.dir.x * 10, y: -k.dir.y * 10 }, 260);
    await k.esperar(50);
    await k.impacto(t => {
      rayitos(k, t.center, t.size * 0.7, 6, 260);
      E.sparks(k.fx, t.center, { count: 24, speed: [180, 460], palette: ELEC, shape: 'streak' });
      k.add(E.bloom({ at: t.center, radius: t.size * 0.9, color: ELEC.glow, duration: 300 }));
    });
    await k.esperar(250);
    await k.despues();
  },

  // Trueno (110): la vista se oscurece, una nube negra se forma sobre el objetivo y cae del cielo un rayo enorme, con
  // fogonazo blanco, ramas y el suelo chamuscado.
  async thunder(k) {
    k.add(E.dim({ at: k.target.center, duration: 900, strength: 0.55 }));
    const c0 = k.target.center, s = k.target.size, top = k.stage.top - 10, ny = k.stage.top + s * 0.5;
    k.dibujar(820, (c, t, engine) => {
      const crece = easeOutCubic(Math.min(1, t * 3)), sale = t > 0.75 ? 1 - (t - 0.75) / 0.25 : 1;
      nube(c, c0.x, ny, s * 1.1 * crece, '#4a4e5c', '#24262e', 0.95 * sale);
      if (Math.random() < 0.25 && sale > 0.3) orbe(c, engine, { x: c0.x + rand(-s * 0.6, s * 0.6), y: ny + rand(-s * 0.2, s * 0.2) }, s * 0.3, ELEC, 0.6);
    }, { z: 1 });
    void k.animar(k.user.sprite, [{ transform: 'translate(0px, 0px) scale(1, 1)' }, { transform: 'translate(0px, -5px) scale(0.96, 1.06)', offset: 0.5 }, { transform: 'translate(0px, 0px) scale(1, 1)' }], 300);
    rayitos(k, k.user.center, k.user.size * 0.5, 2, 180);
    await k.esperar(280);
    const desde = { x: c0.x + rand(-s * 0.3, s * 0.3), y: Math.max(top, ny) };
    k.add(E.bolt({ from: desde, to: c0, palette: ELEC, duration: 360, width: 9, branches: 4 }));
    k.add(E.bolt({ from: { x: desde.x + s * 0.4, y: desde.y }, to: c0, palette: ELEC, duration: 300, width: 4, branches: 2, delay: 40 }));
    k.add(E.flash({ color: '#ffffff', alpha: 0.6, duration: 260 }));
    k.add(E.flash({ color: ELEC.glow, alpha: 0.3, duration: 200, delay: 120 }));
    await k.esperar(40);
    await k.impacto(t => {
      k.dibujar(700, (c, u) => { c.globalAlpha = 0.45 * (1 - u); c.fillStyle = '#1e1a14'; c.beginPath(); c.ellipse(t.feet.x, t.feet.y, t.size * 0.7, t.size * 0.25, 0, 0, Math.PI * 2); c.fill(); });
      k.add(E.ring({ at: t.feet, from: t.size * 0.2, to: t.size * 1.5, width: 5, color: ELEC.glow, duration: 420, squash: 0.4 }));
      k.add(E.starburst({ at: t.center, rays: 12, length: t.size * 1.3, width: 4, palette: ELEC, duration: 300 }));
      rayitos(k, t.center, t.size * 0.9, 6, 260);
      E.sparks(k.fx, t.center, { count: 26, speed: [200, 500], palette: ELEC, shape: 'streak' });
    });
    await k.esperar(300);
    await k.despues();
  },

  // Chispa (65): el usuario se cubre de electricidad (arcos que le recorren el cuerpo y un halo amarillo) y embiste;
  // descarga al chocar.
  async spark(k) {
    const s = k.user.size, arcos = cadaTanto(45, () => nuevosArcos(4));
    k.dibujar(560, (c, t, engine) => {
      const p = k.posSprite(k.user), sale = t > 0.8 ? (1 - t) / 0.2 : 1, entra = Math.min(1, t * 6);
      orbe(c, engine, p, s * 0.4, ELEC, 0.35 * sale * entra);
      arcosAlrededor(c, p, s * 0.45, arcos(engine.now), 1.8, sale * entra);
      if (Math.random() < 0.4) { const a = rand(0, Math.PI * 2); k.emit({ x: p.x + Math.cos(a) * s * 0.45, y: p.y + Math.sin(a) * s * 0.45, vx: Math.cos(a) * 140, vy: Math.sin(a) * 140, drag: 3, life: 200, size: 1.8, color: ELEC.hot, shape: 'streak', stretch: 24 }); }
    }, { z: 1 });
    await k.esperar(160);
    await k.embestida({ hasta: 0.8, ida: 150, vuelta: 250, estela: ELEC.glow });
    await k.impacto(t => {
      rayitos(k, t.center, t.size * 0.6, 4, 220);
      E.sparks(k.fx, t.center, { count: 16, speed: [160, 360], palette: ELEC, shape: 'streak' });
    });
    await k.esperar(150);
    await k.despues();
  },

  // Moflete Estático (20): el usuario se arrima y frota las mejillas contra el objetivo: dos mofletes rojos
  // chisporrotean y saltan chispitas amarillas (paraliza).
  async nuzzle(k) {
    await k.anticipar(60);
    const s = k.user.size, lejos = Math.max(0, k.dist - k.target.size * 0.5) * 0.8, v = k.haciaV(lejos), w = k.perp;
    const tr = (x: number, y: number, rot = 0) => `translate(${x}px, ${y}px) rotate(${rot}deg)`;
    void k.animar(k.user.sprite, [
      { transform: tr(0, 0) },
      { transform: tr(v.x, v.y), offset: 0.25 },
      { transform: tr(v.x + w.x * 3, v.y + w.y * 3 - 2, 7), offset: 0.35 },
      { transform: tr(v.x - w.x * 3, v.y - w.y * 3, -7), offset: 0.45 },
      { transform: tr(v.x + w.x * 3, v.y + w.y * 3 - 2, 7), offset: 0.55 },
      { transform: tr(v.x, v.y), offset: 0.62 },
      { transform: tr(0, 0) },
    ], 560, 'ease-in-out');
    k.dibujar(420, (c, t, engine) => {
      const p = k.posSprite(k.user), a = t < 0.25 ? t / 0.25 : t > 0.85 ? (1 - t) / 0.15 : 1;
      for (const lado of [-1, 1]) {
        const q = { x: p.x + w.x * lado * s * 0.24 + k.dir.x * s * 0.18, y: p.y + w.y * lado * s * 0.24 + k.dir.y * s * 0.18 + s * 0.05 };
        orbe(c, engine, q, s * 0.1, ELEC, 0.5 * a);
        c.globalAlpha = a; c.fillStyle = '#ff4a3a'; c.strokeStyle = '#7a1a10'; c.lineWidth = 1.2;
        c.beginPath(); c.arc(q.x, q.y, s * 0.075, 0, Math.PI * 2); c.fill(); c.stroke();
        if (Math.random() < 0.35) k.emit({ x: q.x, y: q.y, vx: rand(-90, 90), vy: rand(-110, 30), drag: 3, life: 200, size: 1.6, color: pick([ELEC.glow, ELEC.hot]), shape: 'streak', stretch: 22 });
      }
    }, { z: 1 });
    await k.esperar(200);
    await k.impacto(t => {
      E.sparks(k.fx, t.center, { count: 10, speed: [80, 200], palette: ELEC, shape: 'streak', size: [1.2, 2] });
      k.add(E.bolt({ from: { x: t.center.x - t.size * 0.3, y: t.center.y }, to: { x: t.center.x + t.size * 0.3, y: t.center.y - t.size * 0.1 }, palette: ELEC, duration: 160, width: 1.6, branches: 0 }));
    });
    await k.esperar(220);
    await k.despues();
  },

  // Chispazo (80): el usuario se carga hasta chisporrotear y suelta descargas en todas direcciones: rayos en estrella,
  // un anillo eléctrico dentado que se abre y alcanza a todos los que están cerca.
  async discharge(k) {
    const u0 = k.user.center, s = k.user.size, arcos = cadaTanto(45, () => nuevosArcos(3));
    k.dibujar(260, (c, t, engine) => arcosAlrededor(c, k.posSprite(k.user), s * 0.45, arcos(engine.now), 1.6, Math.min(1, t * 4)), { z: 1 });
    void k.agitar(k.user.sprite, 2, 240);
    await k.esperar(240);
    k.add(E.flash({ color: ELEC.glow, alpha: 0.25, duration: 200 }));
    const alcance = Math.max(k.dist, s * 2.2);
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2 + rand(-0.2, 0.2), L = alcance * rand(0.5, 1);
      k.add(E.bolt({ from: u0, to: { x: u0.x + Math.cos(a) * L, y: u0.y + Math.sin(a) * L * 0.75 }, palette: ELEC, duration: 260, width: 2.5, branches: 1, delay: rand(0, 60) }));
    }
    for (const o of k.ctx.targets) k.add(E.bolt({ from: u0, to: o.center, palette: ELEC, duration: 320, width: 4, branches: 2 }));
    k.dibujar(380, (c, t, engine) => anilloRayo(c, u0.x, u0.y, s * 0.3 + (alcance * 1.1 - s * 0.3) * easeOutCubic(t), 0.75, 28, s * 0.12, 2.2, 1 - easeIn(t), Math.floor(engine.now / 45)), { z: 1 });
    await k.esperar(80);
    await k.impacto(t => {
      rayitos(k, t.center, t.size * 0.6, 4, 220);
      E.sparks(k.fx, t.center, { count: 14, speed: [160, 360], palette: ELEC, shape: 'streak' });
    });
    await k.esperar(220);
    await k.despues();
  },

  // Bola Voltio (var.): una bola eléctrica amarilla con un remolino blanco dentro y arcos que chisporrotean a su
  // alrededor sale lanzada y estalla en una descarga.
  async electroball(k) {
    await k.cargar(130);
    void k.recuperar({ x: -k.dir.x * 8, y: -k.dir.y * 8 }, 200);
    const r = k.s(0.2), arcos = cadaTanto(50, () => nuevosArcos(3));
    await k.proyectil(260, (p, _t, c, engine) => {
      orbe(c, engine, p, r, ELEC);
      const giro = engine.now / 60;
      c.globalAlpha = 0.9; c.strokeStyle = '#ffffff'; c.lineWidth = Math.max(1.2, r * 0.12); c.lineCap = 'round';
      for (let i = 0; i < 2; i++) { c.beginPath(); c.arc(p.x, p.y, r * 0.5, giro + i * Math.PI, giro + i * Math.PI + 2); c.stroke(); }
      arcosAlrededor(c, p, r * 1.1, arcos(engine.now), 1.4, 1);
      if (Math.random() < 0.5) k.emit({ x: p.x, y: p.y, vx: -k.dir.x * 80 + rand(-60, 60), vy: -k.dir.y * 80 + rand(-60, 60), drag: 3, life: 220, size: 1.8, color: ELEC.hot, shape: 'streak', stretch: 24 });
    }, { arco: k.s(0.3) });
    await k.impacto(t => {
      k.add(E.bloom({ at: t.center, radius: t.size * 0.9, color: ELEC.glow, duration: 300 }));
      rayitos(k, t.center, t.size * 0.8, 5, 240);
      k.add(E.ring({ at: t.center, from: 6, to: t.size, width: 4, color: ELEC.glow, duration: 300 }));
      E.sparks(k.fx, t.center, { count: 18, speed: [160, 400], palette: ELEC, shape: 'streak' });
    });
    await k.despues();
  },

  // Electrocañón (120): gran carga; delante del usuario crece una esfera eléctrica enorme recorrida por arcos, sale
  // lenta y pesada hacia el objetivo y revienta en una descarga cegadora con rayos en todas direcciones.
  async zapcannon(k) {
    await k.cargaEpica();
    const R = k.s(0.42), crecer = 260, viaje = 340, ini = k.punto(0.2), arcos = cadaTanto(45, () => nuevosArcos(6));
    const esfera = (c: CanvasRenderingContext2D, engine: FxEngine, p: Vec, r: number) => {
      if (r < 1) return;
      orbe(c, engine, p, r, ELEC);
      orbe(c, engine, p, r * 0.5, NEUTRAL_FX.white);
      arcosAlrededor(c, p, r * 0.95, arcos(engine.now), Math.max(1.4, r * 0.06), 1);
    };
    k.dibujar(crecer, (c, t, engine) => esfera(c, engine, ini, R * easeOutCubic(t)), { z: 1 });
    k.burst(18, i => { const a = rand(0, Math.PI * 2), rr = R * rand(2, 3); return { x: ini.x + Math.cos(a) * rr, y: ini.y + Math.sin(a) * rr, vx: -Math.cos(a) * rr * 4, vy: -Math.sin(a) * rr * 4, life: 230, delay: i * 12, size: rand(1.6, 2.6), color: pick([ELEC.glow, ELEC.hot]), shape: 'streak', stretch: 36 }; });
    await k.esperar(crecer);
    void k.recuperar({ x: -k.dir.x * 14, y: -k.dir.y * 14 }, 300);
    k.dibujar(viaje, (c, t, engine) => {
      const p = k.punto(lerp(0.2, 1, easeIn(t)));
      esfera(c, engine, p, R * (1 + 0.08 * Math.sin(engine.now / 25)));
      if (Math.random() < 0.7) k.emit({ x: p.x + rand(-R, R) * 0.6, y: p.y + rand(-R, R) * 0.6, vx: -k.dir.x * 100 + rand(-80, 80), vy: -k.dir.y * 100 + rand(-80, 80), drag: 3, life: 260, size: 2, color: ELEC.hot, shape: 'streak', stretch: 26 });
    }, { z: 1 });
    await k.esperar(viaje);
    await k.impacto(t => {
      k.add(E.flash({ color: '#ffffff', alpha: 0.5, duration: 280 }));
      k.add(E.bloom({ at: t.center, radius: t.size * 1.6, color: ELEC.glow, duration: 360 }));
      for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2 + rand(-0.2, 0.2), L = t.size * rand(0.9, 1.4); k.add(E.bolt({ from: t.center, to: { x: t.center.x + Math.cos(a) * L, y: t.center.y + Math.sin(a) * L }, palette: ELEC, duration: 300, width: 3, branches: 1, delay: i * 15 })); }
      k.add(E.ring({ at: t.center, from: 8, to: t.size * 1.5, width: 6, color: ELEC.glow, duration: 380 }));
      k.add(E.ring({ at: t.center, from: 4, to: t.size * 1.0, width: 3, color: '#ffffff', duration: 300, delay: 60 }));
      E.sparks(k.fx, t.center, { count: 30, speed: [200, 520], palette: ELEC, shape: 'streak' });
    });
    await k.esperar(300);
    await k.despues();
  },

  // Onda Trueno (estado): anillos eléctricos dentados salen del usuario uno tras otro, viajan hasta el objetivo y se
  // cierran a su alrededor apretándolo; queda chisporroteando (parálisis).
  async thunderwave(k) {
    await k.anticipar(60);
    void k.recuperar({ x: -k.dir.x * 5, y: -k.dir.y * 5 }, 180);
    const viaje = 300, cierra = 220, n = 3, R = k.s(0.6);
    for (let i = 0; i < n; i++) {
      k.dibujar(viaje + cierra, (c, t, engine) => {
        const ms = t * (viaje + cierra), u = Math.min(1, ms / viaje), p = k.punto(0.1 + 0.9 * u);
        const r = ms < viaje ? lerp(k.s(0.25), R, u) : R * (1 - 0.55 * easeIn((ms - viaje) / cierra));
        const alpha = ms < viaje ? Math.min(1, u * 4) : 1 - ((ms - viaje) / cierra) * 0.6;
        anilloRayo(c, p.x, p.y, r, 0.6, 18, r * 0.12, 2, alpha, Math.floor(engine.now / 50) + i * 13);
      }, { delay: i * 90, z: 1 });
    }
    await k.esperar(viaje + (n - 1) * 90 + 120);
    rayitos(k, k.target.center, k.target.size * 0.5, 3, 200);
    await k.estado();
  },

  // Campo Eléctrico (estado): el usuario pisa fuerte y el suelo se electrifica: grietas de luz amarilla corren por
  // el suelo en todas direcciones, el terreno brilla y saltan chispas aquí y allá.
  async electricterrain(k) {
    const u0 = k.user.feet, dura = 900;
    void k.saltar(k.user.sprite, k.user.size * 0.15, 240);
    await k.esperar(200);
    const L = Math.max(k.stage.width, k.stage.height) * 0.6;
    const lineas = Array.from({ length: 10 }, (_, i) => {
      let a = (i / 10) * Math.PI * 2 + rand(-0.15, 0.15), x = u0.x, y = u0.y;
      const pts: Vec[] = [{ x, y }];
      for (let j = 0; j < 7; j++) { a += rand(-0.3, 0.3); x += Math.cos(a) * L / 7; y += Math.sin(a) * L / 7 * 0.55; pts.push({ x, y }); }
      return pts;
    });
    k.dibujar(dura, (c, t, engine) => {
      const crece = easeOutCubic(Math.min(1, t * 2.5)), sale = t > 0.7 ? 1 - (t - 0.7) / 0.3 : 1, R = L * crece;
      if (R < 2) return;
      c.save(); c.translate(u0.x, u0.y); c.scale(1, 0.55);
      const g = c.createRadialGradient(0, 0, 0, 0, 0, R);
      g.addColorStop(0, withAlpha(ELEC.glow, 0.35)); g.addColorStop(1, withAlpha(ELEC.core, 0));
      c.globalAlpha = sale; c.fillStyle = g; c.beginPath(); c.arc(0, 0, R, 0, Math.PI * 2); c.fill();
      c.restore();
      const parpadeo = Math.floor(engine.now / 50) % 3 === 1 ? 0.6 : 1;
      for (const pts of lineas) {
        const n = Math.max(2, Math.ceil(pts.length * crece));
        trazoRayo(c, pts.slice(0, n), 1.6, sale * parpadeo);
      }
      if (sale > 0.2 && Math.random() < 0.6) { const pts = pick(lineas), q = pick(pts); k.emit({ x: q.x, y: q.y, vx: rand(-40, 40), vy: -rand(80, 180), drag: 2, life: 260, size: 1.8, color: pick([ELEC.glow, ELEC.hot]), shape: 'streak', stretch: 24 }); }
    });
    k.add(E.ring({ at: u0, from: 10, to: L, width: 4, color: ELEC.glow, duration: 500, squash: 0.55 }));
    await k.esperar(350);
    await k.estado();
  },

  // Aura Magnética (estado): líneas de campo magnético (lazos de polo a polo, de rojo a azul) se dibujan alrededor del
  // usuario y de sus aliados y fluyen, con los polos brillando.
  async magneticflux(k) {
    const quienes = [k.user, ...k.ctx.targets.filter(t => t.slot !== k.user.slot)], dura = 820;
    for (const q of quienes) {
      k.dibujar(dura, (c, t, engine) => {
        const p = q.center, s = q.size, crece = easeOutCubic(Math.min(1, t * 2.5)), sale = t > 0.75 ? 1 - (t - 0.75) / 0.25 : 1;
        const g = c.createLinearGradient(p.x, p.y - s * 0.8, p.x, p.y + s * 0.8);
        g.addColorStop(0, '#ff5a6a'); g.addColorStop(0.5, '#ffffff'); g.addColorStop(1, '#4a8aff');
        c.strokeStyle = g; c.lineWidth = 2; c.setLineDash([6, 5]); c.lineDashOffset = -engine.now * 0.05;
        for (let i = 1; i <= 3; i++) {
          const Lc = s * 0.32 * i * crece;
          c.globalAlpha = sale * (1 - i * 0.18);
          for (const lado of [-1, 1]) {
            c.beginPath();
            for (let j = 0; j <= 24; j++) { const th = 0.12 + ((Math.PI - 0.24) * j) / 24, r = Lc * Math.sin(th) ** 2, x = p.x + lado * r * Math.sin(th) * 1.3, y = p.y - r * Math.cos(th) * 0.9; if (j) c.lineTo(x, y); else c.moveTo(x, y); }
            c.stroke();
          }
        }
        c.setLineDash([]);
        orbe(c, engine, { x: p.x, y: p.y - s * 0.3 }, s * 0.12, { core: '#ff5a6a', glow: '#ffb0b8', hot: '#ffffff', dark: '#5a1018' }, sale * crece);
        orbe(c, engine, { x: p.x, y: p.y + s * 0.3 }, s * 0.12, { core: '#4a8aff', glow: '#a8c8ff', hot: '#ffffff', dark: '#10285a' }, sale * crece);
      }, { z: 1 });
    }
    await k.esperar(500);
    await k.estado();
  },

  // Levitón (estado): dos imanes de herradura aparecen bajo el usuario y lo empujan hacia arriba: se eleva y queda
  // flotando sobre anillos magnéticos que laten hacia el suelo.
  async magnetrise(k) {
    const s = k.user.size, alto = s * 0.3, dura = 900, f = k.user.feet;
    void k.animar(k.user.sprite, [
      { transform: 'translate(0px, 0px)' },
      { transform: `translate(0px, ${-alto}px)`, offset: 0.3 },
      { transform: `translate(0px, ${-alto * 0.8}px)`, offset: 0.5 },
      { transform: `translate(0px, ${-alto}px)`, offset: 0.7 },
      { transform: 'translate(0px, 0px)' },
    ], dura, 'ease-in-out');
    k.dibujar(dura, (c, t, engine) => {
      const entra = Math.min(1, t * 4), sale = t > 0.8 ? 1 - (t - 0.8) / 0.2 : 1, p = k.posSprite(k.user), sube = Math.max(0, f.y - (p.y + s * 0.5));
      // Sombra que se queda en el suelo.
      c.globalAlpha = 0.25 * sale; c.fillStyle = '#1a1a24'; c.beginPath(); c.ellipse(f.x, f.y, s * 0.4 * (1 - sube / (s * 1.5)), s * 0.12, 0, 0, Math.PI * 2); c.fill();
      // Anillos que bajan del usuario al suelo.
      for (let i = 0; i < 3; i++) {
        const u = ((engine.now / 400 + i / 3) % 1), y = lerp(p.y + s * 0.35, f.y, u);
        c.globalAlpha = (1 - u) * 0.8 * entra * sale; c.strokeStyle = i % 2 ? '#a8c8ff' : ELEC.glow; c.lineWidth = 2;
        c.beginPath(); c.ellipse(f.x, y, s * (0.3 + 0.2 * u), s * (0.1 + 0.07 * u), 0, 0, Math.PI * 2); c.stroke();
      }
      for (const lado of [-1, 1]) iman(c, f.x + lado * s * 0.42, f.y - s * 0.05, s * 0.12, lado * 0.25, entra * sale);
      if (Math.random() < 0.3 * sale) k.emit({ x: f.x + rand(-s * 0.4, s * 0.4), y: f.y - rand(0, s * 0.2), vx: rand(-40, 40), vy: -rand(40, 100), drag: 2, life: 220, size: 1.6, color: pick([ELEC.glow, '#a8c8ff']), shape: 'streak', stretch: 22 });
    }, { z: 1 });
    await k.esperar(520);
    await k.estado();
  },
};
