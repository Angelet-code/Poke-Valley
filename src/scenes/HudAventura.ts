// HUD del modo aventura (escena paralela a Aventura, sin zoom), con el estilo de UIScene (madera + pergamino):
// - Arriba a la izquierda, tu Pokémon (vida, nivel, experiencia, estado); arriba en el centro, el objetivo (con su
//   temple: tranquilo, asustadizo o peleón); arriba a la derecha, el mapa y la hora.
// - Abajo, la barra de atajos (teclas 1-0): movimientos con el color de su tipo u objetos con su icono y cuántos
//   quedan; se oscurecen mientras se enfrían y el número se pone rojo si el objetivo está lejos. Al pasar el ratón,
//   la ficha del movimiento. Clic = usar; clic derecho = quitar de la barra.
// - K: panel de movimientos y objetos. Clic en uno y luego en una casilla (o su tecla) para colocarlo.
import Phaser from 'phaser';
import { S, VH, VW } from '../config';
import { C, FUENTE_PX, FUENTE_TIT, HEX, PANEL, marco, rect, type G } from './UIScene';
import { COLOR_TEMPLE, NOMBRE_TEMPLE, type Aura, type Aventura, type Luchador } from './Aventura';
import { COLOR_TIPO, TIPO_ES, getMove } from '../data/movimientos';
import { ITEMS } from '../data/items';
import { NOMBRE_CLIMA, NOMBRE_ESTADO, alcance, enfriamiento, expDeNivel, necesitaObjetivo } from '../combate/reglas';
import { CASILLAS, type Atajo } from '../combate/partida';
import { clave } from '../combate/sprites';

const CW = 32, CH = 22, HUECO = 2;                       // casilla de la barra (px de juego)
const BW = 8 + CASILLAS * CW + (CASILLAS - 1) * HUECO, BX = Math.round((VW - BW) / 2), BY = VH - 5 - (CH + 8);
const CATEGORIA: Record<string, string> = { Physical: 'Físico', Special: 'Especial', Status: 'Estado' };
const oscurecer = (c: number, k: number) => (Math.round(((c >> 16) & 255) * k) << 16) | (Math.round(((c >> 8) & 255) * k) << 8) | Math.round((c & 255) * k);

interface Marco {
  g: G; cara: Phaser.GameObjects.Image; nombre: Phaser.GameObjects.Text; nivel: Phaser.GameObjects.Text; ps: Phaser.GameObjects.Text; sub: Phaser.GameObjects.Text; clave: string;
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
  private fichaG!: G;
  private ficha!: Phaser.GameObjects.Text;
  private panelObjs: Phaser.GameObjects.GameObject[] = [];
  private panelClave = '';
  private panelZonas: { x: number; y: number; w: number; h: number; a: { m: string } | { i: string } }[] = [];
  private avisoC!: Phaser.GameObjects.Container;
  private avisoG!: G;
  private avisoTxt!: Phaser.GameObjects.Text;
  private avisoTimer?: Phaser.Time.TimerEvent;
  private zonaTit!: Phaser.GameObjects.Text;
  private zonaLema!: Phaser.GameObjects.Text;

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
    // Ficha del movimiento bajo el ratón.
    this.fichaG = this.add.graphics().setDepth(5);
    this.ficha = this.texto(0, 0, '', 6, C.tinta, { wordWrap: { width: 120 * S }, lineSpacing: 1 * S }).setDepth(6).setVisible(false);
    // Teclas de ayuda.
    const ayuda = ['Tab objetivo', 'K movimientos', 'F cambiar'];
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
      const x = p.x / S, y = p.y / S;
      const z = this.panelZonas.find(q => x >= q.x && x < q.x + q.w && y >= q.y && y < q.y + q.h);
      if (z) { this.av.asignando = z.a; return; }
      const i = this.casillaEn(x, y);
      if (i < 0) return;
      if (p.rightButtonDown()) { const m = this.av.partida.activo; m.barra[i] = null; this.av.guardar(); return; }
      this.av.casilla(i);
    });
  }
  // Para la escena del mundo: ¿este clic (px de pantalla) es del HUD?
  tapaClic(px: number, py: number): boolean {
    const x = px / S, y = py / S;
    return (x >= BX && x < BX + BW && y >= BY && y < BY + CH + 8) || (!!this.av.panel && this.panelZonas.length > 0 && x > VW / 2 - 130 && x < VW / 2 + 130 && y > 30 && y < BY - 4);
  }
  private casillaEn(x: number, y: number): number {
    if (y < BY + 4 || y > BY + 4 + CH) return -1;
    const i = Math.floor((x - BX - 4) / (CW + HUECO));
    return i >= 0 && i < CASILLAS && x - BX - 4 - i * (CW + HUECO) < CW ? i : -1;
  }

  private crearMarco(x: number, y: number): Marco {
    const g = this.add.graphics().setDepth(1);
    return {
      g, cara: this.add.image((x + 13) * S, (y + 14) * S, '__DEFAULT').setDepth(2).setVisible(false),
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
  // Marco de un luchador: cara (primer fotograma de su Idle de frente), nombre, nivel, vida y una línea de abajo.
  private pintarMarco(mc: Marco, x: number, y: number, l: Luchador | null, sub: string, colorSub: number, exp?: number): void {
    const g = mc.g;
    g.clear();
    const vis = !!l;
    [mc.cara, mc.nombre, mc.nivel, mc.ps, mc.sub].forEach(o => o.setVisible(vis));
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
    marco(g, x, y, 128, 30, PANEL);
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
    const sub = !o ? '' : o.rol === 'vecino' ? 'De tu equipo · F para ser él' : o.estado ? NOMBRE_ESTADO[o.estado] : o.modo === 'pelear' ? '¡Te ataca!' : `${NOMBRE_TEMPLE[o.temple]} · ${o.tipos.map(t => TIPO_ES[t]).join(' · ')}`;
    this.pintarMarco(this.obj, Math.round(VW / 2 - 64), 4, o, sub, !o ? 0 : o.rol === 'vecino' ? 0x3f6ea8 : o.modo === 'pelear' ? 0xb03a2e : oscurecer(COLOR_TEMPLE[o.temple], 0.6));
    // Reloj.
    const min = Math.floor(av.partida.estado.minuto) % (24 * 60), h = Math.floor(min / 60), mm = Math.floor(min % 60 / 10) * 10;
    this.reloj.setText(`${av.mapa.nombre}\n${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}`).setLineSpacing(-1 * S);
    // Clima activo (Danza Lluvia, Día Soleado…), con lo que le queda.
    const cl = av.clima, tq = cl ? Math.max(0, Math.ceil(cl.hasta - this.time.now / 1000)) : 0;
    this.climaG.clear();
    this.climaTxt.setVisible(!!cl);
    if (cl) {
      marco(this.climaG, VW - 4 - 74, 28, 74, 13, PANEL);
      this.climaTxt.setText(`${NOMBRE_CLIMA[cl.tipo]} · ${tq} s`);
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
    const px = ptr.x / S, py = ptr.y / S, chip = [...this.yo.zonas, ...this.obj.zonas].find(z => px >= z.x && px < z.x + z.w && py >= z.y && py < z.y + z.h);
    if (chip) this.fichaAura(chip);
    else this.pintarFicha(sobre >= 0 ? m.barra[sobre] : null, sobre);
    this.pintarPanel();
  }

  // Ficha del atajo bajo el ratón (encima de la barra).
  private pintarFicha(a: Atajo, i: number): void {
    const g = this.fichaG;
    g.clear();
    if (!a || i < 0) { this.ficha.setVisible(false); return; }
    let txt: string;
    if ('m' in a) {
      const m = getMove(a.m);
      if (!m) { this.ficha.setVisible(false); return; }
      const datos = [TIPO_ES[m.type], CATEGORIA[m.category]];
      if (m.basePower) datos.push(`Potencia ${m.basePower}`);
      datos.push(m.accuracy === true ? 'No falla' : `Precisión ${m.accuracy}`);
      txt = `${m.nombre}\n${datos.join(' · ')}\n${m.flags.includes('contact') ? 'Cuerpo a cuerpo' : necesitaObjetivo(m) ? 'A distancia' : 'Sobre ti'} · se recarga en ${enfriamiento(m)} s`;
    } else txt = `${ITEMS[a.i]?.nombre ?? a.i} (${this.av.partida.tiene(a.i)})\n${ITEMS[a.i]?.tipo === 'pokeball' ? 'Lánzala al objetivo: cuanto más débil esté, más fácil' : 'Te cura un poco'}`;
    this.ficha.setText(txt).setVisible(true);
    const w = this.ficha.width / S + 8, h = this.ficha.height / S + 6, x = Math.max(4, Math.min(VW - w - 4, BX + 4 + i * (CW + HUECO) + CW / 2 - w / 2)), y = BY - h - 3;
    marco(g, x, y, w, h, PANEL);
    this.ficha.setPosition((x + 4) * S, (y + 3) * S);
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
    const k = av.panel ? `${m.uid}|${m.movs.join()}|${JSON.stringify(av.partida.estado.items)}|${JSON.stringify(av.asignando)}` : '';
    if (k === this.panelClave) return;
    this.panelClave = k;
    this.panelObjs.forEach(o => o.destroy()); this.panelObjs = []; this.panelZonas = [];
    if (!av.panel) return;
    const items = Object.entries(av.partida.estado.items).filter(([id, n]) => n > 0 && ITEMS[id]);
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
