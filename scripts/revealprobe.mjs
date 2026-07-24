#!/usr/bin/env node
// C.2 reveal-volume evidence capture: drives the keeper across a zone
// boundary and records {zone, fov} per frame — the reveal must widen the
// frame (+~5 fov) on entry without jogging, then ease back. Output lands in
// docs/build/revealprobe.json for the ledger.

import { spawn } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const PORT = 4179

const preview = spawn(resolve(root, 'node_modules/.bin/vite'), ['preview', '--port', String(PORT), '--strictPort'], { cwd: root, stdio: 'ignore' })
await new Promise((r) => setTimeout(r, 2500))

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium',
  args: ['--no-sandbox', '--enable-unsafe-swiftshader', '--use-angle=swiftshader'],
})
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } })
await page.addInitScript(() => { window.__NIGHT_SEED__ = 42 }) // D.1: rigs run a pinned night signature
await page.addInitScript(() => {
  try { localStorage.setItem('moonrest-settings-v1', JSON.stringify({ settingsV: 2, memoryMode: 'n64', resScale: 1 })) } catch (e) {}
})
const issues = []
page.on('pageerror', (e) => issues.push(e.message))

await page.goto(`http://localhost:${PORT}/`)
await page.waitForFunction(() => window.__MOONREST__?.ready)
await page.waitForTimeout(600)

let fails = 0
const check = (name, ok, detail) => {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ' — ' + detail : ''}`)
  if (!ok) fails++
}
const evidence = {}

const armProbe = () => page.evaluate(() => {
  window.__REVEAL__ = { t0: performance.now(), samples: [], stop: false }
  const probe = () => {
    const s = window.__MOONREST__.state
    window.__REVEAL__.samples.push({ t: +((performance.now() - window.__REVEAL__.t0) / 1000).toFixed(2), zone: s.zone, fov: +s.fov.toFixed(2), x: s.playerPos[0], z: s.playerPos[2], cd: s.camDist })
    if (!window.__REVEAL__.stop) requestAnimationFrame(probe)
  }
  requestAnimationFrame(probe)
})
const takeProbe = async () => {
  await page.evaluate(() => { window.__REVEAL__.stop = true })
  return page.evaluate(() => window.__REVEAL__.samples)
}

// — A) walk-in entrance: the west street into Emberwick (village) —
await page.evaluate(() => window.__MOONREST__.teleportPlayer(82, 2, 0))
await page.evaluate(() => window.__MOONREST__.setCamYaw(-Math.PI / 2)) // W walks east
await page.waitForTimeout(1200) // any teleport-triggered reveal decays first
await armProbe()
await page.keyboard.down('w')
await page.waitForTimeout(14000)
await page.keyboard.up('w')
const A = await takeProbe()
evidence.villageWalkIn = A
const flipA = A.find((s) => s.zone === 'village')
const peakA = flipA ? Math.max(...A.filter((s) => s.t >= flipA.t && s.t < flipA.t + 5).map((s) => s.fov)) : 0
const tail = A.slice(-8).map((s) => s.fov)
check('village walk-in reveal widens fov > 57.5', !!flipA && peakA > 57.5, `peak=${peakA}`)
check('reveal eases back (< 56.5 at rest)', tail.length > 0 && Math.min(...tail) < 56.5, `tail=${tail.join(',')}`)

// — B) entry into the isle volume (causeway approach) — the volume edge is
// z=-95 (r 55 from z=-150), so start in the fogland corridor and walk south
await page.evaluate(() => window.__MOONREST__.teleportPlayer(0, -88, Math.PI))
await page.evaluate(() => window.__MOONREST__.setCamYaw(0)) // W walks south (-z)
await page.waitForTimeout(1200)
await armProbe()
await page.keyboard.down('w')
await page.waitForTimeout(16000) // headless sim runs ~0.8m/s of walk per wall second
await page.keyboard.up('w')
const B = await takeProbe()
evidence.isleWalkIn = B
const flipB = B.find((s) => s.zone === 'isle')
const peakB = flipB ? Math.max(...B.filter((s) => s.t >= flipB.t && s.t < flipB.t + 5).map((s) => s.fov)) : 0
check('isle walk-in reveal widens fov > 57.5', !!flipB && peakB > 57.5, `peak=${peakB} flip=${flipB ? flipB.t : 'never'}`)

// — C) doorway crossing: into the Candlelit Hall — the camera may pull IN
// (snap-in prevents clipping, by design) but must not oscillate in-out-in
await page.evaluate(() => window.__MOONREST__.teleportPlayer(-110, 133, Math.PI))
await page.evaluate(() => window.__MOONREST__.setCamYaw(Math.PI)) // W walks north (+z) into the hall
await page.waitForTimeout(1200)
await armProbe()
await page.keyboard.down('w')
await page.waitForTimeout(17000) // the hall volume outweighs gloomspire's from z≈145
await page.keyboard.up('w')
const C = await takeProbe()
evidence.hallDoorway = C
let flips = 0, lastDir = 0
for (let i = 1; i < C.length; i++) {
  const d = C[i].cd - C[i - 1].cd
  if (Math.abs(d) < 0.3) continue
  const dir = Math.sign(d)
  if (lastDir !== 0 && dir !== lastDir) flips++
  lastDir = dir
}
const reachedHall = C.some((s) => s.zone === 'hall')
check('doorway reached the hall', reachedHall, `last z=${C[C.length - 1]?.z}`)
check('no camera snap oscillation in doorway (dist direction flips <= 2)', flips <= 2, `flips=${flips}`)

check('console clean', issues.length === 0, issues.slice(0, 2).join(' | '))
writeFileSync(resolve(root, 'docs/build/revealprobe.json'), JSON.stringify(evidence, null, 1))
console.log(fails === 0 ? 'REVEAL PROBE PASS' : `REVEAL PROBE: ${fails} FAILURES`)
await browser.close()
preview.kill()
process.exit(fails === 0 ? 0 : 1)
