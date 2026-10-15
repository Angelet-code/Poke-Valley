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

  // Más líneas para las tablas de aparición del modo aventura (data/aparicion.ts): las comunes y las raras de cada zona.
  scyther: L('bicho', ['bicho', 'volador'], 'medio', ['0123', 'Scyther', 1, [70, 110, 80, 55, 80, 105]],
    ['0212', 'Scizor', 40, [70, 130, 100, 55, 80, 65], 'intercambio con Revestimiento Metálico']),
  heracross: L('bicho', ['bicho', 'lucha'], 'lento', ['0214', 'Heracross', 1, [80, 125, 75, 40, 95, 85]]),
  eevee: L('normal', ['normal'], 'medio', ['0133', 'Eevee', 1, [55, 55, 50, 45, 65, 55]]),
  // Las evoluciones de Eevee por piedra (EVO_OBJETO): líneas aparte de una sola forma, a las que se pasa usando la
  // piedra (no salen como salvajes ni como visitantes).
  vaporeon: L('agua', ['agua'], 'medio', ['0134', 'Vaporeon', 1, [130, 65, 60, 110, 95, 65], 'piedra agua']),
  jolteon: L('electrico', ['electrico'], 'medio', ['0135', 'Jolteon', 1, [65, 65, 60, 110, 95, 130], 'piedra trueno']),
  flareon: L('fuego', ['fuego'], 'medio', ['0136', 'Flareon', 1, [65, 130, 60, 95, 110, 65], 'piedra fuego']),
  leafeon: L('planta', ['planta'], 'medio', ['0470', 'Leafeon', 1, [65, 110, 130, 60, 65, 95], 'piedra hoja']),
  glaceon: L('hielo', ['hielo'], 'medio', ['0471', 'Glaceon', 1, [65, 60, 110, 130, 95, 65], 'piedra hielo']),
  wooper: L('agua', ['agua', 'tierra'], 'medio', ['0194', 'Wooper', 1, [55, 45, 45, 25, 25, 15]],
    ['0195', 'Quagsire', 20, [95, 85, 85, 65, 65, 35]]),
  lotad: L('agua', ['agua', 'planta'], 'parabolico', ['0270', 'Lotad', 1, [40, 30, 30, 40, 50, 30]],
    ['0271', 'Lombre', 14, [60, 50, 50, 60, 70, 50]],
    ['0272', 'Ludicolo', 34, [80, 70, 70, 90, 100, 70], 'piedra agua']),
  poliwag: L('agua', ['agua'], 'parabolico', ['0060', 'Poliwag', 1, [40, 50, 40, 40, 40, 90]],
    ['0061', 'Poliwhirl', 25, [65, 65, 65, 50, 50, 90]],
    ['0062', 'Poliwrath', 40, [90, 95, 95, 70, 90, 70], 'piedra agua']),
  goomy: L('dragon', ['dragon'], 'lento', ['0704', 'Goomy', 1, [45, 50, 35, 55, 75, 40]],
    ['0705', 'Sliggoo', 40, [68, 75, 53, 83, 113, 60]],
    ['0706', 'Goodra', 50, [90, 100, 70, 110, 150, 80], 'con lluvia']),
  wingull: L('agua', ['agua', 'volador'], 'medio', ['0278', 'Wingull', 1, [40, 30, 30, 55, 30, 85]],
    ['0279', 'Pelipper', 25, [60, 50, 100, 95, 70, 65]]),
  krabby: L('agua', ['agua'], 'medio', ['0098', 'Krabby', 1, [30, 105, 90, 25, 25, 50]],
    ['0099', 'Kingler', 28, [55, 130, 115, 50, 50, 75]]),
  corsola: L('agua', ['agua', 'roca'], 'rapido', ['0222', 'Corsola', 1, [65, 55, 95, 65, 95, 35]]),
  horsea: L('agua', ['agua'], 'medio', ['0116', 'Horsea', 1, [30, 40, 70, 70, 25, 60]],
    ['0117', 'Seadra', 32, [55, 65, 95, 95, 45, 85]],
    ['0230', 'Kingdra', 45, [75, 95, 95, 95, 95, 85], 'intercambio con Escama Dragón']),
  staryu: L('agua', ['agua'], 'lento', ['0120', 'Staryu', 1, [30, 45, 55, 70, 55, 85]],
    ['0121', 'Starmie', 30, [60, 75, 85, 100, 85, 115], 'piedra agua']),
  carvanha: L('agua', ['agua', 'siniestro'], 'lento', ['0318', 'Carvanha', 1, [45, 90, 20, 65, 20, 65]],
    ['0319', 'Sharpedo', 30, [70, 120, 40, 95, 40, 95]]),
  skrelp: L('veneno', ['veneno', 'agua'], 'medio', ['0690', 'Skrelp', 1, [50, 60, 60, 60, 60, 30]],
    ['0691', 'Dragalge', 48, [65, 75, 90, 97, 123, 44]]),
  feebas: L('agua', ['agua'], 'erratico', ['0349', 'Feebas', 1, [20, 15, 20, 10, 55, 80]],
    ['0350', 'Milotic', 30, [95, 60, 79, 100, 125, 81], 'con mucha belleza']),
  roggenrola: L('roca', ['roca'], 'parabolico', ['0524', 'Roggenrola', 1, [55, 75, 85, 25, 25, 15]],
    ['0525', 'Boldore', 25, [70, 105, 105, 50, 40, 20]],
    ['0526', 'Gigalith', 40, [85, 135, 130, 60, 80, 25], 'intercambio']),
  riolu: L('lucha', ['lucha'], 'parabolico', ['0447', 'Riolu', 1, [40, 70, 40, 35, 40, 60]],
    ['0448', 'Lucario', 25, [70, 110, 70, 115, 70, 90], 'amistad, de día']),
  croagunk: L('veneno', ['veneno', 'lucha'], 'medio', ['0453', 'Croagunk', 1, [48, 61, 40, 61, 40, 50]],
    ['0454', 'Toxicroak', 37, [83, 106, 65, 86, 65, 85]]),
  shuppet: L('fantasma', ['fantasma'], 'rapido', ['0353', 'Shuppet', 1, [44, 75, 35, 63, 33, 45]],
    ['0354', 'Banette', 37, [64, 115, 65, 83, 63, 65]]),
  duskull: L('fantasma', ['fantasma'], 'rapido', ['0355', 'Duskull', 1, [20, 40, 90, 30, 90, 25]],
    ['0356', 'Dusclops', 37, [40, 70, 130, 60, 130, 25]],
    ['0477', 'Dusknoir', 50, [45, 100, 135, 65, 135, 45], 'intercambio con Tela Terrible']),
  zorua: L('siniestro', ['siniestro'], 'parabolico', ['0570', 'Zorua', 1, [40, 65, 40, 80, 40, 65]],
    ['0571', 'Zoroark', 30, [60, 105, 60, 120, 60, 105]]),
  dreepy: L('fantasma', ['dragon', 'fantasma'], 'lento', ['0885', 'Dreepy', 1, [28, 60, 30, 40, 30, 82]],
    ['0886', 'Drakloak', 50, [68, 80, 50, 60, 50, 102]], ['0887', 'Dragapult', 60, [88, 120, 75, 100, 75, 142]]),
  drowzee: L('psiquico', ['psiquico'], 'medio', ['0096', 'Drowzee', 1, [60, 48, 45, 43, 90, 42]],
    ['0097', 'Hypno', 26, [85, 73, 70, 73, 115, 67]]),
  espurr: L('psiquico', ['psiquico'], 'medio', ['0677', 'Espurr', 1, [62, 48, 54, 63, 60, 68]],
    ['0678', 'Meowstic', 25, [74, 48, 76, 83, 81, 104]]),
  snubbull: L('hada', ['hada'], 'rapido', ['0209', 'Snubbull', 1, [60, 80, 50, 40, 40, 30]],
    ['0210', 'Granbull', 23, [90, 120, 75, 60, 60, 45]]),
  elgyem: L('psiquico', ['psiquico'], 'medio', ['0605', 'Elgyem', 1, [55, 55, 55, 85, 55, 30]],
    ['0606', 'Beheeyem', 42, [75, 75, 75, 125, 95, 40]]),
  bronzor: L('psiquico', ['acero', 'psiquico'], 'medio', ['0436', 'Bronzor', 1, [57, 24, 86, 24, 86, 23]],
    ['0437', 'Bronzong', 33, [67, 89, 116, 79, 116, 33]]),
  gothita: L('psiquico', ['psiquico'], 'parabolico', ['0574', 'Gothita', 1, [45, 30, 50, 55, 65, 45]],
    ['0575', 'Gothorita', 32, [60, 45, 70, 75, 85, 55]], ['0576', 'Gothitelle', 41, [70, 55, 95, 95, 110, 65]]),
  sigilyph: L('psiquico', ['psiquico', 'volador'], 'medio', ['0561', 'Sigilyph', 1, [72, 58, 80, 103, 80, 97]]),
  hatenna: L('psiquico', ['psiquico'], 'lento', ['0856', 'Hatenna', 1, [42, 30, 45, 56, 53, 39]],
    ['0857', 'Hattrem', 32, [57, 40, 65, 86, 73, 49]], ['0858', 'Hatterene', 42, [57, 90, 95, 136, 103, 29]]),
  numel: L('fuego', ['fuego', 'tierra'], 'medio', ['0322', 'Numel', 1, [60, 60, 40, 65, 45, 35]],
    ['0323', 'Camerupt', 33, [70, 100, 70, 105, 75, 40]]),
  ponyta: L('fuego', ['fuego'], 'medio', ['0077', 'Ponyta', 1, [50, 85, 55, 65, 65, 90]],
    ['0078', 'Rapidash', 40, [65, 100, 70, 80, 80, 105]]),
  houndour: L('fuego', ['siniestro', 'fuego'], 'lento', ['0228', 'Houndour', 1, [45, 60, 30, 80, 50, 65]],
    ['0229', 'Houndoom', 24, [75, 90, 50, 110, 80, 95]]),
  magby: L('fuego', ['fuego'], 'medio', ['0240', 'Magby', 1, [45, 75, 37, 70, 55, 83]],
    ['0126', 'Magmar', 30, [65, 95, 57, 100, 85, 93]],
    ['0467', 'Magmortar', 45, [75, 95, 67, 125, 95, 83], 'intercambio con Magmatizador']),
  salandit: L('fuego', ['veneno', 'fuego'], 'medio', ['0757', 'Salandit', 1, [48, 44, 40, 71, 40, 77]],
    ['0758', 'Salazzle', 33, [68, 64, 60, 111, 60, 117]]),
  turtonator: L('fuego', ['fuego', 'dragon'], 'medio', ['0776', 'Turtonator', 1, [60, 78, 135, 91, 85, 36]]),
  bagon: L('dragon', ['dragon'], 'lento', ['0371', 'Bagon', 1, [45, 75, 60, 40, 30, 50]],
    ['0372', 'Shelgon', 30, [65, 95, 100, 60, 50, 50]], ['0373', 'Salamence', 50, [95, 135, 80, 110, 80, 100]]),
  larvesta: L('fuego', ['bicho', 'fuego'], 'lento', ['0636', 'Larvesta', 1, [55, 85, 55, 50, 55, 60]],
    ['0637', 'Volcarona', 59, [85, 60, 65, 135, 105, 100]]),
  spheal: L('hielo', ['hielo', 'agua'], 'parabolico', ['0363', 'Spheal', 1, [70, 40, 50, 55, 50, 25]],
    ['0364', 'Sealeo', 32, [90, 60, 70, 75, 70, 45]], ['0365', 'Walrein', 44, [110, 80, 90, 95, 90, 65]]),
  snover: L('hielo', ['planta', 'hielo'], 'lento', ['0459', 'Snover', 1, [60, 62, 50, 62, 60, 40]],
    ['0460', 'Abomasnow', 40, [90, 92, 75, 92, 85, 60]]),
  cubchoo: L('hielo', ['hielo'], 'medio', ['0613', 'Cubchoo', 1, [55, 70, 40, 60, 40, 40]],
    ['0614', 'Beartic', 37, [95, 130, 80, 70, 80, 50]]),
  sneasel: L('hielo', ['siniestro', 'hielo'], 'parabolico', ['0215', 'Sneasel', 1, [55, 95, 55, 35, 75, 115]],
    ['0461', 'Weavile', 35, [70, 120, 65, 45, 85, 125], 'con Garra Afilada, de noche']),
  delibird: L('hielo', ['hielo', 'volador'], 'rapido', ['0225', 'Delibird', 1, [45, 55, 45, 65, 45, 75]]),
  smoochum: L('hielo', ['hielo', 'psiquico'], 'medio', ['0238', 'Smoochum', 1, [45, 30, 15, 85, 65, 65]],
    ['0124', 'Jynx', 30, [65, 50, 35, 115, 95, 95]]),
  snom: L('hielo', ['hielo', 'bicho'], 'medio', ['0872', 'Snom', 1, [30, 25, 35, 45, 30, 20]],
    ['0873', 'Frosmoth', 30, [70, 65, 60, 125, 90, 65], 'amistad, de noche']),
  cryogonal: L('hielo', ['hielo'], 'medio', ['0615', 'Cryogonal', 1, [80, 50, 50, 95, 135, 105]]),
  amaura: L('roca', ['roca', 'hielo'], 'medio', ['0698', 'Amaura', 1, [77, 59, 50, 67, 63, 46]],
    ['0699', 'Aurorus', 39, [123, 77, 72, 99, 92, 58]]),
  frigibax: L('hielo', ['dragon', 'hielo'], 'lento', ['0996', 'Frigibax', 1, [65, 75, 45, 35, 45, 55]],
    ['0997', 'Arctibax', 35, [90, 95, 66, 45, 65, 62]], ['0998', 'Baxcalibur', 54, [115, 145, 92, 75, 86, 87]]),

  // Las de la noche y las del clima de cada zona (data/aparicion.ts).
  venonat: L('bicho', ['bicho', 'veneno'], 'medio', ['0048', 'Venonat', 1, [60, 55, 50, 40, 55, 45]],
    ['0049', 'Venomoth', 31, [70, 65, 60, 90, 75, 90]]),
  pinsir: L('bicho', ['bicho'], 'lento', ['0127', 'Pinsir', 1, [65, 125, 100, 55, 70, 85]]),
  noibat: L('volador', ['volador', 'dragon'], 'medio', ['0714', 'Noibat', 1, [40, 30, 35, 45, 40, 55]],
    ['0715', 'Noivern', 48, [85, 70, 80, 97, 80, 123]]),
  surskit: L('bicho', ['bicho', 'agua'], 'medio', ['0283', 'Surskit', 1, [40, 30, 32, 50, 52, 65]],
    ['0284', 'Masquerain', 22, [70, 60, 62, 100, 82, 80]]),
  shroomish: L('planta', ['planta'], 'fluctuante', ['0285', 'Shroomish', 1, [60, 40, 60, 40, 60, 35]],
    ['0286', 'Breloom', 23, [60, 130, 80, 60, 60, 70]]),
  paras: L('bicho', ['bicho', 'planta'], 'medio', ['0046', 'Paras', 1, [35, 70, 55, 45, 55, 25]],
    ['0047', 'Parasect', 24, [60, 95, 80, 60, 80, 30]]),
  chinchou: L('agua', ['agua', 'electrico'], 'lento', ['0170', 'Chinchou', 1, [75, 38, 38, 56, 56, 67]],
    ['0171', 'Lanturn', 27, [125, 58, 58, 76, 76, 67]]),
  buizel: L('agua', ['agua'], 'medio', ['0418', 'Buizel', 1, [55, 65, 35, 60, 30, 85]],
    ['0419', 'Floatzel', 26, [85, 105, 55, 85, 50, 115]]),
  tympole: L('agua', ['agua'], 'parabolico', ['0535', 'Tympole', 1, [50, 50, 40, 50, 40, 64]],
    ['0536', 'Palpitoad', 30, [75, 65, 55, 65, 55, 69]], ['0537', 'Seismitoad', 36, [105, 95, 75, 85, 75, 74]]),
  shellder: L('agua', ['agua'], 'lento', ['0090', 'Shellder', 1, [30, 65, 100, 45, 25, 40]],
    ['0091', 'Cloyster', 35, [50, 95, 180, 85, 45, 70], 'piedra hielo']),
  mareanie: L('veneno', ['veneno', 'agua'], 'medio', ['0747', 'Mareanie', 1, [50, 53, 62, 43, 52, 45]],
    ['0748', 'Toxapex', 38, [50, 63, 152, 53, 142, 35]]),
  shellos: L('agua', ['agua'], 'medio', ['0422', 'Shellos', 1, [76, 48, 48, 57, 62, 34]],
    ['0423', 'Gastrodon', 30, [111, 83, 68, 92, 82, 39]]),
  clauncher: L('agua', ['agua'], 'lento', ['0692', 'Clauncher', 1, [50, 53, 62, 58, 63, 44]],
    ['0693', 'Clawitzer', 37, [71, 73, 88, 120, 89, 59]]),
  mantyke: L('agua', ['agua', 'volador'], 'lento', ['0458', 'Mantyke', 1, [45, 20, 50, 60, 120, 50]],
    ['0226', 'Mantine', 30, [85, 40, 70, 80, 140, 70], 'con un Remoraid en el equipo']),
  tentacool: L('agua', ['agua', 'veneno'], 'lento', ['0072', 'Tentacool', 1, [40, 40, 35, 50, 100, 70]],
    ['0073', 'Tentacruel', 30, [80, 70, 65, 80, 120, 100]]),
  woobat: L('psiquico', ['psiquico', 'volador'], 'medio', ['0527', 'Woobat', 1, [65, 45, 43, 55, 43, 72]],
    ['0528', 'Swoobat', 30, [67, 57, 55, 77, 55, 114], 'amistad']),
  nosepass: L('roca', ['roca'], 'medio', ['0299', 'Nosepass', 1, [30, 45, 135, 45, 90, 30]],
    ['0476', 'Probopass', 40, [60, 55, 145, 75, 150, 40], 'en un campo magnético']),
  carbink: L('roca', ['roca', 'hada'], 'lento', ['0703', 'Carbink', 1, [50, 50, 150, 50, 150, 50]]),
  sandshrew: L('tierra', ['tierra'], 'medio', ['0027', 'Sandshrew', 1, [50, 75, 85, 20, 30, 40]],
    ['0028', 'Sandslash', 22, [75, 100, 110, 45, 55, 65]]),
  hippopotas: L('tierra', ['tierra'], 'lento', ['0449', 'Hippopotas', 1, [68, 72, 78, 38, 42, 32]],
    ['0450', 'Hippowdon', 34, [108, 112, 118, 68, 72, 47]]),
  trapinch: L('tierra', ['tierra'], 'parabolico', ['0328', 'Trapinch', 1, [45, 100, 45, 45, 45, 10]],
    ['0329', 'Vibrava', 35, [50, 70, 50, 50, 50, 70]], ['0330', 'Flygon', 45, [80, 100, 80, 80, 80, 100]]),
  ekans: L('veneno', ['veneno'], 'medio', ['0023', 'Ekans', 1, [35, 60, 44, 40, 54, 55]],
    ['0024', 'Arbok', 22, [60, 95, 69, 65, 79, 80]]),
  skorupi: L('veneno', ['veneno', 'bicho'], 'lento', ['0451', 'Skorupi', 1, [40, 50, 90, 30, 55, 65]],
    ['0452', 'Drapion', 40, [70, 90, 110, 60, 75, 95]]),
  koffing: L('veneno', ['veneno'], 'medio', ['0109', 'Koffing', 1, [40, 65, 95, 60, 45, 35]],
    ['0110', 'Weezing', 35, [65, 90, 120, 85, 70, 60]]),
  phantump: L('fantasma', ['fantasma', 'planta'], 'medio', ['0708', 'Phantump', 1, [43, 70, 48, 50, 60, 38]],
    ['0709', 'Trevenant', 40, [85, 110, 76, 65, 82, 56], 'intercambio']),
  barboach: L('agua', ['agua', 'tierra'], 'medio', ['0339', 'Barboach', 1, [50, 48, 43, 46, 41, 60]],
    ['0340', 'Whiscash', 30, [110, 78, 73, 76, 71, 60]]),
  munna: L('psiquico', ['psiquico'], 'rapido', ['0517', 'Munna', 1, [76, 25, 45, 67, 55, 24]],
    ['0518', 'Musharna', 30, [116, 55, 85, 107, 95, 29], 'piedra lunar']),
  meditite: L('lucha', ['lucha', 'psiquico'], 'medio', ['0307', 'Meditite', 1, [30, 40, 55, 40, 55, 60]],
    ['0308', 'Medicham', 37, [60, 60, 75, 60, 75, 80]]),
  chingling: L('psiquico', ['psiquico'], 'rapido', ['0433', 'Chingling', 1, [45, 30, 50, 65, 50, 45]],
    ['0358', 'Chimecho', 30, [75, 50, 80, 95, 90, 65], 'amistad, de noche']),
  solrock: L('roca', ['roca', 'psiquico'], 'rapido', ['0338', 'Solrock', 1, [90, 95, 85, 55, 65, 70]]),
  lunatone: L('roca', ['roca', 'psiquico'], 'rapido', ['0337', 'Lunatone', 1, [90, 55, 65, 95, 85, 70]]),
  baltoy: L('tierra', ['tierra', 'psiquico'], 'medio', ['0343', 'Baltoy', 1, [40, 40, 55, 40, 70, 55]],
    ['0344', 'Claydol', 36, [60, 70, 105, 70, 120, 75]]),
  yamask: L('fantasma', ['fantasma'], 'medio', ['0562', 'Yamask', 1, [38, 30, 85, 55, 65, 30]],
    ['0563', 'Cofagrigus', 34, [58, 50, 145, 95, 105, 30]]),
  sandile: L('tierra', ['tierra', 'siniestro'], 'parabolico', ['0551', 'Sandile', 1, [50, 72, 35, 35, 35, 65]],
    ['0552', 'Krokorok', 29, [60, 82, 45, 45, 45, 74]], ['0553', 'Krookodile', 40, [95, 117, 80, 65, 70, 92]]),
  charcadet: L('fuego', ['fuego'], 'lento', ['0935', 'Charcadet', 1, [40, 50, 40, 50, 40, 35]],
    ['0936', 'Armarouge', 38, [85, 60, 100, 125, 80, 75], 'con la Armadura Auspiciosa']),
  heatmor: L('fuego', ['fuego'], 'medio', ['0631', 'Heatmor', 1, [85, 97, 66, 105, 66, 65]]),
  darumaka: L('fuego', ['fuego'], 'parabolico', ['0554', 'Darumaka', 1, [70, 90, 45, 15, 45, 50]],
    ['0555', 'Darmanitan', 35, [105, 140, 55, 30, 55, 95]]),
  deino: L('siniestro', ['siniestro', 'dragon'], 'lento', ['0633', 'Deino', 1, [52, 65, 50, 45, 50, 38]],
    ['0634', 'Zweilous', 50, [72, 85, 70, 65, 70, 58]], ['0635', 'Hydreigon', 64, [92, 105, 90, 125, 90, 98]]),
  vulpix: L('fuego', ['fuego'], 'medio', ['0037', 'Vulpix', 1, [38, 41, 40, 50, 65, 65]],
    ['0038', 'Ninetales', 35, [73, 76, 75, 81, 100, 100], 'piedra fuego']),
  sizzlipede: L('fuego', ['fuego', 'bicho'], 'medio', ['0850', 'Sizzlipede', 1, [50, 65, 45, 50, 50, 45]],
    ['0851', 'Centiskorch', 28, [100, 115, 65, 90, 90, 65]]),
  fletchling: L('volador', ['normal', 'volador'], 'parabolico', ['0661', 'Fletchling', 1, [45, 50, 43, 40, 38, 62]],
    ['0662', 'Fletchinder', 17, [62, 73, 55, 56, 52, 84]], ['0663', 'Talonflame', 35, [78, 81, 71, 74, 69, 126]]),
  teddiursa: L('normal', ['normal'], 'medio', ['0216', 'Teddiursa', 1, [60, 80, 50, 50, 50, 40]],
    ['0217', 'Ursaring', 30, [90, 130, 75, 75, 75, 55]]),
  cetoddle: L('hielo', ['hielo'], 'medio', ['0974', 'Cetoddle', 1, [108, 68, 45, 30, 40, 43]],
    ['0975', 'Cetitan', 35, [170, 113, 65, 45, 55, 73], 'piedra hielo']),
  absol: L('siniestro', ['siniestro'], 'parabolico', ['0359', 'Absol', 1, [65, 130, 60, 75, 60, 75]]),
  swablu: L('volador', ['normal', 'volador'], 'erratico', ['0333', 'Swablu', 1, [45, 40, 60, 40, 75, 50]],
    ['0334', 'Altaria', 35, [75, 70, 90, 70, 105, 80]]),
  eiscue: L('hielo', ['hielo'], 'lento', ['0875', 'Eiscue', 1, [75, 80, 110, 65, 90, 50]]),

  // Iniciales de todas las generaciones (Bulbasaur está arriba, en Planta): se eligen al empezar una partida del modo
  // aventura (scenes/Eleccion.ts) y no salen como salvajes. Todos son del grupo de experiencia medio-lento (parabólico).
  charmander: L('fuego', ['fuego'], 'parabolico', ['0004', 'Charmander', 1, [39, 52, 43, 60, 50, 65]], ['0005', 'Charmeleon', 16, [58, 64, 58, 80, 65, 80]],
    ['0006', 'Charizard', 36, [78, 84, 78, 109, 85, 100]]),
  squirtle: L('agua', ['agua'], 'parabolico', ['0007', 'Squirtle', 1, [44, 48, 65, 50, 64, 43]], ['0008', 'Wartortle', 16, [59, 63, 80, 65, 80, 58]],
    ['0009', 'Blastoise', 36, [79, 83, 100, 85, 105, 78]]),
  chikorita: L('planta', ['planta'], 'parabolico', ['0152', 'Chikorita', 1, [45, 49, 65, 49, 65, 45]], ['0153', 'Bayleef', 16, [60, 62, 80, 63, 80, 60]],
    ['0154', 'Meganium', 32, [80, 82, 100, 83, 100, 80]]),
  cyndaquil: L('fuego', ['fuego'], 'parabolico', ['0155', 'Cyndaquil', 1, [39, 52, 43, 60, 50, 65]], ['0156', 'Quilava', 14, [58, 64, 58, 80, 65, 80]],
    ['0157', 'Typhlosion', 36, [78, 84, 78, 109, 85, 100]]),
  totodile: L('agua', ['agua'], 'parabolico', ['0158', 'Totodile', 1, [50, 65, 64, 44, 48, 43]], ['0159', 'Croconaw', 18, [65, 80, 80, 59, 63, 58]],
    ['0160', 'Feraligatr', 30, [85, 105, 100, 79, 83, 78]]),
  treecko: L('planta', ['planta'], 'parabolico', ['0252', 'Treecko', 1, [40, 45, 35, 65, 55, 70]], ['0253', 'Grovyle', 16, [50, 65, 45, 85, 65, 95]],
    ['0254', 'Sceptile', 36, [70, 85, 65, 105, 85, 120]]),
  torchic: L('fuego', ['fuego'], 'parabolico', ['0255', 'Torchic', 1, [45, 60, 40, 70, 50, 45]], ['0256', 'Combusken', 16, [60, 85, 60, 85, 60, 55]],
    ['0257', 'Blaziken', 36, [80, 120, 70, 110, 70, 80]]),
  mudkip: L('agua', ['agua'], 'parabolico', ['0258', 'Mudkip', 1, [50, 70, 50, 50, 50, 40]], ['0259', 'Marshtomp', 16, [70, 85, 70, 60, 70, 50]],
    ['0260', 'Swampert', 36, [100, 110, 90, 85, 90, 60]]),
  turtwig: L('planta', ['planta'], 'parabolico', ['0387', 'Turtwig', 1, [55, 68, 64, 45, 55, 31]], ['0388', 'Grotle', 18, [75, 89, 85, 55, 65, 36]],
    ['0389', 'Torterra', 32, [95, 109, 105, 75, 85, 56]]),
  chimchar: L('fuego', ['fuego'], 'parabolico', ['0390', 'Chimchar', 1, [44, 58, 44, 58, 44, 61]], ['0391', 'Monferno', 14, [64, 78, 52, 78, 52, 81]],
    ['0392', 'Infernape', 36, [76, 104, 71, 104, 71, 108]]),
  piplup: L('agua', ['agua'], 'parabolico', ['0393', 'Piplup', 1, [53, 51, 53, 61, 56, 40]], ['0394', 'Prinplup', 16, [64, 66, 68, 81, 76, 50]],
    ['0395', 'Empoleon', 36, [84, 86, 88, 111, 101, 60]]),
  snivy: L('planta', ['planta'], 'parabolico', ['0495', 'Snivy', 1, [45, 45, 55, 45, 55, 63]], ['0496', 'Servine', 17, [60, 60, 75, 60, 75, 83]],
    ['0497', 'Serperior', 36, [75, 75, 95, 75, 95, 113]]),
  tepig: L('fuego', ['fuego'], 'parabolico', ['0498', 'Tepig', 1, [65, 63, 45, 45, 45, 45]], ['0499', 'Pignite', 17, [90, 93, 55, 70, 55, 55]],
    ['0500', 'Emboar', 36, [110, 123, 65, 100, 65, 65]]),
  oshawott: L('agua', ['agua'], 'parabolico', ['0501', 'Oshawott', 1, [55, 55, 45, 63, 45, 45]], ['0502', 'Dewott', 17, [75, 75, 60, 83, 60, 60]],
    ['0503', 'Samurott', 36, [95, 100, 85, 108, 70, 70]]),
  chespin: L('planta', ['planta'], 'parabolico', ['0650', 'Chespin', 1, [56, 61, 65, 48, 45, 38]], ['0651', 'Quilladin', 16, [61, 78, 95, 56, 58, 57]],
    ['0652', 'Chesnaught', 36, [88, 107, 122, 74, 75, 64]]),
  fennekin: L('fuego', ['fuego'], 'parabolico', ['0653', 'Fennekin', 1, [40, 45, 40, 62, 60, 60]], ['0654', 'Braixen', 16, [59, 59, 58, 90, 70, 73]],
    ['0655', 'Delphox', 36, [75, 69, 72, 114, 100, 104]]),
  froakie: L('agua', ['agua'], 'parabolico', ['0656', 'Froakie', 1, [41, 56, 40, 62, 44, 71]], ['0657', 'Frogadier', 16, [54, 63, 52, 83, 56, 97]],
    ['0658', 'Greninja', 36, [72, 95, 67, 103, 71, 122]]),
  rowlet: L('planta', ['planta', 'volador'], 'parabolico', ['0722', 'Rowlet', 1, [68, 55, 55, 50, 50, 42]], ['0723', 'Dartrix', 17, [78, 75, 75, 70, 70, 52]],
    ['0724', 'Decidueye', 34, [78, 107, 75, 100, 100, 70]]),
  litten: L('fuego', ['fuego'], 'parabolico', ['0725', 'Litten', 1, [45, 65, 40, 60, 40, 70]], ['0726', 'Torracat', 17, [65, 85, 50, 80, 50, 90]],
    ['0727', 'Incineroar', 34, [95, 115, 90, 80, 90, 60]]),
  popplio: L('agua', ['agua'], 'parabolico', ['0728', 'Popplio', 1, [50, 54, 54, 66, 56, 40]], ['0729', 'Brionne', 17, [60, 69, 69, 91, 81, 50]],
    ['0730', 'Primarina', 34, [80, 74, 74, 126, 116, 60]]),
  grookey: L('planta', ['planta'], 'parabolico', ['0810', 'Grookey', 1, [50, 65, 50, 40, 40, 65]], ['0811', 'Thwackey', 16, [70, 85, 70, 55, 60, 80]],
    ['0812', 'Rillaboom', 35, [100, 125, 90, 60, 70, 85]]),
  scorbunny: L('fuego', ['fuego'], 'parabolico', ['0813', 'Scorbunny', 1, [50, 71, 40, 40, 40, 69]], ['0814', 'Raboot', 16, [65, 86, 60, 55, 60, 94]],
    ['0815', 'Cinderace', 35, [80, 116, 75, 65, 75, 119]]),
  sobble: L('agua', ['agua'], 'parabolico', ['0816', 'Sobble', 1, [50, 40, 40, 70, 40, 70]], ['0817', 'Drizzile', 16, [65, 60, 55, 95, 55, 90]],
    ['0818', 'Inteleon', 35, [70, 85, 65, 125, 65, 120]]),
  sprigatito: L('planta', ['planta'], 'parabolico', ['0906', 'Sprigatito', 1, [40, 61, 54, 45, 45, 65]], ['0907', 'Floragato', 16, [61, 80, 63, 60, 63, 83]],
    ['0908', 'Meowscarada', 36, [76, 110, 70, 81, 70, 123]]),
  fuecoco: L('fuego', ['fuego'], 'parabolico', ['0909', 'Fuecoco', 1, [67, 45, 59, 63, 40, 36]], ['0910', 'Crocalor', 16, [81, 55, 78, 90, 58, 49]],
    ['0911', 'Skeledirge', 36, [104, 75, 100, 110, 75, 66]]),
  quaxly: L('agua', ['agua'], 'parabolico', ['0912', 'Quaxly', 1, [55, 65, 45, 50, 45, 50]], ['0913', 'Quaxwell', 16, [70, 85, 65, 65, 60, 65]],
    ['0914', 'Quaquaval', 36, [85, 120, 80, 85, 75, 85]]),
};

// Iniciales: los 27 de Planta, Fuego y Agua de las nueve generaciones.
export const INICIALES = ['bulbasaur', 'charmander', 'squirtle', 'chikorita', 'cyndaquil', 'totodile', 'treecko', 'torchic', 'mudkip',
  'turtwig', 'chimchar', 'piplup', 'snivy', 'tepig', 'oshawott', 'chespin', 'fennekin', 'froakie', 'rowlet', 'litten', 'popplio',
  'grookey', 'scorbunny', 'sobble', 'sprigatito', 'fuecoco', 'quaxly'];

// Evoluciones con objeto (modo aventura): línea de origen → objeto → línea a la que pasa. Las de destino son ramas:
// no salen como salvajes, ni como visitantes del pueblo, ni para elegir al empezar.
export const EVO_OBJETO: Record<string, Record<string, string>> = {
  eevee: { waterstone: 'vaporeon', thunderstone: 'jolteon', firestone: 'flareon', leafstone: 'leafeon', icestone: 'glaceon' },
};
export const RAMAS = new Set(Object.values(EVO_OBJETO).flatMap(o => Object.values(o)));

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
