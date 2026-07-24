#!/usr/bin/env node
// K.1 first-ten-minutes capture: runs the autopilot through the night's
// opening stretch and logs a timestamped event stream (zone flips, kindles,
// reveals, actions) plus 2Hz samples. Review happens on the JSON — the gate
// question is "is there ever a 12s+ sim stretch with nothing notable?"
// Output: docs/build/k1capture.json

import { spawn } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const PORT = 4185

const preview = spawn(resolve(root, 'node_modules/.bin/vite'), ['preview', '--port', String(PORT), '--strictPort'], { cwd: root, stdio: 'ignore' })
await new Promise((r) => setTimeout(r, 2500))

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium',
  args: ['--no-sandbox', '--enable-unsafe-swiftshader', '--use-angle=swiftshader'],
})
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } })
await page.addInitScript(() => {
  window.__NIGHT_SEED__ = 42 // D.1: pinned night
  try { localStorage.setItem('moonrest-settings-v1', JSON.stringify({ settingsV: 2, memoryMode: 'n64', resScale: 1 })) } catch (e) {}
})
const issues = []
page.on('pageerror', (e) => issues.push(e.message))

await page.goto(`http://localhost:${PORT}/`)
await page.waitForFunction(() => window.__MOONREST__?.ready)

// samples in-page at 2Hz of SIM (nightT) — wall-clock contention can stretch
// frames, but nightT gaps stay truthful
await page.evaluate(() => {
  window.__K1__ = { samples: [], events: [], prev: null }
  const M = window.__MOONREST__
  const tick = () => {
    const s = M.state
    const rec = {
      nt: s.nightT, zone: s.zone, kindled: s.kindled.length, fov: s.fov,
      speed: s.speed, action: s.action, x: s.playerPos[0], z: s.playerPos[2],
    }
    const p = window.__K1__.prev
    if (p) {
      if (rec.zone !== p.zone) window.__K1__.events.push({ nt: rec.nt, ev: 'zone', to: rec.zone })
      if (rec.kindled > p.kindled) window.__K1__.events.push({ nt: rec.nt, ev: 'kindle', n: rec.kindled })
      if (rec.fov > 57 && p.fov <= 57) window.__K1__.events.push({ nt: rec.nt, ev: 'reveal' })
      if (rec.action && rec.action !== p.action) window.__K1__.events.push({ nt: rec.nt, ev: 'action', a: rec.action })
    }
    window.__K1__.prev = rec
    window.__K1__.samples.push(rec)
    setTimeout(tick, 500)
  }
  tick()
})

// run the night like a player would: the autopilot walks, kindles, rests
await page.evaluate(() => window.__MOONREST__.autopilot())

// wait until 10 sim minutes have passed (or 22 wall minutes as a ceiling)
const t0 = Date.now()
await page.waitForFunction(() => window.__MOONREST__.state.nightT >= 10, { timeout: 22 * 60 * 1000 }).catch(() => {})
const wallMin = ((Date.now() - t0) / 60000).toFixed(1)

const data = await page.evaluate(() => ({ samples: window.__K1__.samples, events: window.__K1__.events }))
data.wallMinutes = +wallMin
data.consoleIssues = issues.slice(0, 5)

// gap analysis: sim-time stretches between notable events
const evs = data.events.filter((e) => ['zone', 'kindle', 'reveal', 'action'].includes(e.ev))
let worst = 0, worstAt = 0
let last = 0
for (const e of evs) {
  const gap = e.nt - last
  if (gap > worst) { worst = gap; worstAt = last }
  last = e.nt
}
const tail = (data.samples.at(-1)?.nt ?? 0) - last
if (tail > worst) { worst = tail; worstAt = last }
data.worstGapMin = +worst.toFixed(2)
data.worstGapAtMin = +worstAt.toFixed(2)

writeFileSync(resolve(root, 'docs/build/k1capture.json'), JSON.stringify(data, null, 1))
console.log(`captured ${data.samples.length} samples, ${data.events.length} events over ${data.samples.at(-1)?.nt.toFixed(1)} sim minutes (${wallMin} wall min)`)
console.log(`worst notable-event gap: ${data.worstGapMin} sim minutes at nightT=${data.worstGapAtMin}`)
console.log(issues.length === 0 ? 'K1 CAPTURE COMPLETE (console clean)' : `K1 CAPTURE: ${issues.length} console issues`)
await browser.close()
preview.kill()
