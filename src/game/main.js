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
import { audio } from './audio/engine.js'
import { score } from './audio/score.js'
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
const embers = new ParticleSystem(scene, { tex: TEX.glowDot({ color: '#ffb45e' }), max: 220, additive: true })
const stars = new Stars(scene)
const ambience = new Ambience(scene, world)

// player
const rig = buildWizard({ tint: PLAYER_TINTS[0] })
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
const npcs = new NPCSystem(scene, world, hud, ambience)

// footsteps synced to stride (Part 4.2)
player.onFootstep = (surface, vol) => footstep(surface, vol)

const zoneKindles = (zone) => world.lights.filter((l) => l.zone === zone && l.kindled).length

// kindle consequences: chime in zone key, ember burst, next music layer (6.1)
world.onKindle = (light) => {
  kindleChime(light.zone)
  emberBurst(embers, light.x, light.y, light.z, worldRNG.fork('embers' + light.id))
  if (light.zone === score.zone) score.setLayers(zoneKindles(light.zone))
  npcs.onKindle(light)
}

// audio boots on first real gesture (autoplay policy)
function bootAudio() {
  if (audio.started) return
  audio.start()
  audio.state.zoneKey = 'D'
  score.start()
}
window.addEventListener('keydown', bootAudio, { once: false })
window.addEventListener('mousedown', bootAudio, { once: false })

// ——— Shoot-rig camera poses (Part 3 per-zone, defined by the world) ———
const POSES = world.poses

let cinematic = false
function teleport(poseName) {
  const p = POSES[poseName]
  if (!p) return false
  cinematic = true
  hud.hidePrompt() // no HUD in cinematic frames (12.5)
  hud.clearSubtitle()
  camera.position.set(...p.pos)
  camera.lookAt(...p.look)
  // atmosphere follows the viewed zone, not the parked player
  // (XZ from the look target; Y from the camera, so elevation-gated zones
  //  like the rooftops only claim shots taken from up there)
  zoneLight.update(p.look[0], p.look[2], 10, p.pos[1])
  ambience.snapZone(zoneLight.currentZoneId)
  return true
}

// ——— Loop ———
let lastNow = performance.now()
let elapsed = 0
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

  if (!cinematic) {
    const jogging = input.down('ShiftLeft', 'ShiftRight') && player.anim.speed > 2
    player.update(input, orbit.smoothYaw, dt, elapsed)
    orbit.update(player.pos, player.yaw, jogging, input.consumeLook(), dt, world.interactables)
    interact.update(input, dt)
  } else {
    // world keeps breathing behind fixed cameras; player idles in place
    player.update({ moveAxis: () => [0, 0], pressed: () => false, down: () => false, endFrame: () => {} }, orbit.smoothYaw, dt, elapsed)
  }
  if (!cinematic) {
    world.applyWorldRules(player)
    zoneLight.update(player.pos.x, player.pos.z, dt, player.pos.y)
    // music follows the atmosphere's zone
    if (zoneLight.audioZone !== score.zone && audio.started) {
      score.zone = zoneLight.audioZone
      score.activeLayers = zoneKindles(score.zone)
      score.buildZone()
      audio.state.layers = Math.min(score.activeLayers + 1, score.layerGains.length)
    }
  }
  world.moonDir = night.dirWorld
  world.update(dt, elapsed)
  night.update(dt, camera)
  embers.update(dt, camera)
  stars.update(dt, elapsed, camera, zoneLight.currentZoneId)
  ambience.update(dt, camera, zoneLight.currentZoneId, elapsed)
  npcs.update(dt, elapsed, player)
  input.endFrame()
  pipeline.render(scene, camera, elapsed)
}

// ——— Test surface (MASTER_PROMPT 0.4) ———
window.__MOONREST__ = {
  ready: true,
  seed: worldRNG.seed,
  poses: Object.keys(POSES),
  teleport,
  teleportPlayer(x, z, yaw = 0) {
    cinematic = false
    player.pos.set(x, world.heightAt(x, z), z)
    player.yaw = player.targetYaw = yaw
    return true
  },
  releaseCam() { cinematic = false },
  setCamYaw(y) { orbit.yaw = orbit.smoothYaw = y; return true },
  setAction(a) { player.setAction(a); return true },
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
  kindle(id) { return world.kindle(id) },
  skipTo(min) { night.skipTo(min); return true },
  autopilot: () => false, // M6
  bootAudio() { bootAudio(); return audio.started },
  get lights() { return world.lights.map((l) => ({ id: l.id, kindled: l.kindled, x: l.x, z: l.z })) },
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
      peers: 0,
      audio: {
        started: audio.started,
        layers: audio.state.layers,
        muted: audio.state.muted,
        rms: audio.started ? { music: +audio.rms('music').toFixed(4), sfx: +audio.rms('sfx').toFixed(4), ambience: +audio.rms('ambience').toFixed(4) } : null,
      },
      fps: Math.round(fps),
      fov: +camera.fov.toFixed(1),
      latency: player.latencyLog.slice(-5),
      triCountAvatar: rig.triCount,
      drawCalls: pipeline.lastInfo?.calls ?? 0,
      triangles: pipeline.lastInfo?.triangles ?? 0,
      bootMs: Math.round(BOOT_MS),
      textureGenMs: Math.round(TEX.textureGenMs),
    }
  },
}

const BOOT_MS = performance.now() - BOOT_T0
tick()
