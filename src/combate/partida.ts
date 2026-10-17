// Partida del modo aventura (docs/GDD-combate.md): tus Pokémon (el que manejas y los capturados, que viven en el
// pueblo), lo que llevas en la mochila y la hora. Se guarda en localStorage aparte de la partida del pueblo.
// Cada Pokémon tiene su nivel, su experiencia, los movimientos que sabe y su barra de atajos (10 casillas:
// movimientos u objetos, colocados al gusto).
import { EVO_OBJETO, LINEAS } from '../data/pokedex';
import { ataqueBasico, aprendizaje, getMove, probMacho } from '../data/movimientos';
import { MIN_DESMAYO, MIN_DIA, SEG_POR_MINUTO } from '../sim/World';
import { expDeNivel, formaDe, nivelPorExp } from './reglas';
import type { MapaId } from '../data/bosque';
import { misionesDe, tandaDelTablon, type EstadoMision, type Mision } from './misiones';
import { EQUIPABLES, SLOTS, slotIdx } from './objetos';


export const CASILLAS = 10;
export const HUECOS_OBJ = SLOTS.length;   // un hueco por ranura (combate/objetos.ts SLOTS): cabeza, cuerpo, arma, amuleto, accesorio
// Probabilidad de que un salvaje salga shiny (la de los juegos desde la 6.ª generación).
export const PROB_SHINY = 1 / 4096;
// Racha de derrotas (como el contador de KO de Espada/Escudo): cuantos más derrotas de una misma línea, más tiradas
// de shiny tiene cada uno de esa línea que aparece. [derrotas, tiradas], de menos a más.
export const RACHA_SHINY: [number, number][] = [[20, 2], [50, 3], [100, 5], [200, 8], [500, 12]];
export const tiradasRacha = (n: number) => RACHA_SHINY.reduce((t, [d, k]) => n >= d ? k : t, 1);
// Piedra de hogar (como en el WoW): H, se canaliza unos segundos sin moverte ni recibir golpes y te lleva al pueblo.
export const HOGAR_CARGA = 8;          // s
export const HOGAR_CD = 5 * 60;        // s reales hasta poder usarla otra vez
const CLAVE = 'pokemon-valley/aventura';
// Equipables que se regalaron por error a todas las partidas (af959147): se retiran al cargar (los equipables solo se
// encuentran jugando, combate/objetos.ts).
const REGALO: Record<string, number> = { leftovers: 1, focussash: 1 };
const VERSION = 1;
export const DINERO_INICIAL = 200;   // Pokécoins al empezar (y las partidas de antes de la tienda)

export type Sexo = 'm' | 'f' | null;
// Sexo de un Pokémon nuevo, con la proporción oficial de su forma (Showdown: data/gen/combate.json).
export function tirarSexo(forma: string, rnd = Math.random): Sexo {
  const p = probMacho(forma);
  return p < 0 ? null : rnd() < p ? 'm' : 'f';
}
export type Atajo = { m: string } | { i: string } | null;
export interface Miembro {
  uid: number; linea: string; nivel: number; exp: number;
  movs: string[];              // movimientos que sabe, en el orden en que los aprendió
  barra: Atajo[];
  ps: number;                  // fracción de vida (0-1): se recupera sola fuera de combate
  shiny?: boolean;             // va con el Pokémon, no con la forma: sigue siéndolo al evolucionar
  sexo?: Sexo;                 // ♂/♀ (null: sin sexo, como Magnemite); se tira al crearlo con la proporción oficial
  objetos?: (string | null)[]; // objetos equipados, HUECOS_OBJ huecos (combate/objetos.ts): se ponen y se quitan en el inventario (I)
  objeto?: string;             // partidas de antes de los dos huecos: pasa a objetos[0] al cargar
}
export interface Estado {
  version: number; uid: number;
  usuario?: string;                           // nombre de usuario (se pide al crear la partida; el multijugador lo enseña)
  equipo: Miembro[]; activo: number;          // uid del que manejas
  items: Record<string, number>;
  dia: number; minuto: number;
  semilla: number;                            // del mundo: las zonas procedurales salen siempre igual (data/bosque.ts)
  misiones?: Record<string, { n: number; hecha?: boolean }>;   // aceptadas en el tablón: lo que llevas (combate/misiones.ts)
  alfas?: Record<string, number>;             // por zona: cuándo cayó su alfa (Date.now()); reaparece a los 5 min
  hallados?: Record<string, { t: number; n: number }>;   // objetos del suelo (`zona:i`): cuándo lo cogiste (Date.now()) y cuántas veces
  hogar?: number;                             // Date.now() desde el que se puede volver a usar la piedra de hogar
  posada?: string;                            // zona de la posada donde fijaste la piedra de hogar (si no, el pueblo)
  regalo?: boolean;                           // recibió el regalo de equipables por error: se le retira al cargar
  dinero?: number;                            // Pokécoins: se ganan derrotando salvajes y se gastan en la tienda del pueblo
  derrotas?: Record<string, number>;          // por línea: cuántos has derrotado (racha de shiny, RACHA_SHINY)
  vuelos?: Record<string, { x: number; y: number; u: number; v: number }>;
  incubando?: number;                         // derrotas que lleva el primer huevo de la mochila (combate/gacha.ts HUEVO_DERROTAS)   // puntos de vuelo descubiertos: por zona, dónde está su volador (px y fracción de la zona)
}
export type Aviso =
  | { tipo: 'nivel'; uid: number; nivel: number }
  | { tipo: 'aprende'; uid: number; mov: string; casilla: number }
  | { tipo: 'evoluciona'; uid: number; de: string; a: string };

// Lo que sabe un Pokémon recién capturado (o un salvaje): su ataque básico y lo aprendido hasta su nivel; los de
// nivel 1 que no son el básico se aprenden al llegar a nivel 2 (empiezas solo con el básico).
export function movsHasta(forma: string, nv: number): string[] {
  const basico = ataqueBasico(forma), out = [basico];
  for (const [n, m] of aprendizaje(forma)) if ((n <= nv && (n > 1 || nv >= 2)) && !out.includes(m) && getMove(m)) out.push(m);
  return out;
}

export class Partida {
  estado: Estado;
  constructor(e: Estado) { this.estado = e; }

  // `inicial`: la línea elegida en scenes/Eleccion.ts (Bulbasaur si no se dice); `usuario`: el nombre que se pide después.
  static nueva(inicial = 'bulbasaur', usuario?: string): Partida {
    const p = new Partida({ version: VERSION, uid: 1, ...(usuario ? { usuario } : {}), equipo: [], activo: 0, items: { pokeball: 10, oran: 3 }, dinero: DINERO_INICIAL, dia: 1, minuto: 8 * 60, semilla: Math.floor(Math.random() * 1e9), misiones: {}, alfas: {} });
    const b = p.crear(LINEAS[inicial] ? inicial : 'bulbasaur', 1);
    p.estado.activo = b.uid;
    return p;
  }
  static cargar(): Partida | null {
    try {
      const e = JSON.parse(localStorage.getItem(CLAVE) ?? 'null') as Estado | null;
      if (!e || e.version !== VERSION || !e.equipo?.length) return null;
      e.misiones ??= {}; e.alfas ??= {}; e.dinero ??= DINERO_INICIAL;
      for (const m of e.equipo) if (m.objeto) { m.objetos = [m.objeto, null]; delete m.objeto; }   // de un hueco a dos
      // De dos huecos libres a uno por ranura: cada objeto va a la suya; si no cabe (o ya no existe), vuelve a la mochila.
      for (const m of e.equipo) if (m.objetos && m.objetos.length < HUECOS_OBJ) {
        const nuevo: (string | null)[] = Array(HUECOS_OBJ).fill(null);
        for (const id of m.objetos) {
          if (!id) continue;
          const i = EQUIPABLES[id] ? slotIdx(EQUIPABLES[id].slot) : -1;
          if (i >= 0 && !nuevo[i]) nuevo[i] = id; else e.items[id] = (e.items[id] ?? 0) + 1;
        }
        m.objetos = nuevo;
      }
      if (e.regalo) {   // quitar el regalo por error: de la mochila o, si lo lleva puesto, al Pokémon
        for (const [id, n] of Object.entries(REGALO)) for (let i = 0; i < n; i++) {
          if ((e.items[id] ?? 0) > 0) e.items[id]--;
          else { const m = e.equipo.find(q => q.objetos?.includes(id)); if (m) m.objetos![m.objetos!.indexOf(id)] = null; }
        }
        delete e.regalo;
      }
      for (const m of e.equipo) if (m.sexo === undefined) m.sexo = tirarSexo(formaDe(m.linea, m.nivel).id);   // partidas de antes
      return new Partida(e);
    } catch { return null; }
  }
  static borrar(): void { try { localStorage.removeItem(CLAVE); } catch { /* nada */ } }
  // Para el título: el que manejas, su nivel, cuántos tienes y el día.
  static resumen(): { nombre: string; nivel: number; equipo: number; dia: number; usuario?: string } | null {
    const p = Partida.cargar();
    if (!p) return null;
    const m = p.activo;
    return { nombre: formaDe(m.linea, m.nivel).nombre, nivel: m.nivel, equipo: p.estado.equipo.length, dia: p.estado.dia, usuario: p.estado.usuario };
  }
  // Cambia el nombre de usuario de la partida guardada (desde el título).
  static renombrar(usuario: string): void {
    const p = Partida.cargar();
    if (!p) return;
    p.estado.usuario = usuario;
    p.guardar();
  }
  guardar(): void { try { localStorage.setItem(CLAVE, JSON.stringify(this.estado)); } catch { /* sin almacenamiento: se juega igual */ } }

  // Partidas de antes del nombre de usuario: «Jugador».
  get usuario(): string { return this.estado.usuario ?? 'Jugador'; }
  get activo(): Miembro { return this.estado.equipo.find(m => m.uid === this.estado.activo) ?? this.estado.equipo[0]; }
  forma(m: Miembro) { return formaDe(m.linea, m.nivel); }

  // Un Pokémon nuevo en tu equipo (al empezar, o capturado): con su barra ya puesta (movimientos y, detrás, las Balls).
  crear(linea: string, nivel: number, shiny = false, sexo?: Sexo): Miembro {
    const f = formaDe(linea, nivel), movs = movsHasta(f.id, nivel);
    const barra: Atajo[] = Array.from({ length: CASILLAS }, () => null);
    movs.slice(0, CASILLAS - 2).forEach((m, i) => { barra[i] = { m }; });
    barra[CASILLAS - 2] = { i: 'pokeball' }; barra[CASILLAS - 1] = { i: 'oran' };
    const m: Miembro = { uid: this.estado.uid++, linea, nivel, exp: expDeNivel(linea, nivel), movs, barra, ps: 1, ...(shiny ? { shiny } : {}), sexo: sexo !== undefined ? sexo : tirarSexo(f.id) };
    this.estado.equipo.push(m);
    return m;
  }

  // Experiencia ganada: sube de nivel (varios a la vez si hace falta), aprende lo de cada nivel nuevo (y lo pone en la
  // primera casilla libre de la barra) y evoluciona al llegar al nivel de su forma siguiente.
  ganarExp(m: Miembro, n: number): Aviso[] {
    const av: Aviso[] = [];
    m.exp += n;
    const nuevo = Math.min(100, nivelPorExp(m.linea, m.exp));
    while (m.nivel < nuevo) {
      const antes = this.forma(m);
      m.nivel++;
      av.push({ tipo: 'nivel', uid: m.uid, nivel: m.nivel });
      const f = this.forma(m);
      if (f.id !== antes.id) av.push({ tipo: 'evoluciona', uid: m.uid, de: antes.nombre, a: f.nombre });
      for (const [nv, mov] of aprendizaje(f.id)) {
        if (m.movs.includes(mov) || !getMove(mov) || !(nv === m.nivel || (nv === 1 && m.nivel === 2) || (f.id !== antes.id && nv <= m.nivel))) continue;
        this.aprender(m, mov, av);
      }
    }
    return av;
  }
  private aprender(m: Miembro, mov: string, av: Aviso[]): void {
    m.movs.push(mov);
    const libre = m.barra.findIndex(a => !a);
    if (libre >= 0) m.barra[libre] = { m: mov };
    av.push({ tipo: 'aprende', uid: m.uid, mov, casilla: libre });
  }
  // La línea a la que pasaría con un objeto (Eevee + Piedra Agua → Vaporeon; data/pokedex.ts EVO_OBJETO), o nada.
  evoCon(m: Miembro, item: string): string | undefined { return EVO_OBJETO[m.linea]?.[item]; }
  // Evolucionar con un objeto: gasta el objeto y pasa a la otra línea con el mismo nivel. Aprende lo de la forma nueva
  // hasta su nivel que la de antes no aprende nunca (Pistola Agua, Niebla…): sus movimientos de nivel 1 repiten los de
  // Eevee y llenarían la barra.
  evolucionarCon(m: Miembro, item: string): Aviso[] | null {
    const dest = this.evoCon(m, item);
    if (!dest || !this.gastar(item)) return null;
    const antes = this.forma(m), suyos = new Set(aprendizaje(antes.id).map(([, mov]) => mov));
    m.linea = dest;
    m.exp = Math.max(m.exp, expDeNivel(dest, m.nivel));
    const f = this.forma(m), av: Aviso[] = [{ tipo: 'evoluciona', uid: m.uid, de: antes.nombre, a: f.nombre }];
    for (const [nv, mov] of aprendizaje(f.id)) if (nv <= m.nivel && !suyos.has(mov) && !m.movs.includes(mov) && getMove(mov)) this.aprender(m, mov, av);
    return av;
  }

  // Objetos de la mochila.
  tiene(id: string): number { return this.estado.items[id] ?? 0; }
  dar(id: string, n = 1): void { this.estado.items[id] = this.tiene(id) + n; }
  gastar(id: string): boolean {
    if (this.tiene(id) <= 0) return false;
    this.estado.items[id]--;
    return true;
  }
  // Pokécoins.
  get dinero(): number { return this.estado.dinero ?? 0; }
  cobrar(n: number): void { this.estado.dinero = this.dinero + n; }
  // Comprar `n` de un objeto a `precio` cada uno: falla si no llega el dinero.
  comprar(id: string, precio: number, n = 1): boolean {
    if (this.dinero < precio * n) return false;
    this.estado.dinero = this.dinero - precio * n;
    this.dar(id, n);
    return true;
  }
  // Objetos equipados (inventario, I): HUECOS_OBJ huecos; el que había en el hueco vuelve a la mochila.
  objetos(m: Miembro): (string | null)[] { return Array.from({ length: HUECOS_OBJ }, (_, i) => m.objetos?.[i] ?? null); }
  equipar(m: Miembro, id: string, hueco: number): boolean {
    if (hueco < 0 || hueco >= HUECOS_OBJ || slotIdx(EQUIPABLES[id]?.slot ?? 'cabeza') !== hueco || !EQUIPABLES[id] || !this.gastar(id)) return false;   // solo en su ranura
    this.desequipar(m, hueco);
    (m.objetos = this.objetos(m))[hueco] = id;
    return true;
  }
  desequipar(m: Miembro, hueco: number): void {
    const o = this.objetos(m), id = o[hueco];
    if (!id) return;
    this.dar(id);
    o[hueco] = null;
    m.objetos = o;
  }

  // Misiones del tablón (combate/misiones.ts).
  get misiones(): Mision[] { return misionesDe(this.estado.semilla); }
  // 'bayas': el progreso son las bayas que llevas en la mochila (se gastan al entregar).
  estadoMision(m: Mision): EstadoMision {
    const s = this.estado.misiones?.[m.id];
    return !s ? 'nueva' : s.hecha ? 'hecha' : this.progresoMision(m) >= m.n ? 'lista' : 'activa';
  }
  progresoMision(m: Mision): number { return Math.min(m.n, m.tipo === 'bayas' ? this.tiene(m.baya ?? '') : this.estado.misiones?.[m.id]?.n ?? 0); }
  // ¿Se ofrece? (las de una cadena, cuando la anterior está entregada)
  disponible(m: Mision): boolean { return !m.previa || !!this.estado.misiones?.[m.previa]?.hecha; }
  // Lo que ofrece ahora el tablón del mapa `en`: la tanda de 3 de su cadena que toca (y cuál es, de cuántas).
  tablon(en: MapaId): { tanda: Mision[]; n: number; de: number } { return tandaDelTablon(this.misiones, en, m => this.estadoMision(m) === 'hecha'); }
  aceptar(m: Mision): void { (this.estado.misiones ??= {})[m.id] ??= { n: 0 }; }
  // Uno más de la línea derrotado: devuelve las tiradas de shiny si con este sube de tramo (para avisar), o 0.
  derrotado(linea: string): number {
    const d = (this.estado.derrotas ??= {}), n = (d[linea] ?? 0) + 1;
    d[linea] = n;
    const t = tiradasRacha(n);
    return t > tiradasRacha(n - 1) ? t : 0;
  }
  // Probabilidad de shiny de un salvaje de la línea: `base` en cada tirada de su racha.
  probShiny(linea: string, base: number): number { return 1 - (1 - base) ** tiradasRacha(this.estado.derrotas?.[linea] ?? 0); }
  // Algo que cuenta para las misiones aceptadas (derrotar o capturar a uno de la línea, o derrotar al alfa de la zona).
  // Devuelve las que avanzan.
  contar(tipo: 'derrotar' | 'capturar' | 'alfa', linea: string, zona: string): Mision[] {
    const out: Mision[] = [];
    for (const m of this.misiones) {
      if (this.estadoMision(m) !== 'activa' || m.tipo !== tipo || (tipo === 'alfa' ? m.zona !== zona : m.linea !== linea)) continue;
      this.estado.misiones![m.id].n++;
      out.push(m);
    }
    return out;
  }
  // Entregar una misión lista: la recompensa (la experiencia la reparte quien llama, que sabe de avisos).
  entregar(m: Mision): boolean {
    if (this.estadoMision(m) !== 'lista') return false;
    this.estado.misiones![m.id].hecha = true;
    if (m.tipo === 'bayas') this.estado.items[m.baya!] = this.tiene(m.baya!) - m.n;
    for (const [id, n] of m.premio.items) this.dar(id, n);
    if (m.premio.oro) this.cobrar(m.premio.oro);
    return true;
  }

  // Reloj: el día va de las 6:00 a las 2:00 (10 minutos reales) y vuelve a amanecer.
  tick(dt: number): boolean {
    const e = this.estado;
    e.minuto += dt / SEG_POR_MINUTO;
    if (e.minuto < MIN_DESMAYO) return false;
    e.minuto = MIN_DIA; e.dia++;
    return true;
  }
}

export const lineaValida = (id: string) => !!LINEAS[id];
