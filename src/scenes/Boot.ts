// Boot: carga los datos (mapa, catálogos, bayas, AnimData.xml) y pasa a Preload, que ya
// sabe qué imágenes hacen falta.
import Phaser from 'phaser';
import { A, DIBUJO, ESPECIES, MAPA, PELIPPER_DEX, REG, type AnimSet } from '../config';
import { cargarCatalogos, catalogo } from '../render/Dibujo';
import { terrenoDibujo } from '../data/mapaDibujo';
import type { BayasData, ObjCatalog } from '../data/types';
import { registrarBayas } from '../data/items';
import { TRABAJOS } from '../data/especies';
import { LINEAS } from '../data/pokedex';

// Animaciones PMD que usamos, leídas del AnimData.xml de cada Pokémon.
function leerAnims(xml: XMLDocument, extras: string[] = []): AnimSet {
  const anims: AnimSet = {};
  for (const a of Array.from(xml.querySelectorAll('Anim'))) {
    const name = a.querySelector('Name')!.textContent!;
    if (!['Walk', 'Idle', 'Sleep', 'Eat', ...extras].includes(name)) continue;
    const fw = a.querySelector('FrameWidth'), fh = a.querySelector('FrameHeight');
    if (!fw || !fh) continue;
    anims[name] = { fw: +fw.textContent!, fh: +fh.textContent!, durs: Array.from(a.querySelectorAll('Duration')).map(d => +d.textContent!) };
  }
  return anims;
}

// Formas de la línea de una especie de aldeano (la clave de ESPECIES es la de su línea).
const formasAldeano = (id: string) => LINEAS[id]?.formas ?? [{ id, dex: ESPECIES[id].dex }];

export class Boot extends Phaser.Scene {
  constructor() { super('boot'); }

  preload(): void {
    const v = Date.now();
    // Letra pixel de textos y títulos (Google Fonts, licencia OFL; solo el juego de caracteres latino).
    this.load.font('Pixelify Sans', `${A}fonts/PixelifySans.woff2`, 'woff2', { weight: '400 700' });
    if (DIBUJO) cargarCatalogos(this);
    else this.load.json('mapa', `/docs/art/mapas/${MAPA}.json?v=${v}`);
    this.load.json('items', `${A}game/pixel/items.json?v=${v}`);
    this.load.json('edificios', `${A}game/pixel/edificios.json?v=${v}`);
    this.load.json('bayas', `${A}sprites/bayas/bayas.json?v=${v}`);
    this.load.xml('bulbasaur-xml', `${A}sprites/pokemon/0001/AnimData.xml`);
    this.load.xml('pelipper-xml', `${A}sprites/pokemon/${PELIPPER_DEX}/AnimData.xml`);
    // Aldeanos: cada forma de su línea evolutiva (data/pokedex.ts), para poder evolucionar.
    for (const id in ESPECIES) for (const f of formasAldeano(id)) this.load.xml(`${f.id}-xml`, `${A}sprites/pokemon/${f.dex}/AnimData.xml`);
    this.load.on('loaderror', (f: Phaser.Loader.File) => console.warn('No se pudo cargar', f.key, f.url));
  }

  create(): void {
    const objs: ObjCatalog = { ...(this.cache.json.get('items') ?? {}), ...(this.cache.json.get('edificios') ?? {}) };
    const bayas = this.cache.json.get('bayas') as BayasData;
    registrarBayas(Object.keys(bayas.bayas));
    const aldeanos: Record<string, AnimSet> = {};
    for (const id in ESPECIES) for (const f of formasAldeano(id)) {
      const xml = this.cache.xml.get(`${f.id}-xml`) as XMLDocument | undefined;
      if (xml) aldeanos[f.id] = leerAnims(xml, [ESPECIES[id].trabajo, ...TRABAJOS]);
    }
    this.registry.set(REG.mapa, DIBUJO ? terrenoDibujo() : this.cache.json.get('mapa'));
    if (DIBUJO) this.registry.set(REG.dibujo, catalogo(this));
    this.registry.set(REG.objs, objs);
    this.registry.set(REG.bayas, bayas);
    this.registry.set(REG.anims, leerAnims(this.cache.xml.get('bulbasaur-xml') as XMLDocument));
    this.registry.set(REG.animsAldeanos, aldeanos);
    const pel = this.cache.xml.get('pelipper-xml') as XMLDocument | undefined;
    this.registry.set(REG.pelipper, pel ? leerAnims(pel) : {});
    this.scene.start('preload');
  }
}
