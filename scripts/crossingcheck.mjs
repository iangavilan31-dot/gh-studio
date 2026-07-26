#!/usr/bin/env node
// FIN-0 gate (ASCENSION Part 0.2): crossing times at the DEFAULT run speed.
// Drives the real controller with real input — never inject velocity, or you
// measure the accel damping pulling it back to zero (DECISIONS #7).
import { spawn } from 'node:child_process'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const PORT = 4189
let fail = 0
const preview = spawn(resolve(root, 'node_modules/.bin/vite'), ['preview', '--port', String(PORT), '--strictPort'], { cwd: root, stdio: 'ignore' })
await new Promise((r) => setTimeout(r, 2800))
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--enable-unsafe-swiftshader', '--use-angle=swiftshader'] })
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } })
try {
  await page.goto(`http://localhost:${PORT}/`)
  await page.waitForFunction(() => window.__MOONREST__?.ready, null, { timeout: 25000 })
  await page.evaluate(() => { const M = window.__MOONREST__; M.suppressNightEnd?.(true); M.skipIntro?.(); M.startNight?.(true) })
  await page.waitForFunction(() => window.__MOONREST_PHYS__, null, { timeout: 25000 })
  const LEGS = [
    ['Park (long diagonal)', -38, -46, 34, 16, 25],
    ['Park (straight across)', -40, -18, 40, -18, 25],
    ['Village street', 52, 30, 96, 74, 30],
    ['Isle causeway', -104, 12, -150, 60, 30],
  ]
  const res = await page.evaluate((legs) => {
    const M = window.__MOONREST__, W = M.__world, P = M.__player
    const input = { moveAxis: () => [0, -1], pressed: () => false, down: () => false, pressTimes: new Map() }
    return legs.map(([name, x0, z0, x1, z1, budget]) => {
      P.pos.set(x0, 0, z0); P.pos.y = W.heightAt(x0, z0); P.vel.set(0, 0, 0)
      const L = Math.hypot(x1 - x0, z1 - z0)
      let t = 0; const dt = 1 / 60
      for (let i = 0; i < 60 * 120; i++) {
        const cx = x1 - P.pos.x, cz = z1 - P.pos.z, cl = Math.hypot(cx, cz)
        if (cl < 2) break
        P.update(input, Math.atan2(-cx / cl, -cz / cl), dt, 0); t += dt
      }
      const reached = Math.hypot(P.pos.x - x1, P.pos.z - z1) < 2
      return { name, t: +t.toFixed(2), dist: +L.toFixed(1), avg: +(L / t).toFixed(2), reached, budget }
    })
  }, LEGS)
  for (const r of res) {
    const ok = r.reached && r.t <= r.budget
    if (!ok) fail++
    console.log(`${ok ? 'PASS' : 'FAIL'} ${r.name}: ${r.t}s over ${r.dist}m (avg ${r.avg} m/s, budget ${r.budget}s)${r.reached ? '' : ' — NEVER ARRIVED'}`)
  }
} catch (e) { console.log('FAIL crossingcheck:', e.message); fail++ } finally { await browser.close(); preview.kill() }
console.log(fail === 0 ? 'CROSSINGCHECK PASS' : `CROSSINGCHECK: ${fail} FAILURES`)
process.exit(fail === 0 ? 0 : 1)
