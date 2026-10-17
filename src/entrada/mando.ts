// Mando (Gamepad API del navegador, disposición "standard": Xbox, Switch Pro, PDP Faceoff, PS…).
// Cada fotograma lee los mandos y, al pulsar o soltar un botón, lanza una tecla sintética en `window`: así cada
// escena (título, elección, aventura, evolución, galería) responde al mando con sus mismos atajos de teclado, sin
// código aparte. Los sticks los lee la aventura directamente (`ejeIzq` para andar, `ejeDer` para apuntar).
// Dos tablas: la del juego (escena `aventura` activa) y la de los menús (todo lo demás). L2 mantenido = segunda
// capa ("más") en el juego. Las teclas sintéticas llevan `isTrusted = false`: la aventura lo usa para que B cierre
// lo abierto sin salir al título (eso solo lo hace Start, `key: 'Salir'`).
import Phaser from 'phaser';

const Z = 0.25;          // zona muerta de los sticks
const UMBRAL_EJE = 0.5;  // el stick izquierdo hace de cruceta en los menús a partir de aquí

interface Tecla { code: string; key: string; keyCode: number }
const T = (code: string, key: string, keyCode: number): Tecla => ({ code, key, keyCode });
const NUM = (n: number): Tecla => T('Digit' + n, String(n), 48 + n);
const ARRIBA = T('ArrowUp', 'ArrowUp', 38), ABAJO = T('ArrowDown', 'ArrowDown', 40), IZQ = T('ArrowLeft', 'ArrowLeft', 37), DER = T('ArrowRight', 'ArrowRight', 39);
const ENTER = T('Enter', 'Enter', 13), ESC = T('Escape', 'Escape', 27), SALIR = T('Escape', 'Salir', 27), TAB = T('Tab', 'Tab', 9);
const L = (k: string): Tecla => T('Key' + k, k.toLowerCase(), k.charCodeAt(0));

// Índices de la disposición "standard": 0 A(abajo) 1 B(derecha) 2 X(izquierda) 3 Y(arriba) 4 L1 5 R1 6 L2 7 R2
// 8 Select/− 9 Start/+ 10 L3 11 R3 12 ↑ 13 ↓ 14 ← 15 →.
export const BOTON = { A: 0, B: 1, X: 2, Y: 3, L1: 4, R1: 5, L2: 6, R2: 7, SELECT: 8, START: 9, L3: 10, R3: 11, ARRIBA: 12, ABAJO: 13, IZQ: 14, DER: 15 } as const;

// En el juego (docs/GDD-combate.md «Mando»): X Y L1 R1 = casillas 1-4, cruceta ↑ → ↓ ← = 5-8, L2+X/Y = 9-10.
const JUEGO: Record<number, Tecla | undefined> = {
  [BOTON.A]: L('F'), [BOTON.B]: ESC, [BOTON.X]: NUM(1), [BOTON.Y]: NUM(2), [BOTON.L1]: NUM(3), [BOTON.R1]: NUM(4),
  [BOTON.R2]: TAB, [BOTON.R3]: TAB, [BOTON.L3]: L('H'), [BOTON.SELECT]: L('M'), [BOTON.START]: SALIR,
  [BOTON.ARRIBA]: NUM(5), [BOTON.DER]: NUM(6), [BOTON.ABAJO]: NUM(7), [BOTON.IZQ]: NUM(8),
};
const JUEGO_MAS: Record<number, Tecla | undefined> = {   // con L2 mantenido
  ...JUEGO, [BOTON.X]: NUM(9), [BOTON.Y]: NUM(0), [BOTON.R2]: L('R'),
  [BOTON.ARRIBA]: L('H'), [BOTON.IZQ]: L('K'), [BOTON.DER]: L('I'), [BOTON.ABAJO]: L('T'),
};
const MENU: Record<number, Tecla | undefined> = {
  [BOTON.A]: ENTER, [BOTON.START]: ENTER, [BOTON.B]: ESC, [BOTON.SELECT]: ESC, [BOTON.X]: L('F'), [BOTON.Y]: T('Space', ' ', 32),
  [BOTON.ARRIBA]: ARRIBA, [BOTON.ABAJO]: ABAJO, [BOTON.IZQ]: IZQ, [BOTON.DER]: DER,
  [BOTON.L1]: IZQ, [BOTON.R1]: DER,
};
// El stick izquierdo en los menús: cuatro "botones" virtuales (índices 100-103) que siguen la tabla de la cruceta.
const EJE_MENU = [[100, BOTON.ARRIBA], [101, BOTON.ABAJO], [102, BOTON.IZQ], [103, BOTON.DER]] as const;

/** El mando del juego (lo crea main.ts; antes de eso, ninguno). */
export let mando: Mando | null = null;
export function instalarMando(game: Phaser.Game): Mando { mando = new Mando(game); return mando; }

export class Mando {
  /** Momento (ms del reloj del juego) del último botón o stick usado: para saber si se juega con mando o con ratón. */
  tUso = -1e9;
  /** Hay un mando conectado (el navegador solo lo enseña tras pulsar algo en él). */
  get hay(): boolean { return this.pad !== null; }
  private pad: Gamepad | null = null;
  private pulsado = new Map<number, Tecla>();   // botón → tecla que mandó al pulsarse (se suelta la misma)
  private ejeAnt = [0, 0, 0, 0];

  constructor(private game: Phaser.Game) {
    game.events.on(Phaser.Core.Events.PRE_STEP, this.leer, this);
    addEventListener('gamepadconnected', (e: GamepadEvent) => { console.info(`Mando conectado: ${e.gamepad.id} (${e.gamepad.mapping || 'sin disposición standard'})`); game.events.emit('mando', e.gamepad.id); });
    addEventListener('gamepaddisconnected', () => { this.pad = null; this.soltarTodo(); });
  }

  /** Stick izquierdo (-1…1 por eje, 0 dentro de la zona muerta). */
  ejeIzq(): { x: number; y: number } { return this.eje(0, 1); }
  /** Stick derecho. */
  ejeDer(): { x: number; y: number } { return this.eje(2, 3); }
  private eje(ix: number, iy: number): { x: number; y: number } {
    const p = this.pad;
    if (!p) return { x: 0, y: 0 };
    const x = p.axes[ix] ?? 0, y = p.axes[iy] ?? 0, n = Math.hypot(x, y);
    if (n < Z) return { x: 0, y: 0 };
    const k = Math.min(1, (n - Z) / (1 - Z)) / n;   // de la zona muerta al borde, 0…1
    return { x: x * k, y: y * k };
  }

  private enJuego(): boolean { return this.game.scene.isActive('aventura'); }

  private leer(): void {
    const pads = navigator.getGamepads?.() ?? [];
    this.pad = null;
    for (const p of pads) if (p && p.connected) { this.pad = p; break; }
    const p = this.pad;
    if (!p) { if (this.pulsado.size) this.soltarTodo(); return; }
    const juego = this.enJuego(), mas = juego && (p.buttons[BOTON.L2]?.pressed ?? false);
    const tabla = juego ? (mas ? JUEGO_MAS : JUEGO) : MENU;
    const ahora = this.game.loop.now;
    const estado = (i: number): boolean => {
      if (i < 100) return p.buttons[i]?.pressed ?? false;
      const x = p.axes[0] ?? 0, y = p.axes[1] ?? 0;   // stick izquierdo como cruceta (solo en los menús)
      return !juego && (i === 100 ? y < -UMBRAL_EJE : i === 101 ? y > UMBRAL_EJE : i === 102 ? x < -UMBRAL_EJE : x > UMBRAL_EJE);
    };
    const indices = [...p.buttons.map((_, i) => i), ...EJE_MENU.map(([v]) => v)];
    for (const i of indices) {
      const abajo = estado(i), antes = this.pulsado.get(i);
      if (abajo && !antes) {
        this.tUso = ahora;
        const t = i >= 100 ? tabla[EJE_MENU.find(([v]) => v === i)![1]] : tabla[i];
        if (t) { this.pulsado.set(i, t); this.tecla('keydown', t); }
        else this.pulsado.set(i, T('', '', 0));   // sin tecla: solo recordar que está pulsado
      } else if (!abajo && antes) {
        this.pulsado.delete(i);
        if (antes.keyCode) this.tecla('keyup', antes);
      }
    }
    const iz = this.ejeIzq(), de = this.ejeDer(), ej = [iz.x, iz.y, de.x, de.y];
    if (ej.some((v, j) => Math.abs(v - this.ejeAnt[j]) > 0.05)) this.tUso = ahora;
    this.ejeAnt = ej;
  }

  private soltarTodo(): void {
    for (const t of this.pulsado.values()) if (t.keyCode) this.tecla('keyup', t);
    this.pulsado.clear();
  }

  private tecla(tipo: 'keydown' | 'keyup', t: Tecla): void {
    // Phaser lee `keyCode` (el nombre de la tecla sale de ahí) y las escenas, `code`/`key`. `isTrusted` queda en false.
    window.dispatchEvent(new KeyboardEvent(tipo, { code: t.code, key: t.key, keyCode: t.keyCode, bubbles: true, cancelable: true } as KeyboardEventInit));
  }
}
