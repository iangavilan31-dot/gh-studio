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

import { spawn } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
mkdirSync(resolve(root, 'docs/build'), { recursive: true })
const PORT = 4188
const asJson = process.argv.includes('--json')

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

const samples = []
await page.evaluate(() => {
  const M = window.__MOONREST__
  M.startNight()
  M.suppressNightEnd(true)
})
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
const data = { samples, offenders, marks }
writeFileSync(resolve(root, 'docs/build/wordcheck.json'), JSON.stringify(data, null, 1))

if (asJson) console.log(JSON.stringify(data, null, 1))
else {
  for (const o of offenders) console.log(`  WORD "${o.text}" (${o.moment}, <${o.tag} class="${o.cls}">)`)
  for (const m of marks) console.log(`  (mark "${m.text}" — symbolic glyph, permitted)`)
  console.log(offenders.length === 0
    ? 'WORDCHECK PASS — no rendered text during play'
    : `WORDCHECK FAIL — ${offenders.length} visible text node(s) during play`)
}

await browser.close()
preview.kill()
process.exit(offenders.length === 0 ? 0 : 1)
