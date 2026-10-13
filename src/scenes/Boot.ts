// Boot: carga los datos (mapa, catálogos, bayas, AnimData.xml) y pasa a Preload, que ya
// sabe qué imágenes hacen falta.
import Phaser from 'phaser';
import { A, MAPA, REG, type AnimSet } from '../config';
import type { BayasData, ObjCatalog } from '../data/types';
import { registrarBayas } from '../data/items';

export class Boot extends Phaser.Scene {
  constructor() { super('boot'); }

  preload(): void {
    const v = Date.now();
    this.load.json('mapa', `/docs/art/mapas/${MAPA}.json?v=${v}`);
    this.load.json('items', `${A}game/pixel/items.json?v=${v}`);
    this.load.json('edificios', `${A}game/pixel/edificios.json?v=${v}`);
    this.load.json('bayas', `${A}sprites/bayas/bayas.json?v=${v}`);
    this.load.xml('bulbasaur-xml', `${A}sprites/pokemon/0001/AnimData.xml`);
    this.load.on('loaderror', (f: Phaser.Loader.File) => console.warn('No se pudo cargar', f.key, f.url));
  }

  create(): void {
    const objs: ObjCatalog = { ...(this.cache.json.get('items') ?? {}), ...(this.cache.json.get('edificios') ?? {}) };
    const bayas = this.cache.json.get('bayas') as BayasData;
    registrarBayas(Object.keys(bayas.bayas));
    const anims: AnimSet = {};
    const xml = this.cache.xml.get('bulbasaur-xml') as XMLDocument;
    for (const a of Array.from(xml.querySelectorAll('Anim'))) {
      const name = a.querySelector('Name')!.textContent!;
      if (!['Walk', 'Idle', 'Sleep', 'Eat'].includes(name)) continue;
      const fw = a.querySelector('FrameWidth'), fh = a.querySelector('FrameHeight');
      if (!fw || !fh) continue;
      anims[name] = { fw: +fw.textContent!, fh: +fh.textContent!, durs: Array.from(a.querySelectorAll('Duration')).map(d => +d.textContent!) };
    }
    this.registry.set(REG.mapa, this.cache.json.get('mapa'));
    this.registry.set(REG.objs, objs);
    this.registry.set(REG.bayas, bayas);
    this.registry.set(REG.anims, anims);
    this.scene.start('preload');
  }
}
