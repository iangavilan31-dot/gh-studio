// MOONREST — boot + game loop. M0: pipeline proof scene (cobble, lamp, tree)
// under the Park ZoneLight, with the __MOONREST__ test surface (MASTER_PROMPT 0.4).

import * as THREE from 'three'
import { Pipeline } from './core/pipeline.js'
import { ZoneLightState, ZONES } from './world/zonelight.js'
import { retroMaterial, ensureVertexColors, globalUniforms } from './art/materials.js'
import * as TEX from './art/textures.js'
import { worldRNG } from './core/rng.js'

const canvas = document.getElementById('game')
const pipeline = new Pipeline(canvas)
const scene = new THREE.Scene()
const camera = new THREE.PerspectiveCamera(55, 16 / 9, 0.1, 220)
const zoneLight = new ZoneLightState(scene)

// ——— M0 proof scene ———

function buildProofScene() {
  const group = new THREE.Group()

  // Cobble ground with segments so we can bake a warm pool into vertex colors.
  const groundGeo = new THREE.PlaneGeometry(90, 90, 64, 64)
  groundGeo.rotateX(-Math.PI / 2)
  const cobbleTex = TEX.cobblestone({ moss: 0.25 })
  cobbleTex.repeat.set(32, 32)
  ensureVertexColors(groundGeo)
  const ground = new THREE.Mesh(groundGeo, retroMaterial({ map: cobbleTex }))
  group.add(ground)

  // Iron lamp post with open cage — flame must be VISIBLE (Rule 2's warm accent).
  const lampPos = new THREE.Vector3(1.5, 0, -1)
  const iron = retroMaterial({ map: TEX.iron() })
  const pole = new THREE.Mesh(ensureVertexColors(new THREE.CylinderGeometry(0.07, 0.11, 3.0, 6)), iron)
  pole.position.copy(lampPos).y = 1.5
  group.add(pole)
  // cage bars (4 corners)
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4
    const bar = new THREE.Mesh(ensureVertexColors(new THREE.BoxGeometry(0.03, 0.5, 0.03)), iron)
    bar.position.set(lampPos.x + Math.cos(a) * 0.17, 3.25, lampPos.z + Math.sin(a) * 0.17)
    group.add(bar)
  }
  // cap cone + finial
  const cap = new THREE.Mesh(ensureVertexColors(new THREE.ConeGeometry(0.3, 0.26, 6)), iron)
  cap.position.copy(lampPos).y = 3.6
  group.add(cap)
  // warm translucent glass
  const cageGlass = new THREE.Mesh(
    ensureVertexColors(new THREE.BoxGeometry(0.3, 0.44, 0.3)),
    retroMaterial({ map: TEX.white(), emissive: 0xc08a30, transparent: true, opacity: 0.45, depthWrite: false })
  )
  cageGlass.position.copy(lampPos).y = 3.25
  group.add(cageGlass)

  const flameTex = TEX.flameSheet()
  flameTex.repeat.set(0.25, 1)
  const flameMat = retroMaterial({ map: flameTex, emissive: 0xffffff, alphaTest: 0.4 })
  const flame = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.34), flameMat)
  ensureVertexColors(flame.geometry)
  flame.position.copy(lampPos).y = 3.22
  group.add(flame)

  // warm halo billboard (additive, restrained — a lantern, not a moon)
  const haloMat = retroMaterial({ map: TEX.glowDot({ color: '#e8a84a' }), transparent: true, depthWrite: false, opacity: 0.55 })
  haloMat.blending = THREE.AdditiveBlending
  const halo = new THREE.Mesh(new THREE.PlaneGeometry(1.35, 1.35), haloMat)
  ensureVertexColors(halo.geometry)
  halo.position.copy(lampPos).y = 3.3
  group.add(halo)

  // warm pool decal on the ground (cheap WoW-style light pool)
  const poolMat = retroMaterial({ map: TEX.glowDot({ color: '#e8a84a' }), transparent: true, depthWrite: false, opacity: 0.4 })
  poolMat.blending = THREE.AdditiveBlending
  const pool = new THREE.Mesh(new THREE.CircleGeometry(3.4, 20), poolMat)
  ensureVertexColors(pool.geometry)
  pool.rotation.x = -Math.PI / 2
  pool.position.copy(lampPos).y = 0.02
  group.add(pool)

  // Bake the warm pool into ground vertex colors too (WoW MOCV glow, Part 8.2).
  const pos = groundGeo.getAttribute('position')
  const col = groundGeo.getAttribute('color')
  const warm = new THREE.Color('#ffae45')
  for (let i = 0; i < pos.count; i++) {
    const dx = pos.getX(i) - lampPos.x, dz = pos.getZ(i) - lampPos.z
    const d = Math.sqrt(dx * dx + dz * dz)
    const f = Math.max(0, 1 - d / 8) ** 2 * 4
    col.setXYZ(i, 1 + warm.r * f, 1 + warm.g * f, 1 + warm.b * f)
  }
  col.needsUpdate = true

  // One big deciduous tree: bark trunk + crossed canopy cards (alpha-tested, wind).
  const treePos = new THREE.Vector3(-5, 0, -8)
  const trunkGeo = new THREE.CylinderGeometry(0.45, 0.8, 6, 7)
  ensureVertexColors(trunkGeo, [0.85, 0.85, 0.85])
  const trunk = new THREE.Mesh(trunkGeo, retroMaterial({ map: TEX.bark() }))
  trunk.position.copy(treePos).y = 3
  group.add(trunk)
  const canopyMat = retroMaterial({ map: TEX.canopy(), alphaTest: 0.5, wind: 0.18, side: THREE.DoubleSide })
  for (let i = 0; i < 4; i++) {
    const card = new THREE.Mesh(new THREE.PlaneGeometry(9, 7), canopyMat)
    ensureVertexColors(card.geometry)
    card.position.copy(treePos)
    card.position.y = 6.4
    card.rotation.y = (i / 4) * Math.PI + worldRNG.range(-0.2, 0.2)
    card.rotation.z = worldRNG.range(-0.12, 0.12)
    group.add(card)
  }

  scene.add(group)
  return { flame, flameTex, halo }
}

const proof = buildProofScene()

// ——— Camera poses for the shoot rig (grows per zone in M3) ———

const POSES = {
  m0: { pos: [4.6, 1.5, 4.2], look: [0.2, 2.3, -3.5] },
}

function teleport(poseName) {
  const p = POSES[poseName]
  if (!p) return false
  camera.position.set(...p.pos)
  camera.lookAt(...p.look)
  return true
}
teleport('m0')

// ——— Loop ———

let lastNow = performance.now()
let elapsed = 0
const frameTimes = []
let flameFrame = 0, flameAcc = 0

function tick() {
  requestAnimationFrame(tick)
  const now = performance.now()
  const dt = Math.min((now - lastNow) / 1000, 0.1)
  lastNow = now
  elapsed += dt
  globalUniforms.uTime.value = elapsed

  frameTimes.push(dt)
  if (frameTimes.length > 90) frameTimes.shift()

  // flame sprite animation ~8fps
  flameAcc += dt
  if (flameAcc > 0.125) {
    flameAcc = 0
    flameFrame = (flameFrame + 1) % 4
    proof.flameTex.offset.x = flameFrame * 0.25
  }
  proof.flame.lookAt(camera.position.x, proof.flame.position.y, camera.position.z)
  proof.halo.lookAt(camera.position)

  pipeline.render(scene, camera, elapsed)
}

// ——— Test surface (MASTER_PROMPT 0.4) ———

window.__MOONREST__ = {
  ready: true,
  seed: worldRNG.seed,
  poses: Object.keys(POSES),
  teleport,
  kindle: (id) => false, // lights registry lands in M2
  skipTo: (min) => false, // moon clock lands in M2
  autopilot: () => false, // lands in M6
  setPost(patch) {
    for (const [k, v] of Object.entries(patch)) {
      if (pipeline.postUniforms[k] !== undefined) pipeline.postUniforms[k].value = v
    }
  },
  sampleFrame() {
    return pipeline.sampleFrame(scene, camera, ZONES.park.fog)
  },
  get state() {
    const fps = frameTimes.length ? frameTimes.length / frameTimes.reduce((a, b) => a + b, 0) : 0
    return {
      playerPos: [camera.position.x, camera.position.y, camera.position.z],
      zone: 'park',
      nightT: 0,
      kindled: [],
      peers: 0,
      fps: Math.round(fps),
      drawCalls: pipeline.lastInfo?.calls ?? 0,
      triangles: pipeline.lastInfo?.triangles ?? 0,
    }
  },
}

tick()
