#!/usr/bin/env node
// M6 gate: the full-night autopilot (12.1 M6). Kindles all 37 lights zone by
// zone, collects all 12 brews, finishes on the keep brazier → Night's End reel
// → title card → stats → reset; then verifies persistence across the reload.

import { spawn } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const dir = resolve(root, 'docs/build/shots')
mkdirSync(dir, { recursive: true })
const PORT = 4178

const preview = spawn(resolve(root, 'node_modules/.bin/vite'), ['preview', '--port', String(PORT), '--strictPort'], { cwd: root, stdio: 'ignore' })
await new Promise((r) => setTimeout(r, 2500))
const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium',
  args: ['--no-sandbox', '--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--autoplay-policy=no-user-gesture-required'],
})
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } })
await page.addInitScript(() => { window.__NIGHT_SEED__ = 42 }) // D.1: rigs run a pinned night signature
  // Behavior gate: run the light 480x270 retro pipeline — headless software
  // raster can't do native-res Restored at playable frame times, and this
  // gate tests mechanics, not the renderer (Restored is covered by the
  // shoot/hue/shell/perf gates).
  await page.addInitScript(() => {
    try { localStorage.setItem('moonrest-settings-v1', JSON.stringify({ settingsV: 2, memoryMode: 'n64', resScale: 1 })) } catch (e) {}
  })
const issues = []
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') issues.push(m.text()) })
page.on('pageerror', (e) => issues.push(e.message))
await page.goto(`http://localhost:${PORT}/`)
await page.waitForFunction(() => window.__MOONREST__?.ready)
await page.evaluate(() => localStorage.clear()) // a fresh first night
await page.reload()
await page.waitForFunction(() => window.__MOONREST__?.ready)
await page.keyboard.press('q') // audio gesture
await page.waitForTimeout(600)

let fails = 0
const check = (name, ok, detail) => { console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ' — ' + detail : ''}`); if (!ok) fails++ }

// run the autopilot (it self-paces; ~25s of teleport-hops)
await page.evaluate(() => { window.__MOONREST__.autopilot() })
await page.waitForFunction(() => window.__MOONREST__.state.nightEnded, null, { timeout: 90000 }).catch(() => {})
const st1 = await page.evaluate(() => window.__MOONREST__.state)
check('night ended (keep brazier finale)', st1.nightEnded === true, `nightEnded=${st1.nightEnded}`)
check('all 37 lights kindled', st1.kindled.length === 37, `${st1.kindled.length}/37`)
check('all 12 brews collected', st1.brews === 12, `${st1.brews}/12`)
check('8 zone trinkets + Gatewalkers arch-stone granted', st1.trinketCount === 9, `${st1.trinketCount}`) // the route walks under the arch

const beats = await page.evaluate(() => window.__MOONREST__.beats)
const stirs = await page.evaluate(() => window.__MOONREST__.stirLog)
const kindleBeats = beats.filter((b) => b.kind === 'kindle').length
const zoneBeats = beats.filter((b) => b.kind === 'zone-complete').map((b) => b.detail)
check('beat log: 37 kindles', kindleBeats === 37, `${kindleBeats}`)
check('beat log: 8 zone completions', zoneBeats.length === 8, zoneBeats.join(','))
check('stir log: 8 zones stirred', stirs.length === 8, stirs.map((s) => s.zone).join(','))
check('beat log: brews-complete fired', beats.some((b) => b.kind === 'brews-complete'))

// the reel: wait for the title card, screenshot the stats
// headless sim time runs ~0.4x wall (dt clamp on slow frames) — the reel needs the long leash
await page.waitForFunction(() => document.querySelector('#ui .nightcard')?.classList.contains('on'), null, { timeout: 240000 }).catch(() => {})
const cardOn = await page.evaluate(() => document.querySelector('#ui .nightcard')?.classList.contains('on'))
check('title card shown after dolly reel', cardOn === true)
await page.locator('body').screenshot({ path: resolve(dir, 'nights-end.png') })
const nightLog = await page.evaluate(() => window.__MOONREST__.nightLog)
check('night log: reel → card sequence', nightLog.some((l) => l.event === 'nights-end') && nightLog.some((l) => l.event === 'title-card'), JSON.stringify(nightLog.map((l) => l.event)))

// the reset: the page reloads itself; wait for the new night and check persistence
await page.waitForFunction(() => window.__MOONREST__?.ready && !window.__AUTOPILOT_RUNNING__, null, { timeout: 90000 }).catch(() => {})
await page.waitForTimeout(1500)
const st2 = await page.evaluate(() => window.__MOONREST__.state)
check('new night: lights reset cold', st2.kindled.length === 0, `${st2.kindled.length}`)
check('persist: brews stay collected (12)', st2.brews === 12, `${st2.brews}`)
check('persist: trinkets survive (9)', st2.trinketCount === 9, `${st2.trinketCount}`)

check('console clean', issues.length === 0, issues.slice(0, 3).join(' | '))
console.log(fails === 0 ? 'AUTOPILOT CHECK PASS' : `AUTOPILOT CHECK: ${fails} FAILURES`)
await browser.close()
preview.kill()
process.exit(fails === 0 ? 0 : 1)
