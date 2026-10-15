// Zonas de los biomas (docs/GDD-mundo.md §4): costa, cantera, pantano, ruinas, volcán y cumbres. Las seis salen de un
// generador común (`zona`) con lo que declara cada bioma: piezas del borde y del relleno, agua (mar o lagunas), piezas
// sueltas, hito con su alfa, salidas, especies y niveles. El mundo es fijo: cada zona sale siempre igual con la semilla
// de la partida. Las piezas son del catálogo Arcane (assets/gen/arcane/biomas/); el suelo, las texturas de
// lab/assets/suelo_arcane/<bioma>/ con su paleta (PALETAS_BIOMA).
//
// Cómo se arma una zona:
// 1. Agua: un mar en un lado (costa) o unas lagunas (pantano: lodo tóxico; volcán: lava; cumbres: agua helada).
// 2. Claros: uno junto a cada salida y unos cuantos más por el interior, unidos por senderos (árbol desde la entrada).
// 3. Suelo: textura A (vértice 0); senderos y manchas de textura B (vértice 1, o losas 2 en las ruinas); agua (3).
// 4. Borde: dos filas de piezas de muro con un hueco en cada salida (no en el lado del mar).
// 5. El hito en el claro más lejano de la entrada, con el alfa delante; un poste junto a cada salida.
// 6. Relleno suelto fuera de claros y senderos; piezas sueltas por el borde de los claros, en los claros o en el agua.
// 7. Salvajes: 2-3 por claro, con nivel de `niveles[0]` (el de la entrada) a `niveles[1]` (el del fondo).
//
// Diseño (docs/GDD-mundo.md §5, de lo investigado sobre diseño de zonas; `diseno` de cada bioma):
// - Hito global al fondo, enmarcado por una pareja de piezas (`marco`) que hace de puerta hacia él.
// - Camino principal (entrada → hito) más ancho que los demás, con migas (`miga`) a los lados: se sigue sin flechas.
// - Hito local en cada claro (`puntos`): cada sitio se reconoce y la entrada ya enseña de qué va la zona.
// - Ritmo: un claro de descanso a medio camino, sin salvajes, con hoguera (`descanso`).
// - Rincón secreto: un claro pequeño apartado, por un sendero estrecho, con una especie rara de más nivel (`rara`).
import type { Paleta } from '../render/TerrainCore';
import type { Colocado } from './mapaDibujo';
import type { Alfa, Llegada, MapaAventura, MapaId, Punto, Ronda, Salida } from './bosque';
import { rng } from '../util';

export type Bioma = 'costa' | 'cantera' | 'pantano' | 'ruinas' | 'volcan' | 'nieve';
type Lado = 'n' | 's' | 'e' | 'o';
type Donde = 'borde' | 'claro' | 'agua' | 'orilla';
interface Puerta { lado: Lado; t: number; a: MapaId; texto: string }
interface DefZona {
  id: MapaId; bioma: Bioma; nombre: string; lema: string; bienvenida: string; sal: number;
  puertas: Puerta[];                  // la primera es la entrada: de ahí sube el nivel
  muro: string[]; relleno: string[]; densidad: number;
  claros: number;
  agua?: { tipo: 'mar'; lado: Lado } | { tipo: 'lagunas'; n: number };
  extras: [string, number, Donde][];
  hito: string; alfa: { linea: string; forma: string; nivel: number };
  especies: string[]; niveles: [number, number];
  caminoLosas?: boolean;              // ruinas: los senderos son losas (vértice 2)
  diseno: { puntos: string[]; marco: string; miga: string; descanso: string[]; rara: { linea: string; nivel: number } };
  hitoEscala?: number; alrededorHito?: [string, number];   // hito pequeño: más grande y con piezas alrededor
}

const T = 24, MW = 56, MH = 44;

// Texturas (A = vértice 0, B = vértice 1) y paleta de cada bioma. Tonos medidos en las texturas
// (lab/assets/suelo_arcane/paletas_biomas.json); el agua, a ojo para cada bioma (en el volcán, la lava).
export const SUELO_BIOMA: Record<Bioma, { a: string; b: string }> = {
  costa: { a: 'arena', b: 'arena_humeda' }, cantera: { a: 'tierra_roca', b: 'grava' }, pantano: { a: 'musgo', b: 'barro_claro' },
  ruinas: { a: 'cesped_flores', b: 'losas' }, volcan: { a: 'roca_volcanica', b: 'ceniza_clara' }, nieve: { a: 'nieve', b: 'hielo' },
};
type RGB = [number, number, number];
const pal = (a: [RGB, RGB], b: [RGB, RGB], agua: RGB, aguaTonos: [RGB, RGB], aguaSombra: RGB, orillaClara: RGB): Paleta => ({
  grassTones: a, dirtTones: b, dirtMean: [Math.round((b[0][0] + b[1][0]) / 2), Math.round((b[0][1] + b[1][1]) / 2), Math.round((b[0][2] + b[1][2]) / 2)],
  stone: [150, 146, 138], stoneLight: [178, 174, 164], crack: [96, 90, 82],
  water: agua, waterTones: aguaTonos, waterShadow: aguaSombra, shoreDark: [38, 36, 34], shoreLight: orillaClara, sinPared: true,
});
export const PALETAS_BIOMA: Record<Bioma, Paleta> = {
  costa: pal([[216, 196, 166], [230, 216, 194]], [[98, 93, 86], [116, 110, 100]], [58, 116, 138], [[46, 98, 122], [86, 146, 162]], [40, 80, 100], [236, 222, 196]),
  cantera: pal([[134, 108, 86], [160, 130, 104]], [[128, 128, 124], [152, 148, 144]], [64, 96, 106], [[52, 82, 94], [84, 116, 124]], [44, 66, 76], [168, 140, 112]),
  pantano: pal([[54, 68, 53], [66, 84, 66]], [[102, 98, 92], [120, 112, 104]], [104, 70, 120], [[88, 56, 104], [132, 92, 146]], [70, 44, 84], [92, 100, 80]),
  ruinas: pal([[140, 156, 118], [154, 168, 128]], [[112, 114, 115], [138, 139, 137]], [78, 128, 140], [[64, 112, 126], [100, 152, 160]], [54, 92, 104], [176, 180, 150]),
  volcan: pal([[52, 53, 59], [70, 71, 80]], [[118, 118, 122], [130, 131, 134]], [226, 98, 28], [[200, 70, 20], [250, 160, 60]], [150, 40, 16], [96, 80, 70]),
  nieve: pal([[226, 232, 240], [238, 243, 250]], [[172, 199, 214], [196, 216, 227]], [120, 168, 196], [[98, 148, 180], [150, 194, 214]], [80, 124, 152], [246, 248, 252]),
};

// Punto del borde de una puerta, el de un poco más adentro y la dirección hacia dentro (fila del sprite).
function sitio(p: Puerta, W: number, H: number): { borde: Punto; dentro: Punto; dir: number } {
  if (p.lado === 'n') return { borde: { x: p.t * W, y: -10 }, dentro: { x: p.t * W, y: 50 }, dir: 0 };
  if (p.lado === 's') return { borde: { x: p.t * W, y: H + 10 }, dentro: { x: p.t * W, y: H - 50 }, dir: 4 };
  if (p.lado === 'e') return { borde: { x: W + 10, y: p.t * H }, dentro: { x: W - 50, y: p.t * H }, dir: 6 };
  return { borde: { x: -10, y: p.t * H }, dentro: { x: 50, y: p.t * H }, dir: 2 };
}
function salida(p: Puerta, W: number, H: number): Salida {
  const x = p.t * W, y = p.t * H;
  if (p.lado === 'n') return { x0: x - 50, y0: 0, x1: x + 50, y1: 14, a: p.a, texto: p.texto };
  if (p.lado === 's') return { x0: x - 50, y0: H - 14, x1: x + 50, y1: H, a: p.a, texto: p.texto };
  if (p.lado === 'e') return { x0: W - 14, y0: y - 50, x1: W, y1: y + 50, a: p.a, texto: p.texto };
  return { x0: 0, y0: y - 50, x1: 14, y1: y + 50, a: p.a, texto: p.texto };
}

function zona(def: DefZona, semilla: number): MapaAventura {
  const r = rng(semilla ^ def.sal), W = MW * T, H = MH * T;
  const entre = (a: number, b: number) => a + r() * (b - a);
  const pick = <X,>(l: X[]) => l[Math.floor(r() * l.length)];
  const sitios = def.puertas.map(p => sitio(p, W, H));

  // 1. Agua.
  const lagunas: { x: number; y: number; rx: number; ry: number }[] = [];
  const ag = def.agua;
  if (ag?.tipo === 'lagunas') for (let i = 0; i < 300 && lagunas.length < ag.n; i++) {
    const l = { x: entre(260, W - 260), y: entre(240, H - 240), rx: entre(90, 150), ry: entre(60, 100) };
    if (lagunas.every(o => Math.hypot(o.x - l.x, o.y - l.y) > o.rx + l.rx + 120) && sitios.every(s => Math.hypot(s.dentro.x - l.x, s.dentro.y - l.y) > l.rx + 140)) lagunas.push(l);
  }
  const fase = entre(0, 6);
  const costa = (x: number, y: number) => {   // > 0 dentro del mar
    if (ag?.tipo !== 'mar') return -Infinity;
    const ola = Math.sin(y * 0.012 + fase) * 34 + Math.sin(y * 0.031 + fase * 2) * 12, olaX = Math.sin(x * 0.012 + fase) * 34 + Math.sin(x * 0.031) * 12;
    if (ag.lado === 'e') return x - (W * 0.7 + ola);
    if (ag.lado === 'o') return W * 0.3 + ola - x;
    if (ag.lado === 'n') return H * 0.3 + olaX - y;
    return y - (H * 0.7 + olaX);
  };
  const enAgua = (x: number, y: number, m = 0) => costa(x, y) > -m || lagunas.some(l => ((x - l.x) / (l.rx + m)) ** 2 + ((y - l.y) / (l.ry + m)) ** 2 < 1);

  // 2. Claros: uno junto a cada salida y más por el interior, en tierra firme.
  const claros: (Punto & { rad: number })[] = sitios.map(s => ({ x: Math.min(W - 130, Math.max(130, s.dentro.x)), y: Math.min(H - 130, Math.max(130, s.dentro.y)), rad: 80 }));
  for (let i = 0; i < 400 && claros.length < sitios.length + def.claros; i++) {
    const c = { x: entre(170, W - 170), y: entre(160, H - 170), rad: entre(80, 125) };
    if (enAgua(c.x, c.y, c.rad + 30)) continue;
    if (claros.every(o => Math.hypot(o.x - c.x, o.y - c.y) > o.rad + c.rad + 50)) claros.push(c);
  }
  // Rincón secreto: un claro pequeño, ni pegado ni lejos de los demás, apartado de las salidas.
  type Claro = Punto & { rad: number };
  let secreto: Claro | null = null;
  for (let i = 0; i < 400 && !secreto; i++) {
    const c = { x: entre(150, W - 150), y: entre(150, H - 150), rad: 55 };
    if (enAgua(c.x, c.y, c.rad + 30)) continue;
    const d = Math.min(...claros.map(o => Math.hypot(o.x - c.x, o.y - c.y) - o.rad));
    if (d > 170 && d < 330 && sitios.every(s => Math.hypot(s.dentro.x - c.x, s.dentro.y - c.y) > 320)) secreto = c;
  }
  // Senderos: desde la entrada, cada claro se une al más cercano de los ya unidos; cada salida, a su claro.
  const unidos = [claros[0]], padre = new Map<Claro, Claro>(), tramoDe = new Map<Claro, Punto[]>();
  const tramos: Punto[][] = sitios.map((s, i) => [s.borde, claros[i]]);
  for (const c of claros.slice(1).sort((a, b) => Math.hypot(a.x - claros[0].x, a.y - claros[0].y) - Math.hypot(b.x - claros[0].x, b.y - claros[0].y))) {
    const o = unidos.reduce((m, u) => Math.hypot(u.x - c.x, u.y - c.y) < Math.hypot(m.x - c.x, m.y - c.y) ? u : m);
    const t = [o, { x: (o.x + c.x) / 2 + entre(-50, 50), y: (o.y + c.y) / 2 + entre(-50, 50) }, c];
    tramos.push(t); padre.set(c, o); tramoDe.set(c, t);
    unidos.push(c);
  }
  // Camino principal: de la salida de la entrada al claro más lejano (el del hito), subiendo por el árbol.
  const lejos = claros.reduce((m, c) => Math.hypot(c.x - claros[0].x, c.y - claros[0].y) > Math.hypot(m.x - claros[0].x, m.y - claros[0].y) ? c : m);
  const principal: Punto[][] = [tramos[0]];
  for (let c: Claro | undefined = lejos; c && c !== claros[0]; c = padre.get(c)) principal.push(tramoDe.get(c)!);
  const muestrear = (ts: Punto[][]) => {
    const out: Punto[] = [];
    for (const t of ts) for (let i = 0; i < t.length - 1; i++) {
      const a = t[i], b = t[i + 1], n = Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 8);
      for (let k = 0; k <= n; k++) out.push({ x: a.x + (b.x - a.x) * k / n, y: a.y + (b.y - a.y) * k / n });
    }
    return out;
  };
  const puntos = muestrear(tramos), ptsPrincipal = muestrear(principal);
  // El secreto, por un sendero estrecho desde el claro más cercano.
  const sec = secreto as Claro | null;
  const ptsSecreto = sec ? muestrear([[claros.reduce((m, c) => Math.hypot(c.x - sec.x, c.y - sec.y) < Math.hypot(m.x - sec.x, m.y - sec.y) ? c : m), sec]]) : [];
  const dist = (ps: Punto[], x: number, y: number) => { let d = Infinity; for (const p of ps) d = Math.min(d, Math.hypot(p.x - x, p.y - y)); return d; };
  const aSendero = (x: number, y: number) => Math.min(dist(puntos, x, y), dist(ptsSecreto, x, y));
  const todosClaros = sec ? [...claros, sec] : claros;
  const enClaro = (x: number, y: number, m = 0) => todosClaros.some(c => Math.hypot((x - c.x) / (c.rad + m), (y - c.y) / ((c.rad + m) * 0.8)) < 1);

  // 3. Suelo: agua, senderos, y manchas lentas de la textura B para que no sea liso.
  const vert: number[][] = [], ruido = (x: number, y: number) => Math.sin(x * 0.009 + fase) * Math.sin(y * 0.011 - fase) + Math.sin((x + y) * 0.004) * 0.5;
  for (let vy = 0; vy <= MH; vy++) {
    const fila: number[] = [];
    for (let vx = 0; vx <= MW; vx++) {
      const x = vx * T, y = vy * T;
      const camino = dist(ptsPrincipal, x, y) < 28 || dist(puntos, x, y) < 19 || dist(ptsSecreto, x, y) < 11;
      fila.push(enAgua(x, y) ? 3 : camino ? (def.caminoLosas ? 2 : 1) : ruido(x, y) > 0.9 ? 1 : 0);
    }
    vert.push(fila);
  }

  const col: Colocado[] = [];
  const ocupado: (Punto & { r: number })[] = [];
  const libre = (x: number, y: number, rad: number) => ocupado.every(o => Math.hypot(o.x - x, (o.y - y) * 1.3) > o.r + rad);
  const poner = (c: Colocado, rad: number) => { col.push(c); ocupado.push({ x: c.x, y: c.y, r: rad }); };
  const hueco = (x: number, y: number) => sitios.some(s => Math.hypot(s.borde.x - x, s.borde.y - y) < 80);

  // 5. Hito en el claro más lejano de la entrada, y el alfa delante. Postes junto a las salidas.
  const orden = [...claros].sort((a, b) => Math.hypot(a.x - claros[0].x, a.y - claros[0].y) - Math.hypot(b.x - claros[0].x, b.y - claros[0].y));
  const fondo = lejos;
  poner({ id: def.hito, x: Math.round(fondo.x), y: Math.round(fondo.y - fondo.rad * 0.45), s: def.hitoEscala }, 50);
  if (def.alrededorHito) for (let k = 0, [id, n] = def.alrededorHito; k < n; k++) {
    const a = Math.PI * (0.9 + 1.2 * k / Math.max(1, n - 1)), d = fondo.rad * entre(0.55, 0.8);   // un arco por detrás del alfa
    poner({ id, x: Math.round(fondo.x + Math.cos(a) * d), y: Math.round(fondo.y - fondo.rad * 0.2 + Math.sin(a) * d * 0.6), flip: r() < 0.5, s: entre(0.85, 1.1) }, 12);
  }
  const alfa: Alfa = { linea: def.alfa.linea, forma: def.alfa.forma, nivel: def.alfa.nivel, x: Math.round(fondo.x), y: Math.round(fondo.y + fondo.rad * 0.15) };
  const D = def.diseno;
  // Marco: una pareja de piezas a los lados del hito, como una puerta que lo encuadra.
  for (const lado of [-1, 1]) poner({ id: D.marco, x: Math.round(fondo.x + lado * 58), y: Math.round(fondo.y - fondo.rad * 0.12), flip: lado > 0 }, 14);
  // Descanso: el claro de en medio del camino, sin salvajes, con hoguera.
  const medio = orden[Math.floor(orden.length / 2)], descanso = orden.length > 2 && medio !== fondo ? medio : null;
  if (descanso) D.descanso.forEach((id, i) => poner({ id, x: Math.round(descanso.x + i * 38), y: Math.round(descanso.y + i * 8) }, 16));
  // Hitos locales: una pieza grande y distinta en el lado de arriba de cada claro (la entrada incluida).
  orden.forEach((c, i) => {
    if (c === fondo || c === descanso) return;
    const a = entre(-2.5, -0.6), id = D.puntos[i % D.puntos.length];
    poner({ id, x: Math.round(c.x + Math.cos(a) * c.rad * 0.6), y: Math.round(c.y + Math.sin(a) * c.rad * 0.45), flip: r() < 0.5 }, 26);
  });
  // Migas: piezas pequeñas a los lados del camino principal, cada ~150 px, alternando el lado.
  for (let i = 12, lado = 1; i < ptsPrincipal.length - 12; i += 19, lado = -lado) {
    const p = ptsPrincipal[i], q = ptsPrincipal[i + 2], dx = q.x - p.x, dy = q.y - p.y, l = Math.hypot(dx, dy) || 1;
    const x = p.x - dy / l * 34 * lado, y = p.y + dx / l * 34 * lado;
    if (!enAgua(x, y, 8) && !enClaro(x, y)) col.push({ id: D.miga, x: Math.round(x), y: Math.round(y), flip: lado > 0 });
  }
  // Secreto: dos hitos locales y, en medio, la especie rara (ver los salvajes).
  if (sec) for (let k = 0; k < 2; k++) poner({ id: D.puntos[(k + 1) % D.puntos.length], x: Math.round(sec.x + (k ? 30 : -34)), y: Math.round(sec.y - 22 + k * 6), flip: k > 0 }, 18);
  // Y un anillo de muro alrededor, abierto solo por donde llega su sendero: que no se vea desde los claros.
  if (sec && ptsSecreto.length) {
    const boca = Math.atan2(ptsSecreto[0].y - sec.y, ptsSecreto[0].x - sec.x);
    for (let k = 0; k < 14; k++) {
      const a = k / 14 * Math.PI * 2, da = Math.abs(Math.atan2(Math.sin(a - boca), Math.cos(a - boca)));
      const x = sec.x + Math.cos(a) * (sec.rad + 26), y = sec.y + Math.sin(a) * (sec.rad + 26) * 0.8;
      if (da > 0.5 && !enAgua(x, y, 10) && libre(x, y, 12)) poner({ id: pick(def.muro), x: Math.round(x), y: Math.round(y), flip: r() < 0.5, s: entre(0.95, 1.15) }, 16);
    }
  }
  sitios.forEach((s, i) => {
    const p = def.puertas[i], hor = p.lado === 'n' || p.lado === 's';
    poner({ id: 'poste', x: Math.round(s.dentro.x + (hor ? -64 : 0)), y: Math.round(s.dentro.y + (hor ? 0 : -48)), flip: p.lado === 'e' }, 12);
  });

  // 4. Borde: dos filas de muro, salvo en los huecos de las salidas y en el lado del mar.
  const muro = () => pick(def.muro);
  const seco = (x: number, y: number) => !enAgua(x, y, 10);
  for (let y = 10; y < H + 40; y += 30) for (const x of [entre(-6, 14), entre(30, 50), W - entre(-6, 14), W - entre(30, 50)])
    if (!hueco(x, y) && seco(x, y)) poner({ id: muro(), x: Math.round(x), y: Math.round(y), flip: r() < 0.5, s: entre(0.9, 1.15) }, 16);
  for (let x = 60; x < W - 50; x += 30) for (const y of [entre(16, 30), entre(52, 70), H + entre(4, 14)])
    if (!hueco(x, y) && seco(x, y)) poner({ id: muro(), x: Math.round(x), y: Math.round(y), flip: r() < 0.5, s: entre(0.9, 1.15) }, 16);

  // 6. Relleno suelto y piezas sueltas.
  for (let i = 0; i < def.densidad; i++) {
    const x = entre(70, W - 70), y = entre(90, H - 30);
    if (enClaro(x, y, 25) || aSendero(x, y) < 46 || enAgua(x, y, 40) || !libre(x, y, 26)) continue;
    poner({ id: pick(def.relleno), x: Math.round(x), y: Math.round(y), flip: r() < 0.5, s: entre(0.85, 1.15) }, 22);
  }
  for (const [id, n, donde] of def.extras) for (let k = 0, i = 0; k < n && i < 600; i++) {
    let x: number, y: number;
    if (donde === 'agua' || donde === 'orilla') { x = entre(80, W - 80); y = entre(100, H - 60); }
    else {
      const c = pick(claros), a = r() * Math.PI * 2, d = donde === 'claro' ? entre(0, 0.7) : entre(0.75, 1.05);
      x = c.x + Math.cos(a) * c.rad * d; y = c.y + Math.sin(a) * c.rad * 0.8 * d;
    }
    if (donde === 'agua' ? !enAgua(x, y, -30) : donde === 'orilla' ? !enAgua(x, y, 40) || enAgua(x, y, 6) : enAgua(x, y, 20)) continue;
    if (donde !== 'agua' && aSendero(x, y) < 28) continue;
    const plano = donde === 'claro' || donde === 'agua';
    if (plano) { col.push({ id, x: Math.round(x), y: Math.round(y), flip: r() < 0.5 }); k++; continue; }
    if (!libre(x, y, 16)) continue;
    poner({ id, x: Math.round(x), y: Math.round(y), flip: r() < 0.5, s: entre(0.8, 1.1) }, 16); k++;
  }

  // 7. Salvajes: 2-3 por claro, con el nivel según el orden de lejanía a la entrada.
  const especies = [...def.especies].sort(() => r() - 0.5).slice(0, 7);
  const salvajes: Ronda[] = [];
  orden.forEach((c, i) => {
    if (c === descanso) return;
    const n = 2 + (r() < 0.5 ? 1 : 0), base = def.niveles[0] + (def.niveles[1] - def.niveles[0]) * i / Math.max(1, orden.length - 1);
    for (let k = 0; k < n; k++) {
      const a = r() * Math.PI * 2, rr = r() * c.rad * 0.6;
      const x = Math.round(c.x + Math.cos(a) * rr), y = Math.round(c.y + Math.sin(a) * rr * 0.8);
      if (!enAgua(x, y, 10)) salvajes.push({ linea: pick(especies), nivel: Math.round(base + (r() < 0.4 ? 1 : 0)), x, y });
    }
  });
  if (sec) salvajes.push({ linea: D.rara.linea, nivel: D.rara.nivel, x: Math.round(sec.x), y: Math.round(sec.y + 10) });

  const llegada: Partial<Record<MapaId | 'inicio', Llegada>> = { inicio: { ...sitios[0].dentro, dir: sitios[0].dir } };
  def.puertas.forEach((p, i) => { llegada[p.a] = { x: Math.round(sitios[i].dentro.x), y: Math.round(sitios[i].dentro.y), dir: sitios[i].dir }; });
  return {
    id: def.id, nombre: def.nombre, lema: def.lema, bienvenida: def.bienvenida, alfa, suelo: def.bioma,
    datos: { mw: MW, mh: MH, vert, inicio: [Math.round(sitios[0].dentro.x), Math.round(sitios[0].dentro.y)] }, W, H, colocados: col, detalles: 0,
    llegada, salidas: def.puertas.map(p => salida(p, W, H)), salvajes,
  };
}

// ---- Los seis biomas ----
const DEFS: Record<Bioma, DefZona> = {
  costa: {
    id: 'costa', bioma: 'costa', diseno: { puntos: ['barca', 'poza_marea', 'red_pesca', 'madera_deriva'], marco: 'roca_costa', miga: 'conchas', descanso: ['hoguera', 'madera_deriva'], rara: { linea: 'lapras', nivel: 16 } },
    nombre: 'Costa Brisa', lema: 'Nivel 8-14 · Agua y Volador', sal: 0x0c05a1,
    bienvenida: 'La costa. Arena, mar y viento. Al fondo, el faro.',
    puertas: [{ lado: 'o', t: 0.5, a: 'lago', texto: 'Al lago' }],
    agua: { tipo: 'mar', lado: 'e' }, muro: ['palmera', 'roca_costa', 'palmera'], relleno: ['palmera', 'hierba_duna', 'roca_costa'], densidad: 260, claros: 5,
    extras: [['madera_deriva', 5, 'borde'], ['barca', 2, 'orilla'], ['red_pesca', 3, 'borde'], ['poza_marea', 3, 'claro'], ['conchas', 10, 'claro'], ['hierba_duna', 14, 'borde'], ['roca_costa', 8, 'orilla']],
    hito: 'faro', alfa: { linea: 'wailmer', forma: 'wailord', nivel: 16 },
    especies: ['magikarp', 'wailmer', 'pidgey', 'rookidee', 'pachirisu', 'psyduck', 'marill'], niveles: [8, 14],
  },
  cantera: {
    id: 'cantera', bioma: 'cantera', diseno: { puntos: ['vagoneta', 'andamio', 'cristal_acero', 'roca_mineral'], marco: 'cristal_acero', miga: 'grava', descanso: ['hoguera', 'tronco_caido'], rara: { linea: 'larvitar', nivel: 18 } },
    nombre: 'Cantera Gris', lema: 'Nivel 10-16 · Roca, Tierra, Lucha y Acero', sal: 0xca7e2a,
    bienvenida: 'La cantera. Vagonetas, andamios y mineral en la roca. Al fondo, la boca de la cueva.',
    puertas: [{ lado: 's', t: 0.5, a: 'bosque', texto: 'Al bosque' }, { lado: 'e', t: 0.3, a: 'pantano', texto: 'Al pantano' }],
    muro: ['aguja_roca', 'pino_seco', 'roca_mineral', 'aguja_roca'], relleno: ['pino_seco', 'aguja_roca', 'roca_mineral', 'arbusto_seco'], densidad: 620, claros: 6,
    extras: [['vagoneta', 3, 'borde'], ['andamio', 3, 'borde'], ['cristal_acero', 5, 'borde'], ['roca_mineral', 6, 'borde'], ['grava', 8, 'claro'], ['arbusto_seco', 8, 'borde']],
    hito: 'entrada_cueva', alfa: { linea: 'onix', forma: 'onix', nivel: 18 },
    especies: ['geodude', 'onix', 'larvitar', 'sudowoodo', 'diglett', 'drilbur', 'mudbray', 'rhyhorn', 'machop', 'timburr', 'makuhita', 'aron', 'magnemite'], niveles: [10, 16],
  },
  pantano: {
    id: 'pantano', bioma: 'pantano', diseno: { puntos: ['tronco_podrido', 'cerca_rota', 'farol_fuego_fatuo', 'roca_musgo'], marco: 'farol_fuego_fatuo', miga: 'seta_toxica', descanso: ['hoguera', 'tronco_podrido'], rara: { linea: 'misdreavus', nivel: 20 } },
    nombre: 'Pantano Umbrío', lema: 'Nivel 12-18 · Veneno, Fantasma y Siniestro', sal: 0x9a7a40,
    bienvenida: 'El pantano. Lodo tóxico, lápidas y faroles de fuego fatuo. No pises los charcos morados.',
    puertas: [{ lado: 'o', t: 0.3, a: 'cantera', texto: 'A la cantera' }, { lado: 'n', t: 0.6, a: 'ruinas', texto: 'A las ruinas' }],
    agua: { tipo: 'lagunas', n: 3 }, muro: ['arbol_muerto', 'arbol_muerto', 'roca_musgo'], relleno: ['arbol_muerto', 'juncos_secos', 'roca_musgo', 'tronco_podrido'], densidad: 780, claros: 6,
    extras: [['lapida', 10, 'borde'], ['farol_fuego_fatuo', 6, 'borde'], ['seta_toxica', 10, 'claro'], ['charco_toxico', 3, 'claro'], ['cerca_rota', 4, 'borde'], ['juncos_secos', 12, 'orilla']],
    hito: 'lapida', hitoEscala: 1.8, alrededorHito: ['lapida', 7], alfa: { linea: 'gastly', forma: 'haunter', nivel: 20 },
    especies: ['grimer', 'trubbish', 'zubat', 'gastly', 'litwick', 'misdreavus', 'poochyena', 'sableye', 'murkrow', 'spinarak'], niveles: [12, 18],
  },
  ruinas: {
    id: 'ruinas', bioma: 'ruinas', diseno: { puntos: ['altar', 'estatua', 'cristal_psiquico', 'muro_roto'], marco: 'estatua', miga: 'flores_hada', descanso: ['hoguera', 'columna_rota'], rara: { linea: 'togepi', nivel: 22 } },
    nombre: 'Ruinas Antiguas', lema: 'Nivel 14-20 · Psíquico y Hada', sal: 0x2a1b5e, caminoLosas: true,
    bienvenida: 'Las ruinas. Columnas rotas, cristales que brillan y un arco al fondo.',
    puertas: [{ lado: 's', t: 0.6, a: 'pantano', texto: 'Al pantano' }, { lado: 'o', t: 0.4, a: 'volcan', texto: 'Al volcán' }, { lado: 'e', t: 0.4, a: 'nieve', texto: 'A las cumbres' }],
    muro: ['arbol_flores', 'arbol_flores', 'columna_rota'], relleno: ['arbol_flores', 'arbol_flores', 'columna_rota'], densidad: 420, claros: 6,
    extras: [['muro_roto', 6, 'borde'], ['estatua', 4, 'borde'], ['altar', 2, 'claro'], ['cristal_psiquico', 6, 'borde'], ['losas_ruina', 6, 'claro'], ['flores_hada', 14, 'claro'], ['columna_rota', 6, 'borde']],
    hito: 'arco_ruinas', alfa: { linea: 'ralts', forma: 'kirlia', nivel: 22 },
    especies: ['abra', 'ralts', 'natu', 'clefairy', 'togepi', 'flabebe'], niveles: [14, 20],
  },
  volcan: {
    id: 'volcan', bioma: 'volcan', diseno: { puntos: ['cristal_fuego', 'roca_magma', 'obsidiana', 'roca_basalto'], marco: 'cristal_fuego', miga: 'ceniza', descanso: ['hoguera', 'roca_basalto'], rara: { linea: 'dratini', nivel: 26 } },
    nombre: 'Volcán Ascua', lema: 'Nivel 18-24 · Fuego y Dragón', sal: 0x701ca0,
    bienvenida: 'El volcán. Ríos de lava, fumarolas y el fósil de un dragón. La lava no se cruza.',
    puertas: [{ lado: 'e', t: 0.4, a: 'ruinas', texto: 'A las ruinas' }],
    agua: { tipo: 'lagunas', n: 4 }, muro: ['roca_basalto', 'roca_magma', 'arbol_quemado'], relleno: ['arbol_quemado', 'roca_basalto', 'obsidiana', 'roca_magma'], densidad: 700, claros: 6,
    extras: [['fumarola', 8, 'claro'], ['cristal_fuego', 6, 'borde'], ['obsidiana', 6, 'borde'], ['ceniza', 8, 'claro'], ['charco_lava', 3, 'claro']],
    hito: 'fosil_dragon', alfa: { linea: 'growlithe', forma: 'arcanine', nivel: 26 },
    especies: ['growlithe', 'slugma', 'torkoal', 'gible', 'axew', 'dratini', 'druddigon'], niveles: [18, 24],
  },
  nieve: {
    id: 'nieve', bioma: 'nieve', diseno: { puntos: ['cristal_hielo', 'carambanos', 'tronco_nevado', 'monton_nieve'], marco: 'cristal_hielo', miga: 'arbusto_nevado', descanso: ['hoguera', 'tronco_nevado'], rara: { linea: 'beldum', nivel: 28 } },
    nombre: 'Cumbres Heladas', lema: 'Nivel 20-26 · Hielo', sal: 0x5a0e17,
    bienvenida: 'Las cumbres. Nieve, pinos y cristales de hielo. Al fondo, el estanque helado.',
    puertas: [{ lado: 'o', t: 0.4, a: 'ruinas', texto: 'A las ruinas' }],
    agua: { tipo: 'lagunas', n: 2 }, muro: ['pino_nevado', 'pino_nevado', 'roca_nevada'], relleno: ['pino_nevado', 'roca_nevada', 'monton_nieve', 'arbusto_nevado'], densidad: 680, claros: 6,
    extras: [['carambanos', 6, 'borde'], ['cristal_hielo', 6, 'borde'], ['tronco_nevado', 5, 'borde'], ['monton_nieve', 6, 'borde'], ['arbusto_nevado', 8, 'borde']],
    hito: 'estanque_helado', alfa: { linea: 'snorunt', forma: 'glalie', nivel: 28 },
    especies: ['vanillite', 'snorunt', 'swinub', 'bergmite', 'beldum'], niveles: [20, 26],
  },
};
export const BIOMAS = Object.keys(DEFS) as Bioma[];
export const esBioma = (id: string): id is Bioma => id in DEFS;
export function zonaBioma(id: Bioma, semilla: number): MapaAventura { return zona(DEFS[id], semilla); }
