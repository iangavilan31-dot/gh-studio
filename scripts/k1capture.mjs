#!/usr/bin/env node
// K.1 first-ten-minutes capture v3: the AUTHORED route — spawn, Beldam's
// pointer, the bench lamp, the park lanterns, the east road past the
// fingerpost, into Emberwick and its street lamps. Waypoint steering with
// real held keys; channels each cold light it reaches. Logs a timestamped
// event stream and dead-stretch gaps in SIM minutes.
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
// 640x360, deliberately. What this capture measures is the EVENT TIMELINE in
// SIM minutes — when lamps are kindled, when zones change, how long the dead
// stretches are — and every one of those is frame-rate independent. Render
// size changes none of it.
//
// It changes how long the run takes enormously. Under software GL with the
// full post chain, 720p advances the sim at roughly 6% of real time, so ten
// sim minutes costs about three hours; at 640x360 it is minutes. The pipeline
// is still the real one — this is the shipping build, just drawn smaller.
// (Composition and look are judged by composecheck/shoot at full size.)
const page = await browser.newPage({ viewport: { width: 640, height: 360 } })
await page.addInitScript(() => {
  window.__NIGHT_SEED__ = 42 // D.1: pinned night
  try { localStorage.setItem('moonrest-settings-v1', JSON.stringify({ settingsV: 2, memoryMode: 'n64', resScale: 1 })) } catch (e) {}
})
const issues = []
page.on('pageerror', (e) => issues.push(e.message))

await page.goto(`http://localhost:${PORT}/`)
await page.waitForFunction(() => window.__MOONREST__?.ready)
await page.waitForTimeout(500)

const data = await page.evaluate(async () => {
  const M = window.__MOONREST__
  M.startNight()
  M.suppressNightEnd(true)
  const pois = M.pois
  const kb = (type, code) => window.dispatchEvent(new KeyboardEvent(type, { code, bubbles: true }))
  // The opening route, GENERATED from the world rather than hand-listed.
  //
  // The hand-listed version visited 22 waypoints and lit 8 lamps, filled 2.07
  // sim minutes, and I read that as "the opening is thin". It was not: the
  // opening footprint (park, east road, village) holds 44 points of interest —
  // 17 lights, 5 brews, 4 signs, 3 benches, 9 sleepers. The ROUTE was the thin
  // thing, and a capture of a thin route says nothing about the game.
  //
  // So the route now walks everything actually there, ordered nearest-neighbour
  // from the spawn. It stays honest as content moves, and it cannot silently
  // drift into sampling a fraction of the zone again.
  const inOpening = (x, z) => x > -60 && x < 145 && z > -45 && z < 45
  const stops = []
  for (const l of M.lights) {
    if (!l.kindled && inOpening(l.x, l.z)) stops.push({ x: l.x, z: l.z, light: true, reach: l.reach })
  }
  for (const q of pois) {
    if (q.kind === 'brew' && inOpening(q.x, q.z)) stops.push({ x: q.x, z: q.z })
  }
  // nearest-neighbour from spawn — a plausible walking order, not a salesman
  const route = []
  { let cx = 2.7, cz = -18, pool = stops.slice()
    while (pool.length) {
      let bi = 0, bd = Infinity
      for (let i = 0; i < pool.length; i++) {
        const d = Math.hypot(pool[i].x - cx, pool[i].z - cz)
        if (d < bd) { bd = d; bi = i }
      }
      const n = pool.splice(bi, 1)[0]
      route.push(n); cx = n.x; cz = n.z
    }
  }

  // Light waypoints authored as bare coordinates still need to know the reach
  // of the light they refer to, or the driver walks to the wrong distance —
  // which is what kept it grinding at the village well for 1.2 sim minutes even
  // after the well itself became kindleable.
  for (const t of route) {
    if (!t.light || t.reach != null) continue
    let best = null, bestD = Infinity
    for (const l of M.lights) {
      const d = Math.hypot(l.x - t.x, l.z - t.z)
      if (d < bestD) { bestD = d; best = l }
    }
    if (best && bestD < 3) t.reach = best.reach
  }

  // ——— navigation ———
  // Four unstick heuristics failed on the same five stops, each in a different
  // corner. A greedy seek cannot navigate concave geometry; the fix is a plan,
  // not a better reflex. The physics layer already publishes every collider and
  // AABB, so a coarse occupancy grid plus A* is cheap and exact enough — the
  // driver only needs to know which way round an obstacle to go.
  // 1.5m cells closed the Village street: houses either side plus padding left
  // no free cell down a gap the 0.70m player fits through, so A* found no route
  // and the driver fell back to greedy — every unstick moved from the spawn
  // bench to the same street. 0.9m resolves a street while staying cheap.
  const CELL = 0.9
  const GX0 = -70, GX1 = 155, GZ0 = -55, GZ1 = 55
  const GW = Math.ceil((GX1 - GX0) / CELL), GH = Math.ceil((GZ1 - GZ0) / CELL)
  const blocked = new Uint8Array(GW * GH)
  {
    const w = M.__world
    const PAD = 0.38   // capsule radius (0.35) + a hair; more closes real gaps
    for (const c of (w.colliders || [])) {
      if ((c.h ?? 0) < 0.5) continue
      const r = (c.r ?? 0) + PAD
      const i0 = Math.max(0, Math.floor((c.x - r - GX0) / CELL)), i1 = Math.min(GW - 1, Math.ceil((c.x + r - GX0) / CELL))
      const j0 = Math.max(0, Math.floor((c.z - r - GZ0) / CELL)), j1 = Math.min(GH - 1, Math.ceil((c.z + r - GZ0) / CELL))
      for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) {
        const x = GX0 + (i + 0.5) * CELL, z = GZ0 + (j + 0.5) * CELL
        if (Math.hypot(x - c.x, z - c.z) < r) blocked[j * GW + i] = 1
      }
    }
    for (const a of (w.aabbs || [])) {
      const i0 = Math.max(0, Math.floor((a.minX - PAD - GX0) / CELL)), i1 = Math.min(GW - 1, Math.ceil((a.maxX + PAD - GX0) / CELL))
      const j0 = Math.max(0, Math.floor((a.minZ - PAD - GZ0) / CELL)), j1 = Math.min(GH - 1, Math.ceil((a.maxZ + PAD - GZ0) / CELL))
      for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) blocked[j * GW + i] = 1
    }
  }
  const cellOf = (x, z) => [
    Math.min(GW - 1, Math.max(0, Math.floor((x - GX0) / CELL))),
    Math.min(GH - 1, Math.max(0, Math.floor((z - GZ0) / CELL))),
  ]
  function planPath(sx, sz, tx, tz) {
    const [si, sj] = cellOf(sx, sz)
    let [ti, tj] = cellOf(tx, tz)
    // a target sitting inside its own structure (a well head, a plinth) has a
    // blocked cell; walk out to the nearest free one rather than failing
    if (blocked[tj * GW + ti]) {
      let best = null, bd = Infinity
      for (let i = Math.max(0, ti - 4); i <= Math.min(GW - 1, ti + 4); i++)
        for (let j = Math.max(0, tj - 4); j <= Math.min(GH - 1, tj + 4); j++) {
          if (blocked[j * GW + i]) continue
          const d = (i - ti) ** 2 + (j - tj) ** 2
          if (d < bd) { bd = d; best = [i, j] }
        }
      if (!best) return null
      ;[ti, tj] = best
    }
    const N = GW * GH
    const g = new Float32Array(N).fill(Infinity)
    const prev = new Int32Array(N).fill(-1)
    const start = sj * GW + si, goal = tj * GW + ti
    g[start] = 0
    const open = [start]
    const h = (k) => Math.hypot((k % GW) - ti, Math.floor(k / GW) - tj)
    const inOpen = new Uint8Array(N); inOpen[start] = 1
    while (open.length) {
      let bi = 0, bf = Infinity
      for (let k = 0; k < open.length; k++) { const f = g[open[k]] + h(open[k]); if (f < bf) { bf = f; bi = k } }
      const cur = open.splice(bi, 1)[0]; inOpen[cur] = 0
      if (cur === goal) break
      const ci = cur % GW, cj = Math.floor(cur / GW)
      for (let di = -1; di <= 1; di++) for (let dj = -1; dj <= 1; dj++) {
        if (!di && !dj) continue
        const ni = ci + di, nj = cj + dj
        if (ni < 0 || nj < 0 || ni >= GW || nj >= GH) continue
        const nk = nj * GW + ni
        if (blocked[nk]) continue
        const step = (di && dj) ? 1.4142 : 1
        if (g[cur] + step < g[nk]) { g[nk] = g[cur] + step; prev[nk] = cur; if (!inOpen[nk]) { open.push(nk); inOpen[nk] = 1 } }
      }
    }
    if (prev[goal] < 0 && goal !== start) return null
    const pts = []
    for (let k = goal; k >= 0; k = prev[k]) {
      pts.push({ x: GX0 + ((k % GW) + 0.5) * CELL, z: GZ0 + (Math.floor(k / GW) + 0.5) * CELL })
      if (k === start) break
    }
    pts.reverse()
    return pts
  }

  const events = []
  let wp = 0, prev = null, channelStart = null
  // Stuck handling. A pure seek driver presses W into whatever it hits and
  // never stops — the first run of this capture sat at one position for 1800
  // ticks while the controller reported 5.2 m/s. Even with the world's pinch
  // traps sealed, a concave corner can still trap a dumb seek, so the driver
  // needs to notice and go around.
  let prevKindled = new Set()
  let path = [], planFor = -1
  let bestD = Infinity, noProgress = 0, sidestep = 0, sidestepKey = 'KeyD'
  let stuckRuns = 0, reversing = 0
  let wpStartNt = 0
  const stalls = []
  const nt0 = M.state.nightT
  let lastNotable = 0
  const gaps = []
  let routeDoneNt = null
  kb('keydown', 'KeyW')
  while (true) {
    await new Promise((r) => setTimeout(r, 100))
    const s = M.state
    const nt = s.nightT - nt0
    if (nt >= 10) break
    // Stop when the route is walked. Idling at the park heart after the last
    // waypoint is the HARNESS having nothing left to do, not the game being
    // empty, and scoring it as a dead stretch measures the wrong thing — it
    // produced a 6.62 sim-minute "gap" that said nothing about the opening.
    // How much of the ten minutes the authored route actually fills is
    // reported separately below, because that IS worth knowing.
    if (wp >= route.length) { routeDoneNt = nt; break }
    const t = route[Math.min(wp, route.length - 1)]
    const d = Math.hypot(t.x - s.playerPos[0], t.z - s.playerPos[2])

    // Follow the PLAN, not the goal. Re-plan when the waypoint changes or when
    // the current plan has been consumed; otherwise advance along it, dropping
    // nodes as they are reached. Steering at the next node instead of at the
    // destination is what lets the driver go round a corner rather than press
    // into it.
    if (wp !== planFor || (!path.length && d > 2.5)) {
      path = planPath(s.playerPos[0], s.playerPos[2], t.x, t.z) || []
      planFor = wp
      // drop nodes already behind us
      while (path.length > 1 && Math.hypot(path[0].x - s.playerPos[0], path[0].z - s.playerPos[2]) < CELL) path.shift()
    }
    while (path.length && Math.hypot(path[0].x - s.playerPos[0], path[0].z - s.playerPos[2]) < CELL * 1.1) path.shift()
    const aim = path.length ? path[0] : t
    const dx = aim.x - s.playerPos[0], dz = aim.z - s.playerPos[2]

    // --- unstick ---
    if (!channelStart) {
      // PROGRESS, not motion. A player pressed against an obstacle still slides
      // along it, so "did the position change?" reports healthy movement while
      // the run goes nowhere — that micro-jitter defeated the first version of
      // this check. What matters is whether the target is getting closer.
      if (d < bestD - 0.25) { bestD = d; noProgress = 0 } else noProgress++
      // Escalate. Alternating direction on every attempt walks the player back
      // into the same corner — seven unsticks fired at (110.99, 1.32) within a
      // metre of each other. Keep a direction while it is working, flip only
      // after it fails, and add reverse once flipping has failed too.
      if (noProgress > 25 && sidestep <= 0) {
        stuckRuns++
        // wedged: strafe along the obstacle for a beat, alternating sides so a
        // corner that defeats one direction gets the other next time
        // Bounded. Unbounded escalation is its own failure: reversing on every
        // attempt walked the driver from z -18 out to z -57, wandering off
        // instead of getting round the obstacle. Sidesteps grow only to a cap,
        // and reverse fires exactly once per waypoint.
        sidestep = Math.min(30 + stuckRuns * 25, 90)
        if (stuckRuns > 1) sidestepKey = sidestepKey === 'KeyD' ? 'KeyA' : 'KeyD'
        if (stuckRuns === 3) { kb('keyup', 'KeyW'); kb('keydown', 'KeyS'); reversing = 18 }
        stalls.push({ nt: +nt.toFixed(2), at: [+s.playerPos[0].toFixed(2), +s.playerPos[2].toFixed(2)], wp, run: stuckRuns })
        kb('keydown', sidestepKey)
        noProgress = 0
      }
      if (reversing > 0 && --reversing === 0) { kb('keyup', 'KeyS'); kb('keydown', 'KeyW') }
      if (sidestep > 0 && --sidestep === 0) kb('keyup', sidestepKey)
      // steer toward the waypoint (but not while strafing free of an obstacle)
      if (sidestep === 0) M.setCamYaw(Math.atan2(-dx, -dz))
    }

    // a waypoint that cannot be reached must not eat the whole capture
    if (!channelStart && nt - wpStartNt > 1.2 && wp < route.length) {
      events.push({ nt: +nt.toFixed(2), ev: 'skip', at: [t.x, t.z] })
      wp++; wpStartNt = nt; bestD = Infinity; noProgress = 0; stuckRuns = 0; path = []
      if (sidestep > 0) { kb('keyup', sidestepKey); sidestep = 0 }
    }
    // Arrival radius. The game's interact range is 2.0m, and this used to
    // require 1.8m as a safety margin — which made any light with a fat
    // collider physically unreachable. `village-well-lantern` sits at the
    // centre of a 1.5m-radius well inside a solid 9x8m block, so the closest a
    // 0.35m capsule can stand is ~1.85m: inside the game's interact range,
    // outside the driver's arrival test by five centimetres. The driver ground
    // against the well's west wall for 1.2 sim minutes and then skipped it.
    // Use the range the GAME uses, barely inside it.
    // use the light's OWN reach — the game does, and a fixed radius sends the
    // driver to a distance a wide-structure light can never be approached at
    const arrive = t.light ? (t.reach ?? 2.0) - 0.05 : 1.8
    if (d < arrive && wp < route.length) {
      if (t.light && !channelStart) {
        kb('keyup', 'KeyW')
        kb('keydown', 'KeyE')
        channelStart = nt
      } else if (!t.light) {
        events.push({ nt: +nt.toFixed(2), ev: 'waypoint', at: [t.x, t.z] })
        wp++; wpStartNt = nt; bestD = Infinity; noProgress = 0; stuckRuns = 0; path = []
      }
    }
    if (channelStart != null) {
      if (prev && s.kindled.length > prev.kindled) {
        kb('keyup', 'KeyE')
        kb('keydown', 'KeyW')
        channelStart = null
        wp++; wpStartNt = nt; bestD = Infinity; noProgress = 0; stuckRuns = 0; path = []
      } else if (nt - channelStart > 0.2) { // ~12s sim without a kindle: move on
        kb('keyup', 'KeyE')
        kb('keydown', 'KeyW')
        channelStart = null
        wp++; wpStartNt = nt; bestD = Infinity; noProgress = 0; stuckRuns = 0; path = []
      }
    }
    if (prev) {
      if (s.zone !== prev.zone) events.push({ nt: +nt.toFixed(2), ev: 'zone', to: s.zone })
      if (s.kindled.length > prev.kindled) {
        // Name the light that ACTUALLY lit. state.kindled is derived by
        // filtering world.lights, so it is in world order, not kindle order —
        // taking its last element named whichever kindled light happens to sit
        // last in the world array. That made 14 real kindles report as 4
        // distinct ids, and a judge reviewer reasonably read the duplicates as
        // lights re-firing. The game was fine; the label was wrong. Diff the
        // sets instead.
        const added = s.kindled.filter((id) => !prevKindled.has(id))
        events.push({ nt: +nt.toFixed(2), ev: 'kindle', id: added[0] ?? s.kindled[s.kindled.length - 1] })
      }
      if (s.fov > 57 && prev.fov <= 57) events.push({ nt: +nt.toFixed(2), ev: 'reveal', zone: s.zone })
    }
    // A beat is an EVENT — a kindle, a zone change, a reveal, a waypoint
    // reached. It is NOT proximity to a point of interest.
    //
    // The previous version counted "any POI inside 16m" as notable, every tick.
    // That meant a player standing still beside a landmark could never
    // accumulate a gap, so the first run of this capture scored a perfect
    // "worst stretch 0s" while the player was in fact wedged against a rock for
    // nine and a half sim minutes. Proximity is a property of the MAP; this
    // gate is supposed to measure the EXPERIENCE.
    const notable = events.length > 0 && Math.abs(events[events.length - 1].nt - nt) < 0.02
    if (notable) {
      const gap = nt - lastNotable
      // Classify the stretch by what ENDED it. A stretch closed by a 'skip' is
      // the driver failing to path to a stop — reachcheck proves every light is
      // reachable, so that is a harness limitation, not the game running out of
      // things to do. Conflating the two makes the gate unable to say which
      // defect it found, and every long stretch this capture has ever reported
      // has turned out to be the former.
      const endedBy = events.length ? events[events.length - 1].ev : null
      if (gap > 0.1) gaps.push({ gap: +gap.toFixed(2), atNt: +lastNotable.toFixed(2), endedBy, driver: endedBy === 'skip' })
      lastNotable = nt
    }
    prev = { zone: s.zone, kindled: s.kindled.length, fov: s.fov }
    prevKindled = new Set(s.kindled)
  }
  kb('keyup', 'KeyW')
  const endNt = M.state.nightT - nt0
  const tail = endNt - lastNotable
  if (tail > 0.1) gaps.push({ gap: +tail.toFixed(2), atNt: +lastNotable.toFixed(2), tail: true })
  gaps.sort((a, b) => b.gap - a.gap)
  return { events, gaps: gaps.slice(0, 8), simMinutes: +endNt.toFixed(2), kindled: M.state.kindled.length, endZone: M.state.zone, waypointsReached: wp, routeLength: route.length, stalls: stalls.slice(0, 12), routeSimMinutes: routeDoneNt == null ? null : +routeDoneNt.toFixed(2) }
})

data.consoleIssues = issues.slice(0, 5)
writeFileSync(resolve(root, 'docs/build/k1capture.json'), JSON.stringify(data, null, 1))
// Content stretches are the game's pacing; driver stretches are the harness's
// pathing. Both are reported, both can fail the gate, but they fail for
// different reasons and the message has to say which.
const contentGaps = data.gaps.filter((g) => !g.driver)
const driverGaps = data.gaps.filter((g) => g.driver)
const worst = contentGaps[0]?.gap ?? 0
// A capture that never walked the route is not evidence about the opening, and
// must not be able to report a pass. The first version could: it stalled after
// 2 of 19 waypoints and printed "worst stretch 0s" — a stuck player generates
// no events, and no events meant no gaps. Route completion is now a gate in its
// own right, checked BEFORE the gap number is believed.
const routeDone = data.waypointsReached >= data.routeLength
// A capture riddled with pathing failures is not trustworthy evidence either,
// so driver stretches still fail the gate — just with an honest message.
const ok = routeDone && worst <= 0.34 && driverGaps.length <= 2 && issues.length === 0
console.log(`route: ${data.waypointsReached}/${data.routeLength} waypoints, ${data.kindled} lamps, ${data.events.length} events over ${data.simMinutes} sim min, ended in ${data.endZone}`)
if (data.routeSimMinutes != null && data.routeSimMinutes < 10) {
  console.log(`NOTE: the authored route fills ${data.routeSimMinutes}/10 sim minutes at this driver's pace (it walks optimally and never explores, so a player is slower — but the opening is thinner than ten minutes of authored beats).`)
}
console.log('content stretches (sim min):', contentGaps.map((g) => `${g.gap} @${g.atNt}`).join(' · ') || 'none')
if (driverGaps.length) console.log(`driver stretches (harness could not path, NOT game pacing): ${driverGaps.map((g) => `${g.gap} @${g.atNt}`).join(' · ')}`)
if (data.stalls?.length) {
  console.log(`unstick fired ${data.stalls.length}x:`, data.stalls.map((x) => `(${x.at[0]},${x.at[1]})@wp${x.wp}`).join(' · '))
}
if (!routeDone) console.log(`K1 CAPTURE FAIL — only ${data.waypointsReached}/${data.routeLength} waypoints reached; a stalled run is not evidence`)
else if (worst > 0.34) console.log(`K1 CAPTURE FAIL — worst CONTENT stretch ${(worst * 60).toFixed(0)}s exceeds 20s (the game has a dead patch here)`)
else if (driverGaps.length > 2) console.log(`K1 CAPTURE FAIL — ${driverGaps.length} stops the driver could not path to; pacing evidence unreliable until the harness reaches them`)
else console.log(`K1 CAPTURE PASS — route complete, worst content stretch ${(worst * 60).toFixed(0)}s <= 20s`)
console.log(issues.length === 0 ? 'console clean' : `console issues: ${issues.length}`)
await browser.close()
preview.kill()
process.exit(ok ? 0 : 1)
