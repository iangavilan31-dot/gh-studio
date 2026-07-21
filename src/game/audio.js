// ============================================================
// EMBERVALE — WebAudio: generated SFX + ambient beds. No assets.
// ============================================================

export class AudioSys {
  constructor() {
    this.ctx = null
    this.master = null
    this.ambGain = null
    this.ambNodes = []
    this.musicTimer = null
    this.zoneKind = null
    this.muted = false
  }

  ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume()
      return true
    }
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)()
      this.master = this.ctx.createGain()
      this.master.gain.value = 0.55
      this.master.connect(this.ctx.destination)
      this.ambGain = this.ctx.createGain()
      this.ambGain.gain.value = 0.3
      this.ambGain.connect(this.master)
      return true
    } catch {
      return false
    }
  }

  setMuted(m) {
    this.muted = m
    if (this.master) this.master.gain.value = m ? 0 : 0.55
  }

  // ---------- ambient per zone ----------
  setZone(kind) {
    if (!this.ensure() || kind === this.zoneKind) return
    this.zoneKind = kind
    for (const n of this.ambNodes) {
      try { n.stop ? n.stop() : n.disconnect() } catch {}
    }
    this.ambNodes = []
    if (this.musicTimer) clearInterval(this.musicTimer)
    const c = this.ctx

    // base drone: two detuned oscillators through lowpass
    const roots = { village: 110, forest: 82.4, tower: 73.4, castle: 65.4, boss: 55, beacon: 130.8 }
    const root = roots[kind] || 82.4
    const filt = c.createBiquadFilter()
    filt.type = 'lowpass'
    filt.frequency.value = kind === 'beacon' ? 900 : 420
    filt.Q.value = 0.7
    const g = c.createGain()
    g.gain.value = kind === 'boss' ? 0.12 : 0.09
    filt.connect(g)
    g.connect(this.ambGain)
    for (const [mult, det] of [[1, -6], [1.5, 5], [2, 8]]) {
      const o = c.createOscillator()
      o.type = kind === 'boss' ? 'sawtooth' : 'triangle'
      o.frequency.value = root * mult
      o.detune.value = det
      o.connect(filt)
      o.start()
      this.ambNodes.push(o)
    }
    this.ambNodes.push(filt, g)

    // wind noise
    const noise = this.noiseSource()
    const nf = c.createBiquadFilter()
    nf.type = 'bandpass'
    nf.frequency.value = kind === 'tower' ? 700 : 300
    nf.Q.value = 0.5
    const ng = c.createGain()
    ng.gain.value = kind === 'tower' ? 0.10 : 0.05
    noise.connect(nf)
    nf.connect(ng)
    ng.connect(this.ambGain)
    // slow LFO on wind
    const lfo = c.createOscillator()
    lfo.frequency.value = 0.13
    const lfoG = c.createGain()
    lfoG.gain.value = kind === 'tower' ? 0.05 : 0.025
    lfo.connect(lfoG)
    lfoG.connect(ng.gain)
    lfo.start()
    this.ambNodes.push(noise, nf, ng, lfo, lfoG)

    // sparse melodic bells (minor pentatonic-ish) for non-boss zones
    const scales = {
      village: [220, 261.6, 293.7, 349.2, 392],
      forest: [164.8, 196, 220, 261.6, 293.7],
      tower: [146.8, 174.6, 196, 233.1],
      castle: [130.8, 155.6, 174.6, 207.7],
      boss: [110, 116.5, 130.8, 155.6],
      beacon: [261.6, 329.6, 392, 523.3, 587.3],
    }
    const scale = scales[kind] || scales.forest
    const period = kind === 'boss' ? 1400 : kind === 'beacon' ? 1800 : 3200
    this.musicTimer = setInterval(() => {
      if (!this.ctx || this.muted) return
      if (Math.random() < (kind === 'boss' ? 0.75 : 0.5)) {
        const f = scale[(Math.random() * scale.length) | 0]
        this.bell(f, kind === 'boss' ? 0.05 : 0.045, kind === 'beacon' ? 2.2 : 3)
      }
    }, period)
  }

  noiseSource() {
    const c = this.ctx
    const len = c.sampleRate * 2
    const buf = c.createBuffer(1, len, c.sampleRate)
    const d = buf.getChannelData(0)
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1
    const src = c.createBufferSource()
    src.buffer = buf
    src.loop = true
    src.start()
    return src
  }

  bell(freq, vol, dur) {
    const c = this.ctx
    const o = c.createOscillator()
    o.type = 'sine'
    o.frequency.value = freq
    const o2 = c.createOscillator()
    o2.type = 'sine'
    o2.frequency.value = freq * 2.76
    const g = c.createGain()
    const g2 = c.createGain()
    g.gain.setValueAtTime(vol, c.currentTime)
    g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + dur)
    g2.gain.setValueAtTime(vol * 0.3, c.currentTime)
    g2.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + dur * 0.4)
    o.connect(g)
    o2.connect(g2)
    g.connect(this.master)
    g2.connect(this.master)
    o.start()
    o2.start()
    o.stop(c.currentTime + dur)
    o2.stop(c.currentTime + dur)
  }

  // ---------- SFX ----------
  blip(freq, dur = 0.08, type = 'square', vol = 0.08, slide = 0) {
    if (!this.ensure()) return
    const c = this.ctx
    const o = c.createOscillator()
    o.type = type
    o.frequency.setValueAtTime(freq, c.currentTime)
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq + slide), c.currentTime + dur)
    const g = c.createGain()
    g.gain.setValueAtTime(vol, c.currentTime)
    g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + dur)
    o.connect(g)
    g.connect(this.master)
    o.start()
    o.stop(c.currentTime + dur + 0.02)
  }

  noiseHit(dur = 0.15, freq = 800, vol = 0.15) {
    if (!this.ensure()) return
    const c = this.ctx
    const src = this.noiseSource()
    const f = c.createBiquadFilter()
    f.type = 'bandpass'
    f.frequency.setValueAtTime(freq, c.currentTime)
    f.frequency.exponentialRampToValueAtTime(Math.max(60, freq * 0.3), c.currentTime + dur)
    f.Q.value = 1
    const g = c.createGain()
    g.gain.setValueAtTime(vol, c.currentTime)
    g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + dur)
    src.connect(f)
    f.connect(g)
    g.connect(this.master)
    src.stop(c.currentTime + dur + 0.02)
  }

  // event dispatcher from game events
  onEvent(ev) {
    switch (ev.t) {
      case 'swing': this.noiseHit(0.09, 1600, 0.07); break
      case 'cast': this.noiseHit(0.14, 900, 0.08); this.blip(320, 0.1, 'triangle', 0.05, 180); break
      case 'hit': this.noiseHit(0.08, 600, 0.1); this.blip(180, 0.06, 'square', 0.05, -60); break
      case 'phit': this.blip(140, 0.16, 'sawtooth', 0.11, -70); this.noiseHit(0.12, 400, 0.12); break
      case 'die': this.blip(220, 0.25, 'sawtooth', 0.08, -160); break
      case 'ember': this.blip(880 + Math.random() * 220, 0.05, 'sine', 0.04, 220); break
      case 'heal':
      case 'revived': this.blip(523, 0.09, 'sine', 0.06, 130); this.blip(659, 0.14, 'sine', 0.05, 160); break
      case 'dodge': this.noiseHit(0.07, 2000, 0.045); break
      case 'charge': this.noiseHit(0.2, 1000, 0.1); break
      case 'nova': this.noiseHit(0.35, 500, 0.16); this.blip(90, 0.3, 'sawtooth', 0.09, -40); break
      case 'slam':
      case 'kingsweep': this.noiseHit(0.3, 200, 0.18); break
      case 'ecast': this.blip(240, 0.14, 'sawtooth', 0.05, -120); break
      case 'bonfire': this.bellSafe(392, 0.07, 1.6); this.noiseHit(0.4, 600, 0.06); break
      case 'brazier': this.noiseHit(0.4, 700, 0.12); this.bellSafe(330, 0.06, 1); break
      case 'chest': this.blip(392, 0.08, 'triangle', 0.06, 60); this.blip(523, 0.14, 'triangle', 0.06, 80); break
      case 'gate': this.noiseHit(0.5, 150, 0.16); break
      case 'pdown': this.blip(196, 0.4, 'sawtooth', 0.1, -110); break
      case 'pickupKey': this.blip(659, 0.1, 'triangle', 0.07, 100); this.blip(880, 0.2, 'triangle', 0.06, 120); break
      case 'text': break
      case 'talk': this.blip(440, 0.04, 'square', 0.035); break
      case 'buy': this.blip(587, 0.07, 'triangle', 0.06, 100); this.blip(784, 0.12, 'triangle', 0.05, 100); break
      case 'thunder': this.thunder(); break
      case 'bossintro': this.blip(65, 0.8, 'sawtooth', 0.12, -20); this.noiseHit(0.8, 200, 0.1); break
      case 'bossphase': this.blip(87, 0.5, 'sawtooth', 0.11, -25); break
      case 'bossdead': this.bellSafe(196, 0.1, 3); this.bellSafe(261, 0.08, 3.5); break
      case 'beamwarn': this.blip(1200, 0.5, 'sine', 0.03, -600); break
      case 'beamfire': this.noiseHit(0.5, 1200, 0.16); break
      case 'summon': this.blip(300, 0.3, 'triangle', 0.06, -180); break
      case 'victory': this.victoryPeal(); break
      case 'ui': this.blip(520, 0.05, 'square', 0.04, 40); break
      case 'uiback': this.blip(320, 0.06, 'square', 0.04, -40); break
    }
  }

  bellSafe(f, v, d) {
    if (this.ensure()) this.bell(f, v, d)
  }

  thunder() {
    if (!this.ensure()) return
    const c = this.ctx
    const src = this.noiseSource()
    const f = c.createBiquadFilter()
    f.type = 'lowpass'
    f.frequency.setValueAtTime(400, c.currentTime)
    f.frequency.exponentialRampToValueAtTime(60, c.currentTime + 1.6)
    const g = c.createGain()
    g.gain.setValueAtTime(0.001, c.currentTime)
    g.gain.exponentialRampToValueAtTime(0.22, c.currentTime + 0.08)
    g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + 1.8)
    src.connect(f)
    f.connect(g)
    g.connect(this.master)
    src.stop(c.currentTime + 2)
  }

  victoryPeal() {
    if (!this.ensure()) return
    const notes = [261.6, 329.6, 392, 523.3, 659.3, 784]
    notes.forEach((f, i) => {
      setTimeout(() => this.bellSafe(f, 0.08, 2.5), i * 240)
    })
  }
}
