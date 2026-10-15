// Navegación de los Pokémon que no manejas: rejilla de casillas pisables + A* para rodear edificios, árboles y
// agua. Antes iban en línea recta hacia su meta y se quedaban empujando contra lo que hubiera en medio.
import type { Punto } from '../data/bosque';

export const CELDA = 8;   // px por casilla

export class Rejilla {
  readonly cw: number; readonly ch: number;
  private libre: Uint8Array;

  // `pisable(x, y)`: si un Pokémon cabe con los pies en ese punto (la misma prueba que su colisión).
  constructor(W: number, H: number, private pisable: (x: number, y: number) => boolean) {
    this.cw = Math.ceil(W / CELDA); this.ch = Math.ceil(H / CELDA);
    this.libre = new Uint8Array(this.cw * this.ch);
    // Libre solo si se pisa en toda la casilla (3×3 muestras): así no se cuelan entre dos centros libres los
    // obstáculos finos (un tronco, una piedra pequeña).
    const o = [CELDA / 2, 1, CELDA - 1];
    for (let j = 0; j < this.ch; j++) for (let i = 0; i < this.cw; i++) {
      let ok = true;
      for (let a = 0; a < 3 && ok; a++) for (let b = 0; b < 3 && ok; b++) ok = pisable(i * CELDA + o[a], j * CELDA + o[b]);
      this.libre[j * this.cw + i] = ok ? 1 : 0;
    }
  }

  // Se puede ir de a a b en línea recta (muestras cada 2 px).
  directo(a: Punto, b: Punto): boolean {
    const d = Math.hypot(b.x - a.x, b.y - a.y), n = Math.ceil(d / 2);
    for (let k = 1; k <= n; k++) { const t = k / n; if (!this.pisable(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t)) return false; }
    return true;
  }
  libreEn(x: number, y: number): boolean {
    const i = Math.floor(x / CELDA), j = Math.floor(y / CELDA);
    return i >= 0 && j >= 0 && i < this.cw && j < this.ch && this.libre[j * this.cw + i] === 1;
  }

  // Camino de a a b (puntos intermedios, el último es b o la casilla libre más cercana a b a la que se llega).
  // null si no hay forma de acercarse. `max`: casillas exploradas como mucho.
  ruta(a: Punto, b: Punto, max = 6000): Punto[] | null {
    const cw = this.cw, ch = this.ch, idx = (x: number, y: number) => Math.min(ch - 1, Math.max(0, Math.floor(y / CELDA))) * cw + Math.min(cw - 1, Math.max(0, Math.floor(x / CELDA)));
    const centro = (c: number): Punto => ({ x: (c % cw + 0.5) * CELDA, y: (((c / cw) | 0) + 0.5) * CELDA });
    let ini = idx(a.x, a.y), entrada: Punto | null = null;
    const fin = idx(b.x, b.y);
    if (ini === fin) return [b];
    // Pegado a una pared, su casilla no está libre del todo y salir de ella hacia un vecino podría cruzar el borde:
    // empezar por la casilla libre más cercana que se vea en línea recta.
    if (!this.libre[ini] || !this.directo(a, centro(ini))) {
      let mejor = -1, dm = Infinity;
      const ix = ini % cw, iy = (ini / cw) | 0;
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
        const nx = ix + dx, ny = iy + dy;
        if (nx < 0 || ny < 0 || nx >= cw || ny >= ch || !this.libre[ny * cw + nx]) continue;
        const c = ny * cw + nx, p = centro(c), d = Math.hypot(p.x - a.x, p.y - a.y);
        if (d < dm && this.directo(a, p)) { dm = d; mejor = c; }
      }
      if (mejor >= 0) { ini = mejor; entrada = centro(mejor); }
    }
    const fx = fin % cw, fy = (fin / cw) | 0;
    const h = (c: number) => { const dx = Math.abs(c % cw - fx), dy = Math.abs(((c / cw) | 0) - fy); return dx + dy - 0.59 * Math.min(dx, dy); };
    const g = new Map<number, number>([[ini, 0]]), de = new Map<number, number>(), cerrado = new Set<number>();
    const heap = new Monticulo(); heap.push(ini, h(ini));
    let mejor = ini, mejorH = h(ini), n = 0;
    while (heap.size && n++ < max) {
      const c = heap.pop();
      if (cerrado.has(c)) continue;
      cerrado.add(c);
      const hc = h(c);
      if (hc < mejorH) { mejor = c; mejorH = hc; }
      if (c === fin) break;
      const cx = c % cw, cy = (c / cw) | 0, gc = g.get(c)!;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const nx = cx + dx, ny = cy + dy;
        if (nx < 0 || ny < 0 || nx >= cw || ny >= ch) continue;
        const v = ny * cw + nx;
        if (!this.libre[v] || cerrado.has(v)) continue;
        if (dx && dy && (!this.libre[cy * cw + nx] || !this.libre[ny * cw + cx])) continue;   // sin cortar esquinas
        const gv = gc + (dx && dy ? 1.41 : 1);
        if (gv >= (g.get(v) ?? Infinity)) continue;
        g.set(v, gv); de.set(v, c); heap.push(v, gv + h(v));
      }
    }
    if (mejor === ini && !entrada) return null;
    const celdas: number[] = [];
    for (let c: number | undefined = mejor; c !== undefined && c !== ini; c = de.get(c)) celdas.push(c);
    celdas.reverse();
    const pts: Punto[] = celdas.map(centro);
    if (entrada) pts.unshift(entrada);
    if (mejor === fin) { if (celdas.length) pts[pts.length - 1] = b; else pts.push(b); }
    // Suavizar: saltarse los puntos que se ven en línea recta.
    const out: Punto[] = [];
    let desde = a, k = 0;
    while (k < pts.length) {
      let lejos = k;
      for (let m = pts.length - 1; m > k; m--) if (this.directo(desde, pts[m])) { lejos = m; break; }
      out.push(pts[lejos]); desde = pts[lejos]; k = lejos + 1;
    }
    return out;
  }
}

// Montículo binario mínimo de casillas por prioridad.
class Monticulo {
  private c: number[] = []; private p: number[] = [];
  get size(): number { return this.c.length; }
  push(c: number, p: number): void {
    const a = this.c, b = this.p; let i = a.length; a.push(c); b.push(p);
    while (i > 0) { const q = (i - 1) >> 1; if (b[q] <= b[i]) break; [a[q], a[i]] = [a[i], a[q]]; [b[q], b[i]] = [b[i], b[q]]; i = q; }
  }
  pop(): number {
    const a = this.c, b = this.p, top = a[0], lc = a.pop()!, lp = b.pop()!;
    if (a.length) {
      a[0] = lc; b[0] = lp; let i = 0;
      for (;;) {
        const l = 2 * i + 1, r = l + 1; let m = i;
        if (l < a.length && b[l] < b[m]) m = l;
        if (r < a.length && b[r] < b[m]) m = r;
        if (m === i) break;
        [a[m], a[i]] = [a[i], a[m]]; [b[m], b[i]] = [b[i], b[m]]; i = m;
      }
    }
    return top;
  }
}
