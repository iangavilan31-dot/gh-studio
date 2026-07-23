// Texture factory (MASTER_PROMPT 7.1): offscreen-canvas painter producing
// hand-painted-style tiles, 64–128px, NearestFilter, generated at boot, cached.
// Core: paint() = flat base → low-freq value-noise splotches (brush feel) →
// sparse darker edge strokes → chunky highlight dabs on the light side.

import * as THREE from 'three'
import { worldRNG } from '../core/rng.js'

const cache = new Map()
export let textureGenMs = 0 // boot-budget evidence (<300ms, Part 7.1)

export function canvasOf(size, fn) {
  const c = document.createElement('canvas')
  c.width = c.height = size
  const ctx = c.getContext('2d')
  fn(ctx, size)
  return c
}

export function toTexture(canvas, { repeat = 1 } = {}) {
  const t = new THREE.CanvasTexture(canvas)
  t.magFilter = THREE.NearestFilter
  t.minFilter = THREE.NearestFilter
  t.generateMipmaps = false
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.colorSpace = THREE.NoColorSpace
  if (repeat !== 1) t.repeat.set(repeat, repeat)
  return t
}

export function hex(h) {
  const n = parseInt(h.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}
export function rgb(arr) { return `rgb(${arr[0] | 0},${arr[1] | 0},${arr[2] | 0})` }
export function lighten(arr, f) { return arr.map((v) => Math.min(255, v + 255 * f)) }
export function darken(arr, f) { return arr.map((v) => Math.max(0, v - 255 * f)) }
export function mix(a, b, t) { return [0, 1, 2].map((i) => a[i] + (b[i] - a[i]) * t) }

// Low-frequency value noise splotches — the "brush" core. Painted, not photographic.
export function splotch(ctx, size, rng, { color, count = 60, rmin = 3, rmax = 10, alpha = 0.16 } = {}) {
  for (let i = 0; i < count; i++) {
    const r = rng.range(rmin, rmax)
    ctx.fillStyle = rgb(color)
    ctx.globalAlpha = alpha * rng.range(0.6, 1)
    ctx.beginPath()
    ctx.ellipse(rng.range(0, size), rng.range(0, size), r, r * rng.range(0.6, 1), rng.range(0, Math.PI), 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.globalAlpha = 1
}

// paint(): base fill + light/dark splotch octaves + highlight dabs from the light side (top).
export function paint(ctx, size, rng, base, { rough = 1, highlight = 0.12, shadow = 0.14 } = {}) {
  ctx.fillStyle = rgb(base)
  ctx.fillRect(0, 0, size, size)
  splotch(ctx, size, rng, { color: lighten(base, 0.08), count: 24 * rough, rmin: size / 10, rmax: size / 4, alpha: 0.22 })
  splotch(ctx, size, rng, { color: darken(base, 0.08), count: 24 * rough, rmin: size / 12, rmax: size / 5, alpha: 0.22 })
  splotch(ctx, size, rng, { color: lighten(base, 0.05), count: 40 * rough, rmin: 2, rmax: size / 10, alpha: 0.3 })
  // chunky 2px highlight dabs, biased to upper half (painted light from the sky)
  ctx.fillStyle = rgb(lighten(base, 0.35))
  for (let i = 0; i < 30 * rough * highlight * 8; i++) {
    ctx.globalAlpha = rng.range(0.2, 0.5)
    ctx.fillRect(rng.range(0, size), rng.range(0, size * 0.6), rng.range(1, 3), rng.range(1, 2))
  }
  ctx.fillStyle = rgb(darken(base, 0.45))
  for (let i = 0; i < 30 * rough * shadow * 8; i++) {
    ctx.globalAlpha = rng.range(0.15, 0.4)
    ctx.fillRect(rng.range(0, size), rng.range(size * 0.4, size), rng.range(1, 3), rng.range(1, 2))
  }
  ctx.globalAlpha = 1
}

function make(name, builder) {
  if (cache.has(name)) return cache.get(name)
  const t0 = performance.now()
  const rng = worldRNG.fork('tex/' + name)
  const t = builder(rng)
  textureGenMs += performance.now() - t0
  cache.set(name, t)
  return t
}

// ——— Recipes ———

export function cobblestone({ moss = 0, name = 'cobble' } = {}) {
  return make(name + moss, (rng) => {
    const size = 128
    const grout = hex('#10181a')
    const stoneBase = hex('#39464a')
    const c = canvasOf(size, (ctx) => {
      ctx.fillStyle = rgb(grout)
      ctx.fillRect(0, 0, size, size)
      // stones as jittered-grid rounded blobs (voronoi-ish), painted individually
      const cols = 6, rows = 6
      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          const cw = size / cols, ch = size / rows
          const cx = x * cw + cw / 2 + rng.range(-2, 2)
          const cy = y * ch + ch / 2 + rng.range(-2, 2)
          const w = cw * rng.range(0.72, 0.9), h = ch * rng.range(0.68, 0.88)
          let col = mix(stoneBase, hex(rng.pick(['#41504f', '#33403f', '#3d4a44', '#36444a'])), 0.7)
          if (moss > 0 && rng.chance(moss)) col = mix(col, hex('#31493a'), 0.5)
          ctx.fillStyle = rgb(col)
          ctx.beginPath()
          ctx.roundRect(cx - w / 2, cy - h / 2, w, h, rng.range(3, 7))
          ctx.fill()
          // per-stone painted light: subtle top sliver, bottom shadow
          ctx.fillStyle = rgb(lighten(col, 0.09))
          ctx.globalAlpha = 0.7
          ctx.fillRect(cx - w / 2 + 1, cy - h / 2 + 1, w - 4, 2)
          ctx.fillStyle = rgb(darken(col, 0.14))
          ctx.fillRect(cx - w / 2 + 1, cy + h / 2 - 3, w - 3, 2)
          ctx.globalAlpha = 1
        }
      }
      splotch(ctx, size, rng, { color: darken(stoneBase, 0.25), count: 26, rmin: 4, rmax: 14, alpha: 0.14 })
      if (moss > 0) splotch(ctx, size, rng, { color: hex('#3d5c46'), count: 30 * moss, rmin: 2, rmax: 6, alpha: 0.4 })
    })
    return toTexture(c)
  })
}

export function grass({ name = 'grass', a = '#2c4a3c', b = '#3a5e48' } = {}) {
  return make(name, (rng) => {
    const size = 96
    const c = canvasOf(size, (ctx) => {
      paint(ctx, size, rng, hex(a), { rough: 1.2, highlight: 0.05, shadow: 0.1 })
      // grass flecks: short vertical dabs of the second green
      ctx.fillStyle = rgb(hex(b))
      for (let i = 0; i < 300; i++) {
        ctx.globalAlpha = rng.range(0.25, 0.7)
        ctx.fillRect(rng.range(0, size), rng.range(0, size), 1, rng.range(2, 4))
      }
      ctx.globalAlpha = 1
    })
    return toTexture(c)
  })
}

export function dirt({ name = 'dirt' } = {}) {
  return make(name, (rng) => {
    const size = 96
    const c = canvasOf(size, (ctx) => {
      paint(ctx, size, rng, hex('#33302a'), { rough: 1.3 })
      splotch(ctx, size, rng, { color: hex('#403c30'), count: 40, rmin: 2, rmax: 8, alpha: 0.3 })
      // pebbles
      for (let i = 0; i < 26; i++) {
        const col = lighten(hex('#3a3a36'), rng.range(0, 0.12))
        ctx.fillStyle = rgb(col)
        ctx.beginPath()
        ctx.ellipse(rng.range(0, size), rng.range(0, size), rng.range(1, 3), rng.range(1, 2), 0, 0, Math.PI * 2)
        ctx.fill()
      }
    })
    return toTexture(c)
  })
}

export function bark({ name = 'bark' } = {}) {
  return make(name, (rng) => {
    const size = 64
    const c = canvasOf(size, (ctx) => {
      const base = hex('#221b1a')
      ctx.fillStyle = rgb(base)
      ctx.fillRect(0, 0, size, size)
      // vertical streaks
      for (let i = 0; i < 26; i++) {
        const x = rng.range(0, size)
        ctx.strokeStyle = rgb(rng.chance(0.5) ? lighten(base, 0.1) : darken(base, 0.35))
        ctx.globalAlpha = rng.range(0.4, 0.9)
        ctx.lineWidth = rng.range(1, 3)
        ctx.beginPath()
        ctx.moveTo(x, -4)
        ctx.bezierCurveTo(x + rng.range(-4, 4), size * 0.33, x + rng.range(-4, 4), size * 0.66, x + rng.range(-5, 5), size + 4)
        ctx.stroke()
      }
      ctx.globalAlpha = 1
      splotch(ctx, size, rng, { color: hex('#3d5040'), count: 8, rmin: 2, rmax: 5, alpha: 0.35 }) // moss flecks
    })
    return toTexture(c)
  })
}

// Foliage canopy — clustered leaf dabs on transparency, for alpha-tested cards.
export function canopy({ name = 'canopy', base = '#1a2f2b', light = '#3f5f53' } = {}) {
  return make(name, (rng) => {
    const size = 128
    const c = canvasOf(size, (ctx) => {
      ctx.clearRect(0, 0, size, size)
      const cx = size / 2, cy = size / 2
      const b = hex(base), l = hex(light)
      // blob mass
      for (let i = 0; i < 90; i++) {
        const a = rng.range(0, Math.PI * 2)
        const d = rng.range(0, size * 0.36) * Math.sqrt(rng.next())
        const x = cx + Math.cos(a) * d, y = cy + Math.sin(a) * d * 0.8
        ctx.fillStyle = rgb(mix(b, l, rng.range(0, 0.35)))
        ctx.beginPath()
        ctx.ellipse(x, y, rng.range(7, 16), rng.range(6, 13), rng.range(0, 3), 0, Math.PI * 2)
        ctx.fill()
      }
      // leaf-cluster dabs, lit from above
      for (let i = 0; i < 240; i++) {
        const a = rng.range(0, Math.PI * 2)
        const d = rng.range(0, size * 0.42) * Math.sqrt(rng.next())
        const x = cx + Math.cos(a) * d, y = cy + Math.sin(a) * d * 0.8
        const up = (cy - y) / size + 0.5
        ctx.fillStyle = rgb(mix(b, l, Math.max(0, up) * rng.range(0.3, 1)))
        ctx.globalAlpha = rng.range(0.5, 1)
        ctx.fillRect(x, y, rng.range(2, 4), rng.range(2, 3))
      }
      ctx.globalAlpha = 1
    })
    const t = toTexture(c)
    t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping
    return t
  })
}

// 4-frame flame sprite sheet (horizontal strip). cool=true → arcane cyan.
export function flameSheet({ name = 'flame', cool = false } = {}) {
  return make(name + (cool ? 'c' : ''), (rng) => {
    const fw = 32, fh = 32
    const c = document.createElement('canvas')
    c.width = fw * 4; c.height = fh
    const ctx = c.getContext('2d')
    for (let f = 0; f < 4; f++) {
      const ox = f * fw
      const flick = rng.range(-2, 2)
      const layers = cool
        ? [
            { col: '#104a4a', r: 9 },
            { col: '#2e9a9a', r: 7 },
            { col: '#7fd4d4', r: 5 },
            { col: '#d8fbfb', r: 2.6 },
          ]
        : [
            { col: '#7a2d10', r: 9 },
            { col: '#e08a30', r: 7 },
            { col: '#f0b848', r: 5 },
            { col: '#ffe9b0', r: 2.6 },
          ]
      for (const L of layers) {
        ctx.fillStyle = L.col
        ctx.beginPath()
        const sway = Math.sin((f / 4) * Math.PI * 2) * 2 + flick * 0.4
        ctx.ellipse(ox + fw / 2 + sway * (L.r / 9), fh * 0.62 - (9 - L.r) * 1.4, L.r * 0.62, L.r, 0, 0, Math.PI * 2)
        ctx.fill()
        // teardrop tip
        ctx.beginPath()
        ctx.moveTo(ox + fw / 2 - L.r * 0.5 + sway * (L.r / 9), fh * 0.55)
        ctx.quadraticCurveTo(ox + fw / 2 + sway, fh * 0.55 - L.r * 2.1, ox + fw / 2 + L.r * 0.5 + sway * (L.r / 9), fh * 0.55)
        ctx.fill()
      }
    }
    const t = toTexture(c)
    t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping
    return t
  })
}

// Painted iron for lamp posts and fittings.
export function iron({ name = 'iron' } = {}) {
  return make(name, (rng) => {
    const size = 64
    const c = canvasOf(size, (ctx) => {
      paint(ctx, size, rng, hex('#23262b'), { rough: 0.8, highlight: 0.18, shadow: 0.2 })
    })
    return toTexture(c)
  })
}

// Plaster + timber (village half-timbered walls).
export function plaster({ name = 'plaster' } = {}) {
  return make(name, (rng) => {
    const size = 96
    const c = canvasOf(size, (ctx) => {
      paint(ctx, size, rng, hex('#c8c0ae'), { rough: 0.7, highlight: 0.06, shadow: 0.08 })
      // dark timber frame: border + one diagonal
      ctx.fillStyle = rgb(hex('#241a12'))
      ctx.fillRect(0, 0, size, 7)
      ctx.fillRect(0, size - 7, size, 7)
      ctx.fillRect(0, 0, 7, size)
      ctx.fillRect(size - 7, 0, 7, size)
      ctx.save()
      ctx.translate(size / 2, size / 2)
      ctx.rotate(rng.chance(0.5) ? 0.78 : -0.78)
      ctx.fillRect(-size, -3.5, size * 2, 7)
      ctx.restore()
      // re-highlight plaster panels lightly
      splotch(ctx, size, rng, { color: hex('#d8d0bc'), count: 10, rmin: 4, rmax: 12, alpha: 0.25 })
    })
    return toTexture(c)
  })
}

// Shingle rows (roofs).
export function shingle({ name = 'shingle', base = '#2e3438', moss = 0 } = {}) {
  return make(name + moss, (rng) => {
    const size = 96
    const b = hex(base)
    const c = canvasOf(size, (ctx) => {
      ctx.fillStyle = rgb(darken(b, 0.3))
      ctx.fillRect(0, 0, size, size)
      const rows = 6, cols = 6
      for (let r = 0; r < rows; r++) {
        const y = r * (size / rows)
        for (let col = 0; col < cols; col++) {
          const off = (r % 2) * (size / cols / 2)
          const x = col * (size / cols) + off - size / cols / 2
          let sc = mix(b, hex(rng.pick(['#353b40', '#282e33', '#31383a'])), 0.7)
          if (moss > 0 && rng.chance(moss)) sc = mix(sc, hex('#3c5c44'), 0.6)
          ctx.fillStyle = rgb(sc)
          ctx.beginPath()
          ctx.roundRect(x, y, size / cols - 2, size / rows + 4, [0, 0, 5, 5])
          ctx.fill()
          ctx.fillStyle = rgb(lighten(sc, 0.1))
          ctx.fillRect(x + 1, y + 1, size / cols - 4, 2)
        }
      }
    })
    return toTexture(c)
  })
}

// Stone block (towers, ruins, castle).
export function stoneBlock({ name = 'stone', base = '#4a4f52' } = {}) {
  return make(name, (rng) => {
    const size = 96
    const b = hex(base)
    const c = canvasOf(size, (ctx) => {
      ctx.fillStyle = rgb(darken(b, 0.4))
      ctx.fillRect(0, 0, size, size)
      const rows = 4
      for (let r = 0; r < rows; r++) {
        const y = r * (size / rows)
        const cols = 3
        for (let col = 0; col < cols; col++) {
          const off = (r % 2) * (size / cols / 2)
          const x = col * (size / cols) + off - size / cols / 2
          const sc = mix(b, hex(rng.pick(['#54595c', '#42474a', '#4e5356'])), 0.7)
          ctx.fillStyle = rgb(sc)
          ctx.fillRect(x + 1, y + 1, size / cols - 3, size / rows - 3)
          ctx.fillStyle = rgb(lighten(sc, 0.1))
          ctx.fillRect(x + 1, y + 1, size / cols - 3, 2)
          ctx.fillStyle = rgb(darken(sc, 0.18))
          ctx.fillRect(x + 1, y + size / rows - 4, size / cols - 3, 2)
        }
      }
      splotch(ctx, size, rng, { color: darken(b, 0.3), count: 16, rmin: 3, rmax: 9, alpha: 0.2 })
    })
    return toTexture(c)
  })
}

// Water: flat deep blue + lighter wavelet rows (scrolled at runtime).
export function water({ name = 'water', base = '#22375c', light = '#374c70' } = {}) {
  return make(name, (rng) => {
    const size = 96
    const b = hex(base)
    const c = canvasOf(size, (ctx) => {
      ctx.fillStyle = rgb(b)
      ctx.fillRect(0, 0, size, size)
      for (let i = 0; i < 22; i++) {
        const y = rng.range(0, size)
        const w = rng.range(8, 26)
        ctx.strokeStyle = rgb(mix(b, hex(light), rng.range(0.5, 1)))
        ctx.globalAlpha = rng.range(0.35, 0.7)
        ctx.lineWidth = rng.range(1, 2)
        ctx.beginPath()
        const x = rng.range(0, size)
        ctx.moveTo(x, y)
        ctx.quadraticCurveTo(x + w / 2, y - 1.5, x + w, y)
        ctx.stroke()
      }
      ctx.globalAlpha = 1
    })
    return toTexture(c)
  })
}

// Wood planks (benches, signs, floors).
export function plank({ name = 'plank' } = {}) {
  return make(name, (rng) => {
    const size = 64
    const c = canvasOf(size, (ctx) => {
      const base = hex('#4a3a2c')
      ctx.fillStyle = rgb(base)
      ctx.fillRect(0, 0, size, size)
      const rows = 4
      for (let r = 0; r < rows; r++) {
        const y = r * (size / rows)
        const col = mix(base, hex(rng.pick(['#54402e', '#41332a', '#4e3d2e'])), 0.7)
        ctx.fillStyle = rgb(col)
        ctx.fillRect(0, y + 1, size, size / rows - 2)
        // grain
        for (let i = 0; i < 7; i++) {
          ctx.strokeStyle = rgb(rng.chance(0.5) ? darken(col, 0.15) : lighten(col, 0.07))
          ctx.lineWidth = 1
          ctx.globalAlpha = 0.6
          const gy = y + rng.range(2, size / rows - 2)
          ctx.beginPath(); ctx.moveTo(0, gy); ctx.bezierCurveTo(size * 0.3, gy + rng.range(-1, 1), size * 0.7, gy + rng.range(-1, 1), size, gy); ctx.stroke()
        }
        ctx.globalAlpha = 1
        ctx.fillStyle = rgb(darken(base, 0.35)); ctx.fillRect(0, y, size, 1)
        ctx.fillStyle = rgb(lighten(base, 0.08)); ctx.fillRect(0, y + 1, size, 1)
      }
    })
    return toTexture(c)
  })
}

// Radial warm glow sprite (lamp halos, kindle blooms).
export function glowDot({ name = 'glow', color = '#e8c26a' } = {}) {
  return make(name + color, () => {
    const size = 64
    const c = canvasOf(size, (ctx) => {
      const g = ctx.createRadialGradient(size / 2, size / 2, 1, size / 2, size / 2, size / 2)
      const [r, gg, b] = hex(color)
      g.addColorStop(0, `rgba(${r},${gg},${b},0.85)`)
      g.addColorStop(0.35, `rgba(${r},${gg},${b},0.32)`)
      g.addColorStop(1, `rgba(${r},${gg},${b},0)`)
      ctx.fillStyle = g
      ctx.fillRect(0, 0, size, size)
    })
    const t = toTexture(c)
    t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping
    return t
  })
}

// Warm window: amber gradient + timber crossbars (green variant for Gloomspire).
export function window_({ name = 'window', warm = '#f0a848', green = false } = {}) {
  return make(name + (green ? 'g' : ''), (rng) => {
    const c = canvasOf(32, (ctx) => {
      const col = green ? '#58e050' : warm
      const [r, g, b] = hex(col)
      const grad = ctx.createRadialGradient(16, 20, 2, 16, 16, 20)
      grad.addColorStop(0, `rgb(${Math.min(255, r + 60)},${Math.min(255, g + 50)},${Math.min(255, b + 30)})`)
      grad.addColorStop(0.7, rgb([r, g, b]))
      grad.addColorStop(1, rgb(darken([r, g, b], 0.25)))
      ctx.fillStyle = grad
      ctx.fillRect(0, 0, 32, 32)
      // timber crossbars
      ctx.fillStyle = '#241a12'
      ctx.fillRect(14, 0, 3, 32)
      ctx.fillRect(0, 14, 32, 3)
      ctx.strokeStyle = '#241a12'
      ctx.lineWidth = 4
      ctx.strokeRect(0, 0, 32, 32)
    })
    return toTexture(c)
  })
}
export { window_ as window }

// Rain streak: thin vertical bright line, soft ends.
export function streak({ name = 'streak', color = '#9fb8c8' } = {}) {
  return make(name, () => {
    const c = document.createElement('canvas')
    c.width = 8; c.height = 32
    const ctx = c.getContext('2d')
    const [r, g, b] = hex(color)
    const grad = ctx.createLinearGradient(0, 0, 0, 32)
    grad.addColorStop(0, `rgba(${r},${g},${b},0)`)
    grad.addColorStop(0.5, `rgba(${r},${g},${b},0.75)`)
    grad.addColorStop(1, `rgba(${r},${g},${b},0)`)
    ctx.fillStyle = grad
    ctx.fillRect(3, 0, 2, 32)
    const t = toTexture(c)
    t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping
    return t
  })
}

// Splash ring: thin circle outline.
export function ring({ name = 'ring', color = '#8fa8b8' } = {}) {
  return make(name, () => {
    const c = canvasOf(32, (ctx) => {
      ctx.clearRect(0, 0, 32, 32)
      ctx.strokeStyle = rgb(hex(color))
      ctx.globalAlpha = 0.8
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.arc(16, 16, 12, 0, Math.PI * 2)
      ctx.stroke()
    })
    const t = toTexture(c)
    t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping
    return t
  })
}

// Little leaf sprite.
export function leaf({ name = 'leaf', color = '#4a6e58' } = {}) {
  return make(name, (rng) => {
    const c = canvasOf(16, (ctx) => {
      ctx.clearRect(0, 0, 16, 16)
      ctx.fillStyle = rgb(hex(color))
      ctx.beginPath()
      ctx.ellipse(8, 8, 6, 3.4, 0.7, 0, Math.PI * 2)
      ctx.fill()
      ctx.strokeStyle = rgb(darken(hex(color), 0.2))
      ctx.lineWidth = 1
      ctx.beginPath(); ctx.moveTo(3, 12); ctx.lineTo(13, 4); ctx.stroke()
    })
    const t = toTexture(c)
    t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping
    return t
  })
}

// Soft smoke puff.
export function puff({ name = 'puff', color = '#6a7280' } = {}) {
  return make(name, (rng) => {
    const c = canvasOf(48, (ctx) => {
      ctx.clearRect(0, 0, 48, 48)
      const [r, g, b] = hex(color)
      for (let i = 0; i < 9; i++) {
        const x = 24 + rng.range(-9, 9), y = 24 + rng.range(-9, 9)
        const rad = rng.range(6, 13)
        const grad = ctx.createRadialGradient(x, y, 1, x, y, rad)
        grad.addColorStop(0, `rgba(${r},${g},${b},0.5)`)
        grad.addColorStop(1, `rgba(${r},${g},${b},0)`)
        ctx.fillStyle = grad
        ctx.fillRect(0, 0, 48, 48)
      }
    })
    const t = toTexture(c)
    t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping
    return t
  })
}

// Star sprite: tiny 4-point twinkle.
export function star({ name = 'starSprite' } = {}) {
  return make(name, () => {
    const c = canvasOf(16, (ctx) => {
      ctx.clearRect(0, 0, 16, 16)
      const g = ctx.createRadialGradient(8, 8, 0.5, 8, 8, 7)
      g.addColorStop(0, 'rgba(240,240,255,1)')
      g.addColorStop(0.35, 'rgba(200,205,255,0.4)')
      g.addColorStop(1, 'rgba(200,205,255,0)')
      ctx.fillStyle = g
      ctx.fillRect(0, 0, 16, 16)
      ctx.fillStyle = 'rgba(240,240,255,0.9)'
      ctx.fillRect(7, 2, 2, 12)
      ctx.fillRect(2, 7, 12, 2)
    })
    const t = toTexture(c)
    t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping
    return t
  })
}

// Snore "z" glyph.
export function zGlyph({ name = 'zzz' } = {}) {
  return make(name, () => {
    const c = canvasOf(24, (ctx) => {
      ctx.clearRect(0, 0, 24, 24)
      ctx.strokeStyle = '#cfd6e8'
      ctx.lineWidth = 3
      ctx.lineCap = 'round'
      ctx.beginPath()
      ctx.moveTo(5, 6); ctx.lineTo(18, 6); ctx.lineTo(5, 18); ctx.lineTo(19, 18)
      ctx.stroke()
    })
    const t = toTexture(c)
    t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping
    return t
  })
}

export function white() {
  return make('white1px', () => {
    const c = canvasOf(4, (ctx) => { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, 4, 4) })
    return toTexture(c)
  })
}
