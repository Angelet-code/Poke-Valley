// Vuelca la estructura de las zonas de bioma (src/data/biomas.ts) a JSON, sin abrir el juego: macizo, vértices del
// suelo (3 = agua), salvajes, alfa y salidas. Lo pinta tools/zonas/estructura.py.
// Uso (desde la raíz): npx esbuild tools/zonas/volcar.ts --bundle --platform=node --outfile=tools/zonas/volcar.cjs
//                      node tools/zonas/volcar.cjs tools/zonas/estructura.json [semilla]
import { writeFileSync } from 'fs';
import { BIOMAS, zonaBioma } from '../../src/data/biomas';

const semilla = Number(process.argv[3] ?? 123456789), out: Record<string, unknown> = {};
for (const b of BIOMAS) {
  const m = zonaBioma(b, semilla), z = m.macizo!;
  out[b] = { cols: z.cols, filas: z.filas, cel: z.cel, macizo: Array.from(z.datos), vert: m.datos.vert, W: m.W, H: m.H, alfa: m.alfa, salvajes: m.salvajes.map(s => [s.x, s.y]), salidas: m.salidas };
}
writeFileSync(process.argv[2], JSON.stringify(out));
console.log('zonas:', BIOMAS.join(', '), '· semilla', semilla);
