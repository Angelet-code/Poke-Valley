import Phaser from 'phaser';
import { S, VH, VW } from './config';
import { Boot } from './scenes/Boot';
import { LabScene } from './scenes/LabScene';

// Sin pixelArt global: el dibujo va suave (LINEAR); solo el Pokémon lleva NEAREST (LabScene.create).
const game = new Phaser.Game({
  type: Phaser.WEBGL,
  parent: 'game',
  width: VW * S,
  height: VH * S,
  pixelArt: false,
  antialias: true,
  roundPixels: true,
  backgroundColor: '#1a1d16',
  render: { maxLights: 16 },   // Light2D (modo noche): farolas + hoguera a la vista a la vez
  scene: [Boot, LabScene],
});
game.events.once(Phaser.Core.Events.READY, () => game.events.removeAllListeners(Phaser.Core.Events.HIDDEN));
(window as unknown as { pv: Phaser.Game }).pv = game;
