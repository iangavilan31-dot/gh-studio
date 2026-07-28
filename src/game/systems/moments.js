// Co-op moments (MASTER_PROMPT Part 3, one per zone): small shared rituals that
// fire when the lobby does something together. Authority (host, or the solo
// player) DETECTS; every client APPLIES the same event deterministically (5.2).
// Each moment degrades gracefully to a lobby of one — "all players" means all
// present players, and a lone keeper still counts as everyone she knows.

import { bellToll, musicBox, kindleChime } from '../audio/sfx.js'
import { MOSSWOOD_ARCH } from '../world/layout.js'

export class Moments {
  constructor(ctx) {
    // ctx: {world, npcs, player, hud, stars, progress, ambience, net,
    //       warmPulse(v), playerRigs() → [{id, rig, pos, action}]}
    this.c = ctx
    this.done = new Set() // once-per-night moments
    this.nods = []        // transient hat-nod tweens
    this.beamT = 0
    this.log = []
  }

  // the full lobby: local keeper + interpolated remotes
  lobby() {
    return this.c.playerRigs()
  }

  isAuthority() {
    const net = this.c.net
    return !net.active || net.role === 'host'
  }

  fire(id, extra = {}) {
    if (this.done.has(id)) return
    this.done.add(id)
    const ev = { ev: 'moment', id, ...extra }
    if (this.c.net.active && this.c.net.role === 'host') this.c.net.broadcastEvent(ev)
    else this.apply(ev)
  }

  // deterministic consequences — runs identically on every client
  apply(ev) {
    const { world, npcs, hud, stars, progress, ambience } = this.c
    if (ev.id !== 'chicken') this.done.add(ev.id) // chickens mount per-player
    this.log.push(ev)
    if (ev.id === 'bench') {
      this.c.warmPulse(0.55)
      ambience.rainSoften(45)
      for (const p of this.lobby()) this.nods.push({ rig: p.rig, t: 0 })
      hud.say('shared-rest-the', 4)
    } else if (ev.id === 'constellation') {
      stars.showConstellations(true)
      hud.say('the-sky-leans', 4)
    } else if (ev.id === 'wellbeam') {
      this.beamT = 0.0001
      kindleChime('ruins')
      hud.say('the-well-remembers', 4)
    } else if (ev.id === 'gargoyle') {
      npcs.gargoyle.waveT = 2.0
      hud.say('did-just', 3)
    } else if (ev.id === 'lullaby') {
      musicBox()
      hud.say('somewhere-close-music', 4)
    } else if (ev.id === 'arch') {
      bellToll(true)
      progress.grantTrinket('archstone', 'the Gatewalkers’ arch-stone')
    } else if (ev.id === 'chicken') {
      npcs.mountChicken(ev.chIdx, ev.player)
    }
  }

  update(dt, elapsed, detect = true) {
    const { world, npcs, camera } = this.c

    // — continuous visuals every client runs from synced positions —
    this.updateGlyphs(dt)
    if (this.beamT > 0) {
      this.beamT += dt
      const b = world.wellBeam
      const env = Math.min(1, this.beamT / 1.2) * Math.max(0, 1 - (this.beamT - 6) / 3)
      b.visible = env > 0.01
      b.material.uniforms.uOpacity.value = env * 0.4
      if (this.beamT > 9.5) this.beamT = 0
    }
    for (let i = this.nods.length - 1; i >= 0; i--) {
      const n = this.nods[i]
      n.t += dt
      if (!n.rig?.bones?.hat) { this.nods.splice(i, 1); continue }
      if (n.t >= 1.2) { this.nods.splice(i, 1); continue }
      n.rig.bones.hat.rotation.x += Math.sin((n.t / 1.2) * Math.PI * 2) * 0.28 * dt * 10
    }

    // — detection is authority-only, and pauses during cinematics/title —
    if (!detect || !this.isAuthority()) return
    const lobby = this.lobby()
    const n = lobby.length

    // bench rest (park): 2+ sitting by Beldam's bench
    if (!this.done.has('bench') && n >= 2) {
      const bp = world.benchPos
      const sitters = lobby.filter((p) => p.action === 'sit' && Math.hypot(p.pos.x - bp.x, p.pos.z - bp.z) < 2.6)
      if (sitters.length >= 2) this.fire('bench')
    }

    // constellation show (rooftops): ALL players lying near Nib
    if (!this.done.has('constellation') && npcs.nib) {
      const np = npcs.nib.rig.group.position
      const lying = lobby.filter((p) => (p.action === 'lie' || p.action === 'sleep') && Math.hypot(p.pos.x - np.x, p.pos.z - np.z) < 9)
      if (lying.length === n) this.fire('constellation')
    }

    // well glyphs (ruins): full lobby on distinct glyphs → sky beam
    if (!this.done.has('wellbeam')) {
      const need = Math.min(Math.max(n, 1), 4)
      if (this.occupiedGlyphs(lobby).size >= need) this.fire('wellbeam')
    }

    // gargoyle wave-back (gloomspire): everyone waves at it at once
    if (!this.done.has('gargoyle') && npcs.gargoyle) {
      const gp = npcs.gargoyle.rig.group.position
      const wavers = lobby.filter((p) => p.action === 'wave' && Math.hypot(p.pos.x - gp.x, p.pos.z - gp.z) < 18)
      if (wavers.length === n) this.fire('gargoyle')
    }

    // throne lullaby (hall): sitting at the dais foot with the ghost cat near
    if (!this.done.has('lullaby') && world.thronePos && npcs.ghostCat?.state === 'follow') {
      const tp = world.thronePos
      const catP = npcs.ghostCat.rig.group.position
      const seated = lobby.some((p) => p.action === 'sit' && Math.hypot(p.pos.x - tp.x, p.pos.z - tp.z) < 3.8)
      if (seated && Math.hypot(catP.x - tp.x, catP.z - tp.z) < 8) this.fire('lullaby')
    }

    // the arch (mosswood): all players underneath together
    if (!this.done.has('arch')) {
      const A = MOSSWOOD_ARCH
      const under = lobby.filter((p) => Math.abs(p.pos.x - A.x) < A.halfW && Math.abs(p.pos.z - A.z) < 2.6)
      if (under.length === n) this.fire('arch')
    }
  }

  occupiedGlyphs(lobby) {
    const occ = new Set()
    for (const g of this.c.world.ruinsGlyphs ?? []) g.occupied = false
    ;(this.c.world.ruinsGlyphs ?? []).forEach((g, gi) => {
      for (const p of lobby) {
        if (Math.hypot(p.pos.x - g.x, p.pos.z - g.z) < 1.1) { occ.add(gi); g.occupied = true; break }
      }
    })
    return occ
  }

  // glyph visibility scales 2–4 with the lobby; occupied glyphs brighten the well
  updateGlyphs(dt) {
    const world = this.c.world
    if (!world.ruinsGlyphs) return
    const lobby = this.lobby()
    const shown = Math.min(Math.max(lobby.length, 2), 4)
    // every client recomputes occupancy locally from synced positions — the
    // brightening is cosmetic and converges; only the BEAM is host-authoritative
    this.occupiedGlyphs(lobby)
    let litCount = 0
    world.ruinsGlyphs.forEach((g, gi) => {
      g.mesh.visible = gi < shown
      const want = g.occupied ? 0.9 : 0.2
      g.lit += (want - g.lit) * (1 - Math.exp(-dt * 4))
      g.mesh.material.uniforms.uOpacity.value = g.lit
      if (g.occupied) litCount++
    })
    // per-player well brightening: the kindled well glow scales up a touch
    const well = world.lights.find((l) => l.id === 'ruins-moonwell')
    if (well?.kindled && well.parts.halo) {
      const boost = 1 + litCount * 0.18
      well.parts.halo.scale.setScalar(boost)
    }
  }
}
