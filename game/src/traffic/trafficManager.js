// Keeps the streets busy around the player: civilian cars are spawned on lanes out of the way of the
// camera, driven by RoadDrivers, and quietly removed once they fall far behind.
import { CITY, TRAFFIC } from '../core/config.js';
import { nodeX, nodeZ } from '../world/cityLayout.js';
import { inGrid, laneWaypoints } from '../world/roadGraph.js';
import { RoadDriver } from './roadDriver.js';
import { TRAFFIC_MIX } from '../vehicles/vehicleTypes.js';

export class TrafficManager {
  constructor(game) {
    this.game = game;
    this.cooldown = 0;
    this.target = TRAFFIC.count;
  }

  get cars() {
    return this.game.vehicles.list.filter((v) => v.role === 'traffic');
  }

  /** Puts a civilian car on a random lane between `min` and `max` metres from the focus. */
  spawnNear(focus, min, max, { visibleOk = false } = {}) {
    const game = this.game;
    for (let attempt = 0; attempt < 12; attempt += 1) {
      const i = Math.floor(game.dice.next() * (CITY.cols + 1));
      const j = Math.floor(game.dice.next() * (CITY.rows + 1));
      const horizontal = game.dice.next() < 0.5;
      const forward = game.dice.next() < 0.5 ? 1 : -1;
      const a = { i, j };
      const b = horizontal ? { i: i + forward, j } : { i, j: j + forward };
      if (!inGrid(b.i, b.j)) continue;
      const lane = laneWaypoints(a, b);
      const t = 0.25 + game.dice.next() * 0.5;
      const x = lane[0].x + (lane[2].x - lane[0].x) * t;
      const z = lane[0].z + (lane[2].z - lane[0].z) * t;
      const d = Math.hypot(x - focus.x, z - focus.z);
      if (d < min || d > max) continue;
      if (!visibleOk && this.inView(x, z)) continue;
      if (game.vehicles.near(x, z, 9).length > 0) continue;
      const heading = Math.atan2(nodeX(b.i) - nodeX(a.i), nodeZ(b.j) - nodeZ(a.j));
      const typeKey = TRAFFIC_MIX[Math.floor(game.dice.next() * TRAFFIC_MIX.length)];
      const vehicle = game.vehicles.spawn(typeKey, { x, z, heading, role: 'traffic' });
      vehicle.driver = 'npc';
      vehicle.ai = new RoadDriver(game, vehicle);
      vehicle.ai.startOn(a, b);
      const speed = vehicle.ai.cruise * 0.8;
      vehicle.vel.x = Math.sin(heading) * speed;
      vehicle.vel.z = Math.cos(heading) * speed;
      return vehicle;
    }
    return null;
  }

  inView(x, z) {
    const camera = this.game.camera;
    const dx = x - camera.position.x;
    const dz = z - camera.position.z;
    const d = Math.hypot(dx, dz);
    if (d > 260) return false;
    const look = this.game.cameraRig.lookDirection;
    return (dx * look.x + dz * look.z) / (d || 1) > 0.45;
  }

  /** Fills the streets at the start of a session or screenshot, visible lanes included. */
  populate(focus) {
    for (let k = 0; k < this.target; k += 1) this.spawnNear(focus, 18, TRAFFIC.spawnMax, { visibleOk: true });
  }

  update(dt) {
    const game = this.game;
    const focus = game.player.pos;
    for (const vehicle of this.cars) {
      const d = Math.hypot(vehicle.pos.x - focus.x, vehicle.pos.z - focus.z);
      if (d > TRAFFIC.despawnRadius && !vehicle.persistent) game.vehicles.remove(vehicle);
    }
    this.cooldown -= dt;
    if (this.cooldown <= 0 && this.cars.length < this.target) {
      this.cooldown = 0.4;
      this.spawnNear(focus, TRAFFIC.spawnMin, TRAFFIC.spawnMax);
    }
  }
}
