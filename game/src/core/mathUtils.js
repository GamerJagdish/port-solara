// Small numeric helpers used across the simulation (angles, easing, 2D vectors on the ground plane).

export const clamp = (value, min, max) => (value < min ? min : value > max ? max : value);
export const lerp = (a, b, t) => a + (b - a) * t;
export const damp = (current, target, rate, dt) => lerp(current, target, 1 - Math.exp(-rate * dt));

/** Wraps an angle to (-PI, PI]. */
export function wrapAngle(angle) {
  let a = angle % (Math.PI * 2);
  if (a > Math.PI) a -= Math.PI * 2;
  if (a <= -Math.PI) a += Math.PI * 2;
  return a;
}

/** Eases an angle toward a target along the shorter way round. */
export function dampAngle(current, target, rate, dt) {
  return current + wrapAngle(target - current) * (1 - Math.exp(-rate * dt));
}

/** Heading (rotation.y) that faces the ground direction (dx, dz); models face +z at heading 0. */
export const headingOf = (dx, dz) => Math.atan2(dx, dz);

export const distance2D = (ax, az, bx, bz) => Math.hypot(bx - ax, bz - az);

/** Forward ground vector for a heading. */
export const forwardOf = (heading) => ({ x: Math.sin(heading), z: Math.cos(heading) });

/** Right-hand ground vector for a heading (x east, z south, y up). */
export const rightOf = (heading) => ({ x: -Math.cos(heading), z: Math.sin(heading) });

export function formatCash(amount) {
  return '$' + Math.max(0, Math.floor(amount)).toLocaleString('en-US');
}
