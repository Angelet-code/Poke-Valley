// Datos de combate (docs/GDD-combate.md): movimientos, qué aprende cada forma y a qué nivel, y la tabla de tipos.
// Salen de Pokémon Showdown (MIT), el que trae el proyecto Pokémon Colleja en vendor/ (ya compilado en dist/), y los
// nombres en español, del i18n de Colleja (PokeAPI). Escribe src/data/gen/combate.json.
//
//   node tools/datos_combate.mjs ["ruta a Pokemon Colleja Simulator"]
//
// Formas: todas las de src/data/pokedex.ts (se leen del propio archivo: dex y nombre). Aprendizaje: los movimientos
// "por nivel" de la generación más reciente que los tenga ("9L12" = nivel 12 en Escarlata/Púrpura); "L0" (al
// evolucionar) cuenta como el nivel de la forma.
import { createRequire } from 'node:module';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const colleja = process.argv[2] ?? 'A:/PROYECTOS/OPENCODE/Pokemon Colleja Simulator';
const sd = join(colleja, 'vendor/pokemon-showdown/dist/data');
const require = createRequire(import.meta.url);
const { Moves } = require(join(sd, 'moves.js'));
const { Learnsets } = require(join(sd, 'learnsets.js'));
const { Pokedex } = require(join(sd, 'pokedex.js'));
const { TypeChart } = require(join(sd, 'typechart.js'));
const es = JSON.parse(readFileSync(join(colleja, 'packages/data/generated/i18n/es.json'), 'utf8'));

// Formas del juego: ['0399', 'Bidoof', 1, ...] en pokedex.ts.
const src = readFileSync(join(raiz, 'src/data/pokedex.ts'), 'utf8');
const formas = [...src.matchAll(/\['(\d{4})', '([^']+)', (\d+), \[/g)].map(m => ({ dex: m[1], nombre: m[2], nv: +m[3] }));
const idDe = n => n.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

const porNum = new Map();
for (const [id, p] of Object.entries(Pokedex)) if (!p.forme && p.num > 0 && !porNum.has(p.num)) porNum.set(p.num, { id, ...p });

const aprende = {}, usados = new Set(), faltan = [];
for (const f of formas) {
  const sp = porNum.get(+f.dex);
  if (!sp) { faltan.push(f.nombre); continue; }
  const ls = Learnsets[sp.id]?.learnset ?? {};
  // Generación más reciente con aprendizaje por nivel para esta especie.
  let gen = 0;
  for (const fuentes of Object.values(ls)) for (const s of fuentes) { const m = /^(\d)L/.exec(s); if (m) gen = Math.max(gen, +m[1]); }
  const lista = [];
  for (const [mov, fuentes] of Object.entries(ls)) {
    for (const s of fuentes) {
      const m = new RegExp(`^${gen}L(\\d+)$`).exec(s);
      if (!m || !Moves[mov]) continue;
      lista.push([Math.max(1, +m[1] === 0 ? f.nv : +m[1]), mov]);
      usados.add(mov);
    }
  }
  lista.sort((a, b) => a[0] - b[0] || a[1].localeCompare(b[1]));
  // Probabilidad de que salga macho (−1 = sin sexo, como Magnemite).
  const macho = sp.gender === 'N' ? -1 : sp.gender === 'M' ? 1 : sp.gender === 'F' ? 0 : sp.genderRatio?.M ?? 0.5;
  aprende[idDe(f.nombre)] = { especie: sp.id, tipos: sp.types, gen, lista, macho, altura: sp.heightm };
}

// Nombres oficiales en español de los movimientos que no están en el i18n de Colleja (solo trae los de Champions).
const ES_MAS = {
  absorb: 'Absorber', acid: 'Ácido', amnesia: 'Amnesia', armthrust: 'Empujón', astonish: 'Impresionar', attackorder: 'Al Ataque',
  autotomize: 'Aligerar', brine: 'Salmuera', bubblebeam: 'Rayo Burbuja', confusion: 'Confusión', defendorder: 'A Defender',
  defensecurl: 'Rizo Defensa', disarmingvoice: 'Voz Cautivadora', doublekick: 'Doble Patada', dragonbreath: 'Dragoaliento',
  dreameater: 'Comesueños', dualchop: 'Golpe Bis', echoedvoice: 'Eco Voz', ember: 'Ascuas', fairywind: 'Viento Feérico',
  falseswipe: 'Falso Tortazo', flamewheel: 'Rueda Fuego', forcepalm: 'Palmeo', furyattack: 'Ataque Furia', furycutter: 'Corte Furia',
  furyswipes: 'Golpes Furia', growl: 'Gruñido', gust: 'Tornado', hail: 'Granizo', harden: 'Fortaleza', headbutt: 'Golpe Cabeza',
  honeclaws: 'Afilagarras', hornattack: 'Cornada', hyperfang: 'Hipercolmillo', incinerate: 'Calcinación', kinesis: 'Kinético',
  leer: 'Malicioso', lick: 'Lengüetazo', magicalleaf: 'Hoja Mágica', megadrain: 'Megaagotar', metalclaw: 'Garra Metal',
  metronome: 'Metrónomo', mimic: 'Mimético', mirrormove: 'Movimiento Espejo', mist: 'Neblina', peck: 'Picotazo', playnice: 'Camaradería',
  poisongas: 'Gas Venenoso', poisonsting: 'Picotazo Veneno', pound: 'Destructor', powdersnow: 'Nieve Polvo', psybeam: 'Psicorrayo',
  psychoshift: 'Psicocambio', razorleaf: 'Hoja Afilada', retaliate: 'Represalia', revenge: 'Desquite', rocksmash: 'Golpe Roca',
  rockthrow: 'Lanzarrocas', rollout: 'Rodar', rototiller: 'Fertilizante', sandattack: 'Ataque Arena', scratch: 'Arañazo', slam: 'Atizar',
  sludge: 'Residuos', smog: 'Polución', smokescreen: 'Pantallahumo', spark: 'Chispa', splash: 'Salpicadura', stomp: 'Pisotón',
  strength: 'Fuerza', supersonic: 'Supersónico', swift: 'Rapidez', tackle: 'Placaje', tailwhip: 'Látigo', takedown: 'Derribo',
  teleport: 'Teletransporte', thundershock: 'Impactrueno', twister: 'Ciclón', vinewhip: 'Látigo Cepa', vitalthrow: 'Tiro Vital',
  watergun: 'Pistola Agua', wingattack: 'Ataque Ala', withdraw: 'Refugio',
};

const flags = o =>Object.keys(o ?? {}).filter(k => o[k]);
const moves = {};
for (const id of [...usados].sort()) {
  const m = Moves[id];
  moves[id] = {
    id, name: m.name, nombre: es.moves?.[id] ?? ES_MAS[id] ?? m.name, num: m.num, type: m.type, category: m.category,
    basePower: m.basePower, accuracy: m.accuracy, pp: m.pp, priority: m.priority, target: m.target, flags: flags(m.flags),
    critRatio: m.critRatio ?? 1, multihit: m.multihit ?? null, drain: m.drain ?? null, recoil: m.recoil ?? null,
    selfSwitch: !!m.selfSwitch, heal: m.heal ?? null,
    boosts: m.boosts ?? null, selfBoosts: m.self?.boosts ?? null, status: m.status ?? null,
    secondary: m.secondary ? { chance: m.secondary.chance ?? 100, status: m.secondary.status ?? null, boosts: m.secondary.boosts ?? null, selfBoosts: m.secondary.self?.boosts ?? null } : null,
    ohko: !!m.ohko, fixedDamage: m.damage ?? null,
  };
}

// damageTaken: 0 normal, 1 débil (×2), 2 resiste (×½), 3 inmune.
const tipos = {};
for (const [def, t] of Object.entries(TypeChart)) {
  const nombre = def[0].toUpperCase() + def.slice(1);
  if (nombre === 'Stellar') continue;
  tipos[nombre] = {};
  for (const [atk, v] of Object.entries(t.damageTaken)) if (/^[A-Z]/.test(atk) && v) tipos[nombre][atk] = [1, 2, 0.5, 0][v];
}

const sinNombre = Object.values(moves).filter(m => m.nombre === m.name).map(m => m.id);
mkdirSync(join(raiz, 'src/data/gen'), { recursive: true });
writeFileSync(join(raiz, 'src/data/gen/combate.json'), JSON.stringify({ moves, aprende, tipos }));
console.log(`${Object.keys(aprende).length} formas, ${Object.keys(moves).length} movimientos (${sinNombre.length} sin nombre en español)`);
if (faltan.length) console.log('Sin datos en Showdown:', faltan.join(', '));
if (sinNombre.length) console.log('Sin nombre en español:', sinNombre.join(', '));
