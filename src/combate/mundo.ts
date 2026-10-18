// Simulación del modo aventura (docs/GDD-combate.md), sin Phaser: los Pokémon del mapa (tú, los salvajes y tus
// vecinos del pueblo), sus choques y su IA, los movimientos, las capturas, el clima, el alfa y la piedra de hogar.
// La escena (scenes/Aventura.ts) la avanza con `paso(dt, entrada)` y dibuja su estado; lo que hay que animar o avisar
// le llega como sucesos (`sacar()`). Está aparte para que, en multijugador, la pueda llevar el anfitrión.
// El tiempo es el suyo (`ahora`, s): solo corre en `paso`, así que con la escena en pausa no pasa nada.
import { ROW_FROM_ANGLE } from '../config';
import { rotulo } from '../entrada/asignacion';
import type { Alfa, MapaAventura, MapaId, Punto, Ronda } from '../data/bosque';
import { FORMAS, LINEAS } from '../data/pokedex';
import { PROB_CLIMA, RAREZA_AVISO, RAREZA_ULTRA, lineasClima, momentoDe, puedeSalir, rarezaDe, tirarEspecie, tirarSecreto, type Cuando } from '../data/aparicion';
import { ESPECIES } from '../data/especies';
import { BALL, ITEMS } from '../data/items';
import { alturaDe, getMove, tiposDe, type Boosts, type MoveData, type Stat6, type TypeName } from '../data/movimientos';
import type { LabelTone } from '../fx/stage';
import { dentroDe } from '../util';
import { HOGAR_CARGA, HOGAR_CD, HUECOS_OBJ, PROB_SHINY, Partida, movsHasta, tirarSexo, type Atajo, type Aviso, type Miembro, type Sexo } from './partida';
import type { Mision } from './misiones';
import { Rejilla } from './navegacion';
import { MEJOR, PROB_PIEDRA_ALFA, PROB_PIEDRA_SUELO, nivelZona, sortear, sortearPiedra, tierDe } from './botin';
import { EQUIPABLES, POTENCIA_TIPO, RECARGA_BANDA, baseDe, escalaDe, escalar, sortearEquipable } from './objetos';
import { rng } from '../util';
import { IDS_NATURALEZA, NATURALEZAS, casoDe, tablaDe, type Naturaleza, type Reaccion } from './naturalezas';
import {
  CLIMA_DE, CLIMA_TRAMO, COLOR_ESTADO, CORTO_ESTADO, DANO_ESTADO, DANO_SEMILLA, DURA_BOOST, DURA_CLIMA, DURA_ESTADO, DURA_SEMILLA, FIN_CLIMA, GCD, NOMBRE_CLIMA, RITMO, NOMBRE_ESTADO, NOMBRE_STAT,
  ALCANCE_CUERPO, ATRAS_LARGO, ATRAS_VEL, CARGA_ALCANCE, CARGA_VEL, EMBESTIDA_LARGO, EMBESTIDA_VEL, movilidad, type Movilidad,
  ALCANCE_DISTANCIA, ALCANCE_PROYECTIL, RADIO_PROYECTIL, VEL_PROYECTIL, dirigido, ALREDEDOR_RADIO, AREA_VARIOS, CONO_ANGULO, CONO_LARGO, ZONA_RADIO, formaArea, type FormaArea,
  ESCUDO, TURNO, VEL_PARALIZADO, alcance, celeridad, curaClima, danaClima, enfriamiento, expDeNivel, expPor, formaDe, formaM, golpe, necesitaObjetivo, perfil, probCaptura, statsDe,
  velAndar, type Clima, type Golpe, type Perfil, type Stats,
} from './reglas';
import type { AnimId } from './sprites';
import { HUEVO_DERROTAS, MONEDA as MONEDA_GACHA, MONEDAS_ALFA, PROB_MONEDA_EXTRA, abrirHuevo, tirar as tirarCapsula, type Clase, type Premio } from './gacha';

const VEL = 84;                    // px/s del jugador
const ANCHO = 9;                   // medio ancho del cuerpo contra paredes
const ANCHO_NPC = 6;               // el de los demás Pokémon (salvajes y vecinos)
const CUBO = 64;                   // px de lado de los cubos de colisión
const TIRO = 150;                  // hasta dónde llega una Poké Ball
const SIN_CURA_BALL = 30;          // s que un salvaje que se ha escapado de una Ball sigue alterado: no recupera vida
const MUNECO_VIDA = 8;             // vida del muñeco de prácticas del pueblo, en veces la de su especie
export const DEX_MUNECO = 'munieco';   // su "dex": la textura del muñeco de madera (assets/game/pixel/objetos/munieco.png), no una hoja PMD
const RESPAWN = 40;                // s hasta que vuelve a salir un salvaje en su sitio
// Al cambiar la hora o el clima (data/aparicion.ts): en cuántos s se cambian los salvajes, a qué distancia de ti como
// poco (px).
const CAMBIO_SALVAJES = 25;
const LEJOS_CAMBIO = 300;
const HALLAZGOS = 5;               // objetos tirados por el suelo en cada zona (no en el pueblo)
const HALLAZGO_VUELVE = 10 * 60e3;  // ms (reales) hasta que vuelve a haber algo donde cogiste uno
const HALLAZGO_COGER = 12;          // px: se coge al pisarlo
// Rayos de la tormenta (zonas con `rayos`, la Llanura Tormenta): mientras llueve, cada 3-7 s un círculo avisa en el
// suelo cerca de ti (o de un salvaje cercano) y RAYO_AVISO s después cae el rayo: quita RAYO_DANO de la vida máxima a
// quien esté dentro de RAYO_RADIO (elipse aplastada como el suelo). A los de tipo Eléctrico y Tierra no les hace nada.
const RAYO_CADA: [number, number] = [3, 7];
export const RAYO_AVISO = 1.3, RAYO_RADIO = 30;
const RAYO_DANO = 0.2;
const CORREA = 330;                // px: un salvaje que te persigue más lejos de su sitio se vuelve (y se cura)
export const CURA_FUERA = 0.05;    // fracción de vida por segundo fuera de combate (6 s sin pegar ni recibir)
// Alfas (docs/GDD-mundo.md §2): más grandes, con aura, el triple de vida y un golpe anunciado en el suelo.
export const ALFA_ESCALA = 1.4;
// Tamaño de cada especie: su altura oficial comprimida (raíz 0,4 respecto a 0,7 m, entre ×0,75 y ×1,8) y corregida a
// medias por lo que ya mide su sprite PMD (los de los grandes vienen algo más altos; ALTO_REF = la mediana, 23 px).
const ALTO_REF = 23;
export function escalaEspecie(forma: string, altoSprite: number): number {
  const f = Math.min(1.8, Math.max(0.75, (alturaDe(forma) / 0.7) ** 0.4));
  return f * Math.sqrt(ALTO_REF / Math.max(8, altoSprite));
}
const ALTO_MAX = 90;               // px: tope del alto del cuerpo (barra de vida, placa, alcance)
const ALFA_VIDA = 3;
const ALFA_RESPAWN = 5 * 60;       // s
const ALFA_CADA = 8;               // s entre golpes anunciados
const ALFA_AVISO = 1.8;            // s que tarda en llenarse el círculo
export const ALFA_RADIO = 38;      // px (medio ancho del círculo; en el suelo se ve achatado)
const ALFA_DANO = 0.35;            // fracción de tu vida si te pilla dentro
// Poké Ball: vuela VUELO_BALL s; dentro, se mueve tres veces y a los MENEOS_BALL s se sabe si se queda.
export const VUELO_BALL = 0.42;
const MENEOS_BALL = 0.25 + 3 * 0.32 + 2 * 0.26;
const IMPACTO_MAX = 2.5;
const ACECHO = 70;                 // px: a esta distancia, el que acecha te ve y ataca
const ESPANTO = 90;                // px: a esta distancia, el que se espanta te ve y huye
const LLAMADA = 120;               // px: los salvajes que oyen al que llama a los suyos           // s: si la animación de un movimiento no llega al golpe, se aplica igual

// Bufos y debufos (los iconos del HUD y de las placas): estados y cambios de stats, con lo que les queda.
export interface Aura { txt: string; color: number; frac: number; nombre: string }
const CORTO_STAT: Record<Stat6, string> = { atk: 'At', def: 'Df', spa: 'AE', spd: 'DE', spe: 'Ve', accuracy: 'Pr', evasion: 'Ev' };

// Lo que choca: la huella de un elemento del escenario (rectángulo, rombo de un estanque o polígono del suelo).
export interface Bloque { x: number; y: number; w: number; h: number; rombo?: boolean; poli?: [number, number][] }
// Lo que el mundo necesita saber de los sprites (lo mide quien los carga): alto del cuerpo y duración de cada
// animación y de su golpe (HitFrame), en s; null si la especie no la tiene.
export interface Anatomia {
  alto(dex: string): number;
  anim(dex: string, a: AnimId): { dura: number; golpe: number } | null;
}
export interface Entrada { vx: number; vy: number; apunta?: Punto; mando?: boolean }   // hacia dónde andas (-1…1 por eje), dónde está el ratón (mundo) y si se juega con mando (para los avisos)

// Un movimiento que se está lanzando (barra de lanzamiento) o canalizando (golpes por tics), docs/GDD-combate.md §3.2.
export interface Lanza { id: string; obj: Luchador | null; t0: number; t1: number; canal: boolean; tics: number; hechos: number; punto?: Punto }   // punto: centro o dirección de un área
const INTERRUMPIDO = 4 * RITMO;    // s que el movimiento cortado tarda en volver
const RETO = 30;                   // s que espera un reto a duelo antes de caducar
const CUENTA = 3;                  // s de cuenta atrás al aceptar un duelo
const DUELO_RADIO = 300;           // px desde donde empezó el duelo: más lejos, lo abandonas

// Lo que un movimiento cambia en alguien además del daño: stats o un estado.
interface Efecto { quien: Luchador; boosts?: Boosts; estado?: string; semilla?: boolean }

export interface Luchador {
  uid: string; rol: 'jugador' | 'salvaje' | 'vecino' | 'remoto';   // remoto: otro jugador (multijugador)
  linea: string; nivel: number; miembro?: Miembro; ronda?: Ronda;
  dex: string; nombre: string; tipos: TypeName[];       // dex: el de su sprite (con `s` si es shiny)
  usuario?: string;                                    // remoto: el nombre de usuario de ese jugador
  stats: Stats; ps: number; boosts: Boosts; boostHasta: Partial<Record<Stat6, number>>;
  estado: string | null; estadoHasta: number; ticEstado: number; toxN: number;
  semilla?: { de: string; hasta: number; tic: number };   // Drenadoras: quién la sembró (le cura), hasta cuándo y el próximo turno
  x: number; y: number; dir: number; anda: boolean; alto: number;
  movs: string[]; cd: Record<string, number>; gcd: number;
  cdDura: Record<string, number>; gcdDura: number;   // lo que duró cada enfriamiento al ponerse (con la celeridad de entonces)
  lanza: Lanza | null;
  anim: AnimId | null; animHasta: number; animN: number; quietoHasta: number;   // animN: cuenta las que se ponen
  natu: string; tabla: Naturaleza; aguante: number;   // naturaleza (combate/naturalezas.ts), su tabla y golpes encajados (Aguanta)
  modo: 'pasear' | 'huir' | 'pelear' | 'volver'; casa: Punto; meta: Punto | null; espera: number;
  huirHasta: number; ultimoCombate: number; rival: Luchador | null;
  sinCuraHasta: number;                // hasta cuándo no recupera vida fuera de combate (tras escaparse de una Ball)
  muerto: boolean; enBall: boolean;
  ruta: Punto[] | null; rutaA: Punto | null; rutaT: number; atasco: number;   // camino que sigue (navegacion.ts), hacia dónde y cuándo se calculó
  forma?: string;                      // forma fija (el alfa); si no, la de su nivel
  alfa?: boolean; escala: number; golpeAlfa: number;
  sexo: Sexo;                          // ♂/♀/sin sexo: el de tu equipo lo guarda; un salvaje lo tira al salir
  shiny?: boolean;
  remoto?: { x: number; y: number; t: number; animN: number };   // a dónde va (lo último que ha llegado de la red) y cuándo llegó
  golpeadores?: Set<string>;           // uids de los jugadores (tú o remotos) que le han hecho daño: se reparten la experiencia
  ticObjeto?: number; bandaHasta?: number;   // Restos: próximo turno; Banda Focus: hasta cuándo se recarga
  escudo?: { id: string; hasta: number; bloqueo: boolean };
  dash?: Dash;                         // carga, embestida o salto atrás en curso (§3.8)   // Protección y familia (§3.5): ventana y si ya bloqueó algo
  leyo?: Lanza;                        // salvaje: el lanzamiento de su rival al que ya decidió si responder con Protección
  munieco?: boolean; danoTotal?: number;   // el muñeco de prácticas del pueblo (hacerMunieco) y el daño que lleva encajado desde que estaba entero
}

// Lo que manda cada jugador por la red (scenes/Aventura.ts) para que los demás lo vean.
export interface EstadoRemoto {
  uid: string; mapa: MapaId; x: number; y: number; dir: number; anda: boolean; dex: string; nombre: string; nivel: number;
  usuario?: string;                                            // su nombre de usuario (el que eligió al crear la partida)
  anim?: AnimId | null; animN?: number; animResta?: number;   // la animación de acción (golpe, disparo…): cuenta y lo que le queda (s)
  estado?: string | null;                                      // estado alterado (para su tinte y su ráfaga)
  semilla?: number;                                            // la de tu partida (la sala usa la del primero que entró)
  vida?: number;                                               // fracción de PS
  enMapa?: number;                                             // s que lleva en este mapa (el que más lleva es su dueño)
}

// Un desplazamiento de un movimiento (§3.8): carga hasta `obj`, embestida en (dx, dy) o salto atrás. `resta`: px que
// le quedan; `hasta`: si no ha llegado para entonces, se acaba igual.
export interface Dash { tipo: Movilidad; id: string; obj: Luchador | null; dx: number; dy: number; resta: number; vel: number; hasta: number }

// Un movimiento dirigido en vuelo (§3.7): sale de `de` hacia (dx, dy) y da al primer enemigo que toca. `h`: a qué altura
// del suelo va (la del pecho de quien lo lanzó), solo para dibujarlo.
export interface Proyectil { id: string; de: Luchador; x: number; y: number; dx: number; dy: number; resta: number; h: number }

// Los demás que toca un área (el primero va en el propio suceso `mov`).
export interface MasArea { n: number; a: string; golpe: Golpe; efectos: { uid: string; boosts?: Boosts; estado?: string; semilla?: boolean }[] }

// El uid de red de otro jugador a partir del de su remoto.
const redDe = (uid: string) => uid.slice('remoto-'.length);

// ---- Multijugador cooperativo: manda el dueño del mapa ----
// En cada mapa, uno de los jugadores que están en él (el primero que entró en la sala) lleva a los salvajes: su IA, su
// vida, sus muertes y sus reapariciones. Los demás los tienen en modo espejo (`espejo`): los ven tal como llegan en las
// fotos (`foto`/`aplicarFoto`) y lo que les hacen se lo mandan al dueño (`Salida`). Cada jugador manda en su propio
// Pokémon: el daño que recibe se lo aplica él (`recibirGolpe`). La escena lleva los mensajes (src/combate/red.ts).
export type Salida =
  | { tipo: 'golpe'; de: string; a: string; mov: string; golpe: Golpe; efectos: { boosts?: Boosts; estado?: string; semilla?: boolean }[] }
  | { tipo: 'ball'; a: string; dentro: boolean; ok?: boolean }
  | { tipo: 'muere'; a: string; para: string[]; linea: string; nivel: number; alfa: boolean; nombre: string }
  | { tipo: 'clima'; clima: Clima }
  // Duelo entre dos jugadores (`para`: el uid de red del otro). `gana`: uid de red del ganador; `abandona`: se ha ido.
  | { tipo: 'duelo'; para: string; fase: 'reto' | 'acepta' | 'rechaza' | 'fin'; gana?: string; abandona?: boolean };
export interface FotoSalvaje {
  u: string; li: string; f?: string; n: number; sh?: boolean; al?: boolean; r: number; c: Punto;   // r: su ronda en el mapa (−1: ninguna)
  x: number; y: number; d: number; an: boolean; ps: number; hp: number; e: string | null; m: boolean; b: boolean;
  te: string; tr?: [Reaccion, Reaccion, Reaccion]; mo: Luchador['modo']; ri: string | null; a: AnimId | null; aN: number; aR: number;
  ln?: [string, number, number, 0 | 1];   // lo que lanza: movimiento, s que le quedan, duración y si es canalizado
}
export interface Foto {
  s: FotoSalvaje[];
  clima: { tipo: Clima; resta: number; b?: 1 } | null;
  marca: { id: number; x: number; y: number; dura: number; resta: number; de: string } | null;
}


// Lo que la escena tiene que enseñar (rótulos, animaciones de movimientos, la Ball…) o hacer (cambiar de mapa).
export type Suceso =
  | { tipo: 'aviso'; txt: string }
  | { tipo: 'rotulo'; uid: string; txt: string; tono: LabelTone; retraso?: number; azar?: boolean }
  | { tipo: 'destello'; uid: string; ms: number }
  | { tipo: 'temblor' }
  | { tipo: 'mov'; n: number; de: string; a: string; mov: string; golpe: Golpe; efectos: { uid: string; boosts?: Boosts; estado?: string; semilla?: boolean }[]; mas?: MasArea[]; desde?: Punto }   // desde: de dónde sale la animación (un proyectil, donde dio)
  | { tipo: 'area'; de: string; mov: string; forma: FormaArea; x: number; y: number; ang: number }   // dónde pega un área (el destello en el suelo)
  | { tipo: 'ball'; n: number; item: string; a: string; x0: number; y0: number; x1: number; y1: number }
  | { tipo: 'ballFin'; n: number; ok: boolean | null }
  | { tipo: 'debilitado'; uid: string }
  | { tipo: 'clima'; clima: Clima | null }
  | { tipo: 'evoluciona'; antes: ReturnType<typeof formaDe>; aprende: string[] }
  | { tipo: 'ir'; mapa: MapaId; desde: MapaId | 'inicio' }
  | { tipo: 'drena'; de: string; a: string }
  | { tipo: 'rayo'; x: number; y: number };   // cae un rayo de la tormenta (pasoRayos)   // Drenadoras: la vida va de `de` (el sembrado) a `a` (quien sembró)

export interface OpcionesMundo {
  mapa: MapaAventura; partida: Partida; desde: MapaId | 'inicio';
  bloques: Bloque[]; agua: (x: number, y: number) => boolean; anatomia: Anatomia;
  probShiny: number; rnd?: () => number;
  natu?: string;   // fuerza la naturaleza de todos los salvajes (para probar: ?natu=firme)
}

const idSprite = (dex: string, shiny?: boolean) => shiny ? `${dex}s` : dex;   // como sprites.ts

export class Mundo {
  readonly mapa: MapaAventura;
  readonly partida: Partida;
  probShiny: number;
  jugador!: Luchador;
  salvajes: Luchador[] = [];
  vecinos: Luchador[] = [];
  // Los demás jugadores que están en este mapa: solo se dibujan (sin IA, no se les ataca ni chocan); `todos()` no los incluye.
  remotos: Luchador[] = [];
  objetivo: Luchador | null = null;
  apunta: Punto | null = null;            // dónde está el ratón (para las áreas en zona y en cono)
  proyectiles: Proyectil[] = [];          // movimientos dirigidos en vuelo (los dibuja la escena)
  conMando = false;                       // los avisos nombran los botones del mando en vez de las teclas
  private k(tecla: string): string { return rotulo(tecla, this.conMando); }
  ahora = 0;
  rayos: { x: number; y: number; cae: number }[] = [];   // rayos avisados que aún no han caído (la escena pinta el círculo)
  cambiando = false;                   // te vas del mapa (salida, debilitado o piedra de hogar)
  // Clima del mapa (Danza Lluvia, Día Soleado…): hasta cuándo dura; daña por turnos a quien no aguanta la arena o el granizo.
  // `base`: es el de la zona (MapaAventura.clima), que no daña; un movimiento de clima lo tapa mientras dura.
  clima: { tipo: Clima; hasta: number; base?: boolean } | null = null;
  // Golpe anunciado de un alfa: el círculo del suelo que se llena; al llenarse, daña a quien siga dentro.
  marca: { x: number; y: number; t0: number; t1: number; de: Luchador; id?: number } | null = null;
  // Piedra de hogar canalizándose (s de juego): la barra de lanzamiento la pinta el HUD.
  hogar: { t0: number; t1: number } | null = null;
  private readonly rnd: () => number;
  private readonly natuForzada?: string;
  private readonly anatomia: Anatomia;
  private readonly agua: (x: number, y: number) => boolean;
  private cubos = new Map<number, Bloque[]>();   // bloques por cubo de CUBO px, para no recorrerlos todos
  private nav: Rejilla;
  private uid = 0;
  private n = 0;                       // numera movimientos y Balls en vuelo
  private lanzando = false;
  private climaTic = 0;
  private claveAparicion = '';        // hora y clima con los que se tiró a los salvajes (pasoAparicion)
  private climaSorteo = 0;             // cuándo se vuelve a sortear el clima de la zona
  private rayoSig = 0;                 // cuándo se avisa del siguiente rayo (pasoRayos)
  private sucesos: Suceso[] = [];
  private relojes: { t: number; fn: () => void }[] = [];
  private pendientes = new Map<number, { l: Luchador; id: string; t: Luchador; r: Golpe; ef: Efecto[]; hasta: number }>();
  // Multijugador: tu uid en la red, si los salvajes los lleva otro (espejo) y lo que hay que mandarle.
  miRed = '';
  espejo = false;
  // Duelo con otro jugador (`con`: uid de su remoto): le has retado y esperas, cuenta atrás o luchando (`c`: dónde empezó).
  duelo: { con: string; fase: 'reto' | 'cuenta' | 'lucha'; hasta: number; c: Punto } | null = null;
  retoDe: { de: string; hasta: number } | null = null;   // otro jugador te ha retado (uid de su remoto)
  private salidas: Salida[] = [];
  private capturadosFuera = new Map<string, number>();   // salvajes que has capturado tú: que no vuelvan con una foto vieja
  private miBall: string | null = null;                  // el salvaje que está en tu Ball (su enBall lo llevas tú)
  private marcasHechas = new Set<number>();
  // Objetos tirados por el suelo (como en los juegos): siempre en los mismos sitios de la zona (semilla de la partida);
  // lo que son va con el nivel de la zona (combate/botin.ts). Se cogen al pisarlos y vuelven a los 10 min (reales).
  hallazgos: { i: number; x: number; y: number; item: string | null }[] = [];
  private sueloSemilla = 0;
  private sueloMira = 0;               // cuándo se mira otra vez si ha vuelto algo donde ya cogiste

  constructor(o: OpcionesMundo) {
    this.mapa = o.mapa; this.partida = o.partida; this.probShiny = o.probShiny;
    this.rnd = o.rnd ?? Math.random; this.natuForzada = o.natu && NATURALEZAS[o.natu] ? o.natu : undefined; this.anatomia = o.anatomia; this.agua = o.agua;
    for (const b of o.bloques) this.meterBloque(b);
    this.nav = new Rejilla(this.mapa.W, this.mapa.H, (x, y) => this.pisable({ x, y }));
    const lleg = this.mapa.llegada[o.desde] ?? this.mapa.llegada.inicio!, act = this.partida.activo;
    this.jugador = this.crearLuchador('jugador', act.linea, act.nivel, lleg.x, lleg.y, act);
    this.jugador.ps = Math.max(1, Math.round(this.jugador.stats.hp * act.ps));
    this.jugador.dir = lleg.dir;
    // El mapa trae las especies de siempre: se tira según la hora que es (el clima llega en el primer paso).
    const cuando = this.cuando();
    for (const r of this.mapa.salvajes) if (!r.fija) r.linea = this.tirarRonda(r, cuando);
    this.claveAparicion = `${cuando.momento}|`;
    for (const r of this.mapa.salvajes) this.salvajes.push(this.crearSalvaje(r));
    if (this.mapa.id === 'pueblo') this.crearVecinos();
    this.ponerAlfa();
    this.ponerHallazgos();
  }

  // ---- Objetos del suelo ----
  private ponerHallazgos(): void {
    const rondas = this.mapa.salvajes.filter(r => !r.munieco);   // junto al muñeco del pueblo no hay nada que encontrar
    if (!rondas.length) return;
    const semilla = this.partida.estado.semilla ^ [...this.mapa.id].reduce((h, c) => Math.imul(h, 31) + c.charCodeAt(0) | 0, 7);
    this.sueloSemilla = semilla;
    const r = rng(semilla), puntos: Punto[] = [], lleg = Object.values(this.mapa.llegada).filter(Boolean) as Punto[];
    // Cerca de donde rondan los salvajes (así se puede llegar), lejos de las entradas y unos de otros.
    for (let k = 0; k < 400 && puntos.length < HALLAZGOS; k++) {
      const s = rondas[Math.floor(r() * rondas.length)], a = r() * Math.PI * 2, d = 25 + r() * 50;
      const q = { x: Math.round(s.x + Math.cos(a) * d), y: Math.round(s.y + Math.sin(a) * d * 0.8) };
      if (!this.pisable(q) || this.agua(q.x, q.y) || lleg.some(l => Math.hypot(l.x - q.x, l.y - q.y) < 90) || puntos.some(o => Math.hypot(o.x - q.x, o.y - q.y) < 140)) continue;
      puntos.push(q);
    }
    this.hallazgos = puntos.map((q, i) => ({ i, ...q, item: null }));
    for (const h of this.hallazgos) this.reponerHallazgo(h);
  }
  private reponerHallazgo(h: Mundo['hallazgos'][number]): void {
    const g = this.partida.estado.hallados?.[`${this.mapa.id}:${h.i}`];
    if (g && Date.now() - g.t < HALLAZGO_VUELVE) return;
    const r = rng(this.sueloSemilla + h.i * 7919 + (g?.n ?? 0) * 104729);
    h.item = r() < PROB_PIEDRA_SUELO ? sortearPiedra(r) : sortear(nivelZona(this.mapa), r);
  }
  private pasoHallazgos(): void {
    const p = this.jugador;
    if (p.muerto || this.cambiando) return;
    const mira = this.ahora >= this.sueloMira;
    if (mira) this.sueloMira = this.ahora + 5;
    for (const h of this.hallazgos) {
      if (!h.item) { if (mira) this.reponerHallazgo(h); continue; }
      if (Math.hypot(h.x - p.x, h.y - p.y) > HALLAZGO_COGER) continue;
      const clave = `${this.mapa.id}:${h.i}`, g = (this.partida.estado.hallados ??= {});
      this.partida.dar(h.item);
      this.rotulo(p, ITEMS[h.item].nombre, 'strong', 0);
      this.aviso(`Has encontrado: ${ITEMS[h.item].nombre}`);
      g[clave] = { t: Date.now(), n: (g[clave]?.n ?? 0) + 1 };
      h.item = null;
      this.guardar();
    }
  }

  todos(): Luchador[] { return [this.jugador, ...this.salvajes, ...this.vecinos]; }
  luchador(uid: string): Luchador | undefined { return this.todos().find(l => l.uid === uid) ?? this.remotos.find(l => l.uid === uid); }
  // Los sucesos desde la última vez (y se vacían).
  sacar(): Suceso[] { return this.sucesos.splice(0); }
  private emitir(s: Suceso): void { this.sucesos.push(s); }
  aviso(txt: string): void { this.emitir({ tipo: 'aviso', txt }); }
  private rotulo(l: Luchador, txt: string, tono: LabelTone, retraso?: number, azar?: boolean): void { this.emitir({ tipo: 'rotulo', uid: l.uid, txt, tono, retraso, azar }); }
  private despues(s: number, fn: () => void): void { this.relojes.push({ t: this.ahora + s, fn }); }

  // ---- Colisiones ----
  private meterBloque(b: Bloque): void {
    for (let j = Math.floor((b.y - b.h) / CUBO); j <= Math.floor(b.y / CUBO); j++) for (let i = Math.floor((b.x - b.w / 2) / CUBO); i <= Math.floor((b.x + b.w / 2) / CUBO); i++) {
      const k = j * 4096 + i, c = this.cubos.get(k);
      if (c) c.push(b); else this.cubos.set(k, [b]);
    }
  }
  // Bloques que la escena pone después de hacer el mundo (el punto de vuelo y su farol, que buscan sitio con
  // `pisable`): a las colisiones y a la rejilla de caminos, que se rehace.
  anadirBloques(bs: Bloque[]): void {
    for (const b of bs) this.meterBloque(b);
    this.nav = new Rejilla(this.mapa.W, this.mapa.H, (x, y) => this.pisable({ x, y }));
  }
  enBloque(x: number, y: number): boolean {
    const c = this.cubos.get(Math.floor(y / CUBO) * 4096 + Math.floor(x / CUBO));
    return !!c && c.some(b => {
      if (x < b.x - b.w / 2 || x > b.x + b.w / 2 || y < b.y - b.h || y > b.y) return false;
      if (b.poli) return dentroDe(b.poli, x, y);
      if (!b.rombo) return true;
      const u = Math.abs(x - b.x) / (b.w / 2), v = Math.abs(y - b.y + b.h / 2) / (b.h / 2);
      return Math.pow(u, 1.5) + Math.pow(v, 1.5) <= 1;
    });
  }
  // Bloquean los elementos (su huella) y el agua del suelo (el lago). `a`: medio ancho del cuerpo.
  private choca(x: number, y: number, a: number): boolean {
    return this.enBloque(x - a, y) || this.enBloque(x, y) || this.enBloque(x + a, y)
      || this.agua(x - a, y) || this.agua(x + a, y) || this.agua(x, y - 3);
  }
  private fuera(x: number, y: number): boolean { return x < 10 || y < 14 || x > this.mapa.W - 10 || y > this.mapa.H - 2; }
  private bloqueado(l: Luchador, x: number, y: number): boolean {
    const a = l.rol === 'jugador' ? ANCHO : ANCHO_NPC;
    if (this.fuera(x, y)) return true;
    return this.choca(x, y, a) && !this.choca(l.x, l.y, a);   // si ya está dentro (aparece encima de algo), puede salir
  }
  private mover(l: Luchador, vx: number, vy: number, vel: number, dt: number): boolean {
    const len = Math.hypot(vx, vy);
    if (len < 1e-3) return false;
    const ux = vx / len, uy = vy / len, nx = l.x + ux * vel * dt, ny = l.y + uy * vel * dt;
    let movido = false;
    if (!this.bloqueado(l, nx, l.y)) { l.x = nx; movido = true; }
    if (!this.bloqueado(l, l.x, ny)) { l.y = ny; movido = true; }
    // Contra una pared inclinada (el rombo de un edificio) o una esquina no pasa ningún eje: probar a desviarse un
    // poco, solo si el paso entero queda libre (así, de frente contra una pared recta no se resbala).
    if (!movido) for (const g of [0.6, -0.6, 1.1, -1.1]) {
      const c = Math.cos(g), s = Math.sin(g), qx = l.x + (ux * c - uy * s) * vel * 0.8 * dt, qy = l.y + (ux * s + uy * c) * vel * 0.8 * dt;
      if (!this.bloqueado(l, qx, qy)) { l.x = qx; l.y = qy; movido = true; break; }
    }
    l.dir = ROW_FROM_ANGLE[(Math.round(Math.atan2(vy, vx) / (Math.PI / 4)) + 8) % 8];
    return movido;
  }
  // Ir hacia (x, y) rodeando lo que haya en medio: en línea recta si se ve; si no, por el camino de la rejilla
  // (se recalcula cuando la meta se mueve o cada poco). Devuelve si se ha movido.
  private caminarA(l: Luchador, x: number, y: number, vel: number, dt: number): boolean {
    const meta = { x, y };
    if (this.nav.directo(l, meta)) { l.ruta = null; return this.mover(l, x - l.x, y - l.y, vel, dt); }
    if (!l.ruta || !l.rutaA || Math.hypot(l.rutaA.x - x, l.rutaA.y - y) > 16 || this.ahora - l.rutaT > 1.5) {
      l.ruta = this.nav.ruta(l, meta); l.rutaA = meta; l.rutaT = this.ahora;
    }
    const r = l.ruta;
    while (r && r.length > 1 && (Math.hypot(r[0].x - l.x, r[0].y - l.y) < 4 || this.nav.directo(l, r[1]))) r.shift();
    if (!r?.length) { l.ruta = null; return false; }
    const ok = this.mover(l, r[0].x - l.x, r[0].y - l.y, vel, dt);
    if (Math.hypot(r[0].x - l.x, r[0].y - l.y) < 3) r.shift();
    if (!ok) l.ruta = null;   // algo ha cambiado: recalcular la próxima vez
    return ok;
  }
  pisable(q: Punto): boolean { return !this.fuera(q.x, q.y) && !this.choca(q.x, q.y, ANCHO_NPC); }
  // Un punto libre al azar a menos de `r` de c y que se vea en línea recta desde `desde`, o null.
  private puntoLibre(c: Punto, r: number, desde: Punto): Punto | null {
    for (let k = 0; k < 8; k++) {
      const a = this.rnd() * Math.PI * 2, d = 20 + this.rnd() * Math.max(0, r - 20), q = { x: c.x + Math.cos(a) * d, y: c.y + Math.sin(a) * d * 0.7 };
      if (this.pisable(q) && this.nav.directo(desde, q)) return q;
    }
    return null;
  }

  // ---- Luchadores ----
  private crearLuchador(rol: Luchador['rol'], linea: string, nivel: number, x: number, y: number, miembro?: Miembro, forma?: string, shiny = false, uid?: string): Luchador {
    // Un remoto o un espejo (uid que llega de fuera) no gasta la semilla ni numera: así la simulación sale igual haya quien haya conectado.
    const fuera = rol === 'remoto' || uid !== undefined, rnd = fuera ? Math.random : this.rnd;
    const f = forma ? FORMAS[forma] : formaDe(linea, nivel, miembro?.forma), sh = miembro?.shiny ?? shiny, dex = idSprite(f.dex, sh);
    const stats = statsDe(f.base, nivel), as = this.anatomia.alto(dex), escala = escalaEspecie(f.id, as);
    return {
      uid: fuera ? uid ?? '' : `${rol}-${++this.uid}`, rol, linea, nivel, miembro, dex, nombre: f.nombre, tipos: tiposDe(f.id),
      stats, ps: stats.hp, boosts: {}, boostHasta: {}, estado: null, estadoHasta: 0, ticEstado: 0, toxN: 0,
      x, y, dir: 0, anda: false, alto: Math.min(ALTO_MAX, as * escala),
      movs: miembro ? miembro.movs : movsHasta(f.id, nivel), cd: {}, gcd: 0, cdDura: {}, gcdDura: GCD, lanza: null, anim: null, animHasta: 0, animN: 0, quietoHasta: 0,
      natu: 'fuerte', tabla: NATURALEZAS.fuerte, aguante: -99, modo: 'pasear', casa: { x, y }, meta: null, espera: rnd() * 2, huirHasta: 0, ultimoCombate: -99, rival: null, sinCuraHasta: 0,
      muerto: false, enBall: false, ruta: null, rutaA: null, rutaT: -99, atasco: 0, forma, escala, golpeAlfa: 0, shiny: sh,
      sexo: miembro ? miembro.sexo ?? null : tirarSexo(f.id, rnd),
    };
  }
  private formaL(l: Luchador) { return l.forma ? FORMAS[l.forma] : formaDe(l.linea, l.nivel, l.miembro?.forma); }
  private crearSalvaje(r: Ronda): Luchador {
    const l = this.crearLuchador('salvaje', r.linea, r.nivel, r.x, r.y, undefined, undefined, this.rnd() < this.partida.probShiny(r.linea, this.probShiny));
    l.ronda = r;
    l.natu = this.natuForzada ?? IDS_NATURALEZA[Math.floor(this.rnd() * IDS_NATURALEZA.length)];
    l.tabla = tablaDe(l.natu, this.rnd);
    if (r.munieco) this.hacerMunieco(l);
    // Uno de los rarísimos de la tabla de la zona (data/aparicion.ts): se avisa, que es todo un acontecimiento.
    const rz = r.fija ? -1 : r.secreto === r.linea ? RAREZA_ULTRA : rarezaDe(this.mapa.id, r.linea, this.cuando().momento);
    if (rz >= RAREZA_AVISO) this.aviso(rz === RAREZA_AVISO ? `Un ${l.nombre} muy raro ronda por aquí`
      : rz === RAREZA_ULTRA ? `¡¡Un ${l.nombre} ultra raro ronda por aquí!!` : `¡Un ${l.nombre} rarísimo ronda por aquí!`);
    return l;
  }
  // El muñeco de prácticas (pueblo): el de madera de un MMO (pixel art, DEX_MUNECO; su `linea` solo pone los stats
  // base). De tu nivel, sin tipo (todo le hace daño neutro), con la misma defensa física que especial (la media de las
  // de su especie) y mucha vida; no se mueve, no pega, no huye, no se captura y al llegar a 0 se pone entero otra vez.
  // Lleva la cuenta del daño encajado (`danoTotal`, la placa del HUD la enseña) y la borra cuando se cura entero fuera
  // de combate. Sin hojas de animación: al golpe solo se sacude (el fx de la escena).
  private hacerMunieco(l: Luchador): void {
    const nivel = this.partida.activo.nivel, f = this.formaL(l), st = statsDe(f.base, nivel), def = Math.round((st.def + st.spd) / 2);
    l.munieco = true; l.danoTotal = 0; l.nombre = 'Muñeco de prácticas'; l.nivel = nivel; l.tipos = []; l.movs = []; l.sexo = null;
    l.dex = DEX_MUNECO; l.escala = 1; l.alto = this.anatomia.alto(DEX_MUNECO);
    l.stats = { ...st, def, spd: def, hp: st.hp * MUNECO_VIDA }; l.ps = l.stats.hp;
    l.tabla = { nombre: 'Muñeco', igual: 'quieto', fuerte: 'quieto', debil: 'quieto' };
  }
  // El alfa de la zona: la forma fija, ×1,4, con aura y el triple de vida. Siempre peleón. Si cayó hace menos de
  // 5 minutos (`estado.alfas`, en tiempo real), sale cuando toque.
  private ponerAlfa(): void {
    const a = this.mapa.alfa;
    if (!a) return;
    const cayo = this.partida.estado.alfas?.[this.mapa.id] ?? 0, falta = ALFA_RESPAWN * 1000 - (Date.now() - cayo);
    if (falta <= 0) { this.salvajes.push(this.crearAlfa(a)); return; }
    this.despues(falta / 1000, () => { this.salvajes.push(this.crearAlfa(a)); this.aviso(`Ha vuelto el ${FORMAS[a.forma].nombre} alfa`); });
  }
  private crearAlfa(a: Alfa): Luchador {
    const l = this.crearLuchador('salvaje', a.linea, a.nivel, a.x, a.y, undefined, a.forma, this.rnd() < this.partida.probShiny(a.linea, this.probShiny));
    this.hacerAlfa(l);
    l.golpeAlfa = this.ahora + 3;
    return l;
  }
  private hacerAlfa(l: Luchador): void {
    l.alfa = true; l.escala *= ALFA_ESCALA; l.tabla = { nombre: l.tabla.nombre, igual: 'pelea', fuerte: 'pelea', debil: 'pelea' }; l.nombre += ' alfa';
    l.alto = Math.min(ALTO_MAX * ALFA_ESCALA, l.alto * ALFA_ESCALA);
    l.stats = { ...l.stats, hp: l.stats.hp * ALFA_VIDA }; l.ps = l.stats.hp;
  }
  // Golpe anunciado del alfa: se para, se carga y marca en el suelo dónde estás; el círculo se llena en ALFA_AVISO s.
  private golpeAlfa(l: Luchador, r: Luchador): boolean {
    if (this.marca || l.golpeAlfa > this.ahora || (r.rol !== 'jugador' && r.rol !== 'remoto') || Math.hypot(r.x - l.x, r.y - l.y) > 190) return false;
    this.marca = { x: r.x, y: r.y, t0: this.ahora, t1: this.ahora + ALFA_AVISO, de: l, id: ++this.n };
    l.golpeAlfa = this.ahora + ALFA_CADA + this.rnd() * 3;
    l.quietoHasta = this.ahora + ALFA_AVISO + 0.3; l.meta = null;
    this.mirarA(l, r);
    this.reproducir(l, 'Charge', ALFA_AVISO);
    return true;
  }
  private pasoMarca(): void {
    const mk = this.marca;
    if (!mk) return;
    const l = mk.de, p = this.jugador;
    if (l.muerto || (!this.espejo && l.modo !== 'pelear')) { this.marca = null; return; }
    if (this.ahora < mk.t1) return;
    this.marca = null;
    if (mk.id) this.marcasHechas.add(mk.id);
    // Cada jugador mira si le pilla a él (con lo que ve en su pantalla); el alfa y su golpe los anima el dueño.
    if (!this.espejo) {
      this.mirarA(l, mk);
      this.reproducir(l, 'Attack');
      this.emitir({ tipo: 'destello', uid: l.uid, ms: 150 });
    }
    this.emitir({ tipo: 'temblor' });
    const dentro = ((p.x - mk.x) / ALFA_RADIO) ** 2 + ((p.y - mk.y) / (ALFA_RADIO * 0.65)) ** 2 < 1;
    if (dentro && !p.muerto) this.danar(p, Math.max(1, Math.round(p.stats.hp * ALFA_DANO)), l);
    else if (!p.muerto) this.rotulo(p, '¡Esquivado!', 'good');
  }

  // Tus otros Pokémon pasean por el pueblo, cerca de la plaza.
  private crearVecinos(): void {
    const otros = this.partida.estado.equipo.filter(m => m.uid !== this.partida.activo.uid);
    otros.forEach((m, i) => {
      const a = (i / Math.max(1, otros.length)) * Math.PI * 2, c = this.mapa.llegada.inicio!;
      let x = c.x + Math.cos(a) * 70, y = c.y + 40 + Math.sin(a) * 40;
      for (let k = 0; k < 30 && !this.pisable({ x, y }); k++) { x = c.x + (this.rnd() - 0.5) * 300; y = c.y + (this.rnd() - 0.2) * 200; }
      const l = this.crearLuchador('vecino', m.linea, m.nivel, x, y, m);
      this.vecinos.push(l);
    });
  }
  // Tras un comercio (combate/tradeo.ts): fuera los vecinos que ya no son tuyos y, en el pueblo, salen los nuevos.
  rehacerVecinos(): void {
    const eq = this.partida.estado.equipo;
    this.vecinos = this.vecinos.filter(l => eq.includes(l.miembro!));
    if (this.objetivo?.rol === 'vecino' && !this.vecinos.includes(this.objetivo)) this.objetivo = null;
    if (this.mapa.id !== 'pueblo') return;
    const c = this.mapa.llegada.inicio!;
    for (const m of eq) {
      if (m.uid === this.partida.activo.uid || this.vecinos.some(l => l.miembro === m)) continue;
      let x = c.x + (this.rnd() - 0.5) * 140, y = c.y + 40 + (this.rnd() - 0.5) * 80;
      for (let k = 0; k < 30 && !this.pisable({ x, y }); k++) { x = c.x + (this.rnd() - 0.5) * 300; y = c.y + (this.rnd() - 0.2) * 200; }
      this.vecinos.push(this.crearLuchador('vecino', m.linea, m.nivel, x, y, m));
    }
  }
  private quitar(l: Luchador): void {
    this.salvajes = this.salvajes.filter(q => q !== l);
    if (this.objetivo === l) this.objetivo = null;
  }

  // Pone una animación de acción (la escena la ve por `animN`); `s`: cuánto dura (si no, la animación entera).
  private reproducir(l: Luchador, a: AnimId, s?: number): void {
    const h = this.anatomia.anim(l.dex, a);
    if (!h) return;
    l.anim = a; l.animHasta = this.ahora + (s ?? h.dura); l.animN++;
  }
  private mirarA(l: Luchador, o: Punto): void {
    l.dir = ROW_FROM_ANGLE[(Math.round(Math.atan2(o.y - l.y, o.x - l.x) / (Math.PI / 4)) + 8) % 8];
  }

  // ---- Elegir objetivo ----
  bajo(x: number, y: number): Luchador | null {
    return [...this.salvajes, ...this.vecinos, ...this.remotos].filter(l => !l.muerto && !l.enBall && Math.abs(x - l.x) < Math.max(10, l.alto * 0.4) && y > l.y - l.alto - 4 && y < l.y + 6)
      .sort((a, b) => b.y - a.y)[0] ?? null;
  }
  // Tab: el salvaje o el otro jugador más cercano que no sea el actual (en orden de distancia).
  siguienteObjetivo(): void {
    const p = this.jugador, vivos = [...this.salvajes, ...this.remotos].filter(l => !l.muerto && !l.enBall && Math.hypot(l.x - p.x, l.y - p.y) < 260)
      .sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y));
    if (!vivos.length) { this.aviso('No hay nadie cerca'); return; }
    const i = this.objetivo ? vivos.indexOf(this.objetivo) : -1;
    this.objetivo = vivos[(i + 1) % vivos.length];
  }

  // F / espacio (lejos del tablón): junto a uno de tus Pokémon del pueblo, convertirte en él.
  interactuar(): void {
    if (this.jugador.muerto) return;
    const p = this.jugador, v = this.vecinos.find(l => Math.hypot(l.x - p.x, l.y - p.y) < 32);
    if (v) { this.convertirse(v); return; }
    if (this.mapa.id === 'pueblo' && this.partida.estado.equipo.length > 1) this.aviso(`Acércate a uno de tus Pokémon y pulsa ${this.k('F')} para convertirte en él`);
  }
  private convertirse(v: Luchador): void {
    const p = this.jugador, yo = p.miembro!, otro = v.miembro!;
    yo.ps = p.ps / p.stats.hp;
    this.partida.estado.activo = otro.uid;
    // Intercambian el sitio: tú pasas a ser el vecino.
    const nuevo = this.crearLuchador('jugador', otro.linea, otro.nivel, v.x, v.y, otro);
    nuevo.ps = Math.max(1, Math.round(nuevo.stats.hp * otro.ps));
    const viejo = this.crearLuchador('vecino', yo.linea, yo.nivel, p.x, p.y, yo);
    this.vecinos = this.vecinos.filter(l => l !== v).concat(viejo);
    this.jugador = nuevo;
    this.objetivo = null;
    this.emitir({ tipo: 'destello', uid: nuevo.uid, ms: 300 });
    this.guardar();
    this.aviso(`Ahora eres ${nuevo.nombre} (Nv ${nuevo.nivel})`);
  }

  // ---- Barra de atajos ----
  usarAtajo(a: NonNullable<Atajo>): void {
    if (this.hogar) this.cortarHogar();
    if ('m' in a) this.usarMov(this.jugador, a.m, this.objetivo);
    else this.usarItem(a.i);
  }
  // Lo que le falta a un atajo para poder usarse ahora (lo pinta el HUD): fracción de enfriamiento que queda.
  enfriando(a: NonNullable<Atajo>): number {
    const l = this.jugador, g = Math.max(0, l.gcd - this.ahora) / l.gcdDura;
    if ('i' in a) return g;
    const m = getMove(a.m);
    if (!m) return 0;
    return Math.max(perfil(m).sinGlobal ? 0 : g, Math.max(0, (l.cd[a.m] ?? 0) - this.ahora) / (l.cdDura[a.m] ?? enfriamiento(m)));
  }
  // Celeridad de un luchador: su Velocidad base y su etapa de Velocidad (reglas.ts).
  cel(l: Luchador): number { return celeridad(this.formaL(l).base[5], l.boosts.spe ?? 0); }
  // Lo que lleva lanzado (0…1); en los canalizados, lo que le queda.
  lanzaFrac(l: Luchador): number {
    const c = l.lanza;
    if (!c) return 0;
    const f = Math.max(0, Math.min(1, (this.ahora - c.t0) / Math.max(0.01, c.t1 - c.t0)));
    return c.canal ? 1 - f : f;
  }

  // ---- Usar un movimiento ----
  usarMov(l: Luchador, id: string, obj: Luchador | null, punto?: Punto | null): boolean {
    const m = getMove(id), yo = l.rol === 'jugador';
    if (!m || l.muerto || l.enBall || this.cambiando) return false;
    if (l.estado === 'slp' || l.estado === 'frz') { if (yo) this.aviso(`${l.nombre} está ${NOMBRE_ESTADO[l.estado].toLowerCase()}`); return false; }
    const pf0 = perfil(m);
    if ((!pf0.sinGlobal && (l.lanza || l.gcd > this.ahora)) || (l.cd[id] ?? 0) > this.ahora) return false;
    // Protección y familia: sin global y al momento (corta lo que estés lanzando); dura una ventana corta.
    if (pf0.escudo) {
      if (l.lanza) this.cortarLanza(l);
      l.cd[id] = this.ahora + (l.cdDura[id] = pf0.cd / this.cel(l));
      l.escudo = { id, hasta: this.ahora + pf0.escudo, bloqueo: false };
      this.reproducir(l, 'Charge', pf0.escudo);
      this.rotulo(l, m.nombre, 'good');
      return true;
    }
    // Áreas: no hace falta objetivo. La zona va donde apuntas (el ratón; si no, el objetivo), hasta ALCANCE_DISTANCIA;
    // el cono, hacia ahí; alrededor, en torno a ti.
    const fa = m ? formaArea(m) : null;
    if (fa) {
      let p = punto ?? (yo ? this.apunta : null) ?? (obj && !obj.muerto ? { x: obj.x, y: obj.y } : null);
      if (fa !== 'alrededor') {
        if (!p) { if (yo) this.aviso(`${m.nombre}: apunta con ${this.conMando ? 'el stick derecho' : 'el ratón'}`); return false; }
        const d = Math.hypot(p.x - l.x, p.y - l.y), k = d > ALCANCE_DISTANCIA ? ALCANCE_DISTANCIA / d : 1;
        if (fa === 'zona' && k < 1) p = { x: l.x + (p.x - l.x) * k, y: l.y + (p.y - l.y) * k };
        this.mirarA(l, p);
      }
      punto = fa === 'alrededor' ? null : p;
      obj = null;
    }
    // Dirigidos: hacia donde apuntas (si no, hacia el objetivo); no hace falta objetivo ni estar a su alcance.
    const dir = !!m && dirigido(m);
    if (dir) {
      const p = punto ?? (yo ? this.apunta : null) ?? (obj && !obj.muerto ? { x: obj.x, y: obj.y } : null);
      if (!p) { if (yo) this.aviso(`${m.nombre}: apunta con ${this.conMando ? 'el stick derecho' : 'el ratón'}`); return false; }
      this.mirarA(l, p);
      punto = p; obj = null;
    }
    // Embestida: hacia donde apuntas (si no, hacia el objetivo); golpea al primero que encuentre.
    const mv = m ? movilidad(m) : null;
    if (mv === 'embestida') {
      const p = punto ?? (yo ? this.apunta : null) ?? (obj && !obj.muerto ? { x: obj.x, y: obj.y } : null);
      if (!p) { if (yo) this.aviso(`${m.nombre}: apunta con ${this.conMando ? 'el stick derecho' : 'el ratón'}`); return false; }
      this.mirarA(l, p);
      punto = p; obj = null;
    }
    const objetivo = !fa && !dir && mv !== 'embestida' && necesitaObjetivo(m);
    if (objetivo) {
      if (!obj && yo) obj = this.objetivo = this.salvajes.filter(s => !s.muerto && !s.enBall).sort((a, b) => Math.hypot(a.x - l.x, a.y - l.y) - Math.hypot(b.x - l.x, b.y - l.y))[0] ?? null;
      if (!obj || obj.muerto || obj.enBall) { if (yo) this.aviso(this.conMando ? 'Elige a quién (R2)' : 'Elige a quién (clic en un Pokémon o Tab)'); return false; }
      if (obj.rol === 'vecino') { if (yo) this.aviso(`${obj.nombre} es de los tuyos`); return false; }
      if (obj.rol === 'remoto' && !this.luchandoCon(obj)) {
        if (yo) this.aviso(this.duelo?.con === obj.uid && this.duelo.fase === 'cuenta' ? 'El duelo aún no ha empezado' : `${obj.nombre} es otro jugador: R para retarle a un duelo`);
        return false;
      }
      const d = Math.hypot(obj.x - l.x, obj.y - l.y), al = alcance(m) + Math.max(8, obj.alto * 0.3);
      if (d > al) { if (yo) this.aviso(`${m.nombre}: demasiado lejos`); return false; }
      this.mirarA(l, obj);
    }
    const pf = perfil(m), k = this.cel(l), blanco = objetivo ? obj! : l;
    l.gcd = this.ahora + (l.gcdDura = GCD / k);
    // Carga (lejos del objetivo) y embestida: primero el desplazamiento; el golpe sale al llegar (pasoDash).
    const lejos = mv === 'carga' && objetivo && Math.hypot(obj!.x - l.x, obj!.y - l.y) > ALCANCE_CUERPO + Math.max(8, obj!.alto * 0.3);
    if (lejos || (mv === 'embestida' && punto)) {
      const dx = punto ? punto.x - l.x : 0, dy = punto ? punto.y - l.y : 0, d = Math.hypot(dx, dy) || 1;
      l.dash = lejos ? { tipo: 'carga', id, obj: obj!, dx: 0, dy: 0, resta: CARGA_ALCANCE * 1.5, vel: CARGA_VEL, hasta: this.ahora + 0.8 }
        : { tipo: 'embestida', id, obj: null, dx: dx / d, dy: dy / d, resta: EMBESTIDA_LARGO, vel: EMBESTIDA_VEL, hasta: this.ahora + 0.6 };
      l.cd[id] = this.ahora + (l.cdDura[id] = pf.cd / k);
      l.meta = null;
      return true;
    }
    if (pf.lanza !== 'instant') {
      // Lanzado o canalizado: se queda quieto (moverse lo corta) y sale al acabar o, canalizado, por tics.
      const t = pf.t / k;
      l.lanza = { id, obj: objetivo ? blanco : null, t0: this.ahora, t1: this.ahora + t, canal: pf.lanza === 'canal', tics: pf.tics, hechos: 0, punto: punto ?? undefined };
      l.meta = null;
      if (l.lanza.canal) {
        l.cd[id] = this.ahora + (l.cdDura[id] = pf.cd / k);
        if (l.estado === 'par' && this.rnd() < 0.25) { l.lanza = null; this.rotulo(l, '¡Paralizado!', 'bad'); return true; }
      }
      this.reproducir(l, 'Charge', t);
      return true;
    }
    this.soltar(l, id, blanco, pf, punto);
    return true;
  }
  // Sale el movimiento (instantáneo, o al acabar de lanzarlo): enfriamiento, animación y el golpe en su fotograma.
  private soltar(l: Luchador, id: string, blanco: Luchador, pf: Perfil, punto?: Punto | null): void {
    const m = getMove(id)!, k = this.cel(l);
    l.cd[id] = this.ahora + (l.cdDura[id] = pf.cd / k);
    const anim: AnimId = m.category === 'Status' ? 'Charge' : m.flags.includes('contact') ? 'Attack' : 'Shoot';
    this.reproducir(l, anim);
    l.quietoHasta = this.ahora + 0.35 + pf.agotado;
    // Agotado (Hiperrayo): un rato sin poder hacer nada.
    if (pf.agotado) { l.gcd = Math.max(l.gcd, this.ahora + pf.agotado); l.gcdDura = Math.max(l.gcdDura, pf.agotado); this.despues(0.5, () => this.rotulo(l, 'Agotado', 'weak')); }
    if (l.estado === 'par' && this.rnd() < 0.25) { this.rotulo(l, '¡Paralizado!', 'bad'); return; }
    // El efecto sale en el fotograma del golpe de la animación (HitFrame), no antes.
    // Dirigido: apunta al salir (tú, adonde apuntes ahora; un salvaje, adonde está su rival).
    const apuntar = () => (l.rol === 'jugador' ? this.apunta : l.rival && !l.rival.muerto ? { x: l.rival.x, y: l.rival.y } : null) ?? punto ?? null;
    this.despues(Math.min(0.32, this.anatomia.anim(l.dex, anim)?.golpe ?? 0.2), () => formaArea(m) ? this.lanzarArea(l, id, punto ?? null)
      : dirigido(m) ? this.disparar(l, id, apuntar()) : (this.lanzarMov(l, id, blanco), movilidad(m) === 'atras' && blanco !== l && this.saltarAtras(l, blanco)));
  }
  // Cada paso: la barra de lanzamiento avanza; al llenarse sale el movimiento. Los canalizados pegan por tics.
  private pasoLanza(l: Luchador): void {
    const c = l.lanza;
    if (!c) return;
    if (l.muerto || l.enBall || l.estado === 'slp' || l.estado === 'frz' || this.cambiando) { this.cortarLanza(l); return; }
    const o = c.obj, m = getMove(c.id)!;
    if (o && (o.muerto || o.enBall)) { this.cortarLanza(l); return; }
    if (o) this.mirarA(l, o);
    const lejos = !!o && Math.hypot(o.x - l.x, o.y - l.y) > alcance(m) + Math.max(8, o.alto * 0.3) + 20;
    if (c.canal) {
      if (lejos) { this.cortarLanza(l, l.rol === 'jugador' ? 'Fuera de alcance' : undefined); return; }
      const paso = (c.t1 - c.t0) / c.tics;
      while (l.lanza === c && c.hechos < c.tics && this.ahora >= c.t0 + (c.hechos + 1) * paso) {
        // Cada tic, un golpe con su parte: un golpe del multigolpe o un tercio del drenaje (el efecto secundario, solo en el primero).
        const parte: MoveData = { ...m, multihit: null, basePower: m.multihit ? m.basePower : m.basePower / c.tics, secondary: c.hechos ? null : m.secondary };
        c.hechos++;
        this.reproducir(l, 'Shoot', Math.min(0.35, paso));
        if (formaArea(m)) this.lanzarArea(l, c.id, c.punto ?? null, parte); else this.lanzarMov(l, c.id, o ?? l, parte);
      }
      if (c.hechos >= c.tics && l.lanza === c) l.lanza = null;
      else if (l.anim !== 'Charge' && l.anim !== 'Shoot') this.reproducir(l, 'Charge', c.t1 - this.ahora);
      return;
    }
    if (l.anim !== 'Charge') this.reproducir(l, 'Charge', Math.max(0.1, c.t1 - this.ahora));
    if (this.ahora < c.t1) return;
    l.lanza = null;
    if (lejos) { if (l.rol === 'jugador') this.aviso(`${m.nombre}: fuera de alcance`); return; }
    this.soltar(l, c.id, o ?? l, perfil(m), c.punto);
  }
  // Corta lo que esté lanzando (al moverse, al dormirse, al interrumpirle…).
  cortarLanza(l: Luchador, txt?: string): void {
    if (!l.lanza) return;
    l.lanza = null;
    if (l.anim === 'Charge') l.animHasta = 0;
    if (txt) this.rotulo(l, txt, 'bad');
  }
  // Se tira el golpe y sus efectos y se pide la animación; lo tirado se aplica cuando la animación llega al impacto
  // (`impacto`) o, si no llega, a los IMPACTO_MAX s.
  // Ida y vuelta: tras el golpe, un salto hacia atrás (lejos de a quien ha pegado).
  private saltarAtras(l: Luchador, de: Luchador): void {
    if (l.muerto) return;
    const dx = l.x - de.x, dy = l.y - de.y, d = Math.hypot(dx, dy) || 1;
    l.dash = { tipo: 'atras', id: '', obj: null, dx: dx / d, dy: dy / d, resta: ATRAS_LARGO, vel: ATRAS_VEL, hasta: this.ahora + 0.5 };
  }
  // Cada paso de un desplazamiento: en línea recta (una pared lo para). La carga persigue al objetivo y golpea al
  // llegar a su lado; la embestida golpea al primer enemigo que toca.
  private pasoDash(l: Luchador, dt: number): void {
    const d = l.dash!, m = d.id ? getMove(d.id) : undefined;
    if (l.muerto || l.enBall || this.cambiando || this.ahora > d.hasta) { l.dash = undefined; return; }
    let ux = d.dx, uy = d.dy;
    const golpear = (t: Luchador) => { l.dash = undefined; this.mirarA(l, t); this.soltar(l, d.id, t, perfil(m!)); };
    if (d.tipo === 'carga') {
      const o = d.obj!;
      if (o.muerto || o.enBall) { l.dash = undefined; return; }
      const dist = Math.hypot(o.x - l.x, o.y - l.y);
      if (dist <= ALCANCE_CUERPO + Math.max(8, o.alto * 0.3) - 4) { golpear(o); return; }
      ux = (o.x - l.x) / dist; uy = (o.y - l.y) / dist;
    }
    const paso = Math.min(d.vel * dt, d.resta), nx = l.x + ux * paso, ny = l.y + uy * paso;
    if (this.bloqueado(l, nx, ny)) { l.dash = undefined; return; }
    l.x = nx; l.y = ny; d.resta -= paso; l.anda = true;
    if (d.tipo !== 'atras') this.mirarA(l, { x: l.x + ux, y: l.y + uy });
    if (d.tipo === 'embestida') {
      const t = this.enemigosDe(l).find(o => Math.hypot(o.x - l.x, o.y - l.y) <= ALCANCE_CUERPO * 0.6 + Math.max(6, o.alto * 0.3));
      if (t) { golpear(t); return; }
    }
    if (d.resta <= 0) l.dash = undefined;
  }
  // Sale un dirigido: un proyectil desde quien lo lanza hacia `p`.
  private disparar(l: Luchador, id: string, p: Punto | null): void {
    if (l.muerto || this.cambiando || !p) return;
    const dx = p.x - l.x, dy = p.y - l.y, d = Math.hypot(dx, dy) || 1;
    this.mirarA(l, p);
    this.proyectiles.push({ id, de: l, x: l.x, y: l.y, dx: dx / d, dy: dy / d, resta: ALCANCE_PROYECTIL, h: l.alto * 0.45 });
  }
  // Los proyectiles avanzan; al tocar a un enemigo de quien lo lanzó (el primero), el golpe de siempre.
  private pasoProyectiles(dt: number): void {
    if (!this.proyectiles.length) return;
    const paso = VEL_PROYECTIL * dt;
    this.proyectiles = this.proyectiles.filter(q => {
      if (q.de.muerto || this.cambiando) return false;
      q.x += q.dx * paso; q.y += q.dy * paso; q.resta -= paso;
      const t = this.enemigosDe(q.de).find(o => Math.hypot(o.x - q.x, o.y - q.y) <= RADIO_PROYECTIL + Math.max(6, o.alto * 0.3));
      if (t) { this.lanzarMov(q.de, q.id, t, undefined, { x: q.x, y: q.y - q.h }); return false; }
      return q.resta > 0;
    });
  }
  private lanzarMov(l: Luchador, id: string, t: Luchador, parte?: MoveData, desde?: Punto): void {
    const m = parte ?? getMove(id)!;
    if (l.muerto || this.cambiando) return;
    const obs = this.objetos(l);
    const lente = this.lleva(l, 'scopelens');
    const r: Golpe = t === l ? { dano: 0, eficacia: 1, critico: false, falla: false } : golpe(lente ? { ...m, critRatio: m.critRatio + (escalaDe(lente) >= 2 ? 2 : 1) } : m, l, t, this.clima?.tipo ?? null, this.rnd);
    if (r.dano > 0 && obs.length && !m.fixedDamage) r.dano = Math.max(1, Math.floor(r.dano * obs.reduce((k, ob) => k * this.potencia(ob, m, r), 1)));
    const ef = this.efectos(m, l, t, r), n = ++this.n;
    this.pendientes.set(n, { l, id, t, r, ef, hasta: this.ahora + IMPACTO_MAX });
    this.emitir({ tipo: 'mov', n, de: l.uid, a: t.uid, mov: id, golpe: r, efectos: ef.map(e => ({ uid: e.quien.uid, boosts: e.boosts, estado: e.estado, semilla: e.semilla })), desde });
  }
  // Un área: a quién toca (los enemigos de quien la lanza dentro de la forma), un golpe para cada uno (×AREA_VARIOS
  // si son varios) y un solo suceso para animarlos juntos. Si no toca a nadie, solo el destello en el suelo.
  private lanzarArea(l: Luchador, id: string, punto: Punto | null, parte?: MoveData): void {
    const m = parte ?? getMove(id)!, fa = formaArea(m)!;
    if (l.muerto || this.cambiando) return;
    const c = fa === 'zona' && punto ? punto : { x: l.x, y: l.y };
    const ang = punto ? Math.atan2(punto.y - l.y, punto.x - l.x) : 0;
    const dentro = (t: Luchador) => {
      const cuerpo = Math.max(6, t.alto * 0.3), dx = t.x - c.x, dy = t.y - c.y, d = Math.hypot(dx, dy);
      if (fa === 'zona') return d <= ZONA_RADIO + cuerpo;
      if (fa === 'alrededor') return d <= ALREDEDOR_RADIO + cuerpo;
      const da = Math.abs(((Math.atan2(dy, dx) - ang) % (2 * Math.PI) + 3 * Math.PI) % (2 * Math.PI) - Math.PI);
      return d <= CONO_LARGO + cuerpo && (da <= CONO_ANGULO || d < cuerpo);
    };
    const tocados = this.enemigosDe(l).filter(dentro);
    this.emitir({ tipo: 'area', de: l.uid, mov: id, forma: fa, x: c.x, y: c.y, ang });
    if (!tocados.length) return;
    const obs = this.objetos(l), lente = this.lleva(l, 'scopelens'), varios = tocados.length > 1 ? AREA_VARIOS : 1;
    const golpes = tocados.map(t => {
      const r: Golpe = golpe(lente ? { ...m, critRatio: m.critRatio + (escalaDe(lente) >= 2 ? 2 : 1) } : m, l, t, this.clima?.tipo ?? null, this.rnd);
      if (r.dano > 0 && !m.fixedDamage) r.dano = Math.max(1, Math.floor(r.dano * varios * obs.reduce((k, ob) => k * this.potencia(ob, m, r), 1)));
      const ef = this.efectos(m, l, t, r), n = ++this.n;
      this.pendientes.set(n, { l, id, t, r, ef, hasta: this.ahora + IMPACTO_MAX });
      return { n, a: t.uid, golpe: r, efectos: ef.map(e => ({ uid: e.quien.uid, boosts: e.boosts, estado: e.estado, semilla: e.semilla })) };
    });
    const [g0, ...mas] = golpes;
    this.emitir({ tipo: 'mov', n: g0.n, de: l.uid, a: g0.a, mov: id, golpe: g0.golpe, efectos: g0.efectos, mas });
  }
  // A quién puede dar un área: tú das a los salvajes (y a tu rival de duelo); un salvaje, a los jugadores.
  private enemigosDe(l: Luchador): Luchador[] {
    const vivos = (ls: Luchador[]) => ls.filter(t => t !== l && !t.muerto && !t.enBall);
    if (l.rol === 'salvaje') return vivos([this.jugador, ...this.remotos]);
    return vivos([...this.salvajes, ...this.remotos.filter(o => this.luchandoCon(o))]);
  }
  // Objetos equipados (combate/objetos.ts, uno por ranura): solo los de tu equipo llevan.
  objetos(l: Luchador): string[] { return (l.miembro?.objetos ?? []).filter((o): o is string => !!o); }
  // El objeto que lleva de esa familia (común, raro o épico), con su id de verdad; null si no lo lleva. `base`: id común.
  lleva(l: Luchador, base: string): string | null { return this.objetos(l).find(o => baseDe(o) === base) ?? null; }
  private potencia(ob: string, m: MoveData, r: Golpe): number {
    const b = baseDe(ob);
    if (b === 'lifeorb') return escalar(1.3, ob);
    if (b === 'muscleband') return m.category === 'Physical' ? escalar(1.1, ob) : 1;
    if (b === 'wiseglasses') return m.category === 'Special' ? escalar(1.1, ob) : 1;
    if (b === 'expertbelt') return r.eficacia > 1 ? escalar(1.2, ob) : 1;
    return EQUIPABLES[ob]?.tipo === m.type ? escalar(POTENCIA_TIPO, ob) : 1;
  }
  impacto(n: number): void {
    const p = this.pendientes.get(n);
    if (!p) return;
    this.pendientes.delete(n);
    this.aplicar(p.l, p.id, p.t, p.r, p.ef);
  }

  // Cambios de stats y estados que causará el movimiento (las probabilidades se tiran aquí, antes de animarlo).
  private efectos(m: MoveData, l: Luchador, t: Luchador, r: Golpe): Efecto[] {
    const out: Efecto[] = [];
    if (r.falla || r.eficacia === 0) return out;
    const estado = (q: Luchador, s: string) => { if (this.puedeEstado(q, s) && !out.some(e => e.quien === q && e.estado)) out.push({ quien: q, estado: s }); };
    if (m.boosts) out.push({ quien: t, boosts: m.boosts });
    if (m.selfBoosts) out.push({ quien: l, boosts: m.selfBoosts });
    if (m.status) estado(t, m.status);
    if (m.id === 'leechseed' && t !== l && !t.tipos.includes('Grass')) out.push({ quien: t, semilla: true });   // a los de Planta no les prende
    const s = m.secondary;
    if (s && this.rnd() * 100 < s.chance) {
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
  private aplicar(l: Luchador, id: string, t: Luchador, r: Golpe, ef: Efecto[]): void {
    const m = getMove(id)!;
    if (l.muerto && t !== l) return;
    if (t.muerto || t.enBall) return;
    // Se entra en combate cuando el golpe llega (aunque falle), no al empezar a lanzarlo: si no, el que huye corta el lanzamiento.
    if (t !== l) { l.ultimoCombate = t.ultimoCombate = this.ahora; this.provocar(t, l); }
    if (t !== l && !this.ajeno(t) && this.bloquea(t, l, m)) return;
    // Lo que le pasa a quien no llevas tú (un remoto, o un salvaje en espejo) se lo aplica quien lo lleva.
    const ajeno = this.ajeno(t);
    if (ajeno) this.salir({ tipo: 'golpe', de: l.uid, a: t.uid, mov: id, golpe: r, efectos: ef.filter(e => e.quien === t).map(e => ({ boosts: e.boosts, estado: e.estado, semilla: e.semilla })) });
    if (r.falla) return;
    if (r.dano > 0) {
      // Los que hacen retroceder interrumpen: lo cortado tarda INTERRUMPIDO s en volver.
      if (!ajeno && t.lanza && perfil(m).interrumpe) {
        const c = t.lanza;
        if (!c.canal) { t.cd[c.id] = Math.max(t.cd[c.id] ?? 0, this.ahora + INTERRUMPIDO); t.cdDura[c.id] = INTERRUMPIDO; }
        this.cortarLanza(t, '¡Interrumpido!');
      }
      if (!ajeno) this.danar(t, r.dano, l);
      // Objetos: la Vidasfera cuesta 1/10, la Campana Concha devuelve 1/8 del daño, el Casco Dentado pincha al que toca.
      if (!this.ajeno(l) && !l.muerto) {
        const campana = this.lleva(l, 'shellbell'), casco = this.lleva(t, 'rockyhelmet');
        if (campana) this.curar(l, Math.max(1, Math.floor(r.dano * escalaDe(campana) / 8)));
        if (this.lleva(l, 'lifeorb')) this.danar(l, Math.max(1, Math.floor(l.stats.hp / 10)), null);
        if (!ajeno && !l.muerto && casco && m.flags.includes('contact')) this.danar(l, Math.max(1, Math.floor(l.stats.hp * escalaDe(casco) / 6)), null);
      }
      if (m.drain) this.curar(l, Math.max(1, Math.floor(r.dano * m.drain[0] / m.drain[1])));
      if (m.recoil) this.danar(l, Math.max(1, Math.floor(r.dano * m.recoil[0] / m.recoil[1])), null);
    }
    if (r.eficacia === 0) return;
    if (m.heal) this.curar(l, Math.floor(l.stats.hp * m.heal[0] / m.heal[1]));
    const cc = curaClima(m.id, this.clima?.tipo ?? null);
    if (cc) this.curar(l, Math.floor(l.stats.hp * cc));
    if (CLIMA_DE[m.id]) this.ponerClima(CLIMA_DE[m.id]);
    // Un ataque de Fuego descongela.
    if (t.estado === 'frz' && m.type === 'Fire' && r.dano > 0 && !ajeno) this.curarEstado(t);
    for (const e of ef) {
      if (e.quien.muerto || (ajeno && e.quien === t)) continue;
      if (e.boosts) this.cambiarStats(e.quien, e.boosts);
      if (e.estado) this.ponerEstado(e.quien, e.estado, false);
      if (e.semilla) this.sembrar(e.quien, l);
    }
  }
  // Protección y familia (§3.5): dentro de la ventana, el golpe no hace nada. La primera vez que bloquea, su CD baja a
  // la mitad; las variantes castigan al que la toca (contacto): Barrera Espinosa (1/8 de su vida), Búnker (veneno),
  // Escudo Real, Obstrucción y Telatrampa (le bajan un stat), Baluarte Ardiente (quemadura). Aguante va en `danar`.
  private bloquea(t: Luchador, l: Luchador | null, m: MoveData | undefined): boolean {
    const e = t.escudo;
    if (!e || e.hasta < this.ahora || e.id === 'endure') return false;
    this.rotulo(t, '¡Protegido!', 'good');
    this.premioEscudo(t);
    if (l && !l.muerto && !this.ajeno(l) && m?.flags.includes('contact')) {
      if (e.id === 'spikyshield') this.danar(l, Math.max(1, Math.floor(l.stats.hp / 8)), t);
      else if (e.id === 'banefulbunker' && this.puedeEstado(l, 'psn')) this.ponerEstado(l, 'psn');
      else if (e.id === 'burningbulwark' && this.puedeEstado(l, 'brn')) this.ponerEstado(l, 'brn');
      else if (e.id === 'kingsshield') this.cambiarStats(l, { atk: -1 });
      else if (e.id === 'obstruct') this.cambiarStats(l, { def: -2 });
      else if (e.id === 'silktrap') this.cambiarStats(l, { spe: -1 });
    }
    return true;
  }
  private premioEscudo(t: Luchador): void {
    const e = t.escudo!;
    if (e.bloqueo) return;
    e.bloqueo = true;
    const resta = (t.cd[e.id] ?? 0) - this.ahora;
    if (resta > 0) t.cd[e.id] = this.ahora + resta / 2;
  }
  private danar(t: Luchador, n: number, de: Luchador | null): void {
    // En un duelo nadie se debilita: el que llega a 1 PS pierde.
    // Banda Focus (con la vida entera, cada RECARGA_BANDA s) y Cinta Focus (1 de cada 10): aguanta con 1 PS un golpe.
    const banda = this.lleva(t, 'focussash'), cinta = this.lleva(t, 'focusband');
    const ob = !de || n < t.ps || t.ps < 1 ? null
      : banda && t.ps >= t.stats.hp && this.ahora > (t.bandaHasta ?? -99) ? banda
      : cinta && this.rnd() < 0.1 * escalaDe(cinta) ? cinta : null;
    if (ob) {
      n = Math.floor(t.ps - 1);
      if (ob === banda) t.bandaHasta = this.ahora + RECARGA_BANDA / escalaDe(ob);
      this.rotulo(t, `¡Aguanta con ${EQUIPABLES[ob].nombre}!`, 'strong', 200);
    }
    // Aguante: en su ventana, un golpe que te debilitaría te deja con 1 PS.
    if (de && n >= t.ps && t.ps > 1 && t.escudo?.id === 'endure' && t.escudo.hasta >= this.ahora) {
      n = Math.floor(t.ps - 1);
      this.rotulo(t, '¡Aguanta!', 'good', 200);
      this.premioEscudo(t);
    }
    const pierde = t.rol === 'jugador' && !!de && this.luchandoCon(de) && t.ps - n < 1;
    if (pierde) n = Math.max(0, Math.floor(t.ps - 1));
    t.ps = Math.max(pierde ? 1 : 0, t.ps - n);
    if (t.munieco) {
      t.danoTotal = (t.danoTotal ?? 0) + n;
      if (t.ps <= 0) { t.ps = t.stats.hp; this.rotulo(t, 'Entero otra vez', 'good', 400); }
    }
    if (de) t.ultimoCombate = de.ultimoCombate = this.ahora;
    if (de && (de.rol === 'jugador' || de.rol === 'remoto')) (t.golpeadores ??= new Set()).add(de.uid);   // el daño de estados o del clima no cuenta como combate
    if (t.rol === 'jugador' && this.hogar) this.cortarHogar('¡Te han interrumpido!');
    this.rotulo(t, `−${n}`, t.rol === 'jugador' ? 'bad' : 'neutral', 0, true);
    if (pierde) { this.finDuelo(false, `${de!.nombre} gana el duelo`); return; }
    if (t.ps <= 0) { this.debilitar(t, de); return; }
    if (t.anim !== 'Attack' && t.anim !== 'Shoot' && t.anim !== 'Charge') this.reproducir(t, 'Hurt', 0.3);
    if (de) this.provocar(t, de);
  }
  private curar(l: Luchador, n: number): void {
    if (l.muerto || n <= 0) return;
    const antes = l.ps;
    l.ps = Math.min(l.stats.hp, l.ps + n);
    if (l.ps > antes) this.rotulo(l, `+${l.ps - antes}`, 'good');
  }
  private cambiarStats(l: Luchador, b: Boosts): void {
    for (const [s, n] of Object.entries(b) as [Stat6, number][]) {
      l.boosts[s] = Math.max(-6, Math.min(6, (l.boosts[s] ?? 0) + n));
      l.boostHasta[s] = this.ahora + DURA_BOOST;   // el rótulo "+1 Atq" lo pone la animación (showBoosts)
    }
  }
  private ponerEstado(l: Luchador, s: string, rotulo = true): void {
    if (!this.puedeEstado(l, s)) return;
    l.estado = s; l.estadoHasta = this.ahora + DURA_ESTADO[s]; l.ticEstado = this.ahora + TURNO; l.toxN = 0;
    if (rotulo) this.rotulo(l, NOMBRE_ESTADO[s], 'bad', 200);
    if (s === 'slp' || s === 'frz') { l.meta = null; this.reproducir(l, 'Sleep', DURA_ESTADO[s]); }
  }
  // Drenadoras: no es un estado (convive con uno) y otra semilla solo renueva la que hay.
  private sembrar(t: Luchador, de: Luchador): void {
    if (t.muerto || t.tipos.includes('Grass')) return;
    t.semilla = { de: de.uid, hasta: this.ahora + DURA_SEMILLA, tic: t.semilla?.tic ?? this.ahora + TURNO };
    this.rotulo(t, '¡Drenadoras!', 'bad', 200);
  }
  private curarEstado(l: Luchador): void {
    if (l.estado === 'slp' && l.anim === 'Sleep') l.animHasta = 0;
    l.estado = null; l.toxN = 0;
  }
  // Cómo reacciona el salvaje `l` ante el rival `de`: su naturaleza y la diferencia de nivel (combate/naturalezas.ts).
  reaccionA(l: Luchador, de: Luchador = this.jugador): Reaccion {
    return l.tabla[casoDe(de.rol === 'jugador' ? this.partida.activo.nivel : de.nivel, l.nivel)];
  }
  // Un salvaje al que le pegan (o tira de una Ball) reacciona según su naturaleza; `llamado`: se lo pide otro salvaje.
  private provocar(t: Luchador, de: Luchador, llamado = false): void {
    if (t.rol !== 'salvaje' || t.muerto || t.munieco || (t.modo === 'pelear' && t.rival === de)) return;
    const r = this.reaccionA(t, de);
    const pelear = () => {
      t.modo = 'pelear'; t.rival = de; t.meta = null;
      if (r === 'llama' && !llamado) {
        this.rotulo(t, '¡!', 'bad');
        for (const o of this.salvajes) if (o !== t && !o.muerto && !o.enBall && o.modo !== 'pelear' && Math.hypot(o.x - t.x, o.y - t.y) < LLAMADA) {
          const ro = this.reaccionA(o, de);
          if (ro !== 'huye' && ro !== 'espanta' && ro !== 'quieto') { o.modo = 'pelear'; o.rival = de; o.meta = null; }
        }
      }
    };
    if (llamado || r === 'acecha' || r === 'pelea' || r === 'llama') { pelear(); return; }
    if (r === 'quieto') { t.meta = null; t.modo = 'pasear'; t.espera = 2; return; }
    if (r === 'aguanta') {
      // Varias llamadas por golpe (al soltarlo y al dañar): cuenta como el mismo si llegan juntas.
      if (t.aguante > 0 && this.ahora - t.aguante > 0.8) { pelear(); return; }
      if (t.aguante <= 0 || this.ahora - t.aguante > 20) { t.aguante = this.ahora; t.meta = null; this.rotulo(t, 'Aguanta', 'weak'); }
      return;
    }
    if (r === 'acorralado' && t.ps < t.stats.hp * 0.5) { pelear(); return; }
    if (t.modo === 'huir') return;
    t.modo = 'huir'; t.huirHasta = this.ahora + 4 + this.rnd() * 2; t.meta = null;
  }

  private debilitar(t: Luchador, de: Luchador | null): void {
    t.muerto = true; t.meta = null;
    this.reproducir(t, 'Faint', 0.9);
    if (t === this.objetivo) this.objetivo = null;
    if (t.rol === 'jugador') { this.caer(); return; }
    this.emitir({ tipo: 'debilitado', uid: t.uid });
    this.despues(1.3, () => this.quitar(t));
    // La experiencia, para todos los que le han hecho daño (tú aquí; a los remotos se les avisa).
    const g = t.golpeadores ?? new Set<string>();
    if (g.has(this.jugador.uid)) this.recompensa(t);
    const para = [...g].filter(u => u.startsWith('remoto-')).map(u => u.slice('remoto-'.length));
    if (para.length) this.salir({ tipo: 'muere', a: t.uid, para, linea: t.linea, nivel: t.nivel, alfa: !!t.alfa, nombre: t.nombre });
    if (t.alfa) {
      (this.partida.estado.alfas ??= {})[this.mapa.id] = Date.now();
      this.guardar();
      this.ponerAlfa();
    } else this.reaparecer(t.ronda);
  }
  // En su sitio vuelve a salir otro de la tabla de la zona (la rareza del rincón secreto, siempre la misma).
  private reaparecer(r?: Ronda): void {
    if (r) this.despues(RESPAWN, () => {
      if (!r.fija) r.linea = this.tirarRonda(r, this.cuando());
      this.salvajes.push(this.crearSalvaje(r));
    });
  }
  // Quién sale en el sitio de un salvaje: de la tabla de la zona o, en el rincón secreto, su rareza (a veces).
  private tirarRonda(r: Ronda, c: Cuando): string {
    return r.secreto ? tirarSecreto(this.mapa.id, r.secreto, this.rnd, c.momento) : tirarEspecie(this.mapa.id, this.rnd, c)?.linea ?? r.linea;
  }
  // La hora del día y el clima que hace (data/aparicion.ts): de qué tabla salen los salvajes.
  private cuando(): Cuando { return { momento: momentoDe(this.partida.estado.minuto), clima: this.clima?.tipo ?? null }; }
  // Al hacerse de noche (o de día) y al cambiar el clima, los que ya no tocan se van y en su sitio sale otro de los que
  // tocan; si empieza a hacer clima, además, cada uno de los demás pasa a ser de los del clima con PROB_CLIMA (los que
  // salen con clima). Solo los que pasean tranquilos y lejos de ti, uno a uno en los CAMBIO_SALVAJES s siguientes,
  // para que no se note el cambio.
  private pasoAparicion(): void {
    if (this.espejo) return;
    const c = this.cuando(), clave = `${c.momento}|${c.clima ?? ''}`;
    if (clave === this.claveAparicion) return;
    const empiezaClima = !!c.clima && !this.claveAparicion.endsWith(`|${c.clima}`);
    this.claveAparicion = clave;
    const nada = this.ahora < 1.5;   // recién entrado en el mapa: aún no se ha visto a nadie
    for (const l of this.salvajes) {
      const r = l.ronda;
      if (!r || r.fija || r.secreto || l.alfa) continue;
      const aClima = empiezaClima && !!lineasClima(this.mapa.id, c.clima).length && this.rnd() < PROB_CLIMA;
      if (!aClima && puedeSalir(this.mapa.id, r.linea, c)) continue;
      if (nada) this.cambiarSalvaje(l, aClima);
      else this.despues(this.rnd() * CAMBIO_SALVAJES, () => this.cambiarSalvaje(l, aClima));
    }
  }
  // `aClima`: pasa a ser uno de los del clima (si aún hace). El que ya no toca lo intenta hasta que puede; el que
  // solo iba a pasar a ser del clima, unas cuantas veces.
  private cambiarSalvaje(l: Luchador, aClima: boolean, intentos = 6): void {
    const r = l.ronda!;
    if (!this.salvajes.includes(l) || l.muerto || l.enBall) return;
    const c = this.cuando(), toca = puedeSalir(this.mapa.id, r.linea, c), delClima = aClima ? lineasClima(this.mapa.id, c.clima) : [];
    if (toca && !delClima.length) return;   // entretanto ya vuelve a tocar (o ya no hace el clima)
    const quieto = l.modo === 'pasear' && !l.rival && l.ps >= l.stats.hp, lejos = Math.hypot(l.x - this.jugador.x, l.y - this.jugador.y) > LEJOS_CAMBIO;
    if (!quieto || (!lejos && this.ahora >= 1.5)) {   // ahora no: se vuelve a mirar más tarde
      if (!toca || intentos > 0) this.despues(10, () => this.cambiarSalvaje(l, aClima, intentos - 1));
      return;
    }
    this.quitar(l);
    r.linea = delClima.length ? delClima[Math.floor(this.rnd() * delClima.length)] : tirarEspecie(this.mapa.id, this.rnd, c)?.linea ?? r.linea;
    this.salvajes.push(this.crearSalvaje(r));
  }
  // Experiencia para el que manejas y, a veces, algo que suelta (bayas, alguna Ball).
  private recompensa(t: Pick<Luchador, 'linea' | 'nivel' | 'alfa' | 'nombre'>): void {
    const yo = this.partida.activo, exp = expPor(t.linea, t.nivel) * (t.alfa ? ALFA_VIDA : 1);
    this.rotulo(this.jugador, `+${exp} exp`, 'strong', 300);
    this.procesar(this.partida.ganarExp(yo, exp));
    // Pokécoins (para la tienda del pueblo): según su nivel; el alfa, cinco veces más.
    const din = Math.round((8 + t.nivel * 4) * (t.alfa ? 5 : 1) * (0.8 + this.rnd() * 0.4));
    this.partida.cobrar(din);
    this.rotulo(this.jugador, `+${din} Pokécoins`, 'strong', 900);
    const r = this.rnd();
    if (t.alfa) {   // el alfa suelta siempre lo mejor de su nivel: dos Balls y dos curas (combate/botin.ts)
      const { ball, cura } = MEJOR[tierDe(t.nivel)];
      const eq = sortearEquipable(this.rnd, true);   // y un objeto equipable, a menudo raro o épico (inventario, I)
      const piedra = this.rnd() < PROB_PIEDRA_ALFA ? sortearPiedra(this.rnd) : null;   // y a veces una piedra evolutiva
      const monedas = MONEDAS_ALFA + (this.rnd() < PROB_MONEDA_EXTRA ? 1 : 0);   // y Monedas Meowth, para el gachapón de la ciudad (combate/gacha.ts)
      this.partida.dar(ball, 2); this.partida.dar(cura, 2); this.partida.dar(eq); if (piedra) this.partida.dar(piedra); this.partida.dar(MONEDA_GACHA, monedas);
      this.aviso(`${t.nombre} ha soltado: ${ITEMS[ball].nombre} ×2, ${ITEMS[cura].nombre} ×2${piedra ? `, ${ITEMS[piedra].nombre}` : ''}, ${ITEMS[MONEDA_GACHA].nombre} ×${monedas} y ${ITEMS[eq].nombre} (equípalo con I)`);
    } else if (r < 0.02) {   // muy de vez en cuando, un equipable
      const eq = sortearEquipable(this.rnd);
      this.partida.dar(eq); this.aviso(`${t.nombre} ha soltado: ${ITEMS[eq].nombre} (equípalo con I)`);
    } else if (r < 0.35) {   // uno de cada tres, algo acorde a su nivel
      const suelta = sortear(t.nivel, this.rnd);
      this.partida.dar(suelta); this.aviso(`${t.nombre} ha soltado: ${ITEMS[suelta].nombre}`);
    }
    this.contarMision(t.alfa ? 'alfa' : 'derrotar', t.linea);
    this.incubar();
    const tir = this.partida.derrotado(t.linea);   // racha de shiny de su línea
    if (tir) this.aviso(`¡Racha! ${this.partida.estado.derrotas![t.linea]} ${LINEAS[t.linea]?.formas[0].nombre ?? t.nombre} derrotados: probabilidad de shiny ×${tir}`);
    this.guardar();
  }
  // ---- Misiones (tablón del pueblo; las pinta el HUD) ----
  private contarMision(tipo: 'derrotar' | 'capturar' | 'alfa', linea: string): void {
    for (const m of this.partida.contar(tipo, linea, this.mapa.id)) {
      const n = this.partida.progresoMision(m), lista = n >= m.n;
      this.rotulo(this.jugador, lista ? '¡Misión cumplida!' : `${n}/${m.n}`, 'strong', 500);
      if (lista) this.aviso('¡Misión cumplida! Entrégala en el tablón del pueblo.');   // (solo derrotar/capturar/alfa: las de bayas no pasan por aquí)
    }
  }
  aceptarMision(m: Mision): void {
    if (this.partida.estadoMision(m) !== 'nueva') return;
    this.partida.aceptar(m);
    this.guardar();
  }
  entregarMision(m: Mision): void {
    const antes = this.partida.tablon(this.mapa.id).n;
    if (!this.partida.entregar(m)) return;
    this.rotulo(this.jugador, `+${m.premio.exp} exp`, 'strong', 200);
    this.aviso(`Recompensa: ${[`${m.premio.exp} exp`, ...(m.premio.oro ? [`${m.premio.oro} Pokécoins`] : []), ...m.premio.items.map(([id, n]) => `${ITEMS[id]?.nombre ?? id} ×${n}`)].join(', ')}`);
    this.procesar(this.partida.ganarExp(this.partida.activo, m.premio.exp));
    if (this.partida.tablon(this.mapa.id).n > antes) this.aviso('¡Nuevas misiones en el tablón!');   // la cadena avanza (de 3 en 3)
    this.guardar();
  }
  private procesar(av: Aviso[]): void {
    // Si evoluciona, lo que aprende se cuenta en la cinemática (src/scenes/Evolucion.ts), no en avisos.
    const p = this.jugador, antes = this.formaL(p), evoluciona = av.some(a => a.tipo === 'evoluciona');
    for (const a of av) {
      if (a.tipo === 'nivel') {
        this.rotulo(p, `¡Nivel ${a.nivel}!`, 'strong', 600);
        p.nivel = a.nivel;
        const viejo = p.stats.hp;
        p.stats = statsDe(formaDe(p.linea, a.nivel, p.miembro?.forma).base, a.nivel);
        p.ps = Math.min(p.stats.hp, p.ps + (p.stats.hp - viejo));
      } else if (a.tipo === 'aprende') {
        const m = getMove(a.mov);
        if (evoluciona) continue;
        this.aviso(`¡${p.nombre} ha aprendido ${m?.nombre ?? a.mov}!${a.casilla >= 0 ? ` (tecla ${(a.casilla + 1) % 10})` : ' Ponlo en la barra con K.'}`);
      }
    }
    if (evoluciona) this.emitir({ tipo: 'evoluciona', antes, aprende: av.filter(a => a.tipo === 'aprende').map(a => getMove((a as { mov: string }).mov)?.nombre ?? (a as { mov: string }).mov) });
  }
  // Al terminar la cinemática de la evolución: el que manejas pasa a la forma de su nivel, conservando sitio, vida (en
  // fracción), estado, cambios y enfriamientos.
  cambiarForma(): void {
    const p = this.jugador, m = p.miembro!, f = formaM(m), frac = p.ps / p.stats.hp;
    p.linea = m.linea; p.nivel = m.nivel; p.dex = idSprite(f.dex, m.shiny); p.nombre = f.nombre; p.tipos = tiposDe(f.id);
    p.stats = statsDe(f.base, m.nivel); p.ps = Math.max(1, Math.round(p.stats.hp * frac));
    const as = this.anatomia.alto(p.dex);
    p.escala = escalaEspecie(f.id, as); p.alto = Math.min(ALTO_MAX, as * p.escala);
    p.anim = null; p.animHasta = 0;
    this.emitir({ tipo: 'destello', uid: p.uid, ms: 300 });
  }
  // Te debilitas: fundido y vuelves al pueblo con la vida entera.
  private caer(): void {
    if (this.cambiando) return;
    this.finDuelo(false, 'Has perdido el duelo', true);
    this.aviso(`¡${this.jugador.nombre} se ha debilitado! Vuelves al pueblo.`);
    this.partida.activo.ps = 1;
    this.partida.guardar();
    this.ir('pueblo', 'inicio', 1.3);
  }

  // ---- Duelos entre jugadores ----
  // Como en WoW: R con otro jugador elegido le reta; él acepta con R (o rechaza con Esc) y, tras la cuenta atrás, os
  // podéis pegar. Nadie se debilita: el que llega a 1 PS pierde. Alejarse de donde empezó, cambiar de mapa o
  // debilitarse (por un salvaje) es abandonar. Cada uno lleva su lado y se avisan con la `Salida` 'duelo'.
  luchandoCon(l: Luchador): boolean { return this.duelo?.fase === 'lucha' && this.duelo.con === l.uid; }
  retar(): void {
    if (this.retoDe) { this.aceptarReto(); return; }
    const o = this.objetivo, p = this.jugador;
    if (this.duelo) { this.aviso(this.duelo.fase === 'reto' ? 'Ya has retado a alguien: espera su respuesta' : 'Ya estás en un duelo'); return; }
    if (!o || o.rol !== 'remoto') { this.aviso(this.conMando ? 'Elige a otro jugador (R2) y pulsa L2+R2 para retarle a un duelo' : 'Elige a otro jugador (Tab o clic) y pulsa R para retarle a un duelo'); return; }
    if (p.muerto || o.muerto || this.cambiando) return;
    if (Math.hypot(o.x - p.x, o.y - p.y) > DUELO_RADIO) { this.aviso('Acércate más para retarle'); return; }
    this.duelo = { con: o.uid, fase: 'reto', hasta: this.ahora + RETO, c: { x: p.x, y: p.y } };
    this.salir({ tipo: 'duelo', para: redDe(o.uid), fase: 'reto' });
    this.aviso(`Has retado a ${o.nombre} a un duelo`);
  }
  private aceptarReto(): void {
    const r = this.retoDe!, o = this.luchador(r.de);
    this.retoDe = null;
    if (!o || this.duelo) return;
    this.salir({ tipo: 'duelo', para: redDe(r.de), fase: 'acepta' });
    this.empezarDuelo(o);
  }
  // Esc con un reto pendiente: lo rechazas (true si había uno).
  rechazarReto(): boolean {
    if (!this.retoDe) return false;
    this.salir({ tipo: 'duelo', para: redDe(this.retoDe.de), fase: 'rechaza' });
    this.retoDe = null;
    this.aviso('Has rechazado el duelo');
    return true;
  }
  private empezarDuelo(o: Luchador): void {
    const p = this.jugador;
    this.duelo = { con: o.uid, fase: 'cuenta', hasta: this.ahora + CUENTA, c: { x: (p.x + o.x) / 2, y: (p.y + o.y) / 2 } };
    this.objetivo = o;
    this.aviso(`Duelo con ${o.nombre}: empieza en ${CUENTA} s`);
    for (let i = 0; i < CUENTA; i++) this.despues(i, () => { if (this.duelo?.fase === 'cuenta') this.rotulo(this.jugador, String(CUENTA - i), 'strong'); });
  }
  // Se acaba: ganas o pierdes; `avisar`: decírselo al otro. Lo que te haya puesto el duelo (estado, bufos) se quita.
  // Si aún esperabas respuesta a tu reto, solo se retira.
  private finDuelo(ganas: boolean, txt: string, abandona = false, avisar = true): void {
    const d = this.duelo;
    if (!d) return;
    this.duelo = null;
    if (d.fase === 'reto') { if (avisar) this.salir({ tipo: 'duelo', para: redDe(d.con), fase: 'rechaza' }); return; }
    if (avisar) this.salir({ tipo: 'duelo', para: redDe(d.con), fase: 'fin', gana: ganas ? this.miRed : redDe(d.con), abandona });
    const p = this.jugador;
    if (p.estado) this.curarEstado(p);
    p.semilla = undefined;
    p.boosts = {}; p.boostHasta = {};
    if (p.lanza) this.cortarLanza(p);
    this.aviso(txt);
    if (!p.muerto) this.rotulo(p, ganas ? '¡Victoria!' : 'Derrota', ganas ? 'strong' : 'weak');
  }
  private pasoDuelo(): void {
    if (this.retoDe && (this.ahora > this.retoDe.hasta || !this.luchador(this.retoDe.de))) this.retoDe = null;
    const d = this.duelo, p = this.jugador;
    if (!d) return;
    const o = this.luchador(d.con);
    if (d.fase === 'reto') {
      if (this.ahora > d.hasta || !o) { this.duelo = null; this.aviso('Nadie ha aceptado el duelo'); }
      return;
    }
    if (!o) { this.finDuelo(true, 'El otro jugador se ha ido: ¡ganas el duelo!', false, false); return; }
    if (Math.hypot(p.x - d.c.x, p.y - d.c.y) > DUELO_RADIO) { this.finDuelo(false, 'Te has alejado: abandonas el duelo', true); return; }
    if (d.fase === 'cuenta' && this.ahora >= d.hasta) { d.fase = 'lucha'; this.rotulo(p, '¡A luchar!', 'strong'); }
  }
  // Lo que llega del otro jugador (`de`: uid de su remoto).
  recibirDuelo(fase: Extract<Salida, { tipo: 'duelo' }>['fase'], de: string, gana?: string, abandona?: boolean): void {
    const o = this.luchador(de), nombre = o?.nombre ?? 'El otro jugador', d = this.duelo;
    if (fase === 'reto') {
      // Os habéis retado a la vez: empieza.
      if (d?.con === de && d.fase === 'reto' && o) { this.salir({ tipo: 'duelo', para: redDe(de), fase: 'acepta' }); this.empezarDuelo(o); return; }
      if (d || this.cambiando) { this.salir({ tipo: 'duelo', para: redDe(de), fase: 'rechaza' }); return; }   // ocupado
      this.retoDe = { de, hasta: this.ahora + RETO };
      this.aviso(`${nombre} te reta a un duelo: ${this.k('R')} para aceptar, ${this.k('Esc')} para rechazar`);
    } else if (fase === 'acepta') {
      if (d?.con === de && d.fase === 'reto' && o) this.empezarDuelo(o);
    } else if (fase === 'rechaza') {
      if (d?.con === de && d.fase === 'reto') { this.duelo = null; this.aviso(`${nombre} no acepta el duelo`); }
      if (this.retoDe?.de === de) this.retoDe = null;   // ha retirado su reto
    } else if (d?.con === de) {
      const ganas = gana === this.miRed;
      this.finDuelo(ganas, ganas ? (abandona ? `${nombre} abandona: ¡ganas el duelo!` : `¡Has ganado el duelo a ${nombre}!`) : `${nombre} gana el duelo`, false, false);
    }
  }

  // ---- Objetos ----
  // Equipar en un hueco (o vaciarlo, id null) un objeto del que manejas, desde el inventario (I). En combate no se
  // puede, ni llevar dos iguales.
  equipar(id: string | null, hueco: number): void {
    const l = this.jugador, m = this.partida.activo, antes = this.partida.objetos(m)[hueco];
    if (l.muerto || this.cambiando || hueco < 0 || hueco >= HUECOS_OBJ) return;
    if (this.ahora - l.ultimoCombate < 6) { this.aviso('No puedes cambiar de objeto en combate'); return; }
    if (id === null) { if (antes) { this.aviso(`${l.nombre} ya no lleva ${ITEMS[antes]?.nombre ?? antes}`); this.partida.desequipar(m, hueco); } else return; }
    else if (this.partida.objetos(m).some((o, i) => o === id && i !== hueco)) { this.aviso(`${l.nombre} ya lleva ${ITEMS[id]?.nombre ?? id}`); return; }
    else if (this.partida.equipar(m, id, hueco)) this.aviso(`${l.nombre} lleva ${ITEMS[id]?.nombre ?? id}`);
    else return;
    l.bandaHasta = undefined; l.ticObjeto = undefined;
    this.guardar();
  }
  // ---- Objetos ----
  usarItem(id: string): void {
    const l = this.jugador, def = ITEMS[id];
    if (!def || l.muerto || this.cambiando) return;
    if (this.partida.tiene(id) <= 0) { this.aviso(`No te quedan: ${def.nombre}`); return; }
    if (l.gcd > this.ahora || l.lanza) return;
    if (def.tipo === 'pokeball') { this.lanzarBall(id); return; }
    if (def.tipo === 'evolutivo') { this.evolucionarCon(id); return; }
    if (id === 'rarecandy') { this.caramelo(); return; }
    if (def.tipo === 'baya' || def.tipo === 'medicina') {
      // Bayas: una parte de la vida; pociones: PS fijos (Poción 20, Superpoción 60, Hiperpoción 120).
      const cura = def.cura ?? Math.ceil(l.stats.hp * (id === 'sitrus' ? 0.5 : id === 'oran' ? 0.3 : 0.15));
      if (l.ps >= l.stats.hp && !(id === 'lum' && l.estado)) { this.aviso('Tienes la vida entera'); return; }
      this.partida.gastar(id); l.gcd = this.ahora + (l.gcdDura = GCD);
      this.curar(l, cura);
      this.reproducir(l, 'Charge', 0.4);
      return;
    }
    this.aviso(`${def.nombre}: aquí no sirve`);
  }
  // Piedra evolutiva en el que manejas (Eevee + Piedra Agua → Vaporeon, Shellder + Piedra Agua → Cloyster): la
  // cinemática de la evolución (procesar) y, al acabar, cambiarForma. No en combate, como cambiar de objeto.
  private evolucionarCon(id: string): void {
    const l = this.jugador, m = this.partida.activo, nombre = ITEMS[id]?.nombre ?? id;
    const e = this.partida.evoCon(m, id);
    if (!e) { this.aviso(`${nombre}: no le hace nada a ${l.nombre}`); return; }
    if ('falta' in e) { this.aviso(`${nombre}: para ser ${e.a.nombre}, ${e.falta}`); return; }
    if (this.ahora - l.ultimoCombate < 6) { this.aviso('No puedes evolucionar en combate'); return; }
    const av = this.partida.evolucionarCon(m, id);
    if (!av) return;
    this.procesar(av);
    this.guardar();
  }
  // Poké Ball al objetivo: vuela, el salvaje entra, se mueve tres veces y se queda (o sale).
  private lanzarBall(id: string): void {
    const p = this.jugador, t = this.objetivo;
    if (this.lanzando) return;
    if (!t || t.rol !== 'salvaje' || t.muerto) { this.aviso('Elige a un salvaje para lanzarle la Poké Ball'); return; }
    if (t.alfa) { this.aviso('Un alfa no se deja capturar: derrótalo'); return; }
    if (t.munieco) { this.aviso('El muñeco de prácticas no se captura'); return; }
    if (Math.hypot(t.x - p.x, t.y - p.y) > TIRO) { this.aviso('Acércate más para lanzar la Poké Ball'); return; }
    this.partida.gastar(id);
    this.lanzando = true; p.gcd = this.ahora + (p.gcdDura = GCD);
    this.mirarA(p, t); this.reproducir(p, 'Shoot', 0.35);
    const n = ++this.n;
    this.emitir({ tipo: 'ball', n, item: id, a: t.uid, x0: p.x, y0: p.y - 14, x1: t.x, y1: t.y - 6 });
    this.despues(VUELO_BALL, () => {
      if (t.muerto) { this.lanzando = false; this.emitir({ tipo: 'ballFin', n, ok: null }); return; }
      t.enBall = true; t.meta = null;
      if (this.espejo) { this.miBall = t.uid; this.salir({ tipo: 'ball', a: t.uid, dentro: true }); }
      this.despues(MENEOS_BALL, () => {
        this.lanzando = false;
        if (t.muerto) { this.emitir({ tipo: 'ballFin', n, ok: null }); if (this.miBall === t.uid) this.miBall = null; return; }   // ha caído mientras tanto (otro jugador)
        const prob = this.probBall(t, id), ok = this.rnd() < prob;
        this.emitir({ tipo: 'ballFin', n, ok });
        if (this.miBall === t.uid) { this.miBall = null; this.salir({ tipo: 'ball', a: t.uid, dentro: false, ok }); }
        if (ok) this.capturado(t, id);
        else {
          this.escapaDeBall(t, p);
          if (!this.objetivo) this.objetivo = t;   // si se escapa, sigues con él fijado
          this.emitir({ tipo: 'destello', uid: t.uid, ms: 200 });
          this.aviso(`¡${t.nombre} ha salido de la ${ITEMS[id]?.nombre ?? 'Ball'}! (tenías un ${Math.round(prob * 100)} %)`);
        }
      });
    });
  }
  // Probabilidad de que un salvaje se quede en esa Ball ahora mismo (reglas.ts probCaptura); la placa del HUD la enseña.
  probBall(t: Luchador, ball: string): number {
    if (t.alfa) return 0;
    return probCaptura(ESPECIES[t.linea]?.atrapa ?? 0.3, BALL[ball] ?? 1, t.ps, t.stats.hp, t.estado);
  }
  // Se escapa de la Ball: sale alterado (no recupera vida en SIN_CURA_BALL s, aunque huya o pasee) y reacciona
  // según su naturaleza. Así lo que le has bajado no se pierde si falla el primer intento.
  private escapaDeBall(t: Luchador, de: Luchador): void {
    t.enBall = false;
    t.sinCuraHasta = this.ahora + SIN_CURA_BALL;
    t.ultimoCombate = de.ultimoCombate = this.ahora;
    this.provocar(t, de);
  }
  // Caramelo Raro en el que manejas: un nivel (con lo que aprenda y su evolución). No en combate, como las piedras.
  private caramelo(): void {
    const l = this.jugador, m = this.partida.activo;
    if (m.nivel >= 100) { this.aviso(`${l.nombre} ya está a nivel 100`); return; }
    if (this.ahora - l.ultimoCombate < 6) { this.aviso('No se puede usar en combate'); return; }
    this.partida.gastar('rarecandy');
    this.procesar(this.partida.ganarExp(m, expDeNivel(m.linea, m.nivel + 1) - m.exp));
    this.guardar();
  }
  // Un huevo en la mochila cuenta las derrotas; a las HUEVO_DERROTAS se abre y el bebé se va al pueblo.
  private incubar(): void {
    const e = this.partida.estado;
    if (this.partida.tiene('huevo') <= 0) { delete e.incubando; return; }
    e.incubando = (e.incubando ?? 0) + 1;
    if (e.incubando < HUEVO_DERROTAS) return;
    delete e.incubando;
    this.partida.gastar('huevo');
    const linea = abrirHuevo(this.rnd), m = this.partida.crear(linea, 1, this.rnd() < PROB_SHINY);
    this.aviso(`¡El huevo se ha abierto! Ha salido ${m.shiny ? 'un ' : ''}${formaDe(linea, 1).nombre}${m.shiny ? ' shiny' : ''}. Te espera en el pueblo.`);
    this.rotulo(this.jugador, '★', 'strong');
  }
  // Gachapón de Meowth (F junto a él en la ciudad; combate/gacha.ts): gasta una moneda y da el premio. Devuelve lo que
  // ha salido para que el HUD abra la cápsula, o nada si no te quedan monedas.
  tirarGacha(): { premio: Premio; clase: Clase; nombre: string; shiny?: boolean } | null {
    if (!this.partida.gastar(MONEDA_GACHA)) { this.aviso('No te quedan Monedas Meowth: las sueltan los alfas'); return null; }
    const { premio, clase } = tirarCapsula(this.rnd);
    let nombre: string, shiny: boolean | undefined;
    if (premio.tipo === 'item') {
      this.partida.dar(premio.id, premio.n);
      nombre = `${ITEMS[premio.id]?.nombre ?? premio.id}${premio.n > 1 ? ` ×${premio.n}` : ''}`;
    } else {
      const m = this.partida.crear(premio.linea, premio.nivel, this.rnd() < PROB_SHINY);
      shiny = m.shiny; nombre = `${formaDe(premio.linea, premio.nivel).nombre} (Nv ${premio.nivel})${shiny ? ' shiny' : ''}`;
      this.aviso(`¡Del gachapón sale ${nombre}! Te espera en el pueblo.`);
    }
    this.guardar();
    return { premio, clase, nombre, shiny };
  }
  private capturado(t: Luchador, ball: string): void {
    t.muerto = true;
    const m = this.partida.crear(t.linea, t.nivel, t.shiny, t.sexo);
    m.ps = Math.max(0.1, t.ps / t.stats.hp);
    this.quitar(t);
    this.aviso(`¡Has capturado a ${t.nombre} (Nv ${t.nivel}) con la ${ITEMS[ball]?.nombre ?? 'Ball'}! Te espera en el pueblo.`);
    this.rotulo(this.jugador, '★', 'strong');
    this.contarMision('capturar', t.linea);
    if (this.espejo) this.capturadosFuera.set(t.uid, this.ahora + 3);
    else this.reaparecer(t.ronda);
    this.guardar();
  }

  // ---- Inteligencia de los salvajes y de los vecinos ----
  private pensar(l: Luchador, dt: number): void {
    if (l.muerto || l.enBall) return;
    if (l.munieco) { l.anda = false; return; }   // el muñeco de prácticas no se mueve ni pega
    if (l.dash) return;                          // cargando, embistiendo o saltando atrás
    const quieto = l.estado === 'slp' || l.estado === 'frz' || l.quietoHasta > this.ahora;
    const vel = velAndar(60 + Math.min(60, this.formaL(l).base[5] * 0.3), 75, l.boosts.spe ?? 0) * (l.estado === 'par' ? VEL_PARALIZADO : 1);
    l.anda = false;
    if (quieto || l.lanza) return;   // lanzando, quieto
    const p = this.jugador;
    if (l.modo === 'huir') {
      if (this.ahora > l.huirHasta) { l.modo = 'pasear'; l.casa = { x: l.x, y: l.y }; l.meta = null; return; }
      // Hacia el punto libre (y a la vista) que más le aleje de ti; se elige de nuevo cada poco o si se atasca.
      if (!l.meta || this.ahora - l.rutaT > 0.6 || Math.hypot(l.meta.x - l.x, l.meta.y - l.y) < 6) {
        let mejor: Punto | null = null, dm = -1;
        for (let k = 0; k < 12; k++) {
          const a = k / 12 * Math.PI * 2 + this.rnd() * 0.4, q = { x: l.x + Math.cos(a) * 60, y: l.y + Math.sin(a) * 45 };
          if (!this.pisable(q) || !this.nav.directo(l, q)) continue;
          const d = Math.hypot(q.x - p.x, q.y - p.y);
          if (d > dm) { dm = d; mejor = q; }
        }
        l.meta = mejor; l.rutaT = this.ahora;
      }
      if (l.meta) l.anda = this.mover(l, l.meta.x - l.x, l.meta.y - l.y, vel * 1.2, dt);
      if (!l.anda) l.meta = null;
      return;
    }
    if (l.modo === 'pelear') {
      const r = l.rival;
      if (!r || r.muerto || (r.rol === 'remoto' && !this.remotos.includes(r)) || Math.hypot(l.x - l.casa.x, l.y - l.casa.y) > CORREA) { l.modo = 'volver'; l.rival = null; return; }
      if (l.alfa && this.golpeAlfa(l, r)) return;
      // Si su rival le está lanzando algo y está a punto de llegar, a veces se protege (una vez por lanzamiento).
      const c = r.lanza, escudo = l.movs.find(id => ESCUDO[id] && (l.cd[id] ?? 0) <= this.ahora);
      if (c && escudo && c !== l.leyo && c.t1 - this.ahora < 0.15 && (c.obj === l || (c.punto && Math.hypot(c.punto.x - l.x, c.punto.y - l.y) < 60))) {
        l.leyo = c;
        if (this.rnd() < 0.5) { this.usarMov(l, escudo, null); return; }
      }
      // El movimiento listo más fuerte (a veces uno de estado), si llega; si no, acercarse.
      const listos = l.movs.map(id => getMove(id)!).filter(m => m && !ESCUDO[m.id] && (l.cd[m.id] ?? 0) <= this.ahora);
      const dano = listos.filter(m => m.basePower > 0).sort((a, b) => b.basePower - a.basePower);
      const elige = (this.rnd() < 0.2 ? listos.find(m => m.category === 'Status') : undefined) ?? dano[0];
      const d = Math.hypot(r.x - l.x, r.y - l.y);
      if (elige && d <= alcance(elige) + 6) {
        this.mirarA(l, r);
        if (l.gcd <= this.ahora) this.usarMov(l, elige.id, necesitaObjetivo(elige) ? r : null);
        return;
      }
      const meta = elige ? alcance(elige) - 6 : 24;
      if (d > meta) l.anda = this.caminarA(l, r.x, r.y, vel, dt);
      return;
    }
    if (l.modo === 'volver') {
      const d = Math.hypot(l.casa.x - l.x, l.casa.y - l.y);
      if (d < 6) { l.modo = 'pasear'; l.ps = l.stats.hp; l.boosts = {}; return; }
      l.anda = this.caminarA(l, l.casa.x, l.casa.y, vel * 1.3, dt);
      l.atasco = l.anda ? 0 : l.atasco + dt;
      if (l.atasco > 1.5) { l.x = l.casa.x; l.y = l.casa.y; l.atasco = 0; }   // sin forma de llegar: a casa directamente
      return;
    }
    // Si pasas cerca (tú u otro jugador): el que acecha te ataca sin que le pegues y el que se espanta sale corriendo.
    if (l.rol === 'salvaje' && !this.espejo) {
      for (const j of [p, ...this.remotos]) {
        if (j.muerto) continue;
        const d = Math.hypot(j.x - l.x, j.y - l.y), r = d <= ESPANTO ? this.reaccionA(l, j) : null;
        if (r === 'acecha' && d <= ACECHO) { this.rotulo(l, '!', 'bad'); this.provocar(l, j); return; }
        if (r === 'espanta') { this.rotulo(l, '!', 'weak'); this.provocar(l, j); return; }
      }
    }
    // Pasear cerca de su sitio, con pausas.
    if (!l.meta) {
      l.espera -= dt;
      if (l.espera <= 0) {
        // Solo metas libres y a la vista: nunca dentro de un edificio ni al otro lado de una pared.
        l.meta = this.puntoLibre(l.casa, l.rol === 'vecino' ? 110 : 80, l);
        if (!l.meta) l.espera = 0.5 + this.rnd();
      }
      return;
    }
    const dx = l.meta.x - l.x, dy = l.meta.y - l.y;
    if (Math.hypot(dx, dy) < 2 || !(l.anda = this.mover(l, dx, dy, vel * 0.45, dt))) { l.meta = null; l.espera = 1 + this.rnd() * 4; }
  }

  // Estados, cambios de stats que caducan y vida que vuelve fuera de combate.
  private vivir(l: Luchador, dt: number): void {
    if (l.muerto || l.enBall) return;   // dentro de la Ball no le pasa nada (ni el veneno lo debilita ahí)
    const enCombate = l.rol === 'jugador' ? this.salvajes.some(s => s.modo === 'pelear' && s.rival === l && !s.muerto) : l.modo === 'pelear';
    if (l.estado) {
      if (this.ahora > l.estadoHasta) this.curarEstado(l);
      else if (DANO_ESTADO[l.estado] && this.ahora > l.ticEstado) {
        // Un turno: quemado 1/16, envenenado 1/8, gravemente envenenado 1/16, 2/16, 3/16…
        l.ticEstado = this.ahora + TURNO;
        if (l.estado === 'tox') l.toxN++;
        // Fuera de combate no debilita (como el veneno al caminar en los juegos): se queda en 1 PS.
        const n = Math.max(1, Math.floor(l.stats.hp * DANO_ESTADO[l.estado] * (l.estado === 'tox' ? l.toxN : 1)));
        const tope = enCombate || this.ahora - l.ultimoCombate < 6 ? n : Math.min(n, Math.ceil(l.ps) - 1);
        if (tope > 0) this.danar(l, tope, null);
        if (l.muerto) return;
      }
    }
    // Drenadoras: cada turno le quita 1/8 de su vida y se la da a quien la sembró (si sigue en pie y es de los tuyos).
    const sem = l.semilla;
    if (sem && this.ahora > sem.hasta) l.semilla = undefined;
    else if (sem && this.ahora > sem.tic) {
      sem.tic = this.ahora + TURNO;
      const n = Math.max(1, Math.floor(l.stats.hp * DANO_SEMILLA));
      const tope = enCombate || this.ahora - l.ultimoCombate < 6 ? n : Math.min(n, Math.ceil(l.ps) - 1);
      const quita = Math.min(tope, Math.ceil(l.ps));
      if (quita > 0) {
        const de = this.luchador(sem.de);
        if (!this.ajeno(l)) this.danar(l, quita, null);
        if (de && !de.muerto && !this.ajeno(de)) this.curar(de, quita);
        if (de && !de.muerto) this.emitir({ tipo: 'drena', de: l.uid, a: de.uid });
      }
      if (l.muerto) return;
    }
    // Restos: en combate, 1/16 de su vida cada turno.
    const restos = this.lleva(l, 'leftovers');
    if (enCombate && restos && l.ps < l.stats.hp && this.ahora > (l.ticObjeto ?? -99)) {
      if (l.ticObjeto !== undefined && this.ahora - l.ticObjeto < TURNO) this.curar(l, Math.max(1, Math.floor(l.stats.hp * escalaDe(restos) / 16)));
      l.ticObjeto = this.ahora + TURNO;
    }
    for (const [s, h] of Object.entries(l.boostHasta) as [Stat6, number][]) if (this.ahora > h) { delete l.boosts[s]; delete l.boostHasta[s]; }
    // Solo se cura fuera de combate: nadie le persigue, lleva 6 s sin pegar ni recibir, no tiene un estado que dañe y no
    // acaba de escaparse de una Ball.
    if (!enCombate && this.ahora - l.ultimoCombate > 6 && this.ahora > l.sinCuraHasta && !(l.estado && DANO_ESTADO[l.estado]) && !l.semilla && l.ps < l.stats.hp) l.ps = Math.min(l.stats.hp, l.ps + l.stats.hp * CURA_FUERA * dt);
    if (l.munieco && l.danoTotal && l.ps >= l.stats.hp && this.ahora - l.ultimoCombate > 6) l.danoTotal = 0;   // entero y en paz: la cuenta vuelve a cero
  }

  // Bufos y debufos de un luchador: su estado y sus cambios de stats, con la fracción de tiempo que les queda.
  auras(l: Luchador): Aura[] {
    const out: Aura[] = [];
    if (l.estado) out.push({ txt: CORTO_ESTADO[l.estado] ?? l.estado, nombre: NOMBRE_ESTADO[l.estado] ?? l.estado, color: COLOR_ESTADO[l.estado] ?? 0x888888,
      frac: Math.max(0, Math.min(1, (l.estadoHasta - this.ahora) / (DURA_ESTADO[l.estado] ?? 1))) });
    if (l.semilla) out.push({ txt: 'DRE', nombre: 'Drenadoras', color: 0xc0453a, frac: Math.max(0, Math.min(1, (l.semilla.hasta - this.ahora) / DURA_SEMILLA)) });
    // Y a quien sembró, un bufo por cada uno que está drenando (el que más dure manda la barra).
    const drena = [...this.todos(), ...this.remotos].filter(o => o.semilla?.de === l.uid && !o.muerto);
    if (drena.length) out.push({ txt: drena.length > 1 ? `DRE×${drena.length}` : 'DRE', nombre: drena.length > 1 ? `Drenando a ${drena.length}` : `Drenando a ${drena[0].nombre}`,
      color: 0x4fae4a, frac: Math.max(0, Math.min(1, (Math.max(...drena.map(o => o.semilla!.hasta)) - this.ahora) / DURA_SEMILLA)) });
    const banda = this.lleva(l, 'focussash');
    if (banda && (l.bandaHasta ?? 0) > this.ahora) out.push({ txt: 'BAN', nombre: 'Banda Focus gastada', color: 0x8a7a6a, frac: Math.max(0, Math.min(1, (l.bandaHasta! - this.ahora) / (RECARGA_BANDA / escalaDe(banda)))) });
    for (const [s, n] of Object.entries(l.boosts) as [Stat6, number][]) {
      if (!n) continue;
      out.push({ txt: `${CORTO_STAT[s]}${n > 0 ? '+' : ''}${n}`, nombre: `${NOMBRE_STAT[s]} ${n > 0 ? '+' : ''}${n}`, color: n > 0 ? 0x4fae4a : 0xc0453a,
        frac: Math.max(0, Math.min(1, ((l.boostHasta[s] ?? 0) - this.ahora) / DURA_BOOST)) });
    }
    return out;
  }

  // Clima: dura DURA_CLIMA s en todo el mapa.
  private ponerClima(c: Clima): void {
    if (this.espejo) this.salir({ tipo: 'clima', clima: c });
    this.clima = { tipo: c, hasta: this.ahora + DURA_CLIMA };
    this.climaTic = this.ahora + TURNO;
    this.emitir({ tipo: 'clima', clima: c });
    this.aviso(`${NOMBRE_CLIMA[c]} durante ${DURA_CLIMA} s`);
  }
  private pasoClima(): void {
    const c = this.clima;
    if (c ? this.ahora > c.hasta : this.ahora >= this.climaSorteo) { this.sortearClima(c); return; }
    if (!c || c.base || this.ahora < this.climaTic) return;
    this.climaTic = this.ahora + TURNO;
    for (const l of [this.jugador, ...(this.espejo ? [] : this.salvajes)]) if (!l.muerto && !l.enBall && danaClima(c.tipo, l.tipos)) this.danar(l, Math.max(1, Math.floor(l.stats.hp / 16)), null);
  }

  // Clima de la zona: al entrar, cada CLIMA_TRAMO s y al acabar el de un movimiento se sortea si lo hace (prob) o no.
  // Si sigue el mismo, no se avisa; al entrar al mapa tampoco (ya lo dice la bienvenida y se ve).
  private sortearClima(antes: { tipo: Clima } | null): void {
    const z = this.espejo ? undefined : this.mapa.clima, avisar = this.ahora > 1;
    this.climaSorteo = this.ahora + CLIMA_TRAMO;
    if (z && this.rnd() < z.prob) {
      this.clima = { tipo: z.tipo, hasta: this.climaSorteo, base: true };
      if (antes?.tipo === z.tipo) return;
      this.emitir({ tipo: 'clima', clima: z.tipo });
      if (avisar) this.aviso(NOMBRE_CLIMA[z.tipo]);
    } else {
      this.clima = null;
      if (!antes) return;
      this.emitir({ tipo: 'clima', clima: null });
      if (avisar) this.aviso(FIN_CLIMA[antes.tipo]);
    }
  }

  // Rayos de la tormenta (RAYO_*): solo en las zonas con `rayos` y mientras llueve (de la zona o de Danza Lluvia).
  private pasoRayos(): void {
    if (this.espejo || !this.mapa.rayos) return;
    const caen = this.rayos.filter(r => this.ahora >= r.cae);
    if (caen.length) { this.rayos = this.rayos.filter(r => this.ahora < r.cae); for (const r of caen) this.caeRayo(r); }
    if (this.clima?.tipo !== 'lluvia' || this.cambiando) { this.rayoSig = Math.max(this.rayoSig, this.ahora + RAYO_CADA[0]); return; }
    if (this.ahora < this.rayoSig) return;
    this.rayoSig = this.ahora + RAYO_CADA[0] + this.rnd() * (RAYO_CADA[1] - RAYO_CADA[0]);
    const p = this.jugador, cerca = this.salvajes.filter(s => !s.muerto && !s.enBall && Math.hypot(s.x - p.x, s.y - p.y) < 220);
    const o = p.muerto || (cerca.length && this.rnd() < 0.4) ? cerca[Math.floor(this.rnd() * cerca.length)] : p;
    if (!o) return;
    const a = this.rnd() * Math.PI * 2, d = this.rnd() * 36;
    this.rayos.push({ x: Math.round(o.x + Math.cos(a) * d), y: Math.round(o.y + Math.sin(a) * d * 0.65), cae: this.ahora + RAYO_AVISO });
  }
  private caeRayo(r: { x: number; y: number }): void {
    this.emitir({ tipo: 'rayo', x: r.x, y: r.y });
    this.emitir({ tipo: 'temblor' });
    for (const l of [this.jugador, ...this.salvajes]) {
      if (l.muerto || l.enBall || Math.hypot(l.x - r.x, (l.y - r.y) / 0.65) > RAYO_RADIO) continue;
      if (l.tipos.includes('Electric') || l.tipos.includes('Ground')) { this.rotulo(l, 'No le afecta', 'neutral'); continue; }
      this.danar(l, Math.max(1, Math.floor(l.stats.hp * RAYO_DANO)), null);
    }
  }

  // ---- Piedra de hogar (H) ----
  // Lo que le falta para poder usarse (s reales); 0 = lista.
  hogarFalta(): number { return Math.max(0, ((this.partida.estado.hogar ?? 0) - Date.now()) / 1000); }
  hogarFrac(): number { const h = this.hogar; return h ? Math.max(0, Math.min(1, (this.ahora - h.t0) / (h.t1 - h.t0))) : 0; }
  usarHogar(): void {
    if (this.cambiando || this.jugador.muerto) return;
    if (this.hogar) { this.cortarHogar(); return; }
    const falta = this.hogarFalta();
    if (falta > 0) { const n = Math.ceil(falta); this.aviso(`La piedra de hogar aún no está lista (${Math.floor(n / 60)}:${String(n % 60).padStart(2, '0')})`); return; }
    const p = this.jugador;
    if (p.estado === 'slp' || p.estado === 'frz') { this.aviso(`${p.nombre} está ${NOMBRE_ESTADO[p.estado].toLowerCase()}`); return; }
    this.cortarLanza(p);
    this.hogar = { t0: this.ahora, t1: this.ahora + HOGAR_CARGA };
    this.reproducir(p, 'Charge');
  }
  cortarHogar(txt?: string): void {
    if (!this.hogar) return;
    this.hogar = null;
    if (txt) this.aviso(txt);
  }
  private pasoHogar(): void {
    const h = this.hogar, p = this.jugador;
    if (!h) return;
    if (p.anda || p.muerto) { this.cortarHogar(p.muerto ? undefined : 'Piedra de hogar cancelada'); return; }
    if (p.anim !== 'Charge') this.reproducir(p, 'Charge');
    if (this.ahora < h.t1) return;
    this.cortarHogar();
    this.partida.estado.hogar = Date.now() + HOGAR_CD * 1000;
    this.emitir({ tipo: 'destello', uid: p.uid, ms: 400 });
    this.ir(this.posada(), 'inicio');
  }
  // La zona de la posada donde fijaste la piedra de hogar (el pueblo, si no has fijado otra).
  posada(): MapaId { return (this.partida.estado.posada as MapaId | undefined) ?? 'pueblo'; }
  // F junto al posadero (Slowbro): te cura a ti y al equipo, te quita los estados y fija aquí la piedra de hogar.
  descansar(): void {
    const p = this.jugador;
    if (p.muerto || this.cambiando) return;
    const igual = this.posada() === this.mapa.id;
    if (p.estado) this.curarEstado(p);
    p.ps = p.stats.hp; p.boosts = {}; p.boostHasta = {};
    for (const m of this.partida.estado.equipo) m.ps = 1;
    this.partida.estado.posada = this.mapa.id;
    this.emitir({ tipo: 'destello', uid: p.uid, ms: 350 });
    this.rotulo(p, 'Descansado', 'good');
    this.aviso(igual ? 'El posadero te cura a ti y a tu equipo' : `Tu piedra de hogar ahora te trae a ${this.mapa.nombre}. Te curas tú y tu equipo`);
    this.guardar();
  }

  // ---- Cambiar de mapa (lo hace la escena) ----
  private ir(mapa: MapaId, desde: MapaId | 'inicio', tras = 0): void {
    this.cambiando = true;
    this.finDuelo(false, 'Has abandonado el duelo', true);
    if (tras > 0) this.despues(tras, () => this.emitir({ tipo: 'ir', mapa, desde }));
    else this.emitir({ tipo: 'ir', mapa, desde });
  }
  guardar(): void {
    const p = this.jugador, m = this.partida.activo;
    if (p && m && p.miembro === m) m.ps = p.muerto ? 1 : p.ps / p.stats.hp;
    this.partida.guardar();
  }

  // ---- Un paso de simulación ----
  paso(dt: number, e: Entrada): void {
    this.ahora += dt;
    this.apunta = e.apunta ?? null;
    this.pasoProyectiles(dt);
    this.conMando = !!e.mando;
    if (this.relojes.length) {
      const toca = this.relojes.filter(r => r.t <= this.ahora);
      if (toca.length) { this.relojes = this.relojes.filter(r => r.t > this.ahora); for (const r of toca) r.fn(); }
    }
    for (const [n, q] of this.pendientes) if (this.ahora >= q.hasta) this.impacto(n);
    if (this.partida.tick(dt)) this.aviso(`Amanece. Día ${this.partida.estado.dia}`);
    this.pasoClima();
    this.pasoRayos();
    this.pasoAparicion();

    // Tú.
    const p = this.jugador;
    p.anda = false;
    if (!p.muerto && !p.dash && !this.cambiando && p.estado !== 'slp' && p.estado !== 'frz' && p.quietoHasta <= this.ahora && (e.vx || e.vy)) {
      p.anda = this.mover(p, e.vx, e.vy, velAndar(VEL, this.formaL(p).base[5], p.boosts.spe ?? 0) * (p.estado === 'par' ? VEL_PARALIZADO : 1), dt);
      if (p.anda && p.lanza) this.cortarLanza(p);   // moverse corta lo que estés lanzando
      if (p.anim === 'Attack' || p.anim === 'Shoot' || p.anim === 'Charge') p.animHasta = 0;
    }
    // Salidas del mapa.
    for (const s of this.mapa.salidas) if (!this.cambiando && p.x > s.x0 && p.x < s.x1 && p.y > s.y0 - 4 && p.y < s.y1 + 4) this.ir(s.a, this.mapa.id);

    // Los que no llevas descansan en el pueblo y se curan solos, estés donde estés.
    for (const m of this.partida.estado.equipo) if (m !== p.miembro && m.ps < 1) m.ps = Math.min(1, m.ps + CURA_FUERA * dt);
    for (const v of this.vecinos) v.ps = v.stats.hp * v.miembro!.ps;
    for (const l of this.todos()) {
      const reflejo = this.espejo && l.rol === 'salvaje';   // lo lleva el dueño del mapa: aquí solo se mueve hacia su foto
      if (!reflejo) { if (l.dash) this.pasoDash(l, dt); this.vivir(l, dt); this.pasoLanza(l); }
      if (l !== p && !reflejo) this.pensar(l, dt);
      if (!l.muerto && l.anim && this.ahora >= l.animHasta) l.anim = null;
    }
    if (this.objetivo && (this.objetivo.muerto || Math.hypot(this.objetivo.x - p.x, this.objetivo.y - p.y) > 400)) this.objetivo = null;
    this.pasoHallazgos();
    this.pasoMarca();
    this.pasoHogar();
    this.pasoDuelo();
    // Los remotos se acercan a lo último que llegó (unos 100 ms de suavizado); si está muy lejos, saltan.
    const f = 1 - Math.exp(-dt * 12);
    for (const l of this.espejo ? [...this.remotos, ...this.salvajes] : this.remotos) {
      const r = l.remoto;
      if (!r) continue;
      const d = Math.hypot(r.x - l.x, r.y - l.y);
      if (d > 120) { l.x = r.x; l.y = r.y; } else { l.x += (r.x - l.x) * f; l.y += (r.y - l.y) * f; }
      if (l.anim && this.ahora >= l.animHasta) l.anim = null;
    }
  }

  // ---- Multijugador: los demás jugadores ----
  // Pone o actualiza a otro jugador con lo que ha mandado por la red. Su sprite tiene que estar cargado (lo mide).
  ponerRemoto(e: EstadoRemoto, ahora = this.ahora): Luchador | null {
    const uid = `remoto-${e.uid}`, normal = e.dex.replace(/s$/, '');
    let l = this.remotos.find(r => r.uid === uid);
    if (!l || l.dex !== e.dex || l.nivel !== e.nivel) {
      const forma = Object.values(FORMAS).find(f => f.dex === normal);
      if (!forma) return null;
      const nuevo = this.crearLuchador('remoto', forma.linea, e.nivel, e.x, e.y, undefined, forma.id, e.dex !== normal, uid);
      // Si ya estaba (ha evolucionado o subido de nivel), se cambia en el sitio: los salvajes que le persiguen lo siguen.
      if (l) Object.assign(l, { ...nuevo, x: l.x, y: l.y, remoto: l.remoto, animN: l.animN }); else this.remotos.push(l = nuevo);
    }
    l.nombre = e.nombre; l.usuario = e.usuario; l.dir = e.dir; l.anda = e.anda; l.estado = e.estado ?? null; l.ps = (e.vida ?? 1) * l.stats.hp;
    // Una animación nueva (su cuenta ha cambiado): se pone aquí con lo que le quedaba allí.
    const animN = e.animN ?? 0;
    if (l.remoto && animN !== l.remoto.animN && e.anim) { l.anim = e.anim; l.animN++; l.animHasta = ahora + (e.animResta ?? 0.4); }
    l.remoto = { x: e.x, y: e.y, t: ahora, animN };
    return l;
  }
  quitarRemoto(uid: string): void {
    this.remotos = this.remotos.filter(r => r.uid !== `remoto-${uid}`);
    if (this.objetivo?.uid === `remoto-${uid}`) this.objetivo = null;
  }

  // Lo que hay que mandar por la red desde la última vez (y se vacía).
  sacarSalidas(): Salida[] { return this.salidas.splice(0); }
  private salir(s: Salida): void { this.salidas.push(s); }
  // Quien no llevas tú: los demás jugadores y, en espejo, los salvajes.
  private ajeno(l: Luchador): boolean { return l.rol === 'remoto' || (this.espejo && l.rol === 'salvaje'); }
  // Un uid de otro jugador (`desde`) en tus términos: su Pokémon es un remoto para ti y tu remoto en su pantalla eres tú.
  traducir(uid: string, desde: string): string {
    if (uid.startsWith('jugador-')) return `remoto-${desde}`;
    if (uid === `remoto-${this.miRed}`) return this.jugador.uid;
    return uid;
  }

  // Pasar a espejo (los salvajes los lleva otro) o dejar de serlo (ahora los llevas tú: siguen donde estaban).
  ponerEspejo(si: boolean): void {
    if (si === this.espejo) return;
    this.espejo = si;
    if (si) return;
    this.miBall = null; this.capturadosFuera.clear();
    const num = (u: string) => Number(u.split('-').pop()) || 0;
    this.uid = Math.max(this.uid, ...this.salvajes.map(l => num(l.uid)));
    for (const l of this.salvajes) {
      l.remoto = undefined; l.meta = null; l.ruta = null;
      if (l.modo === 'pelear' && !l.rival) l.modo = 'volver';
      if (l.alfa) l.golpeAlfa = this.ahora + 3;
    }
    // Las rondas sin salvaje (los que cayeron mientras mandaba otro) vuelven a su tiempo; y el alfa, si no está.
    for (const r of this.mapa.salvajes) if (!this.salvajes.some(l => l.ronda === r)) this.reaparecer(r);
    if (this.mapa.alfa && !this.salvajes.some(l => l.alfa)) this.ponerAlfa();
  }

  // ---- Fotos: lo que el dueño del mapa manda de sus salvajes ----
  foto(): Foto {
    const r1 = (v: number) => Math.round(v * 10) / 10, mk = this.marca;
    return {
      s: this.salvajes.map(l => ({
        u: l.uid, li: l.linea, f: l.forma, n: l.nivel, sh: l.shiny || undefined, al: l.alfa || undefined, r: l.ronda ? this.mapa.salvajes.indexOf(l.ronda) : -1, c: l.casa,
        x: r1(l.x), y: r1(l.y), d: l.dir, an: l.anda, ps: Math.round(l.ps), hp: l.stats.hp, e: l.estado, m: l.muerto, b: l.enBall,
        te: l.natu, tr: l.natu === 'rara' ? [l.tabla.igual, l.tabla.fuerte, l.tabla.debil] : undefined, mo: l.modo, ri: l.rival?.uid ?? null, a: l.anim, aN: l.animN, aR: l.anim ? r1(Math.max(0, l.animHasta - this.ahora)) : 0,
        ln: l.lanza ? [l.lanza.id, r1(l.lanza.t1 - this.ahora), r1(l.lanza.t1 - l.lanza.t0), l.lanza.canal ? 1 : 0] : undefined,
      })),
      clima: this.clima ? { tipo: this.clima.tipo, resta: r1(this.clima.hasta - this.ahora), b: this.clima.base ? 1 : undefined } : null,
      marca: mk ? { id: mk.id ?? 0, x: r1(mk.x), y: r1(mk.y), dura: mk.t1 - mk.t0, resta: r1(mk.t1 - this.ahora), de: mk.de.uid } : null,
    };
  }
  // En espejo: los salvajes pasan a ser los de la foto (`desde`: el uid de red del dueño).
  aplicarFoto(f: Foto, desde: string): void {
    if (!this.espejo) return;
    const hay = new Set<string>();
    for (const [u, hasta] of this.capturadosFuera) if (this.ahora > hasta) this.capturadosFuera.delete(u);
    for (const s of f.s) {
      if (this.capturadosFuera.has(s.u)) continue;
      hay.add(s.u);
      let l = this.salvajes.find(q => q.uid === s.u);
      if (l && (l.linea !== s.li || l.forma !== s.f || l.nivel !== s.n || !!l.shiny !== !!s.sh)) { this.quitar(l); l = undefined; }
      if (!l) {
        l = this.crearLuchador('salvaje', s.li, s.n, s.x, s.y, undefined, s.f, !!s.sh, s.u);
        if (s.al) this.hacerAlfa(l);
        l.ronda = this.mapa.salvajes[s.r];
        l.remoto = { x: s.x, y: s.y, t: this.ahora, animN: s.aN };
        this.salvajes.push(l);
      }
      const rm = l.remoto ??= { x: s.x, y: s.y, t: this.ahora, animN: s.aN };
      rm.x = s.x; rm.y = s.y; rm.t = this.ahora;
      if (s.aN !== rm.animN) { rm.animN = s.aN; if (s.a) { l.anim = s.a; l.animN++; l.animHasta = this.ahora + s.aR; } }
      l.lanza = s.ln ? { id: s.ln[0], obj: null, t0: this.ahora + s.ln[1] - s.ln[2], t1: this.ahora + s.ln[1], canal: !!s.ln[3], tics: 1, hechos: 0 } : null;
      l.casa = s.c; l.dir = s.d; l.anda = s.an; l.ps = s.ps; l.stats = { ...l.stats, hp: s.hp }; l.modo = s.mo;
      if (!l.alfa) { l.natu = s.te; l.tabla = s.tr ? { nombre: NATURALEZAS.rara.nombre, igual: s.tr[0], fuerte: s.tr[1], debil: s.tr[2] } : tablaDe(s.te, Math.random); }
      if (s.e !== l.estado) { l.estado = s.e; l.estadoHasta = this.ahora + (s.e ? DURA_ESTADO[s.e] ?? 1 : 0); }
      if (s.m && !l.muerto) { l.muerto = true; if (this.objetivo === l) this.objetivo = null; }
      if (this.miBall !== l.uid) l.enBall = s.b;
      l.rival = s.ri ? this.luchador(this.traducir(s.ri, desde)) ?? null : null;
    }
    for (const l of [...this.salvajes]) if (!hay.has(l.uid)) this.quitar(l);
    // Clima del mapa y golpe anunciado del alfa.
    if (f.clima) {
      if (this.clima?.tipo !== f.clima.tipo) { this.emitir({ tipo: 'clima', clima: f.clima.tipo }); this.aviso(f.clima.b ? NOMBRE_CLIMA[f.clima.tipo] : `${NOMBRE_CLIMA[f.clima.tipo]} durante ${Math.round(f.clima.resta)} s`); }
      this.clima = { tipo: f.clima.tipo, hasta: this.ahora + f.clima.resta, base: !!f.clima.b };
    } else if (this.clima) { this.emitir({ tipo: 'clima', clima: null }); this.clima = null; }
    const mk = f.marca, de = mk && this.luchador(mk.de);
    if (mk && de && !this.marcasHechas.has(mk.id)) this.marca = { x: mk.x, y: mk.y, t0: this.ahora + mk.resta - mk.dura, t1: this.ahora + mk.resta, de, id: mk.id };
  }

  // ---- Lo que llega de los demás ----
  // Un golpe a uno de los tuyos (tu Pokémon o, si eres el dueño, un salvaje): uids ya traducidos.
  recibirGolpe(deUid: string, aUid: string, r: Golpe, efectos: { boosts?: Boosts; estado?: string; semilla?: boolean }[], mov?: string): void {
    const l = this.luchador(deUid) ?? null, t = this.luchador(aUid);
    if (!t || t.muerto || t.enBall || this.ajeno(t)) return;
    if (l?.rol === 'remoto' && t.rol === 'jugador' && !this.luchandoCon(l)) return;   // otro jugador solo te pega en un duelo
    if (l) { l.ultimoCombate = t.ultimoCombate = this.ahora; this.provocar(t, l); }
    if (this.bloquea(t, l, mov ? getMove(mov) : undefined)) return;
    if (r.falla) return;
    if (r.dano > 0) this.danar(t, r.dano, l);
    if (r.eficacia === 0 || t.muerto) return;
    for (const e of efectos) {
      if (e.boosts) this.cambiarStats(t, e.boosts);
      if (e.estado) this.ponerEstado(t, e.estado, false);
      if (e.semilla && l) this.sembrar(t, l);
    }
  }
  // Otro jugador le tira una Ball a uno de tus salvajes: dentro (se queda quieto), y luego si se queda o sale.
  recibirBall(aUid: string, dentro: boolean, ok: boolean | undefined, deUid: string): void {
    const t = this.salvajes.find(l => l.uid === aUid);
    if (this.espejo || !t || t.muerto) return;
    if (dentro) { t.enBall = true; t.meta = null; if (this.objetivo === t) this.objetivo = null; return; }
    if (ok) { t.muerto = true; this.quitar(t); this.reaparecer(t.ronda); return; }
    const de = this.luchador(deUid);
    if (de) this.escapaDeBall(t, de); else { t.enBall = false; t.sinCuraHasta = this.ahora + SIN_CURA_BALL; }
  }
  recibirClima(c: Clima): void { if (!this.espejo) this.ponerClima(c); }
  // El dueño avisa de que ha caído un salvaje al que le pegaste: tu parte de experiencia.
  recibirMuerte(m: Extract<Salida, { tipo: 'muere' }>): void {
    if (m.para.includes(this.miRed)) this.recompensa(m);
  }
}
