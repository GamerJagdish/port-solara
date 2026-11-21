// Nico's progress: cash, play statistics, and the twelve Sun Tokens hidden around the city. Finding
// tokens pays out and unlocks bonuses (armour at five, a bigger ammo pouch at ten).

export const SUN_TOKEN_COUNT = 12;

export class Progress {
  constructor(game) {
    this.game = game;
    this.cash = 0;
    this.tokens = new Set();
    this.stats = { missions: 0, carsStolen: 0, distance: 0, copsEvaded: 0, timePlayed: 0 };
    game.events.on('crime:carjack', () => (this.stats.carsStolen += 1));
    game.events.on('crime:theft', () => (this.stats.carsStolen += 1));
    game.events.on('wanted:evaded', () => {
      this.stats.copsEvaded += 1;
      this.addCash(50 * (game.wanted.stars + 1));
    });
  }

  addCash(amount) {
    this.cash = Math.max(0, this.cash + amount);
    this.game.events.emit('cash:changed', { amount });
  }

  /** Pays for something if Nico can afford it. */
  spend(amount) {
    if (this.cash < amount) return false;
    this.addCash(-amount);
    return true;
  }

  collectToken(id) {
    if (this.tokens.has(id)) return;
    this.tokens.add(id);
    const count = this.tokens.size;
    this.addCash(250);
    this.game.notify.toast(`Sun Token ${count} of ${SUN_TOKEN_COUNT} found · $250`);
    if (count === 5) {
      this.game.player.armor = 100;
      this.game.notify.toast('Five tokens: full body armour delivered.');
    }
    if (count === 10) {
      this.game.combat.givePistol(60);
      this.game.notify.toast('Ten tokens: extra ammo pouch.');
    }
    if (count === SUN_TOKEN_COUNT) this.game.notify.banner('ALL SUN TOKENS', '$5,000 bonus', 4);
    if (count === SUN_TOKEN_COUNT) this.addCash(5000);
  }

  update(dt) {
    this.stats.timePlayed += dt;
    const player = this.game.player;
    this.stats.distance += player.speed * dt;
  }

  serialize() {
    return { cash: this.cash, tokens: [...this.tokens], stats: { ...this.stats } };
  }

  restore(data) {
    this.cash = data?.cash ?? 0;
    this.tokens = new Set(data?.tokens ?? []);
    this.stats = { ...this.stats, ...(data?.stats ?? {}) };
  }
}
