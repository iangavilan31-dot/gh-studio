#!/usr/bin/env node
// DREAMSCRAP F10 perf gates — two honest halves:
//  1) PURE SIM chaos cost in node (4 Lucid bots + items + supers firing):
//     ms/tick — the 60fps question is "does the sim fit in 16.6ms", and
//     the answer is measured, not assumed.
//  2) BROWSER budgets in a live 4-bot chaos scene: draw calls ≤ 150,
//     triangles ≤ 250k (MOONREST budgets apply to arenas unchanged) +
//     headless-fps documented as a software-raster FLOOR, not the target.
import { spawn } from 'node:child_process'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'
import { makeFighter, makeArena, makeMatch, stepMatch } from '../src/game/dream/fightsim.js'
import { makeBot } from '../src/game/dream/bots.js'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
let fails = 0
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ' — ' + detail : ''}`)
  if (!ok) fails++
}

// ═══ 1) pure-sim chaos: 4 bots, items on, 4 sim-minutes ═══
const ARENA = {
  solids: [{ x: 0, y: 0, w: 26, h: 3.2 }],
  plats: [{ x: -7.5, y: 3.0, w: 5 }, { x: 7.5, y: 3.0, w: 5 }, { x: 0, y: 5.6, w: 6 }],
  blast: { l: -21, r: 21, t: 20, b: -9 },
  spawns: [[-6, 1], [6, 1], [-10, 4], [10, 4]],
}
const m = makeMatch(makeArena(ARENA), [])
m.itemsOn = true; m.critterOn = true
const FIDS = ['lamplighter', 'beldam', 'nib', 'paleking']
for (let i = 0; i < 4; i++) {
  const f = makeFighter(i, { fid: FIDS[i], stocks: 99 })
  const [sx, sy] = ARENA.spawns[i]
  f.x = sx; f.y = sy
  m.fighters.push(f)
}
const bots = FIDS.map((_, i) => makeBot('lucid', i))
const TICKS = 3600 * 4
const t0 = process.hrtime.bigint()
for (let t = 0; t < TICKS; t++) {
  stepMatch(m, { 0: bots[0](m), 1: bots[1](m), 2: bots[2](m), 3: bots[3](m) })
}
const ms = Number(process.hrtime.bigint() - t0) / 1e6
const msPerTick = ms / TICKS
check('pure sim: 4-bot chaos costs pennies', msPerTick < 0.5, `${msPerTick.toFixed(4)} ms/tick (${(msPerTick / 16.6 * 100).toFixed(2)}% of a 60fps frame)`)
console.log(`  sim record: ${TICKS} chaos ticks in ${ms.toFixed(0)}ms — ${(1000 / msPerTick / 1000).toFixed(0)}k ticks/sec headroom`)

// ═══ 2) browser: live 4-bot chaos, budgets sampled every frame ═══
const PORT = 4189
const preview = spawn(resolve(root, 'node_modules/.bin/vite'), ['preview', '--port', String(PORT), '--strictPort'], { cwd: root, stdio: 'ignore' })
await new Promise((r) => setTimeout(r, 2500))
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--enable-unsafe-swiftshader', '--use-angle=swiftshader'] })
const page = await browser.newPage({ viewport: { width: 960, height: 540 } })
await page.addInitScript(() => {
  window.__NIGHT_SEED__ = 42
  try { localStorage.setItem('moonrest-settings-v1', JSON.stringify({ settingsV: 2, memoryMode: 'n64', resScale: 1 })) } catch (e) {}
})
const issues = []
page.on('pageerror', (e) => issues.push(e.message))
page.on('crash', () => issues.push('PAGE CRASHED'))

await page.goto(`http://localhost:${PORT}/`)
await page.waitForFunction(() => window.__MOONREST__?.ready)
await page.evaluate(() => {
  const M = window.__MOONREST__
  M.suppressNightEnd(true)
  M.skipIntro()
  M.fight.enter('paleking', 4, 99, null, { 0: 'lucid', 1: 'lucid', 2: 'lucid', 3: 'lucid' })
  M.fight.itemsOn(true)
  M.fight.charge(0); M.fight.charge(2) // supers in the mix
})
await page.waitForTimeout(1200)
let sample = null
try {
  sample = await page.evaluate(() => new Promise((done) => {
    const M = window.__MOONREST__
    const draws = [], tris = [], fpss = []
    const t0 = performance.now()
    const poll = () => {
      const st = M.state
      draws.push(st.drawCalls); tris.push(st.triangles); fpss.push(st.fps)
      if (performance.now() - t0 > 15000) {
        const p95 = (a) => a.slice().sort((x, y) => x - y)[Math.floor(a.length * 0.95)]
        done({ n: draws.length, drawP95: p95(draws), triP95: p95(tris), fpsMin: Math.min(...fpss.filter(Boolean)), fpsMed: fpss.filter(Boolean).sort((a, b) => a - b)[Math.floor(fpss.length / 2)] ?? null })
        return
      }
      requestAnimationFrame(poll)
    }
    requestAnimationFrame(poll)
  }))
} catch (e) {
  console.log('SAMPLE FAILED:', String(e).slice(0, 140))
  console.log('ISSUES:', JSON.stringify(issues.slice(0, 6)))
  await browser.close(); preview.kill()
  process.exit(1)
}
check('draw calls under budget in 4-fighter chaos (≤150)', sample.drawP95 <= 150, `p95=${sample.drawP95}`)
check('triangles under budget (≤250k)', sample.triP95 <= 250000, `p95=${sample.triP95}`)
console.log(`  headless raster floor (SwiftShader, NOT the target profile): median ${sample.fpsMed}fps, min ${sample.fpsMin}fps over ${sample.n} frames`)
check('headless raster keeps a playable floor (≥20fps median)', (sample.fpsMed ?? 0) >= 20, `median=${sample.fpsMed}`)
check('console clean', issues.length === 0, issues.slice(0, 3).join(' | '))
await browser.close(); preview.kill()
console.log(fails === 0 ? 'FIGHTPERF PASS' : `FIGHTPERF: ${fails} FAILURES`)
process.exit(fails === 0 ? 0 : 1)
