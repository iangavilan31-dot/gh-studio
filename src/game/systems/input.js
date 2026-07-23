// Input (MASTER_PROMPT 4.2): keyboard + mouse orbit (pointer lock optional).
// Timestamps every press so the controller can log input→movement latency.

export class Input {
  constructor(canvas) {
    this.keys = new Set()
    this.pressTimes = new Map() // code → performance.now() of keydown
    this.lookDX = 0
    this.lookDY = 0
    this.pointerLocked = false
    this.justPressed = new Set()

    window.addEventListener('keydown', (e) => {
      if (e.repeat) return
      this.keys.add(e.code)
      this.justPressed.add(e.code)
      this.pressTimes.set(e.code, performance.now())
    })
    window.addEventListener('keyup', (e) => this.keys.delete(e.code))
    window.addEventListener('blur', () => this.keys.clear())

    canvas.addEventListener('click', () => {
      if (!this.pointerLocked) canvas.requestPointerLock?.()
    })
    document.addEventListener('pointerlockchange', () => {
      this.pointerLocked = document.pointerLockElement === canvas
    })
    window.addEventListener('mousemove', (e) => {
      if (this.pointerLocked) {
        this.lookDX += e.movementX
        this.lookDY += e.movementY
      }
    })
  }

  down(...codes) { return codes.some((c) => this.keys.has(c)) }
  pressed(...codes) { return codes.some((c) => this.justPressed.has(c)) }

  // camera-relative move axis: [x strafe, z forward], normalized
  moveAxis() {
    let x = 0, z = 0
    if (this.down('KeyW', 'ArrowUp')) z -= 1
    if (this.down('KeyS', 'ArrowDown')) z += 1
    if (this.down('KeyA', 'ArrowLeft')) x -= 1
    if (this.down('KeyD', 'ArrowRight')) x += 1
    const l = Math.hypot(x, z)
    return l > 0 ? [x / l, z / l] : [0, 0]
  }

  consumeLook() {
    const d = [this.lookDX, this.lookDY]
    this.lookDX = 0; this.lookDY = 0
    return d
  }

  endFrame() { this.justPressed.clear() }
}
