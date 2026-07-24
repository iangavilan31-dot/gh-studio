// Retro render pipeline (MASTER_PROMPT 8.1/8.5): scene → 480×270 nearest RT →
// single post shader (quantize → Bayer dither → vignette → mode extras → gamma)
// → letterboxed canvas. Internal res scale 0.5×/1×/1.5×/2×.

import * as THREE from 'three'

export const BASE_W = 480
export const BASE_H = 270

const POST_FRAG = /* glsl */ `
  varying vec2 vUv;
  uniform sampler2D uScene;
  uniform vec2 uRes;
  uniform float uQuantize;    // levels per channel (0 = off)
  uniform float uDither;      // 0..1 strength
  uniform float uVignette;    // 0..1
  uniform vec3 uVignetteTint; // warm-shift target when resting
  uniform float uWarm;        // 0..1 resting warmth
  uniform float uGamma;
  uniform float uSoftBlur;    // N64 soft 1px horizontal blur 0..1
  uniform vec3 uFloor;        // Rule 1 black floor (fog-tinted, set per zone)
  uniform float uScanline;    // VHS
  uniform float uChroma;      // VHS chroma bleed px
  uniform float uWobble;      // VHS tracking wobble amount
  uniform float uTime;

  float bayer4(vec2 p) {
    // 4x4 Bayer matrix value 0..1
    int x = int(mod(p.x, 4.0));
    int y = int(mod(p.y, 4.0));
    int i = y * 4 + x;
    float m[16];
    m[0]=0.0; m[1]=8.0; m[2]=2.0; m[3]=10.0;
    m[4]=12.0; m[5]=4.0; m[6]=14.0; m[7]=6.0;
    m[8]=3.0; m[9]=11.0; m[10]=1.0; m[11]=9.0;
    m[12]=15.0; m[13]=7.0; m[14]=13.0; m[15]=5.0;
    for (int k = 0; k < 16; k++) { if (k == i) return (m[k] + 0.5) / 16.0; }
    return 0.5;
  }

  void main() {
    vec2 uv = vUv;
    if (uWobble > 0.0) {
      float w = sin(uTime * 0.9) * smoothstep(0.96, 1.0, sin(uTime * 0.143));
      uv.x += w * uWobble * 0.006 * sin(uv.y * 60.0 + uTime * 8.0);
    }
    vec3 col;
    if (uChroma > 0.0) {
      float o = uChroma / uRes.x;
      col.r = texture2D(uScene, uv + vec2(o, 0.0)).r;
      col.g = texture2D(uScene, uv).g;
      col.b = texture2D(uScene, uv - vec2(o, 0.0)).b;
    } else {
      col = texture2D(uScene, uv).rgb;
    }
    if (uSoftBlur > 0.0) {
      float o = 1.0 / uRes.x;
      vec3 l = texture2D(uScene, uv - vec2(o, 0.0)).rgb;
      vec3 r = texture2D(uScene, uv + vec2(o, 0.0)).rgb;
      col = mix(col, (col * 2.0 + l + r) * 0.25, uSoftBlur);
    }
    if (uQuantize > 0.0) {
      float d = (bayer4(vUv * uRes) - 0.5) * uDither / uQuantize;
      col = floor((col + d) * uQuantize + 0.5) / uQuantize;
    }
    if (uScanline > 0.0) {
      float s = sin(vUv.y * uRes.y * 3.14159);
      col *= 1.0 - uScanline * 0.5 * (0.5 + 0.5 * s * s);
    }
    // vignette (+ warm shift while resting)
    vec2 vc = vUv - 0.5;
    float vig = smoothstep(0.85, 0.35, length(vc) * (1.2 - uVignette * 0.2));
    vec3 vigCol = mix(vec3(0.0), uVignetteTint, uWarm);
    col = mix(vigCol, col, mix(1.0 - uVignette, 1.0, vig));
    // Rule 1: darkness is a saturated cool color, never black-black — a
    // fog-tinted floor (set per zone) lifts anything quantize crushed to zero
    col = max(col, uFloor);
    col = pow(col, vec3(1.0 / uGamma));
    gl_FragColor = vec4(col, 1.0);
  }
`

export class Pipeline {
  constructor(canvas) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' })
    this.renderer.autoClear = true
    // raw pass-through: our shaders manage color themselves (no encoding pass)
    this.renderer.outputColorSpace = THREE.LinearSRGBColorSpace
    this.resScale = 1
    this.rt = new THREE.WebGLRenderTarget(BASE_W, BASE_H, {
      magFilter: THREE.NearestFilter,
      minFilter: THREE.NearestFilter,
      depthBuffer: true,
    })
    this.postUniforms = {
      uScene: { value: this.rt.texture },
      uRes: { value: new THREE.Vector2(BASE_W, BASE_H) },
      uQuantize: { value: 32 },
      uDither: { value: 0.5 },
      uVignette: { value: 0.25 },
      uVignetteTint: { value: new THREE.Color('#3b2a18') },
      uWarm: { value: 0 },
      uGamma: { value: 1.12 },
      uSoftBlur: { value: 0.6 },   // N64 default: stable but soft
      uFloor: { value: new THREE.Color('#04060c') },
      uScanline: { value: 0 },
      uChroma: { value: 0 },
      uWobble: { value: 0 },
      uTime: { value: 0 },
    }
    this.postScene = new THREE.Scene()
    this.postCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)
    const quad = new THREE.Mesh(
      new THREE.PlaneGeometry(2, 2),
      new THREE.ShaderMaterial({
        vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
        fragmentShader: POST_FRAG,
        uniforms: this.postUniforms,
        depthTest: false,
        depthWrite: false,
      })
    )
    quad.frustumCulled = false
    this.postScene.add(quad)
    this.resize()
    window.addEventListener('resize', () => this.resize())
    // embedded viewers (artifact iframes) can size the frame after load or
    // without firing window resize — track the document's real box directly
    if (window.ResizeObserver) {
      new ResizeObserver(() => this.resize()).observe(document.documentElement)
    }
    window.visualViewport?.addEventListener('resize', () => this.resize())
    // and re-measure a few beats after boot — hosts settle their layout late
    for (const ms of [150, 500, 1500]) setTimeout(() => this.resize(), ms)
  }

  setResScale(s) {
    this.resScale = s
    const w = Math.round(BASE_W * s), h = Math.round(BASE_H * s)
    this.rt.setSize(w, h)
    this.postUniforms.uRes.value.set(w, h)
  }

  resize() {
    // the smallest honest answer wins: layout viewport, document box, and the
    // visual viewport can disagree inside embeds — overshooting means the game
    // renders into space the host has clipped away
    const de = document.documentElement
    const w = Math.min(window.innerWidth, de.clientWidth || Infinity, Math.ceil(window.visualViewport?.width ?? Infinity))
    const h = Math.min(window.innerHeight, de.clientHeight || Infinity, Math.ceil(window.visualViewport?.height ?? Infinity))
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    this.renderer.setPixelRatio(dpr)
    this.renderer.setSize(w, h, true)
    // 16:9 letterbox viewport in device pixels
    const pw = w * dpr, ph = h * dpr
    const target = 16 / 9
    let vw = pw, vh = pw / target
    if (vh > ph) { vh = ph; vw = ph * target }
    this.viewport = new THREE.Vector4((pw - vw) / 2, (ph - vh) / 2, vw, vh)
  }

  render(scene, camera, time) {
    this.postUniforms.uTime.value = time
    this.renderer.setRenderTarget(this.rt)
    this.renderer.setViewport(0, 0, this.rt.width, this.rt.height)
    this.renderer.clear()
    this.renderer.render(scene, camera)
    // snapshot scene-pass stats before the post quad resets them
    this.lastInfo = { calls: this.renderer.info.render.calls, triangles: this.renderer.info.render.triangles }
    this.renderer.setRenderTarget(null)
    const v = this.viewport
    this.renderer.setViewport(v.x / this.renderer.getPixelRatio(), v.y / this.renderer.getPixelRatio(), v.z / this.renderer.getPixelRatio(), v.w / this.renderer.getPixelRatio())
    this.renderer.render(this.postScene, this.postCam)
  }

  // Test hook: render one frame to the RT and sample its pixels (0.4 non-blank gate).
  sampleFrame(scene, camera, clearColorHex) {
    this.renderer.setRenderTarget(this.rt)
    this.renderer.clear()
    this.renderer.render(scene, camera)
    const w = this.rt.width, h = this.rt.height
    const buf = new Uint8Array(w * h * 4)
    this.renderer.readRenderTargetPixels(this.rt, 0, 0, w, h, buf)
    this.renderer.setRenderTarget(null)
    const cc = new THREE.Color(clearColorHex ?? 0x000000)
    const cr = Math.round(cc.r * 255), cg = Math.round(cc.g * 255), cb = Math.round(cc.b * 255)
    let differ = 0, n = 0
    for (let i = 0; i < buf.length; i += 16) { // sample every 4th pixel
      n++
      if (Math.abs(buf[i] - cr) > 8 || Math.abs(buf[i + 1] - cg) > 8 || Math.abs(buf[i + 2] - cb) > 8) differ++
    }
    return { sampled: n, differRatio: differ / n }
  }
}
