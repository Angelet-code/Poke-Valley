// Tipos de luz del juego (idea 2026-10-14: no todas las luces son iguales). Cada tipo fija el color y el alcance de
// la luz Light2D y, para los sprites con normales (pipeline cel, CelPipeline.ts), cómo les da: altura (0 = rasante, con
// mucha sombra lateral; 1 = frontal, casi sin sombra), bandas y umbral del cel y suavidad del corte. Más la animación:
// parpadeo (ruido rápido), pulso (respiración lenta) y chispa (apagones breves al azar, luz eléctrica).
// Para referirse a ellas: por su clave (`farol`, `vela`, `hoguera`, `luna`, `electrica`, `espectral`, `cristal`).
export interface TipoLuz {
  nombre: string;      // etiqueta para enseñarla
  color: number;
  radio: number;       // px de mundo
  intensidad: number;
  altura: number;      // 0-1, ver arriba (uniforme por luz del cel)
  bandas: number;      // niveles del cel (2 = sombra/luz seca, 3 = sombra/medio/luz)
  umbral: number;      // desplaza el corte sombra/luz (+ = más luz)
  suave: number;       // anchura de la transición entre bandas (0 = corte seco)
  parpadeo: number;    // amplitud del ruido rápido (0 = fija)
  pulso: number;       // amplitud de la respiración lenta
  pulsoHz: number;     // velocidad de la respiración
  chispa: number;      // 0-1: cuánto se apaga en los apagones breves (0 = nunca)
  halo: number;        // opacidad del halo dibujado sobre la luz (0 = sin halo)
}

export const TIPOS_LUZ: Record<string, TipoLuz> = {
  // Farol de aceite: cálido, bajo (da de lado, sombras marcadas), vibra apenas.
  farol:     { nombre: 'farol', color: 0xffc078, radio: 120, intensidad: 1.25, altura: 0.5, bandas: 3, umbral: 0.15, suave: 0.5, parpadeo: 0.06, pulso: 0, pulsoHz: 0, chispa: 0, halo: 0.35 },
  // Vela: pequeña, muy cálida, tiembla más y respira.
  vela:      { nombre: 'vela', color: 0xffb050, radio: 70, intensidad: 1.3, altura: 0.35, bandas: 3, umbral: 0.1, suave: 0.4, parpadeo: 0.14, pulso: 0.1, pulsoHz: 0.4, chispa: 0, halo: 0.4 },
  // Hoguera: naranja, rasante, llamea mucho.
  hoguera:   { nombre: 'hoguera', color: 0xff9040, radio: 90, intensidad: 1.4, altura: 0.3, bandas: 3, umbral: 0.1, suave: 0.35, parpadeo: 0.22, pulso: 0.08, pulsoHz: 0.7, chispa: 0, halo: 0.35 },
  // Luna: fría, alta (frontal, casi sin sombra), ancha y suave, no se mueve.
  luna:      { nombre: 'luna', color: 0xa8c0ff, radio: 170, intensidad: 1.0, altura: 1.0, bandas: 3, umbral: 0.2, suave: 0.9, parpadeo: 0, pulso: 0, pulsoHz: 0, chispa: 0, halo: 0.15 },
  // Eléctrica (Pikachu, chispazos): blanca-cian, dura (2 bandas, corte seco), con apagones.
  electrica: { nombre: 'eléctrica', color: 0xc8f0ff, radio: 110, intensidad: 1.5, altura: 0.6, bandas: 2, umbral: 0.0, suave: 0.0, parpadeo: 0.15, pulso: 0, pulsoHz: 0, chispa: 0.8, halo: 0.45 },
  // Espectral (Gastly, fuego fatuo): violeta-verdosa, baja, respira despacio.
  espectral: { nombre: 'espectral', color: 0x9a70ff, radio: 100, intensidad: 1.3, altura: 0.25, bandas: 3, umbral: -0.05, suave: 0.6, parpadeo: 0.03, pulso: 0.35, pulsoHz: 0.25, chispa: 0, halo: 0.5 },
  // Cristal / hada: rosa, media altura, pulso rápido y leve.
  cristal:   { nombre: 'cristal', color: 0xff8ad0, radio: 90, intensidad: 1.0, altura: 0.7, bandas: 4, umbral: 0.1, suave: 0.3, parpadeo: 0, pulso: 0.15, pulsoHz: 1.1, chispa: 0, halo: 0.45 },
};

// Factor de intensidad en el instante t (segundos) para una luz con fase propia.
export function animarLuz(tipo: TipoLuz, t: number, fase: number): number {
  let f = 1;
  if (tipo.parpadeo) f += tipo.parpadeo * (0.5 * Math.sin(t * 7 + fase) + 0.3 * Math.sin(t * 13.1 + fase * 1.7) + 0.2 * Math.sin(t * 31 + fase * 0.3));
  if (tipo.pulso) f += tipo.pulso * 0.5 * (Math.sin(t * tipo.pulsoHz * 2 * Math.PI + fase) - 1);
  if (tipo.chispa) { const r = Math.sin(t * 2.3 + fase) * Math.sin(t * 17.7 + fase * 3) * Math.sin(t * 41 + fase); if (r > 0.6) f *= 1 - tipo.chispa; }
  return Math.max(0, f);
}
