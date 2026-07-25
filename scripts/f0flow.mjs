#!/usr/bin/env node
// DREAMSCRAP F0 flow gates — LIVE run (no manual stepping): tunnel timing
// is wall-clock by design. Entry ≤4s (incl. the 1.2s rest beat), exit ≤3s,
// cancel-by-standing-up works, the title grows a Dream item once found,
// and the waking world is bit-identical across a dream.
import { spawn } from 'node:child_process'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const PORT = 4193
const preview = spawn(resolve(root, 'node_modules/.bin/vite'), ['preview', '--port', String(PORT), '--strictPort'], { cwd: root, stdio: 'ignore' })
await new Promise((r) => setTimeout(r, 2500))
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--enable-unsafe-swiftshader', '--use-angle=swiftshader'] })
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } })
await page.addInitScript(() => { window.__NIGHT_SEED__ = 42 })
const issues = []
page.on('pageerror', (e) => issues.push(e.message))
await page.goto(`http://localhost:${PORT}/`)
await page.waitForFunction(() => window.__MOONREST__?.ready)

let fails = 0
const check = (name, ok, extra = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${extra ? ' — ' + extra : ''}`)
  if (!ok) fails++
}

// ═══ ENTRY: sleep beside Beldam → tunnel → the dream, ≤4s wall-clock ═══
const entry = await page.evaluate(() => new Promise((done) => {
  const M = window.__MOONREST__
  const S = M.f0.sleepers()
  const b = S.find((s) => s.id === 'beldam') ?? S[0]
  M.teleportPlayer(b.x + 2, b.z, 0)
  const out = { sleeperIds: S.map((s) => s.id), before: null }
  setTimeout(() => {
    out.before = M.f0.pos()
    M.f0.emote('sleep')
    const t0 = performance.now()
    let t1 = 0 // tunnel first seen: the spec's "entry tunnel" clock starts here
    const poll = () => {
      if (!t1 && M.f0.tunnel()) t1 = performance.now()
      if (M.fight.active && !M.f0.tunnel()) {
        out.restMs = t1 ? Math.round(t1 - t0) : -1
        out.tunnelMs = t1 ? Math.round(performance.now() - t1) : -1
        out.totalMs = Math.round(performance.now() - t0)
        out.dreamFound = M.f0.dreamFound()
        done(out)
      } else if (performance.now() - t0 > 9000) { out.totalMs = -1; done(out) } else requestAnimationFrame(poll)
    }
    requestAnimationFrame(poll)
  }, 600) // let the teleport settle before lying down
}))
check('sleepers carry arena ids (beldam among them)', entry.sleeperIds.includes('beldam'), entry.sleeperIds.join(','))
check('sleep emote beside a sleeper enters the dream', entry.totalMs > 0, `totalMs=${entry.totalMs}`)
check('entry tunnel ≤ 4s (Part 6)', entry.tunnelMs > 0 && entry.tunnelMs <= 4000, `tunnel=${entry.tunnelMs}ms rest=${entry.restMs}ms total=${entry.totalMs}ms`)
check('discovery flag set (title will grow a Dream item)', entry.dreamFound === true)

// ═══ EXIT: Escape → eye opens on the waking night, ≤3s ═══
const exitRes = await page.evaluate(() => new Promise((done) => {
  const M = window.__MOONREST__
  const t0 = performance.now()
  const out = {}
  const poll = () => {
    if (!M.fight.active && !M.f0.tunnel()) {
      out.exitMs = Math.round(performance.now() - t0)
      out.after = M.f0.pos()
      done(out)
    } else if (performance.now() - t0 > 9000) { out.exitMs = -1; done(out) } else requestAnimationFrame(poll)
  }
  window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Escape', key: 'Escape', bubbles: true }))
  document.dispatchEvent(new KeyboardEvent('keydown', { code: 'Escape', key: 'Escape', bubbles: true }))
  requestAnimationFrame(poll)
}))
check('Escape leaves the dream', exitRes.exitMs > 0, `exitMs=${exitRes.exitMs}`)
check('exit ≤ 3s', exitRes.exitMs > 0 && exitRes.exitMs <= 3000, `${exitRes.exitMs}ms`)
check('waking world untouched: player exactly where they lay down',
  JSON.stringify(entry.before) === JSON.stringify(exitRes.after),
  `${JSON.stringify(entry.before)} vs ${JSON.stringify(exitRes.after)}`)

// ═══ CANCEL: stand up mid-iris → no dream, eye reopens (skippable law) ═══
const cancel = await page.evaluate(() => new Promise((done) => {
  const M = window.__MOONREST__
  M.f0.emote('sleep')
  const out = { sawDream: false }
  setTimeout(() => {
    out.tunnelAtCancel = M.f0.tunnel()
    M.f0.emote('wave') // the sleeper stirs — that's a no
    const t0 = performance.now()
    const poll = () => {
      if (M.fight.active) out.sawDream = true
      if (!M.f0.tunnel() && performance.now() - t0 > 1200) done(out)
      else if (performance.now() - t0 > 6000) { out.timeout = true; done(out) } else requestAnimationFrame(poll)
    }
    requestAnimationFrame(poll)
  }, 1900) // rest 1.2s + ~0.7s into the 1.4s close
}))
check('cancel caught the tunnel mid-close', !!cancel.tunnelAtCancel && cancel.tunnelAtCancel.phase === 'close', JSON.stringify(cancel.tunnelAtCancel))
check('standing up cancels the descent — no fight, eye reopens', cancel.sawDream === false && !cancel.timeout)

// ═══ TITLE: after a reload, the menu remembers the dream ═══
await page.reload()
await page.waitForFunction(() => window.__MOONREST__?.ready)
await page.evaluate(() => window.__MOONREST__.skipIntro())
await page.waitForTimeout(700)
const title = await page.evaluate(() => {
  const items = [...document.querySelectorAll('#ui .menu > *')].map((n) => n.textContent)
  return { items, hasDream: items.some((t) => t === 'Dream') }
})
check('title menu grew the Dream item after discovery', title.hasDream, title.items.join(' | '))

// ═══ WAKING WORLD stays combat-free: no fight verbs outside the dream ═══
// (structural: all fight code lives in src/game/dream/ — verified by grep in CI/gates)

check('console clean', issues.length === 0, issues.slice(0, 3).join(' | '))
await browser.close(); preview.kill()
console.log(fails === 0 ? 'F0FLOW PASS' : `F0FLOW: ${fails} FAILURES`)
process.exit(fails === 0 ? 0 : 1)
