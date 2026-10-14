// Pokédex del valle: tipos, stats, niveles y evoluciones (GDD-pueblo §10).
// Referencia: los juegos oficiales. Cada línea evolutiva guarda, por forma, sus stats base oficiales
// (Gen. 9, comprobadas en pokemondb.net) y el nivel desde el que se es esa forma; el grupo de
// experiencia (lo que cuesta subir de nivel) también es el oficial. Las evoluciones por piedra,
// intercambio o amistad aquí van por nivel: `como` dice cómo era en los juegos.
//
// De las 6 stats oficiales salen las 5 de trabajo del valle:
//   Fuerza ← Ataque (talar, picar) · Maña ← At. Esp. (prado: cosechar y regar) · Carga ← Defensa (lo
//   que lleva por viaje) · Aguante ← media de PS y Def. Esp. (horas de trabajo al día) · Velocidad ← Velocidad.
// Valor a nivel N = stat base de la forma que le toca × (1 + 2·(N−1)/99): ×1 a nivel 1, ×3 a nivel 100.
// Así salen solas todas las variedades: una línea que evoluciona pronto pero acaba floja (Caterpie,
// Bidoof) va bien al principio y mal al final; una que tarda en evolucionar (Magikarp, Beldum) es
// malísima hasta que lo hace y, como trabaja poco, también le cuesta más subir.

export type Tipo = 'normal' | 'planta' | 'fuego' | 'agua' | 'electrico' | 'hielo' | 'lucha' | 'veneno' | 'tierra'
  | 'volador' | 'psiquico' | 'bicho' | 'roca' | 'fantasma' | 'dragon' | 'siniestro' | 'acero' | 'hada';
export const NOMBRE_TIPO: Record<Tipo, string> = {
  normal: 'Normal', planta: 'Planta', fuego: 'Fuego', agua: 'Agua', electrico: 'Eléctrico', hielo: 'Hielo',
  lucha: 'Lucha', veneno: 'Veneno', tierra: 'Tierra', volador: 'Volador', psiquico: 'Psíquico', bicho: 'Bicho',
  roca: 'Roca', fantasma: 'Fantasma', dragon: 'Dragón', siniestro: 'Siniestro', acero: 'Acero', hada: 'Hada',
};

// Grupos de experiencia oficiales (experiencia total para nivel 100): errático 600 000, rápido 800 000,
// medio 1 000 000, parabólico 1 059 860, lento 1 250 000, fluctuante 1 640 000.
export type GrupoExp = 'erratico' | 'rapido' | 'medio' | 'parabolico' | 'lento' | 'fluctuante';
export const NOMBRE_GRUPO: Record<GrupoExp, string> = {
  erratico: 'Errático', rapido: 'Rápido', medio: 'Medio', parabolico: 'Parabólico', lento: 'Lento', fluctuante: 'Fluctuante',
};

// Stats base oficiales: [PS, Ataque, Defensa, At. Esp., Def. Esp., Velocidad].
export type Base6 = [number, number, number, number, number, number];
export interface Forma { id: string; dex: string; nombre: string; nv: number; base: Base6; como?: string }
// `tipo`: el tipo por el que cuenta en el valle (Pidgey cuenta como Volador); `tipos`: los oficiales de la forma básica.
export interface Linea { id: string; tipo: Tipo; tipos: Tipo[]; exp: GrupoExp; formas: Forma[] }

type F = [dex: string, nombre: string, nv: number, base: Base6, como?: string];
const idDe = (nombre: string) => nombre.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const L = (tipo: Tipo, tipos: Tipo[], exp: GrupoExp, ...formas: F[]): Omit<Linea, 'id'> =>
  ({ tipo, tipos, exp, formas: formas.map(([dex, nombre, nv, base, como]) => ({ id: idDe(nombre), dex, nombre, nv, base, como })) });

// Tres líneas por tipo. La clave es el id de la forma básica. Todas las formas tienen sprites PMD en
// assets/sprites/pokemon/<dex>/ (Rolycoly no los tiene: por eso no está). Algunos tipos tienen ya más de tres:
// líneas de Pokémon grandes (Snorlax, Lapras, Wailord, Avalugg, Rhydon, Tyranitar, Dragonite).
const DATOS: Record<string, Omit<Linea, 'id'>> = {
  // Normal
  bidoof: L('normal', ['normal'], 'medio', ['0399', 'Bidoof', 1, [59, 45, 40, 35, 40, 31]], ['0400', 'Bibarel', 15, [79, 85, 60, 55, 60, 71]]),
  wooloo: L('normal', ['normal'], 'medio', ['0831', 'Wooloo', 1, [42, 40, 55, 40, 45, 48]], ['0832', 'Dubwool', 24, [72, 80, 100, 60, 90, 88]]),
  miltank: L('normal', ['normal'], 'lento', ['0241', 'Miltank', 1, [95, 80, 105, 40, 70, 100]]),
  munchlax: L('normal', ['normal'], 'lento', ['0446', 'Munchlax', 1, [135, 85, 40, 40, 85, 5]], ['0143', 'Snorlax', 25, [160, 110, 65, 65, 110, 30], 'amistad']),
  // Planta
  // Bulbasaur: el Pokémon con el que empiezas en el modo aventura (docs/GDD-combate.md).
  bulbasaur: L('planta', ['planta', 'veneno'], 'parabolico', ['0001', 'Bulbasaur', 1, [45, 49, 49, 65, 65, 45]], ['0002', 'Ivysaur', 16, [60, 62, 63, 80, 80, 60]],
    ['0003', 'Venusaur', 32, [80, 82, 83, 100, 100, 80]]),
  oddish: L('planta', ['planta', 'veneno'], 'parabolico', ['0043', 'Oddish', 1, [45, 50, 55, 75, 65, 30]], ['0044', 'Gloom', 21, [60, 65, 70, 85, 75, 40]],
    ['0045', 'Vileplume', 36, [75, 80, 85, 110, 90, 50], 'piedra hoja']),
  sunkern: L('planta', ['planta'], 'parabolico', ['0191', 'Sunkern', 1, [30, 30, 30, 30, 30, 30]], ['0192', 'Sunflora', 30, [75, 75, 55, 105, 85, 30], 'piedra solar']),
  bounsweet: L('planta', ['planta'], 'parabolico', ['0761', 'Bounsweet', 1, [42, 30, 38, 30, 38, 32]], ['0762', 'Steenee', 18, [52, 40, 48, 40, 48, 62]],
    ['0763', 'Tsareena', 29, [72, 120, 98, 50, 98, 72], 'sabiendo Pisotón']),
  // Fuego
  growlithe: L('fuego', ['fuego'], 'lento', ['0058', 'Growlithe', 1, [55, 70, 45, 70, 50, 60]], ['0059', 'Arcanine', 35, [90, 110, 80, 100, 80, 95], 'piedra fuego']),
  slugma: L('fuego', ['fuego'], 'medio', ['0218', 'Slugma', 1, [40, 40, 40, 70, 40, 20]], ['0219', 'Magcargo', 38, [60, 50, 120, 90, 80, 30]]),
  torkoal: L('fuego', ['fuego'], 'medio', ['0324', 'Torkoal', 1, [70, 85, 140, 85, 70, 20]]),
  // Agua
  // Las líneas con bebé (Azurill, Pichu, Cleffa) lo tienen de primera forma; la clave sigue siendo la de siempre.
  marill: L('agua', ['agua', 'hada'], 'rapido', ['0298', 'Azurill', 1, [50, 20, 40, 20, 40, 20]], ['0183', 'Marill', 10, [70, 20, 50, 20, 50, 40], 'amistad'],
    ['0184', 'Azumarill', 18, [100, 50, 80, 60, 80, 50]]),
  psyduck: L('agua', ['agua'], 'medio', ['0054', 'Psyduck', 1, [50, 52, 48, 65, 50, 55]], ['0055', 'Golduck', 33, [80, 82, 78, 95, 80, 85]]),
  magikarp: L('agua', ['agua'], 'lento', ['0129', 'Magikarp', 1, [20, 10, 55, 15, 20, 80]], ['0130', 'Gyarados', 20, [95, 125, 79, 60, 100, 81]]),
  wailmer: L('agua', ['agua'], 'fluctuante', ['0320', 'Wailmer', 1, [130, 70, 35, 70, 35, 60]], ['0321', 'Wailord', 40, [170, 90, 45, 90, 45, 60]]),
  lapras: L('agua', ['agua', 'hielo'], 'lento', ['0131', 'Lapras', 1, [130, 85, 80, 85, 95, 60]]),
  // Eléctrico
  pikachu: L('electrico', ['electrico'], 'medio', ['0172', 'Pichu', 1, [20, 40, 15, 35, 35, 60]], ['0025', 'Pikachu', 10, [35, 55, 40, 50, 50, 90], 'amistad'], ['0026', 'Raichu', 30, [60, 90, 55, 90, 80, 110], 'piedra trueno']),
  magnemite: L('electrico', ['electrico', 'acero'], 'medio', ['0081', 'Magnemite', 1, [25, 35, 70, 95, 55, 45]], ['0082', 'Magneton', 30, [50, 60, 95, 120, 70, 70]],
    ['0462', 'Magnezone', 45, [70, 70, 115, 130, 90, 60], 'campo magnético']),
  pachirisu: L('electrico', ['electrico'], 'medio', ['0417', 'Pachirisu', 1, [60, 45, 70, 45, 90, 95]]),
  // Hielo
  vanillite: L('hielo', ['hielo'], 'lento', ['0582', 'Vanillite', 1, [36, 50, 50, 65, 60, 44]], ['0583', 'Vanillish', 35, [51, 65, 65, 80, 75, 59]],
    ['0584', 'Vanilluxe', 47, [71, 95, 85, 110, 95, 79]]),
  snorunt: L('hielo', ['hielo'], 'medio', ['0361', 'Snorunt', 1, [50, 50, 50, 50, 50, 50]], ['0362', 'Glalie', 42, [80, 80, 80, 80, 80, 80]]),
  swinub: L('hielo', ['hielo', 'tierra'], 'lento', ['0220', 'Swinub', 1, [50, 50, 40, 30, 30, 50]], ['0221', 'Piloswine', 33, [100, 100, 80, 60, 60, 50]],
    ['0473', 'Mamoswine', 45, [110, 130, 80, 70, 60, 80], 'sabiendo Poder Pasado']),
  bergmite: L('hielo', ['hielo'], 'medio', ['0712', 'Bergmite', 1, [55, 69, 85, 32, 35, 28]], ['0713', 'Avalugg', 37, [95, 117, 184, 44, 46, 28]]),
  // Lucha
  machop: L('lucha', ['lucha'], 'parabolico', ['0066', 'Machop', 1, [70, 80, 50, 35, 35, 35]], ['0067', 'Machoke', 28, [80, 100, 70, 50, 60, 45]],
    ['0068', 'Machamp', 40, [90, 130, 80, 65, 85, 55], 'intercambio']),
  timburr: L('lucha', ['lucha'], 'parabolico', ['0532', 'Timburr', 1, [75, 80, 55, 25, 35, 35]], ['0533', 'Gurdurr', 25, [85, 105, 85, 40, 50, 40]],
    ['0534', 'Conkeldurr', 40, [105, 140, 95, 55, 65, 45], 'intercambio']),
  makuhita: L('lucha', ['lucha'], 'fluctuante', ['0296', 'Makuhita', 1, [72, 60, 30, 20, 30, 25]], ['0297', 'Hariyama', 24, [144, 120, 60, 40, 60, 50]]),
  // Veneno
  grimer: L('veneno', ['veneno'], 'medio', ['0088', 'Grimer', 1, [80, 80, 50, 40, 50, 25]], ['0089', 'Muk', 38, [105, 105, 75, 65, 100, 50]]),
  trubbish: L('veneno', ['veneno'], 'medio', ['0568', 'Trubbish', 1, [50, 50, 62, 40, 62, 65]], ['0569', 'Garbodor', 36, [80, 95, 82, 60, 82, 75]]),
  zubat: L('veneno', ['veneno', 'volador'], 'medio', ['0041', 'Zubat', 1, [40, 45, 35, 30, 40, 55]], ['0042', 'Golbat', 22, [75, 80, 70, 65, 75, 90]],
    ['0169', 'Crobat', 35, [85, 90, 80, 70, 80, 130], 'amistad']),
  // Tierra
  diglett: L('tierra', ['tierra'], 'medio', ['0050', 'Diglett', 1, [10, 55, 25, 35, 45, 95]], ['0051', 'Dugtrio', 26, [35, 100, 50, 50, 70, 120]]),
  drilbur: L('tierra', ['tierra'], 'medio', ['0529', 'Drilbur', 1, [60, 85, 40, 30, 45, 68]], ['0530', 'Excadrill', 31, [110, 135, 60, 50, 65, 88]]),
  mudbray: L('tierra', ['tierra'], 'medio', ['0749', 'Mudbray', 1, [70, 100, 70, 45, 55, 45]], ['0750', 'Mudsdale', 30, [100, 125, 100, 55, 85, 35]]),
  rhyhorn: L('tierra', ['tierra', 'roca'], 'lento', ['0111', 'Rhyhorn', 1, [80, 85, 95, 30, 30, 25]], ['0112', 'Rhydon', 42, [105, 130, 120, 45, 45, 40]],
    ['0464', 'Rhyperior', 55, [115, 140, 130, 55, 55, 40], 'intercambio con Protector']),
  // Volador
  pidgey: L('volador', ['normal', 'volador'], 'parabolico', ['0016', 'Pidgey', 1, [40, 45, 40, 35, 35, 56]], ['0017', 'Pidgeotto', 18, [63, 60, 55, 50, 50, 71]],
    ['0018', 'Pidgeot', 36, [83, 80, 75, 70, 70, 101]]),
  hoothoot: L('volador', ['normal', 'volador'], 'medio', ['0163', 'Hoothoot', 1, [60, 30, 30, 36, 56, 50]], ['0164', 'Noctowl', 20, [100, 50, 50, 86, 96, 70]]),
  rookidee: L('volador', ['volador'], 'parabolico', ['0821', 'Rookidee', 1, [38, 47, 35, 33, 35, 57]], ['0822', 'Corvisquire', 18, [68, 67, 55, 43, 55, 77]],
    ['0823', 'Corviknight', 38, [98, 87, 105, 53, 85, 67]]),
  // Psíquico
  abra: L('psiquico', ['psiquico'], 'parabolico', ['0063', 'Abra', 1, [25, 20, 15, 105, 55, 90]], ['0064', 'Kadabra', 16, [40, 35, 30, 120, 70, 105]],
    ['0065', 'Alakazam', 40, [55, 50, 45, 135, 95, 120], 'intercambio']),
  ralts: L('psiquico', ['psiquico', 'hada'], 'lento', ['0280', 'Ralts', 1, [28, 25, 25, 45, 35, 40]], ['0281', 'Kirlia', 20, [38, 35, 35, 65, 55, 50]],
    ['0282', 'Gardevoir', 30, [68, 65, 65, 125, 115, 80]]),
  natu: L('psiquico', ['psiquico', 'volador'], 'medio', ['0177', 'Natu', 1, [40, 50, 45, 70, 45, 70]], ['0178', 'Xatu', 25, [65, 75, 70, 95, 70, 95]]),
  // Bicho
  caterpie: L('bicho', ['bicho'], 'medio', ['0010', 'Caterpie', 1, [45, 30, 35, 20, 20, 45]], ['0011', 'Metapod', 7, [50, 20, 55, 25, 25, 30]],
    ['0012', 'Butterfree', 10, [60, 45, 50, 90, 80, 70]]),
  combee: L('bicho', ['bicho', 'volador'], 'parabolico', ['0415', 'Combee', 1, [30, 30, 42, 30, 42, 70]], ['0416', 'Vespiquen', 21, [70, 80, 102, 80, 102, 40], 'solo hembras']),
  spinarak: L('bicho', ['bicho', 'veneno'], 'rapido', ['0167', 'Spinarak', 1, [40, 60, 40, 40, 40, 30]], ['0168', 'Ariados', 22, [70, 90, 70, 60, 70, 40]]),
  // Roca
  geodude: L('roca', ['roca', 'tierra'], 'parabolico', ['0074', 'Geodude', 1, [40, 80, 100, 30, 30, 20]], ['0075', 'Graveler', 25, [55, 95, 115, 45, 45, 35]],
    ['0076', 'Golem', 40, [80, 120, 130, 55, 65, 45], 'intercambio']),
  sudowoodo: L('roca', ['roca'], 'medio', ['0185', 'Sudowoodo', 1, [70, 100, 115, 30, 65, 30]]),
  larvitar: L('roca', ['roca', 'tierra'], 'lento', ['0246', 'Larvitar', 1, [50, 64, 50, 45, 50, 41]], ['0247', 'Pupitar', 30, [70, 84, 70, 65, 70, 51]],
    ['0248', 'Tyranitar', 55, [100, 134, 110, 95, 100, 61]]),
  onix: L('roca', ['roca', 'tierra'], 'medio', ['0095', 'Onix', 1, [35, 45, 160, 30, 45, 70]], ['0208', 'Steelix', 40, [75, 85, 200, 55, 65, 30], 'intercambio con Revestimiento Metálico']),
  // Fantasma
  gastly: L('fantasma', ['fantasma', 'veneno'], 'parabolico', ['0092', 'Gastly', 1, [30, 35, 30, 100, 35, 80]], ['0093', 'Haunter', 25, [45, 50, 45, 115, 55, 95]],
    ['0094', 'Gengar', 40, [60, 65, 60, 130, 75, 110], 'intercambio']),
  litwick: L('fantasma', ['fantasma', 'fuego'], 'parabolico', ['0607', 'Litwick', 1, [50, 30, 55, 65, 55, 20]], ['0608', 'Lampent', 41, [60, 40, 60, 95, 60, 55]],
    ['0609', 'Chandelure', 50, [60, 55, 90, 145, 90, 80], 'piedra noche']),
  misdreavus: L('fantasma', ['fantasma'], 'rapido', ['0200', 'Misdreavus', 1, [60, 60, 60, 85, 85, 85]], ['0429', 'Mismagius', 32, [60, 60, 60, 105, 105, 105], 'piedra noche']),
  // Dragón
  gible: L('dragon', ['dragon', 'tierra'], 'lento', ['0443', 'Gible', 1, [58, 70, 45, 40, 45, 42]], ['0444', 'Gabite', 24, [68, 90, 65, 50, 55, 82]],
    ['0445', 'Garchomp', 48, [108, 130, 95, 80, 85, 102]]),
  axew: L('dragon', ['dragon'], 'lento', ['0610', 'Axew', 1, [46, 87, 60, 30, 40, 57]], ['0611', 'Fraxure', 38, [66, 117, 70, 40, 50, 67]],
    ['0612', 'Haxorus', 48, [76, 147, 90, 60, 70, 97]]),
  dratini: L('dragon', ['dragon'], 'lento', ['0147', 'Dratini', 1, [41, 64, 45, 50, 50, 50]], ['0148', 'Dragonair', 30, [61, 84, 65, 70, 70, 70]],
    ['0149', 'Dragonite', 55, [91, 134, 95, 100, 100, 80]]),
  druddigon: L('dragon', ['dragon'], 'medio', ['0621', 'Druddigon', 1, [77, 120, 90, 60, 90, 48]]),
  // Siniestro
  poochyena: L('siniestro', ['siniestro'], 'medio', ['0261', 'Poochyena', 1, [35, 55, 35, 30, 30, 35]], ['0262', 'Mightyena', 18, [70, 90, 70, 60, 60, 70]]),
  sableye: L('siniestro', ['siniestro', 'fantasma'], 'parabolico', ['0302', 'Sableye', 1, [50, 75, 75, 65, 65, 50]]),
  murkrow: L('siniestro', ['siniestro', 'volador'], 'parabolico', ['0198', 'Murkrow', 1, [60, 85, 42, 85, 42, 91]], ['0430', 'Honchkrow', 32, [100, 125, 52, 105, 52, 71], 'piedra noche']),
  // Acero
  aron: L('acero', ['acero', 'roca'], 'lento', ['0304', 'Aron', 1, [50, 70, 100, 40, 40, 30]], ['0305', 'Lairon', 32, [60, 90, 140, 50, 50, 40]],
    ['0306', 'Aggron', 42, [70, 110, 180, 60, 60, 50]]),
  beldum: L('acero', ['acero', 'psiquico'], 'lento', ['0374', 'Beldum', 1, [40, 55, 80, 35, 60, 30]], ['0375', 'Metang', 20, [60, 75, 100, 55, 80, 50]],
    ['0376', 'Metagross', 45, [80, 135, 130, 95, 90, 70]]),
  mawile: L('acero', ['acero', 'hada'], 'rapido', ['0303', 'Mawile', 1, [50, 85, 85, 55, 55, 50]]),
  // Hada
  clefairy: L('hada', ['hada'], 'rapido', ['0173', 'Cleffa', 1, [50, 25, 28, 45, 55, 15]], ['0035', 'Clefairy', 10, [70, 45, 48, 60, 65, 35], 'amistad'], ['0036', 'Clefable', 32, [95, 70, 73, 95, 90, 60], 'piedra lunar']),
  togepi: L('hada', ['hada'], 'rapido', ['0175', 'Togepi', 1, [35, 20, 65, 40, 65, 20]], ['0176', 'Togetic', 20, [55, 40, 85, 80, 105, 40], 'amistad'],
    ['0468', 'Togekiss', 36, [85, 50, 95, 120, 115, 80], 'piedra día']),
  flabebe: L('hada', ['hada'], 'parabolico', ['0669', 'Flabébé', 1, [44, 38, 39, 61, 79, 42]], ['0670', 'Floette', 19, [54, 45, 47, 75, 98, 52]],
    ['0671', 'Florges', 36, [78, 65, 68, 112, 154, 75], 'piedra día']),
};

export const LINEAS: Record<string, Linea> = Object.fromEntries(Object.entries(DATOS).map(([id, l]) => [id, { id, ...l }]));
// Cada forma con su línea (bibarel → bidoof), para buscar sprites y nombres.
export const FORMAS: Record<string, Forma & { linea: string }> = Object.fromEntries(
  Object.values(LINEAS).flatMap(l => l.formas.map(f => [f.id, { ...f, linea: l.id }])));

// ---- Niveles ----
export const NIVEL_MAX = 100;
// Experiencia total para estar en el nivel n (fórmulas oficiales).
export function expNivel(g: GrupoExp, n: number): number {
  if (n <= 1) return 0;
  const n3 = n ** 3;
  switch (g) {
    case 'rapido': return Math.floor(4 * n3 / 5);
    case 'medio': return n3;
    case 'parabolico': return Math.max(0, Math.floor(6 * n3 / 5 - 15 * n * n + 100 * n - 140));
    case 'lento': return Math.floor(5 * n3 / 4);
    case 'erratico': return Math.floor(n < 50 ? n3 * (100 - n) / 50 : n < 68 ? n3 * (150 - n) / 100
      : n < 98 ? n3 * Math.floor((1911 - 10 * n) / 3) / 500 : n3 * (160 - n) / 100);
    case 'fluctuante': return Math.floor(n < 15 ? n3 * (Math.floor((n + 1) / 3) + 24) / 50
      : n < 36 ? n3 * (n + 14) / 50 : n3 * (Math.floor(n / 2) + 32) / 50);
  }
}
// La forma que le toca a una línea en un nivel (la última a la que ya ha llegado).
export function forma(l: Linea, nv: number): Forma {
  let f = l.formas[0];
  for (const g of l.formas) if (g.nv <= nv) f = g;
  return f;
}

// ---- Stats de trabajo ----
export type Stat = 'fuerza' | 'mana' | 'carga' | 'aguante' | 'velocidad';
export const STATS: Stat[] = ['fuerza', 'mana', 'carga', 'aguante', 'velocidad'];
export const NOMBRE_STAT: Record<Stat, string> = { fuerza: 'Fuerza', mana: 'Maña', carga: 'Carga', aguante: 'Aguante', velocidad: 'Velocidad' };
export type Stats = Record<Stat, number>;
export const factorNivel = (nv: number) => 1 + 2 * (nv - 1) / 99;
export function stats(l: Linea, nv: number): Stats {
  const [ps, at, df, ae, de, ve] = forma(l, nv).base, k = factorNivel(nv), r = (v: number) => Math.round(v * k);
  return { fuerza: r(at), mana: r(ae), carga: r(df), aguante: r((ps + de) / 2), velocidad: r(ve) };
}
export const total = (s: Stats) => STATS.reduce((t, k) => t + s[k], 0);

// ---- Perfil: cómo rinde al principio (niveles 5-20) y al final (60-100) frente al resto ----
// 'bueno' = bien al principio y al final · 'precoz' = bien al principio, flojo al final ·
// 'tardio' = flojo al principio, bien al final · 'flojo' = flojo siempre. 'normal' = en la media.
export type Perfil = 'bueno' | 'precoz' | 'tardio' | 'flojo' | 'normal';
export const NOMBRE_PERFIL: Record<Perfil, string> = { bueno: 'Bueno', precoz: 'Precoz', tardio: 'Tardío', flojo: 'Flojo', normal: 'Normal' };
const media = (l: Linea, a: number, b: number) => { let t = 0; for (let n = a; n <= b; n++) t += total(stats(l, n)); return t / (b - a + 1); };
const mediana = (xs: number[]) => { const s = [...xs].sort((a, b) => a - b), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const PRONTO = Object.fromEntries(Object.values(LINEAS).map(l => [l.id, media(l, 5, 20)]));
const TARDE = Object.fromEntries(Object.values(LINEAS).map(l => [l.id, media(l, 60, 100)]));
const MED_PRONTO = mediana(Object.values(PRONTO)), MED_TARDE = mediana(Object.values(TARDE));
const MARGEN = 0.05; // ±5 % de la mediana cuenta como "en la media"
// Rendimiento relativo a la mediana (1 = como la mitad de las líneas) al principio y al final.
export function rendimiento(id: string): { pronto: number; tarde: number } {
  return { pronto: PRONTO[id] / MED_PRONTO, tarde: TARDE[id] / MED_TARDE };
}
export function perfil(id: string): Perfil {
  const { pronto, tarde } = rendimiento(id), p = pronto - 1, t = tarde - 1, m = (p + t) / 2;
  if (t - p > MARGEN && t > 0) return 'tardio';        // gana terreno y acaba por encima de la media
  if (p - t > MARGEN && p > 0 && t < 0) return 'precoz'; // lo pierde y acaba por debajo
  return m >= MARGEN ? 'bueno' : m <= -MARGEN ? 'flojo' : 'normal';
}
