#!/usr/bin/env node
// Co-op moments gate, solo lobby (MASTER_PROMPT Part 3): every "all players"
// moment must degrade gracefully to a lobby of one, which also makes each
// trigger + consequence testable in a single context. The 2+-player moments
// (bench, brazier law) are covered by coopcheck.mjs.

import { spawn } from 'node:child_process'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const PORT = 4181

let pass = 0, fail = 0
function check(name, ok, detail = '') {
  if (ok) { pass++; console.log(`PASS ${name}${detail ? ' — ' + detail : ''}`) }
  else { fail++; console.log(`FAIL ${name}${detail ? ' — ' + detail : ''}`) }
}

const preview = spawn(resolve(root, 'node_modules/.bin/vite'), ['preview', '--port', String(PORT), '--strictPort'], { cwd: root, stdio: 'ignore' })
await new Promise((r) => setTimeout(r, 2500))
const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium',
  args: ['--no-sandbox', '--enable-unsafe-swiftshader', '--use-angle=swiftshader'],
})
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } })
const issues = []
page.on('console', (m) => { if (m.type() === 'error') issues.push(m.text()) })
page.on('pageerror', (e) => issues.push(e.message))
await page.goto(`http://localhost:${PORT}/`)
await page.waitForFunction(() => window.__MOONREST__?.ready)
await page.evaluate(() => { window.__MOONREST__.suppressNightEnd(true); window.__MOONREST__.skipTo(24) })

const waitDone = (id, timeout = 9000) =>
  page.waitForFunction((x) => window.__MOONREST__.momentsDebug().done.includes(x), id, { timeout }).then(() => true, () => false)

try {
  // — the arch (mosswood): stand under it → deep bell + Gatewalkers trinket —
  await page.evaluate(() => window.__MOONREST__.teleportPlayer(84, 110, 0))
  check('arch moment fires solo', await waitDone('arch'))
  const trink = await page.evaluate(() => window.__MOONREST__.trinkets)
  check('arch grants the Gatewalkers arch-stone', trink.includes('archstone'), JSON.stringify(trink))

  // — constellation (rooftops): lie down near Nib —
  const nib = await page.evaluate(() => window.__MOONREST__.npcDebug().nib)
  await page.evaluate((n) => { window.__MOONREST__.teleportPlayer(n[0] + 2, n[2] + 1, 0); window.__MOONREST__.setAction('lie') }, nib)
  check('constellation show fires (all players lying near Nib)', await waitDone('constellation'))

  // — well glyphs (ruins): stand a glyph → brightens; solo lobby → sky beam —
  const glyph = await page.evaluate(() => window.__MOONREST__.momentsDebug().glyphs[0])
  await page.evaluate((g) => { window.__MOONREST__.setAction(null); window.__MOONREST__.teleportPlayer(g.x, g.z, 0) }, glyph)
  const occOK = await page.waitForFunction(() => {
    const d = window.__MOONREST__.momentsDebug()
    return d.glyphs[0].occupied && d.glyphs[0].lit > 0.5
  }, null, { timeout: 8000 }).then(() => true, () => false)
  check('occupied glyph brightens', occOK)
  check('full (solo) lobby fires the sky beam', await waitDone('wellbeam'))
  const beam = await page.evaluate(() => window.__MOONREST__.momentsDebug().beamT)
  check('beam envelope live', beam > 0, `beamT=${beam}`)

  // — gargoyle (gloomspire): wave at it → it waves back, then statue —
  const gp = await page.evaluate(() => window.__MOONREST__.momentsDebug().gargoylePos)
  await page.evaluate((g) => { window.__MOONREST__.teleportPlayer(g[0] - 4, g[2] - 6, 0); window.__MOONREST__.setAction('wave') }, gp)
  check('gargoyle waves back when everyone waves', await waitDone('gargoyle'))
  const waveT = await page.evaluate(() => window.__MOONREST__.momentsDebug().gargoyleWaveT)
  check('one-wing wave animates then snaps', waveT > 0, `waveT=${waveT}`)

  // — lullaby (hall): wake the cat (6 sconces), sit at the throne foot —
  await page.evaluate(() => {
    window.__MOONREST__.setAction(null)
    for (const l of window.__MOONREST__.lights) if (l.id.startsWith('hall-sconce')) window.__MOONREST__.kindle(l.id)
  })
  await page.waitForFunction(() => window.__MOONREST__.momentsDebug().catState === 'follow', null, { timeout: 5000 })
  const tp = await page.evaluate(() => window.__MOONREST__.momentsDebug().thronePos)
  await page.evaluate((t) => { window.__MOONREST__.teleportPlayer(t[0], t[2] + 1, 0); window.__MOONREST__.setAction('sit') }, tp)
  check('throne lullaby (cat present, keeper seated)', await waitDone('lullaby', 12000))

  // — chicken (village): keep gentle company ~3m for 8s → head-rider —
  await page.evaluate(() => window.__MOONREST__.setAction(null))
  let mounted = false
  for (let i = 0; i < 24 && !mounted; i++) {
    const ch = await page.evaluate(() => window.__MOONREST__.npcDebug().chickens[0])
    await page.evaluate((p) => window.__MOONREST__.teleportPlayer(p[0] + 3, p[2] + 0.5, 0), ch.p)
    await new Promise((r) => setTimeout(r, 900))
    mounted = await page.evaluate(() => window.__MOONREST__.momentsDebug().chickenStates.includes('mount'))
  }
  check('followed chicken hops onto a head and rides', mounted)

  // — moment log is the sync record (each entry broadcastable) —
  const log = await page.evaluate(() => window.__MOONREST__.momentsDebug().log.map((e) => e.id))
  check('moment log records the night', ['arch', 'constellation', 'wellbeam', 'gargoyle', 'lullaby'].every((id) => log.includes(id)), JSON.stringify(log))

  check('console clean', issues.length === 0, issues.slice(0, 3).join(' | '))
} finally {
  await browser.close()
  preview.kill('SIGTERM')
}
console.log(fail === 0 ? `MOMENTS CHECK PASS (${pass}/${pass + fail})` : `MOMENTS CHECK: ${fail} FAILURES (${pass}/${pass + fail})`)
process.exit(fail === 0 ? 0 : 1)
