// Preload: todas las imágenes (terreno, árboles, rocas, objetos pixel art, bayas, Bulbasaur).
import Phaser from 'phaser';
import { A, REG, S, VH, VW, type AnimSet } from '../config';
import type { BayasData, ObjCatalog } from '../data/types';
import { Terrain } from '../render/Terrain';

export const TREE_N = 4, ROCK_N = 4;

export class Preload extends Phaser.Scene {
  constructor() { super('preload'); }

  preload(): void {
    const txt = this.add.text(VW * S / 2, VH * S / 2, 'Cargando el valle…', { fontFamily: '"Segoe UI", system-ui, sans-serif', fontSize: `${7 * S}px`, color: '#e4ecd8' }).setOrigin(0.5);
    this.load.on('progress', (p: number) => txt.setText(`Cargando el valle… ${Math.round(p * 100)} %`));
    this.load.on('loaderror', (f: Phaser.Loader.File) => console.warn('No se pudo cargar', f.key, f.url));

    Terrain.preload(this, A);
    for (let i = 0; i < TREE_N; i++) this.load.image('arbol' + i, `${A}game/arboles/arbol_${i}.png`);
    for (let i = 0; i < ROCK_N; i++) this.load.image('roca' + i, `${A}game/rocas/roca_${i}.png`);

    const objs = this.registry.get(REG.objs) as ObjCatalog;
    for (const id in objs) {
      this.load.image('obj_' + id, `${A}game/pixel/${objs[id].archivo}`);
      if (objs[id].icono) this.load.image('icono_' + id, `${A}game/pixel/${objs[id].icono}`);
    }

    const bayas = this.registry.get(REG.bayas) as BayasData, B = `${A}sprites/bayas/`;
    this.load.image('baya_tierra', B + bayas.tierra.png);
    this.load.spritesheet('baya_brote', B + bayas.brote.png, { frameWidth: bayas.brote.frame[0], frameHeight: bayas.brote.frame[1] });
    for (const [id, b] of Object.entries(bayas.bayas)) {
      this.load.spritesheet('baya_' + id, B + b.png, { frameWidth: bayas.arbol.frame[0], frameHeight: bayas.arbol.frame[1] });
      this.load.image('icono_' + id, B + b.icono);
    }

    const anims = this.registry.get(REG.anims) as AnimSet;
    for (const name in anims) this.load.spritesheet('b-' + name, `${A}sprites/pokemon/0001/${name}-Anim.png`, { frameWidth: anims[name].fw, frameHeight: anims[name].fh });
  }

  create(): void {
    // Pixel art a escala nativa: filtro NEAREST para que el zoom entero no lo emborrone.
    for (const key of this.textures.getTextureKeys()) {
      if (/^(obj_|baya_|icono_|b-)/.test(key)) this.textures.get(key).setFilter(Phaser.Textures.FilterMode.NEAREST);
    }
    const anims = this.registry.get(REG.anims) as AnimSet;
    // Caminar: animación Walk. Quieto: primer fotograma de Idle (el resto es un saltito).
    for (let r = 0; r < 8; r++) {
      const w = anims.Walk, i = anims.Idle;
      this.anims.create({ key: `b-Walk-${r}`, repeat: -1, frames: w.durs.map((d, k) => ({ key: 'b-Walk', frame: r * w.durs.length + k, duration: d * 1000 / 60 })) });
      this.anims.create({ key: `b-Idle-${r}`, frames: [{ key: 'b-Idle', frame: r * i.durs.length }] });
    }
    if (anims.Sleep) this.anims.create({ key: 'b-Sleep', repeat: -1, frames: anims.Sleep.durs.map((d, k) => ({ key: 'b-Sleep', frame: k, duration: d * 1000 / 60 })) });
    this.scene.start('title');
  }
}
