# Firmas: una animación propia por movimiento

Las animaciones de las plantillas de Colleja (`../templates.ts`) se repiten: Ascuas y Lanzallamas, o 72 golpes
físicos, se veían iguales. Una **firma** es la animación de un movimiento concreto. Si un movimiento no tiene firma,
usa la plantilla.

Están en `firmas/<grupo>.ts`, se reúnen en `index.ts` y se ven en la galería (`?galeria`).

## Lo que pide el usuario (léelo dos veces)
- **Que cada movimiento se reconozca por lo que es.** Algunos ejemplos:
  - Mordisco: unos colmillos que se cierran.
  - Rueda Fuego: una rueda de fuego de verdad.
  - Los puñetazos: un puño.
  - Puño Fuego: un puño hecho de fuego.
  - Hoja Afilada: hojas.
  - Cornada: un cuerno.
  - Picotazo: un pico.
  - Patada: un pie.
  - Canto: notas musicales.
  - Hipnosis: una espiral.
  - Rapidez: estrellas.
  - Danza Espada: espadas.

  Busca el objeto o la imagen que define el movimiento y enséñalo.
- **Variedad.** Dos movimientos no deben verse iguales, ni siquiera dentro del mismo tipo:
  - Ascuas son tres brasas sutiles; Lanzallamas, un chorro enorme; Giro Fuego, un remolino de llamas que encierra al
    objetivo; Infierno, una explosión que lo engulle; Llamarada… Cada uno con su idea.
- **Intensidad según la potencia** (`k.power` va de 0 a 1):
  - Los flojos (≤ 50) son sutiles, cortos y pequeños.
  - Los medios (60-85) son claros y con cuerpo.
  - Los fuertes (≥ 90) y los épicos (`k.epic`) son grandes, arriesgados y llamativos: oscurecen la vista
    (`k.cargaEpica()`, `E.dim`), destellan (`E.flash`), sacuden, llenan la pantalla de partículas o mueven mucho
    los sprites.
- **Arriesgadas, atractivas y llamativas.** Mejor una idea visual fuerte y clara que muchas partículas sin forma.

## Cómo es una firma
```ts
async flamethrower(k) {          // la clave es el id de Showdown (data/gen/combate.json)
  await k.cargar(120);            // fases opcionales: anticipar, cargar, cargaEpica
  ...                             // lo propio: formas, partículas, efectos, gestos del sprite
  await k.impacto(t => { ... });  // UNA vez: reacción del objetivo, rótulos, DAÑO y sacudida; `t` = cada objetivo alcanzado
  await k.despues();              // absorber vida, retroceso, flechas de stats y estados
},
```
- **Movimientos de daño**: `await k.impacto(...)` una sola vez, en el momento del golpe, y después
  `await k.despues()`. El impacto ya pinta la reacción común (destello, chispas, empujón, "Crítico", "Falla", la
  sacudida): tú añade lo tuyo en su callback.
- **Movimientos de estado**: `await k.estado()` una vez cuando el efecto "llega" (aplica y enseña flechas y estados).
- **Sobre sí mismo** (Danza Espada, Recuperación, Fortaleza…): `k.hayObjetivo` es falso. Anima al usuario
  (`k.user`, `k.posSprite()`).
- **Multigolpe** (Doble Patada, Pin Misil, Ataque Furia…): enseña varios golpes, pero `k.impacto` solo una vez (en
  el primero o en el último); el resto, con efectos.
- **De carga en los juegos** (Rayo Solar, Ataque Aéreo, Excavar, Buceo, Golpe Fantasma, Bote, Premonición): aquí no
  hay turno de carga. Hay una carga corta y luego el ataque: Excavar se hunde y sale bajo el objetivo; Bote salta muy
  alto y cae.
- Si falla (`k.acierta` falso), puedes hacer que el ataque pase de largo; `k.impacto` ya pone "Falla".

## Reglas
1. **Tiempo real.** Una firma normal dura ≤ 900 ms y una épica ≤ 1400 ms. El impacto llega a los ≤ 600 ms (épicas
   ≤ 1000 ms). Los flojos, en ~400 ms.
2. **Vista desde arriba.** El objetivo puede estar en cualquier dirección. Nunca supongas izquierda → derecha ni
   y = 0 como cielo.
   - Usa `k.dir`, `k.perp`, `k.angle`, `k.punto(t, lado)` y `k.haciaV(n)`.
   - Lo que llena la vista, con `k.stage.left/top/width/height`.
   - Las formas se orientan con `k.angle` (miran a +x).
   - Lo que cae del cielo sale de `k.stage.top`.
3. **Escala.** Mide con `k.s(f)` (f × el tamaño del objetivo), `k.user.size` y `k.dist`, no en px fijos.
4. **Rendimiento.** Menos de ~250 partículas vivas por movimiento. Si emites dentro de `k.dibujar` (cada
   fotograma), hazlo con moderación (`if (Math.random() < 0.4)`). El brillo de las formas (`brillo`, que es
   `shadowBlur`) vale para 1-3 formas a la vez, no para docenas.
5. **Solo tu archivo.** No toques `kit.ts`, `formas.ts`, `templates.ts` ni los demás grupos (otros agentes trabajan a
   la vez). Si te falta una forma, dibújala en tu archivo con canvas dentro de `k.dibujar` (helpers locales) o
   compón las que hay.
6. **Comentarios en español**, breves, como en los ejemplos: una línea por firma que diga qué se ve.
7. **Comprueba los tipos.** `npx tsc --noEmit` desde la raíz tiene que pasar sin errores. No arranques servidores
   ni el navegador: la revisión visual la hace quien te lo encarga.

## Herramientas
**Kit** (`k`, en `kit.ts`). Léelo entero, son 200 líneas.
- **Geometría**: `dist`, `dir`, `perp`, `angle`, `punto(t, lado)`, `enCuerpo(g, k)`, `alrededor(c, r, a)`,
  `haciaV(n, lado)`, `s(f)`, `porPotencia(flojo, fuerte)`, `posSprite(g)` (centro actual del sprite, con lo que lo
  hayan movido), `acierta`, `critico`.
- **Fases**: `esperar(ms)`, `anticipar(ms)`, `recuperar(desde, ms)`, `cargar(ms)`, `cargaEpica()`,
  `impacto(extra)`, `despues()`, `estado()`.
- **Gestos del sprite**: `embestida({hasta, ida, vuelta, arco, estela})`, `saltar(sprite, alto, ms)`,
  `agitar(sprite, px, ms)`, `girar(sprite, vueltas, ms)`, `animar(sprite, fotogramas, ms, easing)` (CSS
  `translate(Xpx, Ypx) scale(a, b) rotate(Ndeg)`, y `{opacity}` en su canal), `sombra(sprite, desplaza, color)`,
  `destello(sprite)`. Los sprites son `k.user.sprite` y `t.sprite`.
- **Dibujo**: `emit(spec)`, `burst(n, f)`, `add(effect)`, `dibujar(ms, (ctx, t, engine) => …)` (un efecto propio
  dibujado en canvas en coordenadas de escenario; `engine.glow(color)` da un sprite de luz) y
  `proyectil(ms, cada, {arco, lado, ease})`.

**Partículas** (`ParticleSpec`, `../fx/engine.ts`): `x, y, vx, vy, ax, ay, drag, life, delay, size, sizeEnd, color,
alpha, fadeIn, shape, rot, spin, stretch, accent`. Las `shape`:
- `glow`: luz.
- `dot`.
- `streak`: línea según la velocidad.
- `shard`: triángulo que gira.
- `rock`.
- `leaf`.
- `smoke`.
- `star`.
- `bubble`.
- `drop`: gota.
- `chevron`.
- `heart`.

**Efectos `E`** (`../fx/fx/effects.ts`):
- `ring`, `flash`, `charge`, `beam`, `bolt` (rayo entre dos puntos), `slash` (tajo curvo), `starburst`, `bloom`,
  `shield`.
- `sweep` (frente de onda, con `rotate`), `panel`, `spotlight`, `cracks` (grietas en el suelo), `sparks`.
- `torrent` (chorro), `vines` (lianas), `dim` (oscurece la vista menos un círculo), `sunbeam` (luz desde arriba).
- Además: `fireBurst`, `dust`, `whirl`, `drainOrbs`, `flames`, `elementalImpact`, `elementalTrail`.

**Paletas**: `TYPE_FX[tipo]` = `{core, glow, hot, dark}` (los tipos en inglés: `Fire`, `Water`…), `NEUTRAL_FX`,
`withAlpha`, `mix`.

**Formas** (`formas.ts`, se ven en `?galeria&formas`):
- Lista: `puno`, `mano`, `pie`, `garras`, `rueda`, `cuerno`, `pico`, `taladro`, `aguja`, `ala`, `pluma`, `hoja`,
  `gota`, `estrella`, `rayo`, `copo`, `nota`, `z`, `ojo`, `fantasma`, `espada`, `martillo`, `luna`, `corazon`,
  `espiral`, `escudo`.
- `forma(ctx, nombre, x, y, tam, angulo, estilo, espejo)`. El estilo es
  `{ base (color o (ctx) => degradado en coordenadas unidad −1…1), claro, oscuro, borde, grosor, brillo, brilloTam,
  alpha, mezcla }`.
- `mandibula(ctx, x, y, tam, apertura 0-1, estilo)` dibuja colmillos que se cierran.
- `contorno(nombre, n)` da puntos del borde en unidades; con `aEscena(u, x, y, tam, angulo)` pasan a escenario
  (sirve para soltar llamas por el borde de un puño).

## Ejemplos ya hechos (cópiales el estilo)
- `elementos.ts`: `ember` (sutil), `flamethrower` (fuerte), `firepunch` (forma rellena de fuego con llamas en el
  borde) y `flamewheel` (forma que sigue al sprite mientras embiste).
- `mente.ts`: `bite` (mandíbulas que se cierran justo en el impacto).
