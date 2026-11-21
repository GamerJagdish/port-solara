// The AI behind the wheel of a civilian car: it follows the right-hand lane waypoints of the road graph
// with pure-pursuit steering, picks a random onward turn at each junction, slows for corners, brakes
// for anything in its lane (cars, the player, people crossing), honks when held up, and backs out when
// it gets stuck. A spooked driver (shots, a crash, a carjacking nearby) floors it.
import { laneWaypoints, nextNode, segmentAt } from '../world/roadGraph.js';
import { clamp, wrapAngle } from '../core/mathUtils.js';
import { TRAFFIC } from '../core/config.js';

export class RoadDriver {
  constructor(game, vehicle, { cruise = TRAFFIC.cruiseSpeed } = {}) {
    this.game = game;
    this.vehicle = vehicle;
    this.cruise = cruise * (0.85 + game.dice.next() * 0.3);
    this.route = [];
    this.from = null;
    this.to = null;
    this.blockedBy = null;
    this.blockedTime = 0;
    this.stuckTime = 0;
    this.reverseTime = 0;
    this.panic = 0;
    this.honkCooldown = 0;
    this.halt = 0;
  }

  /** Stops dead for a moment (someone is yanking the door open). */
  holdFor(seconds) {
    this.halt = Math.max(this.halt, seconds);
  }

  /** Puts the driver on the segment a → b, keeping only waypoints still ahead of the car. */
  startOn(a, b) {
    this.from = a;
    this.to = b;
    const f = this.vehicle.forward();
    this.route = laneWaypoints(a, b).filter((p) => (p.x - this.vehicle.pos.x) * f.x + (p.z - this.vehicle.pos.z) * f.z > 2);
    if (this.route.length < 2) this.extend();
  }

  /** Picks up from wherever the car is now (after a chase, a crash or being stolen back). */
  rejoinRoad() {
    const f = this.vehicle.forward();
    const { a, b } = segmentAt(this.vehicle.pos.x, this.vehicle.pos.z, f.x, f.z);
    this.startOn(a, b);
  }

  extend() {
    const next = nextNode(this.from, this.to, this.game.dice.next);
    this.from = this.to;
    this.to = next;
    this.route.push(...laneWaypoints(this.from, this.to));
  }

  /** Something in the lane ahead within braking distance, or null. */
  findObstacle() {
    const v = this.vehicle;
    const f = v.forward();
    const rx = -f.z;
    const rz = f.x;
    const look = v.halfLength + 4 + Math.max(0, v.forwardSpeed) * 0.85;
    let nearest = null;
    let nearestAhead = Infinity;
    const consider = (x, z, halfWidth, who) => {
      const dx = x - v.pos.x;
      const dz = z - v.pos.z;
      const ahead = dx * f.x + dz * f.z;
      if (ahead <= 0 || ahead > look + halfWidth) return;
      const side = Math.abs(dx * rx + dz * rz);
      if (side > 1.6 + halfWidth) return;
      if (ahead < nearestAhead) {
        nearestAhead = ahead;
        nearest = who;
      }
    };
    for (const other of this.game.vehicles.list) {
      if (other === v) continue;
      if (Math.abs(other.pos.x - v.pos.x) > 30 || Math.abs(other.pos.z - v.pos.z) > 30) continue;
      // Yield-deadlocks: of two cars blocking each other, the older one goes first.
      if (other.ai && other.ai.blockedBy === v && other.id > v.id) continue;
      consider(other.pos.x, other.pos.z, other.radius, other);
    }
    const player = this.game.player;
    if (!player.vehicle && !player.dead) consider(player.pos.x, player.pos.z, 0.4, player);
    for (const ped of this.game.peds.list) {
      if (ped.dead || Math.abs(ped.pos.x - v.pos.x) > 20 || Math.abs(ped.pos.z - v.pos.z) > 20) continue;
      consider(ped.pos.x, ped.pos.z, 0.4, ped);
    }
    return nearest ? { who: nearest, distance: nearestAhead } : null;
  }

  update(dt) {
    const v = this.vehicle;
    const c = v.controls;
    this.honkCooldown -= dt;
    this.panic = Math.max(0, this.panic - dt);
    if (this.halt > 0) {
      this.halt -= dt;
      c.throttle = 0;
      c.brake = 1;
      c.handbrake = false;
      return;
    }
    if (this.route.length === 0) this.rejoinRoad();
    while (this.route.length && Math.hypot(this.route[0].x - v.pos.x, this.route[0].z - v.pos.z) < 4.5) this.route.shift();
    while (this.route.length < 4) this.extend();

    if (this.reverseTime > 0) {
      this.reverseTime -= dt;
      c.throttle = 0;
      c.brake = 1;
      c.steer = this.reverseSteer;
      c.handbrake = false;
      if (this.reverseTime <= 0) this.rejoinRoad();
      return;
    }

    const lookahead = 5 + Math.max(0, v.forwardSpeed) * 0.45;
    let target = this.route[this.route.length - 1];
    for (const point of this.route) {
      if (Math.hypot(point.x - v.pos.x, point.z - v.pos.z) >= lookahead) {
        target = point;
        break;
      }
    }
    const desiredHeading = Math.atan2(target.x - v.pos.x, target.z - v.pos.z);
    const error = wrapAngle(desiredHeading - v.heading);
    c.steer = clamp(-error * 1.8, -1, 1);
    c.handbrake = false;

    let desired = this.panic > 0 ? this.cruise * 1.7 : this.cruise;
    if (Math.abs(error) > 0.3) desired *= 0.5;
    const obstacle = this.findObstacle();
    this.blockedBy = null;
    if (obstacle) {
      const room = obstacle.distance - v.halfLength - 2.5;
      desired = Math.min(desired, Math.max(0, room * 0.9));
      if (room < 6) {
        this.blockedBy = obstacle.who;
        this.blockedTime += dt;
        if (this.blockedTime > 2.5 && this.honkCooldown <= 0) {
          this.honkCooldown = 4 + this.game.dice.next() * 3;
          this.game.events.emit('vehicle:honk', { vehicle: v });
        }
      }
    } else {
      this.blockedTime = 0;
    }
    const speedError = desired - v.forwardSpeed;
    c.throttle = speedError > 0.3 ? clamp(speedError / 4, 0.2, 1) : 0;
    c.brake = speedError < -0.8 ? clamp(-speedError / 5, 0.25, 1) : 0;

    // Stuck against something that is not a car in the lane: back out and try again.
    if (c.throttle > 0.3 && v.speed < 0.7 && !this.blockedBy) this.stuckTime += dt;
    else this.stuckTime = Math.max(0, this.stuckTime - dt);
    if (this.stuckTime > 1.6) {
      this.stuckTime = 0;
      this.reverseTime = 1.3;
      this.reverseSteer = error > 0 ? 1 : -1;
    }
  }
}
