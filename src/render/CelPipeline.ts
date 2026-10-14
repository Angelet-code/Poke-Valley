// Pipeline «cel» (anime): la misma luz Light2D de Phaser, pero el difuso del normal map se corta en bandas
// (sombra, medio, luz) en vez de degradarse; así el borde de la sombra es duro y cada faceta se nota.
// Lo usan la demo /normales.html (src/paginas/normales.ts) y el modo noche del lab (?noche=1).
// Altura, bandas, umbral y suavidad son por luz: una luz Light2D con campo `cel` (TipoLuz de luces.ts) manda los suyos;
// las demás usan los valores del pipeline (bandas, umbral, altura, suave).
import Phaser from 'phaser';
import type { TipoLuz } from './luces';

const CEL_FS = `
#define SHADER_NAME CEL_LIGHT_FS
precision mediump float;
struct Light { vec2 position; vec3 color; float intensity; float radius; };
const int kMaxLights = %LIGHT_COUNT%;
uniform vec4 uCamera; uniform vec2 uResolution; uniform sampler2D uMainSampler; uniform sampler2D uNormSampler;
uniform vec3 uAmbientLightColor; uniform Light uLights[kMaxLights]; uniform mat3 uInverseRotationMatrix; uniform int uLightCount;
uniform float uBandas[kMaxLights]; uniform float uUmbral[kMaxLights]; uniform float uAltura[kMaxLights]; uniform float uSuave[kMaxLights]; uniform float uGanancia;
varying vec2 outTexCoord; varying float outTintEffect; varying vec4 outTint;
void main () {
  vec3 finalColor = vec3(0.0);
  vec4 texel = vec4(outTint.bgr * outTint.a, outTint.a);
  vec4 texture = texture2D(uMainSampler, outTexCoord);
  vec4 color = texture * texel;
  if (outTintEffect == 1.0) color.rgb = mix(texture.rgb, outTint.bgr * outTint.a, texture.a);
  else if (outTintEffect == 2.0) color = texel;
  vec3 normalMap = texture2D(uNormSampler, outTexCoord).rgb;
  vec3 normal = normalize(uInverseRotationMatrix * vec3(normalMap * 2.0 - 1.0));
  vec2 res = vec2(min(uResolution.x, uResolution.y)) * uCamera.w;
  for (int i = 0; i < kMaxLights; ++i) {
    if (i < uLightCount) {
      Light light = uLights[i];
      float altura = uAltura[i], bandas = uBandas[i], umbral = uUmbral[i], suave = uSuave[i];
      vec3 lightDir = vec3((light.position.xy / res) - (gl_FragCoord.xy / res), altura); // altura: más alta = luz más frontal, menos sombra
      vec3 lightNormal = normalize(lightDir);
      float distToSurf = length(lightDir.xy) * uCamera.w; // solo en el plano: la altura no acorta el radio (Phaser suma su 0.1, aquí sería mucho)
      float d = max(dot(normal, lightNormal), 0.0);
      // cel: escalones. uUmbral desplaza el corte sombra/luz; uBandas = número de niveles.
      // cel con transición: cada escalón se cruza con un smoothstep de anchura uSuave (0 = corte seco).
      float v = clamp(d + umbral, 0.0, 0.999) * bandas;
      float base = floor(v);
      float sv = max(suave * 0.5, 0.002); // suave 0 = corte seco; con los dos bordes iguales smoothstep es indefinido (salía negro)
      float cel = (base + smoothstep(0.5 - sv, 0.5 + sv, fract(v))) / (bandas - 1.0);
      cel = min(cel, 1.0);
      float radius = (light.radius / res.x * uCamera.w) * uCamera.w;
      float att = clamp(1.0 - distToSurf * distToSurf / (radius * radius), 0.0, 1.0);
      att = smoothstep(0.0, 0.35, att); // casi plana dentro del radio, sin corte seco en el borde
      finalColor += att * light.color * cel * light.intensity * uGanancia;
    }
  }
  vec4 colorOutput = vec4(uAmbientLightColor + finalColor, 1.0);
  gl_FragColor = color * vec4(colorOutput.rgb * colorOutput.a, colorOutput.a);
}`;

export class CelPipeline extends Phaser.Renderer.WebGL.Pipelines.LightPipeline {
  bandas = 3; umbral = 0.15; altura = 0.35; suave = 0.5;
  ganancia = 1;   // cuánto de la luz llega al sprite (el cel con su atenuación plana quema un sprite claro bajo una farola)
  constructor(game: Phaser.Game) { super({ game, fragShader: CEL_FS } as Phaser.Types.Renderer.WebGL.WebGLPipelineConfig); }
  private arr = { bandas: new Float32Array(0), umbral: new Float32Array(0), altura: new Float32Array(0), suave: new Float32Array(0) };
  onBind(go?: Phaser.GameObjects.GameObject): void { super.onBind(go); this.set1f('uGanancia', this.ganancia); }
  // Tras subir las luces de Phaser, sus parámetros cel: los del tipo de la luz (`cel`) o los del pipeline.
  onRender(scene: Phaser.Scene, camera: Phaser.Cameras.Scene2D.Camera): void {
    super.onRender(scene, camera);
    if (!this.lightsActive) return;
    const luces = scene.lights.getLights(camera) as unknown as { light: Phaser.GameObjects.Light & { cel?: TipoLuz } }[], n = (this.renderer.config as { maxLights: number }).maxLights, a = this.arr; // kMaxLights del shader
    if (a.bandas.length !== n) a.bandas = new Float32Array(n), a.umbral = new Float32Array(n), a.altura = new Float32Array(n), a.suave = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const c = luces[i]?.light.cel;
      a.bandas[i] = c?.bandas ?? this.bandas; a.umbral[i] = c?.umbral ?? this.umbral; a.altura[i] = c?.altura ?? this.altura; a.suave[i] = c?.suave ?? this.suave;
    }
    this.set1fv('uBandas', a.bandas); this.set1fv('uUmbral', a.umbral); this.set1fv('uAltura', a.altura); this.set1fv('uSuave', a.suave);
  }
}

// Registra el pipeline «Cel» en el renderizador (una vez) y lo devuelve.
export function pipelineCel(scene: Phaser.Scene): CelPipeline {
  const pipes = (scene.renderer as Phaser.Renderer.WebGL.WebGLRenderer).pipelines;
  if (!pipes.has('Cel')) pipes.add('Cel', new CelPipeline(scene.game));
  return pipes.get('Cel') as CelPipeline;
}
