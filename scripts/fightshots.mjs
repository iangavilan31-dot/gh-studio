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
const shot = async (name, settle = 400) => { await page.waitForTimeout(settle); await page.locator('#game').screenshot({ path: `${root}/docs/build/shots/dream/${name}.png` }) }

// the P1-KOs-P2 driver proven in fightfeel F3 (pulse edges, face the target,
// P2 approaches only when far and steps off respawn shelves)
const DRIVER = `
  const M = window.__MOONREST__
  const F = (s, i) => s.fighters[i]
  const step = (a, b) => M.fight.step({ 0: a ?? {}, 1: b ?? {} })
  const drive = (until) => {
    let s = step(), guard = 0
    while (!until(s) && guard++ < 30000) {
      if (s.over) break
      const p0 = F(s, 0), p1 = F(s, 1)
      if (p1.ko > 0) { s = step(); continue }
      const dx = p1.x - p0.x, dy = p1.y - p0.y
      let p2inp = {}
      if (!(p1.launched > 0 || p1.invuln > 60 || p1.ko > 0)) {
        if (dy > 1.6) p2inp = { x: p1.x >= 0 ? 1 : -1 }
        else if (Math.abs(dx) > 3) {
          const w2 = p0.x > p1.x ? 1 : -1
          p2inp = { x: (w2 > 0 && p1.x > 11) || (w2 < 0 && p1.x < -11) ? 0 : w2 }
        }
      }
      if (Math.abs(dx) > 1.9 || dy > 1.6) {
        const want = dx > 0 ? 1 : -1
        const clamped = (want > 0 && p0.x > 11) || (want < 0 && p0.x < -11) ? 0 : want
        s = step({ x: clamped, jump: dy > 1.6 && guard % 2 === 0 }, p2inp)
      } else s = step({ heavy: guard % 8 < 4, x: Math.abs(dx) > 0.2 ? (dx > 0 ? 1 : -1) : 0 }, p2inp)
    }
    return s
  }
`

await page.evaluate(() => window.__MOONREST__.fight.enter('beldam', 2))
// let the upward rain and jar moths fill the frame before any capture
await page.waitForTimeout(2600)

// mid-fight: a heavy CONNECTS — both wizards frozen in hitstop center stage,
// rain and moths still drifting (Part 5's whole thesis in one frame)
await page.evaluate(() => {
  const M = window.__MOONREST__
  const step = (a, b) => M.fight.step({ 0: a ?? {}, 1: b ?? {} })
  for (let k = 0; k < 60; k++) step()
  const close = () => {
    let s = step(), g = 0
    while (Math.abs(s.fighters[1].x - s.fighters[0].x) > 1.7 && g++ < 240)
      s = step({ x: s.fighters[1].x > s.fighters[0].x ? 1 : -1 }, { x: s.fighters[0].x > s.fighters[1].x ? 1 : -1 })
    for (let j = 0; j < 10; j++) s = step() // brake: bleed the walk momentum
    return s
  }
  let s = close()
  // a light each way puts wooze in both bottles (sway + tinted HUD)
  let d = s.fighters[1].x - s.fighters[0].x
  step({ light: true, x: Math.sign(d) }); for (let j = 0; j < 26; j++) step()
  s = close(); d = s.fighters[1].x - s.fighters[0].x
  step({}, { light: true, x: -Math.sign(d) }); for (let j = 0; j < 26; j++) step()
  s = close(); d = s.fighters[1].x - s.fighters[0].x
  // the heavy: press once, let startup play out, stop two ticks INTO hitstop
  step({ heavy: true, x: Math.abs(d) > 0.2 ? Math.sign(d) : 0 })
  let g = 0
  while (g++ < 40) { s = step(); if (s.events.some((e) => e.t === 'hit')) break }
  step(); step()
})
await shot('fight')

// the KO moment: moths just burst at the blast edge
await page.evaluate(`(() => { ${DRIVER}
  drive((s) => s.events.some((e) => e.t === 'ko'))
  step(); step()
})()`)
await shot('ko-moths')

// respawn ride: mid-descent on the moon platform, shimmer up
await page.evaluate(() => { const M = window.__MOONREST__; for (let k = 0; k < 40; k++) M.fight.step({}) })
await shot('respawn-moon')

// the victory nap: drive the match to its end, then let the real-time
// victory scene play — winner lies down beside the loser (~3s in)
const end = await page.evaluate(`(() => { ${DRIVER}
  const s = drive((s2) => s2.over)
  return { over: s.over, winner: s.winner }
})()`)
if (!end.over) issues.push('victory driver never finished the match')
await shot('victory-nap', 3300)

await browser.close(); preview.kill()
console.log(issues.length ? 'ISSUES: ' + issues.slice(0, 2).join('|') : 'FIGHTSHOTS COMPLETE (console clean)')
