// FIN-1 — the real lighting rig (TOOLKIT §1.2 / DIRECTION Part 6).
//
// The old world had NO realtime lights at all: retroMaterial baked a flat
// `uAmbient` tint into a raw ShaderMaterial and painted fog by hand. That is
// why every surface reads equally lit from every angle — there is no direction
// to the light, so there is no form.
//
// This is the whole rig, and it is deliberately tiny:
//   1 DirectionalLight  — the moon. The ONLY shadow caster in the game.
//   1 HemisphereLight   — sky fill from above, bounced ground tint from below.
//   everything else     — emissive materials + bloom. No extra lights.
//
// Two laws from DIRECTION Part 6 are enforced here rather than left to taste:
//   · shade is never black — the hemisphere's ground term is clamped to a
//     minimum blue/violet so unlit faces stay COLOURED, not crushed;
//   · warm light is scarce — the moon is cold, and the only warm sources in
//     the world are the lantern emitters, which are emissive, not lights.

import * as THREE from 'three'

// Moonlight is cold and soft-white with a blue bias (palette: soft white
// #E8E4FF pulled toward haze blue #4A5D78).
const MOON_COLOR = new THREE.Color('#C8D2F0')
// The floor colour for shade. DIRECTION Part 6: "tinted shade, never black."
// This is a *minimum* — the zone's own fog colour wins when it is brighter.
// Measured, not chosen: at #1B2138 the Park crushed 21.6% of its pixels to
// pure black and the Village 40.5% (scripts/composecheck.mjs). Night is
// FILL-dominated — the sky is the big light source and the moon is a rim —
// so the floor has to carry real luminance, not just a hint of hue.
const SHADE_FLOOR = new THREE.Color('#2E3A63')
// The SKY term needs a floor too. Flooring only the ground colour was the bug
// that survived the first rebalance: an up-facing surface in the moon's shadow
// takes pure skyColor, so a dark zone skyUp put the whole shadow into black no
// matter how high the fill intensity went.
const SKY_FLOOR = new THREE.Color('#44577A')

// Fallback direction if the Night system has not produced one yet. In play the
// key light TRACKS the visible moon (night.dirWorld) — the sky and the shading
// must agree or the whole frame reads as a painted backdrop.
const MOON_DIR = new THREE.Vector3(-0.42, 0.78, 0.46).normalize()

// The visible moon sets to ~2° above the horizon by dawn. Lighting from there
// gives shadows that are effectively infinite and blow out the ortho box, so
// the KEY is clamped to a floor while the sky moon keeps sinking. Shadows
// still lengthen hugely across the night — they just stay on the map.
const MIN_ELEV = 0.20

const _d = new THREE.Vector3()

// How far the player can walk before the shadow map is re-rendered. With
// shadowMap.autoUpdate = false the map is otherwise frozen, which is the point
// — a static map costs nothing per frame. Snapping to a grid stops the
// shadow texels from crawling as the camera moves (the classic CSM shimmer).
const SHADOW_STEP = 8
const SHADOW_RADIUS = 46

export class MoonRig {
  constructor(scene, renderer) {
    this.scene = scene
    this.renderer = renderer

    const moon = new THREE.DirectionalLight(MOON_COLOR.clone(), 1.9)
    moon.castShadow = true
    // PCFSoftShadowMap is deprecated as of r186 (TOOLKIT §1.2) — PCFShadowMap
    // plus a generous radius is the supported soft-edge route now.
    moon.shadow.mapSize.set(2048, 2048)
    moon.shadow.radius = 2.4
    // normalBias, NOT bias: it offsets along the surface normal, which kills
    // shadow acne on curved and bevelled geometry without the peter-panning a
    // constant depth bias causes. §1.2 recommends 0.02–0.05.
    moon.shadow.normalBias = 0.035
    moon.shadow.bias = -0.0005
    const c = moon.shadow.camera
    c.left = -SHADOW_RADIUS; c.right = SHADOW_RADIUS
    c.top = SHADOW_RADIUS; c.bottom = -SHADOW_RADIUS
    c.near = 1; c.far = 220
    c.updateProjectionMatrix()
    moon.target.position.set(0, 0, 0)
    scene.add(moon)
    scene.add(moon.target)
    this.moon = moon

    // Sky above, bounced ground below. This is what stops the unlit side of
    // every object from going to zero — it is the "tinted shade" law made
    // literal, and it costs one light.
    const hemi = new THREE.HemisphereLight('#4A5D78', '#1B2138', 0.55)
    scene.add(hemi)
    this.hemi = hemi

    // Fog is now three's fog, evaluated inside the lit materials, so it
    // composites AFTER lighting instead of being hand-mixed at the end.
    scene.fog = new THREE.Fog('#274550', 8, 60)

    // live tuning knobs (window.__MOONREST__.tune) — the grade is measured
    // against scripts/composecheck.mjs, and sweeping in one browser session
    // beats a rebuild per guess
    this.moonScale = 1
    this.hemiScale = 1
    this._lastShadowX = Infinity
    this._lastShadowZ = Infinity
    this._lastDir = new THREE.Vector3(0, 1, 0)
    if (renderer) {
      renderer.shadowMap.enabled = true
      renderer.shadowMap.type = THREE.PCFShadowMap
      renderer.shadowMap.autoUpdate = false
      renderer.shadowMap.needsUpdate = true
    }
  }

  // Driven from ZoneLight.push() so the rig always reads the SAME blended
  // state the sky and fog do — one source of truth, no second interpolator to
  // drift out of sync.
  push(zl) {
    const fog = zl.fog, sky = zl.skyUp, amb = zl.ambient

    // three's fog, matched to the sky horizon stop (Rule 3 by construction).
    if (this.scene.fog) {
      this.scene.fog.color.copy(fog)
      this.scene.fog.near = zl.fogNear
      this.scene.fog.far = zl.fogFar * (zl.fogTight ?? 1)
    }

    // The moon takes a *hint* of the zone's ambient hue so a green-tinted
    // grove and a blue-tinted lake do not get identical key light — but only a
    // hint, because a warm moon would spend the accent budget (Rule 2).
    this.moon.color.copy(MOON_COLOR).lerp(amb, 0.22)
    // Zone brightness scales the key. `ambient` used to BE the lighting, so
    // its luminance is a good proxy for how bright the designer wanted a zone.
    const lum = 0.299 * amb.r + 0.587 * amb.g + 0.114 * amb.b
    // Key:fill was inverted in the first lit build — a bright moon over a
    // near-zero fill gave an ~80:1 range that AgX turned into silhouettes on
    // white. Real night vision is compressed. The moon now shapes; it does not
    // carry the frame.
    this.moon.intensity = (0.55 + 0.75 * THREE.MathUtils.clamp(lum, 0, 1)) * this.moonScale

    this.hemi.color.copy(sky)
    const sc = this.hemi.color
    sc.r = Math.max(sc.r, SKY_FLOOR.r)
    sc.g = Math.max(sc.g, SKY_FLOOR.g)
    sc.b = Math.max(sc.b, SKY_FLOOR.b)
    // Shade floor: take the zone fog, but never let any channel fall below the
    // violet floor. max() per channel, so a bright zone keeps its own colour
    // and a very dark one is lifted into blue instead of into black.
    const g = this.hemi.groundColor
    g.copy(fog)
    g.r = Math.max(g.r, SHADE_FLOOR.r)
    g.g = Math.max(g.g, SHADE_FLOOR.g)
    g.b = Math.max(g.b, SHADE_FLOOR.b)
    this.hemi.intensity = (1.7 + 1.2 * THREE.MathUtils.clamp(lum, 0, 1)) * this.hemiScale
  }

  // Follow the player with the shadow volume, and follow the sky with the key
  // direction. Called once per frame; actually re-renders the shadow map only
  // when the player has left the current cell or the moon has visibly moved.
  follow(px, py, pz, dirWorld) {
    _d.copy(dirWorld ?? MOON_DIR)
    // clamp elevation without changing the compass bearing, so the shadows
    // swing around the world exactly as the visible moon does
    const horiz = Math.hypot(_d.x, _d.z) || 1e-6
    const elev = Math.atan2(_d.y, horiz)
    if (elev < MIN_ELEV) {
      const s = Math.cos(MIN_ELEV) / horiz
      _d.set(_d.x * s, Math.sin(MIN_ELEV), _d.z * s)
    }
    _d.normalize()

    const sx = Math.round(px / SHADOW_STEP) * SHADOW_STEP
    const sz = Math.round(pz / SHADOW_STEP) * SHADOW_STEP
    // 0.999 ≈ 2.5° of moon travel — about one update per real-world minute at
    // the night's sweep rate, which is far below the threshold of noticing.
    const moved = sx !== this._lastShadowX || sz !== this._lastShadowZ
    const swung = _d.dot(this._lastDir) < 0.999
    if (!moved && !swung) return false

    this._lastShadowX = sx
    this._lastShadowZ = sz
    this._lastDir.copy(_d)
    this.moon.target.position.set(sx, 0, sz)
    this.moon.target.updateMatrixWorld()
    this.moon.position.set(sx + _d.x * 120, py + _d.y * 120, sz + _d.z * 120)
    this.moon.updateMatrixWorld()
    if (this.renderer) this.renderer.shadowMap.needsUpdate = true
    return true
  }

  // Opt meshes into the shadow pass. A light with nothing flagged casts
  // nothing, so this is not optional bookkeeping — it is half the rig.
  //
  // The test is the material tag set by litMaterial(), which means sky, stars,
  // water, particles and every additive glow quad are excluded BY
  // CONSTRUCTION: they never went through the lit path, so they can never be
  // flagged. Returns the counts so a gate can assert the rig is actually wired
  // rather than trusting that it ran.
  applyShadows(root = this.scene) {
    let cast = 0, recv = 0
    root.traverse((o) => {
      if (!o.isMesh || o.userData.__shadowed) return
      const m = o.material
      const mats = Array.isArray(m) ? m : [m]
      if (!mats.some((x) => x?.userData?.lit)) return
      o.userData.__shadowed = true
      // an emitter receiving a shadow would mean a lantern flame going dim
      // because a tree is in front of the moon
      if (mats.some((x) => x?.userData?.emitter)) return
      o.receiveShadow = true
      recv++
      if (mats.every((x) => x?.userData?.castable)) { o.castShadow = true; cast++ }
    })
    if (cast || recv) this.invalidate()
    return { cast, recv }
  }

  // Force a shadow re-render — used after the world streams new geometry in,
  // and by the screenshot harness so a frozen map never poses for a shot.
  invalidate() {
    this._lastShadowX = Infinity
    this._lastShadowZ = Infinity
    if (this.renderer) this.renderer.shadowMap.needsUpdate = true
  }
}
