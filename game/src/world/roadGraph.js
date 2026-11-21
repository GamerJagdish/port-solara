// The road network as a graph: every grid intersection is a node joined to its neighbours. Drivers
// ask it for lane waypoints (right-hand traffic), random onward turns, and shortest routes; the
// minimap's GPS line uses the same routes.
import { CITY } from '../core/config.js';
import { nodeX, nodeZ, nearestNode } from './cityLayout.js';

const DIRS = [
  { di: 1, dj: 0 },
  { di: -1, dj: 0 },
  { di: 0, dj: 1 },
  { di: 0, dj: -1 },
];

export const nodeKey = (i, j) => j * (CITY.cols + 1) + i;
export const inGrid = (i, j) => i >= 0 && j >= 0 && i <= CITY.cols && j <= CITY.rows;

export function neighbours(i, j) {
  const out = [];
  for (const d of DIRS) if (inGrid(i + d.di, j + d.dj)) out.push({ i: i + d.di, j: j + d.dj });
  return out;
}

/**
 * Waypoints along the right-hand lane from node a to node b: one just past a's intersection and one
 * just before b's, so the driver swings through each junction on its own.
 */
export function laneWaypoints(a, b) {
  const ax = nodeX(a.i);
  const az = nodeZ(a.j);
  const bx = nodeX(b.i);
  const bz = nodeZ(b.j);
  const length = Math.hypot(bx - ax, bz - az);
  const dx = (bx - ax) / length;
  const dz = (bz - az) / length;
  const rx = -dz;
  const rz = dx;
  const lane = CITY.laneOffset;
  const inset = CITY.road / 2 + 1;
  return [
    { x: ax + dx * inset + rx * lane, z: az + dz * inset + rz * lane },
    { x: ax + dx * (length / 2) + rx * lane, z: az + dz * (length / 2) + rz * lane },
    { x: bx - dx * inset + rx * lane, z: bz - dz * inset + rz * lane },
  ];
}

/** A random onward node from `to`, arriving from `from`, avoiding U-turns where possible. */
export function nextNode(from, to, random) {
  const options = neighbours(to.i, to.j).filter((n) => !(n.i === from.i && n.j === from.j));
  if (options.length === 0) return from;
  // Prefer going straight a little more often than turning, as traffic does.
  const straight = options.find((n) => n.i - to.i === to.i - from.i && n.j - to.j === to.j - from.j);
  if (straight && random() < 0.45) return straight;
  return options[Math.floor(random() * options.length)];
}

/** Breadth-first shortest node path between two nodes (inclusive). */
export function findPath(start, goal) {
  const startKey = nodeKey(start.i, start.j);
  const goalKey = nodeKey(goal.i, goal.j);
  const previous = new Map([[startKey, null]]);
  const queue = [start];
  while (queue.length) {
    const node = queue.shift();
    const key = nodeKey(node.i, node.j);
    if (key === goalKey) break;
    for (const n of neighbours(node.i, node.j)) {
      const k = nodeKey(n.i, n.j);
      if (previous.has(k)) continue;
      previous.set(k, node);
      queue.push(n);
    }
  }
  if (!previous.has(goalKey)) return [start];
  const path = [];
  let node = goal;
  while (node) {
    path.unshift(node);
    node = previous.get(nodeKey(node.i, node.j));
  }
  return path;
}

/** The node route between two world points, for the GPS line. */
export function routeBetween(ax, az, bx, bz) {
  return findPath(nearestNode(ax, az), nearestNode(bx, bz)).map((n) => ({ x: nodeX(n.i), z: nodeZ(n.j) }));
}

/** The road segment (pair of nodes) a point lies on, with the travel direction best matching a heading. */
export function segmentAt(x, z, headingX, headingZ) {
  const n = nearestNode(x, z);
  const along = Math.abs(headingX) > Math.abs(headingZ);
  const dx = along ? Math.sign(headingX) || 1 : 0;
  const dz = along ? 0 : Math.sign(headingZ) || 1;
  let a = { i: n.i, j: n.j };
  // If the point is past the nearest node in the heading's direction, that node is the segment start.
  const ahead = (nodeX(a.i) - x) * dx + (nodeZ(a.j) - z) * dz;
  if (ahead > 0) a = { i: a.i - dx, j: a.j - dz };
  let b = { i: a.i + dx, j: a.j + dz };
  if (!inGrid(a.i, a.j) || !inGrid(b.i, b.j)) {
    a = { i: n.i, j: n.j };
    b = neighbours(n.i, n.j)[0];
  }
  return { a, b };
}
