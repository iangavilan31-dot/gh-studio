// DREAMSCRAP F0: the tunnel between worlds. A pure-canvas iris — the waking
// frame squeezes shut like a closing eye, zs drift up through the dark, and
// the other side opens. Entry ≤4s, exit ≤3s (Part 6). Presentation only:
// neither world's sim advances because of it, and any wake-up input during
// the closing half cancels the whole thing (the mode stays skippable).
export class DreamTunnel {
  constructor() {
    this.active = false
    this.el = null
  }

  // dir 'in' (waking→dream) or 'out' (dream→waking): close over `dur`
  // seconds, fire onBlack at full dark, then open over openDur.
  begin(dir, dur, onBlack = null) {
    if (this.active) return false
    this.active = true
    this.dir = dir
    this.phase = 'close'
    this.t = 0
    this.dur = dur
    this.openDur = 0.9
    this.onBlack = onBlack
    this.zs = []
    if (!this.el) {
      const c = document.createElement('canvas')
      c.id = 'dreamtunnel'
      c.width = 960; c.height = 540
      c.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;z-index:60;image-rendering:pixelated;pointer-events:none'
      document.getElementById('ui')?.appendChild(c)
      this.el = c
    }
    this.el.style.display = 'block'
    return true
  }

  // the sleeper stirred mid-descent: reopen fast, never fire onBlack
  cancel() {
    if (!this.active || this.phase !== 'close') return false
    this.onBlack = null
    this.phase = 'open'
    this.openDur = 0.45
    this.t = (1 - this.t / this.dur) * this.openDur // reopen from where we are
    return true
  }

  update(dt) {
    if (!this.active) return
    this.t += dt
    const W = 960, H = 540
    const ctx = this.el.getContext('2d')
    ctx.clearRect(0, 0, W, H)
    let r01 // 1 = eye fully open, 0 = full dark
    if (this.phase === 'close') {
      r01 = 1 - Math.min(1, this.t / this.dur)
      if (this.t >= this.dur) {
        this.phase = 'open'
        this.t = 0
        const cb = this.onBlack
        this.onBlack = null
        cb?.()
      }
    } else {
      r01 = Math.min(1, this.t / this.openDur)
      if (this.t >= this.openDur) {
        this.active = false
        this.el.style.display = 'none'
        return
      }
    }
    const maxR = Math.hypot(W / 2, H / 2)
    const ease = r01 * r01 * (3 - 2 * r01)
    const r = Math.max(0.01, maxR * ease)
    // everything outside the shrinking circle is deep-dream dark
    ctx.fillStyle = '#060d18'
    ctx.beginPath()
    ctx.rect(0, 0, W, H)
    ctx.arc(W / 2, H / 2, r, 0, Math.PI * 2, true)
    ctx.fill()
    // a soft rim so it reads as an eyelid, not a screen wipe
    ctx.strokeStyle = 'rgba(168,188,185,0.22)'
    ctx.lineWidth = 3
    ctx.beginPath(); ctx.arc(W / 2, H / 2, r, 0, Math.PI * 2); ctx.stroke()
    // drifting zs once the eye is mostly shut
    if (r01 < 0.55) {
      if (this.zs.length < 5 && Math.floor(this.t * 4) >= this.zs.length) this.zs.push({ x: W / 2 + (this.zs.length - 2) * 44, y: H / 2 + 34, t: 0 })
      ctx.font = 'bold 26px monospace'
      ctx.fillStyle = '#c8d4f0'
      for (const z of this.zs) {
        z.t += dt
        ctx.globalAlpha = Math.max(0, 0.7 - z.t * 0.35) * (1 - r01 / 0.55)
        ctx.fillText('z', z.x + Math.sin(z.t * 3) * 8, z.y - z.t * 34)
      }
      ctx.globalAlpha = 1
    }
  }
}
