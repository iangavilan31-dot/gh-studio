#!/usr/bin/env node
// probe: tick-by-tick trace of the light-hit knockback travel
import { spawn } from 'node:child_process'
import { resolve } from 'node:path'
import { chromium } from 'playwright'
const root = '/home/user/gh-studio'
const PORT = 4197
const preview = spawn(resolve(root, 'node_modules/.bin/vite'), ['preview', '--port', String(PORT), '--strictPort'], { cwd: root, stdio: 'ignore' })
await new Promise((r) => setTimeout(r, 2500))
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--enable-unsafe-swiftshader', '--use-angle=swiftshader'] })
const page = await browser.newPage({ viewport: { width: 640, height: 360 } })
await page.addInitScript(() => { window.__NIGHT_SEED__ = 42; window.__FIGHT_MANUAL__ = true })
await page.goto(`http://localhost:${PORT}/`)
await page.waitForFunction(() => window.__MOONREST__?.ready)
const out = await page.evaluate(() => {
  const M = window.__MOONREST__
  M.fight.enter('beldam', 2)
  const step = (a, b) => M.fight.step({ 0: a ?? {}, 1: b ?? {} })
  for (let k = 0; k < 60; k++) step()
  let s = step(), g = 0
  while (Math.abs(s.fighters[1].x - s.fighters[0].x) > 1.7 && g++ < 240)
    s = step({ x: s.fighters[1].x > s.fighters[0].x ? 1 : -1 }, { x: s.fighters[0].x > s.fighters[1].x ? 1 : -1 })
  const trace = []
  const T = (s2, i) => { const f = s2.fighters[1]; trace.push({ i, x: +f.x.toFixed(2), y: +f.y.toFixed(2), vx: +f.vx.toFixed(2), vy: +f.vy.toFixed(2), hs: f.hitstop, ln: f.launched, gr: f.grounded, ev: s2.events.map((e) => e.t).join(',') }) }
  s = step({ light: true, x: 1 }); T(s, 0)
  for (let j = 1; j <= 26; j++) { s = step(); T(s, j) }
  return trace
})
for (const r of out) console.log(JSON.stringify(r))
await browser.close(); preview.kill()
