// Comercio entre jugadores (multijugador, docs/GDD-combate.md § Comercio), como la ventana de comercio del WoW: T con
// otro jugador elegido le pides comerciar; él acepta con T (o rechaza con Esc). Cada uno pone lo que da (objetos de la
// mochila, Pokécoins y Pokémon de su equipo, salvo el que maneja) y pulsa Aceptar. Cualquier cambio en una de las dos
// ofertas quita los dos «aceptado». Con los dos aceptados se cierra en dos pasos para que nadie dé sin recibir:
//   el coordinador (el uid de red menor) manda «cierra» con las versiones de las dos ofertas y ya no puede cambiar la
//   suya; el otro, si sigue de acuerdo con esas versiones, hace el cambio y contesta «hecho»; con «hecho», el
//   coordinador hace el suyo. Si el otro había cambiado algo, su oferta nueva llega antes y el cierre se deshace.
// Sin Phaser: la escena le pasa los mensajes de la red (`recibir`) y le da cada fotograma (`paso`).
import { lineaValida, type Miembro, type Partida } from './partida';
import { ITEMS } from '../data/items';
import { FORMAS, type Forma } from '../data/pokedex';
import { getMove } from '../data/movimientos';

const CADUCA = 30;          // s que dura una petición sin respuesta
export const TRATO_LEJOS = 160;   // px: más lejos, se cancela (también al cambiar de mapa)
export const TRATO_POKES = 6;     // Pokémon que caben en una oferta
export const TRATO_OBJS = 12;     // clases de objeto que caben en una oferta

export type Fase = 'pide' | 'acepta' | 'rechaza' | 'cancela' | 'oferta' | 'listo' | 'nolisto' | 'cierra' | 'hecho';
export type MensajeTrato = { t: 'trato'; para: string; fase: Fase; nombre?: string; v?: number; a?: number; b?: number; items?: Record<string, number>; dinero?: number; pokes?: Miembro[] };
export interface OfertaAjena { v: number; items: Record<string, number>; dinero: number; pokes: Miembro[] }
export interface Trato {
  con: string; nombre: string;                    // uid de red y nombre de usuario del otro
  mia: { v: number; items: Record<string, number>; dinero: number; pokes: number[] };   // pokes: uids de tu equipo
  suya: OfertaAjena;
  listoYo: [number, number] | null;               // aceptaste [tu versión, la suya]
  listoEl: [number, number] | null;               // aceptó [su versión, la tuya]
  cerrando: boolean;                              // coordinador: «cierra» mandado, esperando «hecho»
}
// `evos`: los recibidos que han evolucionado por el intercambio (data/pokedex.ts `Forma.inter`), de qué forma a cuál y lo
// que aprenden (la escena les pone la cinemática); `de`: el uid de red de quien te lo da.
export interface Recibido { items: Record<string, number>; dinero: number; pokes: Miembro[]; evos?: { m: Miembro; de: Forma; a: Forma; aprende: string[] }[]; de?: string }

export class Tradeo {
  pide: { con: string; nombre: string; hasta: number } | null = null;     // tu petición, esperando respuesta
  pideDe: { de: string; nombre: string; hasta: number } | null = null;    // la de otro, esperando la tuya
  trato: Trato | null = null;
  private t = 0;
  private cierreT = 0;

  constructor(
    private readonly yo: string,                        // tu uid de red
    private readonly partida: () => Partida,
    private readonly enviar: (m: MensajeTrato) => void,
    private readonly aviso: (txt: string) => void,
    private readonly hecho: (r: Recibido, dados: Recibido) => void,
  ) {}

  private get coordino(): boolean { return !!this.trato && this.yo < this.trato.con; }
  private manda(fase: Fase, para: string, extra: Partial<MensajeTrato> = {}): void { this.enviar({ t: 'trato', para, fase, ...extra }); }

  // T: pedir comercio a `con` (o aceptar la petición que te han hecho).
  pedir(con: string, nombre: string, miNombre: string): void {
    if (this.pideDe) { this.aceptar(miNombre); return; }
    if (this.trato) { this.aviso('Ya estás comerciando'); return; }
    if (this.pide) { this.aviso('Ya has pedido comerciar: espera su respuesta'); return; }
    this.pide = { con, nombre, hasta: this.t + CADUCA };
    this.manda('pide', con, { nombre: miNombre });
    this.aviso(`Has pedido comerciar a ${nombre}`);
  }
  private aceptar(miNombre: string): void {
    const p = this.pideDe!;
    this.pideDe = null;
    if (this.trato) return;
    this.manda('acepta', p.de, { nombre: miNombre });
    this.abrir(p.de, p.nombre);
  }
  // Esc: rechazar la petición o cancelar el comercio (true si había algo).
  cancelar(): boolean {
    if (this.pideDe) { this.manda('rechaza', this.pideDe.de); this.pideDe = null; this.aviso('Has rechazado el comercio'); return true; }
    if (this.trato) { this.cerrar('Comercio cancelado'); return true; }
    if (this.pide) { this.manda('cancela', this.pide.con); this.pide = null; this.aviso('Has retirado tu petición de comercio'); return true; }
    return false;
  }
  // Se acaba sin cambio (cancelado aquí, lejos, otro mapa…): avisar al otro.
  cerrar(txt: string, avisar = true): void {
    const tr = this.trato;
    if (!tr) return;
    if (tr.cerrando && avisar) return;   // el otro puede estar haciendo ya el cambio: se espera a su «hecho»
    this.trato = null;
    if (avisar) this.manda('cancela', tr.con);
    this.aviso(txt);
  }
  private abrir(con: string, nombre: string): void {
    this.pide = null;
    this.trato = { con, nombre, mia: { v: 0, items: {}, dinero: 0, pokes: [] }, suya: { v: 0, items: {}, dinero: 0, pokes: [] }, listoYo: null, listoEl: null, cerrando: false };
    this.aviso(`Comerciando con ${nombre}`);
  }

  // ---- Tu oferta ----
  private puedeCambiar(): boolean { return !!this.trato && !this.trato.cerrando; }
  // Algo cambió en tu oferta: versión nueva, fuera los «aceptado» y se la mandas.
  private cambiada(): void {
    const tr = this.trato!, pa = this.partida();
    tr.mia.v++; tr.listoYo = null; tr.listoEl = null;
    const pokes = tr.mia.pokes.map(u => pa.estado.equipo.find(m => m.uid === u)).filter((m): m is Miembro => !!m);
    this.manda('oferta', tr.con, { v: tr.mia.v, items: { ...tr.mia.items }, dinero: tr.mia.dinero, pokes: JSON.parse(JSON.stringify(pokes)) });
  }
  ponerObjeto(id: string, n = 1): void {
    const tr = this.trato, pa = this.partida();
    if (!tr || !this.puedeCambiar()) return;
    const ya = tr.mia.items[id] ?? 0, k = Math.min(n, pa.tiene(id) - ya);
    if (k <= 0) return;
    if (!ya && Object.keys(tr.mia.items).length >= TRATO_OBJS) { this.aviso(`Caben ${TRATO_OBJS} objetos distintos`); return; }
    tr.mia.items[id] = ya + k;
    this.cambiada();
  }
  quitarObjeto(id: string, n = 1): void {
    const tr = this.trato;
    if (!tr || !this.puedeCambiar() || !tr.mia.items[id]) return;
    tr.mia.items[id] -= Math.min(n, tr.mia.items[id]);
    if (!tr.mia.items[id]) delete tr.mia.items[id];
    this.cambiada();
  }
  ponerPoke(uid: number): void {
    const tr = this.trato, pa = this.partida();
    if (!tr || !this.puedeCambiar() || tr.mia.pokes.includes(uid)) return;
    if (uid === pa.activo.uid) { this.aviso('No puedes dar el Pokémon que manejas'); return; }
    if (tr.mia.pokes.length >= TRATO_POKES) { this.aviso(`Caben ${TRATO_POKES} Pokémon`); return; }
    if (!pa.estado.equipo.some(m => m.uid === uid)) return;
    tr.mia.pokes.push(uid);
    this.cambiada();
  }
  quitarPoke(uid: number): void {
    const tr = this.trato;
    if (!tr || !this.puedeCambiar() || !tr.mia.pokes.includes(uid)) return;
    tr.mia.pokes = tr.mia.pokes.filter(u => u !== uid);
    this.cambiada();
  }
  // Pokécoins: `d` más (o menos), entre 0 y lo que tienes.
  dinero(d: number): void {
    const tr = this.trato;
    if (!tr || !this.puedeCambiar()) return;
    const n = Math.max(0, Math.min(this.partida().dinero, tr.mia.dinero + d));
    if (n === tr.mia.dinero) return;
    tr.mia.dinero = n;
    this.cambiada();
  }
  // Botón Aceptar: lo marca o lo quita.
  pulsarListo(): void {
    const tr = this.trato;
    if (!tr || tr.cerrando) return;
    if (tr.listoYo) { tr.listoYo = null; this.manda('nolisto', tr.con); return; }
    if (!this.hayAlgo()) { this.aviso('No hay nada que cambiar'); return; }
    tr.listoYo = [tr.mia.v, tr.suya.v];
    this.manda('listo', tr.con, { a: tr.mia.v, b: tr.suya.v });
    this.intentarCerrar();
  }
  private hayAlgo(): boolean {
    const tr = this.trato!, o = (x: { items: Record<string, number>; dinero: number; pokes: unknown[] }) => Object.keys(x.items).length > 0 || x.dinero > 0 || x.pokes.length > 0;
    return o(tr.mia) || o(tr.suya);
  }
  // ¿Los dos de acuerdo con las mismas versiones?
  private deAcuerdo(): boolean {
    const tr = this.trato!, y = tr.listoYo, e = tr.listoEl;
    return !!y && !!e && y[0] === tr.mia.v && y[1] === tr.suya.v && e[0] === tr.suya.v && e[1] === tr.mia.v;
  }
  private intentarCerrar(): void {
    const tr = this.trato!;
    if (!this.coordino || tr.cerrando || !this.deAcuerdo()) return;
    tr.cerrando = true; this.cierreT = this.t;
    this.manda('cierra', tr.con, { a: tr.mia.v, b: tr.suya.v });
  }

  // ---- Mensajes del otro ----
  recibir(m: MensajeTrato & { uid: string }): void {
    if (m.para !== this.yo) return;
    const de = m.uid, tr = this.trato?.con === de ? this.trato : null;
    switch (m.fase) {
      case 'pide':
        if (this.trato) { this.manda('rechaza', de); return; }
        if (this.pide?.con === de) { this.manda('acepta', de); this.abrir(de, m.nombre ?? 'Jugador'); return; }   // os pedís a la vez
        this.pideDe = { de, nombre: m.nombre ?? 'Jugador', hasta: this.t + CADUCA };
        this.aviso(`${this.pideDe.nombre} quiere comerciar contigo · T acepta, Esc rechaza`);
        return;
      case 'acepta':
        if (this.pide?.con === de && !this.trato) this.abrir(de, m.nombre ?? this.pide.nombre);
        return;
      case 'rechaza':
        if (this.pide?.con === de) { this.aviso(`${this.pide.nombre} no quiere comerciar`); this.pide = null; }
        return;
      case 'cancela':
        if (this.pideDe?.de === de) { this.pideDe = null; return; }
        if (tr) this.cerrar(`${tr.nombre} ha cancelado el comercio`, false);
        return;
    }
    if (!tr) return;
    switch (m.fase) {
      case 'oferta':
        tr.suya = { v: m.v ?? 0, items: limpiarItems(m.items), dinero: Math.max(0, Math.floor(m.dinero ?? 0)), pokes: (m.pokes ?? []).filter(p => lineaValida(p?.linea)).slice(0, TRATO_POKES) };
        tr.listoYo = null; tr.listoEl = null; tr.cerrando = false;
        return;
      case 'listo':
        tr.listoEl = [m.a ?? -1, m.b ?? -1];
        this.intentarCerrar();
        return;
      case 'nolisto':
        tr.listoEl = null; tr.cerrando = false;
        return;
      case 'cierra':   // eres el otro: si sigues de acuerdo con esas versiones, cambias y contestas
        if (this.coordino || !this.deAcuerdo() || m.a !== tr.suya.v || m.b !== tr.mia.v) return;
        this.manda('hecho', de, { a: m.a, b: m.b });
        this.cambiar();
        return;
      case 'hecho':   // devuelve las versiones de tu «cierra»: a = la tuya, b = la suya
        if (this.coordino && tr.cerrando && m.a === tr.mia.v && m.b === tr.suya.v) this.cambiar();
        return;
    }
  }

  // El cambio: das lo tuyo (lo que aún tengas) y recibes lo suyo.
  private cambiar(): void {
    const tr = this.trato!, pa = this.partida(), e = pa.estado;
    this.trato = null;
    const dados: Recibido = { items: {}, dinero: 0, pokes: [] };
    for (const [id, n] of Object.entries(tr.mia.items)) {
      const k = Math.min(n, pa.tiene(id));
      if (k > 0) { e.items[id] -= k; dados.items[id] = k; }
    }
    dados.dinero = Math.min(tr.mia.dinero, pa.dinero);
    e.dinero = pa.dinero - dados.dinero;
    for (const u of tr.mia.pokes) {
      const i = e.equipo.findIndex(m => m.uid === u);
      if (i < 0 || u === e.activo) continue;
      dados.pokes.push(e.equipo[i]);
      e.equipo.splice(i, 1);
    }
    const r: Recibido = { items: tr.suya.items, dinero: tr.suya.dinero, pokes: [], evos: [], de: tr.con };
    for (const [id, n] of Object.entries(r.items)) pa.dar(id, n);
    pa.cobrar(r.dinero);
    for (const p of tr.suya.pokes) {
      const m: Miembro = { ...JSON.parse(JSON.stringify(p)), uid: e.uid++, nivel: Math.max(1, Math.min(100, Math.floor(p.nivel) || 1)) };
      if (m.forma && FORMAS[m.forma]?.linea !== m.linea) delete m.forma;   // una forma que no es de su línea no vale
      e.equipo.push(m);
      r.pokes.push(m);
      // Evolución por intercambio (Haunter → Gengar; con objeto si lo pide, que se gasta): al recibirlo, a cualquier nivel.
      const de = pa.forma(m), av = pa.evolucionarIntercambio(m);
      if (av) r.evos!.push({ m, de, a: pa.forma(m), aprende: av.filter(a => a.tipo === 'aprende').map(a => getMove((a as { mov: string }).mov)?.nombre ?? (a as { mov: string }).mov) });
    }
    pa.guardar();
    apuntar(tr.con, tr.nombre, dados);
    this.hecho(r, dados);
  }

  // Cada fotograma: caducar peticiones, quitar de tu oferta lo que ya no tienes y cancelar si el otro se va lejos.
  paso(dt: number, cerca: (con: string) => boolean): void {
    this.t += dt;
    if (this.pide && this.t > this.pide.hasta) { this.aviso(`${this.pide.nombre} no ha contestado`); this.pide = null; }
    if (this.pideDe && (this.t > this.pideDe.hasta || !cerca(this.pideDe.de))) this.pideDe = null;
    const tr = this.trato;
    if (!tr) return;
    if (!cerca(tr.con) && !tr.cerrando) { this.cerrar('Comercio cancelado: estáis demasiado lejos'); return; }
    if (tr.cerrando) {   // sin «hecho» en 30 s (se ha cortado del todo): se deshace el cierre
      if (this.t - this.cierreT > 30) { tr.cerrando = false; tr.listoYo = null; tr.listoEl = null; this.manda('nolisto', tr.con); }
      return;
    }
    const pa = this.partida();
    let cambio = false;
    for (const [id, n] of Object.entries(tr.mia.items)) if (n > pa.tiene(id)) { const k = pa.tiene(id); if (k > 0) tr.mia.items[id] = k; else delete tr.mia.items[id]; cambio = true; }
    const pokes = tr.mia.pokes.filter(u => u !== pa.activo.uid && pa.estado.equipo.some(m => m.uid === u));
    if (pokes.length !== tr.mia.pokes.length) { tr.mia.pokes = pokes; cambio = true; }
    if (tr.mia.dinero > pa.dinero) { tr.mia.dinero = pa.dinero; cambio = true; }
    if (cambio) this.cambiada();
  }
}

// Diario de lo que has dado en cada trato (los últimos DIARIO), en localStorage: el cierre en dos pasos tiene un hueco
// mínimo (si el coordinador cierra el juego entre su «cierra» y el «hecho» del otro, el otro da sin recibir) y con esto
// nada es irrecuperable: `JSON.parse(localStorage['pokemon-valley/tratos'])` en la consola.
export const CLAVE_TRATOS = 'pokemon-valley/tratos';
const DIARIO = 20;
function apuntar(con: string, nombre: string, dados: Recibido): void {
  try {
    const lista = (JSON.parse(localStorage.getItem(CLAVE_TRATOS) ?? '[]') as unknown[]).slice(-(DIARIO - 1));
    lista.push({ fecha: new Date().toISOString(), con, nombre, items: dados.items, dinero: dados.dinero, pokes: dados.pokes });
    localStorage.setItem(CLAVE_TRATOS, JSON.stringify(lista));
  } catch { /* sin almacenamiento: se juega igual */ }
}

function limpiarItems(o: Record<string, number> | undefined): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [id, n] of Object.entries(o ?? {})) if (ITEMS[id] && Number.isFinite(n) && n > 0) out[id] = Math.floor(n);
  return out;
}
