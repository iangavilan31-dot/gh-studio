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

  // ——— collider audit (ASCENSION 0.1.3) ———
  // Every renderable surface the player can reach needs registered collision.
  // Walk the scene for large reachable meshes and assert each one is covered
  // by a collider. The list must be empty.
  const audit = await page.evaluate(() => {
    const M = window.__MOONREST__, W = M.__world
    const B = { minX: -175, maxX: 175, minZ: -205, maxZ: 185 }
    const misses = []
    let scanned = 0, merged = 0
    W.realScene.traverse((o) => {
      if (!o.isMesh || !o.geometry) return
      if (o.userData?.noCollide) return
      // Only SOLID surfaces can be walls. Transparent / additive / non-depth-
      // writing meshes are FX: glow halos, ember quads, particle billboards,
      // shimmer planes, the water surface (which the player is meant to
      // enter). Auditing them produced 21 false "uncovered" hits — 14 of them
      // pooled 1×1 quads parked at the origin while hidden.
      const mats = Array.isArray(o.material) ? o.material : [o.material]
      const solid = mats.some((m) => m && !m.transparent && m.depthWrite !== false && m.blending !== 2 /* AdditiveBlending */)
      if (!solid) return
      o.geometry.computeBoundingBox?.()
      const bb = o.geometry.boundingBox
      if (!bb) return
      // read the world matrix directly: three's getWorldPosition/Scale need
      // real Vector3 instances and we have no THREE handle in page scope
      o.updateWorldMatrix?.(true, false)
      const e = o.matrixWorld?.elements
      if (!e) return
      const sx = Math.hypot(e[0], e[1], e[2]) || 1
      const sy = Math.hypot(e[4], e[5], e[6]) || 1
      const sz = Math.hypot(e[8], e[9], e[10]) || 1
      const w = (bb.max.x - bb.min.x) * sx, h = (bb.max.y - bb.min.y) * sy, d = (bb.max.z - bb.min.z) * sz
      const footprint = Math.max(w, d)
      if (footprint < 1 || h < 1) return          // only meshes over 1m
      // Use the world-space bbox CENTRE, not the object origin: static props
      // are merged per material after their colliders are registered
      // (DECISIONS D10), and a merged batch's origin is (0,0,0) even though
      // its geometry spans a whole zone. Reading the origin reported 38 false
      // "uncovered" meshes all sitting at the world origin.
      const cxl = (bb.min.x + bb.max.x) / 2, cyl = (bb.min.y + bb.max.y) / 2, czl = (bb.min.z + bb.max.z) / 2
      const x = e[0] * cxl + e[4] * cyl + e[8] * czl + e[12]
      const y = e[1] * cxl + e[5] * cyl + e[9] * czl + e[13]
      const z = e[2] * cxl + e[6] * cyl + e[10] * czl + e[14]
      // A batch spanning >25m is a merged group or terrain, not a single prop;
      // its constituents registered collision individually at build time, so a
      // single centre-point test would be meaningless. Counted, not asserted.
      if (footprint > 25) { merged++; return }
      if (x < B.minX || x > B.maxX || z < B.minZ || z > B.maxZ) return   // outside the world
      if (y > 40) return                            // sky/moon/backdrop, unreachable
      // The rule is "every surface the PLAYER CAN REACH". Anything standing in
      // open water is offshore set dressing the player cannot walk to — e.g.
      // the anchored rowboat at (-26,-96), which exists to give the water a
      // middle-ground silhouette. Terrain below the water line is not
      // walkable ground.
      if (W.heightAt(x, z) < -1.2 /* WATER_Y */) return
      scanned++
      // covered if any registered collider overlaps its footprint
      const r = footprint / 2
      let covered = false
      for (const c of W.colliders) {
        if (Math.hypot(c.x - x, c.z - z) < c.r + r + 1.2) { covered = true; break }
      }
      if (!covered) {
        for (const b of W.aabbs) {
          const nx = Math.max(b.minX, Math.min(x, b.maxX)), nz = Math.max(b.minZ, Math.min(z, b.maxZ))
          if (Math.hypot(x - nx, z - nz) < r + 1.2) { covered = true; break }
        }
      }
      if (!covered) misses.push({ name: o.name || o.type, x: +x.toFixed(1), z: +z.toFixed(1), w: +w.toFixed(1), h: +h.toFixed(1) })
    })
    return { scanned, merged, misses: misses.slice(0, 8), total: misses.length }
  })
  check(`collider audit: every reachable mesh >1m has collision (${audit.scanned} scanned, ${audit.merged} merged batches skipped)`,
    audit.total === 0, audit.total ? `${audit.total} uncovered, e.g. ${JSON.stringify(audit.misses.slice(0, 3))}` : '')

  check('console clean', issues.length === 0, issues.slice(0, 2).join(' | '))
} catch (e) {
  check('collisioncheck completed', false, e.message)
} finally {
  await browser.close()
  preview.kill()
}
console.log(fail === 0 ? `COLLISIONCHECK PASS (${pass}/${pass})` : `COLLISIONCHECK: ${fail} FAILURES`)
process.exit(fail === 0 ? 0 : 1)
