// Street furniture and set dressing from the plan: instanced palm trees and street lamps, container
// stacks on the docks, beach umbrellas and lifeguard towers, pools, the plaza fountain and gull statue,
// and the Taco Tormenta food truck. Solid props are added to the collision world.
import * as THREE from 'three';
import { MeshBuilder } from './meshBuilder.js';
import { cityMaterials } from './materials.js';
import { signTexture } from './textures.js';
import { createRandom } from '../core/random.js';
import { CITY } from '../core/config.js';

const CONTAINER_COLORS = ['#c0392b', '#1f6fa8', '#2a9d8f', '#e07b39', '#e9e4d8', '#6b4f9e', '#d4a72c'];

export function buildProps(plan, collision) {
  const group = new THREE.Group();
  group.name = 'props';
  const props = [...plan.streetProps];
  for (const block of plan.blocks) props.push(...block.props);
  const byType = (type) => props.filter((p) => p.type === type);

  group.add(buildPalms(byType('palm'), collision));
  group.add(buildLamps(byType('lamp'), collision));
  group.add(buildUmbrellas(byType('umbrella')));
  const solid = new MeshBuilder();
  for (const stack of byType('containers')) addContainerStack(solid, stack, collision);
  for (const tower of byType('lifeguard')) addLifeguardTower(solid, tower, collision);
  for (const pool of byType('pool')) addPool(solid, pool);
  for (const fountain of byType('fountain')) addFountain(solid, fountain, collision);
  for (const statue of byType('statue')) addGullStatue(solid, statue, collision);
  const mesh = new THREE.Mesh(solid.build(), cityMaterials().tinted);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.name = 'solid-props';
  group.add(mesh);
  for (const pool of [...byType('pool'), ...byType('fountain')]) group.add(waterSurface(pool));
  for (const truck of byType('tacoTruck')) group.add(buildTacoTruck(truck, collision));
  return group;
}

/** A crown of drooping fronds as one geometry, reused by every palm instance. */
function frondCrownGeometry() {
  const positions = [];
  const normals = [];
  const fronds = 9;
  const segments = 6;
  for (let f = 0; f < fronds; f += 1) {
    const angle = (f / fronds) * Math.PI * 2 + (f % 2) * 0.2;
    const dx = Math.cos(angle);
    const dz = Math.sin(angle);
    const length = 4.2 + (f % 3) * 0.5;
    const point = (t) => [dx * t * length, 0.5 * t - 2.1 * t * t, dz * t * length];
    for (let s = 0; s < segments; s += 1) {
      const t0 = s / segments;
      const t1 = (s + 1) / segments;
      const w0 = 0.75 * Math.sin(Math.PI * Math.max(0.12, t0));
      const w1 = 0.75 * Math.sin(Math.PI * Math.max(0.12, t1));
      const p0 = point(t0);
      const p1 = point(t1);
      const sx = -dz;
      const sz = dx;
      const a = [p0[0] + sx * w0, p0[1], p0[2] + sz * w0];
      const b = [p0[0] - sx * w0, p0[1], p0[2] - sz * w0];
      const c = [p1[0] - sx * w1, p1[1], p1[2] - sz * w1];
      const d = [p1[0] + sx * w1, p1[1], p1[2] + sz * w1];
      // Fold the leaf slightly along its spine.
      a[1] -= 0.12;
      d[1] -= 0.12;
      for (const v of [a, b, c, a, c, d]) {
        positions.push(...v);
        normals.push(0, 1, 0);
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  return geometry;
}

function buildPalms(palms, collision) {
  const mats = cityMaterials();
  const group = new THREE.Group();
  group.name = 'palms';
  const trunkGeometry = new THREE.CylinderGeometry(0.16, 0.3, 1, 7, 4);
  trunkGeometry.translate(0, 0.5, 0);
  const trunks = new THREE.InstancedMesh(trunkGeometry, mats.trunk, palms.length);
  const crowns = new THREE.InstancedMesh(frondCrownGeometry(), mats.frond, palms.length);
  const rand = createRandom(404);
  const matrix = new THREE.Matrix4();
  const rotation = new THREE.Quaternion();
  const euler = new THREE.Euler();
  const top = new THREE.Vector3();
  palms.forEach((palm, index) => {
    const lean = 0.05 + rand() * 0.12;
    euler.set(Math.cos(index) * lean, rand() * Math.PI * 2, Math.sin(index) * lean);
    rotation.setFromEuler(euler);
    matrix.compose(new THREE.Vector3(palm.x, 0, palm.z), rotation, new THREE.Vector3(1, palm.height, 1));
    trunks.setMatrixAt(index, matrix);
    top.set(0, palm.height, 0).applyQuaternion(rotation);
    euler.set(0, rand() * Math.PI * 2, 0);
    rotation.setFromEuler(euler);
    matrix.compose(new THREE.Vector3(palm.x + top.x, top.y, palm.z + top.z), rotation, new THREE.Vector3(1, 1, 1));
    crowns.setMatrixAt(index, matrix);
    collision.addCircle(palm.x, palm.z, 0.32, palm.height, 'palm');
  });
  trunks.castShadow = crowns.castShadow = true;
  trunks.receiveShadow = true;
  group.add(trunks, crowns);
  return group;
}

function buildLamps(lamps, collision) {
  const mats = cityMaterials();
  const post = new MeshBuilder();
  post.box(0, 0, 0, 0.2, 7.4, 0.2, {});
  post.box(-1.1, 7.2, 0, 2.4, 0.15, 0.18, {});
  const glow = new MeshBuilder();
  glow.box(-2.1, 6.95, 0, 0.7, 0.25, 0.35, {});
  const posts = new THREE.InstancedMesh(post.build(), mats.lampPost, lamps.length);
  const heads = new THREE.InstancedMesh(glow.build(), mats.lampGlow, lamps.length);
  const matrix = new THREE.Matrix4();
  lamps.forEach((lamp, index) => {
    // Turn the arm so it reaches over the nearer road.
    matrix.makeRotationY(index % 2 === 0 ? 0 : -Math.PI / 2);
    matrix.setPosition(lamp.x, 0, lamp.z);
    posts.setMatrixAt(index, matrix);
    heads.setMatrixAt(index, matrix);
    collision.addCircle(lamp.x, lamp.z, 0.18, 7, 'lamp');
  });
  posts.castShadow = true;
  const group = new THREE.Group();
  group.name = 'lamps';
  group.add(posts, heads);
  return group;
}

function buildUmbrellas(umbrellas) {
  const group = new THREE.Group();
  group.name = 'umbrellas';
  const canopy = new THREE.ConeGeometry(1.9, 0.7, 8, 1, true);
  canopy.translate(0, 2.35, 0);
  const pole = new THREE.CylinderGeometry(0.04, 0.04, 2.4, 5);
  pole.translate(0, 1.2, 0);
  const tops = new THREE.InstancedMesh(canopy, new THREE.MeshStandardMaterial({ roughness: 0.8, side: THREE.DoubleSide }), umbrellas.length);
  const poles = new THREE.InstancedMesh(pole, new THREE.MeshStandardMaterial({ color: 0xeeeeee }), umbrellas.length);
  const towels = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 0.04, 2), new THREE.MeshStandardMaterial({ roughness: 1 }), umbrellas.length);
  const matrix = new THREE.Matrix4();
  umbrellas.forEach((umbrella, index) => {
    matrix.makeRotationZ(0.08);
    matrix.setPosition(umbrella.x, 0, umbrella.z);
    tops.setMatrixAt(index, matrix);
    poles.setMatrixAt(index, matrix);
    tops.setColorAt(index, new THREE.Color(umbrella.color));
    matrix.makeRotationY(0.3 * (index % 3));
    matrix.setPosition(umbrella.x + 1.4, 0.03, umbrella.z + 0.6);
    towels.setMatrixAt(index, matrix);
    towels.setColorAt(index, new THREE.Color(CONTAINER_COLORS[(index * 3) % CONTAINER_COLORS.length]));
  });
  tops.castShadow = true;
  towels.receiveShadow = true;
  group.add(tops, poles, towels);
  return group;
}

function addContainerStack(builder, stack, collision) {
  const alongX = stack.w >= stack.d;
  const length = 6.1;
  const width = 2.5;
  const height = 2.6;
  const spanLong = alongX ? stack.w : stack.d;
  const spanShort = alongX ? stack.d : stack.w;
  const columns = Math.max(1, Math.floor(spanLong / (length + 0.3)));
  const rows = Math.max(1, Math.floor(spanShort / (width + 0.15)));
  const rand = createRandom(Math.round(stack.x * 31 + stack.z * 17));
  for (let c = 0; c < columns; c += 1) {
    for (let r = 0; r < rows; r += 1) {
      const levels = Math.max(1, stack.levels - (rand() < 0.3 ? 1 : 0));
      for (let l = 0; l < levels; l += 1) {
        const a = -spanLong / 2 + (c + 0.5) * (spanLong / columns);
        const b = -spanShort / 2 + (r + 0.5) * (spanShort / rows);
        const color = new THREE.Color(CONTAINER_COLORS[Math.floor(rand() * CONTAINER_COLORS.length)]);
        const x = stack.x + (alongX ? a : b);
        const z = stack.z + (alongX ? b : a);
        builder.box(x, l * height, z, alongX ? length : width, height - 0.05, alongX ? width : length, { color });
        // Corrugation ribs on the long sides.
        const ribColor = color.clone().multiplyScalar(0.82);
        for (let k = -2; k <= 2; k += 1) {
          builder.box(x + (alongX ? k * 1.2 : 0), l * height + 0.15, z + (alongX ? 0 : k * 1.2), alongX ? 0.12 : width + 0.06, height - 0.35, alongX ? width + 0.06 : 0.12, { color: ribColor, top: false });
        }
      }
    }
  }
  collision.addBox(stack.x - stack.w / 2, stack.z - stack.d / 2, stack.x + stack.w / 2, stack.z + stack.d / 2, stack.levels * height, 'containers');
}

function addLifeguardTower(builder, tower, collision) {
  const white = new THREE.Color('#f5f2ea');
  const red = new THREE.Color('#e04f3f');
  for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) builder.box(tower.x + dx * 1.1, 0, tower.z + dz * 1.1, 0.18, 2.2, 0.18, { color: white });
  builder.box(tower.x, 2.2, tower.z, 3, 2.1, 3, { color: new THREE.Color('#7fd0d8') });
  builder.box(tower.x, 4.3, tower.z, 3.6, 0.3, 3.6, { color: red });
  builder.box(tower.x, 1.1, tower.z + 2.2, 1.2, 0.12, 2.6, { color: white });
  collision.addBox(tower.x - 1.3, tower.z - 1.3, tower.x + 1.3, tower.z + 1.3, 4.5, 'lifeguard');
}

function addPool(builder, pool) {
  const white = new THREE.Color('#f7f7f4');
  builder.box(pool.x, 0.15, pool.z, pool.w + 1, 0.06, pool.d + 1, { color: white });
}

function addFountain(builder, fountain, collision) {
  const stone = new THREE.Color('#e9dfcf');
  const segments = 16;
  for (let k = 0; k < segments; k += 1) {
    const a = (k / segments) * Math.PI * 2;
    builder.box(fountain.x + Math.cos(a) * 5, 0.15, fountain.z + Math.sin(a) * 5, 2.1, 0.7, 2.1, { color: stone });
  }
  builder.box(fountain.x, 0.15, fountain.z, 1.4, 2.6, 1.4, { color: stone });
  builder.box(fountain.x, 2.75, fountain.z, 2.6, 0.3, 2.6, { color: stone });
  collision.addCircle(fountain.x, fountain.z, 5.8, 1, 'fountain');
}

function addGullStatue(builder, statue, collision) {
  const bronze = new THREE.Color('#b0793f');
  const stone = new THREE.Color('#d8ccb8');
  builder.box(statue.x, 0.15, statue.z, 2.4, 2.2, 2.4, { color: stone });
  builder.box(statue.x, 2.35, statue.z, 0.9, 1.4, 0.9, { color: bronze });
  builder.box(statue.x - 1.6, 3.4, statue.z, 2.6, 0.25, 0.8, { color: bronze });
  builder.box(statue.x + 1.6, 3.4, statue.z, 2.6, 0.25, 0.8, { color: bronze });
  builder.box(statue.x, 3.75, statue.z + 0.35, 0.5, 0.5, 0.8, { color: bronze });
  collision.addCircle(statue.x, statue.z, 1.5, 4, 'statue');
}

function waterSurface(item) {
  const geometry = item.type === 'pool' ? new THREE.PlaneGeometry(item.w, item.d) : new THREE.CircleGeometry(4.4, 20);
  const surface = new THREE.Mesh(geometry, cityMaterials().pool);
  surface.rotation.x = -Math.PI / 2;
  surface.position.set(item.x, item.type === 'pool' ? 0.22 : 0.6, item.z);
  return surface;
}

function buildTacoTruck(truck, collision) {
  const group = new THREE.Group();
  group.name = 'taco-truck';
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.4, 2.6, 6), new THREE.MeshStandardMaterial({ color: 0xffd166, roughness: 0.5 }));
  body.position.y = 1.7;
  const cab = new THREE.Mesh(new THREE.BoxGeometry(2.3, 1.6, 1.6), new THREE.MeshStandardMaterial({ color: 0xc4302b, roughness: 0.5 }));
  cab.position.set(0, 1.2, 3.6);
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(5.4, 1.35), new THREE.MeshBasicMaterial({ map: signTexture({ title: 'TACO TORMENTA', background: '#c4302b', color: '#ffd166', accent: '#ffd166', style: 'neon' }) }));
  sign.position.set(1.22, 2.5, 0);
  sign.rotation.y = Math.PI / 2;
  const hatch = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.9, 3.4), new THREE.MeshStandardMaterial({ color: 0x2f2f2f }));
  hatch.position.set(1.22, 1.7, -0.2);
  group.add(body, cab, sign, hatch);
  for (const [x, z] of [[-1.1, -2], [1.1, -2], [-1.1, 2.6], [1.1, 2.6]]) {
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.3, 12), new THREE.MeshStandardMaterial({ color: 0x1b1b1b }));
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(x, 0.42, z);
    group.add(wheel);
  }
  group.position.set(truck.x, 0, truck.z);
  group.traverse((child) => {
    child.castShadow = true;
  });
  collision.addBox(truck.x - 1.3, truck.z - 3, truck.x + 1.3, truck.z + 4.4, 3, 'truck');
  return group;
}

/** Where the plan parks cars that the player may steal. */
export function parkedCarSlots(plan) {
  const slots = [];
  for (const block of plan.blocks) for (const prop of block.props) if (prop.type === 'parkedCar') slots.push({ x: prop.x, z: prop.z, heading: (prop.x > block.cx ? 1 : 0) * Math.PI, block });
  return slots;
}

export const ISLAND = CITY.bounds;
