// Naturalezas de los salvajes: deciden cómo reaccionan ante un rival (tú u otro jugador) según la diferencia de nivel.
// docs/GDD-combate.md §5.1. Sin Phaser: lo usa mundo.ts.

// Reacciones posibles:
//  acecha     te ataca en cuanto te acercas (sin que le pegues)
//  pelea      te ataca si le pegas
//  llama      te ataca si le pegas y avisa a los salvajes de alrededor, que se suman (salvo los que huyen o se quedan quietos)
//  aguanta    el primer golpe lo encaja sin moverse; al segundo, pelea
//  acorralado huye, pero con menos de la mitad de los PS se da la vuelta y pelea
//  huye       si le pegas, sale corriendo unos segundos y luego vuelve a pasear
//  espanta    huye en cuanto te ve cerca, sin que le pegues
//  quieto     ni huye ni pelea: se queda donde está
export type Reaccion = 'acecha' | 'pelea' | 'llama' | 'aguanta' | 'acorralado' | 'huye' | 'espanta' | 'quieto';
// Caso según el nivel del rival frente al del salvaje: igual (±1), fuerte (rival 2 o más por encima), debil (2 o más por debajo).
export type Caso = 'igual' | 'fuerte' | 'debil';

export const NOMBRE_REACCION: Record<Reaccion, string> = {
  acecha: 'Te acecha', pelea: 'Se defiende', llama: 'Llama a los suyos', aguanta: 'Aguanta',
  acorralado: 'Huye; acorralado, pelea', huye: 'Huye', espanta: 'Huye al verte', quieto: 'Se queda quieto',
};
// Color de la placa y del círculo: rojo si te ataca, amarillo si huye, verde si se deja.
export const COLOR_REACCION: Record<Reaccion, number> = {
  acecha: 0xff5a4a, pelea: 0xff8a5a, llama: 0xff7a9a, aguanta: 0x8fd36a, acorralado: 0xffb84a, huye: 0xffd65a, espanta: 0xffe88a, quieto: 0x8fd3b0,
};

export interface Naturaleza { nombre: string; igual: Reaccion; fuerte: Reaccion; debil: Reaccion }
// Las 25 naturalezas (nombres oficiales en español). `rara` tira sus tres reacciones al azar al aparecer.
export const NATURALEZAS: Record<string, Naturaleza> = {
  fuerte:   { nombre: 'Fuerte',   igual: 'pelea',      fuerte: 'pelea',      debil: 'acecha' },
  hurana:   { nombre: 'Huraña',   igual: 'pelea',      fuerte: 'espanta',       debil: 'acecha' },
  firme:    { nombre: 'Firme',    igual: 'pelea',      fuerte: 'pelea',      debil: 'acecha' },
  picara:   { nombre: 'Pícara',   igual: 'acecha',     fuerte: 'acorralado', debil: 'acecha' },
  audaz:    { nombre: 'Audaz',    igual: 'acecha',     fuerte: 'pelea',      debil: 'acecha' },
  osada:    { nombre: 'Osada',    igual: 'aguanta',    fuerte: 'aguanta',    debil: 'pelea' },
  docil:    { nombre: 'Dócil',    igual: 'quieto',     fuerte: 'huye',       debil: 'aguanta' },
  placida:  { nombre: 'Plácida',  igual: 'quieto',     fuerte: 'quieto',     debil: 'aguanta' },
  agitada:  { nombre: 'Agitada',  igual: 'pelea',      fuerte: 'acorralado', debil: 'acecha' },
  floja:    { nombre: 'Floja',    igual: 'quieto',     fuerte: 'huye',       debil: 'quieto' },
  miedosa:  { nombre: 'Miedosa',  igual: 'huye',       fuerte: 'espanta',       debil: 'acorralado' },
  activa:   { nombre: 'Activa',   igual: 'acecha',     fuerte: 'espanta',       debil: 'acecha' },
  seria:    { nombre: 'Seria',    igual: 'pelea',      fuerte: 'llama',      debil: 'pelea' },
  alegre:   { nombre: 'Alegre',   igual: 'pelea',      fuerte: 'acorralado', debil: 'acecha' },
  ingenua:  { nombre: 'Ingenua',  igual: 'acecha',     fuerte: 'acecha',     debil: 'pelea' },
  modesta:  { nombre: 'Modesta',  igual: 'aguanta',    fuerte: 'huye',       debil: 'pelea' },
  afable:   { nombre: 'Afable',   igual: 'aguanta',    fuerte: 'acorralado', debil: 'pelea' },
  mansa:    { nombre: 'Mansa',    igual: 'quieto',     fuerte: 'aguanta',    debil: 'aguanta' },
  timida:   { nombre: 'Tímida',   igual: 'espanta',    fuerte: 'espanta',       debil: 'aguanta' },
  alocada:  { nombre: 'Alocada',  igual: 'acecha',     fuerte: 'pelea',      debil: 'acecha' },
  serena:   { nombre: 'Serena',   igual: 'aguanta',    fuerte: 'aguanta',    debil: 'quieto' },
  amable:   { nombre: 'Amable',   igual: 'quieto',     fuerte: 'acorralado', debil: 'quieto' },
  grosera:  { nombre: 'Grosera',  igual: 'llama',      fuerte: 'llama',      debil: 'acecha' },
  cauta:    { nombre: 'Cauta',    igual: 'aguanta',    fuerte: 'llama',      debil: 'pelea' },
  rara:     { nombre: 'Rara',     igual: 'pelea',      fuerte: 'pelea',      debil: 'pelea' },   // al azar al aparecer (tablaDe)
};
export const IDS_NATURALEZA = Object.keys(NATURALEZAS);
const TODAS: Reaccion[] = ['acecha', 'pelea', 'llama', 'aguanta', 'acorralado', 'huye', 'espanta', 'quieto'];

export function casoDe(nivelRival: number, nivelSalvaje: number): Caso {
  const d = nivelRival - nivelSalvaje;
  return d >= 2 ? 'fuerte' : d <= -2 ? 'debil' : 'igual';
}
// La tabla de un salvaje: la de su naturaleza; la Rara, con sus tres casos al azar (fijos mientras viva).
export function tablaDe(natu: string, rnd: () => number): Naturaleza {
  const n = NATURALEZAS[natu] ?? NATURALEZAS.fuerte;
  if (natu !== 'rara') return n;
  const r = () => TODAS[Math.floor(rnd() * TODAS.length)];
  return { nombre: n.nombre, igual: r(), fuerte: r(), debil: r() };
}
