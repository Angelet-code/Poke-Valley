// HUD del modo aventura (escena paralela a Aventura, sin zoom), con el estilo de UIScene (madera + pergamino):
// - Arriba a la izquierda, tu Pokémon (vida, nivel, experiencia, estado); arriba en el centro, el objetivo (con su
//   naturaleza y cómo reaccionará contigo, combate/naturalezas.ts); arriba a la derecha, el mapa y la hora.
// - Abajo, la barra de atajos (teclas 1-0): movimientos con el color de su tipo u objetos con su icono y cuántos
//   quedan; se oscurecen mientras se enfrían y el número se pone rojo si el objetivo está lejos. Al pasar el ratón,
//   la ficha del movimiento. Clic = usar; clic derecho = quitar de la barra.
// - K: panel de movimientos y objetos. Clic en uno y luego en una casilla (o su tecla) para colocarlo.
// - I: inventario, como la pantalla del personaje del WoW (a la izquierda, vertical): tu Pokémon animado en el centro
//   y sus HUECOS_OBJ objetos a los lados (clic = quitarlo); debajo, los equipables de la mochila (clic = ponérselo en
//   un hueco libre; con los dos llenos, clic luego en el hueco que cambias). Al pasar el ratón, la ficha del objeto.
//   Arriba, nombre, sexo, nivel y tipos; bajo el Pokémon, sus stats.
// - F en el tablón del pueblo: las misiones de cada zona, solo con iconos (cara, número, Ball u objeto). Clic en una
//   nueva = aceptarla; en una cumplida = entregarla. A la derecha, bajo la hora, el seguimiento (cara + "2/5").
// - F junto a Kecleon (el tendero del pueblo): la tienda, Poké Balls y pociones. Clic = comprar uno; Mayús+clic, cinco.
//   Arriba, tus Pokécoins (también en el inventario, I).
// - Comercio (T con otro jugador, combate/tradeo.ts): ventana en el centro con tres columnas, como la del WoW: tus cosas
//   (Pokémon que no manejas, objetos de la mochila y Pokécoins; clic = ponerlo en la oferta), lo que das (clic =
//   quitarlo) y lo que da el otro. Mayús+clic: cinco objetos o 100 Pokécoins. Debajo, Aceptar y Cancelar; cada oferta
//   se pone en verde cuando su dueño la acepta.
import Phaser from 'phaser';
import { S, VH, VW } from '../config';
import { C, FUENTE_PX, FUENTE_TIT, HEX, PANEL, marco, rect, type G } from './UIScene';
import { COLOR_REACCION, NOMBRE_REACCION } from '../combate/naturalezas';
import { NOMBRE_TIENDA, VENTA, type Aura, type Aventura, type Luchador } from './Aventura';
import { COLOR_TIPO, TIPO_ES, getMove, type Stat6, type TypeName } from '../data/movimientos';
import { ITEMS } from '../data/items';
import { EQUIPABLES } from '../combate/objetos';
import { EVO_OBJETO, LINEAS } from '../data/pokedex';
import { GCD, NOMBRE_CLIMA, NOMBRE_ESTADO, alcance, descEfecto, expDeNivel, formaDe, necesitaObjetivo, perfil } from '../combate/reglas';
import { CASILLAS, HOGAR_CARGA, HOGAR_CD, HUECOS_OBJ, type Atajo } from '../combate/partida';
import { ancla, clave, listo, poner } from '../combate/sprites';
import { NOMBRE_ZONA, ZONAS_MISION, type Mision } from '../combate/misiones';
import { redDeLaPagina } from '../combate/red';
import { TRATO_OBJS, TRATO_POKES } from '../combate/tradeo';
import { idSprite } from '../combate/sprites';
import type { Miembro } from '../combate/partida';

const CW = 32, CH = 22, HUECO = 2;                       // casilla de la barra (px de juego)
const BW = 8 + CASILLAS * CW + (CASILLAS - 1) * HUECO, BX = Math.round((VW - BW) / 2), BY = VH - 5 - (CH + 8);
// Piedra de hogar: casilla aparte a la izquierda de la barra (tecla H; icono pixel art de tools/icono_hogar.py) y barra de lanzamiento encima de la barra.
const HW = CH + 8, HX = BX - 4 - HW, CAST_W = 120, CAST_Y = BY - 16;
const CATEGORIA: Record<string, string> = { Physical: 'Físico', Special: 'Especial', Status: 'Estado' };
// Iconos de misión (pixel art 1:1, '.' = transparente): espadas = derrotar, corona = alfa, visto = entregada.
const PIX_COL: Record<string, number> = { c: 0x7d8a99, k: 0x8b5a33, y: 0xf2c94c, r: 0xd0402a, g: 0x4f9a3a };
const PIX: Record<string, string[]> = {
  espadas: ['c.....c', '.c...c.', '..c.c..', '...c...', '..c.c..', 'kk...kk', 'k.....k'],
  corona: ['y..y..y', 'yy.y.yy', 'yyyyyyy', 'yryyyry', 'yyyyyyy'],
  visto: ['.....g', '....gg', 'g..gg.', 'gggg..', '.gg...'],
};
// Pokécoin (la misma moneda que el HUD de la granja, UIScene).
const MONEDA = ['..kkk..', '.kyyyk.', 'kyhkyyk', 'kyykyyk', 'kyykyyk', '.kyyyk.', '..kkk..'];
const COL_MONEDA = { k: 0xc28a2c, y: 0xf2c94c, h: 0xfff2b0 };
// Lo que dice la tienda de cada cosa.
const DESC_VENTA: Record<string, string> = { pokeball: 'Para capturar salvajes', superball: 'Captura mejor que la Poké Ball', pocion: 'Cura 20 PS', superpocion: 'Cura 60 PS' };
const pix = (g: G, x: number, y: number, id: string) => PIX[id].forEach((f, j) => [...f].forEach((ch, i) => { if (ch !== '.') rect(g, PIX_COL[ch], 1, x + i, y + j, 1, 1); }));
// Marco del alfa (como el de élite del WoW): el sprite pixel art de Aerodactyl (PMD) entero de color tierra
// (assets/game/pixel/ui/aerodactyl_alfa.png, de assets/gen/pixel/ui_dragon/tierra.py), en la esquinita de arriba a la
// izquierda del retrato. Más pequeño que el resto del HUD: escala S − 1 (píxeles de pantalla enteros); reducido a menos
// píxeles perdía la forma. La esquina que forman su mandíbula y su cuerpo (el píxel ADORNO_CX, ADORNO_CY del sprite,
// el primero libre bajo la cabeza y a la derecha del cuerpo) cae en la esquina del hueco del retrato (x + 3, y + 3). Para
// que el ala no se salga de la pantalla por arriba, el marco de un alfa baja ALFA_DY.
const ADORNO_CX = 16, ADORNO_CY = 23, ADORNO_W = 32, ADORNO_H = 30, ADORNO_ESCALA = Math.max(1, S - 1);
const ALFA_DY = Math.max(0, Math.ceil(ADORNO_CY * ADORNO_ESCALA / S) - 5);
// Sexo junto al nombre (pixel art): ♂ azul, ♀ rosa.
const SEXO: Record<'m' | 'f', { col: number; filas: string[] }> = {
  m: { col: 0x3f7fd8, filas: ['...xxx', '....xx', '.xxx.x', 'x...x.', 'x...x.', 'x...x.', '.xxx..'] },
  f: { col: 0xe0508a, filas: ['.xxx.', 'x...x', 'x...x', 'x...x', '.xxx.', '..x..', 'xxxxx', '..x..'] },
};
const MW = 84, MH = 46;                                    // carta de misión (px de juego)
const oscurecer = (c: number, k: number) => (Math.round(((c >> 16) & 255) * k) << 16) | (Math.round(((c >> 8) & 255) * k) << 8) | Math.round((c & 255) * k);

interface Marco {
  dy: number;                         // lo que está bajado el marco (el de un alfa, ALFA_DY)
  g: G; cara: Phaser.GameObjects.Image; dragon: Phaser.GameObjects.Image; sexo: Phaser.GameObjects.Image; nombre: Phaser.GameObjects.Text; nivel: Phaser.GameObjects.Text; ps: Phaser.GameObjects.Text; sub: Phaser.GameObjects.Text; clave: string;
  chips: Phaser.GameObjects.Text[];   // bufos y debufos bajo el marco
  zonas: { x: number; y: number; w: number; h: number; a: Aura }[];
}
const CHIP_W = 20, CHIP_H = 9, CHIPS = 6;
// Lo que hace cada estado (ficha al pasar el ratón por su icono).
const DESC_ESTADO: Record<string, string> = {
  QUE: 'Hace la mitad de daño físico y pierde 1/16 de su vida cada 3 s',
  PAR: 'Se mueve a la mitad de velocidad y a veces no puede atacar',
  ENV: 'Pierde 1/8 de su vida cada 3 s',
  'TÓX': 'Pierde vida cada 3 s, cada vez más',
  DOR: 'No puede moverse ni atacar',
  CON: 'No puede moverse ni atacar. Un ataque de Fuego lo descongela',
  BAN: 'Ya te ha salvado: vuelve a servir cuando se vacíe la barra',
};

export class HudAventura extends Phaser.Scene {
  private av!: Aventura;
  private yo!: Marco;
  private obj!: Marco;
  private reloj!: Phaser.GameObjects.Text;
  private relojG!: G;
  private climaG!: G;
  private climaTxt!: Phaser.GameObjects.Text;
  private barraG!: G;
  private casillas: { txt: Phaser.GameObjects.Text; icono: Phaser.GameObjects.Image; num: Phaser.GameObjects.Text; tecla: Phaser.GameObjects.Text; clave: string }[] = [];
  private hogarG!: G;
  private hogarCd!: Phaser.GameObjects.Text;
  private castG!: G;
  private castTxt!: Phaser.GameObjects.Text;
  private objCastTxt!: Phaser.GameObjects.Text;
  private fichaG!: G;
  private fichaTapada = false;           // la ficha la está usando la piedra de hogar
  private ficha!: Phaser.GameObjects.Text;
  private fichaTipo!: Phaser.GameObjects.Text;   // tipo del movimiento, en su color, junto al nombre
  private panelObjs: Phaser.GameObjects.GameObject[] = [];
  private panelClave = '';
  private panelZonas: { x: number; y: number; w: number; h: number; a: { m: string } | { i: string } }[] = [];
  // Inventario (I): se rehace cuando cambia algo.
  private invObjs: Phaser.GameObjects.GameObject[] = [];
  private invClave = '';
  private invZonas: { x: number; y: number; w: number; h: number; id: string | null; hueco?: number }[] = [];   // con hueco: lo que lleva puesto
  private invElegido: string | null = null;   // equipable elegido con los dos huecos llenos: espera a que elijas hueco
  private invCaja: { x: number; y: number; w: number; h: number } | null = null;
  private avisoC!: Phaser.GameObjects.Container;
  private avisoG!: G;
  private avisoTxt!: Phaser.GameObjects.Text;
  private avisoTimer?: Phaser.Time.TimerEvent;
  private zonaTit!: Phaser.GameObjects.Text;
  private zonaLema!: Phaser.GameObjects.Text;
  // Tablón de misiones y seguimiento (se rehacen cuando cambia algo).
  private misObjs: Phaser.GameObjects.GameObject[] = [];
  private misClave = '';
  private misZonas: { x: number; y: number; w: number; h: number; m: Mision }[] = [];
  private misCaja: { x: number; y: number; w: number; h: number } | null = null;
  private segObjs: Phaser.GameObjects.GameObject[] = [];
  private segClave = '';
  // Tienda (F junto a Kecleon).
  private tiObjs: Phaser.GameObjects.GameObject[] = [];
  private tiClave = '';
  private tiZonas: { x: number; y: number; w: number; h: number; id: string }[] = [];
  private tiCaja: { x: number; y: number; w: number; h: number } | null = null;
  private trObjs: Phaser.GameObjects.GameObject[] = [];
  private trClave = '';
  private trZonas: { x: number; y: number; w: number; h: number; clic?: (mayus: boolean) => void; ficha?: string }[] = [];
  private trCaja: { x: number; y: number; w: number; h: number } | null = null;

  constructor() { super('hud'); }

  private texto(x: number, y: number, txt: string, px: number, color: number, o: Phaser.Types.GameObjects.Text.TextStyle = {}): Phaser.GameObjects.Text {
    return this.add.text(x * S, y * S, txt, { fontFamily: FUENTE_PX, fontSize: `${px * S}px`, color: HEX(color), ...o }).setDepth(3);
  }
  private sombreado(x: number, y: number, txt: string, px: number, color = 0xfff6dc): Phaser.GameObjects.Text {
    return this.texto(x, y, txt, px, color, { stroke: HEX(C.tintaOsc), strokeThickness: 2 * S });
  }

  create(): void {
    this.av = this.scene.get('aventura') as Aventura;
    this.casillas = []; this.panelObjs = []; this.panelClave = ''; this.panelZonas = [];
    this.invObjs = []; this.invClave = ''; this.invZonas = []; this.invCaja = null; this.invElegido = null;
    this.misObjs = []; this.misClave = ''; this.misZonas = []; this.misCaja = null; this.segObjs = []; this.segClave = '';
    this.tiObjs = []; this.tiClave = ''; this.tiZonas = []; this.tiCaja = null;
    this.trObjs = []; this.trClave = ''; this.trZonas = []; this.trCaja = null;
    this.yo = this.crearMarco(4, 4);
    this.obj = this.crearMarco(Math.round(VW / 2 - 64), 4);

    // Mapa y hora (arriba a la derecha).
    this.relojG = this.add.graphics().setDepth(1);
    marco(this.relojG, VW - 4 - 74, 4, 74, 22, PANEL);
    this.reloj = this.texto(VW - 4 - 37, 15, '', 7, C.tinta, { align: 'center' }).setOrigin(0.5);
    this.climaG = this.add.graphics().setDepth(1);
    this.climaTxt = this.texto(VW - 4 - 37, 34.5, '', 5.5, C.tinta).setOrigin(0.5);

    // Barra de atajos.
    marco(this.add.graphics().setDepth(1), BX, BY, BW, CH + 8, { borde: C.madera, fondo: C.bandeja, luz: C.bandejaLuz, osc: C.bandejaSombra, sombra: true });
    this.barraG = this.add.graphics().setDepth(2);
    for (let i = 0; i < CASILLAS; i++) {
      const x = BX + 4 + i * (CW + HUECO), y = BY + 4;
      this.casillas.push({
        txt: this.texto(x + CW / 2, y + CH / 2 + 1, '', 4.5, 0xfff6dc, { align: 'center', wordWrap: { width: (CW - 2) * S }, stroke: HEX(C.tintaOsc), strokeThickness: 1.5 * S, lineSpacing: -1.5 * S }).setOrigin(0.5),
        icono: this.add.image((x + CW / 2) * S, (y + CH / 2) * S, '__DEFAULT').setVisible(false).setDepth(3),
        num: this.sombreado(x + CW - 1.5, y + CH + 0.5, '', 5).setOrigin(1, 1),
        tecla: this.sombreado(x + 1.5, y + 0.5, String((i + 1) % 10), 4.5).setOrigin(0, 0),
        clave: '',
      });
    }
    // Piedra de hogar: su casilla (piedra blanca con runa azul) y la barra de lanzamiento.
    marco(this.add.graphics().setDepth(1), HX, BY, HW, HW, { borde: C.madera, fondo: C.bandeja, luz: C.bandejaLuz, osc: C.bandejaSombra, sombra: true });
    this.add.graphics().setDepth(2).fillStyle(0x2c5a7a, 1).fillRect((HX + 4) * S, (BY + 4) * S, (HW - 8) * S, (HW - 8) * S);
    if (this.textures.exists('icono_hogar')) this.add.image((HX + HW / 2) * S, (BY + HW / 2) * S, 'icono_hogar').setDepth(2).setScale(S);
    this.hogarG = this.add.graphics().setDepth(2);
    this.sombreado(HX + 5.5, BY + 4.5, 'H', 4.5).setOrigin(0, 0);
    this.hogarCd = this.sombreado(HX + HW / 2, BY + HW / 2, '', 5.5).setOrigin(0.5).setDepth(4);
    this.castG = this.add.graphics().setDepth(4);
    this.castTxt = this.sombreado(VW / 2, CAST_Y + 4.5, 'Piedra de hogar', 5).setOrigin(0.5).setDepth(5).setVisible(false);
    this.objCastTxt = this.sombreado(VW / 2, 0, '', 4.5).setOrigin(0.5).setDepth(5).setVisible(false);
    // Ficha del movimiento bajo el ratón.
    this.fichaG = this.add.graphics().setDepth(9);
    this.ficha = this.texto(0, 0, '', 6, C.tinta, { wordWrap: { width: 120 * S }, lineSpacing: 1 * S }).setDepth(10).setVisible(false);
    this.fichaTipo = this.texto(0, 0, '', 5, 0xffffff, { stroke: '#3a2a1a', strokeThickness: 1 * S }).setDepth(10).setVisible(false);
    // Teclas de ayuda.
    const ayuda = ['Tab objetivo', 'K movimientos', 'I inventario', 'F cambiar', 'H piedra de hogar', 'M mapa', ...(redDeLaPagina() ? ['R retar a duelo', 'T comerciar'] : [])];
    ayuda.forEach((t, i) => this.sombreado(VW - 5, VH - 5 - (ayuda.length - 1 - i) * 8, t, 5).setOrigin(1, 1).setAlpha(0.85));

    // Avisos.
    this.avisoG = this.add.graphics();
    this.avisoTxt = this.texto(0, 0, '', 7, C.tinta, { align: 'center', wordWrap: { width: 300 * S } }).setOrigin(0.5);
    this.avisoC = this.add.container(VW * S / 2, (VH - 60) * S, [this.avisoG, this.avisoTxt]).setDepth(8).setAlpha(0);
    this.av.events.on('aviso', this.aviso, this);
    // Rótulo de la zona al entrar (como en el WoW): nombre grande y, debajo, nivel y tipos.
    this.zonaTit = this.sombreado(VW / 2, 50, '', 13, 0xffe6a0).setFontFamily(FUENTE_TIT).setOrigin(0.5).setDepth(8).setAlpha(0);
    this.zonaLema = this.sombreado(VW / 2, 63, '', 6).setOrigin(0.5).setDepth(8).setAlpha(0);
    this.av.events.on('zona', this.zona, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => { this.av.events.off('aviso', this.aviso, this); this.av.events.off('zona', this.zona, this); });

    // Clics en la barra y en el panel.
    this.input.mouse!.disableContextMenu();
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (this.av.verMapa) return;
      const x = p.x / S, y = p.y / S;
      const trz = this.trZonas.find(q => q.clic && x >= q.x && x < q.x + q.w && y >= q.y && y < q.y + q.h);
      if (trz) { trz.clic!(!!(p.event as MouseEvent | undefined)?.shiftKey); return; }
      if (this.trCaja && x >= this.trCaja.x && x < this.trCaja.x + this.trCaja.w && y >= this.trCaja.y && y < this.trCaja.y + this.trCaja.h) return;
      const z = this.panelZonas.find(q => x >= q.x && x < q.x + q.w && y >= q.y && y < q.y + q.h);
      if (z) { this.av.asignando = z.a; return; }
      const iz = this.invZonas.find(q => x >= q.x && x < q.x + q.w && y >= q.y && y < q.y + q.h);
      if (iz) { this.clicInventario(iz); return; }
      const mz = this.misZonas.find(q => x >= q.x && x < q.x + q.w && y >= q.y && y < q.y + q.h);
      const tz = this.av.panel === 'tienda' ? this.tiZonas.find(q => x >= q.x && x < q.x + q.w && y >= q.y && y < q.y + q.h) : undefined;
      if (tz) { this.av.comprar(tz.id, (p.event as MouseEvent | undefined)?.shiftKey ? 5 : 1); return; }
      if (mz) {
        const st = this.av.partida.estadoMision(mz.m);
        if (st === 'nueva') this.av.aceptarMision(mz.m); else if (st === 'lista') this.av.entregarMision(mz.m);
        return;
      }
      if (x >= HX && x < HX + HW && y >= BY && y < BY + HW) { this.av.usarHogar(); return; }
      const i = this.casillaEn(x, y);
      if (i < 0) return;
      if (p.rightButtonDown()) { const m = this.av.partida.activo; m.barra[i] = null; this.av.guardar(); return; }
      this.av.casilla(i);
    });
  }
  // Para la escena del mundo: ¿este clic (px de pantalla) es del HUD?
  tapaClic(px: number, py: number): boolean {
    const x = px / S, y = py / S;
    const c = this.misCaja;
    const tc = this.trCaja;
    if (tc && x >= tc.x && x < tc.x + tc.w && y >= tc.y && y < tc.y + tc.h) return true;
    return this.av.verMapa || (x >= HX && x < BX + BW && y >= BY && y < BY + CH + 8) || (this.av.panel === 'movs' && this.panelZonas.length > 0 && x > VW / 2 - 130 && x < VW / 2 + 130 && y > 30 && y < BY - 4)
      || (this.av.panel === 'misiones' && !!c && x >= c.x && x < c.x + c.w && y >= c.y && y < c.y + c.h)
      || (this.av.panel === 'tienda' && !!this.tiCaja && x >= this.tiCaja.x && x < this.tiCaja.x + this.tiCaja.w && y >= this.tiCaja.y && y < this.tiCaja.y + this.tiCaja.h)
      || (this.av.panel === 'inv' && !!this.invCaja && x >= this.invCaja.x && x < this.invCaja.x + this.invCaja.w && y >= this.invCaja.y && y < this.invCaja.y + this.invCaja.h);
  }
  private casillaEn(x: number, y: number): number {
    if (y < BY + 4 || y > BY + 4 + CH) return -1;
    const i = Math.floor((x - BX - 4) / (CW + HUECO));
    return i >= 0 && i < CASILLAS && x - BX - 4 - i * (CW + HUECO) < CW ? i : -1;
  }

  private crearMarco(x: number, y: number): Marco {
    const g = this.add.graphics().setDepth(1);
    return {
      dy: 0, g, cara: this.add.image((x + 13) * S, (y + 14) * S, '__DEFAULT').setDepth(2).setVisible(false),
      dragon: this.add.image((x + 3) * S, (y + 3) * S, this.textures.exists('marco_alfa') ? 'marco_alfa' : '__DEFAULT')
        .setOrigin(ADORNO_CX / ADORNO_W, ADORNO_CY / ADORNO_H).setScale(ADORNO_ESCALA).setDepth(2.5).setVisible(false),
      sexo: this.add.image(0, (y + 5) * S, this.pixeles('hud_sexo_m', SEXO.m.filas, { x: SEXO.m.col })).setOrigin(0).setDepth(3).setVisible(false),
      nombre: this.texto(x + 26, y + 4, '', 7, C.tinta, { fontStyle: 'bold' }),
      nivel: this.texto(x + 124, y + 4.5, '', 6, C.maderaClara).setOrigin(1, 0),
      ps: this.texto(x + 124, y + 13.5, '', 5, C.tinta).setOrigin(1, 0),
      sub: this.texto(x + 26, y + 21, '', 5, C.maderaClara),
      clave: '',
      chips: Array.from({ length: CHIPS }, (_, i) => this.texto(x + 2 + i * (CHIP_W + 2) + CHIP_W / 2, y + 32 + CHIP_H / 2, '', 4.5, 0xffffff,
        { fontStyle: 'bold', stroke: HEX(C.tintaOsc), strokeThickness: 1.5 * S }).setOrigin(0.5).setDepth(3)),
      zonas: [],
    };
  }
  // Textura pixel art (1 carácter = 1 px de juego, S px de pantalla) a partir de filas de caracteres; se crea una vez.
  private pixeles(key: string, filas: string[], col: Record<string, number>): string {
    if (this.textures.exists(key)) return key;
    const w = Math.max(...filas.map(f => f.length)), t = this.textures.createCanvas(key, w * S, filas.length * S)!, cx = t.getContext();
    filas.forEach((f, j) => [...f].forEach((ch, i) => { if (col[ch] === undefined) return; cx.fillStyle = HEX(col[ch]); cx.fillRect(i * S, j * S, S, S); }));
    t.refresh();
    return key;
  }
  // Marco de un luchador: cara (primer fotograma de su Idle de frente), nombre, nivel, vida y una línea de abajo.
  private pintarMarco(mc: Marco, x: number, y: number, l: Luchador | null, sub: string, colorSub: number, exp?: number): void {
    const g = mc.g, dy = l?.alfa ? ALFA_DY : 0;
    // El de un alfa baja (sitio para Aerodactyl): se mueve todo lo que se creó con el marco.
    if (dy !== mc.dy) {
      for (const o of [mc.cara, mc.dragon, mc.sexo, mc.nombre, mc.nivel, mc.ps, ...mc.chips]) o.y += (dy - mc.dy) * S;
      mc.dy = dy;
    }
    y += dy;
    g.clear();
    const vis = !!l;
    [mc.cara, mc.nombre, mc.nivel, mc.ps, mc.sub].forEach(o => o.setVisible(vis));
    mc.dragon.setVisible(!!l?.alfa);
    mc.sexo.setVisible(!!l?.sexo);
    const auras = l ? this.av.auras(l).slice(0, CHIPS) : [];
    mc.zonas = [];
    mc.chips.forEach((c, i) => c.setVisible(i < auras.length).setText(auras[i]?.txt ?? ''));
    if (!l) return;
    // Bufos y debufos (como en un MMO): su color, su abreviatura y una barra que se vacía con lo que les queda.
    auras.forEach((a, i) => {
      const cx = x + 2 + i * (CHIP_W + 2), cy = y + 32;
      rect(g, C.tintaOsc, 1, cx - 1, cy - 1, CHIP_W + 2, CHIP_H + 2);
      rect(g, a.color, 1, cx, cy, CHIP_W, CHIP_H);
      rect(g, 0xffffff, 0.25, cx, cy, CHIP_W, 1);
      rect(g, 0x000000, 0.4, cx, cy + CHIP_H - 2, CHIP_W, 2);
      rect(g, 0xfff6dc, 0.9, cx, cy + CHIP_H - 2, Math.round(CHIP_W * a.frac), 2);
      mc.zonas.push({ x: cx, y: cy, w: CHIP_W, h: CHIP_H, a });
    });
    // El alfa, con marco dorado (y Aerodactyl encima, `mc.dragon`).
    if (l.alfa) { marco(g, x, y, 128, 30, { ...PANEL, borde: 0xc8962a, luz: 0xfff3c4 }); rect(g, 0xc8962a, 1, x + 2, y + 2, 23, 26); }
    else marco(g, x, y, 128, 30, PANEL);
    rect(g, C.bandeja, 1, x + 3, y + 3, 21, 24);
    const k = `${clave(l.dex)}-${l.dex}`;
    if (mc.clave !== k) {
      mc.clave = k;
      const tex = this.textures.exists(`${clave(l.dex)}-Idle`) ? `${clave(l.dex)}-Idle` : '__DEFAULT';
      mc.cara.setTexture(tex, 0);
      const fr = mc.cara.frame, s = Math.min(1, 22 / Math.max(fr.width, fr.height));
      mc.cara.setScale(S * Math.max(0.5, s));
    }
    mc.nombre.setText(l.nombre);
    if (l.sexo) mc.sexo.setTexture(this.pixeles(`hud_sexo_${l.sexo}`, SEXO[l.sexo].filas, { x: SEXO[l.sexo].col })).setX(mc.nombre.x + mc.nombre.width + 2 * S);
    mc.nivel.setText(`Nv ${l.nivel}`);
    // Vida.
    const f = Math.max(0, l.ps / l.stats.hp), bw = 64, bx = x + 26, by = y + 14;
    rect(g, C.tintaOsc, 1, bx - 1, by - 1, bw + 2, 6);
    rect(g, 0x5b3a22, 1, bx, by, bw, 4);
    rect(g, f > 0.5 ? C.hoja : f > 0.2 ? 0xffd65a : 0xe05a4a, 1, bx, by, Math.round(bw * f), 4);
    rect(g, 0xffffff, 0.35, bx, by, Math.round(bw * f), 1);
    mc.ps.setText(`${Math.ceil(l.ps)}/${l.stats.hp}`);
    // Experiencia (solo el tuyo).
    if (exp !== undefined) { rect(g, 0x5b3a22, 1, bx, by + 6, bw, 1.5); rect(g, 0x6aa8e8, 1, bx, by + 6, Math.round(bw * exp), 1.5); }
    mc.sub.setText(sub).setColor(HEX(colorSub)).setY((y + 21.5) * S);
  }

  private textoAtajo(a: Atajo): string {
    if (!a) return '';
    if ('m' in a) return getMove(a.m)?.nombre ?? a.m;
    return '';
  }

  update(): void {
    const av = this.av;
    // Mientras se prepara un mapa no se enseña nada.
    this.cameras.main.setAlpha(av.listo && av.jugador ? 1 : 0);
    if (!av.listo || !av.jugador) return;
    const p = av.jugador, m = av.partida.activo;
    // Tú.
    const e0 = expDeNivel(m.linea, m.nivel), e1 = expDeNivel(m.linea, Math.min(100, m.nivel + 1));
    const tipos = p.tipos.map(t => TIPO_ES[t]).join(' · ');
    this.pintarMarco(this.yo, 4, 4, p, p.estado ? NOMBRE_ESTADO[p.estado] : tipos, p.estado ? 0xb03a2e : C.maderaClara, m.nivel >= 100 ? 1 : (m.exp - e0) / Math.max(1, e1 - e0));
    // Objetivo.
    const o = av.objetivo;
    const sub = !o ? '' : o.rol === 'vecino' ? 'De tu equipo · F para ser él' : o.rol === 'remoto' ? `${av.mundo!.luchandoCon(o) ? 'En duelo' : av.mundo!.duelo?.con === o.uid ? (av.mundo!.duelo.fase === 'reto' ? 'Retado' : 'Duelo en…') : 'Otro jugador'}${o.estado ? ` · ${NOMBRE_ESTADO[o.estado]}` : ''}` : o.estado ? NOMBRE_ESTADO[o.estado] : o.modo === 'pelear' ? (o.rival?.rol === 'remoto' ? `Ataca a ${o.rival.nombre}` : '¡Te ataca!') : `${o.tabla.nombre} · ${NOMBRE_REACCION[av.mundo!.reaccionA(o)]}`;
    this.pintarMarco(this.obj, Math.round(VW / 2 - 64), 4, o, sub, !o ? 0 : av.mundo!.luchandoCon(o) ? 0xb03a2e : o.rol === 'vecino' || o.rol === 'remoto' ? 0x3f6ea8 : o.modo === 'pelear' ? 0xb03a2e : oscurecer(COLOR_REACCION[av.mundo!.reaccionA(o)], 0.6));
    // Reloj.
    const min = Math.floor(av.partida.estado.minuto) % (24 * 60), h = Math.floor(min / 60), mm = Math.floor(min % 60 / 10) * 10;
    this.reloj.setText(`${av.mapa.nombre}\n${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}`).setLineSpacing(-1 * S);
    // Clima activo (Danza Lluvia, Día Soleado…), con lo que le queda; el de la zona, solo el nombre.
    const cl = av.clima, tq = cl ? Math.max(0, Math.ceil(cl.hasta - av.ahora)) : 0;
    this.climaG.clear();
    this.climaTxt.setVisible(!!cl);
    if (cl) {
      marco(this.climaG, VW - 4 - 74, 28, 74, 13, PANEL);
      this.climaTxt.setText(cl.base ? NOMBRE_CLIMA[cl.tipo] : `${NOMBRE_CLIMA[cl.tipo]} · ${tq} s`);
    }

    // Barra.
    const g = this.barraG;
    g.clear();
    const ptr = this.input.activePointer, sobre = this.casillaEn(ptr.x / S, ptr.y / S);
    for (let i = 0; i < CASILLAS; i++) {
      const a = m.barra[i], c = this.casillas[i], x = BX + 4 + i * (CW + HUECO), y = BY + 4;
      const mv = a && 'm' in a ? getMove(a.m) : null, it = a && 'i' in a ? ITEMS[a.i] : null;
      const color = mv ? COLOR_TIPO[mv.type] : 0;
      rect(g, C.huecoSombra, 1, x, y, CW, CH);
      rect(g, mv ? oscurecer(color, 0.75) : C.hueco, 1, x, y + 1, CW, CH - 1);
      if (mv) { rect(g, color, 1, x + 1, y + 1, CW - 2, CH - 3); rect(g, 0xffffff, 0.3, x + 1, y + 1, CW - 2, 1); }
      const k = JSON.stringify(a) + (it ? av.partida.tiene((a as { i: string }).i) : '');
      if (c.clave !== k) {
        c.clave = k;
        c.txt.setText(this.textoAtajo(a));
        if (it && this.textures.exists(it.icono)) {
          c.icono.setTexture(it.icono).setVisible(true);
          const fr = c.icono.frame; c.icono.setScale(S * Math.min(1, 16 / Math.max(fr.width, fr.height)));
        } else c.icono.setVisible(false);
        c.num.setText(it ? String(av.partida.tiene((a as { i: string }).i)) : '');
      }
      // Enfriamiento: una persiana oscura que baja; sin cosas (0 Balls), apagada.
      const fr = a ? av.enfriando(a) : 0;
      if (fr > 0) rect(g, 0x1a1008, 0.55, x, y + CH * (1 - fr), CW, CH * fr);
      if (it && !av.partida.tiene((a as { i: string }).i)) rect(g, 0x1a1008, 0.45, x, y, CW, CH);
      // Número en rojo si el objetivo está lejos para ese movimiento.
      const lejos = !!(mv && necesitaObjetivo(mv) && av.objetivo && Math.hypot(av.objetivo.x - p.x, av.objetivo.y - p.y) > alcance(mv) + Math.max(8, av.objetivo.alto * 0.3));
      c.tecla.setColor(lejos ? '#ff8a7a' : '#fff6dc');
      if (av.asignando) rect(g, C.elegido, 0.35 + 0.2 * Math.sin(this.time.now / 150), x, y, CW, CH);
      if (i === sobre) { rect(g, C.elegido, 1, x - 1, y - 1, CW + 2, 1); rect(g, C.elegido, 1, x - 1, y + CH, CW + 2, 1); rect(g, C.elegido, 1, x - 1, y, 1, CH); rect(g, C.elegido, 1, x + CW, y, 1, CH); }
    }
    this.pintarHogar(ptr.x / S, ptr.y / S);
    const px = ptr.x / S, py = ptr.y / S, chip = [...this.yo.zonas, ...this.obj.zonas].find(z => px >= z.x && px < z.x + z.w && py >= z.y && py < z.y + z.h);
    const carta = av.panel === 'movs' ? this.panelZonas.find(z => px >= z.x && px < z.x + z.w && py >= z.y && py < z.y + z.h) : undefined;
    const inv = av.panel === 'inv' ? this.invZonas.find(z => px >= z.x && px < z.x + z.w && py >= z.y && py < z.y + z.h) : undefined;
    const trz = this.trZonas.find(z => z.ficha && px >= z.x && px < z.x + z.w && py >= z.y && py < z.y + z.h);
    if (trz) this.fichaTrato(trz);
    else if (chip) this.fichaAura(chip);
    else if (carta) this.pintarFicha(carta.a, -1, carta);
    else if (inv) this.fichaInv(inv);
    else if (!this.fichaTapada) this.pintarFicha(sobre >= 0 ? m.barra[sobre] : null, sobre);
    this.pintarPanel();
    this.pintarInventario();
    this.pintarMisiones();
    this.pintarTienda();
    this.pintarTrato();
    this.pintarSeguimiento(cl ? 44 : 30);
  }

  // Cara de un Pokémon (primer fotograma de su Idle) que cabe en `tam` px, centrada en (x, y).
  private cara(x: number, y: number, dex: string, tam: number, objs: Phaser.GameObjects.GameObject[], depth: number): void {
    const tex = `${clave(dex)}-Idle`;
    if (!this.textures.exists(tex)) return;
    const im = this.add.image(x * S, y * S, tex, 0).setDepth(depth);
    im.setScale(S * Math.min(1, tam / Math.max(im.frame.width, im.frame.height)));
    objs.push(im);
  }
  private iconoItem(x: number, y: number, id: string, tam: number, objs: Phaser.GameObjects.GameObject[], depth: number): void {
    const ic = ITEMS[id]?.icono;
    if (!ic || !this.textures.exists(ic)) return;
    const im = this.add.image(x * S, y * S, ic).setDepth(depth);
    im.setScale(S * Math.min(1, tam / Math.max(im.frame.width, im.frame.height)));
    objs.push(im);
  }

  // Tablón (F junto a él en el pueblo): una fila por zona, una carta por misión, solo con iconos.
  private pintarMisiones(): void {
    const av = this.av, pa = av.partida, lista = pa.misiones;
    const k = av.panel === 'misiones' ? lista.map(m => `${m.id}:${pa.estadoMision(m)}:${pa.progresoMision(m)}`).join('|') : '';
    if (k === this.misClave) return;
    this.misClave = k;
    this.misObjs.forEach(o => o.destroy()); this.misObjs = []; this.misZonas = []; this.misCaja = null;
    if (av.panel !== 'misiones') return;
    const zonas = ZONAS_MISION.filter(z => lista.some(m => m.zona === z));
    const cols = Math.max(...zonas.map(z => lista.filter(m => m.zona === z).length));
    const w = 12 + cols * (MW + 4) - 4, h = 18 + zonas.length * (MH + 14) + 4, x = Math.round(VW / 2 - w / 2), y = 38;
    this.misCaja = { x, y, w, h };
    const g = this.add.graphics().setDepth(6);
    this.misObjs.push(g);
    marco(g, x, y, w, h, PANEL);
    const t = (tx: number, ty: number, s: string, px: number, c: number, o: Phaser.Types.GameObjects.Text.TextStyle = {}) => { const q = this.texto(tx, ty, s, px, c, o).setDepth(8); this.misObjs.push(q); return q; };
    t(x + 6, y + 5, 'MISIONES', 5, C.maderaClara, { fontFamily: FUENTE_TIT });
    t(x + w - 6, y + 5, 'Clic: aceptar · entregar', 5, C.maderaClara).setOrigin(1, 0);
    zonas.forEach((z, fila) => {
      const yz = y + 16 + fila * (MH + 14);
      t(x + 6, yz, NOMBRE_ZONA[z], 5.5, C.tinta, { fontStyle: 'bold' });
      lista.filter(m => m.zona === z).forEach((m, i) => this.cartaMision(g, x + 6 + i * (MW + 4), yz + 10, m, t));
    });
  }
  private cartaMision(g: G, x: number, y: number, m: Mision, t: (x: number, y: number, s: string, px: number, c: number, o?: Phaser.Types.GameObjects.Text.TextStyle) => Phaser.GameObjects.Text): void {
    const pa = this.av.partida, st = pa.estadoMision(m), hecha = st === 'hecha';
    rect(g, st === 'lista' ? C.elegido : st === 'nueva' ? C.madera : C.huecoSombra, 1, x - 1, y - 1, MW + 2, MH + 2);
    rect(g, st === 'lista' ? C.elegidoFondo : C.hueco, 1, x, y, MW, MH);
    // Cara (con anillo rojo y corona si es el alfa) y el icono del tipo.
    if (m.tipo === 'alfa') { rect(g, 0xd0402a, 1, x + 2, y + 2, 28, 28); }
    rect(g, C.bandeja, 1, x + 3, y + 3, 26, 26);
    this.cara(x + 16, y + 16, m.dex, 24, this.misObjs, 7);
    if (m.tipo === 'derrotar') pix(g, x + 33, y + 5, 'espadas');
    else if (m.tipo === 'alfa') pix(g, x + 33, y + 6, 'corona');
    else this.iconoItem(x + 37, y + 9, 'pokeball', 9, this.misObjs, 7);
    // Número: ×N si no la has aceptado; si no, lo que llevas.
    const num = st === 'nueva' ? `×${m.n}` : hecha ? '' : `${pa.progresoMision(m)}/${m.n}`;
    t(x + 43, y + 4, num, 8, st === 'lista' ? 0x4f9a3a : C.tinta, { fontStyle: 'bold' });
    // Señal: "!" nueva, "?" para entregar, visto si ya está.
    if (st === 'nueva') t(x + MW - 4, y + 1, '!', 9, 0xe8a33a, { fontStyle: 'bold', stroke: HEX(C.tintaOsc), strokeThickness: 1.5 * S }).setOrigin(1, 0);
    else if (st === 'lista') t(x + MW - 4, y + 1, '?', 9, 0xffd65a, { fontStyle: 'bold', stroke: HEX(C.tintaOsc), strokeThickness: 1.5 * S }).setOrigin(1, 0);
    else if (hecha) pix(g, x + MW - 9, y + 4, 'visto');
    // Recompensa: experiencia y objetos (icono ×N).
    rect(g, C.huecoSombra, 1, x + 2, y + 31, MW - 4, 1);
    t(x + 4, y + 33.5, `+${m.premio.exp}`, 5.5, 0x3f6ea8, { fontStyle: 'bold' });
    let ix = x + 30;
    for (const [id, n] of m.premio.items) {
      this.iconoItem(ix + 5, y + 38.5, id, 10, this.misObjs, 7);
      t(ix + 11, y + 34, `×${n}`, 5, C.tinta);
      ix += 26;
    }
    if (hecha) rect(g, C.hueco, 0.55, x, y, MW, MH);   // entregada: apagada
    this.misZonas.push({ x, y, w: MW, h: MH, m });
  }

  // Tienda (F junto a Kecleon): una fila por cosa, con su icono, lo que hace, cuántas llevas y el precio. Lo que no
  // te llega, apagado.
  private pintarTienda(): void {
    const av = this.av, pa = av.partida;
    const k = av.panel === 'tienda' ? `${pa.dinero}|${VENTA.map(id => pa.tiene(id)).join()}` : '';
    if (k === this.tiClave) return;
    this.tiClave = k;
    this.tiObjs.forEach(o => o.destroy()); this.tiObjs = []; this.tiZonas = []; this.tiCaja = null;
    if (av.panel !== 'tienda') return;
    const FH = 24, w = 176, h = 18 + VENTA.length * (FH + 3) + 12, x = 4, y = 40;   // a la izquierda, como la ventana del vendedor del WoW (no tapa al tendero ni los avisos)
    this.tiCaja = { x, y, w, h };
    const g = this.add.graphics().setDepth(6);
    this.tiObjs.push(g);
    marco(g, x, y, w, h, PANEL);
    const t = (tx: number, ty: number, s: string, px: number, c: number, o: Phaser.Types.GameObjects.Text.TextStyle = {}) => { const q = this.texto(tx, ty, s, px, c, o).setDepth(8); this.tiObjs.push(q); return q; };
    const moneda = (mx: number, my: number) => { const im = this.add.image(mx * S, my * S, this.pixeles('hud_moneda', MONEDA, COL_MONEDA)).setOrigin(0, 0.5).setDepth(8); this.tiObjs.push(im); };
    t(x + 6, y + 5, `TIENDA DE ${NOMBRE_TIENDA.toUpperCase()}`, 5, C.maderaClara, { fontFamily: FUENTE_TIT });
    const din = t(x + w - 6, y + 4, String(pa.dinero), 6.5, C.tinta, { fontStyle: 'bold' }).setOrigin(1, 0);
    moneda(x + w - 6 - din.width / S - 9, y + 8.5);
    VENTA.forEach((id, i) => {
      const it = ITEMS[id], fx = x + 6, fy = y + 16 + i * (FH + 3), fw = w - 12, llega = pa.dinero >= it.precio;
      rect(g, C.huecoSombra, 1, fx - 1, fy - 1, fw + 2, FH + 2);
      rect(g, C.hueco, 1, fx, fy, fw, FH);
      rect(g, C.bandeja, 1, fx + 2, fy + 2, FH - 4, FH - 4);
      this.iconoItem(fx + FH / 2, fy + FH / 2, id, 16, this.tiObjs, 8);
      t(fx + FH + 2, fy + 3, it.nombre, 6, C.tinta, { fontStyle: 'bold' });
      t(fx + FH + 2, fy + 13, `${DESC_VENTA[id] ?? ''} · llevas ${pa.tiene(id)}`, 4.5, C.maderaClara);
      const pr = t(fx + fw - 4, fy + FH / 2, String(it.precio), 6.5, llega ? C.tinta : 0xb03a2e, { fontStyle: 'bold' }).setOrigin(1, 0.5);
      moneda(fx + fw - 4 - pr.width / S - 9, fy + FH / 2);
      if (!llega) rect(g, C.hueco, 0.45, fx, fy, fw, FH);
      this.tiZonas.push({ x: fx, y: fy, w: fw, h: FH, id });
    });
    t(x + w / 2, y + h - 9, 'Clic: comprar uno · Mayús+clic: cinco', 5, C.maderaClara).setOrigin(0.5, 0);
  }

  // Seguimiento (derecha, bajo la hora): las misiones aceptadas con su cara y "2/5"; "?" en dorado si está cumplida.
  private pintarSeguimiento(y0: number): void {
    const pa = this.av.partida, act = pa.misiones.filter(m => { const s = pa.estadoMision(m); return s === 'activa' || s === 'lista'; });
    const k = `${y0}|` + act.map(m => `${m.id}:${pa.progresoMision(m)}`).join('|');
    if (k === this.segClave) return;
    this.segClave = k;
    this.segObjs.forEach(o => o.destroy()); this.segObjs = [];
    if (!act.length) return;
    const g = this.add.graphics().setDepth(1), x = VW - 4 - 74;
    this.segObjs.push(g);
    act.forEach((m, i) => {
      const y = y0 + i * 18, lista = pa.estadoMision(m) === 'lista';
      marco(g, x, y, 74, 16, lista ? { ...PANEL, borde: 0xc8962a, fondo: C.elegidoFondo } : PANEL);
      rect(g, C.bandeja, 1, x + 2, y + 2, 14, 12);
      this.cara(x + 9, y + 8, m.dex, 13, this.segObjs, 2);
      if (m.tipo === 'derrotar') pix(g, x + 19, y + 4.5, 'espadas');
      else if (m.tipo === 'alfa') pix(g, x + 19, y + 5.5, 'corona');
      else this.iconoItem(x + 22.5, y + 8, 'pokeball', 8, this.segObjs, 2);
      const q = this.texto(x + 30, y + 3.5, `${pa.progresoMision(m)}/${m.n}`, 6.5, lista ? 0x4f9a3a : C.tinta, { fontStyle: 'bold' }).setDepth(3);
      this.segObjs.push(q);
      if (lista) this.segObjs.push(this.texto(x + 70, y + 1.5, '?', 9, 0xffd65a, { fontStyle: 'bold', stroke: HEX(C.tintaOsc), strokeThickness: 1.5 * S }).setOrigin(1, 0).setDepth(3));
    });
  }

  // Ficha del atajo bajo el ratón (encima de la barra), o de una carta del panel K (encima de la carta).
  private pintarFicha(a: Atajo, i: number, carta?: { x: number; y: number; w: number; h: number }): void {
    const g = this.fichaG;
    g.clear();
    this.fichaTipo.setVisible(false);
    if (!a || (i < 0 && !carta)) { this.ficha.setVisible(false); return; }
    let txt: string, tipo: TypeName | null = null;
    if ('m' in a) {
      const m = getMove(a.m);
      if (!m) { this.ficha.setVisible(false); return; }
      tipo = m.type;
      const datos = [CATEGORIA[m.category]];
      if (m.basePower) datos.push(`Potencia ${m.basePower}`);
      datos.push(m.accuracy === true ? 'No falla' : `Precisión ${m.accuracy}`);
      // Cómo se lanza y cuánto tarda, con la celeridad de tu Pokémon (docs/GDD-combate.md §3.2).
      const pf = perfil(m), k = this.av.cel(this.av.jugador), seg = (v: number) => `${(Math.round(v / k * 10) / 10).toLocaleString('es')} s`;
      const lanza = pf.lanza === 'cast' ? `Lanzamiento ${seg(pf.t)}` : pf.lanza === 'canal' ? `Canalizado ${seg(pf.t)}` : 'Instantáneo';
      const extra = [pf.interrumpe ? 'Interrumpe lanzamientos' : '', pf.agotado ? `Después, ${pf.agotado} s agotado` : '', pf.lanza !== 'instant' ? 'Moverte lo corta' : ''].filter(Boolean);
      const efectos = descEfecto(m);
      txt = `${m.nombre}\n${datos.join(' · ')}\n${m.flags.includes('contact') ? 'Cuerpo a cuerpo' : necesitaObjetivo(m) ? 'A distancia' : 'Sobre ti'} · ${lanza} · ${pf.cd > GCD ? `se recarga en ${seg(pf.cd)}` : 'sin recarga'}${extra.length ? `\n${extra.join(' · ')}` : ''}${efectos.length ? `\n${efectos.join('\n')}` : ''}`;
    } else txt = `${ITEMS[a.i]?.nombre ?? a.i} (${this.av.partida.tiene(a.i)})\n${ITEMS[a.i]?.tipo === 'pokeball' ? 'Lánzala al objetivo: cuanto más débil esté, más fácil' : ITEMS[a.i]?.cura ? `Te cura ${ITEMS[a.i]!.cura} PS` : 'Te cura un poco'}`;
    this.ficha.setText(txt).setVisible(true);
    const w = this.ficha.width / S + 8, h = this.ficha.height / S + 6, cx = carta ? carta.x + carta.w / 2 : BX + 4 + i * (CW + HUECO) + CW / 2;
    const x = Math.max(4, Math.min(VW - w - 4, cx - w / 2)), y = carta ? (carta.y - h - 3 >= 4 ? carta.y - h - 3 : carta.y + carta.h + 3) : BY - h - 3;
    marco(g, x, y, w, h, PANEL);
    this.ficha.setPosition((x + 4) * S, (y + 3) * S);
    if (tipo) {
      // Etiqueta del tipo tras el nombre (primera línea), con el color del tipo.
      const ctx = this.ficha.context;
      ctx.save(); ctx.font = `${this.ficha.style.fontSize} ${this.ficha.style.fontFamily}`; const nw = ctx.measureText(this.ficha.getWrappedText()[0] ?? '').width / S; ctx.restore();
      this.fichaTipo.setText(TIPO_ES[tipo].toUpperCase()).setVisible(true);
      const tw = this.fichaTipo.width / S + 4, tx = x + 4 + nw + 3, ty = y + 3.5;
      rect(g, COLOR_TIPO[tipo], 1, tx, ty, tw, 7);
      rect(g, 0xffffff, 0.3, tx, ty, tw, 1);
      rect(g, 0x000000, 0.2, tx, ty + 6, tw, 1);
      this.fichaTipo.setPosition((tx + 2) * S, (ty + 0.5) * S);
    }
  }

  // Casilla de la piedra de hogar (persiana mientras se recarga, con los minutos que faltan), su ficha al pasar el
  // ratón y la barra de lanzamiento mientras se canaliza.
  private pintarHogar(px: number, py: number): void {
    const av = this.av, g = this.hogarG, falta = av.hogarFalta(), x = HX + 4, y = BY + 4, w = HW - 8;
    g.clear();
    if (falta > 0) {
      const fr = Math.min(1, falta / HOGAR_CD);
      rect(g, 0x1a1008, 0.6, x, y + w * (1 - fr), w, w * fr);
      this.hogarCd.setText(falta >= 60 ? `${Math.ceil(falta / 60)}m` : `${Math.ceil(falta)}`);
    } else this.hogarCd.setText('');
    if (av.hogar) rect(g, C.elegido, 0.25 + 0.2 * Math.sin(this.time.now / 120), x, y, w, w);
    if (px >= HX && px < HX + HW && py >= BY && py < BY + HW) {
      rect(g, C.elegido, 1, x - 1, y - 1, w + 2, 1); rect(g, C.elegido, 1, x - 1, y + w, w + 2, 1); rect(g, C.elegido, 1, x - 1, y, 1, w); rect(g, C.elegido, 1, x + w, y, 1, w);
      const fg = this.fichaG;
      this.fichaTipo.setVisible(false);
      this.ficha.setText(`Piedra de hogar
Te lleva al pueblo. Quieto ${HOGAR_CARGA} s: si te mueves o te golpean, se corta
Se recarga en ${HOGAR_CD / 60} min${falta > 0 ? ` (faltan ${Math.ceil(falta / 60)} min)` : ''}`).setVisible(true);
      fg.clear();
      const fw = this.ficha.width / S + 8, fh = this.ficha.height / S + 6, fx = Math.max(4, HX), fy = BY - fh - 3;
      marco(fg, fx, fy, fw, fh, PANEL);
      this.ficha.setPosition((fx + 4) * S, (fy + 3) * S);
      this.fichaTapada = true;
    } else this.fichaTapada = false;
    // Barra de lanzamiento: la piedra de hogar (azul), un movimiento lanzado (naranja, se llena) o canalizado (verde, se vacía).
    const cg = this.castG, h = av.hogar, p = av.jugador, ln = p?.lanza, o = av.objetivo;
    cg.clear();
    this.castTxt.setVisible(!!(h || ln));
    if (h || ln) {
      const f = h ? av.hogarFrac() : av.lanzaFrac(p), cx = Math.round(VW / 2 - CAST_W / 2);
      marco(cg, cx - 2, CAST_Y - 2, CAST_W + 4, 13, PANEL);
      rect(cg, 0x2a1a10, 1, cx, CAST_Y, CAST_W, 9);
      rect(cg, h ? 0x6ec4f0 : ln!.canal ? 0x7ad06a : 0xf0a838, 1, cx, CAST_Y, Math.round(CAST_W * f), 9);
      rect(cg, 0xffffff, 0.35, cx, CAST_Y, Math.round(CAST_W * f), 1);
      this.castTxt.setText(h ? 'Piedra de hogar' : `${getMove(ln!.id)?.nombre ?? ''}  ${Math.max(0, ln!.t1 - av.ahora).toFixed(1)}`);
    }
    // La del objetivo, bajo su marco (y sus bufos): se ve venir lo que lanza para interrumpirlo.
    const ol = o && !o.muerto ? o.lanza : null;
    this.objCastTxt.setVisible(!!ol);
    if (ol) {
      const w = 100, x = Math.round(VW / 2 - w / 2), y = 4 + (o!.alfa ? ALFA_DY : 0) + 33 + (av.auras(o!).length ? CHIP_H + 2 : 0), f = av.lanzaFrac(o!);
      marco(cg, x - 2, y - 2, w + 4, 11, PANEL);
      rect(cg, 0x2a1a10, 1, x, y, w, 7);
      rect(cg, ol.canal ? 0x7ad06a : 0xf0a838, 1, x, y, Math.round(w * f), 7);
      this.objCastTxt.setText(getMove(ol.id)?.nombre ?? '').setPosition(VW / 2 * S, (y + 3.5) * S);
    }
  }

  // Ficha de un bufo o debufo (bajo su icono).
  private fichaAura(z: { x: number; y: number; w: number; h: number; a: Aura }): void {
    const g = this.fichaG;
    g.clear();
    const desc = DESC_ESTADO[z.a.txt] ?? (z.a.color === 0x4fae4a ? 'Sube durante un rato' : 'Baja durante un rato');
    this.ficha.setText(`${z.a.nombre}\n${desc}`).setVisible(true);
    const w = this.ficha.width / S + 8, h = this.ficha.height / S + 6, x = Math.max(4, Math.min(VW - w - 4, z.x)), y = z.y + z.h + 3;
    marco(g, x, y, w, h, PANEL);
    this.ficha.setPosition((x + 4) * S, (y + 3) * S);
  }

  // Panel de movimientos (K): los que sabe tu Pokémon y los objetos de la mochila.
  private pintarPanel(): void {
    const av = this.av, m = av.partida.activo;
    const k = av.panel === 'movs' ? `${m.uid}|${m.movs.join()}|${JSON.stringify(av.partida.estado.items)}|${JSON.stringify(av.asignando)}` : '';
    if (k === this.panelClave) return;
    this.panelClave = k;
    this.panelObjs.forEach(o => o.destroy()); this.panelObjs = []; this.panelZonas = [];
    if (av.panel !== 'movs') return;
    const items = Object.entries(av.partida.estado.items).filter(([id, n]) => n > 0 && ITEMS[id] && !EQUIPABLES[id]);   // los equipables, en el inventario (I)
    const filasM = Math.ceil(m.movs.length / 3), filasI = Math.ceil(items.length / 3);
    const w = 250, h = 30 + filasM * 18 + (items.length ? 14 + filasI * 18 : 0) + 12, x = Math.round(VW / 2 - w / 2), y = Math.max(32, BY - h - 6);
    const g = this.add.graphics().setDepth(6);
    marco(g, x, y, w, h, PANEL);
    const t = (tx: number, ty: number, s: string, px: number, c: number, o: Phaser.Types.GameObjects.Text.TextStyle = {}) => { const q = this.texto(tx, ty, s, px, c, o).setDepth(7); this.panelObjs.push(q); return q; };
    t(x + 6, y + 5, 'MOVIMIENTOS', 5, C.maderaClara, { fontFamily: FUENTE_TIT });
    t(x + w - 6, y + 5, av.asignando ? 'Ahora elige una casilla (o su tecla)' : 'Clic en uno y luego en la barra', 5, C.maderaClara).setOrigin(1, 0);
    const carta = (cx: number, cy: number, a: { m: string } | { i: string }, nombre: string, color: number, icono?: string) => {
      const cw = 78, ch = 15, elegido = JSON.stringify(av.asignando) === JSON.stringify(a), enBarra = m.barra.some(b => JSON.stringify(b) === JSON.stringify(a));
      rect(g, elegido ? C.elegido : C.huecoSombra, 1, cx - 1, cy - 1, cw + 2, ch + 2);
      rect(g, color, 1, cx, cy, cw, ch);
      rect(g, 0xffffff, 0.3, cx, cy, cw, 1);
      if (icono && this.textures.exists(icono)) { const im = this.add.image((cx + 8) * S, (cy + ch / 2) * S, icono).setDepth(7); im.setScale(S * Math.min(1, 12 / Math.max(im.frame.width, im.frame.height))); this.panelObjs.push(im); }
      const q = t(cx + (icono ? 17 : 4), cy + ch / 2, nombre, 5.5, 0xfff6dc, { stroke: HEX(C.tintaOsc), strokeThickness: 1.5 * S }).setOrigin(0, 0.5);
      if (enBarra) q.setAlpha(0.75);
      this.panelZonas.push({ x: cx, y: cy, w: cw, h: ch, a });
    };
    m.movs.forEach((id, i) => {
      const mv = getMove(id);
      if (mv) carta(x + 6 + (i % 3) * 81, y + 16 + Math.floor(i / 3) * 18, { m: id }, mv.nombre, COLOR_TIPO[mv.type]);
    });
    if (items.length) {
      const yi = y + 18 + filasM * 18;
      t(x + 6, yi, 'MOCHILA', 5, C.maderaClara, { fontFamily: FUENTE_TIT });
      items.forEach(([id, n], i) => carta(x + 6 + (i % 3) * 81, yi + 11 + Math.floor(i / 3) * 18, { i: id }, `${ITEMS[id].nombre} ×${n}`, 0x8b5a33, ITEMS[id].icono));
    }
    this.panelObjs.push(g);
  }

  // Inventario (I): clic en un hueco (con un equipable elegido, ponerlo ahí; si no, quitar lo que lleva) o en un equipable
  // (al primer hueco libre; con los dos llenos, se queda elegido).
  private clicInventario(z: { id: string | null; hueco?: number }): void {
    const av = this.av, obs = av.partida.objetos(av.partida.activo);
    if (z.hueco !== undefined) {
      if (this.invElegido) av.equipar(this.invElegido, z.hueco); else av.equipar(null, z.hueco);
      this.invElegido = null;
      return;
    }
    if (z.id && ITEMS[z.id]?.tipo === 'evolutivo') { av.usarItem(z.id); return; }   // piedra: en el que manejas
    if (!z.id || !EQUIPABLES[z.id]) return;
    const libre = obs.indexOf(null);
    if (obs.includes(z.id)) av.equipar(z.id, obs.indexOf(z.id));   // ya lo lleva: lo dice el aviso
    else if (libre >= 0) av.equipar(z.id, libre);
    else this.invElegido = this.invElegido === z.id ? null : z.id;
  }
  // Inventario (I), como la pantalla del personaje del WoW: tu Pokémon animado en el centro, sus objetos a los lados y,
  // debajo, los equipables de la mochila (las Balls y las curas siguen en el panel K).
  private pintarInventario(): void {
    const av = this.av, m = av.partida.activo, obs = av.partida.objetos(m), dex = av.jugador?.dex ?? '';
    const eq = Object.entries(av.partida.estado.items).filter(([id, n]) => n > 0 && (EQUIPABLES[id] || ITEMS[id]?.tipo === 'evolutivo'));   // y las piedras evolutivas
    if (av.panel !== 'inv') this.invElegido = null;
    const k = av.panel === 'inv' ? `${av.partida.dinero}|${m.uid}|${dex}|${m.nivel}|${JSON.stringify(av.jugador?.boosts)}|${obs.join()}|${JSON.stringify(eq)}|${this.invElegido}|${listo(this, dex)}` : '';
    if (k === this.invClave) return;
    this.invClave = k;
    this.invObjs.forEach(o => o.destroy()); this.invObjs = []; this.invZonas = []; this.invCaja = null;
    if (av.panel !== 'inv') return;
    const COLS = 6, CS = 18, PASO = CS + 2, filas = Math.max(1, Math.ceil(eq.length / COLS)), HUECO = 24, FONDO = 78;
    const STATS = 3 * 7 + 4, w = 12 + COLS * PASO - 2, h = 24 + FONDO + 4 + STATS + 6 + 11 + filas * PASO + 12 + 11;
    const x = 4, y = Math.max(32, Math.min(48, BY - 6 - h));   // bajo los bufos de tu marco, si cabe
    this.invCaja = { x, y, w, h };
    const g = this.add.graphics().setDepth(6);
    this.invObjs.push(g);
    marco(g, x, y, w, h, PANEL);
    const t = (tx: number, ty: number, s: string, px: number, c: number, o: Phaser.Types.GameObjects.Text.TextStyle = {}) => { const q = this.texto(tx, ty, s, px, c, o).setDepth(7); this.invObjs.push(q); return q; };
    // Icono a escala entera de pantalla (el pixel art no se emborrona) que quepa en `tam` px de juego.
    const icono = (cx: number, cy: number, id: string, tam: number) => {
      const ic = ITEMS[id]?.icono;
      if (!ic || !this.textures.exists(ic)) return;
      const im = this.add.image(cx * S, cy * S, ic).setDepth(8);
      im.setScale(Math.max(1, Math.floor(S * tam / Math.max(im.frame.width, im.frame.height))));
      this.invObjs.push(im);
    };
    const casilla = (cx: number, cy: number, lado: number, id: string | null, zona: { id: string | null; hueco?: number }, elegida: boolean, n = 0) => {
      rect(g, elegida ? C.elegido : C.huecoSombra, 1, cx - 1, cy - 1, lado + 2, lado + 2);
      rect(g, elegida ? C.elegidoFondo : C.hueco, 1, cx, cy, lado, lado);
      if (id) icono(cx + lado / 2, cy + lado / 2, id, lado - 2);
      if (n > 1) this.invObjs.push(this.sombreado(cx + lado - 0.5, cy + lado + 0.5, String(n), 5).setOrigin(1, 1).setDepth(9));
      this.invZonas.push({ x: cx, y: cy, w: lado, h: lado, ...zona });
    };
    // Nombre, sexo y nivel; debajo, sus tipos con su color.
    const l = av.jugador, nom = t(x + w / 2, y + 5, `${l.nombre}  Nv ${l.nivel}`, 6, C.tinta, { fontStyle: 'bold' }).setOrigin(0.5, 0);
    if (l.sexo) {
      const sx = this.add.image(nom.x + nom.width / 2 + 2 * S, (y + 5.5) * S, this.pixeles(`hud_sexo_${l.sexo}`, SEXO[l.sexo].filas, { x: SEXO[l.sexo].col })).setOrigin(0).setDepth(7);
      this.invObjs.push(sx);
    }
    const chips = l.tipos.map(tp => { const q = t(0, y + 14, TIPO_ES[tp].toUpperCase(), 5, 0xffffff, { stroke: '#3a2a1a', strokeThickness: 1 * S }); return { tp, q, cw: q.width / S + 6 }; });
    let cx0 = x + w / 2 - (chips.reduce((a, c) => a + c.cw, 0) + (chips.length - 1) * 3) / 2;
    for (const c of chips) {
      rect(g, COLOR_TIPO[c.tp], 1, cx0, y + 13, c.cw, 8);
      rect(g, 0xffffff, 0.3, cx0, y + 13, c.cw, 1);
      rect(g, 0x000000, 0.2, cx0, y + 20, c.cw, 1);
      c.q.setPosition((cx0 + 3) * S, (y + 14) * S);
      cx0 += c.cw + 3;
    }
    // El Pokémon, animado (su Idle mirando al frente), sobre un fondo hundido, con un hueco a cada lado.
    const fx = x + 6, fy = y + 24, fw = w - 12;
    rect(g, C.huecoSombra, 1, fx, fy, fw, FONDO);
    rect(g, C.bandejaSombra, 1, fx + 1, fy + 1, fw - 2, FONDO - 2);
    rect(g, 0x000000, 0.12, fx + fw / 2 - 22, fy + FONDO - 17, 44, 6);   // sombra bajo los pies
    if (dex && listo(this, dex)) {
      const spr = this.add.sprite((fx + fw / 2) * S, (fy + FONDO - 14) * S, '__DEFAULT').setDepth(7);
      poner(spr, dex, 'Idle', 0);
      spr.setScale(Math.max(1, Math.min(3 * S, Math.floor(S * 50 / Math.max(1, ancla(dex).alto)))));
      this.invObjs.push(spr);
    }
    for (let i = 0; i < HUECOS_OBJ; i++) {
      const hx = i === 0 ? fx + 5 : fx + fw - 5 - HUECO, hy = fy + FONDO / 2 - HUECO / 2;
      casilla(hx, hy, HUECO, obs[i], { id: obs[i], hueco: i }, !!this.invElegido || !!obs[i]);
    }
    // Los equipables de la mochila.
    // Stats (con su nivel), en dos columnas; en verde o rojo si ahora mismo las tiene subidas o bajadas.
    const ys = fy + FONDO + 4, st = l.stats;
    const filasSt: [string, number, Stat6 | null][] = [['PS', st.hp, null], ['Velocidad', st.spe, 'spe'], ['Ataque', st.atk, 'atk'], ['At. Esp.', st.spa, 'spa'], ['Defensa', st.def, 'def'], ['Def. Esp.', st.spd, 'spd']];
    rect(g, C.huecoSombra, 1, fx, ys, fw, STATS);
    rect(g, C.hueco, 1, fx + 1, ys + 1, fw - 2, STATS - 2);
    filasSt.forEach(([nombre, v, b], i) => {
      const cx = fx + 4 + (i % 2) * (fw / 2), cy = ys + 2 + Math.floor(i / 2) * 7, n = b ? l.boosts[b] ?? 0 : 0;
      t(cx, cy, nombre, 5, C.tinta).setAlpha(0.8);
      t(cx + fw / 2 - 8, cy, String(v), 5, n > 0 ? 0x3f8a2f : n < 0 ? 0xc0453a : C.tinta, { fontStyle: 'bold' }).setOrigin(1, 0);
    });
    const ye = ys + STATS + 6;
    t(x + 6, ye, 'OBJETOS', 5, C.maderaClara, { fontFamily: FUENTE_TIT });
    if (!eq.length) t(x + 7, ye + 11 + CS / 2, 'Ninguno: los sueltan los alfas', 5, C.tinta).setOrigin(0, 0.5).setAlpha(0.7);
    eq.forEach(([id, n], i) => casilla(x + 7 + (i % COLS) * PASO, ye + 11 + Math.floor(i / COLS) * PASO, CS, id, { id }, this.invElegido === id, n));
    // Pokécoins (como el oro de las bolsas del WoW).
    const din = t(x + w - 7, y + h - 20, `${av.partida.dinero} Pokécoins`, 5.5, C.tinta, { fontStyle: 'bold' }).setOrigin(1, 0);
    this.invObjs.push(this.add.image((x + w - 7 - din.width / S - 9) * S, (y + h - 16.5) * S, this.pixeles('hud_moneda', MONEDA, COL_MONEDA)).setOrigin(0, 0.5).setDepth(8));
    t(x + w / 2, y + h - 9, this.invElegido ? 'Ahora elige qué objeto cambiar' : 'Clic: ponérselo · en el suyo: quitar', 5, C.maderaClara).setOrigin(0.5, 0);
  }
  // Ficha de un objeto del inventario (a la derecha del panel, a su altura).
  private fichaInv(z: { x: number; y: number; w: number; h: number; id: string | null; hueco?: number }): void {
    const g = this.fichaG, id = z.id;
    g.clear();
    this.fichaTipo.setVisible(false);
    if (!id) { this.ficha.setVisible(false); return; }
    const eq = EQUIPABLES[id];
    let desc = eq?.desc ?? '', uso = z.hueco !== undefined ? (this.invElegido ? 'Clic: cambiarlo' : 'Clic: quitárselo') : 'Clic: ponérselo';
    if (ITEMS[id]?.tipo === 'evolutivo') {   // piedra: a quién hace evolucionar y si le sirve al que manejas
      const nom = (l: string) => LINEAS[l].formas[0].nombre, dest = this.av.partida.evoCon(this.av.partida.activo, id);
      desc = `Hace evolucionar a ${Object.entries(EVO_OBJETO).filter(([, o]) => o[id]).map(([l, o]) => `${nom(l)} en ${nom(o[id])}`).join(', ')}`;
      uso = dest ? `Clic: usarla (${this.av.jugador.nombre} → ${nom(dest)})` : `A ${this.av.jugador.nombre} no le hace nada`;
    }
    this.ficha.setText(`${ITEMS[id]?.nombre ?? id}\n${desc}\n${uso}`).setVisible(true);
    const w = this.ficha.width / S + 8, h = this.ficha.height / S + 6, c = this.invCaja;
    const x = c ? c.x + c.w + 3 : z.x + z.w + 3, y = Math.max(4, Math.min(VH - h - 4, z.y + z.h / 2 - h / 2));
    marco(g, x, y, w, h, PANEL);
    this.ficha.setPosition((x + 4) * S, (y + 3) * S);
  }

  // Comercio (T): tus cosas | lo que das | lo que da el otro; debajo, Aceptar y Cancelar. Con una petición pendiente,
  // solo un cartel bajo el marco del objetivo.
  private pintarTrato(): void {
    const av = this.av, tr = av.tradeo, t0 = tr?.trato ?? null, pa = av.partida, e = pa.estado;
    const caras = t0 ? [...e.equipo, ...t0.suya.pokes].filter(m => listo(this, idSprite(formaDe(m.linea, m.nivel).dex, m.shiny))).length : 0;
    const k = t0 ? JSON.stringify([t0, e.items, e.dinero, e.activo, e.equipo.map(m => m.uid), caras]) : tr?.pideDe ? `pide|${tr.pideDe.nombre}` : '';
    if (k === this.trClave) return;
    this.trClave = k;
    this.trObjs.forEach(o => o.destroy()); this.trObjs = []; this.trZonas = []; this.trCaja = null;
    if (!k) return;
    const fondo = this.add.graphics().setDepth(6), g = this.add.graphics().setDepth(7);   // el marco (se pinta al final, cuando se sabe el alto) y lo de dentro
    this.trObjs.push(fondo, g);
    const t = (tx: number, ty: number, s: string, px: number, c: number, o: Phaser.Types.GameObjects.Text.TextStyle = {}) => { const q = this.texto(tx, ty, s, px, c, o).setDepth(8); this.trObjs.push(q); return q; };
    if (!t0) {   // petición pendiente
      const q = t(VW / 2, 60, `${tr!.pideDe!.nombre} quiere comerciar contigo\nT aceptar · Esc rechazar`, 6, C.tinta, { align: 'center', fontStyle: 'bold' }).setOrigin(0.5, 0);
      const w = q.width / S + 14, h = q.height / S + 8;
      marco(fondo, VW / 2 - w / 2, 56, w, h, PANEL);
      return;
    }
    const PASO = 20, CS = 18, COLS = 6, CW2 = 6 + COLS * PASO + 4, w = 6 + 3 * CW2 + 2 * 4 + 6;
    const x = Math.round((VW - w) / 2), y = 56, cy0 = y + 18;
    const moneda = (mx: number, my: number) => { const im = this.add.image(mx * S, my * S, this.pixeles('hud_moneda', MONEDA, COL_MONEDA)).setOrigin(0, 0.5).setDepth(8); this.trObjs.push(im); };
    const nombrePoke = (m: Miembro) => `${formaDe(m.linea, m.nivel).nombre}${m.shiny ? ' ✦' : ''}${m.sexo === 'm' ? ' ♂' : m.sexo === 'f' ? ' ♀' : ''}  Nv ${m.nivel}\n${m.movs.map(id => getMove(id)?.name ?? id).join(', ')}${m.objetos?.some(Boolean) ? `\nLleva: ${m.objetos.filter(Boolean).map(id => ITEMS[id!]?.nombre ?? id).join(', ')}` : ''}`;
    // Las casillas: hueco, contenido y su zona (clic, ficha).
    const hueco = (cx: number, cy: number) => { rect(g, C.huecoSombra, 1, cx - 1, cy - 1, CS + 2, CS + 2); rect(g, C.hueco, 1, cx, cy, CS, CS); };
    const poke = (cx: number, cy: number, m: Miembro, clic?: (mayus: boolean) => void, uso = '') => {
      hueco(cx, cy);
      this.cara(cx + CS / 2, cy + CS / 2, idSprite(formaDe(m.linea, m.nivel).dex, m.shiny), CS - 2, this.trObjs, 8);
      this.trObjs.push(this.sombreado(cx + CS - 0.5, cy + CS + 0.5, String(m.nivel), 4.5).setOrigin(1, 1).setDepth(9));
      if (m.shiny) this.trObjs.push(this.sombreado(cx + 0.5, cy - 0.5, '✦', 4.5, 0xfff0a0).setDepth(9));
      this.trZonas.push({ x: cx, y: cy, w: CS, h: CS, clic, ficha: nombrePoke(m) + (uso ? `\n${uso}` : '') });
    };
    const objeto = (cx: number, cy: number, id: string, n: number, clic?: (mayus: boolean) => void, uso = '') => {
      hueco(cx, cy);
      this.iconoItem(cx + CS / 2, cy + CS / 2, id, CS - 2, this.trObjs, 8);
      if (n > 1) this.trObjs.push(this.sombreado(cx + CS - 0.5, cy + CS + 0.5, String(n), 5).setOrigin(1, 1).setDepth(9));
      this.trZonas.push({ x: cx, y: cy, w: CS, h: CS, clic, ficha: `${ITEMS[id]?.nombre ?? id} ×${n}${uso ? `\n${uso}` : ''}` });
    };
    const rejilla = (cx: number, cy: number, n: number, minFilas: number) => {   // huecos vacíos; devuelve el alto
      const filas = Math.max(minFilas, Math.ceil(n / COLS));
      for (let i = n; i < filas * COLS; i++) hueco(cx + (i % COLS) * PASO, cy + Math.floor(i / COLS) * PASO);
      return filas * PASO;
    };
    const tit = (cx: number, cy: number, s: string) => t(cx, cy, s, 5, C.maderaClara, { fontFamily: FUENTE_TIT });
    const cols = [0, 1, 2].map(i => x + 6 + i * (CW2 + 4));
    let alto = 0;
    // 1. Tus cosas.
    {
      const cx = cols[0] + 4;
      let cy = cy0;
      tit(cols[0], cy, 'TUS COSAS'); cy += 10;
      const libres = e.equipo.filter(m => m.uid !== e.activo && !t0.mia.pokes.includes(m.uid)).slice(0, 3 * COLS);
      t(cx, cy, 'Pokémon', 4.5, C.tinta).setAlpha(0.75); cy += 7;
      libres.forEach((m, i) => poke(cx + (i % COLS) * PASO, cy + Math.floor(i / COLS) * PASO, m, () => tr!.ponerPoke(m.uid), 'Clic: ofrecerlo'));
      if (!libres.length) t(cx, cy + CS / 2, e.equipo.length > 1 ? 'Ya los ofreces todos' : 'Solo tienes al que manejas', 4.5, C.tinta).setOrigin(0, 0.5).setAlpha(0.6);
      cy += Math.max(1, Math.ceil(libres.length / COLS)) * PASO + 2;
      const objs = Object.entries(e.items).map(([id, n]) => [id, n - (t0.mia.items[id] ?? 0)] as const).filter(([id, n]) => n > 0 && ITEMS[id]).slice(0, 3 * COLS);
      t(cx, cy, 'Objetos', 4.5, C.tinta).setAlpha(0.75); cy += 7;
      objs.forEach(([id, n], i) => objeto(cx + (i % COLS) * PASO, cy + Math.floor(i / COLS) * PASO, id, n, mayus => tr!.ponerObjeto(id, mayus ? 5 : 1), 'Clic: ofrecer uno · Mayús: cinco'));
      if (!objs.length) t(cx, cy + CS / 2, 'Mochila vacía', 4.5, C.tinta).setOrigin(0, 0.5).setAlpha(0.6);
      cy += Math.max(1, Math.ceil(objs.length / COLS)) * PASO + 2;
      const d = t(cx + 10, cy, `${pa.dinero - t0.mia.dinero} Pokécoins`, 5.5, C.tinta, { fontStyle: 'bold' });
      moneda(cx, cy + 3.5);
      this.trZonas.push({ x: cx, y: cy - 1, w: d.width / S + 12, h: 9, clic: mayus => tr!.dinero(mayus ? 100 : 10), ficha: 'Clic: ofrecer 10 · Mayús: 100' });
      cy += 11;
      alto = Math.max(alto, cy - cy0);
    }
    // 2 y 3. Lo que das y lo que da: Pokémon (una fila), objetos (dos filas), Pokécoins y si está aceptado (en verde).
    const oferta = (ci: number, titulo: string, pokes: Miembro[], items: [string, number][], dinero: number, acepta: boolean, mia: boolean) => {
      const cx = cols[ci] + 4;
      let cy = cy0;
      tit(cols[ci], cy, titulo); cy += 10;
      rect(g, acepta ? 0x5fbf4a : C.bandejaSombra, acepta ? 0.35 : 0.25, cols[ci], cy - 2, CW2, 7 + PASO + 2 + 7 + 2 * PASO + 2 + 13);
      t(cx, cy, `Pokémon (${pokes.length}/${TRATO_POKES})`, 4.5, C.tinta).setAlpha(0.75); cy += 7;
      pokes.forEach((m, i) => poke(cx + i * PASO, cy, m, mia ? () => tr!.quitarPoke(m.uid) : undefined, mia ? 'Clic: quitarlo' : 'Te lo da'));
      cy += rejilla(cx, cy, pokes.length, 1) + 2;
      t(cx, cy, `Objetos (${items.length}/${TRATO_OBJS})`, 4.5, C.tinta).setAlpha(0.75); cy += 7;
      items.forEach(([id, n], i) => objeto(cx + (i % COLS) * PASO, cy + Math.floor(i / COLS) * PASO, id, n, mia ? mayus => tr!.quitarObjeto(id, mayus ? 5 : 1) : undefined, mia ? 'Clic: quitar uno · Mayús: cinco' : 'Te lo da'));
      cy += rejilla(cx, cy, items.length, 2) + 2;
      const d = t(cx + 10, cy, `${dinero} Pokécoins`, 5.5, C.tinta, { fontStyle: 'bold' });
      moneda(cx, cy + 3.5);
      if (mia) this.trZonas.push({ x: cx, y: cy - 1, w: d.width / S + 12, h: 9, clic: mayus => tr!.dinero(mayus ? -100 : -10), ficha: 'Clic: quitar 10 · Mayús: 100' });
      cy += 13;
      const est = t(cols[ci] + CW2 / 2, cy, acepta ? '✓ ACEPTADO' : 'Sin aceptar', 5.5, acepta ? 0x2f7a22 : C.tinta, { fontStyle: 'bold' }).setOrigin(0.5, 0);
      if (!acepta) est.setAlpha(0.55);
      cy += 9;
      alto = Math.max(alto, cy - cy0);
    };
    const yoOk = !!t0.listoYo && t0.listoYo[0] === t0.mia.v && t0.listoYo[1] === t0.suya.v;
    const elOk = !!t0.listoEl && t0.listoEl[0] === t0.suya.v && t0.listoEl[1] === t0.mia.v;
    const mias = t0.mia.pokes.map(u => e.equipo.find(m => m.uid === u)).filter((m): m is Miembro => !!m);
    oferta(1, 'TÚ DAS', mias, Object.entries(t0.mia.items), t0.mia.dinero, yoOk, true);
    oferta(2, `${t0.nombre.toUpperCase()} DA`, t0.suya.pokes, Object.entries(t0.suya.items), t0.suya.dinero, elOk, false);
    // Botones.
    const by = cy0 + alto + 4, BWb = 56, BH = 13, mid = x + w / 2;
    const boton = (bx: number, txt: string, clic: () => void, activo: boolean) => {
      marco(g, bx, by, BWb, BH, { borde: C.madera, fondo: activo ? C.bandeja : C.hueco, luz: C.bandejaLuz, osc: C.bandejaSombra, sombra: true });
      const q = t(bx + BWb / 2, by + BH / 2, txt, 6, C.tinta, { fontStyle: 'bold' }).setOrigin(0.5);
      if (!activo) q.setAlpha(0.5);
      this.trZonas.push({ x: bx, y: by, w: BWb, h: BH, clic: () => clic() });
    };
    boton(mid - BWb - 4, t0.cerrando ? 'Cerrando…' : yoOk ? 'Quitar' : 'Aceptar', () => tr!.pulsarListo(), !t0.cerrando);
    boton(mid + 4, 'Cancelar', () => tr!.cancelar(), !t0.cerrando);
    t(mid, by + BH + 3, 'Cualquier cambio quita los dos aceptados · Esc cancela', 4.5, C.maderaClara).setOrigin(0.5, 0);
    t(mid, y + 5, `COMERCIO CON ${t0.nombre.toUpperCase()}`, 6, C.tinta, { fontFamily: FUENTE_TIT }).setOrigin(0.5, 0);
    const h = by + BH + 13 - y;
    this.trCaja = { x, y, w, h };
    marco(fondo, x, y, w, h, PANEL);
  }
  // Ficha de una casilla del comercio (encima, a la derecha).
  private fichaTrato(z: { x: number; y: number; w: number; h: number; ficha?: string }): void {
    const g = this.fichaG;
    g.clear();
    this.fichaTipo.setVisible(false);
    this.ficha.setText(z.ficha ?? '').setVisible(true);
    const w = this.ficha.width / S + 8, h = this.ficha.height / S + 6;
    const x = Math.min(VW - w - 4, z.x + z.w + 3), y = Math.max(4, Math.min(VH - h - 4, z.y - h - 2));
    marco(g, x, y, w, h, PANEL);
    this.ficha.setPosition((x + 4) * S, (y + 3) * S);
  }

  zona(z: { nombre: string; lema: string }): void {
    const objs = [this.zonaTit.setText(z.nombre), this.zonaLema.setText(z.lema)];
    this.tweens.killTweensOf(objs);
    this.tweens.chain({ targets: objs, tweens: [{ alpha: 1, duration: 600 }, { alpha: 0, duration: 900, delay: 2600 }] });
  }

  aviso(txt: string): void {
    this.avisoTxt.setText(txt);
    const w = this.avisoTxt.width / S + 14, h = this.avisoTxt.height / S + 8;
    this.avisoG.clear();
    marco(this.avisoG, -w / 2, -h / 2, w, h, PANEL);
    this.avisoG.setScale(1).setPosition(0, 0);
    // marco dibuja en px de juego desde (x, y): llevar el origen al centro del contenedor.
    this.avisoC.setAlpha(1);
    this.avisoTimer?.remove();
    this.tweens.killTweensOf(this.avisoC);
    this.avisoTimer = this.time.delayedCall(Math.min(9000, 2500 + txt.length * 45), () => this.tweens.add({ targets: this.avisoC, alpha: 0, duration: 400 }));
  }
}
