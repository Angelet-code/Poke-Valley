# Tipos de ataque (generado)

> `tools/lineas_ataque.ts`. Reglas en docs/GDD-combate.md §3.3 y §3.6.

Un **tipo de ataque** es todo lo que define un movimiento salvo su tipo elemental y su potencia: categoría, alcance, forma, precisión y mecánica. Ascuas, Pistola Agua e Impactrueno son el mismo tipo de ataque. Las **líneas** van dentro de un tipo de ataque y suben la potencia (Ascuas 40 → Lanzallamas 90). Las **variantes** son tipos de ataque que solo cambian en una cosa (Rayo → Chispazo: alrededor de ti en vez de a uno).

94 tipos de ataque: 45 con varios movimientos y 49 de un solo movimiento.

| Tipo de ataque | Movimientos | Tipos | Potencias | Líneas |
|---|---|---|---|---|
| [Físico · cuerpo a cuerpo · a uno](#físico-cuerpo-a-cuerpo-a-uno) | 57 | 14 | 20, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 85, 90, 95, 120 | 13 |
| [Especial · a distancia · a uno](#especial-a-distancia-a-uno) | 38 | 16 | 20, 40, 50, 60, 65, 70, 75, 80, 85, 90, 95, 120 | 10 |
| [Físico · a distancia · a uno](#físico-a-distancia-a-uno) | 9 | 7 | 15, 40, 50, 70, 80, 90, 120 | 1 |
| [Físico · precisión 95 % · cuerpo a cuerpo · a uno](#físico-precisión-95-cuerpo-a-cuerpo-a-uno) | 8 | 7 | 40, 65, 75, 80, 95 | 1 |
| [Especial · a distancia · a uno · interrumpe](#especial-a-distancia-a-uno-interrumpe) | 7 | 4 | 50, 60, 65, 80 | 1 |
| [Físico · cuerpo a cuerpo · a uno · interrumpe](#físico-cuerpo-a-cuerpo-a-uno-interrumpe) | 7 | 5 | 30, 60, 65, 70, 80 | 1 |
| [Físico · precisión 90 % · cuerpo a cuerpo · a uno](#físico-precisión-90-cuerpo-a-cuerpo-a-uno) | 7 | 6 | 15, 30, 85, 90, 100, 130 | 1 |
| [Especial · a distancia · en área](#especial-a-distancia-en-área) | 6 | 6 | 40, 50, 60, 80, 90 |  |
| [Especial · a distancia · alrededor](#especial-a-distancia-alrededor) | 5 | 5 | 80, 90, 95, 140 |  |
| [Físico · cuerpo a cuerpo · a uno · prioridad](#físico-cuerpo-a-cuerpo-a-uno-prioridad) | 5 | 5 | 40 |  |
| [Físico · cuerpo a cuerpo · a uno · se daña](#físico-cuerpo-a-cuerpo-a-uno-se-daña) | 5 | 5 | 120 |  |
| [Especial · a distancia · a uno · drena](#especial-a-distancia-a-uno-drena) | 4 | 2 | 20, 40, 75, 100 | 1 |
| [Especial · no falla · a distancia · a uno](#especial-no-falla-a-distancia-a-uno) | 3 | 3 | 50, 60, 80 |  |
| [Especial · precisión 95 % · a distancia · en área](#especial-precisión-95-a-distancia-en-área) | 3 | 3 | 55, 60 |  |
| [Físico · a distancia · a uno · multigolpe](#físico-a-distancia-a-uno-multigolpe) | 3 | 3 | 25, 50 |  |
| [Físico · a distancia · alrededor](#físico-a-distancia-alrededor) | 3 | 2 | 60, 90, 100 | 1 |
| [Físico · cuerpo a cuerpo · a uno · burst](#físico-cuerpo-a-cuerpo-a-uno-burst) | 3 | 2 | 70, 120, 140 |  |
| [Físico · cuerpo a cuerpo · a uno · carga](#físico-cuerpo-a-cuerpo-a-uno-carga) | 3 | 3 | 80, 90 |  |
| [Físico · cuerpo a cuerpo · a uno · drena](#físico-cuerpo-a-cuerpo-a-uno-drena) | 3 | 3 | 75, 80 |  |
| [Físico · cuerpo a cuerpo · a uno · lento](#físico-cuerpo-a-cuerpo-a-uno-lento) | 3 | 2 | 60, 150 |  |
| [Físico · cuerpo a cuerpo · a uno · se baja stats · burst](#físico-cuerpo-a-cuerpo-a-uno-se-baja-stats-burst) | 3 | 2 | 120 |  |
| [Físico · cuerpo a cuerpo · a uno · se sube stats](#físico-cuerpo-a-cuerpo-a-uno-se-sube-stats) | 3 | 3 | 50, 80 |  |
| [Físico · no falla · cuerpo a cuerpo · a uno](#físico-no-falla-cuerpo-a-cuerpo-a-uno) | 3 | 3 | 60, 70 |  |
| [Físico · precisión 85 % · cuerpo a cuerpo · a uno](#físico-precisión-85-cuerpo-a-cuerpo-a-uno) | 3 | 3 | 15, 120 |  |
| [Físico · precisión 90 % · cuerpo a cuerpo · a uno · interrumpe](#físico-precisión-90-cuerpo-a-cuerpo-a-uno-interrumpe) | 3 | 3 | 80, 120 |  |
| [Físico · precisión 90 % · cuerpo a cuerpo · a uno · multigolpe](#físico-precisión-90-cuerpo-a-cuerpo-a-uno-multigolpe) | 3 | 3 | 35, 40 |  |
| [Especial · a distancia · a uno · se sube stats](#especial-a-distancia-a-uno-se-sube-stats) | 2 | 1 | 80 |  |
| [Especial · a distancia · en área · burst](#especial-a-distancia-en-área-burst) | 2 | 2 | 150 |  |
| [Especial · cuerpo a cuerpo · a uno](#especial-cuerpo-a-cuerpo-a-uno) | 2 | 2 | 20, 120 |  |
| [Especial · no falla · a distancia · en área](#especial-no-falla-a-distancia-en-área) | 2 | 2 | 40, 60 |  |
| [Especial · precisión 50 % · a distancia · a uno · burst](#especial-precisión-50-a-distancia-a-uno-burst) | 2 | 2 | 100, 120 |  |
| [Especial · precisión 70 % · a distancia · a uno](#especial-precisión-70-a-distancia-a-uno) | 2 | 2 | 30, 110 |  |
| [Especial · precisión 85 % · a distancia · a uno](#especial-precisión-85-a-distancia-a-uno) | 2 | 2 | 35 |  |
| [Especial · precisión 90 % · a distancia · a uno](#especial-precisión-90-a-distancia-a-uno) | 2 | 2 | 60, 120 |  |
| [Especial · precisión 90 % · a distancia · a uno · se baja stats · burst](#especial-precisión-90-a-distancia-a-uno-se-baja-stats-burst) | 2 | 2 | 130 |  |
| [Especial · precisión 95 % · a distancia · a uno](#especial-precisión-95-a-distancia-a-uno) | 2 | 2 | 55, 85 |  |
| [Físico · a distancia · a uno · prioridad](#físico-a-distancia-a-uno-prioridad) | 2 | 2 | 30, 40 |  |
| [Físico · a distancia · alrededor · burst](#físico-a-distancia-alrededor-burst) | 2 | 1 | 200, 250 | 1 |
| [Físico · cuerpo a cuerpo · a uno · multigolpe](#físico-cuerpo-a-cuerpo-a-uno-multigolpe) | 2 | 1 | 15, 30 | 1 |
| [Físico · cuerpo a cuerpo · a uno · prioridad · burst](#físico-cuerpo-a-cuerpo-a-uno-prioridad-burst) | 2 | 2 | 70, 80 |  |
| [Físico · precisión 75 % · cuerpo a cuerpo · a uno](#físico-precisión-75-cuerpo-a-cuerpo-a-uno) | 2 | 2 | 80, 100 |  |
| [Físico · precisión 80 % · a distancia · a uno · burst](#físico-precisión-80-a-distancia-a-uno-burst) | 2 | 2 | 100, 120 |  |
| [Físico · precisión 90 % · a distancia · a uno · multigolpe](#físico-precisión-90-a-distancia-a-uno-multigolpe) | 2 | 2 | 25 |  |
| [Físico · precisión 90 % · cuerpo a cuerpo · a uno · lento](#físico-precisión-90-cuerpo-a-cuerpo-a-uno-lento) | 2 | 2 | 60 |  |
| [Físico · precisión 90 % · cuerpo a cuerpo · a uno · se sube stats](#físico-precisión-90-cuerpo-a-cuerpo-a-uno-se-sube-stats) | 2 | 1 | 70, 90 | 1 |

## Físico · cuerpo a cuerpo · a uno

| Potencia | Bicho | Siniestro | Dragón | Eléctrico | Lucha | Fuego | Volador | Fantasma | Planta | Tierra | Hielo | Normal | Veneno | Agua |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 20 |  | Chulería |  | **Moflete Estático** |  |  |  |  |  |  |  |  |  |  |
| 30 |  |  |  |  |  |  |  | Lengüetazo |  |  |  |  |  |  |
| 35 |  |  |  |  |  |  | **Picotazo** |  |  |  |  |  |  |  |
| 40 |  |  |  |  | **Golpe Roca** |  |  |  | **Punzada Rama** |  |  | **Placaje**, **Destructor**, **Arañazo**, Falso Tortazo |  |  |
| 45 |  |  |  |  |  |  |  |  | **Látigo Cepa** |  |  |  |  |  |
| 50 | **Aguijón Letal** | **Vendetta** |  |  |  |  |  |  |  |  |  |  | Colmillo Veneno, **Cola Veneno** |  |
| 55 |  |  |  |  |  |  | Acróbata |  |  |  |  | Agarre |  |  |
| 60 | **Picadura** | **Buena Baza**, Ladrón |  |  | **Palmeo**, Llave Corsé | **Rueda Fuego** | Ataque Ala, **Picoteo** |  |  |  |  | Antojo |  |  |
| 65 |  | **Desarme** |  | **Chispa** | Puntapié |  |  |  |  |  |  | Cornada |  |  |
| 70 |  | Tajo Umbrío |  |  |  |  |  | Garra Umbría | Patada Tropical |  |  | **Cuchillada**, Fachada | **Veneno X** |  |
| 75 |  |  |  | **Puño Trueno** | **Demolición** | **Puño Fuego** |  |  |  | Pataleta | **Puño Hielo** |  |  |  |
| 80 | **Tijera X**, Plancha | Triturar | **Garra Dragón** |  |  | Látigo Ígneo | **Pico Taladro** |  |  |  | **Pirueta Helada** | **Fuerza** | **Puya Nociva** |  |
| 85 |  | Lariat Oscuro |  |  |  |  |  |  |  |  |  | **Golpe Cuerpo** |  | Hidroariete |
| 90 |  |  |  |  |  |  |  |  | **Hoja Aguda** |  |  |  |  |  |
| 95 |  | **Juego Sucio** |  |  |  |  |  |  |  |  |  |  |  |  |
| 120 |  |  | **Enfado** |  |  |  |  |  |  |  |  | Saña |  |  |

Líneas (en negrita): Embestidas (Placaje 40 → Golpe Cuerpo 85); Golpes planta (Punzada Rama 40 → Látigo Cepa 45 → Hoja Aguda 90); Golpes (Destructor 40 → Fuerza 80); Golpes de fuego (Rueda Fuego 60 → Puño Fuego 75); Garras (Arañazo 40 → Cuchillada 70); Chispas (Moflete Estático 20 → Chispa 65 → Puño Trueno 75); Golpes sucios (Vendetta 50 → Buena Baza 60 → Desarme 65 → Juego Sucio 95); Palmas (Golpe Roca 40 → Palmeo 60 → Demolición 75); Venenos (Cola Veneno 50 → Veneno X 70 → Puya Nociva 80); Picos (Picotazo 35 → Picoteo 60 → Pico Taladro 80); Picaduras (Aguijón Letal 50 → Picadura 60 → Tijera X 80); Garras dragón (Garra Dragón 80 → Enfado 120); Golpes de hielo (Puño Hielo 75 → Pirueta Helada 80).

Variantes: [Físico · a distancia · a uno](#físico-a-distancia-a-uno) (Bomba Germen, Antiaéreo, Psicocorte…); [Físico · precisión 95 % · cuerpo a cuerpo · a uno](#físico-precisión-95-cuerpo-a-cuerpo-a-uno) (Fuerza Equina, Colmillo Ígneo, Colmillo Hielo…); [Físico · cuerpo a cuerpo · a uno · interrumpe](#físico-cuerpo-a-cuerpo-a-uno-interrumpe) (Golpe Cabeza, Pisotón, Mordisco…); [Físico · precisión 90 % · cuerpo a cuerpo · a uno](#físico-precisión-90-cuerpo-a-cuerpo-a-uno) (Rodar, Carantoña, Patada Salto Alta…); [Físico · cuerpo a cuerpo · a uno · prioridad](#físico-cuerpo-a-cuerpo-a-uno-prioridad) (Acua Jet, Ataque Rápido, Sombra Vil…); [Físico · cuerpo a cuerpo · a uno · se daña](#físico-cuerpo-a-cuerpo-a-uno-se-daña) (Doble Filo, Envite Ígneo, Pájaro Osado…); [Físico · cuerpo a cuerpo · a uno · burst](#físico-cuerpo-a-cuerpo-a-uno-burst) (Última Baza, Represalia, Asalto Espadón); [Físico · cuerpo a cuerpo · a uno · carga](#físico-cuerpo-a-cuerpo-a-uno-carga) (Buceo, Excavar, Golpe Fantasma); [Físico · cuerpo a cuerpo · a uno · drena](#físico-cuerpo-a-cuerpo-a-uno-drena) (Chupavidas, Puño Drenaje, Asta Drenaje); [Físico · cuerpo a cuerpo · a uno · lento](#físico-cuerpo-a-cuerpo-a-uno-lento) (Alud, Desquite, Puño Certero); [Físico · cuerpo a cuerpo · a uno · se sube stats](#físico-cuerpo-a-cuerpo-a-uno-se-sube-stats) (Giro Rápido, Nitrocarga, Danza Acuática); [Físico · no falla · cuerpo a cuerpo · a uno](#físico-no-falla-cuerpo-a-cuerpo-a-uno) (Puño Sombra, Golpe Aéreo, Cuerno Certero); [Físico · precisión 85 % · cuerpo a cuerpo · a uno](#físico-precisión-85-cuerpo-a-cuerpo-a-uno) (Latigazo, Megacuerno, Atadura); [Especial · cuerpo a cuerpo · a uno](#especial-cuerpo-a-cuerpo-a-uno) (Danza Pétalo, Acoso); [Físico · cuerpo a cuerpo · a uno · multigolpe](#físico-cuerpo-a-cuerpo-a-uno-multigolpe) (Doble Patada, Empujón); [Físico · precisión 75 % · cuerpo a cuerpo · a uno](#físico-precisión-75-cuerpo-a-cuerpo-a-uno) (Atizar, Cola Férrea); [Físico · cuerpo a cuerpo · a uno · vuelve](#físico-cuerpo-a-cuerpo-a-uno-vuelve) (Ida y Vuelta); [Físico · cuerpo a cuerpo · alrededor](#físico-cuerpo-a-cuerpo-alrededor) (Giro Vil); [Físico · cuerpo a cuerpo · en área](#físico-cuerpo-a-cuerpo-en-área) (Vasto Impacto).

## Especial · a distancia · a uno

| Potencia | Bicho | Dragón | Eléctrico | Hada | Fuego | Volador | Fantasma | Planta | Tierra | Hielo | Normal | Veneno | Psíquico | Roca | Acero | Agua |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 20 |  |  |  |  |  |  |  |  | **Bofetón Lodo** |  |  |  | Poder Reserva |  |  |  |
| 40 |  |  | **Impactrueno** | **Viento Feérico** | **Ascuas** | Tornado |  |  |  |  | **Eco Voz** | Bomba Ácida |  |  |  | **Pistola Agua** |
| 50 |  |  |  |  |  |  |  |  |  |  | Meteorobola |  |  |  |  |  |
| 60 |  | **Dragoaliento** |  |  |  |  |  |  |  |  | **Canon** |  |  |  |  |  |
| 65 |  |  |  |  |  |  | **Infortunio** |  |  | **Rayo Aurora** |  | **Residuos**, Carga Tóxica |  |  |  | **Rayo Burbuja**, Salmuera |
| 70 |  |  |  |  |  |  |  |  |  | Liofilización |  |  |  |  |  |  |
| 75 |  |  |  |  | Llama Embrujada |  |  |  |  |  |  |  |  |  |  |  |
| 80 |  |  |  |  |  |  | **Bola Sombra** |  |  |  |  |  | Psicocarga, Vasta Fuerza | Joya de Luz | Cañón Resplandor | **Disparo Certero** |
| 85 |  | **Pulso Dragón** |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| 90 | Zumbido |  | **Rayo** |  | **Lanzallamas** |  |  | Energibola | **Tierra Viva** | **Rayo Hielo** | Alboroto | **Bomba Lodo** | Psíquico |  |  |  |
| 95 |  |  |  | **Fuerza Lunar** |  |  |  |  |  |  |  |  |  |  |  |  |
| 120 |  |  |  |  |  |  |  |  |  |  |  |  | Premonición |  |  |  |

Líneas (en negrita): Chorros (Pistola Agua 40 → Rayo Burbuja 65 → Disparo Certero 80); Vientos feéricos (Viento Feérico 40 → Fuerza Lunar 95); Llamas (Ascuas 40 → Lanzallamas 90); Lodos (Bofetón Lodo 20 → Tierra Viva 90); Rayos de hielo (Rayo Aurora 65 → Rayo Hielo 90); Rayos (Impactrueno 40 → Rayo 90); Residuos (Residuos 65 → Bomba Lodo 90); Voces (Eco Voz 40 → Canon 60); Alientos dragón (Dragoaliento 60 → Pulso Dragón 85); Maleficios (Infortunio 65 → Bola Sombra 80).

Variantes: [Físico · a distancia · a uno](#físico-a-distancia-a-uno) (Bomba Germen, Antiaéreo, Psicocorte…); [Especial · a distancia · a uno · interrumpe](#especial-a-distancia-a-uno-interrumpe) (Ronquido, Confusión, Hidropulso…); [Especial · a distancia · en área](#especial-a-distancia-en-área) (Ácido, Calcinación, Nieve Polvo…); [Especial · a distancia · alrededor](#especial-a-distancia-alrededor) (Humareda, Chispazo, Onda Tóxica…); [Especial · a distancia · a uno · drena](#especial-a-distancia-a-uno-drena) (Absorber, Megaagotar, Gigadrenado…); [Especial · no falla · a distancia · a uno](#especial-no-falla-a-distancia-a-uno) (Hoja Mágica, Niebla Clara, Esfera Aural); [Especial · a distancia · a uno · se sube stats](#especial-a-distancia-a-uno-se-sube-stats) (Danza Llama, Canto Ardiente); [Especial · cuerpo a cuerpo · a uno](#especial-cuerpo-a-cuerpo-a-uno) (Danza Pétalo, Acoso); [Especial · precisión 70 % · a distancia · a uno](#especial-precisión-70-a-distancia-a-uno) (Polución, Trueno); [Especial · precisión 85 % · a distancia · a uno](#especial-precisión-85-a-distancia-a-uno) (Torbellino, Giro Fuego); [Especial · precisión 90 % · a distancia · a uno](#especial-precisión-90-a-distancia-a-uno) (Eructo, Vaho Gélido); [Especial · precisión 95 % · a distancia · a uno](#especial-precisión-95-a-distancia-a-uno) (Disparo Lodo, Pulso Noche); [Especial · a distancia · a uno · burst](#especial-a-distancia-a-uno-burst) (Llama Final); [Especial · a distancia · a uno · carga](#especial-a-distancia-a-uno-carga) (Rayo Solar); [Especial · a distancia · a uno · prioridad](#especial-a-distancia-a-uno-prioridad) (Onda Vacío).

## Físico · a distancia · a uno

| Potencia | Bicho | Fuego | Planta | Veneno | Psíquico | Roca | Agua |
|---|---|---|---|---|---|---|---|
| 15 |  |  |  | Picotazo Veneno |  |  |  |
| 40 |  |  | **Follaje** |  |  |  |  |
| 50 |  |  |  |  |  | Antiaéreo |  |
| 70 |  |  |  |  | Psicocorte |  | Tajo Acuático |
| 80 |  |  | **Bomba Germen**, Batería Asalto |  |  |  |  |
| 90 | Al Ataque |  |  |  |  |  |  |
| 120 |  | Erupción de Ira |  |  |  |  |  |

Líneas (en negrita): Semillas (Follaje 40 → Bomba Germen 80).

Variantes: [Físico · cuerpo a cuerpo · a uno](#físico-cuerpo-a-cuerpo-a-uno) (Placaje, Triturar, Golpe Cuerpo…); [Especial · a distancia · a uno](#especial-a-distancia-a-uno) (Pistola Agua, Fuerza Lunar, Ascuas…); [Físico · a distancia · a uno · multigolpe](#físico-a-distancia-a-uno-multigolpe) (Semilladora, Carámbano, Dracoflechas); [Físico · a distancia · alrededor](#físico-a-distancia-alrededor) (Tormenta Floral, Terremoto, Terratemblor); [Físico · a distancia · a uno · prioridad](#físico-a-distancia-a-uno-prioridad) (Esquirla Helada, Amago); [Físico · a distancia · a uno · interrumpe](#físico-a-distancia-a-uno-interrumpe) (Puntada Sombría); [Físico · no falla · a distancia · a uno](#físico-no-falla-a-distancia-a-uno) (Truco Floral); [Físico · precisión 85 % · a distancia · a uno](#físico-precisión-85-a-distancia-a-uno) (Bucle Arena); [Físico · precisión 90 % · a distancia · a uno](#físico-precisión-90-a-distancia-a-uno) (Lanzarrocas); [Físico · precisión 95 % · a distancia · a uno](#físico-precisión-95-a-distancia-a-uno) (Tumba Rocas).

## Físico · precisión 95 % · cuerpo a cuerpo · a uno

| Potencia | Bicho | Eléctrico | Fuego | Tierra | Hielo | Normal | Agua |
|---|---|---|---|---|---|---|---|
| 40 | Corte Furia |  |  |  |  |  |  |
| 65 |  | Colmillo Rayo | Colmillo Ígneo |  | Colmillo Hielo |  |  |
| 75 |  |  |  |  |  | Garra Brutal | Concha Filo |
| 80 |  |  |  | **Taladradora** |  |  |  |
| 95 |  |  |  | **Fuerza Equina** |  |  |  |

Líneas (en negrita): Taladros (Taladradora 80 → Fuerza Equina 95).

Variantes: [Físico · cuerpo a cuerpo · a uno](#físico-cuerpo-a-cuerpo-a-uno) (Placaje, Triturar, Golpe Cuerpo…); [Físico · cuerpo a cuerpo · a uno · interrumpe](#físico-cuerpo-a-cuerpo-a-uno-interrumpe) (Golpe Cabeza, Pisotón, Mordisco…); [Físico · precisión 90 % · cuerpo a cuerpo · a uno](#físico-precisión-90-cuerpo-a-cuerpo-a-uno) (Rodar, Carantoña, Patada Salto Alta…); [Físico · cuerpo a cuerpo · a uno · prioridad](#físico-cuerpo-a-cuerpo-a-uno-prioridad) (Acua Jet, Ataque Rápido, Sombra Vil…); [Físico · cuerpo a cuerpo · a uno · se daña](#físico-cuerpo-a-cuerpo-a-uno-se-daña) (Doble Filo, Envite Ígneo, Pájaro Osado…); [Físico · cuerpo a cuerpo · a uno · burst](#físico-cuerpo-a-cuerpo-a-uno-burst) (Última Baza, Represalia, Asalto Espadón); [Físico · cuerpo a cuerpo · a uno · carga](#físico-cuerpo-a-cuerpo-a-uno-carga) (Buceo, Excavar, Golpe Fantasma); [Físico · cuerpo a cuerpo · a uno · drena](#físico-cuerpo-a-cuerpo-a-uno-drena) (Chupavidas, Puño Drenaje, Asta Drenaje); [Físico · cuerpo a cuerpo · a uno · lento](#físico-cuerpo-a-cuerpo-a-uno-lento) (Alud, Desquite, Puño Certero); [Físico · cuerpo a cuerpo · a uno · se sube stats](#físico-cuerpo-a-cuerpo-a-uno-se-sube-stats) (Giro Rápido, Nitrocarga, Danza Acuática); [Físico · no falla · cuerpo a cuerpo · a uno](#físico-no-falla-cuerpo-a-cuerpo-a-uno) (Puño Sombra, Golpe Aéreo, Cuerno Certero); [Físico · precisión 85 % · cuerpo a cuerpo · a uno](#físico-precisión-85-cuerpo-a-cuerpo-a-uno) (Latigazo, Megacuerno, Atadura); [Físico · cuerpo a cuerpo · a uno · multigolpe](#físico-cuerpo-a-cuerpo-a-uno-multigolpe) (Doble Patada, Empujón); [Físico · precisión 75 % · cuerpo a cuerpo · a uno](#físico-precisión-75-cuerpo-a-cuerpo-a-uno) (Atizar, Cola Férrea); [Físico · cuerpo a cuerpo · a uno · vuelve](#físico-cuerpo-a-cuerpo-a-uno-vuelve) (Ida y Vuelta); [Físico · precisión 95 % · a distancia · a uno](#físico-precisión-95-a-distancia-a-uno) (Tumba Rocas); [Físico · precisión 95 % · cuerpo a cuerpo · a uno · carga](#físico-precisión-95-cuerpo-a-cuerpo-a-uno-carga) (Vuelo); [Físico · precisión 95 % · cuerpo a cuerpo · a uno · se sube stats](#físico-precisión-95-cuerpo-a-cuerpo-a-uno-se-sube-stats) (Garra Metal).

## Especial · a distancia · a uno · interrumpe

| Potencia | Siniestro | Normal | Psíquico | Agua |
|---|---|---|---|---|
| 50 |  | Ronquido | **Confusión** |  |
| 60 |  |  |  | Hidropulso |
| 65 |  |  | **Psicorrayo** |  |
| 80 | Pulso Umbrío | Triataque | **Paranormal** |  |

Líneas (en negrita): Mentes (Confusión 50 → Psicorrayo 65 → Paranormal 80).

Variantes: [Especial · a distancia · a uno](#especial-a-distancia-a-uno) (Pistola Agua, Fuerza Lunar, Ascuas…); [Especial · a distancia · a uno · drena](#especial-a-distancia-a-uno-drena) (Absorber, Megaagotar, Gigadrenado…); [Especial · no falla · a distancia · a uno](#especial-no-falla-a-distancia-a-uno) (Hoja Mágica, Niebla Clara, Esfera Aural); [Especial · a distancia · a uno · se sube stats](#especial-a-distancia-a-uno-se-sube-stats) (Danza Llama, Canto Ardiente); [Especial · precisión 70 % · a distancia · a uno](#especial-precisión-70-a-distancia-a-uno) (Polución, Trueno); [Especial · precisión 85 % · a distancia · a uno](#especial-precisión-85-a-distancia-a-uno) (Torbellino, Giro Fuego); [Especial · precisión 90 % · a distancia · a uno](#especial-precisión-90-a-distancia-a-uno) (Eructo, Vaho Gélido); [Especial · precisión 95 % · a distancia · a uno](#especial-precisión-95-a-distancia-a-uno) (Disparo Lodo, Pulso Noche); [Especial · a distancia · a uno · burst](#especial-a-distancia-a-uno-burst) (Llama Final); [Especial · a distancia · a uno · carga](#especial-a-distancia-a-uno-carga) (Rayo Solar); [Especial · a distancia · a uno · prioridad](#especial-a-distancia-a-uno-prioridad) (Onda Vacío); [Especial · a distancia · alrededor · interrumpe](#especial-a-distancia-alrededor-interrumpe) (Aria Burbuja); [Especial · a distancia · en área · interrumpe](#especial-a-distancia-en-área-interrumpe) (Ciclón); [Especial · precisión 70 % · a distancia · a uno · interrumpe](#especial-precisión-70-a-distancia-a-uno-interrumpe) (Vendaval); [Especial · precisión 95 % · a distancia · a uno · interrumpe](#especial-precisión-95-a-distancia-a-uno-interrumpe) (Tajo Aéreo); [Físico · a distancia · a uno · interrumpe](#físico-a-distancia-a-uno-interrumpe) (Puntada Sombría).

## Físico · cuerpo a cuerpo · a uno · interrumpe

| Potencia | Siniestro | Fantasma | Normal | Acero | Agua |
|---|---|---|---|---|---|
| 30 |  | Impresionar |  |  |  |
| 60 | Mordisco |  |  |  |  |
| 65 |  |  | **Pisotón** |  |  |
| 70 |  |  | **Golpe Cabeza** |  |  |
| 80 | Golpe Mordaza |  |  | Cabeza de Hierro | Cascada |

Líneas (en negrita): Topetazos (Pisotón 65 → Golpe Cabeza 70).

Variantes: [Físico · cuerpo a cuerpo · a uno](#físico-cuerpo-a-cuerpo-a-uno) (Placaje, Triturar, Golpe Cuerpo…); [Físico · precisión 95 % · cuerpo a cuerpo · a uno](#físico-precisión-95-cuerpo-a-cuerpo-a-uno) (Fuerza Equina, Colmillo Ígneo, Colmillo Hielo…); [Físico · precisión 90 % · cuerpo a cuerpo · a uno](#físico-precisión-90-cuerpo-a-cuerpo-a-uno) (Rodar, Carantoña, Patada Salto Alta…); [Físico · cuerpo a cuerpo · a uno · prioridad](#físico-cuerpo-a-cuerpo-a-uno-prioridad) (Acua Jet, Ataque Rápido, Sombra Vil…); [Físico · cuerpo a cuerpo · a uno · se daña](#físico-cuerpo-a-cuerpo-a-uno-se-daña) (Doble Filo, Envite Ígneo, Pájaro Osado…); [Físico · cuerpo a cuerpo · a uno · burst](#físico-cuerpo-a-cuerpo-a-uno-burst) (Última Baza, Represalia, Asalto Espadón); [Físico · cuerpo a cuerpo · a uno · carga](#físico-cuerpo-a-cuerpo-a-uno-carga) (Buceo, Excavar, Golpe Fantasma); [Físico · cuerpo a cuerpo · a uno · drena](#físico-cuerpo-a-cuerpo-a-uno-drena) (Chupavidas, Puño Drenaje, Asta Drenaje); [Físico · cuerpo a cuerpo · a uno · lento](#físico-cuerpo-a-cuerpo-a-uno-lento) (Alud, Desquite, Puño Certero); [Físico · cuerpo a cuerpo · a uno · se sube stats](#físico-cuerpo-a-cuerpo-a-uno-se-sube-stats) (Giro Rápido, Nitrocarga, Danza Acuática); [Físico · no falla · cuerpo a cuerpo · a uno](#físico-no-falla-cuerpo-a-cuerpo-a-uno) (Puño Sombra, Golpe Aéreo, Cuerno Certero); [Físico · precisión 85 % · cuerpo a cuerpo · a uno](#físico-precisión-85-cuerpo-a-cuerpo-a-uno) (Latigazo, Megacuerno, Atadura); [Físico · precisión 90 % · cuerpo a cuerpo · a uno · interrumpe](#físico-precisión-90-cuerpo-a-cuerpo-a-uno-interrumpe) (Hipercolmillo, Cabezazo Zen, Patada Hacha); [Físico · cuerpo a cuerpo · a uno · multigolpe](#físico-cuerpo-a-cuerpo-a-uno-multigolpe) (Doble Patada, Empujón); [Físico · precisión 75 % · cuerpo a cuerpo · a uno](#físico-precisión-75-cuerpo-a-cuerpo-a-uno) (Atizar, Cola Férrea); [Físico · a distancia · a uno · interrumpe](#físico-a-distancia-a-uno-interrumpe) (Puntada Sombría); [Físico · cuerpo a cuerpo · a uno · prioridad · interrumpe](#físico-cuerpo-a-cuerpo-a-uno-prioridad-interrumpe) (Sorpresa); [Físico · cuerpo a cuerpo · a uno · vuelve](#físico-cuerpo-a-cuerpo-a-uno-vuelve) (Ida y Vuelta); [Físico · precisión 75 % · cuerpo a cuerpo · a uno · interrumpe](#físico-precisión-75-cuerpo-a-cuerpo-a-uno-interrumpe) (Carga Dragón).

## Físico · precisión 90 % · cuerpo a cuerpo · a uno

| Potencia | Hada | Lucha | Fuego | Normal | Roca | Agua |
|---|---|---|---|---|---|---|
| 15 |  |  |  | Constricción |  |  |
| 30 |  |  |  |  | Rodar |  |
| 85 |  |  | Patada Ígnea |  |  |  |
| 90 | Carantoña |  |  |  |  | **Acua Cola** |
| 100 |  |  |  |  |  | **Martillazo** |
| 130 |  | Patada Salto Alta |  |  |  |  |

Líneas (en negrita): Golpes de agua (Acua Cola 90 → Martillazo 100).

Variantes: [Físico · cuerpo a cuerpo · a uno](#físico-cuerpo-a-cuerpo-a-uno) (Placaje, Triturar, Golpe Cuerpo…); [Físico · precisión 95 % · cuerpo a cuerpo · a uno](#físico-precisión-95-cuerpo-a-cuerpo-a-uno) (Fuerza Equina, Colmillo Ígneo, Colmillo Hielo…); [Físico · cuerpo a cuerpo · a uno · interrumpe](#físico-cuerpo-a-cuerpo-a-uno-interrumpe) (Golpe Cabeza, Pisotón, Mordisco…); [Físico · cuerpo a cuerpo · a uno · prioridad](#físico-cuerpo-a-cuerpo-a-uno-prioridad) (Acua Jet, Ataque Rápido, Sombra Vil…); [Físico · cuerpo a cuerpo · a uno · se daña](#físico-cuerpo-a-cuerpo-a-uno-se-daña) (Doble Filo, Envite Ígneo, Pájaro Osado…); [Físico · cuerpo a cuerpo · a uno · burst](#físico-cuerpo-a-cuerpo-a-uno-burst) (Última Baza, Represalia, Asalto Espadón); [Físico · cuerpo a cuerpo · a uno · carga](#físico-cuerpo-a-cuerpo-a-uno-carga) (Buceo, Excavar, Golpe Fantasma); [Físico · cuerpo a cuerpo · a uno · drena](#físico-cuerpo-a-cuerpo-a-uno-drena) (Chupavidas, Puño Drenaje, Asta Drenaje); [Físico · cuerpo a cuerpo · a uno · lento](#físico-cuerpo-a-cuerpo-a-uno-lento) (Alud, Desquite, Puño Certero); [Físico · cuerpo a cuerpo · a uno · se sube stats](#físico-cuerpo-a-cuerpo-a-uno-se-sube-stats) (Giro Rápido, Nitrocarga, Danza Acuática); [Físico · no falla · cuerpo a cuerpo · a uno](#físico-no-falla-cuerpo-a-cuerpo-a-uno) (Puño Sombra, Golpe Aéreo, Cuerno Certero); [Físico · precisión 85 % · cuerpo a cuerpo · a uno](#físico-precisión-85-cuerpo-a-cuerpo-a-uno) (Latigazo, Megacuerno, Atadura); [Físico · precisión 90 % · cuerpo a cuerpo · a uno · interrumpe](#físico-precisión-90-cuerpo-a-cuerpo-a-uno-interrumpe) (Hipercolmillo, Cabezazo Zen, Patada Hacha); [Físico · precisión 90 % · cuerpo a cuerpo · a uno · multigolpe](#físico-precisión-90-cuerpo-a-cuerpo-a-uno-multigolpe) (Doble Golpe, Golpe Bis, Ala Bis); [Físico · cuerpo a cuerpo · a uno · multigolpe](#físico-cuerpo-a-cuerpo-a-uno-multigolpe) (Doble Patada, Empujón); [Físico · precisión 75 % · cuerpo a cuerpo · a uno](#físico-precisión-75-cuerpo-a-cuerpo-a-uno) (Atizar, Cola Férrea); [Físico · precisión 90 % · cuerpo a cuerpo · a uno · lento](#físico-precisión-90-cuerpo-a-cuerpo-a-uno-lento) (Cola Dragón, Llave Giro); [Físico · precisión 90 % · cuerpo a cuerpo · a uno · se sube stats](#físico-precisión-90-cuerpo-a-cuerpo-a-uno-se-sube-stats) (Ala de Acero, Puño Meteoro); [Físico · cuerpo a cuerpo · a uno · vuelve](#físico-cuerpo-a-cuerpo-a-uno-vuelve) (Ida y Vuelta); [Físico · precisión 90 % · a distancia · a uno](#físico-precisión-90-a-distancia-a-uno) (Lanzarrocas); [Físico · precisión 90 % · cuerpo a cuerpo · a uno · agota](#físico-precisión-90-cuerpo-a-cuerpo-a-uno-agota) (Gigaimpacto); [Físico · precisión 90 % · cuerpo a cuerpo · a uno · se baja stats](#físico-precisión-90-cuerpo-a-cuerpo-a-uno-se-baja-stats) (Machada).

## Especial · a distancia · en área

| Potencia | Bicho | Hada | Fuego | Hielo | Normal | Veneno |
|---|---|---|---|---|---|---|
| 40 |  |  |  | Nieve Polvo |  | Ácido |
| 50 | Estoicismo |  |  |  |  |  |
| 60 |  |  | Calcinación |  |  |  |
| 80 |  | Brillo Mágico |  |  |  |  |
| 90 |  |  |  |  | Vozarrón |  |

Variantes: [Especial · a distancia · a uno](#especial-a-distancia-a-uno) (Pistola Agua, Fuerza Lunar, Ascuas…); [Especial · a distancia · alrededor](#especial-a-distancia-alrededor) (Humareda, Chispazo, Onda Tóxica…); [Especial · precisión 95 % · a distancia · en área](#especial-precisión-95-a-distancia-en-área) (Viento Hielo, Aire Afilado, Alarido); [Especial · a distancia · en área · burst](#especial-a-distancia-en-área-burst) (Estallido, Salpicar); [Especial · no falla · a distancia · en área](#especial-no-falla-a-distancia-en-área) (Rapidez, Voz Cautivadora); [Especial · a distancia · en área · interrumpe](#especial-a-distancia-en-área-interrumpe) (Ciclón); [Especial · precisión 85 % · a distancia · en área](#especial-precisión-85-a-distancia-en-área) (Agua Lodosa); [Especial · precisión 90 % · a distancia · en área](#especial-precisión-90-a-distancia-en-área) (Onda Ígnea).

## Especial · a distancia · alrededor

| Potencia | Eléctrico | Fuego | Normal | Veneno | Agua |
|---|---|---|---|---|---|
| 80 | Chispazo | Humareda |  |  |  |
| 90 |  |  |  |  | Surf |
| 95 |  |  |  | Onda Tóxica |  |
| 140 |  |  | Estruendo |  |  |

Variantes: [Especial · a distancia · a uno](#especial-a-distancia-a-uno) (Pistola Agua, Fuerza Lunar, Ascuas…); [Especial · a distancia · en área](#especial-a-distancia-en-área) (Ácido, Calcinación, Nieve Polvo…); [Físico · a distancia · alrededor](#físico-a-distancia-alrededor) (Tormenta Floral, Terremoto, Terratemblor); [Especial · a distancia · alrededor · interrumpe](#especial-a-distancia-alrededor-interrumpe) (Aria Burbuja).

## Físico · cuerpo a cuerpo · a uno · prioridad

| Potencia | Lucha | Fantasma | Normal | Acero | Agua |
|---|---|---|---|---|---|
| 40 | Ultrapuño | Sombra Vil | Ataque Rápido | Puño Bala | Acua Jet |

Variantes: [Físico · cuerpo a cuerpo · a uno](#físico-cuerpo-a-cuerpo-a-uno) (Placaje, Triturar, Golpe Cuerpo…); [Físico · precisión 95 % · cuerpo a cuerpo · a uno](#físico-precisión-95-cuerpo-a-cuerpo-a-uno) (Fuerza Equina, Colmillo Ígneo, Colmillo Hielo…); [Físico · cuerpo a cuerpo · a uno · interrumpe](#físico-cuerpo-a-cuerpo-a-uno-interrumpe) (Golpe Cabeza, Pisotón, Mordisco…); [Físico · precisión 90 % · cuerpo a cuerpo · a uno](#físico-precisión-90-cuerpo-a-cuerpo-a-uno) (Rodar, Carantoña, Patada Salto Alta…); [Físico · cuerpo a cuerpo · a uno · se daña](#físico-cuerpo-a-cuerpo-a-uno-se-daña) (Doble Filo, Envite Ígneo, Pájaro Osado…); [Físico · cuerpo a cuerpo · a uno · burst](#físico-cuerpo-a-cuerpo-a-uno-burst) (Última Baza, Represalia, Asalto Espadón); [Físico · cuerpo a cuerpo · a uno · carga](#físico-cuerpo-a-cuerpo-a-uno-carga) (Buceo, Excavar, Golpe Fantasma); [Físico · cuerpo a cuerpo · a uno · drena](#físico-cuerpo-a-cuerpo-a-uno-drena) (Chupavidas, Puño Drenaje, Asta Drenaje); [Físico · cuerpo a cuerpo · a uno · lento](#físico-cuerpo-a-cuerpo-a-uno-lento) (Alud, Desquite, Puño Certero); [Físico · cuerpo a cuerpo · a uno · se sube stats](#físico-cuerpo-a-cuerpo-a-uno-se-sube-stats) (Giro Rápido, Nitrocarga, Danza Acuática); [Físico · no falla · cuerpo a cuerpo · a uno](#físico-no-falla-cuerpo-a-cuerpo-a-uno) (Puño Sombra, Golpe Aéreo, Cuerno Certero); [Físico · precisión 85 % · cuerpo a cuerpo · a uno](#físico-precisión-85-cuerpo-a-cuerpo-a-uno) (Latigazo, Megacuerno, Atadura); [Físico · a distancia · a uno · prioridad](#físico-a-distancia-a-uno-prioridad) (Esquirla Helada, Amago); [Físico · cuerpo a cuerpo · a uno · multigolpe](#físico-cuerpo-a-cuerpo-a-uno-multigolpe) (Doble Patada, Empujón); [Físico · cuerpo a cuerpo · a uno · prioridad · burst](#físico-cuerpo-a-cuerpo-a-uno-prioridad-burst) (Velocidad Extrema, Golpe Bajo); [Físico · precisión 75 % · cuerpo a cuerpo · a uno](#físico-precisión-75-cuerpo-a-cuerpo-a-uno) (Atizar, Cola Férrea); [Físico · cuerpo a cuerpo · a uno · prioridad · interrumpe](#físico-cuerpo-a-cuerpo-a-uno-prioridad-interrumpe) (Sorpresa); [Físico · cuerpo a cuerpo · a uno · vuelve](#físico-cuerpo-a-cuerpo-a-uno-vuelve) (Ida y Vuelta).

## Físico · cuerpo a cuerpo · a uno · se daña

| Potencia | Fuego | Volador | Planta | Normal | Agua |
|---|---|---|---|---|---|
| 120 | Envite Ígneo | Pájaro Osado | Mazazo | Doble Filo | Envite Acuático |

Variantes: [Físico · cuerpo a cuerpo · a uno](#físico-cuerpo-a-cuerpo-a-uno) (Placaje, Triturar, Golpe Cuerpo…); [Físico · precisión 95 % · cuerpo a cuerpo · a uno](#físico-precisión-95-cuerpo-a-cuerpo-a-uno) (Fuerza Equina, Colmillo Ígneo, Colmillo Hielo…); [Físico · cuerpo a cuerpo · a uno · interrumpe](#físico-cuerpo-a-cuerpo-a-uno-interrumpe) (Golpe Cabeza, Pisotón, Mordisco…); [Físico · precisión 90 % · cuerpo a cuerpo · a uno](#físico-precisión-90-cuerpo-a-cuerpo-a-uno) (Rodar, Carantoña, Patada Salto Alta…); [Físico · cuerpo a cuerpo · a uno · prioridad](#físico-cuerpo-a-cuerpo-a-uno-prioridad) (Acua Jet, Ataque Rápido, Sombra Vil…); [Físico · cuerpo a cuerpo · a uno · burst](#físico-cuerpo-a-cuerpo-a-uno-burst) (Última Baza, Represalia, Asalto Espadón); [Físico · cuerpo a cuerpo · a uno · carga](#físico-cuerpo-a-cuerpo-a-uno-carga) (Buceo, Excavar, Golpe Fantasma); [Físico · cuerpo a cuerpo · a uno · drena](#físico-cuerpo-a-cuerpo-a-uno-drena) (Chupavidas, Puño Drenaje, Asta Drenaje); [Físico · cuerpo a cuerpo · a uno · lento](#físico-cuerpo-a-cuerpo-a-uno-lento) (Alud, Desquite, Puño Certero); [Físico · cuerpo a cuerpo · a uno · se sube stats](#físico-cuerpo-a-cuerpo-a-uno-se-sube-stats) (Giro Rápido, Nitrocarga, Danza Acuática); [Físico · no falla · cuerpo a cuerpo · a uno](#físico-no-falla-cuerpo-a-cuerpo-a-uno) (Puño Sombra, Golpe Aéreo, Cuerno Certero); [Físico · precisión 85 % · cuerpo a cuerpo · a uno](#físico-precisión-85-cuerpo-a-cuerpo-a-uno) (Latigazo, Megacuerno, Atadura); [Físico · cuerpo a cuerpo · a uno · multigolpe](#físico-cuerpo-a-cuerpo-a-uno-multigolpe) (Doble Patada, Empujón); [Físico · precisión 75 % · cuerpo a cuerpo · a uno](#físico-precisión-75-cuerpo-a-cuerpo-a-uno) (Atizar, Cola Férrea); [Físico · cuerpo a cuerpo · a uno · vuelve](#físico-cuerpo-a-cuerpo-a-uno-vuelve) (Ida y Vuelta); [Físico · precisión 80 % · cuerpo a cuerpo · a uno · se daña](#físico-precisión-80-cuerpo-a-cuerpo-a-uno-se-daña) (Sumisión); [Físico · precisión 85 % · cuerpo a cuerpo · a uno · se daña](#físico-precisión-85-cuerpo-a-cuerpo-a-uno-se-daña) (Derribo).

## Especial · a distancia · a uno · drena

| Potencia | Planta | Psíquico |
|---|---|---|
| 20 | **Absorber** |  |
| 40 | **Megaagotar** |  |
| 75 | **Gigadrenado** |  |
| 100 |  | Comesueños |

Líneas (en negrita): Drenajes (Absorber 20 → Megaagotar 40 → Gigadrenado 75).

Variantes: [Especial · a distancia · a uno](#especial-a-distancia-a-uno) (Pistola Agua, Fuerza Lunar, Ascuas…); [Especial · a distancia · a uno · interrumpe](#especial-a-distancia-a-uno-interrumpe) (Ronquido, Confusión, Hidropulso…); [Especial · no falla · a distancia · a uno](#especial-no-falla-a-distancia-a-uno) (Hoja Mágica, Niebla Clara, Esfera Aural); [Especial · a distancia · a uno · se sube stats](#especial-a-distancia-a-uno-se-sube-stats) (Danza Llama, Canto Ardiente); [Especial · precisión 70 % · a distancia · a uno](#especial-precisión-70-a-distancia-a-uno) (Polución, Trueno); [Especial · precisión 85 % · a distancia · a uno](#especial-precisión-85-a-distancia-a-uno) (Torbellino, Giro Fuego); [Especial · precisión 90 % · a distancia · a uno](#especial-precisión-90-a-distancia-a-uno) (Eructo, Vaho Gélido); [Especial · precisión 95 % · a distancia · a uno](#especial-precisión-95-a-distancia-a-uno) (Disparo Lodo, Pulso Noche); [Especial · a distancia · a uno · burst](#especial-a-distancia-a-uno-burst) (Llama Final); [Especial · a distancia · a uno · carga](#especial-a-distancia-a-uno-carga) (Rayo Solar); [Especial · a distancia · a uno · prioridad](#especial-a-distancia-a-uno-prioridad) (Onda Vacío); [Especial · cuerpo a cuerpo · a uno · drena](#especial-cuerpo-a-cuerpo-a-uno-drena) (Beso Drenaje).

## Especial · no falla · a distancia · a uno

| Potencia | Lucha | Planta | Veneno |
|---|---|---|---|
| 50 |  |  | Niebla Clara |
| 60 |  | Hoja Mágica |  |
| 80 | Esfera Aural |  |  |

Variantes: [Especial · a distancia · a uno](#especial-a-distancia-a-uno) (Pistola Agua, Fuerza Lunar, Ascuas…); [Especial · a distancia · a uno · interrumpe](#especial-a-distancia-a-uno-interrumpe) (Ronquido, Confusión, Hidropulso…); [Especial · a distancia · a uno · drena](#especial-a-distancia-a-uno-drena) (Absorber, Megaagotar, Gigadrenado…); [Especial · a distancia · a uno · se sube stats](#especial-a-distancia-a-uno-se-sube-stats) (Danza Llama, Canto Ardiente); [Especial · no falla · a distancia · en área](#especial-no-falla-a-distancia-en-área) (Rapidez, Voz Cautivadora); [Especial · precisión 70 % · a distancia · a uno](#especial-precisión-70-a-distancia-a-uno) (Polución, Trueno); [Especial · precisión 85 % · a distancia · a uno](#especial-precisión-85-a-distancia-a-uno) (Torbellino, Giro Fuego); [Especial · precisión 90 % · a distancia · a uno](#especial-precisión-90-a-distancia-a-uno) (Eructo, Vaho Gélido); [Especial · precisión 95 % · a distancia · a uno](#especial-precisión-95-a-distancia-a-uno) (Disparo Lodo, Pulso Noche); [Especial · a distancia · a uno · burst](#especial-a-distancia-a-uno-burst) (Llama Final); [Especial · a distancia · a uno · carga](#especial-a-distancia-a-uno-carga) (Rayo Solar); [Especial · a distancia · a uno · prioridad](#especial-a-distancia-a-uno-prioridad) (Onda Vacío); [Físico · no falla · a distancia · a uno](#físico-no-falla-a-distancia-a-uno) (Truco Floral).

## Especial · precisión 95 % · a distancia · en área

| Potencia | Siniestro | Volador | Hielo |
|---|---|---|---|
| 55 | Alarido |  | Viento Hielo |
| 60 |  | Aire Afilado |  |

Variantes: [Especial · a distancia · en área](#especial-a-distancia-en-área) (Ácido, Calcinación, Nieve Polvo…); [Especial · a distancia · en área · burst](#especial-a-distancia-en-área-burst) (Estallido, Salpicar); [Especial · no falla · a distancia · en área](#especial-no-falla-a-distancia-en-área) (Rapidez, Voz Cautivadora); [Especial · precisión 95 % · a distancia · a uno](#especial-precisión-95-a-distancia-a-uno) (Disparo Lodo, Pulso Noche); [Especial · a distancia · en área · interrumpe](#especial-a-distancia-en-área-interrumpe) (Ciclón); [Especial · precisión 85 % · a distancia · en área](#especial-precisión-85-a-distancia-en-área) (Agua Lodosa); [Especial · precisión 90 % · a distancia · en área](#especial-precisión-90-a-distancia-en-área) (Onda Ígnea); [Físico · precisión 95 % · a distancia · en área](#físico-precisión-95-a-distancia-en-área) (Hoja Afilada).

## Físico · a distancia · a uno · multigolpe

| Potencia | Dragón | Planta | Hielo |
|---|---|---|---|
| 25 |  | Semilladora | Carámbano |
| 50 | Dracoflechas |  |  |

Variantes: [Físico · a distancia · a uno](#físico-a-distancia-a-uno) (Bomba Germen, Antiaéreo, Psicocorte…); [Físico · a distancia · a uno · prioridad](#físico-a-distancia-a-uno-prioridad) (Esquirla Helada, Amago); [Físico · cuerpo a cuerpo · a uno · multigolpe](#físico-cuerpo-a-cuerpo-a-uno-multigolpe) (Doble Patada, Empujón); [Físico · precisión 90 % · a distancia · a uno · multigolpe](#físico-precisión-90-a-distancia-a-uno-multigolpe) (Pedrada, Ataque Óseo); [Físico · a distancia · a uno · interrumpe](#físico-a-distancia-a-uno-interrumpe) (Puntada Sombría); [Físico · no falla · a distancia · a uno](#físico-no-falla-a-distancia-a-uno) (Truco Floral); [Físico · precisión 85 % · a distancia · a uno](#físico-precisión-85-a-distancia-a-uno) (Bucle Arena); [Físico · precisión 90 % · a distancia · a uno](#físico-precisión-90-a-distancia-a-uno) (Lanzarrocas); [Físico · precisión 95 % · a distancia · a uno](#físico-precisión-95-a-distancia-a-uno) (Tumba Rocas); [Físico · precisión 95 % · a distancia · a uno · multigolpe](#físico-precisión-95-a-distancia-a-uno-multigolpe) (Pin Misil).

## Físico · a distancia · alrededor

| Potencia | Planta | Tierra |
|---|---|---|
| 60 |  | **Terratemblor** |
| 90 | Tormenta Floral |  |
| 100 |  | **Terremoto** |

Líneas (en negrita): Seísmos (Terratemblor 60 → Terremoto 100).

Variantes: [Físico · a distancia · a uno](#físico-a-distancia-a-uno) (Bomba Germen, Antiaéreo, Psicocorte…); [Especial · a distancia · alrededor](#especial-a-distancia-alrededor) (Humareda, Chispazo, Onda Tóxica…); [Físico · a distancia · alrededor · burst](#físico-a-distancia-alrededor-burst) (Explosión, Autodestrucción); [Físico · cuerpo a cuerpo · alrededor](#físico-cuerpo-a-cuerpo-alrededor) (Giro Vil).

## Físico · cuerpo a cuerpo · a uno · burst

| Potencia | Dragón | Normal |
|---|---|---|
| 70 |  | Represalia |
| 120 | Asalto Espadón |  |
| 140 |  | Última Baza |

Variantes: [Físico · cuerpo a cuerpo · a uno](#físico-cuerpo-a-cuerpo-a-uno) (Placaje, Triturar, Golpe Cuerpo…); [Físico · precisión 95 % · cuerpo a cuerpo · a uno](#físico-precisión-95-cuerpo-a-cuerpo-a-uno) (Fuerza Equina, Colmillo Ígneo, Colmillo Hielo…); [Físico · cuerpo a cuerpo · a uno · interrumpe](#físico-cuerpo-a-cuerpo-a-uno-interrumpe) (Golpe Cabeza, Pisotón, Mordisco…); [Físico · precisión 90 % · cuerpo a cuerpo · a uno](#físico-precisión-90-cuerpo-a-cuerpo-a-uno) (Rodar, Carantoña, Patada Salto Alta…); [Físico · cuerpo a cuerpo · a uno · prioridad](#físico-cuerpo-a-cuerpo-a-uno-prioridad) (Acua Jet, Ataque Rápido, Sombra Vil…); [Físico · cuerpo a cuerpo · a uno · se daña](#físico-cuerpo-a-cuerpo-a-uno-se-daña) (Doble Filo, Envite Ígneo, Pájaro Osado…); [Físico · cuerpo a cuerpo · a uno · carga](#físico-cuerpo-a-cuerpo-a-uno-carga) (Buceo, Excavar, Golpe Fantasma); [Físico · cuerpo a cuerpo · a uno · drena](#físico-cuerpo-a-cuerpo-a-uno-drena) (Chupavidas, Puño Drenaje, Asta Drenaje); [Físico · cuerpo a cuerpo · a uno · lento](#físico-cuerpo-a-cuerpo-a-uno-lento) (Alud, Desquite, Puño Certero); [Físico · cuerpo a cuerpo · a uno · se baja stats · burst](#físico-cuerpo-a-cuerpo-a-uno-se-baja-stats-burst) (Fuerza Bruta, A Bocajarro, Arremetida); [Físico · cuerpo a cuerpo · a uno · se sube stats](#físico-cuerpo-a-cuerpo-a-uno-se-sube-stats) (Giro Rápido, Nitrocarga, Danza Acuática); [Físico · no falla · cuerpo a cuerpo · a uno](#físico-no-falla-cuerpo-a-cuerpo-a-uno) (Puño Sombra, Golpe Aéreo, Cuerno Certero); [Físico · precisión 85 % · cuerpo a cuerpo · a uno](#físico-precisión-85-cuerpo-a-cuerpo-a-uno) (Latigazo, Megacuerno, Atadura); [Físico · cuerpo a cuerpo · a uno · multigolpe](#físico-cuerpo-a-cuerpo-a-uno-multigolpe) (Doble Patada, Empujón); [Físico · cuerpo a cuerpo · a uno · prioridad · burst](#físico-cuerpo-a-cuerpo-a-uno-prioridad-burst) (Velocidad Extrema, Golpe Bajo); [Físico · precisión 75 % · cuerpo a cuerpo · a uno](#físico-precisión-75-cuerpo-a-cuerpo-a-uno) (Atizar, Cola Férrea); [Físico · cuerpo a cuerpo · a uno · vuelve](#físico-cuerpo-a-cuerpo-a-uno-vuelve) (Ida y Vuelta); [Físico · precisión 75 % · cuerpo a cuerpo · a uno · burst](#físico-precisión-75-cuerpo-a-cuerpo-a-uno-burst) (Megapatada); [Físico · precisión 80 % · cuerpo a cuerpo · a uno · burst](#físico-precisión-80-cuerpo-a-cuerpo-a-uno-burst) (Tajo Cruzado).

## Físico · cuerpo a cuerpo · a uno · carga

| Potencia | Fantasma | Tierra | Agua |
|---|---|---|---|
| 80 |  | Excavar | Buceo |
| 90 | Golpe Fantasma |  |  |

Variantes: [Físico · cuerpo a cuerpo · a uno](#físico-cuerpo-a-cuerpo-a-uno) (Placaje, Triturar, Golpe Cuerpo…); [Físico · precisión 95 % · cuerpo a cuerpo · a uno](#físico-precisión-95-cuerpo-a-cuerpo-a-uno) (Fuerza Equina, Colmillo Ígneo, Colmillo Hielo…); [Físico · cuerpo a cuerpo · a uno · interrumpe](#físico-cuerpo-a-cuerpo-a-uno-interrumpe) (Golpe Cabeza, Pisotón, Mordisco…); [Físico · precisión 90 % · cuerpo a cuerpo · a uno](#físico-precisión-90-cuerpo-a-cuerpo-a-uno) (Rodar, Carantoña, Patada Salto Alta…); [Físico · cuerpo a cuerpo · a uno · prioridad](#físico-cuerpo-a-cuerpo-a-uno-prioridad) (Acua Jet, Ataque Rápido, Sombra Vil…); [Físico · cuerpo a cuerpo · a uno · se daña](#físico-cuerpo-a-cuerpo-a-uno-se-daña) (Doble Filo, Envite Ígneo, Pájaro Osado…); [Físico · cuerpo a cuerpo · a uno · burst](#físico-cuerpo-a-cuerpo-a-uno-burst) (Última Baza, Represalia, Asalto Espadón); [Físico · cuerpo a cuerpo · a uno · drena](#físico-cuerpo-a-cuerpo-a-uno-drena) (Chupavidas, Puño Drenaje, Asta Drenaje); [Físico · cuerpo a cuerpo · a uno · lento](#físico-cuerpo-a-cuerpo-a-uno-lento) (Alud, Desquite, Puño Certero); [Físico · cuerpo a cuerpo · a uno · se sube stats](#físico-cuerpo-a-cuerpo-a-uno-se-sube-stats) (Giro Rápido, Nitrocarga, Danza Acuática); [Físico · no falla · cuerpo a cuerpo · a uno](#físico-no-falla-cuerpo-a-cuerpo-a-uno) (Puño Sombra, Golpe Aéreo, Cuerno Certero); [Físico · precisión 85 % · cuerpo a cuerpo · a uno](#físico-precisión-85-cuerpo-a-cuerpo-a-uno) (Latigazo, Megacuerno, Atadura); [Físico · cuerpo a cuerpo · a uno · multigolpe](#físico-cuerpo-a-cuerpo-a-uno-multigolpe) (Doble Patada, Empujón); [Físico · precisión 75 % · cuerpo a cuerpo · a uno](#físico-precisión-75-cuerpo-a-cuerpo-a-uno) (Atizar, Cola Férrea); [Físico · cuerpo a cuerpo · a uno · vuelve](#físico-cuerpo-a-cuerpo-a-uno-vuelve) (Ida y Vuelta); [Físico · precisión 95 % · cuerpo a cuerpo · a uno · carga](#físico-precisión-95-cuerpo-a-cuerpo-a-uno-carga) (Vuelo).

## Físico · cuerpo a cuerpo · a uno · drena

| Potencia | Bicho | Lucha | Planta |
|---|---|---|---|
| 75 |  | Puño Drenaje | Asta Drenaje |
| 80 | Chupavidas |  |  |

Variantes: [Físico · cuerpo a cuerpo · a uno](#físico-cuerpo-a-cuerpo-a-uno) (Placaje, Triturar, Golpe Cuerpo…); [Físico · precisión 95 % · cuerpo a cuerpo · a uno](#físico-precisión-95-cuerpo-a-cuerpo-a-uno) (Fuerza Equina, Colmillo Ígneo, Colmillo Hielo…); [Físico · cuerpo a cuerpo · a uno · interrumpe](#físico-cuerpo-a-cuerpo-a-uno-interrumpe) (Golpe Cabeza, Pisotón, Mordisco…); [Físico · precisión 90 % · cuerpo a cuerpo · a uno](#físico-precisión-90-cuerpo-a-cuerpo-a-uno) (Rodar, Carantoña, Patada Salto Alta…); [Físico · cuerpo a cuerpo · a uno · prioridad](#físico-cuerpo-a-cuerpo-a-uno-prioridad) (Acua Jet, Ataque Rápido, Sombra Vil…); [Físico · cuerpo a cuerpo · a uno · se daña](#físico-cuerpo-a-cuerpo-a-uno-se-daña) (Doble Filo, Envite Ígneo, Pájaro Osado…); [Físico · cuerpo a cuerpo · a uno · burst](#físico-cuerpo-a-cuerpo-a-uno-burst) (Última Baza, Represalia, Asalto Espadón); [Físico · cuerpo a cuerpo · a uno · carga](#físico-cuerpo-a-cuerpo-a-uno-carga) (Buceo, Excavar, Golpe Fantasma); [Físico · cuerpo a cuerpo · a uno · lento](#físico-cuerpo-a-cuerpo-a-uno-lento) (Alud, Desquite, Puño Certero); [Físico · cuerpo a cuerpo · a uno · se sube stats](#físico-cuerpo-a-cuerpo-a-uno-se-sube-stats) (Giro Rápido, Nitrocarga, Danza Acuática); [Físico · no falla · cuerpo a cuerpo · a uno](#físico-no-falla-cuerpo-a-cuerpo-a-uno) (Puño Sombra, Golpe Aéreo, Cuerno Certero); [Físico · precisión 85 % · cuerpo a cuerpo · a uno](#físico-precisión-85-cuerpo-a-cuerpo-a-uno) (Latigazo, Megacuerno, Atadura); [Físico · cuerpo a cuerpo · a uno · multigolpe](#físico-cuerpo-a-cuerpo-a-uno-multigolpe) (Doble Patada, Empujón); [Físico · precisión 75 % · cuerpo a cuerpo · a uno](#físico-precisión-75-cuerpo-a-cuerpo-a-uno) (Atizar, Cola Férrea); [Especial · cuerpo a cuerpo · a uno · drena](#especial-cuerpo-a-cuerpo-a-uno-drena) (Beso Drenaje); [Físico · cuerpo a cuerpo · a uno · vuelve](#físico-cuerpo-a-cuerpo-a-uno-vuelve) (Ida y Vuelta).

## Físico · cuerpo a cuerpo · a uno · lento

| Potencia | Lucha | Hielo |
|---|---|---|
| 60 | Desquite | Alud |
| 150 | Puño Certero |  |

Variantes: [Físico · cuerpo a cuerpo · a uno](#físico-cuerpo-a-cuerpo-a-uno) (Placaje, Triturar, Golpe Cuerpo…); [Físico · precisión 95 % · cuerpo a cuerpo · a uno](#físico-precisión-95-cuerpo-a-cuerpo-a-uno) (Fuerza Equina, Colmillo Ígneo, Colmillo Hielo…); [Físico · cuerpo a cuerpo · a uno · interrumpe](#físico-cuerpo-a-cuerpo-a-uno-interrumpe) (Golpe Cabeza, Pisotón, Mordisco…); [Físico · precisión 90 % · cuerpo a cuerpo · a uno](#físico-precisión-90-cuerpo-a-cuerpo-a-uno) (Rodar, Carantoña, Patada Salto Alta…); [Físico · cuerpo a cuerpo · a uno · prioridad](#físico-cuerpo-a-cuerpo-a-uno-prioridad) (Acua Jet, Ataque Rápido, Sombra Vil…); [Físico · cuerpo a cuerpo · a uno · se daña](#físico-cuerpo-a-cuerpo-a-uno-se-daña) (Doble Filo, Envite Ígneo, Pájaro Osado…); [Físico · cuerpo a cuerpo · a uno · burst](#físico-cuerpo-a-cuerpo-a-uno-burst) (Última Baza, Represalia, Asalto Espadón); [Físico · cuerpo a cuerpo · a uno · carga](#físico-cuerpo-a-cuerpo-a-uno-carga) (Buceo, Excavar, Golpe Fantasma); [Físico · cuerpo a cuerpo · a uno · drena](#físico-cuerpo-a-cuerpo-a-uno-drena) (Chupavidas, Puño Drenaje, Asta Drenaje); [Físico · cuerpo a cuerpo · a uno · se sube stats](#físico-cuerpo-a-cuerpo-a-uno-se-sube-stats) (Giro Rápido, Nitrocarga, Danza Acuática); [Físico · no falla · cuerpo a cuerpo · a uno](#físico-no-falla-cuerpo-a-cuerpo-a-uno) (Puño Sombra, Golpe Aéreo, Cuerno Certero); [Físico · precisión 85 % · cuerpo a cuerpo · a uno](#físico-precisión-85-cuerpo-a-cuerpo-a-uno) (Latigazo, Megacuerno, Atadura); [Físico · cuerpo a cuerpo · a uno · multigolpe](#físico-cuerpo-a-cuerpo-a-uno-multigolpe) (Doble Patada, Empujón); [Físico · precisión 75 % · cuerpo a cuerpo · a uno](#físico-precisión-75-cuerpo-a-cuerpo-a-uno) (Atizar, Cola Férrea); [Físico · precisión 90 % · cuerpo a cuerpo · a uno · lento](#físico-precisión-90-cuerpo-a-cuerpo-a-uno-lento) (Cola Dragón, Llave Giro); [Físico · cuerpo a cuerpo · a uno · vuelve](#físico-cuerpo-a-cuerpo-a-uno-vuelve) (Ida y Vuelta); [Físico · no falla · cuerpo a cuerpo · a uno · lento](#físico-no-falla-cuerpo-a-cuerpo-a-uno-lento) (Tiro Vital).

## Físico · cuerpo a cuerpo · a uno · se baja stats · burst

| Potencia | Lucha | Tierra |
|---|---|---|
| 120 | Fuerza Bruta, A Bocajarro | Arremetida |

Variantes: [Físico · cuerpo a cuerpo · a uno · burst](#físico-cuerpo-a-cuerpo-a-uno-burst) (Última Baza, Represalia, Asalto Espadón); [Físico · cuerpo a cuerpo · a uno · prioridad · burst](#físico-cuerpo-a-cuerpo-a-uno-prioridad-burst) (Velocidad Extrema, Golpe Bajo); [Físico · precisión 75 % · cuerpo a cuerpo · a uno · burst](#físico-precisión-75-cuerpo-a-cuerpo-a-uno-burst) (Megapatada); [Físico · precisión 80 % · cuerpo a cuerpo · a uno · burst](#físico-precisión-80-cuerpo-a-cuerpo-a-uno-burst) (Tajo Cruzado); [Físico · precisión 90 % · cuerpo a cuerpo · a uno · se baja stats](#físico-precisión-90-cuerpo-a-cuerpo-a-uno-se-baja-stats) (Machada).

## Físico · cuerpo a cuerpo · a uno · se sube stats

| Potencia | Fuego | Normal | Agua |
|---|---|---|---|
| 50 | Nitrocarga | Giro Rápido |  |
| 80 |  |  | Danza Acuática |

Variantes: [Físico · cuerpo a cuerpo · a uno](#físico-cuerpo-a-cuerpo-a-uno) (Placaje, Triturar, Golpe Cuerpo…); [Físico · precisión 95 % · cuerpo a cuerpo · a uno](#físico-precisión-95-cuerpo-a-cuerpo-a-uno) (Fuerza Equina, Colmillo Ígneo, Colmillo Hielo…); [Físico · cuerpo a cuerpo · a uno · interrumpe](#físico-cuerpo-a-cuerpo-a-uno-interrumpe) (Golpe Cabeza, Pisotón, Mordisco…); [Físico · precisión 90 % · cuerpo a cuerpo · a uno](#físico-precisión-90-cuerpo-a-cuerpo-a-uno) (Rodar, Carantoña, Patada Salto Alta…); [Físico · cuerpo a cuerpo · a uno · prioridad](#físico-cuerpo-a-cuerpo-a-uno-prioridad) (Acua Jet, Ataque Rápido, Sombra Vil…); [Físico · cuerpo a cuerpo · a uno · se daña](#físico-cuerpo-a-cuerpo-a-uno-se-daña) (Doble Filo, Envite Ígneo, Pájaro Osado…); [Físico · cuerpo a cuerpo · a uno · burst](#físico-cuerpo-a-cuerpo-a-uno-burst) (Última Baza, Represalia, Asalto Espadón); [Físico · cuerpo a cuerpo · a uno · carga](#físico-cuerpo-a-cuerpo-a-uno-carga) (Buceo, Excavar, Golpe Fantasma); [Físico · cuerpo a cuerpo · a uno · drena](#físico-cuerpo-a-cuerpo-a-uno-drena) (Chupavidas, Puño Drenaje, Asta Drenaje); [Físico · cuerpo a cuerpo · a uno · lento](#físico-cuerpo-a-cuerpo-a-uno-lento) (Alud, Desquite, Puño Certero); [Físico · no falla · cuerpo a cuerpo · a uno](#físico-no-falla-cuerpo-a-cuerpo-a-uno) (Puño Sombra, Golpe Aéreo, Cuerno Certero); [Físico · precisión 85 % · cuerpo a cuerpo · a uno](#físico-precisión-85-cuerpo-a-cuerpo-a-uno) (Latigazo, Megacuerno, Atadura); [Físico · cuerpo a cuerpo · a uno · multigolpe](#físico-cuerpo-a-cuerpo-a-uno-multigolpe) (Doble Patada, Empujón); [Físico · precisión 75 % · cuerpo a cuerpo · a uno](#físico-precisión-75-cuerpo-a-cuerpo-a-uno) (Atizar, Cola Férrea); [Físico · precisión 90 % · cuerpo a cuerpo · a uno · se sube stats](#físico-precisión-90-cuerpo-a-cuerpo-a-uno-se-sube-stats) (Ala de Acero, Puño Meteoro); [Físico · cuerpo a cuerpo · a uno · vuelve](#físico-cuerpo-a-cuerpo-a-uno-vuelve) (Ida y Vuelta); [Físico · precisión 95 % · cuerpo a cuerpo · a uno · se sube stats](#físico-precisión-95-cuerpo-a-cuerpo-a-uno-se-sube-stats) (Garra Metal).

## Físico · no falla · cuerpo a cuerpo · a uno

| Potencia | Volador | Fantasma | Acero |
|---|---|---|---|
| 60 | Golpe Aéreo | Puño Sombra |  |
| 70 |  |  | Cuerno Certero |

Variantes: [Físico · cuerpo a cuerpo · a uno](#físico-cuerpo-a-cuerpo-a-uno) (Placaje, Triturar, Golpe Cuerpo…); [Físico · precisión 95 % · cuerpo a cuerpo · a uno](#físico-precisión-95-cuerpo-a-cuerpo-a-uno) (Fuerza Equina, Colmillo Ígneo, Colmillo Hielo…); [Físico · cuerpo a cuerpo · a uno · interrumpe](#físico-cuerpo-a-cuerpo-a-uno-interrumpe) (Golpe Cabeza, Pisotón, Mordisco…); [Físico · precisión 90 % · cuerpo a cuerpo · a uno](#físico-precisión-90-cuerpo-a-cuerpo-a-uno) (Rodar, Carantoña, Patada Salto Alta…); [Físico · cuerpo a cuerpo · a uno · prioridad](#físico-cuerpo-a-cuerpo-a-uno-prioridad) (Acua Jet, Ataque Rápido, Sombra Vil…); [Físico · cuerpo a cuerpo · a uno · se daña](#físico-cuerpo-a-cuerpo-a-uno-se-daña) (Doble Filo, Envite Ígneo, Pájaro Osado…); [Físico · cuerpo a cuerpo · a uno · burst](#físico-cuerpo-a-cuerpo-a-uno-burst) (Última Baza, Represalia, Asalto Espadón); [Físico · cuerpo a cuerpo · a uno · carga](#físico-cuerpo-a-cuerpo-a-uno-carga) (Buceo, Excavar, Golpe Fantasma); [Físico · cuerpo a cuerpo · a uno · drena](#físico-cuerpo-a-cuerpo-a-uno-drena) (Chupavidas, Puño Drenaje, Asta Drenaje); [Físico · cuerpo a cuerpo · a uno · lento](#físico-cuerpo-a-cuerpo-a-uno-lento) (Alud, Desquite, Puño Certero); [Físico · cuerpo a cuerpo · a uno · se sube stats](#físico-cuerpo-a-cuerpo-a-uno-se-sube-stats) (Giro Rápido, Nitrocarga, Danza Acuática); [Físico · precisión 85 % · cuerpo a cuerpo · a uno](#físico-precisión-85-cuerpo-a-cuerpo-a-uno) (Latigazo, Megacuerno, Atadura); [Físico · cuerpo a cuerpo · a uno · multigolpe](#físico-cuerpo-a-cuerpo-a-uno-multigolpe) (Doble Patada, Empujón); [Físico · precisión 75 % · cuerpo a cuerpo · a uno](#físico-precisión-75-cuerpo-a-cuerpo-a-uno) (Atizar, Cola Férrea); [Físico · cuerpo a cuerpo · a uno · vuelve](#físico-cuerpo-a-cuerpo-a-uno-vuelve) (Ida y Vuelta); [Físico · no falla · a distancia · a uno](#físico-no-falla-a-distancia-a-uno) (Truco Floral); [Físico · no falla · cuerpo a cuerpo · a uno · lento](#físico-no-falla-cuerpo-a-cuerpo-a-uno-lento) (Tiro Vital).

## Físico · precisión 85 % · cuerpo a cuerpo · a uno

| Potencia | Bicho | Planta | Normal |
|---|---|---|---|
| 15 |  |  | Atadura |
| 120 | Megacuerno | Latigazo |  |

Variantes: [Físico · cuerpo a cuerpo · a uno](#físico-cuerpo-a-cuerpo-a-uno) (Placaje, Triturar, Golpe Cuerpo…); [Físico · precisión 95 % · cuerpo a cuerpo · a uno](#físico-precisión-95-cuerpo-a-cuerpo-a-uno) (Fuerza Equina, Colmillo Ígneo, Colmillo Hielo…); [Físico · cuerpo a cuerpo · a uno · interrumpe](#físico-cuerpo-a-cuerpo-a-uno-interrumpe) (Golpe Cabeza, Pisotón, Mordisco…); [Físico · precisión 90 % · cuerpo a cuerpo · a uno](#físico-precisión-90-cuerpo-a-cuerpo-a-uno) (Rodar, Carantoña, Patada Salto Alta…); [Físico · cuerpo a cuerpo · a uno · prioridad](#físico-cuerpo-a-cuerpo-a-uno-prioridad) (Acua Jet, Ataque Rápido, Sombra Vil…); [Físico · cuerpo a cuerpo · a uno · se daña](#físico-cuerpo-a-cuerpo-a-uno-se-daña) (Doble Filo, Envite Ígneo, Pájaro Osado…); [Físico · cuerpo a cuerpo · a uno · burst](#físico-cuerpo-a-cuerpo-a-uno-burst) (Última Baza, Represalia, Asalto Espadón); [Físico · cuerpo a cuerpo · a uno · carga](#físico-cuerpo-a-cuerpo-a-uno-carga) (Buceo, Excavar, Golpe Fantasma); [Físico · cuerpo a cuerpo · a uno · drena](#físico-cuerpo-a-cuerpo-a-uno-drena) (Chupavidas, Puño Drenaje, Asta Drenaje); [Físico · cuerpo a cuerpo · a uno · lento](#físico-cuerpo-a-cuerpo-a-uno-lento) (Alud, Desquite, Puño Certero); [Físico · cuerpo a cuerpo · a uno · se sube stats](#físico-cuerpo-a-cuerpo-a-uno-se-sube-stats) (Giro Rápido, Nitrocarga, Danza Acuática); [Físico · no falla · cuerpo a cuerpo · a uno](#físico-no-falla-cuerpo-a-cuerpo-a-uno) (Puño Sombra, Golpe Aéreo, Cuerno Certero); [Físico · cuerpo a cuerpo · a uno · multigolpe](#físico-cuerpo-a-cuerpo-a-uno-multigolpe) (Doble Patada, Empujón); [Físico · precisión 75 % · cuerpo a cuerpo · a uno](#físico-precisión-75-cuerpo-a-cuerpo-a-uno) (Atizar, Cola Férrea); [Físico · cuerpo a cuerpo · a uno · vuelve](#físico-cuerpo-a-cuerpo-a-uno-vuelve) (Ida y Vuelta); [Físico · precisión 85 % · a distancia · a uno](#físico-precisión-85-a-distancia-a-uno) (Bucle Arena); [Físico · precisión 85 % · cuerpo a cuerpo · a uno · multigolpe](#físico-precisión-85-cuerpo-a-cuerpo-a-uno-multigolpe) (Ataque Furia); [Físico · precisión 85 % · cuerpo a cuerpo · a uno · se daña](#físico-precisión-85-cuerpo-a-cuerpo-a-uno-se-daña) (Derribo).

## Físico · precisión 90 % · cuerpo a cuerpo · a uno · interrumpe

| Potencia | Lucha | Normal | Psíquico |
|---|---|---|---|
| 80 |  | Hipercolmillo | Cabezazo Zen |
| 120 | Patada Hacha |  |  |

Variantes: [Físico · cuerpo a cuerpo · a uno · interrumpe](#físico-cuerpo-a-cuerpo-a-uno-interrumpe) (Golpe Cabeza, Pisotón, Mordisco…); [Físico · precisión 90 % · cuerpo a cuerpo · a uno](#físico-precisión-90-cuerpo-a-cuerpo-a-uno) (Rodar, Carantoña, Patada Salto Alta…); [Físico · precisión 90 % · cuerpo a cuerpo · a uno · multigolpe](#físico-precisión-90-cuerpo-a-cuerpo-a-uno-multigolpe) (Doble Golpe, Golpe Bis, Ala Bis); [Físico · precisión 90 % · cuerpo a cuerpo · a uno · lento](#físico-precisión-90-cuerpo-a-cuerpo-a-uno-lento) (Cola Dragón, Llave Giro); [Físico · precisión 90 % · cuerpo a cuerpo · a uno · se sube stats](#físico-precisión-90-cuerpo-a-cuerpo-a-uno-se-sube-stats) (Ala de Acero, Puño Meteoro); [Físico · cuerpo a cuerpo · a uno · prioridad · interrumpe](#físico-cuerpo-a-cuerpo-a-uno-prioridad-interrumpe) (Sorpresa); [Físico · precisión 75 % · cuerpo a cuerpo · a uno · interrumpe](#físico-precisión-75-cuerpo-a-cuerpo-a-uno-interrumpe) (Carga Dragón); [Físico · precisión 90 % · a distancia · a uno · interrumpe](#físico-precisión-90-a-distancia-a-uno-interrumpe) (Chuzos); [Físico · precisión 90 % · cuerpo a cuerpo · a uno · agota](#físico-precisión-90-cuerpo-a-cuerpo-a-uno-agota) (Gigaimpacto); [Físico · precisión 90 % · cuerpo a cuerpo · a uno · se baja stats](#físico-precisión-90-cuerpo-a-cuerpo-a-uno-se-baja-stats) (Machada).

## Físico · precisión 90 % · cuerpo a cuerpo · a uno · multigolpe

| Potencia | Dragón | Volador | Normal |
|---|---|---|---|
| 35 |  |  | Doble Golpe |
| 40 | Golpe Bis | Ala Bis |  |

Variantes: [Físico · precisión 90 % · cuerpo a cuerpo · a uno](#físico-precisión-90-cuerpo-a-cuerpo-a-uno) (Rodar, Carantoña, Patada Salto Alta…); [Físico · precisión 90 % · cuerpo a cuerpo · a uno · interrumpe](#físico-precisión-90-cuerpo-a-cuerpo-a-uno-interrumpe) (Hipercolmillo, Cabezazo Zen, Patada Hacha); [Físico · cuerpo a cuerpo · a uno · multigolpe](#físico-cuerpo-a-cuerpo-a-uno-multigolpe) (Doble Patada, Empujón); [Físico · precisión 90 % · a distancia · a uno · multigolpe](#físico-precisión-90-a-distancia-a-uno-multigolpe) (Pedrada, Ataque Óseo); [Físico · precisión 90 % · cuerpo a cuerpo · a uno · lento](#físico-precisión-90-cuerpo-a-cuerpo-a-uno-lento) (Cola Dragón, Llave Giro); [Físico · precisión 90 % · cuerpo a cuerpo · a uno · se sube stats](#físico-precisión-90-cuerpo-a-cuerpo-a-uno-se-sube-stats) (Ala de Acero, Puño Meteoro); [Físico · precisión 80 % · cuerpo a cuerpo · a uno · multigolpe](#físico-precisión-80-cuerpo-a-cuerpo-a-uno-multigolpe) (Golpes Furia); [Físico · precisión 85 % · cuerpo a cuerpo · a uno · multigolpe](#físico-precisión-85-cuerpo-a-cuerpo-a-uno-multigolpe) (Ataque Furia); [Físico · precisión 90 % · cuerpo a cuerpo · a uno · agota](#físico-precisión-90-cuerpo-a-cuerpo-a-uno-agota) (Gigaimpacto); [Físico · precisión 90 % · cuerpo a cuerpo · a uno · se baja stats](#físico-precisión-90-cuerpo-a-cuerpo-a-uno-se-baja-stats) (Machada).

## Especial · a distancia · a uno · se sube stats

| Potencia | Fuego |
|---|---|
| 80 | Danza Llama, Canto Ardiente |

Variantes: [Especial · a distancia · a uno](#especial-a-distancia-a-uno) (Pistola Agua, Fuerza Lunar, Ascuas…); [Especial · a distancia · a uno · interrumpe](#especial-a-distancia-a-uno-interrumpe) (Ronquido, Confusión, Hidropulso…); [Especial · a distancia · a uno · drena](#especial-a-distancia-a-uno-drena) (Absorber, Megaagotar, Gigadrenado…); [Especial · no falla · a distancia · a uno](#especial-no-falla-a-distancia-a-uno) (Hoja Mágica, Niebla Clara, Esfera Aural); [Especial · precisión 70 % · a distancia · a uno](#especial-precisión-70-a-distancia-a-uno) (Polución, Trueno); [Especial · precisión 85 % · a distancia · a uno](#especial-precisión-85-a-distancia-a-uno) (Torbellino, Giro Fuego); [Especial · precisión 90 % · a distancia · a uno](#especial-precisión-90-a-distancia-a-uno) (Eructo, Vaho Gélido); [Especial · precisión 95 % · a distancia · a uno](#especial-precisión-95-a-distancia-a-uno) (Disparo Lodo, Pulso Noche); [Especial · a distancia · a uno · burst](#especial-a-distancia-a-uno-burst) (Llama Final); [Especial · a distancia · a uno · carga](#especial-a-distancia-a-uno-carga) (Rayo Solar); [Especial · a distancia · a uno · prioridad](#especial-a-distancia-a-uno-prioridad) (Onda Vacío); [Especial · a distancia · a uno · se sube stats · burst](#especial-a-distancia-a-uno-se-sube-stats-burst) (Poder Pasado).

## Especial · a distancia · en área · burst

| Potencia | Fuego | Agua |
|---|---|---|
| 150 | Estallido | Salpicar |

Variantes: [Especial · a distancia · en área](#especial-a-distancia-en-área) (Ácido, Calcinación, Nieve Polvo…); [Especial · precisión 95 % · a distancia · en área](#especial-precisión-95-a-distancia-en-área) (Viento Hielo, Aire Afilado, Alarido); [Especial · no falla · a distancia · en área](#especial-no-falla-a-distancia-en-área) (Rapidez, Voz Cautivadora); [Especial · a distancia · a uno · burst](#especial-a-distancia-a-uno-burst) (Llama Final); [Especial · a distancia · en área · interrumpe](#especial-a-distancia-en-área-interrumpe) (Ciclón); [Especial · a distancia · en área · lento · burst](#especial-a-distancia-en-área-lento-burst) (Coraza Trampa); [Especial · precisión 70 % · a distancia · en área · burst](#especial-precisión-70-a-distancia-en-área-burst) (Ventisca); [Especial · precisión 85 % · a distancia · en área](#especial-precisión-85-a-distancia-en-área) (Agua Lodosa); [Especial · precisión 90 % · a distancia · en área](#especial-precisión-90-a-distancia-en-área) (Onda Ígnea).

## Especial · cuerpo a cuerpo · a uno

| Potencia | Bicho | Planta |
|---|---|---|
| 20 | Acoso |  |
| 120 |  | Danza Pétalo |

Variantes: [Físico · cuerpo a cuerpo · a uno](#físico-cuerpo-a-cuerpo-a-uno) (Placaje, Triturar, Golpe Cuerpo…); [Especial · a distancia · a uno](#especial-a-distancia-a-uno) (Pistola Agua, Fuerza Lunar, Ascuas…); [Especial · cuerpo a cuerpo · a uno · drena](#especial-cuerpo-a-cuerpo-a-uno-drena) (Beso Drenaje).

## Especial · no falla · a distancia · en área

| Potencia | Hada | Normal |
|---|---|---|
| 40 | Voz Cautivadora |  |
| 60 |  | Rapidez |

Variantes: [Especial · a distancia · en área](#especial-a-distancia-en-área) (Ácido, Calcinación, Nieve Polvo…); [Especial · no falla · a distancia · a uno](#especial-no-falla-a-distancia-a-uno) (Hoja Mágica, Niebla Clara, Esfera Aural); [Especial · precisión 95 % · a distancia · en área](#especial-precisión-95-a-distancia-en-área) (Viento Hielo, Aire Afilado, Alarido); [Especial · a distancia · en área · burst](#especial-a-distancia-en-área-burst) (Estallido, Salpicar); [Especial · a distancia · en área · interrumpe](#especial-a-distancia-en-área-interrumpe) (Ciclón); [Especial · precisión 85 % · a distancia · en área](#especial-precisión-85-a-distancia-en-área) (Agua Lodosa); [Especial · precisión 90 % · a distancia · en área](#especial-precisión-90-a-distancia-en-área) (Onda Ígnea).

## Especial · precisión 50 % · a distancia · a uno · burst

| Potencia | Eléctrico | Fuego |
|---|---|---|
| 100 |  | Infierno |
| 120 | Electrocañón |  |

Variantes: [Especial · a distancia · a uno · burst](#especial-a-distancia-a-uno-burst) (Llama Final); [Especial · a distancia · a uno · se baja stats · burst](#especial-a-distancia-a-uno-se-baja-stats-burst) (Cañón Armadura); [Especial · a distancia · a uno · se sube stats · burst](#especial-a-distancia-a-uno-se-sube-stats-burst) (Poder Pasado); [Especial · precisión 80 % · a distancia · a uno · burst](#especial-precisión-80-a-distancia-a-uno-burst) (Hidrobomba); [Especial · precisión 85 % · a distancia · a uno · burst](#especial-precisión-85-a-distancia-a-uno-burst) (Llamarada).

## Especial · precisión 70 % · a distancia · a uno

| Potencia | Eléctrico | Veneno |
|---|---|---|
| 30 |  | Polución |
| 110 | Trueno |  |

Variantes: [Especial · a distancia · a uno](#especial-a-distancia-a-uno) (Pistola Agua, Fuerza Lunar, Ascuas…); [Especial · a distancia · a uno · interrumpe](#especial-a-distancia-a-uno-interrumpe) (Ronquido, Confusión, Hidropulso…); [Especial · a distancia · a uno · drena](#especial-a-distancia-a-uno-drena) (Absorber, Megaagotar, Gigadrenado…); [Especial · no falla · a distancia · a uno](#especial-no-falla-a-distancia-a-uno) (Hoja Mágica, Niebla Clara, Esfera Aural); [Especial · a distancia · a uno · se sube stats](#especial-a-distancia-a-uno-se-sube-stats) (Danza Llama, Canto Ardiente); [Especial · precisión 85 % · a distancia · a uno](#especial-precisión-85-a-distancia-a-uno) (Torbellino, Giro Fuego); [Especial · precisión 90 % · a distancia · a uno](#especial-precisión-90-a-distancia-a-uno) (Eructo, Vaho Gélido); [Especial · precisión 95 % · a distancia · a uno](#especial-precisión-95-a-distancia-a-uno) (Disparo Lodo, Pulso Noche); [Especial · a distancia · a uno · burst](#especial-a-distancia-a-uno-burst) (Llama Final); [Especial · a distancia · a uno · carga](#especial-a-distancia-a-uno-carga) (Rayo Solar); [Especial · a distancia · a uno · prioridad](#especial-a-distancia-a-uno-prioridad) (Onda Vacío); [Especial · precisión 70 % · a distancia · a uno · interrumpe](#especial-precisión-70-a-distancia-a-uno-interrumpe) (Vendaval).

## Especial · precisión 85 % · a distancia · a uno

| Potencia | Fuego | Agua |
|---|---|---|
| 35 | Giro Fuego | Torbellino |

Variantes: [Especial · a distancia · a uno](#especial-a-distancia-a-uno) (Pistola Agua, Fuerza Lunar, Ascuas…); [Especial · a distancia · a uno · interrumpe](#especial-a-distancia-a-uno-interrumpe) (Ronquido, Confusión, Hidropulso…); [Especial · a distancia · a uno · drena](#especial-a-distancia-a-uno-drena) (Absorber, Megaagotar, Gigadrenado…); [Especial · no falla · a distancia · a uno](#especial-no-falla-a-distancia-a-uno) (Hoja Mágica, Niebla Clara, Esfera Aural); [Especial · a distancia · a uno · se sube stats](#especial-a-distancia-a-uno-se-sube-stats) (Danza Llama, Canto Ardiente); [Especial · precisión 70 % · a distancia · a uno](#especial-precisión-70-a-distancia-a-uno) (Polución, Trueno); [Especial · precisión 90 % · a distancia · a uno](#especial-precisión-90-a-distancia-a-uno) (Eructo, Vaho Gélido); [Especial · precisión 95 % · a distancia · a uno](#especial-precisión-95-a-distancia-a-uno) (Disparo Lodo, Pulso Noche); [Especial · a distancia · a uno · burst](#especial-a-distancia-a-uno-burst) (Llama Final); [Especial · a distancia · a uno · carga](#especial-a-distancia-a-uno-carga) (Rayo Solar); [Especial · a distancia · a uno · prioridad](#especial-a-distancia-a-uno-prioridad) (Onda Vacío); [Especial · precisión 85 % · a distancia · a uno · burst](#especial-precisión-85-a-distancia-a-uno-burst) (Llamarada); [Especial · precisión 85 % · a distancia · en área](#especial-precisión-85-a-distancia-en-área) (Agua Lodosa); [Físico · precisión 85 % · a distancia · a uno](#físico-precisión-85-a-distancia-a-uno) (Bucle Arena).

## Especial · precisión 90 % · a distancia · a uno

| Potencia | Hielo | Veneno |
|---|---|---|
| 60 | Vaho Gélido |  |
| 120 |  | Eructo |

Variantes: [Especial · a distancia · a uno](#especial-a-distancia-a-uno) (Pistola Agua, Fuerza Lunar, Ascuas…); [Especial · a distancia · a uno · interrumpe](#especial-a-distancia-a-uno-interrumpe) (Ronquido, Confusión, Hidropulso…); [Especial · a distancia · a uno · drena](#especial-a-distancia-a-uno-drena) (Absorber, Megaagotar, Gigadrenado…); [Especial · no falla · a distancia · a uno](#especial-no-falla-a-distancia-a-uno) (Hoja Mágica, Niebla Clara, Esfera Aural); [Especial · a distancia · a uno · se sube stats](#especial-a-distancia-a-uno-se-sube-stats) (Danza Llama, Canto Ardiente); [Especial · precisión 70 % · a distancia · a uno](#especial-precisión-70-a-distancia-a-uno) (Polución, Trueno); [Especial · precisión 85 % · a distancia · a uno](#especial-precisión-85-a-distancia-a-uno) (Torbellino, Giro Fuego); [Especial · precisión 95 % · a distancia · a uno](#especial-precisión-95-a-distancia-a-uno) (Disparo Lodo, Pulso Noche); [Especial · a distancia · a uno · burst](#especial-a-distancia-a-uno-burst) (Llama Final); [Especial · a distancia · a uno · carga](#especial-a-distancia-a-uno-carga) (Rayo Solar); [Especial · a distancia · a uno · prioridad](#especial-a-distancia-a-uno-prioridad) (Onda Vacío); [Especial · precisión 90 % · a distancia · a uno · agota](#especial-precisión-90-a-distancia-a-uno-agota) (Hiperrayo); [Especial · precisión 90 % · a distancia · en área](#especial-precisión-90-a-distancia-en-área) (Onda Ígnea); [Físico · precisión 90 % · a distancia · a uno](#físico-precisión-90-a-distancia-a-uno) (Lanzarrocas).

## Especial · precisión 90 % · a distancia · a uno · se baja stats · burst

| Potencia | Fuego | Planta |
|---|---|---|
| 130 | Sofoco | Lluevehojas |

Variantes: [Especial · a distancia · a uno · se baja stats · burst](#especial-a-distancia-a-uno-se-baja-stats-burst) (Cañón Armadura).

## Especial · precisión 95 % · a distancia · a uno

| Potencia | Siniestro | Tierra |
|---|---|---|
| 55 |  | Disparo Lodo |
| 85 | Pulso Noche |  |

Variantes: [Especial · a distancia · a uno](#especial-a-distancia-a-uno) (Pistola Agua, Fuerza Lunar, Ascuas…); [Especial · a distancia · a uno · interrumpe](#especial-a-distancia-a-uno-interrumpe) (Ronquido, Confusión, Hidropulso…); [Especial · a distancia · a uno · drena](#especial-a-distancia-a-uno-drena) (Absorber, Megaagotar, Gigadrenado…); [Especial · no falla · a distancia · a uno](#especial-no-falla-a-distancia-a-uno) (Hoja Mágica, Niebla Clara, Esfera Aural); [Especial · precisión 95 % · a distancia · en área](#especial-precisión-95-a-distancia-en-área) (Viento Hielo, Aire Afilado, Alarido); [Especial · a distancia · a uno · se sube stats](#especial-a-distancia-a-uno-se-sube-stats) (Danza Llama, Canto Ardiente); [Especial · precisión 70 % · a distancia · a uno](#especial-precisión-70-a-distancia-a-uno) (Polución, Trueno); [Especial · precisión 85 % · a distancia · a uno](#especial-precisión-85-a-distancia-a-uno) (Torbellino, Giro Fuego); [Especial · precisión 90 % · a distancia · a uno](#especial-precisión-90-a-distancia-a-uno) (Eructo, Vaho Gélido); [Especial · a distancia · a uno · burst](#especial-a-distancia-a-uno-burst) (Llama Final); [Especial · a distancia · a uno · carga](#especial-a-distancia-a-uno-carga) (Rayo Solar); [Especial · a distancia · a uno · prioridad](#especial-a-distancia-a-uno-prioridad) (Onda Vacío); [Especial · precisión 95 % · a distancia · a uno · interrumpe](#especial-precisión-95-a-distancia-a-uno-interrumpe) (Tajo Aéreo); [Físico · precisión 95 % · a distancia · a uno](#físico-precisión-95-a-distancia-a-uno) (Tumba Rocas).

## Físico · a distancia · a uno · prioridad

| Potencia | Hielo | Normal |
|---|---|---|
| 30 |  | Amago |
| 40 | Esquirla Helada |  |

Variantes: [Físico · a distancia · a uno](#físico-a-distancia-a-uno) (Bomba Germen, Antiaéreo, Psicocorte…); [Físico · cuerpo a cuerpo · a uno · prioridad](#físico-cuerpo-a-cuerpo-a-uno-prioridad) (Acua Jet, Ataque Rápido, Sombra Vil…); [Físico · a distancia · a uno · multigolpe](#físico-a-distancia-a-uno-multigolpe) (Semilladora, Carámbano, Dracoflechas); [Especial · a distancia · a uno · prioridad](#especial-a-distancia-a-uno-prioridad) (Onda Vacío); [Físico · a distancia · a uno · interrumpe](#físico-a-distancia-a-uno-interrumpe) (Puntada Sombría); [Físico · no falla · a distancia · a uno](#físico-no-falla-a-distancia-a-uno) (Truco Floral); [Físico · precisión 85 % · a distancia · a uno](#físico-precisión-85-a-distancia-a-uno) (Bucle Arena); [Físico · precisión 90 % · a distancia · a uno](#físico-precisión-90-a-distancia-a-uno) (Lanzarrocas); [Físico · precisión 95 % · a distancia · a uno](#físico-precisión-95-a-distancia-a-uno) (Tumba Rocas).

## Físico · a distancia · alrededor · burst

| Potencia | Normal |
|---|---|
| 200 | **Autodestrucción** |
| 250 | **Explosión** |

Líneas (en negrita): Explosiones (Autodestrucción 200 → Explosión 250).

Variantes: [Físico · a distancia · alrededor](#físico-a-distancia-alrededor) (Tormenta Floral, Terremoto, Terratemblor).

## Físico · cuerpo a cuerpo · a uno · multigolpe

| Potencia | Lucha |
|---|---|
| 15 | **Empujón** |
| 30 | **Doble Patada** |

Líneas (en negrita): Golpes múltiples (Empujón 15 → Doble Patada 30).

Variantes: [Físico · cuerpo a cuerpo · a uno](#físico-cuerpo-a-cuerpo-a-uno) (Placaje, Triturar, Golpe Cuerpo…); [Físico · precisión 95 % · cuerpo a cuerpo · a uno](#físico-precisión-95-cuerpo-a-cuerpo-a-uno) (Fuerza Equina, Colmillo Ígneo, Colmillo Hielo…); [Físico · cuerpo a cuerpo · a uno · interrumpe](#físico-cuerpo-a-cuerpo-a-uno-interrumpe) (Golpe Cabeza, Pisotón, Mordisco…); [Físico · precisión 90 % · cuerpo a cuerpo · a uno](#físico-precisión-90-cuerpo-a-cuerpo-a-uno) (Rodar, Carantoña, Patada Salto Alta…); [Físico · cuerpo a cuerpo · a uno · prioridad](#físico-cuerpo-a-cuerpo-a-uno-prioridad) (Acua Jet, Ataque Rápido, Sombra Vil…); [Físico · cuerpo a cuerpo · a uno · se daña](#físico-cuerpo-a-cuerpo-a-uno-se-daña) (Doble Filo, Envite Ígneo, Pájaro Osado…); [Físico · a distancia · a uno · multigolpe](#físico-a-distancia-a-uno-multigolpe) (Semilladora, Carámbano, Dracoflechas); [Físico · cuerpo a cuerpo · a uno · burst](#físico-cuerpo-a-cuerpo-a-uno-burst) (Última Baza, Represalia, Asalto Espadón); [Físico · cuerpo a cuerpo · a uno · carga](#físico-cuerpo-a-cuerpo-a-uno-carga) (Buceo, Excavar, Golpe Fantasma); [Físico · cuerpo a cuerpo · a uno · drena](#físico-cuerpo-a-cuerpo-a-uno-drena) (Chupavidas, Puño Drenaje, Asta Drenaje); [Físico · cuerpo a cuerpo · a uno · lento](#físico-cuerpo-a-cuerpo-a-uno-lento) (Alud, Desquite, Puño Certero); [Físico · cuerpo a cuerpo · a uno · se sube stats](#físico-cuerpo-a-cuerpo-a-uno-se-sube-stats) (Giro Rápido, Nitrocarga, Danza Acuática); [Físico · no falla · cuerpo a cuerpo · a uno](#físico-no-falla-cuerpo-a-cuerpo-a-uno) (Puño Sombra, Golpe Aéreo, Cuerno Certero); [Físico · precisión 85 % · cuerpo a cuerpo · a uno](#físico-precisión-85-cuerpo-a-cuerpo-a-uno) (Latigazo, Megacuerno, Atadura); [Físico · precisión 90 % · cuerpo a cuerpo · a uno · multigolpe](#físico-precisión-90-cuerpo-a-cuerpo-a-uno-multigolpe) (Doble Golpe, Golpe Bis, Ala Bis); [Físico · precisión 75 % · cuerpo a cuerpo · a uno](#físico-precisión-75-cuerpo-a-cuerpo-a-uno) (Atizar, Cola Férrea); [Físico · cuerpo a cuerpo · a uno · vuelve](#físico-cuerpo-a-cuerpo-a-uno-vuelve) (Ida y Vuelta); [Físico · precisión 80 % · cuerpo a cuerpo · a uno · multigolpe](#físico-precisión-80-cuerpo-a-cuerpo-a-uno-multigolpe) (Golpes Furia); [Físico · precisión 85 % · cuerpo a cuerpo · a uno · multigolpe](#físico-precisión-85-cuerpo-a-cuerpo-a-uno-multigolpe) (Ataque Furia).

## Físico · cuerpo a cuerpo · a uno · prioridad · burst

| Potencia | Siniestro | Normal |
|---|---|---|
| 70 | Golpe Bajo |  |
| 80 |  | Velocidad Extrema |

Variantes: [Físico · cuerpo a cuerpo · a uno · prioridad](#físico-cuerpo-a-cuerpo-a-uno-prioridad) (Acua Jet, Ataque Rápido, Sombra Vil…); [Físico · cuerpo a cuerpo · a uno · burst](#físico-cuerpo-a-cuerpo-a-uno-burst) (Última Baza, Represalia, Asalto Espadón); [Físico · cuerpo a cuerpo · a uno · se baja stats · burst](#físico-cuerpo-a-cuerpo-a-uno-se-baja-stats-burst) (Fuerza Bruta, A Bocajarro, Arremetida); [Físico · cuerpo a cuerpo · a uno · prioridad · interrumpe](#físico-cuerpo-a-cuerpo-a-uno-prioridad-interrumpe) (Sorpresa); [Físico · precisión 75 % · cuerpo a cuerpo · a uno · burst](#físico-precisión-75-cuerpo-a-cuerpo-a-uno-burst) (Megapatada); [Físico · precisión 80 % · cuerpo a cuerpo · a uno · burst](#físico-precisión-80-cuerpo-a-cuerpo-a-uno-burst) (Tajo Cruzado).

## Físico · precisión 75 % · cuerpo a cuerpo · a uno

| Potencia | Normal | Acero |
|---|---|---|
| 80 | Atizar |  |
| 100 |  | Cola Férrea |

Variantes: [Físico · cuerpo a cuerpo · a uno](#físico-cuerpo-a-cuerpo-a-uno) (Placaje, Triturar, Golpe Cuerpo…); [Físico · precisión 95 % · cuerpo a cuerpo · a uno](#físico-precisión-95-cuerpo-a-cuerpo-a-uno) (Fuerza Equina, Colmillo Ígneo, Colmillo Hielo…); [Físico · cuerpo a cuerpo · a uno · interrumpe](#físico-cuerpo-a-cuerpo-a-uno-interrumpe) (Golpe Cabeza, Pisotón, Mordisco…); [Físico · precisión 90 % · cuerpo a cuerpo · a uno](#físico-precisión-90-cuerpo-a-cuerpo-a-uno) (Rodar, Carantoña, Patada Salto Alta…); [Físico · cuerpo a cuerpo · a uno · prioridad](#físico-cuerpo-a-cuerpo-a-uno-prioridad) (Acua Jet, Ataque Rápido, Sombra Vil…); [Físico · cuerpo a cuerpo · a uno · se daña](#físico-cuerpo-a-cuerpo-a-uno-se-daña) (Doble Filo, Envite Ígneo, Pájaro Osado…); [Físico · cuerpo a cuerpo · a uno · burst](#físico-cuerpo-a-cuerpo-a-uno-burst) (Última Baza, Represalia, Asalto Espadón); [Físico · cuerpo a cuerpo · a uno · carga](#físico-cuerpo-a-cuerpo-a-uno-carga) (Buceo, Excavar, Golpe Fantasma); [Físico · cuerpo a cuerpo · a uno · drena](#físico-cuerpo-a-cuerpo-a-uno-drena) (Chupavidas, Puño Drenaje, Asta Drenaje); [Físico · cuerpo a cuerpo · a uno · lento](#físico-cuerpo-a-cuerpo-a-uno-lento) (Alud, Desquite, Puño Certero); [Físico · cuerpo a cuerpo · a uno · se sube stats](#físico-cuerpo-a-cuerpo-a-uno-se-sube-stats) (Giro Rápido, Nitrocarga, Danza Acuática); [Físico · no falla · cuerpo a cuerpo · a uno](#físico-no-falla-cuerpo-a-cuerpo-a-uno) (Puño Sombra, Golpe Aéreo, Cuerno Certero); [Físico · precisión 85 % · cuerpo a cuerpo · a uno](#físico-precisión-85-cuerpo-a-cuerpo-a-uno) (Latigazo, Megacuerno, Atadura); [Físico · cuerpo a cuerpo · a uno · multigolpe](#físico-cuerpo-a-cuerpo-a-uno-multigolpe) (Doble Patada, Empujón); [Físico · cuerpo a cuerpo · a uno · vuelve](#físico-cuerpo-a-cuerpo-a-uno-vuelve) (Ida y Vuelta); [Físico · precisión 75 % · cuerpo a cuerpo · a uno · burst](#físico-precisión-75-cuerpo-a-cuerpo-a-uno-burst) (Megapatada); [Físico · precisión 75 % · cuerpo a cuerpo · a uno · interrumpe](#físico-precisión-75-cuerpo-a-cuerpo-a-uno-interrumpe) (Carga Dragón).

## Físico · precisión 80 % · a distancia · a uno · burst

| Potencia | Veneno | Roca |
|---|---|---|
| 100 |  | Roca Afilada |
| 120 | Lanzamugre |  |

Variantes: [Especial · precisión 80 % · a distancia · a uno · burst](#especial-precisión-80-a-distancia-a-uno-burst) (Hidrobomba); [Físico · precisión 80 % · cuerpo a cuerpo · a uno · burst](#físico-precisión-80-cuerpo-a-cuerpo-a-uno-burst) (Tajo Cruzado); [Físico · precisión 90 % · a distancia · a uno · burst](#físico-precisión-90-a-distancia-a-uno-burst) (Balón Ígneo).

## Físico · precisión 90 % · a distancia · a uno · multigolpe

| Potencia | Tierra | Roca |
|---|---|---|
| 25 | Ataque Óseo | Pedrada |

Variantes: [Físico · a distancia · a uno · multigolpe](#físico-a-distancia-a-uno-multigolpe) (Semilladora, Carámbano, Dracoflechas); [Físico · precisión 90 % · cuerpo a cuerpo · a uno · multigolpe](#físico-precisión-90-cuerpo-a-cuerpo-a-uno-multigolpe) (Doble Golpe, Golpe Bis, Ala Bis); [Físico · precisión 90 % · a distancia · a uno](#físico-precisión-90-a-distancia-a-uno) (Lanzarrocas); [Físico · precisión 90 % · a distancia · a uno · agota](#físico-precisión-90-a-distancia-a-uno-agota) (Romperrocas); [Físico · precisión 90 % · a distancia · a uno · burst](#físico-precisión-90-a-distancia-a-uno-burst) (Balón Ígneo); [Físico · precisión 90 % · a distancia · a uno · interrumpe](#físico-precisión-90-a-distancia-a-uno-interrumpe) (Chuzos); [Físico · precisión 95 % · a distancia · a uno · multigolpe](#físico-precisión-95-a-distancia-a-uno-multigolpe) (Pin Misil).

## Físico · precisión 90 % · cuerpo a cuerpo · a uno · lento

| Potencia | Dragón | Lucha |
|---|---|---|
| 60 | Cola Dragón | Llave Giro |

Variantes: [Físico · precisión 90 % · cuerpo a cuerpo · a uno](#físico-precisión-90-cuerpo-a-cuerpo-a-uno) (Rodar, Carantoña, Patada Salto Alta…); [Físico · cuerpo a cuerpo · a uno · lento](#físico-cuerpo-a-cuerpo-a-uno-lento) (Alud, Desquite, Puño Certero); [Físico · precisión 90 % · cuerpo a cuerpo · a uno · interrumpe](#físico-precisión-90-cuerpo-a-cuerpo-a-uno-interrumpe) (Hipercolmillo, Cabezazo Zen, Patada Hacha); [Físico · precisión 90 % · cuerpo a cuerpo · a uno · multigolpe](#físico-precisión-90-cuerpo-a-cuerpo-a-uno-multigolpe) (Doble Golpe, Golpe Bis, Ala Bis); [Físico · precisión 90 % · cuerpo a cuerpo · a uno · se sube stats](#físico-precisión-90-cuerpo-a-cuerpo-a-uno-se-sube-stats) (Ala de Acero, Puño Meteoro); [Físico · no falla · cuerpo a cuerpo · a uno · lento](#físico-no-falla-cuerpo-a-cuerpo-a-uno-lento) (Tiro Vital); [Físico · precisión 90 % · cuerpo a cuerpo · a uno · agota](#físico-precisión-90-cuerpo-a-cuerpo-a-uno-agota) (Gigaimpacto); [Físico · precisión 90 % · cuerpo a cuerpo · a uno · se baja stats](#físico-precisión-90-cuerpo-a-cuerpo-a-uno-se-baja-stats) (Machada).

## Físico · precisión 90 % · cuerpo a cuerpo · a uno · se sube stats

| Potencia | Acero |
|---|---|
| 70 | **Ala de Acero** |
| 90 | **Puño Meteoro** |

Líneas (en negrita): Aceros (Ala de Acero 70 → Puño Meteoro 90).

Variantes: [Físico · precisión 90 % · cuerpo a cuerpo · a uno](#físico-precisión-90-cuerpo-a-cuerpo-a-uno) (Rodar, Carantoña, Patada Salto Alta…); [Físico · cuerpo a cuerpo · a uno · se sube stats](#físico-cuerpo-a-cuerpo-a-uno-se-sube-stats) (Giro Rápido, Nitrocarga, Danza Acuática); [Físico · precisión 90 % · cuerpo a cuerpo · a uno · interrumpe](#físico-precisión-90-cuerpo-a-cuerpo-a-uno-interrumpe) (Hipercolmillo, Cabezazo Zen, Patada Hacha); [Físico · precisión 90 % · cuerpo a cuerpo · a uno · multigolpe](#físico-precisión-90-cuerpo-a-cuerpo-a-uno-multigolpe) (Doble Golpe, Golpe Bis, Ala Bis); [Físico · precisión 90 % · cuerpo a cuerpo · a uno · lento](#físico-precisión-90-cuerpo-a-cuerpo-a-uno-lento) (Cola Dragón, Llave Giro); [Físico · precisión 90 % · cuerpo a cuerpo · a uno · agota](#físico-precisión-90-cuerpo-a-cuerpo-a-uno-agota) (Gigaimpacto); [Físico · precisión 90 % · cuerpo a cuerpo · a uno · se baja stats](#físico-precisión-90-cuerpo-a-cuerpo-a-uno-se-baja-stats) (Machada); [Físico · precisión 95 % · cuerpo a cuerpo · a uno · se sube stats](#físico-precisión-95-cuerpo-a-cuerpo-a-uno-se-sube-stats) (Garra Metal).

## Únicos (un solo movimiento)

| Tipo de ataque | Movimiento |
|---|---|
| Especial · a distancia · a uno · burst | Llama Final (Fuego, 130) |
| Especial · a distancia · a uno · carga | Rayo Solar (Planta, 120) |
| Especial · a distancia · a uno · multigolpe · prioridad | Shuriken de Agua (Agua, 15) |
| Especial · a distancia · a uno · prioridad | Onda Vacío (Lucha, 40) |
| Especial · a distancia · a uno · se baja stats · burst | Cañón Armadura (Fuego, 120) |
| Especial · a distancia · a uno · se sube stats · burst | Poder Pasado (Roca, 60) |
| Especial · a distancia · alrededor · interrumpe | Aria Burbuja (Agua, 90) |
| Especial · a distancia · en área · interrumpe | Ciclón (Dragón, 40) |
| Especial · a distancia · en área · lento · burst | Coraza Trampa (Fuego, 150) |
| Especial · cuerpo a cuerpo · a uno · drena | Beso Drenaje (Hada, 50) |
| Especial · precisión 70 % · a distancia · a uno · interrumpe | Vendaval (Volador, 110) |
| Especial · precisión 70 % · a distancia · en área · burst | Ventisca (Hielo, 110) |
| Especial · precisión 80 % · a distancia · a uno · burst | Hidrobomba (Agua, 110) |
| Especial · precisión 85 % · a distancia · a uno · burst | Llamarada (Fuego, 110) |
| Especial · precisión 85 % · a distancia · en área | Agua Lodosa (Agua, 90) |
| Especial · precisión 90 % · a distancia · a uno · agota | Hiperrayo (Normal, 150) |
| Especial · precisión 90 % · a distancia · en área | Onda Ígnea (Fuego, 95) |
| Especial · precisión 95 % · a distancia · a uno · interrumpe | Tajo Aéreo (Volador, 75) |
| Físico · a distancia · a uno · interrumpe | Puntada Sombría (Fantasma, 80) |
| Físico · cuerpo a cuerpo · a uno · prioridad · interrumpe | Sorpresa (Normal, 40) |
| Físico · cuerpo a cuerpo · a uno · vuelve | Ida y Vuelta (Bicho, 70) |
| Físico · cuerpo a cuerpo · alrededor | Giro Vil (Siniestro, 60) |
| Físico · cuerpo a cuerpo · en área | Vasto Impacto (Dragón, 60) |
| Físico · no falla · a distancia · a uno | Truco Floral (Planta, 70) |
| Físico · no falla · cuerpo a cuerpo · a uno · lento | Tiro Vital (Lucha, 70) |
| Físico · precisión 50 % · cuerpo a cuerpo · a uno · interrumpe · burst | Puño Dinámico (Lucha, 100) |
| Físico · precisión 75 % · cuerpo a cuerpo · a uno · burst | Megapatada (Normal, 120) |
| Físico · precisión 75 % · cuerpo a cuerpo · a uno · interrumpe | Carga Dragón (Dragón, 100) |
| Físico · precisión 80 % · cuerpo a cuerpo · a uno · burst | Tajo Cruzado (Lucha, 100) |
| Físico · precisión 80 % · cuerpo a cuerpo · a uno · multigolpe | Golpes Furia (Normal, 18) |
| Físico · precisión 80 % · cuerpo a cuerpo · a uno · se daña | Sumisión (Lucha, 80) |
| Físico · precisión 80 % · cuerpo a cuerpo · a uno · se daña · burst | Testarazo (Roca, 150) |
| Físico · precisión 85 % · a distancia · a uno | Bucle Arena (Tierra, 35) |
| Físico · precisión 85 % · cuerpo a cuerpo · a uno · carga · burst | Bote (Volador, 85) |
| Físico · precisión 85 % · cuerpo a cuerpo · a uno · multigolpe | Ataque Furia (Normal, 15) |
| Físico · precisión 85 % · cuerpo a cuerpo · a uno · se daña | Derribo (Normal, 90) |
| Físico · precisión 90 % · a distancia · a uno | Lanzarrocas (Roca, 50) |
| Físico · precisión 90 % · a distancia · a uno · agota | Romperrocas (Roca, 150) |
| Físico · precisión 90 % · a distancia · a uno · burst | Balón Ígneo (Fuego, 120) |
| Físico · precisión 90 % · a distancia · a uno · carga · interrumpe · burst | Ataque Aéreo (Volador, 140) |
| Físico · precisión 90 % · a distancia · a uno · interrumpe | Chuzos (Hielo, 85) |
| Físico · precisión 90 % · a distancia · en área · interrumpe | Avalancha (Roca, 75) |
| Físico · precisión 90 % · cuerpo a cuerpo · a uno · agota | Gigaimpacto (Normal, 150) |
| Físico · precisión 90 % · cuerpo a cuerpo · a uno · se baja stats | Machada (Lucha, 100) |
| Físico · precisión 95 % · a distancia · a uno | Tumba Rocas (Roca, 60) |
| Físico · precisión 95 % · a distancia · a uno · multigolpe | Pin Misil (Bicho, 25) |
| Físico · precisión 95 % · a distancia · en área | Hoja Afilada (Planta, 55) |
| Físico · precisión 95 % · cuerpo a cuerpo · a uno · carga | Vuelo (Volador, 90) |
| Físico · precisión 95 % · cuerpo a cuerpo · a uno · se sube stats | Garra Metal (Acero, 50) |
