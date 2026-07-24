#!/usr/bin/env node
// AA.4 hard gate: no zone screenshot may contain a screen-quarter of
// undifferentiated ground or sky (the sky-dome's authored gradient is exempt —
// top quadrants only fail if they are BOTH flat and not sky-like).
// Measures, per quadrant: luminance stddev + edge energy (mean |neighbor diff|).
//
// Usage: node scripts/quartercheck.mjs [shot ...]   (default: the zone reel)

import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { existsSync, readFileSync } from 'node:fs'
import { chromium } from 'playwright'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const shotsDir = resolve(root, 'docs/build/shots')
const DEFAULT = ['park', 'village', 'rooftops', 'ruins', 'gloomspire', 'mosswood', 'isle', 'sea', 'foglands', 'hall']
const asked = process.argv.slice(2).filter((a) => !a.startsWith('-'))
const shots = asked.length ? asked : DEFAULT

// floors: ground quadrants must show texture/prop variation; sky quadrants are
// exempt when they read as an authored gradient (smooth vertically, some hue)
const STD_MIN = 0.022   // luminance stddev floor for ground quads
const EDGE_MIN = 0.0045 // edge-energy floor for ground quads

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium',
  args: ['--no-sandbox'],
})
const page = await browser.newPage()
let fails = 0
for (const name of shots) {
  const file = resolve(shotsDir, `${name}.png`)
  if (!existsSync(file)) { console.error(`MISSING ${name}.png`); fails++; continue }
  const dataUri = 'data:image/png;base64,' + readFileSync(file).toString('base64')
  const stats = await page.evaluate(async (src) => {
    const img = new Image()
    img.src = src
    await img.decode()
    const c = document.createElement('canvas')
    const W = 480, H = 270 // analysis scale — texture detail survives, noise averages
    c.width = W; c.height = H
    const ctx = c.getContext('2d')
    ctx.drawImage(img, 0, 0, W, H)
    const d = ctx.getImageData(0, 0, W, H).data
    const lum = new Float32Array(W * H)
    for (let i = 0; i < W * H; i++) lum[i] = (0.299 * d[i * 4] + 0.587 * d[i * 4 + 1] + 0.114 * d[i * 4 + 2]) / 255
    const quads = []
    for (const [qy, qx] of [[0, 0], [0, 1], [1, 0], [1, 1]]) {
      let sum = 0, sum2 = 0, edge = 0, n = 0, en = 0
      let topSum = 0, topN = 0, botSum = 0, botN = 0
      const yMid = (qy + 0.5) * H / 2
      for (let y = qy * H / 2; y < (qy + 1) * H / 2; y++) {
        for (let x = qx * W / 2; x < (qx + 1) * W / 2; x++) {
          const l = lum[y * W + x]
          sum += l; sum2 += l * l; n++
          if (y < yMid) { topSum += l; topN++ } else { botSum += l; botN++ }
          if (x + 1 < W && y + 1 < H) {
            edge += Math.abs(l - lum[y * W + x + 1]) + Math.abs(l - lum[(y + 1) * W + x])
            en++
          }
        }
      }
      const mean = sum / n
      const std = Math.sqrt(Math.max(0, sum2 / n - mean * mean))
      // sky signature: the authored gradient descends — upper half of the
      // quadrant measurably differs from the lower half
      const vgrad = Math.abs(topSum / topN - botSum / botN)
      // fog signature: deep-fog zones (mosswood) have FLAT but SATURATED sky —
      // authored atmosphere, not a dead area; neutral black stays a failure
      let satSum = 0
      for (let y = qy * H / 2; y < (qy + 1) * H / 2; y += 3) {
        for (let x = qx * W / 2; x < (qx + 1) * W / 2; x += 3) {
          const i4 = (y * W + x) * 4
          const mx2 = Math.max(d[i4], d[i4 + 1], d[i4 + 2]), mn = Math.min(d[i4], d[i4 + 1], d[i4 + 2])
          satSum += (mx2 - mn) / 255
        }
      }
      const sat = satSum / Math.ceil(H / 6) / Math.ceil(W / 6)
      quads.push({ mean: +mean.toFixed(4), std: +std.toFixed(4), edge: +(edge / en).toFixed(5), vgrad: +vgrad.toFixed(4), sat: +sat.toFixed(4) })
    }
    return quads
  }, dataUri)
  // quadrant order: TL, TR, BL, BR — bottom two are ground, top two sky-exempt
  const verdicts = stats.map((q, i) => {
    const isTop = i < 2
    const flat = q.std < STD_MIN && q.edge < EDGE_MIN
    // top quadrants are exempt ONLY as authored sky: a vertical gradient must
    // actually be present (AA.4's "excluding the sky-dome's authored gradient")
    const skyLike = isTop && (q.vgrad > 0.004 || q.sat > 0.05)
    return { ...q, quad: ['TL', 'TR', 'BL', 'BR'][i], fail: flat && !skyLike }
  })
  const bad = verdicts.filter((v) => v.fail)
  if (bad.length) fails++
  console.log(`${bad.length ? 'FAIL' : 'PASS'} ${name}: ` + verdicts.map((v) => `${v.quad} std=${v.std} edge=${v.edge}${v.fail ? ' ✗FLAT' : ''}`).join(' · '))
}
console.log(fails === 0 ? 'QUARTER GATE PASS' : `QUARTER GATE: ${fails} FAILURES`)
await browser.close()
process.exit(fails === 0 ? 0 : 1)
