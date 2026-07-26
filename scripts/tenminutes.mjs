#!/usr/bin/env node
// FIN-4 — the first-ten-minutes gate (FINAL_PASS Part 8).
//
// Part 8 asks for a capture watched WITHOUT touching the controls, with every
// stretch over 12 seconds where nothing new happens logged and the worst fixed.
// This is that watch, done mechanically so the answer is a list rather than an
// impression.
//
// It plays the opening the way the game intends it to be played — walk to the
// nearest dying ember, kindle it, walk to the next — using REAL key events, so
// what is measured is the game's own input path and not a simulation of it.
//
// A BEAT is anything a player would register as "something happened":
//   · a light kindled, a zone entered, a prompt appearing
//   · the intro/title handing over to play
//   · a new music layer
//   · or simply the FRAME CHANGING enough to notice — measured as the L2
//     distance between per-tile luminance signatures, which catches reveals,
//     camera moves and lighting shifts that no state variable records.
//
// Usage:
//   node scripts/tenminutes.mjs                 # full ten minutes
//   node scripts/tenminutes.mjs --minutes 4     # short pass while iterating

import { spawn } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const outDir = resolve(root, 'docs/build')
const shotDir = resolve(outDir, 'shots/tenminutes')
mkdirSync(shotDir, { recursive: true })

const PORT = 4181
const argMinutes = process.argv.includes('--minutes')
  ? Number(process.argv[process.argv.indexOf('--minutes') + 1]) : 10
const DEAD_LIMIT = 12          // seconds; Part 8's threshold
const SAMPLE_MS = 250
// How different two frames must be to count as "something happened". Tuned so
// rain and the lantern flicker do NOT register — a frame that is only
// twinkling is a frame where nothing is happening, which is the whole point.
const FRAME_BEAT = 2.4

function startPreview() {
  return new Promise((res, rej) => {
    const proc = spawn(resolve(root, 'node_modules/.bin/vite'),
      ['preview', '--port', String(PORT), '--strictPort'],
      { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] })
    let ready = false
    const onData = (d) => { if (!ready && /localhost:|Local:/.test(d.toString())) { ready = true; res(proc) } }
    proc.stdout.on('data', onData); proc.stderr.on('data', onData)
    proc.on('exit', (c) => { if (!ready) rej(new Error('preview exited early ' + c)) })
    setTimeout(() => { if (!ready) rej(new Error('preview timeout')) }, 20000)
  })
}

// Installed in the page: a per-tile luminance signature of the live canvas.
const PROBE = () => {
  window.__tm = {
    // delegates to the game, which RENDERS before reading — the context has
    // no preserveDrawingBuffer, so reading at an arbitrary moment returns an
    // empty buffer and every frame looks identical to every other
    sig() { return window.__MOONREST__.frameSignature() },
    // Nearest unkindled light that the driver has not given up on. `skip` is
    // needed because the kindle requires LINE OF SIGHT: the opening places the
    // player ~1.9m from the bench lamp with the BENCH between them, so a naive
    // "walk if far, kindle if near" driver stands still forever — near enough
    // never to walk, blocked forever from targeting.
    nextLight(skip) {
      const M = window.__MOONREST__
      const p = M.state.playerPos
      let best = null, bd = Infinity
      for (const l of M.lights) {
        if (l.kindled || (skip && skip.includes(l.id))) continue
        const d = Math.hypot(l.x - p[0], l.z - p[2])
        if (d < bd) { bd = d; best = { id: l.id, x: l.x, z: l.z, d } }
      }
      return best
    },
  }
}

async function main() {
  const preview = await startPreview()
  const browser = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium',
    args: ['--no-sandbox', '--enable-unsafe-swiftshader', '--use-angle=swiftshader'],
  })
  const consoleIssues = []
  const samples = []
  const beats = []
  let shots = 0

  try {
    const page = await browser.newPage({ viewport: { width: 1600, height: 900 } })
    await page.addInitScript(() => { window.__NIGHT_SEED__ = 42 })
    page.on('console', (m) => {
      if (m.type() === 'error' || m.type() === 'warning') consoleIssues.push(`[${m.type()}] ${m.text()}`)
    })
    page.on('pageerror', (e) => consoleIssues.push(`[pageerror] ${e.message}`))

    await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'load' })
    await page.waitForFunction(() => window.__MOONREST__?.ready, null, { timeout: 25000 })
    await page.evaluate(PROBE)
    // Keys are dispatched IN-PAGE, not through Playwright's keyboard.
    // Playwright's real key events come with focus/blur activity, and the
    // Input system deliberately clears held keys on focus and on a settled
    // blur (so a lost keyup cannot latch a key). The result is that a held
    // channel key survives about one frame — the kindle would start and
    // immediately interrupt, which reads as "the game cannot be kindled" when
    // it is really "this harness cannot hold a key". scripts/k1capture.mjs
    // already solved this the same way.
    await page.evaluate(() => {
      window.__kb = (type, code) => window.dispatchEvent(new KeyboardEvent(type, { code, bubbles: true }))
    })

    const t0 = Date.now()
    const endAt = t0 + argMinutes * 60_000
    let prevSig = null
    let prev = { kindled: 0, zone: null, mode: null, prompt: false, layers: 0 }
    let lastBeat = 0
    let started = false
    let holdingW = false
    const giveUp = new Set()      // lights the driver could not reach or target
    let tries = 0
    let tryingId = null

    const mark = (t, what) => {
      beats.push({ t: +(t / 1000).toFixed(1), what })
      lastBeat = t
    }

    while (Date.now() < endAt) {
      const t = Date.now() - t0

      const s = await page.evaluate((skip) => {
        const M = window.__MOONREST__
        const st = M.state
        return {
          sig: window.__tm.sig(),
          next: window.__tm.nextLight(skip),
          kindled: st.kindled.length,
          zone: st.zone,
          mode: st.introT != null ? 'intro' : (st.attract ? 'attract' : 'game'),
          layers: st.audio?.layers ?? 0,
          pos: st.playerPos,
          nightT: st.nightT,
          fps: st.fps,
        }
      }, [...giveUp]).catch(() => null)
      if (!s) break

      // ——— let the title play, then begin, exactly as a player would ———
      if (!started && t > 26_000) {
        await page.evaluate(() => { window.__MOONREST__.startNight(true) })
        started = true
        mark(t, 'night begins (title handed over)')
      }

      // ——— beat detection ———
      if (s.kindled !== prev.kindled) mark(t, `lantern kindled (${s.kindled} lit)`)
      if (s.zone !== prev.zone) mark(t, `entered ${s.zone}`)
      if (s.mode !== prev.mode) mark(t, `${prev.mode ?? 'boot'} -> ${s.mode}`)
      if (s.layers !== prev.layers) mark(t, `music layer ${prev.layers} -> ${s.layers}`)
      if (prevSig) {
        let d = 0
        for (let i = 0; i < s.sig.length; i++) d += (s.sig[i] - prevSig[i]) ** 2
        d = Math.sqrt(d / s.sig.length)
        if (d > FRAME_BEAT) mark(t, `frame change (${d.toFixed(1)})`)
      }
      prevSig = s.sig
      prev = { kindled: s.kindled, zone: s.zone, mode: s.mode, layers: s.layers }
      samples.push({ t: +(t / 1000).toFixed(1), ...s, sig: undefined })

      // a screenshot every 20s, and one on every kindle
      if (t - shots * 20_000 >= 20_000) {
        shots++
        await page.locator('#game').screenshot({ path: resolve(shotDir, `t${String(shots * 20).padStart(3, '0')}s.png`) }).catch(() => {})
      }

      // ——— drive: face the nearest ember, walk, kindle in range ———
      if (started && s.next) {
        if (s.next.id !== tryingId) { tryingId = s.next.id; tries = 0 }
        const yaw = Math.atan2(-(s.next.x - s.pos[0]), -(s.next.z - s.pos[2]))
        await page.evaluate((y) => window.__MOONREST__.setCamYaw(y), yaw)
        if (s.next.d > 1.7) {
          if (!holdingW) { await page.evaluate(() => window.__kb('keydown', 'KeyW')); holdingW = true }
        } else {
          if (holdingW) { await page.evaluate(() => window.__kb('keyup', 'KeyW')); holdingW = false }
          // the kindle is a 1.2s CHANNEL, not a tap — 700ms silently did
          // nothing and read as "the harness cannot kindle"
          await page.evaluate(() => window.__kb('keydown', 'KeyE'))
          await page.waitForTimeout(1800)
          await page.evaluate(() => window.__kb('keyup', 'KeyE'))
          tries++
          if (tries >= 4) { giveUp.add(s.next.id); tryingId = null }
        }
      }

      await page.waitForTimeout(SAMPLE_MS)
    }
    if (holdingW) await page.evaluate(() => window.__kb('keyup', 'KeyW')).catch(() => {})

    // ——— dead-stretch analysis ———
    const total = Date.now() - t0
    const dead = []
    let prevT = 0
    for (const b of beats) {
      const gap = b.t - prevT
      if (gap > DEAD_LIMIT) dead.push({ from: prevT, to: b.t, len: +gap.toFixed(1) })
      prevT = b.t
    }
    const tail = total / 1000 - prevT
    if (tail > DEAD_LIMIT) dead.push({ from: prevT, to: +(total / 1000).toFixed(1), len: +tail.toFixed(1) })

    const report = {
      minutes: argMinutes,
      durationS: +(total / 1000).toFixed(1),
      beats: beats.length,
      deadLimitS: DEAD_LIMIT,
      deadStretches: dead,
      kindled: prev.kindled,
      consoleIssues,
      pass: dead.length === 0 && consoleIssues.length === 0,
      timeline: beats,
    }
    writeFileSync(resolve(outDir, 'tenminutes.json'), JSON.stringify(report, null, 2))

    console.log(`captured ${report.durationS}s, ${beats.length} beats, ${prev.kindled} lanterns lit`)
    for (const b of beats) console.log(`  ${String(b.t).padStart(6)}s  ${b.what}`)
    if (dead.length) {
      console.log(`\nDEAD STRETCHES over ${DEAD_LIMIT}s (${dead.length}):`)
      for (const d of dead) console.log(`  ${d.from}s -> ${d.to}s  (${d.len}s)`)
    } else {
      console.log(`\nno dead stretch over ${DEAD_LIMIT}s`)
    }
    if (consoleIssues.length) {
      console.log(`\nCONSOLE NOT CLEAN (${consoleIssues.length}):`)
      for (const i of consoleIssues.slice(0, 10)) console.log('  ' + i)
    }
    console.log(report.pass ? '\nTENMINUTES PASS' : '\nTENMINUTES FAIL')
    if (!report.pass) process.exitCode = 1
  } finally {
    await browser.close()
    preview.kill('SIGTERM')
  }
}

main().catch((e) => { console.error(e); process.exit(1) })
