// Coreografía de cada tipo en la cinemática de la evolución (src/scenes/Evolucion.ts). Cada tipo tiene su forma de
// reunir la energía (`paso`, cada fotograma, con la intensidad k de 0 a 1) y su estallido final, más el tinte del
// fondo. Un Pokémon de dos tipos lleva los dos a la vez. Lo que hace cada uno:
// - Normal: estrellas que llegan en línea recta y titilan en el fondo; estallido de estrellas con estela.
// - Fuego: llamas que rodean al Pokémon y le prenden, muro de llamas que sube por toda la pantalla, humo y ascuas;
//   nova de fuego por el suelo y columna de llamas.
// - Agua: gotas que orbitan con estela, ondas en el suelo y burbujas; fuente de gotas.
// - Eléctrico: relámpagos que caen del cielo con destello, arcos sobre el cuerpo; relámpagos en todas direcciones.
// - Planta: tornado de hojas que sube y polen; hojas que salen volando y caen meciéndose.
// - Hielo: ventisca de lado, esquirlas que se clavan alrededor y escarcha en el suelo; el hielo se rompe.
// - Lucha: líneas de velocidad hacia el cuerpo y pulsos de fuerza con temblor; impacto con trazos.
// - Veneno: charco tóxico, burbujas que suben y revientan, niebla; estallido de burbujas.
// - Tierra: temblor, grietas que crecen, piedras y polvo que saltan; erupción y anillo de polvo.
// - Volador: corrientes de viento con estela larga, plumas y ráfagas; plumas y anillos de viento.
// - Psíquico: el Pokémon levita, anillos que se cierran y motas en lazos; ondas psíquicas.
// - Bicho: enjambre de luciérnagas en lazos con estela; el enjambre se dispersa.
// - Roca: rocas que orbitan (cada vez más) y piedrecitas que caen; las rocas salen disparadas.
// - Fantasma: fuegos fatuos que orbitan con estela y el Pokémon se desvanece a ratos; los fuegos se dispersan.
// - Dragón: aura de llamas, hélice de escamas y columna de energía; rugido con ondas y temblor.
// - Siniestro: sombras que avanzan desde los bordes y ojos rojos en la oscuridad; la oscuridad estalla.
// - Acero: brillo metálico que barre el cuerpo, destellos y placas en órbita; anillo metálico.
// - Hada: corazones que suben, espiral de estrellas con estela y destellos; lluvia de corazones.
import Phaser from 'phaser';
import type { TypeName } from '../data/movimientos';
import { ESTILO_TIPO, type EstiloTipo } from './particulasTipo';
import type { SonidoEvolucion } from './sonidoEvolucion';

// Una partícula de la cinemática (la mueve Evolucion.update).
export interface Part {
  img: Phaser.GameObjects.Image; vida: number; dura: number; a0: number; e0: number; e1: number;
  // 'hacia': cae hacia (x, y) en espiral (w = 0: en recta) hasta rMin; 'libre': velocidad, gravedad y arrastre;
  // 'helice': sube girando; 'orbita': órbita elíptica alrededor de (x, y), que puede cerrarse (vr) y subir (vy);
  // 'lazo': curva de Lissajous alrededor de (x, y); 'fijo': quieta.
  modo: 'hacia' | 'libre' | 'helice' | 'orbita' | 'lazo' | 'fijo';
  x: number; y: number; vx: number; vy: number; g: number; ang: number; r: number; w: number; vr: number; giro: number;
  rMin: number; ry: number; ax: number; ay: number;
  zig: number; vaiven: number; fase: number; parpadeo: boolean; orienta: boolean; arrastre: number;
  pico: boolean;               // aparece y se apaga (alfa y, si es fija, tamaño)
  prof: boolean;               // en órbita, detrás del Pokémon cuando pasa por detrás
  estela: number;              // puntos de estela (0 = sin estela)
  hist: number[];              // posiciones recientes (x, y, x, y…)
  px: number; py: number;      // posición anterior (para orientarla)
  rot?: number;
  grad?: number[];             // colores a lo largo de su vida (fuego: blanco → amarillo → naranja → rojo)
  estira?: number;             // alto/ancho (llamas alargadas)
  titila?: number;             // cuánto tiembla su tamaño (llamas)
  atrae?: number;              // se va inclinando hacia el centro (x) mientras sube
  cambia?: string[];           // texturas entre las que salta al titilar
  inclina?: number;            // se inclina hacia donde la empuja el aire y cabecea un poco (llamas)
  crece?: boolean;             // nace pequeña, crece deprisa y luego mengua (llamas)
  estiraFin?: number;          // alto/ancho al final de su vida (se alarga al subir)
  turb?: number;               // turbulencia: el aire la mueve de lado igual que a sus vecinas (px)
  fin?: (p: Part) => void;     // al apagarse sola
}

// Lo que la escena pone a disposición de los efectos (px de pantalla).
export interface Lienzo {
  S: number; W: number; H: number; franja: number; cx: number; pie: number;
  cuerpo(): { y: number; alto: number; ancho: number };
  parte(key: string, p: Partial<Part> & { x: number; y: number }, tinte: number, normal?: boolean): Part;
  g: Phaser.GameObjects.Graphics;     // sumando luz, delante del Pokémon (se borra cada fotograma)
  gN: Phaser.GameObjects.Graphics;    // normal, detrás del Pokémon (se borra cada fotograma)
  temblor(ms: number, fuerza: number): void;
  flash(color: number, alfa: number, ms: number): void;
  flotar: number;                     // px que levita el Pokémon (lo pone el efecto cada fotograma)
  alfaPk: number;                     // transparencia del Pokémon
  son: SonidoEvolucion;
}
export type Fase = 'carga' | 'final';
export interface EfectoTipo { paso(dt: number, k: number, fase: Fase): void; estallido(fuerza: number): void }

// Tinte del fondo oscuro de cada tipo (y cuánto tapa).
export const VELO_TIPO: Record<TypeName, [number, number]> = {
  Normal: [0x0a0a0e, 0.89], Fire: [0x1c0802, 0.89], Water: [0x020e22, 0.89], Electric: [0x0e0c02, 0.91], Grass: [0x041206, 0.89],
  Ice: [0x041420, 0.87], Fighting: [0x180402, 0.89], Poison: [0x10041a, 0.90], Ground: [0x160c02, 0.89], Flying: [0x080c1a, 0.87],
  Psychic: [0x16041a, 0.89], Bug: [0x081004, 0.91], Rock: [0x120c06, 0.89], Ghost: [0x0a0418, 0.95], Dragon: [0x0a0420, 0.91],
  Dark: [0x000000, 0.96], Steel: [0x0a0c12, 0.88], Fairy: [0x1a0814, 0.87],
};

const rnd = (a: number, b: number) => a + Math.random() * (b - a);
const elige = <T,>(a: T[]): T => a[Math.floor(Math.random() * a.length)];
// Cuántas salen este fotograma a `porSeg` por segundo.
class Ritmo {
  private acc = 0;
  n(dt: number, porSeg: number): number { this.acc += dt * Math.max(0, porSeg); const n = Math.floor(this.acc); this.acc -= n; return n; }
}
// Cada cuánto pasa algo (con un poco de azar).
class Cada {
  private t = 0;
  toca(dt: number, seg: number): boolean { this.t -= dt; if (this.t > 0) return false; this.t = seg * rnd(0.75, 1.25); return true; }
}

// Relámpago quebrado de (x0, y0) a (x1, y1).
function quebrar(x0: number, y0: number, x1: number, y1: number, desv: number, n = 5): number[] {
  let pts = [x0, y0, x1, y1];
  for (let i = 0; i < n; i++) {
    const out: number[] = [];
    for (let j = 0; j < pts.length - 2; j += 2) {
      const ax = pts[j], ay = pts[j + 1], bx = pts[j + 2], by = pts[j + 3], l = Math.hypot(bx - ax, by - ay);
      out.push(ax, ay, (ax + bx) / 2 + (Math.random() - 0.5) * desv * l / 100 * 2, (ay + by) / 2 + (Math.random() - 0.5) * desv * l / 100);
    }
    out.push(pts[pts.length - 2], pts[pts.length - 1]);
    pts = out; desv *= 0.6;
  }
  return pts;
}
function trazo(g: Phaser.GameObjects.Graphics, pts: number[], ancho: number, color: number, alfa: number): void {
  for (const [w, c, a] of [[ancho * 3.5, color, 0.25], [ancho, color, 0.9], [ancho * 0.4, 0xffffff, 1]] as [number, number, number][]) {
    g.lineStyle(w, c, a * alfa).beginPath().moveTo(pts[0], pts[1]);
    for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]);
    g.strokePath();
  }
}

type Fabrica = (lz: Lienzo, e: EstiloTipo) => EfectoTipo;
const col = (e: EstiloTipo) => elige(e.colores);
const tam = (lz: Lienzo, e: EstiloTipo, m = 1) => rnd(e.tam[0], e.tam[1]) * lz.S * m * 1.25;
// Desde un punto del contorno de la pantalla, hacia dentro.
function borde(lz: Lienzo): [number, number] {
  const t = Math.random() * 2 * (lz.W + lz.H);
  if (t < lz.W) return [t, lz.franja];
  if (t < 2 * lz.W) return [t - lz.W, lz.H - lz.franja];
  return [t < 2 * lz.W + lz.H ? -10 : lz.W + 10, lz.franja + Math.random() * (lz.H - 2 * lz.franja)];
}
// Partículas que salen del cuerpo en todas direcciones.
function radial(lz: Lienzo, e: EstiloTipo, n: number, v: [number, number], extra: Partial<Part> = {}, forma?: string): void {
  const c = lz.cuerpo(), S = lz.S;
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, vel = rnd(v[0], v[1]) * S;
    lz.parte(forma ?? elige(e.formas), { x: lz.cx, y: c.y, vx: Math.cos(a) * vel, vy: Math.sin(a) * vel * 0.8, arrastre: 1.6, dura: rnd(0.9, 1.6), e0: tam(lz, e, 1.2), e1: tam(lz, e, 0.3), giro: rnd(-1, 1) * e.giro, ...extra }, col(e), e.normal);
  }
}

const EFECTOS: Record<TypeName, Fabrica> = {
  Normal: (lz, e) => {
    const fondo = new Ritmo(), llegan = new Ritmo(), S = lz.S;
    return {
      paso(dt, k, fase) {
        for (let i = fondo.n(dt, fase === 'carga' ? 8 + 14 * k : 5); i--;)
          lz.parte('evo-estrella', { modo: 'fijo', x: rnd(0, lz.W), y: rnd(lz.franja, lz.H - lz.franja), dura: rnd(0.8, 1.6), pico: true, e0: rnd(0.06, 0.14) * S, e1: 0, rot: 0 }, col(e));
        if (fase === 'carga') for (let i = llegan.n(dt, 4 + 10 * k); i--;) {
          const c = lz.cuerpo();
          lz.parte('evo-estrella', { modo: 'hacia', x: lz.cx, y: c.y, ang: Math.random() * Math.PI * 2, r: rnd(200, 260) * S, w: 0, vr: rnd(140, 200) * S, rMin: 8 * S, dura: 9, e0: tam(lz, e), e1: tam(lz, e, 0.4), estela: 7, giro: 2 }, col(e));
        }
      },
      estallido(f) {
        radial(lz, e, Math.round(10 * f), [300, 420], { estela: 9, arrastre: 2.5, e0: 0.4 * S, e1: 0.1 * S }, 'evo-estrella');
        radial(lz, e, Math.round(20 * f), [80, 200], {}, 'evo-estrella');
      },
    };
  },

  Fire: (lz, e) => {
    // Fuego. Para que parezca de verdad:
    // - Las llamas nacen en focos (puntos que arden un rato y se mueven despacio), no repartidas al azar: salen en
    //   grupos que se solapan, unas pegadas a otras.
    // - Cada llama nace pequeña, crece deprisa y luego mengua; se alarga mientras sube y pasa de blanco a rojo.
    // - Se inclina hacia donde la empuja el aire y cabecea un poco; el aire (turbulencia) mece igual a las vecinas.
    // - Las de abajo son anchas y lentas, las de la punta finas y rápidas.
    // El anillo de los pies se cierra y prende el cuerpo cuando la evolución avanza; abajo, focos por toda la pantalla.
    // Además: chispas que saltan en arco, ascuas y humo.
    const anillo = new Ritmo(), cuerpo = new Ritmo(), ascuas = new Ritmo(), humo = new Ritmo(), muro = new Ritmo(), chispas = new Ritmo(), S = lz.S;
    const FUEGO = [0xfff6d0, 0xffd040, 0xff8a18, 0xd83a08, 0x501004], CHISPA = [0xffffe0, 0xffe070, 0xff9a30];
    type Foco = { a: number; x: number; vida: number; dura: number; fuerza: number };
    const focosAnillo: Foco[] = [], focosMuro: Foco[] = [];
    const renovar = (focos: Foco[], n: number, nuevo: () => Foco, dt: number) => {
      for (let i = focos.length - 1; i >= 0; i--) { focos[i].vida += dt; if (focos[i].vida > focos[i].dura) focos.splice(i, 1); }
      while (focos.length < n) focos.push(nuevo());
    };
    // Fuerza de un foco a lo largo de su vida (se aviva y se apaga).
    const aviva = (f: Foco) => f.fuerza * Math.sin(Math.PI * Math.min(1, f.vida / f.dura));
    const llama = (x: number, y: number, w: number, vy: number, extra: Partial<Part> = {}) => {
      const punta = Math.random() < 0.35;   // las de la punta: finas, rápidas y cortas
      return lz.parte('p-llama', {
        x, y, vx: rnd(-6, 6) * S, vy: -vy * S * (punta ? 1.5 : 1), arrastre: 0.25, dura: punta ? rnd(0.35, 0.6) : rnd(0.6, 1),
        e0: w * (punta ? 0.55 : 1), e1: w * 0.2, crece: true, estira: rnd(1.1, 1.35), estiraFin: punta ? rnd(2.2, 2.8) : rnd(1.6, 2.1),
        inclina: 0.8, turb: 5 * S, titila: 0.08, grad: FUEGO, a0: punta ? 0.8 : 0.95, ...extra,
      }, FUEGO[0]);
    };
    const chispa = (x: number, y: number, v: number) => {
      const a = -Math.PI / 2 + rnd(-0.7, 0.7);
      lz.parte('p-chispa', { x, y, vx: Math.cos(a) * v * S, vy: Math.sin(a) * v * S, g: 320 * S, arrastre: 0.4, dura: rnd(0.5, 0.9), e0: rnd(0.12, 0.2) * S, e1: 0.05 * S, estira: 0.6, orienta: true, estela: 3, grad: CHISPA }, CHISPA[0]);
    };
    return {
      paso(dt, k, fase) {
        const c = lz.cuerpo(), carga = fase === 'carga', rx = (carga ? 62 - 26 * k : 40) * S;
        // Focos del anillo (alrededor de los pies) y del suelo de la pantalla.
        renovar(focosAnillo, carga ? 5 + Math.round(5 * k) : 5, () => ({ a: Math.random() * Math.PI * 2, x: 0, vida: 0, dura: rnd(1, 2.2), fuerza: rnd(0.7, 1.2) }), dt);
        renovar(focosMuro, carga ? 4 + Math.round(6 * k) : 5, () => ({ a: 0, x: rnd(0, lz.W), vida: 0, dura: rnd(1.4, 2.8), fuerza: rnd(0.7, 1.2) }), dt);
        for (const f of focosAnillo) f.a += dt * 0.25;
        // Llamas del suelo de la pantalla: grupos grandes y suaves en cada foco.
        for (let i = muro.n(dt, carga ? 10 + 24 * k : 10); i--;) {
          const f = elige(focosMuro), fu = aviva(f), w = rnd(0.4, 0.62) * S * (carga ? 0.8 + 0.5 * k : 1) * (0.6 + 0.4 * fu);
          llama(f.x + rnd(-18, 18) * S, lz.H - lz.franja + rnd(6, 16) * S, w, rnd(70, 140) * (carga ? 0.6 + 0.8 * k : 1) * (0.7 + 0.3 * fu), { dura: rnd(0.9, 1.5), a0: 0.6 }).img.setDepth(4);
        }
        // Anillo de llamas a los pies, en grupos, que se va cerrando y se inclina hacia el centro.
        for (let i = anillo.n(dt, carga ? 18 + 30 * k : 14); i--;) {
          const f = elige(focosAnillo), a = f.a + rnd(-0.25, 0.25), r = rx * rnd(0.85, 1.05), fu = aviva(f);
          llama(lz.cx + Math.cos(a) * r, lz.pie + Math.sin(a) * r * 0.28, rnd(0.26, 0.38) * S * (carga ? 1 + 0.5 * k : 0.9) * (0.6 + 0.4 * fu), rnd(55, 95) * (carga ? 1 + 0.6 * k : 1), { atrae: rnd(0.7, 1.2) })
            .img.setDepth(Math.sin(a) > 0 ? 21 : 5);
        }
        // El cuerpo prende.
        if (!carga || k > 0.45) for (let i = cuerpo.n(dt, carga ? 26 * (k - 0.45) : 5); i--;)
          llama(lz.cx + rnd(-0.4, 0.4) * c.ancho, c.y + rnd(-0.1, 0.5) * c.alto, rnd(0.2, 0.3) * S, rnd(70, 120), { atrae: 0.8 }).img.setDepth(Math.random() < 0.6 ? 21 : 5);
        // Chispas que saltan en arco desde los focos.
        for (let i = chispas.n(dt, carga ? 6 + 22 * k : 6); i--;) {
          if (Math.random() < 0.65) { const f = elige(focosAnillo); chispa(lz.cx + Math.cos(f.a) * rx, lz.pie + Math.sin(f.a) * rx * 0.28, rnd(180, 320)); }
          else chispa(elige(focosMuro).x + rnd(-15, 15) * S, lz.H - lz.franja, rnd(220, 380));
        }
        // Humo oscuro encima.
        for (let i = humo.n(dt, carga ? 2 + 5 * k : 2); i--;)
          lz.parte('p-humo', { x: lz.cx + rnd(-40, 40) * S, y: c.y - c.alto * rnd(0.4, 0.8), vx: rnd(-10, 10) * S, vy: -rnd(25, 45) * S, arrastre: 0, turb: 8 * S, dura: rnd(1.8, 2.6), pico: true, a0: 0.4, e0: rnd(0.4, 0.6) * S, e1: rnd(1, 1.4) * S }, 0x2a160c, true).img.setDepth(4);
        // Ascuas que suben haciendo eses.
        for (let i = ascuas.n(dt, carga ? 6 + 14 * k : 6); i--;)
          lz.parte('evo-punto', { x: lz.cx + rnd(-140, 140) * S, y: lz.pie + rnd(-10, 10) * S, vx: rnd(-20, 20) * S, vy: -rnd(60, 130) * S, arrastre: 0.2, turb: 10 * S, zig: 0.3 * S, dura: rnd(1.4, 2.4), e0: rnd(0.06, 0.1) * S, e1: 0.02 * S, estela: 5, grad: [0xffe8a0, 0xff9a30, 0xd04010] }, 0xffe8a0);
      },
      estallido(f) {
        const c = lz.cuerpo();
        // Nova: un anillo de llamas que se abre por el suelo.
        for (let i = 0; i < 44 * f; i++) {
          const a = (i / (44 * f)) * Math.PI * 2 + rnd(-0.05, 0.05), v = rnd(200, 300);
          llama(lz.cx + Math.cos(a) * 20 * S, lz.pie + Math.sin(a) * 6 * S, rnd(0.32, 0.45) * S, 20, { vx: Math.cos(a) * v * S, vy: (Math.sin(a) * v * 0.28 - 20) * S, arrastre: 1.4, dura: rnd(0.9, 1.3), inclina: 0.5 })
            .img.setDepth(Math.sin(a) > 0 ? 21 : 5);
        }
        // Columna de fuego que sube del cuerpo.
        for (let i = 0; i < 26 * f; i++)
          llama(lz.cx + rnd(-0.4, 0.4) * c.ancho, c.y + rnd(-0.3, 0.4) * c.alto, rnd(0.3, 0.5) * S, rnd(220, 380), { vx: rnd(-25, 25) * S, arrastre: 1.2, dura: rnd(0.7, 1.1), estiraFin: 2.6 });
        // Chispas y ascuas en todas direcciones.
        for (let i = 0; i < 40 * f; i++) chispa(lz.cx + rnd(-20, 20) * S, c.y, rnd(250, 480));
        for (let i = 0; i < 24 * f; i++) {
          const a = Math.random() * Math.PI * 2, v = rnd(120, 320) * S;
          lz.parte('evo-punto', { x: lz.cx, y: c.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v * 0.8 - 60 * S, g: 140 * S, arrastre: 1, dura: rnd(1.2, 2), e0: rnd(0.07, 0.12) * S, e1: 0.02 * S, estela: 6, grad: [0xffe8a0, 0xff9a30, 0xd04010] }, 0xffe8a0);
        }
        lz.flash(0xff9a40, 0.4 * f, 350);
        lz.temblor(500, 0.014 * f);
      },
    };
  },

  Water: (lz, e) => {
    const gotas = new Ritmo(), burbujas = new Ritmo(), onda = new Cada(), ondas: { t: number; max: number }[] = [], S = lz.S;
    return {
      paso(dt, k, fase) {
        const c = lz.cuerpo();
        for (let i = gotas.n(dt, fase === 'carga' ? 5 + 10 * k : 3); i--;)
          lz.parte('p-gota', { modo: 'orbita', x: lz.cx, y: c.y, ang: Math.random() * Math.PI * 2, r: rnd(45, 65) * S, rMin: 20 * S, vr: 6 * S, ry: 0.35, w: 2.4 + 1.5 * k, vy: rnd(-10, 10) * S, dura: rnd(2, 3), e0: tam(lz, e), e1: tam(lz, e, 0.6), estela: 10, orienta: true, prof: true }, col(e));
        for (let i = burbujas.n(dt, fase === 'carga' ? 4 + 6 * k : 3); i--;)
          lz.parte('p-burbuja', { x: lz.cx + rnd(-80, 80) * S, y: lz.pie + rnd(0, 6) * S, vy: -rnd(25, 50) * S, arrastre: 0, vaiven: 4 * S, dura: rnd(1.5, 2.5), e0: tam(lz, e, 0.6), e1: tam(lz, e, 0.9) }, col(e));
        if (onda.toca(dt, fase === 'carga' ? 0.9 - 0.4 * k : 1.4)) ondas.push({ t: 0, max: rnd(60, 90) * S });
        for (let i = ondas.length - 1; i >= 0; i--) {
          const o = ondas[i]; o.t += dt;
          const u = o.t / 1.6;
          if (u >= 1) { ondas.splice(i, 1); continue; }
          lz.gN.lineStyle(1.5 * S, 0x9fd8ff, 0.5 * (1 - u)).strokeEllipse(lz.cx, lz.pie, o.max * 2 * u, o.max * 0.6 * u);
        }
      },
      estallido(f) {
        const c = lz.cuerpo();
        for (let i = 0; i < 44 * f; i++)
          lz.parte('p-gota', { x: lz.cx + rnd(-10, 10) * S, y: c.y - c.alto * 0.3, vx: rnd(-130, 130) * S, vy: -rnd(160, 300) * S, g: 420 * S, arrastre: 0.2, dura: rnd(1.3, 1.8), e0: tam(lz, e), e1: tam(lz, e, 0.8), orienta: true, estela: 4 }, col(e));
        for (let i = 0; i < 3; i++) ondas.push({ t: -i * 0.2, max: rnd(110, 150) * S });
      },
    };
  },

  Electric: (lz, e) => {
    const rayos: { pts: number[]; t: number; dura: number; ancho: number }[] = [], cae = new Cada(), arcos = new Ritmo(), chispas = new Ritmo(), S = lz.S;
    const relampago = (x0: number, y0: number, x1: number, y1: number, ancho: number, dura = 0.22) => rayos.push({ pts: quebrar(x0, y0, x1, y1, 22), t: 0, dura, ancho });
    return {
      paso(dt, k, fase) {
        const c = lz.cuerpo();
        if (cae.toca(dt, fase === 'carga' ? 0.9 - 0.6 * k : 1.6)) {
          const x1 = lz.cx + rnd(-0.3, 0.3) * c.ancho, y1 = c.y + rnd(-0.3, 0.2) * c.alto;
          relampago(lz.cx + rnd(-130, 130) * S, lz.franja, x1, y1, (2 + 2 * k) * S);
          lz.flash(0xfff3a0, 0.1 + 0.18 * k, 140);
          lz.son.trueno(0.5 + 0.5 * k);
          for (let i = 0; i < 8; i++) { const a = Math.random() * Math.PI * 2, v = rnd(80, 180) * S; lz.parte('p-chispa', { x: x1, y: y1, vx: Math.cos(a) * v, vy: Math.sin(a) * v, arrastre: 5, dura: rnd(0.2, 0.4), e0: tam(lz, e, 0.6), e1: 0, orienta: true }, col(e)); }
        }
        for (let i = arcos.n(dt, fase === 'carga' ? 3 + 8 * k : 2); i--;) {
          const a = Math.random() * Math.PI * 2, b = a + rnd(0.6, 1.6), rx = c.ancho * 0.55, ry = c.alto * 0.5;
          relampago(lz.cx + Math.cos(a) * rx, c.y + Math.sin(a) * ry, lz.cx + Math.cos(b) * rx, c.y + Math.sin(b) * ry, 1.2 * S, 0.12);
        }
        for (let i = chispas.n(dt, fase === 'carga' ? 6 + 10 * k : 4); i--;)
          lz.parte(elige(['p-rayo', 'p-chispa']), { ...{ zig: 2 * S, parpadeo: true }, modo: 'fijo', x: lz.cx + rnd(-0.8, 0.8) * c.ancho, y: c.y + rnd(-0.7, 0.6) * c.alto, dura: rnd(0.1, 0.22), pico: true, e0: tam(lz, e), e1: tam(lz, e), rot: rnd(-0.6, 0.6) }, col(e));
        for (let i = rayos.length - 1; i >= 0; i--) {
          const r = rayos[i]; r.t += dt;
          if (r.t >= r.dura) { rayos.splice(i, 1); continue; }
          trazo(lz.g, r.pts, r.ancho, 0xffe24a, (1 - r.t / r.dura) * (Math.random() < 0.8 ? 1 : 0.4));
        }
      },
      estallido(f) {
        const c = lz.cuerpo();
        for (let i = 0; i < 9 * f; i++) { const a = (i / (9 * f)) * Math.PI * 2 + rnd(-0.2, 0.2); relampago(lz.cx, c.y, lz.cx + Math.cos(a) * lz.W, c.y + Math.sin(a) * lz.W, 3 * S, 0.45); }
        lz.flash(0xfff3a0, 0.45 * f, 300);
        lz.son.trueno(1);
        radial(lz, e, Math.round(30 * f), [150, 320], { arrastre: 3, orienta: true }, 'p-chispa');
      },
    };
  },

  Grass: (lz, e) => {
    const tornado = new Ritmo(), polen = new Ritmo(), S = lz.S;
    return {
      paso(dt, k, fase) {
        for (let i = tornado.n(dt, fase === 'carga' ? 10 + 22 * k : 6); i--;)
          lz.parte('p-hoja', { modo: 'orbita', x: lz.cx, y: lz.pie, ang: Math.random() * Math.PI * 2, r: rnd(60, 85) * S, rMin: 18 * S, vr: rnd(10, 25) * S, ry: 0.3, w: 3 + 3 * k, vy: -rnd(40, 70) * S, dura: rnd(2, 2.6), e0: tam(lz, e), e1: tam(lz, e, 0.7), giro: rnd(-6, 6), prof: true }, col(e));
        for (let i = polen.n(dt, 5); i--;)
          lz.parte('evo-punto', { x: rnd(0, lz.W), y: rnd(lz.H * 0.5, lz.H - lz.franja), vx: rnd(-6, 6) * S, vy: -rnd(8, 20) * S, arrastre: 0, vaiven: 5 * S, dura: rnd(2.5, 4), pico: true, e0: rnd(0.05, 0.09) * S, e1: 0.05 * S }, elige([0xf0ff9a, 0xd6f59a]));
      },
      estallido(f) {
        radial(lz, e, Math.round(46 * f), [140, 300], { g: 30 * S, arrastre: 1.6, vaiven: 10 * S, dura: 2.6, giro: 6 }, 'p-hoja');
      },
    };
  },

  Ice: (lz, e) => {
    const ventisca = new Ritmo(), esquirlas = new Ritmo(), S = lz.S;
    let escarcha = 0;
    return {
      paso(dt, k, fase) {
        const c = lz.cuerpo();
        for (let i = ventisca.n(dt, fase === 'carga' ? 12 + 34 * k : 8); i--;) {
          const vx = rnd(160, 260) * S * (0.6 + 0.8 * k);
          lz.parte('p-copo', { x: -10, y: rnd(lz.franja, lz.H - lz.franja), vx, vy: rnd(10, 40) * S, arrastre: 0, vaiven: 3 * S, dura: lz.W / vx + 0.3, e0: tam(lz, e, 0.7), e1: tam(lz, e, 0.7), giro: rnd(-3, 3) }, col(e));
        }
        if (fase === 'carga') for (let i = esquirlas.n(dt, 2 + 6 * k); i--;) {
          const ang = Math.random() * Math.PI * 2;
          lz.parte('p-escama', { modo: 'hacia', x: lz.cx, y: c.y, ang, r: rnd(200, 250) * S, w: 0, vr: rnd(220, 300) * S, rMin: rnd(0.35, 0.55) * c.alto, dura: 9, e0: tam(lz, e), e1: tam(lz, e), orienta: true, estela: 4,
            fin: p => lz.parte('p-escama', { modo: 'fijo', x: p.img.x, y: p.img.y, dura: 0.9, e0: p.img.scaleX, e1: p.img.scaleX * 0.8, rot: p.img.rotation }, 0xd8f4ff) }, 0xc8f0ff);
        }
        escarcha = Math.min(1, escarcha + dt * 0.4);
        lz.gN.fillStyle(0xd8f4ff, 0.18 * escarcha).fillEllipse(lz.cx, lz.pie, (60 + 70 * k) * S * escarcha, (16 + 14 * k) * S * escarcha);
        lz.gN.lineStyle(1 * S, 0xffffff, 0.35 * escarcha).strokeEllipse(lz.cx, lz.pie, (60 + 70 * k) * S * escarcha, (16 + 14 * k) * S * escarcha);
      },
      estallido(f) {
        radial(lz, e, Math.round(32 * f), [200, 360], { orienta: true, arrastre: 2.5, estela: 4 }, 'p-escama');
        radial(lz, e, Math.round(40 * f), [60, 200], { g: 40 * S }, 'p-copo');
        lz.flash(0xd8f4ff, 0.35 * f, 300);
      },
    };
  },

  Fighting: (lz, e) => {
    const lineas = new Ritmo(), pulso = new Cada(), S = lz.S;
    return {
      paso(dt, k, fase) {
        const c = lz.cuerpo();
        for (let i = lineas.n(dt, fase === 'carga' ? 10 + 34 * k : 3); i--;)
          lz.parte('p-chispa', { modo: 'hacia', x: lz.cx, y: c.y, ang: Math.random() * Math.PI * 2, r: rnd(230, 300) * S, w: 0, vr: rnd(500, 700) * S, rMin: rnd(45, 75) * S, dura: 9, a0: 0.7, e0: rnd(0.35, 0.6) * S, e1: 0.25 * S, orienta: true }, elige([0xffffff, ...e.colores]));
        if (pulso.toca(dt, fase === 'carga' ? 0.9 - 0.5 * k : 1.5)) {
          lz.parte('p-aro', { modo: 'fijo', x: lz.cx, y: c.y, dura: 0.45, a0: 0.9, e0: 0.4 * S, e1: 2.6 * S }, 0xff8a5a);
          lz.temblor(140, 0.003 + 0.006 * k);
          lz.son.golpe();
        }
      },
      estallido(f) {
        const c = lz.cuerpo();
        radial(lz, e, Math.round(28 * f), [380, 560], { orienta: true, arrastre: 4, estela: 3, e0: 0.5 * S, e1: 0.2 * S }, 'p-chispa');
        for (let i = 0; i < 2; i++) lz.parte('p-aro', { modo: 'fijo', x: lz.cx, y: c.y, dura: 0.5 + i * 0.2, e0: 0.4 * S, e1: (4 + i * 2) * S }, i ? 0xffffff : 0xff6a4a);
        lz.temblor(500, 0.02 * f);
        lz.son.golpe();
      },
    };
  },

  Poison: (lz, e) => {
    const burbujas = new Ritmo(), niebla = new Ritmo(), S = lz.S;
    let t = 0;
    const revienta = (p: Part) => {
      lz.parte('p-aro', { modo: 'fijo', x: p.img.x, y: p.img.y, dura: 0.25, e0: p.img.scaleX * 0.4, e1: p.img.scaleX * 1.6 }, 0xe8b8f4);
      for (let i = 0; i < 3; i++) lz.parte('evo-punto', { x: p.img.x, y: p.img.y, vx: rnd(-50, 50) * S, vy: -rnd(20, 60) * S, g: 200 * S, dura: 0.5, e0: 0.08 * S, e1: 0.03 * S }, 0xc06ad8);
    };
    return {
      paso(dt, k, fase) {
        t += dt;
        const rx = (42 + 30 * k) * S;
        lz.gN.fillStyle(0x6a2a88, 0.35 + 0.1 * Math.sin(t * 3)).fillEllipse(lz.cx, lz.pie, rx * 2, 22 * S);
        lz.gN.fillStyle(0xa04ac0, 0.35).fillEllipse(lz.cx, lz.pie, rx * 1.3, 13 * S);
        for (let i = burbujas.n(dt, fase === 'carga' ? 7 + 16 * k : 5); i--;)
          lz.parte('p-burbuja', { x: lz.cx + rnd(-0.85, 0.85) * rx, y: lz.pie + rnd(-4, 4) * S, vy: -rnd(30, 75) * S, arrastre: 0, vaiven: 5 * S, dura: rnd(0.8, 1.8), e0: tam(lz, e, 0.4), e1: tam(lz, e, 1.3), fin: revienta }, col(e));
        for (let i = niebla.n(dt, 2.5); i--;)
          lz.parte('p-humo', { x: lz.cx + rnd(-140, 140) * S, y: lz.pie - rnd(0, 60) * S, vx: rnd(-12, 12) * S, vy: -rnd(4, 12) * S, arrastre: 0, dura: rnd(2.5, 3.5), pico: true, a0: 0.35, e0: rnd(0.4, 0.7) * S, e1: 0.8 * S }, 0x8a3aa8);
      },
      estallido(f) {
        radial(lz, e, Math.round(34 * f), [100, 260], { fin: revienta, arrastre: 2 }, 'p-burbuja');
      },
    };
  },

  Ground: (lz, e) => {
    const piedras = new Ritmo(), temblor = new Cada(), S = lz.S;
    const grietas = Array.from({ length: 8 }, (_, i) => {
      const a = (i / 8) * Math.PI * 2 + rnd(-0.3, 0.3), l = rnd(70, 120) * S;
      return quebrar(lz.cx, lz.pie, lz.cx + Math.cos(a) * l, lz.pie + Math.sin(a) * l * 0.3, 30, 4);
    });
    let abre = 0;
    const polvo = (x: number, y: number, n = 1) => { for (let i = 0; i < n; i++) lz.parte('p-humo', { x: x + rnd(-8, 8) * S, y, vx: rnd(-20, 20) * S, vy: -rnd(5, 20) * S, arrastre: 1, dura: rnd(0.9, 1.4), a0: 0.55, e0: rnd(0.3, 0.5) * S, e1: rnd(0.8, 1.1) * S }, elige([0xb8904a, 0x8a6a3a]), true); };
    return {
      paso(dt, k, fase) {
        if (fase === 'carga' && temblor.toca(dt, 0.12)) lz.temblor(140, 0.0015 + 0.005 * k);
        abre = Math.max(abre, fase === 'carga' ? k : 1);
        for (const pts of grietas) {
          const n = Math.max(2, Math.floor(pts.length / 2 * abre)) * 2;
          // Grieta oscura con luz dentro (la tierra se abre).
          for (const [g, w, c, a] of [[lz.gN, 3 * S, 0x2a1a0a, 0.85], [lz.g, 1.2 * S, 0xffb050, 0.35 + 0.4 * abre]] as [Phaser.GameObjects.Graphics, number, number, number][]) {
            g.lineStyle(w, c, a).beginPath().moveTo(pts[0], pts[1]);
            for (let i = 2; i < n; i += 2) g.lineTo(pts[i], pts[i + 1]);
            g.strokePath();
          }
        }
        for (let i = piedras.n(dt, fase === 'carga' ? 3 + 10 * k : 2); i--;) {
          const x = lz.cx + rnd(-100, 100) * S;
          lz.parte('p-roca', { x, y: lz.pie + rnd(0, 6) * S, vx: rnd(-40, 40) * S, vy: -rnd(90, 180) * S, g: 280 * S, arrastre: 0.2, dura: rnd(1, 1.5), e0: tam(lz, e), e1: tam(lz, e), giro: rnd(-6, 6) }, col(e), true);
          polvo(x, lz.pie);
        }
      },
      estallido(f) {
        for (let i = 0; i < 30 * f; i++)
          lz.parte('p-roca', { x: lz.cx + rnd(-30, 30) * S, y: lz.pie, vx: rnd(-180, 180) * S, vy: -rnd(160, 320) * S, g: 380 * S, arrastre: 0.2, dura: rnd(1.4, 2), e0: tam(lz, e, 1.3), e1: tam(lz, e), giro: rnd(-8, 8) }, col(e), true);
        for (let i = 0; i < 18 * f; i++) {
          const a = (i / (18 * f)) * Math.PI * 2, v = rnd(140, 200) * S;
          lz.parte('p-humo', { x: lz.cx, y: lz.pie, vx: Math.cos(a) * v, vy: Math.sin(a) * v * 0.25, arrastre: 1.5, dura: 1.6, a0: 0.6, e0: 0.4 * S, e1: 1.3 * S }, 0xb8904a, true);
        }
        lz.temblor(700, 0.022 * f);
      },
    };
  },

  Flying: (lz, e) => {
    const viento = new Ritmo(), plumas = new Ritmo(), rafaga = new Cada(), S = lz.S;
    return {
      paso(dt, k, fase) {
        const c = lz.cuerpo();
        for (let i = viento.n(dt, fase === 'carga' ? 3 + 6 * k : 1.5); i--;)
          lz.parte('evo-punto', { modo: 'orbita', x: lz.cx, y: c.y + rnd(-0.4, 0.4) * c.alto, ang: Math.random() * Math.PI * 2, r: rnd(70, 115) * S, ry: 0.22, w: rnd(2.6, 3.6) * (Math.random() < 0.5 ? 1 : -1), vy: -rnd(5, 25) * S, dura: rnd(1.2, 1.8), e0: 0.06 * S, e1: 0.04 * S, estela: 18, prof: true }, 0xffffff);
        for (let i = plumas.n(dt, fase === 'carga' ? 3 + 6 * k : 3); i--;)
          lz.parte('p-pluma', { x: rnd(0, lz.W), y: lz.franja - 6 * S, vx: rnd(-10, 10) * S, vy: rnd(20, 40) * S, arrastre: 0, vaiven: 16 * S, dura: 6, e0: tam(lz, e), e1: tam(lz, e), giro: rnd(-1.5, 1.5) }, col(e));
        if (rafaga.toca(dt, fase === 'carga' ? 1.6 - 0.8 * k : 2.5)) {
          const y = rnd(lz.franja + 20 * S, lz.H - lz.franja - 20 * S), izq = Math.random() < 0.5;
          for (let i = 0; i < 7; i++)
            lz.parte('p-chispa', { x: izq ? -40 : lz.W + 40, y: y + rnd(-30, 30) * S, vx: (izq ? 1 : -1) * rnd(500, 700) * S, arrastre: 0, dura: 1.2, a0: 0.45, e0: rnd(0.3, 0.5) * S, e1: 0.3 * S, orienta: true }, 0xe0e8ff);
        }
      },
      estallido(f) {
        const c = lz.cuerpo();
        for (let i = 0; i < 4; i++) lz.parte('p-aro', { modo: 'fijo', x: lz.cx, y: c.y, dura: 0.5 + i * 0.15, a0: 0.6, e0: 0.3 * S, e1: (3 + i) * S }, 0xe0e8ff);
        radial(lz, e, Math.round(30 * f), [120, 260], { vaiven: 14 * S, dura: 2.5, g: 25 * S }, 'p-pluma');
      },
    };
  },

  Psychic: (lz, e) => {
    const anillo = new Cada(), motas = new Ritmo(), S = lz.S;
    let t = 0;
    return {
      paso(dt, k, fase) {
        t += dt;
        const c = lz.cuerpo();
        lz.flotar = Math.max(lz.flotar, ((fase === 'carga' ? 4 + 6 * k : 3) * S) * (0.6 + 0.4 * Math.sin(t * 2.2)));
        if (anillo.toca(dt, fase === 'carga' ? 0.7 - 0.3 * k : 1.2))
          lz.parte('p-aro', { modo: 'fijo', x: lz.cx, y: c.y, dura: 0.9, pico: true, a0: 0.85, e0: 3 * S, e1: 0.2 * S }, col(e));
        for (let i = motas.n(dt, fase === 'carga' ? 5 + 9 * k : 3); i--;)
          lz.parte('evo-punto', { modo: 'lazo', x: lz.cx, y: c.y, ang: Math.random() * 6, r: rnd(45, 95) * S, ry: 0.6, ax: 1, ay: 2, w: rnd(1.4, 2.4), dura: rnd(2, 3), pico: true, e0: rnd(0.08, 0.14) * S, e1: 0.08 * S, estela: 10 }, col(e));
      },
      estallido(f) {
        const c = lz.cuerpo();
        for (let i = 0; i < 3; i++) lz.parte('p-aro', { modo: 'fijo', x: lz.cx, y: c.y, dura: 0.7 + i * 0.25, a0: 0.9, e0: 0.4 * S, e1: (4 + i * 2) * S }, col(e));
        lz.flash(0xff8ab8, 0.3 * f, 300);
        radial(lz, e, Math.round(24 * f), [90, 200], { estela: 6 }, 'evo-punto');
      },
    };
  },

  Bug: (lz, e) => {
    const enjambre = new Ritmo(), S = lz.S;
    return {
      paso(dt, k, fase) {
        const c = lz.cuerpo();
        for (let i = enjambre.n(dt, fase === 'carga' ? 6 + 12 * k : 4); i--;)
          lz.parte('evo-punto', { modo: 'lazo', x: lz.cx + rnd(-20, 20) * S, y: c.y, ang: Math.random() * 6, r: rnd(40, 130) * S, ry: rnd(0.4, 0.8), ax: Math.ceil(rnd(0, 3)), ay: Math.ceil(rnd(0, 3)), w: rnd(0.8, 1.8), dura: rnd(2, 4), pico: true, e0: rnd(0.07, 0.12) * S, e1: 0.07 * S, estela: 6, parpadeo: true, zig: 0.4 * S }, col(e));
      },
      estallido(f) {
        radial(lz, e, Math.round(44 * f), [40, 140], { arrastre: 0.8, vaiven: 8 * S, parpadeo: true, dura: 2.2, estela: 5 }, 'evo-punto');
      },
    };
  },

  Rock: (lz, e) => {
    const orbita: Part[] = [], caen = new Ritmo(), S = lz.S;
    const quedan = () => { for (let i = orbita.length - 1; i >= 0; i--) if (orbita[i].modo !== 'orbita' || !orbita[i].img.active) orbita.splice(i, 1); };
    return {
      paso(dt, k, fase) {
        quedan();
        const c = lz.cuerpo(), quiero = fase === 'carga' ? Math.floor(3 + 9 * k) : 4;
        while (orbita.length < quiero)
          orbita.push(lz.parte('p-roca', { modo: 'orbita', x: lz.cx, y: c.y + rnd(-0.2, 0.2) * c.alto, ang: Math.random() * Math.PI * 2, r: rnd(55, 80) * S, ry: 0.32, w: rnd(1.4, 2), dura: 99, e0: tam(lz, e), e1: tam(lz, e), giro: rnd(-3, 3), prof: true }, col(e), true));
        for (let i = caen.n(dt, fase === 'carga' ? 2 + 4 * k : 1); i--;)
          lz.parte('p-roca', { x: rnd(0, lz.W), y: lz.franja - 6 * S, vy: rnd(40, 80) * S, g: 300 * S, arrastre: 0, dura: 1.6, e0: tam(lz, e, 0.5), e1: tam(lz, e, 0.5), giro: rnd(-5, 5) }, col(e), true);
      },
      estallido(f) {
        quedan();
        for (const p of orbita) {   // salen disparadas por la tangente
          const t = p.ang + Math.PI / 2, v = rnd(260, 380) * S, x = p.img.x, y = p.img.y;
          Object.assign(p, { modo: 'libre', x, y, vx: Math.cos(t) * v * Math.sign(p.w) + (x - lz.cx) * 2, vy: Math.sin(t) * v * 0.4 - 80 * S, g: 300 * S, arrastre: 0.3, vida: 0, dura: 1.6, prof: false });
          p.img.setDepth(20);
        }
        orbita.length = 0;
        for (let i = 0; i < 24 * f; i++)
          lz.parte('p-roca', { x: lz.cx + rnd(-20, 20) * S, y: lz.cuerpo().y, vx: rnd(-220, 220) * S, vy: -rnd(100, 260) * S, g: 360 * S, arrastre: 0.2, dura: rnd(1.3, 1.8), e0: tam(lz, e), e1: tam(lz, e), giro: rnd(-6, 6) }, col(e), true);
        lz.temblor(400, 0.012 * f);
      },
    };
  },

  Ghost: (lz, e) => {
    const fuegos: Part[] = [], humo = new Ritmo(), S = lz.S;
    let t = 0;
    return {
      paso(dt, k, fase) {
        t += dt;
        for (let i = fuegos.length - 1; i >= 0; i--) if (fuegos[i].modo !== 'orbita' || !fuegos[i].img.active) fuegos.splice(i, 1);
        const c = lz.cuerpo(), quiero = fase === 'carga' ? 3 + Math.floor(4 * k) : 3;
        while (fuegos.length < quiero)
          fuegos.push(lz.parte('p-llama', { modo: 'orbita', x: lz.cx, y: c.y + rnd(-0.3, 0.1) * c.alto, ang: Math.random() * Math.PI * 2, r: rnd(55, 85) * S, ry: 0.45, w: rnd(0.8, 1.3), dura: 99, e0: tam(lz, e, 0.8), e1: tam(lz, e, 0.8), estela: 14, parpadeo: true, prof: true }, elige([0x8ab0ff, 0xb08aff, 0x6a8aff])));
        if (fase === 'carga') lz.alfaPk = Math.min(lz.alfaPk, 0.45 + 0.55 * Math.abs(Math.sin(t * 1.6)));
        for (let i = humo.n(dt, 3 + 3 * k); i--;)
          lz.parte('p-humo', { x: lz.cx + rnd(-60, 60) * S, y: lz.pie, vy: -rnd(20, 40) * S, arrastre: 0, vaiven: 14 * S, dura: rnd(2, 3), pico: true, a0: 0.5, e0: tam(lz, e), e1: tam(lz, e, 1.8) }, col(e));
      },
      estallido(f) {
        for (const p of fuegos) {
          const a = Math.atan2(p.img.y - lz.cuerpo().y, p.img.x - lz.cx), v = rnd(200, 300) * S;
          Object.assign(p, { modo: 'libre', x: p.img.x, y: p.img.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, arrastre: 1.5, vida: 0, dura: 1.2, prof: false });
        }
        fuegos.length = 0;
        lz.flash(0x6a3aa0, 0.4 * f, 400);
        radial(lz, e, Math.round(20 * f), [60, 160], { pico: true, a0: 0.6 }, 'p-humo');
      },
    };
  },

  Dragon: (lz, e) => {
    const aura = new Ritmo(), escamas = new Ritmo(), S = lz.S;
    let t = 0;
    return {
      paso(dt, k, fase) {
        t += dt;
        const c = lz.cuerpo();
        // Columna de energía del suelo al cielo.
        const w = (10 + 18 * k) * S * (0.85 + 0.15 * Math.sin(t * 9)), a = (fase === 'carga' ? 0.05 + 0.12 * k : 0.05);
        for (let i = 0; i < 4; i++) lz.g.fillStyle(0x8a5aff, a * (1 - i * 0.22)).fillRect(lz.cx - w * (1 + i * 0.6) / 2, lz.franja, w * (1 + i * 0.6), lz.pie - lz.franja);
        for (let i = aura.n(dt, fase === 'carga' ? 14 + 26 * k : 8); i--;)
          lz.parte('p-llama', { x: lz.cx + rnd(-0.55, 0.55) * c.ancho, y: c.y + rnd(-0.1, 0.5) * c.alto, vy: -rnd(70, 130) * S, arrastre: 0, dura: rnd(0.4, 0.7), e0: tam(lz, e), e1: tam(lz, e, 0.15), vaiven: 2 * S, parpadeo: true }, elige([0x9a6aff, 0x6a4af0, 0xff7a6a]));
        for (let i = escamas.n(dt, fase === 'carga' ? 3 + 7 * k : 2); i--;)
          lz.parte('p-escama', { modo: 'helice', x: lz.cx, y: lz.pie, ang: Math.random() * Math.PI * 2, r: rnd(45, 70) * S, w: 3.4, vy: -rnd(50, 80) * S, dura: rnd(2, 2.8), e0: tam(lz, e), e1: tam(lz, e, 0.6), giro: 3, estela: 5 }, col(e));
      },
      estallido(f) {
        const c = lz.cuerpo();
        for (let i = 0; i < 4; i++) lz.parte('p-aro', { modo: 'fijo', x: lz.cx, y: c.y, dura: 0.4 + i * 0.12, a0: 0.9, e0: 0.3 * S, e1: (3 + i * 1.6) * S }, i % 2 ? 0xff7a6a : 0x9a6aff);
        radial(lz, e, Math.round(30 * f), [200, 360], { estela: 6, arrastre: 2.5, giro: 4 }, 'p-escama');
        lz.temblor(800, 0.025 * f);
        lz.son.golpe();
      },
    };
  },

  Dark: (lz, e) => {
    const sombras = new Ritmo(), ojos = new Cada(), S = lz.S;
    return {
      paso(dt, k, fase) {
        const c = lz.cuerpo();
        if (fase === 'carga') for (let i = sombras.n(dt, 5 + 12 * k); i--;) {
          const [x, y] = borde(lz), ang = Math.atan2(y - c.y, x - lz.cx), r = Math.hypot(x - lz.cx, y - c.y);
          lz.parte('p-humo', { modo: 'hacia', x: lz.cx, y: c.y, ang, r, w: rnd(-0.3, 0.3), vr: rnd(50, 90) * S, rMin: rnd(55, 90) * S, dura: 9, a0: 0.9, e0: rnd(0.7, 1.1) * S, e1: rnd(0.5, 0.7) * S, giro: rnd(-0.5, 0.5) }, col(e), true);
        }
        if (ojos.toca(dt, 1.3)) {
          const x = rnd(lz.W * 0.1, lz.W * 0.9), y = rnd(lz.franja + 20 * S, lz.H * 0.6);
          if (Math.abs(x - lz.cx) > 60 * S) for (const dx of [-4, 4]) lz.parte('evo-punto', { modo: 'fijo', x: x + dx * S, y, dura: 0.9, pico: true, e0: 0.12 * S, e1: 0.12 * S }, 0xff3030);
        }
      },
      estallido(f) {
        radial(lz, e, Math.round(26 * f), [120, 260], { a0: 0.85, e0: 0.9 * S, e1: 1.3 * S, arrastre: 2 }, 'p-humo');
        radial(lz, e, Math.round(14 * f), [200, 340], { estela: 5 }, 'evo-punto');
      },
    };
  },

  Steel: (lz, e) => {
    const barrido = new Cada(), destellos = new Ritmo(), placas: Part[] = [], S = lz.S;
    let paso = -1;
    return {
      paso(dt, k, fase) {
        const c = lz.cuerpo();
        // Brillo metálico: una banda que cruza el cuerpo en diagonal.
        if (barrido.toca(dt, fase === 'carga' ? 1.3 - 0.5 * k : 2)) { paso = 0; lz.son.chispa(); }
        if (paso >= 0) {
          paso += dt / 0.45;
          if (paso > 1) paso = -1;
          else {
            const x = lz.cx - c.ancho * 0.9 + c.ancho * 1.8 * paso, h = c.alto * 0.7;
            for (const [w, a] of [[10 * S, 0.18], [4 * S, 0.5], [1.5 * S, 0.9]]) lz.g.lineStyle(w, 0xffffff, a).lineBetween(x - h * 0.4, c.y - h, x + h * 0.4, c.y + h);
          }
        }
        for (let i = destellos.n(dt, fase === 'carga' ? 4 + 6 * k : 2); i--;)
          lz.parte('p-destello', { modo: 'fijo', x: lz.cx + rnd(-0.6, 0.6) * c.ancho, y: c.y + rnd(-0.6, 0.5) * c.alto, dura: rnd(0.4, 0.7), pico: true, e0: tam(lz, e, 1.2), e1: tam(lz, e), giro: 2 }, 0xffffff);
        for (let i = placas.length - 1; i >= 0; i--) if (placas[i].modo !== 'orbita' || !placas[i].img.active) placas.splice(i, 1);
        while (placas.length < (fase === 'carga' ? 3 + Math.floor(5 * k) : 3))
          placas.push(lz.parte('p-escama', { modo: 'orbita', x: lz.cx, y: c.y, ang: Math.random() * Math.PI * 2, r: rnd(55, 70) * S, ry: 0.3, w: 2.2, dura: 99, e0: tam(lz, e), e1: tam(lz, e), prof: true, giro: 1.5 }, col(e)));
      },
      estallido(f) {
        const c = lz.cuerpo();
        for (const p of placas) {
          const a = Math.atan2(p.img.y - c.y, p.img.x - lz.cx), v = rnd(260, 340) * S;
          Object.assign(p, { modo: 'libre', x: p.img.x, y: p.img.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, arrastre: 1.8, vida: 0, dura: 1.2, prof: false, estela: 5 });
        }
        placas.length = 0;
        for (let i = 0; i < 2; i++) lz.parte('p-aro', { modo: 'fijo', x: lz.cx, y: c.y, dura: 0.35 + i * 0.2, e0: 0.3 * S, e1: (3.5 + i * 2) * S }, 0xffffff);
        lz.flash(0xffffff, 0.3 * f, 200);
        lz.son.golpe();
      },
    };
  },

  Fairy: (lz, e) => {
    const corazones = new Ritmo(), espiral = new Ritmo(), titila = new Ritmo(), S = lz.S;
    return {
      paso(dt, k, fase) {
        const c = lz.cuerpo();
        for (let i = corazones.n(dt, fase === 'carga' ? 4 + 8 * k : 4); i--;)
          lz.parte('p-corazon', { x: lz.cx + rnd(-90, 90) * S, y: lz.pie + rnd(-5, 5) * S, vy: -rnd(30, 55) * S, arrastre: 0, vaiven: 8 * S, dura: rnd(2, 3), pico: true, e0: tam(lz, e), e1: tam(lz, e) }, col(e));
        for (let i = espiral.n(dt, fase === 'carga' ? 3 + 7 * k : 2); i--;)
          lz.parte('evo-estrella', { modo: 'orbita', x: lz.cx, y: lz.pie, ang: Math.random() * Math.PI * 2, r: rnd(55, 70) * S, rMin: 15 * S, vr: 15 * S, ry: 0.35, w: 3, vy: -rnd(35, 55) * S, dura: rnd(2, 2.6), e0: tam(lz, e, 0.8), e1: tam(lz, e, 0.4), estela: 9, prof: true, giro: 3 }, elige([0xffffff, 0xffb8e0]));
        for (let i = titila.n(dt, 6); i--;) {
          const a = Math.random() * Math.PI * 2, r = rnd(30, 160) * S;
          lz.parte('evo-estrella', { modo: 'fijo', x: lz.cx + Math.cos(a) * r, y: c.y + Math.sin(a) * r * 0.7, dura: rnd(0.5, 0.9), pico: true, e0: rnd(0.08, 0.14) * S, e1: 0, rot: 0 }, 0xffffff);
        }
      },
      estallido(f) {
        radial(lz, e, Math.round(22 * f), [100, 240], { g: -20 * S, pico: true, dura: 2 }, 'p-corazon');
        radial(lz, e, Math.round(30 * f), [140, 300], { estela: 6 }, 'evo-estrella');
        lz.flash(0xffb8e0, 0.25 * f, 300);
      },
    };
  },
};

export function crearEfecto(t: TypeName, lz: Lienzo): EfectoTipo {
  return (EFECTOS[t] ?? EFECTOS.Normal)(lz, ESTILO_TIPO[t] ?? ESTILO_TIPO.Normal);
}
