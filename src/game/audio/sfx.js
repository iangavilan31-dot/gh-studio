// SFX kit (MASTER_PROMPT 9.3) — all synthesized. Footsteps ×5 surfaces,
// kindle channel shimmer + completion chime, UI ticks, snores, clucks, etc.
// (Creature sounds land with their creatures; the core kit lives here.)

import { audio, dB } from './engine.js'
import { worldRNG } from '../core/rng.js'
import { ZONE_MUSIC } from './score.js'

const KEYS = { C: 48, 'C#': 49, D: 50, 'D#': 51, E: 52, F: 53, 'F#': 54, G: 55, 'G#': 56, A: 57, 'A#': 58, B: 59 }
const midiHz = (m) => 440 * Math.pow(2, (m - 69) / 12)
const rng = worldRNG.fork('sfx')

function noiseBurst({ t, dur, filterType = 'bandpass', freq = 1000, q = 1, gain = 0.3, out }) {
  const ctx = audio.ctx
  const src = ctx.createBufferSource()
  src.buffer = audio.noiseBuffer(Math.max(0.05, dur + 0.05))
  const f = ctx.createBiquadFilter()
  f.type = filterType
  f.frequency.value = freq
  f.Q.value = q
  const g = ctx.createGain()
  g.gain.setValueAtTime(gain, t)
  g.gain.exponentialRampToValueAtTime(0.001, t + dur)
  src.connect(f); f.connect(g); g.connect(out || audio.buses.sfx)
  src.start(t); src.stop(t + dur + 0.05)
}

// Footsteps per surface (Part 4.2): grass/cobble/wood/shingle/sand.
const SURFACE_PARAMS = {
  grass: { freq: 700, q: 0.7, dur: 0.09, gain: 0.10, type: 'lowpass' },
  dirt: { freq: 900, q: 0.8, dur: 0.08, gain: 0.11, type: 'lowpass' },
  cobble: { freq: 2200, q: 1.4, dur: 0.07, gain: 0.13, type: 'bandpass' },
  wood: { freq: 480, q: 2.5, dur: 0.11, gain: 0.16, type: 'bandpass' },
  shingle: { freq: 1600, q: 3, dur: 0.09, gain: 0.12, type: 'bandpass' },
  sand: { freq: 3200, q: 0.6, dur: 0.13, gain: 0.09, type: 'highpass' },
}

export function footstep(surface, volume = 1) {
  if (!audio.started) return
  const p = SURFACE_PARAMS[surface] || SURFACE_PARAMS.grass
  const t = audio.ctx.currentTime
  noiseBurst({ t, dur: p.dur * rng.range(0.85, 1.15), filterType: p.type, freq: p.freq * rng.range(0.85, 1.2), q: p.q, gain: p.gain * volume })
  if (surface === 'wood' || surface === 'cobble') {
    // knock body under the noise
    const o = audio.ctx.createOscillator()
    o.type = 'sine'
    o.frequency.value = (surface === 'wood' ? 140 : 190) * rng.range(0.9, 1.1)
    const g = audio.ctx.createGain()
    g.gain.setValueAtTime(0.09 * volume, t)
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.08)
    o.connect(g); g.connect(audio.buses.sfx)
    o.start(t); o.stop(t + 0.1)
  }
}

// Kindle channel: rising shimmer while held.
export function kindleChannelStart() {
  if (!audio.started) return null
  const ctx = audio.ctx
  const t = ctx.currentTime
  const g = ctx.createGain()
  g.gain.setValueAtTime(0.0001, t)
  g.gain.linearRampToValueAtTime(0.14, t + 1.1)
  g.connect(audio.buses.sfx)
  const oscs = []
  for (const mult of [1, 1.5, 2.02]) {
    const o = ctx.createOscillator()
    o.type = 'sine'
    o.frequency.setValueAtTime(400 * mult, t)
    o.frequency.exponentialRampToValueAtTime(980 * mult, t + 1.25)
    const og = ctx.createGain()
    og.gain.value = 0.33
    o.connect(og); og.connect(g)
    o.start(t)
    oscs.push(o)
  }
  return {
    stop(completed) {
      const t2 = ctx.currentTime
      g.gain.cancelScheduledValues(t2)
      g.gain.setTargetAtTime(0, t2, completed ? 0.3 : 0.05)
      for (const o of oscs) o.stop(t2 + 0.8)
    },
  }
}

// Completion chime: zone key root + fifth (one-shot, bell-like).
export function kindleChime(zone = 'park') {
  if (!audio.started) return
  const ctx = audio.ctx
  const t = ctx.currentTime
  const root = KEYS[ZONE_MUSIC[zone]?.key ?? 'D'] + 24
  for (const [semi, amp, delay] of [[0, 0.22, 0], [7, 0.16, 0.12], [12, 0.1, 0.26]]) {
    for (const [ratio, pa] of [[1, 1], [2.76, 0.35]]) {
      const o = ctx.createOscillator()
      o.type = 'sine'
      o.frequency.value = midiHz(root + semi) * ratio
      const g = ctx.createGain()
      g.gain.setValueAtTime(0, t + delay)
      g.gain.linearRampToValueAtTime(amp * pa, t + delay + 0.008)
      g.gain.setTargetAtTime(0, t + delay + 0.008, 0.9)
      o.connect(g); g.connect(audio.buses.sfx); g.connect(audio.reverbSend)
      o.start(t + delay); o.stop(t + delay + 4)
    }
  }
}

export function uiTick() {
  if (!audio.started) return
  noiseBurst({ t: audio.ctx.currentTime, dur: 0.03, freq: 2600, q: 4, gain: 0.06 })
}

export function uiConfirm() {
  if (!audio.started) return
  const ctx = audio.ctx
  const t = ctx.currentTime
  for (const [semi, d] of [[0, 0], [7, 0.07]]) {
    const o = ctx.createOscillator()
    o.type = 'triangle'
    o.frequency.value = midiHz(74 + semi)
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.08, t + d)
    g.gain.exponentialRampToValueAtTime(0.001, t + d + 0.25)
    o.connect(g); g.connect(audio.buses.sfx)
    o.start(t + d); o.stop(t + d + 0.3)
  }
}

// bottle pickup "hmm!" — happy little formant blip
export function brewHum() {
  if (!audio.started) return
  const ctx = audio.ctx
  const t = ctx.currentTime
  const o = ctx.createOscillator()
  o.type = 'sawtooth'
  o.frequency.setValueAtTime(180, t)
  o.frequency.linearRampToValueAtTime(240, t + 0.18)
  o.frequency.linearRampToValueAtTime(210, t + 0.3)
  const bp = ctx.createBiquadFilter()
  bp.type = 'bandpass'
  bp.frequency.setValueAtTime(500, t)
  bp.frequency.linearRampToValueAtTime(900, t + 0.25)
  bp.Q.value = 3
  const g = ctx.createGain()
  g.gain.setValueAtTime(0, t)
  g.gain.linearRampToValueAtTime(0.14, t + 0.06)
  g.gain.setTargetAtTime(0, t + 0.24, 0.08)
  o.connect(bp); bp.connect(g); g.connect(audio.buses.sfx)
  o.start(t); o.stop(t + 0.6)
}
