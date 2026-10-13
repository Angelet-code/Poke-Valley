# Referencias de pixel art (edificios y objetos top-down 3/4)

Recopilado 2026-10-13. Objetivo: casas/tienda/estaciones en pixel art a escala nativa (casilla 24 px,
Bulbasaur PMD ≈ 24 px de cuerpo) que peguen con los sprites de PMD y con el suelo pintado.

## Juegos (estilo a imitar)
- **Stardew Valley** (ConcernedApe): la referencia del usuario. Casas de 3/4, tejados grandes, 3-4 tonos por material.
- **Pokémon Mundo Misterioso** (GBA/DS): mismos sprites que usamos; sus tilesets/pueblos son la mejor guía de escala y paleta.
- **Harvest Moon: Friends of Mineral Town** (GBA) y **Minish Cap**: edificios compactos, contornos tintados, nada de negro puro.
- **Fields of Mistria** (GBA/anime pastel, el "post-Stardew" mejor valorado), **Sun Haven**, **Roots of Pacha**, **Kynseed**, **Coral Island**, **Graveyard Keeper**.
  Fuentes: [PC Gamer](https://www.pcgamer.com/games/best-farm-sims-games-like-stardew-valley/), [GamesRadar](https://gamesradar.com/games-like-stardew-valley).

## Profesionales y tutoriales (cómo se dibuja una casa top-down)
- **Raymond Schlitter (Slynyrd)**: [Pixelblog 51 – City Builder](https://slynyrd.com/blog/2024/7/25/pixelblog-51-city-builder)
  (casas en rejilla de 16 px, vista a 45°, "no romper la base"), [Pixelblog 35 – Interiores](https://www.slynyrd.com/blog/2021/11/30/pixelblog-35-top-down-interiors),
  [catálogo completo](https://slynyrd.com/pixelblog-catalogue).
- **Pedro Medeiros (Saint11 / Studio Miniboss, TowerFall, Celeste)**: tutorial #65 "Top Down Houses" (7 pasos: caja → tejado grande →
  curvar líneas para perspectiva → puertas/ventanas → profundidad → luz y sombra → texturas; contorno un tono más oscuro que el vecino,
  nunca negro). Lista de tutoriales: [Studio Miniboss](https://blog.studiominiboss.com/pixelart), resumen en [blakecrosley.com](https://blakecrosley.com/es/blog/pixel-art-structures-on-iphone).
- **Seliel the Shaper (Mana Seed)**: estilo 16-bit de granja muy limpio; [Thatch Roof Home](https://seliel-the-shaper.itch.io/thatch-roof-home),
  [Farmer Sprite System](https://seliel-the-shaper.itch.io/farmer-base) (personaje 32 px, misma escala que la nuestra).
- **Octavi Navarro (Pixels Huh)**: ilustración, no sprites; útil para paleta y luz. [Behance](https://www.behance.net/onavarro).
- Estilo LPC (Liberated Pixel Cup): guía de proyección (~60°) para top-down.

## Packs de referencia (ver, no copiar; licencias distintas)
- [Cosy Cabin](https://marie-pepo.itch.io/cosy-cabin) (16 px, cottagecore, gratis con crédito).
- [Cozy top-down pack de choco-ted](https://choco-ted.itch.io/pixel-art-tileset-for-cozy-rpg-games) (16 px, casas cozy).
- [House sets CC0](https://opengameart.org/content/house-sets) (estilo Zelda), [Cozy asset pack 1.0 CC0](https://opengameart.org/comment/103659).
- [Pixel Art Top Down Tileset 24×24](https://dustdfg.itch.io/pixel-art-top-down-tileset) (CC-BY-SA, suelo; útil como medida de 24 px).

## Generación con IA local (candidatos)
- **SDXL + LoRA `pixel-art-xl`** (nerijs, HF, `pixel-art-xl.safetensors`, 171 MB, CreativeML OpenRAIL-M): genera rejilla de píxel
  regular; receta publicada = reducir ÷8 con vecino más cercano, 8 pasos, cfg 1.5, fuerza 1.2 (orientativo).
  [Repo](https://huggingface.co/nerijs/pixel-art-xl). **Descargado** (2026-10-13) en `F:\ComfyUI\ComfyUI_windows_portable\ComfyUI\models\loras\`.
- **LoRA Flux ya instalado:** `Top-Down_Pixel_Art_Flux_Lora_r1.safetensors` (misma carpeta); también `game_assets_v2.safetensors`.
- **Flux.1-dev (ya instalado)** con prompt "pixel art sprite… big chunky pixels" + detección de paso de rejilla: en prueba (`assets/gen/edificios/flux/`).
- **Descargados 2026-10-13 para el bake-off** (`assets/gen/bakeoff/`): `PixelArtRedmond-Lite64.safetensors` (SDXL, HF artificialguybr, trigger `Pixel Art, PixArFK`, 171 MB, OpenRAIL-M);
  pendiente que el usuario baje `Super_PixelArt_Sprite_XL_M_V1.safetensors` ([Civitai 579244](https://civitai.com/models/579244), 223 MB, "128 px pixel-perfect a 1024, ÷8", 5 pasos cfg 1).
- **pixel-art-fixer** (Retro Diffusion, MIT): detector de rejilla por votación + snapping por celda, clonado en `tools/ext/pixel-art-fixer/`
  ([GitHub](https://github.com/Retro-Diffusion/pixel-art-fixer)). Probado en el bake-off: mismo paso que `pixel_grid.py` en 16/18, acierta
  cuando `pixel_grid` coge el armónico; sin fase ni sombra → se usa como detector (`tools/pixel_fixer.py`) y `pixel_grid --pitch N` muestrea.
- **Resultado del bake-off (2026-10-13, `assets/gen/bakeoff/RESUMEN.md`)**: Flux + Top-Down LoRA gana (aislado, de frente, estilo);
  pixel-art-xl reserva para objetos pequeños con fondo gris; Redmond descartado. `Super_PixelArt_Sprite_XL` no se probó (no descargado).
- Otros vistos: Pixel Art Diffusion XL "Sprite Shaper" (checkpoint SDXL 6,46 GB, Civitai 277680, sin redistribución), Z-Image Turbo + LoRA pixel art oficial (Comfy-Org), LoRAs para Flux.2 Klein (Limbicnation), Flux Kontext Pixel-Style (Shakker).
- LoRAs de pixel art para Flux (menos probados): [deAPI-ai/pixelartdotfluxlora](https://huggingface.co/deAPI-ai/pixelartdotfluxlora), "Desimulate" (18 MB, TensorArt).

## Lo que ya sabemos que NO vale
- Edificios dibujados con primitivas de código (`tools/draw_edificios.py`, guardados en `assets/game/pixel/edificios/v1_dibujo/`): rechazados por el usuario.
- SDXL base sin LoRA: no da rejilla de píxel (ver `assets/gen/edificios/params.txt`).

## Modelos especializados en pixel art (investigación 2026-10-13, para RTX 3060 Ti 8 GB)
Conclusión: no hay checkpoint abierto entrenado a resolución nativa como Retro Diffusion (RD_FLUX, 256² nativo sobre FLUX,
datos curados por pixel artists, post-proceso propio) o PixelLab (PixFlux/BitForge/Pixen/Pro, cerrados). Todo lo descargable
genera a 512-1024 y se reduce ÷N; lo pixel-perfect lo pone el post-proceso. Candidatos por orden:
1. **pixel-party-xl** (PixelLab 2023, finetune SDXL completo, ~6,9 GB, openrail-m, [HF](https://huggingface.co/pixelparty/pixel-party-xl)):
   el único modelo público de PixelLab; canvas ~128 px, ÷8 nearest, 25 pasos, negativo "mixels".
2. **HaDeS PixelArt v6.0** (checkpoint Illustrious, 6,62 GiB, [Civitai 1732312](https://civitai.com/models/1732312)): tilesets/top-down/
   UI/assets; 512-768 sin hires, CFG 5, 30 pasos Euler a, clip skip 2, ÷8. Crédito obligatorio, sin derivados.
3. **Pixel Art Game UI Icons** (LoRA Illustrious, 218 MiB, [Civitai 2443581](https://civitai.com/models/2443581)): objetos aislados
   en blanco, 512→32 / 1024→64 (÷16), trigger `pixelarticon`.
4. **Limbicnation/pixel-art-lora** (LoRA Flux.2 Klein 4B, 310 MiB, Apache-2.0, [HF](https://huggingface.co/Limbicnation/pixel-art-lora)):
   salida RGBA transparente, 512², 4 pasos CFG 1; entrenada en personajes. Base Klein 4B fp8 ~4 GB + Qwen3 encoder.
5. **Nova Pixels XL v3** (checkpoint Illustrious, 6,46 GiB, [Civitai 1856313](https://civitai.com/models/1856313)): el más descargado 2025-26.
6. **tarn59 Pixel Art Style** (LoRA Z-Image Turbo, 162 MiB, [HF](https://huggingface.co/tarn59/pixel_art_style_lora_z_image_turbo)) + Z-Image Turbo GGUF Q4 ~6 GB.
7. svntax-dev `pixel_assets_general_ernie_v1` (ERNIE-Image-Turbo, items/edificios, jun-2026); Krea-2-Pixel-Art (Krea 2 Raw 12B, no cabe bien);
   Pixel Art Diffusion XL Sprite Shaper (2024, autor admite píxel imperfecto); MiaoMiao Pixel / Pixel Perfect v3 (personajes).
Post-proceso útil: Pixelate x8 VAE (SDXL, 163 MB, [Civitai 1492329](https://civitai.com/models/1492329)), pixel-art-fixer, PixelOE/k-centroid.
Descartados: PixelDiT (NVIDIA, no comercial, no es pixel art), SD-πXL (investigación), Qwen-Image LoRAs (20B, lento en 8 GB).
