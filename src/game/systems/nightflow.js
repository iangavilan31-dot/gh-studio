// Night flow (MASTER_PROMPT 6.2/6.5/6.6): the 40-minute clock's beats, the
// Night's End dolly reel + title card + stats + reset, and attract mode.

import * as THREE from 'three'
import { bellToll } from '../audio/sfx.js'
import { NIGHT_MINUTES } from '../world/night.js'

const lerpV = (a, b, t, out) => out.set(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t)

export class NightFlow {
  constructor(night, world, hud, camera, hooks) {
    this.night = night
    this.world = world
    this.hud = hud
    this.camera = camera
    this.hooks = hooks // { setCinematic(bool), getStats(), onNightEnd() }
    this.warmed = false
    this.tolled = false
    this.ending = false
    this.attract = false
    this.idleT = 0
    this.reel = null
    this.log = []

    // DOM: closing card + attract logo
    const ui = document.getElementById('ui')
    this.card = document.createElement('div')
    this.card.className = 'nightcard'
    ui.appendChild(this.card)
    this.logo = document.createElement('div')
    this.logo.className = 'attractlogo'
    this.logo.textContent = 'MOONREST'
    ui.appendChild(this.logo)
  }

  noteInput() {
    this.idleT = 0
    if (this.attract) this.stopAttract()
  }

  buildReel() {
    // one 6s pan per kindled zone, in reference framing (6.5)
    const order = ['park', 'village', 'rooftops', 'ruins', 'gloomspire', 'hall', 'mosswood', 'isle']
    const shots = []
    for (const z of order) {
      const kindled = this.world.lights.some((l) => l.zone === z && l.kindled)
      const pose = this.world.poses[z]
      if (kindled && pose) shots.push(pose)
    }
    if (shots.length === 0) shots.push(this.world.poses.park)
    return shots
  }

  startNightsEnd(reason) {
    if (this.ending) return
    this.ending = true
    this.log.push({ event: 'nights-end', reason, minutes: +this.night.minutes.toFixed(2) })
    this.hooks.setCinematic(true)
    this.reel = { shots: this.buildReel(), i: 0, t: 0, phase: 'reel' }
  }

  startAttract() {
    if (this.attract || this.ending) return
    this.attract = true
    this.log.push({ event: 'attract-start' })
    this.hooks.setCinematic(true)
    this.logo.classList.add('on')
    this.reel = { shots: this.buildReel(), i: 0, t: 0, phase: 'attract' }
  }

  stopAttract() {
    this.attract = false
    this.logo.classList.remove('on')
    this.reel = null
    this.hooks.setCinematic(false)
    this.log.push({ event: 'attract-end' })
  }

  updateReelCamera(dt) {
    const r = this.reel
    if (!r) return
    r.t += dt
    const shot = r.shots[r.i % r.shots.length]
    const t = Math.min(1, r.t / 6)
    // slow push-in along the pose axis
    _from.set(...shot.pos)
    _look.set(...shot.look)
    _dir.copy(_from).sub(_look).normalize()
    _pos.copy(_from).addScaledVector(_dir, (1 - t) * 2.2)
    this.camera.position.copy(_pos)
    this.camera.lookAt(_look)
    if (r.t >= 6) { r.t = 0; r.i++ }
    return r.i >= r.shots.length && r.phase === 'reel'
  }

  update(dt, inputActive) {
    const m = this.night.minutes

    // — beats —
    if (m >= 30 && !this.warmed) {
      this.warmed = true
      this.night.warmBias = 1 // moon grazes the treeline: light warms slightly (6.2)
      this.log.push({ event: 'treeline-warm', minutes: +m.toFixed(2) })
    }
    if (m >= 38 && !this.tolled) {
      this.tolled = true
      bellToll(true)
      this.log.push({ event: 'deep-bell', minutes: +m.toFixed(2) })
    }
    if (m >= NIGHT_MINUTES && !this.ending) this.startNightsEnd('moonset')

    // — attract (in-game idle 3min — 6.6) —
    if (!this.ending && !this.attract) {
      this.idleT = inputActive ? 0 : this.idleT + dt
      if (this.idleT > 180) this.startAttract()
    }

    // — reel driving —
    if (this.ending && this.reel?.phase === 'reel') {
      const done = this.updateReelCamera(dt)
      if (done) {
        this.reel.phase = 'card'
        this.reel.t = 0
        const s = this.hooks.getStats()
        this.card.innerHTML = `
          <div class="nc-title">the moon sets. the lights hold. rest now.</div>
          <div class="nc-stats">
            lights kindled&nbsp; ${s.lights} / ${s.lightsTotal}<br/>
            moon brews&nbsp; ${s.brews} / 12<br/>
            keepsakes&nbsp; ${s.trinkets} / 8<br/>
            friends this night&nbsp; ${s.friends}
          </div>`
        this.card.classList.add('on')
        this.log.push({ event: 'title-card', stats: s })
      }
    } else if (this.ending && this.reel?.phase === 'card') {
      this.reel.t += dt
      if (this.reel.t > 7) {
        this.reel.phase = 'done'
        this.log.push({ event: 'night-reset' })
        this.hooks.onNightEnd() // persists, then returns to dusk on the bench
      }
    } else if (this.attract && this.reel) {
      this.updateReelCamera(dt)
      this.reel.i = this.reel.i % this.reel.shots.length // attract loops forever
    }
  }
}

const _from = new THREE.Vector3()
const _look = new THREE.Vector3()
const _dir = new THREE.Vector3()
const _pos = new THREE.Vector3()
