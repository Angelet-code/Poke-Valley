// Modo aventura (docs/GDD-combate.md): manejas a un Pokémon por mapas cerrados en estilo dibujo, peleas en tiempo
// real con los salvajes del bosque usando la barra de atajos (movimientos y objetos), los capturas con Poké Balls y
// subes de nivel derrotándolos. Los capturados se van al pueblo; allí puedes convertirte en cualquiera de ellos (F a
// su lado). Las animaciones de los movimientos son las de Pokémon Colleja (src/fx/), sobre un canvas encima del juego.
// Reglas en src/combate/reglas.ts; partida (equipo, mochila, hora) en src/combate/partida.ts; HUD en HudAventura.ts.
import Phaser from 'phaser';
import { REG, ROW_FROM_ANGLE, S, VH, VW } from '../config';
import { PALETA_DIBUJO, type Colocado } from '../data/mapaDibujo';
import { crearMapa, type Alfa, type MapaAventura, type MapaId, type Punto, type Ronda } from '../data/bosque';
import { FORMAS } from '../data/pokedex';
import type { Mision } from '../combate/misiones';
import { dentroDe, dibujar, puntoLuz, tapa, type Elemento, type Pieza } from '../render/Dibujo';
import { TIPOS_LUZ, animarLuz, type TipoLuz } from '../render/luces';
import { pipelineCel } from '../render/CelPipeline';
import { Terrain } from '../render/Terrain';
import { farolas, luzAmbiente } from '../sim/World';
import { ESPECIES } from '../data/especies';
import { BALL, ITEMS } from '../data/items';
import { COLOR_TIPO, getMove, tiposDe, type Boosts, type MoveData, type Stat6, type TypeName } from '../data/movimientos';
import { animationFor } from '../fx/catalog';
import { type MoveTexts } from '../fx/templates';
import { animarMovimiento } from '../fx/firmas';
import { TYPE_FX } from '../fx/fx/palette';
import { Stage, fxSprite, type FxSprite, type SlotGeometry } from '../fx/stage';
import type { MoveCue } from '../fx/tipos';
import { CASILLAS, HOGAR_CARGA, HOGAR_CD, PROB_SHINY, Partida, movsHasta, type Aviso, type Miembro } from '../combate/partida';
import {
  CLIMA_DE, COLOR_ESTADO, CORTO_ESTADO, DANO_ESTADO, DURA_BOOST, DURA_CLIMA, DURA_ESTADO, FIN_CLIMA, GCD, NOMBRE_CLIMA, NOMBRE_ESTADO, NOMBRE_STAT,
  TURNO, VEL_PARALIZADO, alcance, curaClima, danaClima, enfriamiento, expPor, formaDe, golpe, necesitaObjetivo, probCaptura, statsDe,
  type Clima, type Stats,
} from '../combate/reglas';
import { ancla, cargar, clave, idSprite, info, listo, poner, type AnimId } from '../combate/sprites';
import { ESTADO_CADA, TINTE_ESTADO, auraEstado } from '../fx/estados';
import type { WeatherLook } from '../fx/fx/weather';
import type { DatosEvolucion } from './Evolucion';

const VEL = 84;                    // px/s del jugador
const ANCHO = 9;                   // medio ancho del cuerpo contra paredes
const TIRO = 150;                  // hasta dónde llega una Poké Ball
const RESPAWN = 40;                // s hasta que vuelve a salir un salvaje en su sitio
const CORREA = 330;                // px: un salvaje que te persigue más lejos de su sitio se vuelve (y se cura)
const CURA_FUERA = 0.05;           // fracción de vida por segundo fuera de combate (6 s sin recibir)
// Alfas (docs/GDD-mundo.md §2): más grandes, con aura, el triple de vida y un golpe anunciado en el suelo.
const ALFA_ESCALA = 1.4;
const ALFA_VIDA = 3;
const ALFA_RESPAWN = 5 * 60;       // s
const ALFA_CADA = 8;               // s entre golpes anunciados
const ALFA_AVISO = 1.8;            // s que tarda en llenarse el círculo
const ALFA_RADIO = 38;             // px (medio ancho del círculo; en el suelo se ve achatado)
const ALFA_DANO = 0.35;            // fracción de tu vida si te pilla dentro
const TABLON_CERCA = 44;           // px para abrir el tablón con F

// Cómo se ve cada clima (capa de fx/weather.ts) y cómo tiñe la luz del mapa (multiplica la luz ambiente).
const ASPECTO_CLIMA: Record<Clima, WeatherLook> = { lluvia: 'rain', sol: 'sun', arena: 'sand', nieve: 'snow', granizo: 'hail' };
const LUZ_CLIMA: Record<Clima, [number, number, number]> = { lluvia: [0.84, 0.88, 0.96], sol: [1.1, 1.02, 0.86], arena: [1, 0.86, 0.68], nieve: [0.92, 0.96, 1.06], granizo: [0.82, 0.86, 0.95] };
// Bufos y debufos (los iconos del HUD y de las placas): estados y cambios de stats, con lo que les queda.
export interface Aura { txt: string; color: number; frac: number; nombre: string }
const CORTO_STAT: Record<Stat6, string> = { atk: 'At', def: 'Df', spa: 'AE', spd: 'DE', spe: 'Ve', accuracy: 'Pr', evasion: 'Ev' };

export type Temple = 'amistoso' | 'huidizo' | 'agresivo';
export const NOMBRE_TEMPLE: Record<Temple, string> = { amistoso: 'Tranquilo', huidizo: 'Asustadizo', agresivo: 'Peleón' };
export const COLOR_TEMPLE: Record<Temple, number> = { amistoso: 0x8fd36a, huidizo: 0xffd65a, agresivo: 0xff7a5a };

interface Bloque { x: number; y: number; w: number; h: number; rombo?: boolean; poli?: [number, number][] }
// Lo que un movimiento cambia en alguien además del daño: stats o un estado.
interface Efecto { quien: Luchador; boosts?: Boosts; estado?: string }
interface Luz { luz: Phaser.GameObjects.Light; halo: Phaser.GameObjects.Image; tipo: TipoLuz; fase: number }

export interface Luchador {
  uid: string; rol: 'jugador' | 'salvaje' | 'vecino';
  linea: string; nivel: number; miembro?: Miembro; ronda?: Ronda;
  dex: string; nombre: string; tipos: TypeName[];
  stats: Stats; ps: number; boosts: Boosts; boostHasta: Partial<Record<Stat6, number>>;
  estado: string | null; estadoHasta: number; ticEstado: number; toxN: number; auraEn: number;
  x: number; y: number; dir: number; anda: boolean;
  spr: Phaser.GameObjects.Sprite; sombra: Phaser.GameObjects.Ellipse; fx: FxSprite; alto: number;
  movs: string[]; cd: Record<string, number>; gcd: number;
  anim: AnimId | null; animHasta: number; quietoHasta: number;
  temple: Temple; modo: 'pasear' | 'huir' | 'pelear' | 'volver'; casa: Punto; meta: Punto | null; espera: number;
  huirHasta: number; ultimoDano: number; rival: Luchador | null;
  muerto: boolean; enBall: boolean;
  forma?: string;                      // forma fija (el alfa); si no, la de su nivel
  alfa?: boolean; escala: number; aura?: Phaser.GameObjects.Image; auraSuelo?: Phaser.GameObjects.Ellipse; golpeAlfa: number;
  shiny?: boolean; visto?: boolean;    // shiny: destella la primera vez que entra en pantalla (`visto`)
}

export class Aventura extends Phaser.Scene {
  partida!: Partida;
  mapa!: MapaAventura;
  probShiny = PROB_SHINY;             // de cada salvaje que aparece (en la consola se puede subir para probar)
  stage!: Stage;
  jugador!: Luchador;
  salvajes: Luchador[] = [];
  vecinos: Luchador[] = [];
  objetivo: Luchador | null = null;
  panel: 'movs' | 'misiones' | null = null;   // panel abierto (K movimientos, F en el tablón): lo dibuja el HUD
  asignando: { m: string } | { i: string } | null = null; // atajo elegido en el panel, a la espera de casilla
  listo = false;
  private terrain!: Terrain;
  private blocks: Bloque[] = [];
  private piezas: Pieza[] = [];
  private luces: Luz[] = [];
  private luzJugador: Phaser.GameObjects.Light | null = null;
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;
  private anillo!: Phaser.GameObjects.Ellipse;
  private barras!: Phaser.GameObjects.Graphics;
  private uid = 0;
  private montaje = 0;
  private cambiando = false;
  private lanzando = false;
  private ahora = 0;                   // s de juego (this.time.now / 1000, sin lo que ha estado en pausa)
  private desfase = 0;                 // s que ha estado en pausa (cinemática de la evolución)
  evolucionando = false;
  // Clima del mapa (Danza Lluvia, Día Soleado…): hasta cuándo dura; daña por turnos a quien no aguanta la arena o el granizo.
  clima: { tipo: Clima; hasta: number } | null = null;
  private climaTic = 0;
  // Golpe anunciado de un alfa: el círculo del suelo que se llena; al llenarse, daña a quien siga dentro.
  private marca: { x: number; y: number; t0: number; t1: number; de: Luchador } | null = null;
  private marcaG!: Phaser.GameObjects.Graphics;
  private senal: Phaser.GameObjects.Text | null = null;   // "!" o "?" sobre el tablón
  // Piedra de hogar canalizándose (s de juego): la barra de lanzamiento la pinta el HUD.
  hogar: { t0: number; t1: number } | null = null;
  private hogarLuz: Phaser.GameObjects.Ellipse | null = null;

  constructor() { super('aventura'); }

  create(data: { nueva?: boolean; mapa?: MapaId; desde?: MapaId | 'inicio' }): void {
    this.listo = false;
    const espera = this.add.text(VW * S / 2, VH * S / 2, 'Preparando el mapa…', { fontFamily: '"Segoe UI", system-ui, sans-serif', fontSize: `${7 * S}px`, color: '#e4ecd8' }).setOrigin(0.5).setScrollFactor(0);
    const n = ++this.montaje;
    this.montar(data, n).catch(e => console.error(e)).finally(() => espera.destroy());
  }

  private async montar(data: { nueva?: boolean; mapa?: MapaId; desde?: MapaId | 'inicio' }, n: number): Promise<void> {
    this.blocks = []; this.piezas = []; this.luces = []; this.salvajes = []; this.vecinos = []; this.objetivo = null; this.panel = null; this.asignando = null;
    this.cambiando = false; this.lanzando = false; this.luzJugador = null; this.clima = null; this.evolucionando = false; this.marca = null; this.senal = null; this.hogar = null; this.hogarLuz = null;
    if (!this.partida || data.nueva) this.partida = (data.nueva ? null : Partida.cargar()) ?? Partida.nueva();
    const id = data.mapa ?? 'pueblo';
    this.mapa = crearMapa(id, this.partida.estado.semilla);
    this.partida.guardar();

    // Luz: el pipeline cel para los Pokémon con normales y Light2D para todo lo demás (como WorldScene).
    this.events.off(Phaser.Scenes.Events.ADDED_TO_SCENE, this.iluminar, this);
    const cel = pipelineCel(this); cel.altura = 0.5; cel.bandas = 3; cel.suave = 0.5; cel.ganancia = 0.55;
    this.lights.enable().setAmbientColor(0xffffff);
    this.events.on(Phaser.Scenes.Events.ADDED_TO_SCENE, this.iluminar, this);

    this.terrain = new Terrain(this.mapa.datos, S, { paleta: PALETA_DIBUJO, decals: false });
    // Sprites de quien sale en este mapa (en paralelo al suelo).
    const formas = [this.partida.activo, ...(this.mapa.id === 'pueblo' ? this.partida.estado.equipo : [])].map(m => idSprite(formaDe(m.linea, m.nivel).dex, m.shiny));
    for (const r of this.mapa.salvajes) formas.push(formaDe(r.linea, r.nivel).dex);
    if (this.mapa.alfa) formas.push(FORMAS[this.mapa.alfa.forma].dex);
    for (const m of this.partida.misiones) formas.push(m.dex);   // caras de los iconos de misión (HUD)
    await Promise.all([this.terrain.calcular(this), cargar(this, formas)]);
    if (n !== this.montaje || !this.sys.isActive()) return;
    this.terrain.build(this);
    this.crearEscenario();

    this.stage?.dispose();
    this.stage = new Stage(this);
    this.stage.geometria = uid => { const l = [this.jugador, ...this.salvajes, ...this.vecinos].find(q => q?.uid === uid); return l && !l.muerto ? this.geo(l) : null; };
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.stage.dispose());

    const lleg = this.mapa.llegada[data.desde ?? 'inicio'] ?? this.mapa.llegada.inicio!;
    this.jugador = this.crearLuchador('jugador', this.partida.activo.linea, this.partida.activo.nivel, lleg.x, lleg.y, this.partida.activo);
    this.jugador.ps = Math.max(1, Math.round(this.jugador.stats.hp * this.partida.activo.ps));
    this.jugador.dir = lleg.dir;
    for (const r of this.mapa.salvajes) this.salvajes.push(this.crearSalvaje(r));
    if (this.mapa.id === 'pueblo') this.crearVecinos();
    this.ponerAlfa();
    if (this.mapa.tablon) {
      const t = this.mapa.tablon;
      this.senal = this.add.text(t.x, t.y - 34, '!', { fontFamily: '"Pixelify Sans", "Segoe UI", sans-serif', fontSize: `${18 * S}px`, fontStyle: 'bold', color: '#ffd84a', stroke: '#3a2412', strokeThickness: 3 * S })
        .setOrigin(0.5, 1).setScale(1 / S).setDepth(1e5).setVisible(false);
    }
    this.marcaG = this.add.graphics().setDepth(-6000);

    this.anillo = this.add.ellipse(0, 0, 22, 8, 0xffd65a, 0.5).setVisible(false);
    this.barras = this.add.graphics().setDepth(1e5);
    this.anillo.resetPipeline(); this.barras.resetPipeline();
    const cam = this.cameras.main;
    cam.setZoom(S).setBounds(0, 0, this.mapa.W, this.mapa.H).startFollow(this.jugador.spr, true, 1, 1).setRoundPixels(true);
    cam.fadeIn(350, 0, 0, 0);

    this.entradas();
    if (!this.scene.isActive('hud')) this.scene.launch('hud');
    this.listo = true;
    // El HUD recién lanzado se crea en el siguiente paso: el rótulo de la zona y el aviso, un poco después.
    const mapa = this.mapa;
    this.time.delayedCall(250, () => {
      if (this.mapa !== mapa) return;
      this.events.emit('zona', { nombre: mapa.nombre, lema: mapa.lema });
      this.aviso(mapa.id !== 'pueblo' ? mapa.bienvenida
        : this.partida.estado.equipo.length > 1 ? 'El pueblo. Pulsa F junto a uno de tus Pokémon para convertirte en él, o junto al tablón de la plaza para ver las misiones.'
        : 'El pueblo. F junto al tablón de la plaza: misiones. El camino del sur lleva al bosque. Teclas 1-0: tu barra (K para colocar movimientos).');
    });
  }

  // ---- Escenario: elementos Klein con su huella como colisión, farolas, detalles ----
  private crearEscenario(): void {
    const cat = this.registry.get(REG.dibujo) as { elementos: Elemento[] }, porId = new Map(cat.elementos.map(e => [e.id, e]));
    for (const c of this.mapa.colocados) {
      const el = porId.get(c.id);
      if (!el) continue;
      const p = dibujar(this, el, c);
      if (!p.plano) this.piezas.push(p);
      if (p.suelo) for (const poli of p.suelo) {
        const xs = poli.map(q => q[0]), ys = poli.map(q => q[1]), x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
        this.blocks.push({ x: (x0 + x1) / 2, y: y1, w: x1 - x0, h: y1 - y0, poli });
      } else if (p.huella) { const h = p.huella; this.blocks.push({ x: (h.x0 + h.x1) / 2, y: h.y1, w: h.x1 - h.x0, h: h.y1 - h.y0, rombo: el.tipo === 'estanque' }); }
      const l = puntoLuz(p);
      if (l) this.encender(l[0], l[1], TIPOS_LUZ[c.luz ?? (el.id === 'hoguera' ? 'hoguera' : 'farol')], p.base + 1);
    }
    // Detalles por el césped libre (semilla fija por mapa).
    const ids = cat.elementos.filter(e => e.tipo === 'detalle').map(e => e.id);
    const { W, H } = this.mapa, rnd = Phaser.Math.RND;
    rnd.sow([this.mapa.id === 'pueblo' ? 'pueblo' : `${this.mapa.id}-${this.partida.estado.semilla}`]);
    for (let i = 0, k = 0; i < this.mapa.detalles * 6 && k < this.mapa.detalles; i++) {
      const x = rnd.between(30, W - 30), y = rnd.between(30, H - 30);
      if (this.enBloque(x, y) || this.terrain.nearWater(x, y, 10) || this.blocks.some(b => x > b.x - b.w / 2 - 12 && x < b.x + b.w / 2 + 12 && y > b.y - b.h - 40 && y < b.y + 12)) continue;
      const c: Colocado = { id: ids[rnd.between(0, ids.length - 1)], x, y, flip: rnd.frac() < 0.5 };
      dibujar(this, porId.get(c.id)!, c); k++;
    }
  }
  private encender(x: number, y: number, tipo: TipoLuz, depth: number): void {
    if (!this.textures.exists('halo')) {
      const n = 64, c = this.textures.createCanvas('halo', n, n)!, g = c.getContext(), grad = g.createRadialGradient(n / 2, n / 2, 0, n / 2, n / 2, n / 2);
      grad.addColorStop(0, 'rgba(255,255,255,0.9)'); grad.addColorStop(0.35, 'rgba(255,255,255,0.35)'); grad.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = grad; g.fillRect(0, 0, n, n); c.refresh(); c.setFilter(Phaser.Textures.FilterMode.LINEAR);
    }
    const luz = Object.assign(this.lights.addLight(x, y, tipo.radio, tipo.color, 0), { cel: tipo });
    const halo = this.add.image(x, y, 'halo').setDisplaySize(tipo.radio * 0.5, tipo.radio * 0.5).setTint(tipo.color).setAlpha(0).setBlendMode(Phaser.BlendModes.ADD).setDepth(depth);
    halo.resetPipeline();
    this.luces.push({ luz, halo, tipo, fase: Math.random() * 100 });
  }
  private iluminar(go: Phaser.GameObjects.GameObject): void {
    if (go instanceof Phaser.GameObjects.Image || go instanceof Phaser.GameObjects.Sprite) go.setPipeline(go.texture.dataSource.length ? 'Cel' : 'Light2D');
  }
  private luzDelDia(t: number): void {
    const m = this.partida.estado.minuto, [r0, g0, b0] = luzAmbiente(m), k = this.clima ? LUZ_CLIMA[this.clima.tipo] : [1, 1, 1];
    const r = Math.min(255, Math.round(r0 * k[0])), g = Math.min(255, Math.round(g0 * k[1])), b = Math.min(255, Math.round(b0 * k[2]));
    this.lights.setAmbientColor((r << 16) | (g << 8) | b);
    const on = farolas(m);
    for (const l of this.luces) { const f = animarLuz(l.tipo, t / 1000, l.fase) * on; l.luz.setIntensity(l.tipo.intensidad * f); l.halo.setAlpha(l.tipo.halo * f); }
    // De noche, una luz suave alrededor de ti (en el bosque no hay farolas) y las partículas se suman como luz.
    const oscuro = 1 - (r + g + b) / 765;
    if (!this.luzJugador) this.luzJugador = this.lights.addLight(0, 0, 150, 0xfff0d0, 0);
    this.luzJugador.setPosition(this.jugador.x, this.jugador.y - 14).setIntensity(Math.max(0, oscuro - 0.25) * 1.6);
    this.stage.fx.blend = oscuro > 0.45 ? 'lighter' : 'source-over';
  }
  // Lo que te tapa (copas, tejados) se aclara mientras estás detrás.
  private aclarar(dtMs: number): void {
    const p = this.jugador, puntos = [[0, -4], [0, -12], [0, -19], [-8, -8], [8, -8]], paso = Math.min(1, dtMs / 120);
    for (const q of this.piezas) {
      const b = q.img.getBounds(), cerca = p.x > b.left - 10 && p.x < b.right + 10 && p.y > b.top && p.y - 20 < b.bottom;
      const meta = cerca && puntos.some(([dx, dy]) => tapa(q, p.x + dx, p.y + dy, p.y)) ? 0.45 : 1;
      if (q.img.alpha === meta) continue;
      const al = Math.abs(meta - q.img.alpha) < 0.02 ? meta : q.img.alpha + (meta - q.img.alpha) * paso;
      for (const im of q.partes) im.setAlpha(al);
    }
  }

  // ---- Colisiones ----
  private enBloque(x: number, y: number): boolean {
    return this.blocks.some(b => {
      if (x < b.x - b.w / 2 || x > b.x + b.w / 2 || y < b.y - b.h || y > b.y) return false;
      if (b.poli) return dentroDe(b.poli, x, y);
      if (!b.rombo) return true;
      const u = Math.abs(x - b.x) / (b.w / 2), v = Math.abs(y - b.y + b.h / 2) / (b.h / 2);
      return Math.pow(u, 1.5) + Math.pow(v, 1.5) <= 1;
    });
  }
  private bloqueado(l: Luchador, x: number, y: number): boolean {
    // Bloquean los elementos (su huella) y el agua del suelo (el lago).
    const a = l.rol === 'jugador' ? ANCHO : 6, en = (x: number, y: number) => this.enBloque(x - a, y) || this.enBloque(x, y) || this.enBloque(x + a, y)
      || this.terrain.esAgua(x - a, y) || this.terrain.esAgua(x + a, y) || this.terrain.esAgua(x, y - 3);
    if (x < 10 || y < 14 || x > this.mapa.W - 10 || y > this.mapa.H - 2) return true;
    return en(x, y) && !en(l.x, l.y);   // si ya está dentro (aparece encima de algo), puede salir
  }
  private mover(l: Luchador, vx: number, vy: number, vel: number, dt: number): boolean {
    const len = Math.hypot(vx, vy);
    if (len < 1e-3) return false;
    const nx = l.x + vx / len * vel * dt, ny = l.y + vy / len * vel * dt;
    let movido = false;
    if (!this.bloqueado(l, nx, l.y)) { l.x = nx; movido = true; }
    if (!this.bloqueado(l, l.x, ny)) { l.y = ny; movido = true; }
    l.dir = ROW_FROM_ANGLE[(Math.round(Math.atan2(vy, vx) / (Math.PI / 4)) + 8) % 8];
    return movido;
  }

  // ---- Luchadores ----
  // Shiny: el de tu equipo si lo es (`miembro.shiny`); un salvaje, si se pide. Si sus hojas shiny aún no están
  // cargadas (salvaje que acaba de salir shiny), sale con las normales y cambia en cuanto cargan.
  private crearLuchador(rol: Luchador['rol'], linea: string, nivel: number, x: number, y: number, miembro?: Miembro, forma?: string, shiny = false): Luchador {
    const f = forma ? FORMAS[forma] : formaDe(linea, nivel), sh = miembro?.shiny ?? shiny, dexS = idSprite(f.dex, sh);
    const dex = listo(this, dexS) ? dexS : f.dex, k = clave(dex), idle = info(dex).Idle, an = ancla(dex);
    const spr = this.add.sprite(x, y, idle ? `${k}-${idle.hoja}` : '__DEFAULT');
    poner(spr, dex, 'Idle', 0);
    const ancho = Math.max(10, Math.min(34, an.ancho * 0.75));
    const sombra = this.add.ellipse(x, y - 1, ancho, ancho * 0.36, 0x2c4422, 0.3);
    sombra.resetPipeline();
    const stats = statsDe(f.base, nivel);
    const l: Luchador = {
      uid: `${rol}-${++this.uid}`, rol, linea, nivel, miembro, dex, nombre: f.nombre, tipos: tiposDe(f.id),
      stats, ps: stats.hp, boosts: {}, boostHasta: {}, estado: null, estadoHasta: 0, ticEstado: 0, toxN: 0, auraEn: 0,
      x, y, dir: 0, anda: false, spr, sombra, fx: fxSprite(spr), alto: Math.min(56, an.alto),
      movs: miembro ? miembro.movs : movsHasta(f.id, nivel), cd: {}, gcd: 0, anim: null, animHasta: 0, quietoHasta: 0,
      temple: 'agresivo', modo: 'pasear', casa: { x, y }, meta: null, espera: Math.random() * 2, huirHasta: 0, ultimoDano: -99, rival: null,
      muerto: false, enBall: false, forma, escala: 1, golpeAlfa: 0, shiny: sh,
    };
    if (dex !== dexS) void cargar(this, [dexS]).then(() => { if (l.spr.active && listo(this, dexS)) l.dex = dexS; });
    return l;
  }
  private formaL(l: Luchador) { return l.forma ? FORMAS[l.forma] : formaDe(l.linea, l.nivel); }
  private crearSalvaje(r: Ronda): Luchador {
    const l = this.crearLuchador('salvaje', r.linea, r.nivel, r.x, r.y, undefined, undefined, Math.random() < this.probShiny);
    l.ronda = r;
    const t = Math.random();
    l.temple = t < 0.25 ? 'amistoso' : t < 0.6 ? 'huidizo' : 'agresivo';
    return l;
  }
  // El alfa de la zona: la forma fija, ×1,4, con aura y el triple de vida. Siempre peleón. Si cayó hace menos de
  // 5 minutos (`estado.alfas`, en tiempo real), sale cuando toque.
  private ponerAlfa(): void {
    const a = this.mapa.alfa;
    if (!a) return;
    const cayo = this.partida.estado.alfas?.[this.mapa.id] ?? 0, falta = ALFA_RESPAWN * 1000 - (Date.now() - cayo);
    if (falta <= 0) { this.salvajes.push(this.crearAlfa(a)); return; }
    const mapa = this.mapa;
    this.time.delayedCall(falta, () => { if (this.mapa === mapa && this.listo) { this.salvajes.push(this.crearAlfa(a)); this.aviso(`Ha vuelto el ${FORMAS[a.forma].nombre} alfa`); } });
  }
  private crearAlfa(a: Alfa): Luchador {
    const l = this.crearLuchador('salvaje', a.linea, a.nivel, a.x, a.y, undefined, a.forma, Math.random() < this.probShiny);
    l.alfa = true; l.escala = ALFA_ESCALA; l.temple = 'agresivo'; l.nombre += ' alfa';
    l.alto = Math.min(80, l.alto * ALFA_ESCALA);
    l.stats = { ...l.stats, hp: l.stats.hp * ALFA_VIDA }; l.ps = l.stats.hp;
    l.sombra.setSize(l.sombra.width * ALFA_ESCALA, l.sombra.height * ALFA_ESCALA);
    this.halo();
    l.aura = this.add.image(a.x, a.y, 'halo').setTint(0xff6a3a).setBlendMode(Phaser.BlendModes.ADD);
    l.auraSuelo = this.add.ellipse(a.x, a.y, 10, 4).setStrokeStyle(1, 0xff7a4a, 0.8);
    l.aura.resetPipeline(); l.auraSuelo.resetPipeline();
    l.golpeAlfa = this.ahora + 3;
    return l;
  }
  // Destello de shiny: unas estrellas que salen del cuerpo y se apagan (como al entrar en combate en los juegos).
  private destello(l: Luchador): void {
    const cy = l.y - l.alto * 0.5 * l.escala;
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2 + Math.random() * 0.5, r = (12 + l.alto * 0.4) * l.escala;
      const st = this.add.text(l.x, cy, '✦', { fontFamily: '"Segoe UI Symbol", "Segoe UI", sans-serif', fontSize: `${(8 + Math.random() * 5) * S}px`, color: '#fff6b0', stroke: '#c8a020', strokeThickness: 1 * S })
        .setOrigin(0.5).setScale(0.2 / S).setDepth(1e5).setAlpha(0);
      st.resetPipeline();
      this.tweens.add({ targets: st, x: l.x + Math.cos(a) * r, y: cy + Math.sin(a) * r * 0.8, scale: 1 / S, alpha: { from: 1, to: 0 }, angle: 90,
        delay: i * 60 + (i % 2) * 260, duration: 650, ease: 'Cubic.easeOut', onComplete: () => st.destroy() });
    }
  }
  private halo(): void {
    if (this.textures.exists('halo')) return;
    const n = 64, c = this.textures.createCanvas('halo', n, n)!, g = c.getContext(), grad = g.createRadialGradient(n / 2, n / 2, 0, n / 2, n / 2, n / 2);
    grad.addColorStop(0, 'rgba(255,255,255,0.9)'); grad.addColorStop(0.35, 'rgba(255,255,255,0.35)'); grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad; g.fillRect(0, 0, n, n); c.refresh(); c.setFilter(Phaser.Textures.FilterMode.LINEAR);
  }
  // Golpe anunciado del alfa: se para, se carga y marca en el suelo dónde estás; el círculo se llena en ALFA_AVISO s.
  private golpeAlfa(l: Luchador, r: Luchador): boolean {
    if (this.marca || l.golpeAlfa > this.ahora || r.rol !== 'jugador' || Math.hypot(r.x - l.x, r.y - l.y) > 190) return false;
    this.marca = { x: r.x, y: r.y, t0: this.ahora, t1: this.ahora + ALFA_AVISO, de: l };
    l.golpeAlfa = this.ahora + ALFA_CADA + Math.random() * 3;
    l.quietoHasta = this.ahora + ALFA_AVISO + 0.3; l.meta = null;
    this.mirarA(l, r);
    this.reproducir(l, 'Charge', ALFA_AVISO * 1000);
    return true;
  }
  private pasoMarca(): void {
    const g = this.marcaG, mk = this.marca;
    g.clear();
    if (!mk) return;
    const l = mk.de, p = this.jugador;
    if (l.muerto || l.modo !== 'pelear') { this.marca = null; return; }
    const f = Math.min(1, (this.ahora - mk.t0) / (mk.t1 - mk.t0)), w = ALFA_RADIO * 2, h = ALFA_RADIO * 1.3;
    g.fillStyle(0xff3a1a, 0.16).fillEllipse(mk.x, mk.y, w, h);
    g.fillStyle(0xff4a2a, 0.22 + 0.2 * f).fillEllipse(mk.x, mk.y, w * f, h * f);
    g.lineStyle(1.2, 0xff5a3a, 0.6 + 0.4 * Math.abs(Math.sin(this.ahora * 10))).strokeEllipse(mk.x, mk.y, w, h);
    if (f < 1) return;
    this.marca = null;
    this.mirarA(l, mk);
    this.reproducir(l, 'Attack');
    this.cameras.main.shake(180, 0.004);
    this.stage.hitFlash(l.fx, 150);
    const dentro = ((p.x - mk.x) / ALFA_RADIO) ** 2 + ((p.y - mk.y) / (h / 2)) ** 2 < 1;
    if (dentro && !p.muerto) this.danar(p, Math.max(1, Math.round(p.stats.hp * ALFA_DANO)), l);
    else if (!p.muerto) this.stage.label(this.geo(p).top, '¡Esquivado!', 'good');
  }

  // Tus otros Pokémon pasean por el pueblo, cerca de la plaza.
  private crearVecinos(): void {
    const otros = this.partida.estado.equipo.filter(m => m.uid !== this.partida.activo.uid);
    otros.forEach((m, i) => {
      const a = (i / Math.max(1, otros.length)) * Math.PI * 2, c = this.mapa.llegada.inicio!;
      let x = c.x + Math.cos(a) * 70, y = c.y + 40 + Math.sin(a) * 40;
      for (let k = 0; k < 30 && this.enBloque(x, y); k++) { x = c.x + (Math.random() - 0.5) * 300; y = c.y + (Math.random() - 0.2) * 200; }
      const l = this.crearLuchador('vecino', m.linea, m.nivel, x, y, m);
      l.temple = 'amistoso';
      this.vecinos.push(l);
    });
  }
  private quitar(l: Luchador): void {
    l.spr.destroy(); l.sombra.destroy(); l.aura?.destroy(); l.auraSuelo?.destroy();
    this.salvajes = this.salvajes.filter(q => q !== l);
    if (this.objetivo === l) this.objetivo = null;
  }

  // Geometría para las animaciones (px de escenario).
  private geo(l: Luchador): SlotGeometry {
    const k = this.stage.k;
    return {
      slot: l.uid, side: l.rol === 'salvaje' ? 'p2' : 'p1',
      center: { x: l.x * k, y: (l.y - l.alto * 0.45) * k }, feet: { x: l.x * k, y: (l.y - 2) * k }, top: { x: l.x * k, y: (l.y - l.alto) * k },
      size: Math.max(22, l.alto * 1.45) * k, sprite: l.fx,
    };
  }
  private reproducir(l: Luchador, a: AnimId, ms?: number): void {
    const h = info(l.dex)[a];
    if (!h) return;
    if (!poner(l.spr, l.dex, a, l.dir)) return;
    this.iluminar(l.spr);
    l.anim = a; l.animHasta = this.ahora + (ms ?? h.durs.reduce((t, d) => t + d, 0) * 1000 / 60) / 1000;
  }
  private mirarA(l: Luchador, o: Punto): void {
    l.dir = ROW_FROM_ANGLE[(Math.round(Math.atan2(o.y - l.y, o.x - l.x) / (Math.PI / 4)) + 8) % 8];
  }

  // ---- Entrada ----
  private entradas(): void {
    const kb = this.input.keyboard!;
    this.keys = kb.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT,F,SPACE,ESC,TAB,K,H', false) as Record<string, Phaser.Input.Keyboard.Key>;
    // Al perder el foco (otra ventana, Alt+Tab) no llega el "soltar": que no se quede andando solo.
    const soltar = () => kb.resetKeys();
    this.game.events.on(Phaser.Core.Events.BLUR, soltar);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.game.events.off(Phaser.Core.Events.BLUR, soltar));
    const nums = ['ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX', 'SEVEN', 'EIGHT', 'NINE', 'ZERO'];
    nums.forEach((n, i) => kb.addKey(n).on('down', () => this.casilla(i)));
    this.keys.TAB.on('down', (e: KeyboardEvent) => { e?.preventDefault?.(); this.siguienteObjetivo(); });
    kb.addCapture('TAB');
    this.keys.F.on('down', () => this.interactuar());
    this.keys.SPACE.on('down', () => this.interactuar());
    this.keys.H.on('down', () => this.usarHogar());
    this.keys.K.on('down', () => { this.panel = this.panel === 'movs' ? null : 'movs'; this.asignando = null; });
    this.keys.ESC.on('down', () => {
      if (this.hogar) { this.cortarHogar(); return; }
      if (this.asignando) { this.asignando = null; return; }
      if (this.panel) { this.panel = null; return; }
      if (this.objetivo) { this.objetivo = null; return; }
      this.guardar(); this.scene.stop('hud'); this.scene.start('title');
    });
    this.input.mouse!.disableContextMenu();
    // Clic en un Pokémon: objetivo (el HUD se queda con los clics que caen en él).
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (!this.listo || (this.scene.get('hud') as { tapaClic?: (x: number, y: number) => boolean }).tapaClic?.(p.x, p.y)) return;
      const o = this.bajoCursor(p.worldX, p.worldY);
      if (o) { this.objetivo = o; if (p.rightButtonDown()) this.casilla(0); }
      else if (!p.rightButtonDown()) this.objetivo = null;
    });
  }
  private bajoCursor(x: number, y: number): Luchador | null {
    return [...this.salvajes, ...this.vecinos].filter(l => !l.muerto && !l.enBall && Math.abs(x - l.x) < Math.max(10, l.alto * 0.4) && y > l.y - l.alto - 4 && y < l.y + 6)
      .sort((a, b) => b.y - a.y)[0] ?? null;
  }
  // Tab: el salvaje más cercano que no sea el actual (en orden de distancia).
  private siguienteObjetivo(): void {
    const p = this.jugador, vivos = this.salvajes.filter(l => !l.muerto && !l.enBall && Math.hypot(l.x - p.x, l.y - p.y) < 260)
      .sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y));
    if (!vivos.length) { this.aviso('No hay ningún salvaje cerca'); return; }
    const i = this.objetivo ? vivos.indexOf(this.objetivo) : -1;
    this.objetivo = vivos[(i + 1) % vivos.length];
  }

  // F / espacio: junto a uno de tus Pokémon del pueblo, convertirte en él.
  private interactuar(): void {
    if (!this.listo || this.jugador.muerto) return;
    this.cortarHogar();
    const p = this.jugador, v = this.vecinos.find(l => Math.hypot(l.x - p.x, l.y - p.y) < 32), t = this.mapa.tablon;
    if (t && Math.hypot(t.x - p.x, t.y - p.y) < TABLON_CERCA) { this.panel = this.panel === 'misiones' ? null : 'misiones'; this.asignando = null; return; }
    if (v) { this.convertirse(v); return; }
    if (this.mapa.id === 'pueblo' && this.partida.estado.equipo.length > 1) this.aviso('Acércate a uno de tus Pokémon y pulsa F para convertirte en él');
  }
  private convertirse(v: Luchador): void {
    const p = this.jugador, yo = p.miembro!, otro = v.miembro!;
    yo.ps = p.ps / p.stats.hp;
    this.partida.estado.activo = otro.uid;
    // Intercambian el sitio: tú pasas a ser el vecino.
    const nuevo = this.crearLuchador('jugador', otro.linea, otro.nivel, v.x, v.y, otro);
    nuevo.ps = Math.max(1, Math.round(nuevo.stats.hp * otro.ps));
    const viejo = this.crearLuchador('vecino', yo.linea, yo.nivel, p.x, p.y, yo);
    viejo.temple = 'amistoso';
    [p, v].forEach(l => { l.spr.destroy(); l.sombra.destroy(); });
    this.vecinos = this.vecinos.filter(l => l !== v).concat(viejo);
    this.jugador = nuevo;
    this.objetivo = null;
    this.cameras.main.startFollow(nuevo.spr, true, 1, 1);
    this.stage.hitFlash(nuevo.fx, 300);
    this.guardar();
    this.aviso(`Ahora eres ${nuevo.nombre} (Nv ${nuevo.nivel})`);
  }

  // ---- Barra de atajos ----
  casilla(i: number): void {
    if (!this.listo) return;
    const m = this.partida.activo;
    if (this.asignando) {   // colocar en la barra lo elegido en el panel
      const a = this.asignando;
      m.barra = m.barra.map(x => x && JSON.stringify(x) === JSON.stringify(a) ? null : x);
      m.barra[i] = a; this.asignando = null; this.guardar();
      return;
    }
    const a = m.barra[i];
    if (!a) return;
    if (this.hogar) this.cortarHogar();
    if ('m' in a) this.usarMov(this.jugador, a.m, this.objetivo);
    else this.usarItem(a.i);
  }
  // Lo que le falta a un atajo para poder usarse ahora (lo pinta el HUD): fracción de enfriamiento que queda.
  enfriando(a: { m: string } | { i: string }): number {
    const l = this.jugador;
    if (!l) return 0;
    const g = Math.max(0, l.gcd - this.ahora) / GCD;
    if ('i' in a) return g;
    const m = getMove(a.m);
    if (!m) return 0;
    return Math.max(g, Math.max(0, (l.cd[a.m] ?? 0) - this.ahora) / enfriamiento(m));
  }

  // ---- Usar un movimiento ----
  usarMov(l: Luchador, id: string, obj: Luchador | null): boolean {
    const m = getMove(id), yo = l.rol === 'jugador';
    if (!m || l.muerto || l.enBall || this.cambiando) return false;
    if (l.estado === 'slp' || l.estado === 'frz') { if (yo) this.aviso(`${l.nombre} está ${NOMBRE_ESTADO[l.estado].toLowerCase()}`); return false; }
    if (l.gcd > this.ahora || (l.cd[id] ?? 0) > this.ahora) return false;
    const objetivo = necesitaObjetivo(m);
    if (objetivo) {
      if (!obj && yo) obj = this.objetivo = this.salvajes.filter(s => !s.muerto && !s.enBall).sort((a, b) => Math.hypot(a.x - l.x, a.y - l.y) - Math.hypot(b.x - l.x, b.y - l.y))[0] ?? null;
      if (!obj || obj.muerto || obj.enBall) { if (yo) this.aviso('Elige a quién (clic en un Pokémon o Tab)'); return false; }
      if (obj.rol === 'vecino') { if (yo) this.aviso(`${obj.nombre} es de los tuyos`); return false; }
      const d = Math.hypot(obj.x - l.x, obj.y - l.y), al = alcance(m) + Math.max(8, obj.alto * 0.3);
      if (d > al) { if (yo) this.aviso(`${m.nombre}: demasiado lejos`); return false; }
      this.mirarA(l, obj);
    }
    l.gcd = this.ahora + GCD;
    l.cd[id] = this.ahora + enfriamiento(m);
    const anim: AnimId = m.category === 'Status' ? 'Charge' : m.flags.includes('contact') ? 'Attack' : 'Shoot';
    this.reproducir(l, anim);
    l.quietoHasta = this.ahora + 0.35;
    if (l.estado === 'par' && Math.random() < 0.25) { this.stage.label(this.geo(l).top, '¡Paralizado!', 'bad'); return true; }
    const blanco = objetivo ? obj! : l;
    if (objetivo && blanco !== l) this.provocar(blanco, l);
    // El efecto sale en el fotograma del golpe de la animación (HitFrame), no antes.
    const retraso = Math.min(320, info(l.dex)[anim]?.golpe ?? 200);
    this.time.delayedCall(retraso, () => void this.lanzarMov(l, id, blanco));
    return true;
  }

  private async lanzarMov(l: Luchador, id: string, t: Luchador): Promise<void> {
    const m = getMove(id)!;
    if (l.muerto || this.cambiando) return;
    const r = t === l ? { dano: 0, eficacia: 1, critico: false, falla: false } : golpe(m, l, t, this.clima?.tipo ?? null);
    const efect = r.eficacia === 0 ? 'immune' : r.eficacia > 1 ? 'super' : r.eficacia < 1 ? 'resisted' : 'normal';
    const ef = this.efectos(m, l, t, r);
    const cue: MoveCue = {
      kind: 'move', user: l.uid, move: id, targets: t === l ? [] : [t.uid], spread: false,
      hits: r.falla || t === l ? [] : [{ slot: t.uid, effectiveness: efect, crit: r.critico, damaged: r.dano > 0 }],
      missed: r.falla ? [t.uid] : [], blocked: [], failed: false, hitCount: 1, drained: !!m.drain && r.dano > 0, recoil: !!m.recoil && r.dano > 0,
      // Las flechas de stats y el efecto de cada estado los pinta la animación al final (como en Colleja).
      boosts: ef.filter(e => e.boosts).map(e => ({ slot: e.quien.uid, changes: (Object.entries(e.boosts!) as [Stat6, number][]).map(([stat, amount]) => ({ stat, amount })) })),
      statuses: ef.filter(e => e.estado).map(e => ({ slot: e.quien.uid, status: e.estado! })),
    };
    let hecho = false;
    const commit = () => { if (!hecho) { hecho = true; this.aplicar(l, m.id, t, r, ef); } };
    const texts: MoveTexts = { boost: (s, n) => `${n > 0 ? '+' : ''}${n} ${NOMBRE_STAT[s as Stat6] ?? s}`, status: s => NOMBRE_ESTADO[s] ?? s };
    const anim = animationFor(id);
    const targets = t === l || anim.template === 'aura' || anim.template === 'shield' ? [] : [this.geo(t)];
    this.time.delayedCall(2500, commit);   // por si la animación no llega al impacto
    try {
      await animarMovimiento({ stage: this.stage, cue, animation: anim, palette: TYPE_FX[anim.type], user: this.geo(l), targets,
        losses: new Map([[t.uid, Math.min(1, r.dano / t.stats.hp)]]), commit, text: texts });
    } catch (e) { console.warn('animación', id, e); }
    commit();
  }

  // Cambios de stats y estados que causará el movimiento (las probabilidades se tiran aquí, antes de animarlo).
  private efectos(m: MoveData, l: Luchador, t: Luchador, r: { dano: number; eficacia: number; falla: boolean }): Efecto[] {
    const out: Efecto[] = [];
    if (r.falla || r.eficacia === 0) return out;
    const estado = (q: Luchador, s: string) => { if (this.puedeEstado(q, s) && !out.some(e => e.quien === q && e.estado)) out.push({ quien: q, estado: s }); };
    if (m.boosts) out.push({ quien: t, boosts: m.boosts });
    if (m.selfBoosts) out.push({ quien: l, boosts: m.selfBoosts });
    if (m.status) estado(t, m.status);
    const s = m.secondary;
    if (s && Math.random() * 100 < s.chance) {
      if (s.status) estado(t, s.status);
      if (s.boosts) out.push({ quien: t, boosts: s.boosts });
      if (s.selfBoosts) out.push({ quien: l, boosts: s.selfBoosts });
    }
    return out;
  }
  // Inmunidades de tipo: Fuego no se quema, Eléctrico no se paraliza, Veneno y Acero no se envenenan, Hielo no se congela.
  private puedeEstado(l: Luchador, s: string): boolean {
    const inm: Record<string, TypeName[]> = { brn: ['Fire'], par: ['Electric'], psn: ['Poison', 'Steel'], tox: ['Poison', 'Steel'], frz: ['Ice'] };
    if (s === 'frz' && this.clima?.tipo === 'sol') return false;   // con sol no se congela
    return !l.estado && !!DURA_ESTADO[s] && !inm[s]?.some(t => l.tipos.includes(t));
  }

  // Lo que hace el movimiento al llegar: daño, curas, cambios de stats y estados.
  private aplicar(l: Luchador, id: string, t: Luchador, r: { dano: number; eficacia: number; critico: boolean; falla: boolean }, ef: Efecto[]): void {
    const m = getMove(id)!;
    if (l.muerto && t !== l) return;
    if (t.muerto || t.enBall) return;
    if (r.falla) return;
    if (r.dano > 0) {
      this.danar(t, r.dano, l);
      if (m.drain) this.curar(l, Math.max(1, Math.floor(r.dano * m.drain[0] / m.drain[1])));
      if (m.recoil) this.danar(l, Math.max(1, Math.floor(r.dano * m.recoil[0] / m.recoil[1])), null);
    }
    if (r.eficacia === 0) return;
    if (m.heal) this.curar(l, Math.floor(l.stats.hp * m.heal[0] / m.heal[1]));
    const cc = curaClima(m.id, this.clima?.tipo ?? null);
    if (cc) this.curar(l, Math.floor(l.stats.hp * cc));
    if (CLIMA_DE[m.id]) this.ponerClima(CLIMA_DE[m.id]);
    // Un ataque de Fuego descongela.
    if (t.estado === 'frz' && m.type === 'Fire' && r.dano > 0) this.curarEstado(t);
    for (const e of ef) {
      if (e.quien.muerto) continue;
      if (e.boosts) this.cambiarStats(e.quien, e.boosts);
      if (e.estado) this.ponerEstado(e.quien, e.estado, false);
    }
  }
  private danar(t: Luchador, n: number, de: Luchador | null): void {
    t.ps = Math.max(0, t.ps - n);
    t.ultimoDano = this.ahora;
    if (t.rol === 'jugador' && this.hogar) this.cortarHogar('¡Te han interrumpido!');
    const g = this.geo(t);
    this.stage.label({ x: g.top.x + (Math.random() - 0.5) * 10, y: g.top.y }, `−${n}`, t.rol === 'jugador' ? 'bad' : 'neutral');
    if (t.ps <= 0) { this.debilitar(t, de); return; }
    if (t.anim !== 'Attack' && t.anim !== 'Shoot' && t.anim !== 'Charge') this.reproducir(t, 'Hurt', 300);
    if (de) this.provocar(t, de);
  }
  private curar(l: Luchador, n: number): void {
    if (l.muerto || n <= 0) return;
    const antes = l.ps;
    l.ps = Math.min(l.stats.hp, l.ps + n);
    if (l.ps > antes) this.stage.label(this.geo(l).top, `+${l.ps - antes}`, 'good');
  }
  private cambiarStats(l: Luchador, b: Boosts): void {
    for (const [s, n] of Object.entries(b) as [Stat6, number][]) {
      l.boosts[s] = Math.max(-6, Math.min(6, (l.boosts[s] ?? 0) + n));
      l.boostHasta[s] = this.ahora + DURA_BOOST;   // el rótulo "+1 Atq" lo pone la animación (showBoosts)
    }
  }
  private ponerEstado(l: Luchador, s: string, rotulo = true): void {
    if (!this.puedeEstado(l, s)) return;
    l.estado = s; l.estadoHasta = this.ahora + DURA_ESTADO[s]; l.ticEstado = this.ahora + TURNO; l.toxN = 0; l.auraEn = 0;
    if (rotulo) this.stage.label(this.geo(l).top, NOMBRE_ESTADO[s], 'bad', 200);
    if (s === 'slp' || s === 'frz') { l.meta = null; this.reproducir(l, 'Sleep', DURA_ESTADO[s] * 1000); }
  }
  // Un salvaje al que le pegan reacciona según su temple: el tranquilo no pelea, el asustadizo huye y el peleón ataca.
  private provocar(t: Luchador, de: Luchador): void {
    if (t.rol !== 'salvaje' || t.muerto) return;
    if (t.temple === 'amistoso') { if (t.modo !== 'huir') { t.modo = 'huir'; t.huirHasta = this.ahora + 1.5; } return; }
    if (t.temple === 'huidizo') { t.modo = 'huir'; t.huirHasta = this.ahora + 4 + Math.random() * 2; t.meta = null; return; }
    t.modo = 'pelear'; t.rival = de; t.meta = null;
  }

  private debilitar(t: Luchador, de: Luchador | null): void {
    t.muerto = true; t.meta = null;
    this.reproducir(t, 'Faint', 900);
    if (t === this.objetivo) this.objetivo = null;
    if (t.rol === 'jugador') { this.caer(); return; }
    this.tweens.add({ targets: t.fx, alpha: 0, delay: 700, duration: 600, onComplete: () => this.quitar(t) });
    if (de?.rol === 'jugador') this.recompensa(t);
    if (t.alfa) {
      (this.partida.estado.alfas ??= {})[this.mapa.id] = Date.now();
      this.guardar();
      this.ponerAlfa();
    } else this.reaparecer(t.ronda);
  }
  private reaparecer(r?: Ronda): void {
    if (!r) return;
    const mapa = this.mapa;
    this.time.delayedCall(RESPAWN * 1000, () => { if (this.mapa === mapa && this.listo) this.salvajes.push(this.crearSalvaje(r)); });
  }
  // Experiencia para el que manejas y, a veces, algo que suelta (bayas, alguna Ball).
  private recompensa(t: Luchador): void {
    const yo = this.partida.activo, exp = expPor(t.linea, t.nivel) * (t.alfa ? ALFA_VIDA : 1);
    this.stage.label(this.geo(this.jugador).top, `+${exp} exp`, 'strong', 300);
    this.procesar(this.partida.ganarExp(yo, exp));
    const r = Math.random();
    if (t.alfa) {   // el alfa suelta siempre algo mejor: una Ball buena y una Baya Zidra
      const ball = this.mapa.id === 'lago' ? 'ultraball' : 'superball';
      this.partida.dar(ball); this.partida.dar('sitrus');
      this.aviso(`${t.nombre} ha soltado: ${ITEMS[ball].nombre} y ${ITEMS.sitrus.nombre}`);
    } else {
      const suelta = r < 0.18 ? 'oran' : r < 0.24 ? 'sitrus' : r < 0.32 ? 'pokeball' : r < 0.35 ? 'superball' : null;
      if (suelta && ITEMS[suelta]) { this.partida.dar(suelta); this.aviso(`${t.nombre} ha soltado: ${ITEMS[suelta].nombre}`); }
    }
    this.contarMision(t.alfa ? 'alfa' : 'derrotar', t.linea);
    this.guardar();
  }
  // ---- Misiones (tablón del pueblo; las pinta el HUD) ----
  private contarMision(tipo: 'derrotar' | 'capturar' | 'alfa', linea: string): void {
    for (const m of this.partida.contar(tipo, linea, this.mapa.id)) {
      const n = this.partida.progresoMision(m), lista = n >= m.n;
      this.stage.label(this.geo(this.jugador).top, lista ? '¡Misión cumplida!' : `${n}/${m.n}`, 'strong', 500);
      if (lista) this.aviso('¡Misión cumplida! Entrégala en el tablón del pueblo.');
    }
  }
  aceptarMision(m: Mision): void {
    if (this.partida.estadoMision(m) !== 'nueva') return;
    this.partida.aceptar(m);
    this.guardar();
  }
  entregarMision(m: Mision): void {
    if (!this.partida.entregar(m)) return;
    this.stage.label(this.geo(this.jugador).top, `+${m.premio.exp} exp`, 'strong', 200);
    this.aviso(`Recompensa: ${m.premio.exp} exp, ${m.premio.items.map(([id, n]) => `${ITEMS[id]?.nombre ?? id} ×${n}`).join(', ')}`);
    this.procesar(this.partida.ganarExp(this.partida.activo, m.premio.exp));
    this.guardar();
  }
  private procesar(av: Aviso[]): void {
    // Si evoluciona, lo que aprende se cuenta en la cinemática (src/scenes/Evolucion.ts), no en avisos.
    const antes = formaDe(this.jugador.linea, this.jugador.nivel), evoluciona = av.some(a => a.tipo === 'evoluciona');
    for (const a of av) {
      if (a.tipo === 'nivel') {
        this.stage.label(this.geo(this.jugador).top, `¡Nivel ${a.nivel}!`, 'strong', 600);
        this.jugador.nivel = a.nivel;
        const viejo = this.jugador.stats.hp;
        this.jugador.stats = statsDe(formaDe(this.jugador.linea, a.nivel).base, a.nivel);
        this.jugador.ps = Math.min(this.jugador.stats.hp, this.jugador.ps + (this.jugador.stats.hp - viejo));
      } else if (a.tipo === 'aprende') {
        const m = getMove(a.mov);
        if (evoluciona) continue;
        this.aviso(`¡${this.jugador.nombre} ha aprendido ${m?.nombre ?? a.mov}!${a.casilla >= 0 ? ` (tecla ${(a.casilla + 1) % 10})` : ' Ponlo en la barra con K.'}`);
      }
    }
    if (evoluciona) void this.evolucionar(antes, av.filter(a => a.tipo === 'aprende').map(a => getMove((a as { mov: string }).mov)?.nombre ?? (a as { mov: string }).mov));
  }
  // Evoluciona el que manejas: se para el juego (esta escena y el HUD en pausa, los canvas de efectos ocultos) y la
  // escena 'evolucion' lo cuenta encima. Al terminar, su luchador se rehace con la forma nueva en el mismo sitio y todo
  // sigue donde estaba (el tiempo en pausa no cuenta para enfriamientos ni estados: `desfase`).
  private async evolucionar(antes: ReturnType<typeof formaDe>, aprende: string[]): Promise<void> {
    const p = this.jugador, m = this.partida.activo, f = formaDe(m.linea, m.nivel);
    await cargar(this, [idSprite(f.dex, m.shiny)]);
    // Si mientras cargaba ha cambiado de mapa o se ha debilitado, la forma nueva sale al volver a montar el mapa.
    if (this.jugador !== p || p.muerto || this.cambiando || !this.listo || this.evolucionando) return;
    this.evolucionando = true;
    const cam = this.cameras.main, pausaEn = this.game.loop.time;
    const datos: DatosEvolucion = {
      de: { dex: p.dex, nombre: antes.nombre, stats: statsDe(antes.base, m.nivel), tipos: tiposDe(antes.id) },
      a: { dex: idSprite(f.dex, m.shiny), nombre: f.nombre, stats: statsDe(f.base, m.nivel), tipos: tiposDe(f.id) }, nivel: m.nivel,
      color: COLOR_TIPO[tiposDe(f.id)[0]] ?? 0xffffff, aprende,
      x: (p.spr.x - cam.worldView.x) * cam.zoom, y: (p.spr.y - cam.worldView.y) * cam.zoom, escala: cam.zoom * p.spr.scaleX,
      pose: { tex: p.spr.texture.key, frame: p.spr.frame.name, ox: p.spr.originX, oy: p.spr.originY, dir: p.dir, flipX: p.spr.flipX },
      tinte: Phaser.Display.Color.GetColor(...(['r', 'g', 'b'] as const).map(k => Math.min(255, Math.round(this.lights.ambientColor[k] * 255))) as [number, number, number]),
      ocultar: () => { p.spr.setVisible(false); p.sombra.setVisible(false); },
      fin: () => {
        this.desfase += (this.game.loop.time - pausaEn) / 1000;
        this.cambiarForma(p);
        this.stage.visible(true);
        this.scene.resume(); this.scene.resume('hud'); this.scene.setVisible(true, 'hud');
        this.input.keyboard?.resetKeys();
        this.evolucionando = false;
        this.guardar();
      },
    };
    this.stage.visible(false);
    this.scene.pause(); this.scene.pause('hud'); this.scene.setVisible(false, 'hud');
    this.scene.launch('evolucion', datos);
  }
  // Rehace al jugador con la forma de su nivel, conservando sitio, vida (en fracción), estado, cambios y enfriamientos.
  private cambiarForma(p: Luchador): void {
    const m = p.miembro!, n = this.crearLuchador('jugador', m.linea, m.nivel, p.x, p.y, m);
    n.ps = Math.max(1, Math.round(n.stats.hp * p.ps / p.stats.hp)); n.dir = p.dir;
    Object.assign(n, { estado: p.estado, estadoHasta: p.estadoHasta, ticEstado: p.ticEstado, toxN: p.toxN, boosts: p.boosts, boostHasta: p.boostHasta, cd: p.cd, gcd: p.gcd, ultimoDano: p.ultimoDano });
    for (const s of this.salvajes) if (s.rival === p) s.rival = n;
    p.spr.destroy(); p.sombra.destroy();
    this.jugador = n;
    this.cameras.main.startFollow(n.spr, true, 1, 1);
    this.stage.hitFlash(n.fx, 300);
  }
  // Te debilitas: fundido y vuelves al pueblo con la vida entera.
  private caer(): void {
    if (this.cambiando) return;
    this.cambiando = true;
    this.aviso(`¡${this.jugador.nombre} se ha debilitado! Vuelves al pueblo.`);
    this.partida.activo.ps = 1;
    this.partida.guardar();
    this.time.delayedCall(1300, () => this.irA('pueblo', 'inicio'));
  }

  // ---- Objetos ----
  usarItem(id: string): void {
    const l = this.jugador, def = ITEMS[id];
    if (!def || l.muerto || this.cambiando) return;
    if (this.partida.tiene(id) <= 0) { this.aviso(`No te quedan: ${def.nombre}`); return; }
    if (l.gcd > this.ahora) return;
    if (def.tipo === 'pokeball') { this.lanzarBall(id); return; }
    if (def.tipo === 'baya') {
      const cura = id === 'sitrus' ? 0.5 : id === 'oran' ? 0.3 : 0.15;
      if (l.ps >= l.stats.hp && !(id === 'lum' && l.estado)) { this.aviso('Tienes la vida entera'); return; }
      this.partida.gastar(id); l.gcd = this.ahora + GCD;
      this.curar(l, Math.ceil(l.stats.hp * cura));
      this.reproducir(l, 'Charge', 400);
      return;
    }
    this.aviso(`${def.nombre}: aquí no sirve`);
  }
  // Poké Ball al objetivo: vuela, el salvaje entra, se mueve tres veces y se queda (o sale).
  private lanzarBall(id: string): void {
    const p = this.jugador, t = this.objetivo;
    if (this.lanzando) return;
    if (!t || t.rol !== 'salvaje' || t.muerto) { this.aviso('Elige a un salvaje para lanzarle la Poké Ball'); return; }
    if (t.alfa) { this.aviso('Un alfa no se deja capturar: derrótalo'); return; }
    if (Math.hypot(t.x - p.x, t.y - p.y) > TIRO) { this.aviso('Acércate más para lanzar la Poké Ball'); return; }
    this.partida.gastar(id);
    this.lanzando = true; p.gcd = this.ahora + GCD;
    this.mirarA(p, t); this.reproducir(p, 'Shoot', 350);
    const x0 = p.x, y0 = p.y - 14, x1 = t.x, y1 = t.y - 6, key = this.textures.exists('obj_' + id) ? 'obj_' + id : 'icono_' + id;
    const ball = this.add.image(x0, y0, key).setDepth(t.y + 5);
    ball.resetPipeline();
    if (!this.textures.exists('obj_' + id)) ball.setScale(10 / ball.width);
    const vuelo = { t: 0 };
    this.tweens.add({
      targets: vuelo, t: 1, duration: 420,
      onUpdate: () => ball.setPosition(x0 + (x1 - x0) * vuelo.t, y0 + (y1 - y0) * vuelo.t - Math.sin(vuelo.t * Math.PI) * 18).setAngle(vuelo.t * 540),
      onComplete: () => {
        if (t.muerto) { ball.destroy(); this.lanzando = false; return; }
        t.enBall = true; t.meta = null;
        if (this.objetivo === t) this.objetivo = null;
        ball.setAngle(0).setPosition(x1, t.y - 4);
        this.tweens.add({
          targets: ball, angle: { from: -22, to: 22 }, duration: 160, yoyo: true, repeat: 2, repeatDelay: 260, delay: 250,
          onComplete: () => {
            this.lanzando = false;
            const atrapa = ESPECIES[t.linea]?.atrapa ?? 0.3, ok = Math.random() < probCaptura(atrapa, BALL[id] ?? 1, t.ps, t.stats.hp, t.estado);
            this.tweens.add({ targets: ball, alpha: 0, scale: ok ? ball.scale : ball.scale * 1.6, delay: ok ? 450 : 0, duration: 250, onComplete: () => ball.destroy() });
            if (ok) this.capturado(t, id);
            else {
              t.enBall = false;
              this.stage.hitFlash(t.fx, 200);
              this.aviso(`¡${t.nombre} ha salido de la ${ITEMS[id]?.nombre ?? 'Ball'}!`);
              this.provocar(t, p);
            }
          },
        });
      },
    });
  }
  private capturado(t: Luchador, ball: string): void {
    t.muerto = true;
    const m = this.partida.crear(t.linea, t.nivel, t.shiny);
    m.ps = Math.max(0.1, t.ps / t.stats.hp);
    this.quitar(t);
    this.aviso(`¡Has capturado a ${t.nombre} (Nv ${t.nivel}) con la ${ITEMS[ball]?.nombre ?? 'Ball'}! Te espera en el pueblo.`);
    this.stage.label(this.geo(this.jugador).top, '★', 'strong');
    this.contarMision('capturar', t.linea);
    this.reaparecer(t.ronda);
    this.guardar();
  }

  // ---- Inteligencia de los salvajes y de los vecinos ----
  private pensar(l: Luchador, dt: number): void {
    if (l.muerto || l.enBall) return;
    const quieto = l.estado === 'slp' || l.estado === 'frz' || l.quietoHasta > this.ahora;
    const vel = (60 + Math.min(60, (this.formaL(l).base[5]) * 0.3)) * (l.estado === 'par' ? VEL_PARALIZADO : 1);
    l.anda = false;
    if (quieto) return;
    const p = this.jugador;
    if (l.modo === 'huir') {
      if (this.ahora > l.huirHasta) { l.modo = 'pasear'; l.casa = { x: l.x, y: l.y }; return; }
      const dx = l.x - p.x, dy = l.y - p.y;
      l.anda = this.mover(l, dx + (Math.random() - 0.5) * 20, dy + (Math.random() - 0.5) * 20, vel * 1.2, dt);
      if (!l.anda) l.anda = this.mover(l, -dy, dx, vel, dt); // atascado: de lado
      return;
    }
    if (l.modo === 'pelear') {
      const r = l.rival;
      if (!r || r.muerto || Math.hypot(l.x - l.casa.x, l.y - l.casa.y) > CORREA) { l.modo = 'volver'; l.rival = null; return; }
      if (l.alfa && this.golpeAlfa(l, r)) return;
      // El movimiento listo más fuerte (a veces uno de estado), si llega; si no, acercarse.
      const listos = l.movs.map(id => getMove(id)!).filter(m => m && (l.cd[m.id] ?? 0) <= this.ahora);
      const dano = listos.filter(m => m.basePower > 0).sort((a, b) => b.basePower - a.basePower);
      const elige = (Math.random() < 0.2 ? listos.find(m => m.category === 'Status') : undefined) ?? dano[0];
      const d = Math.hypot(r.x - l.x, r.y - l.y);
      if (elige && d <= alcance(elige) + 6) {
        this.mirarA(l, r);
        if (l.gcd <= this.ahora) this.usarMov(l, elige.id, necesitaObjetivo(elige) ? r : null);
        return;
      }
      const meta = elige ? alcance(elige) - 6 : 24;
      if (d > meta) l.anda = this.mover(l, r.x - l.x, r.y - l.y, vel, dt);
      return;
    }
    if (l.modo === 'volver') {
      const d = Math.hypot(l.casa.x - l.x, l.casa.y - l.y);
      if (d < 6) { l.modo = 'pasear'; l.ps = l.stats.hp; l.boosts = {}; return; }
      l.anda = this.mover(l, l.casa.x - l.x, l.casa.y - l.y, vel * 1.3, dt);
      if (!l.anda) { l.x = l.casa.x; l.y = l.casa.y; }
      return;
    }
    // Pasear cerca de su sitio, con pausas.
    if (!l.meta) {
      l.espera -= dt;
      if (l.espera <= 0) {
        const a = Math.random() * Math.PI * 2, r = 20 + Math.random() * (l.rol === 'vecino' ? 90 : 60);
        l.meta = { x: l.casa.x + Math.cos(a) * r, y: l.casa.y + Math.sin(a) * r * 0.7 };
      }
      return;
    }
    const dx = l.meta.x - l.x, dy = l.meta.y - l.y;
    if (Math.hypot(dx, dy) < 2 || !(l.anda = this.mover(l, dx, dy, vel * 0.45, dt))) { l.meta = null; l.espera = 1 + Math.random() * 4; }
  }

  // Estados, cambios de stats que caducan y vida que vuelve fuera de combate.
  private paso(l: Luchador, dt: number): void {
    if (l.muerto) return;
    if (l.estado) {
      if (this.ahora > l.estadoHasta) this.curarEstado(l);
      else if (DANO_ESTADO[l.estado] && this.ahora > l.ticEstado) {
        // Un turno: quemado 1/16, envenenado 1/8, gravemente envenenado 1/16, 2/16, 3/16…
        l.ticEstado = this.ahora + TURNO;
        if (l.estado === 'tox') l.toxN++;
        this.danar(l, Math.max(1, Math.floor(l.stats.hp * DANO_ESTADO[l.estado] * (l.estado === 'tox' ? l.toxN : 1))), null);
        if (l.muerto) return;
      }
    }
    for (const [s, h] of Object.entries(l.boostHasta) as [Stat6, number][]) if (this.ahora > h) { delete l.boosts[s]; delete l.boostHasta[s]; }
    const enCombate = l.rol === 'jugador' ? this.salvajes.some(s => s.modo === 'pelear' && s.rival === l && !s.muerto) : l.modo === 'pelear';
    if (!enCombate && this.ahora - l.ultimoDano > 6 && l.ps < l.stats.hp) l.ps = Math.min(l.stats.hp, l.ps + l.stats.hp * CURA_FUERA * dt);
  }

  // Sprite, sombra y animación de cada luchador según lo que hace (más lo que le sumen las animaciones de movimientos).
  private dibujar(l: Luchador): void {
    const k = this.stage.k, f = l.fx;
    if (l.shiny && !l.visto && !l.muerto && this.cameras.main.worldView.contains(l.x, l.y - l.alto / 2)) {
      l.visto = true;
      this.destello(l);
      if (l.rol === 'salvaje') this.aviso(`¡Un ${l.nombre} shiny!`);
    }
    if (!l.muerto && this.ahora >= l.animHasta) {
      const a: AnimId = l.estado === 'slp' ? 'Sleep' : l.anda ? 'Walk' : 'Idle';
      const key = `${clave(l.dex)}-${a}-${a === 'Sleep' ? 0 : l.dir}`;
      if (l.spr.anims.currentAnim?.key !== key && poner(l.spr, l.dex, a, a === 'Sleep' ? 0 : l.dir)) this.iluminar(l.spr);
      l.anim = null;
    } else if (l.anim && l.anim !== 'Sleep' && l.anim !== 'Faint') {
      const key = `${clave(l.dex)}-${l.anim}-${l.dir}`;   // un golpe se gira con quien lo da
      const cur = l.spr.anims.currentAnim?.key;
      if (cur && cur !== key && cur.startsWith(`${clave(l.dex)}-${l.anim}-`) && this.anims.exists(key)) {
        const fr = l.spr.anims.currentFrame?.index ?? 0;
        poner(l.spr, l.dex, l.anim, l.dir, { startFrame: Math.max(0, fr - 1) });
      }
    }
    l.spr.setPosition(l.x + f.dx / k, l.y + f.dy / k).setScale(f.sx * l.escala, f.sy * l.escala).setAngle(f.rot).setAlpha(f.alpha * (l.enBall ? 0 : 1)).setDepth(l.y);
    // Golpe: silueta blanca. Si no, el tinte de su estado (quemado rojizo, envenenado morado, congelado azul…).
    if (f.flash > 0.5) { if (!l.spr.tintFill) l.spr.setTintFill(0xffffff); }
    else {
      const tinte = l.estado && !l.muerto ? TINTE_ESTADO[l.estado] ?? 0xffffff : 0xffffff;
      const parpadeo = l.estado === 'par' && Math.sin(this.ahora * 23) > 0.6 ? 0xffffa0 : tinte;   // paralizado: chispazos
      if (l.spr.tintFill || l.spr.tintTopLeft !== parpadeo) l.spr.setTint(parpadeo);
    }
    // Congelado: quieto en el fotograma en que se quedó.
    if (l.estado === 'frz' && !l.muerto) { if (l.spr.anims.isPlaying) l.spr.anims.pause(); } else if (l.spr.anims.isPaused) l.spr.anims.resume();
    if (l.estado && !l.muerto && !l.enBall && this.ahora >= l.auraEn) this.auraDe(l);
    l.sombra.setPosition(l.x, l.y - 1).setDepth(l.y - 1).setVisible(!l.enBall).setAlpha(l.muerto ? f.alpha : 1);
    // Aura del alfa: un resplandor rojizo que late detrás del cuerpo y un anillo en el suelo.
    if (l.aura && l.auraSuelo) {
      const late = 0.5 + 0.5 * Math.sin(this.ahora * 3.2), vis = l.muerto ? f.alpha : 1;
      l.aura.setPosition(l.x, l.y - l.alto * 0.45).setDisplaySize(l.alto * 1.9, l.alto * 1.9).setAlpha((0.4 + 0.25 * late) * vis).setDepth(l.y - 0.6);
      const w = l.sombra.width * (1.15 + 0.12 * late);
      l.auraSuelo.setPosition(l.x, l.y - 1).setSize(w, w * 0.36).setDisplaySize(w, w * 0.36).setDepth(l.y - 0.9).setAlpha((0.5 + 0.5 * late) * vis);
    }
  }
  // Barras de vida sobre los salvajes heridos o elegidos, y el anillo bajo el objetivo.
  private dibujarBarras(): void {
    const g = this.barras;
    g.clear();
    for (const l of [...this.salvajes, this.jugador]) {
      const auras = l.muerto || l.enBall ? [] : this.auras(l);
      if (l.muerto || l.enBall || (l.ps >= l.stats.hp && l !== this.objetivo && !auras.length)) continue;
      const w = l.alfa ? 32 : 20, x = l.x - w / 2, y = l.y - l.alto - 6, f = l.ps / l.stats.hp;
      if (l.alfa) g.fillStyle(0xffc04a, 1).fillRect(x - 1.5, y - 1.5, w + 3, 5);   // el alfa, con borde dorado
      if (l.rol === 'salvaje') {
        g.fillStyle(0x2a1a10, 0.75).fillRect(x - 0.5, y - 0.5, w + 1, 3);
        g.fillStyle(f > 0.5 ? 0x8fd36a : f > 0.2 ? 0xffd65a : 0xff6a5a, 1).fillRect(x, y, w * f, 2);
      }
      // Bufos y debufos encima (como en las placas de un MMO): un cuadradito de su color, que se vacía con el tiempo.
      auras.forEach((a, i) => {
        const cx = l.x - (auras.length * 5 - 1) / 2 + i * 5, cy = y - 5;
        g.fillStyle(0x2a1a10, 0.8).fillRect(cx - 0.5, cy - 0.5, 5, 5);
        g.fillStyle(a.color, 1).fillRect(cx, cy, 4, 4);
        g.fillStyle(0x000000, 0.45).fillRect(cx, cy, 4, 4 * (1 - a.frac));
      });
    }
    const o = this.objetivo;
    if (o && !o.muerto) {
      const col = o.rol === 'vecino' ? 0x9fd0ff : o.modo === 'pelear' ? COLOR_TEMPLE.agresivo : COLOR_TEMPLE[o.temple];
      const w = Math.max(18, o.alto * 0.8);
      this.anillo.setVisible(true).setPosition(o.x, o.y - 2).setSize(w, w * 0.36).setDisplaySize(w, w * 0.36).setFillStyle(col, 0.45).setDepth(o.y - 1.5);
    } else this.anillo.setVisible(false);
  }

  // Bufos y debufos de un luchador: su estado y sus cambios de stats, con la fracción de tiempo que les queda.
  auras(l: Luchador): Aura[] {
    const out: Aura[] = [];
    if (l.estado) out.push({ txt: CORTO_ESTADO[l.estado] ?? l.estado, nombre: NOMBRE_ESTADO[l.estado] ?? l.estado, color: COLOR_ESTADO[l.estado] ?? 0x888888,
      frac: Math.max(0, Math.min(1, (l.estadoHasta - this.ahora) / (DURA_ESTADO[l.estado] ?? 1))) });
    for (const [s, n] of Object.entries(l.boosts) as [Stat6, number][]) {
      if (!n) continue;
      out.push({ txt: `${CORTO_STAT[s]}${n > 0 ? '+' : ''}${n}`, nombre: `${NOMBRE_STAT[s]} ${n > 0 ? '+' : ''}${n}`, color: n > 0 ? 0x4fae4a : 0xc0453a,
        frac: Math.max(0, Math.min(1, ((l.boostHasta[s] ?? 0) - this.ahora) / DURA_BOOST)) });
    }
    return out;
  }
  // Lo que se ve de un estado mientras dura: una ráfaga sobre el cuerpo y, dormido, una "z" que sube.
  private auraDe(l: Luchador): void {
    l.auraEn = this.ahora + ESTADO_CADA / 1000;
    auraEstado(this.stage, this.geo(l), l.estado!);
    if (l.estado === 'slp' && Math.random() < 0.6) this.stage.label(this.geo(l).top, 'z', 'weak');
  }
  private curarEstado(l: Luchador): void {
    if (l.estado === 'slp' && l.anim === 'Sleep') l.animHasta = 0;
    l.estado = null; l.toxN = 0;
    l.spr.anims.resume();
  }

  // Clima: dura DURA_CLIMA s en todo el mapa, se ve todo el rato (capa de clima) y tiñe la luz.
  private ponerClima(c: Clima): void {
    this.clima = { tipo: c, hasta: this.ahora + DURA_CLIMA };
    this.climaTic = this.ahora + TURNO;
    this.stage.clima.set(ASPECTO_CLIMA[c]);
    this.aviso(`${NOMBRE_CLIMA[c]} durante ${DURA_CLIMA} s`);
  }
  private pasoClima(): void {
    const c = this.clima;
    if (!c) return;
    if (this.ahora > c.hasta) {
      this.clima = null;
      this.stage.clima.set(null);
      this.aviso(FIN_CLIMA[c.tipo]);
      return;
    }
    if (this.ahora < this.climaTic) return;
    this.climaTic = this.ahora + TURNO;
    for (const l of [this.jugador, ...this.salvajes]) if (!l.muerto && !l.enBall && danaClima(c.tipo, l.tipos)) this.danar(l, Math.max(1, Math.floor(l.stats.hp / 16)), null);
  }

  // "?" sobre el tablón si hay misiones para entregar, "!" si hay nuevas; el panel se cierra al alejarte.
  private pasoTablon(): void {
    const t = this.mapa.tablon;
    if (!t || !this.senal) return;
    const est = this.partida.misiones.map(m => this.partida.estadoMision(m)), c = est.includes('lista') ? '?' : est.includes('nueva') ? '!' : '';
    this.senal.setVisible(!!c && this.panel !== 'misiones');
    if (c && this.senal.text !== c) this.senal.setText(c).setColor(c === '?' ? '#ffe680' : '#ffd84a');
    this.senal.setY(t.y - 30 - Math.abs(Math.sin(this.ahora * 3)) * 4);
    if (this.panel === 'misiones' && Math.hypot(t.x - this.jugador.x, t.y - this.jugador.y) > TABLON_CERCA + 30) this.panel = null;
  }

  // ---- Piedra de hogar (H) ----
  // Lo que le falta para poder usarse (s reales); 0 = lista.
  hogarFalta(): number { return Math.max(0, ((this.partida.estado.hogar ?? 0) - Date.now()) / 1000); }
  hogarFrac(): number { const h = this.hogar; return h ? Math.max(0, Math.min(1, (this.ahora - h.t0) / (h.t1 - h.t0))) : 0; }
  usarHogar(): void {
    if (!this.listo || this.cambiando || this.jugador.muerto) return;
    if (this.hogar) { this.cortarHogar(); return; }
    const falta = this.hogarFalta();
    if (falta > 0) { const n = Math.ceil(falta); this.aviso(`La piedra de hogar aún no está lista (${Math.floor(n / 60)}:${String(n % 60).padStart(2, '0')})`); return; }
    const p = this.jugador;
    if (p.estado === 'slp' || p.estado === 'frz') { this.aviso(`${p.nombre} está ${NOMBRE_ESTADO[p.estado].toLowerCase()}`); return; }
    this.hogar = { t0: this.ahora, t1: this.ahora + HOGAR_CARGA };
    this.hogarLuz = this.add.ellipse(p.x, p.y - 2, 30, 11, 0x8fd8ff, 0.4);
    this.hogarLuz.resetPipeline();
    this.reproducir(p, 'Charge');
  }
  cortarHogar(txt?: string): void {
    if (!this.hogar) return;
    this.hogar = null;
    this.hogarLuz?.destroy(); this.hogarLuz = null;
    if (txt) this.aviso(txt);
  }
  private pasoHogar(): void {
    const h = this.hogar, p = this.jugador;
    if (!h) return;
    if (p.anda || p.muerto) { this.cortarHogar(p.muerto ? undefined : 'Piedra de hogar cancelada'); return; }
    const f = (this.ahora - h.t0) / (h.t1 - h.t0);
    if (p.anim !== 'Charge') this.reproducir(p, 'Charge');
    const w = 26 + 10 * Math.sin(this.ahora * 6);
    this.hogarLuz?.setPosition(p.x, p.y - 2).setDisplaySize(w, w * 0.38).setAlpha(0.25 + 0.35 * f).setDepth(p.y - 1.5);
    if (f < 1) return;
    this.cortarHogar();
    this.partida.estado.hogar = Date.now() + HOGAR_CD * 1000;
    this.stage.hitFlash(p.fx, 400);
    this.irA('pueblo', 'inicio');
  }

  // ---- Cambiar de mapa ----
  irA(mapa: MapaId, desde: MapaId | 'inicio'): void {
    this.cambiando = true; this.listo = false;
    this.guardar();
    this.stage.settle();
    this.cameras.main.fadeOut(300, 0, 0, 0);
    this.time.delayedCall(320, () => this.scene.restart({ mapa, desde }));
  }
  guardar(): void {
    const p = this.jugador, m = this.partida.activo;
    if (p && m && p.miembro === m) m.ps = p.muerto ? 1 : p.ps / p.stats.hp;
    this.partida.guardar();
  }
  aviso(txt: string): void { this.events.emit('aviso', txt); }

  update(t: number, dtMs: number): void {
    if (!this.listo) return;
    const dt = Math.min(0.05, dtMs / 1000);
    this.ahora = t / 1000 - this.desfase;
    if (this.partida.tick(dt)) this.aviso(`Amanece. Día ${this.partida.estado.dia}`);
    this.luzDelDia(t);
    this.aclarar(dtMs);
    this.pasoClima();

    // Tú.
    const p = this.jugador, k = this.keys;
    p.anda = false;
    if (!p.muerto && !this.cambiando && p.estado !== 'slp' && p.estado !== 'frz' && p.quietoHasta <= this.ahora) {
      const vx = +(k.D.isDown || k.RIGHT.isDown) - +(k.A.isDown || k.LEFT.isDown), vy = +(k.S.isDown || k.DOWN.isDown) - +(k.W.isDown || k.UP.isDown);
      if (vx || vy) { p.anda = this.mover(p, vx, vy, VEL * (p.estado === 'par' ? VEL_PARALIZADO : 1), dt); if (p.anim === 'Attack' || p.anim === 'Shoot' || p.anim === 'Charge') p.animHasta = 0; }
    }
    // Salidas del mapa.
    for (const s of this.mapa.salidas) if (!this.cambiando && p.x > s.x0 && p.x < s.x1 && p.y > s.y0 - 4 && p.y < s.y1 + 4) this.irA(s.a, this.mapa.id);

    // Los que no llevas descansan en el pueblo y se curan solos, estés donde estés.
    for (const m of this.partida.estado.equipo) if (m !== p.miembro && m.ps < 1) m.ps = Math.min(1, m.ps + CURA_FUERA * dt);
    for (const v of this.vecinos) v.ps = v.stats.hp * v.miembro!.ps;
    for (const l of [p, ...this.salvajes, ...this.vecinos]) { this.paso(l, dt); if (l !== p) this.pensar(l, dt); this.dibujar(l); }
    if (this.objetivo && (this.objetivo.muerto || Math.hypot(this.objetivo.x - p.x, this.objetivo.y - p.y) > 400)) this.objetivo = null;
    this.pasoMarca();
    this.pasoTablon();
    this.pasoHogar();
    this.dibujarBarras();
    this.stage.actualizar(t, dtMs);
  }
}

export { CASILLAS };
