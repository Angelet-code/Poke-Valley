// Firmas: una animación propia por movimiento (LEEME.md). Lo que no tenga firma usa las plantillas de Colleja
// (templates.ts: playMove). Cada grupo de tipos vive en su archivo.
import { playMove, type MoveContext } from '../templates';
import { Kit, type Firma } from './kit';
import { FIRMAS as normalGolpes } from './normal_golpes';
import { FIRMAS as normalEstado } from './normal_estado';
import { FIRMAS as mente } from './mente';
import { FIRMAS as naturaleza } from './naturaleza';
import { FIRMAS as tierra } from './tierra';
import { FIRMAS as elementos } from './elementos';
import { FIRMAS as cielo } from './cielo';

export const FIRMAS: Record<string, Firma> = { ...normalGolpes, ...normalEstado, ...mente, ...naturaleza, ...tierra, ...elementos, ...cielo };

/** Anima un movimiento: su firma si la tiene; si no, la plantilla. El daño siempre se aplica (commit) al final como muy tarde. */
export async function animarMovimiento(ctx: MoveContext): Promise<void> {
  const firma = FIRMAS[ctx.cue.move];
  try {
    if (firma) await firma(new Kit(ctx));
    else await playMove(ctx);
  } finally {
    ctx.commit();
    // Los sprites vuelven a su sitio (cuando acaben sus animaciones, si aún tienen alguna en marcha).
    const reposar = () => { for (const g of [ctx.user, ...ctx.targets]) ctx.stage.reposar(g.sprite); };
    reposar();
    void ctx.stage.wait(700).then(reposar);
  }
}
