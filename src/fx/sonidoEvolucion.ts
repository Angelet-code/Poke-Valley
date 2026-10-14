// Sonido de la evolución, sintetizado con Web Audio (el juego no tiene archivos de sonido): un zumbido que crece
// mientras evoluciona, un tintineo cada vez que cambia la silueta (cada vez más agudo), la explosión de luz y una
// fanfarria al final. Si el navegador no deja sonar, todo es mudo y la escena sigue igual.
export class SonidoEvolucion {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private dronOsc: OscillatorNode[] = [];
  private dronGain: GainNode | null = null;
  private dronFiltro: BiquadFilterNode | null = null;

  constructor(volumen = 0.22) {
    try {
      this.ctx = new AudioContext();
      this.master = this.ctx.createGain();
      this.master.gain.value = volumen;
      this.master.connect(this.ctx.destination);
      void this.ctx.resume();
    } catch { this.ctx = null; }
  }
  private get t(): number { return this.ctx?.currentTime ?? 0; }

  // Nota corta con envolvente: ataque rápido y caída.
  private nota(f: number, dur: number, tipo: OscillatorType, vol: number, cuando = 0, destino?: AudioNode): void {
    const c = this.ctx;
    if (!c || !this.master) return;
    const t0 = this.t + cuando, o = c.createOscillator(), g = c.createGain();
    o.type = tipo; o.frequency.value = f;
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(vol, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g).connect(destino ?? this.master);
    o.start(t0); o.stop(t0 + dur + 0.05);
  }

  // Zumbido grave que se abre (filtro) y sube de volumen durante `dur` s.
  dron(dur: number): void {
    const c = this.ctx;
    if (!c || !this.master) return;
    this.dronGain = c.createGain();
    this.dronFiltro = c.createBiquadFilter();
    this.dronFiltro.type = 'lowpass'; this.dronFiltro.Q.value = 6;
    this.dronFiltro.frequency.setValueAtTime(180, this.t);
    this.dronFiltro.frequency.exponentialRampToValueAtTime(3200, this.t + dur);
    this.dronGain.gain.setValueAtTime(0, this.t);
    this.dronGain.gain.linearRampToValueAtTime(0.35, this.t + 1.2);
    this.dronGain.gain.linearRampToValueAtTime(0.6, this.t + dur);
    this.dronFiltro.connect(this.dronGain).connect(this.master);
    for (const [f, tipo] of [[55, 'sawtooth'], [55.6, 'sawtooth'], [82.5, 'triangle'], [110.3, 'sawtooth']] as [number, OscillatorType][]) {
      const o = c.createOscillator();
      o.type = tipo;
      o.frequency.setValueAtTime(f, this.t);
      o.frequency.exponentialRampToValueAtTime(f * 2, this.t + dur);   // sube una octava: tensión
      o.connect(this.dronFiltro); o.start();
      this.dronOsc.push(o);
    }
  }
  pararDron(fundido = 0.08): void {
    if (!this.dronGain) return;
    this.dronGain.gain.cancelScheduledValues(this.t);
    this.dronGain.gain.setValueAtTime(this.dronGain.gain.value, this.t);
    this.dronGain.gain.linearRampToValueAtTime(0, this.t + fundido);
    for (const o of this.dronOsc) o.stop(this.t + fundido + 0.05);
    this.dronOsc = []; this.dronGain = null;
  }

  // Cambio de silueta: campanita (k de 0 a 1 = de grave a agudo).
  cambio(k: number): void {
    const f = 440 * Math.pow(2, k * 2);
    this.nota(f, 0.18, 'sine', 0.35);
    this.nota(f * 1.5, 0.12, 'triangle', 0.12);
  }
  // Latido grave (al empezar).
  latido(): void { this.nota(62, 0.35, 'sine', 0.9); this.nota(48, 0.45, 'sine', 0.6, 0.18); }
  // Brillo de partículas que llegan.
  chispa(): void { this.nota(1800 + Math.random() * 1600, 0.09, 'sine', 0.05); }
  // Letra del diálogo.
  letra(): void { this.nota(880, 0.03, 'square', 0.025); }
  // Pulsar para seguir.
  pulsar(): void { this.nota(1320, 0.06, 'square', 0.05); }

  // La luz estalla: ruido que se apaga y un golpe grave que cae.
  explosion(): void {
    const c = this.ctx;
    if (!c || !this.master) return;
    const n = c.sampleRate * 1.6, buf = c.createBuffer(1, n, c.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 2.2);
    const src = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    src.buffer = buf; f.type = 'lowpass';
    f.frequency.setValueAtTime(9000, this.t); f.frequency.exponentialRampToValueAtTime(300, this.t + 1.5);
    g.gain.value = 0.7;
    src.connect(f).connect(g).connect(this.master); src.start();
    const o = c.createOscillator(), og = c.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(160, this.t); o.frequency.exponentialRampToValueAtTime(32, this.t + 0.9);
    og.gain.setValueAtTime(1, this.t); og.gain.exponentialRampToValueAtTime(0.0001, this.t + 1.1);
    o.connect(og).connect(this.master); o.start(); o.stop(this.t + 1.2);
  }

  // Fanfarria: arpegio que sube y acorde mayor sostenido, con brillos.
  fanfarria(): void {
    const arp = [523.25, 659.25, 783.99, 1046.5, 1318.5];
    arp.forEach((f, i) => { this.nota(f, 0.35, 'triangle', 0.32, i * 0.09); this.nota(f / 2, 0.3, 'square', 0.06, i * 0.09); });
    const t0 = arp.length * 0.09 + 0.05;
    for (const f of [261.63, 329.63, 392, 523.25, 659.25]) { this.nota(f, 2.4, 'triangle', 0.16, t0); this.nota(f * 1.003, 2.2, 'sawtooth', 0.025, t0); }
    this.nota(130.81, 2.6, 'sine', 0.35, t0);
    for (let i = 0; i < 10; i++) this.nota(2000 + Math.random() * 2500, 0.15, 'sine', 0.05, t0 + 0.1 + i * 0.12);
  }

  // Trueno (relámpagos del tipo Eléctrico): chasquido de ruido y retumbo.
  trueno(fuerza = 1): void {
    const c = this.ctx;
    if (!c || !this.master) return;
    const n = Math.floor(c.sampleRate * 0.5), buf = c.createBuffer(1, n, c.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 4);
    const src = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    src.buffer = buf; f.type = 'bandpass'; f.frequency.value = 2400; f.Q.value = 0.7; g.gain.value = 0.35 * fuerza;
    src.connect(f).connect(g).connect(this.master); src.start();
    this.nota(70, 0.4, 'sine', 0.4 * fuerza, 0.03);
  }
  // Golpe grave y seco (pulsos de Lucha, rugido de Dragón, Acero).
  golpe(): void {
    const c = this.ctx;
    if (!c || !this.master) return;
    const o = c.createOscillator(), g = c.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(140, this.t); o.frequency.exponentialRampToValueAtTime(45, this.t + 0.18);
    g.gain.setValueAtTime(0.7, this.t); g.gain.exponentialRampToValueAtTime(0.0001, this.t + 0.25);
    o.connect(g).connect(this.master); o.start(); o.stop(this.t + 0.3);
  }
  // Movimiento aprendido: tres notas que suben.
  aprende(): void { [784, 988, 1175].forEach((f, i) => this.nota(f, 0.25, 'triangle', 0.25, i * 0.08)); }

  cerrar(): void {
    this.pararDron();
    const c = this.ctx;
    this.ctx = null;
    if (c) setTimeout(() => void c.close().catch(() => undefined), 3000);
  }
}
