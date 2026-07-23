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
import { audio } from './audio/engine.js'
import { score } from './audio/score.js'
import { footstep, kindleChime } from './audio/sfx.js'
import * as TEX from './art/textures.js'
import { worldRNG } from './core/rng.js'

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

// footsteps synced to stride (Part 4.2)
player.onFootstep = (surface, vol) => footstep(surface, vol)

// kindle consequences: chime in zone key, ember burst, next music layer (6.1)
world.onKindle = (light) => {
  kindleChime(light.zone)
  emberBurst(embers, light.x, light.y, light.z, worldRNG.fork('embers' + light.id))
  score.setLayers(world.kindledCount)
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

// ——— Shoot-rig camera poses (Part 3 per-zone; grows in M3) ———
const POSES = {
  // low 3/4 angle framing bench + lamp + path receding into fog
  park: { pos: [7.5, 1.3, -13.5], look: [1.5, 1.1, -20.2] },
  // close on the Lamplighter at spawn (M1 silhouette check)
  player: { pos: [4.8, 1.1, -16.2], look: [2.6, 0.9, -18.4] },
}

let cinematic = false
function teleport(poseName) {
  const p = POSES[poseName]
  if (!p) return false
  cinematic = true
  camera.position.set(...p.pos)
  camera.lookAt(...p.look)
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
  world.update(dt, elapsed)
  night.update(dt, camera)
  embers.update(dt, camera)
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
  setAction(a) { player.setAction(a); return true },
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
    return pipeline.sampleFrame(scene, camera, ZONES.park.fog)
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
      zone: 'park',
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
    }
  },
}

tick()
