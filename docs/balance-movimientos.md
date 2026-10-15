# Balance de movimientos (generado)

> `node tools/balance_movimientos.mjs`. Modelo en docs/GDD-combate.md §3.2. No editar a mano.

389 movimientos que se aprenden por nivel.

- Lanzamiento: {"instant":296,"cast":83,"canal":6,"desaparece":4}
- Forma: {"alrededor":13,"objetivo":272,"zona":19,"cono":5,"propio":64,"global":13,"trampa":3}
- Potencia/s de rotación (relleno + este movimiento cada vez que vuelve), **ahora**: mín 36.4 · mediana 45.4 · máx 59.1
- **Propuesta**: mín 36.4 · mediana 42.4 · máx 50

| Movimiento | Tipo | Cat | Pot | Pot ef | CD ahora | Lanza | Tiempo | CD nuevo | Forma | Pot/s ahora | Pot/s nueva | Extra |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Explosión | Normal | Fís | 250 | 250 | 14.2 | instant |  | 35 | alrededor | 51.2 | 42.4 |  |
| Autodestrucción | Normal | Fís | 200 | 200 | 11.1 | instant |  | 26.7 | alrededor | 50.8 | 42.4 |  |
| Gigaimpacto | Normal | Fís | 150 | 135 | 10.5 | instant |  | 3.7 | objetivo | 45.4 | 42.4 | agotado 2 s |
| Estallido | Fire | Esp | 150 | 150 | 8 | cast | 3 | 2.3 | zona | 50.1 | 50 |  |
| Hiperrayo | Normal | Esp | 150 | 135 | 10.5 | instant |  | 3.7 | objetivo | 45.4 | 42.4 | agotado 2 s |
| Salpicar | Water | Esp | 150 | 150 | 8 | cast | 3 | 2.3 | zona | 50.1 | 50 |  |
| Puño Certero | Fighting | Fís | 150 | 150 | 8 | instant |  | 18.3 | objetivo | 50.1 | 42.4 |  |
| Romperrocas | Rock | Fís | 150 | 135 | 10.5 | instant |  | 3.7 | objetivo | 45.4 | 42.4 | agotado 2 s |
| Testarazo | Rock | Fís | 150 | 102 | 8 | instant |  | 10.3 | objetivo | 44.1 | 42.4 |  |
| Última Baza | Normal | Fís | 140 | 140 | 7.4 | instant |  | 16.7 | objetivo | 49.9 | 42.4 |  |
| Ataque Aéreo | Flying | Fís | 140 | 134 | 9.9 | cast | 2.9 | 1.1 | objetivo | 45.8 | 46.1 | interrumpe |
| Lluevehojas | Grass | Esp | 130 | 117 | 6.7 | cast | 2.6 | 1.1 | objetivo | 47.9 | 45 |  |
| Patada Salto Alta | Fighting | Fís | 130 | 117 | 6.7 | instant |  | 12.8 | objetivo | 47.9 | 42.4 |  |
| Sofoco | Fire | Esp | 130 | 117 | 6.7 | cast | 2.6 | 1.1 | objetivo | 47.9 | 45 |  |
| Fuerza Bruta | Fighting | Fís | 120 | 120 | 6.1 | instant |  | 13.3 | objetivo | 49.5 | 42.4 |  |
| Doble Filo | Normal | Fís | 120 | 102 | 6.1 | instant |  | 10.3 | objetivo | 46.5 | 42.4 |  |
| Eructo | Poison | Esp | 120 | 108 | 6.1 | cast | 2.4 | 1.1 | objetivo | 47.5 | 45 |  |
| Latigazo | Grass | Fís | 120 | 102 | 6.1 | instant |  | 10.3 | objetivo | 46.5 | 42.4 |  |
| Rayo Solar | Grass | Esp | 120 | 120 | 8.6 | cast | 2.6 | 1.1 | objetivo | 45.7 | 46.2 |  |
| Danza Pétalo | Grass | Esp | 120 | 120 | 6.1 | instant |  | 13.3 | objetivo | 49.5 | 42.4 |  |
| Envite Ígneo | Fire | Fís | 120 | 105 | 6.1 | instant |  | 10.8 | objetivo | 46.9 | 42.3 |  |
| Saña | Normal | Fís | 120 | 120 | 6.1 | instant |  | 13.3 | objetivo | 49.5 | 42.4 |  |
| Electrocañón | Electric | Esp | 120 | 85 | 6.1 | cast | 1.9 | 1.1 | objetivo | 43.7 | 44.7 |  |
| A Bocajarro | Fighting | Fís | 120 | 120 | 6.1 | instant |  | 13.3 | objetivo | 49.5 | 42.4 |  |
| Arremetida | Ground | Fís | 120 | 120 | 6.1 | instant |  | 13.3 | objetivo | 49.5 | 42.4 |  |
| Lanzamugre | Poison | Fís | 120 | 104 | 6.1 | cast | 2.3 | 1.1 | objetivo | 46.8 | 45 |  |
| Megapatada | Normal | Fís | 120 | 90 | 6.1 | instant |  | 8.3 | objetivo | 44.6 | 42.4 |  |
| Megacuerno | Bug | Fís | 120 | 102 | 6.1 | instant |  | 10.3 | objetivo | 46.5 | 42.4 |  |
| Pájaro Osado | Flying | Fís | 120 | 102 | 6.1 | instant |  | 10.3 | objetivo | 46.5 | 42.4 |  |
| Premonición | Psychic | Esp | 120 | 120 | 6.1 | cast | 2.6 | 1.1 | objetivo | 49.5 | 46.2 |  |
| Mazazo | Grass | Fís | 120 | 102 | 6.1 | instant |  | 10.3 | objetivo | 46.5 | 42.4 |  |
| Enfado | Dragon | Fís | 120 | 120 | 6.1 | instant |  | 13.3 | objetivo | 49.5 | 42.4 |  |
| Hidrobomba | Water | Esp | 110 | 88 | 5.5 | cast | 1.9 | 1.1 | objetivo | 45.1 | 46.3 |  |
| Vendaval | Flying | Esp | 110 | 77 | 5.5 | instant |  | 6.2 | objetivo | 43.1 | 42.3 | interrumpe |
| Trueno | Electric | Esp | 110 | 85 | 5.5 | cast | 1.9 | 1.1 | objetivo | 44.5 | 44.5 |  |
| Ventisca | Ice | Esp | 110 | 80 | 5.5 | cast | 1.7 | 1.1 | cono | 43.5 | 46.8 |  |
| Machada | Fighting | Fís | 100 | 90 | 4.9 | instant |  | 8.3 | objetivo | 46.6 | 42.4 |  |
| Infierno | Fire | Esp | 100 | 75 | 4.9 | cast | 1.7 | 1.1 | objetivo | 43.5 | 44.1 |  |
| Cola Férrea | Steel | Fís | 100 | 83 | 4.9 | instant |  | 7.1 | objetivo | 45 | 42.3 |  |
| Terremoto | Ground | Fís | 100 | 100 | 4.9 | instant |  | 10 | alrededor | 48.6 | 42.4 |  |
| Puño Dinámico | Fighting | Fís | 100 | 50 | 4.9 | instant |  | 1.7 | objetivo | 38.4 | 42.2 | interrumpe |
| Tajo Cruzado | Fighting | Fís | 100 | 85 | 4.9 | instant |  | 7.5 | objetivo | 45.5 | 42.3 |  |
| Roca Afilada | Rock | Fís | 100 | 85 | 4.9 | cast | 1.9 | 1.1 | objetivo | 45.5 | 44.6 |  |
| Comesueños | Psychic | Esp | 100 | 115 | 4.9 | canal | 2.5 | 1.1 | objetivo | 51.7 | 46 |  |
| Carga Dragón | Dragon | Fís | 100 | 75 | 4.9 | instant |  | 5.8 | objetivo | 43.5 | 42.4 | interrumpe |
| Fuerza Equina | Ground | Fís | 95 | 90 | 4.5 | instant |  | 8.4 | objetivo | 47.5 | 42.3 |  |
| Fuerza Lunar | Fairy | Esp | 95 | 103 | 4.5 | cast | 2.3 | 1.1 | objetivo | 50.3 | 44.6 |  |
| Onda Ígnea | Fire | Esp | 95 | 88 | 4.5 | cast | 1.9 | 1.1 | cono | 47 | 46.3 |  |
| Onda Tóxica | Poison | Esp | 95 | 98 | 4.5 | instant |  | 9.6 | alrededor | 49.1 | 42.4 |  |
| Juego Sucio | Dark | Fís | 95 | 95 | 4.5 | instant |  | 9.2 | objetivo | 48.6 | 42.3 |  |
| Derribo | Normal | Fís | 90 | 65 | 4.2 | instant |  | 4.2 | objetivo | 42.3 | 42.3 |  |
| Carantoña | Fairy | Fís | 90 | 84 | 4.2 | instant |  | 7.3 | objetivo | 46.7 | 42.3 |  |
| Tormenta Floral | Grass | Fís | 90 | 90 | 4.2 | instant |  | 8.3 | alrededor | 48.3 | 42.4 |  |
| Lanzallamas | Fire | Esp | 90 | 93 | 4.2 | cast | 2 | 1.1 | objetivo | 48.9 | 46.3 |  |
| Tierra Viva | Ground | Esp | 90 | 93 | 4.2 | cast | 2 | 1.1 | objetivo | 48.9 | 46.3 |  |
| Acua Cola | Water | Fís | 90 | 81 | 4.2 | instant |  | 6.8 | objetivo | 46.1 | 42.4 |  |
| Rayo Hielo | Ice | Esp | 90 | 93 | 4.2 | cast | 2 | 1.1 | objetivo | 48.9 | 46.3 |  |
| Rayo | Electric | Esp | 90 | 93 | 4.2 | cast | 2 | 1.1 | objetivo | 48.9 | 46.3 |  |
| Alboroto | Normal | Esp | 90 | 90 | 4.2 | instant |  | 8.3 | alrededor | 48.3 | 42.4 |  |
| Bomba Lodo | Poison | Esp | 90 | 98 | 4.2 | cast | 2.1 | 1.1 | objetivo | 50.1 | 46.4 |  |
| Psíquico | Psychic | Esp | 90 | 93 | 4.2 | cast | 2 | 1.1 | objetivo | 48.9 | 46.3 |  |
| Zumbido | Bug | Esp | 90 | 93 | 4.2 | instant |  | 8.8 | alrededor | 48.9 | 42.3 |  |
| Al Ataque | Bug | Fís | 90 | 95 | 4.2 | cast | 2.1 | 1.1 | objetivo | 49.6 | 45.4 |  |
| Golpe Fantasma | Ghost | Fís | 90 | 90 | 6.7 | desaparece | 1.5 | 10 | objetivo | 43.8 | 39.9 | invulnerable |
| Puño Meteoro | Steel | Fís | 90 | 81 | 4.2 | instant |  | 6.8 | objetivo | 46.1 | 42.4 |  |
| Golpe Cuerpo | Normal | Fís | 85 | 93 | 3.9 | instant |  | 8.8 | objetivo | 49.8 | 42.3 |  |
| Bote | Flying | Fís | 85 | 80 | 6.4 | desaparece | 1.5 | 10 | objetivo | 42.6 | 38.9 | invulnerable |
| Chuzos | Ice | Fís | 85 | 77 | 3.9 | instant |  | 6.1 | objetivo | 45.7 | 42.3 | interrumpe |
| Pulso Dragón | Dragon | Esp | 85 | 85 | 3.9 | cast | 1.9 | 1.1 | objetivo | 47.9 | 44.7 |  |
| Hipercolmillo | Normal | Fís | 80 | 72 | 3.6 | instant |  | 5.3 | objetivo | 45.3 | 42.4 | interrumpe |
| Triturar | Dark | Fís | 80 | 85 | 3.6 | instant |  | 7.5 | objetivo | 48.9 | 42.4 |  |
| Cabezazo Zen | Psychic | Fís | 80 | 72 | 3.6 | instant |  | 5.3 | objetivo | 45.3 | 42.4 | interrumpe |
| Bomba Germen | Grass | Fís | 80 | 80 | 3.6 | cast | 1.8 | 1.1 | objetivo | 47.5 | 44.4 |  |
| Velocidad Extrema | Normal | Fís | 80 | 80 | 3.6 | instant |  | 6.7 | objetivo | 47.5 | 42.3 | carga hacia el objetivo |
| Humareda | Fire | Esp | 80 | 88 | 3.6 | instant |  | 7.9 | alrededor | 49.6 | 42.4 |  |
| Atizar | Normal | Fís | 80 | 60 | 3.6 | instant |  | 3.3 | objetivo | 41.9 | 42.4 |  |
| Cascada | Water | Fís | 80 | 80 | 3.6 | instant |  | 6.7 | objetivo | 47.5 | 42.3 | interrumpe |
| Buceo | Water | Fís | 80 | 80 | 6.1 | desaparece | 1.5 | 10 | objetivo | 42.9 | 38.9 | invulnerable |
| Chispazo | Electric | Esp | 80 | 88 | 3.6 | instant |  | 7.9 | alrededor | 49.6 | 42.4 |  |
| Cañón Resplandor | Steel | Esp | 80 | 83 | 3.6 | cast | 1.8 | 1.1 | objetivo | 48.2 | 45.8 |  |
| Triataque | Normal | Esp | 80 | 80 | 3.6 | cast | 1.8 | 1.1 | objetivo | 47.5 | 44.4 | interrumpe |
| Fuerza | Normal | Fís | 80 | 80 | 3.6 | instant |  | 6.7 | objetivo | 47.5 | 42.3 |  |
| Chupavidas | Bug | Fís | 80 | 92 | 3.6 | instant |  | 8.7 | objetivo | 50.8 | 42.3 |  |
| Excavar | Ground | Fís | 80 | 80 | 6.1 | desaparece | 1.5 | 10 | objetivo | 42.9 | 38.9 | invulnerable |
| Taladradora | Ground | Fís | 80 | 81 | 3.6 | instant |  | 6.8 | objetivo | 47.6 | 42.3 |  |
| Paranormal | Psychic | Esp | 80 | 80 | 3.6 | cast | 1.8 | 1.1 | objetivo | 47.5 | 44.4 | interrumpe |
| Pico Taladro | Flying | Fís | 80 | 80 | 3.6 | instant |  | 6.7 | objetivo | 47.5 | 42.3 |  |
| Psicocarga | Psychic | Esp | 80 | 80 | 3.6 | cast | 1.8 | 1.1 | objetivo | 47.5 | 44.4 |  |
| Brillo Mágico | Fairy | Esp | 80 | 80 | 3.6 | cast | 1.8 | 1.1 | zona | 47.5 | 44.4 |  |
| Joya de Luz | Rock | Esp | 80 | 80 | 3.6 | cast | 1.8 | 1.1 | objetivo | 47.5 | 44.4 |  |
| Puya Nociva | Poison | Fís | 80 | 88 | 3.6 | instant |  | 7.9 | objetivo | 49.6 | 42.4 |  |
| Pulso Umbrío | Dark | Esp | 80 | 80 | 3.6 | cast | 1.8 | 1.1 | objetivo | 47.5 | 44.4 | interrumpe |
| Bola Sombra | Ghost | Esp | 80 | 85 | 3.6 | cast | 1.9 | 1.1 | objetivo | 48.9 | 44.7 |  |
| Garra Dragón | Dragon | Fís | 80 | 80 | 3.6 | instant |  | 6.7 | objetivo | 47.5 | 42.3 |  |
| Cabeza de Hierro | Steel | Fís | 80 | 80 | 3.6 | instant |  | 6.7 | objetivo | 47.5 | 42.3 | interrumpe |
| Esfera Aural | Fighting | Esp | 80 | 80 | 3.6 | cast | 1.8 | 1.1 | objetivo | 47.5 | 44.4 |  |
| Gigadrenado | Grass | Esp | 75 | 86 | 3.3 | canal | 1.9 | 1.1 | objetivo | 50.4 | 45.4 |  |
| Avalancha | Rock | Fís | 75 | 68 | 3.3 | instant |  | 4.6 | zona | 44.7 | 42.3 | interrumpe |
| Puño Trueno | Electric | Fís | 75 | 78 | 3.3 | instant |  | 6.3 | objetivo | 47.7 | 42.3 |  |
| Tajo Aéreo | Flying | Esp | 75 | 71 | 3.3 | instant |  | 5.2 | objetivo | 45.8 | 42.4 | interrumpe |
| Garra Brutal | Normal | Fís | 75 | 84 | 3.3 | instant |  | 7.3 | objetivo | 49.6 | 42.4 |  |
| Llama Embrujada | Fire | Esp | 75 | 100 | 3.3 | cast | 2.2 | 1.1 | objetivo | 54.5 | 45.5 |  |
| Pataleta | Ground | Fís | 75 | 75 | 3.3 | instant |  | 5.8 | objetivo | 47 | 42.4 |  |
| Puño Fuego | Fire | Fís | 75 | 78 | 3.3 | instant |  | 6.3 | objetivo | 47.7 | 42.3 |  |
| Golpe Cabeza | Normal | Fís | 70 | 70 | 3 | instant |  | 5 | objetivo | 46.4 | 42.4 | interrumpe |
| Patada Tropical | Grass | Fís | 70 | 95 | 3 | instant |  | 9.2 | objetivo | 54.7 | 42.3 |  |
| Represalia | Normal | Fís | 70 | 70 | 3 | instant |  | 5 | objetivo | 46.4 | 42.4 |  |
| Liofilización | Ice | Esp | 70 | 73 | 3 | cast | 1.6 | 1.1 | objetivo | 47.2 | 45.3 |  |
| Tiro Vital | Fighting | Fís | 70 | 70 | 3 | instant |  | 5 | objetivo | 46.4 | 42.4 |  |
| Veneno X | Poison | Fís | 70 | 77 | 3 | instant |  | 6.1 | objetivo | 48.6 | 42.4 |  |
| Golpe Bajo | Dark | Fís | 70 | 70 | 3 | instant |  | 6 | objetivo | 46.4 | 41.4 | carga hacia el objetivo |
| Cuchillada | Normal | Fís | 70 | 74 | 3 | instant |  | 5.7 | objetivo | 47.8 | 42.4 |  |
| Tajo Umbrío | Dark | Fís | 70 | 74 | 3 | instant |  | 5.7 | objetivo | 47.8 | 42.4 |  |
| Ala de Acero | Steel | Fís | 70 | 63 | 3 | instant |  | 3.8 | objetivo | 44 | 42.4 |  |
| Psicocorte | Psychic | Fís | 70 | 74 | 3 | cast | 1.6 | 1.1 | objetivo | 47.8 | 46.4 |  |
| Garra Umbría | Ghost | Fís | 70 | 74 | 3 | instant |  | 5.7 | objetivo | 47.8 | 42.4 |  |
| Pisotón | Normal | Fís | 65 | 65 | 2.7 | instant |  | 4.2 | objetivo | 45.6 | 42.3 | interrumpe |
| Colmillo Ígneo | Fire | Fís | 65 | 62 | 2.7 | instant |  | 3.6 | objetivo | 44.4 | 42.4 |  |
| Rayo Burbuja | Water | Esp | 65 | 68 | 2.7 | cast | 1.5 | 1.1 | objetivo | 46.5 | 45 |  |
| Colmillo Hielo | Ice | Fís | 65 | 62 | 2.7 | instant |  | 3.6 | objetivo | 44.4 | 42.4 |  |
| Salmuera | Water | Esp | 65 | 65 | 2.7 | cast | 1.5 | 1.1 | objetivo | 45.6 | 43.3 |  |
| Chispa | Electric | Fís | 65 | 73 | 2.7 | instant |  | 5.4 | objetivo | 48.4 | 42.4 |  |
| Puntapié | Fighting | Fís | 65 | 90 | 2.7 | instant |  | 8.3 | objetivo | 54.9 | 42.4 |  |
| Desarme | Dark | Fís | 65 | 65 | 2.7 | instant |  | 4.2 | objetivo | 45.6 | 42.3 |  |
| Residuos | Poison | Esp | 65 | 73 | 2.7 | cast | 1.6 | 1.1 | objetivo | 48.4 | 45.3 |  |
| Carga Tóxica | Poison | Esp | 65 | 65 | 2.7 | cast | 1.5 | 1.1 | objetivo | 45.6 | 43.3 |  |
| Cornada | Normal | Fís | 65 | 65 | 2.7 | instant |  | 4.2 | objetivo | 45.6 | 42.3 |  |
| Psicorrayo | Psychic | Esp | 65 | 65 | 2.7 | cast | 1.5 | 1.1 | objetivo | 45.6 | 43.3 | interrumpe |
| Colmillo Rayo | Electric | Fís | 65 | 62 | 2.7 | instant |  | 3.6 | objetivo | 44.4 | 42.4 |  |
| Infortunio | Ghost | Esp | 65 | 65 | 2.7 | cast | 1.5 | 1.1 | objetivo | 45.6 | 43.3 |  |
| Antojo | Normal | Fís | 60 | 60 | 2.4 | instant |  | 3.3 | objetivo | 44.7 | 42.4 |  |
| Mordisco | Dark | Fís | 60 | 60 | 2.4 | instant |  | 3.3 | objetivo | 44.7 | 42.4 | interrumpe |
| Hoja Mágica | Grass | Esp | 60 | 60 | 2.4 | cast | 1.5 | 1.1 | objetivo | 44.7 | 40 |  |
| Rueda Fuego | Fire | Fís | 60 | 63 | 2.4 | instant |  | 3.8 | objetivo | 45.7 | 42.3 |  |
| Poder Pasado | Rock | Esp | 60 | 60 | 2.4 | cast | 1.5 | 1.1 | objetivo | 44.7 | 40 |  |
| Calcinación | Fire | Esp | 60 | 60 | 2.4 | cast | 1.5 | 1.1 | zona | 44.7 | 40 |  |
| Hidropulso | Water | Esp | 60 | 60 | 2.4 | cast | 1.5 | 1.1 | objetivo | 44.7 | 40 | interrumpe |
| Rapidez | Normal | Esp | 60 | 60 | 2.4 | cast | 1.5 | 1.1 | zona | 44.7 | 40 |  |
| Alud | Ice | Fís | 60 | 60 | 2.4 | instant |  | 3.3 | objetivo | 44.7 | 42.4 |  |
| Vaho Gélido | Ice | Esp | 60 | 54 | 2.4 | cast | 1.5 | 1.1 | objetivo | 42.2 | 36.4 |  |
| Desquite | Fighting | Fís | 60 | 60 | 2.4 | instant |  | 3.3 | objetivo | 44.7 | 42.4 |  |
| Palmeo | Fighting | Fís | 60 | 68 | 2.4 | instant |  | 4.6 | objetivo | 47.8 | 42.3 |  |
| Aire Afilado | Flying | Esp | 60 | 60 | 2.4 | cast | 1.5 | 1.1 | cono | 44.9 | 40.3 |  |
| Terratemblor | Ground | Fís | 60 | 85 | 2.4 | instant |  | 7.5 | alrededor | 55.1 | 42.4 |  |
| Ataque Ala | Flying | Fís | 60 | 60 | 2.4 | instant |  | 3.3 | objetivo | 44.7 | 42.4 |  |
| Picoteo | Flying | Fís | 60 | 60 | 2.4 | instant |  | 3.3 | objetivo | 44.7 | 42.4 |  |
| Picadura | Bug | Fís | 60 | 60 | 2.4 | instant |  | 3.3 | objetivo | 44.7 | 42.4 |  |
| Tumba Rocas | Rock | Fís | 60 | 82 | 2.4 | cast | 1.8 | 1.1 | objetivo | 53.9 | 45.6 |  |
| Dragoaliento | Dragon | Esp | 60 | 68 | 2.4 | cast | 1.5 | 1.1 | objetivo | 47.8 | 45 |  |
| Puño Sombra | Ghost | Fís | 60 | 60 | 2.4 | instant |  | 3.3 | objetivo | 44.7 | 42.4 |  |
| Buena Baza | Dark | Fís | 60 | 60 | 2.4 | instant |  | 3.3 | objetivo | 44.7 | 42.4 |  |
| Vasto Impacto | Dragon | Fís | 60 | 85 | 2.4 | instant |  | 7.5 | zona | 55.1 | 42.4 |  |
| Cola Dragón | Dragon | Fís | 60 | 54 | 2.4 | instant |  | 2.3 | objetivo | 42.2 | 42.5 |  |
| Ladrón | Dark | Fís | 60 | 60 | 2.4 | instant |  | 3.3 | objetivo | 44.7 | 42.4 |  |
| Hoja Afilada | Grass | Fís | 55 | 55 | 2 | cast | 1.5 | 1.1 | zona | 44.1 | 36.9 |  |
| Viento Hielo | Ice | Esp | 55 | 77 | 2 | cast | 1.7 | 1.1 | cono | 55 | 45.4 |  |
| Disparo Lodo | Ground | Esp | 55 | 77 | 2 | cast | 1.7 | 1.1 | objetivo | 55 | 45.4 |  |
| Alarido | Dark | Esp | 55 | 77 | 2 | cast | 1.7 | 1.1 | zona | 55 | 45.4 |  |
| Ronquido | Normal | Esp | 50 | 50 | 1.7 | instant |  | 1.7 | alrededor | 42.2 | 42.2 | interrumpe |
| Giro Rápido | Normal | Fís | 50 | 50 | 1.7 | instant |  | 1.7 | objetivo | 42.2 | 42.2 |  |
| Lanzarrocas | Rock | Fís | 50 | 45 | 1.7 | instant |  | 1.1 | objetivo | 39.3 | 40.9 |  |
| Niebla Clara | Poison | Esp | 50 | 50 | 1.7 | cast | 1.5 | 1.1 | objetivo | 42.2 | 36.4 |  |
| Confusión | Psychic | Esp | 50 | 50 | 1.7 | cast | 1.5 | 1.1 | objetivo | 42.2 | 36.4 | interrumpe |
| Meteorobola | Normal | Esp | 50 | 50 | 1.7 | cast | 1.5 | 1.1 | objetivo | 42.2 | 36.4 |  |
| Garra Metal | Steel | Fís | 50 | 48 | 1.7 | instant |  | 1.3 | objetivo | 40.8 | 42.1 |  |
| Colmillo Veneno | Poison | Fís | 50 | 63 | 1.7 | instant |  | 3.8 | objetivo | 49.6 | 42.3 |  |
| Antiaéreo | Rock | Fís | 50 | 50 | 1.7 | cast | 1.5 | 1.1 | objetivo | 42.2 | 36.4 |  |
| Beso Drenaje | Fairy | Esp | 50 | 57 | 1.7 | instant |  | 2.9 | objetivo | 46.7 | 42.4 |  |
| Estoicismo | Bug | Esp | 50 | 75 | 1.7 | cast | 1.7 | 1.1 | zona | 57 | 44.1 |  |
| Aguijón Letal | Bug | Fís | 50 | 50 | 1.7 | instant |  | 1.7 | objetivo | 42.2 | 42.2 |  |
| Vendetta | Dark | Fís | 50 | 50 | 1.7 | instant |  | 1.7 | objetivo | 42.2 | 42.2 |  |
| Látigo Cepa | Grass | Fís | 45 | 45 | 1.4 | instant |  | 1.1 | objetivo | 39.9 | 40.9 |  |
| Placaje | Normal | Fís | 40 | 40 | 1.1 | instant |  | 1.1 | objetivo | 36.4 | 36.4 |  |
| Acua Jet | Water | Fís | 40 | 40 | 1.1 | instant |  | 6 | objetivo | 36.4 | 36.4 | carga hacia el objetivo |
| Pistola Agua | Water | Esp | 40 | 40 | 1.1 | instant |  | 1.1 | objetivo | 36.4 | 36.4 |  |
| Ácido | Poison | Esp | 40 | 43 | 1.1 | instant |  | 1.1 | zona | 38.6 | 38.6 |  |
| Megaagotar | Grass | Esp | 40 | 46 | 1.1 | instant |  | 1.1 | objetivo | 41.8 | 41.8 |  |
| Destructor | Normal | Fís | 40 | 40 | 1.1 | instant |  | 1.1 | objetivo | 36.4 | 36.4 |  |
| Ascuas | Fire | Esp | 40 | 43 | 1.1 | instant |  | 1.1 | objetivo | 38.6 | 38.6 |  |
| Arañazo | Normal | Fís | 40 | 40 | 1.1 | instant |  | 1.1 | objetivo | 36.4 | 36.4 |  |
| Ciclón | Dragon | Esp | 40 | 40 | 1.1 | instant |  | 1.1 | cono | 36.4 | 36.4 | interrumpe |
| Esquirla Helada | Ice | Fís | 40 | 40 | 1.1 | instant |  | 6 | objetivo | 36.4 | 36.4 |  |
| Impactrueno | Electric | Esp | 40 | 43 | 1.1 | instant |  | 1.1 | objetivo | 38.6 | 38.6 |  |
| Ataque Rápido | Normal | Fís | 40 | 40 | 1.1 | instant |  | 6 | objetivo | 36.4 | 36.4 | carga hacia el objetivo |
| Nieve Polvo | Ice | Esp | 40 | 43 | 1.1 | instant |  | 1.1 | zona | 38.6 | 38.6 |  |
| Golpe Bis | Dragon | Fís | 40 | 72 | 3.6 | instant |  | 5.3 | objetivo | 45.3 | 42.4 |  |
| Sorpresa | Normal | Fís | 40 | 40 | 1.1 | instant |  | 6 | objetivo | 36.4 | 36.4 | carga hacia el objetivo, interrumpe |
| Bomba Ácida | Poison | Esp | 40 | 65 | 1.1 | cast | 1.5 | 1.1 | objetivo | 59.1 | 43.3 |  |
| Golpe Roca | Fighting | Fís | 40 | 53 | 1.1 | instant |  | 2.1 | objetivo | 47.7 | 42.3 |  |
| Tornado | Flying | Esp | 40 | 40 | 1.1 | instant |  | 1.1 | objetivo | 36.4 | 36.4 |  |
| Eco Voz | Normal | Esp | 40 | 40 | 1.1 | instant |  | 1.1 | alrededor | 36.4 | 36.4 |  |
| Voz Cautivadora | Fairy | Esp | 40 | 40 | 1.1 | instant |  | 1.1 | zona | 36.4 | 36.4 |  |
| Corte Furia | Bug | Fís | 40 | 38 | 1.1 | instant |  | 1.1 | objetivo | 36.4 | 36.4 |  |
| Sombra Vil | Ghost | Fís | 40 | 40 | 1.1 | instant |  | 6 | objetivo | 36.4 | 36.4 | carga hacia el objetivo |
| Falso Tortazo | Normal | Fís | 40 | 40 | 1.1 | instant |  | 1.1 | objetivo | 36.4 | 36.4 |  |
| Puño Bala | Steel | Fís | 40 | 40 | 1.1 | instant |  | 6 | objetivo | 36.4 | 36.4 | carga hacia el objetivo |
| Viento Feérico | Fairy | Esp | 40 | 40 | 1.1 | instant |  | 1.1 | objetivo | 36.4 | 36.4 |  |
| Torbellino | Water | Esp | 35 | 30 | 1.1 | instant |  | 1.1 | objetivo | 36.4 | 36.4 |  |
| Doble Golpe | Normal | Fís | 35 | 63 | 3 | instant |  | 3.8 | objetivo | 44 | 42.4 |  |
| Bucle Arena | Ground | Fís | 35 | 30 | 1.1 | instant |  | 1.1 | objetivo | 36.4 | 36.4 |  |
| Picotazo | Flying | Fís | 35 | 35 | 1.1 | instant |  | 1.1 | objetivo | 36.4 | 36.4 |  |
| Giro Fuego | Fire | Esp | 35 | 30 | 1.1 | instant |  | 1.1 | objetivo | 36.4 | 36.4 |  |
| Rodar | Rock | Fís | 30 | 27 | 1.1 | instant |  | 1.1 | objetivo | 36.4 | 36.4 |  |
| Doble Patada | Fighting | Fís | 30 | 60 | 2.4 | instant |  | 3.3 | objetivo | 44.7 | 42.4 |  |
| Lengüetazo | Ghost | Fís | 30 | 38 | 1.1 | instant |  | 1.1 | objetivo | 36.4 | 36.4 |  |
| Polución | Poison | Esp | 30 | 31 | 1.1 | instant |  | 1.1 | objetivo | 36.4 | 36.4 |  |
| Impresionar | Ghost | Fís | 30 | 30 | 1.1 | instant |  | 1.1 | objetivo | 36.4 | 36.4 | interrumpe |
| Amago | Normal | Fís | 30 | 30 | 1.1 | instant |  | 6 | objetivo | 36.4 | 36.4 |  |
| Semilladora | Grass | Fís | 25 | 88 | 4.1 | canal | 1.9 | 1.1 | objetivo | 47.9 | 46.1 |  |
| Carámbano | Ice | Fís | 25 | 88 | 4.1 | canal | 1.9 | 1.1 | objetivo | 47.9 | 46.1 |  |
| Pedrada | Rock | Fís | 25 | 79 | 4.1 | canal | 1.7 | 1.1 | objetivo | 45.8 | 46.3 |  |
| Pin Misil | Bug | Fís | 25 | 83 | 4.1 | canal | 1.8 | 1.1 | objetivo | 46.9 | 46.2 |  |
| Absorber | Grass | Esp | 20 | 23 | 1.1 | instant |  | 1.1 | objetivo | 36.4 | 36.4 |  |
| Moflete Estático | Electric | Fís | 20 | 45 | 1.1 | instant |  | 1.1 | objetivo | 40.9 | 40.9 |  |
| Bofetón Lodo | Ground | Esp | 20 | 45 | 1.1 | instant |  | 1.1 | objetivo | 40.9 | 40.9 |  |
| Chulería | Dark | Fís | 20 | 20 | 1.1 | instant |  | 1.1 | objetivo | 36.4 | 36.4 |  |
| Poder Reserva | Psychic | Esp | 20 | 20 | 1.1 | instant |  | 1.1 | objetivo | 36.4 | 36.4 |  |
| Acoso | Bug | Esp | 20 | 20 | 1.1 | instant |  | 1.1 | objetivo | 36.4 | 36.4 |  |
| Golpes Furia | Normal | Fís | 18 | 50 | 2.5 | instant |  | 1.7 | objetivo | 40.5 | 42.5 |  |
| Empujón | Fighting | Fís | 15 | 53 | 1.9 | instant |  | 2.1 | objetivo | 42.9 | 42.3 |  |
| Ataque Furia | Normal | Fís | 15 | 45 | 1.9 | instant |  | 1.1 | objetivo | 38.8 | 40.6 |  |
| Picotazo Veneno | Poison | Fís | 15 | 23 | 1.1 | instant |  | 1.1 | objetivo | 36.4 | 36.4 |  |
| Atadura | Normal | Fís | 15 | 13 | 1.1 | instant |  | 1.1 | objetivo | 36.4 | 36.4 |  |
| Constricción | Normal | Fís | 15 | 14 | 1.1 | instant |  | 1.1 | objetivo | 36.4 | 36.4 |  |
| Superdiente | Normal | Fís | 0 | 0 | 1.1 | instant |  | 1.1 | objetivo | 36.4 | 36.4 |  |
| Inversión | Fighting | Fís | 0 | 0 | 1.1 | instant |  | 1.1 | objetivo | 36.4 | 36.4 |  |
| Lanzamiento | Dark | Fís | 0 | 0 | 1.1 | instant |  | 1.1 | objetivo | 36.4 | 36.4 |  |
| Azote | Normal | Fís | 0 | 0 | 1.1 | instant |  | 1.1 | objetivo | 36.4 | 36.4 |  |
| Cuerpo Pesado | Steel | Fís | 0 | 0 | 1.1 | instant |  | 1.1 | objetivo | 36.4 | 36.4 |  |
| Esfuerzo | Normal | Fís | 0 | 0 | 1.1 | instant |  | 1.1 | objetivo | 36.4 | 36.4 |  |
| Frío Polar | Ice | Esp | 0 | 0 | 1.1 | instant |  | 1.1 | objetivo | 36.4 | 36.4 |  |
| Bola Voltio | Electric | Esp | 0 | 0 | 1.1 | instant |  | 1.1 | objetivo | 36.4 | 36.4 |  |
| Giro Bola | Steel | Fís | 0 | 0 | 1.1 | instant |  | 1.1 | objetivo | 36.4 | 36.4 |  |
| Manto Espejo | Psychic | Esp | 0 | 0 | 1.1 | instant |  | 1.1 | objetivo | 36.4 | 36.4 |  |
| Patada Baja | Fighting | Fís | 0 | 0 | 1.1 | instant |  | 1.1 | objetivo | 36.4 | 36.4 |  |
| Sísmico | Fighting | Fís | 0 | 45 | 1.1 | instant |  | 1.1 | objetivo | 40.9 | 40.9 |  |
| Fisura | Ground | Fís | 0 | 0 | 1.1 | instant |  | 1.1 | objetivo | 36.4 | 36.4 |  |
| Perforador | Normal | Fís | 0 | 0 | 1.1 | instant |  | 1.1 | objetivo | 36.4 | 36.4 |  |
| Contraataque | Fighting | Fís | 0 | 0 | 1.1 | instant |  | 1.1 | objetivo | 36.4 | 36.4 |  |
| Tinieblas | Ghost | Esp | 0 | 45 | 1.1 | instant |  | 1.1 | objetivo | 40.9 | 40.9 |  |
| Guillotina | Normal | Fís | 0 | 0 | 1.1 | instant |  | 1.1 | objetivo | 36.4 | 36.4 |  |
| Resarcimiento | Dark | Fís | 0 | 0 | 1.1 | instant |  | 1.1 | objetivo | 36.4 | 36.4 |  |
| Represión Metal | Steel | Fís | 0 | 0 | 1.1 | instant |  | 1.1 | objetivo | 36.4 | 36.4 |  |
| Escupir | Normal | Esp | 0 | 0 | 1.1 | instant |  | 1.1 | objetivo | 36.4 | 36.4 |  |
| Hierba Lazo | Grass | Esp | 0 | 0 | 1.1 | instant |  | 1.1 | objetivo | 36.4 | 36.4 |  |
| Gruñido | Normal | Estado |  |  | 8 | instant |  | 10 | zona |  |  | debufo |
| Rizo Defensa | Normal | Estado |  |  | 8 | instant |  | 20 | propio |  |  | bufo |
| Bostezo | Normal | Estado |  |  | 8 | instant |  | 10 | objetivo |  |  | debufo |
| Danza Espada | Normal | Estado |  |  | 8 | instant |  | 20 | propio |  |  | bufo |
| Amnesia | Psychic | Estado |  |  | 8 | instant |  | 20 | propio |  |  | bufo |
| Maldición | Ghost | Estado |  |  | 8 | instant |  | 10 | objetivo |  |  | debufo |
| Fertilizante | Ground | Estado |  |  | 8 | cast | 1.5 | 40 | global |  |  | clima/campo |
| Copión | Normal | Estado |  |  | 8 | instant |  | 20 | propio |  |  | bufo |
| Isoguardia | Psychic | Estado |  |  | 8 | instant |  | 10 | objetivo |  |  | debufo |
| Cambiadefensa | Psychic | Estado |  |  | 8 | instant |  | 10 | objetivo |  |  | debufo |
| Rizo Algodón | Grass | Estado |  |  | 8 | instant |  | 20 | propio |  |  | bufo |
| Cascabel Cura | Normal | Estado |  |  | 8 | instant |  | 10 | propio |  |  | debufo |
| Batido | Normal | Estado |  |  | 14 | cast | 1.5 | 20 | propio |  |  | cura |
| Encanto | Fairy | Estado |  |  | 8 | instant |  | 10 | objetivo |  |  | debufo |
| Reciclaje | Normal | Estado |  |  | 8 | instant |  | 20 | propio |  |  | bufo |
| Reserva | Normal | Estado |  |  | 8 | instant |  | 20 | propio |  |  | bufo |
| Tragar | Normal | Estado |  |  | 8 | instant |  | 20 | propio |  |  | bufo |
| Chirrido | Normal | Estado |  |  | 8 | instant |  | 10 | objetivo |  |  | debufo |
| Metrónomo | Normal | Estado |  |  | 8 | instant |  | 20 | propio |  |  | bufo |
| Tambor | Normal | Estado |  |  | 8 | instant |  | 20 | propio |  |  | bufo |
| Bloqueo | Normal | Estado |  |  | 8 | instant |  | 10 | objetivo |  |  | debufo |
| Descanso | Psychic | Estado |  |  | 8 | instant |  | 20 | propio |  |  | bufo |
| Sonámbulo | Normal | Estado |  |  | 8 | instant |  | 20 | propio |  |  | bufo |
| Desarrollo | Normal | Estado |  |  | 8 | instant |  | 20 | propio |  |  | bufo |
| Drenadoras | Grass | Estado |  |  | 8 | instant |  | 10 | objetivo |  |  | debufo |
| Polvo Veneno | Poison | Estado |  |  | 12 | instant |  | 12 | objetivo |  |  | estado |
| Somnífero | Grass | Estado |  |  | 12 | cast | 1.5 | 20 | objetivo |  |  | control |
| Dulce Aroma | Normal | Estado |  |  | 8 | instant |  | 10 | zona |  |  | debufo |
| Fotosíntesis | Grass | Estado |  |  | 8 | instant |  | 20 | propio |  |  | bufo |
| Abatidoras | Grass | Estado |  |  | 8 | instant |  | 10 | objetivo |  |  | debufo |
| Paralizador | Grass | Estado |  |  | 12 | instant |  | 12 | objetivo |  |  | estado |
| Tóxico | Poison | Estado |  |  | 12 | instant |  | 12 | objetivo |  |  | estado |
| Campo de Hierba | Grass | Estado |  |  | 8 | cast | 1.5 | 40 | global |  |  | clima/campo |
| Luz Lunar | Fairy | Estado |  |  | 8 | instant |  | 20 | propio |  |  | bufo |
| Día Soleado | Fire | Estado |  |  | 8 | cast | 1.5 | 40 | global |  |  | clima/campo |
| Arraigo | Grass | Estado |  |  | 8 | instant |  | 20 | propio |  |  | bufo |
| Salpicadura | Normal | Estado |  |  | 8 | instant |  | 20 | propio |  |  | bufo |
| Camaradería | Normal | Estado |  |  | 8 | instant |  | 10 | objetivo |  |  | debufo |
| Danza Caos | Normal | Estado |  |  | 8 | instant |  | 10 | alrededor |  |  | debufo |
| Niebla Aromática | Fairy | Estado |  |  | 8 | instant |  | 10 | objetivo |  |  | debufo |
| Fanfarronear | Normal | Estado |  |  | 8 | instant |  | 10 | objetivo |  |  | debufo |
| Malicioso | Normal | Estado |  |  | 8 | instant |  | 10 | zona |  |  | debufo |
| Aullido | Normal | Estado |  |  | 8 | instant |  | 10 | propio |  |  | debufo |
| Refuerzo | Normal | Estado |  |  | 8 | instant |  | 10 | objetivo |  |  | debufo |
| Agilidad | Psychic | Estado |  |  | 8 | instant |  | 20 | propio |  |  | velocidad + celeridad |
| Rugido | Normal | Estado |  |  | 8 | instant |  | 10 | objetivo |  |  | debufo |
| Fortaleza | Normal | Estado |  |  | 8 | instant |  | 20 | propio |  |  | bufo |
| Recuperación | Normal | Estado |  |  | 14 | cast | 1.5 | 20 | propio |  |  | cura |
| Rompecoraza | Normal | Estado |  |  | 8 | instant |  | 20 | propio |  |  | velocidad + celeridad |
| Refugio | Water | Estado |  |  | 8 | instant |  | 20 | propio |  |  | bufo |
| Pantallahumo | Normal | Estado |  |  | 8 | instant |  | 10 | objetivo |  |  | debufo |
| Protección | Normal | Estado |  |  | 8 | instant |  | 15 | propio |  |  | escudo 1,5 s |
| Defensa Férrea | Steel | Estado |  |  | 8 | instant |  | 20 | propio |  |  | bufo |
| Látigo | Normal | Estado |  |  | 8 | instant |  | 10 | zona |  |  | debufo |
| Acua Aro | Water | Estado |  |  | 8 | instant |  | 20 | propio |  |  | bufo |
| Danza Lluvia | Water | Estado |  |  | 8 | cast | 1.5 | 40 | global |  |  | clima/campo |
| Anulación | Normal | Estado |  |  | 8 | instant |  | 10 | objetivo |  |  | debufo |
| Empapar | Water | Estado |  |  | 8 | instant |  | 10 | objetivo |  |  | debufo |
| Autosugestión | Normal | Estado |  |  | 8 | instant |  | 10 | objetivo |  |  | debufo |
| Zona Extraña | Psychic | Estado |  |  | 8 | cast | 1.5 | 40 | global |  |  | clima/campo |
| Cara Susto | Normal | Estado |  |  | 8 | instant |  | 10 | objetivo |  |  | debufo |
| Danza Dragón | Dragon | Estado |  |  | 8 | instant |  | 20 | propio |  |  | velocidad + celeridad |
| Neblina | Ice | Estado |  |  | 8 | instant |  | 10 | propio |  |  | debufo |
| Rugido de Guerra | Normal | Estado |  |  | 8 | instant |  | 10 | objetivo |  |  | debufo |
| Canto | Normal | Estado |  |  | 12 | cast | 1.5 | 20 | objetivo |  |  | control |
| Gota Vital | Water | Estado |  |  | 14 | cast | 1.5 | 20 | propio |  |  | cura |
| Rayo Confuso | Ghost | Estado |  |  | 8 | instant |  | 10 | objetivo |  |  | debufo |
| Canto Mortal | Normal | Estado |  |  | 8 | cast | 1.5 | 40 | global |  |  | clima/campo |
| Beso Dulce | Fairy | Estado |  |  | 8 | instant |  | 10 | objetivo |  |  | debufo |
| Maquinación | Dark | Estado |  |  | 8 | instant |  | 20 | propio |  |  | bufo |
| Onda Trueno | Electric | Estado |  |  | 12 | instant |  | 12 | objetivo |  |  | estado |
| Doble Equipo | Normal | Estado |  |  | 8 | instant |  | 20 | propio |  |  | bufo |
| Pantalla de Luz | Psychic | Estado |  |  | 8 | instant |  | 10 | propio |  |  | debufo |
| Supersónico | Normal | Estado |  |  | 8 | instant |  | 10 | objetivo |  |  | debufo |
| Levitón | Electric | Estado |  |  | 8 | instant |  | 20 | propio |  |  | bufo |
| Eco Metálico | Steel | Estado |  |  | 8 | instant |  | 10 | objetivo |  |  | debufo |
| Fijar Blanco | Normal | Estado |  |  | 8 | instant |  | 10 | objetivo |  |  | debufo |
| Campo Eléctrico | Electric | Estado |  |  | 8 | cast | 1.5 | 40 | global |  |  | clima/campo |
| Aura Magnética | Electric | Estado |  |  | 8 | instant |  | 10 | propio |  |  | debufo |
| Aguante | Normal | Estado |  |  | 8 | instant |  | 15 | propio |  |  | escudo 1,5 s |
| Mofa | Dark | Estado |  |  | 8 | instant |  | 10 | objetivo |  |  | debufo |
| Granizo | Ice | Estado |  |  | 8 | cast | 1.5 | 40 | global |  |  | clima/campo |
| Armadura Ácida | Poison | Estado |  |  | 8 | instant |  | 20 | propio |  |  | bufo |
| Paisaje Nevado | Ice | Estado |  |  | 8 | cast | 1.5 | 40 | global |  |  | clima/campo |
| Vasta Guardia | Rock | Estado |  |  | 8 | instant |  | 10 | propio |  |  | debufo |
| Foco Energía | Normal | Estado |  |  | 8 | instant |  | 20 | propio |  |  | bufo |
| Corpulencia | Fighting | Estado |  |  | 8 | instant |  | 20 | propio |  |  | bufo |
| Ataque Arena | Ground | Estado |  |  | 8 | instant |  | 10 | objetivo |  |  | debufo |
| Remolino | Normal | Estado |  |  | 8 | instant |  | 10 | objetivo |  |  | debufo |
| Detección | Fighting | Estado |  |  | 8 | instant |  | 15 | propio |  |  | escudo 1,5 s |
| Gas Venenoso | Poison | Estado |  |  | 12 | instant |  | 12 | zona |  |  | estado |
| Reducción | Normal | Estado |  |  | 8 | instant |  | 20 | propio |  |  | bufo |
| Legado | Dark | Estado |  |  | 8 | instant |  | 10 | objetivo |  |  | debufo |
| Púas Tóxicas | Poison | Estado |  |  | 8 | instant |  | 10 | trampa |  |  | debufo |
| Divide Dolor | Normal | Estado |  |  | 8 | instant |  | 10 | objetivo |  |  | debufo |
| Mal de Ojo | Normal | Estado |  |  | 8 | instant |  | 10 | objetivo |  |  | debufo |
| Anticipo | Fighting | Estado |  |  | 8 | instant |  | 10 | propio |  |  | debufo |
| Niebla | Ice | Estado |  |  | 8 | cast | 1.5 | 40 | global |  |  | clima/campo |
| Viento Afín | Flying | Estado |  |  | 8 | instant |  | 10 | propio |  |  | debufo |
| Tormenta de Arena | Rock | Estado |  |  | 8 | cast | 1.5 | 40 | global |  |  | clima/campo |
| Afilagarras | Dark | Estado |  |  | 8 | instant |  | 20 | propio |  |  | bufo |
| Danza Pluma | Flying | Estado |  |  | 8 | instant |  | 10 | objetivo |  |  | debufo |
| Respiro | Flying | Estado |  |  | 14 | cast | 1.5 | 20 | propio |  |  | cura |
| Movimiento Espejo | Flying | Estado |  |  | 8 | instant |  | 10 | objetivo |  |  | debufo |
| Reflejo | Psychic | Estado |  |  | 8 | instant |  | 10 | propio |  |  | debufo |
| Despejar | Flying | Estado |  |  | 8 | instant |  | 10 | objetivo |  |  | debufo |
| Hipnosis | Psychic | Estado |  |  | 12 | cast | 1.5 | 20 | objetivo |  |  | control |
| Teletransporte | Psychic | Estado |  |  | 8 | instant |  | 12 | propio |  |  | salto 120 px |
| Kinético | Psychic | Estado |  |  | 8 | instant |  | 10 | objetivo |  |  | debufo |
| Cambio de Banda | Psychic | Estado |  |  | 8 | instant |  | 20 | propio |  |  | bufo |
| Imitación | Psychic | Estado |  |  | 8 | instant |  | 10 | objetivo |  |  | debufo |
| Paz Mental | Psychic | Estado |  |  | 8 | instant |  | 20 | propio |  |  | bufo |
| Pulso Cura | Psychic | Estado |  |  | 8 | instant |  | 10 | objetivo |  |  | debufo |
| Deseo Cura | Psychic | Estado |  |  | 8 | instant |  | 20 | propio |  |  | bufo |
| Campo de Niebla | Fairy | Estado |  |  | 8 | cast | 1.5 | 40 | global |  |  | clima/campo |
| Deseo | Normal | Estado |  |  | 8 | instant |  | 20 | propio |  |  | bufo |
| Psicocambio | Psychic | Estado |  |  | 8 | instant |  | 10 | objetivo |  |  | debufo |
| Cambiafuerza | Psychic | Estado |  |  | 8 | instant |  | 10 | objetivo |  |  | debufo |
| Disparo Demora | Bug | Estado |  |  | 8 | instant |  | 10 | zona |  |  | debufo |
| Velo Sagrado | Normal | Estado |  |  | 8 | instant |  | 10 | propio |  |  | debufo |
| Polvo Ira | Bug | Estado |  |  | 8 | instant |  | 20 | propio |  |  | bufo |
| Danza Aleteo | Bug | Estado |  |  | 8 | instant |  | 20 | propio |  |  | velocidad + celeridad |
| A Defender | Bug | Estado |  |  | 8 | instant |  | 20 | propio |  |  | bufo |
| Mismo Destino | Ghost | Estado |  |  | 8 | instant |  | 20 | propio |  |  | bufo |
| Red Viscosa | Bug | Estado |  |  | 8 | instant |  | 10 | trampa |  |  | debufo |
| Hilo Venenoso | Poison | Estado |  |  | 12 | instant |  | 12 | objetivo |  |  | estado |
| Pulimento | Rock | Estado |  |  | 8 | instant |  | 20 | propio |  |  | velocidad + celeridad |
| Trampa Rocas | Rock | Estado |  |  | 8 | instant |  | 10 | trampa |  |  | debufo |
| Llanto Falso | Dark | Estado |  |  | 8 | instant |  | 10 | objetivo |  |  | debufo |
| Mimético | Normal | Estado |  |  | 8 | instant |  | 10 | objetivo |  |  | debufo |
| Ojos Llorosos | Normal | Estado |  |  | 8 | instant |  | 10 | objetivo |  |  | debufo |
| Aligerar | Steel | Estado |  |  | 8 | instant |  | 20 | propio |  |  | velocidad + celeridad |
| Rencor | Ghost | Estado |  |  | 8 | instant |  | 10 | objetivo |  |  | debufo |
| Clonatipo | Normal | Estado |  |  | 8 | instant |  | 10 | objetivo |  |  | debufo |
| Fuego Fatuo | Fire | Estado |  |  | 12 | instant |  | 12 | objetivo |  |  | estado |
| Sellar | Psychic | Estado |  |  | 8 | instant |  | 20 | propio |  |  | bufo |
| Último Lugar | Dark | Estado |  |  | 8 | instant |  | 10 | objetivo |  |  | debufo |
| Tormento | Dark | Estado |  |  | 8 | instant |  | 10 | objetivo |  |  | debufo |
| Relevo | Normal | Estado |  |  | 8 | instant |  | 20 | propio |  |  | bufo |
| Otra Vez | Normal | Estado |  |  | 8 | instant |  | 10 | objetivo |  |  | debufo |
| Cede Paso | Normal | Estado |  |  | 8 | instant |  | 10 | objetivo |  |  | debufo |
| Gravedad | Psychic | Estado |  |  | 8 | cast | 1.5 | 40 | global |  |  | clima/campo |
| Señuelo | Normal | Estado |  |  | 8 | instant |  | 20 | propio |  |  | bufo |
| Masa Cósmica | Psychic | Estado |  |  | 8 | instant |  | 20 | propio |  |  | bufo |
