// Simulación pura del valle (sin Phaser): reloj, energía, inventario, recolectables en el suelo,
// plantas de bayas, caja de envío y guardado. Las escenas solo dibujan este estado y le envían
// comandos (GDD §16). Todo lo que cambia el estado pasa por aquí.

import { APARICIONES, BAYAS_SALVAJES, ITEMS } from '../data/items';
import { rng } from '../util';

export const T = 24;
export const MIN_DIA = 6 * 60;          // despertar a las 6:00
export const MIN_DESMAYO = 26 * 60;     // a las 2:00 el Pokémon se desmaya
export const SEG_POR_MINUTO = 0.7;      // 1 minuto de juego = 0,7 s reales
export const ENERGIA_MAX = 100;
export const COSTE_LATIGO = 2, COSTE_ARAR = 3;
export const MAX_SUELO = 14, APARICIONES_DIA = 6, SLOTS = 12, APILA = 99;
export const PLANTAS_SALVAJES = 10;
export const PROB_LLUVIA = 0.3;

export type Fase = 0 | 1 | 2 | 3 | 4 | 5; // 0 nada, 1 semilla, 2 brote, 3 alta, 4 flor, 5 bayas
export interface Slot { id: string; n: number }
export interface ItemSuelo { uid: number; id: string; tx: number; ty: number }
export interface Planta { uid: number; baya: string; fase: Fase; tx: number; ty: number; salvaje: boolean }
export interface Casilla { tx: number; ty: number }

export interface Estado {
  version: 1;
  semilla: number;
  dia: number;
  minuto: number;             // minutos desde las 0:00 del día (360..1560)
  energia: number;
  dinero: number;
  inventario: (Slot | null)[];
  caja: Slot[];               // lo que Pelipper se lleva por la noche
  suelo: ItemSuelo[];
  plantas: Planta[];
  aradas: string[];           // "tx,ty"
  regadas: string[];          // casillas regadas hoy (la lluvia las riega todas)
  lluvia: boolean;            // ¿llueve hoy?
  uid: number;
  ultimoEnvio: number;        // Pokédólares ganados la última noche (para el resumen)
}

export type Evento =
  | { tipo: 'recogido'; id: string; n: number }
  | { tipo: 'inventarioLleno' }
  | { tipo: 'sinEnergia' }
  | { tipo: 'cosecha'; baya: string; n: number }
  | { tipo: 'arado'; tx: number; ty: number }
  | { tipo: 'plantado'; baya: string }
  | { tipo: 'enviado'; id: string; n: number }
  | { tipo: 'regado'; casillas: string[] }
  | { tipo: 'nuevoDia'; dia: number; ingresos: number; desmayo: boolean; lluvia: boolean };

const CLAVE_GUARDADO = 'pokemon-valley/partida';
const clave = (tx: number, ty: number) => `${tx},${ty}`;

export class World {
  estado: Estado;
  // Casillas donde pueden aparecer cosas (césped libre, lejos de agua, camino, árboles y edificios).
  // Las calcula la escena a partir del terreno y se pasan al crear el mundo.
  private candidatos: Casilla[] = [];
  private rnd: () => number;
  private acumulado = 0;

  constructor(estado: Estado, candidatos: Casilla[]) {
    this.estado = estado;
    this.candidatos = candidatos;
    this.rnd = rng(estado.semilla + estado.dia * 7919);
  }

  // ---- Partida nueva / guardado ----
  static nueva(candidatos: Casilla[], objetosMapa: { id: string; tx: number; ty: number }[], semilla = Date.now() % 1e9): World {
    const e: Estado = {
      version: 1, semilla, dia: 1, minuto: MIN_DIA, energia: ENERGIA_MAX, dinero: 0,
      inventario: Array.from({ length: SLOTS }, () => null), caja: [], suelo: [], plantas: [], aradas: [], regadas: [], lluvia: false, uid: 1, ultimoEnvio: 0,
    };
    const w = new World(e, candidatos);
    // Los items que trae el mapa pasan a ser recolectables del suelo.
    for (const o of objetosMapa) if (ITEMS[o.id]) w.ponerEnSuelo(o.id, o.tx, o.ty);
    w.crearPlantasSalvajes();
    w.aparecerRecolectables(APARICIONES_DIA + 2);
    return w;
  }

  static cargar(candidatos: Casilla[]): World | null {
    try {
      const txt = localStorage.getItem(CLAVE_GUARDADO);
      if (!txt) return null;
      const e = JSON.parse(txt) as Estado;
      if (e.version !== 1) return null;
      e.regadas ??= []; e.lluvia ??= false; // partidas de antes de la lluvia
      return new World(e, candidatos);
    } catch { return null; }
  }

  static hayPartida(): boolean { return !!localStorage.getItem(CLAVE_GUARDADO); }
  static borrarPartida(): void { localStorage.removeItem(CLAVE_GUARDADO); }

  guardar(): void { localStorage.setItem(CLAVE_GUARDADO, JSON.stringify(this.estado)); }
  exportar(): string { return JSON.stringify(this.estado, null, 1); }

  // ---- Reloj ----
  // Avanza el tiempo; devuelve los eventos que ocurran (el desmayo de las 2:00).
  tick(dtSeg: number): Evento[] {
    this.acumulado += dtSeg;
    while (this.acumulado >= SEG_POR_MINUTO) { this.acumulado -= SEG_POR_MINUTO; this.estado.minuto++; }
    if (this.estado.minuto >= MIN_DESMAYO) return [this.dormir(true)];
    return [];
  }

  get hora(): string {
    const m = this.estado.minuto % (24 * 60);
    return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`;
  }

  // ---- Inventario ----
  anadir(id: string, n = 1): boolean {
    const inv = this.estado.inventario;
    let s = inv.find(x => x && x.id === id && x.n < APILA);
    if (!s) { const i = inv.indexOf(null); if (i < 0) return false; s = { id, n: 0 }; inv[i] = s; }
    s.n = Math.min(APILA, s.n + n);
    return true;
  }
  quitar(slot: number, n = 1): Slot | null {
    const s = this.estado.inventario[slot];
    if (!s) return null;
    s.n -= n;
    if (s.n <= 0) this.estado.inventario[slot] = null;
    return s;
  }

  // ---- Recolección ----
  ponerEnSuelo(id: string, tx: number, ty: number): void {
    this.estado.suelo.push({ uid: this.estado.uid++, id, tx, ty });
  }
  recoger(uid: number): Evento[] {
    const i = this.estado.suelo.findIndex(s => s.uid === uid);
    if (i < 0) return [];
    const it = this.estado.suelo[i];
    if (!this.anadir(it.id)) return [{ tipo: 'inventarioLleno' }];
    this.estado.suelo.splice(i, 1);
    return [{ tipo: 'recogido', id: it.id, n: 1 }];
  }

  ocupada(tx: number, ty: number): boolean {
    return this.estado.suelo.some(s => s.tx === tx && s.ty === ty) || this.estado.plantas.some(p => p.tx === tx && p.ty === ty);
  }
  private casillaLibre(): Casilla | null {
    for (let i = 0; i < 40; i++) {
      const c = this.candidatos[Math.floor(this.rnd() * this.candidatos.length)];
      if (c && !this.ocupada(c.tx, c.ty) && !this.estado.aradas.includes(clave(c.tx, c.ty))) return c;
    }
    return null;
  }
  private aparecerRecolectables(n: number): void {
    const total = APARICIONES.reduce((a, [, p]) => a + p, 0);
    for (let k = 0; k < n && this.estado.suelo.length < MAX_SUELO; k++) {
      const c = this.casillaLibre(); if (!c) break;
      let r = this.rnd() * total, id = APARICIONES[0][0];
      for (const [i, p] of APARICIONES) { if ((r -= p) <= 0) { id = i; break; } }
      this.ponerEnSuelo(id, c.tx, c.ty);
    }
  }
  private crearPlantasSalvajes(): void {
    for (let k = 0; k < PLANTAS_SALVAJES; k++) {
      const c = this.casillaLibre(); if (!c) break;
      const baya = BAYAS_SALVAJES[Math.floor(this.rnd() * BAYAS_SALVAJES.length)];
      const fase = (this.rnd() < 0.7 ? 5 : 3 + Math.floor(this.rnd() * 2)) as Fase;
      this.estado.plantas.push({ uid: this.estado.uid++, baya, fase, tx: c.tx, ty: c.ty, salvaje: true });
    }
  }

  // ---- Látigo Cepa sobre una casilla: cosecha si hay bayas maduras ----
  latigo(tx: number, ty: number): Evento[] {
    const e = this.estado;
    const p = e.plantas.find(q => q.tx === tx && q.ty === ty);
    if (!p || p.fase < 5) return [];
    if (e.energia < COSTE_LATIGO) return [{ tipo: 'sinEnergia' }];
    const n = 2 + Math.floor(this.rnd() * 2);
    if (!this.anadir(p.baya, n)) return [{ tipo: 'inventarioLleno' }];
    e.energia -= COSTE_LATIGO;
    if (p.salvaje) p.fase = 3; else e.plantas.splice(e.plantas.indexOf(p), 1);
    return [{ tipo: 'cosecha', baya: p.baya, n }];
  }
  // Arar solo ocurre al sembrar (la tierra aparece bajo la semilla).
  private arar(tx: number, ty: number, puedeArar: boolean): Evento[] {
    const e = this.estado;
    if (!puedeArar || this.ocupada(tx, ty) || e.aradas.includes(clave(tx, ty))) return [];
    if (e.energia < COSTE_ARAR) return [{ tipo: 'sinEnergia' }];
    e.energia -= COSTE_ARAR;
    e.aradas.push(clave(tx, ty));
    return [{ tipo: 'arado', tx, ty }];
  }

  // Sembrar la baya del slot elegido (F / espacio). Vale sobre tierra (`esTierra`, natural o
  // arada) y, si es césped libre (`puedeArar`), la casilla se convierte en tierra en el mismo gesto.
  plantar(tx: number, ty: number, slot: number, esTierra: boolean, puedeArar: boolean): Evento[] {
    const e = this.estado, s = e.inventario[slot];
    if (!s || ITEMS[s.id]?.tipo !== 'baya' || this.ocupada(tx, ty)) return [];
    const evs: Evento[] = [];
    if (!esTierra) {
      const ar = this.arar(tx, ty, puedeArar);
      if (!ar.some(v => v.tipo === 'arado')) return ar;
      evs.push(...ar);
    }
    const baya = s.id;
    this.quitar(slot);
    e.plantas.push({ uid: e.uid++, baya, fase: 1, tx, ty, salvaje: false });
    evs.push({ tipo: 'plantado', baya });
    if (e.lluvia) evs.push(...this.regar([clave(tx, ty)]));
    return evs;
  }

  // Regar casillas (hoy solo lo hace la lluvia; el riego manual llega con Marill, GDD §3).
  regar(casillas: string[]): Evento[] {
    const nuevas = casillas.filter(k => !this.estado.regadas.includes(k));
    if (!nuevas.length) return [];
    this.estado.regadas.push(...nuevas);
    return [{ tipo: 'regado', casillas: nuevas }];
  }

  // ---- Caja de envío ----
  enviar(slot: number): Evento[] {
    const s = this.estado.inventario[slot];
    if (!s) return [];
    const n = s.n;
    const c = this.estado.caja.find(x => x.id === s.id);
    if (c) c.n += n; else this.estado.caja.push({ id: s.id, n });
    this.estado.inventario[slot] = null;
    return [{ tipo: 'enviado', id: s.id, n }];
  }
  get valorCaja(): number { return this.estado.caja.reduce((a, s) => a + (ITEMS[s.id]?.precio ?? 0) * s.n, 0); }

  // ---- Dormir / nuevo día ----
  dormir(desmayo = false): Evento {
    const e = this.estado;
    const ingresos = this.valorCaja;
    e.dinero += ingresos; e.caja = []; e.ultimoEnvio = ingresos;
    if (desmayo) e.dinero -= Math.min(1000, Math.floor(e.dinero * 0.1));
    e.dia++; e.minuto = MIN_DIA;
    e.energia = desmayo ? Math.floor(ENERGIA_MAX * 0.6) : ENERGIA_MAX;
    this.rnd = rng(e.semilla + e.dia * 7919);
    // Las plantas crecen una fase por día (las salvajes vuelven a dar fruto; las sembradas
    // no necesitan riego en esta versión: el riego llega con Marill, GDD §3).
    for (const p of e.plantas) if (p.fase > 0 && p.fase < 5) p.fase = (p.fase + 1) as Fase;
    this.aparecerRecolectables(APARICIONES_DIA);
    // La tierra se seca; si llueve, amanece regada (GDD §5: la lluvia riega sola).
    e.regadas = [];
    e.lluvia = this.rnd() < PROB_LLUVIA;
    if (e.lluvia) e.regadas = e.plantas.filter(p => !p.salvaje).map(p => clave(p.tx, p.ty));
    this.guardar();
    return { tipo: 'nuevoDia', dia: e.dia, ingresos, desmayo, lluvia: e.lluvia };
  }
}
