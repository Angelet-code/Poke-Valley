// Acciones del juego y qué botón del mando lanza cada una (configurable en la pantalla «Mando» del título,
// scenes/ConfigMando.ts; se guarda en localStorage). Sin Phaser: lo usa también la simulación para los avisos.
// Cada acción tiene su tecla de teclado: el mando la lanza como tecla sintética (src/entrada/mando.ts).
// Código de botón: 0-15 de la disposición "standard" de la API Gamepad (0 abajo, 1 derecha, 2 izquierda, 3 arriba,
// 4 L1, 5 R1, 6 L2, 7 R2, 8 −, 9 +, 10 L3, 11 R3, 12-15 cruceta ↑ ↓ ← →); +MAS = con el botón «más» mantenido.

export interface Tecla { code: string; key: string; keyCode: number }
export const T = (code: string, key: string, keyCode: number): Tecla => ({ code, key, keyCode });
export const NUM = (n: number): Tecla => T('Digit' + n, String(n), 48 + n);
export const L = (k: string): Tecla => T('Key' + k, k.toLowerCase(), k.charCodeAt(0));
export const ARRIBA = T('ArrowUp', 'ArrowUp', 38), ABAJO = T('ArrowDown', 'ArrowDown', 40), IZQ = T('ArrowLeft', 'ArrowLeft', 37), DER = T('ArrowRight', 'ArrowRight', 39);
export const ENTER = T('Enter', 'Enter', 13), ESC = T('Escape', 'Escape', 27), SALIR = T('Escape', 'Salir', 27), TAB = T('Tab', 'Tab', 9), ESPACIO = T('Space', ' ', 32);

export const MAS = 1000;
export const CLAVE_GUARDADO = 'pokemon-valley/mando';

export interface Accion { id: string; nombre: string; tecla: Tecla | null; teclaNombre: string; defecto: number | null }
export const ACCIONES: Accion[] = [
  { id: 'mas', nombre: 'Más (segunda capa, mantenido)', tecla: null, teclaNombre: '', defecto: 6 },
  { id: 'casilla1', nombre: 'Casilla 1', tecla: NUM(1), teclaNombre: '1', defecto: 2 },
  { id: 'casilla2', nombre: 'Casilla 2', tecla: NUM(2), teclaNombre: '2', defecto: 3 },
  { id: 'casilla3', nombre: 'Casilla 3', tecla: NUM(3), teclaNombre: '3', defecto: 4 },
  { id: 'casilla4', nombre: 'Casilla 4', tecla: NUM(4), teclaNombre: '4', defecto: 5 },
  { id: 'casilla5', nombre: 'Casilla 5', tecla: NUM(5), teclaNombre: '5', defecto: 12 },
  { id: 'casilla6', nombre: 'Casilla 6', tecla: NUM(6), teclaNombre: '6', defecto: 15 },
  { id: 'casilla7', nombre: 'Casilla 7', tecla: NUM(7), teclaNombre: '7', defecto: 13 },
  { id: 'casilla8', nombre: 'Casilla 8', tecla: NUM(8), teclaNombre: '8', defecto: 14 },
  { id: 'casilla9', nombre: 'Casilla 9', tecla: NUM(9), teclaNombre: '9', defecto: MAS + 2 },
  { id: 'casilla10', nombre: 'Casilla 10', tecla: NUM(0), teclaNombre: '0', defecto: MAS + 3 },
  { id: 'interactuar', nombre: 'Acción (F)', tecla: L('F'), teclaNombre: 'F', defecto: 0 },
  { id: 'cancelar', nombre: 'Cerrar / cancelar (Esc)', tecla: ESC, teclaNombre: 'Esc', defecto: 1 },
  { id: 'objetivo', nombre: 'Siguiente objetivo (Tab)', tecla: TAB, teclaNombre: 'Tab', defecto: 7 },
  { id: 'mapa', nombre: 'Mapa (M)', tecla: L('M'), teclaNombre: 'M', defecto: 8 },
  { id: 'hogar', nombre: 'Piedra de hogar (H)', tecla: L('H'), teclaNombre: 'H', defecto: 10 },
  { id: 'movimientos', nombre: 'Movimientos (K)', tecla: L('K'), teclaNombre: 'K', defecto: MAS + 14 },
  { id: 'inventario', nombre: 'Inventario (I)', tecla: L('I'), teclaNombre: 'I', defecto: MAS + 15 },
  { id: 'tienda', nombre: 'Comerciar (T)', tecla: L('T'), teclaNombre: 'T', defecto: MAS + 13 },
  { id: 'retar', nombre: 'Retar a duelo (R)', tecla: L('R'), teclaNombre: 'R', defecto: MAS + 7 },
  { id: 'salir', nombre: 'Salir al título (Esc)', tecla: SALIR, teclaNombre: 'Salir', defecto: 9 },
];

export type Disposicion = 'xbox' | 'switch' | 'ps';
export const DISPOSICIONES: { id: Disposicion | 'auto'; nombre: string }[] = [
  { id: 'auto', nombre: 'Automático' }, { id: 'xbox', nombre: 'Xbox' }, { id: 'switch', nombre: 'Nintendo' }, { id: 'ps', nombre: 'PlayStation' },
];
const CARAS: Record<Disposicion, string[]> = { xbox: ['A', 'B', 'X', 'Y'], switch: ['B', 'A', 'Y', 'X'], ps: ['X', 'O', '□', '△'] };
const RESTO: Record<number, string> = { 4: 'L1', 5: 'R1', 6: 'L2', 7: 'R2', 8: '−', 9: '+', 10: 'L3', 11: 'R3', 12: '↑', 13: '↓', 14: '←', 15: '→', 16: 'Home' };

export interface Config { disposicion: Disposicion | 'auto'; asig: Record<string, number | null> }
// Botones por defecto de cada tipo de mando: en Nintendo, A (derecha, índice 1) acepta y B (abajo, 0) cancela.
export function defectos(disp: Disposicion = 'xbox'): Record<string, number | null> {
  const d = Object.fromEntries(ACCIONES.map(a => [a.id, a.defecto]));
  if (disp === 'switch') { d.interactuar = 1; d.cancelar = 0; }
  return d;
}
export const config: Config = { disposicion: 'auto', asig: defectos() };
/** Disposición que sugiere el nombre del mando conectado (la pone mando.ts). */
export let disposicionDetectada: Disposicion = 'xbox';
export function detectarDisposicion(id: string): void {
  disposicionDetectada = /switch|pro controller|joy-con|nintendo|057e|0e6f|20d6/i.test(id) ? 'switch'
    : /054c|dualshock|dualsense|playstation|wireless controller/i.test(id) ? 'ps' : 'xbox';
}
export const disposicion = (): Disposicion => config.disposicion === 'auto' ? disposicionDetectada : config.disposicion;

export function cargar(): void {
  try {
    const g = JSON.parse(localStorage.getItem(CLAVE_GUARDADO) ?? 'null') as Partial<Config> | null;
    if (!g) return;
    if (g.disposicion && DISPOSICIONES.some(d => d.id === g.disposicion)) config.disposicion = g.disposicion;
    for (const a of ACCIONES) { const v = g.asig?.[a.id]; if (v === null || typeof v === 'number') config.asig[a.id] = v; }
  } catch { /* guardado roto: valores por defecto */ }
}
export function guardar(): void { localStorage.setItem(CLAVE_GUARDADO, JSON.stringify(config)); }
/** Botones por defecto del tipo de mando elegido (o del detectado, en automático). */
export function restablecer(): void { config.asig = defectos(disposicion()); guardar(); }
/** Elige el tipo de mando y pone sus botones por defecto. */
export function elegirDisposicion(d: Disposicion | 'auto'): void { config.disposicion = d; restablecer(); }

/** Nombre corto de un botón ("A", "L2", "↑", "L2X", "L2+R2"); null si no hay. */
export function nombreBoton(codigo: number | null, disp: Disposicion = disposicion()): string {
  if (codigo === null) return '—';
  if (codigo >= MAS) {
    const b = nombreBoton(codigo - MAS, disp), m = nombreBoton(config.asig.mas ?? null, disp);
    return config.asig.mas === null ? b : b.length > 1 ? `${m}+${b}` : m + b;
  }
  return codigo < 4 ? CARAS[disp][codigo] : RESTO[codigo] ?? `B${codigo}`;
}

/** La tecla tal cual, o el botón del mando que la lanza si `conMando`. */
export function rotulo(tecla: string, conMando: boolean): string {
  if (!conMando) return tecla;
  const a = ACCIONES.find(x => x.teclaNombre === (tecla === 'clic' ? 'Tab' : tecla));
  return a ? nombreBoton(config.asig[a.id] ?? null) : tecla;
}

/** Botón → tecla sintética en el juego, según la configuración (incluye los códigos con «más»). */
export function tablaJuego(): Map<number, Tecla> {
  const t = new Map<number, Tecla>();
  for (const a of ACCIONES) { const c = config.asig[a.id]; if (a.tecla && c !== null && c !== undefined) t.set(c, a.tecla); }
  return t;
}
