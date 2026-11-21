// The skyline's signature pieces: the Sunwheel (a Ferris wheel at the end of Coral Pier that turns all
// day), the gantry cranes along the Saltworks quay, and the invisible shore walls that keep cars and
// people on the island.
import * as THREE from 'three';
import { CITY } from '../core/config.js';
import { CRANES, PIER } from './cityLayout.js';
import { MeshBuilder } from './meshBuilder.js';
import { cityMaterials } from './materials.js';

const CABIN_COLORS = ['#ff6b6b', '#ffd166', '#06d6a0', '#4cc9f0', '#f78c6b', '#c77dff'];

export function buildSunwheel() {
  const group = new THREE.Group();
  group.name = 'sunwheel';
  const radius = 22;
  const hubY = radius + 5;
  const steel = new THREE.MeshStandardMaterial({ color: 0xf4f1ea, roughness: 0.4, metalness: 0.3 });
  for (const side of [-1.6, 1.6]) {
    for (const lean of [-1, 1]) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.5, hubY / Math.cos(0.32), 8), steel);
      leg.position.set(lean * Math.tan(0.32) * hubY * 0.5, hubY / 2, side);
      leg.rotation.z = -lean * 0.32;
      group.add(leg);
    }
  }
  const wheel = new THREE.Group();
  wheel.position.y = hubY;
  const rim = new THREE.Mesh(new THREE.TorusGeometry(radius, 0.35, 8, 64), steel);
  const rimBack = rim.clone();
  rim.position.z = 1.2;
  rimBack.position.z = -1.2;
  wheel.add(rim, rimBack);
  const spokes = 16;
  for (let k = 0; k < spokes; k += 1) {
    const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.18, radius, 0.18), steel);
    const angle = (k / spokes) * Math.PI * 2;
    spoke.position.set(Math.cos(angle) * radius / 2, Math.sin(angle) * radius / 2, 0);
    spoke.rotation.z = angle - Math.PI / 2;
    wheel.add(spoke);
  }
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.4, 3.2, 16), new THREE.MeshStandardMaterial({ color: 0xffb347, roughness: 0.4 }));
  hub.rotation.x = Math.PI / 2;
  wheel.add(hub);
  const cabins = [];
  for (let k = 0; k < spokes; k += 1) {
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 2.2), new THREE.MeshStandardMaterial({ color: CABIN_COLORS[k % CABIN_COLORS.length], roughness: 0.5 }));
    const angle = (k / spokes) * Math.PI * 2;
    cabin.userData.angle = angle;
    cabin.position.set(Math.cos(angle) * radius, Math.sin(angle) * radius - 1.2, 0);
    wheel.add(cabin);
    cabins.push(cabin);
  }
  group.add(wheel);
  group.traverse((child) => {
    child.castShadow = true;
  });
  group.position.set(PIER.x, 0, PIER.startZ + PIER.length + 15);
  return {
    group,
    /** Turns the wheel; cabins stay level as real gondolas do. */
    update(time) {
      wheel.rotation.z = time * 0.05;
      for (const cabin of cabins) cabin.rotation.z = -wheel.rotation.z;
    },
  };
}

export function buildCranes(collision) {
  const group = new THREE.Group();
  group.name = 'cranes';
  const builder = new MeshBuilder();
  const red = new THREE.Color('#d9472b');
  const white = new THREE.Color('#efefe9');
  for (const crane of CRANES) {
    for (const [dx, dz] of [[-6, -5], [6, -5], [-6, 5], [6, 5]]) builder.box(crane.x + dx, 0, crane.z + dz, 1.1, 30, 1.1, { color: red });
    builder.box(crane.x, 28, crane.z - 5, 13, 1.4, 1.2, { color: red });
    builder.box(crane.x, 28, crane.z + 5, 13, 1.4, 1.2, { color: red });
    // The boom reaches out over the water to the east and back over the yard.
    builder.box(crane.x + 10, 31, crane.z, 62, 2, 2.4, { color: red });
    builder.box(crane.x - 4, 29.4, crane.z, 8, 4, 7, { color: white });
    builder.box(crane.x + 26, 22, crane.z, 0.12, 9, 0.12, { color: new THREE.Color('#333333') });
    builder.box(crane.x + 26, 20.5, crane.z, 2.4, 1.4, 6.2, { color: new THREE.Color('#ffd166') });
    for (const [dx, dz] of [[-6, -5], [6, -5], [-6, 5], [6, 5]]) collision.addCircle(crane.x + dx, crane.z + dz, 0.8, 30, 'crane');
  }
  const mesh = new THREE.Mesh(builder.build(), cityMaterials().metal);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  group.add(mesh);
  return group;
}

/** Walls at the water's edge, with a gap where Coral Pier runs out to sea. */
export function addShoreWalls(collision) {
  const b = CITY.bounds;
  const thick = 40;
  collision.addBox(b.minX - thick, b.minZ - 400, b.minX, b.maxZ + thick, 50, 'shore');
  collision.addBox(b.maxX, b.minZ - 400, b.maxX + thick, b.maxZ + thick, 50, 'shore');
  collision.addBox(b.minX - thick, b.minZ - thick, b.maxX + thick, b.minZ, 50, 'shore');
  const pierLeft = PIER.x - PIER.width / 2;
  const pierRight = PIER.x + PIER.width / 2;
  const pierEnd = PIER.startZ + PIER.length;
  collision.addBox(b.minX - thick, b.maxZ, pierLeft, pierEnd, 50, 'shore');
  collision.addBox(pierRight, b.maxZ, b.maxX + thick, pierEnd, 50, 'shore');
  // The platform at the pier's end is wider than the walkway.
  collision.addBox(b.minX - thick, pierEnd, PIER.x - 17, pierEnd + 200, 50, 'shore');
  collision.addBox(PIER.x + 17, pierEnd, b.maxX + thick, pierEnd + 200, 50, 'shore');
  collision.addBox(PIER.x - 17, pierEnd + 30, PIER.x + 17, pierEnd + 200, 50, 'shore');
  // The Sunwheel's feet stand in the middle of the platform.
  collision.addBox(PIER.x - 10, pierEnd + 13, PIER.x - 7, pierEnd + 17, 30, 'sunwheel');
  collision.addBox(PIER.x + 7, pierEnd + 13, PIER.x + 10, pierEnd + 17, 30, 'sunwheel');
}
