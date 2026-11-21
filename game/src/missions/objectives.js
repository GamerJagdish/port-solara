// Every kind of mission step: talk, get in a car, go somewhere (on foot, by car, against the clock),
// pick something up, fight, wreck a car, raise or lose the wanted level. Each step type starts,
// updates (returning 'done' or 'fail'), and says what the HUD, minimap and world markers should show.
import { place } from './missionPlaces.js';
import { RoadDriver } from '../traffic/roadDriver.js';
import { EnforcerBrain } from './enforcerBrain.js';
import { CAST } from '../player/playerLook.js';
import { segmentAt } from '../world/roadGraph.js';

const near = (a, b, radius) => Math.hypot(a.x - b.x, a.z - b.z) <= radius;

export const STEP_TYPES = {
  dialogue: {
    start(ctx, step) {
      ctx.game.notify.dialogue(step.lines);
    },
    update(ctx) {
      return ctx.game.notify.dialogueActive ? null : 'done';
    },
  },

  phone: {
    start(ctx, step) {
      ctx.game.notify.dialogue(step.lines, { phone: true });
      ctx.game.events.emit('phone:ring', {});
    },
    update: () => 'done',
  },

  enterVehicle: {
    update(ctx, step) {
      const vehicle = ctx.game.player.vehicle;
      if (step.ref) {
        const wanted = ctx.refs[step.ref];
        if (!wanted || wanted.destroyed) return 'fail';
        return vehicle === wanted ? 'done' : null;
      }
      return vehicle ? 'done' : null;
    },
    text: (ctx, step) => step.text,
    target: (ctx, step) => (step.ref && ctx.refs[step.ref] ? ctx.refs[step.ref].pos : null),
  },

  goto: {
    start(ctx, step) {
      if (step.timeLimit) ctx.timer = step.timeLimit;
    },
    update(ctx, step) {
      const game = ctx.game;
      const spot = place(step.place);
      const player = game.player;
      if (step.ref) {
        const vehicle = ctx.refs[step.ref];
        if (!vehicle || vehicle.destroyed) return 'fail';
        if (player.vehicle !== vehicle) return null;
      }
      if (step.inVehicle && !player.vehicle) return null;
      if (step.onFoot && player.vehicle) return null;
      if (ctx.timer !== null && ctx.timer <= 0) return 'fail';
      const radius = step.radius ?? spot.radius;
      if (near(player.focus, spot, radius + (player.vehicle ? 2 : 0))) {
        if (player.vehicle && step.inVehicle && player.vehicle.speed > 6) return null;
        return 'done';
      }
      return null;
    },
    text(ctx, step) {
      const player = ctx.game.player;
      if (step.ref && player.vehicle !== ctx.refs[step.ref]) return 'Get back in the courier van.';
      if (step.inVehicle && !player.vehicle) return 'Get a car.';
      return step.text;
    },
    point(ctx, step) {
      const player = ctx.game.player;
      if (step.ref && player.vehicle !== ctx.refs[step.ref]) return null;
      const spot = place(step.place);
      return { x: spot.x, z: spot.z, radius: step.radius ?? spot.radius };
    },
    target: (ctx, step) => (step.ref && ctx.game.player.vehicle !== ctx.refs[step.ref] ? ctx.refs[step.ref]?.pos : null),
  },

  pickup: {
    start(ctx, step) {
      ctx.flags[step.item] = true;
      ctx.game.notify.toast(step.text);
      ctx.game.events.emit('pickup', { kind: 'item' });
    },
    update: () => 'done',
  },

  givePistol: {
    start(ctx, step) {
      ctx.game.combat.givePistol(step.ammo);
      ctx.game.notify.toast(`Pistol +${step.ammo} rounds. Q or 2 to draw, right mouse to aim.`);
      ctx.game.events.emit('pickup', { kind: 'weapon' });
    },
    update: () => 'done',
  },

  eliminate: {
    start(ctx, step) {
      const game = ctx.game;
      const spot = place(step.place);
      ctx.enemies = [];
      for (let k = 0; k < step.count; k += 1) {
        const angle = (k / step.count) * Math.PI * 2 + 0.4;
        const x = spot.x + Math.cos(angle) * 3.5;
        const z = spot.z + Math.sin(angle) * 4.5;
        const look = { ...CAST.enforcer.look, skin: game.dice.pick(['#b77a52', '#f1c7a5', '#8d5a3b', '#d9a07a']), hairStyle: game.dice.chance(0.5) ? 'bald' : 'short' };
        const ped = game.peds.add({ x, z, heading: Math.atan2(spot.x - x, spot.z - z), look, role: 'enforcer', health: 60, brain: new EnforcerBrain(game, { x, z, heading: Math.atan2(spot.x - x, spot.z - z) }), name: CAST.enforcer.name });
        ped.persistent = true;
        ped.armed = true;
        ctx.enemies.push(ped);
      }
      ctx.spawned.push(...ctx.enemies);
    },
    update(ctx) {
      return ctx.enemies.every((e) => e.dead) ? 'done' : null;
    },
    text(ctx, step) {
      const down = ctx.enemies.filter((e) => e.dead).length;
      return `${step.text}: ${down}/${ctx.enemies.length}`;
    },
    enemies: (ctx) => ctx.enemies.filter((e) => !e.dead),
  },

  spawnVehicle: {
    start(ctx, step) {
      const game = ctx.game;
      const spot = place(step.place);
      const vehicle = game.vehicles.spawn(step.vehicle, { x: spot.x, z: spot.z, heading: spot.heading ?? 0, paint: step.paint ?? null, role: 'mission' });
      vehicle.persistent = true;
      if (step.health) vehicle.health = step.health;
      if (step.driver === 'npc') {
        vehicle.driver = 'npc';
        vehicle.ai = new RoadDriver(game, vehicle, { cruise: step.panic ? 19 : 11 });
        const f = vehicle.forward();
        const { a, b } = segmentAt(vehicle.pos.x, vehicle.pos.z, f.x, f.z);
        vehicle.ai.startOn(a, b);
        if (step.panic) vehicle.ai.panic = 9999;
      }
      ctx.refs[step.ref] = vehicle;
      ctx.spawned.push(vehicle);
    },
    update: () => 'done',
  },

  destroyVehicle: {
    update(ctx, step) {
      const vehicle = ctx.refs[step.ref];
      return vehicle && vehicle.destroyed ? 'done' : null;
    },
    text: (ctx, step) => step.text,
    target: (ctx, step) => ctx.refs[step.ref]?.pos ?? null,
    health(ctx, step) {
      const vehicle = ctx.refs[step.ref];
      return vehicle ? Math.max(0, vehicle.health / (step.maxHealth ?? 220)) : 0;
    },
  },

  forceWanted: {
    start(ctx, step) {
      ctx.game.wanted.force(step.stars);
    },
    update: () => 'done',
  },

  loseWanted: {
    update(ctx) {
      return ctx.game.wanted.stars === 0 ? 'done' : null;
    },
    text(ctx, step) {
      return ctx.game.wanted.stars === 0 ? null : step.text;
    },
  },
};
