// A person on foot who is not the player: a civilian, a police officer, a Haldane enforcer or the
// mission giver. It owns the body (model, position, health, falling down and dying); a "brain"
// decides where it goes and what it does each step.
import * as THREE from 'three';
import { createHuman, animateHuman } from './humanModel.js';
import { PED } from '../core/config.js';
import { dampAngle } from '../core/mathUtils.js';
import { groundHeightAt } from '../world/groundHeight.js';

let nextId = 1;

export class Pedestrian {
  constructor(game, { x, z, heading = 0, look, role = 'civilian', health = PED.health, brain = null, name = null }) {
    this.id = nextId++;
    this.game = game;
    this.role = role;
    this.name = name;
    this.look = look;
    this.rig = createHuman(look);
    this.mesh = this.rig.root;
    this.pos = new THREE.Vector3(x, 0, z);
    this.heading = heading;
    this.vel = { x: 0, z: 0 };
    this.health = health;
    this.maxHealth = health;
    this.dead = false;
    this.deadTime = 0;
    this.fallen = 0;
    this.knockTime = 0;
    this.punch = 0;
    this.aiming = false;
    this.armed = false;
    this.hands = false;
    this.brain = brain;
    this.persistent = false;
    this.cash = 5 + Math.floor(game.dice.next() * 40);
    this.flyVel = null;
    this.syncMesh(0);
  }

  get speed() {
    return Math.hypot(this.vel.x, this.vel.z);
  }

  /** Walks or runs toward a ground point; returns the remaining distance. */
  moveToward(x, z, speed, dt, turnRate = 10) {
    const dx = x - this.pos.x;
    const dz = z - this.pos.z;
    const d = Math.hypot(dx, dz);
    if (d < 0.05) {
      this.vel.x = 0;
      this.vel.z = 0;
      return d;
    }
    const step = Math.min(speed, d / dt);
    this.vel.x = (dx / d) * step;
    this.vel.z = (dz / d) * step;
    this.heading = dampAngle(this.heading, Math.atan2(dx, dz), turnRate, dt);
    return d;
  }

  stop() {
    this.vel.x = 0;
    this.vel.z = 0;
  }

  face(x, z, dt, rate = 12) {
    this.heading = dampAngle(this.heading, Math.atan2(x - this.pos.x, z - this.pos.z), rate, dt);
  }

  /** Takes damage from `source` ('player', 'police', 'npc', 'vehicle'); knocks down or kills. */
  hurt(amount, source, { knock = false, fromX = null, fromZ = null } = {}) {
    if (this.dead) return;
    this.health -= amount;
    this.lastAttacker = source;
    if (this.health <= 0) {
      this.die(source);
      return;
    }
    if (knock) this.knockTime = 1.6;
    if (this.brain && this.brain.onHurt) this.brain.onHurt(this, source, fromX, fromZ);
    this.game.events.emit('ped:hurt', { ped: this, source });
  }

  die(source) {
    if (this.dead) return;
    this.dead = true;
    this.health = 0;
    this.deadTime = 0;
    this.stop();
    this.game.events.emit('ped:killed', { ped: this, source });
  }

  /** Thrown by a car: flies along the impact and lands hard. */
  fling(vx, vz, up = 4) {
    this.flyVel = { x: vx, y: up, z: vz };
    this.knockTime = 2;
  }

  update(dt) {
    if (this.flyVel) {
      this.pos.x += this.flyVel.x * dt;
      this.pos.z += this.flyVel.z * dt;
      this.pos.y += this.flyVel.y * dt;
      this.flyVel.y -= 18 * dt;
      this.flyVel.x *= Math.exp(-1.5 * dt);
      this.flyVel.z *= Math.exp(-1.5 * dt);
      const floor = groundHeightAt(this.pos.x, this.pos.z);
      if (this.pos.y <= floor) {
        this.pos.y = floor;
        if (Math.hypot(this.flyVel.x, this.flyVel.z) < 1) this.flyVel = null;
        else this.flyVel.y = 0;
      }
      this.game.city.collision.resolveCircle(this.pos, PED.radius);
    } else if (this.dead) {
      this.deadTime += dt;
    } else if (this.knockTime > 0) {
      this.knockTime -= dt;
      this.stop();
    } else {
      if (this.brain) this.brain.update(this, dt);
      this.pos.x += this.vel.x * dt;
      this.pos.z += this.vel.z * dt;
      this.game.city.collision.resolveCircle(this.pos, PED.radius);
      this.pos.y = groundHeightAt(this.pos.x, this.pos.z);
    }
    const down = this.dead || this.knockTime > 0;
    this.fallen = Math.min(1, Math.max(0, this.fallen + (down ? dt * 5 : -dt * 3)));
    this.punch = Math.max(0, this.punch - dt * 2.8);
    this.syncMesh(dt);
  }

  syncMesh(dt) {
    this.mesh.position.copy(this.pos);
    this.mesh.rotation.y = this.heading;
    animateHuman(this.rig, {
      speed: this.speed,
      dead: this.dead || this.fallen > 0.01,
      fallen: this.fallen,
      aiming: this.aiming,
      armed: this.armed,
      punch: this.punch,
      hands: this.hands,
    }, dt);
  }
}
