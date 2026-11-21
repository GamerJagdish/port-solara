// The radar in the corner: a pre-painted map of the island (districts, roads, beach, quay, pier)
// that turns with the camera around Nico's arrow, with blips for police (flashing red and blue),
// enemies, the mission target and marker (clamped to the rim when off-map), Mari, the gun shop,
// the police search area, and a GPS route along the roads to the objective.
import { CITY } from '../core/config.js';
import { DISTRICTS, districtOfBlock, nodeX, nodeZ, blockCenterX, blockCenterZ, PIER } from '../world/cityLayout.js';
import { routeBetween } from '../world/roadGraph.js';
import { place } from '../missions/missionPlaces.js';

const MAP_SCALE = 1.6; // pixels per metre on the painted map
const PAD = 160;

export class Minimap {
  constructor(game, canvas) {
    this.game = game;
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.zoom = 1;
    this.routeTimer = 0;
    this.route = null;
    this.paintMap();
  }

  toMap(x, z) {
    return { x: (x - CITY.bounds.minX + PAD) * MAP_SCALE, y: (z - CITY.bounds.minZ + PAD) * MAP_SCALE };
  }

  paintMap() {
    const b = CITY.bounds;
    const width = (b.maxX - b.minX + PAD * 2) * MAP_SCALE;
    const height = (b.maxZ - b.minZ + PAD * 2) * MAP_SCALE;
    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(width);
    canvas.height = Math.ceil(height);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#2b8fb3';
    ctx.fillRect(0, 0, width, height);
    const rect = (x0, z0, x1, z1, color) => {
      const a = this.toMap(x0, z0);
      const c = this.toMap(x1, z1);
      ctx.fillStyle = color;
      ctx.fillRect(a.x, a.y, c.x - a.x, c.y - a.y);
    };
    rect(b.minX, b.minZ - 200, CITY.maxX + CITY.road / 2, CITY.maxZ, '#7fae5c');
    rect(b.minX, CITY.maxZ, b.maxX, b.maxZ, '#ecd9a6');
    rect(CITY.maxX, b.minZ, b.maxX, CITY.maxZ + CITY.road / 2, '#9a9b9e');
    rect(PIER.x - PIER.width / 2, b.maxZ, PIER.x + PIER.width / 2, PIER.startZ + PIER.length, '#b88b62');
    rect(PIER.x - 17, PIER.startZ + PIER.length, PIER.x + 17, PIER.startZ + PIER.length + 30, '#b88b62');
    for (let bj = 0; bj < CITY.rows; bj += 1) {
      for (let bi = 0; bi < CITY.cols; bi += 1) {
        const cx = blockCenterX(bi);
        const cz = blockCenterZ(bj);
        const h = CITY.block / 2;
        rect(cx - h, cz - h, cx + h, cz + h, DISTRICTS[districtOfBlock(bi, bj)].map);
      }
    }
    for (const block of this.game.city.plan.blocks) {
      for (const building of block.buildings) {
        rect(building.x - building.w / 2, building.z - building.d / 2, building.x + building.w / 2, building.z + building.d / 2, building.style === 'tower' ? '#8f8a84' : 'rgba(80,70,60,0.35)');
      }
    }
    const half = CITY.road / 2;
    for (let j = 0; j <= CITY.rows; j += 1) rect(CITY.minX - half, nodeZ(j) - half, CITY.maxX + half, nodeZ(j) + half, '#3d3f46');
    for (let i = 0; i <= CITY.cols; i += 1) rect(nodeX(i) - half, CITY.minZ - half, nodeX(i) + half, CITY.maxZ + half, '#3d3f46');
    this.map = canvas;
  }

  /** Recomputes the GPS route to the objective once a second. */
  updateRoute(dt, goal) {
    this.routeTimer -= dt;
    if (!goal) {
      this.route = null;
      return;
    }
    if (this.routeTimer > 0 && this.route) return;
    this.routeTimer = 1;
    const p = this.game.player.focus;
    if (Math.hypot(goal.x - p.x, goal.z - p.z) < 40) {
      this.route = null;
      return;
    }
    this.route = [{ x: p.x, z: p.z }, ...routeBetween(p.x, p.z, goal.x, goal.z), { x: goal.x, z: goal.z }];
  }

  draw(dt) {
    const game = this.game;
    const ctx = this.ctx;
    const size = this.canvas.width;
    const p = game.player.focus;
    const speed = game.player.speed;
    const range = (game.player.vehicle ? 150 + Math.min(speed, 40) * 2 : 110) * this.zoom;
    const scale = size / 2 / range;
    const view = game.missions.view;
    const goal = view ? (view.target ?? view.point) : null;
    this.updateRoute(dt, goal);

    // Up on the radar is where the camera looks: world offsets map through the camera's frame.
    const yaw = game.cameraRig.yaw;
    const cos = Math.cos(yaw);
    const sin = Math.sin(yaw);
    ctx.save();
    ctx.clearRect(0, 0, size, size);
    ctx.setTransform(-cos * scale, -sin * scale, sin * scale, -cos * scale, size / 2, size / 2);
    ctx.save();
    ctx.translate(CITY.bounds.minX - PAD - p.x, CITY.bounds.minZ - PAD - p.z);
    ctx.scale(1 / MAP_SCALE, 1 / MAP_SCALE);
    ctx.drawImage(this.map, 0, 0);
    ctx.restore();
    const at = (x, z) => ({ x: x - p.x, y: z - p.z });

    if (game.wanted.stars > 0 && !game.wanted.seen) {
      const c = at(game.wanted.lastSeen.x, game.wanted.lastSeen.z);
      ctx.fillStyle = 'rgba(255,60,80,0.18)';
      ctx.strokeStyle = 'rgba(80,140,255,0.7)';
      ctx.lineWidth = 2 / scale;
      ctx.beginPath();
      ctx.arc(c.x, c.y, game.wanted.searchRadius, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
    if (this.route) {
      ctx.strokeStyle = '#c86bff';
      ctx.lineWidth = 5 / scale;
      ctx.lineJoin = 'round';
      ctx.beginPath();
      this.route.forEach((point, index) => {
        const q = at(point.x, point.z);
        if (index === 0) ctx.moveTo(q.x, q.y);
        else ctx.lineTo(q.x, q.y);
      });
      ctx.stroke();
    }
    ctx.restore();
    ctx.setTransform(1, 0, 0, 1, 0, 0);

    // Blips are drawn upright in screen space.
    const toScreen = (x, z) => {
      const dx = x - p.x;
      const dz = z - p.z;
      return { x: size / 2 + (-cos * dx + sin * dz) * scale, y: size / 2 + (-sin * dx - cos * dz) * scale };
    };
    const clampToRim = (s) => {
      const dx = s.x - size / 2;
      const dy = s.y - size / 2;
      const limit = size / 2 - 10;
      const m = Math.max(Math.abs(dx), Math.abs(dy));
      if (m <= limit) return { ...s, clamped: false };
      return { x: size / 2 + (dx / m) * limit, y: size / 2 + (dy / m) * limit, clamped: true };
    };
    const dot = (x, z, color, radius = 5, outline = '#1a1035', clamp = false) => {
      let s = toScreen(x, z);
      if (clamp) s = clampToRim(s);
      else if (s.x < 0 || s.y < 0 || s.x > size || s.y > size) return;
      ctx.fillStyle = color;
      ctx.strokeStyle = outline;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(s.x, s.y, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    };
    const label = (x, z, text, color, clamp = true) => {
      let s = toScreen(x, z);
      if (clamp) s = clampToRim(s);
      else if (s.x < 0 || s.y < 0 || s.x > size || s.y > size) return;
      ctx.fillStyle = color;
      ctx.strokeStyle = '#1a1035';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(s.x, s.y, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#1a1035';
      ctx.font = '900 10px Arial Black, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, s.x, s.y + 0.5);
    };

    const shop = place('gunShopDoor');
    label(shop.x, shop.z, '$', '#f0c674', false);
    const hospital = place('hospital');
    label(hospital.x, hospital.z, '+', '#ff8fa0', false);
    for (const enemy of view?.enemies ?? []) dot(enemy.pos.x, enemy.pos.z, '#ff4d5a', 4.5);
    const flash = Math.floor(game.time * 5) % 2 === 0;
    for (const unit of game.police.units) {
      if (unit.vehicle.destroyed) continue;
      dot(unit.vehicle.pos.x, unit.vehicle.pos.z, flash ? '#ff3b4f' : '#3d7bff', 5, '#ffffff');
    }
    for (const officer of game.police.officersOnFoot) dot(officer.pos.x, officer.pos.z, flash ? '#3d7bff' : '#ff3b4f', 3.5, '#ffffff');
    if (view?.contact && view.point) label(view.point.x, view.point.z, 'M', '#5ee7ff');
    else if (view?.target) label(view.target.x, view.target.z, '!', '#ff4d5a');
    else if (view?.point) label(view.point.x, view.point.z, '★', '#ffd23f');

    // Nico's arrow, pointing where he faces relative to the camera.
    const heading = game.player.vehicle ? game.player.vehicle.heading : game.player.heading;
    ctx.save();
    ctx.translate(size / 2, size / 2);
    ctx.rotate(yaw - heading);
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#1a1035';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, -9);
    ctx.lineTo(7, 8);
    ctx.lineTo(0, 4);
    ctx.lineTo(-7, 8);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
    ctx.fillStyle = 'rgba(26,16,53,0.8)';
    ctx.font = '900 12px Arial Black, sans-serif';
    const north = clampToRim(toScreen(p.x, p.z - 5000));
    ctx.beginPath();
    ctx.arc(north.x, north.y, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('N', north.x, north.y + 1);
  }
}
