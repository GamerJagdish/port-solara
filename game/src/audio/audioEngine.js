// The WebAudio graph every sound goes through: one context (started on the first click, as browsers
// require), a master gain with a soft compressor, and separate buses for effects and music so the
// pause menu can mute or duck them. Also holds a shared white-noise buffer for synthesized sounds.

export class AudioEngine {
  constructor() {
    this.context = null;
    this.enabled = true;
    this.noise = null;
  }

  /** Creates the context on a user gesture; safe to call repeatedly. */
  unlock() {
    if (this.context) {
      if (this.context.state === 'suspended') this.context.resume();
      return;
    }
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    this.context = ctx;
    this.compressor = ctx.createDynamicsCompressor();
    this.compressor.threshold.value = -14;
    this.compressor.ratio.value = 4;
    this.master = ctx.createGain();
    this.master.gain.value = this.enabled ? 0.8 : 0;
    this.sfx = ctx.createGain();
    this.sfx.gain.value = 0.9;
    this.music = ctx.createGain();
    this.music.gain.value = 0.42;
    this.sfx.connect(this.master);
    this.music.connect(this.master);
    this.master.connect(this.compressor);
    this.compressor.connect(ctx.destination);
    const length = ctx.sampleRate * 2;
    this.noise = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = this.noise.getChannelData(0);
    let seed = 12345;
    for (let i = 0; i < length; i += 1) {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      data[i] = (seed / 0x7fffffff) * 2 - 1;
    }
  }

  get ready() {
    return Boolean(this.context) && this.context.state === 'running';
  }

  get now() {
    return this.context ? this.context.currentTime : 0;
  }

  setEnabled(enabled) {
    this.enabled = enabled;
    if (this.master) this.master.gain.setTargetAtTime(enabled ? 0.8 : 0, this.now, 0.05);
  }

  /** Ducks the music (pause menu, dialogue) without stopping it. */
  setMusicLevel(level) {
    if (this.music) this.music.gain.setTargetAtTime(level, this.now, 0.3);
  }

  noiseSource() {
    const source = this.context.createBufferSource();
    source.buffer = this.noise;
    source.loop = true;
    source.loopStart = Math.random() * 1.5;
    return source;
  }

  /** A gain node with an attack/decay envelope, connected to `destination`. */
  envelope(destination, peak, attack, decay, start = this.now) {
    const gain = this.context.createGain();
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), start + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + attack + decay);
    gain.connect(destination);
    return gain;
  }

  /** A pitched blip: oscillator through an envelope. */
  tone({ type = 'sine', freq = 440, endFreq = null, peak = 0.3, attack = 0.005, decay = 0.2, start = this.now, destination = this.sfx, detune = 0 }) {
    if (!this.context) return;
    const osc = this.context.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, start);
    if (endFreq) osc.frequency.exponentialRampToValueAtTime(endFreq, start + attack + decay);
    osc.detune.value = detune;
    osc.connect(this.envelope(destination, peak, attack, decay, start));
    osc.start(start);
    osc.stop(start + attack + decay + 0.05);
  }

  /** A filtered noise burst. */
  burst({ filter = 'lowpass', freq = 1200, endFreq = null, q = 0.8, peak = 0.4, attack = 0.002, decay = 0.25, start = this.now, destination = this.sfx }) {
    if (!this.context) return;
    const source = this.noiseSource();
    const biquad = this.context.createBiquadFilter();
    biquad.type = filter;
    biquad.frequency.setValueAtTime(freq, start);
    if (endFreq) biquad.frequency.exponentialRampToValueAtTime(endFreq, start + attack + decay);
    biquad.Q.value = q;
    source.connect(biquad);
    biquad.connect(this.envelope(destination, peak, attack, decay, start));
    source.start(start);
    source.stop(start + attack + decay + 0.05);
  }
}
