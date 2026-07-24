#!/usr/bin/env node
// M2 gate: interact prompt range, channel interrupt, kindle flow triptych,
// audio layer response, moon arc. Permanent tooling (judge passes reuse it).

import { spawn } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const dir = resolve(root, 'docs/build/shots/kindle')
mkdirSync(dir, { recursive: true })
const PORT = 4175

const preview = spawn(resolve(root, 'node_modules/.bin/vite'), ['preview', '--port', String(PORT), '--strictPort'], { cwd: root, stdio: 'ignore' })
await new Promise((r) => setTimeout(r, 2500))
const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium',
  args: ['--no-sandbox', '--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--autoplay-policy=no-user-gesture-required'],
})
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } })
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
await page.waitForTimeout(800)

let fails = 0
const check = (name, ok, detail) => { console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ' — ' + detail : ''}`); if (!ok) fails++ }
const S = () => page.evaluate(() => window.__MOONREST__.state)

// boot audio via real gesture path
await page.keyboard.press('q')
await page.waitForTimeout(400)
let st = await S()
check('audio engine started', st.audio.started, JSON.stringify(st.audio))

// 1) prompt appears <2m, absent >2m (bench lamp at 4.2,-19.2)
await page.evaluate(() => window.__MOONREST__.teleportPlayer(4.2, -17.8, Math.PI)) // 1.4m away
await page.waitForTimeout(700)
let promptOn = await page.evaluate(() => document.querySelector('#ui .prompt').classList.contains('on'))
check('prompt visible at 1.4m', promptOn)
await page.locator('body').screenshot({ path: resolve(dir, 'prompt-near.png') })
await page.evaluate(() => window.__MOONREST__.teleportPlayer(4.2, -14.5, Math.PI)) // 4.7m away
await page.waitForTimeout(700)
promptOn = await page.evaluate(() => document.querySelector('#ui .prompt').classList.contains('on'))
check('prompt hidden at 4.7m', !promptOn)

// 2) channel interrupt: hold E 0.5s then release → no kindle
await page.evaluate(() => window.__MOONREST__.teleportPlayer(4.2, -17.8, Math.PI))
await page.waitForTimeout(500)
await page.keyboard.down('e')
await page.waitForTimeout(500)
await page.locator('body').screenshot({ path: resolve(dir, 'during-channel.png') })
await page.keyboard.up('e')
await page.waitForTimeout(300)
st = await S()
let log = await page.evaluate(() => window.__MOONREST__.interactLog)
check('channel interrupt logged, no kindle', st.kindled.length === 0 && log.some((l) => l.event === 'channel-interrupt'), JSON.stringify(log))

// 3) full kindle: before/after shots + state + audio layers
await page.locator('body').screenshot({ path: resolve(dir, 'before.png') })
const rmsBefore = st.audio.rms?.music ?? 0
await page.keyboard.down('e')
// hold until the game confirms — the channel needs 1.2s of SIMULATED time,
// and headless frame pacing (esp. right after a screenshot) can stretch how
// much wall clock that takes
await page.waitForFunction(() => window.__MOONREST__.state.kindled.includes('park-bench-lamp'), null, { timeout: 20000 }).catch(() => {})
await page.keyboard.up('e')
await page.waitForTimeout(1200) // bloom halfway
await page.locator('body').screenshot({ path: resolve(dir, 'after.png') })
st = await S()
log = await page.evaluate(() => window.__MOONREST__.interactLog)
check('kindled registered', st.kindled.includes('park-bench-lamp'), JSON.stringify(st.kindled) + ' log=' + JSON.stringify(log))
check('music layers = 2 after 1 kindle (base+1)', st.audio.layers === 2, `layers=${st.audio.layers}`)

// 4) persistence: walk away and back
await page.evaluate(() => window.__MOONREST__.teleportPlayer(0, 10, 0))
await page.waitForTimeout(400)
await page.evaluate(() => window.__MOONREST__.teleportPlayer(4.2, -17.8, Math.PI))
await page.waitForTimeout(400)
st = await S()
check('kindle persists', st.kindled.includes('park-bench-lamp'))

// 5) audio actually sounding: music bus RMS > 0 after layers active
await page.waitForTimeout(2500)
st = await S()
check('music bus RMS > 0', (st.audio.rms?.music ?? 0) > 0.0005, `rms=${JSON.stringify(st.audio.rms)}`)
// the ambience beds (9.3) must actually SOUND — a silent ambience bus was a
// shipped defect once; this assert keeps it dead
check('ambience bus RMS > 0 (beds live)', (st.audio.rms?.ambience ?? 0) > 0.0003, `rms=${JSON.stringify(st.audio.rms)}`)

// 6) remaining lights kindle via API (counter math)
await page.evaluate(() => { window.__MOONREST__.kindle('park-lantern-1'); window.__MOONREST__.kindle('park-lantern-2'); window.__MOONREST__.kindle('park-firefly-jar') })
await page.waitForTimeout(2500)
st = await S()
check('all 4 park lights kindled', st.kindled.length === 4, JSON.stringify(st.kindled))
check('layers capped at zone max (4)', st.audio.layers === 4, `layers=${st.audio.layers}`)

// 7) moon arc: skipTo shots
await page.evaluate(() => { window.__MOONREST__.teleport('park'); window.__MOONREST__.skipTo(4) })
await page.waitForTimeout(500)
await page.locator('#game').screenshot({ path: resolve(dir, 'moon-early.png') })
await page.evaluate(() => window.__MOONREST__.skipTo(36))
await page.waitForTimeout(500)
await page.locator('#game').screenshot({ path: resolve(dir, 'moon-late.png') })
st = await S()
check('nightT tracks skipTo', Math.abs(st.nightT - 36) < 0.2, `nightT=${st.nightT}`)

check('console clean', issues.length === 0, issues.slice(0, 3).join(' | '))
console.log(fails === 0 ? 'KINDLE CHECK PASS' : `KINDLE CHECK: ${fails} FAILURES`)
await browser.close()
preview.kill()
process.exit(fails === 0 ? 0 : 1)
