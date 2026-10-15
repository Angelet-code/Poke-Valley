// Conexión del multijugador cooperativo (`?mp=ws://host:puerto[/sala]`, servidor en tools/servidor_mp.mjs). Cada
// jugador manda su estado unas 10 veces por segundo y apunta el último de cada uno; el resto de mensajes (fotos de los
// salvajes, golpes, sucesos que animar) los manda y los recibe la escena (`enviar` / `on`).
// Sin Phaser; la conexión sobrevive a los cambios de mapa (la escena se reinicia, esto no) y se rehace si se cae.
import type { EstadoRemoto } from './mundo';

const CADA = 100;        // ms entre envíos del estado
const CADUCA = 5000;     // ms sin noticias de alguien para darlo por ido

// Un mensaje de otro jugador: siempre lleva su uid (`uid`) y su tipo (`t`).
export type Mensaje = { t: string; uid: string } & Record<string, unknown>;

export class Red {
  readonly uid = Math.random().toString(36).slice(2, 10);
  // Lo último de cada uno y cuándo llegó (performance.now()).
  readonly otros = new Map<string, { e: EstadoRemoto; t: number }>();
  conectado = false;
  // La sala: los uids en orden de llegada y la semilla de sus mapas (la del primero que entró).
  jugadores: string[] = [];
  semilla: number | null = null;
  private miSemilla: number | null = null;
  private ws: WebSocket | null = null;
  private espera = 2000;   // ms antes de reintentar (se dobla en cada fallo, hasta 30 s)
  private yo: (() => EstadoRemoto | null) | null = null;
  private manejadores = new Map<string, (m: Mensaje) => void>();

  constructor(readonly url: string) {
    this.abrir();
    setInterval(() => { const e = this.yo?.(); if (e) this.enviar({ t: 'estado', ...e }); }, CADA);
  }

  // De dónde sale tu estado (la escena lo cambia al montar cada mapa; null = no mandes nada).
  fuente(f: (() => EstadoRemoto | null) | null): void { this.yo = f; }
  // Saludo a la sala con la semilla de tu partida (por si eres el primero).
  presentar(semilla: number): void {
    if (this.miSemilla === semilla) return;
    this.miSemilla = semilla;
    this.hola();
  }
  // Qué hacer con los mensajes de un tipo (uno por tipo; el último manda).
  on(t: string, fn: (m: Mensaje) => void): void { this.manejadores.set(t, fn); }
  enviar(m: { t: string } & Record<string, unknown>): void {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify({ ...m, uid: this.uid }));
  }
  // Puesto en la sala (0 = el primero); los que no están en la lista, al final.
  orden(uid: string): number { const i = this.jugadores.indexOf(uid); return i < 0 ? 1e9 : i; }

  // Los que siguen ahí (quita a los que llevan un rato callados).
  vivos(): EstadoRemoto[] {
    const ahora = performance.now();
    for (const [uid, o] of this.otros) if (ahora - o.t > CADUCA) this.otros.delete(uid);
    return [...this.otros.values()].map(o => o.e);
  }

  private hola(): void { if (this.miSemilla !== null) this.enviar({ t: 'hola', semilla: this.miSemilla }); }
  private abrir(): void {
    const ws = this.ws = new WebSocket(this.url);
    ws.onopen = () => { this.conectado = true; this.espera = 2000; console.log(`Multijugador: conectado a ${this.url} como ${this.uid}`); this.hola(); };
    ws.onmessage = ev => {
      let m: Mensaje;
      try { m = JSON.parse(String(ev.data)); } catch { return; }
      if (m.t === 'sala') { this.jugadores = m.jugadores as string[]; this.semilla = (m.semilla as number | null) ?? null; }
      else if (m.uid === this.uid) return;
      else if (m.t === 'adios') this.otros.delete(m.uid);
      else if (m.t === 'estado') this.otros.set(m.uid, { e: m as unknown as EstadoRemoto, t: performance.now() });
      this.manejadores.get(m.t)?.(m);
    };
    ws.onclose = () => {
      if (this.conectado) console.warn('Multijugador: se ha cortado; reintentando…');
      this.conectado = false; this.otros.clear(); this.jugadores = [];
      setTimeout(() => this.abrir(), this.espera);
      this.espera = Math.min(30000, this.espera * 2);
    };
    ws.onerror = () => {};   // el cierre llega después y reintenta
  }
}

// Una sola conexión por página (si la URL lleva ?mp=…).
let red: Red | null | undefined;
export function redDeLaPagina(): Red | null {
  if (red === undefined) {
    const url = new URLSearchParams(location.search).get('mp');
    red = url ? new Red(url) : null;
  }
  return red;
}
