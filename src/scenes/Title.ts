// Pantalla de título: el valle de día con los aldeanos dando saltitos, y un cartel con el menú
// (continuar, nueva partida, controles). Portada del diseño de Claude Design (1440×810 = 480×270 ×3):
// las posiciones están en px del diseño y D() las pasa a px de pantalla.
import Phaser from 'phaser';
import { GRANJA, NUEVA, S, VH, VW } from '../config';
import { Partida } from '../combate/partida';
import { World } from '../sim/World';
import { FUENTE } from './UIScene';

const k = S / 3, D = (v: number) => v * k;
const F = `"Pixelify Sans", ${FUENTE}`;
// Pixel art de los Pokémon: zoom entero (en el diseño, ×4 de su tamaño a 1440 px de ancho).
const P = Math.max(1, Math.round(4 * S / 3));
// Edificios: ×2,4 en el diseño; entero para no deformar los píxeles.
const PE = Math.max(1, Math.round(0.8 * S));

// Árboles del fondo, de atrás adelante: textura, izquierda, arriba, ancho (px del diseño).
const ARBOLES: [number, number, number, number][] = [
  [3, 300, 276, 112], [3, 1370, 288, 104], [0, 70, 270, 120], [1, 1180, 275, 120], [0, 430, 298, 100],
  [2, 905, 280, 104], [1, 390, 274, 128], [3, 930, 278, 126], [2, -30, 252, 134], [0, 1290, 271, 140],
];
const FLORES: [number, number, number, number][] = [
  [0, 60, 680, 80], [18, 420, 712, 84], [7, 930, 700, 70], [0, 1310, 690, 76], [7, 250, 560, 60], [18, 1200, 600, 66],
];
// Pokémon: textura Idle, izquierda, arriba y ancho de su silueta, periodo del saltito y retardo (ms).
const POKES: [string, number, number, number, number, number][] = [
  ['marill-Idle', 330, 600, 72, 1900, 400], ['oddish-Idle', 200, 640, 56, 1400, 800],
  ['bidoof-Idle', 1120, 618, 68, 1600, 0], ['geodude-Idle', 1240, 668, 104, 1400, 800],
  ['growlithe-Idle', 990, 668, 64, 1900, 400],
];
// Modo aventura: Pokémon que pasean por el claro Arcane, detrás del logo y del menú (sin pisar casas ni árboles).
const PASEAN = ['b', 'marill', 'oddish', 'bidoof', 'growlithe', 'geodude'];
const CLARO = { x0: 430, x1: 1030, y0: 240, y1: 690 };   // px del fondo (1440×810)
const FLECHA = [0, 0, 6, 0, 6, 4, 10, 4, 10, 8, 14, 8, 14, 14, 10, 14, 10, 18, 6, 18, 6, 22, 0, 22];
// Modo aventura (el de por defecto, docs/GDD-combate.md).
const CONTROLES_AVENTURA = 'WASD: mover · clic o Tab: elegir objetivo · 1-0: tu barra (movimientos y objetos)\n'
  + 'K: colocar movimientos en la barra · F: convertirte en otro de tus Pokémon (en el pueblo) · Esc: título';
const CONTROLES = 'WASD: mover\nF, espacio o clic: acción (recoger, Látigo Cepa, sembrar, almacén, dormir)\n'
  + 'clic en un aldeano y luego en su sitio de trabajo\nB: construir · rueda o Q/E: elegir · M: mapa · Esc: título';

interface Opcion { texto: string; detalle: string; hacer: () => void }

export class Title extends Phaser.Scene {
  private sel = 0;
  private enFondo = (x: number, y: number) => ({ x: D(x), y: D(y) });
  private textos: Phaser.GameObjects.Text[] = [];

  constructor() { super('title'); }

  create(): void {
    const aventura = GRANJA ? null : NUEVA ? null : Partida.resumen();
    const res = GRANJA ? (NUEVA ? null : World.resumenPartida()) : aventura ? { dia: aventura.dia, aldeanos: 0 } : null, hay = !!res;
    this.sel = 0; this.textos = []; this.botones = []; this.botonesAv = [];
    this.fondo();
    this.cabecera();

    const empezar = (nueva: boolean) => {
      if (GRANJA) {
        if (nueva) World.borrarPartida();
        this.scene.start('world', { nueva: nueva || !hay });
        return;
      }
      if (nueva) Partida.borrar();
      this.scene.start('aventura', { nueva: nueva || !hay });
    };
    const controles: Opcion = { texto: 'Controles', detalle: GRANJA ? 'WASD, F, B, M…' : 'WASD, 1-0, Tab, K…', hacer: () => this.verControles() };
    const detalle = !res ? '' : aventura ? `${aventura.nombre} Nv ${aventura.nivel} · ${aventura.equipo} Pokémon`
      : `Día ${res.dia} · ${res.aldeanos} ${res.aldeanos === 1 ? 'aldeano' : 'aldeanos'}`;
    // Nueva partida con una guardada: antes se pregunta, porque borra la anterior.
    const nueva = () => hay ? this.confirmarBorrar(detalle, () => empezar(true)) : empezar(true);
    const ops: Opcion[] = res
      ? [{ texto: 'Continuar', detalle, hacer: () => empezar(false) },
        { texto: 'Nueva partida', detalle: 'borra la partida guardada', hacer: nueva }, controles]
      : [{ texto: 'Empezar', detalle: GRANJA ? 'un valle vacío te espera' : 'Bulbasaur y diez Poké Balls', hacer: () => empezar(true) }, controles];
    if (GRANJA) this.menu(ops); else this.menuAventura(ops);
    if (GRANJA) this.poke('b-Idle', 684, 640, 72, 1600, 0);
    this.pie();

    const kb = this.input.keyboard!;
    const mover = (d: number) => { if (!this.cubre) { this.sel = (this.sel + d + ops.length) % ops.length; this.marcar(); } };
    kb.on('keydown-UP', () => mover(-1)); kb.on('keydown-W', () => mover(-1));
    kb.on('keydown-DOWN', () => mover(1)); kb.on('keydown-S', () => mover(1));
    if (!GRANJA) { kb.on('keydown-LEFT', () => mover(-1)); kb.on('keydown-A', () => mover(-1)); kb.on('keydown-RIGHT', () => mover(1)); kb.on('keydown-D', () => mover(1)); }
    for (const t of ['ENTER', 'SPACE', 'F']) kb.on('keydown-' + t, () => { if (!this.cubre) ops[this.sel].hacer(); });
    if (hay) kb.on('keydown-N', () => { if (!this.cubre) nueva(); });

    // Pixelify Sans puede llegar después de pintar el texto: se repinta al cargarse.
    document.fonts?.ready.then(() => { if (this.sys.isActive()) this.textos.forEach(t => t.updateText()); });
  }

  private texto(x: number, y: number, s: string, px: number, color: string, extra: Phaser.Types.GameObjects.Text.TextStyle = {}) {
    const t = this.add.text(D(x), D(y), s, { fontFamily: F, fontSize: `${D(px)}px`, color, ...extra });
    this.textos.push(t);
    return t;
  }

  // Cielo, césped, árboles, casa, almacén, caja de Pelipper, flores y aldeanos.
  private fondo(): void {
    if (!GRANJA && this.textures.exists('tit-fondo')) { this.fondoAventura(); return; }
    const W = VW * S, g = this.add.graphics();
    g.fillGradientStyle(0x8fd0f0, 0x8fd0f0, 0xbfe6f2, 0xbfe6f2, 1).fillRect(0, 0, W, D(231));
    g.fillGradientStyle(0xbfe6f2, 0xbfe6f2, 0xf3efc8, 0xf3efc8, 1).fillRect(0, D(231), W, D(190));
    const suelo = this.add.tileSprite(0, D(400), W, VH * S - D(400), 'tit-cesped').setOrigin(0);
    suelo.setTileScale(D(192) / 96);

    const img = (key: string, l: number, t: number, w: number) => {
      const im = this.add.image(D(l), D(t), key).setOrigin(0);
      return im.setScale(D(w) / im.width);
    };
    for (const [n, l, t, w] of ARBOLES) img('arbol' + n, l, t, w);
    // Edificios a zoom entero, apoyados donde los pone el diseño (centro de la base).
    const edif = (key: string, l: number, t: number, w: number) => {
      if (!this.textures.exists(key)) return;
      const im = this.add.image(0, 0, key).setOrigin(0.5, 1).setScale(PE);
      im.setPosition(D(l + w / 2), D(t + w * im.height / im.width));
    };
    edif('obj_casa', 70, 312, 312);
    edif('obj_almacen', 1060, 316, 300);
    edif('obj_caja_pelipper', 1010, 560, 84);
    for (const [n, l, t, w] of FLORES) img('tit-flor' + n, l, t, w);
    for (const p of POKES) this.poke(...p);

    if (this.anims.exists('pelipper-Walk-0')) {
      const pel = this.add.sprite(D(1222), D(160), 'pelipper-Walk', 0).setScale(P).play('pelipper-Walk-0');
      this.tweens.add({ targets: pel, x: pel.x - D(14), y: pel.y - D(10), duration: 1600, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    }
  }

  // Modo aventura: claro del bosque montado con el catálogo Arcane (1440×810, cubre la ventana) y los Pokémon.
  private fondoAventura(): void {
    const W = VW * S, H = VH * S;
    this.textures.get('tit-fondo').setFilter(Phaser.Textures.FilterMode.LINEAR);   // pintura, no pixel art
    const im = this.add.image(W / 2, H / 2, 'tit-fondo').setDepth(-2000);
    const sc = Math.max(W / im.width, H / im.height);
    im.setScale(sc);
    // Px del fondo (1440×810) → px de pantalla, para que el claro siga bajo los Pokémon en ventanas más anchas.
    this.enFondo = (x, y) => ({ x: W / 2 + (x - im.width / 2) * sc, y: H / 2 + (y - im.height / 2) * sc });
    for (const id of PASEAN) this.pasear(id);
  }

  // Un Pokémon que va de un punto del claro a otro con su Walk (fila PMD según la dirección) y descansa un rato.
  private pasear(id: string): void {
    if (!this.anims.exists(`${id}-Walk-0`) || !this.textures.exists(`${id}-Walk`)) return;
    const fr = this.textures.getFrame(`${id}-Walk`, 0), bb = silueta(fr);
    const punto = () => this.enFondo(Phaser.Math.Between(CLARO.x0, CLARO.x1), Phaser.Math.Between(CLARO.y0, CLARO.y1));
    const p0 = punto();
    const sombra = this.add.ellipse(p0.x, p0.y, bb.w * P * 0.8, Math.max(D(10), bb.w * P * 0.22), 0x1c3012, 0.35);
    const spr = this.add.sprite(p0.x, p0.y, `${id}-Walk`, 0).setScale(P)
      .setOrigin((bb.x + bb.w / 2) / fr.width, (bb.y + bb.h) / fr.height);
    const fondo = () => { spr.setDepth(-1000 + spr.y); sombra.setPosition(spr.x, spr.y - D(2)).setDepth(-1001 + spr.y); };
    fondo();
    let fila = 0;
    const descansar = () => {
      spr.play(this.anims.exists(`${id}-Reposo-${fila}`) ? `${id}-Reposo-${fila}` : `${id}-Idle-${fila}`);
      this.time.delayedCall(Phaser.Math.Between(1200, 4000), andar);
    };
    const andar = () => {
      if (!this.sys.isActive()) return;
      const p = punto(), dx = p.x - spr.x, dy = p.y - spr.y;
      // PMD: 0 abajo, 1 abajo-dcha, 2 dcha, 3 arriba-dcha, 4 arriba, 5 arriba-izq, 6 izq, 7 abajo-izq.
      const oct = Math.round(Math.atan2(dy, dx) / (Math.PI / 4));   // 0 dcha, 2 abajo, -2 arriba
      fila = [2, 1, 0, 7, 6, 5, 4, 3][(oct + 8) % 8];
      spr.play(`${id}-Walk-${fila}`);
      this.tweens.add({ targets: spr, x: p.x, y: p.y, duration: Math.hypot(dx, dy) / D(55) * 1000, onUpdate: fondo, onComplete: descansar });
    };
    this.time.delayedCall(Phaser.Math.Between(0, 2500), andar);
  }

  // Un Pokémon quieto de frente, con su sombra en el suelo: salta y la sombra se encoge.
  private poke(key: string, l: number, t: number, w: number, periodo: number, retardo: number): void {
    if (!this.textures.exists(key)) return;
    const fr = this.textures.getFrame(key, 0), bb = silueta(fr);
    const x = D(l + w / 2), y = D(t + w * bb.h / bb.w);
    const sw = bb.w * P * 0.8;
    const sombra = this.add.ellipse(x, y - D(2), sw, Math.max(D(12), sw * 0.28), 0x1c3012, 0.38);
    const spr = this.add.sprite(x, y, key, 0).setScale(P)
      .setOrigin((bb.x + bb.w / 2) / fr.width, (bb.y + bb.h) / fr.height);
    const tw = { duration: periodo / 2, delay: retardo, yoyo: true, repeat: -1, ease: 'Sine.inOut' };
    this.tweens.add({ targets: spr, y: y - D(6), ...tw });
    this.tweens.add({ targets: sombra, scaleX: 0.82, scaleY: 0.82, alpha: 0.7, ...tw });
  }

  private cabecera(): void {
    const cx = VW * S / 2 / k;
    if (!GRANJA && this.textures.exists('tit-logo')) {
      // Logo pixel art a zoom entero (×2 en el diseño de 1440 px), entre el borde de arriba y el cartel del menú.
      this.add.image(D(cx), D(36), 'tit-logo').setOrigin(0.5, 0).setScale(Math.max(1, Math.round(2 * S / 3)));
      return;
    }
    this.texto(cx, 70, 'FANGAME · prototipo 0.2d', 26, '#fff6dc', { fontStyle: 'bold' })
      .setOrigin(0.5).setLetterSpacing(D(6)).setShadow(D(2), D(2), '#2b3a1f', 0, false, true);
    // Título: sombra lejana, canto naranja y letras amarillas, todo con borde marrón.
    const tit = (dy: number, color: string, alpha = 1) =>
      this.texto(cx, 150 + dy, 'Poké Valley', 116, color, { fontStyle: 'bold', stroke: '#3a2412', strokeThickness: D(8) })
        .setOrigin(0.5).setAlpha(alpha);
    tit(14, '#1e2814', 0.35).setStroke('#1e2814', D(8));
    tit(6, '#c9772b');
    tit(0, '#ffe27a');
    this.texto(cx, 240, 'un valle tranquilo que levantan los propios Pokémon', 26, '#fff6dc')
      .setOrigin(0.5).setShadow(D(2), D(2), '#2b3a1f', 0, false, true);
  }

  private botones: { fondo: Phaser.GameObjects.Graphics; flecha: Phaser.GameObjects.Graphics }[] = [];
  private cubre: Phaser.GameObjects.Container | null = null;

  // Cartel de madera con pergamino; la opción elegida, resaltada y con flecha que parpadea.
  private menu(ops: Opcion[]): void {
    const W = 360, X = VW * S / 2 / k - W / 2, Y = 318, BH = 69, GAP = 10, top = Y + 36;
    const H = 36 + ops.length * BH + (ops.length - 1) * GAP + 36, g = this.add.graphics();
    g.fillStyle(0x1e2814, 0.4).fillRoundedRect(D(X), D(Y + 10), D(W), D(H), D(10));
    g.fillStyle(0x3a2412).fillRoundedRect(D(X), D(Y), D(W), D(H), D(10));
    g.fillStyle(0x8a5a32).fillRoundedRect(D(X + 6), D(Y + 6), D(W - 12), D(H - 12), D(6));
    g.fillStyle(0xc99a5b).fillRect(D(X + 14), D(Y + 14), D(W - 28), D(H - 28));
    g.fillStyle(0xf6e7c1).fillRect(D(X + 18), D(Y + 18), D(W - 36), D(H - 36));

    this.botones = ops.map((op, i) => {
      const bx = X + 34, by = top + i * (BH + GAP), bw = W - 68;
      const fondo = this.add.graphics();
      fondo.fillStyle(0xc9772b).fillRoundedRect(D(bx), D(by), D(bw), D(BH), D(6));
      fondo.fillStyle(0xffe9a8).fillRoundedRect(D(bx + 3), D(by + 3), D(bw - 6), D(BH - 6), D(4));
      const flecha = this.add.graphics({ x: D(bx + 12), y: D(by + BH / 2 - 11) });
      flecha.fillStyle(0xc9772b).fillPoints(pts(FLECHA), true);
      this.texto(bx + 44, by + 23, op.texto, 28, '#3a2412', { fontStyle: 'bold' }).setOrigin(0, 0.5);
      this.texto(bx + 44, by + 51, op.detalle, 17, '#6b4a2a').setOrigin(0, 0.5);
      const zona = this.add.zone(D(bx), D(by), D(bw), D(BH)).setOrigin(0).setInteractive({ useHandCursor: true });
      zona.on('pointerover', () => { if (!this.cubre) { this.sel = i; this.marcar(); } });
      zona.on('pointerdown', () => { if (!this.cubre) op.hacer(); });
      return { fondo, flecha };
    });
    this.marcar();
    this.time.addEvent({ delay: 500, loop: true, callback: () => { const f = this.botones[this.sel]?.flecha; if (f) f.setAlpha(f.alpha < 1 ? 1 : 0.35); } });
  }

  // Modo aventura, como el diseño de Claude Design: franja «Pulsa espacio» y botones en fila, azul noche con
  // ribete de oro y sombra dura; el elegido, más claro y con borde turquesa.
  private menuAventura(ops: Opcion[]): void {
    const cx = VW * S / 2 / k, BW = 250, BH = 72, GAP = 20, top = 380;
    const tira = this.texto(cx, 300, 'PULSA ESPACIO PARA EMPEZAR', 22, '#b0f6ec').setOrigin(0.5).setLetterSpacing(D(6));
    const tw = tira.width / k + 32, g = this.add.graphics();
    g.fillStyle(0x2e1a14).fillRect(D(cx - tw / 2 - 4), D(300 - 22 - 4), D(tw + 8), D(44 + 8));
    g.fillStyle(0x10142c).fillRect(D(cx - tw / 2), D(300 - 22), D(tw), D(44));
    tira.setDepth(1);
    const x0 = cx - (ops.length * BW + (ops.length - 1) * GAP) / 2;
    this.botonesAv = ops.map((op, i) => {
      const bx = x0 + i * (BW + GAP), b = this.add.graphics(), sel = this.add.graphics();
      b.fillStyle(0x0a0c1c).fillRect(D(bx + 4), D(top + 4), D(BW), D(BH));
      b.fillStyle(0x2e1a14).fillRect(D(bx), D(top), D(BW), D(BH));
      b.fillStyle(0xc48830).fillRect(D(bx + 4), D(top + 4), D(BW - 8), D(BH - 8));
      b.fillStyle(0x1e264e).fillRect(D(bx + 8), D(top + 8), D(BW - 16), D(BH - 16));
      sel.fillStyle(0x48c4c4).fillRect(D(bx - 4), D(top - 4), D(BW + 8), D(4)).fillRect(D(bx - 4), D(top + BH), D(BW + 8), D(4))
        .fillRect(D(bx - 4), D(top), D(4), D(BH)).fillRect(D(bx + BW), D(top), D(4), D(BH));
      sel.fillStyle(0x30264e).fillRect(D(bx + 8), D(top + 8), D(BW - 16), D(BH - 16));
      const tit = this.texto(bx + BW / 2, top + 30, op.texto, 22, '#fae296', { fontStyle: 'bold' }).setOrigin(0.5);
      const det = this.texto(bx + BW / 2, top + 53, op.detalle, 13, '#b8bedc').setOrigin(0.5);
      const zona = this.add.zone(D(bx), D(top), D(BW), D(BH)).setOrigin(0).setInteractive({ useHandCursor: true });
      zona.on('pointerover', () => { if (!this.cubre) { this.sel = i; this.marcar(); } });
      zona.on('pointerdown', () => { if (!this.cubre) op.hacer(); });
      return { sel, tit, det };
    });
    this.marcar();
  }

  private botonesAv: { sel: Phaser.GameObjects.Graphics; tit: Phaser.GameObjects.Text; det: Phaser.GameObjects.Text }[] = [];

  private marcar(): void {
    this.botones.forEach((b, i) => { b.fondo.setVisible(i === this.sel); b.flecha.setVisible(i === this.sel).setAlpha(1); });
    this.botonesAv.forEach((b, i) => { const on = i === this.sel; b.sel.setVisible(on); b.tit.setColor(on ? '#fff8d6' : '#fae296'); b.det.setColor(on ? '#e8e2cc' : '#b8bedc'); });
  }

  private pie(): void {
    const W = VW * S;
    const y = VH * S / k - 21, c = GRANJA ? '#e9efd9' : '#e8e2cc';
    this.add.rectangle(0, VH * S - D(41), W, D(41), GRANJA ? 0x1c2414 : 0x10142c, GRANJA ? 0.72 : 0.9).setOrigin(0);
    this.texto(24, y, GRANJA ? 'Intro / clic: elegir · ↑ ↓ mover · N: nueva partida' : 'Intro / clic: elegir · A/D o flechas: mover · N: nueva partida', 17, c).setOrigin(0, 0.5);
    this.texto(W / k - 24, y, 'Sprites: SpriteCollab (CC BY-NC 4.0) · bayas: pokeemerald · fangame sin ánimo de lucro', 17, c).setOrigin(1, 0.5);
  }

  // Aviso antes de borrar la partida guardada: «Cancelar» elegido de entrada; ← → (A/D) cambian, Intro/espacio/F
  // aceptan, Esc cancela. Estilo del título de cada modo (azul noche y oro en aventura, pergamino en granja).
  private confirmarBorrar(guardada: string, borrar: () => void): void {
    const W = VW * S, H = VH * S, c = this.add.container(0, 0).setDepth(100), cx = W / k / 2;
    const av = !GRANJA;
    const velo = this.add.rectangle(0, 0, W, H, av ? 0x0a0c1c : 0x101808, 0.6).setOrigin(0).setInteractive();
    const pw = 640, ph = 250, px = cx - pw / 2, py = (H / k - ph) / 2, g = this.add.graphics();
    if (av) {
      g.fillStyle(0x0a0c1c).fillRect(D(px + 6), D(py + 6), D(pw), D(ph));
      g.fillStyle(0x2e1a14).fillRect(D(px), D(py), D(pw), D(ph));
      g.fillStyle(0xc48830).fillRect(D(px + 4), D(py + 4), D(pw - 8), D(ph - 8));
      g.fillStyle(0x10142c).fillRect(D(px + 8), D(py + 8), D(pw - 16), D(ph - 16));
    } else {
      g.fillStyle(0x3a2412).fillRoundedRect(D(px), D(py), D(pw), D(ph), D(10));
      g.fillStyle(0xf6e7c1).fillRoundedRect(D(px + 8), D(py + 8), D(pw - 16), D(ph - 16), D(6));
    }
    const fuerte = av ? '#fae296' : '#3a2412', suave = av ? '#b8bedc' : '#6b4a2a';
    const tit = this.texto(cx, py + 50, '¿Borrar la partida guardada?', 28, fuerte, { fontStyle: 'bold' }).setOrigin(0.5);
    const txt = this.texto(cx, py + 100, `${guardada}
Se perderá para siempre.`, 18, suave, { align: 'center', lineSpacing: D(4) }).setOrigin(0.5);
    c.add([velo, g, tit, txt]);

    let elegido = 1;   // 0 = borrar, 1 = cancelar
    const BW = 220, BH = 56, by = py + ph - 86;
    const marcos = ['Sí, borrar', 'Cancelar'].map((t, i) => {
      const bx = cx + (i === 0 ? -BW - 12 : 12), b = this.add.graphics(), sel = this.add.graphics();
      b.fillStyle(av ? 0x2e1a14 : 0x3a2412).fillRect(D(bx), D(by), D(BW), D(BH));
      b.fillStyle(i === 0 ? 0x8e2a2a : av ? 0x1e264e : 0xc99a5b).fillRect(D(bx + 4), D(by + 4), D(BW - 8), D(BH - 8));
      sel.lineStyle(D(4), av ? 0x48c4c4 : 0xc9772b).strokeRect(D(bx - 4), D(by - 4), D(BW + 8), D(BH + 8));
      const tx = this.texto(bx + BW / 2, by + BH / 2, t, 22, i === 0 || av ? '#fff8d6' : '#3a2412', { fontStyle: 'bold' }).setOrigin(0.5);
      const zona = this.add.zone(D(bx), D(by), D(BW), D(BH)).setOrigin(0).setInteractive({ useHandCursor: true });
      zona.on('pointerover', () => { elegido = i; marcar(); });
      zona.on('pointerdown', () => { elegido = i; aceptar(); });
      c.add([b, sel, tx, zona]);
      return sel;
    });
    const marcar = () => marcos.forEach((m, i) => m.setVisible(i === elegido));
    marcar();
    this.cubre = c;

    const kb = this.input.keyboard!;
    const cerrar = () => { kb.off('keydown', tecla); c.destroy(); this.time.delayedCall(0, () => { this.cubre = null; }); };
    const aceptar = () => { if (elegido === 0) { kb.off('keydown', tecla); borrar(); } else cerrar(); };
    const tecla = (e: KeyboardEvent) => {
      if (['ArrowLeft', 'ArrowRight', 'KeyA', 'KeyD', 'Tab'].includes(e.code)) { elegido = 1 - elegido; marcar(); }
      else if (['Enter', 'Space', 'KeyF'].includes(e.code)) aceptar();
      else if (e.code === 'Escape') cerrar();
    };
    this.time.delayedCall(0, () => kb.on('keydown', tecla));   // no recoger la misma pulsación que lo abrió
    velo.on('pointerdown', cerrar);
  }

  // Panel con los controles; cualquier tecla o clic lo cierra.
  private verControles(): void {
    const W = VW * S, H = VH * S, c = this.add.container(0, 0);
    const velo = this.add.rectangle(0, 0, W, H, 0x101808, 0.55).setOrigin(0).setInteractive();
    const pw = 900, ph = 260, px = (W / k - pw) / 2, py = (H / k - ph) / 2, g = this.add.graphics();
    g.fillStyle(0x3a2412).fillRoundedRect(D(px), D(py), D(pw), D(ph), D(10));
    g.fillStyle(0xf6e7c1).fillRoundedRect(D(px + 8), D(py + 8), D(pw - 16), D(ph - 16), D(6));
    const tit = this.texto(W / k / 2, py + 44, 'Controles', 30, '#3a2412', { fontStyle: 'bold' }).setOrigin(0.5);
    const txt = this.texto(W / k / 2, py + 140, GRANJA ? CONTROLES : CONTROLES_AVENTURA, 20, '#3a2412', { align: 'center', lineSpacing: D(6) }).setOrigin(0.5);
    const nota = this.texto(W / k / 2, py + ph - 28, 'cualquier tecla o clic para volver', 16, '#6b4a2a').setOrigin(0.5);
    c.add([velo, g, tit, txt, nota]);
    this.cubre = c;
    const cerrar = () => { c.destroy(); this.time.delayedCall(0, () => { this.cubre = null; }); };
    this.time.delayedCall(0, () => {
      this.input.keyboard!.once('keydown', cerrar);
      velo.once('pointerdown', () => { this.input.keyboard!.off('keydown', cerrar); cerrar(); });
    });
  }
}

const pts = (a: number[]) => {
  const r: Phaser.Math.Vector2[] = [];
  for (let i = 0; i < a.length; i += 2) r.push(new Phaser.Math.Vector2(D(a[i]), D(a[i + 1])));
  return r;
};

// Rectángulo opaco de un fotograma (los de PMD traen mucho margen transparente).
function silueta(fr: Phaser.Textures.Frame): { x: number; y: number; w: number; h: number } {
  const c = document.createElement('canvas'); c.width = fr.cutWidth; c.height = fr.cutHeight;
  const ctx = c.getContext('2d')!;
  ctx.drawImage(fr.source.image as CanvasImageSource, fr.cutX, fr.cutY, fr.cutWidth, fr.cutHeight, 0, 0, fr.cutWidth, fr.cutHeight);
  const d = ctx.getImageData(0, 0, c.width, c.height).data;
  let x0 = c.width, y0 = c.height, x1 = -1, y1 = -1;
  for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) if (d[(y * c.width + x) * 4 + 3] > 0) {
    if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
  }
  return x1 < 0 ? { x: 0, y: 0, w: fr.cutWidth, h: fr.cutHeight } : { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}
