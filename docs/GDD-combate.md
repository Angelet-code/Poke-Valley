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
    El panel va en tres columnas si cabe entre tu marco y la barra; con muchos movimientos pasa a cuatro o cinco, y si ni
    así cabe, la rueda del ratón lo recorre línea a línea (un rótulo abajo dice si hay más arriba o abajo).
  - Clic derecho en una casilla la vacía.
  - Cada Pokémon tiene su propia barra.
  - Al aprender un movimiento, este va a la primera casilla libre.
- **Inventario (I)** (`combate/objetos.ts`): como la pantalla del personaje del WoW, vertical y a la izquierda: tu
  Pokémon animado en el centro y sus **cinco ranuras** a los lados (`Miembro.objetos`, índice = ranura, `SLOTS`):
  Cabeza (Gafas Especiales, Periscopio), Cuerpo (Banda y Cinta Focus, Casco Dentado), Arma (Cinta Fuerte, Vidasfera,
  Cinta Experto), Amuleto (los 18 de tipo) y Accesorio (Restos, Campana Concha). Arriba, nombre, sexo,
  nivel y tipos; bajo el Pokémon, sus stats (en verde o rojo si ahora las tiene subidas o bajadas); debajo, los de la mochila.
  Clic en uno de la mochila para ponérselo en su ranura (el que había vuelve a la mochila); clic en uno
  de los suyos para quitárselo. No se cambian en combate.
  **Rareza**: cada objeto es común, raro (`<id>_r`, borde azul, efecto ×1,5 sobre el bonus) o épico (`<id>_e`, borde
  morado, ×2); mismo icono. P. ej. Vidasfera épica = ×1,6; Banda Focus épica se recarga en 30 s; Periscopio épico, +2 críticos.
  No se gastan. Solo se encuentran jugando: los alfas sueltan uno (45 % raro, 15 % épico) y, muy rara vez, un salvaje (22 % / 3 %).
  - Restos (1/16 cada 3 s en combate), Banda Focus (con la vida entera aguanta con 1 PS; se recarga en 60 s),
    Cinta Focus (10 %), Vidasfera (×1,3 y 1/10 por golpe), Cinta Fuerte y Gafas Especiales (×1,1), Cinta Experto
    (×1,2 supereficaz), Periscopio (+1 crítico), Campana Concha (1/8 del daño), Casco Dentado (1/6 al que toca) y
    uno por tipo (Carbón, Agua Mística…: ×1,2). Iconos de Pokémon Colleja (`assets/game/pixel/items/equipables/`).
- **Enfriamientos y lanzamientos**: global de 1 s (§3.4); cada movimiento es instantáneo, lanzado o canalizado y tiene
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
3. ✔ Áreas (2026-10-17; `formaArea` en `reglas.ts`, `lanzarArea` en `mundo.ts`, `pintarAreas` en `Aventura.ts`):
   - **Zona** (`allAdjacentFoes`): círculo de 40 px donde está el ratón al pulsar (hasta 150 px de ti; si no hay
     ratón, sobre el objetivo). Ventisca es zona aunque sea de viento (la del WoW).
   - **Cono** (los de viento): 90 px delante de ti, hacia el ratón, ±34°.
   - **Alrededor** (`allAdjacent` y los de sonido): 50 px en torno a ti; siempre instantáneos.
   - No hace falta objetivo. Toca a los enemigos de quien lo lanza (tú: salvajes y tu rival de duelo; un salvaje:
     los jugadores); con varios, cada golpe ×0,75. Una sola animación para todos (`mas` en el suceso `mov`).
   - En el suelo: mientras se lanza, la forma del área (del color del tipo; roja si es de un salvaje, para salir a
     tiempo) y un destello al pegar. Los salvajes las usan con su IA de siempre, apuntando a su rival.
   - Falta: trampas (`foeSide`: Púas, Trampa Rocas).
4. Utilidad: carga, salto atrás, escudo, salto, velocidad.
5. Hace falta exportar más datos en `tools/datos_combate.mjs` (`volatileStatus`, `sideCondition`, `selfdestruct`)
   para Drenadoras, Giro Fuego (atrapar) y Autodestrucción.

### 3.3 Líneas de ataque y rangos (2026-10-17)
**Problema.** Con §3.2 todo movimiento con CD rendía lo mismo en rotación (≈42,4 de potencia/s): Gigadrenado pegaba
más que Megaagotar pero tardaba más, así que no era mejor, era el mismo ataque estirado.

**Líneas** (`src/data/lineasAtaque.ts`, 35): movimientos que son evoluciones unos de otros, del más flojo al más
fuerte, con la **misma firma** (`firmaAtaque`): tipo, categoría, precisión, cuerpo a cuerpo o distancia, forma (a uno,
zona, alrededor) y mecánica (multigolpe, drena, se daña, prioridad, carga, agota, vuelve, interrumpe, se sube o se baja
stats). Solo cambia la potencia (y como mucho el efecto secundario por azar, que ya cuenta en la potencia efectiva).
Absorber → Megaagotar → Gigadrenado, Ascuas → Lanzallamas, Picotazo → Picoteo → Pico Taladro… Llamarada no sigue a
Lanzallamas: pega más pero falla (85 %), es otra apuesta y no una mejora. Los que no encajan van sueltos (231).

**Rango I-V** por potencia (la total en los multigolpe): I ≤ 45, II ≤ 65, III ≤ 85, IV ≤ 105, V más. Dentro de una
línea, siempre uno más que el anterior como mínimo. Se ve en la ficha del movimiento ("Rango III (Drenajes 3/3)").

**Regla.** Cada rango sobre el I rinde `BONO_RANGO` = 2 de potencia/s más (`reglas.ts`): se lanza más deprisa
(`R_CAST` + bono) y paga menos enfriamiento (`R_CD` + bono). Rotación con un movimiento de CD: rango I 42,4 → V 50,4;
lanzados: 45,5 → 53,5. El relleno (instantáneos sin CD) no cambia.

**Comprobación**: `tools/lineas_ataque.ts` (comando en su cabecera) escribe [lineas-ataque.md](lineas-ataque.md) y
avisa si en una línea alguno no tiene la firma del primero o no mejora al anterior.

### 3.4 CDs al estilo WoW (2026-10-17)
Comparado con el WoW: el global (1,1 s) y los lanzados (1,5-2,8 s) están bien; los CDs eran muy cortos y parecidos
(mediana 3,7 s, 54 entre 1,1 y 3 s), lo que solo hace aporrear teclas.
- **Suelo de CD** (`CD_MIN` = 6 s × ritmo): un movimiento es relleno (sin CD) o tiene un CD que se note.
- **Área con CD propio** (`CD_AREA` = 8 s × ritmo): Terremoto, Onda Ígnea, Ventisca, Ácido… a varios rinden más.
- Coste: los cuerpo a cuerpo flojos con CD rinden menos (Mordisco 44 → 40 de potencia/s); los lanzados no cambian.
- **Ritmo** (`GCD` y `RITMO` = GCD / 1,1 en `reglas.ts`): todos los tiempos de los movimientos van en proporción al
  global (lanzamientos, CDs, agotado, el CD del cortado), porque el relleno solo lo frena el global: si el global baja
  y lo demás no, el relleno rinde más que todo. Probado con 1,5 s (2026-10-17, a lo WoW); **ahora 1 s** (como los
  pícaros del WoW): lanzados 1,4-2,7 s (Lanzallamas 1,6 s, Rayo Solar 2,3 s), canalizados ~1,6 s, CD mínimo 5,5 s,
  áreas 7,3 s, agotado 1,8 s, Protección 13,6 s.
- Sin hacer: CDs de burst de 1-2 min. Con la potencia fija, un CD largo solo debilita el movimiento.

### 3.5 Protección y burst (2026-10-17)
- **Protección y familia** (`ESCUDO` en `reglas.ts`; `bloquea` en `mundo.ts`): al pulsarla, una ventana corta en
  la que los golpes no te hacen nada (Protección 0,9 s, Detección 1,4 s). **No gasta global** y corta lo que
  estuvieras lanzando: se usa para reaccionar, al ver acabar la barra de un salvaje o su área roja en el suelo.
  - CD de sus PP: 15 s × ritmo con 10 PP (Protección 13,6 s con el global de 1 s), × √(10/PP) con menos. Si bloquea algo,
    el CD que le queda baja a la mitad: acertar el momento compensa; pulsarla a ciegas, no.
  - Variantes, al que te toca con contacto: Barrera Espinosa (1/8 de su vida), Búnker (veneno), Baluarte Ardiente
    (quemadura), Escudo Real (−1 Ataque), Obstrucción (−2 Defensa), Telatrampa (−1 Velocidad).
  - Aguante: no bloquea; durante 2 s, un golpe que te debilitaría te deja con 1 PS.
  - Burbuja azul (naranja, Aguante) alrededor mientras dura. Los salvajes que la tienen la usan a veces (50 %)
    cuando tu lanzamiento contra ellos está a punto de acabar.
- **Burst: los de 5 PP** (32: Hidrobomba, Llamarada, Ventisca, A Bocajarro, Lluevehojas, Explosión…): siempre
  instantáneos, con CD de 30 s como mínimo. Toda su potencia en un global: para guardarlos y abrir o rematar. Los PP no
  dan el CD de los demás porque en los juegos bajan justo cuando el ataque sube (Absorber 25, Gigadrenado 10). Es parte
  de la firma de las líneas: Megapatada y Velocidad Extrema salieron de las suyas.

### 3.6 Mando (2026-10-17)
- `src/entrada/mando.ts` lee los mandos con la API Gamepad del navegador (disposición "standard": Xbox, Switch Pro,
  PDP Faceoff, PlayStation; el navegador solo los enseña tras pulsar un botón). Cada botón se convierte en una tecla
  sintética en `window`, así que todas las escenas (título, elección, aventura, mapa, evolución) responden con sus
  atajos de teclado sin código aparte. Los sticks los lee `Aventura.update` directamente.
- **En el juego**: stick izquierdo (o cruceta en los menús) = andar; stick derecho = apuntar áreas y conos (si está
  quieto y se juega con mando, la zona va al objetivo; con el ratón, al ratón: manda el último que se movió).
  A = acción (F) · B = cerrar/cancelar (Esc, pero sin salir al título) · Start (+) = Esc del todo (sin nada abierto,
  guarda y sale) · Select (−) = mapa (M) · R2 o R3 = siguiente objetivo (Tab) · L3 = hogar (H).
  Casillas: X Y L1 R1 = 1-4, cruceta ↑ → ↓ ← = 5-8, con L2: X Y = 9-10. L2 + cruceta: ↑ hogar (H), ← movimientos (K),
  → inventario (I), ↓ tienda (T); L2 + R2 = retar (R).
- **En los menús**: cruceta o stick izquierdo = moverse, A o Start = aceptar (Enter), B o Select = atrás (Esc),
  X = F, Y = espacio.
- Dentro de los paneles (K, I, tienda, misiones) sigue haciendo falta el ratón: pendiente navegarlos con el mando.
- **Configurable**: en el título, «Mando» (`scenes/ConfigMando.ts`): lista de acciones con su botón; la marcada se reasigna
  pulsando el botón en el mando (manteniendo «más» va a la segunda capa; un botón solo puede estar en una acción).
  Tipo de mando (Automático por el nombre del mando, Xbox, Nintendo, PlayStation): elegirlo pone sus botones por defecto
  (en Nintendo, A = derecha acepta y B = abajo cancela) y los nombres de sus caras; «Por defecto» (R) los vuelve a poner. Se guarda en localStorage `pokemon-valley/mando` (`src/entrada/asignacion.ts`).
  La cruceta se lee de los botones 12-15 y, en los mandos que Windows expone sin disposición standard, del "hat" (eje 9).
- **Rótulos**: cuando lo último que se tocó fue el mando (`Aventura.conMando`, `mando.tUso` contra el último movimiento
  del ratón), la barra, la columna de ayuda, el pie del mapa y los avisos nombran los botones (`src/entrada/rotulos.ts`);
  al mover el ratón vuelven las teclas.

### 3.6 Tipos de ataque (2026-10-17)
Un **tipo de ataque** es la firma de un movimiento sin su tipo elemental ni su potencia: Ascuas, Pistola Agua,
Impactrueno, Tornado y Viento Feérico son el mismo ("especial a distancia a uno", 40). Las líneas (§3.3) van siempre
dentro de un tipo de ataque y solo suben la potencia; las **variantes** son tipos de ataque que cambian en una sola
cosa (Rayo → Chispazo: alrededor de ti). Lista, con la tabla potencia × tipo de cada uno, sus líneas y sus variantes:
[tipos-ataque.md](tipos-ataque.md) (lo escribe `tools/lineas_ataque.ts`). Sirve para ver huecos: Agua no tiene un
"especial a distancia a uno" de 90 (el Lanzallamas del Agua), así que Pistola Agua no puede llegar ahí por línea.

### 3.7 Dirigidos (2026-10-17)
Los del tipo de ataque **"especial a distancia a uno"** sin nada más (38: Ascuas, Pistola Agua, Impactrueno, Tornado,
Lanzallamas, Rayo, Rayo Hielo, Bola Sombra, Psíquico…) y por tanto sus líneas enteras son **dirigidos**, como las
habilidades con dirección del LoL (`dirigido` en `reglas.ts`; `disparar` y `pasoProyectiles` en `mundo.ts`):
- No hace falta objetivo: salen como un proyectil hacia el ratón o hacia donde apunta el stick derecho (con el mando y
  el stick quieto, hacia el objetivo). Los lanzados (Lanzallamas) toman la dirección **al salir**: mientras dura la
  barra puedes seguir apuntando.
- El proyectil va a 300 px/s, llega a 180 px y da al **primer** enemigo que toca (radio 7 px + su cuerpo); si no toca a
  nadie, falla. La animación del movimiento sale de donde dio.
- Se pueden esquivar: un salvaje apunta a donde estás cuando lo suelta. Un Ascuas a 140 px tarda ~0,5 s en llegar.
- Se ve una bola del color del tipo con estela. En el multijugador, los demás ven el impacto, no el vuelo.

### 3.8 Movilidad (2026-10-17; fase 1)
Al cuerpo a cuerpo le faltaba movilidad. Sale de los datos (`movilidad` en `reglas.ts`; `pasoDash` en `mundo.ts`):
- **Carga** (la del guerrero del WoW): los de contacto con prioridad (Ataque Rápido, Velocidad Extrema, Acua Jet,
  Ultrapuño, Puño Bala, Sombra Vil, Sorpresa, Golpe Bajo). Con objetivo a menos de 130 px, corres hasta él a 450 px/s
  y el golpe sale al llegar; si ya estás a su lado, golpea sin más.
- **Embestida**: los de contacto que te dañan (Doble Filo, Envite Ígneo, Pájaro Osado, Testarazo…) y los que se
  lanzan con el cuerpo (Nitrocarga, Plancha, Rodar, Chispa, Carga Dragón, Arremetida…). Dash de 90 px a 400 px/s hacia
  donde apuntas (ratón o stick derecho; si no, hacia el objetivo): golpea al primer enemigo que toca y te paras. Si no
  toca a nadie, solo te mueves. Una pared lo para.
- **Ida y vuelta** (Ida y Vuelta): golpea y saltas 70 px hacia atrás, lejos de a quien pegaste.
- Mientras dura, no controlas el movimiento. El CD se pone al empezar. Los salvajes los usan igual (te cargan desde
  130 px). En la ficha del movimiento se dice cuál es.
- Siguientes fases (propuesta): saltos con caída en área (Patada Salto Alta, Pisotón), desaparecer (Vuelo, Excavar),
  empujes (Cola Dragón, Llave Giro, Remolino), atrapar y ralentizar (Atadura, Bucle Arena, Viento Hielo),
  contraataques (Contraataque, Manto Espejo, Golpe Bajo solo si el rival lanza) y aperturas (Sorpresa: aturde al
  empezar el combate; Amago: rompe Protección).

## 4. Captura
- La Poké Ball se lanza al objetivo hasta 150 px. Vuela, el Pokémon entra, la Ball se mueve tres veces y se queda
  dentro o sale.
- Probabilidad = `atrapa` de la especie × multiplicador de la Ball × (1 − ⅔ · vida actual / vida máxima) × 1,5
  si está dormido, paralizado o congelado × 1,25.
  - `atrapa` está en `data/especies.ts`, entre 0,1 y 0,6.
  - Las Balls multiplican así: Poké ×1, Super ×1,5, Ultra ×2; la Master no falla.
  - A vida llena, la probabilidad es un tercio de la que tiene casi debilitado.
- La placa del objetivo dice lo que tiene de quedarse ahora mismo («· Poké Ball 12 %», con la primera Ball de tu
  barra), y el aviso al escaparse repite el porcentaje que tenías, para que se vea que hay que bajarle la vida o
  dormirlo.
- Si sale de la Ball, reacciona según su naturaleza (§3, Naturaleza) y **sale alterado: no recupera vida durante
  30 s** (`SIN_CURA_BALL`), aunque huya o se ponga a pasear. Antes se curaba a los 6 s de quedarse tranquilo y, si
  fallaba el primer intento, las siguientes Balls iban a vida llena (un tercio de probabilidad): por eso parecía que
  «si no lo capturas a la primera, ya no». Si vuelve a su sitio por la correa (más de 330 px), sí se cura.
- Dentro de la Ball no le pasa nada (ni el veneno ni el clima lo debilitan). Si aun así cae mientras tanto (otro
  jugador), la Ball se pierde sin más.
- Orientación (Poké Ball): a vida llena, entre un 4 % (`atrapa` 0,1) y un 25 % (0,6); casi debilitado, entre un
  12 % y un 75 %; dormido o paralizado, ×1,5. Un Growlithe (0,13) a vida llena pide unas 18 Balls de media; con
  1 PS, 6.
- Si se queda, entra en tu equipo con su nivel y su vida y aparece en el pueblo.
- Empiezas con 10 Poké Balls y 3 Bayas Aranja. Los derrotados a veces sueltan bayas o Balls.

### 4.1 Shiny (2026-10-15)
- Cada salvaje que aparece (también el alfa) tiene 1/4096 de salir shiny (`PROB_SHINY` en `combate/partida.ts`;
  en la consola, `pv.scene.getScene('aventura').probShiny = 1` para probar).
- **Racha** (2026-10-16, como el contador de KO de Espada/Escudo): cada derrota cuenta para su línea
  (`estado.derrotas`, se guarda). Cada salvaje de esa línea tira el 1/4096 varias veces: 20 derrotas ×2, 50 ×3,
  100 ×5, 200 ×8, 500 ×12 (`RACHA_SHINY`). Al subir de tramo sale un aviso.
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
- **Evolución con piedra** (Eevee): Piedra Agua → Vaporeon, Trueno → Jolteon, Fuego → Flareon, Hoja → Leafeon y
  Hielo → Glaceon (`EVO_OBJETO` en `data/pokedex.ts`; cada evolución es una línea aparte de una forma, que no sale como
  salvaje). Se usa desde el inventario (I; la ficha dice a quién hace evolucionar) o desde la barra, fuera de combate,
  y lanza la misma cinemática. Aprende lo de la forma nueva hasta su nivel que Eevee no aprende nunca (Pistola
  Agua, Niebla…). Las piedras salen en el suelo de las zonas (12 % de cada hallazgo) y del alfa (30 %), en
  `combate/botin.ts`; iconos de `tools/iconos_piedras.py`. Falta: Espeon, Umbreon y Sylveon (amistad).

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
- **La luz de los ataques en el mapa (2026-10-17, `src/fx/luces.ts`)**: los efectos van en un canvas aparte, así que por
  sí solos no tocan la luz Light2D. `LuzFx` (en `Stage.luces`) enciende focos de verdad, que dan en los mapas de normales
  (los Pokémon con el pipeline cel y los 18 árboles Arcane) y en el suelo:
  - cada fotograma agrupa las partículas vivas (brillos, chispas, estrellas; el humo y las rocas no dan luz) en focos
    con su color medio, radio según lo dispersas que están e intensidad según cuántas y qué grandes;
  - destellos explícitos con perfil por tipo (`PERFIL_TIPO`: Fuego parpadea y se apaga despacio, Eléctrico chisporrotea
    y es duro de 2 bandas, Fantasma y Siniestro rasantes, Psíquico y Hada de 4 bandas…) en la carga (`chargeUp`,
    `bigCharge`), en cada impacto (`hitReaction`, mayor cuanto más potente) y en el crítico (`impact`); los pide
    `stage.luz(at, color, radio, intensidad, ms, tipo)` desde `templates.ts`;
  - los proyectiles dirigidos llevan su luz pegada (`seguir`) y las áreas destellan al caer (`Aventura.destelloArea`);
  - cupo de 10 focos de ataque (`CUPO`) dentro de `maxLights: 24` (`main.ts`); si hay más, se quedan los más fuertes.
    De día el ambiente ya es blanco y la luz extra solo tiñe (×0,45); de noche va entera.

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
- Mecánicas de los fósiles (pedido del usuario, 2026-10-16): sin diseñar todavía. Falta decidir cómo se consiguen
  (¿cuevas, excavación?), cómo se revive el Pokémon y qué especies entran.

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
- **Chat** (`src/ui/chat.ts`, HTML sobre el lienzo). Intro abre la línea de escribir, Intro manda y Esc cierra sin
  mandar; mientras escribes, el teclado del juego está apagado. El mensaje va a toda la sala (`t: 'chat'`), sale en el
  registro de abajo a la izquierda (las líneas se desvanecen a los 12 s con el chat cerrado) y en un bocadillo sobre la
  cabeza de quien habla si está en tu mapa. Sin red, solo lo ves tú.

- **Comercio** (2026-10-16, como en WoW; `src/combate/tradeo.ts`, ventana en `HudAventura.pintarTrato`). T con otro
  jugador elegido y cerca le pide comerciar; él acepta con T o rechaza con Esc (la petición caduca a los 30 s; si os
  pedís a la vez, se abre). Ventana de tres columnas: tus cosas (los Pokémon que no manejas, los objetos de la mochila
  y las Pokécoins; clic = ofrecerlo), lo que das (clic = quitarlo) y lo que da el otro. Mayús+clic: cinco objetos o
  100 Pokécoins. Caben 6 Pokémon y 12 clases de objeto. El Pokémon que manejas no se puede dar; los objetos que lleva
  equipados un Pokémon se van con él. Los dos pulsan Aceptar; cualquier cambio en una oferta quita los dos aceptados.
  Cierre en dos pasos para que nadie dé sin recibir: el de uid de red menor manda «cierra» con las versiones de las
  dos ofertas y deja de poder cambiar la suya; el otro, si sigue de acuerdo, hace el cambio y contesta «hecho»; con
  «hecho» lo hace el primero. Se cancela con Esc, al alejaros más de 160 px o al cambiar de mapa. Los Pokémon
  recibidos llegan con uid nuevo y, en el pueblo, salen a pasear al momento (`mundo.rehacerVecinos`).
- **Evoluciones por intercambio** (2026-10-18; `data/pokedex.ts` `Forma.inter`, `INTERCAMBIOS`). Las 13 líneas que en
  los juegos evolucionan al intercambiarlas lo hacen aquí **solo** al recibirlas en un comercio, nunca por nivel:
  Haunter → Gengar, Kadabra → Alakazam, Machoke → Machamp, Graveler → Golem, Boldore → Gigalith, Phantump →
  Trevenant y Gurdurr → Conkeldurr sin más; con objeto equipado (que se gasta), Onix → Steelix y Scyther → Scizor con
  el Revestimiento Metálico, Seadra → Kingdra con la Escama Dragón, Rhydon → Rhyperior con el Protector, Dusclops →
  Dusknoir con la Tela Terrible, Magmar → Magmortar con el Magmatizador y Electabuzz → Electivire con el Electrizador.
  Los seis objetos son accesorios sin efecto en combate (`combate/objetos.ts` INTERCAMBIO; el Revestimiento es el
  amuleto de Acero de siempre, de cualquier rareza) y los vende el Kecleon de la ciudad; como van equipados, viajan con
  el Pokémon. Al cerrar el trato, `Tradeo.cambiar` llama a `Partida.evolucionarIntercambio` con cada recibido: si está
  en la forma de justo antes (Haunter, no Gastly) y lleva el objeto si lo pide, a cualquier nivel se queda con
  `Miembro.forma = 'gengar'` (`formaDe(linea, nivel, forma)` / `formaM(m)` la respetan; `forma()` sin ella se para en
  Haunter) y aprende lo de la forma nueva como con las piedras. `Aventura.tratoHecho` lanza la **cinemática de
  siempre** (`scenes/Evolucion.ts`, `Aventura.cinematica`, la misma que usa el que manejas) por cada recibido que
  evoluciona, una detrás de otra si llegan varios: sale sobre quien te lo dio (o sobre ti si ya no está a la vista),
  empieza con el Haunter en reposo, enseña stats y lo que aprende, y al acabar sigues manejando el tuyo y el recibido
  sale a pasear ya como Gengar (`rehacerVecinos` se hace al terminar la cadena). La ficha del Pokémon en la ventana
  del comercio dice si evolucionará al recibirlo o qué le falta.
  Un Gengar recibido que se vuelve a cambiar sigue siendo Gengar. Partidas guardadas de antes: al cargar por primera
  vez (`Estado.evoIntercambio`), el que ya era Gengar por nivel se queda Gengar (`forma` puesta); un Haunter por debajo
  del nivel se queda Haunter hasta que lo cambien. El modo granja y `pokedex.html` no comercian: ahí siguen por nivel
  (`forma(l, nv, true)`).

Falta: probar el golpe del alfa y el clima con dos jugadores, un indicador en el HUD de quién lleva el mapa, ver a
los vecinos del pueblo de los demás y entrar en la sala desde el título.
