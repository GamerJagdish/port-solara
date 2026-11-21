// How high the walkable ground is at a point: roads sit at 0, curbs raise sidewalks and lots.
import { CITY } from '../core/config.js';

export const CURB_HEIGHT = 0.15;

export function groundHeightAt(x, z) {
  const half = CITY.road / 2;
  if (x < CITY.minX + half || x > CITY.maxX - half || z < CITY.minZ + half || z > CITY.maxZ - half) return 0;
  const fx = (((x - CITY.originX) % CITY.pitch) + CITY.pitch) % CITY.pitch;
  const fz = (((z - CITY.originZ) % CITY.pitch) + CITY.pitch) % CITY.pitch;
  const onRoad = fx <= half || fx >= CITY.pitch - half || fz <= half || fz >= CITY.pitch - half;
  return onRoad ? 0 : CURB_HEIGHT;
}
