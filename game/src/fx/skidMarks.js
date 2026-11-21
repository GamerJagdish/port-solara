// Tyre marks: while a car slides, its rear wheels lay dark quads on the road from a ring buffer, so
// marks persist across the city until newer ones replace them.
import * as THREE from 'three';

const CAPACITY = 2400;

export class SkidMarks {
  constructor(scene) {
    this.positions = new Float32Array(CAPACITY * 6 * 3);
    this.alphas = new Float32Array(CAPACITY * 6);
    this.cursor = 0;
    this.last = new Map();
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3).setUsage(THREE.DynamicDrawUsage));
    geometry.setAttribute('alpha', new THREE.BufferAttribute(this.alphas, 1).setUsage(THREE.DynamicDrawUsage));
    const material = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -4,
      polygonOffsetUnits: -4,
      vertexShader: 'attribute float alpha; varying float vAlpha; void main() { vAlpha = alpha; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: 'varying float vAlpha; void main() { gl_FragColor = vec4(0.08, 0.08, 0.09, vAlpha); }',
    });
    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.frustumCulled = false;
    this.mesh.name = 'skid-marks';
    scene.add(this.mesh);
  }

  /** Continues (or starts) the mark under one wheel. */
  mark(key, x, y, z, strength = 0.55) {
    const previous = this.last.get(key);
    this.last.set(key, { x, z, y });
    if (!previous) return;
    const dx = x - previous.x;
    const dz = z - previous.z;
    const length = Math.hypot(dx, dz);
    if (length < 0.05 || length > 3) return;
    const w = 0.13;
    const nx = (-dz / length) * w;
    const nz = (dx / length) * w;
    const h = y + 0.03;
    const quad = [
      previous.x - nx, h, previous.z - nz,
      previous.x + nx, h, previous.z + nz,
      x + nx, h, z + nz,
      previous.x - nx, h, previous.z - nz,
      x + nx, h, z + nz,
      x - nx, h, z - nz,
    ];
    const i = this.cursor;
    this.cursor = (this.cursor + 1) % CAPACITY;
    this.positions.set(quad, i * 18);
    this.alphas.fill(strength, i * 6, i * 6 + 6);
    this.mesh.geometry.attributes.position.needsUpdate = true;
    this.mesh.geometry.attributes.alpha.needsUpdate = true;
  }

  /** Lifts the wheel: the next mark starts a new stripe. */
  release(key) {
    this.last.delete(key);
  }

  /** Lays or lifts marks for every car's rear wheels this step. */
  update(vehicles, particles) {
    for (const vehicle of vehicles) {
      const f = vehicle.forward();
      const rx = -f.z;
      const rz = f.x;
      const back = vehicle.halfLength - 0.85;
      for (const side of [-1, 1]) {
        const key = `${vehicle.id}:${side}`;
        if (vehicle.skidding) {
          const x = vehicle.pos.x - f.x * back + rx * side * (vehicle.radius - 0.15);
          const z = vehicle.pos.z - f.z * back + rz * side * (vehicle.radius - 0.15);
          this.mark(key, x, vehicle.pos.y, z);
          particles.tyreSmoke(x, z, Math.min(1.5, Math.abs(vehicle.lateralSpeed) / 6 + 0.4));
        } else {
          this.release(key);
        }
      }
    }
  }
}
