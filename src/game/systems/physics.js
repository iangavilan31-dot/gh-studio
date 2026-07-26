// FIN-0 — Rapier physics: the STRUCTURAL fix for wall-phasing.
//
// The old world.collide() was discrete depenetration against analytic
// cylinders/AABBs: move first, then push out. When a frame's motion ends past
// a thin wall the pushout resolves the wrong way and you are through it.
// TOOLKIT §2: "substepping is a probabilistic patch, not a fix" — at 8 m/s a
// 5-substep solver still moves 1.6cm/step but any thinner geometry is gone.
//
// Rapier's KinematicCharacterController shape-CASTS the entire desired
// translation every call (computeColliderMovement → cast_shape with
// max_time_of_impact = translation_dist, clamped to the hit TOI), so it
// cannot tunnel at any speed with no substepping at all.
//
// Terrain is a heightfield collider, NOT a trimesh (TOOLKIT §2.1): O(1)
// lookup, a fraction of the memory, and no internal-edge pathology — the #2
// complaint after tunneling, where a capsule catches on shared interior
// triangle edges while sliding across a flat floor.

import RAPIER from '@dimforge/rapier3d-compat'
import { heightAt, BOUNDS } from '../world/layout.js'

// terrain sample resolution (metres). 1m over 350×390 = ~137k samples, which
// is nothing for a heightfield since lookup is O(1) rather than a BVH descent.
const CELL = 1

export const CAPSULE = { radius: 0.35, halfHeight: 0.5 } // total height ~1.7m

let ready = false

/** Rapier ships as WASM — this MUST resolve before the first frame. */
export async function initRapier() {
  if (ready) return RAPIER
  await RAPIER.init()
  ready = true
  return RAPIER
}

export function rapierReady() { return ready }

export class Physics {
  constructor() {
    if (!ready) throw new Error('initRapier() must be awaited before new Physics()')
    // gravity is applied by the character controller path, not by rapier
    // stepping — the player is kinematic and the world is static, so we never
    // call world.step() for dynamics. Rapier here is a swept-query engine.
    this.world = new RAPIER.World({ x: 0, y: 0, z: 0 })
    this.colliderMeta = new Map() // collider handle → { kind, tag }
    this._buildTerrain()

    // skin width MUST NOT be zero (TOOLKIT §2.1) or the capsule rests exactly
    // on surfaces and jitters between touching/not-touching.
    this.ctrl = this.world.createCharacterController(0.02)
    this.ctrl.enableAutostep(0.45, 0.2, true)   // curbs, stairs, root lips
    this.ctrl.enableSnapToGround(0.5)           // don't launch off small crests
    this.ctrl.setMaxSlopeClimbAngle(50 * Math.PI / 180)
    this.ctrl.setMinSlopeSlideAngle(38 * Math.PI / 180)
    // docstring for this is literally the fix for "character sticks on walls"
    this.ctrl.setNormalNudgeFactor(1e-4)
    this.ctrl.setApplyImpulsesToDynamicBodies(false)

    // the moving capsule. Kinematic-position based: we own the transform.
    const body = this.world.createRigidBody(
      RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(0, 50, 0),
    )
    this.body = body
    this.capsule = this.world.createCollider(
      RAPIER.ColliderDesc.capsule(CAPSULE.halfHeight, CAPSULE.radius), body,
    )
  }

  // ——— terrain ———
  // Heights are sampled from the SAME analytic heightAt() the renderer and
  // gameplay use, so collision and visuals cannot disagree.
  _buildTerrain() {
    const w = BOUNDS.maxX - BOUNDS.minX
    const d = BOUNDS.maxZ - BOUNDS.minZ
    const nx = Math.round(w / CELL)   // subdivisions along x
    const nz = Math.round(d / CELL)   // subdivisions along z
    // ⚠️ MEASURED, not assumed (TOOLKIT §2.1 warns about exactly this): rapier
    // wants nrows along **Z** and ncols along **X**, COLUMN-MAJOR —
    //     h[row + col*(nrows+1)],  row → z index, col → x index.
    // Three layouts were built and raycast against the analytic heightAt():
    //     rows=x col-major  median err 0.994m   ✗ transposed
    //     rows=x row-major  median err 1.602m   ✗ transposed
    //     rows=z col-major  median err 0.000m   ✓ this one
    // verifyTerrain() below re-asserts it so a regression fails loudly.
    const heights = new Float32Array((nz + 1) * (nx + 1))
    for (let col = 0; col <= nx; col++) {
      const x = BOUNDS.minX + col * CELL
      for (let row = 0; row <= nz; row++) {
        const z = BOUNDS.minZ + row * CELL
        heights[row + col * (nz + 1)] = heightAt(x, z)
      }
    }
    this.terrainInfo = { nx, nz, w, d, cx: (BOUNDS.minX + BOUNDS.maxX) / 2, cz: (BOUNDS.minZ + BOUNDS.maxZ) / 2 }
    const desc = RAPIER.ColliderDesc.heightfield(nz, nx, heights, { x: w, y: 1, z: d })
      .setTranslation(this.terrainInfo.cx, 0, this.terrainInfo.cz)
    const c = this.world.createCollider(desc)
    this.colliderMeta.set(c.handle, { kind: 'terrain', tag: 'terrain' })
    this.terrain = c
    // rapier's query pipeline is only populated by a step — without this every
    // castRay silently MISSES, which made the first verifyTerrain "pass" with
    // zero error purely because it was falling back to heightAt().
    this.world.step()
  }

  /** Re-step the query pipeline after adding colliders. */
  refreshQueries() { this.world.step() }

  /**
   * Register the world's analytic props. Cylinders and boxes map 1:1 onto
   * rapier primitives, so there is no trimesh and no internal-edge problem.
   * y0/h describe a vertical span you can stand on top of.
   */
  addProps({ colliders = [], aabbs = [] } = {}) {
    let n = 0
    for (const c of colliders) {
      const y0 = c.y0 ?? heightAt(c.x, c.z)
      const h = Math.max(0.2, c.h ?? 3)
      const desc = RAPIER.ColliderDesc.cylinder(h / 2, c.r)
        .setTranslation(c.x, y0 + h / 2, c.z)
      const col = this.world.createCollider(desc)
      this.colliderMeta.set(col.handle, { kind: 'cylinder', tag: c.tag ?? 'prop' })
      n++
    }
    for (const b of aabbs) {
      const hx = (b.maxX - b.minX) / 2, hz = (b.maxZ - b.minZ) / 2
      const cx = (b.minX + b.maxX) / 2, cz = (b.minZ + b.maxZ) / 2
      const y0 = b.y0 ?? heightAt(cx, cz)
      const h = Math.max(0.2, b.h ?? 3)
      const desc = RAPIER.ColliderDesc.cuboid(Math.max(0.05, hx), h / 2, Math.max(0.05, hz))
        .setTranslation(cx, y0 + h / 2, cz)
      const col = this.world.createCollider(desc)
      this.colliderMeta.set(col.handle, { kind: 'cuboid', tag: b.tag ?? 'prop' })
      n++
    }
    return n
  }

  /**
   * Unclimbable world boundary: four tall thick slabs just outside BOUNDS, so
   * the player is stopped by a real swept surface rather than a coordinate
   * clamp (a clamp teleports and can pop the camera through geometry).
   */
  addBoundary(height = 60, thick = 4) {
    const { minX, maxX, minZ, maxZ } = BOUNDS
    const mx = (minX + maxX) / 2, mz = (minZ + maxZ) / 2
    const hw = (maxX - minX) / 2 + thick, hd = (maxZ - minZ) / 2 + thick
    const slabs = [
      [minX - thick / 2, mz, thick / 2, hd],
      [maxX + thick / 2, mz, thick / 2, hd],
      [mx, minZ - thick / 2, hw, thick / 2],
      [mx, maxZ + thick / 2, hw, thick / 2],
    ]
    for (const [x, z, hx, hz] of slabs) {
      const desc = RAPIER.ColliderDesc.cuboid(hx, height / 2, hz).setTranslation(x, height / 2 - 5, z)
      const col = this.world.createCollider(desc)
      this.colliderMeta.set(col.handle, { kind: 'boundary', tag: 'boundary' })
    }
  }

  /**
   * The swept move. `pos` is the capsule CENTRE (feet + halfHeight + radius).
   * Returns the corrected translation plus contact facts the controller needs.
   */
  move(pos, desired) {
    this.body.setNextKinematicTranslation({ x: pos.x, y: pos.y, z: pos.z })
    this.capsule.setTranslation({ x: pos.x, y: pos.y, z: pos.z })
    this.ctrl.computeColliderMovement(this.capsule, desired)
    const m = this.ctrl.computedMovement()
    const grounded = this.ctrl.computedGrounded()
    let hitWall = false
    for (let i = 0; i < this.ctrl.numComputedCollisions(); i++) {
      const col = this.ctrl.computedCollision(i)
      if (col && Math.abs(col.normal1?.y ?? 0) < 0.6) { hitWall = true; break }
    }
    return { dx: m.x, dy: m.y, dz: m.z, grounded, hitWall }
  }

  /**
   * Ground height under a point via a downward ray.
   * Returns null on a miss — callers decide the fallback. It must NOT silently
   * return heightAt(): that fallback is what made the first terrain check
   * report a perfect zero error while every single ray was missing.
   */
  cameraCast(from, dir, maxDist, radius = 0.25) {
    const shape = this._camSphere || (this._camSphere = new RAPIER.Ball(radius))
    const hit = this.world.castShape(
      { x: from.x, y: from.y, z: from.z },
      { x: 0, y: 0, z: 0, w: 1 },
      { x: dir.x, y: dir.y, z: dir.z },
      shape, 0, maxDist, true,
    )
    if (!hit) return null
    const t = hit.time_of_impact ?? hit.toi
    return typeof t === 'number' ? t : null
  }

  groundY(x, z, from = 200) {
    const ray = new RAPIER.Ray({ x, y: from, z }, { x: 0, y: -1, z: 0 })
    const hit = this.world.castRay(ray, from + 400, true)
    return hit ? from - hit.timeOfImpact : null
  }

  /**
   * Self-check that catches a transposed heightfield immediately: rapier's own
   * raycast ground height must agree with the analytic heightAt() everywhere.
   * A transposition passes at the centre and fails badly off-axis, which is
   * exactly why the samples below are asymmetric.
   */
  verifyTerrain(samples = 800) {
    const errs = []
    let misses = 0, worstAt = null, worst = 0
    for (let i = 0; i < samples; i++) {
      // deterministic scatter, deliberately asymmetric in x vs z so a
      // transposition cannot accidentally pass
      const x = BOUNDS.minX + 10 + ((i * 53) % samples) / samples * (BOUNDS.maxX - BOUNDS.minX - 20)
      const z = BOUNDS.minZ + 10 + ((i * 97) % samples) / samples * (BOUNDS.maxZ - BOUNDS.minZ - 20)
      const got = this.groundY(x, z)
      if (got == null) { misses++; continue }
      const want = heightAt(x, z)
      const err = Math.abs(got - want)
      errs.push(err)
      if (err > worst) { worst = err; worstAt = { x: +x.toFixed(1), z: +z.toFixed(1), want: +want.toFixed(2), got: +got.toFixed(2) } }
    }
    errs.sort((a, b) => a - b)
    const median = errs.length ? errs[Math.floor(errs.length / 2)] : Infinity
    return {
      hits: errs.length, misses,
      median: +median.toFixed(4), worst: +worst.toFixed(3), worstAt,
      // a transposition shows up as a large MEDIAN; isolated spikes are just
      // 1m sampling across a cliff edge
      aligned: errs.length > samples * 0.9 && median < 0.15,
    }
  }

  dispose() { this.world?.free?.() }
}
