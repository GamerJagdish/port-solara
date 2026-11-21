// One car in the world: its model, physical state, controls, health and who is driving it. Physics
// lives in vehiclePhysics.js and AI drivers set `controls`; this class keeps the model in step with
// the simulation (wheel spin and steer, brake lights, body roll, the police light bar, smoke and fire).
import * as THREE from 'three';
import { VEHICLE_TYPES } from './vehicleTypes.js';
import { createVehicleModel } from './vehicleModels.js';
import { clamp, damp } from '../core/mathUtils.js';

let nextId = 1;

export class Vehicle {
  constructor(game, typeKey, { x, z, heading = 0, paint = null, role = 'traffic' }) {
    this.id = nextId++;
    this.game = game;
    this.typeKey = typeKey;
    this.type = VEHICLE_TYPES[typeKey];
    this.paint = paint ?? game.dice.pick(this.type.paints);
    this.model = createVehicleModel(this.type, this.paint);
    this.mesh = this.model.root;
    this.mesh.userData.vehicle = this;
    this.pos = new THREE.Vector3(x, 0, z);
    this.heading = heading;
    this.vel = { x: 0, z: 0 };
    this.forwardSpeed = 0;
    this.lateralSpeed = 0;
    this.steerAngle = 0;
    this.wheelSpin = 0;
    this.roll = 0;
    this.pitch = 0;
    this.controls = { throttle: 0, brake: 0, steer: 0, handbrake: false };
    this.health = this.type.health;
    this.destroyed = false;
    this.burning = 0;
    this.driver = null;
    this.role = role;
    this.ai = null;
    this.sirenOn = false;
    this.skidding = false;
    this.lastImpactTime = -10;
    this.parkedSlot = null;
    this.persistent = false;
    this.lastDamager = null;
    this.syncMesh(0, 0);
  }

  get speed() {
    return Math.hypot(this.vel.x, this.vel.z);
  }

  get halfLength() {
    return this.type.length / 2;
  }

  get radius() {
    return this.type.width / 2;
  }

  get isPolice() {
    return Boolean(this.type.police);
  }

  /** The circles (centre offsets along the car) used for collisions. */
  collisionOffsets() {
    const reach = this.type.length / 2 - this.type.width / 2;
    return [-reach, 0, reach];
  }

  forward() {
    return { x: Math.sin(this.heading), z: Math.cos(this.heading) };
  }

  /** Where someone stands to get in on the driver's (left) side. */
  doorPosition() {
    const f = this.forward();
    const side = this.type.width / 2 + 0.7;
    return { x: this.pos.x + Math.cos(this.heading) * side + f.x * 0.3, z: this.pos.z - Math.sin(this.heading) * side + f.z * 0.3 };
  }

  damage(amount, source = null) {
    if (this.destroyed) return;
    this.health -= amount;
    if (source) this.lastDamager = source;
    if (this.health <= 0) this.game.events.emit('vehicle:destroyed', { vehicle: this, source: this.lastDamager });
  }

  syncMesh(dt, time) {
    this.mesh.position.set(this.pos.x, this.pos.y, this.pos.z);
    const accel = dt > 0 ? clamp((this.forwardSpeed - (this.prevForward ?? this.forwardSpeed)) / dt, -30, 30) : 0;
    this.prevForward = this.forwardSpeed;
    this.roll = damp(this.roll, clamp(-this.lateralSpeed * 0.02 + this.steerAngle * this.forwardSpeed * 0.004, -0.08, 0.08), 6, dt || 1);
    this.pitch = damp(this.pitch, clamp(-accel * 0.003, -0.05, 0.05), 5, dt || 1);
    this.mesh.rotation.set(this.pitch, this.heading, this.roll, 'YXZ');
    this.wheelSpin += (this.forwardSpeed / this.type.wheel) * dt;
    for (const wheel of this.model.wheels) {
      wheel.spin.rotation.x = this.wheelSpin;
      if (wheel.front) wheel.pivot.rotation.y = -this.steerAngle;
    }
    const braking = this.controls.brake > 0.1 && this.forwardSpeed > 0.5;
    this.model.rearMaterial.color.setHex(braking || this.controls.handbrake ? 0xff2a2a : 0x8a1010);
    if (this.model.lightbar) {
      const on = this.sirenOn && !this.destroyed;
      const phase = Math.floor(time * 6) % 2 === 0;
      this.model.lightbar.red.color.setHex(on && phase ? 0xff2020 : 0x550000);
      this.model.lightbar.blue.color.setHex(on && !phase ? 0x2a6bff : 0x000055);
    }
  }

  /** Blackens a wrecked car. */
  markWrecked() {
    this.destroyed = true;
    this.health = 0;
    const charred = new THREE.MeshStandardMaterial({ color: 0x1d1b1a, roughness: 1 });
    this.model.body.material = charred;
    this.model.glass.material = charred;
    this.model.front.visible = false;
    this.model.rear.visible = false;
    this.sirenOn = false;
  }

  /** Takes the car out of the scene and frees the materials that belong to it alone. */
  dispose(scene) {
    scene.remove(this.mesh);
    this.model.rearMaterial.dispose();
    if (this.model.lightbar) {
      this.model.lightbar.red.dispose();
      this.model.lightbar.blue.dispose();
    }
    if (this.destroyed) this.model.body.material.dispose();
  }
}
