// FIN-1 — the night grade, as a 3D LUT (TOOLKIT §1.3, §3).
//
// AgX is a well-behaved tone curve but a deliberately gentle one: it protects
// highlights and keeps hue stable, and in exchange it hands back a low-contrast
// image. TOOLKIT's prescription is exactly that — AgX for the transform,
// CONTRAST RESTORED IN THE LUT — and skipping the LUT is why the first lit
// build measured whole frames crammed into a single L* band. The Rooftops pose
// sat at p10 28.1 / p50 31.6 / p90 32.9: no shadows, no highlights, all
// mid-tone. That is not a lighting failure, it is a missing grade.
//
// The LUT runs AFTER tone mapping, so it operates on display-referred colour —
// which is the right place to enforce a palette, because the palette in
// DIRECTION Part 7 is specified as hex values, i.e. display-referred.
//
// Generated procedurally rather than authored in a file: the project ships no
// binary assets, and a curve written as code can state its own reasoning.

import { LookupTexture } from 'postprocessing'

// 32³ is the floor TOOLKIT gives for avoiding banding in a gradient this wide;
// 33 makes the neutral axis land exactly on a sample so greys stay grey.
const SIZE = 33

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v)

// LookupTexture's domain is srgb-linear (that is what createNeutral() builds),
// so the DIRECTION Part 7 anchors — which are authored as display hex — have
// to be decoded before they can be used as tint targets. Doing the conversion
// here rather than pasting pre-computed numbers keeps the palette legible
// against the spec.
const srgbToLinear = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
const anchor = (hex) => {
  const n = parseInt(hex.slice(1), 16)
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255].map(srgbToLinear)
}
// Shadows are pulled toward cold blue, never toward black or toward grey.
const SHADOW_TINT = anchor('#0B1220')   // deep navy
const MID_TINT = anchor('#16243A')      // cold blue
const HIGH_TINT = anchor('#E8E4FF')     // soft white

/**
 * The night grade.
 *
 * @param contrast  S-curve strength around the pivot. >1 restores the punch AgX
 *                  gives up. This is the knob the readability gate responds to.
 * @param pivot     Where the S-curve hinges. Low, because this is a night game:
 *                  hinging at 0.5 would crush everything the player looks at.
 * @param shadowMix How far the darkest values are pulled toward cold blue.
 * @param highMix   How far the brightest values are pulled toward soft white.
 * @param sat       Global saturation. Below 1 because a night frame that keeps
 *                  full chroma reads as a cartoon, and because the Village sky
 *                  was arriving at royal blue instead of deep navy.
 */
export function nightGrade({
  contrast = 1.55, pivot = 0.12, shadowMix = 0.30, highMix = 0.12, sat = 0.86,
  blackFloor = 0.06,
} = {}) {
  const n = SIZE
  // Float32 RGBA in 0..1 — LookupTexture is a FloatType Data3DTexture, and
  // handing it bytes silently produces a black cube.
  const data = new Float32Array(n * n * n * 4)
  for (let bi = 0; bi < n; bi++) {
    for (let gi = 0; gi < n; gi++) {
      for (let ri = 0; ri < n; ri++) {
        let r = ri / (n - 1), g = gi / (n - 1), b = bi / (n - 1)

        // 1. contrast around a low pivot — the actual readability fix
        r = pivot + (r - pivot) * contrast
        g = pivot + (g - pivot) * contrast
        b = pivot + (b - pivot) * contrast
        r = clamp01(r); g = clamp01(g); b = clamp01(b)

        // 1b. black floor — the "shade is never black" law, made part of the
        // GRADE rather than left to the lighting to respect. Raising contrast
        // around a pivot drives everything below the pivot toward negative and
        // the clamp turns that into true black: at contrast 1.55 the Village
        // crushed 11.4% of its pixels. Remapping [0,1] onto [floor,1] instead
        // means the curve can be as punchy as the frame needs and STILL cannot
        // produce a black pixel. 0.012 linear is about L*10.
        r = blackFloor + r * (1 - blackFloor)
        g = blackFloor + g * (1 - blackFloor)
        b = blackFloor + b * (1 - blackFloor)

        // 2. tinted shade / tinted light. Weighted by luminance so the tint
        //    lands where it belongs and the mid-tones stay the zone's own
        //    colour rather than everything drifting to one hue.
        const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b
        const sw = (1 - lum) * (1 - lum) * shadowMix
        const hw = lum * lum * highMix
        const mw = 4 * lum * (1 - lum) * shadowMix * 0.35
        r = r * (1 - sw - hw - mw) + SHADOW_TINT[0] * sw + HIGH_TINT[0] * hw + MID_TINT[0] * mw
        g = g * (1 - sw - hw - mw) + SHADOW_TINT[1] * sw + HIGH_TINT[1] * hw + MID_TINT[1] * mw
        b = b * (1 - sw - hw - mw) + SHADOW_TINT[2] * sw + HIGH_TINT[2] * hw + MID_TINT[2] * mw

        // 3. saturation, about the graded luminance
        const l2 = 0.2126 * r + 0.7152 * g + 0.0722 * b
        r = l2 + (r - l2) * sat
        g = l2 + (g - l2) * sat
        b = l2 + (b - l2) * sat

        const i = (ri + gi * n + bi * n * n) * 4
        data[i] = clamp01(r)
        data[i + 1] = clamp01(g)
        data[i + 2] = clamp01(b)
        data[i + 3] = 1
      }
    }
  }
  const lut = new LookupTexture(data, n)
  lut.needsUpdate = true
  return lut
}
