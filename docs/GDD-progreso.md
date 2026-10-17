# Pokémon Valley · progreso y "siempre hay algo que hacer"

Propuesta del 2026-10-17. Problema: la partida se acaba en 2-3 horas. Aquí está por qué y qué sistemas añadir, por
orden de lo que más alarga el juego por menos trabajo. Nada de esto está hecho todavía.

## 1. Diagnóstico: dónde se acaba el juego

Lo que hay hoy es **una línea recta y única**: pueblo → bosque → lago → costa → cantera → pantano → ruinas → volcán →
cumbres, con un alfa al final de cada zona (nv 9 → 28) y 9 misiones del tablón (solo bosque y lago) + 3 de Aipom.
Con un Pokémon a nivel 30 y Glalie derrotado, no queda nada que te empuje:

| Sistema | Lo que pasa | Por qué se agota |
|---|---|---|
| Niveles | Tope útil ≈ 30 (la zona más alta es 20-26). | Subir más no sirve: no hay enemigos de ese nivel. |
| Zonas | 8 zonas de bioma, cada una se cruza una vez. | Nada te hace volver a una zona ya superada. |
| Misiones | 12 en total, se entregan una vez. | No se renuevan (`ZONAS_MISION` solo tiene 2 zonas). |
| Alfas | 6+2, reaparecen a los 5 min. | Siempre el mismo botín (Ball + cura); nada único que conseguir. |
| Equipables | 26 objetos × 3 rarezas, caen al azar (3 % salvajes). | No se puede ir a por uno concreto; no hay fusiones ni mejora. |
| Pokécoins | Solo compran Balls y pociones. | A las 2 h sobran: no hay en qué gastarlas. |
| Captura | ~110 líneas, tablas de día/noche/clima, rincón secreto, shiny con racha. | **Es el sistema más rico y el juego no lo mide ni lo premia**: no hay Pokédex ni objetivo de colección. |
| Equipo | Convertirte en cualquier capturado. | Subir un segundo Pokémon es repetir lo mismo sin premio. |

Resumen: el juego tiene mucho contenido (110 líneas, 8 biomas, clima, hora, rarezas) pero **ningún bucle que lo
reutilice**. Lo que sigue son bucles, no más contenido.

## 2. Propuesta, por orden de rendimiento

### A. Niveles de mundo (el "heroico" del WoW) — lo que más alarga, lo más barato
Al derrotar al alfa de las cumbres (Glalie) se desbloquea el **Mundo II**: todas las zonas suben +12 niveles (bosque
13-19… cumbres 32-38), los alfas +12 con el triple de vida y el botín pasa al escalón siguiente. Mundo III a +24,
Mundo IV a +36 (cumbres 56-62), hasta el nivel 100. Se elige en el tablón o en el mapa del mundo (`estado.mundo`).
- Reutiliza las 8 zonas tal cual: `niveles`, `alfa.nivel` y `rara.nivel` suman el desfase al generar
  (`biomas.ts`/`bosque.ts`); `botin.tierDe` ya escala por nivel.
- Cada Mundo tiene su rareza mínima de botín de alfa: II raro garantizado, III épico, IV **legendario** (rareza nueva,
  ×2,5, color naranja).
- Mundo I sigue existiendo (para subir un Pokémon nuevo desde 1).
- Efecto: de ~30 niveles de recorrido a ~100. Las evoluciones tardías (Dragonite 55, Metagross 45, Tyranitar 55…)
  pasan a ser alcanzables, que hoy no lo son.
- Coste: 1 día.

### B. Pokédex con premios — el objetivo a largo plazo
Tecla P (o pestaña del tablón): las líneas de cada zona en cuadrícula, con silueta (no vista), cara (vista) o cara a
color con Ball (capturada). Por zona dice "capturadas 9/21" y el momento en que sale cada una (sol, luna, nube).
- **Premios por zona**: al 50 % capturadas un equipable raro de la zona; al 100 %, uno épico y el **título** de la
  zona (sale bajo tu nombre en la placa, como en el WoW). Pokédex entera: Master Ball.
- Cuenta lo que ya existe: `estado.derrotas` + un `estado.vistas`/`capturadas` nuevo. Las tablas de `aparicion.ts`
  dan la lista de cada zona.
- Es lo que da sentido a lo de día/noche/clima/rarísimas que ya está hecho: ahora mismo nadie sabe que existen.
- Coste: 2 días (el panel es lo más largo).

### C. Misiones que se renuevan — el "qué hago hoy"
- El tablón da misiones de **todas** las zonas (hoy solo bosque y lago): quitar el límite de `ZONAS_MISION`, con
  `AJUSTE` por escalón de nivel en vez de por zona.
- **Diarias**: cada día de juego (10 min reales) el tablón saca 3 nuevas al azar de una lista: derrotar N de una
  línea, capturar una, derrotar un alfa, traer N bayas/materiales, "derrota 10 salvajes de noche", "captura uno bajo
  la lluvia". Dan Pokécoins + exp del nivel de tu Pokémon (para que sirvan en cualquier Mundo) y, una de cada 5, un
  equipable raro.
- **Encargo semanal**: una cadena de 3 (como la de Aipom) por un épico.
- `misiones.ts` ya genera por semilla; falta un generador con semilla `semilla + día` y `estado.misiones` con fecha.
- Coste: 1 día.

### D. Botín con sentido: tabla por alfa, fusiones y tienda rotativa — el sumidero de Pokécoins
- **Cada alfa tiene su tabla**: 3 equipables fijos (Pidgeotto: Pico Afilado, Pañuelo Seda, Banda Focus…). Se ve en la
  ficha del alfa en el mapa del mundo. Es el bucle "voy a por X" del WoW. En `botin.ts`, una tabla por zona.
- **Fusión** en el almacén del mercado (F): 3 comunes del mismo objeto + 300 Pokécoins → raro; 3 raros + 1 000 →
  épico; 3 épicos + material del Mundo IV → legendario. Da uso a los comunes repetidos y a las monedas.
- **Tienda rotativa**: Kecleon vende cada día 2 equipables al azar (uno raro, caro) y el vuelo cuesta Pokécoins según
  la distancia.
- Coste: 1,5 días.

### E. Logros — la sensación de avanzar
Lista de hitos con barra (panel L o pestaña de la Pokédex): 10/100/1 000 derrotas, 10/50/100 capturas, primer shiny,
todos los alfas, todas las zonas, todos los puntos de vuelo, 5 Pokémon a nivel 30, un Pokémon de cada tipo,
Mundo II/III/IV… Cada uno da Pokécoins y los grandes, un título. Aviso dorado al cumplirlo (como el del WoW).
- Todo son contadores sobre `estado`; lo caro es el panel.
- Coste: 1 día.

### F. Equipo: subir a varios compensa
- **Experiencia compartida**: los Pokémon del pueblo ganan el 25 % de la que ganas tú (como en los juegos modernos).
  Un capturado de nivel 8 no es inútil cuando ya vas por 40.
- **Caramelo Raro** en botín de Mundo II+ y en logros.
- Los logros de "un Pokémon de cada tipo a nivel N" empujan a jugar con varios.
- Coste: 0,5 días.

### G. Materiales y huerto (más adelante)
Los salvajes sueltan materiales de su tipo (pluma, escama, polvo…): para fusiones, misiones de "traer N" y el huerto
del pueblo (sembrar bayas, que ya tiene parcelas). Es el crafting completo; va después de D.

## 3. Orden recomendado y lo que se gana

| Paso | Horas de juego que añade (estimación) | Trabajo |
|---|---|---|
| A. Mundos | de 3 h a ~10 h (el recorrido se triplica) | 1 día |
| C. Diarias + todas las zonas | sesiones de 20-30 min con objetivo claro | 1 día |
| B. Pokédex | objetivo de 20-40 h (110 líneas, raras del 0,5 %) | 2 días |
| D. Botín por alfa + fusión | razón para repetir alfas y gastar | 1,5 días |
| E. Logros | sensación continua de avanzar | 1 día |
| F. Exp compartida | hace útil capturar y cambiar de Pokémon | 0,5 días |

Con A + C + B la partida pasa de "acabada en 3 h" a tener un final (Mundo IV, Pokédex entera) que cuesta 30-40 h y
sesiones cortas con algo que hacer (diarias). D, E y F son lo que lo hace sentirse un MMO.

## 4. Lo que se guarda (nuevo en `Estado`)
`mundo` (1-4), `vistas` y `capturadas` (por línea), `diarias` (día y lista), `logros` (id → cuándo), `titulo`
(el que llevas). Todo compatible con las partidas de ahora (valores por defecto al cargar).
