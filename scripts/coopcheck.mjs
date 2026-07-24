#!/usr/bin/env node
// Co-op hard gate (MASTER_PROMPT 12.1 M7): two browser contexts host+join a
// real PeerJS session against a LOCAL signaling server (the shipped game uses
// the public PeerJS cloud; the rig injects window.__PEER_OPTS__ — same client
// code, local broker). Asserts: room-code host/join, transform sync, remote
// avatar render, synced kindle, synced emote, moon heartbeat slew, late-join
// snapshot, brazier all-channel law, disconnect firefly fade, host-loss
// message, and both-perspective screenshots.

import { spawn } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'
import { PeerServer } from 'peer'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const PORT = 4179
const PEER_PORT = 9101
const shotsDir = resolve(root, 'docs/build/shots')
mkdirSync(shotsDir, { recursive: true })

let pass = 0, fail = 0
function check(name, ok, detail = '') {
  if (ok) { pass++; console.log(`PASS ${name}${detail ? ' — ' + detail : ''}`) }
  else { fail++; console.log(`FAIL ${name}${detail ? ' — ' + detail : ''}`) }
}

const preview = spawn(resolve(root, 'node_modules/.bin/vite'), ['preview', '--port', String(PORT), '--strictPort'], { cwd: root, stdio: 'ignore' })
// local signaling broker via the `peer` package API (the CLI binds :: and this
// container is IPv4-only)
const broker = PeerServer({ port: PEER_PORT, path: '/mr', host: '127.0.0.1' })
await new Promise((r) => setTimeout(r, 2500))

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium',
  args: ['--no-sandbox', '--enable-unsafe-swiftshader', '--use-angle=swiftshader'],
})

const issues = { A: [], B: [], C: [] }
async function boot(tag) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } })
  const page = await ctx.newPage()
  page.on('console', (m) => { if (m.type() === 'error') issues[tag].push(`[${tag}] ${m.text()}`) })
  page.on('pageerror', (e) => issues[tag].push(`[${tag} pageerror] ${e.message}`))
  await page.goto(`http://localhost:${PORT}/`)
  await page.waitForFunction(() => window.__MOONREST__?.ready)
  await page.evaluate((pp) => {
    window.__PEER_OPTS__ = { host: '127.0.0.1', port: pp, path: '/mr' }
    window.__MOONREST__.suppressNightEnd(true) // rig must outlive host-loss reload
    window.__MOONREST__.skipTo(24)
  }, PEER_PORT)
  return { ctx, page }
}

async function waitFor(page, fn, arg, timeout = 8000) {
  try { await page.waitForFunction(fn, arg, { timeout }); return true } catch { return false }
}

try {
  const A = await boot('A')
  const B = await boot('B')

  // — host + join by room code —
  const code = await A.page.evaluate(() => window.__MOONREST__.hostNight('aldous'))
  check('host code format (wordless-safe alphabet)', /^[BCDFGHJKMNPQRSTVWXZ]{4}$/.test(code), code)
  const youB = await B.page.evaluate((c) => window.__MOONREST__.joinNight(c, 'bertie'), code)
  check('join resolves with player id 1', youB === 1, `you=${youB}`)
  await new Promise((r) => setTimeout(r, 800))
  const dA = await A.page.evaluate(() => window.__MOONREST__.netDebug())
  check('host sees 1 peer with runic name', dA.peers === 1 && dA.remotes[0]?.name === 'bertie', JSON.stringify({ peers: dA.peers, name: dA.remotes[0]?.name }))
  const dB = await B.page.evaluate(() => window.__MOONREST__.netDebug())
  check('client role/tint assigned', dB.role === 'client' && dB.myId === 1 && dB.roster.length === 2, JSON.stringify({ role: dB.role, myId: dB.myId, log: dB.log }))

  // — transform sync: B moves, A's remote avatar follows within 1.5m —
  await B.page.evaluate(() => window.__MOONREST__.teleportPlayer(6, -21, 0.6))
  const trOK = await waitFor(A.page, () => {
    const r = window.__MOONREST__.netDebug().remotes[0]
    return r && Math.hypot(r.pos[0] - 6, r.pos[2] + 21) < 1.5
  }, null)
  const rA = await A.page.evaluate(() => window.__MOONREST__.netDebug().remotes[0])
  check('transform sync (10Hz + interp)', trOK, `remote at ${rA?.pos}`)

  // — synced emote: B waves, A sees the wave on the remote —
  await B.page.evaluate(() => window.__MOONREST__.setAction('wave'))
  const emOK = await waitFor(A.page, () => window.__MOONREST__.netDebug().remotes[0]?.action === 'wave', null, 4000)
  check('emote sync (transform-carried)', emOK)

  // — synced kindle: B kindles via the net path; both worlds light it —
  await B.page.evaluate(() => window.__MOONREST__.kindle('park-bench-lamp'))
  const kA = await waitFor(A.page, () => window.__MOONREST__.state.kindled.includes('park-bench-lamp'), null, 5000)
  const kB = await waitFor(B.page, () => window.__MOONREST__.state.kindled.includes('park-bench-lamp'), null, 5000)
  check('kindle syncs host+client', kA && kB)

  // — bench moment: two keepers sit by Beldam → shared rest syncs to all —
  await A.page.evaluate(() => { window.__MOONREST__.teleportPlayer(2.5, -19.2, 0); window.__MOONREST__.setAction('sit') })
  await B.page.evaluate(() => { window.__MOONREST__.teleportPlayer(1.4, -20.0, 0); window.__MOONREST__.setAction('sit') })
  const benchA = await waitFor(A.page, () => window.__MOONREST__.momentsDebug().done.includes('bench'), null, 8000)
  const benchB = await waitFor(B.page, () => window.__MOONREST__.momentsDebug().done.includes('bench'), null, 4000)
  const rainSoft = await A.page.evaluate(() => window.__MOONREST__.momentsDebug().rainSoftT)
  check('bench shared-rest syncs (rain softens)', benchA && benchB && rainSoft > 0, `rainSoftT=${rainSoft}`)
  await A.page.evaluate(() => window.__MOONREST__.setAction(null))
  await B.page.evaluate(() => window.__MOONREST__.setAction(null))

  // — moon heartbeat: host clock jumps, client slews to it within ~6s —
  await A.page.evaluate(() => window.__MOONREST__.skipTo(30))
  await new Promise((r) => setTimeout(r, 6500))
  const ntB = await B.page.evaluate(() => window.__MOONREST__.state.nightT)
  check('client slews to host moon clock', Math.abs(ntB - 30) < 1.2, `client nightT=${ntB}`)

  // — both-perspective screenshots: stand the wizards face to face —
  await A.page.evaluate(() => { window.__MOONREST__.teleportPlayer(4, -16, Math.PI); window.__MOONREST__.setCamYaw(0) })
  await B.page.evaluate(() => { window.__MOONREST__.teleportPlayer(4, -20, 0); window.__MOONREST__.setCamYaw(Math.PI); window.__MOONREST__.setAction('wave') })
  await new Promise((r) => setTimeout(r, 1200))
  await A.page.locator('#game').screenshot({ path: resolve(shotsDir, 'coop-host.png') })
  await B.page.locator('#game').screenshot({ path: resolve(shotsDir, 'coop-join.png') })
  const remoteVis = await A.page.evaluate(() => window.__MOONREST__.netDebug().remotes[0]?.visible)
  check('both-perspective shots saved, remote rendered', remoteVis === true, 'coop-host.png / coop-join.png')

  // — brazier law: a lone keeper's channel is denied while a peer is present —
  const denied = await B.page.evaluate(() => {
    window.__MOONREST__.teleportPlayer(4, -156, 0) // beside the keep (host reach check is live)
    return window.__MOONREST__.kindle('isle-keep-brazier')
  })
  await new Promise((r) => setTimeout(r, 400)) // let a transform carry the new position first
  await new Promise((r) => setTimeout(r, 1200))
  const brazierCold = await B.page.evaluate(() => !window.__MOONREST__.state.kindled.includes('isle-keep-brazier'))
  check('brazier denied for a lone channeler', brazierCold, `request sent=${denied}`)

  // — brazier law satisfied: every keeper channels it together —
  await A.page.evaluate(() => window.__MOONREST__.netChan('isle-keep-brazier', true))
  await B.page.evaluate(() => window.__MOONREST__.netChan('isle-keep-brazier', true))
  await new Promise((r) => setTimeout(r, 400))
  await B.page.evaluate(() => window.__MOONREST__.kindle('isle-keep-brazier'))
  const brazA = await waitFor(A.page, () => window.__MOONREST__.state.kindled.includes('isle-keep-brazier'), null, 5000)
  const brazB = await waitFor(B.page, () => window.__MOONREST__.state.kindled.includes('isle-keep-brazier'), null, 5000)
  check('brazier kindles when all keepers channel', brazA && brazB)

  // — late join: C connects after the night is underway —
  const C = await boot('C')
  const youC = await C.page.evaluate((c) => window.__MOONREST__.joinNight(c, 'cosmo'), code)
  const snapOK = await waitFor(C.page, () => window.__MOONREST__.state.kindled.includes('park-bench-lamp'), null, 6000)
  const ntC = await C.page.evaluate(() => window.__MOONREST__.state.nightT)
  check('late join gets world snapshot', youC === 2 && snapOK && Math.abs(ntC - 30) < 1.5, `you=${youC} nightT=${ntC}`)
  const rosterA = await A.page.evaluate(() => window.__MOONREST__.netDebug().roster.length)
  check('lobby of three', rosterA === 3)

  // — disconnect: C leaves (pagehide → clean goodbye); host remote fades —
  await C.page.evaluate(() => window.__MOONREST__.leaveNight())
  await C.page.close()
  await C.ctx.close()
  const fadeOK = await waitFor(A.page, () => {
    const d = window.__MOONREST__.netDebug()
    const gone = d.roster.length === 2
    const fading = d.remotes.find((r) => r.name === 'cosmo')
    return gone && (!fading || fading.fading || fading.scale < 1)
  }, null, 8000)
  check('disconnect → roster drops, avatar fades', fadeOK)

  // — host loss: A closes (clean goodbye); B hears the night drift on —
  await A.page.evaluate(() => window.__MOONREST__.leaveNight())
  await A.page.close()
  await A.ctx.close()
  const lostOK = await waitFor(B.page, () => window.__MOONREST__.netDebug().role === null, null, 10000)
  check('host loss → client returns to solo night', lostOK)

  const errs = [...issues.A, ...issues.B, ...issues.C]
  check('console clean (all contexts)', errs.length === 0, errs.slice(0, 3).join(' | '))
} finally {
  await browser.close()
  preview.kill('SIGTERM')
  try { broker.close?.() } catch { /* server already down */ }
  setTimeout(() => process.exit(fail === 0 ? 0 : 1), 800).unref()
}

console.log(fail === 0 ? `COOP CHECK PASS (${pass}/${pass + fail})` : `COOP CHECK: ${fail} FAILURES (${pass}/${pass + fail})`)
process.exit(fail === 0 ? 0 : 1)
