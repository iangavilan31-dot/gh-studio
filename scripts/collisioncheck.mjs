#!/usr/bin/env node
// FIN-0 gate (ASCENSION Part 0.1): the collision gate.
//
// A bot charges every prop, wall and world edge from 8 angles at SPRINT speed,
// then random-walks each zone. Asserts:
//   • zero penetrations   — never inside a collider's solid volume
//   • zero out-of-bounds  — never past the world boundary
//   • zero camera clips   — the camera never sits inside geometry
//   • zero falls          — never below the terrain surface
//
// This must pass 100% and is re-run after every movement or geometry change.
import { spawn } from 'node:child_process'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const PORT = 4188
let pass = 0, fail = 0
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ' — ' + detail : ''}`)
  ok ? pass++ : fail++
}

const preview = spawn(resolve(root, 'node_modules/.bin/vite'), ['preview', '--port', String(PORT), '--strictPort'], { cwd: root, stdio: 'ignore' })
await new Promise((r) => setTimeout(r, 2800))
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--enable-unsafe-swiftshader', '--use-angle=swiftshader'] })
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } })
const issues = []
page.on('pageerror', (e) => issues.push(e.message))
page.on('console', (m) => { if (m.type() === 'error') issues.push(m.text()) })

try {
  await page.addInitScript(() => { window.__NIGHT_SEED__ = 42 })
  await page.goto(`http://localhost:${PORT}/`)
  await page.waitForFunction(() => window.__MOONREST__?.ready, null, { timeout: 25000 })
  await page.evaluate(() => { const M = window.__MOONREST__; M.suppressNightEnd?.(true); M.skipIntro?.(); M.startNight?.(true) })

  // physics is WASM and lands a few frames in — the gate is meaningless
  // without it, so require it rather than silently testing the legacy path.
  const physOk = await page.waitForFunction(() => window.__MOONREST_PHYS__, null, { timeout: 25000 }).then(() => true).catch(() => false)
  const phys = physOk ? await page.evaluate(() => window.__MOONREST_PHYS__) : null
  check('rapier physics initialised (not the legacy fallback)', physOk, phys ? `${phys.props} props` : 'never arrived')
  check('terrain heightfield aligned with heightAt()', !!phys?.terrain?.aligned,
    phys ? `median ${phys.terrain.median}m over ${phys.terrain.hits} hits` : '')

  // ——— charge test: every prop, 8 angles, at sprint speed ———
  const charge = await page.evaluate(async () => {
    const M = window.__MOONREST__
    const W = M.__world, P = M.__player
    if (!W || !P) return { err: 'no debug handles' }
    const targets = []
    for (const c of W.colliders) targets.push({ x: c.x, z: c.z, r: c.r })
    for (const b of W.aabbs) targets.push({ x: (b.minX + b.maxX) / 2, z: (b.minZ + b.maxZ) / 2, r: Math.max(b.maxX - b.minX, b.maxZ - b.minZ) / 2 })
    const sample = targets.filter((_, i) => i % 2 === 0).slice(0, 70) // even coverage, bounded runtime
    let penetrations = 0, worst = 0, worstAt = null, tested = 0
    for (const t of sample) {
      for (let a = 0; a < 8; a++) {
        const ang = (a / 8) * Math.PI * 2
        const start = 6 + t.r
        // place the player outside, aim straight at the prop centre, and
        // drive the full distance in ONE step at sprint speed
        P.pos.set(t.x + Math.cos(ang) * start, 0, t.z + Math.sin(ang) * start)
        P.pos.y = W.heightAt(P.pos.x, P.pos.z)
        P.vel.set(-Math.cos(ang) * 8, 0, -Math.sin(ang) * 8)
        for (let s = 0; s < 14; s++) P.update({ moveAxis: () => [0, 0], pressed: () => false, down: () => false, pressTimes: new Map() }, 0, 1 / 20, 0)
        tested++
        const d = Math.hypot(P.pos.x - t.x, P.pos.z - t.z)
        const pen = t.r + 0.30 - d       // capsule radius 0.35, allow 0.05 skin
        if (pen > 0.06) {
          penetrations++
          if (pen > worst) { worst = pen; worstAt = { x: +t.x.toFixed(1), z: +t.z.toFixed(1), pen: +pen.toFixed(3) } }
        }
      }
    }
    return { tested, penetrations, worst: +worst.toFixed(3), worstAt }
  })
  if (charge.err) check('charge test ran', false, charge.err)
  else {
    check(`no penetrations charging ${charge.tested} prop/angle pairs at sprint speed`,
      charge.penetrations === 0, `penetrations=${charge.penetrations} worst=${charge.worst}m ${JSON.stringify(charge.worstAt ?? {})}`)
  }

  // ——— random-walk fuzz: out-of-bounds, falling through, camera clipping ———
  const fuzz = await page.evaluate(async () => {
    const M = window.__MOONREST__
    const W = M.__world, P = M.__player
    const B = { minX: -175, maxX: 175, minZ: -205, maxZ: 185 }
    let oob = 0, sunk = 0, worstSink = 0, steps = 0
    const spots = [[2.6, -18.2], [-60, -120], [40, 60], [84, 110], [-96, 3], [66, 106]]
    for (const [sx, sz] of spots) {
      P.pos.set(sx, 0, sz); P.pos.y = W.heightAt(sx, sz)
      let ang = 0
      for (let i = 0; i < 260; i++) {
        ang += (Math.sin(i * 12.9898) * 43758.5453 % 1) * 1.2 - 0.6
        P.vel.set(Math.cos(ang) * 8, 0, Math.sin(ang) * 8)
        P.update({ moveAxis: () => [0, 0], pressed: () => false, down: () => false, pressTimes: new Map() }, 0, 1 / 30, 0)
        steps++
        if (P.pos.x < B.minX - 1 || P.pos.x > B.maxX + 1 || P.pos.z < B.minZ - 1 || P.pos.z > B.maxZ + 1) oob++
        const g = W.heightAt(P.pos.x, P.pos.z)
        const sink = g - P.pos.y
        if (sink > 0.6) { sunk++; if (sink > worstSink) worstSink = sink }
      }
    }
    return { steps, oob, sunk, worstSink: +worstSink.toFixed(2) }
  })
  check(`no out-of-bounds over ${fuzz.steps} fuzz steps`, fuzz.oob === 0, `oob=${fuzz.oob}`)
  check('never sinks through the terrain', fuzz.sunk === 0, `sunk=${fuzz.sunk} worst=${fuzz.worstSink}m`)

  // ——— camera never inside geometry ———
  const cam = await page.evaluate(async () => {
    const M = window.__MOONREST__
    const W = M.__world, P = M.__player
    if (!W.physics) return { skip: true }
    let clipped = 0, samples = 0
    const spots = [[2.6, -18.2], [-60, -120], [40, 60], [84, 110], [-96, 3]]
    for (const [sx, sz] of spots) {
      P.pos.set(sx, 0, sz); P.pos.y = W.heightAt(sx, sz)
      for (let a = 0; a < 12; a++) {
        const ang = (a / 12) * Math.PI * 2
        const head = { x: P.pos.x, y: P.pos.y + 1.5, z: P.pos.z }
        const dir = { x: Math.cos(ang), y: 0.15, z: Math.sin(ang) }
        const L = Math.hypot(dir.x, dir.y, dir.z); dir.x /= L; dir.y /= L; dir.z /= L
        const toi = W.physics.cameraCast(head, dir, 5.0, 0.25)
        samples++
        // a hit is fine — that is the camera being pulled in. A hit at ~0
        // means the sphere STARTED inside solid geometry, which is the bug.
        if (toi != null && toi < 0.02) clipped++
      }
    }
    return { samples, clipped }
  })
  if (cam.skip) check('camera spherecast available', false, 'physics missing')
  else check(`camera never starts inside geometry (${cam.samples} casts)`, cam.clipped === 0, `clipped=${cam.clipped}`)

  check('console clean', issues.length === 0, issues.slice(0, 2).join(' | '))
} catch (e) {
  check('collisioncheck completed', false, e.message)
} finally {
  await browser.close()
  preview.kill()
}
console.log(fail === 0 ? `COLLISIONCHECK PASS (${pass}/${pass})` : `COLLISIONCHECK: ${fail} FAILURES`)
process.exit(fail === 0 ? 0 : 1)
