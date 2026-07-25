#!/usr/bin/env node
import { spawn } from 'node:child_process'
import { resolve } from 'node:path'
import { chromium } from 'playwright'
const root = '/home/user/gh-studio'
const PORT = 4198
const preview = spawn(resolve(root, 'node_modules/.bin/vite'), ['preview', '--port', String(PORT), '--strictPort'], { cwd: root, stdio: 'ignore' })
await new Promise((r) => setTimeout(r, 2500))
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--enable-unsafe-swiftshader', '--use-angle=swiftshader'] })
const page = await browser.newPage({ viewport: { width: 640, height: 360 } })
await page.addInitScript(() => { window.__NIGHT_SEED__ = 42; window.__FIGHT_MANUAL__ = true })
await page.goto(`http://localhost:${PORT}/`)
await page.waitForFunction(() => window.__MOONREST__?.ready)
const out = await page.evaluate(() => {
  const M = window.__MOONREST__
  M.fight.enter('beldam', 2, 99, ['lamplighter', 'mote'])
  const step = (a, b) => M.fight.step({ 0: a ?? {}, 1: b ?? {} })
  for (let k = 0; k < 60; k++) step()
  let s = step(), guard = 0
  while (s.fighters[0].deep < 100 && guard++ < 3000) {
    const dx = s.fighters[1].x - s.fighters[0].x
    if (Math.abs(dx) > 1.9) s = step({ x: Math.sign(dx) })
    else s = step({ heavy: guard % 8 < 4, x: Math.abs(dx) > 0.2 ? Math.sign(dx) : 0 })
  }
  const deepAt = s.fighters[0].deep
  // walk close then idle out
  let g = 0
  while (Math.abs(s.fighters[1].x - s.fighters[0].x) > 2.4 && g++ < 300) s = step({ x: s.fighters[1].x > s.fighters[0].x ? 1 : -1 })
  for (let j = 0; j < 10; j++) s = step()
  let idle = 0
  while ((s.fighters[0].move || s.fighters[0].hitstop > 0 || s.fighters[0].landlag > 0) && idle++ < 80) s = step()
  const pre = JSON.parse(JSON.stringify(s.fighters[0]))
  const trace = []
  s = step({ special: true })
  for (let k = 0; k < 10; k++) {
    trace.push({ mv: s.fighters[0].move, t: s.fighters[0].moveT, deep: s.fighters[0].deep, ev: s.events.map((e) => e.t).join(',') })
    s = step()
  }
  return { deepAt, guard, pre: { move: pre.move, deep: pre.deep, landlag: pre.landlag, launched: pre.launched, hitstop: pre.hitstop, grounded: pre.grounded }, trace }
})
console.log(JSON.stringify(out, null, 1))
await browser.close(); preview.kill()
