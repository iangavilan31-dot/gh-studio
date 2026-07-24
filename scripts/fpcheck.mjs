import { spawn } from 'node:child_process'
import { resolve } from 'node:path'
import { chromium } from 'playwright'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const PORT = 4183
const preview = spawn(resolve(root, 'node_modules/.bin/vite'), ['preview', '--port', String(PORT), '--strictPort'], { cwd: root, stdio: 'ignore' })
await new Promise((r) => setTimeout(r, 2500))
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--enable-unsafe-swiftshader', '--use-angle=swiftshader'] })
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } })
await page.addInitScript(() => { window.__NIGHT_SEED__ = 42 }) // D.1: rigs run a pinned night signature
// judge-facing capture: default Restored pipeline (dither 0.15, native res)
const issues = []
page.on('pageerror', (e) => issues.push(e.message))
page.on('console', (m) => { if (m.type() === 'error') issues.push(m.text()) })
await page.goto(`http://localhost:${PORT}/`)
await page.waitForFunction(() => window.__MOONREST__?.ready)
console.log('signature:', JSON.stringify(await page.evaluate(() => window.__MOONREST__.nightSignature)))
// the frame must PROVE first person: two meters from a lamp the keeper
// just lit, its pool at their feet, the low moon behind it
await page.evaluate(() => window.__MOONREST__.kindle('park-bench-lamp'))
await page.evaluate(() => window.__MOONREST__.teleportPlayer(6.5, -17, 0.81))
await page.evaluate(() => { window.__MOONREST__.skipTo(34); window.__MOONREST__.setCamYaw(0.81) })
await page.waitForTimeout(600)
await page.keyboard.press('v')
await page.waitForTimeout(900)
const st = await page.evaluate(() => window.__MOONREST__.state)
console.log('viewMode:', st.viewMode, 'rigVisible:', st.rigVisible, 'camDist:', st.camDist)
await page.locator('#game').screenshot({ path: root + '/docs/build/shots/anim/firstperson.png' })
const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('moonrest-settings-v1')).viewMode)
console.log('persisted viewMode:', saved)
await page.reload()
await page.waitForFunction(() => window.__MOONREST__?.ready)
await page.evaluate(() => window.__MOONREST__.teleportPlayer(-5.6, -28, 2.4))
await page.waitForTimeout(700)
const st2 = await page.evaluate(() => window.__MOONREST__.state)
console.log('after reload viewMode:', st2.viewMode, 'rigVisible:', st2.rigVisible)
console.log('errors:', issues.length ? issues.slice(0,3) : 'none')
await browser.close(); preview.kill()
