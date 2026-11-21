// Golden-hour lighting for Port Solara: a gradient sky dome with a hazy sun, a low warm sun that
// casts long shadows (its shadow camera follows the player), a blue-sky / warm-sand hemisphere fill,
// and matching distance fog.
import * as THREE from 'three';

export const SUN_DIRECTION = new THREE.Vector3(-0.62, 0.36, 0.7).normalize();

const SKY_VERTEX = /* glsl */ `
varying vec3 vWorldDirection;
void main() {
  vWorldDirection = normalize((modelMatrix * vec4(position, 0.0)).xyz);
  vec4 clip = projectionMatrix * viewMatrix * modelMatrix * vec4(position, 1.0);
  gl_Position = clip.xyww;
}`;

const SKY_FRAGMENT = /* glsl */ `
uniform vec3 uZenith;
uniform vec3 uMid;
uniform vec3 uHorizon;
uniform vec3 uGlow;
uniform vec3 uSunDirection;
varying vec3 vWorldDirection;
void main() {
  vec3 dir = normalize(vWorldDirection);
  float height = clamp(dir.y, 0.0, 1.0);
  vec3 color = mix(uHorizon, uMid, smoothstep(0.0, 0.2, height));
  color = mix(color, uZenith, smoothstep(0.18, 0.75, height));
  float sunDot = max(dot(dir, uSunDirection), 0.0);
  color += uGlow * pow(sunDot, 6.0) * 0.55;
  color += vec3(1.0, 0.93, 0.78) * smoothstep(0.9985, 0.9995, sunDot) * 2.5;
  color = mix(color, uHorizon * 0.95, smoothstep(0.0, -0.2, dir.y));
  gl_FragColor = vec4(color, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

export function createSky() {
  const material = new THREE.ShaderMaterial({
    vertexShader: SKY_VERTEX,
    fragmentShader: SKY_FRAGMENT,
    uniforms: {
      uZenith: { value: new THREE.Color('#2a6fc9') },
      uMid: { value: new THREE.Color('#7fb8ea') },
      uHorizon: { value: new THREE.Color('#ffd3a3') },
      uGlow: { value: new THREE.Color('#ffb36b') },
      uSunDirection: { value: SUN_DIRECTION.clone() },
    },
    side: THREE.BackSide,
    depthWrite: false,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 16), material);
  sky.scale.setScalar(3000);
  sky.renderOrder = -1;
  sky.frustumCulled = false;
  sky.name = 'sky';
  return sky;
}

export class Lighting {
  constructor(scene) {
    this.sun = new THREE.DirectionalLight(0xffd9a8, 3.1);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    const span = 95;
    Object.assign(this.sun.shadow.camera, { left: -span, right: span, top: span, bottom: -span, near: 1, far: 600 });
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.6;
    this.hemisphere = new THREE.HemisphereLight(0x9cc8ff, 0xe8c9a0, 1.25);
    this.ambient = new THREE.AmbientLight(0xffe2c4, 0.25);
    scene.add(this.sun, this.sun.target, this.hemisphere, this.ambient);
    scene.fog = new THREE.Fog(0xf2d2b0, 220, 1100);
  }

  /** Keeps the shadow-casting region centred where the player is, snapped to texels to avoid shimmer. */
  follow(focus) {
    const snap = 1;
    const x = Math.round(focus.x / snap) * snap;
    const z = Math.round(focus.z / snap) * snap;
    this.sun.target.position.set(x, 0, z);
    this.sun.position.set(x + SUN_DIRECTION.x * 300, SUN_DIRECTION.y * 300, z + SUN_DIRECTION.z * 300);
  }
}
