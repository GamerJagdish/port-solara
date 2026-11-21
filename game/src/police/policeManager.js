// The Port Solara Police Department's response. It keeps as many cruisers on Nico as his stars call
// for, spawning them on the grid out of sight; officers jump out when he is on foot; it decides
// whether any officer can see him; and it makes the arrest when he is caught on foot or boxed in.
import { POLICE, CITY } from '../core/config.js';
import { nodeX, nodeZ } from '../world/cityLayout.js';
import { PursuitDriver } from './pursuitDriver.js';
import { OfficerBrain } from './officerBrain.js';
import { RoadDriver } from '../traffic/roadDriver.js';
import { CAST } from '../player/playerLook.js';
import { WANTED } from '../core/config.js';

export class PoliceManager {
  constructor(game) {
    this.game = game;
    this.units = [];
    this.spawnCooldown = 0;
    this.sightTimer = 0;
    this.sightCache = false;
    this.arrestTimer = 0;
    this.boxedTimer = 0;
    this.nextSlot = 0;
    game.events.on('wanted:cleared', () => this.standDown());
  }

  officerLook() {
    const dice = this.game.dice;
    return { ...CAST.officer.look, skin: dice.pick(['#f1c7a5', '#d9a07a', '#b77a52', '#8d5a3b', '#5f3c28']), hairStyle: dice.chance(0.3) ? 'long' : 'short' };
  }

  get officersOnFoot() {
    return this.game.peds.list.filter((p) => p.role === 'officer' && !p.dead && p.brain instanceof OfficerBrain);
  }

  /** Adds a cruiser on a grid node `min`..`max` metres away, preferring one the camera cannot see. */
  spawnUnit(min = POLICE.spawnMin, max = POLICE.spawnMax, { visibleOk = false, at = null } = {}) {
    const game = this.game;
    const focus = game.player.focus;
    let spot = at;
    for (let attempt = 0; !spot && attempt < 30; attempt += 1) {
      const i = Math.floor(game.dice.next() * (CITY.cols + 1));
      const j = Math.floor(game.dice.next() * (CITY.rows + 1));
      const x = nodeX(i);
      const z = nodeZ(j);
      const d = Math.hypot(x - focus.x, z - focus.z);
      if (d < min || d > max) continue;
      if (!visibleOk && attempt < 20 && game.traffic.inView(x, z)) continue;
      if (game.vehicles.near(x, z, 8).length) continue;
      spot = { x, z, heading: Math.atan2(focus.x - x, focus.z - z) };
    }
    if (!spot) return null;
    const vehicle = game.vehicles.spawn('patrol', { x: spot.x, z: spot.z, heading: spot.heading, role: 'police' });
    vehicle.driver = 'cop';
    const unit = { vehicle, crew: 2, officers: [] };
    vehicle.ai = new PursuitDriver(game, vehicle, this.nextSlot++);
    vehicle.sirenOn = true;
    this.units.push(unit);
    return unit;
  }

  removeUnit(unit) {
    this.units = this.units.filter((u) => u !== unit);
    for (const officer of unit.officers) if (!officer.dead) this.game.peds.remove(officer);
    if (this.game.vehicles.list.includes(unit.vehicle) && unit.vehicle.driver !== 'player') this.game.vehicles.remove(unit.vehicle);
  }

  /** Officers get out next to a cruiser that has pulled up near Nico on foot. */
  deployOfficers(unit) {
    const game = this.game;
    const vehicle = unit.vehicle;
    while (unit.crew > 0) {
      unit.crew -= 1;
      const door = vehicle.doorPosition();
      const side = unit.officers.length % 2 === 0 ? 0 : 1;
      const x = side ? 2 * vehicle.pos.x - door.x : door.x;
      const z = side ? 2 * vehicle.pos.z - door.z : door.z;
      const officer = game.peds.add({ x, z, heading: vehicle.heading, look: this.officerLook(), role: 'officer', health: 70, brain: new OfficerBrain(game, unit) });
      officer.persistent = true;
      unit.officers.push(officer);
    }
    vehicle.driver = null;
    vehicle.controls.throttle = 0;
  }

  /** An officer climbs back into their cruiser. */
  boardOfficer(unit, officer) {
    unit.officers = unit.officers.filter((o) => o !== officer);
    this.game.peds.remove(officer);
    unit.crew += 1;
    if (unit.vehicle.driver === null && !unit.vehicle.destroyed) {
      unit.vehicle.driver = 'cop';
      if (this.game.wanted.stars === 0) {
        unit.vehicle.ai = new RoadDriver(this.game, unit.vehicle);
        unit.vehicle.ai.rejoinRoad();
      }
    }
  }

  /** The heat is off: cruisers drive away as normal traffic and officers go back to them. */
  standDown() {
    for (const unit of this.units) {
      const v = unit.vehicle;
      v.sirenOn = false;
      if (v.driver === 'cop' && !v.destroyed) {
        v.ai = new RoadDriver(this.game, v);
        v.ai.rejoinRoad();
      }
    }
  }

  /** Whether any officer, in a car or on foot, has a clear view of Nico (cached a few times a second). */
  canSeePlayer() {
    return this.sightCache;
  }

  computeSight() {
    const game = this.game;
    const p = game.player.focus;
    const lookers = [];
    for (const unit of this.units) if (!unit.vehicle.destroyed && (unit.crew > 0 || unit.vehicle.driver === 'cop')) lookers.push(unit.vehicle.pos);
    for (const officer of this.officersOnFoot) lookers.push(officer.pos);
    for (const looker of lookers) {
      const d = Math.hypot(looker.x - p.x, looker.z - p.z);
      if (d < 12) return true;
      if (d > WANTED.sightRange) continue;
      if (!game.city.collision.segmentBlocked(looker.x, looker.z, p.x, p.z, 2.5)) return true;
    }
    return false;
  }

  update(dt) {
    const game = this.game;
    const stars = game.wanted.stars;
    const focus = game.player.focus;
    this.sightTimer -= dt;
    if (this.sightTimer <= 0) {
      this.sightTimer = 0.2;
      this.sightCache = stars > 0 && this.computeSight();
    }
    // Clean up wrecked, stolen, abandoned or far-away units.
    for (const unit of this.units.slice()) {
      const v = unit.vehicle;
      const d = Math.hypot(v.pos.x - focus.x, v.pos.z - focus.z);
      if (v.driver === 'player') {
        this.units = this.units.filter((u) => u !== unit);
        continue;
      }
      const deadCrew = unit.crew === 0 && unit.officers.every((o) => o.dead);
      if (d > POLICE.despawnRadius || (v.destroyed && d > 60) || (deadCrew && d > 80) || (stars === 0 && d > 140)) this.removeUnit(unit);
    }
    if (stars === 0) {
      this.arrestTimer = 0;
      this.boxedTimer = 0;
      return;
    }
    const active = this.units.filter((u) => !u.vehicle.destroyed && (u.crew > 0 || u.officers.some((o) => !o.dead)));
    const wantedUnits = POLICE.unitsByStars[stars];
    this.spawnCooldown -= dt;
    if (active.length < wantedUnits && this.spawnCooldown <= 0) {
      this.spawnCooldown = 2.5;
      this.spawnUnit();
    }
    for (const unit of this.units) {
      const v = unit.vehicle;
      if (v.destroyed) continue;
      if (v.driver === 'cop' && !(v.ai instanceof PursuitDriver)) v.ai = new PursuitDriver(game, v, this.nextSlot++);
      v.sirenOn = true;
      if (!game.player.vehicle && unit.crew > 0 && v.driver === 'cop') {
        const d = Math.hypot(v.pos.x - focus.x, v.pos.z - focus.z);
        if (d < 18 && v.speed < 2) this.deployOfficers(unit);
      }
    }
    this.updateArrest(dt);
  }

  /** Cuffed on foot by a nearby officer, or pulled out of a car the cruisers have boxed in. */
  updateArrest(dt) {
    const game = this.game;
    const player = game.player;
    if (player.dead) return;
    if (!player.vehicle) {
      const close = this.officersOnFoot.some((o) => Math.hypot(o.pos.x - player.pos.x, o.pos.z - player.pos.z) < POLICE.arrestRange);
      if (close && player.speed < 3.5 && game.wanted.stars <= 2) this.arrestTimer += dt;
      else this.arrestTimer = Math.max(0, this.arrestTimer - dt * 2);
      this.boxedTimer = 0;
    } else {
      const car = player.vehicle;
      const touching = this.units.filter((u) => !u.vehicle.destroyed && Math.hypot(u.vehicle.pos.x - car.pos.x, u.vehicle.pos.z - car.pos.z) < car.halfLength + u.vehicle.halfLength + 1.2);
      if (touching.length >= 1 && car.speed < 1.5) this.boxedTimer += dt * touching.length;
      else this.boxedTimer = Math.max(0, this.boxedTimer - dt * 2);
      this.arrestTimer = this.boxedTimer > 1.2 ? this.boxedTimer - 1.2 : 0;
    }
    if (this.arrestTimer >= POLICE.arrestSeconds) {
      this.arrestTimer = 0;
      this.boxedTimer = 0;
      game.events.emit('player:arrested', {});
    }
  }

  clearAll() {
    for (const unit of this.units.slice()) this.removeUnit(unit);
    for (const officer of this.officersOnFoot) this.game.peds.remove(officer);
    this.units = [];
  }
}
