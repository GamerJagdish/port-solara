// Pooled point-sprite particles: exhaust and tyre smoke, wreck smoke, fire, sparks, blood, muzzle
// flashes, explosions and the cash sparkle. Each pool is one draw call with per-particle colour and fade.
import * as THREE from 'three';
import { softDotTexture } from '../world/textures.js';

class ParticlePool {
  constructor(scene, { capacity, size, blending = THREE.NormalBlending, name }) {
    this.capacity = capacity;
    this.positions = new Float32Array(capacity * 3);
    this.colors = new Float32Array(capacity * 4);
    this.velocities = new Float32Array(capacity * 3);
    this.life = new Float32Array(capacity);
    this.maxLife = new Float32Array(capacity);
    this.base = new Float32Array(capacity * 4);
    this.gravity = new Float32Array(capacity);
    this.cursor = 0;
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3).setUsage(THREE.DynamicDrawUsage));
    geometry.setAttribute('color', new THREE.BufferAttribute(this.colors, 4).setUsage(THREE.DynamicDrawUsage));
    const material = new THREE.PointsMaterial({
      size,
      map: softDotTexture(),
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      blending,
      sizeAttenuation: true,
    });
    this.points = new THREE.Points(geometry, material);
    this.points.frustumCulled = false;
    this.points.name = name;
    for (let i = 0; i < capacity; i += 1) this.positions[i * 3 + 1] = -999;
    scene.add(this.points);
  }

  emit(x, y, z, vx, vy, vz, life, r, g, b, a, gravity = 0) {
    const i = this.cursor;
    this.cursor = (this.cursor + 1) % this.capacity;
    this.positions.set([x, y, z], i * 3);
    this.velocities.set([vx, vy, vz], i * 3);
    this.life[i] = life;
    this.maxLife[i] = life;
    this.base.set([r, g, b, a], i * 4);
    this.gravity[i] = gravity;
  }

  update(dt) {
    for (let i = 0; i < this.capacity; i += 1) {
      if (this.life[i] <= 0) continue;
      this.life[i] -= dt;
      const k = i * 3;
      if (this.life[i] <= 0) {
        this.positions[k + 1] = -999;
        this.colors[i * 4 + 3] = 0;
        continue;
      }
      this.velocities[k + 1] -= this.gravity[i] * dt;
      this.positions[k] += this.velocities[k] * dt;
      this.positions[k + 1] += this.velocities[k + 1] * dt;
      this.positions[k + 2] += this.velocities[k + 2] * dt;
      const t = this.life[i] / this.maxLife[i];
      const c = i * 4;
      this.colors[c] = this.base[c];
      this.colors[c + 1] = this.base[c + 1];
      this.colors[c + 2] = this.base[c + 2];
      this.colors[c + 3] = this.base[c + 3] * Math.min(1, t * 2.2);
    }
    this.points.geometry.attributes.position.needsUpdate = true;
    this.points.geometry.attributes.color.needsUpdate = true;
  }
}

export class Particles {
  constructor(scene, random) {
    this.random = random;
    this.smokePool = new ParticlePool(scene, { capacity: 700, size: 2.6, name: 'smoke' });
    this.glowPool = new ParticlePool(scene, { capacity: 600, size: 0.9, blending: THREE.AdditiveBlending, name: 'glow' });
    this.bigGlowPool = new ParticlePool(scene, { capacity: 200, size: 4.5, blending: THREE.AdditiveBlending, name: 'fireball' });
    this.debrisPool = new ParticlePool(scene, { capacity: 300, size: 0.35, name: 'debris' });
    this.flashPool = new ParticlePool(scene, { capacity: 60, size: 0.32, blending: THREE.AdditiveBlending, name: 'muzzle' });
    this.accumulators = new Map();
  }

  /** Emits `rate` particles a second through `emitFn`, carrying fractions between steps. */
  rate(key, rate, dt, emitFn) {
    const acc = (this.accumulators.get(key) ?? 0) + rate * dt;
    const count = Math.floor(acc);
    this.accumulators.set(key, acc - count);
    for (let k = 0; k < count; k += 1) emitFn();
  }

  jitter(amount) {
    return (this.random() - 0.5) * 2 * amount;
  }

  smoke(x, y, z, kind = 'light', dt = 1 / 60, key = null) {
    const dark = kind === 'dark';
    this.rate(key ?? `smoke:${Math.round(x)}:${Math.round(z)}:${kind}`, dark ? 22 : 12, dt, () => {
      const shade = dark ? 0.12 + this.random() * 0.1 : 0.75 + this.random() * 0.2;
      this.smokePool.emit(x + this.jitter(0.4), y, z + this.jitter(0.4), this.jitter(0.5), 1.4 + this.random(), this.jitter(0.5), 1.6 + this.random(), shade, shade, shade, dark ? 0.6 : 0.35, -0.3);
    });
  }

  tyreSmoke(x, z, intensity = 1) {
    if (this.random() > 0.35 * intensity) return;
    const shade = 0.85 + this.random() * 0.1;
    this.smokePool.emit(x + this.jitter(0.3), 0.3, z + this.jitter(0.3), this.jitter(0.6), 0.6 + this.random() * 0.6, this.jitter(0.6), 1.1 + this.random() * 0.8, shade, shade, shade, 0.3, -0.2);
  }

  dust(x, z) {
    this.smokePool.emit(x + this.jitter(0.3), 0.25, z + this.jitter(0.3), this.jitter(0.8), 0.5, this.jitter(0.8), 0.9, 0.85, 0.76, 0.6, 0.3, 0);
  }

  fire(x, y, z, dt) {
    this.rate(`fire:${Math.round(x)}:${Math.round(z)}`, 40, dt, () => {
      const heat = this.random();
      this.glowPool.emit(x + this.jitter(1), y + this.random() * 0.6, z + this.jitter(1), this.jitter(0.4), 2 + this.random() * 2, this.jitter(0.4), 0.5 + this.random() * 0.4, 1, 0.45 + heat * 0.4, 0.1, 0.9, -1);
    });
    this.rate(`flame:${Math.round(x)}:${Math.round(z)}`, 9, dt, () => {
      this.bigGlowPool.emit(x + this.jitter(0.8), y + 0.3, z + this.jitter(0.8), this.jitter(0.3), 1.6 + this.random(), this.jitter(0.3), 0.55 + this.random() * 0.3, 1, 0.42, 0.08, 0.55, -1);
    });
    this.smoke(x, y + 1.2, z, 'dark', dt * 0.6, `firesmoke:${Math.round(x)}:${Math.round(z)}`);
  }

  sparks(x, y, z, count = 10) {
    for (let k = 0; k < count; k += 1) {
      this.glowPool.emit(x, y, z, this.jitter(6), 1 + this.random() * 4, this.jitter(6), 0.3 + this.random() * 0.4, 1, 0.8, 0.35, 1, 14);
    }
  }

  blood(x, y, z) {
    for (let k = 0; k < 10; k += 1) this.debrisPool.emit(x, y, z, this.jitter(2), 1 + this.random() * 2, this.jitter(2), 0.5 + this.random() * 0.3, 0.6, 0.02, 0.04, 1, 12);
  }

  muzzleFlash(x, y, z) {
    for (let k = 0; k < 5; k += 1) this.flashPool.emit(x, y, z, this.jitter(3), this.jitter(1.5), this.jitter(3), 0.06, 1, 0.75, 0.3, 1, 0);
  }

  impact(x, y, z) {
    for (let k = 0; k < 5; k += 1) this.glowPool.emit(x, y, z, this.jitter(3), this.random() * 3, this.jitter(3), 0.2, 1, 0.9, 0.6, 1, 10);
    this.smokePool.emit(x, y, z, 0, 0.6, 0, 0.6, 0.8, 0.78, 0.72, 0.4, 0);
  }

  explosion(x, y, z) {
    for (let k = 0; k < 40; k += 1) {
      const heat = this.random();
      this.bigGlowPool.emit(x + this.jitter(1.5), y + this.random(), z + this.jitter(1.5), this.jitter(7), 2 + this.random() * 7, this.jitter(7), 0.5 + this.random() * 0.6, 1, 0.4 + heat * 0.5, 0.1, 1, 3);
    }
    for (let k = 0; k < 30; k += 1) {
      const shade = 0.1 + this.random() * 0.15;
      this.smokePool.emit(x + this.jitter(2), y + this.random() * 2, z + this.jitter(2), this.jitter(4), 2 + this.random() * 4, this.jitter(4), 2 + this.random() * 1.5, shade, shade, shade, 0.75, -0.5);
    }
    this.sparks(x, y, z, 30);
    for (let k = 0; k < 24; k += 1) this.debrisPool.emit(x, y + 0.5, z, this.jitter(10), 4 + this.random() * 8, this.jitter(10), 1.4, 0.15, 0.15, 0.15, 1, 16);
  }

  sparkle(x, y, z) {
    this.glowPool.emit(x + this.jitter(0.5), y + this.random() * 0.6, z + this.jitter(0.5), 0, 0.8, 0, 0.6, 0.5, 1, 0.55, 0.9, 0);
  }

  update(dt) {
    this.smokePool.update(dt);
    this.glowPool.update(dt);
    this.bigGlowPool.update(dt);
    this.debrisPool.update(dt);
    this.flashPool.update(dt);
  }
}
