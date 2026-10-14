// Cinemática de la evolución (modo aventura). Aventura se pausa (todo el mapa se queda congelado), se oculta el HUD
// y esta escena, encima de todo y sin zoom (px de pantalla), lo cuenta:
// Dura de 15 a 30 s hasta el «¡Enhorabuena!», más cuanto más alto el nivel al que evoluciona (DURA_MIN…DURA_MAX).
// 1. Franjas de cine, el mundo se oscurece y el Pokémon sube al centro, más grande. Diálogo: "¿Eh? ¡X está evolucionando!".
// 2. Concentración: la coreografía de sus tipos (fx/efectosTipo.ts: anillo de fuego, relámpagos, tornado de hojas,
//    rocas en órbita, levitación…; con dos tipos, las dos), chispas de su forma que caen en espiral hacia él, el
//    fondo teñido de su tipo, un halo y el cuerpo que se va volviendo blanco. Zumbido que crece.
// 3. Siluetas blancas de la forma vieja y la nueva que se alternan cada vez más deprisa, con un tintineo cada vez
//    más agudo, temblor y ondas.
// 4. Estallido: pantalla blanca, rayos (solo aquí), ondas, estrellas y la forma nueva que aparece en color (su animación de Charge),
//    con fanfarria y el estallido propio de cada tipo de la forma nueva; luego sus efectos siguen, más tranquilos.
//    Si gana o cambia de tipo, los efectos del tipo nuevo empiezan a mitad de la animación (al empezar las siluetas)
//    y los del tipo que pierde se acaban en el estallido.
// 5. "¡Enhorabuena!…" con la ficha de stats (antes → ahora) y lo que aprende, un mensaje por pulsación
//    (F, espacio, Intro o clic). Al terminar todo vuelve a su sitio y el juego sigue donde estaba.
// Los efectos (texturas de rayos, halo, estrellas, ondas) se generan aquí; el sonido, en fx/sonidoEvolucion.ts.
import Phaser from 'phaser';
import { S, VH, VW } from '../config';
import { C, FUENTE_PX, FUENTE_TIT, HEX, PANEL, marco } from './UIScene';
import { ancla, poner } from '../combate/sprites';
import type { Stats } from '../combate/reglas';
import { SonidoEvolucion } from '../fx/sonidoEvolucion';
import { ESTILO_TIPO, texturasTipo, type EstiloTipo } from '../fx/particulasTipo';
import { VELO_TIPO, crearEfecto, type EfectoTipo, type Fase, type Lienzo, type Part } from '../fx/efectosTipo';
import type { TypeName } from '../data/movimientos';

export interface DatosEvolucion {
  de: { dex: string; nombre: string; stats: Stats; tipos: TypeName[] };
  a: { dex: string; nombre: string; stats: Stats; tipos: TypeName[] };
  nivel: number;                 // al que evoluciona: marca la duración (DURA_MIN a DURA_MAX)
  color: number;                 // color del tipo de la forma nueva
  aprende: string[];             // movimientos nuevos (nombres)
  x: number; y: number;          // pies del Pokémon en pantalla (px)
  escala: number;                // zoom de la cámara del mundo
  // Cómo se ve en el mapa en ese instante (fotograma, dirección y luz), para empezar idéntico y sin saltos.
  pose: { tex: string; frame: string | number; ox: number; oy: number; dir: number; flipX: boolean };
  tinte: number;                 // luz ambiente del mapa
  ocultar: () => void;           // esconde el sprite del mapa (cuando el de la cinemática ya lo tapa)
  fin: () => void;
}

type Img = Phaser.GameObjects.Image;

const FILAS: [keyof Stats, string][] = [['hp', 'PS'], ['atk', 'Ataque'], ['def', 'Defensa'], ['spa', 'At. Esp.'], ['spd', 'Def. Esp.'], ['spe', 'Velocidad']];
const FRANJA = 20;                // alto de las franjas de cine (px de juego)
const SOBRA = 12;                 // las franjas se pasan del borde, para que el temblor no deje ver el mundo
const VEL_TEXTO = 38;             // letras por segundo
const CARGA = 2700;               // ms concentrando la luz
const SILUETAS = 3700;            // ms alternando siluetas
// Duración hasta el «¡Enhorabuena!» según el nivel al que evoluciona: DURA_MIN s a nivel 1, DURA_MAX s de NV_MAX en adelante.
// BASE: lo que suman los tiempos de la secuencia hasta el «¡Enhorabuena!» sin estirar (intro 1 + 0,5 + CARGA + SILUETAS
// + 0,45 + 0,9 s); todo se estira en proporción.
const BASE = 9.25, DURA_MIN = 15, DURA_MAX = 30, NV_MAX = 50;

export class Evolucion extends Phaser.Scene {
  private d!: DatosEvolucion;
  private son!: SonidoEvolucion;
  private cx = 0; private pie = 0; private E = 1;         // centro, pies y escala del Pokémon en la cinemática
  private velo!: Phaser.GameObjects.Rectangle;
  private destello!: Phaser.GameObjects.Rectangle;
  private franjas: Phaser.GameObjects.Rectangle[] = [];
  private rayos: Img[] = [];
  private halo!: Img;
  private viejo!: Phaser.GameObjects.Sprite;
  private blanco!: Phaser.GameObjects.Sprite;            // copia blanca del viejo (se va encendiendo)
  private silV!: Phaser.GameObjects.Sprite;
  private silN!: Phaser.GameObjects.Sprite;
  private nuevo!: Phaser.GameObjects.Sprite;
  private parts: Part[] = [];
  private emitir = 0; private acum = 0;                  // chispas por segundo hacia el centro
  private tipos: TypeName[] = [];                        // los de la forma vieja y, desde el estallido, los de la nueva
  private efectos: { t: TypeName; ef: EfectoTipo }[] = [];  // coreografía de cada tipo (fx/efectosTipo.ts)
  private k = 0;                                         // intensidad de los efectos (0 → 1 hasta el estallido)
  private fase: Fase = 'carga';
  private lz!: Lienzo;
  private g!: Phaser.GameObjects.Graphics;               // efectos dibujados delante (relámpagos, estelas)
  private gN!: Phaser.GameObjects.Graphics;              // detrás del Pokémon (charcos, grietas, ondas)
  private enCentro = false;                              // el Pokémon ya está en el centro (puede levitar)
  private nTipo = 0;
  private f = 1;                                         // factor de duración (nivel)
  inicio = 0;                                            // ms de reloj al empezar (para medir la duración)
  private giroRayos = 0.25;
  // Diálogo.
  private dlg!: Phaser.GameObjects.Container;
  private dlgTxt!: Phaser.GameObjects.Text;
  private flecha!: Phaser.GameObjects.Text;
  private texto = ''; private letras = 0; private tTexto = 0;
  private esperando: (() => void) | null = null;
  private ficha: Phaser.GameObjects.GameObject[] = [];

  constructor() { super('evolucion'); }

  create(d: DatosEvolucion): void {
    this.d = d;
    this.parts = []; this.rayos = []; this.franjas = []; this.ficha = [];
    this.emitir = 0; this.k = 0; this.fase = 'carga'; this.enCentro = false; this.efectos = []; this.temblorHasta = 0; this.temblorFuerza = 0; this.tipos = d.de.tipos; this.giroRayos = 0.25; this.texto = ''; this.letras = 0; this.esperando = null;
    this.scene.bringToTop();
    this.texturas();
    texturasTipo(this);
    this.inicio = this.time.now;
    this.f = (DURA_MIN + (DURA_MAX - DURA_MIN) * Phaser.Math.Clamp((d.nivel - 1) / (NV_MAX - 1), 0, 1)) / BASE;
    this.son = new SonidoEvolucion();
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.son.cerrar());

    const W = VW * S, H = VH * S;
    this.cx = W / 2; this.pie = VH * 0.64 * S;
    const altoV = ancla(d.de.dex).alto, altoN = ancla(d.a.dex).alto;
    this.E = S * Math.min(Phaser.Math.Clamp(58 / altoV, 1.8, 3.2), 104 / altoN);

    this.velo = this.add.rectangle(0, 0, W, H, VELO_TIPO[d.de.tipos[0]]?.[0] ?? 0x05070c, 0).setOrigin(0);
    this.gN = this.add.graphics().setDepth(2);
    this.g = this.add.graphics().setDepth(25).setBlendMode(Phaser.BlendModes.ADD);
    this.halo = this.add.image(this.cx, this.centroY(altoV), 'evo-halo').setTint(d.color).setAlpha(0).setScale(0.5).setBlendMode(Phaser.BlendModes.ADD).setDepth(3);
    for (let i = 0; i < 2; i++) this.rayos.push(this.add.image(this.cx, this.centroY(altoV), 'evo-rayos')
      .setBlendMode(Phaser.BlendModes.ADD).setAlpha(0).setScale((i ? 1.6 : 2.2) * S / 3).setTint(i ? d.color : 0xfff4c8).setDepth(3));

    // El Pokémon: sale de donde estaba en el mapa (mirando de frente) y se pone en el centro.
    this.viejo = this.add.sprite(d.x, d.y, d.pose.tex, d.pose.frame).setOrigin(d.pose.ox, d.pose.oy).setFlipX(d.pose.flipX)
      .setScale(d.escala).setTint(d.tinte).setAlpha(0).setDepth(10);
    this.blanco = this.add.sprite(d.x, d.y, '__DEFAULT').setScale(d.escala).setTintFill(0xffffff).setAlpha(0).setDepth(11);
    this.silV = this.silueta(d.de.dex);
    this.silN = this.silueta(d.a.dex);
    this.nuevo = this.add.sprite(this.cx, this.pie, '__DEFAULT').setScale(this.E).setVisible(false).setDepth(10);
    poner(this.nuevo, d.a.dex, 'Idle', 0);

    for (const arriba of [true, false]) this.franjas.push(this.add.rectangle(0, arriba ? -(FRANJA + SOBRA) * S : H, W, (FRANJA + SOBRA) * S, 0x000000).setOrigin(0).setDepth(30));
    this.destello = this.add.rectangle(0, 0, W, H, 0xffffff, 0).setOrigin(0).setDepth(50);
    this.crearDialogo();
    // Lo que los efectos de tipo pueden usar.
    const esc = this;
    this.lz = {
      S, W, H, franja: FRANJA * S, cx: this.cx, pie: this.pie, son: this.son, g: this.g, gN: this.gN, flotar: 0, alfaPk: 1,
      cuerpo: () => { const c = this.cuerpo(); return { ...c, ancho: ancla(this.nuevo.visible ? d.a.dex : d.de.dex).ancho * this.E }; },
      parte: (key, p, tinte, normal) => this.parte(key, p, tinte, normal),
      temblor: (ms, fuerza) => esc.temblor(ms, fuerza),
      flash: (color, alfa, ms) => {
        if (esc.destello.fillAlpha > alfa) return;
        esc.tweens.killTweensOf(esc.destello);
        esc.destello.setFillStyle(color, alfa);
        esc.tweens.add({ targets: esc.destello, fillAlpha: 0, duration: ms, ease: 'Quad.Out' });
      },
    };
    this.efectos = d.de.tipos.map(t => ({ t, ef: crearEfecto(t, this.lz) }));

    const pulsa = () => this.pulsar();
    const kb = this.input.keyboard!;
    for (const k of ['F', 'SPACE', 'ENTER']) kb.addKey(k).on('down', pulsa);
    this.input.on('pointerdown', pulsa);

    void this.contar();
  }

  private silueta(dex: string): Phaser.GameObjects.Sprite {
    const s = this.add.sprite(this.cx, this.pie, '__DEFAULT').setScale(this.E).setVisible(false).setDepth(12);
    poner(s, dex, 'Idle', 0);
    return s.setTintFill(0xffffff);
  }
  // Temblor de cámara: si ya tiembla más fuerte, no lo pisa; si no, lo sustituye (antes los temblores pequeños y
  // continuos de algunos tipos, como Tierra, impedían que arrancaran el de las siluetas y el del estallido).
  private temblorHasta = 0; private temblorFuerza = 0;
  temblor(ms: number, fuerza: number): void {
    const ahora = this.time.now;
    if (ahora < this.temblorHasta && fuerza < this.temblorFuerza) return;
    this.temblorHasta = ahora + ms; this.temblorFuerza = fuerza;
    this.cameras.main.shake(ms, fuerza, true);
  }
  private centroY(alto: number): number { return this.pie - alto * this.E * 0.5; }
  private espera(ms: number): Promise<void> { return new Promise(ok => this.time.delayedCall(ms, () => ok())); }
  private tween(cfg: Phaser.Types.Tweens.TweenBuilderConfig): Promise<void> {
    return new Promise(ok => this.tweens.add({ ...cfg, onComplete: () => ok() }));
  }

  // ---- La secuencia ----
  // Todos los tiempos van × `f` (más largo cuanto más alto el nivel al que evoluciona).
  private async contar(): Promise<void> {
    const d = this.d, H = VH * S, f = this.f, T = (ms: number) => ms * f, centroV = this.centroY(ancla(d.de.dex).alto);

    // 1. Se para todo: franjas de cine, oscuridad y el Pokémon al centro.
    this.son.latido();
    this.tweens.add({ targets: this.franjas[0], y: -SOBRA * S, duration: T(600), ease: 'Cubic.Out' });
    this.tweens.add({ targets: this.franjas[1], y: H - FRANJA * S, duration: T(600), ease: 'Cubic.Out' });
    // Empieza idéntico al del mapa (fotograma, dirección y luz) y lo tapa; luego se gira de frente y pierde la luz
    // del mapa mientras sube al centro.
    await this.tween({ targets: this.viejo, alpha: 1, duration: 120 });
    d.ocultar();
    this.time.delayedCall(T(450), () => poner(this.viejo, d.de.dex, 'Idle', 0));
    const luz = { u: 0 }, c0 = Phaser.Display.Color.IntegerToColor(d.tinte);
    this.tweens.add({ targets: luz, u: 1, duration: T(1000), onUpdate: () => {
      const c = Phaser.Display.Color.Interpolate.ColorWithColor(c0, Phaser.Display.Color.IntegerToColor(0xffffff), 1, luz.u);
      this.viejo.setTint(Phaser.Display.Color.GetColor(c.r, c.g, c.b));
    } });
    this.tweens.add({ targets: this.velo, fillAlpha: 0.88, duration: T(900) });
    await this.tween({ targets: [this.viejo, this.blanco], x: this.cx, y: this.pie, scale: this.E, duration: T(1000), ease: 'Cubic.InOut' });
    this.decir(`¿Eh? ¡${d.de.nombre} está evolucionando!`);
    poner(this.viejo, d.de.dex, 'Charge', 0);
    this.viejo.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => poner(this.viejo, d.de.dex, 'Idle', 0));
    this.tipos = d.de.tipos;
    this.enCentro = true;
    this.velo.fillAlpha = Math.max(this.velo.fillAlpha, 0.5);
    this.tweens.add({ targets: this.velo, fillAlpha: VELO_TIPO[d.de.tipos[0]]?.[1] ?? 0.88, duration: T(900) });
    const subeK = this.tweens.add({ targets: this, k: 1, duration: T(500 + CARGA + SILUETAS), ease: 'Sine.In' });
    await this.espera(T(500));

    // 2. Concentra la luz (el zumbido dura la concentración y las siluetas).
    this.son.dron((CARGA + SILUETAS) * f / 1000);
    if (f > 1.3) for (let i = 1; i * 1600 < T(CARGA); i++) this.time.delayedCall(1600 * i, () => this.son.latido());
    this.emitir = 10;
    this.tweens.add({ targets: this, emitir: 40, duration: T(CARGA) - 100 });
    this.tweens.add({ targets: this.halo, alpha: 0.75, scale: 1.4 * S / 3, duration: T(CARGA) * 0.9 });
    this.tweens.add({ targets: this.blanco, alpha: 1, duration: T(CARGA) - 100, ease: 'Sine.In' });
    for (let i = 0; i * 400 < T(CARGA) - 300; i++) this.time.delayedCall(400 * i, () => this.onda(this.cx, centroV, 0.8, 900, 0.5, true));
    await this.espera(T(CARGA));

    // 3. Siluetas que se alternan cada vez más deprisa: llegan al ritmo más rápido al 80 % y lo aguantan.
    this.viejo.setVisible(false); this.blanco.setVisible(false);
    this.silV.setVisible(true);
    // A mitad de la animación, si gana un tipo o cambia de tipo, empiezan a salir también las partículas del nuevo
    // (con una ráfaga suya); desde el estallido quedan solo los de la forma nueva.
    const nuevos = d.a.tipos.filter(q => !d.de.tipos.includes(q));
    if (nuevos.length) {
      this.tipos = [...d.de.tipos, ...nuevos];
      for (const t of nuevos) { const ef = crearEfecto(t, this.lz); ef.estallido(0.35); this.efectos.push({ t, ef }); }
    }
    const total = T(SILUETAS), ms0 = T(440), MIN = 42, r = Math.max(0.6, 1 - (ms0 - MIN) / (total * 0.8));
    const inicio = this.time.now;
    let ms = ms0, n = 0, t = 0;
    while (t < total) {
      const nueva = n % 2 === 0;
      this.silV.setVisible(!nueva); this.silN.setVisible(nueva);
      const s = nueva ? this.silN : this.silV;
      s.setScale(this.E * 1.1);
      this.tweens.add({ targets: s, scale: this.E, duration: Math.min(160, ms * 0.8), ease: 'Back.Out' });
      this.son.cambio(Math.min(1, t / total));
      if (ms > 120) this.onda(this.cx, centroV, 1.1, 500, 0.35);
      this.temblor(ms, 0.0015 + 0.006 * (t / total));
      this.halo.setScale((1.4 + 0.5 * (t / total)) * S / 3 * (nueva ? 1.08 : 1));
      await this.espera(ms);
      t = this.time.now - inicio; n++;   // por reloj: las esperas cortas se redondean a fotogramas
      ms = Math.max(MIN, ms * r);
    }

    // 4. Estallido: ya con los tipos de la forma nueva.
    this.emitir = 0;
    this.son.pararDron();
    this.son.explosion();
    this.tipos = d.a.tipos;
    subeK.stop();
    this.fase = 'final'; this.k = 0.5;
    this.tweens.killTweensOf(this.velo);
    this.velo.setFillStyle(VELO_TIPO[d.a.tipos[0]]?.[0] ?? 0x05070c, VELO_TIPO[d.a.tipos[0]]?.[1] ?? 0.88);
    // Los efectos del tipo que pierde se acaban; los de la forma nueva estallan.
    this.efectos = this.efectos.filter(q => d.a.tipos.includes(q.t));
    for (const t of d.a.tipos) if (!this.efectos.some(q => q.t === t)) this.efectos.push({ t, ef: crearEfecto(t, this.lz) });
    this.silV.setVisible(false); this.silN.setVisible(true).setScale(this.E);
    // Destello blanco (antes que los estallidos de cada tipo, para que sus destellos de color no lo tiñan).
    this.tweens.killTweensOf(this.destello);
    this.destello.setFillStyle(0xffffff, 1);
    for (const q of this.efectos) q.ef.estallido(1);
    this.temblor(T(700), 0.02);
    const centroN = this.centroY(ancla(d.a.dex).alto);
    this.rayos.forEach(q => q.setPosition(this.cx, centroN));
    this.halo.setPosition(this.cx, centroN);
    for (let i = 0; i < 3; i++) this.time.delayedCall(i * 140 * f, () => this.onda(this.cx, centroN, 5 + i * 1.5, T(1100), 1));
    this.estallido(this.cx, centroN);
    // Los rayos solo salen aquí, al final (antes se comían las partículas de tipo), y se van apagando.
    this.giroRayos = 1.6;
    this.tweens.add({ targets: this.destello, fillAlpha: 0, duration: T(1100), ease: 'Quad.In' });
    this.tweens.add({ targets: this.rayos, alpha: 0.75, duration: 250 });
    await this.espera(T(450));
    this.son.fanfarria();
    this.nuevo.setVisible(true);
    poner(this.nuevo, d.a.dex, 'Charge', 0);
    this.nuevo.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => poner(this.nuevo, d.a.dex, 'Idle', 0));
    this.tweens.add({ targets: this.silN, alpha: 0, duration: T(900), ease: 'Quad.In' });
    this.tweens.add({ targets: this, giroRayos: 0.3, duration: T(2500) });
    this.tweens.add({ targets: this.rayos, alpha: 0, delay: T(600), duration: T(2600) });
    await this.espera(T(900));

    // 5. Mensajes.
    this.mostrarFicha();
    this.decir(`¡Enhorabuena! ¡Tu ${d.de.nombre} ha evolucionado en ${d.a.nombre}!`);
    await this.siguiente();
    for (const m of d.aprende) {
      this.son.aprende();
      this.decir(`¡${d.a.nombre} ha aprendido ${m}!`);
      await this.siguiente();
    }

    // Vuelta al juego.
    this.cerrarDialogo();
    this.efectos = [];
    this.enCentro = false;
    this.ficha.forEach(o => this.tweens.add({ targets: o, alpha: 0, duration: 300 }));
    this.tweens.add({ targets: [...this.rayos, this.halo], alpha: 0, duration: 600 });
    this.tweens.add({ targets: this.velo, fillAlpha: 0, duration: 800 });
    this.tweens.add({ targets: this.franjas[0], y: -(FRANJA + SOBRA) * S, duration: 600, ease: 'Cubic.In' });
    this.tweens.add({ targets: this.franjas[1], y: H, duration: 600, ease: 'Cubic.In' });
    poner(this.nuevo, d.a.dex, 'Idle', 0);
    await this.tween({ targets: this.nuevo, x: d.x, y: d.y, scale: d.escala, duration: 800, ease: 'Cubic.InOut' });
    d.fin();
    this.scene.stop();
  }

  // ---- Efectos ----
  private texturas(): void {
    const tx = this.textures;
    const lienzo = (key: string, n: number, pinta: (g: CanvasRenderingContext2D, n: number) => void) => {
      if (tx.exists(key)) return;
      const c = tx.createCanvas(key, n, n)!;
      pinta(c.getContext(), n);
      c.refresh(); c.setFilter(Phaser.Textures.FilterMode.LINEAR);
    };
    lienzo('evo-halo', 256, (g, n) => {
      const r = g.createRadialGradient(n / 2, n / 2, 0, n / 2, n / 2, n / 2);
      r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.25, 'rgba(255,255,255,0.55)'); r.addColorStop(0.6, 'rgba(255,255,255,0.12)'); r.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = r; g.fillRect(0, 0, n, n);
    });
    lienzo('evo-punto', 32, (g, n) => {
      const r = g.createRadialGradient(n / 2, n / 2, 0, n / 2, n / 2, n / 2);
      r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.3, 'rgba(255,255,255,0.8)'); r.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = r; g.fillRect(0, 0, n, n);
    });
    // Rayos: cuñas alternas que se desvanecen hacia fuera.
    lienzo('evo-rayos', 512, (g, n) => {
      const c = n / 2, k = 18;
      for (let i = 0; i < k; i++) {
        const a = (i / k) * Math.PI * 2, w = (Math.PI / k) * (0.35 + 0.5 * ((i * 7) % 5) / 4);
        g.beginPath(); g.moveTo(c, c); g.arc(c, c, c, a - w / 2, a + w / 2); g.closePath();
        g.fillStyle = 'rgba(255,255,255,1)'; g.fill();
      }
      g.globalCompositeOperation = 'destination-in';
      const r = g.createRadialGradient(c, c, 0, c, c, c);
      r.addColorStop(0, 'rgba(0,0,0,0.9)'); r.addColorStop(0.35, 'rgba(0,0,0,0.45)'); r.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = r; g.fillRect(0, 0, n, n);
    });
    // Estrella de cuatro puntas.
    lienzo('evo-estrella', 64, (g, n) => {
      const c = n / 2;
      g.fillStyle = 'rgba(255,255,255,1)';
      g.beginPath();
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2 - Math.PI / 2, r = i % 2 ? c * 0.16 : c * 0.95;
        g.lineTo(c + Math.cos(a) * r, c + Math.sin(a) * r);
      }
      g.closePath(); g.fill();
      const r = g.createRadialGradient(c, c, 0, c, c, c * 0.4);
      r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = r; g.fillRect(0, 0, n, n);
    });
    lienzo('evo-anillo', 256, (g, n) => {
      const c = n / 2;
      for (let i = 0; i < 6; i++) {
        g.strokeStyle = `rgba(255,255,255,${0.15 + i * 0.12})`; g.lineWidth = 12 - i * 2;
        g.beginPath(); g.arc(c, c, c - 8, 0, Math.PI * 2); g.stroke();
      }
    });
  }

  // Onda que se abre (o, `hacia`, que se cierra sobre el Pokémon).
  private onda(x: number, y: number, esc: number, ms: number, alfa: number, hacia = false): void {
    const s = esc * S / 3, s0 = hacia ? s : s * 0.08, s1 = hacia ? s * 0.08 : s;
    const o = this.add.image(x, y, 'evo-anillo').setBlendMode(Phaser.BlendModes.ADD).setTint(hacia ? this.d.color : 0xffffff)
      .setScale(s0, s0 * 0.85).setAlpha(hacia ? 0 : alfa);
    this.tweens.add({ targets: o, scaleX: s1, scaleY: s1 * 0.85, alpha: hacia ? alfa : 0, duration: ms, ease: hacia ? 'Quad.In' : 'Cubic.Out', onComplete: () => o.destroy() });
  }
  // ---- Partículas (de cada tipo: fx/particulasTipo.ts) ----
  private parte(key: string, p: Partial<Part> & { x: number; y: number }, tinte: number, normal = false): Part {
    const img = this.add.image(p.x, p.y, key).setTint(tinte).setBlendMode(normal ? Phaser.BlendModes.NORMAL : Phaser.BlendModes.ADD).setDepth(20);
    const q: Part = {
      img, vida: 0, dura: 1, a0: 1, e0: 1, e1: 0, modo: 'libre', vx: 0, vy: 0, g: 0, ang: 0, r: 0, w: 0, vr: 0, giro: 0, rMin: 6 * S, ry: 0.7, ax: 1, ay: 2,
      zig: 0, vaiven: 0, fase: Math.random() * 10, parpadeo: false, orienta: false, arrastre: 0.8, pico: false, prof: false, estela: 0, hist: [], px: p.x, py: p.y, ...p,
    };
    this.parts.push(q);
    return q;
  }
  // El estilo del siguiente tipo (con dos tipos, uno y uno) y una forma y un color suyos.
  private estilo(): { e: EstiloTipo; forma: string; color: number; tam: number } {
    const t = this.tipos[this.nTipo++ % Math.max(1, this.tipos.length)] ?? 'Normal', e = ESTILO_TIPO[t] ?? ESTILO_TIPO.Normal;
    const elige = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];
    return { e, forma: elige(e.formas), color: elige(e.colores), tam: (e.tam[0] + Math.random() * (e.tam[1] - e.tam[0])) * S };
  }
  private rasgos(e: EstiloTipo): Partial<Part> {
    return { zig: (e.zig ?? 0) * S, vaiven: (e.vaiven ?? 0) * S, parpadeo: !!e.parpadeo, orienta: !!e.orienta };
  }
  private cuerpo(): { y: number; alto: number } {
    const alto = ancla(this.nuevo.visible ? this.d.a.dex : this.d.de.dex).alto * this.E;
    return { y: this.pie - this.lz.flotar - alto * 0.5, alto };
  }
  // Chispa que cae en espiral hacia el Pokémon, con la forma de su tipo.
  private chispa(): void {
    const { e, forma, color, tam } = this.estilo(), ang = Math.random() * Math.PI * 2, r = (150 + Math.random() * 90) * S;
    const blanca = !e.normal && Math.random() < 0.3;
    this.parte(forma, {
      modo: 'hacia', x: this.cx, y: this.cuerpo().y, ang, r, w: (Math.random() < 0.5 ? -1 : 1) * (1.2 + Math.random()), vr: (90 + Math.random() * 70) * S,
      dura: 9, a0: 0.95, e0: tam, e1: tam * 0.3, giro: (Math.random() - 0.5) * 2 * e.giro, ...this.rasgos(e),
    }, blanca ? 0xffffff : color, e.normal);
    if (Math.random() < 0.08) this.son.chispa();
  }
  private estallido(x: number, y: number): void {
    for (let i = 0; i < 45; i++) {
      const a = Math.random() * Math.PI * 2, v = (60 + Math.random() * 260) * S;
      if (i % 3) this.parte(i % 2 ? 'evo-punto' : 'evo-estrella', {
        x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v * 0.8, g: 60 * S, dura: 0.8 + Math.random(), e0: (0.15 + Math.random() * 0.3) * S, e1: 0.02 * S, giro: (Math.random() - 0.5) * 8,
      }, 0xffffff);
      else {
        const { e, forma, color, tam } = this.estilo();
        this.parte(forma, {
          x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v * 0.8, g: 60 * S, dura: 1 + Math.random(), e0: tam * 1.4, e1: tam * 0.4, giro: (Math.random() - 0.5) * 2 * e.giro, ...this.rasgos(e),
        }, color, e.normal);
      }
    }
  }
  update(_t: number, dtMs: number): void {
    const dt = Math.min(0.05, dtMs / 1000);
    this.rayos.forEach((r, i) => { r.rotation += (i ? -1 : 1) * this.giroRayos * dt * (i ? 0.7 : 1); });
    // La copia blanca sigue al fotograma del Pokémon.
    if (this.blanco.visible && this.viejo.frame) {
      this.blanco.setTexture(this.viejo.texture.key, this.viejo.frame.name).setOrigin(this.viejo.originX, this.viejo.originY);
      this.blanco.setPosition(this.viejo.x, this.viejo.y).setScale(this.viejo.scaleX, this.viejo.scaleY);
    }
    // Emisores y coreografía de cada tipo.
    for (this.acum += dt * this.emitir; this.acum >= 1; this.acum--) this.chispa();
    this.g.clear(); this.gN.clear();
    this.lz.flotar = 0; this.lz.alfaPk = 1;
    for (const q of this.efectos) q.ef.paso(dt, this.k, this.fase);
    // Levitar (Psíquico) y desvanecerse (Fantasma).
    if (this.enCentro) {
      for (const s of [this.viejo, this.blanco, this.silV, this.silN, this.nuevo]) s.y = this.pie - this.lz.flotar;
      if (this.fase === 'carga') for (const s of [this.viejo, this.silV, this.silN]) s.setAlpha(this.lz.alfaPk);
    }
    // Partículas.
    for (let i = this.parts.length - 1; i >= 0; i--) {
      const p = this.parts[i];
      p.vida += dt;
      let k = p.vida / p.dura, x = p.x, y = p.y, alfa = p.a0, dir = 0;
      if (p.modo === 'hacia') {
        p.vr *= 1 + dt * 1.6; p.r -= p.vr * dt; p.ang += p.w * dt * (1 + 80 * S / Math.max(20 * S, p.r));
        x = p.x + Math.cos(p.ang) * p.r; y = p.y + Math.sin(p.ang) * p.r * 0.8;
        dir = Math.atan2(y - p.py, x - p.px);
        if (p.r <= p.rMin) k = 1;
        alfa *= Math.min(1, p.vida * 4);
      } else if (p.modo === 'orbita' || p.modo === 'lazo') {
        p.ang += p.w * dt; p.y += p.vy * dt;
        if (p.modo === 'orbita') {
          p.r = Math.max(p.rMin, p.r - p.vr * dt);
          x = p.x + Math.cos(p.ang) * p.r; y = p.y + Math.sin(p.ang) * p.r * p.ry;
          if (p.prof) p.img.setDepth(Math.sin(p.ang) > 0 ? 21 : 5);
        } else { x = p.x + Math.sin(p.ang * p.ax + p.fase) * p.r; y = p.y + Math.sin(p.ang * p.ay) * p.r * p.ry; }
        dir = Math.atan2(y - p.py, x - p.px);
        alfa *= Math.min(1, p.vida * 3) * (p.dura > 50 ? 1 : 1 - Math.pow(Math.min(1, k), 4));
      } else if (p.modo === 'helice') {
        p.ang += p.w * dt; p.y += p.vy * dt;
        const delante = Math.sin(p.ang);
        x = this.cx + Math.cos(p.ang) * p.r; y = p.y + delante * p.r * 0.25;
        alfa *= (1 - k * k) * (0.55 + 0.45 * delante);
      } else if (p.modo === 'libre') {
        p.vy += p.g * dt; p.vx *= 1 - dt * p.arrastre; p.vy *= 1 - dt * p.arrastre * 0.4;
        if (p.atrae) p.vx += (this.cx - p.x) * p.atrae * dt;
        p.x += p.vx * dt; p.y += p.vy * dt;
        x = p.x; y = p.y; dir = Math.atan2(p.vy, p.vx);
        alfa *= p.pico ? Math.sin(Math.PI * Math.min(1, k)) : 1 - k * k;
      } else alfa *= p.pico ? 1 : 1 - k;
      if (p.vaiven) x += Math.sin(p.vida * 2.6 + p.fase) * p.vaiven;
      // Turbulencia común: el empuje de lado depende de la altura y del tiempo, así las llamas cercanas se mecen juntas.
      let empuje = 0;
      if (p.turb) { empuje = Math.sin(y / (26 * S) + this.time.now / 260) + 0.5 * Math.sin(y / (11 * S) - this.time.now / 170); x += empuje * p.turb * Math.min(1, k * 2); }
      if (p.zig) { x += (Math.random() - 0.5) * 2 * p.zig; y += (Math.random() - 0.5) * 2 * p.zig; }
      if (p.parpadeo) alfa *= p.zig ? (Math.random() < 0.7 ? 1 : 0.25) : 0.55 + 0.45 * Math.sin(p.vida * 9 + p.fase);
      p.img.setPosition(x, y).setAlpha(Math.max(0, alfa));
      p.px = x; p.py = y;
      // Estela: línea que se adelgaza y se apaga hacia atrás.
      if (p.estela) {
        p.hist.push(x, y);
        if (p.hist.length > p.estela * 2) p.hist.splice(0, 2);
        const n = p.hist.length / 2, color = p.img.tintTopLeft, ancho = Math.max(1, p.img.scaleX * 14);
        for (let j = 1; j < n; j++) {
          const u = j / n;
          this.g.lineStyle(ancho * u, color, alfa * u * 0.7).lineBetween(p.hist[j * 2 - 2], p.hist[j * 2 - 1], p.hist[j * 2], p.hist[j * 2 + 1]);
        }
      }
      let e = p.e0 + (p.e1 - p.e0) * Math.min(1, k);
      if (p.crece) { const u = Math.min(1, k); e = u < 0.18 ? p.e0 * (0.45 + 0.55 * u / 0.18) : p.e0 + (p.e1 - p.e0) * (u - 0.18) / 0.82; }
      if (p.pico && p.modo === 'fijo') e *= Math.sin(Math.PI * Math.min(1, k));
      if (p.titila) e *= 1 + (Math.random() - 0.5) * p.titila;
      // Llamas: cada poco cambian de forma y de lado.
      if (p.cambia && Math.floor(p.vida / 0.08) !== Math.floor((p.vida - dt) / 0.08)) p.img.setTexture(p.cambia[Math.floor(Math.random() * p.cambia.length)]).setFlipX(Math.random() < 0.5);
      p.img.setScale(e, e * (p.estiraFin !== undefined ? (p.estira ?? 1) + (p.estiraFin - (p.estira ?? 1)) * Math.min(1, k) : p.estira ?? 1));
      if (p.grad) {   // color según la vida
        const u = Math.min(0.999, k) * (p.grad.length - 1), j = Math.floor(u);
        const c = Phaser.Display.Color.Interpolate.ColorWithColor(Phaser.Display.Color.IntegerToColor(p.grad[j]), Phaser.Display.Color.IntegerToColor(p.grad[j + 1]), 1, u - j);
        p.img.setTint(Phaser.Display.Color.GetColor(c.r, c.g, c.b));
      }
      if (p.inclina !== undefined) p.img.rotation = (Math.atan2(p.vx + empuje * (p.turb ?? 0) * 3, -Math.min(-1, p.vy)) * p.inclina) + Math.sin(p.vida * 7 + p.fase) * 0.08;
      else if (p.orienta) p.img.rotation = dir - Math.PI / 2;
      else if (p.rot !== undefined) p.img.rotation = p.rot;
      else p.img.rotation += p.giro * dt;
      if (k >= 1) { p.fin?.(p); p.img.destroy(); this.parts.splice(i, 1); }
    }
    // Diálogo: letra a letra.
    if (this.letras < this.texto.length) {
      this.tTexto += dt;
      const n = Math.min(this.texto.length, Math.floor(this.tTexto * VEL_TEXTO));
      if (n > this.letras) {
        if (Math.floor(n / 2) !== Math.floor(this.letras / 2)) this.son.letra();
        this.letras = n; this.dlgTxt.setText(this.texto.slice(0, n));
      }
    }
    this.flecha.setVisible(!!this.esperando && this.letras >= this.texto.length && Math.floor(_t / 350) % 2 === 0);
  }

  // ---- Diálogo y ficha ----
  private crearDialogo(): void {
    const w = VW - 60, h = 40, x = 30, y = VH - h - 8;
    const g = this.add.graphics();
    marco(g, x, y, w, h, PANEL);
    this.dlgTxt = this.add.text((x + 10) * S, (y + 8) * S, '', { fontFamily: FUENTE_PX, fontSize: `${8.5 * S}px`, color: HEX(C.tinta), wordWrap: { width: (w - 26) * S }, lineSpacing: 2 * S });
    this.flecha = this.add.text((x + w - 10) * S, (y + h - 5) * S, '▼', { fontFamily: FUENTE_PX, fontSize: `${6 * S}px`, color: HEX(C.maderaClara) }).setOrigin(1, 1).setVisible(false);
    this.dlg = this.add.container(0, 0, [g, this.dlgTxt, this.flecha]).setDepth(40).setAlpha(0);
    this.dlg.y = 12 * S;
  }
  private decir(txt: string): void {
    this.texto = txt; this.letras = 0; this.tTexto = 0; this.dlgTxt.setText('');
    if (this.dlg.alpha < 1) this.tweens.add({ targets: this.dlg, alpha: 1, y: 0, duration: 260, ease: 'Back.Out' });
  }
  private cerrarDialogo(): void { this.tweens.add({ targets: this.dlg, alpha: 0, y: 12 * S, duration: 250 }); }
  private siguiente(): Promise<void> { return new Promise(ok => { this.esperando = ok; }); }
  private pulsar(): void {
    if (this.letras < this.texto.length) { this.letras = this.texto.length; this.dlgTxt.setText(this.texto); return; }
    const ok = this.esperando;
    if (!ok) return;
    this.esperando = null;
    this.son.pulsar();
    ok();
  }
  // Ficha a la derecha: cada stat antes → ahora, y cuánto ha subido.
  private mostrarFicha(): void {
    const { de, a } = this.d, w = 124, h = 20 + FILAS.length * 10 + 3, x = VW / 2 + 66, y = FRANJA + 14;
    const g = this.add.graphics();
    marco(g, x, y, w, h, PANEL);
    const t = (tx: number, ty: number, s: string, px: number, c: number, o: Phaser.Types.GameObjects.Text.TextStyle = {}) =>
      this.add.text(tx * S, ty * S, s, { fontFamily: FUENTE_PX, fontSize: `${px * S}px`, color: HEX(c), ...o });
    // Columnas: stat, antes, ahora (en negrita) y cuánto ha subido.
    const xa = x + 78, xn = x + 98;
    const objs: Phaser.GameObjects.GameObject[] = [g, t(x + 6, y + 5, a.nombre.toUpperCase(), 5.5, C.maderaClara, { fontFamily: FUENTE_TIT }),
      t(xa, y + 6, 'antes', 5, C.maderaClara).setOrigin(1, 0), t(xn, y + 6, 'ahora', 5, C.maderaClara).setOrigin(1, 0)];
    FILAS.forEach(([k, nombre], i) => {
      const yy = y + 18 + i * 10, sube = a.stats[k] - de.stats[k];
      objs.push(t(x + 6, yy, nombre, 6.5, C.tinta));
      objs.push(t(xa, yy, String(de.stats[k]), 6.5, C.maderaClara).setOrigin(1, 0));
      objs.push(t(xn, yy, String(a.stats[k]), 6.5, C.tinta, { fontStyle: 'bold' }).setOrigin(1, 0));
      objs.push(t(x + w - 6, yy, sube > 0 ? `+${sube}` : sube < 0 ? `${sube}` : '=', 6.5, sube > 0 ? 0x2f8a2a : sube < 0 ? 0xb03a2e : C.maderaClara, { fontStyle: 'bold' }).setOrigin(1, 0));
    });
    const c = this.add.container(30 * S, 0, objs).setDepth(40).setAlpha(0);
    this.tweens.add({ targets: c, x: 0, alpha: 1, duration: 450, ease: 'Back.Out' });
    this.ficha = [c];
  }
}
