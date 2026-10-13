// Escena del valle: dibuja el terreno (Terrain), árboles, rocas, edificios, recolectables y
// plantas de bayas a partir del estado de la simulación (World), y traduce la entrada en
// comandos. Toda la lógica de juego vive en sim/World.ts.
import Phaser from 'phaser';
import { DIR_VEC, NUEVA, REG, ROW_FROM_ANGLE, S, VH, VW } from '../config';
import { ITEMS } from '../data/items';
import type { MapData, ObjCatalog } from '../data/types';
import { Terrain, T, screenTex } from '../render/Terrain';
import { World, type Casilla, type Evento, type Planta } from '../sim/World';
import { TREE_N, ROCK_N } from './Preload';
import { hash } from '../util';

const TREE_H = 58, TREE_BASE_X = [129, 133, 105, 129], TREE_HIT = 6, ROCK_H = 32;
const VEL = 84;                 // px de mundo por segundo
const ALCANCE = 2.5 * T;        // alcance del Látigo Cepa y de recoger (desde los pies)
const PASO_ANIM_BAYA = 600;     // ms entre los 2 fotogramas de las plantas

interface Circulo { x: number; y: number; r: number }
interface Bloque { x: number; y: number; w: number; h: number }
interface Interactivo { x: number; y: number; r: number; tipo: 'caja' | 'cama' }

export class WorldScene extends Phaser.Scene {
  terrain!: Terrain;
  sim!: World;
  player!: Phaser.GameObjects.Sprite & { dir: number };
  private shadow!: Phaser.GameObjects.Ellipse;
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;
  private trees: Circulo[] = [];
  private blocks: Bloque[] = [];
  private interactivos: Interactivo[] = [];
  private objSprites = new Map<number, Phaser.GameObjects.Image>();
  private plantaSprites = new Map<number, { img: Phaser.GameObjects.Image; fase: number }>();
  private objs!: ObjCatalog;
  private hover!: Phaser.GameObjects.Ellipse;   // realce suave bajo lo que se puede recoger o cosechar
  private targetTile: [number, number] = [0, 0];
  private overview = false;
  private durmiendo = false;
  slot = 0;                       // casilla del inventario elegida (la lee la UI)
  private tAnim = 0;

  constructor() { super('world'); }

  create(data: { nueva?: boolean }): void {
    const map = this.registry.get(REG.mapa) as MapData;
    this.objs = this.registry.get(REG.objs) as ObjCatalog;
    this.terrain = new Terrain(map, S);
    const tr = this.terrain, { W, H } = tr;

    this.crearArbolesYRocas(map);
    this.crearEstaticos(map);

    // Casillas candidatas para recolectables y plantas: césped puro, libre y lejos de todo.
    const candidatos: Casilla[] = [];
    for (let ty = 1; ty < tr.MH - 1; ty++) for (let tx = 1; tx < tr.MW - 1; tx++) {
      const cx = tx * T + T / 2, cy = ty * T + T / 2;
      if (!tr.esCespedPuro(tx, ty) || tr.nearWater(cx, cy, 20) || tr.enCamino(cx, cy)) continue;
      if (this.trees.some(t => Math.hypot(cx - t.x, cy - t.y) < t.r + 16)) continue;
      if (this.blocks.some(b => cx > b.x - b.w / 2 - 14 && cx < b.x + b.w / 2 + 14 && cy > b.y - b.h - 14 && cy < b.y + 14)) continue;
      candidatos.push({ tx, ty });
    }
    const itemsMapa = (map.objetos ?? []).filter(o => this.objs[o.id]?.tipo === 'item').map(o => ({ id: o.id, tx: Math.floor(o.x / T), ty: Math.floor(o.y / T) }));
    const guardada = data.nueva || NUEVA ? null : World.cargar(candidatos);
    this.sim = guardada ?? World.nueva(candidatos, itemsMapa);
    if (!guardada) this.sim.guardar();
    // La tierra arada guardada se pinta en el terreno antes del primer dibujado.
    for (const k of this.sim.estado.aradas) { const [tx, ty] = k.split(',').map(Number); tr.arar(tx, ty, false); }
    for (const k of this.casillasHumedas()) tr.regadas.add(k);
    tr.build(this);

    // Bulbasaur.
    const [px0, py0] = map.inicio ?? [W / 2, H / 2];
    this.player = Object.assign(this.add.sprite(px0, py0, 'b-Idle').setOrigin(0.5, 0.72), { dir: 0 });
    this.shadow = this.add.ellipse(0, 0, 16, 6, 0x2c4422, 0.3);
    const cam = this.cameras.main;
    cam.setZoom(S).setBounds(0, 0, W, H).startFollow(this.player, true, 1, 1).setRoundPixels(true);

    this.hover = this.add.ellipse(0, 0, 18, 7, 0xffffff, 0.28).setVisible(false);

    this.keys = this.input.keyboard!.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT,F,SPACE,Q,E,M,ESC,TAB') as Record<string, Phaser.Input.Keyboard.Key>;
    this.keys.SPACE.on('down', () => this.interactuar());
    this.keys.M.on('down', () => this.toggleOverview());
    this.keys.ESC.on('down', () => { this.sim.guardar(); this.scene.stop('ui'); this.scene.start('title'); });
    this.keys.F.on('down', () => this.interactuar());
    this.keys.Q.on('down', () => this.elegirSlot(-1));
    this.keys.E.on('down', () => this.elegirSlot(1));
    this.input.on('wheel', (_p: unknown, _o: unknown, _dx: number, dy: number) => this.elegirSlot(dy > 0 ? 1 : -1));
    this.input.mouse!.disableContextMenu();
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (this.durmiendo || this.overview) return;
      if (p.rightButtonDown()) this.interactuar(); else this.accion();
    });

    this.scene.launch('ui');
    this.sincronizar();
    this.aviso(guardada ? `Día ${this.sim.estado.dia}${this.sim.estado.lluvia ? ' · llueve' : ''}` : 'Recoge ramas, piedras y bayas (F). Látigo Cepa: clic izquierdo.');
  }

  // ---- Construcción del escenario ----
  private crearArbolesYRocas(map: MapData): void {
    const tr = this.terrain, sc = tr.W / 1024;
    for (const a of map.arboles ?? []) {
      const x = Math.round(a.x), y = Math.round(a.y);
      const k = Phaser.Math.Clamp(a.k ?? Math.floor(hash(x, y) * TREE_N), 0, TREE_N - 1), h = a.h ?? TREE_H * (0.9 + 0.2 * hash(y, x));
      const src = this.textures.get('arbol' + k).getSourceImage() as HTMLImageElement, key = screenTex(this, 'arbol' + k, Math.round(h * S));
      this.add.ellipse(x + h * 0.18, y - h * 0.08, h * 0.75, h * 0.32, 0x2c4422, 0.28).setDepth(y - 2);
      this.add.image(x, y, key).setOrigin(TREE_BASE_X[k] / src.width, 1).setScale(1 / S).setDepth(y);
      this.trees.push({ x, y, r: TREE_HIT + 4 });
    }
    for (const a of map.rocas ?? []) {
      const x = Math.round(a.x), y = Math.round(a.y);
      const k = Phaser.Math.Clamp(a.k ?? Math.floor(hash(x * 1.3, y) * ROCK_N), 0, ROCK_N - 1);
      const s = a.s ?? 0.5 + 0.1 * Math.floor(hash(y, x * 0.7) * 6), h = ROCK_H * s;
      const key = screenTex(this, 'roca' + k, Math.round(h * S)), wd = (this.textures.get(key).getSourceImage() as HTMLCanvasElement).width / S;
      this.add.ellipse(x + h * 0.08, y - h * 0.06, wd * 1.05, h * 0.3, 0x2c4422, 0.25).setDepth(y - 2);
      this.add.image(x, y, key).setOrigin(0.5, 0.95).setScale(1 / S).setDepth(y).setFlipX(hash(x, y * 2.3) < 0.5);
      this.trees.push({ x, y: y - h * 0.2, r: wd * 0.42 });
    }
    void sc;
  }

  // Estaciones y edificios del mapa (los items del mapa pasan a la simulación).
  private crearEstaticos(map: MapData): void {
    for (const o of map.objetos ?? []) {
      const def = this.objs[o.id];
      if (!def || def.tipo === 'item' || !this.textures.exists('obj_' + o.id)) continue;
      const src = this.textures.get('obj_' + o.id).getSourceImage() as HTMLImageElement, [ax, ay] = def.ancla;
      const fw = Math.max(src.width, def.colision[0]);
      this.add.ellipse(o.x + fw * 0.04, o.y - fw * 0.05, fw * 1.05, fw * 0.22, 0x2c4422, 0.25).setDepth(o.y - 2);
      this.add.image(o.x, o.y, 'obj_' + o.id).setOrigin(ax / src.width, ay / src.height).setDepth(o.y);
      const [w, h] = def.colision;
      if (w > 0 && h > 0) this.blocks.push({ x: o.x, y: o.y, w, h });
      // Interacciones: la casa es la cama (dormir); la mesa de trabajo hace de caja de envío
      // provisional hasta que exista el sprite de la caja de Pelipper.
      if (o.id === 'casa') this.interactivos.push({ x: o.x, y: o.y + 6, r: 26, tipo: 'cama' });
      if (o.id === 'mesa_trabajo') this.interactivos.push({ x: o.x, y: o.y + 4, r: 34, tipo: 'caja' });
    }
  }

  // Tierra que se ve mojada: solo bajo las semillas regadas (fase 1). En cuanto la planta brota,
  // el suelo vuelve a su color (decisión del usuario, 2026-10-13).
  private casillasHumedas(): string[] {
    const e = this.sim.estado;
    return e.plantas.filter(p => p.fase === 1 && e.regadas.includes(`${p.tx},${p.ty}`)).map(p => `${p.tx},${p.ty}`);
  }

  // ---- Sincronía estado → sprites ----
  private sincronizar(): void {
    const e = this.sim.estado;
    // Humedad del suelo: se añade o se seca según el estado.
    const humedas = new Set(this.casillasHumedas());
    const secar = [...this.terrain.regadas].filter(k => !humedas.has(k)), mojar = [...humedas].filter(k => !this.terrain.regadas.has(k));
    if (secar.length) this.terrain.regar(secar, false);
    if (mojar.length) this.terrain.regar(mojar);
    // Recolectables del suelo.
    const vivos = new Set<number>();
    for (const it of e.suelo) {
      vivos.add(it.uid);
      if (this.objSprites.has(it.uid)) continue;
      const def = this.objs[it.id];
      if (!def || !this.textures.exists('obj_' + it.id)) continue;
      const src = this.textures.get('obj_' + it.id).getSourceImage() as HTMLImageElement, [ax, ay] = def.ancla;
      const x = it.tx * T + T / 2, y = it.ty * T + T - 2;
      this.objSprites.set(it.uid, this.add.image(x, y, 'obj_' + it.id).setOrigin(ax / src.width, ay / src.height).setDepth(y));
    }
    for (const [uid, img] of this.objSprites) if (!vivos.has(uid)) { img.destroy(); this.objSprites.delete(uid); }
    // Plantas.
    const vivas = new Set<number>();
    for (const p of e.plantas) {
      vivas.add(p.uid);
      const s = this.plantaSprites.get(p.uid);
      if (s && s.fase === p.fase) continue;
      s?.img.destroy();
      this.plantaSprites.set(p.uid, { img: this.crearPlanta(p), fase: p.fase });
    }
    for (const [uid, s] of this.plantaSprites) if (!vivas.has(uid)) { s.img.destroy(); this.plantaSprites.delete(uid); }
  }

  private crearPlanta(p: Planta): Phaser.GameObjects.Image {
    const x = p.tx * T + T / 2;
    if (p.fase === 1) return this.add.image(x, p.ty * T + 22, 'baya_tierra').setOrigin(0.5, 1).setDepth(p.ty * T + 20);
    if (p.fase === 2) return this.add.image(x, p.ty * T + 20, 'baya_brote', 0).setOrigin(0.5, 1).setDepth(p.ty * T + 20);
    const key = this.textures.exists('baya_' + p.baya) ? 'baya_' + p.baya : 'baya_oran';
    return this.add.image(x, p.ty * T + 20, key, (p.fase - 3) * 2).setOrigin(0.5, 1).setDepth(p.ty * T + 20);
  }

  // ---- Entrada ----
  private elegirSlot(d: number): void {
    const n = this.sim.estado.inventario.length;
    this.slot = (this.slot + d + n) % n;
  }

  private enBloque(x: number, y: number): boolean {
    return this.blocks.some(b => x >= b.x - b.w / 2 && x <= b.x + b.w / 2 && y >= b.y - b.h && y <= b.y);
  }
  private bloqueado(x: number, y: number): boolean {
    const p = this.player;
    return this.terrain.esAgua(x, y) || this.trees.some(t => Math.hypot(x - t.x, (y - t.y) * 1.6) < t.r)
      || (this.enBloque(x, y) && !this.enBloque(p.x, p.y));
  }

  // Casilla objetivo: la del cursor si está al alcance; si no, la de delante del Pokémon.
  private calcularObjetivo(): void {
    const p = this.player, ptr = this.input.activePointer;
    let tx = Math.floor(ptr.worldX / T), ty = Math.floor(ptr.worldY / T);
    if (Math.hypot(tx * T + T / 2 - p.x, ty * T + T / 2 - p.y) > ALCANCE) {
      const [dx, dy] = DIR_VEC[p.dir];
      tx = Math.floor((p.x + dx * T) / T); ty = Math.floor((p.y + dy * T) / T);
    }
    tx = Phaser.Math.Clamp(tx, 0, this.terrain.MW - 1); ty = Phaser.Math.Clamp(ty, 0, this.terrain.MH - 1);
    this.targetTile = [tx, ty];
    // Realce: un óvalo suave bajo el recolectable o la planta madura de la casilla objetivo.
    const e = this.sim.estado;
    const it = e.suelo.find(i => i.tx === tx && i.ty === ty), pl = e.plantas.find(q => q.tx === tx && q.ty === ty && q.fase === 5);
    if (it || pl) this.hover.setVisible(true).setPosition(tx * T + T / 2, ty * T + (it ? T - 3 : T - 5)).setDepth(ty * T + (it ? T - 2 : 20) - 1);
    else this.hover.setVisible(false);
  }

  // Clic izquierdo: Látigo Cepa sobre la casilla objetivo (cosechar bayas maduras).
  private accion(): void {
    const [tx, ty] = this.targetTile;
    this.procesar(this.sim.latigo(tx, ty));
  }

  // Sembrar la baya elegida en la casilla objetivo: sobre tierra, o sobre césped libre (que
  // pasa a ser tierra bajo la semilla).
  private sembrar(): Evento[] {
    const [tx, ty] = this.targetTile, s = this.sim.estado.inventario[this.slot];
    if (!s || ITEMS[s.id]?.tipo !== 'baya') return [];
    const cx = tx * T + T / 2, cy = ty * T + T / 2;
    const libre = !this.terrain.nearWater(cx, cy, 14) && !this.enBloque(cx, cy) && !this.terrain.enCamino(cx, cy)
      && !this.trees.some(t => Math.hypot(cx - t.x, cy - t.y) < t.r + 10);
    const esTierra = libre && this.terrain.esTierraPura(tx, ty);
    const puedeArar = libre && !esTierra && this.terrain.esArable(tx, ty);
    return this.sim.plantar(tx, ty, this.slot, esTierra, puedeArar);
  }

  // F / espacio / clic derecho: recoger lo que haya al alcance; si no, caja de envío o cama;
  // si no, sembrar la baya elegida.
  private interactuar(): void {
    if (this.durmiendo || this.overview) return;
    const p = this.player, e = this.sim.estado, [tx, ty] = this.targetTile;
    const dist = (it: { tx: number; ty: number }) => Math.hypot(it.tx * T + T / 2 - p.x, it.ty * T + T / 2 - p.y);
    const enObjetivo = e.suelo.find(it => it.tx === tx && it.ty === ty && dist(it) < ALCANCE);
    const cerca = e.suelo.map(it => ({ it, d: dist(it) })).filter(o => o.d < ALCANCE).sort((a, b) => a.d - b.d)[0]?.it;
    const item = enObjetivo ?? cerca;
    if (item) { this.procesar(this.sim.recoger(item.uid)); return; }
    const zona = this.interactivos.find(z => Math.hypot(z.x - p.x, z.y - p.y) < z.r);
    if (!zona) { this.procesar(this.sembrar()); return; }
    if (zona.tipo === 'caja') {
      const ev = this.sim.enviar(this.slot);
      if (!ev.length) this.aviso(`Caja de envío: ${this.sim.valorCaja} $ para esta noche. Elige algo con Q/E y pulsa F para meterlo.`);
      this.procesar(ev);
    } else this.dormir(false);
  }

  private procesar(evs: Evento[]): void {
    for (const ev of evs) {
      switch (ev.tipo) {
        case 'recogido': this.aviso(`${ITEMS[ev.id]?.nombre ?? ev.id} +${ev.n}`); break;
        case 'cosecha': this.aviso(`${ITEMS[ev.baya]?.nombre ?? ev.baya} +${ev.n}`); break;
        case 'inventarioLleno': this.aviso('Inventario lleno'); break;
        case 'sinEnergia': this.aviso('Sin energía: ve a dormir'); break;
        case 'arado': this.terrain.arar(ev.tx, ev.ty); break;
        case 'regado': break; // la humedad se repinta en sincronizar()
        case 'plantado': this.aviso(`Has plantado ${ITEMS[ev.baya]?.nombre ?? ev.baya}`); break;
        case 'enviado': this.aviso(`${ITEMS[ev.id]?.nombre ?? ev.id} ×${ev.n} a la caja (${this.sim.valorCaja} $)`); break;
        case 'nuevoDia': this.resumenDia(ev); break;
      }
    }
    if (evs.length) this.sincronizar();
  }

  aviso(txt: string): void { this.events.emit('aviso', txt); }

  // Dormir (o desmayo a las 2:00): fundido, nuevo día, resumen.
  private dormir(desmayo: boolean): void {
    if (this.durmiendo) return;
    this.durmiendo = true;
    this.player.play('b-Sleep');
    this.cameras.main.fadeOut(600, 0, 0, 0);
    this.time.delayedCall(700, () => {
      const ev = desmayo ? [] : [this.sim.dormir(false)];
      this.procesar(ev);
      this.sincronizar();
      this.cameras.main.fadeIn(600, 0, 0, 0);
      this.durmiendo = false;
    });
  }
  private resumenDia(ev: Extract<Evento, { tipo: 'nuevoDia' }>): void {
    const partes = [`Día ${ev.dia}`];
    if (ev.lluvia) partes.push('llueve: la tierra amanece regada');
    if (ev.ingresos) partes.push(`Pelipper trajo ${ev.ingresos} $`);
    if (ev.desmayo) partes.push('te desmayaste a las 2:00 (−10 % del dinero)');
    this.aviso(partes.join(' · '));
  }

  private toggleOverview(): void {
    const cam = this.cameras.main, { W, H } = this.terrain;
    this.overview = !this.overview;
    if (this.overview) cam.stopFollow().removeBounds().setZoom(Math.min(VW * S / W, VH * S / H)).centerOn(W / 2, H / 2);
    else cam.setZoom(S).setBounds(0, 0, W, H).startFollow(this.player, true, 1, 1);
  }

  update(_t: number, dtMs: number): void {
    const p = this.player, k = this.keys, dt = dtMs / 1000;
    if (!this.durmiendo) {
      const evs = this.sim.tick(dt);
      if (evs.length) { // desmayo
        this.durmiendo = true;
        this.cameras.main.fadeOut(600, 0, 0, 0);
        this.time.delayedCall(700, () => { this.procesar(evs); this.cameras.main.fadeIn(600, 0, 0, 0); this.durmiendo = false; });
      }
    }
    let vx = 0, vy = 0;
    if (!this.durmiendo && !this.overview) {
      vx = +(k.D.isDown || k.RIGHT.isDown) - +(k.A.isDown || k.LEFT.isDown);
      vy = +(k.S.isDown || k.DOWN.isDown) - +(k.W.isDown || k.UP.isDown);
    }
    if (vx || vy) {
      const len = Math.hypot(vx, vy), sp = VEL * dt, { W, H } = this.terrain;
      const nx = Phaser.Math.Clamp(p.x + vx / len * sp, 8, W - 8), ny = Phaser.Math.Clamp(p.y + vy / len * sp, 12, H - 2);
      if (!this.bloqueado(nx, p.y)) p.x = nx;
      if (!this.bloqueado(p.x, ny)) p.y = ny;
      p.dir = ROW_FROM_ANGLE[(Math.round(Math.atan2(vy, vx) / (Math.PI / 4)) + 8) % 8];
    }
    if (!this.durmiendo) {
      const key = `b-${vx || vy ? 'Walk' : 'Idle'}-${p.dir}`;
      if (p.anims.currentAnim?.key !== key) p.play(key, true);
    }
    p.setDepth(p.y); this.shadow.setPosition(p.x, p.y - 3).setDepth(p.y - 1);
    this.calcularObjetivo();
    if (this.overview || this.durmiendo) this.hover.setVisible(false);
    // Vaivén de 2 fotogramas de las plantas.
    this.tAnim += dtMs;
    const f2 = Math.floor(this.tAnim / PASO_ANIM_BAYA) % 2;
    for (const s of this.plantaSprites.values()) {
      if (s.fase === 2) s.img.setFrame(f2);
      else if (s.fase >= 3) s.img.setFrame((s.fase - 3) * 2 + f2);
    }
  }
}
