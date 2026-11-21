// The music: a little step sequencer playing original loops through WebAudio. Two in-car stations,
// "Solara 104.7 Sunset Waves" (warm synthwave) and "Radio Marea 92.1" (a bouncy tropical groove),
// plus a slow theme for the title screen. M changes station in a car.

const NOTE = (n) => 440 * Math.pow(2, (n - 69) / 12);

export const STATIONS = [
  {
    name: 'SOLARA 104.7 · SUNSET WAVES',
    bpm: 100,
    // Am - F - C - G, bass roots and chord tones in MIDI numbers.
    chords: [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]],
    bass: [45, 41, 36, 43],
    kick: [0, 4, 8, 12],
    snare: [4, 12],
    hats: [2, 6, 10, 14],
    arp: [0, 1, 2, 1, 0, 2, 1, 2],
    lead: 'square',
  },
  {
    name: 'RADIO MAREA 92.1 · TROPICAL',
    bpm: 96,
    // Dm - Bb - F - C.
    chords: [[62, 65, 69], [58, 62, 65], [53, 57, 60], [60, 64, 67]],
    bass: [38, 34, 41, 36],
    kick: [0, 4, 8, 12],
    snare: [3, 6, 11, 14],
    hats: [0, 2, 4, 6, 8, 10, 12, 14],
    arp: [2, 1, 0, 1, 2, 2, 1, 0],
    lead: 'triangle',
  },
  {
    name: 'TITLE',
    bpm: 84,
    chords: [[57, 64, 67, 72], [53, 60, 64, 69], [55, 62, 67, 71], [52, 59, 64, 67]],
    bass: [45, 41, 43, 40],
    kick: [0, 8],
    snare: [12],
    hats: [4, 12],
    arp: [0, 2, 3, 2, 1, 2, 3, 1],
    lead: 'triangle',
  },
];

export class Radio {
  constructor(audio) {
    this.audio = audio;
    this.station = -1;
    this.step = 0;
    this.nextTime = 0;
    this.timer = null;
  }

  play(index) {
    if (!this.audio.context) return;
    if (index === this.station && this.timer) return;
    this.station = index;
    this.step = 0;
    this.nextTime = this.audio.now + 0.1;
    if (!this.timer) this.timer = setInterval(() => this.schedule(), 40);
  }

  stop() {
    this.station = -1;
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  get current() {
    return STATIONS[this.station] ?? null;
  }

  schedule() {
    const station = this.current;
    if (!station || !this.audio.context) return;
    const sixteenth = 60 / station.bpm / 4;
    while (this.nextTime < this.audio.now + 0.15) {
      this.playStep(station, this.step, this.nextTime, sixteenth);
      this.step = (this.step + 1) % 64;
      this.nextTime += sixteenth;
    }
  }

  playStep(s, step, time, sixteenth) {
    const a = this.audio;
    const out = a.music;
    const bar = Math.floor(step / 16) % s.chords.length;
    const beat = step % 16;
    const chord = s.chords[bar];
    if (s.kick.includes(beat)) a.tone({ type: 'sine', freq: 120, endFreq: 42, peak: 0.55, attack: 0.002, decay: 0.18, start: time, destination: out });
    if (s.snare.includes(beat)) a.burst({ filter: 'bandpass', freq: 1800, q: 0.7, peak: 0.22, decay: 0.14, start: time, destination: out });
    if (s.hats.includes(beat)) a.burst({ filter: 'highpass', freq: 7000, peak: 0.07, decay: 0.04, start: time, destination: out });
    if (beat % 4 === 0 || (beat % 4 === 3 && s.bpm < 100)) {
      a.tone({ type: 'sawtooth', freq: NOTE(s.bass[bar]), peak: 0.16, attack: 0.01, decay: sixteenth * 2.5, start: time, destination: out });
    }
    if (beat === 0) {
      for (const n of chord) {
        a.tone({ type: 'sawtooth', freq: NOTE(n), peak: 0.035, attack: 0.25, decay: sixteenth * 15, start: time, destination: out, detune: -8 });
        a.tone({ type: 'sawtooth', freq: NOTE(n), peak: 0.035, attack: 0.25, decay: sixteenth * 15, start: time, destination: out, detune: 8 });
      }
    }
    if (beat % 2 === 0) {
      const note = chord[s.arp[(beat / 2) % s.arp.length] % chord.length] + 12;
      a.tone({ type: s.lead, freq: NOTE(note), peak: 0.045, attack: 0.005, decay: sixteenth * 1.6, start: time, destination: out });
    }
  }
}
