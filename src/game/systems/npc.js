// Sleepers & ambient NPCs (MASTER_PROMPT 6.4, Rule 5: nobody is awake).
// Idle loops + one scripted stir per night. Chickens are the only ambulatory
// NPCs in the game and must be impeccable.

import * as THREE from 'three'
import { buildWizard } from '../art/characters.js'
import { retroMaterial, ensureVertexColors } from '../art/materials.js'
import * as TEX from '../art/textures.js'
import { worldRNG } from '../core/rng.js'
import { applyPose, makeAnimState } from './anim.js'
import { cluck, snore } from '../audio/sfx.js'

function M(geo, mat, tint) {
  ensureVertexColors(geo, tint)
  return new THREE.Mesh(geo, mat)
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
  return { group: g, body }
}

// ——— Nib the garden gnome: red hat, spread-eagle asleep on the moss ———
export function buildGnome() {
  const mat = retroMaterial({ map: TEX.white(), hemi: true })
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
  const hatMat = retroMaterial({ map: TEX.white(), emissive: '#2a0805' })
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
  return { group: g, hatBone }
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
  constructor(scene, world, hud, ambience) {
    this.scene = scene
    this.world = world
    this.hud = hud
    this.ambience = ambience
    this.rng = worldRNG.fork('npc')
    this.npcs = []
    this.stirred = new Set()
    this.buildAll()
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

  updateChickens(dt, t, player) {
    for (const ch of this.chickens) {
      const g = ch.rig.group
      ch.t -= dt
      ch.cluckT -= dt
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

  update(dt, t, player) {
    for (const n of this.npcs) n.update(dt, t, player)
  }
}

const _v = new THREE.Vector3()
