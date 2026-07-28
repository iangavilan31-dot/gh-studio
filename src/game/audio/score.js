// Generative dungeon-synth score (MASTER_PROMPT 9.2). Each zone: key/mode,
// 50–60 BPM pulse, layered instruments added per kindle. Layers are 4-bar
// ostinati random-walked over chord tones (i–VI–III–VII cycle), regenerated
// with variation every 8 bars — ever changing yet ever the same.

import { audio, dB } from './engine.js'
import { worldRNG } from '../core/rng.js'

const MODES = {
  dorian: [0, 2, 3, 5, 7, 9, 10],
  aeolian: [0, 2, 3, 5, 7, 8, 10],
  lydian: [0, 2, 4, 6, 7, 9, 11],
  phrygian: [0, 1, 3, 5, 7, 8, 10],
  harmonicHint: [0, 2, 3, 5, 7, 8, 11],
}
const KEYS = { C: 48, 'C#': 49, D: 50, 'D#': 51, E: 52, F: 53, 'F#': 54, G: 55, 'G#': 56, A: 57, 'A#': 58, B: 59 }
// chord roots as scale degrees: i, VI, III, VII
const CHORD_CYCLE = [0, 5, 2, 6]

export const ZONE_MUSIC = {
  park: { key: 'D', mode: 'dorian', bpm: 54, layers: ['padRain', 'harp', 'flute', 'choirLow'] },
  village: { key: 'G', mode: 'aeolian', bpm: 52, layers: ['musicbox', 'pad', 'bass', 'bells'] },
  rooftops: { key: 'A', mode: 'lydian', bpm: 56, layers: ['padShimmer', 'celesta', 'choir'] },
  ruins: { key: 'E', mode: 'phrygian', bpm: 50, layers: ['choirPad', 'bellArcane', 'subDrone', 'choir'] },
  gloomspire: { key: 'C', mode: 'harmonicHint', bpm: 52, layers: ['organ', 'pizz', 'bellDeep'] },
  hall: { key: 'F#', mode: 'aeolian', bpm: 50, layers: ['musicbox', 'padStrings', 'lullaby'] },
  mosswood: { key: 'C#', mode: 'dorian', bpm: 52, layers: ['droneForest', 'kalimba', 'owlMotif'] },
  isle: { key: 'B', mode: 'aeolian', bpm: 54, layers: ['padSea', 'harp', 'horn'] },
}

const midiHz = (m) => 440 * Math.pow(2, (m - 69) / 12)

export class Score {
  constructor() {
    this.zone = 'park'
    this.activeLayers = 0 // 1 base + kindles (audible layer count)
    this.playing = false
    this.layerGains = []
    this.timer = null
    this.barCount = 0
    this.patterns = []
    this.rng = worldRNG.fork('score')
    this.nextNoteTime = 0
    this.step = 0
  }

  start() {
    if (this.playing || !audio.started) return
    this.playing = true
    this.buildZone()
    this.nextNoteTime = audio.ctx.currentTime + 0.1
    this.timer = setInterval(() => this.schedule(), 90)
  }

  buildZone() {
    const cfg = ZONE_MUSIC[this.zone]
    // Part 9.2: zones crossfade ~6s on travel — the old zone rings down while
    // the new one blooms in; never chop a sounding note (12.5 anti-pattern)
    const old = this.layerGains
    if (old.length && audio.started) {
      const t = audio.ctx.currentTime
      for (const g of old) { g.gain.cancelScheduledValues(t); g.gain.setTargetAtTime(0, t, 1.6) }
      setTimeout(() => { for (const g of old) g.disconnect() }, 7000)
    }
    this.layerGains = cfg.layers.map((_, i) => {
      const g = audio.ctx.createGain()
      const target = i < this.activeLayers + 1 ? 1 : 0
      if (audio.started && old.length) {
        g.gain.value = 0
        g.gain.setTargetAtTime(target, audio.ctx.currentTime, 2)
      } else g.gain.value = target
      g.connect(audio.buses.music)
      g.connect(audio.reverbSend)
      return g
    })
    this.regenPatterns()
  }

  // Night's End (9.2): every layer swells for the reel...
  finale() {
    if (!this.playing) return
    const t = audio.ctx.currentTime
    this.layerGains.forEach((g) => { g.gain.cancelScheduledValues(t); g.gain.setTargetAtTime(1, t, 2.5) })
    audio.state.layers = this.layerGains.length
  }

  // ...and the title card lands on a picardy third — the night resolves warm
  picardy() {
    if (!audio.started) return
    const cfg = ZONE_MUSIC[this.zone]
    const root = KEYS[cfg.key] + 12
    const t = audio.ctx.currentTime + 0.2
    for (const [semi, amp] of [[0, 0.16], [4, 0.13], [7, 0.11], [12, 0.08]]) { // major 3rd
      for (const [ratio, pa] of [[1, 1], [2, 0.28]]) {
        const o = audio.ctx.createOscillator()
        o.type = 'sine'
        o.frequency.value = midiHz(root + semi) * ratio
        const g = audio.ctx.createGain()
        g.gain.setValueAtTime(0, t)
        g.gain.linearRampToValueAtTime(amp * pa, t + 0.4)
        g.gain.setTargetAtTime(0, t + 2.2, 2.4)
        o.connect(g); g.connect(audio.buses.music); g.connect(audio.reverbSend)
        o.start(t); o.stop(t + 12)
      }
    }
  }

  setLayers(n) {
    this.activeLayers = n
    if (!this.playing) return
    const t = audio.ctx.currentTime
    this.layerGains.forEach((g, i) => {
      const target = i < n + 1 ? 1 : 0 // base layer always on
      g.gain.cancelScheduledValues(t)
      g.gain.setTargetAtTime(target, t, 1.4) // ≈4s fade
    })
    audio.state.layers = Math.min(n + 1, this.layerGains.length)
  }

  regenPatterns() {
    const cfg = ZONE_MUSIC[this.zone]
    const scale = MODES[cfg.mode]
    const root = KEYS[cfg.key]
    // 4 bars × 8 eighth-steps; each layer gets its own random-walk over chord tones
    this.patterns = cfg.layers.map((inst, li) => {
      const steps = []
      let deg = this.rng.int(0, 6)
      for (let bar = 0; bar < 4; bar++) {
        const chordRoot = CHORD_CYCLE[bar % 4]
        for (let s = 0; s < 8; s++) {
          const density = inst.startsWith('pad') || inst.startsWith('drone') || inst.startsWith('choir') || inst === 'organ' ? (s === 0 ? 1 : 0) : inst === 'bass' || inst === 'subDrone' ? (s % 4 === 0 ? 1 : 0) : this.rng.chance(0.42)
          if (!density) { steps.push(null); continue }
          // random walk biased to chord tones (root/3rd/5th of current chord)
          deg += this.rng.pick([-2, -1, -1, 0, 1, 1, 2])
          deg = ((deg % 7) + 7) % 7
          const chordTones = [chordRoot, (chordRoot + 2) % 7, (chordRoot + 4) % 7]
          if (!chordTones.includes(deg) && this.rng.chance(0.55)) deg = this.rng.pick(chordTones)
          const octave = li === 0 ? 0 : inst === 'bass' || inst === 'subDrone' || inst === 'bellDeep' ? -1 : this.rng.chance(0.3) ? 1 : 0
          steps.push(root + scale[deg] + 12 * octave)
        }
      }
      return steps
    })
    // F.1: the Lamplighter's motif — one melodic cell every zone quotes in its
    // own key and mode at each regeneration. The same small duty, wherever the
    // night finds you. Ends off the root: it never resolves (Soule's rule).
    const MOTIF = [[0, 0], [2, 2], [3, 4], [4, 3], [6, 6]] // [eighth-step, scale degree]
    const isLead = (inst) => !/^(pad|drone|choir|organ|bass|sub)/.test(inst) && inst !== 'bellDeep'
    let leadIdx = cfg.layers.findIndex(isLead)
    if (leadIdx < 0) leadIdx = 0
    const lead = this.patterns[leadIdx]
    for (let s = 0; s < 8; s++) lead[s] = null
    for (const [s, deg] of MOTIF) lead[s] = root + scale[deg]
  }

  schedule() {
    const cfg = ZONE_MUSIC[this.zone]
    const stepDur = 60 / cfg.bpm / 2 // eighth notes
    // after tab-hidden timer throttling, SKIP the missed bars instead of
    // scheduling a backlog of simultaneous notes (they'd blare on refocus)
    if (audio.ctx.currentTime - this.nextNoteTime > 1) this.nextNoteTime = audio.ctx.currentTime + 0.1
    while (this.nextNoteTime < audio.ctx.currentTime + 0.35) {
      const stepIdx = this.step % 32
      if (stepIdx === 0) {
        this.barCount += 4
        if (this.barCount % 8 === 0) this.regenPatterns() // Soule variation
      }
      this.patterns.forEach((pat, li) => {
        const note = pat[stepIdx]
        if (note !== null && note !== undefined) {
          playInstrument(cfg.layers[li], note, this.nextNoteTime, this.layerGains[li], stepDur)
        }
      })
      this.nextNoteTime += stepDur
      this.step++
    }
  }
}

// ——— Instrument recipes (Part 9.2) ———

function env(g, t, a, d, s = 0, r = 0.1, peak = 1) {
  g.gain.setValueAtTime(0, t)
  g.gain.linearRampToValueAtTime(peak, t + a)
  g.gain.setTargetAtTime(s * peak, t + a, d)
}

export function playInstrument(inst, midi, t, out, stepDur) {
  const ctx = audio.ctx
  const f = midiHz(midi)
  const g = ctx.createGain()
  g.connect(out)

  if (inst.startsWith('pad') || inst === 'choirPad' || inst === 'droneForest' || inst === 'padStrings' || inst === 'padSea') {
    // 2 detuned saws → lowpass 800 → slow attack, holds a whole bar
    const dur = stepDur * 8
    for (const det of [-6, 6]) {
      const o = ctx.createOscillator()
      o.type = 'sawtooth'
      o.frequency.value = f
      o.detune.value = det
      const lp = ctx.createBiquadFilter()
      lp.type = 'lowpass'
      lp.frequency.value = 800
      const og = ctx.createGain()
      env(og, t, dur * 0.4, dur * 0.5, 0.4, 0.5, 0.11)
      o.connect(lp); lp.connect(og); og.connect(g)
      o.start(t); o.stop(t + dur * 1.6)
    }
  } else if (inst === 'harp' || inst === 'celesta' || inst === 'kalimba' || inst === 'musicbox') {
    const o = ctx.createOscillator()
    o.type = 'triangle'
    o.frequency.value = f * (inst === 'musicbox' || inst === 'celesta' ? 2 : 1)
    o.detune.value = (worldRNG.next() - 0.5) * 7
    const og = ctx.createGain()
    env(og, t, 0.004, inst === 'kalimba' ? 0.09 : 0.22, 0, 0.1, 0.22)
    o.connect(og); og.connect(g)
    o.start(t); o.stop(t + 1.4)
  } else if (inst === 'flute' || inst === 'owlMotif') {
    const o = ctx.createOscillator()
    o.type = 'sine'
    o.frequency.value = f * 2
    const vib = ctx.createOscillator()
    vib.frequency.value = 4.5
    const vibG = ctx.createGain()
    vibG.gain.value = 5
    vib.connect(vibG); vibG.connect(o.frequency)
    const og = ctx.createGain()
    env(og, t, 0.12, 0.4, 0.35, 0.3, 0.09)
    o.connect(og); og.connect(g)
    o.start(t); vib.start(t)
    o.stop(t + stepDur * 3); vib.stop(t + stepDur * 3)
  } else if (inst.startsWith('choir')) {
    // 3 saws → formant-ish bandpass stack
    const dur = stepDur * 8
    for (const [det, fc] of [[-8, 520], [0, 900], [8, 1400]]) {
      const o = ctx.createOscillator()
      o.type = 'sawtooth'
      o.frequency.value = inst === 'choirLow' ? f / 2 : f
      o.detune.value = det
      const bp = ctx.createBiquadFilter()
      bp.type = 'bandpass'
      bp.frequency.value = fc
      bp.Q.value = 2.2
      const og = ctx.createGain()
      env(og, t, dur * 0.45, dur * 0.5, 0.4, 0.6, 0.07)
      o.connect(bp); bp.connect(og); og.connect(g)
      o.start(t); o.stop(t + dur * 1.6)
    }
  } else if (inst === 'bass' || inst === 'subDrone') {
    const o = ctx.createOscillator()
    o.type = 'sine'
    const o2 = ctx.createOscillator()
    o2.type = 'square'
    o.frequency.value = f / 2
    o2.frequency.value = f / 2
    const sqG = ctx.createGain()
    sqG.gain.value = 0.12
    const og = ctx.createGain()
    env(og, t, 0.03, stepDur * 3, 0.3, 0.4, 0.16)
    o.connect(og); o2.connect(sqG); sqG.connect(og); og.connect(g)
    o.start(t); o2.start(t)
    o.stop(t + stepDur * 4); o2.stop(t + stepDur * 4)
  } else if (inst.startsWith('bell')) {
    // 2 inharmonic sine partials, long decay
    for (const [ratio, amp] of [[1, 0.2], [2.76, 0.08]]) {
      const o = ctx.createOscillator()
      o.type = 'sine'
      o.frequency.value = f * ratio * (inst === 'bellDeep' ? 0.5 : 1)
      const og = ctx.createGain()
      env(og, t, 0.005, inst === 'bellDeep' ? 2.2 : 1.1, 0, 0.5, amp)
      o.connect(og); og.connect(g)
      o.start(t); o.stop(t + 4)
    }
  } else if (inst === 'organ') {
    const dur = stepDur * 8
    for (const [mult, amp] of [[1, 0.09], [2, 0.055], [3, 0.03], [4, 0.018]]) {
      const o = ctx.createOscillator()
      o.type = 'sine'
      o.frequency.value = f * mult
      const og = ctx.createGain()
      env(og, t, 0.06, dur, 0.8, 0.3, amp)
      o.connect(og); og.connect(g)
      o.start(t); o.stop(t + dur * 1.2)
    }
  } else if (inst === 'pizz') {
    const o = ctx.createOscillator()
    o.type = 'triangle'
    o.frequency.value = f
    const lp = ctx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = 1200
    const og = ctx.createGain()
    env(og, t, 0.003, 0.12, 0, 0.1, 0.2)
    o.connect(lp); lp.connect(og); og.connect(g)
    o.start(t); o.stop(t + 0.6)
  } else if (inst === 'horn' || inst === 'lullaby') {
    const o = ctx.createOscillator()
    o.type = inst === 'horn' ? 'sawtooth' : 'triangle'
    o.frequency.value = f
    const lp = ctx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = inst === 'horn' ? 900 : 2200
    const og = ctx.createGain()
    env(og, t, 0.09, stepDur * 2.5, 0.3, 0.4, 0.12)
    o.connect(lp); lp.connect(og); og.connect(g)
    o.start(t); o.stop(t + stepDur * 4)
  } else {
    // fallback: soft sine blip
    const o = ctx.createOscillator()
    o.frequency.value = f
    const og = ctx.createGain()
    env(og, t, 0.01, 0.3, 0, 0.2, 0.12)
    o.connect(og); og.connect(g)
    o.start(t); o.stop(t + 1)
  }
}

export const score = new Score()
