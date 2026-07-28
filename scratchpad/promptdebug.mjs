#!/usr/bin/env node
import { spawn } from 'node:child_process'
import { resolve } from 'node:path'
import { chromium } from 'playwright'
const root = '/home/user/gh-studio'
const PORT = 4190
const preview = spawn(resolve(root, 'node_modules/.bin/vite'), ['preview', '--port', String(PORT), '--strictPort'], { cwd: root, stdio: 'ignore' })
await new Promise((r) => setTimeout(r, 2500))
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--enable-unsafe-swiftshader', '--use-angle=swiftshader'] })
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } })
await page.addInitScript(() => { window.__NIGHT_SEED__ = 42; try { localStorage.setItem('moonrest-settings-v1', JSON.stringify({ settingsV: 2, memoryMode: 'n64', resScale: 1 })) } catch (e) {} })
await page.goto(`http://localhost:${PORT}/`)
await page.waitForFunction(() => window.__MOONREST__?.ready)
await page.waitForTimeout(800)
await page.keyboard.press('q')
await page.waitForTimeout(400)
await page.evaluate(() => window.__MOONREST__.teleportPlayer(4.2, -17.8, Math.PI))
await page.waitForTimeout(900)
const samples = await page.evaluate(() => new Promise((done) => {
  const t0 = performance.now()
  const out = []
  const poll = () => {
    const on = document.querySelector('#ui .prompt')?.classList.contains('on')
    out.push(`${Math.round(performance.now() - t0)}:${on ? 1 : 0}`)
    if (performance.now() - t0 > 2000) done(out.join(' '))
    else setTimeout(poll, 100)
  }
  poll()
}))
console.log('SAMPLES', samples)
const out = await page.evaluate(() => {
  const M = window.__MOONREST__
  const p = document.querySelector('#ui .prompt')
  return {
    promptClass: p?.className, promptText: p?.textContent?.slice(0, 40),
    mode: M.state.mode, screen: M.state.screen, action: M.state.action,
    pos: M.f0.pos(), rest: M.f0.rest(),
  }
})
console.log(JSON.stringify(out, null, 1))
await browser.close(); preview.kill()
