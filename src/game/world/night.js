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
    // painted maria blotches
    for (let i = 0; i < 14; i++) {
      const a = rng.range(0, Math.PI * 2)
      const d = rng.range(0, 40)
      ctx.fillStyle = rgb(mix(face, shadow, rng.range(0.25, 0.6)))
      ctx.globalAlpha = rng.range(0.3, 0.6)
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
    const g = ctx.createRadialGradient(64, 64, 2, 64, 64, 64)
    g.addColorStop(0, 'rgba(232,228,255,0.55)')
    g.addColorStop(0.4, 'rgba(180,170,230,0.12)')
    g.addColorStop(1, 'rgba(180,170,230,0)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, 128, 128)
    // soft cross streaks (the N64 lens cross)
    const streak = (w, h) => {
      const lg = ctx.createLinearGradient(64 - w / 2, 0, 64 + w / 2, 0)
      lg.addColorStop(0, 'rgba(232,228,255,0)')
      lg.addColorStop(0.5, 'rgba(232,228,255,0.5)')
      lg.addColorStop(1, 'rgba(232,228,255,0)')
      ctx.fillStyle = lg
      ctx.fillRect(64 - w / 2, 64 - h / 2, w, h)
    }
    streak(120, 3)
    ctx.save()
    ctx.translate(64, 64); ctx.rotate(Math.PI / 2); ctx.translate(-64, -64)
    streak(110, 2.5)
    ctx.restore()
  })
  const t = toTexture(c)
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping
  return t
}

export class Night {
  constructor(scene) {
    this.minutes = 0 // 0..40
    this.group = new THREE.Group()
    this.dist = 165

    const faceMat = retroMaterial({ map: moonFaceTexture(), emissive: 0x8a86a8, alphaTest: 0.3, noFog: true, depthWrite: false })
    this.face = new THREE.Mesh(new THREE.PlaneGeometry(26, 26), faceMat)
    ensureVertexColors(this.face.geometry)
    this.face.renderOrder = -90

    const flareMat = retroMaterial({ map: crossFlareTexture(), emissive: 0xffffff, transparent: true, noFog: true, depthWrite: false })
    flareMat.blending = THREE.AdditiveBlending
    this.flare = new THREE.Mesh(new THREE.PlaneGeometry(64, 64), flareMat)
    ensureVertexColors(this.flare.geometry)
    this.flare.renderOrder = -89

    this.group.add(this.face)
    this.group.add(this.flare)
    scene.add(this.group)
  }

  skipTo(min) {
    this.minutes = Math.max(0, Math.min(NIGHT_MINUTES, min))
  }

  update(dt, camera) {
    this.minutes = Math.min(NIGHT_MINUTES, this.minutes + dt / 60)
    // great arc: zenith-ish (t=0) → western horizon fog (t=40)
    const t = this.minutes / NIGHT_MINUTES
    const elev = THREE.MathUtils.lerp(1.15, 0.03, t)        // radians above horizon
    const azim = THREE.MathUtils.lerp(-2.35, -1.75, t)      // drifting toward due west
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
