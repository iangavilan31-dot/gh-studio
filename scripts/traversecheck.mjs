#!/usr/bin/env node
// M3 gate: world traversal + zone blending. Drives real input across the
// world's connective tissue: bakery ladder → rooftops, castle door → hall,
// park→isle causeway, mosswood arch loop-through, park→village fog lerp.
// Permanent tooling (judge passes reuse it).

import { spawn } from 'node:child_process'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const PORT = 4176
const preview = spawn(resolve(root, 'node_modules/.bin/vite'), ['preview', '--port', String(PORT), '--strictPort'], { cwd: root, stdio: 'ignore' })
await new Promise((r) => setTimeout(r, 2500))
const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium',
  args: ['--no-sandbox', '--enable-unsafe-swiftshader', '--use-angle=swiftshader'],
})
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } })
  // Behavior gate: run the light 480x270 retro pipeline — headless software
  // raster can't do native-res Restored at playable frame times, and this
  // gate tests mechanics, not the renderer (Restored is covered by the
  // shoot/hue/shell/perf gates).
  await page.addInitScript(() => {
    try { localStorage.setItem('moonrest-settings-v1', JSON.stringify({ settingsV: 2, memoryMode: 'n64', resScale: 1 })) } catch (e) {}
  })
const issues = []
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') issues.push(m.text()) })
page.on('pageerror', (e) => issues.push(e.message))
await page.goto(`http://localhost:${PORT}/`)
await page.waitForFunction(() => window.__MOONREST__?.ready)
await page.waitForTimeout(600)

let fails = 0
const check = (name, ok, detail) => { console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ' — ' + detail : ''}`); if (!ok) fails++ }
const S = () => page.evaluate(() => window.__MOONREST__.state)
const tp = (x, z, yaw) => page.evaluate(([a, b, c]) => window.__MOONREST__.teleportPlayer(a, b, c), [x, z, yaw])
const walk = async (ms) => { await page.keyboard.down('w'); await page.waitForTimeout(ms); await page.keyboard.up('w') }

// 1) zone blend park→village: fog color must lerp (no pop) and zone must change
await tp(20, 0, Math.PI / 2) // facing +x (east)? yaw: rig faces dir (sin,cos)… use velocity: walk east
{
  // face east: targetYaw = atan2(dirX, dirZ); camera yaw so W walks +x → set camera yaw = -PI/2
  await page.evaluate(() => { window.__MOONREST__.releaseCam() })
  const fogs = []
  let sawFogland = false
  await tp(22, 0, 1.57)
  // camera-relative: rotate camera by holding... simpler: repeated teleports along the corridor sampling blend
  for (let x = 22; x <= 96; x += 6) {
    await tp(x, 0, 1.57)
    await page.waitForTimeout(260)
    const st = await S()
    fogs.push(st.fogColor)
    if (st.zone.startsWith('fogland')) sawFogland = true
  }
  const distinct = new Set(fogs).size
  const st = await S()
  check('park→village: fog lerps through many values', distinct >= 6, `${distinct} distinct fog colors`)
  check('corridor passes through a fogland zone', sawFogland)
  check('arrives in village zone', st.zone === 'village', `zone=${st.zone}`)
}

// 2) bakery ladder → rooftops (walk up the ramp behind the bakery)
{
  await tp(124, 2.2, Math.PI) // street behind bakery
  await page.evaluate(() => window.__MOONREST__.setCamYaw(0)) // W walks north (-z)
  await page.waitForTimeout(300)
  await walk(2600)
  const st = await S()
  check('ladder ramp climbs to roof height', st.playerPos[1] > 10, `y=${st.playerPos[1]}`)
  check('zone becomes rooftops when up', st.zone === 'rooftops', `zone=${st.zone}`)
  check('surface is shingle on roofs', st.surface === 'shingle', `surface=${st.surface}`)
}

// 3) castle red door → hall interior
{
  await tp(-110, 130, 0) // on the castle grounds; door is south (+z)
  await page.evaluate(() => window.__MOONREST__.setCamYaw(Math.PI)) // W walks +z
  await page.waitForTimeout(300)
  await page.keyboard.down('Shift')
  await walk(6500)
  await page.keyboard.up('Shift')
  const st = await S()
  check('walked through the red door into the Hall', st.zone === 'hall' && st.playerPos[2] > 140, `zone=${st.zone} z=${st.playerPos[2].toFixed(1)}`)
}

// 4) park→isle causeway: above water along its whole length + zone handoff
{
  // sample causeway height by standing at points along it
  let minY = Infinity
  for (const z of [-50, -65, -80, -95, -110, -125]) {
    await tp(0, z, Math.PI)
    await page.waitForTimeout(180)
    const st = await S()
    minY = Math.min(minY, st.playerPos[1])
  }
  check('causeway stays above water along its length', minY > 0.3, `minY=${minY.toFixed(2)}`)
  // real walk the final stretch onto the island
  await tp(0, -95, Math.PI)
  await page.evaluate(() => window.__MOONREST__.setCamYaw(0))
  await page.waitForTimeout(300)
  await page.keyboard.down('Shift')
  await walk(4200)
  await page.keyboard.up('Shift')
  const st = await S()
  check('reached isle zone', st.zone === 'isle', `zone=${st.zone} z=${st.playerPos[2].toFixed(1)}`)
}

// 5) mosswood arch loop-through: walking beyond the arch mirrors you back
{
  await tp(80, 110, Math.PI / 2) // just before the arch, facing +x (east)
  await page.waitForTimeout(300)
  // face +x: rig yaw π/2 (sin=1, cos=0 → dir +x); hold W with camera-relative…
  // teleportPlayer sets yaw; walking W uses CAMERA yaw. Rotate via mouse is
  // awkward headless — instead nudge repeatedly with direct teleports + a real
  // walk assert: use keyboard while camera looks along +x by pre-positioning:
  const before = await S()
  await page.evaluate(() => {
    // walk the player straight east via the test hook (movement rules still
    // apply through applyWorldRules on the next frames)
    const st = window.__MOONREST__
    let steps = 0
    const id = setInterval(() => {
      const p = st.state.playerPos
      st.teleportPlayer(p[0] + 0.8, p[2] === undefined ? 110 : 110, 1.57)
      if (++steps > 22) clearInterval(id)
    }, 60)
  })
  await page.waitForTimeout(1800)
  const st = await S()
  check('mosswood arch loops you back (x snapped below arch line)', st.playerPos[0] < 92.5, `x=${st.playerPos[0].toFixed(1)}`)
}

check('console clean', issues.length === 0, issues.slice(0, 3).join(' | '))
console.log(fails === 0 ? 'TRAVERSE CHECK PASS' : `TRAVERSE CHECK: ${fails} FAILURES`)
await browser.close()
preview.kill()
process.exit(fails === 0 ? 0 : 1)
