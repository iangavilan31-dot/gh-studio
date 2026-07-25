// MOONREST — boot + game loop. M1: the Lamplighter walks the Park graybox.
// Test surface per MASTER_PROMPT 0.4 on window.__MOONREST__.

import * as THREE from 'three'
import { Pipeline } from './core/pipeline.js'
import { ZoneLightState, ZONES } from './world/zonelight.js'
import { globalUniforms } from './art/materials.js'
import { World } from './world/world.js'
import { buildWizard, PLAYER_TINTS } from './art/characters.js'
import { Input } from './systems/input.js'
import { PlayerController } from './systems/player.js'
import { OrbitCamera } from './systems/camera.js'
import { InteractSystem } from './systems/interact.js'
import { HUD } from './ui/hud.js'
import { Night } from './world/night.js'
import { ParticleSystem, emberBurst } from './world/particles.js'
import { Stars } from './world/stars.js'
import { Ambience } from './world/ambience.js'
import { NPCSystem } from './systems/npc.js'
import { Progress } from './systems/progress.js'
import { NightFlow } from './systems/nightflow.js'
import { Moments } from './systems/moments.js'
import { Net } from './net/coop.js'
import { Shell, loadSettings } from './ui/shell.js'
import { audio } from './audio/engine.js'
import { cues } from './audio/cues.js'
import { dream } from './dream/dream.js'
import { DreamTunnel } from './dream/tunnel.js'
import { score } from './audio/score.js'
import { beds } from './audio/beds.js'
import { footstep, kindleChime } from './audio/sfx.js'
import * as TEX from './art/textures.js'
import { worldRNG } from './core/rng.js'

const BOOT_T0 = performance.now()
const canvas = document.getElementById('game')
const pipeline = new Pipeline(canvas)
const scene = new THREE.Scene()
const camera = new THREE.PerspectiveCamera(55, 16 / 9, 0.1, 220)
const zoneLight = new ZoneLightState(scene)
const world = new World(scene, camera)
const night = new Night(scene)
const hud = new HUD()

// particle systems (global cap 2000 across all — Part 8.7)
// tight near-fade: the intro ignition burst happens ~1m from the camera
const embers = new ParticleSystem(scene, { tex: TEX.glowDot({ color: '#ffb45e' }), max: 220, additive: true, nearFade: [0.08, 0.35] })
const stars = new Stars(scene)
const ambience = new Ambience(scene, world)

// player (rig is swappable: co-op assigns tints by join order — Part 5)
let rig = buildWizard({ tint: PLAYER_TINTS[0] })
scene.add(rig.group)
// the player's lantern is a real light source: animate flame, billboard halo
if (rig.staffFlame) world.flames.push({ mesh: rig.staffFlame, tex: rig.staffFlame.material.uniforms.uMap.value, frame: 1, acc: 0 })
if (rig.staffHalo) world.halos.push(rig.staffHalo)
const input = new Input(canvas)
const player = new PlayerController(rig, world)
player.pos.set(2.6, 0, -18.2) // waking at dusk by the Long Bench
player.pos.y = world.heightAt(player.pos.x, player.pos.z)
player.yaw = player.targetYaw = 0

const orbit = new OrbitCamera(camera, world)
orbit.yaw = orbit.smoothYaw = Math.PI // camera behind, facing the park
const interact = new InteractSystem(world, player, hud)
const npcs = new NPCSystem(scene, world, hud, ambience, stars)

const zoneKindlesEarly = (zone) => world.lights.filter((l) => l.zone === zone && l.kindled).length
const progress = new Progress(world, npcs, hud, score, zoneKindlesEarly)

let winkT = 0
let giggleUntil = 0
progress.onWink = () => { winkT = 1; giggleUntil = elapsed + 60 }
world.onBrew = (b) => progress.onBrew(b)

const nightflow = new NightFlow(night, world, hud, camera, {
  setCinematic: (v) => { cinematic = v; if (v) { hud.hidePrompt(); hud.clearSubtitle() } },
  getStats: () => ({
    lights: world.kindledCount,
    lightsTotal: world.lights.length,
    brews: world.brewCount,
    trinkets: progress.trinkets.filter((t) => t !== 'archstone').length,
    friends: net.peerCount,
  }),
  onReelStart: () => score.finale(),
  onTitleCard: () => score.picardy(),
  onNightEnd: () => {
    progress.save()
    try { localStorage.setItem('moonrest-night-ended', '1') } catch (e) {}
    location.reload() // back to dusk on the bench — the night is a loop (6.5)
  },
})

// footsteps synced to stride (Part 4.2) + the lantern glow pulses with steps (4.1)
let staffPulse = 0
player.onFootstep = (surface, vol) => { footstep(surface, vol); staffPulse = Math.min(1, staffPulse + 0.55) }
// C.1 landing: a soft thump and a puff of dust acknowledge the ground
player.onLand = (impact) => {
  footstep(player.surface, 0.5 + impact * 0.5)
  const drng = worldRNG.fork('dust' + Math.round(elapsed * 10))
  for (let i = 0; i < 5; i++) {
    ambience.smoke.spawn({
      pos: new THREE.Vector3(player.pos.x + drng.range(-0.2, 0.2), player.pos.y + 0.06, player.pos.z + drng.range(-0.2, 0.2)),
      vel: new THREE.Vector3(drng.range(-0.5, 0.5), drng.range(0.2, 0.5), drng.range(-0.5, 0.5)),
      maxLife: drng.range(0.4, 0.8),
      size: drng.range(0.1, 0.2) * (0.6 + impact * 0.6),
      seed: drng.next(),
      update(p, dt2) {
        p.pos.addScaledVector(p.vel, dt2)
        p.alpha = 0.28 * (1 - p.life / p.maxLife) // fade out, not pop out
      },
    })
  }
}

// ——— emote wheel (Part 4.2): hold Tab/Y, aim, release ———
let wheelOpen = false
let wheelVec = [0, 0]
function doEmote(id) {
  player.setAction(id)
  if (net.active) net.request({ ev: 'emote', id })
}
// ——— DREAMSCRAP F0: lie down beside a dreamer and the dream reaches out ———
const dreamTunnel = new DreamTunnel()
let dreamRest = 0 // seconds spent asleep in a sleeper's orbit
function beginDreamEntry(arenaId) {
  if (dreamTunnel.active || dream.active) return false
  if (!shell.s.dreamFound) { shell.s.dreamFound = true; shell.save() } // the title grows a 'Dream' item
  dreamTunnel.begin('in', 1.4, () => {
    endIntro(true)
    if (mode === 'title') { shell.clear(); mode = 'game' }
    // the dreamer fights back: an Awake bot holds seat 2 until couch/online
    // seat-filling lands with F8/F9
    dream.enter(arenaId, 2, input, { bots: { 1: 'awake' } })
  })
  return true
}

function handleEmoteWheel() {
  if (input.down('Tab')) {
    if (!wheelOpen) { wheelOpen = true; wheelVec = [0, 0]; hud.showEmoteWheel(elapsed < giggleUntil) }
    const [lx, ly] = input.consumeLook()
    wheelVec[0] += lx; wheelVec[1] += ly
    if (Math.hypot(wheelVec[0], wheelVec[1]) > 12) {
      const ang = Math.atan2(wheelVec[1], wheelVec[0]) // screen space: +y is down
      let sel
      if (ang > -2.36 && ang < -0.79) sel = 0        // up — wave
      else if (ang >= -0.79 && ang <= 0.79) sel = 1  // right — point
      else if (ang > 0.79 && ang < 2.36) sel = 2     // down — giggle (brew-locked)
      else sel = 3                                    // left — sleep
      if (sel === 2 && elapsed >= giggleUntil) sel = hud.wheelSel ?? -1
      if (sel >= 0) hud.highlightEmote(sel)
    }
    // number keys pick directly (works without pointer lock; kinder to remaps)
    for (let k = 0; k < 4; k++) {
      if (input.pressed('Digit' + (k + 1)) && (k !== 2 || elapsed < giggleUntil)) hud.highlightEmote(k)
    }
  } else if (wheelOpen) {
    wheelOpen = false
    const emote = hud.hideEmoteWheel()
    if (emote) doEmote(emote)
  }
}

// ——— Co-op (Part 5): host-authority PeerJS, remote lamplighters, moments ———
function swapLocalTint(idx) {
  const old = rig
  const nr = buildWizard({ tint: PLAYER_TINTS[idx % PLAYER_TINTS.length] })
  scene.remove(old.group)
  const fi = world.flames.findIndex((f) => f.mesh === old.staffFlame)
  if (fi >= 0) world.flames.splice(fi, 1)
  const hi = world.halos.indexOf(old.staffHalo)
  if (hi >= 0) world.halos.splice(hi, 1)
  rig = nr
  scene.add(rig.group)
  if (rig.staffFlame) world.flames.push({ mesh: rig.staffFlame, tex: rig.staffFlame.material.uniforms.uMap.value, frame: 1, acc: 0 })
  if (rig.staffHalo) world.halos.push(rig.staffHalo)
  player.rig = rig
  rig.group.position.copy(player.pos)
  rig.group.rotation.y = player.yaw
}

// the whole lobby (local + live remotes) — moments, chickens, gargoyle all
// reason about "all players" through this one lens
const lobbyProvider = () => {
  const list = [{ id: net.myId ?? 0, rig, pos: player.pos, action: player.anim.action }]
  for (const [id, rp] of net.remotes) if (!rp.fading) list.push({ id, rig: rp.rig, pos: rp.pos, action: rp.action })
  return list
}

function applyNetEvent(ev) {
  if (ev.ev === 'kindle') {
    // your OWN kindle also arrives via the host broadcast — it must keep its
    // local feedback (glance-back, rumble, streak); only a PEER's is remote
    world.kindle(ev.id, { remote: ev.from !== net.myId })
  } else if (ev.ev === 'emote' || ev.ev === 'chan') {
    const rp = net.remotes.get(ev.from)
    if (rp) {
      const a = ev.ev === 'chan' ? (ev.on ? 'channel' : null) : ev.id
      rp.action = a; rp.anim.action = a; rp.anim.actionT = 0
      if (a === 'channel') rp.anim.channelHeight = ev.h ?? 0 // C.3 reach replicates
    }
  } else if (ev.ev === 'moment') {
    moments.apply(ev)
  } else if (ev.ev === 'nightEnd') {
    if (!nightflow.ending && !window.__SUPPRESS_NIGHT_END__) nightflow.startNightsEnd('keeper')
  }
}

const net = new Net({
  scene, world, night,
  getLocal: () => ({
    pos: player.pos, yaw: player.yaw,
    gait: player.anim.speed > 2.2 ? 'jog' : player.anim.speed > 0.1 ? 'walk' : 'idle',
    action: player.anim.action, channelTarget: interact.channelTarget,
  }),
  applyEvent: applyNetEvent,
  snapshot: () => ({
    kindled: world.kindledIds, nightT: night.minutes, phase: night.phaseAge ?? null,
    catAwake: npcs.ghostCat?.state === 'follow', momentsDone: [...moments.done],
    mounts: npcs.chickens.map((c) => (c.state === 'mount' ? c.riderId : null)),
    nightSeed: nightSignature.seed, // D.1: peers share one dealt night
  }),
  applySnapshot: (s) => {
    if (s.you != null) swapLocalTint(s.you) // join order picks your robe
    if (s.nightSeed != null && s.nightSeed !== nightSignature.seed) applyNightSeed(s.nightSeed) // one dealt night for the lobby
    for (const id of s.kindled ?? []) world.kindle(id, { quiet: true })
    if (s.nightT != null) { night.minutes = s.nightT; night.targetMinutes = s.nightT }
    if (s.phase != null) night.setPhase(s.phase)
    if (s.catAwake) npcs.wakeGhostCat(true)
    progress.syncCompletedZones() // zones done before we arrived still grant keepsakes
    moments.done = new Set(s.momentsDone ?? [])
    if (moments.done.has('arch') && !progress.trinkets.includes('archstone')) {
      progress.trinkets.push('archstone'); progress.save()
    }
    s.mounts?.forEach((rid, i) => { if (rid != null) npcs.mountChicken(i, rid) })
    if (audio.started) {
      // F.3 for late joiners: snapshot kindles arrive quiet, so the "first
      // flame wakes the music" hook never fired — start it here or a joiner
      // inherits a permanently silent lit night
      if (world.kindledCount > 0 && !score.playing) score.start()
      score.setLayers(zoneKindles(score.zone)) // audible gains, not just counters
    }
  },
  getCatPos: () => (npcs.ghostCat?.state === 'follow' ? npcs.ghostCat.rig.group.position.toArray().map((v) => +v.toFixed(2)) : null),
  setCatTarget: (arr) => { npcs.catNetTarget = arr },
  onPeerJoin: () => hud.say('another lantern joins the night.', 3.5),
  onPeerLeave: () => hud.say('a lantern drifts away, fireflies now.', 3.5),
  onHostLost: () => {
    hud.say('the night drifts on without its keeper.', 5)
    if (!window.__SUPPRESS_NIGHT_END__) setTimeout(() => location.reload(), 5200) // soft return (title lands in M8)
  },
  onDeny: (reason) => {
    if (reason === 'brazier') hud.say('this flame wants every keeper. channel it together.', 4)
    else if (reason === 'full') hud.say('that night already carries four lanterns.', 4)
  },
  spawnFireflies: (x, y, z) => emberBurst(embers, x, y, z, worldRNG.fork('fade' + Math.round(x * 7 + z * 3))),
  remoteFootstep: (surface, vol) => footstep(surface, vol),
  beforeRemoteDispose: (rp) => npcs.rescueChickens(rp.rig), // riders set their chicken down
})

const moments = new Moments({
  world, npcs, player, hud, stars, progress, ambience, net,
  warmPulse: (v) => { pipeline.postUniforms.uWarm.value = Math.max(pipeline.postUniforms.uWarm.value, v) },
  playerRigs: lobbyProvider,
})

npcs.playersProvider = lobbyProvider
npcs.chickenAuthority = () => !net.active || net.role === 'host'
npcs.onChickenMount = (chIdx, playerId) => {
  const ev = { ev: 'moment', id: 'chicken', chIdx, player: playerId }
  if (net.active && net.role === 'host') net.broadcastEvent(ev)
  else if (!net.active) moments.apply(ev)
}

// kindles route through the authority; channel state feeds the brazier law
interact.requestKindle = (id) => (net.active ? net.requestKindle(id) : world.kindle(id))
interact.onChannelState = (id, on) => { if (net.active) net.request({ ev: 'chan', id, on, h: player.anim.channelHeight }) }
let neSent = false // host tells clients when the min-40 clock ends the night
// a closing tab says goodbye properly, so peers see the firefly fade at once
// instead of waiting out a dead connection
window.addEventListener('pagehide', () => { if (net.active) net.leave() })

// ——— The shell (Part 10): title → night, pause, settings, photo mode ———
let mode = 'title' // 'title' | 'game'
let titleIdle = 0

// ——— H.1 opening sequence: rain-black → moon → lamp → fog → Beldam → the
// lantern ignites → title. Skippable on any input; lands seamlessly on the
// title diorama orbit (the menu fades in without cutting away).
const intro = { active: true, t: 0, black: null, hint: null, done: false }
function setupIntro() {
  // the loop-reset reload (Night's End → dusk) goes straight to the menu —
  // the ritual replays only on a fresh visit (still skippable any time)
  let returning = false
  try { returning = localStorage.getItem('moonrest-night-ended') === '1' } catch (e) {}
  if (returning) { intro.active = false; intro.done = true; return }
  const ui = document.getElementById('ui')
  intro.black = document.createElement('div')
  intro.black.className = 'introblack'
  ui.appendChild(intro.black)
  intro.hint = document.createElement('div')
  intro.hint.className = 'introskip'
  intro.hint.textContent = 'any key — skip'
  ui.appendChild(intro.hint)
  night.skipTo(4) // the moon hangs young in the east for the reveal
  document.querySelector('#ui .shell')?.classList.add('introhold')
}
canvas.addEventListener('pointerdown', () => { if (intro.active && !intro.done) endIntro() })
function endIntro(fast = false) {
  if (intro.done) return
  intro.done = true
  intro.active = false
  if (fast) { intro.black?.remove(); intro.hint?.remove() }
  else {
    intro.black?.classList.add('lift')
    setTimeout(() => { intro.black?.remove(); intro.hint?.remove() }, 3000)
  }
  intro.hint?.classList.remove('on')
  document.querySelector('#ui .shell')?.classList.remove('introhold')
}
const _iv = new THREE.Vector3()
const _lookA = new THREE.Vector3(), _lookB = new THREE.Vector3()
const ss = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t) }
function updateIntro(dt) {
  intro.t += dt
  const t = intro.t
  const ty = world.heightAt(2, -19.6)
  if (t > 1.2 && t < 2.0) intro.black?.classList.add('lift') // rain-black lifts
  if (t > 3 && t < 4) intro.hint?.classList.add('on')
  // beats: high moon gaze → descend through the fog to the cold lamp →
  // Beldam asleep → the player's lantern flares → pull out to the orbit
  const beats = [
    // drift up to the moon — the path rides south of the big tree so the
    // sightline CLEARS the canopy; the disc is framed, never sliced
    { a: 0.0, b: 4.6, p0: [-8, 9.5, -35.5], p1: [-5.6, 7.9, -33], l0: [32, 32, -22], l1: [30.4, 29.6, -20.2] },
    // …and HOLD on it — a breath, not a pan (judge pass 4)
    { a: 4.6, b: 7.0, p0: [-5.6, 7.9, -33], p1: [-5, 7.5, -32.4], l0: [30.4, 29.6, -20.2], l1: [30, 28.6, -20] },
    { a: 7.0, b: 12.0, p0: [-5, 7.5, -32.4], p1: [4.6, ty + 1.9, -14.8], l0: [30, 28.6, -20], l1: [4.2, ty + 2.5, -19.2] },
    { a: 12.0, b: 15.5, p0: [4.6, ty + 1.9, -14.8], p1: [3.1, ty + 1.5, -17.5], l0: [4.2, ty + 2.5, -19.2], l1: [1.6, ty + 1.3, -19.6] },
    { a: 15.5, b: 17.5, p0: [3.1, ty + 1.5, -17.5], p1: [4.5, ty + 1.45, -17.0], l0: [1.6, ty + 1.3, -19.6], l1: [2.6, ty + 1.15, -18.2] },
  ]
  let placed = false
  for (const k of beats) {
    if (t >= k.a && t < k.b) {
      const f = ss(k.a, k.b, t)
      camera.position.set(
        k.p0[0] + (k.p1[0] - k.p0[0]) * f,
        k.p0[1] + (k.p1[1] - k.p0[1]) * f,
        k.p0[2] + (k.p1[2] - k.p0[2]) * f)
      _lookA.set(...k.l0); _lookB.set(...k.l1)
      camera.lookAt(_iv.copy(_lookA).lerp(_lookB, f))
      placed = true
      break
    }
  }
  if (t >= 15.8 && t < 17.5) staffPulse = Math.min(1, staffPulse + dt * 3) // the lantern ignites
  if (!intro.embered && t >= 15.85) {
    // ignition punch: one ember burst off the staff lantern the moment it takes
    intro.embered = true
    if (rig.bones.staffLantern) {
      rig.bones.staffLantern.getWorldPosition(_iv)
      emberBurst(embers, _iv.x, _iv.y, _iv.z, worldRNG.fork('introember'), 16)
    }
  }
  if (t >= 17.5) {
    // blend onto the live orbit so the menu fades in without a cut
    const f = ss(17.5, 19.5, t)
    const a = elapsed * 0.03
    _iv.set(2 + Math.cos(a) * 8, ty + 2.4, -19.6 + Math.sin(a) * 8)
    camera.position.lerp(_iv, f)
    _lookA.set(2.6, ty + 1.15, -18.2); _lookB.set(2, ty + 1.1, -19.6)
    camera.lookAt(_lookA.lerp(_lookB, f))
    if (t >= 18.4) endIntro()
    placed = true
  }
  zoneLight.update(2, -19.6, dt, 2)
  return placed
}
const NULL_INPUT = { moveAxis: () => [0, 0], pressed: () => false, down: () => false, endFrame: () => {} }

function startNight(fresh = false) {
  if (fresh) {
    try { localStorage.removeItem('moonrest-save-v1') } catch (e) { /* private mode */ }
    progress.trinkets.length = 0
    for (const b of world.brews) { b.taken = false; b.group.visible = true }
  }
  mode = 'game'
  cinematic = false
  endIntro(true)
  night.skipTo(0) // dusk — the intro's moon-reveal minute never shortens the night
  _revealed.clear() // each night re-earns its reveals
  orbit.autoPlace(player.pos, Math.PI) // wake up with the night in view, not bark
  nightflow.noteInput()
  npcs.nightIntro() // AA.5: Beldam points at the first cold lamp
  return true
}

// Memory dials (Part 8.6 + PRESTIGE Part Q) + every other setting, in one place
function applySettings(s) {
  const post = pipeline.postUniforms
  // Restored (default, Part Q.1): native res, no blur, dither as film grain
  // (≤0.15), gentle luma sharpen, crisp mips via -0.5 LOD bias
  let preset = { uSoftBlur: 0, uQuantize: 32, uDither: 0.15, uScanline: 0, uChroma: 0, uWobble: 0, uSharpen: 0.15 }
  let snap = 0, affine = 0, hissBoost = 0, res = s.resScale, native = true, lodBias = -0.5
  // affine lean is gentle: 0.35 wobbles textures the era-authentic amount;
  // higher values collapse big near polys (the street melts — judge pass 1)
  if (s.memoryMode === 'n64') { preset = { uSoftBlur: 0.6, uQuantize: 32, uDither: 0.5, uScanline: 0, uChroma: 0, uWobble: 0, uSharpen: 0 }; native = false; lodBias = 0 }
  else if (s.memoryMode === 'ps1') { preset = { uSoftBlur: 0, uQuantize: 32, uDither: 0.65, uScanline: 0, uChroma: 0, uWobble: 0, uSharpen: 0 }; snap = 1; affine = 0.35; native = false; lodBias = 0 }
  else if (s.memoryMode === 'vhs') { preset = { uSoftBlur: 0.35, uQuantize: 28, uDither: 0.5, uScanline: 0.55, uChroma: 1.3, uWobble: s.reducedMotion ? 0 : 1, uSharpen: 0 }; hissBoost = 6; native = false; lodBias = 0 }
  for (const [k, v] of Object.entries(preset)) post[k].value = v
  globalUniforms.uSnapEnable.value = snap
  globalUniforms.uAffineMix.value = affine
  globalUniforms.uLodBias.value = lodBias
  pipeline.setNative(native)
  if (!native) pipeline.setResScale(res)
  globalUniforms.uSnapRes.value.set(pipeline.rt.width, pipeline.rt.height)
  audio.applyPrefs({ music: s.volMusic, ambience: s.volAmbience, sfx: s.volSfx, hissOn: s.hiss, hissBoostDb: hissBoost })
  input.remap = { KeyE: s.keyKindle, Space: s.keyHop, KeyC: s.keySit }
  input.sensitivity = s.sensitivity
  input.invertY = s.invertY
  interact.holdToToggle = s.holdToToggle
  hud.subtitlesOn = s.subtitles
  orbit.autoFrame = s.cameraAssist !== false // Part 4.3: assist has an off switch
  orbit.firstPerson = s.viewMode === 'first' // Q.3: wizard's eyes
  orbit.intimacy = s.camIntimacy ?? 1
  window.__REDUCED_MOTION__ = s.reducedMotion
}

const shell = new Shell({
  startNight,
  hostNight: () => net.host(),
  joinNight: (code) => net.join(code),
  beginDream: () => beginDreamEntry('beldam'), // F0: the title remembers the discovered dream
  dreamActive: () => dream.active || dreamTunnel.active, // Escape belongs to the dream while it's up
  applySettings,
  getStats: () => ({ lights: world.kindledCount, lightsTotal: world.lights.length, brews: world.brewCount, trinkets: progress.trinkets, code: net.code }),
  hasSave: () => { try { return !!localStorage.getItem('moonrest-save-v1') } catch (e) { return false } },
  bootAudio: () => bootAudio(),
})
applySettings(shell.s)
setupIntro() // H.1: the night introduces itself before the menu does

// ——— Photo mode (Part 10): P — free-fly, roll, FOV, filter, UI hide, PNG ———
const photo = { on: false, euler: new THREE.Euler(0, 0, 0, 'YXZ'), fov: 55, hint: null }
function togglePhoto(on) {
  photo.on = on
  const ui = document.getElementById('ui')
  if (on) {
    photo.euler.setFromQuaternion(camera.quaternion, 'YXZ')
    photo.fov = camera.fov
    hud.hidePrompt()
    photo.hint = document.createElement('div')
    photo.hint.className = 'photohint'
    photo.hint.textContent = 'photo · WASD fly · mouse aim · Q/Z roll · wheel zoom · F filter · H hide · Enter save · P leave'
    ui.appendChild(photo.hint)
  } else {
    photo.hint?.remove()
    ui.style.display = ''
    camera.fov = 55
    camera.updateProjectionMatrix()
  }
}
function updatePhoto(dt) {
  const [lx, ly] = input.consumeLook()
  photo.euler.y -= lx * 0.0032
  photo.euler.x = Math.max(-1.45, Math.min(1.45, photo.euler.x - ly * 0.0032))
  if (input.down('KeyQ')) photo.euler.z += dt * 0.7
  if (input.down('KeyZ')) photo.euler.z -= dt * 0.7
  camera.quaternion.setFromEuler(photo.euler)
  const [ax, az] = input.moveAxis()
  const sp = input.down('ShiftLeft', 'ShiftRight') ? 16 : 5.5
  _pv.set(ax, 0, az).applyQuaternion(camera.quaternion)
  camera.position.addScaledVector(_pv, sp * dt)
  camera.fov = photo.fov
  camera.updateProjectionMatrix()
  if (input.pressed('KeyF')) { // filter picker cycles the Memory dials
    const modes = ['restored', 'n64', 'ps1', 'vhs']
    shell.s.memoryMode = modes[(modes.indexOf(shell.s.memoryMode) + 1) % modes.length]
    shell.save(); applySettings(shell.s)
  }
  if (input.pressed('KeyH')) {
    const ui = document.getElementById('ui')
    ui.style.display = ui.style.display === 'none' ? '' : 'none'
  }
  if (input.pressed('Enter')) capturePhoto()
}
const _pv = new THREE.Vector3()
let _prevZone = 'park'
const _revealed = new Set()
const _floorC = new THREE.Color()
const _floorHSL = { h: 0, s: 0, l: 0 }
function capturePhoto() {
  const prev = pipeline.resScale
  // retro dials upscale the keepsake to 2×; Restored is already native res
  if (!pipeline.native) pipeline.setResScale(Math.max(2, prev))
  pipeline.render(scene, camera, elapsed)
  const url = canvas.toDataURL('image/png')
  if (!pipeline.native) pipeline.setResScale(prev)
  const a = document.createElement('a')
  a.href = url
  a.download = `moonrest-${Math.round(performance.now())}.png`
  a.click()
}
canvas.addEventListener('wheel', (e) => {
  if (!photo.on) return
  e.preventDefault()
  photo.fov = Math.max(20, Math.min(90, photo.fov + Math.sign(e.deltaY) * 2.5))
}, { passive: false })

const zoneKindles = (zone) => world.lights.filter((l) => l.zone === zone && l.kindled).length

// kindle consequences: chime in zone key, ember burst, next music layer (6.1)
// D.1 the Uncertain Road: each real-world night deals gentle variations —
// cosmetic scalars only (fog reach, wind temper, moon warmth), deterministic
// per seed, NEVER gating progression. Rigs may pin __NIGHT_SEED__.
const nightSignature = { seed: 0, fogDrift: 1, gustiness: 1, moonWarmth: 1 }
function applyNightSeed(seedVal) {
  const sigRng = worldRNG.fork('night/' + seedVal)
  nightSignature.seed = seedVal
  nightSignature.fogDrift = +(0.94 + sigRng.next() * 0.12).toFixed(3)   // ±6% fog reach
  nightSignature.gustiness = +(0.7 + sigRng.next() * 0.6).toFixed(2)    // wind temper
  nightSignature.moonWarmth = +(0.94 + sigRng.next() * 0.14).toFixed(3) // moon face tint
  night.signatureTint = nightSignature.moonWarmth
  night.setPhase(night.phaseAge) // re-apply: the face tint carries the signature
}
applyNightSeed(window.__NIGHT_SEED__ ?? Math.floor(Date.now() / 86400000))

let kindleStreak = 0, lastKindleT = -999
world.onKindle = (light, remote) => {
  if (audio.started && !score.playing) score.start() // F.3: the first flame wakes the music
  if (!remote) {
    // C.4: the keeper glances back at what THEY just lit — a peer's kindle
    // across the map must not yank the local head or buzz the pad
    player.lookBack(light.x, light.z, 2.6)
    input.rumble(0.3, 0.6, 140) // controller ping (4.2) — no-op without a pad
    // C.4 proud nod: a chain of three lamps (each within 60s of the last)
    // earns a small dip of the head
    kindleStreak = elapsed - lastKindleT < 60 ? kindleStreak + 1 : 1
    lastKindleT = elapsed
    if (kindleStreak >= 3) { player.anim.nod = 1; kindleStreak = 0 }
  }
  kindleChime(light.zone)
  emberBurst(embers, light.x, light.y, light.z, worldRNG.fork('embers' + light.id))
  if (light.zone === score.zone) score.setLayers(zoneKindles(light.zone))
  npcs.onKindle(light)
  progress.onKindle(light)
  if (light.id === 'park-firefly-jar') ambience.releaseFireflies()
  if (light.id === 'isle-keep-brazier' && !window.__SUPPRESS_NIGHT_END__) nightflow.startNightsEnd('keep-brazier')
}

// audio boots on first real gesture (autoplay policy)
function bootAudio() {
  if (audio.started) return
  audio.start()
  audio.state.zoneKey = 'D'
  // F.3 silence design: before the first kindle the night has no music —
  // only rain and wind. The first flame starts the score.
  if (world.kindledCount > 0) score.start()
  beds.start()
  cues.start() // F.2: the bell and the organ take their places in the world
  beds.setZone(zoneLight.audioZone ?? 'park', 1)
  audio.setHallAcoustics(zoneLight.audioZone === 'hall')
}
window.addEventListener('keydown', bootAudio, { once: false })
window.addEventListener('mousedown', bootAudio, { once: false })

// ——— Shoot-rig camera poses (Part 3 per-zone, defined by the world) ———
const POSES = world.poses

let cinematic = false
function teleport(poseName) {
  const p = POSES[poseName]
  if (!p) return false
  endIntro(true) // rigs never sit through the opening
  if (mode === 'title') { shell.clear(); mode = 'game' } // rigs shoot the night, not the menu
  cinematic = true
  hud.hidePrompt() // no HUD in cinematic frames (12.5)
  hud.clearSubtitle()
  camera.position.set(...p.pos)
  camera.lookAt(...p.look)
  // poses may pin the night minute (AA.1): each zone's shot catches the moon
  // where its authored framing honestly crosses the descending arc
  if (p.minute != null) night.skipTo(p.minute)
  // poses may stage the player (AA.2 lantern-pool evidence)
  if (p.player) {
    player.pos.set(p.player[0], world.heightAt(p.player[0], p.player[1]), p.player[1])
    player.yaw = player.targetYaw = p.player[2] ?? 0
  }
  // atmosphere follows the viewed zone, not the parked player
  // (XZ from the look target; Y from the camera, so elevation-gated zones
  //  like the rooftops only claim shots taken from up there)
  zoneLight.update(p.look[0], p.look[2], 10, p.pos[1])
  ambience.snapZone(zoneLight.currentZoneId)
  if (audio.started) {
    beds.setZone(zoneLight.currentZoneId, 0.5)
    audio.setHallAcoustics(zoneLight.currentZoneId === 'hall')
  }
  return true
}

// ——— Loop ———
let lastNow = performance.now()
let elapsed = 0
let rainWasSoft = false
const frameTimes = []

function tick() {
  requestAnimationFrame(tick)
  const now = performance.now()
  const dt = Math.min((now - lastNow) / 1000, 0.1)
  lastNow = now
  elapsed += dt
  globalUniforms.uTime.value = elapsed
  frameTimes.push(dt)
  if (frameTimes.length > 90) frameTimes.shift()

  // carried lantern pools (AA.2): local + remote staff lanterns feed the
  // shared shader's warm falloff; gentle flicker keeps the pool alive
  {
    const lp = globalUniforms.uLanternPos.value
    const ls = globalUniforms.uLanternStr.value
    let li = 0
    const feed = (rig, seed) => {
      if (li >= 4 || !rig?.bones?.staffLantern) return
      rig.bones.staffLantern.getWorldPosition(lp[li])
      ls[li] = 0.82 + 0.12 * Math.sin(elapsed * 8.3 + seed) + 0.06 * Math.sin(elapsed * 13.1 + seed * 2)
      li++
    }
    feed(player.rig, 0)
    for (const [, rp] of net.remotes) { if (!rp.fading) feed(rp.rig, 3.7 * li) }
    for (; li < 4; li++) { lp[li].set(0, -999, 0); ls[li] = 0 }
  }

  input.pollGamepad()
  const inputActive = input.keys.size > 0 || input.justPressed.size > 0
  if (inputActive) nightflow.noteInput()

  // ——— DREAMSCRAP (Part 1): while dreaming, the dream owns the frame — the
  // waking world pauses whole (no sim, no combat verbs ever added to it)
  dreamTunnel.update(dt) // the iris draws over whichever world is up
  if (dream.active) {
    dream.update(dt) // may end itself (the victory nap fades the dream)
    if (dream.active && input.pressed('Escape') && !dreamTunnel.active) dream.exit() // F0: skippable any time
    if (dream.active) {
      input.endFrame()
      pipeline.render(dream.scene, dream.camera, elapsed)
      return
    }
    // the dream just ended: the eye opens back on the waking night, the
    // sleeper sits up, and nothing in the world has moved an inch
    if (!dreamTunnel.active) dreamTunnel.begin('out', 0.9)
    if (player.anim.action === 'sleep' || player.anim.action === 'lie') player.setAction(null)
    dreamRest = 0
  }

  // photo mode toggle (in the night, no menu up)
  if (mode === 'game' && !shell.screen && !cinematic && input.pressed('KeyP')) togglePhoto(!photo.on)
  // a menu/cinematic interrupting a Tab-hold discards the wheel, emoting nothing
  if (wheelOpen && (cinematic || shell.blocking || photo.on || mode === 'title')) {
    wheelOpen = false
    hud.hideEmoteWheel()
  }
  // photo mode yields to menus and cinematics — never two input owners at once
  if (photo.on && (shell.blocking || cinematic || mode === 'title')) togglePhoto(false)
  // anything that steals the update loop mid-channel lets go of the flame cleanly
  if (interact.channeling && (shell.blocking || cinematic || photo.on || wheelOpen || mode === 'title')) interact.cancelChannel()

  night.paused = mode === 'title' // the 40 minutes belong to the walk, not the menu

  if (mode === 'title') {
    // the opening sequence owns the camera first (H.1); any input skips it —
    // the world underneath keeps living (rain, moon, flames) the whole time
    if (intro.active && !intro.done && inputActive) endIntro()
    const introOwns = intro.active && !intro.done && updateIntro(dt)
    // live Park diorama drifts behind the title (Part 10)
    titleIdle = inputActive ? 0 : titleIdle + dt
    if (titleIdle > 90 && shell.screen === 'title') nightflow.startAttract()
    if (!introOwns && !nightflow.attract && !nightflow.ending) {
      const a = elapsed * 0.03
      const ty = world.heightAt(2, -19.6)
      camera.position.set(2 + Math.cos(a) * 8, ty + 2.4, -19.6 + Math.sin(a) * 8)
      camera.lookAt(2, ty + 1.1, -19.6)
      zoneLight.update(2, -19.6, dt, 2)
    }
    player.update(NULL_INPUT, orbit.smoothYaw, dt, elapsed)
  } else if (photo.on && !cinematic) {
    updatePhoto(dt)
    zoneLight.update(camera.position.x, camera.position.z, dt, camera.position.y)
    player.update(NULL_INPUT, orbit.smoothYaw, dt, elapsed)
  } else if (!cinematic && !shell.blocking) {
    const jogging = input.down('ShiftLeft', 'ShiftRight') && player.anim.speed > 2
    // Q.3: V flips between the wizard's back and the wizard's eyes (persisted);
    // stands down if the player has rebound a verb onto KeyV
    if (input.pressed('KeyV') && !Object.values(input.remap).includes('KeyV')) {
      shell.s.viewMode = shell.s.viewMode === 'first' ? 'third' : 'first'; shell.save(); applySettings(shell.s)
    }
    // first-person eye height follows the pose
    orbit.fpEyeTarget = player.anim.action === 'sit' ? 0.98 : (player.anim.action === 'lie' || player.anim.action === 'sleep') ? 0.5 : 1.42
    player.update(input, orbit.smoothYaw, dt, elapsed)
    handleEmoteWheel() // consumes the look while open, so the camera holds still
    orbit.update(player.pos, player.yaw, jogging, wheelOpen ? [0, 0] : input.consumeLook(), dt, world.interactables)
    if (!wheelOpen) interact.update(input, dt)
    // F0: sleeping beside a dreamer for a slow breath opens the tunnel;
    // standing back up at ANY point (even mid-iris) cancels it — the cozy
    // night never commits you to a fight
    const slAct = player.anim.action
    if ((slAct === 'sleep' || slAct === 'lie') && !dream.active) {
      if (!dreamTunnel.active) {
        const near = npcs.sleepers.find((s) => (s.x - player.pos.x) ** 2 + (s.z - player.pos.z) ** 2 < 3.5 * 3.5)
        if (near) {
          dreamRest += dt
          if (dreamRest > 1.0) { dreamRest = 0; beginDreamEntry(near.id) }
        } else dreamRest = 0
      }
    } else {
      dreamRest = 0
      if (dreamTunnel.active && dreamTunnel.dir === 'in' && dreamTunnel.phase === 'close') dreamTunnel.cancel()
    }
    // the woozy wink (4.1): warm bloom + gentle camera roll, then it passes
    if (winkT > 0) {
      winkT = Math.max(0, winkT - dt * 0.4)
      camera.rotateZ(Math.sin(winkT * Math.PI) * 0.12)
      pipeline.postUniforms.uWarm.value = Math.sin(winkT * Math.PI) * 0.7
    } else if (player.anim.action === 'sit') {
      // sitting keepers get the idle candle-warmth vignette (5.3)
      const u = pipeline.postUniforms.uWarm
      u.value += (0.12 - u.value) * Math.min(1, dt * 1.5)
    } else if (pipeline.postUniforms.uWarm.value > 0) {
      pipeline.postUniforms.uWarm.value = Math.max(0, pipeline.postUniforms.uWarm.value - dt)
    }
  } else {
    // menus/cinematics: world keeps breathing, player idles in place
    if (shell.blocking && !cinematic) hud.hidePrompt()
    player.update(NULL_INPUT, orbit.smoothYaw, dt, elapsed)
  }
  // Q.3: in the wizard's eyes the wizard is not in front of them — and on the
  // way OUT the rig stays hidden until the camera has eased off the head
  rig.group.visible = !((orbit.firstPerson || orbit.curDist < 0.7) && mode === 'game' && !cinematic && !photo.on)
  // staff-lantern glow pulses with footsteps (4.1), settling between strides
  if (rig.staffHalo) {
    staffPulse = Math.max(0, staffPulse - dt * 2.2)
    rig.staffHalo.material.uniforms.uOpacity.value = (rig.staffHaloBase ?? (rig.staffHaloBase = rig.staffHalo.material.uniforms.uOpacity.value)) + staffPulse * 0.22
  }
  nightflow.update(dt, inputActive)
  // clock-driven atmosphere: min-30 warmth ease + lunar-phase fog tightening
  zoneLight.warmBias = (zoneLight.warmBias ?? 0) + ((night.warmBias ?? 0) - (zoneLight.warmBias ?? 0)) * (1 - Math.exp(-dt / 8))
  zoneLight.fogTight = night.fogTight * nightSignature.fogDrift // moon phase × D.1 signature
  if (!cinematic && mode !== 'title' && !photo.on) {
    world.applyWorldRules(player)
    zoneLight.update(player.pos.x, player.pos.z, dt, player.pos.y)
    // C.4: a mosswood/foglands gust tugs the hat for a few seconds at a time
    const gustEnv = Math.max(0, Math.sin(elapsed * 0.23) - 0.82) / 0.18
    player.anim.windGust = (zoneLight.currentZoneId === 'mosswood' || zoneLight.currentZoneId === 'foglands')
      ? gustEnv * (0.55 + 0.45 * Math.sin(elapsed * 1.7)) * nightSignature.gustiness : 0
    // F.2: positional landmark cues track the listener every frame
    if (audio.started) cues.update(player.pos.x, player.pos.z, orbit.smoothYaw + (orbit.revealYawOff ?? 0))
    // music + ambience beds + room acoustics follow the atmosphere's zone
    if (zoneLight.audioZone !== score.zone && audio.started) {
      score.zone = zoneLight.audioZone
      score.activeLayers = zoneKindles(score.zone)
      score.buildZone()
      audio.state.layers = Math.min(score.activeLayers + 1, score.layerGains.length)
      beds.setZone(zoneLight.audioZone)
      audio.setHallAcoustics(zoneLight.audioZone === 'hall')
    }
  } else if (audio.started) {
    cues.duck() // cinematic/title/photo: the bell and organ bow out
    player.anim.windGust = 0 // and the parked rig's hat settles
  }
  // shared bench rest softens the rain's sound as well as its particles
  if ((ambience.rainSoftT > 0) !== rainWasSoft) {
    rainWasSoft = ambience.rainSoftT > 0
    beds.soften(rainWasSoft ? 0.35 : 1)
  }
  // C.2 reveal volumes: first arrival in a hero zone each night borrows the
  // camera for a beat — the landmark introduces itself
  {
    const z = zoneLight.currentZoneId
    if (z !== _prevZone) {
      const LANDMARKS = { village: [137, 4], gloomspire: [-110, 125], isle: [0, -152], mosswood: [84, 110], ruins: [-132, 0], rooftops: [122, -6], hall: [-110, 166] }
      if (LANDMARKS[z] && !_revealed.has(z) && mode === 'game' && !cinematic && !photo.on) {
        _revealed.add(z)
        orbit.reveal(LANDMARKS[z])
      }
      _prevZone = z
    }
  }
  // Rule 1 black floor (AA.3): the zone's fog HUE, saturation pushed, at a
  // fixed faint brightness — screen-blended in the post pass so darkness
  // everywhere reads as the zone's cool color, never grey-black
  {
    const f = _floorC.copy(zoneLight.fog)
    f.getHSL(_floorHSL)
    f.setHSL(_floorHSL.h, Math.min(1, _floorHSL.s * 1.45 + 0.08), _floorHSL.l)
    const peak = Math.max(f.r, f.g, f.b, 0.01)
    pipeline.postUniforms.uFloor.value.copy(f).multiplyScalar(Math.min(0.085 / peak, 1))
  }
  world.moonDir = night.dirWorld
  world.update(dt, elapsed)
  night.update(dt, camera)
  embers.update(dt, camera)
  stars.update(dt, elapsed, camera, zoneLight.currentZoneId)
  ambience.update(dt, camera, zoneLight.currentZoneId, elapsed)
  npcs.update(dt, elapsed, player, camera)
  net.update(dt, camera)
  moments.update(dt, elapsed, !cinematic && mode === 'game') // no new rituals mid-reel
  if (net.role === 'host' && nightflow.ending && !neSent) { neSent = true; net.broadcastEvent({ ev: 'nightEnd' }) }
  updateOverlay(dt)
  input.endFrame()
  pipeline.render(scene, camera, elapsed)
}

// ——— Test surface (MASTER_PROMPT 0.4) ———
// shared pixel-buffer palette analysis (hue circle mean, saturation weight,
// warm/red/green/bright fractions, median luminance) — used by both the
// pre-post RT sample and the AA.3 final-frame sample
function analyzePixels(buf) {
  let hueX = 0, hueY = 0, hueWeight = 0, warm = 0, red = 0, green = 0, bright = 0, n = 0
  const lums = []
  for (let i = 0; i < buf.length; i += 16) {
    const r = buf[i] / 255, g = buf[i + 1] / 255, b = buf[i + 2] / 255
    const max = Math.max(r, g, b), min = Math.min(r, g, b)
    const l = (max + min) / 2
    const s = max === min ? 0 : (max - min) / (1 - Math.abs(2 * l - 1) + 1e-6)
    let hue = 0
    if (max !== min) {
      if (max === r) hue = ((g - b) / (max - min)) % 6
      else if (max === g) hue = (b - r) / (max - min) + 2
      else hue = (r - g) / (max - min) + 4
      hue *= 60
      if (hue < 0) hue += 360
    }
    n++
    lums.push(l)
    if (l > 0.45) bright++
    if (s > 0.12 && l > 0.02) {
      const wgt = s * Math.min(l * 3, 1)
      hueX += Math.cos((hue * Math.PI) / 180) * wgt
      hueY += Math.sin((hue * Math.PI) / 180) * wgt
      hueWeight += wgt
      if (hue > 15 && hue < 60 && s > 0.25 && l > 0.12) warm++
      if ((hue < 15 || hue > 345) && s > 0.28 && l > 0.08) red++
      // green glow reads through violet fog at reduced saturation — threshold
      // tuned for additive-over-fog compositing (documented in JUDGE.md)
      if (hue > 90 && hue < 160 && s > 0.2 && l > 0.12) green++
    }
  }
  lums.sort((a, b) => a - b)
  let avgHue = (Math.atan2(hueY, hueX) * 180) / Math.PI
  if (avgHue < 0) avgHue += 360
  return {
    avgHue: +avgHue.toFixed(1),
    hueStrength: +(hueWeight / n).toFixed(4),
    medianLum: +lums[Math.floor(lums.length / 2)].toFixed(4),
    warmFrac: +(warm / n).toFixed(5),
    redFrac: +(red / n).toFixed(5),
    greenFrac: +(green / n).toFixed(5),
    brightFrac: +(bright / n).toFixed(5),
    sampled: n,
  }
}

window.__MOONREST__ = {
  ready: true,
  seed: worldRNG.seed,
  nightSignature, // D.1: tonight's dealt variations (cosmetic, never gating)
  poses: Object.keys(POSES),
  teleport,
  teleportPlayer(x, z, yaw = 0) {
    endIntro(true)
    if (mode === 'title') { shell.clear(); mode = 'game' } // rigs auto-enter the night
    cinematic = false
    player.pos.set(x, world.heightAt(x, z), z)
    player.yaw = player.targetYaw = yaw
    return true
  },
  startNight(fresh = false) { shell.clear(); return startNight(fresh) },
  skipIntro() { endIntro(true); return true },
  // PRESTIGE B.1 debug commands
  listPostcards() { return (world.postcards ?? []).map((p) => `${p.zone}-${p.idx}`) },
  teleportPostcard(zone, idx = 1) {
    const p = (world.postcards ?? []).find((x) => x.zone === zone && x.idx === idx)
    if (!p) return false
    endIntro(true)
    if (mode === 'title') { shell.clear(); mode = 'game' }
    cinematic = true
    hud.hidePrompt(); hud.clearSubtitle()
    camera.position.set(...p.pos)
    camera.lookAt(...p.look)
    if (p.minute != null) night.skipTo(p.minute)
    zoneLight.update(p.look[0], p.look[2], 10, p.pos[1])
    ambience.snapZone(zoneLight.currentZoneId)
    return true
  },
  shellDebug() {
    return {
      mode, screen: shell.screen, blocking: shell.blocking, photo: photo.on,
      settings: { ...shell.s },
      memory: {
        softBlur: pipeline.postUniforms.uSoftBlur.value, quantize: pipeline.postUniforms.uQuantize.value,
        scanline: pipeline.postUniforms.uScanline.value, chroma: pipeline.postUniforms.uChroma.value,
        wobble: pipeline.postUniforms.uWobble.value, snap: globalUniforms.uSnapEnable.value,
        affine: globalUniforms.uAffineMix.value, rtW: pipeline.rt.width, rtH: pipeline.rt.height,
        dither: pipeline.postUniforms.uDither.value, sharpen: pipeline.postUniforms.uSharpen.value,
        native: pipeline.native, lodBias: globalUniforms.uLodBias.value,
      },
      menuItems: [...document.querySelectorAll('.shell .mi')].map((m) => m.textContent),
      fontsLoaded: !!document.fonts && [...document.fonts].some((f) => /IM Fell|Alegreya/i.test(f.family)),
    }
  },
  setMemoryMode(m) { shell.s.memoryMode = m; shell.save(); applySettings(shell.s); return true },
  openPause() { shell.showPause(); return true },
  togglePhotoMode(v) { togglePhoto(v ?? !photo.on); return photo.on },
  triggerErrorBoundary() { window.dispatchEvent(new ErrorEvent('error', { message: 'rig probe' })); return true },
  releaseCam() { cinematic = false },
  setCamYaw(y) { orbit.yaw = orbit.smoothYaw = y; return true },
  setAction(a) { player.setAction(a); return true },
  viewportDebug() {
    const v4 = new THREE.Vector4()
    pipeline.renderer.getViewport(v4)
    return {
      rendererViewportCSS: v4.toArray(),
      pixelRatio: pipeline.renderer.getPixelRatio(),
      letterboxDevice: pipeline.viewport.toArray(),
      canvasBacking: [canvas.width, canvas.height],
      canvasCSS: [canvas.style.width, canvas.style.height],
      inner: [window.innerWidth, window.innerHeight],
    }
  },
  // forensic: toggle whole subsystems off to bisect a screenshot artifact
  debugHide(kind, v = false) {
    const map = {
      rain: ambience.rain.mesh, rings: ambience.rings.mesh, smoke: ambience.smoke.mesh,
      moths: ambience.moths.mesh, sparkle: ambience.sparkle.mesh, mist: ambience.mist.mesh,
      zzz: ambience.zzz.mesh, leaves: ambience.leaves.mesh, petals: ambience.petals.mesh,
      arcane: ambience.arcane.mesh, spores: ambience.spores.mesh, drips: ambience.drips.mesh,
      stars: stars.mesh, meteor: stars.meteor, streak: world.moonStreak,
      moonface: night.face, flare: night.flare, embers: embers.mesh,
    }
    if (!map[kind]) return Object.keys(map)
    map[kind].visible = v
    return true
  },
  // forensic: everything with a mesh near a world XZ — for hunting mystery
  // geometry in screenshots (type, size, position, material facts)
  sceneCensus(x, z, r = 6) {
    const out = []
    const v = new THREE.Vector3()
    scene.traverse((o) => {
      if (!o.isMesh) return
      o.getWorldPosition(v)
      if (Math.hypot(v.x - x, v.z - z) > r) return
      const p = o.geometry.parameters ?? {}
      out.push({
        geo: o.geometry.type, pos: [+v.x.toFixed(1), +v.y.toFixed(1), +v.z.toFixed(1)],
        size: [p.width ?? p.radiusTop ?? p.radius ?? -1, p.height ?? -1],
        vis: o.visible, op: o.material?.uniforms?.uOpacity?.value ?? o.material?.opacity ?? null,
        blend: o.material?.blending ?? null,
      })
    })
    return out
  },
  collidersNear(x, z, r = 8) {
    return {
      colliders: world.colliders.filter((c) => Math.hypot(c.x - x, c.z - z) < r).map((c) => ({ x: +c.x.toFixed(1), z: +c.z.toFixed(1), r: +c.r.toFixed(2), h: +(c.h ?? 0).toFixed(2), ground: +world.heightAt(c.x, c.z).toFixed(2) })),
      aabbs: world.aabbs.filter((b) => x > b.minX - r && x < b.maxX + r && z > b.minZ - r && z < b.maxZ + r).map((b) => ({ minX: b.minX, maxX: b.maxX, minZ: b.minZ, maxZ: b.maxZ, y0: b.y0, h: b.h })),
    }
  },
  worldDebug() {
    return {
      greenWindows: world.greenWindows?.length ?? -1,
      nebula: world.nebula?.length ?? -1,
      bats: world.bats?.length ?? -1,
      crystals: world.crystals?.length ?? -1,
      fogCards: world.fogCards?.length ?? -1,
      hallMeshes: world.hallMeshes?.length ?? -1,
      lights: world.lights.length,
      firstGreenPos: world.greenWindows?.[0] ? world.greenWindows[0].mesh.position.toArray() : null,
      firstGreenVisible: world.greenWindows?.[0]?.mesh.visible ?? null,
      firstGreenOpacity: world.greenWindows?.[0]?.mesh.material.uniforms.uOpacity.value ?? null,
    }
  },
  npcDebug() {
    return {
      beldam: npcs.beldam ? npcs.beldam.rig.group.position.toArray().map((v) => +v.toFixed(1)) : null,
      nib: npcs.nib ? npcs.nib.rig.group.position.toArray().map((v) => +v.toFixed(1)) : null,
      cat: npcs.cat ? npcs.cat.group.position.toArray().map((v) => +v.toFixed(1)) : null,
      chickens: npcs.chickens ? npcs.chickens.map((c) => ({ s: c.state, p: c.rig.group.position.toArray().map((v) => +v.toFixed(1)) })) : null,
    }
  },
  boneDebug() {
    return {
      action: player.anim.action,
      armLx: +rig.bones.armL.rotation.x.toFixed(2),
      hipsY: +rig.bones.hips.position.y.toFixed(2),
      legLx: +rig.bones.legL.rotation.x.toFixed(2),
    }
  },
  kindle(id) { return net.active ? net.requestKindle(id) : world.kindle(id, { remote: true }) }, // rig path: no C.4 head-yank
  // ——— DREAMSCRAP test surface (DECISIONS #8: tick-measured feel gates) ———
  fight: {
    enter(arena = 'beldam', players = 2, stocks = null, fids = null) { endIntro(true); if (mode === 'title') { shell.clear(); mode = 'game' } return dream.enter(arena, players, input, { ...(stocks ? { stocks } : {}), ...(fids ? { fids } : {}) }) },
    exit() { return dream.exit() },
    get active() { return dream.active },
    get manual() { return dream.manual },
    step(inputsById = {}) { return dream.stepManual(inputsById) },
    state() { return dream.simState() },
    charge(id = 0) { const f = dream.match?.fighters?.[id]; if (f) f.deep = 100; return !!f }, // gate rig: full lantern
    botDuel(a = 'lucid', b = 'dozy', ticks = 14400) { return dream.botDuel(a, b, ticks) },
    get lastShake() { return dream.lastShake ?? null },
  },
  // — F0 entry/exit test surface (tunnel timing is wall-clock, not ticks) —
  f0: {
    sleepers: () => npcs.sleepers,
    pos: () => [+player.pos.x.toFixed(3), +player.pos.y.toFixed(3), +player.pos.z.toFixed(3)],
    emote: (id) => { doEmote(id); return true },
    tunnel: () => (dreamTunnel.active ? { phase: dreamTunnel.phase, dir: dreamTunnel.dir, t: +dreamTunnel.t.toFixed(3) } : null),
    rest: () => +dreamRest.toFixed(3),
    dreamFound: () => !!shell.s.dreamFound,
  },
  skipTo(min) { night.skipTo(min); return true },
  autopilot() { return autopilot() },
  setPhase(age) { night.setPhase(age); return true },
  suppressNightEnd(v) { window.__SUPPRESS_NIGHT_END__ = !!v; return true }, // screenshot rigs only
  takeBrew(id) { return world.takeBrew(id) },
  // — co-op test surface (Part 5 / 12.1 M7) —
  hostNight(name) { return net.host(name) },
  joinNight(code, name) { return net.join(code, name) },
  leaveNight() { net.leave(); return true },
  netDebug() {
    return {
      role: net.role, code: net.code, myId: net.myId, peers: net.peerCount,
      roster: [...net.roster].map(([id, r]) => ({ id, ...r })),
      remotes: [...net.remotes].map(([id, rp]) => ({
        id, name: rp.name, action: rp.action, fading: rp.fading > 0,
        pos: rp.pos.toArray().map((v) => +v.toFixed(2)),
        visible: rp.rig.group.visible, scale: +rp.rig.group.scale.x.toFixed(2),
      })),
      channeling: [...net.channeling],
      log: net.log,
    }
  },
  momentsDebug() {
    return {
      done: [...moments.done],
      log: moments.log,
      glyphs: world.ruinsGlyphs?.map((g) => ({ x: +g.x.toFixed(1), z: +g.z.toFixed(1), occupied: !!g.occupied, visible: g.mesh.visible, lit: +g.lit.toFixed(2) })),
      beamT: +moments.beamT.toFixed(2),
      gargoyleWaveT: +(npcs.gargoyle?.waveT ?? 0).toFixed(2),
      gargoylePos: npcs.gargoyle ? npcs.gargoyle.rig.group.position.toArray().map((v) => +v.toFixed(1)) : null,
      benchPos: world.benchPos.toArray().map((v) => +v.toFixed(1)),
      thronePos: world.thronePos ? world.thronePos.toArray().map((v) => +v.toFixed(1)) : null,
      catState: npcs.ghostCat?.state,
      chickenStates: npcs.chickens.map((c) => c.state),
      rainSoftT: +ambience.rainSoftT.toFixed(1),
    }
  },
  netChan(id, on) { net.request({ ev: 'chan', id, on }); return true }, // co-op gate only
  get beats() { return progress.beats },
  get nightLog() { return nightflow.log },
  get stirLog() { return npcs.stirLog ?? [] },
  get trinkets() { return progress.trinkets },
  bootAudio() { bootAudio(); return audio.started },
  get lights() { return world.lights.map((l) => ({ id: l.id, zone: l.zone, kindled: l.kindled, x: l.x, z: l.z })) },
  // AA.5 wander-test surface: everything actionable or discoverable a walker
  // can "surface" — interactables (lights/brews), foglands breadcrumbs +
  // fingerposts, and the sleepers themselves
  get pois() {
    const out = world.interactables.map((i) => ({ kind: i.kind, x: i.x, z: i.z }))
    for (const c of world.crumbs ?? []) out.push({ kind: 'crumb', x: c[0], z: c[1] })
    for (const sp of world.signposts ?? []) out.push({ kind: 'sign', x: sp.x, z: sp.z })
    for (const b of world.benches ?? []) out.push({ kind: 'bench', x: b[0], z: b[1] })
    for (const m of world.memorials ?? []) out.push({ kind: 'memorial', x: m[0], z: m[1] })
    for (const s of npcs.anchors ?? []) out.push({ kind: 'sleeper', x: s.x, z: s.z })
    return out
  },
  // rig debug: a light's dynamic parts (flame/halo/pool/glass/pilot) state
  lightDebug(id) {
    const l = world.lights.find((x) => x.id === id)
    if (!l) return null
    const part = (p) => p ? { visible: p.visible, opacity: p.material?.uniforms?.uOpacity?.value ?? null, pos: p.getWorldPosition(new THREE.Vector3()).toArray().map((v) => +v.toFixed(2)) } : null
    return { id: l.id, kindled: l.kindled, bloom: l.bloom, flame: part(l.parts.flame), halo: part(l.parts.halo), pool: part(l.parts.pool), glass: part(l.parts.glass), pilot: part(l.pilot) }
  },
  get interactLog() { return interact.log },
  setPost(patch) {
    for (const [k, v] of Object.entries(patch)) {
      if (pipeline.postUniforms[k] !== undefined) pipeline.postUniforms[k].value = v
    }
  },
  sampleFrame() {
    return pipeline.sampleFrame(scene, camera, '#' + zoneLight.fog.getHexString())
  },
  // Palette statistics from the pre-post RT (hue gate evidence, Part 12.1 M4)
  samplePalette() {
    const { renderer, rt } = pipeline
    renderer.setRenderTarget(rt)
    renderer.clear()
    renderer.render(scene, camera)
    const w = rt.width, h = rt.height
    const buf = new Uint8Array(w * h * 4)
    renderer.readRenderTargetPixels(rt, 0, 0, w, h, buf)
    renderer.setRenderTarget(null)
    return analyzePixels(buf)
  },
  // AA.3: palette of the FINAL frame (post pass included — floor, quantize,
  // gamma). Reads the default framebuffer right after a full pipeline render,
  // cropped to the letterbox viewport.
  samplePaletteFinal() {
    pipeline.render(scene, camera, elapsed)
    const gl = pipeline.renderer.getContext()
    const v = pipeline.viewport
    const w = Math.max(2, Math.round(v.z)), h = Math.max(2, Math.round(v.w))
    const buf = new Uint8Array(w * h * 4)
    gl.readPixels(Math.round(v.x), Math.round(v.y), w, h, gl.RGBA, gl.UNSIGNED_BYTE, buf)
    return analyzePixels(buf)
  },
  get state() {
    const fps = frameTimes.length ? frameTimes.length / frameTimes.reduce((a, b) => a + b, 0) : 0
    return {
      playerPos: [+player.pos.x.toFixed(2), +player.pos.y.toFixed(2), +player.pos.z.toFixed(2)],
      playerYaw: +player.yaw.toFixed(2),
      gait: player.anim.gait,
      action: player.anim.action,
      speed: +player.anim.speed.toFixed(2),
      surface: player.surface,
      zone: zoneLight.currentZoneId,
      audioZone: zoneLight.audioZone,
      fogColor: '#' + zoneLight.fog.getHexString(),
      fogFar: +zoneLight.fogFar.toFixed(1),
      nightT: +night.minutes.toFixed(2),
      kindled: world.kindledIds,
      peers: net.peerCount,
      netRole: net.role,
      roomCode: net.code,
      audio: {
        started: audio.started,
        layers: audio.state.layers,
        muted: audio.state.muted,
        rms: audio.started ? { music: +audio.rms('music').toFixed(4), sfx: +audio.rms('sfx').toFixed(4), ambience: +audio.rms('ambience').toFixed(4) } : null,
        cues: cues.started ? { bell: cues.bell?.debug, organ: cues.organ?.debug } : null, // F.2 pan/gain evidence
      },
      fps: Math.round(fps),
      fov: +camera.fov.toFixed(1),
      introT: intro.active && !intro.done ? +intro.t.toFixed(1) : null, // H.1 capture rig
      camDist: +orbit.curDist.toFixed(2), // C.2 doorway-snap evidence
      viewMode: orbit.firstPerson ? 'first' : 'third', // Q.3
      rigVisible: rig.group.visible,

      brews: world.brewCount,
      trinketCount: progress.trinkets.length,
      moonPhase: +night.illum.toFixed(3),
      nightEnded: nightflow.ending,
      attract: nightflow.attract,
      giggleUnlocked: elapsed < giggleUntil,
      latency: player.latencyLog.slice(-5),
      triCountAvatar: rig.triCount,
      drawCalls: pipeline.lastInfo?.calls ?? 0,
      triangles: pipeline.lastInfo?.triangles ?? 0,
      bootMs: Math.round(BOOT_MS),
      textureGenMs: Math.round(TEX.textureGenMs),
    }
  },
}

// ——— F3 dev overlay (Part 11): fps, calls, tris, zone, nightT — dev only ———
const overlay = document.createElement('div')
overlay.className = 'devoverlay'
document.getElementById('ui').appendChild(overlay)
let overlayOn = false
let overlayAcc = 0
window.addEventListener('keydown', (e) => {
  if (e.code === 'F3') {
    e.preventDefault()
    overlayOn = !overlayOn
    overlay.classList.toggle('on', overlayOn)
  }
})
function updateOverlay(dt) {
  if (!overlayOn) return
  overlayAcc += dt
  if (overlayAcc < 0.25) return
  overlayAcc = 0
  const s = window.__MOONREST__.state
  overlay.textContent = `fps ${s.fps} · calls ${s.drawCalls} · tris ${s.triangles} · ${s.zone} · nightT ${s.nightT}`
}

// ——— Debug autopilot (12.1 M6): teleport-hop the full night, kindle all 37,
// collect all 12 brews, finish on the keep brazier → Night's End ———
async function autopilot() {
  if (window.__AUTOPILOT_RUNNING__) return false
  window.__AUTOPILOT_RUNNING__ = true
  if (mode === 'title') { shell.clear(); mode = 'game' }
  const wait = (ms) => new Promise((r) => setTimeout(r, ms))
  const M = window.__MOONREST__
  const zonesFirst = ['park', 'village', 'rooftops', 'ruins', 'gloomspire', 'hall', 'mosswood']
  for (const zone of zonesFirst) {
    for (const l of world.lights.filter((x) => x.zone === zone)) {
      M.teleportPlayer(l.x + 1.2, l.z, 0)
      await wait(110)
      world.kindle(l.id)
      await wait(110)
    }
  }
  for (const b of world.brews) {
    if (b.taken) continue
    M.teleportPlayer(b.x + 0.5, b.z, 0)
    await wait(90)
    world.takeBrew(b.id)
    await wait(70)
  }
  // the isle last — its keep-top brazier is the night's final light
  for (const l of world.lights.filter((x) => x.zone === 'isle')) {
    M.teleportPlayer(l.x + 1.2, l.z, 0)
    await wait(110)
    world.kindle(l.id)
    await wait(140)
  }
  return true
}

const BOOT_MS = performance.now() - BOOT_T0
tick()
