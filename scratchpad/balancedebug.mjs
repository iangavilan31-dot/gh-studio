#!/usr/bin/env node
import { makeFighter, makeArena, makeMatch, stepMatch } from '../src/game/dream/fightsim.js'
import { makeBot } from '../src/game/dream/bots.js'
const ARENA = {
  solids: [{ x: 0, y: 0, w: 26, h: 3.2 }],
  plats: [{ x: -7.5, y: 3.0, w: 5 }, { x: 7.5, y: 3.0, w: 5 }, { x: 0, y: 5.6, w: 6 }],
  blast: { l: -21, r: 21, t: 20, b: -9 },
  spawns: [[-6, 1], [6, 1], [-10, 4], [10, 4]],
}
const [fidA, fidB] = process.argv.slice(2).length === 2 ? process.argv.slice(2) : ['lamplighter', 'chicken']
const arena = makeArena(ARENA)
const m = makeMatch(arena, [])
for (let i = 0; i < 2; i++) {
  const f = makeFighter(i, { fid: [fidA, fidB][i], stocks: 3 })
  const [sx, sy] = arena.spawns[i]
  f.x = sx; f.y = sy; f.face = sx > 0 ? -1 : 1
  m.fighters.push(f)
}
const bots = [makeBot('awake', 0), makeBot('awake', 1)]
let ticks = 0
const counts = {}
while (!m.over && ticks++ < 3600 * 4) {
  const ev = stepMatch(m, { 0: bots[0](m), 1: bots[1](m) })
  for (const e of ev) {
    if (e.t === 'hit' || e.t === 'ko' || e.t === 'super' || e.t === 'tossEscape' || e.t === 'throw') {
      counts[`${e.t}:${e.move ?? e.kind ?? ''}:${e.a ?? e.id}`] = (counts[`${e.t}:${e.move ?? e.kind ?? ''}:${e.a ?? e.id}`] ?? 0) + 1
    }
    if (e.t === 'ko') console.log(`t=${ticks} KO id=${e.id} side=${e.side} stocks=${e.stocks}`)
  }
  if (ticks % 1200 === 0) {
    const [a, b] = m.fighters
    console.log(`t=${ticks} A(${fidA}) x=${a.x.toFixed(1)} y=${a.y.toFixed(1)} wooze=${a.wooze} stocks=${a.stocks} deep=${a.deep.toFixed(0)} | B(${fidB}) x=${b.x.toFixed(1)} y=${b.y.toFixed(1)} wooze=${b.wooze} stocks=${b.stocks} deep=${b.deep.toFixed(0)}`)
  }
}
console.log(`over=${!!m.over} winner=${m.over ? m.fighters[m.winner]?.fid : 'DRAW'} ticks=${ticks}`)
console.log(JSON.stringify(counts, null, 0))
