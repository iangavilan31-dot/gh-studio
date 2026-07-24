// MOONREST co-op (MASTER_PROMPT Part 5): PeerJS data channels, host = authority.
// Flow: hostNight() → 4-letter room code, peer id `moonrest-<code>`; joinNight(code)
// connects. Transforms {pos,yaw,gait,emote} at 10Hz with a 150ms interpolation
// buffer; events are reliable and host-relayed; the moon clock is a host-owned
// heartbeat every 5s; late joiners get a full world snapshot. Max 4 players.
// No text chat anywhere — presence is emotes, lantern-light, and proximity.

import * as THREE from 'three'
import Peer from 'peerjs'
import { buildWizard, PLAYER_TINTS } from '../art/characters.js'
import { makeAnimState, advanceAnim, applyPose } from '../systems/anim.js'
import { retroMaterial, ensureVertexColors } from '../art/materials.js'
import { canvasOf, toTexture } from '../art/textures.js'

// wordless-safe alphabet (no vowels → no words; no I/L confusables)
const SAFE = 'BCDFGHJKMNPQRSTVWXZ'
export function makeRoomCode() {
  // crypto randomness, not worldRNG: codes must differ between hosts on the
  // same build seed (this is lobby identity, not world generation)
  const a = new Uint32Array(4)
  crypto.getRandomValues(a)
  return [...a].map((v) => SAFE[v % SAFE.length]).join('')
}

export function sanitizeName(raw) {
  return String(raw ?? '').toLowerCase().replace(/[^a-z]/g, '').slice(0, 6) || 'keeper'
}

// Floating name runes (Part 5.2: names render as small runes, never latin text).
// Glyphs are STROKED procedurally — deterministic per letter (same name renders
// identically on every peer), no font dependence (headless/odd systems included).
function strokeRune(ctx, code, x, y, w, h) {
  let s = (code * 2654435761) >>> 0 // per-letter hash → stable angular glyph
  const rnd = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296 }
  ctx.beginPath()
  ctx.moveTo(x + w * 0.5, y) // every rune has the vertical stem
  ctx.lineTo(x + w * 0.5, y + h)
  const branches = 1 + Math.floor(rnd() * 3)
  for (let i = 0; i < branches; i++) {
    const fromY = y + h * (0.15 + 0.7 * rnd())
    const side = rnd() < 0.5 ? -1 : 1
    const toX = x + w * 0.5 + side * w * 0.5
    const toY = fromY + (rnd() < 0.5 ? -1 : 1) * h * (0.2 + 0.25 * rnd())
    ctx.moveTo(x + w * 0.5, fromY)
    ctx.lineTo(toX, Math.max(y, Math.min(y + h, toY)))
    if (rnd() < 0.35) { ctx.lineTo(x + w * 0.5, Math.max(y, Math.min(y + h, toY + h * 0.22 * side))) }
  }
  ctx.stroke()
}
function runePlate(name) {
  const clean = sanitizeName(name)
  const c = canvasOf(128, (ctx) => {
    ctx.clearRect(0, 0, 128, 128)
    ctx.strokeStyle = 'rgba(226,220,255,0.92)'
    ctx.lineWidth = 3
    ctx.lineCap = 'round'
    const n = clean.length
    const rw = 12, gap = 7
    const total = n * rw + (n - 1) * gap
    let cx = 64 - total / 2
    for (const ch of clean) {
      strokeRune(ctx, ch.charCodeAt(0), cx, 50, rw, 28)
      cx += rw + gap
    }
  })
  const tex = toTexture(c)
  const mat = retroMaterial({ map: tex, transparent: true, depthWrite: false, noFog: true, emissive: '#8f88b8' })
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.9), mat)
  ensureVertexColors(mesh.geometry)
  return mesh
}

const DEFAULT_NAMES = ['keeper', 'wander', 'drift', 'ember']

// ——— A remote lamplighter: interpolated rig + rune plate + stride footsteps ———
export class RemotePlayer {
  constructor(scene, world, { id, name, tint }) {
    this.id = id
    this.name = sanitizeName(name)
    this.rig = buildWizard({ tint: PLAYER_TINTS[tint % PLAYER_TINTS.length] })
    scene.add(this.rig.group)
    this.scene = scene
    this.world = world
    // their lantern lights the world identically to the local one (5.3)
    if (this.rig.staffFlame) world.flames.push({ mesh: this.rig.staffFlame, tex: this.rig.staffFlame.material.uniforms.uMap.value, frame: (tint * 2) % 4, acc: 0 })
    if (this.rig.staffHalo) world.halos.push(this.rig.staffHalo)
    this.plate = runePlate(this.name)
    this.plate.position.y = 2.05
    this.rig.group.add(this.plate)
    this.anim = makeAnimState()
    this.buf = [] // interpolation samples {t, x, y, z, yaw}
    this.pos = new THREE.Vector3()
    this.yaw = 0
    this.action = null
    this.fading = 0 // >0 → disconnect fade-to-fireflies in progress
    this._lastStride = 0
    this.onFootstep = null
  }

  push(t, p, yaw, gait, act) {
    this.buf.push({ t, x: p[0], y: p[1], z: p[2], yaw })
    if (this.buf.length > 24) this.buf.shift()
    this.gait = gait
    if (act !== this.action) { this.action = act; this.anim.action = act; this.anim.actionT = 0 }
  }

  // 150ms interpolation delay; hermite between bracketing samples when the
  // buffer allows, else lerp; teleport snap when error >3m (5.2)
  update(dt, now, camera) {
    if (this.fading > 0) {
      this.fading += dt
      const s = Math.max(0.001, 1 - this.fading / 1.4)
      this.rig.group.scale.setScalar(s)
      this.rig.group.visible = this.fading < 1.4
      return
    }
    const rt = now - 150
    const b = this.buf
    let px = this.pos.x, py = this.pos.y, pz = this.pos.z, yw = this.yaw
    if (b.length >= 2) {
      let i = b.length - 2
      while (i > 0 && b[i].t > rt) i--
      const s0 = b[i], s1 = b[i + 1]
      const span = Math.max(1, s1.t - s0.t)
      const u = Math.min(1.25, Math.max(0, (rt - s0.t) / span)) // slight extrapolation allowed
      // hermite tangents from neighbors (finite differences)
      const sm = b[i - 1] ?? s0, sp = b[i + 2] ?? s1
      const h00 = (1 + 2 * u) * (1 - u) * (1 - u), h10 = u * (1 - u) * (1 - u)
      const h01 = u * u * (3 - 2 * u), h11 = u * u * (u - 1)
      const herm = (p0, p1, m0, m1) => h00 * p0 + h10 * m0 + h01 * p1 + h11 * m1
      px = herm(s0.x, s1.x, (s1.x - sm.x) * 0.5, (sp.x - s0.x) * 0.5)
      py = herm(s0.y, s1.y, (s1.y - sm.y) * 0.5, (sp.y - s0.y) * 0.5)
      pz = herm(s0.z, s1.z, (s1.z - sm.z) * 0.5, (sp.z - s0.z) * 0.5)
      let dy = s1.yaw - s0.yaw
      while (dy > Math.PI) dy -= Math.PI * 2
      while (dy < -Math.PI) dy += Math.PI * 2
      yw = s0.yaw + dy * Math.min(1, u)
    } else if (b.length === 1) {
      px = b[0].x; py = b[0].y; pz = b[0].z; yw = b[0].yaw
    }
    const err = Math.hypot(px - this.pos.x, pz - this.pos.z)
    const speed = err / Math.max(dt, 1e-4)
    if (err > 3) this.pos.set(px, py, pz) // snap
    else this.pos.lerp(_v.set(px, py, pz), 1 - Math.exp(-18 * dt))
    this.yaw = yw
    advanceAnim(this.anim, dt, Math.min(speed, 4), false)
    // quieter remote footsteps (5.3), only when near enough to matter
    const strideIdx = Math.floor(this.anim.phase / Math.PI)
    if (strideIdx !== this._lastStride) {
      this._lastStride = strideIdx
      const d2cam = camera ? camera.position.distanceTo(this.pos) : 99
      if (this.anim.speed > 0.4 && d2cam < 24 && this.onFootstep) {
        this.onFootstep(this.world.surfaceAt(this.pos.x, this.pos.z), Math.min(0.4, this.anim.speed / 8))
      }
    }
    this.rig.group.position.copy(this.pos)
    this.rig.group.rotation.y = this.yaw
    applyPose(this.rig, this.anim, now / 1000)
    if (camera) this.plate.lookAt(camera.position) // rune plate faces the viewer
  }

  dispose() {
    this.scene.remove(this.rig.group)
    const fl = this.world.flames.findIndex((f) => f.mesh === this.rig.staffFlame)
    if (fl >= 0) this.world.flames.splice(fl, 1)
    const ha = this.world.halos.indexOf(this.rig.staffHalo)
    if (ha >= 0) this.world.halos.splice(ha, 1)
    disposeRig(this.rig.group) // GPU resources too — join/leave cycles must not grow VRAM
  }
}

// free geometry + per-rig materials/textures (atlas + rune plate are per-player)
export function disposeRig(group) {
  group.traverse((o) => {
    o.geometry?.dispose?.()
    const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : []
    for (const m of mats) { m.uniforms?.uMap?.value?.dispose?.(); m.dispose?.() }
  })
}
const _v = new THREE.Vector3()

// ——— The network layer ———
export class Net {
  constructor(hooks) {
    // hooks: {scene, world, night, getLocal(), applyEvent(ev), onPeerJoin(p),
    //         onPeerLeave(p), onHostLost(), onDeny(reason), spawnFireflies(x,y,z),
    //         snapshot(), applySnapshot(s), log(...)}
    this.h = hooks
    this.peer = null
    this.role = null // 'host' | 'client'
    this.code = null
    this.conns = new Map() // playerId -> DataConnection (host side)
    this.hostConn = null   // client side
    this.remotes = new Map() // playerId -> RemotePlayer
    this.myId = 0
    this.myName = DEFAULT_NAMES[0]
    this.roster = new Map() // playerId -> {name, tint}
    this.channeling = new Map() // playerId -> lightId (host-side validation state)
    this.recentChan = new Map() // playerId -> {id, t}: just-finished channels (grace)
    this._acc = 0
    this._hb = 0
    this.log = []
  }

  get active() { return this.role !== null }
  get peerCount() { return this.remotes.size }

  _peerOpts() {
    // production: public PeerJS cloud (zero config). Test rigs inject a local
    // signaling server via window.__PEER_OPTS__ (never shipped set).
    return window.__PEER_OPTS__ ?? {}
  }

  // full reset so a failed host/join never bricks the session — the next
  // Host/Join Night starts from a clean slate (a peer error like EXPIRE never
  // fires a connection close, so this must be called explicitly)
  _teardown() {
    try { this.peer?.destroy() } catch (e) { /* already down */ }
    this.peer = null
    this.hostConn = null
    this.conns.clear()
    this.roster.clear()
    this.channeling.clear()
    this.recentChan?.clear()
    this.role = null
    this.code = null
    this.myId = 0
    this._joined = false
    this._joinReject = null
  }

  host(name) {
    if (this.role === 'host' && this.peer && !this.peer.destroyed) return Promise.resolve(this.code)
    if (this.role) return Promise.reject(new Error('already networked'))
    this.role = 'host'
    this.myId = 0
    this.myName = sanitizeName(name ?? DEFAULT_NAMES[0])
    this.roster.set(0, { name: this.myName, tint: 0 })
    this.code = makeRoomCode()
    return new Promise((resolve, reject) => {
      this.peer = new Peer('moonrest-' + this.code.toLowerCase(), this._peerOpts())
      this.peer.on('open', () => { this.log.push({ ev: 'host-open', code: this.code }); resolve(this.code) })
      this.peer.on('error', (e) => {
        this.log.push({ ev: 'error', type: e.type })
        // a broker/id failure before anyone connected → clean slate, not a husk
        if (this.role === 'host' && !this.conns.size) { this._teardown(); reject(e) }
      })
      this.peer.on('connection', (conn) => this._hostAccept(conn))
    })
  }

  join(code, name) {
    if (this.role) return Promise.reject(new Error('already networked'))
    this.role = 'client'
    this.myName = sanitizeName(name ?? DEFAULT_NAMES[1])
    this.code = String(code).toUpperCase()
    return new Promise((resolve, reject) => {
      this._joinReject = reject
      this.peer = new Peer(this._peerOpts())
      this.peer.on('error', (e) => {
        this.log.push({ ev: 'error', type: e.type })
        // bad/expired code (EXPIRE, peer-unavailable) rejects the peer WITHOUT
        // ever closing the pending connection — reset here or co-op bricks
        if (!this._joined) { const rj = this._joinReject; this._teardown(); rj?.(e) }
      })
      this.peer.on('open', () => {
        const conn = this.peer.connect('moonrest-' + this.code.toLowerCase(), { reliable: true, serialization: 'json' })
        this.hostConn = conn
        conn.on('open', () => { this._joined = true; conn.send({ t: 'hello', name: this.myName }) })
        conn.on('data', (m) => {
          if (m.t === 'snap') { this._joinReject = null; this._applySnap(m); resolve(m.you) }
          else this._clientData(m)
        })
        // ICE can emit non-fatal error events mid-negotiation while the channel
        // still comes up — only CLOSE means the host is really gone
        conn.on('close', () => {
          if (this._joined) this._hostLost()
          else { const rj = this._joinReject; this._teardown(); rj?.(new Error('could not reach the night')) }
        })
        conn.on('error', (e) => this.log.push({ ev: 'conn-error', type: e?.type ?? String(e).slice(0, 60) }))
      })
    })
  }

  // — host side —
  _hostAccept(conn) {
    conn.on('data', (m) => {
      if (m.t === 'hello') {
        if (conn._mrId != null) return // one seat per connection — ignore repeat hellos
        let id = -1
        for (let i = 1; i < 4; i++) if (!this.roster.has(i)) { id = i; break }
        if (id === -1) { conn.send({ t: 'full' }); setTimeout(() => conn.close(), 300); return }
        const name = sanitizeName(m.name ?? DEFAULT_NAMES[id])
        this.roster.set(id, { name, tint: id })
        this.conns.set(id, conn)
        conn._mrId = id
        // full world snapshot for the late joiner (5.1)
        conn.send({ t: 'snap', you: id, roster: [...this.roster].map(([pid, r]) => ({ id: pid, ...r })), ...this.h.snapshot() })
        this._broadcast({ t: 'peer+', id, name, tint: id }, id)
        this._addRemote(id, name, id)
        this.h.onPeerJoin?.({ id, name })
        this.log.push({ ev: 'peer-join', id, name })
      } else if (m.t === 'tr') {
        const id = conn._mrId
        this.remotes.get(id)?.push(performance.now(), m.p, m.yaw, m.g, m.a)
        if (m.a === 'channel') { /* pose only; channel intent arrives via req */ }
        this._broadcast({ ...m, id }, id)
      } else if (m.t === 'req') {
        this._hostValidate(conn._mrId, m)
      }
    })
    conn.on('close', () => this._drop(conn._mrId))
    conn.on('error', (e) => this.log.push({ ev: 'conn-error', id: conn._mrId, type: e?.type ?? String(e).slice(0, 60) }))
  }

  _hostValidate(from, m) {
    if (m.ev === 'kindle') {
      const light = this.h.world.lights.find((l) => l.id === m.id)
      if (!light || light.kindled) return
      // host-side reach check: a keeper can only kindle what they stand beside
      // (clients enforce 2m; the host allows slack for interp, not teleports)
      const rp = this.remotes.get(from)
      if (rp && Math.hypot(rp.pos.x - light.x, rp.pos.z - light.z) > 8) return
      if (m.id === 'isle-keep-brazier' && !this._allChanneling(m.id)) {
        this.conns.get(from)?.send({ t: 'deny', reason: 'brazier' })
        return
      }
      this.broadcastEvent({ ev: 'kindle', id: m.id, from })
    } else if (m.ev === 'chan') {
      if (m.on) this.channeling.set(from, m.id)
      else { this.channeling.delete(from); this.recentChan.set(from, { id: m.id, t: performance.now() }) }
      this._broadcast({ t: 'ev', ev: 'chan', on: m.on, id: m.id, from }, from)
    } else if (m.ev === 'emote') {
      this._broadcast({ t: 'ev', ev: 'emote', id: m.id, from }, from)
    }
  }

  // brazier law (Part 3 isle): every present player must be channeling it.
  // A channel that JUST completed still counts (each keeper's own stop message
  // precedes their kindle request — simultaneity needs a grace window).
  _allChanneling(lightId) {
    const now = performance.now()
    const counts = (pid) => {
      if (this.channeling.get(pid) === lightId) return true
      const r = this.recentChan.get(pid)
      return r && r.id === lightId && now - r.t < 2500
    }
    for (const [pid] of this.roster) if (!counts(pid)) return false
    return true
  }

  // host applies + broadcasts a validated/authored event (single source of truth)
  broadcastEvent(ev) {
    if (this.role !== 'host') return
    this._broadcast({ t: 'ev', ...ev })
    this.h.applyEvent(ev)
  }

  // client → host request (host applies its own actions directly via broadcastEvent)
  request(ev) {
    if (this.role === 'client') { if (this.hostConn?.open) this.hostConn.send({ t: 'req', ...ev }) }
    else if (this.role === 'host') {
      if (ev.ev === 'chan') {
        if (ev.on) this.channeling.set(0, ev.id)
        else { this.channeling.delete(0); this.recentChan.set(0, { id: ev.id, t: performance.now() }) }
        this._broadcast({ t: 'ev', ev: 'chan', on: ev.on, id: ev.id, from: 0 })
        return
      }
      this._hostValidate(0, ev)
    } else this.h.applyEvent(ev) // solo: apply directly
  }

  // local kindle attempt routed through authority (6.1: kindles sync)
  requestKindle(lightId) {
    if (!this.active) return this.h.world.kindle(lightId)
    if (this.role === 'host') {
      if (lightId === 'isle-keep-brazier' && !this._allChanneling(lightId)) { this.h.onDeny?.('brazier'); return false }
      this.broadcastEvent({ ev: 'kindle', id: lightId, from: 0 })
      return true
    }
    this.request({ ev: 'kindle', id: lightId })
    return true // optimistic; host broadcast confirms (or deny arrives)
  }

  // — client side —
  _clientData(m) {
    if (m.t === 'tr') {
      this.remotes.get(m.id)?.push(performance.now(), m.p, m.yaw, m.g, m.a)
      if (m.cat) this.h.setCatTarget?.(m.cat)
    }
    else if (m.t === 'ev') this.h.applyEvent(m)
    else if (m.t === 'nt') this.h.night.targetMinutes = m.v // slewed in update()
    else if (m.t === 'peer+') { this._addRemote(m.id, m.name, m.tint); this.roster.set(m.id, { name: m.name, tint: m.tint }); this.h.onPeerJoin?.(m) }
    else if (m.t === 'peer-') { this.roster.delete(m.id); this._fade(m.id) }
    else if (m.t === 'deny') this.h.onDeny?.(m.reason)
    else if (m.t === 'full') {
      // a fifth lantern: turned away kindly, not "host lost" (Part 5.1 max 4)
      this.log.push({ ev: 'full' })
      this.role = null
      try { this.peer?.destroy() } catch (e) { /* already down */ }
      this.h.onDeny?.('full')
      this._joinReject?.(new Error('night full'))
      this._joinReject = null
    }
  }

  _applySnap(m) {
    this.myId = m.you
    for (const r of m.roster) {
      this.roster.set(r.id, { name: r.name, tint: r.tint })
      if (r.id !== m.you) this._addRemote(r.id, r.name, r.tint)
    }
    this.h.applySnapshot(m)
    this.log.push({ ev: 'joined', you: m.you, kindled: m.kindled?.length ?? 0 })
  }

  _hostLost() {
    if (this.role !== 'client') return
    this.log.push({ ev: 'host-lost' })
    for (const [id] of this.remotes) this._fade(id)
    const cb = this.h.onHostLost
    this._teardown()
    cb?.()
  }

  // — shared —
  _addRemote(id, name, tint) {
    const old = this.remotes.get(id)
    if (old) {
      // the same seat re-taken while its last occupant was still fading —
      // finish the old ghost NOW or the pending timer would eat the new avatar
      clearTimeout(old._fadeTimer)
      this.h.beforeRemoteDispose?.(old)
      old.dispose()
      this.remotes.delete(id)
    }
    const rp = new RemotePlayer(this.h.scene, this.h.world, { id, name, tint })
    rp.onFootstep = this.h.remoteFootstep
    this.remotes.set(id, rp)
  }

  _fade(id) {
    const rp = this.remotes.get(id)
    if (!rp || rp.fading > 0) return
    rp.fading = 0.0001 // fades to fireflies, removed after 10s (5.2)
    this.h.spawnFireflies?.(rp.pos.x, rp.pos.y + 1, rp.pos.z)
    this.h.onPeerLeave?.({ id, name: rp.name })
    rp._fadeTimer = setTimeout(() => {
      if (this.remotes.get(id) !== rp) return // seat re-taken; not ours to delete
      this.h.beforeRemoteDispose?.(rp)
      rp.dispose()
      this.remotes.delete(id)
    }, 10000)
  }

  _drop(id) {
    if (id == null || !this.conns.has(id)) return
    this.log.push({ ev: 'peer-leave', id })
    this.conns.delete(id)
    this.roster.delete(id)
    this.channeling.delete(id)
    this._broadcast({ t: 'peer-', id })
    this._fade(id)
  }

  _broadcast(m, exceptId = -1) {
    for (const [id, c] of this.conns) if (id !== exceptId && c.open) c.send(m)
  }

  update(dt, camera) {
    if (!this.active && this.remotes.size === 0) return
    const now = performance.now()
    for (const [, rp] of this.remotes) rp.update(dt, now, camera)
    if (!this.active) return
    // 10Hz transforms (5.2)
    this._acc += dt
    if (this._acc >= 0.1) {
      this._acc = 0
      const L = this.h.getLocal()
      const m = { t: 'tr', p: [+L.pos.x.toFixed(2), +L.pos.y.toFixed(2), +L.pos.z.toFixed(2)], yaw: +L.yaw.toFixed(2), g: L.gait, a: L.action }
      if (this.role === 'client') { if (this.hostConn?.open) this.hostConn.send(m) }
      else {
        // the ghost cat rides along on the host transform (host-owned, 6.4)
        const cp = this.h.getCatPos?.()
        this._broadcast(cp ? { ...m, id: 0, cat: cp } : { ...m, id: 0 })
      }
    }
    // host-owned moon heartbeat every 5s (5.2)
    if (this.role === 'host') {
      this._hb += dt
      if (this._hb >= 5) { this._hb = 0; this._broadcast({ t: 'nt', v: this.h.night.minutes }) }
    } else if (this.h.night.targetMinutes != null) {
      // client slews to the host clock
      const d = this.h.night.targetMinutes + dt / 60 - this.h.night.minutes
      this.h.night.targetMinutes += dt / 60
      if (Math.abs(d) > 0.5) this.h.night.minutes += d
      else this.h.night.minutes += d * (1 - Math.exp(-dt / 2))
    }
  }

  leave() {
    for (const [id] of this.remotes) this._fade(id)
    this._teardown() // roster/channeling/code cleared too — re-hosting starts clean
  }
}
