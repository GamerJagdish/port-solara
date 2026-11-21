// Continuous sounds tied to cars: the engine note of the car Nico drives (pitch follows speed and
// gear, growl follows the throttle), tyre squeal while sliding, and the wail of the nearest police
// siren, louder as cruisers close in.

export class VehicleAudio {
  constructor(game, audio) {
    this.game = game;
    this.audio = audio;
    this.built = false;
  }

  build() {
    const a = this.audio;
    const ctx = a.context;
    this.engineGain = ctx.createGain();
    this.engineGain.gain.value = 0;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 900;
    this.engineFilter = filter;
    this.engineA = ctx.createOscillator();
    this.engineA.type = 'sawtooth';
    this.engineB = ctx.createOscillator();
    this.engineB.type = 'square';
    this.engineA.connect(filter);
    this.engineB.connect(filter);
    filter.connect(this.engineGain);
    this.engineGain.connect(a.sfx);
    this.engineA.start();
    this.engineB.start();

    this.squealGain = ctx.createGain();
    this.squealGain.gain.value = 0;
    const squeal = a.noiseSource();
    const band = ctx.createBiquadFilter();
    band.type = 'bandpass';
    band.frequency.value = 2400;
    band.Q.value = 6;
    squeal.connect(band);
    band.connect(this.squealGain);
    this.squealGain.connect(a.sfx);
    squeal.start();

    this.sirenGain = ctx.createGain();
    this.sirenGain.gain.value = 0;
    this.siren = ctx.createOscillator();
    this.siren.type = 'triangle';
    this.siren.frequency.value = 700;
    const lfo = ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = 0.55;
    const depth = ctx.createGain();
    depth.gain.value = 260;
    lfo.connect(depth);
    depth.connect(this.siren.frequency);
    this.siren.connect(this.sirenGain);
    this.sirenGain.connect(a.sfx);
    this.siren.start();
    lfo.start();
    this.built = true;
  }

  update() {
    if (!this.audio.ready) return;
    if (!this.built) this.build();
    const game = this.game;
    const now = this.audio.now;
    const vehicle = game.player.vehicle;
    const paused = game.state !== 'playing';
    if (vehicle && !paused) {
      const speed = Math.abs(vehicle.forwardSpeed);
      const gearSpan = vehicle.type.maxSpeed / 5;
      const gear = Math.min(4, Math.floor(speed / gearSpan));
      const rpm = 0.25 + ((speed - gear * gearSpan) / gearSpan) * 0.75;
      const base = vehicle.type.shape === 'van' ? 38 : vehicle.type.shape === 'sports' ? 58 : 46;
      const freq = base + rpm * base * 1.6 + gear * 4;
      this.engineA.frequency.setTargetAtTime(freq, now, 0.05);
      this.engineB.frequency.setTargetAtTime(freq * 0.5, now, 0.05);
      this.engineFilter.frequency.setTargetAtTime(500 + vehicle.controls.throttle * 1400 + rpm * 400, now, 0.08);
      this.engineGain.gain.setTargetAtTime(vehicle.destroyed ? 0 : 0.07 + vehicle.controls.throttle * 0.07, now, 0.1);
      this.squealGain.gain.setTargetAtTime(vehicle.skidding ? Math.min(0.12, Math.abs(vehicle.lateralSpeed) * 0.015 + 0.03) : 0, now, 0.05);
    } else {
      this.engineGain.gain.setTargetAtTime(0, now, 0.1);
      this.squealGain.gain.setTargetAtTime(0, now, 0.05);
    }
    let nearest = Infinity;
    const p = game.player.focus;
    for (const unit of game.police.units) {
      if (!unit.vehicle.sirenOn) continue;
      nearest = Math.min(nearest, Math.hypot(unit.vehicle.pos.x - p.x, unit.vehicle.pos.z - p.z));
    }
    const sirenLevel = paused || nearest === Infinity ? 0 : Math.max(0, 1 - nearest / 160) * 0.09;
    this.sirenGain.gain.setTargetAtTime(sirenLevel, now, 0.2);
  }
}
