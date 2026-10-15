// Pantalla de carga (Preload): el claro Arcane del título en penumbra, el logo y, abajo, un Pokémon en su primera
// forma (al azar, lo elige Boot) que camina hacia la derecha encima de una barra de progreso: la barra se va
// llenando detrás de él, como si la pintase al andar. Estilo del título: azul noche, ribete de oro y turquesa.
// La misma pantalla tapa el montaje de cada mapa del modo aventura (escena CargaMapa, encima de Aventura y del HUD).
import Phaser from 'phaser';
import { S, VH, VW } from '../config';
import { FUENTE } from './UIScene';

export const REG_CARGA = 'carga';          // registro: { dex, nombre } del Pokémon que camina (Boot)
export const TEX_CARGA = 'carga-walk';     // su hoja Walk; animación `${TEX_CARGA}-der`
const k = S / 3, D = (v: number) => v * k;
const P = Math.max(1, Math.round(4 * S / 3));
const VEL = 0.55;                          // fracción de la barra por segundo como mucho: nunca va a saltos

export class PantallaCarga {
  private real = 0;                        // lo que dice el cargador (0-1)
  private visto = 0;                       // lo que se dibuja: persigue a `real` andando
  private relleno: Phaser.GameObjects.Graphics;
  private poke: Phaser.GameObjects.Sprite | null = null;
  private txt: Phaser.GameObjects.Text;
  private x0: number; private x1: number; private y: number; private h: number;
  private fin: (() => void) | null = null;

  private texto: string;
  private rapidez: number;              // fracción de la barra por segundo como mucho

  // `cargador`: el progreso sale del cargador de la escena (Preload); si no, lo va diciendo `progreso` (CargaMapa).
  constructor(scene: Phaser.Scene, op: { texto?: string; vel?: number; cargador?: boolean } = {}) {
    this.texto = op.texto ?? 'Cargando el valle…'; this.rapidez = op.vel ?? VEL;
    const W = VW * S, H = VH * S;
    if (scene.textures.exists('tit-fondo')) {
      scene.textures.get('tit-fondo').setFilter(Phaser.Textures.FilterMode.LINEAR);
      const im = scene.add.image(W / 2, H / 2, 'tit-fondo');
      im.setScale(Math.max(W / im.width, H / im.height));
    }
    scene.add.rectangle(0, 0, W, H, 0x0a0c1c, 0.6).setOrigin(0);
    if (scene.textures.exists('tit-logo')) scene.add.image(W / 2, H * 0.36, 'tit-logo').setScale(Math.max(1, Math.round(2 * S / 3)));

    // Barra: sombra dura, borde marrón, ribete de oro y fondo azul noche (como los botones del título).
    this.h = D(28); this.x0 = Math.round(W * 0.12); this.x1 = Math.round(W * 0.88); this.y = Math.round(H - D(120));
    const g = scene.add.graphics(), b = D(4), w = this.x1 - this.x0;
    g.fillStyle(0x0a0c1c).fillRect(this.x0 - b + D(4), this.y - b + D(4), w + 2 * b, this.h + 2 * b);
    g.fillStyle(0x2e1a14).fillRect(this.x0 - 2 * b, this.y - 2 * b, w + 4 * b, this.h + 4 * b);
    g.fillStyle(0xc48830).fillRect(this.x0 - b, this.y - b, w + 2 * b, this.h + 2 * b);
    g.fillStyle(0x10142c).fillRect(this.x0, this.y, w, this.h);
    this.relleno = scene.add.graphics();
    this.txt = scene.add.text(W / 2, this.y + this.h + D(34), `${this.texto} 0 %`, { fontFamily: `"Pixelify Sans", ${FUENTE}`, fontSize: `${D(20)}px`, color: '#e8e2cc' }).setOrigin(0.5);

    const reg = scene.registry.get(REG_CARGA) as { dex: string; nombre: string } | undefined;
    if (reg && scene.anims.exists(`${TEX_CARGA}-der`)) {
      // Pies sobre la barra: la fila más baja con píxeles del primer fotograma.
      const fr = scene.textures.getFrame(TEX_CARGA, 0);
      this.poke = scene.add.sprite(this.x0, this.y, TEX_CARGA, 0).setScale(P).play(`${TEX_CARGA}-der`);
      this.poke.setOrigin(0.5, (pie(fr) + 1) / fr.height);
    }
    scene.events.on(Phaser.Scenes.Events.UPDATE, this.paso, this);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => scene.events.off(Phaser.Scenes.Events.UPDATE, this.paso, this));
    if (op.cargador !== false) scene.load.on('progress', (p: number) => { this.real = p; });
  }

  // Progreso dicho a mano (0-1); nunca vuelve atrás.
  progreso(p: number): void { this.real = Math.max(this.real, Math.min(1, p)); }

  // Al acabar la carga: espera a que el Pokémon llegue al final de la barra.
  alTerminar(f: () => void): void {
    this.real = 1;
    this.fin = f;
  }

  private quieto = 0;                      // ms sin avanzar
  private vel = 0;                         // px/s, suavizada

  private paso(_t: number, dt: number): void {
    const antes = this.visto;
    this.visto = Math.min(this.real, this.visto + this.rapidez * dt / 1000);
    const x = this.x0 + (this.x1 - this.x0) * this.visto, b = D(4);
    const v = dt > 0 ? (this.visto - antes) * (this.x1 - this.x0) * 1000 / dt : 0;
    this.vel += (v - this.vel) * Math.min(1, dt / 150);
    this.quieto = v > 0 ? 0 : this.quieto + dt;
    this.relleno.clear();
    if (x > this.x0) {
      this.relleno.fillStyle(0x227884).fillRect(this.x0, this.y, x - this.x0, this.h);
      this.relleno.fillStyle(0x48c4c4).fillRect(this.x0, this.y, x - this.x0, this.h - b);
      this.relleno.fillStyle(0xb0f6ec).fillRect(this.x0, this.y, x - this.x0, b);
    }
    if (this.poke) {
      this.poke.x = Math.round(x);
      this.poke.y = this.y;
      // Las patas al ritmo de lo que avanza: la animación PMD va a ~40 px de pantalla por segundo y zoom; más rápido,
      // se acelera (hasta ×4). Quieto si lleva un rato sin avanzar (no camina en el sitio ni da tirones).
      this.poke.anims.timeScale = Phaser.Math.Clamp(this.vel / (P * 40), 1, 4);
      const anda = this.quieto < 200;
      if (anda && this.poke.anims.isPaused) this.poke.anims.resume();
      else if (!anda && this.poke.anims.isPlaying) this.poke.anims.pause();
    }
    this.txt.setText(`${this.texto} ${Math.round(this.visto * 100)} %`);
    if (this.fin && this.visto >= 1) { const f = this.fin; this.fin = null; f(); }
  }
}

// Pantalla de carga al cambiar de mapa (Aventura.montar): se lanza encima y se va con un fundido cuando el Pokémon
// llega al final. Más rápida que la del arranque (el montaje de un mapa dura poco).
export class CargaMapa extends Phaser.Scene {
  private pantalla: PantallaCarga | null = null;
  private pendiente = 0;
  private acabar = false;
  constructor() { super('cargaMapa'); }

  create(): void {
    this.pantalla = new PantallaCarga(this, { texto: 'Preparando el mapa…', vel: 1.6, cargador: false });
    this.pantalla.progreso(this.pendiente);
    if (this.acabar) this.terminar();
  }
  // Puede llegar antes de que la escena se haya creado (se lanza en el mismo paso): se guarda para entonces.
  progreso(p: number): void { this.pendiente = Math.max(this.pendiente, p); this.pantalla?.progreso(p); }
  terminar(): void {
    this.acabar = true;
    this.pantalla?.alTerminar(() => {
      this.tweens.add({ targets: this.cameras.main, alpha: 0, duration: 250, onComplete: () => this.scene.stop() });
    });
  }
  // Para relanzarla limpia (otro cambio de mapa).
  reiniciar(): void { this.pendiente = 0; this.acabar = false; this.pantalla = null; }
}

// Fila más baja con algún píxel opaco de un fotograma (los de PMD traen margen transparente).
function pie(fr: Phaser.Textures.Frame): number {
  const c = document.createElement('canvas'); c.width = fr.cutWidth; c.height = fr.cutHeight;
  const g = c.getContext('2d')!;
  g.drawImage(fr.source.image as CanvasImageSource, fr.cutX, fr.cutY, fr.cutWidth, fr.cutHeight, 0, 0, fr.cutWidth, fr.cutHeight);
  const d = g.getImageData(0, 0, c.width, c.height).data;
  for (let y = c.height - 1; y >= 0; y--) for (let x = 0; x < c.width; x++) if (d[(y * c.width + x) * 4 + 3] > 40) return y;
  return c.height - 1;
}
