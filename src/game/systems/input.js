// Input (MASTER_PROMPT 4.2): keyboard + mouse orbit (pointer lock optional)
// + basic gamepad (left stick move, right stick look, buttons mapped to the
// three verbs). Part 10 settings feed remap/sensitivity/invert through here.
// Timestamps every press so the controller can log input→movement latency.

export class Input {
  constructor(canvas) {
    this.keys = new Set()
    this.pressTimes = new Map() // code → performance.now() of keydown
    this.lookDX = 0
    this.lookDY = 0
    this.pointerLocked = false
    this.justPressed = new Set()
    // settings (Part 10): remap maps a REQUESTED code → the physical code that
    // now serves it (callers keep asking for the defaults)
    this.remap = {}
    this.sensitivity = 1
    this.invertY = false
    this.padDeadzone = 0.22
    this._padPrev = new Set()

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

  _c(code) { return this.remap[code] ?? code }
  down(...codes) { return codes.some((c) => this.keys.has(this._c(c))) }
  pressed(...codes) { return codes.some((c) => this.justPressed.has(this._c(c))) }

  // one connected gamepad, polled per frame (buttons synthesize key codes so
  // every existing consumer — channel hold included — just works)
  pollGamepad() {
    const pads = navigator.getGamepads?.() ?? []
    const gp = [...pads].find((p) => p && p.connected)
    this.pad = gp ?? null
    if (!gp) return
    const held = new Set()
    const b = (i) => gp.buttons[i]?.pressed
    if (b(0)) held.add('Space')      // A: hop
    if (b(1)) held.add('KeyC')       // B: sit/lie
    if (b(2) || b(5) || b(7)) held.add('KeyE') // X / RB / RT: kindle (hold)
    if (b(9)) held.add('Escape')     // start: menu
    if (b(4) || b(6)) held.add('ShiftLeft') // LB/LT: jog
    for (const code of held) {
      if (!this._padPrev.has(code)) { this.justPressed.add(code); this.pressTimes.set(code, performance.now()) }
      this.keys.add(code)
    }
    for (const code of this._padPrev) if (!held.has(code)) this.keys.delete(code)
    this._padPrev = held
    // right stick → look
    const rx = gp.axes[2] ?? 0, ry = gp.axes[3] ?? 0
    if (Math.abs(rx) > this.padDeadzone) this.lookDX += rx * 14
    if (Math.abs(ry) > this.padDeadzone) this.lookDY += ry * 10
  }

  // camera-relative move axis: [x strafe, z forward], normalized
  moveAxis() {
    let x = 0, z = 0
    if (this.down('KeyW', 'ArrowUp')) z -= 1
    if (this.down('KeyS', 'ArrowDown')) z += 1
    if (this.down('KeyA', 'ArrowLeft')) x -= 1
    if (this.down('KeyD', 'ArrowRight')) x += 1
    if (this.pad) {
      const lx = this.pad.axes[0] ?? 0, lz = this.pad.axes[1] ?? 0
      if (Math.abs(lx) > this.padDeadzone) x += lx
      if (Math.abs(lz) > this.padDeadzone) z += lz
    }
    const l = Math.hypot(x, z)
    return l > 0 ? [x / l, z / l] : [0, 0]
  }

  consumeLook() {
    const d = [this.lookDX * this.sensitivity, this.lookDY * this.sensitivity * (this.invertY ? -1 : 1)]
    this.lookDX = 0; this.lookDY = 0
    return d
  }

  endFrame() { this.justPressed.clear() }
}
