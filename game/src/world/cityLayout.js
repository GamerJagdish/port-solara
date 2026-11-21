// The plan of Port Solara as plain data: the road grid, which district each block belongs to, the
// landmarks the story uses, and every building footprint and prop, decided from the seed. The 3D
// builder, the collision world, the minimap and the AI all read this one plan.
import { CITY } from '../core/config.js';
import { hash2 } from '../core/random.js';

export const DISTRICTS = {
  downtown: { name: 'Downtown Meridian', map: '#b9b2a8' },
  strip: { name: 'Sunset Strip', map: '#d7c3a6' },
  heights: { name: 'Palmetto Heights', map: '#a9c48c' },
  beachfront: { name: 'Coral Beach', map: '#e6cfa0' },
  docks: { name: 'Saltworks Docks', map: '#a3a5a8' },
  park: { name: 'Meridian Plaza', map: '#8fbf6a' },
};

/** Named places the story, shops and respawns use, by block. */
export const LANDMARK_BLOCKS = {
  luckyGull: { bi: 8, bj: 6 },
  haldaneTower: { bi: 5, bj: 2 },
  plaza: { bi: 4, bj: 3 },
  policeStation: { bi: 3, bj: 6 },
  hospital: { bi: 1, bj: 2 },
  gunShop: { bi: 7, bj: 4 },
  tacoStand: { bi: 1, bj: 5 },
  surfShack: { bi: 5, bj: 7 },
};

export const nodeX = (i) => CITY.originX + i * CITY.pitch;
export const nodeZ = (j) => CITY.originZ + j * CITY.pitch;
export const blockCenterX = (bi) => CITY.originX + (bi + 0.5) * CITY.pitch;
export const blockCenterZ = (bj) => CITY.originZ + (bj + 0.5) * CITY.pitch;

export function districtOfBlock(bi, bj) {
  const park = LANDMARK_BLOCKS.plaza;
  if (bi === park.bi && bj === park.bj) return 'park';
  if (bi >= 8) return 'docks';
  if (bj === CITY.rows - 1) return 'beachfront';
  if (bi <= 2) return 'heights';
  if (bi >= 3 && bi <= 6 && bj >= 1 && bj <= 4) return 'downtown';
  return 'strip';
}

/** The district under a ground point, including the beach and the quay outside the grid. */
export function districtAt(x, z) {
  if (z > CITY.maxZ + CITY.road / 2) return 'beachfront';
  if (x > CITY.maxX + CITY.road / 2) return 'docks';
  const bi = Math.min(CITY.cols - 1, Math.max(0, Math.floor((x - CITY.originX) / CITY.pitch)));
  const bj = Math.min(CITY.rows - 1, Math.max(0, Math.floor((z - CITY.originZ) / CITY.pitch)));
  return districtOfBlock(bi, bj);
}

/** The road node (grid intersection) nearest a point. */
export function nearestNode(x, z) {
  const i = Math.min(CITY.cols, Math.max(0, Math.round((x - CITY.originX) / CITY.pitch)));
  const j = Math.min(CITY.rows, Math.max(0, Math.round((z - CITY.originZ) / CITY.pitch)));
  return { i, j };
}

/** True when a ground point is on a road surface. */
export function isOnRoad(x, z) {
  const half = CITY.road / 2;
  const fx = (((x - CITY.originX) % CITY.pitch) + CITY.pitch) % CITY.pitch;
  const fz = (((z - CITY.originZ) % CITY.pitch) + CITY.pitch) % CITY.pitch;
  const inX = x >= CITY.minX - half && x <= CITY.maxX + half;
  const inZ = z >= CITY.minZ - half && z <= CITY.maxZ + half;
  if (!inX || !inZ) return false;
  return fx <= half || fx >= CITY.pitch - half || fz <= half || fz >= CITY.pitch - half;
}

const PASTELS = ['#f7c6b5', '#f9e0a8', '#bfe3dc', '#c9d7f2', '#f4b7c8', '#fde7d0', '#d8f0c2', '#f6d0e6', '#ffe9b8', '#c5ece9'];
const TOWER_TINTS = ['#bcd6e8', '#d9c9b0', '#c8d2da', '#a9d1cf', '#e1d6c9', '#b6c4dd'];
const AWNINGS = ['#e85d4a', '#2a9d8f', '#f4a261', '#3d7ec8', '#e76f9a', '#f2c14e'];

function pick(list, r) {
  return list[Math.floor(r * list.length) % list.length];
}

/** Buildings and props of one block, from its district and its own stable hash. */
function planBlock(bi, bj, seed) {
  const district = districtOfBlock(bi, bj);
  const cx = blockCenterX(bi);
  const cz = blockCenterZ(bj);
  const inner = CITY.block / 2 - CITY.sidewalk;
  const r = (k) => hash2(bi * 7 + seed, bj * 13, k);
  const buildings = [];
  const props = [];
  const block = { bi, bj, district, cx, cz, buildings, props, lot: 'paved' };

  if (district === 'park') {
    block.lot = 'plaza';
    props.push({ type: 'fountain', x: cx, z: cz });
    for (let k = 0; k < 10; k += 1) {
      const a = (k / 10) * Math.PI * 2;
      props.push({ type: 'palm', x: cx + Math.cos(a) * 17, z: cz + Math.sin(a) * 17, height: 9 + r(k) * 4 });
    }
    props.push({ type: 'statue', x: cx, z: cz - 12 });
    return block;
  }

  if (district === 'downtown') {
    block.lot = 'plaza';
    if (bi === LANDMARK_BLOCKS.haldaneTower.bi && bj === LANDMARK_BLOCKS.haldaneTower.bj) {
      buildings.push({ x: cx, z: cz, w: 30, d: 30, h: 152, style: 'tower', tint: '#b8cfe0', crown: 'HALDANE', landmark: 'haldaneTower' });
      props.push({ type: 'palm', x: cx - 20, z: cz + 20, height: 10 }, { type: 'palm', x: cx + 20, z: cz + 20, height: 10 });
      return block;
    }
    const half = inner / 2;
    for (let k = 0; k < 4; k += 1) {
      const qx = cx + (k % 2 === 0 ? -half : half);
      const qz = cz + (k < 2 ? -half : half);
      if (r(k + 40) < 0.18) {
        props.push({ type: 'palm', x: qx, z: qz, height: 9 });
        continue;
      }
      const tall = r(k + 50);
      const h = 34 + Math.floor(tall * tall * 90);
      const w = 17 + r(k + 60) * 5;
      const d = 17 + r(k + 70) * 5;
      buildings.push({ x: qx, z: qz, w, d, h, style: 'tower', tint: pick(TOWER_TINTS, r(k + 80)), setback: h > 70 });
    }
    if (r(9) < 0.5) buildings[0] && (buildings[0].billboard = pick(BILLBOARDS, r(10)));
    return block;
  }

  if (district === 'heights') {
    block.lot = 'grass';
    const isHospital = bi === LANDMARK_BLOCKS.hospital.bi && bj === LANDMARK_BLOCKS.hospital.bj;
    if (isHospital) {
      buildings.push({ x: cx, z: cz - 4, w: 40, d: 26, h: 22, style: 'stucco', tint: '#f3f6f8', sign: 'hospital', landmark: 'hospital' });
      props.push({ type: 'palm', x: cx - 16, z: cz + 16, height: 10 }, { type: 'palm', x: cx + 16, z: cz + 16, height: 11 });
      return block;
    }
    for (let k = 0; k < 4; k += 1) {
      const qx = cx + (k % 2 === 0 ? -12 : 12);
      const qz = cz + (k < 2 ? -12 : 12);
      const w = 12 + r(k + 1) * 4;
      const d = 10 + r(k + 2) * 3;
      buildings.push({ x: qx, z: qz, w, d, h: r(k + 3) < 0.4 ? 7 : 3.6, style: 'house', tint: pick(PASTELS, r(k + 4)), roof: 'tile' });
      const poolX = qx + (k % 2 === 0 ? -1 : 1) * 2;
      const poolZ = qz + (k < 2 ? -1 : 1) * 8.6;
      if (r(k + 5) < 0.6) props.push({ type: 'pool', x: poolX, z: poolZ, w: 7, d: 3.4 });
      props.push({ type: 'palm', x: qx + (k % 2 === 0 ? 1 : -1) * 9.5, z: qz + (k < 2 ? 1 : -1) * 9.5, height: 8 + r(k + 6) * 5 });
    }
    if (bi === LANDMARK_BLOCKS.tacoStand.bi && bj === LANDMARK_BLOCKS.tacoStand.bj) {
      props.push({ type: 'tacoTruck', x: cx + inner - 2.6, z: cz - 1 });
    }
    return block;
  }

  if (district === 'docks') {
    block.lot = 'concrete';
    if (bi === LANDMARK_BLOCKS.luckyGull.bi && bj === LANDMARK_BLOCKS.luckyGull.bj) {
      buildings.push({ x: cx - 13, z: cz, w: 18, d: 14, h: 6, style: 'house', tint: '#a8d8e0', sign: 'luckyGull', landmark: 'luckyGull' });
      buildings.push({ x: cx + 10, z: cz - 6, w: 22, d: 30, h: 11, style: 'warehouse', tint: '#d9e2e8' });
      props.push({ type: 'containers', x: cx + 10, z: cz + 17, w: 22, d: 6, levels: 2 });
      return block;
    }
    const twin = r(1) < 0.5;
    if (twin) {
      buildings.push({ x: cx, z: cz - 11, w: 44, d: 18, h: 10 + r(2) * 5, style: 'warehouse', tint: pick(['#d8dee4', '#e6d6c4', '#c9dbe0'], r(3)) });
      props.push({ type: 'containers', x: cx - 8, z: cz + 12, w: 26, d: 12, levels: 1 + Math.floor(r(4) * 3) });
    } else {
      buildings.push({ x: cx - 10, z: cz, w: 24, d: 42, h: 12 + r(2) * 4, style: 'warehouse', tint: pick(['#d8dee4', '#e3d5c2', '#c7d6dd'], r(3)) });
      props.push({ type: 'containers', x: cx + 14, z: cz - 6, w: 12, d: 28, levels: 1 + Math.floor(r(4) * 3) });
    }
    return block;
  }

  // Strip and beachfront: a ring of shops and hotels around a parking court.
  block.lot = district === 'beachfront' ? 'plaza' : 'paved';
  const isPolice = bi === LANDMARK_BLOCKS.policeStation.bi && bj === LANDMARK_BLOCKS.policeStation.bj;
  const isGunShop = bi === LANDMARK_BLOCKS.gunShop.bi && bj === LANDMARK_BLOCKS.gunShop.bj;
  if (isPolice) {
    buildings.push({ x: cx, z: cz - 6, w: 38, d: 24, h: 13, style: 'stucco', tint: '#d6dde6', sign: 'police', landmark: 'policeStation' });
    props.push({ type: 'palm', x: cx - 18, z: cz + 16, height: 9 });
    return block;
  }
  const beach = district === 'beachfront';
  const sides = beach ? ['south', 'north'] : ['north', 'south', 'west', 'east'];
  let index = 0;
  for (const side of sides) {
    const along = side === 'north' || side === 'south';
    const count = beach && side === 'south' ? 2 : 2 + Math.floor(r(index + 90) * 2);
    const span = inner * 2 - (along ? 0 : 26);
    const size = span / count;
    for (let k = 0; k < count; k += 1) {
      const depth = beach && side === 'south' ? 16 : 10 + r(index + 100) * 3;
      const offset = -span / 2 + size * (k + 0.5);
      const edge = inner - depth / 2;
      const x = along ? cx + offset : cx + (side === 'west' ? -edge : edge);
      const z = along ? cz + (side === 'north' ? -edge : edge) : cz + offset;
      const tall = beach && side === 'south' ? 14 + Math.floor(r(index + 110) * 4) * 3.5 : 7 + Math.floor(r(index + 110) * 3) * 3.5;
      buildings.push({
        x, z,
        w: along ? size - 1.2 : depth,
        d: along ? depth : size - 1.2,
        h: tall,
        style: 'stucco',
        shopfront: true,
        face: side,
        tint: pick(PASTELS, r(index + 120)),
        awning: pick(AWNINGS, r(index + 130)),
      });
      index += 1;
    }
  }
  if (isGunShop) {
    const shop = buildings.find((b) => b.face === 'west') ?? buildings[0];
    shop.sign = 'gunShop';
    shop.landmark = 'gunShop';
  }
  if (bi === LANDMARK_BLOCKS.surfShack.bi && bj === LANDMARK_BLOCKS.surfShack.bj) {
    const shop = buildings.find((b) => b.face === 'south') ?? buildings[0];
    shop.sign = 'surfShack';
  }
  const tallest = buildings.reduce((a, b) => (b.h > a.h ? b : a), buildings[0]);
  if (r(140) < 0.55) tallest.billboard = pick(BILLBOARDS, r(141));
  props.push({ type: 'parkedCar', x: cx - 6, z: cz + 2 }, { type: 'parkedCar', x: cx + 6, z: cz - 3 });
  return block;
}

export const BILLBOARDS = [
  { title: 'SOLCOLA', subtitle: 'Taste the coast', background: '#ff7a59', accent: '#ffcf5c' },
  { title: 'HALDANE COASTAL', subtitle: 'Luxury living, tomorrow', background: '#16324f', accent: '#3fa7a3' },
  { title: 'RADIO MAREA 92.1', subtitle: 'Hot nights on the bay', background: '#5b2a86', accent: '#ff5d8f' },
  { title: 'GULLWING AIR', subtitle: 'Fly the sunset', background: '#0f6c8c', accent: '#ffb347' },
  { title: 'TACO TORMENTA', subtitle: 'Spice storm warning', background: '#c4302b', accent: '#ffd166' },
];

/** Palm-lined boulevards: Solara Boulevard (vertical road 5) and Seaglass Parade (the beach road). */
export const BOULEVARD_COLUMN = 5;
export const PARADE_ROW = CITY.rows;

function planStreetProps(props) {
  const half = CITY.road / 2 + 1.4;
  const x = nodeX(BOULEVARD_COLUMN);
  for (let z = CITY.minZ + 12; z < CITY.maxZ - 4; z += 12) {
    const fz = (((z - CITY.originZ) % CITY.pitch) + CITY.pitch) % CITY.pitch;
    if (fz < 12 || fz > CITY.pitch - 12) continue;
    props.push({ type: 'palm', x: x - half, z, height: 11 + ((z * 7) % 3) }, { type: 'palm', x: x + half, z, height: 11 + ((z * 5) % 3) });
  }
  const zParade = nodeZ(PARADE_ROW);
  for (let px = CITY.minX + 10; px < CITY.maxX - 140; px += 14) {
    const fx = (((px - CITY.originX) % CITY.pitch) + CITY.pitch) % CITY.pitch;
    if (fx < 12 || fx > CITY.pitch - 12) continue;
    props.push({ type: 'palm', x: px, z: zParade + half + 1, height: 10 + ((px * 3) % 4) });
  }
  // Street lamps at every block corner.
  for (let i = 0; i <= CITY.cols; i += 1) {
    for (let j = 0; j <= CITY.rows; j += 1) {
      props.push({ type: 'lamp', x: nodeX(i) + CITY.road / 2 + 0.6, z: nodeZ(j) + CITY.road / 2 + 0.6 });
    }
  }
}

function planBeach(props) {
  const top = CITY.maxZ + CITY.road / 2 + 6;
  for (let k = 0; k < 26; k += 1) {
    const x = CITY.minX + 20 + k * 21 + hash2(k, 3, 9) * 6;
    if (x > CITY.maxX - 130 && x < CITY.maxX) continue;
    if (Math.abs(x - PIER.x) < 10) continue;
    props.push({ type: 'umbrella', x, z: top + 18 + hash2(k, 4, 9) * 16, color: pick(AWNINGS, hash2(k, 5, 9)) });
    if (k % 6 === 2) props.push({ type: 'lifeguard', x: x + 6, z: top + 30 });
  }
}

/** The pier and its Ferris wheel, the Sunwheel, out over the water off Coral Beach. */
export const PIER = { x: -60, width: 12, startZ: CITY.maxZ + CITY.road / 2 + 30, length: 120 };

/** The cranes along the eastern quay of the docks. */
export const CRANES = [
  { x: CITY.maxX + 28, z: CITY.originZ + 120 },
  { x: CITY.maxX + 28, z: CITY.originZ + 260 },
  { x: CITY.maxX + 28, z: CITY.originZ + 400 },
];

export function generateCityPlan(seed) {
  const blocks = [];
  for (let bj = 0; bj < CITY.rows; bj += 1) {
    for (let bi = 0; bi < CITY.cols; bi += 1) blocks.push(planBlock(bi, bj, seed));
  }
  const streetProps = [];
  planStreetProps(streetProps);
  planBeach(streetProps);
  const landmarks = {};
  for (const block of blocks) {
    for (const building of block.buildings) if (building.landmark) landmarks[building.landmark] = { block, building };
  }
  return { seed, blocks, streetProps, landmarks };
}

/** The block a point is in, or null on a road or off the grid. */
export function blockAt(plan, x, z) {
  const bi = Math.floor((x - CITY.originX) / CITY.pitch);
  const bj = Math.floor((z - CITY.originZ) / CITY.pitch);
  if (bi < 0 || bj < 0 || bi >= CITY.cols || bj >= CITY.rows) return null;
  return plan.blocks[bj * CITY.cols + bi];
}
