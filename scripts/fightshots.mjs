#!/usr/bin/env node
// DREAMSCRAP money shots: manual-stepped to exact sim moments, then the
// live render loop draws them (particles drift in real time — hitstop law).
import { spawn } from 'node:child_process'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const PORT = 4195
const preview = spawn(resolve(root, 'node_modules/.bin/vite'), ['preview', '--port', String(PORT), '--strictPort'], { cwd: root, stdio: 'ignore' })
await new Promise((r) => setTimeout(r, 2500))
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--enable-unsafe-swiftshader', '--use-angle=swiftshader'] })
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } })
await page.addInitScript(() => { window.__NIGHT_SEED__ = 42; window.__FIGHT_MANUAL__ = true })
const issues = []
page.on('pageerror', (e) => issues.push(e.message))
await page.goto(`http://localhost:${PORT}/`)
await page.waitForFunction(() => window.__MOONREST__?.ready)
const shot = async (name) => { await page.waitForTimeout(400); await page.locator('#game').screenshot({ path: `${root}/docs/build/shots/dream/${name}.png` }) }

await page.evaluate(() => window.__MOONREST__.fight.enter('beldam', 2))
// mid-fight: an exchange with wooze on the bottles
await page.evaluate(() => {
  const M = window.__MOONREST__
  const step = (a, b) => M.fight.step({ 0: a ?? {}, 1: b ?? {} })
  for (let k = 0; k < 90; k++) step()
  let s = step()
  let g = 0
  while (Math.abs(s.fighters[1].x - s.fighters[0].x) > 1.9 && g++ < 200) s = step({ x: s.fighters[1].x > s.fighters[0].x ? 1 : -1 }, { x: -1 })
  for (let k = 0; k < 3; k++) { step({ light: true }); for (let j = 0; j < 20; j++) step() }
  // freeze mid-swing for the frame
  step({ heavy: true }, {})
  for (let k = 0; k < 14; k++) step({}, {})
})
await shot('fight')
// the KO moment: drive to a KO, hold 2 ticks after (moths just burst)
await page.evaluate(() => {
  const M = window.__MOONREST__
  const step = (a, b) => M.fight.step({ 0: a ?? {}, 1: b ?? {} })
  let s = step(), g = 0, done = false
  while (!done && g++ < 20000) {
    const p0 = s.fighters[0], p1 = s.fighters[1]
    if (p1.ko > 0) { done = true; break }
    const dx = p1.x - p0.x, dy = p1.y - p0.y
    let p2 = {}
    if (!(p1.launched > 0 || p1.invuln > 60 || p1.ko > 0)) {
      if (dy < -1.6) p2 = {}
      else if (Math.abs(dx) > 3) p2 = { x: p0.x > p1.x ? 1 : -1 }
    }
    if (Math.abs(dx) > 1.9) s = step({ x: dx > 0 ? (p0.x > 11 ? 0 : 1) : (p0.x < -11 ? 0 : -1) }, p2)
    else s = step({ heavy: g % 8 < 4, x: Math.abs(dx) > 0.2 ? (dx > 0 ? 1 : -1) : 0 }, p2)
    if (s.events.some((e) => e.t === 'ko')) done = true
  }
})
await shot('ko-moths')
// respawn ride: step into the middle of the descent
await page.evaluate(() => { const M = window.__MOONREST__; for (let k = 0; k < 40; k++) M.fight.step({}) })
await shot('respawn-moon')
await browser.close(); preview.kill()
console.log(issues.length ? 'ISSUES: ' + issues.slice(0, 2).join('|') : 'FIGHTSHOTS COMPLETE (console clean)')
