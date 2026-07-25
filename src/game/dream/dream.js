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
import { TICK, makeFighter, makeArena, makeMatch, stepMatch } from './fightsim.js'

// Beldam's Dream — the Endless Bench (the tutorial arena, Part 4.1):
// the Park's Long Bench forty meters long, bottle towers as platforms.
// One shade deeper than the waking park palette.
const BELDAM_DREAM = {
  palette: { fog: '#16303a', skyUp: '#31454c', ambient: '#8fa6a3', stops: ['#060d18', '#0a1620', '#10242c', '#182f38', '#16303a'] },
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
    const glassMat = retroMaterial({ map: TEX.white(), transparent: true, opacity: 0.55, emissive: 0x1a3028 })
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
    const jar = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 2.6), jarGlowMat)
    ensureVertexColors(jar.geometry)
    jar.position.set(0, 7.2, -0.5)
    scene.add(jar)
    // upward rain (Beldam's dream logic) arrives with the F2 particle pass

    this.camera = new THREE.PerspectiveCamera(38, 16 / 9, 0.1, 220)
    this.camera.position.set(0, 3.4, 17)
    this.camera.lookAt(0, 2.6, 0)
    return scene
  }

  // ——— fighters ———
  _spawnFighters(n) {
    const specs = [{}, {}, {}, {}]
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

  enter(arenaId = 'beldam', players = 2, liveInput = null) {
    if (this.active) return false
    const def = BELDAM_DREAM // F1: one arena; the roster of dreams lands in F5
    this.def = def
    this.scene = this._buildScene(def)
    this.match = makeMatch(makeArena(def.arena), [])
    this._spawnFighters(players)
    this.liveInput = liveInput
    this.acc = 0
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
    return true
  }

  // live P1 mapping (couch spec: WASD + F/G) — snapshot per sim tick
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
        special: inp.down('KeyG'),
      },
    }
  }

  // one manual tick for the feel gates (DECISIONS #8)
  stepManual(inputsById = {}) {
    if (!this.active) return null
    stepMatch(this.match, inputsById)
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
      })),
      events: this.match.events.slice(),
    }
  }

  _pose(dt) {
    for (const f of this.match.fighters) {
      const rig = this.rigs.get(f.id)
      const st = this.anims.get(f.id)
      if (!rig) continue
      rig.group.position.set(f.x, f.y, 0)
      rig.group.rotation.y = f.face > 0 ? Math.PI / 2 : -Math.PI / 2
      advanceAnim(st, dt, Math.abs(f.vx), !f.grounded)
      applyPose(rig, st, 0)
    }
  }

  update(dt) {
    if (!this.active) return
    if (!this.manual) {
      this.acc = Math.min(this.acc + dt, 0.25)
      while (this.acc >= TICK) {
        this.acc -= TICK
        stepMatch(this.match, this._liveSnapshot())
      }
    }
    this._pose(dt)
    // dream palette holds while active (waking zoneLight is paused)
    globalUniforms.uFogColor.value.set(this.def.palette.fog)
  }
}

export const dream = new DreamMode()
