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
  // the authored opening route: park ritual → east road → Emberwick lamps →
  // and back west into the shrine country (fills the full ten minutes)
  const villageLights = M.lights.filter((l) => l.zone === 'village').slice(0, 4).map((l) => ({ x: l.x, z: l.z, light: true }))
  const route = [
    { x: 4.2, z: -19.2, light: true },   // Beldam's bench lamp (her pointer)
    { x: 17.7, z: 9.0, light: true },    // park lantern 1
    { x: -17.7, z: 9.0, light: true },   // park lantern 2
    { x: 24, z: 0 },                     // the fingerpost fork
    { x: 40, z: 0 }, { x: 60, z: 0 },    // the east road (crumb country)
    { x: 72, z: 1 }, { x: 88, z: 2 },    // into the street
    ...villageLights,
    { x: 137, z: 4 },                    // the gate landmark
    // the return: back down the street, out west to the wayside shrines
    { x: 100, z: 2 }, { x: 72, z: 1 }, { x: 40, z: 0 }, { x: 24, z: 0 },
    { x: -6, z: 20 }, { x: -36, z: 34 },
    { x: -52, z: 42, light: true },      // wayside shrine 1 (deep amber)
    { x: -34, z: 22 },                   // the memorial stone
    { x: 0, z: 0 },                      // the park heart
  ]
  const events = []
  let wp = 0, prev = null, channelStart = null
  // Stuck handling. A pure seek driver presses W into whatever it hits and
  // never stops — the first run of this capture sat at one position for 1800
  // ticks while the controller reported 5.2 m/s. Even with the world's pinch
  // traps sealed, a concave corner can still trap a dumb seek, so the driver
  // needs to notice and go around.
  let bestD = Infinity, noProgress = 0, sidestep = 0, sidestepKey = 'KeyD'
  let wpStartNt = 0
  const stalls = []
  const nt0 = M.state.nightT
  let lastNotable = 0
  const gaps = []
  kb('keydown', 'KeyW')
  while (true) {
    await new Promise((r) => setTimeout(r, 100))
    const s = M.state
    const nt = s.nightT - nt0
    if (nt >= 10) break // the full ten minutes — route exhaustion just idles at the park heart
    const t = route[Math.min(wp, route.length - 1)]
    const dx = t.x - s.playerPos[0], dz = t.z - s.playerPos[2]
    const d = Math.hypot(dx, dz)

    // --- unstick ---
    if (!channelStart) {
      // PROGRESS, not motion. A player pressed against an obstacle still slides
      // along it, so "did the position change?" reports healthy movement while
      // the run goes nowhere — that micro-jitter defeated the first version of
      // this check. What matters is whether the target is getting closer.
      if (d < bestD - 0.25) { bestD = d; noProgress = 0 } else noProgress++
      if (noProgress > 25 && sidestep <= 0) {
        // wedged: strafe along the obstacle for a beat, alternating sides so a
        // corner that defeats one direction gets the other next time
        sidestep = 30
        sidestepKey = sidestepKey === 'KeyD' ? 'KeyA' : 'KeyD'
        stalls.push({ nt: +nt.toFixed(2), at: [+s.playerPos[0].toFixed(2), +s.playerPos[2].toFixed(2)], wp })
        kb('keydown', sidestepKey)
        noProgress = 0
      }
      if (sidestep > 0 && --sidestep === 0) kb('keyup', sidestepKey)
      // steer toward the waypoint (but not while strafing free of an obstacle)
      if (sidestep === 0) M.setCamYaw(Math.atan2(-dx, -dz))
    }

    // a waypoint that cannot be reached must not eat the whole capture
    if (!channelStart && nt - wpStartNt > 1.2 && wp < route.length) {
      events.push({ nt: +nt.toFixed(2), ev: 'skip', at: [t.x, t.z] })
      wp++; wpStartNt = nt; bestD = Infinity; noProgress = 0
      if (sidestep > 0) { kb('keyup', sidestepKey); sidestep = 0 }
    }
    if (d < 1.8 && wp < route.length) { // inside interact range (2.0), not outside it
      if (t.light && !channelStart) {
        kb('keyup', 'KeyW')
        kb('keydown', 'KeyE')
        channelStart = nt
      } else if (!t.light) {
        events.push({ nt: +nt.toFixed(2), ev: 'waypoint', at: [t.x, t.z] })
        wp++; wpStartNt = nt; bestD = Infinity; noProgress = 0
      }
    }
    if (channelStart != null) {
      if (prev && s.kindled.length > prev.kindled) {
        kb('keyup', 'KeyE')
        kb('keydown', 'KeyW')
        channelStart = null
        wp++; wpStartNt = nt; bestD = Infinity; noProgress = 0
      } else if (nt - channelStart > 0.2) { // ~12s sim without a kindle: move on
        kb('keyup', 'KeyE')
        kb('keydown', 'KeyW')
        channelStart = null
        wp++; wpStartNt = nt; bestD = Infinity; noProgress = 0
      }
    }
    if (prev) {
      if (s.zone !== prev.zone) events.push({ nt: +nt.toFixed(2), ev: 'zone', to: s.zone })
      if (s.kindled.length > prev.kindled) events.push({ nt: +nt.toFixed(2), ev: 'kindle', id: s.kindled[s.kindled.length - 1] })
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
      if (gap > 0.1) gaps.push({ gap: +gap.toFixed(2), atNt: +lastNotable.toFixed(2) })
      lastNotable = nt
    }
    prev = { zone: s.zone, kindled: s.kindled.length, fov: s.fov }
  }
  kb('keyup', 'KeyW')
  const endNt = M.state.nightT - nt0
  const tail = endNt - lastNotable
  if (tail > 0.1) gaps.push({ gap: +tail.toFixed(2), atNt: +lastNotable.toFixed(2), tail: true })
  gaps.sort((a, b) => b.gap - a.gap)
  return { events, gaps: gaps.slice(0, 8), simMinutes: +endNt.toFixed(2), kindled: M.state.kindled.length, endZone: M.state.zone, waypointsReached: wp, routeLength: route.length, stalls: stalls.slice(0, 12) }
})

data.consoleIssues = issues.slice(0, 5)
writeFileSync(resolve(root, 'docs/build/k1capture.json'), JSON.stringify(data, null, 1))
const worst = data.gaps[0]?.gap ?? 0
// A capture that never walked the route is not evidence about the opening, and
// must not be able to report a pass. The first version could: it stalled after
// 2 of 19 waypoints and printed "worst stretch 0s" — a stuck player generates
// no events, and no events meant no gaps. Route completion is now a gate in its
// own right, checked BEFORE the gap number is believed.
const routeDone = data.waypointsReached >= data.routeLength
const ok = routeDone && worst <= 0.34 && issues.length === 0
console.log(`route: ${data.waypointsReached}/${data.routeLength} waypoints, ${data.kindled} lamps, ${data.events.length} events over ${data.simMinutes} sim min, ended in ${data.endZone}`)
console.log('worst stretches (sim min):', data.gaps.map((g) => `${g.gap} @${g.atNt}`).join(' · ') || 'none')
if (data.stalls?.length) {
  console.log(`unstick fired ${data.stalls.length}x:`, data.stalls.map((x) => `(${x.at[0]},${x.at[1]})@wp${x.wp}`).join(' · '))
}
if (!routeDone) console.log(`K1 CAPTURE FAIL — only ${data.waypointsReached}/${data.routeLength} waypoints reached; a stalled run is not evidence`)
else console.log(worst <= 0.34 ? `K1 CAPTURE PASS — route complete, worst stretch ${(worst * 60).toFixed(0)}s <= 20s` : `K1 CAPTURE FAIL — worst stretch ${(worst * 60).toFixed(0)}s exceeds 20s`)
console.log(issues.length === 0 ? 'console clean' : `console issues: ${issues.length}`)
await browser.close()
preview.kill()
process.exit(ok ? 0 : 1)
