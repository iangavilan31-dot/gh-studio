// The Moon Clock (MASTER_PROMPT 6.2, Rule 6): the moon IS the UI. 40-minute
// night; painted face + cross-flare halo, descending zenith→western fog.
// Never fog-occluded (noFog material, follows camera like the sky).

import * as THREE from 'three'
import { retroMaterial, ensureVertexColors } from '../art/materials.js'
import { canvasOf, toTexture, hex, rgb, lighten, darken, mix, splotch } from '../art/textures.js'
import { worldRNG } from '../core/rng.js'

export const NIGHT_MINUTES = 40
const _dir = new THREE.Vector3()

function moonFaceTexture() {
  const rng = worldRNG.fork('tex/moon')
  const c = canvasOf(128, (ctx) => {
    ctx.clearRect(0, 0, 128, 128)
    const face = hex('#e8e4ff')
    const shadow = hex('#8f7fd4')
    // disc
    ctx.fillStyle = rgb(face)
    ctx.beginPath()
    ctx.arc(64, 64, 56, 0, Math.PI * 2)
    ctx.fill()
    // painted maria blotches — strong enough to survive the halo (AA.1), and
    // arranged with a faint worn, watchful cast (O.1) that reads at a glance
    for (let i = 0; i < 18; i++) {
      const a = rng.range(0, Math.PI * 2)
      const d = rng.range(0, 42)
      ctx.fillStyle = rgb(mix(face, shadow, rng.range(0.45, 0.85)))
      ctx.globalAlpha = rng.range(0.45, 0.75)
      ctx.beginPath()
      ctx.ellipse(64 + Math.cos(a) * d, 64 + Math.sin(a) * d, rng.range(5, 16), rng.range(4, 12), rng.range(0, 3), 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.globalAlpha = 1
    // the subtle sleeping face: two closed eyes + soft mouth (painted, gentle)
    ctx.strokeStyle = rgb(shadow)
    ctx.lineWidth = 3
    ctx.lineCap = 'round'
    ctx.beginPath(); ctx.arc(44, 56, 8, 0.25 * Math.PI, 0.75 * Math.PI); ctx.stroke() // closed eye L
    ctx.beginPath(); ctx.arc(82, 56, 8, 0.25 * Math.PI, 0.75 * Math.PI); ctx.stroke() // closed eye R
    ctx.globalAlpha = 0.7
    ctx.beginPath(); ctx.arc(63, 84, 7, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke() // resting mouth
    ctx.globalAlpha = 1
    // limb shading lower-left
    const g = ctx.createRadialGradient(80, 48, 20, 64, 64, 58)
    g.addColorStop(0, 'rgba(0,0,0,0)')
    g.addColorStop(1, 'rgba(80,64,140,0.35)')
    ctx.fillStyle = g
    ctx.beginPath(); ctx.arc(64, 64, 56, 0, Math.PI * 2); ctx.fill()
  })
  const t = toTexture(c)
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping
  return t
}

function crossFlareTexture() {
  const c = canvasOf(128, (ctx) => {
    ctx.clearRect(0, 0, 128, 128)
    // core kept faint so the painted face reads through the halo (AA.1)
    const g = ctx.createRadialGradient(64, 64, 2, 64, 64, 64)
    g.addColorStop(0, 'rgba(232,228,255,0.18)')
    g.addColorStop(0.4, 'rgba(180,170,230,0.1)')
    g.addColorStop(1, 'rgba(180,170,230,0)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, 128, 128)
    // soft cross streaks (the N64 lens cross) — kept well under the face:
    // at 0.5 the cross bisected the maria and the moon read as a sparkle,
    // not a character (judge pass 3, finding 4)
    const streak = (w, h) => {
      const lg = ctx.createLinearGradient(64 - w / 2, 0, 64 + w / 2, 0)
      lg.addColorStop(0, 'rgba(232,228,255,0)')
      lg.addColorStop(0.5, 'rgba(232,228,255,0.26)')
      lg.addColorStop(1, 'rgba(232,228,255,0)')
      ctx.fillStyle = lg
      ctx.fillRect(64 - w / 2, 64 - h / 2, w, h)
    }
    streak(120, 3)
    ctx.save()
    ctx.translate(64, 64); ctx.rotate(Math.PI / 2); ctx.translate(-64, -64)
    streak(110, 2.5)
    ctx.restore()
    // fine deterministic grain breaks the radial gradient's quantize rings
    // (J.2) — faded toward the rim so the grain disc has no visible edge
    const grng = worldRNG.fork('tex/flaregrain')
    for (let i = 0; i < 900; i++) {
      const a = grng.range(0, Math.PI * 2), r = Math.sqrt(grng.next()) * 62
      ctx.globalAlpha = 0.05 * Math.min(1, (1 - r / 62) * 2.2)
      ctx.fillStyle = grng.chance(0.5) ? '#ffffff' : '#000000'
      ctx.fillRect(64 + Math.cos(a) * r, 64 + Math.sin(a) * r, 1, 1)
    }
    ctx.globalAlpha = 1
  })
  const t = toTexture(c)
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping
  return t
}

// Real lunar phase (6.2, Lunacid's trick): full nights are brightest, new-moon
// nights are the spookiest and the fog closes ~15% tighter.
const SYNODIC_MS = 29.530588 * 86400000
const NEW_MOON_EPOCH = Date.UTC(2000, 0, 6, 18, 14)
export function lunarAge(dateMs = Date.now()) {
  return (((dateMs - NEW_MOON_EPOCH) % SYNODIC_MS) + SYNODIC_MS) % SYNODIC_MS / SYNODIC_MS
}

export class Night {
  constructor(scene) {
    this.minutes = 0 // 0..40
    this.group = new THREE.Group()
    // beyond every terrain silhouette (far plane 220): hills and headlands
    // must occlude the moon, never the reverse
    this.dist = 205
    this.warmBias = 0
    this.setPhase(lunarAge())

    const faceMat = retroMaterial({ map: moonFaceTexture(), emissive: 0x9d97c2, alphaTest: 0.3, noFog: true, depthWrite: false })
    this.face = new THREE.Mesh(new THREE.PlaneGeometry(42, 42), faceMat)
    ensureVertexColors(this.face.geometry)
    this.face.renderOrder = -90

    const flareMat = retroMaterial({ map: crossFlareTexture(), emissive: 0xffffff, transparent: true, noFog: true, depthWrite: false })
    flareMat.blending = THREE.AdditiveBlending
    this.flare = new THREE.Mesh(new THREE.PlaneGeometry(104, 104), flareMat)
    ensureVertexColors(this.flare.geometry)
    this.flare.renderOrder = -89

    this.group.add(this.face)
    this.group.add(this.flare)
    scene.add(this.group)
    this.setPhase(this.phaseAge ?? lunarAge()) // faces exist now — apply
  }

  skipTo(min) {
    this.minutes = Math.max(0, Math.min(NIGHT_MINUTES, min))
  }

  setPhase(age) {
    this.phaseAge = age
    this.illum = 0.5 * (1 - Math.cos(age * Math.PI * 2)) // 0 new → 1 full
    this.fogTight = 1 - 0.15 * (1 - this.illum)
    if (this.face) {
      // signatureTint: the D.1 night signature warms or cools the face a touch
      this.face.material.uniforms.uEmissive.value.set('#9d97c2').multiplyScalar((0.5 + 0.75 * this.illum) * (this.signatureTint ?? 1))
      this.flare.material.uniforms.uOpacity.value = 0.35 + 0.65 * this.illum
    }
  }

  update(dt, camera) {
    if (!this.paused) this.minutes = Math.min(NIGHT_MINUTES, this.minutes + dt / 60) // the night starts with play, not the title (6.2)
    // great arc (AA.1): rises high in the ESE, sweeps the whole sky, sets in
    // the western fog — every zone's framing crosses it at some minute, and
    // it stays low enough to live inside frames (MM's looming moon, not a
    // zenith dot)
    const t = this.minutes / NIGHT_MINUTES
    const elev = THREE.MathUtils.lerp(0.68, 0.04, t)        // radians above horizon
    const azim = THREE.MathUtils.lerp(1.95, -2.85, t)       // ESE → over the western fog
    _dir.set(
      Math.sin(azim) * Math.cos(elev),
      Math.sin(elev),
      Math.cos(azim) * Math.cos(elev)
    )
    this.group.position.copy(camera.position).addScaledVector(_dir, this.dist)
    this.face.lookAt(camera.position)
    this.flare.lookAt(camera.position)
    this.dirWorld = _dir // shared with the water moon-streak
  }
}
