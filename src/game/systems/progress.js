// Progress (MASTER_PROMPT 6.1/6.3): zone completion → sleeper stir + trinket +
// full arrangement; Moon Brews with the woozy wink; localStorage persistence
// (trinkets + brews survive across nights — the night itself resets).

import { brewHum } from '../audio/sfx.js'

export const TRINKETS = {
  park: { id: 'cork', name: 'Beldam’s cork' },
  village: { id: 'feather', name: 'a warm hen feather' },
  rooftops: { id: 'telescope', name: 'Nib’s tiny telescope' },
  ruins: { id: 'dustcloth', name: 'the Curator’s dust-cloth' },
  gloomspire: { id: 'glassshard', name: 'a green window-glass shard' },
  hall: { id: 'catbell', name: 'the ghost cat’s bell' },
  mosswood: { id: 'mossbutton', name: 'Mote’s moss button' },
  isle: { id: 'sailorknot', name: 'a sailor’s knot' },
  gatewalkers: { id: 'archstone', name: 'the Gatewalkers’ arch-stone' }, // co-op arch moment (M7)
}

const SAVE_KEY = 'moonrest-save-v1'

export class Progress {
  constructor(world, npcs, hud, score, zoneKindles) {
    this.world = world
    this.npcs = npcs
    this.hud = hud
    this.score = score
    this.zoneKindles = zoneKindles
    this.trinkets = []
    this.beats = [] // autopilot/judge evidence log
    this.onWink = null
    this.load()
  }

  load() {
    try {
      const raw = localStorage.getItem(SAVE_KEY)
      if (!raw) return
      const s = JSON.parse(raw)
      this.trinkets = s.trinkets ?? []
      for (const id of s.brewIds ?? []) {
        const b = this.world.brews.find((x) => x.id === id)
        if (b) { b.taken = true; b.group.visible = false }
      }
      if (this.world.brewCount >= 12) this.gildBeldam()
    } catch (e) { /* first night */ }
  }

  save() {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify({
        trinkets: this.trinkets,
        brewIds: this.world.brews.filter((b) => b.taken).map((b) => b.id),
      }))
    } catch (e) { /* storage unavailable — the night goes on */ }
  }

  logBeat(kind, detail) {
    this.beats.push({ kind, detail, t: Math.round(performance.now()) })
  }

  onKindle(light) {
    this.logBeat('kindle', light.id)
    const zoneLights = this.world.lights.filter((l) => l.zone === light.zone)
    if (zoneLights.every((l) => l.kindled)) {
      this.logBeat('zone-complete', light.zone)
      this.npcs.onZoneComplete(light.zone)
      const t = TRINKETS[light.zone]
      if (t && !this.trinkets.includes(t.id)) {
        this.trinkets.push(t.id)
        this.logBeat('trinket', t.id)
        this.hud.sayLater(`Keepsake: ${t.name}.`, 4.5, 4)
        this.save()
      }
    }
  }

  grantTrinket(id, name) { // co-op moments (arch-stone)
    if (this.trinkets.includes(id)) return false
    this.trinkets.push(id)
    this.logBeat('trinket', id)
    this.hud.say(`Keepsake: ${name}.`, 4)
    this.save()
    return true
  }

  onBrew(brew) {
    this.logBeat('brew', brew.id)
    brewHum()
    if (this.onWink) this.onWink() // warm bloom + camera roll + giggle unlock (4.1)
    if (this.world.brewCount >= 12) {
      this.gildBeldam()
      this.hud.say('Twelve empty bottles. Beldam’s own turns to gold.', 5)
      this.logBeat('brews-complete', 12)
    }
    this.save()
  }

  gildBeldam() {
    const bottle = this.npcs.beldam?.bottle
    if (!bottle) return
    bottle.traverse((o) => {
      if (o.isMesh) {
        const col = o.geometry.getAttribute('color')
        for (let i = 0; i < col.count; i++) col.setXYZ(i, 0.9, 0.72, 0.28)
        col.needsUpdate = true
      }
    })
  }
}
