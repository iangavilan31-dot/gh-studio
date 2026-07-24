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

    // 0.12s orbit smoothing
    const k = 1 - Math.exp(-dt / 0.12)
    let dy = this.yaw - this.smoothYaw
    while (dy > Math.PI) dy -= Math.PI * 2
    while (dy < -Math.PI) dy += Math.PI * 2
    this.smoothYaw += dy * k
    this.smoothPitch += (this.pitch - this.smoothPitch) * k

    // pivot: 1.8m above hip → about head height of the little wizard + margin
    _pivot.set(playerPos.x, playerPos.y + 1.25, playerPos.z)

    _dir.set(
      Math.sin(this.smoothYaw) * Math.cos(this.smoothPitch),
      -Math.sin(this.smoothPitch),
      Math.cos(this.smoothYaw) * Math.cos(this.smoothPitch)
    )
    _desired.copy(_pivot).addScaledVector(_dir, this.dist)
    _desired.y = Math.max(_desired.y, this.world.heightAt(_desired.x, _desired.z) + 0.3)

    // collision: march along pivot→desired, pull in at first obstruction (0.25s recovery)
    let targetDist = this.dist
    const steps = 10
    for (let i = 1; i <= steps; i++) {
      const t = (i / steps) * this.dist
      const px = _pivot.x + _dir.x * t
      const py = _pivot.y + _dir.y * t
      const pz = _pivot.z + _dir.z * t
      if (this.world.cameraBlocked(px, py, pz, 0.25)) { targetDist = Math.max(1.5, t - 0.3); break } // floor keeps the wizard in frame
    }
    if (targetDist < this.curDist) this.curDist = targetDist // snap in (never clip)
    else this.curDist += (targetDist - this.curDist) * (1 - Math.exp(-dt / 0.25)) // ease out

    this.camera.position.copy(_pivot).addScaledVector(_dir, this.curDist)
    this.camera.lookAt(_pivot)

    // FOV: 55 (+4 while jogging), eased
    const targetFov = jogging ? 59 : 55
    this.fov += (targetFov - this.fov) * (1 - Math.exp(-dt / 0.3))
    if (Math.abs(this.camera.fov - this.fov) > 0.01) {
      this.camera.fov = this.fov
      this.camera.updateProjectionMatrix()
    }
  }
}
