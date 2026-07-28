// FIN-1 — the post chain (TOOLKIT §1.3, §3).
//
// This replaces the 480×270 nearest render target and the hand-written
// quantize/dither/vignette shader. That old pipeline was internally consistent
// but colour-INCORRECT: textures were sampled raw (NoColorSpace), colours were
// linear, and the result was written to the canvas with no sRGB encoding. It
// looked right only because the two errors cancelled. Physically-based
// lighting cannot survive that — a MeshStandardMaterial computes in linear
// space and must be encoded on the way out, or every mid-tone crushes.
//
// So the chain is now: scene → linear HDR buffer → effects → AgX → sRGB canvas.
//
// Order is not taste (§3): SMAA runs first because it needs unblurred edges,
// AO before anything that adds light, bloom before tone mapping so the tone
// curve sees the real HDR peak, LUT after tone mapping because it grades
// display-referred colour, and grain dead last so it is not itself filtered.

import * as THREE from 'three'
import {
  EffectComposer, RenderPass, EffectPass,
  SMAAEffect, SMAAPreset,
  BloomEffect, ToneMappingEffect, ToneMappingMode,
  VignetteEffect, NoiseEffect, BlendFunction, LUT3DEffect,
} from 'postprocessing'
import { nightGrade } from './grade.js'
import { N8AOPostPass } from 'n8ao'

export class Composer {
  constructor(renderer, scene, camera) {
    this.renderer = renderer
    this.scene = scene
    this.camera = camera

    // The two renderer settings that make the whole chain legal.
    // NoToneMapping is not an omission: tone mapping happens ONCE, inside the
    // chain. Leaving the renderer's own tone mapping on is the classic
    // double-tone-mapped washout (§1.3).
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.toneMapping = THREE.NoToneMapping
    renderer.toneMappingExposure = 1

    // HalfFloat, or bloom and AgX have nothing above 1.0 to work with and the
    // night sky bands visibly (§3).
    this.composer = new EffectComposer(renderer, {
      frameBufferType: THREE.HalfFloatType,
    })
    this.composer.addPass(new RenderPass(scene, camera))

    // Ambient occlusion. Half resolution — at night AO is contact darkening in
    // creases, and nobody can see the resolution of a shadow they can barely
    // see. `aoTones` keeps it from turning into a grey wash.
    const ao = new N8AOPostPass(scene, camera, 1, 1)
    ao.configuration.aoRadius = 1.6
    ao.configuration.distanceFalloff = 1.0
    ao.configuration.intensity = 2.4
    ao.configuration.aoSamples = 16
    ao.configuration.denoiseSamples = 8
    ao.configuration.denoiseRadius = 12
    // AO must not paint neutral grey into a world whose whole law is that
    // shade is coloured — tint the occlusion toward the same violet the
    // hemisphere light floors at.
    ao.configuration.color = new THREE.Color('#131A2E')
    ao.setQualityMode('Low')
    this.ao = ao
    this.composer.addPass(ao)

    this.smaa = new SMAAEffect({ preset: SMAAPreset.ULTRA })

    // Night bloom's one trap (§3): the default luminanceThreshold is 1.0, so
    // with an LDR scene NOTHING blooms and the effect looks broken. The
    // emitters are pushed into HDR (emissiveIntensity > 1) and the threshold
    // sits below them but above the moonlit ground, so only real light sources
    // glow — which is also how the accent budget stays spent on light.
    this.bloom = new BloomEffect({
      intensity: 1.5,
      luminanceThreshold: 0.72,
      luminanceSmoothing: 0.22,
      mipmapBlur: true,
      radius: 0.72,
    })

    // Vignette is doing compositional work here, not mood: DIRECTION Part 11.2
    // wants the outer 15% at least 25% darker than the centre third, and the
    // Village measured 0.115 — its edges were nearly as bright as its middle,
    // which is why the street read as flat. Raised until the three zones clear
    // the rule with margin.
    //
    // This is a PARTIAL remedy and should be recorded as one: the real fix is
    // dark gable masses framing both edges of the street (Part 7.2 asks for
    // exactly that). A vignette darkens whatever happens to be at the edge; it
    // does not put anything there.
    this.vignette = new VignetteEffect({ offset: 0.26, darkness: 0.62 })

    this.toneMapping = new ToneMappingEffect({ mode: ToneMappingMode.AGX })

    // Fine grain, last in the chain so nothing downstream filters it. Kept low
    // — this is film grain, not noise.
    this.noise = new NoiseEffect({
      blendFunction: BlendFunction.OVERLAY,
      premultiply: true,
    })
    this.noise.blendMode.opacity.value = 0.09

    // The grade. AFTER tone mapping, because it enforces a palette specified
    // as hex values — i.e. display-referred. Tetrahedral interpolation is what
    // keeps a 33-cube from banding across a night sky (§3).
    this.lut = new LUT3DEffect(nightGrade(), { tetrahedralInterpolation: true })

    // One EffectPass merges all of these into a single compound shader (§3),
    // so this is one draw, not six.
    this.effectPass = new EffectPass(
      camera,
      this.smaa,
      this.bloom,
      this.vignette,
      this.toneMapping,
      this.lut,
      this.noise,
    )
    this.composer.addPass(this.effectPass)

    // Banding on large night gradients is otherwise guaranteed (§1.3).
    renderer.getContext() // ensure context exists before first resize
    this.viewport = new THREE.Vector4(0, 0, 2, 2)
  }

  // The dream world is a different scene and camera. Everything downstream of
  // RenderPass is scene-agnostic, so rebinding the three passes that actually
  // hold a reference is enough — and far cheaper than a second composer.
  bind(scene, camera) {
    if (scene === this.scene && camera === this.camera) return
    this.scene = scene
    this.camera = camera
    for (const pass of this.composer.passes) {
      pass.mainScene = scene
      pass.mainCamera = camera
    }
    this.ao.scene = scene
    this.ao.camera = camera
  }

  // Rebuild the grade from new parameters. Used by the live tuning knobs so the
  // curve can be swept against composecheck instead of guessed at.
  setGrade(params) {
    const next = nightGrade(params)
    const old = this.lut.lut
    this.lut.lut = next
    old?.dispose?.()
    return next
  }

  setSize(cssW, cssH) {
    this.composer.setSize(cssW, cssH, true)
    const dpr = this.renderer.getPixelRatio()
    this.ao.setSize(cssW * dpr, cssH * dpr)
  }

  render(dt) {
    this.composer.render(dt)
  }

  get lastInfo() {
    return {
      calls: this.renderer.info.render.calls,
      triangles: this.renderer.info.render.triangles,
    }
  }

  dispose() { this.composer.dispose() }
}
