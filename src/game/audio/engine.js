// AudioEngine (MASTER_PROMPT 9.1): master → [music, ambience, sfx] → soft-clip
// limiter. Procedural ConvolverNode reverb (2.5s exp decay; 4s Hall variant).
// Tape hiss at -42dB (Rule 12 lo-fi warmth). All synthesized — zero audio files.

import { worldRNG } from '../core/rng.js'

export class AudioEngine {
  constructor() {
    this.ctx = null
    this.started = false
    this.state = { layers: 0, zoneKey: 'D', muted: false } // inspectable via __MOONREST__
  }

  // Called on first user gesture (autoplay policy).
  start() {
    if (this.started) return
    this.started = true
    const ctx = (this.ctx = new (window.AudioContext || window.webkitAudioContext)())
    if (ctx.state === 'suspended') ctx.resume()

    this.master = ctx.createGain()
    this.master.gain.value = 0.9

    // soft-clip limiter
    this.limiter = ctx.createWaveShaper()
    const curve = new Float32Array(1024)
    for (let i = 0; i < 1024; i++) {
      const x = (i / 511.5) - 1
      curve[i] = Math.tanh(x * 1.4) / Math.tanh(1.4)
    }
    this.limiter.curve = curve
    this.limiter.oversample = '2x'

    this.buses = {
      music: ctx.createGain(),
      ambience: ctx.createGain(),
      sfx: ctx.createGain(),
    }
    this.buses.music.gain.value = 0.8
    this.buses.ambience.gain.value = 0.7
    this.buses.sfx.gain.value = 0.9

    for (const b of Object.values(this.buses)) b.connect(this.master)
    this.master.connect(this.limiter)
    this.limiter.connect(ctx.destination)

    // analysers for evidence/verification (RMS per bus)
    this.analysers = {}
    for (const [name, bus] of Object.entries(this.buses)) {
      const an = ctx.createAnalyser()
      an.fftSize = 2048
      bus.connect(an)
      this.analysers[name] = an
    }

    // procedural reverb impulses
    this.reverb = ctx.createConvolver()
    this.reverb.buffer = this.makeImpulse(2.5)
    this.reverbHall = ctx.createConvolver()
    this.reverbHall.buffer = this.makeImpulse(4.0)
    this.reverbSend = ctx.createGain()
    this.reverbSend.gain.value = 0.25
    this.reverbSend.connect(this.reverb)
    this.reverb.connect(this.master)
    this.hallSend = ctx.createGain()
    this.hallSend.gain.value = 0
    this.hallSend.connect(this.reverbHall)
    this.reverbHall.connect(this.master)

    // tape hiss: looped filtered noise, -42dB under everything
    const hissBuf = this.noiseBuffer(2)
    const hiss = ctx.createBufferSource()
    hiss.buffer = hissBuf
    hiss.loop = true
    const hissFilter = ctx.createBiquadFilter()
    hissFilter.type = 'highshelf'
    hissFilter.frequency.value = 3000
    hissFilter.gain.value = 6
    this.hissGain = ctx.createGain()
    this.hissGain.gain.value = dB(-42)
    hiss.connect(hissFilter)
    hissFilter.connect(this.hissGain)
    this.hissGain.connect(this.master)
    hiss.start()

    // tab-blur graceful mute (1s fade)
    document.addEventListener('visibilitychange', () => {
      const t = ctx.currentTime
      this.master.gain.cancelScheduledValues(t)
      if (document.hidden) {
        this.master.gain.setTargetAtTime(0, t, 0.33)
        this.state.muted = true
      } else {
        this.master.gain.setTargetAtTime(0.9, t, 0.33)
        this.state.muted = false
      }
    })
  }

  makeImpulse(seconds) {
    const rate = this.ctx.sampleRate
    const len = Math.floor(rate * seconds)
    const buf = this.ctx.createBuffer(2, len, rate)
    const rng = worldRNG.fork('impulse' + seconds)
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch)
      for (let i = 0; i < len; i++) {
        d[i] = (rng.next() * 2 - 1) * Math.exp(-3.5 * (i / len)) * 0.5
      }
    }
    return buf
  }

  noiseBuffer(seconds) {
    const rate = this.ctx.sampleRate
    const len = Math.floor(rate * seconds)
    const buf = this.ctx.createBuffer(1, len, rate)
    const d = buf.getChannelData(0)
    const rng = worldRNG.fork('noise')
    for (let i = 0; i < len; i++) d[i] = rng.next() * 2 - 1
    return buf
  }

  rms(busName) {
    const an = this.analysers?.[busName]
    if (!an) return 0
    const arr = new Float32Array(an.fftSize)
    an.getFloatTimeDomainData(arr)
    let s = 0
    for (let i = 0; i < arr.length; i++) s += arr[i] * arr[i]
    return Math.sqrt(s / arr.length)
  }
}

export function dB(v) { return Math.pow(10, v / 20) }

export const audio = new AudioEngine()
