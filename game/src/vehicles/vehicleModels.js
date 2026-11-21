// Builds the low-poly 3D model of each car from boxes: painted body, tinted glasshouse, bumpers,
// head and tail lights, wheels on steering pivots, the police light bar and door decals. Body
// geometry is cached per model and paint, so traffic spawns cost almost nothing.
import * as THREE from 'three';
import { MeshBuilder } from '../world/meshBuilder.js';
import { signTexture } from '../world/textures.js';

const shared = {};
const geometryCache = new Map();

function materials() {
  if (shared.paint) return shared;
  shared.paint = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.3, metalness: 0.25 });
  shared.glass = new THREE.MeshStandardMaterial({ color: 0x1a2733, roughness: 0.06, metalness: 0.6 });
  shared.front = new THREE.MeshBasicMaterial({ color: 0xfff6dc, toneMapped: false });
  shared.tire = new THREE.MeshStandardMaterial({ color: 0x1c1c1e, roughness: 0.9 });
  shared.hub = new THREE.MeshStandardMaterial({ color: 0xc9ccd1, roughness: 0.3, metalness: 0.7 });
  shared.wheel = null;
  shared.police = new THREE.MeshBasicMaterial({ map: signTexture({ title: 'PSPD', subtitle: 'PORT SOLARA POLICE', background: '#f4f4f4', color: '#1d3557', accent: '#e63946' }), transparent: false });
  shared.haldane = new THREE.MeshBasicMaterial({ map: signTexture({ title: 'HALDANE', subtitle: 'SECURE COURIER', background: '#1d3047', color: '#ffd27a', accent: '#ffd27a' }) });
  shared.taxi = new THREE.MeshBasicMaterial({ map: signTexture({ title: 'VIREO CAB', background: '#ffe9a8', color: '#1b1b1b', accent: '#1b1b1b', width: 256, height: 64 }), toneMapped: false });
  return shared;
}

const DARK = new THREE.Color('#26282c');
const CHROME = new THREE.Color('#b9bec4');

function bodyGeometry(type, paint) {
  const key = `${type.shape}:${type.length}:${paint}:${type.police ? 1 : 0}:${type.armored ? 1 : 0}`;
  if (geometryCache.has(key)) return geometryCache.get(key);
  const L = type.length;
  const W = type.width;
  const H = type.height;
  const color = new THREE.Color(paint);
  const body = new MeshBuilder();
  const glass = new MeshBuilder();
  const front = new MeshBuilder();
  const rear = new MeshBuilder();
  const lightY = type.shape === 'sports' ? 0.62 : 0.78;

  if (type.shape === 'van') {
    body.box(0, 0.38, -0.25, W, H - 0.45, L - 0.6, { color });
    body.box(0, 0.38, L / 2 - 0.45, W, 0.75, 0.9, { color });
    glass.box(0, 1.12, L / 2 - 1.12, W + 0.02, H - 1.3, 0.9, {});
    glass.box(0, 1.25, -0.6, W + 0.02, 0.62, L * 0.45, { top: false });
    if (type.armored) body.box(0, 1.05, -0.25, W + 0.03, 0.14, L - 0.7, { color: new THREE.Color('#d4a64a') });
  } else if (type.shape === 'pickup') {
    body.box(0, 0.42, 0, W, 0.68, L - 0.1, { color });
    glass.box(0, 1.1, 0.35, W - 0.12, H - 1.2, 1.7, {});
    body.box(0, H - 0.1, 0.35, W - 0.16, 0.1, 1.6, { color });
    body.box(-W / 2 + 0.06, 1.1, -L / 2 + 1.0, 0.12, 0.42, 1.9, { color });
    body.box(W / 2 - 0.06, 1.1, -L / 2 + 1.0, 0.12, 0.42, 1.9, { color });
    body.box(0, 1.1, -L / 2 + 0.08, W, 0.42, 0.12, { color });
  } else {
    const sports = type.shape === 'sports';
    const beltY = sports ? 0.78 : 0.95;
    body.box(0, 0.3, 0, W, beltY - 0.3, L - 0.1, { color });
    const cabinLength = sports ? L * 0.36 : L * 0.44;
    const cabinZ = sports ? -L * 0.06 : -L * 0.06;
    glass.box(0, beltY, cabinZ, W - (sports ? 0.24 : 0.14), H - beltY - 0.08, cabinLength, {});
    body.box(0, H - 0.09, cabinZ, W - (sports ? 0.3 : 0.2), 0.09, cabinLength - 0.3, { color });
    if (sports) {
      body.box(0, 0.98, -L / 2 + 0.25, W - 0.2, 0.08, 0.4, { color: DARK });
      body.box(-W / 2 + 0.3, 0.78, -L / 2 + 0.3, 0.08, 0.22, 0.08, { color: DARK });
      body.box(W / 2 - 0.3, 0.78, -L / 2 + 0.3, 0.08, 0.22, 0.08, { color: DARK });
    }
    if (type.police) {
      body.box(0, 0.32, cabinZ, W + 0.02, beltY - 0.36, cabinLength, { color: new THREE.Color('#1b2230'), top: false });
      body.box(0, beltY - 0.02, L / 2 - 0.65, W - 0.1, 0.03, 1.1, { color: new THREE.Color('#1b2230') });
    }
  }
  // Bumpers, skirts and grille.
  body.box(0, 0.26, L / 2 - 0.05, W + 0.04, 0.26, 0.22, { color: DARK });
  body.box(0, 0.26, -L / 2 + 0.05, W + 0.04, 0.26, 0.22, { color: DARK });
  body.box(0, 0.5, L / 2 + 0.01, W * 0.45, 0.2, 0.06, { color: type.police ? DARK : CHROME });
  for (const side of [-1, 1]) {
    front.box(side * (W / 2 - 0.32), lightY - 0.08, L / 2 + 0.01, 0.42, 0.16, 0.06, {});
    rear.box(side * (W / 2 - 0.28), lightY - 0.08, -L / 2 - 0.01, 0.38, 0.16, 0.06, {});
  }
  const result = { body: body.build(), glass: glass.build(), front: front.build(), rear: rear.build() };
  geometryCache.set(key, result);
  return result;
}

function wheelGeometry() {
  if (!shared.wheelGeometry) {
    shared.wheelGeometry = new THREE.CylinderGeometry(1, 1, 0.3, 14);
    shared.wheelGeometry.rotateZ(Math.PI / 2);
  }
  return shared.wheelGeometry;
}

/** A complete car model; the returned parts are what the Vehicle animates. */
export function createVehicleModel(type, paint) {
  const mats = materials();
  const geometry = bodyGeometry(type, paint);
  const root = new THREE.Group();
  const body = new THREE.Mesh(geometry.body, mats.paint);
  body.castShadow = true;
  body.receiveShadow = true;
  const glass = new THREE.Mesh(geometry.glass, mats.glass);
  glass.castShadow = true;
  const front = new THREE.Mesh(geometry.front, mats.front);
  const rearMaterial = new THREE.MeshBasicMaterial({ color: 0x8a1010, toneMapped: false });
  const rear = new THREE.Mesh(geometry.rear, rearMaterial);
  root.add(body, glass, front, rear);

  const wheels = [];
  const wheelMaterials = [mats.tire, mats.hub, mats.hub];
  const L = type.length;
  const W = type.width;
  const axle = L / 2 - (type.shape === 'van' ? 1.0 : 0.85);
  for (const [sx, sz] of [[-1, 1], [1, 1], [-1, -1], [1, -1]]) {
    const pivot = new THREE.Group();
    pivot.position.set(sx * (W / 2 - 0.12), type.wheel, sz * axle);
    const spin = new THREE.Mesh(wheelGeometry(), mats.tire);
    spin.scale.set(1, type.wheel, type.wheel);
    spin.castShadow = true;
    const hub = new THREE.Mesh(shared.hubGeometry ?? (shared.hubGeometry = new THREE.CylinderGeometry(0.62, 0.62, 0.32, 10).rotateZ(Math.PI / 2)), mats.hub);
    spin.add(hub);
    pivot.add(spin);
    root.add(pivot);
    wheels.push({ pivot, spin, front: sz > 0 });
  }
  void wheelMaterials;

  const parts = { root, body, glass, front, rear, rearMaterial, wheels, lightbar: null };
  if (type.police) {
    const red = new THREE.MeshBasicMaterial({ color: 0x550000, toneMapped: false });
    const blue = new THREE.MeshBasicMaterial({ color: 0x000055, toneMapped: false });
    const barGeometry = new THREE.BoxGeometry(0.55, 0.16, 0.32);
    const left = new THREE.Mesh(barGeometry, red);
    const right = new THREE.Mesh(barGeometry, blue);
    left.position.set(-0.32, type.height + 0.08, -0.2);
    right.position.set(0.32, type.height + 0.08, -0.2);
    root.add(left, right);
    parts.lightbar = { red, blue };
    addDecals(root, mats.police, type, 1.3, 0.62);
  }
  if (type.armored) addDecals(root, mats.haldane, type, 2.6, 1.5);
  if (type.taxi) {
    const sign = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.26, 0.3), [mats.taxi, mats.taxi, mats.front, mats.front, mats.taxi, mats.taxi]);
    sign.position.set(0, type.height + 0.13, -0.3);
    sign.rotation.y = Math.PI / 2;
    root.add(sign);
  }
  return parts;
}

function addDecals(root, material, type, width, y) {
  for (const side of [-1, 1]) {
    const decal = new THREE.Mesh(new THREE.PlaneGeometry(width, width / 4), material);
    decal.position.set(side * (type.width / 2 + 0.02), y, -0.1);
    decal.rotation.y = side * Math.PI / 2;
    root.add(decal);
  }
}
