// Estudio de balanceo de los movimientos del modo aventura (docs/GDD-combate.md §3.2). Lee src/data/gen/combate.json,
// clasifica cada movimiento que se aprende por nivel con el modelo propuesto (lanzamiento, forma, enfriamiento) y
// compara la potencia por segundo de ahora con la propuesta. Escribe docs/balance-movimientos.md.
//   node tools/balance_movimientos.mjs
import fs from 'node:fs';

const D = JSON.parse(fs.readFileSync('src/data/gen/combate.json', 'utf8'));
const GCD = 1.1;
const R_INST = 40 / GCD;          // potencia/s "gratis" de un instantáneo (el relleno: Ascuas, Placaje)
const R_CAST = R_INST * 1.25;     // quieto lanzando rinde un 25 % más
const R_CD = 6;                   // cada segundo de enfriamiento paga 6 de potencia de más
const CAST_MAX = 3;
const r1 = x => Math.round(x * 10) / 10;

// Enfriamiento de ahora (src/combate/reglas.ts).
function cdAhora(m) {
  if (m.category === 'Status') return m.status ? 12 : m.heal ? 14 : 8;
  const hits = Array.isArray(m.multihit) ? (m.multihit[0] + m.multihit[1]) / 2 : m.multihit ?? 1;
  const p = m.basePower * hits + (m.flags.includes('charge') || m.flags.includes('recharge') ? 40 : 0);
  return Math.max(GCD, r1(1.1 + Math.max(0, p - 40) / 16));
}

// Potencia "efectiva" de un golpe: golpes medios × precisión, con lo que vale lo que hace además.
function potEf(m) {
  if (m.fixedDamage) return 45;
  const hits = Array.isArray(m.multihit) ? (m.multihit[0] + m.multihit[1]) / 2 : m.multihit ?? 1;
  let p = m.basePower * hits * (m.accuracy === true ? 1 : m.accuracy / 100);
  if (m.drain) p *= 1.15;                                          // cura
  if (m.recoil) p *= 0.85;                                         // se hace daño
  const s = m.secondary;
  if (s?.selfBoosts && Object.values(s.selfBoosts).some(v => v < 0)) p *= 0.85; // Fuerza Bruta, Sofoco
  if (s && (s.status || s.boosts)) p += s.chance / 100 * 25;        // quemar, bajar stats…
  if (m.critRatio > 1) p *= 1.06;
  return p;
}

const FORMA = m => {
  if (['allAdjacentFoes'].includes(m.target)) return m.flags.includes('wind') ? 'cono' : 'zona';
  if (['allAdjacent'].includes(m.target) || m.flags.includes('sound') && m.category !== 'Status') return 'alrededor';
  if (m.target === 'foeSide') return 'trampa';
  if (m.target === 'all') return 'global';
  if (['self', 'allySide', 'allies', 'allyTeam', 'adjacentAllyOrSelf'].includes(m.target)) return 'propio';
  return 'objetivo';
};

const DESAPARECE = new Set(['fly', 'dig', 'dive', 'bounce', 'phantomforce', 'shadowforce']);
const ESCUDO = new Set(['protect', 'detect', 'endure', 'kingsshield', 'spikyshield', 'banefulbunker', 'obstruct', 'silktrap', 'burningbulwark']);

// Perfil propuesto: { lanza, t (lanzamiento), cd, extra }.
function perfil(m) {
  const contacto = m.flags.includes('contact'), x = [];
  if (m.category === 'Status') {
    if (ESCUDO.has(m.id)) return { lanza: 'instant', t: 0, cd: 15, extra: 'escudo 1,5 s' };
    if (m.id === 'teleport') return { lanza: 'instant', t: 0, cd: 12, extra: 'salto 120 px' };
    if (m.boosts?.spe > 0 || m.selfBoosts?.spe > 0) return { lanza: 'instant', t: 0, cd: 20, extra: 'velocidad + celeridad' };
    if (m.status === 'slp') return { lanza: 'cast', t: 1.5, cd: 20, extra: 'control' };
    if (m.status) return { lanza: 'instant', t: 0, cd: 12, extra: 'estado' };
    if (m.heal) return { lanza: 'cast', t: 1.5, cd: 20, extra: 'cura' };
    if (FORMA(m) === 'global') return { lanza: 'cast', t: 1.5, cd: 40, extra: 'clima/campo' };
    return { lanza: 'instant', t: 0, cd: m.target === 'self' ? 20 : 10, extra: m.target === 'self' ? 'bufo' : 'debufo' };
  }
  const p = potEf(m);
  let lanza, t;
  if (DESAPARECE.has(m.id)) { lanza = 'desaparece'; t = 1.5; x.push('invulnerable'); }
  else if (m.flags.includes('charge')) { lanza = 'cast'; t = Math.min(CAST_MAX, Math.max(2.5, r1(p / R_CAST))); }
  else if (contacto || m.flags.includes('recharge') || FORMA(m) === 'alrededor' || m.priority > 0 || m.secondary?.chance >= 30 && !m.secondary.status && !m.secondary.boosts) {
    lanza = 'instant'; t = 0;                       // cuerpo a cuerpo, prioridad o retroceso: instantáneos
  } else if (p <= R_INST * GCD * 1.15) { lanza = 'instant'; t = 0; }
  else { lanza = m.multihit || m.drain ? 'canal' : 'cast'; t = Math.min(CAST_MAX, Math.max(1.5, r1(p / R_CAST))); }
  if (m.priority > 0 && contacto) x.push('carga hacia el objetivo');
  if (m.secondary?.chance && !m.secondary.status && !m.secondary.boosts && !m.secondary.selfBoosts) x.push('interrumpe');
  if (m.selfSwitch) x.push('salto atrás');
  if (m.flags.includes('recharge')) x.push('agotado 2 s');
  const T = Math.max(GCD, t) + (m.flags.includes('recharge') ? 2 : 0);
  const gratis = (t > 0 ? R_CAST : R_INST) * T;
  let cd = Math.max(GCD, r1((p - gratis) / R_CD));
  if (m.priority > 0) cd = Math.max(cd, 6);
  if (lanza === 'desaparece') cd = Math.max(cd, 10);
  return { lanza, t, cd, extra: x.join(', '), p, T };
}

const ids = new Set();
for (const a of Object.values(D.aprende)) for (const [, id] of a.lista) ids.add(id);
const movs = [...ids].map(i => D.moves[i]).filter(Boolean).sort((a, b) => (a.category === 'Status') - (b.category === 'Status') || b.basePower - a.basePower);

// Potencia por segundo de la "rotación": relleno a 36,4/s más lo que añade este movimiento cada vez que vuelve.
const dpsRot = (p, T, cd) => R_INST + Math.max(0, p - R_INST * T) / Math.max(cd, T);
const filas = [], resumen = { ahora: [], propuesta: [] };
for (const m of movs) {
  const f = perfil(m);
  if (m.category === 'Status') { filas.push([m.nombre, m.type, 'Estado', '', '', cdAhora(m), f.lanza, f.t || '', f.cd, FORMA(m), '', '', f.extra]); continue; }
  const p = potEf(m), ahora = dpsRot(p, GCD, cdAhora(m)), prop = dpsRot(p, f.T, f.cd);
  resumen.ahora.push(ahora); resumen.propuesta.push(prop);
  filas.push([m.nombre, m.type, m.category === 'Physical' ? 'Fís' : 'Esp', m.basePower, Math.round(p), cdAhora(m), f.lanza, f.t || '', f.cd, FORMA(m), r1(ahora), r1(prop), f.extra]);
}
const est = a => { const s = [...a].sort((x, y) => x - y); return `mín ${r1(s[0])} · mediana ${r1(s[s.length >> 1])} · máx ${r1(s.at(-1))}`; };
const cuenta = k => movs.reduce((n, m) => (n[perfil(m)[k] || FORMA(m)] = (n[perfil(m)[k] || FORMA(m)] || 0) + 1, n), {});
const formas = movs.reduce((n, m) => (n[FORMA(m)] = (n[FORMA(m)] || 0) + 1, n), {});

let md = `# Balance de movimientos (generado)\n\n> \`node tools/balance_movimientos.mjs\`. Modelo en docs/GDD-combate.md §3.2. No editar a mano.\n\n`;
md += `${movs.length} movimientos que se aprenden por nivel.\n\n`;
md += `- Lanzamiento: ${JSON.stringify(cuenta('lanza'))}\n- Forma: ${JSON.stringify(formas)}\n`;
md += `- Potencia/s de rotación (relleno + este movimiento cada vez que vuelve), **ahora**: ${est(resumen.ahora)}\n`;
md += `- **Propuesta**: ${est(resumen.propuesta)}\n\n`;
md += `| Movimiento | Tipo | Cat | Pot | Pot ef | CD ahora | Lanza | Tiempo | CD nuevo | Forma | Pot/s ahora | Pot/s nueva | Extra |\n|---|---|---|---|---|---|---|---|---|---|---|---|---|\n`;
for (const f of filas) md += `| ${f.join(' | ')} |\n`;
fs.writeFileSync('docs/balance-movimientos.md', md);
console.log(md.split('\n').slice(0, 10).join('\n'));
for (const id of ['ember', 'flamethrower', 'fireblast', 'tackle', 'firepunch', 'earthquake', 'heatwave', 'hydropump', 'solarbeam', 'hyperbeam', 'quickattack', 'bite', 'gigadrain', 'razorleaf'])
  if (D.moves[id]) { const m = D.moves[id], f = perfil(m); console.log(m.nombre.padEnd(14), 'cd ahora', cdAhora(m), '→', f.lanza, f.t, 'cd', f.cd, FORMA(m), 'pot/s', r1(dpsRot(potEf(m), GCD, cdAhora(m))), '→', r1(dpsRot(potEf(m), f.T, f.cd))); }
