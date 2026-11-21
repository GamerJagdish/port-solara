// The wanted level. Crimes add heat and heat becomes stars (one to five). While any officer can see
// Nico the police know where he is; once he breaks line of sight the stars flash, a search area
// forms around where he was last seen, and staying hidden long enough (faster outside that area)
// shakes the police off. Missions can hold the level at a minimum.
import { WANTED } from '../core/config.js';

const CRIME_HEAT = {
  carjack: 34,
  theft: 20,
  assault: 30,
  assaultOfficer: 130,
  murder: 110,
  murderOfficer: 210,
  gunfire: 12,
  runover: 60,
  ramPolice: 45,
  shootPolice: 90,
  destroyPolice: 220,
};

export class WantedLevel {
  constructor(game) {
    this.game = game;
    this.heat = 0;
    this.stars = 0;
    this.minimum = 0;
    this.seen = false;
    this.unseenTime = 0;
    this.lastSeen = { x: 0, z: 0 };
    const crime = (kind, amount) => this.commit(kind, amount);
    const events = game.events;
    events.on('crime:carjack', ({ vehicle }) => crime('carjack', vehicle.isPolice ? CRIME_HEAT.assaultOfficer : CRIME_HEAT.carjack));
    events.on('crime:theft', () => this.witnessed(28) && crime('theft'));
    events.on('ped:hurt', ({ ped, source }) => {
      if (source !== 'player') return;
      if (ped.role === 'officer') crime('assaultOfficer');
      else if (ped.role === 'civilian' && this.witnessed(40)) crime('assault');
    });
    events.on('ped:killed', ({ ped, source }) => {
      if (source !== 'player') return;
      if (ped.role === 'officer') crime('murderOfficer');
      else if (ped.role === 'civilian') crime('murder');
      else if (this.witnessed(30)) crime('gunfire', 40);
    });
    events.on('gunshot', ({ source }) => {
      if (source === 'player' && this.witnessed(45)) crime('gunfire');
    });
    events.on('ped:runover', ({ ped, source }) => {
      if (source === 'player' && ped.role !== 'enforcer') crime('runover', ped.role === 'officer' ? CRIME_HEAT.murderOfficer : CRIME_HEAT.runover);
    });
    events.on('vehicle:crash', ({ vehicle, other }) => {
      if (vehicle.isPolice && other && other.driver === 'player' && this.stars === 0) crime('ramPolice');
    });
    events.on('vehicle:shot', ({ vehicle, source }) => {
      if (source === 'player' && vehicle.isPolice) crime('shootPolice');
    });
    events.on('vehicle:destroyed', ({ vehicle, source }) => {
      if (source === 'player' && vehicle.isPolice) crime('destroyPolice');
    });
  }

  /** True when anyone (a local or an officer) is close enough to see a crime. */
  witnessed(radius) {
    const p = this.game.player.focus;
    for (const ped of this.game.peds.list) {
      if (!ped.dead && Math.hypot(ped.pos.x - p.x, ped.pos.z - p.z) < radius) return true;
    }
    return this.game.police.units.some((u) => Math.hypot(u.vehicle.pos.x - p.x, u.vehicle.pos.z - p.z) < radius * 2);
  }

  commit(kind, amount = CRIME_HEAT[kind]) {
    const before = this.stars;
    this.heat = Math.min(WANTED.maxStars * WANTED.heatPerStar, this.heat + amount);
    this.recount();
    const p = this.game.player.focus;
    this.lastSeen = { x: p.x, z: p.z };
    this.unseenTime = 0;
    this.game.events.emit('crime', { kind });
    if (this.stars > before) this.game.events.emit('wanted:changed', { stars: this.stars, before });
  }

  recount() {
    const fromHeat = this.heat >= 40 ? Math.min(WANTED.maxStars, Math.max(1, Math.ceil(this.heat / WANTED.heatPerStar))) : 0;
    this.stars = Math.max(fromHeat, this.minimum);
  }

  /** Raises the level to at least `stars` (missions use this). */
  force(stars) {
    const before = this.stars;
    this.heat = Math.max(this.heat, stars * WANTED.heatPerStar - 1);
    this.recount();
    const p = this.game.player.focus;
    this.lastSeen = { x: p.x, z: p.z };
    this.unseenTime = 0;
    if (this.stars > before) this.game.events.emit('wanted:changed', { stars: this.stars, before });
  }

  clear() {
    const before = this.stars;
    this.heat = 0;
    this.minimum = 0;
    this.stars = 0;
    this.unseenTime = 0;
    if (before > 0) this.game.events.emit('wanted:cleared', { before });
  }

  get searchRadius() {
    return WANTED.searchRadius[this.stars] ?? 0;
  }

  get evadeProgress() {
    return this.stars === 0 ? 0 : Math.min(1, this.unseenTime / WANTED.evadeSeconds[this.stars]);
  }

  update(dt) {
    if (this.stars === 0) {
      this.heat = Math.max(0, this.heat - dt * 6);
      return;
    }
    const p = this.game.player.focus;
    this.seen = this.game.police.canSeePlayer();
    if (this.seen) {
      this.lastSeen = { x: p.x, z: p.z };
      this.unseenTime = 0;
      return;
    }
    const outside = Math.hypot(p.x - this.lastSeen.x, p.z - this.lastSeen.z) > this.searchRadius;
    this.unseenTime += dt * (outside ? 1.6 : 1);
    if (this.unseenTime >= WANTED.evadeSeconds[this.stars] && this.minimum === 0) {
      this.clear();
      this.game.events.emit('wanted:evaded', {});
    }
  }
}
