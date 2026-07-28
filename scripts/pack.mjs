#!/usr/bin/env node
// Package dist/ into ONE self-contained HTML file for publishing as an artifact.
//
// Usage: npm run build && node scripts/pack.mjs out.html
//
// Everything is inlined because a published artifact's CSP blocks requests to
// any other host or path. @font-face rules are stripped rather than inlined:
// the game is wordless, so the only text is the title and credits, and a
// fallback face costs nothing there.
//
// KNOWN, NOT FIXED: the title screen renders black in this single-file build —
// the DOM mounts (9 UI children) and the canvas is sized and visible, but the
// 3D pass draws nothing. The auto-start below steps past it so the link is
// playable. It is a real bug and wants chasing separately; do not read the
// working demo as evidence the title works.
import { readFileSync, writeFileSync } from 'node:fs'
import { readdirSync } from 'node:fs'
const src = readFileSync('dist/index.html','utf8')
const strip = (s) => s.replace(/@font-face\s*\{[^}]*\}/g,'')
const css = readdirSync('dist/assets').filter(f=>f.endsWith('.css'))
  .map(f=>readFileSync('dist/assets/'+f,'utf8')).join('\n')
const js = readdirSync('dist/assets').filter(f=>f.endsWith('.js'))
  .map(f=>readFileSync('dist/assets/'+f,'utf8')).join('\n')
const style = strip((src.match(/<style>([\s\S]*?)<\/style>/)||[,''])[1])
let body = (src.match(/<body>([\s\S]*?)<\/body>/)||[,''])[1]
body = body.replace(/<script[^>]*src=[^>]*><\/script>/g,'')
writeFileSync(process.argv[2], `<title>MOONREST</title>
<style>
html,body{margin:0;padding:0;background:#05070d;overflow:hidden;height:100%;width:100%}
${style}
${strip(css)}
</style>
${body}
<script type="module">
${js}
</script>
<script type="module">
// PACKAGED DEMO ONLY — not a game change.
// The title screen renders black in the single-file build (the DOM mounts and
// the canvas is sized and visible, but the 3D pass draws nothing). That is a
// real bug, found by packaging, and it is NOT fixed here — this only skips past
// it so the link is playable. Chase the title render separately.
const boot = setInterval(() => {
  const M = window.__MOONREST__
  if (!M || !M.ready) return
  clearInterval(boot)
  M.startNight()
}, 200)
</script>
`)
console.log('packed', (readFileSync(process.argv[2]).length/1048576).toFixed(2),'MB')
