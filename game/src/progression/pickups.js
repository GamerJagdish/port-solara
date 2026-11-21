// Things to pick up by walking or driving through them: the twelve hidden Sun Tokens, health packs at
// St. Brigid's and around town, armour, pistol ammo, and the cash people drop when knocked out.
import * as THREE from 'three';
import { LANDMARK_BLOCKS, blockCenterX, blockCenterZ, nodeX, nodeZ, PIER, CRANES } from '../world/cityLayout.js';
import { CITY } from '../core/config.js';
import { place } from '../missions/missionPlaces.js';

/** Hand-placed token spots: rooftop-free corners, the pier, the beach, the quay, the plaza. */
export const TOKEN_SPOTS = [
  { x: PIER.x + 12, z: PIER.startZ + PIER.length + 24 },
  { x: blockCenterX(LANDMARK_BLOCKS.plaza.bi) + 8, z: blockCenterZ(LANDMARK_BLOCKS.plaza.bj) + 8 },
  { x: CRANES[1].x, z: CRANES[1].z },
  { x: CITY.minX - 20, z: nodeZ(2) },
  { x: nodeX(2) + 20, z: CITY.maxZ + 40 },
  { x: nodeX(9) + 14, z: CITY.maxZ + 30 },
  { x: blockCenterX(0), z: blockCenterZ(0) },
  { x: blockCenterX(9) + 18, z: blockCenterZ(1) + 20 },
  { x: blockCenterX(6), z: blockCenterZ(6) },
  { x: blockCenterX(3), z: blockCenterZ(0) },
  { x: CITY.maxX + 38, z: nodeZ(7) },
  { x: blockCenterX(2), z: CITY.minZ - 30 },
];

const KINDS = {
  token: { color: 0xffc928, emissive: 0xffa000, size: 0.55 },
  health: { color: 0xff4d5a, emissive: 0xaa1020, size: 0.45 },
  armor: { color: 0x4dabf7, emissive: 0x1050a0, size: 0.45 },
  ammo: { color: 0x9a8f6a, emissive: 0x302810, size: 0.4 },
  cash: { color: 0x67d46b, emissive: 0x1a6a1e, size: 0.35 },
};

export class Pickups {
  constructor(game) {
    this.game = game;
    this.items = [];
    this.geometries = {
      token: new THREE.CylinderGeometry(0.55, 0.55, 0.12, 20).rotateX(Math.PI / 2),
      health: new THREE.BoxGeometry(0.7, 0.7, 0.7),
      armor: new THREE.BoxGeometry(0.7, 0.8, 0.35),
      ammo: new THREE.BoxGeometry(0.6, 0.4, 0.4),
      cash: new THREE.BoxGeometry(0.5, 0.12, 0.28),
    };
    this.materials = {};
    for (const [kind, spec] of Object.entries(KINDS)) {
      this.materials[kind] = new THREE.MeshStandardMaterial({ color: spec.color, emissive: spec.emissive, emissiveIntensity: 0.8, roughness: 0.35, metalness: 0.3 });
    }
    game.events.on('ped:killed', ({ ped, source }) => {
      if (source === 'player' && ped.role !== 'contact') this.spawn('cash', ped.pos.x, ped.pos.z, { amount: ped.role === 'enforcer' ? 120 : ped.cash, temporary: true });
      if (ped.role === 'enforcer' || ped.role === 'officer') this.spawn('ammo', ped.pos.x + 0.6, ped.pos.z, { amount: 12, temporary: true });
    });
  }

  spawn(kind, x, z, extra = {}) {
    const mesh = new THREE.Mesh(this.geometries[kind], this.materials[kind]);
    mesh.position.set(x, 0.9, z);
    mesh.castShadow = true;
    this.game.scene.add(mesh);
    const item = { kind, x, z, mesh, life: extra.temporary ? 30 : Infinity, respawn: extra.respawn ?? 0, hidden: 0, ...extra };
    this.items.push(item);
    return item;
  }

  /** Places the city's permanent pickups for a fresh or loaded game. */
  populate() {
    for (const item of this.items) this.game.scene.remove(item.mesh);
    this.items = [];
    TOKEN_SPOTS.forEach((spot, index) => {
      if (!this.game.progress.tokens.has(index)) this.spawn('token', spot.x, spot.z, { id: index });
    });
    const hospital = place('hospital');
    this.spawn('health', hospital.x + 3, hospital.z, { respawn: 40 });
    this.spawn('health', place('gullDoor').x + 2, place('gullDoor').z - 4, { respawn: 60 });
    this.spawn('health', blockCenterX(LANDMARK_BLOCKS.plaza.bi) - 10, blockCenterZ(LANDMARK_BLOCKS.plaza.bj), { respawn: 60 });
    this.spawn('armor', place('policeStation').x + 6, place('policeStation').z, { respawn: 90 });
    this.spawn('ammo', place('gunShopDoor').x, place('gunShopDoor').z + 4, { respawn: 45, amount: 24 });
  }

  collect(item) {
    const game = this.game;
    const player = game.player;
    switch (item.kind) {
      case 'token':
        game.progress.collectToken(item.id);
        break;
      case 'health':
        if (player.health >= 100) return false;
        player.heal(50);
        game.notify.toast('Health +50');
        break;
      case 'armor':
        if (player.armor >= 100) return false;
        player.armor = 100;
        game.notify.toast('Body armour');
        break;
      case 'ammo':
        if (!game.combat.hasPistol) return false;
        game.combat.givePistol(item.amount ?? 12);
        game.notify.toast(`Ammo +${item.amount ?? 12}`);
        break;
      case 'cash':
        game.progress.addCash(item.amount ?? 20);
        break;
      default:
        break;
    }
    game.events.emit('pickup', { kind: item.kind });
    return true;
  }

  update(dt) {
    const game = this.game;
    const p = game.player.focus;
    const time = game.time;
    for (const item of this.items.slice()) {
      if (item.hidden > 0) {
        item.hidden -= dt;
        item.mesh.visible = item.hidden <= 0;
        continue;
      }
      item.mesh.rotation.y = time * 2 + item.x;
      item.mesh.position.y = 0.9 + Math.sin(time * 3 + item.z) * 0.15;
      if (item.kind === 'token' && Math.floor(time * 10 + item.x) % 6 === 0) game.fx.sparkle(item.x, 0.9, item.z);
      item.life -= dt;
      const reach = game.player.vehicle ? 2.6 : 1.3;
      if (!game.player.dead && Math.hypot(item.x - p.x, item.z - p.z) < reach && this.collect(item)) {
        if (item.respawn > 0) {
          item.hidden = item.respawn;
          item.mesh.visible = false;
        } else {
          this.remove(item);
        }
        continue;
      }
      if (item.life <= 0) this.remove(item);
    }
  }

  remove(item) {
    this.items = this.items.filter((i) => i !== item);
    this.game.scene.remove(item.mesh);
  }
}
