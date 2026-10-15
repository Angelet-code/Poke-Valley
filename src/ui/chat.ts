// Chat del modo aventura, como en WoW/LoL: Intro abre la línea de escribir, Intro la manda, Esc la cierra sin mandar.
// Es HTML encima del lienzo (no Phaser) para tener cursor, selección y pegar. Mientras escribes, el teclado del juego
// está apagado. Los mensajes van a toda la sala por la red (`t: 'chat'`); sin red solo los ves tú.
// Una sola caja por página: sobrevive a los cambios de mapa (la escena se reinicia, esto no).
import type Phaser from 'phaser';
import type { Red } from '../combate/red';

const LARGO = 120;         // caracteres por mensaje
const LINEAS = 50;         // las que se guardan en el registro
const SE_APAGA = 12000;    // ms que se ve una línea con el chat cerrado

type Linea = { el: HTMLDivElement; t: number };
// Quién habla: tú, otro jugador o el juego.
type De = 'yo' | 'otro' | 'sistema';

const CSS = `
#chat { position: fixed; left: 12px; bottom: 96px; width: min(420px, calc(100vw - 24px)); z-index: 10;
  font: 600 14px/1.35 "Segoe UI", system-ui, sans-serif; color: #f2ead8; pointer-events: none; display: none; }
#chat.activo { display: block; }
#chat .registro { max-height: 190px; overflow: hidden; display: flex; flex-direction: column; justify-content: flex-end;
  padding: 4px 8px; border-radius: 6px; transition: background .15s; }
#chat.abierto .registro { background: rgba(14, 20, 12, .55); overflow-y: auto; pointer-events: auto; }
#chat .linea { text-shadow: 0 1px 2px #000, 0 0 3px #000; overflow-wrap: anywhere; transition: opacity .6s; }
#chat .linea.apagada { opacity: 0; }
#chat.abierto .linea.apagada { opacity: 1; }
#chat .nombre { color: #8fd0ff; }
#chat .yo .nombre { color: #ffd66b; }
#chat .sistema { color: #c9c2ae; font-style: italic; }
#chat input { display: none; box-sizing: border-box; width: 100%; margin-top: 4px; padding: 5px 8px; pointer-events: auto;
  font: inherit; color: #fff; background: rgba(14, 20, 12, .8); border: 1px solid #c9a65a; border-radius: 6px; outline: none; }
#chat.abierto input { display: block; }
#chat input::placeholder { color: #9c957f; }
`;

export class Chat {
  private readonly caja: HTMLDivElement;
  private readonly registro: HTMLDivElement;
  private readonly entrada: HTMLInputElement;
  private readonly lineas: Linea[] = [];
  private escena: Phaser.Scene | null = null;
  private red: Red | null = null;
  private usuario = 'Jugador';
  // Qué hacer con un mensaje (uid de red de quien habla, o '' si eres tú): bocadillo sobre su cabeza.
  alDecir: ((uid: string, texto: string) => void) | null = null;

  constructor() {
    const estilo = document.createElement('style');
    estilo.textContent = CSS;
    document.head.appendChild(estilo);
    this.caja = document.createElement('div');
    this.caja.id = 'chat';
    this.registro = document.createElement('div');
    this.registro.className = 'registro';
    this.entrada = document.createElement('input');
    this.entrada.maxLength = LARGO;
    this.entrada.placeholder = 'Escribe y pulsa Intro (Esc para cerrar)';
    this.entrada.spellcheck = false;
    this.caja.append(this.registro, this.entrada);
    document.body.appendChild(this.caja);

    // Intro con el chat cerrado lo abre (en captura, antes de que lo vea Phaser).
    window.addEventListener('keydown', e => {
      if (!this.escena || this.abierto || e.key !== 'Enter' || e.repeat) return;
      e.preventDefault(); e.stopPropagation();
      this.abrir();
    }, true);
    // Lo que se pulsa dentro de la línea no le llega al juego.
    this.entrada.addEventListener('keydown', e => {
      e.stopPropagation();
      if (e.key === 'Enter') { e.preventDefault(); this.mandar(this.entrada.value); this.cerrar(); }
      else if (e.key === 'Escape') { e.preventDefault(); this.cerrar(); }
    });
    this.entrada.addEventListener('keyup', e => e.stopPropagation());
    // Si se pierde el foco (clic en el juego, otra ventana), se cierra.
    this.entrada.addEventListener('blur', () => { if (this.abierto) this.cerrar(); });
    setInterval(() => this.apagar(), 500);
  }

  get abierto(): boolean { return this.caja.classList.contains('abierto'); }

  // La escena de aventura la enciende al montarse y la apaga al irse (en el título, Intro no abre nada).
  activar(escena: Phaser.Scene, red: Red | null, usuario: string | undefined): void {
    this.escena = escena;
    this.usuario = usuario?.trim() || 'Jugador';
    if (red && red !== this.red) {
      this.red = red;
      red.on('chat', m => {
        const texto = typeof m.texto === 'string' ? m.texto.slice(0, LARGO) : '';
        if (!texto) return;
        this.escribir('otro', typeof m.usuario === 'string' && m.usuario ? m.usuario.slice(0, 24) : 'Jugador', texto);
        this.alDecir?.(m.uid, texto);
      });
    }
    this.caja.classList.add('activo');
    escena.events.once('shutdown', () => { if (this.escena === escena) this.desactivar(); });
  }

  desactivar(): void {
    if (this.abierto) this.cerrar();
    this.escena = null;
    this.alDecir = null;
    this.caja.classList.remove('activo');
  }

  // Una línea del juego (entradas, avisos).
  aviso(texto: string): void { this.escribir('sistema', '', texto); }

  private abrir(): void {
    const kb = this.escena?.input.keyboard;
    kb?.resetKeys();                                    // que no se quede andando con la tecla que tenía pulsada
    if (this.escena) this.escena.game.input.keyboard!.enabled = false;
    this.caja.classList.add('abierto');
    this.entrada.value = '';
    this.entrada.focus();
    this.registro.scrollTop = this.registro.scrollHeight;
  }

  private cerrar(): void {
    this.caja.classList.remove('abierto');
    this.entrada.value = '';
    this.entrada.blur();
    // Se enciende después de este evento, para que la tecla que cierra (Intro, Esc) no le llegue al juego.
    const juego = this.escena?.game;
    setTimeout(() => { if (juego) juego.input.keyboard!.enabled = true; this.escena?.input.keyboard?.resetKeys(); }, 0);
    this.apagar();
  }

  private mandar(bruto: string): void {
    const texto = bruto.replace(/\s+/g, ' ').trim().slice(0, LARGO);
    if (!texto) return;
    this.escribir('yo', this.usuario, texto);
    this.alDecir?.('', texto);
    this.red?.enviar({ t: 'chat', texto, usuario: this.usuario });
  }

  private escribir(de: De, quien: string, texto: string): void {
    const el = document.createElement('div');
    el.className = `linea ${de}`;
    if (de === 'sistema') el.textContent = texto;
    else {
      const n = document.createElement('span');
      n.className = 'nombre';
      n.textContent = `[${quien}]: `;
      el.append(n, document.createTextNode(texto));
    }
    this.registro.appendChild(el);
    this.lineas.push({ el, t: performance.now() });
    while (this.lineas.length > LINEAS) this.lineas.shift()!.el.remove();
    this.registro.scrollTop = this.registro.scrollHeight;
  }

  // Con el chat cerrado, las líneas viejas se desvanecen (abierto se ven todas).
  private apagar(): void {
    const ahora = performance.now();
    for (const l of this.lineas) l.el.classList.toggle('apagada', ahora - l.t > SE_APAGA);
  }
}

let chat: Chat | null = null;
export function chatDeLaPagina(): Chat { return chat ??= new Chat(); }
