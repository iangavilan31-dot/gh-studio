#!/usr/bin/env node
// FIN-1 — the composition gate (DIRECTION Parts 6–8, FINAL_PASS).
//
// Judges the FINAL frame — the one the player actually sees, post chain and
// all — against the art law, in numbers rather than in adjectives. It exists
// because "is it too dark?" is not answerable by looking; the first lit build
// of the Park read as atmospheric to the eye while 41% of its pixels were
// crushed below L*3, which is a defect the eye forgives and a screenshot does
// not.
//
// All thresholds are CIE L* (perceptual lightness, 0–100), not sRGB bytes.
// L* is what "half as bright" means to a person; a byte value is not.
//
//   VALUE FLOOR       ≥55% of pixels below L*40   — it is night
//   HIGHLIGHT SCARCITY ≤8% of pixels above L*75   — bright things are rare
//   NO CRUSH          ≤2% of pixels below L*3     — shade is TINTED, never black
//   ACCENT BUDGET     ≤8% of pixels warm+bright   — warmth is precious (Rule 2)
//   TINTED SHADE      ≥60% of dark pixels carry chroma — darkness has a hue
//   READABILITY       ≥18 L* spread in the mid-band — form is legible
//
// Usage:
//   node scripts/composecheck.mjs             # every pose
//   node scripts/composecheck.mjs park isle   # named poses
//   node scripts/composecheck.mjs --json      # machine-readable

import { spawn } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const outDir = resolve(root, 'docs/build')
mkdirSync(outDir, { recursive: true })

const PORT = 4179
const asJson = process.argv.includes('--json')
const askedPoses = process.argv.slice(2).filter((a) => !a.startsWith('-'))

const GATES = {
  valueFloor: { min: 0.55, label: 'value floor (frac < L*40)' },
  highlights: { max: 0.08, label: 'highlight scarcity (frac > L*75)' },
  crushed: { max: 0.02, label: 'no crush (frac < L*3)' },
  accents: { max: 0.08, label: 'accent budget (frac warm & bright)' },
  tintedShade: { min: 0.60, label: 'tinted shade (frac of darks with chroma)' },
  midSpread: { min: 18, label: 'readability (L* p90-p10 of mid-band)' },
}

function startPreview() {
  return new Promise((res, rej) => {
    const proc = spawn(resolve(root, 'node_modules/.bin/vite'),
      ['preview', '--port', String(PORT), '--strictPort'],
      { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] })
    let ready = false
    const onData = (d) => {
      if (!ready && /localhost:|Local:/.test(d.toString())) { ready = true; res(proc) }
    }
    proc.stdout.on('data', onData); proc.stderr.on('data', onData)
    proc.on('exit', (c) => { if (!ready) rej(new Error('preview exited early, code ' + c)) })
    setTimeout(() => { if (!ready) rej(new Error('preview timeout')) }, 15000)
  })
}

async function main() {
  const preview = await startPreview()
  const browser = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium',
    args: ['--no-sandbox', '--enable-unsafe-swiftshader', '--use-angle=swiftshader'],
  })
  const report = []
  try {
    const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } })
    await page.addInitScript(() => { window.__NIGHT_SEED__ = 42 })
    await page.addInitScript(() => { window.__PIN_PHASE__ = 0.798 })
    await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'load' })
    await page.waitForFunction(() => window.__MOONREST__?.ready, null, { timeout: 20000 })
    await page.waitForTimeout(1200)

    const allPoses = await page.evaluate(() => window.__MOONREST__.poses)
    const poses = askedPoses.length ? askedPoses : allPoses

    for (const pose of poses) {
      const ok = await page.evaluate((p) => window.__MOONREST__.teleport(p), pose)
      if (!ok) { report.push({ pose, error: 'POSE MISSING' }); continue }
      await page.waitForTimeout(700)
      report.push(await page.evaluate((p) => window.__MOONREST__.composeStats(p), pose))
    }
  } finally {
    await browser.close()
    preview.kill('SIGTERM')
  }

  let failures = 0
  const lines = []
  for (const r of report) {
    if (r.error) { lines.push(`${r.pose}: ${r.error}`); failures++; continue }
    const bad = []
    for (const [k, g] of Object.entries(GATES)) {
      const v = r[k]
      if (g.min != null && v < g.min) bad.push(`${g.label}: ${fmt(v)} < ${fmt(g.min)}`)
      if (g.max != null && v > g.max) bad.push(`${g.label}: ${fmt(v)} > ${fmt(g.max)}`)
    }
    if (bad.length) failures++
    lines.push(
      `${bad.length ? 'FAIL' : 'pass'}  ${r.pose.padEnd(12)}` +
      ` dark=${pct(r.valueFloor)} hi=${pct(r.highlights)} crush=${pct(r.crushed)}` +
      ` accent=${pct(r.accents)} tint=${pct(r.tintedShade)} spread=${r.midSpread.toFixed(1)}` +
      (bad.length ? `\n        ↳ ${bad.join('\n        ↳ ')}` : '')
    )
  }

  const summary = failures === 0
    ? `COMPOSECHECK PASS (${report.length}/${report.length} poses)`
    : `COMPOSECHECK FAIL (${report.length - failures}/${report.length} poses)`

  if (asJson) {
    console.log(JSON.stringify({ summary, pass: failures === 0, report }, null, 2))
  } else {
    console.log(lines.join('\n'))
    console.log(summary)
  }
  writeFileSync(resolve(outDir, 'composecheck.json'),
    JSON.stringify({ summary, pass: failures === 0, report }, null, 2))
  if (failures) process.exitCode = 1
}

const fmt = (v) => (typeof v === 'number' ? (v < 1 ? v.toFixed(3) : v.toFixed(1)) : String(v))
const pct = (v) => `${(v * 100).toFixed(1)}%`

main().catch((e) => { console.error(e); process.exit(1) })
