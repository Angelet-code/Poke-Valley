# Pokémon Valley — Documento de Diseño (GDD)

> Versión 0.1 · 2026-10-12 · Estado: borrador
> Stack: Phaser 3 + TypeScript + Vite · Plataforma: navegador PC
> Proyecto personal no comercial (fangame). Ver §19 sobre propiedad intelectual.
> **2026-10-13: el bucle de granja se replantea como gestión de aldea estilo Cult of the Lamb.
> Ver [GDD-pueblo.md](GDD-pueblo.md); este documento queda como referencia hasta fusionarlos.**

---

## 1. Visión

**Pitch:** Un Stardew Valley donde no eres un humano, sino un equipo de Pokémon. Llegas a un valle marchito y abandonado y, con los movimientos de tus Pokémon como herramientas, lo cultivas, lo restauras y lo vuelves a llenar de vida. Sin diálogos, sin combates. Muy chill.

### Pilares

1. **Los movimientos son las herramientas.** No hay azada ni pico: hay Excavar, Golpe Roca y Pistola Agua. Lo que puedes hacer depende de quién controlas.
2. **Cada Pokémon es útil.** Cualquier Pokémon reclutado trabaja en el valle de alguna forma: produce algo, opera una estación o abre un camino.
3. **El valle cuenta la historia.** No hay texto. El progreso se ve: la tierra marchita reverdece, llegan Pokémon nuevos y las zonas se desbloquean.
4. **Chill sin ser vacío.** Sin combate ni muerte, pero con objetivos claros, un reloj que da ritmo y decisiones de gestión.

### Referencias

| Juego | Qué tomamos |
|---|---|
| Stardew Valley | Bucle diario, estaciones, reloj y energía, restauración tipo Centro Cívico |
| Cobblemon | Cada Pokémon da un producto (drop) |
| Palworld | Estaciones de trabajo operadas por Pokémon, hambre y cansancio, automatización |
| Pokémon Mundo Misterioso | Tienda de Kecleon, Pelipper como correo, sprites expresivos |
| Pokopia (2026) | **A diferenciarse**: también controlas un Pokémon que restaura el mundo |

**Diferencia con Pokopia:** allí eres un único Ditto. Aquí gestionas un **equipo intercambiable** en el que cada tipo aporta capacidades distintas, más una **granja que funciona sola** gracias a la IA autónoma.

---

## 2. Premisa

Un valle que antes estaba lleno de Pokémon se ha marchitado: la tierra está gris, los ríos estancados y las cuevas selladas. No se explica por qué (no hay diálogo) y queda a la interpretación.

Llegas siendo **un Pokémon inicial** junto a un viejo **Árbol Santuario** seco en el centro del valle. Cada ofrenda que le entregas revive una parte del valle. Cuanto más vivo está el valle, más Pokémon llegan.

**No hay humanos.** El comercio con el exterior se hace mediante Pokémon (§13).

---

## 3. Inicio de partida

**Decisión actual: el inicial único es Bulbasaur.** Más adelante se decidirá si hay más iniciales para elegir (Roca/Tierra y Agua quedan como candidatos).

1. Apareces como **Bulbasaur** junto al Árbol Santuario, con una parcela de tierra marchita.
2. **No hay avatar humano.** La cámara está centrada en el Pokémon controlado.
3. El juego **empieza por la recolección**, que es la mecánica más básica: no necesita herramientas, riego ni dinero. La agricultura llega después.

### Cadena de arranque (tutorial implícito, sin texto)
1. **Recolección:** el prado tiene arbustos de bayas, setas, flores y ramas. Bulbasaur los recoge (con Látigo Cepa para los que están lejos o en lo alto de los arbustos).
2. **Primera ofrenda:** el primer altar del Árbol Santuario pide solo recolectables. Al completarlo, el prado central revive.
3. **Llega el primer visitante, de Agua** (Marill: básico, común, nada especial), con una petición sencilla de recolectables. Se une al equipo.
4. **Semillas:** algunas bayas recolectadas dan semillas (o las compras). Ahora que hay quien riegue, empieza la **agricultura**.
5. A partir de aquí, el bucle completo de la granja.

### Bulbasaur: kit de agricultura

| Movimiento | Acción | Desbloqueo |
|---|---|---|
| Látigo Cepa | Arar (remover la tierra) y cosechar a distancia | Inicio |
| Plantar (acción) | Sembrar semillas | Inicio |
| Desarrollo / Síntesis | Acelerar el crecimiento o subir la calidad de los cultivos cercanos | Nivel de trabajo |
| Hoja Afilada | Cortar maleza y hierba en área | Evolución (Ivysaur) |
| Rayo Solar | Madurar al instante una parcela pequeña (gasta mucha energía) | Evolución (Venusaur) |

**Bulbasaur no puede regar.** La cadena de arranque lo resuelve: al empezar por la recolección no hace falta regar, y el primer reclutado (de Agua) aparece justo antes de que se desbloquee la agricultura. Así el primer reclutamiento enseña sin texto para qué sirve tener un equipo.

---

## 4. Bucle de juego

### Bucle diario (6:00 → 2:00)
1. Despertar → revisar la granja (los Pokémon autónomos ya han trabajado durante la noche o la mañana).
2. Repartir comida en los comederos y ajustar asignaciones si hace falta.
3. Elegir el **equipo activo** del día (3-4 Pokémon).
4. Hacer trabajo manual: regar, cosechar, ir a la mina, pescar, explorar o reclutar.
5. Meter productos en la caja de envío de Pelipper.
6. Dormir → resumen del día → los envíos se convierten en dinero.

### Bucle medio (semana/estación)
- Completar ofrendas del Árbol Santuario → restaurar zonas.
- Reclutar visitantes → desbloquear capacidades y producción.
- Construir y mejorar estaciones de trabajo y hábitats.

### Bucle largo
- Restaurar el valle completo (todas las ofrendas).
- Completar la Pokédex del valle (~50).
- Evolucionar al equipo y llegar al fondo de la mina.

---

## 5. Tiempo, energía y necesidades

### Calendario
- 4 estaciones × 28 días. Cada estación tiene cultivos, visitantes, peces y recolectables propios.
- Clima: soleado, lluvia (riega sola), tormenta y nieve. Algunos visitantes solo aparecen con cierto clima.

### Reloj (como Stardew)
- El día dura de 6:00 a 2:00. **1 minuto de juego = 0,7 s reales** (ajustable).
- A las 2:00, el Pokémon que controlas se desmaya. Al despertar ha perdido un 10 % del dinero que llevaba encima (máximo 1.000) y empieza con menos energía. Es un castigo leve.

### Energía (cansancio)
- **Cada Pokémon tiene su propia barra de energía.** Usar movimientos de campo la gasta.
- Cuando el Pokémon que controlas se cansa, cambias a otro del equipo. **El equipo activo de 3-4 es tu "energía total" del día.** Esto le da sentido estratégico a la composición del equipo.
- Con la energía a 0, el Pokémon no puede usar movimientos, pero sí caminar.
- Se recupera durmiendo o descansando en una **cama/nido** (los autónomos lo hacen solos).

### Hambre
- Todos los Pokémon tienen hambre. Comen de los **comederos** (bayas, cultivos o comida cocinada).
- Con hambre trabajan más despacio y su felicidad baja. **Nunca mueren, enferman ni se van.**
- La comida cocinada sacia más y puede dar bonificaciones (velocidad, energía extra, mejores drops).

### Felicidad y amistad
- **Felicidad (corto plazo):** sube con comida favorita, caricias, buen descanso y hábitat adecuado. Afecta a la velocidad de trabajo y a la calidad del drop.
- **Amistad (largo plazo):** sube con el tiempo y los cuidados. Desbloquea la evolución en algunos Pokémon y nuevos movimientos de campo.

---

## 6. Pokémon: control y equipo

### Equipo activo
- **3-4 Pokémon** te acompañan (empieza en 3; un objeto de mejora lo sube a 4).
- Cambio **instantáneo** entre ellos con teclas 1-4 o la rueda del ratón. El Pokémon anterior sigue a tu lado como acompañante.
- Los acompañantes no controlados **ayudan cerca de ti** de forma automática según su tipo (por ejemplo, un Planta acompañante riega los cultivos junto a los que pasas).
- El equipo solo se cambia en la **base** (Árbol Santuario o en el PC/cuaderno de la granja).

### Atributos de cada Pokémon

```
especie, nivel de trabajo, tipo(s)
movimientosDeCampo[]      // herramientas
afinidadesDeTrabajo{}     // ej. { cultivo: 2, mina: 0, fuego: 3 }
drop                      // producto que genera (estilo Cobblemon)
energía, hambre, felicidad, amistad
hábitatPreferido, comidaFavorita
```

### Progresión individual
- **Nivel de trabajo:** sube al trabajar. Mejora la velocidad, el área del movimiento y la calidad del drop.
- **Evolución:** por nivel de trabajo y/o amistad. Cambia el sprite, mejora los movimientos y a veces añade movimientos nuevos (por ejemplo, Ivysaur aprende Hoja Afilada para cortar en área).

---

## 7. Movimientos de campo (= herramientas)

| Movimiento | Tipo | Acción | Equivale a |
|---|---|---|---|
| Excavar | Tierra | Arar la tierra | Azada |
| Pistola Agua / Hidrobomba | Agua | Regar 1 casilla / área | Regadera |
| Golpe Roca / Demolición | Roca/Lucha | Romper rocas y minerales | Pico |
| Corte / Hoja Afilada | Planta/Normal | Talar árboles y cortar maleza | Hacha/hoz |
| Látigo Cepa | Planta | Cosechar o coger a distancia | — |
| Síntesis / Paralizador (pólenes) | Planta | Acelerar o abonar cultivos | Abono |
| Ascuas / Lanzallamas | Fuego | Encender hornos y quemar maleza | — |
| Surf | Agua | Cruzar el agua | Barco |
| Destello | Eléctrico/Fantasma | Iluminar la mina | Antorcha |
| Fuerza | Lucha/Normal | Empujar bloques en puzles | — |
| Vuelo | Volador | Viaje rápido entre puntos desbloqueados | Tótem/varita |
| Teletransporte | Psíquico | Volver a la base | Totem de vuelta |
| Pesca (acción especial) | Agua | Pescar | Caña |

**Mejora de "herramientas":** el movimiento mejora con la evolución o el nivel de trabajo (por ejemplo, Pistola Agua riega 1 casilla, Hidrobomba riega 3×3).

---

## 8. Reclutamiento

**Regla base:** cualquier Pokémon que aparezca se puede reclutar, pero **si no interactúas con él, termina yéndose.**

### Visitantes
- Aparecen en zonas restauradas según la **estación, el clima, la hora y los hábitats construidos**.
- Muestran un **bocadillo con un icono de petición**: un objeto, una comida o una estructura (por ejemplo, el icono de una cama de heno).
- Se quedan **3 días** (configurable). Si cumples la petición, se unen. Si no, se van y pueden volver más adelante.
- Los indicadores visuales del valle (huellas, hojas que se mueven) avisan de visitantes nuevos.

### Formas de atraer y reclutar
1. **Se mudan solos:** construir un hábitat (estanque, roca, prado o nido) atrae a especies concretas como visitantes.
2. **Amistad en estado salvaje:** en zonas silvestres hay Pokémon esquivos. Si les ofreces su comida favorita varias veces (en días distintos), te siguen.
3. **Peticiones:** el visitante pide algo y, al cumplirlo, se une.
4. **Cría:** en el **Nido/Guardería**, dos Pokémon compatibles y felices producen un **huevo**. El huevo se incuba con el tiempo (o más rápido si llevas a un Pokémon de Fuego).

### Curva de rareza
- **Los primeros Pokémon son muy básicos y comunes, nada especiales** (Marill, Pidgey, Rattata, Caterpie, Oddish...). El valle empieza humilde.
- La rareza sube con la restauración: cada zona revivida atrae especies menos comunes.
- Los Pokémon raros o "especiales" (fósiles, Eevee, finales de evolución salvajes) solo aparecen en las zonas avanzadas o en eventos muy puntuales.
- Marca visual de rareza (por ejemplo, un brillo sutil en el visitante), nunca texto.

### Límite
- No hay tope de Pokémon, pero cada uno necesita **cama/hábitat y comida**. La capacidad de las camas es el límite blando.

---

## 9. IA autónoma

Los Pokémon que no controlas viven en el valle con su propia rutina.

### Prioridades (de mayor a menor)
1. **Necesidades:** comer si tiene hambre y dormir si está cansado.
2. **Asignación forzada:** si el jugador lo ha asignado a una estación o zona, trabaja allí.
3. **Trabajo autónomo:** busca la tarea disponible con la que tiene más afinidad (regar cultivos secos, operar el horno si hay mineral, cosechar lo que está maduro).
4. **Ocio:** pasear, jugar con otros Pokémon, dormir la siesta al sol. Así el valle se siente vivo.

### Asignación
- Se puede asignar desde un menú o arrastrando a un Pokémon hasta una estación o zona.
- La asignación se cancela con un clic. Sin asignación, vuelve a ser autónomo.

### Producción de drops
- Cada Pokémon genera su drop cada X días según su felicidad (por ejemplo, Wooloo deja lana junto a su hábitat). Lo recoges tú o un Pokémon autónomo con afinidad de recolección.

---

## 10. Mecánicas de recursos

### 10.1 Agricultura
- Ciclo: arar (Excavar) → plantar semilla → regar a diario → crecer N días → cosechar.
- **Bayas** (Aranja, Zreza, Meloc...) más cultivos normales (zanahoria, calabaza, trigo...).
- Los Pokémon de Planta junto a los cultivos aceleran el crecimiento; Síntesis aumenta la calidad.
- Calidades: normal / plata / oro.
- Invernadero: se desbloquea con una ofrenda.

### 10.2 Ganadería (drops estilo Cobblemon)
| Pokémon | Producto |
|---|---|
| Wooloo | Lana |
| Miltank | Leche Mu-mu |
| Combee | Miel |
| Chansey | Huevo |
| Mareep | Lana + carga eléctrica |
| Shroomish | Setas |
| Spinarak / Sewaddle | Hilo / seda |
| Mudbray | Barro (abono) |
| Tropius | Fruta |
| Shellder / Clamperl | Perla |
| Vanillite | Hielo |

Los productos se procesan en estaciones (lana → tela, leche → queso, miel → hidromiel o caramelos).

### 10.3 Minería (sin combate)
- **Cueva del Valle:** pisos generados proceduralmente con algunos diseñados a mano. Hay ascensor cada 5 pisos.
- Retos:
  - **Obstáculos por tipo:** rocas que requieren Golpe Roca, agua que requiere Surf, oscuridad que requiere Destello, maleza que requiere Ascuas. Obligan a cambiar de Pokémon.
  - **Puzles de bloques:** empujar rocas con Fuerza, interruptores, placas de presión.
  - **Profundidad y energía:** el reto principal es gestionar la energía del equipo para bajar más.
- Botín: minerales, gemas, fósiles (que reviven a Pokémon fósiles reclutables), piedras evolutivas.
- Algunos visitantes de cueva solo se encuentran en ciertos pisos.

### 10.4 Pesca (⏸ aparcada, en diseño)
Es un tema delicado: en un mundo de Pokémon, los Pokémon de agua no van a "pescarse a sí mismos". Lo que hay por ahora:
- Los Pokémon de Agua se usan sobre todo para **regar** y para Surf.
- Idea provisional: pescar da **objetos** (algas, conchas, perlas, tesoros hundidos, objetos perdidos) y, **muy de vez en cuando**, aparece un Pokémon de agua como visitante reclutable.
- **No se pescan Pokémon para venderlos ni comerlos.**
- Queda fuera del prototipo. Se retomará más adelante.

### 10.5 Recolección (primera mecánica)
- Recolectables de temporada en zonas silvestres: setas, flores, bayas salvajes, ramas, piedras y Mentas.
- **Puntos de aparición:** cada mañana aparecen objetos en casillas válidas del mapa (por zona y estación), con un máximo por zona para que no se acumulen.
- **Arbustos de bayas:** elementos fijos que se sacuden o recogen con Látigo Cepa y vuelven a dar fruto cada N días.
- **Calidad:** normal / plata / oro. Sube con el nivel de trabajo de recolección.
- **Usos:** comida para los Pokémon (hambre), caja de envío (dinero), ofrendas, petición de visitantes y semillas (algunas bayas).
- Los Pokémon con afinidad de recolección los recogen solos dentro de su zona.

### 10.6 Crafteo y estaciones de trabajo (estilo Palworld)
Las estaciones funcionan **más rápido o solo** si las opera un Pokémon con la afinidad adecuada:

| Estación | Afinidad | Función |
|---|---|---|
| Banco de trabajo | Lucha / Normal | Crafteo básico, construcción |
| Horno | Fuego | Fundir minerales → lingotes |
| Cocina | Fuego | Platos (comida de Pokémon) |
| Telar | Bicho | Lana/seda → tela |
| Barril / Tarro | Agua / Planta | Zumos, conservas, mermeladas |
| Molino | Volador / Lucha | Trigo → harina |
| Generador | Eléctrico | Alimenta máquinas avanzadas |
| Nevera | Hielo | Conserva comida, helados |
| Guardería / Nido | Normal / Hada | Cría y huevos |

Las estaciones se construyen con recursos en una cuadrícula y se pueden mover.

---

## 11. Restauración del valle (progresión principal)

Equivale al Centro Cívico de Stardew, sin texto.

- **Árbol Santuario** en el centro, con N **altares de ofrenda** (paquetes). Cada altar muestra con iconos los objetos que pide.
- Completar un altar → animación → **una zona del valle revive** (cambio visual de paleta y tiles, música nueva, visitantes nuevos).
- Zonas propuestas:
  1. **Prado central** (granja): disponible desde el inicio
  2. **Río y lago**: desbloquea la pesca a fondo y el Surf
  3. **Bosque**: recolección y Pokémon de Planta y Bicho
  4. **Cueva**: minería
  5. **Volcán / termas**: Pokémon de Fuego y forja avanzada
  6. **Costa**: playa, perlas y Pokémon de mar
  7. **Cumbre nevada**: Hielo y última zona
- **"Final":** con todos los altares completos, el Árbol florece. Celebración y créditos. Después se puede seguir jugando.

---

## 12. Comunicación sin diálogo

- **Bocadillos con iconos** para peticiones, emociones (❤️ 💤 🍖 ❗) y estados.
- **Gritos** de cada Pokémon (o sonidos genéricos por tipo).
- **Animaciones** de emoción: saltar de alegría, temblar o dormirse.
- **UI con iconos** en lugar de texto siempre que se pueda. Los menús llevan texto mínimo (nombres y números).
- **Tutorial implícito:** el diseño del primer día guía sin texto (una parcela con brillo, una semilla a la vista, un hueco en el suelo).

---

## 13. Economía

- **Caja de envío de Pelipper:** dejas productos y Pelipper se los lleva por la noche. Por la mañana tienes Pokédólares.
- **Tienda de Kecleon:** abre en el valle tras la primera ofrenda. Vende semillas, planos de estaciones y objetos. El inventario rota por estación.
- **Delibird:** pedidos especiales ocasionales (entrega X → recompensa). Son como las misiones del tablón de Stardew, pero con iconos.
- En qué gastar: semillas, planos, ampliaciones (camas, hábitats, inventario, equipo de 4), decoración.

---

## 14. Pokédex del valle (~50, borrador)

| Rol | Pokémon |
|---|---|
| Iniciales | Bulbasaur, Larvitar, Squirtle (+ evoluciones) |
| Agricultura | Oddish, Sunkern, Hoppip, Lotad, Seedot, Bounsweet |
| Ganadería | Wooloo, Miltank, Combee, Chansey, Mareep, Shroomish, Mudbray, Tropius |
| Minería | Geodude, Diglett, Drilbur, Roggenrola, Onix, Rolycoly, Sableye, Carbink |
| Agua / pesca | Magikarp, Psyduck, Marill, Wingull, Shellder, Clamperl, Corsola |
| Fuego | Growlithe, Slugma, Torkoal, Fennekin |
| Eléctrico | Pikachu, Magnemite, Pachirisu |
| Hielo | Vanillite, Snorunt |
| Construcción / Lucha | Machop, Timburr, Bidoof |
| Bicho / textil | Spinarak, Sewaddle, Volbeat |
| Psíquico / Fantasma | Abra, Litwick, Gastly |
| Servicios / NPC | Pelipper (correo), Kecleon (tienda), Delibird (pedidos), Smeargle (decoración) |
| Fósiles / raros | Omanyte, Kabuto, Eevee |

Son ~55 con evoluciones aparte. Se ajustará cuando cada Pokémon tenga un rol claro.

---

## 15. Presentación

- **Estilo:** escenario pintado, limpio y sencillo (cel shading suave, contornos oscuros nítidos), con sprites de Pokémon de PMD. Referencia visual única: [assets/gen/prueba1_1.png](../assets/gen/prueba1_1.png).
- **Casilla de 24×24**, la escala nativa de PMD (los sprites y el escenario salen del mismo juego).
- **Resolución base:** 480×270 (20×11 casillas) escalada a número entero (×2 = 960×540, ×3 = 1440×810, ×4 = 1920×1080). Sprites de Pokémon píxel perfecto; el escenario se dibuja a resolución de pantalla (bordes nítidos, sin escalera de píxeles).
- **Cámara:** vista cenital 3/4 (top-down), centrada en el Pokémon controlado.
- **Movimiento libre (estilo Stardew):** 8 direcciones, sin cuadrícula. Las acciones apuntan a una casilla de 24×24: la que está frente al Pokémon (teclado) o la que está bajo el cursor dentro del alcance (ratón), con un recuadro que la resalta. Colisiones con cajas por tile y objetos.
- **Origen del arte** (no se dibuja lo que ya existe):
  - **Pokémon:** [SpriteCollab](https://github.com/PMDCollab/SpriteCollab) (sprites de PMD hechos por la comunidad, CC BY-NC 4.0). Tienen 8 direcciones y animaciones Walk, Idle, Sleep, Eat, Attack, Charge…; los tiempos de cada una vienen en `AnimData.xml`. Ruta: `sprite/<dex de 4 dígitos>/<Anim>-Anim.png`.
  - **Escenario (actualizado 2026-10-13):** la referencia visual es `assets/gen/prueba1_1.png` (mapa generado con SDXL). El suelo (césped, tierra) sale de texturas recortadas de ella y se dibuja a resolución de pantalla, sin pixelar; caminos de losas, lagos y matorrales se generan en el propio juego; árboles, rocas y flores se generan con IA local (SDXL) a partir de recortes de la referencia y se limpian. Proceso completo, estado y herramientas: [docs/art/PIPELINE.md](art/PIPELINE.md). Los tilesets de PMD (RawAsset) quedaron descartados como base del escenario.
  - **Dibujo propio** solo para lo que no exista: cultivos en sus fases, estaciones de trabajo, caja de envío, Árbol Santuario, siguiendo la receta de PIPELINE.md.
  - **Descartado:** Minish Cap a 16 px y tilesets de PMD aplanados. Sus herramientas (`tools/extract_tiles.py`, `flatten_tileset.py`, `harmonize.py`) quedan por si acaso.
  - **Valle marchito:** se obtiene recoloreando los tiles reales, sin redibujarlos.
  - Los recursos se descargan con un script a `assets/` y no se versionan ni se redistribuyen.
  - **Créditos** obligatorios en el juego (autores de SpriteCollab y de RawAsset/PMD Origins).
- **Audio:** música tranquila por estación y zona, y gritos de los Pokémon.

### Controles (teclado y ratón)
| Acción | Entrada |
|---|---|
| Mover | WASD |
| Usar movimiento | Clic izquierdo (en la casilla de destino) |
| Elegir movimiento | Rueda / Q-E |
| Cambiar de Pokémon | 1-4 |
| Interactuar / recoger | Clic derecho / F |
| Inventario | Tab / I |
| Mapa | M |

---

## 16. Arquitectura técnica (alto nivel)

- **Phaser 3 + TypeScript + Vite.**
- **Mapas:** Tiled (JSON) con capas de suelo, decoración, colisión y zonas de interacción.
- **Datos:** especies, movimientos, objetos, cultivos, recetas y ofrendas en **JSON/TS tipado** (data-driven). Añadir un Pokémon no requiere programar.
- **Separar simulación y render:** el estado del mundo (tiempo, cultivos, Pokémon, inventario) vive en una capa de simulación pura, sin Phaser. Las escenas solo dibujan y envían **comandos**. Esto prepara el **co-op futuro** (comandos serializables y simulación autoritativa) y facilita los tests.
- **IA:** árbol de utilidad simple (puntúa necesidades y tareas) más búsqueda de caminos A\* en cuadrícula.
- **Guardado:** IndexedDB (con varias ranuras), guardado automático al dormir y exportación/importación en JSON.
- **Escenas Phaser:** `Boot` → `Preload` → `Title` → `World` (+ `UI` superpuesta en paralelo) → `Mine` (pisos).

---

## 17. Alcance por fases

### Fase 0a — Prototipo de recolección (lo primero)
- Un mapa (prado + Árbol Santuario).
- **Bulbasaur controlable** (cámara centrada, movimiento libre estilo Stardew).
- Recolectables que aparecen cada día y arbustos de bayas (Látigo Cepa).
- Inventario básico.
- Reloj diario, energía, dormir (con guardado).
- Caja de envío de Pelipper y dinero.

**Objetivo:** que moverse y recoger con Bulbasaur se sienta bien.

### Fase 0b — Primer compañero y agricultura
- Primer altar de ofrenda (recolectables) → el prado revive.
- Visitante de Agua (Marill) con petición → reclutamiento.
- **Cambio de Pokémon controlado** (Bulbasaur ↔ Marill) e IA autónoma básica (riego).
- Agricultura completa: arar (Látigo Cepa), plantar, regar, crecer, cosechar.

**Objetivo:** validar que cambiar de Pokémon y tener ayudantes autónomos resulta divertido.

### Fase 1 — Vertical slice
- Los 3 iniciales, equipo de 3, unos 10 Pokémon.
- Primavera completa.
- Ganadería (2-3 drops), recolección, 3 estaciones de trabajo.
- Las primeras 2 ofrendas del Árbol y la restauración del río.
- Hambre, felicidad y asignación.
- Tienda de Kecleon.

### Fase 2 — Contenido
- Mina con 20 pisos, pesca, 4 estaciones, unos 30 Pokémon, cría y evoluciones.

### Fase 3 — Completo
- Las 7 zonas, unos 50 Pokémon, final, pulido y co-op (opcional).

---

## 18. Métricas de "chill"

Reglas que el diseño no debe romper:
- Nada se pierde de forma permanente (los visitantes que se van pueden volver).
- Ningún Pokémon muere, enferma ni abandona la granja.
- Las penalizaciones son siempre leves y recuperables.
- No hay temporizadores estresantes salvo el reloj diario.
- Siempre hay algo productivo que hacer, pero nunca una obligación.

---

## 19. Propiedad intelectual

Pokémon es propiedad de Nintendo, Game Freak y The Pokémon Company. Este proyecto es **personal y sin ánimo de lucro**. Si en algún momento se quiere publicar o monetizar, habrá que sustituir las especies, los nombres y los sprites por diseños originales. Por eso los **datos** van separados de la **lógica** (§16): el cambio debe ser de contenido, no de código.

---

## 20. Preguntas abiertas

1. ~~Riego al inicio~~ ✅ Primero recolección; el primer visitante es de Agua. Será Marill.
2. **Pesca:** aparcada (§10.4).
3. **Comida:** ¿los Pokémon comen solo bayas, cultivos y platos (sin carne)? Propuesta: sí.
4. ~~¿Hay avatar?~~ ✅ No. La cámara está centrada en el Pokémon controlado.
5. **¿Pueden recibir apodo los Pokémon?**
6. **¿Shinies?** ¿Variantes raras de visitantes como coleccionable?
7. **Decoración:** ¿cuánto peso tiene la decoración libre de la granja?
8. **Nombre definitivo del juego.**
9. **Duración objetivo:** ¿cuántas horas hasta el "final" (Árbol florecido)? Propuesta: 25-40 h.
