// Rellano de vuelo (docs/GDD-mundo.md): en cada zona, un ensanche de losas apartado del camino y unido a él por un
// sendero corto, donde esperan el volador (Corviknight) y su farol. Lo reservan los generadores de las zonas
// (bosque.ts, biomas.ts, puebloAventura.ts) sin gastar tiradas de su semilla: el resto de la zona sale igual.
export interface PuntoR { x: number; y: number }
export const RELLANO = { rx: 62, ry: 46 };
// ¿(x, y) está en el rellano c? m > 0 lo agranda (para apartar árboles y piezas); m < 0 lo encoge (las losas).
export const enRellano = (c: PuntoR | null | undefined, x: number, y: number, m = 0): boolean =>
  !!c && ((x - c.x) / (RELLANO.rx + m)) ** 2 + ((y - c.y) / (RELLANO.ry + m)) ** 2 < 1;
// Dónde va el volador dentro del rellano (Aventura pone su farol 30 px a la izquierda).
export const sitioVolador = (c: PuntoR): PuntoR => ({ x: Math.round(c.x + 16), y: Math.round(c.y + 6) });
// ¿Algo alto con el pie en (x, y) taparía el rellano c? Vista 3/4: lo alto crece hacia arriba, así que por debajo
// del rellano hay que apartarlo más (su copa subiría hasta las losas).
export const tapaRellano = (c: PuntoR | null | undefined, x: number, y: number): boolean =>
  !!c && Math.abs(x - c.x) < RELLANO.rx + 45 && y > c.y - RELLANO.ry - 30 && y < c.y + RELLANO.ry + 120;
