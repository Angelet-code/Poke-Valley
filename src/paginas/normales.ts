// Demo de iluminación con mapas de normales (pipeline Light2D de Phaser) sobre Bulbasaur.
// Los mapas los genera tools/normales_pokemon.py (<Anim>-Normal.png junto a cada hoja PMD).
// Fila de arriba: hoja cargada con normalMap. Fila de abajo: la misma hoja sin él (como el juego hoy).
import Phaser from 'phaser';

const VW = 300, VH = 190, ZOOM = 4, DIRS = 8;

import { CelPipeline, pipelineCel } from '../render/CelPipeline';

const RUTA = '/assets/sprites/pokemon/0001/';
const ANIMS = { Walk: { fw: 40, fh: 40, durs: [4, 4, 4, 4, 4, 4] }, Idle: { fw: 32, fh: 40, durs: [40, 6, 6] } } as const;
type Anim = keyof typeof ANIMS;

class Demo extends Phaser.Scene {
  private luz!: Phaser.GameObjects.Light;
  private con: Phaser.GameObjects.Sprite[] = [];
  private sin: Phaser.GameObjects.Sprite[] = [];
  private modo: 'raton' | 'dia' = 'raton';
  private anim: Anim = 'Walk';
  private normales = true;
  private intensidad = 0.8;
  private t0 = 0;
  private cartel!: Phaser.GameObjects.Text;
  private cel = true;

  preload(): void {
    this.load.image('cesped', '/assets/game/cesped_0.png');
    for (const a of Object.keys(ANIMS) as Anim[]) {
      const { fw, fh } = ANIMS[a];
      this.load.spritesheet({ key: `bn-${a}`, url: `${RUTA}${a}-Luz.png`, normalMap: `${RUTA}${a}-Normal.png`, frameConfig: { frameWidth: fw, frameHeight: fh } });
      this.load.spritesheet(`b-${a}`, `${RUTA}${a}-Anim.png`, { frameWidth: fw, frameHeight: fh });
    }
    this.load.image('mapa', `${RUTA}Idle-Normal.png`);
  }

  create(): void {
    for (const k of this.textures.getTextureKeys()) this.textures.get(k).setFilter(Phaser.Textures.FilterMode.NEAREST);
    for (const a of Object.keys(ANIMS) as Anim[]) for (const pre of ['bn', 'b']) for (let r = 0; r < DIRS; r++) {
      const d = ANIMS[a].durs;
      this.anims.create({ key: `${pre}-${a}-${r}`, repeat: -1, frames: d.map((dur, k) => ({ key: `${pre}-${a}`, frame: r * d.length + k, duration: dur * 1000 / 60 })) });
    }

    // Lienzo a resolución completa y cámara a ×ZOOM: los sprites se ven a píxel gordo y el texto queda nítido.
    this.cameras.main.setZoom(ZOOM).centerOn(VW / 2, VH / 2);
    this.add.tileSprite(0, 0, VW, VH, 'cesped').setOrigin(0).setPipeline('Light2D');
    pipelineCel(this);
    this.lights.enable().setAmbientColor(0x2e3640);
    this.luz = this.lights.addLight(VW / 2, 40, 170, 0xffffff, this.intensidad);

    const paso = 34, x0 = 20;
    for (let r = 0; r < DIRS; r++) {
      const x = x0 + r * paso;
      this.add.ellipse(x, 78, 14, 5, 0x1e3018, 0.35);
      this.add.ellipse(x, 148, 14, 5, 0x1e3018, 0.35);
      this.con.push(this.add.sprite(x, 62, 'bn-Walk').setPipeline('Cel'));
      this.sin.push(this.add.sprite(x, 132, 'b-Walk').setPipeline('Light2D'));
    }
    this.aplicarAnim();

    // Etiquetas nítidas a zoom 4: texto grande escalado a 1/ZOOM.
    const txt = (x: number, y: number, s: string) => {
      const t = this.add.text(x, y, s, { fontFamily: '"Segoe UI", system-ui, sans-serif', fontSize: `${6 * ZOOM}px`, color: '#e4ecd8', stroke: '#000', strokeThickness: 3 }).setScale(1 / ZOOM);
      t.texture.setFilter(Phaser.Textures.FilterMode.LINEAR); // pixelArt pone NEAREST a todo; el texto, suave
      return t;
    };
    txt(4, 4, 'CON normales');
    txt(4, 92, 'SIN normales');
    this.cartel = txt(4, VH - 12, '');
    // Mapa de normales del primer fotograma de Idle (32×40), a la derecha.
    this.add.image(VW - 36, 80, 'mapa').setOrigin(0).setCrop(0, 0, 32, 40); // solo la primera celda de la hoja
    this.add.rectangle(VW - 36 - 1, 79, 34, 42).setOrigin(0).setStrokeStyle(1, 0xe4ecd8, 0.6);

    this.input.on('pointermove', (p: Phaser.Input.Pointer) => { if (this.modo === 'raton') this.luz.setPosition(p.worldX, p.worldY); });
    const K = this.input.keyboard!;
    K.on('keydown-D', () => { this.modo = 'dia'; this.t0 = this.time.now; });
    K.on('keydown-M', () => { this.modo = 'raton'; this.luz.setColor(0xffffff).setIntensity(this.intensidad); this.lights.setAmbientColor(0x2e3640); });
    K.on('keydown-A', () => { this.anim = this.anim === 'Walk' ? 'Idle' : 'Walk'; this.aplicarAnim(); });
    K.on('keydown-N', () => { this.normales = !this.normales; this.aplicarAnim(); });
    K.on('keydown-C', () => { this.cel = !this.cel; this.con.forEach(s => s.setPipeline(this.cel ? 'Cel' : 'Light2D')); });
    const cel = (this.renderer as Phaser.Renderer.WebGL.WebGLRenderer).pipelines.get('Cel') as CelPipeline;
    K.on('keydown-B', () => { cel.bandas = cel.bandas >= 4 ? 2 : cel.bandas + 1; });
    K.on('keydown-U', () => { cel.umbral = cel.umbral >= 0.35 ? -0.1 : cel.umbral + 0.15; });
    K.on('keydown-H', () => { cel.altura = cel.altura >= 0.8 ? 0.1 : +(cel.altura + 0.15).toFixed(2); });
    K.on('keydown-S', () => { cel.suave = cel.suave >= 0.95 ? 0 : +(cel.suave + 0.25).toFixed(2); });
    K.on('keydown-Z', () => { const c = this.cameras.main; c.setZoom(c.zoom >= ZOOM * 2 ? ZOOM : ZOOM * 2); });
    const inten = (d: number) => { this.intensidad = Phaser.Math.Clamp(this.intensidad + d, 0.2, 5); if (this.modo === 'raton') this.luz.setIntensity(this.intensidad); };
    K.on('keydown-PLUS', () => inten(0.2)); K.on('keydown-NUMPAD_ADD', () => inten(0.2));
    K.on('keydown-MINUS', () => inten(-0.2)); K.on('keydown-NUMPAD_SUBTRACT', () => inten(-0.2));
    (window as unknown as { demo: Demo }).demo = this;
  }

  private aplicarAnim(): void {
    const pre = this.normales ? 'bn' : 'b';
    this.con.forEach((s, r) => s.play(`${pre}-${this.anim}-${r}`));
    this.sin.forEach((s, r) => s.play(`b-${this.anim}-${r}`));
  }

  update(time: number): void {
    if (this.modo === 'dia') {
      // Arco de sol en 16 s: amanece a la izquierda (naranja), mediodía arriba (blanco), atardece a la derecha (rojo), noche breve.
      const t = ((time - this.t0) / 16000) % 1;
      const dia = t < 0.8, u = dia ? t / 0.8 : 0;
      const ang = Math.PI * (1 - u);
      this.luz.setPosition(VW / 2 + Math.cos(ang) * (VW / 2 + 40), 95 - Math.sin(ang) * 120);
      const alt = Math.sin(ang); // 0 horizonte, 1 cénit
      const calido = new Phaser.Display.Color(255, 150, 70), blanco = new Phaser.Display.Color(255, 250, 235);
      const c = Phaser.Display.Color.Interpolate.ColorWithColor(calido, blanco, 100, Math.round(100 * Math.min(1, alt * 1.6))) as Phaser.Types.Display.ColorObject;
      this.luz.setColor(dia ? Phaser.Display.Color.GetColor(c.r, c.g, c.b) : 0x6080c0).setIntensity(dia ? this.intensidad * (0.6 + 0.6 * alt) : 0.5);
      const amb = (dia ? Phaser.Display.Color.Interpolate.ColorWithColor(new Phaser.Display.Color(40, 44, 80), new Phaser.Display.Color(110, 112, 110), 100, Math.round(100 * alt)) : new Phaser.Display.Color(20, 24, 50)) as Phaser.Types.Display.ColorObject;
      this.lights.setAmbientColor(Phaser.Display.Color.GetColor(amb.r, amb.g, amb.b));
      if (!dia) this.luz.setPosition(VW / 2, -60);
      this.cartel.setText(dia ? (u < 0.25 ? 'amanecer' : u < 0.75 ? 'mediodía' : 'atardecer') : 'noche');
    } else {
      const cel = (this.renderer as Phaser.Renderer.WebGL.WebGLRenderer).pipelines.get('Cel') as CelPipeline;
      this.cartel.setText(`luz: ratón · intensidad ${this.intensidad.toFixed(1)} · ${this.anim} · normales ${this.normales ? 'sí' : 'no'} · ${this.cel ? `cel ${cel.bandas} bandas, umbral ${cel.umbral.toFixed(2)}, altura ${cel.altura}, transición ${cel.suave}` : 'suave'}`);
    }
  }
}

new Phaser.Game({
  type: Phaser.WEBGL, parent: 'game', pixelArt: true, roundPixels: true, backgroundColor: '#151a12', scene: [Demo],
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_HORIZONTALLY, width: VW * ZOOM, height: VH * ZOOM },
});
