#!/usr/bin/env node
// AA.5 hard gate — the FUN FLOOR. A scripted random walk (3 minutes) must
// surface something actionable or discoverable at least every 20 seconds:
// a cold/lit light, a Moon Brew, a fingerpost, a breadcrumb lantern, or a
// sleeper. Also asserts the first-kindle staging: Beldam's murmur points at
// the bench lamp within 60s of gaining control.
//
// Usage: node scripts/wandercheck.mjs

import { spawn } from 'node:child_process'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const PORT = 4181
const WANDER_S = 180
const ENCOUNTER_RADIUS = 16 // m — "surfaced": visible/reachable well within a 20s walk
const MAX_GAP_S = 20

const preview = spawn(resolve(root, 'node_modules/.bin/vite'), ['preview', '--port', String(PORT), '--strictPort'], { cwd: root, stdio: 'ignore' })
await new Promise((r) => setTimeout(r, 2500))
const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium',
  args: ['--no-sandbox', '--enable-unsafe-swiftshader', '--use-angle=swiftshader'],
})
const page = await browser.newPage({ viewport: { width: 960, height: 540 } })
await page.addInitScript(() => { window.__NIGHT_SEED__ = 42 }) // D.1: rigs run a pinned night signature
// MASTER 0.4 console hygiene: any console error/warning is a defect
const issues = []
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') issues.push(m.text()) })
page.on('pageerror', (e) => issues.push(e.message))
let fails = 0
const check = (name, ok, detail) => { console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ' — ' + detail : ''}`); if (!ok) fails++ }

await page.goto(`http://localhost:${PORT}/`)
await page.waitForFunction(() => window.__MOONREST__?.ready)
await page.waitForTimeout(800)

// — first-kindle staging: murmur pointer within 60s of control —
await page.evaluate(() => window.__MOONREST__.startNight())
const murmur = await page.waitForFunction(() => {
  const el = document.querySelector('.subtitle')
  return el && /lamp went cold/.test(el.textContent) ? el.textContent : false
}, null, { timeout: 60000 }).then((h) => h.jsonValue()).catch(() => null)
check('Beldam murmurs the first-lamp pointer within 60s', !!murmur, murmur ?? 'no murmur seen')
const lampVisible = await page.evaluate(() => {
  const M = window.__MOONREST__
  const lamp = M.lights.find((l) => l.id === 'park-bench-lamp')
  const p = M.state.playerPos
  return Math.hypot(lamp.x - p[0], lamp.z - p[2])
})
check('cold bench lamp within sight of spawn', lampVisible < 12, `${lampVisible.toFixed(1)}m`)

// — the wander: random walk, stuck-escape, encounter log —
await page.evaluate(() => { window.__MOONREST__.suppressNightEnd(true) })
const result = await page.evaluate(async ({ WANDER_S, ENCOUNTER_RADIUS }) => {
  const M = window.__MOONREST__
  const pois = M.pois
  const gaps = []
  let lastEncounter = 0
  let clock = 0
  let stuckRef = null, stuckT = 0
  // deterministic walk (mulberry32) — the gate must not be a dice roll
  let seed = 0x9e3779b9
  const rand = () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296 }
  let yaw = rand() * Math.PI * 2
  let yawT = 0
  const kb = (type, code) => window.dispatchEvent(new KeyboardEvent(type, { code, bubbles: true }))
  kb('keydown', 'KeyW')
  const step = 1 / 10
  while (clock < WANDER_S) {
    await new Promise((r) => setTimeout(r, 100))
    clock += step
    yawT -= step
    if (yawT <= 0) { yawT = 2 + rand() * 3; yaw += (rand() - 0.5) * 2.2; M.setCamYaw(yaw) }
    const p = M.state.playerPos
    // stuck: barely moved for 3s → hard turn
    if (!stuckRef) { stuckRef = p; stuckT = 0 }
    stuckT += step
    if (stuckT >= 3) {
      if (Math.hypot(p[0] - stuckRef[0], p[2] - stuckRef[2]) < 1.2) { yaw += Math.PI * (0.6 + rand() * 0.8); M.setCamYaw(yaw) }
      stuckRef = p; stuckT = 0
    }
    let near = false
    for (const poi of pois) {
      if (Math.hypot(poi.x - p[0], poi.z - p[2]) < ENCOUNTER_RADIUS) { near = true; break }
    }
    if (near) {
      const gap = clock - lastEncounter
      if (gap > 0.5) gaps.push({ gap: +gap.toFixed(1), at: [Math.round(p[0]), Math.round(p[2])] })
      lastEncounter = clock
    }
  }
  kb('keyup', 'KeyW')
  const p = M.state.playerPos
  const tailGap = clock - lastEncounter
  if (tailGap > 0.5) gaps.push({ gap: +tailGap.toFixed(1), at: [Math.round(p[0]), Math.round(p[2])] })
  gaps.sort((a, b) => b.gap - a.gap)
  return { poiCount: pois.length, gaps: gaps.slice(0, 5), maxGap: gaps[0]?.gap ?? 0, tailGap: +tailGap.toFixed(1), end: M.state.playerPos, zone: M.state.zone }
}, { WANDER_S, ENCOUNTER_RADIUS })

console.log(`pois=${result.poiCount} wander ended in ${result.zone} at [${result.end.map((v) => v.toFixed(0))}]`)
console.log('worst gaps:', result.gaps.map((g) => `${g.gap}s ending at [${g.at}]`).join(' · '))
check(`actionable encounter at least every ${MAX_GAP_S}s over ${WANDER_S}s`, result.maxGap <= MAX_GAP_S, `max gap ${result.maxGap.toFixed(1)}s`)

check('console clean', issues.length === 0, issues.slice(0, 3).join(' | '))
console.log(fails === 0 ? 'WANDER GATE PASS' : `WANDER GATE: ${fails} FAILURES`)
await browser.close()
preview.kill()
process.exit(fails === 0 ? 0 : 1)
