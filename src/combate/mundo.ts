// Simulación del modo aventura (docs/GDD-combate.md), sin Phaser: los Pokémon del mapa (tú, los salvajes y tus
// vecinos del pueblo), sus choques y su IA, los movimientos, las capturas, el clima, el alfa y la piedra de hogar.
// La escena (scenes/Aventura.ts) la avanza con `paso(dt, entrada)` y dibuja su estado; lo que hay que animar o avisar
// le llega como sucesos (`sacar()`). Está aparte para que, en multijugador, la pueda llevar el anfitrión.
// El tiempo es el suyo (`ahora`, s): solo corre en `paso`, así que con la escena en pausa no pasa nada.
import { ROW_FROM_ANGLE } from '../config';
import type { Alfa, MapaAventura, MapaId, Punto, Ronda } from '../data/bosque';
import { FORMAS } from '../data/pokedex';
import { ESPECIES } from '../data/especies';
import { BALL, ITEMS } from '../data/items';
import { alturaDe, getMove, tiposDe, type Boosts, type MoveData, type Stat6, type TypeName } from '../data/movimientos';
import type { LabelTone } from '../fx/stage';
import { dentroDe } from '../util';
import { HOGAR_CARGA, HOGAR_CD, Partida, movsHasta, tirarSexo, type Atajo, type Aviso, type Miembro, type Sexo } from './partida';
import type { Mision } from './misiones';
import { Rejilla } from './navegacion';
import {
  CLIMA_DE, CLIMA_TRAMO, COLOR_ESTADO, CORTO_ESTADO, DANO_ESTADO, DURA_BOOST, DURA_CLIMA, DURA_ESTADO, FIN_CLIMA, GCD, NOMBRE_CLIMA, NOMBRE_ESTADO, NOMBRE_STAT,
  TURNO, VEL_PARALIZADO, alcance, celeridad, curaClima, danaClima, enfriamiento, expPor, formaDe, golpe, necesitaObjetivo, perfil, probCaptura, statsDe,
  velAndar, type Clima, type Golpe, type Perfil, type Stats,
} from './reglas';
import type { AnimId } from './sprites';

const VEL = 84;                    // px/s del jugador
const ANCHO = 9;                   // medio ancho del cuerpo contra paredes
const ANCHO_NPC = 6;               // el de los demás Pokémon (salvajes y vecinos)
const CUBO = 64;                   // px de lado de los cubos de colisión
const TIRO = 150;                  // hasta dónde llega una Poké Ball
const RESPAWN = 40;                // s hasta que vuelve a salir un salvaje en su sitio
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
const IMPACTO_MAX = 2.5;           // s: si la animación de un movimiento no llega al golpe, se aplica igual

export type Temple = 'amistoso' | 'huidizo' | 'agresivo';
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
export interface Entrada { vx: number; vy: number }   // hacia dónde andas (-1…1 por eje)

// Un movimiento que se está lanzando (barra de lanzamiento) o canalizando (golpes por tics), docs/GDD-combate.md §3.2.
export interface Lanza { id: string; obj: Luchador | null; t0: number; t1: number; canal: boolean; tics: number; hechos: number }
const INTERRUMPIDO = 4;            // s que el movimiento cortado tarda en volver

// Lo que un movimiento cambia en alguien además del daño: stats o un estado.
interface Efecto { quien: Luchador; boosts?: Boosts; estado?: string }

export interface Luchador {
  uid: string; rol: 'jugador' | 'salvaje' | 'vecino' | 'remoto';   // remoto: otro jugador (multijugador)
  linea: string; nivel: number; miembro?: Miembro; ronda?: Ronda;
  dex: string; nombre: string; tipos: TypeName[];       // dex: el de su sprite (con `s` si es shiny)
  stats: Stats; ps: number; boosts: Boosts; boostHasta: Partial<Record<Stat6, number>>;
  estado: string | null; estadoHasta: number; ticEstado: number; toxN: number;
  x: number; y: number; dir: number; anda: boolean; alto: number;
  movs: string[]; cd: Record<string, number>; gcd: number;
  cdDura: Record<string, number>; gcdDura: number;   // lo que duró cada enfriamiento al ponerse (con la celeridad de entonces)
  lanza: Lanza | null;
  anim: AnimId | null; animHasta: number; animN: number; quietoHasta: number;   // animN: cuenta las que se ponen
  temple: Temple; modo: 'pasear' | 'huir' | 'pelear' | 'volver'; casa: Punto; meta: Punto | null; espera: number;
  huirHasta: number; ultimoCombate: number; rival: Luchador | null;
  muerto: boolean; enBall: boolean;
  ruta: Punto[] | null; rutaA: Punto | null; rutaT: number; atasco: number;   // camino que sigue (navegacion.ts), hacia dónde y cuándo se calculó
  forma?: string;                      // forma fija (el alfa); si no, la de su nivel
  alfa?: boolean; escala: number; golpeAlfa: number;
  sexo: Sexo;                          // ♂/♀/sin sexo: el de tu equipo lo guarda; un salvaje lo tira al salir
  shiny?: boolean;
  remoto?: { x: number; y: number; t: number; animN: number };   // a dónde va (lo último que ha llegado de la red) y cuándo llegó
  golpeadores?: Set<string>;           // uids de los jugadores (tú o remotos) que le han hecho daño: se reparten la experiencia
}

// Lo que manda cada jugador por la red (scenes/Aventura.ts) para que los demás lo vean.
export interface EstadoRemoto {
  uid: string; mapa: MapaId; x: number; y: number; dir: number; anda: boolean; dex: string; nombre: string; nivel: number;
  anim?: AnimId | null; animN?: number; animResta?: number;   // la animación de acción (golpe, disparo…): cuenta y lo que le queda (s)
  estado?: string | null;                                      // estado alterado (para su tinte y su ráfaga)
  semilla?: number;                                            // la de tu partida (la sala usa la del primero que entró)
  vida?: number;                                               // fracción de PS
  enMapa?: number;                                             // s que lleva en este mapa (el que más lleva es su dueño)
}

// ---- Multijugador cooperativo: manda el dueño del mapa ----
// En cada mapa, uno de los jugadores que están en él (el primero que entró en la sala) lleva a los salvajes: su IA, su
// vida, sus muertes y sus reapariciones. Los demás los tienen en modo espejo (`espejo`): los ven tal como llegan en las
// fotos (`foto`/`aplicarFoto`) y lo que les hacen se lo mandan al dueño (`Salida`). Cada jugador manda en su propio
// Pokémon: el daño que recibe se lo aplica él (`recibirGolpe`). La escena lleva los mensajes (src/combate/red.ts).
export type Salida =
  | { tipo: 'golpe'; de: string; a: string; mov: string; golpe: Golpe; efectos: { boosts?: Boosts; estado?: string }[] }
  | { tipo: 'ball'; a: string; dentro: boolean; ok?: boolean }
  | { tipo: 'muere'; a: string; para: string[]; linea: string; nivel: number; alfa: boolean; nombre: string }
  | { tipo: 'clima'; clima: Clima };
export interface FotoSalvaje {
  u: string; li: string; f?: string; n: number; sh?: boolean; al?: boolean; r: number; c: Punto;   // r: su ronda en el mapa (−1: ninguna)
  x: number; y: number; d: number; an: boolean; ps: number; hp: number; e: string | null; m: boolean; b: boolean;
  te: Temple; mo: Luchador['modo']; ri: string | null; a: AnimId | null; aN: number; aR: number;
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
  | { tipo: 'mov'; n: number; de: string; a: string; mov: string; golpe: Golpe; efectos: { uid: string; boosts?: Boosts; estado?: string }[] }
  | { tipo: 'ball'; n: number; item: string; a: string; x0: number; y0: number; x1: number; y1: number }
  | { tipo: 'ballFin'; n: number; ok: boolean | null }
  | { tipo: 'debilitado'; uid: string }
  | { tipo: 'clima'; clima: Clima | null }
  | { tipo: 'evoluciona'; antes: ReturnType<typeof formaDe>; aprende: string[] }
  | { tipo: 'ir'; mapa: MapaId; desde: MapaId | 'inicio' };

export interface OpcionesMundo {
  mapa: MapaAventura; partida: Partida; desde: MapaId | 'inicio';
  bloques: Bloque[]; agua: (x: number, y: number) => boolean; anatomia: Anatomia;
  probShiny: number; rnd?: () => number;
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
  ahora = 0;
  cambiando = false;                   // te vas del mapa (salida, debilitado o piedra de hogar)
  // Clima del mapa (Danza Lluvia, Día Soleado…): hasta cuándo dura; daña por turnos a quien no aguanta la arena o el granizo.
  // `base`: es el de la zona (MapaAventura.clima), que no daña; un movimiento de clima lo tapa mientras dura.
  clima: { tipo: Clima; hasta: number; base?: boolean } | null = null;
  // Golpe anunciado de un alfa: el círculo del suelo que se llena; al llenarse, daña a quien siga dentro.
  marca: { x: number; y: number; t0: number; t1: number; de: Luchador; id?: number } | null = null;
  // Piedra de hogar canalizándose (s de juego): la barra de lanzamiento la pinta el HUD.
  hogar: { t0: number; t1: number } | null = null;
  private readonly rnd: () => number;
  private readonly anatomia: Anatomia;
  private readonly agua: (x: number, y: number) => boolean;
  private cubos = new Map<number, Bloque[]>();   // bloques por cubo de CUBO px, para no recorrerlos todos
  private nav: Rejilla;
  private uid = 0;
  private n = 0;                       // numera movimientos y Balls en vuelo
  private lanzando = false;
  private climaTic = 0;
  private climaSorteo = 0;             // cuándo se vuelve a sortear el clima de la zona
  private sucesos: Suceso[] = [];
  private relojes: { t: number; fn: () => void }[] = [];
  private pendientes = new Map<number, { l: Luchador; id: string; t: Luchador; r: Golpe; ef: Efecto[]; hasta: number }>();
  // Multijugador: tu uid en la red, si los salvajes los lleva otro (espejo) y lo que hay que mandarle.
  miRed = '';
  espejo = false;
  private salidas: Salida[] = [];
  private capturadosFuera = new Map<string, number>();   // salvajes que has capturado tú: que no vuelvan con una foto vieja
  private miBall: string | null = null;                  // el salvaje que está en tu Ball (su enBall lo llevas tú)
  private marcasHechas = new Set<number>();

  constructor(o: OpcionesMundo) {
    this.mapa = o.mapa; this.partida = o.partida; this.probShiny = o.probShiny;
    this.rnd = o.rnd ?? Math.random; this.anatomia = o.anatomia; this.agua = o.agua;
    for (const b of o.bloques) this.meterBloque(b);
    this.nav = new Rejilla(this.mapa.W, this.mapa.H, (x, y) => this.pisable({ x, y }));
    const lleg = this.mapa.llegada[o.desde] ?? this.mapa.llegada.inicio!, act = this.partida.activo;
    this.jugador = this.crearLuchador('jugador', act.linea, act.nivel, lleg.x, lleg.y, act);
    this.jugador.ps = Math.max(1, Math.round(this.jugador.stats.hp * act.ps));
    this.jugador.dir = lleg.dir;
    for (const r of this.mapa.salvajes) this.salvajes.push(this.crearSalvaje(r));
    if (this.mapa.id === 'pueblo') this.crearVecinos();
    this.ponerAlfa();
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
    const f = forma ? FORMAS[forma] : formaDe(linea, nivel), sh = miembro?.shiny ?? shiny, dex = idSprite(f.dex, sh);
    const stats = statsDe(f.base, nivel), as = this.anatomia.alto(dex), escala = escalaEspecie(f.id, as);
    return {
      uid: fuera ? uid ?? '' : `${rol}-${++this.uid}`, rol, linea, nivel, miembro, dex, nombre: f.nombre, tipos: tiposDe(f.id),
      stats, ps: stats.hp, boosts: {}, boostHasta: {}, estado: null, estadoHasta: 0, ticEstado: 0, toxN: 0,
      x, y, dir: 0, anda: false, alto: Math.min(ALTO_MAX, as * escala),
      movs: miembro ? miembro.movs : movsHasta(f.id, nivel), cd: {}, gcd: 0, cdDura: {}, gcdDura: GCD, lanza: null, anim: null, animHasta: 0, animN: 0, quietoHasta: 0,
      temple: 'agresivo', modo: 'pasear', casa: { x, y }, meta: null, espera: rnd() * 2, huirHasta: 0, ultimoCombate: -99, rival: null,
      muerto: false, enBall: false, ruta: null, rutaA: null, rutaT: -99, atasco: 0, forma, escala, golpeAlfa: 0, shiny: sh,
      sexo: miembro ? miembro.sexo ?? null : tirarSexo(f.id, rnd),
    };
  }
  private formaL(l: Luchador) { return l.forma ? FORMAS[l.forma] : formaDe(l.linea, l.nivel); }
  private crearSalvaje(r: Ronda): Luchador {
    const l = this.crearLuchador('salvaje', r.linea, r.nivel, r.x, r.y, undefined, undefined, this.rnd() < this.probShiny);
    l.ronda = r;
    const t = this.rnd();
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
    this.despues(falta / 1000, () => { this.salvajes.push(this.crearAlfa(a)); this.aviso(`Ha vuelto el ${FORMAS[a.forma].nombre} alfa`); });
  }
  private crearAlfa(a: Alfa): Luchador {
    const l = this.crearLuchador('salvaje', a.linea, a.nivel, a.x, a.y, undefined, a.forma, this.rnd() < this.probShiny);
    this.hacerAlfa(l);
    l.golpeAlfa = this.ahora + 3;
    return l;
  }
  private hacerAlfa(l: Luchador): void {
    l.alfa = true; l.escala *= ALFA_ESCALA; l.temple = 'agresivo'; l.nombre += ' alfa';
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
      l.temple = 'amistoso';
      this.vecinos.push(l);
    });
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
    return [...this.salvajes, ...this.vecinos].filter(l => !l.muerto && !l.enBall && Math.abs(x - l.x) < Math.max(10, l.alto * 0.4) && y > l.y - l.alto - 4 && y < l.y + 6)
      .sort((a, b) => b.y - a.y)[0] ?? null;
  }
  // Tab: el salvaje más cercano que no sea el actual (en orden de distancia).
  siguienteObjetivo(): void {
    const p = this.jugador, vivos = this.salvajes.filter(l => !l.muerto && !l.enBall && Math.hypot(l.x - p.x, l.y - p.y) < 260)
      .sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y));
    if (!vivos.length) { this.aviso('No hay ningún salvaje cerca'); return; }
    const i = this.objetivo ? vivos.indexOf(this.objetivo) : -1;
    this.objetivo = vivos[(i + 1) % vivos.length];
  }

  // F / espacio (lejos del tablón): junto a uno de tus Pokémon del pueblo, convertirte en él.
  interactuar(): void {
    if (this.jugador.muerto) return;
    const p = this.jugador, v = this.vecinos.find(l => Math.hypot(l.x - p.x, l.y - p.y) < 32);
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
    return Math.max(g, Math.max(0, (l.cd[a.m] ?? 0) - this.ahora) / (l.cdDura[a.m] ?? enfriamiento(m)));
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
  usarMov(l: Luchador, id: string, obj: Luchador | null): boolean {
    const m = getMove(id), yo = l.rol === 'jugador';
    if (!m || l.muerto || l.enBall || this.cambiando) return false;
    if (l.estado === 'slp' || l.estado === 'frz') { if (yo) this.aviso(`${l.nombre} está ${NOMBRE_ESTADO[l.estado].toLowerCase()}`); return false; }
    if (l.lanza || l.gcd > this.ahora || (l.cd[id] ?? 0) > this.ahora) return false;
    const objetivo = necesitaObjetivo(m);
    if (objetivo) {
      if (!obj && yo) obj = this.objetivo = this.salvajes.filter(s => !s.muerto && !s.enBall).sort((a, b) => Math.hypot(a.x - l.x, a.y - l.y) - Math.hypot(b.x - l.x, b.y - l.y))[0] ?? null;
      if (!obj || obj.muerto || obj.enBall) { if (yo) this.aviso('Elige a quién (clic en un Pokémon o Tab)'); return false; }
      if (obj.rol === 'vecino') { if (yo) this.aviso(`${obj.nombre} es de los tuyos`); return false; }
      const d = Math.hypot(obj.x - l.x, obj.y - l.y), al = alcance(m) + Math.max(8, obj.alto * 0.3);
      if (d > al) { if (yo) this.aviso(`${m.nombre}: demasiado lejos`); return false; }
      this.mirarA(l, obj);
    }
    const pf = perfil(m), k = this.cel(l), blanco = objetivo ? obj! : l;
    l.gcd = this.ahora + (l.gcdDura = GCD / k);
    if (pf.lanza !== 'instant') {
      // Lanzado o canalizado: se queda quieto (moverse lo corta) y sale al acabar o, canalizado, por tics.
      const t = pf.t / k;
      l.lanza = { id, obj: objetivo ? blanco : null, t0: this.ahora, t1: this.ahora + t, canal: pf.lanza === 'canal', tics: pf.tics, hechos: 0 };
      l.meta = null;
      if (l.lanza.canal) {
        l.cd[id] = this.ahora + (l.cdDura[id] = pf.cd / k);
        if (l.estado === 'par' && this.rnd() < 0.25) { l.lanza = null; this.rotulo(l, '¡Paralizado!', 'bad'); return true; }
        if (blanco !== l) this.provocar(blanco, l);
      }
      this.reproducir(l, 'Charge', t);
      return true;
    }
    this.soltar(l, id, blanco, pf);
    return true;
  }
  // Sale el movimiento (instantáneo, o al acabar de lanzarlo): enfriamiento, animación y el golpe en su fotograma.
  private soltar(l: Luchador, id: string, blanco: Luchador, pf: Perfil): void {
    const m = getMove(id)!, k = this.cel(l);
    l.cd[id] = this.ahora + (l.cdDura[id] = pf.cd / k);
    const anim: AnimId = m.category === 'Status' ? 'Charge' : m.flags.includes('contact') ? 'Attack' : 'Shoot';
    this.reproducir(l, anim);
    l.quietoHasta = this.ahora + 0.35 + pf.agotado;
    // Agotado (Hiperrayo): un rato sin poder hacer nada.
    if (pf.agotado) { l.gcd = Math.max(l.gcd, this.ahora + pf.agotado); l.gcdDura = Math.max(l.gcdDura, pf.agotado); this.despues(0.5, () => this.rotulo(l, 'Agotado', 'weak')); }
    if (l.estado === 'par' && this.rnd() < 0.25) { this.rotulo(l, '¡Paralizado!', 'bad'); return; }
    if (blanco !== l) this.provocar(blanco, l);
    // El efecto sale en el fotograma del golpe de la animación (HitFrame), no antes.
    this.despues(Math.min(0.32, this.anatomia.anim(l.dex, anim)?.golpe ?? 0.2), () => this.lanzarMov(l, id, blanco));
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
        this.lanzarMov(l, c.id, o ?? l, parte);
      }
      if (c.hechos >= c.tics && l.lanza === c) l.lanza = null;
      else if (l.anim !== 'Charge' && l.anim !== 'Shoot') this.reproducir(l, 'Charge', c.t1 - this.ahora);
      return;
    }
    if (l.anim !== 'Charge') this.reproducir(l, 'Charge', Math.max(0.1, c.t1 - this.ahora));
    if (this.ahora < c.t1) return;
    l.lanza = null;
    if (lejos) { if (l.rol === 'jugador') this.aviso(`${m.nombre}: fuera de alcance`); return; }
    this.soltar(l, c.id, o ?? l, perfil(m));
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
  private lanzarMov(l: Luchador, id: string, t: Luchador, parte?: MoveData): void {
    const m = parte ?? getMove(id)!;
    if (l.muerto || this.cambiando) return;
    const r: Golpe = t === l ? { dano: 0, eficacia: 1, critico: false, falla: false } : golpe(m, l, t, this.clima?.tipo ?? null, this.rnd);
    const ef = this.efectos(m, l, t, r), n = ++this.n;
    this.pendientes.set(n, { l, id, t, r, ef, hasta: this.ahora + IMPACTO_MAX });
    this.emitir({ tipo: 'mov', n, de: l.uid, a: t.uid, mov: id, golpe: r, efectos: ef.map(e => ({ uid: e.quien.uid, boosts: e.boosts, estado: e.estado })) });
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
    if (t !== l) l.ultimoCombate = t.ultimoCombate = this.ahora;   // atacar (aunque falle) también es estar en combate
    // Lo que le pasa a quien no llevas tú (un remoto, o un salvaje en espejo) se lo aplica quien lo lleva.
    const ajeno = this.ajeno(t);
    if (ajeno) this.salir({ tipo: 'golpe', de: l.uid, a: t.uid, mov: id, golpe: r, efectos: ef.filter(e => e.quien === t).map(e => ({ boosts: e.boosts, estado: e.estado })) });
    if (r.falla) return;
    if (r.dano > 0) {
      // Los que hacen retroceder interrumpen: lo cortado tarda INTERRUMPIDO s en volver.
      if (!ajeno && t.lanza && perfil(m).interrumpe) {
        const c = t.lanza;
        if (!c.canal) { t.cd[c.id] = Math.max(t.cd[c.id] ?? 0, this.ahora + INTERRUMPIDO); t.cdDura[c.id] = INTERRUMPIDO; }
        this.cortarLanza(t, '¡Interrumpido!');
      }
      if (!ajeno) this.danar(t, r.dano, l);
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
    }
  }
  private danar(t: Luchador, n: number, de: Luchador | null): void {
    t.ps = Math.max(0, t.ps - n);
    if (de) t.ultimoCombate = de.ultimoCombate = this.ahora;
    if (de && (de.rol === 'jugador' || de.rol === 'remoto')) (t.golpeadores ??= new Set()).add(de.uid);   // el daño de estados o del clima no cuenta como combate
    if (t.rol === 'jugador' && this.hogar) this.cortarHogar('¡Te han interrumpido!');
    this.rotulo(t, `−${n}`, t.rol === 'jugador' ? 'bad' : 'neutral', 0, true);
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
  private curarEstado(l: Luchador): void {
    if (l.estado === 'slp' && l.anim === 'Sleep') l.animHasta = 0;
    l.estado = null; l.toxN = 0;
  }
  // Un salvaje al que le pegan reacciona según su temple: el tranquilo no pelea, el asustadizo huye y el peleón ataca.
  private provocar(t: Luchador, de: Luchador): void {
    if (t.rol !== 'salvaje' || t.muerto) return;
    if (t.temple === 'amistoso') { if (t.modo !== 'huir') { t.modo = 'huir'; t.huirHasta = this.ahora + 1.5; } return; }
    if (t.temple === 'huidizo') { t.modo = 'huir'; t.huirHasta = this.ahora + 4 + this.rnd() * 2; t.meta = null; return; }
    t.modo = 'pelear'; t.rival = de; t.meta = null;
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
  private reaparecer(r?: Ronda): void {
    if (r) this.despues(RESPAWN, () => this.salvajes.push(this.crearSalvaje(r)));
  }
  // Experiencia para el que manejas y, a veces, algo que suelta (bayas, alguna Ball).
  private recompensa(t: Pick<Luchador, 'linea' | 'nivel' | 'alfa' | 'nombre'>): void {
    const yo = this.partida.activo, exp = expPor(t.linea, t.nivel) * (t.alfa ? ALFA_VIDA : 1);
    this.rotulo(this.jugador, `+${exp} exp`, 'strong', 300);
    this.procesar(this.partida.ganarExp(yo, exp));
    const r = this.rnd();
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
      this.rotulo(this.jugador, lista ? '¡Misión cumplida!' : `${n}/${m.n}`, 'strong', 500);
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
    this.rotulo(this.jugador, `+${m.premio.exp} exp`, 'strong', 200);
    this.aviso(`Recompensa: ${m.premio.exp} exp, ${m.premio.items.map(([id, n]) => `${ITEMS[id]?.nombre ?? id} ×${n}`).join(', ')}`);
    this.procesar(this.partida.ganarExp(this.partida.activo, m.premio.exp));
    this.guardar();
  }
  private procesar(av: Aviso[]): void {
    // Si evoluciona, lo que aprende se cuenta en la cinemática (src/scenes/Evolucion.ts), no en avisos.
    const p = this.jugador, antes = formaDe(p.linea, p.nivel), evoluciona = av.some(a => a.tipo === 'evoluciona');
    for (const a of av) {
      if (a.tipo === 'nivel') {
        this.rotulo(p, `¡Nivel ${a.nivel}!`, 'strong', 600);
        p.nivel = a.nivel;
        const viejo = p.stats.hp;
        p.stats = statsDe(formaDe(p.linea, a.nivel).base, a.nivel);
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
    const p = this.jugador, m = p.miembro!, f = formaDe(m.linea, m.nivel), frac = p.ps / p.stats.hp;
    p.nivel = m.nivel; p.dex = idSprite(f.dex, m.shiny); p.nombre = f.nombre; p.tipos = tiposDe(f.id);
    p.stats = statsDe(f.base, m.nivel); p.ps = Math.max(1, Math.round(p.stats.hp * frac));
    const as = this.anatomia.alto(p.dex);
    p.escala = escalaEspecie(f.id, as); p.alto = Math.min(ALTO_MAX, as * p.escala);
    p.anim = null; p.animHasta = 0;
    this.emitir({ tipo: 'destello', uid: p.uid, ms: 300 });
  }
  // Te debilitas: fundido y vuelves al pueblo con la vida entera.
  private caer(): void {
    if (this.cambiando) return;
    this.aviso(`¡${this.jugador.nombre} se ha debilitado! Vuelves al pueblo.`);
    this.partida.activo.ps = 1;
    this.partida.guardar();
    this.ir('pueblo', 'inicio', 1.3);
  }

  // ---- Objetos ----
  usarItem(id: string): void {
    const l = this.jugador, def = ITEMS[id];
    if (!def || l.muerto || this.cambiando) return;
    if (this.partida.tiene(id) <= 0) { this.aviso(`No te quedan: ${def.nombre}`); return; }
    if (l.gcd > this.ahora || l.lanza) return;
    if (def.tipo === 'pokeball') { this.lanzarBall(id); return; }
    if (def.tipo === 'baya') {
      const cura = id === 'sitrus' ? 0.5 : id === 'oran' ? 0.3 : 0.15;
      if (l.ps >= l.stats.hp && !(id === 'lum' && l.estado)) { this.aviso('Tienes la vida entera'); return; }
      this.partida.gastar(id); l.gcd = this.ahora + (l.gcdDura = GCD);
      this.curar(l, Math.ceil(l.stats.hp * cura));
      this.reproducir(l, 'Charge', 0.4);
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
    this.lanzando = true; p.gcd = this.ahora + (p.gcdDura = GCD);
    this.mirarA(p, t); this.reproducir(p, 'Shoot', 0.35);
    const n = ++this.n;
    this.emitir({ tipo: 'ball', n, item: id, a: t.uid, x0: p.x, y0: p.y - 14, x1: t.x, y1: t.y - 6 });
    this.despues(VUELO_BALL, () => {
      if (t.muerto) { this.lanzando = false; this.emitir({ tipo: 'ballFin', n, ok: null }); return; }
      t.enBall = true; t.meta = null;
      if (this.objetivo === t) this.objetivo = null;
      if (this.espejo) { this.miBall = t.uid; this.salir({ tipo: 'ball', a: t.uid, dentro: true }); }
      this.despues(MENEOS_BALL, () => {
        this.lanzando = false;
        const atrapa = ESPECIES[t.linea]?.atrapa ?? 0.3, ok = this.rnd() < probCaptura(atrapa, BALL[id] ?? 1, t.ps, t.stats.hp, t.estado);
        this.emitir({ tipo: 'ballFin', n, ok });
        if (this.miBall === t.uid) { this.miBall = null; this.salir({ tipo: 'ball', a: t.uid, dentro: false, ok }); }
        if (ok) this.capturado(t, id);
        else {
          t.enBall = false;
          this.emitir({ tipo: 'destello', uid: t.uid, ms: 200 });
          this.aviso(`¡${t.nombre} ha salido de la ${ITEMS[id]?.nombre ?? 'Ball'}!`);
          this.provocar(t, p);
        }
      });
    });
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
      // El movimiento listo más fuerte (a veces uno de estado), si llega; si no, acercarse.
      const listos = l.movs.map(id => getMove(id)!).filter(m => m && (l.cd[m.id] ?? 0) <= this.ahora);
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
    if (l.muerto) return;
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
    for (const [s, h] of Object.entries(l.boostHasta) as [Stat6, number][]) if (this.ahora > h) { delete l.boosts[s]; delete l.boostHasta[s]; }
    // Solo se cura fuera de combate: nadie le persigue, lleva 6 s sin pegar ni recibir y no tiene un estado que dañe.
    if (!enCombate && this.ahora - l.ultimoCombate > 6 && !(l.estado && DANO_ESTADO[l.estado]) && l.ps < l.stats.hp) l.ps = Math.min(l.stats.hp, l.ps + l.stats.hp * CURA_FUERA * dt);
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
    this.ir('pueblo', 'inicio');
  }

  // ---- Cambiar de mapa (lo hace la escena) ----
  private ir(mapa: MapaId, desde: MapaId | 'inicio', tras = 0): void {
    this.cambiando = true;
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
    if (this.relojes.length) {
      const toca = this.relojes.filter(r => r.t <= this.ahora);
      if (toca.length) { this.relojes = this.relojes.filter(r => r.t > this.ahora); for (const r of toca) r.fn(); }
    }
    for (const [n, q] of this.pendientes) if (this.ahora >= q.hasta) this.impacto(n);
    if (this.partida.tick(dt)) this.aviso(`Amanece. Día ${this.partida.estado.dia}`);
    this.pasoClima();

    // Tú.
    const p = this.jugador;
    p.anda = false;
    if (!p.muerto && !this.cambiando && p.estado !== 'slp' && p.estado !== 'frz' && p.quietoHasta <= this.ahora && (e.vx || e.vy)) {
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
      if (!reflejo) { this.vivir(l, dt); this.pasoLanza(l); }
      if (l !== p && !reflejo) this.pensar(l, dt);
      if (!l.muerto && l.anim && this.ahora >= l.animHasta) l.anim = null;
    }
    if (this.objetivo && (this.objetivo.muerto || Math.hypot(this.objetivo.x - p.x, this.objetivo.y - p.y) > 400)) this.objetivo = null;
    this.pasoMarca();
    this.pasoHogar();
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
    l.nombre = e.nombre; l.dir = e.dir; l.anda = e.anda; l.estado = e.estado ?? null; l.ps = (e.vida ?? 1) * l.stats.hp;
    // Una animación nueva (su cuenta ha cambiado): se pone aquí con lo que le quedaba allí.
    const animN = e.animN ?? 0;
    if (l.remoto && animN !== l.remoto.animN && e.anim) { l.anim = e.anim; l.animN++; l.animHasta = ahora + (e.animResta ?? 0.4); }
    l.remoto = { x: e.x, y: e.y, t: ahora, animN };
    return l;
  }
  quitarRemoto(uid: string): void { this.remotos = this.remotos.filter(r => r.uid !== `remoto-${uid}`); }

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
        te: l.temple, mo: l.modo, ri: l.rival?.uid ?? null, a: l.anim, aN: l.animN, aR: l.anim ? r1(Math.max(0, l.animHasta - this.ahora)) : 0,
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
      l.casa = s.c; l.dir = s.d; l.anda = s.an; l.ps = s.ps; l.stats = { ...l.stats, hp: s.hp }; l.temple = s.te; l.modo = s.mo;
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
  recibirGolpe(deUid: string, aUid: string, r: Golpe, efectos: { boosts?: Boosts; estado?: string }[]): void {
    const l = this.luchador(deUid) ?? null, t = this.luchador(aUid);
    if (!t || t.muerto || t.enBall || this.ajeno(t)) return;
    if (l) { l.ultimoCombate = t.ultimoCombate = this.ahora; this.provocar(t, l); }
    if (r.falla) return;
    if (r.dano > 0) this.danar(t, r.dano, l);
    if (r.eficacia === 0 || t.muerto) return;
    for (const e of efectos) {
      if (e.boosts) this.cambiarStats(t, e.boosts);
      if (e.estado) this.ponerEstado(t, e.estado, false);
    }
  }
  // Otro jugador le tira una Ball a uno de tus salvajes: dentro (se queda quieto), y luego si se queda o sale.
  recibirBall(aUid: string, dentro: boolean, ok: boolean | undefined, deUid: string): void {
    const t = this.salvajes.find(l => l.uid === aUid);
    if (this.espejo || !t || t.muerto) return;
    if (dentro) { t.enBall = true; t.meta = null; if (this.objetivo === t) this.objetivo = null; return; }
    if (ok) { t.muerto = true; this.quitar(t); this.reaparecer(t.ronda); return; }
    t.enBall = false;
    const de = this.luchador(deUid);
    if (de) this.provocar(t, de);
  }
  recibirClima(c: Clima): void { if (!this.espejo) this.ponerClima(c); }
  // El dueño avisa de que ha caído un salvaje al que le pegaste: tu parte de experiencia.
  recibirMuerte(m: Extract<Salida, { tipo: 'muere' }>): void {
    if (m.para.includes(this.miRed)) this.recompensa(m);
  }
}
