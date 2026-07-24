// Interact system (MASTER_PROMPT 6.1): prompt within 2m of a cold light (with
// line-of-sight — never through walls), hold-E channel for 1.2s with the staff
// raised, then the kindle lands: bloom, embers, chime, next music layer.

import { kindleChannelStart } from '../audio/sfx.js'

const CHANNEL_TIME = 1.2
const RANGE = 2.0

export class InteractSystem {
  constructor(world, player, hud) {
    this.world = world
    this.player = player
    this.hud = hud
    this.target = null
    this.channel = 0
    this.channeling = false
    this.channelSound = null
    this.log = [] // for verification: {id, event, t}
    // co-op indirection (Part 5.2): kindles route through the authority;
    // channel start/stop is announced so the host can validate the brazier law
    this.requestKindle = (id) => this.world.kindle(id)
    this.onChannelState = null
  }

  get channelTarget() { return this.channeling ? this.target?.id ?? null : null }

  losBlocked(x1, z1, x2, z2, y) {
    // sample the segment against colliders (skip endpoints' own space)
    const steps = 8
    for (let i = 1; i < steps; i++) {
      const t = i / steps
      const px = x1 + (x2 - x1) * t
      const pz = z1 + (z2 - z1) * t
      for (const c of this.world.colliders) {
        if (Math.hypot(px - c.x, pz - c.z) < c.r - 0.05 && y < this.world.heightAt(c.x, c.z) + c.h) return true
      }
    }
    return false
  }

  update(input, dt) {
    const p = this.player.pos
    // nearest cold light in range with LOS
    let best = null, bestD = RANGE
    for (const l of this.world.lights) {
      if (l.kindled) continue
      const d = Math.hypot(l.x - p.x, l.z - p.z)
      if (d < bestD && !this.losBlocked(p.x, p.z, l.x, l.z, p.y + 1)) { bestD = d; best = l }
    }
    // nearest brew (instant pickup takes precedence when closer)
    let bestBrew = null, bestBrewD = RANGE
    for (const b of this.world.brews ?? []) {
      if (b.taken) continue
      const d = Math.hypot(b.x - p.x, b.z - p.z)
      if (d < bestBrewD) { bestBrewD = d; bestBrew = b }
    }
    if (bestBrew && bestBrewD < bestD) {
      this.hud.showPrompt('take')
      if (input.pressed('KeyE') && !this.channeling) {
        this.world.takeBrew(bestBrew.id)
        this.log.push({ id: bestBrew.id, event: 'brew-taken' })
      }
      return
    }

    if (best) this.hud.showPrompt('kindle')
    else this.hud.hidePrompt()

    const holdE = input.down('KeyE')

    if (this.channeling) {
      const stillValid = best && this.target && best.id === this.target.id && holdE
      if (!stillValid) {
        // interrupted
        this.log.push({ id: this.target?.id, event: 'channel-interrupt', t: this.channel })
        this.onChannelState?.(this.target?.id, false)
        this.channeling = false
        this.channel = 0
        this.channelSound?.stop(false)
        this.channelSound = null
        if (this.player.anim.action === 'channel') this.player.setAction(null)
        this.hud.setProgress(0)
        return
      }
      this.channel += dt / CHANNEL_TIME
      this.hud.setProgress(Math.min(1, this.channel))
      if (this.channel >= 1) {
        this.channeling = false
        this.channel = 0
        this.channelSound?.stop(true)
        this.channelSound = null
        this.player.setAction(null)
        this.onChannelState?.(this.target.id, false)
        this.requestKindle(this.target.id)
        this.log.push({ id: this.target.id, event: 'kindled' })
        this.hud.setProgress(0)
      }
    } else if (best && holdE && !this.player.anim.action) {
      this.channeling = true
      this.target = best
      this.channel = 0
      this.player.setAction('channel')
      this.channelSound = kindleChannelStart()
      this.log.push({ id: best.id, event: 'channel-start' })
      this.onChannelState?.(best.id, true)
    }
  }
}
