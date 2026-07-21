// ============================================================
// EMBERVALE — renderer: camera, tiles, sprites, light, weather
// ============================================================
import { VIEW_W, VIEW_H, TILE, CLASSES } from './data.js'
import { SPR, paintTile, paintHouse, hash2 } from './sprites.js'

function makeWhite(src) {
  const c = document.createElement('canvas')
  c.width = src.width
  c.height = src.height
  const g = c.getContext('2d')
  g.drawImage(src, 0, 0)
  g.globalCompositeOperation = 'source-atop'
  g.fillStyle = '#ffffff'
  g.fillRect(0, 0, c.width, c.height)
  return c
}

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas
    this.ctx = canvas.getContext('2d')
    this.ctx.imageSmoothingEnabled = false
    this.static = document.createElement('canvas')
    this.staticG = this.static.getContext('2d')
    this.light = document.createElement('canvas')
    this.light.width = VIEW_W
    this.light.height = VIEW_H
    this.lightG = this.light.getContext('2d')
    this.cam = { x: 0, y: 0 }
    this.shake = 0
    this.particles = []
    this.weatherP = []
    this.flash = 0 // lightning / nova flash 0..1
    this.beamWarns = []
    this.whiteCache = new Map()
    this.time = 0
    this.world = null
    this.fadeT = 0 // 1 = fully black
    this.lightningT = 3
  }

  white(spr) {
    if (!this.whiteCache.has(spr)) this.whiteCache.set(spr, makeWhite(spr))
    return this.whiteCache.get(spr)
  }

  setZone(world) {
    this.world = world
    const W = world.w * TILE
    const H = world.h * TILE
    this.static.width = W
    this.static.height = H
    const g = this.staticG
    g.imageSmoothingEnabled = false
    for (let y = 0; y < world.h; y++) {
      for (let x = 0; x < world.w; x++) {
        let ch = world.grid[y][x]
        if (ch === 'H' || ch === 'h') ch = '.'
        paintTile(g, ch, x, y, world.zone.style)
      }
    }
    for (const hs of world.houses) paintHouse(g, hs.tx, hs.ty, hs.tw, hs.th, hs.seed)
    // exit pads: faint rune circles
    for (const ex of world.exits) {
      g.strokeStyle = 'rgba(150,170,220,0.35)'
      g.lineWidth = 1
      g.beginPath()
      g.arc(ex.x, ex.y, 7, 0, Math.PI * 2)
      g.stroke()
      g.strokeStyle = 'rgba(150,170,220,0.18)'
      g.beginPath()
      g.arc(ex.x, ex.y, 10, 0, Math.PI * 2)
      g.stroke()
    }
    this.particles = []
    this.weatherP = []
    this.initWeather()
    this.fadeT = 1
  }

  initWeather() {
    const kind = this.world.zone.weather
    const n = kind === 'rain' ? 90 : kind === 'ash' ? 46 : 34
    for (let i = 0; i < n; i++) {
      this.weatherP.push({
        x: Math.random() * VIEW_W,
        y: Math.random() * VIEW_H,
        v: 0.5 + Math.random(),
        ph: Math.random() * Math.PI * 2,
      })
    }
  }

  updateCamera(focus, dt, snap = false) {
    if (!focus.length || !this.world) return
    let cx = 0
    let cy = 0
    for (const f of focus) {
      cx += f.x
      cy += f.y
    }
    cx /= focus.length
    cy /= focus.length
    const maxX = this.world.w * TILE - VIEW_W
    const maxY = this.world.h * TILE - VIEW_H
    const tx = clamp(cx - VIEW_W / 2, 0, Math.max(0, maxX))
    const ty = clamp(cy - VIEW_H / 2, 0, Math.max(0, maxY))
    if (snap) {
      this.cam.x = tx
      this.cam.y = ty
    } else {
      const k = 1 - Math.pow(0.0001, dt)
      this.cam.x += (tx - this.cam.x) * k
      this.cam.y += (ty - this.cam.y) * k
    }
  }

  // ---------- events -> fx ----------
  handleEvent(ev) {
    switch (ev.t) {
      case 'hit':
        this.spawnBurst(ev.x, ev.y, 5, '#e8d8b0', 60)
        break
      case 'phit':
        this.shake = Math.max(this.shake, 3)
        this.spawnBurst(ev.x, ev.y, 7, '#c94f4f', 70)
        break
      case 'die':
        this.spawnBurst(ev.x, ev.y, 14, ev.kind === 'wisp' ? '#7de0a0' : '#6a5a6e', 85)
        if (ev.kind === 'paleking') this.shake = 9
        break
      case 'swing':
        break
      case 'nova':
        this.spawnRing(ev.x, ev.y, '#ff9a3d')
        this.flash = Math.max(this.flash, 0.25)
        this.shake = Math.max(this.shake, 2.5)
        break
      case 'slam':
      case 'kingsweep':
        this.shake = Math.max(this.shake, 4)
        this.spawnRing(ev.x, ev.y, '#8a8aa0')
        break
      case 'bonfire':
      case 'brazier':
        this.spawnBurst(ev.x, ev.y, 16, '#ffb84d', 80)
        break
      case 'ember':
        this.spawnBurst(ev.x, ev.y, 3, '#ffd23d', 40)
        break
      case 'heal':
      case 'revived':
        this.spawnBurst(ev.x, ev.y, 10, '#7de0a0', 55)
        break
      case 'pdown':
        this.shake = Math.max(this.shake, 5)
        break
      case 'gate':
        this.shake = Math.max(this.shake, 3)
        this.spawnBurst(ev.x, ev.y, 12, '#b8a44f', 70)
        break
      case 'beamwarn':
        this.beamWarns.push({ x: ev.x, y: ev.y, ang: ev.ang, t: 0.9, fired: false })
        break
      case 'beamfire': {
        const w = this.beamWarns.find((b) => !b.fired)
        if (w) {
          w.fired = true
          w.t = 0.35
        }
        this.flash = Math.max(this.flash, 0.4)
        this.shake = Math.max(this.shake, 6)
        break
      }
      case 'victory':
        this.flash = 1
        break
      case 'pfizzle':
        this.spawnBurst(ev.x, ev.y, 3, ev.kind === 'firebolt' ? '#ff9a3d' : '#7f6ad6', 40)
        break
      case 'summon':
        this.spawnBurst(ev.x, ev.y, 10, '#7fd6ff', 60)
        break
    }
  }

  spawnBurst(x, y, n, color, speed) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2
      const s = speed * (0.4 + Math.random() * 0.8)
      this.particles.push({
        x, y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s - 20,
        ttl: 0.35 + Math.random() * 0.4,
        max: 0.7,
        color,
        sz: Math.random() < 0.4 ? 2 : 1,
      })
    }
  }

  spawnRing(x, y, color) {
    this.particles.push({ ring: true, x, y, r: 6, ttl: 0.4, max: 0.4, color })
  }

  // ---------- frame ----------
  draw(state, dt, opts = {}) {
    const g = this.ctx
    this.time += dt
    this.shake = Math.max(0, this.shake - dt * 14)
    this.flash = Math.max(0, this.flash - dt * 2.2)
    this.fadeT = Math.max(0, this.fadeT - dt * 1.6)
    const zone = this.world.zone

    const shx = this.shake > 0 ? (Math.random() - 0.5) * this.shake : 0
    const shy = this.shake > 0 ? (Math.random() - 0.5) * this.shake : 0
    const camX = Math.round(this.cam.x + shx)
    const camY = Math.round(this.cam.y + shy)

    g.fillStyle = '#06040b'
    g.fillRect(0, 0, VIEW_W, VIEW_H)
    g.drawImage(this.static, camX, camY, VIEW_W, VIEW_H, 0, 0, VIEW_W, VIEW_H)

    // gates (closed = bars)
    for (const gate of state.gates) {
      if (gate.o || gate.opened) continue
      const gx = gate.tx * TILE - camX
      const gy = gate.ty * TILE - camY
      g.fillStyle = '#241f2e'
      g.fillRect(gx - 16, gy + 2, 48, 4)
      g.fillStyle = '#4a4258'
      for (let i = 0; i < 5; i++) g.fillRect(gx + i * 4 - 1, gy - 2, 2, 18)
      g.fillStyle = '#6a6280'
      g.fillRect(gx - 2, gy + 5, 20, 2)
    }

    // build y-sorted draw list: props + entities
    const items = []
    for (const pr of state.props) {
      items.push({ y: pr.y ?? (pr.ty * TILE + 12), draw: () => this.drawProp(pr, camX, camY) })
    }
    for (const n of state.npcs || []) {
      items.push({ y: n.y, draw: () => this.drawNPC(n, camX, camY) })
    }
    for (const e of state.enemies) {
      items.push({ y: e.y, draw: () => this.drawEnemy(e, camX, camY) })
    }
    for (const p of state.players) {
      if (p) items.push({ y: p.y, draw: () => this.drawPlayer(p, camX, camY) })
    }
    for (const k of state.pickups) {
      items.push({ y: k.y, draw: () => this.drawPickup(k, camX, camY) })
    }
    items.sort((a, b) => a.y - b.y)
    for (const it of items) it.draw()

    // projectiles above
    for (const pr of state.projs) this.drawProj(pr, camX, camY)

    // beam warns
    this.beamWarns = this.beamWarns.filter((b) => (b.t -= dt) > 0)
    for (const b of this.beamWarns) {
      g.save()
      g.translate(b.x - camX, b.y - camY)
      g.rotate(b.ang)
      if (!b.fired) {
        g.fillStyle = `rgba(180,120,220,${0.25 + 0.15 * Math.sin(this.time * 20)})`
        g.fillRect(0, -3, 240, 6)
      } else {
        g.fillStyle = `rgba(220,180,255,${b.t / 0.35})`
        g.fillRect(0, -7, 240, 14)
        g.fillStyle = `rgba(255,255,255,${(b.t / 0.35) * 0.8})`
        g.fillRect(0, -2, 240, 4)
      }
      g.restore()
    }

    // particles
    this.updateParticles(dt, g, camX, camY)

    // lighting overlay
    this.drawLighting(state, camX, camY)

    // weather (over lighting: rain/ash visible in dark)
    this.drawWeather(dt, g, zone)

    // lightning
    if (zone.lightning) {
      this.lightningT -= dt
      if (this.lightningT <= 0) {
        this.lightningT = 4 + Math.random() * 7
        this.flash = Math.max(this.flash, 0.55)
        if (opts.onThunder) opts.onThunder()
      }
    }
    if (this.flash > 0) {
      g.fillStyle = `rgba(220,215,255,${Math.min(0.85, this.flash)})`
      g.fillRect(0, 0, VIEW_W, VIEW_H)
    }

    // vignette
    const vg = g.createRadialGradient(VIEW_W / 2, VIEW_H / 2, VIEW_H * 0.45, VIEW_W / 2, VIEW_H / 2, VIEW_H * 0.85)
    vg.addColorStop(0, 'rgba(0,0,0,0)')
    vg.addColorStop(1, 'rgba(0,0,0,0.42)')
    g.fillStyle = vg
    g.fillRect(0, 0, VIEW_W, VIEW_H)

    if (this.fadeT > 0) {
      g.fillStyle = `rgba(4,2,8,${this.fadeT})`
      g.fillRect(0, 0, VIEW_W, VIEW_H)
    }
  }

  // ---------- entity draws ----------
  drawShadow(g, x, y, w) {
    g.fillStyle = 'rgba(0,0,0,0.32)'
    g.beginPath()
    g.ellipse(x, y, w, w * 0.42, 0, 0, Math.PI * 2)
    g.fill()
  }

  drawPlayer(p, camX, camY) {
    const g = this.ctx
    const x = Math.round(p.x - camX)
    const y = Math.round(p.y - camY)
    const set = SPR[p.cls === 'knight' ? 'knight' : 'pyro']
    this.drawShadow(g, x, y + 6, 5)

    if (p.st === 'down' || p.state === 'down') {
      g.drawImage(set.down, x - 6, y - 8)
      // revive ring
      const rt = p.rT ?? p.reviveT ?? 0
      if (rt > 0) {
        g.strokeStyle = '#7de0a0'
        g.beginPath()
        g.arc(x, y - 12, 6, -Math.PI / 2, -Math.PI / 2 + (rt / 3) * Math.PI * 2)
        g.stroke()
      } else {
        // distress marker
        if (Math.sin(this.time * 6) > 0) {
          g.fillStyle = '#c94f4f'
          g.fillRect(x - 1, y - 16, 2, 5)
          g.fillRect(x - 1, y - 9, 2, 2)
        }
      }
      return
    }
    if (p.st === 'dead' || p.state === 'dead') {
      g.globalAlpha = 0.4
      g.drawImage(set.down, x - 6, y - 8)
      g.globalAlpha = 1
      return
    }

    const moving = p.mv ?? p.moving
    const walk = moving && Math.floor((p.walkT ?? this.time * 9) % 2) === 0
    const spr = walk ? set.walk : set.idle
    const iT = p.iT ?? 0
    if (iT > 0 && Math.floor(this.time * 18) % 2 === 0) g.globalAlpha = 0.45
    const flipX = (p.fx ?? 0) < -0.05
    g.save()
    g.translate(x, y)
    if (flipX) g.scale(-1, 1)
    const dodging = (p.dg ?? (p.dodgeT > 0 ? 1 : 0)) === 1
    const dashing = (p.ds ?? (p.dashT > 0 ? 1 : 0)) === 1
    if (dodging) g.rotate(Math.sin(this.time * 30) * 0.4)
    g.drawImage(spr, -6, -11)
    g.restore()
    g.globalAlpha = 1

    // weapon swing
    const sw = p.sw ?? p.swing ?? 0
    if (sw > 0) {
      const dir = p.sd ?? p.swingDir ?? 0
      g.save()
      g.translate(x, y - 2)
      g.rotate(dir)
      if (p.cls === 'knight') {
        const prog = 1 - sw // 0..1
        const a0 = -1.3 + prog * 2.6
        g.strokeStyle = `rgba(220,230,245,${sw * 0.9})`
        g.lineWidth = 2
        g.beginPath()
        g.arc(0, 0, 17, a0 - 0.9, a0 + 0.35)
        g.stroke()
        g.strokeStyle = `rgba(150,170,200,${sw * 0.45})`
        g.beginPath()
        g.arc(0, 0, 13, a0 - 1.1, a0 + 0.3)
        g.stroke()
      } else {
        g.fillStyle = `rgba(255,154,61,${sw * 0.8})`
        g.fillRect(8, -2, 5, 4)
      }
      g.restore()
    }
    if (dashing) {
      g.fillStyle = 'rgba(180,200,230,0.3)'
      g.fillRect(x - 8, y - 10, 16, 16)
    }
  }

  drawNPC(n, camX, camY) {
    const g = this.ctx
    const x = Math.round(n.x - camX)
    const y = Math.round(n.y - camY)
    this.drawShadow(g, x, y + 5, 4)
    const spr = n.i === 0 ? SPR.elder : n.i === 1 ? SPR.smith : SPR.child
    const bob = Math.sin(this.time * 1.5 + n.i * 2) > 0.85 ? 1 : 0
    g.drawImage(spr, x - 5, y - 9 - bob)
    // interaction hint sparkle
    if (Math.sin(this.time * 3 + n.i) > 0.6) {
      g.fillStyle = 'rgba(255,210,61,0.8)'
      g.fillRect(x - 1, y - 15, 1, 1)
    }
  }

  drawEnemy(e, camX, camY) {
    const g = this.ctx
    const x = Math.round(e.x - camX)
    const y = Math.round(e.y - camY)
    const k = e.k || e.kind
    const frames = SPR[k]
    if (!frames) return
    const fr = frames[Math.floor(this.time * 6 + e.id) % frames.length]
    const flip = (e.fx ?? 0) < -0.05
    const big = k === 'paleking'
    this.drawShadow(g, x, y + (big ? 10 : 5), big ? 9 : k === 'brute' || k === 'sentinel' ? 7 : 5)

    // wind-up telegraph: pulse red
    const winding = (e.st || e.state) === 'wind'
    g.save()
    g.translate(x, y)
    if (flip) g.scale(-1, 1)
    if (winding && Math.floor(this.time * 10) % 2 === 0) {
      g.translate((Math.random() - 0.5) * 1.5, 0)
    }
    if (k === 'wisp') {
      const s = 1 + Math.sin(this.time * 7 + e.id) * 0.25
      g.globalAlpha = 0.85
      g.drawImage(fr, -4 * s, -6 * s, 8 * s, 8 * s)
      g.globalAlpha = 1
    } else {
      const ox = -fr.width / 2
      const oy = -fr.height + (big ? 8 : 5)
      g.drawImage(fr, ox, oy)
      if ((e.hf ?? (e.hitFlash > 0 ? 1 : 0)) === 1) {
        g.globalAlpha = 0.75
        g.drawImage(this.white(fr), ox, oy)
        g.globalAlpha = 1
      }
    }
    g.restore()

    if (winding) {
      g.fillStyle = `rgba(240,90,90,${0.5 + 0.4 * Math.sin(this.time * 16)})`
      g.fillRect(x - 1, y - (big ? 26 : 16), 2, 4)
    }
    // health bar when damaged
    const hp = e.hp
    const mhp = e.mhp || e.maxhp
    if (hp < mhp && k !== 'paleking') {
      g.fillStyle = 'rgba(10,8,14,0.8)'
      g.fillRect(x - 7, y - (big ? 24 : 15), 14, 2)
      g.fillStyle = '#c94f4f'
      g.fillRect(x - 7, y - (big ? 24 : 15), Math.max(1, Math.round((hp / mhp) * 14)), 2)
    }
  }

  drawProp(pr, camX, camY) {
    const g = this.ctx
    const x = Math.round(pr.x - camX)
    const y = Math.round(pr.y - camY)
    switch (pr.kind) {
      case 'torch': {
        g.drawImage(SPR.torchpost, x - 4, y - 12)
        // animated flame
        const f = Math.floor(this.time * 10 + pr.tx) % 3
        g.fillStyle = ['#ffd23d', '#ff9a3d', '#ffb84d'][f]
        g.fillRect(x - 1, y - 13 - (f === 1 ? 1 : 0), 2, 2)
        break
      }
      case 'bonfire': {
        g.drawImage(SPR.bonfire, x - 4, y - 6)
        const f = Math.floor(this.time * 12 + pr.tx) % 3
        g.fillStyle = ['#ffd23d', '#fff0a0', '#ff9a3d'][f]
        g.fillRect(x - 1 + (f - 1), y - 7 - f, 2, 2)
        break
      }
      case 'brazier':
        g.drawImage(pr.lit ? SPR.brazierOn : SPR.brazierOff, x - 4, y - (pr.lit ? 8 : 6))
        break
      case 'chest':
        g.drawImage(pr.opened ? SPR.chestOpen : SPR.chest, x - 4, y - 4)
        break
      case 'keyitem':
        if (!pr.taken) {
          const bob = Math.sin(this.time * 3) * 2
          g.drawImage(SPR.sigil, x - 3, y - 6 + bob)
          g.fillStyle = `rgba(127,214,255,${0.3 + 0.2 * Math.sin(this.time * 4)})`
          g.fillRect(x - 1, y - 4 + bob, 1, 1)
        }
        break
      case 'emberpile':
        if (!pr.taken) {
          g.fillStyle = '#3a2a20'
          g.fillRect(x - 4, y - 2, 8, 4)
          g.fillStyle = `rgba(255,154,61,${0.6 + 0.4 * Math.sin(this.time * 5)})`
          g.fillRect(x - 2, y - 3, 2, 2)
          g.fillRect(x + 1, y - 1, 1, 1)
        }
        break
      case 'beacon': {
        // stone pedestal
        g.fillStyle = '#565664'
        g.fillRect(x - 8, y - 4, 16, 8)
        g.fillStyle = '#6e6e7d'
        g.fillRect(x - 6, y - 8, 12, 5)
        g.fillStyle = '#3a3a47'
        g.fillRect(x - 8, y + 2, 16, 2)
        if (pr.lit) {
          // the beam
          const grd = g.createLinearGradient(x, y - 160, x, y - 8)
          grd.addColorStop(0, 'rgba(255,240,200,0)')
          grd.addColorStop(1, 'rgba(255,240,200,0.85)')
          g.fillStyle = grd
          g.fillRect(x - 5 - Math.sin(this.time * 2) * 1.5, y - 160, 10 + Math.sin(this.time * 2) * 3, 152)
          g.fillStyle = '#fff0c0'
          g.fillRect(x - 3, y - 10, 6, 4)
        } else {
          g.fillStyle = `rgba(127,214,255,${0.3 + 0.25 * Math.sin(this.time * 2)})`
          g.fillRect(x - 2, y - 7, 4, 3)
        }
        break
      }
    }
  }

  drawPickup(k, camX, camY) {
    const g = this.ctx
    const x = Math.round(k.x - camX)
    const y = Math.round(k.y - camY)
    const kind = k.k || k.kind
    const bob = Math.sin(this.time * 5 + (k.id % 10)) * 1.5
    if (kind === 'ember') {
      g.drawImage(SPR.ember, x - 1, y - 1 + bob * 0.5)
    } else if (kind === 'heart') {
      g.drawImage(SPR.heart, x - 2, y - 2 + bob)
    } else if (kind === 'key') {
      g.drawImage(SPR.key, x - 3, y - 3 + bob)
    }
  }

  drawProj(pr, camX, camY) {
    const g = this.ctx
    const x = Math.round(pr.x - camX)
    const y = Math.round(pr.y - camY)
    const kind = pr.k || pr.kind
    if (kind === 'firebolt') {
      g.fillStyle = '#ffd23d'
      g.fillRect(x - 2, y - 2, 4, 4)
      g.fillStyle = '#ff9a3d'
      g.fillRect(x - 3, y - 1, 2, 2)
      g.fillRect(x + 2, y - 1, 1, 2)
      // trail spark
      if (Math.random() < 0.5)
        this.particles.push({ x: pr.x, y: pr.y, vx: (Math.random() - 0.5) * 20, vy: -10, ttl: 0.25, max: 0.25, color: '#ff9a3d', sz: 1 })
    } else {
      g.fillStyle = '#7f6ad6'
      g.fillRect(x - 2, y - 2, 4, 4)
      g.fillStyle = '#b8a0ff'
      g.fillRect(x - 1, y - 1, 2, 2)
    }
  }

  updateParticles(dt, g, camX, camY) {
    this.particles = this.particles.filter((p) => (p.ttl -= dt) > 0)
    for (const p of this.particles) {
      if (p.ring) {
        p.r += dt * 130
        g.strokeStyle = p.color
        g.globalAlpha = p.ttl / p.max
        g.beginPath()
        g.arc(p.x - camX, p.y - camY, p.r, 0, Math.PI * 2)
        g.stroke()
        g.globalAlpha = 1
        continue
      }
      p.x += p.vx * dt
      p.y += p.vy * dt
      p.vy += 60 * dt
      g.globalAlpha = Math.min(1, p.ttl / (p.max * 0.5))
      g.fillStyle = p.color
      g.fillRect(Math.round(p.x - camX), Math.round(p.y - camY), p.sz || 1, p.sz || 1)
      g.globalAlpha = 1
    }
  }

  // ---------- lighting ----------
  drawLighting(state, camX, camY) {
    const zone = this.world.zone
    const lg = this.lightG
    const [ar, ag, ab] = zone.ambient
    lg.globalCompositeOperation = 'source-over'
    lg.fillStyle = `rgba(${ar},${ag},${ab},${zone.darkness})`
    lg.fillRect(0, 0, VIEW_W, VIEW_H)

    const lights = []
    for (const p of state.players) {
      if (!p) continue
      const st = p.st || p.state
      if (st === 'dead') continue
      const cls = CLASSES[p.cls]
      const base = cls.lightR + (state.lightBonus?.[p.id] || 0)
      lights.push({ x: p.x, y: p.y, r: base, warm: true, flicker: true })
    }
    for (const pr of state.props) {
      if (pr.kind === 'torch') lights.push({ x: pr.x, y: pr.y - 8, r: 52, warm: true, flicker: true })
      else if (pr.kind === 'bonfire') lights.push({ x: pr.x, y: pr.y, r: 70, warm: true, flicker: true })
      else if (pr.kind === 'brazier' && pr.lit) lights.push({ x: pr.x, y: pr.y - 4, r: 64, warm: true, flicker: true })
      else if (pr.kind === 'beacon' && pr.lit) lights.push({ x: pr.x, y: pr.y - 20, r: 160, warm: true })
      else if (pr.kind === 'keyitem' && !pr.taken) lights.push({ x: pr.x, y: pr.y, r: 26, cold: true })
    }
    for (const prj of state.projs) {
      const kind = prj.k || prj.kind
      lights.push({ x: prj.x, y: prj.y, r: kind === 'firebolt' ? 30 : 24, warm: kind === 'firebolt', cold: kind !== 'firebolt' })
    }
    for (const e of state.enemies) {
      if ((e.k || e.kind) === 'wisp') lights.push({ x: e.x, y: e.y, r: 22, cold: true })
      if ((e.k || e.kind) === 'paleking') lights.push({ x: e.x, y: e.y - 10, r: 40, cold: true })
    }
    // house windows glow
    if (zone.style === 'village') {
      for (const hs of this.world.houses) {
        lights.push({ x: hs.tx * TILE + 8, y: hs.ty * TILE + hs.th * 10, r: 30, warm: true })
      }
    }

    lg.globalCompositeOperation = 'destination-out'
    for (const l of lights) {
      const x = l.x - camX
      const y = l.y - camY
      const fl = l.flicker ? 1 + Math.sin(this.time * 11 + l.x * 0.7) * 0.06 + Math.sin(this.time * 23 + l.y) * 0.04 : 1
      const r = l.r * fl
      if (x < -r || y < -r || x > VIEW_W + r || y > VIEW_H + r) continue
      const grd = lg.createRadialGradient(x, y, r * 0.15, x, y, r)
      grd.addColorStop(0, 'rgba(0,0,0,0.95)')
      grd.addColorStop(0.6, 'rgba(0,0,0,0.5)')
      grd.addColorStop(1, 'rgba(0,0,0,0)')
      lg.fillStyle = grd
      lg.beginPath()
      lg.arc(x, y, r, 0, Math.PI * 2)
      lg.fill()
    }

    this.ctx.drawImage(this.light, 0, 0)

    // warm additive glow pass
    const g = this.ctx
    g.globalCompositeOperation = 'lighter'
    for (const l of lights) {
      const x = l.x - camX
      const y = l.y - camY
      const r = l.r * 0.55
      if (x < -r || y < -r || x > VIEW_W + r || y > VIEW_H + r) continue
      const grd = g.createRadialGradient(x, y, 1, x, y, r)
      if (l.warm) {
        grd.addColorStop(0, 'rgba(255,160,60,0.20)')
        grd.addColorStop(1, 'rgba(255,120,40,0)')
      } else {
        grd.addColorStop(0, 'rgba(120,190,255,0.16)')
        grd.addColorStop(1, 'rgba(90,140,255,0)')
      }
      g.fillStyle = grd
      g.beginPath()
      g.arc(x, y, r, 0, Math.PI * 2)
      g.fill()
    }
    g.globalCompositeOperation = 'source-over'
  }

  drawWeather(dt, g, zone) {
    const kind = zone.weather
    if (!kind) return
    for (const w of this.weatherP) {
      if (kind === 'rain') {
        w.y += 320 * dt * w.v
        w.x -= 60 * dt * w.v
        if (w.y > VIEW_H) {
          w.y = -4
          w.x = Math.random() * (VIEW_W + 40)
        }
        g.strokeStyle = 'rgba(160,180,220,0.35)'
        g.beginPath()
        g.moveTo(w.x, w.y)
        g.lineTo(w.x + 1.5, w.y + 7)
        g.stroke()
      } else if (kind === 'ash') {
        w.y += 18 * dt * w.v
        w.x += Math.sin(this.time + w.ph) * 8 * dt
        if (w.y > VIEW_H) {
          w.y = -2
          w.x = Math.random() * VIEW_W
        }
        g.fillStyle = 'rgba(160,150,160,0.4)'
        g.fillRect(w.x, w.y, 1, 1)
      } else if (kind === 'embers') {
        w.y -= 9 * dt * w.v
        w.x += Math.sin(this.time * 1.5 + w.ph) * 10 * dt
        if (w.y < -2) {
          w.y = VIEW_H + 2
          w.x = Math.random() * VIEW_W
        }
        const a = 0.25 + 0.25 * Math.sin(this.time * 3 + w.ph)
        g.fillStyle = `rgba(255,154,61,${a})`
        g.fillRect(w.x, w.y, 1, 1)
      } else if (kind === 'fireflies') {
        w.x += Math.sin(this.time * 0.8 + w.ph) * 14 * dt
        w.y += Math.cos(this.time * 0.6 + w.ph * 2) * 10 * dt
        const a = Math.max(0, Math.sin(this.time * 1.2 + w.ph * 5)) * 0.5
        if (a > 0.05) {
          g.fillStyle = `rgba(160,255,170,${a})`
          g.fillRect(((w.x % VIEW_W) + VIEW_W) % VIEW_W, ((w.y % VIEW_H) + VIEW_H) % VIEW_H, 1, 1)
        }
      } else if (kind === 'stars') {
        const a = 0.3 + 0.3 * Math.sin(this.time * 0.7 + w.ph * 9)
        if (w.y < VIEW_H * 0.5) {
          g.fillStyle = `rgba(220,230,255,${a})`
          g.fillRect(w.x, w.y * 0.5, 1, 1)
        }
      }
    }
  }
}

function clamp(v, a, b) {
  return Math.max(a, Math.min(b, v))
}
