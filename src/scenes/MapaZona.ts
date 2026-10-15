// Mapa (tecla M en el modo aventura): escena encima de Aventura mientras está abierto (el HUD se oculta). Vistas:
// - Zona: la zona entera, pintada por una segunda cámara de Aventura encajada en el hueco de `encajeMapa`; aquí va lo
//   de alrededor (fondo de madera, marco de pergamino, nombre) y las marcas encima: tú, las salidas, el tablón y el
//   punto de vuelo.
// - Mundo (rueda abajo, clic derecho o la pestaña): las zonas en su cuadrícula (data/mundo.ts) unidas por caminos,
//   cada una con su miniatura si ya la has visitado y en niebla si no; la tuya con marco dorado y tu punto. Rueda
//   arriba o clic en tu zona vuelve a la zona.
// - Vuelo (F junto al volador, `Aventura.modoVuelo`): solo el mundo. Las zonas con punto de vuelo descubierto llevan
//   el icono del volador donde está; clic en una (que no sea la tuya) y te lleva a su punto de vuelo.
// En las dos vistas del mundo, el icono marca los puntos de vuelo descubiertos.
import Phaser from 'phaser';
import { S, VH, VW } from '../config';
import { C, FUENTE_PX, FUENTE_TIT, HEX, type G } from './UIScene';
import { NOMBRE_VUELO, encajeMapa, type Aventura } from './Aventura';
import { CAMINOS, COLS_MUNDO, FILAS_MUNDO, ZONAS_MUNDO, miniaturas, type ZonaMundo } from '../data/mundo';
import { NOMBRE_ZONA } from '../combate/misiones';
import type { MapaId } from '../data/bosque';

type Caja = { x: number; y: number; w: number; h: number };
type Modo = 'zona' | 'mundo';
const PULSO = 1200;   // ms del pulso de tu punto
const dentro = (c: Caja, x: number, y: number) => x >= c.x && x < c.x + c.w && y >= c.y && y < c.y + c.h;

export class MapaZona extends Phaser.Scene {
  private av!: Aventura;
  private vuelo = false;
  private modo: Modo = 'zona';
  private capaZona: Phaser.GameObjects.GameObject[] = [];
  private capaMundo: Phaser.GameObjects.GameObject[] = [];
  private nuevo = false;                      // se acaba de descubrir el punto de vuelo de aquí
  private fichas = new Map<MapaId, Caja>();   // hueco de cada zona en el mapa del mundo (px de pantalla)
  private conocidas = new Set<MapaId>();      // con miniatura (visitadas)
  private pestanas: { zona: Phaser.GameObjects.Text; mundo: Phaser.GameObjects.Text } | null = null;
  private titulo!: Phaser.GameObjects.Text;
  private pie!: Phaser.GameObjects.Text;
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
  // Fondo de madera hasta el borde y marco de pergamino alrededor de un hueco.
  private marcoHueco(g: G, e: Caja): void {
    this.anillo(g, e, 0x24170c, 1, 4 * S, Math.max(VW, VH) * S);
    this.anillo(g, e, C.madera, 1, 3 * S, 4 * S);
    this.anillo(g, e, C.perg, 1, 1 * S, 3 * S);
    this.anillo(g, e, C.tintaOsc, 0.8, 0, 1 * S);
  }

  create(): void {
    this.av = this.scene.get('aventura') as Aventura;
    this.vuelo = this.av.modoVuelo;
    this.nuevo = this.av.vueloNuevo; this.av.vueloNuevo = false;
    this.capaZona = []; this.capaMundo = []; this.fichas.clear(); this.conocidas.clear();
    this.crearZona();
    this.crearMundo();
    this.marcas = this.add.graphics().setDepth(5);
    this.titulo = this.sombreado(VW * S / 2, 14 * S, '', 11, 0xffe6a0).setFontFamily(FUENTE_TIT).setOrigin(0.5).setDepth(6);
    this.pie = this.sombreado(VW * S / 2, (VH - 9) * S, '', 5.5).setOrigin(0.5).setAlpha(0.85).setDepth(6);
    this.pestanas = null;
    if (!this.vuelo) {
      const pz = this.sombreado(8 * S, 8 * S, 'Zona', 7).setDepth(6).setInteractive({ useHandCursor: true });
      const pm = this.sombreado(8 * S + pz.width + 8 * S, 8 * S, 'Mundo', 7).setDepth(6).setInteractive({ useHandCursor: true });
      pz.on('pointerdown', (p: Phaser.Input.Pointer) => { if (p.leftButtonDown()) this.cambiar('zona'); });
      pm.on('pointerdown', (p: Phaser.Input.Pointer) => { if (p.leftButtonDown()) this.cambiar('mundo'); });
      this.pestanas = { zona: pz, mundo: pm };
    }
    this.input.mouse!.disableContextMenu();
    this.input.on('wheel', (_p: Phaser.Input.Pointer, _o: unknown, _dx: number, dy: number) => { if (!this.vuelo) this.cambiar(dy > 0 ? 'mundo' : 'zona'); });
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => this.clic(p));
    this.modo = 'zona';
    this.cambiar(this.vuelo ? 'mundo' : 'zona');
  }

  private clic(p: Phaser.Input.Pointer): void {
    const av = this.av;
    if (this.vuelo) {
      if (!p.leftButtonDown()) return;
      const id = [...this.fichas].find(([, c]) => dentro(c, p.x, p.y))?.[0];
      if (!id) return;
      if (id === av.mapa.id) this.decir('Ya estás aquí');
      else if (!av.vuelosConocidos[id]) this.decir(`Aún no conoces el punto de vuelo de ${NOMBRE_ZONA[id]}: habla allí con su ${NOMBRE_VUELO}`);
      else av.volar({ mapa: id });
      return;
    }
    if (p.rightButtonDown()) { this.cambiar(this.modo === 'zona' ? 'mundo' : 'zona'); return; }
    const f = this.modo === 'mundo' ? this.fichas.get(av.mapa.id) : null;
    if (f && dentro(f, p.x, p.y)) this.cambiar('zona');
  }
  // Un aviso en el pie del mapa (el HUD está oculto mientras el mapa está abierto).
  private decir(txt: string): void { this.pie.setText(txt).setColor(HEX(0xffb070)); }

  private cambiar(m: Modo): void {
    this.modo = m;
    for (const o of this.capaZona) (o as unknown as Phaser.GameObjects.Components.Visible).setVisible(m === 'zona');
    for (const o of this.capaMundo) (o as unknown as Phaser.GameObjects.Components.Visible).setVisible(m === 'mundo');
    this.av.verMundo(m !== 'zona');
    if (this.pestanas) {
      this.pestanas.zona.setColor(HEX(m === 'zona' ? 0xffe6a0 : 0xb8a888));
      this.pestanas.mundo.setColor(HEX(m === 'mundo' ? 0xffe6a0 : 0xb8a888));
    }
    this.titulo.setText(this.vuelo ? '¿A dónde vuelas?' : m === 'mundo' ? 'El mundo' : this.av.mapa.nombre);
    this.pie.setColor(HEX(0xfff6dc)).setText(this.vuelo
      ? `${NOMBRE_VUELO} te lleva a los puntos de vuelo que hayas descubierto · Esc: cerrar`
      : 'Rueda o clic derecho: zona / mundo · M o Esc: cerrar');
    if (this.vuelo && this.nuevo) this.pie.setText(`¡Nuevo punto de vuelo descubierto: ${this.av.mapa.nombre}!`).setColor(HEX(0x9be38a));
  }

  // ---- Zona ----
  private crearZona(): void {
    const mapa = this.av.mapa, e = encajeMapa(mapa.W, mapa.H), g = this.add.graphics(), capa = this.capaZona;
    this.marcoHueco(g, e);
    capa.push(g);
    // Rótulos de las salidas, pegados a su borde por dentro.
    for (const sa of mapa.salidas) {
      const cx = (sa.x0 + sa.x1) / 2, cy = (sa.y0 + sa.y1) / 2, q = this.enZona(cx, cy);
      const lado = [cy, mapa.H - cy, cx, mapa.W - cx], i = lado.indexOf(Math.min(...lado));   // arriba, abajo, izq, der
      const ox = [0.5, 0.5, 0, 1][i], oy = [0, 1, 0.5, 0.5][i], dx = [0, 0, 3, -3][i] * S, dy = [3, -3, 0, 0][i] * S;
      capa.push(this.sombreado(q.x + dx, q.y + dy, `${['▲', '▼', '◀', '▶'][i]} ${sa.texto}`, 6).setOrigin(ox, oy));
    }
    // El punto de vuelo: su icono (la bota con alas).
    const v = this.av.vuelo;
    if (v && this.textures.exists('icono_vuelo')) {
      const q = this.enZona(v.x, v.y);
      capa.push(this.add.image(q.x, q.y, 'icono_vuelo').setOrigin(0.5, 1).setScale(S).setDepth(4));
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
    this.iconosVuelo();
  }
  // Una casilla del mundo: marco, miniatura (o niebla) y el nombre con el nivel.
  private ficha(z: ZonaMundo, g: G, guardada: string | undefined): void {
    const f = this.fichas.get(z.id)!, capa = this.capaMundo, clave = 'mini_' + z.id;
    this.anillo(g, f, C.madera, 1, 2 * S, 3 * S);
    this.anillo(g, f, C.perg, 1, 0, 2 * S);
    g.fillStyle(0x3a2c1c, 1).fillRect(f.x, f.y, f.w, f.h);
    const conocida = this.textures.exists(clave) || !!guardada;
    if (conocida) {
      this.conocidas.add(z.id);
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
    const av = this.av, mg = this.marcas, ptr = this.input.activePointer;
    if (!av.verMapa || !av.mundo) return;
    mg.clear();
    const p = av.jugador, f = (this.time.now % PULSO) / PULSO;
    const punto = (x: number, y: number) => {
      mg.lineStyle(1.5 * S, 0xffd65a, 1 - f).strokeCircle(x, y, (3 + f * 7) * S);
      mg.fillStyle(C.tintaOsc, 1).fillCircle(x, y, 3.5 * S).fillStyle(0xffd65a, 1).fillCircle(x, y, 2.5 * S);
    };
    if (this.modo === 'mundo') {
      // En vuelo, la casilla bajo el ratón se ilumina si se puede ir (punto descubierto y no es la tuya).
      if (this.vuelo) for (const [id, c] of this.fichas) if (id !== av.mapa.id && av.vuelosConocidos[id] && dentro(c, ptr.x, ptr.y)) mg.lineStyle(2 * S, 0x9be38a, 1).strokeRect(c.x - 1 * S, c.y - 1 * S, c.w + 2 * S, c.h + 2 * S);
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
  // El icono del volador en cada zona con punto de vuelo descubierto, donde está (la miniatura llena la casilla).
  private iconosVuelo(): void {
    if (!this.textures.exists('icono_vuelo')) return;
    for (const z of ZONAS_MUNDO) {
      const v = this.av.vuelosConocidos[z.id], c = this.fichas.get(z.id);
      if (!v || !c) continue;
      // Con la proporción de la zona (la de su miniatura) y el mismo recorte que ella; sin miniatura, a lo ancho y alto.
      const src = this.textures.exists('mini_' + z.id) ? this.textures.get('mini_' + z.id).getSourceImage() as HTMLCanvasElement : null;
      const iw = src?.width ?? c.w, ih = src?.height ?? c.h, k = Math.max(c.w / iw, c.h / ih);
      const x = Phaser.Math.Clamp(c.x + c.w / 2 + (v.u - 0.5) * iw * k, c.x + 6 * S, c.x + c.w - 6 * S), y = Phaser.Math.Clamp(c.y + c.h / 2 + (v.v - 0.5) * ih * k, c.y + 10 * S, c.y + c.h - 18 * S);
      this.capaMundo.push(this.add.image(x, y, 'icono_vuelo').setOrigin(0.5, 1).setScale(S).setDepth(4).setVisible(this.modo === 'mundo'));
    }
  }
}
