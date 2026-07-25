#!/usr/bin/env node
import { spawn } from 'node:child_process'
import { resolve } from 'node:path'
import { chromium } from 'playwright'
const root = '/home/user/gh-studio'
const PORT = 4196
const preview = spawn(resolve(root, 'node_modules/.bin/vite'), ['preview', '--port', String(PORT), '--strictPort'], { cwd: root, stdio: 'ignore' })
await new Promise((r) => setTimeout(r, 2500))
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--enable-unsafe-swiftshader', '--use-angle=swiftshader'] })
const page = await browser.newPage({ viewport: { width: 640, height: 360 } })
await page.addInitScript(() => { window.__NIGHT_SEED__ = 42; window.__FIGHT_MANUAL__ = true })
await page.goto(`http://localhost:${PORT}/`)
await page.waitForFunction(() => window.__MOONREST__?.ready)
const out = await page.evaluate(() => {
  const M = window.__MOONREST__
  const okEnter = M.fight.enter('beldam', 2, null, ['lamplighter', 'beldam'])
  const hasDuel = typeof M.fight.botDuel
  let r = null, err = null
  try { r = M.fight.botDuel('lucid', 'dozy', 14400) } catch (e) { err = String(e) }
  const s = M.fight.state()
  return { okEnter, hasDuel, r, err, f: s?.fighters?.map((f) => ({ fid: f.fid, x: +f.x.toFixed(1), y: +f.y.toFixed(1), stocks: f.stocks, wooze: f.wooze })) }
})
console.log(JSON.stringify(out, null, 1))
await browser.close(); preview.kill()
