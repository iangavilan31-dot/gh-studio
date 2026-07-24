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
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } })
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
    if (!channelStart) M.setCamYaw(Math.atan2(-dx, -dz)) // steer toward the waypoint
    if (d < 1.8 && wp < route.length) { // inside interact range (2.0), not outside it
      if (t.light && !channelStart) {
        kb('keyup', 'KeyW')
        kb('keydown', 'KeyE')
        channelStart = nt
      } else if (!t.light) {
        events.push({ nt: +nt.toFixed(2), ev: 'waypoint', at: [t.x, t.z] })
        wp++
      }
    }
    if (channelStart != null) {
      if (prev && s.kindled.length > prev.kindled) {
        kb('keyup', 'KeyE')
        kb('keydown', 'KeyW')
        channelStart = null
        wp++
      } else if (nt - channelStart > 0.2) { // ~12s sim without a kindle: move on
        kb('keyup', 'KeyE')
        kb('keydown', 'KeyW')
        channelStart = null
        wp++
      }
    }
    if (prev) {
      if (s.zone !== prev.zone) events.push({ nt: +nt.toFixed(2), ev: 'zone', to: s.zone })
      if (s.kindled.length > prev.kindled) events.push({ nt: +nt.toFixed(2), ev: 'kindle', id: s.kindled[s.kindled.length - 1] })
      if (s.fov > 57 && prev.fov <= 57) events.push({ nt: +nt.toFixed(2), ev: 'reveal', zone: s.zone })
    }
    // notable: an event this tick, or any POI inside 16m
    let notable = events.length > 0 && Math.abs(events[events.length - 1].nt - nt) < 0.02
    if (!notable) {
      for (const poi of pois) {
        if (Math.hypot(poi.x - s.playerPos[0], poi.z - s.playerPos[2]) < 16) { notable = true; break }
      }
    }
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
  return { events, gaps: gaps.slice(0, 8), simMinutes: +endNt.toFixed(2), kindled: M.state.kindled.length, endZone: M.state.zone, waypointsReached: wp }
})

data.consoleIssues = issues.slice(0, 5)
writeFileSync(resolve(root, 'docs/build/k1capture.json'), JSON.stringify(data, null, 1))
const worst = data.gaps[0]?.gap ?? 0
console.log(`route: ${data.waypointsReached} waypoints, ${data.kindled} lamps, ${data.events.length} events over ${data.simMinutes} sim min, ended in ${data.endZone}`)
console.log('worst stretches (sim min):', data.gaps.map((g) => `${g.gap} @${g.atNt}`).join(' · ') || 'none')
console.log(worst <= 0.34 ? `K1 CAPTURE PASS — worst stretch ${(worst * 60).toFixed(0)}s <= 20s` : `K1 CAPTURE: worst stretch ${(worst * 60).toFixed(0)}s exceeds 20s`)
console.log(issues.length === 0 ? 'console clean' : `console issues: ${issues.length}`)
await browser.close()
preview.kill()
process.exit(worst <= 0.34 && issues.length === 0 ? 0 : 1)
