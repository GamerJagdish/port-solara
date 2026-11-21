// Walking routes for pedestrians: each block is ringed by a sidewalk loop that people stroll around,
// with crossings to the next block at the corners, and the sand of Coral Beach for beachgoers.
import { CITY } from '../core/config.js';
import { blockCenterX, blockCenterZ } from '../world/cityLayout.js';

export const RING_HALF = CITY.block / 2 - CITY.sidewalk / 2;
const PERIMETER = RING_HALF * 8;

export function ringOf(bi, bj) {
  return { bi, bj, cx: blockCenterX(bi), cz: blockCenterZ(bj), half: RING_HALF };
}

/** The point at distance s around a ring (clockwise from the north-west corner), nudged sideways by `offset`. */
export function ringPoint(ring, s, offset = 0) {
  const h = ring.half;
  const t = ((s % PERIMETER) + PERIMETER) % PERIMETER;
  const side = Math.floor(t / (2 * h));
  const along = t - side * 2 * h;
  const o = h + offset;
  switch (side) {
    case 0: return { x: ring.cx - h + along, z: ring.cz - o };
    case 1: return { x: ring.cx + o, z: ring.cz - h + along };
    case 2: return { x: ring.cx + h - along, z: ring.cz + o };
    default: return { x: ring.cx - o, z: ring.cz + h - along };
  }
}

/** The ring distance nearest a point. */
export function ringParam(ring, x, z) {
  const h = ring.half;
  const dx = x - ring.cx;
  const dz = z - ring.cz;
  const clampH = (v) => Math.max(-h, Math.min(h, v));
  if (Math.abs(dz) >= Math.abs(dx)) {
    return dz < 0 ? clampH(dx) + h : 4 * h + (h - clampH(dx));
  }
  return dx > 0 ? 2 * h + (clampH(dz) + h) : 6 * h + (h - clampH(dz));
}

export const ringPerimeter = () => PERIMETER;

/** The block whose ring is nearest a point. */
export function nearestRing(x, z) {
  const bi = Math.max(0, Math.min(CITY.cols - 1, Math.floor((x - CITY.originX) / CITY.pitch)));
  const bj = Math.max(0, Math.min(CITY.rows - 1, Math.floor((z - CITY.originZ) / CITY.pitch)));
  return ringOf(bi, bj);
}

/** True when s sits at one of the ring's corners (within `tolerance` metres). */
export function atCorner(s, tolerance = 0.6) {
  const t = ((s % PERIMETER) + PERIMETER) % PERIMETER;
  const along = t % (2 * RING_HALF);
  return along < tolerance || along > 2 * RING_HALF - tolerance;
}

/** The ring across the street from a corner, and where on it to arrive. */
export function crossingFrom(ring, s, random) {
  const corner = ringPoint(ring, Math.round(s / (2 * RING_HALF)) * 2 * RING_HALF);
  const east = corner.x > ring.cx;
  const south = corner.z > ring.cz;
  const options = [];
  if (east && ring.bi < CITY.cols - 1) options.push({ bi: ring.bi + 1, bj: ring.bj, dx: 1, dz: 0 });
  if (!east && ring.bi > 0) options.push({ bi: ring.bi - 1, bj: ring.bj, dx: -1, dz: 0 });
  if (south && ring.bj < CITY.rows - 1) options.push({ bi: ring.bi, bj: ring.bj + 1, dx: 0, dz: 1 });
  if (!south && ring.bj > 0) options.push({ bi: ring.bi, bj: ring.bj - 1, dx: 0, dz: -1 });
  if (options.length === 0) return null;
  const choice = options[Math.floor(random() * options.length)];
  const next = ringOf(choice.bi, choice.bj);
  const gap = CITY.pitch - 2 * RING_HALF;
  const target = { x: corner.x + choice.dx * gap, z: corner.z + choice.dz * gap };
  return { ring: next, target, s: ringParam(next, target.x, target.z) };
}

/** A random spot on the dry sand of Coral Beach. */
export function beachSpot(random) {
  const top = CITY.maxZ + CITY.road / 2 + 8;
  return { x: CITY.minX + 15 + random() * (CITY.cols * CITY.pitch - 160), z: top + random() * (CITY.beachDepth - 18) };
}
