// DREAMSCRAP mode manager (DREAMSCRAP_PASS Parts 1/4, DECISIONS #9): the
// dream is a SECOND scene on the same pipeline. This module owns the dream
// scene, the fixed-step accumulator that drives fightsim, rig posing, and
// the test surface. All fight code lives under src/game/dream/ — the waking
// world never grows a combat verb.

import * as THREE from 'three'
import { retroMaterial, ensureVertexColors, globalUniforms } from '../art/materials.js'
import * as TEX from '../art/textures.js'
import { buildWizard, PLAYER_TINTS } from '../art/characters.js'
import { buildGnome, buildCurator, buildPaleKing, buildMote, buildChicken } from '../systems/npc.js'
import { makeAnimState, advanceAnim, applyPose } from '../systems/anim.js'
import { Sky } from '../world/zonelight.js'
import { ParticleSystem } from '../world/particles.js'
import { worldRNG } from '../core/rng.js'
import { TICK, makeFighter, makeArena, makeMatch, stepMatch, platOn } from './fightsim.js'
import { makeBot } from './bots.js'

// ═══ F5: THE DREAMS (Part 4) — each sleeper's familiar zone warped one
// shade deeper. Shared blast box; layouts are authored, not generated. ═══
const BLAST = { l: -21, r: 21, t: 20, b: -9 }

const mesh = (geo, mat, tint) => { const m = new THREE.Mesh(geo, mat); ensureVertexColors(m.geometry, tint); return m }
const glowMat = (color, opacity) => {
  const m = retroMaterial({ map: TEX.glowDot({ color }), transparent: true, depthWrite: false, opacity })
  m.blending = THREE.AdditiveBlending
  return m
}
const glowQuad = (color, w, h, opacity) => {
  const q = new THREE.Mesh(new THREE.PlaneGeometry(w, h), glowMat(color, opacity))
  ensureVertexColors(q.geometry)
  return q
}

const DREAMS = {
  // — Beldam's Dream: the Endless Bench. The Park's Long Bench forty meters
  //   long, bottle towers as platforms, the firefly jar as the stage light,
  //   and the rain falls upward. —
  beldam: {
    palette: { fog: '#16303a', skyUp: '#4a6a72', ambient: '#a7bcb9', stops: ['#060d18', '#0a1620', '#10242c', '#182f38', '#16303a'] },
    nightmare: { fog: '#0a161c', skyUp: '#1e3038', ambient: '#5a6a68', stops: ['#020508', '#040a10', '#081218', '#0c181e', '#0a161c'] },
    ambient: 'rainUp',
    arena: {
      solids: [{ x: 0, y: 0, w: 26, h: 3.2 }],
      plats: [{ x: -7.5, y: 3.0, w: 5 }, { x: 7.5, y: 3.0, w: 5 }, { x: 0, y: 5.6, w: 6 }],
      blast: BLAST,
      spawns: [[-6, 1], [6, 1], [-10, 4], [10, 4]],
    },
    build(scene, D) {
      const plankMat = retroMaterial({ map: TEX.plank({ name: 'dreambench' }) })
      const seat = mesh(new THREE.BoxGeometry(26, 0.5, 3.4), plankMat, [0.95, 0.9, 0.85])
      seat.position.set(0, -0.25, 0); scene.add(seat)
      const back = mesh(new THREE.BoxGeometry(26, 2.2, 0.24), plankMat, [0.8, 0.76, 0.72])
      back.position.set(0, 0.9, -1.9); scene.add(back)
      for (let i = -3; i <= 3; i++) {
        const leg = mesh(new THREE.BoxGeometry(0.5, 2.8, 2.8), plankMat, [0.6, 0.56, 0.52])
        leg.position.set(i * 4.2, -1.9, 0); scene.add(leg)
      }
      const glassMat = retroMaterial({ map: TEX.white(), transparent: true, opacity: 0.6, emissive: 0x2a5040 })
      for (const sx of [-7.5, 7.5]) {
        for (let i = 0; i < 3; i++) {
          const bottle = mesh(new THREE.CylinderGeometry(0.42 - i * 0.08, 0.5 - i * 0.08, 1.0, 8), glassMat, [0.5, 0.72, 0.62])
          bottle.position.set(sx + (i % 2 ? 0.3 : -0.3), 0.5 + i * 1.0, 0); scene.add(bottle)
        }
        const shelf = mesh(new THREE.BoxGeometry(5, 0.22, 2.2), plankMat, [0.9, 0.86, 0.8])
        shelf.position.set(sx, 2.9, 0); scene.add(shelf)
        const rim = glowQuad('#7fd4d4', 4.6, 1.4, 0.3)
        rim.position.set(sx, 3.15, 0.2); scene.add(rim)
      }
      const jarShelf = mesh(new THREE.BoxGeometry(6, 0.22, 2.2), plankMat, [0.9, 0.86, 0.8])
      jarShelf.position.set(0, 5.5, 0); scene.add(jarShelf)
      const jar = glowQuad('#d8e858', 4.2, 4.2, 0.8)
      jar.position.set(0, 7.2, -0.5); scene.add(jar)
      const pool = new THREE.Mesh(new THREE.CircleGeometry(6.5, 20), glowMat('#d8e858', 0.34))
      ensureVertexColors(pool.geometry)
      pool.rotation.x = -Math.PI / 2; pool.position.set(0, 0.03, 0); scene.add(pool)
      // moths orbit the firefly jar — the stage light is alive
      const mrng = worldRNG.fork('dream/jarmoths')
      for (let i = 0; i < 12; i++) {
        D.moths.spawn({
          pos: new THREE.Vector3(0, 7.2, 0.4), vel: new THREE.Vector3(),
          maxLife: 9e9, size: mrng.range(0.07, 0.12), seed: mrng.next(),
          update(p, dt2) {
            const t = p.life * (0.6 + p.seed * 0.7) + p.seed * 40
            p.pos.x = Math.sin(t * 0.9 + p.seed * 9) * (1.1 + p.seed * 1.4)
            p.pos.y = 7.0 + Math.sin(t * 1.3 + p.seed * 5) * 0.8
            p.pos.z = 0.3 + Math.cos(t * 0.7) * 0.5
            p.alpha = 0.35 + 0.65 * Math.max(0, Math.sin(t * 2.1))
          },
        })
      }
    },
  },

  // — Nib's Dream: the Big Sky. Rooftops among ENORMOUS constellations;
  //   star-lines draw and undraw as temporary platforms (2s telegraph). —
  nib: {
    palette: { fog: '#1a1836', skyUp: '#4a4880', ambient: '#b2aede', stops: ['#080718', '#100e28', '#181540', '#242054', '#1a1836'] },
    nightmare: { fog: '#0c0b1c', skyUp: '#201e40', ambient: '#605c80', stops: ['#030308', '#070610', '#0c0a1c', '#100e26', '#0c0b1c'] },
    ambient: { color: '#cfd8ff', vel: [0, -0.45], rate: 12, size: 0.09, alpha: 0.5 },
    arena: {
      solids: [{ x: -6, y: 0, w: 10, h: 3 }, { x: 6, y: 0, w: 10, h: 3 }],
      plats: [
        { x: 0, y: 2.6, w: 5, timed: { period: 600, on: 380, offset: 0 } },
        { x: -8, y: 4.2, w: 4, timed: { period: 600, on: 380, offset: 200 } },
        { x: 8, y: 4.2, w: 4, timed: { period: 600, on: 380, offset: 400 } },
      ],
      blast: BLAST,
      spawns: [[-6, 1], [6, 1], [-2, 4], [2, 4]],
    },
    build(scene, D) {
      const shMat = retroMaterial({ map: TEX.shingle({ name: 'dreamroof', base: '#2c3248' }) })
      for (const rx of [-6, 6]) {
        const roof = mesh(new THREE.BoxGeometry(10, 3.0, 3.2), shMat, [0.9, 0.9, 1.05])
        roof.position.set(rx, -1.5, 0); scene.add(roof)
        const ridge = mesh(new THREE.BoxGeometry(10.4, 0.24, 0.5), shMat, [1.1, 1.1, 1.2])
        ridge.position.set(rx, 0.06, -1.5); scene.add(ridge)
        const chim = mesh(new THREE.BoxGeometry(0.8, 1.5, 0.8), shMat, [0.8, 0.78, 0.95])
        chim.position.set(rx + (rx < 0 ? -3.2 : 3.2), 0.75, -1.1); scene.add(chim)
        // starlight pools on the shingles: the fight reads on both roofs
        const pool = new THREE.Mesh(new THREE.CircleGeometry(4.2, 16), glowMat('#aeb6f0', 0.3))
        ensureVertexColors(pool.geometry)
        pool.rotation.x = -Math.PI / 2; pool.position.set(rx, 0.04, 0); scene.add(pool)
        const rim = glowQuad('#8f98e8', 9.5, 0.5, 0.3)
        rim.position.set(rx, 0.1, 1.7); scene.add(rim)
      }
      // the constellation is ENORMOUS and it is watching
      const pts = [[-14, 9], [-7, 13], [0, 10.5], [7, 14], [14, 9.5]]
      for (const [sx, sy] of pts) {
        const s = glowQuad('#e8ecff', 1.7, 1.7, 0.9)
        s.position.set(sx, sy, -7); scene.add(s)
      }
      for (let i = 0; i < pts.length - 1; i++) {
        const [ax, ay] = pts[i], [bx, by] = pts[i + 1]
        const len = Math.hypot(bx - ax, by - ay)
        const line = glowQuad('#9aa4e8', len, 0.14, 0.35)
        line.position.set((ax + bx) / 2, (ay + by) / 2, -7.1)
        line.rotation.z = Math.atan2(by - ay, bx - ax)
        scene.add(line)
      }
      // star-line platforms: the glow IS the floor (visibility sim-driven)
      D.timedPlats = []
      for (const p of D.def.arena.plats) {
        if (!p.timed) continue
        const line = glowQuad('#dfe6ff', p.w, 0.34, 0.9)
        line.position.set(p.x, p.y, 0); scene.add(line)
        const warn = glowQuad('#8890c8', p.w, 0.22, 0.3)
        warn.position.set(p.x, p.y, -0.15); scene.add(warn)
        const endA = glowQuad('#ffffff', 0.5, 0.5, 0.9); endA.position.set(p.x - p.w / 2, p.y, 0.05); scene.add(endA)
        const endB = glowQuad('#ffffff', 0.5, 0.5, 0.9); endB.position.set(p.x + p.w / 2, p.y, 0.05); scene.add(endB)
        D.timedPlats.push({ p, line, warn, ends: [endA, endB] })
      }
    },
  },

  // — The Curator's Dream: the Party, 10,000 Years Ago. The Ruins intact
  //   and gleaming, the moonwell fountaining, ghost nobles politely
  //   applauding good hits. Her dream is the night the party never ended. —
  curator: {
    palette: { fog: '#122430', skyUp: '#3a5a68', ambient: '#a8c4cc', stops: ['#04101a', '#081a26', '#0e2432', '#14303e', '#122430'] },
    nightmare: { fog: '#081218', skyUp: '#182830', ambient: '#586a70', stops: ['#020608', '#040c12', '#061218', '#0a181e', '#081218'] },
    ambient: { color: '#bfe0e8', vel: [0.08, 0.3], rate: 10, size: 0.08, alpha: 0.45 },
    arena: {
      solids: [{ x: 0, y: 0, w: 28, h: 3.2 }],
      plats: [{ x: 0, y: 3.4, w: 4 }, { x: -9, y: 2.4, w: 5 }, { x: 9, y: 2.4, w: 5 }],
      blast: BLAST,
      spawns: [[-6, 1], [6, 1], [-10, 3.4], [10, 3.4]],
    },
    build(scene, D) {
      const marble = retroMaterial({ map: TEX.plaster({ name: 'dreammarble' }) })
      const stone = retroMaterial({ map: TEX.stoneBlock({ name: 'dreamstone', base: '#5a6a72' }) })
      const floor = mesh(new THREE.BoxGeometry(28, 3.2, 3.6), marble, [0.95, 1.0, 1.05])
      floor.position.set(0, -1.6, 0); scene.add(floor)
      for (const cx of [-12, -4, 4, 12]) {
        const col = mesh(new THREE.CylinderGeometry(0.55, 0.62, 9, 9), marble, [0.85, 0.92, 0.98])
        col.position.set(cx, 4.5, -3.4); scene.add(col)
        const cap = mesh(new THREE.BoxGeometry(1.6, 0.4, 1.6), stone, [0.9, 0.95, 1.0])
        cap.position.set(cx, 9.1, -3.4); scene.add(cap)
      }
      for (const [px, py, w] of [[-9, 2.4, 5], [9, 2.4, 5]]) {
        const terr = mesh(new THREE.BoxGeometry(w, 0.4, 2.4), stone, [0.85, 0.92, 0.98])
        terr.position.set(px, py - 0.2, 0); scene.add(terr)
      }
      // the moonwell fountains BEHIND the fight plane (it once stood at
      // z 0 and swallowed every center-stage exchange); a floating marble
      // rim at z 0 is what the fighters actually stand on
      const bowl = mesh(new THREE.CylinderGeometry(2.1, 1.7, 0.8, 10), stone, [0.85, 0.95, 1.05])
      bowl.position.set(0, 3.0, -2.6); scene.add(bowl)
      const stem = mesh(new THREE.CylinderGeometry(0.5, 0.7, 2.8, 8), stone, [0.7, 0.8, 0.9])
      stem.position.set(0, 1.4, -2.6); scene.add(stem)
      const beam = glowQuad('#bfe8f0', 1.6, 6.5, 0.22)
      beam.position.set(0, 6.8, -2.7); scene.add(beam)
      const wellGlow = glowQuad('#bfe8f0', 4.5, 2.0, 0.4)
      wellGlow.position.set(0, 3.7, -2.4); scene.add(wellGlow)
      const rimSlab = mesh(new THREE.BoxGeometry(4, 0.24, 1.8), marble, [0.95, 1.02, 1.08])
      rimSlab.position.set(0, 3.28, 0); scene.add(rimSlab)
      const rimGlow = glowQuad('#bfe8f0', 4.4, 0.5, 0.3)
      rimGlow.position.set(0, 3.45, 0.3); scene.add(rimGlow)
      const pool = new THREE.Mesh(new THREE.CircleGeometry(5.5, 18), glowMat('#9fd0dc', 0.22))
      ensureVertexColors(pool.geometry)
      pool.rotation.x = -Math.PI / 2; pool.position.set(0, 0.03, 0); scene.add(pool)
      // the crowd: ghost nobles watching from the colonnade, ready to applaud
      D.crowd = []
      const gm = retroMaterial({ map: TEX.white(), transparent: true, opacity: 0.32, depthWrite: false, emissive: 0x1c3038 })
      for (let i = 0; i < 9; i++) {
        const nx = -12 + i * 3
        const noble = mesh(new THREE.ConeGeometry(0.4, 1.7, 7), gm, [0.6, 0.85, 0.9])
        noble.position.set(nx + (i % 2) * 0.6, 0.85, -3.0)
        scene.add(noble)
        D.crowd.push(noble)
      }
    },
  },

  // — The Pale King's Dream: the Full Hall, warm and crowded. Feast tables
  //   as platforms; the chandeliers swing and occasionally drop. —
  paleking: {
    palette: { fog: '#241a12', skyUp: '#54402a', ambient: '#c8ae8e', stops: ['#0e0804', '#1a100a', '#241810', '#302016', '#241a12'] },
    nightmare: { fog: '#120c08', skyUp: '#241a10', ambient: '#6a5a48', stops: ['#040202', '#0a0604', '#100a06', '#16100a', '#120c08'] },
    ambient: { color: '#e8a848', vel: [0.04, -0.28], rate: 10, size: 0.07, alpha: 0.4 },
    arena: {
      solids: [{ x: 0, y: 0, w: 28, h: 3.2 }],
      plats: [{ x: -7, y: 2.2, w: 6 }, { x: 7, y: 2.2, w: 6 }, { x: 0, y: 4.6, w: 5 }],
      blast: BLAST,
      spawns: [[-6, 1], [6, 1], [-9, 2.4], [9, 2.4]],
      chand: { period: 780, warn: 100, xs: [-6, 0, 6] },
    },
    build(scene, D) {
      const stone = retroMaterial({ map: TEX.stoneBlock({ name: 'dreamhall', base: '#4a4038' }) })
      const wood = retroMaterial({ map: TEX.plank({ name: 'dreamtable' }) })
      const floor = mesh(new THREE.BoxGeometry(28, 3.2, 3.6), stone, [0.9, 0.85, 0.8])
      floor.position.set(0, -1.6, 0); scene.add(floor)
      for (const [px, w] of [[-7, 6], [7, 6]]) {
        const top = mesh(new THREE.BoxGeometry(w, 0.3, 2.4), wood, [1.0, 0.92, 0.8])
        top.position.set(px, 2.05, 0); scene.add(top)
        for (const lx of [px - w / 2 + 0.5, px + w / 2 - 0.5]) {
          const leg = mesh(new THREE.BoxGeometry(0.4, 2.0, 2.0), wood, [0.7, 0.62, 0.52])
          leg.position.set(lx, 1.0, 0); scene.add(leg)
        }
        const candles = glowQuad('#f0c060', w - 1, 0.8, 0.4)
        candles.position.set(px, 2.7, 0.2); scene.add(candles)
      }
      const dais = mesh(new THREE.BoxGeometry(5, 0.5, 2.6), stone, [1.0, 0.95, 0.85])
      dais.position.set(0, 4.35, 0); scene.add(dais)
      // the hall's own chandeliers, hanging until they don't
      D.hallChands = {}
      for (const cx of [-6, 0, 6]) {
        const g = new THREE.Group()
        const cone = mesh(new THREE.ConeGeometry(0.9, 0.8, 7), retroMaterial({ map: TEX.white(), emissive: 0x3a2c10 }), [0.85, 0.7, 0.3])
        cone.rotation.x = Math.PI; g.add(cone)
        const halo = glowQuad('#e8c26a', 2.4, 2.4, 0.5); g.add(halo)
        const chain = mesh(new THREE.BoxGeometry(0.08, 6, 0.08), stone, [0.5, 0.45, 0.4])
        chain.position.y = 3.4; g.add(chain)
        g.position.set(cx, 8.2, -0.4)
        scene.add(g)
        D.hallChands[cx] = g
      }
      // silhouette feast-goers along the back tables
      const dark = retroMaterial({ map: TEX.white(), emissive: 0x0a0806 })
      for (let i = 0; i < 8; i++) {
        const gx = -10.5 + i * 3
        const goer = mesh(new THREE.ConeGeometry(0.42, 1.3, 6), dark, [0.16, 0.13, 0.1])
        goer.position.set(gx, 0.65, -2.6); scene.add(goer)
      }
      const pool = new THREE.Mesh(new THREE.CircleGeometry(6, 18), glowMat('#e8b868', 0.26))
      ensureVertexColors(pool.geometry)
      pool.rotation.x = -Math.PI / 2; pool.position.set(0, 0.03, 0); scene.add(pool)
    },
  },

  // — Mote's Dream: the Young Forest. The Mosswood as saplings under a
  //   bright ancient moon; the gate loops the arena edges (the only wrap). —
  mote: {
    palette: { fog: '#1c3424', skyUp: '#54785e', ambient: '#c2d8be', stops: ['#0a140c', '#122218', '#1a3022', '#223e2c', '#1c3424'] },
    nightmare: { fog: '#0c1810', skyUp: '#22342a', ambient: '#5c6e5c', stops: ['#030805', '#060f0a', '#0a1810', '#0e2016', '#0c1810'] },
    ambient: { color: '#a8d890', vel: [0.06, 0.26], rate: 11, size: 0.08, alpha: 0.45 },
    arena: {
      wrap: true,
      // the islands RUN TO the wrap line: walk off the left edge of the
      // world and you're standing on the right island, mid-stride — the
      // center gap is the only pit
      solids: [{ x: -14, y: 0, w: 14, h: 3.2 }, { x: 14, y: 0, w: 14, h: 3.2 }],
      plats: [{ x: -6, y: 2.8, w: 4 }, { x: 6, y: 2.8, w: 4 }],
      blast: BLAST,
      spawns: [[-11, 1], [11, 1], [-16, 1], [16, 1]],
    },
    build(scene, D) {
      const grass = retroMaterial({ map: TEX.grass({ name: 'dreamgrass', a: '#24402e', b: '#3a5a40' }) })
      const bark = retroMaterial({ map: TEX.bark({ name: 'dreambark' }) })
      const canopyMat = retroMaterial({ map: TEX.canopy({ name: 'dreamcanopy', base: '#1e3a2a', light: '#4a7a54' }) })
      for (const ix of [-14, 14]) {
        const isle = mesh(new THREE.BoxGeometry(14, 3.2, 3.6), grass, [0.9, 1.0, 0.9])
        isle.position.set(ix, -1.6, 0); scene.add(isle)
      }
      // saplings — the two standable crowns lean out from the island edges
      // over the pit (nothing grows from a bottomless gap, even in a dream)
      for (const [sx, h, deco] of [[-6, 2.8, false], [6, 2.8, false], [-16, 2.0, true], [16, 2.2, true], [-10.5, 1.6, true], [11.5, 1.5, true]]) {
        const rootX = deco ? sx : sx < 0 ? sx - 1.6 : sx + 1.6
        const trunk = mesh(new THREE.CylinderGeometry(0.14, 0.2, h + (deco ? 0 : 0.4), 6), bark, [0.8, 0.75, 0.65])
        trunk.position.set(rootX, h / 2, deco ? -2.2 : 0)
        if (!deco) trunk.rotation.z = sx < 0 ? -0.5 : 0.5 // the lean
        scene.add(trunk)
        const crown = mesh(new THREE.ConeGeometry(deco ? 0.9 : 2.0, deco ? 1.4 : 0.7, 7), canopyMat, [0.85, 1.0, 0.85])
        crown.position.set(sx, h + (deco ? 0.7 : 0.25), deco ? -2.2 : 0); scene.add(crown)
      }
      // the bright ancient moon — bigger and younger than the one we keep
      const moon = glowQuad('#eef4dc', 9, 9, 0.9)
      moon.position.set(0, 9.5, -8.5); scene.add(moon)
      const moonPool = new THREE.Mesh(new THREE.CircleGeometry(4.5, 18), glowMat('#d8e8c0', 0.3))
      ensureVertexColors(moonPool.geometry)
      moonPool.rotation.x = -Math.PI / 2; moonPool.position.set(0, -8.2, 0); scene.add(moonPool)
      // moonlight pools on both islands: the fight reads wherever it goes
      for (const ix of [-14, 14]) {
        const p2 = new THREE.Mesh(new THREE.CircleGeometry(5, 16), glowMat('#d8e8c0', 0.28))
        ensureVertexColors(p2.geometry)
        p2.rotation.x = -Math.PI / 2; p2.position.set(ix, 0.04, 0); scene.add(p2)
      }
      // the gate posts mark the loop (walk off left, appear right)
      for (const gx of [-20.5, 20.5]) {
        const post = mesh(new THREE.CylinderGeometry(0.3, 0.36, 5.5, 7), bark, [0.7, 0.68, 0.6])
        post.position.set(gx, 2.75, -0.5); scene.add(post)
        const gGlow = glowQuad('#a8d890', 1.6, 5.5, 0.28)
        gGlow.position.set(gx, 2.75, -0.3); scene.add(gGlow)
      }
    },
  },

  // — The Chicken's Dream: the Warm Oven. A giant bakery; pie platforms,
  //   flour-dust ground fog, the bakery window as a huge warm moon. —
  chicken: {
    palette: { fog: '#2a1c10', skyUp: '#6a4c2a', ambient: '#d8b890', stops: ['#100a04', '#1e120a', '#2a1a0e', '#362415', '#2a1c10'] },
    nightmare: { fog: '#140d08', skyUp: '#2c2012', ambient: '#705e48', stops: ['#050302', '#0c0705', '#120c07', '#18100a', '#140d08'] },
    ambient: { color: '#f0e0c0', vel: [0.22, 0.05], rate: 8, size: 0.5, alpha: 0.13, puff: true },
    arena: {
      solids: [{ x: 0, y: 0, w: 26, h: 3.2 }],
      plats: [{ x: -7, y: 2.6, w: 4.5 }, { x: 7, y: 2.6, w: 4.5 }, { x: 0, y: 5.0, w: 5 }],
      blast: BLAST,
      spawns: [[-6, 1], [6, 1], [-8, 3.4], [8, 3.4]],
    },
    build(scene, D) {
      const wood = retroMaterial({ map: TEX.plank({ name: 'dreamcounter' }) })
      const crust = retroMaterial({ map: TEX.plaster({ name: 'dreamcrust' }) })
      const counter = mesh(new THREE.BoxGeometry(26, 3.2, 3.6), wood, [1.0, 0.9, 0.75])
      counter.position.set(0, -1.6, 0); scene.add(counter)
      // pies you can stand on (the crust is load-bearing)
      for (const [px, py, r] of [[-7, 2.6, 2.3], [7, 2.6, 2.3], [0, 5.0, 2.6]]) {
        const tin = mesh(new THREE.CylinderGeometry(r, r * 0.82, 0.55, 12), crust, [0.95, 0.78, 0.5])
        tin.position.set(px, py - 0.35, 0); scene.add(tin)
        const filling = mesh(new THREE.CylinderGeometry(r * 0.88, r * 0.88, 0.14, 12), crust, [0.75, 0.4, 0.28])
        filling.position.set(px, py - 0.04, 0); scene.add(filling)
      }
      // the bakery window: a huge warm moon with mullions
      const win = glowQuad('#f0b860', 9, 6, 0.6)
      win.position.set(0, 8, -6); scene.add(win)
      const dark = retroMaterial({ map: TEX.white(), emissive: 0x0a0604 })
      for (const [w2, h2, ox, oy] of [[0.35, 6, 0, 0], [9, 0.35, 0, 0]]) {
        const bar = mesh(new THREE.BoxGeometry(w2, h2, 0.1), dark, [0.1, 0.08, 0.06])
        bar.position.set(ox, 8 + oy, -5.9); scene.add(bar)
      }
      // oven mouths along the back wall, ember-warm
      for (const ox of [-9, 0, 9]) {
        const mouth = mesh(new THREE.BoxGeometry(3.4, 2.2, 0.4), dark, [0.12, 0.09, 0.07])
        mouth.position.set(ox, 1.1, -3.2); scene.add(mouth)
        const emberG = glowQuad('#e86830', 2.6, 1.4, 0.35)
        emberG.position.set(ox, 0.9, -2.95); scene.add(emberG)
      }
      const pool = new THREE.Mesh(new THREE.CircleGeometry(6, 18), glowMat('#f0c078', 0.3))
      ensureVertexColors(pool.geometry)
      pool.rotation.x = -Math.PI / 2; pool.position.set(0, 0.03, 0); scene.add(pool)
    },
  },
}

// ═══ F4 rigs: every fighter is an EXISTING creature standing its ground ═══
// outer group carries position + facing; the pose node carries pitch (lean
// into the fight, local x) and roll (tumbles, Mote's spin, the victory
// tip-over, local z) — clean axes at ±90° facing.
function genericRig(built, { scale = 1, standX = 0, lift = 0, accent = null, roller = false, pivot = 0.5 } = {}) {
  const outer = new THREE.Group()
  const pose = new THREE.Group()
  built.group.rotation.x = standX
  built.group.position.y = lift - pivot // pose pivots at mid-body: pitch reads
  pose.position.y = pivot               // as a lean, rolls read as a wheel —
  pose.add(built.group)                 // never a cartwheel through the floor
  outer.add(pose)
  outer.scale.setScalar(scale)
  return { kind: 'generic', group: outer, pose, accent, roller, spin: 0, baseScale: scale }
}

function makeDreamRig(fid, idx) {
  switch (fid) {
    case 'nib': { // the garden gnome stands up to fight
      const r = buildGnome()
      return genericRig(r, { scale: 2.1, standX: -Math.PI / 2, lift: 0.26, accent: r.hatBone, pivot: 0.22 })
    }
    case 'curator': { const r = buildCurator(); return genericRig(r, { accent: r.armR, pivot: 0.8 }) }
    case 'paleking': { const r = buildPaleKing(); return genericRig(r, { scale: 1.25, accent: r.crown, pivot: 0.6 }) }
    case 'mote': { const r = buildMote(); return genericRig(r, { scale: 0.8, accent: r.headBone, roller: true, pivot: 0.45 }) }
    case 'chicken': { const r = buildChicken(); return genericRig(r, { scale: 1.5, accent: r.headBone, pivot: 0.25 }) }
    case 'watcher': { const rig = buildWizard({ tint: '#20242e', withStaff: false }); return { kind: 'wizard', rig, group: rig.group } }
    case 'beldam': { const rig = buildWizard({ tint: '#3a4258', beardLength: 0.62, withStaff: false }); return { kind: 'wizard', rig, group: rig.group } }
    default: { const rig = buildWizard({ tint: PLAYER_TINTS[idx % PLAYER_TINTS.length], withStaff: false }); return { kind: 'wizard', rig, group: rig.group } }
  }
}

// entering a sleeper's dream means fighting the dreamer (Part 4) — 'king'
// is the waking sleeper's name, 'paleking' the arena/fighter id
const DREAM_HOST = { beldam: 'beldam', nib: 'nib', mote: 'mote', curator: 'curator', king: 'paleking', paleking: 'paleking', chicken: 'chicken' }

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
    const P = this.nightmare && def.nightmare ? def.nightmare : def.palette
    this.sky.uniforms.uStops.value.forEach((c, i) => c.set(P.stops[i]))

    // dream palette takes the shared uniforms while the dream is up; the
    // waking zoneLight re-asserts them on the first frame after exit
    globalUniforms.uFogColor.value.set(P.fog)
    globalUniforms.uFogNear.value = 14
    globalUniforms.uFogFar.value = 80
    globalUniforms.uAmbient.value.set(P.ambient)
    globalUniforms.uSkyUp.value.set(P.skyUp)

    // shared dream furniture first (particles, FX pools) — arena builders
    // may use them (Beldam's jar moths ride this.moths)
    this.moths = new ParticleSystem(scene, { tex: TEX.glowDot({ color: '#d8cfae' }), max: 90, additive: true })
    this.zs = new ParticleSystem(scene, { tex: TEX.zGlyph(), max: 10, additive: false })
    this.embers = new ParticleSystem(scene, { tex: TEX.glowDot({ color: '#e8a848' }), max: 70, additive: true })
    this._buildFxPools(scene)
    this.baseAmbient = new THREE.Color(P.ambient)
    this.baseSkyUp = new THREE.Color(P.skyUp)
    this.fogColor = P.fog
    this.dimF = 1
    this.rng = worldRNG.fork('dream/ambient')
    this.rainAcc = 0
    this.timedPlats = null
    this.crowd = null
    this.crowdPulse = 0
    this.hallChands = null
    // per-dream ambient particles: Beldam's upward rain gets streaks; every
    // other dream drifts its own dust (color + direction from the def)
    if (def.ambient === 'rainUp') {
      this.rainUp = new ParticleSystem(scene, { tex: TEX.streak(), max: 240, additive: false, stretchY: 2.6, fogInfluence: 0.4 })
      this.drift = null
    } else {
      this.rainUp = null
      const a = def.ambient
      this.drift = new ParticleSystem(scene, {
        tex: a.puff ? TEX.puff({ name: 'dreamdust', color: a.color }) : TEX.glowDot({ color: a.color }),
        max: 90, additive: !a.puff,
      })
    }
    // — this dream's own furniture —
    const preCount = scene.children.length
    def.build(scene, this)
    if (this.nightmare) {
      // the crowd becomes shadows and the ARENA's authored glows drop to
      // coals — hazard telegraphs (FX pools, built before this) keep their
      // full warmth: even Nightmare stays fair (Part 7)
      for (let i = preCount; i < scene.children.length; i++) {
        scene.children[i].traverse((o) => {
          const u = o.material?.uniforms
          if (u?.uOpacity && o.material.blending === THREE.AdditiveBlending) u.uOpacity.value *= 0.4
        })
      }
      if (this.crowd) for (const n of this.crowd) { const u = n.material.uniforms; if (u?.uOpacity) u.uOpacity.value = 0.1 }
    }
    // — hitbox overlay (test rig): the sim's exact surfaces, drawn hot —
    // used for the Nightmare regrade proof pairs (identical layout, only
    // the presentation changes)
    if (typeof window !== 'undefined' && window.__FIGHT_HITBOXES__) {
      // flat emissive fills — a glowDot texture stretched over a 26m quad
      // fades to nothing, which hid the whole overlay in the first pairs
      const dbgQuad = (hex, w, h, opacity) => {
        const m = retroMaterial({ map: TEX.white(), transparent: true, depthWrite: false, opacity, emissive: hex, noFog: true })
        m.blending = THREE.AdditiveBlending
        const q = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m)
        ensureVertexColors(q.geometry, [0, 0, 0]) // emissive-only: debug ink
        return q
      }
      for (const so of def.arena.solids) {
        const q = dbgQuad('#661a33', so.w, so.h, 0.5)
        q.position.set(so.x, so.y - so.h / 2, 2.4); scene.add(q)
        const topLine = dbgQuad('#ffffff', so.w, 0.14, 0.8)
        topLine.position.set(so.x, so.y, 2.45); scene.add(topLine)
      }
      for (const pl of def.arena.plats) {
        const q = dbgQuad('#8a7a20', pl.w, 0.2, 0.85)
        q.position.set(pl.x, pl.y, 2.4); scene.add(q)
      }
      const b = def.arena.blast
      for (const [x, y, w, h] of [[b.l, (b.t + b.b) / 2, 0.3, b.t - b.b], [b.r, (b.t + b.b) / 2, 0.3, b.t - b.b], [(b.l + b.r) / 2, b.t, b.r - b.l, 0.3], [(b.l + b.r) / 2, b.b, b.r - b.l, 0.3]]) {
        const q = dbgQuad('#7a1414', w, h, 0.8)
        q.position.set(x, y, 2.4); scene.add(q)
      }
    }

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

  // ——— F4 FX pools: every sim projectile/hazard/super has a body ———
  _buildFxPools(scene) {
    const glow = (color, w, h) => {
      const m = retroMaterial({ map: TEX.glowDot({ color }), transparent: true, depthWrite: false, opacity: 0.85 })
      m.blending = THREE.AdditiveBlending
      const q = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m)
      ensureVertexColors(q.geometry)
      q.visible = false
      scene.add(q)
      return q
    }
    const fx = (this.fx = { darts: [], hats: [], chands: [], warns: [], roots: [], birds: [], nobles: [], bottles: [], moon: null })
    for (let i = 0; i < 3; i++) fx.darts.push(glow('#e8a848', 0.55, 0.55))
    for (let i = 0; i < 2; i++) {
      const hat = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.5, 6), retroMaterial({ map: TEX.white(), emissive: 0x1a1428 }))
      ensureVertexColors(hat.geometry, [0.32, 0.28, 0.45])
      hat.visible = false; scene.add(hat); fx.hats.push(hat)
    }
    // chandeliers: cone + halo, plus warm warn circles for ALL telegraphs
    for (let i = 0; i < 3; i++) {
      const g = new THREE.Group()
      const cone = new THREE.Mesh(new THREE.ConeGeometry(0.9, 0.8, 7), retroMaterial({ map: TEX.white(), emissive: 0x3a2c10 }))
      ensureVertexColors(cone.geometry, [0.8, 0.66, 0.3]); cone.rotation.x = Math.PI; g.add(cone)
      const halo = glow('#e8c26a', 2.2, 2.2); halo.visible = true; g.add(halo)
      g.visible = false; scene.add(g); fx.chands.push(g)
    }
    for (let i = 0; i < 8; i++) {
      const w = glow('#e8a848', 1.8, 0.9)
      w.rotation.x = -Math.PI / 2; w.position.y = 0.05
      fx.warns.push(w)
    }
    for (let i = 0; i < 5; i++) {
      const root = new THREE.Mesh(new THREE.ConeGeometry(0.35, 1.6, 6), retroMaterial({ map: TEX.bark({ name: 'dreamroot' }), emissive: 0x0e1a10 }))
      ensureVertexColors(root.geometry, [0.45, 0.55, 0.4])
      root.visible = false; scene.add(root); fx.roots.push(root)
    }
    for (let i = 0; i < 6; i++) {
      const bird = buildChicken()
      bird.group.scale.setScalar(1.35)
      bird.group.visible = false
      scene.add(bird.group)
      fx.birds.push(bird)
    }
    for (let i = 0; i < 3; i++) {
      const pair = new THREE.Group()
      for (const sx of [-0.35, 0.35]) {
        const mat = retroMaterial({ map: TEX.white(), transparent: true, opacity: 0.5, depthWrite: false, emissive: 0x24404a })
        const noble = new THREE.Mesh(new THREE.ConeGeometry(0.34, 1.5, 7), mat)
        ensureVertexColors(noble.geometry, [0.65, 0.9, 0.95])
        noble.position.set(sx, 0.75, 0)
        const head = new THREE.Mesh(new THREE.SphereGeometry(0.14, 7, 5), mat)
        ensureVertexColors(head.geometry, [0.7, 0.92, 0.96])
        head.position.set(sx, 1.62, 0)
        pair.add(noble); pair.add(head)
      }
      pair.visible = false; scene.add(pair); fx.nobles.push(pair)
    }
    const glassMat = retroMaterial({ map: TEX.white(), transparent: true, opacity: 0.7, emissive: 0x2a5040 })
    for (let i = 0; i < 5; i++) {
      const b = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 0.55, 6), glassMat)
      ensureVertexColors(b.geometry, [0.5, 0.72, 0.62])
      b.visible = false; scene.add(b); fx.bottles.push(b)
    }
    fx.moon = glow('#c8d4f0', 5.5, 5.5)
    // — F6 items: bottled brews, one comically load-bearing boot, and the
    //   neutral chicken who is not participating (officially) —
    fx.itemMeshes = []
    const glassMat2 = retroMaterial({ map: TEX.white(), transparent: true, opacity: 0.75, emissive: 0x2a5040 })
    for (let i = 0; i < 3; i++) {
      const g = new THREE.Group()
      const bottle = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 0.5, 6), glassMat2)
      ensureVertexColors(bottle.geometry, [0.6, 0.8, 0.7])
      g.add(bottle)
      const halo = glow('#e8c26a', 1.1, 1.1); halo.visible = true; halo.position.y = 0.25; g.add(halo)
      g.visible = false; scene.add(g); fx.itemMeshes.push(g)
    }
    const bootG = new THREE.Group()
    const leather = retroMaterial({ map: TEX.plank({ name: 'dreamboot' }), emissive: 0x1a1008 })
    const sole = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.22, 0.26), leather)
    ensureVertexColors(sole.geometry, [0.55, 0.4, 0.28]); bootG.add(sole)
    const shaft = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.42, 0.26), leather)
    ensureVertexColors(shaft.geometry, [0.6, 0.44, 0.3]); shaft.position.set(-0.17, 0.3, 0); bootG.add(shaft)
    bootG.visible = false; scene.add(bootG); fx.boot = bootG
    fx.critter = buildChicken()
    fx.critter.group.scale.setScalar(1.2)
    fx.critter.group.visible = false
    scene.add(fx.critter.group)
  }

  // position the pools from live sim state (render dt — drifts through hitstop)
  _updateFx(dt) {
    const fx = this.fx
    if (!fx || !this.match) return
    const tick = this.match.tick
    let di = 0, hi = 0
    for (const p of this.match.projs) {
      if (p.kind === 'dart' && di < fx.darts.length) {
        const q = fx.darts[di++]
        q.visible = true; q.position.set(p.x, p.y, 0.3)
        // the warm footprint trail (Part 3)
        this.embers?.spawn({
          pos: new THREE.Vector3(p.x, p.y - 0.05, 0.25), vel: new THREE.Vector3(0, 0.4, 0),
          maxLife: 0.7, size: 0.09, alpha: 0.5, seed: (tick % 60) / 60,
          update(pt, dt2) { pt.pos.y += pt.vel.y * dt2; pt.alpha = 0.5 * (1 - pt.life / pt.maxLife) },
        })
      } else if (p.kind === 'hat' && hi < fx.hats.length) {
        const q = fx.hats[hi++]
        q.visible = true; q.position.set(p.x, p.y, 0.3)
        q.rotation.z += dt * 14 * Math.sign(p.vx || 1)
      }
    }
    for (let i = di; i < fx.darts.length; i++) fx.darts[i].visible = false
    for (let i = hi; i < fx.hats.length; i++) fx.hats[i].visible = false

    let ci = 0, ri = 0, bi = 0, ni = 0, wi = 0
    for (const h of this.match.hazards) {
      if (h.kind === 'chand' && ci < fx.chands.length) {
        const g = fx.chands[ci++]
        // hangs just above the frame during the warn so the descent READS
        g.visible = true; g.position.set(h.x, h.warn > 0 ? 8.2 : Math.min(8.2, h.y), 0)
        if (h.warn > 0 && wi < fx.warns.length) {
          const w = fx.warns[wi++]
          w.visible = true; w.position.set(h.x, 0.06, 0.2)
          w.scale.setScalar(1.5)
          w.material.uniforms.uOpacity.value = 0.4 + 0.3 * Math.sin(tick * 0.4)
        }
      } else if (h.kind === 'root' && ri < fx.roots.length) {
        const r = fx.roots[ri++]
        if (h.warn > 0) {
          if (wi < fx.warns.length) {
            const w = fx.warns[wi++]
            w.visible = true; w.position.set(h.x, 0.06, 0.2)
            w.material.uniforms.uOpacity.value = 0.25 + 0.2 * Math.sin(tick * 0.5)
          }
          r.visible = false
        } else {
          const age = h.t - (h.popT ?? h.t)
          const up = Math.min(1, age / 6)
          const down = Math.max(0, 1 - Math.max(0, age - 60) / 30)
          r.visible = down > 0
          r.scale.set(1, Math.max(0.05, up * down), 1)
          r.position.set(h.x, 0.8 * r.scale.y, 0.1)
        }
      } else if (h.kind === 'derbybird' && bi < fx.birds.length) {
        const b = fx.birds[bi++]
        b.group.visible = true
        b.group.position.set(h.x, Math.abs(Math.sin((tick + bi * 7) * 0.5)) * 0.18, 0.2)
        b.group.rotation.y = h.vx > 0 ? Math.PI / 2 : -Math.PI / 2
        if (b.headBone) b.headBone.rotation.x = Math.sin((tick + bi * 5) * 0.6) * 0.3
      } else if (h.kind === 'waltz' && ni < fx.nobles.length) {
        const n = fx.nobles[ni++]
        n.visible = true
        n.position.set(h.x, 0, 0.1)
        n.rotation.y = Math.sin((tick + ni * 11) * 0.08) * 0.8 // the slow turn of the dance
        n.children.forEach((c, k) => { c.position.y += Math.sin((tick + k * 9) * 0.12) * 0.002 })
      }
    }
    for (let i = ci; i < fx.chands.length; i++) fx.chands[i].visible = false
    for (let i = ri; i < fx.roots.length; i++) fx.roots[i].visible = false
    for (let i = bi; i < fx.birds.length; i++) fx.birds[i].group.visible = false
    for (let i = ni; i < fx.nobles.length; i++) fx.nobles[i].visible = false
    for (let i = wi; i < fx.warns.length; i++) fx.warns[i].visible = false

    // — per-fighter super bodies —
    let moonOn = false, tornado = null
    for (const f of this.match.fighters) {
      if (f.superFx?.kind === 'moonrise' && f.id !== undefined) {
        moonOn = true
        const rise = 1 - f.superFx.t / 180
        fx.moon.visible = true
        fx.moon.position.set(f.x, 2.5 + rise * 5.5, -2)
        fx.moon.material.uniforms.uOpacity.value = 0.55 * Math.min(1, (1 - rise) * 4)
      }
      if (f.superFx?.kind === 'bottleTornado') tornado = f
    }
    if (!moonOn) fx.moon.visible = false
    for (let i = 0; i < fx.bottles.length; i++) {
      const b = fx.bottles[i]
      if (tornado) {
        const a = (i / fx.bottles.length) * Math.PI * 2 + tick * 0.11
        b.visible = true
        b.position.set(tornado.x + Math.cos(a) * 1.9, tornado.y + 1.0 + Math.sin(tick * 0.13 + i) * 0.6, 0.25)
        b.rotation.z = a
      } else b.visible = false
    }

    // — F6 items on the floor + the neutral chicken —
    let bi2 = 0, bootUsed = false
    for (const it of this.match.items) {
      if (it.kind === 'boot' && !bootUsed) {
        bootUsed = true
        fx.boot.visible = true
        fx.boot.position.set(it.x, it.y, 0.25)
        fx.boot.rotation.z = Math.sin(tick * 0.06) * 0.1
      } else if (bi2 < fx.itemMeshes.length) {
        const g = fx.itemMeshes[bi2++]
        g.visible = true
        g.position.set(it.x, it.y + Math.sin(tick * 0.09 + bi2) * 0.06, 0.25)
        g.rotation.z = Math.sin(tick * 0.05 + bi2 * 2) * 0.12
      }
    }
    if (!bootUsed) fx.boot.visible = false
    for (let i = bi2; i < fx.itemMeshes.length; i++) fx.itemMeshes[i].visible = false
    const cr = this.match.critter
    if (cr && this.match.critterOn) {
      const g = fx.critter.group
      g.visible = true
      this.critterDuck = Math.max(0, (this.critterDuck ?? 0) - dt * 3)
      g.position.set(cr.x, cr.y + Math.abs(Math.sin(tick * 0.4)) * 0.1 * (1 - this.critterDuck), 0.2)
      g.rotation.y = (cr.vx ?? 0) >= 0 ? Math.PI / 2 : -Math.PI / 2
      g.scale.y = 1.2 * (1 - this.critterDuck * 0.45) // the frame-1 duck
      if (fx.critter.headBone) fx.critter.headBone.rotation.x = Math.sin(tick * 0.23) * 0.25
    } else fx.critter.group.visible = false
    // ember trails for the emberjack'd
    for (const f of this.match.fighters) {
      if ((f.emberT ?? 0) > 0 && f.stocks > 0 && this.match.tick % 4 === 0) {
        this.embers?.spawn({
          pos: new THREE.Vector3(f.x - f.face * 0.3, f.y + 0.15, 0.2), vel: new THREE.Vector3(0, 0.8, 0),
          maxLife: 0.6, size: 0.08, alpha: 0.5, seed: (tick % 60) / 60,
          update(p, dt2) { p.pos.y += p.vel.y * dt2; p.alpha = 0.5 * (1 - p.life / p.maxLife) },
        })
      }
    }

    // — Lights Out: the warm accents die down to the lantern pools —
    const targetDim = this.match.lightsOutT > 0 ? 0.22 : 1
    this.dimF += (targetDim - this.dimF) * Math.min(1, dt * 6)
    globalUniforms.uAmbient.value.copy(this.baseAmbient).multiplyScalar(this.dimF)
    globalUniforms.uSkyUp.value.copy(this.baseSkyUp).multiplyScalar(this.dimF)
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
      // stock moons (capped at 5 drawn — test matches run 99 stocks)
      for (let s = 0; s < Math.min(f.stocks, 5); s++) {
        ctx.fillStyle = '#c8d4f0'
        ctx.beginPath(); ctx.arc(x + 30 + s * 12, 44, 4, 0, Math.PI * 2); ctx.fill()
      }
      ctx.globalAlpha = 1
    })
  }

  // ——— fighters ———
  _spawnFighters(n, opts = {}) {
    // default cast: you are the Lamplighter; the dreamer meets you in their
    // own dream; couch seats 3/4 fill from the roster
    const host = DREAM_HOST[this.arenaId] ?? 'beldam'
    const fids = opts.fids ?? ['lamplighter', host, host === 'nib' ? 'chicken' : 'nib', host === 'paleking' ? 'mote' : 'paleking']
    for (let i = 0; i < n; i++) {
      const f = makeFighter(i, { stocks: opts.stocks, fid: fids[i] })
      const [sx, sy] = this.match.arena.spawns[i]
      f.x = sx; f.y = sy
      f.face = sx > 0 ? -1 : 1
      this.match.fighters.push(f)
      const R = makeDreamRig(f.fid, i)
      this.scene.add(R.group)
      this.rigs.set(i, R)
      this.anims.set(i, makeAnimState())
    }
  }

  enter(arenaId = 'beldam', players = 2, liveInput = null, opts = {}) {
    if (this.active) return false
    this.arenaId = DREAMS[arenaId] ? arenaId : 'beldam'
    const def = DREAMS[this.arenaId]
    this.def = def
    // the Nightmare dial (Part 4.7): darkest regrade, shadow crowds, hollow
    // glow — PRESENTATION only; the arena def is byte-identical
    this.nightmare = !!opts.nightmare
    this.scene = this._buildScene(def)
    this.match = makeMatch(makeArena(def.arena), [])
    // items ride live matches by default (Part 6: on unless toggled off);
    // manual/gate matches stay pure unless a gate asks
    this.match.itemsOn = opts.items ?? !this.manual
    this.match.critterOn = this.match.itemsOn && this.arenaId !== 'chicken' // the bird is home there
    this._spawnFighters(players, opts)
    this.liveInput = liveInput
    this.acc = 0
    this.victory = null
    this.cam = null
    this.shake = null
    // bots fill the seats nobody's sitting in (Part 6): {id: 'dozy'|'awake'|'lucid'}
    this.bots = new Map()
    for (const [bid, level] of Object.entries(opts.bots ?? {})) this.bots.set(+bid, makeBot(level, +bid))
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

  // F8 couch (Part 6, the design target): split keyboard — WASD+F/G/H/R vs
  // arrows+K/L/;/J — plus gamepads. Pad 0 rides along with seat 2's arrows;
  // extra pads take seats 3 and 4. Bots overwrite any seat they hold.
  _liveSnapshot() {
    const inp = this.liveInput
    if (!inp) return {}
    const out = {}
    const KB = [
      { left: 'KeyA', right: 'KeyD', down: 'KeyS', jump: ['KeyW', 'Space'], light: 'KeyF', heavy: 'KeyG', toss: 'KeyH', special: 'KeyR' },
      { left: 'ArrowLeft', right: 'ArrowRight', down: 'ArrowDown', jump: ['ArrowUp'], light: 'KeyK', heavy: 'KeyL', toss: 'Semicolon', special: 'KeyJ' },
    ]
    const n = this.match?.fighters.length ?? 2
    for (let seat = 0; seat < Math.min(2, n); seat++) {
      const k = KB[seat]
      out[seat] = {
        x: (inp.down(k.right) ? 1 : 0) - (inp.down(k.left) ? 1 : 0),
        down: inp.down(k.down),
        jump: inp.down(...k.jump),
        light: inp.down(k.light),
        heavy: inp.down(k.heavy),
        toss: inp.down(k.toss),
        special: inp.down(k.special),
      }
    }
    const pads = typeof navigator !== 'undefined' && navigator.getGamepads ? navigator.getGamepads() : []
    let seat = 1
    for (const p of pads ?? []) {
      if (!p || !p.connected) continue
      if (seat >= n) break
      const ax = p.axes?.[0] ?? 0
      const dpx = (p.buttons?.[15]?.pressed ? 1 : 0) - (p.buttons?.[14]?.pressed ? 1 : 0)
      const g = {
        x: Math.abs(ax) > 0.35 ? Math.sign(ax) : dpx,
        down: (p.axes?.[1] ?? 0) > 0.5 || !!p.buttons?.[13]?.pressed,
        jump: !!p.buttons?.[0]?.pressed,
        light: !!p.buttons?.[2]?.pressed,
        heavy: !!p.buttons?.[1]?.pressed,
        special: !!p.buttons?.[3]?.pressed,
        toss: !!p.buttons?.[5]?.pressed,
      }
      const cur = out[seat]
      out[seat] = cur
        ? { x: cur.x || g.x, down: cur.down || g.down, jump: cur.jump || g.jump, light: cur.light || g.light, heavy: cur.heavy || g.heavy, special: cur.special || g.special, toss: cur.toss || g.toss }
        : g
      seat++
    }
    return out
  }

  // Part 5 impact presentation: hitstop freezes fighters (sim-side), the
  // CAMERA shakes with knockback — capped at 0.6% of the visible frame
  // height, ≤200ms, and fully disabled by reduced motion.
  _consumeEvents(events) {
    for (const e of events) {
      if (e.t === 'ko') {
        // poofed into moths + one drifting z (Part 1: nobody gets hurt);
        // clamped just inside the widest camera frame so the blast-edge
        // poof is SEEN, Smash-style, not swallowed off-screen
        const cx = Math.max(-14, Math.min(14, e.x)), cy = Math.max(-4, Math.min(13, e.y))
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
      } else if (e.t === 'brew' && e.kind === 'humble') {
        // the modest moth cloud arrives
        const f = this.match?.fighters?.[e.id]
        for (let i = 0; i < 8 && f; i++) {
          const a = (i / 8) * Math.PI * 2
          this.moths?.spawn({
            pos: new THREE.Vector3(f.x, f.y + 1, 0.4),
            vel: new THREE.Vector3(Math.cos(a) * 0.9, Math.sin(a) * 0.7 + 0.5, 0),
            maxLife: 1.4, size: 0.12, seed: i / 8,
            update(p, dt2) { p.pos.x += p.vel.x * dt2; p.pos.y += p.vel.y * dt2; p.vel.x *= 0.98 },
          })
        }
      } else if (e.t === 'hit' || e.t === 'throw') {
        if (this.crowd) this.crowdPulse = Math.min(1.6, this.crowdPulse + 0.7) // polite applause
        const reduced = typeof window !== 'undefined' && window.__REDUCED_MOTION__
        const visH = 2 * (this.cam?.d ?? 17) * Math.tan((this.camera?.fov ?? 38) * Math.PI / 360)
        const ampM = reduced ? 0 : (e.shake ?? 0.4) * 0.006 * visH
        this.shake = { ampM, ticks: e.shakeTicks ?? 6, left: e.shakeTicks ?? 6, seed: (e.d ?? 0) * 7 + (this.match?.tick ?? 0) % 13 }
        this.lastShake = { amp01: e.shake ?? 0.4, ampM: +ampM.toFixed(4), ticks: e.shakeTicks ?? 6, capM: +(0.006 * visH).toFixed(4), reduced: !!reduced }
      }
    }
  }

  // headless bot duel on the current match (feel-gate rig for F7)
  botDuel(levelA = 'lucid', levelB = 'dozy', maxTicks = 14400) {
    if (!this.active) return null
    const bots = [makeBot(levelA, 0), makeBot(levelB, 1)]
    let t = 0
    while (!this.match.over && t++ < maxTicks) {
      this._consumeEvents(stepMatch(this.match, { 0: bots[0](this.match), 1: bots[1](this.match) }))
    }
    return { over: !!this.match.over, winner: this.match.over ? this.match.winner : null, ticks: t }
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
        id: f.id, fid: f.fid, x: +f.x.toFixed(4), y: +f.y.toFixed(4), vx: +f.vx.toFixed(4), vy: +f.vy.toFixed(4),
        grounded: f.grounded, coyote: f.coyote, jumpsLeft: f.jumpsLeft, jumpBuf: f.jumpBuf,
        landlag: f.landlag, fastfall: f.fastfall, face: f.face, wooze: f.wooze, stocks: f.stocks,
        hitstop: f.hitstop, move: f.move?.name ?? null, moveT: f.move?.t ?? 0, launched: f.launched,
        grab: f.grab, grabbing: f.grabbing, mash: f.mash, ko: f.ko, invuln: f.invuln,
        deep: +f.deep.toFixed(2), armorT: f.armorT, ghostT: f.ghostT, slowFallT: f.slowFallT,
        superFx: f.superFx ? { kind: f.superFx.kind, t: f.superFx.t } : null,
        floatT: f.floatT ?? 0, tinyT: f.tinyT ?? 0, giggleT: f.giggleT ?? 0, emberT: f.emberT ?? 0, boot: !!f.boot,
      })),
      items: this.match.items.map((i) => ({ kind: i.kind, x: +i.x.toFixed(3), y: +i.y.toFixed(3) })),
      critter: this.match.critter ? { x: +this.match.critter.x.toFixed(3), y: +this.match.critter.y.toFixed(3) } : null,
      over: !!this.match.over, winner: this.match.winner ?? null,
      projs: this.match.projs.map((p) => ({ kind: p.kind, x: +p.x.toFixed(3), y: +p.y.toFixed(3), vx: +p.vx.toFixed(3), turned: !!p.turned })),
      hazards: this.match.hazards.map((h) => ({ kind: h.kind, x: +h.x.toFixed(3), y: +h.y.toFixed(3), warn: h.warn, t: h.t })),
      lightsOutT: this.match.lightsOutT,
      events: this.match.events.slice(),
    }
  }

  _pose(dt) {
    for (const f of this.match.fighters) {
      const R = this.rigs.get(f.id)
      const st = this.anims.get(f.id)
      if (!R) continue
      const g = R.group
      // eliminated fighters leave the dream until the victory nap gathers them
      if (f.stocks <= 0 && !this.victory) { g.visible = false; continue }
      g.visible = true
      // — victory nap (Part 2): the winner yawns and lies down beside the
      //   losers; every match ends cozy —
      if (this.victory) {
        const v = this.victory
        const wf = this.match.fighters[v.winner] ?? this.match.fighters[0]
        // the nap gathers at center bench, never at a blast-edge or shelf
        const nx = Math.max(-8, Math.min(8, wf.x))
        const win = f.id === v.winner
        const k = f.id < v.winner ? f.id : f.id - 1
        g.position.set(win ? nx : nx + (k + 1) * 1.5 * (k % 2 ? 1 : -1), 0, 0)
        if (R.kind === 'wizard') {
          st.action = win ? (v.t > 2.4 ? 'lie' : v.t > 1.0 ? 'sit' : null) : 'sleep'
          advanceAnim(st, dt, 0, false)
          applyPose(R.rig, st, 0)
        } else {
          // creatures tip gently onto their side to sleep (comedy law)
          const want = win ? (v.t > 2.4 ? 1 : 0) : 1
          R.pose.rotation.x = 0
          R.pose.rotation.z += (want * Math.PI / 2 - R.pose.rotation.z) * Math.min(1, dt * 4)
        }
        continue
      }
      g.position.set(f.x, f.y, 0)
      g.rotation.y = f.face > 0 ? Math.PI / 2 : -Math.PI / 2
      // Constellation Slam: Nib IS the constellation, briefly enormous;
      // Tinywort: briefly the opposite
      const targetS = (R.baseScale ?? 1) * (f.superFx?.kind === 'constellation' ? 2.2 : 1) * ((f.tinyT ?? 0) > 0 ? 0.62 : 1)
      if (Math.abs(g.scale.x - targetS) > 0.001) g.scale.setScalar(g.scale.x + (targetS - g.scale.x) * Math.min(1, dt * 5))
      // gigglewater: helplessly delighted
      if ((f.giggleT ?? 0) > 0) g.rotation.z = Math.sin(this.match.tick * 0.5 + f.id) * 0.16
      if (R.kind === 'wizard') {
        advanceAnim(st, dt, Math.abs(f.vx), !f.grounded)
        applyPose(R.rig, st, 0)
        // swing overlay: the arm whips through the move, wooze sways the idle
        if (f.move) {
          const A = { light: 15, heavy: 34, special: 24, super: 12 }[f.move.name] ?? 15
          const ph = Math.min(1, f.move.t / A)
          R.rig.bones.armR.rotation.x = -0.35 - Math.sin(ph * Math.PI) * (f.move.name === 'light' ? 1.7 : 2.4)
        }
        if (f.wooze > 0) {
          const sway = Math.min(0.22, f.wooze * 0.0022)
          R.rig.bones.spine.rotation.z += Math.sin((this.match.tick + f.id * 17) * 0.11) * sway
        }
      } else {
        // — generic creature pose: lean, waddle, lunge, tumble —
        const tick = this.match.tick
        let pitch = 0, roll = 0
        const sp = Math.abs(f.vx)
        if (f.grounded && sp > 0.5) { pitch += Math.min(0.2, sp * 0.028) + Math.sin(tick * 0.55 + f.id) * 0.05 }
        if (!f.grounded) pitch -= 0.12
        if (f.launched > 0) roll += Math.sin(tick * 0.6 + f.id * 3) * 0.35
        if (f.move) {
          if (R.roller && f.move.name === 'special') {
            R.spin -= 0.42 // Mote's shell spin cartwheels through the screen plane
            roll += R.spin
          } else {
            const A = { light: 12, heavy: 22, special: 20, super: 10 }[f.move.name] ?? 12
            const ph = Math.min(1, f.move.t / A)
            pitch += Math.sin(ph * Math.PI) * 0.55
            if (R.accent) R.accent.rotation.x = -Math.sin(ph * Math.PI) * 1.1
          }
        } else {
          R.spin *= 0.86
          roll += R.spin
          if (R.accent) R.accent.rotation.x *= 0.8
          pitch += Math.sin(tick * 0.045 + f.id * 2) * 0.03 // idle breath
        }
        if (f.wooze > 0) roll += Math.sin((tick + f.id * 17) * 0.11) * Math.min(0.2, f.wooze * 0.002)
        R.pose.rotation.x = pitch
        R.pose.rotation.z = roll
      }
    }
    // — dynamic fight camera: frame every wizard still dreaming, zoom with
    //   the spread (readable chaos, Part 1.2); shake rides on top —
    if (!this.camera) return
    const tanH = Math.tan((this.camera.fov * Math.PI) / 360)
    let tgt
    if (this.victory) {
      const wf = this.match.fighters[this.victory.winner] ?? this.match.fighters[0]
      const nx = Math.max(-8, Math.min(8, wf.x))
      tgt = { x: nx, y: 2.4, d: 14.5 } // gentle push-in on the nap
    } else {
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
      for (const f of this.match.fighters) {
        if (f.stocks <= 0) continue
        minX = Math.min(minX, f.x); maxX = Math.max(maxX, f.x)
        minY = Math.min(minY, f.y); maxY = Math.max(maxY, f.y)
      }
      if (minX === Infinity) { minX = maxX = 0; minY = maxY = 2 }
      const fitW = ((maxX - minX) / 2 + 3.4) / (tanH * (16 / 9))
      const fitH = ((maxY - minY) / 2 + 2.6) / tanH
      tgt = {
        x: (minX + maxX) / 2,
        y: Math.max(2.6, (minY + maxY) / 2 + 0.9),
        d: Math.min(24, Math.max(13, fitW, fitH)),
      }
    }
    const c = this.cam ?? (this.cam = { ...tgt })
    const ck = 1 - Math.exp(-dt / 0.28)
    c.x += (tgt.x - c.x) * ck; c.y += (tgt.y - c.y) * ck; c.d += (tgt.d - c.d) * ck
    let nx = 0, ny = 0
    if (this.shake && this.shake.left > 0) {
      const s = this.shake
      s.left--
      const kk = s.left / s.ticks
      nx = Math.sin(s.seed + s.left * 2.7) * s.ampM * kk
      ny = Math.cos(s.seed * 1.3 + s.left * 3.1) * s.ampM * kk * 0.6
    }
    this.camera.position.set(c.x + nx, c.y + ny, c.d)
    this.camera.lookAt(c.x, c.y - 0.4, 0)
    // Bottle Tornado: the screen sways for EVERYONE (reduced-motion exempt)
    if (!(typeof window !== 'undefined' && window.__REDUCED_MOTION__) &&
      this.match.fighters.some((f) => f.superFx?.kind === 'bottleTornado')) {
      this.camera.rotation.z += Math.sin(this.match.tick * 0.06) * 0.03
    }
  }

  update(dt) {
    if (!this.active) return
    if (!this.manual) {
      this.acc = Math.min(this.acc + dt, 0.25)
      while (this.acc >= TICK) {
        this.acc -= TICK
        const inputs = this._liveSnapshot()
        for (const [bid, bot] of this.bots) inputs[bid] = bot(this.match) // per-TICK: lockstep-legal
        this._consumeEvents(stepMatch(this.match, inputs))
      }
    }
    // render-dt presentation: particles DRIFT through hitstop (Part 5)
    // Beldam's rain falls upward; every other dream drifts its own dust
    if (this.rainUp) {
      this.rainAcc += dt * 55
      const rng = this.rng
      while (this.rainAcc >= 1) {
        this.rainAcc -= 1
        this.rainUp.spawn({
          pos: new THREE.Vector3(rng.range(-20, 20), rng.range(-9, -6), rng.range(-4, 5)),
          vel: new THREE.Vector3(rng.range(-0.2, 0.2), rng.range(4.5, 7.5), 0),
          maxLife: 4.2, size: rng.range(0.09, 0.15), alpha: 0.38, seed: rng.next(),
          update(p, dt2) { p.pos.addScaledVector(p.vel, dt2); if (p.pos.y > 17) p.life = p.maxLife },
        })
      }
    } else if (this.drift) {
      const a = this.def.ambient
      this.rainAcc += dt * a.rate
      const rng = this.rng
      while (this.rainAcc >= 1) {
        this.rainAcc -= 1
        this.drift.spawn({
          pos: new THREE.Vector3(rng.range(-18, 18), rng.range(a.vel[1] > 0 ? -1 : 4, a.vel[1] > 0 ? 6 : 14), rng.range(-4, 4)),
          vel: new THREE.Vector3(a.vel[0] + rng.range(-0.08, 0.08), a.vel[1] + rng.range(-0.08, 0.08), 0),
          maxLife: rng.range(5, 9), size: (a.size ?? 0.08) * rng.range(0.8, 1.3), alpha: a.alpha ?? 0.4, seed: rng.next(),
          update(p, dt2) {
            p.pos.addScaledVector(p.vel, dt2)
            p.pos.x += Math.sin(p.life * 1.1 + p.seed * 9) * 0.2 * dt2
            p.alpha = (p.aBase ?? (p.aBase = p.alpha)) * Math.sin((p.life / p.maxLife) * Math.PI)
          },
        })
      }
    }
    this.moths?.update(dt, this.camera)
    this.zs?.update(dt, this.camera)
    this.rainUp?.update(dt, this.camera)
    this.drift?.update(dt, this.camera)
    this.embers?.update(dt, this.camera)
    this._updateFx(dt)
    // — Nib's star-line platforms: solid when the sim says so; the warn
    //   glow breathes for the 2s before each redraw (Part 4.2 telegraph) —
    if (this.timedPlats) {
      const tick = this.match.tick
      for (const tp of this.timedPlats) {
        const T = tp.p.timed
        const t = (tick + (T.offset ?? 0)) % T.period
        const on = platOn(tp.p, tick)
        tp.line.visible = on
        for (const e of tp.ends) e.visible = on
        const warnIn = T.period - t // ticks until redraw
        tp.warn.visible = !on && warnIn <= 120
        if (tp.warn.visible) tp.warn.material.uniforms.uOpacity.value = 0.2 + 0.25 * Math.sin(tick * 0.35)
        if (on) tp.line.material.uniforms.uOpacity.value = t > T.on - 60 ? 0.9 * ((T.on - t) / 60) : 0.9 // fade out before undraw
      }
    }
    // the Full Hall hides a hanging chandelier while its ghost is falling
    if (this.hallChands) {
      const falling = new Set(this.match.hazards.filter((h) => h.kind === 'chand').map((h) => h.x))
      for (const [cx, g] of Object.entries(this.hallChands)) g.visible = !falling.has(+cx)
    }
    // the Party applauds a good hit, politely
    if (this.crowd) {
      this.crowdPulse = Math.max(0, this.crowdPulse - dt * 1.4)
      const k = this.crowdPulse
      this.crowd.forEach((n, i) => {
        n.scale.y = 1 + k * 0.12 * Math.abs(Math.sin(this.match.tick * 0.5 + i))
        n.rotation.z = Math.sin(this.match.tick * 0.02 + i * 1.7) * 0.05
      })
    }
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
    globalUniforms.uFogColor.value.set(this.fogColor ?? this.def.palette.fog)
  }
}

export const dream = new DreamMode()
