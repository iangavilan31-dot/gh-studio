// Event -> layered SFX. Each entry fires an <Audio> at (eventFrame + offset).
// Files are the procedural stand-ins in public/audio/sfx (CC0 swap-in later).
export type SfxHit = { file: string; at: string; offset?: number; vol?: number };

export const SFX_HITS: SfxHit[] = [
  // b1 hook — name stamps 4 frames apart + the turn slam
  { file: "stamp", at: "b1.generals", offset: 0, vol: 0.9 },
  { file: "stamp", at: "b1.generals", offset: 4, vol: 0.85 },
  { file: "stamp", at: "b1.generals", offset: 8, vol: 0.8 },
  { file: "paper-slam", at: "b1.against", vol: 1 },
  { file: "whoosh", at: "b1.against", offset: -2, vol: 0.6 },

  // b2 — 43,000 counter + march
  { file: "pop", at: "b2.number", vol: 0.8 },
  { file: "hooves", at: "b2.marched", vol: 0.7 },
  { file: "whoosh", at: "b2.marched", offset: -2, vol: 0.5 },

  // b3 — the bonus / 1945 stamp
  { file: "click", at: "b3.owed", vol: 0.6 },
  { file: "stamp", at: "b3.date1945", vol: 0.95 },
  { file: "thud", at: "b3.date1945", offset: 1, vol: 0.5 },

  // b4 — depression / trenches
  { file: "paper-slam", at: "b4.depression", vol: 0.8 },
  { file: "rumble", at: "b4.trenches", vol: 0.5 },

  // b5 — camp
  { file: "whoosh", at: "b5.camped", vol: 0.6 },
  { file: "click", at: "b5.months", vol: 0.5 },

  // b6 — the vote
  { file: "click", at: "b6.voted", vol: 0.6 },
  { file: "stamp", at: "b6.saidNo", vol: 0.95 },
  { file: "paper-slam", at: "b6.voteCard", vol: 0.9 },

  // b7 — Hoover -> the Army (music dead-cut lives in Soundtrack)
  { file: "click", at: "b7.hoover", vol: 0.6 },
  { file: "thud", at: "b7.armyCut", vol: 1 },

  // b8 — sabers / bayonets / tanks
  { file: "clank", at: "b8.sabers", vol: 0.9 },
  { file: "whoosh-big", at: "b8.sabers", offset: -2, vol: 0.6 },
  { file: "clank", at: "b8.bayonets", vol: 0.9 },
  { file: "rumble", at: "b8.tanks", vol: 0.85 },
  { file: "hooves", at: "b8.avenue", vol: 0.6 },

  // b9 — gas + fire
  { file: "whoosh-big", at: "b9.gas", vol: 0.9 },
  { file: "fire", at: "b9.burned", vol: 0.9 },

  // b10 — casualties (sparse, heavy)
  { file: "thud", at: "b10.killed", vol: 0.8 },
  { file: "rumble", at: "b10.infant", vol: 0.4 },

  // b11 — headline
  { file: "paper-slam", at: "b11.headline", vol: 0.9 },
  { file: "squeak", at: "b11.quoteStart", vol: 0.7 },

  // b12 — booed / FDR / won
  { file: "boo", at: "b12.booed", vol: 0.8 },
  { file: "click", at: "b12.fdr", vol: 0.6 },
  { file: "paper-slam", at: "b12.headlines", vol: 0.85 },
  { file: "stamp", at: "b12.won", vol: 1 },
];
