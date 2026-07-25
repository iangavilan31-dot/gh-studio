// DREAMSCRAP mode manager (DREAMSCRAP_PASS Parts 1/4, DECISIONS #9): the
// dream is a SECOND scene on the same pipeline. This module owns the dream
// scene, the fixed-step accumulator that drives fightsim, rig posing, and
// the test surface. All fight code lives under src/game/dream/ — the waking
// world never grows a combat verb.

import * as THREE from 'three'
import { retroMaterial, ensureVertexColors, globalUniforms } from '../art/materials.js'
import * as TEX from '../art/textures.js'
import { buildWizard, PLAYER_TINTS } from '../art/characters.js'
import { makeAnimState, advanceAnim, applyPose } from '../systems/anim.js'
import { Sky } from '../world/zonelight.js'
import { ParticleSystem } from '../world/particles.js'
import { TICK, makeFighter, makeArena, makeMatch, stepMatch } from './fightsim.js'

// Beldam's Dream — the Endless Bench (the tutorial arena, Part 4.1):
// the Park's Long Bench forty meters long, bottle towers as platforms.
// One shade deeper than the waking park palette.
const BELDAM_DREAM = {
  palette: { fog: '#16303a', skyUp: '#4a6a72', ambient: '#a7bcb9', stops: ['#060d18', '#0a1620', '#10242c', '#182f38', '#16303a'] },
  arena: {
    solids: [{ x: 0, y: 0, w: 26, h: 3.2 }],           // the great bench seat
    plats: [
      { x: -7.5, y: 3.0, w: 5 },                        // bottle-tower shelves
      { x: 7.5, y: 3.0, w: 5 },
      { x: 0, y: 5.6, w: 6 },                           // the jar shelf
    ],
    blast: { l: -21, r: 21, t: 20, b: -9 },
    spawns: [[-6, 1], [6, 1], [-10, 4], [10, 4]],
  },
}

class DreamMode {
  constructor() {
    this.active = false
    this.scene = null
    this.camera = null
    this.match = null
    this.rigs = new Map()
    this.anims = new Map()
    this.acc = 0
    this.manual = typeof window !== 'undefined' && !!window.__FIGHT_MANUAL__
    this.liveInput = null // set by enter(); reads the waking Input instance
  }

  // ——— scene build ———
  _buildScene(def) {
    const scene = new THREE.Scene()
    this.sky = new Sky(scene)
    const P = def.palette
    this.sky.uniforms.uStops.value.forEach((c, i) => c.set(P.stops[i]))

    // dream palette takes the shared uniforms while the dream is up; the
    // waking zoneLight re-asserts them on the first frame after exit
    globalUniforms.uFogColor.value.set(P.fog)
    globalUniforms.uFogNear.value = 14
    globalUniforms.uFogFar.value = 80
    globalUniforms.uAmbient.value.set(P.ambient)
    globalUniforms.uSkyUp.value.set(P.skyUp)

    // — the Endless Bench: plank slab + legs marching into fog —
    const plankMat = retroMaterial({ map: TEX.plank({ name: 'dreambench' }) })
    const seat = new THREE.Mesh(new THREE.BoxGeometry(26, 0.5, 3.4), plankMat)
    ensureVertexColors(seat.geometry, [0.95, 0.9, 0.85])
    seat.position.set(0, -0.25, 0)
    scene.add(seat)
    const back = new THREE.Mesh(new THREE.BoxGeometry(26, 2.2, 0.24), plankMat)
    ensureVertexColors(back.geometry, [0.8, 0.76, 0.72])
    back.position.set(0, 0.9, -1.9)
    scene.add(back)
    for (let i = -3; i <= 3; i++) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.5, 2.8, 2.8), plankMat)
      ensureVertexColors(leg.geometry, [0.6, 0.56, 0.52])
      leg.position.set(i * 4.2, -1.9, 0)
      scene.add(leg)
    }
    // bottle-tower platforms: stacked glass bottles under a plank shelf
    const glassMat = retroMaterial({ map: TEX.white(), transparent: true, opacity: 0.6, emissive: 0x2a5040 })
    for (const sx of [-7.5, 7.5]) {
      for (let i = 0; i < 3; i++) {
        const bottle = new THREE.Mesh(new THREE.CylinderGeometry(0.42 - i * 0.08, 0.5 - i * 0.08, 1.0, 8), glassMat)
        ensureVertexColors(bottle.geometry, [0.5, 0.72, 0.62])
        bottle.position.set(sx + (i % 2 ? 0.3 : -0.3), 0.5 + i * 1.0, 0)
        scene.add(bottle)
      }
      const shelf = new THREE.Mesh(new THREE.BoxGeometry(5, 0.22, 2.2), plankMat)
      ensureVertexColors(shelf.geometry, [0.9, 0.86, 0.8])
      shelf.position.set(sx, 2.9, 0)
      scene.add(shelf)
    }
    const jarShelf = new THREE.Mesh(new THREE.BoxGeometry(6, 0.22, 2.2), plankMat)
    ensureVertexColors(jarShelf.geometry, [0.9, 0.86, 0.8])
    jarShelf.position.set(0, 5.5, 0)
    scene.add(jarShelf)
    // the firefly jar is the center stage light
    const jarGlowMat = retroMaterial({ map: TEX.glowDot({ color: '#d8e858' }), transparent: true, depthWrite: false, opacity: 0.8 })
    jarGlowMat.blending = THREE.AdditiveBlending
    const jar = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 4.2), jarGlowMat)
    ensureVertexColors(jar.geometry)
    jar.position.set(0, 7.2, -0.5)
    scene.add(jar)
    // the jar's pool: the stage light lands on the bench (readability anchor)
    const poolMat = retroMaterial({ map: TEX.glowDot({ color: '#d8e858' }), transparent: true, depthWrite: false, opacity: 0.34 })
    poolMat.blending = THREE.AdditiveBlending
    const pool = new THREE.Mesh(new THREE.CircleGeometry(6.5, 20), poolMat)
    ensureVertexColors(pool.geometry)
    pool.rotation.x = -Math.PI / 2
    pool.position.set(0, 0.03, 0)
    scene.add(pool)
    // cool rims on the side shelves so the towers read at a glance
    for (const sx of [-7.5, 7.5]) {
      const rim = new THREE.Mesh(new THREE.PlaneGeometry(4.6, 1.4), (() => {
        const m = retroMaterial({ map: TEX.glowDot({ color: '#7fd4d4' }), transparent: true, depthWrite: false, opacity: 0.3 })
        m.blending = THREE.AdditiveBlending
        return m
      })())
      ensureVertexColors(rim.geometry)
      rim.position.set(sx, 3.15, 0.2)
      scene.add(rim)
    }
    // upward rain (Beldam's dream logic) arrives with the F2 particle pass

    // dream particles run on RENDER dt — they keep drifting through hitstop
    // (Part 5's "particles NOT frozen"), and they sell every KO
    this.moths = new ParticleSystem(scene, { tex: TEX.glowDot({ color: '#d8cfae' }), max: 90, additive: true })
    this.zs = new ParticleSystem(scene, { tex: TEX.zGlyph(), max: 10, additive: false })

    // moon respawn platforms (one per possible fighter)
    this.moonPlats = []
    for (let i = 0; i < 4; i++) {
      const g = new THREE.Group()
      const glow = new THREE.Mesh(new THREE.PlaneGeometry(2.8, 2.8), (() => {
        const m = retroMaterial({ map: TEX.glowDot({ color: '#c8d4f0' }), transparent: true, depthWrite: false, opacity: 0.7 })
        m.blending = THREE.AdditiveBlending
        return m
      })())
      ensureVertexColors(glow.geometry)
      g.add(glow)
      const slab = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.16, 1.2), retroMaterial({ map: TEX.white(), emissive: 0x8a86b8 }))
      ensureVertexColors(slab.geometry, [0.8, 0.8, 0.95])
      slab.position.y = -0.15
      g.add(slab)
      g.visible = false
      scene.add(g)
      this.moonPlats.push(g)
    }
    // invuln shimmer quads
    this.shimmers = []
    for (let i = 0; i < 4; i++) {
      const m = retroMaterial({ map: TEX.glowDot({ color: '#bfe8ff' }), transparent: true, depthWrite: false, opacity: 0.4 })
      m.blending = THREE.AdditiveBlending
      const q = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 2.8), m)
      ensureVertexColors(q.geometry)
      q.visible = false
      scene.add(q)
      this.shimmers.push(q)
    }

    this.camera = new THREE.PerspectiveCamera(38, 16 / 9, 0.1, 220)
    this.camera.position.set(0, 3.4, 17)
    this.camera.lookAt(0, 2.6, 0)
    return scene
  }

  // the only HUD: bottle tints + stock moons, no numbers (Part 2)
  _buildHud(n) {
    const el = document.createElement('canvas')
    el.id = 'dreamhud'
    el.width = 340; el.height = 72
    el.style.cssText = 'position:fixed;left:50%;top:12px;transform:translateX(-50%);z-index:40;image-rendering:pixelated;pointer-events:none'
    document.getElementById('ui')?.appendChild(el)
    this.hudEl = el
    this.hudN = n
  }

  _drawHud() {
    if (!this.hudEl || !this.match) return
    const ctx = this.hudEl.getContext('2d')
    ctx.clearRect(0, 0, 340, 72)
    const tint = (w) => {
      const t = Math.min(1, w / 140)
      const lerp = (a, b) => Math.round(a + (b - a) * t)
      return t < 0.5 ? `rgb(${lerp(127, 232)},${lerp(212, 168)},${lerp(212, 74)})` : `rgb(${lerp(127, 232)},${lerp(212, 102)},${lerp(212, 18)})`
    }
    this.match.fighters.forEach((f, i) => {
      const x = 20 + i * 86
      ctx.globalAlpha = f.stocks > 0 ? 1 : 0.25
      // bottle
      ctx.strokeStyle = '#d8cfae'; ctx.lineWidth = 2
      ctx.strokeRect(x, 14, 18, 34)
      ctx.strokeRect(x + 5, 8, 8, 6)
      const fill = Math.min(1, f.wooze / 140)
      ctx.fillStyle = tint(f.wooze)
      ctx.fillRect(x + 2, 16 + (1 - fill) * 30, 14, fill * 30)
      // stock moons
      for (let s = 0; s < f.stocks; s++) {
        ctx.fillStyle = '#c8d4f0'
        ctx.beginPath(); ctx.arc(x + 30 + s * 12, 44, 4, 0, Math.PI * 2); ctx.fill()
      }
      ctx.globalAlpha = 1
    })
  }

  // ——— fighters ———
  _spawnFighters(n, opts = {}) {
    const specs = [{ stocks: opts.stocks }, { stocks: opts.stocks }, { stocks: opts.stocks }, { stocks: opts.stocks }]
    for (let i = 0; i < n; i++) {
      const f = makeFighter(i, specs[i])
      const [sx, sy] = this.match.arena.spawns[i]
      f.x = sx; f.y = sy
      f.face = sx > 0 ? -1 : 1
      this.match.fighters.push(f)
      const rig = buildWizard({ tint: PLAYER_TINTS[i % PLAYER_TINTS.length], withStaff: false })
      this.scene.add(rig.group)
      this.rigs.set(i, rig)
      this.anims.set(i, makeAnimState())
    }
  }

  enter(arenaId = 'beldam', players = 2, liveInput = null, opts = {}) {
    if (this.active) return false
    const def = BELDAM_DREAM // F1: one arena; the roster of dreams lands in F5
    this.def = def
    this.scene = this._buildScene(def)
    this.match = makeMatch(makeArena(def.arena), [])
    this._spawnFighters(players, opts)
    this.liveInput = liveInput
    this.acc = 0
    this.victory = null
    this._buildHud(players)
    this.active = true
    return true
  }

  exit() {
    if (!this.active) return false
    this.active = false
    this.scene = null
    this.match = null
    this.rigs.clear()
    this.anims.clear()
    this.victory = null
    this.hudEl?.remove()
    this.hudEl = null
    return true
  }

  // live P1 mapping (couch spec: WASD + F/G; H tosses) — snapshot per tick
  _liveSnapshot() {
    const inp = this.liveInput
    if (!inp) return {}
    const left = inp.down('KeyA'), right = inp.down('KeyD')
    return {
      0: {
        x: (right ? 1 : 0) - (left ? 1 : 0),
        down: inp.down('KeyS'),
        jump: inp.down('KeyW', 'Space'),
        light: inp.down('KeyF'),
        heavy: inp.down('KeyG'),
        toss: inp.down('KeyH'),
      },
    }
  }

  // Part 5 impact presentation: hitstop freezes fighters (sim-side), the
  // CAMERA shakes with knockback — capped at 0.6% of the visible frame
  // height, ≤200ms, and fully disabled by reduced motion.
  _consumeEvents(events) {
    for (const e of events) {
      if (e.t === 'ko') {
        // poofed into moths + one drifting z (Part 1: nobody gets hurt)
        const cx = Math.max(-18, Math.min(18, e.x)), cy = Math.max(-6, Math.min(16, e.y))
        for (let i = 0; i < 16; i++) {
          const a = (i / 16) * Math.PI * 2 + (this.match?.tick ?? 0) * 0.37
          this.moths?.spawn({
            pos: new THREE.Vector3(cx, cy + 1, 0.4),
            vel: new THREE.Vector3(Math.cos(a) * (1.6 + (i % 3) * 0.7), Math.sin(a) * 1.4 + 1.8, 0),
            maxLife: 1.2 + (i % 4) * 0.25, size: 0.14 + (i % 3) * 0.05, seed: i / 16,
            update(p, dt2) { p.pos.x += p.vel.x * dt2; p.pos.y += p.vel.y * dt2; p.vel.y *= 0.985; p.vel.x *= 0.99 },
          })
        }
        this.zs?.spawn({ pos: new THREE.Vector3(cx, cy + 1.6, 0.5), vel: new THREE.Vector3(0.3, 1.1, 0), maxLife: 2.2, size: 0.5, seed: 0.5 })
      } else if (e.t === 'matchEnd') {
        this.victory = { winner: e.winner, t: 0 }
      } else if (e.t === 'hit' || e.t === 'throw') {
        const reduced = typeof window !== 'undefined' && window.__REDUCED_MOTION__
        const visH = 2 * 17 * Math.tan((this.camera?.fov ?? 38) * Math.PI / 360)
        const ampM = reduced ? 0 : (e.shake ?? 0.4) * 0.006 * visH
        this.shake = { ampM, ticks: e.shakeTicks ?? 6, left: e.shakeTicks ?? 6, seed: (e.d ?? 0) * 7 + (this.match?.tick ?? 0) % 13 }
        this.lastShake = { amp01: e.shake ?? 0.4, ampM: +ampM.toFixed(4), ticks: e.shakeTicks ?? 6, capM: +(0.006 * visH).toFixed(4), reduced: !!reduced }
      }
    }
  }

  // one manual tick for the feel gates (DECISIONS #8)
  stepManual(inputsById = {}) {
    if (!this.active) return null
    const events = stepMatch(this.match, inputsById)
    this._consumeEvents(events)
    this._pose(TICK)
    return this.simState()
  }

  simState() {
    if (!this.active) return null
    return {
      tick: this.match.tick,
      fighters: this.match.fighters.map((f) => ({
        id: f.id, x: +f.x.toFixed(4), y: +f.y.toFixed(4), vx: +f.vx.toFixed(4), vy: +f.vy.toFixed(4),
        grounded: f.grounded, coyote: f.coyote, jumpsLeft: f.jumpsLeft, jumpBuf: f.jumpBuf,
        landlag: f.landlag, fastfall: f.fastfall, face: f.face, wooze: f.wooze, stocks: f.stocks,
        hitstop: f.hitstop, move: f.move?.name ?? null, moveT: f.move?.t ?? 0, launched: f.launched,
        grab: f.grab, grabbing: f.grabbing, mash: f.mash, ko: f.ko, invuln: f.invuln,
      })),
      over: !!this.match.over, winner: this.match.winner ?? null,
      events: this.match.events.slice(),
    }
  }

  _pose(dt) {
    for (const f of this.match.fighters) {
      const rig = this.rigs.get(f.id)
      const st = this.anims.get(f.id)
      if (!rig) continue
      // eliminated wizards leave the dream until the victory nap gathers them
      if (f.stocks <= 0 && !this.victory) { rig.group.visible = false; continue }
      rig.group.visible = true
      // — victory nap (Part 2): the winner yawns and lies down beside the
      //   losers; every match ends cozy —
      if (this.victory) {
        const v = this.victory
        const wf = this.match.fighters[v.winner] ?? this.match.fighters[0]
        if (f.id === v.winner) {
          st.action = v.t > 2.4 ? 'lie' : v.t > 1.0 ? 'sit' : null
          rig.group.position.set(wf.x, Math.max(0, wf.y), 0)
        } else {
          st.action = 'sleep'
          const k = f.id < v.winner ? f.id : f.id - 1
          rig.group.position.set(wf.x + (k + 1) * 1.5 * (k % 2 ? 1 : -1), Math.max(0, wf.y), 0)
        }
        advanceAnim(st, dt, 0, false)
        applyPose(rig, st, 0)
        continue
      }
      rig.group.position.set(f.x, f.y, 0)
      rig.group.rotation.y = f.face > 0 ? Math.PI / 2 : -Math.PI / 2
      advanceAnim(st, dt, Math.abs(f.vx), !f.grounded)
      applyPose(rig, st, 0)
      // swing overlay (readability blockout; real move poses land in F4):
      // the arm whips through the active window, wooze sways the idle
      if (f.move) {
        const A = { light: 15, heavy: 34 }[f.move.name] ?? 15
        const ph = Math.min(1, f.move.t / A)
        rig.bones.armR.rotation.x = -0.35 - Math.sin(ph * Math.PI) * (f.move.name === 'heavy' ? 2.4 : 1.7)
      }
      if (f.wooze > 0) {
        const sway = Math.min(0.22, f.wooze * 0.0022)
        rig.bones.spine.rotation.z += Math.sin((this.match.tick + f.id * 17) * 0.11) * sway
      }
    }
    // camera shake decay (presentation only)
    if (this.shake && this.shake.left > 0 && this.camera) {
      const s = this.shake
      s.left--
      const k = s.left / s.ticks
      const n = Math.sin(s.seed + s.left * 2.7) * s.ampM * k
      const n2 = Math.cos(s.seed * 1.3 + s.left * 3.1) * s.ampM * k * 0.6
      this.camera.position.set(n, 3.4 + n2, 17)
    } else if (this.camera) {
      this.camera.position.set(0, 3.4, 17)
    }
  }

  update(dt) {
    if (!this.active) return
    if (!this.manual) {
      this.acc = Math.min(this.acc + dt, 0.25)
      while (this.acc >= TICK) {
        this.acc -= TICK
        this._consumeEvents(stepMatch(this.match, this._liveSnapshot()))
      }
    }
    // render-dt presentation: particles DRIFT through hitstop (Part 5)
    this.moths?.update(dt, this.camera)
    this.zs?.update(dt, this.camera)
    // moon respawn rides + invuln shimmers track sim state
    this.match?.fighters.forEach((f, i) => {
      const plat = this.moonPlats?.[i]
      if (plat) {
        plat.visible = f.ko > 0
        if (f.ko > 0) plat.position.set(f.x, f.y - 0.35, 0)
      }
      const sh = this.shimmers?.[i]
      if (sh) {
        sh.visible = f.invuln > 0 && f.stocks > 0
        if (sh.visible) {
          sh.position.set(f.x, f.y + 1.1, 0.3)
          sh.material.uniforms.uOpacity.value = 0.22 + 0.2 * Math.sin((this.match.tick + i * 5) * 0.6)
        }
      }
    })
    if (this.victory) {
      this.victory.t += dt
      if (this.victory.t > 5.2) { this.exit(); return }
    }
    this._drawHud()
    this._pose(dt)
    // dream palette holds while active (waking zoneLight is paused)
    globalUniforms.uFogColor.value.set(this.def.palette.fog)
  }
}

export const dream = new DreamMode()
