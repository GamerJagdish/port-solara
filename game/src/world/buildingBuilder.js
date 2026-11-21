// Turns the plan's building footprints into meshes: glass towers with setbacks, pastel stucco shops
// with storefronts and striped awnings, houses with tiled roofs, warehouses, rooftop clutter, the
// Haldane Tower crown, shop signs and billboards. Every footprint also becomes a collision box.
import * as THREE from 'three';
import { MeshBuilder } from './meshBuilder.js';
import { cityMaterials } from './materials.js';
import { signTexture } from './textures.js';
import { hash2 } from '../core/random.js';

const TILE = {
  tower: { u: 8, v: 7.2 },
  stucco: { u: 8, v: 7 },
  house: { u: 8, v: 3.5 },
  warehouse: { u: 8, v: 8 },
};

/** The brand signs of the story's landmarks. */
export const LANDMARK_SIGNS = {
  luckyGull: { title: 'LUCKY GULL', subtitle: 'BAIT · TACKLE · NO QUESTIONS', background: '#11425c', color: '#ffe7a3', accent: '#ff7b54' },
  gunShop: { title: 'BRASS & BARREL', subtitle: 'AMMO · ARMOR · LICENSED', background: '#2b2b2b', color: '#f0c674', accent: '#b5452f' },
  hospital: { title: 'ST. BRIGID MEDICAL', subtitle: 'EMERGENCY', background: '#ffffff', color: '#d6283c', accent: '#d6283c' },
  police: { title: 'PORT SOLARA PD', subtitle: 'HARBOR PRECINCT', background: '#1d3557', color: '#ffffff', accent: '#e63946' },
  surfShack: { title: 'SALT & SWELL', subtitle: 'SURF · SODA · SUN', background: '#ffd6a5', color: '#0b6e75', accent: '#ff7b54' },
  tacoStand: { title: 'TACO TORMENTA', subtitle: '', background: '#c4302b', color: '#ffd166', accent: '#ffd166', style: 'neon' },
};

export function buildBuildings(plan, collision) {
  const mats = cityMaterials();
  const group = new THREE.Group();
  group.name = 'buildings';
  const builders = { tower: new MeshBuilder(), stucco: new MeshBuilder(), house: new MeshBuilder(), warehouse: new MeshBuilder() };
  const shopfront = new MeshBuilder();
  const roofs = new MeshBuilder();
  const tinted = new MeshBuilder();

  for (const block of plan.blocks) {
    for (const building of block.buildings) {
      const tint = new THREE.Color(building.tint);
      const tile = TILE[building.style];
      const builder = builders[building.style];
      const salt = Math.round(building.x * 3 + building.z * 7);
      let base = 0;
      if (building.shopfront) {
        shopfront.box(building.x, 0, building.z, building.w, 4.2, building.d, { tileU: 8, tileV: 4.2, color: tint.clone().lerp(new THREE.Color(1, 1, 1), 0.6), top: false });
        base = 4.2;
        addAwnings(tinted, building);
      }
      if (building.setback) {
        const lower = Math.round(building.h * 0.55);
        builder.box(building.x, base, building.z, building.w, lower - base, building.d, { tileU: tile.u, tileV: tile.v, color: tint });
        roofs.box(building.x, lower, building.z, building.w - 0.6, 0.3, building.d - 0.6, { tileU: 6, tileV: 6, color: tint.clone().multiplyScalar(0.8) });
        builder.box(building.x, lower, building.z, building.w * 0.72, building.h - lower, building.d * 0.72, { tileU: tile.u, tileV: tile.v, color: tint });
      } else {
        builder.box(building.x, base, building.z, building.w, building.h - base, building.d, { tileU: tile.u, tileV: tile.v, color: tint });
      }
      const topW = building.setback ? building.w * 0.72 : building.w;
      const topD = building.setback ? building.d * 0.72 : building.d;
      if (building.roof === 'tile') {
        addTiledRoof(tinted, building);
      } else {
        roofs.box(building.x, building.h, building.z, topW - 0.7, 0.18, topD - 0.7, { tileU: 6, tileV: 6, color: new THREE.Color(0.95, 0.93, 0.9) });
        // Parapet rim.
        tinted.box(building.x, building.h, building.z - topD / 2 + 0.15, topW, 0.8, 0.3, { color: tint.clone().multiplyScalar(0.9) });
        tinted.box(building.x, building.h, building.z + topD / 2 - 0.15, topW, 0.8, 0.3, { color: tint.clone().multiplyScalar(0.9) });
        tinted.box(building.x - topW / 2 + 0.15, building.h, building.z, 0.3, 0.8, topD, { color: tint.clone().multiplyScalar(0.9) });
        tinted.box(building.x + topW / 2 - 0.15, building.h, building.z, 0.3, 0.8, topD, { color: tint.clone().multiplyScalar(0.9) });
        addRooftopClutter(tinted, building, topW, topD, salt);
      }
      if (building.crown) addCrown(group, tinted, building);
      if (building.billboard) addBillboard(group, building);
      if (building.sign) addSign(group, building);
      collision.addBox(building.x - building.w / 2, building.z - building.d / 2, building.x + building.w / 2, building.z + building.d / 2, building.h, 'building');
    }
  }

  for (const [style, builder] of Object.entries(builders)) {
    if (builder.vertexCount === 0) continue;
    const mesh = new THREE.Mesh(builder.build(), mats[style]);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.name = `buildings-${style}`;
    group.add(mesh);
  }
  for (const [builder, material, name] of [[shopfront, mats.shopfront, 'shopfronts'], [roofs, mats.roof, 'roofs'], [tinted, mats.tinted, 'building-details']]) {
    const mesh = new THREE.Mesh(builder.build(), material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.name = name;
    group.add(mesh);
  }
  return group;
}

function addAwnings(builder, building) {
  const color = new THREE.Color(building.awning);
  const white = new THREE.Color('#fbf7ef');
  const depth = 1.6;
  const faces = { north: [0, -1], south: [0, 1], west: [-1, 0], east: [1, 0] };
  const [fx, fz] = faces[building.face] ?? [0, 1];
  const along = fx === 0;
  const length = (along ? building.w : building.d) - 1.5;
  const stripes = Math.max(3, Math.floor(length / 1.2));
  const stripe = length / stripes;
  for (let k = 0; k < stripes; k += 1) {
    const offset = -length / 2 + stripe * (k + 0.5);
    const x = building.x + (along ? offset : fx * (building.w / 2 + depth / 2));
    const z = building.z + (along ? fz * (building.d / 2 + depth / 2) : offset);
    builder.box(x, 3.3, z, along ? stripe : depth, 0.25, along ? depth : stripe, { color: k % 2 === 0 ? color : white });
  }
}

function addTiledRoof(builder, building) {
  const terracotta = new THREE.Color('#c8693f');
  const dark = new THREE.Color('#a9532f');
  const steps = 5;
  for (let k = 0; k < steps; k += 1) {
    const inset = k * 1.2;
    builder.box(building.x, building.h + k * 0.55, building.z, building.w + 0.8 - inset * 2, 0.55, building.d + 0.8 - inset * 2, { color: k % 2 === 0 ? terracotta : dark });
  }
}

function addRooftopClutter(builder, building, width, depth, salt) {
  const grey = new THREE.Color('#c9c9c4');
  const count = Math.min(4, Math.floor((width * depth) / 120) + 1);
  for (let k = 0; k < count; k += 1) {
    const x = building.x + (hash2(salt, k, 1) - 0.5) * (width - 4);
    const z = building.z + (hash2(salt, k, 2) - 0.5) * (depth - 4);
    builder.box(x, building.h, z, 2.2, 1.4, 1.6, { color: grey });
  }
  if (building.style === 'tower' && hash2(salt, 9, 3) < 0.5) {
    builder.box(building.x, building.h, building.z, 3, 3.5, 3, { color: new THREE.Color('#8f8a82') });
  }
}

function addCrown(group, builder, building) {
  const steel = new THREE.Color('#dfe6ea');
  builder.box(building.x, building.h, building.z, building.w * 0.55, 8, building.d * 0.55, { color: steel });
  builder.box(building.x, building.h + 8, building.z, 1, 22, 1, { color: steel });
  const texture = signTexture({ title: 'HALDANE', background: '#0f2236', color: '#ffd27a', accent: '#ffd27a', style: 'neon', width: 512, height: 128 });
  const material = new THREE.MeshBasicMaterial({ map: texture, toneMapped: false });
  const width = building.w * 0.55;
  for (let k = 0; k < 4; k += 1) {
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(width - 0.4, 3.6), material);
    const angle = (k * Math.PI) / 2;
    plane.position.set(building.x + Math.sin(angle) * (width / 2 + 0.05), building.h + 4.5, building.z + Math.cos(angle) * (width / 2 + 0.05));
    plane.rotation.y = angle;
    group.add(plane);
  }
}

function addBillboard(group, building) {
  const board = new THREE.Group();
  const texture = signTexture({ ...building.billboard, style: 'billboard', width: 512, height: 256 });
  const face = new THREE.Mesh(new THREE.PlaneGeometry(14, 7), new THREE.MeshStandardMaterial({ map: texture, roughness: 0.6, emissive: 0x222222 }));
  face.position.y = 5.5;
  board.add(face);
  const back = new THREE.Mesh(new THREE.BoxGeometry(14.4, 7.4, 0.3), new THREE.MeshStandardMaterial({ color: 0x40464d }));
  back.position.set(0, 5.5, -0.2);
  board.add(back);
  for (const side of [-4, 4]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.3, 2.4, 0.3), new THREE.MeshStandardMaterial({ color: 0x40464d }));
    leg.position.set(side, 1.2, -0.2);
    board.add(leg);
  }
  board.position.set(building.x, building.h, building.z);
  // Face the board toward the city centre-south so it reads from the main roads.
  board.rotation.y = Math.abs(building.x) > Math.abs(building.z) ? (building.x > 0 ? -Math.PI / 2 : Math.PI / 2) : 0;
  board.traverse((child) => {
    child.castShadow = true;
  });
  group.add(board);
}

function addSign(group, building) {
  const spec = LANDMARK_SIGNS[building.sign];
  if (!spec) return;
  const texture = signTexture({ ...spec, width: 512, height: 128 });
  const material = new THREE.MeshStandardMaterial({ map: texture, roughness: 0.5, emissive: 0xffffff, emissiveMap: texture, emissiveIntensity: 0.35 });
  const width = Math.min(14, Math.max(building.w, building.d) * 0.8);
  const facing = { north: [0, -1], south: [0, 1], west: [-1, 0], east: [1, 0] };
  const sides = building.face ? [facing[building.face]] : [[0, 1], [-1, 0], [1, 0], [0, -1]];
  for (const [fx, fz] of sides) {
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(width, width / 4), material);
    const y = building.shopfront ? 5.6 : Math.min(building.h - 1.6, 7);
    plane.position.set(building.x + fx * (building.w / 2 + 0.08), y, building.z + fz * (building.d / 2 + 0.08));
    plane.rotation.y = Math.atan2(fx, fz);
    group.add(plane);
  }
}
