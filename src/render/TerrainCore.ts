// Cálculo del suelo sin Phaser ni DOM: campos del terreno y color de cada píxel de pantalla.
// Lo usan Terrain (hilo principal: consultas y repintados de zonas pequeñas) y terrain.worker.ts
// (el primer pintado del mapa entero, repartido entre varios hilos). Mismo algoritmo que la maqueta.

import { clamp01, hash, mixc, smin, smooth, vnoiseMemo, type RGB } from '../util';

export const T = 24;
const TEX = 288;
// Colores del suelo. Los de siempre están en PALETA; otro estilo (lab/) pasa los suyos al constructor.
export interface Paleta {
  grassTones: RGB[]; dirtTones: RGB[];                     // manchas lentas de tono (oscura, clara)
  stone: RGB; stoneLight: RGB; crack: RGB; dirtMean: RGB;  // losas del camino
  water: RGB; waterTones: RGB[]; waterShadow: RGB; shoreDark: RGB; shoreLight: RGB;
  sinPared?: boolean;                                      // agua sin la pared de roca pixel art (estilo dibujo)
}
// Mosaico de losas (px de mundo).
const MOS_BIG = 0.85, MOS_R_BIG = [11, 16], MOS_R_SMALL = [3.5, 6], MOS_PACK = 0.78, MOS_GAP = 0;
const MOS_HAIR = 0, MOS_SHADOW = 0.9, MOS_ROUND = 1.6, MOS_SKIP = 0.05, MOS_FILL = 0.5, MOS_SHADOW_A = 0.5;
const MOS_LIGHT = 0.25, MOS_LIGHT_FILL = 0.5, MOS_DIM = 0.1;
// Agua y pared.
export const CLIFF_H = 24;
const CLIFF_SHADOW = 0.5, CLIFF_LAND = 6, CLIFF_GAP = 10, CLIFF_FACING = 0.4;
const SHORE_LINE = 1.5, SHORE_LIP = 1.6, SHORE_LIP_A = 0.7;
export const PALETA: Paleta = {
  grassTones: [[150, 176, 95], [176, 190, 110]], dirtTones: [[186, 168, 112], [216, 196, 141]],
  stone: [218, 200, 146], stoneLight: [234, 219, 170], crack: [166, 144, 98], dirtMean: [196, 178, 122],
  water: [99, 173, 180], waterTones: [[84, 152, 166], [116, 190, 192]], waterShadow: [72, 132, 150], shoreDark: [44, 64, 46], shoreLight: [200, 212, 112],
};

// Riego: oscurecimiento suave (degradado radial desde el centro de la casilla, sin bordes rectos)
// que solo afecta a la tierra. Casillas vecinas regadas se funden en una sola mancha.
// Óvalo (perspectiva 3/4: más ancho que alto) de radios WET_RX × WET_RY px, borde nítido (solo
// el antialias de 1 px de pantalla, sin degradado). WET_DARK: oscurecimiento máximo (tenue).
const WET_RX = 13, WET_RY = 8, WET_DARK = 0.2, WET_TINT: RGB = [-4, -2, 4];
// Centro del óvalo dentro de la casilla: la base visible de la planta (los sprites de Esmeralda
// tienen 1-5 px transparentes bajo el dibujo y apoyan a T - 4), un poco por encima para que la
// planta quede dentro del óvalo y no en su borde.
const WET_CX = T / 2, WET_CY = T - 8;

export interface Seed { x: number; y: number; r: number; order: number; skip: boolean; v: number; light: boolean; ph: number[] }

// Memoria de los campos. Con SharedArrayBuffer (página aislada, ver vite.config.ts) la comparten
// los hilos: cada uno escribe su trozo directamente, sin copias.
export interface Bufs { vert: ArrayBufferLike; spot0: ArrayBufferLike; spot1: ArrayBufferLike; field: ArrayBufferLike; pfield: ArrayBufferLike; wfield: ArrayBufferLike; upd: ArrayBufferLike }
export const compartida = (): boolean => typeof SharedArrayBuffer !== 'undefined' && globalThis.crossOriginIsolated === true;
export const memoria = (bytes: number): ArrayBufferLike => compartida() ? new SharedArrayBuffer(bytes) : new ArrayBuffer(bytes);

export class TerrainCore {
  readonly MW: number; readonly MH: number; readonly W: number; readonly H: number; readonly S: number; readonly SW: number; readonly SH: number;
  readonly VERT: Uint8Array;
  protected SPOT: [Float32Array, Float32Array];
  readonly FIELD: Float32Array; readonly PFIELD: Float32Array; readonly WFIELD: Float32Array; readonly UPD: Float32Array;
  readonly bufs: Bufs;
  protected SEEDS: Seed[] = []; protected SGRID: Seed[][] = []; protected SCELL = 16; protected SGW: number; protected SGH: number;
  protected grass!: Uint8ClampedArray; protected dirt!: Uint8ClampedArray; protected cliff!: Uint8ClampedArray; protected cliffW = 1;
  readonly regadas = new Set<string>();
  readonly paleta: Paleta;
  // Ruido con memoria de celda, uno por sitio (ver vnoiseMemo).
  private readonly nz = Array.from({ length: 9 }, () => vnoiseMemo());

  // Solo reserva memoria (o envuelve la de otro hilo); los campos se calculan con calcularCampos,
  // computeUpd y computeSeeds.
  constructor(mw: number, mh: number, S: number, bufs?: Bufs, paleta: Paleta = PALETA) {
    this.paleta = paleta;
    this.MW = mw; this.MH = mh; this.W = mw * T; this.H = mh * T; this.S = S;
    this.SW = this.W * S; this.SH = this.H * S;
    const { W, H, SW, SH } = this;
    this.bufs = bufs ?? {
      vert: memoria((mw + 1) * (mh + 1)), spot0: memoria(W * H * 4), spot1: memoria(W * H * 4), field: memoria(SW * SH * 4),
      pfield: memoria(W * H * 4), wfield: memoria(SW * SH * 4), upd: memoria(SW * SH * 4),
    };
    this.VERT = new Uint8Array(this.bufs.vert);
    this.SPOT = [new Float32Array(this.bufs.spot0), new Float32Array(this.bufs.spot1)];
    this.FIELD = new Float32Array(this.bufs.field); this.PFIELD = new Float32Array(this.bufs.pfield);
    this.WFIELD = new Float32Array(this.bufs.wfield); this.UPD = new Float32Array(this.bufs.upd);
    this.SGW = Math.ceil(W / this.SCELL); this.SGH = Math.ceil(H / this.SCELL);
  }

  setTexturas(grass: Uint8ClampedArray, dirt: Uint8ClampedArray, cliff: Uint8ClampedArray, cliffW: number): void {
    this.grass = grass; this.dirt = dirt; this.cliff = cliff; this.cliffW = cliffW;
  }

  // Campos que solo dependen de cada punto (filas de mundo [y0, y1), todo el ancho). UPD necesita
  // los de toda la columna: va después, con computeUpd.
  calcularCampos(y0: number, y1: number): void {
    const { W } = this;
    this.computeSpots(y0, y1);
    this.computeField(0, y0, W, y1); this.computePathField(0, y0, W, y1); this.computeWaterRaw(0, y0, W, y1);
  }

  vAt(vx: number, vy: number): number {
    return this.VERT[Math.max(0, Math.min(this.MH, vy)) * (this.MW + 1) + Math.max(0, Math.min(this.MW, vx))];
  }
  // Terreno dominante de una casilla (por sus 4 esquinas): 0 césped, 1 tierra, 2 losas, 3 agua.
  casilla(tx: number, ty: number): number {
    const c = [this.vAt(tx, ty), this.vAt(tx + 1, ty), this.vAt(tx, ty + 1), this.vAt(tx + 1, ty + 1)];
    if (c.some(v => v === 3)) return 3;
    if (c.some(v => v === 2)) return 2;
    if (c.some(v => v === 1)) return 1;
    return 0;
  }
  esCespedPuro(tx: number, ty: number): boolean {
    return [this.vAt(tx, ty), this.vAt(tx + 1, ty), this.vAt(tx, ty + 1), this.vAt(tx + 1, ty + 1)].every(v => v === 0);
  }

  private tone(c: RGB, tones: RGB[], i: number): RGB {
    const a = this.SPOT[0][i], b = this.SPOT[1][i];
    return [0, 1, 2].map(k => c[k] + (tones[0][k] - c[k]) * a * 0.8 + (tones[1][k] - c[k]) * b * 0.6) as RGB;
  }

  // Manchas: dos campos lentos (oscuras y claras).
  private computeSpots(y0: number, y1: number): void {
    const { W, nz } = this;
    for (let y = Math.max(0, y0); y < Math.min(this.H, y1); y++) for (let x = 0; x < W; x++) {
      const n1 = nz[0](x / 40 + 31, y / 40 + 7) * 0.8 + nz[1](x / 13 + 5, y / 13) * 0.2;
      const n2 = nz[2](x / 34 + 91, y / 34 + 47) * 0.8 + nz[3](x / 11 + 3, y / 11 + 9) * 0.2;
      this.SPOT[0][y * W + x] = smooth(0.56, 0.68, n1);
      this.SPOT[1][y * W + x] = smooth(0.6, 0.72, n2) * 0.7;
    }
  }

  private edgeNoise(x: number, y: number): number { return (this.nz[4](x / 12, y / 12) * 0.75 + this.nz[5](x / 5.5, y / 5.5) * 0.25 - 0.5) * 0.75; }

  protected computeField(x0: number, y0: number, x1: number, y1: number): void {
    const { S, SW, SH } = this, isDirt = (v: number) => +(v === 1 || v === 2);
    for (let Y = Math.max(0, y0 * S); Y < Math.min(SH, y1 * S); Y++) for (let X = Math.max(0, x0 * S); X < Math.min(SW, x1 * S); X++) {
      const x = (X + 0.5) / S, y = (Y + 0.5) / S;
      const tx = Math.floor(x / T), ty = Math.floor(y / T), fx = x / T - tx, fy = y / T - ty;
      const a = isDirt(this.vAt(tx, ty)), b = isDirt(this.vAt(tx + 1, ty)), c = isDirt(this.vAt(tx, ty + 1)), d = isDirt(this.vAt(tx + 1, ty + 1));
      this.FIELD[Y * SW + X] = a * (1 - fx) * (1 - fy) + b * fx * (1 - fy) + c * (1 - fx) * fy + d * fx * fy + this.edgeNoise(x, y) - 0.5;
    }
  }
  private computePathField(x0: number, y0: number, x1: number, y1: number): void {
    const { W, H } = this;
    for (let y = Math.max(0, y0); y < Math.min(H, y1); y++) for (let x = Math.max(0, x0); x < Math.min(W, x1); x++) {
      const tx = Math.floor(x / T), ty = Math.floor(y / T), fx = (x + 0.5) / T - tx, fy = (y + 0.5) / T - ty;
      const a = +(this.vAt(tx, ty) === 2), b = +(this.vAt(tx + 1, ty) === 2), c = +(this.vAt(tx, ty + 1) === 2), d = +(this.vAt(tx + 1, ty + 1) === 2);
      this.PFIELD[y * W + x] = a * (1 - fx) * (1 - fy) + b * fx * (1 - fy) + c * (1 - fx) * fy + d * fx * fy + this.edgeNoise(x, y) - 0.5;
    }
  }
  private waterLow(x: number, y: number): number { return (this.nz[6](x / 15 + 50, y / 15 + 20) - 0.5) * 0.4; }
  private waterSmooth(x: number, y: number): number {
    const tx = Math.floor(x / T), ty = Math.floor(y / T), fx = x / T - tx, fy = y / T - ty;
    const a = +(this.vAt(tx, ty) === 3), b = +(this.vAt(tx + 1, ty) === 3), c = +(this.vAt(tx, ty + 1) === 3), d = +(this.vAt(tx + 1, ty + 1) === 3);
    return a * (1 - fx) * (1 - fy) + b * fx * (1 - fy) + c * (1 - fx) * fy + d * fx * fy + this.waterLow(x, y);
  }
  private waterNoise(x: number, y: number): number { return this.waterLow(x, y) + (Math.abs(this.nz[7](x / 7 + 7, y / 7 + 3) * 2 - 1) - 0.5) * 0.12; }
  private computeWaterRaw(x0: number, y0: number, x1: number, y1: number): void {
    const { S, SW, SH, WFIELD } = this;
    const X0 = Math.max(0, x0 * S), X1 = Math.min(SW, x1 * S);
    for (let Y = Math.max(0, y0 * S); Y < Math.min(SH, y1 * S); Y++) for (let X = X0; X < X1; X++) {
      const x = (X + 0.5) / S, y = (Y + 0.5) / S;
      const tx = Math.floor(x / T), ty = Math.floor(y / T), fx = x / T - tx, fy = y / T - ty;
      const a = +(this.vAt(tx, ty) === 3), b = +(this.vAt(tx + 1, ty) === 3), c = +(this.vAt(tx, ty + 1) === 3), d = +(this.vAt(tx + 1, ty + 1) === 3);
      WFIELD[Y * SW + X] = a * (1 - fx) * (1 - fy) + b * fx * (1 - fy) + c * (1 - fx) * fy + d * fx * fy + this.waterNoise(x, y) - 0.5;
    }
  }
  // Distancia (px de pantalla) al borde superior del agua, por columnas [X0, X1): la pared de roca.
  computeUpd(X0: number, X1: number): void {
    const { S, SW, SH, WFIELD, UPD } = this;
    for (let X = Math.max(0, X0); X < Math.min(SW, X1); X++) {
      let edge = -9999;
      for (let Y = 0; Y < SH; Y++) {
        const f = WFIELD[Y * SW + X];
        if (f <= 0) { UPD[Y * SW + X] = 0; continue; }
        if (Y > 0 && WFIELD[(Y - 1) * SW + X] <= 0) {
          const Yl = Y - 1 - CLIFF_LAND * S, fl = WFIELD[(Y - 1) * SW + X];
          const x = (X + 0.5) / S, y = Y / S;
          const gy = this.waterSmooth(x, y + 8) - this.waterSmooth(x, y - 8), gx = this.waterSmooth(x + 8, y) - this.waterSmooth(x - 8, y);
          const down = gy / Math.max(1e-4, Math.hypot(gx, gy)) > CLIFF_FACING;
          edge = down && (Yl < 0 || WFIELD[Yl * SW + X] <= 0) ? Y - 0.5 - fl / (f - fl) : -9999;
        }
        UPD[Y * SW + X] = Y + 0.5 - edge;
      }
    }
  }

  fieldAt(X: number, Y: number): number { return (X < 0 || Y < 0 || X >= this.SW || Y >= this.SH) ? -1 : this.FIELD[Y * this.SW + X]; }
  wfAt(X: number, Y: number): number { return this.WFIELD[Math.max(0, Math.min(this.SH - 1, Y)) * this.SW + Math.max(0, Math.min(this.SW - 1, X))]; }
  // ¿Agua en el punto (x, y) de mundo? (para colisiones)
  esAgua(x: number, y: number): boolean { return this.wfAt(Math.round(x * this.S), Math.round(y * this.S)) > -0.15; }
  // ¿Hay agua cerca de (x, y)? Centro y 8 puntos a distancia r (px de mundo).
  nearWater(x: number, y: number, r: number): boolean {
    const pts: [number, number][] = [[0, 0], ...[0, 1, 2, 3, 4, 5, 6, 7].map(k => [Math.cos(k * 0.785) * r, Math.sin(k * 0.785) * r] as [number, number])];
    return pts.some(([dx, dy]) => this.wfAt(Math.round((x + dx) * this.S), Math.round((y + dy) * this.S)) > -0.3);
  }
  // Casilla arable: solo césped o tierra en sus esquinas (ni agua ni losas).
  esArable(tx: number, ty: number): boolean {
    return [this.vAt(tx, ty), this.vAt(tx + 1, ty), this.vAt(tx, ty + 1), this.vAt(tx + 1, ty + 1)].every(v => v === 0 || v === 1);
  }
  // Casilla de tierra entera (las 4 esquinas tierra): donde se puede sembrar.
  esTierraPura(tx: number, ty: number): boolean {
    return [this.vAt(tx, ty), this.vAt(tx + 1, ty), this.vAt(tx, ty + 1), this.vAt(tx + 1, ty + 1)].every(v => v === 1);
  }
  enCamino(x: number, y: number): boolean { return this.PFIELD[Math.min(this.H - 1, Math.max(0, Math.round(y))) * this.W + Math.min(this.W - 1, Math.max(0, Math.round(x)))] > 0; }

  // ---- Mosaico de losas ----
  private celda(s: Seed): number {
    const { SCELL, SGW, SGH } = this;
    return Math.min(SGH - 1, Math.max(0, Math.floor(s.y / SCELL))) * SGW + Math.min(SGW - 1, Math.max(0, Math.floor(s.x / SCELL)));
  }
  computeSeeds(): void {
    const { W, H, SGW, SGH } = this;
    this.SEEDS = []; this.SGRID = Array.from({ length: SGW * SGH }, () => []);
    const cands: Seed[] = [];
    for (let y = 1; y < H; y += 3) for (let x = 1; x < W; x += 3) if (this.PFIELD[y * W + x] > 0) {
      const big = hash(x * 0.37, y * 0.59) < MOS_BIG, R = big ? MOS_R_BIG : MOS_R_SMALL;
      cands.push({ x: x + hash(x, y * 1.3) * 3 - 1.5, y: y + hash(x * 0.7, y) * 3 - 1.5, r: R[0] + hash(x * 2.1, y) * (R[1] - R[0]),
        order: (big ? 0 : 1) + hash(x * 1.1, y * 2.3), skip: false, v: 1, light: false, ph: [] });
    }
    cands.sort((a, b) => a.order - b.order);
    for (const c of cands) {
      let ok = true;
      this.forNear(c.x, c.y, 2, o => { if (Math.hypot(o.x - c.x, o.y - c.y) < MOS_PACK * (o.r + c.r)) ok = false; });
      if (!ok) continue;
      const k = this.SEEDS.length;
      c.skip = hash(k * 0.13, c.x * 0.01 + c.y) < MOS_SKIP;
      c.v = 1 - MOS_DIM * hash(c.x * 2.7, c.y * 1.9) ** 1.3;
      c.light = hash(c.x * 0.91, c.y * 3.7) < MOS_LIGHT;
      c.ph = [0, 1, 2, 3].map(q => hash(c.x * (q + 1.7), c.y * (q + 0.3)) * 6.283);
      this.SEEDS.push(c);
      this.SGRID[this.celda(c)].push(c);
    }
  }
  // Las piedras calculadas en otro hilo (mismo orden en cada celda que computeSeeds).
  get seeds(): Seed[] { return this.SEEDS; }
  set seeds(lista: Seed[]) {
    this.SEEDS = lista; this.SGRID = Array.from({ length: this.SGW * this.SGH }, () => []);
    for (const c of lista) this.SGRID[this.celda(c)].push(c);
  }
  private forNear(x: number, y: number, rad: number, fn: (o: Seed) => void): void {
    const { SCELL, SGW, SGH } = this, gx = Math.floor(x / SCELL), gy = Math.floor(y / SCELL);
    for (let j = gy - rad; j <= gy + rad; j++) for (let i = gx - rad; i <= gx + rad; i++)
      if (i >= 0 && j >= 0 && i < SGW && j < SGH) for (const o of this.SGRID[j * SGW + i]) fn(o);
  }
  private pathDist(x: number, y: number): number {
    const { W, H, PFIELD } = this;
    const xi = Math.min(W - 2, Math.max(0, Math.floor(x - 0.5))), yi = Math.min(H - 2, Math.max(0, Math.floor(y - 0.5)));
    const fx = Math.min(1, Math.max(0, x - 0.5 - xi)), fy = Math.min(1, Math.max(0, y - 0.5 - yi));
    const a = PFIELD[yi * W + xi], b = PFIELD[yi * W + xi + 1], c = PFIELD[(yi + 1) * W + xi], d = PFIELD[(yi + 1) * W + xi + 1];
    const f = a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
    const g = Math.hypot(b - a + (a - b - c + d) * fy, c - a + (a - b - c + d) * fx);
    return g < 1e-4 ? (f > 0 ? 99 : -99) : f / g;
  }
  private mosaic(base: RGB, x: number, y: number, dirtD: number, tex: RGB): RGB {
    const { S } = this;
    let s1: Seed | null = null, p1 = Infinity;
    const near: [Seed, number][] = [];
    this.forNear(x, y, 3, o => { const p = (o.x - x) ** 2 + (o.y - y) ** 2 - o.r * o.r; near.push([o, p]); if (p < p1) { p1 = p; s1 = o; } });
    if (!s1) return base;
    const s = s1 as Seed;
    if (s.skip) return base;
    let e = s.r * 1.5 - Math.hypot(x - s.x, y - s.y);
    for (const [o, p] of near) if (o !== s) e = smin(e, (p - p1) / (2 * Math.hypot(o.x - s.x, o.y - s.y)), MOS_ROUND);
    e = smin(e, Math.min(dirtD, this.pathDist(x, y)) + MOS_GAP * 0.5, MOS_ROUND);
    if (e < MOS_GAP - 1) return base;
    const th = Math.atan2(y - s.y, x - s.x), ph = s.ph;
    const n1 = 0.5 + 0.5 * Math.sin(2 * th + ph[0]) * Math.sin(3 * th + ph[1]);
    const n2 = 0.5 + 0.5 * Math.sin(th + ph[2]) * Math.cos(2 * th + ph[3]);
    const w = MOS_HAIR * clamp01((n1 - 0.35) / 0.65) + MOS_SHADOW * Math.max(0, Math.sin(th)) ** 1.6 * (0.45 + 0.55 * n2);
    const cStroke = clamp01((e - MOS_GAP) * S + 0.5), cStone = clamp01((e - MOS_GAP - w) * S + 0.5);
    if (cStroke <= 0) return base;
    const P = this.paleta, col = s.light ? P.stoneLight : P.stone, fill = s.light ? MOS_LIGHT_FILL : MOS_FILL, v = s.light ? 1 : s.v;
    const st = [0, 1, 2].map(c => base[c] + (col[c] * v + (tex[c] - P.dirtMean[c]) * 0.6 - base[c]) * fill);
    return [0, 1, 2].map(c => { const l = base[c] + (P.crack[c] - base[c]) * cStroke * MOS_SHADOW_A; return l + (st[c] - l) * cStone; }) as RGB;
  }

  // Centros de las casillas regadas que pueden mojar las casillas [tx0..tx1) × [ty0..ty1).
  mojadas(tx0: number, ty0: number, tx1: number, ty1: number): [number, number][] {
    const wet: [number, number][] = [];
    for (const k of this.regadas) {
      const [tx, ty] = k.split(',').map(Number), cx = tx * T + WET_CX, cy = ty * T + WET_CY;
      if (cx + WET_RX >= tx0 * T && cx - WET_RX <= tx1 * T && cy + WET_RY >= ty0 * T && cy - WET_RY <= ty1 * T) wet.push([cx, cy]);
    }
    return wet;
  }

  // Color de los píxeles de pantalla [X0, X1) × [Y0, Y1) (sin calcomanías), escrito en `out` como
  // RGBA de una imagen de `ow` px de ancho cuyo origen es el píxel (ox, oy).
  pintar(X0: number, Y0: number, X1: number, Y1: number, out: Uint8ClampedArray, ox: number, oy: number, ow: number, wet: [number, number][]): void {
    const { S, SW, W, PFIELD, WFIELD } = this, { grassTones: GRASS_TONES, dirtTones: DIRT_TONES } = this.paleta;
    const gt = this.grass, dt = this.dirt;
    for (let Y = Y0; Y < Y1; Y++) for (let X = X0; X < X1; X++) {
      const x = Math.floor(X / S), y = Math.floor(Y / S), i = y * W + x, j = ((y % TEX) * TEX + (x % TEX)) * 4;
      const f = this.fieldAt(X, Y);
      const gx = this.fieldAt(X + 1, Y) - this.fieldAt(X - 1, Y), gy = this.fieldAt(X, Y + 1) - this.fieldAt(X, Y - 1);
      const dist = f / Math.max(1e-4, Math.hypot(gx, gy) / 2);
      const a = Math.max(0, Math.min(1, dist + 0.5));
      let col: RGB;
      const gcol: RGB = [gt[j], gt[j + 1], gt[j + 2]], dcol: RGB = [dt[j], dt[j + 1], dt[j + 2]];
      if (a <= 0) col = this.tone(gcol, GRASS_TONES, i);
      else if (a >= 1) col = this.tone(dcol, DIRT_TONES, i);
      else { const g = this.tone(gcol, GRASS_TONES, i), d = this.tone(dcol, DIRT_TONES, i); col = mixc(g, d, a); }
      if (a > 0 && wet.length) {
        let m = 0;
        for (const [cx, cy] of wet) {
          const d = Math.hypot(((X + 0.5) / S - cx) / WET_RX, ((Y + 0.5) / S - cy) / WET_RY);
          if (d < 1.5) m = Math.max(m, clamp01((1 - d) * WET_RY * S + 0.5)); // cobertura del píxel de pantalla
        }
        if (m > 0) { const k = m * a; col = [0, 1, 2].map(c => col[c] * (1 - WET_DARK * k) + WET_TINT[c] * k) as RGB; }
      }
      if (a > 0 && PFIELD[i] > -0.3) col = this.mosaic(col, (X + 0.5) / S, (Y + 0.5) / S, dist / S, dcol);
      const wf = WFIELD[Y * SW + X];
      if (wf > -0.6) col = this.water(col, X, Y, i, wf);
      const o = ((Y - oy) * ow + (X - ox)) * 4;
      out[o] = col[0]; out[o + 1] = col[1]; out[o + 2] = col[2]; out[o + 3] = 255;
    }
  }

  // Agua, pared y orilla sobre el color de tierra firme `col`. (X, Y) píxel de pantalla.
  private water(col: RGB, X: number, Y: number, i: number, wf: number): RGB {
    const { S, SW, WFIELD, UPD } = this, { water: WATER, waterTones: WATER_TONES, waterShadow: WATER_SHADOW, shoreDark: SHORE_DARK, shoreLight: SHORE_LIGHT } = this.paleta;
    const gx = this.wfAt(X + 1, Y) - this.wfAt(X - 1, Y), gy = this.wfAt(X, Y + 1) - this.wfAt(X, Y - 1);
    const wd = wf / Math.max(1e-4, Math.hypot(gx, gy) / 2);
    const cLip = clamp01((SHORE_LINE + SHORE_LIP) * S + wd + 0.5), cLine = clamp01(SHORE_LINE * S + wd + 0.5);
    const land = mixc(mixc(col, SHORE_LIGHT, cLip * SHORE_LIP_A), SHORE_DARK, cLine);
    const wa = clamp01(wd + 0.5);
    if (wa <= 0) return land;
    const ch = CLIFF_H * S, u = UPD[Y * SW + X];
    let w: RGB = [0, 1, 2].map(c => WATER[c] + (WATER_TONES[0][c] - WATER[c]) * this.SPOT[0][i] * 0.35 + (WATER_TONES[1][c] - WATER[c]) * this.SPOT[1][i] * 0.4) as RGB;
    if (this.paleta.sinPared) return mixc(land, w, wa);
    const R = 4 * S, shAt = (X2: number) => {
      const q = Y * SW + Math.max(0, Math.min(SW - 1, X2)), u2 = UPD[q];
      if (WFIELD[q] <= 0 || u2 < ch - S) return 0;
      const sh = CLIFF_SHADOW * ch * (0.7 + 0.6 * this.nz[8]((X2 + 0.5) / S / 14 + 9, 3.7));
      return clamp01((sh - (u2 - ch)) / S + 0.5);
    };
    if (u < ch * (1 + CLIFF_SHADOW * 1.3) + S) {
      let sd = 0;
      for (let d = -R; d <= R && sd < 1; d++) sd = Math.max(sd, shAt(X + d) * (1 - Math.abs(d) / (R + 1)));
      w = mixc(w, WATER_SHADOW, sd * 0.8);
    }
    let gapU = -1;
    const GAP = CLIFF_GAP * S;
    if (u >= ch) {
      const solid = (X2: number): [number, number] => {
        const q = Y * SW + Math.max(0, Math.min(SW - 1, X2));
        return WFIELD[q] <= 0 ? [1, 0] : UPD[q] < ch ? [2, UPD[q]] : [0, 0];
      };
      let l: [number, number] = [0, 0], r: [number, number] = [0, 0];
      for (let d = 1; d <= GAP && !l[0]; d++) l = solid(X - d);
      for (let d = 1; d <= GAP && !r[0]; d++) r = solid(X + d);
      if (l[0] && r[0] && (l[0] === 2 || r[0] === 2)) gapU = l[0] === 2 && r[0] === 2 ? Math.max(l[1], r[1]) : l[0] === 2 ? l[1] : r[1];
    }
    if (gapU >= 0) {
      const k = (Math.floor(gapU) * this.cliffW + X % this.cliffW) * 4;
      w = mixc([this.cliff[k], this.cliff[k + 1], this.cliff[k + 2]], SHORE_DARK, clamp01(gapU - (ch - SHORE_LINE * S) + 0.5));
    } else if (u < ch + 1) {
      const k = (Math.min(Math.round(ch) - 1, Math.floor(u)) * this.cliffW + X % this.cliffW) * 4;
      let line = clamp01(u - (ch - SHORE_LINE * S) + 0.5);
      const L = Math.ceil(SHORE_LINE * S);
      for (let d = 1; d <= L; d++) for (const s of [-1, 1]) {
        const at = (X2: number) => Y * SW + Math.max(0, Math.min(SW - 1, X2)), q = at(X + s * d);
        if (!(WFIELD[q] > 0 && UPD[q] >= ch)) continue;
        let closed = false;
        for (let e = d + 1; e <= d + GAP && !closed; e++) { const q2 = at(X + s * e); closed = WFIELD[q2] <= 0 || UPD[q2] < ch; }
        if (!closed) line = Math.max(line, clamp01(SHORE_LINE * S - d + 1));
      }
      const rock = mixc([this.cliff[k], this.cliff[k + 1], this.cliff[k + 2]], SHORE_DARK, line);
      w = mixc(w, rock, clamp01(ch - u + 0.5));
    }
    return mixc(land, w, wa);
  }
}
