// Shared retro material (MASTER_PROMPT 8.2): one ShaderMaterial chunk for everything.
// color = texture × vertexColor × ambientTint + emissive, with manual distance fog.
// No realtime lights anywhere. Characters add a per-vertex hemisphere term.

import * as THREE from 'three'

// Global uniforms shared by every material instance — updated once per frame
// by the ZoneLight blender. Fog color MUST equal sky horizon stop (Rule 3).
export const globalUniforms = {
  uFogColor: { value: new THREE.Color('#274550') },
  uFogNear: { value: 8 },
  uFogFar: { value: 60 },
  uAmbient: { value: new THREE.Color('#ffffff') },
  uSkyUp: { value: new THREE.Color('#4a6a72') },   // hemisphere: from above
  uTime: { value: 0 },
}

const VERT = /* glsl */ `
  attribute vec3 color;
  varying vec2 vUv;
  varying vec3 vColor;
  varying float vFogDepth;
  varying float vHemi;
  uniform float uTime;
  uniform float uWindAmp;
  #ifdef USE_VERTEX_SNAP
  uniform vec2 uSnapRes;
  #endif
  void main() {
    vUv = uv;
    vColor = color;
    vec3 pos = position;
    #ifdef USE_WIND
    // gentle sway for foliage cards: weight painted into uv.y (top sways more)
    float w = uWindAmp * uv.y;
    pos.x += sin(uTime * 0.9 + position.y * 0.35 + position.x * 0.1) * w;
    pos.z += cos(uTime * 0.7 + position.x * 0.3) * w * 0.6;
    #endif
    #ifdef USE_RIPPLE
    // slow water swell (Part 8.7)
    pos.z += (sin(uTime * 0.9 + position.x * 0.18) + cos(uTime * 0.7 + position.y * 0.22)) * 0.07;
    #endif
    vec4 mv = modelViewMatrix * vec4(pos, 1.0);
    vFogDepth = -mv.z;
    vec3 wn = normalize(mat3(modelMatrix) * normal);
    vHemi = wn.y * 0.5 + 0.5; // hemisphere blend factor (sky above / fog below)
    vec4 clip = projectionMatrix * mv;
    #ifdef USE_VERTEX_SNAP
    clip.xyz /= clip.w;
    clip.xy = floor(clip.xy * uSnapRes) / uSnapRes;
    clip.xyz *= clip.w;
    #endif
    gl_Position = clip;
  }
`

const FRAG = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vColor;
  varying float vFogDepth;
  varying float vHemi;
  uniform sampler2D uMap;
  uniform vec3 uFogColor;
  uniform float uFogNear;
  uniform float uFogFar;
  uniform vec3 uAmbient;
  uniform vec3 uSkyUp;
  uniform vec3 uEmissive;
  uniform float uAlphaTest;
  uniform float uOpacity;
  void main() {
    vec4 tex = texture2D(uMap, vUv);
    if (tex.a < uAlphaTest) discard;
    vec3 col = tex.rgb * vColor;
    #ifdef USE_HEMI
    // characters: sky color from above, fog color from below (Part 8.2)
    vec3 hemi = mix(uFogColor * 1.7, uSkyUp * 2.1, vHemi);
    col *= hemi;
    #else
    col *= uAmbient;
    #endif
    col += uEmissive * tex.rgb;
    float fogF = smoothstep(uFogNear, uFogFar, vFogDepth);
    #ifdef NO_FOG
    fogF = 0.0;
    #endif
    col = mix(col, uFogColor, fogF);
    gl_FragColor = vec4(col, tex.a * uOpacity);
  }
`

export function retroMaterial({
  map,
  emissive = 0x000000,
  alphaTest = 0,
  transparent = false,
  opacity = 1,
  hemi = false,
  wind = 0,
  noFog = false,
  side = THREE.FrontSide,
  depthWrite = true,
} = {}) {
  const defines = {}
  if (hemi) defines.USE_HEMI = ''
  if (wind > 0) defines.USE_WIND = ''
  if (noFog) defines.NO_FOG = ''
  if (arguments[0]?.ripple) defines.USE_RIPPLE = ''
  const mat = new THREE.ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: FRAG,
    defines,
    side,
    transparent,
    depthWrite,
    uniforms: {
      uMap: { value: map },
      uEmissive: { value: new THREE.Color(emissive) },
      uAlphaTest: { value: alphaTest },
      uOpacity: { value: opacity },
      uWindAmp: { value: wind },
      uFogColor: globalUniforms.uFogColor,
      uFogNear: globalUniforms.uFogNear,
      uFogFar: globalUniforms.uFogFar,
      uAmbient: globalUniforms.uAmbient,
      uSkyUp: globalUniforms.uSkyUp,
      uTime: globalUniforms.uTime,
    },
  })
  return mat
}

// Ensure a geometry has the vertex-color attribute our shader expects (white default).
export function ensureVertexColors(geo, color = [1, 1, 1]) {
  if (!geo.getAttribute('color')) {
    const n = geo.getAttribute('position').count
    const arr = new Float32Array(n * 3)
    for (let i = 0; i < n; i++) {
      arr[i * 3] = color[0]; arr[i * 3 + 1] = color[1]; arr[i * 3 + 2] = color[2]
    }
    geo.setAttribute('color', new THREE.BufferAttribute(arr, 3))
  }
  return geo
}
