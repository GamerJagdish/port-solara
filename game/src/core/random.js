// Seeded randomness: the whole simulation draws from these so a seed always rebuilds the same city
// and the same screenshot scene.

/** A mulberry32 generator: returns a function giving floats in [0, 1). */
export function createRandom(seed) {
  let state = seed >>> 0;
  const next = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return next;
}

/** Helpers over a generator so callers read as intent, not arithmetic. */
export class Dice {
  constructor(seed) {
    this.next = createRandom(seed);
  }
  float(min = 0, max = 1) {
    return min + (max - min) * this.next();
  }
  int(min, max) {
    return Math.floor(this.float(min, max + 1));
  }
  pick(list) {
    return list[Math.floor(this.next() * list.length)];
  }
  chance(probability) {
    return this.next() < probability;
  }
  sign() {
    return this.next() < 0.5 ? -1 : 1;
  }
}

/** A stable hash of two integers, for choices tied to a block rather than to draw order. */
export function hash2(x, y, salt = 0) {
  let h = Math.imul(x + 0x9e3779b9, 0x85ebca6b) ^ Math.imul(y + 0x7f4a7c15, 0xc2b2ae35) ^ Math.imul(salt + 1, 0x27d4eb2f);
  h ^= h >>> 15;
  h = Math.imul(h, 0x2c1b3c6d);
  h ^= h >>> 12;
  return (h >>> 0) / 4294967296;
}
