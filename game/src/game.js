// The game itself: creates the renderer, scene and every system, runs the fixed-step simulation and
// the render loop, and moves between the title screen, play, pause, death and arrest. Systems reach
// each other through this object and talk through its event bus.
import * as THREE from 'three';
import { STEP, CAMERA } from './core/config.js';
import { Dice } from './core/random.js';
import { EventBus } from './core/events.js';
import { Input } from './core/input.js';
import { buildCity } from './world/cityBuilder.js';
import { createSky, Lighting } from './world/skyAndLight.js';
import { VehicleManager } from './vehicles/vehicleManager.js';
import { TrafficManager } from './traffic/trafficManager.js';
import { PedestrianManager } from './peds/pedestrianManager.js';
import { Player } from './player/player.js';
import { CameraRig } from './player/cameraRig.js';
import { CombatSystem } from './combat/combatSystem.js';
import { WantedLevel } from './police/wantedLevel.js';
import { PoliceManager } from './police/policeManager.js';
import { MissionManager } from './missions/missionManager.js';
import { Particles } from './fx/particles.js';
import { SkidMarks } from './fx/skidMarks.js';
import { Tracers } from './fx/tracers.js';
import { Headlights } from './fx/headlights.js';
import { AudioEngine } from './audio/audioEngine.js';
import { SoundEffects } from './audio/soundEffects.js';
import { VehicleAudio } from './audio/vehicleAudio.js';
import { Radio, STATIONS } from './audio/radio.js';
import { Hud } from './ui/hud.js';
import { Minimap } from './ui/minimap.js';
import { Notifications } from './ui/notifications.js';
import { Menus } from './ui/menus.js';
import { SaveGames } from './save/saveGame.js';
import { Progress } from './progression/progress.js';
import { Pickups } from './progression/pickups.js';
import { GunShop } from './progression/gunShop.js';
import { place } from './missions/missionPlaces.js';

export class Game {
  constructor(canvas, { seed = 7, shot = null } = {}) {
    this.canvas = canvas;
    this.seed = seed;
    this.shot = shot;
    this.silent = Boolean(shot);
    this.state = 'loading';
    this.time = 0;
    this.accumulator = 0;
    this.dice = new Dice(seed);
    this.events = new EventBus();

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: Boolean(shot), powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(shot ? 1 : Math.min(window.devicePixelRatio, 1.75));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xf2cfa8);
    this.camera = new THREE.PerspectiveCamera(CAMERA.fov, 16 / 9, 0.3, 2400);
    this.scene.add(createSky());
    this.lighting = new Lighting(this.scene);

    this.city = buildCity(seed);
    this.scene.add(this.city.group);

    this.input = new Input(canvas);
    this.fx = new Particles(this.scene, this.dice.next);
    this.skids = new SkidMarks(this.scene);
    this.tracers = new Tracers(this.scene);
    this.headlights = new Headlights(this.scene);
    this.vehicles = new VehicleManager(this);
    this.traffic = new TrafficManager(this);
    this.peds = new PedestrianManager(this);
    this.player = new Player(this);
    this.cameraRig = new CameraRig(this, this.camera);
    this.combat = new CombatSystem(this);
    this.progress = new Progress(this);
    this.wanted = new WantedLevel(this);
    this.police = new PoliceManager(this);
    this.notify = new Notifications(this);
    this.missions = new MissionManager(this);
    this.pickups = new Pickups(this);
    this.gunShop = new GunShop(this);
    this.saves = new SaveGames(this);
    this.saves.enabled = !shot;
    this.audio = new AudioEngine();
    this.sounds = new SoundEffects(this, this.audio);
    this.vehicleAudio = new VehicleAudio(this, this.audio);
    this.radio = new Radio(this.audio);
    this.stationIndex = 0;
    this.hud = new Hud(this);
    this.minimap = new Minimap(this, document.getElementById('minimap'));
    this.menus = new Menus(this);
    this.respawnTimer = 0;

    this.events.on('player:died', () => this.onWasted('FLATLINED', 'St. Brigid Medical patched you up · $100', 'hospital', 100));
    this.events.on('player:arrested', () => this.onWasted('CUFFED', 'Released from Harbor Precinct · $250 and your ammo', 'policeStation', 250));
    this.events.on('player:entered', () => this.onEnteredVehicle());
    this.events.on('player:exited', () => this.radio.current && this.radio.current.name !== 'TITLE' && this.radio.stop());
    this.events.on('wanted:changed', ({ stars }) => this.cameraRig.addShake(0.1 * stars));
    document.addEventListener('pointerlockchange', () => {
      if (!document.pointerLockElement && this.state === 'playing' && !this.releasingLock) this.pause();
      this.releasingLock = false;
    });
    canvas.addEventListener('click', () => {
      this.audio.unlock();
      if (this.state === 'playing') this.input.requestLock();
    });
    window.addEventListener('resize', () => this.resize());
    this.resize();
  }

  resize() {
    const width = this.shot ? 1280 : window.innerWidth;
    const height = this.shot ? 720 : window.innerHeight;
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  /** Clears every car, person, cop and message: a clean slate for a new or loaded game. */
  resetWorld() {
    this.missions.restore({ completed: 0 });
    for (const vehicle of this.vehicles.list.slice()) this.vehicles.remove(vehicle);
    for (const ped of this.peds.list.slice()) this.peds.remove(ped);
    for (const slot of this.city.parkedSlots) {
      slot.vehicle = null;
      slot.taken = false;
    }
    this.police.clearAll();
    this.wanted.clear();
    this.notify.clear();
    this.player.dead = false;
    this.player.arrested = false;
    this.player.vehicle = null;
    this.player.entering = null;
    this.player.health = 100;
    this.player.armor = 0;
    this.player.fallen = 0;
    this.player.mesh.visible = true;
    this.combat.current = 'fists';
    this.combat.hasPistol = false;
    this.combat.clip = 0;
    this.combat.reserve = 0;
    this.missions.mari = null;
  }

  /** Puts Nico at a spot and fills the streets around him. */
  spawnPlayer(x, z, heading) {
    this.player.placeAt(x, z, heading);
    this.cameraRig.snapBehind(heading);
    this.cameraRig.pitch = 0.18;
    this.cameraRig.update(0, this.input);
    this.lighting.follow(this.player.pos);
    this.traffic.populate(this.player.pos);
    this.peds.populate(this.player.pos);
    this.vehicles.manageParked(this.player.pos);
  }

  newGame() {
    this.resetWorld();
    this.progress.restore(null);
    const start = place('pierStart');
    this.spawnPlayer(start.x, start.z, start.heading);
    this.pickups.populate();
    this.hud.snap();
    this.resume();
  }

  resume() {
    this.state = 'playing';
    this.menus.hideAll();
    this.hud.show(true);
    this.audio.setMusicLevel(0.42);
    if (this.radio.current?.name === 'TITLE') this.radio.stop();
    if (this.player.vehicle) this.radio.play(this.stationIndex);
    this.input.requestLock();
  }

  pause() {
    if (this.state !== 'playing') return;
    this.state = 'paused';
    this.releasingLock = true;
    this.input.releaseLock();
    this.menus.showPause();
    this.audio.setMusicLevel(0.15);
  }

  toTitle() {
    this.state = 'title';
    this.hud.show(false);
    this.menus.showTitle();
    this.player.mesh.visible = false;
    if (this.player.vehicle) this.player.exitVehicle(true);
    this.player.placeAt(0, 40, 0);
    this.player.mesh.visible = false;
    if (this.traffic.cars.length === 0) {
      this.traffic.populate({ x: 0, z: 40 });
      this.peds.populate({ x: 0, z: 40 });
    }
    this.notify.clear();
    this.notify.objective(null);
    this.audio.setMusicLevel(0.42);
    if (this.audio.context) this.radio.play(2);
  }

  onEnteredVehicle() {
    this.cameraRig.carYawOffset = 0;
    if (this.state === 'playing') {
      this.radio.play(this.stationIndex);
      this.hud.flashName('radio', STATIONS[this.stationIndex].name, 'radio', 3);
    }
  }

  onWasted(title, subtitle, where, fee) {
    this.notify.banner(title, subtitle, 4, true);
    this.respawnTimer = 4;
    this.respawnPlan = { where, fee, arrested: title === 'CUFFED' };
    if (this.respawnPlan.arrested) {
      this.player.arrested = true;
      if (this.player.vehicle) this.player.exitVehicle(true);
    }
  }

  respawn() {
    const { where, fee, arrested } = this.respawnPlan;
    const spot = place(where);
    this.progress.addCash(-fee);
    if (arrested) {
      this.combat.reserve = 0;
      this.combat.clip = 0;
    }
    this.police.clearAll();
    this.wanted.clear();
    for (const vehicle of this.vehicles.list.slice()) if (vehicle.role !== 'parked') this.vehicles.remove(vehicle);
    for (const ped of this.peds.list.slice()) if (ped.role !== 'contact') this.peds.remove(ped);
    this.player.dead = false;
    this.player.arrested = false;
    this.player.health = 100;
    this.player.fallen = 0;
    this.player.invulnerable = 3;
    this.spawnPlayer(spot.x, spot.z, spot.heading ?? 0);
  }

  /** One fixed simulation step of everything in the world. */
  step(dt) {
    this.time += dt;
    const input = this.input;
    if (input.wasPressed('Escape') || input.wasPressed('KeyP')) {
      this.pause();
      return;
    }
    if (input.wasPressed('KeyZ')) this.minimap.zoom = this.minimap.zoom === 1 ? 2 : 1;
    if (input.wasPressed('KeyM') && this.player.vehicle) {
      this.stationIndex = (this.stationIndex + 1) % 2;
      this.radio.play(this.stationIndex);
      this.hud.flashName('radio', STATIONS[this.stationIndex].name, 'radio', 3);
    }
    if (input.wasPressed('Enter')) this.notify.skipLine();
    this.player.update(dt, input, this.cameraRig.yaw);
    this.combat.update(dt, input);
    const offer = this.gunShop.update(input);
    this.vehicles.manageParked(this.player.focus);
    this.traffic.update(dt);
    this.vehicles.update(dt, this.time);
    this.peds.update(dt);
    this.police.update(dt);
    this.wanted.update(dt);
    this.missions.update(dt);
    this.pickups.update(dt);
    this.progress.update(dt);
    this.skids.update(this.vehicles.list, this.fx);
    this.fx.update(dt);
    this.tracers.update(dt);
    this.notify.update(dt);
    this.city.update(this.time);
    this.updatePrompt(offer);
    if (this.respawnTimer > 0) {
      this.respawnTimer -= dt;
      if (this.respawnTimer <= 0) this.respawn();
    }
    // Cars Nico has left behind are tidied away once far off.
    for (const vehicle of this.vehicles.list.slice()) {
      if ((vehicle.role === 'abandoned' || vehicle.destroyed) && !vehicle.persistent && vehicle.driver !== 'player') {
        const d = Math.hypot(vehicle.pos.x - this.player.focus.x, vehicle.pos.z - this.player.focus.z);
        if (d > 230) this.vehicles.remove(vehicle);
      }
    }
    input.endStep();
  }

  updatePrompt(offer) {
    const player = this.player;
    let html = null;
    if (offer) html = `<kbd>E</kbd> Buy ${offer.label} · $${offer.price}`;
    else if (!player.vehicle && !player.dead && !player.entering) {
      const vehicle = player.nearestEnterable();
      if (vehicle) html = `<kbd>F</kbd> ${vehicle.driver && vehicle.driver !== 'player' ? 'Steal' : 'Get in'} the ${vehicle.type.name}`;
    } else if (player.vehicle && this.police.boxedTimer > 0.4) {
      html = 'Boxed in! <kbd>W</kbd> <kbd>S</kbd> Break free before they pull you out';
    }
    this.notify.prompt(html);
  }

  /** Title screen: a slow aerial orbit over the city with the world running beneath. */
  titleCamera(dt) {
    this.time += dt;
    const t = this.time * 0.035 + 2.2;
    this.camera.position.set(Math.cos(t) * 360 - 20, 88, Math.sin(t) * 300 + 60);
    this.camera.lookAt(-10, 12, 40);
    this.camera.fov = 55;
    this.camera.updateProjectionMatrix();
    this.cameraRig.updateLookDirection();
    this.city.update(this.time);
    this.lighting.follow({ x: this.camera.position.x * 0.3, z: this.camera.position.z * 0.3 });
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }

  /** Advances the fixed-step simulation by real elapsed time, then updates the view. */
  frame(elapsed) {
    const dt = Math.min(0.1, elapsed);
    if (this.state === 'playing') {
      this.accumulator += dt;
      let steps = 0;
      while (this.accumulator >= STEP && steps < 6) {
        this.step(STEP);
        this.accumulator -= STEP;
        steps += 1;
      }
      this.afterSteps(dt);
    } else if (this.state === 'title') {
      this.titleCamera(dt);
      this.traffic.update(dt);
      this.vehicles.update(dt, this.time);
      this.peds.update(dt);
      this.fx.update(dt);
    } else if (this.state === 'paused') {
      this.input.endStep();
    }
    this.render();
  }

  /** Per-frame work after simulation steps: camera, light, headlights, HUD, radar and audio. */
  afterSteps(dt) {
    this.cameraRig.update(dt, this.input);
    this.lighting.follow(this.player.focus);
    this.headlights.update(this.player.vehicle);
    this.hud.update(dt);
    this.minimap.draw(dt);
    this.vehicleAudio.update();
  }

  start() {
    let last = performance.now();
    this.renderer.setAnimationLoop((now) => {
      const elapsed = (now - last) / 1000;
      last = now;
      this.frame(elapsed);
    });
  }
}
