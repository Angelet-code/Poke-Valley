# Pokémon Valley · modo aventura (combate en tiempo real)

Cambio de dirección del 2026-10-14. El juego pasa a ser un "WoW PvE" de Pokémon muy simplificado. Manejas a un
Pokémon, peleas en tiempo real con los salvajes, los capturas y luego puedes convertirte en ellos. El juego de
antes (pueblo con aldeanos, cultivos y construcción) sigue en `?modo=granja`.

Código:
- [src/scenes/Aventura.ts](../src/scenes/Aventura.ts): mapa, control, IA, combate y captura.
- [src/scenes/HudAventura.ts](../src/scenes/HudAventura.ts): el HUD.
- [src/combate/](../src/combate/): reglas, partida y sprites.
- [src/data/bosque.ts](../src/data/bosque.ts): los mapas.
- [src/fx/](../src/fx/): las animaciones.

## 1. Bucle
Sales del pueblo al bosque y eliges a un salvaje. Lo atacas con la barra, lo debilitas y lo capturas o lo derrotas
para ganar experiencia. Al subir de nivel aprendes movimientos y evolucionas. Los capturados se van al pueblo, y
allí puedes convertirte en cualquiera de ellos para subirlo de nivel.

## 2. Mapas
Las zonas (pueblo, Bosque Verde y Lago Celeste), cómo se conectan y el arte que falta están en
[GDD-mundo.md](GDD-mundo.md). Los mapas son cerrados y están en estilo dibujo (elementos Klein).
- **Pueblo**: el mapa `dibujo` de siempre. En él solo estás tú y los Pokémon que has capturado, que pasean por la
  plaza. El camino del sur lleva al bosque.
- **Bosque**: es procedural y sale siempre igual (con la semilla de la partida).
  - Lo cierra un borde espeso de árboles.
  - Dentro hay 6-7 claros unidos por senderos de tierra que salen de la entrada (abajo), árboles sueltos, rocas,
    arbustos, tocones, flores y, a veces, un estanque.
  - Salen 7 especies al azar de `ESPECIES_BOSQUE`, con 2-3 salvajes por claro.
  - El nivel sube con el orden de lejanía del claro: 1-2 en el de la entrada y unos 7-8 en el del fondo.
  - Un salvaje derrotado o capturado vuelve a salir en su sitio a los 40 s.
- Los mapas se cambian andando hasta la salida (fundido y `scene.restart`). Al debilitarte vuelves al pueblo.

## 3. Combate
- **Objetivo**: se elige con clic en un Pokémon o con Tab (el salvaje más cercano y, al repetir, el siguiente).
  Si no tienes ninguno, un movimiento apunta solo al más cercano. Esc quita el objetivo.
- **Barra de atajos**: 10 casillas (teclas 1-0) con movimientos u objetos.
  - Se colocan al gusto con el panel K: clic en un movimiento u objeto y luego en una casilla, o su tecla.
  - Clic derecho en una casilla la vacía.
  - Cada Pokémon tiene su propia barra.
  - Al aprender un movimiento, este va a la primera casilla libre.
- **Enfriamientos y lanzamientos**: global de 1,1 s; cada movimiento es instantáneo, lanzado o canalizado y tiene
  su enfriamiento según el modelo de §3.2 (`perfil()` en `reglas.ts`). Todo se acorta con la celeridad (Velocidad).
  La casilla se oscurece mientras se recarga.
- **Alcance**: 30 px para los de contacto y 150 px para el resto. El número de la casilla se pone rojo si el
  objetivo está lejos.
- **Fórmulas oficiales**:
  - Stats a nivel con IV 15 y sin esfuerzo.
  - Daño de la Gen. V+ con STAB, eficacia de tipos (tabla de Showdown), críticos, aleatorio de 0,85 a 1 y
    precisión con etapas.
  - Los multigolpe suman sus golpes.
  - Absorber cura, el retroceso daña y Quemado reduce a la mitad el daño físico.
- **Estados en tiempo real**: hacen lo de los juegos, con un "turno" de 3 s (`reglas.ts`). Son debufos con
  duración, como en un MMO.
  - **Quemado** (30 s): hace la mitad de daño físico y pierde 1/16 de su vida por turno.
  - **Paralizado** (30 s): se mueve a la mitad de velocidad (tú y los salvajes) y el 25 % de las veces no ataca.
  - **Envenenado** (24 s): pierde 1/8 por turno.
  - **Gravemente envenenado** (21 s): pierde 1/16, luego 2/16, 3/16… cada turno.
  - **Dormido** (4 s): ni se mueve ni ataca.
  - **Congelado** (4 s): ni se mueve ni ataca y se queda quieto en su fotograma. Un ataque de Fuego lo descongela y
    con sol no se congela.
  - Las inmunidades de tipo se respetan: Veneno y Acero no se envenenan, Fuego no se quema, Eléctrico no se
    paraliza y Hielo no se congela.
  - **Drenadoras** (21 s, no es un estado: convive con uno): cada turno quita 1/8 de la vida y se la cura a quien la
    sembró. A los de Planta no les prende. El sembrado lleva el debufo `DRE` (rojo), tinte verdoso y hojitas; quien
    sembró, el bufo `DRE` (verde); en cada turno vuelan orbes verdes del uno al otro (`fx/estados.ts`, `drenaje`).
  - **Se ven mientras duran** (`fx/estados.ts`):
    - Tinte del sprite: rojizo, amarillo con chispazos, morado o azul.
    - Una ráfaga cada 0,7 s: llamitas, chispas, burbujas o destellos de hielo; dormido, "z".
    - Iconos en los marcos y en las placas (ver Bufos y debufos).
  - Los cambios de stats duran 15 s, con un máximo de ±6.
- **Bufos y debufos** (como en el WoW):
  - **Bajo tu marco y el del objetivo**: un icono por estado o cambio de stats. Lleva color (estado; verde si sube,
    rojo si baja), abreviatura ("QUE", "PAR", "At+2", "Df-1"…) y una barra que se vacía con lo que le queda. Al pasar
    el ratón sale su ficha con lo que hace.
  - **Sobre los salvajes** (y sobre ti): un cuadradito de su color encima de la barra de vida.
- **Clima** (Danza Lluvia, Día Soleado, Tormenta Arena, Paisaje Nevado, Granizo): cambia el clima de todo el mapa
  durante 40 s.
  - **Se ve todo el rato**: es la capa de clima de Colleja (`fx/fx/weather.ts`), en su propio canvas y más densa,
    con salpicaduras de lluvia. Además tiñe la luz del mapa.
  - **El HUD** lo enseña bajo el reloj con los segundos que le quedan.
  - **Efectos, los de los juegos**:
    - Lluvia: Agua ×1,5 y Fuego ×½.
    - Sol: Fuego ×1,5 y Agua ×½.
    - Arena: Def. Esp. ×1,5 a los de Roca, y 1/16 por turno a quien no sea Roca, Tierra ni Acero.
    - Nieve: Defensa ×1,5 a los de Hielo.
    - Granizo: 1/16 por turno a quien no sea de Hielo.
    - Trueno y Vendaval no fallan con lluvia (con sol, 50 %); Ventisca no falla con nieve o granizo.
    - Síntesis, Luz Lunar y Sol Matinal curan 2/3 con sol y 1/4 con otro clima.
- **Sombras y pies**: los fotogramas PMD van centrados en el cuerpo, con los pies unos px por debajo del centro.
  `sprites.ts` mide los pies de cada especie en su Idle (`ancla`) y `poner()` pone el origen ahí en cada animación.
  Antes era un 0,72 fijo: Pikachu flotaba sobre su sombra y saltaba al atacar. El alto del cuerpo y el ancho de la
  sombra también salen de esa medida. Pendiente: los que vuelan (Zubat, Gastly) deberían tener la sombra algo
  separada; haría falta su `Shadow.png` de SpriteCollab.
- **Naturaleza de cada salvaje** (2026-10-15; sustituye al temple Tranquilo/Asustadizo/Peleón): sale al azar entre
  las 25 (`combate/naturalezas.ts`) y decide su reacción según tu nivel frente al suyo: **igual** (±1), **fuerte**
  (tú 2 o más por encima) o **débil** (tú 2 o más por debajo). La placa del objetivo dice su naturaleza y qué hará
  contigo, con el color (rojo ataca, amarillo huye, verde se deja). El alfa siempre pelea.
  - Reacciones: **Acecha** (te ataca si pasas a menos de 70 px), **Se defiende** (ataca si le pegas), **Llama**
    (ataca si le pegas y se suman los salvajes a menos de 120 px que no huyan ni se queden quietos), **Aguanta** (el
    primer golpe lo encaja; al segundo pelea), **Acorralado** (huye; con menos de la mitad de PS, al pegarle se da la
    vuelta y pelea), **Huye** (si le pegas, 4-6 s), **Huye al verte** (huye si pasas a menos de 90 px, aunque no le
    pegues), **Quieto** (ni huye ni pelea).
  - Al pelear te persigue y ataca con su movimiento listo más fuerte (a veces con uno de estado). Si se aleja más de
    330 px de su sitio, vuelve y se cura (correa).
  - Probar una sola: `?natu=firme` (id sin tildes) hace que todos los salvajes del mapa la tengan.

  | Naturaleza | Igual (±1) | Tú más fuerte (+2) | Tú más débil (−2) |
  |---|---|---|---|
  | Fuerte | Se defiende | Se defiende | Acecha |
  | Huraña | Se defiende | Huye al verte | Acecha |
  | Firme | Se defiende | Se defiende | Acecha |
  | Pícara | Acecha | Acorralado | Acecha |
  | Audaz | Acecha | Se defiende | Acecha |
  | Osada | Aguanta | Aguanta | Se defiende |
  | Dócil | Quieto | Huye | Aguanta |
  | Plácida | Quieto | Quieto | Aguanta |
  | Agitada | Se defiende | Acorralado | Acecha |
  | Floja | Quieto | Huye | Quieto |
  | Miedosa | Huye | Huye al verte | Acorralado |
  | Activa | Acecha | Huye al verte | Acecha |
  | Seria | Se defiende | Llama | Se defiende |
  | Alegre | Se defiende | Acorralado | Acecha |
  | Ingenua | Acecha | Acecha | Se defiende |
  | Modesta | Aguanta | Huye | Se defiende |
  | Afable | Aguanta | Acorralado | Se defiende |
  | Mansa | Quieto | Aguanta | Aguanta |
  | Tímida | Huye al verte | Huye al verte | Aguanta |
  | Alocada | Acecha | Se defiende | Acecha |
  | Serena | Aguanta | Aguanta | Quieto |
  | Amable | Quieto | Acorralado | Quieto |
  | Grosera | Llama | Llama | Acecha |
  | Cauta | Aguanta | Llama | Se defiende |
  | Rara | al azar | al azar | al azar (fijas mientras vive) |

  Con nivel igual, solo 2 de 25 huyen (antes, el 60 %), y uno de ellos (Tímida) ya al verte; si eres mucho más
  fuerte, 7 huyen (4 al verte) y 5 se acorralan.
- **Vida**: fuera de combate (nadie te persigue, 6 s sin pegar ni recibir y sin quemadura ni veneno) se recupera un 5 % por segundo. Las bayas curan: Aranja 30 %,
  Zidra 50 %.
- **Debilitarse**: vuelves al pueblo con la vida entera, sin otra penalización.

### 3.2 Balance de movimientos (2026-10-15; fases 1 y 2 hechas)
Estudio: `node tools/balance_movimientos.mjs` clasifica los 389 movimientos y escribe
[balance-movimientos.md](balance-movimientos.md) (ahora / propuesta, movimiento a movimiento).

**Diagnóstico.** Con el global de 1,1 s, usar Lanzallamas cuando está listo y Ascuas el resto ya rinde más que solo
Ascuas (≈49 frente a 39 de potencia/s). El problema no es el número sino que **no hay decisión**: todo es instantáneo,
a un objetivo, y el enfriamiento solo crece con la potencia. Rotación de 1 botón más "pulsa el grande cuando brille".

**Modelo: presupuesto de potencia por segundo.** Cada movimiento "paga" su potencia efectiva
(potencia × golpes × precisión, +cura de Absorber, −retroceso, +efecto secundario) con tiempo:
- Un **instantáneo** da gratis 36 de potencia/s (el relleno: Placaje, Ascuas, Pistola Agua).
- **Lanzar quieto** (barra de lanzamiento; moverse lo cancela) da un 25 % más: 45/s. El tiempo de lanzamiento sale de
  la potencia (1,5-3 s).
- Lo que sobra se paga con **enfriamiento**: 6 de potencia por segundo de CD.
- Resultado: la potencia/s de cualquier rotación queda entre 36 y 50 (ahora 36-59) y cada tipo de movimiento tiene
  su papel: instantáneos para moverse y rematar, lanzados para quedarse quieto, los de CD para abrir.

**Cómo se lanza cada uno** (de los datos de Showdown, sin escribirlo a mano):
- **Instantáneo**: contacto (el cuerpo a cuerpo ya paga acercándose), prioridad, los que hacen retroceder y los
  flojos (≤ 46). Los fuertes de contacto llevan CD: Puño Fuego 6 s.
- **Lanzado**: los de distancia fuertes. Lanzallamas 2 s, Hidrobomba 1,9 s, Onda Ígnea 1,9 s.
- **Carga** (`charge`): Rayo Solar 2,6 s.
- **Canalizado**: multigolpe y drenaje a distancia (Gigadrenado, Megaagotar): daño por tics mientras no te muevas.
- **Desaparece**: Vuelo, Excavar, Buceo, Golpe Fantasma: 1,5 s invulnerable y cae sobre el objetivo.
- **Agotado**: Hiperrayo y similares, instantáneo enorme y luego 2 s sin poder actuar.

**Forma (a quién pega)**, de `target`:
- **Objetivo** (272): como ahora.
- **Zona** (`allAdjacentFoes`, 19): círculo de ~40 px donde apuntes con el ratón (alcance 150), como Ventisca del WoW.
- **Cono** (los de viento, 5): delante de ti.
- **Alrededor** (`allAdjacent` y los de sonido, 13): círculo en torno a ti, instantáneo con CD (Terremoto 10 s).
- **Trampa** (`foeSide`: Púas, Trampa Rocas): zona que se queda en el suelo.
- Si un área toca a más de uno, cada golpe ×0,75 (la regla oficial de los dobles).

**Utilidad** (lo que hace además, también de los datos):
- Prioridad + contacto (Ataque Rápido, Acua Jet): **carga** hasta el objetivo, CD ≥ 6 s.
- Retroceso (Mordisco, Golpe Cabeza): **interrumpe** un lanzamiento del objetivo.
- `selfSwitch` (Ida y Vuelta, Voltiocambio): golpea y **salta atrás**.
- Protección, Detección, Aguante: **escudo** 1,5 s, CD 15.
- Teletransporte: **salto** de 120 px.
- Subir Velocidad (Agilidad, Danza Dragón): **más velocidad de movimiento y celeridad** durante el bufo.
- Dormir: lanzado 1,5 s, CD 20 (control). Curas: lanzadas 1,5 s, CD 20.

**Stats en todo esto**:
- Ataque / At. Esp. y defensas: ya están en la fórmula de daño.
- **Velocidad → celeridad** (el *haste* del WoW): acorta el global, los lanzamientos y los CD.
  `celeridad = 0,8 + 0,4 · min(Vel base, 150) / 150` (Shuckle 0,81, Snorlax 0,88, Pikachu 1,04, Ninjask 1,2),
  × la etapa de Velocidad, con tope ×1,5.
- **Velocidad → movimiento**: `84 px/s · (0,9 + 0,2 · Vel base / 150)` × etapa (tope ×1,5).
- Así el lento pega fuerte y el rápido pega a menudo, como en los juegos.
- Los salvajes siguen las mismas reglas: lanzan con barra visible y se les puede interrumpir.

**Fases**:
1. ✔ `perfil(m)` en `reglas.ts` (lanzamiento, tiempo, CD, tics, interrumpe, agotado), `celeridad()` y `velAndar()`.
   La ficha del movimiento (barra o panel K) dice cómo se lanza y lo que tarda con tu celeridad.
2. ✔ Lanzamientos en `mundo.ts` (`Luchador.lanza`, `pasoLanza`, `soltar`, `cortarLanza`):
   - El global empieza al pulsar; el enfriamiento, al soltarlo (en los canalizados, al empezar).
   - Moverte corta lo que lanzas; dormirte o congelarte también. Si al acabar el objetivo está fuera de alcance
     (+20 px), no sale.
   - Canalizado: el golpe se reparte en tics (los golpes del multigolpe o tercios del drenaje); el efecto secundario,
     solo en el primero.
   - Interrumpir: un golpe que hace retroceder corta el lanzamiento y ese movimiento tarda 4 s en volver.
   - Agotado (Hiperrayo): 2 s sin moverse ni actuar.
   - Los salvajes lanzan igual (se quedan quietos) y se ven en las fotos del multijugador (`ln`).
   - HUD: tu barra encima de la de atajos (naranja si se llena, verde si canalizas; la piedra de hogar, azul), la del
     objetivo bajo su marco y una línea fina bajo la vida de cada salvaje que lanza.
3. Áreas: retícula con el ratón, alrededor, cono, trampas; IA de los salvajes.
4. Utilidad: carga, salto atrás, escudo, salto, velocidad.
5. Hace falta exportar más datos en `tools/datos_combate.mjs` (`volatileStatus`, `sideCondition`, `selfdestruct`)
   para Drenadoras, Giro Fuego (atrapar) y Autodestrucción.

## 4. Captura
- La Poké Ball se lanza al objetivo hasta 150 px. Vuela, el Pokémon entra, la Ball se mueve tres veces y se queda
  dentro o sale.
- Probabilidad = `atrapa` de la especie × multiplicador de la Ball × (1 − ⅔ · vida actual / vida máxima) × 1,5
  si está dormido, paralizado o congelado × 1,25.
  - `atrapa` está en `data/especies.ts`, entre 0,1 y 0,6.
  - Las Balls multiplican así: Poké ×1, Super ×1,5, Ultra ×2; la Master no falla.
  - A vida llena, la probabilidad es un tercio de la que tiene casi debilitado.
- Si sale de la Ball, reacciona según su naturaleza (§3, Naturaleza).
- Si se queda, entra en tu equipo con su nivel y su vida y aparece en el pueblo.
- Empiezas con 10 Poké Balls y 3 Bayas Aranja. Los derrotados a veces sueltan bayas o Balls.

### 4.1 Shiny (2026-10-15)
- Cada salvaje que aparece (también el alfa) tiene 1/4096 de salir shiny (`PROB_SHINY` en `combate/partida.ts`;
  en la consola, `pv.scene.getScene('aventura').probShiny = 1` para probar).
- Al entrar en pantalla destella (estrellas) y sale el aviso «¡Un X shiny!».
- Capturado, el shiny va con el Pokémon (`Miembro.shiny`), no con la forma: sigue siéndolo al evolucionar, en la
  cinemática y en el pueblo.
- Sprites: id de sprite con `s` (`0262s`). Hojas shiny de SpriteCollab en `assets/sprites/pokemon/<dex>/shiny/`
  (`python -I tools/shiny_paletas.py` las baja y escribe `src/data/gen/shiny.json`); las 5 que no existen se sacan
  recoloreando la normal con la paleta de su Idle. El contorno de la -Luz se tiñe al cargar (`combate/sprites.ts`).

## 5. Niveles y movimientos
- **Experiencia**: b·L/7, donde b ≈ stats base totales / 5 (Bulbasaur 64, la oficial). Los grupos de experiencia
  son los oficiales (`data/pokedex.ts`).
- **Aprendizaje por nivel**: es el de Escarlata/Púrpura, o el de la última generación que lo tenga. Lo genera
  `tools/datos_combate.mjs` desde Pokémon Showdown en `src/data/gen/combate.json`.
- **Elección del compañero** (`scenes/Eleccion.ts`): al crear partida salen 9 Pokémon al azar, de 9 tipos distintos,
  en su primera forma, de líneas de 3 fases (de 2 si el tipo no tiene ninguna; nunca uno que no evolucione) y ninguno
  ultra raro (las rarezas de los biomas y los pseudolegendarios); siempre 2 o 3 de
  ellos son iniciales de cualquier generación (`INICIALES` en `data/pokedex.ts`, que no salen como salvajes). Solo se
  ven sus siluetas; se sabe cuál es al elegirlo, sin vuelta atrás.
- **Empiezas** con él a nivel 1 y solo su ataque básico (Placaje en Bulbasaur). El ataque básico es el primer movimiento
  de daño que aprende. Los demás movimientos de nivel 1 se aprenden al llegar a nivel 2.
- **Un capturado** sabe su básico y todo lo de su nivel.
- **Evolución**: a los niveles de `data/pokedex.ts`. Cambian el sprite y los stats y aprende lo nuevo de su forma.
  - Es una cinemática (`src/scenes/Evolucion.ts`): el juego se para (Aventura y HUD en pausa; el tiempo parado no
    cuenta para enfriamientos ni estados), franjas de cine, fondo oscuro teñido del tipo, el Pokémon sube al centro y
    el diálogo de abajo dice "¿Eh? ¡X está evolucionando!". Se vuelve blanco, las siluetas de la forma vieja y la
    nueva se alternan cada vez más deprisa, estalla la luz (aquí salen los rayos) y aparece la forma nueva con
    fanfarria. Luego "¡Enhorabuena!…" con la ficha de stats (antes / ahora / +) y un mensaje por movimiento
    aprendido. Se avanza con F, espacio, Intro o clic.
  - Duración hasta el «¡Enhorabuena!»: de 15 s (nivel 1) a 30 s (nivel 50 o más), lineal con el nivel al que
    evoluciona (`DURA_MIN`, `DURA_MAX`).
  - Cada tipo tiene su coreografía y su estallido (`src/fx/efectosTipo.ts`; formas en `src/fx/particulasTipo.ts`):
    anillo de llamas (Fuego), relámpagos del cielo (Eléctrico), tornado de hojas (Planta), ventisca y esquirlas
    (Hielo), gotas en órbita y ondas (Agua), líneas de velocidad y pulsos (Lucha), charco y burbujas que revientan
    (Veneno), temblor y grietas (Tierra), corrientes de viento (Volador), levitación y anillos (Psíquico), enjambre
    (Bicho), rocas en órbita que salen disparadas (Roca), fuegos fatuos y el Pokémon que se desvanece (Fantasma),
    aura y columna de energía (Dragón), sombras desde los bordes y ojos rojos (Siniestro), brillo metálico y placas
    (Acero), corazones y espiral de estrellas (Hada), estrellas (Normal). Con dos tipos, los dos. Si gana o cambia
    de tipo, el nuevo empieza a mitad (al empezar las siluetas) y el que pierde se acaba en el estallido.
  - Sonido sintetizado con Web Audio (`src/fx/sonidoEvolucion.ts`): zumbido creciente, campanitas, truenos, golpes,
    explosión y fanfarria.

## 6. Pueblo y cambiar de Pokémon
Tus otros Pokémon pasean por la plaza. Con F a su lado te conviertes en él e intercambiáis el sitio. El que dejas
se queda paseando con su vida guardada. Cada uno conserva su nivel, su experiencia, sus movimientos y su barra.

**Piedra de hogar** (como en el WoW): tecla H o clic en su casilla, a la izquierda de la barra. Se canaliza 8 s
(barra de lanzamiento azul sobre la barra de atajos); moverte, recibir un golpe, usar un atajo, F o Esc la cortan.
Al terminar te lleva a la plaza del pueblo desde cualquier zona. Se recarga en 5 min reales (se guarda en la
partida, `Estado.hogar`, así que salir y volver no la reinicia). Constantes `HOGAR_CARGA` y `HOGAR_CD` en
`src/combate/partida.ts`.

## 7. Animaciones de los movimientos
Son las de **Pokémon Colleja**, copiadas en `src/fx/`.
- Ficheros: `catalog.ts`, `templates.ts`, `elements.ts`, `motions.ts` y `fx/engine.ts`, `fx/effects.ts` y
  `fx/palette.ts`.
- Cada movimiento resuelve una plantilla (golpe, orbe, chorro, rayo, relámpago, onda, terremoto…) por firma, por
  forma o por tipo.
- Las partículas y efectos se pintan con Canvas 2D en un `<canvas>` encima del de Phaser.
- Cambios para el juego:
  - `fx/stage.ts` sustituye al escenario DOM de Colleja. Las coordenadas son px de mundo × zoom y el canvas sigue
    a la cámara (`engine.offset`). El reloj lo mueve el bucle del juego (`engine.external`).
  - Los movimientos del sprite (fotogramas CSS translate, scale y rotate) se aplican a un `FxSprite` que la escena
    suma al dibujar. La silueta blanca del golpe es `setTintFill`.
  - Los rótulos ("Supereficaz", daño, "+1 Atq") son textos de Phaser.
  - Los efectos de pantalla completa (destello, Espacio Raro, velo) se pintan en la vista, y la onda (Surf) barre
    hasta el objetivo, no hasta el borde.
- Vista desde arriba (2026-10-14, revisión tras ver Tornado):
  - Colleja suponía un escenario de lado: el atacante abajo a la izquierda, el rival arriba a la derecha y la parte
    de arriba del escenario como cielo.
  - **Onda** (Tornado, Golpe Aéreo, Onda Ígnea, Ácido, Nieve Polvo…): avanza por el eje atacante → objetivo, en
    cualquier dirección, en una franja que se abre hasta el objetivo. En Colleja cruzaba la pantalla de lado a lado
    y repartía el viento por toda su altura. `sweep` admite `rotate`. Viento y ventisca acaban en un remolino
    alrededor del objetivo.
  - **Cuchillas** (Hoja Afilada, Aire Afilado): las tres van una al lado de otra, cruzando su camino, y cada una
    lleva una hoja o esquirla que gira.
  - **Lo que cae del cielo** (Avalancha, Trueno, Erupción, Salpicar) y los focos de luz (Rayo Solar, Señuelo): salen
    del borde de arriba de la vista. Antes salían de y = 0 del mapa.
  - **Movimientos de lado** (Viento Afín, Trampa Rocas, Reflejo): se centran en el usuario o en el objetivo, no en
    el centro de la pantalla.
  - **Después de un golpe**, la animación pinta las flechas de stats (+1/−1) y el efecto de cada estado (sueño,
    veneno, quemadura…). Para ello `Aventura.efectos` decide antes de animar qué cambios habrá y los pasa en el
    `cue`; `stage.slot()` da la posición de cada luchador.
  - Los polvos de estado y los orbes de los movimientos de estado son más gruesos, porque se perdían sobre el
    césped claro.
  - `ESCALA_FX = 1,4` (`fx/stage.ts`): grosores, partículas y recorridos se ven ×1,4 respecto a Colleja, sin mover
    nada de sitio.
  - **Sacudida de cámara** (`shakeFor` en `templates.ts`): va con la potencia del movimiento, no con la vida que se
    pierde como en Colleja. Ahí, a nivel bajo, un Placaje quitaba un tercio y cada golpe sacudía la pantalla.
    - Medido: Placaje ~1 px, Golpe Cuerpo ~2,6, Terremoto ~6, Hiperrayo ~7,5.
    - Un crítico suma unos 2 px y un supereficaz, algo menos.
- **Galería** (`?galeria`, `scenes/Galeria.ts`): dos Pokémon y el movimiento elegido una y otra vez.
  - ← → cambia de movimiento; empieza por uno de cada plantilla:estilo, 92 de 389.
  - ↑ ↓ cambia la dirección y 1-9 la distancia.
  - A los pasa todos seguidos.
  - Sirve para revisar cada animación vista desde arriba.
- El daño se aplica en el impacto de la animación (`commit`); si no llega, a los 2,5 s.
- El efecto arranca en el fotograma de golpe (HitFrame) de la animación PMD (`Attack` para contacto, `Shoot` a
  distancia y `Charge` para estado).
- De noche, las partículas se suman como luz ("lighter").

### 7.1 Firmas: una animación propia por movimiento (2026-10-15)
Con las plantillas, muchos movimientos se veían iguales: Ascuas y Lanzallamas compartían `stream:fire`, 72 golpes
físicos iban con `strike:plain` y 33 de estado con `hex:plain`. El usuario pidió dos cosas:
- **Variedad**, según la potencia: Ascuas sutil, Lanzallamas fuerte.
- **Que cada movimiento se reconozca**: colmillos en Mordisco, una rueda de fuego en Rueda Fuego, un puño en cada
  puñetazo, y en Puño Fuego un puño hecho de fuego.

Cómo está montado (`src/fx/firmas/`):
- **`index.ts`**: `animarMovimiento(ctx)` usa la firma del movimiento si la tiene; si no, la plantilla. Lo llaman
  `Aventura` y la galería.
- **`kit.ts`**: lo que comparten todas las firmas.
  - Geometría atacante → objetivo en cualquier dirección.
  - Fases: anticipar, cargar, carga épica, impacto compartido (reacción, rótulos, daño, sacudida) y "después"
    (absorber, retroceso, flechas, estados).
  - Gestos del sprite: embestida, salto, temblor, giro, estela.
  - Dibujo libre en canvas.
- **`formas.ts`**: formas vectoriales reconocibles, que se ven todas en `?galeria&formas`.
  - Lista: puño, mano, pie, colmillos (`mandibula`, que se cierra), garras, rueda, cuerno, pico, taladro, aguja, ala,
    pluma, hoja, gota, estrella, rayo, copo, nota, z, ojo, fantasma, espada, martillo, luna, corazón, espiral y
    escudo.
  - Se pintan con estilo de dibujo animado (relleno, partes claras y oscuras, borde y brillo), a cualquier tamaño y
    ángulo.
  - Su contorno se puede muestrear para soltar partículas por el borde: es lo que hace el puño de fuego.
- **Un archivo por grupo de tipos**:
  - `normal_golpes`, `normal_estado`.
  - `mente` (Psíquico, Fantasma, Siniestro).
  - `naturaleza` (Planta, Bicho, Veneno).
  - `tierra` (Lucha, Roca, Tierra, Acero).
  - `elementos` (Fuego, Agua, Hielo, Eléctrico).
  - `cielo` (Volador, Hada, Dragón).
- **`LEEME.md`**: la guía para escribir firmas. Reglas:
  - Tiempo real: ≤ 900 ms, las épicas ≤ 1400.
  - Vista desde arriba: todo orientado con `k.dir`.
  - Escala relativa al Pokémon.
  - Menos de 250 partículas.
  - `k.impacto()` una vez en los de daño; `k.estado()` en los de estado.
- **Ejemplos de referencia**:
  - Ascuas: tres brasas.
  - Lanzallamas: chorro grueso con lenguas de llama y humo.
  - Puño Fuego: puño relleno de fuego, con llamas en el borde, que estalla.
  - Rueda Fuego: aro de llamas que gira alrededor del usuario mientras embiste.
  - Mordisco: mandíbulas oscuras que se abren y se cierran justo en el impacto.

Las 389 firmas del juego se reparten así:
- Normal (ataques): 46.
- Normal (estado): 55.
- Psíquico/Fantasma/Siniestro: 66.
- Planta/Bicho/Veneno: 59.
- Lucha/Roca/Tierra/Acero: 64.
- Fuego/Agua/Hielo/Eléctrico: 62.
- Volador/Hada/Dragón: 37.

Se revisan en la galería, también con hojas de "larga exposición": varios instantes de cada animación superpuestos.

Estado (2026-10-15): las 389 tienen firma. Las escribieron 7 agentes en paralelo, uno por grupo; Ciclón, que faltaba,
se añadió después.
- **Comprobación automática** de las 389 en la galería: ninguna da error, todas aplican el daño, duran ≤ 1,5 s,
  tienen menos de 300 partículas y dibujan algo.
- **Revisión visual** de todas, apuntando en diagonal.
- **Lanzallamas** tiene su propio cono de fuego. Antes usaba el chorro de agua (`E.torrent`), con espuma.
- **Reposo de los sprites** (`stage.reposar`, en `animarMovimiento`): al acabar cada movimiento, sus sprites vuelven
  a su sitio, como el `settle` de Colleja al final de cada turno. Antes, una animación que acababa fuera de sitio
  dejaba al Pokémon separado de su sombra.

## 8. Pendiente
- Los movimientos con efectos especiales (Velo Sagrado, Deseo, Protección, Pantallas, climas…) solo se animan; no
  hacen nada todavía.
- No hay tiempo de lanzamiento (casts): todo es instantáneo con enfriamiento.
- No hay tienda de Balls; solo se consiguen de botín.
- Faltan sonido y música.
- Equilibrio: duración de las peleas, vida de los salvajes y ritmo de niveles.
- Más mapas (cueva, lago…) y jefes.

## Sexo
Cada Pokémon es macho, hembra o sin sexo, con la proporción oficial de su especie (Showdown, `macho` en
`src/data/gen/combate.json`, que genera `tools/datos_combate.mjs`). Se tira al crearlo (`tirarSexo` en
`src/combate/partida.ts`), se guarda con él (`Miembro.sexo`) y el capturado conserva el del salvaje. En los marcos del
HUD sale un ♂ azul o un ♀ rosa en pixel art junto al nombre.

## Multijugador cooperativo (2026-10-15)
De 2 a 4 jugadores en la misma red, cada uno con su partida. Se juega con:
- `npm run mp`: el servidor (`tools/servidor_mp.mjs`, puerto 5190). Hace el WebSocket a mano, sin paquetes. Reenvía
  los mensajes a los demás jugadores de la sala, que es la ruta de la URL (por defecto "valle"), y apunta en qué orden
  ha llegado cada uno y la semilla de la sala.
- `npm run dev:red`: el juego abierto a la red. Cada jugador entra en `http://<ip>:5174/?mp=ws://<ip>:5190`.
- **Por internet desde este PC** (2026-10-15): `npm run mp` + `npm run online` (`vite.online.config.ts`, puerto 5185:
  sirve el juego y pasa el WebSocket por `/mp` al servidor; sin recarga automática) + un túnel rápido de Cloudflare,
  `%LOCALAPPDATA%\cloudflared\cloudflared.exe tunnel --url http://127.0.0.1:5185`, que da una dirección
  `https://….trycloudflare.com` (cambia cada vez que se abre). Los amigos entran en `https://…/?mp=sala` (`?mp` sola =
  sala "valle"). Para una dirección fija: túnel con nombre y el dominio en Cloudflare.

Cómo va (`src/combate/red.ts` + `mundo.ts` + `Aventura.ts`):
- **Verse.** Cada uno manda su estado 10 veces por segundo: mapa, posición, animación, estado, vida, forma y nivel.
  Los demás jugadores son luchadores con el rol `remoto` (`mundo.remotos`): se mueven suavizados, llevan una placa
  azul con su nombre y su barra de vida, no tienen IA y no se les puede atacar.
- **Mismos mapas.** Los mapas procedurales usan la semilla de la sala, que es la del primero que entró. Si te unes
  estando en uno, se rehace en el mismo sitio.
- **Manda el dueño del mapa.** En cada mapa, el jugador que lleva más tiempo en él lleva a los salvajes: su IA, su
  vida, sus muertes y sus reapariciones. Si dos llegan a la vez, manda el que entró antes en la sala. El dueño manda
  una foto de sus salvajes 10 veces por segundo (`foto`/`aplicarFoto`). Los demás los tienen en modo espejo
  (`espejo`): los dibujan tal como llegan y lo que les hacen se lo mandan al dueño (`Salida`). Cuando el dueño se va,
  manda el siguiente, con los salvajes donde estaban.
- **Cada uno manda en su Pokémon.** Un golpe a un remoto no se aplica aquí: se le manda y él se lo aplica
  (`recibirGolpe`). Pasa lo mismo con el golpe de un jugador a un salvaje del dueño.
- **Experiencia.** Al caer un salvaje, todos los que le hicieron daño (`golpeadores`) ganan su experiencia y su botín.
- **Captura.** Quien lanza la Ball tira la captura y avisa al dueño (`recibirBall`). Mientras está dentro, el salvaje
  no se mueve.
- **Clima y alfa.** El clima del mapa va en la foto. El golpe anunciado del alfa lo mira cada jugador en su pantalla.
- **Objetivo.** Tab y el clic eligen también a los demás jugadores (marco azul, "Otro jugador"). Fuera de un duelo no
  se les puede atacar.
- **Duelos** (como en WoW, `mundo.ts` § Duelos). R con otro jugador elegido le reta; él acepta con R o rechaza con Esc
  (el reto caduca a los 30 s; si os retáis a la vez, empieza). Cuenta atrás de 3 s y a pegarse: los golpes van por el
  camino de siempre (cada uno se aplica los suyos) y solo cuentan entre los dos del duelo. Nadie se debilita: el que
  llega a 1 PS pierde. Alejarse más de 300 px de donde empezó, cambiar de mapa o caer ante un salvaje es abandonar.
  Al acabar se quitan los estados y bufos del duelo. Sin experiencia ni premio, de momento.
- **Animaciones.** Cada uno reenvía a los demás los rótulos, los destellos, los movimientos, las Balls y las caídas,
  con los uids traducidos (`traducir`).

Falta: probar el golpe del alfa y el clima con dos jugadores, un indicador en el HUD de quién lleva el mapa, ver a
los vecinos del pueblo de los demás y entrar en la sala desde el título.
