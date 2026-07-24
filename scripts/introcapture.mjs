#!/usr/bin/env node
// H.1 opening-sequence capture: loads the game fresh (no skip) and shoots
// the authored beats by polling intro.t — rain-black lift, the moon HOLD,
// the descent, the ignition (ember burst), the title handoff.
// Frames land in docs/build/shots/intro/.

import { spawn } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const outDir = resolve(root, 'docs/build/shots/intro')
mkdirSync(outDir, { recursive: true })
const PORT = 4189

const preview = spawn(resolve(root, 'node_modules/.bin/vite'), ['preview', '--port', String(PORT), '--strictPort'], { cwd: root, stdio: 'ignore' })
await new Promise((r) => setTimeout(r, 2500))

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium',
  args: ['--no-sandbox', '--enable-unsafe-swiftshader', '--use-angle=swiftshader'],
})
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } })
await page.addInitScript(() => {
  window.__NIGHT_SEED__ = 42
  try { localStorage.removeItem('moonrest-night-ended') } catch (e) {} // the ritual plays on fresh visits
})
const issues = []
page.on('pageerror', (e) => issues.push(e.message))

await page.goto(`http://localhost:${PORT}/`)
await page.waitForFunction(() => window.__MOONREST__?.ready)

// beats by intro-clock (sim seconds): rain-black lift end, the moon HOLD,
// mid-descent, Beldam approach, ignition, title blend
const beats = [
  { t: 2.6, name: 'rainblack-lift' },
  { t: 5.8, name: 'moon-hold' },
  { t: 10.2, name: 'descent' },
  { t: 14.0, name: 'beldam' },
  { t: 16.3, name: 'ignition' },
  { t: 18.2, name: 'title-blend' },
]
for (const b of beats) {
  const ok = await page.waitForFunction((tt) => {
    const it = window.__MOONREST__.state.introT
    return it == null || it >= tt
  }, b.t, { timeout: 90000 }).then(() => true).catch(() => false)
  const it = await page.evaluate(() => window.__MOONREST__.state.introT)
  if (it == null && b.t < 18) { console.log(`WARN intro ended before beat ${b.name}`) }
  await page.locator('#game').screenshot({ path: resolve(outDir, `${b.name}.png`) })
  console.log(`shot ${b.name} at introT=${it ?? 'done'} ${ok ? '' : '(timeout)'}`)
}
console.log(issues.length === 0 ? 'INTRO CAPTURE COMPLETE (console clean)' : `console issues: ${issues.slice(0, 3).join(' | ')}`)
await browser.close()
preview.kill()
process.exit(issues.length === 0 ? 0 : 1)
