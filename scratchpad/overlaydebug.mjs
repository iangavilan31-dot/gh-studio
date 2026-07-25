#!/usr/bin/env node
import { spawn } from 'node:child_process'
import { resolve } from 'node:path'
import { chromium } from 'playwright'
const root = '/home/user/gh-studio'
const PORT = 4194
const preview = spawn(resolve(root, 'node_modules/.bin/vite'), ['preview', '--port', String(PORT), '--strictPort'], { cwd: root, stdio: 'ignore' })
await new Promise((r) => setTimeout(r, 2500))
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--enable-unsafe-swiftshader', '--use-angle=swiftshader'] })
const page = await browser.newPage({ viewport: { width: 960, height: 540 } })
await page.addInitScript(() => { window.__NIGHT_SEED__ = 42; window.__FIGHT_MANUAL__ = true })
await page.goto(`http://localhost:${PORT}/`)
await page.waitForFunction(() => window.__MOONREST__?.ready)
const out = await page.evaluate(() => {
  window.__FIGHT_HITBOXES__ = true
  const M = window.__MOONREST__
  const ok = M.fight.enter('beldam', 2)
  return { ok, flag: window.__FIGHT_HITBOXES__ }
})
console.log(JSON.stringify(out))
await page.waitForTimeout(800)
await page.locator('#game').screenshot({ path: root + '/scratchpad/overlay-probe.png' })
await browser.close(); preview.kill()
console.log('done')
