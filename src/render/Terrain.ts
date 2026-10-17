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
// El cálculo por píxel está en TerrainCore.ts; el primer pintado del mapa entero se reparte entre
// varios hilos (terrain.worker.ts) y aquí quedan las texturas, el canvas y las calcomanías.

import Phaser from 'phaser';
import type { MapData } from '../data/types';
import { hash, smooth, vnoise, type RGB } from '../util';
import { CLIFF_H, T, TerrainCore, compartida, type Paleta } from './TerrainCore';

export { T };

// Otro estilo de suelo (lab/): paleta, texturas de césped/tierra y si lleva calcomanías (matas y
// flores del valle). Sin opciones, el suelo de siempre.
// claves: texturas ya cargadas con otras claves que 'g0'/'d0' (zonas de bioma del modo aventura, data/biomas.ts).
export interface OpcionesSuelo { paleta?: Paleta; cesped?: string; tierra?: string; decals?: boolean; claves?: { cesped: string; tierra: string } }

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

// Textura reducida de antemano a `ph` px de alto en pantalla, a mitades (la GPU sin mipmaps
// dentaría los trazos al reducir mucho).
// Reduce la textura `name` al alto `ph` en pantalla (por mitades, con suavizado) y la cachea como `${name}_${ph}`.
// Si hay un mapa de normales `${name}_nrm` (tools/normales_elementos.py), se reduce igual y se cuelga como dataSource
// de la textura: así Aventura/WorldScene le ponen el pipeline «Cel» y la luz le da volumen. Con `flip` (el elemento va
// con setFlipX) la X de la normal se invierte (rojo = 255 - rojo), porque el pipeline de luz de Phaser no voltea las
// normales; sale una textura aparte (`_f`), con la misma imagen.
export function screenTex(scene: Phaser.Scene, name: string, ph: number, flip = false): string {
  const src = scene.textures.get(name).getSourceImage() as HTMLImageElement | HTMLCanvasElement;
  const nrm = scene.textures.exists(name + '_nrm') ? scene.textures.get(name + '_nrm').getSourceImage() as HTMLImageElement | HTMLCanvasElement : null;
  const pw = Math.round(src.width * ph / src.height), key = `${name}_${ph}${nrm && flip ? '_f' : ''}`;
  if (!scene.textures.exists(key)) {
    const tex = scene.textures.addCanvas(key, reducir(src, pw, ph))!;
    tex.setFilter(Phaser.Textures.FilterMode.LINEAR);
    if (nrm) {
      const n = reducir(nrm, pw, ph);
      if (flip) {
        const g = n.getContext('2d')!, d = g.getImageData(0, 0, n.width, n.height);
        for (let i = 0; i < d.data.length; i += 4) d.data[i] = 255 - d.data[i];
        g.putImageData(d, 0, 0);
      }
      tex.setDataSource(n);
    }
  }
  return key;
}
function reducir(src: HTMLImageElement | HTMLCanvasElement, pw: number, ph: number): HTMLCanvasElement {
  let c: HTMLImageElement | HTMLCanvasElement = src, cw = src.width, ch = src.height;
  do {
    cw = Math.max(pw, Math.round(cw / 2)); ch = Math.max(ph, Math.round(ch / 2));
    const n = document.createElement('canvas'); n.width = cw; n.height = ch;
    const g = n.getContext('2d')!; g.imageSmoothingQuality = 'high'; g.drawImage(c, 0, 0, cw, ch); c = n;
  } while (cw > pw || ch > ph);
  return c as HTMLCanvasElement;
}

function pixels(scene: Phaser.Scene, key: string): Uint8ClampedArray {
  const src = scene.textures.get(key).getSourceImage() as HTMLImageElement | HTMLCanvasElement, c = document.createElement('canvas');
  c.width = src.width; c.height = src.height;
  const g = c.getContext('2d')!; g.drawImage(src, 0, 0);
  return g.getImageData(0, 0, src.width, src.height).data;
}

// ---- Hilos de cálculo ----
// Solo con memoria compartida (la página tiene que estar aislada: cabeceras COOP/COEP de
// vite.config.ts). Si no, o si un hilo falla, se calcula todo en este hilo (más lento, mismo
// resultado). Se crean una vez y se reutilizan; cada uno atiende sus mensajes en orden.
let hilos: Worker[] | null = null, sinHilos = false, cadena: Promise<unknown> = Promise.resolve();
const crearHilos = (): Worker[] => hilos ??= Array.from({ length: Math.max(1, Math.min(12, (navigator.hardwareConcurrency || 4) - 1)) },
  () => new Worker(new URL('./terrain.worker.ts', import.meta.url), { type: 'module' }));
const pedir = (w: Worker, msg: object): Promise<void> => new Promise((ok, mal) => {
  w.onmessage = () => ok(); w.onerror = e => mal(e); w.postMessage(msg);
});
const difundir = (msg: object): Promise<unknown> => Promise.all(crearHilos().map(w => pedir(w, msg)));
// Cola de trabajos: cada hilo coge el siguiente al terminar el suyo.
async function repartir(trabajos: object[]): Promise<void> {
  await Promise.all(crearHilos().map(async w => { for (let t = trabajos.shift(); t; t = trabajos.shift()) await pedir(w, t); }));
}
// [a, b) en trozos de `paso`.
const trozos = (n: number, paso: number, tipo: string) => Array.from({ length: Math.ceil(n / paso) }, (_, i) => ({ tipo, a: i * paso, b: Math.min(n, (i + 1) * paso) }));

export class Terrain extends TerrainCore {
  private canvas!: Phaser.Textures.CanvasTexture; private decalLayer?: HTMLCanvasElement;
  private pix?: Uint8ClampedArray;   // primer pintado, hasta que build lo pasa al canvas

  // Solo prepara el mapa; los campos y el primer pintado los hace calcular().
  private readonly conDecals: boolean;
  private readonly claves: { cesped: string; tierra: string };
  constructor(map: MapData, S: number, opciones: OpcionesSuelo = {}) {
    super(map.mw, map.mh, S, undefined, opciones.paleta);
    this.conDecals = opciones.decals ?? true;
    this.claves = opciones.claves ?? { cesped: 'g0', tierra: 'd0' };
    map.vert.forEach((row, vy) => row.forEach((v, vx) => { this.VERT[vy * (this.MW + 1) + vx] = v; }));
    if (this.conDecals) this.generarDecals();
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

  // ---- Carga de texturas (llamar en preload de la escena) ----
  static preload(scene: Phaser.Scene, A: string, opciones: OpcionesSuelo = {}): void {
    scene.load.image('g0', opciones.cesped ?? `${A}game/cesped_ref.png`);
    scene.load.image('d0', opciones.tierra ?? `${A}game/tierra_ref.png`);
    scene.load.image('pared', `${A}game/lagos/pared.png`);
    if (opciones.decals ?? true) for (const dc of DECALS) if (!dc.gen) for (let i = 0; i < dc.n!; i++) scene.load.image(`${dc.name}${i}`, `${A}game/${dc.dir}/${dc.name}_${i}.png`);
  }

  // Texturas del suelo y de las calcomanías a resolución de pantalla.
  private texturas(scene: Phaser.Scene): void {
    const { S, W } = this;
    const ck = screenTex(scene, 'pared', CLIFF_H * S);
    this.setTexturas(pixels(scene, this.claves.cesped), pixels(scene, this.claves.tierra), pixels(scene, ck), (scene.textures.get(ck).getSourceImage() as HTMLCanvasElement).width);
    if (!this.conDecals) return;
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
  }

  // Campos del terreno y primer pintado del mapa entero (con la tierra arada y las casillas
  // regadas que haya ya). Es lo que más tarda al entrar al mundo: va repartido entre hilos.
  async calcular(scene: Phaser.Scene): Promise<void> {
    const t0 = performance.now(), listo = (como: string) => console.info(`Suelo listo en ${Math.round(performance.now() - t0)} ms (${como}, zoom ${this.S})`);
    this.texturas(scene);
    if (compartida() && !sinHilos) {
      const turno = cadena.then(() => this.calcularEnHilos());   // un suelo a la vez en los hilos
      cadena = turno.catch(() => undefined);
      try { await turno; listo(`${hilos!.length} hilos`); return; } catch (e) {
        console.warn('Suelo: los hilos fallaron, se calcula en el principal', e);
        sinHilos = true; hilos?.forEach(w => w.terminate()); hilos = null;
      }
    }
    const { H, SW, SH, MW, MH } = this;
    this.calcularCampos(0, H); this.computeUpd(0, SW); this.computeSeeds();
    this.pix = new Uint8ClampedArray(SW * SH * 4);
    this.pintar(0, 0, SW, SH, this.pix, 0, 0, SW, this.mojadas(0, 0, MW, MH));
    listo('1 hilo');
  }

  private async calcularEnHilos(): Promise<void> {
    const { H, S, SW, SH, MW, MH } = this, out = new SharedArrayBuffer(SW * SH * 4);
    await difundir({ tipo: 'init', mw: MW, mh: MH, S, bufs: this.bufs, paleta: this.paleta });
    await repartir(trozos(H, 8, 'campos'));
    await repartir(trozos(SW, 64, 'upd'));
    this.computeSeeds();   // rápido, pero en orden: aquí
    await difundir({ tipo: 'pintura', seeds: this.seeds, wet: this.mojadas(0, 0, MW, MH), grass: this.grass, dirt: this.dirt, cliff: this.cliff, cliffW: this.cliffW, out });
    await repartir(trozos(SH, 8 * S, 'pintar'));
    // ImageData no admite memoria compartida: copia normal.
    this.pix = new Uint8ClampedArray(out.byteLength); this.pix.set(new Uint8ClampedArray(out));
  }

  // Crea el canvas del suelo con lo pintado en calcular(). Devuelve la imagen de Phaser.
  build(scene: Phaser.Scene): Phaser.GameObjects.Image {
    const { SW, SH } = this;
    // Al volver a entrar en la escena (título → continuar) la textura anterior sigue registrada.
    if (scene.textures.exists('ground')) scene.textures.remove('ground');
    this.canvas = scene.textures.createCanvas('ground', SW, SH)!;
    const img = scene.add.image(0, 0, 'ground').setOrigin(0).setScale(1 / this.S).setDepth(-10000);
    if (this.pix) {
      this.canvas.getContext().putImageData(new ImageData(this.pix as Uint8ClampedArray<ArrayBuffer>, SW, SH), 0, 0);
      this.pix = undefined;
      this.pintarDecals(0, 0, SW, SH);
      this.canvas.refresh();
    } else this.redraw(0, 0, this.MW, this.MH);
    return img;
  }

  // Redibuja las casillas [tx0..tx1) × [ty0..ty1) a resolución de pantalla.
  redraw(tx0: number, ty0: number, tx1: number, ty1: number): void {
    const { S, SW, SH } = this;
    const X0 = Math.max(0, tx0 * T * S), Y0 = Math.max(0, ty0 * T * S), X1 = Math.min(SW, tx1 * T * S), Y1 = Math.min(SH, ty1 * T * S);
    const ctx = this.canvas.getContext(), img = ctx.getImageData(X0, Y0, X1 - X0, Y1 - Y0);
    this.pintar(X0, Y0, X1, Y1, img.data, X0, Y0, X1 - X0, this.mojadas(tx0, ty0, tx1, ty1));
    ctx.putImageData(img, X0, Y0);
    this.pintarDecals(X0, Y0, X1, Y1);
    this.canvas.refresh();
  }

  // Calcomanías, solo bien dentro del césped, cada tipo en su capa opaca con su opacidad.
  private pintarDecals(X0: number, Y0: number, X1: number, Y1: number): void {
    if (!this.conDecals) return;
    const { S, SW, SH } = this, ctx = this.canvas.getContext();
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
}
