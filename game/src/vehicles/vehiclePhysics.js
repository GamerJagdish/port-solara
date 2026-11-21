// Arcade car handling and car collisions. A car keeps a world velocity; each step the heading turns
// with speed and steering, the velocity is split into forward and sideways parts, the engine and brakes
// work on the forward part and tyre grip bleeds off the sideways part, so a handbrake turn slides.
import { clamp, damp } from '../core/mathUtils.js';
import { groundHeightAt } from '../world/groundHeight.js';

export function stepVehicle(vehicle, dt) {
  const type = vehicle.type;
  const c = vehicle.destroyed ? { throttle: 0, brake: 0, steer: 0, handbrake: true } : vehicle.controls;
  let fx = Math.sin(vehicle.heading);
  let fz = Math.cos(vehicle.heading);
  let vf = vehicle.vel.x * fx + vehicle.vel.z * fz;

  const speedFactor = 1 / (1 + Math.abs(vf) / 24);
  vehicle.steerAngle = damp(vehicle.steerAngle, c.steer * type.steer * speedFactor, 9, dt);
  const wheelbase = type.length * 0.62;
  let yawRate = (vf * Math.tan(vehicle.steerAngle)) / wheelbase;
  if (c.handbrake && Math.abs(vf) > 4) yawRate *= 1.45;
  vehicle.heading -= yawRate * dt;

  fx = Math.sin(vehicle.heading);
  fz = Math.cos(vehicle.heading);
  const rx = -Math.cos(vehicle.heading);
  const rz = Math.sin(vehicle.heading);
  vf = vehicle.vel.x * fx + vehicle.vel.z * fz;
  let vl = vehicle.vel.x * rx + vehicle.vel.z * rz;

  if (c.throttle > 0) {
    if (vf < -0.5) vf = Math.min(0, vf + type.brake * c.throttle * dt);
    else vf += type.accel * c.throttle * Math.max(0, 1 - vf / type.maxSpeed) * dt;
  }
  if (c.brake > 0) {
    if (vf > 0.5) vf = Math.max(0, vf - type.brake * c.brake * dt);
    else vf = Math.max(-type.maxSpeed * 0.32, vf - type.accel * 0.65 * c.brake * dt);
  }
  if (c.throttle === 0 && c.brake === 0) vf -= Math.sign(vf) * Math.min(Math.abs(vf), (1.4 + Math.abs(vf) * 0.06) * dt);
  if (c.handbrake) vf -= Math.sign(vf) * Math.min(Math.abs(vf), 7 * dt);

  const grip = vehicle.destroyed ? 3 : c.handbrake ? 1.3 : type.grip;
  vl *= Math.exp(-grip * dt);

  vehicle.vel.x = fx * vf + rx * vl;
  vehicle.vel.z = fz * vf + rz * vl;
  vehicle.pos.x += vehicle.vel.x * dt;
  vehicle.pos.z += vehicle.vel.z * dt;
  vehicle.pos.y = damp(vehicle.pos.y, groundHeightAt(vehicle.pos.x, vehicle.pos.z), 14, dt);
  vehicle.forwardSpeed = vf;
  vehicle.lateralSpeed = vl;
  vehicle.skidding = !vehicle.destroyed && (Math.abs(vl) > 3.2 || (c.handbrake && Math.abs(vf) > 6) || (c.brake > 0.5 && vf > 15));
}

/**
 * Pushes a car out of buildings and props and bounces its velocity off them. Returns the impact
 * speed of the hardest hit this step (0 when it touched nothing).
 */
export function collideWithWorld(vehicle, collision) {
  const f = vehicle.forward();
  const radius = vehicle.radius * 0.96;
  let hardest = 0;
  let normal = null;
  for (const offset of vehicle.collisionOffsets()) {
    const point = { x: vehicle.pos.x + f.x * offset, z: vehicle.pos.z + f.z * offset };
    const bx = point.x;
    const bz = point.z;
    const hit = collision.resolveCircle(point, radius);
    if (!hit) continue;
    vehicle.pos.x += point.x - bx;
    vehicle.pos.z += point.z - bz;
    const vn = vehicle.vel.x * hit.nx + vehicle.vel.z * hit.nz;
    if (vn < 0) {
      vehicle.vel.x -= hit.nx * vn * 1.3;
      vehicle.vel.z -= hit.nz * vn * 1.3;
      vehicle.vel.x *= 0.92;
      vehicle.vel.z *= 0.92;
      // An off-centre hit twists the car.
      const torque = (f.x * hit.nz - f.z * hit.nx) * offset;
      vehicle.heading += clamp(torque * -vn * 0.012, -0.12, 0.12);
      if (-vn > hardest) {
        hardest = -vn;
        normal = hit;
      }
    }
  }
  return hardest > 0 ? { impact: hardest, nx: normal.nx, nz: normal.nz } : null;
}

/** Separates two overlapping cars and exchanges momentum. Returns the impact speed, or 0. */
export function collideVehicles(a, b) {
  const reach = a.halfLength + b.halfLength + 0.5;
  const dx0 = a.pos.x - b.pos.x;
  const dz0 = a.pos.z - b.pos.z;
  if (dx0 * dx0 + dz0 * dz0 > reach * reach) return 0;
  const fa = a.forward();
  const fb = b.forward();
  const ma = a.type.mass * (a.destroyed ? 1.5 : 1);
  const mb = b.type.mass * (b.destroyed ? 1.5 : 1);
  let impact = 0;
  for (const oa of a.collisionOffsets()) {
    for (const ob of b.collisionOffsets()) {
      const ax = a.pos.x + fa.x * oa;
      const az = a.pos.z + fa.z * oa;
      const bx = b.pos.x + fb.x * ob;
      const bz = b.pos.z + fb.z * ob;
      const dx = ax - bx;
      const dz = az - bz;
      const dist = Math.hypot(dx, dz);
      const min = a.radius + b.radius;
      if (dist >= min || dist < 1e-4) continue;
      const nx = dx / dist;
      const nz = dz / dist;
      const overlap = min - dist;
      a.pos.x += nx * overlap * (mb / (ma + mb));
      a.pos.z += nz * overlap * (mb / (ma + mb));
      b.pos.x -= nx * overlap * (ma / (ma + mb));
      b.pos.z -= nz * overlap * (ma / (ma + mb));
      const vr = (a.vel.x - b.vel.x) * nx + (a.vel.z - b.vel.z) * nz;
      if (vr < 0) {
        const j = (-(1 + 0.35) * vr) / (1 / ma + 1 / mb);
        a.vel.x += (nx * j) / ma;
        a.vel.z += (nz * j) / ma;
        b.vel.x -= (nx * j) / mb;
        b.vel.z -= (nz * j) / mb;
        impact = Math.max(impact, -vr);
      }
    }
  }
  return impact;
}
