// Simulación pura del valle (sin Phaser): reloj, energía, inventario, recolectables en el suelo,
// plantas de bayas, caja de envío, almacén del pueblo, aldeanos, construcciones y guardado. Las escenas solo dibujan este estado y le envían
// comandos (GDD §16). Todo lo que cambia el estado pasa por aquí.

import { APARICIONES, BALL, BAYAS_SALVAJES, ITEMS, PRECIO_RECURSO } from '../data/items';
import { ESPECIES, ORDEN_VISITAS, PROB_EVOLUCIONADO, SALVAJES, type Recurso } from '../data/especies';
import { LINEAS, NIVEL_MAX, expNivel, forma, stats, type Stats } from '../data/pokedex';
import { BAYAS_PLATO, CONSTRUIBLES, EDIFICIO, ENERGIA_PLATO, MEJORAS_CASA } from '../data/edificios';
import { rng } from '../util';

export const T = 24;
export const MIN_DIA = 6 * 60;          // despertar a las 6:00
export const MIN_DESMAYO = 26 * 60;     // a las 2:00 el Pokémon se desmaya
export const SEG_POR_MINUTO = 0.5;      // 1 minuto de juego = 0,5 s reales: de las 6:00 a las 2:00 (20 h) son 10 minutos
// Cuánto ha caído la noche (0-1): atardecer desde las 18:00, noche cerrada a las 21:00.
export const oscuridad = (minuto: number) => Math.min(1, Math.max(0, (minuto - 18 * 60) / 180));
// Color de la luz ambiente a lo largo del día (minuto de juego → RGB), interpolado entre estas horas:
// alba lila, amanecer rosado, mañana cálida, mediodía blanco, tarde dorada, atardecer naranja, anochecer, hora azul, noche.
const CIELO: [number, [number, number, number]][] = [
  [5 * 60, [60, 72, 122]], [6 * 60, [118, 108, 158]], [6 * 60 + 40, [236, 168, 162]], [7 * 60 + 30, [255, 214, 178]],
  [9 * 60, [255, 244, 228]], [10 * 60 + 30, [255, 255, 255]], [16 * 60, [255, 255, 255]], [17 * 60 + 30, [255, 236, 196]],
  [18 * 60 + 45, [255, 190, 140]], [19 * 60 + 30, [226, 140, 128]], [20 * 60 + 15, [140, 118, 164]], [21 * 60, [92, 98, 150]],
  [22 * 60, [64, 78, 126]], [26 * 60, [56, 68, 116]],
];
export function luzAmbiente(minuto: number): [number, number, number] {
  const k = CIELO.findIndex(([m]) => m > minuto);
  if (k <= 0) return [...CIELO[k < 0 ? CIELO.length - 1 : 0][1]];
  const [m0, a] = CIELO[k - 1], [m1, b] = CIELO[k], u = (minuto - m0) / (m1 - m0), s = u * u * (3 - 2 * u); // suave en cada tramo
  return [0, 1, 2].map(i => Math.round(a[i] + (b[i] - a[i]) * s)) as [number, number, number];
}
// Farolas (0-1): se encienden de 19:15 a 20:15 y se apagan de 6:15 a 7:15, ya con el sol fuera.
export const farolas = (minuto: number) =>
  minuto < 12 * 60 ? Math.min(1, Math.max(0, (7 * 60 + 15 - minuto) / 60)) : Math.min(1, Math.max(0, (minuto - (19 * 60 + 15)) / 60));
export const ENERGIA_MAX = 100;
export const COSTE_LATIGO = 2, COSTE_ARAR = 3;
export const MAX_SUELO = 14, APARICIONES_DIA = 6, SLOTS = 12, APILA = 99;
export const PLANTAS_SALVAJES = 10;
const FILA_SALVAJES = 5;                // las silvestres salen en filas de 5 (una baya por fila)
export const PROB_LLUVIA = 0.3;

export type Fase = 0 | 1 | 2 | 3 | 4 | 5; // 0 nada, 1 semilla, 2 brote, 3 alta, 4 flor, 5 bayas
export interface Slot { id: string; n: number }
export interface ItemSuelo { uid: number; id: string; tx: number; ty: number }
export interface Planta { uid: number; baya: string; fase: Fase; tx: number; ty: number; salvaje: boolean }
export interface Casilla { tx: number; ty: number }

// ---- Pueblo (GDD-pueblo.md §4): almacén de recursos y aldeanos con trabajo asignado ----
export type { Recurso };
export const RECURSOS: Recurso[] = ['madera', 'piedra', 'bayas', 'ladrillos', 'platos'];
export const cero = (): Record<Recurso, number> => ({ madera: 0, piedra: 0, bayas: 0, ladrillos: 0, platos: 0 });
export interface Punto { x: number; y: number }
// Sitio de trabajo: un árbol (madera), una roca (piedra), una planta de bayas (uid) o un edificio con puestos
// (uid de la construcción y `edif` su id: horno, guardería). x,y = donde se pone el aldeano.
export interface Tarea { tipo: 'arbol' | 'roca' | 'planta' | 'edificio'; x: number; y: number; uid?: number; edif?: string }
// 'visita' = visitante que entra hasta el sitio de espera; 'esperar' = espera su petición;
// 'irse' = a las 20:00 se va por el sur sin quedarse. 'comer' = al amanecer va al comedero a desayunar.
// 'salvaje' = ronda por el valle (Estado.salvajes); 'huir' = se escapa tras fallar una Ball.
export type Hacer = 'salvaje' | 'huir' | 'visita' | 'esperar' | 'irse' | 'llegar' | 'comer' | 'libre' | 'ir' | 'trabajar' | 'volver' | 'casa' | 'dormir';
export interface Aldeano {
  uid: number; especie: string; x: number; y: number;
  tarea: Tarea | null; hacer: Hacer;
  prog: number;                              // minutos de juego trabajados en la unidad actual
  carga: { r: Recurso; n: number } | null;   // lo que lleva al almacén
  comido: boolean;                           // ¿ha comido hoy? (sin comer trabaja a mitad de ritmo)
  objetivo?: number;                         // planta del prado que está recolectando ahora
  regando?: boolean;                         // el objetivo es una siembra que riega, no que cosecha
  pide?: { r: Recurso; n: number };          // si lo tiene, aún es visitante: se une al dárselo
  nido?: number;                             // uid de su nido (los de antes de los nidos duermen junto a la casa)
  nivel: number; exp: number;                // nivel 1-100 y experiencia total (data/pokedex.ts, GDD-pueblo §10)
  trabajado?: number;                        // minutos de juego trabajados hoy (al llegar a su jornada se cansa)
  festin?: boolean;                          // hoy ha desayunado un plato: doble de experiencia y +25 % de ritmo
  salvaje?: Ronda;                           // si lo tiene, aún es salvaje (está en Estado.salvajes, no en aldeanos)
}
// Pokémon salvaje (GDD-pueblo §12): pasea cerca de `casa`; `quieto` mientras está dentro de una Ball.
export interface Ronda { casa: Punto; destino: Punto | null; pausa: number; quieto?: boolean }
// Edificio construido por el jugador (data/edificios.ts). x,y = ancla del sprite en px de mundo.
export interface Construccion { uid: number; id: string; x: number; y: number }
// Visitante que se fue sin quedarse (GDD-pueblo §9.1): vuelve en cuanto se le pueda acoger o el día `vuelve`.
export interface Pendiente { especie: string; pide: { r: Recurso; n: number }; vuelve: number }
export type Coste = Partial<Record<Recurso, number>>;
export interface Lugares { almacen: Punto; casa: Punto; entrada: Punto }
export const MIN_TRABAJO = { arbol: 30, roca: 40, planta: 15 } as const; // minutos de juego por carga
export const MIN_A_CASA = 22 * 60;    // a las 22:00 los aldeanos se van a dormir
const VEL_ALDEANO = 46;               // px de mundo por segundo
const RADIO_PRADO = 6;                // casillas alrededor de la planta elegida donde recolecta
const MIN_RIEGO = 5;                  // minutos de juego que tarda en regar una siembra
const MIN_COMER = 20;                 // minutos de juego que pasa desayunando en el comedero
const HORAS_VISITA = [7, 18];         // de día, un visitante puede llegar al dar la hora (haya o no nido libre)
const MIN_IRSE = 20 * 60;             // a las 20:00 el visitante al que no has atendido se va
const DIAS_VUELTA = 2;                // un pendiente vuelve a probar a los 2 días (antes si ya se le puede acoger)
const MAX_PENDIENTES = 2;             // con 2 pendientes no llegan especies nuevas, solo vuelven ellos
// ---- Salvajes y Poké Balls (GDD-pueblo §12) ----
const PROB_SALVAJE_DIA = 0.5;         // al amanecer, probabilidad de que ronde uno
const PROB_SALVAJE_HORA = 0.15;       // y en cada hora de día, si no hay ninguno
const HUIR = 0.3;                     // tras fallar una Ball, probabilidad de que se escape
const LEJOS_SALVAJE = 10 * 24;        // aparece al menos a 10 casillas del almacén
const RADIO_RONDA = 3 * 24;           // pasea a como mucho 3 casillas de donde apareció
export const BALLS_INICIO = 3;        // Poké Balls con las que empiezas
// ---- Stats de trabajo (data/pokedex.ts, GDD-pueblo §10) ----
const NIVEL_LLEGADA = 5;              // nivel con el que llegan los visitantes (si su especie no dice otro)
const STAT_REF = 55;                  // Fuerza o Maña que trabaja a ritmo 1
const VEL_REF = 45;                   // Velocidad que anda a VEL_ALDEANO
const EXP_POR_MINUTO = 1;             // experiencia por cada minuto de trabajo terminado (tala, pico, cosecha, riego)
export const nivelLlegada = (especie: string) => ESPECIES[especie]?.nivel ?? NIVEL_LLEGADA;
export const statsDe = (a: Aldeano): Stats => stats(LINEAS[a.especie], a.nivel);
export const formaDe = (a: Aldeano) => forma(LINEAS[a.especie], a.nivel, true);   // la granja no comercia: Gengar por nivel
// Afinidad de la especie (data/especies.ts): su trabajo favorito lo hace al doble de ritmo.
// En un edificio con `tipo` (el horno, Fuego), la afinidad es por el tipo de su línea.
export const afin = (a: Aldeano, t: Tarea) => t.tipo === 'edificio' ? !!LINEAS[a.especie] && EDIFICIO[t.edif ?? '']?.tipo === LINEAS[a.especie].tipo
  : ESPECIES[a.especie]?.afinidad === t.tipo;
// Ritmo de trabajo: Fuerza (árbol, roca) o Maña (prado y edificios) frente a STAT_REF, por la afinidad
// y un 25 % más si hoy ha desayunado un plato.
export const ritmo = (a: Aldeano, t: Tarea) => (t.tipo === 'arbol' || t.tipo === 'roca' ? statsDe(a).fuerza : statsDe(a).mana) / STAT_REF
  * (afin(a, t) ? 2 : 1) * (a.festin ? 1.25 : 1);
// Carga: cuánto lleva por viaje al almacén (1 por cada 50).
export const capacidad = (a: Aldeano) => Math.max(1, Math.floor(statsDe(a).carga / 50));
// Aguante: minutos de trabajo al día antes de cansarse (5 h + 4 min por punto; un día entero como mucho).
export const jornada = (a: Aldeano) => Math.min(MIN_A_CASA - MIN_DIA, 300 + 4 * statsDe(a).aguante);
export const cansado = (a: Aldeano) => (a.trabajado ?? 0) >= jornada(a);
// Velocidad: px de mundo por segundo al andar.
export const velocidad = (a: Aldeano) => VEL_ALDEANO * Math.min(2.2, Math.sqrt(statsDe(a).velocidad / VEL_REF));
// Donde se pone un aldeano para recolectar una planta (a su derecha).
export const sitioPlanta = (p: { tx: number; ty: number }): Punto => ({ x: p.tx * T + T / 2 + 13, y: p.ty * T + 20 });
// Qué recurso da cada objeto al dejarlo en el almacén.
export function recursoDe(id: string): [Recurso, number] | null {
  if (id === 'palo' || id === 'palo_1') return ['madera', 1];
  if (id === 'tronco') return ['madera', 3];
  if (id === 'piedra' || id === 'piedra_1') return ['piedra', 1];
  if (ITEMS[id]?.tipo === 'baya') return ['bayas', 1];
  return null;
}

export interface Estado {
  version: 1;
  bebes?: true;               // partida con las formas bebé (Azurill, Pichu, Cleffa) en las líneas
  semilla: number;
  dia: number;
  minuto: number;             // minutos desde las 0:00 del día (360..1560)
  energia: number;
  dinero: number;             // Pokécoins (GDD-pueblo §2): las paga Pelipper por lo que dejas en su caja
  inventario: (Slot | null)[];
  caja: Slot[];               // objetos que Pelipper se lleva por la noche
  cajaR: Record<Recurso, number>; // recursos del almacén que Pelipper se lleva por la noche
  suelo: ItemSuelo[];
  plantas: Planta[];
  aradas: string[];           // "tx,ty"
  regadas: string[];          // casillas regadas hoy (la lluvia las riega todas)
  lluvia: boolean;            // ¿llueve hoy?
  uid: number;
  ultimoEnvio: number;        // Pokécoins ganadas la última noche (para el resumen)
  almacen: Record<Recurso, number>;
  aldeanos: Aldeano[];
  construcciones: Construccion[];
  ayuno: number;              // aldeanos que hoy no han desayunado (si hay alguno, no llegan visitantes)
  pendientes: Pendiente[];    // visitantes que se fueron y volverán
  salvajes: Aldeano[];        // Pokémon salvajes que rondan hoy por el valle (con `salvaje`)
  casa: number;               // nivel de la casa del jugador: 1 cama, 2 cocina, 3 ampliación (data/edificios.ts, MEJORAS_CASA)
}

export type Evento =
  | { tipo: 'recogido'; id: string; n: number }
  | { tipo: 'inventarioLleno' }
  | { tipo: 'sinEnergia' }
  | { tipo: 'cosecha'; baya: string; n: number }
  | { tipo: 'arado'; tx: number; ty: number }
  | { tipo: 'plantado'; baya: string }
  | { tipo: 'enviado'; id: string; n: number }
  | { tipo: 'regado'; casillas: string[] }
  | { tipo: 'nuevoDia'; dia: number; ingresos: number; desmayo: boolean; lluvia: boolean; sinComer: number; sinComedero: boolean; festin: number; visita?: string; idos: string[]; salvaje?: string }
  | { tipo: 'talado'; id: string }
  | { tipo: 'depositado'; r: Record<Recurso, number> }
  | { tipo: 'llegada'; especie: string }
  | { tipo: 'visita'; especie: string; vuelve: boolean }
  | { tipo: 'seVa'; especie: string }
  | { tipo: 'sinNido'; especie: string }
  | { tipo: 'unido'; especie: string; honor?: boolean }
  | { tipo: 'salvaje'; especie: string }
  | { tipo: 'atrapado'; especie: string; ball: string }
  | { tipo: 'escapa'; especie: string; ball: string; huye: boolean }
  | { tipo: 'sinBall'; especie: string }
  | { tipo: 'faltan'; especie: string; r: Recurso; n: number }
  | { tipo: 'entrega'; uid: number; r: Recurso; n: number }
  | { tipo: 'asignado'; uid: number; tarea: Tarea | null }
  | { tipo: 'construido'; id: string; uid: number }
  | { tipo: 'sinRecursos'; id: string; falta: Coste }
  | { tipo: 'mudanza'; especie: string }
  | { tipo: 'subeNivel'; uid: number; nivel: number }
  | { tipo: 'evoluciona'; uid: number; de: string; a: string }
  | { tipo: 'cansado'; uid: number }
  | { tipo: 'sobrante'; r: Record<Recurso, number> }
  | { tipo: 'puestoLleno'; id: string }
  | { tipo: 'cocinado'; n: number }
  | { tipo: 'noCocina'; falta: 'bayas' | 'energia' }
  | { tipo: 'mejoraCasa'; nivel: number }
  | { tipo: 'noMejora'; falta: Coste; pokecoins: number };

// Partida aparte para el mapa dibujo (otro mapa: posiciones de edificios y plantas distintas).
const CLAVE_GUARDADO = 'pokemon-valley/partida' + ((new URLSearchParams(location.search).get('mapa') || 'dibujo') === 'dibujo' ? '-dibujo' : '');
const clave = (tx: number, ty: number) => `${tx},${ty}`;

export class World {
  estado: Estado;
  // Casillas donde pueden aparecer cosas (césped libre, lejos de agua, camino, árboles y edificios).
  // Las calcula la escena a partir del terreno y se pasan al crear el mundo.
  private candidatos: Casilla[] = [];
  private rnd: () => number;
  private acumulado = 0;
  // Los pone la escena: dónde están el almacén, la casa y la entrada del valle, y si se puede pisar un punto.
  lugares: Lugares = { almacen: { x: 0, y: 0 }, casa: { x: 0, y: 0 }, entrada: { x: 0, y: 0 } };
  pasable: (x: number, y: number) => boolean = () => true;
  libre: (tx: number, ty: number) => boolean = () => true;   // casilla sin edificio (lo pone la escena)
  especies: string[] = [];   // especies con sprites cargados (las pone la escena)

  constructor(estado: Estado, candidatos: Casilla[]) {
    this.estado = estado;
    this.candidatos = candidatos;
    this.rnd = rng(estado.semilla + estado.dia * 7919);
  }

  // ---- Partida nueva / guardado ----
  // `nidos`: los que ya están hechos al empezar (los coloca la escena); `cerca`: el almacén (el huerto
  // silvestre sale a unos pasos de él).
  static nueva(candidatos: Casilla[], objetosMapa: { id: string; tx: number; ty: number }[], nidos: Punto[] = [], cerca?: Punto, semilla = Date.now() % 1e9): World {
    const e: Estado = {
      version: 1, bebes: true, semilla, dia: 1, minuto: MIN_DIA, energia: ENERGIA_MAX, dinero: 0, casa: 1,
      inventario: Array.from({ length: SLOTS }, () => null), caja: [], suelo: [], plantas: [], aradas: [], regadas: [], lluvia: false, uid: 1, ultimoEnvio: 0,
      almacen: cero(), aldeanos: [], construcciones: [], ayuno: 0, pendientes: [], cajaR: cero(), salvajes: [],
    };
    const w = new World(e, candidatos);
    w.anadir('pokeball', BALLS_INICIO);
    // Los items que trae el mapa pasan a ser recolectables del suelo.
    for (const o of objetosMapa) if (ITEMS[o.id]) w.ponerEnSuelo(o.id, o.tx, o.ty);
    for (const n of nidos) e.construcciones.push({ uid: e.uid++, id: 'nido', x: Math.round(n.x), y: Math.round(n.y) });
    w.crearPlantasSalvajes(cerca);
    w.aparecerRecolectables(APARICIONES_DIA + 2);
    return w;
  }

  static cargar(candidatos: Casilla[]): World | null {
    try {
      const txt = localStorage.getItem(CLAVE_GUARDADO);
      if (!txt) return null;
      const e = JSON.parse(txt) as Estado;
      if (e.version !== 1) return null;
      e.regadas ??= []; e.lluvia ??= false; // partidas de antes de la lluvia
      e.almacen ??= cero(); e.aldeanos ??= []; // partidas de antes del pueblo
      e.construcciones ??= []; e.ayuno ??= 0;                           // partidas de antes de construir
      e.pendientes ??= [];                                              // partidas de antes de que se fueran
      e.salvajes ??= [];                                                // de antes de los salvajes
      for (const a of e.aldeanos) { a.nivel ??= nivelLlegada(a.especie); a.exp ??= expNivel(LINEAS[a.especie].exp, a.nivel); } // de antes de los niveles
      e.cajaR ??= cero();                                               // partidas de antes de vender del almacén
      // De antes de los bebés: Marill, Pikachu y Clefairy suben al nivel de esa forma para no volverse Azurill, Pichu o Cleffa.
      if (!e.bebes) {
        for (const a of [...e.aldeanos, ...e.salvajes]) if (['marill', 'pikachu', 'clefairy'].includes(a.especie)) {
          const nv = LINEAS[a.especie].formas[1].nv;
          if (a.nivel < nv) { a.nivel = nv; a.exp = expNivel(LINEAS[a.especie].exp, nv); }
        }
        e.bebes = true;
      }
      e.almacen = { ...cero(), ...e.almacen }; e.cajaR = { ...cero(), ...e.cajaR }; e.casa ??= 1; // de antes de ladrillos, platos y mejoras
      return new World(e, candidatos);
    } catch { return null; }
  }

  static hayPartida(): boolean { return !!localStorage.getItem(CLAVE_GUARDADO); }
  static borrarPartida(): void { localStorage.removeItem(CLAVE_GUARDADO); }
  // Para el título: día y aldeanos de la partida guardada, sin cargarla entera.
  static resumenPartida(): { dia: number; aldeanos: number } | null {
    try {
      const e = JSON.parse(localStorage.getItem(CLAVE_GUARDADO) ?? 'null') as Partial<Estado> | null;
      return e ? { dia: e.dia ?? 1, aldeanos: e.aldeanos?.length ?? 0 } : null;
    } catch { return null; }
  }

  guardar(): void { localStorage.setItem(CLAVE_GUARDADO, JSON.stringify(this.estado)); }
  exportar(): string { return JSON.stringify(this.estado, null, 1); }

  // ---- Reloj ----
  // Avanza el tiempo; devuelve los eventos que ocurran (el desmayo de las 2:00).
  tick(dtSeg: number): Evento[] {
    const e = this.estado, h0 = Math.floor(e.minuto / 60);
    this.acumulado += dtSeg;
    while (this.acumulado >= SEG_POR_MINUTO) { this.acumulado -= SEG_POR_MINUTO; e.minuto++; }
    if (e.minuto >= MIN_DESMAYO) return [this.dormir(true)];
    const evs = [...this.tickAldeanos(dtSeg), ...this.tickSalvajes(dtSeg)], h = Math.floor(e.minuto / 60);
    // Al dar la hora, de día: si nadie pasa hambre, llega un visitante (nuevo o uno que vuelve).
    if (h !== h0 && h >= HORAS_VISITA[0] && h <= HORAS_VISITA[1] && !e.ayuno) evs.push(...this.llegaVisitante());
    // Y a veces aparece un salvaje (si no hay ya uno).
    if (h !== h0 && h >= HORAS_VISITA[0] && h <= HORAS_VISITA[1] && this.rnd() < PROB_SALVAJE_HORA) evs.push(...this.aparecerSalvaje());
    return evs;
  }

  // Minuto con fracción (el reloj avanza a saltos de un minuto; la luz, sin saltos).
  get minutoExacto(): number { return this.estado.minuto + this.acumulado / SEG_POR_MINUTO; }

  get hora(): string {
    const m = this.estado.minuto % (24 * 60);
    return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`;
  }

  // ---- Inventario ----
  anadir(id: string, n = 1): boolean {
    const inv = this.estado.inventario;
    let s = inv.find(x => x && x.id === id && x.n < APILA);
    if (!s) { const i = inv.indexOf(null); if (i < 0) return false; s = { id, n: 0 }; inv[i] = s; }
    s.n = Math.min(APILA, s.n + n);
    return true;
  }
  quitar(slot: number, n = 1): Slot | null {
    const s = this.estado.inventario[slot];
    if (!s) return null;
    s.n -= n;
    if (s.n <= 0) this.estado.inventario[slot] = null;
    return s;
  }

  // ---- Recolección ----
  ponerEnSuelo(id: string, tx: number, ty: number): void {
    this.estado.suelo.push({ uid: this.estado.uid++, id, tx, ty });
  }
  recoger(uid: number): Evento[] {
    const i = this.estado.suelo.findIndex(s => s.uid === uid);
    if (i < 0) return [];
    const it = this.estado.suelo[i];
    if (!this.anadir(it.id)) return [{ tipo: 'inventarioLleno' }];
    this.estado.suelo.splice(i, 1);
    return [{ tipo: 'recogido', id: it.id, n: 1 }];
  }

  ocupada(tx: number, ty: number): boolean {
    return this.estado.suelo.some(s => s.tx === tx && s.ty === ty) || this.estado.plantas.some(p => p.tx === tx && p.ty === ty);
  }
  // `aparte`: ni pegada a una planta (las ramas y piedras que aparecen no caen dentro de un huerto).
  private casillaLibre(aparte = false): Casilla | null {
    const pegada = (c: Casilla) => this.estado.plantas.some(p => Math.abs(p.tx - c.tx) <= 1 && Math.abs(p.ty - c.ty) <= 1);
    for (let i = 0; i < 40; i++) {
      const c = this.candidatos[Math.floor(this.rnd() * this.candidatos.length)];
      if (c && !this.ocupada(c.tx, c.ty) && !this.estado.aradas.includes(clave(c.tx, c.ty)) && this.libre(c.tx, c.ty) && !(aparte && pegada(c))) return c;
    }
    return null;
  }
  private aparecerRecolectables(n: number): void {
    const total = APARICIONES.reduce((a, [, p]) => a + p, 0);
    for (let k = 0; k < n && this.estado.suelo.length < MAX_SUELO; k++) {
      const c = this.casillaLibre(true); if (!c) break;
      let r = this.rnd() * total, id = APARICIONES[0][0];
      for (const [i, p] of APARICIONES) { if ((r -= p) <= 0) { id = i; break; } }
      this.ponerEnSuelo(id, c.tx, c.ty);
    }
  }
  // Las silvestres salen ordenadas, no sueltas por el mapa: filas de FILA_SALVAJES plantas seguidas (una
  // baya por fila), las filas juntas y con un pasillo de una casilla entre ellas, a unos pasos de `cerca`.
  // Si no cabe el huerto entero, filas sueltas; lo que aún falte, en casillas libres.
  private crearPlantasSalvajes(cerca?: Punto): void {
    const L = FILA_SALVAJES, nFilas = Math.ceil(PLANTAS_SALVAJES / L), ok = new Set(this.candidatos.map(c => clave(c.tx, c.ty)));
    const vale = (tx: number, ty: number) => ok.has(clave(tx, ty)) && !this.ocupada(tx, ty) && this.libre(tx, ty);
    const fila = (tx: number, ty: number) => Array.from({ length: L }, (_, i) => i).every(i => vale(tx + i, ty));
    const huerto = (tx: number, ty: number) => Array.from({ length: 2 * nFilas - 1 }, (_, k) => k).every(k => fila(tx, ty + k));
    // Inicios al azar (con la semilla); con `cerca`, primero los que quedan a 4-12 casillas de él.
    const inicios = this.candidatos.map(c => ({ c, r: this.rnd() })).sort((a, b) => a.r - b.r).map(o => o.c);
    if (cerca) {
      const d = (c: Casilla) => Math.hypot((c.tx + L / 2) * T - cerca.x, (c.ty + nFilas) * T - cerca.y) / T;
      inicios.sort((a, b) => +(d(a) < 4 || d(a) > 12) - +(d(b) < 4 || d(b) > 12));
    }
    const plantar = (tx: number, ty: number, n: number) => {
      const baya = BAYAS_SALVAJES[Math.floor(this.rnd() * BAYAS_SALVAJES.length)];
      for (let i = 0; i < n; i++) {
        const fase = (this.rnd() < 0.7 ? 5 : 3 + Math.floor(this.rnd() * 2)) as Fase;
        this.estado.plantas.push({ uid: this.estado.uid++, baya, fase, tx: tx + i, ty, salvaje: true });
      }
    };
    let quedan = PLANTAS_SALVAJES;
    const h = inicios.find(c => huerto(c.tx, c.ty));
    if (h) for (let k = 0; k < nFilas; k++) { const n = Math.min(L, quedan); plantar(h.tx, h.ty + 2 * k, n); quedan -= n; }
    while (quedan > 0) {
      const f = inicios.find(c => fila(c.tx, c.ty)); if (!f) break;
      const n = Math.min(L, quedan); plantar(f.tx, f.ty, n); quedan -= n;
    }
    for (; quedan > 0; quedan--) { const c = this.casillaLibre(); if (!c) break; plantar(c.tx, c.ty, 1); }
  }

  // ---- Látigo Cepa sobre una casilla: cosecha si hay bayas maduras ----
  latigo(tx: number, ty: number): Evento[] {
    const e = this.estado;
    const p = e.plantas.find(q => q.tx === tx && q.ty === ty);
    if (!p || p.fase < 5) return [];
    if (e.energia < COSTE_LATIGO) return [{ tipo: 'sinEnergia' }];
    const n = 2 + Math.floor(this.rnd() * 2);
    if (!this.anadir(p.baya, n)) return [{ tipo: 'inventarioLleno' }];
    e.energia -= COSTE_LATIGO;
    if (p.salvaje) p.fase = 3; else e.plantas.splice(e.plantas.indexOf(p), 1);
    return [{ tipo: 'cosecha', baya: p.baya, n }];
  }
  // Arar solo ocurre al sembrar (la tierra aparece bajo la semilla).
  private arar(tx: number, ty: number, puedeArar: boolean): Evento[] {
    const e = this.estado;
    if (!puedeArar || this.ocupada(tx, ty) || e.aradas.includes(clave(tx, ty))) return [];
    if (e.energia < COSTE_ARAR) return [{ tipo: 'sinEnergia' }];
    e.energia -= COSTE_ARAR;
    e.aradas.push(clave(tx, ty));
    return [{ tipo: 'arado', tx, ty }];
  }

  // Sembrar la baya del slot elegido (acción: F / espacio / clic). Vale sobre tierra (`esTierra`, natural o
  // arada) y, si es césped libre (`puedeArar`), la casilla se convierte en tierra en el mismo gesto.
  plantar(tx: number, ty: number, slot: number, esTierra: boolean, puedeArar: boolean): Evento[] {
    const e = this.estado, s = e.inventario[slot];
    if (!s || ITEMS[s.id]?.tipo !== 'baya' || this.ocupada(tx, ty)) return [];
    const evs: Evento[] = [];
    if (!esTierra) {
      const ar = this.arar(tx, ty, puedeArar);
      if (!ar.some(v => v.tipo === 'arado')) return ar;
      evs.push(...ar);
    }
    const baya = s.id;
    this.quitar(slot);
    e.plantas.push({ uid: e.uid++, baya, fase: 1, tx, ty, salvaje: false });
    evs.push({ tipo: 'plantado', baya });
    if (e.lluvia) evs.push(...this.regar([clave(tx, ty)]));
    return evs;
  }

  // Regar casillas: la lluvia (todas) o un aldeano que riega (Marill) en su prado.
  regar(casillas: string[]): Evento[] {
    const nuevas = casillas.filter(k => !this.estado.regadas.includes(k));
    if (!nuevas.length) return [];
    this.estado.regadas.push(...nuevas);
    return [{ tipo: 'regado', casillas: nuevas }];
  }

  // ---- Látigo Cepa sobre un árbol o una roca: una rama o una piedra al inventario ----
  talar(tipo: 'arbol' | 'roca'): Evento[] {
    const e = this.estado;
    if (e.energia < COSTE_LATIGO) return [{ tipo: 'sinEnergia' }];
    const id = tipo === 'roca' ? 'piedra' : this.rnd() < 0.25 ? 'tronco' : 'palo';
    if (!this.anadir(id)) return [{ tipo: 'inventarioLleno' }];
    e.energia -= COSTE_LATIGO;
    return [{ tipo: 'talado', id }];
  }

  // ---- Almacén: el jugador deja ramas, troncos, piedras y bayas ----
  depositar(): Evento[] {
    const e = this.estado, r = cero();
    e.inventario.forEach((s, i) => {
      const rc = s && recursoDe(s.id);
      if (!s || !rc) return;
      r[rc[0]] += rc[1] * s.n; e.inventario[i] = null;
    });
    if (!RECURSOS.some(k => r[k])) return [];
    for (const k of RECURSOS) e.almacen[k] += r[k];
    return [{ tipo: 'depositado', r }];
  }

  // ---- Aldeanos ----
  // Llega un visitante (uno cada vez), haya o no nido libre (GDD-pueblo §9.1): entra por el camino
  // del sur y espera cerca de la entrada con su petición. Primero vuelve un pendiente al que ya se
  // puede acoger; si no, una especie nueva de ORDEN_VISITAS (si hay menos de MAX_PENDIENTES); si no,
  // un pendiente al que le toca volver. Si hay nido libre, queda reservado para él.
  llegaVisitante(): Evento[] {
    const e = this.estado;
    if (e.aldeanos.some(a => a.pide) || e.minuto >= MIN_IRSE) return [];
    const nueva = e.pendientes.length < MAX_PENDIENTES ? this.siguienteEspecie() : undefined;
    const p = e.pendientes.find(q => this.puedeAcoger(q.pide)) ?? (nueva ? undefined : e.pendientes.find(q => q.vuelve <= e.dia));
    const especie = p?.especie ?? nueva;
    if (!especie) return [];
    if (p) e.pendientes.splice(e.pendientes.indexOf(p), 1);
    const { entrada } = this.lugares, pide = { ...(p?.pide ?? ESPECIES[especie].pide!) }, nivel = nivelLlegada(especie);
    e.aldeanos.push({ uid: e.uid++, especie, x: entrada.x, y: entrada.y, tarea: null, hacer: 'visita', prog: 0, carga: null, comido: true, pide, nido: this.nidoLibre()?.uid,
      nivel, exp: expNivel(LINEAS[especie].exp, nivel) });
    return [{ tipo: 'visita', especie, vuelve: !!p }];
  }
  // La siguiente especie que aún no ha venido nunca (ni vive aquí ni está pendiente).
  siguienteEspecie(): string | undefined {
    const e = this.estado;
    return ORDEN_VISITAS.find(id => this.especies.includes(id) && !e.aldeanos.some(a => a.especie === id) && !e.pendientes.some(p => p.especie === id));
  }
  // ¿Se le podría acoger ya? Hace falta un nido libre (o el que tenga reservado) y lo que pide.
  puedeAcoger(pide: { r: Recurso; n: number }, nido?: number): boolean {
    return (nido !== undefined || !!this.nidoLibre()) && this.disponible(pide.r) >= pide.n;
  }
  // El visitante se va sin quedarse: pasa a pendientes y vuelve a probar en DIAS_VUELTA días (antes,
  // en cuanto se le pueda acoger). Su nido reservado queda libre.
  private despedir(a: Aldeano): void {
    const e = this.estado;
    e.aldeanos.splice(e.aldeanos.indexOf(a), 1);
    if (a.pide) e.pendientes.push({ especie: a.especie, pide: a.pide, vuelve: e.dia + DIAS_VUELTA });
  }
  get visitante(): Aldeano | undefined { return this.estado.aldeanos.find(a => a.pide); }
  get vecinos(): Aldeano[] { return this.estado.aldeanos.filter(a => !a.pide); }
  sitioEspera(): Punto { const n = this.lugares.entrada; return { x: n.x + 14, y: n.y - 34 }; }

  // Cuánto tienes de un recurso: el almacén más lo que llevas encima (un tronco vale 3 de madera).
  disponible(r: Recurso): number {
    return this.estado.almacen[r] + this.estado.inventario.reduce((t, s) => {
      const rc = s && recursoDe(s.id);
      return t + (s && rc && rc[0] === r ? rc[1] * s.n : 0);
    }, 0);
  }
  // Pagar n de un recurso: sale primero del almacén y luego del inventario (lo que sobre de un
  // tronco partido vuelve al almacén). Quien llama ya ha comprobado que hay bastante.
  private pagar(r: Recurso, n: number): void {
    const e = this.estado;
    let falta = n;
    const delAlmacen = Math.min(falta, e.almacen[r]);
    e.almacen[r] -= delAlmacen; falta -= delAlmacen;
    e.inventario.forEach((s, i) => {
      const rc = s && recursoDe(s.id);
      while (falta > 0 && s && rc && rc[0] === r && e.inventario[i]) {
        this.quitar(i); falta -= rc[1];
        if (falta < 0) { e.almacen[r] -= falta; falta = 0; }
      }
    });
  }
  // Lo que falta para pagar un coste (null si hay de todo).
  falta(coste: Coste): Coste | null {
    const f: Coste = {};
    for (const [r, n] of Object.entries(coste) as [Recurso, number][]) { const hay = this.disponible(r); if (hay < n) f[r] = n - hay; }
    return Object.keys(f).length ? f : null;
  }
  // Darle al visitante lo que pide. Si basta y tiene nido (reservado o uno libre), se une al pueblo.
  // Vale también mientras se va: se da la vuelta.
  atender(uid: number): Evento[] {
    const a = this.estado.aldeanos.find(q => q.uid === uid);
    if (!a?.pide) return [];
    // Si no tienes lo que pide, una Honor Ball lo convence igual (GDD-pueblo §12).
    const { r, n } = a.pide, hay = this.disponible(r), honor = hay < n ? this.estado.inventario.findIndex(s => s?.id === 'honorball') : -1;
    if (hay < n && honor < 0) return [{ tipo: 'faltan', especie: a.especie, r, n: n - hay }];
    const nido = a.nido ?? this.nidoLibre()?.uid;
    if (nido === undefined) return [{ tipo: 'sinNido', especie: a.especie }];
    if (honor >= 0) this.quitar(honor); else this.pagar(r, n);
    a.pide = undefined; a.nido = nido; a.hacer = 'llegar';
    return [{ tipo: 'unido', especie: a.especie, honor: honor >= 0 }];
  }

  // ---- Salvajes y Poké Balls (GDD-pueblo §12) ----
  // Aparece un salvaje (uno cada vez) lejos del almacén. Las especies que aún no viven en el pueblo
  // primero; entre ellas, las fáciles de atrapar salen más a menudo.
  aparecerSalvaje(especie?: string): Evento[] {
    const e = this.estado, opciones = SALVAJES.filter(id => this.especies.includes(id));
    if (e.salvajes.length || !opciones.length || e.minuto >= MIN_IRSE) return [];
    const nuevas = opciones.filter(id => !e.aldeanos.some(a => a.especie === id)), lista = nuevas.length ? nuevas : opciones;
    if (!especie || !opciones.includes(especie)) {
      let r = this.rnd() * lista.reduce((t, id) => t + (ESPECIES[id].atrapa ?? 0.5), 0);
      especie = lista.find(id => (r -= ESPECIES[id].atrapa ?? 0.5) <= 0) ?? lista[0];
    }
    const { almacen } = this.lugares;
    for (let i = 0; i < 60; i++) {
      const c = this.candidatos[Math.floor(this.rnd() * this.candidatos.length)];
      if (!c) break;
      const x = c.tx * T + T / 2, y = c.ty * T + T / 2;
      if (Math.hypot(x - almacen.x, y - almacen.y) < LEJOS_SALVAJE || !this.libre(c.tx, c.ty) || !this.pasable(x, y)) continue;
      // A veces ya evolucionado (Steelix, Tyranitar…): con el nivel de una de sus evoluciones, al azar.
      const evos = LINEAS[especie].formas.slice(1), evo = evos.length && this.rnd() < PROB_EVOLUCIONADO ? evos[Math.floor(this.rnd() * evos.length)] : null;
      const nivel = evo ? Math.min(NIVEL_MAX, evo.nv + Math.floor(this.rnd() * 5)) : nivelLlegada(especie);
      e.salvajes.push({ uid: e.uid++, especie, x, y, tarea: null, hacer: 'salvaje', prog: 0, carga: null, comido: true,
        nivel, exp: expNivel(LINEAS[especie].exp, nivel), salvaje: { casa: { x, y }, destino: null, pausa: 1 } });
      return [{ tipo: 'salvaje', especie }];
    }
    return [];
  }
  // Pasea despacio cerca de donde apareció, con paradas; si huye, se aleja y desaparece.
  private tickSalvajes(dt: number): Evento[] {
    const e = this.estado, fuera: Aldeano[] = [];
    for (const a of e.salvajes) {
      const s = a.salvaje!;
      if (s.quieto) continue;
      if (a.hacer === 'huir') { if (!s.destino || this.mover(a, s.destino, dt * 1.6)) fuera.push(a); continue; }
      if (s.pausa > 0) { s.pausa -= dt; continue; }
      if (!s.destino) {
        const ang = this.rnd() * Math.PI * 2, r = this.rnd() * RADIO_RONDA, d = { x: s.casa.x + Math.cos(ang) * r, y: s.casa.y + Math.sin(ang) * r };
        if (this.pasable(d.x, d.y)) s.destino = d; else s.pausa = 0.5;
        continue;
      }
      if (this.mover(a, s.destino, dt * 0.45)) { s.destino = null; s.pausa = 2 + this.rnd() * 5; }
    }
    for (const a of fuera) e.salvajes.splice(e.salvajes.indexOf(a), 1);
    return [];
  }
  // La Ball que se lanza: la que tengas en la mano o, si no, la más sencilla que lleves (nunca la Master Ball
  // si no la eliges). -1 si no llevas ninguna.
  ballALanzar(mano: number): number {
    const inv = this.estado.inventario, m = inv[mano];
    if (m && m.id in BALL) return mano;
    for (const id of Object.keys(BALL)) if (id !== 'masterball') { const i = inv.findIndex(s => s?.id === id); if (i >= 0) return i; }
    return -1;
  }
  // Mientras está dentro de la Ball (la animación del lanzamiento), no se mueve.
  encerrar(uid: number, si: boolean): void { const a = this.estado.salvajes.find(q => q.uid === uid); if (a?.salvaje) a.salvaje.quieto = si; }
  // Lanzar la Ball del hueco `slot` a un salvaje. Hace falta un nido libre (si no, no se gasta). Se queda
  // con probabilidad atrapa × Ball; si falla, la Ball se pierde y a veces huye (lejos de `desde`, el jugador).
  lanzar(uid: number, slot: number, desde: Punto): Evento[] {
    const e = this.estado, a = e.salvajes.find(q => q.uid === uid), ball = e.inventario[slot]?.id;
    if (!a?.salvaje) return [];
    a.salvaje.quieto = false;
    if (!ball || !(ball in BALL)) return [{ tipo: 'sinBall', especie: a.especie }];
    const nido = this.nidoLibre();
    if (!nido) return [{ tipo: 'sinNido', especie: a.especie }];
    this.quitar(slot);
    const evolucionado = formaDe(a) !== LINEAS[a.especie].formas[0]; // los evolucionados cuestan más
    if (this.rnd() < Math.min(1, (ESPECIES[a.especie]?.atrapa ?? 0.5) * BALL[ball] * (evolucionado ? 0.6 : 1))) {
      e.salvajes.splice(e.salvajes.indexOf(a), 1);
      a.salvaje = undefined; a.nido = nido.uid; a.hacer = 'llegar';
      e.aldeanos.push(a);
      return [{ tipo: 'atrapado', especie: a.especie, ball }];
    }
    const huye = this.rnd() < HUIR;
    if (huye) {
      const dx = a.x - desde.x, dy = a.y - desde.y, d = Math.hypot(dx, dy) || 1;
      a.hacer = 'huir'; a.salvaje.destino = { x: a.x + dx / d * 8 * T, y: a.y + dy / d * 8 * T };
    } else a.salvaje.pausa = 1.5;
    return [{ tipo: 'escapa', especie: a.especie, ball, huye }];
  }

  // ---- Construcción (data/edificios.ts) ----
  // La escena ya ha comprobado que el sitio es válido. Un nido nuevo es para quien aún no tenga
  // (aldeanos de partidas anteriores a los nidos); si nadie lo necesita, queda libre para un visitante.
  construir(id: string, x: number, y: number): Evento[] {
    const e = this.estado, def = EDIFICIO[id];
    if (!def) return [];
    const falta = this.falta(def.coste);
    if (falta) return [{ tipo: 'sinRecursos', id, falta }];
    for (const [r, n] of Object.entries(def.coste) as [Recurso, number][]) this.pagar(r, n);
    const c: Construccion = { uid: e.uid++, id, x: Math.round(x), y: Math.round(y) };
    e.construcciones.push(c);
    const evs: Evento[] = [{ tipo: 'construido', id, uid: c.uid }];
    for (let k = 0; k < (def.plazas ?? 0); k++) {
      const sinNido = e.aldeanos.find(a => !a.pide && a.nido === undefined); // el visitante lo coge al unirse
      if (!sinNido) break;
      sinNido.nido = c.uid; evs.push({ tipo: 'mudanza', especie: sinNido.especie });
    }
    return evs;
  }
  cuantos(id: string): number { return this.estado.construcciones.filter(c => c.id === id).length; }
  // Camas: un nido es una, un nido grande tres (data/edificios.ts, `plazas`).
  plazas(): number { return this.estado.construcciones.reduce((t, c) => t + (EDIFICIO[c.id]?.plazas ?? 0), 0); }
  private ocupantes(c: Construccion): Aldeano[] { return this.estado.aldeanos.filter(a => a.nido === c.uid); }
  nidoLibre(): Construccion | undefined {
    return this.estado.construcciones.find(c => this.ocupantes(c).length < (EDIFICIO[c.id]?.plazas ?? 0));
  }
  asignar(uid: number, tarea: Tarea | null): Evento[] {
    const a = this.estado.aldeanos.find(q => q.uid === uid);
    if (!a || a.pide) return [];
    if (tarea?.tipo === 'edificio') {
      const def = EDIFICIO[tarea.edif ?? ''], uid = tarea.uid;
      const dentro = this.estado.aldeanos.filter(q => q !== a && q.tarea?.tipo === 'edificio' && q.tarea.uid === uid);
      if (!def?.puestos) return [];
      if (dentro.length >= def.puestos) return [{ tipo: 'puestoLleno', id: def.id }];
      tarea = { ...tarea, x: tarea.x - 10 * (def.puestos - 1) + 20 * dentro.length }; // uno al lado del otro
    }
    a.tarea = tarea; a.prog = 0;
    if (a.hacer !== 'llegar' && a.hacer !== 'casa' && a.hacer !== 'dormir') a.hacer = a.carga ? 'volver' : tarea ? 'ir' : 'libre';
    return [{ tipo: 'asignado', uid, tarea }];
  }

  // Camina hacia un punto esquivando lo que no se puede pisar (desliza por los ejes); si no hay
  // forma, atraviesa (prototipo: no hay búsqueda de caminos). Devuelve true al llegar.
  private mover(a: Aldeano, d: Punto, dt: number): boolean {
    const dx = d.x - a.x, dy = d.y - a.y, dist = Math.hypot(dx, dy), paso = velocidad(a) * dt;
    if (dist <= paso) { a.x = d.x; a.y = d.y; return true; }
    const nx = a.x + dx / dist * paso, ny = a.y + dy / dist * paso;
    if (this.pasable(nx, ny)) { a.x = nx; a.y = ny; }
    else if (Math.abs(dx) > 1 && this.pasable(nx, a.y)) a.x = nx;
    else if (Math.abs(dy) > 1 && this.pasable(a.x, ny)) a.y = ny;
    else { a.x = nx; a.y = ny; }
    return false;
  }
  // Donde duerme: en su nido o, si no tiene, junto a la casa.
  private sitioCasa(a: Aldeano): Punto {
    const n = a.nido !== undefined && this.estado.construcciones.find(c => c.uid === a.nido);
    if (n && n.id === 'nidogrande') return { x: n.x - 16 + this.ocupantes(n).indexOf(a) * 16, y: n.y + 6 }; // delante de la entrada
    if (n) return { x: n.x, y: n.y - 5 };
    const i = this.estado.aldeanos.indexOf(a), c = this.lugares.casa;
    return { x: c.x + 18 + (i % 4) * 16, y: c.y + 10 + Math.floor(i / 4) * 12 };
  }
  // Su sitio detrás del comedero más cercano, mirando a cámara como si comiera del cajón (Eat solo
  // tiene la fila de frente); de cuatro en cuatro, y la siguiente fila un poco más atrás.
  sitioComedero(a: Aldeano): Punto | null {
    const cs = this.estado.construcciones.filter(c => c.id === 'comedero');
    if (!cs.length) return null;
    const c = cs.sort((p, q) => Math.hypot(p.x - a.x, p.y - a.y) - Math.hypot(q.x - a.x, q.y - a.y))[0];
    const i = Math.max(0, this.vecinos.indexOf(a));
    return { x: c.x - 15 + (i % 4) * 10, y: c.y - 12 - Math.floor(i / 4) * 6 };
  }
  // Delante del almacén más cercano: la mesa o uno construido (a la altura de su puerta).
  private sitioAlmacen(a: Aldeano): Punto {
    const i = this.estado.aldeanos.indexOf(a), d = (p: Punto) => Math.hypot(p.x - a.x, p.y - a.y);
    const c = [this.lugares.almacen, ...this.estado.construcciones.filter(q => q.id === 'almacen').map(q => ({ x: q.x, y: q.y - 6 }))]
      .sort((p, q) => d(p) - d(q))[0];
    return { x: c.x - 12 + (i % 3) * 12, y: c.y + 14 };
  }

  // Trabajo en una planta = recolectar en su prado: la planta madura más cercana a la elegida.
  private plantaMadura(a: Aldeano): Planta | null {
    const t = a.tarea, ancla = t && this.estado.plantas.find(q => q.uid === t.uid);
    if (!ancla) return null;
    const d = (p: Planta) => Math.hypot(p.tx - ancla.tx, p.ty - ancla.ty);
    return this.estado.plantas.filter(p => p.fase === 5 && d(p) <= RADIO_PRADO).sort((p, q) => d(p) - d(q))[0] ?? null;
  }

  // Lo sembrado (no salvaje) del prado que aún no se ha regado hoy, lo más cerca del aldeano.
  private siembraSeca(a: Aldeano): Planta | null {
    const t = a.tarea, ancla = t && this.estado.plantas.find(q => q.uid === t.uid);
    if (!ancla || !ESPECIES[a.especie]?.riega) return null;
    const r = this.estado.regadas, d = (p: Planta) => Math.hypot(p.tx * T - a.x, p.ty * T - a.y);
    return this.estado.plantas.filter(p => !p.salvaje && p.fase >= 1 && p.fase < 5 && !r.includes(clave(p.tx, p.ty))
      && Math.hypot(p.tx - ancla.tx, p.ty - ancla.ty) <= RADIO_PRADO).sort((p, q) => d(p) - d(q))[0] ?? null;
  }

  private tickAldeanos(dt: number): Evento[] {
    const e = this.estado, evs: Evento[] = [], dm = dt / SEG_POR_MINUTO, noche = e.minuto >= MIN_A_CASA, idos: Aldeano[] = [];
    for (const a of e.aldeanos) {
      if (a.hacer === 'dormir') continue;
      // A las 20:00, el visitante al que no has atendido se va por el sur (aún puedes darle lo que pide).
      if ((a.hacer === 'visita' || a.hacer === 'esperar') && e.minuto >= MIN_IRSE) { a.hacer = 'irse'; evs.push({ tipo: 'seVa', especie: a.especie }); }
      if (a.hacer === 'irse') { const n = this.lugares.entrada; if (this.mover(a, { x: n.x, y: n.y + T }, dt)) idos.push(a); continue; }
      if (a.hacer === 'esperar') continue;
      if (a.hacer === 'visita') { if (this.mover(a, this.sitioEspera(), dt)) a.hacer = 'esperar'; continue; }
      if (noche && a.hacer !== 'llegar' && a.hacer !== 'casa') {
        if (a.carga) { e.almacen[a.carga.r] += a.carga.n; a.carga = null; } // lo deja al pasar
        a.hacer = 'casa';
      }
      switch (a.hacer) {
        case 'llegar':
          if (this.mover(a, this.sitioAlmacen(a), dt)) { a.hacer = noche ? 'casa' : a.tarea ? 'ir' : 'libre'; evs.push({ tipo: 'llegada', especie: a.especie }); }
          break;
        case 'casa': if (this.mover(a, this.sitioCasa(a), dt)) a.hacer = 'dormir'; break;
        case 'comer': {
          const s = this.sitioComedero(a);
          if (!s) { a.hacer = a.tarea ? 'ir' : 'libre'; break; }
          if (this.mover(a, s, dt) && (a.prog += dm) >= MIN_COMER) { a.prog = 0; a.hacer = a.tarea ? 'ir' : 'libre'; }
          break;
        }
        case 'libre': break;
        case 'ir': {
          if (!a.tarea) { a.hacer = 'libre'; break; }
          if (cansado(a)) { a.hacer = a.carga ? 'volver' : 'casa'; break; }
          // En un prado, quien riega atiende antes lo sembrado sin regar; luego cosecha lo maduro.
          const seca = a.tarea.tipo === 'planta' ? this.siembraSeca(a) : null;
          const p = seca ?? (a.tarea.tipo === 'planta' ? this.plantaMadura(a) : null);
          if (this.mover(a, p ? sitioPlanta(p) : a.tarea, dt)) { a.hacer = 'trabajar'; a.objetivo = p?.uid; a.regando = !!seca; }
          break;
        }
        case 'trabajar': {
          const t = a.tarea;
          if (!t) { a.hacer = 'libre'; break; }
          if (t.tipo === 'edificio') { this.trabajarEdificio(a, t, dm, evs); break; }
          const p = t.tipo === 'planta' ? e.plantas.find(q => q.uid === (a.objetivo ?? t.uid)) : undefined;
          if (t.tipo === 'planta') {
            if (!e.plantas.some(q => q.uid === t.uid)) { a.tarea = null; a.hacer = 'libre'; a.regando = false; break; }
            if (a.regando) {
              if (!p) { a.regando = false; a.hacer = 'ir'; break; }
              if (this.cansarse(a, dm, evs)) break;
              a.prog += dm * (a.comido ? 1 : 0.5) * ritmo(a, t);
              if (a.prog < MIN_RIEGO) break;
              evs.push(...this.regar([clave(p.tx, p.ty)]), ...this.ganarExp(a, MIN_RIEGO));
              a.prog = 0; a.regando = false; a.hacer = 'ir';
              break;
            }
            if (!p || p.fase < 5) { // esta ya no tiene fruto: a por otra madura del prado (o a regar); si no, deja lo que lleve o espera
              if (this.plantaMadura(a) || this.siembraSeca(a)) a.hacer = 'ir';
              else if (a.carga) a.hacer = 'volver';
              break;
            }
          }
          if (this.cansarse(a, dm, evs)) break;
          a.prog += dm * (a.comido ? 1 : 0.5) * ritmo(a, t);
          if (a.prog < MIN_TRABAJO[t.tipo]) break;
          // Unidad terminada: a la carga y experiencia. Con la carga llena (Carga) vuelve al almacén;
          // si cabe más, sigue (en el prado, a por otra planta madura si la hay).
          const r: Recurso = p ? 'bayas' : t.tipo === 'arbol' ? 'madera' : 'piedra';
          if (p) { if (p.salvaje) p.fase = 3; else e.plantas.splice(e.plantas.indexOf(p), 1); }
          a.carga = { r, n: (a.carga?.r === r ? a.carga.n : 0) + (p ? 2 + Math.floor(this.rnd() * 2) : 1) };
          evs.push(...this.ganarExp(a, MIN_TRABAJO[t.tipo]));
          a.prog = 0;
          if (a.carga.n >= capacidad(a) || cansado(a)) a.hacer = 'volver';
          else if (p) a.hacer = this.plantaMadura(a) ? 'ir' : 'volver';
          break;
        }
        case 'volver':
          if (this.mover(a, this.sitioAlmacen(a), dt)) {
            if (a.carga) { e.almacen[a.carga.r] += a.carga.n; evs.push({ tipo: 'entrega', uid: a.uid, r: a.carga.r, n: a.carga.n }); }
            a.carga = null; a.hacer = cansado(a) ? 'casa' : a.tarea ? 'ir' : 'libre';
          }
          break;
      }
    }
    for (const a of idos) this.despedir(a);
    return evs;
  }
  // Dentro de un edificio (data/edificios.ts): el horno convierte lo del almacén en otra cosa que lleva al
  // almacén; la guardería solo da experiencia por el rato que pasa dentro. Si al horno le falta lo que gasta,
  // espera sin cansarse.
  private trabajarEdificio(a: Aldeano, t: Tarea, dm: number, evs: Evento[]): void {
    const e = this.estado, def = EDIFICIO[t.edif ?? ''];
    if (!def || !e.construcciones.some(c => c.uid === t.uid)) { a.tarea = null; a.hacer = 'libre'; return; }
    if (def.expMin) {
      if (this.cansarse(a, dm, evs)) return;
      a.prog += dm;
      if (a.prog >= 10) { evs.push(...this.ganarExp(a, 10 * def.expMin)); a.prog -= 10; }
      return;
    }
    const pr = def.produce;
    if (!pr || Object.entries(pr.de).some(([r, n]) => e.almacen[r as Recurso] < (n ?? 0))) return;
    if (this.cansarse(a, dm, evs)) return;
    a.prog += dm * (a.comido ? 1 : 0.5) * ritmo(a, t);
    if (a.prog < pr.min) return;
    for (const [r, n] of Object.entries(pr.de) as [Recurso, number][]) e.almacen[r] -= n;
    a.carga = { r: pr.a, n: (a.carga?.r === pr.a ? a.carga.n : 0) + pr.n };
    evs.push(...this.ganarExp(a, pr.min));
    a.prog = 0;
    if (a.carga.n >= capacidad(a) || cansado(a)) a.hacer = 'volver';
  }
  // ¿Está esperando en el horno a que haya material? (para dibujarlo quieto)
  esperaMaterial(a: Aldeano): boolean {
    const pr = a.tarea?.tipo === 'edificio' ? EDIFICIO[a.tarea.edif ?? '']?.produce : undefined;
    return !!pr && Object.entries(pr.de).some(([r, n]) => this.estado.almacen[r as Recurso] < (n ?? 0));
  }
  // Suma el rato trabajado a su jornada (Aguante); si se cansa, deja lo que estaba haciendo, lleva al
  // almacén lo que tenga y se va a dormir a su nido hasta mañana.
  private cansarse(a: Aldeano, dm: number, evs: Evento[]): boolean {
    a.trabajado = (a.trabajado ?? 0) + dm;
    if (!cansado(a)) return false;
    a.prog = 0; a.regando = false; a.hacer = a.carga ? 'volver' : 'casa';
    evs.push({ tipo: 'cansado', uid: a.uid });
    return true;
  }
  // Experiencia por trabajo terminado (los minutos que vale la unidad). Al llegar a la del nivel
  // siguiente sube, y si a ese nivel le toca otra forma de su línea, evoluciona (data/pokedex.ts).
  private ganarExp(a: Aldeano, minutos: number): Evento[] {
    const l = LINEAS[a.especie];
    if (!l || a.nivel >= NIVEL_MAX) return [];
    a.exp += Math.round(minutos * EXP_POR_MINUTO * (a.festin ? 2 : 1));
    const antes = forma(l, a.nivel, true), nv0 = a.nivel;
    while (a.nivel < NIVEL_MAX && a.exp >= expNivel(l.exp, a.nivel + 1)) a.nivel++;
    if (a.nivel === nv0) return [];
    const despues = forma(l, a.nivel, true), evs: Evento[] = [{ tipo: 'subeNivel', uid: a.uid, nivel: a.nivel }];
    if (despues.id !== antes.id) evs.push({ tipo: 'evoluciona', uid: a.uid, de: antes.nombre, a: despues.nombre });
    return evs;
  }

  // ---- Casa del jugador (F en la casa): dormir, cocinar y mejorarla (data/edificios.ts, MEJORAS_CASA) ----
  get energiaMax(): number { return this.estado.casa >= 3 ? 150 : ENERGIA_MAX; }
  get mejoraSiguiente() { return MEJORAS_CASA.find(m => m.nivel === this.estado.casa + 1); }
  mejorarCasa(): Evento[] {
    const e = this.estado, m = this.mejoraSiguiente;
    if (!m) return [];
    const falta = this.falta(m.coste);
    if (falta || e.dinero < m.pokecoins) return [{ tipo: 'noMejora', falta: falta ?? {}, pokecoins: Math.max(0, m.pokecoins - e.dinero) }];
    for (const [r, n] of Object.entries(m.coste) as [Recurso, number][]) this.pagar(r, n);
    e.dinero -= m.pokecoins; e.casa = m.nivel;
    if (m.nivel >= 3) e.energia += this.energiaMax - ENERGIA_MAX; // la energía de más, ya hoy
    this.guardar();
    return [{ tipo: 'mejoraCasa', nivel: m.nivel }];
  }
  // Cocinar hasta `n` guisos (cocina, nivel 2): cada uno gasta BAYAS_PLATO bayas (del almacén y lo que llevas)
  // y ENERGIA_PLATO de energía; el plato va al almacén, de donde se desayuna.
  cocinar(n: number): Evento[] {
    const e = this.estado;
    if (e.casa < 2) return [];
    let hechos = 0;
    while (hechos < n && this.disponible('bayas') >= BAYAS_PLATO && e.energia >= ENERGIA_PLATO) {
      this.pagar('bayas', BAYAS_PLATO); e.energia -= ENERGIA_PLATO; e.almacen.platos++; hechos++;
    }
    if (!hechos) return [{ tipo: 'noCocina', falta: this.disponible('bayas') < BAYAS_PLATO ? 'bayas' : 'energia' }];
    return [{ tipo: 'cocinado', n: hechos }];
  }

  // ---- Caja de envío ----
  enviar(slot: number): Evento[] {
    const s = this.estado.inventario[slot];
    if (!s) return [];
    const n = s.n;
    const c = this.estado.caja.find(x => x.id === s.id);
    if (c) c.n += n; else this.estado.caja.push({ id: s.id, n });
    this.estado.inventario[slot] = null;
    return [{ tipo: 'enviado', id: s.id, n }];
  }
  get valorCaja(): number {
    const e = this.estado;
    return e.caja.reduce((a, s) => a + (ITEMS[s.id]?.precio ?? 0) * s.n, 0) + RECURSOS.reduce((a, r) => a + e.cajaR[r] * PRECIO_RECURSO[r], 0);
  }
  // Pasar n de un recurso del almacén a la caja (n < 0: devolverlo de la caja al almacén). Devuelve lo movido.
  aCaja(r: Recurso, n: number): number {
    const e = this.estado, m = n > 0 ? Math.min(n, e.almacen[r]) : -Math.min(-n, e.cajaR[r]);
    e.almacen[r] -= m; e.cajaR[r] += m;
    return m;
  }
  // Lo que "Vender sobrante" deja en el almacén: lo justo para el edificio más caro, para lo que pide el
  // visitante o un pendiente, y dos desayunos por aldeano.
  reserva(r: Recurso): number {
    if (r === 'platos') return this.estado.almacen.platos; // los guisos son para desayunar: no se venden solos
    const e = this.estado, edif = Math.max(0, ...CONSTRUIBLES.map(d => d.coste[r] ?? 0));
    const pide = Math.max(0, ...[this.visitante?.pide, ...e.pendientes.map(p => p.pide)].map(p => p?.r === r ? p.n : 0));
    return edif + pide + (r === 'bayas' ? 2 * this.vecinos.length : 0);
  }
  sobrante(r: Recurso): number { return Math.max(0, this.estado.almacen[r] - this.reserva(r)); }
  venderSobrante(): Evento[] {
    const r = cero();
    for (const k of RECURSOS) r[k] = this.aCaja(k, this.sobrante(k));
    return [{ tipo: 'sobrante', r }];
  }

  // ---- Dormir / nuevo día ----
  dormir(desmayo = false): Evento {
    const e = this.estado;
    // El visitante al que no has atendido se va al caer la noche (antes de cambiar de día: vuelve en DIAS_VUELTA).
    const idos = e.aldeanos.filter(a => a.pide);
    for (const a of idos) this.despedir(a);
    const ingresos = this.valorCaja;
    e.dinero += ingresos; e.caja = []; e.cajaR = cero(); e.ultimoEnvio = ingresos;
    if (desmayo) e.dinero -= Math.min(1000, Math.floor(e.dinero * 0.1));
    e.dia++; e.minuto = MIN_DIA;
    e.energia = desmayo ? Math.floor(this.energiaMax * 0.6) : this.energiaMax;
    this.rnd = rng(e.semilla + e.dia * 7919);
    // Las plantas crecen una fase por día: las salvajes siempre (vuelven a dar fruto); las
    // sembradas solo si ese día se regaron (lluvia o Marill, GDD §3).
    for (const p of e.plantas) if (p.fase > 0 && p.fase < 5 && (p.salvaje || e.regadas.includes(clave(p.tx, p.ty)))) p.fase = (p.fase + 1) as Fase;
    this.aparecerRecolectables(APARICIONES_DIA);
    // La tierra se seca; si llueve, amanece regada (GDD §5: la lluvia riega sola).
    e.regadas = [];
    e.lluvia = this.rnd() < PROB_LLUVIA;
    if (e.lluvia) e.regadas = e.plantas.filter(p => !p.salvaje).map(p => clave(p.tx, p.ty));
    // Los aldeanos amanecen en su nido y, si hay comedero, van a desayunar una baya del almacén cada uno.
    let sinComer = 0, festin = 0;
    const comedero = this.cuantos('comedero') > 0;
    for (const a of e.aldeanos) {
      const c = this.sitioCasa(a); a.x = c.x; a.y = c.y; a.hacer = a.tarea ? 'ir' : 'libre'; // también quien aún iba llegando: es otro día
      a.regando = false;
      if (a.carga) { e.almacen[a.carga.r] += a.carga.n; a.carga = null; }
      a.prog = 0; a.trabajado = 0; // jornada nueva
      // Primero los guisos (festín: doble de experiencia y +25 % de ritmo hoy); si no, una baya.
      a.festin = comedero && e.almacen.platos > 0;
      if (a.festin) { e.almacen.platos--; festin++; }
      a.comido = a.festin || (comedero && e.almacen.bayas > 0);
      if (a.comido) { if (!a.festin) e.almacen.bayas--; a.hacer = 'comer'; } else sinComer++;
    }
    e.ayuno = sinComer;
    // Si nadie se ha quedado sin desayunar, al amanecer llega un visitante (nuevo o uno que vuelve).
    const visita = sinComer ? [] : this.llegaVisitante();
    // Los salvajes de ayer se fueron por la noche; a veces ronda uno nuevo.
    e.salvajes = [];
    const salvaje = this.rnd() < PROB_SALVAJE_DIA ? this.aparecerSalvaje() : [];
    this.guardar();
    return { tipo: 'nuevoDia', dia: e.dia, ingresos, desmayo, lluvia: e.lluvia, sinComer, sinComedero: !comedero && sinComer > 0, festin, visita: visita.length ? this.visitante?.especie : undefined, idos: idos.map(a => a.especie),
      salvaje: salvaje.length ? e.salvajes[0]?.especie : undefined };
  }
}
