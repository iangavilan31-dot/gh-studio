#!/usr/bin/env node
// Shell hard gate (MASTER_PROMPT 12.1 M8): title over live diorama, pause menu
// counters/shelf, settings persistence, the 4 Memory dials, photo mode, error
// boundary, and the never-alert() rule (checked against the source tree).

import { spawn } from 'node:child_process'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { resolve, dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const PORT = 4183
const shotsDir = resolve(root, 'docs/build/shots')

let pass = 0, fail = 0
function check(name, ok, detail = '') {
  if (ok) { pass++; console.log(`PASS ${name}${detail ? ' — ' + detail : ''}`) }
  else { fail++; console.log(`FAIL ${name}${detail ? ' — ' + detail : ''}`) }
}

// — static rule: no alert/confirm/prompt anywhere in game source —
function walk(dir, out = []) {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f)
    if (statSync(p).isDirectory()) walk(p, out)
    else if (/\.(js|html)$/.test(f)) out.push(p)
  }
  return out
}
const stripComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')
const offenders = walk(resolve(root, 'src/game')).concat([resolve(root, 'index.html')])
  .filter((p) => /(?<![\w.])(alert|confirm|prompt)\s*\(/.test(stripComments(readFileSync(p, 'utf8'))))
check('no alert()/confirm()/prompt() in game source', offenders.length === 0, offenders.join(', '))

const preview = spawn(resolve(root, 'node_modules/.bin/vite'), ['preview', '--port', String(PORT), '--strictPort'], { cwd: root, stdio: 'ignore' })
await new Promise((r) => setTimeout(r, 2500))
const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium',
  args: ['--no-sandbox', '--enable-unsafe-swiftshader', '--use-angle=swiftshader'],
})
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } })
const issues = []
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') issues.push(m.text()) })
page.on('pageerror', (e) => issues.push('pageerror: ' + e.message))

try {
  await page.goto(`http://localhost:${PORT}/`)
  await page.waitForFunction(() => window.__MOONREST__?.ready)
  await page.waitForTimeout(1500)

  // — title over live diorama —
  let d = await page.evaluate(() => window.__MOONREST__.shellDebug())
  check('boots to title over the diorama', d.mode === 'title' && d.screen === 'title')
  const wanted = ['New Night', 'Host Night', 'Join Night', 'Settings', 'Credits']
  check('title menu complete', wanted.every((w) => d.menuItems.includes(w)), JSON.stringify(d.menuItems))
  await page.evaluate(() => document.fonts.ready)
  d = await page.evaluate(() => window.__MOONREST__.shellDebug())
  check('IM Fell / Alegreya bundled + loaded', d.fontsLoaded === true)
  await page.evaluate(() => window.__MOONREST__.skipTo(24))
  await page.waitForTimeout(400)
  await page.locator('#game').screenshot({ path: resolve(shotsDir, 'title.png') })
  await page.locator('#ui').screenshot({ path: resolve(shotsDir, 'title-ui.png') })
  console.log('saved title.png / title-ui.png')

  // — join screen has a code input (no prompt()) —
  await page.getByText('Join Night').click()
  const joinOK = await page.evaluate(() => !!document.querySelector('.shell input.code'))
  check('join screen renders a code field', joinOK)
  await page.getByText('Back').click()
  await page.waitForTimeout(200)

  // — New Night enters the game through the fog fade —
  await page.getByText('New Night').click()
  await page.waitForTimeout(700)
  d = await page.evaluate(() => window.__MOONREST__.shellDebug())
  check('New Night starts the night', d.mode === 'game' && d.screen === null && !d.blocking)

  // — pause menu: counters + shelf + world keeps breathing —
  await page.evaluate(() => {
    window.__MOONREST__.kindle('park-bench-lamp')
    window.__MOONREST__.kindle('park-lantern-1')
    window.__MOONREST__.kindle('park-firefly-jar')
  })
  await page.keyboard.press('Escape')
  await page.waitForTimeout(400)
  d = await page.evaluate(() => window.__MOONREST__.shellDebug())
  check('Esc opens the pause menu', d.screen === 'pause' && d.blocking)
  const counters = await page.evaluate(() => [...document.querySelectorAll('.counter')].map((c) => c.textContent))
  check('pause shows lights + brews counters', counters.some((c) => c.includes('3 / 37')) && counters.some((c) => c.includes('/ 12')), JSON.stringify(counters))
  await page.locator('#game').screenshot({ path: resolve(shotsDir, 'pause.png') })
  console.log('saved pause.png')
  await page.keyboard.press('Escape')
  await page.waitForTimeout(300)

  // — Memory dials —
  await page.evaluate(() => window.__MOONREST__.setMemoryMode('ps1'))
  d = await page.evaluate(() => window.__MOONREST__.shellDebug())
  check('PS1 dial: vertex snap + affine', d.memory.snap === 1 && d.memory.affine === 0.35 && d.memory.softBlur === 0)
  await page.evaluate(() => window.__MOONREST__.setMemoryMode('vhs'))
  d = await page.evaluate(() => window.__MOONREST__.shellDebug())
  check('VHS dial: scanlines + chroma + wobble', d.memory.scanline > 0 && d.memory.chroma > 0 && d.memory.wobble > 0)
  await page.evaluate(() => window.__MOONREST__.teleport('park'))
  await page.waitForTimeout(500)
  await page.locator('#game').screenshot({ path: resolve(shotsDir, 'vhs.png') })
  console.log('saved vhs.png')
  await page.evaluate(() => window.__MOONREST__.setMemoryMode('clean'))
  d = await page.evaluate(() => window.__MOONREST__.shellDebug())
  check('Clean dial: 2× RT, dither off', d.memory.rtW >= 960 && d.memory.quantize === 0)

  // — settings persist across reload —
  await page.evaluate(() => window.__MOONREST__.setMemoryMode('vhs'))
  await page.reload()
  await page.waitForFunction(() => window.__MOONREST__?.ready)
  d = await page.evaluate(() => window.__MOONREST__.shellDebug())
  check('settings persist (localStorage)', d.settings.memoryMode === 'vhs' && d.memory.scanline > 0)
  await page.evaluate(() => window.__MOONREST__.setMemoryMode('n64'))

  // — photo mode —
  await page.evaluate(() => window.__MOONREST__.startNight())
  await page.evaluate(() => window.__MOONREST__.togglePhotoMode(true))
  d = await page.evaluate(() => window.__MOONREST__.shellDebug())
  const hint = await page.evaluate(() => !!document.querySelector('.photohint'))
  check('photo mode: free camera + hint up', d.photo === true && hint)
  await page.evaluate(() => window.__MOONREST__.togglePhotoMode(false))

  // — emote wheel (Part 4.2): hold Tab, pick, release —
  await page.evaluate(() => window.__MOONREST__.teleportPlayer(2, -17, 0))
  await page.keyboard.down('Tab')
  await page.waitForTimeout(700) // software-GL frames are ~80ms; give the wheel a beat
  const wheelUp = await page.evaluate(() => document.querySelector('.emotewheel')?.classList.contains('on'))
  await page.keyboard.press('Digit1')
  await page.waitForTimeout(450)
  await page.keyboard.up('Tab')
  await page.waitForTimeout(400)
  const emoted = await page.evaluate(() => window.__MOONREST__.state.action)
  check('emote wheel: Tab-hold → pick → wave', wheelUp === true && emoted === 'wave', `action=${emoted}`)
  await page.evaluate(() => window.__MOONREST__.setAction(null))

  // — error boundary (synthetic event — no real throw) —
  await page.evaluate(() => window.__MOONREST__.triggerErrorBoundary())
  const err = await page.evaluate(() => document.querySelector('.errorcard')?.textContent ?? '')
  check('error boundary speaks in fiction', err.includes('the night flickered'), err.slice(0, 60))

  check('console clean', issues.length === 0, issues.slice(0, 3).join(' | '))
} finally {
  await browser.close()
  preview.kill('SIGTERM')
}
console.log(fail === 0 ? `SHELL CHECK PASS (${pass}/${pass + fail})` : `SHELL CHECK: ${fail} FAILURES (${pass}/${pass + fail})`)
process.exit(fail === 0 ? 0 : 1)
