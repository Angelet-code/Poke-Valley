// Comprueba las líneas de ataque (src/data/lineasAtaque.ts, docs/GDD-combate.md §3.3): dentro de cada línea, todos
// tienen la misma firma (firmaAtaque) y cada uno tiene que rendir más que el anterior. Escribe docs/lineas-ataque.md
// y avisa de lo que no cumple.
//   npx esbuild tools/lineas_ataque.ts --bundle --platform=node --format=esm --outfile=proc/lineas_ataque.mjs && node proc/lineas_ataque.mjs
//
// Rendimiento = potencia/s de la rotación: el relleno (un instantáneo sin recarga, 36,4/s) más lo que añade este
// movimiento cada vez que vuelve. Es lo que importa al jugar: el de más CD solo es mejor si añade más.
import { writeFileSync } from 'node:fs';
import datos from '../src/data/gen/combate.json';
import { getMove, TIPO_ES, type MoveData } from '../src/data/movimientos';
import { LINEAS_ATAQUE, ROMANO, firmaAtaque, lineaAtaque, rangoAtaque } from '../src/data/lineasAtaque';
import { GCD, perfil, potenciaEfectiva } from '../src/combate/reglas';

const R_INST = 40 / GCD;
const r1 = (x: number) => Math.round(x * 10) / 10;
export function rendimiento(m: MoveData): number {
  const pf = perfil(m), pe = potenciaEfectiva(m), T = Math.max(GCD, pf.t) + pf.agotado;
  if (pf.cd <= GCD + 1e-9) return pe / T;            // se puede repetir sin esperar: es su propio relleno
  return R_INST + Math.max(0, pe - R_INST * T) / Math.max(pf.cd, T);
}
const fila = (m: MoveData) => {
  const pf = perfil(m), lanza = pf.lanza === 'instant' ? 'instantáneo' : `${pf.lanza === 'canal' ? 'canalizado' : 'lanzado'} ${pf.t} s`;
  return `| ${ROMANO[rangoAtaque(m)]} | ${m.nombre} | ${m.basePower} | ${lanza} | ${pf.cd > GCD ? pf.cd + ' s' : '—'} | ${r1(rendimiento(m))} |`;
};

const D = datos as unknown as { aprende: Record<string, { lista: [number, string][] }> };
const usados = new Set<string>();
for (const a of Object.values(D.aprende)) for (const [, id] of a.lista) usados.add(id);

const fallos: string[] = [];
let md = `# Líneas de ataque (generado)\n\n> \`tools/lineas_ataque.ts\`. Reglas en docs/GDD-combate.md §3.3; líneas en src/data/lineasAtaque.ts.\n\n`;
md += `Rendimiento = potencia/s de la rotación (relleno + este movimiento cada vez que vuelve). Dentro de una línea tiene que subir siempre.\n\n`;
const porTipo = new Map<string, string[]>();
for (const [nombre, ids] of Object.entries(LINEAS_ATAQUE)) {
  const ms = ids.map(id => getMove(id)).filter((m): m is MoveData => !!m);
  if (ms.length !== ids.length) fallos.push(`${nombre}: no existe ${ids.filter(id => !getMove(id)).join(', ')}`);
  for (const m of ms.slice(1)) if (firmaAtaque(m) !== firmaAtaque(ms[0]))
    fallos.push(`${nombre}: ${m.nombre} (${firmaAtaque(m)}) no tiene la firma de ${ms[0].nombre} (${firmaAtaque(ms[0])})`);
  for (let i = 1; i < ms.length; i++) if (rendimiento(ms[i]) <= rendimiento(ms[i - 1]) + 0.05)
    fallos.push(`${nombre}: ${ms[i].nombre} (${r1(rendimiento(ms[i]))}) no mejora a ${ms[i - 1].nombre} (${r1(rendimiento(ms[i - 1]))})`);
  const t = TIPO_ES[ms[0].type];
  porTipo.set(t, [...porTipo.get(t) ?? [], `### ${nombre}\n\n${firmaAtaque(ms[0])}\n\n| Rango | Movimiento | Potencia | Lanzamiento | CD | Rendimiento |\n|---|---|---|---|---|---|\n${ms.map(fila).join('\n')}\n`]);
}
for (const [t, ls] of porTipo) md += `## ${t}\n\n${ls.join('\n')}\n`;
const solos = [...usados].map(id => getMove(id)!).filter(m => m && m.category !== 'Status' && !lineaAtaque(m.id))
  .sort((a, b) => a.type.localeCompare(b.type) || a.basePower - b.basePower);
md += `## Sueltos (sin línea: rango por potencia)\n\n| Rango | Movimiento | Potencia | Lanzamiento | CD | Rendimiento |\n|---|---|---|---|---|---|\n${solos.map(fila).join('\n')}\n`;
if (fallos.length) md += `\n## Fallos\n\n${fallos.map(f => `- ${f}`).join('\n')}\n`;
writeFileSync('docs/lineas-ataque.md', md);
console.log(`${Object.keys(LINEAS_ATAQUE).length} líneas, ${solos.length} sueltos. ${fallos.length ? 'FALLOS:\n' + fallos.join('\n') : 'Todas suben.'}`);
