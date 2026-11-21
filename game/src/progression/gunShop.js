// Brass & Barrel on Sunset Strip: stand at the counter and press E to buy. The first visit sells the
// pistol itself; after that, ammo and armour.
import { place } from '../missions/missionPlaces.js';

const OFFERS = [
  { id: 'pistol', label: 'Pistol + 24 rounds', price: 400, available: (g) => !g.combat.hasPistol, buy: (g) => g.combat.givePistol(24) },
  { id: 'ammo', label: '24 pistol rounds', price: 120, available: (g) => g.combat.hasPistol, buy: (g) => g.combat.givePistol(24) },
  { id: 'armor', label: 'Body armour', price: 250, available: (g) => g.player.armor < 100, buy: (g) => (g.player.armor = 100) },
];

export class GunShop {
  constructor(game) {
    this.game = game;
    this.door = place('gunShopDoor');
    this.offerIndex = 0;
  }

  /** The offer shown at the counter right now, or null when Nico is not there. */
  currentOffer() {
    const game = this.game;
    const player = game.player;
    if (player.vehicle || player.dead) return null;
    if (Math.hypot(player.pos.x - this.door.x, player.pos.z - this.door.z) > 3.2) return null;
    const offers = OFFERS.filter((o) => o.available(game));
    if (offers.length === 0) return null;
    return offers[this.offerIndex % offers.length];
  }

  update(input) {
    const offer = this.currentOffer();
    if (!offer) return null;
    if (input.wasPressed('KeyE')) {
      if (this.game.progress.spend(offer.price)) {
        offer.buy(this.game);
        this.game.notify.toast(`Bought: ${offer.label}`);
        this.game.events.emit('pickup', { kind: 'purchase' });
      } else {
        this.game.notify.toast('Not enough cash.');
      }
      this.offerIndex += 1;
    }
    return offer;
  }
}
