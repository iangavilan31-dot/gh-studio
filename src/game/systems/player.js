// Player controller (MASTER_PROMPT 4.2 feel spec): camera-relative movement,
// 120ms ease-out accel, <90ms turn-in-place, 0.5m hop, slope slide, gaits.

import * as THREE from 'three'
import { makeAnimState, advanceAnim, applyPose } from './anim.js'

// ASCENSION Part 0.2 — "ur to slow". Realistic speeds were exactly the
// problem. Run is what you get from simply pushing the stick, no button held;
// the whole game is tuned around 5.2.
const WALK = 2.2, RUN = 5.2, SPRINT = 8.0
const ACCEL_TIME = 0.15      // 0 → full
const DECEL_TIME = 0.12      // full → 0, with a settle step
const GRAV = -14
const JUMP_APEX = 1.6
const COYOTE = 6 / 60        // 6 frames
const CAP_R = 0.35, CAP_HH = 0.5
const CAP_CENTRE = CAP_R + CAP_HH   // feet → capsule centre

const _v = new THREE.Vector3()

export class PlayerController {
  constructor(rig, world) {
    this.rig = rig
    this.world = world
    this.pos = new THREE.Vector3(0, 0, 3)
    this.vel = new THREE.Vector3()
    this.yaw = 0            // facing
    this.targetYaw = 0
    this.vy = 0
    this.grounded = true
    this.anim = makeAnimState()
    this.surface = 'grass'
    this.latencyLog = []    // {code, ms} input→movement measurements
    this._pendingLatency = null
  }

  // C.4: glance back at a point for a moment (freshly lit lamps deserve it)
  lookBack(x, z, dur = 2.5) {
    this._lookBack = { x, z, t: dur }
  }

  setAction(a) {
    this.anim.action = a
    this.anim.actionT = 0
  }

  update(input, camYaw, dt, time) {
    const [ax, az] = input.moveAxis()
    const moving = ax !== 0 || az !== 0

    // latency measurement: first frame where a fresh WASD press produces velocity
    for (const code of ['KeyW', 'KeyA', 'KeyS', 'KeyD']) {
      if (input.pressed(code)) this._pendingLatency = { code, t: input.pressTimes.get(code) }
    }

    // actions cancel on movement
    if (moving && this.anim.action && ['sit', 'lie', 'sleep'].includes(this.anim.action)) this.anim.action = null
    const locked = this.anim.action && ['sit', 'lie', 'sleep', 'channel'].includes(this.anim.action)

    // hop — 1.6m apex, with coyote time so a step off a lip still jumps
    const canJump = (this.grounded || this._coyote > 0) && !locked
    if (input.pressed('Space') && canJump) {
      this.vy = Math.sqrt(-2 * GRAV * JUMP_APEX)
      this.grounded = false
      this._coyote = 0
    }
    // sit/lie toggle
    if (input.pressed('KeyC')) {
      if (this.anim.action === 'sit') this.setAction('lie')
      else if (this.anim.action === 'lie') this.setAction(null)
      else this.setAction('sit')
    }

    // Run is the DEFAULT (no button). Shift sprints; a light analog tilt walks.
    const sprint = input.down('ShiftLeft', 'ShiftRight')
    const tilt = Math.min(1, Math.hypot(ax, az))
    const base = tilt < 0.55 ? WALK : (sprint ? SPRINT : RUN)
    const targetSpeed = locked || !moving ? 0 : base
    this.sprinting = moving && sprint && tilt >= 0.55   // camera adds +6° FOV

    // desired world-space direction (camera-relative)
    // camera forward (horiz): (-sin cy, -cos cy); right: (cos cy, -sin cy)
    let dirX = 0, dirZ = 0
    if (moving) {
      const fwd = -az
      dirX = -Math.sin(camYaw) * fwd + Math.cos(camYaw) * ax
      dirZ = -Math.cos(camYaw) * fwd - Math.sin(camYaw) * ax
      const invLen = 1 / Math.hypot(dirX, dirZ)
      dirX *= invLen; dirZ *= invLen
      this.targetYaw = Math.atan2(dirX, dirZ)
    }

    // accel 0.15s / decel 0.12s, ease-out (exponential damp ≈ ease-out)
    const targetVX = dirX * targetSpeed, targetVZ = dirZ * targetSpeed
    const speeding = targetSpeed > Math.hypot(this.vel.x, this.vel.z)
    const lambda = 3 / (speeding ? ACCEL_TIME : DECEL_TIME)
    const k = 1 - Math.exp(-lambda * dt)
    this.vel.x += (targetVX - this.vel.x) * k
    this.vel.z += (targetVZ - this.vel.z) * k

    // turn-in-place under 90ms: damp yaw hard
    let dy = this.targetYaw - this.yaw
    while (dy > Math.PI) dy -= Math.PI * 2
    while (dy < -Math.PI) dy += Math.PI * 2
    const yawStep = dy * (1 - Math.exp(-(Math.PI / 0.09) * dt))
    this.yaw += yawStep
    // smoothed yaw rate feeds the C.1 turn lean
    if (dt > 0) this.anim.yawRate += ((yawStep / dt) * 0.25 - this.anim.yawRate) * Math.min(1, dt * 7)

    // ——— SWEPT MOVE (ASCENSION 0.1) ———
    // One shape-cast of the whole frame's translation. Never assign a
    // transform without a sweep; that is what let the old build phase through
    // walls. Falls back to the legacy pushout only if WASM never initialised,
    // so a physics failure degrades instead of bricking the game.
    if (this.physics) {
      const wasGrounded = this.grounded
      if (!this.grounded) this.vy += GRAV * dt
      else if (this.vy < 0) this.vy = 0
      // gravity probe while grounded keeps us glued to downhill slopes
      const vyStep = this.grounded ? -2 * dt : this.vy * dt
      _v.set(this.pos.x, this.pos.y + CAP_CENTRE, this.pos.z)
      const r = this.physics.move(_v, { x: this.vel.x * dt, y: vyStep, z: this.vel.z * dt })
      this.pos.x += r.dx
      this.pos.y += r.dy
      this.pos.z += r.dz
      // Slide: remove ONLY the velocity component into the wall, keeping the
      // tangential component intact. Scaling the whole vector instead makes a
      // glancing brush cost all your speed and re-accelerate over 0.15s —
      // sticky walls, and ~9s of drag on a 95m Park crossing.
      if (r.hitWall) {
        const nl = Math.hypot(r.nx, r.nz)
        if (nl > 1e-6) {
          const ux = r.nx / nl, uz = r.nz / nl
          const into = this.vel.x * ux + this.vel.z * uz
          if (into < 0) { this.vel.x -= into * ux; this.vel.z -= into * uz }
        }
      }
      if (r.grounded) {
        if (!wasGrounded) {
          const impact = Math.min(1, -this.vy / 5)
          this.anim.landT = 0.38 * (0.5 + 0.5 * impact)
          this.onLand?.(impact)
        }
        this.grounded = true; this.vy = 0; this._coyote = COYOTE
      } else {
        this.grounded = false
        this._coyote = Math.max(0, (this._coyote ?? 0) - dt)
      }
      this.surface = this.world.surfaceAt(this.pos.x, this.pos.z)
      return this._finish(input, dt, time)
    }

    // ——— legacy fallback (no physics) ———
    this.pos.x += this.vel.x * dt
    this.pos.z += this.vel.z * dt
    this.world.collide(this.pos, 0.35)
    const groundY = this.world.heightAt(this.pos.x, this.pos.z)
    if (!this.grounded) {
      this.vy += GRAV * dt
      this.pos.y += this.vy * dt
      if (this.pos.y <= groundY) {
        // landing settle (C.1): the body compresses for a beat and the dust
        // acknowledges the ground — weight, not teleportation
        const impact = Math.min(1, -this.vy / 5)
        this.pos.y = groundY; this.grounded = true; this.vy = 0
        this.anim.landT = 0.38 * (0.5 + 0.5 * impact)
        this.onLand?.(impact)
      }
    } else {
      // slope check: >40° slides gently
      const g = 0.5
      const hx = (this.world.heightAt(this.pos.x + g, this.pos.z) - this.world.heightAt(this.pos.x - g, this.pos.z)) / (2 * g)
      const hz = (this.world.heightAt(this.pos.x, this.pos.z + g) - this.world.heightAt(this.pos.x, this.pos.z - g)) / (2 * g)
      const slope = Math.atan(Math.hypot(hx, hz))
      const onLadder = this.world.onLadder && this.world.onLadder(this.pos.x, this.pos.z)
      if (slope > (40 * Math.PI) / 180 && !onLadder) {
        this.pos.x -= hx * 2.2 * dt
        this.pos.z -= hz * 2.2 * dt
      }
      this.pos.y = this.world.heightAt(this.pos.x, this.pos.z)
    }

    this.surface = this.world.surfaceAt(this.pos.x, this.pos.z)
    return this._finish(input, dt, time)
  }

  // everything after the move resolves: latency log, lean, look-back, rig,
  // footsteps. Shared by the swept path and the legacy fallback so the two
  // can never drift apart.
  _finish(input, dt, time) {
    // record latency once movement actually applied
    const speed = Math.hypot(this.vel.x, this.vel.z)
    if (this._pendingLatency && speed > 0.01) {
      const ms = performance.now() - this._pendingLatency.t
      this.latencyLog.push({ code: this._pendingLatency.code, ms: Math.round(ms * 10) / 10 })
      if (this.latencyLog.length > 20) this.latencyLog.shift()
      this._pendingLatency = null
    }

    // C.1: ground slope ahead feeds uphill lean / careful downhill steps
    const aheadX = this.pos.x + Math.sin(this.yaw) * 0.9
    const aheadZ = this.pos.z + Math.cos(this.yaw) * 0.9
    const slopeRaw = (this.world.heightAt(aheadX, aheadZ) - this.pos.y) / 0.9
    this.anim.slope = (this.anim.slope ?? 0) + (Math.max(-1, Math.min(1, slopeRaw)) - (this.anim.slope ?? 0)) * Math.min(1, dt * 5)

    // C.4 look-back: head turns toward the remembered point, then lets go
    if (this._lookBack) {
      this._lookBack.t -= dt
      const want = Math.atan2(this._lookBack.x - this.pos.x, this._lookBack.z - this.pos.z) - this.yaw
      let dyl = want
      while (dyl > Math.PI) dyl -= Math.PI * 2
      while (dyl < -Math.PI) dyl += Math.PI * 2
      const clamped = Math.max(-1.0, Math.min(1.0, dyl))
      const env = Math.min(1, Math.max(0, this._lookBack.t) / 0.5) // ease out at the end
      this.anim.headLook = (this.anim.headLook ?? 0) + (clamped * env - (this.anim.headLook ?? 0)) * Math.min(1, dt * 4)
      // release only once the head has actually settled — no single-frame snap
      if (this._lookBack.t <= 0 && Math.abs(this.anim.headLook) < 0.02) { this._lookBack = null; this.anim.headLook = 0 }
    }

    // drive rig
    advanceAnim(this.anim, dt, speed, !this.grounded)

    // footstep events on stride beats (each leg plant = phase crossing π)
    const strideIdx = Math.floor(this.anim.phase / Math.PI)
    if (strideIdx !== this._lastStride) {
      if (this.grounded && speed > 0.4 && this.onFootstep) this.onFootstep(this.surface, Math.min(1, speed / 3.2))
      this._lastStride = strideIdx
    }
    this.rig.group.position.copy(this.pos)
    this.rig.group.rotation.y = this.yaw
    applyPose(this.rig, this.anim, time)
  }
}
