import Phaser from 'phaser';
import { S, VH, VW } from './config';
import { Boot } from './scenes/Boot';
import { Preload } from './scenes/Preload';
import { Title } from './scenes/Title';
import { WorldScene } from './scenes/WorldScene';
import { UIScene } from './scenes/UIScene';

const game = new Phaser.Game({
  type: Phaser.WEBGL,
  parent: 'game',
  width: VW * S,
  height: VH * S,
  pixelArt: true,
  roundPixels: true,
  backgroundColor: '#151a12',
  render: { maxLights: 16 },   // Light2D del mapa dibujo: farolas y hoguera a la vista a la vez
  scene: [Boot, Preload, Title, WorldScene, UIScene],
});

// Prototipo: no pausar el juego cuando la pestaña queda oculta (Phaser lo hace por defecto).
game.events.once(Phaser.Core.Events.READY, () => game.events.removeAllListeners(Phaser.Core.Events.HIDDEN));

// Para depurar desde la consola del navegador.
(window as unknown as { pv: Phaser.Game }).pv = game;
