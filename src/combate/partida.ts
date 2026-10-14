// Partida del modo aventura (docs/GDD-combate.md): tus Pokémon (el que manejas y los capturados, que viven en el
// pueblo), lo que llevas en la mochila y la hora. Se guarda en localStorage aparte de la partida del pueblo.
// Cada Pokémon tiene su nivel, su experiencia, los movimientos que sabe y su barra de atajos (10 casillas:
// movimientos u objetos, colocados al gusto).
import { LINEAS } from '../data/pokedex';
import { ataqueBasico, aprendizaje, getMove } from '../data/movimientos';
import { MIN_DESMAYO, MIN_DIA, SEG_POR_MINUTO } from '../sim/World';
import { expDeNivel, formaDe, nivelPorExp } from './reglas';

export const CASILLAS = 10;
const CLAVE = 'pokemon-valley/aventura';
const VERSION = 1;

export type Atajo = { m: string } | { i: string } | null;
export interface Miembro {
  uid: number; linea: string; nivel: number; exp: number;
  movs: string[];              // movimientos que sabe, en el orden en que los aprendió
  barra: Atajo[];
  ps: number;                  // fracción de vida (0-1): se recupera sola fuera de combate
}
export interface Estado {
  version: number; uid: number;
  equipo: Miembro[]; activo: number;          // uid del que manejas
  items: Record<string, number>;
  dia: number; minuto: number;
  semilla: number;                            // del mundo: las zonas procedurales salen siempre igual (data/bosque.ts)
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

  static nueva(): Partida {
    const p = new Partida({ version: VERSION, uid: 1, equipo: [], activo: 0, items: { pokeball: 10, oran: 3 }, dia: 1, minuto: 8 * 60, semilla: Math.floor(Math.random() * 1e9) });
    const b = p.crear('bulbasaur', 1);
    p.estado.activo = b.uid;
    return p;
  }
  static cargar(): Partida | null {
    try {
      const e = JSON.parse(localStorage.getItem(CLAVE) ?? 'null') as Estado | null;
      if (!e || e.version !== VERSION || !e.equipo?.length) return null;
      return new Partida(e);
    } catch { return null; }
  }
  static borrar(): void { try { localStorage.removeItem(CLAVE); } catch { /* nada */ } }
  // Para el título: el que manejas, su nivel, cuántos tienes y el día.
  static resumen(): { nombre: string; nivel: number; equipo: number; dia: number } | null {
    const p = Partida.cargar();
    if (!p) return null;
    const m = p.activo;
    return { nombre: formaDe(m.linea, m.nivel).nombre, nivel: m.nivel, equipo: p.estado.equipo.length, dia: p.estado.dia };
  }
  guardar(): void { try { localStorage.setItem(CLAVE, JSON.stringify(this.estado)); } catch { /* sin almacenamiento: se juega igual */ } }

  get activo(): Miembro { return this.estado.equipo.find(m => m.uid === this.estado.activo) ?? this.estado.equipo[0]; }
  forma(m: Miembro) { return formaDe(m.linea, m.nivel); }

  // Un Pokémon nuevo en tu equipo (al empezar, o capturado): con su barra ya puesta (movimientos y, detrás, las Balls).
  crear(linea: string, nivel: number): Miembro {
    const f = formaDe(linea, nivel), movs = movsHasta(f.id, nivel);
    const barra: Atajo[] = Array.from({ length: CASILLAS }, () => null);
    movs.slice(0, CASILLAS - 2).forEach((m, i) => { barra[i] = { m }; });
    barra[CASILLAS - 2] = { i: 'pokeball' }; barra[CASILLAS - 1] = { i: 'oran' };
    const m: Miembro = { uid: this.estado.uid++, linea, nivel, exp: expDeNivel(linea, nivel), movs, barra, ps: 1 };
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
