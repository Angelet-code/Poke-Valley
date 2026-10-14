// Galería de animaciones de movimientos (?galeria), como la de Pokémon Colleja (/animaciones): dos Pokémon en un
// claro y el movimiento elegido, una y otra vez, en la dirección elegida. Sirve para revisar cómo se ve cada
// plantilla vista desde arriba (en Colleja todo iba de izquierda a derecha).
// ← → movimiento · ↑ ↓ dirección del objetivo · espacio repetir · A todos seguidos · 1-9 distancia
import Phaser from 'phaser';
import { S, VH, VW } from '../config';
import { ancla, cargar, clave, info, poner } from '../combate/sprites';
import { getMove, TIPO_ES } from '../data/movimientos';
import datos from '../data/gen/combate.json';
import { animationFor } from '../fx/catalog';
import { playMove } from '../fx/templates';
import { TYPE_FX } from '../fx/fx/palette';
import { Stage, fxSprite, type FxSprite, type SlotGeometry } from '../fx/stage';
import type { BoostId, MoveCue } from '../fx/tipos';

interface Muñeco { x: number; y: number; dir: number; dex: string; spr: Phaser.GameObjects.Sprite; fx: FxSprite; alto: number }
const ROW = [2, 1, 0, 7, 6, 5, 4, 3];
const DIRS = [-90, -45, 0, 45, 90, 135, 180, -135];   // arriba, arriba-der., der., …

export class Galeria extends Phaser.Scene {
  stage!: Stage;
  movs: string[] = [];
  i = 0;
  angulo = 0;            // índice en DIRS
  distancia = 80;
  private yo!: Muñeco;
  private el!: Muñeco;
  private txt!: Phaser.GameObjects.Text;
  private tocando = false;
  private todos = false;

  constructor() { super('galeria'); }

  async create(): Promise<void> {
    // Uno de cada plantilla:estilo primero (los que más se diferencian), luego el resto por orden alfabético.
    const ids = Object.keys((datos as { moves: Record<string, unknown> }).moves).sort();
    const vistos = new Set<string>(), primeros: string[] = [];
    for (const id of ids) { const a = animationFor(id), k = `${a.template}:${a.style}`; if (!vistos.has(k)) { vistos.add(k); primeros.push(id); } }
    this.movs = [...primeros, ...ids.filter(id => !primeros.includes(id))];
    this.add.rectangle(0, 0, 4000, 4000, 0xa4ba7a).setOrigin(0);
    this.cameras.main.setZoom(S).centerOn(400, 300);
    await cargar(this, ['0001', '0025']);
    this.yo = this.muñeco('0001', 400, 300);
    this.el = this.muñeco('0025', 400, 220);
    this.stage = new Stage(this);
    this.stage.geometria = s => s === 'p1' ? this.geo(this.yo, 'p1') : s === 'p2' ? this.geo(this.el, 'p2') : null;
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.stage.dispose());
    // La cámara no se mueve: el rótulo va en px de mundo, arriba a la izquierda de la vista.
    this.txt = this.add.text(400 - VW / 2 + 4, 300 - VH / 2 + 4, '', { fontFamily: '"Pixelify Sans", sans-serif', fontSize: `${7 * S}px`, color: '#2a1a10', backgroundColor: '#f6e7c1', padding: { x: 6, y: 4 } })
      .setScale(1 / S).setDepth(1e6);
    const kb = this.input.keyboard!;
    kb.on('keydown-RIGHT', () => this.elegir(1));
    kb.on('keydown-LEFT', () => this.elegir(-1));
    kb.on('keydown-UP', () => { this.angulo = (this.angulo + 7) % 8; this.colocar(); });
    kb.on('keydown-DOWN', () => { this.angulo = (this.angulo + 1) % 8; this.colocar(); });
    kb.on('keydown-SPACE', () => void this.tocar());
    kb.on('keydown-A', () => { this.todos = !this.todos; if (this.todos) void this.tocar(); });
    kb.on('keydown', (e: KeyboardEvent) => { if (/^[1-9]$/.test(e.key)) { this.distancia = 30 + +e.key * 14; this.colocar(); } });
    (window as unknown as { galeria: Galeria }).galeria = this;
    this.colocar();
    void this.tocar();
  }

  private muñeco(dex: string, x: number, y: number): Muñeco {
    const h = info(dex);
    const spr = this.add.sprite(x, y, `${clave(dex)}-${h.Idle?.hoja ?? 'Idle'}`);
    poner(spr, dex, 'Idle', 0);   // origen en los pies (sprites.ts)
    this.add.ellipse(x, y - 1, ancla(dex).ancho * 0.75, ancla(dex).ancho * 0.27, 0x2c4422, 0.3);
    return { x, y, dir: 0, dex, spr, fx: fxSprite(spr), alto: Math.min(56, ancla(dex).alto) };
  }
  // El objetivo, a `distancia` px en la dirección elegida; los dos se miran.
  colocar(): void {
    const a = DIRS[this.angulo] * Math.PI / 180;
    this.el.x = this.yo.x + Math.cos(a) * this.distancia; this.el.y = this.yo.y + Math.sin(a) * this.distancia;
    const mira = (m: Muñeco, o: Muñeco) => { m.dir = ROW[(Math.round(Math.atan2(o.y - m.y, o.x - m.x) / (Math.PI / 4)) + 8) % 8]; };
    mira(this.yo, this.el); mira(this.el, this.yo);
    this.children.list.filter(o => o instanceof Phaser.GameObjects.Ellipse).forEach((e, i) => (e as Phaser.GameObjects.Ellipse).setPosition(i ? this.el.x : this.yo.x, (i ? this.el.y : this.yo.y) - 1));
    this.rotulo();
  }
  elegir(d: number): void { this.i = (this.i + d + this.movs.length) % this.movs.length; this.rotulo(); void this.tocar(); }
  private rotulo(): void {
    const id = this.movs[this.i], m = getMove(id), a = animationFor(id);
    this.txt?.setText(`${this.i + 1}/${this.movs.length}  ${m?.nombre ?? id} (${id}) · ${m ? TIPO_ES[m.type] : ''} · ${a.template}:${a.style}\n← → movimiento · ↑ ↓ dirección · 1-9 distancia · espacio repetir · A todos`);
  }
  private geo(m: Muñeco, lado: 'p1' | 'p2'): SlotGeometry {
    const k = this.stage.k;
    return { slot: lado, side: lado, center: { x: m.x * k, y: (m.y - m.alto * 0.45) * k }, feet: { x: m.x * k, y: (m.y - 2) * k }, top: { x: m.x * k, y: (m.y - m.alto) * k },
      size: Math.max(22, m.alto * 1.45) * k, sprite: m.fx };
  }
  async tocar(): Promise<void> {
    if (this.tocando || !this.stage) return;
    this.tocando = true;
    const id = this.movs[this.i], m = getMove(id), anim = animationFor(id);
    const golpe = m && m.category !== 'Status';
    const cue: MoveCue = { kind: 'move', user: 'p1', move: id, targets: ['p2'], spread: false, hits: golpe ? [{ slot: 'p2', effectiveness: 'normal', crit: false, damaged: true }] : [],
      missed: [], blocked: [], failed: false, hitCount: 1, drained: !!m?.drain, recoil: !!m?.recoil,
      boosts: [...(m?.boosts ? [{ slot: 'p2', b: m.boosts }] : []), ...(m?.selfBoosts ? [{ slot: 'p1', b: m.selfBoosts }] : [])]
        .map(x => ({ slot: x.slot, changes: Object.entries(x.b).map(([stat, amount]) => ({ stat: stat as BoostId, amount: amount as number })) })),
      statuses: m?.status ? [{ slot: 'p2', status: m.status }] : [] };
    const a = m?.category === 'Status' ? 'Charge' : m?.flags.includes('contact') ? 'Attack' : 'Shoot';
    poner(this.yo.spr, this.yo.dex, a, this.yo.dir);
    try {
      await playMove({ stage: this.stage, cue, animation: anim, palette: TYPE_FX[anim.type], user: this.geo(this.yo, 'p1'),
        targets: anim.template === 'aura' || anim.template === 'shield' ? [] : [this.geo(this.el, 'p2')], losses: new Map([['p2', 0.3]]),
        commit: () => undefined, text: { boost: (s, n) => `${n > 0 ? '+' : ''}${n} ${s}`, status: s => s } });
    } catch (e) { console.warn(id, e); }
    await this.stage.wait(500);
    this.tocando = false;
    if (this.todos) this.elegir(1);
  }

  update(t: number, dt: number): void {
    if (!this.stage) return;
    for (const m of [this.yo, this.el]) {
      const k = this.stage.k, f = m.fx;
      if (!m.spr.anims.isPlaying) poner(m.spr, m.dex, 'Idle', m.dir);
      m.spr.setPosition(m.x + f.dx / k, m.y + f.dy / k).setScale(f.sx, f.sy).setAngle(f.rot).setAlpha(f.alpha).setDepth(m.y);
      if (f.flash > 0.5) m.spr.setTintFill(0xffffff); else m.spr.clearTint();
    }
    this.stage.actualizar(t, dt);
  }
}

