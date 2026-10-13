// Objetos del inventario. Data-driven: añadir uno aquí no requiere tocar la lógica.
// `icono` es la clave de textura (los recolectables usan su propio sprite pixel art;
// las bayas, el icono de 24×24 de Esmeralda).

export type ItemKind = 'recolectable' | 'baya' | 'pokeball';

export interface ItemDef {
  id: string;
  nombre: string;
  precio: number;      // Pokédólares por unidad en la caja de envío
  tipo: ItemKind;
  icono: string;       // clave de textura de Phaser
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
};

// Las bayas del catálogo se registran al cargar bayas.json (una entrada por baya).
export function registrarBayas(ids: string[]): void {
  for (const id of ids) {
    ITEMS[id] = { id, nombre: 'Baya ' + (NOMBRE_BAYA[id] ?? id), precio: PRECIO_BAYA[id] ?? 20, tipo: 'baya', icono: 'icono_' + id };
  }
}

// Recolectables que aparecen cada mañana y su peso relativo.
export const APARICIONES: [string, number][] = [['palo', 30], ['palo_1', 20], ['piedra', 20], ['piedra_1', 15], ['tronco', 15]];
