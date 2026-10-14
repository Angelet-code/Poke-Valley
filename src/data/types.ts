// Formato del mapa (docs/art/mapas/*.json, el que exporta la maqueta con X).
export interface MapObj { id: string; x: number; y: number }
export interface MapTree { x: number; y: number; k?: number; h?: number }
export interface MapRock { x: number; y: number; k?: number; s?: number }
export interface MapData {
  mw: number; mh: number;
  vert: number[][];            // (mh+1) filas × (mw+1) esquinas: 0 césped, 1 tierra, 2 losas, 3 agua
  inicio?: [number, number];   // px de mundo
  entrada?: [number, number];  // entrada del valle (px de mundo); si no hay, el extremo sur del camino
  nidos?: [number, number][];  // nidos con los que empieza la partida (px de mundo); si no hay, se buscan junto a la casa
  solares?: [number, number, number, number][]; // zonas libres pensadas para construir (x0, y0, x1, y1), informativo
  objetos?: MapObj[];
  arboles?: MapTree[];
  rocas?: MapRock[];
}

// Catálogo de objetos pixel art (assets/game/pixel/items.json y edificios.json).
export interface ObjDef {
  archivo: string;
  ancla: [number, number];
  colision: [number, number];
  tipo: 'item' | 'estacion' | 'edificio';
  icono?: string; // icono de inventario distinto del sprite del suelo (p. ej. Poké Balls de mochila)
  suelo?: boolean; // a ras de suelo (nido): se pisa y todo pasa por encima
}
export type ObjCatalog = Record<string, ObjDef>;

// Catálogo de bayas (assets/sprites/bayas/bayas.json).
export interface BayasData {
  fases: string[];
  tierra: { png: string; frame: [number, number]; frames: number };
  brote: { png: string; frame: [number, number]; frames: number };
  arbol: { frame: [number, number]; frames_por_fase: number; orden: string[] };
  bayas: Record<string, { png: string; icono: string }>;
}
