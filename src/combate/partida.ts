// Partida del modo aventura (docs/GDD-combate.md): tus Pokémon (el que manejas y los capturados, que viven en el
// pueblo), lo que llevas en la mochila y la hora. Se guarda en localStorage aparte de la partida del pueblo.
// Cada Pokémon tiene su nivel, su experiencia, los movimientos que sabe y su barra de atajos (10 casillas:
// movimientos u objetos, colocados al gusto).
import { LINEAS } from '../data/pokedex';
import { ataqueBasico, aprendizaje, getMove, probMacho } from '../data/movimientos';
import { MIN_DESMAYO, MIN_DIA, SEG_POR_MINUTO } from '../sim/World';
import { expDeNivel, formaDe, nivelPorExp } from './reglas';
import { misionesDe, type EstadoMision, type Mision } from './misiones';

export const CASILLAS = 10;
// Probabilidad de que un salvaje salga shiny (la de los juegos desde la 6.ª generación).
export const PROB_SHINY = 1 / 4096;
// Piedra de hogar (como en el WoW): H, se canaliza unos segundos sin moverte ni recibir golpes y te lleva al pueblo.
export const HOGAR_CARGA = 8;          // s
export const HOGAR_CD = 5 * 60;        // s reales hasta poder usarla otra vez
const CLAVE = 'pokemon-valley/aventura';
// Equipables que se regalaron por error a todas las partidas (af959147): se retiran al cargar (los equipables solo se
// encuentran jugando, combate/objetos.ts).
const REGALO: Record<string, number> = { leftovers: 1, focussash: 1 };
const VERSION = 1;

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
  objeto?: string;             // objeto equipado (combate/objetos.ts): se pone y se quita en el inventario (I)
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
  regalo?: boolean;                           // recibió el regalo de equipables por error: se le retira al cargar
  vuelos?: Record<string, { x: number; y: number; u: number; v: number }>;   // puntos de vuelo descubiertos: por zona, dónde está su volador (px y fracción de la zona)
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
    const p = new Partida({ version: VERSION, uid: 1, ...(usuario ? { usuario } : {}), equipo: [], activo: 0, items: { pokeball: 10, oran: 3 }, dia: 1, minuto: 8 * 60, semilla: Math.floor(Math.random() * 1e9), misiones: {}, alfas: {} });
    const b = p.crear(LINEAS[inicial] ? inicial : 'bulbasaur', 1);
    p.estado.activo = b.uid;
    return p;
  }
  static cargar(): Partida | null {
    try {
      const e = JSON.parse(localStorage.getItem(CLAVE) ?? 'null') as Estado | null;
      if (!e || e.version !== VERSION || !e.equipo?.length) return null;
      e.misiones ??= {}; e.alfas ??= {};
      if (e.regalo) {   // quitar el regalo por error: de la mochila o, si lo lleva puesto, al Pokémon
        for (const [id, n] of Object.entries(REGALO)) for (let i = 0; i < n; i++) {
          if ((e.items[id] ?? 0) > 0) e.items[id]--;
          else { const m = e.equipo.find(q => q.objeto === id); if (m) delete m.objeto; }
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
        m.movs.push(mov);
        const libre = m.barra.findIndex(a => !a);
        if (libre >= 0) m.barra[libre] = { m: mov };
        av.push({ tipo: 'aprende', uid: m.uid, mov, casilla: libre });
      }
    }
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
  // Objeto equipado (inventario, I): el que llevaba vuelve a la mochila.
  equipar(m: Miembro, id: string): boolean {
    if (!this.gastar(id)) return false;
    this.desequipar(m);
    m.objeto = id;
    return true;
  }
  desequipar(m: Miembro): void {
    if (m.objeto) this.dar(m.objeto);
    delete m.objeto;
  }

  // Misiones del tablón (combate/misiones.ts).
  get misiones(): Mision[] { return misionesDe(this.estado.semilla); }
  estadoMision(m: Mision): EstadoMision {
    const s = this.estado.misiones?.[m.id];
    return !s ? 'nueva' : s.hecha ? 'hecha' : s.n >= m.n ? 'lista' : 'activa';
  }
  progresoMision(m: Mision): number { return Math.min(m.n, this.estado.misiones?.[m.id]?.n ?? 0); }
  aceptar(m: Mision): void { (this.estado.misiones ??= {})[m.id] ??= { n: 0 }; }
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
    for (const [id, n] of m.premio.items) this.dar(id, n);
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
