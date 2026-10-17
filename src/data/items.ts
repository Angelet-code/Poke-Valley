// Objetos del inventario. Data-driven: añadir uno aquí no requiere tocar la lógica.
// `icono` es la clave de textura (los recolectables usan su propio sprite pixel art;
// las bayas, el icono de 24×24 de Esmeralda).

export type ItemKind = 'recolectable' | 'baya' | 'pokeball' | 'medicina' | 'equipable' | 'evolutivo' | 'especial';   // equipable: combate/objetos.ts; evolutivo: data/pokedex.ts EVO_OBJETO; especial: el gachapón (combate/gacha.ts)

export interface ItemDef {
  id: string;
  nombre: string;
  precio: number;      // Pokédólares por unidad en la caja de envío
  tipo: ItemKind;
  icono: string;       // clave de textura de Phaser
  cura?: number;       // medicinas: PS que devuelve (como en los juegos: Poción 20, Super 60, Hiper 120)
}

export const BAYAS_SALVAJES = ['oran', 'cheri', 'pecha', 'rawst', 'aspear', 'leppa', 'sitrus', 'razz', 'wiki', 'mago'];

const NOMBRE_BAYA: Record<string, string> = {
  aguav: 'Guaya', aspear: 'Perasi', cheri: 'Zreza', chesto: 'Atania', cornn: 'Mais', durin: 'Lidúr', figy: 'Higog',
  grepa: 'Uvav', hondew: 'Meluce', iapapa: 'Pabaya', kelpsy: 'Algama', lansat: 'Zonlan', leppa: 'Zanama',
  liechi: 'Lichi', lum: 'Ziuela', mago: 'Ango', nomel: 'Monli', oran: 'Aranja', pamtre: 'Plama', pecha: 'Meloc',
  persim: 'Caquic', pomeg: 'Grana', rabuta: 'Rautan', rawst: 'Safre', razz: 'Frambu', sitrus: 'Zidra',
  spelon: 'Wikano', tamato: 'Tamate', wepear: 'Peragu', wiki: 'Wiki',
};
const PRECIO_BAYA: Record<string, number> = { oran: 20, cheri: 15, pecha: 15, rawst: 15, aspear: 15, leppa: 30, sitrus: 50, razz: 10, wiki: 25, mago: 25 };

export const ITEMS: Record<string, ItemDef> = {
  palo: { id: 'palo', nombre: 'Rama', precio: 2, tipo: 'recolectable', icono: 'obj_palo' },
  palo_1: { id: 'palo_1', nombre: 'Ramita', precio: 2, tipo: 'recolectable', icono: 'obj_palo_1' },
  tronco: { id: 'tronco', nombre: 'Tronco', precio: 8, tipo: 'recolectable', icono: 'obj_tronco' },
  piedra: { id: 'piedra', nombre: 'Piedra', precio: 3, tipo: 'recolectable', icono: 'obj_piedra' },
  piedra_1: { id: 'piedra_1', nombre: 'Piedra', precio: 3, tipo: 'recolectable', icono: 'obj_piedra_1' },
  pokeball: { id: 'pokeball', nombre: 'Poké Ball', precio: 50, tipo: 'pokeball', icono: 'icono_pokeball' },
  superball: { id: 'superball', nombre: 'Super Ball', precio: 80, tipo: 'pokeball', icono: 'icono_superball' },
  ultraball: { id: 'ultraball', nombre: 'Ultra Ball', precio: 120, tipo: 'pokeball', icono: 'icono_ultraball' },
  masterball: { id: 'masterball', nombre: 'Master Ball', precio: 500, tipo: 'pokeball', icono: 'icono_masterball' },
  honorball: { id: 'honorball', nombre: 'Honor Ball', precio: 60, tipo: 'pokeball', icono: 'icono_honorball' },
  // Modo aventura: se encuentran por el suelo y las sueltan los salvajes, según el nivel (combate/botin.ts).
  pocion: { id: 'pocion', nombre: 'Poción', precio: 30, tipo: 'medicina', icono: 'icono_pocion', cura: 20 },
  superpocion: { id: 'superpocion', nombre: 'Superpoción', precio: 70, tipo: 'medicina', icono: 'icono_superpocion', cura: 60 },
  hiperpocion: { id: 'hiperpocion', nombre: 'Hiperpoción', precio: 120, tipo: 'medicina', icono: 'icono_hiperpocion', cura: 120 },
  // Piedras evolutivas (modo aventura): se usan desde el inventario (I) o la barra; iconos de tools/iconos_piedras.py.
  waterstone: { id: 'waterstone', nombre: 'Piedra Agua', precio: 200, tipo: 'evolutivo', icono: 'icono_waterstone' },
  thunderstone: { id: 'thunderstone', nombre: 'Piedra Trueno', precio: 200, tipo: 'evolutivo', icono: 'icono_thunderstone' },
  firestone: { id: 'firestone', nombre: 'Piedra Fuego', precio: 200, tipo: 'evolutivo', icono: 'icono_firestone' },
  leafstone: { id: 'leafstone', nombre: 'Piedra Hoja', precio: 200, tipo: 'evolutivo', icono: 'icono_leafstone' },
  icestone: { id: 'icestone', nombre: 'Piedra Hielo', precio: 200, tipo: 'evolutivo', icono: 'icono_icestone' },
  // Gachapón de Meowth (combate/gacha.ts): la moneda la sueltan los alfas; el caramelo y el huevo salen de la máquina.
  // Iconos de tools/iconos_gacha.py.
  moneda_meowth: { id: 'moneda_meowth', nombre: 'Moneda Meowth', precio: 0, tipo: 'especial', icono: 'icono_moneda_meowth' },
  rarecandy: { id: 'rarecandy', nombre: 'Caramelo Raro', precio: 300, tipo: 'especial', icono: 'icono_rarecandy' },
  huevo: { id: 'huevo', nombre: 'Huevo', precio: 0, tipo: 'especial', icono: 'icono_huevo' },
};

// Las bayas del catálogo se registran al cargar bayas.json (una entrada por baya).
export function registrarBayas(ids: string[]): void {
  for (const id of ids) {
    ITEMS[id] = { id, nombre: 'Baya ' + (NOMBRE_BAYA[id] ?? id), precio: PRECIO_BAYA[id] ?? 20, tipo: 'baya', icono: 'icono_' + id };
  }
}

// Recolectables que aparecen cada mañana y su peso relativo.
// Las Balls son raras: las más fuertes, más.
export const APARICIONES: [string, number][] = [['palo', 30], ['palo_1', 20], ['piedra', 20], ['piedra_1', 15], ['tronco', 15],
  ['pokeball', 10], ['superball', 4], ['ultraball', 2], ['honorball', 2]];

// Poké Balls (GDD-pueblo §12): multiplican la probabilidad de que un salvaje se quede. La Master Ball
// no falla nunca; la Honor Ball, además, convence a un visitante sin darle lo que pide.
// Orden = el que se gasta primero si en la mano no llevas una Ball (la Master Ball solo si la eliges).
export const BALL: Record<string, number> = { pokeball: 1, superball: 1.5, ultraball: 2, honorball: 1, masterball: Infinity };

// Pokécoins por unidad de cada recurso del almacén en la caja de Pelipper (GDD-pueblo §2: lo que no
// se gasta en construir se vende). Madera y piedra valen lo mismo que sus objetos sueltos (rama 2,
// piedra 3); las bayas del almacén son comida genérica y valen menos que una baya concreta.
// Un ladrillo (2 piedras cocidas) vale más que sus piedras; un plato (3 bayas) más que sus bayas.
export const PRECIO_RECURSO: Record<'madera' | 'piedra' | 'bayas' | 'ladrillos' | 'platos', number> = { madera: 2, piedra: 3, bayas: 5, ladrillos: 10, platos: 25 };
