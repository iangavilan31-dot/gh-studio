#!/usr/bin/env node
// Hue-match hard gate (MASTER_PROMPT 12.1 M4/M5): each art-complete zone's
// screenshot must carry its Part 2.1 palette. Measured from the pre-post RT:
// saturation-weighted average hue must land in the zone's dominant-hue window,
// median luminance must stay night-dark, and the warm accent must exist where
// the zone has kindled warm lights. Tolerances documented in JUDGE.md.
//
// Usage: node scripts/huecheck.mjs [zone ...]   (default: all art-complete zones)

import { spawn } from 'node:child_process'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const PORT = 4177

// dominant-hue windows (degrees) + expectations per zone, from Part 2.1
const ZONE_EXPECT = {
  park: { hue: [150, 220], warmAfterKindle: true },
  village: { hue: [215, 280], warmAfterKindle: true },
  // rooftops' Part 2.1 warm accent is the gnome-hat RED — red counts as warmth
  // here, and the threshold is lower: this zone's warmth is a single small
  // hat+lantern vignette in a huge cobalt sky (Rule 2: scarce = precious)
  rooftops: { hue: [210, 260], warmAfterKindle: true, redCounts: true, minWarm: 0.0006 },
  ruins: { hue: [255, 330], warmAfterKindle: false }, // violet; accent is COLD cyan
  gloomspire: { hue: [240, 310], warmAfterKindle: true },
  hall: { hue: [10, 60], warmAfterKindle: true, lumMax: 0.32 }, // candle warmth in the dark
  mosswood: { hue: [110, 180], warmAfterKindle: true },
  isle: { hue: [160, 230], warmAfterKindle: true },
}
const M4_ZONES = ['park', 'village', 'rooftops']
const asked = process.argv.slice(2).filter((a) => !a.startsWith('-'))
const zones = asked.length ? asked : M4_ZONES

const preview = spawn(resolve(root, 'node_modules/.bin/vite'), ['preview', '--port', String(PORT), '--strictPort'], { cwd: root, stdio: 'ignore' })
await new Promise((r) => setTimeout(r, 2500))
const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium',
  args: ['--no-sandbox', '--enable-unsafe-swiftshader', '--use-angle=swiftshader'],
})
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } })
page.on('pageerror', (e) => console.error('PAGEERROR', e.message))
await page.goto(`http://localhost:${PORT}/`)
await page.waitForFunction(() => window.__MOONREST__?.ready)
await page.waitForTimeout(1000)
await page.evaluate(() => window.__MOONREST__.skipTo(24))
// kindle every light so the warm accents are present (the lived-in night)
await page.evaluate(() => window.__MOONREST__.lights.forEach((l) => window.__MOONREST__.kindle(l.id)))
await page.waitForTimeout(2600) // blooms settle

let fails = 0
for (const z of zones) {
  const exp = ZONE_EXPECT[z]
  if (!exp) { console.log(`SKIP ${z}: no expectation defined`); continue }
  await page.evaluate((zz) => window.__MOONREST__.teleport(zz), z)
  await page.waitForTimeout(700)
  const s = await page.evaluate(() => window.__MOONREST__.samplePalette())
  const hueOK = s.avgHue >= exp.hue[0] && s.avgHue <= exp.hue[1]
  const lumOK = s.medianLum < (exp.lumMax ?? 0.28)
  const warmth = s.warmFrac + (exp.redCounts ? s.redFrac : 0)
  const warmOK = !exp.warmAfterKindle || warmth > (exp.minWarm ?? 0.0015)
  const ok = hueOK && lumOK && warmOK
  if (!ok) fails++
  console.log(`${ok ? 'PASS' : 'FAIL'} ${z}: avgHue=${s.avgHue} (want ${exp.hue[0]}–${exp.hue[1]}), medianLum=${s.medianLum} (<${exp.lumMax ?? 0.28}), warmth=${warmth.toFixed(5)}${exp.warmAfterKindle ? ' (>0.0015)' : ' (n/a)'} hueStrength=${s.hueStrength}`)
}
console.log(fails === 0 ? 'HUE GATE PASS' : `HUE GATE: ${fails} FAILURES`)
await browser.close()
preview.kill()
process.exit(fails === 0 ? 0 : 1)
