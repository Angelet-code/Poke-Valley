// Preload: todas las imágenes (terreno, árboles, rocas, objetos pixel art, bayas, Bulbasaur).
/// <reference types="vite/client" />
import Phaser from 'phaser';
import { A, ARCANE, DIBUJO, ESPECIES, GALERIA, PELIPPER_DEX, REG, type AnimSet } from '../config';
import { L, precargar } from '../render/Dibujo';
import type { BayasData, ObjCatalog } from '../data/types';
import { Terrain } from '../render/Terrain';
import { BIOMAS, SUELO_BIOMA } from '../data/biomas';
import { SUELOS_CIUDAD } from '../data/ciudad';
import { TRABAJOS } from '../data/especies';
import { FORMAS } from '../data/pokedex';
import { PantallaCarga } from './carga';
import { EQUIPABLES } from '../combate/objetos';

export const TREE_N = 4, ROCK_N = 4;
// Hojas PMD con mapa de normales (tools/normales_pokemon.py: <Anim>-Normal.png y <Anim>-Luz.png, contorno teñido).
// En el mapa dibujo se cargan esas en lugar de -Anim.png, para que las farolas den volumen a los Pokémon (pipeline Cel).
const NORMALES = new Set(Object.keys(import.meta.glob('/assets/sprites/pokemon/*/*-Normal.png')).map(r => r.replace(/^.*pokemon\//, '').replace('-Normal.png', '')));

export class Preload extends Phaser.Scene {
  private carga: PantallaCarga | null = null;
  constructor() { super('preload'); }

  preload(): void {
    this.carga = new PantallaCarga(this);
    this.load.on('loaderror', (f: Phaser.Loader.File) => console.warn('No se pudo cargar', f.key, f.url));

    // Mapa en estilo dibujo: césped y arena del dibujo (sin calcomanías pixel) y sus elementos (SVG).
    if (DIBUJO) { const su = ARCANE ? 'suelo_arcane' : 'suelo'; Terrain.preload(this, A, { cesped: `${L}${su}/cesped_ref.png`, tierra: `${L}${su}/tierra_ref.png`, decals: false }); precargar(this, this.registry.get(REG.dibujo)); }
    else Terrain.preload(this, A);
    // Suelos de las zonas de bioma del modo aventura (data/biomas.ts): solo existen en estilo Arcane, se usan con los dos.
    for (const b of BIOMAS) for (const [k, f] of [['a', SUELO_BIOMA[b].a], ['b', SUELO_BIOMA[b].b]]) this.load.image(`suelo_${b}_${k}`, `${L}suelo_arcane/${b}/${f}.png`);
    // Pavimentos de la ciudad (data/ciudad.ts, MapaAventura.pavimentos): texturas repetibles.
    for (const t of SUELOS_CIUDAD) this.load.image(`ciudad_${t}`, `${L}suelo_arcane/ciudad/${t}.png`);
    for (let i = 0; i < TREE_N; i++) this.load.image('arbol' + i, `${A}game/arboles/arbol_${i}.png`);
    // Pantalla de título (Title.ts): césped de fondo y flores.
    this.load.image('tit-cesped', `${A}game/cesped_0.png`);
    for (const n of [0, 7, 18]) this.load.image('tit-flor' + n, `${A}game/flores_nuevas/flor_${n}.png`);
    // Modo aventura: el logo pixel y el claro Arcane del título ya los carga Boot (para esta pantalla de carga).
    for (let i = 0; i < ROCK_N; i++) this.load.image('roca' + i, `${A}game/rocas/roca_${i}.png`);

    const objs = this.registry.get(REG.objs) as ObjCatalog;
    for (const id in objs) {
      this.load.image('obj_' + id, `${A}game/pixel/${objs[id].archivo}`);
      if (objs[id].icono) this.load.image('icono_' + id, `${A}game/pixel/${objs[id].icono}`);
    }

    // Pociones (modo aventura): la de Klein con el tono girado (tools/iconos_pociones.py).
    for (const id of ['pocion', 'superpocion', 'hiperpocion', 'waterstone', 'thunderstone', 'firestone', 'leafstone', 'icestone']) this.load.image('icono_' + id, `${A}game/pixel/items/iconos/${id}.png`);
    // Objetos equipables (modo aventura, combate/objetos.ts): los iconos de Pokémon Colleja.
    for (const id in EQUIPABLES) this.load.image('icono_' + id, `${A}game/pixel/items/equipables/${id}.png`);
    this.load.image('icono_hogar',`${A}game/pixel/items/piedra_hogar.png`);   // piedra de hogar (tools/icono_hogar.py)
    this.load.image('marco_alfa', `${A}game/pixel/ui/aerodactyl_alfa.png`);   // adorno del marco de los alfas (HudAventura)
    const bayas = this.registry.get(REG.bayas) as BayasData, B = `${A}sprites/bayas/`;
    this.load.image('baya_tierra', B + bayas.tierra.png);
    this.load.spritesheet('baya_brote', B + bayas.brote.png, { frameWidth: bayas.brote.frame[0], frameHeight: bayas.brote.frame[1] });
    for (const [id, b] of Object.entries(bayas.bayas)) {
      this.load.spritesheet('baya_' + id, B + b.png, { frameWidth: bayas.arbol.frame[0], frameHeight: bayas.arbol.frame[1] });
      this.load.image('icono_' + id, B + b.icono);
    }

    const hoja = (key: string, dex: string, name: string, a: AnimSet) => {
      const ruta = `${A}sprites/pokemon/${dex}/${name}`, frameConfig = { frameWidth: a[name].fw, frameHeight: a[name].fh };
      if (DIBUJO && NORMALES.has(`${dex}/${name}`)) this.load.spritesheet({ key, url: `${ruta}-Luz.png`, normalMap: `${ruta}-Normal.png`, frameConfig });
      else this.load.spritesheet(key, `${ruta}-Anim.png`, frameConfig);
    };
    const anims = this.registry.get(REG.anims) as AnimSet;
    for (const name in anims) hoja('b-' + name, '0001', name, anims);
    const pel = this.registry.get(REG.pelipper) as AnimSet;
    for (const name of ['Walk', 'Idle']) if (pel[name]) hoja('pelipper-' + name, PELIPPER_DEX, name, pel);
    const aldeanos = this.registry.get(REG.animsAldeanos) as Record<string, AnimSet>;
    // Una entrada por forma (bidoof, bibarel…), con la carpeta de su número de Pokédex.
    for (const id in aldeanos) for (const name in aldeanos[id]) hoja(`${id}-${name}`, FORMAS[id]?.dex ?? ESPECIES[id]?.dex ?? id.slice(1), name, aldeanos[id]); // m<dex>: modo muestra
  }

  create(): void {
    // Pixel art a escala nativa: filtro NEAREST para que el zoom entero no lo emborrone.
    for (const key of this.textures.getTextureKeys()) {
      if (/^(obj_|baya_|icono_|b-|pelipper-)/.test(key) || Object.keys(this.registry.get(REG.animsAldeanos)).some(id => key.startsWith(id + '-'))) this.textures.get(key).setFilter(Phaser.Textures.FilterMode.NEAREST);
    }
    const anims = this.registry.get(REG.anims) as AnimSet;
    // Caminar: animación Walk. Quieto: primer fotograma de Idle (el resto es un saltito).
    for (let r = 0; r < 8; r++) {
      const w = anims.Walk, i = anims.Idle;
      this.anims.create({ key: `b-Walk-${r}`, repeat: -1, frames: w.durs.map((d, k) => ({ key: 'b-Walk', frame: r * w.durs.length + k, duration: d * 1000 / 60 })) });
      this.anims.create({ key: `b-Idle-${r}`, frames: [{ key: 'b-Idle', frame: r * i.durs.length }] });
    }
    if (anims.Sleep) this.anims.create({ key: 'b-Sleep', repeat: -1, frames: anims.Sleep.durs.map((d, k) => ({ key: 'b-Sleep', frame: k, duration: d * 1000 / 60 })) });
    // Aldeanos: andar, quieto (primer fotograma de Idle, como Bulbasaur), trabajar, comer y dormir.
    const aldeanos = this.registry.get(REG.animsAldeanos) as Record<string, AnimSet>;
    for (const id in aldeanos) {
      // Algunas hojas solo traen la fila de frente (Eat de Marill): si falta la dirección pedida, se usa la fila 0.
      const an = aldeanos[id], filas = (name: string) => Math.max(1, Math.round(this.textures.get(`${id}-${name}`).source[0].height / an[name].fh));
      const fr =(name: string, r: number) => an[name].durs.map((d, k) => ({ key: `${id}-${name}`, frame: (r < filas(name) ? r : 0) * an[name].durs.length + k, duration: d * 1000 / 60 }));
      for (let r = 0; r < 8; r++) {
        if (an.Walk) this.anims.create({ key: `${id}-Walk-${r}`, repeat: -1, frames: fr('Walk', r) });
        // Eat, o el golpe que tenga la especie (Punch, Attack…); si esta forma no lo tiene, el primero de TRABAJOS.
        const tr = [ESPECIES[FORMAS[id]?.linea ?? id]?.trabajo, ...TRABAJOS].find(n => n && an[n]) ?? '';
        if (an[tr]) this.anims.create({ key: `${id}-Trabajo-${r}`, repeat: -1, frames: fr(tr, r) });
        if (an.Idle) this.anims.create({ key: `${id}-Idle-${r}`, frames: [fr('Idle', r)[0]] });
        if (an.Idle) this.anims.create({ key: `${id}-Reposo-${r}`, repeat: -1, frames: fr('Idle', r) }); // Idle entero (humo de Gastly, respirar…)
        if (an.Eat) this.anims.create({ key: `${id}-Comer-${r}`, repeat: -1, frames: fr('Eat', r) }); // desayuno en el comedero
      }
      if (an.Sleep) this.anims.create({ key: `${id}-Sleep`, repeat: -1, frames: fr('Sleep', 0) });
    }
    // Pelipper: vuela (Walk) y se posa (Idle) en las 8 direcciones.
    const pel = this.registry.get(REG.pelipper) as AnimSet;
    for (const name of ['Walk', 'Idle']) if (pel[name] && this.textures.exists('pelipper-' + name)) for (let r = 0; r < 8; r++) {
      this.anims.create({ key: `pelipper-${name}-${r}`, repeat: -1, frames: pel[name].durs.map((d, k) => ({ key: 'pelipper-' + name, frame: r * pel[name].durs.length + k, duration: d * 1000 / 60 })) });
    }
    // Se sale cuando el Pokémon de la pantalla de carga llega al final de la barra.
    const ir = () => this.scene.start(GALERIA ? 'galeria' : 'title');
    if (this.carga) this.carga.alTerminar(ir); else ir();
  }
}
