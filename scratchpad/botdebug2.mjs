#!/usr/bin/env node
import { makeFighter, makeArena, makeMatch, stepMatch } from '../src/game/dream/fightsim.js'
import { makeBot } from '../src/game/dream/bots.js'
const ARENA = { solids: [{ x: 0, y: 0, w: 26, h: 3.2 }], plats: [{ x: -7.5, y: 3.0, w: 5 }, { x: 7.5, y: 3.0, w: 5 }, { x: 0, y: 5.6, w: 6 }], blast: { l: -21, r: 21, t: 20, b: -9 }, spawns: [[-6, 1], [6, 1], [-10, 4], [10, 4]] }
const arena = makeArena(ARENA)
const m = makeMatch(arena, [])
for (let i = 0; i < 2; i++) {
  const f = makeFighter(i, { fid: ['lamplighter', 'beldam'][i], stocks: 3 })
  const [sx, sy] = arena.spawns[i]
  f.x = sx; f.y = sy; f.face = sx > 0 ? -1 : 1
  m.fighters.push(f)
}
const bots = [makeBot('lucid', 0), makeBot('dozy', 1)]
let hits = 0, kos = 0, swings = 0, grabs = 0, escapes = 0
for (let t = 0; t < 14400 && !m.over; t++) {
  const ev = stepMatch(m, { 0: bots[0](m), 1: bots[1](m) })
  for (const e of ev) {
    if (e.t === 'hit' && e.a === 0) hits++
    if (e.t === 'swing' && e.id === 0) swings++
    if (e.t === 'ko') kos++
    if (e.t === 'grab') grabs++
    if (e.t === 'tossEscape') escapes++
  }
  if (t % 2400 === 0) {
    const [a, b] = m.fighters
    console.log(`t=${t} A(${a.x.toFixed(1)},${a.y.toFixed(1)}) mv=${a.move?.name ?? '-'} deep=${a.deep.toFixed(0)} | B(${b.x.toFixed(1)},${b.y.toFixed(1)}) wz=${b.wooze} st=${b.stocks} ko=${b.ko} inv=${b.invuln} grab=${b.grab} | hits=${hits} swings=${swings} grabs=${grabs} esc=${escapes}`)
  }
}
console.log(`over=${!!m.over} kos=${kos} hits=${hits} swings=${swings} grabs=${grabs} escapes=${escapes}`)
