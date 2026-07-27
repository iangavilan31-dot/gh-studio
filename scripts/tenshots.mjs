#!/usr/bin/env node
// FIN-4 — screenshot evidence of the first ten minutes, as PLAYED.
//
// The shoot rig (scripts/shoot.mjs) photographs authored camera poses: it
// teleports to a framing and shoots. That is the right tool for judging
// composition, and the wrong one for evidencing an opening, because it never
// plays the game — every light in those frames is unlit because nobody lit it.
//
// This walks the opening route with real input, exactly as k1capture does, and
// photographs the world in the state the player actually put it in: lamps
// kindled behind them, the lantern pool moving with them, the village lighting
// up as they arrive.
//
// Output: docs/build/shots/ten/NN-<label>.png + docs/build/tenshots.json
// Usage:  node scripts/tenshots.mjs

import { spawn } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const outDir = resolve(root, 'docs/build/shots/ten')
mkdirSync(outDir, { recursive: true })
const PORT = 4186

const preview = spawn(resolve(root, 'node_modules/.bin/vite'),
  ['preview', '--port', String(PORT), '--strictPort'], { cwd: root, stdio: 'ignore' })
await new Promise((r) => setTimeout(r, 2500))

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium',
  args: ['--no-sandbox', '--enable-unsafe-swiftshader', '--use-angle=swiftshader'],
})
// Full 16:9 here — these frames are LOOKED AT, so they are shot at the size a
// person would see them, unlike the pacing capture which only needs numbers.
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } })
await page.addInitScript(() => { window.__NIGHT_SEED__ = 42 })
const issues = []
page.on('console', (m) => { if (m.type() === 'error') issues.push(m.text()) })
page.on('pageerror', (e) => issues.push(e.message))

await page.goto(`http://localhost:${PORT}/`)
await page.waitForFunction(() => window.__MOONREST__?.ready)
await page.waitForTimeout(1500)

// Drive the same generated opening route the pacing capture uses, pausing at
// milestones so each shot is a real moment rather than a random frame.
await page.evaluate(() => {
  const M = window.__MOONREST__
  M.startNight()
  M.suppressNightEnd(true)
  const inOpening = (x, z) => x > -60 && x < 145 && z > -45 && z < 45
  const stops = []
  for (const l of M.lights) if (!l.kindled && inOpening(l.x, l.z)) stops.push({ id: l.id, x: l.x, z: l.z, light: true, reach: l.reach })
  const route = []
  let cx = 2.7, cz = -18, pool = stops.slice()
  while (pool.length) {
    let bi = 0, bd = Infinity
    for (let i = 0; i < pool.length; i++) {
      const d = Math.hypot(pool[i].x - cx, pool[i].z - cz)
      if (d < bd) { bd = d; bi = i }
    }
    const n = pool.splice(bi, 1)[0]; route.push(n); cx = n.x; cz = n.z
  }
  window.__TEN__ = { route, wp: 0, done: false, kindled: 0, forced: [] }
})

const shots = []
async function shoot(label) {
  const file = resolve(outDir, `${String(shots.length).padStart(2, '0')}-${label}.png`)
  const stat = await page.evaluate(() => {
    const s = window.__MOONREST__.state
    return { kindled: s.kindled.length, zone: s.zone, pos: s.playerPos.map((v) => +v.toFixed(1)), nightT: +s.nightT.toFixed(2) }
  })
  await page.locator('#game').screenshot({ path: file })
  shots.push({ label, file: file.replace(root + '/', ''), ...stat })
  console.log(`  shot ${label}: ${stat.kindled} lit, zone ${stat.zone}, at ${stat.pos.join(',')}`)
}

await shoot('spawn')

// walk, shooting each time the kindled count crosses a milestone
const MILESTONES = [1, 3, 6, 10, 14, 17]
let mi = 0
for (let step = 0; step < 260 && mi < MILESTONES.length; step++) {
  const st = await page.evaluate(async () => {
    const M = window.__MOONREST__, T = window.__TEN__
    const kb = (t, c) => window.dispatchEvent(new KeyboardEvent(t, { code: c, bubbles: true }))
    kb('keydown', 'KeyW')
    let bestD = Infinity, noProg = 0, side = 0, sideKey = 'KeyD'
    for (let i = 0; i < 120 && T.wp < T.route.length; i++) {
      await new Promise((r) => setTimeout(r, 50))
      const s = M.state
      const t = T.route[T.wp]
      const dx = t.x - s.playerPos[0], dz = t.z - s.playerPos[2]
      const d = Math.hypot(dx, dz)
      if (d < bestD - 0.25) { bestD = d; noProg = 0 } else noProg++
      if (noProg > 25 && side <= 0) { side = 30; sideKey = sideKey === 'KeyD' ? 'KeyA' : 'KeyD'; kb('keydown', sideKey); noProg = 0 }
      if (side > 0 && --side === 0) kb('keyup', sideKey)
      if (side === 0) M.setCamYaw(Math.atan2(-dx, -dz))
      if (d < (t.reach ?? 2.0) - 0.05) {
        // The channel takes about a second of SIM time. These frames are shot
        // at full render quality, where the sim advances at roughly 6% of real
        // time — so a second of channel is ~17 real seconds, and the 2s this
        // used to wait meant the rig walked the entire route lighting nothing.
        kb('keyup', 'KeyW'); kb('keydown', 'KeyE')
        let lit = false
        for (let j = 0; j < 500; j++) {
          await new Promise((r) => setTimeout(r, 50))
          if (M.state.kindled.length > T.kindled) { lit = true; break }
        }
        kb('keyup', 'KeyE'); kb('keydown', 'KeyW')
        // If the hold still did not take, set the light directly and SAY SO.
        // A frame of an unlit opening would misrepresent the game just as badly
        // as a frame that pretended the player lit it.
        if (!lit && t.id) { M.kindle(t.id); T.forced.push(t.id) }
        T.kindled = M.state.kindled.length; T.wp++; bestD = Infinity; noProg = 0
        break
      }
    }
    kb('keyup', 'KeyW')
    return { kindled: M.state.kindled.length, wp: T.wp, total: T.route.length, forced: T.forced.length }
  })
  if (st.kindled >= MILESTONES[mi]) {
    await shoot(`lit-${st.kindled}`)
    mi++
  }
  if (st.wp >= st.total) break
}
await shoot('final')

const forced = await page.evaluate(() => window.__TEN__.forced)
const data = { shots, forcedKindles: forced, consoleIssues: issues.slice(0, 5) }
if (forced.length) console.log(`NOTE: ${forced.length} light(s) set directly because the channel hold timed out: ${forced.join(', ')}`)
writeFileSync(resolve(root, 'docs/build/tenshots.json'), JSON.stringify(data, null, 1))
const lastLit = shots[shots.length - 1].kindled
console.log(`${shots.length} frames captured, ${lastLit} lamps lit by the last one`)
console.log(issues.length === 0 ? 'console clean' : `console issues: ${issues.length}`)
await browser.close()
preview.kill()
process.exit(issues.length === 0 && lastLit >= 6 ? 0 : 1)
