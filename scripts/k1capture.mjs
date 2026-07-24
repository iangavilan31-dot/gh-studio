#!/usr/bin/env node
// K.1 first-ten-minutes capture: a PLAYER-STYLE session — the authored intro
// hands off to a seeded wander that wanders the roads, stops at cold lights
// and channels them, logging a timestamped event stream. The K question:
// does any sim stretch go dead (no encounter, no event) for 20s+?
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
  const events = []
  const kb = (type, code) => window.dispatchEvent(new KeyboardEvent(type, { code, bubbles: true }))
  // deterministic wander (mulberry32) with kindle stops — a player, not a rig
  let seed = 0x51ab1e
  const rand = () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296 }
  let yaw = 2.6, yawT = 0
  const nt0 = M.state.nightT
  let prev = null
  let lastNotable = 0 // sim-min since start
  const gaps = []
  let channelingSince = null
  kb('keydown', 'KeyW')
  while (true) {
    await new Promise((r) => setTimeout(r, 100))
    const s = M.state
    const nt = s.nightT - nt0
    if (nt >= 10) break
    yawT -= 0.1
    if (yawT <= 0 && !channelingSince) { yawT = 2 + rand() * 3; yaw += (rand() - 0.5) * 2.0; M.setCamYaw(yaw) }
    // events from state deltas
    if (prev) {
      if (s.zone !== prev.zone) events.push({ nt: +nt.toFixed(2), ev: 'zone', to: s.zone })
      if (s.kindled.length > prev.kindled.length) events.push({ nt: +nt.toFixed(2), ev: 'kindle', id: s.kindled[s.kindled.length - 1], total: s.kindled.length })
      if (s.fov > 57 && prev.fov <= 57) events.push({ nt: +nt.toFixed(2), ev: 'reveal', zone: s.zone })
    }
    // a cold light nearby? stop and channel it like a player would
    const cold = M.lights.find((l) => !s.kindled.includes(l.id) && Math.hypot(l.x - s.playerPos[0], l.z - s.playerPos[2]) < 3.2)
    if (cold && !channelingSince) {
      kb('keyup', 'KeyW')
      kb('keydown', 'KeyE')
      channelingSince = nt
    }
    if (channelingSince != null) {
      if (prev && s.kindled.length > prev.kindled.length) {
        kb('keyup', 'KeyE')
        kb('keydown', 'KeyW')
        channelingSince = null
      } else if (nt - channelingSince > 0.12) { // ~7s sim: not kindling (out of reach) — move on
        kb('keyup', 'KeyE')
        kb('keydown', 'KeyW')
        channelingSince = null
      }
    }
    // notable = event this tick OR any POI within 16m
    let notable = events.length && Math.abs(events[events.length - 1].nt - nt) < 0.02
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
    // stuck escape
    if (prev && Math.hypot(s.playerPos[0] - prev.x, s.playerPos[2] - prev.z) < 0.02 && !channelingSince && s.speed < 0.2) {
      yaw += Math.PI * (0.6 + rand() * 0.5); M.setCamYaw(yaw)
    }
    prev = { zone: s.zone, kindled: s.kindled, fov: s.fov, x: s.playerPos[0], z: s.playerPos[2] }
  }
  kb('keyup', 'KeyW')
  const tail = (M.state.nightT - nt0) - lastNotable
  if (tail > 0.1) gaps.push({ gap: +tail.toFixed(2), atNt: +lastNotable.toFixed(2), tail: true })
  gaps.sort((a, b) => b.gap - a.gap)
  return { events, gaps: gaps.slice(0, 8), simMinutes: +(M.state.nightT - nt0).toFixed(2), kindled: M.state.kindled.length, endZone: M.state.zone }
})

data.consoleIssues = issues.slice(0, 5)
writeFileSync(resolve(root, 'docs/build/k1capture.json'), JSON.stringify(data, null, 1))
const worst = data.gaps[0]?.gap ?? 0
console.log(`walked ${data.simMinutes} sim minutes, ${data.events.length} events, ${data.kindled} lamps lit, ended in ${data.endZone}`)
console.log('worst dead stretches (sim min):', data.gaps.map((g) => `${g.gap} @${g.atNt}`).join(' · '))
console.log(worst <= 0.34 ? `K1 CAPTURE PASS — worst stretch ${(worst * 60).toFixed(0)}s <= 20s` : `K1 CAPTURE: worst stretch ${(worst * 60).toFixed(0)}s exceeds 20s`)
console.log(issues.length === 0 ? 'console clean' : `console issues: ${issues.length}`)
await browser.close()
preview.kill()
process.exit(worst <= 0.34 && issues.length === 0 ? 0 : 1)
