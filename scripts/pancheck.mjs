#!/usr/bin/env node
// F.2 positional-cue evidence: the Emberwick bell and Hall organ live at
// world positions — pan must follow bearing (hard right → hard left as the
// listener crosses), gain must rise with approach. Reads the cue debug
// surface; results land in docs/build/pancheck.json.

import { spawn } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const PORT = 4181

const preview = spawn(resolve(root, 'node_modules/.bin/vite'), ['preview', '--port', String(PORT), '--strictPort'], { cwd: root, stdio: 'ignore' })
await new Promise((r) => setTimeout(r, 2500))

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium',
  args: ['--no-sandbox', '--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--autoplay-policy=no-user-gesture-required'],
})
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } })
await page.addInitScript(() => {
  try { localStorage.setItem('moonrest-settings-v1', JSON.stringify({ settingsV: 2, memoryMode: 'n64', resScale: 1 })) } catch (e) {}
})
await page.goto(`http://localhost:${PORT}/`)
await page.waitForFunction(() => window.__MOONREST__?.ready)

let fails = 0
const check = (name, ok, detail) => {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ' — ' + detail : ''}`)
  if (!ok) fails++
}
const evidence = {}

// boot audio via a real key gesture, then read cues at three vantages
await page.evaluate(() => window.__MOONREST__.teleportPlayer(60, 4, 0))
await page.keyboard.press('w')
await page.waitForFunction(() => window.__MOONREST__.state.audio.started)

const cuesAt = async (x, z, yaw) => {
  await page.evaluate(([px, pz, y]) => {
    window.__MOONREST__.teleportPlayer(px, pz, 0)
    window.__MOONREST__.setCamYaw(y)
  }, [x, z, yaw])
  // teleporting into a zone fires its C.2 reveal, which yaw-biases the VIEW
  // (and therefore the pan) toward the landmark — wait out the 2.6s reveal
  // plus its decay before trusting the bearing
  await page.waitForTimeout(5200)
  return page.evaluate(() => window.__MOONREST__.state.audio.cues)
}

// bell at (137,4): from the west it sits hard RIGHT of a -z-facing camera…
const west = await cuesAt(60, 4, 0)
evidence.bellFromWest = west.bell
check('bell pans hard right from west of the village', west.bell.pan > 0.85, JSON.stringify(west.bell))
check('bell audible-but-far at 77m', west.bell.gain > 0.015, `gain=${west.bell.gain}`)
// …and from the east it flips hard LEFT, louder (13m out)
const east = await cuesAt(150, 4, 0)
evidence.bellFromEast = east.bell
check('bell pans hard left from east of the village', east.bell.pan < -0.85, JSON.stringify(east.bell))
check('bell louder as the listener nears', east.bell.gain > west.bell.gain + 0.1, `near=${east.bell.gain} far=${west.bell.gain}`)

// organ at (-110,166): dead ahead → centered; turn 90° → hard left
const ahead = await cuesAt(-110, 120, 0)
evidence.organAhead = ahead.organ
check('organ centered when dead ahead/behind', Math.abs(ahead.organ.pan) < 0.25, JSON.stringify(ahead.organ))
const turned = await cuesAt(-110, 120, Math.PI / 2)
evidence.organTurned = turned.organ
check('organ pans on turning the camera 90°', Math.abs(turned.organ.pan) > 0.85, JSON.stringify(turned.organ))
check('organ heard before the hall is seen (46m out, gain > 0)', ahead.organ.gain > 0.04, `gain=${ahead.organ.gain}`)

writeFileSync(resolve(root, 'docs/build/pancheck.json'), JSON.stringify(evidence, null, 1))
console.log(fails === 0 ? 'PAN CHECK PASS' : `PAN CHECK: ${fails} FAILURES`)
await browser.close()
preview.kill()
process.exit(fails === 0 ? 0 : 1)
