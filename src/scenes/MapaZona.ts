// Mapa (tecla M en el modo aventura): escena encima de Aventura mientras está abierto (el HUD se oculta). Dos vistas:
// - Zona: la zona entera, pintada por una segunda cámara de Aventura encajada en el hueco de `encajeMapa`; aquí va lo
//   de alrededor (fondo de madera, marco de pergamino, nombre) y las marcas encima: tú, las salidas y el tablón.
// - Mundo (rueda abajo, clic derecho o la pestaña): las zonas en su cuadrícula (data/mundo.ts) unidas por caminos,
//   cada una con su miniatura si ya la has visitado y en niebla si no; la tuya con marco dorado y tu punto. Rueda
//   arriba o clic en tu zona vuelve a la zona.
// Es la base de los puntos de vuelo (docs/GDD-mundo.md): elegir en el mapa a dónde te lleva el volador.
import Phaser from 'phaser';
import { S, VH, VW } from '../config';
import { C, FUENTE_PX, FUENTE_TIT, HEX, type G } from './UIScene';
import { encajeMapa, type Aventura } from './Aventura';
import { CAMINOS, COLS_MUNDO, FILAS_MUNDO, ZONAS_MUNDO, miniaturas, type ZonaMundo } from '../data/mundo';
import { NOMBRE_ZONA } from '../combate/misiones';
import type { MapaId } from '../data/bosque';

type Caja = { x: number; y: number; w: number; h: number };
const PULSO = 1200;   // ms del pulso de tu punto

export class MapaZona extends Phaser.Scene {
  private av!: Aventura;
  private modo: 'zona' | 'mundo' = 'zona';
  private capaZona: Phaser.GameObjects.GameObject[] = [];
  private capaMundo: Phaser.GameObjects.GameObject[] = [];
  private fichas = new Map<MapaId, Caja>();   // hueco de cada zona en el mapa del mundo (px de pantalla)
  private pestanas: { zona: Phaser.GameObjects.Text; mundo: Phaser.GameObjects.Text } | null = null;
  private marcas!: G;

  constructor() { super('mapaZona'); }

  private sombreado(x: number, y: number, txt: string, px: number, color = 0xfff6dc): Phaser.GameObjects.Text {
    return this.add.text(x, y, txt, { fontFamily: FUENTE_PX, fontSize: `${px * S}px`, color: HEX(color), stroke: HEX(C.tintaOsc), strokeThickness: 2 * S });
  }
  // Anillo alrededor de una caja (de d0 a d1 px hacia fuera).
  private anillo(g: G, e: Caja, col: number, a: number, d0: number, d1: number): void {
    const x0 = e.x - d1, y0 = e.y - d1, w = e.w + 2 * d1, h = e.h + 2 * d1, t = d1 - d0;
    g.fillStyle(col, a).fillRect(x0, y0, w, t).fillRect(x0, y0 + h - t, w, t).fillRect(x0, y0 + t, t, h - 2 * t).fillRect(x0 + w - t, y0 + t, t, h - 2 * t);
  }

  create(): void {
    this.av = this.scene.get('aventura') as Aventura;
    this.capaZona = []; this.capaMundo = []; this.fichas.clear();
    this.crearZona();
    this.crearMundo();
    this.marcas = this.add.graphics().setDepth(5);
    this.sombreado(VW * S / 2, (VH - 9) * S, 'Rueda o clic derecho: zona / mundo · M o Esc: cerrar', 5.5).setOrigin(0.5).setAlpha(0.85).setDepth(6);
    const pz = this.sombreado(8 * S, 8 * S, 'Zona', 7).setDepth(6).setInteractive({ useHandCursor: true });
    const pm = this.sombreado(8 * S + pz.width + 8 * S, 8 * S, 'Mundo', 7).setDepth(6).setInteractive({ useHandCursor: true });
    pz.on('pointerdown', (p: Phaser.Input.Pointer) => { if (p.leftButtonDown()) this.cambiar('zona'); });
    pm.on('pointerdown', (p: Phaser.Input.Pointer) => { if (p.leftButtonDown()) this.cambiar('mundo'); });
    this.pestanas = { zona: pz, mundo: pm };
    this.input.mouse!.disableContextMenu();
    this.input.on('wheel', (_p: Phaser.Input.Pointer, _o: unknown, _dx: number, dy: number) => this.cambiar(dy > 0 ? 'mundo' : 'zona'));
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (p.rightButtonDown()) { this.cambiar(this.modo === 'zona' ? 'mundo' : 'zona'); return; }
      if (this.modo !== 'mundo') return;
      const f = this.fichas.get(this.av.mapa.id);
      if (f && p.x >= f.x && p.x < f.x + f.w && p.y >= f.y && p.y < f.y + f.h) this.cambiar('zona');
    });
    this.modo = 'zona';
    this.cambiar('zona');
  }

  private cambiar(m: 'zona' | 'mundo'): void {
    this.modo = m;
    for (const o of this.capaZona) (o as unknown as Phaser.GameObjects.Components.Visible).setVisible(m === 'zona');
    for (const o of this.capaMundo) (o as unknown as Phaser.GameObjects.Components.Visible).setVisible(m === 'mundo');
    this.av.verMundo(m === 'mundo');
    if (this.pestanas) {
      this.pestanas.zona.setColor(HEX(m === 'zona' ? 0xffe6a0 : 0xb8a888));
      this.pestanas.mundo.setColor(HEX(m === 'mundo' ? 0xffe6a0 : 0xb8a888));
    }
  }

  // ---- Zona ----
  private crearZona(): void {
    const mapa = this.av.mapa, e = encajeMapa(mapa.W, mapa.H), g = this.add.graphics(), capa = this.capaZona;
    this.anillo(g, e, 0x24170c, 1, 4 * S, Math.max(VW, VH) * S);
    this.anillo(g, e, C.madera, 1, 3 * S, 4 * S);
    this.anillo(g, e, C.perg, 1, 1 * S, 3 * S);
    this.anillo(g, e, C.tintaOsc, 0.8, 0, 1 * S);
    capa.push(g, this.sombreado(VW * S / 2, 14 * S, mapa.nombre, 11, 0xffe6a0).setFontFamily(FUENTE_TIT).setOrigin(0.5));
    // Rótulos de las salidas, pegados a su borde por dentro.
    for (const sa of mapa.salidas) {
      const cx = (sa.x0 + sa.x1) / 2, cy = (sa.y0 + sa.y1) / 2, q = this.enZona(cx, cy);
      const lado = [cy, mapa.H - cy, cx, mapa.W - cx], i = lado.indexOf(Math.min(...lado));   // arriba, abajo, izq, der
      const ox = [0.5, 0.5, 0, 1][i], oy = [0, 1, 0.5, 0.5][i], dx = [0, 0, 3, -3][i] * S, dy = [3, -3, 0, 0][i] * S;
      capa.push(this.sombreado(q.x + dx, q.y + dy, `${['▲', '▼', '◀', '▶'][i]} ${sa.texto}`, 6).setOrigin(ox, oy));
    }
  }
  // Punto de la zona (px de escenario) → px de pantalla.
  private enZona(x: number, y: number): { x: number; y: number } {
    const e = encajeMapa(this.av.mapa.W, this.av.mapa.H);
    return { x: e.x + x * e.zoom, y: e.y + y * e.zoom };
  }

  // ---- Mundo ----
  private crearMundo(): void {
    const capa = this.capaMundo, g = this.add.graphics(), aW = VW * S, aH = VH * S;
    capa.push(g);
    g.fillStyle(0x24170c, 1).fillRect(0, 0, aW, aH);
    capa.push(this.sombreado(aW / 2, 14 * S, 'El mundo', 11, 0xffe6a0).setFontFamily(FUENTE_TIT).setOrigin(0.5));
    // Cuadrícula de casillas con la proporción de una zona (las de bioma miden 1344 × 1056).
    const mx = 18 * S, arriba = 30 * S, abajo = 20 * S, hueco = 16 * S, prop = 1344 / 1056;
    const aw = aW - 2 * mx, ah = aH - arriba - abajo;
    let th = (ah - (FILAS_MUNDO - 1) * hueco) / FILAS_MUNDO, tw = th * prop;
    if (tw * COLS_MUNDO + (COLS_MUNDO - 1) * hueco > aw) { tw = (aw - (COLS_MUNDO - 1) * hueco) / COLS_MUNDO; th = tw / prop; }
    tw = Math.floor(tw); th = Math.floor(th);
    const x0 = Math.round(mx + (aw - (tw * COLS_MUNDO + (COLS_MUNDO - 1) * hueco)) / 2), y0 = Math.round(arriba + (ah - (th * FILAS_MUNDO + (FILAS_MUNDO - 1) * hueco)) / 2);
    for (const z of ZONAS_MUNDO) this.fichas.set(z.id, { x: x0 + z.col * (tw + hueco), y: y0 + z.fila * (th + hueco), w: tw, h: th });
    // Caminos entre zonas (debajo de las casillas: solo se ve el trozo del hueco).
    for (const [a, b] of CAMINOS) {
      const fa = this.fichas.get(a)!, fb = this.fichas.get(b)!, ax = fa.x + fa.w / 2, ay = fa.y + fa.h / 2, bx = fb.x + fb.w / 2, by = fb.y + fb.h / 2;
      g.lineStyle(6 * S, C.madera, 1).lineBetween(ax, ay, bx, by);
      g.lineStyle(3 * S, 0xd9b97c, 1).lineBetween(ax, ay, bx, by);
    }
    const guardadas = miniaturas(this.av.partida.estado.semilla);
    for (const z of ZONAS_MUNDO) this.ficha(z, g, guardadas[z.id]);
  }
  // Una casilla del mundo: marco, miniatura (o niebla) y el nombre con el nivel.
  private ficha(z: ZonaMundo, g: G, guardada: string | undefined): void {
    const f = this.fichas.get(z.id)!, capa = this.capaMundo, clave = 'mini_' + z.id;
    this.anillo(g, f, C.madera, 1, 2 * S, 3 * S);
    this.anillo(g, f, C.perg, 1, 0, 2 * S);
    g.fillStyle(0x3a2c1c, 1).fillRect(f.x, f.y, f.w, f.h);
    const conocida = this.textures.exists(clave) || !!guardada;
    if (conocida) {
      const img = this.add.image(f.x + f.w / 2, f.y + f.h / 2, '__DEFAULT').setVisible(false);
      const poner = () => {
        if (!img.active) return;
        img.setTexture(clave);
        const k = Math.max(f.w / img.width, f.h / img.height);   // llena la casilla (recorta lo que sobre)
        img.setScale(k).setCrop((img.width - f.w / k) / 2, (img.height - f.h / k) / 2, f.w / k, f.h / k).setVisible(this.modo === 'mundo');
      };
      if (this.textures.exists(clave)) poner();
      else { this.textures.once(Phaser.Textures.Events.ADD_KEY + clave, poner); this.textures.addBase64(clave, guardada); }
      capa.push(img);
    } else {
      capa.push(this.sombreado(f.x + f.w / 2, f.y + f.h / 2 - 4 * S, '?', 22, 0x8a7a60).setOrigin(0.5).setAlpha(0.7));
    }
    // Nombre y nivel en una franja oscura abajo.
    const franja = this.add.graphics().fillStyle(0x1b120a, 0.6).fillRect(f.x, f.y + f.h - 17 * S, f.w, 17 * S);
    capa.push(franja,
      this.sombreado(f.x + f.w / 2, f.y + f.h - 12 * S, NOMBRE_ZONA[z.id], 7, conocida ? 0xffe6a0 : 0xb8a888).setOrigin(0.5),
      this.sombreado(f.x + f.w / 2, f.y + f.h - 4.5 * S, z.nivel, 5, conocida ? 0xfff6dc : 0xb8a888).setOrigin(0.5));
  }

  update(): void {
    const av = this.av, mg = this.marcas;
    if (!av.verMapa || !av.mundo) return;
    mg.clear();
    const p = av.jugador, f = (this.time.now % PULSO) / PULSO;
    const punto = (x: number, y: number) => {
      mg.lineStyle(1.5 * S, 0xffd65a, 1 - f).strokeCircle(x, y, (3 + f * 7) * S);
      mg.fillStyle(C.tintaOsc, 1).fillCircle(x, y, 3.5 * S).fillStyle(0xffd65a, 1).fillCircle(x, y, 2.5 * S);
    };
    if (this.modo === 'mundo') {
      // Tu zona con marco dorado y tu punto dentro (la miniatura llena la casilla: mismo recorte).
      const c = this.fichas.get(av.mapa.id);
      if (!c) return;
      mg.lineStyle(2 * S, 0xffd65a, 1).strokeRect(c.x - 1 * S, c.y - 1 * S, c.w + 2 * S, c.h + 2 * S);
      const { W, H } = av.mapa, k = Math.max(c.w / W, c.h / H);
      punto(Phaser.Math.Clamp(c.x + c.w / 2 + (p.x - W / 2) * k, c.x, c.x + c.w), Phaser.Math.Clamp(c.y + c.h / 2 + (p.y - H / 2) * k, c.y, c.y + c.h));
      return;
    }
    // El tablón (pueblo): una chapa amarilla con "!".
    const t = av.mapa.tablon;
    if (t) {
      const q = this.enZona(t.x, t.y);
      mg.fillStyle(C.tintaOsc, 1).fillCircle(q.x, q.y, 3.5 * S).fillStyle(0xffd84a, 1).fillCircle(q.x, q.y, 2.5 * S);
      mg.fillStyle(C.tintaOsc, 1).fillRect(q.x - 0.5 * S, q.y - 1.6 * S, S, 2 * S).fillRect(q.x - 0.5 * S, q.y + 0.9 * S, S, 0.8 * S);
    }
    const q = this.enZona(p.x, p.y);
    punto(q.x, q.y);
  }
}
