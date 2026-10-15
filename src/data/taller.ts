// Taller (2026-10-15): un mapa de prueba con las barreras y piezas para construir de un bioma (docs/art/ARCANE.md,
// "Muros y barreras"): acantilado con escalera, muro con portón, valla, puente sobre un río, las mismas en vertical,
// montaña y arboleda. Se elige el bioma con ?taller=<bioma> (comun, costa, cantera, pantano, ruinas, volcan, nieve).
// Entrar: pv.scene.getScene('title').scene.start('aventura', {mapa: 'taller'}).
// Cada tira es un Colocado con `tira` (Dibujo.expandirTiras la cambia por sus piezas).
import type { Colocado } from './mapaDibujo';
import type { MapaAventura } from './bosque';
import { esBioma } from './biomas';

const T = 24, MW = 56, MH = 44, W = MW * T, H = MH * T;
// Agua: un río vertical (lo cruza el puente horizontal) y un canal horizontal (lo cruza el vertical).
const RIO = { x0: 520, x1: 600, y0: 300, y1: 600 }, CANAL = { x0: 700, x1: 1320, y0: 770, y1: 840 };

export function taller(): MapaAventura {
  const q = typeof location !== 'undefined' ? new URLSearchParams(location.search).get('taller') ?? 'comun' : 'comun';
  const bio = esBioma(q) ? q : 'comun', su = esBioma(q) ? q : undefined;
  const dentro = (r: typeof RIO, x: number, y: number) => x >= r.x0 && x <= r.x1 && y >= r.y0 && y <= r.y1;
  const vert: number[][] = [];
  for (let vy = 0; vy <= MH; vy++) {
    const fila: number[] = [];
    for (let vx = 0; vx <= MW; vx++) fila.push(dentro(RIO, vx * T, vy * T) || dentro(CANAL, vx * T, vy * T) ? 3 : 0);
    vert.push(fila);
  }
  const t = (pieza: string, x: number, y: number, hasta: number, inserto?: string, en?: number): Colocado =>
    ({ id: `${pieza}_${bio}`, x, y, tira: { hasta, inserto: inserto && `${inserto}_${bio}`, en } });
  const colocados: Colocado[] = [
    t('acantilado', 60, 220, 470, 'escalera', 270),
    t('muro', 660, 200, 1020, 'porton', 840),
    { id: `montana_${bio}`, x: 1190, y: 300 },
    t('valla', 60, 470, 380),
    t('puente', 470, 470, 650),
    { id: `arboleda_${bio}`, x: 900, y: 560 },
    t('acantilado_v', 120, 640, 980),
    t('muro_v', 280, 640, 980),
    t('valla_v', 420, 640, 980),
    t('puente_v', 1000, 700, 910),
    t('muro', 700, 700, 940),   // un rincón: muro horizontal que se junta con uno vertical
    t('muro_v', 940, 700, 760),
  ];
  return {
    id: 'taller', nombre: `Taller · ${bio}`, lema: 'Barreras y piezas para construir', bienvenida: `Taller (${bio}): ?taller=<bioma> cambia el bioma.`,
    datos: { mw: MW, mh: MH, vert, inicio: [700, 380] }, W, H, colocados, detalles: 0,
    llegada: { inicio: { x: 700, y: 380, dir: 0 }, pueblo: { x: 700, y: 380, dir: 0 } },
    salidas: [{ x0: 620, y0: H - 14, x1: 780, y1: H, a: 'pueblo', texto: 'Al pueblo' }], salvajes: [], suelo: su,
  };
}
