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

// Shared kindle-state parts builder: glass + flame sprite + halo + pool,
// tinted by the zone accent (Ruins kindles CYAN — the one cold accent).
function lightParts({ accent = '#e8a84a', cool = false, flameScale = 1, poolR = 3.4 } = {}) {
  const glassMat = retroMaterial({ map: TEX.white(), emissive: new THREE.Color(accent).multiplyScalar(0.55).getHex(), transparent: true, opacity: 0.45, depthWrite: false })
  const flameTex = TEX.flameSheet({ cool }).clone()
  flameTex.repeat.set(0.25, 1)
  const flame = M(new THREE.PlaneGeometry(0.34 * flameScale, 0.34 * flameScale), retroMaterial({ map: flameTex, emissive: 0xffffff, alphaTest: 0.4 }))
  const haloMat = retroMaterial({ map: TEX.glowDot({ color: accent }), transparent: true, depthWrite: false, opacity: 0.55 })
  haloMat.blending = THREE.AdditiveBlending
  const halo = M(new THREE.PlaneGeometry(1.35 * flameScale, 1.35 * flameScale), haloMat)
  const poolMat = retroMaterial({ map: TEX.glowDot({ color: accent }), transparent: true, depthWrite: false, opacity: 0.4 })
  poolMat.blending = THREE.AdditiveBlending
  const pool = M(new THREE.CircleGeometry(poolR, 20), poolMat)
  pool.rotation.x = -Math.PI / 2
  return { glassMat, flame, halo, pool }
}

// Brazier: iron bowl on legs, big flame (gatehouse, telescope, keep-top).
export function brazier({ accent = '#e8a84a', cool = false, scale = 1 } = {}) {
  const mats = sharedMats()
  const g = new THREE.Group()
  const bowl = M(new THREE.CylinderGeometry(0.42 * scale, 0.2 * scale, 0.3 * scale, 8), mats.iron)
  bowl.position.y = 0.75 * scale
  g.add(bowl)
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2
    const leg = M(new THREE.CylinderGeometry(0.035 * scale, 0.045 * scale, 0.8 * scale, 5), mats.iron)
    leg.position.set(Math.cos(a) * 0.22 * scale, 0.4 * scale, Math.sin(a) * 0.22 * scale)
    leg.rotation.z = Math.cos(a) * 0.2
    leg.rotation.x = -Math.sin(a) * 0.2
    g.add(leg)
  }
  const p = lightParts({ accent, cool, flameScale: 1.8 * scale, poolR: 3 * scale })
  p.flame.position.y = 1.08 * scale
  g.add(p.flame)
  p.halo.position.y = 1.1 * scale
  g.add(p.halo)
  p.pool.position.y = 0.02
  g.add(p.pool)
  p.flame.visible = p.halo.visible = p.pool.visible = false
  g.userData.collider = { r: 0.5 * scale, h: 1 * scale }
  return { group: g, flame: p.flame, halo: p.halo, glass: null, pool: p.pool, flameH: 1.08 * scale }
}

// Wall sconce: bracket + small flame (Hall walls, Ruins columns).
export function sconce({ accent = '#e8a84a', cool = false } = {}) {
  const mats = sharedMats()
  const g = new THREE.Group()
  const bracket = M(new THREE.BoxGeometry(0.08, 0.3, 0.08), mats.iron)
  bracket.position.y = -0.15
  g.add(bracket)
  const cup = M(new THREE.CylinderGeometry(0.11, 0.05, 0.14, 6), mats.iron)
  g.add(cup)
  const p = lightParts({ accent, cool, flameScale: 0.85, poolR: 1.8 })
  p.flame.position.y = 0.18
  g.add(p.flame)
  p.halo.position.y = 0.2
  g.add(p.halo)
  p.flame.visible = p.halo.visible = false
  // pool not attached (sconces sit on walls/columns); world may add separately
  return { group: g, flame: p.flame, halo: p.halo, glass: null, pool: null, flameH: 0.2 }
}

// Hanging lantern (Mosswood arch, house eaves) — sways gently.
export function hangingLantern({ accent = '#e8a84a' } = {}) {
  const mats = sharedMats()
  const g = new THREE.Group() // pivot at the hook
  const chain = M(new THREE.CylinderGeometry(0.015, 0.015, 0.3, 4), mats.iron)
  chain.position.y = -0.15
  g.add(chain)
  const cap = M(new THREE.ConeGeometry(0.16, 0.12, 6), mats.iron)
  cap.position.y = -0.34
  g.add(cap)
  const p = lightParts({ accent, flameScale: 0.8, poolR: 2 })
  const glass = M(new THREE.BoxGeometry(0.18, 0.24, 0.18), p.glassMat)
  glass.position.y = -0.5
  g.add(glass)
  p.flame.position.y = -0.5
  g.add(p.flame)
  p.halo.position.y = -0.48
  g.add(p.halo)
  glass.visible = p.flame.visible = p.halo.visible = false
  g.userData.sway = true
  return { group: g, flame: p.flame, halo: p.halo, glass, pool: null, flameH: -0.5 }
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
