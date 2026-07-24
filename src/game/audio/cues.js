// Positional landmark cues (PRESTIGE F.2): a few sounds live at WORLD
// POSITIONS and are heard before their landmarks are seen — the Emberwick
// gate bell and the Hall's organ drone. Each cue is synthesized into a
// distance-attenuated gain + stereo pan by bearing, on the ambience bus.

import { audio } from './engine.js'

class PositionalCues {
  constructor() {
    this.started = false
  }

  start() {
    if (this.started || !audio.started) return
    this.started = true
    const ctx = audio.ctx

    // — the Emberwick bell: a soft struck tone from the gate every 40–70s —
    this.bell = this._mkCue(137, 4, 95)
    const bellStrike = () => {
      if (!audio.ctx) return
      const t = ctx.currentTime
      // three inharmonic partials, long soft decay — a village bell, not a clock
      for (const [f, g, dec] of [[392, 0.5, 2.6], [587.3, 0.28, 2.1], [988, 0.12, 1.4]]) {
        const o = ctx.createOscillator()
        o.type = 'sine'
        o.frequency.value = f
        const og = ctx.createGain()
        og.gain.setValueAtTime(0, t)
        og.gain.linearRampToValueAtTime(g, t + 0.02)
        og.gain.setTargetAtTime(0, t + 0.05, dec / 3)
        o.connect(og)
        og.connect(this.bell.input)
        o.start(t)
        o.stop(t + dec)
      }
      this._bellTimer = setTimeout(bellStrike, 40000 + Math.random() * 30000)
    }
    this._bellTimer = setTimeout(bellStrike, 6000)

    // — the Hall organ: a faint sustained open fifth bleeding through stone —
    this.organ = this._mkCue(-110, 166, 65)
    for (const f of [73.4, 110.0]) { // D2 + A2, the night's key
      const o = ctx.createOscillator()
      o.type = 'triangle'
      o.frequency.value = f
      const og = ctx.createGain()
      og.gain.value = 0.055
      o.connect(og)
      og.connect(this.organ.input)
      o.start()
    }
  }

  _mkCue(x, z, radius) {
    const ctx = audio.ctx
    const input = ctx.createGain()
    const g = ctx.createGain()
    g.gain.value = 0
    input.connect(g)
    let pan = null
    if (ctx.createStereoPanner) {
      pan = ctx.createStereoPanner()
      g.connect(pan)
      pan.connect(audio.buses.ambience)
    } else {
      g.connect(audio.buses.ambience)
    }
    return { x, z, radius, input, g, pan, debug: { pan: 0, gain: 0, d: 0 } }
  }

  // cinematics/photo flights leave the player parked — ramp the cues out
  // rather than droning at their last gain through a whole reel
  duck() {
    if (!this.started || !audio.ctx) return
    const t = audio.ctx.currentTime
    for (const c of [this.bell, this.organ]) c?.g.gain.setTargetAtTime(0, t, 0.4)
  }

  // pan = source direction projected on the camera right vector — full
  // left/right at ±90°, centered ahead/behind; distance curve keeps the cue
  // a rumor at the edge of its radius
  update(px, pz, viewYaw) {
    if (!this.started || !audio.ctx) return
    const t = audio.ctx.currentTime
    for (const c of [this.bell, this.organ]) {
      if (!c) continue
      const dx = c.x - px, dz = c.z - pz
      const d = Math.hypot(dx, dz)
      const gain = Math.max(0, 1 - d / c.radius) ** 1.6 * 0.5
      const pan = Math.max(-1, Math.min(1, (dx * Math.cos(viewYaw) - dz * Math.sin(viewYaw)) / Math.max(d, 0.001)))
      c.g.gain.setTargetAtTime(gain, t, 0.15)
      if (c.pan) c.pan.pan.setTargetAtTime(pan, t, 0.1)
      c.debug = { pan: +pan.toFixed(2), gain: +gain.toFixed(3), d: +d.toFixed(1) }
    }
  }
}

export const cues = new PositionalCues()
