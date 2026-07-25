#!/usr/bin/env node
// DREAMSCRAP F9 gate: REAL online lockstep — two browser contexts, a local
// PeerJS broker (same client code as the public cloud), one synchronized
// dream. Asserts: both peers enter, the sim advances under 4-tick delay
// lockstep, remote inputs move the remote fighter, and the determinism
// heartbeats (state hashes every 60 ticks) match EXACTLY across peers.
import { spawn } from 'node:child_process'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'
import { PeerServer } from 'peer'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const PORT = 4187
const PEER_PORT = 9107
let pass = 0, fail = 0
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ' — ' + detail : ''}`)
  ok ? pass++ : fail++
}
const preview = spawn(resolve(root, 'node_modules/.bin/vite'), ['preview', '--port', String(PORT), '--strictPort'], { cwd: root, stdio: 'ignore' })
const broker = PeerServer({ port: PEER_PORT, path: '/mr', host: '127.0.0.1' })
await new Promise((r) => setTimeout(r, 2500))
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--enable-unsafe-swiftshader', '--use-angle=swiftshader'] })
const issues = { A: [], B: [], C: [], D: [] }
async function boot(tag) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } })
  const page = await ctx.newPage()
  await page.addInitScript(() => {
    window.__NIGHT_SEED__ = 42
    try { localStorage.setItem('moonrest-settings-v1', JSON.stringify({ settingsV: 2, memoryMode: 'n64', resScale: 1 })) } catch (e) {}
  })
  page.on('console', (m) => { if (m.type() === 'error') issues[tag].push(`[${tag}] ${m.text()}`) })
  page.on('pageerror', (e) => issues[tag].push(`[${tag} pageerror] ${e.message}`))
  await page.goto(`http://localhost:${PORT}/`)
  await page.waitForFunction(() => window.__MOONREST__?.ready)
  await page.evaluate((pp) => {
    window.__PEER_OPTS__ = { host: '127.0.0.1', port: pp, path: '/mr' }
    window.__MOONREST__.suppressNightEnd(true)
    window.__MOONREST__.skipIntro()
  }, PEER_PORT)
  return { ctx, page }
}
try {
  const A = await boot('A')
  const B = await boot('B')
  const C = await boot('C')
  const code = await A.page.evaluate(() => window.__MOONREST__.hostNight('aldous'))
  await B.page.evaluate((c) => window.__MOONREST__.joinNight(c, 'bertie'), code)
  await C.page.evaluate((c) => window.__MOONREST__.joinNight(c, 'cosmo'), code)
  await new Promise((r) => setTimeout(r, 1100))

  // — the host deals a THREE-seat dream —
  const dealt = await A.page.evaluate(() => window.__MOONREST__.fight.startOnline('beldam'))
  check('host deals a synchronized dream', dealt === true)
  const bothIn = async (page) => {
    try { await page.waitForFunction(() => window.__MOONREST__.fight.active, null, { timeout: 8000 }); return true } catch { return false }
  }
  check('host enters the dream', await bothIn(A.page))
  check('client tunnels into the SAME dream', await bothIn(B.page))
  check('second client tunnels in too (3 human seats)', await bothIn(C.page))

  // — inputs flow both ways: A walks right, B walks left —
  const kd = (page, code2) => page.evaluate((c) => {
    const e = new KeyboardEvent('keydown', { code: c, key: c, bubbles: true })
    window.dispatchEvent(e); document.dispatchEvent(e)
  }, code2)
  await kd(A.page, 'KeyD')
  await kd(B.page, 'KeyA')
  // observation window: long enough that even a CPU-throttled 4-context box
  // (host + 2 seats + broker + vite, all on a shared runner) advances past
  // 120 ticks and hits ≥2 shared 60-tick hash checkpoints. The assertions
  // below (advance, sync Δ, three-way hash equality) are unchanged — only
  // the wall-clock budget grows, so a slow runner doesn't false-fail
  // determinism that IS holding (DECISIONS #11: env tolerance, not a weaker
  // check). The sim is 0.018ms/tick; the limiter is SwiftShader's rAF rate.
  await new Promise((r) => setTimeout(r, 7000))
  const sA = await A.page.evaluate(() => window.__MOONREST__.fight.state())
  const sB = await B.page.evaluate(() => window.__MOONREST__.fight.state())
  if (!sA || !sB) {
    console.log('EARLY ISSUES:', JSON.stringify({ A: issues.A.slice(0, 4), B: issues.B.slice(0, 4) }))
    throw new Error('dream never entered')
  }
  check('lockstep advances on both peers', sA.tick > 120 && sB.tick > 120, `tickA=${sA.tick} tickB=${sB.tick}`)
  check('peers run within a breath of each other', Math.abs(sA.tick - sB.tick) < 45, `Δ=${Math.abs(sA.tick - sB.tick)}`)
  check("A's fighter walked right on A's keys", sA.fighters[0].x > -5.5, `x=${sA.fighters[0].x}`)
  check("B's REMOTE input moved seat 2 on A's sim", sA.fighters[1].x < 5.5, `x=${sA.fighters[1].x}`)

  // — determinism heartbeats: identical state on ALL THREE at shared ticks —
  const sC = await C.page.evaluate(() => window.__MOONREST__.fight.state())
  const reach = Math.min(sA.tick, sB.tick, sC.tick)
  const hashTicks = []
  for (let t = 60; t <= reach; t += 60) hashTicks.push(t)
  let allMatch = hashTicks.length >= 2, detail = []
  for (const t of hashTicks) {
    const hA = await A.page.evaluate((t2) => window.__MOONREST__.fight.netHash(t2), t)
    const hB = await B.page.evaluate((t2) => window.__MOONREST__.fight.netHash(t2), t)
    const hC = await C.page.evaluate((t2) => window.__MOONREST__.fight.netHash(t2), t)
    const ok = hA != null && hA === hB && hA === hC
    if (!ok) { allMatch = false; detail.push(`t${t}: ${String(hA).slice(0, 30)}|${String(hB).slice(0, 30)}|${String(hC).slice(0, 30)}`) }
  }
  check(`determinism heartbeats MATCH three-way (${hashTicks.length} shared ticks)`, allMatch, detail.join(' ; ') || `${hashTicks.length}/${hashTicks.length} identical`)
  const stalledA = await A.page.evaluate(() => window.__MOONREST__.fight.netStalled)
  check('stall count stays sane on a local wire', stalledA != null && stalledA < 400, `stalled=${stalledA}`)

  // — the fourth lantern arrives LATE and spectates as a firefly —
  const D = await boot('D')
  await D.page.evaluate((c) => window.__MOONREST__.joinNight(c, 'dimity'), code)
  let dIn = false
  try { await D.page.waitForFunction(() => window.__MOONREST__.fight.active, null, { timeout: 9000 }); dIn = true } catch { dIn = false }
  const dSeat = dIn ? await D.page.evaluate(() => window.__MOONREST__.fight.netSeat) : null
  check('late joiner is dealt the dream as a spectator firefly', dIn && dSeat === -1, `in=${dIn} seat=${dSeat}`)

  check('console clean (all four contexts)', issues.A.length + issues.B.length + issues.C.length + (issues.D?.length ?? 0) === 0, [...issues.A, ...issues.B, ...issues.C, ...(issues.D ?? [])].slice(0, 3).join(' | '))
} finally {
  await browser.close()
  preview.kill()
  broker.close?.()
}
console.log(fail === 0 ? 'FIGHTONLINE PASS' : `FIGHTONLINE: ${fail} FAILURES`)
process.exit(fail === 0 ? 0 : 1)
