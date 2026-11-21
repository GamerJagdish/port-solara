// The AI of a police cruiser in pursuit. Far away or out of sight it routes along the road grid to
// where Nico was last seen; close and in sight it drives straight at him, each car taking a slot
// (ram from behind, pull alongside left or right, or cut him off ahead) so together they box him in.
// It feels its way past walls with whisker rays and backs out when stuck.
import { findPath } from '../world/roadGraph.js';
import { nearestNode, nodeX, nodeZ } from '../world/cityLayout.js';
import { clamp, wrapAngle } from '../core/mathUtils.js';

const SLOTS = [
  { ahead: 0, side: 0 },
  { ahead: -0.5, side: -3.6 },
  { ahead: -0.5, side: 3.6 },
  { ahead: 9, side: 0 },
  { ahead: -7, side: 0 },
];

export class PursuitDriver {
  constructor(game, vehicle, slot) {
    this.game = game;
    this.vehicle = vehicle;
    this.slot = SLOTS[slot % SLOTS.length];
    this.slotIndex = slot;
    this.route = [];
    this.replan = 0;
    this.stuckTime = 0;
    this.reverseTime = 0;
    this.reverseSteer = 1;
    this.mode = 'route';
    this.holdPosition = false;
  }

  /** Where the cruiser wants to be this step. */
  goal() {
    const game = this.game;
    const wanted = game.wanted;
    const player = game.player;
    const seen = wanted.seen;
    const target = seen ? { x: player.focus.x, z: player.focus.z } : wanted.lastSeen;
    return { target, seen };
  }

  update(dt) {
    const game = this.game;
    const v = this.vehicle;
    const c = v.controls;
    v.sirenOn = game.wanted.stars > 0;
    if (this.reverseTime > 0) {
      this.reverseTime -= dt;
      c.throttle = 0;
      c.brake = 1;
      c.handbrake = false;
      c.steer = this.reverseSteer;
      return;
    }
    const { target, seen } = this.goal();
    const player = game.player;
    const dx = target.x - v.pos.x;
    const dz = target.z - v.pos.z;
    const distance = Math.hypot(dx, dz);
    const clear = distance < 55 && !game.city.collision.segmentBlocked(v.pos.x, v.pos.z, target.x, target.z, 1.5);

    let aim;
    let desiredSpeed;
    if (clear && seen) {
      this.mode = 'direct';
      if (player.vehicle) {
        const pv = player.vehicle;
        const f = pv.forward();
        const lead = Math.min(1.2, distance / 25);
        // The rammer parks on the bumper once the suspect has stopped.
        const ahead = this.slot.ahead === 0 && pv.speed < 3 ? -(pv.halfLength + v.halfLength + 0.8) : this.slot.ahead;
        const ax = pv.pos.x + pv.vel.x * lead + f.x * ahead - f.z * this.slot.side;
        const az = pv.pos.z + pv.vel.z * lead + f.z * ahead + f.x * this.slot.side;
        aim = { x: ax, z: az };
        const toAim = Math.hypot(ax - v.pos.x, az - v.pos.z);
        desiredSpeed = Math.max(pv.speed + clamp(toAim * 0.7, -8, 14), 8);
        // In contact: bump, then hold station instead of shoving the car down the road.
        const contact = v.halfLength + pv.halfLength + 2.5;
        if (distance < contact) desiredSpeed = Math.min(desiredSpeed, pv.speed * 0.85);
        // A stopped suspect gets boxed in: pull up tight around the car and stop.
        if (pv.speed < 3 && distance < 16) desiredSpeed = Math.max(0, (toAim - 1.5) * 0.9);
      } else {
        aim = target;
        // Pull up near a suspect on foot rather than running them down.
        desiredSpeed = distance > 14 ? 22 : 0;
        this.holdPosition = distance <= 14;
      }
    } else {
      this.mode = 'route';
      this.replan -= dt;
      if (this.replan <= 0 || this.route.length === 0) {
        this.replan = 1.2;
        const path = findPath(nearestNode(v.pos.x, v.pos.z), nearestNode(target.x, target.z));
        this.route = path.map((n) => ({ x: nodeX(n.i), z: nodeZ(n.j) }));
        this.route.push({ x: target.x, z: target.z });
        // Drop the junction the cruiser has already driven past, so it never doubles back.
        const gap = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
        while (this.route.length > 1 && gap(v.pos, this.route[1]) <= gap(this.route[0], this.route[1]) + 2) this.route.shift();
      }
      while (this.route.length > 1 && Math.hypot(this.route[0].x - v.pos.x, this.route[0].z - v.pos.z) < 9) this.route.shift();
      aim = this.route[0];
      const ahead = this.route[1];
      desiredSpeed = 30;
      if (ahead) {
        const turn = Math.abs(wrapAngle(Math.atan2(ahead.x - aim.x, ahead.z - aim.z) - Math.atan2(aim.x - v.pos.x, aim.z - v.pos.z)));
        const toCorner = Math.hypot(aim.x - v.pos.x, aim.z - v.pos.z);
        if (turn > 0.6 && toCorner < 30) desiredSpeed = 13;
      }
      if (!seen && distance < game.wanted.searchRadius * 0.4) desiredSpeed = 12;
    }

    let heading = Math.atan2(aim.x - v.pos.x, aim.z - v.pos.z);
    heading += this.whiskers();
    const error = wrapAngle(heading - v.heading);
    c.steer = clamp(-error * 2.2, -1, 1);
    c.handbrake = Math.abs(error) > 1.2 && v.forwardSpeed > 14;
    if (Math.abs(error) > 0.9) desiredSpeed = Math.min(desiredSpeed, 12);
    const speedError = desiredSpeed - v.forwardSpeed;
    c.throttle = speedError > 0.5 ? clamp(speedError / 5, 0.25, 1) : 0;
    c.brake = speedError < -1 ? clamp(-speedError / 6, 0.3, 1) : 0;
    // Targets behind the car: turn around in a reverse arc.
    if (Math.abs(error) > 2.3 && v.speed < 6 && distance > 6) {
      c.throttle = 0;
      c.brake = 1;
      c.steer = error > 0 ? 1 : -1;
    }

    if ((c.throttle > 0.3 || c.brake > 0.9) && v.speed < 0.8 && !this.holdPosition) this.stuckTime += dt;
    else this.stuckTime = Math.max(0, this.stuckTime - dt * 0.5);
    if (this.stuckTime > 1.4) {
      this.stuckTime = 0;
      this.reverseTime = 1.1;
      this.reverseSteer = error > 0 ? 1 : -1;
      this.replan = 0;
    }
  }

  /** A steering nudge away from walls just ahead, felt with three short rays. */
  whiskers() {
    const v = this.vehicle;
    const collision = this.game.city.collision;
    const reach = 5 + Math.max(0, v.forwardSpeed) * 0.35;
    const probe = (angle) => {
      const h = v.heading + angle;
      return collision.raycast(v.pos.x, v.pos.z, Math.sin(h), Math.cos(h), reach, 1);
    };
    const left = probe(0.45);
    const right = probe(-0.45);
    const front = probe(0);
    if (front > reach && left > reach && right > reach) return 0;
    // Positive heading change turns left (towards +heading).
    if (left < right) return -0.6;
    if (right < left) return 0.6;
    return front < reach ? 0.8 : 0;
  }
}
