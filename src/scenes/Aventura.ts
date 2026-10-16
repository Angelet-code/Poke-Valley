// Modo aventura (docs/GDD-combate.md): manejas a un Pokémon por mapas cerrados en estilo dibujo, peleas en tiempo
// real con los salvajes del bosque usando la barra de atajos (movimientos y objetos), los capturas con Poké Balls y
// subes de nivel derrotándolos. Los capturados se van al pueblo; allí puedes convertirte en cualquiera de ellos (F a
// su lado). Las animaciones de los movimientos son las de Pokémon Colleja (src/fx/), sobre un canvas encima del juego.
// Esta escena monta el mapa, lee el teclado y dibuja; lo que pasa (choques, IA, combate, capturas, clima, alfa, piedra
// de hogar) lo lleva la simulación de src/combate/mundo.ts, que le pasa sucesos para animar.
// Reglas en src/combate/reglas.ts; partida (equipo, mochila, hora) en src/combate/partida.ts; HUD en HudAventura.ts.
import Phaser from 'phaser';
import type { CargaMapa } from './carga';
import { REG, ROW_FROM_ANGLE, S, VH, VW } from '../config';
import { PALETA_DIBUJO, type Colocado } from '../data/mapaDibujo';
import { PALETAS_BIOMA, abrirMacizo, enMacizo } from '../data/biomas';
import { muroPintado } from '../data/ciudad';
import { crearMapa, type MapaAventura, type MapaId } from '../data/bosque';
import { guardarMiniatura, revisarSalidas } from '../data/mundo';
import { enRellano } from '../data/rellano';
import { FORMAS } from '../data/pokedex';
import { ITEMS } from '../data/items';
import { lineasDe } from '../data/aparicion';
import { NOMBRE_ZONA, type Mision } from '../combate/misiones';
import { despejarPuentes, tirasDeBorde, vestirMacizo } from '../data/bordes';
import { dibujar, enRect, ponerTinteSombra, expandirTiras, puntoLuz, tapa, type Elemento, type Pieza } from '../render/Dibujo';
import { TIPOS_LUZ, animarLuz, type TipoLuz } from '../render/luces';
import { pipelineCel } from '../render/CelPipeline';
import { Terrain } from '../render/Terrain';
import { farolas, luzAmbiente } from '../sim/World';
import { COLOR_TIPO, getMove, tiposDe, type Stat6 } from '../data/movimientos';
import { animationFor } from '../fx/catalog';
import { type MoveTexts } from '../fx/templates';
import { animarMovimiento } from '../fx/firmas';
import { TYPE_FX } from '../fx/fx/palette';
import { Stage, fxSprite, type FxSprite, type SlotGeometry } from '../fx/stage';
import type { MoveCue } from '../fx/tipos';
import { CASILLAS, PROB_SHINY, Partida } from '../combate/partida';
import { NOMBRE_ESTADO, NOMBRE_STAT, formaDe, statsDe, type Clima } from '../combate/reglas';
import { ALFA_RADIO, Mundo, VUELO_BALL, type Anatomia, type Aura, type Bloque, type Foto, type Luchador, type Salida, type Suceso } from '../combate/mundo';
import { COLOR_REACCION } from '../combate/naturalezas';
import { redDeLaPagina, type Mensaje } from '../combate/red';
import { chatDeLaPagina } from '../ui/chat';
import { TRATO_LEJOS, Tradeo, type MensajeTrato, type Recibido } from '../combate/tradeo';
import { ancla, cargar, clave, idSprite, info, listo, poner, type AnimId } from '../combate/sprites';
import { ESTADO_CADA, TINTE_ESTADO, TINTE_SEMILLA, auraEstado, auraSemilla, drenaje } from '../fx/estados';
import type { WeatherLook } from '../fx/fx/weather';
import type { DatosEvolucion } from './Evolucion';

export type { Aura, Luchador };
const TABLON_CERCA = 44;           // px para abrir el tablón con F
const MINI_ANCHO = 360;            // px de la miniatura de cada zona (mapa del mundo)
// Punto de vuelo (docs/GDD-mundo.md): Corviknight, el taxi volador de Galar, junto a la entrada de cada zona con un
// farol al lado. Encima, como en el WoW: un «!» verde mientras no lo hayas descubierto (hablando con él) y, después,
// el icono del maestro de vuelo, una bota verde con alas (pixel art, '.' = transparente).
export const DEX_VUELO = '0823', NOMBRE_VUELO = 'Corviknight';
const VUELO_CERCA = 50, FAROL_DX = 40, VUELO_ESCALA = 2;   // el taxi, el doble de grande que un Corviknight
const ICONO_VUELO = [
  'ww.......ww',
  'wWw.....wWw',
  '.wWw...wWw.',
  '..wWkkkWw..',
  '...kggk....',
  '...kggk....',
  '...kgggk...',
  '...kggggk..',
  '...kkkkkk..',
];
const ICONO_DESCUBRIR = [
  '.kkk.',
  'kgggk',
  'kgLgk',
  'kgLgk',
  'kgLgk',
  'kgggk',
  'kgggk',
  '.kgk.',
  '.kgk.',
  '..k..',
  '.....',
  '.kkk.',
  'kgggk',
  'kgggk',
  '.kkk.',
];
// Tienda del pueblo (docs/GDD-mundo.md): Kecleon, el tendero de Mystery Dungeon, delante del puesto. Encima, como el
// vendedor del WoW, una bolsa de dinero (pixel art). F a su lado abre la tienda (la pinta el HUD).
export const DEX_TIENDA = '0352', NOMBRE_TIENDA = 'Kecleon';
export const TIENDA_CERCA = 46;
// El obseso de las bayas (pueblo): Aipom. Como en el WoW, tiene una cadena de misiones (combate/misiones.ts, MISIONES_AIPOM):
// F a su lado las ofrece y las recoge (bayas a cambio de oro y experiencia); encima, «!» si tiene una nueva y «?» si hay
// una para entregar.
export const DEX_BAYERO = '0190', NOMBRE_BAYERO = 'Aipom';
export const BAYERO_CERCA = 54;
// Lo que vende, por orden (precios de data/items.ts).
export const VENTA = ['pokeball', 'superball', 'pocion', 'superpocion'];
const ICONO_TIENDA = [
  '...d...d...',
  '..dBd.dBd..',
  '...dBdBd...',
  '....yYy....',
  '...dbbbd...',
  '..dBBbbbd..',
  '.dBBbbbbbd.',
  '.dBbbyybbd.',
  '.dbbyYYybd.',
  '.dbbyYYybd.',
  '.dbbbyybbd.',
  '..dbbbbbd..',
  '...ddddd...',
];
const COL_VUELO: Record<string, string> = { w: '#dff7d0', W: '#ffffff', k: '#1d4a16', g: '#5fd34a', L: '#b6f5a0',
  d: '#3b2412', b: '#a8692e', B: '#d99a52', y: '#d9a21e', Y: '#ffe680' };
// Los dos iconos como texturas (una vez).
function texturaPixel(scene: Phaser.Scene, clave: string, filas: string[]): void {
  if (scene.textures.exists(clave)) return;
  const c = scene.textures.createCanvas(clave, filas[0].length, filas.length)!, g = c.getContext();
  filas.forEach((f, j) => [...f].forEach((ch, i) => { if (ch !== '.') { g.fillStyle = COL_VUELO[ch]; g.fillRect(i, j, 1, 1); } }));
  c.refresh();
}
type DatosMapa = { nueva?: boolean; inicial?: string; usuario?: string; mapa?: MapaId; desde?: MapaId | 'inicio'; pos?: { x: number; y: number }; vuelo?: { x: number; y: number } };

// Mapa (M): la zona entera desde arriba, con una segunda cámara encajada en este hueco (px de pantalla). La escena
// MapaZona pinta el marco alrededor y las marcas encima (tú, salidas, tablón).
export function encajeMapa(W: number, H: number): { x: number; y: number; w: number; h: number; zoom: number } {
  const mx = 18 * S, arriba = 28 * S, abajo = 20 * S, aw = VW * S - 2 * mx, ah = VH * S - arriba - abajo;
  const zoom = Math.min(aw / W, ah / H), w = Math.round(W * zoom), h = Math.round(H * zoom);
  return { x: Math.round(mx + (aw - w) / 2), y: Math.round(arriba + (ah - h) / 2), w, h, zoom };
}

// Cómo se ve cada clima (capa de fx/weather.ts) y cómo tiñe la luz del mapa (multiplica la luz ambiente).
const ASPECTO_CLIMA: Record<Clima, WeatherLook> = { lluvia: 'rain', sol: 'sun', arena: 'sand', nieve: 'snow', granizo: 'hail' };
const LUZ_CLIMA: Record<Clima, [number, number, number]> = { lluvia: [0.84, 0.88, 0.96], sol: [1.1, 1.02, 0.86], arena: [1, 0.86, 0.68], nieve: [0.92, 0.96, 1.06], granizo: [0.82, 0.86, 0.95] };


interface Luz { luz: Phaser.GameObjects.Light; halo: Phaser.GameObjects.Image; tipo: TipoLuz; fase: number }
// Lo que se ve de cada luchador: su sprite (con la forma que haya cargada: la shiny llega un poco después), la sombra
// y, el alfa, su aura. `logico`: el dex del luchador cuando se hizo (si cambia, al evolucionar, se rehace).
interface Vista {
  dex: string; logico: string; spr: Phaser.GameObjects.Sprite; sombra: Phaser.GameObjects.Ellipse; fx: FxSprite;
  aura?: Phaser.GameObjects.Image; auraSuelo?: Phaser.GameObjects.Ellipse;
  animN: number; auraEn: number; semillaEn: number; visto: boolean;   // visto: el shiny ya ha destellado al entrar en pantalla
}

export class Aventura extends Phaser.Scene {
  partida!: Partida;
  mapa!: MapaAventura;
  mundo: Mundo | null = null;
  probShiny = PROB_SHINY;             // de cada salvaje que aparece (en la consola se puede subir para probar)
  stage!: Stage;
  verMapa = false;                    // mapa abierto (M)
  modoVuelo = false;                  // abierto desde el volador: para elegir a dónde volar
  vueloNuevo = false;                 // el punto de vuelo de aquí se acaba de descubrir (al abrir el mapa de vuelo)
  vuelo: { x: number; y: number; spr: Phaser.GameObjects.Sprite; sombra: Phaser.GameObjects.Ellipse; placa: Phaser.GameObjects.Text; icono: Phaser.GameObjects.Image; fila: number } | null = null;
  tendero: { x: number; y: number; spr: Phaser.GameObjects.Sprite; placa: Phaser.GameObjects.Text; icono: Phaser.GameObjects.Image; fila: number } | null = null;
  bayero: { x: number; y: number; spr: Phaser.GameObjects.Sprite; placa: Phaser.GameObjects.Text; icono: Phaser.GameObjects.Text; fila: number } | null = null;
  private camMapa: Phaser.Cameras.Scene2D.Camera | null = null;
  panel: 'movs' | 'misiones' | 'inv' | 'tienda' | 'bayas' | null = null;   // panel abierto (K movimientos, I inventario, F en el tablón o el tendero): lo dibuja el HUD
  asignando: { m: string } | { i: string } | null = null; // atajo elegido en el panel, a la espera de casilla
  listo = false;
  evolucionando = false;
  private terrain!: Terrain;
  private piezas: Pieza[] = [];
  private luces: Luz[] = [];
  private luzJugador: Phaser.GameObjects.Light | null = null;
  private luzAhora: [number, number, number] | null = null;   // luz ambiente pintada (va hacia la que toca)
  private tLuz = 0;
  private vistas = new Map<string, Vista>();
  private balls = new Map<number, Phaser.GameObjects.Image>();
  private suelo = new Map<number, Phaser.GameObjects.Image>();   // objetos tirados (Mundo.hallazgos): una Poké Ball, como en los juegos
  private siguiendo: Phaser.GameObjects.Sprite | null = null;
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;
  private anillo!: Phaser.GameObjects.Ellipse;
  private barras!: Phaser.GameObjects.Graphics;
  private montaje = 0;
  private marcaG!: Phaser.GameObjects.Graphics;
  private senal: Phaser.GameObjects.Text | null = null;   // "!" o "?" sobre el tablón
  private hogarLuz: Phaser.GameObjects.Ellipse | null = null;
  // Multijugador (?mp=…): la conexión de la página, los sprites que se están cargando y el nombre sobre cada remoto.
  private readonly red = redDeLaPagina();
  private cargandoRed = new Set<string>();
  private placas = new Map<string, Phaser.GameObjects.Text>();
  // Chat (Intro): bocadillo sobre la cabeza de quien habla (uid del mundo), hasta performance.now() = hasta.
  private readonly chat = chatDeLaPagina();
  private bocadillos = new Map<string, { t: Phaser.GameObjects.Text; hasta: number }>();
  private semillaMapa = 0;             // con la que se ha hecho este mapa (la de la sala, si hay)
  private llegada = 0;                 // performance.now() al montar el mapa: el que lleva más tiempo en él es su dueño
  private dueno = '';                  // uid de red del que lleva a los salvajes de este mapa
  private fotoT = 0;
  private ajenos = new Map<string, number>();   // n de los sucesos de otros → n propio (negativo: no choca con los tuyos)
  private compartir: Suceso[] = [];
  private escuchando = false;
  // Comercio con otro jugador (T): la ventana la pinta el HUD. Uno por página, como la conexión.
  tradeo: Tradeo | null = null;
  private cargandoTrato = new Set<string>();
  // Medidas de los sprites para la simulación (con la forma cargada; la shiny mide lo mismo que la normal).
  private readonly anatomia: Anatomia = {
    alto: dex => ancla(this.cargado(dex)).alto,
    anim: (dex, a) => {
      const h = info(this.cargado(dex))[a];
      return h ? { dura: h.durs.reduce((t, d) => t + d, 0) / 60, golpe: h.golpe / 1000 } : null;
    },
  };

  constructor() { super('aventura'); }

  // Lo que lee el HUD.
  get jugador(): Luchador { return this.mundo?.jugador as Luchador; }
  get objetivo(): Luchador | null { return this.mundo?.objetivo ?? null; }
  set objetivo(o: Luchador | null) { if (this.mundo) this.mundo.objetivo = o; }
  get clima() { return this.mundo?.clima ?? null; }
  get hogar() { return this.mundo?.hogar ?? null; }
  get ahora(): number { return this.mundo?.ahora ?? 0; }

  create(data: DatosMapa): void {
    this.listo = false;
    // Pantalla de carga (scenes/carga.ts) encima de todo mientras se monta el mapa; se va sola al acabar.
    const carga = this.scene.get('cargaMapa') as CargaMapa;
    carga.reiniciar();
    this.scene.launch('cargaMapa');
    this.scene.bringToTop('cargaMapa');
    const n = ++this.montaje;
    this.montar(data, n, carga).catch(e => console.error(e)).finally(() => { if (n === this.montaje) carga.terminar(); });
  }

  private async montar(data: DatosMapa, n: number, carga?: CargaMapa): Promise<void> {
    carga?.progreso(0.08);
    this.mundo = null; this.piezas = []; this.luces = []; this.vistas.clear(); this.balls.clear(); this.suelo.clear(); this.panel = null; this.asignando = null;
    this.luzJugador = null; this.luzAhora = null; this.tLuz = 0; this.evolucionando = false; this.senal = null; this.hogarLuz = null; this.siguiendo = null;
    this.verMapa = false; this.camMapa = null; this.modoVuelo = false; this.vuelo = null; this.tendero = null; this.bayero = null;
    this.placas.clear(); this.bocadillos.clear();
    this.red?.fuente(null);
    if (!this.partida || data.nueva) this.partida = (data.nueva ? null : Partida.cargar()) ?? Partida.nueva(data.inicial, data.usuario);
    const id = data.mapa ?? 'pueblo';
    this.red?.presentar(this.partida.estado.semilla);
    this.semillaMapa = this.red?.semilla ?? this.partida.estado.semilla;
    this.mapa = crearMapa(id, this.semillaMapa);
    for (const aviso of revisarSalidas(this.mapa)) console.warn('Mapa del mundo:', aviso);
    this.partida.guardar();

    // Luz: el pipeline cel para los Pokémon con normales y Light2D para todo lo demás (como WorldScene).
    this.events.off(Phaser.Scenes.Events.ADDED_TO_SCENE, this.iluminar, this);
    const cel = pipelineCel(this); cel.altura = 0.5; cel.bandas = 3; cel.suave = 0.5; cel.ganancia = 0.55;
    this.lights.enable().setAmbientColor(0xffffff);
    this.events.on(Phaser.Scenes.Events.ADDED_TO_SCENE, this.iluminar, this);

    // Zonas de bioma: su paleta y sus texturas (cargadas en Preload como suelo_<bioma>_a / _b).
    const su = this.mapa.suelo;
    this.terrain = new Terrain(this.mapa.datos, S, su ? { paleta: PALETAS_BIOMA[su], decals: false, claves: { cesped: `suelo_${su}_a`, tierra: `suelo_${su}_b` } } : { paleta: PALETA_DIBUJO, decals: false });
    // Sprites de quien sale en este mapa (en paralelo al suelo).
    const formas = [this.partida.activo, ...(this.mapa.id === 'pueblo' ? this.partida.estado.equipo : [])].map(m => idSprite(formaDe(m.linea, m.nivel).dex, m.shiny));
    // Los salvajes y todo lo que puede salir cuando reaparecen (la tabla de la zona, a los niveles que hay).
    const niveles = new Set(this.mapa.salvajes.map(r => r.nivel)), tabla = lineasDe(this.mapa.id);
    for (const r of this.mapa.salvajes) formas.push(formaDe(r.linea, r.nivel).dex);
    for (const nv of niveles) for (const l of tabla) formas.push(formaDe(l, nv).dex);
    formas.push(DEX_VUELO);
    if (this.mapa.tienda) formas.push(DEX_TIENDA);
    if (this.mapa.bayero) formas.push(DEX_BAYERO);
    if (this.mapa.alfa) formas.push(FORMAS[this.mapa.alfa.forma].dex);
    for (const m of this.partida.misiones) formas.push(m.dex);   // caras de los iconos de misión (HUD)
    // Progreso: los sprites van en dos pasadas del cargador (AnimData.xml y luego las hojas); el suelo, aparte.
    let pasada = 0, suelo = false;
    const avance = (p: number) => carga?.progreso(0.1 + 0.3 * pasada + 0.3 * p + (suelo ? 0.1 : 0));
    const fin = () => { pasada = Math.min(2, pasada + 1); avance(0); };
    this.load.on('progress', avance); this.load.on('complete', fin);
    try {
      await Promise.all([this.terrain.calcular(this).then(() => { suelo = true; avance(0); }), cargar(this, formas)]);
    } finally { this.load.off('progress', avance); this.load.off('complete', fin); }
    carga?.progreso(0.85);
    if (n !== this.montaje || !this.sys.isActive()) return;
    this.terrain.build(this);
    const cat = this.registry.get(REG.dibujo) as { elementos: Elemento[] }, porId = new Map(cat.elementos.map(e => [e.id, e]));
    const caras = tirasDeBorde(this.mapa, porId, (x, y) => this.terrain.esAgua(x, y));   // acantilados y muros en el borde del macizo
    vestirMacizo(this.mapa, porId, caras);   // el resto del macizo: montañas, arboledas y piezas que no tapan lo pisable
    const tiras = expandirTiras(this.mapa.colocados, porId);   // muros, vallas, acantilados y puentes en fila
    this.mapa.colocados = tiras.colocados;
    despejarPuentes(this.mapa, tiras.pasos);
    this.pavimentar();
    this.pintar();
    ponerTinteSombra(this.mapa.pavimentos || this.mapa.pintado ? 0xffb7ff : 0xffffff);
    const bloques = this.crearEscenario(porId);
    this.abrirMacizoVacio();
    this.mundo = new Mundo({
      mapa: this.mapa, partida: this.partida, desde: data.desde ?? 'inicio', bloques, agua: (x, y) => !enRect(tiras.pasos, x, y) && (this.terrain.esAgua(x, y) || enMacizo(this.mapa, x, y) || muroPintado(this.mapa, x, y)),   // el macizo de las zonas de bioma y los muros de un mapa pintado bloquean como el agua
      anatomia: this.anatomia, probShiny: this.probShiny, natu: new URLSearchParams(location.search).get('natu') ?? undefined,
    });
    this.ponerVuelo(porId, bloques);
    this.ponerTendero(bloques);
    this.ponerBayero(bloques);
    this.ponerDetalles(cat.elementos, porId, bloques);
    const mundo = this.mundo;
    if (data.pos) { mundo.jugador.x = data.pos.x; mundo.jugador.y = data.pos.y; }
    if (data.vuelo) { const q = this.aterrizaje(data.vuelo.x, data.vuelo.y + 30); mundo.jugador.x = q.x; mundo.jugador.y = q.y; mundo.jugador.dir = 4; }
    this.chat.activar(this, this.red, this.partida.usuario);
    this.chat.alDecir = (uid, texto) => this.decir(uid ? `remoto-${uid}` : mundo.jugador.uid, texto);
    if (this.red) {
      mundo.miRed = this.red.uid;
      this.llegada = performance.now(); this.dueno = this.red.uid; this.fotoT = 0; this.ajenos.clear(); this.compartir = [];
      this.tradeo ??= new Tradeo(this.red.uid, () => this.partida, m => this.red!.enviar(m, true), txt => this.aviso(txt), (r, d) => this.tratoHecho(r, d));
      this.tradeo.cerrar('Comercio cancelado: has cambiado de zona');
      this.escucharRed();
      this.red.fuente(() => {
        if (this.mundo !== mundo || !this.listo) return null;
        const p = mundo.jugador, m = this.partida.activo, r1 = (v: number) => Math.round(v * 10) / 10;
        return { uid: this.red!.uid, mapa: this.mapa.id, x: r1(p.x), y: r1(p.y), dir: p.dir, anda: p.anda, dex: p.dex, nombre: p.nombre, usuario: this.partida.usuario, nivel: m.nivel,
          anim: p.anim, animN: p.animN, animResta: p.anim ? Math.max(0, Math.round((p.animHasta - mundo.ahora) * 100) / 100) : 0, estado: p.estado,
          vida: p.muerto ? 0 : Math.round(p.ps / p.stats.hp * 100) / 100, enMapa: r1((performance.now() - this.llegada) / 1000), semilla: this.partida.estado.semilla };
      });
    }

    this.stage?.dispose();
    this.stage = new Stage(this);
    this.stage.geometria = uid => { const l = this.mundo?.luchador(uid); return l && !l.muerto ? this.geo(l) : null; };
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.stage.dispose());

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
    cam.setZoom(S).setBounds(0, 0, this.mapa.W, this.mapa.H).setRoundPixels(true);
    this.sincronizar();
    cam.fadeIn(350, 0, 0, 0);

    this.entradas();
    if (!this.scene.isActive('hud')) this.scene.launch('hud');
    this.listo = true;
    // El HUD recién lanzado se crea en el siguiente paso: el rótulo de la zona y el aviso, un poco después.
    const mapa = this.mapa;
    this.time.delayedCall(1200, () => { if (this.mapa === mapa && this.listo) this.miniatura(); });
    this.time.delayedCall(250, () => {
      if (this.mapa !== mapa) return;
      this.events.emit('zona', { nombre: mapa.nombre, lema: mapa.lema });
      this.aviso(data.vuelo ? `${NOMBRE_VUELO} te deja en ${mapa.nombre}.` : mapa.id !== 'pueblo' ? mapa.bienvenida
        : this.partida.estado.equipo.length > 1 ? 'El pueblo. Pulsa F junto a uno de tus Pokémon para convertirte en él, o junto al tablón de la plaza para ver las misiones.'
        : 'El pueblo. F junto al tablón de la plaza: misiones. El camino del norte lleva al bosque. Teclas 1-0: tu barra (K para colocar movimientos).');
    });
  }

  // Macizo sin nada dibujado encima: se abre (biomas.abrirMacizo). Las piezas, por cubos de 64 px según su rectángulo.
  private abrirMacizoVacio(): void {
    if (!this.mapa.macizo) return;
    const C = 64, cubos = new Map<number, Pieza[]>();
    for (const p of this.piezas) {
      const b = p.img.getBounds();
      for (let j = Math.floor(b.top / C); j <= Math.floor(b.bottom / C); j++)
        for (let i = Math.floor(b.left / C); i <= Math.floor(b.right / C); i++) {
          const k = j * 4096 + i, l = cubos.get(k);
          if (l) l.push(p); else cubos.set(k, [p]);
        }
    }
    abrirMacizo(this.mapa, (x, y) => !this.terrain.esAgua(x, y),
      (x, y) => !!cubos.get(Math.floor(y / C) * 4096 + Math.floor(x / C))?.some(p => tapa(p, x, y, -Infinity)));
  }

  // ---- Escenario: elementos Klein con su huella como colisión, farolas, detalles ----
  private crearEscenario(porId: Map<string, Elemento>): Bloque[] {
    const bloques: Bloque[] = [];
    for (const c of this.mapa.colocados) {
      const el = porId.get(c.id);
      if (el) this.ponerElemento(c, el, bloques);
    }
    return bloques;
  }
  // Un elemento del catálogo: su dibujo, su huella como colisión y su luz, si tiene.
  private ponerElemento(c: Colocado, el: Elemento, bloques: Bloque[]): void {
    const p = dibujar(this, el, c);
    if (!p.plano) this.piezas.push(p);
    if (p.suelo) for (const poli of p.suelo) {
      const xs = poli.map(q => q[0]), ys = poli.map(q => q[1]), x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
      bloques.push({ x: (x0 + x1) / 2, y: y1, w: x1 - x0, h: y1 - y0, poli });
    } else if (p.huellas) for (const h of p.huellas) bloques.push({ x: (h.x0 + h.x1) / 2, y: h.y1, w: h.x1 - h.x0, h: h.y1 - h.y0 });
    else if (p.huella) { const h = p.huella; bloques.push({ x: (h.x0 + h.x1) / 2, y: h.y1, w: h.x1 - h.x0, h: h.y1 - h.y0, rombo: el.tipo === 'estanque' }); }
    const l = puntoLuz(p);
    if (l) this.encender(l[0], l[1], TIPOS_LUZ[c.luz ?? (el.id === 'hoguera' ? 'hoguera' : 'farol')], p.base + 1);
  }
  // El punto de vuelo: el volador y un farol a su lado en el rellano de vuelo de la zona (`vuelo`); si la zona no
  // tiene, en el primer hueco libre y con espacio alrededor cerca de la entrada, lejos de las salidas. Sus huellas se
  // suman al mundo.
  private ponerVuelo(porId: Map<string, Elemento>, bloques: Bloque[]): void {
    const mapa = this.mapa, mundo = this.mundo!, s0 = mapa.salidas[0], a = mapa.vuelo ?? (s0 && mapa.llegada[s0.a]) ?? mapa.llegada.inicio;
    if (!a) return;
    // Libre su sitio y el del farol, y con hueco alrededor (por arriba, abajo y a los lados) para no tapar un pasillo.
    const libre = (x: number, y: number) => [[0, 0], [-14, 0], [14, 0], [0, -10], [0, 12], [-FAROL_DX, -2], [-FAROL_DX, 6],
      [0, -30], [0, 30], [36, 0], [-FAROL_DX - 22, 0], [-FAROL_DX, -28], [-FAROL_DX, 28]].every(([dx, dy]) => mundo.pisable({ x: x + dx, y: y + dy }));
    const lejos = (x: number, y: number) => mapa.salidas.every(s => x < s.x0 - 100 || x > s.x1 + 100 || y < s.y0 - 100 || y > s.y1 + 100);
    // Con rellano (lo reserva el generador de la zona: data/rellano.ts), ahí; si no, el primer hueco que valga.
    let sitio: { x: number; y: number } | null = mapa.vuelo ?? null;
    for (let r = 90; r <= 300 && !sitio; r += 12) for (let k = 0; k < 24 && !sitio; k++) {
      const ang = (k / 24) * Math.PI * 2, x = Math.round(a.x + Math.cos(ang) * r), y = Math.round(a.y + Math.sin(ang) * r * 0.75);
      if (x > 50 && y > 70 && x < mapa.W - 50 && y < mapa.H - 40 && libre(x, y) && lejos(x, y)) sitio = { x, y };
    }
    if (!sitio) return;
    const { x, y } = sitio, nuevos: Bloque[] = [];
    const farol = mapa.pintado ? undefined : porId.get(mapa.id === 'pueblo' ? 'farola' : 'farola_madera') ?? porId.get('farola');   // en un mapa pintado, sin farol suelto
    if (farol) this.ponerElemento({ id: farol.id, x: x - FAROL_DX, y: y - 2 }, farol, nuevos);
    nuevos.push({ x, y: y + 3, w: 36, h: 14, rombo: true });
    mundo.anadirBloques(nuevos);
    bloques.push(...nuevos);
    const an = ancla(DEX_VUELO), alto = an.alto * VUELO_ESCALA, ancho = Math.max(10, Math.min(34, an.ancho * 0.75)) * VUELO_ESCALA;
    const spr = this.add.sprite(x, y, '__DEFAULT').setDepth(y).setScale(VUELO_ESCALA);
    poner(spr, DEX_VUELO, 'Idle', 0);
    const sombra = this.add.ellipse(x, y - 1, ancho, ancho * 0.36, 0x2c4422, 0.3).setDepth(y - 1);
    const placa = this.add.text(x, y - alto - 2, `${NOMBRE_VUELO}\n‹Vuelos›`, { fontFamily: '"Segoe UI", system-ui, sans-serif', fontSize: `${5.5 * S}px`, fontStyle: 'bold', color: '#9be38a', stroke: '#16301a', strokeThickness: 2 * S, align: 'center' })
      .setOrigin(0.5, 1).setScale(1 / S).setDepth(1e5).setLineSpacing(-1 * S);
    texturaPixel(this, 'icono_vuelo', ICONO_VUELO);
    texturaPixel(this, 'icono_descubrir', ICONO_DESCUBRIR);
    // El del pueblo (tu hogar) viene descubierto; de los demás, se apunta dónde está por si ha cambiado.
    const vs = this.partida.estado.vuelos ??= {};
    if (mapa.id === 'pueblo' || vs[mapa.id]) vs[mapa.id] = { x, y, u: x / mapa.W, v: y / mapa.H };
    const icono = this.add.image(x, placa.y - 16, vs[mapa.id] ? 'icono_vuelo' : 'icono_descubrir').setOrigin(0.5, 1).setDepth(1e5).setScale(2);
    for (const o of [sombra, placa, icono]) o.resetPipeline();
    this.vuelo = { x, y, spr, sombra, placa, icono, fila: 0 };
  }
  // El tendero (Kecleon) en su sitio del pueblo, con su nombre, «‹Tienda›» y la bolsa encima; su huella se suma al mundo.
  private ponerTendero(bloques: Bloque[]): void {
    const t = this.mapa.tienda;
    if (!t) return;
    const { x, y } = t, an = ancla(DEX_TIENDA), ancho = Math.max(10, Math.min(30, an.ancho * 0.75));
    const nuevo: Bloque = { x, y: y + 2, w: 18, h: 8, rombo: true };
    this.mundo!.anadirBloques([nuevo]); bloques.push(nuevo);
    const spr = this.add.sprite(x, y, '__DEFAULT').setDepth(y);
    poner(spr, DEX_TIENDA, 'Idle', 0);
    const sombra = this.add.ellipse(x, y - 1, ancho, ancho * 0.36, 0x2c4422, 0.3).setDepth(y - 1);
    const placa = this.add.text(x, y - an.alto - 2, `${NOMBRE_TIENDA}
‹Tienda›`, { fontFamily: '"Segoe UI", system-ui, sans-serif', fontSize: `${5.5 * S}px`, fontStyle: 'bold', color: '#9be38a', stroke: '#16301a', strokeThickness: 2 * S, align: 'center' })
      .setOrigin(0.5, 1).setScale(1 / S).setDepth(1e5).setLineSpacing(-1 * S);
    texturaPixel(this, 'icono_tienda', ICONO_TIENDA);
    const icono = this.add.image(x, placa.y - 16, 'icono_tienda').setOrigin(0.5, 1).setDepth(1e5).setScale(2);
    for (const o of [sombra, placa, icono]) o.resetPipeline();
    this.tendero = { x, y, spr, placa, icono, fila: 0 };
  }
  // Quieto, el tendero mira hacia ti cuando te acercas; la bolsa flota. La tienda se cierra al alejarte.
  private pasoTendero(): void {
    const v = this.tendero, p = this.mundo!.jugador;
    if (!v) return;
    v.icono.setY(v.placa.y - 13 - Math.abs(Math.sin(this.mundo!.ahora * 2.5 + 1)) * 3).setVisible(this.panel !== 'tienda');
    const d = Math.hypot(p.x - v.x, p.y - v.y);
    const fila = d < 110 ? ROW_FROM_ANGLE[(Math.round(Math.atan2(p.y - v.y, p.x - v.x) / (Math.PI / 4)) + 8) % 8] : 0;
    if (fila !== v.fila) { v.fila = fila; poner(v.spr, DEX_TIENDA, 'Idle', fila); }
    if (this.panel === 'tienda' && d > TIENDA_CERCA + 30) this.panel = null;
  }
  // Comprar en la tienda (clic en el HUD): `n` del objeto, si llega el dinero.
  comprar(id: string, n = 1): void {
    const it = ITEMS[id];
    if (!it || this.panel !== 'tienda' || !VENTA.includes(id)) return;
    if (!this.partida.comprar(id, it.precio, n)) { this.aviso(`No te llega: ${it.nombre} ×${n} cuesta ${it.precio * n} Pokécoins`); return; }
    this.guardar();
    this.aviso(`Compras ${it.nombre} ×${n} por ${it.precio * n} Pokécoins`);
  }
  // Aipom, el obseso de las bayas, con su nombre, «‹Misiones›» y «!» o «?» encima; su huella se suma al mundo.
  private ponerBayero(bloques: Bloque[]): void {
    const t = this.mapa.bayero;
    if (!t) return;
    const { x, y } = t, an = ancla(DEX_BAYERO), ancho = Math.max(10, Math.min(40, an.ancho * 0.75));
    const nuevo: Bloque = { x, y: y + 2, w: 16, h: 8, rombo: true };
    this.mundo!.anadirBloques([nuevo]); bloques.push(nuevo);
    const spr = this.add.sprite(x, y, '__DEFAULT').setDepth(y);
    poner(spr, DEX_BAYERO, 'Idle', 0);
    const sombra = this.add.ellipse(x, y - 1, ancho, ancho * 0.36, 0x2c4422, 0.3).setDepth(y - 1);
    const placa = this.add.text(x, y - an.alto - 2, `${NOMBRE_BAYERO}
‹Bayas›`, { fontFamily: '"Segoe UI", system-ui, sans-serif', fontSize: `${5.5 * S}px`, fontStyle: 'bold', color: '#f0a0c8', stroke: '#3a1630', strokeThickness: 2 * S, align: 'center' })
      .setOrigin(0.5, 1).setScale(1 / S).setDepth(1e5).setLineSpacing(-1 * S);
    const icono = this.add.text(x, placa.y - 2, '!', { fontFamily: '"Pixelify Sans", "Segoe UI", sans-serif', fontSize: `${18 * S}px`, fontStyle: 'bold', color: '#ffd84a', stroke: '#3a2412', strokeThickness: 3 * S })
      .setOrigin(0.5, 1).setScale(1 / S).setDepth(1e5).setVisible(false);
    for (const o of [sombra, placa, icono]) o.resetPipeline();
    this.bayero = { x, y, spr, placa, icono, fila: 0 };
  }
  // Las misiones de Aipom que se ofrecen ahora (la cadena avanza al entregar cada una).
  get misionesBayero(): Mision[] { return this.partida.misiones.filter(m => m.zona === 'pueblo' && this.partida.disponible(m)); }
  // Quieto, mira hacia ti cuando te acercas; «!» (nueva) o «?» (para entregar) flota encima. El panel se cierra al alejarte.
  private pasoBayero(): void {
    const v = this.bayero, p = this.mundo!.jugador;
    if (!v) return;
    const est = this.misionesBayero.map(m => this.partida.estadoMision(m)), c = est.includes('lista') ? '?' : est.includes('nueva') ? '!' : '';
    v.icono.setVisible(!!c && this.panel !== 'bayas');
    if (c && v.icono.text !== c) v.icono.setText(c).setColor(c === '?' ? '#ffe680' : '#ffd84a');
    v.icono.setY(v.placa.y - 2 - Math.abs(Math.sin(this.mundo!.ahora * 3)) * 4);
    const d = Math.hypot(p.x - v.x, p.y - v.y);
    const fila = d < 110 ? ROW_FROM_ANGLE[(Math.round(Math.atan2(p.y - v.y, p.x - v.x) / (Math.PI / 4)) + 8) % 8] : 0;
    if (fila !== v.fila) { v.fila = fila; poner(v.spr, DEX_BAYERO, 'Idle', fila); }
    if (this.panel === 'bayas' && d > BAYERO_CERCA + 30) this.panel = null;
  }
  // Puntos de vuelo descubiertos (por zona, dónde está su volador). Se descubren hablando con él (F).
  get vuelosConocidos(): Record<string, { x: number; y: number; u: number; v: number }> { return this.partida.estado.vuelos ?? {}; }
  // Quieto, el volador mira hacia ti cuando te acercas; el icono flota.
  private pasoVuelo(): void {
    const v = this.vuelo, p = this.mundo!.jugador;
    if (!v) return;
    v.icono.setY(v.placa.y - 13 - Math.abs(Math.sin(this.mundo!.ahora * 2.5)) * 3);
    const fila = Math.hypot(p.x - v.x, p.y - v.y) < 110 ? ROW_FROM_ANGLE[(Math.round(Math.atan2(p.y - v.y, p.x - v.x) / (Math.PI / 4)) + 8) % 8] : 0;
    if (fila !== v.fila) { v.fila = fila; poner(v.spr, DEX_VUELO, 'Idle', fila); }
  }
  // Un sitio donde aterrizar cerca de (x, y) (junto al volador): el punto pisable más cercano, lejos de las salidas.
  private aterrizaje(x: number, y: number): { x: number; y: number } {
    const m = this.mundo!, { W, H, salidas } = this.mapa;
    const ok = (q: { x: number; y: number }) => q.x > 24 && q.y > 30 && q.x < W - 24 && q.y < H - 24
      && salidas.every(s => q.x < s.x0 - 30 || q.x > s.x1 + 30 || q.y < s.y0 - 30 || q.y > s.y1 + 30)
      && m.pisable(q) && m.pisable({ x: q.x - 10, y: q.y }) && m.pisable({ x: q.x + 10, y: q.y });
    for (let r = 0; r <= 300; r += 6) for (let k = 0, n = r ? Math.ceil(r / 4) : 1; k < n; k++) {
      const a = (k / n) * Math.PI * 2, q = { x: Math.round(x + Math.cos(a) * r), y: Math.round(y + Math.sin(a) * r) };
      if (ok(q)) return q;
    }
    return { x: m.jugador.x, y: m.jugador.y };
  }
  // Vuelo a otro punto de vuelo descubierto: el volador viene a por ti, subís los dos mientras se funde a negro y
  // apareces junto al volador de esa zona (se monta su mapa con `vuelo`).
  volar(d: { mapa: MapaId }): void {
    const mundo = this.mundo, ave = this.vuelo, dest = this.vuelosConocidos[d.mapa];
    if (!this.listo || !mundo || !ave || !dest || d.mapa === this.mapa.id) return;
    this.mostrarMapa(false);
    this.listo = false; this.objetivo = null; mundo.cortarHogar(); this.guardar(); this.stage.settle();
    const p = mundo.jugador, yo = this.vistaDe(p), cam = this.cameras.main;
    this.aviso(`${NOMBRE_VUELO} te lleva volando a ${NOMBRE_ZONA[d.mapa]}`);
    const fila = ROW_FROM_ANGLE[(Math.round(Math.atan2(p.y - ave.y, p.x - ave.x) / (Math.PI / 4)) + 8) % 8];
    poner(ave.spr, DEX_VUELO, 'Walk', fila);
    ave.placa.setVisible(false); ave.icono.setVisible(false);
    this.tweens.add({
      targets: ave.spr, x: p.x, y: p.y + 1, duration: 450, ease: 'Sine.easeInOut',
      onUpdate: () => ave.sombra.setPosition(ave.spr.x, ave.spr.y - 1),
      onComplete: () => {
        ave.spr.setDepth(p.y + 1);
        poner(ave.spr, DEX_VUELO, 'Walk', 4);
        this.tweens.add({ targets: [ave.sombra, yo.sombra], alpha: 0, scale: 0.3, duration: 900 });
        cam.fadeOut(1000, 0, 0, 0);
        this.tweens.add({ targets: [ave.spr, yo.spr], y: '-=150', alpha: 0, duration: 1000, ease: 'Cubic.easeIn', onComplete: () => {
          this.tweens.killTweensOf([ave.spr, yo.spr, ave.sombra, yo.sombra]);
          this.scene.restart({ mapa: d.mapa, desde: 'inicio', vuelo: dest });
        } });
      },
    });
  }
  // Detalles por el césped libre (semilla fija por mapa).
  private ponerDetalles(elementos: Elemento[], porId: Map<string, Elemento>, bloques: Bloque[]): void {
    const ids = elementos.filter(e => e.tipo === 'detalle').map(e => e.id);
    const { W, H } = this.mapa, rnd = Phaser.Math.RND, mundo = this.mundo!;
    rnd.sow([this.mapa.id === 'pueblo' ? 'pueblo' : `${this.mapa.id}-${this.partida.estado.semilla}`]);
    for (let i = 0, k = 0; i < this.mapa.detalles * 6 && k < this.mapa.detalles; i++) {
      const x = rnd.between(30, W - 30), y = rnd.between(30, H - 30);
      if (mundo.enBloque(x, y) || this.terrain.nearWater(x, y, 10) || enRellano(this.mapa.rellano, x, y, 24) || bloques.some(b => x > b.x - b.w / 2 - 12 && x < b.x + b.w / 2 + 12 && y > b.y - b.h - 40 && y < b.y + 12)) continue;
      const c: Colocado = { id: ids[rnd.between(0, ids.length - 1)], x, y, flip: rnd.frac() < 0.5 };
      dibujar(this, porId.get(c.id)!, c); k++;
    }
  }
  private encender(x: number, y: number, tipo: TipoLuz, depth: number): void {
    this.halo();
    const luz = Object.assign(this.lights.addLight(x, y, tipo.radio, tipo.color, 0), { cel: tipo });
    const halo = this.add.image(x, y, 'halo').setDisplaySize(tipo.radio * 0.5, tipo.radio * 0.5).setTint(tipo.color).setAlpha(0).setBlendMode(Phaser.BlendModes.ADD).setDepth(depth);
    halo.resetPipeline();
    this.luces.push({ luz, halo, tipo, fase: Math.random() * 100 });
  }
  private halo(): void {
    if (this.textures.exists('halo')) return;
    const n = 64, c = this.textures.createCanvas('halo', n, n)!, g = c.getContext(), grad = g.createRadialGradient(n / 2, n / 2, 0, n / 2, n / 2, n / 2);
    grad.addColorStop(0, 'rgba(255,255,255,0.9)'); grad.addColorStop(0.35, 'rgba(255,255,255,0.35)'); grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad; g.fillRect(0, 0, n, n); c.refresh(); c.setFilter(Phaser.Textures.FilterMode.LINEAR);
  }
  // Pavimentos (la ciudad): cada rectángulo es una imagen propia con la textura repetida a la resolución de pantalla
  // (S px por px de mundo), así lleva Light2D como el resto y se ve de noche con las farolas. Entre el Terrain (-10000)
  // y los planos (-9000 + y).
  private pavimentar(): void {
    for (const [i, p] of (this.mapa.pavimentos ?? []).entries()) {
      const src = this.textures.get(`ciudad_${p.tex}`).getSourceImage() as HTMLImageElement, key = `pav_${this.mapa.id}_${i}`;
      if (this.textures.exists(key)) this.textures.remove(key);
      const cv = this.textures.createCanvas(key, Math.ceil(p.w * S), Math.ceil(p.h * S))!, ctx = cv.getContext();
      const pat = ctx.createPattern(src, 'repeat')!;
      pat.setTransform(new DOMMatrix().translate(-p.x * S, -p.y * S).scale(p.escala * S));   // anclado al mundo: dos pavimentos iguales casan
      ctx.fillStyle = pat; ctx.fillRect(0, 0, cv.width, cv.height); cv.refresh();
      this.add.image(p.x, p.y, key).setOrigin(0).setScale(1 / S).setDepth(-9500);
    }
  }

  // Mapa pintado (la ciudad, MapaAventura.pintado): la imagen entera de suelo, encima de todo el Terrain, y sus tapas
  // (trozos recortados por su polígono, con la profundidad de su base, para que quien pase por detrás quede oculto). Las
  // farolas pintadas llevan su luz.
  private pintar(): void {
    const p = this.mapa.pintado;
    if (!p) return;
    const src = this.textures.get(p.tex).getSourceImage() as HTMLImageElement;
    this.add.image(0, 0, p.tex).setOrigin(0).setScale(p.k).setDepth(-9500);
    for (const [i, t] of p.tapas.entries()) {
      const xs = t.poli.map(q => q[0]), ys = t.poli.map(q => q[1]);
      const x0 = Math.floor(Math.min(...xs)), y0 = Math.floor(Math.min(...ys)), x1 = Math.ceil(Math.max(...xs)), y1 = Math.ceil(Math.max(...ys));
      const key = `tapa_${this.mapa.id}_${i}`, k = p.k;
      if (this.textures.exists(key)) this.textures.remove(key);
      const cv = this.textures.createCanvas(key, Math.ceil((x1 - x0) / k), Math.ceil((y1 - y0) / k))!, ctx = cv.getContext();
      ctx.beginPath();
      for (const [x, y] of t.poli) ctx.lineTo((x - x0) / k, (y - y0) / k);
      ctx.closePath(); ctx.clip();
      ctx.drawImage(src, -x0 / k, -y0 / k); cv.refresh();
      this.add.image(x0, y0, key).setOrigin(0).setScale(k).setDepth(t.base);
    }
    for (const [x, y, d] of p.luces) this.encender(x, y, TIPOS_LUZ.farol, d);
  }

  private iluminar(go: Phaser.GameObjects.GameObject): void {
    if (go instanceof Phaser.GameObjects.Image || go instanceof Phaser.GameObjects.Sprite) go.setPipeline(go.texture.dataSource.length ? 'Cel' : 'Light2D');
  }
  private luzDelDia(t: number): void {
    const mundo = this.mundo!, m = this.partida.estado.minuto, [r0, g0, b0] = luzAmbiente(m), k = mundo.clima ? LUZ_CLIMA[mundo.clima.tipo] : [1, 1, 1];
    // La luz va hacia la que toca sin saltos: el tinte del clima cambia en unos segundos (como el fx) y el salto de
    // las 2:00 a las 6:00 se ve como un amanecer rápido. Al entrar en el mapa ya es la que toca.
    const meta = [r0 * k[0], g0 * k[1], b0 * k[2]], dtLuz = this.tLuz ? Math.min(0.1, (t - this.tLuz) / 1000) : 0, u = 1 - Math.exp(-dtLuz / 1.2);
    this.tLuz = t;
    this.luzAhora = this.luzAhora && mundo.ahora > 1.5 ? this.luzAhora.map((v, i) => v + (meta[i] - v) * u) as [number, number, number] : meta as [number, number, number];
    const [r, g, b] = this.luzAhora.map(v => Math.min(255, Math.round(v)));
    this.lights.setAmbientColor((r << 16) | (g << 8) | b);
    const on = farolas(m);
    for (const l of this.luces) { const f = animarLuz(l.tipo, t / 1000, l.fase) * on; l.luz.setIntensity(l.tipo.intensidad * f); l.halo.setAlpha(l.tipo.halo * f); }
    // De noche, una luz suave alrededor de ti (en el bosque no hay farolas) y las partículas se suman como luz.
    const oscuro = 1 - (r + g + b) / 765;
    if (!this.luzJugador) this.luzJugador = this.lights.addLight(0, 0, 150, 0xfff0d0, 0);
    this.luzJugador.setPosition(mundo.jugador.x, mundo.jugador.y - 14).setIntensity(Math.max(0, oscuro - 0.25) * 1.6);
    this.stage.fx.blend = oscuro > 0.45 ? 'lighter' : 'source-over';
  }
  // Lo que te tapa (copas, tejados) se aclara mientras estás detrás.
  private aclarar(dtMs: number): void {
    const p = this.mundo!.jugador, puntos = [[0, -4], [0, -12], [0, -19], [-8, -8], [8, -8]], paso = Math.min(1, dtMs / 120);
    for (const q of this.piezas) {
      const b = q.img.getBounds(), cerca = p.x > b.left - 10 && p.x < b.right + 10 && p.y > b.top && p.y - 20 < b.bottom;
      const meta = cerca && puntos.some(([dx, dy]) => tapa(q, p.x + dx, p.y + dy, p.y)) ? 0.45 : 1;
      if (q.img.alpha === meta) continue;
      const al = Math.abs(meta - q.img.alpha) < 0.02 ? meta : q.img.alpha + (meta - q.img.alpha) * paso;
      for (const im of q.partes) im.setAlpha(al);
    }
  }

  // ---- Vistas de los luchadores ----
  // El dex que hay cargado: el pedido o, si su hoja shiny aún no ha llegado, el normal.
  private cargado(dex: string): string { return listo(this, dex) ? dex : dex.replace(/s$/, ''); }
  private vistaDe(l: Luchador): Vista {
    const v = this.vistas.get(l.uid);
    if (v && v.logico === l.dex) return v;
    if (v) this.borrarVista(v);
    const dex = this.cargado(l.dex), k = clave(dex), idle = info(dex).Idle, an = ancla(dex);
    const spr = this.add.sprite(l.x, l.y, idle ? `${k}-${idle.hoja}` : '__DEFAULT');
    poner(spr, dex, 'Idle', 0);
    const ancho = Math.max(10, Math.min(34, an.ancho * 0.75)) * l.escala;
    const sombra = this.add.ellipse(l.x, l.y - 1, ancho, ancho * 0.36, 0x2c4422, 0.3);
    sombra.resetPipeline();
    const nv: Vista = { dex, logico: l.dex, spr, sombra, fx: fxSprite(spr), animN: l.animN, auraEn: 0, semillaEn: 0, visto: false };
    if (l.alfa) {
      this.halo();
      nv.aura = this.add.image(l.x, l.y, 'halo').setTint(0xff6a3a).setBlendMode(Phaser.BlendModes.ADD);
      nv.auraSuelo = this.add.ellipse(l.x, l.y, 10, 4).setStrokeStyle(1, 0xff7a4a, 0.8);
      nv.aura.resetPipeline(); nv.auraSuelo.resetPipeline();
    }
    if (dex !== l.dex) { const dexS = l.dex; void cargar(this, [dexS]).then(() => { if (spr.active && listo(this, dexS)) nv.dex = dexS; }); }
    this.vistas.set(l.uid, nv);
    return nv;
  }
  private borrarVista(v: Vista): void { v.spr.destroy(); v.sombra.destroy(); v.aura?.destroy(); v.auraSuelo?.destroy(); }
  // Una vista por luchador del mundo (las de los que ya no están se quitan) y la cámara detrás del tuyo.
  private sincronizar(): void {
    const mundo = this.mundo!, hay = new Set<string>();
    for (const l of [...mundo.todos(), ...mundo.remotos]) { hay.add(l.uid); this.vistaDe(l); }
    for (const [uid, v] of this.vistas) if (!hay.has(uid)) { this.borrarVista(v); this.vistas.delete(uid); }
    for (const [uid, t] of this.placas) if (!hay.has(uid)) { t.destroy(); this.placas.delete(uid); }
    const yo = this.vistas.get(mundo.jugador.uid)!.spr;
    if (this.siguiendo !== yo) { this.siguiendo = yo; this.cameras.main.startFollow(yo, true, 1, 1); }
  }
  // Geometría para las animaciones (px de escenario). Los puntos leen la posición del luchador cada vez: lo que la
  // animación guarda (el remolino de Gigadrenado, un rayo, un anillo) sigue al Pokémon si se mueve mientras dura.
  private geo(l: Luchador): SlotGeometry {
    const st = this.stage, vivo = (dy: () => number) => ({ get x() { return l.x * st.k; }, get y() { return (l.y - dy()) * st.k; } });
    return {
      slot: l.uid, side: l.rol === 'salvaje' ? 'p2' : 'p1',
      center: vivo(() => l.alto * 0.45), feet: vivo(() => 2), top: vivo(() => l.alto),
      size: Math.max(22, l.alto * 1.45) * st.k, sprite: this.vistaDe(l).fx,
    };
  }
  // Destello de shiny: unas estrellas que salen del cuerpo y se apagan (como al entrar en combate en los juegos).
  private destello(l: Luchador): void {
    const cy = l.y - l.alto * 0.5;
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2 + Math.random() * 0.5, r = 12 * l.escala + l.alto * 0.4;
      const st = this.add.text(l.x, cy, '✦', { fontFamily: '"Segoe UI Symbol", "Segoe UI", sans-serif', fontSize: `${(8 + Math.random() * 5) * S}px`, color: '#fff6b0', stroke: '#c8a020', strokeThickness: 1 * S })
        .setOrigin(0.5).setScale(0.2 / S).setDepth(1e5).setAlpha(0);
      st.resetPipeline();
      this.tweens.add({ targets: st, x: l.x + Math.cos(a) * r, y: cy + Math.sin(a) * r * 0.8, scale: 1 / S, alpha: { from: 1, to: 0 }, angle: 90,
        delay: i * 60 + (i % 2) * 260, duration: 650, ease: 'Cubic.easeOut', onComplete: () => st.destroy() });
    }
  }

  // ---- Entrada ----
  private entradas(): void {
    const kb = this.input.keyboard!;
    this.keys = kb.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT,F,SPACE,ESC,TAB,K,I,H,M,R,T', false) as Record<string, Phaser.Input.Keyboard.Key>;
    // Al perder el foco (otra ventana, Alt+Tab) no llega el "soltar": que no se quede andando solo.
    const soltar = () => kb.resetKeys();
    this.game.events.on(Phaser.Core.Events.BLUR, soltar);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.game.events.off(Phaser.Core.Events.BLUR, soltar));
    const nums = ['ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX', 'SEVEN', 'EIGHT', 'NINE', 'ZERO'];
    nums.forEach((n, i) => kb.addKey(n).on('down', () => this.casilla(i)));
    this.keys.TAB.on('down', (e: KeyboardEvent) => { e?.preventDefault?.(); if (this.listo) this.mundo?.siguienteObjetivo(); });
    kb.addCapture('TAB');
    this.keys.F.on('down', () => this.interactuar());
    this.keys.SPACE.on('down', () => this.interactuar());
    this.keys.H.on('down', () => this.usarHogar());
    this.keys.M.on('down', () => this.mostrarMapa(!this.verMapa));
    this.keys.R.on('down', () => { if (this.listo && this.red) this.mundo?.retar(); });
    this.keys.T.on('down', () => this.comerciar());
    this.keys.K.on('down', () => { this.panel = this.panel === 'movs' ? null : 'movs'; this.asignando = null; });
    this.keys.I.on('down', () => { this.panel = this.panel === 'inv' ? null : 'inv'; this.asignando = null; });
    this.keys.ESC.on('down', () => {
      if (this.verMapa) { this.mostrarMapa(false); return; }
      if (this.mundo?.rechazarReto()) return;
      if (this.tradeo?.cancelar()) return;
      if (this.mundo?.hogar) { this.mundo.cortarHogar(); return; }
      if (this.asignando) { this.asignando = null; return; }
      if (this.panel) { this.panel = null; return; }
      if (this.objetivo) { this.objetivo = null; return; }
      this.guardar(); this.scene.stop('hud'); this.scene.start('title');
    });
    this.input.mouse!.disableContextMenu();
    // Clic en un Pokémon: objetivo (el HUD se queda con los clics que caen en él).
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (!this.listo || !this.mundo || this.verMapa || (this.scene.get('hud') as { tapaClic?: (x: number, y: number) => boolean }).tapaClic?.(p.x, p.y)) return;
      const o = this.mundo.bajo(p.worldX, p.worldY);
      if (o) { this.objetivo = o; if (p.rightButtonDown()) this.casilla(0); }
      else if (!p.rightButtonDown()) this.objetivo = null;
    });
  }

  // Miniatura de la zona para el mapa del mundo: el suelo y el escenario (sin los Pokémon) pintados por orden de
  // profundidad en un canvas pequeño. Queda como textura `mini_<zona>` y en localStorage (data/mundo.ts).
  private miniatura(): void {
    const { W, H, id } = this.mapa, k = MINI_ANCHO / W, c = document.createElement('canvas');
    c.width = MINI_ANCHO; c.height = Math.round(H * k);
    const g = c.getContext('2d')!;
    g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
    const fuera = new Set<Phaser.GameObjects.GameObject>([this.anillo]);
    for (const v of this.vistas.values()) { fuera.add(v.spr); fuera.add(v.sombra); if (v.aura) fuera.add(v.aura); if (v.auraSuelo) fuera.add(v.auraSuelo); }
    this.children.depthSort();
    for (const o of this.children.list) {
      if (fuera.has(o)) continue;
      if (o instanceof Phaser.GameObjects.Ellipse && o.visible && o.isFilled) {   // sombras de los árboles
        const col = o.fillColor;
        g.globalAlpha = o.fillAlpha * o.alpha; g.globalCompositeOperation = 'source-over';
        g.fillStyle = `rgb(${col >> 16},${(col >> 8) & 255},${col & 255})`;
        g.beginPath(); g.ellipse(o.x * k, o.y * k, o.width / 2 * o.scaleX * k, o.height / 2 * o.scaleY * k, 0, 0, Math.PI * 2); g.fill();
        continue;
      }
      if (!(o instanceof Phaser.GameObjects.Image) || !o.visible || o.alpha <= 0 || o.blendMode === Phaser.BlendModes.ADD || o.texture.key === 'ground_mapa') continue;
      const fr = o.frame, img = fr.source.image as CanvasImageSource;
      g.save();
      g.globalAlpha = o.alpha; g.globalCompositeOperation = o.blendMode === Phaser.BlendModes.MULTIPLY ? 'multiply' : 'source-over';
      g.translate(o.x * k, o.y * k); g.rotate(o.rotation); g.scale(o.scaleX * k * (o.flipX ? -1 : 1), o.scaleY * k * (o.flipY ? -1 : 1));
      try { g.drawImage(img, fr.cutX, fr.cutY, fr.cutWidth, fr.cutHeight, -o.displayOriginX, -o.displayOriginY, fr.cutWidth, fr.cutHeight); } catch { /* textura sin imagen */ }
      g.restore();
    }
    if (this.textures.exists('mini_' + id)) this.textures.remove('mini_' + id);
    this.textures.addCanvas('mini_' + id, c);
    guardarMiniatura(this.partida.estado.semilla, id, c.toDataURL('image/jpeg', 0.82));
  }
  // El mapa abierto pasa de la zona al mundo (la cámara del mapa solo se ve con el de la zona).
  verMundo(v: boolean): void { this.camMapa?.setVisible(this.verMapa && !v); }

  // Abre o cierra el mapa: la cámara del mapa se hace la primera vez (sin las barras de vida ni el anillo del
  // objetivo); mientras está abierto no se pinta la cámara del juego ni los canvas de efectos, y no te mueves.
  mostrarMapa(v: boolean, vuelo = false): void {
    if (v && (!this.listo || this.evolucionando)) return;
    if (v && this.verMapa) return;
    this.modoVuelo = v && vuelo;
    if (v && !this.textures.exists('mini_' + this.mapa.id)) this.miniatura();   // recién llegado: aún no estaba
    this.verMapa = v;
    if (v && !this.camMapa) {
      const e = encajeMapa(this.mapa.W, this.mapa.H);
      this.camMapa = this.cameras.add(e.x, e.y, e.w, e.h).setZoom(e.zoom).centerOn(this.mapa.W / 2, this.mapa.H / 2).setBackgroundColor(0x1b120a);
      this.camMapa.ignore([this.barras, this.anillo, this.marcaG]);
      // El suelo reducido tanto sin suavizar se llena de puntitos (su grano): para el mapa, una copia ya reducida.
      const suelo = this.children.list.find(o => o instanceof Phaser.GameObjects.Image && o.texture.key === (this.mapa.pintado?.tex ?? 'ground')) as Phaser.GameObjects.Image | undefined;
      const fuente = suelo?.texture.getSourceImage() as HTMLCanvasElement | undefined;
      if (suelo && fuente) {
        if (this.textures.exists('ground_mapa')) this.textures.remove('ground_mapa');
        const c = this.textures.createCanvas('ground_mapa', e.w, e.h)!, cx = c.getContext();
        cx.imageSmoothingEnabled = true; cx.imageSmoothingQuality = 'high';
        cx.drawImage(fuente, 0, 0, e.w, e.h); c.refresh();
        const img = this.add.image(0, 0, 'ground_mapa').setOrigin(0).setDisplaySize(this.mapa.W, this.mapa.H).setDepth(suelo.depth);
        this.cameras.main.ignore(img); this.camMapa.ignore(suelo);
      }
    }
    this.camMapa?.setVisible(v);
    this.cameras.main.setVisible(!v);
    this.stage?.visible(!v);
    this.scene.setVisible(!v, 'hud');
    if (v) this.scene.launch('mapaZona'); else if (this.scene.isActive('mapaZona')) this.scene.stop('mapaZona');
  }

  // F / espacio: junto al tablón, las misiones; junto a uno de tus Pokémon del pueblo, convertirte en él.
  private interactuar(): void {
    const mundo = this.mundo;
    if (!this.listo || !mundo || mundo.jugador.muerto || this.verMapa) return;
    mundo.cortarHogar();
    const p = mundo.jugador, t = this.mapa.tablon;
    const v = this.vuelo;
    if (v && Math.hypot(v.x - p.x, v.y - p.y) < VUELO_CERCA) {
      if (mundo.salvajes.some(s => s.modo === 'pelear' && s.rival === p && !s.muerto)) { this.aviso('No se puede volar en pleno combate'); return; }
      const vs = this.partida.estado.vuelos ??= {};
      if (!vs[this.mapa.id]) {   // descubierto (como en el WoW: «Nueva ruta de vuelo»)
        vs[this.mapa.id] = { x: v.x, y: v.y, u: v.x / this.mapa.W, v: v.y / this.mapa.H };
        v.icono.setTexture('icono_vuelo');   // el «!» se va: ya se puede volar desde aquí
        this.guardar();
        this.vueloNuevo = true;   // lo anuncia el mapa de vuelo
      }
      this.mostrarMapa(true, true);   // MapaZona lee y apaga vueloNuevo al crearse
      return;
    }
    if (t && Math.hypot(t.x - p.x, t.y - p.y) < TABLON_CERCA) { this.panel = this.panel === 'misiones' ? null : 'misiones'; this.asignando = null; return; }
    const ti = this.tendero;
    if (ti && Math.hypot(ti.x - p.x, ti.y - p.y) < TIENDA_CERCA) { this.panel = this.panel === 'tienda' ? null : 'tienda'; this.asignando = null; return; }
    const by = this.bayero;
    if (by && Math.hypot(by.x - p.x, by.y - p.y) < BAYERO_CERCA) { this.panel = this.panel === 'bayas' ? null : 'bayas'; this.asignando = null; return; }
    mundo.interactuar();
  }

  // ---- Barra de atajos ----
  casilla(i: number): void {
    if (!this.listo || !this.mundo) return;
    const m = this.partida.activo;
    if (this.asignando) {   // colocar en la barra lo elegido en el panel
      const a = this.asignando;
      m.barra = m.barra.map(x => x && JSON.stringify(x) === JSON.stringify(a) ? null : x);
      m.barra[i] = a; this.asignando = null; this.guardar();
      return;
    }
    const a = m.barra[i];
    if (a) this.mundo.usarAtajo(a);
  }
  enfriando(a: { m: string } | { i: string }): number { return this.mundo?.enfriando(a) ?? 0; }
  lanzaFrac(l: Luchador): number { return this.mundo?.lanzaFrac(l) ?? 0; }
  cel(l: Luchador): number { return this.mundo?.cel(l) ?? 1; }
  auras(l: Luchador): Aura[] { return this.mundo?.auras(l) ?? []; }
  aceptarMision(m: Mision): void { this.mundo?.aceptarMision(m); }
  equipar(id: string | null, hueco: number): void { if (this.listo) this.mundo?.equipar(id, hueco); }
  usarItem(id: string): void { if (this.listo && !this.evolucionando) this.mundo?.usarItem(id); }
  entregarMision(m: Mision): void { this.mundo?.entregarMision(m); }
  hogarFalta(): number { return this.mundo?.hogarFalta() ?? 0; }
  hogarFrac(): number { return this.mundo?.hogarFrac() ?? 0; }
  usarHogar(): void { if (this.listo) this.mundo?.usarHogar(); }
  guardar(): void { if (this.mundo) this.mundo.guardar(); else this.partida?.guardar(); }
  aviso(txt: string): void { this.events.emit('aviso', txt); }

  // ---- Sucesos del mundo ----
  private suceso(s: Suceso): void {
    const mundo = this.mundo!;
    switch (s.tipo) {
      case 'aviso': this.aviso(s.txt); break;
      case 'rotulo': {
        const l = mundo.luchador(s.uid);
        if (!l) break;
        const top = this.geo(l).top;
        this.stage.label(s.azar ? { x: top.x + (Math.random() - 0.5) * 10, y: top.y } : top, s.txt, s.tono, s.retraso ?? 0);
        break;
      }
      case 'destello': { const l = mundo.luchador(s.uid); if (l) void this.stage.hitFlash(this.vistaDe(l).fx, s.ms); break; }
      case 'temblor': this.cameras.main.shake(180, 0.004); break;
      case 'drena': {
        const de = mundo.luchador(s.de), a = mundo.luchador(s.a);
        if (de && a && !de.muerto && !a.muerto) drenaje(this.stage, this.geo(de), this.geo(a));
        break;
      }
      case 'mov': void this.animarMov(mundo, s); break;
      case 'ball': this.lanzarBall(s); break;
      case 'ballFin': this.finBall(s); break;
      case 'debilitado': { const v = this.vistas.get(s.uid); if (v) this.tweens.add({ targets: v.fx, alpha: 0, delay: 700, duration: 600 }); break; }
      case 'clima': this.stage.clima.set(s.clima ? ASPECTO_CLIMA[s.clima] : null, mundo.ahora < 1.5); break;   // al entrar en el mapa ya está; luego entra y sale poco a poco
      case 'evoluciona': void this.evolucionar(s.antes, s.aprende); break;
      case 'ir': this.irA(s.mapa, s.desde); break;
    }
  }
  // La animación de un movimiento (la de Colleja); al llegar al impacto, el mundo aplica lo que ya tiró.
  private async animarMov(mundo: Mundo, s: Extract<Suceso, { tipo: 'mov' }>): Promise<void> {
    const l = mundo.luchador(s.de), t = mundo.luchador(s.a), r = s.golpe, id = s.mov, m = getMove(id);
    const commit = () => mundo.impacto(s.n);
    if (!l || !t) { commit(); return; }
    const efect = r.eficacia === 0 ? 'immune' : r.eficacia > 1 ? 'super' : r.eficacia < 1 ? 'resisted' : 'normal';
    const cue: MoveCue = {
      kind: 'move', user: l.uid, move: id, targets: t === l ? [] : [t.uid], spread: false,
      hits: r.falla || t === l ? [] : [{ slot: t.uid, effectiveness: efect, crit: r.critico, damaged: r.dano > 0 }],
      missed: r.falla ? [t.uid] : [], blocked: [], failed: false, hitCount: 1, drained: !!m?.drain && r.dano > 0, recoil: !!m?.recoil && r.dano > 0,
      // Las flechas de stats y el efecto de cada estado los pinta la animación al final (como en Colleja).
      boosts: s.efectos.filter(e => e.boosts).map(e => ({ slot: e.uid, changes: (Object.entries(e.boosts!) as [Stat6, number][]).map(([stat, amount]) => ({ stat, amount })) })),
      statuses: s.efectos.filter(e => e.estado).map(e => ({ slot: e.uid, status: e.estado! })),
    };
    const texts: MoveTexts = { boost: (st, n) => `${n > 0 ? '+' : ''}${n} ${NOMBRE_STAT[st as Stat6] ?? st}`, status: st => NOMBRE_ESTADO[st] ?? st };
    const anim = animationFor(id);
    const targets = t === l || anim.template === 'aura' || anim.template === 'shield' ? [] : [this.geo(t)];
    try {
      await animarMovimiento({ stage: this.stage, cue, animation: anim, palette: TYPE_FX[anim.type], user: this.geo(l), targets,
        losses: new Map([[t.uid, Math.min(1, r.dano / t.stats.hp)]]), commit, text: texts });
    } catch (e) { console.warn('animación', id, e); }
    commit();
  }
  // Objetos del suelo: se ven como una Poké Ball (no se sabe qué es hasta cogerlo); al cogerlo desaparece.
  private pintarSuelo(): void {
    for (const h of this.mundo!.hallazgos) {
      let img = this.suelo.get(h.i);
      if (!img) {
        img = this.add.image(h.x, h.y, 'obj_pokeball').setOrigin(0.5, 0.9).setDepth(h.y);
        img.resetPipeline();
        this.suelo.set(h.i, img);
      }
      img.setVisible(!!h.item);
    }
  }
  // Poké Ball: vuela hasta el salvaje y se mueve hasta que el mundo diga si se queda (`finBall`).
  private lanzarBall(s: Extract<Suceso, { tipo: 'ball' }>): void {
    const key = this.textures.exists('obj_' + s.item) ? 'obj_' + s.item : 'icono_' + s.item;
    const ball = this.add.image(s.x0, s.y0, key).setDepth(s.y1 + 11);
    ball.resetPipeline();
    if (!this.textures.exists('obj_' + s.item)) ball.setScale(10 / ball.width);
    this.balls.set(s.n, ball);
    const vuelo = { t: 0 };
    this.tweens.add({
      targets: vuelo, t: 1, duration: VUELO_BALL * 1000,
      onUpdate: () => ball.setPosition(s.x0 + (s.x1 - s.x0) * vuelo.t, s.y0 + (s.y1 - s.y0) * vuelo.t - Math.sin(vuelo.t * Math.PI) * 18).setAngle(vuelo.t * 540),
      onComplete: () => {
        if (this.balls.get(s.n) !== ball) return;
        ball.setAngle(0).setPosition(s.x1, s.y1 + 2);
        this.tweens.add({ targets: ball, angle: { from: -22, to: 22 }, duration: 160, yoyo: true, repeat: -1, repeatDelay: 260, delay: 250 });
      },
    });
  }
  private finBall(s: Extract<Suceso, { tipo: 'ballFin' }>): void {
    const ball = this.balls.get(s.n);
    if (!ball) return;
    this.balls.delete(s.n);
    this.tweens.killTweensOf(ball);
    if (s.ok === null) { ball.destroy(); return; }
    ball.setAngle(0);
    this.tweens.add({ targets: ball, alpha: 0, scale: s.ok ? ball.scale : ball.scale * 1.6, delay: s.ok ? 450 : 0, duration: 250, onComplete: () => ball.destroy() });
  }

  // Evoluciona el que manejas: se para el juego (esta escena y el HUD en pausa, los canvas de efectos ocultos) y la
  // escena 'evolucion' lo cuenta encima. Al terminar, el mundo le pone la forma nueva y todo sigue donde estaba (con
  // la escena en pausa el mundo no avanza).
  private async evolucionar(antes: ReturnType<typeof formaDe>, aprende: string[]): Promise<void> {
    const mundo = this.mundo!, p = mundo.jugador, m = this.partida.activo, f = formaDe(m.linea, m.nivel);
    await cargar(this, [idSprite(f.dex, m.shiny)]);
    // Si mientras cargaba ha cambiado de mapa o se ha debilitado, la forma nueva sale al volver a montar el mapa.
    if (this.mundo !== mundo || mundo.jugador !== p || p.muerto || mundo.cambiando || !this.listo || this.evolucionando) return;
    this.mostrarMapa(false);
    this.evolucionando = true;
    const cam = this.cameras.main, v = this.vistaDe(p);
    const datos: DatosEvolucion = {
      de: { dex: v.dex, nombre: antes.nombre, stats: statsDe(antes.base, m.nivel), tipos: tiposDe(antes.id) },
      a: { dex: idSprite(f.dex, m.shiny), nombre: f.nombre, stats: statsDe(f.base, m.nivel), tipos: tiposDe(f.id) }, nivel: m.nivel,
      color: COLOR_TIPO[tiposDe(f.id)[0]] ?? 0xffffff, aprende,
      x: (v.spr.x - cam.worldView.x) * cam.zoom, y: (v.spr.y - cam.worldView.y) * cam.zoom, escala: cam.zoom * v.spr.scaleX,
      pose: { tex: v.spr.texture.key, frame: v.spr.frame.name, ox: v.spr.originX, oy: v.spr.originY, dir: p.dir, flipX: v.spr.flipX },
      tinte: Phaser.Display.Color.GetColor(...(['r', 'g', 'b'] as const).map(k => Math.min(255, Math.round(this.lights.ambientColor[k] * 255))) as [number, number, number]),
      ocultar: () => { v.spr.setVisible(false); v.sombra.setVisible(false); },
      fin: () => {
        mundo.cambiarForma();
        v.spr.setVisible(true); v.sombra.setVisible(true);
        this.sincronizar();
        this.stage.visible(true);
        this.scene.resume(); this.scene.resume('hud'); this.scene.setVisible(true, 'hud');
        this.input.keyboard?.resetKeys();
        this.evolucionando = false;
        mundo.guardar();
      },
    };
    this.stage.visible(false);
    this.scene.pause(); this.scene.pause('hud'); this.scene.setVisible(false, 'hud');
    this.scene.launch('evolucion', datos);
  }

  // ---- Dibujar ----
  // Sprite, sombra y animación de cada luchador según lo que hace (más lo que le sumen las animaciones de movimientos).
  private dibujar(l: Luchador, v: Vista): void {
    const k = this.stage.k, f = v.fx, spr = v.spr, ahora = this.mundo!.ahora;
    if (l.shiny && !v.visto && !l.muerto && this.cameras.main.worldView.contains(l.x, l.y - l.alto / 2)) {
      v.visto = true;
      this.destello(l);
      if (l.rol === 'salvaje') this.aviso(`¡Un ${l.nombre} shiny!`);
    }
    // Una animación de acción nueva (golpe, disparo, dolor, dormir…).
    if (v.animN !== l.animN) { v.animN = l.animN; if (l.anim && poner(spr, v.dex, l.anim, l.dir)) this.iluminar(spr); }
    if (!l.muerto && (!l.anim || ahora >= l.animHasta)) {
      const a: AnimId = l.estado === 'slp' ? 'Sleep' : l.anda ? 'Walk' : 'Idle';
      const key = `${clave(v.dex)}-${a}-${a === 'Sleep' ? 0 : l.dir}`;
      if (spr.anims.currentAnim?.key !== key && poner(spr, v.dex, a, a === 'Sleep' ? 0 : l.dir)) this.iluminar(spr);
    } else if (l.anim && l.anim !== 'Sleep' && l.anim !== 'Faint') {
      const key = `${clave(v.dex)}-${l.anim}-${l.dir}`;   // un golpe se gira con quien lo da
      const cur = spr.anims.currentAnim?.key;
      if (cur && cur !== key && cur.startsWith(`${clave(v.dex)}-${l.anim}-`) && this.anims.exists(key)) {
        const fr = spr.anims.currentFrame?.index ?? 0;
        poner(spr, v.dex, l.anim, l.dir, { startFrame: Math.max(0, fr - 1) });
      }
    }
    const e = S >= 3 ? Math.round(l.escala * S) / S : l.escala;   // píxeles de pantalla enteros por píxel del sprite
    spr.setPosition(l.x + f.dx / k, l.y + f.dy / k).setScale(f.sx * e, f.sy * e).setAngle(f.rot).setAlpha(f.alpha * (l.enBall ? 0 : 1)).setDepth(l.y);
    // Golpe: silueta blanca. Si no, el tinte de su estado (quemado rojizo, envenenado morado, congelado azul…).
    if (f.flash > 0.5) { if (!spr.tintFill) spr.setTintFill(0xffffff); }
    else {
      const tinte = l.muerto ? 0xffffff : l.estado ? TINTE_ESTADO[l.estado] ?? 0xffffff : l.semilla ? TINTE_SEMILLA : 0xffffff;
      const parpadeo = l.estado === 'par' && Math.sin(ahora * 23) > 0.6 ? 0xffffa0 : tinte;   // paralizado: chispazos
      if (spr.tintFill || spr.tintTopLeft !== parpadeo) spr.setTint(parpadeo);
    }
    // Congelado: quieto en el fotograma en que se quedó.
    if (l.estado === 'frz' && !l.muerto) { if (spr.anims.isPlaying) spr.anims.pause(); } else if (spr.anims.isPaused) spr.anims.resume();
    // Lo que se ve de un estado mientras dura: una ráfaga sobre el cuerpo y, dormido, una "z" que sube.
    if (l.estado && !l.muerto && !l.enBall && ahora >= v.auraEn) {
      v.auraEn = ahora + ESTADO_CADA / 1000;
      auraEstado(this.stage, this.geo(l), l.estado);
      if (l.estado === 'slp' && Math.random() < 0.6) this.stage.label(this.geo(l).top, 'z', 'weak');
    }
    // Drenadoras: hojitas alrededor mientras dura (con su propio ritmo, para no pisar la ráfaga del estado).
    if (l.semilla && !l.muerto && !l.enBall && ahora >= v.semillaEn) { v.semillaEn = ahora + ESTADO_CADA / 1000; auraSemilla(this.stage, this.geo(l)); }
    v.sombra.setPosition(l.x, l.y - 1).setDepth(l.y - 1).setVisible(!l.enBall).setAlpha(l.muerto ? f.alpha : 1);
    // Aura del alfa: un resplandor rojizo que late detrás del cuerpo y un anillo en el suelo.
    if (v.aura && v.auraSuelo) {
      const late = 0.5 + 0.5 * Math.sin(ahora * 3.2), vis = l.muerto ? f.alpha : 1;
      v.aura.setPosition(l.x, l.y - l.alto * 0.45).setDisplaySize(l.alto * 1.9, l.alto * 1.9).setAlpha((0.4 + 0.25 * late) * vis).setDepth(l.y - 0.6);
      const w = v.sombra.width * (1.15 + 0.12 * late);
      v.auraSuelo.setPosition(l.x, l.y - 1).setSize(w, w * 0.36).setDisplaySize(w, w * 0.36).setDepth(l.y - 0.9).setAlpha((0.5 + 0.5 * late) * vis);
    }
  }
  // Barras de vida sobre los salvajes heridos o elegidos, y el anillo bajo el objetivo.
  private dibujarBarras(): void {
    const g = this.barras, mundo = this.mundo!;
    g.clear();
    for (const l of [...mundo.salvajes, mundo.jugador, ...mundo.remotos]) {
      const auras = l.muerto || l.enBall ? [] : mundo.auras(l);
      if (l.muerto || l.enBall || (l.ps >= l.stats.hp && l !== mundo.objetivo && !auras.length && !l.lanza)) continue;
      const w = l.alfa ? 32 : 20, x = l.x - w / 2, y = l.y - l.alto - 6, f = l.ps / l.stats.hp;
      if (l.alfa) g.fillStyle(0xffc04a, 1).fillRect(x - 1.5, y - 1.5, w + 3, 5);   // el alfa, con borde dorado
      if (l.rol === 'salvaje' || l.rol === 'remoto') {
        g.fillStyle(0x2a1a10, 0.75).fillRect(x - 0.5, y - 0.5, w + 1, 3);
        g.fillStyle(f > 0.5 ? 0x8fd36a : f > 0.2 ? 0xffd65a : 0xff6a5a, 1).fillRect(x, y, w * f, 2);
        // Lo que está lanzando: una barra fina debajo (naranja; verde si canaliza).
        if (l.lanza) {
          g.fillStyle(0x2a1a10, 0.75).fillRect(x - 0.5, y + 2.5, w + 1, 2);
          g.fillStyle(l.lanza.canal ? 0x7ad06a : 0xf0a838, 1).fillRect(x, y + 3, w * mundo.lanzaFrac(l), 1);
        }
      }
      // Bufos y debufos encima (como en las placas de un MMO): un cuadradito de su color, que se vacía con el tiempo.
      auras.forEach((a, i) => {
        const cx = l.x - (auras.length * 5 - 1) / 2 + i * 5, cy = y - 5;
        g.fillStyle(0x2a1a10, 0.8).fillRect(cx - 0.5, cy - 0.5, 5, 5);
        g.fillStyle(a.color, 1).fillRect(cx, cy, 4, 4);
        g.fillStyle(0x000000, 0.45).fillRect(cx, cy, 4, 4 * (1 - a.frac));
      });
    }
    const o = mundo.objetivo;
    if (o && !o.muerto) {
      const col = mundo.luchandoCon(o) ? COLOR_REACCION.pelea : o.rol === 'vecino' || o.rol === 'remoto' ? 0x9fd0ff : o.modo === 'pelear' ? COLOR_REACCION.pelea : COLOR_REACCION[mundo.reaccionA(o)];
      const w = Math.max(18, o.alto * 0.8);
      this.anillo.setVisible(true).setPosition(o.x, o.y - 2).setSize(w, w * 0.36).setDisplaySize(w, w * 0.36).setFillStyle(col, 0.45).setDepth(o.y - 1.5);
    } else this.anillo.setVisible(false);
  }
  // El círculo del golpe anunciado del alfa, que se llena.
  private pintarMarca(): void {
    const g = this.marcaG, mundo = this.mundo!, mk = mundo.marca;
    g.clear();
    if (!mk) return;
    const f = Math.min(1, (mundo.ahora - mk.t0) / (mk.t1 - mk.t0)), w = ALFA_RADIO * 2, h = ALFA_RADIO * 1.3;
    g.fillStyle(0xff3a1a, 0.16).fillEllipse(mk.x, mk.y, w, h);
    g.fillStyle(0xff4a2a, 0.22 + 0.2 * f).fillEllipse(mk.x, mk.y, w * f, h * f);
    g.lineStyle(1.2, 0xff5a3a, 0.6 + 0.4 * Math.abs(Math.sin(mundo.ahora * 10))).strokeEllipse(mk.x, mk.y, w, h);
  }
  // La luz bajo tus pies mientras canalizas la piedra de hogar.
  private pintarHogar(): void {
    const mundo = this.mundo!, p = mundo.jugador;
    if (!mundo.hogar) { this.hogarLuz?.destroy(); this.hogarLuz = null; return; }
    if (!this.hogarLuz) { this.hogarLuz = this.add.ellipse(p.x, p.y - 2, 30, 11, 0x8fd8ff, 0.4); this.hogarLuz.resetPipeline(); }
    const w = 26 + 10 * Math.sin(mundo.ahora * 6);
    this.hogarLuz.setPosition(p.x, p.y - 2).setDisplaySize(w, w * 0.38).setAlpha(0.25 + 0.35 * mundo.hogarFrac()).setDepth(p.y - 1.5);
  }
  // "?" sobre el tablón si hay misiones para entregar, "!" si hay nuevas; el panel se cierra al alejarte.
  private pasoTablon(): void {
    const t = this.mapa.tablon, p = this.mundo!.jugador;
    if (!t || !this.senal) return;
    const est = this.partida.misiones.filter(m => m.zona !== 'pueblo').map(m => this.partida.estadoMision(m)), c = est.includes('lista') ? '?' : est.includes('nueva') ? '!' : '';
    this.senal.setVisible(!!c && this.panel !== 'misiones');
    if (c && this.senal.text !== c) this.senal.setText(c).setColor(c === '?' ? '#ffe680' : '#ffd84a');
    this.senal.setY(t.y - 30 - Math.abs(Math.sin(this.mundo!.ahora * 3)) * 4);
    if (this.panel === 'misiones' && Math.hypot(t.x - p.x, t.y - p.y) > TABLON_CERCA + 30) this.panel = null;
  }

  // ---- Comercio (combate/tradeo.ts) ----
  // T: con otro jugador elegido y cerca, pedirle comerciar; si te lo han pedido, aceptar.
  private comerciar(): void {
    const tr = this.tradeo, mundo = this.mundo;
    if (!this.listo || !tr || !mundo || this.verMapa) return;
    if (tr.pideDe) { tr.pedir(tr.pideDe.de, tr.pideDe.nombre, this.partida.usuario); return; }
    const o = mundo.objetivo, p = mundo.jugador;
    if (!o || o.rol !== 'remoto') { this.aviso('Elige a otro jugador (Tab o clic) y pulsa T para comerciar'); return; }
    if (Math.hypot(o.x - p.x, o.y - p.y) > TRATO_LEJOS * 0.6) { this.aviso('Acércate más para comerciar'); return; }
    tr.pedir(o.uid.slice('remoto-'.length), o.usuario ?? o.nombre, this.partida.usuario);
  }
  private pasoTrato(dt: number): void {
    const tr = this.tradeo, mundo = this.mundo!;
    if (!tr) return;
    const p = mundo.jugador;
    tr.paso(dt, con => { const o = mundo.remotos.find(l => l.uid === `remoto-${con}`); return !!o && Math.hypot(o.x - p.x, o.y - p.y) < TRATO_LEJOS; });
    // Las caras de la ventana: tu equipo y lo que ofrece el otro (se cargan la primera vez).
    if (!tr.trato) return;
    const ids = [...this.partida.estado.equipo, ...tr.trato.suya.pokes].map(m => idSprite(formaDe(m.linea, m.nivel).dex, m.shiny));
    const faltan = ids.filter(id => !listo(this, id) && !this.cargandoTrato.has(id));
    if (faltan.length) { faltan.forEach(id => this.cargandoTrato.add(id)); void cargar(this, faltan).finally(() => faltan.forEach(id => this.cargandoTrato.delete(id))); }
  }
  // Hecho el cambio: guardar, contarlo y, en el pueblo, que los Pokémon que se van se vayan y los nuevos salgan.
  private tratoHecho(r: Recibido, dados: Recibido): void {
    this.guardar();
    const lista = (x: Recibido) => [...x.pokes.map(m => `${formaDe(m.linea, m.nivel).nombre} Nv ${m.nivel}${m.shiny ? ' ✦' : ''}`),
      ...Object.entries(x.items).map(([id, n]) => `${ITEMS[id]?.nombre ?? id} ×${n}`), ...(x.dinero ? [`${x.dinero} Pokécoins`] : [])].join(', ') || 'nada';
    this.aviso(`¡Comercio hecho! Recibes: ${lista(r)}. Das: ${lista(dados)}`);
    const ids = r.pokes.map(m => idSprite(formaDe(m.linea, m.nivel).dex, m.shiny)), mundo = this.mundo;
    void cargar(this, ids).then(() => { if (this.mundo === mundo && mundo) mundo.rehacerVecinos(); });
  }

  // ---- Multijugador ----
  // Los demás jugadores de este mapa, con lo último que ha llegado de cada uno (su sprite se carga la primera vez).
  private pasoRed(): void {
    const mundo = this.mundo!, aqui = new Set<string>();
    for (const e of this.red!.vivos()) {
      if (e.mapa !== this.mapa.id) continue;
      const normal = e.dex.replace(/s$/, '');
      if (!listo(this, normal)) {
        if (!this.cargandoRed.has(normal)) { this.cargandoRed.add(normal); void cargar(this, [normal]).finally(() => this.cargandoRed.delete(normal)); }
        continue;
      }
      if (mundo.ponerRemoto(e)) aqui.add(`remoto-${e.uid}`);
    }
    for (const l of [...mundo.remotos]) if (!aqui.has(l.uid)) mundo.quitarRemoto(l.uid.slice('remoto-'.length));
    // Dueño de los salvajes de este mapa: el que lleva más tiempo en él (a igualdad, el primero de la sala). Tú, si estás solo.
    const red = this.red!, ahora = performance.now(), yo = { uid: red.uid, desde: this.llegada };
    const aquiEstan = [yo, ...red.vivos().filter(e => e.mapa === this.mapa.id).map(e => ({ uid: e.uid, desde: ahora - (e.enMapa ?? 0) * 1000 }))];
    aquiEstan.sort((a, b) => Math.abs(a.desde - b.desde) > 500 ? a.desde - b.desde : red.orden(a.uid) - red.orden(b.uid));
    const dueno = aquiEstan[0].uid;
    if (dueno !== this.dueno) {
      this.dueno = dueno;
      console.log(`Multijugador: los salvajes de ${this.mapa.nombre ?? this.mapa.id} los lleva ${dueno === red.uid ? 'este jugador' : dueno}`);
    }
    mundo.ponerEspejo(dueno !== red.uid);
  }
  // Lo que hay que mandar: la foto de tus salvajes (si eres el dueño y hay alguien más), lo que les haces a los ajenos
  // y los sucesos que los demás tienen que ver.
  private enviarRed(dtMs: number): void {
    const red = this.red!, mundo = this.mundo!, mapa = this.mapa.id;
    if (!mundo.espejo && mundo.remotos.length && (this.fotoT += dtMs) >= 100) { this.fotoT = 0; red.enviar({ t: 'foto', mapa, f: mundo.foto() }); }
    for (const s of mundo.sacarSalidas()) red.enviar({ t: 'acc', mapa, s });
    if (this.compartir.length) { red.enviar({ t: 'sucs', mapa, l: this.compartir }); this.compartir = []; }
  }
  // Lo que llega de los demás (solo cuenta lo de tu mapa).
  private escucharRed(): void {
    if (this.escuchando || !this.red) return;
    this.escuchando = true;
    const red = this.red, deAqui = (m: Mensaje) => this.listo && !!this.mundo && m.mapa === this.mapa.id;
    red.on('foto', m => { if (deAqui(m) && m.uid === this.dueno) this.mundo!.aplicarFoto(m.f as Foto, m.uid); });
    red.on('acc', m => {
      if (!deAqui(m)) return;
      const mundo = this.mundo!, s = m.s as Salida, tr = (u: string) => mundo.traducir(u, m.uid);
      if (s.tipo === 'golpe') mundo.recibirGolpe(tr(s.de), tr(s.a), s.golpe, s.efectos);
      else if (s.tipo === 'ball') mundo.recibirBall(s.a, s.dentro, s.ok, `remoto-${m.uid}`);
      else if (s.tipo === 'muere') mundo.recibirMuerte(s);
      else if (s.tipo === 'clima') mundo.recibirClima(s.clima);
      else if (s.tipo === 'duelo') { if (s.para === red.uid) mundo.recibirDuelo(s.fase, `remoto-${m.uid}`, s.gana, s.abandona); }
    });
    red.on('trato', m => this.tradeo?.recibir(m as unknown as MensajeTrato & { uid: string }));
    red.on('sucs', m => { if (deAqui(m)) for (const s of m.l as Suceso[]) this.suceso(this.ajeno(s, m.uid)); });
    // Si la sala usa otra semilla que la de este mapa (te has unido estando en uno procedural), se rehace igual que el suyo.
    red.on('sala', () => {
      if (!this.listo || red.semilla === null || red.semilla === this.semillaMapa || this.mapa.id === 'pueblo') return;
      const p = this.mundo!.jugador;
      this.listo = false; this.guardar();
      this.scene.restart({ mapa: this.mapa.id, desde: 'inicio', pos: { x: p.x, y: p.y } });
    });
  }
  // Un suceso de otro jugador en tus términos: sus uids traducidos y su número (movimiento, Ball) cambiado por uno
  // negativo propio, para que no choque con los tuyos ni dispare un impacto aquí.
  private ajeno(s: Suceso, desde: string): Suceso {
    const mundo = this.mundo!, tr = (u: string) => mundo.traducir(u, desde);
    const n = (k: number) => { const c = `${desde}:${k}`; let v = this.ajenos.get(c); if (v === undefined) this.ajenos.set(c, v = -(this.ajenos.size + 1)); return v; };
    switch (s.tipo) {
      case 'rotulo': case 'destello': case 'debilitado': return { ...s, uid: tr(s.uid) };
      case 'mov': return { ...s, n: n(s.n), de: tr(s.de), a: tr(s.a), efectos: s.efectos.map(e => ({ ...e, uid: tr(e.uid) })) };
      case 'ball': return { ...s, n: n(s.n), a: tr(s.a) };
      case 'ballFin': return { ...s, n: n(s.n) };
      default: return s;
    }
  }
  // El nombre de usuario, y debajo su Pokémon y su nivel, sobre cada uno de los demás jugadores.
  private pintarPlacas(): void {
    for (const l of this.mundo!.remotos) {
      let t = this.placas.get(l.uid);
      const txt = `${l.usuario ?? 'Jugador'}
${l.nombre} Nv.${l.nivel}`;
      if (!t) {
        t = this.add.text(0, 0, txt, { fontFamily: '"Segoe UI", system-ui, sans-serif', fontSize: `${6 * S}px`, fontStyle: 'bold', color: '#bfe4ff', stroke: '#13263a', strokeThickness: 2 * S, align: 'center' })
          .setOrigin(0.5, 1).setScale(1 / S);
        t.resetPipeline();
        this.placas.set(l.uid, t);
      } else if (t.text !== txt) t.setText(txt);
      t.setPosition(l.x, l.y - l.alto - (l.ps < l.stats.hp || l.estado ? 12 : 3)).setDepth(1e5);   // encima de su barra, si la tiene
    }
  }

  // Lo que alguien dice por el chat, en un bocadillo sobre su cabeza durante unos segundos (si está en este mapa).
  private decir(uid: string, texto: string): void {
    const viejo = this.bocadillos.get(uid);
    viejo?.t.destroy();
    const t = this.add.text(0, 0, texto, { fontFamily: '"Segoe UI", system-ui, sans-serif', fontSize: `${6 * S}px`, fontStyle: 'bold', color: '#fff8e6',
      stroke: '#2a2016', strokeThickness: 2 * S, align: 'center', wordWrap: { width: 90 * S } }).setOrigin(0.5, 1).setScale(1 / S).setVisible(false);
    t.resetPipeline();
    this.bocadillos.set(uid, { t, hasta: performance.now() + 3000 + texto.length * 60 });
  }
  private pintarBocadillos(): void {
    const mundo = this.mundo!, ahora = performance.now();
    for (const [uid, b] of this.bocadillos) {
      const l = mundo.luchador(uid);
      if (ahora > b.hasta || (!l && !uid.startsWith('remoto-'))) { b.t.destroy(); this.bocadillos.delete(uid); continue; }
      if (!l) { b.t.setVisible(false); continue; }
      const sobre = this.placas.get(uid), y = sobre ? sobre.y - sobre.displayHeight - 2 : l.y - l.alto - (l.ps < l.stats.hp || l.estado ? 12 : 3);
      b.t.setPosition(l.x, y).setDepth(1e5 + 1).setVisible(true).setAlpha(Math.min(1, (b.hasta - ahora) / 400));
    }
  }

  // ---- Cambiar de mapa ----
  irA(mapa: MapaId, desde: MapaId | 'inicio'): void {
    this.mostrarMapa(false);
    this.listo = false;
    this.guardar();
    this.stage.settle();
    this.cameras.main.fadeOut(300, 0, 0, 0);
    this.time.delayedCall(320, () => this.scene.restart({ mapa, desde }));
  }

  update(t: number, dtMs: number): void {
    const mundo = this.mundo;
    if (!this.listo || !mundo) return;
    const dt = Math.min(0.05, dtMs / 1000), k = this.keys;
    const vx = this.verMapa ? 0 : +(k.D.isDown || k.RIGHT.isDown) - +(k.A.isDown || k.LEFT.isDown), vy = this.verMapa ? 0 : +(k.S.isDown || k.DOWN.isDown) - +(k.W.isDown || k.UP.isDown);
    if (this.red) this.pasoRed();
    mundo.paso(dt, { vx, vy });
    this.sincronizar();
    for (const s of mundo.sacar()) {
      this.suceso(s);
      if (this.red && (s.tipo === 'rotulo' || s.tipo === 'destello' || s.tipo === 'mov' || s.tipo === 'ball' || s.tipo === 'ballFin' || s.tipo === 'debilitado')) this.compartir.push(s);
    }
    if (this.red) this.enviarRed(dtMs);
    this.pasoTrato(dt);
    this.luzDelDia(t);
    this.aclarar(dtMs);
    for (const l of [...mundo.todos(), ...mundo.remotos]) this.dibujar(l, this.vistaDe(l));
    this.pintarPlacas();
    this.pintarBocadillos();
    this.pintarSuelo();
    this.pintarMarca();
    this.pasoTablon();
    this.pasoVuelo();
    this.pasoTendero();
    this.pasoBayero();
    this.pintarHogar();
    this.dibujarBarras();
    this.stage.actualizar(t, dtMs);
  }
}

export { CASILLAS };
