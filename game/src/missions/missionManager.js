// Runs the story. Mari waits at the Lucky Gull with the next job behind a contact marker; walking
// into it starts the mission, whose steps run one after another. Passing pays cash and saves the
// game; dying, getting arrested, running out of time or losing a key car fails it, and the job
// can be retried from Mari.
import { MISSIONS } from './storyScript.js';
import { STEP_TYPES } from './objectives.js';
import { place } from './missionPlaces.js';
import { MissionMarkers } from './markers.js';
import { CAST } from '../player/playerLook.js';
import { formatCash } from '../core/mathUtils.js';

class IdleBrain {
  constructor(heading) {
    this.heading = heading;
  }
  update(ped) {
    ped.stop();
    ped.heading = this.heading;
  }
}

export class MissionManager {
  constructor(game) {
    this.game = game;
    this.completed = 0;
    this.active = null;
    this.markers = new MissionMarkers(game.scene);
    this.mari = null;
    this.cooldown = 0;
    game.events.on('player:died', () => this.fail('You were flatlined.'));
    game.events.on('player:arrested', () => this.fail('You were cuffed.'));
  }

  get nextMission() {
    return MISSIONS[this.completed] ?? null;
  }

  get finished() {
    return this.completed >= MISSIONS.length;
  }

  /** Keeps Mari standing at her shop door (she is part of the world, not of a mission). */
  ensureMari() {
    const door = place('gullDoor');
    const player = this.game.player.focus;
    const near = Math.hypot(player.x - door.x, player.z - door.z) < 140;
    if (near && (!this.mari || !this.game.peds.list.includes(this.mari))) {
      this.mari = this.game.peds.add({ x: door.x + 1.2, z: door.z + 1.6, heading: -Math.PI / 2, look: CAST.mari.look, role: 'contact', health: 9999, brain: new IdleBrain(-Math.PI / 2), name: CAST.mari.name });
      this.mari.persistent = true;
    } else if (!near && this.mari) {
      this.game.peds.remove(this.mari);
      this.mari = null;
    }
  }

  start(mission) {
    this.active = { mission, index: -1, ctx: { game: this.game, refs: {}, flags: {}, spawned: [], timer: null, mission } };
    this.game.notify.banner(mission.title.toUpperCase(), 'mission', 2.6);
    this.game.events.emit('mission:start', { mission });
    this.advance();
  }

  advance() {
    const active = this.active;
    active.index += 1;
    const step = active.mission.steps[active.index];
    if (!step) {
      this.pass();
      return;
    }
    const type = STEP_TYPES[step.type];
    if (type.start) type.start(active.ctx, step);
  }

  pass() {
    const { mission, ctx } = this.active;
    const game = this.game;
    this.cleanup(ctx, true);
    this.active = null;
    this.completed += 1;
    game.progress.addCash(mission.reward);
    game.progress.stats.missions = this.completed;
    game.notify.banner('MISSION PASSED', formatCash(mission.reward), 4);
    game.events.emit('mission:passed', { mission });
    this.cooldown = 3;
    if (this.finished) {
      setTimeout(() => game.notify.banner('PORT SOLARA IS YOURS', 'Thanks for playing · free roam unlocked', 6), 4200);
    }
    game.saves.autosave();
  }

  fail(reason) {
    if (!this.active) return;
    const { ctx } = this.active;
    this.cleanup(ctx, false);
    this.active = null;
    this.game.notify.banner('MISSION FAILED', reason, 4, true);
    this.game.events.emit('mission:failed', {});
    this.cooldown = 5;
  }

  cleanup(ctx, passed) {
    const game = this.game;
    for (const thing of ctx.spawned) {
      if (thing.mesh && game.peds.list.includes(thing)) {
        thing.persistent = false;
      } else if (game.vehicles.list.includes(thing)) {
        thing.persistent = false;
        if (!passed && thing.driver !== 'player') game.vehicles.remove(thing);
        else if (thing.role === 'mission') thing.role = thing.driver === 'player' ? 'player' : 'abandoned';
      }
    }
    game.wanted.minimum = 0;
    game.notify.objective(null);
    this.markers.showPlace(null);
    this.markers.showTarget(null);
    this.markers.showCrate(null);
  }

  /** What the HUD and minimap should show for the current objective. */
  objectiveView() {
    if (!this.active) {
      if (this.finished || this.cooldown > 0) return null;
      const door = place('gullDoor');
      const mission = this.nextMission;
      return { title: 'Lucky Gull', text: `Mari has a job: "${mission.title}". Meet her at the Lucky Gull.`, point: { x: door.x, z: door.z, radius: 1.6 }, contact: true };
    }
    const { mission, index, ctx } = this.active;
    const step = mission.steps[index];
    if (!step) return null;
    const type = STEP_TYPES[step.type];
    const text = type.text ? type.text(ctx, step) : step.text ?? null;
    return {
      title: mission.title,
      text,
      point: type.point ? type.point(ctx, step) : null,
      target: type.target ? type.target(ctx, step) : null,
      enemies: type.enemies ? type.enemies(ctx, step) : [],
      timer: ctx.timer,
      health: type.health ? type.health(ctx, step) : null,
      crate: step.type === 'goto' && step.place === 'pierCrate' ? place('pierCrate') : null,
    };
  }

  update(dt) {
    const game = this.game;
    this.cooldown = Math.max(0, this.cooldown - dt);
    this.ensureMari();
    if (!this.active) {
      const first = this.nextMission;
      if (first && first.autoStart && this.cooldown <= 0 && !game.player.dead) this.start(first);
      else if (first && this.cooldown <= 0 && !game.player.dead && !game.player.vehicle) {
        const door = place('gullDoor');
        if (Math.hypot(game.player.pos.x - door.x, game.player.pos.z - door.z) < 1.8) this.start(first);
      }
    } else {
      const { mission, index, ctx } = this.active;
      if (ctx.timer !== null) ctx.timer = Math.max(0, ctx.timer - dt);
      const step = mission.steps[index];
      const result = STEP_TYPES[step.type].update(ctx, step, dt);
      if (result === 'done') {
        ctx.timer = step.timeLimit ? null : ctx.timer;
        this.advance();
      } else if (result === 'fail') {
        this.fail(ctx.timer === 0 ? 'Out of time.' : 'The job fell apart.');
      }
    }
    const view = this.objectiveView();
    this.view = view;
    game.notify.objective(view);
    this.markers.showPlace(view && view.point && !view.contact ? view.point : null);
    this.markers.showContact(view && view.contact ? view.point : null);
    this.markers.showTarget(view && view.target ? view.target : null);
    this.markers.showCrate(view && view.crate ? view.crate : null);
    this.markers.update(game.time);
  }

  /** For saving: how far the story has got. */
  serialize() {
    return { completed: this.completed };
  }

  restore(data) {
    if (this.active) this.cleanup(this.active.ctx, false);
    this.active = null;
    this.completed = Math.min(MISSIONS.length, data?.completed ?? 0);
  }
}
