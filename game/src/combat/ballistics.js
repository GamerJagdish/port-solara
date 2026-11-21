// Hit-scan shooting geometry: rays against people (upright cylinders, or low boxes when down), cars
// (oriented boxes) and the city's walls, returning the nearest thing a bullet would strike.
import * as THREE from 'three';

/** Distance along a 3D ray (unit dir) to an upright cylinder, or Infinity. */
function rayCylinder(origin, dir, cx, cz, radius, bottom, top) {
  const ox = origin.x - cx;
  const oz = origin.z - cz;
  const a = dir.x * dir.x + dir.z * dir.z;
  if (a < 1e-8) return Infinity;
  const b = ox * dir.x + oz * dir.z;
  const c = ox * ox + oz * oz - radius * radius;
  const disc = b * b - a * c;
  if (disc < 0) return Infinity;
  const t = (-b - Math.sqrt(disc)) / a;
  if (t < 0) return Infinity;
  const y = origin.y + dir.y * t;
  return y >= bottom && y <= top ? t : Infinity;
}

/** Distance along a ray to a car's body box, or Infinity. */
function rayVehicle(origin, dir, vehicle) {
  const cos = Math.cos(vehicle.heading);
  const sin = Math.sin(vehicle.heading);
  // Into the car's frame (x across, z along).
  const px = origin.x - vehicle.pos.x;
  const pz = origin.z - vehicle.pos.z;
  const lo = { x: px * cos - pz * sin, y: origin.y - vehicle.pos.y, z: px * sin + pz * cos };
  const ld = { x: dir.x * cos - dir.z * sin, y: dir.y, z: dir.x * sin + dir.z * cos };
  const min = { x: -vehicle.radius, y: 0.25, z: -vehicle.halfLength };
  const max = { x: vehicle.radius, y: vehicle.type.height, z: vehicle.halfLength };
  let tMin = 0;
  let tMax = Infinity;
  for (const axis of ['x', 'y', 'z']) {
    if (Math.abs(ld[axis]) < 1e-9) {
      if (lo[axis] < min[axis] || lo[axis] > max[axis]) return Infinity;
      continue;
    }
    const t1 = (min[axis] - lo[axis]) / ld[axis];
    const t2 = (max[axis] - lo[axis]) / ld[axis];
    tMin = Math.max(tMin, Math.min(t1, t2));
    tMax = Math.min(tMax, Math.max(t1, t2));
    if (tMax < tMin) return Infinity;
  }
  return tMin;
}

/**
 * The first thing a ray hits within `range`: { kind: 'ped'|'player'|'vehicle'|'world'|'none', target, t, point }.
 * `ignore` holds the shooter (and the car they sit in) so a gun never hits its own holder.
 */
export function traceShot(game, origin, dir, range, ignore = []) {
  let best = { kind: 'none', target: null, t: range };
  for (const ped of game.peds.list) {
    if (ignore.includes(ped) || (ped.dead && ped.fallen >= 1)) continue;
    const t = ped.fallen > 0.5 ? rayCylinder(origin, dir, ped.pos.x, ped.pos.z, 0.6, ped.pos.y, ped.pos.y + 0.5) : rayCylinder(origin, dir, ped.pos.x, ped.pos.z, 0.38, ped.pos.y, ped.pos.y + 1.85);
    if (t < best.t) best = { kind: 'ped', target: ped, t };
  }
  const player = game.player;
  if (!ignore.includes(player) && !player.vehicle && !player.dead) {
    const t = rayCylinder(origin, dir, player.pos.x, player.pos.z, 0.4, player.pos.y, player.pos.y + 1.85);
    if (t < best.t) best = { kind: 'player', target: player, t };
  }
  for (const vehicle of game.vehicles.list) {
    if (ignore.includes(vehicle)) continue;
    const t = rayVehicle(origin, dir, vehicle);
    if (t < best.t) best = { kind: 'vehicle', target: vehicle, t };
  }
  const flat = Math.hypot(dir.x, dir.z);
  if (flat > 1e-4) {
    const t2 = game.city.collision.raycast(origin.x, origin.z, dir.x / flat, dir.z / flat, best.t * flat, 0.5);
    if (t2 / flat < best.t) best = { kind: 'world', target: null, t: t2 / flat };
  }
  if (dir.y < -1e-4) {
    const tGround = -origin.y / dir.y;
    if (tGround > 0 && tGround < best.t) best = { kind: 'world', target: null, t: tGround };
  }
  best.point = new THREE.Vector3(origin.x + dir.x * best.t, origin.y + dir.y * best.t, origin.z + dir.z * best.t);
  return best;
}
