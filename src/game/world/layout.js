// World layout (MASTER_PROMPT 3.1): one continuous 400×400m heightfield with
// regional features. North = -z. Topology:
//
//                 isle (0,-150)
//                      | causeway
//   ruins (-110,0) — PARK (0,0) — village (110,0) — rooftops (125,-8, elevated)
//         |                            |
//   gloomspire (-110,110) ——————— mosswood (60,110)
//         |
//   hall (interior, -110,152, through the castle's red door)

const sstep = (a, b, x) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}
const clamp = (v, a, b) => Math.max(a, Math.min(b, v))

export const WATER_Y = -1.2

// Village street: S-curve climbing east, x∈[72,148]. Returns street center z.
export function streetZ(x) {
  return 6 * Math.sin(((x - 75) / 70) * Math.PI)
}
export function streetH(x) {
  return 8 * sstep(75, 145, x)
}

// Rooftop strip: north side of the street (walkable roofs, ladder ramp).
export function roofInfo(x, z) {
  const sz = streetZ(x)
  const inStrip = x > 100 && x < 140 && z > sz - 13.5 && z < sz - 5.5
  const roofH = streetH(x) + 5.6
  // ladder ramp behind the bakery (x 122..126): climbs from street to roof
  const inRamp = x > 122 && x < 126 && z > sz - 5.5 && z < sz - 1
  return { inStrip, inRamp, roofH, sz }
}

export function heightAt(x, z) {
  // base rolling ground
  let h = 0.35 * Math.sin(x * 0.045) * Math.cos(z * 0.05) + 0.25 * Math.sin((x + z) * 0.03)

  // — Park clearing (0,0): gentle, path ring flattened —
  const dPark = Math.hypot(x, z)
  if (dPark < 45) {
    let hp = 0.45 * Math.sin(x * 0.07) * Math.cos(z * 0.08) + 0.3 * Math.sin((x + z) * 0.045)
    const pathBand = Math.abs(dPark - 18)
    if (pathBand < 3) hp *= 0.35 + 0.65 * (pathBand / 3)
    h = hp
  }

  // — Sea basin north —
  const seaMask = sstep(-58, -82, z)
  h = h * (1 - seaMask) + -3.2 * seaMask

  // — Isle: island rises from the sea —
  const rI = Math.hypot(x, z + 150)
  if (rI < 48) {
    const islandH = 1.4 + 6.4 * sstep(34, 9, rI)
    const m = sstep(44, 34, rI)
    h = h * (1 - m) + islandH * m
    // sandy cove shelf on the south face
    if (rI > 27 && rI < 36 && z > -152) h = Math.min(h, 1.0)
  }

  // — Park→Isle causeway over the water —
  if (Math.abs(x) < 2.8 && z < -38 && z > -134) {
    const m = sstep(-38, -46, z) * sstep(-134, -128, z)
    h = Math.max(h, 0.7 * m + Math.max(h, 0) * (1 - m))
    if (z < -46 && z > -128) h = Math.max(h, 0.7)
  }

  // — Village: street climbs 8m eastward —
  const dV = Math.hypot(x - 110, z)
  if (dV < 55) {
    const m = sstep(55, 40, dV)
    const hv = streetH(x) + 0.3 * Math.sin(x * 0.11) * Math.cos(z * 0.13)
    h = h * (1 - m) + hv * m
  }

  // — Rooftops strip + ladder ramp (elevated walkable) —
  const roof = roofInfo(x, z)
  if (roof.inStrip) h = roof.roofH
  else if (roof.inRamp) {
    const t = (roof.sz - 1 - z) / 4.5 // 0 at street edge → 1 at roof edge
    h = streetH(x) + clamp(t, 0, 1) * 5.6
  }

  // — Ruins plateau west —
  const dR = Math.hypot(x + 110, z)
  if (dR < 50) {
    const m = sstep(50, 34, dR)
    const hr = 0.9 + 0.35 * Math.sin(x * 0.09) * Math.cos(z * 0.11)
    h = h * (1 - m) + hr * m
  }

  // — Gloomspire: moat ring + castle grounds + approach causeway —
  const dG = Math.hypot(x + 110, z - 125)
  if (dG < 42) {
    let hg
    if (dG < 14) hg = 1.3
    else if (dG < 30) hg = -2.8 // the moat
    else hg = 0.8
    const m = sstep(42, 36, dG)
    h = h * (1 - m) + hg * m
  }
  // approach causeway across the moat (from the north/ruins side)
  if (Math.abs(x + 110) < 2.6 && z > 88 && z < 127) h = Math.max(h, 0.9)

  // — Hall interior floor (behind the castle) —
  const dH = Math.hypot(x + 110, z - 152)
  if (dH < 26) {
    const m = sstep(26, 20, dH)
    h = h * (1 - m) + 1.3 * m
  }

  // — Mosswood floor —
  const dM = Math.hypot(x - 60, z - 110)
  if (dM < 46) {
    const m = sstep(46, 34, dM)
    const hm = 0.5 + 0.4 * Math.sin(x * 0.13) * Math.cos(z * 0.12) * 0.5
    h = h * (1 - m) + hm * m
  }

  return h
}

export function surfaceAt(x, z) {
  const roof = roofInfo(x, z)
  if (roof.inStrip || roof.inRamp) return 'shingle'
  // village street
  if (x > 72 && x < 148 && Math.abs(z - streetZ(x)) < 4) return 'cobble'
  // causeways
  if (Math.abs(x) < 2.8 && z < -40 && z > -134) return 'cobble'
  if (Math.abs(x + 110) < 2.6 && z > 88 && z < 127) return 'cobble'
  // hall + castle grounds
  if (Math.hypot(x + 110, z - 152) < 26 || Math.hypot(x + 110, z - 125) < 14) return 'cobble'
  // ruins colonnade avenue
  if (Math.hypot(x + 110, z) < 40 && Math.abs(z) < 5) return 'cobble'
  // park loop path
  if (Math.abs(Math.hypot(x, z) - 18) < 1.8) return 'dirt'
  // mosswood path (west→arch eastward at z≈110)
  if (Math.abs(z - 110) < 2.5 && x > 18 && x < 86) return 'dirt'
  // isle coves
  const rI = Math.hypot(x, z + 150)
  if (rI > 26 && rI < 37 && heightAt(x, z) < 1.4 && z > -160) return 'sand'
  return 'grass'
}

// World bounds (soft clamp box)
export const BOUNDS = { minX: -175, maxX: 175, minZ: -205, maxZ: 185 }

// Mosswood arch world-edge: walking through loops you back (Part 3.2.7)
export const MOSSWOOD_ARCH = { x: 84, z: 110, halfW: 3.5, beyond: 8 }
