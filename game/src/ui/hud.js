// The heads-up display: clock, weapon and ammo, cash (counting up), wanted stars (flashing while
// the police search), health and armour bars, the crosshair, the name of the car Nico gets into,
// the district he drives into, the radio station, and the damage flash. Context prompts too.
import { formatCash } from '../core/mathUtils.js';
import { districtAt, DISTRICTS } from '../world/cityLayout.js';
import { WANTED } from '../core/config.js';

const $ = (id) => document.getElementById(id);

export class Hud {
  constructor(game) {
    this.game = game;
    this.root = $('hud');
    this.el = {
      cash: $('cash'),
      stars: $('stars'),
      clock: $('clock'),
      weaponIcon: $('weapon-icon'),
      ammo: $('ammo-text'),
      health: $('health-fill'),
      armor: $('armor-fill'),
      crosshair: $('crosshair'),
      vehicleName: $('vehicle-name'),
      district: $('district-name'),
      radio: $('radio-name'),
      flash: $('damage-flash'),
    };
    this.el.stars.innerHTML = '<span>★</span>'.repeat(WANTED.maxStars);
    this.starNodes = [...this.el.stars.children];
    this.shownCash = 0;
    this.district = null;
    this.timers = { vehicle: 0, district: 0, radio: 0 };
    game.events.on('player:entered', ({ vehicle }) => this.flashName('vehicleName', vehicle.type.name, 'vehicle'));
    game.events.on('player:hurt', () => {
      this.el.flash.classList.add('hit');
      setTimeout(() => this.el.flash.classList.remove('hit'), 60);
    });
    game.events.on('cash:changed', ({ amount }) => {
      if (amount > 0) {
        this.el.cash.classList.remove('bump');
        void this.el.cash.offsetWidth;
        this.el.cash.classList.add('bump');
      }
    });
  }

  show(visible) {
    this.root.classList.toggle('hidden', !visible);
  }

  flashName(key, text, timer, seconds = 3) {
    this.el[key].textContent = text;
    this.el[key].classList.add('show');
    this.timers[timer] = seconds;
  }

  /** Sets the HUD straight to the current state (no count-up), for loads and screenshots. */
  snap() {
    this.shownCash = this.game.progress.cash;
  }

  update(dt) {
    const game = this.game;
    const player = game.player;
    const cash = game.progress.cash;
    if (this.shownCash !== cash) {
      const step = Math.max(1, Math.abs(cash - this.shownCash) * dt * 4);
      this.shownCash = this.shownCash < cash ? Math.min(cash, this.shownCash + step) : Math.max(cash, this.shownCash - step);
    }
    this.el.cash.textContent = formatCash(this.shownCash);

    const stars = game.wanted.stars;
    this.starNodes.forEach((node, index) => node.classList.toggle('on', index < stars));
    this.el.stars.classList.toggle('flash', stars > 0 && !game.wanted.seen);

    const minutes = 17 * 60 + 40 + Math.floor(game.time / 2);
    this.el.clock.textContent = `${String(Math.floor(minutes / 60) % 24).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;

    const weapon = game.combat.current;
    this.el.weaponIcon.className = weapon;
    this.el.ammo.textContent = game.combat.ammoText;
    this.el.health.style.width = `${Math.max(0, player.health)}%`;
    this.el.health.style.background = player.health < 30 ? 'linear-gradient(90deg,#e0303f,#ff7b7b)' : '';
    this.el.armor.style.width = `${Math.max(0, player.armor)}%`;
    this.el.crosshair.classList.toggle('hidden', !(player.aiming && weapon === 'pistol' && !player.vehicle));

    const p = player.focus;
    const district = districtAt(p.x, p.z);
    if (district !== this.district) {
      if (this.district !== null) this.flashName('district', DISTRICTS[district].name, 'district', 3.5);
      this.district = district;
    }
    for (const [timer, key] of [['vehicle', 'vehicleName'], ['district', 'district'], ['radio', 'radio']]) {
      if (this.timers[timer] > 0) {
        this.timers[timer] -= dt;
        if (this.timers[timer] <= 0) this.el[key].classList.remove('show');
      }
    }
  }
}
