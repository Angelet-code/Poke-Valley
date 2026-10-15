// Ciudad (2026-10-15): mapa de prueba del kit de la ciudad en estilo Arcane (docs/art/ARCANE.md, "Ciudad"): pavimentos
// repetibles, tiras (muralla, fachadas, verja, seto, muro del canal, puente) y piezas sueltas (edificios y mobiliario).
// Entrar: pv.scene.getScene('title').scene.start('aventura', {mapa: 'ciudad'}).
// De norte a sur: la muralla con su portón; casas adosadas, centro Pokémon, tienda y torre del reloj; la acera de
// ladrillo; el gimnasio, la plaza de losas con la fuente y el parque del este; la calle de adoquín; el mercado, las
// casas y el ayuntamiento; el paseo del canal y el canal, que se cruza por el puente hacia el sur.
import type { Colocado } from './mapaDibujo';
import type { MapaAventura, Pavimento } from './bosque';

// Texturas de lab/assets/suelo_arcane/ciudad/ (Preload las carga como ciudad_<id>).
export const SUELOS_CIUDAD = ['adoquin', 'losas_plaza', 'ladrillo', 'calzada', 'baldosa', 'tierra_batida', 'cesped_parque', 'canal'];

const T = 24, MW = 56, MH = 44, W = MW * T, H = MH * T;
const CANAL_Y = 966;   // del muro del canal hacia abajo, agua

export function ciudad(): MapaAventura {
  const vert: number[][] = [];
  for (let vy = 0; vy <= MH; vy++) {
    const fila: number[] = [];
    for (let vx = 0; vx <= MW; vx++) fila.push(vy * T >= CANAL_Y + 12 ? 3 : 0);
    vert.push(fila);
  }
  const p = (tex: string, x: number, y: number, w: number, h: number, escala: number): Pavimento => ({ tex, x, y, w, h, escala });
  const pavimentos: Pavimento[] = [
    p('ladrillo', 0, 110, W, 230, 0.5),           // del pie de la muralla a la acera de las casas del norte
    p('cesped_parque', 1060, 150, 284, 470, 0.8), // parque
    p('tierra_batida', 1160, 150, 50, 470, 0.7),  // su paseo
    p('losas_plaza', 410, 340, 570, 280, 0.6),    // plaza
    p('baldosa', 0, 340, 410, 280, 0.45),         // explanada del gimnasio
    p('adoquin', 0, 620, W, 90, 0.75),            // calle
    p('calzada', 980, 140, 80, 480, 0.5),         // calle del parque
    p('adoquin', 0, 710, 660, 190, 0.75),         // mercado
    p('ladrillo', 660, 710, W - 660, 190, 0.5),   // acera de las casas del sur
    p('losas_plaza', 0, 900, W, 66, 0.6),         // paseo del canal
    p('canal', 0, CANAL_Y - 30, W, H - CANAL_Y + 30, 0.9),   // el agua (bajo el muro del canal)
  ];
  const t = (pieza: string, x: number, y: number, hasta: number, inserto?: string, en?: number): Colocado =>
    ({ id: `${pieza}_ciudad`, x, y, tira: { hasta, inserto: inserto && `${inserto}_ciudad`, en } });
  const farola = (x: number, y: number, doble = false): Colocado => ({ id: doble ? 'farola_doble' : 'farola_ciudad', x, y });
  const colocados: Colocado[] = [
    // Norte: muralla con portón, casas adosadas, centro Pokémon, tienda, torre del reloj.
    t('muro', 0, 112, W, 'porton', 672),
    t('fachada', 10, 292, 380),
    { id: 'centro_pokemon', x: 520, y: 292 },
    { id: 'tienda_pokemon', x: 760, y: 292 },
    { id: 'torre_reloj', x: 930, y: 290 },
    { id: 'escalera_plaza', x: 640, y: 362, s: 0.6 }, { id: 'buzon', x: 595, y: 312 }, { id: 'papelera', x: 870, y: 312 }, { id: 'maceta', x: 405, y: 312 },
    farola(450, 330), farola(890, 330),
    // Gimnasio y su explanada.
    { id: 'gimnasio', x: 200, y: 560 },
    { id: 'estatua_ciudad', x: 360, y: 600 }, { id: 'maceta', x: 50, y: 600 },
    farola(40, 360), farola(380, 360),
    // Plaza: fuente, mosaico, bancos, árboles y farolas dobles.
    { id: 'fuente', x: 680, y: 470 },
    { id: 'escudo_suelo', x: 680, y: 580 },
    { id: 'banco', x: 560, y: 430 }, { id: 'banco', x: 800, y: 430, flip: true },
    { id: 'arbol_alcorque', x: 450, y: 400 }, { id: 'arbol_alcorque', x: 910, y: 400 },
    { id: 'arbol_alcorque', x: 450, y: 600 }, { id: 'arbol_alcorque', x: 910, y: 600 },
    farola(560, 560, true), farola(800, 560, true),
    { id: 'columna_anuncios', x: 960, y: 640 }, { id: 'fuente_beber', x: 420, y: 500 },
    // Parque: seto alrededor, quiosco de música, bancos y árboles.
    t('seto_v', 1070, 160, 600), t('seto', 1080, 618, 1150), t('seto', 1225, 618, W),
    { id: 'kiosko_musica', x: 1270, y: 380 },
    { id: 'banco', x: 1110, y: 300 }, { id: 'banco', x: 1110, y: 470 },
    { id: 'arbol_alcorque', x: 1270, y: 560 }, { id: 'parterre', x: 1270, y: 230 }, { id: 'parterre', x: 1110, y: 560 },
    farola(1150, 200), farola(1220, 420),
    // Calle: alcantarillas, poste indicador y un pozo.
    { id: 'alcantarilla', x: 300, y: 668 }, { id: 'alcantarilla', x: 1000, y: 668 },
    { id: 'poste_indicador', x: 990, y: 710 },
    // Mercado: el mercado cubierto, puestos, cajas, carro y la terraza del café.
    { id: 'mercado_cubierto', x: 140, y: 880 },
    { id: 'puesto_mercado', x: 320, y: 790 }, { id: 'puesto_flores', x: 430, y: 790 },
    { id: 'cajas_barriles', x: 280, y: 880 }, { id: 'carro', x: 540, y: 880, flip: true },
    { id: 'toldo_cafe', x: 420, y: 880 }, { id: 'pozo_ciudad', x: 600, y: 770 },
    farola(250, 730), farola(560, 730),
    // Casas del sur y ayuntamiento.
    { id: 'casa_ciudad_1', x: 730, y: 880 }, { id: 'casa_ciudad_2', x: 850, y: 880 }, { id: 'casa_ciudad_3', x: 985, y: 880 },
    { id: 'ayuntamiento', x: 1210, y: 880 },
    farola(1080, 900),
    // Canal: verja y muro del canal (con escalera) a los dos lados del puente, que cruza al sur.
    t('valla', 20, 920, 300), t('valla', 420, 920, 640),
    t('acantilado', 0, CANAL_Y, 650, 'escalera', 360),
    t('acantilado', 710, CANAL_Y, W),
    t('puente_v', 680, 930, H),
    t('bordillo', 740, 912, 1300),
  ];
  return {
    id: 'ciudad', nombre: 'Ciudad', lema: 'Kit de la ciudad (prueba)', bienvenida: 'Ciudad de prueba: pavimentos, tiras y piezas del kit Arcane.',
    datos: { mw: MW, mh: MH, vert, inicio: [680, 540] }, W, H, colocados, detalles: 0, pavimentos,
    llegada: { inicio: { x: 680, y: 540, dir: 0 }, pueblo: { x: 680, y: 1030, dir: 4 } },
    salidas: [{ x0: 650, y0: H - 14, x1: 710, y1: H, a: 'pueblo', texto: 'Al pueblo' }], salvajes: [],
  };
}
