#!/usr/bin/env node
// MOONREST shoot rig (MASTER_PROMPT 0.4): builds are assumed done (init.sh runs
// the build first). Starts the vite preview server, loads the game headless,
// teleports to named poses, saves PNGs to docs/build/shots/, asserts the canvas
// is non-blank, and treats ANY console error/warning as a defect.
//
// Usage:
//   node scripts/shoot.mjs            # all poses
//   node scripts/shoot.mjs --smoke    # first pose only, no PNG review needed
//   node scripts/shoot.mjs park m0    # specific poses

import { spawn } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const shotsDir = resolve(root, 'docs/build/shots')
mkdirSync(shotsDir, { recursive: true })

const PORT = 4173
const smoke = process.argv.includes('--smoke')
const askedPoses = process.argv.slice(2).filter((a) => !a.startsWith('-'))

function startPreview() {
  return new Promise((resolvePromise, reject) => {
    // spawn vite directly (not via npm run) so kill() reaches the real server
    const proc = spawn(resolve(root, 'node_modules/.bin/vite'), ['preview', '--port', String(PORT), '--strictPort'], {
      cwd: root,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    let ready = false
    const onData = (d) => {
      const s = d.toString()
      if (!ready && (s.includes('localhost:' + PORT) || s.includes('Local:'))) {
        ready = true
        resolvePromise(proc)
      }
    }
    proc.stdout.on('data', onData)
    proc.stderr.on('data', onData)
    proc.on('exit', (code) => { if (!ready) reject(new Error('preview exited early, code ' + code)) })
    setTimeout(() => { if (!ready) reject(new Error('preview server timeout')) }, 15000)
  })
}

const consoleIssues = []

async function main() {
  const preview = await startPreview()
  // Preinstalled Chromium (env pins a different playwright browser build; see docs).
  const browser = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium',
    args: ['--no-sandbox', '--enable-unsafe-swiftshader', '--use-angle=swiftshader'],
  })
  try {
    const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } })
    page.on('console', (msg) => {
      const type = msg.type()
      if (type === 'error' || type === 'warning') consoleIssues.push(`[console.${type}] ${msg.text()}`)
    })
    page.on('pageerror', (err) => consoleIssues.push(`[pageerror] ${err.message}`))

    await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'load' })
    await page.waitForFunction(() => window.__MOONREST__ && window.__MOONREST__.ready, null, { timeout: 15000 })
    // let textures/first frames settle; moon mid-descent so Rule 6 holds in shots
    await page.waitForTimeout(1200)
    await page.evaluate(() => window.__MOONREST__.skipTo(24))
    if (process.argv.includes('--kindled')) {
      await page.evaluate(() => window.__MOONREST__.lights.forEach((l) => window.__MOONREST__.kindle(l.id)))
      await page.waitForTimeout(2600)
    }

    const allPoses = await page.evaluate(() => window.__MOONREST__.poses)
    const poses = smoke ? [allPoses[0]] : (askedPoses.length ? askedPoses : allPoses)

    let failures = 0
    for (const pose of poses) {
      const ok = await page.evaluate((p) => window.__MOONREST__.teleport(p), pose)
      if (!ok) { console.error(`POSE MISSING: ${pose}`); failures++; continue }
      await page.waitForTimeout(600) // scene settle
      const sample = await page.evaluate(() => window.__MOONREST__.sampleFrame())
      const blank = sample.differRatio <= 0.05
      if (blank) {
        console.error(`BLANK CANVAS at pose ${pose}: differRatio=${sample.differRatio.toFixed(3)}`)
        failures++
      } else {
        console.log(`pose ${pose}: non-blank OK (differRatio=${sample.differRatio.toFixed(3)})`)
      }
      if (!smoke) {
        const path = resolve(shotsDir, `${pose}.png`)
        await page.locator('#game').screenshot({ path })
        console.log(`saved ${path}`)
      }
    }

    const state = await page.evaluate(() => window.__MOONREST__.state)
    console.log('state:', JSON.stringify(state))

    if (consoleIssues.length) {
      console.error(`CONSOLE NOT CLEAN (${consoleIssues.length}):`)
      for (const i of consoleIssues) console.error('  ' + i)
      failures++
    } else {
      console.log('console clean')
    }
    if (failures > 0) process.exitCode = 1
  } finally {
    await browser.close()
    preview.kill('SIGTERM')
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
