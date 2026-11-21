// Fists and the pistol. Handles the player's weapon wheel (Q / 1 / 2), aiming with the right mouse
// button, punching, firing with a clip and reserve ammo, reloading, a light aim assist for hip fire,
// and the shared `fireBullet` that police and enforcers shoot with too.
import * as THREE from 'three';
import { COMBAT } from '../core/config.js';
import { traceShot } from './ballistics.js';

export class CombatSystem {
  constructor(game) {
    this.game = game;
    this.current = 'fists';
    this.hasPistol = false;
    this.clip = 0;
    this.reserve = 0;
    this.cooldown = 0;
    this.reloadTimer = 0;
  }

  givePistol(ammo) {
    const first = !this.hasPistol;
    this.hasPistol = true;
    this.reserve += ammo;
    if (this.clip === 0) this.reload(true);
    if (first) this.current = 'pistol';
  }

  get ammoText() {
    if (this.current !== 'pistol') return '';
    return this.reloadTimer > 0 ? 'RELOADING' : `${this.clip} / ${this.reserve}`;
  }

  reload(instant = false) {
    if (!this.hasPistol || this.clip === COMBAT.clipSize || this.reserve === 0) return;
    if (instant) {
      const take = Math.min(COMBAT.clipSize - this.clip, this.reserve);
      this.clip += take;
      this.reserve -= take;
      return;
    }
    if (this.reloadTimer <= 0) {
      this.reloadTimer = COMBAT.reloadTime;
      this.game.events.emit('weapon:reload', {});
    }
  }

  switchWeapon(to = null) {
    const next = to ?? (this.current === 'fists' && this.hasPistol ? 'pistol' : 'fists');
    if (next === 'pistol' && !this.hasPistol) return;
    if (next !== this.current) {
      this.current = next;
      this.game.events.emit('weapon:switch', { weapon: next });
    }
  }

  update(dt, input) {
    const player = this.game.player;
    this.cooldown -= dt;
    if (this.reloadTimer > 0) {
      this.reloadTimer -= dt;
      if (this.reloadTimer <= 0) this.reload(true);
    }
    if (player.dead || player.vehicle || player.entering || player.arrested) {
      player.aiming = false;
      return;
    }
    if (input.wasPressed('KeyQ')) this.switchWeapon();
    if (input.wasPressed('Digit1')) this.switchWeapon('fists');
    if (input.wasPressed('Digit2')) this.switchWeapon('pistol');
    if (input.wasPressed('KeyR')) this.reload();
    player.aiming = input.mouseDown[2] || (this.current === 'pistol' && input.mouseDown[0]);
    player.aimPitch = -this.game.cameraRig.pitch * 0.6;
    if (input.mouseDown[0] && this.cooldown <= 0) {
      if (this.current === 'pistol') this.playerShoot();
      else this.playerPunch();
    }
  }

  playerPunch() {
    const game = this.game;
    const player = game.player;
    this.cooldown = COMBAT.punchCooldown;
    player.punch = 1;
    game.events.emit('weapon:swing', {});
    const fx = Math.sin(player.heading);
    const fz = Math.cos(player.heading);
    let best = null;
    let bestD = COMBAT.punchRange + 0.4;
    for (const ped of game.peds.list) {
      if (ped.dead) continue;
      const dx = ped.pos.x - player.pos.x;
      const dz = ped.pos.z - player.pos.z;
      const d = Math.hypot(dx, dz);
      if (d > bestD || (dx * fx + dz * fz) / (d || 1) < 0.35) continue;
      best = ped;
      bestD = d;
    }
    if (best) {
      best.hurt(COMBAT.punchDamage, 'player', { knock: game.dice.chance(0.35), fromX: player.pos.x, fromZ: player.pos.z });
      game.events.emit('combat:punchHit', { target: best });
    }
  }

  /** The point the player means to shoot: under the crosshair when aiming, the nearest foe in front otherwise. */
  playerAimPoint() {
    const game = this.game;
    const ray = game.cameraRig.aimRay();
    const hit = traceShot(game, ray.origin, ray.dir, 120, [game.player]);
    if (hit.kind === 'ped' || hit.kind === 'vehicle') return hit.point;
    const player = game.player;
    let assist = null;
    let bestScore = 0.93;
    for (const ped of game.peds.list) {
      if (ped.dead || ped.role === 'civilian') continue;
      const dx = ped.pos.x - player.pos.x;
      const dz = ped.pos.z - player.pos.z;
      const d = Math.hypot(dx, dz);
      if (d > 45) continue;
      const score = (dx * ray.dir.x + dz * ray.dir.z) / (d * Math.hypot(ray.dir.x, ray.dir.z) || 1);
      if (score > bestScore) {
        bestScore = score;
        assist = new THREE.Vector3(ped.pos.x, ped.pos.y + 1.3, ped.pos.z);
      }
    }
    return assist ?? hit.point;
  }

  playerShoot() {
    const player = this.game.player;
    if (this.reloadTimer > 0) return;
    if (this.clip <= 0) {
      this.cooldown = 0.3;
      if (this.reserve > 0) this.reload();
      else this.game.events.emit('weapon:empty', {});
      return;
    }
    this.clip -= 1;
    this.cooldown = COMBAT.pistolCooldown;
    const muzzle = new THREE.Vector3(player.pos.x + Math.sin(player.heading) * 0.6 - Math.cos(player.heading) * 0.25, player.pos.y + 1.4, player.pos.z + Math.cos(player.heading) * 0.6 + Math.sin(player.heading) * 0.25);
    const target = this.playerAimPoint();
    const dir = target.clone().sub(muzzle).normalize();
    this.fireBullet(muzzle, dir, { damage: COMBAT.pistolDamage, source: 'player', ignore: [player], spread: 0.012 });
    this.game.cameraRig.addShake(0.08);
    if (this.clip === 0 && this.reserve > 0) this.reload();
  }

  /**
   * Fires one bullet: traces it, draws the tracer and flash, and applies damage to whatever it hits.
   * Returns the hit.
   */
  fireBullet(origin, dir, { damage, source, ignore = [], spread = 0, range = COMBAT.pistolRange }) {
    const game = this.game;
    if (spread > 0) {
      dir = dir.clone();
      dir.x += (game.dice.next() - 0.5) * spread * 2;
      dir.y += (game.dice.next() - 0.5) * spread * 2;
      dir.z += (game.dice.next() - 0.5) * spread * 2;
      dir.normalize();
    }
    const hit = traceShot(game, origin, dir, range, ignore);
    game.fx.muzzleFlash(origin.x, origin.y, origin.z);
    game.tracers.add(origin, hit.point);
    game.tracers.muzzle(origin);
    game.events.emit('gunshot', { x: origin.x, z: origin.z, source });
    if (hit.kind === 'ped') {
      const ped = hit.target;
      const headshot = hit.point.y - ped.pos.y > 1.55;
      ped.hurt(damage * (headshot ? 2.5 : 1), source, { knock: game.dice.chance(0.2), fromX: origin.x, fromZ: origin.z });
      game.fx.blood(hit.point.x, hit.point.y, hit.point.z);
    } else if (hit.kind === 'player') {
      hit.target.hurt(damage, source, origin.x, origin.z);
      game.fx.blood(hit.point.x, hit.point.y, hit.point.z);
    } else if (hit.kind === 'vehicle') {
      hit.target.damage(damage * 0.35, source);
      game.fx.impact(hit.point.x, hit.point.y, hit.point.z);
      if (hit.target.driver === 'npc' && hit.target.ai && hit.target.ai.panic !== undefined) hit.target.ai.panic = 8;
      game.events.emit('vehicle:shot', { vehicle: hit.target, source });
    } else if (hit.kind === 'world') {
      game.fx.impact(hit.point.x, hit.point.y, hit.point.z);
    }
    return hit;
  }
}
