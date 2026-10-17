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

// ---- Tipos de ataque: la firma sin el tipo (docs/tipos-ataque.md) ----
// Ascuas, Pistola Agua e Impactrueno son el mismo tipo de ataque ("especial a distancia a uno") en tipos distintos; las
// líneas van dentro de un tipo de ataque (Ascuas → Lanzallamas sube de potencia sin cambiar nada más). Dos tipos de
// ataque que solo se diferencian en una cosa (Rayo / Chispazo: a uno o alrededor) son variantes.
const CAT: Record<string, string> = { Physical: 'Físico', Special: 'Especial' };
const FORMA: Record<string, string> = { objetivo: 'a uno', allAdjacentFoes: 'en área', allAdjacent: 'alrededor' };
const partes = (m: MoveData) => firmaAtaque(m).split(' · ').slice(1).map(x => CAT[x] ?? FORMA[x] ?? (x === 'cuerpo' ? 'cuerpo a cuerpo' : x === 'distancia' ? 'a distancia' : x === '100 %' ? '' : x === 'no falla' ? 'no falla' : /%$/.test(x) ? `precisión ${x}` : x)).filter(Boolean);
const arq = new Map<string, MoveData[]>();
for (const id of usados) {
  const m = getMove(id);
  if (!m || m.category === 'Status' || !m.basePower || m.fixedDamage) continue;
  const k = partes(m).join(' · ');
  arq.set(k, [...arq.get(k) ?? [], m]);
}
const claves = [...arq.keys()].sort((a, b) => arq.get(b)!.length - arq.get(a)!.length || a.localeCompare(b));
const varios = claves.filter(k => arq.get(k)!.length > 1), unicos = claves.filter(k => arq.get(k)!.length === 1);
const ancla = (k: string) => '#' + k.toLowerCase().replace(/[^a-z0-9áéíóúñü ]/g, '').trim().replace(/ +/g, '-');
// Variantes: misma firma salvo una cosa (una parte distinta, o una de más o de menos).
const difiere = (a: string, b: string) => {
  const x = a.split(' · '), y = b.split(' · '), sx = new Set(x), sy = new Set(y);
  const solo = [...x.filter(v => !sy.has(v)), ...y.filter(v => !sx.has(v))];
  return solo.length && solo.length <= 2 && Math.abs(x.length - y.length) + (x.length === y.length ? solo.length / 2 : 0) === 1 ? solo : null;
};
let ta = `# Tipos de ataque (generado)\n\n> \`tools/lineas_ataque.ts\`. Reglas en docs/GDD-combate.md §3.3 y §3.6.\n\n`;
ta += `Un **tipo de ataque** es todo lo que define un movimiento salvo su tipo elemental y su potencia: categoría, alcance, forma, `;
ta += `precisión y mecánica. Ascuas, Pistola Agua e Impactrueno son el mismo tipo de ataque. Las **líneas** van dentro de un tipo de `;
ta += `ataque y suben la potencia (Ascuas 40 → Lanzallamas 90). Las **variantes** son tipos de ataque que solo cambian en una cosa `;
ta += `(Rayo → Chispazo: alrededor de ti en vez de a uno).\n\n`;
ta += `${claves.length} tipos de ataque: ${varios.length} con varios movimientos y ${unicos.length} de un solo movimiento.\n\n`;
ta += `| Tipo de ataque | Movimientos | Tipos | Potencias | Líneas |\n|---|---|---|---|---|\n`;
for (const k of varios) {
  const ms = arq.get(k)!, ls = new Set(ms.map(m => lineaAtaque(m.id)).filter(Boolean));
  ta += `| [${k}](${ancla(k)}) | ${ms.length} | ${new Set(ms.map(m => m.type)).size} | ${[...new Set(ms.map(m => m.basePower))].sort((a, b) => a - b).join(', ')} | ${ls.size || ''} |\n`;
}
for (const k of varios) {
  const ms = arq.get(k)!, tipos = [...new Set(ms.map(m => m.type))].sort(), pots = [...new Set(ms.map(m => m.basePower))].sort((a, b) => a - b);
  ta += `\n## ${k}\n\n| Potencia | ${tipos.map(t => TIPO_ES[t]).join(' | ')} |\n|---|${tipos.map(() => '---').join('|')}|\n`;
  for (const p of pots) ta += `| ${p} | ${tipos.map(t => ms.filter(m => m.type === t && m.basePower === p).map(m => lineaAtaque(m.id) ? `**${m.nombre}**` : m.nombre).join(', ')).join(' | ')} |\n`;
  const ls = [...new Set(ms.map(m => lineaAtaque(m.id)).filter((x): x is string => !!x))];
  if (ls.length) ta += `\nLíneas (en negrita): ${ls.map(l => `${l} (${LINEAS_ATAQUE[l].map(id => `${getMove(id)!.nombre} ${getMove(id)!.basePower}`).join(' → ')})`).join('; ')}.\n`;
  const vs = claves.filter(o => o !== k).map(o => ({ o, d: difiere(k, o) })).filter(v => v.d);
  if (vs.length) ta += `\nVariantes: ${vs.map(v => `[${v.o}](${ancla(v.o)}) (${arq.get(v.o)!.map(m => m.nombre).slice(0, 3).join(', ')}${arq.get(v.o)!.length > 3 ? '…' : ''})`).join('; ')}.\n`;
}
ta += `\n## Únicos (un solo movimiento)\n\n| Tipo de ataque | Movimiento |\n|---|---|\n${unicos.map(k => `| ${k} | ${arq.get(k)![0].nombre} (${TIPO_ES[arq.get(k)![0].type]}, ${arq.get(k)![0].basePower}) |`).join('\n')}\n`;
writeFileSync('docs/tipos-ataque.md', ta);
console.log(`${claves.length} tipos de ataque (${varios.length} con varios movimientos).`);
console.log(`${Object.keys(LINEAS_ATAQUE).length} líneas, ${solos.length} sueltos. ${fallos.length ? 'FALLOS:\n' + fallos.join('\n') : 'Todas suben.'}`);
