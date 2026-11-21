// Saving and loading through localStorage: story progress, cash, tokens, stats, weapons and ammo,
// health and armour, and where Nico stands. Saves are versioned and every access is guarded, so a
// private window or blocked storage just means no saves.
import { place } from '../missions/missionPlaces.js';

const KEY = 'port-solara.save.v1';

export class SaveGames {
  constructor(game) {
    this.game = game;
    this.enabled = true;
  }

  hasSave() {
    return Boolean(this.read());
  }

  read() {
    if (!this.enabled) return null;
    try {
      const raw = window.localStorage.getItem(KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  snapshot() {
    const game = this.game;
    const p = game.player.focus;
    return {
      version: 1,
      savedAt: new Date().toISOString(),
      progress: game.progress.serialize(),
      missions: game.missions.serialize(),
      combat: { hasPistol: game.combat.hasPistol, clip: game.combat.clip, reserve: game.combat.reserve },
      player: { x: p.x, z: p.z, heading: game.player.heading, health: game.player.health, armor: game.player.armor },
    };
  }

  save() {
    if (!this.enabled) return false;
    try {
      window.localStorage.setItem(KEY, JSON.stringify(this.snapshot()));
      return true;
    } catch {
      return false;
    }
  }

  /** Saves quietly after a mission is passed. */
  autosave() {
    if (this.save()) this.game.notify.toast('Progress saved.');
  }

  load() {
    const data = this.read();
    if (!data || data.version !== 1) return false;
    const game = this.game;
    game.resetWorld();
    game.progress.restore(data.progress);
    game.missions.restore(data.missions);
    game.combat.hasPistol = Boolean(data.combat?.hasPistol);
    game.combat.clip = data.combat?.clip ?? 0;
    game.combat.reserve = data.combat?.reserve ?? 0;
    game.combat.current = 'fists';
    const spot = data.player ?? place('gullDoor');
    game.spawnPlayer(spot.x, spot.z, spot.heading ?? 0);
    game.player.health = Math.max(30, data.player?.health ?? 100);
    game.player.armor = data.player?.armor ?? 0;
    game.pickups.populate();
    game.hud.snap();
    return true;
  }
}
