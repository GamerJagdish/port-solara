// Builds the whole of Port Solara from a seed: the plan, then terrain, roads, buildings, props and
// landmarks into one scene group, with every solid thing registered in the collision world.
import * as THREE from 'three';
import { generateCityPlan } from './cityLayout.js';
import { CollisionWorld } from './collisionWorld.js';
import { buildTerrain } from './terrainBuilder.js';
import { buildRoads } from './roadBuilder.js';
import { buildBuildings } from './buildingBuilder.js';
import { buildProps, parkedCarSlots } from './propBuilder.js';
import { buildSunwheel, buildCranes, addShoreWalls } from './landmarkBuilder.js';

export function buildCity(seed) {
  const plan = generateCityPlan(seed);
  const collision = new CollisionWorld();
  const group = new THREE.Group();
  group.name = 'port-solara';
  group.add(buildTerrain());
  group.add(buildRoads(plan));
  group.add(buildBuildings(plan, collision));
  group.add(buildProps(plan, collision));
  group.add(buildCranes(collision));
  addShoreWalls(collision);
  // The city never moves: freeze its matrices, then add the turning Sunwheel.
  group.updateMatrixWorld(true);
  group.traverse((child) => {
    child.matrixAutoUpdate = false;
  });
  group.matrixAutoUpdate = true;
  const sunwheel = buildSunwheel();
  group.add(sunwheel.group);
  return {
    plan,
    collision,
    group,
    parkedSlots: parkedCarSlots(plan),
    update(time) {
      sunwheel.update(time);
    },
  };
}
