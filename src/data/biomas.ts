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
// Explanadas (2026-10-15, tras ver que con el macizo "todo es pasillo"): dos espacios amplios en el camino principal
// (a un tercio y a dos tercios del recorrido) y la arena del alfa en el claro del hito. Ritmo pasillo → espacio
// abierto → pasillo. Dentro, islas sueltas de relleno (cubren sin cerrar el paso) y más salvajes.
// Macizo (2026-10-15, tras ver que las zonas eran "un lienzo en blanco decorado"): lo transitable se EXCAVA. Solo se
// anda por los claros, los pasillos (el principal más ancho), unas bolsas sin salida a un lado del camino y el sendero
// estrecho del secreto; todo lo demás es macizo (`Macizo`, rejilla de 8 px): no se cruza y se llena de piezas de muro y
// relleno para que se lea como bosque cerrado o roca. Un río (`rio`) parte la zona entre la entrada y el hito y solo se
// cruza por los vados de los caminos (piedras); las lagunas también dejan paso al camino.
//
// Diseño (docs/GDD-mundo.md §5, de lo investigado sobre diseño de zonas; `diseno` de cada bioma):
// - Hito global al fondo, enmarcado por una pareja de piezas (`marco`) que hace de puerta hacia él.
// - Camino principal (entrada → hito) más ancho que los demás, con migas (`miga`) a los lados: se sigue sin flechas.
// - Hito local en cada claro (`puntos`): cada sitio se reconoce y la entrada ya enseña de qué va la zona.
// - Ritmo: un claro de descanso a medio camino, sin salvajes, con hoguera (`descanso`).
// - Rincón secreto: un claro pequeño apartado, por un sendero estrecho, con una especie rara de más nivel (`rara`).
import type { Paleta } from '../render/TerrainCore';
import type { Colocado } from './mapaDibujo';
import type { Alfa, ClimaBase, Llegada, MapaAventura, MapaId, Punto, Ronda, Salida } from './bosque';
import { rng } from '../util';
import { tirarEspecie } from './aparicion';
import { RELLANO, enRellano, sitioVolador, tapaRellano } from './rellano';

type Rect = { x0: number; y0: number; x1: number; y1: number };

export type Bioma = 'costa' | 'cantera' | 'pantano' | 'ruinas' | 'volcan' | 'nieve';
// Lo que no se puede cruzar: 1 en las celdas de macizo. Lo consulta la escena junto con el agua (Aventura → Mundo).
export interface Macizo { cel: number; cols: number; filas: number; datos: Uint8Array }
export function enMacizo(m: { macizo?: Macizo }, x: number, y: number): boolean {
  const z = m.macizo;
  if (!z) return false;
  const i = Math.floor(x / z.cel), j = Math.floor(y / z.cel);
  return i >= 0 && j >= 0 && i < z.cols && j < z.filas && z.datos[j * z.cols + i] === 1;
}
// Macizo que no se ve: en su borde, si hay hueco justo encima, solo van piezas bajas (o nada), y esas celdas se veían
// como suelo sin dejar pasar (muros invisibles). La escena, ya dibujado todo, abre desde lo pisable hacia dentro las
// celdas que no tapa ningún dibujo (`tapada`): lo que se ve abierto se puede pisar. Devuelve cuántas abrió.
export function abrirMacizo(m: { macizo?: Macizo }, pisable: (x: number, y: number) => boolean, tapada: (x: number, y: number) => boolean): number {
  const z = m.macizo;
  if (!z) return 0;
  const { cel, cols, filas, datos } = z, pila: number[] = [];
  const vacia = (k: number) => {   // el centro y cuatro puntos cerca de las esquinas, sin nada dibujado
    const x = (k % cols + 0.5) * cel, y = (Math.floor(k / cols) + 0.5) * cel, d = cel * 0.35;
    return !tapada(x, y) && !tapada(x - d, y - d) && !tapada(x + d, y - d) && !tapada(x - d, y + d) && !tapada(x + d, y + d);
  };
  for (let k = 0; k < cols * filas; k++) if (!datos[k] && pisable((k % cols + 0.5) * cel, (Math.floor(k / cols) + 0.5) * cel)) pila.push(k);
  let n = 0;
  while (pila.length) {
    const k = pila.pop()!, i = k % cols, j = (k - i) / cols;
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const ni = i + di, nj = j + dj, nk = nj * cols + ni;
      if (ni < 0 || nj < 0 || ni >= cols || nj >= filas || datos[nk] !== 1 || !vacia(nk)) continue;
      datos[nk] = 0; n++; pila.push(nk);
    }
  }
  return n;
}
type Lado = 'n' | 's' | 'e' | 'o';
type Donde = 'borde' | 'claro' | 'agua' | 'orilla';
interface Puerta { lado: Lado; t: number; a: MapaId; texto: string }
interface DefZona {
  id: MapaId; bioma: Bioma; nombre: string; lema: string; bienvenida: string; sal: number;
  puertas: Puerta[];                  // la primera es la entrada: de ahí sube el nivel
  muro: string[]; relleno: string[];   // macizo: muro al fondo, muro y relleno en el borde con lo transitable
  bajo: string[];                     // piezas bajas para el borde sur de los huecos (un árbol ahí taparía el hueco con su copa)
  rio?: boolean;                      // un río (del agua del bioma) entre la entrada y el hito, con vados
  claros: number;
  agua?: { tipo: 'mar'; lado: Lado } | { tipo: 'lagunas'; n: number };
  extras: [string, number, Donde][];
  hito: string; alfa: { linea: string; forma: string; nivel: number };
  niveles: [number, number];
  caminoLosas?: boolean;              // ruinas: los senderos son losas (vértice 2)
  diseno: { puntos: string[]; marco: string; miga: string; descanso: string[]; rara: { linea: string; nivel: number } };
  hitoEscala?: number; alrededorHito?: [string, number];   // hito pequeño: más grande y con piezas alrededor
  clima?: ClimaBase;                  // clima de base de la zona
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
  // El río y los vados (donde un camino cruza agua que no es el mar) se definen cuando hay caminos.
  // Las explanadas (más abajo) también quedan secas: las lagunas no se las comen.
  let enRio = (_x: number, _y: number, _m: number) => false, vado = (_x: number, _y: number) => false, seca = (_x: number, _y: number) => false;
  const enAgua = (x: number, y: number, m = 0) => costa(x, y) > -m
    || (!(m <= 0 && (vado(x, y) || seca(x, y))) && (lagunas.some(l => ((x - l.x) / (l.rx + m)) ** 2 + ((y - l.y) / (l.ry + m)) ** 2 < 1) || enRio(x, y, m)));

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
  // Rellano de vuelo: a un lado del claro de la entrada, de través al camino que llega de la salida, en tierra firme y
  // apartado de los demás claros, del secreto y de las otras salidas (sin tirar dados: el resto de la zona sale igual).
  const secretoR = secreto as Claro | null;
  const c0 = claros[0], b0 = sitios[0].borde, dl = Math.hypot(c0.x - b0.x, c0.y - b0.y) || 1, ux = (c0.x - b0.x) / dl, uy = (c0.y - b0.y) / dl;
  // Candidatos alrededor del claro de la entrada: primero de través al camino y cerca; luego girando hacia dentro
  // (nunca hacia atrás, hacia la salida) y más lejos.
  const candidatos: Punto[] = [];
  for (const e of [0, 50, 100, 150, 200]) for (const g of [0, 0.4, 0.8, 1.2]) for (const sl of [1, -1]) {
    const a = Math.atan2(ux * sl, -uy * sl) + g * -sl, d = c0.rad + 95 + e;   // a: de través; g gira hacia dentro
    candidatos.push({ x: Math.round(c0.x + Math.cos(a) * d), y: Math.round(c0.y + Math.sin(a) * d * 0.8) });
  }
  const cabe = (p: Punto) => p.x > 120 && p.y > 120 && p.x < W - 120 && p.y < H - 120 && !enAgua(p.x, p.y, RELLANO.rx + 50);
  const rellano: Punto | null = candidatos.find(p => cabe(p)
    && claros.slice(1).every(o => Math.hypot(o.x - p.x, o.y - p.y) > o.rad + RELLANO.rx + 30)
    && (!secretoR || Math.hypot(secretoR.x - p.x, secretoR.y - p.y) > secretoR.rad + RELLANO.rx + 40)
    && sitios.slice(1).every(s => Math.hypot(s.dentro.x - p.x, s.dentro.y - p.y) > 160)) ?? candidatos.find(cabe) ?? null;   // si no, aunque roce otro claro
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
  const ptsRellano = rellano ? muestrear([[c0, rellano]]) : [];   // el sendero corto al rellano
  const dist = (ps: Punto[], x: number, y: number) => { let d = Infinity; for (const p of ps) d = Math.min(d, Math.hypot(p.x - x, p.y - y)); return d; };
  const aSendero = (x: number, y: number) => Math.min(dist(puntos, x, y), dist(ptsSecreto, x, y), dist(ptsRellano, x, y));
  const todosClaros: Claro[] = [...claros, ...(sec ? [sec] : []), ...(rellano ? [{ ...rellano, rad: RELLANO.rx }] : [])];
  const enClaro = (x: number, y: number, m = 0) => todosClaros.some(c => Math.hypot((x - c.x) / (c.rad + m), (y - c.y) / ((c.rad + m) * 0.8)) < 1);

  // Bolsas: callejones sin salida a un lado de un camino (algo dentro: un hito local o un salvaje).
  const bolsas: Claro[] = [];
  for (let i = 0; i < 200 && bolsas.length < 4; i++) {
    const k = 4 + Math.floor(r() * Math.max(1, puntos.length - 8)), p = puntos[k], q = puntos[Math.min(puntos.length - 1, k + 2)];
    const dx = q.x - p.x, dy = q.y - p.y, l = Math.hypot(dx, dy) || 1, lado = r() < 0.5 ? -1 : 1, d = entre(80, 110);
    const b = { x: p.x - dy / l * d * lado, y: p.y + dx / l * d * lado, rad: entre(42, 56) };
    if (b.x < 120 || b.y < 120 || b.x > W - 120 || b.y > H - 120 || enAgua(b.x, b.y, b.rad + 20) || enClaro(b.x, b.y, b.rad + 30)) continue;
    if (bolsas.some(o => Math.hypot(o.x - b.x, o.y - b.y) < o.rad + b.rad + 80)) continue;
    bolsas.push(b);
  }
  // Explanadas: en los claros del camino principal a un tercio y a dos tercios, un contorno irregular (tres elipses
  // solapadas) unas tres veces más grande que un claro; y la arena del alfa, el claro del hito ampliado.
  type Elipse = { x: number; y: number; rx: number; ry: number };
  const explanadas: Elipse[][] = [];
  const enRuta: Claro[] = [];
  for (let c: Claro | undefined = lejos; c; c = padre.get(c)) enRuta.unshift(c);
  for (const f of [1 / 3, 2 / 3]) {
    const c = enRuta[Math.round(f * (enRuta.length - 1))];
    if (!c || c === claros[0] || c === lejos || explanadas.some(e => e[0].x === c.x && e[0].y === c.y)) continue;
    const forma: Elipse[] = [{ x: c.x, y: c.y, rx: entre(150, 190), ry: entre(110, 140) }];
    for (let k = 0; k < 2; k++) {
      const a = r() * Math.PI * 2, d = entre(70, 120);
      forma.push({ x: c.x + Math.cos(a) * d, y: c.y + Math.sin(a) * d * 0.7, rx: entre(100, 140), ry: entre(75, 100) });
    }
    for (const e of forma) {   // dentro del mapa, con margen para el borde de macizo
      e.x = Math.min(W - 110 - e.rx * 0.5, Math.max(110 + e.rx * 0.5, e.x)); e.y = Math.min(H - 110 - e.ry * 0.5, Math.max(110 + e.ry * 0.5, e.y));
    }
    explanadas.push(forma);
  }
  explanadas.push([{ x: lejos.x, y: lejos.y + 10, rx: Math.max(lejos.rad + 50, 150), ry: Math.max(lejos.rad * 0.8 + 40, 115) }]);   // arena del alfa
  const enExplanada = (x: number, y: number, m = 0) => explanadas.some(f => f.some(e => ((x - e.x) / (e.rx + m)) ** 2 + ((y - e.y) / (e.ry + m)) ** 2 < 1));
  seca = (x, y) => enExplanada(x, y, -20);
  // Mallas de 8 px: caminos (para los vados) y todo lo transitable.
  const CEL = 8, GC = Math.ceil(W / CEL), GF = Math.ceil(H / CEL);
  const mCamino = new Uint8Array(GC * GF), mPaso = new Uint8Array(GC * GF);
  const sello = (m: Uint8Array, x: number, y: number, rx: number, ry = rx) => {
    for (let j = Math.max(0, Math.floor((y - ry) / CEL)); j <= Math.min(GF - 1, Math.floor((y + ry) / CEL)); j++)
      for (let i = Math.max(0, Math.floor((x - rx) / CEL)); i <= Math.min(GC - 1, Math.floor((x + rx) / CEL)); i++) {
        const cx = (i + 0.5) * CEL, cy = (j + 0.5) * CEL;
        if (((cx - x) / rx) ** 2 + ((cy - y) / ry) ** 2 < 1) m[j * GC + i] = 1;
      }
  };
  for (const pt of ptsPrincipal) sello(mCamino, pt.x, pt.y, 44);
  for (const pt of puntos) sello(mCamino, pt.x, pt.y, 34);
  for (const pt of ptsSecreto) sello(mCamino, pt.x, pt.y, 22);
  for (const pt of ptsRellano) sello(mCamino, pt.x, pt.y, 24);
  mPaso.set(mCamino);
  for (const c of [...todosClaros, ...bolsas]) sello(mPaso, c.x, c.y, c.rad + 10, (c.rad + 10) * 0.8);
  for (const f of explanadas) for (const e of f) sello(mPaso, e.x, e.y, e.rx, e.ry);
  for (const st of sitios) sello(mPaso, st.dentro.x, st.dentro.y, 60);
  // Con mar: una playa abierta a lo largo de la orilla (el gran espacio abierto de la zona, frente a los senderos).
  if (ag?.tipo === 'mar') for (let j = 0; j < GF; j++) for (let i = 0; i < GC; i++) {
    const c = costa((i + 0.5) * CEL, (j + 0.5) * CEL);
    if (c > -95 + Math.sin(j * 0.21 + fase) * 22) mPaso[j * GC + i] = 1;
  }
  // …y una bajada a la playa desde los dos claros más cercanos al mar (si no, la playa quedaría aislada).
  if (ag?.tipo === 'mar') for (const c of [...claros].sort((p, q) => costa(q.x, q.y) - costa(p.x, p.y)).slice(0, 2)) {
    const ex = ag.lado === 'e' ? 1 : ag.lado === 'o' ? -1 : 0, ey = ag.lado === 's' ? 1 : ag.lado === 'n' ? -1 : 0;
    for (let d = 0; d < 700 && costa(c.x + ex * d, c.y + ey * d) < -40; d += 8) {
      sello(mPaso, c.x + ex * d, c.y + ey * d + Math.sin(d * 0.02) * 12, 30);
      sello(mCamino, c.x + ex * d, c.y + ey * d + Math.sin(d * 0.02) * 12, 20);
    }
  }
  const celda = (m: Uint8Array, x: number, y: number) => {
    const i = Math.floor(x / CEL), j = Math.floor(y / CEL);
    return i >= 0 && j >= 0 && i < GC && j < GF && m[j * GC + i] === 1;
  };
  vado = (x, y) => celda(mCamino, x, y);
  // Río: cruza la zona de lado a lado, perpendicular a la línea entrada → hito, a mitad de camino.
  const ptsRio: Punto[] = [];
  if (def.rio) {
    const ent = claros[0], ex = lejos.x - ent.x, ey = lejos.y - ent.y, L = Math.hypot(ex, ey) || 1, dx = ex / L, dy = ey / L, f = entre(0.42, 0.58);
    const mx = ent.x + ex * f, my = ent.y + ey * f;
    for (let t = -1900; t <= 1900; t += 12) {
      const w = Math.sin(t * 0.006 + fase) * 70 + Math.sin(t * 0.017 + fase) * 22, x = mx - dy * t + dx * w, y = my + dx * t + dy * w;
      if (x > -60 && y > -60 && x < W + 60 && y < H + 60) ptsRio.push({ x, y });
    }
    enRio = (x, y, m) => (m > 0 || (!enClaro(x, y) && !enExplanada(x, y))) && dist(ptsRio, x, y) < 30 + m;   // claros y explanadas, secos
  }
  // Puentes (2026-10-15): donde un camino cruza el río, un puente del bioma (tira `puente_<bioma>`, ver
  // Dibujo.expandirTiras) en lugar del vado. El río sigue por debajo (sin vado cerca) y se pasa por la tabla, que cuenta
  // como suelo para ver qué se alcanza. Horizontal o vertical según cruce el camino.
  const puentes: (Rect & { c: Colocado })[] = [];
  if (ptsRio.length) {
    const vados: { p: Punto; dx: number; dy: number }[] = [];
    // Cada cruce: el punto del camino más metido en el río (de cada racha de puntos junto al agua).
    for (const ps of [puntos, ptsSecreto]) for (let k = 0; k < ps.length; k++) {
      if (dist(ptsRio, ps[k].x, ps[k].y) >= 30) continue;
      let mejor = -1;   // con agua de verdad (en un claro el río va seco)
      for (let q = k; q < ps.length && dist(ptsRio, ps[q].x, ps[q].y) < 30 && (q === k || Math.hypot(ps[q].x - ps[q - 1].x, ps[q].y - ps[q - 1].y) < 20); k = q++)
        if (enRio(ps[q].x, ps[q].y, 0) && (mejor < 0 || dist(ptsRio, ps[q].x, ps[q].y) < dist(ptsRio, ps[mejor].x, ps[mejor].y))) mejor = q;
      if (mejor < 0) continue;
      const pt = ps[mejor];
      if (vados.some(v => Math.hypot(v.p.x - pt.x, v.p.y - pt.y) < 90)) continue;
      const a = ps[Math.max(0, mejor - 3)], b = ps[Math.min(ps.length - 1, mejor + 3)];
      vados.push({ p: pt, dx: b.x - a.x, dy: b.y - a.y });
    }
    for (const { p, dx, dy } of vados) {
      const hor = Math.abs(dx) > Math.abs(dy), ux = hor ? 1 : 0, uy = hor ? 0 : 1;
      let a = 0, b = 0;   // hasta dónde llega el agua a cada lado del cruce
      while (a < 200 && enRio(p.x - ux * a, p.y - uy * a, 0)) a += 4;
      while (b < 200 && enRio(p.x + ux * b, p.y + uy * b, 0)) b += 4;
      if (a + b > 180) continue;   // el camino va por dentro del río, no lo cruza: se queda el vado
      // M: lo que entra en tierra por cada lado (el agua dibujada sigue los vértices del suelo, cada 24 px, y llega algo
      // más allá del río exacto).
      const M = 28;
      const c: Colocado = hor ? { id: `puente_${def.bioma}`, x: Math.round(p.x - a - M), y: Math.round(p.y + 20), tira: { hasta: Math.round(p.x + b + M) } }
        : { id: `puente_v_${def.bioma}`, x: Math.round(p.x), y: Math.round(p.y - a - M), tira: { hasta: Math.round(p.y + b + M) } };
      puentes.push(hor ? { x0: p.x - a - M, y0: p.y - 15, x1: p.x + b + M, y1: p.y + 15, c } : { x0: p.x - 13, y0: p.y - a - M, x1: p.x + 13, y1: p.y + b + M, c });
    }
    // Sin vado a los lados de cada puente (el agua sigue por debajo), pero no más allá de sus extremos: ahí el camino
    // sigue en tierra (o en el vado, si continúa mojado).
    const cerca = (x: number, y: number) => puentes.some(q => q.x1 - q.x0 > q.y1 - q.y0
      ? x > q.x0 && x < q.x1 && y > q.y0 - 40 && y < q.y1 + 40 : x > q.x0 - 40 && x < q.x1 + 40 && y > q.y0 && y < q.y1);
    vado = (x, y) => celda(mCamino, x, y) && !(dist(ptsRio, x, y) < 60 && cerca(x, y));
  }
  const enPuente = (x: number, y: number) => puentes.some(q => x >= q.x0 && x <= q.x1 && y >= q.y0 && y <= q.y1);
  // Macizo: lo que no es transitable ni agua.
  const mMacizo = new Uint8Array(GC * GF);
  for (let j = 0; j < GF; j++) for (let i = 0; i < GC; i++) {
    const x = (i + 0.5) * CEL, y = (j + 0.5) * CEL;
    if (!mPaso[j * GC + i] && !enAgua(x, y)) mMacizo[j * GC + i] = 1;
  }
  // Lo transitable que no se alcanza desde la entrada (bolsitas encerradas entre agua y macizo) pasa a macizo.
  const alcanzado = new Uint8Array(GC * GF), pila = [Math.floor(sitios[0].dentro.y / CEL) * GC + Math.floor(sitios[0].dentro.x / CEL)];
  alcanzado[pila[0]] = 1;
  while (pila.length) {
    const k = pila.pop()!, i = k % GC, j = (k - i) / GC;
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const ni = i + di, nj = j + dj, nk = nj * GC + ni;
      if (ni < 0 || nj < 0 || ni >= GC || nj >= GF || alcanzado[nk] || mMacizo[nk]) continue;
      if (enAgua((ni + 0.5) * CEL, (nj + 0.5) * CEL) && !enPuente((ni + 0.5) * CEL, (nj + 0.5) * CEL)) continue;
      alcanzado[nk] = 1; pila.push(nk);
    }
  }
  for (let k = 0; k < GC * GF; k++) if (!alcanzado[k] && !mMacizo[k] && !enAgua((k % GC + 0.5) * CEL, (Math.floor(k / GC) + 0.5) * CEL)) mMacizo[k] = 1;
  const alcanzable = (x: number, y: number) => celda(alcanzado, x, y);
  const enMaz = (x: number, y: number) => celda(mMacizo, Math.min(W - 1, Math.max(0, x)), Math.min(H - 1, Math.max(0, y)));
  // ¿Hay algo transitable cerca? (para poner en el borde del macizo las piezas que se ven, y más juntas)
  const bordeDe = (x: number, y: number) => { for (const [ox, oy] of [[-24, 0], [24, 0], [0, -24], [0, 24]]) if (!enMaz(x + ox, y + oy)) return true; return false; };

  // 3. Suelo: agua, senderos, y manchas lentas de la textura B para que no sea liso.
  const vert: number[][] = [], ruido = (x: number, y: number) => Math.sin(x * 0.009 + fase) * Math.sin(y * 0.011 - fase) + Math.sin((x + y) * 0.004) * 0.5;
  for (let vy = 0; vy <= MH; vy++) {
    const fila: number[] = [];
    for (let vx = 0; vx <= MW; vx++) {
      const x = vx * T, y = vy * T;
      const camino = dist(ptsPrincipal, x, y) < 28 || dist(puntos, x, y) < 19 || dist(ptsSecreto, x, y) < 11 || dist(ptsRellano, x, y) < 13;
      fila.push(enAgua(x, y) ? 3 : enRellano(rellano, x, y, -14) ? 2 : camino ? (def.caminoLosas ? 2 : 1) : ruido(x, y) > 0.9 ? 1 : 0);
    }
    vert.push(fila);
  }

  const col: Colocado[] = [];
  const ocupado: (Punto & { r: number })[] = [];
  const libre = (x: number, y: number, rad: number) => ocupado.every(o => Math.hypot(o.x - x, (o.y - y) * 1.3) > o.r + rad);
  const poner = (c: Colocado, rad: number) => { col.push(c); ocupado.push({ x: c.x, y: c.y, r: rad }); };
  if (rellano) ocupado.push({ ...rellano, r: RELLANO.rx + 6 });   // nada encima del rellano de vuelo
  for (const q of puentes) for (let x = q.x0; x <= q.x1; x += 24) for (let y = q.y0; y <= q.y1; y += 24) ocupado.push({ x, y, r: 20 });   // ni encima de los puentes

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
  // Puentes donde un camino cruza el río (antes, vados con piedras).
  for (const q of puentes) col.push(q.c);
  // Bolsas: un hito local al fondo y, en la mitad de ellas, un salvaje (ver los salvajes).
  bolsas.forEach((b, i) => poner({ id: D.puntos[(i + 2) % D.puntos.length], x: Math.round(b.x), y: Math.round(b.y - b.rad * 0.35), flip: r() < 0.5 }, 20));
  // Secreto: dos hitos locales y, en medio, la especie rara (ver los salvajes).
  if (sec) for (let k = 0; k < 2; k++) poner({ id: D.puntos[(k + 1) % D.puntos.length], x: Math.round(sec.x + (k ? 30 : -34)), y: Math.round(sec.y - 22 + k * 6), flip: k > 0 }, 18);
  // (El macizo ya lo rodea: solo se llega por su sendero estrecho.)
  sitios.forEach((s, i) => {
    const p = def.puertas[i], hor = p.lado === 'n' || p.lado === 's';
    poner({ id: 'poste', x: Math.round(s.dentro.x + (hor ? -64 : 0)), y: Math.round(s.dentro.y + (hor ? 0 : -48)), flip: p.lado === 'e' }, 12);
  });

  // 4 y 6. El macizo, lleno: en el borde con lo transitable, muro y relleno más juntos; al fondo, solo muro. Una fila
  // más por fuera del mapa por abajo, para que el borde de abajo no se vea vacío.
  const borde = [...def.muro, ...def.relleno];
  for (let y = 6; y < H + 30; y += 24) for (let x = 6; x < W + 10; x += 26) {
    const jx = x + entre(-7, 7) + ((y / 24) % 2) * 13, jy = y + entre(-6, 6);
    if (!enMaz(jx, Math.min(H - 4, jy))) continue;
    const enBorde = bordeDe(jx, Math.min(H - 4, jy));
    if (!enBorde && r() < 0.35) continue;   // al fondo, algo más claro (lo tapan las copas)
    // Vista 3/4: lo alto crece hacia arriba. Si justo encima (hasta ~80 px) hay hueco, aquí solo algo bajo, o nada:
    // si no, la copa taparía el hueco y se vería más estrecho de lo que es.
    const huecoArriba = [20, 44, 68].some(d => !enMaz(jx, jy - d) && jy - d > 0) || tapaRellano(rellano, jx, jy);
    if (huecoArriba) { if (r() < 0.55) col.push({ id: pick(def.bajo), x: Math.round(jx), y: Math.round(jy), flip: r() < 0.5, s: entre(0.8, 1.05) }); continue; }
    col.push({ id: pick(enBorde ? borde : def.muro), x: Math.round(jx), y: Math.round(jy), flip: r() < 0.5, s: entre(0.9, 1.2) });
  }
  for (const [id, n, donde] of def.extras) for (let k = 0, i = 0; k < n && i < 600; i++) {
    let x: number, y: number;
    if (donde === 'agua' || donde === 'orilla') { x = entre(80, W - 80); y = entre(100, H - 60); }
    else {
      const c = pick(claros), a = r() * Math.PI * 2, d = donde === 'claro' ? entre(0, 0.7) : entre(0.75, 1.05);
      x = c.x + Math.cos(a) * c.rad * d; y = c.y + Math.sin(a) * c.rad * 0.8 * d;
    }
    if (donde === 'agua' ? !enAgua(x, y, -30) : donde === 'orilla' ? !enAgua(x, y, 40) || enAgua(x, y, 6) : enAgua(x, y, 20)) continue;
    if (donde !== 'agua' && (aSendero(x, y) < 28 || enRellano(rellano, x, y, 16))) continue;
    const plano = donde === 'claro' || donde === 'agua';
    if (plano) { col.push({ id, x: Math.round(x), y: Math.round(y), flip: r() < 0.5 }); k++; continue; }
    if (!libre(x, y, 16)) continue;
    poner({ id, x: Math.round(x), y: Math.round(y), flip: r() < 0.5, s: entre(0.8, 1.1) }, 16); k++;
  }

  // Islas en las explanadas (no en la arena del alfa): cubren sin cerrar el paso, lejos de los caminos y del centro de
  // los claros (donde van los hitos locales y los salvajes). Cada isla es un grupo ordenado: una arboleda o un
  // montículo del bioma a escala pequeña (2026-10-15; antes, 1-3 piezas de relleno al azar, que parecían barreras sueltas).
  explanadas.slice(0, -1).forEach(f => {
    const area = f.reduce((s, e) => s + Math.PI * e.rx * e.ry, 0), n = Math.round(area / 30000);
    for (let k = 0, i = 0; k < n && i < 400; i++) {
      const e = pick(f), a = r() * Math.PI * 2, d = Math.sqrt(r()) * 0.85;
      const x = e.x + Math.cos(a) * e.rx * d, y = e.y + Math.sin(a) * e.ry * d;
      if (enAgua(x, y, 16) || aSendero(x, y) < 40 || enClaro(x, y, -20) || tapaRellano(rellano, x, y) || !libre(x, y, 34)) continue;
      poner({ id: `${r() < 0.6 ? 'arboleda' : 'montana'}_${def.bioma}`, x: Math.round(x), y: Math.round(y), flip: r() < 0.5, s: entre(0.3, 0.42) }, 30);
      k++;
    }
  });

  // 7. Salvajes: 2-3 por claro, con el nivel según el orden de lejanía a la entrada.
  const especie = () => tirarEspecie(def.id, r)!.linea;   // tabla de la zona (data/aparicion.ts)
  const salvajes: Ronda[] = [];
  orden.forEach((c, i) => {
    if (c === descanso) return;
    const n = 2 + (r() < 0.5 ? 1 : 0), base = def.niveles[0] + (def.niveles[1] - def.niveles[0]) * i / Math.max(1, orden.length - 1);
    for (let k = 0; k < n; k++) {
      const a = r() * Math.PI * 2, rr = r() * c.rad * 0.6;
      const x = Math.round(c.x + Math.cos(a) * rr), y = Math.round(c.y + Math.sin(a) * rr * 0.8);
      if (!enAgua(x, y, 10)) salvajes.push({ linea: especie(), nivel: Math.round(base + (r() < 0.4 ? 1 : 0)), x, y });
    }
  });
  if (sec) salvajes.push({ linea: D.rara.linea, nivel: D.rara.nivel, fija: true, x: Math.round(sec.x), y: Math.round(sec.y + 10) });
  bolsas.forEach((b, i) => { if (i % 2 === 0) salvajes.push({ linea: especie(), nivel: Math.round((def.niveles[0] + def.niveles[1]) / 2 + 1), x: Math.round(b.x), y: Math.round(b.y + 8) }); });
  // Explanadas: 3 salvajes más en cada una (es el espacio de combate), con el nivel de su tramo del recorrido.
  explanadas.slice(0, -1).forEach((f, i) => {
    const nv = Math.round(def.niveles[0] + (def.niveles[1] - def.niveles[0]) * (i + 1) / 3);
    for (let k = 0, t = 0; k < 3 && t < 60; t++) {
      const e = pick(f), a = r() * Math.PI * 2, d = Math.sqrt(r()) * 0.7, x = Math.round(e.x + Math.cos(a) * e.rx * d), y = Math.round(e.y + Math.sin(a) * e.ry * d);
      if (enAgua(x, y, 10)) continue;
      salvajes.push({ linea: especie(), nivel: nv + (r() < 0.4 ? 1 : 0), x, y }); k++;
    }
  });
  // Solo los que se pueden alcanzar desde la entrada.
  const alcanzables = salvajes.filter(sv => alcanzable(sv.x, sv.y));

  const llegada: Partial<Record<MapaId | 'inicio', Llegada>> = { inicio: { ...sitios[0].dentro, dir: sitios[0].dir } };
  def.puertas.forEach((p, i) => { llegada[p.a] = { x: Math.round(sitios[i].dentro.x), y: Math.round(sitios[i].dentro.y), dir: sitios[i].dir }; });
  return {
    id: def.id, nombre: def.nombre, lema: def.lema, bienvenida: def.bienvenida, alfa, suelo: def.bioma, clima: def.clima,
    datos: { mw: MW, mh: MH, vert, inicio: [Math.round(sitios[0].dentro.x), Math.round(sitios[0].dentro.y)] }, W, H, colocados: col, detalles: 0,
    llegada, salidas: def.puertas.map(p => salida(p, W, H)), salvajes: alcanzables,
    macizo: { cel: CEL, cols: GC, filas: GF, datos: mMacizo },
    ...(rellano ? { rellano, vuelo: sitioVolador(rellano) } : {}),
  };
}

// ---- Los seis biomas ----
const DEFS: Record<Bioma, DefZona> = {
  costa: {
    id: 'costa', bioma: 'costa', bajo: ['roca_costa', 'hierba_duna', 'roca_costa'], diseno: { puntos: ['barca', 'poza_marea', 'red_pesca', 'madera_deriva'], marco: 'roca_costa', miga: 'conchas', descanso: ['hoguera', 'madera_deriva'], rara: { linea: 'lapras', nivel: 16 } },
    nombre: 'Costa Brisa', lema: 'Nivel 8-14 · Agua y Volador', sal: 0x0c05a1,
    bienvenida: 'La costa. Arena, mar y viento. Al fondo, el faro.',
    puertas: [{ lado: 'o', t: 0.5, a: 'lago', texto: 'Al lago' }],
    agua: { tipo: 'mar', lado: 'e' }, muro: ['palmera', 'roca_costa', 'palmera'], relleno: ['palmera', 'hierba_duna', 'roca_costa'], claros: 5,
    extras: [['madera_deriva', 5, 'borde'], ['barca', 2, 'orilla'], ['red_pesca', 3, 'borde'], ['poza_marea', 3, 'claro'], ['conchas', 10, 'claro'], ['hierba_duna', 14, 'borde'], ['roca_costa', 8, 'orilla']],
    hito: 'faro', alfa: { linea: 'wailmer', forma: 'wailord', nivel: 16 },
    clima: { tipo: 'lluvia', prob: 0.3 },
    niveles: [8, 14],
  },
  cantera: {
    id: 'cantera', bioma: 'cantera', bajo: ['roca_mineral', 'arbusto_seco', 'roca_mineral'], rio: true, diseno: { puntos: ['vagoneta', 'andamio', 'cristal_acero', 'roca_mineral'], marco: 'cristal_acero', miga: 'grava', descanso: ['hoguera', 'tronco_caido'], rara: { linea: 'aron', nivel: 18 } },
    nombre: 'Cantera Gris', lema: 'Nivel 10-16 · Roca, Tierra, Lucha y Acero', sal: 0xca7e2a,
    bienvenida: 'La cantera. Vagonetas, andamios y mineral en la roca. Al fondo, la boca de la cueva.',
    puertas: [{ lado: 's', t: 0.5, a: 'bosque', texto: 'Al bosque' }, { lado: 'e', t: 0.3, a: 'pantano', texto: 'Al pantano' }],
    muro: ['aguja_roca', 'pino_seco', 'roca_mineral', 'aguja_roca'], relleno: ['pino_seco', 'aguja_roca', 'roca_mineral', 'arbusto_seco'], claros: 6,
    extras: [['vagoneta', 3, 'borde'], ['andamio', 3, 'borde'], ['cristal_acero', 5, 'borde'], ['roca_mineral', 6, 'borde'], ['grava', 8, 'claro'], ['arbusto_seco', 8, 'borde']],
    hito: 'entrada_cueva', alfa: { linea: 'onix', forma: 'onix', nivel: 18 },
    clima: { tipo: 'arena', prob: 0.3 },
    niveles: [10, 16],
  },
  pantano: {
    id: 'pantano', bioma: 'pantano', bajo: ['roca_musgo', 'tronco_podrido', 'juncos_secos'], rio: true, diseno: { puntos: ['tronco_podrido', 'cerca_rota', 'farol_fuego_fatuo', 'roca_musgo'], marco: 'farol_fuego_fatuo', miga: 'seta_toxica', descanso: ['hoguera', 'tronco_podrido'], rara: { linea: 'misdreavus', nivel: 20 } },
    nombre: 'Pantano Umbrío', lema: 'Nivel 12-18 · Veneno, Fantasma y Siniestro', sal: 0x9a7a40,
    bienvenida: 'El pantano. Lodo tóxico, lápidas y faroles de fuego fatuo. No pises los charcos morados.',
    puertas: [{ lado: 'o', t: 0.3, a: 'cantera', texto: 'A la cantera' }, { lado: 'n', t: 0.6, a: 'ruinas', texto: 'A las ruinas' }],
    agua: { tipo: 'lagunas', n: 3 }, muro: ['arbol_muerto', 'arbol_muerto', 'roca_musgo'], relleno: ['arbol_muerto', 'juncos_secos', 'roca_musgo', 'tronco_podrido'], claros: 6,
    extras: [['lapida', 10, 'borde'], ['farol_fuego_fatuo', 6, 'borde'], ['seta_toxica', 10, 'claro'], ['charco_toxico', 3, 'claro'], ['cerca_rota', 4, 'borde'], ['juncos_secos', 12, 'orilla']],
    hito: 'lapida', hitoEscala: 1.8, alrededorHito: ['lapida', 7], alfa: { linea: 'gastly', forma: 'haunter', nivel: 20 },
    clima: { tipo: 'lluvia', prob: 0.5 },
    niveles: [12, 18],
  },
  ruinas: {
    id: 'ruinas', bioma: 'ruinas', bajo: ['muro_roto', 'columna_rota', 'flores_hada'], rio: true, diseno: { puntos: ['altar', 'estatua', 'cristal_psiquico', 'columna_rota'], marco: 'estatua', miga: 'flores_hada', descanso: ['hoguera', 'columna_rota'], rara: { linea: 'togepi', nivel: 22 } },
    nombre: 'Ruinas Antiguas', lema: 'Nivel 14-20 · Psíquico y Hada', sal: 0x2a1b5e, caminoLosas: true, clima: { tipo: 'arena', prob: 0.3 },
    bienvenida: 'Las ruinas. Columnas rotas, cristales que brillan y un arco al fondo.',
    puertas: [{ lado: 's', t: 0.6, a: 'pantano', texto: 'Al pantano' }, { lado: 'o', t: 0.4, a: 'volcan', texto: 'Al volcán' }, { lado: 'e', t: 0.4, a: 'nieve', texto: 'A las cumbres' }],
    muro: ['arbol_flores'], relleno: ['arbol_flores', 'muro_roto', 'columna_rota'], claros: 6,
    extras: [['estatua', 4, 'borde'], ['altar', 2, 'claro'], ['cristal_psiquico', 6, 'borde'], ['losas_ruina', 6, 'claro'], ['flores_hada', 14, 'claro'], ['columna_rota', 9, 'borde']],   // sin muro_roto suelto (un bloque cuadrado que parecía un pilar puesto al azar)
    hito: 'arco_ruinas', alfa: { linea: 'ralts', forma: 'kirlia', nivel: 22 },
    niveles: [14, 20],
  },
  volcan: {
    id: 'volcan', bioma: 'volcan', bajo: ['roca_magma', 'obsidiana', 'roca_basalto'], rio: true, diseno: { puntos: ['cristal_fuego', 'roca_magma', 'obsidiana', 'roca_basalto'], marco: 'cristal_fuego', miga: 'ceniza', descanso: ['hoguera', 'roca_basalto'], rara: { linea: 'dratini', nivel: 26 } },
    nombre: 'Volcán Ascua', lema: 'Nivel 18-24 · Fuego y Dragón', sal: 0x701ca0,
    bienvenida: 'El volcán. Ríos de lava, fumarolas y el fósil de un dragón. La lava no se cruza.',
    puertas: [{ lado: 'e', t: 0.4, a: 'ruinas', texto: 'A las ruinas' }],
    agua: { tipo: 'lagunas', n: 4 }, muro: ['roca_basalto', 'roca_magma', 'arbol_quemado'], relleno: ['arbol_quemado', 'roca_basalto', 'obsidiana', 'roca_magma'], claros: 6,
    extras: [['fumarola', 8, 'claro'], ['cristal_fuego', 6, 'borde'], ['obsidiana', 6, 'borde'], ['ceniza', 8, 'claro'], ['charco_lava', 3, 'claro']],
    hito: 'fosil_dragon', alfa: { linea: 'growlithe', forma: 'arcanine', nivel: 26 },
    clima: { tipo: 'sol', prob: 0.6 },
    niveles: [18, 24],
  },
  nieve: {
    id: 'nieve', bioma: 'nieve', bajo: ['roca_nevada', 'monton_nieve', 'arbusto_nevado'], rio: true, diseno: { puntos: ['cristal_hielo', 'carambanos', 'tronco_nevado', 'monton_nieve'], marco: 'cristal_hielo', miga: 'arbusto_nevado', descanso: ['hoguera', 'tronco_nevado'], rara: { linea: 'beldum', nivel: 28 } },
    nombre: 'Cumbres Heladas', lema: 'Nivel 20-26 · Hielo', sal: 0x5a0e17,
    bienvenida: 'Las cumbres. Nieve, pinos y cristales de hielo. Al fondo, el estanque helado.',
    puertas: [{ lado: 'o', t: 0.4, a: 'ruinas', texto: 'A las ruinas' }],
    agua: { tipo: 'lagunas', n: 2 }, muro: ['pino_nevado', 'pino_nevado', 'roca_nevada'], relleno: ['pino_nevado', 'roca_nevada', 'monton_nieve', 'arbusto_nevado'], claros: 6,
    extras: [['carambanos', 6, 'borde'], ['cristal_hielo', 6, 'borde'], ['tronco_nevado', 5, 'borde'], ['monton_nieve', 6, 'borde'], ['arbusto_nevado', 8, 'borde']],
    hito: 'estanque_helado', alfa: { linea: 'snorunt', forma: 'glalie', nivel: 28 },
    clima: { tipo: 'granizo', prob: 0.8 },
    niveles: [20, 26],
  },
};
export const BIOMAS = Object.keys(DEFS) as Bioma[];
export const esBioma = (id: string): id is Bioma => id in DEFS;
export function zonaBioma(id: Bioma, semilla: number): MapaAventura { return zona(DEFS[id], semilla); }
