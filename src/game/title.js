// ============================================================
// EMBERVALE — title backdrop: a painted recreation of the
// reference shot. Castle on the storm-lit mountain, lantern
// valley, winding cobble road, torch and sword in hand.
// Painted once to an offscreen canvas; flame/embers animate.
// ============================================================
import { VIEW_W, VIEW_H } from './data.js'
import { hash2 } from './sprites.js'

function mulberry(seed) {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

let scene = null
let handsLayer = null

export function buildTitleScene() {
  scene = document.createElement('canvas')
  scene.width = VIEW_W
  scene.height = VIEW_H
  const g = scene.getContext('2d')
  const R = mulberry(20260721)
  const W = VIEW_W
  const H = VIEW_H

  // ---------- sky: storm purple, brighter toward the ridge ----------
  const sky = g.createLinearGradient(0, 0, 0, H * 0.55)
  sky.addColorStop(0, '#1b1430')
  sky.addColorStop(0.55, '#2c2044')
  sky.addColorStop(0.85, '#4a3358')
  sky.addColorStop(1, '#6a4560')
  g.fillStyle = sky
  g.fillRect(0, 0, W, H * 0.56)

  // big swirling cloud masses (reference: heavy purple storm clouds)
  for (let m = 0; m < 9; m++) {
    const mx = R() * W
    const my = R() * H * 0.34
    const mw = 50 + R() * 110
    const mh = 12 + R() * 22
    for (let i = 0; i < 60; i++) {
      const t2 = R()
      const px2 = mx + (R() - 0.5) * mw
      const py2 = my + (R() - 0.5) * mh * (1 - Math.abs(px2 - mx) / mw)
      const a = 0.06 + R() * 0.12
      g.fillStyle = t2 > 0.65 ? `rgba(130,95,140,${a})` : `rgba(32,22,52,${a + 0.08})`
      g.fillRect(px2, py2, 6 + R() * 22, 2 + R() * 3)
    }
    // lit underbelly
    for (let i = 0; i < 16; i++) {
      g.fillStyle = `rgba(205,160,200,${0.05 + R() * 0.09})`
      g.fillRect(mx + (R() - 0.5) * mw * 0.9, my + mh * 0.35 + R() * 3, 5 + R() * 16, 1)
    }
  }
  // moonlit cloud rims
  for (let i = 0; i < 80; i++) {
    const cy = 8 + R() * H * 0.3
    g.fillStyle = `rgba(210,180,220,${0.05 + R() * 0.09})`
    g.fillRect(R() * W, cy, 6 + R() * 22, 1)
  }

  // ---------- far mountains ----------
  paintRidge(g, R, H * 0.34, H * 0.56, '#241a38', '#31244a', 0.5)
  paintRidge(g, R, H * 0.4, H * 0.56, '#1c1530', '#282040', 0.8)

  // ---------- the castle mount: jagged, rocky, imposing ----------
  const cx = W * 0.5
  const mountTop = H * 0.22
  g.fillStyle = '#171021'
  g.beginPath()
  g.moveTo(cx - 102, H * 0.565)
  g.lineTo(cx - 62, H * 0.45)
  g.lineTo(cx - 40, H * 0.44)
  g.lineTo(cx - 26, mountTop + 32)
  g.lineTo(cx + 2, mountTop + 24)
  g.lineTo(cx + 30, mountTop + 34)
  g.lineTo(cx + 48, H * 0.43)
  g.lineTo(cx + 72, H * 0.47)
  g.lineTo(cx + 106, H * 0.565)
  g.closePath()
  g.fill()
  // rocky facets: sharp diagonal strokes, lit from upper-left
  for (let i = 0; i < 220; i++) {
    const t = R()
    const yy = mountTop + 26 + t * (H * 0.58 - mountTop - 26)
    const spread = 22 + t * 165
    const xx = cx + (R() - 0.5) * spread
    if (R() > 0.55) {
      g.fillStyle = `rgba(96,74,120,${0.10 + R() * 0.12})`
      g.fillRect(xx, yy, 1 + R() * 4, 1)
      g.fillRect(xx - 1, yy + 1, 1 + R() * 2, 1)
    } else {
      g.fillStyle = `rgba(6,4,12,${0.25 + R() * 0.2})`
      g.fillRect(xx, yy, 2 + R() * 5, 1 + R() * 2)
    }
  }
  // snow dusting near the top
  for (let i = 0; i < 40; i++) {
    const yy = mountTop + 26 + R() * 26
    g.fillStyle = `rgba(190,170,215,${0.08 + R() * 0.1})`
    g.fillRect(cx + (R() - 0.5) * (30 + (yy - mountTop) * 2), yy, 1 + R() * 3, 1)
  }

  // castle silhouette — tall gothic cluster like the reference
  const baseY = mountTop + 28
  g.fillStyle = '#100b1a'
  // curtain wall
  g.fillRect(cx - 44, baseY - 12, 88, 24)
  for (let i = -44; i < 44; i += 5) g.fillRect(cx + i, baseY - 15, 3, 3)
  // main keep with crenellated top
  g.fillRect(cx - 24, baseY - 42, 48, 46)
  for (let i = -24; i < 24; i += 4) g.fillRect(cx + i, baseY - 45, 2, 3)
  // flanking towers
  tower(g, cx - 44, baseY - 30, 11, 32)
  tower(g, cx + 33, baseY - 33, 11, 35)
  tower(g, cx - 22, baseY - 62, 10, 34)
  tower(g, cx + 12, baseY - 56, 10, 30)
  // central grand spire + side needle spires
  tower(g, cx - 5, baseY - 74, 10, 32)
  tower(g, cx - 32, baseY - 48, 6, 20)
  tower(g, cx + 27, baseY - 50, 6, 22)
  // caps
  g.fillStyle = '#0a0612'
  cap(g, cx - 44, baseY - 30, 11)
  cap(g, cx + 33, baseY - 33, 11)
  cap(g, cx - 22, baseY - 62, 10)
  cap(g, cx + 12, baseY - 56, 10)
  cap(g, cx - 5, baseY - 74, 10)
  cap(g, cx - 32, baseY - 48, 6)
  cap(g, cx + 27, baseY - 50, 6)
  // moon rim-light on left edges
  g.fillStyle = 'rgba(178,142,210,0.5)'
  g.fillRect(cx - 44, baseY - 30, 1, 32)
  g.fillRect(cx - 24, baseY - 42, 1, 44)
  g.fillRect(cx - 22, baseY - 62, 1, 34)
  g.fillRect(cx - 5, baseY - 74, 1, 32)
  g.fillStyle = 'rgba(165,130,195,0.18)'
  g.fillRect(cx + 12, baseY - 56, 1, 30)
  // lit windows — warm ember light like the reference
  g.fillStyle = '#ffc45e'
  const winSpots = [
    [-18, -26], [-10, -34], [-2, -20], [8, -30], [16, -24],
    [-1, -66], [-17, -54], [17, -48], [-40, -22], [37, -26], [0, -52],
    [-14, -22], [5, -38], [12, -60], [-20, -40], [-6, -28], [10, -18],
  ]
  for (const [wx, wy] of winSpots) {
    if (R() > 0.25) {
      g.fillRect(cx + wx, baseY + wy, 1, 2)
      g.fillStyle = 'rgba(255,196,94,0.2)'
      g.fillRect(cx + wx - 1, baseY + wy - 1, 3, 4)
      g.fillStyle = '#ffc45e'
    }
  }

  // subtle stone facets & buttresses so the castle reads as mass, not blob
  g.fillStyle = 'rgba(84,64,116,0.16)'
  g.fillRect(cx - 24, baseY - 42, 19, 46) // moon-lit west face of keep
  g.fillRect(cx - 44, baseY - 30, 5, 32)
  g.fillRect(cx - 22, baseY - 62, 4, 34)
  g.fillStyle = 'rgba(4,2,10,0.55)'
  g.fillRect(cx - 12, baseY - 40, 1, 44)
  g.fillRect(cx + 3, baseY - 40, 1, 44)
  g.fillRect(cx + 18, baseY - 36, 1, 40)
  g.fillStyle = 'rgba(60,45,90,0.35)'
  g.fillRect(cx - 44, baseY - 12, 88, 1) // curtain wall cornice
  // fog clinging to the castle base
  for (let i = 0; i < 46; i++) {
    const fy = baseY + 6 + R() * 16
    g.fillStyle = `rgba(150,128,170,${0.06 + R() * 0.1})`
    g.fillRect(cx - 70 + R() * 140, fy, 8 + R() * 26, 2)
  }

  // striations on the lower ridge band so it reads as slopes, not a wall
  for (let i = 0; i < 160; i++) {
    const sy = H * 0.44 + R() * H * 0.12
    g.fillStyle = R() > 0.5 ? `rgba(70,52,96,${0.05 + R() * 0.08})` : `rgba(8,5,16,${0.08 + R() * 0.1})`
    g.fillRect(R() * W, sy, 8 + R() * 30, 1)
  }
  // distant conifer treeline against the mountain base
  for (let i = 0; i < 210; i++) {
    const txx = R() * W
    const th = 3 + R() * 7
    const tyy = H * 0.545 - th
    g.fillStyle = `rgba(14,18,22,${0.5 + R() * 0.3})`
    g.beginPath()
    g.moveTo(txx - 2, tyy + th)
    g.lineTo(txx + 2, tyy + th)
    g.lineTo(txx, tyy)
    g.closePath()
    g.fill()
  }

  // warm dusk haze at the horizon line
  const haze = g.createLinearGradient(0, H * 0.47, 0, H * 0.58)
  haze.addColorStop(0, 'rgba(150,90,100,0)')
  haze.addColorStop(0.6, 'rgba(170,105,105,0.16)')
  haze.addColorStop(1, 'rgba(120,70,80,0)')
  g.fillStyle = haze
  g.fillRect(0, H * 0.47, W, H * 0.12)
  // mist band under the castle
  for (let i = 0; i < 240; i++) {
    const my = H * 0.47 + R() * H * 0.1
    g.fillStyle = `rgba(172,148,190,${0.08 + R() * 0.1})`
    g.fillRect(R() * W, my, 14 + R() * 46, 2)
  }

  // ---------- valley: forested hills ----------
  const horizonY = H * 0.55
  // rolling hill bands, brighter (moon/dusk-lit) then darker toward camera
  const hillBands = [
    { y: horizonY, h: 26, base: '#2c4030', hi: '#4d6a44', lit: 0.9 },
    { y: horizonY + 20, h: 34, base: '#243626', hi: '#40593a', lit: 0.7 },
    { y: horizonY + 48, h: 46, base: '#1c2b1e', hi: '#33472f', lit: 0.5 },
    { y: horizonY + 88, h: 70, base: '#141f16', hi: '#263624', lit: 0.35 },
  ]
  for (const band of hillBands) {
    g.fillStyle = band.base
    g.beginPath()
    g.moveTo(0, band.y + 8)
    for (let x = 0; x <= W; x += 16) {
      g.lineTo(x, band.y + Math.sin(x * 0.02 + band.y) * 5 + R() * 3)
    }
    g.lineTo(W, band.y + band.h + 24)
    g.lineTo(0, band.y + band.h + 24)
    g.closePath()
    g.fill()
    // contiguous forest masses: clusters of overlapping canopy dabs
    const clusters = 9 + ((band.h / 8) | 0)
    for (let c = 0; c < clusters; c++) {
      const mx = R() * W
      const my = band.y + 4 + R() * band.h * 0.8
      const mw = 26 + R() * 70
      const dabs = (mw / 1.5) | 0
      // dark mass first — stepped rect blobs, no anti-aliased ellipses
      for (let i = 0; i < dabs; i++) {
        const bx = Math.round(mx + (R() - 0.5) * mw)
        const by = Math.round(my + (R() - 0.5) * band.h * 0.5)
        const bw = 4 + ((R() * 7) | 0)
        g.fillStyle = `rgba(8,16,9,0.6)`
        g.fillRect(bx - (bw >> 1), by, bw, 3)
        g.fillRect(bx - (bw >> 1) + 1, by - 1, bw - 2, 1)
        g.fillRect(bx - (bw >> 1) + 1, by + 3, bw - 2, 1)
      }
      // lit crowns on the upper-left of the mass (3-value ramp)
      for (let i = 0; i < dabs * 0.8; i++) {
        const bx = Math.round(mx + (R() - 0.5) * mw * 0.9)
        const by = Math.round(my + (R() - 0.5) * band.h * 0.42)
        const bw = 3 + ((R() * 6) | 0)
        const litA = band.lit * (0.38 + R() * 0.34)
        g.fillStyle = R() > 0.5 ? `rgba(105,150,78,${litA})` : `rgba(76,118,62,${litA})`
        g.fillRect(bx - (bw >> 1) - 1, by - 1, bw, 2)
        g.fillRect(bx - (bw >> 1), by - 2, bw - 2, 1)
        if (R() > 0.55) {
          g.fillStyle = `rgba(170,210,115,${litA * 0.8})`
          g.fillRect(bx - (bw >> 1), by - 3, Math.max(1, bw >> 1), 1)
        }
      }
    }
    // meadow glints between masses
    for (let i = 0; i < 30; i++) {
      g.fillStyle = `rgba(140,175,90,${band.lit * (0.05 + R() * 0.08)})`
      g.fillRect(R() * W, band.y + R() * band.h, 3 + R() * 8, 1)
    }
  }

  // ---------- the winding road ----------
  // S-curve from bottom-center up the valley
  const path = (t) => {
    const y = H - t * (H - horizonY - 6)
    const x = W * 0.5 + Math.sin(t * 5.2 + 0.4) * (1 - t) * W * 0.16
    return [x, y]
  }
  for (let t = 0; t < 1; t += 0.004) {
    const [x, y] = path(t)
    const half = (1 - t) * 26 + 2
    // road base
    g.fillStyle = `rgba(75,64,52,0.9)`
    g.fillRect(x - half, y, half * 2, 3)
  }
  // cobble dabs: twilight tan, warmed only where the torch reaches
  const torchX = W * 0.16
  const torchY = H * 0.72
  for (let t = 0; t < 1; t += 0.0025) {
    const [x, y] = path(t)
    const half = (1 - t) * 24 + 1
    const n = Math.max(1, (half / 3) | 0)
    for (let i = 0; i < n; i++) {
      const px = x + (R() - 0.5) * half * 2
      const bright = (1 - t) * (0.4 + R() * 0.4)
      const sw = 1 + (1 - t) * 3.5 * R()
      const dTorch = Math.hypot(px - torchX, y - torchY)
      const warm = Math.max(0, 1 - dTorch / 240)
      const rr2 = R()
      if (rr2 > 0.45) {
        g.fillStyle = `rgba(${138 + warm * 80}, ${115 + warm * 48}, ${85 + warm * 12}, ${0.4 + bright * 0.4})`
      } else {
        g.fillStyle = `rgba(${112 + warm * 60}, ${94 + warm * 36}, ${70 + warm * 8}, ${0.35 + bright * 0.35})`
      }
      g.fillRect(px, y + (R() - 0.5) * 2, sw + 1, Math.max(1, sw * 0.6))
      if (R() > 0.8) {
        g.fillStyle = `rgba(${168 + warm * 64}, ${142 + warm * 40}, ${104 + warm * 8}, ${0.3 + bright * 0.35})`
        g.fillRect(px, y - 1, Math.max(1, sw * 0.7), 1)
      }
    }
  }

  // ---------- village: houses clustered along the road ----------
  for (let i = 0; i < 18; i++) {
    const t = 0.5 + R() * 0.38
    const [rx, ry] = path(t)
    const side = R() > 0.5 ? 1 : -1
    const roadHalf = (1 - t) * 26 + 2
    const s0 = (1 - t) * 11 + 3
    const off = side * (roadHalf + s0 * 0.8 + 3 + R() * 34 * (1 - t + 0.3))
    const hx = rx + off
    const hy = ry + (R() - 0.5) * 6
    const s = (1 - t) * 11 + 3
    // house: red roof, plaster wall, lit window
    g.fillStyle = 'rgba(8,6,10,0.55)'
    g.fillRect(hx - s / 2, hy + s * 0.35, s + 2, 2)
    g.fillStyle = R() > 0.35 ? '#7e3040' : '#6d4434'
    g.beginPath()
    g.moveTo(hx - s / 2 - 1, hy)
    g.lineTo(hx + s / 2 + 1, hy)
    g.lineTo(hx + s / 2 - 1, hy - s * 0.45)
    g.lineTo(hx - s / 2 + 1, hy - s * 0.45)
    g.closePath()
    g.fill()
    g.fillStyle = '#a8485a'
    g.fillRect(hx - s / 2, hy - s * 0.45, s * 0.6, 1)
    g.fillStyle = '#9a8a70'
    g.fillRect(hx - s / 2, hy, s, s * 0.4)
    g.fillStyle = '#ffc45e'
    g.fillRect(hx - s / 4, hy + 1, Math.max(1, s * 0.16), Math.max(1, s * 0.16))
    // hearth glow around the window
    g.fillStyle = 'rgba(255,170,80,0.14)'
    g.fillRect(hx - s / 4 - 2, hy - 1, 6, 5)
    // a lantern or two near each house
    if (R() > 0.4) {
      const lx2 = hx + (R() - 0.5) * s * 2
      const ly2 = hy + s * 0.5 + R() * 3
      g.fillStyle = 'rgba(255,190,90,0.8)'
      g.fillRect(lx2, ly2, 1, 1)
      g.fillStyle = 'rgba(255,160,70,0.2)'
      g.fillRect(lx2 - 1, ly2 - 1, 3, 3)
    }
  }
  // far lantern constellation deeper in the valley (clustered, not a strip)
  for (let c = 0; c < 6; c++) {
    const lcx = W * (0.15 + R() * 0.7)
    const lcy = horizonY + 8 + R() * 34
    const n = 3 + (R() * 6) | 0
    for (let i = 0; i < n; i++) {
      const lx = lcx + (R() - 0.5) * 26
      const ly = lcy + (R() - 0.5) * 10
      const a = 0.2 + R() * 0.5
      g.fillStyle = `rgba(255,190,90,${a})`
      g.fillRect(lx, ly, 1, 1)
      g.fillStyle = `rgba(255,160,70,${a * 0.22})`
      g.fillRect(lx - 1, ly - 1, 3, 3)
    }
  }

  // ---------- foreground framing trees (dark) ----------
  fgTree(g, R, -6, H * 0.1, 60, H)
  fgTree(g, R, W - 48, H * 0.04, 64, H)

  // soft global grade: cool shadows, warm center
  const grade = g.createRadialGradient(W * 0.5, H * 0.62, 40, W * 0.5, H * 0.62, W * 0.7)
  grade.addColorStop(0, 'rgba(255,190,120,0.06)')
  grade.addColorStop(0.6, 'rgba(20,10,40,0.08)')
  grade.addColorStop(1, 'rgba(10,5,25,0.35)')
  g.fillStyle = grade
  g.fillRect(0, 0, W, H)

  // ---------- hands layer (drawn over everything) ----------
  handsLayer = document.createElement('canvas')
  handsLayer.width = W
  handsLayer.height = H
  paintHands(handsLayer.getContext('2d'))
}

function tower(g, x, y, w, h) {
  g.fillRect(x, y, w, h)
  // crenellations
  for (let i = 0; i < w; i += 3) g.fillRect(x + i, y - 2, 2, 2)
}
function cap(g, x, y, w) {
  g.beginPath()
  g.moveTo(x - 1, y)
  g.lineTo(x + w + 1, y)
  g.lineTo(x + w / 2, y - 7)
  g.closePath()
  g.fill()
}

function paintRidge(g, R, top, bottom, colA, colB, jag) {
  g.fillStyle = colA
  g.beginPath()
  g.moveTo(0, bottom)
  let y = top + R() * 14
  for (let x = 0; x <= VIEW_W; x += 10) {
    y += (R() - 0.5) * 16 * jag
    y = Math.max(top - 10, Math.min(top + 30, y))
    g.lineTo(x, y)
  }
  g.lineTo(VIEW_W, bottom)
  g.closePath()
  g.fill()
  // snow/rock streaks
  for (let i = 0; i < 40; i++) {
    g.fillStyle = `rgba(170,150,200,${0.04 + R() * 0.07})`
    g.fillRect(R() * VIEW_W, top + R() * (bottom - top) * 0.5, 2 + R() * 5, 1)
  }
  g.fillStyle = colB
  for (let i = 0; i < 30; i++) {
    g.fillRect(R() * VIEW_W, top + R() * (bottom - top) * 0.6, 1 + R() * 3, 1)
  }
}

function fgTree(g, R, x, y, w, H) {
  // dark conifer silhouette built from stepped frond rows
  const cx2 = Math.round(x + w / 2)
  for (let yy = y; yy < H; yy += 3) {
    const t = (yy - y) / (H - y)
    const half = Math.round(4 + t * w * 0.5 + (R() - 0.5) * 3)
    g.fillStyle = '#0c1410'
    g.fillRect(cx2 - half, yy, half * 2, 3)
    // ragged frond tips
    if (R() > 0.4) g.fillRect(cx2 - half - 2, yy + 1, 2, 2)
    if (R() > 0.4) g.fillRect(cx2 + half, yy + 1, 2, 2)
  }
  for (let i = 0; i < 26; i++) {
    g.fillStyle = `rgba(90,140,100,${0.06 + R() * 0.09})`
    const ty2 = y + R() * (H - y) * 0.85
    const t = (ty2 - y) / (H - y)
    g.fillRect(cx2 - (4 + t * w * 0.5) + R() * (8 + t * w), ty2, 2 + R() * 4, 1)
  }
  // violet moon-rim on the inward silhouette edge
  const inward = x < VIEW_W / 2 ? 1 : -1
  for (let yy = y; yy < H; yy += 4) {
    const t = (yy - y) / (H - y)
    const half = Math.round(4 + t * w * 0.5)
    if (hash2(yy, x) > 0.35) {
      g.fillStyle = `rgba(96,84,132,${0.3 + hash2(x, yy) * 0.25})`
      g.fillRect(cx2 + inward * half - (inward > 0 ? 1 : 0), yy, 1, 3)
    }
  }
}

// ---------- the pilgrim (reference frame: robed figure overlooking the valley) ----------
// Foreground figure at 3x pixel scale — near objects carry larger pixels.
const HAND_SCALE = 3
export const TORCH_ANCHOR = { x: 0, y: 0 }

function buildPilgrim() {
  const c = document.createElement('canvas')
  c.width = 20
  c.height = 30
  const g = c.getContext('2d')
  const o = '#12080c'
  const robe = ['#a63c48', '#802a38', '#571d28'] // lit / mid / shadow
  const staffW = '#5c4028'
  const staffD = '#3d2a1a'

  // staff: tall, right hand side, slight lean
  g.fillStyle = o
  g.fillRect(14, 0, 3, 27)
  g.fillStyle = staffW
  g.fillRect(15, 1, 1, 26)
  g.fillStyle = staffD
  g.fillRect(15, 6, 1, 2)
  g.fillRect(15, 14, 1, 2)
  // charred staff head
  g.fillStyle = '#241a12'
  g.fillRect(14, 0, 3, 3)

  // hood: darker than the shoulders, pointed, clearly separated
  g.fillStyle = o
  g.fillRect(7, 2, 6, 1)
  g.fillRect(6, 3, 8, 5)
  g.fillStyle = robe[2]
  g.fillRect(7, 3, 6, 4)
  g.fillStyle = robe[1]
  g.fillRect(7, 3, 2, 2)
  // torch-side amber rim on the hood
  g.fillStyle = '#e8975f'
  g.fillRect(12, 3, 1, 3)
  // hood point
  g.fillStyle = o
  g.fillRect(9, 1, 2, 1)
  g.fillStyle = robe[2]
  g.fillRect(9, 2, 2, 1)
  // neck shadow gap between hood and shoulders
  g.fillStyle = o
  g.fillRect(6, 7, 8, 1)

  // shoulders + arms: right arm reaches to the staff
  g.fillStyle = o
  g.fillRect(4, 8, 12, 2)
  g.fillStyle = robe[1]
  g.fillRect(5, 8, 10, 2)
  g.fillStyle = robe[0]
  g.fillRect(5, 8, 3, 2)
  g.fillStyle = '#e8975f'
  g.fillRect(14, 8, 1, 2)
  // right arm to staff
  g.fillStyle = robe[1]
  g.fillRect(12, 9, 3, 2)
  g.fillStyle = o
  g.fillRect(12, 11, 4, 1)
  // hand on staff
  g.fillStyle = '#c98f5e'
  g.fillRect(14, 10, 3, 2)

  // robe body: widens to the hem, vertical fold shading
  for (let row = 10; row < 27; row++) {
    const t = (row - 10) / 17
    const wdt = Math.round(10 + t * 6)
    const x0 = Math.round(10 - wdt / 2) - 1
    g.fillStyle = o
    g.fillRect(x0 - 1, row, wdt + 2, 1)
    g.fillStyle = robe[1]
    g.fillRect(x0, row, wdt, 1)
    g.fillStyle = robe[0]
    g.fillRect(x0, row, 2 + ((row % 3 === 0) ? 1 : 0), 1)
    g.fillStyle = robe[2]
    g.fillRect(x0 + wdt - 3, row, 3, 1)
    // fold lines
    if (row > 13) {
      g.fillStyle = robe[2]
      g.fillRect(x0 + 4 + (row % 2), row, 1, 1)
      if (wdt > 13) g.fillRect(x0 + 9, row, 1, 1)
    }
    // amber torch-side rim, fading as the robe falls
    if (row < 20) {
      g.fillStyle = `rgba(232,151,95,${0.7 - (row - 10) * 0.06})`
      g.fillRect(x0 + wdt - 1, row, 1, 1)
    }
  }
  // hem shadow on the ground
  g.fillStyle = 'rgba(8,4,10,0.6)'
  g.fillRect(2, 27, 16, 2)
  return c
}

function paintHands(g) {
  const W = VIEW_W
  const H = VIEW_H
  g.imageSmoothingEnabled = false
  const fig = buildPilgrim()
  const fw = fig.width * HAND_SCALE
  const fh = fig.height * HAND_SCALE
  // stands at the head of the road, just left of center
  const dx = Math.round(W * 0.47) - (fw >> 1)
  const dy = H - fh - 4
  g.drawImage(fig, 0, 0, fig.width, fig.height, dx, dy, fw, fh)
  TORCH_ANCHOR.x = dx + 15.5 * HAND_SCALE
  TORCH_ANCHOR.y = dy - 2
}

// ---------- per-frame draw ----------
const embers = Array.from({ length: 46 }, (_, i) => ({
  x: Math.random() * VIEW_W,
  y: Math.random() * VIEW_H,
  v: 5 + Math.random() * 14,
  ph: Math.random() * Math.PI * 2,
}))
let flashT = 0
let nextFlash = 5

export function drawTitle(g, t, dt) {
  if (!scene) buildTitleScene()
  g.drawImage(scene, 0, 0)

  // occasional lightning behind the castle
  nextFlash -= dt
  if (nextFlash <= 0) {
    nextFlash = 6 + Math.random() * 9
    flashT = 0.35
  }
  if (flashT > 0) {
    flashT -= dt
    const a = Math.max(0, flashT / 0.35) * 0.35 * (Math.random() > 0.4 ? 1 : 0.4)
    const grd = g.createRadialGradient(VIEW_W / 2, VIEW_H * 0.2, 10, VIEW_W / 2, VIEW_H * 0.2, 200)
    grd.addColorStop(0, `rgba(200,180,255,${a})`)
    grd.addColorStop(1, 'rgba(150,120,255,0)')
    g.fillStyle = grd
    g.fillRect(0, 0, VIEW_W, VIEW_H * 0.6)
  }

  // torch flame — chunky 3px licks anchored to the new torch head
  const lx = TORCH_ANCHOR.x
  const fy = TORCH_ANCHOR.y
  g.save()
  g.globalCompositeOperation = 'lighter'
  const glow = g.createRadialGradient(lx, fy, 2, lx, fy, 52 + Math.sin(t * 9) * 5)
  glow.addColorStop(0, 'rgba(255,170,70,0.26)')
  glow.addColorStop(0.5, 'rgba(255,120,40,0.09)')
  glow.addColorStop(1, 'rgba(255,90,30,0)')
  g.fillStyle = glow
  g.fillRect(lx - 64, fy - 64, 128, 128)
  g.restore()
  for (let i = 0; i < 7; i++) {
    const a = t * (7 + (i % 5)) + i * 1.7
    const wob = Math.round(Math.sin(a) * (1 + (i % 2)))
    const hgt = 9 + ((i * 37) % 9) + Math.round(Math.sin(t * 11 + i) * 3)
    const bx2 = lx - 6 + ((i * 17) % 11) + wob * 3 - ((lx - 6 + ((i * 17) % 11) + wob * 3) % 3)
    const topY = fy - hgt - (hgt % 3)
    g.fillStyle = '#e04b2d'
    g.fillRect(bx2, topY, 3, 3)
    g.fillStyle = '#ff9a3d'
    g.fillRect(bx2, topY + 3, 3, Math.max(3, ((hgt * 0.4) | 0) - (((hgt * 0.4) | 0) % 3)))
    g.fillStyle = '#ffd23d'
    g.fillRect(bx2, topY + 3 + Math.max(3, ((hgt * 0.4) | 0) - (((hgt * 0.4) | 0) % 3)), 3, 6)
  }
  // white-hot heart of the fire
  g.fillStyle = '#fff3cd'
  g.fillRect(lx - 3, fy - 6, 7, 5 + (Math.sin(t * 13) > 0 ? 2 : 0))
  g.fillStyle = '#ff6a2d'
  g.fillRect(lx - 4, fy - 1, 9, 3)

  // drifting embers
  for (const e of embers) {
    e.y -= e.v * dt
    e.x += Math.sin(t * 1.3 + e.ph) * 8 * dt
    if (e.y < -3) {
      e.y = VIEW_H + 3
      e.x = VIEW_W * 0.05 + Math.random() * VIEW_W * 0.35
      // most embers rise from the torch side
      if (Math.random() > 0.6) e.x = Math.random() * VIEW_W
    }
    const a = 0.25 + 0.3 * Math.sin(t * 3.5 + e.ph)
    if (a > 0.1) {
      g.fillStyle = `rgba(255,${150 + ((e.ph * 40) % 60) | 0},60,${a})`
      g.fillRect(e.x, e.y, e.ph > 4 ? 2 : 1, e.ph > 4 ? 2 : 1)
    }
  }

  // hands over embers
  g.drawImage(handsLayer, 0, 0)

  // vignette
  const vg = g.createRadialGradient(VIEW_W / 2, VIEW_H / 2, VIEW_H * 0.4, VIEW_W / 2, VIEW_H / 2, VIEW_H * 0.9)
  vg.addColorStop(0, 'rgba(0,0,0,0)')
  vg.addColorStop(1, 'rgba(4,2,10,0.55)')
  g.fillStyle = vg
  g.fillRect(0, 0, VIEW_W, VIEW_H)
}
