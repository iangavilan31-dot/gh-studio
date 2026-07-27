// Shared retro material (MASTER_PROMPT 8.2): one ShaderMaterial chunk for everything.
// color = texture × vertexColor × ambientTint + emissive, with manual distance fog.
// No realtime lights anywhere. Characters add a per-vertex hemisphere term.

import * as THREE from 'three'
// NOTE the /vanilla subpath: the package root export is the React-Three-Fiber
// component and pulls in react + @react-three/fiber. /vanilla is the plain class.
import CustomShaderMaterial from 'three-custom-shader-material/vanilla'

// Global uniforms shared by every material instance — updated once per frame
// by the ZoneLight blender. Fog color MUST equal sky horizon stop (Rule 3).
export const globalUniforms = {
  uFogColor: { value: new THREE.Color('#274550') },
  uFogNear: { value: 8 },
  uFogFar: { value: 60 },
  uAmbient: { value: new THREE.Color('#ffffff') },
  uSkyUp: { value: new THREE.Color('#4a6a72') },   // hemisphere: from above
  uTime: { value: 0 },
  // PS1 Memory dial (Part 8.6): uniform-driven so ONE toggle hits every
  // material without recompiling shaders
  uSnapEnable: { value: 0 },                        // 0/1 vertex snap
  uSnapRes: { value: new THREE.Vector2(240, 135) }, // snap grid (half internal res)
  uAffineMix: { value: 0 },                         // 0..1 affine-interpolation blend
  // Restored mode (Part Q.1): -0.5 mip LOD bias keeps texel edges crisp at
  // distance without shimmer; 0 in the retro dials
  uLodBias: { value: 0 },
  // Carried warmth (PRESTIGE AA.2, Lunacid's rule): each player's lantern-staff
  // casts a traveling warm pool. Up to 4 lanterns (local + 3 remotes); w hides
  // unused slots far below the world.
  uLanternPos: { value: [new THREE.Vector3(0, -999, 0), new THREE.Vector3(0, -999, 0), new THREE.Vector3(0, -999, 0), new THREE.Vector3(0, -999, 0)] },
  uLanternStr: { value: new Float32Array([0, 0, 0, 0]) },
  // FIN-1: lowest reflectance any surface is allowed to have. Swept against
  // scripts/composecheck.mjs across all three zones — crush falls monotonically
  // (Village 24.3% → 0.3%) while the mid-band SPREAD rises (19.5 → 23.8), i.e.
  // lifting the floor makes the frame more readable rather than washing it
  // out, which is what tells you it is a fix and not a fudge. 0.20 sits past
  // the knee with margin on the ≤2% gate.
  uAlbedoFloor: { value: 0.26 },
  // how much of the baked vertex-colour HUE to reintroduce (0 = ignore it)
  uVertexTint: { value: 1.0 },
  // Macro patchiness on up-facing surfaces — see CSM_FRAG. Swept against a
  // DETERMINISTIC gate (the earlier sweep was measured at random animation
  // phases and read as noise): spread rises monotonically with strength, and
  // 1.1 clears the readability line on both open-path poses with margin.
  uGroundMacro: { value: 1.4 },
  // Ground albedo scale on up-facing surfaces. Judge pass 1's top finding: both
  // reviewers measured the ground brighter than the sky in all thirteen frames.
  // Declared here — its absence was the "Cannot read properties of undefined
  // (reading 'needsUpdate')" that took down shoot.mjs and composecheck: a
  // material listed the uniform, globalUniforms did not define it, and three
  // was handed undefined.
  uGroundDarken: { value: 0.72 },
}

const VERT = /* glsl */ `
  attribute vec3 color;
  varying vec2 vUv;
  varying vec3 vColor;
  varying float vFogDepth;
  varying float vHemi;
  varying float vLantern;
  uniform float uTime;
  uniform float uWindAmp;
  uniform float uSnapEnable;
  uniform vec2 uSnapRes;
  uniform float uAffineMix;
  uniform vec3 uLanternPos[4];
  uniform float uLanternStr[4];
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
    // carried lantern pools (AA.2): per-vertex warm falloff, upfacing bias so
    // it reads as a pool on the ground and a rim on nearby surfaces
    vec3 wp = (modelMatrix * vec4(pos, 1.0)).xyz;
    float lac = 0.0;
    for (int i = 0; i < 4; i++) {
      float d = distance(wp, uLanternPos[i]);
      float f = max(0.0, 1.0 - d / 8.0);
      // near-field attenuation: the wearer gets a rim, not an orange bath —
      // the pool lands on the ground around them
      float nearAtt = 0.3 + 0.7 * smoothstep(0.35, 1.7, d);
      lac += uLanternStr[i] * f * f * nearAtt;
    }
    vLantern = min(lac, 1.0) * (0.55 + 0.45 * vHemi);
    vec4 clip = projectionMatrix * mv;
    if (uSnapEnable > 0.5) {
      // PS1: snap vertices to a coarse screen grid...
      float w = clip.w;
      clip.xyz /= w;
      clip.xy = floor(clip.xy * uSnapRes + 0.5) / uSnapRes;
      // ...and lean the divisor toward 1 so varyings interpolate closer to
      // screen-space linear (the affine texture warp of the era)
      float wa = mix(w, 1.0, uAffineMix);
      clip.xyz *= wa;
      clip.w = wa;
    }
    gl_Position = clip;
  }
`

const FRAG = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vColor;
  varying float vFogDepth;
  varying float vHemi;
  varying float vLantern;
  uniform sampler2D uMap;
  uniform vec3 uFogColor;
  uniform float uFogNear;
  uniform float uFogFar;
  uniform vec3 uAmbient;
  uniform vec3 uSkyUp;
  uniform vec3 uEmissive;
  uniform float uAlphaTest;
  uniform float uOpacity;
  uniform float uLodBias;
  uniform vec2 uMapRepeat;
  uniform vec2 uMapOffset;
  void main() {
    // ShaderMaterials never get three's uvTransform — repeat/offset are bound
    // by reference below, so texture.repeat tiling and offset animation
    // (flame frames, water scroll) work exactly like on built-in materials
    vec4 tex = texture2D(uMap, vUv * uMapRepeat + uMapOffset, uLodBias);
    if (tex.a < uAlphaTest) discard;
    vec3 col = tex.rgb * vColor;
    #ifdef USE_HEMI
    // characters: sky color from above, fog color from below (Part 8.2), plus
    // a faint violet-biased fill (AA.7) so the robe tint reads and the
    // silhouette never crushes into the background
    vec3 hemi = mix(uFogColor * 1.7, uSkyUp * 2.1, vHemi) + vec3(0.11, 0.09, 0.16);
    // the zone tints characters but never owns them (AA.7): pull the tint
    // 35% toward its own luminance so the robe's violet survives teal fog
    float hl = dot(hemi, vec3(0.299, 0.587, 0.114));
    hemi = mix(hemi, vec3(hl), 0.35);
    col *= hemi;
    #else
    col *= uAmbient;
    #endif
    col += uEmissive * tex.rgb;
    // carried lantern warmth (AA.2) — modulated by the texture so painted
    // detail stays legible inside the pool; applied before fog so fog wins
    col += vec3(0.98, 0.6, 0.22) * vLantern * 0.6 * (tex.rgb * 0.45 + 0.55);
    float fogF = smoothstep(uFogNear, uFogFar, vFogDepth);
    #ifdef NO_FOG
    fogF = 0.0;
    #endif
    col = mix(col, uFogColor, fogF);
    gl_FragColor = vec4(col, tex.a * uOpacity);
  }
`

// ——— FIN-1: the lit path ———
// retroMaterial() below is a raw ShaderMaterial with no `lights: true`, so
// three feeds it NO light uniforms — a moon DirectionalLight added to that
// scene is a silent no-op (DECISIONS #9). CustomShaderMaterial wraps a real
// MeshStandardMaterial, so the material keeps three's lighting, shadows, fog
// and tone mapping while we still author the stylised bits (TOOLKIT §8).
//
// Deliberately minimal: three already handles map, vertex colors, emissive
// and fog on the base material, so the only custom code is the PS1 vertex
// snap + wind (csm_Position) and the carried lantern warmth
// (csm_DiffuseColor). Writing csm_DiffuseColor and never csm_FragColor is
// what keeps the result INSIDE the lighting pipeline (§6).
// How far above 1.0 an emitter sits. This is a fine balance and 4.0 was too
// hot: a glow quad is a soft radial gradient, so a uniform multiply pushes its
// whole falloff into HDR and the Hall of Lanterns rendered as one blown blob
// at 13.2% accent coverage (budget 8%).
//
// The right value lets the bloom THRESHOLD do the selecting. At 2.0 a quad's
// core (texel ~1.0) lands at 2.0 and clears the 0.72 threshold, while its
// outer falloff (texel ~0.2) lands at 0.4 and does not — so sources glow and
// halos stay halos. Bloom makes the bloom; the quad does not pre-bake it.
const EMITTER_GAIN = 2.0

let _white1x1 = null
function white1x1() {
  if (_white1x1) return _white1x1
  const c = document.createElement('canvas'); c.width = c.height = 1
  const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, 1, 1)
  _white1x1 = new THREE.CanvasTexture(c)
  return _white1x1
}

const CSM_VERT = /* glsl */ `
  uniform float uTime;
  uniform float uWindAmp;
  varying vec3 vWorldPos;
  varying vec3 vNormalW;
  varying float vUpness;
  void main() {
    vec3 p = position;
    if (uWindAmp > 0.0) {
      float sway = sin(uTime * 1.6 + position.x * 0.7 + position.z * 0.5);
      p.x += sway * uWindAmp * max(0.0, position.y);
    }
    csm_Position = p;
    vWorldPos = (modelMatrix * vec4(p, 1.0)).xyz;
    vNormalW = normalize(mat3(modelMatrix) * normal);
    // how ground-like this surface is, in world space — the macro variation
    // below is a property of GROUND, not of walls
    vUpness = clamp(normalize(mat3(modelMatrix) * normal).y, 0.0, 1.0);
  }
`

const CSM_FRAG = /* glsl */ `
  uniform vec3 uLanternPos[4];
  uniform float uLanternStr[4];
  uniform float uAlbedoFloor;
  uniform float uVertexTint;
  uniform float uGroundMacro;
  uniform float uGroundDarken;
  varying vec3 vWorldPos;
  varying vec3 vNormalW;
  varying float vUpness;

  // Cheap value noise. Two octaves is enough — this is macro patchiness at the
  // scale of metres, not a detail texture.
  float vhash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
  }
  float vnoise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(vhash(i), vhash(i + vec2(1.0, 0.0)), u.x),
               mix(vhash(i + vec2(0.0, 1.0)), vhash(i + vec2(1.0, 1.0)), u.x), u.y);
  }

  void main() {
    // ——— vertex colours, by hand, and NOT optional ———
    // CSM patches three's shader as:
    //     #include <color_fragment>
    //     diffuseColor = csm_DiffuseColor;
    // <color_fragment> is exactly where three multiplies vColor in — and the
    // assignment on the next line overwrites it, because csm_DiffuseColor is
    // built from vec4(diffuse, opacity) * sampledMap and never saw vColor.
    // So on the lit path every painted vertex colour in the world was silently
    // discarded: the ground lost its grass/path split and the Keeper's violet
    // robe rendered pure white. Re-apply it here, before the floor, so the
    // floor is a floor on the FINAL albedo.
    // ...but they cannot be used raw. The old world baked its LIGHTING into
    // vertex colours (MASTER_PROMPT: "vertex-color baked lighting"), so
    // multiplying them into an albedo that is now lit for real darkens the
    // world twice — applied raw, every zone went to 100% below L*40. Keep the
    // HUE and the relative variation, discard most of the baked luminance: the
    // moon and the hemisphere own value now. This is the same law as the
    // albedo floor, applied to the other place darkness got baked in.
    #ifdef USE_COLOR
      // uVertexTint 0 = ignore vertex colour entirely (the baked-lighting data
      // is discarded), 1 = full hue at full strength. The VALUE is always
      // dropped — only the hue is ever reintroduced, and only as far as the
      // tint dial allows.
      // three declares vColor as a vec4 here — taking it as vec3 fails to
      // compile, and CSM's silent mode plus a shader that merely stops drawing
      // makes that look like an art bug rather than a build error.
      vec3 vc = vColor.rgb;
      float vl = max(max(vc.r, vc.g), vc.b);
      vec3 vhue = vl > 0.001 ? vc / vl : vec3(1.0);
      csm_DiffuseColor.rgb *= mix(vec3(1.0), vhue, uVertexTint);
    #endif

    // ——— albedo floor (DIRECTION Part 6: never bake darkness into albedo) ———
    // These textures were hand-painted for an UNLIT renderer, so shading is
    // baked into them: mortar lines, roof-tile gaps and wood trim sit at or
    // near zero. Sampled as sRGB and then multiplied by a night light, they go
    // to true black — measured at 37% of the Village frame below L*3, and the
    // crush mask showed it landing exactly on the painted dark detail while
    // the plaster beside it read fine.
    //
    // No real material is that dark: charcoal and fresh asphalt bottom out
    // around 0.04–0.08 reflectance. So remap albedo into a range a surface can
    // actually have. Relative contrast and hue survive; only the floor moves,
    // which puts the frame's darkness back where it belongs — in the LIGHTING,
    // where the moon and the lanterns can still carve it.
    csm_DiffuseColor.rgb = mix(vec3(uAlbedoFloor), vec3(1.0), csm_DiffuseColor.rgb);

    // ——— the value inversion fix ———
    // Weighted by how UP-FACING the surface is, so it darkens ground and
    // roof-tops (the planes that were reading as snow) and leaves verticals
    // alone. The floor above still guarantees shade never reaches black.
    {
      float up = clamp(vNormalW.y, 0.0, 1.0);
      float k = mix(1.0, uGroundDarken, up * up);
      csm_DiffuseColor.rgb *= max(k, uAlbedoFloor * 0.9);
    }

    // ——— macro ground variation ———
    // The open-path poses measured flat for a plain reason: the ground is one
    // enormous plane of one albedo, so it renders as a single value across most
    // of the frame no matter how good the lighting on it is. Real ground is
    // patchy at the scale of metres — damp earth, worn track, moss.
    //
    // World-space so it never swims with the camera and never tiles with the
    // texture, and weighted by how UP-FACING the surface is, so walls and
    // trunks are untouched and only ground receives it. This is procedural
    // material work, not an asset — Stage 1 stays asset-free.
    if (uGroundMacro > 0.0 && vUpness > 0.0) {
      float m = vnoise(vWorldPos.xz * 0.085) * 0.65
              + vnoise(vWorldPos.xz * 0.31) * 0.35;
      csm_DiffuseColor.rgb *= mix(1.0, 0.74 + 0.52 * m, uGroundMacro * vUpness);
    }

    // carried lantern warmth (PRESTIGE AA.2): a travelling warm pool that
    // reads even where the moon does not reach. Added to ALBEDO so it still
    // goes through lighting and fog rather than being painted on top.
    float warm = 0.0;
    for (int i = 0; i < 4; i++) {
      if (uLanternStr[i] <= 0.0) continue;
      float d = distance(vWorldPos, uLanternPos[i]);
      warm += uLanternStr[i] * (1.0 - smoothstep(0.0, 7.0, d));
    }
    csm_DiffuseColor.rgb += vec3(0.98, 0.6, 0.22) * clamp(warm, 0.0, 1.0) * 0.35;
  }
`

/**
 * Lit sibling of retroMaterial(). Same call signature, but the result
 * participates in three's lighting so Stage 1's moon/hemisphere/lantern rig
 * actually does something.
 */
export function litMaterial({
  map, emissive = 0x000000, alphaTest = 0, transparent = false, opacity = 1,
  wind = 0, side = THREE.FrontSide, depthWrite = true, roughness = 0.85,
  noFog = false, emitterGain = 1,
} = {}) {
  // ——— emitters are lights, not surfaces ———
  // Every glow quad in the world shares one signature: transparent with
  // depthWrite off. Run through the lit path as ordinary geometry they became
  // dim surfaces CATCHING moonlight instead of being light — which is why
  // every pose measured 0.0% highlights and 0.0% accent warmth in a game about
  // kindling 37 lanterns.
  //
  // TOOLKIT §3 names this exact trap: bloom's threshold means nothing blooms
  // unless emitters are genuinely HDR. So an emitter gets a black diffuse (it
  // has no reflectance — it is a source), its map colour moved onto the
  // emissive channel, and an intensity above 1 so it clears the threshold and
  // the tone curve sees a real highlight.
  const isEmitter = transparent && !depthWrite
  const emissiveColor = new THREE.Color(emissive)
  if (isEmitter && emissiveColor.r + emissiveColor.g + emissiveColor.b === 0) {
    // no emissive was authored — the quad's own painted colour IS the light
    emissiveColor.setRGB(1, 1, 1)
  }

  const base = new THREE.MeshStandardMaterial({
    map: map ?? null,
    color: isEmitter ? 0x000000 : 0xffffff,
    emissiveIntensity: isEmitter ? EMITTER_GAIN * emitterGain : 1,
    vertexColors: true,
    fog: !noFog,
    emissive: emissiveColor,
    // csm_Emissive / csm_Roughness are SILENT no-ops unless the base material
    // has the matching map slot populated (TOOLKIT §8) — a 1×1 white texture
    // is the documented way to open those slots.
    emissiveMap: map ?? white1x1(),
    roughnessMap: white1x1(),
    roughness,
    metalness: 0,
    transparent, opacity, alphaTest, side, depthWrite,
    dithering: true,          // §1.3: every large gradient bands without this
  })
  // ——— compatibility uniforms ———
  // The legacy path was a raw ShaderMaterial, and ~47 call sites reach into
  // `mat.uniforms.*.value` directly to fade props out, swap flame frames and
  // pulse emissives. Rather than rewrite all of them, the same three names are
  // republished here as accessors that WRITE THROUGH to the standard material.
  // MeshStandardMaterial already does natively what the legacy shader did by
  // hand — `opacity` scales alpha, `emissive × emissiveMap` is exactly the old
  // `uEmissive * tex.rgb` — so no shader code is involved and the semantics
  // cannot drift. This is what keeps the lit path a one-line switch instead of
  // a 99-file refactor.
  const uOpacity = {}
  Object.defineProperty(uOpacity, 'value', {
    get: () => base.opacity,
    set: (v) => { base.opacity = v },
    configurable: true, enumerable: true,
  })
  const uEmissive = {}
  Object.defineProperty(uEmissive, 'value', {
    get: () => base.emissive,
    set: (v) => { base.emissive.copy(v) },
    configurable: true, enumerable: true,
  })
  const uMap = {}
  Object.defineProperty(uMap, 'value', {
    get: () => base.map,
    // the emissive slot must follow the albedo, or an animated texture (flame
    // frames, water scroll) would keep emitting its first frame forever
    set: (t) => { base.map = t; base.emissiveMap = t ?? white1x1(); base.needsUpdate = true },
    configurable: true, enumerable: true,
  })

  const mat = new CustomShaderMaterial({
    baseMaterial: base,
    vertexShader: CSM_VERT,
    fragmentShader: CSM_FRAG,
    uniforms: {
      uTime: globalUniforms.uTime,
      uWindAmp: { value: wind },
      uLanternPos: globalUniforms.uLanternPos,
      uLanternStr: globalUniforms.uLanternStr,
      // an emitter's diffuse is black ON PURPOSE — flooring it would put it
      // back to catching moonlight, so it gets a floor of its own at zero
      uAlbedoFloor: isEmitter ? { value: 0 } : globalUniforms.uAlbedoFloor,
      // an emitter has no albedo to darken
      uGroundDarken: isEmitter ? { value: 1 } : globalUniforms.uGroundDarken,
      uVertexTint: globalUniforms.uVertexTint,
      uGroundMacro: isEmitter ? { value: 0 } : globalUniforms.uGroundMacro,
      uOpacity, uEmissive, uMap,
    },
    silent: true,
  })
  // The tag the shadow pass keys off. Only surfaces that actually participate
  // in lighting get shadow flags — sky, stars, water, particles and every glow
  // quad stay on raw ShaderMaterial and are therefore excluded by construction,
  // rather than by a name heuristic that would rot the first time a mesh is
  // renamed. `transparent` is remembered so halos never cast a solid shadow.
  mat.userData.lit = true
  mat.userData.emitter = isEmitter
  mat.userData.castable = !transparent && opacity >= 0.99
  return mat
}

// The A/B switch. Every one of the ~99 retroMaterial() call sites flows
// through here, so one flag converts the whole world and one flag converts it
// back — which is what makes the Stage 1 before/after gate cheap to run and
// makes a revert a one-line change instead of 99.
let _lit = false
export function setLitPath(on) { _lit = !!on }
export function isLitPath() { return _lit }

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
  // `ripple` is a bespoke water vertex effect with no lit equivalent yet, so
  // water stays on the legacy path even when the flag is on (it is unlit FX,
  // not a surface the moon should reach).
  if (_lit && !arguments[0]?.ripple) {
    return litMaterial({
      map, emissive, alphaTest, transparent, opacity, wind, side, depthWrite, noFog,
      emitterGain: arguments[0]?.emitterGain ?? 1,
    })
  }
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
      // live references: mutating texture.repeat/.offset flows straight to the GPU
      uMapRepeat: { value: map ? map.repeat : new THREE.Vector2(1, 1) },
      uMapOffset: { value: map ? map.offset : new THREE.Vector2(0, 0) },
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
      uSnapEnable: globalUniforms.uSnapEnable,
      uSnapRes: globalUniforms.uSnapRes,
      uAffineMix: globalUniforms.uAffineMix,
      uLodBias: globalUniforms.uLodBias,
      uLanternPos: globalUniforms.uLanternPos,
      uLanternStr: globalUniforms.uLanternStr,
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
