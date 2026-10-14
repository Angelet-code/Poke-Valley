// Hojas PMD (SpriteCollab) de los Pokémon del modo aventura, cargadas al entrar en cada mapa (solo las formas que
// salen en él). Clave de cada forma: `a-<dex>`; animaciones `a-<dex>-<Anim>-<fila>` (fila = dirección, config.ts).
// Lo que se usa en combate: andar, quieto (su Idle en bucle), golpe (Attack), disparo (Shoot), concentrarse (Charge),
// recibir (Hurt), debilitarse (Faint) y dormir. Las que una especie no tiene caen en otra (CopyOf del AnimData o la
// lista de RESERVA). Con mapa de normales (tools/normales_pokemon.py) se cargan -Luz + -Normal para el pipeline Cel.
/// <reference types="vite/client" />
import Phaser from 'phaser';
import { A } from '../config';

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
  for (const d of faltan) L.xml(`${clave(d)}-xml`, `${A}sprites/pokemon/${d}/AnimData.xml`);
  await espera();
  const hojas = new Map<string, InfoAnim>();
  for (const d of faltan) {
    const xml = scene.cache.xml.get(`${clave(d)}-xml`) as XMLDocument | undefined;
    const h = xml ? leer(xml) : {};
    INFO.set(d, h);
    for (const a of Object.values(h)) hojas.set(`${d}/${a.hoja}`, a);
  }
  for (const [ruta, a] of hojas) {
    const [d] = ruta.split('/'), key = `${clave(d)}-${a.hoja}`, url = `${A}sprites/pokemon/${ruta}`, frameConfig = { frameWidth: a.fw, frameHeight: a.fh };
    if (scene.textures.exists(key)) continue;
    if (NORMALES.has(ruta)) L.spritesheet({ key, url: `${url}-Luz.png`, normalMap: `${url}-Normal.png`, frameConfig });
    else L.spritesheet(key, `${url}-Anim.png`, frameConfig);
  }
  await espera();
  for (const d of faltan) { crearAnims(scene, d); medir(scene, d); }
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
