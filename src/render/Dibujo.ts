// Elementos del estilo «dibujo» en el juego (mapa `dibujo`, src/data/mapaDibujo.ts): el catálogo Klein del lab
// (lab/assets/elementos_klein/, con los detalles pequeños del catálogo original) cargado como SVG rasterizado por el
// navegador al tamaño exacto de pantalla, con su sombra proyectada aparte (multiply). Es lo mismo que hace
// lab/src/scenes/LabScene.ts.colocar, sin el lab: aquí solo se dibuja; colisiones y usos los pone WorldScene.
import Phaser from 'phaser';
import { ARCANE, S } from '../config';
import { F, PNG_X, type Colocado } from '../data/mapaDibujo';
import { screenTex } from './Terrain';

export const L = '/lab/assets/';
export const SOMBRA_ALFA = 0.45;

export interface Elemento {
  id: string; tipo: string; archivo: string; w: number; h: number;
  ancla: [number, number];                          // px del PNG: centro-base
  huella: [number, number, number, number] | null;  // px del PNG: rectángulo que bloquea el paso
  k?: number; dir?: string;
  sombra?: { archivo: string; w: number; h: number; dx: number; dy: number };
  // Catálogo Arcane: ancla y escala del elemento dibujo con el mismo id. Los polígonos de SUELOS están en px de esa
  // imagen; con `ref` se pasan al mundo con su ancla y su escala, así la planta de la casa queda igual en los dos estilos.
  ref?: { ancla: [number, number]; k: number };
}
// Lo dibujado: imagen, factor px PNG → mundo, alto en el mundo, base (para el orden) y huella en el mundo.
export interface Pieza {
  el: Elemento; c: Colocado; img: Phaser.GameObjects.Image; k: number; hM: number; base: number; plano: boolean;
  huella: { x0: number; y0: number; x1: number; y1: number } | null;
  partes: Phaser.GameObjects.Image[];   // la imagen y sus columnas (para hacerlas transparentes juntas)
  suelo?: [number, number][][];         // edificios: planta en perspectiva (polígonos en px de mundo), colisión y orden
  prof?: Float32Array;                  // edificios: profundidad de cada columna de la textura (borde delantero del suelo)
  puerta?: [number, number];            // edificios: dónde se para uno para entrar o usarlo (px de mundo)
}

// Planta de cada edificio en perspectiva (px del PNG del catálogo Klein): el suelo que ocupa visto en 3/4, con sus
// esquinas izquierda, delantera, derecha y trasera (la trasera = izq. + der. − delantera), más lo que tiene delante
// (los barriles del almacén). Medido a ojo sobre una rejilla. `puerta`: delante de la puerta o del mostrador.
const SUELOS: Record<string, { poligonos: [number, number][][]; puerta?: [number, number] }> = {
  casa_grande: { poligonos: [[[190, 980], [690, 1220], [1170, 980], [670, 740]]], puerta: [410, 1140] },
  almacen: { poligonos: [[[200, 990], [690, 1200], [1110, 980], [620, 770]], [[790, 1120], [890, 1220], [1150, 1095], [1110, 960]]], puerta: [440, 1150] },
  tienda: { poligonos: [[[50, 1010], [500, 1380], [1130, 1050], [680, 680]]], puerta: [830, 1260] },
  casa_cabana: { poligonos: [[[190, 980], [600, 1250], [1110, 980], [700, 710]]] },
  casa_larga: { poligonos: [[[220, 940], [980, 1070], [1380, 940], [620, 810]]] },
  casa_chimenea: { poligonos: [[[210, 1120], [690, 1480], [1240, 1190], [760, 830]]] },
};
const COLUMNA = 3;   // px de mundo de cada columna de un edificio (ver columnas)
// Borde delantero (la y más baja en pantalla) de los polígonos en la vertical x; x se lleva dentro de su anchura.
function frente(polis: [number, number][][], x: number): number {
  const xs = polis.flat().map(q => q[0]), xc = Math.min(Math.max(...xs) - 0.01, Math.max(Math.min(...xs) + 0.01, x));
  let y = -Infinity;
  for (const pol of polis) for (let i = 0; i < pol.length; i++) {
    const [x0, y0] = pol[i], [x1, y1] = pol[(i + 1) % pol.length];
    if ((xc < x0) === (xc < x1)) continue;
    y = Math.max(y, y0 + (y1 - y0) * (xc - x0) / (x1 - x0));
  }
  return y;
}
export { dentroDe } from '../util';
// Alfa de cada textura de pantalla (para saber si un punto del mundo cae en lo pintado de un elemento).
const ALFAS = new Map<string, { data: Uint8ClampedArray; w: number; h: number }>();
function alfaDe(img: Phaser.GameObjects.Image) {
  const key = img.texture.key;
  let a = ALFAS.get(key);
  if (!a) {
    const src = img.texture.getSourceImage() as HTMLCanvasElement;
    a = { data: src.getContext('2d')!.getImageData(0, 0, src.width, src.height).data, w: src.width, h: src.height };
    ALFAS.set(key, a);
  }
  return a;
}

// Boot.preload: los catálogos (Klein + original, del que solo se usan los detalles) y la lista de SVG.
export function cargarCatalogos(scene: Phaser.Scene): void {
  const v = Date.now();
  scene.load.json('dib-original', `${L}elementos/elementos.json?v=${v}`);
  scene.load.json('dib-klein', `${L}elementos_klein/elementos.json?v=${v}`);
  scene.load.json('dib-vector', `${L}vector/elementos_klein/vector.json?v=${v}`);
  scene.load.json('dib-arcane', `${L}elementos_arcane/elementos.json?v=${v}`);
}
// Boot.create: catálogo final (los del set Klein, con su carpeta, y los detalles del original).
export function catalogo(scene: Phaser.Scene): { elementos: Elemento[]; vectores: string[] } {
  let klein = (scene.cache.json.get('dib-klein')?.elementos ?? []).map((e: Elemento) => ({ ...e, dir: 'elementos_klein' }));
  // ?set=arcane: los del catálogo Arcane sustituyen a los Klein con el mismo id; los que aún no estén, siguen en dibujo.
  // Sin él, también entran los que solo existen en Arcane (las piezas de los biomas, el tablón…), para que las zonas
  // de bioma no salgan vacías en el estilo dibujo.
  const arc: Elemento[] = (scene.cache.json.get('dib-arcane')?.elementos ?? []).map((e: Elemento) => ({ ...e, dir: 'elementos_arcane' }));
  if (ARCANE) {
    const ids = new Set(arc.map(e => e.id));
    klein = [...klein.filter((e: Elemento) => !ids.has(e.id)), ...arc];
  } else {
    const ids = new Set(klein.map((e: Elemento) => e.id));
    klein = [...klein, ...arc.filter(e => !ids.has(e.id))];
  }
  const detalles = (scene.cache.json.get('dib-original')?.elementos ?? []).filter((e: Elemento) => e.tipo === 'detalle');
  return { elementos: [...klein, ...detalles], vectores: scene.cache.json.get('dib-vector') ?? [] };
}
// Escala extra por elemento respecto al catálogo (el usuario pidió farolas más grandes, 2026-10-14).
export const ESCALA: Record<string, number> = { farola: 2.4, farola_madera: 2.4 };

// Preload: imagen de cada elemento (SVG a la escala de pantalla si lo hay; si no, PNG) y su sombra.
export function precargar(scene: Phaser.Scene, cat: { elementos: Elemento[]; vectores: string[] }): void {
  const vec = new Set(cat.vectores);
  for (const el of cat.elementos) {
    const dir = el.dir ?? 'elementos';
    if (el.sombra) scene.load.image('so_' + el.id, `${L}${dir}/${el.sombra.archivo}`);
    if (dir === 'elementos_klein' && vec.has(el.id)) scene.load.svg('el_' + el.id, `${L}vector/elementos_klein/${el.id}.svg`, { scale: F / PNG_X * S * (el.k ?? 1) * (ESCALA[el.id] ?? 1) });
    else scene.load.image('el_' + el.id, `${L}${dir}/${el.archivo}`);
  }
}

// Dibuja un elemento a su tamaño de mundo, reducido de antemano al tamaño exacto en pantalla (screenTex) y
// ordenado por la base de su huella; los planos (caminos, detalles, estanque) van a ras de suelo.
export function dibujar(scene: Phaser.Scene, el: Elemento, c: Colocado): Pieza {
  const k = F / PNG_X * (c.s ?? 1) * (el.k ?? 1) * (ESCALA[el.id] ?? 1), hM = el.h * k;
  const key = screenTex(scene, 'el_' + el.id, Math.max(1, Math.round(hM * S)));
  const [ax, ay] = el.ancla, plano = el.tipo === 'piedras' || el.tipo === 'losa' || el.tipo === 'detalle' || el.tipo === 'estanque';
  // Farolas: la huella del catálogo abarca medio poste (no se podía pasar por detrás); solo la base de piedra.
  let hu = el.huella;
  if (hu && /^farola/.test(el.id)) hu = [hu[0], hu[3] - (hu[2] - hu[0]) * 0.45, hu[2], hu[3]];
  const base = hu ? c.y + (hu[3] - ay) * k : c.y;
  const img = scene.add.image(c.x, c.y, key).setOrigin(ax / el.w, ay / el.h).setScale(1 / S).setFlipX(!!c.flip).setDepth(plano ? -9000 + c.y : base);
  if (el.tipo === 'arbol') {
    // Árboles: la máscara de Klein trae una mancha suelta además del óvalo (se veían dos sombras); un óvalo limpio
    // bajo la copa, en la parte de abajo de la máscara.
    const so = el.sombra, w = (so ? so.w : el.w * 0.5) * k * 0.92, h = (so ? so.h * 0.5 : el.h * 0.12) * k;
    scene.add.ellipse(c.x, base - h * 0.3, w, h, 0x283828, 0.38).setDepth(-8000 + base);
  } else if (el.sombra) {
    const so = el.sombra, keyS = screenTex(scene, 'so_' + el.id, Math.max(1, Math.round(so.h * k * S)));
    const sx = c.flip ? c.x + (ax - so.dx - so.w) * k : c.x + (so.dx - ax) * k, sy = c.y + (so.dy - ay) * k;
    const sombra = scene.add.image(sx, sy, keyS).setOrigin(0, 0).setScale(1 / S).setFlipX(!!c.flip).setAlpha(SOMBRA_ALFA)
      .setBlendMode(Phaser.BlendModes.MULTIPLY).setDepth(-8000 + sy + so.h * k);
    sombra.resetPipeline();   // multiply sobre el suelo ya iluminado: sin luz propia
  }
  let huella: Pieza['huella'] = null;
  const pieza: Pieza = { el, c, img, k, hM, base, plano, huella, partes: [img] };
  if (hu) {
    let [hx0, hy0, hx1, hy1] = hu;
    if (c.flip) [hx0, hx1] = [el.w - hx1, el.w - hx0];
    pieza.huella = huella = { x0: c.x + (hx0 - ax) * k, y0: c.y + (hy0 - ay) * k, x1: c.x + (hx1 - ax) * k, y1: c.y + (hy1 - ay) * k };
  }
  const sue = SUELOS[el.id];
  if (sue) {
    const [rx, ry] = el.ref?.ancla ?? el.ancla, rk = el.ref ? k / (el.k ?? 1) * el.ref.k : k;
    const aMundo = ([px, py]: [number, number]): [number, number] => [c.x + (c.flip ? rx - px : px - rx) * rk, c.y + (py - ry) * rk];
    pieza.suelo = sue.poligonos.map(pol => pol.map(aMundo));
    if (sue.puerta) pieza.puerta = aMundo(sue.puerta);
    pieza.base = Math.max(...pieza.suelo.flat().map(q => q[1]));
    columnas(scene, pieza);
  }
  return pieza;
}

// ¿Tapa el elemento el punto (x, y) del mundo a quien tiene los pies en `pies`? Lo pintado en ese punto (alfa) y
// dibujado por delante (su profundidad: la base, o el borde de abajo de su franja si está a un lado).
export function tapa(p: Pieza, x: number, y: number, pies: number): boolean {
  if (p.plano) return false;
  const img = p.img, a = alfaDe(img), u = p.hM / a.h;
  const left = img.x - img.originX * a.w * u, top = img.y - img.originY * a.h * u;
  const dx = Math.floor((x - left) / u), dy = Math.floor((y - top) / u);
  if (dx < 0 || dy < 0 || dx >= a.w || dy >= a.h) return false;
  if (a.data[(dy * a.w + (p.c.flip ? a.w - 1 - dx : dx)) * 4 + 3] < 128) return false;
  return (p.prof ? p.prof[dx] : p.base) > pies;
}

// Edificios: el dibujo se corta en columnas de COLUMNA px y cada una se ordena por el borde delantero del suelo en esa
// vertical (orden por columnas, el de los juegos en 3/4 con paredes en diagonal). Quien está delante de la pared de esa
// columna se dibuja encima; quien está detrás (o a la altura del tejado de atrás), debajo. Así un árbol detrás de la
// casa no tapa el alero, y Bulbasaur detrás de la esquina queda tapado solo por la parte de la casa que tiene delante.
function columnas(scene: Phaser.Scene, p: Pieza): void {
  const { img, c } = p, a = alfaDe(img), tw = a.w, th = a.h, u = p.hM / th; // px de mundo por px de textura
  const left = img.x - img.originX * tw * u, cw = Math.max(1, Math.round(COLUMNA / u));
  p.prof = new Float32Array(tw);
  for (let x = 0; x < tw; x++) p.prof[x] = frente(p.suelo!, left + (x + 0.5) * u);
  let primera = true;
  for (let x0 = 0; x0 < tw; x0 += cw) {
    const x1 = Math.min(tw, x0 + cw), xm = Math.min(tw - 1, Math.floor((x0 + x1) / 2));
    let lleno = false;
    for (let x = x0; x < x1 && !lleno; x++) { const xt = c.flip ? tw - 1 - x : x; for (let y = 0; y < th; y++) if (a.data[(y * tw + xt) * 4 + 3] > 8) { lleno = true; break; } }
    if (!lleno) continue;
    const im = primera ? img : scene.add.image(img.x, img.y, img.texture.key).setOrigin(img.originX, img.originY).setScale(1 / S).setFlipX(!!c.flip);
    im.setCrop(x0, 0, x1 - x0, th).setDepth(p.prof[xm]);   // crop en coordenadas de lo que se ve (Phaser aplica el volteo)
    if (!primera) p.partes.push(im);
    primera = false;
  }
}

// Dónde va la luz de un elemento que alumbra (el farol de la farola, el farolillo colgado, las llamas de la hoguera).
export function puntoLuz(p: Pieza): [number, number] | null {
  const { c, hM } = p;
  if (p.el.id === 'farola') return [c.x, c.y - hM * 0.82];
  if (p.el.id === 'farola_madera') return [c.x + (c.flip ? -1 : 1) * hM * 0.17, c.y - hM * 0.74];
  if (p.el.id === 'hoguera') return [c.x, c.y - hM * 0.45];
  return null;
}
