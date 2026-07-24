// Sleepers & ambient NPCs (MASTER_PROMPT 6.4, Rule 5: nobody is awake).
// Idle loops + one scripted stir per night. Chickens are the only ambulatory
// NPCs in the game and must be impeccable.

import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { buildWizard } from '../art/characters.js'
import { retroMaterial, ensureVertexColors } from '../art/materials.js'
import * as TEX from '../art/textures.js'
import { worldRNG } from '../core/rng.js'
import { applyPose, makeAnimState } from './anim.js'
import { cluck, snore, catPurr, caw } from '../audio/sfx.js'
import { sharedMats } from '../art/meshes.js'

function M(geo, mat, tint) {
  ensureVertexColors(geo, tint)
  return new THREE.Mesh(geo, mat)
}

function sharedNpcMats() { return sharedMats() }

// Merge a group's DIRECT child meshes that share a material into one mesh each
// (bones/nested groups untouched). Cuts NPC draw calls ~4× (Part 7.2 spirit).
function mergeDirectChildren(group) {
  const byMat = new Map()
  const toRemove = []
  for (const o of [...group.children]) {
    if (!o.isMesh) continue
    o.updateMatrix()
    const geo = o.geometry.clone().applyMatrix4(o.matrix)
    if (!byMat.has(o.material)) byMat.set(o.material, [])
    byMat.get(o.material).push(geo)
    toRemove.push(o)
  }
  if (toRemove.length < 2) return
  for (const o of toRemove) group.remove(o)
  for (const [mat, geos] of byMat) {
    const merged = mergeGeometries(geos, false)
    if (merged) group.add(new THREE.Mesh(merged, mat))
  }
}

// ——— Chicken: the most load-bearing ~200 triangles in the game (7.2) ———
export function buildChicken() {
  const mat = retroMaterial({ map: TEX.white(), hemi: true })
  const g = new THREE.Group()
  const white = [0.92, 0.9, 0.86]
  const body = M(new THREE.SphereGeometry(0.16, 8, 6), mat, white)
  body.scale.set(1.15, 0.95, 1.35)
  body.position.y = 0.22
  g.add(body)
  const headBone = new THREE.Group()
  headBone.position.set(0, 0.34, 0.14)
  g.add(headBone)
  const head = M(new THREE.SphereGeometry(0.085, 7, 6), mat, white)
  head.position.y = 0.06
  headBone.add(head)
  const beak = M(new THREE.ConeGeometry(0.03, 0.07, 5), mat, [0.95, 0.7, 0.25])
  beak.rotation.x = Math.PI / 2
  beak.position.set(0, 0.055, 0.11)
  headBone.add(beak)
  const comb = M(new THREE.BoxGeometry(0.025, 0.06, 0.08), mat, [0.85, 0.2, 0.15])
  comb.position.set(0, 0.135, 0.02)
  headBone.add(comb)
  const wattle = M(new THREE.SphereGeometry(0.022, 5, 4), mat, [0.85, 0.2, 0.15])
  wattle.position.set(0, 0.0, 0.09)
  headBone.add(wattle)
  const tail = M(new THREE.ConeGeometry(0.09, 0.16, 5), mat, [0.82, 0.8, 0.76])
  tail.rotation.x = -Math.PI / 3
  tail.position.set(0, 0.3, -0.2)
  g.add(tail)
  for (const sx of [-1, 1]) {
    const wing = M(new THREE.SphereGeometry(0.09, 6, 5), mat, [0.85, 0.83, 0.79])
    wing.scale.set(0.5, 0.8, 1.1)
    wing.position.set(sx * 0.15, 0.24, -0.02)
    g.add(wing)
    const leg = M(new THREE.CylinderGeometry(0.012, 0.012, 0.1, 4), mat, [0.9, 0.65, 0.25])
    leg.position.set(sx * 0.06, 0.09, 0.02)
    g.add(leg)
    const foot = M(new THREE.BoxGeometry(0.06, 0.015, 0.08), mat, [0.9, 0.65, 0.25])
    foot.position.set(sx * 0.06, 0.035, 0.045)
    g.add(foot)
  }
  mergeDirectChildren(g)        // body/wings/legs → 1 draw
  mergeDirectChildren(headBone) // head/beak/comb/wattle → 1 draw
  return { group: g, headBone, tail }
}

// ——— Sleeping cat: a loaf with ears and a wrapped tail ———
export function buildCat() {
  const mat = retroMaterial({ map: TEX.white(), hemi: true })
  const g = new THREE.Group()
  const grey = [0.45, 0.44, 0.5]
  const body = M(new THREE.SphereGeometry(0.16, 8, 6), mat, grey)
  body.scale.set(1, 0.62, 1.35)
  body.position.y = 0.1
  g.add(body)
  const head = M(new THREE.SphereGeometry(0.09, 7, 6), mat, grey)
  head.position.set(0, 0.13, 0.17)
  g.add(head)
  for (const sx of [-1, 1]) {
    const ear = M(new THREE.ConeGeometry(0.03, 0.05, 4), mat, grey)
    ear.position.set(sx * 0.05, 0.2, 0.15)
    g.add(ear)
  }
  const tail = M(new THREE.TorusGeometry(0.13, 0.025, 5, 10, Math.PI * 1.2), mat, grey)
  tail.rotation.x = -Math.PI / 2
  tail.position.set(0, 0.045, -0.02)
  g.add(tail)
  mergeDirectChildren(g)
  const loaf = g.children.find((o) => o.isMesh)
  return { group: g, body: loaf ?? g }
}

// ——— Nib the garden gnome: red hat, spread-eagle asleep on the moss ———
export function buildGnome() {
  // painted texels, not flat fills (Rule 8) — plaster carries brushed wear
  const mat = retroMaterial({ map: TEX.plaster(), hemi: true })
  const g = new THREE.Group()
  const body = M(new THREE.SphereGeometry(0.14, 8, 6), mat, [0.25, 0.35, 0.5])
  body.scale.set(1, 0.7, 1.3)
  body.position.set(0, 0.09, 0)
  g.add(body)
  const head = M(new THREE.SphereGeometry(0.09, 7, 6), mat, [0.85, 0.7, 0.58])
  head.position.set(0, 0.1, 0.2)
  g.add(head)
  const beard = M(new THREE.ConeGeometry(0.07, 0.12, 6), mat, [0.9, 0.9, 0.9])
  beard.rotation.x = Math.PI / 2.3
  beard.position.set(0, 0.06, 0.28)
  g.add(beard)
  const hatBone = new THREE.Group()
  hatBone.position.set(0, 0.13, 0.24)
  g.add(hatBone)
  // the hat is the zone's warm accent: plain ambient + faint ember emissive so
  // the cobalt hemisphere light can't crush the red to maroon
  const hatMat = retroMaterial({ map: TEX.plaster(), emissive: '#2a0805' })
  const hat = M(new THREE.ConeGeometry(0.1, 0.32, 7), hatMat, [0.95, 0.2, 0.13])
  hat.rotation.x = Math.PI / 2.6
  hat.position.set(0, 0.05, 0.08)
  hatBone.add(hat)
  for (const sx of [-1, 1]) {
    const arm = M(new THREE.CylinderGeometry(0.03, 0.035, 0.22, 5), mat, [0.25, 0.35, 0.5])
    arm.rotation.z = Math.PI / 2
    arm.position.set(sx * 0.2, 0.06, 0.05)
    g.add(arm)
    const leg = M(new THREE.CylinderGeometry(0.035, 0.04, 0.24, 5), mat, [0.3, 0.26, 0.2])
    leg.rotation.z = Math.PI / 2
    leg.rotation.y = sx * 0.5
    leg.position.set(sx * 0.12, 0.05, -0.16)
    g.add(leg)
    const boot = M(new THREE.SphereGeometry(0.045, 5, 4), mat, [0.2, 0.16, 0.12])
    boot.position.set(sx * 0.22, 0.05, -0.22)
    g.add(boot)
  }
  mergeDirectChildren(g) // body parts → 1 draw (hat stays on its bone)
  return { group: g, hatBone }
}

// Shared ghost material: translucent, softly self-lit, never scary (Rule 10).
function ghostMaterial(opacity = 0.38) {
  return retroMaterial({ map: TEX.white(), transparent: true, opacity, depthWrite: false, emissive: '#16282e' })
}

// ——— The Curator: translucent Highborne ghost, drifting her patrol ———
export function buildCurator() {
  const mat = ghostMaterial(0.4)
  const g = new THREE.Group()
  const robePts = []
  for (const [r, y] of [[0.34, 0], [0.3, 0.35], [0.22, 0.8], [0.2, 1.1], [0.13, 1.35]]) robePts.push(new THREE.Vector2(r, y))
  const robe = M(new THREE.LatheGeometry(robePts, 9), mat, [0.6, 0.85, 0.9])
  g.add(robe)
  const head = M(new THREE.SphereGeometry(0.14, 8, 6), mat, [0.7, 0.9, 0.95])
  head.position.y = 1.52
  g.add(head)
  const hair = M(new THREE.ConeGeometry(0.15, 0.5, 7), mat, [0.5, 0.8, 0.85])
  hair.rotation.x = Math.PI
  hair.position.set(0, 1.45, -0.1)
  g.add(hair)
  const armBoneL = new THREE.Group(); armBoneL.position.set(-0.2, 1.15, 0); g.add(armBoneL)
  const armBoneR = new THREE.Group(); armBoneR.position.set(0.2, 1.15, 0); g.add(armBoneR)
  for (const [bone, sx] of [[armBoneL, -1], [armBoneR, 1]]) {
    const arm = M(new THREE.CylinderGeometry(0.045, 0.055, 0.5, 6), mat, [0.6, 0.85, 0.9])
    arm.position.y = -0.25
    bone.add(arm)
  }
  const spine = g // bow by rotating the whole drift body
  return { group: g, armL: armBoneL, armR: armBoneR, spine }
}

// ——— The Pale King: asleep on his throne, crown tilted ———
export function buildPaleKing() {
  const mat = ghostMaterial(0.42)
  const g = new THREE.Group()
  const robePts = []
  for (const [r, y] of [[0.4, 0], [0.36, 0.3], [0.3, 0.6], [0.24, 0.85]]) robePts.push(new THREE.Vector2(r, y))
  const body = M(new THREE.LatheGeometry(robePts, 9), mat, [0.75, 0.78, 0.85])
  g.add(body)
  const head = M(new THREE.SphereGeometry(0.16, 8, 6), mat, [0.8, 0.82, 0.88])
  head.position.y = 1.0
  g.add(head)
  const beard = M(new THREE.ConeGeometry(0.12, 0.35, 6), mat, [0.85, 0.87, 0.92])
  beard.rotation.x = Math.PI
  beard.scale.z = 0.6
  beard.position.set(0, 0.82, 0.1)
  g.add(beard)
  // tilted crown — gold must not be crushed by the dark (plain ambient + ember)
  const crownMat = retroMaterial({ map: TEX.white(), emissive: '#2a1e06' })
  const crown = new THREE.Group()
  const band = M(new THREE.CylinderGeometry(0.13, 0.13, 0.07, 8, 1, true), crownMat, [0.85, 0.7, 0.3])
  crown.add(band)
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2
    const spike = M(new THREE.ConeGeometry(0.025, 0.09, 4), crownMat, [0.85, 0.7, 0.3])
    spike.position.set(Math.cos(a) * 0.12, 0.07, Math.sin(a) * 0.12)
    crown.add(spike)
  }
  crown.position.set(0.05, 1.14, 0)
  crown.rotation.z = -0.28 // the tilt
  g.add(crown)
  return { group: g, head, crown }
}

// ——— Ghost cat (the Hall follower-to-be) ———
export function buildGhostCat() {
  const mat = ghostMaterial(0.45)
  const g = new THREE.Group()
  const body = M(new THREE.SphereGeometry(0.13, 8, 6), mat, [0.7, 0.9, 0.9])
  body.scale.set(1, 0.6, 1.3)
  body.position.y = 0.08
  g.add(body)
  const head = M(new THREE.SphereGeometry(0.08, 7, 6), mat, [0.75, 0.92, 0.92])
  head.position.set(0, 0.12, 0.14)
  g.add(head)
  for (const sx of [-1, 1]) {
    const ear = M(new THREE.ConeGeometry(0.025, 0.045, 4), mat, [0.75, 0.92, 0.92])
    ear.position.set(sx * 0.045, 0.18, 0.12)
    g.add(ear)
  }
  const tail = M(new THREE.TorusGeometry(0.11, 0.02, 5, 10, Math.PI), mat, [0.7, 0.9, 0.9])
  tail.rotation.x = -Math.PI / 2
  tail.position.set(0, 0.05, -0.05)
  g.add(tail)
  return { group: g, body }
}

// ——— Gargoyle: very obviously pretending to be a statue ———
export function buildGargoyle() {
  const mat = retroMaterial({ map: TEX.stoneBlock({ name: 'gargstone', base: '#3a3444' }), hemi: true })
  const g = new THREE.Group()
  const body = M(new THREE.SphereGeometry(0.3, 8, 6), mat, [0.9, 0.9, 0.95])
  body.scale.set(0.9, 0.8, 1.05)
  body.position.y = 0.32
  g.add(body)
  const headBone = new THREE.Group()
  headBone.position.set(0, 0.62, 0.12)
  g.add(headBone)
  const head = M(new THREE.SphereGeometry(0.17, 7, 6), mat, [0.9, 0.9, 0.95])
  headBone.add(head)
  for (const sx of [-1, 1]) {
    const horn = M(new THREE.ConeGeometry(0.04, 0.14, 5), mat, [0.85, 0.85, 0.9])
    horn.position.set(sx * 0.1, 0.15, 0)
    horn.rotation.z = -sx * 0.35
    headBone.add(horn)
    const wingBone = new THREE.Group()
    wingBone.position.set(sx * 0.26, 0.45, -0.08)
    g.add(wingBone)
    const wing = M(new THREE.BoxGeometry(0.34, 0.5, 0.05), mat, [0.82, 0.82, 0.88])
    wing.position.set(sx * 0.15, 0.05, 0)
    wing.rotation.z = sx * 0.5
    wingBone.add(wing)
    if (sx === 1) g.userData.wingR = wingBone
    const claw = M(new THREE.SphereGeometry(0.07, 5, 4), mat, [0.85, 0.85, 0.9])
    claw.position.set(sx * 0.16, 0.05, 0.22)
    g.add(claw)
  }
  const snout = M(new THREE.ConeGeometry(0.06, 0.12, 5), mat, [0.88, 0.88, 0.92])
  snout.rotation.x = Math.PI / 2
  snout.position.set(0, -0.02, 0.2)
  headBone.add(snout)
  return { group: g, headBone, wingR: g.userData.wingR }
}

// ——— Mote: a moss-covered tortoise the size of a table ———
export function buildMote() {
  const shellMat = retroMaterial({ map: TEX.grass({ name: 'moteMoss', a: '#2c4432', b: '#4a6e50' }), hemi: true })
  const skinMat = retroMaterial({ map: TEX.white(), hemi: true })
  const g = new THREE.Group()
  const shell = M(new THREE.SphereGeometry(0.9, 10, 7, 0, Math.PI * 2, 0, Math.PI / 2), shellMat, [0.85, 0.95, 0.85])
  shell.scale.set(1, 0.62, 1.15)
  shell.position.y = 0.22
  g.add(shell)
  const rim = M(new THREE.CylinderGeometry(0.92, 0.98, 0.14, 12), shellMat, [0.7, 0.8, 0.7])
  rim.scale.z = 1.15
  rim.position.y = 0.2
  g.add(rim)
  const headBone = new THREE.Group()
  headBone.position.set(0, 0.28, 1.1)
  g.add(headBone)
  const head = M(new THREE.SphereGeometry(0.22, 8, 6), skinMat, [0.55, 0.58, 0.42])
  head.scale.set(0.85, 0.8, 1.1)
  headBone.add(head)
  // closed eyes: painted as dark slits via tiny boxes
  for (const sx of [-1, 1]) {
    const eye = M(new THREE.BoxGeometry(0.06, 0.012, 0.02), skinMat, [0.2, 0.2, 0.16])
    eye.position.set(sx * 0.1, 0.06, 0.16)
    headBone.add(eye)
  }
  for (const [sx, sz] of [[-0.6, 0.6], [0.6, 0.6], [-0.6, -0.6], [0.6, -0.6]]) {
    const leg = M(new THREE.CylinderGeometry(0.14, 0.17, 0.24, 7), skinMat, [0.5, 0.53, 0.4])
    leg.position.set(sx, 0.12, sz)
    g.add(leg)
  }
  mergeDirectChildren(g)
  mergeDirectChildren(headBone)
  return { group: g, headBone }
}

// ——— Seabird: tucked-head loaf ———
export function buildSeabird() {
  const mat = retroMaterial({ map: TEX.white(), hemi: true })
  const g = new THREE.Group()
  const body = M(new THREE.SphereGeometry(0.09, 7, 5), mat, [0.88, 0.88, 0.9])
  body.scale.set(1, 0.85, 1.25)
  body.position.y = 0.07
  g.add(body)
  const tail = M(new THREE.ConeGeometry(0.04, 0.09, 4), mat, [0.6, 0.62, 0.66])
  tail.rotation.x = -Math.PI / 2.4
  tail.position.set(0, 0.09, -0.11)
  g.add(tail)
  return { group: g, body }
}

// Blue bottle for Beldam's lap (and the Moon Brew model later).
export function buildBottle({ scale = 1 } = {}) {
  const mat = retroMaterial({ map: TEX.white(), hemi: true, transparent: true, opacity: 0.92 })
  const g = new THREE.Group()
  const body = M(new THREE.CylinderGeometry(0.05 * scale, 0.06 * scale, 0.16 * scale, 7), mat, [0.25, 0.4, 0.62])
  body.position.y = 0.08 * scale
  g.add(body)
  const neck = M(new THREE.CylinderGeometry(0.018 * scale, 0.028 * scale, 0.08 * scale, 6), mat, [0.25, 0.4, 0.62])
  neck.position.y = 0.2 * scale
  g.add(neck)
  const label = M(new THREE.CylinderGeometry(0.061 * scale, 0.062 * scale, 0.05 * scale, 7, 1, true), retroMaterial({ map: TEX.white(), hemi: true }), [0.5, 0.68, 0.85])
  label.position.y = 0.08 * scale
  g.add(label)
  return g
}

// ——— NPC behavior wrappers ———

export class NPCSystem {
  constructor(scene, world, hud, ambience, stars) {
    this.scene = scene
    this.world = world
    this.hud = hud
    this.ambience = ambience
    this.stars = stars
    this.rng = worldRNG.fork('npc')
    this.npcs = []
    this.stirred = new Set()
    this.buildAll()
    this.buildRavens()
  }

  buildAll() {
    const w = this.world

    // — Beldam on the Long Bench (Park landmark) —
    const beldam = buildWizard({ tint: '#3a4258', beardLength: 0.62, withStaff: false })
    const bp = w.benchPos
    beldam.group.position.set(bp.x - 0.4, bp.y + 0.16, bp.z)
    beldam.group.rotation.y = 0 // faces the park center (+z)
    this.scene.add(beldam.group)
    const bottle = buildBottle({})
    bottle.position.set(0.12, 0.62, 0.24)
    beldam.group.add(bottle)
    const beldamAnim = makeAnimState()
    beldamAnim.action = 'sit'
    this.beldam = { rig: beldam, anim: beldamAnim, snoreT: this.rng.range(2, 5), stirT: 0, bottle }
    this.npcs.push({ kind: 'beldam', update: (dt, t) => this.updateBeldam(dt, t) })

    // — Chickens (5) on the village street + one sleeping cat —
    this.chickens = []
    for (let i = 0; i < 5; i++) {
      const c = buildChicken()
      const x = this.rng.range(96, 132)
      const z = this.world.streetZAt ? this.world.streetZAt(x) : 0
      c.group.position.set(x, w.heightAt(x, z), z + this.rng.range(-2.5, 2.5))
      c.group.rotation.y = this.rng.range(0, Math.PI * 2)
      this.scene.add(c.group)
      this.chickens.push({
        rig: c,
        state: 'idle',
        t: this.rng.range(0.5, 2),
        target: null,
        home: { x, z: c.group.position.z },
        cluckT: this.rng.range(2, 9),
        peckPhase: 0,
      })
    }
    this.npcs.push({ kind: 'chickens', update: (dt, t, player) => this.updateChickens(dt, t, player) })

    const cat = buildCat()
    const catX = 112, catZ = w.streetZAt ? w.streetZAt(112) + 8.5 - 4.2 : 6
    cat.group.position.set(catX, w.heightAt(catX, catZ) + 1.55, catZ)
    cat.group.rotation.y = Math.PI * 0.9
    this.scene.add(cat.group)
    this.cat = cat
    this.npcs.push({ kind: 'cat', update: (dt, t) => { this.cat.body.scale.y = 0.62 + Math.sin(t * 1.4) * 0.02 } })

    // — The Curator drifting her colonnade patrol (Ruins) —
    const curator = buildCurator()
    this.scene.add(curator.group)
    this.curator = {
      rig: curator,
      waypoints: [[-96, 3], [-112, 6.5], [-126, 2.5], [-121, -7], [-104, -5.5]],
      wp: 0, pauseT: 0, bowT: 0, bowedFor: new Set(), saidLine: false,
    }
    curator.group.position.set(-96, w.heightAt(-96, 3) + 0.25, 3)
    this.npcs.push({ kind: 'curator', update: (dt, t, player) => this.updateCurator(dt, t, player) })

    // — The Pale King asleep on his throne + ghost cat on his lap (Hall) —
    const king = buildPaleKing()
    king.group.position.set(-110, 2.3, 168.2)
    king.group.rotation.y = Math.PI // faces down the hall (−z)
    this.scene.add(king.group)
    this.king = king
    const gcat = buildGhostCat()
    gcat.group.position.set(0.05, 0.55, 0.3)
    king.group.add(gcat.group)
    this.ghostCat = { rig: gcat, state: 'lap' } // follower behavior lands in M6
    this.npcs.push({
      kind: 'king', update: (dt, t, player) => {
        this.king.head.position.y = 1.0 + Math.sin(t * 0.45) * 0.015
        this.king.head.rotation.x = 0.3 + Math.sin(t * 0.45) * 0.03
        const cat = this.ghostCat
        if (cat.state === 'lap') {
          cat.rig.body.scale.y = 0.6 + Math.sin(t * 1.2) * 0.03
        } else if (cat.state === 'follow' && this.catNetTarget) {
          // co-op client: the cat is host-owned (6.4) — glide to the host's cat
          const g = cat.rig.group
          const [tx, , tz] = this.catNetTarget
          const d = Math.hypot(tx - g.position.x, tz - g.position.z)
          if (d > 8) g.position.set(tx, 0, tz)
          else { g.position.x += (tx - g.position.x) * Math.min(1, dt * 6); g.position.z += (tz - g.position.z) * Math.min(1, dt * 6) }
          if (d > 0.1) g.rotation.y = Math.atan2(tx - g.position.x, tz - g.position.z)
          g.position.y = this.world.heightAt(g.position.x, g.position.z)
        } else if (cat.state === 'follow' && player) {
          // global follower (6.4): follow-at-2m, teleport if >20m, purr sometimes
          const g = cat.rig.group
          const dx = player.pos.x - g.position.x, dz = player.pos.z - g.position.z
          const d = Math.hypot(dx, dz)
          if (d > 20) {
            g.position.set(player.pos.x - (dx / d) * 2, player.pos.y, player.pos.z - (dz / d) * 2)
          } else if (d > 2) {
            const sp = Math.min(3.4, 1.4 + (d - 2) * 0.6)
            g.position.x += (dx / d) * sp * dt
            g.position.z += (dz / d) * sp * dt
            g.rotation.y = Math.atan2(dx, dz)
            g.position.y = this.world.heightAt(g.position.x, g.position.z) + Math.abs(Math.sin(t * 6)) * 0.06
          } else {
            g.position.y = this.world.heightAt(g.position.x, g.position.z)
          }
          cat.purrT = (cat.purrT ?? 8) - dt
          if (cat.purrT <= 0 && d < 3.5) { cat.purrT = this.rng.range(9, 16); catPurr(1.8) }
        }
      },
    })

    // — The gargoyle on the gatehouse (statue... allegedly) (Gloomspire) —
    const garg = buildGargoyle()
    const gp = w.gargoylePos ?? new THREE.Vector3(-107.2, w.heightAt(-110, 103) + 6.6, 103)
    garg.group.position.copy(gp)
    garg.group.rotation.y = Math.PI // watches the causeway approach
    this.scene.add(garg.group)
    this.gargoyle = { rig: garg, bold: false, waveT: 0 }
    this.npcs.push({
      kind: 'gargoyle',
      update: (dt, t, player, camera) => {
        // very obviously pretending to be a statue: it watches whoever isn't
        // watching IT (Part 3.2.5). Snap back when observed.
        const g = this.gargoyle
        const head = g.rig.headBone
        // the wave-back (co-op moment): one wing lifts and waves ~2s, then it
        // SNAPS back to being a statue like nothing happened
        if (g.waveT > 0) {
          g.waveT -= dt
          const w = g.rig.wingR
          if (w) {
            if (g.waveT <= 0) { w.rotation.set(0, 0, 0) } // caught nothing. statue.
            else {
              const f = Math.min(1, (2.0 - g.waveT) * 4)
              w.rotation.z = -f * 0.9 + Math.sin(t * 10) * 0.25 * f
              w.rotation.x = -f * 0.3
            }
          }
          return
        }
        if (!player || !camera) { return }
        const gp = g.rig.group.position
        const pd = Math.hypot(player.pos.x - gp.x, player.pos.z - gp.z)
        let watching = false
        if (pd < 40) {
          // is the camera looking at the gargoyle?
          _v.set(gp.x - camera.position.x, 0, gp.z - camera.position.z).normalize()
          _v2.set(0, 0, -1).applyQuaternion(camera.quaternion)
          _v2.y = 0
          _v2.normalize()
          const looked = _v.dot(_v2) > 0.75 // within ~40°
          if (!looked) {
            // slowly turn the head toward the player
            const want = Math.atan2(player.pos.x - gp.x, player.pos.z - gp.z) - g.rig.group.rotation.y
            head.rotation.y += (want - head.rotation.y) * Math.min(1, dt * (g.bold ? 1.2 : 0.5))
            watching = true
          } else {
            // caught! ease back to statue pose (a touch too quickly)
            head.rotation.y += (0 - head.rotation.y) * Math.min(1, dt * 6)
          }
        } else {
          head.rotation.y += (0 - head.rotation.y) * Math.min(1, dt * 2)
        }
        g.watching = watching
      },
    })

    // — Mote the mossy tortoise beside the Mosswood path —
    const mote = buildMote()
    mote.group.position.set(66, w.heightAt(66, 106.5), 106.5)
    mote.group.rotation.y = -0.5
    this.scene.add(mote.group)
    this.mote = { rig: mote, snoreT: this.rng.range(3, 7) }
    this.npcs.push({
      kind: 'mote', update: (dt, t) => {
        mote.group.scale.y = 1 + Math.sin(t * 0.5) * 0.015 // slow tortoise breath
        if (this.moteStir > 0) {
          // one eye opens, head lifts a little, then back to sleep (3.2.7)
          this.moteStir -= dt
          const f = Math.sin(Math.min(1, (8 - this.moteStir) / 1.5) * Math.PI * 0.5)
          mote.headBone.position.y = 0.28 + f * 0.22
          mote.headBone.rotation.x = -f * 0.25
          return
        }
        mote.headBone.position.y = Math.max(0.28, mote.headBone.position.y - dt * 0.1)
        this.mote.snoreT -= dt
        if (this.mote.snoreT <= 0) {
          this.mote.snoreT = this.rng.range(5, 9)
          this.ambience.spawnZ(mote.group.position.x, mote.group.position.y + 0.9, mote.group.position.z + 1)
        }
      },
    })

    // — Seabird colony, heads tucked (Isle cove) —
    this.seabirds = []
    for (let i = 0; i < 6; i++) {
      const bird = buildSeabird()
      const a = this.rng.range(-0.6, 1.2)
      const bx = 12 + Math.cos(a) * this.rng.range(2, 7)
      const bz = -137 + Math.sin(a) * this.rng.range(2, 6)
      bird.group.position.set(bx, w.heightAt(bx, bz), bz)
      bird.group.rotation.y = this.rng.range(0, Math.PI * 2)
      this.scene.add(bird.group)
      this.seabirds.push(bird)
    }
    this.npcs.push({
      kind: 'seabirds', update: (dt, t) => {
        this.seabirds.forEach((b, i) => { b.body.scale.y = 0.85 + Math.sin(t * 1.3 + i * 2) * 0.03 })
      },
    })

    // — Sleeping sailors in hammocks at the cove (adapted from keep interior — D9) —
    this.hammocks = []
    for (const [hx, hz, ry] of [[6, -141, 0.5], [17, -133, -0.8]]) {
      const hg = new THREE.Group()
      const mats = sharedNpcMats()
      for (const sx of [-1, 1]) {
        const post = M(new THREE.CylinderGeometry(0.06, 0.08, 1.4, 6), mats.plank, [1, 1, 1])
        post.position.set(sx * 1.1, 0.7, 0)
        hg.add(post)
      }
      const cloth = M(new THREE.CylinderGeometry(0.42, 0.42, 2.0, 8, 1, true, Math.PI, Math.PI), mats.plank, [0.75, 0.72, 0.6])
      cloth.rotation.z = Math.PI / 2
      cloth.position.y = 0.82
      cloth.scale.y = 0.5
      hg.add(cloth)
      const lump = M(new THREE.SphereGeometry(0.3, 7, 5), mats.plank, [0.5, 0.42, 0.5])
      lump.scale.set(1, 0.5, 1.9)
      lump.position.y = 0.86
      hg.add(lump)
      hg.position.set(hx, w.heightAt(hx, hz), hz)
      hg.rotation.y = ry
      this.scene.add(hg)
      this.hammocks.push({ group: hg, snoreT: this.rng.range(2, 8) })
    }
    this.npcs.push({
      kind: 'sailors', update: (dt) => {
        for (const h of this.hammocks) {
          h.snoreT -= dt
          if (h.snoreT <= 0) {
            h.snoreT = this.rng.range(4, 9)
            this.ambience.spawnZ(h.group.position.x, h.group.position.y + 1.3, h.group.position.z)
          }
        }
      },
    })

    // — Nib on the rooftop garden, in the lantern's glow (his red hat is the accent) —
    const nib = buildGnome()
    const nx = 118.3, nz = (this.world.streetZAt ? this.world.streetZAt(118.3) : 0) - 10.2
    nib.group.position.set(nx, w.heightAt(nx, nz) + 0.05, nz)
    nib.group.rotation.y = 0.7
    nib.group.scale.setScalar(1.45)
    this.scene.add(nib.group)
    this.nib = { rig: nib, snoreT: this.rng.range(2, 6) }
    this.npcs.push({ kind: 'nib', update: (dt, t) => this.updateNib(dt, t) })
  }

  // stir hook: world.onKindle calls this with the light
  onKindle(light) {
    if (light.id === 'park-bench-lamp' && !this.stirred.has('beldam')) {
      this.stirred.add('beldam')
      this.beldam.stirT = 7
      this.hud.say('...ah. The Lamplighter’s up. Roads are dark, friend. The moon won’t wait... zzz', 6.5)
    }
  }

  // AA.5: the first kindle advertises itself — a few beats after control,
  // Beldam murmurs the pointer at the cold lamp beside his bench. Once per
  // night; skipped if the player already found it.
  nightIntro() { this.introT = 7 }
  updateIntro(dt) {
    if (!(this.introT > 0)) return
    this.introT -= dt
    if (this.introT <= 0 && !this.stirred.has('beldam-intro')) {
      this.stirred.add('beldam-intro')
      const lamp = this.world.lights.find((l) => l.id === 'park-bench-lamp')
      if (lamp && !lamp.kindled) {
        this.beldam.stirT = 6
        this.hud.say('...mm. lamp went cold again. right here, beside my bench, friend... zzz', 6)
      }
    }
  }

  // scripted stirs on zone completion (6.1/6.4) — one per night, logged
  onZoneComplete(zone) {
    if (this.stirred.has('zone:' + zone)) return
    this.stirred.add('zone:' + zone)
    this.stirLog = this.stirLog || []
    this.stirLog.push({ zone, t: performance.now() })
    if (zone === 'park' && !this.stirred.has('beldam')) {
      this.stirred.add('beldam')
      this.beldam.stirT = 7
      this.hud.say('...ah. The Lamplighter’s up. Roads are dark, friend. The moon won’t wait... zzz', 6.5)
    } else if (zone === 'village') {
      // the chickens approve, briefly and impeccably
      for (const ch of this.chickens) { ch.cluckT = this.rng.range(0.1, 1.2) }
    } else if (zone === 'rooftops') {
      this.nibTalk = 3
      this.nibTalkT = 0
      if (this.stars) this.stars.showConstellations(false)
      this.hud.say('Nib (asleep): ...the Ladle... the Lantern... the old Tortoise, right where I left them...', 7)
    } else if (zone === 'ruins') {
      this.hud.say('The Curator inclines her head as she drifts past.', 4)
    } else if (zone === 'gloomspire') {
      this.gargoyle.bold = true // it pretends a little less carefully now
    } else if (zone === 'hall') {
      // the ghost cat wakes — and only the cat (Part 3.2.6)
      this.wakeGhostCat(false)
    } else if (zone === 'mosswood') {
      this.moteStir = 8
      this.hud.say('Mote: Through the gate is the same forest. It’s always the same forest. That’s the secret. Goodnight.', 7.5)
    } else if (zone === 'isle') {
      // seabirds shuffle their feathers; the keep brazier owns the finale
      for (const b of this.seabirds) b.group.rotation.y += this.rng.range(-0.4, 0.4)
    }
  }

  updateBeldam(dt, t) {
    const b = this.beldam
    applyPose(b.rig, b.anim, t)
    b.anim.breatheT += dt
    const bones = b.rig.bones
    if (b.stirT > 0) {
      // half-wake: head rises, faces the player-ish, mumbles (subtitle shown)
      b.stirT -= dt
      bones.head.rotation.x = -0.1
      bones.head.rotation.z = Math.sin(t * 1.2) * 0.03
    } else {
      // deep sleep: head slumped, slow loll
      bones.head.rotation.x = 0.38 + Math.sin(t * 0.5) * 0.04
      bones.head.rotation.z = 0.16 + Math.sin(t * 0.35) * 0.08
      b.snoreT -= dt
      if (b.snoreT <= 0) {
        b.snoreT = this.rng.range(3.5, 6)
        const hp = b.rig.bones.head.getWorldPosition(_v)
        this.ambience.spawnZ(hp.x + 0.15, hp.y + 0.25, hp.z + 0.1)
        snore()
      }
    }
  }

  updateCurator(dt, t, player) {
    const c = this.curator
    const g = c.rig.group
    // drift bob, always
    g.position.y = this.world.heightAt(g.position.x, g.position.z) + 0.25 + Math.sin(t * 0.9) * 0.06

    // bow to passing players once the sconces burn (Part 3.2.4)
    const sconcesLit = this.world.lights.filter((l) => l.id.startsWith('ruins-sconce') && l.kindled).length === 4
    if (c.bowT > 0) {
      c.bowT -= dt
      c.rig.spine.rotation.x = Math.sin(Math.min(1, (2 - c.bowT) / 0.6) * Math.PI * 0.5) * 0.5
      if (c.bowT <= 0) c.rig.spine.rotation.x = 0
      return
    }
    if (sconcesLit && player) {
      const pd = Math.hypot(player.pos.x - g.position.x, player.pos.z - g.position.z)
      const key = Math.floor(t / 20) // at most one bow per 20s window
      if (pd < 3.5 && !c.bowedFor.has(key)) {
        c.bowedFor.add(key)
        c.bowT = 2
        if (!c.saidLine) {
          c.saidLine = true
          this.hud.say('The party ended ten thousand years ago. The cleaning, however...', 5.5)
        }
        return
      }
    }

    if (c.pauseT > 0) {
      // dusting: gentle alternating arm sweeps over the fallen stones
      c.pauseT -= dt
      c.rig.armL.rotation.x = -0.9 + Math.sin(t * 2.2) * 0.35
      c.rig.armR.rotation.x = -0.7 + Math.sin(t * 2.2 + Math.PI) * 0.35
      return
    }
    c.rig.armL.rotation.x = -0.25
    c.rig.armR.rotation.x = -0.25
    const [wx, wz] = c.waypoints[c.wp]
    const dx = wx - g.position.x, dz = wz - g.position.z
    const d = Math.hypot(dx, dz)
    if (d < 0.4) {
      c.wp = (c.wp + 1) % c.waypoints.length
      c.pauseT = this.rng.range(2.5, 4.5)
      return
    }
    const want = Math.atan2(dx, dz)
    let dy = want - g.rotation.y
    while (dy > Math.PI) dy -= Math.PI * 2
    while (dy < -Math.PI) dy += Math.PI * 2
    g.rotation.y += dy * Math.min(1, dt * 3)
    g.position.x += (dx / d) * 0.55 * dt
    g.position.z += (dz / d) * 0.55 * dt
  }

  updateNib(dt, t) {
    // hat rises and falls with the snore (Part 3.2.3)
    this.nib.rig.hatBone.scale.setScalar(1 + Math.sin(t * 1.1) * 0.06)
    this.nib.rig.group.position.y += Math.sin(t * 1.1) * 0.0006
    this.nib.snoreT -= dt
    if (this.nib.snoreT <= 0) {
      this.nib.snoreT = this.rng.range(3, 6)
      const p = this.nib.rig.group.position
      this.ambience.spawnZ(p.x, p.y + 0.5, p.z)
    }
  }

  // Wake the ghost cat off the Pale King's lap (hall completion, or a late-join
  // snapshot that says the night already got that far — then quiet=true)
  wakeGhostCat(quiet = false) {
    if (this.ghostCat.state === 'follow') return
    this.ghostCat.state = 'follow'
    const wp = this.ghostCat.rig.group.getWorldPosition(new THREE.Vector3())
    this.king.group.remove(this.ghostCat.rig.group)
    this.ghostCat.rig.group.position.copy(wp)
    this.scene.add(this.ghostCat.rig.group)
    if (!quiet) {
      catPurr(2.2)
      this.hud.say('The ghost cat stretches, hops down, and decides you are warm.', 5)
    }
  }

  // Mount a chicken on a player's head (Part 3.2.2 co-op moment) — applied
  // identically on every client from the same event (chIdx + playerId).
  mountChicken(chIdx, playerId) {
    const ch = this.chickens[chIdx]
    const p = (this.playersProvider ? this.playersProvider() : []).find((x) => x.id === playerId)
    if (!ch || !p || ch.state === 'mount') return false
    ch.state = 'mount'
    ch.riderId = playerId
    const g = ch.rig.group
    g.parent?.remove(g)
    p.rig.bones.head.add(g)
    g.position.set(0, 0.42, 0.02)
    g.rotation.set(0, 0, 0)
    cluck(false)
    return true
  }

  // a departing rider (disconnect fade) sets their chicken down, unharmed
  rescueChickens(rig) {
    for (const ch of this.chickens) {
      if (ch.state !== 'mount') continue
      let p = ch.rig.group.parent, riding = false
      while (p) { if (p === rig.group) { riding = true; break } p = p.parent }
      if (!riding) continue
      const wp = ch.rig.group.getWorldPosition(new THREE.Vector3())
      ch.rig.group.parent.remove(ch.rig.group)
      ch.rig.group.position.set(wp.x, this.world.heightAt(wp.x, wp.z), wp.z)
      ch.rig.group.rotation.set(0, this.rng.range(0, Math.PI * 2), 0)
      this.scene.add(ch.rig.group)
      ch.state = 'idle'
      ch.t = 1.5
      ch.riderId = null
      ch.followT = 0
      cluck(true) // indignant, briefly
    }
  }

  updateChickens(dt, t, player) {
    // full lobby (local + remotes) for follow-detection and mounting
    const lobby = this.playersProvider ? this.playersProvider() : (player ? [{ id: 0, rig: null, pos: player.pos }] : [])
    for (const ch of this.chickens) {
      const g = ch.rig.group
      ch.t -= dt
      ch.cluckT -= dt

      if (ch.state === 'mount') {
        // riding: gentle head-settle bob, occasional content cluck
        ch.rig.headBone.rotation.x = Math.sin(t * 2.4) * 0.06
        if (ch.cluckT <= 0) { ch.cluckT = this.rng.range(7, 15); cluck(false) }
        continue
      }

      // "followed" (3.2.2): a player keeping gentle company — inside 4m but
      // outside flee range — for 8s earns a head-rider. Authority-side only.
      let follower = null
      for (const p of lobby) {
        const d = Math.hypot(p.pos.x - g.position.x, p.pos.z - g.position.z)
        if (d > 2.1 && d < 4) { follower = p; break }
      }
      if (follower && (!this.chickenAuthority || this.chickenAuthority())) {
        ch.followT = (ch.followBy === follower.id ? (ch.followT ?? 0) : 0) + dt
        ch.followBy = follower.id
        if (ch.followT > 8 && this.onChickenMount) {
          ch.followT = -999 // one shot; the event mounts it
          this.onChickenMount(this.chickens.indexOf(ch), follower.id)
        }
      } else if (!follower) { ch.followT = 0; ch.followBy = null }

      const pd = player ? Math.hypot(player.pos.x - g.position.x, player.pos.z - g.position.z) : 99

      // flee takes priority: player within 2m → run away, then forget
      if (pd < 2 && ch.state !== 'flee') {
        ch.state = 'flee'
        ch.t = 1.1
        const ax = g.position.x - player.pos.x, az = g.position.z - player.pos.z
        const l = Math.hypot(ax, az) || 1
        ch.target = { x: g.position.x + (ax / l) * 2.4, z: g.position.z + (az / l) * 2.4 }
        cluck(true)
      }

      if (ch.state === 'idle') {
        ch.rig.headBone.rotation.x = Math.sin(t * 2.1 + ch.peckPhase) * 0.08
        if (ch.t <= 0) {
          const roll = this.rng.next()
          if (roll < 0.45) { ch.state = 'peck'; ch.t = this.rng.range(0.7, 1.3); ch.peckPhase = 0 }
          else {
            ch.state = 'walk'
            ch.t = this.rng.range(1.5, 3.2)
            const a = this.rng.range(0, Math.PI * 2)
            ch.target = { x: ch.home.x + Math.cos(a) * this.rng.range(1, 4), z: ch.home.z + Math.sin(a) * this.rng.range(1, 3) }
          }
        }
      } else if (ch.state === 'peck') {
        ch.peckPhase += dt * 14
        ch.rig.headBone.rotation.x = Math.max(0, Math.sin(ch.peckPhase)) * 0.9
        if (ch.t <= 0) { ch.state = 'idle'; ch.t = this.rng.range(0.8, 2.4); ch.rig.headBone.rotation.x = 0 }
      } else if (ch.state === 'walk' || ch.state === 'flee') {
        const speed = ch.state === 'flee' ? 2.3 : 0.8
        const dx = ch.target.x - g.position.x, dz = ch.target.z - g.position.z
        const d = Math.hypot(dx, dz)
        if (d > 0.15 && ch.t > 0) {
          const wantYaw = Math.atan2(dx, dz)
          let dy = wantYaw - g.rotation.y
          while (dy > Math.PI) dy -= Math.PI * 2
          while (dy < -Math.PI) dy += Math.PI * 2
          g.rotation.y += dy * Math.min(1, dt * 8)
          g.position.x += (dx / d) * speed * dt
          g.position.z += (dz / d) * speed * dt
          g.position.y = this.world.heightAt(g.position.x, g.position.z)
          // strut: head bob + tail wag with steps
          ch.rig.headBone.position.z = 0.14 + Math.sin(t * 14) * 0.035
          ch.rig.tail.rotation.z = Math.sin(t * 10) * 0.15
        } else {
          ch.state = 'idle'
          ch.t = this.rng.range(1, 2.6)
          ch.rig.headBone.position.z = 0.14
        }
      }

      if (ch.cluckT <= 0) { ch.cluckT = this.rng.range(4, 11); if (pd < 26) cluck(false) }
    }
  }

  // Ravens (PRESTIGE O.2): 2–3 world-wide, perched on weathered posts in the
  // open country. They never fly. They turn their heads to track a passing
  // player, and each spends its single caw the first time someone comes close.
  buildRavens() {
    const mats = sharedMats()
    const black = retroMaterial({ map: TEX.white(), hemi: true })
    this.ravens = []
    for (const [rx, rz] of [[58, -28], [-88, 62], [-126, 88]]) {
      const perch = new THREE.Group()
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 1.15, 5), mats.plank)
      ensureVertexColors(post.geometry)
      post.position.y = 0.57
      post.rotation.z = this.rng.range(-0.06, 0.06) // none stand straight
      perch.add(post)
      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.07, 0.07), mats.plank)
      ensureVertexColors(rail.geometry, [0.8, 0.78, 0.75])
      rail.position.set(0.35, 0.88, 0)
      rail.rotation.y = this.rng.range(0, 1)
      perch.add(rail) // a stub of fence the rest of which is long gone
      const bird = new THREE.Group()
      const body = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.3, 6), black)
      ensureVertexColors(body.geometry, [0.1, 0.1, 0.13])
      body.rotation.x = -1.25 // tail up, chest forward
      body.position.y = 0.09
      bird.add(body)
      const head = new THREE.Group()
      const skull = new THREE.Mesh(new THREE.SphereGeometry(0.055, 6, 5), black)
      ensureVertexColors(skull.geometry, [0.12, 0.12, 0.15])
      head.add(skull)
      const beak = new THREE.Mesh(new THREE.ConeGeometry(0.02, 0.07, 5), black)
      ensureVertexColors(beak.geometry, [0.2, 0.19, 0.17])
      beak.rotation.x = Math.PI / 2
      beak.position.z = 0.07
      head.add(beak)
      head.position.set(0, 0.19, 0.08)
      bird.add(head)
      bird.position.y = 1.15
      perch.add(bird)
      const gy = this.world.heightAt(rx, rz)
      perch.position.set(rx, gy, rz)
      this.scene.add(perch)
      this.ravens.push({ perch, head, x: rx, z: rz, cawed: false, idleYaw: this.rng.range(-0.5, 0.5), idleT: this.rng.range(2, 8) })
    }
    this.npcs.push({ kind: 'ravens', update: (dt, t, player) => this.updateRavens(dt, t, player) })
  }

  updateRavens(dt, t, player) {
    for (const r of this.ravens) {
      const d = Math.hypot(player.pos.x - r.x, player.pos.z - r.z)
      if (d < 14) {
        // the head follows the walker — nothing else moves
        const target = Math.atan2(player.pos.x - r.x, player.pos.z - r.z) - r.perch.rotation.y
        r.head.rotation.y += (target - r.head.rotation.y) * Math.min(1, dt * 3.5)
        if (d < 6 && !r.cawed) { r.cawed = true; caw() }
      } else {
        r.idleT -= dt
        if (r.idleT <= 0) { r.idleT = this.rng.range(4, 11); r.idleYaw = this.rng.range(-0.7, 0.7) }
        r.head.rotation.y += (r.idleYaw - r.head.rotation.y) * Math.min(1, dt * 0.8)
      }
    }
  }

  // AA.5 wander-test surface: where the sleepers (and their small comedies) live
  get anchors() {
    const a = []
    const push = (obj) => {
      const p = obj?.rig?.group?.position
      if (p) a.push({ x: p.x, z: p.z })
    }
    push(this.beldam); push(this.nib); push(this.mote); push(this.curator)
    push(this.king); push(this.gargoyle)
    if (this.cat?.group) a.push({ x: this.cat.group.position.x, z: this.cat.group.position.z })
    for (const ch of this.chickens ?? []) if (ch.rig?.group) a.push({ x: ch.rig.group.position.x, z: ch.rig.group.position.z })
    for (const r of this.ravens ?? []) a.push({ x: r.x, z: r.z })
    return a
  }

  update(dt, t, player, camera) {
    for (const n of this.npcs) n.update(dt, t, player, camera)
    this.updateIntro(dt)
    // Nib's sleep-talk pacing
    if (this.nibTalk > 0) {
      this.nibTalkT = (this.nibTalkT ?? 0) + dt
      if (this.nibTalkT > 8 && this.nibTalk === 3) { this.nibTalk = 0 }
    }
  }
}

const _v = new THREE.Vector3()
const _v2 = new THREE.Vector3()
