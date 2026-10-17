// Pantalla «Mando» del título: tipo de mando (Automático, Xbox, Nintendo, PlayStation: pone sus botones por defecto
// y los nombres de sus caras), lista de acciones con su botón (la marcada se reasigna pulsando un botón del mando;
// manteniendo «más» se asigna a la segunda capa) y botones «Por defecto» y «Volver». Se guarda al momento
// (src/entrada/asignacion.ts).
import Phaser from 'phaser';
import { S, VH, VW } from '../config';
import { FUENTE } from './UIScene';
import { ACCIONES, DISPOSICIONES, MAS, config, disposicion, disposicionDetectada, elegirDisposicion, guardar, nombreBoton, restablecer } from '../entrada/asignacion';
import { mando } from '../entrada/mando';

const k = S / 3, D = (v: number) => v * k;
const F = `"Pixelify Sans", ${FUENTE}`;
const COLS = 2, FILA = 30, TOP = 230, ANCHO_COL = 560, SEP = 40;

interface Boton { g: Phaser.GameObjects.Graphics; txt: Phaser.GameObjects.Text; x: number; y: number; w: number; h: number }

export class ConfigMando extends Phaser.Scene {
  private sel = 0;
  private filas: { nombre: Phaser.GameObjects.Text; boton: Phaser.GameObjects.Text; marco: Phaser.GameObjects.Graphics }[] = [];
  private tipos: Boton[] = [];
  private estado!: Phaser.GameObjects.Text;
  private nota!: Phaser.GameObjects.Text;

  constructor() { super('mando'); }

  create(): void {
    const W = VW * S, H = VH * S, cx = W / k / 2, ph = H / k;
    this.sel = 0; this.filas = []; this.tipos = [];
    this.add.rectangle(0, 0, W, H, 0x10142c).setOrigin(0);
    const g = this.add.graphics(), px = cx - 600, pw = 1200, py = 40, phh = ph - 80;
    g.fillStyle(0x0a0c1c).fillRect(D(px + 6), D(py + 6), D(pw), D(phh));
    g.fillStyle(0x2e1a14).fillRect(D(px), D(py), D(pw), D(phh));
    g.fillStyle(0xc48830).fillRect(D(px + 4), D(py + 4), D(pw - 8), D(phh - 8));
    g.fillStyle(0x1e264e).fillRect(D(px + 8), D(py + 8), D(pw - 16), D(phh - 16));
    this.texto(cx, py + 40, 'Mando', 30, '#fae296', { fontStyle: 'bold' }).setOrigin(0.5);
    this.estado = this.texto(cx, py + 76, '', 16, '#b8bedc').setOrigin(0.5);

    // Tipo de mando: elegirlo pone sus botones por defecto.
    this.texto(cx - 560, py + 118, 'Tipo de mando', 17, '#e8e2cc').setOrigin(0, 0.5);
    const BW = 190, BH = 34, GAP = 12, bx0 = cx - 560 + 170;
    DISPOSICIONES.forEach((d, i) => {
      const b = this.boton(bx0 + i * (BW + GAP), py + 101, BW, BH, d.nombre, () => { elegirDisposicion(d.id); this.aviso(`Botones por defecto de ${this.nombreTipo(d.id)}`); this.repintar(); });
      this.tipos.push(b);
    });

    const porCol = Math.ceil(ACCIONES.length / COLS), x0 = cx - (COLS * ANCHO_COL + (COLS - 1) * SEP) / 2;
    ACCIONES.forEach((a, i) => {
      const c = Math.floor(i / porCol), f = i % porCol, x = x0 + c * (ANCHO_COL + SEP), y = TOP + f * FILA;
      const marco = this.add.graphics();
      marco.fillStyle(0x30264e).fillRect(D(x - 8), D(y - FILA / 2 + 2), D(ANCHO_COL + 16), D(FILA - 4));
      marco.lineStyle(D(2), 0x48c4c4).strokeRect(D(x - 8), D(y - FILA / 2 + 2), D(ANCHO_COL + 16), D(FILA - 4));
      const nombre = this.texto(x, y, a.nombre, 17, '#e8e2cc').setOrigin(0, 0.5);
      const boton = this.texto(x + ANCHO_COL, y, '', 18, '#fae296', { fontStyle: 'bold' }).setOrigin(1, 0.5);
      const zona = this.add.zone(D(x - 8), D(y - FILA / 2), D(ANCHO_COL + 16), D(FILA)).setOrigin(0).setInteractive({ useHandCursor: true });
      zona.on('pointerdown', (p: Phaser.Input.Pointer) => { this.sel = i; if (p.rightButtonDown()) this.asignar(null); this.repintar(); });
      this.filas.push({ nombre, boton, marco });
    });
    this.input.mouse!.disableContextMenu();

    // Abajo: por defecto y volver, y la ayuda.
    this.boton(cx - 300 - 10, ph - 136, 300, 40, 'Por defecto  (R)', () => { restablecer(); this.aviso(`Botones por defecto de ${this.nombreTipo(config.disposicion)}`); this.repintar(); });
    this.boton(cx + 10, ph - 136, 300, 40, 'Volver  (Esc)', () => this.scene.start('title'));
    this.nota = this.texto(cx, ph - 86, '', 15, '#9be38a').setOrigin(0.5);
    this.texto(cx, ph - 62, 'Pulsa en el mando el botón para la acción marcada (manteniendo «más», va a la segunda capa)', 16, '#b8bedc').setOrigin(0.5);
    this.texto(cx, ph - 40, '↑ ↓ o clic: elegir · Intro: dejar · Retroceso o clic derecho: quitar', 16, '#b8bedc').setOrigin(0.5);

    const kb = this.input.keyboard!;
    kb.on('keydown', (e: KeyboardEvent) => {
      if (!e.isTrusted) return;   // solo el teclado de verdad: el mando aquí se captura, no manda teclas
      const n = ACCIONES.length;
      if (e.code === 'ArrowUp' || e.code === 'KeyW') this.sel = (this.sel - 1 + n) % n;
      else if (e.code === 'ArrowDown' || e.code === 'KeyS') this.sel = (this.sel + 1) % n;
      else if (e.code === 'Enter' || e.code === 'Space') this.sel = (this.sel + 1) % n;
      else if (e.code === 'Backspace' || e.code === 'Delete') { this.asignar(null); return; }
      else if (e.code === 'KeyR') { restablecer(); this.aviso(`Botones por defecto de ${this.nombreTipo(config.disposicion)}`); }
      else if (e.code === 'Escape') { this.scene.start('title'); return; }
      this.repintar();
    });
    if (mando) mando.capturar = c => this.asignar(c);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => { if (mando) mando.capturar = null; });
    this.repintar();
    document.fonts?.ready.then(() => { if (this.sys.isActive()) this.children.each(o => { if (o instanceof Phaser.GameObjects.Text) o.updateText(); }); });
  }

  update(): void {
    const hay = mando?.hay, txt = hay ? `Conectado: ${mando!.nombre.replace(/\s*\(.*$/, '').slice(0, 60)}` : 'Ningún mando detectado: conecta uno y pulsa cualquier botón';
    if (this.estado.text !== txt) { this.estado.setText(txt).setColor(hay ? '#9be38a' : '#f0a070'); this.repintar(); }
  }

  private nombreTipo(id: string): string {
    const d = DISPOSICIONES.find(x => x.id === id)!;
    return id === 'auto' ? `${DISPOSICIONES.find(x => x.id === disposicionDetectada)!.nombre} (detectado)` : d.nombre;
  }

  // Asigna el botón a la acción marcada (null = quitar); si otra acción lo tenía, se la quita. «Más» no admite capa.
  private asignar(codigo: number | null): void {
    const a = ACCIONES[this.sel];
    if (codigo !== null && a.id === 'mas' && codigo >= MAS) codigo -= MAS;
    if (codigo !== null) for (const o of ACCIONES) if (o.id !== a.id && config.asig[o.id] === codigo) { config.asig[o.id] = null; this.aviso(`«${o.nombre}» se queda sin botón`); }
    config.asig[a.id] = codigo;
    guardar();
    if (codigo !== null) this.sel = (this.sel + 1) % ACCIONES.length;
    this.repintar();
  }

  private aviso(s: string): void { this.nota.setText(s); this.time.delayedCall(2500, () => { if (this.nota.text === s) this.nota.setText(''); }); }

  private repintar(): void {
    const disp = disposicion();
    this.tipos.forEach((b, i) => {
      const d = DISPOSICIONES[i], on = config.disposicion === d.id;
      this.pintarBoton(b, on);
      b.txt.setText(d.id === 'auto' ? `Automático (${DISPOSICIONES.find(x => x.id === disposicionDetectada)!.nombre})` : d.nombre);
    });
    this.filas.forEach((f, i) => {
      const on = i === this.sel, c = config.asig[ACCIONES[i].id] ?? null;
      f.marco.setVisible(on);
      f.nombre.setColor(on ? '#fff8d6' : '#e8e2cc');
      f.boton.setText(nombreBoton(c, disp)).setColor(c === null ? '#8a8aa0' : on ? '#fff8d6' : '#fae296');
    });
  }

  // Botón del estilo del título (azul noche con ribete de oro); el elegido, más claro y con borde turquesa.
  private boton(x: number, y: number, w: number, h: number, texto: string, hacer: () => void): Boton {
    const g = this.add.graphics();
    const txt = this.texto(x + w / 2, y + h / 2, texto, 16, '#fae296', { fontStyle: 'bold' }).setOrigin(0.5);
    const b = { g, txt, x, y, w, h };
    this.pintarBoton(b, false);
    const zona = this.add.zone(D(x), D(y), D(w), D(h)).setOrigin(0).setInteractive({ useHandCursor: true });
    zona.on('pointerdown', hacer);
    return b;
  }
  private pintarBoton(b: Boton, on: boolean): void {
    const { g, x, y, w, h } = b;
    g.clear();
    g.fillStyle(0x0a0c1c).fillRect(D(x + 3), D(y + 3), D(w), D(h));
    g.fillStyle(on ? 0x48c4c4 : 0x2e1a14).fillRect(D(x), D(y), D(w), D(h));
    g.fillStyle(0xc48830).fillRect(D(x + 3), D(y + 3), D(w - 6), D(h - 6));
    g.fillStyle(on ? 0x30264e : 0x10142c).fillRect(D(x + 6), D(y + 6), D(w - 12), D(h - 12));
    b.txt.setColor(on ? '#fff8d6' : '#fae296');
  }

  private texto(x: number, y: number, s: string, px: number, color: string, extra: Phaser.Types.GameObjects.Text.TextStyle = {}) {
    return this.add.text(D(x), D(y), s, { fontFamily: F, fontSize: `${D(px)}px`, color, ...extra });
  }
}
