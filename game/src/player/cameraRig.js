// The third-person camera. On foot it orbits Nico with the mouse and tucks over his shoulder to aim;
// in a car it trails behind as a chase camera that swings with the car, pulls back and widens with
// speed, lets the mouse look around for a moment, and looks behind on C. It never sinks into walls.
import * as THREE from 'three';
import { CAMERA } from '../core/config.js';
import { clamp, damp, dampAngle, wrapAngle } from '../core/mathUtils.js';

const SENSITIVITY = 0.0026;

export class CameraRig {
  constructor(game, camera) {
    this.game = game;
    this.camera = camera;
    this.yaw = 0;
    this.pitch = 0.18;
    this.carYawOffset = 0;
    this.carPitch = 0.2;
    this.mouseIdle = 10;
    this.distance = CAMERA.footDistance;
    this.target = new THREE.Vector3();
    this.lookDirection = { x: 0, z: 1 };
    this.shake = 0;
    this.fov = CAMERA.fov;
    this.override = null;
  }

  /** Points the camera along a heading at once (after spawning, entering a car or loading). */
  snapBehind(heading) {
    this.yaw = heading;
    this.carYawOffset = 0;
  }

  addShake(amount) {
    this.shake = Math.min(1, this.shake + amount);
  }

  update(dt, input) {
    const look = input.takeLook();
    const player = this.game.player;
    const collision = this.game.city.collision;
    if (this.override) {
      this.override(this.camera, dt);
      this.updateLookDirection();
      return;
    }
    const moved = Math.abs(look.x) + Math.abs(look.y) > 0;
    this.mouseIdle = moved ? 0 : this.mouseIdle + dt;
    let targetDistance;
    let height;
    let shoulder = 0;
    let fovTarget = CAMERA.fov;

    if (player.vehicle) {
      const vehicle = player.vehicle;
      this.carYawOffset = wrapAngle(this.carYawOffset - look.x * SENSITIVITY);
      this.carPitch = clamp(this.carPitch + look.y * SENSITIVITY, -0.1, 0.9);
      if (this.mouseIdle > 1.6) {
        this.carYawOffset = damp(this.carYawOffset, 0, 2.2, dt);
        this.carPitch = damp(this.carPitch, 0.2, 2, dt);
      }
      const behind = input.isDown('KeyC') ? Math.PI : 0;
      // Follow the direction of travel when sliding, the nose otherwise.
      const moving = Math.abs(vehicle.forwardSpeed) > 2;
      const travel = vehicle.forwardSpeed < -2 ? vehicle.heading : moving ? Math.atan2(vehicle.vel.x, vehicle.vel.z) : vehicle.heading;
      const base = moving && vehicle.forwardSpeed > 0 ? dampAngle(vehicle.heading, travel, 0.5, 1) : vehicle.heading;
      this.yaw = dampAngle(this.yaw, base + this.carYawOffset + behind, behind ? 30 : 5, dt);
      if (behind) this.yaw = base + Math.PI + this.carYawOffset;
      this.pitch = this.carPitch;
      const speed = vehicle.speed;
      targetDistance = CAMERA.carDistance + vehicle.type.length * 0.4 + Math.min(speed, 45) * 0.07;
      height = CAMERA.carHeight * 0.5 + vehicle.type.height * 0.6;
      fovTarget = CAMERA.fov + Math.min(speed, 50) * 0.32;
      this.target.set(vehicle.pos.x, vehicle.pos.y + height, vehicle.pos.z);
    } else {
      this.yaw = wrapAngle(this.yaw - look.x * SENSITIVITY);
      this.pitch = clamp(this.pitch + look.y * SENSITIVITY, -0.45, 1.25);
      // Without mouse capture, drift the camera behind the direction of travel.
      if (!input.locked && player.speed > 1 && this.mouseIdle > 0.6) this.yaw = dampAngle(this.yaw, player.heading, 1.6, dt);
      targetDistance = player.aiming ? 3.3 : CAMERA.footDistance;
      shoulder = player.aiming ? 1.0 : 0.35;
      fovTarget = player.aiming ? CAMERA.fov - 8 : CAMERA.fov;
      this.target.set(player.pos.x, player.pos.y + CAMERA.footHeight - (player.dead ? 1.2 : 0), player.pos.z);
    }

    this.distance = damp(this.distance, targetDistance, 4, dt);
    this.fov = damp(this.fov, fovTarget, 4, dt);
    const fx = Math.sin(this.yaw);
    const fz = Math.cos(this.yaw);
    const rx = -fz;
    const rz = fx;
    const horizontal = Math.cos(this.pitch);
    // Keep the camera on this side of walls between it and its subject.
    const back = { x: -fx, z: -fz };
    let reach = this.distance * horizontal;
    const hit = collision.raycast(this.target.x, this.target.z, back.x, back.z, reach + 0.6, 3);
    if (hit < reach + 0.6) reach = Math.max(0.8, hit - 0.6);
    const scale = reach / (this.distance * horizontal || 1);
    const pos = this.camera.position;
    pos.set(
      this.target.x - fx * reach + rx * shoulder,
      Math.max(0.6, this.target.y + Math.sin(this.pitch) * this.distance * scale + (player.vehicle ? 0 : 0.1)),
      this.target.z - fz * reach + rz * shoulder,
    );
    if (this.shake > 0) {
      const t = this.game.time * 60;
      pos.x += Math.sin(t * 1.3) * this.shake * 0.25;
      pos.y += Math.sin(t * 1.7) * this.shake * 0.2;
      this.shake = Math.max(0, this.shake - dt * 2.5);
    }
    const lookAhead = player.vehicle ? 2.5 : 0;
    this.camera.lookAt(this.target.x + fx * lookAhead + rx * shoulder, this.target.y - (player.vehicle ? 0.6 : 0), this.target.z + fz * lookAhead + rz * shoulder);
    if (Math.abs(this.camera.fov - this.fov) > 0.01) {
      this.camera.fov = this.fov;
      this.camera.updateProjectionMatrix();
    }
    this.updateLookDirection();
  }

  updateLookDirection() {
    const dir = new THREE.Vector3();
    this.camera.getWorldDirection(dir);
    const length = Math.hypot(dir.x, dir.z) || 1;
    this.lookDirection = { x: dir.x / length, z: dir.z / length, y: dir.y };
  }

  /** The aim ray through the centre of the screen. */
  aimRay() {
    const dir = new THREE.Vector3();
    this.camera.getWorldDirection(dir);
    return { origin: this.camera.position.clone(), dir };
  }
}
