// El valle en estilo dibujo: suelo de Terrain.ts (con la paleta y las texturas de este estilo),
// elementos sacados del dibujo (casas, árboles, rocas, suelo de piedras, estanque, detalles) y
// Bulbasaur (pixel art PMD, a escala nativa) moviéndose entre ellos con colisiones y orden por y.
import Phaser from 'phaser';
import { Terrain, screenTex } from '../../../src/render/Terrain';
import type { Paleta } from '../../../src/render/TerrainCore';
import { pipelineCel } from '../../../src/render/CelPipeline';
import { TIPOS_LUZ, animarLuz, type TipoLuz } from '../../../src/render/luces';
import { A, F, KLEIN, L, LUCES, NOCHE, PNG_X, ROW_FROM_ANGLE, S, SET, SUSTITUTOS, T, VECTOR, VEL, VH, VW, type AnimSet, type Elemento, type Elementos } from '../config';
import { EXTRA, FAROLAS } from '../mapa';
import { FIJOS, H, W, detalles, terreno, type Colocado } from '../mapa';

// Colores del suelo medidos en el dibujo (césped 172,188,124; arena 220,196,124; mar 87,180,185).
const PALETA_DIBUJO: Paleta = {
  grassTones: [[164, 186, 122], [178, 196, 134]], dirtTones: [[212, 190, 116], [228, 206, 134]],  // el dibujo es casi liso (p50 170,191,128 / 220,197,122)
  stone: [214, 206, 170], stoneLight: [232, 226, 192], crack: [178, 158, 124], dirtMean: [218, 194, 126],
  water: [87, 180, 185], waterTones: [[70, 164, 176], [110, 196, 200]], waterShadow: [62, 142, 160], shoreDark: [62, 84, 64], shoreLight: [214, 204, 140],
};

interface Bloque { x0: number; y0: number; x1: number; y1: number; rombo?: boolean } // rombo: superelipse (estanque)
const SOMBRA_ALFA = NOCHE ? 0.2 : 0.45, SOMBRA_COLOR = [40, 56, 40];   // como la capa <id>_sombra.png (de noche, apenas)
// Noche: luz ambiente (azul oscuro), farolas (cálidas) y hoguera (naranja, parpadea más). Radios en px de mundo.
const AMBIENTE_NOCHE = 0x2a3350;
interface Luz { luz: Phaser.GameObjects.Light; halo: Phaser.GameObjects.Image; tipo: TipoLuz; fase: number }
// Pokémon de noche: hoja `-Luz.png` (contorno teñido, el negro puro no se ilumina) con su mapa de normales.
const PRE = NOCHE ? 'bn' : 'b';
interface Sombra { id: string; x: number; y: number; w: number; h: number; k: number; flip: boolean } // capa colocada (mundo)
interface Jugador extends Phaser.GameObjects.Sprite { dir: number }

export class LabScene extends Phaser.Scene {
  private terrain!: Terrain;
  private catalogo = new Map<string, Elemento>();
  private vectores = new Set<string>();   // ids con SVG (solo se usan con ?vector=1)
  private bloques: Bloque[] = [];
  private player!: Jugador;
  private sombra!: Phaser.GameObjects.Ellipse;
  private copiaSombra!: Phaser.GameObjects.Sprite;   // silueta del jugador en multiply: su parte a la sombra
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;
  private overview = false;
  private listo = false;
  private cargando?: Phaser.GameObjects.Text;
  private luces: Luz[] = [];

  constructor() { super('lab'); }

  preload(): void {
    const txt = this.cargando = this.add.text(VW * S / 2, VH * S / 2, 'Preparando el valle…', { fontFamily: 'system-ui, sans-serif', fontSize: `${7 * S}px`, color: '#e4ecd8' }).setOrigin(0.5);
    this.load.on('progress', (p: number) => txt.setText(`Preparando el valle… ${Math.round(p * 100)} %`));
    this.load.on('loaderror', (f: Phaser.Loader.File) => console.warn('No se pudo cargar', f.key, f.url));
    Terrain.preload(this, A, { cesped: `${L}suelo/cesped_ref.png`, tierra: `${L}suelo/tierra_ref.png`, decals: false });
    const cat = this.registry.get('elementos') as Elementos;
    this.vectores = new Set(VECTOR ? (this.registry.get('vectores') as string[]) : []);
    for (const el of cat.elementos) {
      this.catalogo.set(el.id, el);
      // SVG rasterizado por el navegador justo al tamaño de pantalla (ancho del SVG = ancho del PNG).
      const dir = el.dir ?? 'elementos', vdir = dir === 'elementos' ? '' : dir + '/';
      if (el.sombra) this.load.image('so_' + el.id, L + dir + '/' + el.sombra.archivo);
      if (this.vectores.has(el.id)) { this.load.svg('el_' + el.id, L + 'vector/' + vdir + el.id + '.svg', { scale: F / PNG_X * S * (el.k ?? 1) }); continue; }
      this.load.image('el_' + el.id, L + dir + '/' + el.archivo);
    }
    const anims = this.registry.get('anims') as AnimSet;
    for (const name of ['Walk', 'Idle']) {
      const frameConfig = { frameWidth: anims[name].fw, frameHeight: anims[name].fh }, ruta = `${A}sprites/pokemon/0001/${name}`;
      if (NOCHE) this.load.spritesheet({ key: 'bn-' + name, url: `${ruta}-Luz.png`, normalMap: `${ruta}-Normal.png`, frameConfig });
      else this.load.spritesheet('b-' + name, `${ruta}-Anim.png`, frameConfig);
    }
  }

  create(): void {
    this.listo = false; this.bloques = []; this.sombras = []; this.dibujos = []; this.luces = []; this.overview = false;
    this.cargando?.destroy();
    // Pixel art solo en el Pokémon: filtro NEAREST para esas texturas; el resto va suave (LINEAR).
    for (const name of ['Walk', 'Idle']) this.textures.get(PRE + '-' + name).setFilter(Phaser.Textures.FilterMode.NEAREST);
    if (NOCHE) { this.lights.enable().setAmbientColor(AMBIENTE_NOCHE); const cel = pipelineCel(this); cel.altura = 0.5; cel.bandas = 3; cel.suave = 0.5; cel.ganancia = 0.55; }
    const anims = this.registry.get('anims') as AnimSet;
    for (let r = 0; r < 8; r++) {
      const w = anims.Walk, i = anims.Idle;
      if (!this.anims.exists(`${PRE}-Walk-${r}`)) this.anims.create({ key: `${PRE}-Walk-${r}`, repeat: -1, frames: w.durs.map((d, k) => ({ key: PRE + '-Walk', frame: r * w.durs.length + k, duration: d * 1000 / 60 })) });
      if (!this.anims.exists(`${PRE}-Idle-${r}`)) this.anims.create({ key: `${PRE}-Idle-${r}`, frames: [{ key: PRE + '-Idle', frame: r * i.durs.length }] });
    }
    const espera = this.add.text(VW * S / 2, VH * S / 2, 'Pintando el suelo…', { fontFamily: 'system-ui, sans-serif', fontSize: `${7 * S}px`, color: '#e4ecd8' }).setOrigin(0.5);
    this.montar().catch(e => console.error(e)).finally(() => espera.destroy());
  }

  private async montar(): Promise<void> {
    const mapa = terreno();
    this.terrain = new Terrain(mapa, S, { paleta: PALETA_DIBUJO, decals: false });
    await this.terrain.calcular(this);
    const suelo = this.terrain.build(this);
    if (NOCHE) suelo.setPipeline('Light2D');

    // Elementos grandes primero (sus huellas bloquean el paso y los detalles no se ponen encima).
    if (LUCES) this.filaDeLuces();
    else {
      for (const c of FIJOS) this.colocar(KLEIN && SUSTITUTOS[c.id] ? { ...c, id: SUSTITUTOS[c.id].id, s: (c.s ?? 1) * SUSTITUTOS[c.id].s } : c);
      for (const c of EXTRA[SET] ?? []) this.colocar(c);
      if (this.catalogo.has('farola')) for (const c of FAROLAS) this.colocar(c);
    }
    const ids = [...this.catalogo.values()].filter(e => e.tipo === 'detalle').map(e => e.id); // flores y matitas (las losas sueltas solo en el suelo de piedras)
    const libre = (x: number, y: number) => !this.bloques.some(b => x > b.x0 - 12 && x < b.x1 + 12 && y > b.y0 - 40 && y < b.y1 + 12) && !this.enDibujo(x, y);
    if (!LUCES) for (const c of detalles(ids, libre)) this.colocar(c);

    const [px0, py0] = LUCES ? [W / 2, 430] : mapa.inicio!;
    this.player = Object.assign(this.add.sprite(px0, py0, PRE + '-Idle').setOrigin(0.5, 0.72), { dir: 0 });
    if (NOCHE) this.player.setPipeline('Cel');
    this.sombra = this.add.ellipse(0, 0, 16, 6, 0x2c4422, 0.3);
    const [r, g, b] = SOMBRA_COLOR;
    this.copiaSombra = this.add.sprite(px0, py0, PRE + '-Idle').setOrigin(0.5, 0.72).setTintFill((r << 16) | (g << 8) | b)
      .setAlpha(SOMBRA_ALFA).setBlendMode(Phaser.BlendModes.MULTIPLY).setVisible(false);
    const cam = this.cameras.main;
    cam.setZoom(S).setBounds(0, 0, W, H).startFollow(this.player, true, 1, 1).setRoundPixels(true);

    this.keys = this.input.keyboard!.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT,M') as Record<string, Phaser.Input.Keyboard.Key>;
    this.keys.M.on('down', () => this.toggleOverview());
    const hud = document.getElementById('hud');
    if (hud) hud.textContent = `Lab · estilo dibujo   WASD/flechas: mover · M: mapa entero   zoom ${S} · escala ${F} · ${VECTOR ? 'vector' : 'png'} · ${SET || 'original'}${KLEIN ? ' · klein' : ''}${NOCHE ? ` · noche (${this.luces.length} luces)` : ''}${LUCES ? ' · banco de luces: ' + Object.keys(TIPOS_LUZ).join(', ') : ''}`;
    this.listo = true;
  }

  // Dibuja un elemento a su tamaño de mundo (px del PNG / PNG_X × F), reducido de antemano al tamaño
  // exacto en pantalla (screenTex: reducción a mitades, nítida) y ordenado por la y de su base.
  private colocar(c: Colocado): void {
    const el = this.catalogo.get(c.id);
    if (!el) { console.warn('elemento desconocido', c.id); return; }
    const k = F / PNG_X * (c.s ?? 1) * (el.k ?? 1), hM = el.h * k;
    const key = screenTex(this, 'el_' + el.id, Math.max(1, Math.round(hM * S)));
    const [ax, ay] = el.ancla, suelo = el.tipo === 'piedras' || el.tipo === 'losa' || el.tipo === 'detalle';
    // Orden por la base del cuerpo (la huella), no por el borde del parche de hierba: quien está en el
    // parche, delante de la pared, se dibuja encima. El estanque es bajo y no se puede pisar: va a ras de
    // suelo (quien pasa a su lado se dibuja siempre encima; por el norte no llega a solaparlo).
    const base = el.huella ? c.y + (el.huella[3] - ay) * k : c.y;
    const plano = suelo || el.tipo === 'estanque';
    const img = this.add.image(c.x, c.y, key).setOrigin(ax / el.w, ay / el.h).setScale(1 / S).setFlipX(!!c.flip).setDepth(plano ? -9000 + c.y : base);
    if (NOCHE) {
      img.setPipeline('Light2D');
      // Luz propia: el farol de la farola (arriba del todo) y las llamas de la hoguera.
      const tipo = TIPOS_LUZ[c.luz ?? (el.id === 'hoguera' ? 'hoguera' : 'farol')];
      if (el.id === 'farola') this.encender(c.x, c.y - hM * 0.82, tipo, base + 1);
      else if (el.id === 'farola_madera') this.encender(c.x + (c.flip ? -1 : 1) * hM * 0.17, c.y - hM * 0.74, tipo, base + 1); // farolillo colgado del brazo
      else if (el.id === 'hoguera') this.encender(c.x, c.y - hM * 0.45, tipo, base + 1);
    }
    if (el.sombra) {
      // Sombra proyectada (máscara de Klein): multiply con opacidad sobre el suelo. Al Pokémon no lo tapa:
      // si tiene los pies dentro se le tiñe entero (update), para que quede a la sombra también donde su
      // sprite se superpone a la pared.
      const so = el.sombra, keyS = screenTex(this, 'so_' + el.id, Math.max(1, Math.round(so.h * k * S)));
      const sx = c.flip ? c.x + (ax - so.dx - so.w) * k : c.x + (so.dx - ax) * k, sy = c.y + (so.dy - ay) * k;
      this.add.image(sx, sy, keyS).setOrigin(0, 0).setScale(1 / S).setFlipX(!!c.flip).setAlpha(SOMBRA_ALFA)
        .setBlendMode(Phaser.BlendModes.MULTIPLY).setDepth(-8000 + sy + so.h * k);
      this.sombras.push({ id: el.id, x: sx, y: sy, w: so.w, h: so.h, k, flip: !!c.flip });
    }
    if (el.huella) {
      let [hx0, hy0, hx1, hy1] = el.huella;
      if (c.flip) [hx0, hx1] = [el.w - hx1, el.w - hx0];
      this.bloques.push({ x0: c.x + (hx0 - ax) * k, y0: c.y + (hy0 - ay) * k, x1: c.x + (hx1 - ax) * k, y1: c.y + (hy1 - ay) * k, rombo: el.tipo === 'estanque' });
    }
    if (!suelo) this.dibujos.push({ x0: c.x - ax * k, y0: c.y - ay * k, x1: c.x + (el.w - ax) * k, y1: c.y + (el.h - ay) * k });
  }
  private dibujos: Bloque[] = [];
  private sombras: Sombra[] = [];
  // Una luz Light2D más su halo (degradado radial en ADD, muy tenue): el brillo del farol que se ve de noche.
  // Banco de pruebas (?luces=1): una farola por tipo de luz, en fila, con su nombre encima.
  private filaDeLuces(): void {
    const claves = Object.keys(TIPOS_LUZ), paso = 92, x0 = W / 2 - (claves.length - 1) * paso / 2, y = 400;
    claves.forEach((luz, i) => {
      const x = Math.round(x0 + i * paso);
      this.colocar({ id: 'farola', x, y, luz });
      const t = this.add.text(x, y - 66, TIPOS_LUZ[luz].nombre, { fontFamily: 'system-ui, sans-serif', fontSize: `${6 * S}px`, color: '#f0eadc', stroke: '#000', strokeThickness: S })
        .setOrigin(0.5, 1).setScale(1 / S).setDepth(100000);
      t.texture.setFilter(Phaser.Textures.FilterMode.LINEAR);
    });
  }
  private encender(x: number, y: number, tipo: TipoLuz, depth: number): void {
    if (!this.textures.exists('halo')) {
      const n = 64, c = this.textures.createCanvas('halo', n, n)!, g = c.getContext(), grad = g.createRadialGradient(n / 2, n / 2, 0, n / 2, n / 2, n / 2);
      grad.addColorStop(0, 'rgba(255,255,255,0.9)'); grad.addColorStop(0.35, 'rgba(255,255,255,0.35)'); grad.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = grad; g.fillRect(0, 0, n, n); c.refresh();
    }
    const luz = Object.assign(this.lights.addLight(x, y, tipo.radio, tipo.color, tipo.intensidad), { cel: tipo }); // `cel`: lo lee CelPipeline.onRender
    const halo = this.add.image(x, y, 'halo').setDisplaySize(tipo.radio * 0.5, tipo.radio * 0.5).setTint(tipo.color).setAlpha(tipo.halo)
      .setBlendMode(Phaser.BlendModes.ADD).setDepth(depth);
    this.luces.push({ luz, halo, tipo, fase: Math.random() * 100 });
  }
  // Cuánta sombra hay en un punto del mundo (0-1): alfa de la máscara de la capa que lo cubre.
  private sombraEn(x: number, y: number): number {
    let s = 0;
    for (const so of this.sombras) {
      if (x < so.x || y < so.y || x >= so.x + so.w * so.k || y >= so.y + so.h * so.k) continue;
      let u = Math.floor((x - so.x) / so.k); const v = Math.floor((y - so.y) / so.k);
      if (so.flip) u = so.w - 1 - u;
      const a = this.textures.getPixelAlpha(u, v, 'so_' + so.id);
      if (a) s = Math.max(s, a / 255);
    }
    return s;
  }
  private enDibujo(x: number, y: number): boolean { return this.dibujos.some(b => x > b.x0 && x < b.x1 && y > b.y0 && y < b.y1); }
  private bloqueado(x: number, y: number): boolean {
    return this.bloques.some(b => {
      if (x < b.x0 || x > b.x1 || y < b.y0 || y > b.y1) return false;
      if (!b.rombo) return true;
      // Rombo redondeado (superelipse p = 1.5): la silueta del estanque medida en su PNG.
      const rx = (b.x1 - b.x0) / 2, ry = (b.y1 - b.y0) / 2, u = Math.abs(x - b.x0 - rx) / rx, v = Math.abs(y - b.y0 - ry) / ry;
      return Math.pow(u, 1.5) + Math.pow(v, 1.5) <= 1;
    });
  }

  private toggleOverview(): void {
    const cam = this.cameras.main;
    this.overview = !this.overview;
    if (this.overview) cam.stopFollow().removeBounds().setZoom(Math.min(VW * S / W, VH * S / H)).centerOn(W / 2, H / 2);
    else cam.setZoom(S).setBounds(0, 0, W, H).startFollow(this.player, true, 1, 1);
  }

  update(_t: number, dtMs: number): void {
    if (!this.listo) return;
    const p = this.player, k = this.keys, dt = dtMs / 1000;
    let vx = 0, vy = 0;
    if (!this.overview) {
      vx = +(k.D.isDown || k.RIGHT.isDown) - +(k.A.isDown || k.LEFT.isDown);
      vy = +(k.S.isDown || k.DOWN.isDown) - +(k.W.isDown || k.UP.isDown);
    }
    if (vx || vy) {
      const len = Math.hypot(vx, vy), sp = VEL * dt;
      const nx = Phaser.Math.Clamp(p.x + vx / len * sp, 8, W - 8), ny = Phaser.Math.Clamp(p.y + vy / len * sp, 12, H - 2);
      // Si ya está dentro de una huella (no debería), se le deja salir.
      const dentro = this.bloqueado(p.x, p.y);
      if (dentro || !this.bloqueado(nx, p.y)) p.x = nx;
      if (dentro || !this.bloqueado(p.x, ny)) p.y = ny;
      p.dir = ROW_FROM_ANGLE[(Math.round(Math.atan2(vy, vx) / (Math.PI / 4)) + 8) % 8];
    }
    const key = `${PRE}-${vx || vy ? 'Walk' : 'Idle'}-${p.dir}`;
    if (p.anims.currentAnim?.key !== key) p.play(key, true);
    p.setDepth(p.y); this.sombra.setPosition(p.x, p.y - 3).setDepth(p.y - 1);
    // A la sombra (dura, como la del suelo): sobre el Pokémon se dibuja una silueta de su propio sprite en
    // multiply, recortada a las columnas cuyo punto a la altura de los pies cae en la máscara de sombra. Así la
    // sombra le cubre entero en esas columnas, también donde el sprite se superpone a la pared de la casa.
    const cs = this.copiaSombra, fw = p.frame.width, fh = p.frame.height, x0 = p.x - p.displayOriginX;
    let c0 = -1, c1 = -1;
    for (let i = 0; i < fw; i++) if (this.sombraEn(x0 + i + 0.5, p.y) > 0.5) { if (c0 < 0) c0 = i; c1 = i; }
    if (c0 < 0) cs.setVisible(false);
    else cs.setVisible(true).setPosition(p.x, p.y).setTexture(p.texture.key, p.frame.name).setCrop(c0, 0, c1 - c0 + 1, fh).setDepth(p.y + 0.5);
    // Animación de cada luz según su tipo (parpadeo, pulso, chispa), con fase propia.
    const t = _t / 1000;
    for (const l of this.luces) { const f = animarLuz(l.tipo, t, l.fase); l.luz.setIntensity(l.tipo.intensidad * f); l.halo.setAlpha(l.tipo.halo * f); }
    void T;
  }
}
