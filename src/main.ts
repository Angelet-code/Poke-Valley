import Phaser from 'phaser';
import { S, VH, VW } from './config';
import { Boot } from './scenes/Boot';
import { Preload } from './scenes/Preload';
import { Title } from './scenes/Title';
import { WorldScene } from './scenes/WorldScene';
import { UIScene } from './scenes/UIScene';
import { Aventura } from './scenes/Aventura';
import { HudAventura } from './scenes/HudAventura';
import { Galeria } from './scenes/Galeria';
import { Evolucion } from './scenes/Evolucion';
import { Eleccion } from './scenes/Eleccion';
import { CargaMapa } from './scenes/carga';
import { MapaZona } from './scenes/MapaZona';

const game = new Phaser.Game({
  type: Phaser.WEBGL,
  parent: 'game',
  width: VW * S,
  height: VH * S,
  pixelArt: true,
  roundPixels: true,
  backgroundColor: '#151a12',
  render: { maxLights: 16 },   // Light2D del mapa dibujo: farolas y hoguera a la vista a la vez
  scene: [Boot, Preload, Title, WorldScene, UIScene, Aventura, HudAventura, Galeria, Evolucion, MapaZona, Eleccion, CargaMapa],
});

// Prototipo: no pausar el juego cuando la pestaña queda oculta (Phaser lo hace por defecto).
game.events.once(Phaser.Core.Events.READY, () => game.events.removeAllListeners(Phaser.Core.Events.HIDDEN));

// La escala elegida (S baja a la mitad si la ventana mide menos de 960×540 px de CSS, etc.).
console.info(`Vista: zoom ${S} (ventana ${innerWidth}×${innerHeight}, devicePixelRatio ${devicePixelRatio})`);

// Para depurar desde la consola del navegador.
(window as unknown as { pv: Phaser.Game }).pv = game;

// La vista se calcula con el tamaño de la ventana al arrancar (config.ts): si cambia, se recarga.
let tRedim = 0;
addEventListener('resize', () => { clearTimeout(tRedim); tRedim = window.setTimeout(() => location.reload(), 400); });
