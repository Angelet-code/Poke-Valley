# Plan: el escenario en estilo Arcane

Decisión del 2026-10-15, tras la prueba A/B del Lago Celeste ([GDD-mundo.md](../GDD-mundo.md) §3, `assets/gen/ab_lago/`).
El escenario pasa del estilo dibujo (Klein sobre el dibujo del lab) a un estilo **Arcane**: pintura digital con
pinceladas visibles, línea de tinta oscura y colores apagados con luces cálidas y sombras frías. Los Pokémon siguen
siendo los sprites PMD.

**Reglas que no cambian:**
- Nada se borra. El catálogo dibujo se queda donde está y el Arcane va en una carpeta aparte.
- Arte solo con IA local (Klein en ComfyUI).
- Vista 3/4 de frente. En los estilos pintados también vale el isométrico.
- Se comprueba siempre en el navegador.

## Idea técnica
Las zonas colocan los elementos por id (`arbol_alto`, `roca_2`…). Cambiar de estilo es cambiar **el catálogo** y
**la paleta y las texturas del suelo**, no los mapas. Así se puede ir zona a zona y comparar en cualquier momento.

- **Catálogo:**
  - Va en `lab/assets/elementos_arcane/`, con `elementos.json` y los mismos ids que `elementos_klein/`.
  - Lo monta un `catalogo_arcane.py`, copia de `lab/tools/catalogo_klein.py`, con la misma cadena: generar →
    ampliar ×2 → `recortar.py` (alfa + sombra aparte) → `k` según el ancho en el mundo.
  - **Interruptor**: `?set=arcane` en el juego, como `?set=original` en el lab.
    - Con él, `Dibujo.catalogo()` lee la carpeta Arcane.
    - Un id que todavía no exista en Arcane sale del catálogo dibujo. Así se puede ir pieza a pieza sin romper nada.
- **Suelo:**
  - Un `PALETA_ARCANE` (césped, tierra y arena, agua, orilla) con colores medidos en la escena de referencia.
  - Texturas de césped y tierra sacadas de esa escena con `tools/quilt.py`, como se hizo con `cesped_ref`. Así el
    suelo también lleva pincelada.
  - `Terrain` ya admite paleta y texturas propias (`OpcionesSuelo`), así que no hace falta tocar el motor del suelo.
- **Agua:** la del suelo con la paleta Arcane (azul verdoso apagado). Más adelante, una textura de pinceladas como
  la de la referencia y ondas en la orilla.
- **Luz:** la curva del día (`luzAmbiente`) se queda, quizá con un ambiente algo más frío. La noche con farolas
  encaja muy bien con Arcane.

## Referencia única
Hace de **referencia de estilo** la escena repintada `assets/gen/ab_lago/escena/arcane_s1_0.png` (copia en
`docs/art/ref/arcane_lago.png`), igual que `prueba1_1.png` lo fue del pixel art y `aldea_dibujo.png` del dibujo.

- **Elementos que ya existen** (árboles, rocas, casas…): Klein `--edit` del elemento dibujo, "the same <x>, repainted
  in the style of the reference…". Conserva la forma y la huella de colisión, y solo cambia la pintura.
- **Piezas nuevas:** Klein con la referencia Arcane (`--edit`) y el prompt de `gen2.sh` (`EST[arcane]`).
  - En la ronda 2 se hicieron sin referencia (txt2img). Con referencia, todas las piezas comparten paleta.

## Fases

| Fase | Qué | Piezas | Cómo se da por buena |
|---|---|---|---|
| **0. Base** | Referencia, `PALETA_ARCANE`, texturas de suelo, `?set=arcane`, `catalogo_arcane.py` | — | El lago con suelo Arcane y los elementos todavía en dibujo, sin errores |
| **1. Lago** | Lo que sale en el Lago Celeste | `arbol_alto`, `arbol_bajo`, `arbusto`, `roca_0/2/4/6`, `tocon`, `flores`, `piedras_0` (rehechos) + `sauce`, `juncos`, `muelle`, `nenufar` (nuevos), ~14 | Captura del lago entero, de día y de noche, frente a la referencia |
| **2. Bosque** | Lo que falta del Bosque Verde | `estanque`, `roca_1/3/5/7/8` + `seta`, `tronco_caido`, `arbol_viejo`, `panal`, `poste` (nuevos), ~10 | Captura del bosque y de la salida al lago |
| **3. Pueblo** | Casas y mobiliario | `casa_grande/cabana/larga/chimenea`, `almacen`, `tienda`, `pozo`, `hoguera`, `valla`, `farola`, `farola_madera`, `camino_c/d/e`, `tablon` (nuevo), ~14 | Pueblo de día y de noche (farolas) |
| **4. Remate** | Lo que destaque | Contraste de los PMD sobre fondo oscuro (un borde claro sutil si hace falta), HUD con marcos a juego, sombras | Pase completo pueblo → bosque → lago |

**Hecho (2026-10-15): Arcane es el modo por defecto.** El dibujo se ve con `?set=dibujo`.

**Coste estimado:** ~38 piezas × 3 semillas a ~1 min en la 3060 Ti dan ~2 h de máquina, más la elección y el
recorte. Las casas son lo más delicado: hay que conservar la huella y la puerta, porque `SUELOS` y las colisiones
dependen de ellas.

## Riesgos
- **Los Pokémon pixel art sobre un fondo pintado y oscuro.** En la prueba se leían bien. Si cuesta, un borde claro
  de 1 px o un poco más de luz cel.
- **Las sombras pintadas** que Klein pega al objeto. `recortar.py` separa la sombra cuando está fuera del contorno.
  Si no, se recorta a mano o se pide "no cast shadow".
- **La coherencia entre piezas.** Por eso se usa siempre la misma referencia y el mismo prompt, y una hoja de
  contacto por fase antes de meter nada.

## Estado

### Fases 0 y 1 hechas (2026-10-15)
Se ve con `http://127.0.0.1:5174/?set=arcane`. Capturas: [lago_vista](arcane/lago_vista.jpg),
[lago_dia](arcane/lago_dia.jpg) y [lago_noche](arcane/lago_noche.jpg).

- **Interruptor** (`ARCANE` en `src/config.ts`), que cambia tres cosas:
  - `PALETA_DIBUJO` pasa a ser `PALETA_ARCANE` (`src/data/mapaDibujo.ts`);
  - `Preload` carga el suelo de `lab/assets/suelo_arcane/`;
  - `Dibujo.catalogo()` pone los elementos Arcane encima de los Klein con el mismo id.
- **Suelo**:
  - Las texturas salen de quilt sobre la referencia directamente quedaban cargadas: garabatos de tinta y manchas de
    camuflaje. Además, el césped cogía agua oscura, así que `tools/quilt.py --kind color` compara también el matiz.
  - Se hicieron otra vez con Klein `--edit` de la referencia, como "textura de césped/tierra en este estilo"
    (`assets/gen/arcane/suelo/`, semillas: césped s1, tierra s2).
  - Se reducen a 360 px y se pasan por `quilt.py --kind color --block 48 --scale 1` para que sean repetibles. El
    fundido con una copia desplazada (`repetible.py`) dejaba una cruz.
  - Hoja: `lab/assets/suelo_arcane/hoja_suelo.png`.
- **Piezas** (`assets/gen/arcane/lago/gen.sh`, hoja `hoja.png`):
  - Receta: Klein `--edit docs/art/ref/arcane_lago.png` (la referencia sola) más la pieza descrita con palabras,
    sobre verde liso, a ~20 s por imagen.
  - Editar la pieza dibujo con la referencia como segunda imagen apenas cambiaba el estilo
    (`pruebas/prueba_conservador_arbol.png`).
  - Elegidas:
    - árboles y arbusto: arbol_alto s1, arbol_bajo s3, arbusto s2;
    - rocas: roca_0 s2, roca_2 s1, roca_4 s2, roca_6 s1;
    - lago: sauce s2, juncos s2, muelle s2, nenufar s2;
    - suelo: flores s1, piedras_0 s2, tocon s1.
- **Catálogo**: `lab/tools/catalogo_arcane.py` → `lab/assets/elementos_arcane/` (hoja `hoja.png`).
  - El ancho en el mundo es el del elemento dibujo con el mismo id.
  - `recortar.py` tiene ahora `abrir_huecos=False`: el brillo verdoso de lo alto de las rocas tiene el color del
    fondo y quedaba agujereado.
- **Lago** (`src/data/bosque.ts`):
  - El muelle está en la orilla sur, bajo el islote, y el alfa Golduck a su lado.
  - Hay 4 sauces por fuera del camino, 16 juncos en el borde del agua (sustituyen a los arbustos provisionales) y 12
    nenúfares sobre el agua.
- **Sin `?set=arcane`**: el catálogo dibujo tiene ahora sauce, juncos y muelle (los de la prueba A/B, en
  `catalogo_klein.py`). El nenúfar solo existe en Arcane.

### Pendiente de las fases 0 y 1
- Los árboles y las rocas llevan pegada la sombra pintada por Klein. En los árboles se suma al óvalo del juego y
  queda algo doble.
- El agua es lisa, sin pincelada.
- Los juncos se ven pequeños (22 px de ancho).

### Fase 2 hecha (2026-10-15): el Bosque Verde
Capturas: [bosque_vista](arcane/bosque_vista.jpg), [bosque_arbol_viejo](arcane/bosque_arbol_viejo.jpg),
[bosque_claro](arcane/bosque_claro.jpg) y [bosque_noche](arcane/bosque_noche.jpg).

- **Piezas** (`assets/gen/arcane/bosque/gen.sh`, la misma receta que el lago; hoja `hoja.png`). Elegidas:
  - estanque s3, arbol_viejo s2 (con hueco en el tronco);
  - rocas: roca_1 s2, roca_3 s1, roca_5 s2, roca_7 s1, roca_8 s1;
  - seta s1, tronco_caido s2, panal s1, poste s2.
- **Catálogo Arcane**: 25 elementos (`lab/assets/elementos_arcane/hoja.png`).
  - El nenúfar es de tipo `losa` (`TIPO_JUEGO` en `catalogo_arcane.py`). Como `detalle`, Aventura lo repartía por
    el césped.
- **Bosque** (`src/data/bosque.ts`):
  - El árbol viejo está al fondo del claro más lejano, con el alfa Pidgeotto delante.
  - Por los claros hay 4 troncos caídos, 2 panales y 12 setas (planas), y las rocas 1, 3, 5 y 7.
  - Hay un poste junto a cada salida: entrada del bosque, salida del este y salida del lago al bosque.
- **Sin `?set=arcane`**: las piezas nuevas no existen en el catálogo dibujo y no se dibujan. Esto vale para la
  seta, el tronco, el panal, el árbol viejo, el poste y el nenúfar.

### Fase 3 hecha (2026-10-15): el pueblo
Capturas: [pueblo_vista](arcane/pueblo_vista.jpg), [pueblo_dia](arcane/pueblo_dia.jpg) y
[pueblo_noche](arcane/pueblo_noche.jpg).

- **Receta "repintado"** (`assets/gen/arcane/pueblo/gen.sh`):
  - Klein `--edit` con dos imágenes: la pieza dibujo y la referencia. El prompt de estilo es fuerte ("completely
    repaint… clearly visible brushstrokes…") y pide "la misma forma, en el mismo sitio".
  - Con un prompt suave apenas cambiaba (lo de la fase 1). Con este sale un Arcane claro y conserva la silueta
    (comparativa en `pruebas/`).
  - El tablón, que es nuevo, sale de la referencia sola.
- **Elegidas:**
  - casas: casa_grande s1, casa_cabana s2, casa_larga s1, casa_chimenea s1, tienda s2, almacen s2;
  - mobiliario: pozo s1, hoguera s1, valla s1, farola s1, farola_madera s1, tablon s2;
  - caminos: camino_c/d/e s1.
- **Alineado con el dibujo** (`alinear()` en `catalogo_arcane.py`):
  - El recorte repintado sale más ancho, porque incluye la sombra pintada. Escalado por el ancho, las casas quedaban
    un 13-17 % más pequeñas y desplazadas.
  - Se busca el desplazamiento entre los dos recortes (0-8 px) y se toman del dibujo el ancla, la escala y la huella.
  - Las casas llevan además `ref` (ancla y escala del dibujo): `Dibujo.dibujar` pasa con ella los polígonos de
    SUELOS al mundo, así que las colisiones son las mismas que en el estilo dibujo.
  - El punto de luz de farolas y hoguera va en proporción a la altura y sigue valiendo.
- **Valla:** tiene `abrir_huecos` (`ABRIR_HUECOS`), porque el interior del corral debe verse transparente.
- **Pueblo** (`src/data/bosque.ts`):
  - El tablón de misiones usa `tablon` en Arcane; en dibujo sigue la valla provisional.
  - Hay un poste junto a la salida al bosque.
- **Catálogo Arcane:** 40 elementos. Las tres zonas están completas con `?set=arcane`.

### Siguiente: fase 4 (remate)
- ~~Probar si `?set=arcane` pasa a ser el modo por defecto.~~ Hecho: es el de por defecto (`?set=dibujo` para comparar).
- El agua lisa y la sombra doble de los árboles (pendientes de la fase 1).
- Las manchas de arena del pueblo se ven como manchas planas.
- Que los Pokémon se lean bien sobre el fondo oscuro, y los marcos del HUD a juego.

## Muros y barreras (2026-10-15)
Piezas grandes que no se cruzan, y piezas para construir a gusto, para las zonas de bioma y el set común (bosque,
lago y pueblo). Para cada uno de los 7 sets (`comun`, `costa`, `cantera`, `pantano`, `ruinas`, `volcan`, `nieve`):

| Pieza | Forma | Qué es |
|---|---|---|
| `acantilado` | tira H y V | Barrera natural: pared de roca (o talud de raíces en el pantano, columnas de basalto en el volcán) |
| `escalera` | inserto del acantilado | El mismo acantilado con escalones: se sube por el centro |
| `montana` | suelta (190 px) | Macizo de roca que no se cruza |
| `arboleda` | suelta (170 px) | Grupo cerrado de árboles (en la cantera, un derrumbe; en el volcán, agujas de obsidiana) |
| `muro` | tira H y V | Muro construido (piedra seca, rompeolas, empalizada, bloques de hielo…) |
| `porton` | inserto del muro | El muro con una puerta abierta |
| `valla` | tira H y V | Valla baja |
| `puente` | tira H y V | Puente: se pisa sobre el agua |

- **Generación** (`assets/gen/arcane/muros/gen.sh`, lista en `piezas.txt`): la receta de los biomas (Klein `--edit` de
  la referencia sola). Las tiras horizontales en 1280×640 ("de borde a borde, recta, del mismo alto") y las verticales
  en 640×1280 ("alejándose del espectador, ortográfica, bordes paralelos"). Semilla elegida en `muros/elegidos.json`
  (`{"<bioma>/<pieza>[_v]": N}`; 1 si no está). Hojas de semillas: `muros/<bioma>/hoja.png` (`--semillas`).
- **Recorte y kit** (`lab/tools/tiras_arcane.py`): ampliar ×2 → `recortar.py` → según la forma:
  - **H**: se endereza (la base de cada columna a una recta) y se parte en `<pieza>_<bioma>_izq`, `_tramo` y `_der`.
    El tramo se repite sin junta: su final vuelve a su principio por una **costura de corte mínimo** (el camino de
    menor diferencia entre dos bandas, como en el quilting), con el color premultiplicado para que no salga halo
    verde. El extremo derecho empieza con otra costura desde el principio del tramo. Los cortes se eligen buscando
    el menor error.
  - **V**: antes se corrige la perspectiva (cada fila se estira para que los bordes queden paralelos) y luego igual,
    a lo largo de y: `<pieza>_v_<bioma>_arr`, `_tramo` y `_abj`.
  - **Insertos**: el centro de la imagen, al alto del tramo, con costuras al tramo por los dos lados.
  - **Sueltas**: como el resto del catálogo, con su sombra aparte. Id `<pieza>_<bioma>`.
  - Todas las piezas de una tira tienen el mismo alto (H) o ancho (V) y la misma base. Tamaño en el mundo: muro 40,
    acantilado 76, valla 26 y puente 46 px de alto; en vertical, 30, 70, 16 y 44 px de ancho.
  - Hoja con cada tira montada (extremo + tramos + inserto + extremo) a su tamaño real: `elementos_arcane/hoja_muros.png`.
- **En el juego**: un `Colocado` con `tira: {hasta, inserto?, en?}` es una tira entera de `x` a `hasta` (o de `y` a
  `hasta` en las verticales, ids `<pieza>_v_<bioma>`); `Dibujo.expandirTiras` la cambia por sus piezas.
  - Huella: el pie del muro (una banda de ~1/3 del alto). Los insertos tienen dos huellas, a los lados del paso.
  - Los puentes son planos (se dibujan bajo el Pokémon) y dejan un rectángulo de paso sobre el agua.
  - **Taller** (mapa de prueba): `?taller=<bioma>` y en la consola
    `pv.scene.getScene('title').scene.start('aventura', {mapa: 'taller'})`.
- **Estado (2026-10-15):** los 7 sets hechos con la semilla 1, salvo la escalera del volcán (semilla 3: la 1 salió sin
  escalones). 85 imágenes → 196 piezas en el catálogo. Comprobado en el taller (común, volcán y nieve): muros y
  acantilados frenan, escalera, portón y puentes dejan pasar.
  - Flojos: el puente horizontal común no trae barandilla en el centro; los acantilados verticales se leen más como
    una loma que como una pared, y su tramo es largo (~140 px).
  - Ya en las zonas de bioma: puentes en los ríos y acantilados/muros en los bordes del macizo ([GDD-mundo.md](../GDD-mundo.md) §5d).
  - Una tira puede ser solo sus dos extremos (encajan: el derecho empieza donde acaba el izquierdo); los puentes
    cubren todo su largo y el resto cabe dentro, centrada.
  - Silueta de cada pieza para colocarlas sin tapar lo pisable: `python -I lab/tools/mascaras_arcane.py` añade `cubre`
    a elementos.json. Hay que ejecutarlo de nuevo tras `catalogo_arcane.py` o `tiras_arcane.py`.
  - Pendiente: repetir con semilla 2 lo flojo.
