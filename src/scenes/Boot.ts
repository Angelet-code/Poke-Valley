// Boot: carga los datos (mapa, catálogos, bayas, AnimData.xml) y pasa a Preload, que ya
// sabe qué imágenes hacen falta.
import Phaser from 'phaser';
import { A, DIBUJO, ESPECIES, GRANJA, MAPA, PELIPPER_DEX, REG, type AnimSet } from '../config';
import { cargarCatalogos, catalogo } from '../render/Dibujo';
import { terrenoDibujo } from '../data/mapaDibujo';
import type { BayasData, ObjCatalog } from '../data/types';
import { registrarBayas } from '../data/items';
import { TRABAJOS } from '../data/especies';
import { LINEAS } from '../data/pokedex';
import { DEX_MUESTRA, MUESTRA, claveMuestra } from '../data/muestra';
import { REG_CARGA, TEX_CARGA } from './carga';

// Pantalla de carga (scenes/carga.ts): un Pokémon en su primera forma, al azar, que camina sobre la barra.
const PRIMERAS = Object.values(LINEAS).map(l => l.formas[0]);

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
// En el modo aventura no hay aldeanos (cada mapa carga sus Pokémon, combate/sprites.ts): solo los del título
// (Title.ts: POKES), no las 1 700 hojas de todas las formas.
const DEL_TITULO = ['marill', 'oddish', 'bidoof', 'geodude', 'growlithe'];
const formasAldeano = (id: string) => (LINEAS[id]?.formas ?? [{ id, dex: ESPECIES[id].dex }]).filter(f => GRANJA || DEL_TITULO.includes(f.id));

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
    if (MUESTRA) for (const dex of DEX_MUESTRA) this.load.xml(`${claveMuestra(dex)}-xml`, `${A}sprites/pokemon/${dex}/AnimData.xml`);
    this.load.on('loaderror', (f: Phaser.Loader.File) => console.warn('No se pudo cargar', f.key, f.url));
    // Lo que enseña la pantalla de carga: el Pokémon que camina (su hoja Walk), el fondo y el logo del título.
    this.carga = PRIMERAS[Math.floor(Math.random() * PRIMERAS.length)];
    this.load.xml('carga-xml', `${A}sprites/pokemon/${this.carga.dex}/AnimData.xml`);
    this.load.image('carga-walk-img', `${A}sprites/pokemon/${this.carga.dex}/Walk-Anim.png`);
    this.load.image('tit-logo', `${A}ui/logo/logo_pow.png`);
    this.load.image('tit-fondo', `${A}ui/titulo/fondo_arcane.jpg`);
  }

  private carga = PRIMERAS[0];

  // Hoja Walk del Pokémon de la pantalla de carga y su animación hacia la derecha (fila 2 de PMD).
  private prepararCarga(): void {
    const xml = this.cache.xml.get('carga-xml') as XMLDocument | undefined, w = xml && leerAnims(xml).Walk;
    if (!w || !this.textures.exists('carga-walk-img')) return;
    const img = this.textures.get('carga-walk-img').getSourceImage() as HTMLImageElement;
    this.textures.addSpriteSheet(TEX_CARGA, img, { frameWidth: w.fw, frameHeight: w.fh });
    const fila = Math.min(2, Math.floor(img.height / w.fh) - 1);
    this.anims.create({ key: `${TEX_CARGA}-der`, repeat: -1, frames: w.durs.map((d, i) => ({ key: TEX_CARGA, frame: fila * w.durs.length + i, duration: d * 1000 / 60 })) });
    this.registry.set(REG_CARGA, { dex: this.carga.dex, nombre: this.carga.nombre });
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
    if (MUESTRA) for (const dex of DEX_MUESTRA) {
      const xml = this.cache.xml.get(`${claveMuestra(dex)}-xml`) as XMLDocument | undefined;
      if (xml) aldeanos[claveMuestra(dex)] = leerAnims(xml);
    }
    this.registry.set(REG.mapa, DIBUJO ? terrenoDibujo() : this.cache.json.get('mapa'));
    if (DIBUJO) this.registry.set(REG.dibujo, catalogo(this));
    this.registry.set(REG.objs, objs);
    this.registry.set(REG.bayas, bayas);
    this.registry.set(REG.anims, leerAnims(this.cache.xml.get('bulbasaur-xml') as XMLDocument));
    this.registry.set(REG.animsAldeanos, aldeanos);
    const pel = this.cache.xml.get('pelipper-xml') as XMLDocument | undefined;
    this.registry.set(REG.pelipper, pel ? leerAnims(pel) : {});
    this.prepararCarga();
    this.scene.start('preload');
  }
}
