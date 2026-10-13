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
