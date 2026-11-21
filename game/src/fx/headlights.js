// The headlight beams of the car Nico drives: one spotlight pair that always exists (so getting in
// and out never recompiles shaders) and is switched on and aimed down the road while he drives.
import * as THREE from 'three';

export class Headlights {
  constructor(scene) {
    this.light = new THREE.SpotLight(0xfff1d6, 0, 46, 0.42, 0.55, 1.2);
    this.light.castShadow = false;
    scene.add(this.light, this.light.target);
  }

  update(vehicle) {
    if (!vehicle || vehicle.destroyed) {
      this.light.intensity = 0;
      return;
    }
    const f = vehicle.forward();
    this.light.intensity = 45;
    this.light.position.set(vehicle.pos.x + f.x * vehicle.halfLength, 0.9, vehicle.pos.z + f.z * vehicle.halfLength);
    this.light.target.position.set(vehicle.pos.x + f.x * 22, 0, vehicle.pos.z + f.z * 22);
  }
}
