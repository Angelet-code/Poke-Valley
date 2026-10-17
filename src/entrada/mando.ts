// Mando (Gamepad API del navegador: Xbox, Switch Pro, PDP Faceoff, PS…). Cada fotograma lee los mandos y, al
// pulsar o soltar un botón, lanza una tecla sintética en `window`: así cada escena (título, elección, aventura,
// evolución, galería) responde al mando con sus mismos atajos de teclado, sin código aparte. Los sticks los lee la
// aventura directamente (`ejeIzq` para andar, `ejeDer` para apuntar).
// Qué botón lanza qué acción está en asignacion.ts (configurable en la pantalla «Mando», scenes/ConfigMando.ts);
// en los menús la tabla es fija (A/Start aceptan, B/Select atrás, cruceta o stick mueven). La cruceta se lee de los
// botones 12-15 y también del "hat" (eje 9) de los mandos que Windows expone sin disposición standard.
// Las teclas sintéticas llevan `isTrusted = false`: la aventura lo usa para que «cancelar» cierre lo abierto sin
// salir al título (eso solo lo hace «salir», `key: 'Salir'`).
import Phaser from 'phaser';
import { ABAJO, ARRIBA, DER, ENTER, ESC, ESPACIO, IZQ, L, MAS, type Tecla, T, cargar, config, detectarDisposicion, tablaJuego } from './asignacion';

const Z = 0.25;          // zona muerta de los sticks
const UMBRAL_EJE = 0.5;  // el stick izquierdo hace de cruceta en los menús a partir de aquí
const NADA = T('', '', 0);

const MENU: Record<number, Tecla | undefined> = {
  0: ENTER, 9: ENTER, 1: ESC, 8: ESC, 2: L('F'), 3: ESPACIO, 12: ARRIBA, 13: ABAJO, 14: IZQ, 15: DER, 4: IZQ, 5: DER,
};
// El stick izquierdo en los menús: cuatro "botones" virtuales (índices 100-103) que siguen la cruceta.
const EJE_MENU = [[100, 12], [101, 13], [102, 14], [103, 15]] as const;

/** El mando del juego (lo crea main.ts; antes de eso, ninguno). */
export let mando: Mando | null = null;
export function instalarMando(game: Phaser.Game): Mando { mando = new Mando(game); return mando; }

export class Mando {
  /** Momento (ms del reloj del juego) del último botón o stick usado: para saber si se juega con mando o con ratón. */
  tUso = -1e9;
  /** Hay un mando conectado (el navegador solo lo enseña tras pulsar algo en él). */
  get hay(): boolean { return this.pad !== null; }
  get nombre(): string { return this.pad?.id ?? ''; }
  /** Pantalla «Mando»: si está puesto, cada botón pulsado va aquí (con +MAS si se mantiene «más») y no se lanzan teclas. */
  capturar: ((codigo: number) => void) | null = null;
  private pad: Gamepad | null = null;
  private idVisto = '';
  private pulsado = new Map<number, Tecla>();   // botón → tecla que mandó al pulsarse (se suelta la misma)
  private ejeAnt = [0, 0, 0, 0];

  constructor(private game: Phaser.Game) {
    cargar();
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

  // Cruceta: botón 12-15 o, en los mandos sin disposición standard, el "hat" del eje 9 (-1 arriba, luego cada 2/7
  // en el sentido del reloj; fuera de -1…1, suelto).
  private cruceta(i: number): boolean {
    const p = this.pad!;
    if (p.buttons[i]?.pressed) return true;
    const v = p.axes[9];
    if (v === undefined || v < -1.01 || v > 1.01) return false;
    const d = Math.round((v + 1) * 3.5) % 8;   // 0 ↑, 1 ↗, 2 →, 3 ↘, 4 ↓, 5 ↙, 6 ←, 7 ↖
    return i === 12 ? d === 7 || d <= 1 : i === 15 ? d >= 1 && d <= 3 : i === 13 ? d >= 3 && d <= 5 : d >= 5 && d <= 7;
  }

  private leer(): void {
    const pads = navigator.getGamepads?.() ?? [];
    this.pad = null;
    for (const p of pads) if (p && p.connected) { this.pad = p; break; }
    const p = this.pad;
    if (!p) { if (this.pulsado.size) this.soltarTodo(); return; }
    if (p.id !== this.idVisto) { this.idVisto = p.id; detectarDisposicion(p.id); }
    const juego = this.game.scene.isActive('aventura'), captura = this.capturar;
    const tabla = juego ? tablaJuego() : null;
    const botonMas = config.asig.mas ?? null;
    const estado = (i: number): boolean => {
      if (i >= 12 && i <= 15) return this.cruceta(i);
      if (i < 100) return p.buttons[i]?.pressed ?? false;
      const x = p.axes[0] ?? 0, y = p.axes[1] ?? 0;   // stick izquierdo como cruceta (solo en los menús)
      return !juego && !captura && (i === 100 ? y < -UMBRAL_EJE : i === 101 ? y > UMBRAL_EJE : i === 102 ? x < -UMBRAL_EJE : x > UMBRAL_EJE);
    };
    const mas = botonMas !== null && estado(botonMas);
    const ahora = this.game.loop.now;
    const n = Math.max(16, p.buttons.length);
    const indices = [...Array.from({ length: n }, (_, i) => i), ...EJE_MENU.map(([v]) => v)];
    for (const i of indices) {
      const abajo = estado(i), antes = this.pulsado.get(i);
      if (abajo && !antes) {
        this.tUso = ahora;
        let t: Tecla | undefined;
        if (captura) { if (i < 100) captura(mas && i !== botonMas ? MAS + i : i); }
        else if (tabla) t = (mas ? tabla.get(MAS + i) : undefined) ?? tabla.get(i);
        else t = i >= 100 ? MENU[EJE_MENU.find(([v]) => v === i)![1]] : MENU[i];
        this.pulsado.set(i, t ?? NADA);
        if (t) this.tecla('keydown', t);
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
