// Bullet tracers (short-lived glowing streaks) and the flash of light a gunshot throws on its
// surroundings. The flash is one light that always exists, so firing never recompiles shaders.
import * as THREE from 'three';

const CAPACITY = 48;

export class Tracers {
  constructor(scene) {
    this.positions = new Float32Array(CAPACITY * 6);
    this.colors = new Float32Array(CAPACITY * 6);
    this.life = new Float32Array(CAPACITY);
    this.cursor = 0;
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3).setUsage(THREE.DynamicDrawUsage));
    geometry.setAttribute('color', new THREE.BufferAttribute(this.colors, 3).setUsage(THREE.DynamicDrawUsage));
    this.lines = new THREE.LineSegments(geometry, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    this.lines.frustumCulled = false;
    scene.add(this.lines);
    this.flash = new THREE.PointLight(0xffc070, 0, 9, 2);
    scene.add(this.flash);
    this.flashTime = 0;
  }

  add(from, to) {
    const i = this.cursor;
    this.cursor = (this.cursor + 1) % CAPACITY;
    this.positions.set([from.x, from.y, from.z, to.x, to.y, to.z], i * 6);
    this.life[i] = 0.08;
    this.colors.set([1, 0.85, 0.5, 1, 0.6, 0.2], i * 6);
  }

  muzzle(position) {
    this.flash.position.copy(position);
    this.flash.intensity = 12;
    this.flashTime = 0.05;
  }

  update(dt) {
    for (let i = 0; i < CAPACITY; i += 1) {
      if (this.life[i] <= 0) continue;
      this.life[i] -= dt;
      if (this.life[i] <= 0) this.colors.fill(0, i * 6, i * 6 + 6);
    }
    this.lines.geometry.attributes.position.needsUpdate = true;
    this.lines.geometry.attributes.color.needsUpdate = true;
    this.flashTime -= dt;
    if (this.flashTime <= 0) this.flash.intensity = 0;
  }
}
