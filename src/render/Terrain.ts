// Suelo del valle, portado de docs/art/maqueta-tiles.html (mismo algoritmo, mismo resultado).
// - El terreno se guarda en las esquinas de las casillas de 24 px (VERT): 0 césped, 1 tierra,
//   2 losas, 3 agua.
// - Cada píxel de pantalla decide su material interpolando las 4 esquinas de su casilla + un
//   ruido en coordenadas de mundo (bordes orgánicos). El color sale de texturas recortadas de la
//   referencia (assets/game/cesped_ref.png, tierra_ref.png) con manchas lentas de tono.
// - Losas: mosaico procedural sobre tierra. Agua: color medido + pared de roca (lagos/pared.png)
//   bajo las orillas que miran hacia abajo, sombra y orilla.
// - Calcomanías: matorrales (generados) y flores (flores_nuevas/*.png) solo bien dentro del césped.
// Todo se dibuja a resolución de pantalla (zoom entero S) en un canvas que Phaser muestra a 1/S.

import Phaser from 'phaser';
import type { MapData } from '../data/types';
import { clamp01, hash, mixc, smin, smooth, vnoise, type RGB } from '../util';

export const T = 24;
const TEX = 288;
const GRASS_TONES: RGB[] = [[150, 176, 95], [176, 190, 110]], DIRT_TONES: RGB[] = [[186, 168, 112], [216, 196, 141]];
// Mosaico de losas (px de mundo).
const MOS_BIG = 0.85, MOS_R_BIG = [11, 16], MOS_R_SMALL = [3.5, 6], MOS_PACK = 0.78, MOS_GAP = 0;
const MOS_HAIR = 0, MOS_SHADOW = 0.9, MOS_ROUND = 1.6, MOS_SKIP = 0.05, MOS_FILL = 0.5, MOS_SHADOW_A = 0.5;
const MOS_LIGHT = 0.25, STONE_LIGHT: RGB = [234, 219, 170], MOS_LIGHT_FILL = 0.5, MOS_DIM = 0.1;
const STONE: RGB = [218, 200, 146], CRACK: RGB = [166, 144, 98], DIRT_MEAN: RGB = [196, 178, 122];
// Agua y pared.
const WATER: RGB = [99, 173, 180], WATER_TONES: RGB[] = [[84, 152, 166], [116, 190, 192]], WATER_SHADOW: RGB = [72, 132, 150];
const CLIFF_H = 24, CLIFF_SHADOW = 0.5, CLIFF_LAND = 6, CLIFF_GAP = 10, CLIFF_FACING = 0.4;
const SHORE_LINE = 1.5, SHORE_LIP = 1.6, SHORE_LIP_A = 0.7, SHORE_DARK: RGB = [44, 64, 46], SHORE_LIGHT: RGB = [200, 212, 112];
// Matorral procedural (acordado con el usuario).
const BUSH = {
  groups: [2, 5], perGroup: [2, 3], r: [2.6, 6.2], pack: 0.6, shadow: 0.3, shadowA: 0.9,
  leaf: [[124, 168, 72], [132, 174, 78], [118, 162, 70]] as RGB[], light: [156, 190, 96] as RGB, dark: [72, 112, 50] as RGB,
};

interface Decal { on: boolean; x: number; y: number; r: number; flip: boolean; s: number; img?: HTMLCanvasElement }
interface DecalKind {
  name: string; gen?: boolean; dir?: string; n?: number; px?: number; step: number; prob: number; seed: number;
  alpha: number; margin: number; s: [number, number]; gap: number; list: Decal[]; imgs: HTMLCanvasElement[];
}
export const DECALS: DecalKind[] = [
  { name: 'mata', gen: true, step: 34, prob: 0.4, seed: 7, alpha: 0.5, margin: 0.1, s: [1, 1], gap: 16, list: [], imgs: [] },
  { name: 'flor', dir: 'flores_nuevas', n: 33, px: 0.5, step: 17, prob: 0.6, seed: 0, alpha: 0.75, margin: 0.2, s: [0.85, 1.15], gap: 9, list: [], imgs: [] },
];

// Riego: oscurecimiento suave (degradado radial desde el centro de la casilla, sin bordes rectos)
// que solo afecta a la tierra. Casillas vecinas regadas se funden en una sola mancha.
// Óvalo (perspectiva 3/4: más ancho que alto) de radios WET_RX × WET_RY px, borde nítido (solo
// el antialias de 1 px de pantalla, sin degradado). WET_DARK: oscurecimiento máximo (tenue).
const WET_RX = 13, WET_RY = 8, WET_DARK = 0.2, WET_TINT: RGB = [-4, -2, 4];
// Centro del óvalo dentro de la casilla: la base visible de la planta (los sprites de Esmeralda
// tienen 1-5 px transparentes bajo el dibujo y apoyan a T - 4), un poco por encima para que la
// planta quede dentro del óvalo y no en su borde.
const WET_CX = T / 2, WET_CY = T - 8;

interface Seed { x: number; y: number; r: number; order: number; skip: boolean; v: number; light: boolean; ph: number[] }

// Textura reducida de antemano a `ph` px de alto en pantalla, a mitades (la GPU sin mipmaps
// dentaría los trazos al reducir mucho).
export function screenTex(scene: Phaser.Scene, name: string, ph: number): string {
  const src = scene.textures.get(name).getSourceImage() as HTMLImageElement | HTMLCanvasElement;
  const pw = Math.round(src.width * ph / src.height), key = `${name}_${ph}`;
  if (!scene.textures.exists(key)) {
    let c: HTMLImageElement | HTMLCanvasElement = src, cw = src.width, ch = src.height;
    do {
      cw = Math.max(pw, Math.round(cw / 2)); ch = Math.max(ph, Math.round(ch / 2));
      const n = document.createElement('canvas'); n.width = cw; n.height = ch;
      const g = n.getContext('2d')!; g.imageSmoothingQuality = 'high'; g.drawImage(c, 0, 0, cw, ch); c = n;
    } while (cw > pw || ch > ph);
    scene.textures.addCanvas(key, c as HTMLCanvasElement)!.setFilter(Phaser.Textures.FilterMode.LINEAR);
  }
  return key;
}

function pixels(scene: Phaser.Scene, key: string): Uint8ClampedArray {
  const src = scene.textures.get(key).getSourceImage() as HTMLImageElement | HTMLCanvasElement, c = document.createElement('canvas');
  c.width = src.width; c.height = src.height;
  const g = c.getContext('2d')!; g.drawImage(src, 0, 0);
  return g.getImageData(0, 0, src.width, src.height).data;
}

export class Terrain {
  readonly MW: number; readonly MH: number; readonly W: number; readonly H: number; readonly S: number; readonly SW: number; readonly SH: number;
  readonly VERT: Uint8Array;
  private SPOT: [Float32Array, Float32Array];
  readonly FIELD: Float32Array; readonly PFIELD: Float32Array; readonly WFIELD: Float32Array; readonly UPD: Float32Array;
  private SEEDS: Seed[] = []; private SGRID: Seed[][] = []; private SCELL = 16; private SGW: number; private SGH: number;
  private grass!: Uint8ClampedArray; private dirt!: Uint8ClampedArray; private cliff!: Uint8ClampedArray; private cliffW = 1;
  private canvas!: Phaser.Textures.CanvasTexture; private decalLayer?: HTMLCanvasElement;
  readonly regadas = new Set<string>();

  constructor(map: MapData, S: number) {
    this.MW = map.mw; this.MH = map.mh; this.W = map.mw * T; this.H = map.mh * T; this.S = S;
    this.SW = this.W * S; this.SH = this.H * S;
    this.VERT = new Uint8Array((this.MW + 1) * (this.MH + 1));
    map.vert.forEach((row, vy) => row.forEach((v, vx) => { this.VERT[vy * (this.MW + 1) + vx] = v; }));
    const { W, H, SW, SH } = this;
    // Manchas: dos campos lentos (oscuras y claras).
    this.SPOT = [new Float32Array(W * H), new Float32Array(W * H)];
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const n1 = vnoise(x / 40 + 31, y / 40 + 7) * 0.8 + vnoise(x / 13 + 5, y / 13) * 0.2;
      const n2 = vnoise(x / 34 + 91, y / 34 + 47) * 0.8 + vnoise(x / 11 + 3, y / 11 + 9) * 0.2;
      this.SPOT[0][y * W + x] = smooth(0.56, 0.68, n1);
      this.SPOT[1][y * W + x] = smooth(0.6, 0.72, n2) * 0.7;
    }
    this.FIELD = new Float32Array(SW * SH); this.PFIELD = new Float32Array(W * H);
    this.WFIELD = new Float32Array(SW * SH); this.UPD = new Float32Array(SW * SH);
    this.computeField(0, 0, W, H); this.computePathField(0, 0, W, H); this.computeWaterField(0, 0, W, H);
    this.SGW = Math.ceil(W / this.SCELL); this.SGH = Math.ceil(H / this.SCELL);
    this.computeSeeds();
    this.generarDecals();
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

  private edgeNoise(x: number, y: number): number { return (vnoise(x / 12, y / 12) * 0.75 + vnoise(x / 5.5, y / 5.5) * 0.25 - 0.5) * 0.75; }

  private computeField(x0: number, y0: number, x1: number, y1: number): void {
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
  private waterLow(x: number, y: number): number { return (vnoise(x / 15 + 50, y / 15 + 20) - 0.5) * 0.4; }
  private waterSmooth(x: number, y: number): number {
    const tx = Math.floor(x / T), ty = Math.floor(y / T), fx = x / T - tx, fy = y / T - ty;
    const a = +(this.vAt(tx, ty) === 3), b = +(this.vAt(tx + 1, ty) === 3), c = +(this.vAt(tx, ty + 1) === 3), d = +(this.vAt(tx + 1, ty + 1) === 3);
    return a * (1 - fx) * (1 - fy) + b * fx * (1 - fy) + c * (1 - fx) * fy + d * fx * fy + this.waterLow(x, y);
  }
  private waterNoise(x: number, y: number): number { return this.waterLow(x, y) + (Math.abs(vnoise(x / 7 + 7, y / 7 + 3) * 2 - 1) - 0.5) * 0.12; }
  private computeWaterField(x0: number, y0: number, x1: number, y1: number): void {
    const { S, SW, SH, WFIELD, UPD } = this;
    const X0 = Math.max(0, x0 * S), X1 = Math.min(SW, x1 * S);
    for (let Y = Math.max(0, y0 * S); Y < Math.min(SH, y1 * S); Y++) for (let X = X0; X < X1; X++) {
      const x = (X + 0.5) / S, y = (Y + 0.5) / S;
      const tx = Math.floor(x / T), ty = Math.floor(y / T), fx = x / T - tx, fy = y / T - ty;
      const a = +(this.vAt(tx, ty) === 3), b = +(this.vAt(tx + 1, ty) === 3), c = +(this.vAt(tx, ty + 1) === 3), d = +(this.vAt(tx + 1, ty + 1) === 3);
      WFIELD[Y * SW + X] = a * (1 - fx) * (1 - fy) + b * fx * (1 - fy) + c * (1 - fx) * fy + d * fx * fy + this.waterNoise(x, y) - 0.5;
    }
    for (let X = X0; X < X1; X++) {
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
  // Arar: las esquinas de césped de la casilla pasan a tierra (mancha orgánica, como las de la
  // referencia). Con `redibujar`, recalcula los campos de la zona y la vuelve a pintar.
  arar(tx: number, ty: number, redibujar = true): void {
    for (const [vx, vy] of [[tx, ty], [tx + 1, ty], [tx, ty + 1], [tx + 1, ty + 1]]) {
      if (vx < 0 || vy < 0 || vx > this.MW || vy > this.MH) continue;
      const i = vy * (this.MW + 1) + vx;
      if (this.VERT[i] === 0) this.VERT[i] = 1;
    }
    if (!redibujar) return;
    this.computeField((tx - 2) * T, (ty - 2) * T, (tx + 3) * T, (ty + 3) * T);
    this.redraw(tx - 2, ty - 2, tx + 3, ty + 3);
  }
  // Regar / secar casillas ("tx,ty") y repintar la zona afectada.
  regar(casillas: string[], mojar = true): void {
    for (const k of casillas) { if (mojar) this.regadas.add(k); else this.regadas.delete(k); }
    for (const k of casillas) { const [tx, ty] = k.split(',').map(Number); this.redraw(tx - 1, ty - 1, tx + 2, ty + 2); }
  }
  enCamino(x: number, y: number): boolean { return this.PFIELD[Math.min(this.H - 1, Math.max(0, Math.round(y))) * this.W + Math.min(this.W - 1, Math.max(0, Math.round(x)))] > 0; }

  private generarDecals(): void {
    const { W, H } = this;
    for (const dc of DECALS) {
      dc.list = [];
      const st = dc.step, k = dc.seed;
      for (let y = st / 2; y < H; y += st) for (let x = st / 2; x < W; x += st) {
        const dens = vnoise(x / 55 + 13 + k * 7, y / 55 + 71) * 0.8 + vnoise(x / 17 + 3, y / 17 + 40 + k * 5) * 0.2;
        if (hash(x * 1.7 + k, y * 0.31) >= smooth(0.5, 0.7, dens) * dc.prob) continue;
        dc.list.push({ on: true, x: x + (hash(x, y * 2.1 + k) - 0.5) * st * 0.5, y: y + (hash(x * 3.3 + k, y) - 0.5) * st * 0.5,
          r: hash(x * 0.7, y * 1.9 + k), flip: hash(x * 2.9 + k, y * 0.8) < 0.5, s: dc.s[0] + (dc.s[1] - dc.s[0]) * hash(y + k, x * 1.3) });
      }
    }
  }

  // ---- Mosaico de losas ----
  private computeSeeds(): void {
    const { W, H, SCELL, SGW, SGH } = this;
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
      this.SGRID[Math.min(SGH - 1, Math.max(0, Math.floor(c.y / SCELL))) * SGW + Math.min(SGW - 1, Math.max(0, Math.floor(c.x / SCELL)))].push(c);
    }
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
    const col = s.light ? STONE_LIGHT : STONE, fill = s.light ? MOS_LIGHT_FILL : MOS_FILL, v = s.light ? 1 : s.v;
    const st = [0, 1, 2].map(c => base[c] + (col[c] * v + (tex[c] - DIRT_MEAN[c]) * 0.6 - base[c]) * fill);
    return [0, 1, 2].map(c => { const l = base[c] + (CRACK[c] - base[c]) * cStroke * MOS_SHADOW_A; return l + (st[c] - l) * cStone; }) as RGB;
  }

  // ---- Carga de texturas (llamar en preload de la escena) ----
  static preload(scene: Phaser.Scene, A: string): void {
    scene.load.image('g0', `${A}game/cesped_ref.png`);
    scene.load.image('d0', `${A}game/tierra_ref.png`);
    scene.load.image('pared', `${A}game/lagos/pared.png`);
    for (const dc of DECALS) if (!dc.gen) for (let i = 0; i < dc.n!; i++) scene.load.image(`${dc.name}${i}`, `${A}game/${dc.dir}/${dc.name}_${i}.png`);
  }

  // Crea el canvas del suelo y lo pinta entero. Devuelve la imagen de Phaser.
  build(scene: Phaser.Scene): Phaser.GameObjects.Image {
    const { S, SW, SH, W } = this;
    this.grass = pixels(scene, 'g0'); this.dirt = pixels(scene, 'd0');
    const ck = screenTex(scene, 'pared', CLIFF_H * S);
    this.cliff = pixels(scene, ck); this.cliffW = (scene.textures.get(ck).getSourceImage() as HTMLCanvasElement).width;
    for (const dc of DECALS) {
      dc.imgs = [];
      if (!dc.gen) for (let i = 0; i < dc.n!; i++) for (const flip of [false, true]) {
        const src = scene.textures.get(dc.name + i).getSourceImage() as HTMLImageElement, k = dc.px! * W / 1024 * S;
        const c = document.createElement('canvas'); c.width = Math.round(src.width * k); c.height = Math.round(src.height * k);
        const g = c.getContext('2d')!; g.imageSmoothingQuality = 'high';
        if (flip) { g.translate(c.width, 0); g.scale(-1, 1); }
        g.drawImage(src, 0, 0, c.width, c.height);
        dc.imgs[i * 2 + (flip ? 1 : 0)] = c;
      }
    }
    // Al volver a entrar en la escena (título → continuar) la textura anterior sigue registrada.
    if (scene.textures.exists('ground')) scene.textures.remove('ground');
    this.canvas = scene.textures.createCanvas('ground', SW, SH)!;
    const img = scene.add.image(0, 0, 'ground').setOrigin(0).setScale(1 / S).setDepth(-10000);
    this.redraw(0, 0, this.MW, this.MH);
    return img;
  }

  // Redibuja las casillas [tx0..tx1) × [ty0..ty1) a resolución de pantalla.
  redraw(tx0: number, ty0: number, tx1: number, ty1: number): void {
    const { S, SW, SH, W, PFIELD, WFIELD } = this;
    const X0 = Math.max(0, tx0 * T * S), Y0 = Math.max(0, ty0 * T * S), X1 = Math.min(SW, tx1 * T * S), Y1 = Math.min(SH, ty1 * T * S);
    const ctx = this.canvas.getContext(), img = ctx.getImageData(X0, Y0, X1 - X0, Y1 - Y0), out = img.data;
    const gt = this.grass, dt = this.dirt;
    // Centros de las casillas regadas que pueden mojar esta zona.
    const wet: [number, number][] = [];
    for (const k of this.regadas) {
      const [tx, ty] = k.split(',').map(Number), cx = tx * T + WET_CX, cy = ty * T + WET_CY;
      if (cx + WET_RX >= tx0 * T && cx - WET_RX <= tx1 * T && cy + WET_RY >= ty0 * T && cy - WET_RY <= ty1 * T) wet.push([cx, cy]);
    }
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
      const o = ((Y - Y0) * (X1 - X0) + (X - X0)) * 4;
      out[o] = col[0]; out[o + 1] = col[1]; out[o + 2] = col[2]; out[o + 3] = 255;
    }
    ctx.putImageData(img, X0, Y0);
    // Calcomanías, solo bien dentro del césped, cada tipo en su capa opaca con su opacidad.
    const layer = this.decalLayer ??= Object.assign(document.createElement('canvas'), { width: SW, height: SH });
    const lc = layer.getContext('2d')!;
    ctx.save(); ctx.beginPath(); ctx.rect(X0, Y0, X1 - X0, Y1 - Y0); ctx.clip();
    for (const dc of DECALS) {
      lc.clearRect(X0, Y0, X1 - X0, Y1 - Y0);
      lc.save(); lc.beginPath(); lc.rect(X0, Y0, X1 - X0, Y1 - Y0); lc.clip();
      for (const f of dc.list.filter(f => f.on).sort((a, b) => a.y - b.y)) {
        const im = dc.gen ? (f.img ??= this.makeBush(f.r)) : dc.imgs[Math.floor(f.r * dc.n!) * 2 + (f.flip ? 1 : 0)], w = im.width * f.s, h = im.height * f.s;
        const cx = f.x * S, cy = f.y * S;
        if (cx + w / 2 < X0 || cx - w / 2 > X1 || cy + h / 2 < Y0 || cy - h / 2 > Y1) continue;
        const pts = [[0, 0], [-w / 2, 0], [w / 2, 0], [0, -h / 2], [0, h / 2]];
        if (pts.some(([dx, dy]) => this.fieldAt(Math.round(cx + dx), Math.round(cy + dy)) > -dc.margin
          || this.wfAt(Math.round(cx + dx), Math.round(cy + dy)) > -dc.margin)) continue;
        lc.drawImage(im, cx - w / 2, cy - h / 2, w, h);
      }
      lc.restore();
      ctx.globalAlpha = dc.alpha;
      ctx.drawImage(layer, X0, Y0, X1 - X0, Y1 - Y0, X0, Y0, X1 - X0, Y1 - Y0);
    }
    ctx.restore();
    this.canvas.refresh();
  }

  // Un matorral (BUSH) dibujado a resolución de pantalla; seed en [0, 1).
  private makeBush(seed: number): HTMLCanvasElement {
    const { S } = this;
    let n = 0;
    const rnd = () => hash(seed * 917.3 + n * 1.618, ++n * 7.31 + seed * 31.7);
    const uni = (a: number, b: number) => a + (b - a) * rnd(), int = (a: number, b: number) => a + Math.floor(rnd() * (b - a + 1));
    const leaves: { x: number; y: number; r: number; c: RGB }[] = [];
    let cx = 0, cy = 0;
    const groups = int(BUSH.groups[0], BUSH.groups[1]);
    for (let g = 0; g < groups; g++) {
      if (g) {
        const l = leaves[Math.floor(rnd() * leaves.length)], ang = uni(0, 6.283), d = uni(0.9, 1.5) * BUSH.r[1];
        cx = l.x + Math.cos(ang) * d * 1.3; cy = l.y + Math.sin(ang) * d * 0.7;
      }
      let want = int(BUSH.perGroup[0], BUSH.perGroup[1]);
      for (let t = 0; want && t < 60; t++) {
        const r = uni(BUSH.r[0], BUSH.r[1]), x = cx + uni(-1, 1) * r * 1.1, y = cy + uni(-0.6, 0.6) * r;
        if (leaves.some(o => Math.hypot(x - o.x, y - o.y) < BUSH.pack * (r + o.r))) continue;
        leaves.push({ x, y, r, c: BUSH.leaf[int(0, BUSH.leaf.length - 1)] }); want--;
      }
      if (!leaves.length) leaves.push({ x: 0, y: 0, r: BUSH.r[1], c: BUSH.leaf[0] });
    }
    const pad = BUSH.r[1] * (1 + BUSH.shadow) + 2;
    const x0 = Math.min(...leaves.map(l => l.x - l.r)) - pad, y0 = Math.min(...leaves.map(l => l.y - l.r)) - pad;
    const x1 = Math.max(...leaves.map(l => l.x + l.r)) + pad, y1 = Math.max(...leaves.map(l => l.y + l.r)) + pad;
    const c = document.createElement('canvas'); c.width = Math.ceil((x1 - x0) * S); c.height = Math.ceil((y1 - y0) * S);
    const g = c.getContext('2d')!, rgb = (v: RGB) => `rgb(${v[0]},${v[1]},${v[2]})`;
    g.scale(S, S); g.translate(-x0, -y0);
    leaves.sort((a, b) => a.y - b.y);
    for (const l of leaves) {
      g.globalAlpha = BUSH.shadowA; g.fillStyle = rgb(BUSH.dark);
      g.beginPath(); g.arc(l.x, l.y + l.r * BUSH.shadow, l.r * (1 + BUSH.shadow * 0.35), 0, 6.2832); g.fill();
      g.globalAlpha = 1;
      const grad = g.createLinearGradient(0, l.y - l.r, 0, l.y + l.r * 0.2);
      grad.addColorStop(0, rgb(l.c.map((v, k) => v + (BUSH.light[k] - v) * 0.35) as RGB)); grad.addColorStop(1, rgb(l.c));
      g.fillStyle = grad; g.beginPath(); g.arc(l.x, l.y, l.r, 0, 6.2832); g.fill();
    }
    return c;
  }

  // Agua, pared y orilla sobre el color de tierra firme `col`. (X, Y) píxel de pantalla.
  private water(col: RGB, X: number, Y: number, i: number, wf: number): RGB {
    const { S, SW, WFIELD, UPD } = this;
    const gx = this.wfAt(X + 1, Y) - this.wfAt(X - 1, Y), gy = this.wfAt(X, Y + 1) - this.wfAt(X, Y - 1);
    const wd = wf / Math.max(1e-4, Math.hypot(gx, gy) / 2);
    const cLip = clamp01((SHORE_LINE + SHORE_LIP) * S + wd + 0.5), cLine = clamp01(SHORE_LINE * S + wd + 0.5);
    const land = mixc(mixc(col, SHORE_LIGHT, cLip * SHORE_LIP_A), SHORE_DARK, cLine);
    const wa = clamp01(wd + 0.5);
    if (wa <= 0) return land;
    const ch = CLIFF_H * S, u = UPD[Y * SW + X];
    let w: RGB = [0, 1, 2].map(c => WATER[c] + (WATER_TONES[0][c] - WATER[c]) * this.SPOT[0][i] * 0.35 + (WATER_TONES[1][c] - WATER[c]) * this.SPOT[1][i] * 0.4) as RGB;
    const R = 4 * S, shAt = (X2: number) => {
      const q = Y * SW + Math.max(0, Math.min(SW - 1, X2)), u2 = UPD[q];
      if (WFIELD[q] <= 0 || u2 < ch - S) return 0;
      const sh = CLIFF_SHADOW * ch * (0.7 + 0.6 * vnoise((X2 + 0.5) / S / 14 + 9, 3.7));
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
