// Owns every car in the world: spawning and removing them, running AI drivers then physics, resolving
// car-on-car and car-on-building crashes (sound, sparks, damage), parking stealable cars near the
// player, and turning wrecked cars into fireballs.
import { stepVehicle, collideWithWorld, collideVehicles } from './vehiclePhysics.js';
import { Vehicle } from './vehicle.js';
import { PARKED_MIX } from './vehicleTypes.js';

const PARK_RADIUS = 110;
const UNPARK_RADIUS = 150;

export class VehicleManager {
  constructor(game) {
    this.game = game;
    this.list = [];
    game.events.on('vehicle:destroyed', ({ vehicle, source }) => this.explode(vehicle, source));
  }

  spawn(typeKey, options) {
    const vehicle = new Vehicle(this.game, typeKey, options);
    this.list.push(vehicle);
    this.game.scene.add(vehicle.mesh);
    return vehicle;
  }

  remove(vehicle) {
    const index = this.list.indexOf(vehicle);
    if (index >= 0) this.list.splice(index, 1);
    vehicle.dispose(this.game.scene);
    if (vehicle.parkedSlot) vehicle.parkedSlot.vehicle = null;
    if (vehicle.ai && vehicle.ai.onRemoved) vehicle.ai.onRemoved();
  }

  /** Cars within `radius` of a point, nearest first. */
  near(x, z, radius, filter = null) {
    const out = [];
    for (const vehicle of this.list) {
      const d = Math.hypot(vehicle.pos.x - x, vehicle.pos.z - z);
      if (d <= radius && (!filter || filter(vehicle))) out.push({ vehicle, d });
    }
    out.sort((a, b) => a.d - b.d);
    return out.map((entry) => entry.vehicle);
  }

  /** Keeps stealable parked cars in the lots around the player. */
  manageParked(focus) {
    for (const slot of this.game.city.parkedSlots) {
      const d = Math.hypot(slot.x - focus.x, slot.z - focus.z);
      if (!slot.vehicle && !slot.taken && d < PARK_RADIUS) {
        const typeKey = PARKED_MIX[Math.floor(this.game.dice.next() * PARKED_MIX.length)];
        const vehicle = this.spawn(typeKey, { x: slot.x, z: slot.z, heading: slot.heading, role: 'parked' });
        vehicle.parkedSlot = slot;
        slot.vehicle = vehicle;
      } else if (slot.vehicle && d > UNPARK_RADIUS && slot.vehicle.role === 'parked' && slot.vehicle.speed < 0.1) {
        this.remove(slot.vehicle);
      }
    }
  }

  update(dt, time) {
    const game = this.game;
    for (const vehicle of this.list) {
      const aiDriving = vehicle.ai && !vehicle.destroyed && vehicle.driver && vehicle.driver !== 'player';
      if (aiDriving) vehicle.ai.update(dt);
      else if (vehicle.driver !== 'player') {
        vehicle.controls.throttle = 0;
        vehicle.controls.brake = vehicle.speed > 0.2 ? 0.25 : 0;
        vehicle.controls.steer = 0;
        vehicle.controls.handbrake = false;
      }
      const resting = !aiDriving && vehicle.driver !== 'player' && vehicle.speed < 0.05;
      if (!resting) stepVehicle(vehicle, dt);
      const hit = collideWithWorld(vehicle, game.city.collision);
      if (hit && hit.impact > 4) this.onCrash(vehicle, hit.impact, null, time);
      if (vehicle.parkedSlot && vehicle.speed > 1) {
        vehicle.parkedSlot.taken = true;
        vehicle.parkedSlot.vehicle = null;
        vehicle.parkedSlot = null;
      }
    }
    for (let i = 0; i < this.list.length; i += 1) {
      for (let j = i + 1; j < this.list.length; j += 1) {
        const a = this.list[i];
        const b = this.list[j];
        const impact = collideVehicles(a, b);
        if (impact > 3) {
          this.onCrash(a, impact, b, time);
          this.onCrash(b, impact, a, time);
        }
      }
    }
    for (const vehicle of this.list) {
      if (vehicle.destroyed) this.updateWreck(vehicle, dt);
      else if (vehicle.health < 30) game.fx.smoke(vehicle.pos.x + Math.sin(vehicle.heading) * vehicle.halfLength * 0.7, 1.2, vehicle.pos.z + Math.cos(vehicle.heading) * vehicle.halfLength * 0.7, vehicle.health < 15 ? 'dark' : 'light', dt, `car:${vehicle.id}`);
      vehicle.syncMesh(dt, time);
    }
  }

  onCrash(vehicle, impact, other, time) {
    const game = this.game;
    if (time - vehicle.lastImpactTime > 0.25) {
      vehicle.lastImpactTime = time;
      game.events.emit('vehicle:crash', { vehicle, other, impact });
      if (impact > 7) game.fx.sparks(vehicle.pos.x, 0.8, vehicle.pos.z, Math.min(18, impact));
    }
    const attacker = other && other.driver === 'player' ? 'player' : vehicle.driver === 'player' ? 'player' : null;
    vehicle.damage(Math.max(0, impact - 4) * (vehicle.type.armored ? 1.1 : 2.4), attacker);
  }

  explode(vehicle, source) {
    if (vehicle.destroyed) return;
    vehicle.markWrecked();
    vehicle.burning = 12;
    vehicle.vel.x *= 0.3;
    vehicle.vel.z *= 0.3;
    this.game.fx.explosion(vehicle.pos.x, 1, vehicle.pos.z);
    this.game.events.emit('explosion', { x: vehicle.pos.x, z: vehicle.pos.z, radius: 7, source, vehicle });
    this.blast(vehicle, source);
  }

  /** The fireball hurts people and cars nearby, and can set off the next car in a chain. */
  blast(origin, source) {
    const game = this.game;
    const radius = 7;
    const falloff = (x, z) => Math.max(0, 1 - Math.hypot(x - origin.pos.x, z - origin.pos.z) / radius);
    for (const ped of game.peds.list) {
      const k = falloff(ped.pos.x, ped.pos.z);
      if (k <= 0 || ped.dead) continue;
      ped.fling((ped.pos.x - origin.pos.x) * 2, (ped.pos.z - origin.pos.z) * 2, 5 * k);
      ped.hurt(90 * k, source ?? 'vehicle', { knock: true, fromX: origin.pos.x, fromZ: origin.pos.z });
    }
    const player = game.player;
    const pk = falloff(player.focus.x, player.focus.z);
    if (player.vehicle === origin) {
      player.exitVehicle(true);
      player.hurt(45, 'vehicle', origin.pos.x, origin.pos.z);
    } else if (pk > 0) {
      player.hurt((player.vehicle ? 25 : 70) * pk, 'vehicle', origin.pos.x, origin.pos.z);
    }
    for (const other of this.list) {
      if (other === origin || other.destroyed) continue;
      const k = falloff(other.pos.x, other.pos.z);
      if (k > 0) other.damage(120 * k, source);
    }
  }

  updateWreck(vehicle, dt) {
    if (vehicle.burning > 0) {
      vehicle.burning -= dt;
      this.game.fx.fire(vehicle.pos.x, 1.1, vehicle.pos.z, dt);
    } else {
      this.game.fx.smoke(vehicle.pos.x, 1.2, vehicle.pos.z, 'dark', dt * 0.4, `wreck:${vehicle.id}`);
    }
  }
}
