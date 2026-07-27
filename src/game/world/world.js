// World: all 8 zones + Foglands (MASTER_PROMPT Part 3), blockout fidelity in
// M3 → full art in M4/M5. Owns terrain queries (layout.js), colliders (circles
// + AABBs), the cold-light registry, animated bits, and shoot-rig poses.

import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { retroMaterial, ensureVertexColors } from '../art/materials.js'
import * as TEX from '../art/textures.js'
import { tree, lampPost, bench, fireflyJar, brazier, sconce, hangingLantern, sharedMats } from '../art/meshes.js'

// small blue Moon Brew bottle (world pickup form)
function brewBottleMesh() {
  const mat = retroMaterial({ map: TEX.white(), hemi: true, transparent: true, opacity: 0.92 })
  const g = new THREE.Group()
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.2, 7), mat)
  ensureVertexColors(body.geometry, [0.3, 0.48, 0.75])
  body.position.y = 0.1
  g.add(body)
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.034, 0.1, 6), mat)
  ensureVertexColors(neck.geometry, [0.3, 0.48, 0.75])
  neck.position.y = 0.25
  g.add(neck)
  return g
}
import { worldRNG } from '../core/rng.js'
import { heroTrees } from '../art/heroassets.js'
import { heightAt, surfaceAt, streetZ, streetH, roofInfo, WATER_Y, BOUNDS, MOSSWOOD_ARCH } from './layout.js'

const _wp = new THREE.Vector3()

export class World {
  constructor(scene, camera) {
    this.scene = scene
    this.realScene = scene
    this.camera = camera
    this.colliders = []      // { x, z, r, h } circles
    this.aabbs = []          // { minX, maxX, minZ, maxZ, h, y0 }
    this.interactables = []
    this.flames = []
    this.halos = []
    this.sways = []          // hanging lanterns etc.
    this.lights = []
    this.waterMats = []
    this.onKindle = null
    this.poses = {}

    this.treePads = []       // { x, z, r } canopy shadows for the AO bake
    this.buildGround()
    this.buildWater()
    // Per-zone visibility groups (D6): each builder's scene-adds land in its
    // group; update() hides groups beyond fog reach. Minimal-diff retrofit:
    // this.scene is swapped to the group for the duration of each builder.
    this.zoneGroups = []
    const grouped = (id, cx, cz, r, fn) => {
      const g = new THREE.Group()
      this.realScene.add(g)
      this.zoneGroups.push({ g, cx, cz, r })
      this.scene = g
      fn()
      this.scene = this.realScene
    }
    grouped('park', 0, 0, 45, () => this.buildPark())
    grouped('village', 116, 0, 55, () => { this.buildVillage(); this.buildRooftops() })
    grouped('ruins', -110, 0, 50, () => this.buildRuins())
    grouped('gloomspire', -110, 132, 62, () => { this.buildGloomspire(); this.buildHall() })
    grouped('mosswood', 60, 110, 50, () => this.buildMosswood())
    grouped('isle', 0, -140, 70, () => this.buildIsle())
    grouped('foglands', 0, 0, 9999, () => this.buildFoglands()) // corridors span the map — never culled
    this.bakeVertexColors()
    this.bakeHallShowcase()
    this.mergeStaticInGroups()
    this.buildPostcards()
  }

  // Part 7.2: merge each zone's static opaque meshes into one draw per material.
  // Dynamic parts (flames, halos, glass, sways, movers) are marked userData.dyn
  // or transparent and stay unmerged. Runs AFTER the bakes (colors are final).
  mergeStaticInGroups() {
    for (const zg of this.zoneGroups) {
      zg.g.updateWorldMatrix(true, true)
      const byMat = new Map()
      const toRemove = []
      zg.g.traverse((o) => {
        if (!o.isMesh || o.userData.dyn) return
        if (o.material.transparent) return
        let p = o.parent, dyn = false
        while (p && p !== zg.g) {
          if (p.userData.dyn || p.userData.sway || this.sways.includes(p)) { dyn = true; break }
          p = p.parent
        }
        if (dyn) return
        const geo = o.geometry.clone().applyMatrix4(o.matrixWorld)
        if (!byMat.has(o.material)) byMat.set(o.material, [])
        byMat.get(o.material).push(geo)
        toRemove.push(o)
      })
      for (const o of toRemove) o.parent.remove(o)
      for (const [mat, geos] of byMat) {
        const merged = mergeGeometries(geos, false)
        if (!merged) continue
        const m = new THREE.Mesh(merged, mat)
        zg.g.add(m)
      }
    }
  }

  // Build-time vertex bake (MASTER_PROMPT 8.4): painted-AO heuristics into the
  // ground (under-canopy, under-eaves) + per-light warm-pool weight lists that
  // lerp in over the kindle bloom (WoW MOCV glow — zero per-frame cost after).
  bakeVertexColors() {
    const geo = this.ground.geometry
    const pos = geo.getAttribute('position')
    const col = geo.getAttribute('color')
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i)
      let v = 1
      for (const t of this.treePads) {
        const d = Math.hypot(x - t.x, z - t.z)
        if (d < t.r) v = Math.min(v, 0.62 + 0.38 * (d / t.r))
      }
      for (const b of this.aabbs) {
        if (x > b.minX - 1.3 && x < b.maxX + 1.3 && z > b.minZ - 1.3 && z < b.maxZ + 1.3) v = Math.min(v, 0.8)
      }
      // AA.4: macro ground variation — low-frequency painted patchiness so no
      // screen-quarter of lawn reads flat; mossy drifts and dry patches wander
      // the field the way a groundskeeper never quite kept up with
      const n1 = Math.sin(x * 0.11 + Math.sin(z * 0.07) * 2.1) * Math.cos(z * 0.09 + Math.sin(x * 0.05) * 1.7)
      const n2 = Math.sin(x * 0.31 + z * 0.23)
      const patch = 0.87 + 0.13 * (n1 * 0.7 + n2 * 0.3)
      let pr = patch, pg = patch, pb = patch
      const mossy = Math.sin(x * 0.045 + 1.3) * Math.cos(z * 0.052 - 0.7)
      if (mossy > 0.25) { pg *= 1.07; pr *= 0.93 }
      else if (mossy < -0.35) { pr *= 1.06; pg *= 0.99; pb *= 0.9 }
      col.setXYZ(i, v * pr, v * pg, v * pb)
    }
    col.needsUpdate = true
    // store base for warm-pool lerps
    this.groundBase = new Float32Array(col.array)
    // per-light ground vertex weight lists
    for (const l of this.lights) {
      const gy = heightAt(l.x, l.z)
      if (Math.abs(l.y - gy) > 4.5) { l.groundWarm = []; continue } // rooftop lights don't warm the street
      const list = []
      for (let i = 0; i < pos.count; i++) {
        const d = Math.hypot(pos.getX(i) - l.x, pos.getZ(i) - l.z)
        if (d < 8) list.push({ i, w: Math.pow(1 - d / 8, 2) })
      }
      l.groundWarm = list
      l.warmApplied = -1
    }
  }

  heightAt(x, z) { return heightAt(x, z) }
  surfaceAt(x, z) { return surfaceAt(x, z) }
  onLadder(x, z) { return roofInfo(x, z).inRamp } // the bakery ladder is a deliberate steep climb
  streetZAt(x) { return streetZ(x) }

  collide(pos, radius) {
    pos.x = THREE.MathUtils.clamp(pos.x, BOUNDS.minX, BOUNDS.maxX)
    pos.z = THREE.MathUtils.clamp(pos.z, BOUNDS.minZ, BOUNDS.maxZ)
    for (const c of this.colliders) {
      const dx = pos.x - c.x, dz = pos.z - c.z
      const dist = Math.hypot(dx, dz)
      const min = c.r + radius
      if (dist < min && dist > 0.0001) {
        if (c.y0 !== undefined && pos.y > c.y0 + c.h) continue
        pos.x = c.x + (dx / dist) * min
        pos.z = c.z + (dz / dist) * min
      }
    }
    for (const b of this.aabbs) {
      if (b.y0 !== undefined && pos.y > b.y0 + b.h) continue
      const nx = THREE.MathUtils.clamp(pos.x, b.minX, b.maxX)
      const nz = THREE.MathUtils.clamp(pos.z, b.minZ, b.maxZ)
      const dx = pos.x - nx, dz = pos.z - nz
      const d = Math.hypot(dx, dz)
      if (d < radius) {
        if (d > 0.0001) {
          pos.x = nx + (dx / d) * radius
          pos.z = nz + (dz / d) * radius
        } else {
          // inside the box: push out the nearest face
          const pushes = [
            { d: pos.x - b.minX + radius, x: b.minX - radius, z: pos.z },
            { d: b.maxX - pos.x + radius, x: b.maxX + radius, z: pos.z },
            { d: pos.z - b.minZ + radius, x: pos.x, z: b.minZ - radius },
            { d: b.maxZ - pos.z + radius, x: pos.x, z: b.maxZ + radius },
          ].sort((p, q) => p.d - q.d)
          pos.x = pushes[0].x; pos.z = pushes[0].z
        }
      }
    }
  }

  cameraBlocked(x, y, z, r) {
    for (const c of this.colliders) {
      if (y > heightAt(c.x, c.z) + c.h) continue
      if (Math.hypot(x - c.x, z - c.z) < c.r + r) return true
    }
    for (const b of this.aabbs) {
      if (b.y0 !== undefined && y > b.y0 + b.h) continue
      if (x > b.minX - r && x < b.maxX + r && z > b.minZ - r && z < b.maxZ + r) return true
    }
    return false
  }

  addCollider(obj, x, z) {
    const c = obj.userData?.collider
    if (c) this.colliders.push({ x, z, r: c.r, h: c.h })
  }
  addAABB(minX, maxX, minZ, maxZ, h, y0) {
    this.aabbs.push({ minX, maxX, minZ, maxZ, h, y0 })
  }

  place(group, x, z, rotY = 0, yOff = 0) {
    group.position.set(x, heightAt(x, z) + yOff, z)
    group.rotation.y = rotY
    this.scene.add(group)
    this.addCollider(group, x, z)
    return group
  }

  registerLight(id, zone, parts, x, z, yBase = null) {
    const y = (yBase ?? heightAt(x, z)) + (parts.flameH ?? 3.2)
    const light = {
      id, zone, x, z, y,
      parts, kindled: false, bloom: 0,
      flickerSeed: worldRNG.range(0, Math.PI * 2),
      haloBase: parts.halo ? parts.halo.material.uniforms.uOpacity.value : 0.55,
      poolBase: parts.pool ? parts.pool.material.uniforms.uOpacity.value : 0.4,
      glassBase: parts.glass ? parts.glass.material.uniforms.uOpacity.value : 0.45,
    }
    this.lights.push(light)
    this.interactables.push({ id, x, z, kind: 'light' })
    if (parts.flame) this.flames.push({ mesh: parts.flame, tex: parts.flame.material.uniforms.uMap.value, frame: worldRNG.int(0, 3), acc: worldRNG.range(0, 0.12) })
    if (parts.halo) this.halos.push(parts.halo)
    // ember pilot-glow (AA.2): every cold light advertises itself — a faint
    // breathing ember at the flame seat until the real flame takes over
    if (!this.pilotMat) {
      // +20% pilot presence: unkindled shots lean on these embers for their
      // warm accent (judge pass 3, findings 5/8)
      this.pilotMat = retroMaterial({ map: TEX.glowDot({ name: 'pilot', color: '#e07828' }), transparent: true, depthWrite: false, opacity: 0.6, emissive: 0xd06820 })
      this.pilotMat.blending = THREE.AdditiveBlending
    }
    const pilot = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.34), this.pilotMat)
    ensureVertexColors(pilot.geometry)
    pilot.position.set(x, y, z)
    pilot.renderOrder = 5
    // a normal-blend ember heart inside the additive halo: additive orange
    // over cobalt reads purple, so the core carries the true warm hue
    if (!this.pilotCoreMat) {
      this.pilotCoreMat = retroMaterial({ map: TEX.glowDot({ name: 'pilotcore', color: '#ff7a1e' }), transparent: true, depthWrite: false, opacity: 0.95, emissive: 0xe86612 })
    }
    const core = new THREE.Mesh(new THREE.PlaneGeometry(0.15, 0.15), this.pilotCoreMat)
    ensureVertexColors(core.geometry)
    core.position.z = 0.01
    core.renderOrder = 6
    pilot.add(core)
    this.scene.add(pilot)
    light.pilot = pilot
  }

  // decorative pre-lit lamp (foglands breadcrumbs — not objectives)
  litLamp(parts, x, z) {
    if (parts.flame) { parts.flame.visible = true; this.flames.push({ mesh: parts.flame, tex: parts.flame.material.uniforms.uMap.value, frame: worldRNG.int(0, 3), acc: worldRNG.range(0, 0.12) }) }
    if (parts.halo) { parts.halo.visible = true; this.halos.push(parts.halo) }
    if (parts.glass) parts.glass.visible = true
    if (parts.pool) parts.pool.visible = true
  }

  /**
   * Collider audit + self-heal (ASCENSION 0.1.3: "Log any mesh over 1m that
   * ships without a collider; the list must be empty").
   *
   * Rather than hand-patching whichever prop is missing today, close the gap
   * at build time so the invariant holds for every prop added later too.
   * Only SOLID, REACHABLE, single-prop meshes qualify: transparent/additive
   * FX quads are not walls, merged batches registered collision individually
   * before merging, and anything standing in open water is offshore dressing.
   * Returns the list it covered so the gate can report it.
   */
  // FIN-4: seal wedge traps.
  //
  // The ten-minute capture stalled dead at (-10.06, 8.11) — position
  // bit-identical for 1800 ticks while the controller happily reported 5.2 m/s.
  // The cause was two 0.8m rock colliders whose centres sit 2.28m apart: a
  // surface gap of 0.68m, against a character capsule 0.70m wide. The player
  // was jammed in a gap two centimetres too narrow.
  //
  // A gap the player cannot fit through is not a passage — but at this width it
  // still LOOKS like one, both to a human reading the scene and to anything
  // steering toward a point beyond it. So close it: bridge any pair of
  // blocking colliders whose clearance is under a capsule-and-a-bit, and the
  // pair reads as the single solid mass it effectively is. Walking around a
  // rock is fine; walking into an invisible pinch and stopping is not.
  //
  // Only marginal gaps are sealed. Anything over CLEAR is comfortably walkable
  // and is left alone, so real paths between props survive.
  sealNarrowGaps() {
    const CAPSULE_D = 0.70          // 2 × CAPSULE.radius in systems/physics.js
    const CLEAR = CAPSULE_D + 0.12  // under this, treat it as a pinch, not a gap
    const MIN_H = 0.5               // shorter than this the controller autosteps
    const sealed = []
    const cols = this.colliders
    const n = cols.length
    for (let i = 0; i < n; i++) {
      const a = cols[i]
      if (!a.r || (a.h ?? 0) < MIN_H) continue
      for (let j = i + 1; j < n; j++) {
        const b = cols[j]
        if (!b.r || (b.h ?? 0) < MIN_H) continue
        const dx = b.x - a.x, dz = b.z - a.z
        const dist = Math.hypot(dx, dz)
        if (dist < 1e-4) continue
        const gap = dist - a.r - b.r
        if (gap <= 0 || gap >= CLEAR) continue    // overlapping already, or wide enough
        const t = (a.r + gap / 2) / dist
        const x = a.x + dx * t, z = a.z + dz * t
        this.colliders.push({
          x, z, r: gap / 2 + 0.08, h: Math.min(a.h, b.h),
          y0: heightAt(x, z), tag: 'seal',
        })
        sealed.push({ x: +x.toFixed(2), z: +z.toFixed(2), gap: +gap.toFixed(2) })
      }
    }
    return sealed
  }

  autoCoverColliderGaps() {
    const covered = []
    this.realScene.traverse((o) => {
      if (!o.isMesh || !o.geometry || o.userData?.noCollide) return
      const mats = Array.isArray(o.material) ? o.material : [o.material]
      const solid = mats.some((m) => m && !m.transparent && m.depthWrite !== false && m.blending !== THREE.AdditiveBlending)
      if (!solid) return
      o.geometry.computeBoundingBox?.()
      const bb = o.geometry.boundingBox
      if (!bb) return
      o.updateWorldMatrix?.(true, false)
      const e = o.matrixWorld.elements
      const sx = Math.hypot(e[0], e[1], e[2]) || 1, sy = Math.hypot(e[4], e[5], e[6]) || 1, sz = Math.hypot(e[8], e[9], e[10]) || 1
      const w = (bb.max.x - bb.min.x) * sx, h = (bb.max.y - bb.min.y) * sy, d = (bb.max.z - bb.min.z) * sz
      const fp = Math.max(w, d)
      if (fp < 1 || h < 1 || fp > 25) return
      const cx = (bb.min.x + bb.max.x) / 2, cy = (bb.min.y + bb.max.y) / 2, cz = (bb.min.z + bb.max.z) / 2
      const x = e[0] * cx + e[4] * cy + e[8] * cz + e[12]
      const y = e[1] * cx + e[5] * cy + e[9] * cz + e[13]
      const z = e[2] * cx + e[6] * cy + e[10] * cz + e[14]
      if (y > 40) return
      if (x < BOUNDS.minX || x > BOUNDS.maxX || z < BOUNDS.minZ || z > BOUNDS.maxZ) return
      if (heightAt(x, z) < WATER_Y) return          // offshore, unreachable
      const r = fp / 2
      for (const c of this.colliders) if (Math.hypot(c.x - x, c.z - z) < c.r + r + 1.2) return
      for (const b of this.aabbs) {
        const nx = Math.max(b.minX, Math.min(x, b.maxX)), nz = Math.max(b.minZ, Math.min(z, b.maxZ))
        if (Math.hypot(x - nx, z - nz) < r + 1.2) return
      }
      this.colliders.push({ x, z, r: Math.max(0.35, r * 0.8), h, y0: heightAt(x, z), tag: 'auto' })
      covered.push({ x: +x.toFixed(1), z: +z.toFixed(1), w: +w.toFixed(1), h: +h.toFixed(1) })
    })
    return covered
  }

  /**
   * The Lantern Listen (ASCENSION 0.3.3) — the "I'm lost" verb.
   * The lantern lifts and chimes, and ONE wisp streaks away toward the
   * nearest unkindled light, fading after ~3s. Unlimited, zero UI, no arrow
   * and no minimap: it must read as folklore, not a quest marker. Returns the
   * target so the caller can play the chime and lift the staff.
   */
  lanternListen(fromX, fromZ) {
    let best = null, bestD = Infinity
    for (const l of this.lights) {
      if (l.kindled) continue
      const d = Math.hypot(l.x - fromX, l.z - fromZ)
      if (d < bestD) { bestD = d; best = l }
    }
    if (!best) return null   // everything is lit — the night is done
    if (!this._wispMat) {
      this._wispMat = retroMaterial({ map: TEX.glowDot({ name: 'wisp', color: '#ffd79a' }), transparent: true, depthWrite: false, opacity: 0.95, emissive: 0xffc070 })
      this._wispMat.blending = THREE.AdditiveBlending
    }
    if (!this._wisp) {
      this._wisp = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.5), this._wispMat)
      ensureVertexColors(this._wisp.geometry)
      this._wisp.renderOrder = 7
      this._wisp.visible = false
      this.scene.add(this._wisp)
    }
    const y = heightAt(fromX, fromZ) + 1.5
    this.listenWisp = { t: 0, dur: 3, x0: fromX, z0: fromZ, y0: y, tx: best.x, tz: best.z, ty: heightAt(best.x, best.z) + 1.4 }
    return { id: best.id, x: best.x, z: best.z, dist: bestD }
  }

  _updateListen(dt) {
    const w = this.listenWisp
    if (!w || !this._wisp) { if (this._wisp) this._wisp.visible = false; return }
    w.t += dt
    const k = Math.min(1, w.t / w.dur)
    if (k >= 1) { this.listenWisp = null; this._wisp.visible = false; return }
    // ease out along the path, arcing a little so it drifts like a spirit
    const e = 1 - Math.pow(1 - k, 2.2)
    this._wisp.visible = true
    this._wisp.position.set(
      w.x0 + (w.tx - w.x0) * e,
      w.y0 + (w.ty - w.y0) * e + Math.sin(k * Math.PI) * 1.6,
      w.z0 + (w.tz - w.z0) * e,
    )
    this._wisp.scale.setScalar(1 + Math.sin(k * Math.PI) * 0.6)
    if (this._wispMat) this._wispMat.uniforms.uOpacity.value = 0.95 * (1 - Math.pow(k, 2))
    if (this.camera) this._wisp.lookAt(this.camera.position)
  }

  get kindledCount() { return this.lights.filter((l) => l.kindled).length }
  get kindledIds() { return this.lights.filter((l) => l.kindled).map((l) => l.id) }

  takeBrew(id) {
    const b = this.brews?.find((x) => x.id === id)
    if (!b || b.taken) return false
    b.taken = true
    b.group.visible = false
    if (this.onBrew) this.onBrew(b)
    return true
  }
  get brewCount() { return this.brews?.filter((b) => b.taken).length ?? 0 }

  kindle(id, { quiet = false, remote = false } = {}) {
    // quiet: late-join snapshot application (Part 5.1) — light the world without
    // chimes/embers/stirs replaying a night that already happened
    // remote: a peer lit it — consequences run, but local-only feedback
    // (glance-back, rumble) stays with whoever actually did the kindling
    const light = this.lights.find((l) => l.id === id)
    if (!light || light.kindled) return false
    light.kindled = true
    light.bloom = 0.0001
    const p = light.parts
    if (light.pilot) light.pilot.visible = false // the real flame takes over
    if (p.flame) p.flame.visible = true
    if (p.halo) { p.halo.visible = true; p.halo.material.uniforms.uOpacity.value = 0 }
    if (p.pool) { p.pool.visible = true; p.pool.material.uniforms.uOpacity.value = 0 }
    if (p.glass) { p.glass.visible = true; p.glass.material.uniforms.uOpacity.value = 0 }
    if (!quiet && this.onKindle) this.onKindle(light, remote)
    return true
  }

  // ——— builders ———

  buildGround() {
    const geo = new THREE.PlaneGeometry(360, 400, 170, 190)
    geo.rotateX(-Math.PI / 2)
    geo.translate(0, 0, -10) // world z ∈ [-210, 190]
    const p = geo.getAttribute('position')
    for (let i = 0; i < p.count; i++) p.setY(i, heightAt(p.getX(i), p.getZ(i)))
    geo.computeVertexNormals()
    const grassTex = TEX.grass()
    grassTex.repeat.set(90, 100)
    ensureVertexColors(geo)
    this.ground = new THREE.Mesh(geo, retroMaterial({ map: grassTex }))
    this.scene.add(this.ground)

    // path/street ribbons (visual strips slightly above terrain)
    this.ribbons = [] // recorded for the AA.4 edging pass
    const addRibbon = (points, width, tex, repeat) => {
      // ribbon UVs already tile by arc length (one tile per 8m) — texture
      // repeat on top would compound now that the shader honors it
      const geoR = ribbonGeometry(points, width)
      const t = tex
      ensureVertexColors(geoR)
      const m = new THREE.Mesh(geoR, retroMaterial({ map: t }))
      this.scene.add(m)
      this.ribbons.push({ points, width })
      return m
    }
    // park loop (dirt)
    const loop = []
    for (let i = 0; i <= 56; i++) {
      const a = (i / 56) * Math.PI * 2
      loop.push([Math.cos(a) * 18, Math.sin(a) * 18])
    }
    addRibbon(loop, 3.2, TEX.dirt({ name: 'dirtPath' }), 40)
    // village street (cobble)
    const street = []
    for (let x = 60; x <= 148; x += 4) street.push([x, streetZ(x)])
    addRibbon(street, 6, TEX.cobblestone({ name: 'streetCobble' }), 30)
    // park→village road
    addRibbon([[18, 0], [40, 0], [60, 0]], 3.5, TEX.dirt({ name: 'roadPV' }), 14)
    // park→ruins road
    addRibbon([[-18, 0], [-40, 0], [-64, 0], [-84, 0]], 3.5, TEX.dirt({ name: 'roadPR' }), 20)
    // ruins colonnade avenue (cobble)
    addRibbon([[-84, 0], [-110, 0], [-134, 0]], 4.5, TEX.cobblestone({ name: 'ruinsAve', moss: 0.4 }), 16)
    // ruins→gloomspire road
    addRibbon([[-110, 8], [-110, 40], [-110, 70], [-110, 88]], 3.5, TEX.dirt({ name: 'roadRG' }), 24)
    // gloomspire causeway (cobble)
    addRibbon([[-110, 88], [-110, 108], [-110, 126]], 4.5, TEX.cobblestone({ name: 'gloomCauseway' }), 12)
    // village→mosswood road
    addRibbon([[104, 14], [95, 40], [80, 70], [66, 96], [60, 108]], 3.5, TEX.dirt({ name: 'roadVM' }), 30)
    // gloomspire→mosswood road
    addRibbon([[-96, 118], [-60, 112], [-20, 110], [20, 110], [40, 110]], 3.5, TEX.dirt({ name: 'roadGM' }), 40)
    // mosswood path to arch
    addRibbon([[40, 110], [60, 110], [84, 110]], 3.2, TEX.dirt({ name: 'mossPath' }), 16)
    // isle causeway (cobble)
    addRibbon([[0, -40], [0, -70], [0, -100], [0, -128]], 4.5, TEX.cobblestone({ name: 'isleCauseway' }), 28)
    // isle switchback to keep
    addRibbon([[0, -132], [8, -140], [4, -148], [-6, -146], [-8, -152], [0, -155]], 2.6, TEX.dirt({ name: 'isleSwitch' }), 16)

    // AA.4: path edging stones — uneven, clustered, full of gaps (P.1: nothing
    // evenly spaced). One merged mesh, one draw call, for every road at once.
    const srng = worldRNG.fork('edging')
    const stoneGeos = []
    for (const { points, width } of this.ribbons) {
      for (let i = 0; i < points.length - 1; i++) {
        const [x0, z0] = points[i], [x1, z1] = points[i + 1]
        const segLen = Math.hypot(x1 - x0, z1 - z0)
        const steps = Math.max(1, Math.round(segLen / 2.1))
        for (let s = 0; s < steps; s++) {
          for (const side of [-1, 1]) {
            if (srng.chance(0.44)) continue // the gaps make it handmade
            const t = (s + srng.range(0.1, 0.9)) / steps
            const px = x0 + (x1 - x0) * t, pz = z0 + (z1 - z0) * t
            const dx = (x1 - x0) / segLen, dz = (z1 - z0) / segLen
            const off = width / 2 + srng.range(0.12, 0.5)
            const gx = px - dz * side * off, gz = pz + dx * side * off
            const gy = heightAt(gx, gz)
            if (gy < WATER_Y + 1.0) continue // no stones hovering over the sea
            const r = srng.range(0.13, 0.32)
            const g = new THREE.IcosahedronGeometry(r, 0)
            g.scale(1, srng.range(0.5, 0.75), 1)
            g.rotateY(srng.range(0, Math.PI))
            g.translate(gx, gy + r * 0.22, gz)
            const shade = 0.6 + srng.range(-0.09, 0.09)
            ensureVertexColors(g, [shade * 0.97, shade, shade * 0.96])
            stoneGeos.push(g)
          }
        }
      }
    }
    const stoneMesh = new THREE.Mesh(mergeGeometries(stoneGeos, false), retroMaterial({ map: TEX.stoneBlock({ name: 'edging', base: '#4a5451' }) }))
    this.scene.add(stoneMesh)
  }

  buildWater() {
    // the northern sea
    const seaTex = TEX.water()
    seaTex.repeat.set(70, 42)
    const seaMat = retroMaterial({ map: seaTex, ripple: true })
    // big enough that its far edge sits beyond the 220m far plane from any
    // shore camera — the horizon is fog, never a visible plane edge (Rule 3)
    const sea = new THREE.Mesh(new THREE.PlaneGeometry(520, 300, 60, 30), seaMat)
    ensureVertexColors(sea.geometry)
    sea.rotation.x = -Math.PI / 2
    sea.position.set(0, WATER_Y, -160)
    this.scene.add(sea)
    this.waterMats.push({ tex: seaTex, sx: 0.004, sy: 0.002 })
    // (the gloomspire moat lives in buildGloomspire — one disc, not two)
  }

  buildPark() {
    const rng = worldRNG.fork('park')
    // FIN-2: hero trunks from the Blender factory when they exist, procedural
    // cylinders when they do not — the Park must build either way.
    const hero = heroTrees()
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2 + rng.range(-0.12, 0.12)
      const r = rng.range(23, 28)
      const cr = rng.range(3.6, 5)
      const hg = hero.length ? hero[i % hero.length] : null
      const t = tree({ rng, height: rng.range(5, 7), trunkR: rng.range(0.45, 0.7), canopyR: cr, heroGeo: hg })
      const x = Math.cos(a) * r, z = Math.sin(a) * r
      this.place(t, x, z, rng.range(0, Math.PI * 2))
      this.treePads.push({ x, z, r: cr })
    }
    const bigTree = tree({ rng, height: 8.5, trunkR: 1.0, canopyR: 6.5, cards: 5,
      heroGeo: hero.length ? hero[0] : null })
    this.place(bigTree, 2, -22.5, 0.4)
    this.treePads.push({ x: 2, z: -22.5, r: 6.5 })
    const longBench = bench({ length: 2.6 })
    this.place(longBench, 2, -19.6, 0)
    this.benchPos = new THREE.Vector3(2, heightAt(2, -19.6), -19.6)
    this.benches = [[2, -19.6]] // rest spots are actionable (AA.5 wander POIs)

    const benchLamp = lampPost({ lit: false })
    this.place(benchLamp.group, 4.2, -19.2)
    this.registerLight('park-bench-lamp', 'park', benchLamp, 4.2, -19.2)

    // P.4 fingerprint (park): initials scratched under the bench seat —
    // somebody young, long before the lamps went cold
    {
      const tag = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.16),
        retroMaterial({ map: TEX.scratchTag({ name: 'benchinitials', kind: 'initials' }), alphaTest: 0.3 }))
      ensureVertexColors(tag.geometry, [0.9, 0.88, 0.8])
      tag.position.set(2.3, heightAt(2, -19.6) + 0.3, -19.32)
      tag.rotation.x = -0.3
      this.scene.add(tag)
    }

    for (const a of [Math.PI * 0.55, Math.PI * 1.25]) {
      const b = bench({})
      this.place(b, Math.cos(a) * 16, Math.sin(a) * 16, -a + Math.PI / 2)
      this.benches.push([Math.cos(a) * 16, Math.sin(a) * 16])
    }
    let li = 0
    for (const a of [Math.PI * 0.15, Math.PI * 0.85]) {
      const lamp = lampPost({ lit: false })
      const x = Math.cos(a) * 19.9, z = Math.sin(a) * 19.9
      this.place(lamp.group, x, z)
      this.registerLight(`park-lantern-${++li}`, 'park', lamp, x, z)
    }
    const jar = fireflyJar()
    this.place(jar.group, -9, -11, 0.6)
    this.registerLight('park-firefly-jar', 'park', jar, -9, -11)

    // — the 12 Moon Brew bottles (6.3), hidden across the world —
    this.brews = []
    const brewSpots = [
      ['brew-bench', 1.2, -21.6],
      ['brew-jarstump', -10.2, -11.8],
      ['brew-fork', 24.5, 2.2],
      ['brew-bakery', 127.5, streetZ(127.5) - 13.2],
      ['brew-roofgarden', 114.6, streetZ(114.6) - 8.6, () => streetH(114.6) + 5.6],
      ['brew-shrine', -114, -17.6],
      ['brew-moonwell', -118, 12],
      ['brew-gatehouse', -105.6, 101],
      ['brew-throne', -110, 170.6, () => 2.3],
      ['brew-mote', 64.6, 104.9],
      ['brew-cove', 9.4, -135.4],
      ['brew-causeway', 3.4, -70],
    ]
    for (const [id, bx, bz, yFn] of brewSpots) {
      const g = new THREE.Group()
      g.add(brewBottleMesh())
      const haloMat = retroMaterial({ map: TEX.glowDot({ color: '#7fa8e8' }), transparent: true, depthWrite: false, opacity: 0.35 })
      haloMat.blending = THREE.AdditiveBlending
      const halo = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.5), haloMat)
      ensureVertexColors(halo.geometry)
      halo.position.y = 0.15
      g.add(halo)
      const y = yFn ? yFn() : heightAt(bx, bz)
      g.position.set(bx, y, bz)
      this.realScene.add(g) // tiny; exempt from zone culling
      this.halos.push(halo)
      this.brews.push({ id, x: bx, z: bz, group: g, taken: false })
      this.interactables.push({ id, x: bx, z: bz, kind: 'brew' })
    }

    // — park props (Part 3.2.1): stumps, mushrooms, birdbath, low fences —
    const mats = sharedMats()
    for (let i = 0; i < 4; i++) {
      const a = rng.range(0, Math.PI * 2), r = rng.range(8, 14)
      const stump = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.38, 0.45, 8), mats.bark)
      ensureVertexColors(stump.geometry)
      this.place((() => { const g = new THREE.Group(); g.add(stump); stump.position.y = 0.22; g.userData.collider = { r: 0.42, h: 0.5 }; return g })(), Math.cos(a) * r, Math.sin(a) * r)
    }
    // mushroom story-clusters (AA.4/B.1): sized to READ at pose distance,
    // grouped in 3s and 5s near the path's inner ring, never evenly spaced
    const shroomMat = retroMaterial({ map: TEX.white(), hemi: true })
    for (let i = 0; i < 9; i++) {
      const a = rng.range(0, Math.PI * 2), r = rng.chance(0.6) ? rng.range(13, 22) : rng.range(5, 11)
      const x = Math.cos(a) * r, z = Math.sin(a) * r
      const cluster = new THREE.Group()
      const count = rng.chance(0.4) ? 5 : 3
      for (let k = 0; k < count; k++) {
        const s = rng.range(0.8, 1.9) // big hero shroom + little siblings
        const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.045 * s, 0.06 * s, 0.26 * s, 5), shroomMat)
        ensureVertexColors(stem.geometry, [0.85, 0.82, 0.72])
        stem.position.set(rng.range(-0.45, 0.45), 0.13 * s, rng.range(-0.45, 0.45))
        cluster.add(stem)
        const cap = new THREE.Mesh(new THREE.SphereGeometry(0.14 * s, 6, 4, 0, Math.PI * 2, 0, Math.PI / 2), shroomMat)
        ensureVertexColors(cap.geometry, rng.chance(0.5) ? [0.6, 0.28, 0.2] : [0.66, 0.6, 0.48])
        cap.position.set(stem.position.x, 0.26 * s, stem.position.z)
        cluster.add(cap)
      }
      this.place(cluster, x, z)
    }
    // lawn boulders in twos and threes — the lawn stops being a flat quarter
    const rockMat = retroMaterial({ map: TEX.stoneBlock({ name: 'lawnrock', base: '#525c56' }) })
    for (let i = 0; i < 5; i++) {
      const a = rng.range(0, Math.PI * 2), r = rng.range(7, 23)
      const bx = Math.cos(a) * r, bz = Math.sin(a) * r
      const grp = new THREE.Group()
      for (let k = 0; k < rng.int(2, 3); k++) {
        const rr = rng.range(0.28, 0.6)
        const rock = new THREE.Mesh(new THREE.IcosahedronGeometry(rr, 0), rockMat)
        rock.geometry.scale(1, rng.range(0.55, 0.8), 1)
        rock.geometry.rotateY(rng.range(0, Math.PI))
        ensureVertexColors(rock.geometry, [0.55, 0.6 + rng.range(0, 0.08), 0.55]) // mossy tops
        rock.position.set(rng.range(-0.9, 0.9), rr * 0.35, rng.range(-0.9, 0.9))
        grp.add(rock)
      }
      grp.userData.collider = { r: 0.8, h: 0.7 }
      this.place(grp, bx, bz)
    }
    // stone birdbath
    const bath = new THREE.Group()
    const bathMat = retroMaterial({ map: TEX.stoneBlock({ name: 'bath', base: '#5a625f' }) })
    const pedestal = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.16, 0.7, 7), bathMat)
    ensureVertexColors(pedestal.geometry)
    pedestal.position.y = 0.35
    bath.add(pedestal)
    const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.3, 0.14, 9), bathMat)
    ensureVertexColors(bowl.geometry)
    bowl.position.y = 0.76
    bath.add(bowl)
    const bathWater = new THREE.Mesh(new THREE.CircleGeometry(0.36, 9), retroMaterial({ map: TEX.water({ name: 'bathwater' }) }))
    ensureVertexColors(bathWater.geometry)
    bathWater.rotation.x = -Math.PI / 2
    bathWater.position.y = 0.84
    bath.add(bathWater)
    bath.userData.collider = { r: 0.5, h: 0.9 }
    this.place(bath, -12, 6)
    // low fences by the north entrance
    const fencePostMat = retroMaterial({ map: TEX.woodPost({ name: 'fencePost', base: '#453728' }) })
    const fence = (x1, z1, x2, z2) => {
      const g = new THREE.Group()
      const len = Math.hypot(x2 - x1, z2 - z1)
      const n = Math.max(2, Math.round(len / 1.4))
      for (let i = 0; i <= n; i++) {
        const t = i / n
        const px = x1 + (x2 - x1) * t, pz = z1 + (z2 - z1) * t
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.65, 0.09), fencePostMat)
        ensureVertexColors(post.geometry)
        post.position.set(px - x1, this.heightAt(px, pz) - this.heightAt(x1, z1) + 0.32, pz - z1)
        g.add(post)
      }
      const rail = new THREE.Mesh(new THREE.BoxGeometry(len, 0.07, 0.05), mats.plank)
      ensureVertexColors(rail.geometry)
      rail.position.set((x2 - x1) / 2, 0.5, (z2 - z1) / 2)
      rail.rotation.y = -Math.atan2(z2 - z1, x2 - x1)
      g.add(rail)
      this.place(g, x1, z1)
    }
    fence(-6, -27, -13, -23)
    fence(8, -28, 14, -24)

    this.poses.park = { pos: [7.5, 1.3, -13.5], look: [1.5, 1.9, -20.2], minute: 33 }
    // AA.2 evidence pose: the player alone in open dark — only the staff
    // lantern's traveling pool lights the ground
    this.poses.lanternpool = { pos: [-8.8, heightAt(-8.8, -24.4) + 1.7, -24.4], look: [-5.6, heightAt(-5.6, -28) + 1.0, -28], minute: 20, player: [-5.6, -28, 0.8] }
    this.poses.player = { pos: [-7.6, heightAt(-7.6, -25.4) + 1.3, -25.4], look: [-5.6, heightAt(-5.6, -28) + 1.05, -28], minute: 20, player: [-5.6, -28, 2.4] }
  }

  buildVillage() {
    const rng = worldRNG.fork('village')
    const mats = sharedMats()
    const plasterMat = retroMaterial({ map: TEX.plaster() })
    // B.3: shingles read as SHINGLE ROWS — the 8-course texture spans one
    // roof face exactly (repeat 1: the approved village look)
    const shingleTex = TEX.shingle({ moss: 0.4 })
    const shingleMat = retroMaterial({ map: shingleTex })
    const stoneMat = retroMaterial({ map: TEX.stoneBlock() })

    // 7 half-timbered houses: 4 on the north row (roofs walkable), 3 south
    const houseDefs = [
      { x: 103, side: -1, w: 9, d: 8 }, { x: 113, side: -1, w: 8, d: 8 }, { x: 123, side: -1, w: 9, d: 8, bakery: true }, { x: 133, side: -1, w: 8, d: 8 },
      { x: 96, side: 1, w: 8, d: 7 }, { x: 112, side: 1, w: 9, d: 8 }, { x: 128, side: 1, w: 8, d: 7 },
    ]
    for (const hd of houseDefs) {
      const sz = streetZ(hd.x)
      const z = sz + hd.side * (hd.side === -1 ? 9.5 : 8.5)
      const baseH = streetH(hd.x)
      const wallH = 4.6
      const body = new THREE.Mesh(new THREE.BoxGeometry(hd.w, wallH, hd.d), plasterMat)
      // plaster sits dim + moon-cool at night so the indigo field stays dominant
      ensureVertexColors(body.geometry, [0.72, 0.75, 0.88])
      body.position.set(hd.x, baseH + wallH / 2, z)
      this.scene.add(body)
      // roof slab (walkable height matches layout roofH = streetH+5.6)
      const roof = new THREE.Mesh(new THREE.BoxGeometry(hd.w + 1, 2, hd.d + 1), shingleMat)
      ensureVertexColors(roof.geometry)
      roof.position.set(hd.x, baseH + wallH + 0.55, z)
      this.scene.add(roof)
      // chimney (the first two become smoke anchors — Part 3.2.2)
      if (rng.chance(0.7)) {
        const ch = new THREE.Mesh(new THREE.BoxGeometry(0.9, 2.2, 0.9), stoneMat)
        ensureVertexColors(ch.geometry)
        const chx = hd.x + rng.range(-hd.w / 3, hd.w / 3), chz = z + rng.range(-1, 1)
        ch.position.set(chx, baseH + wallH + 2, chz)
        this.scene.add(ch)
        if (!this.smokeAnchors) this.smokeAnchors = []
        if (this.smokeAnchors.length < 2) this.smokeAnchors.push(new THREE.Vector3(chx, baseH + wallH + 3.2, chz))
      }
      // collider height = wallH only, so roof-walkers (y ≈ wallH+1) pass over
      this.addAABB(hd.x - hd.w / 2, hd.x + hd.w / 2, z - hd.d / 2, z + hd.d / 2, wallH, baseH)
      if (hd.bakery) this.bakeryPos = { x: hd.x, z, baseH }
      // pre-lit amber windows on the street face (Rule 5: lit windows imply
      // life; Rule 2: window amber IS this zone's warm accent). Panes are
      // collected and merged into 3 flicker groups (draw-call budget).
      if (!this.warmWindowGeos) this.warmWindowGeos = [[], [], []]
      const faceZ = hd.side === -1 ? z + hd.d / 2 + 0.03 : z - hd.d / 2 - 0.03
      const nWin = rng.int(1, 2)
      for (let wi = 0; wi < nWin; wi++) {
        const wx2 = hd.x + (nWin === 1 ? rng.range(-1, 1) : (wi === 0 ? -hd.w / 4 : hd.w / 4))
        const geo = new THREE.PlaneGeometry(0.85, 1.05)
        ensureVertexColors(geo)
        if (hd.side === 1) geo.rotateY(Math.PI)
        geo.translate(wx2, baseH + rng.range(1.6, 2.6), faceZ)
        this.warmWindowGeos[rng.int(0, 2)].push(geo)
      }
    }

    // P.4 fingerprint (village): a chipped mug abandoned on a stool by the
    // bakery door — the baker meant to come back for it
    if (this.bakeryPos) {
      const glaze = retroMaterial({ map: TEX.white() })
      const stool = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.19, 0.48, 7), mats.plank)
      ensureVertexColors(stool.geometry, [0.55, 0.48, 0.4])
      const mx = this.bakeryPos.x - 2.3, mz = this.bakeryPos.z + 4.55
      stool.position.set(mx, this.bakeryPos.baseH + 0.24, mz)
      this.scene.add(stool)
      const mug = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.05, 0.09, 8), glaze)
      ensureVertexColors(mug.geometry, [0.34, 0.55, 0.54])
      mug.position.set(mx + 0.03, this.bakeryPos.baseH + 0.48 + 0.045, mz)
      this.scene.add(mug)
      const handle = new THREE.Mesh(new THREE.TorusGeometry(0.032, 0.011, 5, 8, Math.PI), glaze)
      ensureVertexColors(handle.geometry, [0.34, 0.55, 0.54])
      handle.position.set(mx + 0.03 + 0.06, this.bakeryPos.baseH + 0.48 + 0.05, mz)
      handle.rotation.z = -Math.PI / 2
      this.scene.add(handle)
      const chip = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.02, 0.02), glaze)
      ensureVertexColors(chip.geometry, [0.16, 0.2, 0.2]) // the dark notch in the rim
      chip.position.set(mx + 0.03 - 0.045, this.bakeryPos.baseH + 0.48 + 0.085, mz + 0.02)
      this.scene.add(chip)
    }

    // the spire tower with a handless clock face (landmark), east end
    const towerX = 145, towerZ = streetZ(145) - 6
    const towerH = 16
    const towerBase = heightAt(towerX, towerZ)
    const towerBody = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 3.8, towerH, 10), stoneMat)
    ensureVertexColors(towerBody.geometry)
    towerBody.position.set(towerX, towerBase + towerH / 2, towerZ)
    this.scene.add(towerBody)
    const spire = new THREE.Mesh(new THREE.ConeGeometry(3.6, 7, 10), shingleMat)
    ensureVertexColors(spire.geometry)
    spire.position.set(towerX, towerBase + towerH + 3.5, towerZ)
    this.scene.add(spire)
    // handless clock face
    const clock = new THREE.Mesh(new THREE.CircleGeometry(1.5, 12), retroMaterial({ map: TEX.white(), emissive: 0x2a2417 }))
    ensureVertexColors(clock.geometry)
    clock.position.set(towerX - 3.0, towerBase + towerH - 2.5, towerZ + 1.2)
    clock.rotation.y = -Math.PI / 2.4
    this.scene.add(clock)
    this.colliders.push({ x: towerX, z: towerZ, r: 4, h: towerH })

    // market square + covered well (halfway, south side)
    const wx = 110, wz = streetZ(110) + 7
    const wellBase = heightAt(wx, wz)
    const wellRing = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.3, 0.9, 10, 1, true), stoneMat)
    ensureVertexColors(wellRing.geometry)
    wellRing.position.set(wx, wellBase + 0.45, wz)
    this.scene.add(wellRing)
    const wellRoof = new THREE.Mesh(new THREE.ConeGeometry(1.8, 1.2, 8), shingleMat)
    ensureVertexColors(wellRoof.geometry)
    wellRoof.position.set(wx, wellBase + 3.1, wz)
    this.scene.add(wellRoof)
    for (const sx of [-1, 1]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 2.6, 6), mats.plank)
      ensureVertexColors(post.geometry)
      post.position.set(wx + sx * 1.1, wellBase + 1.3, wz)
      this.scene.add(post)
    }
    this.colliders.push({ x: wx, z: wz, r: 1.5, h: 2 })
    // well lantern (cold light) hangs under the well roof
    const wellLan = hangingLantern({ accent: '#f0a848' })
    wellLan.group.position.set(wx, wellBase + 2.55, wz)
    this.scene.add(wellLan.group)
    this.sways.push(wellLan.group)
    this.registerLight('village-well-lantern', 'village', wellLan, wx, wz, wellBase + 2.55)

    // 4 iron lamp posts up the street (cold lights)
    const lampXs = [88, 104, 120, 136]
    lampXs.forEach((lx, i) => {
      const lz = streetZ(lx) + (i % 2 === 0 ? 3.4 : -3.4)
      const lamp = lampPost({ lit: false })
      this.place(lamp.group, lx, lz)
      this.registerLight(`village-post-${i + 1}`, 'village', lamp, lx, lz)
    })

    // — village props: crates, barrels, hanging signs, flower boxes, handcart, rain barrels —
    const propRng = worldRNG.fork('villageProps')
    for (const [px, side] of [[100, 1], [109, -1], [117, 1], [126, -1], [131, 1]]) {
      const pz = streetZ(px) + side * 4.6
      const py = heightAt(px, pz)
      if (propRng.chance(0.6)) {
        const crate = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.7, 0.7), mats.plank)
        ensureVertexColors(crate.geometry)
        crate.position.set(px, py + 0.35, pz)
        crate.rotation.y = propRng.range(0, 1)
        this.scene.add(crate)
        this.colliders.push({ x: px, z: pz, r: 0.55, h: 0.8 })
      } else {
        const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.36, 0.8, 9), mats.plank)
        ensureVertexColors(barrel.geometry)
        barrel.position.set(px, py + 0.4, pz)
        this.scene.add(barrel)
        this.colliders.push({ x: px, z: pz, r: 0.45, h: 0.9 })
      }
    }
    // hanging shop signs (sway) on two houses
    for (const sx of [103, 128]) {
      const sz2 = streetZ(sx) + (sx === 103 ? -5.4 : 4.4)
      const sy = heightAt(sx, sz2) + 3.2
      const bracket = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.06, 0.06), sharedMats().iron)
      ensureVertexColors(bracket.geometry)
      bracket.position.set(sx, sy + 0.4, sz2)
      this.scene.add(bracket)
      const signG = new THREE.Group()
      const board = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.5, 0.05), mats.plank)
      ensureVertexColors(board.geometry)
      board.position.y = -0.35
      signG.add(board)
      signG.position.set(sx + 0.35, sy + 0.38, sz2)
      this.scene.add(signG)
      this.sways.push(signG)
    }
    // flower boxes under two windows + a handcart + rain barrels
    for (const fx of [106, 122]) {
      const fz = streetZ(fx) - 5.4
      const box = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.22, 0.3), mats.plank)
      ensureVertexColors(box.geometry)
      box.position.set(fx, heightAt(fx, fz) + 1.2, fz)
      this.scene.add(box)
      const bloomMat = retroMaterial({ map: TEX.white(), hemi: true })
      for (let i = 0; i < 4; i++) {
        const bloom = new THREE.Mesh(new THREE.SphereGeometry(0.05, 5, 4), bloomMat)
        ensureVertexColors(bloom.geometry, propRng.chance(0.5) ? [0.75, 0.45, 0.55] : [0.7, 0.65, 0.35])
        bloom.position.set(fx - 0.4 + i * 0.26, heightAt(fx, fz) + 1.36, fz)
        this.scene.add(bloom)
      }
    }
    {
      const cart = new THREE.Group()
      const bed = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.16, 0.9), mats.plank)
      ensureVertexColors(bed.geometry)
      bed.position.y = 0.55
      bed.rotation.z = -0.12
      cart.add(bed)
      for (const s of [-1, 1]) {
        const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.08, 10), mats.plank)
        ensureVertexColors(wheel.geometry)
        wheel.rotation.x = Math.PI / 2
        wheel.position.set(0.1, 0.34, s * 0.5)
        cart.add(wheel)
        const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.0, 5), mats.plank)
        ensureVertexColors(handle.geometry)
        handle.rotation.z = 1.25
        handle.position.set(-0.85, 0.42, s * 0.3)
        cart.add(handle)
      }
      cart.userData.collider = { r: 0.9, h: 0.8 }
      this.place(cart, 113.5, streetZ(113.5) - 4.9, 0.5)
    }
    for (const bx of [104.5, 130.5]) {
      const bz = streetZ(bx) - 5.2
      const rb = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.4, 0.9, 9), mats.plank)
      ensureVertexColors(rb.geometry)
      rb.position.set(bx, heightAt(bx, bz) + 0.45, bz)
      this.scene.add(rb)
      this.colliders.push({ x: bx, z: bz, r: 0.5, h: 1 })
    }

    // bakery window: warm glass pane, kindling lights it from inside (cold light)
    if (this.bakeryPos) {
      const bp = this.bakeryPos
      const glassMat = retroMaterial({ map: TEX.white(), emissive: 0xf0a848, transparent: true, opacity: 0.85, depthWrite: false })
      const pane = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 1.1), glassMat)
      ensureVertexColors(pane.geometry)
      pane.position.set(bp.x - 1.5, bp.baseH + 1.6, bp.z + 4.05)
      this.scene.add(pane)
      const haloMat = retroMaterial({ map: TEX.glowDot({ color: '#f0a848' }), transparent: true, depthWrite: false, opacity: 0.5 })
      haloMat.blending = THREE.AdditiveBlending
      const halo = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 2.2), haloMat)
      ensureVertexColors(halo.geometry)
      halo.position.set(bp.x - 1.5, bp.baseH + 1.6, bp.z + 4.15)
      this.scene.add(halo)
      pane.visible = halo.visible = false
      this.registerLight('village-bakery-window', 'village', { glass: pane, halo, flame: null, pool: null, flameH: 1.6 }, bp.x - 1.5, bp.z + 4.1, bp.baseH)
    }

    // merge collected window panes into 3 hearth-flicker groups
    this.warmWindows = []
    for (const geos of this.warmWindowGeos) {
      if (!geos.length) continue
      const winMat = retroMaterial({ map: TEX.window(), transparent: true, opacity: 0.95, depthWrite: false, emissive: '#5a3c14' })
      const mesh = new THREE.Mesh(mergeGeometries(geos, false), winMat)
      mesh.userData.dyn = true
      this.scene.add(mesh)
      this.warmWindows.push({ mesh, seed: worldRNG.range(0, 10), base: 0.95 })
    }

    this.poses.village = { pos: [90, streetH(90) + 1.5, streetZ(90) + 1.4], look: [132, streetH(132) + 6.5, streetZ(132)], minute: 6 }
  }

  buildRooftops() {
    const rng = worldRNG.fork('rooftops')
    const mats = sharedMats()
    const stoneMat = retroMaterial({ map: TEX.stoneBlock({ name: 'stoneRoof' }) })
    // rooftop garden bed + tiny pine near the bakery chimney (Nib's spot, M4)
    const roofH = (x) => streetH(x) + 5.6
    const bed = new THREE.Mesh(new THREE.BoxGeometry(3, 0.3, 2), mats.plank)
    ensureVertexColors(bed.geometry)
    bed.position.set(116, roofH(116) + 0.15, streetZ(116) - 9)
    this.scene.add(bed)
    const pine = new THREE.Group()
    for (let i = 0; i < 3; i++) {
      const cone = new THREE.Mesh(new THREE.ConeGeometry(0.5 - i * 0.12, 0.6, 7), mats.canopy)
      ensureVertexColors(cone.geometry)
      cone.position.y = 0.5 + i * 0.45
      pine.add(cone)
    }
    const pineTrunk = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 0.5, 5), mats.bark)
    ensureVertexColors(pineTrunk.geometry)
    pineTrunk.position.y = 0.25
    pine.add(pineTrunk)
    pine.position.set(118.5, roofH(118.5), streetZ(118.5) - 8.5)
    this.scene.add(pine)

    // 2 chimney-side lanterns on shepherd-hook posts (cold lights)
    const hookPost = (x, z) => {
      const g = new THREE.Group()
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 1.9, 6), mats.iron)
      ensureVertexColors(pole.geometry)
      pole.position.y = 0.95
      g.add(pole)
      const curve = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.03, 5, 8, Math.PI * 0.9), mats.iron)
      ensureVertexColors(curve.geometry)
      curve.position.set(0.1, 1.88, 0)
      curve.rotation.z = -0.5
      g.add(curve)
      g.position.set(x, roofH(x), z)
      this.scene.add(g)
      return g
    }
    // kindled roof lights bloom warm pools onto the shingles (AA.2) — the
    // hanging lantern builder has no ground under it, so the pool is ours
    const roofPool = (px, pz, py, size = 3.4) => {
      const pool = new THREE.Mesh(new THREE.PlaneGeometry(size, size), (() => {
        const m = retroMaterial({ map: TEX.glowDot({ name: 'roofpool', color: '#f08a20' }), transparent: true, depthWrite: false, opacity: 1.0 })
        m.blending = THREE.AdditiveBlending
        return m
      })())
      ensureVertexColors(pool.geometry)
      pool.rotation.x = -Math.PI / 2
      pool.position.set(px, py + 0.17, pz) // above the visual shingle tops
      pool.visible = false
      pool.userData.dyn = true
      this.scene.add(pool)
      return pool
    }
    for (const [i, lx, lz] of [[1, 119.5, streetZ(119.5) - 10.3], [2, 127, streetZ(127) - 7.6]]) {
      hookPost(lx, lz)
      const l = hangingLantern({ accent: '#e8a84a' })
      l.group.position.set(lx + 0.28, roofH(lx) + 1.85, lz)
      this.scene.add(l.group)
      this.sways.push(l.group)
      l.pool = roofPool(lx + 0.28, lz, roofH(lx), 4.4)
      this.registerLight(`rooftops-lantern-${i}`, 'rooftops', l, lx + 0.28, lz, roofH(lx) + 1.85)
    }
    // AA.4: roof-ridge chimneys + a sagging clothesline — the strip's skyline
    // stops being an empty plane; cloth silhouettes catch the moon
    const chimneyAt = (cx, cz, h = 1.25) => {
      const g = new THREE.Group()
      const stack = new THREE.Mesh(new THREE.BoxGeometry(0.72, h, 0.72), stoneMat)
      ensureVertexColors(stack.geometry)
      stack.position.y = h / 2
      g.add(stack)
      const cap = new THREE.Mesh(new THREE.BoxGeometry(0.94, 0.14, 0.94), stoneMat)
      ensureVertexColors(cap.geometry, [0.8, 0.8, 0.8])
      cap.position.y = h + 0.07
      g.add(cap)
      g.position.set(cx, roofH(cx), cz)
      this.scene.add(g)
      this.colliders.push({ x: cx, z: cz, r: 0.6, h, y0: roofH(cx) })
      return g
    }
    const ch1 = chimneyAt(121.6, streetZ(121.6) - 12.1, 1.35)
    const ch2 = chimneyAt(125.4, streetZ(125.4) - 11.4, 1.05)
    // clothesline: one line, three cloths, one odd sock (P.4's fingerprint)
    {
      const p1 = ch1.position.clone().add(new THREE.Vector3(0, 1.32, 0))
      const p2 = ch2.position.clone().add(new THREE.Vector3(0, 1.02, 0))
      const mid = p1.clone().lerp(p2, 0.5); mid.y -= 0.35 // the sag
      const lineGeo = new THREE.BufferGeometry().setFromPoints(
        new THREE.QuadraticBezierCurve3(p1, mid, p2).getPoints(12))
      const line = new THREE.Line(lineGeo, new THREE.LineBasicMaterial({ color: 0x8a8a92 }))
      this.scene.add(line)
      const clothMat = retroMaterial({ map: TEX.white(), hemi: true, side: THREE.DoubleSide })
      const curve = new THREE.QuadraticBezierCurve3(p1, mid, p2)
      const cloths = [
        { t: 0.3, w: 0.5, h: 0.62, tint: [0.52, 0.5, 0.46] },
        { t: 0.52, w: 0.44, h: 0.5, tint: [0.44, 0.46, 0.5] },
        { t: 0.72, w: 0.16, h: 0.3, tint: [0.55, 0.38, 0.3] }, // the odd sock
      ]
      for (const c of cloths) {
        const cloth = new THREE.Mesh(new THREE.PlaneGeometry(c.w, c.h), clothMat)
        ensureVertexColors(cloth.geometry, c.tint)
        const pt = curve.getPoint(c.t)
        cloth.position.set(pt.x, pt.y - c.h / 2, pt.z)
        cloth.rotation.y = Math.atan2(p2.x - p1.x, p2.z - p1.z) + Math.PI / 2
        cloth.userData.dyn = true
        this.scene.add(cloth)
        this.sways.push(cloth)
      }
    }

    // stargazer's telescope + brazier
    const scope = new THREE.Group()
    const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 1.2, 7), stoneMat)
    ensureVertexColors(tube.geometry)
    tube.rotation.z = 0.7
    tube.position.y = 1.1
    scope.add(tube)
    const tripodMat = mats.iron
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.04, 1.1, 4), tripodMat)
      ensureVertexColors(leg.geometry)
      leg.position.set(Math.cos(a) * 0.3, 0.55, Math.sin(a) * 0.3)
      leg.rotation.z = Math.cos(a) * 0.3
      leg.rotation.x = -Math.sin(a) * 0.3
      scope.add(leg)
    }
    scope.position.set(133, roofH(133), streetZ(133) - 9.5)
    this.scene.add(scope)
    const scopeBrazier = brazier({ scale: 0.7 })
    scopeBrazier.group.position.set(134.5, roofH(134.5), streetZ(134.5) - 9)
    this.scene.add(scopeBrazier.group)
    scopeBrazier.pool = roofPool(134.5, streetZ(134.5) - 9, roofH(134.5), 2.8)
    this.registerLight('rooftops-telescope-brazier', 'rooftops', scopeBrazier, 134.5, streetZ(134.5) - 9, roofH(134.5))

    // low over the moss at Nib, cobalt sky filling the frame (Part 3.2.3)
    // on the roof itself, looking west along the strip: hook lantern + Nib's
    // pine mid-frame, the village spire and open cobalt sky beyond
    // recomposed (AA.4): Nib + his pine + chimney line as the middle-ground
    // subject, moss roofs leading left, moon low over the western roofline
    // shot along the prop line from the NE: Nib's pine + lantern + chimneys
    // + clothesline, the low moon dead ahead over the western roofline
    // look held near level: half the frame was an empty shadowed roof slope
    this.poses.rooftops = { pos: [121.4, roofH(121.4) + 0.75, streetZ(121.4) - 8.6], look: [118.9, roofH(118.9) + 0.8, streetZ(118.9) - 11.4], minute: 33 }
    // close on Nib for the sleeper evidence shots
    this.poses.nib = { pos: [119.6, roofH(119.6) + 0.55, streetZ(119.6) - 11.1], look: [118.2, roofH(118.2) + 0.2, streetZ(118.2) - 10.0] }
  }

  buildRuins() {
    const rng = worldRNG.fork('ruins')
    const marbleTex = TEX.stoneBlock({ name: 'marble', base: '#8a8494' })
    marbleTex.repeat.set(1, 2)
    const marbleMat = retroMaterial({ map: marbleTex })
    // colonnade: 6 columns along the avenue (z≈±4), 2 intact
    const colXs = [-92, -100, -108, -116, -124, -132]
    colXs.forEach((cx, i) => {
      const intact = i === 1 || i === 4
      const side = i % 2 === 0 ? 1 : -1
      const cz = side * 4.5
      const h = intact ? 7 : rng.range(2, 3.6)
      const col = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.65, h, 9), marbleMat)
      ensureVertexColors(col.geometry)
      col.position.set(cx, heightAt(cx, cz) + h / 2, cz)
      this.scene.add(col)
      this.colliders.push({ x: cx, z: cz, r: 0.75, h })
      if (intact) {
        const cap = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.5, 1.6), retroMaterial({ map: TEX.stoneBlock({ name: 'bluecap', base: '#3a4a7a' }) }))
        ensureVertexColors(cap.geometry)
        cap.position.set(cx, heightAt(cx, cz) + h + 0.25, cz)
        this.scene.add(cap)
      }
      // arcane sconces on 4 of the columns (CYAN cold lights)
      if (i < 4) {
        const sc = sconce({ accent: '#7fd4d4', cool: true })
        sc.group.position.set(cx, heightAt(cx, cz) + Math.min(h, 2.2), cz - side * 0.7)
        this.scene.add(sc.group)
        this.registerLight(`ruins-sconce-${i + 1}`, 'ruins', sc, cx, cz - side * 0.7, heightAt(cx, cz) + Math.min(h, 2.2))
      }
    })
    // arched ruin façade (west end)
    const fx = -138
    const ruinTex = TEX.stoneBlock({ name: 'ruinstone', base: '#6a5f74' })
    ruinTex.repeat.set(1, 3)
    const stoneR = retroMaterial({ map: ruinTex })
    for (const sz of [-3, 3]) {
      const pillar = new THREE.Mesh(new THREE.BoxGeometry(1.6, 8, 1.6), stoneR)
      ensureVertexColors(pillar.geometry)
      pillar.position.set(fx, heightAt(fx, sz) + 4, sz)
      this.scene.add(pillar)
      this.colliders.push({ x: fx, z: sz, r: 1.1, h: 8 })
    }
    const lintel = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.6, 8.6), stoneR)
    ensureVertexColors(lintel.geometry)
    lintel.position.set(fx, heightAt(fx, 0) + 8.6, 0)
    this.scene.add(lintel)
    // domed shrine (north side)
    const shx = -114, shz = -14
    const shBase = new THREE.Mesh(new THREE.CylinderGeometry(3.4, 3.6, 2.4, 10), stoneR)
    ensureVertexColors(shBase.geometry)
    shBase.position.set(shx, heightAt(shx, shz) + 1.2, shz)
    this.scene.add(shBase)
    const dome = new THREE.Mesh(new THREE.SphereGeometry(3.2, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), marbleMat)
    ensureVertexColors(dome.geometry)
    dome.position.set(shx, heightAt(shx, shz) + 2.4, shz)
    this.scene.add(dome)
    this.colliders.push({ x: shx, z: shz, r: 3.8, h: 5 })
    // the Rune Stone monolith (landmark, left of the avenue)
    const mx = -104, mz = 8
    const mono = new THREE.Mesh(new THREE.BoxGeometry(1.4, 5.4, 0.9), retroMaterial({ map: TEX.stoneBlock({ name: 'monolith', base: '#242030' }) }))
    ensureVertexColors(mono.geometry)
    mono.position.set(mx, heightAt(mx, mz) + 2.7, mz)
    mono.rotation.y = 0.3
    this.scene.add(mono)
    this.colliders.push({ x: mx, z: mz, r: 1.1, h: 5.4 })
    const glyphMat = retroMaterial({ map: TEX.glowDot({ color: '#7fd4d4' }), transparent: true, depthWrite: false, opacity: 0.9 })
    glyphMat.blending = THREE.AdditiveBlending
    const glyph = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 1.6), glyphMat)
    ensureVertexColors(glyph.geometry)
    glyph.position.set(mx - 0.2, heightAt(mx, mz) + 3, mz - 0.55)
    glyph.rotation.y = Math.PI + 0.3
    this.scene.add(glyph)
    // the moonwell (dry until kindled — 5th light)
    const wx2 = -118, wz2 = 12
    const wellBasin = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.5, 1, 12, 1, true), marbleMat)
    ensureVertexColors(wellBasin.geometry)
    wellBasin.position.set(wx2, heightAt(wx2, wz2) + 0.5, wz2)
    this.scene.add(wellBasin)
    this.colliders.push({ x: wx2, z: wz2, r: 2.7, h: 1 })
    const wellGlowMat = retroMaterial({ map: TEX.glowDot({ color: '#aef2f2' }), transparent: true, depthWrite: false, opacity: 0.85 })
    wellGlowMat.blending = THREE.AdditiveBlending
    const wellGlow = new THREE.Mesh(new THREE.CircleGeometry(2.1, 16), wellGlowMat)
    ensureVertexColors(wellGlow.geometry)
    wellGlow.rotation.x = -Math.PI / 2
    wellGlow.position.set(wx2, heightAt(wx2, wz2) + 0.85, wz2)
    this.scene.add(wellGlow)
    wellGlow.visible = false
    // kindling FILLS the well: glowing water surface fades in (6.1/3.2.4)
    const wellWaterTex = TEX.water({ name: 'moonwellwater', base: '#2a6a72', light: '#7fd4d4' })
    wellWaterTex.repeat.set(3, 3)
    const wellWater = new THREE.Mesh(new THREE.CircleGeometry(2.05, 16), retroMaterial({ map: wellWaterTex, transparent: true, opacity: 0.9, emissive: '#0e3038' }))
    ensureVertexColors(wellWater.geometry)
    wellWater.rotation.x = -Math.PI / 2
    wellWater.position.set(wx2, heightAt(wx2, wz2) + 0.78, wz2)
    this.scene.add(wellWater)
    wellWater.visible = false
    this.waterMats.push({ tex: wellWaterTex, sx: 0.006, sy: 0.004 })
    this.registerLight('ruins-moonwell', 'ruins', { glass: wellWater, halo: wellGlow, flame: null, pool: null, flameH: 0.85 }, wx2, wz2, heightAt(wx2, wz2))
    // co-op floor glyphs (Part 3.2.4): 2–4 shown scaled to lobby (Moments decides
    // visibility); stand on one to brighten the well, full lobby → sky beam
    this.ruinsGlyphs = []
    const glyphTex = TEX.ring({ name: 'wellglyph', color: '#9fe8e8' })
    for (let gi = 0; gi < 4; gi++) {
      const ga = Math.PI * 0.25 + gi * (Math.PI * 0.5)
      const gxx = wx2 + Math.cos(ga) * 4.6, gzz = wz2 + Math.sin(ga) * 4.6
      const gm = retroMaterial({ map: glyphTex, transparent: true, depthWrite: false, opacity: 0.2, emissive: '#123434' })
      gm.blending = THREE.AdditiveBlending
      const gMesh = new THREE.Mesh(new THREE.CircleGeometry(0.85, 12), gm)
      ensureVertexColors(gMesh.geometry)
      gMesh.rotation.x = -Math.PI / 2
      gMesh.position.set(gxx, heightAt(gxx, gzz) + 0.06, gzz)
      this.scene.add(gMesh)
      this.ruinsGlyphs.push({ x: gxx, z: gzz, mesh: gMesh, lit: 0 })
    }
    // the sky beam over the well (hidden until the full lobby stands the glyphs)
    const beamMat = retroMaterial({ map: TEX.glowDot({ color: '#bff4f0' }), transparent: true, depthWrite: false, opacity: 0, noFog: true })
    beamMat.blending = THREE.AdditiveBlending
    beamMat.side = THREE.DoubleSide
    this.wellBeam = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 2.0, 60, 10, 1, true), beamMat)
    ensureVertexColors(this.wellBeam.geometry)
    this.wellBeam.position.set(wx2, heightAt(wx2, wz2) + 30, wz2)
    this.wellBeam.visible = false
    this.scene.add(this.wellBeam)
    // fallen drums
    for (let i = 0; i < 5; i++) {
      const dx = rng.range(-130, -92), dz = rng.range(-10, 12)
      if (Math.abs(dz) < 3) continue
      const drum = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, rng.range(0.8, 1.4), 9), marbleMat)
      ensureVertexColors(drum.geometry)
      drum.rotation.z = Math.PI / 2
      drum.rotation.y = rng.range(0, Math.PI)
      drum.position.set(dx, heightAt(dx, dz) + 0.55, dz)
      this.scene.add(drum)
    }
    // purple flower meadow (north-east quarter) — magenta cross-quads
    const meadowRng = worldRNG.fork('meadow')
    const flowerMat = retroMaterial({ map: TEX.white(), hemi: true, side: THREE.DoubleSide })
    const meadow = new THREE.Group()
    for (let i = 0; i < 70; i++) {
      const fx = meadowRng.range(-124, -96), fz = meadowRng.range(6, 20)
      if (Math.abs(fz) < 4) continue
      const col = meadowRng.chance(0.5) ? [0.78, 0.53, 0.82] : [0.71, 0.43, 0.75]
      for (let k = 0; k < 2; k++) {
        const q = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.22), flowerMat)
        ensureVertexColors(q.geometry, col)
        q.position.set(fx, heightAt(fx, fz) + 0.11, fz)
        q.rotation.y = k * Math.PI / 2 + meadowRng.range(-0.3, 0.3)
        meadow.add(q)
      }
    }
    this.scene.add(meadow)
    // floating mote crystals (bobbing, faint cyan)
    this.crystals = []
    const crysMat = retroMaterial({ map: TEX.white(), transparent: true, opacity: 0.7, emissive: '#0e2a2a' })
    for (let i = 0; i < 4; i++) {
      const cxr = meadowRng.range(-126, -100), czr = meadowRng.range(-8, 14)
      const cry = new THREE.Mesh(new THREE.OctahedronGeometry(0.16), crysMat)
      ensureVertexColors(cry.geometry, [0.5, 0.83, 0.83])
      cry.position.set(cxr, heightAt(cxr, czr) + meadowRng.range(0.8, 1.6), czr)
      this.scene.add(cry)
      this.crystals.push({ mesh: cry, baseY: cry.position.y, seed: meadowRng.range(0, 10) })
    }
    // half-buried owl statue
    const owl = new THREE.Group()
    const owlMat = retroMaterial({ map: TEX.stoneBlock({ name: 'owlstone', base: '#7a7284' }) })
    const owlBody = new THREE.Mesh(new THREE.SphereGeometry(0.55, 8, 6), owlMat)
    ensureVertexColors(owlBody.geometry)
    owlBody.scale.set(0.9, 1.1, 0.8)
    owl.add(owlBody)
    for (const sx of [-1, 1]) {
      const tuft = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.3, 5), owlMat)
      ensureVertexColors(tuft.geometry)
      tuft.position.set(sx * 0.3, 0.55, 0)
      owl.add(tuft)
      const eye = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.03, 8), owlMat)
      ensureVertexColors(eye.geometry, [0.6, 0.56, 0.66])
      eye.rotation.x = Math.PI / 2
      eye.position.set(sx * 0.2, 0.25, 0.42)
      owl.add(eye)
    }
    owl.position.set(-99, heightAt(-99, -9) - 0.25, -9) // half-buried
    owl.rotation.z = 0.35
    this.scene.add(owl)
    // P.4 fingerprint (ruins): a child's pebble tower at a colonnade base —
    // five stones balanced in a place nobody has played in a long time
    {
      const pebMat = retroMaterial({ map: TEX.stoneBlock({ name: 'pebbletower', base: '#5a5462' }) })
      let py = heightAt(-104.6, 3.4)
      const prng = worldRNG.fork('pebbletower')
      for (let i = 0; i < 5; i++) {
        const r = 0.09 - i * 0.014
        const peb = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 0), pebMat)
        ensureVertexColors(peb.geometry, [0.72 + i * 0.03, 0.7 + i * 0.03, 0.76])
        peb.scale.y = 0.7
        peb.position.set(-104.6 + prng.range(-0.012, 0.012), py + r * 0.7, 3.4 + prng.range(-0.012, 0.012))
        peb.rotation.y = prng.range(0, Math.PI)
        this.scene.add(peb)
        py += r * 1.15
      }
    }

    this.poses.ruins = { pos: [-91, heightAt(-91, 2.5) + 1.6, 2.5], look: [-132, heightAt(-132, 0) + 3.5, 0], minute: 29 }
  }

  buildGloomspire() {
    const rng = worldRNG.fork('gloomspire')
    {
      const moatTex = TEX.water({ name: 'moatwater', base: '#141024', light: '#2a2344' })
      moatTex.repeat.set(10, 10)
      const moat = new THREE.Mesh(new THREE.CircleGeometry(31, 28), retroMaterial({ map: moatTex, ripple: true }))
      ensureVertexColors(moat.geometry)
      moat.rotation.x = -Math.PI / 2
      moat.position.set(-110, -0.9, 125)
      this.scene.add(moat)
      this.waterMats.push({ tex: moatTex, sx: 0.004, sy: 0.006 })
    }
    const gloomTex = TEX.stoneBlock({ name: 'gloomstone', base: '#2c2436' })
    gloomTex.repeat.set(3, 3)
    const darkStone = retroMaterial({ map: gloomTex })
    const greenTex = TEX.shingle({ name: 'greenroof', base: '#2a5c44', moss: 0.5 })
    greenTex.repeat.set(2, 2)
    const greenShingle = retroMaterial({ map: greenTex })
    const cx = -110, cz = 125

    // castle main block + 3 towers with green cone roofs
    const keep = new THREE.Mesh(new THREE.BoxGeometry(16, 12, 10), darkStone)
    ensureVertexColors(keep.geometry)
    keep.position.set(cx, heightAt(cx, cz) + 6, cz + 2)
    this.scene.add(keep)

    // P.4 fingerprint (gloomspire): a stones-game tally scratched beside the
    // gate — the watch played to pass the years, and nobody kept the score
    {
      const tally = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.5),
        retroMaterial({ map: TEX.scratchTag({ name: 'gatetally', kind: 'tally', color: '#9a9284' }), alphaTest: 0.3 }))
      ensureVertexColors(tally.geometry, [0.85, 0.82, 0.75])
      tally.position.set(cx - 3.4, heightAt(cx, cz - 3) + 1.35, cz - 3.03)
      tally.rotation.y = Math.PI
      this.scene.add(tally)
    }
    this.addAABB(cx - 8, cx + 8, cz - 3, cz + 7, 12, heightAt(cx, cz))
    const towerDefs = [[cx - 7, cz - 2, 15], [cx + 7, cz - 2, 13], [cx - 6.5, cz + 7, 18]] // keep the door corridor clear
    for (const [tx, tz, th] of towerDefs) {
      const t = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.8, th, 9), darkStone)
      ensureVertexColors(t.geometry)
      t.position.set(tx, heightAt(cx, cz) + th / 2, tz)
      this.scene.add(t)
      const cone = new THREE.Mesh(new THREE.ConeGeometry(3, 4.5, 9), greenShingle)
      ensureVertexColors(cone.geometry)
      cone.position.set(tx, heightAt(cx, cz) + th + 2.2, tz)
      this.scene.add(cone)
      this.colliders.push({ x: tx, z: tz, r: 3, h: th })
    }
    // toxic green windows — EVERY window glows green (Part 3.2.5); pre-lit set
    // dressing with gentle flicker, plus additive halos so they read in fog
    // Panes + halos merge into 3 flicker groups each (draw-call budget, D6);
    // noFog on both: the glow blooms THROUGH the mist (the reference look).
    const gwPanes = [[], [], []]
    const gwHalos = [[], [], []]
    let gwI = 0
    const addGreenWindow = (x, y, z, ry = Math.PI) => {
      const paneGeo = new THREE.PlaneGeometry(1.0, 1.5)
      ensureVertexColors(paneGeo)
      paneGeo.rotateY(ry)
      paneGeo.translate(x, y, z)
      gwPanes[gwI % 3].push(paneGeo)
      const haloGeo = new THREE.PlaneGeometry(3.0, 3.0)
      ensureVertexColors(haloGeo)
      haloGeo.rotateY(ry)
      haloGeo.translate(x, y, z + (ry === Math.PI ? -0.05 : 0.05))
      gwHalos[gwI % 3].push(haloGeo)
      gwI++
    }
    for (let i = 0; i < 8; i++) {
      const wxr = cx + rng.range(-6.5, 6.5)
      const wyr = heightAt(cx, cz) + rng.range(3, 10)
      addGreenWindow(wxr, wyr, cz - 3.05)
    }
    // tower windows
    for (const [tx, tz, th] of towerDefs) {
      addGreenWindow(tx, heightAt(cx, cz) + th * 0.7, tz - 2.85)
      if (th > 14) addGreenWindow(tx, heightAt(cx, cz) + th * 0.45, tz - 2.85)
    }
    this.greenWindows = []
    for (let gi = 0; gi < 3; gi++) {
      if (!gwPanes[gi].length) continue
      const win = new THREE.Mesh(mergeGeometries(gwPanes[gi], false), retroMaterial({ map: TEX.window({ name: 'greenwin', green: true }), transparent: true, opacity: 0.9, depthWrite: false, emissive: '#3a8a34', noFog: true }))
      win.userData.dyn = true
      this.scene.add(win)
      const haloMat = retroMaterial({ map: TEX.glowDot({ color: '#58e050' }), transparent: true, depthWrite: false, opacity: 0.72, noFog: true })
      haloMat.blending = THREE.AdditiveBlending
      const halo = new THREE.Mesh(mergeGeometries(gwHalos[gi], false), haloMat)
      halo.userData.dyn = true
      this.scene.add(halo)
      this.greenWindows.push({ mesh: win, halo, seed: rng.range(0, 10) })
    }
    // the one dark red door (leads to the Hall behind)
    const door = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 3.6), retroMaterial({ map: TEX.white() }))
    ensureVertexColors(door.geometry, [0.42, 0.07, 0.07])
    door.position.set(cx, heightAt(cx, cz) + 1.8, cz - 3.02)
    door.rotation.y = Math.PI
    this.scene.add(door)
    // door opening: gap in the AABB — carve by splitting the front wall collider
    // (the keep AABB starts at cz-3; the door gap is handled by a tunnel AABB pair)
    this.aabbs.pop() // remove the solid keep box; replace with walls around a corridor
    const y0 = heightAt(cx, cz)
    this.addAABB(cx - 8, cx - 1.4, cz - 3, cz + 7, 12, y0)   // left half
    this.addAABB(cx + 1.4, cx + 8, cz - 3, cz + 7, 12, y0)   // right half
    // corridor from door through to the hall (z cz-3 → cz+7 open at x±1.4)

    // gatehouse with an open passage (north edge of the moat)
    const gx = -110, gz = 103
    const gy = heightAt(gx, gz)
    for (const sx of [-1, 1]) {
      const pillar = new THREE.Mesh(new THREE.BoxGeometry(2.2, 6, 3), darkStone)
      ensureVertexColors(pillar.geometry)
      pillar.position.set(gx + sx * 2.6, gy + 3, gz)
      this.scene.add(pillar)
    }
    const gateTop = new THREE.Mesh(new THREE.BoxGeometry(7.4, 1.8, 3), darkStone)
    ensureVertexColors(gateTop.geometry)
    gateTop.position.set(gx, gy + 6.3, gz)
    this.scene.add(gateTop)
    this.addAABB(gx - 3.7, gx - 1.5, gz - 1.5, gz + 1.5, 6, gy)
    this.addAABB(gx + 1.5, gx + 3.7, gz - 1.5, gz + 1.5, 6, gy)
    // gargoyle perch
    const perch = new THREE.Mesh(new THREE.BoxGeometry(1, 0.6, 1), darkStone)
    ensureVertexColors(perch.geometry)
    perch.position.set(gx + 2.8, heightAt(gx, gz) + 6.3, gz)
    this.scene.add(perch)
    this.gargoylePos = new THREE.Vector3(gx + 2.8, heightAt(gx, gz) + 6.62, gz)

    // nebula billboard clouds behind the castle (additive, slow drift — Part 3.2.5)
    this.nebula = []
    const nebRng = worldRNG.fork('nebula')
    for (let i = 0; i < 6; i++) {
      const mat = retroMaterial({ map: TEX.puff({ name: 'nebulaPuff' + (i % 2), color: i % 2 ? '#4b14ac' : '#53287c' }), transparent: true, depthWrite: false, opacity: nebRng.range(0.3, 0.5), noFog: true })
      mat.blending = THREE.AdditiveBlending
      const puffMesh = new THREE.Mesh(new THREE.PlaneGeometry(nebRng.range(26, 44), nebRng.range(14, 22)), mat)
      ensureVertexColors(puffMesh.geometry)
      puffMesh.position.set(cx + nebRng.range(-30, 30), heightAt(cx, cz) + nebRng.range(14, 30), cz + nebRng.range(14, 26))
      puffMesh.renderOrder = -80
      this.scene.add(puffMesh)
      this.nebula.push({ mesh: puffMesh, speed: nebRng.range(0.1, 0.3), seed: nebRng.range(0, 10) })
    }

    // bats: 3–5 lazy loops around the towers, strictly non-scary (Rule 11)
    this.bats = []
    const batRng = worldRNG.fork('bats')
    const batMat = retroMaterial({ map: TEX.white(), hemi: true })
    for (let i = 0; i < 4; i++) {
      const bat = new THREE.Group()
      const bBody = new THREE.Mesh(new THREE.SphereGeometry(0.07, 5, 4), batMat)
      ensureVertexColors(bBody.geometry, [0.2, 0.16, 0.24])
      bat.add(bBody)
      for (const sx of [-1, 1]) {
        const wing = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.1), batMat)
        ensureVertexColors(wing.geometry, [0.22, 0.18, 0.26])
        wing.position.x = sx * 0.13
        bat.add(wing)
        if (sx === 1) bat.userData.wingR = wing; else bat.userData.wingL = wing
      }
      bat.traverse((o) => { o.userData.dyn = true })
      this.scene.add(bat)
      this.bats.push({ mesh: bat, cx: cx + batRng.range(-8, 8), cz: cz + batRng.range(-4, 8), cy: heightAt(cx, cz) + batRng.range(9, 15), r: batRng.range(5, 10), speed: batRng.range(0.25, 0.45), seed: batRng.range(0, 10) })
    }

    // cold lights: 4 causeway lanterns (2 pairs) + gatehouse brazier
    const cyz = [93, 99]
    let ci = 0
    for (const lz of cyz) {
      for (const sx of [-1, 1]) {
        const lamp = lampPost({ lit: false, height: 2.6 })
        this.place(lamp.group, gx + sx * 2.6, lz)
        this.registerLight(`gloomspire-causeway-${++ci}`, 'gloomspire', lamp, gx + sx * 2.6, lz)
      }
    }
    const gb = brazier({ scale: 1.1 })
    gb.group.position.set(gx - 2.6, heightAt(gx - 2.6, gz - 2.5), gz - 2.5)
    this.scene.add(gb.group)
    this.registerLight('gloomspire-gatehouse-brazier', 'gloomspire', gb, gx - 2.6, gz - 2.5)

    this.poses.gloomspire = { pos: [-112, heightAt(-112, 80) + 3.2, 80], look: [-110, heightAt(-110, 125) + 9, 125], minute: 16 }
  }

  buildHall() {
    // Interior behind the castle: 12 wide (x), ~34 long (z 138→172)
    const hallTex = TEX.stoneBlock({ name: 'hallstone', base: '#3a3630' })
    hallTex.repeat.set(3, 2)
    const stoneMat = retroMaterial({ map: hallTex })
    const cx = -110
    const y0 = 1.3
    const zA = 138, zB = 172
    this.hallMeshes = [] // baked by bakeHallShowcase (carpet/runner keep their dyes)
    // floor is terrain (flat 1.3); walls
    const wallH = 9
    const mkWall = (minX, maxX, minZ, maxZ) => {
      const w = new THREE.Mesh(new THREE.BoxGeometry(maxX - minX, wallH, maxZ - minZ), stoneMat)
      ensureVertexColors(w.geometry)
      w.position.set((minX + maxX) / 2, y0 + wallH / 2, (minZ + maxZ) / 2)
      this.scene.add(w)
      this.addAABB(minX, maxX, minZ, maxZ, wallH, y0)
      this.hallMeshes.push(w)
    }
    mkWall(cx - 7.5, cx - 6.5, zA, zB)          // west wall
    mkWall(cx + 6.5, cx + 7.5, zA, zB)          // east wall
    mkWall(cx - 7.5, cx - 1.4, zA - 1, zA)      // north wall left of door
    mkWall(cx + 1.4, cx + 7.5, zA - 1, zA)      // north wall right of door
    mkWall(cx - 7.5, cx + 7.5, zB, zB + 1)      // south wall (behind throne)
    // ceiling
    const ceil = new THREE.Mesh(new THREE.BoxGeometry(15, 1, zB - zA + 2), stoneMat)
    ensureVertexColors(ceil.geometry)
    ceil.position.set(cx, y0 + wallH + 0.5, (zA + zB) / 2)
    this.scene.add(ceil)
    this.hallMeshes.push(ceil)
    // columns both sides
    for (let z = zA + 5; z < zB - 4; z += 6) {
      for (const sx of [-4.6, 4.6]) {
        const col = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.6, wallH, 8), stoneMat)
        ensureVertexColors(col.geometry)
        col.position.set(cx + sx, y0 + wallH / 2, z)
        this.scene.add(col)
        this.colliders.push({ x: cx + sx, z, r: 0.7, h: wallH })
        this.hallMeshes.push(col)
      }
    }
    // stone floor over the terrain (the global ground is grass — interiors need their own)
    const floorTex = TEX.cobblestone({ name: 'hallfloor', moss: 0 })
    floorTex.repeat.set(6, 14)
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(15, zB - zA + 2), retroMaterial({ map: floorTex }))
    ensureVertexColors(floor.geometry)
    floor.rotation.x = -Math.PI / 2
    floor.position.set(cx, y0 + 0.015, (zA + zB) / 2)
    this.scene.add(floor)
    this.hallMeshes.push(floor)
    // red carpet + emerald runner (dark VERTEX colors — emissive over white
    // texture washes out to ambient beige, learned the hard way)
    const carpet = new THREE.Mesh(new THREE.PlaneGeometry(2.6, zB - zA - 2), retroMaterial({ map: TEX.white() }))
    ensureVertexColors(carpet.geometry, [0.47, 0.09, 0.08])
    carpet.rotation.x = -Math.PI / 2
    carpet.position.set(cx, y0 + 0.03, (zA + zB) / 2)
    this.scene.add(carpet)
    const runner = new THREE.Mesh(new THREE.PlaneGeometry(9, 1.6), retroMaterial({ map: TEX.white() }))
    ensureVertexColors(runner.geometry, [0.09, 0.2, 0.12])
    runner.rotation.x = -Math.PI / 2
    runner.position.set(cx, y0 + 0.035, 155)
    this.scene.add(runner)
    // throne dais + throne
    const dais = new THREE.Mesh(new THREE.BoxGeometry(6, 1, 4), stoneMat)
    ensureVertexColors(dais.geometry)
    dais.position.set(cx, y0 + 0.5, zB - 3)
    this.scene.add(dais)
    this.hallMeshes.push(dais)
    const throne = new THREE.Mesh(new THREE.BoxGeometry(1.6, 3, 1), retroMaterial({ map: TEX.plank() }))
    ensureVertexColors(throne.geometry)
    throne.position.set(cx, y0 + 2.5, zB - 3.5)
    this.scene.add(throne)
    this.hallMeshes.push(throne)
    this.colliders.push({ x: cx, z: zB - 3, r: 2.4, h: 2 })
    // E.6: candelabra pair flanking the throne — pre-lit staging so the Pale
    // King reads from the hall (set dressing, never objectives)
    {
      const candMat = retroMaterial({ map: TEX.plank({ name: 'candelabrawood' }) })
      // emitterGain: these quads are 1.7m and 3.4m across — pre-baked bloom from
      // the unlit renderer, which real bloom now doubles. Damped so the Hall
      // stays inside the 8% accent budget (DECISIONS #12).
      const glowMat = retroMaterial({ map: TEX.glowDot({ name: 'thronewarm', color: '#ffb45e' }), transparent: true, depthWrite: false, opacity: 0.65, emitterGain: 0.45 })
      glowMat.blending = THREE.AdditiveBlending
      this.throneCandles = [] // baked into the hall showcase like the chandeliers
      for (const sx of [-2.4, 2.4]) {
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.09, 1.6, 6), candMat)
        ensureVertexColors(pole.geometry, [0.35, 0.3, 0.24])
        pole.position.set(cx + sx, y0 + 1.8, zB - 2.2)
        this.scene.add(pole)
        this.throneCandles.push([cx + sx, y0 + 2.75, zB - 2.2])
        const glow = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 1.7), glowMat)
        ensureVertexColors(glow.geometry)
        glow.position.set(cx + sx, y0 + 2.75, zB - 2.2)
        glow.userData.dyn = true
        this.scene.add(glow)
        this.halos.push(glow)
        const pool = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 3.4), glowMat)
        ensureVertexColors(pool.geometry)
        pool.rotation.x = -Math.PI / 2
        pool.position.set(cx + sx, y0 + 1.06, zB - 2.4)
        pool.userData.dyn = true
        this.scene.add(pool)
      }
    }
    // P.4 fingerprint (hall): the Pale King's bookmark — a pressed flower in
    // a small book left on the dais, marking a page he never finished
    {
      const book = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.035, 0.12), retroMaterial({ map: TEX.plank({ name: 'kingbook' }) }))
      ensureVertexColors(book.geometry, [0.42, 0.3, 0.26])
      book.position.set(cx + 1.05, y0 + 1.02, zB - 3.1)
      book.rotation.y = 0.5
      this.scene.add(book)
      const flower = new THREE.Mesh(new THREE.CircleGeometry(0.045, 5), retroMaterial({ map: TEX.white() }))
      ensureVertexColors(flower.geometry, [0.85, 0.6, 0.68]) // pressed pale pink
      flower.position.set(cx + 1.05 + 0.07, y0 + 1.04, zB - 3.1 - 0.05)
      flower.rotation.x = -Math.PI / 2
      this.scene.add(flower)
    }

    // where a keeper sits for the lullaby moment (Part 3.2.6): the dais foot
    this.thronePos = new THREE.Vector3(cx, y0, zB - 5.6)
    // 3 pre-lit chandeliers (rings of candle glow, always on)
    const mats = sharedMats()
    for (let i = 0; i < 3; i++) {
      const z = zA + 8 + i * 9
      const ring = new THREE.Mesh(new THREE.TorusGeometry(1.2, 0.09, 6, 12), mats.iron)
      ensureVertexColors(ring.geometry)
      ring.rotation.x = Math.PI / 2
      ring.position.set(cx, y0 + 5.6, z)
      this.scene.add(ring)
      const haloMat = retroMaterial({ map: TEX.glowDot({ color: '#ffb45e' }), transparent: true, depthWrite: false, opacity: 0.78, emitterGain: 0.3 })
      haloMat.blending = THREE.AdditiveBlending
      const halo = new THREE.Mesh(new THREE.PlaneGeometry(4.3, 4.3), haloMat)
      ensureVertexColors(halo.geometry)
      halo.position.set(cx, y0 + 5.7, z)
      this.scene.add(halo)
      this.halos.push(halo)
    }
    // 6 wall sconces (the Hall's cold lights)
    let si = 0
    for (let i = 0; i < 3; i++) {
      const z = zA + 7 + i * 10
      for (const sx of [-6.3, 6.3]) {
        const sc = sconce({ accent: '#ffb45e' })
        sc.group.position.set(cx + sx, y0 + 3.2, z)
        sc.group.rotation.y = sx > 0 ? Math.PI / 2 : -Math.PI / 2
        this.scene.add(sc.group)
        this.registerLight(`hall-sconce-${++si}`, 'hall', sc, cx + sx, z, y0 + 3.2)
      }
    }
    this.poses.hall = { pos: [cx, y0 + 1.1, 140.5], look: [cx, y0 + 2.4, 169] }
  }

  buildMosswood() {
    const rng = worldRNG.fork('mosswood')
    // 6 colossal mossy trunks flanking the path
    const positions = [[46, 103], [54, 118], [64, 102], [72, 117], [58, 96], [76, 104]]
    for (const [tx, tz] of positions) {
      const cr = rng.range(6, 8)
      const t = tree({ rng, height: rng.range(10, 13), trunkR: rng.range(1.6, 2.2), canopyR: cr, cards: 5 })
      this.place(t, tx, tz, rng.range(0, Math.PI * 2))
      this.treePads.push({ x: tx, z: tz, r: cr })
    }
    // the arch gate (world's edge)
    const ax = MOSSWOOD_ARCH.x, az = MOSSWOOD_ARCH.z
    const mossStone = retroMaterial({ map: TEX.stoneBlock({ name: 'mossarch', base: '#3a4a3e' }) })
    for (const sz of [-3, 3]) {
      const pillar = new THREE.Mesh(new THREE.BoxGeometry(1.6, 7, 1.6), mossStone)
      ensureVertexColors(pillar.geometry)
      pillar.position.set(ax, heightAt(ax, az + sz) + 3.5, az + sz)
      this.scene.add(pillar)
      this.colliders.push({ x: ax, z: az + sz, r: 1.1, h: 7 })
    }
    // P.4 fingerprint (mosswood): a faded ribbon tied around the south arch
    // pillar with a hanging knot — someone marked the way out, once
    {
      const ribMat = retroMaterial({ map: TEX.white() })
      const belt = new THREE.Mesh(new THREE.BoxGeometry(1.72, 0.09, 1.72), ribMat)
      ensureVertexColors(belt.geometry, [0.56, 0.24, 0.22])
      belt.position.set(ax, heightAt(ax, az - 3) + 1.3, az - 3)
      belt.rotation.y = 0.06
      this.scene.add(belt)
      const knot = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.34, 0.025), ribMat)
      ensureVertexColors(knot.geometry, [0.5, 0.21, 0.2])
      knot.position.set(ax - 0.5, heightAt(ax, az - 3) + 1.1, az - 3 - 0.88)
      knot.rotation.z = 0.18
      this.scene.add(knot)
    }
    const archTop = new THREE.Mesh(new THREE.TorusGeometry(3.2, 0.7, 6, 10, Math.PI), mossStone)
    ensureVertexColors(archTop.geometry)
    // half-torus in ZY after the Y-rotation: the arc SPANS the two pillars
    // (an extra Z-rotation used to fold it sideways into a broken "C")
    archTop.rotation.y = Math.PI / 2
    archTop.position.set(ax, heightAt(ax, az) + 6.2, az)
    this.scene.add(archTop)
    // 2 hanging arch lanterns + 2 trail lanterns (cold lights)
    let mi = 0
    for (const sz of [-1.6, 1.6]) {
      const hl = hangingLantern({ accent: '#e08a30' })
      hl.group.position.set(ax, heightAt(ax, az) + 6.0, az + sz)
      this.scene.add(hl.group)
      this.sways.push(hl.group)
      this.registerLight(`mosswood-arch-lantern-${++mi}`, 'mosswood', hl, ax, az + sz, heightAt(ax, az) + 6.0)
    }
    for (const lx of [50, 68]) {
      const lamp = lampPost({ lit: false, height: 2.4 })
      this.place(lamp.group, lx, 107.4)
      this.registerLight(`mosswood-trail-${lx}`, 'mosswood', lamp, lx, 107.4)
    }
    // 3 layered ground-fog cards across the path (parallax in update — Part 3.2.7)
    this.fogCards = []
    const fogTex = TEX.glowDot({ color: '#3c5748' })
    for (const [fx, fw, fo] of [[70, 26, 0.22], [77, 30, 0.28], [83, 34, 0.34]]) {
      const mat = retroMaterial({ map: fogTex, transparent: true, depthWrite: false, opacity: fo })
      const card = new THREE.Mesh(new THREE.PlaneGeometry(fw, 5), mat)
      ensureVertexColors(card.geometry)
      card.position.set(fx, heightAt(fx, 110) + 1.2, 110)
      card.rotation.y = -Math.PI / 2
      card.scale.y = 0.55
      this.scene.add(card)
      this.fogCards.push({ mesh: card, baseX: fx, seed: fx * 0.7 })
    }
    // recomposed (AA.4): Mote sleeping mid-left, arch as the far subject, his
    // snore-z drifting INSIDE the frame instead of clipping its edge
    this.poses.mosswood = { pos: [61.5, heightAt(61.5, 112.0) + 1.6, 112.0], look: [84, heightAt(84, 108.5) + 4.6, 108.5], minute: 6 }
  }

  buildIsle() {
    const rng = worldRNG.fork('isle')
    const mats = sharedMats()
    const keepTex = TEX.stoneBlock({ name: 'keepstone', base: '#4a5560' })
    keepTex.repeat.set(3, 2)
    const stoneMat = retroMaterial({ map: keepTex })

    // an anchored rowboat offshore (7.2's boat; AA.4 gives the open water a
    // middle-ground silhouette) — rocks gently with the swell
    {
      const boat = new THREE.Group()
      const hullMat = retroMaterial({ map: TEX.plank({ name: 'boatwood' }) })
      const hull = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.62, 3.4, 7, 1, false, 0, Math.PI), hullMat)
      ensureVertexColors(hull.geometry, [0.5, 0.44, 0.4])
      hull.rotation.z = Math.PI / 2
      hull.rotation.y = Math.PI / 2
      hull.scale.set(1, 0.42, 1)
      boat.add(hull)
      const bench2 = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.08, 0.3), hullMat)
      ensureVertexColors(bench2.geometry, [0.42, 0.38, 0.34])
      bench2.position.y = 0.05
      boat.add(bench2)
      const prow = new THREE.Mesh(new THREE.ConeGeometry(0.4, 0.9, 5), hullMat)
      ensureVertexColors(prow.geometry, [0.46, 0.4, 0.36])
      prow.rotation.x = Math.PI / 2
      prow.position.set(0, 0.05, 1.95)
      boat.add(prow)
      // a hung stern lantern — sea.png's one warm accent (judge pass 3, #5):
      // somebody means to row back out; the light waits with the boat
      const sternPole = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.04, 0.7, 5), hullMat)
      ensureVertexColors(sternPole.geometry, [0.4, 0.36, 0.32])
      sternPole.position.set(0, 0.4, -1.5)
      sternPole.rotation.x = -0.25
      boat.add(sternPole)
      const sternGlow = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.9), (() => {
        const m = retroMaterial({ map: TEX.glowDot({ color: '#e8a84a' }), transparent: true, depthWrite: false, opacity: 0.75 })
        m.blending = THREE.AdditiveBlending
        return m
      })())
      ensureVertexColors(sternGlow.geometry)
      sternGlow.position.set(0, 0.72, -1.62)
      boat.add(sternGlow)
      const sternCore = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.16, 0.12), retroMaterial({ map: TEX.white(), emissive: 0xe8862a }))
      ensureVertexColors(sternCore.geometry, [1, 0.7, 0.3])
      sternCore.position.set(0, 0.72, -1.62)
      boat.add(sternCore)
      boat.position.set(-26, WATER_Y + 0.34, -96)
      boat.rotation.y = 0.7
      boat.userData.dyn = true
      this.scene.add(boat)
      this.sways.push(boat) // the swell rocks it
    }
    // the keep on the island top
    const kx = 0, kz = -152
    const kBase = heightAt(kx, kz)
    const keep = new THREE.Mesh(new THREE.CylinderGeometry(4.2, 4.8, 9, 12), stoneMat)
    ensureVertexColors(keep.geometry)
    keep.position.set(kx, kBase + 4.5, kz)
    this.scene.add(keep)
    this.colliders.push({ x: kx, z: kz, r: 5, h: 9 })
    // crenellations (simple ring of merlons)
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.9, 0.5), stoneMat)
      ensureVertexColors(m.geometry)
      m.position.set(kx + Math.cos(a) * 4.1, kBase + 9.5, kz + Math.sin(a) * 4.1)
      m.rotation.y = -a
      this.scene.add(m)
    }
    // palms (curved trunk + frond cards)
    for (let i = 0; i < 6; i++) {
      const a = rng.range(0, Math.PI * 2)
      const r = rng.range(20, 30)
      const px = kx + Math.cos(a) * r, pz = kz + Math.sin(a) * r * 0.8
      if (heightAt(px, pz) < 0.5) continue
      const palm = new THREE.Group()
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.22, 4.4, 6), mats.bark)
      ensureVertexColors(trunk.geometry)
      trunk.position.y = 2.2
      trunk.rotation.z = rng.range(-0.22, 0.22)
      palm.add(trunk)
      for (let f = 0; f < 5; f++) {
        const frond = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 0.8), mats.canopy)
        ensureVertexColors(frond.geometry)
        frond.position.y = 4.4
        frond.rotation.y = (f / 5) * Math.PI * 2
        frond.rotation.z = -0.5
        palm.add(frond)
      }
      palm.userData.collider = { r: 0.35, h: 4 }
      this.place(palm, px, pz, rng.range(0, Math.PI * 2))
    }
    // cold lights: 2 causeway lamps, cove beacon, keep-top brazier
    let ii = 0
    for (const lz of [-70, -105]) {
      const lamp = lampPost({ lit: false })
      this.place(lamp.group, 2.2, lz)
      this.registerLight(`isle-causeway-${++ii}`, 'isle', lamp, 2.2, lz)
    }
    const beacon = brazier({ scale: 0.9 })
    const bx = 12, bz = -138
    beacon.group.position.set(bx, heightAt(bx, bz), bz)
    this.scene.add(beacon.group)
    this.registerLight('isle-cove-beacon', 'isle', beacon, bx, bz)
    const keepBrazier = brazier({ scale: 1.3 })
    keepBrazier.group.position.set(kx, kBase + 9.9, kz)
    this.scene.add(keepBrazier.group)
    this.registerLight('isle-keep-brazier', 'isle', keepBrazier, kx, kz, kBase + 9.9)

    // foam edge along the cove (scrolling pale strip)
    const foamTex = TEX.streak({ name: 'foam', color: '#b8ccd4' })
    foamTex.wrapS = foamTex.wrapT = THREE.RepeatWrapping
    foamTex.repeat.set(14, 1)
    const foamMat = retroMaterial({ map: foamTex, transparent: true, depthWrite: false, opacity: 0.4 })
    const foamPts = []
    for (let i = 0; i <= 20; i++) {
      const a = -0.9 + (i / 20) * 2.2
      foamPts.push([kx + Math.cos(a) * 31, kz + Math.sin(a) * 26])
    }
    const foam = new THREE.Mesh(ribbonGeometry(foamPts, 1.4), foamMat)
    foam.position.y = WATER_Y - heightAt(foamPts[0][0], foamPts[0][1]) + 0.12
    this.scene.add(foam)
    this.waterMats.push({ tex: foamTex, sx: 0.01, sy: 0 })

    // moon streak on the sea: long additive strip aimed at the moon azimuth
    const streakMat = retroMaterial({ map: TEX.glowDot({ color: '#c8d4f0' }), transparent: true, depthWrite: false, opacity: 0.62, noFog: true })
    streakMat.blending = THREE.AdditiveBlending
    this.moonStreak = new THREE.Mesh(new THREE.PlaneGeometry(11, 95), streakMat)
    ensureVertexColors(this.moonStreak.geometry)
    this.moonStreak.rotation.x = -Math.PI / 2
    this.moonStreak.position.set(0, WATER_Y + 0.05, -95)
    this.scene.add(this.moonStreak)

    // across the water (Part 3.2.8): on the causeway itself — lamp chain ahead,
    // sea flanking, keep beyond, moon high in frame
    // P.4 fingerprint (isle): a corked message bottle half-buried where the
    // causeway meets the shore — never opened, never sent
    {
      const glassMat = retroMaterial({ map: TEX.white(), transparent: true, opacity: 0.82 })
      const bottle = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.05, 0.24, 8), glassMat)
      ensureVertexColors(bottle.geometry, [0.4, 0.62, 0.56])
      const bx = 1.3, bz = -133.6
      const by = heightAt(bx, bz)
      bottle.position.set(bx, by + 0.05, bz)
      bottle.rotation.set(1.35, 0, 0.5)
      this.scene.add(bottle)
      const cork = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.032, 0.05, 6), retroMaterial({ map: TEX.white() }))
      ensureVertexColors(cork.geometry, [0.56, 0.44, 0.3])
      cork.position.set(bx + Math.sin(0.5) * 0.13, by + 0.05 + Math.cos(1.35) * 0.14, bz - Math.sin(1.35) * 0.13)
      cork.rotation.set(1.35, 0, 0.5)
      this.scene.add(cork)
    }

    this.poses.isle = { pos: [2.2, 2.3, -86], look: [-20, kBase + 13, -152], minute: 37 }
    // sea view for the water/moon-streak evidence (m5-water)
    this.poses.sea = { pos: [1.5, 2.1, -85], look: [-40, 1.2, -111], minute: 37 }
  }

  // The Hall's baked-vertex-light showcase (Part 3.2.6 / 8.4): NO lights at all —
  // warm pools under the pre-lit chandeliers, cold vault above, painted into
  // every interior vertex.
  bakeHallShowcase() {
    if (!this.hallMeshes) return
    // throne candelabra join the bake at a tighter radius and lower gain —
    // full chandelier weight right on the dais turned it into lava brick
    const warmPoints = [
      ...[[-110, 6.9, 146], [-110, 6.9, 155], [-110, 6.9, 164]].map((p) => ({ p, r: 7.5, gain: 1 })),
      ...(this.throneCandles ?? []).map((p) => ({ p, r: 5.5, gain: 0.4 })),
    ]
    const v = new THREE.Vector3()
    for (const mesh of this.hallMeshes) {
      mesh.updateMatrixWorld()
      const pos = mesh.geometry.getAttribute('position')
      const col = mesh.geometry.getAttribute('color')
      for (let i = 0; i < pos.count; i++) {
        v.fromBufferAttribute(pos, i).applyMatrix4(mesh.matrixWorld)
        // cold vault: darker + bluer with height
        const coldF = THREE.MathUtils.clamp((v.y - 3.2) / 6, 0, 1)
        let r = 1 - coldF * 0.45, g = 1 - coldF * 0.38, b = 1 - coldF * 0.2
        // warm candle pools
        let w = 0
        for (const { p: [cx2, cy2, cz2], r: wr, gain } of warmPoints) {
          const d = Math.sqrt((v.x - cx2) ** 2 + (v.y - cy2) ** 2 * 0.35 + (v.z - cz2) ** 2)
          w += Math.max(0, 1 - d / wr) * gain
        }
        w = Math.min(1.15, w)
        // E.6 boost: pools must READ as pools of candlelight — the showcase
        // was measuring near-zero bright-warm pixels before this
        r *= 1 + w * 2.7
        g *= 1 + w * 1.35
        b *= 1 + w * 0.26
        // the vault above disappears into darkness
        const vault = THREE.MathUtils.clamp((v.y - 5.2) / 3.4, 0, 1)
        const fade = 1 - vault * 0.55
        col.setXYZ(i, r * 0.9 * fade, g * 0.9 * fade, b * 0.95 * (1 - vault * 0.35))
      }
      col.needsUpdate = true
    }
    // E.6: layered floor mist (drifting) + high moon shafts + candle-vault air
    {
      const hy = heightAt(-110, 152)
      const mistMat = retroMaterial({ map: TEX.glowDot({ name: 'hallmist', color: '#8a92a8' }), transparent: true, depthWrite: false, opacity: 0.055 })
      mistMat.blending = THREE.AdditiveBlending
      this.hallMist = []
      for (let i = 0; i < 4; i++) {
        const m2 = new THREE.Mesh(new THREE.PlaneGeometry(9.5, 4.6), mistMat)
        ensureVertexColors(m2.geometry)
        m2.rotation.x = -Math.PI / 2
        m2.position.set(-110 + (i % 2 ? 2.1 : -2.1), hy + 0.32 + i * 0.09, 143 + i * 7)
        m2.userData.dyn = true
        this.scene.add(m2)
        this.hallMist.push({ mesh: m2, baseX: m2.position.x, seed: i * 2.3 })
      }
      // pre-lit chandeliers carry visible pools on the polished floor
      const floorPoolMat = retroMaterial({ map: TEX.glowDot({ name: 'hallfloorpool', color: '#f0a848' }), transparent: true, depthWrite: false, opacity: 0.42 })
      floorPoolMat.blending = THREE.AdditiveBlending
      for (const z of [146, 155, 164]) {
        const fp = new THREE.Mesh(new THREE.PlaneGeometry(5.6, 5.6), floorPoolMat)
        ensureVertexColors(fp.geometry)
        fp.rotation.x = -Math.PI / 2
        fp.position.set(-110, hy + 0.07, z)
        fp.userData.dyn = true
        this.scene.add(fp)
      }
      // a streak, not a dot: stretched radial glow reads as smudge — the
      // beam texture is what makes it a shaft of moonlight
      const shaftMat = retroMaterial({ map: TEX.streak({ name: 'hallshaft', color: '#9d97c2' }), transparent: true, depthWrite: false, opacity: 0.34 })
      shaftMat.side = THREE.DoubleSide // one-sided planes were culled from the corridor view
      shaftMat.blending = THREE.AdditiveBlending
      for (const z of [149, 161]) {
        const sh = new THREE.Mesh(new THREE.PlaneGeometry(2.8, 9.5), shaftMat)
        ensureVertexColors(sh.geometry)
        sh.position.set(-110 + 2.4, hy + 5.1, z)
        sh.rotation.z = 0.42
        sh.userData.dyn = true
        this.scene.add(sh)
      }
    }
  }

  buildFoglands() {
    const rng = worldRNG.fork('foglands')
    const mats = sharedMats()

    // Wayside shrines (PRESTIGE O.2 / AA.5): hooded stone figures with candle
    // niches in the open country between roads — optional cold lights that
    // kindle a deep amber; the empty fields stop being empty
    const shrineStone = retroMaterial({ map: TEX.stoneBlock({ name: 'shrinestone', base: '#3e4442' }) })
    let shrineN = 0
    for (const [sx, sz] of [[-52, 42], [-18, 78], [40, 64], [86, 24], [16, -44], [-36, -26]]) {
      shrineN++
      const g = new THREE.Group()
      const plinth = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.3, 0.9), shrineStone)
      ensureVertexColors(plinth.geometry, [0.7, 0.7, 0.7])
      plinth.position.y = 0.15
      g.add(plinth)
      // hooded figure: lathe body, cone hood, bowed head — worn, faceless
      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.34, 1.05, 7), shrineStone)
      ensureVertexColors(body.geometry, [0.82, 0.82, 0.85])
      body.position.y = 0.82
      g.add(body)
      const hood = new THREE.Mesh(new THREE.ConeGeometry(0.26, 0.42, 7), shrineStone)
      ensureVertexColors(hood.geometry, [0.72, 0.72, 0.76])
      hood.position.y = 1.44
      hood.rotation.x = 0.18 // the bow
      g.add(hood)
      // candle niche at the figure's feet
      const niche = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.26, 0.2), shrineStone)
      ensureVertexColors(niche.geometry, [0.5, 0.5, 0.5])
      niche.position.set(0, 0.43, 0.32)
      g.add(niche)
      const sc = sconce({ accent: '#d98a2b' }) // deep amber, not required for completion
      sc.group.position.set(0, 0.38, 0.38)
      sc.group.scale.setScalar(0.8)
      g.add(sc.group)
      const leanYaw = rng.range(-0.4, 0.4) + (rng.chance(0.3) ? 0.12 : 0) // none face alike (P.1)
      g.userData.collider = { r: 0.55, h: 1.6 }
      this.place(g, sx, sz, leanYaw)
      // the sconce offset rotates with the figure — register where it landed,
      // or the cold pilot ember floats beside the niche
      const scx = sx + Math.sin(leanYaw) * 0.38, scz = sz + Math.cos(leanYaw) * 0.38
      this.registerLight(`wayside-shrine-${shrineN}`, 'wayside', sc, scx, scz, heightAt(sx, sz) + 0.38)
    }
    // memorial stones — worn markers of the order, three words at most, moss
    this.memorials = []
    for (const [mx, mz, lean] of [[-34, 22, 0.08], [62, 80, -0.06], [-74, 96, 0.13], [-66, 36, -0.1]]) {
      this.memorials.push([mx, mz])
      const slab = new THREE.Mesh(new THREE.BoxGeometry(0.5, rng.range(0.7, 1.0), 0.16), shrineStone)
      ensureVertexColors(slab.geometry, [0.62, 0.66, 0.62])
      const g = new THREE.Group()
      slab.position.y = 0.4
      slab.rotation.z = lean // none stand straight anymore
      g.add(slab)
      g.userData.collider = { r: 0.35, h: 0.9 }
      this.place(g, mx, mz, rng.range(0, Math.PI))
    }
    // a lone bench in the grass, facing nothing in particular (D.1)
    const lone = bench({ length: 1.6 })
    this.place(lone, -6, 54, 2.2)
    this.benches.push([-6, 54])
    // and one at the southwest shore, facing the sea and the setting moon —
    // somebody used to sit here often (the wear is in the dark patches)
    const shore = bench({ length: 1.6 })
    this.place(shore, -34, -46, Math.PI * 1.05)
    this.benches.push([-34, -46])

    // fingerposts at forks
    const posts = [
      { x: 24, z: 0, labels: ['EMBERWICK →', '← THE PARK'] },
      { x: -24, z: 0, labels: ['RUINS →', '← THE PARK'] },
      { x: 3.4, z: -46, labels: ['THE ISLE →', '← THE PARK'] },
      { x: -110, z: 50, labels: ['GLOOMSPIRE →', '← RUINS'] },
      { x: 92, z: 48, labels: ['MOSSWOOD →', '← EMBERWICK'] },
      { x: -20, z: 110, labels: ['MOSSWOOD →', '← GLOOMSPIRE'] },
    ]
    this.signposts = posts.map((pd) => ({ x: pd.x, z: pd.z }))
    const postWood = retroMaterial({ map: TEX.woodPost() }) // grain runs WITH the post
    for (const pd of posts) {
      const g = new THREE.Group()
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 2.6, 6), postWood)
      ensureVertexColors(post.geometry)
      post.position.y = 1.3
      g.add(post)
      pd.labels.forEach((label, i) => {
        const board = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.3, 0.06), mats.plank)
        ensureVertexColors(board.geometry)
        board.position.set(0.5, 2.2 - i * 0.45, 0)
        board.rotation.y = i * 0.5
        g.add(board)
        // carved label (readable on approach — 3.3)
        const c = document.createElement('canvas')
        c.width = 128; c.height = 24
        const ctx = c.getContext('2d')
        ctx.clearRect(0, 0, 128, 24)
        ctx.font = 'bold 15px Georgia, serif'
        ctx.textAlign = 'center'
        ctx.fillStyle = '#d8cfae'
        ctx.fillText(label, 64, 17)
        const t = new THREE.CanvasTexture(c)
        t.magFilter = t.minFilter = THREE.NearestFilter
        t.generateMipmaps = false
        const txt = new THREE.Mesh(new THREE.PlaneGeometry(1.42, 0.26), retroMaterial({ map: t, transparent: true, emissive: '#4a4436' }))
        ensureVertexColors(txt.geometry)
        txt.position.set(0, 0, 0.036) // child of the board → rides its rotation
        board.add(txt)
      })
      g.userData.collider = { r: 0.2, h: 2.6 }
      this.place(g, pd.x, pd.z, rng.range(0, Math.PI * 2))
      if (!this.fogProps) this.fogProps = []
      this.fogProps.push({ g, x: pd.x, z: pd.z })
      this.interactables.push({ id: `sign-${pd.x}-${pd.z}`, x: pd.x, z: pd.z, kind: 'sign', labels: pd.labels })
    }
    // breadcrumb lanterns along corridors (pre-kindled, flickering — not objectives)
    this.crumbs = [] // exposed for the AA.5 wander test
    const crumbs = [
      [32, 1.5], [48, -1.5], [-32, 1.5], [-50, -1.5], [-72, 1.5],
      [0 + 1.8, -50], [-1.8, -62], [1.8, -86], [-1.8, -112],
      [-108, 30], [-112, 62], [-108, 78],
      [98, 30], [88, 56], [76, 78], [66, 92],
      [-78, 113], [-44, 109], [-6, 112], [24, 108],
    ]
    for (const [cx, cz] of crumbs) {
      this.crumbs.push([cx, cz])
      const lamp = lampPost({ lit: false, height: 2.2 })
      this.place(lamp.group, cx, cz)
      this.litLamp(lamp, cx, cz)
      if (!this.fogProps) this.fogProps = []
      this.fogProps.push({ g: lamp.group, x: cx, z: cz })
    }
    // the corridor itself: stand at the first breadcrumb, the next one is
    // already half-swallowed by the fog wall
    this.poses.foglands = { pos: [22.0, heightAt(22.0, 1.2) + 1.2, 1.2], look: [33.5, heightAt(33.5, 1.4) + 2.2, 1.4], minute: 4 }
  }

  // world rules applied after player movement (mosswood loop-through)
  applyWorldRules(player) {
    const A = MOSSWOOD_ARCH
    if (Math.abs(player.pos.z - A.z) < A.halfW && player.pos.x > A.x + A.beyond) {
      // honest loop: mirror back through the arch, walking OUT the way you walked in
      player.pos.x = A.x + A.beyond - (player.pos.x - (A.x + A.beyond))
      player.yaw = Math.PI - player.yaw
      player.targetYaw = player.yaw
      player.vel.x *= -1
      return 'mosswood-loop'
    }
    return null
  }

  // PRESTIGE B.1: authored postcard views per zone — deliberately composed
  // frames beyond the automated pose. Reachable via the debug surface
  // (listPostcards / teleportPostcard) and shot by scripts/postcards.mjs.
  buildPostcards() {
    const hy = (x, z) => heightAt(x, z)
    const kBase = hy(0, -152)
    const hallY = hy(-110, 152)
    this.postcards = [
      // the Long Bench from the south lawn, path leading away, late moon
      { zone: 'park', idx: 1, pos: [8, hy(8, -23) + 1.4, -23], look: [1.6, hy(2, -19.6) + 1.7, -19.4], minute: 33 }, // from the east: lamp fore-right, bench subject, trunk frames the left edge
      // downhill from the top of Emberwick: lamps stepping down, moon low west
      // (dolly 3m forward — the empty bottom third read as void; judge #9)
      { zone: 'village', idx: 1, pos: [123, streetH(123) + 2.0, streetZ(123) + 1.6], look: [96, streetH(96) + 1.2, streetZ(96)], minute: 30 },
      // the roof-edge canyon: down the street from above, warm windows both
      // sides, the moon low at the street's end (the flat walkable roofs
      // offer no "roofscape" — the drama is the street below)
      { zone: 'rooftops', idx: 1, pos: [124, streetH(124) + 5.6 + 1.0, streetZ(124) - 3.5], look: [102, streetH(102) + 5.2, streetZ(102)], minute: 34 }, // moon deeper in frame
      // across the colonnade to the moonwell, moon in the southeast gap
      { zone: 'ruins', idx: 1, pos: [-104, hy(-104, -7) + 1.5, -7], look: [-117, hy(-117, 5) + 2.4, 5], minute: 22 },
      // castle silhouette across the moat from the west bank — at minute 3
      // the moon hangs due EAST, straight behind the towers from here
      { zone: 'gloomspire', idx: 1, pos: [-140, hy(-140, 114) + 2.2, 114], look: [-112, hy(-112, 126) + 10, 126], minute: 3 },
      // the album cover: throne steps, carpet, candle vault (E.6)
      { zone: 'hall', idx: 1, pos: [-110, hallY + 1.3, 162.5], look: [-110, hallY + 2.6, 169.8], minute: 24 },
      // under the arch looking back down the path, moon low over the trail
      { zone: 'mosswood', idx: 1, pos: [82, hy(82, 109.5) + 1.6, 109.5], look: [58, hy(58, 111) + 2.8, 111], minute: 33 }, // moon in the corridor gap below the canopy
      // keep-top vista: the best view of the moon in the game (E.8)
      { zone: 'isle', idx: 1, pos: [0, kBase + 11.2, -150], look: [-18, kBase + 12.4, -176], minute: 38 }, // panned off the brazier halo's frame edge
    ]
  }

  update(dt, time) {
    // zone-distance culling (D6): fog hides what we skip drawing
    if (this.zoneGroups) {
      const cam = this.camera.position
      for (const zg of this.zoneGroups) {
        if (zg.r > 999) continue
        zg.g.visible = Math.hypot(cam.x - zg.cx, cam.z - zg.cz) - zg.r < 95
      }
      if (this.fogProps) {
        for (const fp of this.fogProps) {
          fp.g.visible = Math.hypot(cam.x - fp.x, cam.z - fp.z) < 75
        }
      }
    }
    for (const f of this.flames) {
      if (!f.mesh.visible) continue
      f.acc += dt
      if (f.acc > 0.125) {
        f.acc = 0
        f.frame = (f.frame + 1) % 4
        f.tex.offset.x = f.frame * 0.25
      }
      f.mesh.lookAt(this.camera.position.x, f.mesh.getWorldPosition(_wp).y, this.camera.position.z)
    }
    for (const h of this.halos) { if (h.visible) h.lookAt(this.camera.position) }
    // pilot embers breathe (AA.2) — culled with distance like their zones
    for (const l of this.lights) {
      if (!l.pilot) continue
      if (l.kindled) continue
      const cam = this.camera.position
      const d = Math.hypot(cam.x - l.x, cam.z - l.z)
      // ASCENSION 0.3.1 — "you can literally see your objectives as dying
      // embers scattered through the dark", readable at 80m and never lost to
      // fog. A fixed 0.34m quad is sub-pixel by ~40m, so the ember holds its
      // ANGULAR size past that: it stops shrinking and grows in world units
      // instead, and its opacity climbs to out-run fog extinction. Still
      // occluded by geometry (it is depth-tested), so it reads as a light in
      // the world rather than a quest marker pasted on the screen.
      const vis = d < 88
      l.pilot.visible = vis
      if (vis) {
        const breathe = 1 + 0.22 * Math.sin(time * 2.1 + l.flickerSeed) + 0.08 * Math.sin(time * 5.3 + l.flickerSeed * 2)
        const far = Math.max(1, d / 26)              // hold angular size past ~26m
        l.pilot.scale.setScalar(breathe * far)
        // fog eats distant embers; lift the core so the objective survives it
        const lift = Math.min(1, Math.max(0, (d - 20) / 60))
        if (this.pilotMat) this.pilotMat.uniforms.uOpacity.value = 0.6 + 0.35 * lift
        l.pilot.lookAt(cam)
      }
    }
    this._updateListen(dt)
    for (const s of this.sways) {
      s.rotation.z = Math.sin(time * 0.8 + s.position.x) * 0.06
      s.rotation.x = Math.sin(time * 0.6 + s.position.z) * 0.05
    }
    for (const w of this.waterMats) {
      w.tex.offset.x = (w.tex.offset.x + w.sx * dt) % 1
      w.tex.offset.y = (w.tex.offset.y + w.sy * dt) % 1
    }
    // nebula drift + bat loops + fog-card parallax + crystal bob + moon streak
    if (this.nebula) {
      for (const n of this.nebula) {
        n.mesh.position.x += Math.sin(time * 0.05 + n.seed) * n.speed * dt
        n.mesh.lookAt(this.camera.position)
      }
    }
    if (this.bats) {
      for (const b of this.bats) {
        const a = time * b.speed + b.seed
        b.mesh.position.set(b.cx + Math.cos(a) * b.r, b.cy + Math.sin(time * 0.7 + b.seed) * 0.8, b.cz + Math.sin(a) * b.r * 0.7)
        b.mesh.rotation.y = -a
        const flap = Math.sin(time * 7 + b.seed) * 0.6
        if (b.mesh.userData.wingL) { b.mesh.userData.wingL.rotation.z = flap; b.mesh.userData.wingR.rotation.z = -flap }
      }
    }
    if (this.fogCards) {
      for (const f of this.fogCards) {
        f.mesh.position.x = f.baseX + Math.sin(time * 0.14 + f.seed) * 1.6
        f.mesh.material.uniforms.uOpacity.value = (0.22 + 0.06 * Math.sin(time * 0.4 + f.seed)) * (f.baseX - 60) / 20
      }
    }
    if (this.crystals) {
      for (const c of this.crystals) {
        c.mesh.position.y = c.baseY + Math.sin(time * 0.8 + c.seed) * 0.12
        c.mesh.rotation.y = time * 0.4 + c.seed
      }
    }
    if (this.hallMist) {
      for (const hm of this.hallMist) hm.mesh.position.x = hm.baseX + Math.sin(time * 0.1 + hm.seed) * 1.1
    }
    if (this.moonStreak && this.moonDir) {
      // the reflection lies between the VIEWER and the moon (it follows you,
      // like the real thing): center the strip on the camera's azimuth line,
      // clamped to open water
      const az = Math.atan2(this.moonDir.x, this.moonDir.z)
      this.moonStreak.rotation.z = -az
      const cam = this.camera.position
      const cx = Math.max(-60, Math.min(60, cam.x + Math.sin(az) * 42))
      const cz = Math.min(-52, cam.z + Math.cos(az) * 42)
      this.moonStreak.position.set(cx, WATER_Y + 0.05, cz)
      this.moonStreak.material.uniforms.uOpacity.value = 0.5 + Math.max(0, this.moonDir.y) * 0.25
    }
    if (this.greenWindows) {
      for (const gw of this.greenWindows) {
        const f = 0.75 + Math.sin(time * 2.2 + gw.seed * 7) * 0.12 + Math.sin(time * 5.7 + gw.seed * 3) * 0.06
        gw.mesh.material.uniforms.uOpacity.value = f
        if (gw.halo) gw.halo.material.uniforms.uOpacity.value = 0.3 * f
      }
    }
    if (this.warmWindows) {
      for (const ww of this.warmWindows) {
        // hearth-light breathing — slow and gentle, never a strobe (Rule 11)
        ww.mesh.material.uniforms.uOpacity.value = ww.base * (0.9 + Math.sin(time * 1.1 + ww.seed * 5) * 0.07)
      }
    }
    for (const l of this.lights) {
      if (!l.kindled) continue
      if (l.bloom < 1) l.bloom = Math.min(1, l.bloom + dt / 2)
      const ease = 1 - (1 - l.bloom) * (1 - l.bloom)
      const flicker = 1 + Math.sin(time * 7.3 + l.flickerSeed) * 0.05 + Math.sin(time * 13.7 + l.flickerSeed * 2) * 0.03
      const p = l.parts
      if (p.halo) {
        p.halo.material.uniforms.uOpacity.value = l.haloBase * ease * flicker
        p.halo.scale.setScalar(0.6 + 0.4 * ease)
      }
      if (p.pool) p.pool.material.uniforms.uOpacity.value = l.poolBase * ease * flicker
      if (p.glass) p.glass.material.uniforms.uOpacity.value = l.glassBase * ease
      // baked warm pool: lerp ground verts toward warm while the bloom ramps
      if (l.groundWarm?.length && l.warmApplied !== l.bloom) {
        l.warmApplied = l.bloom
        const col = this.ground.geometry.getAttribute('color')
        const base = this.groundBase
        for (const { i, w } of l.groundWarm) {
          const f = w * ease * 1.6
          col.setXYZ(i,
            base[i * 3] * (1 + 1.0 * f),
            base[i * 3 + 1] * (1 + 0.68 * f),
            base[i * 3 + 2] * (1 + 0.28 * f))
        }
        col.needsUpdate = true
      }
    }
  }
}

// Build a flat ribbon mesh through waypoints (roads/paths), draped on terrain.
function ribbonGeometry(points, width) {
  const positions = [], uvs = [], indices = []
  let dist = 0
  for (let i = 0; i < points.length; i++) {
    const [x, z] = points[i]
    const [px, pz] = points[Math.max(0, i - 1)]
    const [nx, nz] = points[Math.min(points.length - 1, i + 1)]
    let dx = nx - px, dz = nz - pz
    const len = Math.hypot(dx, dz) || 1
    dx /= len; dz /= len
    if (i > 0) dist += Math.hypot(x - px, z - pz)
    const ox = -dz * width / 2, oz = dx * width / 2
    for (const s of [-1, 1]) {
      const vx = x + ox * s, vz = z + oz * s
      positions.push(vx, heightAt(vx, vz) + 0.06, vz)
      uvs.push(dist / 8, s * 0.5 + 0.5)
    }
    if (i > 0) {
      const b = i * 2
      indices.push(b - 2, b - 1, b, b - 1, b + 1, b)
    }
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(positions.map((_, i) => (i % 3 === 1 ? 1 : 0)), 3))
  geo.setIndex(indices)
  return geo
}
