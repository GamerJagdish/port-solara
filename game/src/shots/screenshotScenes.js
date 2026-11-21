// Deterministic screenshot scenes behind ?shot=chase|street|combat|title. Each one sets the real game
// up in a story moment (the same systems, the same seed), plays the simulation forward a fixed number
// of steps with scripted keys, and freezes on the final frame, so the same URL always draws the same
// picture.
import { STEP, CITY } from '../core/config.js';
import { nodeX, nodeZ, blockCenterX, blockCenterZ, LANDMARK_BLOCKS } from '../world/cityLayout.js';
import { MISSIONS } from '../missions/storyScript.js';
import { RoadDriver } from '../traffic/roadDriver.js';
import { PursuitDriver } from '../police/pursuitDriver.js';
import { CivilianBrain } from '../peds/civilianBrain.js';
import { ringOf, ringParam } from '../peds/sidewalkPaths.js';

/** Runs `count` simulation steps, calling `script(step)` before each to hold keys. */
function simulate(game, count, script = null) {
  for (let k = 0; k < count; k += 1) {
    if (script) script(k);
    game.step(STEP);
    game.afterSteps(STEP);
  }
}

function hold(game, keys) {
  game.input.held = new Set(keys);
}

/** Starts a mission and skips its spoken opening, as if the player had just walked into Mari's marker. */
function startMissionAt(game, missionIndex) {
  game.missions.completed = missionIndex;
  game.missions.cooldown = 0;
  game.missions.start(MISSIONS[missionIndex]);
  game.notify.clear();
}

function startScene(game) {
  game.state = 'playing';
  game.resetWorld();
  game.menus.hideAll();
  game.hud.show(true);
}

/** Adds a car driving a lane at a given speed. */
function addTraffic(game, typeKey, x, z, heading, speed, paint = null) {
  const vehicle = game.vehicles.spawn(typeKey, { x, z, heading, paint, role: 'traffic' });
  vehicle.driver = 'npc';
  vehicle.ai = new RoadDriver(game, vehicle);
  vehicle.ai.rejoinRoad();
  vehicle.vel.x = Math.sin(heading) * speed;
  vehicle.vel.z = Math.cos(heading) * speed;
  return vehicle;
}

/** Adds a local walking a block's sidewalk ring from a given spot. */
function addWalker(game, x, z, bi, bj) {
  const ring = ringOf(bi, bj);
  const brain = new CivilianBrain(game, { ring, s: ringParam(ring, x, z) });
  return game.peds.add({ x, z, heading: 0, look: game.peds.randomLook(), role: 'civilian', brain });
}

/**
 * The cover: Nico in a stolen Kestrel GT tearing north up palm-lined Solara Boulevard on the last
 * job, Haldane's gold car ahead, three PSPD cruisers on his bumper, seen from the look-back camera.
 */
function chaseScene(game) {
  startScene(game);
  game.progress.restore({ cash: 18450, tokens: [0, 3, 5, 8, 9], stats: { carsStolen: 41 } });
  const laneX = nodeX(5) + CITY.laneOffset;
  const z0 = nodeZ(7) - 4;
  game.spawnPlayer(laneX, z0, Math.PI);
  const car = game.vehicles.spawn('kestrel', { x: laneX, z: z0, heading: Math.PI, paint: '#ff5d3a', role: 'player' });
  game.player.enterVehicle(car);
  game.notify.clear();
  car.vel.z = -30;
  startMissionAt(game, 4);
  simulate(game, 1);
  const target = game.missions.active.ctx.refs.haldane;
  target.pos.set(laneX, 0, z0 - 52);
  target.heading = Math.PI;
  target.vel.z = -27;
  target.health = 130;
  target.ai.rejoinRoad();
  game.wanted.force(3);
  const units = [
    { x: laneX - 3.4, z: z0 + 10 },
    { x: laneX + 0.4, z: z0 + 18 },
    { x: laneX - 4.6, z: z0 + 27 },
  ];
  for (const spec of units) {
    const unit = game.police.spawnUnit(0, 999, { at: { x: spec.x, z: spec.z, heading: Math.PI } });
    unit.vehicle.vel.z = -31;
  }
  for (const [type, dz, paint] of [['marlin', 40, '#2d5d8a'], ['bodega', 75, '#f6c453'], ['vireo', 115, null], ['surfline', 150, '#66a182']]) {
    addTraffic(game, type, nodeX(5) - CITY.laneOffset, z0 - dz, 0, 12, paint);
  }
  addTraffic(game, 'marlin', nodeX(5) - CITY.laneOffset, z0 + 60, 0, 12, '#e8e4dc');
  game.peds.populate(game.player.focus);
  for (let k = 0; k < 5; k += 1) addWalker(game, nodeX(5) - 9, z0 - 20 + k * 8, 4, 6);
  for (let k = 0; k < 4; k += 1) addWalker(game, nodeX(5) + 9, z0 - 14 + k * 9, 5, 6);
  game.hud.snap();
  simulate(game, 36, () => hold(game, ['KeyW']));
  const rig = game.cameraRig;
  rig.carYawOffset = Math.PI + 0.58;
  rig.carPitch = 0.17;
  rig.mouseIdle = 0;
  rig.yaw = car.heading + rig.carYawOffset;
  rig.distance = 10.5;
  simulate(game, 2, () => hold(game, ['KeyW']));
  rig.yaw = car.heading + rig.carYawOffset;
  rig.mouseIdle = 0;
  game.afterSteps(STEP);
}

/** Nico on foot on the Seaglass Parade sidewalk: hotels, palms, beachgoers, traffic and the sea. */
function streetScene(game) {
  startScene(game);
  game.progress.restore({ cash: 2350, tokens: [1], stats: {} });
  game.missions.completed = 1;
  game.missions.cooldown = 0;
  const bi = 4;
  const bj = CITY.rows - 1;
  const z = blockCenterZ(bj) + CITY.block / 2 - CITY.sidewalk / 2;
  const x = blockCenterX(bi) - 8;
  game.spawnPlayer(x, z, Math.PI / 2);
  for (let k = 0; k < 9; k += 1) addWalker(game, x + 5 + k * 4.5, z + (k % 2 ? 1 : -1) * 0.7, bi, bj);
  for (let k = 0; k < 5; k += 1) addWalker(game, x - 14 - k * 5, z, bi, bj);
  for (let k = 0; k < 4; k += 1) addWalker(game, blockCenterX(bi + 1) - 26, blockCenterZ(bj) - 10 + k * 6, bi + 1, bj);
  const parade = nodeZ(CITY.rows);
  addTraffic(game, 'kestrel', x - 22, parade - CITY.laneOffset, Math.PI / 2, 11, '#1fb5a3');
  addTraffic(game, 'vireo', x + 8, parade - CITY.laneOffset, Math.PI / 2, 10, null);
  addTraffic(game, 'bodega', x + 62, parade + CITY.laneOffset, -Math.PI / 2, 10, '#f1efe9');
  addTraffic(game, 'marlin', x + 95, parade + CITY.laneOffset, -Math.PI / 2, 11, '#b23a48');
  addTraffic(game, 'surfline', x + 40, parade - CITY.laneOffset, Math.PI / 2, 10, '#edae49');
  game.traffic.populate(game.player.pos);
  game.hud.snap();
  simulate(game, 50, () => hold(game, ['KeyW']));
  const rig = game.cameraRig;
  rig.yaw = Math.PI / 2 - 0.38;
  rig.pitch = 0.14;
  hold(game, ['KeyW']);
  simulate(game, 3);
}

/** Taco Tuesday: a pistol fight with Haldane's enforcers at the Taco Tormenta truck. */
function combatScene(game) {
  startScene(game);
  game.progress.restore({ cash: 5820, tokens: [0, 2], stats: {} });
  const taco = LANDMARK_BLOCKS.tacoStand;
  const truckX = blockCenterX(taco.bi) + 21.4;
  const truckZ = blockCenterZ(taco.bj) - 1;
  game.spawnPlayer(nodeX(taco.bi + 1) - 2, truckZ + 6, -Math.PI / 2);
  startMissionAt(game, 2);
  // Through the opening lines, the pistol and the drive over.
  simulate(game, 3);
  game.player.placeAt(nodeX(taco.bi + 1) - 3, truckZ + 5, -Math.PI / 2 - 0.3);
  simulate(game, 3);
  const enemies = game.missions.active.ctx.enemies;
  const posts = [[truckX + 2.6, truckZ - 5.5], [truckX + 3.4, truckZ + 3.2], [truckX - 2.4, truckZ + 6.5], [truckX + 0.6, truckZ - 9]];
  enemies.forEach((enemy, index) => {
    enemy.pos.set(posts[index][0], 0.15, posts[index][1]);
    enemy.brain.alert = true;
  });
  addTraffic(game, 'marlin', nodeX(taco.bi + 1) + CITY.laneOffset, truckZ - 30, Math.PI, 8, '#8fb8c9');
  game.combat.switchWeapon('pistol');
  game.hud.snap();
  const rig = game.cameraRig;
  const aimAt = (enemy) => {
    const p = game.player.pos;
    rig.yaw = Math.atan2(enemy.pos.x - p.x, enemy.pos.z - p.z) - 0.05;
    rig.pitch = 0.05;
  };
  // Drop the first enforcer, then line up on the next and fire.
  game.input.mouseDown[2] = true;
  simulate(game, 50, (k) => {
    aimAt(enemies[0].dead ? enemies[1] : enemies[0]);
    game.input.mouseDown[0] = k % 18 === 0;
    hold(game, []);
  });
  enemies[0].health = Math.min(enemies[0].health, 1);
  game.combat.cooldown = 0;
  game.input.mouseDown[0] = true;
  simulate(game, 1, () => aimAt(enemies[0]));
  game.input.mouseDown[0] = false;
  simulate(game, 34, () => aimAt(enemies[1]));
  game.combat.cooldown = 0;
  game.input.mouseDown[0] = true;
  simulate(game, 1, () => aimAt(enemies[1]));
}

/** The title screen over a wide aerial view of the city at golden hour. */
function titleScene(game) {
  game.traffic.populate({ x: 0, z: 40 });
  game.peds.populate({ x: 0, z: 40 });
  game.toTitle();
  for (let k = 0; k < 90; k += 1) {
    game.vehicles.update(STEP, game.time);
    game.peds.update(STEP);
    game.time += STEP;
  }
  game.time = 169.5;
  game.titleCamera(0);
}

const SCENES = { chase: chaseScene, street: streetScene, combat: combatScene, title: titleScene };

export function stageShot(game, name) {
  const scene = SCENES[name] ?? SCENES.title;
  scene(game);
  if (name !== 'title') game.state = 'shot';
}
