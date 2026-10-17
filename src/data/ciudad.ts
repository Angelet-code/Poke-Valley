// Ciudad (2026-10-16): por piezas sueltas, con la distribución de la ciudad pintada (ciudad_D_s1, docs/art/ARCANE.md
// «Ciudad por piezas»). El suelo es esa misma imagen sin nada encima (Klein: "quita edificios, árboles, farolas…",
// assets/gen/arcane/ciudad/piezas/suelo_s2_0.png, ampliada ×2 → lab/assets/mapas_arcane/ciudad_suelo.jpg). Encima,
// cada edificio, seto, la fuente y las farolas son elementos del catálogo (cd_<id>: repintados sueltos de su recorte de
// la referencia, piezas/gen.sh), con su huella, su sombra y su orden por la base, como en el resto del juego; los
// árboles son los del catálogo Arcane y los objetos pequeños, del kit de la ciudad.
// Antes: la ciudad era la imagen entera con trozos recortados delante (lab/assets/mapas_arcane/ciudad.jpg); "se ve como
// un dibujo". Y antes, el kit suelto (git 2932f47f).
// De norte a sur: la calle mayor baja del norte hasta la plaza de la fuente; a la izquierda el centro Pokémon, la tienda
// y un puesto; a la derecha la iglesia del reloj y una casa; abajo la tienda morada, el cobertizo y el ayuntamiento; el
// muro del canal y el puente. Al pueblo se sale por el oeste, por la acera que pasa por detrás del puesto (el pueblo
// queda al oeste en el mundo, data/mundo.ts).
// Entrar: ?zona=ciudad o pv.scene.getScene('title').scene.start('aventura', {mapa: 'ciudad'}).
import type { MapaAventura, Pintado, Poligono } from './bosque';
import type { Colocado } from './mapaDibujo';

// Texturas de lab/assets/suelo_arcane/ciudad/ (Preload las carga como ciudad_<id>): el kit de suelos, sin uso ahora.
export const SUELOS_CIUDAD = ['adoquin', 'losas_plaza', 'ladrillo', 'calzada', 'baldosa', 'tierra_batida', 'cesped_parque', 'canal'];

// Las coordenadas de abajo van en px de la referencia (1536×1152); K los pasa a px de mundo. 1536·K = 52 casillas.
const T = 24, MW = 52, MH = 39, K = MW * T / 1536, W = MW * T, H = MH * T;
const P = (pts: number[][]): Poligono => pts.map(([x, y]) => [x * K, y * K]);
const rect = (x0: number, y0: number, x1: number, y1: number) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];

// [id, x, y del pie (centro de la base), escala?, espejo?] en px de la referencia.
const PIEZAS: [string, number, number, number?, boolean?][] = [
  // Edificios (cd_*: repintados de la referencia).
  ['cd_centro_pokemon', 214, 412], ['cd_puesto', 175, 572], ['cd_tienda', 506, 362], ['cd_casa_norte', 498, 78],
  ['cd_casa_nordeste', 1012, 82], ['cd_iglesia_reloj', 1027, 440], ['cd_casa_oscura', 1320, 418],
  ['cd_tienda_morada', 430, 842], ['cd_cobertizo', 1077, 788], ['cd_ayuntamiento', 1295, 848], ['cd_casa_este', 1508, 618],
  ['cd_fuente', 765, 605],
  // Setos.
  ['cd_seto_1', 313, 272], ['cd_seto_2', 625, 255], ['cd_seto_3', 1170, 255], ['cd_seto_4', 1472, 398], ['cd_seto_5', 262, 832],
  // Farolas, donde estaban las pintadas (su pie).
  ['cd_farola', 42, 447], ['cd_farola', 650, 257], ['cd_farola', 666, 76], ['cd_farola', 862, 258], ['cd_farola', 860, 78],
  ['cd_farola', 1148, 445], ['cd_farola', 585, 838], ['cd_farola', 985, 834],
  // Árboles y arbustos (catálogo Arcane), donde estaban en la referencia y a su tamaño (el catálogo los hace pequeños).
  ['arbol_alto', 75, 172, 1.8], ['arbol_bajo', 262, 40, 1.3], ['arbusto', 495, 112, 1.4], ['arbusto', 602, 122, 1.3, true],
  ['arbusto', 920, 118, 1.4], ['arbusto', 1205, 110, 1.4, true], ['arbusto', 1392, 140, 1.5], ['arbol_alto', 1482, 158, 1.8, true],
  ['arbol_alto', 46, 650, 1.7], ['arbol_bajo', 70, 760, 1.3, true], ['arbol_alto', 40, 870, 1.7],
  ['arbol_bajo', 1512, 720, 1.3, true], ['arbol_alto', 1520, 868, 1.7],
  ['arbusto', 895, 318, 1], ['arbusto', 968, 432, 0.9, true], ['arbusto', 1098, 418, 0.9], ['arbusto', 1232, 402, 0.9, true],
  ['arbusto', 1132, 800, 0.9], ['arbusto', 1460, 800, 0.9, true], ['arbusto', 360, 300, 0.8],
  // Objetos pequeños (kit de la ciudad): carrito, barriles, papeleras, buzón, maceta.
  ['carro', 402, 428, 0.6], ['cajas_barriles', 484, 404, 0.8], ['papelera', 261, 492], ['papelera', 522, 800],
  ['buzon', 1216, 380], ['maceta', 602, 356],
  // El tablón de misiones (2026-10-17), a la derecha del punto de vuelo (VUELO), en el césped antes de la acera.
  ['tablon', 628, 430],
];
// El punto de vuelo, en el césped al sur de la tienda; el tablón, a su derecha (PIEZAS).
const VUELO = [560, 425], TABLON = [628, 430];
// El Kecleon morado (shiny), en la acera delante de la tienda morada: vende lo del pueblo y además Ultra Balls e
// Hiperpociones (el de los objetos raros de Mystery Dungeon).
const TENDERO = [452, 862];
export const VENTA_CIUDAD = ['pokeball', 'superball', 'ultraball', 'pocion', 'superpocion', 'hiperpocion'];
// Slowbro, el posadero de la ciudad (2026-10-18): en la acera al oeste de la plaza de la fuente, junto al camino al puente.
const POSADERO = [610, 700];
// Meowth y su gachapón (2026-10-18): en la plaza, al nordeste de la fuente (combate/gacha.ts).
const GACHAPON = [880, 540];
// El patio de prácticas (2026-10-17): cinco muñecos en el césped al sureste de la plaza, entre la acera y el cobertizo
// (combate/mundo.ts hacerMunieco: quietos, sin captura, no caen).
const MUNECOS = [[915, 612], [988, 640], [915, 690], [988, 718], [950, 778]];
// El canal y su muro, a los dos lados del puente (706-832), que baja hasta el borde sur y sale al lago.
const CANAL = [rect(0, 888, 706, 1152), rect(832, 888, 1536, 1152)];

export function ciudad(): MapaAventura {
  const vert = Array.from({ length: MH + 1 }, () => new Array<number>(MW + 1).fill(0));
  const pintado: Pintado = { tex: 'mapa_ciudad_suelo', k: W / 3072, tapas: [], muros: CANAL.map(P), luces: [] };
  const colocados: Colocado[] = PIEZAS.map(([id, x, y, s, flip]) => ({ id, x: x * K, y: y * K, ...(s ? { s } : {}), ...(flip ? { flip } : {}) }));
  return {
    id: 'ciudad', nombre: 'Ciudad', lema: 'Calles, tiendas y la plaza de la fuente',
    bienvenida: 'La ciudad. La calle del oeste lleva a la cantera; la del este, al pantano; la del norte, a las ruinas, y el puente del sur, al lago.',
    datos: { mw: MW, mh: MH, vert, inicio: [765 * K, 660 * K] }, W, H, colocados, detalles: 0, pintado,
    // Las cuatro calles (2026-10-17): oeste a la cantera, este al pantano, norte a las ruinas y el puente del sur al lago.
    llegada: {
      inicio: { x: 765 * K, y: 660 * K, dir: 0 }, cantera: { x: 34 * K, y: 474 * K, dir: 2 }, pantano: { x: 1502 * K, y: 474 * K, dir: 6 },
      ruinas: { x: 768 * K, y: 34 * K, dir: 0 }, lago: { x: 768 * K, y: 1118 * K, dir: 4 },
    },
    salidas: [
      { x0: 0, y0: 450 * K, x1: 14, y1: 498 * K, a: 'cantera', texto: 'A la cantera' },
      { x0: W - 14, y0: 450 * K, x1: W, y1: 498 * K, a: 'pantano', texto: 'Al pantano' },
      { x0: 722 * K, y0: 0, x1: 814 * K, y1: 14, a: 'ruinas', texto: 'A las ruinas' },
      { x0: 706 * K, y0: H - 14, x1: 832 * K, y1: H, a: 'lago', texto: 'Al lago' },
    ], salvajes: MUNECOS.map(([x, y]) => ({ linea: 'sudowoodo', nivel: 10, x: x * K, y: y * K, fija: true, munieco: true })),
    vuelo: { x: VUELO[0] * K, y: VUELO[1] * K },
    tablon: { x: TABLON[0] * K, y: TABLON[1] * K },
    posadero: { x: POSADERO[0] * K, y: POSADERO[1] * K },
    gachapon: { x: GACHAPON[0] * K, y: GACHAPON[1] * K },
    tienda: { x: TENDERO[0] * K, y: TENDERO[1] * K, shiny: true, venta: VENTA_CIUDAD },
  };
}

// Lo que no se pisa en un mapa pintado: una rejilla de 4 px hecha una vez por mapa a partir de los polígonos `muros`.
const REJILLAS = new WeakMap<Pintado, { cols: number; datos: Uint8Array }>();
const CEL = 4;
function dentro(poli: Poligono, x: number, y: number): boolean {
  let d = false;
  for (let i = 0, j = poli.length - 1; i < poli.length; j = i++) {
    const [xi, yi] = poli[i], [xj, yj] = poli[j];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) d = !d;
  }
  return d;
}
export function muroPintado(m: { pintado?: Pintado; W: number; H: number }, x: number, y: number): boolean {
  const p = m.pintado;
  if (!p) return false;
  let r = REJILLAS.get(p);
  if (!r) {
    const cols = Math.ceil(m.W / CEL), filas = Math.ceil(m.H / CEL), datos = new Uint8Array(cols * filas);
    for (let j = 0; j < filas; j++) for (let i = 0; i < cols; i++) {
      const cx = (i + 0.5) * CEL, cy = (j + 0.5) * CEL;
      if (p.muros.some(q => dentro(q, cx, cy))) datos[j * cols + i] = 1;
    }
    r = { cols, datos };
    REJILLAS.set(p, r);
  }
  const i = Math.floor(x / CEL), j = Math.floor(y / CEL);
  return i < 0 || j < 0 || i >= r.cols || r.datos[j * r.cols + i] === 1;
}
