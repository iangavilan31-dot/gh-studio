// Ambience beds (MASTER_PROMPT 9.3): rain / wind / cricket / owl / sea layers
// per zone, all synthesized, routed through the ambience bus, crossfaded ~6s on
// zone travel. One shared noise loop feeds filtered "colors"; the critters are
// tiny scheduled synths. Nothing here is a file.

import { audio } from './engine.js'

// which beds a zone breathes, and how loudly
const ZONE_BEDS = {
  park: { rain: 0.5, wind: 0.12, cricket: 0.2 },
  village: { wind: 0.14, cricket: 0.12, owl: 0.5 },
  rooftops: { wind: 0.3, owl: 0.5 },
  ruins: { wind: 0.2, cricket: 0.16 },
  gloomspire: { wind: 0.34, owl: 0.35 },
  hall: { wind: 0.06 },
  mosswood: { wind: 0.16, cricket: 0.26, owl: 0.6 },
  isle: { sea: 0.5, wind: 0.18 },
  foglandPV: { wind: 0.26 }, foglandPR: { wind: 0.26 }, foglandPI: { wind: 0.26, sea: 0.2 },
  foglandRG: { wind: 0.3 }, foglandVM: { wind: 0.26, cricket: 0.1 }, foglandGM: { wind: 0.3 },
}

class Beds {
  constructor() {
    this.started = false
    this.zone = null
    this.rainSoft = 1
  }

  start() {
    if (this.started || !audio.started) return
    this.started = true
    const ctx = audio.ctx
    this.gains = {}
    const noise = ctx.createBufferSource()
    noise.buffer = audio.noiseBuffer(4)
    noise.loop = true

    // — rain: band-passed patter with a slow amplitude wander —
    const rainBP = ctx.createBiquadFilter()
    rainBP.type = 'bandpass'; rainBP.frequency.value = 2400; rainBP.Q.value = 0.7
    this._mk('rain', noise, rainBP)

    // — wind: deep low-passed noise, breathing via LFO on the filter —
    const windLP = ctx.createBiquadFilter()
    windLP.type = 'lowpass'; windLP.frequency.value = 420; windLP.Q.value = 0.9
    const windLFO = ctx.createOscillator()
    windLFO.frequency.value = 0.07
    const windLFOAmt = ctx.createGain()
    windLFOAmt.gain.value = 210
    windLFO.connect(windLFOAmt); windLFOAmt.connect(windLP.frequency)
    windLFO.start()
    this._mk('wind', noise, windLP)

    // — sea: slow swells of mid-passed noise (7s period) —
    const seaBP = ctx.createBiquadFilter()
    seaBP.type = 'bandpass'; seaBP.frequency.value = 700; seaBP.Q.value = 0.5
    const seaLFO = ctx.createOscillator()
    seaLFO.frequency.value = 1 / 7
    const seaDepth = ctx.createGain()
    seaDepth.gain.value = 0.5
    const seaCarrier = ctx.createGain()
    seaCarrier.gain.value = 0.5
    seaLFO.connect(seaDepth); seaDepth.connect(seaCarrier.gain)
    seaLFO.start()
    this._mk('sea', noise, seaBP, seaCarrier)

    noise.start()

    // — critters: scheduled tiny synths, gated by their zone gains —
    this.gains.cricket = ctx.createGain(); this.gains.cricket.gain.value = 0
    this.gains.cricket.connect(audio.buses.ambience)
    this.gains.owl = ctx.createGain(); this.gains.owl.gain.value = 0
    this.gains.owl.connect(audio.buses.ambience)
    this._critterTimer = setInterval(() => this._critters(), 900)
  }

  _mk(name, src, filter, extra) {
    const g = audio.ctx.createGain()
    g.gain.value = 0
    src.connect(filter)
    if (extra) { filter.connect(extra); extra.connect(g) } else filter.connect(g)
    g.connect(audio.buses.ambience)
    this.gains[name] = g
  }

  // chirps + the occasional distant owl — randomized, never a loop boundary
  _critters() {
    if (!this.started) return
    const ctx = audio.ctx
    const t = ctx.currentTime
    if (this.gains.cricket.gain.value > 0.01 && Math.random() < 0.75) {
      for (let i = 0; i < 3; i++) {
        const o = ctx.createOscillator()
        o.type = 'sine'; o.frequency.value = 4200 + Math.random() * 500
        const g = ctx.createGain()
        const t0 = t + i * 0.07 + Math.random() * 0.2
        g.gain.setValueAtTime(0, t0)
        g.gain.linearRampToValueAtTime(0.028, t0 + 0.012)
        g.gain.setTargetAtTime(0, t0 + 0.03, 0.02)
        o.connect(g); g.connect(this.gains.cricket)
        o.start(t0); o.stop(t0 + 0.25)
      }
    }
    if (this.gains.owl.gain.value > 0.01 && Math.random() < 0.06) {
      for (const [d, f] of [[0, 340], [0.45, 310]]) {
        const o = ctx.createOscillator()
        o.type = 'sine'; o.frequency.setValueAtTime(f, t + d)
        o.frequency.linearRampToValueAtTime(f - 30, t + d + 0.3)
        const g = ctx.createGain()
        g.gain.setValueAtTime(0, t + d)
        g.gain.linearRampToValueAtTime(0.05, t + d + 0.06)
        g.gain.setTargetAtTime(0, t + d + 0.22, 0.1)
        o.connect(g); g.connect(this.gains.owl); g.connect(audio.reverbSend)
        o.start(t + d); o.stop(t + d + 1)
      }
    }
  }

  // crossfade to the zone's bed mix over ~6s (Part 9.2 travel fade)
  setZone(zone, fadeSeconds = 6) {
    this.zone = zone
    if (!this.started) return
    const mix = ZONE_BEDS[zone] ?? { wind: 0.2 }
    const t = audio.ctx.currentTime
    for (const [name, g] of Object.entries(this.gains)) {
      let target = mix[name] ?? 0
      if (name === 'rain') target *= this.rainSoft
      g.gain.cancelScheduledValues(t)
      g.gain.setTargetAtTime(target, t, fadeSeconds / 3)
    }
  }

  // the shared bench rest softens the rain's SOUND too, not just the particles
  soften(v) {
    this.rainSoft = v
    if (this.zone) this.setZone(this.zone, 2)
  }
}

export const beds = new Beds()
