// Laboratorio (I+D): el valle en el estilo "dibujo" de lab/assets/ref/aldea_dibujo.png.
// Misma presentación que el juego: casilla de 24 px, base 480×270 y zoom entero S.
export const A = '/assets/';       // arte del juego (Pokémon PMD, pared de los lagos)
export const L = '/lab/assets/';   // arte del laboratorio (elementos del dibujo, suelo)
export const VW = 480, VH = 270, T = 24;

const params = new URLSearchParams(location.search);
// ?zoom=N fuerza el zoom (para comparar); por defecto el entero que quepa en la ventana.
export const S = Math.max(1, Math.floor(+(params.get('zoom') ?? 0)) || Math.floor(Math.min(innerWidth / VW, innerHeight / VH)));
// Px de mundo por px del dibujo de referencia (1024 px). 1/3: a zoom 3, 1 px del dibujo = 1 px de
// pantalla (el usuario pidió bajar de 1,5 a 1 para que las proporciones con Bulbasaur tengan sentido:
// casa grande ≈ 6,4 casillas, puerta ≈ 27 px frente a los 24 del Pokémon). ?escala=0.5 para la anterior.
export const F = +(params.get('escala') ?? 0) || 1 / 3;
// Los PNG de elementos están a ×2 del dibujo (lab/tools/extraer.py).
export const PNG_X = 2;
export const VEL = 84;             // px de mundo por segundo (como el juego)
// Por defecto los elementos grandes se cargan como SVG (lab/assets/vector/, vectorizar2.py) rasterizados
// al tamaño exacto de pantalla; ?vector=0 (o ?png=1) usa los PNG reducidos.
export const VECTOR = !params.has('png') && params.get('vector') !== '0';
// ?klein=1: sustituye elementos por sus versiones reinterpretadas con Flux.2 Klein (lab/assets/elementos/extra.json),
// escaladas para ocupar lo mismo. Para comparar el original con el rediseño en el mismo sitio del mapa.
export const KLEIN = params.has('klein');
// ?noche=1: mapa de noche. Luz ambiente azul oscura (Light2D), farolas (elemento `farola` del catálogo Klein) y
// hoguera con luz cálida que parpadea; Bulbasaur se carga con su mapa de normales (tools/normales_pokemon.py) y
// el pipeline «cel» (src/render/CelPipeline.ts), así la luz de cada farola le da por su lado.
export const NOCHE = params.has('noche') || params.has('luces');
// ?luces=1: banco de pruebas de los tipos de luz (src/render/luces.ts): el valle vacío de noche con una fila de farolas,
// cada una con un tipo de luz distinto y su nombre encima; Bulbasaur pasea entre ellas.
export const LUCES = params.has('luces');
// Catálogo por defecto: 'klein' (lab/assets/elementos_klein/, elementos reinterpretados con Flux.2 Klein,
// tools/catalogo_klein.py); lo que no esté en él sale del catálogo original. ?set=original para ver solo
// los recortes del dibujo. Cada elemento puede traer `k` (escala extra) y `dir`.
const setParam = params.get('set') ?? 'klein';
export const SET = setParam === 'original' ? '' : setParam;
export const SUSTITUTOS: Record<string, { id: string; s: number }> = { casa_grande: { id: 'casa_klein', s: 0.69 } };

// Fila de la hoja PMD según el ángulo de movimiento (8 direcciones), como en el juego.
export const ROW_FROM_ANGLE = [2, 1, 0, 7, 6, 5, 4, 3];

export interface AnimInfo { fw: number; fh: number; durs: number[] }
export type AnimSet = Record<string, AnimInfo>;

// Elemento sacado del dibujo (lab/assets/elementos/elementos.json).
export interface Elemento {
  id: string; tipo: 'casa' | 'arbol' | 'roca' | 'estanque' | 'piedras' | 'losa' | 'detalle';
  archivo: string; w: number; h: number;
  ancla: [number, number];                      // px del PNG: centro-base
  huella: [number, number, number, number] | null; // px del PNG: rectángulo que bloquea el paso
  k?: number;     // escala extra (catálogos alternativos: para medir lo que el original)
  dir?: string;   // carpeta del PNG bajo lab/assets/ (por defecto 'elementos')
  // Sombra proyectada (la que pintó Klein), como máscara aparte: se dibuja con opacidad y multiply.
  sombra?: { archivo: string; w: number; h: number; dx: number; dy: number }; // dx,dy: respecto a la esquina del PNG
}
export interface Elementos { escala: number; elementos: Elemento[] }
