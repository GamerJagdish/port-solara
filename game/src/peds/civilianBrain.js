// What an ordinary Port Solara local does: strolls round the block, now and then crosses to the next
// one, lounges about on the beach, and runs for it when there is shooting, a crash or a carjacking
// nearby. Robbed or punched locals panic; some of them call the police on the player.
import { PED } from '../core/config.js';
import { ringPoint, ringParam, nearestRing, atCorner, crossingFrom, beachSpot } from './sidewalkPaths.js';

export class CivilianBrain {
  constructor(game, { ring = null, s = 0, beach = false }) {
    this.game = game;
    this.ring = ring;
    this.s = s;
    this.dir = game.dice.next() < 0.5 ? 1 : -1;
    this.offset = (game.dice.next() - 0.5) * 2;
    this.mode = beach ? 'beach' : 'walk';
    this.home = this.mode;
    this.target = null;
    this.timer = 0;
    this.fear = null;
    this.speedScale = 0.85 + game.dice.next() * 0.3;
    this.cornerCooldown = 0;
  }

  /** Something frightening happened at (x, z): run the other way. */
  scare(ped, x, z, seconds = 6) {
    if (ped.dead) return;
    this.fear = { x, z };
    this.mode = 'flee';
    this.timer = seconds * (0.8 + this.game.dice.next() * 0.4);
  }

  onHurt(ped, source, x, z) {
    this.scare(ped, x ?? ped.pos.x - Math.sin(ped.heading), z ?? ped.pos.z - Math.cos(ped.heading), 8);
  }

  update(ped, dt) {
    this.cornerCooldown -= dt;
    if (this.mode === 'flee') return this.flee(ped, dt);
    if (this.mode === 'beach') return this.lounge(ped, dt);
    if (this.mode === 'cross') return this.cross(ped, dt);
    this.walk(ped, dt);
  }

  walk(ped, dt) {
    if (!this.ring) {
      this.ring = nearestRing(ped.pos.x, ped.pos.z);
      this.s = ringParam(this.ring, ped.pos.x, ped.pos.z);
    }
    const speed = PED.walkSpeed * this.speedScale;
    this.s += this.dir * speed * dt;
    const point = ringPoint(this.ring, this.s, this.offset);
    ped.moveToward(point.x, point.z, speed * 1.3, dt, 8);
    if (this.cornerCooldown <= 0 && atCorner(this.s)) {
      this.cornerCooldown = 4;
      const roll = this.game.dice.next();
      if (roll < 0.22) {
        const crossing = crossingFrom(this.ring, this.s, this.game.dice.next);
        if (crossing) {
          this.mode = 'cross';
          this.target = crossing;
        }
      } else if (roll < 0.32) {
        this.dir = -this.dir;
      }
    }
  }

  cross(ped, dt) {
    const d = ped.moveToward(this.target.target.x, this.target.target.z, PED.walkSpeed * 1.25, dt);
    if (d < 0.6) {
      this.ring = this.target.ring;
      this.s = this.target.s;
      this.mode = 'walk';
      this.cornerCooldown = 6;
    }
  }

  lounge(ped, dt) {
    if (!this.target || this.timer <= 0) {
      this.target = beachSpot(this.game.dice.next);
      this.timer = 6 + this.game.dice.next() * 10;
    }
    this.timer -= dt;
    const d = ped.moveToward(this.target.x, this.target.z, PED.walkSpeed * 0.8, dt, 6);
    if (d < 0.5) ped.stop();
  }

  flee(ped, dt) {
    this.timer -= dt;
    let dx = ped.pos.x - this.fear.x;
    let dz = ped.pos.z - this.fear.z;
    const d = Math.hypot(dx, dz) || 1;
    dx /= d;
    dz /= d;
    ped.moveToward(ped.pos.x + dx * 5, ped.pos.z + dz * 5, PED.runSpeed * this.speedScale, dt, 6);
    if (this.timer <= 0) {
      if (this.home === 'walk') {
        this.ring = nearestRing(ped.pos.x, ped.pos.z);
        this.s = ringParam(this.ring, ped.pos.x, ped.pos.z);
        this.mode = 'walk';
      } else {
        this.mode = 'beach';
        this.target = null;
      }
      this.fear = null;
    }
  }
}

