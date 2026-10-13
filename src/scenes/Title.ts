// Título mínimo: continuar la partida guardada o empezar una nueva.
import Phaser from 'phaser';
import { NUEVA, S, VH, VW } from '../config';
import { World } from '../sim/World';
import { FUENTE } from './UIScene';

export class Title extends Phaser.Scene {
  constructor() { super('title'); }

  create(): void {
    const cx = VW * S / 2, cy = VH * S / 2, hay = World.hayPartida() && !NUEVA;
    this.cameras.main.setBackgroundColor('#1d2a1a');
    this.add.text(cx, cy - 40 * S, 'Pokémon Valley', { fontFamily: FUENTE, fontSize: `${16 * S}px`, color: '#e4ecd8', fontStyle: 'bold' }).setOrigin(0.5);
    this.add.text(cx, cy - 22 * S, 'prototipo 0.1 · recolección', { fontFamily: FUENTE, fontSize: `${6 * S}px`, color: '#9fb08a' }).setOrigin(0.5);
    const b = this.add.sprite(cx, cy + 6 * S, 'b-Idle', 0).setScale(S);
    this.tweens.add({ targets: b, y: cy + 4 * S, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    const lineas = hay
      ? ['Intro / clic: continuar la partida', 'N: nueva partida (borra la guardada)']
      : ['Intro / clic: empezar'];
    this.add.text(cx, cy + 34 * S, lineas.join('\n'), { fontFamily: FUENTE, fontSize: `${6 * S}px`, color: '#e4ecd8', align: 'center', lineSpacing: 3 * S }).setOrigin(0.5);
    this.add.text(cx, cy + 62 * S, 'WASD mover · clic izq. Látigo Cepa (cosechar) · F / espacio: recoger, sembrar, caja, dormir\nrueda o Q/E elegir objeto · M mapa · Esc título',
      { fontFamily: FUENTE, fontSize: `${5 * S}px`, color: '#9fb08a', align: 'center', lineSpacing: 2 * S }).setOrigin(0.5);
    this.add.text(cx, VH * S - 6 * S, 'Sprites: SpriteCollab (CC BY-NC 4.0) · bayas: pokeemerald · fangame sin ánimo de lucro',
      { fontFamily: FUENTE, fontSize: `${4 * S}px`, color: '#6d7d5c' }).setOrigin(0.5);

    const empezar = (nueva: boolean) => {
      if (nueva) World.borrarPartida();
      this.scene.start('world', { nueva: nueva || !hay });
    };
    this.input.keyboard!.once('keydown-ENTER', () => empezar(false));
    this.input.keyboard!.once('keydown-SPACE', () => empezar(false));
    this.input.once('pointerdown', () => empezar(false));
    if (hay) this.input.keyboard!.once('keydown-N', () => empezar(true));
  }
}
