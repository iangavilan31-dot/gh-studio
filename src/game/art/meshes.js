// Mesh factory (MASTER_PROMPT 7.2): parameterized builders from primitives.
// Builders return groups of meshes sharing the retro material; animated bits
// (flames, halos) are registered by the world for per-frame updates.

import * as THREE from 'three'
import { retroMaterial, ensureVertexColors } from './materials.js'
import * as TEX from './textures.js'

function M(geo, mat) { return new THREE.Mesh(ensureVertexColors(geo), mat) }

// shared materials (created lazily so textures generate once)
let _mats = null
export function sharedMats() {
  if (_mats) return _mats
  _mats = {
    iron: retroMaterial({ map: TEX.iron() }),
    bark: retroMaterial({ map: TEX.bark() }),
    plank: retroMaterial({ map: TEX.plank() }),
    canopy: retroMaterial({ map: TEX.canopy(), alphaTest: 0.5, wind: 0.18, side: THREE.DoubleSide }),
    glassWarm: retroMaterial({ map: TEX.white(), emissive: 0xc08a30, transparent: true, opacity: 0.45, depthWrite: false }),
    flame: retroMaterial({ map: TEX.flameSheet(), emissive: 0xffffff, alphaTest: 0.4 }),
    halo: (() => { const m = retroMaterial({ map: TEX.glowDot({ color: '#e8a84a' }), transparent: true, depthWrite: false, opacity: 0.55 }); m.blending = THREE.AdditiveBlending; return m })(),
    pool: (() => { const m = retroMaterial({ map: TEX.glowDot({ color: '#e8a84a' }), transparent: true, depthWrite: false, opacity: 0.4 }); m.blending = THREE.AdditiveBlending; return m })(),
  }
  return _mats
}

// Deciduous tree: bark trunk + crossed alpha canopy cards. ~large scale param.
export function tree({ rng, height = 6, trunkR = 0.6, canopyR = 4.5, cards = 4 } = {}) {
  const mats = sharedMats()
  const g = new THREE.Group()
  const trunk = M(new THREE.CylinderGeometry(trunkR * 0.55, trunkR, height, 7), mats.bark)
  trunk.position.y = height / 2
  g.add(trunk)
  for (let i = 0; i < cards; i++) {
    const card = M(new THREE.PlaneGeometry(canopyR * 2, canopyR * 1.55), mats.canopy)
    card.position.y = height + canopyR * 0.35
    card.rotation.y = (i / cards) * Math.PI + (rng ? rng.range(-0.2, 0.2) : 0)
    card.rotation.z = rng ? rng.range(-0.12, 0.12) : 0
    g.add(card)
  }
  g.userData.collider = { r: trunkR + 0.1, h: height }
  return g
}

// Iron park lamp with open cage. Kindle-state parts (flame/halo/glass/pool)
// get their OWN materials (never .clone() a retro material — that severs the
// shared global fog/ambient uniform objects; always construct via retroMaterial).
export function lampPost({ height = 3.0, lit = true } = {}) {
  const mats = sharedMats()
  const g = new THREE.Group()
  g.add((() => { const m = M(new THREE.CylinderGeometry(0.07, 0.11, height, 6), mats.iron); m.position.y = height / 2; return m })())
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4
    const bar = M(new THREE.BoxGeometry(0.03, 0.5, 0.03), mats.iron)
    bar.position.set(Math.cos(a) * 0.17, height + 0.25, Math.sin(a) * 0.17)
    g.add(bar)
  }
  const cap = M(new THREE.ConeGeometry(0.3, 0.26, 6), mats.iron)
  cap.position.y = height + 0.6
  g.add(cap)
  const glassMat = retroMaterial({ map: TEX.white(), emissive: 0xc08a30, transparent: true, opacity: 0.45, depthWrite: false })
  const glass = M(new THREE.BoxGeometry(0.3, 0.44, 0.3), glassMat)
  glass.position.y = height + 0.25
  g.add(glass)
  const flameTex = TEX.flameSheet().clone()
  flameTex.repeat.set(0.25, 1)
  const flame = M(new THREE.PlaneGeometry(0.34, 0.34), retroMaterial({ map: flameTex, emissive: 0xffffff, alphaTest: 0.4 }))
  flame.position.y = height + 0.22
  g.add(flame)
  const haloMat = retroMaterial({ map: TEX.glowDot({ color: '#e8a84a' }), transparent: true, depthWrite: false, opacity: 0.55 })
  haloMat.blending = THREE.AdditiveBlending
  const halo = M(new THREE.PlaneGeometry(1.35, 1.35), haloMat)
  halo.position.y = height + 0.3
  g.add(halo)
  const poolMat = retroMaterial({ map: TEX.glowDot({ color: '#e8a84a' }), transparent: true, depthWrite: false, opacity: 0.4 })
  poolMat.blending = THREE.AdditiveBlending
  const pool = M(new THREE.CircleGeometry(3.4, 20), poolMat)
  pool.rotation.x = -Math.PI / 2
  pool.position.y = 0.02
  g.add(pool)
  if (!lit) { flame.visible = false; halo.visible = false; pool.visible = false; glass.visible = false }
  g.userData.collider = { r: 0.16, h: height }
  return { group: g, flame, halo, glass, pool, flameH: height + 0.25 }
}

// Firefly jar on a stump (Park's 4th cold light; release behavior lands in M6).
export function fireflyJar() {
  const mats = sharedMats()
  const g = new THREE.Group()
  const stump = M(new THREE.CylinderGeometry(0.32, 0.4, 0.5, 8), mats.bark)
  stump.position.y = 0.25
  g.add(stump)
  const glassMat = retroMaterial({ map: TEX.white(), emissive: 0x9a9a40, transparent: true, opacity: 0.35, depthWrite: false })
  const jar = M(new THREE.CylinderGeometry(0.11, 0.13, 0.22, 8), glassMat)
  jar.position.y = 0.61
  g.add(jar)
  const lid = M(new THREE.CylinderGeometry(0.12, 0.12, 0.04, 8), mats.iron)
  lid.position.y = 0.74
  g.add(lid)
  const haloMat = retroMaterial({ map: TEX.glowDot({ color: '#d8e858' }), transparent: true, depthWrite: false, opacity: 0.5 })
  haloMat.blending = THREE.AdditiveBlending
  const halo = M(new THREE.PlaneGeometry(0.9, 0.9), haloMat)
  halo.position.y = 0.62
  g.add(halo)
  const glass = jar
  const flame = null
  const pool = null
  glass.visible = false
  halo.visible = false
  g.userData.collider = { r: 0.42, h: 0.8 }
  return { group: g, flame, halo, glass, pool, flameH: 0.62 }
}

// Park bench: planks + iron legs. Long variant for Beldam's Long Bench.
export function bench({ length = 1.8 } = {}) {
  const mats = sharedMats()
  const g = new THREE.Group()
  const seat = M(new THREE.BoxGeometry(length, 0.06, 0.45), mats.plank)
  seat.position.y = 0.45
  g.add(seat)
  const back = M(new THREE.BoxGeometry(length, 0.5, 0.05), mats.plank)
  back.position.set(0, 0.75, -0.21)
  back.rotation.x = -0.12
  g.add(back)
  for (const sx of [-1, 1]) {
    const leg = M(new THREE.BoxGeometry(0.06, 0.45, 0.4), mats.iron)
    leg.position.set(sx * (length / 2 - 0.12), 0.22, 0)
    g.add(leg)
  }
  g.userData.collider = { r: length / 2 + 0.1, h: 1 }
  return g
}
