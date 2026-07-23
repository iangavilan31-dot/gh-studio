// Starfield + slow meteors (MASTER_PROMPT 8.7): instanced star quads on the
// sky shell, twinkle by seeded hash, density driven per zone (rooftops get the
// densest sky in the game). Follows the camera like the sky dome; never fogged.

import * as THREE from 'three'
import { worldRNG } from '../core/rng.js'
import * as TEX from '../art/textures.js'

const VERT = /* glsl */ `
  attribute vec3 iPos;
  attribute float iSize;
  attribute float iSeed;
  uniform vec3 uCamRight;
  uniform vec3 uCamUp;
  uniform float uTime;
  uniform float uDensity; // 0..1 → seeds above this are hidden
  varying vec2 vUv;
  varying float vA;
  void main() {
    vUv = uv;
    float tw = 0.55 + 0.45 * sin(uTime * (1.2 + iSeed * 2.6) + iSeed * 40.0);
    vA = iSeed < uDensity ? tw : 0.0;
    vec3 wp = iPos + (uCamRight * position.x + uCamUp * position.y) * iSize;
    gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0);
  }
`
const FRAG = /* glsl */ `
  varying vec2 vUv;
  varying float vA;
  uniform sampler2D uMap;
  void main() {
    vec4 tex = texture2D(uMap, vUv);
    gl_FragColor = vec4(tex.rgb, tex.a * vA);
  }
`

export class Stars {
  constructor(scene, count = 650) {
    const rng = worldRNG.fork('stars')
    const base = new THREE.PlaneGeometry(1, 1)
    const geo = new THREE.InstancedBufferGeometry()
    geo.index = base.index
    geo.attributes.position = base.attributes.position
    geo.attributes.uv = base.attributes.uv
    const pos = new Float32Array(count * 3)
    const size = new Float32Array(count)
    const seed = new Float32Array(count)
    for (let i = 0; i < count; i++) {
      // upper hemisphere shell
      const a = rng.range(0, Math.PI * 2)
      const e = Math.asin(rng.next() * 0.98 + 0.02)
      const r = 175
      pos[i * 3] = Math.cos(a) * Math.cos(e) * r
      pos[i * 3 + 1] = Math.sin(e) * r
      pos[i * 3 + 2] = Math.sin(a) * Math.cos(e) * r
      size[i] = rng.range(0.55, 1.7)
      seed[i] = rng.next()
    }
    geo.setAttribute('iPos', new THREE.InstancedBufferAttribute(pos, 3))
    geo.setAttribute('iSize', new THREE.InstancedBufferAttribute(size, 1))
    geo.setAttribute('iSeed', new THREE.InstancedBufferAttribute(seed, 1))
    this.uniforms = {
      uMap: { value: TEX.star() },
      uCamRight: { value: new THREE.Vector3(1, 0, 0) },
      uCamUp: { value: new THREE.Vector3(0, 1, 0) },
      uTime: { value: 0 },
      uDensity: { value: 0.5 },
    }
    const mat = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      uniforms: this.uniforms,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })
    this.mesh = new THREE.Mesh(geo, mat)
    this.mesh.frustumCulled = false
    this.mesh.renderOrder = -95 // after sky, before moon
    scene.add(this.mesh)

    // meteor: a single streak quad reused for occasional slow crossings
    const meteorMat = new THREE.MeshBasicMaterial({ map: TEX.streak({ name: 'meteorStreak', color: '#cdd8ee' }), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 })
    this.meteor = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 14), meteorMat)
    this.meteor.frustumCulled = false
    this.meteor.renderOrder = -94
    scene.add(this.meteor)
    this.meteorT = -20 // seconds until next
    this.rng = rng
  }

  // density per zone id (rooftops densest, interiors none)
  static densityFor(zoneId) {
    if (zoneId === 'rooftops') return 1.0
    if (zoneId === 'village') return 0.8
    if (zoneId === 'hall') return 0.0
    if (zoneId?.startsWith('fogland')) return 0.25
    return 0.5
  }

  update(dt, time, camera, zoneId) {
    this.uniforms.uTime.value = time
    const target = Stars.densityFor(zoneId)
    this.uniforms.uDensity.value += (target - this.uniforms.uDensity.value) * (1 - Math.exp(-dt / 2))
    this.mesh.position.copy(camera.position)

    // occasional slow meteor (strictly gentle — Rule 11)
    this.meteorT += dt
    if (this.meteorT > 0 && this.meteorT < 6) {
      const t = this.meteorT / 6
      const a = this.meteorA
      const e = 0.9 - t * 0.35
      const r = 170
      this.meteor.position.set(
        camera.position.x + Math.cos(a + t * 0.5) * Math.cos(e) * r,
        camera.position.y + Math.sin(e) * r,
        camera.position.z + Math.sin(a + t * 0.5) * Math.cos(e) * r
      )
      this.meteor.lookAt(camera.position)
      this.meteor.material.opacity = Math.sin(t * Math.PI) * 0.5
    } else if (this.meteorT >= 6) {
      this.meteor.material.opacity = 0
      this.meteorT = -this.rng.range(25, 60) // long quiet gaps
      this.meteorA = this.rng.range(0, Math.PI * 2)
    }
  }
}
