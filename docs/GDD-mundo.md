# Pokémon Valley · el mundo (zonas)

Plan del 2026-10-15: pasar de dos mapas sueltos a un mundo por zonas, como Azeroth pero en pequeño. La primera
versión tiene **3 zonas**. El combate, la captura y los niveles están en [GDD-combate.md](GDD-combate.md).

Código: [src/data/bosque.ts](../src/data/bosque.ts) (zonas: `crearMapa`, alfas, tablón), [src/scenes/Aventura.ts](../src/scenes/Aventura.ts)
(cambio de zona, colisión con el agua) y [src/scenes/HudAventura.ts](../src/scenes/HudAventura.ts) (rótulo de zona).
Misiones y alfas: §2.

## 1. Zonas de la v1

```
  Lago Celeste (nv 5-10) ◄── este ── Bosque Verde (nv 1-7) ◄── camino del sur ── Pueblo
```

| Zona | Nivel | Qué hay | Especies | Estado |
|---|---|---|---|---|
| **Pueblo** | — | Tu hogar. Tus Pokémon pasean por la plaza; con F te conviertes en ellos. | — | Hecho |
| **Bosque Verde** | 1-7 | Claros unidos por senderos y borde espeso de árboles. Al fondo, un sendero sale por el este al lago. | 7 de `ESPECIES_BOSQUE` (Bicho, Planta, Volador…) | Hecho |
| **Lago Celeste** | 5-10 | Lago con islote, playas a trozos, un camino que lo rodea, rocas y arbustos en la orilla. | 7 de `ESPECIES_LAGO` (Psyduck, Marill, Magikarp, Pachirisu…) | Hecho con arte provisional |

![Lago Celeste v1](img/lago_celeste_v1.jpg)

- **Mundo fijo.** Cada zona procedural sale siempre igual con la semilla de la partida (`estado.semilla`). Antes el
  bosque cambiaba cada vez que entrabas.
- **Rótulo al entrar** (como en el WoW): el nombre de la zona en grande y, debajo, nivel y tipos. Arriba a la derecha
  sigue el nombre de la zona con la hora.
- **El agua es del suelo** (vértices 3 de `Terrain`): bloquea el paso (`Terrain.esAgua`) y no lleva la pared de roca
  pixel art (`Paleta.sinPared` en la paleta dibujo).
- **Cambio de zona**: andando hasta el borde, con un fundido. El suelo tarda 1-2 s en calcularse (consola: "Suelo
  listo en X ms").

### Formato de una zona (`MapaAventura`)
`id`, `nombre`, `lema` (lo que dice el rótulo), `bienvenida` (aviso al entrar), `datos` (suelo: 0 césped, 1 tierra o
arena, 2 losas, 3 agua), `colocados` (elementos del catálogo por id), `llegada` (dónde apareces según de dónde vienes,
con la dirección), `salidas` (rectángulos del borde y a qué zona llevan), `salvajes` (especie, nivel y sitio) y, si
tiene, `alfa` (línea, forma, nivel y sitio) y `tablon` (pueblo).

Para añadir una zona: escribir su generador (o un mapa a mano), añadirla a `MapaId` y a `crearMapa`, y abrir una salida
en la zona vecina.

**Las zonas no dependen del estilo.** Colocan elementos por id (`arbol_alto`, `roca_2`…). Si se cambia de estilo,
cambia el catálogo de elementos, no las zonas.

## 2. Misiones y alfas

### Misiones sin diálogo (hecho, 2026-10-15)
Código: [src/combate/misiones.ts](../src/combate/misiones.ts) (qué misiones hay), [src/combate/partida.ts](../src/combate/partida.ts)
(progreso guardado en `estado.misiones`), [src/scenes/Aventura.ts](../src/scenes/Aventura.ts) (tablón, contar) y
[src/scenes/HudAventura.ts](../src/scenes/HudAventura.ts) (panel y seguimiento).

- **Tablón en la plaza del pueblo** (`MapaAventura.tablon`). Arte provisional: un trozo de `valla`. F a su lado abre
  el panel; se cierra al alejarte, con F o con Esc.
- **3 misiones por zona**, que salen de los salvajes de esa zona con la semilla de la partida (piden especies que de
  verdad están):
  - derrotar N de la especie más común (5 en el bosque, 6 en el lago);
  - capturar uno de la segunda especie más común;
  - derrotar al alfa.
- **Solo iconos**: cada carta lleva la cara del Pokémon, el icono del tipo (espadas = derrotar, Poké Ball = capturar,
  corona y marco rojo = alfa), "×N" o lo que llevas ("2/5") y, abajo, la recompensa: "+exp" y los objetos con su icono.
  Clic en una nueva = aceptarla; clic en una cumplida = entregarla. Las entregadas quedan apagadas con un visto.
- **Recompensas**: experiencia (3× la de derrotar a uno de esa especie; 4× la del alfa), Bayas Aranja o Zidra y
  Poké/Super/Ultra Balls según la zona (`AJUSTE` en `misiones.ts`).
- **Señales**: "?" sobre el tablón si tienes alguna cumplida, "!" si hay alguna sin aceptar.
- **Seguimiento** a la derecha del HUD, bajo la hora: cara + icono + "2/5"; en dorado con "?" cuando está cumplida.
  Al avanzar, sale "2/5" sobre tu Pokémon.
- Cuenta cualquier forma de la línea (un Gloom cuenta para "derrotar Oddish").
- Falta: "traer N de algo que sueltan" (cuando los salvajes suelten materiales) y misiones que se renueven.

### Alfas (hecho, 2026-10-15)
Uno por zona (`MapaAventura.alfa`, data/bosque.ts), con una forma fija aunque no toque por nivel:
- **Bosque**: Pidgeotto alfa de nivel 9 en el claro del fondo (junto al árbol viejo cuando haya arte).
- **Lago**: Golduck alfa de nivel 12 en la orilla del este (en el muelle cuando haya arte).

Cómo es (constantes `ALFA_*` en Aventura.ts):
- Sprite ×1,4, aura rojiza que late (resplandor + anillo en el suelo), barra de vida más ancha con borde dorado y el
  triple de vida. Siempre peleón. No se deja capturar.
- **Golpe anunciado**: cada 8-11 s, si estás a menos de 190 px, se para a cargar y marca un círculo rojo en el suelo
  donde estás; se llena en 1,8 s y, si sigues dentro, te quita el 35 % de la vida. Si sales: "¡Esquivado!".
- Da el triple de experiencia y suelta siempre una Super Ball (bosque) o Ultra Ball (lago) y una Baya Zidra.
- **Reaparece a los 5 minutos** de tiempo real: la hora de su caída se guarda en `estado.alfas`, así que cuenta
  aunque cambies de zona.

### Mundo continuo (v2)
Hoy el suelo de cada zona es un único canvas a resolución de pantalla. Un mundo de 3 zonas a zoom 4 ocuparía unos
10 000 × 8 000 px, más que el tamaño máximo de textura de muchas GPU. Para quitar el fundido hay que trocear
`Terrain`: calcular y pintar el suelo en trozos de unos 512 px alrededor del jugador y soltar los lejanos. Cuando
esté, las zonas se colocan juntas en un mapa del mundo y las salidas desaparecen.

## 3. Arte que hace falta

Los Pokémon ya están: sprites PMD de todas las líneas, y los alfas usan el mismo sprite (×1,4 con aura). El suelo (césped, arena y
agua) es procedural. Lo que falta son elementos del escenario.

**Lo que ya existe en estilo dibujo** (`lab/assets/elementos_klein/`):
- `arbol_alto`, `arbol_bajo`, `arbusto`, `tocon`;
- `roca_0`…`roca_8`, `piedras_0`, `flores`, `estanque`;
- las casas, `almacen`, `tienda`, `pozo`, `hoguera`, `valla`, las farolas y los caminos.

### Piezas nuevas para la v1

| # | Pieza | Zona | Para qué | Tipo de elemento |
|---|---|---|---|---|
| 1 | Juncos / espadañas (2 variantes) | Lago | Borde del agua; hoy son arbustos provisionales | detalle con sombra |
| 2 | Nenúfares (2 variantes) | Lago | Sobre el agua | plano (sin sombra ni colisión) |
| 3 | Muelle de madera | Lago | Hito; guarida del alfa | edificio (suelo en rombo) |
| 4 | Sauce llorón | Lago | El árbol del lago, para que no parezca el bosque | árbol |
| 5 | Árbol viejo gigante | Bosque | Hito; guarida del alfa | árbol grande |
| 6 | Tronco caído | Bosque | Obstáculo y variedad | roca (huella alargada) |
| 7 | Setas (2 variantes) | Bosque | Detalle del suelo del bosque | detalle |
| 8 | Panal de Combee | Bosque | Objetivo de misión | roca |
| 9 | Poste indicador sin texto (flechas con iconos) | Todas | En cada salida, para saber adónde lleva | roca |
| 10 | Tablón de misiones | Pueblo | Misiones sin diálogo; hoy es un trozo de `valla` | roca |

En total, unas 13 imágenes. Los iconos de misión ("!", "?", espadas, corona) y el círculo del ataque del alfa son
interfaz y se hacen en código (ya están).

### ¿Estilo dibujo o pixel art?

| | Estilo dibujo (el de ahora) | Pixel art |
|---|---|---|
| Piezas para la v1 | ~13 nuevas | ~13 nuevas + rehacer las ~30 existentes + el pueblo |
| Herramientas | Klein → elemento + máscara de sombra. Probado, sale limpio. | Generar y limpiar a mano para que no tenga ruido. Más lento. |
| Ya funciona con… | luz de día y noche, sombras proyectadas, normales y cel, colisión con polígono, transparencia de lo que tapa | habría que adaptarlo todo |
| Encaje con los Pokémon (PMD) | Mezcla de estilos, poco visible a zoom 3 | Coherencia total |

**Recomendación: seguir con el estilo dibujo en la v1.** Cuesta 3-4 veces menos arte y todo lo técnico ya funciona.
Las zonas no dependen del estilo, así que la duda no bloquea el trabajo.

Para decidir con algo delante: hacer una prueba A/B con 3 piezas del lago (sauce, juncos, muelle) en los dos estilos,
ponerlas en el Lago Celeste con los mismos Pokémon y comparar capturas.

**Prueba A/B hecha (2026-10-15)**, en `assets/gen/ab_lago/` (`gen.sh` genera; `procesar.py hoja` y
`procesar.py final <id> <semilla dibujo> <semilla pixel>` recortan):
- Comparativa: [capturas/comparativa.png](../assets/gen/ab_lago/capturas/comparativa.png); en el juego,
  `capturas/A_dibujo.jpg` y `B_pixel.jpg`.
- Todas las semillas en `hoja.png`.
- Elegidas:
  - **dibujo**: sauce s1, juncos s2 y muelle s4 (repetido de frente; los s1-3 salieron con la esquina hacia la
    cámara, y en dibujo valen las dos vistas);
  - **pixel**: sauce s1, juncos s1 (a 24 px: a 18 px se perdían los tallos) y muelle s2.
- Se colocaron desde la consola (`Dibujo.dibujar` para el estilo dibujo, imagen NEAREST con sombra elíptica para el
  pixel art), sin tocar el código. Ninguna pieza está aún en el catálogo del juego.
- **Ronda 2 (2026-10-15): dos estilos más**, Arcane (pintura digital con pinceladas y línea de tinta) y acuarela/gouache
  (película de animación japonesa acogedora).
  - Piezas: Klein txt2img sobre verde liso (`gen2.sh`, `hoja2.png`), recortadas con `procesar.py pintado <estilo> <id>
    <semilla>` en `final_arcane/` y `final_acuarela/`.
    - **Arcane**: sauce s1, juncos s1, muelle s3.
    - **Acuarela**: sauce s1, juncos s1, muelle s1. A los juncos y al muelle se les quitó a mano la mancha de agua
      verde pálida del fondo.
  - Escena: la captura del juego repintada entera con Klein `--edit` (`escena/`). Es una maqueta de ambiente, no el
    juego; con pixel art el repintado casi no cambia nada.
  - Comparativas:
    [capturas/comparativa_piezas.png](../assets/gen/ab_lago/capturas/comparativa_piezas.png) (las 3 piezas en el
    juego, 4 estilos) y
    [capturas/comparativa_escenas.png](../assets/gen/ab_lago/capturas/comparativa_escenas.png) (la escena entera).
