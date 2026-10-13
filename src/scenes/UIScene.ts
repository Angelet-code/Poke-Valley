// HUD superpuesto al valle (escena paralela, sin zoom): reloj, dinero, energía, inventario
// y avisos. Lee el estado de la simulación a través de la escena del mundo.
import Phaser from 'phaser';
import { S, VH, VW } from '../config';
import { ITEMS } from '../data/items';
import { ENERGIA_MAX } from '../sim/World';
import type { WorldScene } from './WorldScene';

const SLOT = 22;              // lado de cada casilla del inventario (px base)
export const FUENTE = '"Segoe UI", system-ui, -apple-system, sans-serif';

export class UIScene extends Phaser.Scene {
  private world!: WorldScene;
  private reloj!: Phaser.GameObjects.Text;
  private energia!: Phaser.GameObjects.Graphics;
  private avisoTxt!: Phaser.GameObjects.Text;
  private avisoTimer?: Phaser.Time.TimerEvent;
  private slots: { fondo: Phaser.GameObjects.Rectangle; icono: Phaser.GameObjects.Image; num: Phaser.GameObjects.Text }[] = [];
  private nombre!: Phaser.GameObjects.Text;
  private noche!: Phaser.GameObjects.Rectangle;

  constructor() { super('ui'); }

  create(): void {
    this.world = this.scene.get('world') as WorldScene;
    // Texto legible: fuente del sistema sin contorno, sobre un fondo oscuro translúcido.
    const f = (px: number, color = '#f2f5e8', fondo = true) => ({ fontFamily: FUENTE, fontSize: `${px * S}px`, color,
      backgroundColor: fondo ? 'rgba(26,36,22,.78)' : undefined, padding: { x: 2 * S, y: S } });

    // Tinte de atardecer/noche sobre el valle (bajo el HUD).
    this.noche = this.add.rectangle(0, 0, VW * S, VH * S, 0x101c30, 0).setOrigin(0).setDepth(0);

    // Panel superior derecho: día, hora y dinero.
    this.reloj = this.add.text(VW * S - 4 * S, 4 * S, '', { ...f(7), align: 'right' }).setOrigin(1, 0).setDepth(2);
    // Energía: barra en la esquina superior izquierda.
    this.add.rectangle(4 * S, 4 * S, 60 * S, 8 * S, 0x1a2416, 0.6).setOrigin(0).setDepth(1);
    this.energia = this.add.graphics().setDepth(2);

    // Inventario (12 casillas) abajo en el centro.
    const n = 12, x0 = (VW - n * SLOT) / 2, y0 = VH - SLOT - 4;
    for (let i = 0; i < n; i++) {
      const x = (x0 + i * SLOT) * S, y = y0 * S;
      const fondo = this.add.rectangle(x, y, (SLOT - 2) * S, (SLOT - 2) * S, 0x1a2416, 0.65).setOrigin(0).setStrokeStyle(S, 0x9fb08a, 0.5).setDepth(1);
      const icono = this.add.image(x + (SLOT - 2) * S / 2, y + (SLOT - 2) * S / 2, '__DEFAULT').setScale(S * 0.8).setVisible(false).setDepth(2);
      const num = this.add.text(x + (SLOT - 2) * S, y + (SLOT - 2) * S, '', f(6, '#f2f5e8', false)).setOrigin(1, 1).setDepth(3);
      this.slots.push({ fondo, icono, num });
    }
    this.nombre = this.add.text(VW * S / 2, (y0 - 3) * S, '', f(6, '#e4ecd8')).setOrigin(0.5, 1).setDepth(2);

    this.avisoTxt = this.add.text(VW * S / 2, (VH - 44) * S, '', { ...f(7), align: 'center', wordWrap: { width: 300 * S } }).setOrigin(0.5, 1).setDepth(3).setAlpha(0);
    this.world.events.on('aviso', (txt: string) => this.aviso(txt));
    this.events.once('shutdown', () => this.world.events.off('aviso'));
  }

  aviso(txt: string): void {
    this.avisoTxt.setText(txt).setAlpha(1);
    this.avisoTimer?.remove();
    this.avisoTimer = this.time.delayedCall(2600, () => this.tweens.add({ targets: this.avisoTxt, alpha: 0, duration: 500 }));
  }

  update(): void {
    const sim = this.world.sim;
    if (!sim) return;
    const e = sim.estado;
    this.reloj.setText(`Día ${e.dia}  ${sim.hora.padStart(5, ' ')}${e.lluvia ? ' lluvia' : ''}\n${e.dinero} $`);
    // Energía.
    const g = this.energia, w = 56 * S, h = 4 * S, x = 6 * S, y = 6 * S, k = Math.max(0, e.energia / ENERGIA_MAX);
    g.clear();
    g.fillStyle(0x2c3626, 1).fillRect(x, y, w, h);
    g.fillStyle(k > 0.3 ? 0x8fd36a : 0xe0a04a, 1).fillRect(x, y, w * k, h);
    // Inventario.
    e.inventario.forEach((s, i) => {
      const sl = this.slots[i];
      sl.fondo.setStrokeStyle(S, i === this.world.slot ? 0xffd65a : 0x9fb08a, i === this.world.slot ? 1 : 0.5);
      if (s && ITEMS[s.id] && this.textures.exists(ITEMS[s.id].icono)) {
        sl.icono.setTexture(ITEMS[s.id].icono).setVisible(true);
        const fr = sl.icono.frame, k2 = Math.min(1, 16 / Math.max(fr.width, fr.height));
        sl.icono.setScale(S * k2 * 1.1);
        sl.num.setText(String(s.n));
      } else { sl.icono.setVisible(false); sl.num.setText(''); }
    });
    const sel = e.inventario[this.world.slot];
    this.nombre.setText(sel ? `${ITEMS[sel.id]?.nombre ?? sel.id} · ${ITEMS[sel.id]?.precio ?? 0} $` : '').setVisible(!!sel);
    // Atardecer a partir de las 18:00, noche desde las 21:00.
    const m = e.minuto, t = Phaser.Math.Clamp((m - 18 * 60) / 180, 0, 1);
    this.noche.setAlpha(t * 0.45);
  }
}
