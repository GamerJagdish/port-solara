// The island around the grid: grass verges, Coral Beach's sand sloping into the sea, surf foam, the
// ocean itself, the pier on its stilts and the green Solara Ridge hills that close off the north.
import * as THREE from 'three';
import { CITY } from '../core/config.js';
import { MeshBuilder } from './meshBuilder.js';
import { cityMaterials } from './materials.js';
import { PIER } from './cityLayout.js';
import { createRandom } from '../core/random.js';

export const WATER_LEVEL = -0.55;

export function buildTerrain() {
  const mats = cityMaterials();
  const group = new THREE.Group();
  group.name = 'terrain';
  const b = CITY.bounds;
  const half = CITY.road / 2;

  const grass = new MeshBuilder();
  grass.ground(b.minX, b.minZ - 400, CITY.maxX + half, CITY.maxZ + half, -0.02, 10);
  const grassMesh = new THREE.Mesh(grass.build(), mats.grass);
  grassMesh.receiveShadow = true;
  group.add(grassMesh);

  // Coral Beach: flat sand, then a slope into the surf.
  const sand = new MeshBuilder();
  const top = CITY.maxZ + half;
  sand.ground(b.minX, top, b.maxX, b.maxZ, 0, 8);
  const slopeEnd = b.maxZ + 26;
  sand.quad([b.minX, -2.2, slopeEnd], [b.maxX, -2.2, slopeEnd], [b.maxX, 0, b.maxZ], [b.minX, 0, b.maxZ], [0, 0.995, 0.1],
    [b.minX / 8, slopeEnd / 8], [b.maxX / 8, slopeEnd / 8], [b.maxX / 8, b.maxZ / 8], [b.minX / 8, b.maxZ / 8], new THREE.Color(0.92, 0.88, 0.8));
  // The west shore: a thin beach between the grass and the sea.
  sand.ground(b.minX - 20, b.minZ - 400, b.minX, b.maxZ, -0.05, 8);
  const sandMesh = new THREE.Mesh(sand.build(), mats.sand);
  sandMesh.receiveShadow = true;
  group.add(sandMesh);

  const water = new THREE.Mesh(new THREE.PlaneGeometry(4000, 4000), mats.water);
  water.rotation.x = -Math.PI / 2;
  water.position.set(0, WATER_LEVEL, 0);
  water.receiveShadow = true;
  water.name = 'ocean';
  group.add(water);

  const foam = new THREE.Mesh(
    new THREE.PlaneGeometry(b.maxX - b.minX, 3.2),
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55, depthWrite: false }),
  );
  foam.rotation.x = -Math.PI / 2;
  foam.position.set((b.minX + b.maxX) / 2, WATER_LEVEL + 0.04, b.maxZ + 6.6);
  foam.name = 'surf';
  group.add(foam);

  group.add(buildPier());
  group.add(buildHills());
  return group;
}

function buildPier() {
  const mats = cityMaterials();
  const deck = new MeshBuilder();
  const wood = new THREE.Color('#b88b62');
  const end = PIER.startZ + PIER.length;
  deck.box(PIER.x, -0.25, PIER.startZ + PIER.length / 2, PIER.width, 0.3, PIER.length, { tileU: 2, tileV: 2, color: wood, bottom: true });
  deck.box(PIER.x, -0.25, end + 15, 34, 0.3, 30, { tileU: 2, tileV: 2, color: wood, bottom: true });
  const post = new THREE.Color('#6f5440');
  for (let z = PIER.startZ + 6; z < end + 28; z += 6) {
    const width = z > end ? 34 : PIER.width;
    for (const side of [-1, 1]) deck.box(PIER.x + side * (width / 2 - 0.4), -3, z, 0.5, 2.8, 0.5, { color: post, top: false });
    // Railings.
    deck.box(PIER.x - width / 2 + 0.1, 0.05, z, 0.12, 1.0, 0.12, { color: post });
    deck.box(PIER.x + width / 2 - 0.1, 0.05, z, 0.12, 1.0, 0.12, { color: post });
  }
  deck.box(PIER.x - PIER.width / 2 + 0.1, 1.0, PIER.startZ + PIER.length / 2 + 4, 0.14, 0.12, PIER.length - 8, { color: post });
  deck.box(PIER.x + PIER.width / 2 - 0.1, 1.0, PIER.startZ + PIER.length / 2 + 4, 0.14, 0.12, PIER.length - 8, { color: post });
  const mesh = new THREE.Mesh(deck.build(), mats.tinted);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.name = 'pier';
  return mesh;
}

function buildHills() {
  const group = new THREE.Group();
  group.name = 'solaraRidge';
  const rand = createRandom(77);
  const material = new THREE.MeshStandardMaterial({ color: 0x6f9a55, roughness: 1, flatShading: true });
  const far = new THREE.MeshStandardMaterial({ color: 0x8aa58a, roughness: 1, flatShading: true });
  for (let k = 0; k < 14; k += 1) {
    const radius = 90 + rand() * 120;
    const height = 50 + rand() * 90;
    const geometry = new THREE.ConeGeometry(radius, height, 9, 2);
    const positions = geometry.attributes.position;
    for (let v = 0; v < positions.count; v += 1) {
      if (positions.getY(v) > -height / 2 + 1) {
        positions.setX(v, positions.getX(v) * (0.85 + rand() * 0.3));
        positions.setZ(v, positions.getZ(v) * (0.85 + rand() * 0.3));
      }
    }
    geometry.computeVertexNormals();
    const hill = new THREE.Mesh(geometry, k % 3 === 0 ? far : material);
    hill.position.set(-520 + k * 85 + rand() * 30, height / 2 - 4, CITY.bounds.minZ - 130 - rand() * 160 - (k % 3 === 0 ? 120 : 0));
    hill.receiveShadow = true;
    group.add(hill);
  }
  return group;
}
