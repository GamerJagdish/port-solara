// A PSPD officer on foot. At one star they run Nico down to cuff him; from two stars they draw and
// shoot when they have a clear line, closing in between shots. When Nico drives off they run back
// to their cruiser, and when the heat dies down they holster and go back to it.
import * as THREE from 'three';
import { POLICE } from '../core/config.js';

export class OfficerBrain {
  constructor(game, unit) {
    this.game = game;
    this.unit = unit;
    this.shootTimer = 0.8 + game.dice.next() * 0.8;
    this.state = 'chase';
    this.strafe = game.dice.sign();
  }

  onHurt(ped) {
    this.shootTimer = Math.min(this.shootTimer, 0.5);
    void ped;
  }

  update(ped, dt) {
    const game = this.game;
    const player = game.player;
    const stars = game.wanted.stars;
    const car = this.unit && !this.unit.vehicle.destroyed ? this.unit.vehicle : null;
    ped.aiming = false;
    ped.armed = stars >= 2;
    if (stars === 0 || player.dead) {
      if (car) this.returnTo(ped, car, dt);
      else ped.stop();
      return;
    }
    const target = player.vehicle ? player.vehicle.pos : player.pos;
    const dx = target.x - ped.pos.x;
    const dz = target.z - ped.pos.z;
    const distance = Math.hypot(dx, dz);
    if (player.vehicle && player.vehicle.speed > 8 && car && Math.hypot(car.pos.x - ped.pos.x, car.pos.z - ped.pos.z) < 30) {
      this.returnTo(ped, car, dt);
      return;
    }
    const sight = !game.city.collision.segmentBlocked(ped.pos.x, ped.pos.z, target.x, target.z, 1.5);
    if (stars >= 2 && sight && distance < POLICE.shootRange) {
      // Stand, aim and fire; drift sideways a little between shots.
      ped.face(target.x, target.z, dt, 14);
      ped.aiming = true;
      if (distance > 14) ped.moveToward(target.x, target.z, 3.2, dt, 14);
      else {
        const sx = -dz / distance;
        const sz = dx / distance;
        ped.vel.x = sx * this.strafe * 1.2;
        ped.vel.z = sz * this.strafe * 1.2;
      }
      ped.face(target.x, target.z, dt, 14);
      this.shootTimer -= dt;
      if (this.shootTimer <= 0) {
        this.shootTimer = 0.7 + game.dice.next() * 0.9;
        if (game.dice.chance(0.25)) this.strafe = -this.strafe;
        this.shoot(ped, target, distance);
      }
      return;
    }
    if (distance > 1.4) ped.moveToward(target.x, target.z, 5.6, dt, 12);
    else ped.stop();
  }

  shoot(ped, target, distance) {
    const game = this.game;
    const origin = new THREE.Vector3(ped.pos.x + Math.sin(ped.heading) * 0.6, ped.pos.y + 1.4, ped.pos.z + Math.cos(ped.heading) * 0.6);
    const aim = new THREE.Vector3(target.x, (game.player.vehicle ? 0.9 : game.player.pos.y + 1.2), target.z);
    const dir = aim.sub(origin).normalize();
    // Officers get less accurate with distance and when Nico is moving fast.
    const spread = 0.03 + distance * 0.0025 + game.player.speed * 0.004;
    const hit = game.combat.fireBullet(origin, dir, { damage: POLICE.shootDamage, source: 'police', ignore: [ped], spread });
    if (hit.kind === 'vehicle' && hit.target === game.player.vehicle) hit.target.damage(2, 'police');
  }

  returnTo(ped, car, dt) {
    const door = car.doorPosition();
    const d = ped.moveToward(door.x, door.z, 5.4, dt, 12);
    if (d < 1.2) this.game.police.boardOfficer(this.unit, ped);
  }
}
