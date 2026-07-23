// Single seedable PRNG used by ALL generation (MASTER_PROMPT 0.4) so screenshots
// and playthroughs are reproducible. mulberry32 + string hashing.

function hashString(str) {
  let h = 1779033703 ^ str.length
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353)
    h = (h << 13) | (h >>> 19)
  }
  return h >>> 0
}

export class RNG {
  constructor(seed) {
    this.reseed(seed)
  }
  reseed(seed) {
    this.seed = seed
    this.s = typeof seed === 'string' ? hashString(seed) : (seed >>> 0)
    if (this.s === 0) this.s = 0x9e3779b9
  }
  // float [0,1)
  next() {
    this.s |= 0
    this.s = (this.s + 0x6d2b79f5) | 0
    let t = Math.imul(this.s ^ (this.s >>> 15), 1 | this.s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  range(min, max) { return min + this.next() * (max - min) }
  int(min, max) { return Math.floor(this.range(min, max + 1)) }
  pick(arr) { return arr[Math.floor(this.next() * arr.length)] }
  chance(p) { return this.next() < p }
  // deterministic child stream, independent of call order elsewhere
  fork(label) { return new RNG(hashString(String(this.seed) + '/' + label)) }
}

// The world seed. New Night may reseed; default is fixed for reproducible rigs.
export const worldRNG = new RNG('moonrest-night-1')
