#!/usr/bin/env node
// PRESTIGE B.1: shoot every authored postcard to docs/build/shots/postcards/.
// Usage: node scripts/postcards.mjs [--kindled]

import { spawn } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const dir = resolve(root, 'docs/build/shots/postcards')
mkdirSync(dir, { recursive: true })
const PORT = 4187

const preview = spawn(resolve(root, 'node_modules/.bin/vite'), ['preview', '--port', String(PORT), '--strictPort'], { cwd: root, stdio: 'ignore' })
await new Promise((r) => setTimeout(r, 2500))
const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium',
  args: ['--no-sandbox', '--enable-unsafe-swiftshader', '--use-angle=swiftshader'],
})
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } })
const issues = []
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') issues.push(m.text()) })
page.on('pageerror', (e) => issues.push(e.message))
await page.goto(`http://localhost:${PORT}/`)
await page.waitForFunction(() => window.__MOONREST__?.ready)
await page.waitForTimeout(1000)
if (process.argv.includes('--kindled')) {
  await page.evaluate(() => {
    window.__MOONREST__.suppressNightEnd(true)
    window.__MOONREST__.lights.forEach((l) => window.__MOONREST__.kindle(l.id))
  })
  await page.waitForTimeout(2600)
}
let fails = 0
const cards = await page.evaluate(() => window.__MOONREST__.listPostcards())
for (const id of cards) {
  const [zone, idx] = [id.slice(0, id.lastIndexOf('-')), +id.slice(id.lastIndexOf('-') + 1)]
  const ok = await page.evaluate(({ zone, idx }) => window.__MOONREST__.teleportPostcard(zone, idx), { zone, idx })
  if (!ok) { console.error(`MISSING ${id}`); fails++; continue }
  await page.waitForTimeout(700)
  await page.locator('#game').screenshot({ path: resolve(dir, `${id}.png`) })
  console.log(`saved postcards/${id}.png`)
}
if (issues.length) { console.error(`CONSOLE NOT CLEAN (${issues.length}): ` + issues.slice(0, 3).join(' | ')); fails++ }
console.log(fails === 0 ? 'POSTCARDS PASS' : `POSTCARDS: ${fails} FAILURES`)
await browser.close()
preview.kill()
process.exit(fails === 0 ? 0 : 1)
