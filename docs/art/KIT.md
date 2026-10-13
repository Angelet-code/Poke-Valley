# Kit de edificios (piezas + compositor)

Estado: 2026-10-13, primera versión, **pendiente de visto bueno**. Resultados de prueba en
`assets/gen/edificios/kit/` (`preview_kit.png`, `detalle_x12.png`); no sustituye todavía a
`assets/game/pixel/edificios/casa.png` ni `tienda.png` (eso se decide con el usuario).

## Por qué

Retocar a mano cada sprite salido de la IA (V2→V6 de los edificios) es muy farragoso y el GDD pide
muchos (9 estaciones, tienda, casa, granero/hábitats, caja de envío, Árbol Santuario…). El kit
separa el trabajo en dos:

1. **Piezas** (puerta, ventanas, chimenea, mercancía, muestras de muro…): pixel art real, sacado de
   los sprites Flux ya limpios (V6) o dibujado a píxel una sola vez, limpio y comprobado.
2. **Compositor** (`tools/edificio.py`): monta un edificio a partir de un plano JSON pequeño. Él dibuja
   lo que depende de la geometría (tejado, alero, cumbrera, muros, toldo) aplicando las reglas de
   pixel art de `PIPELINE.md` §3b, y estampa las piezas. Un edificio nuevo = un JSON de 10 líneas y
   0,2-0,5 s.

No es el "dibujo a primitivas" rechazado (V1): las piezas son el arte de la IA limpiado, y el
compositor solo repite, recorta y alinea con la geometría correcta.

## Las reglas que el compositor impone

- **Contornos de 1 px con tramos regulares**: el alero frontal, el borde trasero del tejado y los
  bordes laterales se trazan con `Mapa.perfil_tramos` a la pendiente del plano (`[5,3]` → tramos
  2,2,1; `[2,1]` → 2; `[3,1]` → 3). En las esquinas el último tramo mide 1 px para que el codo con
  el contorno lateral no sea un "doble".
- **Bandas del alero paralelas** al perfil (`Mapa.bandas`): contorno 1 + fascia 5 + sombra 1 + tabla
  clara 4 + línea 1, siempre con los mismos tramos (la receta de la casa V5/V6).
- **Tejado a dos aguas** (`dos_aguas`, cumbrera de delante a atrás = columna vertical):
  - hiladas **paralelas a la cumbrera** (columnas de 10 px, media teja de desfase cada dos), la junta
    continua en el lado del alero y la luz en el lado de la cumbrera y arriba (como `Mapa.tejas_v`);
  - las **juntas transversales** (límites entre tejas dentro de una hilada) se miden desde el perfil
    del alero, así que son **escalones con la misma pendiente que el alero y el hastial**, nunca
    horizontales (la crítica a la V6). Función `tejas_faldon` en `edificio.py`;
  - faldón izquierdo claro, derecho en sombra (luz desde arriba-izquierda), 3 tonos por faldón de una
    rampa de 6, jitter sembrado (1/6 de tejas un tono arriba/abajo, 1/8 con la junta corrida 1 px);
  - franja clara junto a la cumbrera, cumbrera de 8 px que baja hasta la fascia sin contorno entre
    medias, con desplazamientos de 1 px sembrados (`cumbrera_jitter`, el detalle que gustó de la V4/V5);
  - el borde trasero es la misma Λ que el alero desplazada el fondo del tejado (planos paralelos);
  - sombra de la chimenea sobre las tejas (un tono más, 6×12 px a su derecha) si la pieza lleva
    `"sombra": true`.
- **El triángulo bajo el alero (hastial) es muro**, nunca tejado: el muro se rellena desde la línea
  interior de las bandas hasta el zócalo en toda la anchura del edificio; ahí se pueden poner ventanas.
- **Un agua** (`un_agua`, faldón que mira al espectador): hiladas horizontales (`Mapa.tejas`), caballete
  de madera arriba, alero horizontal con las mismas bandas.
- **Toldo** (`toldo`): el de la tienda V5/V6 parametrizado por anchura: viga, cenefa, ribete, número
  impar de franjas en abanico regular (costuras Bresenham), faldón de 2 tonos y festones iguales de 7 px
  centrados; bordes laterales 5:1.
- **Muros**: muestras repetibles ancladas al zócalo (el periodo de 6 filas cuadra abajo), postes de
  esquina, zócalo de 2 filas (sombra + línea de base).
- **Piezas con su propio contorno**, estampadas sobre lo anterior (la pieza tapa lo que hay debajo).
- **Remate final** (`Mapa.rematar`): huérfanos y dobles de las costuras; los contornos del tejado se
  protegen. Comprobación externa: `pixel_clean.py --check --runs` debe dar 0 / 0.
- Sin negro puro (paleta de la casa/tienda V6), 1 px de imagen = 1 px de mundo, margen de 1 px.

## Archivos

| Qué | Dónde |
|---|---|
| Fuentes de las piezas (txt editables) | `assets/gen/pixel/src/kit/*.txt` (generadas por `hacer_kit.py` de esa carpeta; se pueden retocar a mano después, o mejor, retocar el guion) |
| Piezas construidas (PNG) + catálogo | `assets/game/pixel/kit/*.png`, `assets/game/pixel/kit/kit.json` |
| Compositor | `tools/edificio.py` (formato del plano en su cabecera) |
| Planos de prueba | `assets/gen/edificios/kit/planos/{casa,tienda,granero,taller}.json` |
| Renders de prueba | `assets/gen/edificios/kit/<id>_kit.png` (+ `_x4.png`, `.txt`), catálogo `edificios_kit.json` |
| Hojas | `assets/gen/edificios/kit/piezas_x6.png`, `preview_kit.png` (×4 sobre césped con caja 24×40), `detalle_x12.png` |
| Reproducir todo | `python -I assets/gen/edificios/kit/hacer.py` |

## Piezas (2026-10-13)

Muestras repetibles: `muro_madera` 24×12 (tablones de la casa, periodo 6), `muro_tablas_oscuro` 24×6
(pared de la tienda), `muro_esquina_izq` / `muro_esquina_der` 10×6, `zocalo` 24×2, `poste` 5×6,
`balda` 24×4, `teja_roja` 20×16 (solo referencia: las tejas las dibuja el compositor).
Tramos: `mostrador` 24×24 (el compositor añade los contornos laterales; `"ancho"` en casillas).
Piezas: `puerta` 36×39 y `ventana_jardinera` 21×19, `ventana` 18×13, `chimenea` 28×51 (de la casa V6),
`porton` 50×42 (granero, dos hojas con tirantes), `letrero` 19×13, `tarro` 9×11, `saco` 14×19,
`saquito` 11×11, `caja` 19×17, `caja_manzanas` y `caja_peras` 25×20 (tienda V6), `troncos` 21×19 (pila
de tres troncos de canto, paleta de `items/tronco.txt`).
Materiales de tejado (en `edificio.py`): `teja_roja` (casa V6), `teja_verde` (musgo, para cobertizos).

## Cómo añadir una pieza

1. Dibujarla **una vez** como txt (formato de `pixel_build.py`) en `assets/gen/pixel/src/kit/<id>.txt`:
   recorte de un sprite limpio (`Mapa`/`recortar` en `hacer_kit.py`), bloque a píxel (`Mapa.pegar`) o
   receta de `pixel_txt` (`caja`, `piedras`, `tejas_v`…). Dejar 1 px de margen transparente alrededor
   (el compositor coloca la caja opaca). Si es una muestra repetible, sin margen y con periodo entero
   (muros: múltiplo de 6 filas, anclado al zócalo).
2. Añadirla a `hacer_kit.py` (para que sea reproducible) y ejecutar
   `python -I assets/gen/pixel/src/kit/hacer_kit.py && python -I tools/pixel_build.py assets/gen/pixel/src/kit --out assets/game/pixel/kit`.
3. Comprobar `python -I tools/pixel_clean.py assets/game/pixel/kit/<id>.png --check` (0 huérfanos, 0 dobles).
4. Si es un tramo con contornos laterales, añadir su id a la tupla `tramo` de `Edificio._dimensionar`;
   si es muestra, nada más: `"ancho"`/`"alto"` en el plano la repiten.
5. Anotarla en `hacer.py` (`TIPOS`/`DESCRIPCION`, para `kit.json`) y en la lista de arriba.

## Cómo escribir un plano

```json
{
  "id": "granero", "ancho": 8, "fondo": 4, "alto_muro": 44,
  "tejado": {"tipo": "dos_aguas", "material": "teja_roja", "pendiente": [2, 1], "vuelo": 6,
             "cumbrera_jitter": true, "semilla": 11},
  "muro": "muro_madera",
  "piezas": [
    {"id": "porton", "x": "centro", "y": "suelo"},
    {"id": "ventana", "x": 16, "y": "suelo+14"},
    {"id": "ventana", "x": -16, "y": "suelo+14"},
    {"id": "ventana", "x": "centro", "y": "suelo+56"}
  ]
}
```

- `ancho`/`fondo` en casillas de 24 px (colisión por defecto `[ancho*24, fondo*24]`); `alto_muro` en px,
  medido en las esquinas (bajo la banda del alero); en el hastial el muro sube solo.
- `tejado.tipo`: `dos_aguas` (+ `pendiente [a, b]`, `fondo_px`, `cumbrera`, `franja`, `cumbrera_jitter`),
  `un_agua` (+ `alto_px`), `toldo`. `vuelo` en px a cada lado; `teja [ancho_hilada, largo]`; `semilla`.
- `piezas` se pintan en orden. `x`: px desde el borde izquierdo del muro (≥ 0), desde el derecho hasta el
  borde derecho de la pieza (< 0) o `"centro[+-n]"`. `y`: `"suelo[+n]"` (apoya en el zócalo, n px más
  arriba), `"tejado[+n]"` (sobre el faldón, al 30 % del fondo desde atrás) o una fila absoluta.
  `"ancho"` (casillas) / `"alto"` (px) repiten una muestra o tramo; `"sombra": true` proyecta sombra sobre
  las tejas (chimenea).
- Toldo: `"postes": true` pone los pies derechos en los extremos; `zocalo` va a `false` por defecto; la
  mercancía se apila con `suelo+n` (ver `planos/tienda.json`, calcado de la tienda V6).

```
python -I tools/edificio.py plano.json --out assets/gen/edificios/kit/granero_kit.png --txt ... --preview 4 --catalogo assets/gen/edificios/kit/edificios_kit.json
python -I tools/pixel_clean.py assets/gen/edificios/kit/granero_kit.png --check --runs
```

El `--catalogo` recibe la entrada `{"archivo","ancla","colision","tipo"}` (ancla = [ancho/2, alto], como
la casa V6). Para pasar un edificio al juego: copiar el PNG a `assets/game/pixel/edificios/` y la entrada
a `edificios.json` (no se hace automáticamente).

## Resultado de la prueba (2026-10-13)

| Edificio | Plano | Tamaño | Montaje | Comprobación |
|---|---|---|---|---|
| casa_kit (6×3, dos aguas 5:3, chimenea) | `planos/casa.json` | 158×177 | 0,28 s | 0 huérfanos / 0 dobles, contorno superior tramos 2,2,1 |
| tienda_kit (toldo 6 casillas, mostrador, mercancía, troncos) | `planos/tienda.json` | 154×127 | 0,15 s | 0 / 0, bordes del toldo tramos de 5 |
| granero_kit (8×4, dos aguas 2:1, portón) | `planos/granero.json` | 206×215 | 0,33 s | 0 / 0, contorno superior tramos de 2 |
| taller_kit (4×2, un agua, teja verde) | `planos/taller.json` | 110×112 | 0,18 s | 0 / 0 |

(tiempos de montaje; el proceso entero con arranque de Python ≈ 0,3-0,45 s por edificio.)

## Limitaciones conocidas

- La puerta y las ventanas son el dibujo de la IA recortado (con sus manchas); si se quieren más
  limpias hay que retocar su txt una vez (y vale para todos los edificios).
- Un solo diseño de tejas (10×8) y dos materiales; las bandas del alero son siempre de madera naranja.
- `dos_aguas` solo con la cumbrera de delante a atrás (hastial de frente); no hay tejados a cuatro aguas,
  cumbrera transversal ni buhardillas; `un_agua` no tiene faldón lateral visible.
- Las piezas no se recortan por el tejado: una pieza en `"tejado"` tapa las tejas (chimenea) y el
  compositor amplía la imagen por arriba si sobresale.
- El remate final puede cambiar 10-50 píxeles sueltos en las costuras (se informa como `remate=`).
- La maqueta no carga el catálogo del kit (`edificios_kit.json`): hay que copiar a mano lo que se apruebe.
