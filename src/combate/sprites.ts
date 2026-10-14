// Hojas PMD (SpriteCollab) de los Pokémon del modo aventura, cargadas al entrar en cada mapa (solo las formas que
// salen en él). Clave de cada forma: `a-<dex>`; animaciones `a-<dex>-<Anim>-<fila>` (fila = dirección, config.ts).
// Lo que se usa en combate: andar, quieto (su Idle en bucle), golpe (Attack), disparo (Shoot), concentrarse (Charge),
// recibir (Hurt), debilitarse (Faint) y dormir. Las que una especie no tiene caen en otra (CopyOf del AnimData o la
// lista de RESERVA). Con mapa de normales (tools/normales_pokemon.py) se cargan -Luz + -Normal para el pipeline Cel.
// Shiny: el id lleva una `s` detrás (`0001s`); se cargan sus hojas shiny de SpriteCollab (`<dex>/shiny/`, de
// tools/shiny_paletas.py) o, si falta alguna, la normal recoloreada con su paleta (src/data/gen/shiny.json). Con mapa
// de normales, el mismo de la normal (la silueta es igual) y el contorno se tiñe aquí como en la -Luz.
/// <reference types="vite/client" />
import Phaser from 'phaser';
import { A } from '../config';
import SHINY from '../data/gen/shiny.json';

export const ANIMS = ['Walk', 'Idle', 'Attack', 'Shoot', 'Charge', 'Hurt', 'Faint', 'Sleep'] as const;
export type AnimId = (typeof ANIMS)[number];
const RESERVA: Record<AnimId, AnimId[]> = {
  Walk: ['Idle'], Idle: ['Walk'], Attack: ['Shoot', 'Charge', 'Idle'], Shoot: ['Charge', 'Attack', 'Idle'], Charge: ['Shoot', 'Attack', 'Idle'],
  Hurt: ['Idle'], Faint: ['Hurt', 'Sleep', 'Idle'], Sleep: ['Idle'],
};
const NORMALES = new Set(Object.keys(import.meta.glob('/assets/sprites/pokemon/*/*-Normal.png')).map(r => r.replace(/^.*pokemon\//, '').replace('-Normal.png', '')));

export interface InfoAnim { hoja: string; fw: number; fh: number; durs: number[]; golpe: number } // golpe: ms hasta HitFrame
export type Hojas = Partial<Record<AnimId, InfoAnim>>;
const INFO = new Map<string, Hojas>();
export const clave = (dex: string) => `a-${dex}`;
// Id de sprite de una forma: con `s` si es shiny. `base` quita la `s` (la carpeta de sus hojas).
export const idSprite = (dex: string, shiny?: boolean) => shiny ? `${dex}s` : dex;
export const esShiny = (id: string) => id.endsWith('s');
const base = (id: string) => id.replace(/s$/, '');
export const info = (dex: string): Hojas => INFO.get(dex) ?? {};

// Dónde tiene los pies cada especie, medido en su sprite. Los fotogramas PMD van centrados en el cuerpo y los pies
// caen unos px por debajo del centro, igual en todas sus animaciones (aunque cada hoja tenga otro tamaño de
// fotograma). Con un origen fijo (0,72) Pikachu flotaba sobre su sombra y daba un salto al cambiar de animación.
export interface Ancla { pie: number; alto: number; ancho: number }   // px: pies − centro del fotograma; cuerpo
const ANCLA = new Map<string, Ancla>();
export const ancla = (dex: string): Ancla => ANCLA.get(dex) ?? { pie: 6, alto: 24, ancho: 20 };
function medir(scene: Phaser.Scene, dex: string): void {
  const a = INFO.get(dex)?.Idle, key = a && `${clave(dex)}-${a.hoja}`;
  if (!a || !key || !scene.textures.exists(key)) return;
  const tex = scene.textures.get(key), fr = tex.get(0), c = document.createElement('canvas');
  c.width = fr.width; c.height = fr.height;
  const g = c.getContext('2d', { willReadFrequently: true })!;
  g.drawImage(tex.getSourceImage() as CanvasImageSource, fr.cutX, fr.cutY, fr.width, fr.height, 0, 0, fr.width, fr.height);
  const d = g.getImageData(0, 0, fr.width, fr.height).data;
  let top = -1, bot = -1, l = fr.width, r = -1;
  for (let y = 0; y < fr.height; y++) for (let x = 0; x < fr.width; x++) {
    if (d[(y * fr.width + x) * 4 + 3] < 40) continue;
    if (top < 0) top = y;
    bot = y; l = Math.min(l, x); r = Math.max(r, x);
  }
  if (bot >= 0) ANCLA.set(dex, { pie: bot + 1 - fr.height / 2, alto: bot + 1 - top, ancho: r + 1 - l });
}
// Pone una animación (`<anim>-<fila>`) con el origen en los pies de la especie.
export function poner(spr: Phaser.GameObjects.Sprite, dex: string, anim: AnimId, fila: number, opciones: { startFrame?: number } = {}): boolean {
  const key = `${clave(dex)}-${anim}-${fila}`, h = INFO.get(dex)?.[anim];
  if (!h || !spr.scene.anims.exists(key)) return false;
  spr.play({ key, startFrame: opciones.startFrame ?? 0 }, true);
  spr.setOrigin(0.5, (h.fh / 2 + ancla(dex).pie) / h.fh);
  return true;
}

function leer(xml: XMLDocument): Hojas {
  const crudas = new Map<string, Element>();
  for (const a of Array.from(xml.querySelectorAll('Anim'))) crudas.set(a.querySelector('Name')!.textContent!, a);
  const datos = (nombre: string, n = 0): InfoAnim | null => {
    const a = crudas.get(nombre);
    if (!a || n > 3) return null;
    const copia = a.querySelector('CopyOf')?.textContent;
    if (copia) return datos(copia, n + 1);
    const fw = a.querySelector('FrameWidth'), fh = a.querySelector('FrameHeight');
    if (!fw || !fh) return null;
    const durs = Array.from(a.querySelectorAll('Duration')).map(d => +d.textContent!);
    const hit = +(a.querySelector('HitFrame')?.textContent ?? -1);
    const golpe = hit >= 0 ? durs.slice(0, hit).reduce((t, d) => t + d, 0) * 1000 / 60 : durs.reduce((t, d) => t + d, 0) * 500 / 60;
    return { hoja: nombre, fw: +fw.textContent!, fh: +fh.textContent!, durs, golpe };
  };
  const out: Hojas = {};
  for (const n of ANIMS) { const d = datos(n); if (d) out[n] = d; }
  for (const n of ANIMS) if (!out[n]) { const r = RESERVA[n].find(x => out[x]); if (r) out[n] = out[r]; }
  return out;
}

// Carga lo que falte de esas formas (AnimData.xml, luego las hojas) y crea sus animaciones.
export async function cargar(scene: Phaser.Scene, dexs: string[]): Promise<void> {
  const faltan = [...new Set(dexs)].filter(d => !INFO.has(d));
  if (!faltan.length) return;
  const L = scene.load;
  const espera = () => new Promise<void>(ok => { L.once(Phaser.Loader.Events.COMPLETE, () => ok()); L.start(); });
  for (const d of faltan) L.xml(`${clave(d)}-xml`, `${A}sprites/pokemon/${base(d)}/AnimData.xml`);
  await espera();
  const hojas = new Map<string, InfoAnim>();
  for (const d of faltan) {
    const xml = scene.cache.xml.get(`${clave(d)}-xml`) as XMLDocument | undefined;
    const h = xml ? leer(xml) : {};
    INFO.set(d, h);
    for (const a of Object.values(h)) hojas.set(`${d}/${a.hoja}`, a);
  }
  const shiny: { key: string; frameConfig: { frameWidth: number; frameHeight: number }; luz: boolean; pal: Map<number, number> }[] = [];
  for (const [ruta, a] of hojas) {
    const [d] = ruta.split('/'), key = `${clave(d)}-${a.hoja}`, frameConfig = { frameWidth: a.fw, frameHeight: a.fh };
    const r = `${base(d)}/${a.hoja}`, url = `${A}sprites/pokemon/${r}`, luz = NORMALES.has(r);
    if (scene.textures.exists(key)) continue;
    if (esShiny(d)) {
      // Se carga como imagen suelta y al terminar se pasa por un canvas (abajo): recolorear y teñir el contorno.
      const propia = HOJAS_SHINY[base(d)]?.includes(a.hoja);
      L.image(`${key}-crudo`, propia ? `${A}sprites/pokemon/${base(d)}/shiny/${a.hoja}-Anim.png` : `${url}-Anim.png`);
      if (luz) L.image(`${key}-nrm`, `${url}-Normal.png`);
      shiny.push({ key, frameConfig, luz, pal: propia ? new Map() : paleta(base(d)) });
    } else if (luz) L.spritesheet({ key, url: `${url}-Luz.png`, normalMap: `${url}-Normal.png`, frameConfig });
    else L.spritesheet(key, `${url}-Anim.png`, frameConfig);
  }
  await espera();
  for (const s of shiny) {
    const T = scene.textures, crudo = `${s.key}-crudo`, nrm = `${s.key}-nrm`;
    if (!T.exists(crudo) || T.exists(s.key)) continue;
    const img = T.get(crudo).getSourceImage() as HTMLImageElement;
    const datos = s.luz && T.exists(nrm) ? T.get(nrm).getSourceImage() as HTMLImageElement : undefined;
    T.addSpriteSheet(s.key, recolorear(img, s.pal, s.luz) as unknown as HTMLImageElement, s.frameConfig, datos);
    T.remove(crudo);
  }
  for (const d of faltan) { crearAnims(scene, d); medir(scene, d); }
  // Si alguna no llegó a cargar (el cargador se cortó), se olvida para que la próxima vez se intente otra vez.
  for (const d of faltan) if (!listo(scene, d)) INFO.delete(d);
}
// Sus animaciones ya están creadas (se puede `poner`).
export function listo(scene: Phaser.Scene, dex: string): boolean {
  const h = INFO.get(dex)?.Idle;
  return !!h && scene.textures.exists(`${clave(dex)}-${h.hoja}`) && scene.anims.exists(`${clave(dex)}-Idle-0`);
}

function crearAnims(scene: Phaser.Scene, dex: string): void {
  const h = INFO.get(dex) ?? {};
  for (const n of ANIMS) {
    const a = h[n];
    if (!a) continue;
    const key = `${clave(dex)}-${a.hoja}`;
    if (!scene.textures.exists(key)) continue;
    scene.textures.get(key).setFilter(Phaser.Textures.FilterMode.NEAREST);
    // Algunas hojas solo traen la fila de frente: si falta la dirección pedida, la fila 0.
    const filas = Math.max(1, Math.round(scene.textures.get(key).source[0].height / a.fh));
    const bucle = n === 'Walk' || n === 'Idle' || n === 'Sleep';
    for (let r = 0; r < 8; r++) {
      const k = `${clave(dex)}-${n}-${r}`;
      if (scene.anims.exists(k)) continue;
      scene.anims.create({ key: k, repeat: bucle ? -1 : 0, frames: a.durs.map((d, i) => ({ key, frame: (r < filas ? r : 0) * a.durs.length + i, duration: d * 1000 / 60 })) });
    }
  }
}

// ---- Shiny ----
const DATOS_SHINY = SHINY as unknown as { pal: Record<string, [number, number][]>; hojas: Record<string, string[]> };
const HOJAS_SHINY = DATOS_SHINY.hojas;
const PALS = new Map<string, Map<number, number>>();
function paleta(dex: string): Map<number, number> {
  let p = PALS.get(dex);
  if (!p) PALS.set(dex, p = new Map(DATOS_SHINY.pal[dex] ?? []));
  return p;
}
// La hoja con los colores shiny (si ya los trae, `pal` vacía): cada color normal pasa a su shiny. Un color que no está en la paleta (alguna hoja
// trae un tono suelto) toma el cambio del más parecido. Con `luz`, después se tiñe el contorno como la -Luz
// (tools/normales_pokemon.py, contorno_tintado): cada píxel casi negro toma la media de sus vecinos × 0,6.
function recolorear(img: HTMLImageElement, pal: Map<number, number>, luz: boolean): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = img.width; c.height = img.height;
  const g = c.getContext('2d', { willReadFrequently: true })!;
  g.drawImage(img, 0, 0);
  if (!pal.size && !luz) return c;
  const im = g.getImageData(0, 0, c.width, c.height), d = im.data, W = c.width, H = c.height;
  const claves = [...pal.keys()], cerca = new Map<number, number>();
  for (let i = 0; i < W * H && pal.size; i++) {
    const o = i * 4;
    if (!d[o + 3]) continue;
    const col = d[o] << 16 | d[o + 1] << 8 | d[o + 2];
    const s = pal.get(col);
    if (s === undefined) {
      let k = cerca.get(col);
      if (k === undefined) {
        let mejor = Infinity;
        for (const q of claves) {
          const dr = (q >> 16) - d[o], dg = (q >> 8 & 255) - d[o + 1], db = (q & 255) - d[o + 2], e = dr * dr + dg * dg + db * db;
          if (e < mejor) { mejor = e; k = q; }
        }
        cerca.set(col, k!);
      }
      const t = pal.get(k!)!;
      d[o] = Math.max(0, Math.min(255, d[o] + (t >> 16) - (k! >> 16)));
      d[o + 1] = Math.max(0, Math.min(255, d[o + 1] + (t >> 8 & 255) - (k! >> 8 & 255)));
      d[o + 2] = Math.max(0, Math.min(255, d[o + 2] + (t & 255) - (k! & 255)));
      continue;
    }
    d[o] = s >> 16; d[o + 1] = s >> 8 & 255; d[o + 2] = s & 255;
  }
  if (luz) contorno(d, W, H);
  g.putImageData(im, 0, 0);
  return c;
}
// Por pasadas (4, como allí): cada píxel de contorno con algún vecino ya hecho toma su media × 0,6.
function contorno(d: Uint8ClampedArray, W: number, H: number): void {
  const listo = new Uint8Array(W * H);
  let pend: number[] = [];
  for (let i = 0; i < W * H; i++) {
    const o = i * 4;
    if (!d[o + 3]) continue;
    if ((0.299 * d[o] + 0.587 * d[o + 1] + 0.114 * d[o + 2]) / 255 < 0.08) pend.push(i); else listo[i] = 1;
  }
  for (let pasada = 0; pasada < 4 && pend.length; pasada++) {
    const sig: number[] = [], hechos: [number, number, number, number][] = [];
    for (const i of pend) {
      const x = i % W, y = (i / W) | 0;
      let n = 0, r = 0, gg = 0, b = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const xx = x + dx, yy = y + dy;
        if (xx < 0 || yy < 0 || xx >= W || yy >= H || !listo[yy * W + xx]) continue;
        const o = (yy * W + xx) * 4;
        n++; r += d[o]; gg += d[o + 1]; b += d[o + 2];
      }
      if (n) hechos.push([i, r / n * 0.6, gg / n * 0.6, b / n * 0.6]); else sig.push(i);
    }
    for (const [i, r, gg, b] of hechos) { const o = i * 4; d[o] = Math.round(r); d[o + 1] = Math.round(gg); d[o + 2] = Math.round(b); listo[i] = 1; }
    pend = sig;
  }
}
