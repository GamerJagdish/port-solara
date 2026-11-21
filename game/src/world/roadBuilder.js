// Builds the road grid as meshes: asphalt strips, intersections, the painted centre and edge lines,
// zebra crossings, and the raised sidewalk slab and lot surface of every block.
import * as THREE from 'three';
import { CITY } from '../core/config.js';
import { MeshBuilder } from './meshBuilder.js';
import { cityMaterials } from './materials.js';
import { nodeX, nodeZ, blockCenterX, blockCenterZ } from './cityLayout.js';

const CURB = 0.15;
const YELLOW = new THREE.Color('#f2c230');
const WHITE = new THREE.Color('#f4f1ea');

export function buildRoads(plan) {
  const mats = cityMaterials();
  const group = new THREE.Group();
  group.name = 'roads';
  const half = CITY.road / 2;

  const asphalt = new MeshBuilder();
  for (let j = 0; j <= CITY.rows; j += 1) {
    asphalt.ground(CITY.minX - half, nodeZ(j) - half, CITY.maxX + half, nodeZ(j) + half, 0.01, 16);
  }
  for (let i = 0; i <= CITY.cols; i += 1) {
    for (let j = 0; j < CITY.rows; j += 1) {
      asphalt.ground(nodeX(i) - half, nodeZ(j) + half, nodeX(i) + half, nodeZ(j + 1) - half, 0.01, 16);
    }
  }
  const asphaltMesh = new THREE.Mesh(asphalt.build(), mats.asphalt);
  asphaltMesh.receiveShadow = true;
  group.add(asphaltMesh);

  const paint = new MeshBuilder();
  const dash = (x0, z0, x1, z1, width, color) => {
    const minX = Math.min(x0, x1) - (x0 === x1 ? width / 2 : 0);
    const maxX = Math.max(x0, x1) + (x0 === x1 ? width / 2 : 0);
    const minZ = Math.min(z0, z1) - (z0 === z1 ? width / 2 : 0);
    const maxZ = Math.max(z0, z1) + (z0 === z1 ? width / 2 : 0);
    paint.ground(minX, minZ, maxX, maxZ, 0.025, 1, color);
  };
  // Centre lines (double yellow, solid) and dashed white lane edges along every segment.
  for (let j = 0; j <= CITY.rows; j += 1) {
    const z = nodeZ(j);
    for (let i = 0; i < CITY.cols; i += 1) {
      const x0 = nodeX(i) + half + 2;
      const x1 = nodeX(i + 1) - half - 2;
      dash(x0, z - 0.18, x1, z - 0.18, 0.14, YELLOW);
      dash(x0, z + 0.18, x1, z + 0.18, 0.14, YELLOW);
      dash(x0, z - half + 0.5, x1, z - half + 0.5, 0.16, WHITE);
      dash(x0, z + half - 0.5, x1, z + half - 0.5, 0.16, WHITE);
      crosswalk(dash, nodeX(i) + half + 1.1, z, 'x');
      crosswalk(dash, nodeX(i + 1) - half - 1.1, z, 'x');
    }
  }
  for (let i = 0; i <= CITY.cols; i += 1) {
    const x = nodeX(i);
    for (let j = 0; j < CITY.rows; j += 1) {
      const z0 = nodeZ(j) + half + 2;
      const z1 = nodeZ(j + 1) - half - 2;
      dash(x - 0.18, z0, x - 0.18, z1, 0.14, YELLOW);
      dash(x + 0.18, z0, x + 0.18, z1, 0.14, YELLOW);
      dash(x - half + 0.5, z0, x - half + 0.5, z1, 0.16, WHITE);
      dash(x + half - 0.5, z0, x + half - 0.5, z1, 0.16, WHITE);
      crosswalk(dash, x, nodeZ(j) + half + 1.1, 'z');
      crosswalk(dash, x, nodeZ(j + 1) - half - 1.1, 'z');
    }
  }
  const paintMesh = new THREE.Mesh(paint.build(), mats.paint);
  paintMesh.receiveShadow = true;
  group.add(paintMesh);

  // Sidewalk slabs and the surfaces inside each block, sorted by material.
  const slabs = new MeshBuilder();
  const lots = { grass: new MeshBuilder(), plaza: new MeshBuilder(), paved: new MeshBuilder(), concrete: new MeshBuilder() };
  for (const block of plan.blocks) {
    const cx = blockCenterX(block.bi);
    const cz = blockCenterZ(block.bj);
    const b = CITY.block / 2;
    const inner = b - CITY.sidewalk;
    slabs.box(cx, 0, cz - b + CITY.sidewalk / 2, CITY.block, CURB, CITY.sidewalk, { tileU: 2, tileV: 2 });
    slabs.box(cx, 0, cz + b - CITY.sidewalk / 2, CITY.block, CURB, CITY.sidewalk, { tileU: 2, tileV: 2 });
    slabs.box(cx - b + CITY.sidewalk / 2, 0, cz, CITY.sidewalk, CURB, inner * 2, { tileU: 2, tileV: 2 });
    slabs.box(cx + b - CITY.sidewalk / 2, 0, cz, CITY.sidewalk, CURB, inner * 2, { tileU: 2, tileV: 2 });
    const lot = lots[block.lot] ?? lots.paved;
    const tile = block.lot === 'grass' ? 10 : block.lot === 'plaza' ? 4 : 16;
    lot.box(cx, 0, cz, inner * 2, CURB - 0.01, inner * 2, { tileU: tile, tileV: tile, sides: false });
  }
  const slabMesh = new THREE.Mesh(slabs.build(), mats.sidewalk);
  slabMesh.receiveShadow = true;
  group.add(slabMesh);
  const lotMaterials = { grass: mats.grass, plaza: mats.plaza, paved: mats.asphalt, concrete: mats.concrete };
  for (const [kind, builder] of Object.entries(lots)) {
    if (builder.vertexCount === 0) continue;
    const mesh = new THREE.Mesh(builder.build(), lotMaterials[kind]);
    mesh.receiveShadow = true;
    group.add(mesh);
  }

  // The eastern quay: a broad concrete apron beside the docks road.
  const quay = new MeshBuilder();
  quay.box(CITY.maxX + half + CITY.quayDepth / 2 - 3.5, -0.6, (CITY.minZ + CITY.maxZ) / 2, CITY.quayDepth - 7 + 0.01, 0.62, CITY.maxZ - CITY.minZ + CITY.road, { tileU: 16, tileV: 16 });
  const quayMesh = new THREE.Mesh(quay.build(), mats.concrete);
  quayMesh.receiveShadow = true;
  group.add(quayMesh);
  return group;
}

function crosswalk(dash, x, z, across) {
  const half = CITY.road / 2 - 0.9;
  for (let k = -half; k <= half; k += 1.4) {
    if (across === 'x') dash(x - 1, z + k, x + 1, z + k, 0.7, WHITE);
    else dash(x + k, z - 1, x + k, z + 1, 0.7, WHITE);
  }
}

/** Height of the walkable ground at a point: curbs raise the sidewalks and lots above the road. */
export function groundHeightAt(x, z) {
  const half = CITY.road / 2;
  if (x < CITY.minX + half || x > CITY.maxX - half || z < CITY.minZ + half || z > CITY.maxZ - half) return 0;
  const fx = (((x - CITY.originX) % CITY.pitch) + CITY.pitch) % CITY.pitch;
  const fz = (((z - CITY.originZ) % CITY.pitch) + CITY.pitch) % CITY.pitch;
  const onRoad = fx <= half || fx >= CITY.pitch - half || fz <= half || fz >= CITY.pitch - half;
  return onRoad ? 0 : CURB;
}
