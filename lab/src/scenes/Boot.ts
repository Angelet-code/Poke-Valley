// Boot: catálogo de elementos del dibujo y AnimData de Bulbasaur; luego la escena del valle.
import Phaser from 'phaser';
import { A, L, SET, type AnimSet } from '../config';

export function leerAnims(xml: XMLDocument, nombres = ['Walk', 'Idle']): AnimSet {
  const anims: AnimSet = {};
  for (const a of Array.from(xml.querySelectorAll('Anim'))) {
    const name = a.querySelector('Name')!.textContent!;
    if (!nombres.includes(name)) continue;
    const fw = a.querySelector('FrameWidth'), fh = a.querySelector('FrameHeight');
    if (!fw || !fh) continue;
    anims[name] = { fw: +fw.textContent!, fh: +fh.textContent!, durs: Array.from(a.querySelectorAll('Duration')).map(d => +d.textContent!) };
  }
  return anims;
}

export class Boot extends Phaser.Scene {
  constructor() { super('boot'); }
  preload(): void {
    const v = Date.now();
    this.load.json('elementos', `${L}elementos/elementos.json?v=${v}`);
    this.load.json('vectores', L + 'vector/vector.json?v=' + v);   // ids con versión SVG (puede no existir)
    this.load.json('extra', L + 'elementos/extra.json?v=' + v);     // elementos reinterpretados (Klein), puede no existir
    if (SET) {
      this.load.json('set', L + 'elementos_' + SET + '/elementos.json?v=' + v);
      this.load.json('setVectores', L + 'vector/elementos_' + SET + '/vector.json?v=' + v);
    }
    this.load.xml('bulbasaur-xml', `${A}sprites/pokemon/0001/AnimData.xml`);
    this.load.on('loaderror', (f: Phaser.Loader.File) => console.warn('No se pudo cargar', f.key, f.url));
  }
  create(): void {
    const cat = this.cache.json.get('elementos');
    for (const e of this.cache.json.get('extra')?.elementos ?? []) cat.elementos.push(e);
    let vectores: string[] = this.cache.json.get('vectores') ?? [];
    if (SET && this.cache.json.get('set')) {
      // El catálogo del set sustituye por id; sus SVG viven en vector/elementos_<set>/.
      const dir = 'elementos_' + SET, propios = this.cache.json.get('set').elementos.map((e: { id: string }) => ({ ...e, dir }));
      const ids = new Set(propios.map((e: { id: string }) => e.id));
      cat.elementos = [...cat.elementos.filter((e: { id: string }) => !ids.has(e.id)), ...propios];
      const sv: string[] = this.cache.json.get('setVectores') ?? [];
      vectores = [...vectores.filter(i => !ids.has(i)), ...sv];
    }
    this.registry.set('elementos', cat);
    this.registry.set('vectores', vectores);
    this.registry.set('anims', leerAnims(this.cache.xml.get('bulbasaur-xml') as XMLDocument));
    this.scene.start('lab');
  }
}
