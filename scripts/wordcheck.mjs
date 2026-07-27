#!/usr/bin/env node
// FIN-4 — zero words in the shipped game (FINAL_PASS Part 4).
//
// The rule is absolute, and the permitted total is small: numbers in settings,
// the title, and up to eight lines of credits. Everything else the player sees
// must carry its meaning without language — the interact ring fills instead of
// saying "kindle", a lantern glows instead of saying "lit".
//
// Nothing checked this, and it had been broken the whole time: HUD.showPrompt
// wrote its verb straight into textContent, so every interactable in the game
// captioned itself. It went unnoticed because the shoot rig photographs
// cinematic poses with the HUD hidden — the first screenshot of a PLAYED
// moment had the word "kindle" sitting in the middle of it.
//
// This walks the DOM for text that is actually visible during play.
//
// Usage: node scripts/wordcheck.mjs [--json]

import { spawn, execSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
mkdirSync(resolve(root, 'docs/build'), { recursive: true })
const PORT = 4188
const asJson = process.argv.includes('--json')

// STATIC scan first. The runtime hook only sees beats the drive happens to
// trigger — it found one of the prose strings in the build, because it reached
// one moment. Source is exhaustive: every call site, whether or not any
// playthrough reaches it. The two together are the gate; either alone lies.
let staticProse = []
try {
  const pattern = String.raw`(say|sayLater)\(['"\x60][^'"\x60]{6,}`
  const out = execSync(`grep -rnoE ${JSON.stringify(pattern)} ${resolve(root, 'src/game')} --include=*.js || true`,
    { encoding: 'utf8' })
  staticProse = out.split('\n').filter(Boolean)
    .filter((l) => /[A-Za-z]+[\s\u2019',.!?]+[A-Za-z]+/.test(l.slice(l.indexOf('(') + 1)))
} catch (e) { staticProse = [`SCAN FAILED: ${e.message}`] }

const preview = spawn(resolve(root, 'node_modules/.bin/vite'),
  ['preview', '--port', String(PORT), '--strictPort'], { cwd: root, stdio: 'ignore' })
await new Promise((r) => setTimeout(r, 2500))

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium',
  args: ['--no-sandbox', '--enable-unsafe-swiftshader', '--use-angle=swiftshader'],
})
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } })
await page.addInitScript(() => { window.__NIGHT_SEED__ = 42 })
await page.goto(`http://localhost:${PORT}/?lit=0`)
await page.waitForFunction(() => window.__MOONREST__?.ready)
await page.waitForTimeout(1200)

// Collect visible text while PLAYING — not on the title, which is allowed to
// have a title, and not in settings, which is allowed to have numbers.
const scan = () => page.evaluate(() => {
  const found = []
  const walk = (el) => {
    const cs = getComputedStyle(el)
    if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity === 0) return
    for (const n of el.childNodes) {
      if (n.nodeType === 3) {
        const t = n.textContent.trim()
        if (t) found.push({ text: t, tag: el.tagName.toLowerCase(), cls: el.className || null })
      } else if (n.nodeType === 1) walk(n)
    }
  }
  for (const rootEl of document.body.children) {
    if (rootEl.id === 'game') continue          // the canvas is not DOM text
    walk(rootEl)
  }
  return found
})

// HOOK the HUD, do not sample it.
//
// The first version of this gate scanned the DOM at two moments and reported
// PASS while 23 hud.say() sites were rendering full English sentences —
// including a four-sentence Beldam bark in the frame the project was using as
// proof its opening was wordless. A timed subtitle is structurally invisible to
// a snapshot: it appears and leaves between samples.
//
// So: wrap every HUD method that can put language on screen and record every
// call, then drive the game and let it try. A method that is never called
// cannot hide from this, and a bark that lasts 200ms cannot either.
await page.evaluate(() => {
  const M = window.__MOONREST__
  const hud = M.__hud
  window.__SPOKEN__ = []
  // Fail loudly rather than silently passing. The first attempt at this hook
  // found no HUD (the test surface did not expose it), so it wrapped nothing,
  // recorded nothing, and the gate reported PASS — a gate that cannot reach its
  // subject must say so, not go green.
  window.__HOOKED__ = !!hud
  if (hud) {
    for (const name of ['say', 'sayLater', 'showPrompt', 'setSubtitle']) {
      const orig = hud[name]
      if (typeof orig !== 'function') continue
      hud[name] = function (...args) {
        const txt = typeof args[0] === 'string' ? args[0] : ''
        if (txt) window.__SPOKEN__.push({ method: name, text: txt })
        return orig.apply(this, args)
      }
    }
  }
  M.startNight()
  M.suppressNightEnd(true)
})

const samples = []
await page.waitForTimeout(600)
samples.push({ moment: 'night-start', text: await scan() })

// walk into interact range of the nearest light so the prompt is showing
await page.evaluate(async () => {
  const M = window.__MOONREST__
  const s = M.state
  let best = null, bd = Infinity
  for (const l of M.lights) {
    if (l.kindled) continue
    const d = Math.hypot(l.x - s.playerPos[0], l.z - s.playerPos[2])
    if (d < bd) { bd = d; best = l }
  }
  if (best) M.teleportPlayer(best.x + 1.2, best.z + 1.2, 0)
})
await page.waitForTimeout(900)
samples.push({ moment: 'prompt-showing', text: await scan() })

// Drive: walk to several lights, kindle them, and poll the DOM throughout, so
// timed subtitles and moment barks get a chance to fire and be seen.
for (let leg = 0; leg < 6; leg++) {
  await page.evaluate(async () => {
    const M = window.__MOONREST__
    const kb = (t, c) => window.dispatchEvent(new KeyboardEvent(t, { code: c, bubbles: true }))
    const s = M.state
    let best = null, bd = Infinity
    for (const l of M.lights) {
      if (l.kindled) continue
      const d = Math.hypot(l.x - s.playerPos[0], l.z - s.playerPos[2])
      if (d < bd) { bd = d; best = l }
    }
    if (!best) return
    M.teleportPlayer(best.x + 1.4, best.z + 1.4, 0)
    await new Promise((r) => setTimeout(r, 250))
    kb('keydown', 'KeyE')
    await new Promise((r) => setTimeout(r, 2500))
    kb('keyup', 'KeyE')
  })
  for (let i = 0; i < 8; i++) {
    await page.waitForTimeout(250)
    samples.push({ moment: `drive-${leg}-${i}`, text: await scan() })
  }
}
const spoken = await page.evaluate(() => window.__SPOKEN__ || [])
const hooked = await page.evaluate(() => window.__HOOKED__ === true)
if (!hooked) {
  console.error('WORDCHECK FAIL — could not hook the HUD (window.__MOONREST__.__hud missing); this gate cannot verify anything without it')
  await browser.close(); preview.kill(); process.exit(1)
}

// What counts as a WORD.
//
// The rule bans language, not marks. The interact ring carries a single rune —
// ᚲ, Kaunan, the torch rune — and that is iconography doing the same job as an
// arrow or a flame symbol: nobody reads it, they recognise it. A player who has
// never seen a rune learns it means "there is something here" the first time
// the ring fills, which is exactly how a wordless prompt is supposed to teach.
//
// So: any Latin letter is a word and fails. A lone non-Latin symbolic glyph is
// a mark and passes. This is a judgement, recorded here rather than buried in an
// allowlist, and it is the human's to overrule — if the intent is literally no
// glyphs at all, delete this and the rune goes with it.
const isWord = (t) => /[A-Za-z]/.test(t) || t.replace(/\s/g, '').length > 1
const all = samples.flatMap((s) => s.text.map((t) => ({ moment: s.moment, ...t })))
const marks = all.filter((t) => !isWord(t.text))
const offenders = all.filter((t) => isWord(t.text))
// Anything routed through a HUD text method is a violation whether or not it
// reached the DOM — a subtitle that is merely hidden by CSS is still the game
// trying to speak, and the next person to restyle it ships words again.
// Two different things, and conflating them makes the report useless:
//
//   PROSE  — a sentence the game means to display. `say("...ah. The
//            Lamplighter's up. Roads are dark, friend.")`. A violation even
//            when CSS currently hides it, because the next person to restyle
//            the subtitle ships words again.
//   TOKEN  — a single-word identifier that is never rendered.
//            `showPrompt("kindle")` writes a data attribute the rigs and the
//            accessibility layer read; nothing reaches the screen.
const isProse = (t) => /[A-Za-z]+[\s\u2019',.!?]+[A-Za-z]+/.test(t)
const prose = spoken.filter((x) => isProse(x.text))
const tokens = spoken.filter((x) => !isProse(x.text))
for (const x of prose) offenders.push({ moment: 'hud-prose', text: `${x.method}("${x.text.slice(0, 70)}")`, tag: 'hud', cls: x.method })
const data = { samples, offenders, marks, spoken, prose, tokens: tokens.length, staticProse }
writeFileSync(resolve(root, 'docs/build/wordcheck.json'), JSON.stringify(data, null, 1))

if (asJson) console.log(JSON.stringify(data, null, 1))
else {
  const rendered = offenders.filter((o) => o.moment !== 'hud-prose')
  const seen = new Set()
  for (const o of rendered) console.log(`  RENDERED "${o.text}" (${o.moment}, <${o.tag} class="${o.cls}">)`)
  for (const o of offenders.filter((o) => o.moment === 'hud-prose')) {
    if (seen.has(o.text)) continue
    seen.add(o.text)
    console.log(`  PROSE ${o.text}`)
  }
  if (marks.length) console.log(`  (${marks.length} symbolic glyph sightings — permitted marks, not words)`)
  if (tokens.length) console.log(`  (${tokens.length} single-word identifier calls, never rendered — permitted)`)
  console.log(`  rendered violations: ${rendered.length} · distinct prose strings reached at runtime: ${seen.size}`)
  console.log(`  prose call sites in source (static scan, exhaustive): ${staticProse.length}`)
  for (const l of staticProse.slice(0, 8)) console.log(`    ${l.replace(root + '/', '')}`)
  if (staticProse.length > 8) console.log(`    ...and ${staticProse.length - 8} more`)
  console.log(offenders.length === 0
    ? 'WORDCHECK PASS — no rendered text during play'
    : `WORDCHECK FAIL — ${offenders.length} visible text node(s) during play`)
}

await browser.close()
preview.kill()
process.exit(offenders.length === 0 && staticProse.length === 0 ? 0 : 1)
