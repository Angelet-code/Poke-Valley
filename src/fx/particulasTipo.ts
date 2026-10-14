// Partículas de cada tipo para la cinemática de la evolución (src/scenes/Evolucion.ts): formas y colores. Lo que
// hace cada tipo con ellas (su coreografía) está en fx/efectosTipo.ts.
// - Formas: texturas blancas con su sombreado, generadas aquí en canvas (el color lo pone el tinte).
// - Las chispas que caen en espiral hacia el Pokémon usan sus formas y colores, con su temblor (`zig`), balanceo
//   (`vaiven`) y parpadeo.
import Phaser from 'phaser';
import type { TypeName } from '../data/movimientos';

export interface EstiloTipo {
  formas: string[];            // texturas (p-*, evo-punto, evo-estrella)
  colores: number[];
  tam: [number, number];       // escala de la textura (× S)
  giro: number;                // rad/s, como mucho
  normal?: boolean;            // se pinta normal (humo oscuro, rocas), no sumando luz
  zig?: number;                // temblor (px de juego)
  vaiven?: number;             // balanceo (px de juego)
  parpadeo?: boolean;
  orienta?: boolean;           // apunta hacia donde va (gotas, chispas)
}

export const ESTILO_TIPO: Record<TypeName, EstiloTipo> = {
  Normal:   { formas: ['evo-estrella', 'evo-punto'], colores: [0xffffff, 0xf6eccc, 0xffe9a8], tam: [0.12, 0.22], giro: 2, vaiven: 4 },
  Fire:     { formas: ['p-llama', 'p-llama', 'evo-punto'], colores: [0xffd25a, 0xff8a2a, 0xff4a1a], tam: [0.16, 0.3], giro: 0, parpadeo: true, vaiven: 3 },
  Water:    { formas: ['p-gota', 'p-burbuja'], colores: [0x9fd8ff, 0x4a9cf0, 0xe0f4ff], tam: [0.12, 0.22], giro: 0, orienta: true },
  Electric: { formas: ['p-rayo', 'p-rayo', 'p-chispa'], colores: [0xfff27a, 0xffd21a, 0xffffff], tam: [0.16, 0.3], giro: 0, zig: 2.5, parpadeo: true },
  Grass:    { formas: ['p-hoja'], colores: [0x8fe060, 0x4cae3a, 0xc6f08a], tam: [0.16, 0.26], giro: 3, vaiven: 12 },
  Ice:      { formas: ['p-copo', 'p-copo', 'p-destello'], colores: [0xf2fdff, 0xa8e8f4, 0xcfe6ff], tam: [0.14, 0.26], giro: 1, vaiven: 5 },
  Fighting: { formas: ['p-chispa', 'p-chispa', 'evo-estrella'], colores: [0xff6a4a, 0xffb07a, 0xffffff], tam: [0.16, 0.28], giro: 0, orienta: true },
  Poison:   { formas: ['p-burbuja', 'p-burbuja', 'evo-punto'], colores: [0xd07ae8, 0x9a4ab8, 0xe8b8f4], tam: [0.12, 0.26], giro: 0, vaiven: 5 },
  Ground:   { formas: ['p-roca', 'p-humo'], colores: [0xe2bf65, 0xb8904a, 0x8a6a3a], tam: [0.12, 0.24], giro: 5, normal: true },
  Flying:   { formas: ['p-pluma'], colores: [0xffffff, 0xe0d8ff, 0xbcaaf6], tam: [0.18, 0.3], giro: 1.5, vaiven: 16 },
  Psychic:  { formas: ['p-aro', 'evo-punto'], colores: [0xff8ab8, 0xf95587, 0xffd0e4], tam: [0.12, 0.2], giro: 0, parpadeo: true },
  Bug:      { formas: ['evo-punto'], colores: [0xe2f86a, 0xb8cc2a, 0xfff6a0], tam: [0.12, 0.2], giro: 0, parpadeo: true, vaiven: 8 },
  Rock:     { formas: ['p-roca'], colores: [0xd2bf78, 0xa8965a, 0x86764a], tam: [0.14, 0.26], giro: 4, normal: true },
  Ghost:    { formas: ['p-humo', 'evo-punto'], colores: [0xa88ae0, 0x7a5ab0, 0xe0d0ff], tam: [0.2, 0.36], giro: 0.5, vaiven: 14, parpadeo: true },
  Dragon:   { formas: ['p-escama', 'p-escama', 'evo-estrella'], colores: [0x9a6aff, 0x6a4af0, 0xff9a7a], tam: [0.14, 0.24], giro: 3 },
  Dark:     { formas: ['p-humo'], colores: [0x2a1e36, 0x4a3a5a, 0x140c1c], tam: [0.3, 0.5], giro: 0.4, normal: true, vaiven: 10 },
  Steel:    { formas: ['p-destello', 'p-escama'], colores: [0xf2f6ff, 0xc4c8dc, 0xffffff], tam: [0.16, 0.3], giro: 1 },
  Fairy:    { formas: ['p-corazon', 'p-corazon', 'evo-estrella'], colores: [0xffb8e0, 0xf08cc4, 0xffffff], tam: [0.14, 0.24], giro: 0.8, vaiven: 7 },
};

// Texturas de las formas (64 px, blancas con su sombreado; el color lo pone el tinte).
export function texturasTipo(scene: Phaser.Scene): void {
  const tx = scene.textures, N = 64, c = N / 2;
  const lienzo = (key: string, pinta: (g: CanvasRenderingContext2D) => void) => {
    if (tx.exists(key)) return;
    const cv = tx.createCanvas(key, N, N)!;
    const g = cv.getContext();
    g.lineCap = 'round'; g.lineJoin = 'round';
    pinta(g);
    cv.refresh(); cv.setFilter(Phaser.Textures.FilterMode.LINEAR);
  };
  const blanco = (a = 1) => `rgba(255,255,255,${a})`, gris = (v: number, a = 1) => `rgba(${v},${v},${v},${a})`;
  const brilloCentro = (g: CanvasRenderingContext2D, x: number, y: number, r: number, a = 0.9) => {
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, blanco(a)); gr.addColorStop(1, blanco(0));
    g.fillStyle = gr; g.fillRect(0, 0, N, N);
  };

  lienzo('p-hoja', g => {   // hoja en diagonal, con nervio
    g.translate(c, c); g.rotate(-Math.PI / 4);
    g.beginPath(); g.moveTo(0, -28); g.quadraticCurveTo(17, -6, 0, 28); g.quadraticCurveTo(-17, -6, 0, -28); g.closePath();
    g.fillStyle = gris(225); g.fill();
    g.beginPath(); g.moveTo(0, -24); g.quadraticCurveTo(9, -6, 0, 24); g.closePath(); g.fillStyle = blanco(); g.fill();
    g.strokeStyle = gris(170); g.lineWidth = 2; g.beginPath(); g.moveTo(0, -24); g.lineTo(0, 26); g.stroke();
    for (let i = -2; i <= 2; i++) { g.beginPath(); g.moveTo(0, i * 8); g.lineTo(8, i * 8 - 6); g.moveTo(0, i * 8); g.lineTo(-8, i * 8 - 6); g.lineWidth = 1; g.stroke(); }
  });
  lienzo('p-llama', g => {   // lengua de fuego suave: punta arriba, base redonda, núcleo brillante y bordes difusos
    g.beginPath(); g.moveTo(c, 2);
    g.bezierCurveTo(c + 6, c - 14, c + 22, c + 2, c + 20, c + 14);
    g.bezierCurveTo(c + 18, N - 4, c - 18, N - 4, c - 20, c + 14);
    g.bezierCurveTo(c - 22, c + 2, c - 6, c - 14, c, 2); g.closePath();
    g.save(); g.clip();
    const gr = g.createRadialGradient(c, c + 14, 0, c, c + 6, 34);
    gr.addColorStop(0, blanco(1)); gr.addColorStop(0.35, blanco(0.85)); gr.addColorStop(0.7, blanco(0.35)); gr.addColorStop(1, blanco(0));
    g.fillStyle = gr; g.fillRect(0, 0, N, N);
    g.restore();
  });
  lienzo('p-gota', g => {    // gota, punta arriba, con brillo
    g.beginPath(); g.moveTo(c, c - 28); g.bezierCurveTo(c + 6, c - 14, c + 18, c, c + 18, c + 10); g.arc(c, c + 10, 18, 0, Math.PI); g.bezierCurveTo(c - 18, c, c - 6, c - 14, c, c - 28); g.closePath();
    g.fillStyle = gris(215); g.fill();
    g.beginPath(); g.ellipse(c - 7, c + 6, 4, 7, -0.3, 0, Math.PI * 2); g.fillStyle = blanco(); g.fill();
  });
  lienzo('p-rayo', g => {    // relámpago en zigzag
    g.beginPath();
    [[8, -30], [-10, -2], [2, -2], [-8, 30], [12, 0], [0, 0], [10, -30]].forEach(([x, y], i) => i ? g.lineTo(c + x, c + y) : g.moveTo(c + x, c + y));
    g.closePath(); g.fillStyle = blanco(); g.fill();
    g.strokeStyle = gris(200); g.lineWidth = 2; g.stroke();
  });
  lienzo('p-chispa', g => {  // trazo alargado (chispa, golpe), vertical
    const gr = g.createLinearGradient(c, 2, c, N - 2);
    gr.addColorStop(0, blanco(0)); gr.addColorStop(0.5, blanco()); gr.addColorStop(1, blanco(0));
    g.fillStyle = gr; g.beginPath(); g.ellipse(c, c, 4, 30, 0, 0, Math.PI * 2); g.fill();
  });
  lienzo('p-copo', g => {    // copo de seis brazos
    g.strokeStyle = blanco(); g.lineWidth = 3.5;
    for (let i = 0; i < 6; i++) {
      g.save(); g.translate(c, c); g.rotate(i * Math.PI / 3);
      g.beginPath(); g.moveTo(0, 0); g.lineTo(0, -27); g.moveTo(0, -15); g.lineTo(7, -22); g.moveTo(0, -15); g.lineTo(-7, -22); g.stroke();
      g.restore();
    }
    brilloCentro(g, c, c, 8);
  });
  lienzo('p-burbuja', g => { // burbuja: borde, interior tenue y reflejo
    g.beginPath(); g.arc(c, c, 26, 0, Math.PI * 2); g.fillStyle = blanco(0.18); g.fill();
    g.lineWidth = 3.5; g.strokeStyle = gris(235); g.stroke();
    g.beginPath(); g.ellipse(c - 9, c - 10, 6, 4, -0.6, 0, Math.PI * 2); g.fillStyle = blanco(); g.fill();
  });
  lienzo('p-roca', g => {    // piedra de caras planas
    const pts = [[-24, -6], [-12, -24], [10, -22], [26, -4], [18, 20], [-6, 24], [-24, 12]];
    g.beginPath(); pts.forEach(([x, y], i) => i ? g.lineTo(c + x, c + y) : g.moveTo(c + x, c + y)); g.closePath();
    g.fillStyle = gris(185); g.fill();
    g.beginPath(); [[-12, -24], [10, -22], [26, -4], [4, -2], [-24, -6]].forEach(([x, y], i) => i ? g.lineTo(c + x, c + y) : g.moveTo(c + x, c + y)); g.closePath();
    g.fillStyle = blanco(); g.fill();
    g.beginPath(); [[4, -2], [26, -4], [18, 20]].forEach(([x, y], i) => i ? g.lineTo(c + x, c + y) : g.moveTo(c + x, c + y)); g.closePath();
    g.fillStyle = gris(140); g.fill();
  });
  lienzo('p-humo', g => {    // bocanada: varios círculos suaves
    for (const [x, y, r] of [[0, 4, 20], [-12, -4, 14], [12, -6, 15], [2, -14, 13]]) {
      const gr = g.createRadialGradient(c + x, c + y, 0, c + x, c + y, r);
      gr.addColorStop(0, blanco(0.75)); gr.addColorStop(1, blanco(0));
      g.fillStyle = gr; g.fillRect(0, 0, N, N);
    }
  });
  lienzo('p-pluma', g => {   // pluma con cañón y barbas
    g.translate(c, c); g.rotate(Math.PI / 5);
    g.beginPath(); g.moveTo(0, -29); g.bezierCurveTo(13, -18, 11, 14, 0, 24); g.bezierCurveTo(-11, 14, -13, -18, 0, -29); g.closePath();
    g.fillStyle = blanco(); g.fill();
    g.strokeStyle = gris(190); g.lineWidth = 1;
    for (let y = -20; y < 20; y += 5) { g.beginPath(); g.moveTo(0, y); g.lineTo(9, y - 5); g.moveTo(0, y); g.lineTo(-9, y - 5); g.stroke(); }
    g.lineWidth = 2; g.strokeStyle = gris(160); g.beginPath(); g.moveTo(0, -26); g.lineTo(0, 31); g.stroke();
  });
  lienzo('p-aro', g => {     // anillo fino (psíquico)
    g.lineWidth = 3; g.strokeStyle = blanco(); g.beginPath(); g.arc(c, c, 27, 0, Math.PI * 2); g.stroke();
    g.lineWidth = 1.5; g.strokeStyle = blanco(0.5); g.beginPath(); g.arc(c, c, 22, 0, Math.PI * 2); g.stroke();
  });
  lienzo('p-escama', g => {  // escama/rombo facetado
    g.beginPath(); g.moveTo(c, c - 28); g.lineTo(c + 18, c); g.lineTo(c, c + 28); g.lineTo(c - 18, c); g.closePath();
    g.fillStyle = gris(180); g.fill();
    g.beginPath(); g.moveTo(c, c - 28); g.lineTo(c + 18, c); g.lineTo(c, c); g.lineTo(c - 18, c); g.closePath();
    g.fillStyle = blanco(); g.fill();
  });
  lienzo('p-destello', g => { // destello en cruz, fino
    g.fillStyle = blanco();
    for (const [w, h] of [[3, 30], [30, 3]]) { g.beginPath(); g.ellipse(c, c, w, h, 0, 0, Math.PI * 2); g.fill(); }
    g.save(); g.translate(c, c); g.rotate(Math.PI / 4);
    for (const [w, h] of [[2, 14], [14, 2]]) { g.beginPath(); g.ellipse(0, 0, w, h, 0, 0, Math.PI * 2); g.fill(); }
    g.restore();
    brilloCentro(g, c, c, 10);
  });
  lienzo('p-corazon', g => { // corazón con brillo
    g.beginPath(); g.moveTo(c, c + 24);
    g.bezierCurveTo(c - 30, c + 2, c - 22, c - 26, c, c - 12);
    g.bezierCurveTo(c + 22, c - 26, c + 30, c + 2, c, c + 24); g.closePath();
    g.fillStyle = gris(225); g.fill();
    g.beginPath(); g.ellipse(c - 10, c - 8, 5, 3.5, -0.6, 0, Math.PI * 2); g.fillStyle = blanco(); g.fill();
  });
}
