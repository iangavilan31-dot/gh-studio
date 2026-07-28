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
// minSat: AA.3 saturation floor on hueStrength (mean saturation weight) — the
// mean of a zone frame must not be neutral; darkness is a saturated cool hue.
const ZONE_EXPECT = {
  park: { hue: [150, 220], warmAfterKindle: true, minSat: 0.06 },
  village: { hue: [215, 280], warmAfterKindle: true, minSat: 0.08 },
  // rooftops' Part 2.1 warm accent is the gnome-hat RED — red counts as warmth
  // here, and the threshold is lower: this zone's warmth is a single small
  // hat+lantern vignette in a huge cobalt sky (Rule 2: scarce = precious)
  rooftops: { hue: [210, 260], warmAfterKindle: true, redCounts: true, minWarm: 0.0006, minSat: 0.1 },
  ruins: { hue: [255, 330], warmAfterKindle: false, minSat: 0.06 }, // violet; accent is COLD cyan
  // Part 2.1 accent literalism: Gloomspire's accent IS window toxic green;
  // the Hall's is carpet red + candleflame; the Isle's is the cool moon glow.
  gloomspire: { hue: [240, 310], accent: 'green', minSat: 0.06 },
  hall: { hue: [0, 60], warmAfterKindle: true, redCounts: true, lumMax: 0.32, minSat: 0.03 },
  mosswood: { hue: [110, 180], warmAfterKindle: true, minSat: 0.05 },
  isle: { hue: [160, 230], accent: 'moonglow', minSat: 0.05 },
  foglands: { hue: [165, 240], warmAfterKindle: false, minSat: 0.05 }, // corridor teal; breadcrumbs pre-lit
}
// AA.3: the gate covers EVERY zone by default (was M4's three)
const asked = process.argv.slice(2).filter((a) => !a.startsWith('-'))
const zones = asked.length ? asked : Object.keys(ZONE_EXPECT)

const preview = spawn(resolve(root, 'node_modules/.bin/vite'), ['preview', '--port', String(PORT), '--strictPort'], { cwd: root, stdio: 'ignore' })
await new Promise((r) => setTimeout(r, 2500))
const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium',
  args: ['--no-sandbox', '--enable-unsafe-swiftshader', '--use-angle=swiftshader'],
})
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } })
await page.addInitScript(() => { window.__NIGHT_SEED__ = 42 }) // D.1: rigs run a pinned night signature
page.on('pageerror', (e) => console.error('PAGEERROR', e.message))
await page.goto(`http://localhost:${PORT}/`)
await page.waitForFunction(() => window.__MOONREST__?.ready)
await page.waitForTimeout(1000)
await page.evaluate(() => window.__MOONREST__.skipTo(24))
// kindle every light so the warm accents are present (the lived-in night);
// suppress the keep-brazier finale — the gate shoots the world, not the reel
await page.evaluate(() => {
  window.__MOONREST__.suppressNightEnd(true)
  window.__MOONREST__.lights.forEach((l) => window.__MOONREST__.kindle(l.id))
})
await page.waitForTimeout(2600) // blooms settle

let fails = 0
for (const z of zones) {
  const exp = ZONE_EXPECT[z]
  if (!exp) { console.log(`SKIP ${z}: no expectation defined`); continue }
  await page.evaluate((zz) => window.__MOONREST__.teleport(zz), z)
  await page.waitForTimeout(700)
  // flames/halos flicker and lanterns sway — sample 6 frames; accent fields
  // take the max (accent presence = present in any frame), hue the mean
  // AA.3: measure the FINAL frame (post pass included) — what the player sees
  const samples = []
  for (let k = 0; k < 6; k++) {
    samples.push(await page.evaluate(() => window.__MOONREST__.samplePaletteFinal()))
    await page.waitForTimeout(300)
  }
  const s = samples[0]
  for (const f of ['warmFrac', 'redFrac', 'greenFrac', 'brightFrac']) s[f] = Math.max(...samples.map((x) => x[f]))
  s.avgHue = +(samples.reduce((a, x) => a + x.avgHue, 0) / samples.length).toFixed(1)
  // avgHue is circular: accept wrap for windows starting at 0
  let hue = s.avgHue
  if (exp.hue[0] === 0 && hue > 345) hue -= 360
  const hueOK = hue >= exp.hue[0] && hue <= exp.hue[1]
  const lumOK = s.medianLum < (exp.lumMax ?? 0.28)
  let accentOK = true, accentNote = ''
  if (exp.accent === 'green') { accentOK = s.greenFrac > 0.001; accentNote = ` greenFrac=${s.greenFrac} (>0.001)` }
  else if (exp.accent === 'moonglow') { accentOK = s.brightFrac > 0.004; accentNote = ` brightFrac=${s.brightFrac} (>0.004)` }
  else if (exp.warmAfterKindle) {
    const warmth = s.warmFrac + (exp.redCounts ? s.redFrac : 0)
    accentOK = warmth > (exp.minWarm ?? 0.0015)
    accentNote = ` warmth=${warmth.toFixed(5)} (>${exp.minWarm ?? 0.0015})`
  }
  const satOK = s.hueStrength >= (exp.minSat ?? 0)
  const ok = hueOK && lumOK && accentOK && satOK
  if (!ok) fails++
  console.log(`${ok ? 'PASS' : 'FAIL'} ${z}: avgHue=${s.avgHue} (want ${exp.hue[0]}–${exp.hue[1]}), medianLum=${s.medianLum} (<${exp.lumMax ?? 0.28})${accentNote} hueStrength=${s.hueStrength} (>=${exp.minSat ?? 0})`)
}
console.log(fails === 0 ? 'HUE GATE PASS' : `HUE GATE: ${fails} FAILURES`)
await browser.close()
preview.kill()
process.exit(fails === 0 ? 0 : 1)
