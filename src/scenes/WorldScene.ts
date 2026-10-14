// Escena del valle: dibuja el terreno (Terrain), árboles, rocas, edificios (los del mapa y los
// construidos), recolectables, plantas de bayas y aldeanos a partir del estado de la simulación
// (World), y traduce la entrada en comandos (también el modo construcción, tecla B). Toda la lógica
// de juego vive en sim/World.ts.
import Phaser from 'phaser';
import { DIBUJO, DIR_VEC, ESPECIES, NUEVA, REG, ROW_FROM_ANGLE, S, VH, VW } from '../config';
import { COLOCADOS, PALETA_DIBUJO, detalles } from '../data/mapaDibujo';
import { dentroDe, dibujar, puntoLuz, tapa, type Elemento, type Pieza } from '../render/Dibujo';
import { TIPOS_LUZ, animarLuz, type TipoLuz } from '../render/luces';
import { ITEMS } from '../data/items';
import { CONSTRUIBLES, EDIFICIO, MEJORAS_CASA, NIDOS_INICIALES } from '../data/edificios';
import type { MapData, ObjCatalog } from '../data/types';
import { Terrain, T, screenTex } from '../render/Terrain';
import { RECURSOS, World, afin, oscuridad, formaDe, sitioPlanta, type Aldeano, type Casilla, type Coste, type Evento, type Planta, type Punto, type Recurso, type Tarea } from '../sim/World';
import { TREE_N, ROCK_N } from './Preload';
import { hash } from '../util';

const TREE_H = 58, TREE_BASE_X = [129, 133, 105, 129], TREE_HIT = 6, ROCK_H = 32;
const VEL = 84;                 // px de mundo por segundo
const ALCANCE = 2.5 * T;        // alcance del Látigo Cepa y de recoger (desde los pies)
const TIRO = 4 * T;             // hasta dónde llega una Poké Ball
const PASO_ANIM_BAYA = 600;     // ms entre los 2 fotogramas de las plantas
const ANCHO_JUGADOR = 10;       // medio ancho del cuerpo de Bulbasaur contra paredes (mapa dibujo)

interface Circulo { x: number; y: number; r: number }
// rombo: superelipse dentro del rectángulo (el estanque); poli: planta en perspectiva de un edificio (el rectángulo es su caja)
interface Bloque { x: number; y: number; w: number; h: number; rombo?: boolean; poli?: [number, number][] }
interface Luz { luz: Phaser.GameObjects.Light; halo: Phaser.GameObjects.Image; tipo: TipoLuz; fase: number }
// Luz del día del mapa dibujo (Light2D): ambiente de día (blanco = sin cambio), al atardecer y de noche.
const AMB_DIA = [255, 255, 255], AMB_TARDE = [255, 206, 170], AMB_NOCHE = [64, 78, 126];
interface Interactivo { x: number; y: number; r: number; tipo: 'almacen' | 'caja' | 'cama' }
// Árboles y rocas: se talan/pican con Látigo Cepa y son sitios de trabajo para los aldeanos.
interface Diana { tipo: 'arbol' | 'roca'; x: number; y: number; img: Phaser.GameObjects.Image; sitio: Punto }
interface AldeanoSpr {
  spr: Phaser.GameObjects.Sprite; sombra: Phaser.GameObjects.Ellipse; carga: Phaser.GameObjects.Image; x: number; y: number; dir: number;
  bocadillo?: Phaser.GameObjects.Container;   // petición del visitante: icono del recurso y cantidad
  bocNido?: boolean;                          // el bocadillo enseña también un nido (no hay ninguno libre)
}
export const ICONO_RECURSO: Record<Recurso, string> = { madera: 'obj_tronco', piedra: 'obj_piedra', bayas: 'icono_oran', ladrillos: 'obj_ladrillo', platos: 'obj_plato' };
export const NOMBRE_RECURSO: Record<Recurso, string> = { madera: 'madera', piedra: 'piedra', bayas: 'bayas', ladrillos: 'ladrillos', platos: 'platos' };
const REJILLA_OBRA = 12;        // los edificios se colocan en medias casillas
const textoCoste = (c: Coste) => (Object.entries(c) as [Recurso, number][]).map(([r, n]) => `${n} de ${NOMBRE_RECURSO[r]}`).join(' y ');

export class WorldScene extends Phaser.Scene {
  terrain!: Terrain;
  sim!: World;
  player!: Phaser.GameObjects.Sprite & { dir: number };
  private shadow!: Phaser.GameObjects.Ellipse;
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;
  private trees: Circulo[] = [];
  private blocks: Bloque[] = [];
  private interactivos: Interactivo[] = [];
  private dianas: Diana[] = [];
  private huellas: Bloque[] = [];               // suelo que ocupa cada edificio construido (también los que se pisan)
  private dibujos: Bloque[] = [];               // lo que tapa el dibujo de árboles, rocas y edificios (tejados, copas)
  private dibujosObra: Bloque[] = [];           // dibujo entero de cada edificio y estación (nidos incluidos): nada se construye encima ni delante
  private edifSprites = new Map<number, Phaser.GameObjects.Image>();
  obra: number | null = null;                   // modo construcción: índice en CONSTRUIBLES (lo lee la UI)
  private fantasma!: Phaser.GameObjects.Image;  // el edificio elegido, translúcido, bajo el cursor
  private posObra: Punto = { x: 0, y: 0 };
  private recienHechos = new Set<number>();     // construcciones que aparecen con un saltito
  // Caja de Pelipper (GDD-pueblo §2): junto a la mesa; F en la mesa o en la caja abre su panel (UIScene).
  private cajaPos: Punto | null = null;
  panelCaja = false;                            // lo lee la UI
  panelCasa = false;                            // panel de la casa (F en la puerta): dormir, cocinar, mejorar; lo dibuja la UI
  monedasRetenidas = 0;                         // Pokécoins que el HUD aún no enseña: llegan cuando Pelipper se posa
  private aldeanoSprites = new Map<number, AldeanoSpr>();
  private anillo!: Phaser.GameObjects.Ellipse; // bajo el aldeano elegido
  seleccion: number | null = null;            // uid del aldeano al que se va a dar trabajo
  private objSprites = new Map<number, Phaser.GameObjects.Image>();
  private plantaSprites = new Map<number, { img: Phaser.GameObjects.Image; fase: number }>();
  private objs!: ObjCatalog;
  private hover!: Phaser.GameObjects.Ellipse;   // realce suave bajo lo que se puede recoger o cosechar
  private targetTile: [number, number] = [0, 0];
  private overview = false;
  private durmiendo = false;
  slot = 0;                       // casilla del inventario elegida (la lee la UI)
  private tAnim = 0;
  private lanzando = false;      // hay una Poké Ball en el aire o moviéndose: no se lanza otra
  private listo = false;          // el suelo se calcula en otros hilos: hasta tenerlo, update no hace nada
  private montaje = 0;
  private piezas: Pieza[] = [];                // elementos del mapa dibujo (se aclaran si tapan a Bulbasaur)
  private luces: Luz[] = [];                    // farolas y hoguera del mapa dibujo: se encienden al anochecer
  private lugaresDibujo: { almacen: Punto; casa: Punto; entrada: Punto } | null = null;

  constructor() { super('world'); }

  create(data: { nueva?: boolean }): void {
    this.listo = false;
    const espera = this.add.text(VW * S / 2, VH * S / 2, 'Preparando el valle…', { fontFamily: '"Segoe UI", system-ui, sans-serif', fontSize: `${7 * S}px`, color: '#e4ecd8' }).setOrigin(0.5);
    const n = ++this.montaje;
    this.montar(data, n).catch(e => console.error(e)).finally(() => espera.destroy());
  }

  private async montar(data: { nueva?: boolean }, n: number): Promise<void> {
    // Phaser reutiliza la instancia al volver del título: empezar con listas vacías.
    this.trees = []; this.blocks = []; this.interactivos = []; this.dianas = []; this.huellas = []; this.dibujos = []; this.dibujosObra = [];
    this.objSprites.clear(); this.plantaSprites.clear(); this.aldeanoSprites.clear(); this.edifSprites.clear(); this.recienHechos.clear();
    this.seleccion = null; this.overview = false; this.durmiendo = false; this.obra = null;
    this.cajaPos = null; this.panelCaja = false; this.panelCasa = false; this.monedasRetenidas = 0;
    this.luces = []; this.lugaresDibujo = null; this.piezas = [];
    // Mapa dibujo: todo lo que se dibuja (imágenes y sprites) recibe la luz del día y de las farolas (Light2D).
    this.events.off(Phaser.Scenes.Events.ADDED_TO_SCENE, this.iluminar, this);
    if (DIBUJO) { this.lights.enable().setAmbientColor(0xffffff); this.events.on(Phaser.Scenes.Events.ADDED_TO_SCENE, this.iluminar, this); }
    const map = this.registry.get(REG.mapa) as MapData;
    this.objs = this.registry.get(REG.objs) as ObjCatalog;
    this.terrain = new Terrain(map, S, DIBUJO ? { paleta: PALETA_DIBUJO, decals: false } : {});
    const tr = this.terrain, { W, H } = tr;
    // La partida guardada se lee antes de calcular el suelo: su tierra arada y sus casillas regadas
    // entran en el primer pintado. `candidatos` se rellena luego (World guarda la misma lista).
    const candidatos: Casilla[] = [];
    const guardada = data.nueva || NUEVA ? null : World.cargar(candidatos);
    if (guardada) {
      for (const k of guardada.estado.aradas) { const [tx, ty] = k.split(',').map(Number); tr.arar(tx, ty, false); }
      for (const k of this.casillasHumedas(guardada.estado)) tr.regadas.add(k);
    }
    await tr.calcular(this);
    if (n !== this.montaje || !this.sys.isActive()) return;   // se salió de la escena mientras tanto

    if (DIBUJO) this.crearDibujo(map);
    else {
      this.crearArbolesYRocas(map);
      this.crearEstaticos(map);
      this.colocarCaja(map);
    }

    // Casillas candidatas para recolectables y plantas: césped puro, libre y lejos de todo.
    for (let ty = 1; ty < tr.MH - 1; ty++) for (let tx = 1; tx < tr.MW - 1; tx++) {
      const cx = tx * T + T / 2, cy = ty * T + T / 2;
      if (!tr.esCespedPuro(tx, ty) || tr.nearWater(cx, cy, 20) || tr.enCamino(cx, cy)) continue;
      if (this.trees.some(t => Math.hypot(cx - t.x, cy - t.y) < t.r + 16)) continue;
      if (this.blocks.some(b => cx > b.x - b.w / 2 - 14 && cx < b.x + b.w / 2 + 14 && cy > b.y - b.h - 14 && cy < b.y + 14)) continue;
      if (this.dibujos.some(b => this.solapa(b, { x: cx, y: ty * T + 20, w: 18, h: 32 }))) continue; // ni detrás de un tejado o una copa
      if ((map.solares ?? []).some(([x0, y0, x1, y1]) => cx > x0 && cx < x1 && cy > y0 && cy < y1)) continue; // los solares, para construir
      candidatos.push({ tx, ty });
    }
    const itemsMapa = (map.objetos ?? []).filter(o => this.objs[o.id]?.tipo === 'item').map(o => ({ id: o.id, tx: Math.floor(o.x / T), ty: Math.floor(o.y / T) }));
    const lugares = this.lugaresPueblo(map);
    if (guardada) this.sim = guardada;
    else {
      // Partida nueva: con sus nidos ya hechos; nada aparece encima de ellos (ni una planta que los tape).
      const nidos = this.nidosIniciales(map, itemsMapa);
      const fuera = candidatos.filter(c => !nidos.some(n => this.solapa(this.huellaDe('nido', n.x, n.y), { x: c.tx * T + T / 2, y: c.ty * T + T, w: T, h: 2 * T })));
      this.sim = World.nueva(fuera, itemsMapa, nidos, lugares.almacen);
    }
    this.sim.lugares = lugares;
    this.sim.pasable = (x, y) => !this.terrain.esAgua(x, y) && !this.trees.some(t => Math.hypot(x - t.x, (y - t.y) * 1.6) < t.r) && !this.enBloque(x, y);
    this.sim.libre = (tx, ty) => !this.huellas.some(b => this.solapa(b, { x: tx * T + T / 2, y: ty * T + T, w: T, h: T }));
    // Visitantes: llegan por el camino del sur con una petición (GDD-pueblo §4: Marill es el primero,
    // nada más empezar, aunque aún no haya nido; §9.1: si no se queda, se va y vuelve).
    this.sim.especies = Object.keys(this.registry.get(REG.animsAldeanos) ?? {});
    const e0 = this.sim.estado, visita = e0.aldeanos.length || e0.pendientes.length ? [] : this.sim.llegaVisitante();
    if (!guardada) this.sim.guardar();
    tr.build(this);

    // Bulbasaur.
    const [px0, py0] = map.inicio ?? [W / 2, H / 2];
    this.player = Object.assign(this.add.sprite(px0, py0, 'b-Idle').setOrigin(0.5, 0.72), { dir: 0 });
    this.shadow = this.add.ellipse(0, 0, 16, 6, 0x2c4422, 0.3);
    const cam = this.cameras.main;
    cam.setZoom(S).setBounds(0, 0, W, H).startFollow(this.player, true, 1, 1).setRoundPixels(true);

    this.hover = this.add.ellipse(0, 0, 18, 7, 0xffffff, 0.28).setVisible(false);
    this.anillo = this.add.ellipse(0, 0, 20, 8, 0xffd65a, 0.45).setVisible(false);
    this.fantasma = this.add.image(0, 0, '__DEFAULT').setVisible(false).setAlpha(0.7);

    this.keys = this.input.keyboard!.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT,F,SPACE,Q,E,M,B,ESC,TAB,ONE,TWO,THREE,FOUR,FIVE,SIX,SEVEN,EIGHT,NINE') as Record<string, Phaser.Input.Keyboard.Key>;
    this.keys.SPACE.on('down', () => this.accion());
    this.keys.M.on('down', () => this.toggleOverview());
    this.keys.B.on('down', () => this.modoObra(this.obra === null));
    this.keys.ESC.on('down', () => {
      if (this.obra !== null) { this.modoObra(false); return; }
      if (this.panelCaja) { this.cerrarCaja(); return; }
      if (this.panelCasa) { this.panelCasa = false; return; }
      this.sim.guardar(); this.scene.stop('ui'); this.scene.start('title');
    });
    this.keys.F.on('down', () => this.accion());
    this.keys.Q.on('down', () => this.elegirSlot(-1));
    this.keys.E.on('down', () => this.elegirSlot(1));
    ['ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX', 'SEVEN', 'EIGHT', 'NINE'].forEach((k, i) => this.keys[k].on('down', () => { if (this.obra !== null) this.elegirObra(i); }));
    this.input.on('wheel', (_p: unknown, _o: unknown, _dx: number, dy: number) => this.elegirSlot(dy > 0 ? 1 : -1));
    this.input.mouse!.disableContextMenu();
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (this.durmiendo || this.overview) return;
      if (this.obra !== null) { if (p.rightButtonDown()) this.modoObra(false); else this.colocar(); return; }
      this.accion();
    });

    this.scene.launch('ui');
    this.sincronizar();
    const sinNadie = !this.sim.estado.aldeanos.length && !this.sim.plazas();
    this.aviso(guardada && !sinNadie ? `Día ${this.sim.estado.dia}${this.sim.estado.lluvia ? ' · llueve' : ''}`
      : sinNadie ? 'Junta madera y piedra (F o clic en un árbol o una roca) y construye un nido (B): alguien vendrá a vivir al valle.'
      : `Hay ${this.sim.plazas()} camas libres: vendrán visitantes. Junta bayas, madera y piedra (F o clic) para lo que pidan.`);
    if (visita.length) this.time.delayedCall(3200, () => this.procesar(visita));
    this.listo = true;
  }

  // ---- Construcción del escenario ----
  // Mapa dibujo (src/data/mapaDibujo.ts): elementos Klein con su huella como colisión; árboles y rocas son dianas
  // (madera y piedra); la casa, el almacén y la tienda (= caja de Pelipper) tienen su interacción; las farolas y la
  // hoguera, su luz. Luego los detalles (flores, matitas) por el césped libre.
  private crearDibujo(map: MapData): void {
    const cat = this.registry.get(REG.dibujo) as { elementos: Elemento[] }, porId = new Map(cat.elementos.map(e => [e.id, e]));
    const sitio: Partial<Record<'casa' | 'almacen' | 'tienda', Punto>> = {};
    for (const c of COLOCADOS) {
      const el = porId.get(c.id);
      if (!el) { console.warn('elemento desconocido', c.id); continue; }
      const p = dibujar(this, el, c), b = this.bloqueDe(p.img);
      if (!p.plano) this.piezas.push(p);
      if (p.suelo) for (const poli of p.suelo) {
        const xs = poli.map(q => q[0]), ys = poli.map(q => q[1]), x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
        this.blocks.push({ x: (x0 + x1) / 2, y: y1, w: x1 - x0, h: y1 - y0, poli });
      } else if (p.huella) { const h = p.huella; this.blocks.push({ x: (h.x0 + h.x1) / 2, y: h.y1, w: h.x1 - h.x0, h: h.y1 - h.y0, rombo: el.tipo === 'estanque' }); }
      this.dibujos.push(b); this.dibujosObra.push(b);
      if (/^(arbol|roca)_/.test(el.id)) this.dianas.push({ tipo: el.id.startsWith('arbol') ? 'arbol' : 'roca', x: c.x, y: p.base, img: p.img, sitio: { x: c.x, y: p.base + 13 } });
      const l = puntoLuz(p);
      if (l) this.encender(l[0], l[1], TIPOS_LUZ[c.luz ?? (el.id === 'hoguera' ? 'hoguera' : 'farol')], p.base + 1);
      if (c.rol) sitio[c.rol] = p.puerta ? { x: p.puerta[0], y: p.puerta[1] } : { x: c.x, y: p.base + 6 };
    }
    const { W, H } = this.terrain, centro = { x: W / 2, y: H / 2 };
    const casa = sitio.casa ?? centro, almacen = sitio.almacen ?? centro, tienda = sitio.tienda;
    // Las interacciones, delante de la puerta (o del mostrador de la tienda). Los aldeanos dejan la carga a 14 px de `almacen`.
    this.interactivos.push({ x: casa.x, y: casa.y, r: 30, tipo: 'cama' }, { x: almacen.x, y: almacen.y, r: 34, tipo: 'almacen' });
    if (tienda) { this.interactivos.push({ x: tienda.x, y: tienda.y, r: 34, tipo: 'caja' }); this.cajaPos = { x: tienda.x, y: tienda.y - 10 }; }
    const [ex, ey] = map.entrada ?? [W / 2, H - 20];
    this.lugaresDibujo = { almacen: { x: almacen.x, y: almacen.y - 10 }, casa, entrada: { x: ex, y: ey } };
    const ids = cat.elementos.filter(e => e.tipo === 'detalle').map(e => e.id);
    const libre = (x: number, y: number) => !this.blocks.some(b => x > b.x - b.w / 2 - 12 && x < b.x + b.w / 2 + 12 && y > b.y - b.h - 40 && y < b.y + 12)
      && !this.dibujos.some(b => x > b.x - b.w / 2 && x < b.x + b.w / 2 && y > b.y - b.h && y < b.y);
    for (const c of detalles(ids, libre)) dibujar(this, porId.get(c.id)!, c);
  }
  // Luz Light2D más su halo (degradado radial en ADD, sin luz propia). Empiezan apagadas: las enciende luzDelDia.
  private encender(x: number, y: number, tipo: TipoLuz, depth: number): void {
    if (!this.textures.exists('halo')) {
      const n = 64, c = this.textures.createCanvas('halo', n, n)!, g = c.getContext(), grad = g.createRadialGradient(n / 2, n / 2, 0, n / 2, n / 2, n / 2);
      grad.addColorStop(0, 'rgba(255,255,255,0.9)'); grad.addColorStop(0.35, 'rgba(255,255,255,0.35)'); grad.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = grad; g.fillRect(0, 0, n, n); c.refresh(); c.setFilter(Phaser.Textures.FilterMode.LINEAR);
    }
    const luz = this.lights.addLight(x, y, tipo.radio, tipo.color, 0);
    const halo = this.add.image(x, y, 'halo').setDisplaySize(tipo.radio * 0.5, tipo.radio * 0.5).setTint(tipo.color).setAlpha(0)
      .setBlendMode(Phaser.BlendModes.ADD).setDepth(depth);
    halo.resetPipeline();
    this.luces.push({ luz, halo, tipo, fase: Math.random() * 100 });
  }
  private iluminar(go: Phaser.GameObjects.GameObject): void {
    if (go instanceof Phaser.GameObjects.Image || go instanceof Phaser.GameObjects.Sprite) go.setPipeline('Light2D');
  }
  // Lo que tapa a Bulbasaur (tejado, copa, roca) se vuelve translúcido mientras está detrás, como en Stardew: se mira si
  // algún punto de su cuerpo cae en lo pintado del elemento y este va por delante.
  private aclarar(dtMs: number): void {
    if (!DIBUJO) return;
    const p = this.player, puntos = [[0, -4], [0, -12], [0, -19], [-8, -8], [8, -8]], paso = Math.min(1, dtMs / 120);
    for (const q of this.piezas) {
      const b = q.img.getBounds(), cerca = p.x > b.left - 10 && p.x < b.right + 10 && p.y > b.top && p.y - 20 < b.bottom;
      const meta = cerca && puntos.some(([dx, dy]) => tapa(q, p.x + dx, p.y + dy, p.y)) ? 0.45 : 1;
      if (q.img.alpha === meta) continue;
      const al = Math.abs(meta - q.img.alpha) < 0.02 ? meta : q.img.alpha + (meta - q.img.alpha) * paso;
      for (const im of q.partes) im.setAlpha(al);
    }
  }
  // Luz ambiente según la hora (blanca de día, cálida al atardecer, azul de noche) y farolas encendidas al anochecer.
  private luzDelDia(tMs: number): void {
    if (!DIBUJO) return;
    const n = oscuridad(this.sim.estado.minuto), [a, b, u] = n < 0.45 ? [AMB_DIA, AMB_TARDE, n / 0.45] as const : [AMB_TARDE, AMB_NOCHE, (n - 0.45) / 0.55] as const;
    const [r, g, bl] = a.map((v, i) => Math.round(v + (b[i] - v) * u));
    this.lights.setAmbientColor((r << 16) | (g << 8) | bl);
    const on = Phaser.Math.Clamp((n - 0.3) / 0.3, 0, 1), t = tMs / 1000;
    for (const l of this.luces) { const f = animarLuz(l.tipo, t, l.fase) * on; l.luz.setIntensity(l.tipo.intensidad * f); l.halo.setAlpha(l.tipo.halo * f); }
  }

  private crearArbolesYRocas(map: MapData): void {
    const tr = this.terrain, sc = tr.W / 1024;
    for (const a of map.arboles ?? []) {
      const x = Math.round(a.x), y = Math.round(a.y);
      const k = Phaser.Math.Clamp(a.k ?? Math.floor(hash(x, y) * TREE_N), 0, TREE_N - 1), h = a.h ?? TREE_H * (0.9 + 0.2 * hash(y, x));
      const src = this.textures.get('arbol' + k).getSourceImage() as HTMLImageElement, key = screenTex(this, 'arbol' + k, Math.round(h * S));
      this.add.ellipse(x + h * 0.18, y - h * 0.08, h * 0.75, h * 0.32, 0x2c4422, 0.28).setDepth(y - 2);
      const img = this.add.image(x, y, key).setOrigin(TREE_BASE_X[k] / src.width, 1).setScale(1 / S).setDepth(y);
      this.dibujos.push(this.bloqueDe(img));
      this.trees.push({ x, y, r: TREE_HIT + 4 });
      this.dianas.push({ tipo: 'arbol', x, y, img, sitio: { x, y: y + 13 } });
    }
    for (const a of map.rocas ?? []) {
      const x = Math.round(a.x), y = Math.round(a.y);
      const k = Phaser.Math.Clamp(a.k ?? Math.floor(hash(x * 1.3, y) * ROCK_N), 0, ROCK_N - 1);
      const s = a.s ?? 0.5 + 0.1 * Math.floor(hash(y, x * 0.7) * 6), h = ROCK_H * s;
      const key = screenTex(this, 'roca' + k, Math.round(h * S)), wd = (this.textures.get(key).getSourceImage() as HTMLCanvasElement).width / S;
      this.add.ellipse(x + h * 0.08, y - h * 0.06, wd * 1.05, h * 0.3, 0x2c4422, 0.25).setDepth(y - 2);
      const img = this.add.image(x, y, key).setOrigin(0.5, 0.95).setScale(1 / S).setDepth(y).setFlipX(hash(x, y * 2.3) < 0.5);
      this.dibujos.push(this.bloqueDe(img));
      this.trees.push({ x, y: y - h * 0.2, r: wd * 0.42 });
      this.dianas.push({ tipo: 'roca', x, y, img, sitio: { x, y: y + 12 } });
    }
    void sc;
  }

  // Estación o edificio pixel art con su sombra y su colisión (los del mapa y los construidos).
  // Los de suelo (nido) van por debajo de todo lo que se ordena por y: quien pasa, pasa por encima.
  private dibujarObjeto(id: string, x: number, y: number): Phaser.GameObjects.Image | null {
    const def = this.objs[id];
    if (!def || !this.textures.exists('obj_' + id)) return null;
    const src = this.textures.get('obj_' + id).getSourceImage() as HTMLImageElement, [ax, ay] = def.ancla;
    const fw = Math.max(src.width, def.colision[0]), d = def.suelo ? y - 5000 : y;
    this.add.ellipse(x + fw * 0.04, y - fw * 0.05, fw * 1.05, fw * 0.22, 0x2c4422, 0.25).setDepth(d - 2);
    const [w, h] = def.colision;
    if (w > 0 && h > 0) this.blocks.push({ x, y, w, h });
    const img = this.add.image(x, y, 'obj_' + id).setOrigin(ax / src.width, ay / src.height).setDepth(d);
    if (!def.suelo) this.dibujos.push(this.bloqueDe(img));
    this.dibujosObra.push(this.bloqueDe(img)); // también los de suelo: un edificio no puede taparlos
    return img;
  }
  // Rectángulo que ocupa un dibujo, como Bloque (centro abajo).
  private bloqueDe(img: Phaser.GameObjects.Image): Bloque {
    const r = img.getBounds();
    return { x: r.centerX, y: r.bottom, w: r.width, h: r.height };
  }

  // Estaciones y edificios del mapa (los items del mapa pasan a la simulación).
  private crearEstaticos(map: MapData): void {
    for (const o of map.objetos ?? []) {
      const def = this.objs[o.id];
      if (!def || def.tipo === 'item') continue;
      if (!this.dibujarObjeto(o.id, o.x, o.y)) continue;
      // Interacciones: la casa abre su panel (dormir, cocinar, mejorarla); la mesa de trabajo hace de almacén (y de caja
      // de envío para lo que no es recurso) hasta que existan sus sprites.
      if (o.id === 'casa') this.interactivos.push({ x: o.x, y: o.y + 6, r: 26, tipo: 'cama' });
      if (o.id === 'mesa_trabajo') this.interactivos.push({ x: o.x, y: o.y + 4, r: 34, tipo: 'almacen' });
    }
  }

  // La caja de Pelipper va pegada a la mesa (a la derecha o, si no cabe, a la izquierda), en todos los
  // mapas, sin tocar sus JSON. Sin sprite o sin mesa, la mesa hace también de caja.
  private colocarCaja(map: MapData): void {
    const mesa = (map.objetos ?? []).find(q => q.id === 'mesa_trabajo'), id = 'caja_pelipper', def = this.objs[id];
    if (!mesa || !def || !this.textures.exists('obj_' + id)) return;
    const w = (this.textures.get('obj_' + id).getSourceImage() as HTMLImageElement).width, mw = this.objs.mesa_trabajo?.colision[0] ?? 48;
    const cabe = (x: number, y: number) => {
      const b = { x, y, w, h: 14 }, tr = this.terrain;
      for (let py = y - 14; py <= y; py += 4) for (let px = x - w / 2; px <= x + w / 2; px += 4) if (tr.esAgua(px, py)) return false;
      return !this.trees.some(t => this.solapa(b, { x: t.x, y: t.y + t.r, w: t.r * 2, h: t.r * 2 })) && !this.blocks.some(o => this.solapa(b, o));
    };
    const d = mw / 2 + w / 2 + 4, sitio = [[mesa.x + d, mesa.y], [mesa.x - d, mesa.y], [mesa.x + d, mesa.y + 30]].find(([x, y]) => cabe(x, y));
    if (!sitio) return;
    const [x, y] = sitio;
    if (!this.dibujarObjeto(id, x, y)) return;
    this.cajaPos = { x, y };
    this.interactivos.push({ x, y: y + 4, r: 24, tipo: 'caja' });
  }

  // ---- Caja de Pelipper: panel de venta (lo dibuja UIScene y llama a estos métodos) ----
  private abrirCaja(): void {
    this.panelCaja = true; this.seleccion = null;
  }
  cerrarCaja(): void { this.panelCaja = false; }
  moverCaja(r: Recurso, n: number): void { this.sim.aCaja(r, n); }
  venderSobrante(): void { this.procesar(this.sim.venderSobrante()); }
  // Mete en la caja lo elegido en la mochila (Q/E): Poké Balls u otros objetos que no son recursos.
  meterElegido(): void {
    const s = this.sim.estado.inventario[this.slot];
    if (!s) { this.aviso('Elige algo de la mochila con Q/E o la rueda'); return; }
    this.procesar(this.sim.enviar(this.slot));
  }

  // ---- Casa: panel con dormir, cocinar y la mejora siguiente (lo dibuja UIScene y llama a estos métodos) ----
  dormirYa(): void { this.panelCasa = false; this.dormir(false); }
  cocinar(n: number): void { this.procesar(this.sim.cocinar(n)); }
  mejorarCasa(): void { this.procesar(this.sim.mejorarCasa()); }

  // Al amanecer, si había algo en la caja, Pelipper baja volando hasta ella con las Pokécoins y se va.
  // El contador del HUD no sube hasta que se posa (monedasRetenidas).
  private pelipperTrae(n: number): void {
    const c = this.cajaPos ?? this.sim.lugares.almacen;
    if (!this.anims.exists('pelipper-Walk-1')) return;
    this.monedasRetenidas = n;
    const suelta = () => { this.monedasRetenidas = 0; };
    this.time.delayedCall(8000, suelta); // por si algo corta la animación
    const spr = this.add.sprite(c.x - 170, c.y - 150, 'pelipper-Walk').setOrigin(0.5, 0.72).setDepth(c.y + 500).play('pelipper-Walk-1');
    const sombra = this.add.ellipse(spr.x, c.y + 2, 18, 5, 0x2c4422, 0.22).setDepth(c.y - 1);
    const sigue = () => sombra.setPosition(spr.x, c.y + 2);
    this.tweens.add({
      targets: spr, x: c.x + 2, y: c.y - 30, duration: 1900, delay: 700, ease: 'Sine.easeOut', onUpdate: sigue,
      onComplete: () => {
        if (this.anims.exists('pelipper-Idle-0')) spr.play('pelipper-Idle-0');
        suelta();
        const num = this.add.text(c.x + 1, c.y - 52, `+${n}`, { fontFamily: '"Pixelify Sans", "Segoe UI", sans-serif', fontSize: `${8 * S}px`, color: '#ffe27a', fontStyle: 'bold', stroke: '#3a2414', strokeThickness: 2 * S })
          .setOrigin(0.5).setScale(1 / S).setDepth(c.y + 501);
        const moneda = this.textures.exists('ui_moneda') ? this.add.image(c.x - num.displayWidth / 2 - 5, c.y - 52, 'ui_moneda').setDepth(c.y + 501) : null;
        this.tweens.add({ targets: [num, moneda].filter(Boolean), y: '-=12', alpha: 0, delay: 500, duration: 1100, onComplete: () => { num.destroy(); moneda?.destroy(); } });
        this.time.delayedCall(1100, () => {
          spr.play('pelipper-Walk-3');
          this.tweens.add({ targets: spr, x: c.x + 190, y: c.y - 170, duration: 1700, ease: 'Sine.easeIn', onUpdate: sigue, onComplete: () => { spr.destroy(); sombra.destroy(); } });
        });
      },
    });
  }

  // Almacén (mesa de trabajo), puerta de la casa y entrada del valle (el extremo sur del camino).
  private lugaresPueblo(map: MapData): { almacen: Punto; casa: Punto; entrada: Punto } {
    if (this.lugaresDibujo) return this.lugaresDibujo;
    const o = (id: string) => (map.objetos ?? []).find(q => q.id === id);
    const mesa = o('mesa_trabajo'), casa = o('casa'), { W, H } = this.terrain;
    let entrada: Punto | null = null;
    for (let r = map.vert.length - 1; r >= 0 && !entrada; r--) {
      const c = map.vert[r].findIndex(v => v === 1 || v === 2);
      if (c >= 0) entrada = { x: c * T, y: r * T };
    }
    return {
      almacen: mesa ? { x: mesa.x, y: mesa.y } : { x: W / 2, y: H / 2 },
      casa: casa ? { x: casa.x, y: casa.y + 6 } : { x: W / 2, y: H / 2 },
      entrada: entrada ?? { x: W / 2, y: H - 30 },
    };
  }

  // Tierra que se ve mojada: solo bajo las semillas regadas (fase 1). En cuanto la planta brota,
  // el suelo vuelve a su color (decisión del usuario, 2026-10-13).
  private casillasHumedas(e = this.sim.estado): string[] {
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
    // Aldeanos.
    for (const a of [...e.aldeanos, ...e.salvajes]) if (!this.aldeanoSprites.has(a.uid)) this.aldeanoSprites.set(a.uid, this.crearAldeano(a));
    // Construcciones (no se derriban: solo aparecen). Las recién hechas, con un saltito.
    for (const c of e.construcciones) {
      if (this.edifSprites.has(c.uid)) continue;
      const def = EDIFICIO[c.id], img = def && this.dibujarObjeto(def.obj, c.x, c.y);
      if (!img) continue;
      this.edifSprites.set(c.uid, img);
      this.huellas.push(this.huellaDe(def.obj, c.x, c.y));
      if (this.recienHechos.delete(c.uid)) this.tweens.add({ targets: img, scaleY: { from: 0.6, to: 1 }, scaleX: { from: 1.2, to: 1 }, duration: 380, ease: 'Back.easeOut' });
    }
  }

  // ---- Modo construcción (B) ----
  modoObra(on: boolean): void {
    if (this.durmiendo || this.overview) return;
    this.obra = on ? this.obra ?? 0 : null;
    this.seleccion = null;
    this.fantasma.setVisible(false);
    if (on) this.aviso('Construir: elige con 1-9 o con clic en la barra, y haz clic en el valle para colocarlo. B o clic derecho para salir.');
  }
  elegirObra(i: number): void {
    if (this.obra === null || i < 0 || i >= CONSTRUIBLES.length) return;
    this.obra = i;
  }
  // Suelo que ocupa un edificio: lo ancho del sprite y, de fondo, su colisión o los 3/4 de su alto (los objetos bajos,
  // como el nido, se ven desde arriba: si se montan unos sobre otros parece un error).
  private huellaDe(obj: string, x: number, y: number): Bloque {
    const def = this.objs[obj], src = this.textures.get('obj_' + obj).getSourceImage() as HTMLImageElement;
    return { x, y, w: Math.max(def?.colision[0] ?? 0, src.width - 4), h: Math.max(def?.colision[1] ?? 0, Math.round(src.height * 0.75)) };
  }
  // Rectángulo del dibujo entero de un objeto puesto en (x, y), con 2 px de margen (tejado incluido).
  private dibujoDe(obj: string, x: number, y: number): Bloque {
    const def = this.objs[obj], src = this.textures.get('obj_' + obj).getSourceImage() as HTMLImageElement;
    const [ax, ay] = def?.ancla ?? [src.width / 2, src.height];
    return { x: x - ax + src.width / 2, y: y - ay + src.height + 2, w: src.width + 4, h: src.height + 4 };
  }
  private solapa(a: Bloque, b: Bloque): boolean {
    return Math.abs(a.x - b.x) * 2 < a.w + b.w && a.y - a.h < b.y && b.y - b.h < a.y;
  }
  // ¿Se puede poner aquí? Ni agua, ni camino, ni encima de árboles, rocas, edificios, puertas,
  // plantas, tierra sembrada o cosas del suelo.
  private sitioValido(obj: string, x: number, y: number): boolean {
    const b = this.huellaDe(obj, x, y), e = this.sim.estado;
    const casilla = (tx: number, ty: number) => this.solapa(b, this.bloqueCasilla(tx, ty));
    if (this.dibujosObra.some(o => this.solapa(this.dibujoDe(obj, x, y), o))) return false; // ni tapar ni quedar tapado
    return this.sitioLibre(b) && !e.plantas.some(p => casilla(p.tx, p.ty)) && !e.suelo.some(i => casilla(i.tx, i.ty))
      && !e.aradas.some(k => { const [tx, ty] = k.split(',').map(Number); return casilla(tx, ty); });
  }
  private bloqueCasilla(tx: number, ty: number): Bloque { return { x: tx * T + T / 2, y: ty * T + T - 2, w: T - 4, h: T - 6 }; }
  // Lo que no depende de la partida: dentro del mapa, sin agua ni camino, sin árboles, rocas, edificios ni puertas.
  private sitioLibre(b: Bloque): boolean {
    const tr = this.terrain;
    if (b.x - b.w / 2 < 4 || b.x + b.w / 2 > tr.W - 4 || b.y - b.h < 8 || b.y > tr.H - 4) return false;
    for (let py = b.y - b.h; py <= b.y + 2; py += 4) for (let px = b.x - b.w / 2; px <= b.x + b.w / 2; px += 4) {
      if (tr.esAgua(px, py) || tr.enCamino(px, py)) return false;
    }
    if (this.trees.some(t => this.solapa(b, { x: t.x, y: t.y + t.r, w: t.r * 2, h: t.r * 2 }))) return false;
    if (this.blocks.some(o => this.solapa(b, o)) || this.huellas.some(o => this.solapa(b, o))) return false;
    return !this.interactivos.some(z => this.solapa(b, { x: z.x, y: z.y + 8, w: 24, h: 20 }));
  }
  // Partida nueva: los NIDOS_INICIALES, en fila y pegados, en el sitio libre más cerca de la casa (con un
  // margen para no tocar sus paredes), sin pisar los objetos del mapa ni el sitio donde aparece Bulbasaur.
  private nidosIniciales(map: MapData, items: Casilla[]): Punto[] {
    const casa = (map.objetos ?? []).find(o => o.id === 'casa') ?? this.lugaresDibujo?.casa, id = 'nido';
    if (map.nidos?.length) return map.nidos.slice(0, NIDOS_INICIALES).map(([x, y]) => ({ x, y })); // el mapa ya les da sitio
    if (!casa || !this.textures.exists('obj_' + id)) return [];
    const paso = Math.ceil((this.textures.get('obj_' + id).getSourceImage() as HTMLImageElement).width / REJILLA_OBRA) * REJILLA_OBRA;
    const [ix, iy] = map.inicio ?? [-999, -999], ancho = (NIDOS_INICIALES - 1) * paso;
    const cabe = (x: number, y: number) => {
      const b = this.huellaDe(id, x, y), m = { ...b, w: b.w + 12, h: b.h + 12, y: b.y + 6 };
      return this.sitioLibre(b) && ![...this.blocks, ...this.dibujos].some(o => this.solapa(m, o)) && !items.some(c => this.solapa(b, this.bloqueCasilla(c.tx, c.ty)))
        && !this.solapa(b, { x: ix, y: iy + 8, w: 20, h: 20 });
    };
    let mejor: Punto[] = [], dMin = Infinity;
    for (let y = casa.y - 8 * T; y <= casa.y + 8 * T; y += REJILLA_OBRA) for (let x = casa.x - 10 * T; x <= casa.x + 10 * T; x += REJILLA_OBRA) {
      const d = Math.hypot(x + ancho / 2 - casa.x, (y - casa.y) * 1.5);
      if (d >= dMin) continue;
      const fila = Array.from({ length: NIDOS_INICIALES }, (_, i) => ({ x: x + i * paso, y }));
      if (fila.every(p => cabe(p.x, p.y))) { mejor = fila; dMin = d; }
    }
    return mejor;
  }
  // El fantasma sigue al cursor (centrado en el sprite, en medias casillas): verde si cabe, rojo si no.
  private moverFantasma(): void {
    if (this.obra === null) { this.fantasma.setVisible(false); return; }
    const def = CONSTRUIBLES[this.obra], obj = this.objs[def.obj], key = 'obj_' + def.obj;
    if (!obj || !this.textures.exists(key)) return;
    const src = this.textures.get(key).getSourceImage() as HTMLImageElement, ptr = this.input.activePointer;
    const x = Math.round(ptr.worldX / REJILLA_OBRA) * REJILLA_OBRA, y = Math.round((ptr.worldY + src.height / 2 - (src.height - obj.ancla[1])) / REJILLA_OBRA) * REJILLA_OBRA;
    this.posObra = { x, y };
    const ok = this.sitioValido(def.obj, x, y) && !this.sim.falta(def.coste);
    if (this.fantasma.texture.key !== key) this.fantasma.setTexture(key);
    this.fantasma.setVisible(true).setOrigin(obj.ancla[0] / src.width, obj.ancla[1] / src.height).setPosition(x, y).setDepth(y + 0.5);
    const latido = 0.12 * Math.sin(this.tAnim / 220); // late suave: aún no está puesto
    if (ok) this.fantasma.clearTint().setAlpha(0.55 + latido); else this.fantasma.setTint(0xff7a6a).setAlpha(0.5 + latido);
  }
  private colocar(): void {
    if (this.obra === null) return;
    const def = CONSTRUIBLES[this.obra], { x, y } = this.posObra;
    const falta = this.sim.falta(def.coste);
    if (falta) { this.aviso(`${def.nombre}: faltan ${textoCoste(falta)}`); return; }
    if (!this.sitioValido(def.obj, x, y)) { this.aviso('Ahí no cabe: busca césped libre, lejos del agua, el camino y las puertas'); return; }
    this.procesar(this.sim.construir(def.id, x, y));
  }

  // Lo siguiente que conviene hacer (lo enseña la UI bajo el almacén).
  objetivo(): string {
    const sim = this.sim, e = sim.estado, v = sim.visitante, nombre = (id: string) => ESPECIES[id]?.nombre ?? id;
    if (v?.pide) {
      const nido = this.necesitaNido(v), pide = `${v.pide.n} de ${NOMBRE_RECURSO[v.pide.r]}${nido ? ' y un nido libre' : ''}`;
      return v.hacer === 'irse' ? `${nombre(v.especie)} se va: alcánzalo con ${pide}` : `${nombre(v.especie)} quiere ${pide} (${nido ? 'B para construir, ' : ''}F a su lado)`;
    }
    if (!sim.plazas()) return 'Construye un nido (B)';
    if (sim.vecinos.length && !sim.cuantos('comedero')) return 'Construye un comedero (B)';
    const parado = sim.vecinos.find(a => !a.tarea);
    if (parado) return `Dale trabajo a ${nombre(parado.especie)} (clic en él)`;
    const sal = e.salvajes.find(a => a.hacer === 'salvaje');
    if (sal && sim.ballALanzar(this.slot) >= 0 && sim.nidoLibre()) return `Un ${nombre(sal.especie)} salvaje ronda por el valle: lánzale una Poké Ball (F)`;
    if (e.almacen.bayas < sim.vecinos.length) return 'Junta bayas para el desayuno';
    // Un pendiente (GDD-pueblo §9.1): prepárale lo que pide para cuando vuelva.
    const p = e.pendientes[0];
    if (p && !sim.puedeAcoger(p.pide)) return `Para cuando vuelva ${nombre(p.especie)}: ${sim.nidoLibre() ? '' : 'un nido libre y '}${p.pide.n} de ${NOMBRE_RECURSO[p.pide.r]}`;
    // Lo que sobra (por encima de lo que se guarda para construir, visitantes y desayunos) se vende.
    if (!sim.valorCaja && RECURSOS.reduce((t, r) => t + sim.sobrante(r), 0) >= 20) return 'Vende lo que sobra en la caja de Pelipper (F junto a la mesa)';
    // Edificios con utilidad (GDD-pueblo §11): cocina en casa, horno, guardería.
    const m = sim.mejoraSiguiente;
    if (m && m.nivel === 2 && e.dinero >= m.pokecoins) return 'Mejora tu casa con una cocina (F en la puerta)';
    if (sim.vecinos.length >= 3 && !sim.cuantos('horno')) return 'Construye un horno (B): cuece la piedra en ladrillos';
    const horno = e.construcciones.find(c => c.id === 'horno');
    if (horno && !sim.vecinos.some(a => a.tarea?.uid === horno.uid)) return 'Pon a alguien en el horno (clic en él y en el horno); mejor uno de Fuego';
    if (!sim.siguienteEspecie() && !p) return '';
    return e.ayuno ? 'Mañana vendrá alguien si nadie pasa hambre' : p ? `Pronto volverá ${nombre(p.especie)}` : 'Pronto llegará un visitante';
  }
  // ¿Le falta nido al visitante para quedarse? (no trae uno reservado y no hay ninguno libre)
  private necesitaNido(a: Aldeano): boolean { return a.nido === undefined && !this.sim.nidoLibre(); }

  // Prefijo de sus animaciones: el de la forma que le toca por nivel (bidoof → bibarel al evolucionar);
  // si esa forma no tiene sprites cargados, el de su especie.
  claveSpr(a: Aldeano): string { const f = formaDe(a).id; return this.anims.exists(`${f}-Idle-0`) ? f : a.especie; }
  nombreDe(a: Aldeano): string { return formaDe(a).nombre; }
  // El aldeano cuya ficha enseña la UI (GDD-pueblo §10): el elegido o, si no, el que está bajo el cursor.
  inspeccion(): Aldeano | null {
    if (this.durmiendo || this.overview || this.obra !== null || this.panelCaja || this.panelCasa) return null;
    return this.sim.estado.aldeanos.find(a => a.uid === this.seleccion) ?? this.aldeanoBajoCursor();
  }
  // Texto que sube y se desvanece sobre un aldeano (al subir de nivel).
  private flotante(a: Aldeano, txt: string, color: string): void {
    const t = this.add.text(a.x, a.y - 24, txt, { fontFamily: '"Segoe UI", system-ui, sans-serif', fontSize: `${7 * S}px`, color, fontStyle: 'bold', stroke: '#3a2414', strokeThickness: 2 * S })
      .setOrigin(0.5, 1).setScale(1 / S).setResolution(1).setDepth(a.y + 3);
    this.tweens.add({ targets: t, y: t.y - 12, alpha: 0, delay: 700, duration: 900, onComplete: () => t.destroy() });
  }

  private crearAldeano(a: Aldeano): AldeanoSpr {
    const spr = this.add.sprite(a.x, a.y, `${this.claveSpr(a)}-Idle`).setOrigin(0.5, 0.72);
    const sombra = this.add.ellipse(a.x, a.y - 3, 14, 5, 0x2c4422, 0.3);
    const carga = this.add.image(a.x, a.y - 22, '__DEFAULT').setVisible(false);
    const s: AldeanoSpr = { spr, sombra, carga, x: a.x, y: a.y, dir: 0 };
    if (a.pide) { s.bocNido = this.necesitaNido(a); s.bocadillo = this.crearBocadillo(a.pide.r, a.pide.n, s.bocNido); }
    return s;
  }

  // Bocadillo sobre el visitante con lo que pide (icono + número, sin texto); delante, un nido si
  // no hay ninguno libre para él.
  private crearBocadillo(r: Recurso, n: number, nido: boolean): Phaser.GameObjects.Container {
    const g = this.add.graphics(), w = nido ? 38 : 26, h = 13, x0 = nido ? 6 : 0;
    g.fillStyle(0xfbf7e6, 0.95).fillRoundedRect(-w / 2, -h, w, h, 4);
    g.fillTriangle(-3, 0, 3, 0, 0, 4);
    g.lineStyle(1, 0x6b7a52, 0.6).strokeRoundedRect(-w / 2, -h, w, h, 4);
    const partes: Phaser.GameObjects.GameObject[] = [g];
    if (nido) {
      const ni = this.add.image(-12, -h / 2, 'obj_nido');
      partes.push(ni.setScale(Math.min(1, 11 / Math.max(ni.frame.width, ni.frame.height))));
    }
    const ic = this.add.image(-6 + x0, -h / 2, ICONO_RECURSO[r]);
    ic.setScale(Math.min(1, 10 / Math.max(ic.frame.width, ic.frame.height)));
    const num = this.add.text(1 + x0, -h / 2, String(n), { fontFamily: '"Segoe UI", system-ui, sans-serif', fontSize: `${8 * S}px`, color: '#3d4a2c', fontStyle: 'bold' })
      .setOrigin(0, 0.5).setScale(1 / S).setResolution(1);
    return this.add.container(0, 0, [...partes, ic, num]);
  }

  // Pinta a cada aldeano donde lo ha dejado la simulación, con la animación de lo que hace.
  private dibujarAldeanos(): void {
    const todos = [...this.sim.estado.aldeanos, ...this.sim.estado.salvajes];
    for (const a of todos) {
      const s = this.aldeanoSprites.get(a.uid);
      if (!s) continue;
      const vx = a.x - s.x, vy = a.y - s.y, anda = Math.hypot(vx, vy) > 0.01;
      if (anda) s.dir = ROW_FROM_ANGLE[(Math.round(Math.atan2(vy, vx) / (Math.PI / 4)) + 8) % 8];
      s.x = a.x; s.y = a.y;
      let key: string;
      const k = this.claveSpr(a);
      if (a.hacer === 'dormir') key = `${k}-Sleep`;
      else if (anda) key = `${k}-Walk-${s.dir}`;
      else if (a.hacer === 'comer') key = this.anims.exists(`${k}-Comer-0`) ? `${k}-Comer-0` : `${k}-Idle-0`; // detrás del cajón, de frente
      else if (a.hacer === 'trabajar' && a.tarea?.tipo === 'edificio') {
        // En el horno trabaja de espaldas a cámara (si hay piedra); en la guardería juega o descansa, de frente.
        key = a.tarea.edif === 'horno' && !this.sim.esperaMaterial(a) ? `${k}-Trabajo-4` : `${k}-Idle-${a.tarea.edif === 'horno' ? 4 : 0}`;
      } else if (a.hacer === 'trabajar' && a.tarea) {
        // Mira a lo que trabaja: el árbol o la roca quedan encima; la planta, a su izquierda.
        const t = a.tarea, p = t.tipo === 'planta' ? this.sim.estado.plantas.find(q => q.uid === (a.objetivo ?? t.uid)) : undefined;
        key = p && p.fase < 5 && !a.regando ? `${k}-Idle-6` : `${k}-Trabajo-${t.tipo === 'planta' ? 6 : 4}`;
      } else key = `${k}-Idle-${a.hacer === 'esperar' ? 4 : s.dir}`;
      if (s.spr.anims.currentAnim?.key !== key && this.anims.exists(key)) s.spr.play(key, true);
      s.spr.setPosition(a.x, a.y).setDepth(a.hacer === 'dormir' ? a.y + 6 : a.y); // dormido, dentro del nido
      s.sombra.setPosition(a.x, a.y - 3).setDepth(a.y - 1).setVisible(a.hacer !== 'dormir');
      // Dentro de la Poké Ball (mientras se mueve) no se le ve.
      const dentro = !!a.salvaje?.quieto;
      s.spr.setVisible(!dentro); if (dentro) s.sombra.setVisible(false);
      if (a.carga) s.carga.setTexture(ICONO_RECURSO[a.carga.r]).setVisible(true).setPosition(a.x, a.y - 22).setDepth(a.y + 1).setScale(0.8);
      else s.carga.setVisible(false);
      if (s.bocadillo && !a.pide) { s.bocadillo.destroy(); s.bocadillo = undefined; }
      // El nido del bocadillo aparece o se va según haya nido libre.
      if (a.pide && s.bocNido !== this.necesitaNido(a)) { s.bocadillo?.destroy(); s.bocNido = !s.bocNido; s.bocadillo = this.crearBocadillo(a.pide.r, a.pide.n, s.bocNido); }
      s.bocadillo?.setPosition(a.x, a.y - 26 + Math.round(Math.sin(this.tAnim / 400))).setDepth(a.y + 2).setVisible(a.hacer === 'esperar' || a.hacer === 'irse');
      if (a.uid === this.seleccion) this.anillo.setVisible(true).setPosition(a.x, a.y - 2).setDepth(a.y - 1);
    }
    if (this.seleccion === null) this.anillo.setVisible(false);
    // Visitantes que se han ido por el camino del sur (GDD-pueblo §9.1): fuera su sprite.
    if (this.aldeanoSprites.size > todos.length) for (const [uid, s] of this.aldeanoSprites) {
      if (todos.some(a => a.uid === uid)) continue;
      s.spr.destroy(); s.sombra.destroy(); s.carga.destroy(); s.bocadillo?.destroy();
      this.aldeanoSprites.delete(uid);
    }
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
    if (this.obra !== null) { this.obra = (this.obra + d + CONSTRUIBLES.length) % CONSTRUIBLES.length; return; }
    const n = this.sim.estado.inventario.length;
    this.slot = (this.slot + d + n) % n;
  }

  // Junto a la mesa (almacén) o la caja de Pelipper: la UI enseña entonces el panel del almacén.
  cercaDelAlmacen(): boolean {
    const p = this.player;
    return this.interactivos.some(z => (z.tipo === 'almacen' || z.tipo === 'caja') && Math.hypot(z.x - p.x, z.y - p.y) < z.r + T);
  }
  private enBloque(x: number, y: number): boolean {
    return this.blocks.some(b => {
      if (x < b.x - b.w / 2 || x > b.x + b.w / 2 || y < b.y - b.h || y > b.y) return false;
      if (b.poli) return dentroDe(b.poli, x, y);
      if (!b.rombo) return true;
      // Rombo redondeado (superelipse p = 1.5): la silueta del estanque, como en el lab.
      const u = Math.abs(x - b.x) / (b.w / 2), v = Math.abs(y - b.y + b.h / 2) / (b.h / 2);
      return Math.pow(u, 1.5) + Math.pow(v, 1.5) <= 1;
    });
  }
  // Bulbasaur choca con su ancho, no solo con los pies: en el mapa dibujo, si no, medio cuerpo se metía en la pared
  // de la casa que tenía al lado (y la pared, que va delante, lo tapaba).
  private bloqueado(x: number, y: number): boolean {
    const p = this.player, a = DIBUJO ? ANCHO_JUGADOR : 0, en = (x: number, y: number) => this.enBloque(x - a, y) || this.enBloque(x, y) || this.enBloque(x + a, y);
    return this.terrain.esAgua(x, y) || this.trees.some(t => Math.hypot(x - t.x, (y - t.y) * 1.6) < t.r)
      || (en(x, y) && !en(p.x, p.y));
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
    if (this.seleccion !== null) {
      const m = this.tareaBajoCursor()?.marca;
      if (m) this.hover.setVisible(true).setPosition(m.x, m.y).setDepth(m.y - 1); else this.hover.setVisible(false);
    } else if (it || pl) this.hover.setVisible(true).setPosition(tx * T + T / 2, ty * T + (it ? T - 3 : T - 5)).setDepth(ty * T + (it ? T - 2 : 20) - 1);
    else this.hover.setVisible(false);
  }

  // Lo que hay bajo el cursor como sitio de trabajo: una planta de bayas, o el árbol/roca más cercano a la cámara.
  // `marca` es dónde va el realce: al pie del objetivo, no en el sitio donde se pondrá el aldeano.
  private tareaBajoCursor(): { t: Tarea; marca: Punto } | null {
    const ptr = this.input.activePointer, tx = Math.floor(ptr.worldX / T), ty = Math.floor(ptr.worldY / T);
    const p = this.sim.estado.plantas.find(q => q.tx === tx && q.ty === ty && (q.fase >= 3 || !q.salvaje && q.fase >= 1));
    if (p) return { t: { tipo: 'planta', uid: p.uid, ...sitioPlanta(p) }, marca: { x: tx * T + T / 2, y: ty * T + T - 5 } };
    const c = this.edificioBajoCursor();
    if (c) return { t: { tipo: 'edificio', uid: c.uid, edif: c.id, x: c.x, y: c.y + 10 }, marca: { x: c.x, y: c.y + 8 } };
    const d = this.dianaBajoCursor();
    return d ? { t: { tipo: d.tipo, x: d.sitio.x, y: d.sitio.y }, marca: { x: d.x, y: d.y - 1 } } : null;
  }
  // Un edificio con puestos de trabajo (horno, guardería) bajo el cursor; el más cercano a cámara.
  private edificioBajoCursor() {
    const ptr = this.input.activePointer;
    return this.sim.estado.construcciones.filter(c => EDIFICIO[c.id]?.puestos && this.edifSprites.get(c.uid)?.getBounds().contains(ptr.worldX, ptr.worldY))
      .sort((a, b) => b.y - a.y)[0] ?? null;
  }
  private dianaBajoCursor(): Diana | null {
    const ptr = this.input.activePointer;
    return this.dianas.filter(d => d.img.getBounds().contains(ptr.worldX, ptr.worldY)).sort((a, b) => b.y - a.y)[0] ?? null;
  }
  private aldeanoBajoCursor(): Aldeano | null {
    const ptr = this.input.activePointer;
    return this.sim.estado.aldeanos.find(a => Math.abs(ptr.worldX - a.x) < 10 && ptr.worldY > a.y - 22 && ptr.worldY < a.y + 4) ?? null;
  }

  // Acción (F, espacio o cualquier clic: todos hacen lo mismo). Por orden: aldeanos (elegir uno y
  // darle trabajo; al visitante, darle lo que pide), recoger lo del suelo, Látigo Cepa (bayas
  // maduras; rama de un árbol o piedra de una roca), almacén o cama y, si no, sembrar.
  private accion(): void {
    if (this.durmiendo || this.overview || this.obra !== null) return;
    if (this.panelCaja) { this.cerrarCaja(); return; } // F o un clic fuera del panel lo cierran
    if (this.panelCasa) { this.panelCasa = false; return; }
    const p = this.player, e = this.sim.estado, [tx, ty] = this.targetTile;
    // Un salvaje bajo el cursor (o, sin apuntar a nadie, uno a tu lado): lanzarle una Poké Ball.
    const ptr = this.input.activePointer, aMi = (a: Aldeano) => Math.hypot(a.x - p.x, a.y - p.y);
    const sal = e.salvajes.find(a => a.hacer === 'salvaje' && Math.abs(ptr.worldX - a.x) < 10 && ptr.worldY > a.y - 22 && ptr.worldY < a.y + 4)
      ?? (this.seleccion === null && !this.aldeanoBajoCursor() ? e.salvajes.find(a => a.hacer === 'salvaje' && aMi(a) < ALCANCE) : undefined);
    if (sal) { if (aMi(sal) > TIRO) this.aviso(`${this.nombreDe(sal)} salvaje: acércate más para lanzarle una Poké Ball`); else this.lanzarBall(sal); return; }
    const vis = this.sim.visitante, visCerca = vis && Math.hypot(vis.x - p.x, vis.y - p.y) < 30 ? vis : null;
    const al = this.aldeanoBajoCursor();
    if (al?.pide) { if (al === visCerca) this.procesar(this.sim.atender(al.uid)); else this.aviso(this.textoPeticion(al)); return; }
    if (al) {
      this.seleccion = al.uid;
      this.aviso(`${this.nombreDe(al)} (Nv ${al.nivel}): haz clic en un árbol, una roca, una planta de bayas o un edificio con trabajo (horno, guardería)`);
      return;
    }
    if (this.seleccion !== null) {
      const uid = this.seleccion;
      this.seleccion = null;
      this.procesar(this.sim.asignar(uid, this.tareaBajoCursor()?.t ?? null));
      return;
    }
    if (visCerca) { this.procesar(this.sim.atender(visCerca.uid)); return; }
    const dist = (it: { tx: number; ty: number }) => Math.hypot(it.tx * T + T / 2 - p.x, it.ty * T + T / 2 - p.y);
    const enObjetivo = e.suelo.find(it => it.tx === tx && it.ty === ty && dist(it) < ALCANCE);
    if (enObjetivo) { this.procesar(this.sim.recoger(enObjetivo.uid)); return; }
    const ev = this.sim.latigo(tx, ty);
    if (ev.length) { this.procesar(ev); return; }
    // Si la casilla apuntada no tiene bayas maduras, las más cercanas a su alcance (antes había que mirar justo a la planta).
    const madura = e.plantas.filter(q => q.fase === 5 && dist(q) < ALCANCE).sort((a, b) => dist(a) - dist(b))[0];
    if (madura) { this.procesar(this.sim.latigo(madura.tx, madura.ty)); return; }
    const alAlcance = (d: Diana | null | undefined) => d && Math.hypot(d.x - p.x, d.y - p.y) < ALCANCE + 12 ? d : null;
    const apuntada = alAlcance(this.dianaBajoCursor());
    if (apuntada) { this.procesar(this.sim.talar(apuntada.tipo)); return; }
    const cerca = e.suelo.map(it => ({ it, d: dist(it) })).filter(o => o.d < ALCANCE).sort((a, b) => a.d - b.d)[0]?.it;
    if (cerca) { this.procesar(this.sim.recoger(cerca.uid)); return; }
    const zona = this.interactivos.filter(z => Math.hypot(z.x - p.x, z.y - p.y) < z.r).sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y))[0];
    if (zona?.tipo === 'almacen' || zona?.tipo === 'caja') {
      // Deja los recursos que lleves en el almacén y abre la caja de Pelipper para vender.
      this.procesar(this.sim.depositar());
      this.abrirCaja();
      return;
    }
    if (zona) { this.panelCasa = true; this.seleccion = null; return; }
    const pie = alAlcance(this.dianas.find(q => Math.hypot(q.sitio.x - p.x, q.sitio.y - p.y) < T));
    if (pie) { this.procesar(this.sim.talar(pie.tipo)); return; }
    this.procesar(this.sembrar());
  }

  // Lanzar una Poké Ball a un salvaje (GDD-pueblo §12): vuela en arco, el Pokémon entra, la Ball se mueve
  // tres veces y entonces la simulación decide si se queda o sale (y a veces huye).
  private lanzarBall(sal: Aldeano): void {
    if (this.lanzando) return;
    const slot = this.sim.ballALanzar(this.slot), id = slot >= 0 ? this.sim.estado.inventario[slot]!.id : '';
    if (slot < 0) { this.aviso('No llevas ninguna Poké Ball: a veces aparecen por el valle'); return; }
    if (!this.sim.nidoLibre()) { this.procesar(this.sim.lanzar(sal.uid, slot, this.player)); return; } // no se gasta: hace falta un nido
    this.lanzando = true;
    const p = this.player, x0 = p.x, y0 = p.y - 12, x1 = sal.x, y1 = sal.y - 6;
    const ball = this.add.image(x0, y0, this.textures.exists('obj_' + id) ? 'obj_' + id : 'icono_' + id).setDepth(sal.y + 5);
    if (!this.textures.exists('obj_' + id)) ball.setScale(10 / ball.width);
    const vuelo = { t: 0 };
    this.tweens.add({
      targets: vuelo, t: 1, duration: 420, ease: 'Linear',
      onUpdate: () => ball.setPosition(x0 + (x1 - x0) * vuelo.t, y0 + (y1 - y0) * vuelo.t - Math.sin(vuelo.t * Math.PI) * 18).setAngle(vuelo.t * 540),
      onComplete: () => {
        this.sim.encerrar(sal.uid, true);
        ball.setAngle(0).setPosition(x1, sal.y - 4);
        this.tweens.add({
          targets: ball, angle: { from: -22, to: 22 }, duration: 160, yoyo: true, repeat: 2, repeatDelay: 260, delay: 250,
          onComplete: () => {
            const evs = this.sim.lanzar(sal.uid, slot, p);
            const ok = evs.some(v => v.tipo === 'atrapado');
            this.tweens.add({ targets: ball, alpha: 0, scale: ok ? ball.scale : ball.scale * 1.6, delay: ok ? 350 : 0, duration: 250, onComplete: () => ball.destroy() });
            if (ok) this.flotante(sal, '★', '#ffe27a');
            this.lanzando = false;
            this.procesar(evs);
          },
        });
      },
    });
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

  private textoPeticion(a: Aldeano): string {
    const es = ESPECIES[a.especie], p = a.pide!, nido = this.necesitaNido(a) ? ' y un nido libre (B)' : '';
    const honor = this.sim.estado.inventario.some(s => s?.id === 'honorball') && this.sim.disponible(p.r) < p.n ? ' (o con tu Honor Ball)' : '';
    return `${es?.nombre ?? a.especie} quiere ${p.n} de ${NOMBRE_RECURSO[p.r]}${nido} para quedarse (tienes ${this.sim.disponible(p.r)})${honor}. Acércate y pulsa F. Si a las 20:00 no puede quedarse, se irá y volverá otro día.`;
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
        case 'enviado': this.aviso(`${ITEMS[ev.id]?.nombre ?? ev.id} ×${ev.n} a la caja (esta noche: ${this.sim.valorCaja} Pokécoins)`); break;
        case 'sobrante': {
          const partes = (Object.entries(ev.r) as [Recurso, number][]).filter(([, n]) => n).map(([r, n]) => `${NOMBRE_RECURSO[r]} ${n}`);
          this.aviso(partes.length ? `A la caja: ${partes.join(' · ')} (esta noche: ${this.sim.valorCaja} Pokécoins)`
            : 'No sobra nada: lo que hay se guarda para construir, para los visitantes y para dos desayunos');
          break;
        }
        case 'nuevoDia': this.resumenDia(ev); break;
        case 'talado': this.aviso(`${ITEMS[ev.id]?.nombre ?? ev.id} +1`); break;
        case 'depositado': this.aviso('Al almacén: ' + (Object.entries(ev.r) as [Recurso, number][]).filter(([, n]) => n).map(([r, n]) => `${NOMBRE_RECURSO[r]} +${n}`).join(' · ')); break;
        case 'llegada': this.aviso(`¡${ESPECIES[ev.especie]?.nombre ?? ev.especie} se queda a vivir en el valle! Haz clic en él para darle trabajo.`); break;
        case 'entrega': break; // el contador del HUD ya lo muestra
        case 'visita': { const v = this.sim.visitante; if (v) this.aviso(`${ev.vuelve ? 'Vuelve' : 'Llega'} ${ESPECIES[ev.especie]?.nombre ?? ev.especie} por el camino del sur. ` + this.textoPeticion(v)); break; }
        case 'seVa': { const v = this.sim.visitante, p = v?.pide; if (p) this.aviso(`${ESPECIES[ev.especie]?.nombre ?? ev.especie} se va. Volverá cuando tengas ${p.n} de ${NOMBRE_RECURSO[p.r]} y un nido libre (o dentro de 2 días).`); break; }
        case 'sinNido': this.aviso(`${ESPECIES[ev.especie]?.nombre ?? ev.especie} necesita un nido libre para quedarse: construye uno (B)`); break;
        case 'faltan': this.aviso(`${ESPECIES[ev.especie]?.nombre ?? ev.especie}: faltan ${ev.n} de ${NOMBRE_RECURSO[ev.r]}`); break;
        case 'unido': this.aviso(`¡${ESPECIES[ev.especie]?.nombre ?? ev.especie} acepta ${ev.honor ? 'la Honor Ball' : 'el regalo'}!`); break;
        case 'salvaje': this.aviso(`Un ${ESPECIES[ev.especie]?.nombre ?? ev.especie} salvaje ronda por el valle: acércate y lánzale una Poké Ball (F). Puede fallar.`); break;
        case 'atrapado': this.aviso(`¡${ESPECIES[ev.especie]?.nombre ?? ev.especie} se queda en el valle! (${ITEMS[ev.ball]?.nombre ?? ev.ball})`); break;
        case 'escapa': this.aviso(ev.huye ? `¡Oh! ${ESPECIES[ev.especie]?.nombre ?? ev.especie} salió de la ${ITEMS[ev.ball]?.nombre ?? ev.ball} y se ha escapado`
          : `${ESPECIES[ev.especie]?.nombre ?? ev.especie} salió de la ${ITEMS[ev.ball]?.nombre ?? ev.ball}. ¡Casi! Prueba otra vez`); break;
        case 'sinBall': this.aviso('No llevas ninguna Poké Ball'); break;
        case 'construido': {
          const def = EDIFICIO[ev.id];
          this.recienHechos.add(ev.uid);
          this.modoObra(false);
          const vis = this.sim.visitante;
          const extra = ev.id === 'comedero' ? ' Cada mañana los aldeanos desayunarán aquí (una baya del almacén cada uno).'
            : def?.efecto ? ' ' + def.efecto
            : !def?.plazas || !this.sim.nidoLibre() ? ''
            : vis ? ` ${ESPECIES[vis.especie]?.nombre ?? vis.especie} ya tiene sitio: dale lo que pide.`
            : this.sim.siguienteEspecie() ? ' Pronto llegará alguien a vivir en él.' : '';
          this.aviso(`¡${def?.nombre ?? ev.id} construido!${extra}`);
          break;
        }
        case 'sinRecursos': this.aviso(`${EDIFICIO[ev.id]?.nombre ?? ev.id}: faltan ${textoCoste(ev.falta)}`); break;
        case 'mudanza': this.aviso(`${ESPECIES[ev.especie]?.nombre ?? ev.especie} se muda al nido nuevo`); break;
        // Niveles y evolución (GDD-pueblo §10): el nivel sube en un número flotante; la evolución, con aviso y destellos.
        case 'subeNivel': { const a = this.sim.estado.aldeanos.find(q => q.uid === ev.uid); if (a) this.flotante(a, `Nv ${ev.nivel}`, '#ffe27a'); break; }
        case 'evoluciona': {
          this.aviso(`¡${ev.de} evoluciona en ${ev.a}!`);
          const s = this.aldeanoSprites.get(ev.uid);
          if (s) this.time.addEvent({ delay: 120, repeat: 7, callback: () => { if (s.spr.tintFill) s.spr.clearTint(); else s.spr.setTintFill(0xffffff); } });
          break;
        }
        case 'cansado': { const a = this.sim.estado.aldeanos.find(q => q.uid === ev.uid); if (a) this.flotante(a, 'Zz', '#cfe3ff'); break; }
        case 'puestoLleno': this.aviso(`${EDIFICIO[ev.id]?.nombre ?? ev.id}: ya no cabe nadie más`); break;
        case 'cocinado': this.aviso(`Has cocinado ${ev.n === 1 ? 'un guiso' : ev.n + ' guisos'}: mañana alguien desayunará de festín (doble de experiencia)`); break;
        case 'noCocina': this.aviso(ev.falta === 'bayas' ? 'Faltan bayas: cada guiso lleva 3' : 'Estás sin energía para cocinar: duerme'); break;
        case 'mejoraCasa': {
          const m = MEJORAS_CASA.find(q => q.nivel === ev.nivel);
          this.aviso(`¡Casa mejorada: ${m?.nombre ?? ''}! ${m?.efecto ?? ''}`);
          break;
        }
        case 'noMejora': {
          const partes = [Object.keys(ev.falta).length ? textoCoste(ev.falta) : '', ev.pokecoins ? `${ev.pokecoins} Pokécoins` : ''].filter(Boolean);
          this.aviso(`Para mejorar la casa faltan ${partes.join(' y ')}`);
          break;
        }
        case 'asignado': {
          const a = this.sim.estado.aldeanos.find(q => q.uid === ev.uid), n = a ? this.nombreDe(a) : '';
          const edif = ev.tarea?.tipo === 'edificio' ? EDIFICIO[ev.tarea.edif ?? ''] : undefined;
          const sitio = { arbol: 'en el árbol (madera)', roca: 'en la roca (piedra)', planta: 'en el prado (bayas)',
            edificio: edif?.produce ? `en el ${edif.nombre.toLowerCase()} (${edif.produce.a})` : 'en la guardería (sube de nivel sin trabajar)' };
          const bien = a && ev.tarea && afin(a, ev.tarea) ? ' · ¡se le da muy bien!' : '';
          const riega = a && ev.tarea?.tipo === 'planta' && ESPECIES[a.especie]?.riega ? ' Regará lo sembrado cerca.' : '';
          this.aviso(ev.tarea ? `${n} trabajará ${sitio[ev.tarea.tipo]}${bien}${riega}` : `${n} descansa`);
          break;
        }
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
    if (ev.ingresos) { partes.push(`Pelipper trajo ${ev.ingresos} Pokécoins`); this.pelipperTrae(ev.ingresos); }
    if (ev.festin) partes.push(`${ev.festin === 1 ? 'un aldeano ha' : ev.festin + ' aldeanos han'} desayunado guiso (doble de experiencia hoy)`);
    if (ev.sinComer) partes.push(`${ev.sinComer === 1 ? 'un aldeano no ha' : ev.sinComer + ' aldeanos no han'} desayunado: ${ev.sinComedero ? 'construye un comedero (B)' : 'faltan bayas en el almacén'}`);
    if (ev.desmayo) partes.push('te desmayaste a las 2:00 (−10 % de las Pokécoins)');
    for (const id of ev.idos) partes.push(`${ESPECIES[id]?.nombre ?? id} se fue sin quedarse: volverá`);
    if (ev.visita) partes.push(`${ESPECIES[ev.visita]?.nombre ?? ev.visita} espera en la entrada del valle`);
    if (ev.salvaje) partes.push(`un ${ESPECIES[ev.salvaje]?.nombre ?? ev.salvaje} salvaje ronda por el valle`);
    this.aviso(partes.join(' · '));
  }

  private toggleOverview(): void {
    const cam = this.cameras.main, { W, H } = this.terrain;
    this.modoObra(false); this.cerrarCaja(); this.panelCasa = false;
    this.overview = !this.overview;
    if (this.overview) cam.stopFollow().removeBounds().setZoom(Math.min(VW * S / W, VH * S / H)).centerOn(W / 2, H / 2);
    else cam.setZoom(S).setBounds(0, 0, W, H).startFollow(this.player, true, 1, 1);
  }

  update(_t: number, dtMs: number): void {
    if (!this.listo) return;
    this.luzDelDia(_t);
    this.aclarar(dtMs);
    const p = this.player, k = this.keys, dt = dtMs / 1000;
    if (!this.durmiendo) {
      const evs = this.sim.tick(dt);
      const desmayo = evs.some(v => v.tipo === 'nuevoDia');
      if (evs.length && !desmayo) this.procesar(evs);
      if (desmayo) {
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
    if ((vx || vy) && this.panelCaja) this.cerrarCaja(); // al echar a andar se cierra la caja
    if ((vx || vy) && this.panelCasa) this.panelCasa = false;
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
    this.dibujarAldeanos();
    this.calcularObjetivo();
    this.moverFantasma();
    if (this.overview || this.durmiendo || this.obra !== null) this.hover.setVisible(false);
    // Vaivén de 2 fotogramas de las plantas.
    this.tAnim += dtMs;
    const f2 = Math.floor(this.tAnim / PASO_ANIM_BAYA) % 2;
    for (const s of this.plantaSprites.values()) {
      if (s.fase === 2) s.img.setFrame(f2);
      else if (s.fase >= 3) s.img.setFrame((s.fase - 3) * 2 + f2);
    }
  }
}
