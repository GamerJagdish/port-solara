// Nico on foot and at the wheel: walking and sprinting relative to the camera, jumping, bumping off
// walls and cars, getting into any car with F (pulling the driver out if there is one), driving it,
// and climbing out again. Health, armour, death and arrest are tracked here; weapons in combat/.
import * as THREE from 'three';
import { PLAYER } from '../core/config.js';
import { createHuman, animateHuman } from '../peds/humanModel.js';
import { PROTAGONIST } from './playerLook.js';
import { clamp, dampAngle } from '../core/mathUtils.js';
import { groundHeightAt } from '../world/groundHeight.js';
import { CivilianBrain } from '../peds/civilianBrain.js';

export class Player {
  constructor(game) {
    this.game = game;
    this.rig = createHuman(PROTAGONIST.look);
    this.mesh = this.rig.root;
    game.scene.add(this.mesh);
    this.pos = new THREE.Vector3(0, 0, 0);
    this.heading = 0;
    this.vel = { x: 0, z: 0 };
    this.vy = 0;
    this.airborne = false;
    this.health = PLAYER.maxHealth;
    this.armor = 0;
    this.vehicle = null;
    this.dead = false;
    this.deadTime = 0;
    this.fallen = 0;
    this.entering = null;
    this.punch = 0;
    this.aiming = false;
    this.aimPitch = 0;
    this.hurtFlash = 0;
    this.arrestTimer = 0;
    this.invulnerable = 0;
  }

  get speed() {
    return this.vehicle ? this.vehicle.speed : Math.hypot(this.vel.x, this.vel.z);
  }

  /** Where the player is, whether on foot or in a car. */
  get focus() {
    return this.vehicle ? this.vehicle.pos : this.pos;
  }

  placeAt(x, z, heading = 0) {
    this.pos.set(x, groundHeightAt(x, z), z);
    this.heading = heading;
    this.vel.x = 0;
    this.vel.z = 0;
    this.mesh.visible = true;
  }

  hurt(amount, source, fromX = null, fromZ = null) {
    if (this.dead || this.invulnerable > 0) return;
    const absorbed = Math.min(this.armor, amount * 0.7);
    this.armor -= absorbed;
    this.health -= amount - absorbed;
    this.hurtFlash = 0.25;
    this.lastHurtFrom = fromX !== null ? { x: fromX, z: fromZ } : null;
    this.game.events.emit('player:hurt', { amount, source });
    if (this.health <= 0) {
      this.health = 0;
      this.dead = true;
      this.deadTime = 0;
      if (this.vehicle) this.exitVehicle(true);
      this.game.events.emit('player:died', { source });
    }
  }

  heal(amount) {
    this.health = Math.min(PLAYER.maxHealth, this.health + amount);
  }

  /** The nearest car within reach of the player's hands, if any. */
  nearestEnterable() {
    let best = null;
    let bestD = PLAYER.enterRange + 1.4;
    for (const vehicle of this.game.vehicles.list) {
      if (vehicle.destroyed) continue;
      const d = Math.hypot(vehicle.pos.x - this.pos.x, vehicle.pos.z - this.pos.z) - vehicle.radius;
      if (d < bestD) {
        bestD = d;
        best = vehicle;
      }
    }
    return best;
  }

  /** Starts getting into a car: walk to the door, pull out any driver, then sit. */
  beginEnter(vehicle) {
    this.entering = { vehicle, time: 0 };
    // A civilian driver freezes when someone goes for the door.
    if (vehicle.ai && vehicle.ai.holdFor) vehicle.ai.holdFor(2.5);
  }

  enterVehicle(vehicle) {
    const game = this.game;
    if (vehicle.driver && vehicle.driver !== 'player') {
      const door = vehicle.doorPosition();
      const look = vehicle.isPolice ? null : game.peds.randomLook();
      const thrown = game.peds.add({ x: door.x, z: door.z, heading: vehicle.heading, look: look ?? game.police.officerLook(), role: vehicle.isPolice ? 'officer' : 'civilian', brain: new CivilianBrain(game, { ring: null }) });
      thrown.brain.scare(thrown, vehicle.pos.x, vehicle.pos.z, 9);
      thrown.knockTime = 1.0;
      game.events.emit('crime:carjack', { vehicle, victim: thrown });
    } else if (vehicle.role === 'parked') {
      game.events.emit('crime:theft', { vehicle });
    }
    if (vehicle.ai && vehicle.ai.onRemoved) vehicle.ai.onRemoved();
    vehicle.ai = null;
    vehicle.driver = 'player';
    vehicle.sirenOn = false;
    if (vehicle.role !== 'mission') vehicle.role = 'player';
    vehicle.persistent = true;
    this.vehicle = vehicle;
    this.mesh.visible = false;
    this.entering = null;
    game.events.emit('player:entered', { vehicle });
  }

  exitVehicle(forced = false) {
    const vehicle = this.vehicle;
    if (!vehicle) return;
    if (!forced && vehicle.speed > 6) return;
    const door = vehicle.doorPosition();
    const spot = { x: door.x, z: door.z };
    this.game.city.collision.resolveCircle(spot, PLAYER.radius);
    this.placeAt(spot.x, spot.z, vehicle.heading);
    vehicle.driver = null;
    vehicle.controls.throttle = 0;
    vehicle.controls.steer = 0;
    vehicle.controls.handbrake = false;
    if (vehicle.role === 'player') vehicle.role = 'abandoned';
    this.vehicle = null;
    this.game.events.emit('player:exited', { vehicle });
  }

  update(dt, input, cameraYaw) {
    this.hurtFlash = Math.max(0, this.hurtFlash - dt);
    this.invulnerable = Math.max(0, this.invulnerable - dt);
    this.punch = Math.max(0, this.punch - dt * 2.8);
    if (this.dead) {
      this.deadTime += dt;
      this.fallen = Math.min(1, this.fallen + dt * 4);
      this.syncMesh(dt);
      return;
    }
    this.fallen = Math.max(0, this.fallen - dt * 3);
    if (this.vehicle) {
      this.drive(dt, input);
      this.pos.copy(this.vehicle.pos);
      return;
    }
    if (this.entering) {
      this.updateEntering(dt);
      this.syncMesh(dt);
      return;
    }
    this.walk(dt, input, cameraYaw);
    if (input.wasPressed('KeyF')) {
      const vehicle = this.nearestEnterable();
      if (vehicle) this.beginEnter(vehicle);
    }
    this.syncMesh(dt);
  }

  updateEntering(dt) {
    const { vehicle } = this.entering;
    this.entering.time += dt;
    const door = vehicle.doorPosition();
    const dx = door.x - this.pos.x;
    const dz = door.z - this.pos.z;
    const d = Math.hypot(dx, dz);
    if (vehicle.destroyed || this.entering.time > 2.5) {
      this.entering = null;
      return;
    }
    if (d > 0.35) {
      const step = Math.min(d, PLAYER.sprintSpeed * dt);
      this.vel.x = (dx / d) * PLAYER.sprintSpeed;
      this.vel.z = (dz / d) * PLAYER.sprintSpeed;
      this.pos.x += (dx / d) * step;
      this.pos.z += (dz / d) * step;
      this.heading = dampAngle(this.heading, Math.atan2(dx, dz), 14, dt);
      // A moving car pulls away from a would-be thief.
      if (vehicle.speed > 9 && this.entering.time > 0.8) this.entering = null;
      return;
    }
    this.enterVehicle(vehicle);
  }

  walk(dt, input, cameraYaw) {
    const axis = input.axis();
    const sprint = input.isDown('ShiftLeft') || input.isDown('ShiftRight');
    const maxSpeed = this.aiming ? PLAYER.walkSpeed * 0.7 : sprint ? PLAYER.sprintSpeed : PLAYER.walkSpeed;
    // Camera-relative: forward is where the camera looks.
    const fx = Math.sin(cameraYaw);
    const fz = Math.cos(cameraYaw);
    let mx = fx * axis.forward - fz * axis.right;
    let mz = fz * axis.forward + fx * axis.right;
    const length = Math.hypot(mx, mz);
    if (length > 1) {
      mx /= length;
      mz /= length;
    }
    const tx = mx * maxSpeed;
    const tz = mz * maxSpeed;
    const blend = 1 - Math.exp(-PLAYER.accel * dt / maxSpeed);
    this.vel.x += (tx - this.vel.x) * blend;
    this.vel.z += (tz - this.vel.z) * blend;
    this.pos.x += this.vel.x * dt;
    this.pos.z += this.vel.z * dt;
    if (this.aiming) this.heading = dampAngle(this.heading, cameraYaw, 18, dt);
    else if (length > 0.1) this.heading = dampAngle(this.heading, Math.atan2(mx, mz), 12, dt);

    const floor = groundHeightAt(this.pos.x, this.pos.z);
    if (!this.airborne && input.wasPressed('Space')) {
      this.vy = PLAYER.jumpSpeed;
      this.airborne = true;
    }
    if (this.airborne) {
      this.vy -= PLAYER.gravity * dt;
      this.pos.y += this.vy * dt;
      if (this.pos.y <= floor) {
        this.pos.y = floor;
        this.airborne = false;
        this.vy = 0;
      }
    } else {
      this.pos.y = floor;
    }
    this.game.city.collision.resolveCircle(this.pos, PLAYER.radius, this.pos.y + 0.5);
    this.collideWithVehicles();
  }

  /** Cars are solid to walk into; a fast car that hits the player hurts. */
  collideWithVehicles() {
    for (const vehicle of this.game.vehicles.list) {
      const dx = this.pos.x - vehicle.pos.x;
      const dz = this.pos.z - vehicle.pos.z;
      if (Math.abs(dx) > 6 || Math.abs(dz) > 6) continue;
      const f = vehicle.forward();
      const ahead = dx * f.x + dz * f.z;
      const side = dx * -f.z + dz * f.x;
      const hl = vehicle.halfLength + PLAYER.radius;
      const hw = vehicle.radius + PLAYER.radius;
      if (Math.abs(ahead) >= hl || Math.abs(side) >= hw) continue;
      const pushAhead = hl - Math.abs(ahead);
      const pushSide = hw - Math.abs(side);
      if (pushSide < pushAhead) {
        const s = Math.sign(side) || 1;
        this.pos.x += -f.z * s * pushSide;
        this.pos.z += f.x * s * pushSide;
      } else {
        const s = Math.sign(ahead) || 1;
        this.pos.x += f.x * s * pushAhead;
        this.pos.z += f.z * s * pushAhead;
      }
      if (vehicle.speed > 5 && vehicle.driver !== 'player') {
        this.hurt(vehicle.speed * 2.2, vehicle.isPolice ? 'police' : 'vehicle', vehicle.pos.x, vehicle.pos.z);
        this.vel.x = vehicle.vel.x * 0.8;
        this.vel.z = vehicle.vel.z * 0.8;
      }
    }
  }

  drive(dt, input) {
    const v = this.vehicle;
    const axis = input.axis();
    const c = v.controls;
    // W accelerates; S brakes and then reverses.
    c.throttle = axis.forward > 0 ? 1 : 0;
    c.brake = axis.forward < 0 ? 1 : 0;
    c.steer = clamp(axis.right, -1, 1);
    c.handbrake = input.isDown('Space');
    if (input.wasPressed('KeyH')) this.game.events.emit('vehicle:honk', { vehicle: v, player: true });
    if (input.wasPressed('KeyF')) this.exitVehicle();
  }

  syncMesh(dt) {
    this.mesh.position.copy(this.pos);
    this.mesh.rotation.y = this.heading;
    const weapon = this.game.combat ? this.game.combat.current : 'fists';
    animateHuman(this.rig, {
      speed: this.airborne ? 0 : Math.hypot(this.vel.x, this.vel.z),
      dead: this.dead || this.fallen > 0.01,
      fallen: this.fallen,
      aiming: this.aiming,
      aimPitch: this.aimPitch,
      armed: weapon === 'pistol',
      punch: this.punch,
      hands: this.arrested,
    }, dt);
  }
}
