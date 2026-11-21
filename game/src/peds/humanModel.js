// The low-poly person every character is built from (the player, pedestrians, police officers, the
// Haldane crew): hips, torso, head with hair, two jointed arms and legs, an optional cap and pistol.
// `animateHuman` poses it for standing, walking, running, aiming, punching, falling and lying dead.
import * as THREE from 'three';

const geometries = {};
const materialCache = new Map();

function geometry(name, make) {
  if (!geometries[name]) geometries[name] = make();
  return geometries[name];
}

function material(color) {
  if (!materialCache.has(color)) materialCache.set(color, new THREE.MeshStandardMaterial({ color, roughness: 0.8 }));
  return materialCache.get(color);
}

function limbBox(width, length, depth) {
  const box = new THREE.BoxGeometry(width, length, depth);
  box.translate(0, -length / 2, 0);
  return box;
}

export const SKIN_TONES = ['#f1c7a5', '#d9a07a', '#b77a52', '#8d5a3b', '#5f3c28', '#e8b896'];
export const HAIR_COLORS = ['#1d1612', '#3b2618', '#7a4b26', '#c99a5b', '#e6d3a3', '#2a2a2a', '#8c2f1c'];
export const SHIRT_COLORS = ['#ff7f6e', '#2ec4b6', '#ffd166', '#f6f1e9', '#6c8ead', '#e76f9a', '#83c5be', '#f4a261', '#9b5de5', '#3d405b'];
export const PANTS_COLORS = ['#2f3e56', '#e9dcc4', '#3b3b3b', '#6b705c', '#a5a58d', '#1d3557'];

/**
 * look: { skin, hair, shirt, pants, shoes, cap, capColor, hairStyle ('short'|'long'|'bald'), build (scale) }
 */
export function createHuman(look) {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const build = look.build ?? 1;
  body.scale.setScalar(build);

  const hips = new THREE.Group();
  hips.position.y = 0.95;
  body.add(hips);
  const torso = new THREE.Mesh(geometry('torso', () => {
    const g = new THREE.BoxGeometry(0.5, 0.62, 0.28);
    g.translate(0, 0.31, 0);
    return g;
  }), material(look.shirt));
  hips.add(torso);
  const pelvis = new THREE.Mesh(geometry('pelvis', () => new THREE.BoxGeometry(0.46, 0.18, 0.26)), material(look.pants));
  hips.add(pelvis);
  const neck = new THREE.Group();
  neck.position.y = 0.62;
  hips.add(neck);
  const head = new THREE.Mesh(geometry('head', () => {
    const g = new THREE.BoxGeometry(0.26, 0.3, 0.27);
    g.translate(0, 0.19, 0);
    return g;
  }), material(look.skin));
  neck.add(head);
  if (look.hairStyle !== 'bald') {
    const long = look.hairStyle === 'long';
    const hair = new THREE.Mesh(geometry(long ? 'hairLong' : 'hair', () => {
      const g = new THREE.BoxGeometry(0.29, long ? 0.34 : 0.11, 0.3);
      g.translate(0, long ? 0.22 : 0.33, long ? -0.03 : 0);
      return g;
    }), material(look.hair));
    neck.add(hair);
  }
  if (look.cap) {
    const cap = new THREE.Mesh(geometry('cap', () => {
      const g = new THREE.BoxGeometry(0.3, 0.1, 0.31);
      g.translate(0, 0.36, 0);
      return g;
    }), material(look.capColor ?? '#1d3557'));
    const brim = new THREE.Mesh(geometry('brim', () => {
      const g = new THREE.BoxGeometry(0.28, 0.03, 0.14);
      g.translate(0, 0.32, 0.2);
      return g;
    }), material(look.capColor ?? '#1d3557'));
    neck.add(cap, brim);
  }
  if (look.shades) {
    const shades = new THREE.Mesh(geometry('shades', () => {
      const g = new THREE.BoxGeometry(0.27, 0.06, 0.04);
      g.translate(0, 0.22, 0.14);
      return g;
    }), material('#111111'));
    neck.add(shades);
  }

  const limb = (x, y, parent, len, width, color, name) => {
    const pivot = new THREE.Group();
    pivot.position.set(x, y, 0);
    parent.add(pivot);
    const mesh = new THREE.Mesh(geometry(name, () => limbBox(width, len, width)), material(color));
    pivot.add(mesh);
    return pivot;
  };
  const leftArm = limb(0.31, 0.58, hips, 0.64, 0.13, look.sleeves ?? look.skin, look.sleeves ? 'sleeve' : 'arm');
  const rightArm = limb(-0.31, 0.58, hips, 0.64, 0.13, look.sleeves ?? look.skin, look.sleeves ? 'sleeve' : 'arm');
  const leftLeg = limb(0.12, 0, hips, 0.92, 0.17, look.pants, 'leg');
  const rightLeg = limb(-0.12, 0, hips, 0.92, 0.17, look.pants, 'leg');
  for (const leg of [leftLeg, rightLeg]) {
    const shoe = new THREE.Mesh(geometry('shoe', () => {
      const g = new THREE.BoxGeometry(0.17, 0.08, 0.28);
      g.translate(0, -0.9, 0.05);
      return g;
    }), material(look.shoes ?? '#2b2b2b'));
    leg.add(shoe);
  }
  const gun = new THREE.Mesh(geometry('gun', () => {
    const g = new THREE.BoxGeometry(0.06, 0.12, 0.26);
    g.translate(0, -0.66, 0.08);
    return g;
  }), material('#1b1b1b'));
  gun.visible = false;
  rightArm.add(gun);

  root.traverse((child) => {
    if (child.isMesh) child.castShadow = true;
  });
  return { root, body, hips, neck, leftArm, rightArm, leftLeg, rightLeg, gun, phase: 0 };
}

/**
 * Poses a human. state: { speed, aiming, punch (0..1 of a swing), dead, fallen (0..1), driving, armed }.
 */
export function animateHuman(rig, state, dt) {
  const run = state.speed > 4;
  rig.phase += dt * (run ? 11 : 7.5) * Math.min(1, state.speed / (run ? 6 : 1.4));
  const swing = Math.sin(rig.phase) * Math.min(1, state.speed / 1.2) * (run ? 0.95 : 0.55);
  rig.gun.visible = Boolean(state.armed);
  if (state.dead) {
    const fall = state.fallen ?? 1;
    rig.body.rotation.x = -Math.PI / 2 * fall;
    rig.body.position.y = 0.16 * fall;
    rig.leftArm.rotation.set(0, 0, 1.2 * fall);
    rig.rightArm.rotation.set(0, 0, -1.2 * fall);
    rig.leftLeg.rotation.set(0, 0, 0.2 * fall);
    rig.rightLeg.rotation.set(0, 0, -0.15 * fall);
    return;
  }
  rig.body.rotation.x = 0;
  rig.body.position.y = run ? Math.abs(Math.sin(rig.phase)) * 0.06 : 0;
  if (state.driving) {
    rig.leftLeg.rotation.set(-1.4, 0, 0);
    rig.rightLeg.rotation.set(-1.4, 0, 0);
    rig.leftArm.rotation.set(-1.1, 0, 0);
    rig.rightArm.rotation.set(-1.1, 0, 0);
    return;
  }
  rig.leftLeg.rotation.set(swing, 0, 0);
  rig.rightLeg.rotation.set(-swing, 0, 0);
  rig.hips.rotation.y = 0;
  rig.leftArm.rotation.set(-swing * 0.9, 0, 0.06);
  rig.rightArm.rotation.set(swing * 0.9, 0, -0.06);
  if (state.hands) {
    rig.leftArm.rotation.set(-2.9, 0, 0.25);
    rig.rightArm.rotation.set(-2.9, 0, -0.25);
  }
  if (state.aiming) {
    rig.rightArm.rotation.set(-Math.PI / 2 + (state.aimPitch ?? 0), 0, 0.12);
    if (state.armed) rig.leftArm.rotation.set(-Math.PI / 2 + 0.2 + (state.aimPitch ?? 0), 0, -0.45);
  }
  if (state.punch > 0) {
    const t = Math.sin(state.punch * Math.PI);
    rig.rightArm.rotation.set(-Math.PI / 2 * (0.4 + t), 0, -0.1);
    rig.hips.rotation.y = -0.35 * t;
  }
}
