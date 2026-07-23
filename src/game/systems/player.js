// Player controller (MASTER_PROMPT 4.2 feel spec): camera-relative movement,
// 120ms ease-out accel, <90ms turn-in-place, 0.5m hop, slope slide, gaits.

import * as THREE from 'three'
import { makeAnimState, advanceAnim, applyPose } from './anim.js'

const WALK = 1.6, JOG = 3.2
const ACCEL_TIME = 0.12
const GRAV = -14

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

    // hop
    if (input.pressed('Space') && this.grounded && !locked) {
      this.vy = Math.sqrt(-2 * GRAV * 0.5) // 0.5m apex
      this.grounded = false
    }
    // sit/lie toggle
    if (input.pressed('KeyC')) {
      if (this.anim.action === 'sit') this.setAction('lie')
      else if (this.anim.action === 'lie') this.setAction(null)
      else this.setAction('sit')
    }

    const jog = input.down('ShiftLeft', 'ShiftRight')
    const targetSpeed = locked || !moving ? 0 : (jog ? JOG : WALK)

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

    // accel: 0→full in 120ms with ease-out (exponential damp ≈ ease-out)
    const lambda = 3 / ACCEL_TIME
    const targetVX = dirX * targetSpeed, targetVZ = dirZ * targetSpeed
    const k = 1 - Math.exp(-lambda * dt)
    this.vel.x += (targetVX - this.vel.x) * k
    this.vel.z += (targetVZ - this.vel.z) * k

    // turn-in-place under 90ms: damp yaw hard
    let dy = this.targetYaw - this.yaw
    while (dy > Math.PI) dy -= Math.PI * 2
    while (dy < -Math.PI) dy += Math.PI * 2
    this.yaw += dy * (1 - Math.exp(-(Math.PI / 0.09) * dt))

    // integrate
    this.pos.x += this.vel.x * dt
    this.pos.z += this.vel.z * dt

    // world bounds + collisions (circle pushout)
    this.world.collide(this.pos, 0.35)

    // ground follow + gravity + slope slide
    const groundY = this.world.heightAt(this.pos.x, this.pos.z)
    if (!this.grounded) {
      this.vy += GRAV * dt
      this.pos.y += this.vy * dt
      if (this.pos.y <= groundY) { this.pos.y = groundY; this.grounded = true; this.vy = 0 }
    } else {
      // slope check: >40° slides gently
      const g = 0.5
      const hx = (this.world.heightAt(this.pos.x + g, this.pos.z) - this.world.heightAt(this.pos.x - g, this.pos.z)) / (2 * g)
      const hz = (this.world.heightAt(this.pos.x, this.pos.z + g) - this.world.heightAt(this.pos.x, this.pos.z - g)) / (2 * g)
      const slope = Math.atan(Math.hypot(hx, hz))
      if (slope > (40 * Math.PI) / 180) {
        this.pos.x -= hx * 2.2 * dt
        this.pos.z -= hz * 2.2 * dt
      }
      this.pos.y = this.world.heightAt(this.pos.x, this.pos.z)
    }

    this.surface = this.world.surfaceAt(this.pos.x, this.pos.z)

    // record latency once movement actually applied
    const speed = Math.hypot(this.vel.x, this.vel.z)
    if (this._pendingLatency && speed > 0.01) {
      const ms = performance.now() - this._pendingLatency.t
      this.latencyLog.push({ code: this._pendingLatency.code, ms: Math.round(ms * 10) / 10 })
      if (this.latencyLog.length > 20) this.latencyLog.shift()
      this._pendingLatency = null
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
