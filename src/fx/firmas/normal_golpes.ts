// Firmas de movimientos (ver LEEME.md). Grupo: normal_golpes (ataques de tipo Normal).
// Cada golpe enseña su objeto: una mano, un puño, un pie, garras, un cuerno, un taladro, colmillos, tijeras, estrellas,
// notas, Z… y la intensidad va con la potencia (los flojos, cortos y pequeños; los fuertes, oscurecen y llenan la vista).
import { E, TYPE_FX, easeIn, easeInOut, easeOut, easeOutCubic, lerp, mix, pick, rand, type FxPalette, type Firma, type Kit, type SlotGeometry, type Vec } from './kit';
import { forma, mandibula, type EstiloForma, type NombreForma } from './formas';

// ---- Colores ----
const TINTA = '#3e2a18';
const BLANCO: FxPalette = { core: '#f4f0e6', glow: '#ffffff', hot: '#ffffff', dark: '#6e6658' };
const ORO: FxPalette = { core: '#ffc23a', glow: '#ffe58a', hot: '#fffbe6', dark: '#8a5208' };
const ROJO: FxPalette = { core: '#ff4232', glow: '#ff9878', hot: '#fff0e6', dark: '#6a0c06' };
const HIPER: FxPalette = { core: '#ff9a1a', glow: '#ffd36a', hot: '#fffbe0', dark: '#8a3a00' };
const ACERO: FxPalette = { core: '#bfe0ff', glow: '#ffffff', hot: '#ffffff', dark: '#3a5a7a' };

// Degradado en coordenadas unidad de una forma (de arriba-izquierda claro a abajo-derecha oscuro).
const degradado = (a: string, b: string, medio?: string) => (c: CanvasRenderingContext2D) => {
  const g = c.createLinearGradient(-0.6, -1, 0.6, 1);
  g.addColorStop(0, a); if (medio) g.addColorStop(0.55, medio); g.addColorStop(1, b);
  return g;
};
// Guante de dibujo animado: crema con borde marrón (manos, puños, pies).
const CREMA: EstiloForma = { base: degradado('#ffffff', '#dccaa6', '#f6eedf'), claro: '#ffffff', oscuro: '#c8b48e', borde: TINTA };
const MARFIL: EstiloForma = { base: degradado('#fffaf0', '#cdb98a', '#f2e6c8'), claro: '#ffffff', oscuro: '#a8946a', borde: TINTA };
const ESTRELLA: EstiloForma = { base: degradado('#fff7b0', '#ffb81a', '#ffe14a'), borde: '#7a4a08' };
const GARRA_FINA: EstiloForma = { base: '#ffffff', borde: '#4a4038', grosor: 1.3 };
const GARRA_FURIA: EstiloForma = { base: degradado('#ffffff', '#ffd8c8'), borde: '#8a2a10', grosor: 1.6 };
const GARRA_DURA: EstiloForma = { base: degradado('#ffffff', '#e8d8d0'), borde: '#5a1010', brillo: '#ff6050', brilloTam: 8 };

// ---- Geometría ----
const mas = (a: Vec, b: Vec, f = 1): Vec => ({ x: a.x + b.x * f, y: a.y + b.y * f });
const entre = (a: Vec, b: Vec, t: number): Vec => ({ x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t) });
const polar = (a: number, r = 1): Vec => ({ x: Math.cos(a) * r, y: Math.sin(a) * r });
const tf = (v: Vec, extra = ''): string => `translate(${v.x}px, ${v.y}px) ${extra}`;
const clamp01 = (x: number): number => Math.max(0, Math.min(1, x));
/** El borde del objetivo del lado del usuario (donde llega un golpe de contacto). */
const contacto = (k: Kit, t: SlotGeometry = k.target): Vec => mas(t.center, k.dir, -t.size * 0.35);
/** Cuánto se desplaza el usuario para llegar a una fracción del camino (como `embestida`). */
const hacia = (k: Kit, hasta: number): Vec => { const l = Math.max(0, k.dist - k.target.size * 0.45) * hasta; return { x: k.dir.x * l, y: k.dir.y * l }; };
/** Lo que se hace al objetivo después del empujón común del impacto (que se pinta justo antes). */
const luego = (f: () => void): void => { void Promise.resolve().then(f); };

// ---- Ayudas de dibujo ----
/** Pinta una forma durante `ms`; `f(t)` dice dónde, de qué tamaño, girada y con qué opacidad en cada fotograma. */
function animaForma(k: Kit, nombre: NombreForma, ms: number, f: (t: number) => { p: Vec; tam: number; ang: number; alpha?: number; espejo?: boolean }, e: EstiloForma, o: { delay?: number; z?: number } = {}): void {
  k.dibujar(ms, (c, t) => {
    const q = f(t);
    if (q.tam <= 0.5) return;
    c.globalAlpha = clamp01(q.alpha ?? 1);
    forma(c, nombre, q.p.x, q.p.y, q.tam, q.ang, e, q.espejo);
  }, { z: o.z ?? 1, delay: o.delay });
}

/** Estrella de golpe de cómic ("¡pom!"): picos amarillos con el centro blanco y borde marrón. */
function pow(k: Kit, at: Vec, tam: number, o: { ms?: number; puntas?: number; color?: string; centro?: string; borde?: string; delay?: number } = {}): void {
  const n = o.puntas ?? 9, ms = o.ms ?? 260, a0 = rand(0, Math.PI * 2);
  const radios = Array.from({ length: n * 2 }, (_, i) => (i % 2 ? rand(0.42, 0.55) : rand(0.85, 1.1)));
  const trazo = (c: CanvasRenderingContext2D, r: number) => {
    c.beginPath();
    radios.forEach((f, i) => { const p = polar(a0 + (i * Math.PI) / n, f * r); if (i) c.lineTo(at.x + p.x, at.y + p.y); else c.moveTo(at.x + p.x, at.y + p.y); });
    c.closePath();
  };
  k.dibujar(ms, (c, t) => {
    const r = tam * (t < 0.2 ? easeOut(t / 0.2) * 1.12 : 1.12 - 0.12 * ((t - 0.2) / 0.8));
    c.globalAlpha = t > 0.55 ? 1 - (t - 0.55) / 0.45 : 1;
    c.lineJoin = 'round';
    trazo(c, r); c.fillStyle = o.color ?? '#ffd84a'; c.fill();
    c.lineWidth = Math.max(1.5, tam * 0.07); c.strokeStyle = o.borde ?? TINTA; c.stroke();
    trazo(c, r * 0.55); c.fillStyle = o.centro ?? '#ffffff'; c.fill();
  }, { z: 1, delay: o.delay });
}

/** Arcos de choque que salen del punto de contacto hacia delante (ángulo `ang`), con un filo oscuro para que se lean. */
function arcoChoque(k: Kit, at: Vec, ang: number, o: { r0?: number; r1: number; ms?: number; color?: string; ancho?: number; abre?: number; n?: number; delay?: number }): void {
  const n = o.n ?? 3, abre = o.abre ?? 1.2;
  k.dibujar(o.ms ?? 260, (c, t) => {
    c.lineCap = 'round';
    for (let i = 0; i < n; i++) {
      const u = clamp01(t * 1.35 - i * 0.16);
      if (u <= 0 || u >= 1) continue;
      const r = lerp(o.r0 ?? 4, o.r1 * (1 - i * 0.12), easeOutCubic(u)), w = (o.ancho ?? 4) * (1 - u * 0.6);
      for (const [col, ww, al] of [['#2a1a10', w + 2, 0.3], [o.color ?? '#ffffff', w, 0.95]] as const) {
        c.globalAlpha = al * (1 - u); c.strokeStyle = col; c.lineWidth = ww;
        c.beginPath(); c.arc(at.x, at.y, r, ang - abre / 2, ang + abre / 2); c.stroke();
      }
    }
  }, { z: 1, delay: o.delay });
}

/** Onda en el suelo (achatada) alrededor de un punto. */
function onda(k: Kit, at: Vec, r: number, ancho: number, ms: number, o: { color?: string; delay?: number } = {}): void {
  k.add(E.ring({ at, from: r * 0.15, to: r, width: ancho, color: o.color ?? '#fff6dc', duration: ms, squash: 0.42, delay: o.delay }));
}

/** Polvo que se abre a ras de suelo. */
function polvo(k: Kit, at: Vec, n: number, r: number, o: { color?: string; vel?: number } = {}): void {
  k.burst(n, i => {
    const a = (i / n) * Math.PI * 2 + rand(-0.3, 0.3), v = (o.vel ?? 90) * rand(0.6, 1.2);
    return { x: at.x + Math.cos(a) * r * 0.3, y: at.y + Math.sin(a) * r * 0.12, vx: Math.cos(a) * v, vy: Math.sin(a) * v * 0.4 - rand(5, 25), drag: 2.5, life: rand(450, 750), size: r * 0.2, sizeEnd: r * 0.45, color: o.color ?? '#d9cbb0', alpha: 0.45, shape: 'smoke' };
  });
}

/** Líneas de velocidad a lo largo del camino (corren hacia el objetivo). */
function lineasVelocidad(k: Kit, n: number, o: { color?: string; delay?: number; ancho?: number } = {}): void {
  k.burst(n, () => {
    const p = k.punto(rand(0, 0.7), rand(-1, 1) * (o.ancho ?? k.user.size * 0.5)), v = rand(500, 800);
    return { x: p.x, y: p.y, vx: k.dir.x * v, vy: k.dir.y * v, drag: 4, life: rand(140, 230), delay: (o.delay ?? 0) + rand(0, 90), size: rand(1.2, 2), color: o.color ?? '#ffffff', shape: 'streak', stretch: 40 };
  });
}

/** Estrellitas que dan vueltas sobre la cabeza (mareo). */
function mareo(k: Kit, g: SlotGeometry, ms = 700): void {
  k.dibujar(ms, (c, t) => {
    const s = g.sprite, cx = g.top.x + (s?.dx ?? 0), cy = g.top.y + (s?.dy ?? 0) - g.size * 0.05;
    c.globalAlpha = Math.min(1, t * 6) * (t > 0.75 ? (1 - t) / 0.25 : 1);
    for (let i = 0; i < 3; i++) {
      const a = t * 9 + i * 2.094, p = { x: cx + Math.cos(a) * g.size * 0.38, y: cy + Math.sin(a) * g.size * 0.12 };
      forma(c, 'estrella', p.x, p.y, g.size * (0.11 + 0.03 * Math.sin(a)), t * 6, ESTRELLA);
    }
  }, { z: 1 });
}

/** Gotas de sudor que saltan de la cabeza. */
function sudor(k: Kit, g: SlotGeometry, n: number, retraso = 0): void {
  k.burst(n, () => {
    const lado = Math.random() < 0.5 ? -1 : 1;
    return { x: g.top.x + lado * g.size * rand(0.1, 0.3), y: g.top.y + g.size * rand(0.05, 0.2), vx: lado * rand(50, 110), vy: -rand(60, 130), ay: 500, life: rand(380, 520), delay: rand(0, retraso), size: rand(2.5, 3.5), color: '#8fd2ff', shape: 'drop', stretch: 18 };
  });
}

/** La vena de enfado de los dibujos (cuatro arcos rojos). */
function venaIra(c: CanvasRenderingContext2D, x: number, y: number, tam: number): void {
  c.save(); c.translate(x, y); c.scale(tam, tam); c.lineCap = 'round';
  for (const [w, col] of [[0.42, '#4a0806'], [0.24, '#ff3b2a']] as const) {
    c.lineWidth = w; c.strokeStyle = col;
    for (let i = 0; i < 4; i++) {
      c.save(); c.rotate(i * Math.PI / 2);
      c.beginPath(); c.moveTo(0.22, -0.85); c.quadraticCurveTo(0.22, -0.22, 0.85, -0.22); c.stroke();
      c.restore();
    }
  }
  c.restore();
}

/** Signo de exclamación (vertical, girado `ang`). */
function exclamacion(c: CanvasRenderingContext2D, x: number, y: number, tam: number, ang: number, color: string): void {
  c.save(); c.translate(x, y); c.rotate(ang); c.scale(tam, tam); c.lineJoin = 'round';
  c.beginPath(); c.moveTo(-0.24, -1); c.lineTo(0.24, -1); c.lineTo(0.1, 0.35); c.lineTo(-0.1, 0.35); c.closePath();
  c.moveTo(0.18, 0.72); c.arc(0, 0.72, 0.18, 0, Math.PI * 2);
  c.fillStyle = color; c.fill(); c.lineWidth = 0.1; c.strokeStyle = TINTA; c.stroke();
  c.restore();
}

/** Rectángulo de esquinas redondas (trazado, sin rellenar). */
function rrect(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  const rr = Math.min(r, w / 2, h / 2);
  c.moveTo(x + rr, y);
  c.arcTo(x + w, y, x + w, y + h, rr); c.arcTo(x + w, y + h, x, y + h, rr);
  c.arcTo(x, y + h, x, y, rr); c.arcTo(x, y, x + w, y, rr); c.closePath();
}

/** Un regalito (el objeto que roba Antojo): caja rosa con lazo amarillo. */
function regalo(c: CanvasRenderingContext2D, x: number, y: number, tam: number, rot: number): void {
  c.save(); c.translate(x, y); c.rotate(rot); c.scale(tam, tam); c.lineJoin = 'round';
  c.lineWidth = 0.1; c.strokeStyle = TINTA;
  c.beginPath(); c.ellipse(-0.32, -0.78, 0.3, 0.18, -0.5, 0, Math.PI * 2); c.ellipse(0.32, -0.78, 0.3, 0.18, 0.5, 0, Math.PI * 2); c.fillStyle = '#ffd84a'; c.fill(); c.stroke();
  c.beginPath(); rrect(c, -0.8, -0.3, 1.6, 1.2, 0.12); c.fillStyle = '#ff6aa8'; c.fill(); c.stroke();
  c.beginPath(); rrect(c, -0.92, -0.62, 1.84, 0.38, 0.1); c.fillStyle = '#ff8ac0'; c.fill(); c.stroke();
  c.beginPath(); c.rect(-0.16, -0.62, 0.32, 1.52); c.fillStyle = '#ffd84a'; c.fill(); c.stroke();
  c.restore();
}

/** Una roca grande con luces y grietas (Fuerza). `perfil`: radios del contorno. */
function roca(c: CanvasRenderingContext2D, x: number, y: number, r: number, rot: number, perfil: number[]): void {
  c.save(); c.translate(x, y); c.rotate(rot); c.scale(r, r); c.lineJoin = 'round';
  c.beginPath();
  perfil.forEach((f, i) => { const a = (i / perfil.length) * Math.PI * 2; if (i) c.lineTo(Math.cos(a) * f, Math.sin(a) * f); else c.moveTo(Math.cos(a) * f, Math.sin(a) * f); });
  c.closePath();
  const g = c.createLinearGradient(-0.5, -0.8, 0.5, 0.9);
  g.addColorStop(0, '#e2d8c4'); g.addColorStop(0.5, '#a89a86'); g.addColorStop(1, '#6a5e4e');
  c.fillStyle = g; c.fill(); c.lineWidth = 0.08; c.strokeStyle = TINTA; c.stroke();
  c.beginPath(); c.moveTo(-0.35, -0.2); c.lineTo(-0.02, 0.05); c.lineTo(0.12, 0.42); c.moveTo(0.22, -0.52); c.lineTo(0.36, -0.2);
  c.lineWidth = 0.05; c.strokeStyle = 'rgba(50,34,24,0.7)'; c.stroke();
  c.beginPath(); c.ellipse(-0.3, -0.42, 0.26, 0.12, -0.4, 0, Math.PI * 2); c.fillStyle = 'rgba(255,255,255,0.35)'; c.fill();
  c.restore();
}

/** Taladro de cono con la espiral corriendo hacia la punta (`fase` avanza = gira). */
function taladro(c: CanvasRenderingContext2D, x: number, y: number, tam: number, ang: number, fase: number): void {
  c.save(); c.translate(x, y); c.rotate(ang); c.scale(tam, tam); c.lineJoin = 'round';
  const cono = () => { c.beginPath(); c.moveTo(-0.8, -0.5); c.lineTo(1.05, 0); c.lineTo(-0.8, 0.5); c.closePath(); };
  const g = c.createLinearGradient(0, -0.5, 0, 0.5);
  g.addColorStop(0, '#fffaf0'); g.addColorStop(0.45, '#e2d4b4'); g.addColorStop(1, '#8a7a5a');
  cono(); c.fillStyle = g; c.fill();
  c.save(); cono(); c.clip();
  c.strokeStyle = 'rgba(62,42,24,0.65)'; c.lineWidth = 0.08;
  for (let i = 0; i < 6; i++) {
    const x0 = -0.95 + 2.0 * ((i + (fase % 1)) / 6);
    c.beginPath(); c.moveTo(x0 - 0.2, -0.55); c.quadraticCurveTo(x0 + 0.04, 0, x0 + 0.2, 0.55); c.stroke();
  }
  c.fillStyle = 'rgba(255,255,255,0.4)'; c.beginPath(); c.moveTo(-0.8, -0.42); c.lineTo(0.9, -0.03); c.lineTo(-0.8, -0.22); c.closePath(); c.fill();
  c.restore();
  cono(); c.lineWidth = 0.06; c.strokeStyle = TINTA; c.stroke();
  c.beginPath(); c.rect(-1.0, -0.4, 0.2, 0.8); c.fillStyle = '#7a6a4e'; c.fill(); c.stroke();
  c.restore();
}

/** Una hoja de las tijeras de Guillotina (del lado y < 0, filo dentado sobre y = 0, gozne en el origen). */
function cuchilla(c: CanvasRenderingContext2D, L: number): void {
  c.lineJoin = 'round';
  c.beginPath();
  c.moveTo(0, -0.06 * L);
  c.quadraticCurveTo(0.45 * L, -0.4 * L, L, -0.02 * L);
  for (let x = 0.95, i = 0; x > 0.1; x -= 0.085, i++) c.lineTo(x * L, i % 2 ? 0 : -0.055 * L);
  c.lineTo(0.08 * L, 0.01 * L);
  c.closePath();
  const g = c.createLinearGradient(0, -0.3 * L, 0, 0);
  g.addColorStop(0, '#f6fafc'); g.addColorStop(0.6, '#c8d2da'); g.addColorStop(1, '#8a98a4');
  c.fillStyle = g; c.fill(); c.lineWidth = 2; c.strokeStyle = '#1e2428'; c.stroke();
  c.beginPath(); c.moveTo(0.1 * L, -0.1 * L); c.quadraticCurveTo(0.45 * L, -0.28 * L, 0.85 * L, -0.06 * L);
  c.lineWidth = 1.5; c.strokeStyle = 'rgba(255,255,255,0.8)'; c.stroke();
  // Ojo del mango, detrás del gozne.
  c.beginPath(); c.ellipse(-0.2 * L, -0.15 * L, 0.12 * L, 0.08 * L, -0.4, 0, Math.PI * 2);
  c.lineWidth = 0.05 * L; c.strokeStyle = '#1e2428'; c.stroke();
  c.lineWidth = 0.03 * L; c.strokeStyle = '#c8d2da'; c.stroke();
}

/** Dos incisivos enormes arriba y dos abajo (Hipercolmillo): `ap` 1 = abiertos, 0 = cerrados. */
function incisivos(c: CanvasRenderingContext2D, x: number, y: number, tam: number, ap: number): void {
  c.save(); c.translate(x, y); c.scale(tam, tam); c.lineJoin = 'round';
  for (const lado of [-1, 1]) {
    c.save(); c.scale(1, lado);
    const g0 = 0.03 + ap * 0.6, largo = lado < 0 ? 0.62 : 0.5;
    c.beginPath(); rrect(c, -0.72, -g0 - largo - 0.3, 1.44, 0.38, 0.18);
    c.fillStyle = '#e8708e'; c.fill(); c.lineWidth = 0.07; c.strokeStyle = TINTA; c.stroke();
    for (const x0 of [-0.44, 0.03]) {
      c.beginPath(); rrect(c, x0, -g0 - largo, 0.41, largo, 0.12);
      const g = c.createLinearGradient(x0, 0, x0 + 0.41, 0);
      g.addColorStop(0, '#ffffff'); g.addColorStop(0.7, '#f4ecd8'); g.addColorStop(1, '#d8c8a4');
      c.fillStyle = g; c.fill(); c.lineWidth = 0.06; c.strokeStyle = TINTA; c.stroke();
      c.beginPath(); c.moveTo(x0 + 0.1, -g0 - largo + 0.1); c.lineTo(x0 + 0.1, -g0 - 0.12);
      c.lineWidth = 0.05; c.strokeStyle = 'rgba(255,255,255,0.9)'; c.stroke();
    }
    c.restore();
  }
  c.restore();
}

/** Las tres garras que se dibujan de un tirón (de una punta a la otra) y se desvanecen. */
function garrazo(k: Kit, at: Vec, tam: number, ang: number, ms: number, e: EstiloForma, o: { delay?: number; espejo?: boolean } = {}): void {
  const diag = o.espejo ? -Math.PI / 4 : Math.PI / 4;
  k.dibujar(ms, (c, t) => {
    const rev = easeOut(Math.min(1, t / 0.3)), L = tam * 1.6, d = -L + 2 * L * rev;
    c.globalAlpha = t > 0.5 ? 1 - (t - 0.5) / 0.5 : 1;
    c.translate(at.x, at.y); c.rotate(ang + diag);
    c.beginPath(); c.rect(-L, -L, d + L, 2 * L); c.clip();
    c.rotate(-diag);
    forma(c, 'garras', 0, 0, tam, 0, e, o.espejo);
  }, { z: 1, delay: o.delay });
}

/** Coloca el cuerno para que su punta esté en `punta` y mire hacia `ang`. */
function cuernoHacia(c: CanvasRenderingContext2D, punta: Vec, tam: number, ang: number, e: EstiloForma): void {
  const centro = mas(punta, polar(ang), -1.4 * tam);
  forma(c, 'cuerno', centro.x, centro.y, tam, ang + 0.775, e);
}

/** Pequeños empujones del usuario hacia el objetivo (golpes seguidos). */
function jabs(k: Kit, n: number, ms: number, px: number): void {
  const f: Keyframe[] = [{ transform: 'translate(0px, 0px)' }];
  for (let i = 0; i < n; i++) f.push({ transform: tf(mas({ x: 0, y: 0 }, k.dir, px), 'scale(1.05, 0.95)') }, { transform: tf(mas({ x: 0, y: 0 }, k.dir, px * 0.25)) });
  f.push({ transform: 'translate(0px, 0px)' });
  void k.animar(k.user.sprite, f, ms);
}

/** La nube de pelea de los dibujos (Saña): bolas de polvo que hierven y de las que asoman puños, pies y estrellas. */
function nubePelea(k: Kit, centro: Vec, R: number, dura: number): void {
  const bolas = Array.from({ length: 9 }, (_, i) => ({ a: (i / 9) * Math.PI * 2 + rand(-0.2, 0.2), d: rand(0.3, 0.6), r: rand(0.36, 0.5), f: rand(0, 6) }));
  const asoma = Array.from({ length: 8 }, (_, i) => ({ t0: 0.08 + i * 0.095 + rand(-0.02, 0.02), a: rand(0, Math.PI * 2), que: pick(['estrella', 'puno', 'pie', 'puno', 'estrella'] as const) }));
  k.dibujar(dura, (c, t) => {
    const ms = t * dura, entra = easeOut(Math.min(1, t / 0.12)), fuera = t > 0.85 ? (1 - t) / 0.15 : 1;
    // Lo que asoma va antes que la nube, que le tapa la base.
    for (const s of asoma) {
      const u = (t - s.t0) / 0.14;
      if (u < 0 || u > 1) continue;
      const sal = Math.sin(Math.PI * u), p = { x: centro.x + Math.cos(s.a) * R * (0.45 + 0.6 * sal), y: centro.y + Math.sin(s.a) * R * 0.7 * (0.45 + 0.6 * sal) };
      c.globalAlpha = fuera;
      forma(c, s.que, p.x, p.y, R * 0.3, s.a + (s.que === 'pie' ? -Math.PI / 2 : 0), s.que === 'estrella' ? ESTRELLA : CREMA);
    }
    const pts = bolas.map(b => ({ x: centro.x + Math.cos(b.a + t * 3) * R * b.d, y: centro.y + Math.sin(b.a + t * 3) * R * b.d * 0.7, r: R * b.r * entra * (1 + 0.12 * Math.sin(ms / 45 + b.f)) }));
    c.globalAlpha = fuera;
    c.fillStyle = TINTA;
    for (const p of pts) { c.beginPath(); c.arc(p.x, p.y, p.r + 2, 0, Math.PI * 2); c.fill(); }
    c.fillStyle = '#ece3d2';
    for (const p of pts) { c.beginPath(); c.arc(p.x, p.y, p.r, 0, Math.PI * 2); c.fill(); }
    c.fillStyle = '#ffffff'; c.globalAlpha = fuera * 0.8;
    for (const p of pts) { c.beginPath(); c.arc(p.x - p.r * 0.2, p.y - p.r * 0.25, p.r * 0.5, 0, Math.PI * 2); c.fill(); }
    if (Math.random() < 0.25) { const p = mas(centro, polar(rand(0, Math.PI * 2), R * 0.8)); k.emit({ x: p.x, y: p.y, vx: rand(-60, 60), vy: rand(-60, 10), drag: 2, life: 500, size: R * 0.15, sizeEnd: R * 0.3, color: '#d9cbb0', alpha: 0.5, shape: 'smoke' }); }
  }, { z: 1 });
}

export const FIRMAS: Record<string, Firma> = {
  // ===== Golpes flojos (≤ 50): cortos y pequeños =====

  // Placaje (40): embestida corta y seca; al chocar, dos arcos de choque hacia delante y un poco de polvo.
  async tackle(k) {
    await k.anticipar(80);
    await k.embestida({ hasta: 0.8, ida: 120, vuelta: 220 });
    await k.impacto(t => {
      arcoChoque(k, contacto(k, t), k.angle, { r0: k.s(0.1), r1: k.s(0.55), n: 2, ancho: 3.5 });
      polvo(k, t.feet, 5, k.s(0.5));
    });
    await k.despues();
  },

  // Destructor (40): una mano abierta llega girando de canto y da un manotazo plano ("¡plaf!") que se aplasta un instante.
  async pound(k) {
    await k.anticipar(70);
    void k.embestida({ hasta: 0.3, ida: 110, vuelta: 200 });
    const ms = 170, tam = k.s(0.34), fin = contacto(k), ini = k.punto(0.4, -k.s(0.3));
    animaForma(k, 'mano', ms, t => ({ p: entre(ini, fin, easeIn(t)), tam, ang: k.angle - 0.7 * (1 - easeIn(t)), alpha: t * 4 }), CREMA);
    await k.esperar(ms);
    animaForma(k, 'mano', 170, t => ({ p: mas(fin, k.dir, k.s(0.05) * t), tam: tam * (1 + 0.18 * t), ang: k.angle, alpha: 1 - t }), CREMA);
    await k.impacto(t => {
      k.add(E.starburst({ at: contacto(k, t), rays: 6, length: k.s(0.45), width: 2, palette: BLANCO, duration: 200 }));
    });
    await k.despues();
  },

  // Arañazo (40): tres arañazos finos que se dibujan de un tirón sobre el objetivo y se desvanecen.
  async scratch(k) {
    await k.anticipar(60);
    void k.embestida({ hasta: 0.35, ida: 100, vuelta: 200 });
    await k.esperar(60);
    garrazo(k, k.target.center, k.s(0.38), k.angle + 0.3, 300, GARRA_FINA);
    await k.esperar(90);
    await k.impacto(t => {
      E.sparks(k.fx, t.center, { count: 6, speed: [80, 180], palette: BLANCO, shape: 'streak', size: [1, 2] });
    });
    await k.despues();
  },

  // Ataque Rápido (40): sale como un rayo: una estela blanca recta que se recoge desde la cola y tres copias de sí mismo.
  async quickattack(k) {
    k.dibujar(300, (c, t) => {
      const cabeza = Math.min(1, t / 0.3), cola = easeIn(Math.max(0, (t - 0.25) / 0.75));
      const a = k.punto(cola * 0.8), b = k.punto(cabeza * 0.8), w = k.user.size * 0.32 * (1 - cola);
      c.lineCap = 'round'; c.strokeStyle = '#ffffff';
      c.globalAlpha = 0.35; c.lineWidth = w; c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(b.x, b.y); c.stroke();
      c.globalAlpha = 0.95; c.lineWidth = w * 0.3; c.stroke();
    });
    lineasVelocidad(k, 6);
    await k.embestida({ hasta: 0.8, ida: 80, vuelta: 240, estela: '#ffffff' });
    await k.impacto(t => {
      arcoChoque(k, contacto(k, t), k.angle, { r1: k.s(0.4), n: 1, ancho: 3 });
      E.sparks(k.fx, contacto(k, t), { count: 6, speed: [120, 260], palette: BLANCO, shape: 'streak', spread: [k.angle - 0.8, k.angle + 0.8] });
    });
    await k.despues();
  },

  // Sorpresa (40): dos manos aparecen a los lados del objetivo y dan una palmada delante de su cara: destello y "!".
  async fakeout(k) {
    void k.saltar(k.user.sprite, k.s(0.12), 200);
    const c0 = k.target.center, sep0 = k.s(0.85), tam = k.s(0.32), entra = 110, choca = 100, total = entra + choca + 160;
    for (const lado of [1, -1]) {
      const ang = Math.atan2(-k.perp.y * lado, -k.perp.x * lado);
      animaForma(k, 'mano', total, t => {
        const ms = t * total, sep = ms < entra ? sep0 : lerp(sep0, k.s(0.2), easeIn(Math.min(1, (ms - entra) / choca)));
        return { p: mas(c0, k.perp, sep * lado), tam, ang, alpha: Math.min(1, ms / 80) * (ms > total - 120 ? (total - ms) / 120 : 1), espejo: lado < 0 };
      }, CREMA);
    }
    await k.esperar(entra + choca);
    k.add(E.flash({ color: '#ffffff', alpha: 0.4, duration: 160 }));
    await k.impacto(t => {
      k.add(E.starburst({ at: t.center, rays: 10, length: k.s(0.7), width: 2.5, palette: ORO, duration: 220 }));
      const p0 = { x: t.top.x + t.size * 0.3, y: t.top.y };
      k.dibujar(420, (c, u) => { c.globalAlpha = u > 0.7 ? (1 - u) / 0.3 : 1; exclamacion(c, p0.x, p0.y - k.s(0.15) * easeOut(Math.min(1, u * 4)), k.s(0.22) * (0.6 + 0.4 * easeOut(Math.min(1, u * 5))), 0.2, '#ffe14a'); }, { z: 1 });
    });
    await k.despues();
  },

  // Falso Tortazo (40): una mano barre de lado a lado delante del objetivo dejando una media luna blanca; golpe suave.
  async falseswipe(k) {
    await k.anticipar(70);
    void k.embestida({ hasta: 0.4, ida: 110, vuelta: 220 });
    const R = k.s(0.9), piv = mas(k.target.center, k.dir, -R), ms = 220, a0 = k.angle - 1.1, a1 = k.angle + 1.1;
    k.add(E.slash({ at: piv, radius: R, angle: k.angle, sweep: 2.2, width: k.s(0.09), palette: BLANCO, duration: ms + 140 }));
    animaForma(k, 'mano', ms + 120, t => {
      const ms2 = t * (ms + 120), a = lerp(a0, a1, easeInOut(Math.min(1, ms2 / ms)));
      return { p: mas(piv, polar(a, R)), tam: k.s(0.3), ang: a + Math.PI / 2, alpha: ms2 > ms ? 1 - (ms2 - ms) / 120 : 1 };
    }, CREMA);
    await k.esperar(ms * 0.5);
    await k.impacto(t => {
      k.burst(6, () => ({ x: t.center.x, y: t.center.y, vx: rand(-60, 60), vy: rand(-70, -10), drag: 2, life: 500, size: rand(2.5, 4), color: pick(['#ffffff', '#e6f2ff']), shape: 'star', spin: rand(-4, 4) }));
    });
    await k.esperar(ms * 0.5);
    await k.despues();
  },

  // Amago (30): un puño fantasma (contorno a trazos) amenaza por un lado y se esfuma; el de verdad entra por el otro
  // y rompe la defensa (esquirlas).
  async feint(k) {
    const tam = k.s(0.28), falso = 240, ini = k.punto(0.3, k.s(0.7)), alto = mas(k.target.center, k.perp, k.s(0.5));
    k.dibujar(falso, (c, t) => {
      const p = entre(ini, alto, easeOut(Math.min(1, t / 0.6)));
      c.globalAlpha = 0.75 * Math.min(1, t * 5) * (t > 0.7 ? (1 - t) / 0.3 : 1);
      c.setLineDash([0.2, 0.14]);
      forma(c, 'puno', p.x, p.y, tam, k.angle, { base: 'rgba(255,255,255,0.18)', claro: 'rgba(255,255,255,0.25)', oscuro: 'rgba(255,255,255,0.12)', borde: '#ffffff', grosor: 2 });
    }, { z: 1 });
    k.burst(4, () => ({ x: alto.x, y: alto.y, vx: rand(-40, 40), vy: rand(-40, 10), delay: falso * 0.7, drag: 2, life: 380, size: tam * 0.3, sizeEnd: tam * 0.6, color: '#f4f0e6', alpha: 0.5, shape: 'smoke' }));
    await k.esperar(falso * 0.75);
    const ms = 120, ini2 = k.punto(0.45, -k.s(0.65)), fin = mas(contacto(k), k.perp, -k.s(0.1));
    animaForma(k, 'puno', ms + 120, t => {
      const ms2 = t * (ms + 120), u = Math.min(1, ms2 / ms);
      return { p: entre(ini2, fin, easeIn(u)), tam, ang: k.angle - 0.4 * (1 - u), alpha: ms2 > ms ? 1 - (ms2 - ms) / 120 : 1, espejo: true };
    }, CREMA);
    await k.esperar(ms);
    await k.impacto(t => {
      k.burst(9, () => { const a = rand(0, Math.PI * 2), v = rand(90, 200); return { x: t.center.x, y: t.center.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, ay: 300, drag: 1.5, life: rand(350, 520), size: rand(3, 5), color: pick(['#c4fff0', '#7ef2d8', '#ffffff']), shape: 'shard', spin: rand(-10, 10) }; });
      pow(k, fin, k.s(0.22), { puntas: 7 });
    });
    await k.despues();
  },

  // Doble Golpe (35 ×2): dos puños, uno por cada lado, se estrellan uno detrás de otro con su estrellita de golpe.
  async doublehit(k) {
    await k.anticipar(60);
    const tam = k.s(0.26), ms = 140, hueco = 170;
    for (const [i, lado] of [[0, 1], [1, -1]] as const) {
      const ini = k.punto(0.3, lado * k.s(0.5)), fin = mas(contacto(k), k.perp, lado * k.s(0.14));
      animaForma(k, 'puno', ms + 110, t => {
        const ms2 = t * (ms + 110), u = Math.min(1, ms2 / ms), fade = ms2 > ms ? (ms2 - ms) / 110 : 0;
        return { p: entre(ini, fin, easeIn(u)), tam: tam * (1 + 0.2 * fade), ang: k.angle - lado * 0.35 * (1 - u), alpha: Math.min(1, ms2 / 40) * (1 - fade), espejo: lado < 0 };
      }, CREMA, { delay: i * hueco });
      pow(k, fin, k.s(i ? 0.34 : 0.28), { delay: ms + i * hueco, puntas: 8 });
    }
    jabs(k, 2, ms + hueco + 120, k.s(0.2));
    await k.esperar(ms);
    await k.impacto();
    await k.esperar(Math.max(0, hueco - 60));
    void k.agitar(k.target.sprite, 2, 160);
    await k.despues();
  },

  // Ataque Furia (15 ×2-5): un cuerno pica cuatro veces seguidas, cada vez en un punto distinto, con chispitas.
  async furyattack(k) {
    const n = 4, cada = 105, tam = k.s(0.26);
    const lados = Array.from({ length: n }, (_, i) => (i % 2 ? -1 : 1) * k.s(rand(0.05, 0.2)));
    k.dibujar(n * cada + 60, (c, t) => {
      const ms = t * (n * cada + 60), i = Math.min(n - 1, Math.floor(ms / cada)), u = (ms - i * cada) / cada;
      const dentro = u < 0.45 ? easeIn(u / 0.45) : 1 - easeOut(Math.min(1, (u - 0.45) / 0.55));
      const punta = mas(mas(contacto(k), k.perp, lados[i]), k.dir, -k.s(0.55) * (1 - dentro));
      c.globalAlpha = Math.min(1, ms / 50) * (ms > n * cada ? 1 - (ms - n * cada) / 60 : 1);
      cuernoHacia(c, punta, tam, k.angle, MARFIL);
    }, { z: 1 });
    jabs(k, n, n * cada, k.s(0.12));
    for (let i = 0; i < n; i++) {
      const p = mas(contacto(k), k.perp, lados[i]);
      k.burst(4, () => { const a = k.angle + Math.PI + rand(-1, 1), v = rand(70, 160); return { x: p.x, y: p.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, delay: i * cada + cada * 0.45, drag: 3, life: 260, size: rand(2.5, 3.5), color: pick(['#ffe14a', '#ffffff']), shape: 'star', spin: 6 }; });
    }
    await k.esperar(cada * 0.45);
    await k.impacto();
    await k.esperar(Math.max(0, (n - 1) * cada - 120));
    await k.despues();
  },

  // Golpes Furia (18 ×2-5): zarpazos rápidos que se cruzan en aspa, cada uno desde un lado, dejando surcos rojizos.
  async furyswipes(k) {
    await k.anticipar(60);
    const n = 4, cada = 105;
    for (let i = 0; i < n; i++) {
      garrazo(k, k.enCuerpo(k.target, 0.1), k.s(0.34), k.angle + (i % 2 ? -0.5 : 0.5), 240, GARRA_FURIA, { delay: i * cada, espejo: i % 2 === 1 });
      k.burst(3, () => ({ x: k.target.center.x + rand(-6, 6), y: k.target.center.y + rand(-6, 6), vx: rand(-120, 120), vy: rand(-120, 60), delay: i * cada + 50, drag: 3, life: 220, size: rand(1.2, 2), color: '#ffffff', shape: 'streak', stretch: 24 }));
    }
    jabs(k, n, n * cada + 60, k.s(0.15));
    await k.esperar(70);
    await k.impacto();
    await k.esperar(Math.max(0, (n - 1) * cada - 100));
    await k.despues();
  },

  // Atadura (15): una cuerda sale del usuario y dos anillos de cuerda se cierran sobre el objetivo y aprietan dos veces.
  async bind(k) {
    const lanza = 150, aprieta = 520, c0 = k.target.center;
    k.dibujar(lanza + 100, (c, t) => {
      const ms = t * (lanza + 100), cab = easeOut(Math.min(1, ms / lanza)), a = mas(k.posSprite(k.user), k.dir, k.user.size * 0.3);
      c.globalAlpha = ms > lanza ? 1 - (ms - lanza) / 100 : 1;
      c.lineCap = 'round';
      for (const [col, w] of [[TINTA, 4.5], ['#c8965a', 2.8]] as const) {
        c.strokeStyle = col; c.lineWidth = w; c.beginPath();
        for (let i = 0; i <= 16; i++) { const u = (i / 16) * cab, p = mas(entre(a, c0, u), k.perp, Math.sin(u * 14 - ms / 30) * k.s(0.06) * (1 - u)); if (i) c.lineTo(p.x, p.y); else c.moveTo(p.x, p.y); }
        c.stroke();
      }
    }, { z: 1 });
    await k.esperar(lanza);
    k.dibujar(aprieta, (c, t) => {
      const ms = t * aprieta, cierra = easeOut(Math.min(1, ms / 140));
      const pulso = ms > 140 ? Math.max(0, Math.sin(((ms - 140) / 190) * Math.PI)) : 0;
      const r = lerp(k.s(0.85), k.s(0.46), cierra) * (1 - 0.1 * pulso);
      c.globalAlpha = Math.min(1, ms / 60) * (t > 0.8 ? (1 - t) / 0.2 : 1);
      for (const h of [-0.2, 0.16]) {
        const y = c0.y + k.s(h);
        // Mitad de atrás, tenue; mitad de delante, gruesa y con el trenzado.
        c.lineCap = 'round';
        c.globalAlpha *= 0.4; c.strokeStyle = '#a07040'; c.lineWidth = 2;
        c.beginPath(); c.ellipse(c0.x, y, r, r * 0.3, 0, Math.PI, Math.PI * 2); c.stroke();
        c.globalAlpha /= 0.4;
        for (const [col, w] of [[TINTA, 6], ['#c8965a', 4]] as const) { c.strokeStyle = col; c.lineWidth = w; c.beginPath(); c.ellipse(c0.x, y, r, r * 0.3, 0, 0, Math.PI); c.stroke(); }
        c.strokeStyle = '#7a5428'; c.lineWidth = 1.2; c.beginPath();
        for (let a = 0.2; a < Math.PI; a += 0.28) { const p = { x: c0.x + Math.cos(a) * r, y: y + Math.sin(a) * r * 0.3 }; c.moveTo(p.x - 1.5, p.y - 2); c.lineTo(p.x + 1.5, p.y + 2); }
        c.stroke();
      }
    }, { z: 1 });
    await k.esperar(150);
    await k.impacto(t => {
      luego(() => void k.animar(t.sprite, [{ transform: 'scale(1, 1)' }, { transform: 'scale(0.84, 1.06)', offset: 0.25 }, { transform: 'scale(0.96, 1.02)', offset: 0.5 }, { transform: 'scale(0.84, 1.06)', offset: 0.75 }, { transform: 'scale(1, 1)' }], 420));
    });
    await k.esperar(200);
    await k.despues();
  },

  // Constricción (15): un cuerpo largo y anillado sale del usuario y se enrosca en espiral alrededor del objetivo, y aprieta.
  async wrap(k) {
    const viaje = 150, enrosca = 240, total = 760, c0 = k.target.center, vueltas = 2.3, N = 56;
    k.dibujar(total, (c, t) => {
      const ms = t * total, p = clamp01((ms - viaje) / enrosca), llega = easeOut(Math.min(1, ms / viaje));
      const aprieta = ms > viaje + enrosca ? Math.max(0, Math.sin(((ms - viaje - enrosca) / 180) * Math.PI)) : 0;
      const R = lerp(k.s(0.62), k.s(0.44), easeOut(p)) * (1 - 0.1 * aprieta), w = k.s(0.11);
      const punto = (s: number): Vec => { const a = s * vueltas * Math.PI * 2 + Math.PI; return { x: c0.x + Math.cos(a) * R, y: c0.y - k.s(0.42) + s * k.s(0.8) + Math.sin(a) * R * 0.3 }; };
      const delante = (s: number) => Math.sin(s * vueltas * Math.PI * 2 + Math.PI) > 0;
      c.globalAlpha = t > 0.85 ? (1 - t) / 0.15 : 1;
      c.lineCap = 'round';
      // El tramo que viene del usuario hasta el principio de la espiral.
      const a = mas(k.posSprite(k.user), k.dir, k.user.size * 0.3), b = entre(a, punto(0), llega);
      for (const [col, ww] of [[TINTA, w + 3], ['#e8c890', w]] as const) { c.strokeStyle = col; c.lineWidth = ww; c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(b.x, b.y); c.stroke(); }
      if (p <= 0) return;
      const n = Math.max(1, Math.round(N * p));
      for (const pasada of [0, 1]) {
        for (let i = 0; i < n; i++) {
          const s0 = (i / N), s1 = ((i + 1) / N), fr = delante((s0 + s1) / 2);
          if ((pasada === 0) === fr) continue;
          const q0 = punto(s0), q1 = punto(s1);
          if (!fr) { c.globalAlpha = 0.35; c.strokeStyle = '#b08850'; c.lineWidth = w * 0.6; c.beginPath(); c.moveTo(q0.x, q0.y); c.lineTo(q1.x, q1.y); c.stroke(); c.globalAlpha = 1; continue; }
          c.strokeStyle = TINTA; c.lineWidth = w + 3; c.beginPath(); c.moveTo(q0.x, q0.y); c.lineTo(q1.x, q1.y); c.stroke();
          c.strokeStyle = i % 4 < 2 ? '#e8c890' : '#c89a5a'; c.lineWidth = w; c.stroke();
        }
      }
    }, { z: 1 });
    await k.esperar(viaje + enrosca * 0.9);
    await k.impacto(t => {
      luego(() => void k.animar(t.sprite, [{ transform: 'scale(1, 1)' }, { transform: 'scale(0.86, 1.05)', offset: 0.3 }, { transform: 'scale(0.9, 1.04)', offset: 0.6 }, { transform: 'scale(1, 1)' }], 380));
    });
    await k.esperar(220);
    await k.despues();
  },

  // Eco Voz (40): ondas de sonido en arco salen de la boca hacia el objetivo, cada una con su eco lila detrás, y dos notas.
  async echoedvoice(k) {
    void k.animar(k.user.sprite, [{ transform: 'scale(1, 1)' }, { transform: 'scale(1.08, 0.94)', offset: 0.3 }, { transform: 'scale(1, 1)' }], 320);
    const ondas = 3, cada = 110, viaje = 320, total = ondas * cada + viaje + 80;
    k.dibujar(total, (c, t) => {
      const ms = t * total, o = k.user.center;
      c.lineCap = 'round';
      for (let i = 0; i < ondas; i++) for (const eco of [0, 1]) {
        const u = (ms - i * cada - eco * 70) / viaje;
        if (u < 0 || u > 1) continue;
        const r = lerp(k.user.size * 0.4, k.dist, easeOut(u)), abre = 0.9 - 0.3 * u, w = (eco ? 2 : 3.5) * (1 - u * 0.5);
        for (const [col, ww, al] of [['#3a2a50', w + 2, 0.3], [eco ? '#c8b0ff' : '#ffffff', w, eco ? 0.5 : 0.95]] as const) {
          c.globalAlpha = al * (1 - u); c.strokeStyle = col; c.lineWidth = ww;
          c.beginPath(); c.arc(o.x, o.y, r, k.angle - abre / 2, k.angle + abre / 2); c.stroke();
        }
      }
    });
    for (const [i, lado] of [[0, 1], [1, -1]] as const) {
      animaForma(k, 'nota', 420, t => ({ p: mas(k.punto(0.15 + 0.7 * t, lado * k.s(0.35)), { x: 0, y: -k.s(0.15) * Math.sin(t * 9) }), tam: k.s(0.15), ang: Math.sin(t * 8) * 0.3, alpha: Math.min(1, t * 5) * (1 - easeIn(t)) }), { base: '#c8b0ff', claro: '#ffffff', borde: '#3a2a50' }, { delay: 60 + i * 120 });
    }
    await k.esperar(cada + viaje * 0.8);
    await k.impacto(t => {
      k.add(E.ring({ at: t.center, from: k.s(0.2), to: k.s(0.7), width: 2.5, color: '#c8b0ff', duration: 280 }));
      void k.agitar(t.sprite, 2, 200);
    });
    await k.despues();
  },

  // Ronquido (50): duerme y respira hondo (le suben Z pequeñas); al roncar, una Z grande sale disparada con ondas
  // temblorosas y estalla en zetas sobre el objetivo.
  async snore(k) {
    const u = k.user;
    void k.animar(u.sprite, [{ transform: 'scale(1, 1)' }, { transform: 'scale(1.1, 1.07)', offset: 0.55 }, { transform: 'scale(0.92, 0.96)', offset: 0.7 }, { transform: 'scale(1, 1)' }], 620);
    const ZZ: EstiloForma = { base: degradado('#ffffff', '#a8c8ff'), borde: '#1e3a6a' };
    for (let i = 0; i < 3; i++) {
      animaForma(k, 'z', 420, t => ({ p: { x: u.top.x + (i - 1) * u.size * 0.18 + Math.sin(t * 7 + i) * 4, y: u.top.y - u.size * 0.1 - t * u.size * 0.6 }, tam: u.size * (0.08 + 0.03 * i), ang: -0.2, alpha: Math.min(1, t * 4) * (1 - easeIn(t)) }), ZZ, { delay: i * 100 });
    }
    await k.esperar(340);
    const vuelo = 260;
    animaForma(k, 'z', vuelo, t => ({ p: k.punto(0.15 + 0.85 * t), tam: lerp(u.size * 0.15, k.s(0.42), t), ang: Math.sin(t * 12) * 0.3, alpha: Math.min(1, t * 6) }), ZZ);
    k.dibujar(vuelo + 120, (c, t) => {
      const o = u.center;
      c.lineCap = 'round';
      for (let i = 0; i < 2; i++) {
        const v = clamp01(t * 1.3 - i * 0.25);
        if (v <= 0 || v >= 1) continue;
        const r = lerp(u.size * 0.4, k.dist * 0.9, v);
        c.globalAlpha = 0.8 * (1 - v); c.strokeStyle = '#a8c8ff'; c.lineWidth = 3;
        c.beginPath();
        for (let j = 0; j <= 20; j++) { const a = k.angle - 0.6 + 1.2 * j / 20, rr = r + Math.sin(j * 2.4 + t * 30) * 3; const p = mas(o, polar(a, rr)); if (j) c.lineTo(p.x, p.y); else c.moveTo(p.x, p.y); }
        c.stroke();
      }
    });
    await k.esperar(vuelo);
    await k.impacto(t => {
      const zs = Array.from({ length: 5 }, () => ({ a: rand(0, Math.PI * 2), v: rand(0.5, 0.9), r: rand(0, 1) }));
      k.dibujar(420, (c, x) => {
        c.globalAlpha = 1 - easeIn(x);
        for (const z of zs) { const p = mas(t.center, polar(z.a, t.size * z.v * easeOut(x))); forma(c, 'z', p.x, p.y - x * t.size * 0.3, t.size * (0.08 + 0.05 * z.r), z.a * 0.3, ZZ); }
      }, { z: 1 });
      void k.agitar(t.sprite, 3, 260);
    });
    await k.despues();
  },

  // Giro Rápido (50): gira como una peonza envuelto en una rueda de viento, embiste de pasada y barre lo que haya alrededor.
  async rapidspin(k) {
    const v = hacia(k, 0.7), ms = 480;
    void k.animar(k.user.sprite, [
      { transform: 'translate(0px, 0px) rotate(0deg)' },
      { transform: tf(mas({ x: 0, y: 0 }, v, 0.2), 'rotate(360deg)'), offset: 0.3 },
      { transform: tf(v, 'rotate(720deg)'), offset: 0.55 },
      { transform: tf(mas({ x: 0, y: 0 }, v, 0.4), 'rotate(960deg)'), offset: 0.8 },
      { transform: 'translate(0px, 0px) rotate(1080deg)' },
    ], ms, 'linear');
    k.dibujar(ms, (c, t) => {
      const p = k.posSprite(k.user), r = k.user.size * 0.62;
      c.globalAlpha = 0.6 * Math.min(1, t * 6) * (t > 0.8 ? (1 - t) / 0.2 : 1);
      forma(c, 'rueda', p.x, p.y, r, -t * 26, { base: '#f4f0e6', claro: '#ffffff', oscuro: '#b8b0a0', borde: '#6e6658' });
      if (Math.random() < 0.6) { const a = rand(0, Math.PI * 2), q = mas(p, polar(a, r * 1.05)); k.emit({ x: q.x, y: q.y, vx: Math.sin(a) * 260, vy: -Math.cos(a) * 260, drag: 3, life: 200, size: 1.5, color: '#ffffff', shape: 'streak', stretch: 30 }); }
    }, { z: 1 });
    await k.esperar(ms * 0.55);
    await k.impacto(t => {
      E.sparks(k.fx, contacto(k, t), { count: 8, speed: [120, 260], palette: BLANCO, shape: 'streak' });
      k.burst(6, () => { const a = rand(0, Math.PI * 2), vv = rand(120, 220); return { x: k.posSprite(k.user).x, y: k.posSprite(k.user).y, vx: Math.cos(a) * vv, vy: Math.sin(a) * vv * 0.6, drag: 2, life: 500, size: rand(3, 5), color: pick(['#b8a070', '#8a9a5a', '#c8b890']), shape: 'leaf', spin: rand(-12, 12) }; });
    });
    await k.esperar(ms * 0.45);
    await k.despues();
  },

  // Meteorobola (50): una bola que cambia de color (sol, lluvia, nieve, arena) con iconos girando, lanzada en globo;
  // salpica de todo al caer.
  async weatherball(k) {
    const colores = ['#ff8a2a', '#3a9cff', '#d8f4ff', '#e0b860'], ms = 440, arco = k.s(0.8), r = k.s(0.2);
    await k.anticipar(70);
    void k.recuperar({ x: -k.dir.x * 6, y: -k.dir.y * 6 }, 160);
    const colorEn = (t: number): string => { const f = (t * 6) % 4, i = Math.floor(f); return mix(colores[i], colores[(i + 1) % 4], f - i); };
    await k.proyectil(ms, (p, t, c, engine) => {
      const col = colorEn(t), g = c.createRadialGradient(p.x - r * 0.3, p.y - r * 0.35, r * 0.1, p.x, p.y, r);
      g.addColorStop(0, '#ffffff'); g.addColorStop(0.45, col); g.addColorStop(1, mix(col, '#1a1020', 0.35));
      c.globalCompositeOperation = engine.blend;
      c.drawImage(engine.glow(col), p.x - r * 2, p.y - r * 2, r * 4, r * 4);
      c.globalCompositeOperation = 'source-over';
      c.fillStyle = g; c.beginPath(); c.arc(p.x, p.y, r, 0, Math.PI * 2); c.fill();
      c.lineWidth = 1.5; c.strokeStyle = TINTA; c.stroke();
      c.strokeStyle = 'rgba(255,255,255,0.7)'; c.lineWidth = 2; c.beginPath(); c.arc(p.x, p.y, r * 0.65, t * 14, t * 14 + 1.8); c.stroke();
      // Iconos del tiempo: sol, gota y copo, en órbita.
      const iconos: [string, number][] = [['#ffd23a', 0], ['#3a9cff', 2.09], ['#ffffff', 4.19]];
      for (const [cc, a0] of iconos) { const q = mas(p, polar(a0 + t * 12, r * 1.6)); c.fillStyle = cc; c.beginPath(); c.arc(q.x, q.y, r * 0.22, 0, Math.PI * 2); c.fill(); c.lineWidth = 1; c.strokeStyle = TINTA; c.stroke(); }
      if (Math.random() < 0.5) k.emit({ x: p.x, y: p.y, vx: rand(-20, 20), vy: rand(-20, 20), life: 260, size: rand(1.5, 2.5), color: col, shape: 'dot' });
    }, { arco });
    await k.impacto(t => {
      k.burst(18, i => { const a = rand(0, Math.PI * 2), v = rand(90, 240), tipo = i % 3; return { x: t.center.x, y: t.center.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 40, ay: tipo === 1 ? 500 : 0, drag: 2, life: rand(350, 550), size: rand(2.5, 4.5), color: colores[i % 4], shape: tipo === 0 ? 'glow' : tipo === 1 ? 'drop' : 'star', spin: 6 }; });
      k.add(E.ring({ at: t.center, from: 4, to: k.s(0.7), width: 3, color: colorEn(rand(0, 1)), duration: 300 }));
    });
    await k.despues();
  },

  // ===== Golpes medios (60-85): claros y con cuerpo =====

  // Antojo (60): le salen corazones de los ojos, embiste dando un saltito y le quita un regalito al objetivo, que
  // vuela de vuelta hasta él.
  async covet(k) {
    const u = k.user;
    k.burst(3, i => ({ x: u.top.x + (i - 1) * u.size * 0.2, y: u.top.y + u.size * 0.1, vx: (i - 1) * 30, vy: -rand(50, 80), drag: 1, life: 600, delay: i * 60, size: u.size * 0.13, color: '#ff6aa8', shape: 'heart', fadeIn: 0.2 }));
    await k.esperar(180);
    await k.embestida({ hasta: 0.7, ida: 150, vuelta: 300, arco: k.s(0.25) });
    await k.impacto(t => {
      k.burst(8, () => { const a = rand(0, Math.PI * 2), v = rand(60, 150); return { x: t.center.x, y: t.center.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, drag: 2.5, life: 380, size: rand(2.5, 4), color: pick(['#ff8ac0', '#ffffff', '#ffd84a']), shape: 'star', spin: 5 }; });
      const desde = t.top, ms = 420;
      k.dibujar(ms, (c, x) => {
        const v = easeInOut(x), hasta = k.posSprite(u), p = entre(desde, hasta, v);
        p.y -= k.s(0.7) * Math.sin(Math.PI * v);
        c.globalAlpha = x > 0.85 ? (1 - x) / 0.15 : 1;
        regalo(c, p.x, p.y, k.s(0.17) * (0.6 + 0.4 * Math.min(1, x * 4)), Math.sin(x * 12) * 0.4);
        if (Math.random() < 0.4) k.emit({ x: p.x, y: p.y, vx: rand(-20, 20), vy: rand(-20, 20), life: 300, size: 2.5, color: '#ffd84a', shape: 'star' });
      }, { z: 1 });
    });
    await k.esperar(300);
    k.burst(5, () => ({ x: u.center.x, y: u.center.y - u.size * 0.2, vx: rand(-60, 60), vy: -rand(40, 100), drag: 2, life: 400, size: rand(2.5, 3.5), color: '#ffd84a', shape: 'star' }));
    await k.despues();
  },

  // Cornada (65): le crece un cuerno de marfil delante, embiste con él y lo clava: estallido en la punta.
  async hornattack(k) {
    const tam = k.user.size * 0.36, total = 560;
    let clavado = false;
    k.dibujar(total, (c, t) => {
      const ms = t * total, p = k.posSprite(k.user), crece = easeOut(Math.min(1, ms / 130));
      const punta = mas(p, k.dir, k.user.size * 0.42 + tam * 1.1 * crece + (clavado ? k.s(0.05) : 0));
      c.globalAlpha = ms > total - 140 ? (total - ms) / 140 : 1;
      cuernoHacia(c, punta, tam * crece, k.angle, { ...MARFIL, brillo: '#fff3c0', brilloTam: 10 });
    }, { z: 1 });
    await k.esperar(150);
    await k.anticipar(70);
    await k.embestida({ hasta: 0.82, ida: 150, vuelta: 280 });
    clavado = true;
    await k.impacto(t => {
      const p = contacto(k, t);
      k.add(E.starburst({ at: p, rays: 8, length: k.s(0.6), width: 3, palette: ORO, duration: 240 }));
      E.sparks(k.fx, p, { count: 10, speed: [140, 300], palette: BLANCO, shape: 'shard', size: [2.5, 4] });
    });
    await k.despues();
  },

  // Golpe Cabeza (70): agacha la cabeza, embiste con un saltito y ¡bonk!: estrella de golpe y estrellitas girando
  // sobre la cabeza del objetivo.
  async headbutt(k) {
    const g = k.dir.x >= 0 ? 1 : -1, atras = mas({ x: 0, y: 0 }, k.dir, -8), v = hacia(k, 0.85), arco = k.s(0.25);
    await k.animar(k.user.sprite, [{ transform: 'translate(0px, 0px) rotate(0deg)' }, { transform: tf(atras, `rotate(${-12 * g}deg) scale(1.05, 0.95)`) }], 120);
    await k.animar(k.user.sprite, [
      { transform: tf(atras, `rotate(${-12 * g}deg) scale(1.05, 0.95)`) },
      { transform: tf({ x: v.x * 0.5, y: v.y * 0.5 - arco }, `rotate(${18 * g}deg)`), offset: 0.55 },
      { transform: tf(v, `rotate(${24 * g}deg) scale(1.1, 0.9)`) },
    ], 160, 'cubic-bezier(0.5, 0, 0.9, 0.6)');
    void k.animar(k.user.sprite, [
      { transform: tf(v, `rotate(${24 * g}deg) scale(1.1, 0.9)`) },
      { transform: tf(mas(v, k.dir, -k.s(0.3)), `rotate(${-6 * g}deg)`), offset: 0.35 },
      { transform: 'translate(0px, 0px) rotate(0deg)' },
    ], 320, 'ease-out');
    await k.impacto(t => {
      pow(k, contacto(k, t), k.s(0.45), { puntas: 10, ms: 300 });
      mareo(k, t, 760);
    });
    await k.despues();
  },

  // Represalia (70): le salta la vena de enfado, se le enciende un aura roja y embiste dejando copias rojas.
  async retaliate(k) {
    const u = k.user;
    k.dibujar(560, (c, t) => {
      const p = k.posSprite(u), s = u.size * 0.2 * (t < 0.15 ? easeOut(t / 0.15) * 1.3 : 1 + 0.15 * Math.sin(t * 30));
      c.globalAlpha = t > 0.8 ? (1 - t) / 0.2 : 1;
      venaIra(c, p.x + u.size * 0.3, p.y - u.size * 0.5, s);
      if (t < 0.6 && Math.random() < 0.6) { const q = k.enCuerpo(u, 0.4); k.emit({ x: q.x, y: q.y, vy: -rand(60, 120), life: 380, size: rand(4, 7), sizeEnd: 1, color: pick([ROJO.core, ROJO.glow]), shape: 'glow' }); }
    }, { z: 1 });
    void k.agitar(u.sprite, 2, 280);
    await k.esperar(320);
    await k.embestida({ hasta: 0.85, ida: 140, vuelta: 260, estela: ROJO.core });
    await k.impacto(t => {
      const p = contacto(k, t);
      k.add(E.starburst({ at: p, rays: 9, length: k.s(0.75), width: 3.5, palette: ROJO, duration: 260 }));
      arcoChoque(k, p, k.angle, { r1: k.s(0.6), color: '#ff9878', ancho: 4 });
    });
    await k.despues();
  },

  // Cuchillada (70): una media luna de acero enorme cruza al objetivo y deja una línea de corte que destella.
  async slash(k) {
    await k.anticipar(90);
    void k.embestida({ hasta: 0.45, ida: 120, vuelta: 240 });
    await k.esperar(60);
    const c0 = k.target.center, R = k.s(0.65), piv = mas(c0, k.dir, -k.s(0.6));
    k.add(E.slash({ at: piv, radius: R, angle: k.angle, sweep: 2.5, width: k.s(0.16), palette: ACERO, duration: 300 }));
    k.add(E.slash({ at: piv, radius: R * 0.86, angle: k.angle, sweep: 2.1, width: k.s(0.06), palette: BLANCO, duration: 300, delay: 40 }));
    const ang = k.angle + Math.PI / 2 + 0.35, L = k.s(0.85);
    k.dibujar(280, (c, t, engine) => {
      const abre = easeOutCubic(Math.min(1, t / 0.35)), fin = t > 0.5 ? 1 - (t - 0.5) / 0.5 : 1, d = polar(ang, L * abre);
      c.lineCap = 'round';
      c.globalAlpha = fin; c.strokeStyle = '#2a3a4a'; c.lineWidth = 4; c.beginPath(); c.moveTo(c0.x - d.x, c0.y - d.y); c.lineTo(c0.x + d.x, c0.y + d.y); c.stroke();
      c.strokeStyle = '#ffffff'; c.lineWidth = 2; c.stroke();
      c.globalCompositeOperation = engine.blend;
      const g = k.s(0.5) * (1 - t);
      c.drawImage(engine.glow('#ffffff'), c0.x - g, c0.y - g, g * 2, g * 2);
    }, { z: 1, delay: 120 });
    await k.esperar(140);
    await k.impacto(t => {
      E.sparks(k.fx, t.center, { count: 12, speed: [160, 340], palette: ACERO, shape: 'shard', size: [2, 4] });
      void k.agitar(t.sprite, 3, 200);
    });
    await k.despues();
  },

  // Garra Brutal (75): una garra enorme baja desde la cámara y se estampa en el objetivo; su coraza salta en esquirlas
  // y el suelo se agrieta.
  async crushclaw(k) {
    await k.anticipar(90);
    void k.embestida({ hasta: 0.5, ida: 120, vuelta: 260 });
    const c0 = k.target.center, tam = k.s(0.6), baja = 150;
    animaForma(k, 'garras', baja + 340, t => {
      const ms = t * (baja + 340), u = Math.min(1, ms / baja);
      return { p: c0, tam: tam * lerp(2.1, 1, easeIn(u)), ang: k.angle + 0.6, alpha: u < 1 ? 0.25 + 0.75 * u : 1 - Math.max(0, (ms - baja - 140) / 200) };
    }, GARRA_DURA);
    await k.esperar(baja);
    await k.impacto(t => {
      k.burst(14, () => { const a = rand(0, Math.PI * 2), v = rand(120, 260); return { x: t.center.x, y: t.center.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 60, ay: 600, drag: 1, life: rand(450, 650), size: rand(3.5, 6), color: pick(['#a8b4c0', '#d8e0e8', '#7a8694']), shape: 'shard', spin: rand(-12, 12) }; });
      k.add(E.cracks({ at: t.feet, length: k.s(0.6), color: 'rgba(60,40,20,0.7)', duration: 600 }));
      luego(() => void k.animar(t.sprite, [{ transform: 'translate(0px, 0px) scale(1, 1)' }, { transform: 'translate(0px, 3px) scale(1.12, 0.85)', offset: 0.25 }, { transform: 'translate(0px, 0px) scale(1, 1)' }], 320));
    });
    await k.despues();
  },

  // Esfuerzo (—): aprieta los dientes: tiembla, suda a chorros y le saltan líneas de esfuerzo; luego se lanza con todo.
  async endeavor(k) {
    const u = k.user;
    void k.agitar(u.sprite, 2.5, 380);
    sudor(k, u, 8, 300);
    const rayas = Array.from({ length: 6 }, (_, i) => -Math.PI / 2 + (i - 2.5) * 0.45);
    k.dibujar(380, (c, t) => {
      const p = k.posSprite(u);
      c.lineCap = 'round';
      rayas.forEach((a, i) => {
        const on = Math.sin(t * 30 + i * 1.7) > 0;
        if (!on) return;
        const a0 = mas(p, polar(a, u.size * 0.62)), a1 = mas(p, polar(a, u.size * 0.85));
        for (const [col, w] of [[TINTA, 4], ['#ffa040', 2.2]] as const) { c.strokeStyle = col; c.lineWidth = w; c.beginPath(); c.moveTo(a0.x, a0.y); c.lineTo(a1.x, a1.y); c.stroke(); }
      });
    }, { z: 1 });
    await k.esperar(360);
    await k.embestida({ hasta: 0.8, ida: 140, vuelta: 260, estela: '#ffb060' });
    await k.impacto(t => {
      const p = contacto(k, t);
      pow(k, p, k.s(0.32), { color: '#ffa040', puntas: 8 });
      polvo(k, t.feet, 5, k.s(0.5));
    });
    await k.despues();
  },

  // Pisotón (65): un pie gigante cae desde arriba sobre el objetivo (su sombra crece antes) y lo aplasta: grietas y polvo.
  async stomp(k) {
    const f = k.target.feet, tam = k.s(0.6), caida = 240, queda = 220, izq = k.dir.x < 0;
    const suelo = { x: f.x, y: f.y - tam * 0.52 }, arriba = { x: f.x, y: k.stage.top - tam * 1.5 };
    void k.saltar(k.user.sprite, k.s(0.15), 220);
    k.dibujar(caida + queda, (c, t) => {
      const ms = t * (caida + queda), u = Math.min(1, ms / caida);
      c.globalAlpha = 0.32 * u * (ms > caida + 80 ? 1 - (ms - caida - 80) / (queda - 80) : 1);
      c.fillStyle = '#1a120a'; c.beginPath(); c.ellipse(f.x, f.y, tam * (0.5 + 0.5 * u), tam * 0.22 * (0.5 + 0.5 * u), 0, 0, Math.PI * 2); c.fill();
    }, { z: 0 });
    animaForma(k, 'pie', caida + queda, t => {
      const ms = t * (caida + queda), p = entre(arriba, suelo, easeIn(Math.min(1, ms / caida))), sube = ms > caida + 90 ? (ms - caida - 90) / (queda - 90) : 0;
      return { p: { x: p.x, y: p.y - sube * tam * 0.7 }, tam, ang: izq ? Math.PI : 0, espejo: izq, alpha: 1 - sube };
    }, CREMA);
    await k.esperar(caida);
    await k.impacto(t => {
      k.add(E.cracks({ at: t.feet, length: k.s(0.8), color: 'rgba(60,40,20,0.75)', duration: 700 }));
      onda(k, t.feet, k.s(1.0), 5, 360);
      polvo(k, t.feet, 9, k.s(0.8), { vel: 130 });
      luego(() => void k.animar(t.sprite, [{ transform: 'translate(0px, 0px) scale(1, 1)' }, { transform: 'translate(0px, 4px) scale(1.25, 0.68)', offset: 0.25 }, { transform: 'translate(0px, 0px) scale(0.94, 1.06)', offset: 0.65 }, { transform: 'translate(0px, 0px) scale(1, 1)' }], 420));
    });
    await k.despues();
  },

  // Hipercolmillo (80): dos incisivos enormes, como de roedor, se abren sobre el objetivo y se cierran de golpe.
  async hyperfang(k) {
    await k.anticipar(80);
    void k.embestida({ hasta: 0.5, ida: 130, vuelta: 260 });
    const c0 = k.target.center, tam = k.s(0.62), abrir = 170, cerrar = 70, queda = 200, total = abrir + cerrar + queda;
    k.dibujar(total, (c, t) => {
      const ms = t * total, ap = ms < abrir ? easeOut(ms / abrir) : ms < abrir + cerrar ? 1 - easeIn((ms - abrir) / cerrar) : 0;
      const fuera = ms > abrir + cerrar ? (ms - abrir - cerrar) / queda : 0;
      c.globalAlpha = Math.min(1, ms / 60) * (1 - fuera);
      incisivos(c, c0.x, c0.y, tam * (0.75 + 0.25 * Math.min(1, ms / abrir) + 0.1 * fuera), ap);
    }, { z: 1 });
    await k.esperar(abrir + cerrar);
    await k.impacto(t => {
      E.sparks(k.fx, t.center, { count: 12, speed: [140, 300], palette: BLANCO, shape: 'shard', size: [2.5, 4.5] });
      k.add(E.ring({ at: t.center, from: 4, to: k.s(0.75), width: 4, color: '#ffffff', duration: 240 }));
      void k.agitar(t.sprite, 3, 220);
    });
    await k.despues();
  },

  // Fuerza (80): saca músculo (dos pulsos), levanta una roca enorme sobre la cabeza y la lanza: se parte contra el objetivo.
  async strength(k) {
    const u = k.user, rr = k.s(0.42), sube = 280, vuela = 260;
    const perfil = Array.from({ length: 9 }, () => rand(0.8, 1.05));
    void k.animar(u.sprite, [{ transform: 'scale(1, 1)' }, { transform: 'scale(1.12, 0.9)', offset: 0.25 }, { transform: 'scale(1, 1)', offset: 0.45 }, { transform: 'scale(1.15, 0.88)', offset: 0.7 }, { transform: 'scale(1, 1)' }], sube);
    const encima = { x: u.top.x, y: u.top.y - rr * 1.1 };
    k.dibujar(sube + vuela, (c, t) => {
      const ms = t * (sube + vuela);
      if (ms < sube) {
        const v = easeOut(ms / sube), p = entre(u.center, encima, v);
        roca(c, p.x + Math.sin(ms / 20) * 1.5, p.y, rr * (0.5 + 0.5 * v), 0, perfil);
        if (Math.random() < 0.3) k.emit({ x: p.x + rand(-rr, rr), y: p.y + rr * 0.8, vy: rand(30, 80), ay: 300, life: 300, size: 2, color: '#8a7a64', shape: 'rock', accent: TINTA });
      } else {
        const v = easeIn((ms - sube) / vuela), p = entre(encima, k.target.center, v);
        roca(c, p.x, p.y - k.s(0.4) * Math.sin(Math.PI * v), rr, v * 4, perfil);
      }
    }, { z: 1 });
    await k.esperar(sube);
    void k.embestida({ hasta: 0.2, ida: 100, vuelta: 220 });
    await k.esperar(vuela);
    await k.impacto(t => {
      k.burst(14, () => { const a = rand(0, Math.PI * 2), v = rand(120, 280); return { x: t.center.x, y: t.center.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 120, ay: 800, drag: 0.8, life: rand(500, 750), size: rand(4, 8), color: pick(['#a89a86', '#c8bca8', '#7a6e5e']), accent: TINTA, shape: 'rock', spin: rand(-10, 10) }; });
      polvo(k, t.feet, 8, k.s(0.9));
      onda(k, t.feet, k.s(0.9), 4, 320);
    });
    await k.despues();
  },

  // Atizar (80): una cola larga y gruesa se levanta por un lado y restalla sobre el objetivo como un látigo.
  async slam(k) {
    await k.anticipar(110);
    const L = Math.max(k.dist - k.target.size * 0.05, k.s(1)), ms = 260, queda = 240, a0 = k.angle - 2.3, ancho = k.user.size * 0.24;
    const cola = (c: CanvasRenderingContext2D, u: number, alpha: number, solo?: string) => {
      const base = k.posSprite(k.user), a = lerp(a0, k.angle, u), tip = mas(base, polar(a, L)), ctl = mas(base, polar(a + 0.55 * (1 - u), L * 0.55));
      const pts: Vec[] = [], nor: Vec[] = [];
      for (let i = 0; i <= 16; i++) {
        const s = i / 16, x = (1 - s) * (1 - s) * base.x + 2 * (1 - s) * s * ctl.x + s * s * tip.x, y = (1 - s) * (1 - s) * base.y + 2 * (1 - s) * s * ctl.y + s * s * tip.y;
        pts.push({ x, y });
      }
      for (let i = 0; i <= 16; i++) { const a2 = pts[Math.max(0, i - 1)], b2 = pts[Math.min(16, i + 1)], l = Math.hypot(b2.x - a2.x, b2.y - a2.y) || 1; nor.push({ x: -(b2.y - a2.y) / l, y: (b2.x - a2.x) / l }); }
      c.beginPath();
      pts.forEach((p, i) => { const w = ancho * (1 - 0.8 * (i / 16)); const q = mas(p, nor[i], w); if (i) c.lineTo(q.x, q.y); else c.moveTo(q.x, q.y); });
      for (let i = 16; i >= 0; i--) { const w = ancho * (1 - 0.8 * (i / 16)); const q = mas(pts[i], nor[i], -w); c.lineTo(q.x, q.y); }
      c.closePath();
      c.globalAlpha = alpha;
      if (solo) { c.fillStyle = solo; c.fill(); return; }
      const g = c.createLinearGradient(base.x, base.y, tip.x, tip.y); g.addColorStop(0, '#f2e6cc'); g.addColorStop(1, '#ffffff');
      c.fillStyle = g; c.fill(); c.lineJoin = 'round'; c.lineWidth = 2; c.strokeStyle = TINTA; c.stroke();
    };
    k.dibujar(ms + queda, (c, t) => {
      const tt = t * (ms + queda), u = easeIn(Math.min(1, tt / ms)), fade = tt > ms + 100 ? 1 - (tt - ms - 100) / (queda - 100) : 1;
      if (u > 0.1) cola(c, Math.max(0, u - 0.2), 0.25 * fade, '#ffffff');
      if (u > 0.05) cola(c, Math.max(0, u - 0.1), 0.4 * fade, '#ffffff');
      cola(c, u, fade);
    }, { z: 1 });
    void k.animar(k.user.sprite, [{ transform: 'rotate(0deg)' }, { transform: `rotate(${k.dir.x >= 0 ? 10 : -10}deg)`, offset: 0.7 }, { transform: 'rotate(0deg)' }], ms + 200);
    await k.esperar(ms);
    await k.impacto(t => {
      onda(k, t.feet, k.s(1.0), 5, 360);
      polvo(k, t.feet, 8, k.s(0.8));
      k.add(E.starburst({ at: t.center, rays: 8, length: k.s(0.7), width: 3, palette: BLANCO, duration: 240 }));
      luego(() => void k.animar(t.sprite, [{ transform: 'translate(0px, 0px) scale(1, 1)' }, { transform: tf(mas({ x: 0, y: 4 }, k.dir, 4), 'scale(1.18, 0.78)'), offset: 0.25 }, { transform: 'translate(0px, 0px) scale(1, 1)' }], 340));
    });
    await k.despues();
  },

  // Golpe Cuerpo (85): salta muy alto (crece hacia la cámara), cae de plancha sobre el objetivo y lo aplasta: onda en el
  // suelo, polvo y grietas.
  async bodyslam(k) {
    await k.anticipar(100);
    const v = hacia(k, 1.05), alto = k.s(1.0), salto = 340, f = k.target.feet, r = k.user.size * 0.55;
    k.dibujar(salto + 160, (c, t) => {
      const u = Math.min(1, (t * (salto + 160)) / salto);
      c.globalAlpha = 0.32 * easeIn(u) * (t > 0.8 ? (1 - t) / 0.2 : 1);
      c.fillStyle = '#1a120a'; c.beginPath(); c.ellipse(f.x, f.y, r * (0.5 + 0.5 * u), r * 0.3 * (0.5 + 0.5 * u), 0, 0, Math.PI * 2); c.fill();
    }, { z: 0 });
    await k.animar(k.user.sprite, [
      { transform: 'translate(0px, 0px) scale(1, 1)' },
      { transform: tf({ x: v.x * 0.15, y: v.y * 0.15 - alto * 0.35 }, 'scale(0.92, 1.1)'), offset: 0.2 },
      { transform: tf({ x: v.x * 0.6, y: v.y * 0.6 - alto }, 'scale(1.35, 1.35)'), offset: 0.6 },
      { transform: tf(v, 'scale(1.35, 0.72)') },
    ], salto, 'cubic-bezier(0.35, 0, 0.75, 1)');
    void k.animar(k.user.sprite, [
      { transform: tf(v, 'scale(1.35, 0.72)') },
      { transform: tf(v, 'scale(1.2, 0.85)'), offset: 0.25 },
      { transform: tf({ x: v.x * 0.5, y: v.y * 0.5 - k.s(0.25) }, 'scale(1, 1)'), offset: 0.6 },
      { transform: 'translate(0px, 0px) scale(1, 1)' },
    ], 380, 'ease-out');
    await k.impacto(t => {
      onda(k, t.feet, k.s(1.2), 6, 400);
      onda(k, t.feet, k.s(0.75), 4, 320, { delay: 60 });
      polvo(k, t.feet, 10, k.s(0.9), { vel: 140 });
      k.add(E.cracks({ at: t.feet, length: k.s(0.7), color: 'rgba(60,40,20,0.7)', duration: 700 }));
      luego(() => void k.animar(t.sprite, [{ transform: 'translate(0px, 0px) scale(1, 1)' }, { transform: 'translate(0px, 4px) scale(1.3, 0.6)', offset: 0.25 }, { transform: 'translate(0px, 0px) scale(0.92, 1.08)', offset: 0.6 }, { transform: 'translate(0px, 0px) scale(1, 1)' }], 440));
    });
    await k.despues();
  },

  // Triataque (80): tres orbes (fuego, hielo y rayo) forman un triángulo delante del usuario, giran y se lanzan juntos;
  // cada uno estalla a su manera.
  async triattack(k) {
    const F = TYPE_FX.Fire, H = TYPE_FX.Ice, R = TYPE_FX.Electric, orbes = [F, H, R];
    const forma3 = 280, vuelo = 280, rad = k.s(0.42);
    k.dibujar(forma3 + vuelo + 40, (c, t, engine) => {
      const ms = t * (forma3 + vuelo + 40), v = clamp01((ms - forma3) / vuelo);
      const centro = entre(k.punto(0.22), k.target.center, easeIn(v)), r = ms < forma3 ? rad * easeOut(ms / forma3) : rad * (1 - 0.8 * easeIn(v));
      const pts = [0, 1, 2].map(i => k.alrededor(centro, r, ms / 160 + i * 2.094, 0.8));
      c.globalAlpha = ms > forma3 + vuelo ? 1 - (ms - forma3 - vuelo) / 40 : 1;
      c.strokeStyle = 'rgba(255,255,255,0.75)'; c.lineWidth = 2; c.beginPath(); pts.forEach((p, i) => (i ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y))); c.closePath(); c.stroke();
      c.globalCompositeOperation = engine.blend;
      pts.forEach((p, i) => {
        const pal = orbes[i], s = k.s(0.2);
        c.drawImage(engine.glow(pal.core), p.x - s * 1.6, p.y - s * 1.6, s * 3.2, s * 3.2);
        c.drawImage(engine.glow(pal.hot), p.x - s * 0.6, p.y - s * 0.6, s * 1.2, s * 1.2);
      });
      c.globalCompositeOperation = 'source-over';
      pts.forEach((p, i) => {
        const s = k.s(0.13);
        c.fillStyle = orbes[i].core; c.beginPath(); c.arc(p.x, p.y, s, 0, Math.PI * 2); c.fill();
        c.lineWidth = 1.5; c.strokeStyle = orbes[i].dark; c.stroke();
        c.fillStyle = 'rgba(255,255,255,0.8)'; c.beginPath(); c.arc(p.x - s * 0.3, p.y - s * 0.35, s * 0.3, 0, Math.PI * 2); c.fill();
      });
      if (Math.random() < 0.5) k.emit({ x: pts[0].x, y: pts[0].y, vx: rand(-15, 15), vy: -rand(40, 90), life: 260, size: rand(3, 5), sizeEnd: 1, color: pick([F.core, F.glow]), shape: 'glow' });
      if (Math.random() < 0.35) k.emit({ x: pts[1].x, y: pts[1].y, vx: rand(-50, 50), vy: rand(-50, 50), life: 300, size: rand(2, 3.5), color: H.glow, shape: 'shard', spin: 8 });
      if (Math.random() < 0.5) { const p = pts[2], q = mas(p, polar(rand(0, Math.PI * 2), k.s(0.3))), m = mas(entre(p, q, 0.5), polar(rand(0, Math.PI * 2), k.s(0.08))); c.strokeStyle = R.glow; c.lineWidth = 1.5; c.beginPath(); c.moveTo(p.x, p.y); c.lineTo(m.x, m.y); c.lineTo(q.x, q.y); c.stroke(); }
    }, { z: 1 });
    await k.esperar(forma3 + vuelo);
    await k.impacto(t => {
      E.fireBurst(k.stage, t.center, F, t.size * 0.7);
      E.sparks(k.fx, t.center, { count: 10, speed: [120, 260], palette: H, shape: 'shard', size: [2.5, 4.5] });
      for (const a of [-2.2, -0.9]) k.add(E.bolt({ from: mas(t.center, polar(a, k.s(0.8))), to: t.center, palette: R, duration: 220, width: 2, branches: 1 }));
    });
    await k.despues();
  },

  // Rapidez (60): cinco estrellas doradas salen en abanico, giran y persiguen al objetivo con curvas distintas, dejando
  // destellos; nunca fallan.
  async swift(k) {
    await k.anticipar(70);
    const n = 5, viaje = 380;
    for (let i = 0; i < n; i++) {
      const lado = (i - 2) * k.s(0.5) + rand(-k.s(0.1), k.s(0.1));
      k.dibujar(viaje, (c, t, engine) => {
        const u = easeInOut(t), p = k.punto(0.08 + 0.92 * u, lado * Math.sin(Math.PI * u)), r = k.s(0.14);
        c.globalCompositeOperation = engine.blend;
        c.drawImage(engine.glow(ORO.glow), p.x - r * 2, p.y - r * 2, r * 4, r * 4);
        c.globalCompositeOperation = 'source-over';
        forma(c, 'estrella', p.x, p.y, r, t * 14 + i, ESTRELLA);
        if (Math.random() < 0.45) k.emit({ x: p.x, y: p.y, vx: rand(-20, 20), vy: rand(-20, 20), life: 320, size: rand(2, 3.5), color: pick([ORO.glow, '#ffffff']), shape: 'star', spin: 4 });
      }, { delay: i * 45, z: 1 });
    }
    void k.recuperar({ x: -k.dir.x * 6, y: -k.dir.y * 6 }, 200);
    await k.esperar(viaje + 30);
    await k.impacto(t => {
      k.burst(14, () => { const a = rand(0, Math.PI * 2), v = rand(90, 220); return { x: t.center.x, y: t.center.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, drag: 2.5, life: rand(350, 520), size: rand(3, 5), color: pick([ORO.core, ORO.glow, '#ffffff']), shape: 'star', spin: rand(-6, 6) }; });
      k.add(E.ring({ at: t.center, from: 4, to: k.s(0.7), width: 3, color: ORO.glow, duration: 280 }));
    });
    await k.esperar((n - 1) * 45);
    await k.despues();
  },

  // Velocidad Extrema (80): desaparece en un destello y golpea tres veces desde tres direcciones en un parpadeo
  // (estelas doradas y copias suyas alrededor del objetivo); luego reaparece en su sitio.
  async extremespeed(k) {
    const u = k.user, c0 = k.target.center, L = k.s(1.4), angs = [k.angle, k.angle + 2.3, k.angle - 2.3];
    k.add(E.bloom({ at: u.center, radius: u.size * 0.6, color: '#ffffff', duration: 180 }));
    void k.animar(u.sprite, [{ opacity: 1 }, { opacity: 0, offset: 0.1 }, { opacity: 0, offset: 0.82 }, { opacity: 1 }], 680);
    lineasVelocidad(k, 8, { color: ORO.glow });
    angs.forEach((a, i) => {
      const A = mas(c0, polar(a, -L)), B = mas(c0, polar(a, L * 0.6)), delay = 60 + i * 110;
      k.dibujar(170, (c, t) => {
        const cab = easeOut(Math.min(1, t / 0.5)), cola = easeIn(Math.max(0, (t - 0.3) / 0.7)), p = entre(A, B, cola), q = entre(A, B, cab), w = u.size * 0.32 * (1 - cola);
        c.lineCap = 'round';
        c.globalAlpha = 0.45; c.strokeStyle = ORO.core; c.lineWidth = w; c.beginPath(); c.moveTo(p.x, p.y); c.lineTo(q.x, q.y); c.stroke();
        c.globalAlpha = 1; c.strokeStyle = '#ffffff'; c.lineWidth = w * 0.35; c.stroke();
      }, { z: 1, delay });
      const fantasma = mas(c0, polar(a, -k.s(0.75)));
      k.sombra(u.sprite, { x: fantasma.x - u.center.x, y: fantasma.y - u.center.y }, i % 2 ? ORO.glow : '#ffffff', delay + 40, 220);
      k.burst(5, () => { const b = a + rand(-0.8, 0.8), v = rand(140, 280); return { x: c0.x, y: c0.y, vx: Math.cos(b) * v, vy: Math.sin(b) * v, delay: delay + 70, drag: 3, life: 220, size: rand(1.5, 2.5), color: pick(['#ffffff', ORO.glow]), shape: 'streak', stretch: 26 }; });
    });
    await k.esperar(130);
    await k.impacto(t => {
      k.add(E.starburst({ at: t.center, rays: 8, length: k.s(0.7), width: 3, palette: ORO, duration: 240 }));
    });
    await k.esperar(330);
    k.add(E.bloom({ at: u.center, radius: u.size * 0.5, color: '#ffffff', duration: 200 }));
    await k.despues();
  },

  // Azote (—): agita los brazos sin control (se bambolea con arcos de movimiento y sudor) y aporrea al objetivo con
  // tres golpes desordenados.
  async flail(k) {
    const u = k.user, ms = 400;
    void k.animar(u.sprite, [
      { transform: 'translate(0px, 0px) rotate(0deg)' }, { transform: 'translate(0px, -3px) rotate(-26deg)', offset: 0.15 },
      { transform: 'translate(0px, 0px) rotate(24deg)', offset: 0.3 }, { transform: 'translate(0px, -4px) rotate(-30deg)', offset: 0.45 },
      { transform: 'translate(0px, 0px) rotate(26deg)', offset: 0.6 }, { transform: 'translate(0px, -2px) rotate(-16deg)', offset: 0.78 },
      { transform: 'translate(0px, 0px) rotate(0deg)' },
    ], ms, 'linear');
    const arcos = Array.from({ length: 5 }, (_, i) => ({ a: rand(0, Math.PI * 2), t0: i * 0.17, dir: i % 2 ? 1 : -1 }));
    k.dibujar(ms, (c, t) => {
      const p = k.posSprite(u), r = u.size * 0.7;
      c.lineCap = 'round';
      for (const s of arcos) {
        const v = (t - s.t0) / 0.25;
        if (v < 0 || v > 1) continue;
        const a0 = s.a, a1 = s.a + s.dir * 1.4 * easeOut(v);
        for (const [col, w, al] of [[TINTA, 4.5, 0.3], ['#ffffff', 2.5, 0.95]] as const) { c.globalAlpha = al * (1 - v); c.strokeStyle = col; c.lineWidth = w; c.beginPath(); c.arc(p.x, p.y, r, Math.min(a0, a1), Math.max(a0, a1)); c.stroke(); }
      }
    }, { z: 1 });
    sudor(k, u, 6, 300);
    await k.esperar(ms - 20);
    await k.embestida({ hasta: 0.75, ida: 120, vuelta: 240 });
    await k.impacto(t => {
      for (let i = 0; i < 3; i++) pow(k, k.enCuerpo(t, 0.35), k.s(0.2 + 0.06 * i), { delay: i * 75, puntas: 7 });
      void k.agitar(t.sprite, 3, 260);
    });
    await k.despues();
  },

  // Derribo (90): toma carrerilla (retrocede y escarba levantando polvo), carga a lo bestia con líneas de velocidad y
  // lanza al objetivo hacia atrás; él rebota por el retroceso.
  async takedown(k) {
    const u = k.user, atras = mas({ x: 0, y: 0 }, k.dir, -k.s(0.32)), v = hacia(k, 0.92);
    await k.animar(u.sprite, [{ transform: 'translate(0px, 0px) scale(1, 1)' }, { transform: tf(atras, 'scale(1.08, 0.92)') }], 150, 'ease-out');
    k.burst(5, () => ({ x: u.feet.x + atras.x, y: u.feet.y + atras.y, vx: -k.dir.x * rand(60, 120) + rand(-30, 30), vy: -k.dir.y * rand(60, 120) - rand(10, 40), drag: 2, life: 500, size: u.size * 0.12, sizeEnd: u.size * 0.3, color: '#d9cbb0', alpha: 0.5, shape: 'smoke' }));
    void k.agitar(u.sprite, 1.5, 100);
    await k.esperar(90);
    k.dibujar(180, () => {
      if (Math.random() < 0.7) { const p = k.posSprite(u), f = { x: p.x, y: p.y + (u.feet.y - u.center.y) }; k.emit({ x: f.x, y: f.y, vx: -k.dir.x * 60, vy: -rand(10, 40), drag: 2, life: 450, size: u.size * 0.12, sizeEnd: u.size * 0.28, color: '#d9cbb0', alpha: 0.45, shape: 'smoke' }); }
    });
    lineasVelocidad(k, 10);
    for (let i = 1; i <= 3; i++) k.sombra(u.sprite, entre(atras, v, i / 4), '#ffffff', i * 30, 220);
    await k.animar(u.sprite, [{ transform: tf(atras, 'scale(1.08, 0.92)') }, { transform: tf(v, 'scale(1.14, 0.86)') }], 170, 'cubic-bezier(0.5, 0, 0.9, 0.6)');
    void k.animar(u.sprite, [{ transform: tf(v, 'scale(1.14, 0.86)') }, { transform: tf(mas(v, k.dir, -k.s(0.4)), 'scale(0.94, 1.06)'), offset: 0.35 }, { transform: 'translate(0px, 0px) scale(1, 1)' }], 380, 'ease-out');
    await k.impacto(t => {
      const p = contacto(k, t);
      arcoChoque(k, p, k.angle, { r0: k.s(0.15), r1: k.s(0.9), n: 3, ancho: 6, ms: 320 });
      onda(k, t.feet, k.s(0.9), 4, 320);
      polvo(k, t.feet, 7, k.s(0.8));
      const lejos = mas({ x: 0, y: 0 }, k.dir, k.s(0.5)), gir = k.dir.x >= 0 ? 10 : -10;
      luego(() => void k.animar(t.sprite, [{ transform: 'translate(0px, 0px) rotate(0deg)' }, { transform: tf(lejos, `rotate(${gir}deg)`), offset: 0.25 }, { transform: tf(mas({ x: 0, y: 0 }, lejos, 0.7), `rotate(${gir * 0.5}deg)`), offset: 0.55 }, { transform: 'translate(0px, 0px) rotate(0deg)' }], 520, 'ease-out'));
      E.sparks(k.fx, k.posSprite(u), { count: 5, speed: [60, 140], palette: ROJO, shape: 'star', size: [2, 3] });
    });
    await k.despues();
  },

  // Alboroto (90): grita a lo bestia: ondas de sonido dentadas, amarillas y blancas, barren la vista una tras otra,
  // con notas y exclamaciones saliendo despedidas; la pantalla tiembla.
  async uproar(k) {
    const u = k.user, ondas = 4, cada = 110, vida = 420, R = Math.max(k.dist * 1.5, u.size * 3), total = ondas * cada + vida;
    void k.agitar(u.sprite, 3, 700);
    void k.animar(u.sprite, [{ transform: 'scale(1, 1)' }, { transform: 'scale(1.15, 0.9)', offset: 0.2 }, { transform: 'scale(1.08, 0.95)', offset: 0.8 }, { transform: 'scale(1, 1)' }], 700);
    k.dibujar(total, (c, t) => {
      const ms = t * total, o = k.posSprite(u);
      c.lineJoin = 'round';
      for (let i = 0; i < ondas; i++) {
        const v = (ms - i * cada) / vida;
        if (v < 0 || v > 1) continue;
        const r = lerp(u.size * 0.5, R, easeOut(v)), n = 26, gira = v * 0.4 * (i % 2 ? 1 : -1);
        c.beginPath();
        for (let j = 0; j <= n * 2; j++) { const a = (j / (n * 2)) * Math.PI * 2 + gira, rr = r * (j % 2 ? 0.9 : 1); const x = o.x + Math.cos(a) * rr, y = o.y + Math.sin(a) * rr * 0.8; if (j) c.lineTo(x, y); else c.moveTo(x, y); }
        c.closePath();
        for (const [col, w, al] of [[TINTA, 6, 0.3], [i % 2 ? '#ffffff' : '#ffe14a', 3.5, 0.95]] as const) { c.globalAlpha = al * (1 - v); c.strokeStyle = col; c.lineWidth = w * (1 - v * 0.5); c.stroke(); }
      }
    }, { z: 1 });
    const cosas = Array.from({ length: 7 }, (_, i) => ({ a: k.angle + rand(-1.3, 1.3), d: rand(0.7, 1.3), nota: i % 2 === 0, delay: i * 60, giro: rand(-0.5, 0.5) }));
    for (const s of cosas) {
      k.dibujar(520, (c, t) => {
        const p = mas(u.center, polar(s.a, k.dist * s.d * easeOut(t))), tam = k.s(0.16) * (0.6 + 0.4 * Math.min(1, t * 4)), ang = s.giro + Math.sin(t * 20) * 0.25;
        c.globalAlpha = Math.min(1, t * 6) * (1 - easeIn(t));
        if (s.nota) forma(c, 'nota', p.x, p.y, tam, ang, { base: '#ffe14a', claro: '#ffffff', borde: TINTA });
        else exclamacion(c, p.x, p.y, tam * 1.1, ang, '#ffffff');
      }, { z: 1, delay: s.delay });
    }
    k.add(E.flash({ color: '#fff6c0', alpha: 0.2, duration: 200 }));
    void k.stage.shake(5, 600);
    await k.esperar(cada + vida * 0.55);
    await k.impacto(t => {
      void k.agitar(t.sprite, 4, 380);
      E.sparks(k.fx, t.center, { count: 10, speed: [120, 260], palette: ORO, shape: 'star', size: [2.5, 4] });
    });
    await k.esperar(220);
    await k.despues();
  },

  // Escupir (—): se hincha con los mofletes llenos y escupe una bola de energía pegajosa que salpica
  // al objetivo con gotas.
  async spitup(k) {
    const u = k.user, r = k.s(0.2);
    await k.animar(u.sprite, [{ transform: 'scale(1, 1)' }, { transform: 'scale(1.18, 1.12)', offset: 0.7 }, { transform: 'scale(1.22, 1.08)' }], 240, 'ease-out');
    k.add(E.bloom({ at: mas(u.center, k.dir, u.size * 0.35), radius: u.size * 0.35, color: '#fff3c0', duration: 160 }));
    void k.animar(u.sprite, [{ transform: 'scale(1.22, 1.08)' }, { transform: tf(mas({ x: 0, y: 0 }, k.dir, -8), 'scale(0.88, 1.05)'), offset: 0.3 }, { transform: 'translate(0px, 0px) scale(1, 1)' }], 300);
    const ruido = Array.from({ length: 12 }, () => rand(0, 6));
    await k.proyectil(230, (p, t, c, engine) => {
      c.globalCompositeOperation = engine.blend;
      c.drawImage(engine.glow('#fff0a0'), p.x - r * 2, p.y - r * 2, r * 4, r * 4);
      c.globalCompositeOperation = 'source-over';
      c.beginPath();
      for (let i = 0; i <= 12; i++) { const a = (i / 12) * Math.PI * 2, rr = r * (1 + 0.14 * Math.sin(ruido[i % 12] + t * 30)) * (i % 12 === 6 ? 1.2 : 1); const x = p.x + Math.cos(a + k.angle) * rr * (i % 12 === 6 ? 1.3 : 1), y = p.y + Math.sin(a + k.angle) * rr; if (i) c.lineTo(x, y); else c.moveTo(x, y); }
      c.closePath();
      const g = c.createRadialGradient(p.x - r * 0.3, p.y - r * 0.3, 1, p.x, p.y, r * 1.2);
      g.addColorStop(0, '#ffffff'); g.addColorStop(0.6, '#fff0b8'); g.addColorStop(1, '#e0c070');
      c.fillStyle = g; c.fill(); c.lineWidth = 1.5; c.strokeStyle = '#6a5a3a'; c.stroke();
      if (Math.random() < 0.5) k.emit({ x: p.x, y: p.y + r * 0.6, vx: rand(-15, 15), vy: rand(10, 40), ay: 600, life: 300, size: rand(2, 3), color: '#fff0b8', shape: 'drop', stretch: 14 });
    });
    await k.impacto(t => {
      k.burst(14, () => { const a = rand(0, Math.PI * 2), v = rand(100, 240); return { x: t.center.x, y: t.center.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 50, ay: 500, drag: 1, life: rand(350, 550), size: rand(2.5, 4), color: pick(['#fff0b8', '#ffffff', '#e8d080']), shape: 'drop', stretch: 18 }; });
      const pts = Array.from({ length: 14 }, (_, i) => (i % 2 ? rand(0.4, 0.6) : rand(0.8, 1.1)));
      k.dibujar(420, (c, x) => {
        const rr = t.size * 0.45 * easeOut(Math.min(1, x * 5));
        c.globalAlpha = 0.85 * (1 - easeIn(x));
        c.beginPath(); pts.forEach((f, i) => { const p = mas(t.center, polar((i / 14) * Math.PI * 2, rr * f)); if (i) c.lineTo(p.x, p.y); else c.moveTo(p.x, p.y); }); c.closePath();
        c.fillStyle = '#fff0b8'; c.fill(); c.lineWidth = 1.5; c.strokeStyle = '#6a5a3a'; c.stroke();
      }, { z: 1 });
    });
    await k.despues();
  },

  // Superdiente (—): se oscurece la vista, brillan dos ojos rojos y unas fauces enormes de encía roja se cierran sobre
  // el objetivo; una grieta roja lo parte (le quita la mitad).
  async superfang(k) {
    k.add(E.dim({ at: k.target.center, duration: 820, strength: 0.5 }));
    await k.anticipar(100);
    void k.embestida({ hasta: 0.55, ida: 150, vuelta: 280 });
    const c0 = k.target.center, tam = k.s(0.95), abrir = 220, cerrar = 80, queda = 200, total = abrir + cerrar + queda;
    k.dibujar(total, (c, t, engine) => {
      const ms = t * total, ap = ms < abrir ? Math.min(1, (ms / abrir) * 1.2) : ms < abrir + cerrar ? 1 - easeIn((ms - abrir) / cerrar) : 0;
      const fuera = ms > abrir + cerrar ? (ms - abrir - cerrar) / queda : 0;
      c.globalAlpha = Math.min(1, ms / 60) * (1 - fuera);
      // Ojos rojos encima de las fauces.
      if (ms < abrir + cerrar) {
        c.globalCompositeOperation = engine.blend;
        const e = k.s(0.16) * (0.7 + 0.3 * Math.sin(ms / 30));
        for (const s of [-1, 1]) c.drawImage(engine.glow('#ff2a2a'), c0.x + s * k.s(0.32) - e, c0.y - tam * 0.95 - e, e * 2, e * 2);
        c.globalCompositeOperation = 'source-over';
      }
      mandibula(c, c0.x, c0.y, tam * (1 + fuera * 0.1), ap, { base: '#a0182a', claro: '#fff8f0', borde: '#2a0408', brillo: '#ff3040', brilloTam: 12 });
    }, { z: 1 });
    await k.esperar(abrir + cerrar);
    await k.impacto(t => {
      k.add(E.bolt({ from: mas(t.center, k.perp, -k.s(0.65)), to: mas(t.center, k.perp, k.s(0.65)), palette: ROJO, duration: 300, width: 3, branches: 1 }));
      k.add(E.bloom({ at: t.center, radius: k.s(0.8), color: ROJO.core, duration: 300 }));
      E.sparks(k.fx, t.center, { count: 14, speed: [140, 320], palette: { ...ROJO, glow: '#ffffff' }, shape: 'shard', size: [2.5, 4.5] });
      void k.agitar(t.sprite, 4, 260);
    });
    await k.despues();
  },

  // Guillotina (fulminante): la vista se oscurece; unas tijeras de acero gigantes se abren despacio sobre el objetivo,
  // tiemblan y se cierran de golpe: un corte blanco lo cruza.
  async guillotine(k) {
    k.add(E.dim({ at: k.target.center, duration: 1000, strength: 0.6 }));
    const c0 = k.target.center, L = k.s(1.4), piv = mas(c0, k.dir, -k.s(0.75)), abre = 380, cierra = 80, queda = 300, total = abre + cierra + queda;
    k.dibujar(total, (c, t) => {
      const ms = t * total, ap = ms < abre ? 0.75 * easeOut(ms / abre) : ms < abre + cierra ? 0.75 * (1 - easeIn((ms - abre) / cierra)) : 0;
      const tiembla = ms > abre * 0.7 && ms < abre ? Math.sin(ms / 12) * 0.03 : 0;
      c.globalAlpha = Math.min(1, ms / 120) * (ms > abre + cierra + 120 ? 1 - (ms - abre - cierra - 120) / (queda - 120) : 1);
      c.translate(piv.x, piv.y); c.rotate(k.angle);
      for (const lado of [1, -1]) { c.save(); c.rotate(-lado * (ap + tiembla)); c.scale(1, lado); cuchilla(c, L); c.restore(); }
      c.beginPath(); c.arc(0, 0, L * 0.05, 0, Math.PI * 2); c.fillStyle = '#5a646c'; c.fill(); c.lineWidth = 1.5; c.strokeStyle = '#1e2428'; c.stroke();
    }, { z: 1 });
    await k.esperar(abre + cierra);
    k.add(E.flash({ color: '#ffffff', alpha: 0.55, duration: 200 }));
    const a = piv, b = mas(c0, k.dir, L * 0.6);
    k.dibujar(280, (c, t, engine) => {
      const w = k.s(0.12) * Math.sin(Math.PI * Math.min(1, t * 1.4));
      c.lineCap = 'round'; c.globalCompositeOperation = engine.blend;
      c.globalAlpha = 0.6; c.strokeStyle = '#cfe8ff'; c.lineWidth = w * 2.5; c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(b.x, b.y); c.stroke();
      c.globalAlpha = 1; c.strokeStyle = '#ffffff'; c.lineWidth = w; c.stroke();
    }, { z: 1 });
    await k.impacto(t => {
      E.sparks(k.fx, t.center, { count: 14, speed: [160, 360], palette: ACERO, shape: 'shard', size: [2.5, 4.5] });
      k.add(E.starburst({ at: t.center, rays: 6, length: k.s(1.2), width: 3, palette: ACERO, duration: 260 }));
    });
    await k.esperar(200);
    await k.despues();
  },

  // Perforador (fulminante): un taladro gigante aparece delante del usuario y empieza a girar; se clava en el objetivo
  // y lo perfora entre chispas mientras se oscurece la vista.
  async horndrill(k) {
    k.add(E.dim({ at: k.target.center, duration: 950, strength: 0.45 }));
    const u = k.user, tam = u.size * 0.5, total = 900, v = hacia(k, 0.75);
    k.dibujar(total, (c, t) => {
      const ms = t * total, p = k.posSprite(u), pos = mas(p, k.dir, u.size * 0.45 + tam * 0.85);
      const crece = easeOut(Math.min(1, ms / 150)), fuera = ms > total - 110 ? (total - ms) / 110 : 1;
      const fase = ms < 220 ? (ms / 1000) * 4 : 0.88 + ((ms - 220) / 1000) * 14;
      c.globalAlpha = fuera;
      taladro(c, pos.x, pos.y, tam * crece, k.angle, fase);
      if (ms > 400 && ms < total - 120 && Math.random() < 0.8) {
        const tip = mas(pos, k.dir, tam);
        for (let i = 0; i < 2; i++) { const a = k.angle + Math.PI + rand(-1.1, 1.1), vv = rand(200, 380); k.emit({ x: tip.x, y: tip.y, vx: Math.cos(a) * vv, vy: Math.sin(a) * vv, ay: 400, drag: 2, life: rand(200, 320), size: rand(1.2, 2), color: pick(['#ffe14a', '#ffffff', '#ffb040']), shape: 'streak', stretch: 22 }); }
      }
    }, { z: 1 });
    await k.esperar(240);
    await k.animar(u.sprite, [{ transform: 'translate(0px, 0px) scale(1, 1)' }, { transform: tf(v, 'scale(1.1, 0.9)') }], 170, 'cubic-bezier(0.5, 0, 0.9, 0.6)');
    void k.animar(u.sprite, [
      { transform: tf(v), offset: 0 }, { transform: tf(mas(v, k.perp, 1.5)), offset: 0.12 }, { transform: tf(mas(v, k.perp, -1.5)), offset: 0.24 },
      { transform: tf(mas(v, k.perp, 1.5)), offset: 0.36 }, { transform: tf(mas(v, k.perp, -1.5)), offset: 0.48 }, { transform: tf(v), offset: 0.6 },
      { transform: 'translate(0px, 0px)' },
    ], 520, 'linear');
    await k.impacto(t => {
      void k.agitar(t.sprite, 3, 320);
      k.add(E.starburst({ at: contacto(k, t), rays: 7, length: k.s(0.6), width: 2.5, palette: ORO, duration: 260 }));
    });
    await k.esperar(260);
    await k.despues();
  },

  // ===== Golpes fuertes y épicos (≥ 90): grandes, arriesgados y llamativos =====

  // Megapatada (120): se oscurece la vista y un pie gigante da una patada en arco alrededor del usuario dejando una
  // media luna blanca; ¡pum! enorme al llegar.
  async megakick(k) {
    k.add(E.dim({ at: k.target.center, duration: 1000, strength: 0.38 }));
    await k.anticipar(130);
    const u = k.user, tam = k.s(0.7), ms = 300, a0 = k.angle - 2.0, R = Math.max(k.s(0.8), k.dist - k.target.size * 0.35 - tam * 0.4);
    void k.embestida({ hasta: 0.3, ida: 170, vuelta: 340 });
    k.add(E.slash({ at: u.center, radius: R, angle: k.angle - 1.0, sweep: 2.0, width: k.s(0.28), palette: BLANCO, duration: ms + 160 }));
    // El pie gira con el arco y su suela mira hacia donde va (la tangente): con la forma girada `a`, su +y es a + 90°.
    const pieEn = (v: number) => { const a = lerp(a0, k.angle, v); return { p: mas(u.center, polar(a, R)), ang: a }; };
    k.dibujar(ms + 220, (c, t) => {
      const tt = t * (ms + 220), v = easeIn(Math.min(1, tt / ms)), fade = tt > ms + 80 ? 1 - (tt - ms - 80) / 140 : 1;
      for (const [d, al] of [[0.16, 0.25], [0.08, 0.45]] as const) if (v > d) { const g = pieEn(v - d); c.globalAlpha = al * fade; forma(c, 'pie', g.p.x, g.p.y, tam, g.ang, { base: '#ffffff', borde: '#ffffff' }); }
      const q = pieEn(v), emp = tt > ms ? k.s(0.08) * Math.min(1, (tt - ms) / 60) : 0;
      c.globalAlpha = fade;
      forma(c, 'pie', q.p.x + k.dir.x * emp, q.p.y + k.dir.y * emp, tam * (1 + 0.1 * (tt > ms ? 1 : 0)), q.ang, CREMA);
    }, { z: 1 });
    await k.esperar(ms);
    k.add(E.flash({ color: '#fff8e0', alpha: 0.35, duration: 200 }));
    await k.impacto(t => {
      pow(k, contacto(k, t), k.s(0.75), { puntas: 12, ms: 340 });
      onda(k, t.feet, k.s(1.3), 6, 400);
      arcoChoque(k, t.center, k.angle, { r0: k.s(0.3), r1: k.s(1.2), n: 3, ancho: 6, ms: 340 });
      E.sparks(k.fx, t.center, { count: 12, speed: [160, 340], palette: ORO, shape: 'star', size: [3, 5] });
    });
    await k.esperar(160);
    await k.despues();
  },

  // Doble Filo (120): gran carga; una punta de flecha de energía de dos filos (blanca y dorada por dentro, roja por fuera)
  // le envuelve mientras embiste; tras el golpe un rayo rojo vuelve hasta él (el retroceso).
  async doubleedge(k) {
    await k.cargaEpica();
    const u = k.user, total = 760;
    let golpe = 0;
    k.dibujar(total, (c, t) => {
      const ms = t * total, p = k.posSprite(u), s = u.size, entra = easeOut(Math.min(1, ms / 120)), fuera = golpe && ms > golpe + 80 ? Math.max(0, 1 - (ms - golpe - 80) / 160) : 1;
      const largo = s * (0.6 + 0.45 * entra), cola = mas(p, k.dir, -s * 0.45), w = s * 0.8 * entra;
      const filo = (escala: number, j: number) => {
        const tip = mas(p, k.dir, largo * escala), A = mas(cola, k.perp, w * escala), B = mas(cola, k.perp, -w * escala), m = mas(p, k.dir, -s * 0.1 * escala);
        const jit = () => rand(-j, j);
        c.beginPath(); c.moveTo(tip.x + jit(), tip.y + jit());
        for (let i = 1; i <= 4; i++) { const q = entre(tip, A, i / 4); c.lineTo(q.x + jit(), q.y + jit()); }
        c.lineTo(m.x, m.y);
        for (let i = 0; i <= 3; i++) { const q = entre(B, tip, i / 4); c.lineTo(q.x + jit(), q.y + jit()); }
        c.closePath();
      };
      c.globalAlpha = 0.8 * fuera; filo(1, 3); c.fillStyle = '#ff4a32'; c.fill(); c.lineWidth = 2; c.strokeStyle = '#5a0a06'; c.stroke();
      c.globalAlpha = 0.95 * fuera; filo(0.68, 1.5); c.fillStyle = '#ffe58a'; c.fill();
      filo(0.4, 0); c.fillStyle = '#ffffff'; c.fill();
      if (Math.random() < 0.6) { const q = mas(cola, k.perp, rand(-w, w)); k.emit({ x: q.x, y: q.y, vx: -k.dir.x * 150, vy: -k.dir.y * 150, life: 260, size: rand(3, 6), sizeEnd: 1, color: pick([ROJO.core, ORO.glow]), shape: 'glow' }); }
    }, { z: 1 });
    await k.esperar(140);
    lineasVelocidad(k, 10, { color: ORO.glow });
    const t0 = k.fx.now;
    await k.embestida({ hasta: 0.95, ida: 170, vuelta: 340, estela: '#ff8a5a' });
    golpe = 140 + (k.fx.now - t0);
    k.add(E.flash({ color: '#ffffff', alpha: 0.5, duration: 220 }));
    await k.impacto(t => {
      k.add(E.starburst({ at: t.center, rays: 12, length: k.s(1.3), width: 4, palette: ORO, duration: 300 }));
      onda(k, t.feet, k.s(1.2), 6, 380);
      E.sparks(k.fx, t.center, { count: 16, speed: [180, 380], palette: ROJO, shape: 'streak' });
      k.add(E.bolt({ from: t.center, to: u.center, palette: ROJO, duration: 280, width: 3, branches: 1, delay: 90 }));
      k.add(E.bloom({ at: u.center, radius: u.size * 0.9, color: ROJO.core, duration: 320, delay: 140 }));
    });
    void k.esperar(140).then(() => k.destello(u.sprite, 180));
    await k.esperar(260);
    await k.despues();
  },

  // Saña (120): se le hincha la vena, se lanza encima y se forma la nube de pelea de los dibujos animados, de la que
  // asoman puños, pies y estrellas durante un buen rato.
  async thrash(k) {
    const u = k.user;
    k.dibujar(300, (c, t) => {
      const p = k.posSprite(u), s = u.size * 0.22 * (t < 0.3 ? easeOut(t / 0.3) * 1.3 : 1.15);
      c.globalAlpha = t > 0.75 ? (1 - t) / 0.25 : 1;
      venaIra(c, p.x + u.size * 0.3, p.y - u.size * 0.5, s);
    }, { z: 1 });
    void k.agitar(u.sprite, 3, 200);
    await k.esperar(200);
    const v = hacia(k, 0.75), dura = 780;
    await k.animar(u.sprite, [{ transform: 'translate(0px, 0px) scale(1, 1)' }, { transform: tf(v, 'scale(1.1, 0.9)') }], 140, 'cubic-bezier(0.5, 0, 0.9, 0.6)');
    const centro = entre(mas(u.center, v), k.target.center, 0.55), R = Math.max(k.s(0.85), Math.hypot(k.target.center.x - u.center.x - v.x, k.target.center.y - u.center.y - v.y) * 0.8);
    k.add(E.dim({ at: centro, duration: dura + 200, strength: 0.3 }));
    nubePelea(k, centro, R, dura);
    for (let i = 0; i < 5; i++) pow(k, mas(centro, polar(rand(0, Math.PI * 2), R * rand(0.6, 0.95))), k.s(rand(0.18, 0.28)), { delay: 120 + i * 120, puntas: 7 });
    void k.stage.shake(4, dura);
    await k.esperar(dura * 0.4);
    await k.impacto(t => { void k.agitar(t.sprite, 3, 400); });
    await k.esperar(dura * 0.45);
    void k.animar(u.sprite, [{ transform: tf(v) }, { transform: 'translate(0px, 0px)' }], 240, 'ease-out');
    k.burst(8, () => { const a = rand(0, Math.PI * 2); return { x: centro.x + Math.cos(a) * R * 0.5, y: centro.y + Math.sin(a) * R * 0.35, vx: Math.cos(a) * 80, vy: Math.sin(a) * 50 - 20, drag: 2, life: 600, size: R * 0.2, sizeEnd: R * 0.4, color: '#e8e0d0', alpha: 0.6, shape: 'smoke' }; });
    await k.despues();
  },

  // Última Baza (140): la vista se oscurece y cuatro orbes de colores (sus otros movimientos) giran alrededor del usuario
  // hasta fundirse en una gran estrella dorada; embiste con ella delante y estalla un arcoíris de estrellas.
  async lastresort(k) {
    const u = k.user, colores = ['#ff5a3a', '#3a9cff', '#5ad84a', '#ffd23a'], orbita = 500;
    k.add(E.dim({ at: u.center, duration: 1300, strength: 0.42 }));
    k.dibujar(orbita, (c, t, engine) => {
      const p = k.posSprite(u), r = u.size * (1.0 - 0.9 * easeIn(t));
      c.globalCompositeOperation = engine.blend;
      colores.forEach((col, i) => {
        const q = k.alrededor(p, r, t * 11 + i * Math.PI / 2, 0.6), s = u.size * 0.3;
        c.drawImage(engine.glow(col), q.x - s, q.y - s, s * 2, s * 2);
        c.drawImage(engine.glow('#ffffff'), q.x - s * 0.35, q.y - s * 0.35, s * 0.7, s * 0.7);
        if (Math.random() < 0.3) k.emit({ x: q.x, y: q.y, life: 260, size: 3, sizeEnd: 0, color: col, shape: 'glow' });
      });
    }, { z: 1 });
    await k.esperar(orbita);
    k.add(E.flash({ color: '#ffffff', alpha: 0.35, duration: 180 }));
    let golpe = false;
    k.dibujar(560, (c, t, engine) => {
      const p = mas(k.posSprite(u), k.dir, u.size * 0.55), s = u.size * 0.5 * (t < 0.2 ? easeOut(t / 0.2) * 1.2 : 1.2 - 0.2 * Math.min(1, (t - 0.2) / 0.2));
      c.globalAlpha = golpe ? Math.max(0, 1 - (t - 0.55) / 0.2) : 1;
      if (c.globalAlpha <= 0) return;
      c.globalCompositeOperation = engine.blend;
      c.drawImage(engine.glow(ORO.glow), p.x - s * 2, p.y - s * 2, s * 4, s * 4);
      c.globalCompositeOperation = 'source-over';
      forma(c, 'estrella', p.x, p.y, s, t * 9, { ...ESTRELLA, brillo: '#ffffff', brilloTam: 14 });
    }, { z: 1 });
    await k.esperar(140);
    await k.embestida({ hasta: 0.9, ida: 170, vuelta: 320, estela: '#ffe27a' });
    golpe = true;
    k.add(E.flash({ color: '#fff6d0', alpha: 0.35, duration: 220 }));
    await k.impacto(t => {
      k.burst(26, i => { const a = rand(0, Math.PI * 2), v = rand(140, 340); return { x: t.center.x, y: t.center.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, drag: 2.2, life: rand(450, 700), size: rand(3.5, 6), color: colores[i % 4], shape: 'star', spin: rand(-8, 8) }; });
      k.add(E.starburst({ at: t.center, rays: 12, length: k.s(1.3), width: 4, palette: ORO, duration: 320 }));
      onda(k, t.feet, k.s(1.3), 6, 420);
    });
    await k.esperar(200);
    await k.despues();
  },

  // Gigaimpacto (150): gran carga; el usuario se envuelve en una esfera de energía morada con remolinos dorados,
  // retrocede y sale disparado como un meteorito: cráter, rocas, destello y anillos; luego se queda agotado.
  async gigaimpact(k) {
    await k.cargaEpica();
    const u = k.user, R = u.size * 0.78, total = 760, v = hacia(k, 0.9), atras = mas({ x: 0, y: 0 }, k.dir, -k.s(0.28));
    k.dibujar(total, (c, t) => {
      const ms = t * total, p = k.posSprite(u), entra = Math.min(1, ms / 150), sale = ms > total - 140 ? (total - ms) / 140 : 1, rr = R * (1 + 0.05 * Math.sin(ms / 40));
      c.globalAlpha = entra * sale;
      const g = c.createRadialGradient(p.x, p.y, rr * 0.2, p.x, p.y, rr);
      g.addColorStop(0, 'rgba(122,60,255,0)'); g.addColorStop(0.65, 'rgba(122,60,255,0.4)'); g.addColorStop(0.9, 'rgba(255,216,74,0.85)'); g.addColorStop(1, 'rgba(255,216,74,0)');
      c.fillStyle = g; c.beginPath(); c.arc(p.x, p.y, rr, 0, Math.PI * 2); c.fill();
      c.lineCap = 'round';
      for (let i = 0; i < 3; i++) { const a = ms / 60 + i * 2.09; c.strokeStyle = i % 2 ? '#ffe27a' : '#c9a0ff'; c.lineWidth = 3; c.beginPath(); c.arc(p.x, p.y, rr * 0.82, a, a + 1.6); c.stroke(); }
      if (Math.random() < 0.7) { const q = mas(p, polar(rand(0, Math.PI * 2), rr * 0.8)); k.emit({ x: q.x, y: q.y, vx: -k.dir.x * 120 + rand(-30, 30), vy: -k.dir.y * 120 + rand(-30, 30), life: 320, size: rand(4, 7), sizeEnd: 1, color: pick(['#9a5cff', '#ffd84a', '#c9a0ff']), shape: 'glow' }); }
    }, { z: 1 });
    await k.esperar(160);
    await k.animar(u.sprite, [{ transform: 'translate(0px, 0px) scale(1, 1)' }, { transform: tf(atras, 'scale(0.9, 1.1)') }], 140, 'ease-out');
    for (let i = 1; i <= 4; i++) k.sombra(u.sprite, entre(atras, v, i / 5), i % 2 ? '#9a5cff' : '#ffd84a', i * 25, 260);
    lineasVelocidad(k, 12, { color: '#ffe27a' });
    await k.animar(u.sprite, [{ transform: tf(atras, 'scale(0.9, 1.1)') }, { transform: tf(v, 'scale(1.2, 0.85)') }], 150, 'cubic-bezier(0.5, 0, 0.9, 0.6)');
    void k.animar(u.sprite, [{ transform: tf(v, 'scale(1.2, 0.85)') }, { transform: tf(mas(v, k.dir, -k.s(0.2)), 'scale(1, 1)'), offset: 0.3 }, { transform: 'translate(0px, 0px) scale(1, 1)' }], 420, 'ease-out');
    k.add(E.flash({ color: '#fff4d0', alpha: 0.7, duration: 320 }));
    void k.stage.shake(8, 500);
    await k.impacto(t => {
      onda(k, t.feet, k.s(2.0), 7, 520, { color: '#ffffff' });
      onda(k, t.feet, k.s(1.5), 6, 460, { color: '#ffd84a', delay: 60 });
      onda(k, t.feet, k.s(1.1), 5, 400, { color: '#c9a0ff', delay: 120 });
      k.add(E.cracks({ at: t.feet, length: k.s(1.1), color: 'rgba(50,30,20,0.8)', duration: 900 }));
      k.add(E.starburst({ at: t.center, rays: 12, length: k.s(1.5), width: 5, palette: ORO, duration: 340 }));
      k.burst(16, () => { const a = -Math.PI / 2 + rand(-1.4, 1.4), vv = rand(160, 340); return { x: t.feet.x + rand(-8, 8), y: t.feet.y, vx: Math.cos(a) * vv, vy: Math.sin(a) * vv, ay: 900, drag: 0.6, life: rand(550, 800), size: rand(4, 8), color: pick(['#a89a86', '#7a6e5e', '#c8bca8']), accent: TINTA, shape: 'rock', spin: rand(-10, 10) }; });
      k.burst(24, () => { const a = rand(0, Math.PI * 2), vv = rand(160, 380); return { x: t.center.x, y: t.center.y, vx: Math.cos(a) * vv, vy: Math.sin(a) * vv, drag: 2.5, life: rand(350, 550), size: rand(4, 8), sizeEnd: 0, color: pick(['#9a5cff', '#ffd84a', '#ffffff']), shape: 'glow' }; });
    });
    await k.esperar(260);
    // Recarga: se queda jadeando.
    sudor(k, u, 4);
    k.burst(4, i => ({ x: u.center.x + rand(-u.size * 0.3, u.size * 0.3), y: u.top.y, vy: -rand(20, 50), life: 600, delay: i * 60, size: u.size * 0.12, sizeEnd: u.size * 0.25, color: '#ffffff', alpha: 0.5, shape: 'smoke' }));
    await k.despues();
  },

  // Hiperrayo (150): gran carga y un rayo naranja enorme con anillos que corren por él; la vista se oscurece, estalla
  // en el objetivo y el usuario queda humeando (recarga).
  async hyperbeam(k) {
    await k.cargaEpica();
    const u = k.user, desde = mas(u.center, k.dir, u.size * 0.35), hasta = k.target.center, dura = 720;
    k.add(E.dim({ at: hasta, duration: dura + 300, strength: 0.5 }));
    k.add(E.beam({ from: desde, to: hasta, width: k.s(0.55), palette: HIPER, duration: dura }));
    k.add(E.beam({ from: desde, to: hasta, width: k.s(0.22), palette: { core: '#fff3b0', glow: '#ffffff', hot: '#ffffff', dark: HIPER.dark }, duration: dura }));
    k.dibujar(dura, (c, t) => {
      const llega = easeOutCubic(Math.min(1, t / 0.25)), fino = t > 0.7 ? 1 - easeIn((t - 0.7) / 0.3) : 1;
      c.lineWidth = 2.5; c.strokeStyle = '#ffe08a';
      for (let i = 0; i < 6; i++) {
        const v = ((i / 6) + t * 2.4) % 1;
        if (v > llega) continue;
        const p = entre(desde, hasta, v);
        c.save(); c.translate(p.x, p.y); c.rotate(k.angle);
        c.globalAlpha = 0.85 * fino * Math.sin(Math.PI * v);
        c.beginPath(); c.ellipse(0, 0, k.s(0.07), k.s(0.42) * fino, 0, 0, Math.PI * 2); c.stroke();
        c.restore();
      }
      for (let i = 0; i < 2; i++) {
        if (Math.random() > 0.8 * fino) continue;
        const p = mas(entre(desde, hasta, rand(0, llega)), k.perp, rand(-1, 1) * k.s(0.3));
        k.emit({ x: p.x, y: p.y, vx: k.dir.x * rand(200, 400), vy: k.dir.y * rand(200, 400), life: rand(160, 260), size: rand(1.5, 2.5), color: pick([HIPER.glow, '#ffffff']), shape: 'streak', stretch: 30 });
      }
    }, { z: 1 });
    void k.animar(u.sprite, [{ transform: 'translate(0px, 0px)' }, { transform: tf(mas({ x: 0, y: 0 }, k.dir, -10)), offset: 0.15 }, { transform: tf(mas(mas({ x: 0, y: 0 }, k.dir, -9), k.perp, 1.5)), offset: 0.5 }, { transform: tf(mas({ x: 0, y: 0 }, k.dir, -10)), offset: 0.8 }, { transform: 'translate(0px, 0px)' }], dura);
    await k.esperar(dura * 0.25 + 40);
    k.add(E.flash({ color: '#fff0c0', alpha: 0.45, duration: 260 }));
    await k.impacto(t => {
      k.add(E.bloom({ at: t.center, radius: k.s(1.6), color: HIPER.glow, duration: 500 }));
      onda(k, t.feet, k.s(1.6), 7, 480, { color: '#ffe08a' });
      k.add(E.ring({ at: t.center, from: 8, to: k.s(1.3), width: 5, color: HIPER.core, duration: 420, delay: 80 }));
      E.sparks(k.fx, t.center, { count: 26, speed: [200, 460], palette: HIPER, shape: 'streak' });
      E.fireBurst(k.stage, t.center, HIPER, t.size * 1.1);
    });
    await k.esperar(dura * 0.45);
    // Recarga: el usuario se queda humeando y apagado.
    void k.animar(u.sprite, [{ opacity: 1 }, { opacity: 0.7, offset: 0.4 }, { opacity: 1 }], 420);
    k.burst(5, i => ({ x: u.center.x + rand(-u.size * 0.3, u.size * 0.3), y: u.top.y + u.size * 0.1, vx: rand(-10, 10), vy: -rand(25, 55), life: 650, delay: i * 50, size: u.size * 0.12, sizeEnd: u.size * 0.28, color: '#8a8278', alpha: 0.45, shape: 'smoke' }));
    await k.despues();
  },

  // Autodestrucción (200): parpadea en rojo como una bomba, cada vez más rápido, y revienta en una bola de fuego con humo
  // negro y cascotes (más sucia y roja que Explosión).
  async selfdestruct(k) {
    const u = k.user, pulsos = [0, 170, 290, 370, 425], tic = 470, R = Math.max(k.dist * 1.25, u.size * 2.4);
    pulsos.forEach((p, i) => {
      k.add(E.bloom({ at: u.center, radius: u.size * (0.7 + i * 0.12), color: '#ff3a2a', duration: 130, delay: p }));
      k.add(E.ring({ at: u.center, from: u.size * 0.3, to: u.size * 0.9, width: 2.5, color: '#ff6a4a', duration: 160, delay: p }));
    });
    void k.animar(u.sprite, [{ transform: 'scale(1, 1)' }, { transform: 'scale(1.05, 1.05)', offset: 0.4 }, { transform: 'scale(1.1, 1.1)', offset: 0.7 }, { transform: 'scale(1.22, 1.18)' }], tic, 'ease-in');
    await k.esperar(tic);
    k.add(E.flash({ color: '#ffb070', alpha: 0.6, duration: 320 }));
    void k.stage.shake(7, 480);
    k.dibujar(800, (c, t) => {
      const r = R * easeOutCubic(Math.min(1, t * 2)), a = 1 - easeIn(t);
      if (r < 1) return;
      c.globalAlpha = a; c.translate(u.center.x, u.center.y); c.scale(1, 0.8);
      const g = c.createRadialGradient(0, 0, 0, 0, 0, r);
      g.addColorStop(0, '#fff6d0'); g.addColorStop(0.25, '#ffb040'); g.addColorStop(0.55, '#ff4a1a'); g.addColorStop(0.8, 'rgba(120,20,10,0.6)'); g.addColorStop(1, 'rgba(40,10,5,0)');
      c.fillStyle = g; c.beginPath(); c.arc(0, 0, r, 0, Math.PI * 2); c.fill();
    }, { z: 0 });
    onda(k, u.feet, R * 1.1, 7, 460, { color: '#ffb070' });
    onda(k, u.feet, R * 0.8, 5, 400, { color: '#ff4a1a', delay: 70 });
    k.burst(18, () => { const a = rand(0, Math.PI * 2), v = rand(180, 380); return { x: u.center.x, y: u.center.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 140, ay: 800, drag: 0.6, life: rand(600, 850), size: rand(3.5, 7), color: pick(['#5a4a3e', '#7a6a5a', '#3a2e26']), accent: '#1a120a', shape: 'rock', spin: rand(-12, 12) }; });
    k.burst(22, () => { const a = rand(0, Math.PI * 2), v = rand(100, 300); return { x: u.center.x, y: u.center.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 60, ay: -200, drag: 2.5, life: rand(350, 600), size: rand(6, 11), sizeEnd: 1, color: pick(['#ff5a1f', '#ffb03a', '#fff1b0']), shape: 'glow' }; });
    k.burst(14, i => ({ x: u.center.x + rand(-R * 0.3, R * 0.3), y: u.center.y + rand(-R * 0.2, R * 0.1), vx: rand(-40, 40), vy: -rand(40, 110), drag: 1, life: rand(900, 1200), delay: 60 + i * 15, size: u.size * 0.3, sizeEnd: u.size * 0.6, color: '#2e2420', alpha: 0.55, shape: 'smoke' }));
    await k.esperar(90);
    void k.animar(u.sprite, [{ transform: 'scale(1.22, 1.18)' }, { transform: 'scale(1, 1)' }], 300);
    await k.impacto(t => {
      E.fireBurst(k.stage, t.center, TYPE_FX.Fire, t.size);
    });
    await k.esperar(320);
    await k.despues();
  },

  // Explosión (250): se hincha y brilla cada vez más blanco mientras la vista se oscurece… y ¡BUM!: un fogonazo blanco
  // que llena la pantalla, anillos de choque, fuego, cascotes y humo por todas partes.
  async explosion(k) {
    const u = k.user, carga = 400, R = Math.max(k.stage.width, k.stage.height) * 0.75;
    k.add(E.dim({ at: u.center, duration: carga + 200, strength: 0.55 }));
    void k.animar(u.sprite, [{ transform: 'scale(1, 1)' }, { transform: 'scale(1.12, 1.12)', offset: 0.4 }, { transform: 'scale(1.08, 1.2)', offset: 0.6 }, { transform: 'scale(1.4, 1.32)' }], carga, 'ease-in');
    k.dibujar(carga, (c, t, engine) => {
      const p = k.posSprite(u), r = u.size * (0.5 + 1.3 * easeIn(t));
      c.globalCompositeOperation = engine.blend;
      c.globalAlpha = 0.55 + 0.45 * Math.abs(Math.sin(t * t * 40));
      c.drawImage(engine.glow('#fff1b0'), p.x - r, p.y - r, r * 2, r * 2);
      c.drawImage(engine.glow('#ffffff'), p.x - r * 0.5, p.y - r * 0.5, r, r);
    }, { z: 1 });
    k.burst(18, i => { const a = rand(0, Math.PI * 2), d = u.size * rand(1.2, 1.8); return { x: u.center.x + Math.cos(a) * d, y: u.center.y + Math.sin(a) * d, vx: -Math.cos(a) * d * 3, vy: -Math.sin(a) * d * 3, life: 300, delay: (i / 18) * (carga - 300), size: rand(2, 3.5), color: pick(['#ffffff', '#fff1b0']), shape: 'streak', stretch: 30 }; });
    await k.esperar(carga);
    // ¡BUM!
    k.add(E.flash({ color: '#ffffff', alpha: 0.95, duration: 450 }));
    void k.stage.shake(12, 650);
    k.dibujar(950, (c, t) => {
      const r = R * easeOutCubic(Math.min(1, t * 1.8)), a = 1 - easeIn(t);
      if (r < 1) return;
      c.globalAlpha = a; c.translate(u.center.x, u.center.y); c.scale(1, 0.8);
      const g = c.createRadialGradient(0, 0, 0, 0, 0, r);
      g.addColorStop(0, '#ffffff'); g.addColorStop(0.3, '#fff3b8'); g.addColorStop(0.55, '#ffb43a'); g.addColorStop(0.8, 'rgba(255,90,30,0.55)'); g.addColorStop(1, 'rgba(255,70,20,0)');
      c.fillStyle = g; c.beginPath(); c.arc(0, 0, r, 0, Math.PI * 2); c.fill();
    }, { z: 0 });
    onda(k, u.feet, R * 0.6, 10, 520, { color: '#fff3c0' });
    onda(k, u.feet, R * 0.85, 7, 620, { color: '#ffffff', delay: 80 });
    onda(k, u.feet, R * 1.05, 5, 720, { color: '#ffb040', delay: 160 });
    k.burst(22, () => { const a = rand(0, Math.PI * 2), v = rand(220, 480); return { x: u.center.x, y: u.center.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 150, ay: 800, drag: 0.5, life: rand(650, 950), size: rand(4, 8), color: pick(['#a89a86', '#7a6e5e', '#5a4e40']), accent: TINTA, shape: 'rock', spin: rand(-12, 12) }; });
    k.burst(30, () => { const a = rand(0, Math.PI * 2), v = rand(150, 420); return { x: u.center.x, y: u.center.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, ay: -150, drag: 2.2, life: rand(400, 700), size: rand(7, 13), sizeEnd: 1, color: pick(['#ffffff', '#fff1b0', '#ffb03a', '#ff5a1f']), shape: 'glow' }; });
    k.burst(14, () => { const a = rand(0, Math.PI * 2), d = R * rand(0.15, 0.5); return { x: u.center.x + Math.cos(a) * d, y: u.center.y + Math.sin(a) * d * 0.7, vx: Math.cos(a) * 50, vy: Math.sin(a) * 30 - rand(20, 60), drag: 1, life: rand(1000, 1300), delay: rand(80, 200), size: u.size * 0.4, sizeEnd: u.size * 0.8, color: '#5a4a40', alpha: 0.5, shape: 'smoke' }; });
    await k.esperar(100);
    await k.impacto(t => {
      E.fireBurst(k.stage, t.center, ORO, t.size * 1.2);
    });
    void k.animar(u.sprite, [{ transform: 'scale(1.4, 1.32)' }, { transform: 'scale(1, 1)' }], 300);
    await k.esperar(330);
    await k.despues();
  },
};
