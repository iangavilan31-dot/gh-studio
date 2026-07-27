#!/usr/bin/env node
// FIN-4 — every light must be lightable.
//
// The whole verb of this game is kindling the old lights. Three of them could
// not be kindled at all: `village-well-lantern`, `ruins-moonwell` and
// `isle-keep-brazier` sit inside their own structures, and the nearest point a
// 0.35m capsule could legally stand was 2.87m, 3.06m and 5.36m from centres the
// player had to get within 2.0m of. Nothing caught it, because nothing had ever
// tried to walk up to all of them.
//
// This walks up to all of them. It does not compute reachability geometrically
// — an earlier geometric pass produced a false positive (it called
// `rooftops-telescope-brazier` unreachable when a player can in fact light it),
// which is exactly why this drives the real controller with real input against
// the real collision and reports only what actually happened.
//
// Usage: node scripts/reachcheck.mjs [--json]

import { spawn } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
mkdirSync(resolve(root, 'docs/build'), { recursive: true })
const PORT = 4187
const asJson = process.argv.includes('--json')

const preview = spawn(resolve(root, 'node_modules/.bin/vite'),
  ['preview', '--port', String(PORT), '--strictPort'], { cwd: root, stdio: 'ignore' })
await new Promise((r) => setTimeout(r, 2500))

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium',
  args: ['--no-sandbox', '--enable-unsafe-swiftshader', '--use-angle=swiftshader'],
})
// small viewport: this measures reachability, which is frame-rate independent
const page = await browser.newPage({ viewport: { width: 640, height: 360 } })
await page.addInitScript(() => { window.__NIGHT_SEED__ = 42 })
const issues = []
page.on('pageerror', (e) => issues.push(e.message))
await page.goto(`http://localhost:${PORT}/?lit=0`)
await page.waitForFunction(() => window.__MOONREST__?.ready)
await page.waitForTimeout(800)

const data = await page.evaluate(async () => {
  const M = window.__MOONREST__
  M.startNight()
  M.suppressNightEnd(true)
  const kb = (t, c) => window.dispatchEvent(new KeyboardEvent(t, { code: c, bubbles: true }))
  const out = []
  for (const L of M.lights) {
    if (L.kindled) continue                       // pre-lit breadcrumbs are not objectives
    const range = L.reach ?? 2.0
    let kindled = false, closest = Infinity
    // eight approaches: a light reachable from only one side is still reachable
    for (let a = 0; a < 8 && !kindled; a++) {
      const ang = a * Math.PI / 4
      M.teleportPlayer(L.x + Math.cos(ang) * 7, L.z + Math.sin(ang) * 7, 0)
      await new Promise((r) => setTimeout(r, 200))
      kb('keydown', 'KeyW')
      for (let i = 0; i < 70; i++) {
        await new Promise((r) => setTimeout(r, 50))
        const s = M.state
        const dx = L.x - s.playerPos[0], dz = L.z - s.playerPos[2]
        const d = Math.hypot(dx, dz)
        closest = Math.min(closest, d)
        M.setCamYaw(Math.atan2(-dx, -dz))
        if (d < range) {
          kb('keyup', 'KeyW'); kb('keydown', 'KeyE')
          for (let j = 0; j < 40; j++) {
            await new Promise((r) => setTimeout(r, 50))
            if (M.state.kindled.includes(L.id)) { kindled = true; break }
          }
          kb('keyup', 'KeyE'); kb('keydown', 'KeyW')
          break
        }
      }
      kb('keyup', 'KeyW')
    }
    out.push({ id: L.id, zone: L.zone, kindled, closest: +closest.toFixed(2), range })
  }
  return { lights: out }
})

data.consoleIssues = issues.slice(0, 5)
const bad = data.lights.filter((l) => !l.kindled)
data.unreachable = bad
writeFileSync(resolve(root, 'docs/build/reachcheck.json'), JSON.stringify(data, null, 1))

if (asJson) console.log(JSON.stringify(data, null, 1))
else {
  console.log(`${data.lights.length} kindleable lights tested`)
  for (const l of bad) {
    console.log(`  UNREACHABLE ${l.id} (${l.zone}) — closest approach ${l.closest}m, needs <= ${l.range}m`)
  }
  console.log(bad.length === 0
    ? `REACHCHECK PASS — every light can be lit (${data.lights.length}/${data.lights.length})`
    : `REACHCHECK FAIL — ${bad.length} light(s) cannot be lit by any approach`)
  console.log(issues.length === 0 ? 'console clean' : `console issues: ${issues.length}`)
}

await browser.close()
preview.kill()
process.exit(bad.length === 0 && issues.length === 0 ? 0 : 1)
