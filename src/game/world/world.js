// World (M1: Gloaming Park graybox per MASTER_PROMPT 3.2.1). Owns terrain
// height/surface queries, colliders, animated bits (flames, halos), and the
// growing shoot-rig pose list. Zones expand in M3.

import * as THREE from 'three'
import { retroMaterial, ensureVertexColors } from '../art/materials.js'
import * as TEX from '../art/textures.js'
import { tree, lampPost, bench, sharedMats } from '../art/meshes.js'
import { worldRNG } from '../core/rng.js'

export class World {
  constructor(scene, camera) {
    this.scene = scene
    this.camera = camera
    this.colliders = []      // { x, z, r, h }
    this.interactables = []  // { id, x, z } (M2 wires actions)
    this.flames = []         // { mesh, tex, frame, acc } sprite animation
    this.halos = []          // billboards to face camera
    this.buildPark()
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

  registerLamp(lamp, x, z) {
    this.flames.push({ mesh: lamp.flame, tex: lamp.flame.material.uniforms.uMap.value, frame: worldRNG.int(0, 3), acc: worldRNG.range(0, 0.12) })
    this.halos.push(lamp.halo)
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

    const benchLamp = lampPost({})
    this.place(benchLamp.group, 4.2, -19.2)
    this.registerLamp(benchLamp, 4.2, -19.2)
    this.interactables.push({ id: 'park-bench-lamp', x: 4.2, z: -19.2 })

    // two more benches on the loop
    for (const a of [Math.PI * 0.55, Math.PI * 1.25]) {
      const b = bench({})
      const x = Math.cos(a) * 16, z = Math.sin(a) * 16
      this.place(b, x, z, -a + Math.PI / 2)
    }

    // two path lanterns on the loop (cold in M2; lit for the graybox look)
    for (const a of [Math.PI * 0.15, Math.PI * 0.85]) {
      const lamp = lampPost({})
      const x = Math.cos(a) * 19.9, z = Math.sin(a) * 19.9
      this.place(lamp.group, x, z)
      this.registerLamp(lamp, x, z)
    }
  }

  update(dt, time) {
    for (const f of this.flames) {
      f.acc += dt
      if (f.acc > 0.125) {
        f.acc = 0
        f.frame = (f.frame + 1) % 4
        f.tex.offset.x = f.frame * 0.25
      }
      f.mesh.lookAt(this.camera.position.x, f.mesh.getWorldPosition(_wp).y, this.camera.position.z)
    }
    for (const h of this.halos) h.lookAt(this.camera.position)
  }
}

const _wp = new THREE.Vector3()
