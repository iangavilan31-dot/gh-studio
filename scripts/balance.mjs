#!/usr/bin/env node
// DREAMSCRAP balance round-robin (Parts 3+6): every fighter vs every
// fighter, 20 matches each pairing, Awake bots both sides, pure-node sim
// (fightsim + bots import clean — no three, no DOM). Gate: no fighter
// above 60% or below 40% overall winrate. Determinism: match variety comes
// only from alternating sides + spawn slots + a per-match tick offset.
import { makeFighter, makeArena, makeMatch, stepMatch, FIGHTERS } from '../src/game/dream/fightsim.js'
import { makeBot } from '../src/game/dream/bots.js'

const ARENA = {
  solids: [{ x: 0, y: 0, w: 26, h: 3.2 }],
  plats: [{ x: -7.5, y: 3.0, w: 5 }, { x: 7.5, y: 3.0, w: 5 }, { x: 0, y: 5.6, w: 6 }],
  blast: { l: -21, r: 21, t: 20, b: -9 },
  spawns: [[-6, 1], [6, 1], [-10, 4], [10, 4]],
}
const IDS = Object.keys(FIGHTERS).filter((k) => k !== 'watcher') // the secret stays secret; he still gets a line below
IDS.push('watcher')
const MATCHES = 20
const TICK_CAP = 3600 * 4 // 4 sim-minutes then call it a draw

function runMatch(fidA, fidB, matchIdx) {
  const arena = makeArena(ARENA)
  const m = makeMatch(arena, [])
  // alternate who takes which spawn slot so neither side owns an edge
  const flip = matchIdx % 2 === 1
  const fids = flip ? [fidB, fidA] : [fidA, fidB]
  for (let i = 0; i < 2; i++) {
    const f = makeFighter(i, { fid: fids[i], stocks: 3 })
    const [sx, sy] = arena.spawns[i]
    f.x = sx; f.y = sy; f.face = sx > 0 ? -1 : 1
    m.fighters.push(f)
  }
  // vary openings deterministically: idle a different number of ticks
  m.tick = 0
  const bots = [makeBot('awake', 0), makeBot('awake', 1)]
  const idle = (matchIdx * 7) % 23
  for (let k = 0; k < idle; k++) stepMatch(m, {})
  let ticks = 0
  while (!m.over && ticks++ < TICK_CAP) {
    stepMatch(m, { 0: bots[0](m), 1: bots[1](m) })
  }
  if (!m.over) return { winner: null, ticks }
  const winFid = m.fighters[m.winner]?.fid ?? null
  return { winner: winFid, ticks }
}

const wins = Object.fromEntries(IDS.map((k) => [k, 0]))
const games = Object.fromEntries(IDS.map((k) => [k, 0]))
let draws = 0
const t0 = Date.now()
for (let a = 0; a < IDS.length; a++) {
  for (let b = a + 1; b < IDS.length; b++) {
    for (let i = 0; i < MATCHES; i++) {
      const r = runMatch(IDS[a], IDS[b], i)
      games[IDS[a]]++; games[IDS[b]]++
      if (r.winner) wins[r.winner]++
      else draws++
    }
  }
}
console.log(`round-robin: ${IDS.length} fighters, ${MATCHES} matches/pair, ${draws} draws, ${((Date.now() - t0) / 1000).toFixed(1)}s`)
let fails = 0
for (const k of IDS) {
  const wr = games[k] ? wins[k] / games[k] : 0
  const ok = wr >= 0.4 && wr <= 0.6
  if (!ok) fails++
  console.log(`${ok ? 'PASS' : 'FAIL'} ${k.padEnd(12)} winrate ${(wr * 100).toFixed(1)}%  (${wins[k]}/${games[k]})`)
}
console.log(fails === 0 ? 'BALANCE PASS' : `BALANCE: ${fails} OUT OF BOUNDS`)
process.exit(fails === 0 ? 0 : 1)
