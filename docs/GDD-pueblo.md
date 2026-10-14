# Pokémon Valley — Enfoque "pueblo" (borrador v0.2)

> 2026-10-13 · Sustituye el bucle de granja de [GDD.md](GDD.md) por una gestión de aldea al estilo
> **Cult of the Lamb** (la parte del culto, no las mazmorras ni el combate). Se mantienen los
> pilares: sin humanos, sin texto, sin combate, cada Pokémon es útil, el valle cuenta la historia.

## 1. En una frase

Eres Bulbasaur en un valle marchito. Llegan Pokémon, les das casa y comida, les asignas trabajo,
y con lo que producen construyes más cosas que atraen a más Pokémon. El pueblo crece solo
mientras tú decides qué construir y a quién poner dónde.

## 2. Qué se toma de Cult of the Lamb y en qué se convierte

| Cult of the Lamb | Pokémon Valley |
|---|---|
| Seguidores | **Aldeanos**: Pokémon que viven en el pueblo |
| Reclutar en mazmorras | **Visitantes**: llegan solos al amanecer si hay nido libre y comida; más adelante, expediciones a zonas del valle (sin combate) |
| Fe (barra global) | **Ánimo del pueblo**: media de hambre y descanso de todos; alto = llegan visitantes y trabajan rápido |
| Hambre, cacas, enfermedad | Solo **hambre** y **sueño**. Nunca mueren, enferman ni se van |
| Devoción (los seguidores rezan en el altar) | **Pokécoins**: lo que producen los aldeanos y no gastas en construir se vende en la caja de Pelipper; las Pokécoins desbloquean las ramas del **Árbol Santuario**. Una sola moneda por ahora; si entra una tienda, se decidirá una segunda |
| Árbol de desbloqueos del templo | Las ramas del Árbol Santuario: cada una abre un edificio o una zona |
| Construir con madera y piedra | Igual: **madera**, **piedra** y **bayas** son los tres recursos del arranque |
| Asignar seguidores a tareas | Igual: arrastras un aldeano a un edificio o zona de trabajo |
| Sermones, rituales | Ofrendas al Árbol (hitos de restauración, cambian el aspecto del valle) |
| Mazmorras roguelike | **No hay.** Las zonas del valle se abren con movimientos de campo (Corte, Surf, Fuerza) |

## 3. Bucle

### Cada día (reloj 6:00 → 2:00, ya implementado)
1. Amanece. Si hay nido libre y comida en el comedero, aparece un **visitante** en la entrada. Se une solo.
2. Los aldeanos comen, trabajan en lo que tengan asignado y llevan lo producido al **almacén**.
3. Tú haces lo que quieras: recolectar, talar o picar más rápido que ellos, **construir**, reasignar, acariciar.
4. Anochece: todos van al nido. Se consume comida. Pelipper se lleva la caja y vuelve con Pokécoins.

### Crecimiento (lo incremental)
```
más aldeanos → más madera/piedra/bayas → más edificios → más nidos y comida → más aldeanos
                                       ↘ lo sobrante se vende → Pokécoins → ramas del Árbol → edificios y zonas nuevas
```
Cada vuelta tarda 2 o 3 días. El jugador siempre ve el siguiente objetivo: un edificio con su
coste en iconos o una rama del Árbol con su precio en Pokécoins.

## 4. Lo mínimo para que funcione (prototipo 0.2)

**Recursos (3):** madera (ramas, troncos), piedra, bayas. Ya existen como objetos.

**Edificios (4), cada uno cuesta madera y piedra, se coloca en modo construcción:**
| Edificio | Qué hace |
|---|---|
| Nido | +1 aldeano máximo. Donde duermen |
| Comedero | Guarda bayas; los aldeanos comen de aquí |
| Almacén | Donde los aldeanos dejan lo que producen; tú lo coges de ahí o lo pasas a la caja de envío |
| Huerto | Parcela 3×3; un aldeano asignado planta, riega y cosecha bayas |

**Zonas de trabajo (sin edificio):** bosque (talar), rocas (picar), prado (recolectar). Se asigna
un aldeano a la zona y va solo.

**Aldeanos:** Marill como primer visitante, luego 2 o 3 especies más con afinidades distintas
(Marill riega el huerto, Geodude pica más rápido, Oddish recolecta). Necesidades: hambre y sueño.
Sin felicidad individual, sin amistad, sin evolución todavía.

**Árbol Santuario:** 4 ramas con precio en Pokécoins: Huerto → Nido grande (2 aldeanos) → Taller
(convierte troncos en madera buena y vende solo lo sobrante del almacén cada noche) → abre el río
(zona nueva con pesca y Pokémon de Agua).

**Venta:** manual al principio (tú pasas cosas del almacén a la caja de Pelipper); automática al
construir el Taller. Decidido 2026-10-13.

**Jugador (Bulbasaur):** se mueve, recoge, Látigo Cepa para talar y picar (ya está), coloca
edificios, arrastra aldeanos, los acaricia (suben ánimo). Sin cambio de Pokémon controlado.

## 5. Qué se aparta del GDD actual (no se borra, se pospone)

Equipo activo de 3-4 y cambio de controlado · energía por Pokémon · felicidad y amistad ·
estaciones del año · pesca y mina como sistemas · tienda de Kecleon (puede volver; si lo hace,
habrá que decidir si usa Pokécoins o una segunda moneda).

## 6. Por qué encaja

- **Resultón:** el pueblo se ve crecer. Cada edificio y cada aldeano nuevo cambia el mapa.
- **Sencillo:** una sola acción de gestión (arrastrar aldeano a sitio) y una de construcción.
- **Incremental:** el bucle de arriba es un clicker con patas; funciona aunque no toques nada.
- **Chill:** nadie muere, nada ataca, el único castigo es que trabajen despacio si tienen hambre.

## 7. Preguntas abiertas

- ¿Los aldeanos trabajan de noche o duermen todos? (Propuesta: duermen; la noche es corta.)
- ¿Limitar aldeanos por nidos o por comida? (Propuesta: nidos limitan el máximo, comida el ánimo.)
- Si hay tienda, ¿qué vende que no se pueda producir, y con qué moneda?
- ¿El jugador puede ser asignado también, o solo manda?

## 8. Estado del prototipo

**0.2a (2026-10-13), hecho:** núcleo de gestión sin arte nuevo.
- **Almacén** (de momento la mesa de trabajo): contador de madera, piedra y bayas en el HUD. F en
  la mesa deja ahí los recursos del inventario (rama 1, tronco 3, piedra 1, baya 1 de madera/piedra/bayas);
  lo que no es recurso (Poké Balls) sigue yendo a la caja de envío.
- **Visitantes con petición** (2026-10-13, sustituye a "Marill llega y se queda"): el visitante entra
  por el camino del sur, se para cerca de la entrada y muestra un bocadillo con lo que pide (icono +
  número). F a su lado se lo da (sale del almacén y, si falta, del inventario; un tronco cuenta 3) y
  se une. Uno cada vez: el siguiente llega al amanecer después de unirse el anterior, si nadie se
  quedó sin desayuno. Orden y datos en `src/data/especies.ts`:

  | Especie | Pide | Se le da bien (×2) | Extra |
  |---|---|---|---|
  | Marill | 5 bayas | prado (bayas) | **riega** lo sembrado de su prado antes de cosechar |
  | Bidoof | 4 piedras | árbol (madera) | |
  | Geodude | 6 madera | roca (piedra) | |
  | Oddish | 8 bayas | prado (bayas) | |

- **Riego:** lo sembrado solo crece si ese día se regó (lluvia o Marill). Las plantas salvajes crecen siempre.
- **Asignar trabajo:** clic en el aldeano y luego clic en un árbol (madera, 1 cada 30 min de juego),
  una roca (piedra, 1 cada 40 min) o una planta de bayas (recolecta las maduras de su prado, 6 casillas
  alrededor). Va, trabaja, lleva la carga al almacén (se ve encima de la cabeza) y vuelve.
- **Sueño y hambre:** a las 22:00 van a la casa a dormir; al amanecer cada aldeano desayuna una baya
  del almacén; sin desayuno trabaja a la mitad de ritmo ese día.
- **Látigo Cepa** del jugador ahora también saca ramas de los árboles y piedras de las rocas.
- Código: `src/sim/World.ts` (aldeanos, almacén, `tickAldeanos`), `src/scenes/WorldScene.ts` (dibujo,
  selección, asignación). Capturas: `docs/captura_pueblo_02a.jpg`, `docs/captura_visitante_marill.jpg`,
  `docs/captura_aldeanos_02a.jpg`. Sprites PMD nuevos (SpriteCollab): Bidoof 0399, Geodude 0074
  (trabaja con Punch), Oddish 0043 (con Attack); no tienen Eat.

**Candidatos para más visitantes** (todos de la Pokédex del GDD §14, básicos y comunes):
Pidgey/Wingull (traen objetos de fuera = recolectables extra cada mañana), Diglett (abre tierra:
huerto sin gastar energía), Machop/Timburr (construcción más rápida, cuando haya modo construcción),
Combee (miel de las flores), Wooloo (lana), Psyduck/Magikarp (cuando se abra el río).

**0.2b (2026-10-13), hecho: modo construcción.** Lo que se junta en el almacén se gasta en edificios.
- **Tecla B** abre la barra de construcción (tapa el inventario): una carta por edificio con su miniatura y
  su coste en iconos (en rojo lo que falta). Se elige con 1-2, Q/E, la rueda o clic en la carta. El edificio
  sigue al cursor translúcido (en medias casillas): normal si cabe, rojizo si no. Clic = construir (paga del
  almacén y, si falta, de lo que llevas, como las peticiones); B, Esc o clic derecho = salir. Sin rejillas
  ni cuadrados en el suelo. No cabe sobre agua, camino, árboles, rocas, edificios, puertas, plantas, tierra
  sembrada ni cosas del suelo. Aparece con un saltito. De momento no se derriban ni se mueven.
- **Nido** (6 madera, 2 piedra): +1 aldeano. Cada aldeano duerme en su nido (dentro, con Sleep) y amanece
  ahí. Para quedarse, un visitante necesita un nido libre (lo reserva al llegar si lo hay; §9.1). Los aldeanos de partidas anteriores duermen junto a la casa
  hasta que se construye un nido, que pasa a ser suyo ("se muda al nido nuevo").
- **Comedero** (4 madera, 4 piedra): al amanecer los aldeanos van a desayunar ahí, detrás del cajón y de
  frente, como comiendo de él (Eat si la especie la tiene, que solo trae esa fila; si no, quietos), una baya
  del almacén cada uno, 20 minutos de juego; luego se van a su trabajo. **Sin comedero no desayunan** (trabajan a
  la mitad ese día y el resumen del día lo dice). De momento el comedero no guarda bayas propias: se abastece
  solo del almacén.
- **Visitantes:** al amanecer o al dar la hora de día (7:00-18:00), si nadie se quedó sin desayunar (el
  resto, en §9.1: llegan aunque no haya nido, y si no pueden quedarse se van y vuelven).
- **Huella:** cada edificio ocupa lo ancho de su sprite y 3/4 de su alto, para que los objetos bajos (el nido
  se ve desde arriba) no se monten unos sobre otros. El nido se pisa; el comedero tiene colisión.
- **Objetivo en el HUD**, bajo el almacén: lo siguiente que conviene hacer (construir un nido → atender al
  visitante → construir un comedero → darle trabajo → juntar bayas para el desayuno → otro nido…). La fila
  de aldeanos dice "Aldeanos: n / m nidos".
- Sprites: `assets/game/pixel/estaciones/nido.png` (34×30) y `comedero.png` (32×23), en el catálogo
  `items.json` (también se pueden poner en la maqueta con la tecla 7). Cómo se hicieron: PIPELINE.md §4.
- Arreglos de paso: el tinte de atardecer/noche no se veía nunca (rectángulo con relleno a opacidad 0);
  las animaciones de hojas PMD de una sola fila (Eat de Marill y Bidoof, que hacen de trabajo) se quedaban
  congeladas en el primer fotograma al pedir otra dirección: ahora usan la fila 0.
- Código: `src/data/edificios.ts` (lista, costes), `World.construir/falta/nidoLibre/sitioComedero`,
  `WorldScene` (modo construcción, `sitioValido`, `objetivo`), `UIScene` (barra de construcción, objetivo).

**0.2d (2026-10-13), hecho: vender el sobrante y Pokécoins.** Lo que no se gasta en construir se vende.
- **Pokécoins** es la moneda (el `dinero` de la partida; antes salía como "$"). En el HUD, bajo el reloj, con
  su moneda; debajo, "en la caja: +N" con lo que se cobrará esta noche. La etiqueta del objeto elegido enseña
  su precio con la moneda. El desmayo de las 2:00 sigue quitando el 10 %.
- **Caja de Pelipper**: sprite nuevo, pegado a la mesa (a la derecha o, si no cabe, a la izquierda) en
  cualquier mapa, sin tocar los JSON. F (o clic) en la mesa o en la caja deja en el almacén los recursos que
  lleves y abre su panel.
- **Panel de la caja** (centrado; F, Esc, clic fuera o echar a andar lo cierran): por recurso, lo que hay en
  el almacén, lo que va en la caja con − / + / todo (Mayús = de 10 en 10), el precio y el total. Lo que está en
  la caja no cuenta para construir ni para las peticiones; se puede devolver al almacén hasta que Pelipper se
  lo lleva. Fila de la mochila: mete lo elegido con Q/E (Poké Balls, que no son recursos). Abajo, el total de
  esta noche y **Vender sobrante**: deja en el almacén lo justo para el edificio más caro, lo que pide el
  visitante o un pendiente y dos desayunos por aldeano (`World.reserva`), y mete el resto.
- **Precios** (`PRECIO_RECURSO` en `src/data/items.ts`): madera 2, piedra 3, bayas 5 por unidad (madera y
  piedra como sus objetos sueltos; las bayas del almacén son comida genérica).
- **Al amanecer** Pelipper baja volando hasta la caja (sprite PMD 0279, Walk/Idle), suelta "+N" con la moneda
  y se va; el contador del HUD sube cuando se posa. El resumen del día dice "Pelipper trajo N Pokécoins".
- **Objetivo**: cuando no queda nada más urgente y sobran 20 o más recursos con la caja vacía, "Vende lo que
  sobra en la caja de Pelipper".
- Aún **no se gastan**: son para las ramas del Árbol Santuario (siguiente paso).
- Código: `World.aCaja/reserva/sobrante/venderSobrante/valorCaja` y `Estado.cajaR`; `WorldScene.colocarCaja`,
  `abrirCaja/moverCaja/venderSobrante/meterElegido`, `pelipperTrae`; `UIScene.crearPanelCaja/dibujarPanelCaja`.
  Capturas: `docs/captura_caja_02d.jpg`, `docs/captura_pelipper_02d.jpg`.

**Mapa inicial ordenado (2026-10-14), hecho.**
- **3 nidos ya hechos** al empezar partida (`NIDOS_INICIALES` en `src/data/edificios.ts`), en fila y
  pegados, en el sitio libre más cerca de la casa (sin tocar paredes, tejado, camino ni puertas). Así no
  hay que construir nidos al principio: el objetivo pasa directamente a atender al visitante.
- **Bayas silvestres en filas**: 2 filas de 5 plantas seguidas (una baya por fila) con un pasillo de una
  casilla entre ellas, a 4-12 casillas del almacén; si no cabe, filas sueltas. Antes salían sueltas por
  todo el mapa. Las ramas y piedras que aparecen cada día no caen pegadas a una planta.
- Plantas, objetos y nidos ya no salen detrás de tejados, copas de árbol o rocas (se mira el dibujo entero,
  no solo la colisión).
- Código: `World.crearPlantasSalvajes`, `World.nueva(…, nidos, cerca)`; `WorldScene.nidosIniciales`,
  `sitioLibre`, `dibujos`.

**Siguiente:** el **Árbol Santuario** (gastar Pokécoins en ramas que abren edificios y zonas: Huerto → Nido
grande → Taller, que vende solo el sobrante cada noche → el río); que el comedero guarde bayas propias;
almacén de verdad en vez de la mesa.

## 9. Pokémon fuera del cupo de aldeanos (2026-10-13)

Los nidos limitan cuántos aldeanos hay, pero el valle no debe quedarse sin Pokémon nuevos cuando
el cupo está lleno. Dos capas:

### 9.1 Visitantes que se van y vuelven (prototipo 0.2c)
Pokémon que vienen y que todavía no puedes acoger. Dan la sensación de "tengo que prepararme para
cuando vuelva", sin castigo: ninguno se pierde para siempre.
- **Llegan aunque no haya nido libre.** Uno cada vez, de día (al dar la hora entre las 7:00 y las
  18:00), nunca si alguien se quedó sin desayunar. Si hay nido libre, lo reservan al llegar.
- **Para quedarse necesitan lo que piden y un nido libre.** Si no hay nido libre, el bocadillo
  enseña también un nido.
- **A las 20:00 (o si te vas a dormir antes), si no se lo has dado, se van** por el camino del sur
  y quedan **pendientes**: su cara en el HUD, bajo el objetivo, con lo que piden (en rojo lo que aún
  falta, y el nido si no hay ninguno libre).
- **Vuelven** en cuanto podrías acogerlos (nido libre + lo que piden) o, si no, a los 2 días a
  probar otra vez.
- **Orden de llegada:** 1) un pendiente que ya puedes acoger; 2) una especie nueva si hay menos
  de 2 pendientes; 3) un pendiente al que le toca volver.
- Más adelante, las especies raras pedirán más (o un edificio concreto, como un estanque).
- **Estado (2026-10-13): hecho y probado en el navegador.** Marill llega nada más empezar,
  aunque aún no haya nido. Mientras se va, aún se le puede alcanzar y darle lo que pide (F).
  Código: `World.llegaVisitante`, `puedeAcoger`, `despedir`, `Estado.pendientes`, hacer `'irse'`
  (`src/sim/World.ts`); bocadillo con nido y `objetivo()` (`src/scenes/WorldScene.ts`); panel
  VOLVERÁN (`UIScene.dibujarPendientes`). Capturas: `docs/captura_visitante_vuelve.jpg`,
  `docs/captura_pendientes.jpg`.

### 9.2 Pokémon que no ocupan nido (siguiente, sin empezar)
- **Salvajes en el mapa:** Pidgey en las copas, Caterpie en la hierba alta, Wooper en el estanque.
  Sacudes un árbol y un Pidgey sale volando y suelta una pluma; si dejas una baya junto a uno, a la
  mañana siguiente hay un regalo en ese sitio. Cada uno da algo (pilar: cada Pokémon es útil).
- **Registro de vistos:** siluetas que se rellenan, sin texto. Una colección sin cupo.
- **De paso:** un Machop viajero que ayuda a construir un día a cambio de comida y se va (como
  Pelipper con la caja).
- **Expediciones** (cuando haya zonas): un aldeano sale del mapa y vuelve con recursos y especies
  nuevas para el registro.

## 10. Stats, niveles y evolución (2026-10-14, hecho)

**Referencia:** los juegos oficiales, tal cual. Cada línea evolutiva guarda las **stats base oficiales**
de cada forma (Gen. 9, comprobadas en pokemondb.net), su **grupo de experiencia** oficial (lo que cuesta
subir) y el **nivel** al que evoluciona. Ahí ya están todas las variedades: las líneas que evolucionan
pronto y acaban flojas (Caterpie, Bidoof) van bien al principio y mal al final; las que tardan
(Magikarp, Beldum, Ralts) son malísimas hasta que evolucionan; las de una sola forma (Miltank, Torkoal)
empiezan fuertes y no mejoran tanto. Las evoluciones por piedra, intercambio o amistad aquí van por nivel.

**5 stats de trabajo**, sacadas de las 6 oficiales:

| Stat | Sale de | Qué hace en el pueblo |
|---|---|---|
| Fuerza | Ataque | Ritmo al talar y picar (55 = ritmo 1; la afinidad de la especie lo dobla) |
| Maña | At. Esp. | Ritmo en el prado: cosechar y regar |
| Carga | Defensa | Lo que lleva por viaje al almacén (1 por cada 50) |
| Aguante | media de PS y Def. Esp. | Minutos de trabajo al día: 5 h + 4 min por punto (máx. el día entero). Al acabar su jornada se cansa ("Zz"), deja la carga y se va a dormir |
| Velocidad | Velocidad | Lo rápido que anda (45 = como antes) |

**Valor a nivel N** = stat base de la forma que le toca × (1 + 2·(N−1)/99): ×1 a nivel 1, ×3 a nivel 100.

**Niveles 1-100.** Los visitantes llegan a nivel 5 (`nivel` en `data/especies.ts` para cambiarlo).
Cada unidad de trabajo terminada da 1 de experiencia por minuto que vale (madera 30, piedra 40,
cosecha 15, riego 5): **quien trabaja peor sube más despacio**. La experiencia por nivel sigue las
fórmulas oficiales (rápido, medio, parabólico, lento, errático, fluctuante). Al subir sale "Nv 12" sobre
el aldeano; al evolucionar, aviso y destellos, y cambia el sprite (todas las formas tienen sprites PMD).
Ritmo estimado para un buen trabajador en su trabajo favorito: Nv 20 en ~5 días, Nv 50 en ~40, Nv 100
en 5-7 meses de juego; sin afinidad, el doble.

**Ficha del aldeano** (HUD, a la derecha bajo el dinero): al pasar el ratón por un aldeano o elegirlo.
Cara, forma, nivel y barra de experiencia; tipo, perfil y grupo de experiencia; las 5 stats (la barra mide
lo buena que es la stat para su nivel, el número es el valor); lo que lleva por viaje, horas trabajadas
hoy de su jornada y su próxima evolución.

**Perfil** (calculado, no se escribe a mano): rendimiento total de niveles 5-20 y 60-100 frente a la
mediana de todas las líneas (±5 % = en la media). Bueno = bien siempre · Precoz = bien al principio, flojo
al final · Tardío = flojo al principio, bien al final · Flojo = flojo siempre · Normal = en la media.

**61 líneas, 3 por tipo y 7 de Pokémon grandes** (2026-10-14: Munchlax→Snorlax, Lapras, Wailmer, Bergmite, Rhyhorn, Larvitar, Dratini). Marill, Pikachu y Clefairy empiezan en su bebé (Azurill, Pichu, Cleffa), que evoluciona a nivel 10; el visitante Marill llega a nivel 10 (ya como Marill) (`src/data/pokedex.ts`; consulta con gráfica: `pokedex.html` en el servidor del juego):

| Tipo | Líneas (perfil) |
|---|---|
| Normal | Bidoof (precoz), Wooloo (tardío), Miltank (precoz) |
| Planta | Oddish (normal), Sunkern (flojo), Bounsweet (tardío) |
| Fuego | Growlithe (bueno), Slugma (flojo), Torkoal (precoz) |
| Agua | Marill (flojo), Psyduck (normal), Magikarp (tardío) |
| Eléctrico | Pikachu (normal), Magnemite (bueno), Pachirisu (precoz) |
| Hielo | Vanillite (tardío), Snorunt (normal), Swinub (tardío) |
| Lucha | Machop (normal), Timburr (tardío), Makuhita (flojo) |
| Veneno | Grimer (normal), Trubbish (precoz), Zubat (tardío) |
| Tierra | Diglett (flojo), Drilbur (bueno), Mudbray (precoz) |
| Volador | Pidgey (flojo), Hoothoot (flojo), Rookidee (flojo) |
| Psíquico | Abra (bueno), Ralts (tardío), Natu (precoz) |
| Bicho | Caterpie (precoz), Combee (flojo), Spinarak (flojo) |
| Roca | Geodude (normal), Sudowoodo (precoz), Onix (bueno) |
| Fantasma | Gastly (bueno), Litwick (tardío), Misdreavus (bueno) |
| Dragón | Gible (tardío), Axew (tardío), Druddigon (precoz) |
| Siniestro | Poochyena (flojo), Sableye (precoz), Murkrow (bueno) |
| Acero | Aron (bueno), Beldum (tardío), Mawile (precoz) |
| Hada | Clefairy (normal), Togepi (tardío), Flabébé (tardío) |

Visitantes de momento solo los 4 de siempre (Marill, Bidoof, Geodude, Oddish); el resto está en los datos
para cuando se les dé hueco. Los tipos aún no hacen nada: su utilidad se decide más adelante.

**Pendiente / a vigilar:**
- Los que son malísimos en el trabajo que tienen tardan muchísimo: Magikarp talando llegaría a Nv 20 en
  ~140 días. Hará falta otra forma de subirlos (p. ej. una guardería que reparta experiencia, o un trabajo
  donde Magikarp sí rinda, como pescar).
- Producción: un Geodude a nivel 5 ya saca ~40 piedras al día (Fuerza alta + afinidad + Carga 2). Ajustar
  `STAT_REF` (World.ts) o los costes si la economía va demasiado rápida.
- La afinidad ×2 por especie sigue; cuando los tipos tengan uso, quizá pase a ser por tipo.

## 11. Para qué sirve cada edificio (2026-10-14, hecho)

**Regla:** todo edificio hace al menos una de estas cosas; si no, no se construye.
1. **Sube un límite**: nido y nido grande (camas), almacén (los aldeanos caminan menos).
2. **Convierte un recurso en otro mejor** con un aldeano dentro: el **horno** (2 piedras → 1 ladrillo cada 40 min).
   Los recursos convertidos piden los edificios y mejoras de más arriba (guardería, ampliación de la casa).
3. **Abre un trabajo para un tipo** (primer uso de los tipos): en el horno, los de **Fuego** trabajan al doble.
   Para que haya uno, **Growlithe** llega como 5.º visitante (pide 8 de piedra). Más adelante: un pozo para Agua,
   un huerto para Planta y Bicho…
4. **Da algo cada día**: comedero (desayuno), **guardería** (experiencia sin trabajar).

**Recursos nuevos:** **ladrillos** (los cuece el horno; valen 10 en la caja) y **platos** (guiso de bayas; valen 25,
pero "Vender sobrante" nunca los mete: son para desayunar). Salen en el almacén del HUD y en la caja de Pelipper.

**Casa de Bulbasaur** (F en la puerta abre su panel; antes dormía sin preguntar):
| Nivel | Mejora | Coste | Qué da |
|---|---|---|---|
| 1 | Cama | — | Dormir (y guardar) |
| 2 | Cocina | 20 madera, 10 piedra, 150 Pokécoins | Cocinar: 3 bayas + 4 de energía = 1 guiso (al almacén). Al amanecer, en el comedero, cada aldeano desayuna antes un guiso que una baya: ese día **gana el doble de experiencia y trabaja un 25 % más rápido** (festín). El resumen del día lo dice |
| 3 | Ampliación | 30 madera, 12 ladrillos, 500 Pokécoins | Bulbasaur amanece con **150 de energía** en vez de 100 |

**Edificios con puestos de trabajo** (se asignan como un árbol: clic en el aldeano y luego en el edificio):
| Edificio | Coste | Puestos | Qué hace |
|---|---|---|---|
| Horno | 8 madera, 12 piedra | 1 | Gasta 2 piedras del almacén y saca 1 ladrillo cada 40 min de trabajo (Maña; Fuego ×2). Lleva los ladrillos al almacén como cualquier carga. Si no hay piedra, espera sin cansarse |
| Guardería | 16 madera, 6 ladrillos | 2 | No produce: quien está dentro gana 1,2 de experiencia por minuto (lo que gana un trabajador normal), con su jornada (Aguante). Para Magikarp, Beldum y los que trabajan mal (§10, pendiente) |

**Objetivo del HUD**: tras lo de siempre, sugiere la cocina (si te llega el dinero), el horno (con 3 aldeanos) y
poner a alguien en él.

**Pendiente:** sprites de la casa por nivel (ahora se ve igual); taller (sprite ya hecho en
`assets/gen/pixel/edificios_pueblo/final/taller.png`: madera → tablones con un aldeano de Lucha); cofre personal en la
ampliación. Código: `src/data/edificios.ts` (`puestos`, `produce`, `tipo`, `expMin`, `MEJORAS_CASA`),
`World.trabajarEdificio`, `cocinar`, `mejorarCasa`, `energiaMax`; panel en `UIScene.dibujarPanelCasa`.

## 12. Poké Balls: invitar a Pokémon salvajes (2026-10-14, hecho)

Segunda forma de conseguir aldeanos, además de los visitantes: Pokémon **salvajes** que rondan por el
valle sin pedir nada. Se les lanza una Poké Ball y **puede fallar**. No hay combate.

- **Salvajes** (`src/data/especies.ts`, `SALVAJES`): **todas las líneas de la Pokédex salvo los visitantes**
  (2026-10-14). Pidgey (árbol), Psyduck (prado, riega), Pikachu (prado) y Machop (roca) tienen `atrapa` a mano
  (0,6 / 0,45 / 0,35 / 0,25); el resto lo saca de su línea: afinidad por tipo (Planta, Agua, Bicho, Hada, Eléctrico y
  Psíquico → prado; Roca, Tierra, Acero, Lucha, Fuego, Hielo y Dragón → roca; el resto → árbol), riega si es de Agua,
  y `atrapa` = 1,05 − (stats totales de su última forma)/600, entre 0,1 y 0,6. `atrapa` es la probabilidad de que se
  quede con una Poké Ball. Los fáciles salen más a menudo, y primero las especies que aún no viven en el pueblo.
- **Evolucionados** (`PROB_EVOLUCIONADO` = 30 %): el salvaje puede salir ya en una de sus evoluciones, con el nivel
  de esa forma (+0-4). Cuesta más atraparlo (`atrapa` × 0,6).
- **Cuándo aparecen** (`World.aparecerSalvaje`): al amanecer con un 50 % y en cada hora de día (7-18) con un
  15 %, si no hay ya uno. Solo hay uno cada vez. Sale a 10 casillas o más del almacén y pasea despacio a
  3 casillas o menos de ese sitio. Por la noche se va.
- **Lanzar** (F, espacio o clic con el salvaje bajo el cursor, o a tu lado; alcance de 4 casillas): la Ball
  vuela en arco, el Pokémon entra, la Ball se mueve 3 veces y entonces se decide.
  Probabilidad = `atrapa` × la Ball (`BALL` en `src/data/items.ts`): Poké 1, Super 1,5, Ultra 2, Honor 1 y
  Master siempre. Si se queda, va al almacén como un visitante que se une (nido propio, nivel de llegada).
  Si falla, **la Ball se pierde** y el Pokémon se queda (puedes probar otra vez) o, con un 30 %, huye y desaparece.
- **Qué Ball se gasta**: la que tengas en la mano. Si no llevas una en la mano, la más sencilla que haya
  (Poké → Super → Ultra → Honor). La Master Ball solo se gasta si la eliges tú.
- **Hace falta un nido libre**. Si no lo hay, no se lanza nada y no se pierde la Ball.
- **Honor Ball con un visitante**: si no tienes lo que pide, F a su lado y se une con la Honor Ball, sin pagar.
- **De dónde salen las Balls**: empiezas con 3 Poké Balls. Después aparecen a veces entre los recolectables
  de cada mañana (`APARICIONES`: Poké 10, Super 4, Ultra 2 y Honor 2, frente a 100 de ramas, piedras y troncos).
  Aún no hay forma de conseguir la Master Ball: se reserva para algo especial (¿un legendario?).
  Siguen vendiéndose en la caja de Pelipper.
- Pruebas en la consola: `pv.scene.getScene('world').sim.aparecerSalvaje('pikachu')` y después `.sincronizar()` en la escena.
