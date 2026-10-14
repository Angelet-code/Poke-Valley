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
Los mapas son cerrados y están en estilo dibujo (elementos Klein). Por ahora hay dos.
- **Pueblo**: el mapa `dibujo` de siempre. En él solo estás tú y los Pokémon que has capturado, que pasean por la
  plaza. El camino del sur lleva al bosque.
- **Bosque**: es procedural y se genera de nuevo cada vez que entras (con la semilla de la partida).
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
- **Enfriamientos**:
  - Hay un global de 1,1 s y otro propio de cada movimiento, que crece con la potencia: Placaje 1,1 s, Hoja
    Afilada ~2 s, Rayo Solar ~6,5 s.
  - Los de estado tardan 8 s, los que causan un estado 12 s y los de curar 14 s.
  - La casilla se oscurece mientras se recarga.
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
  - **Quemado** (12 s): hace la mitad de daño físico y pierde 1/16 de su vida por turno.
  - **Paralizado** (12 s): se mueve a la mitad de velocidad (tú y los salvajes) y el 25 % de las veces no ataca.
  - **Envenenado** (12 s): pierde 1/8 por turno.
  - **Gravemente envenenado** (12 s): pierde 1/16, luego 2/16, 3/16… cada turno.
  - **Dormido** (4 s): ni se mueve ni ataca.
  - **Congelado** (4 s): ni se mueve ni ataca y se queda quieto en su fotograma. Un ataque de Fuego lo descongela y
    con sol no se congela.
  - Las inmunidades de tipo se respetan: Veneno y Acero no se envenenan, Fuego no se quema, Eléctrico no se
    paraliza y Hielo no se congela.
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
- **Temple de cada salvaje** (sale al azar):
  - **Tranquilo** (25 %): no pelea nunca; al pegarle se aparta un momento.
  - **Asustadizo** (35 %): al pegarle huye unos segundos.
  - **Peleón** (40 %): al pegarle te persigue y ataca con su movimiento listo más fuerte (a veces con uno de
    estado). Si se aleja más de 330 px de su sitio, vuelve y se cura (correa).
  - Nadie ataca sin que le peguen primero.
- **Vida**: fuera de combate (6 s sin recibir daño) se recupera un 5 % por segundo. Las bayas curan: Aranja 30 %,
  Zidra 50 %.
- **Debilitarse**: vuelves al pueblo con la vida entera, sin otra penalización.

## 4. Captura
- La Poké Ball se lanza al objetivo hasta 150 px. Vuela, el Pokémon entra, la Ball se mueve tres veces y se queda
  dentro o sale.
- Probabilidad = `atrapa` de la especie × multiplicador de la Ball × (1 − ⅔ · vida actual / vida máxima) × 1,5
  si está dormido, paralizado o congelado × 1,25.
  - `atrapa` está en `data/especies.ts`, entre 0,1 y 0,6.
  - Las Balls multiplican así: Poké ×1, Super ×1,5, Ultra ×2; la Master no falla.
  - A vida llena, la probabilidad es un tercio de la que tiene casi debilitado.
- Si sale de la Ball, reacciona según su temple (huye o te ataca).
- Si se queda, entra en tu equipo con su nivel y su vida y aparece en el pueblo.
- Empiezas con 10 Poké Balls y 3 Bayas Aranja. Los derrotados a veces sueltan bayas o Balls.

## 5. Niveles y movimientos
- **Experiencia**: b·L/7, donde b ≈ stats base totales / 5 (Bulbasaur 64, la oficial). Los grupos de experiencia
  son los oficiales (`data/pokedex.ts`).
- **Aprendizaje por nivel**: es el de Escarlata/Púrpura, o el de la última generación que lo tenga. Lo genera
  `tools/datos_combate.mjs` desde Pokémon Showdown en `src/data/gen/combate.json`.
- **Empiezas** con Bulbasaur a nivel 1 y solo su ataque básico, Placaje. El ataque básico es el primer movimiento
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
- Cuando hagan falta más animaciones, se añaden en el catálogo como en Colleja.

## 8. Pendiente
- Los movimientos con efectos especiales (Velo Sagrado, Deseo, Protección, Pantallas, climas…) solo se animan; no
  hacen nada todavía.
- No hay tiempo de lanzamiento (casts): todo es instantáneo con enfriamiento.
- No hay tienda de Balls; solo se consiguen de botín.
- Faltan sonido y música.
- Equilibrio: duración de las peleas, vida de los salvajes y ritmo de niveles.
- Más mapas (cueva, lago…) y jefes.
