// ============================================================
// EMBERVALE — UI: DOM menus/dialogue/shop + canvas HUD
// ============================================================
import { VIEW_W, VIEW_H, CLASSES, UPGRADES, ENEMIES } from './data.js'

const CSS = `
.ev-overlay { position: fixed; inset: 0; display: flex; align-items: center; justify-content: center;
  z-index: 20; font-family: 'Courier New', monospace; color: #cfc4b0; pointer-events: none; }
.ev-overlay > * { pointer-events: auto; }
.ev-panel { background: rgba(10,7,16,0.92); border: 1px solid #3d3450; padding: 28px 34px;
  max-width: 620px; text-align: center; box-shadow: 0 0 60px rgba(0,0,0,0.8), inset 0 0 40px rgba(20,10,40,0.5); }
.ev-title { font-size: 44px; letter-spacing: 10px; color: #e8d8b0; margin: 0 0 2px;
  text-shadow: 0 0 18px rgba(255,154,61,0.45), 0 2px 0 #1a1020; animation: evFlicker 3.4s infinite; }
.ev-sub { color: #8a7f96; letter-spacing: 3px; font-size: 12px; margin-bottom: 22px; }
@keyframes evFlicker { 0%,100% { opacity: 1 } 92% { opacity: 1 } 94% { opacity: .82 } 96% { opacity: 1 } 98% { opacity: .9 } }
.ev-btn { display: block; width: 100%; margin: 7px 0; padding: 10px 16px; background: #17121f;
  color: #cfc4b0; border: 1px solid #3d3450; font-family: inherit; font-size: 14px; letter-spacing: 2px;
  cursor: pointer; transition: all .15s; text-transform: uppercase; }
.ev-btn:hover:not(:disabled) { background: #241b33; border-color: #ff9a3d; color: #ffd9a0; box-shadow: 0 0 14px rgba(255,154,61,0.25); }
.ev-btn:disabled { opacity: .35; cursor: default; }
.ev-btn.small { font-size: 11px; padding: 6px 10px; margin: 4px 0; }
.ev-note { font-size: 11px; color: #6f6580; margin-top: 14px; line-height: 1.6; }
.ev-code { font-size: 34px; letter-spacing: 12px; color: #ffd9a0; background: #17121f; border: 1px dashed #5a4a70;
  padding: 10px 8px 10px 20px; margin: 12px 0; }
.ev-input { background: #17121f; border: 1px solid #3d3450; color: #ffd9a0; font-family: inherit;
  font-size: 26px; letter-spacing: 10px; text-transform: uppercase; width: 170px; text-align: center; padding: 9px; }
.ev-input:focus { outline: none; border-color: #ff9a3d; }
.ev-cards { display: flex; gap: 14px; justify-content: center; margin: 14px 0; }
.ev-card { border: 1px solid #3d3450; background: #120d1c; padding: 14px; width: 210px; cursor: pointer; transition: all .15s; }
.ev-card:hover, .ev-card.sel { border-color: #ff9a3d; box-shadow: 0 0 16px rgba(255,154,61,0.25); }
.ev-card h3 { margin: 4px 0 2px; color: #e8d8b0; font-size: 15px; letter-spacing: 1px; }
.ev-card .t { color: #8a7f96; font-size: 10px; letter-spacing: 2px; text-transform: uppercase; }
.ev-card p { font-size: 11px; color: #9a8fa6; line-height: 1.55; white-space: pre-line; }
.ev-card canvas { image-rendering: pixelated; width: 60px; height: 75px; }
.ev-dlg { position: fixed; left: 50%; bottom: 5vh; transform: translateX(-50%); width: min(680px, 92vw);
  background: rgba(8,6,14,0.94); border: 1px solid #3d3450; padding: 14px 20px; z-index: 25;
  font-family: 'Courier New', monospace; box-shadow: 0 0 40px rgba(0,0,0,0.8); }
.ev-dlg .who { color: #ff bf7d; color: #ffbf7d; font-size: 11px; letter-spacing: 3px; text-transform: uppercase; margin-bottom: 5px; }
.ev-dlg .txt { color: #d8cfc0; font-size: 14px; line-height: 1.6; min-height: 44px; }
.ev-dlg .hint { color: #5f5670; font-size: 10px; text-align: right; letter-spacing: 2px; }
.ev-shoprow { display: flex; align-items: center; gap: 10px; margin: 6px 0; text-align: left; }
.ev-shoprow .nm { flex: 1; font-size: 12px; letter-spacing: 1px; }
.ev-shoprow .nm small { display: block; color: #7a7088; font-size: 10px; }
.ev-pips { color: #ff9a3d; font-size: 11px; letter-spacing: 2px; }
.ev-tabs { display: flex; gap: 6px; justify-content: center; margin-bottom: 10px; }
.ev-tab { padding: 5px 14px; border: 1px solid #3d3450; background: #120d1c; cursor: pointer; font-size: 11px;
  letter-spacing: 2px; color: #9a8fa6; }
.ev-tab.sel { border-color: #ff9a3d; color: #ffd9a0; }
.ev-kbd { display:inline-block; border:1px solid #4a4060; border-bottom-width:2px; padding:0 5px; margin:0 2px;
  font-size:10px; color:#b8ad9e; background:#17121f; border-radius:2px; }
.ev-fade { animation: evFadeIn .5s; }
@keyframes evFadeIn { from { opacity: 0 } to { opacity: 1 } }
.ev-vign { position: fixed; inset: 0; pointer-events: none; z-index: 15;
  background: radial-gradient(ellipse at center, transparent 55%, rgba(0,0,0,0.55) 100%); }
`

export class UI {
  constructor() {
    const style = document.createElement('style')
    style.textContent = CSS
    document.head.appendChild(style)
    const vign = document.createElement('div')
    vign.className = 'ev-vign'
    document.body.appendChild(vign)
    this.overlay = document.createElement('div')
    this.overlay.className = 'ev-overlay'
    document.body.appendChild(this.overlay)
    this.dlgEl = null
    this.dlgQueue = []
    this.dlgChar = 0
    this.dlgDone = null
    this.toasts = []
    this.zoneCard = null // {title, sub, t}
    this.cb = {}
    this.shopSlot = 0
    this._screen = null
  }

  on(name, fn) {
    this.cb[name] = fn
  }

  clear() {
    this.overlay.innerHTML = ''
    this._screen = null
  }

  panel(html) {
    this.clear()
    const p = document.createElement('div')
    p.className = 'ev-panel ev-fade'
    p.innerHTML = html
    this.overlay.appendChild(p)
    return p
  }

  // ---------------- screens ----------------
  showTitle(hasSave) {
    this._screen = 'title'
    const p = this.panel(`
      <h1 class="ev-title">EMBERVALE</h1>
      <div class="ev-sub">A CO-OP DARK FANTASY TALE · RELIGHT THE PALE BEACON</div>
      ${hasSave ? '<button class="ev-btn" data-a="continue">Continue the Vigil</button>' : ''}
      <button class="ev-btn" data-a="solo">Walk Alone</button>
      <button class="ev-btn" data-a="local">Two at One Hearth (local co-op)</button>
      <button class="ev-btn" data-a="host">Kindle a Room (host online)</button>
      <button class="ev-btn" data-a="join">Answer a Call (join online)</button>
      ${hasSave ? '<button class="ev-btn small" data-a="wipe">Forget everything (new game)</button>' : ''}
      <div class="ev-note">P1 <span class="ev-kbd">WASD</span> move <span class="ev-kbd">J</span> attack <span class="ev-kbd">K</span> special <span class="ev-kbd">L</span>/<span class="ev-kbd">Space</span> dodge <span class="ev-kbd">E</span> interact
      <br/>P2 <span class="ev-kbd">←↑→↓</span> move <span class="ev-kbd">,</span> attack <span class="ev-kbd">.</span> special <span class="ev-kbd">/</span> dodge <span class="ev-kbd">Enter</span> interact · gamepad supported</div>
    `)
    p.querySelectorAll('[data-a]').forEach((b) =>
      b.addEventListener('click', () => this.cb.title?.(b.dataset.a))
    )
  }

  classCard(clsId, sel) {
    const c = CLASSES[clsId]
    return `<div class="ev-card ${sel ? 'sel' : ''}" data-cls="${clsId}">
      <div class="t">${c.title}</div><h3>${c.name}</h3><p>${c.desc}</p>
      <p style="color:#6f6580">HP ${c.hp / 2}♥ · ${clsId === 'knight' ? 'melee' : 'ranged'}</p>
    </div>`
  }

  showClassSelect(mode, done) {
    this._screen = 'class'
    const two = mode === 'local'
    const picks = { 0: 'knight', 1: 'pyro' }
    const render = () => {
      const p = this.panel(`
        <div class="ev-sub">CHOOSE YOUR ${two ? 'HEROES' : 'HERO'}</div>
        <div style="font-size:12px;color:#8a7f96;margin-bottom:4px">${two ? 'PLAYER ONE' : ''}</div>
        <div class="ev-cards" data-slot="0">${this.classCard('knight', picks[0] === 'knight')}${this.classCard('pyro', picks[0] === 'pyro')}</div>
        ${two ? `<div style="font-size:12px;color:#8a7f96;margin-bottom:4px">PLAYER TWO</div>
        <div class="ev-cards" data-slot="1">${this.classCard('knight', picks[1] === 'knight')}${this.classCard('pyro', picks[1] === 'pyro')}</div>` : ''}
        <button class="ev-btn" data-a="go">Set out</button>
        <button class="ev-btn small" data-a="back">Back</button>
      `)
      p.querySelectorAll('.ev-cards').forEach((row) => {
        const slot = +row.dataset.slot
        row.querySelectorAll('.ev-card').forEach((card) =>
          card.addEventListener('click', () => {
            picks[slot] = card.dataset.cls
            render()
          })
        )
      })
      p.querySelector('[data-a=go]').addEventListener('click', () => done(two ? [picks[0], picks[1]] : [picks[0]]))
      p.querySelector('[data-a=back]').addEventListener('click', () => this.cb.title?.('__back'))
    }
    render()
  }

  showHostLobby(code, status) {
    this._screen = 'hostlobby'
    const p = this.panel(`
      <div class="ev-sub">THE ROOM IS KINDLED</div>
      <div style="font-size:12px;color:#9a8fa6">Give this ember-word to your ally:</div>
      <div class="ev-code">${code}</div>
      <div style="font-size:12px;color:#9a8fa6" id="ev-host-status">${status || 'Waiting in the dark for a second torch...'}</div>
      <button class="ev-btn small" data-a="back" style="margin-top:16px">Snuff the room</button>
      <div class="ev-note">They open the game and choose “Answer a Call”, then enter the word.<br/>The game begins the moment they arrive.</div>
    `)
    p.querySelector('[data-a=back]').addEventListener('click', () => this.cb.title?.('__back'))
  }

  setHostStatus(txt) {
    const el = document.getElementById('ev-host-status')
    if (el) el.textContent = txt
  }

  showJoin(err) {
    this._screen = 'join'
    const p = this.panel(`
      <div class="ev-sub">ANSWER A CALL</div>
      <div style="font-size:12px;color:#9a8fa6;margin-bottom:8px">Enter the ember-word your ally gave you:</div>
      <input class="ev-input" id="ev-join-code" maxlength="4" autocomplete="off" spellcheck="false" />
      ${err ? `<div style="color:#c94f4f;font-size:12px;margin-top:8px">${err}</div>` : ''}
      <button class="ev-btn" data-a="go" style="margin-top:14px">Step through</button>
      <button class="ev-btn small" data-a="back">Back</button>
    `)
    const input = p.querySelector('#ev-join-code')
    setTimeout(() => input.focus(), 50)
    const go = () => {
      const code = input.value.trim().toUpperCase()
      if (code.length === 4) this.cb.join?.(code)
    }
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') go()
      e.stopPropagation()
    })
    p.querySelector('[data-a=go]').addEventListener('click', go)
    p.querySelector('[data-a=back]').addEventListener('click', () => this.cb.title?.('__back'))
  }

  showConnecting(msg) {
    this._screen = 'connecting'
    this.panel(`<div class="ev-sub">${msg || 'REACHING THROUGH THE DARK...'}</div>`)
  }

  showStory(lines, done) {
    this._screen = 'story'
    let i = 0
    const render = () => {
      const p = this.panel(`
        <div style="min-height:120px;display:flex;align-items:center;justify-content:center">
          <p style="font-size:14px;line-height:2;color:#c8bda8;max-width:480px">${lines[i]}</p>
        </div>
        <button class="ev-btn" data-a="n">${i < lines.length - 1 ? 'Onward' : 'Begin'}</button>
      `)
      p.querySelector('[data-a=n]').addEventListener('click', () => {
        i++
        if (i >= lines.length) done()
        else render()
      })
    }
    render()
  }

  showPause() {
    this._screen = 'pause'
    const p = this.panel(`
      <div class="ev-sub">THE WORLD HOLDS ITS BREATH</div>
      <button class="ev-btn" data-a="resume">Resume</button>
      <button class="ev-btn" data-a="mute">Toggle sound</button>
      <button class="ev-btn small" data-a="quit">Abandon to title</button>
    `)
    p.querySelector('[data-a=resume]').addEventListener('click', () => this.cb.resume?.())
    p.querySelector('[data-a=mute]').addEventListener('click', () => this.cb.mute?.())
    p.querySelector('[data-a=quit]').addEventListener('click', () => this.cb.quit?.())
  }

  showDisconnected(msg) {
    this._screen = 'disconnected'
    const p = this.panel(`
      <div class="ev-sub">${msg || 'YOUR ALLY’S TORCH WENT OUT'}</div>
      <div class="ev-note">The connection was lost.</div>
      <button class="ev-btn" data-a="quit">Return to title</button>
    `)
    p.querySelector('[data-a=quit]').addEventListener('click', () => this.cb.quit?.())
  }

  showVictory(stats, done) {
    this._screen = 'victory'
    const p = this.panel(`
      <h1 class="ev-title" style="font-size:30px">THE BEACON BURNS</h1>
      <div class="ev-sub">EMBERVALE IS LIT</div>
      <p style="font-size:12px;color:#9a8fa6;line-height:1.9">${stats}</p>
      <button class="ev-btn" data-a="n">Walk back into the morning</button>
    `)
    p.querySelector('[data-a=n]').addEventListener('click', done)
  }

  // ---------------- shop ----------------
  showShop(save, slots, onBuy, onClose) {
    this._screen = 'shop'
    const render = () => {
      const slot = this.shopSlot
      const ups = save.upgrades[slot] || {}
      const rows = UPGRADES.map((u) => {
        const lvl = ups[u.id] || 0
        const maxed = lvl >= u.max
        const cost = maxed ? null : u.costs[lvl]
        const can = !maxed && save.embers >= cost
        return `<div class="ev-shoprow">
          <div class="nm">${u.name}<small>${u.desc}</small></div>
          <div class="ev-pips">${'◆'.repeat(lvl)}${'◇'.repeat(u.max - lvl)}</div>
          <button class="ev-btn small" style="width:110px;margin:0" data-buy="${u.id}" ${can ? '' : 'disabled'}>
            ${maxed ? 'FORGED' : cost + ' embers'}</button>
        </div>`
      }).join('')
      const tabs = slots.length > 1
        ? `<div class="ev-tabs">${slots.map((s) => `<div class="ev-tab ${s === slot ? 'sel' : ''}" data-tab="${s}">P${s + 1} · ${CLASSES[save.classes[s]].name.split(' ')[1] || save.classes[s]}</div>`).join('')}</div>`
        : ''
      const p = this.panel(`
        <div class="ev-sub">THE ANVIL REMEMBERS · <span style="color:#ffd23d">${save.embers} EMBERS</span></div>
        ${tabs}${rows}
        <button class="ev-btn" data-a="close" style="margin-top:14px">Back to the dark</button>
      `)
      p.querySelectorAll('[data-tab]').forEach((t) =>
        t.addEventListener('click', () => {
          this.shopSlot = +t.dataset.tab
          render()
        })
      )
      p.querySelectorAll('[data-buy]').forEach((b) =>
        b.addEventListener('click', () => {
          onBuy(slot, b.dataset.buy)
          render()
        })
      )
      p.querySelector('[data-a=close]').addEventListener('click', () => {
        this.clear()
        onClose?.()
      })
    }
    this.renderShop = render
    render()
  }

  // ---------------- dialogue ----------------
  startDialogue(lines, done) {
    this.dlgQueue = lines.slice()
    this.dlgDone = done
    this.dlgChar = 0
    this._showDlgLine()
  }

  _showDlgLine() {
    if (!this.dlgEl) {
      this.dlgEl = document.createElement('div')
      this.dlgEl.className = 'ev-dlg ev-fade'
      document.body.appendChild(this.dlgEl)
      this.dlgEl.addEventListener('click', () => this.advanceDialogue())
    }
    const line = this.dlgQueue[0]
    const [who, txt] = line.split('|')
    this.dlgLine = txt
    this.dlgChar = 0
    this.dlgEl.innerHTML = `<div class="who">${who || ''}</div><div class="txt"></div><div class="hint">E / ENTER / CLICK ▸</div>`
  }

  tickDialogue(dt) {
    if (!this.dlgEl || !this.dlgQueue.length) return
    if (this.dlgChar < this.dlgLine.length) {
      this.dlgChar = Math.min(this.dlgLine.length, this.dlgChar + dt * 55)
      const el = this.dlgEl.querySelector('.txt')
      if (el) el.textContent = this.dlgLine.slice(0, Math.floor(this.dlgChar))
    }
  }

  advanceDialogue() {
    if (!this.dlgQueue.length) return
    if (this.dlgChar < this.dlgLine.length) {
      this.dlgChar = this.dlgLine.length
      const el = this.dlgEl.querySelector('.txt')
      if (el) el.textContent = this.dlgLine
      return
    }
    this.dlgQueue.shift()
    if (this.dlgQueue.length) this._showDlgLine()
    else this.endDialogue()
  }

  endDialogue() {
    this.dlgQueue = []
    if (this.dlgEl) {
      this.dlgEl.remove()
      this.dlgEl = null
    }
    const d = this.dlgDone
    this.dlgDone = null
    d?.()
  }

  get inDialogue() {
    return this.dlgQueue.length > 0
  }

  // ---------------- toasts & zone cards ----------------
  toast(msg) {
    this.toasts.push({ msg, t: 4 })
    if (this.toasts.length > 3) this.toasts.shift()
  }

  showZoneCard(title, sub) {
    this.zoneCard = { title, sub, t: 3.4 }
  }

  // ---------------- canvas HUD ----------------
  drawHUD(g, state, opts, dt) {
    // toasts
    this.toasts = this.toasts.filter((t) => (t.t -= dt) > 0)
    // zone card
    if (this.zoneCard) {
      this.zoneCard.t -= dt
      const a = Math.min(1, this.zoneCard.t, (3.4 - this.zoneCard.t) * 2)
      g.textAlign = 'center'
      g.font = '16px monospace'
      g.fillStyle = `rgba(10,6,16,${a * 0.9})`
      g.fillText(this.zoneCard.title.toUpperCase(), VIEW_W / 2 + 1, 65)
      g.fillStyle = `rgba(240,224,186,${a})`
      g.fillText(this.zoneCard.title.toUpperCase(), VIEW_W / 2, 64)
      g.font = '8px monospace'
      g.fillStyle = `rgba(10,6,16,${a * 0.9})`
      g.fillText(this.zoneCard.sub, VIEW_W / 2 + 1, 77)
      g.fillStyle = `rgba(196,184,210,${a})`
      g.fillText(this.zoneCard.sub, VIEW_W / 2, 76)
      if (this.zoneCard.t <= 0) this.zoneCard = null
    }

    // players HUD
    const players = (state.players || []).filter(Boolean)
    players.forEach((p, i) => {
      const x = 8
      const y = 8 + i * 22
      // class chip
      g.fillStyle = p.cls === 'knight' ? '#aebccb' : '#c96a5a'
      g.fillRect(x, y, 3, 16)
      // hearts
      const mh = p.maxhp
      const hp = Math.max(0, p.hp)
      for (let h = 0; h < mh / 2; h++) {
        const full = hp >= (h + 1) * 2
        const half = !full && hp >= h * 2 + 1
        drawHeart(g, x + 7 + h * 8, y, full ? '#c94f4f' : half ? '#8a3d3d' : '#2e2331', half)
      }
      // stamina
      g.fillStyle = '#241f2e'
      g.fillRect(x + 7, y + 9, 44, 3)
      g.fillStyle = '#7da86a'
      g.fillRect(x + 7, y + 9, Math.round((Math.max(0, p.stam) / p.maxstam) * 44), 3)
      // state chip
      const st = p.st || p.state
      if (st === 'down') {
        g.fillStyle = Math.sin(performance.now() / 150) > 0 ? '#c94f4f' : '#8a3d3d'
        g.font = '7px monospace'
        g.textAlign = 'left'
        g.fillText('DOWN — ally: hold E to revive', x + 7, y + 20)
      }
    })

    // embers
    g.textAlign = 'right'
    g.font = '10px monospace'
    g.fillStyle = '#ffd23d'
    g.fillText(`◆ ${state.embers ?? 0}`, VIEW_W - 8, 16)
    // key items
    const fl = state.keyFlags || {}
    let kx = VIEW_W - 8
    g.font = '7px monospace'
    const items = [
      ['rustkey', 'KEY', '#b8a44f'],
      ['stormsigil', 'STORM', '#7fd6ff'],
      ['palesigil', 'PALE', '#d8dce6'],
    ]
    let ky = 26
    for (const [id, label, color] of items) {
      if (fl[id]) {
        g.fillStyle = color
        g.fillText(label, kx, ky)
        ky += 9
      }
    }

    // ping
    if (opts.ping != null) {
      g.fillStyle = opts.ping > 180 ? '#c94f4f' : '#5f5670'
      g.font = '7px monospace'
      g.fillText(`${opts.ping}ms`, VIEW_W - 8, VIEW_H - 6)
    }

    // boss bar
    const boss = (state.enemies || []).find((e) => (e.k || e.kind) === 'paleking')
    if (boss && opts.bossActive) {
      const w = 240
      const x0 = (VIEW_W - w) / 2
      g.fillStyle = 'rgba(8,6,12,0.85)'
      g.fillRect(x0 - 2, VIEW_H - 26, w + 4, 12)
      g.fillStyle = '#2e2331'
      g.fillRect(x0, VIEW_H - 24, w, 5)
      const frac = Math.max(0, boss.hp / (boss.mhp || boss.maxhp))
      g.fillStyle = '#7fd6ff'
      g.fillRect(x0, VIEW_H - 24, Math.round(w * frac), 5)
      g.fillStyle = '#d8dce6'
      g.font = '7px monospace'
      g.textAlign = 'center'
      g.fillText('THE PALE KING', VIEW_W / 2, VIEW_H - 28)
    }

    // interact hint
    if (opts.hint) {
      g.textAlign = 'center'
      g.font = '8px monospace'
      g.fillStyle = 'rgba(10,8,14,0.75)'
      const tw = g.measureText(opts.hint).width
      g.fillRect(VIEW_W / 2 - tw / 2 - 6, VIEW_H - 46, tw + 12, 12)
      g.fillStyle = '#e8d8b0'
      g.fillText(opts.hint, VIEW_W / 2, VIEW_H - 37)
    }

    // toasts
    g.textAlign = 'center'
    this.toasts.forEach((t, i) => {
      const a = Math.min(1, t.t)
      g.font = '8px monospace'
      g.fillStyle = `rgba(216,207,192,${a})`
      g.fillText(t.msg, VIEW_W / 2, 96 + i * 12)
    })

    // wipe overlay
    if (opts.wipeT > 0) {
      g.fillStyle = `rgba(20,4,8,${Math.min(0.75, opts.wipeT)})`
      g.fillRect(0, 0, VIEW_W, VIEW_H)
      g.fillStyle = '#c94f4f'
      g.font = '14px monospace'
      g.textAlign = 'center'
      g.fillText('THE DARK TAKES YOU', VIEW_W / 2, VIEW_H / 2 - 6)
      g.font = '8px monospace'
      g.fillStyle = '#8a7f96'
      g.fillText(opts.wipeTip || '', VIEW_W / 2, VIEW_H / 2 + 10)
    }
    g.textAlign = 'left'
  }
}

function drawHeart(g, x, y, color, half) {
  g.fillStyle = color
  g.fillRect(x, y, 2, 2)
  g.fillRect(x + 3, y, 2, 2)
  g.fillRect(x, y + 2, half ? 3 : 5, 2)
  g.fillRect(x + 1, y + 4, 3, 1)
  g.fillRect(x + 2, y + 5, 1, 1)
}
