// Rótulos de las teclas y su equivalente en el mando (la tabla de src/entrada/mando.ts), para que el HUD, el mapa y
// los avisos digan "A" en vez de "F" cuando se juega con mando. Sin Phaser: lo usa también la simulación (mundo.ts).
export const ROTULO_MANDO: Record<string, string> = {
  '1': 'X', '2': 'Y', '3': 'L1', '4': 'R1', '5': '↑', '6': '→', '7': '↓', '8': '←', '9': 'L2X', '0': 'L2Y',
  F: 'A', Esc: 'B', Tab: 'R2', M: '−', H: 'L3', K: 'L2←', I: 'L2→', T: 'L2↓', R: 'L2+R2', clic: 'R2',
};

/** La tecla tal cual, o su botón del mando si `conMando`. */
export const rotulo = (tecla: string, conMando: boolean): string => conMando ? ROTULO_MANDO[tecla] ?? tecla : tecla;
