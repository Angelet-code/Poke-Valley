// HUD superpuesto al valle (escena paralela, sin zoom): reloj, Pokécoins, energía, almacén, objetivo,
// inventario, barra de construcción (modo B), panel de la caja de Pelipper y avisos. Lee el estado de la simulación a través de la escena del mundo.
// Estilo pixel art del lienzo de diseño (madera + pergamino, esquinas en escalón): todo se dibuja en
// píxeles de juego (1 = S px de pantalla) con rectángulos, sin escalar texturas.
import Phaser from 'phaser';
import { DIBUJO, S, VH, VW } from '../config';
import { ITEMS, PRECIO_RECURSO } from '../data/items';
import { BAYAS_PLATO, CONSTRUIBLES, ENERGIA_PLATO, MEJORAS_CASA } from '../data/edificios';
import { MIN_DESMAYO, MIN_DIA, RECURSOS, capacidad, jornada, oscuridad, type Recurso } from '../sim/World';
import { LINEAS, NIVEL_MAX, NOMBRE_GRUPO, NOMBRE_PERFIL, NOMBRE_STAT, NOMBRE_TIPO, STATS, expNivel, factorNivel, forma, perfil, stats, type Stat } from '../data/pokedex';
import { ICONO_RECURSO, NOMBRE_RECURSO, type WorldScene } from './WorldScene';

export const FUENTE = '"Segoe UI", system-ui, -apple-system, sans-serif';
const FUENTE_PX = `"Pixelify Sans", ${FUENTE}`;        // textos y números
const FUENTE_TIT = `"Silkscreen", ${FUENTE_PX}`;         // títulos de panel

// Paleta del lienzo de diseño.
const C = {
  madera: 0x6b4226, maderaClara: 0x8b5a33, perg: 0xf6e7c1, pergLuz: 0xfff6dc, pergSombra: 0xe2c690,
  bandeja: 0xd9b97c, bandejaLuz: 0xecd29c, bandejaSombra: 0xb8935a, hueco: 0xe6cd96, huecoSombra: 0xc7a565,
  elegido: 0xffd65a, elegidoFondo: 0xfbeec8, tinta: 0x4a2e1a, tintaOsc: 0x3a2414, sombra: 0x3a2212,
  barraFondo: 0x5b3a22, falta: 0xb03a2e, hoja: 0x8fd36a, hojaLuz: 0xc6f0a0, hojaOsc: 0x63a843, aviso: 0xe8a33a, avisoLuz: 0xffd08a, avisoOsc: 0xb97a22,
};
const HEX = (c: number) => '#' + c.toString(16).padStart(6, '0');

// Iconos de la interfaz (pixel art 1:1, '.' = transparente).
const PALETA: Record<string, string> = {
  g: '#3f6b2a', l: '#8fd36a', k: '#c28a2c', y: '#f2c94c', h: '#fff2b0', o: '#e8a33a', s: '#ffd65a',
  c: '#c9d6e3', w: '#eef3f8', q: '#9fb3c8', b: '#6aa8e8', r: '#a3542f', m: '#d9a066', d: '#6b4226',
};
const ICONOS: Record<string, string[]> = {
  ui_energia: ['...ggg.', '..glg..', '.glg...', '.gllgg.', '...ggg.', '..glg..', '.ggg...', '.gg....', '.......'],
  ui_moneda: ['..kkk..', '.kyyyk.', 'kyhkyyk', 'kyykyyk', 'kyykyyk', '.kyyyk.', '..kkk..'],
  ui_sol: ['....o....', '.o.....o.', '...sss...', '..shsss..', 'o.sssss.o', '..sssss..', '...sss...', '.o.....o.', '....o....'],
  ui_lluvia: ['.........', '..ccccc..', '.cwwwccc.', '.ccccccc.', '.qqqqqqq.', '.........', '..b..b...', '..b.bb...', '....b....'],
  ui_casa: ['...r...', '..rrr..', '.rrrrr.', 'rrrrrrr', '.mmmmm.', '.mmdmm.', '.mmdmm.'],
};

const SLOT = 20, HUECO = 2;   // casilla del inventario y separación (px de juego)
// Barra de construcción: cartas de 80×20 en filas de 3 (la última fila, a la altura del inventario).
const OBRA_COLS = 3, OBRA_FILA = 22, OBRA_FILAS = Math.ceil(CONSTRUIBLES.length / OBRA_COLS);
const cartaObra = (xb: number, yb: number, i: number) =>
  ({ cx: xb + 4 + (i % OBRA_COLS) * 87, cy: yb + 4 - (OBRA_FILAS - 1 - Math.floor(i / OBRA_COLS)) * OBRA_FILA });
const FICHA_W = 118, FICHA_Y = 70, FICHA_H = 94; // ficha del aldeano, a la derecha bajo el dinero
const MAS = RECURSOS.length - 3;                 // recursos de más sobre los 3 del principio (ladrillos, platos)
const ALM_H = 51 + MAS * 12;                     // alto del panel del almacén (sin la fila de aldeanos)
const ALM_VISTA = 4000, ALM_FUNDIDO = 250;       // ms a la vista tras un cambio; ms del fundido
const CAJA_W = 216, CAJA_H = 134 + MAS * 15, CAJA_Y = 52 - MAS * 6; // panel de la caja de Pelipper (px de juego)
const CASA_W = 220, CASA_Y = 50;                 // panel de la casa (alto según lo que haya)

type G = Phaser.GameObjects.Graphics;
const rect = (g: G, c: number, a: number, x: number, y: number, w: number, h: number) =>
  g.fillStyle(c, a).fillRect(x * S, y * S, w * S, h * S);
// Rectángulo con esquinas en escalón de 2 píxeles (marco) o de 1 (relleno interior).
const forma2 = (g: G, c: number, a: number, x: number, y: number, w: number, h: number) => {
  rect(g, c, a, x + 2, y, w - 4, 1); rect(g, c, a, x + 1, y + 1, w - 2, 1); rect(g, c, a, x, y + 2, w, h - 4);
  rect(g, c, a, x + 1, y + h - 2, w - 2, 1); rect(g, c, a, x + 2, y + h - 1, w - 4, 1);
};
const forma1 = (g: G, c: number, a: number, x: number, y: number, w: number, h: number) => {
  rect(g, c, a, x + 1, y, w - 2, 1); rect(g, c, a, x, y + 1, w, h - 2); rect(g, c, a, x + 1, y + h - 1, w - 2, 1);
};
interface Estilo { borde: number; fondo: number; luz?: number; osc?: number; oscAlto?: number; hundido?: number; sombra?: boolean }
const PANEL: Estilo = { borde: C.madera, fondo: C.perg, luz: C.pergLuz, osc: C.pergSombra, sombra: true };
function marco(g: G, x: number, y: number, w: number, h: number, e: Estilo): void {
  if (e.sombra) forma2(g, C.sombra, 0.55, x, y + 1, w, h);
  forma2(g, e.borde, 1, x, y, w, h);
  forma1(g, e.fondo, 1, x + 1, y + 1, w - 2, h - 2);
  if (e.luz !== undefined) rect(g, e.luz, 1, x + 2, y + 1, w - 4, 1);
  if (e.osc !== undefined) rect(g, e.osc, 1, x + 2, y + h - 1 - (e.oscAlto ?? 1), w - 4, e.oscAlto ?? 1);
  if (e.hundido !== undefined) { rect(g, e.hundido, 1, x + 2, y + 1, w - 4, 1); rect(g, e.hundido, 1, x + 1, y + 2, 1, h - 4); }
}

export class UIScene extends Phaser.Scene {
  private world!: WorldScene;
  private textos: Phaser.GameObjects.Text[] = [];
  private noche!: Phaser.GameObjects.Rectangle;
  // Energía y almacén.
  private energia!: G;
  private almacenG!: G;
  private recursos = {} as Record<Recurso, Phaser.GameObjects.Text>;
  private aldeanos!: Phaser.GameObjects.Text;
  private casa!: Phaser.GameObjects.Image;
  private conAldeanos?: boolean;
  // El panel del almacén se esconde solo: sale al cambiar lo guardado, junto a la mesa o en modo construcción.
  private almObjs: (G | Phaser.GameObjects.Text | Phaser.GameObjects.Image)[] = [];
  private almClave = '';
  private almHasta = 0;         // hasta cuándo (time.now) sigue a la vista tras un cambio
  private almA = 1;             // opacidad actual (0 = escondido y el objetivo sube a su sitio)
  // Reloj y dinero.
  private dia!: Phaser.GameObjects.Text;
  private hora!: Phaser.GameObjects.Text;
  private tiempo!: Phaser.GameObjects.Image;
  private progreso!: G;
  private dineroG!: G;
  private moneda!: Phaser.GameObjects.Image;
  private dinero!: Phaser.GameObjects.Text;
  private dineroAnt = '';
  private monedas = -1;          // Pokécoins que enseña el contador (sube poco a poco hasta las de verdad)
  private cajaHUD!: Phaser.GameObjects.Text; // "en la caja: +N" bajo el contador
  // Inventario.
  private slotsG!: G;
  private slotAnt = -1;
  private slots: { icono: Phaser.GameObjects.Image; num: Phaser.GameObjects.Text }[] = [];
  private nombreG!: G;
  private nombre!: Phaser.GameObjects.Text;
  private precio!: Phaser.GameObjects.Text;
  private precioMoneda!: Phaser.GameObjects.Image;
  private nombreAnt = '';
  // Objetivo (bajo el almacén).
  private objetivoG!: G;
  private objetivoTit!: Phaser.GameObjects.Text;
  private objetivoTxt!: Phaser.GameObjects.Text;
  private objetivoAnt = '';
  private objetivoFin = 0;      // y donde acaba el panel del objetivo (debajo van los pendientes)
  // Pendientes (GDD-pueblo §9.1): visitantes que se fueron y volverán, bajo el objetivo.
  private pendG!: G;
  private pendObjs: Phaser.GameObjects.GameObject[] = [];
  private pendAnt = '';
  // Barra de construcción (tapa el inventario mientras dura el modo B).
  private obraObjs: Phaser.GameObjects.GameObject[] = [];
  private obraG!: G;
  private obraCartas: { costes: { r: string; n: number; num: Phaser.GameObjects.Text }[]; zona: Phaser.GameObjects.Zone }[] = [];
  private obraFondo!: Phaser.GameObjects.Zone;
  private obraAnt = '';
  // Caja de Pelipper (panel centrado; se abre con F en la mesa o en la caja).
  private cajaObjs: Phaser.GameObjects.GameObject[] = [];
  private cajaZonas: Phaser.GameObjects.Zone[] = [];
  private cajaG!: G;
  private cajaFilas = {} as Record<Recurso, { alm: Phaser.GameObjects.Text; caja: Phaser.GameObjects.Text; sub: Phaser.GameObjects.Text }>;
  private cajaMochila!: Phaser.GameObjects.Text;
  private cajaMochIcono!: Phaser.GameObjects.Image;
  private cajaObjetos!: Phaser.GameObjects.Text;
  private cajaTotal!: Phaser.GameObjects.Text;
  private cajaAnt = '';
  // Ficha del aldeano elegido o bajo el cursor (GDD-pueblo §10), a la derecha bajo el dinero.
  private fichaObjs: Phaser.GameObjects.GameObject[] = [];
  private fichaG!: G;
  private fichaCara!: Phaser.GameObjects.Image;
  private fichaNombre!: Phaser.GameObjects.Text;
  private fichaNivel!: Phaser.GameObjects.Text;
  private fichaSub!: Phaser.GameObjects.Text;
  private fichaVal = {} as Record<Stat, Phaser.GameObjects.Text>;
  private fichaPie!: Phaser.GameObjects.Text;
  private fichaAnt = '-';
  // Panel de la casa (se rehace entero al cambiar lo que enseña).
  private casaObjs: Phaser.GameObjects.GameObject[] = [];
  private casaAnt = '';
  // Avisos.
  private aviso_!: Phaser.GameObjects.Container;
  private avisoG!: G;
  private avisoTxt!: Phaser.GameObjects.Text;
  private avisoTimer?: Phaser.Time.TimerEvent;

  constructor() { super('ui'); }

  private texto(x: number, y: number, txt: string, px: number, color: number, o: Phaser.Types.GameObjects.Text.TextStyle = {}): Phaser.GameObjects.Text {
    const t = this.add.text(x * S, y * S, txt, { fontFamily: FUENTE_PX, fontSize: `${px * S}px`, color: HEX(color), ...o }).setDepth(3);
    this.textos.push(t);
    return t;
  }
  private icono(x: number, y: number, key: string, fit = 0): Phaser.GameObjects.Image {
    const im = this.add.image(x * S, y * S, key).setDepth(3);
    const fr = im.frame, k = fit ? Math.min(1, fit / Math.max(fr.width, fr.height)) : 1;
    return im.setScale(S * k);
  }

  create(): void {
    this.world = this.scene.get('world') as WorldScene;
    this.textos = []; this.slots = []; this.slotAnt = -1; this.dineroAnt = ''; this.nombreAnt = ''; this.conAldeanos = undefined;
    this.objetivoAnt = ''; this.obraObjs = []; this.obraCartas = []; this.obraAnt = '-'; // '-' fuerza el primer dibujado (oculta la barra)
    this.monedas = -1; this.cajaObjs = []; this.cajaZonas = []; this.cajaAnt = '-'; this.casaObjs = []; this.casaAnt = '';
    // Phaser.generate solo acepta paletas con claves 0-F: traducir las letras a esos índices.
    const letras = Object.keys(PALETA), hexd = '0123456789ABCDEF';
    const palette = Object.fromEntries([...hexd].map((d, i) => [d, PALETA[letras[i]] ?? '#000'])) as unknown as Phaser.Types.Create.Palette;
    for (const [k, filas] of Object.entries(ICONOS)) {
      const data = filas.map((f) => f.replace(/[^.]/g, (ch) => hexd[letras.indexOf(ch)]));
      if (!this.textures.exists(k)) this.textures.generate(k, { data, pixelWidth: 1, palette });
    }

    // Tinte de atardecer/noche sobre el valle (bajo el HUD).
    this.noche = this.add.rectangle(0, 0, VW * S, VH * S, 0x101c30, 1).setOrigin(0).setDepth(0).setAlpha(0); // la opacidad la da setAlpha en update()

    // Energía (arriba izquierda).
    const ge = this.add.graphics().setDepth(1);
    marco(ge, 4, 4, 80, 15, PANEL);
    this.icono(12.5, 11.5, 'ui_energia');
    this.energia = this.add.graphics().setDepth(2);

    // Almacén del pueblo: madera, piedra y bayas (lo que traen los aldeanos y lo que dejas tú).
    this.almacenG = this.add.graphics().setDepth(1);
    this.almObjs = [this.almacenG, this.texto(9, 25, 'ALMACÉN', 5, C.maderaClara, { fontFamily: FUENTE_TIT })];
    RECURSOS.forEach((r, i) => {
      const y = 39 + i * 12;
      this.recursos[r] = this.texto(23, y, '0', 8, C.tinta, { fontStyle: 'bold' }).setOrigin(0, 0.5);
      this.almObjs.push(this.icono(14.5, y, ICONO_RECURSO[r], 12), this.recursos[r],
        this.texto(40, y + 0.5, NOMBRE_RECURSO[r], 6, C.maderaClara).setOrigin(0, 0.5));
    });
    this.casa = this.icono(12.5, 76.5 + MAS * 12, 'ui_casa');
    this.aldeanos = this.texto(19, 76.5 + MAS * 12, '', 6, C.tinta).setOrigin(0, 0.5);
    this.almObjs.push(this.casa, this.aldeanos);
    this.almClave = ''; this.almHasta = 0; this.almA = 1;

    // Objetivo: lo siguiente que conviene hacer (WorldScene.objetivo), en un panel bajo el almacén.
    this.objetivoG = this.add.graphics().setDepth(1);
    this.objetivoTit = this.texto(9, 0, 'OBJETIVO', 5, C.maderaClara, { fontFamily: FUENTE_TIT });
    this.objetivoTxt = this.texto(9, 0, '', 6, C.tinta, { wordWrap: { width: 110 * S } });
    this.pendG = this.add.graphics().setDepth(1);
    this.pendObjs = []; this.pendAnt = '';

    // Reloj (arriba derecha): día, tiempo, hora y avance del día.
    const xr = VW - 4 - 72, gr = this.add.graphics().setDepth(1);
    marco(gr, xr, 4, 72, 34, PANEL);
    this.dia = this.texto(xr + 5, 8, '', 5, C.maderaClara, { fontFamily: FUENTE_TIT });
    this.tiempo = this.icono(xr + 72 - 9.5, 11.5, 'ui_sol');
    this.hora = this.texto(xr + 5, 15, '', 13, C.tinta, { fontStyle: 'bold' });
    this.progreso = this.add.graphics().setDepth(2);
    // Dinero, en su propio panel bajo el reloj (se redimensiona con la cifra).
    this.dineroG = this.add.graphics().setDepth(1);
    this.moneda = this.icono(0, 48.5, 'ui_moneda');
    this.dinero = this.texto(0, 48.5, '', 8, C.tinta, { fontStyle: 'bold' }).setOrigin(1, 0.5);
    this.cajaHUD = this.texto(VW - 6, 61.5, '', 6, 0xfff6dc, { stroke: HEX(C.tintaOsc), strokeThickness: 2 * S }).setOrigin(1, 0.5);

    // Inventario (12 casillas) abajo en el centro, sobre una bandeja de madera.
    const n = 12, wb = 8 + n * SLOT + (n - 1) * HUECO, xb = Math.round((VW - wb) / 2), yb = VH - 5 - 28;
    marco(this.add.graphics().setDepth(1), xb, yb, wb, 28, { borde: C.madera, fondo: C.bandeja, luz: C.bandejaLuz, osc: C.bandejaSombra, sombra: true });
    this.slotsG = this.add.graphics().setDepth(2);
    for (let i = 0; i < n; i++) {
      const x = xb + 4 + i * (SLOT + HUECO), y = yb + 4;
      const icono = this.add.image((x + SLOT / 2) * S, (y + SLOT / 2) * S, '__DEFAULT').setVisible(false).setDepth(3);
      const num = this.texto(x + SLOT - 1.5, y + SLOT + 0.5, '', 6, 0xfff6dc, { fontStyle: 'bold', stroke: HEX(C.tintaOsc), strokeThickness: 2 * S }).setOrigin(1, 1);
      this.slots.push({ icono, num });
    }
    // Etiqueta del objeto elegido (nombre · precio), con su piquito hacia la barra.
    this.nombreG = this.add.graphics().setDepth(2);
    this.nombre = this.texto(0, yb - 10, '', 6, C.perg).setOrigin(0, 0.5);
    this.precio = this.texto(0, yb - 10, '', 6, C.elegido).setOrigin(0, 0.5);
    this.precioMoneda = this.icono(0, yb - 10, 'ui_moneda').setDepth(3).setVisible(false);

    // Teclas de ayuda (abajo derecha).
    const ayuda = (y: number, tecla: string, w: number, txt: string, px: number) => {
      const x = VW - 5 - w, g = this.add.graphics().setDepth(1);
      marco(g, x, y, w, 11, { borde: C.madera, fondo: C.perg, osc: C.bandeja, oscAlto: 2 });
      this.texto(x + w / 2, y + 4.5, tecla, px, C.tinta, { fontFamily: FUENTE_TIT }).setOrigin(0.5);
      this.texto(x - 3, y + 5.5, txt, 6, 0xfff6dc, { stroke: HEX(C.tintaOsc), strokeThickness: 2 * S }).setOrigin(1, 0.5);
    };
    ayuda(VH - 31, 'B', 10, 'Construir', 5);
    ayuda(VH - 18, 'F · Clic', 28, 'Acción', 4);

    this.crearBarraObra(xb, yb, wb);
    this.crearPanelCaja();
    this.crearFicha();

    // Avisos: panel de pergamino centrado sobre la barra que se desvanece solo.
    this.avisoG = this.add.graphics();
    this.avisoTxt = this.texto(0, 0, '', 7, C.tinta, { align: 'center', wordWrap: { width: 300 * S } }).setOrigin(0.5);
    this.aviso_ = this.add.container(VW * S / 2, (VH - 70) * S, [this.avisoG, this.avisoTxt]).setDepth(4).setAlpha(0);

    this.world.events.on('aviso', (txt: string) => this.aviso(txt));
    this.events.once('shutdown', () => this.world.events.off('aviso'));
    // Las fuentes pixel pueden llegar después del primer dibujado: rehacer los textos cuando estén.
    document.fonts?.ready.then(() => { if (this.sys.isActive()) { this.textos.forEach((t) => t.updateText()); this.dineroAnt = this.nombreAnt = ''; } });
  }

  // Barra de construcción: una carta por edificio (miniatura, nombre y coste en iconos; en rojo lo
  // que falta). Se elige con 1-6, Q/E, la rueda o con clic en la carta; el clic en la barra no llega al valle.
  private crearBarraObra(xb: number, yb: number, wb: number): void {
    const o = this.obraObjs, D = 6, alto = (OBRA_FILAS - 1) * OBRA_FILA, yt = yb - alto;
    this.obraFondo = this.add.zone(xb * S, (yt - 16) * S, wb * S, (46 + alto) * S).setOrigin(0).setDepth(D).setInteractive();
    this.obraG = this.add.graphics().setDepth(D);
    o.push(this.obraG, this.texto(xb + 9, yt - 11, 'CONSTRUIR', 5, C.maderaClara, { fontFamily: FUENTE_TIT }));
    CONSTRUIBLES.forEach((def, i) => {
      const { cx, cy } = cartaObra(xb, yb, i);
      o.push(this.icono(cx + 11, cy + 10, 'obj_' + def.obj, 18));
      o.push(this.texto(cx + 22, cy + 5.5, `${i + 1}  ${def.nombre}`, 6, C.tinta, { fontStyle: 'bold' }).setOrigin(0, 0.5));
      const costes = (Object.entries(def.coste) as [string, number][]).map(([r, n], k) => {
        const x = cx + 22 + k * 22;
        o.push(this.icono(x + 3.5, cy + 14.5, ICONO_RECURSO[r as Recurso], 8));
        const num = this.texto(x + 8.5, cy + 14.5, String(n), 6, C.tinta, { fontStyle: 'bold' }).setOrigin(0, 0.5);
        o.push(num);
        return { r, n, num };
      });
      const zona = this.add.zone(cx * S, cy * S, 80 * S, 20 * S).setOrigin(0).setDepth(D + 1).setInteractive();
      zona.on('pointerdown', () => this.world.elegirObra(i));
      this.obraCartas.push({ costes, zona });
    });
    o.push(this.texto(xb + wb - 4, yt - 9, 'Clic: colocar · B: salir', 5, 0xfff6dc, { stroke: HEX(C.tintaOsc), strokeThickness: 2 * S }).setOrigin(1, 0.5));
    for (const x of o) (x as unknown as Phaser.GameObjects.Components.Depth).setDepth(D + 1);
    this.obraG.setDepth(D);
  }
  private dibujarBarraObra(): void {
    const sel = this.world.obra, on = sel !== null, sim = this.world.sim;
    const clave = on ? `${sel}|${CONSTRUIBLES.map(d => sim.falta(d.coste) ? 0 : 1).join('')}|${this.obraCartas.map(c => c.costes.map(k => sim.disponible(k.r as Recurso) >= k.n ? 1 : 0).join('')).join('')}` : '';
    if (clave === this.obraAnt) return;
    this.obraAnt = clave;
    for (const x of this.obraObjs) (x as unknown as Phaser.GameObjects.Components.Visible).setVisible(on);
    this.obraFondo.input!.enabled = on;
    this.obraCartas.forEach(c => { c.zona.input!.enabled = on; });
    this.nombre.setVisible(!on && !!this.nombreAnt); this.precio.setVisible(!on && !!this.nombreAnt); this.nombreG.setVisible(!on);
    if (!on) return;
    const g = this.obraG, n = this.slots.length, wb = 8 + n * SLOT + (n - 1) * HUECO, xb = Math.round((VW - wb) / 2), yb = VH - 5 - 28;
    g.clear();
    const alto = (OBRA_FILAS - 1) * OBRA_FILA;
    marco(g, xb + 4, yb - alto - 15, 52, 14, PANEL);
    marco(g, xb - 2, yb - alto - 2, wb + 4, 32 + alto, { borde: C.madera, fondo: C.bandeja, luz: C.bandejaLuz, osc: C.bandejaSombra, sombra: true });
    CONSTRUIBLES.forEach((_, i) => {
      const { cx, cy } = cartaObra(xb, yb, i), elegida = i === sel;
      marco(g, cx, cy, 80, 20, { borde: elegida ? C.elegido : C.maderaClara, fondo: elegida ? C.elegidoFondo : C.hueco, hundido: C.huecoSombra });
      for (const k of this.obraCartas[i].costes) k.num.setColor(HEX(sim.disponible(k.r as Recurso) >= k.n ? C.tinta : C.falta));
    });
  }

  // Panel de la caja de Pelipper: por recurso, lo que hay en el almacén, lo que va en la caja (− / + / todo,
  // Mayús = de 10 en 10), su precio y el total; la fila de la mochila mete lo elegido con Q/E (Poké Balls…);
  // "Vender sobrante" deja en el almacén lo que se guarda (World.reserva) y mete el resto.
  private crearPanelCaja(): void {
    const o = this.cajaObjs, D = 8, x0 = Math.round((VW - CAJA_W) / 2), y0 = CAJA_Y;
    const zona = (x: number, y: number, w: number, h: number, fn: (mayus: boolean) => void) => {
      const z = this.add.zone(x * S, y * S, w * S, h * S).setOrigin(0).setDepth(D + 1).setInteractive({ useHandCursor: true });
      z.on('pointerdown', (p: Phaser.Input.Pointer) => fn(!!(p.event as MouseEvent)?.shiftKey));
      this.cajaZonas.push(z);
    };
    zona(x0, y0, CAJA_W, CAJA_H, () => { /* el clic en el panel no llega al valle */ });
    this.cajaZonas[0].setDepth(D);
    this.cajaG = this.add.graphics().setDepth(D);
    o.push(this.cajaG);
    o.push(this.texto(x0 + 9, y0 + 5, 'CAJA DE PELIPPER', 5, C.maderaClara, { fontFamily: FUENTE_TIT }));
    o.push(this.texto(x0 + 9, y0 + 13, 'Se lo lleva esta noche y te paga en Pokécoins.', 6, C.tinta));
    if (this.textures.exists('pelipper-Idle')) o.push(this.add.image((x0 + CAJA_W - 17) * S, (y0 + 25) * S, 'pelipper-Idle', 0).setOrigin(0.5, 0.72).setScale(S * 0.7));
    const cab = (x: number, t: string, ox = 0.5) => o.push(this.texto(x, y0 + 27, t, 5, C.maderaClara).setOrigin(ox, 0.5));
    cab(x0 + 80, 'almacén', 1); cab(x0 + 111, 'caja'); cab(x0 + 171, 'precio'); cab(x0 + CAJA_W - 9, 'total', 1);
    RECURSOS.forEach((r, i) => {
      const cy = y0 + 39 + i * 15;
      o.push(this.icono(x0 + 14, cy, ICONO_RECURSO[r], 11));
      o.push(this.texto(x0 + 23, cy, NOMBRE_RECURSO[r], 6, C.tinta).setOrigin(0, 0.5));
      const alm = this.texto(x0 + 80, cy, '0', 8, C.tinta, { fontStyle: 'bold' }).setOrigin(1, 0.5);
      const caja = this.texto(x0 + 111, cy, '0', 8, C.tinta, { fontStyle: 'bold' }).setOrigin(0.5);
      o.push(this.texto(x0 + 167, cy, `×${PRECIO_RECURSO[r]}`, 6, C.maderaClara).setOrigin(0.5));
      o.push(this.icono(x0 + 177.5, cy, 'ui_moneda'));
      const sub = this.texto(x0 + CAJA_W - 9, cy, '', 7, C.tinta, { fontStyle: 'bold' }).setOrigin(1, 0.5);
      o.push(alm, caja, sub);
      this.cajaFilas[r] = { alm, caja, sub };
      for (const [bx, w, txt, n] of [[x0 + 86, 11, '−', -1], [x0 + 125, 11, '+', 1], [x0 + 139, 17, 'todo', 0]] as [number, number, string, number][]) {
        o.push(this.texto(bx + w / 2, cy, txt, txt === 'todo' ? 5 : 7, C.tinta, { fontStyle: 'bold' }).setOrigin(0.5));
        zona(bx, cy - 5, w, 11, (mayus) => this.world.moverCaja(r, n ? n * (mayus ? 10 : 1) : this.world.sim.estado.almacen[r]));
      }
    });
    const ym = y0 + 39 + RECURSOS.length * 15;
    o.push(this.texto(x0 + 9, ym, 'Mochila (Q/E):', 6, C.maderaClara).setOrigin(0, 0.5));
    this.cajaMochIcono = this.icono(x0 + 63, ym, '__DEFAULT');
    this.cajaMochila = this.texto(x0 + 70, ym, '', 6, C.tinta).setOrigin(0, 0.5);
    o.push(this.cajaMochIcono, this.cajaMochila, this.texto(x0 + 157.5, ym, 'meter', 6, C.tinta, { fontStyle: 'bold' }).setOrigin(0.5));
    zona(x0 + 145, ym - 5, 25, 11, () => this.world.meterElegido());
    this.cajaObjetos = this.texto(x0 + 9, ym + 11, '', 5, C.maderaClara).setOrigin(0, 0.5);
    o.push(this.cajaObjetos);
    const yv = y0 + CAJA_H - 25;
    o.push(this.texto(x0 + 44, yv + 6, 'Vender sobrante', 6, C.tinta, { fontStyle: 'bold' }).setOrigin(0.5));
    zona(x0 + 9, yv, 70, 12, () => this.world.venderSobrante());
    this.cajaTotal = this.texto(x0 + CAJA_W - 17, yv + 6, '', 8, C.tinta, { fontStyle: 'bold' }).setOrigin(1, 0.5);
    o.push(this.cajaTotal, this.icono(x0 + CAJA_W - 11.5, yv + 6, 'ui_moneda'));
    o.push(this.texto(x0 + CAJA_W / 2, y0 + CAJA_H - 7, 'Mayús + clic: de 10 en 10 · F, Esc o andar: cerrar', 5, C.maderaClara).setOrigin(0.5));
    for (const x of o) (x as unknown as Phaser.GameObjects.Components.Depth).setDepth(D + 1);
    this.cajaG.setDepth(D);
  }
  private dibujarPanelCaja(): void {
    const on = this.world.panelCaja, sim = this.world.sim, e = sim.estado, it = e.inventario[this.world.slot];
    const clave = on ? JSON.stringify([e.almacen, e.cajaR, e.caja, it, sim.valorCaja]) : '';
    if (clave === this.cajaAnt) return;
    this.cajaAnt = clave;
    for (const x of this.cajaObjs) (x as unknown as Phaser.GameObjects.Components.Visible).setVisible(on);
    this.cajaZonas.forEach(z => { z.input!.enabled = on; });
    if (!on) return;
    const g = this.cajaG, x0 = Math.round((VW - CAJA_W) / 2), y0 = CAJA_Y;
    g.clear();
    marco(g, x0, y0, CAJA_W, CAJA_H, PANEL);
    rect(g, C.pergSombra, 1, x0 + 9, y0 + 32, CAJA_W - 18, 1);
    const boton = (x: number, y: number, w: number, h: number, activo: boolean) =>
      marco(g, x, y, w, h, activo ? { borde: C.madera, fondo: C.bandejaLuz, osc: C.bandejaSombra } : { borde: C.huecoSombra, fondo: C.hueco });
    RECURSOS.forEach((r, i) => {
      const cy = y0 + 39 + i * 15, f = this.cajaFilas[r];
      f.alm.setText(String(e.almacen[r]));
      f.caja.setText(String(e.cajaR[r]));
      f.sub.setText(e.cajaR[r] ? String(e.cajaR[r] * PRECIO_RECURSO[r]) : '');
      boton(x0 + 86, cy - 5, 11, 11, e.cajaR[r] > 0);
      boton(x0 + 125, cy - 5, 11, 11, e.almacen[r] > 0);
      boton(x0 + 139, cy - 5, 17, 11, e.almacen[r] > 0);
    });
    // Mochila: lo elegido con Q/E (los recursos ya se dejaron en el almacén al abrir).
    const ym = y0 + 39 + RECURSOS.length * 15, def = it ? ITEMS[it.id] : undefined;
    this.cajaMochIcono.setVisible(!!def && this.textures.exists(def.icono));
    if (def && this.textures.exists(def.icono)) {
      this.cajaMochIcono.setTexture(def.icono);
      const fr = this.cajaMochIcono.frame;
      this.cajaMochIcono.setScale(S * Math.min(1, 10 / Math.max(fr.width, fr.height)));
    }
    this.cajaMochila.setText(def ? `${def.nombre}${it!.n > 1 ? ' ×' + it!.n : ''} · ${def.precio * it!.n}` : 'nada elegido').setX((x0 + (def ? 70 : 63)) * S);
    boton(x0 + 145, ym - 5, 25, 11, !!it);
    this.cajaObjetos.setText(e.caja.length ? 'Ya en la caja: ' + e.caja.map(c => `${ITEMS[c.id]?.nombre ?? c.id} ×${c.n}`).join(', ') : '');
    boton(x0 + 9, y0 + CAJA_H - 25, 70, 12, RECURSOS.some(r => sim.sobrante(r) > 0));
    this.cajaTotal.setText(`Esta noche: ${sim.valorCaja}`);
  }

  // Panel de la casa (F en la puerta): dormir; cocinar guisos si tiene cocina; y la mejora siguiente con su
  // coste (en rojo lo que falta) y lo que hace. Se rehace entero al cambiar lo que enseña.
  private dibujarPanelCasa(): void {
    const w = this.world, sim = w.sim, e = sim.estado, on = w.panelCasa, m = sim.mejoraSiguiente;
    const clave = on ? JSON.stringify([e.casa, e.almacen.bayas, e.almacen.platos, sim.disponible('bayas'), Math.floor(e.energia), e.dinero, m && Object.keys(m.coste).map(r => sim.disponible(r as Recurso))]) : '';
    if (clave === this.casaAnt) return;
    this.casaAnt = clave;
    this.casaObjs.forEach(x => x.destroy()); this.casaObjs = [];
    if (!on) return;
    const D = 8, o = this.casaObjs, x0 = Math.round((VW - CASA_W) / 2), y0 = CASA_Y, cocina = e.casa >= 2;
    const h = 44 + (cocina ? 26 : 0) + (m ? 44 : 12);
    const g = this.add.graphics().setDepth(D);
    o.push(g);
    // Textos e iconos sueltos: se destruyen al rehacer el panel y no deben quedar en this.textos.
    const txt = (x: number, y: number, t: string, px: number, c: number, st: Phaser.Types.GameObjects.Text.TextStyle = {}) => {
      const tt = this.add.text(x * S, y * S, t, { fontFamily: FUENTE_PX, fontSize: `${px * S}px`, color: HEX(c), ...st }).setDepth(D + 1);
      o.push(tt); return tt;
    };
    const ico = (x: number, y: number, key: string, fit: number) => { const im = this.icono(x, y, key, fit).setDepth(D + 1); o.push(im); return im; };
    const boton = (x: number, y: number, bw: number, t: string, activo: boolean, fn: () => void) => {
      marco(g, x, y, bw, 12, activo ? { borde: C.madera, fondo: C.bandejaLuz, osc: C.bandejaSombra } : { borde: C.huecoSombra, fondo: C.hueco });
      txt(x + bw / 2, y + 6, t, 6, activo ? C.tinta : C.maderaClara, { fontStyle: 'bold' }).setOrigin(0.5);
      const z = this.add.zone(x * S, y * S, bw * S, 12 * S).setOrigin(0).setDepth(D + 2).setInteractive({ useHandCursor: true });
      z.on('pointerdown', fn); o.push(z);
    };
    const fondo = this.add.zone(x0 * S, y0 * S, CASA_W * S, h * S).setOrigin(0).setDepth(D).setInteractive(); // el clic no llega al valle
    o.push(fondo);
    marco(g, x0, y0, CASA_W, h, PANEL);
    const nombres = ['Cama', ...MEJORAS_CASA.map(q => q.nombre)];
    txt(x0 + 9, y0 + 5, 'CASA DE BULBASAUR', 5, C.maderaClara, { fontFamily: FUENTE_TIT });
    txt(x0 + CASA_W - 9, y0 + 5, `Nv ${e.casa} · ${nombres.slice(0, e.casa).join(' + ')}`, 5, C.maderaClara).setOrigin(1, 0);
    // Dormir.
    let y = y0 + 16;
    boton(x0 + 9, y, 50, 'Dormir', true, () => w.dormirYa());
    txt(x0 + 64, y + 6, `Hasta mañana a las 6:00 · amaneces con ${sim.energiaMax} de energía`, 6, C.tinta).setOrigin(0, 0.5);
    y += 18;
    // Cocina.
    if (cocina) {
      rect(g, C.pergSombra, 1, x0 + 9, y - 3, CASA_W - 18, 1);
      const puede = sim.disponible('bayas') >= BAYAS_PLATO && e.energia >= ENERGIA_PLATO;
      boton(x0 + 9, y, 50, 'Cocinar', puede, () => w.cocinar(1));
      boton(x0 + 62, y, 22, '×5', puede, () => w.cocinar(5));
      ico(x0 + 93, y + 6, ICONO_RECURSO.bayas, 9);
      txt(x0 + 99, y + 6, `${BAYAS_PLATO} + ${ENERGIA_PLATO} energía →`, 6, C.tinta).setOrigin(0, 0.5);
      ico(x0 + 158, y + 6, ICONO_RECURSO.platos, 10);
      txt(x0 + 165, y + 6, `guiso (tienes ${e.almacen.platos})`, 6, C.tinta).setOrigin(0, 0.5);
      txt(x0 + 9, y + 15, 'Quien desayuna guiso gana el doble de experiencia y trabaja un 25 % más rápido ese día.', 5, C.maderaClara);
      y += 26;
    }
    // Mejora siguiente.
    rect(g, C.pergSombra, 1, x0 + 9, y - 3, CASA_W - 18, 1);
    if (m) {
      txt(x0 + 9, y + 3, `Mejora: ${m.nombre}`, 6, C.tinta, { fontStyle: 'bold' });
      let cx = x0 + 70;
      for (const [r, n] of Object.entries(m.coste) as [Recurso, number][]) {
        ico(cx + 4, y + 7, ICONO_RECURSO[r], 9);
        txt(cx + 10, y + 7, String(n), 6, sim.disponible(r) >= n ? C.tinta : C.falta, { fontStyle: 'bold' }).setOrigin(0, 0.5);
        cx += 26;
      }
      ico(cx + 4, y + 7, 'ui_moneda', 0);
      txt(cx + 10, y + 7, String(m.pokecoins), 6, e.dinero >= m.pokecoins ? C.tinta : C.falta, { fontStyle: 'bold' }).setOrigin(0, 0.5);
      const ok = !sim.falta(m.coste) && e.dinero >= m.pokecoins;
      boton(x0 + CASA_W - 59, y, 50, 'Mejorar', ok, () => w.mejorarCasa());
      txt(x0 + 9, y + 15, m.efecto, 5, C.maderaClara, { wordWrap: { width: (CASA_W - 18) * S } });
      y += 40;
    } else { txt(x0 + 9, y + 1, 'La casa está del todo mejorada.', 5, C.maderaClara); y += 8; }
    txt(x0 + CASA_W / 2, y0 + h - 6, 'F, Esc o andar: cerrar', 5, C.maderaClara).setOrigin(0.5);
  }

  // Panel VOLVERÁN: por cada visitante que se fue, su cara, lo que pide (en rojo si aún no lo tienes)
  // y un nido en rojo si no hay ninguno libre. Es la lista de "prepárate para cuando vuelva".
  private dibujarPendientes(y: number, libre: boolean): void {
    const sim = this.world.sim, ps = sim.estado.pendientes, g = this.pendG, o = this.pendObjs, FH = 22;
    o.forEach(x => x.destroy()); o.length = 0;
    g.clear();
    if (!ps.length) return;
    marco(g, 4, y, 76, 15 + ps.length * FH, PANEL);
    // Textos sin pasar por this.texto: se destruyen al redibujar y no deben quedar en this.textos.
    const txt = (x: number, ty: number, s: string, px: number, c: number, f = FUENTE_PX) =>
      this.add.text(x * S, ty * S, s, { fontFamily: f, fontSize: `${px * S}px`, color: HEX(c), fontStyle: f === FUENTE_PX ? 'bold' : '' }).setDepth(3);
    o.push(txt(9, y + 4, 'VOLVERÁN', 5, C.maderaClara, FUENTE_TIT));
    ps.forEach((p, i) => {
      const top = y + 13 + i * FH, cy = top + FH / 2, hay = sim.disponible(p.pide.r) >= p.pide.n;
      // Cara: primer fotograma de Idle mirando abajo, con los pies al fondo de su fila.
      if (this.textures.exists(`${p.especie}-Idle`)) o.push(this.add.image(16 * S, (top + FH - 1) * S, `${p.especie}-Idle`, 0).setOrigin(0.5, 0.72).setScale(S).setDepth(3));
      o.push(this.icono(33.5, cy, ICONO_RECURSO[p.pide.r], 10));
      o.push(txt(40, cy, String(p.pide.n), 7, hay ? C.tinta : C.falta).setOrigin(0, 0.5));
      if (!libre) {
        o.push(this.icono(58.5, cy, 'obj_nido', 11));
        o.push(txt(65, cy, '1', 7, C.falta).setOrigin(0, 0.5));
      }
    });
  }

  // Ficha del aldeano (GDD-pueblo §10): cara, nombre de su forma, nivel y experiencia; tipo, perfil y
  // grupo de experiencia; sus 5 stats de trabajo (la barra mide lo buena que es la stat para su nivel,
  // el número es su valor) y, al pie, lo que lleva por viaje, lo trabajado hoy y su próxima evolución.
  private crearFicha(): void {
    const x = VW - 4 - FICHA_W, y = FICHA_Y, o: Phaser.GameObjects.GameObject[] = [];
    this.fichaAnt = '-';
    this.fichaG = this.add.graphics().setDepth(1);
    this.fichaCara = this.add.image((x + 16) * S, (y + 22) * S, '__DEFAULT').setOrigin(0.5, 0.72).setDepth(3);
    this.fichaNombre = this.texto(x + 31, y + 7, '', 7, C.tinta, { fontStyle: 'bold' }).setOrigin(0, 0.5);
    this.fichaNivel = this.texto(x + FICHA_W - 6, y + 7, '', 6, C.maderaClara, { fontFamily: FUENTE_TIT }).setOrigin(1, 0.5);
    this.fichaSub = this.texto(x + 31, y + 14.5, '', 5, C.maderaClara).setOrigin(0, 0.5);
    STATS.forEach((k, i) => {
      const ry = y + 32 + i * 9;
      o.push(this.texto(x + 6, ry, NOMBRE_STAT[k], 6, C.tinta).setOrigin(0, 0.5));
      this.fichaVal[k] = this.texto(x + FICHA_W - 6, ry, '', 6, C.tinta, { fontStyle: 'bold' }).setOrigin(1, 0.5);
    });
    this.fichaPie = this.texto(x + 6, y + 77, '', 5, C.maderaClara, { lineSpacing: S });
    o.push(this.fichaG, this.fichaCara, this.fichaNombre, this.fichaNivel, this.fichaSub, this.fichaPie, ...Object.values(this.fichaVal));
    this.fichaObjs = o;
  }
  private dibujarFicha(): void {
    const a = this.world.inspeccion(), l = a && LINEAS[a.especie];
    if (!a || !l) {
      if (this.fichaAnt) { this.fichaAnt = ''; for (const x of this.fichaObjs) (x as unknown as Phaser.GameObjects.Components.Visible).setVisible(false); }
      return;
    }
    const f = forma(l, a.nivel), st = stats(l, a.nivel), e0 = expNivel(l.exp, a.nivel), e1 = expNivel(l.exp, a.nivel + 1);
    const kExp = a.nivel >= NIVEL_MAX ? 1 : Phaser.Math.Clamp((a.exp - e0) / (e1 - e0), 0, 1);
    const hoy = a.trabajado ?? 0, jor = jornada(a), cara = `${this.world.claveSpr(a)}-Idle`;
    const clave = `${a.uid}|${a.nivel}|${cara}|${Math.round(kExp * 60)}|${Math.round(hoy / 6)}`;
    if (clave === this.fichaAnt) return;
    this.fichaAnt = clave;
    for (const x of this.fichaObjs) (x as unknown as Phaser.GameObjects.Components.Visible).setVisible(true);
    const x = VW - 4 - FICHA_W, y = FICHA_Y, g = this.fichaG, horas = (m: number) => (m / 60).toFixed(1).replace('.', ',');
    g.clear();
    marco(g, x, y, FICHA_W, FICHA_H, PANEL);
    // Cara: primer fotograma de Idle, recortado a 26×24 alrededor del cuerpo para que no se salga del marco.
    if (this.textures.exists(cara)) {
      const fr = this.textures.getFrame(cara, 0), pie = Math.round(fr.height * 0.72), cy = Math.max(0, pie - 21);
      this.fichaCara.setTexture(cara, 0).setScale(S).setCrop(Math.max(0, Math.round(fr.width / 2 - 13)), cy, 26, Math.min(24, fr.height - cy));
    } else this.fichaCara.setVisible(false);
    this.fichaNombre.setText(f.nombre);
    this.fichaNivel.setText(`Nv ${a.nivel}`);
    this.fichaSub.setText(`${NOMBRE_TIPO[l.tipo]} · ${NOMBRE_PERFIL[perfil(l.id)]} · exp. ${NOMBRE_GRUPO[l.exp].toLowerCase()}`);
    // Experiencia hacia el nivel siguiente.
    rect(g, C.barraFondo, 1, x + 31, y + 20, FICHA_W - 37, 4);
    rect(g, C.elegido, 1, x + 32, y + 21, Math.round((FICHA_W - 39) * kExp), 2);
    rect(g, C.pergSombra, 1, x + 5, y + 26, FICHA_W - 10, 1);
    // Stats: barra = valor frente a una stat base de 150 a su nivel (llena = de las mejores).
    const ref = 150 * factorNivel(a.nivel);
    STATS.forEach((k, i) => {
      const ry = y + 32 + i * 9, w = 36, bx = x + 50;
      rect(g, C.pergSombra, 1, bx, ry - 2, w, 4);
      rect(g, C.hojaOsc, 1, bx, ry - 2, Math.max(1, Math.round(w * Math.min(1, st[k] / ref))), 4);
      rect(g, C.hoja, 1, bx, ry - 2, Math.max(1, Math.round(w * Math.min(1, st[k] / ref))), 2);
      this.fichaVal[k].setText(String(st[k]));
    });
    const sig = l.formas.find(q => q.nv > a.nivel);
    this.fichaPie.setText([
      a.pide ? 'De visita: aún no trabaja' : `Lleva ${capacidad(a)} · hoy ${horas(hoy)} de ${horas(jor)} h${hoy >= jor ? ' (cansado)' : ''}`,
      sig ? `Evoluciona a ${sig.nombre} en Nv ${sig.nv}` : f.id === l.formas[0].id ? 'No evoluciona' : 'Forma final',
    ].join('\n'));
  }

  aviso(txt: string): void {
    const t = this.avisoTxt.setText(txt), w = Math.ceil(t.width / S) + 14, h = Math.ceil(t.height / S) + 8;
    this.avisoG.clear();
    marco(this.avisoG, -Math.round(w / 2), -Math.round(h / 2), w, h, PANEL);
    this.aviso_.setAlpha(1);
    this.avisoTimer?.remove();
    this.tweens.killTweensOf(this.aviso_);
    this.avisoTimer = this.time.delayedCall(2600, () => this.tweens.add({ targets: this.aviso_, alpha: 0, duration: 500 }));
  }

  update(_t: number, dt: number): void {
    const sim = this.world.sim;
    if (!sim) return;
    const e = sim.estado;

    // Energía: barra hundida, verde y naranja por debajo del 30 %.
    const k = Phaser.Math.Clamp(e.energia / sim.energiaMax, 0, 1), g = this.energia, bw = Math.round(58 * k);
    const [c, cl, co] = k > 0.3 ? [C.hoja, C.hojaLuz, C.hojaOsc] : [C.aviso, C.avisoLuz, C.avisoOsc];
    g.clear();
    rect(g, C.barraFondo, 1, 19, 9, 60, 6);
    if (bw > 0) { rect(g, c, 1, 20, 10, bw, 4); rect(g, cl, 1, 20, 10, bw, 1); rect(g, co, 1, 20, 13, bw, 1); }

    // Almacén y aldeanos (el panel crece cuando hay aldeanos).
    for (const r of RECURSOS) this.recursos[r].setText(String(e.almacen[r]));
    const na = sim.vecinos.length, nidos = sim.plazas(); // el visitante que aún espera no cuenta
    const fila = !!(na || nidos);
    if (this.conAldeanos !== fila) {
      this.conAldeanos = fila;
      this.almacenG.clear();
      marco(this.almacenG, 4, 22, 76, fila ? ALM_H + 11 : ALM_H, PANEL);
      if (fila) rect(this.almacenG, C.pergSombra, 1, 9, 70 + MAS * 12, 66, 1);
      this.casa.setVisible(fila); this.aldeanos.setVisible(fila);
      this.objetivoAnt = '-';
    }
    this.aldeanos.setText(`Aldeanos: ${na} / ${nidos} camas`);
    // A la vista unos segundos tras cambiar lo guardado (o al entrar), junto a la mesa o en modo construcción.
    const claveAlm = RECURSOS.map(r => e.almacen[r]).join(',') + `|${na}|${nidos}`;
    if (claveAlm !== this.almClave) { this.almClave = claveAlm; this.almHasta = this.time.now + ALM_VISTA; }
    const verAlm = this.time.now < this.almHasta || this.world.obra !== null || this.world.cercaDelAlmacen();
    const almAntes = this.almA > 0;
    this.almA = Phaser.Math.Clamp(this.almA + (verAlm ? 1 : -1) * dt / ALM_FUNDIDO, 0, 1);
    for (const o of this.almObjs) o.setAlpha(this.almA);
    if (almAntes !== this.almA > 0) this.objetivoAnt = '-'; // el objetivo sube o baja

    // Objetivo (solo se redibuja al cambiar).
    const obj = this.world.objetivo();
    if (obj !== this.objetivoAnt) {
      this.objetivoAnt = obj;
      const y = this.almA > 0 ? 22 + (fila ? ALM_H + 11 : ALM_H) + 4 : 22, g4 = this.objetivoG; // escondido: bajo la energía
      g4.clear();
      this.objetivoTit.setVisible(!!obj).setY((y + 4) * S);
      this.objetivoTxt.setVisible(!!obj).setText(obj).setY((y + 11) * S);
      const h = Math.ceil(this.objetivoTxt.height / S) + 15;
      if (obj) marco(g4, 4, y, Math.max(76, Math.ceil(this.objetivoTxt.width / S) + 11), h, PANEL);
      this.objetivoFin = obj ? y + h + 4 : y;
    }
    // Pendientes (solo se redibujan al cambiar quién, lo que piden, lo que tienes o si hay nido libre).
    const libre = !!sim.nidoLibre();
    const pend = `${this.objetivoFin}|${libre}|` + e.pendientes.map(p => `${p.especie}:${p.pide.r}${p.pide.n}:${sim.disponible(p.pide.r) >= p.pide.n}`).join(',');
    if (pend !== this.pendAnt) { this.pendAnt = pend; this.dibujarPendientes(this.objetivoFin, libre); }
    this.dibujarBarraObra();
    this.dibujarFicha();

    // Reloj.
    this.dia.setText(`DÍA ${e.dia}`);
    this.hora.setText(sim.hora.padStart(5, '0'));
    this.tiempo.setTexture(e.lluvia ? 'ui_lluvia' : 'ui_sol');
    const xr = VW - 4 - 72, kd = Phaser.Math.Clamp((e.minuto - MIN_DIA) / (MIN_DESMAYO - MIN_DIA), 0, 1);
    this.progreso.clear();
    rect(this.progreso, C.pergSombra, 1, xr + 5, 31, 62, 2);
    rect(this.progreso, C.aviso, 1, xr + 5, 31, Math.round(62 * kd), 2);

    // Pokécoins: el contador sube poco a poco (y espera a que Pelipper se pose: monedasRetenidas).
    const meta = e.dinero - this.world.monedasRetenidas;
    if (this.monedas < 0 || meta < this.monedas) this.monedas = meta;
    else if (this.monedas < meta) this.monedas += Math.max(1, Math.ceil((meta - this.monedas) / 14));
    const din = this.monedas.toLocaleString('es-ES');
    const enCaja = sim.valorCaja;
    this.cajaHUD.setText(enCaja ? `en la caja: +${enCaja}` : '');
    this.dibujarPanelCaja();
    this.dibujarPanelCasa();
    if (din !== this.dineroAnt) {
      this.dineroAnt = din;
      this.dinero.setText(din);
      const w = 5 + 7 + 3 + Math.ceil(this.dinero.width / S) + 5, x = VW - 4 - w;
      this.dineroG.clear();
      marco(this.dineroG, x, 42, w, 13, PANEL);
      this.dinero.setX((VW - 9) * S);
      this.moneda.setX((x + 8.5) * S);
    }

    // Inventario: marcos (solo al cambiar la casilla elegida) e iconos.
    const sel = this.world.slot;
    if (sel !== this.slotAnt) {
      this.slotAnt = sel;
      const g2 = this.slotsG, n = this.slots.length, xb = Math.round((VW - (8 + n * SLOT + (n - 1) * HUECO)) / 2), yb = VH - 5 - 28;
      g2.clear();
      for (let i = 0; i < n; i++) {
        const on = i === sel;
        marco(g2, xb + 4 + i * (SLOT + HUECO), yb + 4, SLOT, SLOT,
          { borde: on ? C.elegido : C.maderaClara, fondo: on ? C.elegidoFondo : C.hueco, hundido: C.huecoSombra });
      }
    }
    e.inventario.forEach((s, i) => {
      const sl = this.slots[i];
      if (!sl) return;
      if (s && ITEMS[s.id] && this.textures.exists(ITEMS[s.id].icono)) {
        sl.icono.setTexture(ITEMS[s.id].icono).setVisible(true);
        const fr = sl.icono.frame;
        sl.icono.setScale(S * Math.min(1, 15 / Math.max(fr.width, fr.height)));
        sl.num.setText(s.n > 1 ? String(s.n) : '');
      } else { sl.icono.setVisible(false); sl.num.setText(''); }
    });

    // Etiqueta del objeto elegido.
    const it = e.inventario[sel], def = it ? ITEMS[it.id] : undefined;
    const clave = it ? `${it.id}` : '';
    if (clave !== this.nombreAnt) {
      this.nombreAnt = clave;
      const g3 = this.nombreG;
      g3.clear();
      const ver = !!it && this.world.obra === null;
      this.nombre.setVisible(ver); this.precio.setVisible(ver);
      if (it) {
        this.nombre.setText(`${def?.nombre ?? it.id} · `);
        this.precio.setText(`${def?.precio ?? 0}`);
        const wn = Math.ceil(this.nombre.width / S), wp = Math.ceil(this.precio.width / S), w = wn + wp + 19;
        const yb = VH - 5 - 28, x = Math.round((VW - w) / 2), y = yb - 15, cx = VW / 2;
        marco(g3, x, y, w, 10, { borde: C.tintaOsc, fondo: C.tinta });
        rect(g3, C.tintaOsc, 1, cx - 2, y + 10, 4, 1); rect(g3, C.tintaOsc, 1, cx - 1, y + 11, 2, 1);
        this.nombre.setPosition((x + 5) * S, (y + 5) * S);
        this.precio.setPosition((x + 5 + wn) * S, (y + 5) * S);
        this.precioMoneda.setPosition((x + 5 + wn + wp + 5.5) * S, (y + 5) * S);
      }
      this.precioMoneda.setVisible(ver);
    }

    // Atardecer a partir de las 18:00, noche desde las 21:00.
    // En el mapa dibujo la noche la pone la luz del valle (WorldScene.luzDelDia), con las farolas.
    this.noche.setAlpha(DIBUJO ? 0 : oscuridad(e.minuto) * 0.45);
  }
}
