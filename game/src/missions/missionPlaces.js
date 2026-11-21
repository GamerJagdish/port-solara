// Named places the story refers to, resolved to ground coordinates from the city plan.
import { CITY } from '../core/config.js';
import { LANDMARK_BLOCKS, blockCenterX, blockCenterZ, nodeX, nodeZ, PIER } from '../world/cityLayout.js';

const gull = LANDMARK_BLOCKS.luckyGull;
const taco = LANDMARK_BLOCKS.tacoStand;
const tower = LANDMARK_BLOCKS.haldaneTower;
const gunShop = LANDMARK_BLOCKS.gunShop;
const hospital = LANDMARK_BLOCKS.hospital;
const police = LANDMARK_BLOCKS.policeStation;

const sidewalk = CITY.block / 2 - CITY.sidewalk / 2;

export const PLACES = {
  /** The sidewalk at the Lucky Gull's door, where Mari waits. */
  gullDoor: { x: blockCenterX(gull.bi) - sidewalk, z: blockCenterZ(gull.bj), radius: 2.2, label: 'Lucky Gull' },
  /** The kerb outside the shop, for arriving by car. */
  gullCurb: { x: nodeX(gull.bi) + CITY.laneOffset, z: blockCenterZ(gull.bj), radius: 6, label: 'Lucky Gull' },
  pierCrate: { x: PIER.x, z: PIER.startZ + PIER.length - 6, radius: 2.2, label: 'Crate' },
  tacoTruck: { x: blockCenterX(taco.bi) + 24, z: blockCenterZ(taco.bj) - 1, radius: 4, label: 'Taco Tormenta' },
  towerRoad: { x: nodeX(tower.bi) - CITY.laneOffset, z: blockCenterZ(tower.bj), heading: 0, label: 'Haldane Tower' },
  gunShopDoor: { x: blockCenterX(gunShop.bi) - sidewalk, z: blockCenterZ(gunShop.bj), radius: 2.4, label: 'Brass & Barrel' },
  hospital: { x: blockCenterX(hospital.bi), z: blockCenterZ(hospital.bj) + sidewalk, heading: 0, label: 'St. Brigid Medical' },
  policeStation: { x: blockCenterX(police.bi), z: blockCenterZ(police.bj) + sidewalk, heading: 0, label: 'Harbor Precinct' },
  pierStart: { x: PIER.x, z: PIER.startZ + 8, heading: Math.PI, label: 'Coral Pier' },
};

export function place(name) {
  return PLACES[name];
}

/** Spots along the Seaglass Parade beach road, used by the screenshot scenes. */
export const PARADE_Z = nodeZ(CITY.rows);
