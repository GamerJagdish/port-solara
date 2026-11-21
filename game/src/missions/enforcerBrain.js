// Haldane's enforcers: they loiter at their post until Nico comes close or opens fire, then draw
// pistols, spread out, keep their distance and shoot. Wounded ones press in angrily.
import * as THREE from 'three';

export class EnforcerBrain {
  constructor(game, post) {
    this.game = game;
    this.post = post;
    this.alert = false;
    this.shootTimer = 0.6 + game.dice.next() * 1.2;
    this.strafe = game.dice.sign();
    this.idleTurn = game.dice.next() * Math.PI * 2;
  }

  onHurt() {
    this.alert = true;
  }

  update(ped, dt) {
    const game = this.game;
    const player = game.player;
    const target = player.vehicle ? player.vehicle.pos : player.pos;
    const dx = target.x - ped.pos.x;
    const dz = target.z - ped.pos.z;
    const distance = Math.hypot(dx, dz);
    if (!this.alert && (distance < 22 || ped.health < ped.maxHealth)) this.alert = true;
    ped.armed = true;
    if (!this.alert || player.dead) {
      ped.aiming = false;
      ped.stop();
      this.idleTurn += dt * 0.3;
      ped.heading = this.post.heading ?? ped.heading;
      return;
    }
    const sight = !game.city.collision.segmentBlocked(ped.pos.x, ped.pos.z, target.x, target.z, 1.5);
    ped.aiming = sight && distance < 40;
    if (distance > 16 || !sight) {
      ped.moveToward(target.x, target.z, 4.8, dt, 12);
    } else if (distance < 6) {
      ped.moveToward(ped.pos.x - dx, ped.pos.z - dz, 3.2, dt, 12);
    } else {
      ped.vel.x = (-dz / distance) * this.strafe * 1.6;
      ped.vel.z = (dx / distance) * this.strafe * 1.6;
    }
    ped.face(target.x, target.z, dt, 14);
    if (!ped.aiming) return;
    this.shootTimer -= dt;
    if (this.shootTimer <= 0) {
      this.shootTimer = 0.8 + game.dice.next() * 1.0;
      if (game.dice.chance(0.3)) this.strafe = -this.strafe;
      const origin = new THREE.Vector3(ped.pos.x + Math.sin(ped.heading) * 0.6, ped.pos.y + 1.4, ped.pos.z + Math.cos(ped.heading) * 0.6);
      const aim = new THREE.Vector3(target.x, player.vehicle ? 0.9 : player.pos.y + 1.2, target.z);
      const dir = aim.sub(origin).normalize();
      game.combat.fireBullet(origin, dir, { damage: 6, source: 'npc', ignore: [ped], spread: 0.045 + distance * 0.002 });
    }
  }
}
