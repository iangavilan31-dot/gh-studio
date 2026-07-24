#!/usr/bin/env node
// Package the built game into ONE self-contained HTML file for hosting where
// no other files exist (e.g. a claude.ai artifact page). Inlines the JS bundle,
// the extracted CSS (with @fontsource files swapped for data-URI faces), and
// the index.html style block. Run `npm run build` first.
//
//   node scripts/package-artifact.mjs [outfile]
//
// NOTES learned the hard way (see PROGRESS.md 'post-ship'):
// - no <link rel=icon>: its raw-SVG data URI can't be copied by tag regex and
//   the artifact favicon parameter owns the tab icon anyway
// - </script> sequences in the bundle must be escaped
// - emit NO doctype/html/head/body — the artifact host wraps the file itself
// - co-op is dead on an artifact page (CSP blocks the PeerJS broker); solo works

import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const out = process.argv[2] ?? resolve(root, 'dist/moonrest-artifact.html')

const jsFile = readdirSync(root + '/dist/assets').find((f) => f.endsWith('.js'))
const cssFile = readdirSync(root + '/dist/assets').find((f) => f.endsWith('.css'))
const srcHtml = readFileSync(root + '/dist/index.html', 'utf8')
const styleMatch = srcHtml.match(/<style>([\s\S]*?)<\/style>/)
if (!jsFile || !styleMatch) throw new Error('run npm run build first')

const cssAsset = readFileSync(root + '/dist/assets/' + cssFile, 'utf8').replace(/@font-face\{[^}]*\}/g, '')
const face = (family, weight, file) =>
  `@font-face{font-family:'${family}';font-style:normal;font-weight:${weight};font-display:swap;src:url(data:font/woff2;base64,${readFileSync(file).toString('base64')}) format('woff2')}`
const fonts = [
  face('IM Fell English', 400, root + '/node_modules/@fontsource/im-fell-english/files/im-fell-english-latin-400-normal.woff2'),
  face('Alegreya', 500, root + '/node_modules/@fontsource/alegreya/files/alegreya-latin-500-normal.woff2'),
  face('Alegreya', 700, root + '/node_modules/@fontsource/alegreya/files/alegreya-latin-700-normal.woff2'),
].join('\n')
const js = readFileSync(root + '/dist/assets/' + jsFile, 'utf8').replace(/<\/script/gi, '<\\/script')

writeFileSync(out, `<title>MOONREST — a small night, kept</title>
<style>
html, body { margin: 0; padding: 0; background: #000; overflow: hidden; height: 100%; }
${fonts}
${cssAsset}
${styleMatch[1]}
</style>
<canvas id="game"></canvas>
<div id="ui"></div>
<script type="module">
${js}
</script>
`)
console.log('packaged', out, 'from', jsFile)
