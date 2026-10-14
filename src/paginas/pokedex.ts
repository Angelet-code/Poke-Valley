// Página de consulta http://127.0.0.1:5174/pokedex.html (GDD-pueblo §10): las líneas de data/pokedex.ts
// con su perfil, sus stats a nivel 5 y 100 y una gráfica de cómo rinden frente a la media en cada
// nivel. Lee los datos del juego: si se cambian allí, la página cambia sola.
import {
  LINEAS, NOMBRE_GRUPO, NOMBRE_PERFIL, NOMBRE_STAT, NOMBRE_TIPO, STATS, perfil, rendimiento, stats, total,
  type Linea, type Perfil, type Tipo,
} from '../data/pokedex';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const NIVELES = Array.from({ length: 100 }, (_, i) => i + 1);
const lineas = Object.values(LINEAS);
const mediana = (xs: number[]) => { const s = [...xs].sort((a, b) => a - b), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const MED = NIVELES.map(n => mediana(lineas.map(l => total(stats(l, n)))));
const RATIO: Record<string, number[]> = Object.fromEntries(lineas.map(l => [l.id, NIVELES.map((n, i) => total(stats(l, n)) / MED[i])]));
const MARCA: Record<Perfil, string> = { bueno: '▲', precoz: '↘', tardio: '↗', flojo: '▼', normal: '●' };
const ORDEN_PERFIL: Perfil[] = ['bueno', 'precoz', 'tardio', 'flojo', 'normal'];
const SERIES = ['--s1', '--s2', '--s3', '--s4'];
const css = (v: string) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();

// Selección para la gráfica: cada línea conserva su color mientras está elegida (máx. 4).
const elegidas: { id: string; serie: string }[] = [];
function alternar(id: string): void {
  const i = elegidas.findIndex(e => e.id === id);
  if (i >= 0) elegidas.splice(i, 1);
  else {
    if (elegidas.length >= SERIES.length) elegidas.shift();
    const libre = SERIES.find(s => !elegidas.some(e => e.serie === s))!;
    elegidas.push({ id, serie: libre });
  }
  pintar();
}

// ---- Filtros ----
const fTipo = $<HTMLSelectElement>('fTipo'), fPerfil = $<HTMLSelectElement>('fPerfil'), fOrden = $<HTMLSelectElement>('fOrden');
const tipos = [...new Set(lineas.map(l => l.tipo))];
for (const t of tipos) fTipo.add(new Option(NOMBRE_TIPO[t], t));
for (const p of ORDEN_PERFIL) fPerfil.add(new Option(`${MARCA[p]} ${NOMBRE_PERFIL[p]}`, p));
for (const s of [fTipo, fPerfil, fOrden]) s.addEventListener('change', pintar);
const visibles = (): Linea[] => {
  const ls = lineas.filter(l => (!fTipo.value || l.tipo === fTipo.value) && (!fPerfil.value || perfil(l.id) === fPerfil.value));
  const r = (l: Linea) => rendimiento(l.id), o = fOrden.value;
  if (o === 'pronto') ls.sort((a, b) => r(b).pronto - r(a).pronto);
  else if (o === 'tarde') ls.sort((a, b) => r(b).tarde - r(a).tarde);
  else if (o === 'cambio') ls.sort((a, b) => (r(b).tarde - r(b).pronto) - (r(a).tarde - r(a).pronto));
  return ls;
};

// ---- Caras: primer fotograma de Idle (tamaños en assets/sprites/pokemon/indice.json) ----
let indice: Record<string, Record<string, [number, number]>> = {};
const imagenes = new Map<string, HTMLImageElement>();
function cara(dex: string): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = c.height = 32;
  const fr = indice[dex]?.Idle;
  if (!fr) return c;
  let img = imagenes.get(dex);
  if (!img) { img = new Image(); img.src = `/assets/sprites/pokemon/${dex}/Idle-Anim.png`; imagenes.set(dex, img); }
  const dibujar = () => {
    const ctx = c.getContext('2d')!, [w, h] = fr, pie = Math.round(h * 0.72);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(img!, 0, 0, w, h, 16 - w / 2, 28 - pie, w, h);
  };
  if (img.complete && img.naturalWidth) dibujar(); else img.addEventListener('load', dibujar, { once: true });
  return c;
}

// ---- Tabla ----
const cab = $<HTMLTableRowElement>('cabecera');
cab.innerHTML = '<th>Pokémon</th><th>Perfil</th><th>Exp.</th>'
  + [0, 1].map(k => STATS.map((s, i) => `<th class="num${i === 0 ? ' sep' : ''}" title="${NOMBRE_STAT[s]}">${NOMBRE_STAT[s].slice(0, 3)}</th>`).join('')).join('');
// Fondo de cada celda: más intenso cuanto mejor es el valor en su columna (un solo tono).
const MAX5 = Object.fromEntries(STATS.map(s => [s, Math.max(...lineas.map(l => stats(l, 5)[s]))]));
const MAX100 = Object.fromEntries(STATS.map(s => [s, Math.max(...lineas.map(l => stats(l, 100)[s]))]));
const celda = (v: number, max: number, sep: boolean) =>
  `<td class="num v${sep ? ' sep' : ''}" style="background: rgba(var(--celda), ${(0.04 + 0.3 * (v / max) ** 1.5).toFixed(3)})">${v}</td>`;

function pintarTabla(ls: Linea[]): void {
  const tb = $<HTMLTableSectionElement>('filas');
  tb.innerHTML = '';
  let tipo: Tipo | '' = '';
  for (const l of ls) {
    if (fOrden.value === 'tipo' && l.tipo !== tipo) {
      tipo = l.tipo;
      tb.insertAdjacentHTML('beforeend', `<tr class="tipo"><td colspan="13">${NOMBRE_TIPO[tipo]}</td></tr>`);
    }
    const p = perfil(l.id), s5 = stats(l, 5), s100 = stats(l, 100), sel = elegidas.find(e => e.id === l.id);
    const cadena = l.formas.slice(1).map(f => `${f.nombre} ${f.nv}${f.como ? '*' : ''}`).join(' → ');
    const tr = document.createElement('tr');
    tr.className = 'linea' + (sel ? ' sel' : '');
    tr.title = l.formas.filter(f => f.como).map(f => `* ${f.nombre}: en los juegos, ${f.como}`).join('\n');
    tr.innerHTML = `<td><div class="nombre"><span class="hueco"></span><div><div>${sel ? `<span class="marca" style="background: var(${sel.serie})"></span>` : ''}<b>${l.formas[0].nombre}</b>
        <span class="cadena">${l.tipos.map(t => NOMBRE_TIPO[t]).join('/')}</span></div><div class="cadena">${cadena || 'No evoluciona'}</div></div></div></td>
      <td class="perfil">${MARCA[p]} ${NOMBRE_PERFIL[p]}</td><td>${NOMBRE_GRUPO[l.exp]}</td>`
      + STATS.map((s, i) => celda(s5[s], MAX5[s], i === 0)).join('') + STATS.map((s, i) => celda(s100[s], MAX100[s], i === 0)).join('');
    tr.querySelector('.hueco')!.replaceWith(cara(l.formas[l.formas.length - 1].dex));
    tr.addEventListener('click', () => alternar(l.id));
    tb.append(tr);
  }
  $('cuenta').textContent = `${ls.length} de ${lineas.length} líneas`;
}

// ---- Gráfica: una línea por Pokémon (las visibles en gris, las elegidas en color) ----
const NS = 'http://www.w3.org/2000/svg';
const caja = $('grafica'), tip = $('tip');
function pintarGrafica(ls: Linea[]): void {
  caja.querySelector('svg')?.remove();
  const W = Math.max(320, caja.clientWidth), H = Math.round(Math.min(360, Math.max(220, W * 0.36)));
  const m = { l: 36, r: 92, t: 10, b: 28 }, iw = W - m.l - m.r, ih = H - m.t - m.b;
  const todos = lineas.flatMap(l => RATIO[l.id]), y0 = Math.floor(Math.min(...todos) * 10) / 10, y1 = Math.ceil(Math.max(...todos) * 10) / 10;
  const X = (n: number) => m.l + (n - 1) / 99 * iw, Y = (v: number) => m.t + (1 - (v - y0) / (y1 - y0)) * ih;
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  const el = (tag: string, at: Record<string, string | number>, padre: Element = svg) => {
    const e = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(at)) e.setAttribute(k, String(v));
    padre.append(e);
    return e;
  };
  // Rejilla y ejes (recesivos).
  for (let v = Math.ceil(y0 * 5) / 5; v <= y1 + 1e-9; v += 0.2) {
    el('line', { x1: m.l, x2: m.l + iw, y1: Y(v), y2: Y(v), stroke: css('--rejilla'), 'stroke-width': 1 });
    el('text', { x: m.l - 6, y: Y(v) + 4, 'text-anchor': 'end', 'font-size': 11, fill: css('--tinta3') }).textContent = v.toFixed(1);
  }
  for (const n of [1, 20, 40, 60, 80, 100]) el('text', { x: X(n), y: H - 8, 'text-anchor': 'middle', 'font-size': 11, fill: css('--tinta3') }).textContent = `Nv ${n}`;
  const camino = (id: string) => RATIO[id].map((v, i) => `${i ? 'L' : 'M'}${X(i + 1).toFixed(1)},${Y(v).toFixed(1)}`).join('');
  // Contexto: las visibles no elegidas, finas y grises.
  for (const l of ls) if (!elegidas.some(e => e.id === l.id)) el('path', { d: camino(l.id), fill: 'none', stroke: css('--contexto'), 'stroke-width': 1 });
  // Media.
  el('line', { x1: m.l, x2: m.l + iw, y1: Y(1), y2: Y(1), stroke: css('--media'), 'stroke-width': 1.5, 'stroke-dasharray': '4 4' });
  el('text', { x: m.l + iw + 6, y: Y(1) + 4, 'font-size': 11, fill: css('--tinta3') }).textContent = 'media';
  // Elegidas: 2 px, con su nombre al final (separados si chocan).
  const finales = elegidas.map(e => ({ ...e, y: Y(RATIO[e.id][99]) })).sort((a, b) => a.y - b.y);
  for (let i = 1; i < finales.length; i++) if (finales[i].y - finales[i - 1].y < 13) finales[i].y = finales[i - 1].y + 13;
  for (const e of elegidas) {
    el('path', { d: camino(e.id), fill: 'none', stroke: css(e.serie), 'stroke-width': 2, 'stroke-linejoin': 'round' });
    const f = finales.find(q => q.id === e.id)!;
    el('text', { x: m.l + iw + 6, y: f.y + 4, 'font-size': 12, fill: css('--tinta'), 'font-weight': 600 }).textContent = LINEAS[e.id].formas[0].nombre;
  }
  // Capa de hover: línea vertical y tooltip con el nivel y los valores de las elegidas.
  const guia = el('line', { y1: m.t, y2: m.t + ih, stroke: css('--tinta3'), 'stroke-width': 1, visibility: 'hidden' });
  const puntos = elegidas.map(e => el('circle', { r: 4, fill: css(e.serie), stroke: css('--panel'), 'stroke-width': 2, visibility: 'hidden' }));
  const zona = el('rect', { x: m.l, y: m.t, width: iw, height: ih, fill: 'transparent' });
  const mover = (px: number) => {
    const n = Math.min(100, Math.max(1, Math.round((px - m.l) / iw * 99) + 1)), x = X(n);
    guia.setAttribute('x1', String(x)); guia.setAttribute('x2', String(x)); guia.setAttribute('visibility', 'visible');
    elegidas.forEach((e, i) => { puntos[i].setAttribute('cx', String(x)); puntos[i].setAttribute('cy', String(Y(RATIO[e.id][n - 1]))); puntos[i].setAttribute('visibility', 'visible'); });
    const filas = elegidas.map(e => {
      const l = LINEAS[e.id], f = l.formas.filter(q => q.nv <= n).pop()!;
      return `<div class="fila"><span><i style="background: var(${e.serie})"></i>${f.nombre}</span><span>${total(stats(l, n))} · ${RATIO[e.id][n - 1].toFixed(2)}</span></div>`;
    }).join('');
    tip.innerHTML = `<b>Nivel ${n}</b>${filas || '<div>Elige filas de la tabla</div>'}<div class="fila" style="color: var(--tinta3)"><span>media</span><span>${Math.round(MED[n - 1])}</span></div>`;
    tip.style.display = 'block';
    const r = caja.getBoundingClientRect(), k = r.width / W, tx = x * k + 12;
    tip.style.left = `${Math.min(tx, r.width - tip.offsetWidth - 4)}px`;
    tip.style.top = `${m.t * k + 4}px`;
  };
  zona.addEventListener('pointermove', ev => { const r = svg.getBoundingClientRect(); mover((ev.clientX - r.left) * W / r.width); });
  zona.addEventListener('pointerleave', () => { tip.style.display = 'none'; guia.setAttribute('visibility', 'hidden'); puntos.forEach(p => p.setAttribute('visibility', 'hidden')); });
  caja.prepend(svg);
}

function pintarLeyenda(): void {
  const ley = $('leyenda');
  ley.innerHTML = elegidas.length ? '' : '<span>Sin elegir: haz clic en filas de la tabla.</span>';
  for (const e of elegidas) {
    const s = document.createElement('span');
    s.innerHTML = `<i style="background: var(${e.serie})"></i>${LINEAS[e.id].formas[0].nombre} <span class="quitar" title="Quitar">✕</span>`;
    s.querySelector('.quitar')!.addEventListener('click', () => alternar(e.id));
    ley.append(s);
  }
}

function pintar(): void {
  const ls = visibles();
  pintarTabla(ls);
  pintarGrafica(ls);
  pintarLeyenda();
}

// Arranque: tres ejemplos de perfiles distintos ya elegidos.
fetch('/assets/sprites/pokemon/indice.json').then(r => r.json()).catch(() => ({})).then(j => {
  indice = j;
  for (const id of ['caterpie', 'magikarp', 'growlithe']) if (LINEAS[id]) elegidas.push({ id, serie: SERIES[elegidas.length] });
  pintar();
});
let espera = 0;
addEventListener('resize', () => { clearTimeout(espera); espera = window.setTimeout(() => pintarGrafica(visibles()), 120); });
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', pintar);
