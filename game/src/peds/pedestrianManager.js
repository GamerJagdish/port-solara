// Fills the sidewalks and the beach with locals around the player, removes them out of range, runs
// every person's update, throws people hit by cars, and spreads panic from gunfire and explosions.
import { PED, CITY } from '../core/config.js';
import { Pedestrian } from './pedestrian.js';
import { CivilianBrain } from './civilianBrain.js';
import { ringOf, ringPoint, ringPerimeter, beachSpot } from './sidewalkPaths.js';
import { SKIN_TONES, HAIR_COLORS, SHIRT_COLORS, PANTS_COLORS } from './humanModel.js';

export class PedestrianManager {
  constructor(game) {
    this.game = game;
    this.list = [];
    this.cooldown = 0;
    game.events.on('gunshot', ({ x, z, source }) => this.panicAround(x, z, 28, source));
    game.events.on('explosion', ({ x, z }) => this.panicAround(x, z, 40));
    game.events.on('vehicle:crash', ({ vehicle, impact }) => {
      if (impact > 10) this.panicAround(vehicle.pos.x, vehicle.pos.z, 12);
    });
  }

  randomLook() {
    const dice = this.game.dice;
    const longHair = dice.chance(0.4);
    return {
      skin: dice.pick(SKIN_TONES),
      hair: dice.pick(HAIR_COLORS),
      hairStyle: longHair ? 'long' : dice.chance(0.12) ? 'bald' : 'short',
      shirt: dice.pick(SHIRT_COLORS),
      pants: dice.pick(PANTS_COLORS),
      shoes: dice.pick(['#2b2b2b', '#f2f2f2', '#8b5e3c']),
      cap: dice.chance(0.15),
      capColor: dice.pick(SHIRT_COLORS),
      shades: dice.chance(0.35),
      build: 0.92 + dice.next() * 0.14,
    };
  }

  add(options) {
    const ped = new Pedestrian(this.game, options);
    this.list.push(ped);
    this.game.scene.add(ped.mesh);
    return ped;
  }

  remove(ped) {
    const index = this.list.indexOf(ped);
    if (index >= 0) this.list.splice(index, 1);
    this.game.scene.remove(ped.mesh);
  }

  get civilians() {
    return this.list.filter((p) => p.role === 'civilian');
  }

  /** Spawns one local on a sidewalk ring or the beach between `min` and `max` metres away. */
  spawnCivilian(focus, min, max) {
    const dice = this.game.dice;
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const onBeach = focus.z > CITY.maxZ - 90 && dice.chance(0.35);
      let x;
      let z;
      let brain;
      if (onBeach) {
        const spot = beachSpot(dice.next);
        x = spot.x;
        z = spot.z;
        brain = new CivilianBrain(this.game, { beach: true });
      } else {
        const bi = Math.floor(dice.next() * CITY.cols);
        const bj = Math.floor(dice.next() * CITY.rows);
        const ring = ringOf(bi, bj);
        const s = dice.next() * ringPerimeter();
        const point = ringPoint(ring, s);
        x = point.x;
        z = point.z;
        brain = new CivilianBrain(this.game, { ring, s });
      }
      const d = Math.hypot(x - focus.x, z - focus.z);
      if (d < min || d > max) continue;
      return this.add({ x, z, heading: dice.next() * Math.PI * 2, look: this.randomLook(), role: 'civilian', brain });
    }
    return null;
  }

  populate(focus) {
    for (let k = 0; k < PED.count; k += 1) this.spawnCivilian(focus, 4, PED.spawnRadius);
  }

  panicAround(x, z, radius) {
    for (const ped of this.list) {
      if (ped.role !== 'civilian' || ped.dead) continue;
      if (Math.hypot(ped.pos.x - x, ped.pos.z - z) < radius) ped.brain.scare(ped, x, z);
    }
  }

  /** Cars moving fast enough knock down or kill whoever they hit. */
  vehicleImpacts() {
    for (const vehicle of this.game.vehicles.list) {
      const speed = vehicle.speed;
      if (speed < 3.5) continue;
      const f = vehicle.forward();
      for (const ped of this.list) {
        if (ped.flyVel || (ped.dead && ped.fallen >= 1)) continue;
        const dx = ped.pos.x - vehicle.pos.x;
        const dz = ped.pos.z - vehicle.pos.z;
        if (Math.abs(dx) > 6 || Math.abs(dz) > 6) continue;
        const ahead = dx * f.x + dz * f.z;
        const side = dx * -f.z + dz * f.x;
        if (Math.abs(ahead) > vehicle.halfLength + 0.35 || Math.abs(side) > vehicle.radius + 0.35) continue;
        const source = vehicle.driver === 'player' ? 'player' : vehicle.isPolice ? 'police' : 'npc';
        ped.fling(vehicle.vel.x * 0.9, vehicle.vel.z * 0.9, 2 + speed * 0.25);
        ped.hurt(speed * 5, source, { knock: true, fromX: vehicle.pos.x, fromZ: vehicle.pos.z });
        this.game.fx.blood(ped.pos.x, 0.9, ped.pos.z);
        this.game.events.emit('ped:runover', { ped, vehicle, source });
      }
    }
  }

  update(dt) {
    const focus = this.game.player.pos;
    this.vehicleImpacts();
    for (const ped of this.list.slice()) {
      ped.update(dt);
      const far = Math.hypot(ped.pos.x - focus.x, ped.pos.z - focus.z) > PED.despawnRadius;
      if (!ped.persistent && (far || (ped.dead && ped.deadTime > 40))) this.remove(ped);
    }
    this.cooldown -= dt;
    if (this.cooldown <= 0 && this.civilians.length < PED.count) {
      this.cooldown = 0.25;
      this.spawnCivilian(focus, 60, PED.spawnRadius);
    }
  }
}
