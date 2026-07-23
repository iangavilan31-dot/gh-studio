// World (M1: Gloaming Park graybox per MASTER_PROMPT 3.2.1). Owns terrain
// height/surface queries, colliders, animated bits (flames, halos), and the
// growing shoot-rig pose list. Zones expand in M3.

import * as THREE from 'three'
import { retroMaterial, ensureVertexColors } from '../art/materials.js'
import * as TEX from '../art/textures.js'
import { tree, lampPost, bench, fireflyJar, sharedMats } from '../art/meshes.js'
import { worldRNG } from '../core/rng.js'

export class World {
  constructor(scene, camera) {
    this.scene = scene
    this.camera = camera
    this.colliders = []      // { x, z, r, h }
    this.interactables = []  // { id, x, z, kind }
    this.flames = []         // { mesh, tex, frame, acc } sprite animation
    this.halos = []          // billboards to face camera
    this.lights = []         // cold-light registry: { id, zone, x, z, y, parts, kindled, bloom }
    this.onKindle = null     // main wires chime/embers/score here
    this.buildPark()
  }

  // — cold lights (the kindling objectives, 6.1) —
  registerLight(id, zone, lampParts, x, z) {
    const y = this.heightAt(x, z)
    this.lights.push({
      id, zone, x, z,
      y: y + (lampParts.flameH ?? 3.2),
      parts: lampParts,
      kindled: false,
      bloom: 0,
      flickerSeed: worldRNG.range(0, Math.PI * 2),
      haloBase: lampParts.halo ? lampParts.halo.material.uniforms.uOpacity.value : 0.55,
      poolBase: lampParts.pool ? lampParts.pool.material.uniforms.uOpacity.value : 0.4,
      glassBase: lampParts.glass ? lampParts.glass.material.uniforms.uOpacity.value : 0.45,
    })
    this.interactables.push({ id, x, z, kind: 'light' })
    if (lampParts.flame) this.flames.push({ mesh: lampParts.flame, tex: lampParts.flame.material.uniforms.uMap.value, frame: worldRNG.int(0, 3), acc: worldRNG.range(0, 0.12) })
    if (lampParts.halo) this.halos.push(lampParts.halo)
  }

  get kindledCount() { return this.lights.filter((l) => l.kindled).length }
  get kindledIds() { return this.lights.filter((l) => l.kindled).map((l) => l.id) }

  kindle(id) {
    const light = this.lights.find((l) => l.id === id)
    if (!light || light.kindled) return false
    light.kindled = true
    light.bloom = 0.0001 // bloom ramp starts
    const p = light.parts
    if (p.flame) p.flame.visible = true
    if (p.halo) { p.halo.visible = true; p.halo.material.uniforms.uOpacity.value = 0 }
    if (p.pool) { p.pool.visible = true; p.pool.material.uniforms.uOpacity.value = 0 }
    if (p.glass) { p.glass.visible = true; p.glass.material.uniforms.uOpacity.value = 0 }
    if (this.onKindle) this.onKindle(light)
    return true
  }

  // — terrain —
  heightAt(x, z) {
    // gentle park undulation; the path ring area is flattened
    let h = 0.45 * Math.sin(x * 0.07) * Math.cos(z * 0.08) + 0.3 * Math.sin((x + z) * 0.045)
    const r = Math.hypot(x, z)
    const pathBand = Math.abs(r - 18)
    if (pathBand < 3) h *= 0.35 + 0.65 * (pathBand / 3) // settle the loop path
    return h
  }
  surfaceAt(x, z) {
    const r = Math.hypot(x, z)
    return Math.abs(r - 18) < 1.8 ? 'dirt' : 'grass'
  }

  collide(pos, radius) {
    // world bounds: stay inside the park clearing for now
    const maxR = 30
    const d = Math.hypot(pos.x, pos.z)
    if (d > maxR) { pos.x *= maxR / d; pos.z *= maxR / d }
    for (const c of this.colliders) {
      const dx = pos.x - c.x, dz = pos.z - c.z
      const dist = Math.hypot(dx, dz)
      const min = c.r + radius
      if (dist < min && dist > 0.0001) {
        pos.x = c.x + (dx / dist) * min
        pos.z = c.z + (dz / dist) * min
      }
    }
  }

  cameraBlocked(x, y, z, r) {
    for (const c of this.colliders) {
      if (y > this.heightAt(c.x, c.z) + c.h) continue
      if (Math.hypot(x - c.x, z - c.z) < c.r + r) return true
    }
    return false
  }

  addCollider(obj, x, z) {
    const c = obj.userData?.collider
    if (c) this.colliders.push({ x, z, r: c.r, h: c.h })
  }

  place(group, x, z, rotY = 0) {
    group.position.set(x, this.heightAt(x, z), z)
    group.rotation.y = rotY
    this.scene.add(group)
    this.addCollider(group, x, z)
    return group
  }


  buildPark() {
    const rng = worldRNG.fork('park')

    // ground: displaced plane, grass texture
    const groundGeo = new THREE.PlaneGeometry(90, 90, 72, 72)
    groundGeo.rotateX(-Math.PI / 2)
    {
      const p = groundGeo.getAttribute('position')
      for (let i = 0; i < p.count; i++) p.setY(i, this.heightAt(p.getX(i), p.getZ(i)))
      groundGeo.computeVertexNormals()
    }
    const grassTex = TEX.grass()
    grassTex.repeat.set(26, 26)
    ensureVertexColors(groundGeo)
    this.ground = new THREE.Mesh(groundGeo, retroMaterial({ map: grassTex }))
    this.scene.add(this.ground)

    // dirt path loop (ring, radius 18, width ~3.4)
    const ringGeo = new THREE.RingGeometry(16.3, 19.7, 56, 1)
    ringGeo.rotateX(-Math.PI / 2)
    {
      const p = ringGeo.getAttribute('position')
      for (let i = 0; i < p.count; i++) p.setY(i, this.heightAt(p.getX(i), p.getZ(i)) + 0.04)
    }
    const dirtTex = TEX.dirt()
    dirtTex.repeat.set(20, 3)
    ensureVertexColors(ringGeo)
    const ring = new THREE.Mesh(ringGeo, retroMaterial({ map: dirtTex }))
    this.scene.add(ring)

    // trees ringing the clearing (12+), one biggest at north for the Long Bench
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2 + rng.range(-0.12, 0.12)
      const r = rng.range(23, 28)
      const t = tree({ rng, height: rng.range(5, 7), trunkR: rng.range(0.45, 0.7), canopyR: rng.range(3.6, 5) })
      this.place(t, Math.cos(a) * r, Math.sin(a) * r, rng.range(0, Math.PI * 2))
    }
    // the largest tree + Long Bench + lamp (landmark cluster, north side)
    const bigTree = tree({ rng, height: 8.5, trunkR: 1.0, canopyR: 6.5, cards: 5 })
    this.place(bigTree, 2, -22.5, 0.4)
    const longBench = bench({ length: 2.6 })
    this.place(longBench, 2, -19.6, 0) // faces +z (the park center)
    this.benchPos = new THREE.Vector3(2, this.heightAt(2, -19.6), -19.6)

    // Park's cold lights (Part 3.2.1): bench lamp, two path lanterns, firefly jar
    const benchLamp = lampPost({ lit: false })
    this.place(benchLamp.group, 4.2, -19.2)
    this.registerLight('park-bench-lamp', 'park', benchLamp, 4.2, -19.2)

    // two more benches on the loop
    for (const a of [Math.PI * 0.55, Math.PI * 1.25]) {
      const b = bench({})
      const x = Math.cos(a) * 16, z = Math.sin(a) * 16
      this.place(b, x, z, -a + Math.PI / 2)
    }

    // two cold path lanterns on the loop
    let li = 0
    for (const a of [Math.PI * 0.15, Math.PI * 0.85]) {
      const lamp = lampPost({ lit: false })
      const x = Math.cos(a) * 19.9, z = Math.sin(a) * 19.9
      this.place(lamp.group, x, z)
      this.registerLight(`park-lantern-${++li}`, 'park', lamp, x, z)
    }

    // firefly jar on a stump, off the path (release behavior in M6)
    const jar = fireflyJar()
    this.place(jar.group, -9, -11, 0.6)
    this.registerLight('park-firefly-jar', 'park', jar, -9, -11)
  }

  update(dt, time) {
    for (const f of this.flames) {
      if (!f.mesh.visible) continue
      f.acc += dt
      if (f.acc > 0.125) {
        f.acc = 0
        f.frame = (f.frame + 1) % 4
        f.tex.offset.x = f.frame * 0.25
      }
      f.mesh.lookAt(this.camera.position.x, f.mesh.getWorldPosition(_wp).y, this.camera.position.z)
    }
    for (const h of this.halos) { if (h.visible) h.lookAt(this.camera.position) }

    // kindled-light bloom ramps (2s warm ease) + gentle forever-flicker
    for (const l of this.lights) {
      if (!l.kindled) continue
      if (l.bloom < 1) l.bloom = Math.min(1, l.bloom + dt / 2)
      const ease = 1 - (1 - l.bloom) * (1 - l.bloom) // ease-out
      const flicker = 1 + Math.sin(time * 7.3 + l.flickerSeed) * 0.05 + Math.sin(time * 13.7 + l.flickerSeed * 2) * 0.03
      const p = l.parts
      if (p.halo) {
        p.halo.material.uniforms.uOpacity.value = l.haloBase * ease * flicker
        p.halo.scale.setScalar(0.6 + 0.4 * ease)
      }
      if (p.pool) p.pool.material.uniforms.uOpacity.value = l.poolBase * ease * flicker
      if (p.glass) p.glass.material.uniforms.uOpacity.value = l.glassBase * ease
    }
  }
}

const _wp = new THREE.Vector3()
