// Every one-shot sound, synthesized on the spot and triggered from game events: gunshots, punches,
// crashes, explosions, horns, pickups, the wanted-level sting, the phone, mission jingles and UI.

export class SoundEffects {
  constructor(game, audio) {
    this.game = game;
    this.audio = audio;
    const on = (name, fn) => game.events.on(name, (payload) => {
      if (this.audio.ready && !game.silent) fn(payload ?? {});
    });
    on('gunshot', ({ x, z }) => this.gunshot(this.distanceGain(x, z)));
    on('weapon:swing', () => this.audio.burst({ filter: 'bandpass', freq: 900, endFreq: 300, peak: 0.12, decay: 0.12 }));
    on('combat:punchHit', () => this.punch());
    on('weapon:reload', () => this.reload());
    on('weapon:empty', () => this.audio.tone({ type: 'square', freq: 1800, peak: 0.05, decay: 0.03 }));
    on('weapon:switch', () => this.audio.burst({ filter: 'highpass', freq: 2500, peak: 0.12, decay: 0.05 }));
    on('vehicle:crash', ({ vehicle, impact }) => this.crash(impact, this.distanceGain(vehicle.pos.x, vehicle.pos.z)));
    on('explosion', ({ x, z }) => this.explosion(this.distanceGain(x, z, 160)));
    on('vehicle:honk', ({ vehicle }) => this.horn(this.distanceGain(vehicle.pos.x, vehicle.pos.z, 60), vehicle.type.shape === 'van'));
    on('pickup', ({ kind }) => this.pickup(kind));
    on('cash:changed', ({ amount }) => amount > 0 && amount < 200 && this.coin());
    on('wanted:changed', () => this.wantedSting());
    on('wanted:evaded', () => this.chime([660, 880, 1320]));
    on('phone:ring', () => this.phone());
    on('mission:start', () => this.chime([392, 523, 659], 0.16));
    on('mission:passed', () => this.fanfare());
    on('mission:failed', () => this.chime([392, 330, 262, 196], 0.22, 'sawtooth'));
    on('player:hurt', () => this.audio.burst({ filter: 'lowpass', freq: 500, peak: 0.25, decay: 0.12 }));
    on('player:died', () => this.chime([220, 185, 147, 110], 0.3, 'triangle'));
    on('player:arrested', () => this.chime([523, 392, 523, 392], 0.18, 'square'));
    on('player:entered', () => this.door());
    on('player:exited', () => this.door());
    on('ui:click', () => this.audio.tone({ type: 'triangle', freq: 880, peak: 0.12, decay: 0.06 }));
  }

  distanceGain(x, z, range = 110) {
    const p = this.game.player.focus;
    const d = Math.hypot(x - p.x, z - p.z);
    return Math.max(0, 1 - d / range);
  }

  gunshot(gain) {
    if (gain <= 0.02) return;
    const a = this.audio;
    a.burst({ filter: 'lowpass', freq: 5000, endFreq: 400, peak: 0.7 * gain, attack: 0.001, decay: 0.22 });
    a.tone({ type: 'triangle', freq: 160, endFreq: 45, peak: 0.6 * gain, attack: 0.001, decay: 0.16 });
    a.burst({ filter: 'bandpass', freq: 1500, q: 0.5, peak: 0.15 * gain, attack: 0.02, decay: 0.6, start: a.now + 0.03 });
  }

  punch() {
    this.audio.tone({ type: 'sine', freq: 140, endFreq: 60, peak: 0.6, decay: 0.12 });
    this.audio.burst({ filter: 'lowpass', freq: 1800, peak: 0.35, decay: 0.08 });
  }

  reload() {
    const a = this.audio;
    a.burst({ filter: 'highpass', freq: 3000, peak: 0.18, decay: 0.04 });
    a.burst({ filter: 'highpass', freq: 2200, peak: 0.22, decay: 0.05, start: a.now + 0.9 });
    a.burst({ filter: 'bandpass', freq: 1400, peak: 0.25, decay: 0.05, start: a.now + 1.1 });
  }

  crash(impact, gain) {
    if (gain <= 0.02) return;
    const level = Math.min(1, impact / 18) * gain;
    this.audio.burst({ filter: 'lowpass', freq: 2600, endFreq: 200, peak: 0.8 * level, decay: 0.35 });
    this.audio.tone({ type: 'square', freq: 90, endFreq: 40, peak: 0.3 * level, decay: 0.2 });
    this.audio.burst({ filter: 'highpass', freq: 4000, peak: 0.25 * level, attack: 0.01, decay: 0.4, start: this.audio.now + 0.02 });
  }

  explosion(gain) {
    if (gain <= 0.02) return;
    this.audio.burst({ filter: 'lowpass', freq: 1400, endFreq: 60, peak: 1 * gain, attack: 0.005, decay: 1.6 });
    this.audio.tone({ type: 'sine', freq: 70, endFreq: 25, peak: 0.9 * gain, attack: 0.005, decay: 1.1 });
    this.game.cameraRig.addShake(0.8 * gain);
  }

  horn(gain, low) {
    if (gain <= 0.02) return;
    const base = low ? 330 : 415;
    this.audio.tone({ type: 'sawtooth', freq: base, peak: 0.12 * gain, attack: 0.01, decay: 0.45 });
    this.audio.tone({ type: 'sawtooth', freq: base * 1.26, peak: 0.1 * gain, attack: 0.01, decay: 0.45 });
  }

  pickup(kind) {
    if (kind === 'token') this.chime([988, 1319, 1976], 0.08, 'triangle');
    else if (kind === 'cash') this.coin();
    else this.chime([660, 990], 0.07, 'triangle');
  }

  coin() {
    this.audio.tone({ type: 'square', freq: 1320, peak: 0.06, decay: 0.07 });
    this.audio.tone({ type: 'square', freq: 1760, peak: 0.06, decay: 0.12, start: this.audio.now + 0.07 });
  }

  door() {
    this.audio.burst({ filter: 'lowpass', freq: 700, peak: 0.3, decay: 0.09 });
    this.audio.tone({ type: 'sine', freq: 120, endFreq: 70, peak: 0.25, decay: 0.08 });
  }

  wantedSting() {
    const a = this.audio;
    a.tone({ type: 'sawtooth', freq: 220, endFreq: 440, peak: 0.12, decay: 0.25 });
    a.tone({ type: 'square', freq: 880, peak: 0.07, decay: 0.12, start: a.now + 0.22 });
  }

  phone() {
    const a = this.audio;
    for (let k = 0; k < 2; k += 1) {
      a.tone({ type: 'sine', freq: 1046, peak: 0.12, attack: 0.01, decay: 0.18, start: a.now + k * 0.3 });
      a.tone({ type: 'sine', freq: 1318, peak: 0.1, attack: 0.01, decay: 0.18, start: a.now + k * 0.3 + 0.08 });
    }
  }

  chime(notes, step = 0.12, type = 'triangle') {
    const a = this.audio;
    notes.forEach((freq, index) => a.tone({ type, freq, peak: 0.16, attack: 0.01, decay: step * 2.2, start: a.now + index * step }));
  }

  fanfare() {
    const a = this.audio;
    const notes = [523, 659, 784, 1047, 784, 1047];
    notes.forEach((freq, index) => {
      a.tone({ type: 'square', freq, peak: 0.08, attack: 0.01, decay: 0.3, start: a.now + index * 0.13 });
      a.tone({ type: 'triangle', freq: freq / 2, peak: 0.12, attack: 0.01, decay: 0.3, start: a.now + index * 0.13 });
    });
  }
}
