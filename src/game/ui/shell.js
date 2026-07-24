// The studio shell (MASTER_PROMPT Part 10): title over a live Park diorama,
// pause menu (the ONLY place counters live — no HUD), settings persisted to
// localStorage, credits, join-code entry, 300ms fog-fade transitions, and an
// in-fiction error boundary. Pure DOM over the canvas; fonts npm-bundled.

import '@fontsource/im-fell-english/index.css'
import '@fontsource/alegreya/500.css'
import '@fontsource/alegreya/700.css'
import { uiTick, uiConfirm } from '../audio/sfx.js'
import { sanitizeName } from '../net/coop.js'

const SETTINGS_KEY = 'moonrest-settings-v1'
export const SETTINGS_DEFAULTS = {
  memoryMode: 'n64', resScale: 1, reducedMotion: false,
  volMusic: 0.8, volAmbience: 0.7, volSfx: 0.9, hiss: true,
  sensitivity: 1, invertY: false, holdToToggle: false, subtitles: true,
  keyKindle: 'KeyE', keyHop: 'Space', keySit: 'KeyC',
}

export function loadSettings() {
  try { return { ...SETTINGS_DEFAULTS, ...JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? '{}') } }
  catch { return { ...SETTINGS_DEFAULTS } }
}

const TRINKET_NAMES = {
  cork: 'Beldam’s cork', telescope: 'Nib’s tiny telescope', dustcloth: 'a Curator’s dust-cloth',
  greenshard: 'a green window-glass shard', catbell: 'the Pale King’s cat’s bell',
  mossbutton: 'Mote’s moss button', sailorknot: 'a sailor’s knot', henfeather: 'a warm hen feather',
  archstone: 'the Gatewalkers’ arch-stone',
}

export class Shell {
  // hooks: {startNight(fresh), hostNight()→Promise<code>, joinNight(code)→Promise,
  //         applySettings(s), getStats()→{lights,lightsTotal,brews,trinkets:[],code},
  //         hasSave()→bool, bootAudio()}
  constructor(hooks) {
    this.h = hooks
    this.s = loadSettings()
    this.screen = null   // 'title' | 'pause' | 'settings' | 'credits' | 'join' | null (in night)
    this.from = 'title'  // where settings/credits return to
    this.ui = document.getElementById('ui')
    this.root = document.createElement('div')
    this.root.className = 'shell'
    this.ui.appendChild(this.root)
    this.fade = document.createElement('div')
    this.fade.className = 'fogfade'
    this.ui.appendChild(this.fade)
    this.blocking = false // player input gated while a screen is up

    // in-fiction error boundary (Part 10) — never alert()
    window.addEventListener('error', () => this.showError())
    window.addEventListener('unhandledrejection', () => this.showError())

    window.addEventListener('keydown', (e) => this.onKey(e))
    this.showTitle()
  }

  save() { try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(this.s)) } catch { /* private mode */ } }

  // — 300ms fog fade between screens —
  transition(fn) {
    this.fade.classList.add('on')
    setTimeout(() => { fn(); this.fade.classList.remove('on') }, 300)
  }

  clear() { this.root.innerHTML = ''; this.root.classList.remove('on'); this.screen = null; this.blocking = false }

  el(tag, cls, text, parent) {
    const d = document.createElement(tag)
    if (cls) d.className = cls
    if (text != null) d.textContent = text
    ;(parent ?? this.root).appendChild(d)
    return d
  }

  menuItem(list, label, fn, cls = '') {
    const li = this.el('div', 'mi ' + cls, label, list)
    li.tabIndex = 0
    li.addEventListener('mouseenter', () => { uiTick(); this.focusItem(li) })
    li.addEventListener('click', () => { uiConfirm(); this.h.bootAudio(); fn() })
    li.addEventListener('keydown', (e) => { if (e.code === 'Enter' || e.code === 'Space') { e.preventDefault(); uiConfirm(); this.h.bootAudio(); fn() } })
    return li
  }

  focusItem(li) {
    for (const m of this.root.querySelectorAll('.mi')) m.classList.remove('sel')
    li.classList.add('sel')
    li.focus({ preventScroll: true })
  }

  onKey(e) {
    if (!this.screen) {
      if (e.code === 'Escape') { e.preventDefault(); this.showPause() }
      return
    }
    const items = [...this.root.querySelectorAll('.mi')]
    if (!items.length) return
    const cur = items.findIndex((m) => m.classList.contains('sel'))
    if (e.code === 'ArrowDown' || e.code === 'KeyS') { e.preventDefault(); uiTick(); this.focusItem(items[(cur + 1) % items.length]) }
    else if (e.code === 'ArrowUp' || e.code === 'KeyW') { e.preventDefault(); uiTick(); this.focusItem(items[(cur - 1 + items.length) % items.length]) }
    else if (e.code === 'Escape') {
      e.preventDefault()
      if (this.screen === 'title') return
      if (this.screen === 'pause') this.closeToNight()
      else if (this.from === 'pause') this.showPause()
      else this.showTitle()
    }
  }

  // ——— screens ———

  showTitle() {
    this.clear()
    this.screen = 'title'
    this.from = 'title'
    this.blocking = true
    this.root.classList.add('on')
    const card = this.el('div', 'titlecard')
    this.el('div', 'logo', 'MOONREST', card)
    this.el('div', 'tagline', 'a small night, kept', card)
    const list = this.el('div', 'menu', null, card)
    if (this.h.hasSave()) this.menuItem(list, 'Continue Night', () => this.begin(false))
    this.menuItem(list, 'New Night', () => this.begin(true))
    this.menuItem(list, 'Host Night', () => this.beginHost())
    this.menuItem(list, 'Join Night', () => this.showJoin())
    this.menuItem(list, 'Settings', () => this.showSettings('title'))
    this.menuItem(list, 'Credits', () => this.showCredits('title'))
    this.focusItem(list.firstChild)
    this.el('div', 'foot', 'WASD walk · mouse look · E kindle · C sit · Space hop · Esc menu', card)
  }

  begin(fresh) {
    this.transition(() => { this.clear(); this.h.startNight(fresh) })
  }

  beginHost() {
    this.transition(() => {
      this.clear()
      this.h.startNight(false)
      this.h.hostNight().then((code) => {
        this.toast(`the night is open — code ${code} (in the pause menu too)`)
      }).catch(() => this.toast('the far shore is quiet. hosting failed — still your night, though.'))
    })
  }

  showJoin() {
    this.clear()
    this.screen = 'join'
    this.blocking = true
    this.root.classList.add('on')
    const card = this.el('div', 'titlecard')
    this.el('div', 'h1', 'Join a Night', card)
    this.el('div', 'hint', 'four letters, from a friend', card)
    const input = this.el('input', 'code', null, card)
    input.maxLength = 4
    input.autocomplete = 'off'
    input.spellcheck = false
    input.addEventListener('input', () => { input.value = input.value.toUpperCase().replace(/[^A-Z]/g, '') })
    const list = this.el('div', 'menu', null, card)
    const go = () => {
      const code = input.value.trim().toUpperCase()
      if (code.length !== 4) { this.toast('four letters.'); return }
      this.transition(() => {
        this.clear()
        this.h.startNight(false)
        this.h.joinNight(code).then(() => this.toast('you slip into their night.'))
          .catch(() => this.toast('no night answers to that code.'))
      })
    }
    input.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter') { uiConfirm(); this.h.bootAudio(); go() } })
    this.menuItem(list, 'Join', go)
    this.menuItem(list, 'Back', () => this.showTitle())
    setTimeout(() => input.focus(), 50)
  }

  showPause() {
    if (this.screen === 'pause') { this.closeToNight(); return }
    this.clear()
    this.screen = 'pause'
    this.from = 'pause'
    this.blocking = true
    this.root.classList.add('on')
    this.root.classList.add('dim')
    const st = this.h.getStats()
    const card = this.el('div', 'pausecard')
    this.el('div', 'h1', 'a breath', card)
    const row = this.el('div', 'counters', null, card)
    this.el('div', 'counter', `lights kindled: ${st.lights} / ${st.lightsTotal}`, row)
    this.el('div', 'counter', `moon brews: ${st.brews} / 12`, row)
    if (st.code) this.el('div', 'counter code', `night code: ${st.code}`, row)
    this.el('div', 'h2', 'keepsake shelf', card)
    const shelf = this.el('div', 'shelf', null, card)
    if (!st.trinkets.length) this.el('div', 'shelfempty', 'nothing yet — the sleepers are still dreaming', shelf)
    for (const t of st.trinkets) this.el('div', 'trinket', TRINKET_NAMES[t] ?? t, shelf)
    const list = this.el('div', 'menu', null, card)
    this.menuItem(list, 'Back to the Night', () => this.closeToNight())
    this.menuItem(list, 'Settings', () => this.showSettings('pause'))
    this.menuItem(list, 'Credits', () => this.showCredits('pause'))
    this.menuItem(list, 'Leave to Title', () => this.transition(() => location.reload()))
    this.focusItem(list.firstChild)
    this.el('div', 'foot', 'the world keeps breathing — this is just a longer blink', card)
  }

  closeToNight() {
    this.root.classList.remove('dim')
    this.clear()
  }

  // settings rows are built from a tiny schema so they stay consistent
  showSettings(from) {
    this.clear()
    this.screen = 'settings'
    this.from = from
    this.blocking = true
    this.root.classList.add('on')
    if (from === 'pause') this.root.classList.add('dim')
    const card = this.el('div', 'pausecard settings')
    this.el('div', 'h1', 'settings', card)

    const section = (t) => this.el('div', 'h2', t, card)
    const row = (label) => {
      const r = this.el('div', 'srow', null, card)
      this.el('div', 'slabel', label, r)
      return r
    }
    const cycle = (label, key, values, names) => {
      const r = row(label)
      const v = this.el('div', 'mi sval', null, r)
      const show = () => { v.textContent = names ? names[values.indexOf(this.s[key])] : String(this.s[key]) }
      show()
      v.tabIndex = 0
      const advance = () => {
        uiTick()
        const i = (values.indexOf(this.s[key]) + 1) % values.length
        this.s[key] = values[i]
        this.save(); this.h.applySettings(this.s); show()
      }
      v.addEventListener('click', advance)
      v.addEventListener('keydown', (e) => { if (e.code === 'Enter' || e.code === 'Space') { e.preventDefault(); advance() } })
    }
    const slider = (label, key) => {
      const r = row(label)
      const v = this.el('input', 'mi srange', null, r)
      v.type = 'range'; v.min = 0; v.max = 1; v.step = 0.05; v.value = this.s[key]
      v.addEventListener('input', () => { this.s[key] = +v.value; this.save(); this.h.applySettings(this.s) })
      v.addEventListener('keydown', (e) => e.stopPropagation())
    }
    const rebind = (label, key) => {
      const r = row(label)
      const v = this.el('div', 'mi sval', this.s[key], r)
      v.tabIndex = 0
      const arm = () => {
        uiTick()
        v.textContent = 'press a key…'
        const once = (e) => {
          e.preventDefault(); e.stopPropagation()
          if (e.code !== 'Escape') { this.s[key] = e.code; this.save(); this.h.applySettings(this.s) }
          v.textContent = this.s[key]
          window.removeEventListener('keydown', once, true)
        }
        window.addEventListener('keydown', once, true)
      }
      v.addEventListener('click', arm)
    }

    section('video')
    cycle('memory', 'memoryMode', ['n64', 'ps1', 'vhs', 'clean'], ['N64 (soft)', 'PS1 (jitter)', 'VHS (haunted)', 'Clean (crisp)'])
    cycle('internal res', 'resScale', [0.5, 1, 1.5, 2], ['0.5×', '1×', '1.5×', '2×'])
    cycle('reduced motion', 'reducedMotion', [false, true], ['off', 'on'])
    section('audio')
    slider('music', 'volMusic')
    slider('ambience', 'volAmbience')
    slider('sound', 'volSfx')
    cycle('tape hiss', 'hiss', [true, false], ['on', 'off'])
    section('controls')
    cycle('look sensitivity', 'sensitivity', [0.5, 0.75, 1, 1.5, 2], ['0.5×', '0.75×', '1×', '1.5×', '2×'])
    cycle('invert look Y', 'invertY', [false, true], ['off', 'on'])
    rebind('kindle', 'keyKindle')
    rebind('hop', 'keyHop')
    rebind('sit / lie', 'keySit')
    section('accessibility')
    cycle('subtitles', 'subtitles', [true, false], ['on', 'off'])
    cycle('channel: hold → toggle', 'holdToToggle', [false, true], ['hold', 'toggle'])
    this.el('div', 'hint', 'no strobe anywhere in the night — checked, promise. gamepad: left stick walk, right stick look, A hop, X kindle.', card)
    const list = this.el('div', 'menu', null, card)
    this.menuItem(list, 'Back', () => (from === 'pause' ? this.showPause() : this.showTitle()))
  }

  showCredits(from) {
    this.clear()
    this.screen = 'credits'
    this.from = from
    this.blocking = true
    this.root.classList.add('on')
    if (from === 'pause') this.root.classList.add('dim')
    const card = this.el('div', 'pausecard credits')
    this.el('div', 'h1', 'credits', card)
    for (const line of [
      'MOONREST — a night-walk for tired people.',
      'built in one long night by a language model with a lantern.',
      'inspired, honestly and with love, by the fake-retro ambience scene',
      'and the games that taught the moon to loom: Majora’s Mask,',
      'Lunacid, old-kingdom MMO evenings, and every N64 fog wall.',
      'every texture painted in code · every mesh from primitives',
      'every sound synthesized · nothing fetched, nothing borrowed',
      'three.js renders the night · PeerJS carries the lanterns',
      'type set in IM Fell English & Alegreya (OFL, bundled)',
      'code offered MIT-style — take the night apart and see how it ticks',
    ]) this.el('div', 'credline', line, card)
    const list = this.el('div', 'menu', null, card)
    this.menuItem(list, 'Back', () => (from === 'pause' ? this.showPause() : this.showTitle()))
    this.focusItem(list.firstChild)
  }

  showError() {
    if (this._errored) return
    this._errored = true
    const card = this.el('div', 'errorcard')
    this.el('div', 'h1', 'the night flickered.', card)
    this.el('div', 'hint', 'something in the dark misstepped. reload to rejoin it — your keepsakes are safe.', card)
    const list = this.el('div', 'menu', null, card)
    this.menuItem(list, 'rejoin the night', () => location.reload())
    this.root.classList.add('on')
  }

  toast(text) {
    const t = this.el('div', 'toast', text, this.ui)
    setTimeout(() => t.classList.add('on'), 30)
    setTimeout(() => { t.classList.remove('on'); setTimeout(() => t.remove(), 600) }, 5200)
  }
}
