// Elección del Pokémon con el que empiezas una partida del modo aventura. Salen 9 al azar, de 9 tipos distintos,
// todos en su primera forma y ninguno ultra raro; siempre hay al menos 2 iniciales (de cualquier generación).
// Solo se ven sus siluetas: se sabe cuál es al elegirlo, y la elección no tiene vuelta atrás.
// Estilo de la pantalla de título (diseño de Claude Design): azul noche, ribete de oro y turquesa para lo elegido.
import Phaser from 'phaser';
import { S, VH, VW } from '../config';
import { INICIALES, LINEAS, NOMBRE_TIPO, type Tipo } from '../data/pokedex';
import { cargar, clave, info, poner } from '../combate/sprites';
import { FUENTE } from './UIScene';

const k = S / 3, D = (v: number) => v * k;
const F = `"Pixelify Sans", ${FUENTE}`;
const P = Math.max(1, Math.round(5 * S / 3));        // zoom entero del pixel art (×5 en el diseño de 1440 px)
// Rejilla (px del diseño de 1440×810): cartas, hueco, arriba; y el cartel con el nombre al elegir.
const CW = 250, CH = 160, GAP = 22, TOP = 124, ABAJO = TOP + 3 * CH + 2 * GAP;

// Los raros de verdad: los que cada zona de bioma esconde como rareza (data/biomas.ts) y los pseudolegendarios.
const ULTRA_RAROS = ['lapras', 'larvitar', 'misdreavus', 'togepi', 'dratini', 'beldum', 'gible', 'munchlax'];
const ELEMENTALES: Tipo[] = ['planta', 'fuego', 'agua'];

function barajar<T>(xs: T[], rnd: () => number): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
// Las 9 líneas candidatas: 2 o 3 iniciales (de Planta, Fuego o Agua, sin repetir tipo) y el resto, de otros tipos,
// de 3 fases evolutivas (o de 2 en los tipos sin ninguna de 3: Normal, Fuego y Siniestro).
export function candidatos(rnd: () => number = Math.random): string[] {
  const nIni = rnd() < 0.35 ? 3 : 2, out: string[] = [], usados = new Set<Tipo>();
  for (const t of barajar(ELEMENTALES, rnd).slice(0, nIni)) {
    const ops = INICIALES.filter(id => LINEAS[id].tipo === t);
    out.push(ops[Math.floor(rnd() * ops.length)]); usados.add(t);
  }
  const tipos = barajar([...new Set(Object.values(LINEAS).map(l => l.tipo))].filter(t => !usados.has(t)), rnd);
  for (const t of tipos) {
    if (out.length >= 9) break;
    // Con pinta de inicial: líneas de 3 fases; si el tipo no tiene ninguna, de 2. Las que no evolucionan, nunca.
    const todas = Object.values(LINEAS).filter(l => l.tipo === t && !INICIALES.includes(l.id) && !ULTRA_RAROS.includes(l.id));
    const tres = todas.filter(l => l.formas.length >= 3), ops = tres.length ? tres : todas.filter(l => l.formas.length === 2);
    if (ops.length) out.push(ops[Math.floor(rnd() * ops.length)].id);
  }
  return barajar(out, rnd);
}

interface Carta { id: string; dex: string; spr: Phaser.GameObjects.Sprite; borde: Phaser.GameObjects.Graphics; g: Phaser.GameObjects.Graphics; x: number; y: number }

export class Eleccion extends Phaser.Scene {
  private cartas: Carta[] = [];
  private sel = 0;
  private elegido = false;
  private textos: Phaser.GameObjects.Text[] = [];

  constructor() { super('eleccion'); }

  create(): void {
    this.cartas = []; this.sel = 0; this.elegido = false; this.empezando = false; this.textos = []; this.ayuda = null;
    const W = VW * S, H = VH * S, cx = W / k / 2;
    if (this.textures.exists('tit-fondo')) {
      const im = this.add.image(W / 2, H / 2, 'tit-fondo');
      im.setScale(Math.max(W / im.width, H / im.height));
    }
    this.add.rectangle(0, 0, W, H, 0x0a0c1c, 0.62).setOrigin(0);
    this.texto(cx, 52, 'ELIGE A TU COMPAÑERO', 34, '#fae296', { fontStyle: 'bold' }).setOrigin(0.5).setLetterSpacing(D(4));
    this.texto(cx, 92, 'Solo ves su silueta: sabrás quién es cuando lo elijas.', 18, '#b0f6ec').setOrigin(0.5);
    const cargando = this.texto(cx, H / k / 2, 'Buscando Pokémon…', 22, '#e8e2cc').setOrigin(0.5);

    const ids = candidatos(), dexs = ids.map(id => LINEAS[id].formas[0].dex);
    cargar(this, dexs).then(() => {
      if (!this.sys.isActive()) return;
      cargando.destroy();
      this.montar(ids);
    }).catch(e => { console.error(e); cargando.setText('No se pudieron cargar los Pokémon'); });

    const kb = this.input.keyboard!;
    const mover = (dx: number, dy: number) => {
      if (this.elegido || !this.cartas.length) return;
      const c = this.sel % 3, f = Math.floor(this.sel / 3);
      this.sel = ((f + dy + 3) % 3) * 3 + (c + dx + 3) % 3;
      this.marcar();
    };
    kb.on('keydown-LEFT', () => mover(-1, 0)); kb.on('keydown-A', () => mover(-1, 0));
    kb.on('keydown-RIGHT', () => mover(1, 0)); kb.on('keydown-D', () => mover(1, 0));
    kb.on('keydown-UP', () => mover(0, -1)); kb.on('keydown-W', () => mover(0, -1));
    kb.on('keydown-DOWN', () => mover(0, 1)); kb.on('keydown-S', () => mover(0, 1));
    for (const t of ['ENTER', 'SPACE', 'F']) kb.on('keydown-' + t, () => this.aceptar());
    kb.on('keydown-ESC', () => { if (!this.elegido) this.scene.start('title'); });
    document.fonts?.ready.then(() => { if (this.sys.isActive()) this.textos.forEach(t => t.updateText()); });
  }

  private texto(x: number, y: number, s: string, px: number, color: string, extra: Phaser.Types.GameObjects.Text.TextStyle = {}) {
    const t = this.add.text(D(x), D(y), s, { fontFamily: F, fontSize: `${D(px)}px`, color, ...extra });
    this.textos.push(t);
    return t;
  }

  // Rejilla de 3×3 cartas, azul noche con ribete de oro, cada una con su silueta respirando (Idle mirando al frente).
  private montar(ids: string[]): void {
    const cx = VW * S / k / 2, top = TOP;
    const x0 = cx - (3 * CW + 2 * GAP) / 2;
    ids.forEach((id, i) => {
      const dex = LINEAS[id].formas[0].dex, x = x0 + (i % 3) * (CW + GAP), y = top + Math.floor(i / 3) * (CH + GAP);
      const g = this.add.graphics();
      g.fillStyle(0x0a0c1c).fillRect(D(x + 4), D(y + 4), D(CW), D(CH));
      g.fillStyle(0x2e1a14).fillRect(D(x), D(y), D(CW), D(CH));
      g.fillStyle(0xc48830).fillRect(D(x + 4), D(y + 4), D(CW - 8), D(CH - 8));
      g.fillStyle(0x3c4a86).fillRect(D(x + 8), D(y + 8), D(CW - 16), D(CH - 16));
      g.fillStyle(0xb0f6ec, 0.22).fillEllipse(D(x + CW / 2), D(y + CH - 34), D(150), D(30));
      const borde = this.add.graphics();
      borde.lineStyle(D(4), 0x48c4c4).strokeRect(D(x - 4), D(y - 4), D(CW + 8), D(CH + 8));
      const h = info(dex).Idle, spr = this.add.sprite(D(x + CW / 2), D(y + CH - 32), h ? `${clave(dex)}-${h.hoja}` : '__MISSING', 0).setScale(P);
      poner(spr, dex, 'Idle', 0);
      spr.setTintFill(0x0a0c1c);
      const zona = this.add.zone(D(x), D(y), D(CW), D(CH)).setOrigin(0).setInteractive({ useHandCursor: true });
      zona.on('pointerover', () => { if (!this.elegido) { this.sel = i; this.marcar(); } });
      zona.on('pointerdown', () => { if (!this.elegido) { this.sel = i; this.aceptar(); } });
      this.cartas.push({ id, dex, spr, borde, g, x, y });
    });
    this.ayuda = this.texto(cx, ABAJO + 40, 'Flechas o ratón: elegir · Intro / clic: este · Esc: volver', 16, '#e8e2cc').setOrigin(0.5);
    this.marcar();
  }

  private ayuda: Phaser.GameObjects.Text | null = null;

  private marcar(): void {
    this.cartas.forEach((c, i) => c.borde.setVisible(i === this.sel));
  }

  // Elegido: las demás cartas se apagan y la suya se ilumina; la silueta se llena de color y se dice quién es.
  private aceptar(): void {
    if (!this.cartas.length) return;
    if (this.elegido) { if (this.puedeEmpezar) this.empezar(); return; }
    this.elegido = true; this.puedeEmpezar = false;
    this.time.delayedCall(700, () => { this.puedeEmpezar = true; });
    const c = this.cartas[this.sel], l = LINEAS[c.id], f = l.formas[0];
    for (const o of this.cartas) if (o !== c) this.tweens.add({ targets: [o.spr, o.g, o.borde], alpha: 0.18, duration: 400 });
    const W = VW * S, H = VH * S;
    const flash = this.add.rectangle(0, 0, W, H, 0xffffff, 0).setOrigin(0);
    this.tweens.add({ targets: flash, fillAlpha: 0.85, duration: 180, yoyo: true, onYoyo: () => { c.spr.clearTint(); poner(c.spr, c.dex, 'Charge', 0) || poner(c.spr, c.dex, 'Idle', 0); },
      onComplete: () => { flash.destroy(); poner(c.spr, c.dex, 'Idle', 0); } });
    this.tweens.add({ targets: c.spr, scale: P * 1.25, duration: 360, ease: 'Back.out' });

    // Cartel con el nombre y los tipos, debajo de la rejilla.
    this.ayuda?.destroy();
    const cx = W / k / 2, y = ABAJO + 16, tipos = l.tipos.map(t => NOMBRE_TIPO[t]).join(' / ');
    const pw = 560, ph = 84, g = this.add.graphics().setAlpha(0);
    g.fillStyle(0x2e1a14).fillRect(D(cx - pw / 2), D(y), D(pw), D(ph));
    g.fillStyle(0xc48830).fillRect(D(cx - pw / 2 + 4), D(y + 4), D(pw - 8), D(ph - 8));
    g.fillStyle(0x10142c).fillRect(D(cx - pw / 2 + 8), D(y + 8), D(pw - 16), D(ph - 16));
    const t1 = this.texto(cx, y + 32, `¡Es ${f.nombre}!`, 28, '#fff8d6', { fontStyle: 'bold' }).setOrigin(0.5).setAlpha(0);
    const t2 = this.texto(cx, y + 62, `${tipos} · Intro o clic para empezar la aventura`, 16, '#b0f6ec').setOrigin(0.5).setAlpha(0);
    this.tweens.add({ targets: [g, t1, t2], alpha: 1, delay: 350, duration: 300 });
    // El clic con el que se eligió no cuenta: se espera a que se vea quién es.
    this.time.delayedCall(700, () => this.input.once('pointerdown', () => this.empezar()));
  }

  private empezando = false;
  private puedeEmpezar = false;
  private empezar(): void {
    if (this.empezando || !this.elegido) return;
    this.empezando = true;
    this.scene.start('aventura', { nueva: true, inicial: this.cartas[this.sel].id });
  }
}
