// ZoneLight system (MASTER_PROMPT 8.3): per-zone atmosphere records; sky-dome
// 5-stop gradient shader; fog color ALWAYS === stop[4] (horizon) — asserted.
// Zone volume blending (nearest-2, 4s lerps) arrives with M3; M0 uses Park only.

import * as THREE from 'three'
import { globalUniforms } from '../art/materials.js'

// Palette per Part 2.1. skyStops: zenith → horizon. fog === skyStops[4].
export const ZONES = {
  park: {
    name: 'The Gloaming Park',
    skyStops: ['#0b1626', '#101f2b', '#16303a', '#1f3d48', '#274550'],
    fog: '#274550', fogNear: 8, fogFar: 45,
    ambient: '#93a8a9', skyUp: '#3d5865',
    accent: '#e8c26a',
    audioKey: 'D', audioMode: 'dorian',
  },
}

let assertFailed = false
export function assertFogRule(zone) {
  // Rule 3 runtime dev check: fog color must equal horizon stop.
  if (zone.fog !== zone.skyStops[4] && !assertFailed) {
    assertFailed = true
    console.error(`[MOONREST] Rule 3 violated: fog ${zone.fog} !== horizon ${zone.skyStops[4]} in ${zone.name}`)
  }
}

const SKY_VERT = /* glsl */ `
  varying vec3 vDir;
  void main() {
    vDir = position;
    vec4 mv = modelViewMatrix * vec4(position, 0.0); // ignore translation: dome follows camera
    gl_Position = (projectionMatrix * vec4(mv.xyz, 1.0)).xyww; // depth = far
  }
`
const SKY_FRAG = /* glsl */ `
  varying vec3 vDir;
  uniform vec3 uStops[5];
  void main() {
    float h = normalize(vDir).y;            // -1..1
    float t = clamp(1.0 - max(h, 0.0), 0.0, 1.0); // 0 zenith → 1 horizon
    // 5 bands: zenith..horizon over the upper hemisphere; below horizon = horizon color
    float x = t * 4.0;
    int i = int(min(x, 3.0));
    vec3 col = mix(uStops[i], uStops[i + 1], smoothstep(0.0, 1.0, fract(min(x, 3.999))));
    if (h < 0.0) col = uStops[4];
    gl_FragColor = vec4(col, 1.0);
  }
`

export class Sky {
  constructor(scene) {
    this.uniforms = {
      uStops: { value: [0, 1, 2, 3, 4].map(() => new THREE.Color()) },
    }
    const geo = new THREE.SphereGeometry(1, 24, 12)
    const mat = new THREE.ShaderMaterial({
      vertexShader: SKY_VERT,
      fragmentShader: SKY_FRAG,
      uniforms: this.uniforms,
      side: THREE.BackSide,
      depthWrite: false,
      depthTest: true,
    })
    this.mesh = new THREE.Mesh(geo, mat)
    this.mesh.frustumCulled = false
    this.mesh.renderOrder = -100
    scene.add(this.mesh)
  }
  setStops(stops) {
    stops.forEach((s, i) => this.uniforms.uStops.value[i].set(s))
  }
}

export class ZoneLightState {
  constructor(scene) {
    this.sky = new Sky(scene)
    this.current = null
    this.apply(ZONES.park)
  }
  apply(zone) {
    assertFogRule(zone)
    this.current = zone
    this.sky.setStops(zone.skyStops)
    globalUniforms.uFogColor.value.set(zone.fog)
    globalUniforms.uFogNear.value = zone.fogNear
    globalUniforms.uFogFar.value = zone.fogFar
    globalUniforms.uAmbient.value.set(zone.ambient)
    globalUniforms.uSkyUp.value.set(zone.skyUp)
  }
}
