#!/usr/bin/env node
import { spawn } from 'node:child_process'
import { resolve } from 'node:path'
import { chromium } from 'playwright'
const root = '/home/user/gh-studio'
const PORT = 4199
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
  const F = (s, i) => s.fighters[i]
  const step = (a, b) => M.fight.step({ 0: a ?? {}, 1: b ?? {} })
  const log = []
  let s = step(), guard = 0, lastKo = 0
  while (!s.over && guard++ < 30000) {
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
    if (s.events.some((e) => e.t === 'ko')) { log.push({ guard, kos: s.events.filter((e) => e.t === 'ko').map((e) => e.id), s0: F(s, 0).stocks, s1: F(s, 1).stocks }); lastKo = guard }
    if (guard % 5000 === 0) log.push({ guard, p0: { x: +p0.x.toFixed(1), y: +p0.y.toFixed(1), st: p0.stocks, ko: p0.ko }, p1: { x: +p1.x.toFixed(1), y: +p1.y.toFixed(1), st: p1.stocks, ko: p1.ko, inv: p1.invuln, launched: p1.launched } })
  }
  return { over: s.over, winner: s.winner, guard, log: log.slice(0, 30) }
})
console.log(JSON.stringify(out, null, 1))
await browser.close(); preview.kill()
