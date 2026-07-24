// Third-person orbit camera (MASTER_PROMPT 4.3): 4.5m back, 1.8m above hip,
// 8° down-tilt, 0.12s smoothing, collision pull-in with 0.25s recovery,
// FOV 55 (+4 jogging, eased), auto-frame bias toward interactables.

import * as THREE from 'three'

const _desired = new THREE.Vector3()
const _pivot = new THREE.Vector3()
const _dir = new THREE.Vector3()

export class OrbitCamera {
  constructor(camera, world) {
    this.camera = camera
    this.world = world
    this.yaw = 0
    this.pitch = -0.14 // ≈8° down
    this.smoothYaw = 0
    this.smoothPitch = this.pitch
    this.dist = 4.5
    this.curDist = 4.5
    this.fov = 55
    this.autoFrame = true
    this.sensitivity = 0.0026
    this.revealT = 0 // C.2 reveal volume: >0 while a zone entrance widens the frame
    this.revealTarget = null
  }

  // C.2: a zone entrance may borrow the camera for 1–3s — widen, lift, bias
  // yaw toward the landmark — WITHOUT removing player control (bias only)
  reveal(target, dur = 2.6) {
    this.revealT = dur
    this.revealDur = dur
    this.revealTarget = target
  }

  // place the camera in clear air at a scene entrance: probe yaws around the
  // preferred one and take the most open — the spawn bench sits under a big
  // tree that otherwise pins the opening shot point-blank against bark
  autoPlace(playerPos, preferYaw = Math.PI) {
    _pivot.set(playerPos.x, playerPos.y + 1.25, playerPos.z)
    const free = (yaw) => {
      const cp = Math.cos(-0.14)
      _dir.set(Math.sin(yaw) * cp, -Math.sin(-0.14), Math.cos(yaw) * cp)
      for (let i = 1; i <= 10; i++) {
        const t = (i / 10) * this.dist
        if (this.world.cameraBlocked(_pivot.x + _dir.x * t, _pivot.y + _dir.y * t, _pivot.z + _dir.z * t, 0.25)) return ((i - 1) / 10) * this.dist
      }
      return this.dist
    }
    let best = preferYaw, bestFree = free(preferYaw)
    for (const off of [0.5, -0.5, 1.0, -1.0, 1.5, -1.5, 2.2, -2.2, Math.PI]) {
      if (bestFree >= 3.2) break
      const f = free(preferYaw + off)
      if (f > bestFree) { bestFree = f; best = preferYaw + off }
    }
    this.yaw = this.smoothYaw = best
    this.pitch = this.smoothPitch = -0.14
    this.curDist = Math.max(1.5, bestFree)
  }

  update(playerPos, playerYaw, jogging, lookDelta, dt, interactables = []) {
    this.yaw -= lookDelta[0] * this.sensitivity
    // comfortable bounds: never top-down, never under the floor — extreme
    // pitches made the whole world read as a wall of ground
    this.pitch = THREE.MathUtils.clamp(this.pitch - lookDelta[1] * this.sensitivity, -0.72, 0.38)

    // auto-frame assist: bias yaw toward nearest interactable within 6m (max 2°/s)
    if (this.autoFrame && lookDelta[0] === 0) {
      let best = null, bestD = 6
      for (const it of interactables) {
        const d = Math.hypot(it.x - playerPos.x, it.z - playerPos.z)
        if (d < bestD) { bestD = d; best = it }
      }
      if (best) {
        const want = Math.atan2(playerPos.x - best.x, playerPos.z - best.z)
        let dy = want - this.yaw
        while (dy > Math.PI) dy -= Math.PI * 2
        while (dy < -Math.PI) dy += Math.PI * 2
        const maxStep = (2 * Math.PI / 180) * dt
        this.yaw += THREE.MathUtils.clamp(dy * 0.5 * dt, -maxStep, maxStep)
      }
    }

    // C.1 jog lag: the camera trails an extra beat at a run and eases back
    // when the keeper slows — speed you can feel in the frame
    this.jogLag = (this.jogLag ?? 0) + ((jogging ? 0.45 : 0) - (this.jogLag ?? 0)) * (1 - Math.exp(-dt / 0.5))

    // C.2 reveal: eased bell over the duration — the FRAME drifts toward the
    // landmark as a presentation-only yaw offset (movement basis untouched,
    // so control is influenced, never taken), distance and FOV widen
    let revealAmt = 0
    this.revealYawOff = this.revealYawOff ?? 0
    if (this.revealT > 0) {
      this.revealT = Math.max(0, this.revealT - dt)
      const x = 1 - this.revealT / this.revealDur
      revealAmt = Math.sin(Math.min(1, x * 1.15) * Math.PI) // ease in, hold, ease out
      if (this.revealTarget) {
        const want = Math.atan2(playerPos.x - this.revealTarget[0], playerPos.z - this.revealTarget[1])
        let dyr = want - this.yaw
        while (dyr > Math.PI) dyr -= Math.PI * 2
        while (dyr < -Math.PI) dyr += Math.PI * 2
        const wantOff = Math.max(-0.9, Math.min(0.9, dyr)) * revealAmt
        this.revealYawOff += (wantOff - this.revealYawOff) * Math.min(1, dt * 2.2)
      }
    } else if (Math.abs(this.revealYawOff) > 0.001) {
      this.revealYawOff *= Math.exp(-dt * 2.5)
    } else {
      this.revealYawOff = 0
    }

    // 0.12s orbit smoothing
    const k = 1 - Math.exp(-dt / 0.12)
    let dy = this.yaw - this.smoothYaw
    while (dy > Math.PI) dy -= Math.PI * 2
    while (dy < -Math.PI) dy += Math.PI * 2
    this.smoothYaw += dy * k
    this.smoothPitch += (this.pitch - this.smoothPitch) * k

    // pivot: 1.8m above hip → about head height of the little wizard + margin
    _pivot.set(playerPos.x, playerPos.y + 1.25, playerPos.z)

    const viewYaw = this.smoothYaw + this.revealYawOff
    _dir.set(
      Math.sin(viewYaw) * Math.cos(this.smoothPitch),
      -Math.sin(this.smoothPitch),
      Math.cos(viewYaw) * Math.cos(this.smoothPitch)
    )
    const wantDist = this.dist + revealAmt * 2.1 + this.jogLag
    _desired.copy(_pivot).addScaledVector(_dir, wantDist)
    _desired.y = Math.max(_desired.y, this.world.heightAt(_desired.x, _desired.z) + 0.3)

    // collision: march along pivot→desired, pull in at first obstruction (0.25s recovery)
    let targetDist = wantDist
    const steps = 10
    for (let i = 1; i <= steps; i++) {
      const t = (i / steps) * wantDist
      const px = _pivot.x + _dir.x * t
      const py = _pivot.y + _dir.y * t
      const pz = _pivot.z + _dir.z * t
      if (this.world.cameraBlocked(px, py, pz, 0.25)) { targetDist = Math.max(1.5, t - 0.3); break } // floor keeps the wizard in frame
    }
    if (targetDist < this.curDist) this.curDist = targetDist // snap in (never clip)
    else this.curDist += (targetDist - this.curDist) * (1 - Math.exp(-dt / 0.25)) // ease out

    this.camera.position.copy(_pivot).addScaledVector(_dir, this.curDist)
    this.camera.lookAt(_pivot)

    // FOV: 55 (+4 while jogging), eased; reveals widen further (C.2)
    const targetFov = (jogging ? 59 : 55) + revealAmt * 5
    this.fov += (targetFov - this.fov) * (1 - Math.exp(-dt / 0.3))
    if (Math.abs(this.camera.fov - this.fov) > 0.01) {
      this.camera.fov = this.fov
      this.camera.updateProjectionMatrix()
    }
  }
}
