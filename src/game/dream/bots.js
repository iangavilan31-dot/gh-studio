// DREAMSCRAP bots (Part 6): Dozy / Awake / Lucid. Pure functions over the
// match state — no wall clock, no Math.random (dnoise only), no DOM — so
// the same bot is legal in lockstep, fills couch seats, and drives the
// balance round-robin headless in node. Awake IS the fightfeel driver
// that certified F3, promoted to a citizen.

import { dnoise, FIGHTERS } from './fightsim.js'

const LEVELS = {
  // Dozy naps through two of every three ticks and forgets to come back
  // to the stage half the time. Beatable by a sleepy eight-year-old.
  dozy: { skip: 3, heavyMod: 14, range: 2.2, jumps: false, di: false, specialMod: 0, fastfall: false, recoverJump: 13 },
  // Awake plays the game: approach, face, pulse, drop off shelves, recover.
  awake: { skip: 1, heavyMod: 8, range: 1.9, jumps: true, di: false, specialMod: 64, fastfall: false, recoverJump: 7 },
  // Lucid adds survival DI, fast-falls onto you, spaces, and spends supers.
  lucid: { skip: 1, heavyMod: 8, range: 1.9, jumps: true, di: true, specialMod: 34, fastfall: true, recoverJump: 5 },
}

export function makeBot(level = 'awake', id = 1) {
  const cfg = LEVELS[level] ?? LEVELS.awake
  return (m) => botInput(m, id, cfg)
}

export const BOT_LEVELS = Object.keys(LEVELS)

function botInput(m, id, cfg) {
  const f = m.fighters[id]
  if (!f || f.stocks <= 0 || m.over) return {}
  const tick = m.tick
  if (cfg.skip > 1 && tick % cfg.skip !== 0) return {} // dozy drops inputs

  // riding the moon down: drop early sometimes (looks alive)
  if (f.ko > 0) return { jump: cfg.jumps && f.ko < 30 && tick % 9 === 0 }

  // nearest living opponent
  let t = null, bd = 1e9
  for (const d of m.fighters) {
    if (d.id === id || d.stocks <= 0 || d.ko > 0) continue
    const dd = Math.abs(d.x - f.x)
    if (dd < bd) { bd = dd; t = d }
  }
  if (!t) return {}

  // — survival first: launched (DI home), off the stage, or falling —
  const bb = m.arena.blast
  const offStage = f.x < bb.l + 8.5 || f.x > bb.r - 8.5
  if (f.launched > 0 && cfg.di) return { x: f.x > 0 ? -1 : 1 } // DI toward center
  if (!f.grounded && (offStage || f.y < -1.5)) {
    return { x: f.x > 0 ? -1 : 1, jump: tick % cfg.recoverJump < 2 }
  }
  if (f.grounded && offStage) return { x: f.x > 0 ? -1 : 1 }

  const dx = t.x - f.x, dy = t.y - f.y
  const inp = {}

  // — vertical game —
  if (dy > 1.6) {
    // target above: chase with jumps (dozy just paces underneath); a target
    // more than a double-jump up needs the side-shelf staircase first
    let gx = t.x
    if (cfg.jumps && dy > 3.6 && f.y < 2 && Math.abs(t.x) < 4.5) gx = f.x < 0 ? -7.5 : 7.5
    inp.x = gx - f.x >= 0 ? 1 : -1
    if (cfg.jumps) inp.jump = tick % 2 === 0
  } else if (dy < -1.6 && f.grounded) {
    // target below: walk off / drop through the shelf
    inp.x = dx >= 0 ? 1 : -1
    inp.down = true
    inp.jump = tick % 2 === 0
  } else if (cfg.fastfall && !f.grounded && dy < -1.5 && f.vy < 2) {
    inp.down = true // lucid falls ON you
  }

  // — spacing + attacks (rhythms are PHASED per id: two bots on the same
  //   metronome turn balance into a raw startup race, and the fastest
  //   jab sweeps the bracket — first round-robin taught that) —
  const ph = tick + id * 5
  if (inp.x === undefined) {
    if (bd > cfg.range) {
      const want = dx > 0 ? 1 : -1
      // don't chase past the pursuit line — walk home instead of stalling
      // (two clamped bots on opposite shelves once drew 28% of the bracket)
      inp.x = (want > 0 && f.x > bb.r - 9.5) || (want < 0 && f.x < bb.l + 9.5) ? -want : want
      if (cfg.jumps && bd < 4.5 && ph % 41 === 0) inp.jump = true // spacing mixup
    } else {
      inp.x = dx >= 0 ? 1 : -1 // ALWAYS face the target
      if (f.deep >= 100) {
        inp.special = ph % 10 === 0 // spend the lantern
      } else if (ph % cfg.heavyMod < 4) inp.heavy = true
      else if (dnoise(tick, id, 11) < 0.05) inp.toss = true
      else if ((tick + id * 7) % (cfg.heavyMod + 3) < 2) inp.light = true
    }
  }
  // — ranged specials at mid distance (dart, hat) —
  if (cfg.specialMod && bd > 3 && bd < 8.5 && f.deep < 100) {
    const kind = (FIGHTERS[f.fid] ?? {}).special
    if ((kind === 'flameDart' || kind === 'hatThrow') && ph % cfg.specialMod === 0) {
      inp.special = true
      inp.x = dx >= 0 ? 1 : -1
    }
  }
  return inp
}
