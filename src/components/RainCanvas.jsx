import { useEffect, useRef } from 'react'

export default function RainCanvas() {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')

    let W = (canvas.width = window.innerWidth)
    let H = (canvas.height = window.innerHeight)
    let active = true
    let raf

    const onResize = () => {
      W = canvas.width = window.innerWidth
      H = canvas.height = window.innerHeight
    }
    window.addEventListener('resize', onResize)

    // ─── Rain falling outside (seen through glass) ───────────────────────
    class ExteriorDrop {
      constructor(spreadY = false) {
        this.reset(spreadY)
      }
      reset(spreadY = false) {
        this.x = Math.random() * W
        this.y = spreadY ? Math.random() * H : -(Math.random() * H * 0.4)
        this.speed = 5 + Math.random() * 10
        this.len = 16 + Math.random() * 38
        this.thick = 0.35 + Math.random() * 0.8
        this.alpha = 0.055 + Math.random() * 0.095
        this.windX = 0.055
      }
      update() {
        this.y += this.speed
        this.x += this.speed * this.windX
        if (this.y > H + this.len) this.reset()
      }
      draw() {
        ctx.beginPath()
        ctx.moveTo(this.x, this.y)
        ctx.lineTo(this.x + this.windX * this.len, this.y + this.len)
        ctx.strokeStyle = `rgba(188, 212, 228, ${this.alpha})`
        ctx.lineWidth = this.thick
        ctx.lineCap = 'round'
        ctx.stroke()
      }
    }

    // ─── Water drops clinging to the glass surface ───────────────────────
    class GlassDrop {
      constructor(instant = false) {
        this.reset(instant)
      }
      reset(instant = false) {
        this.x = Math.random() * W
        this.y = instant ? Math.random() * H * 0.92 : -(Math.random() * 30)
        this.maxR = 2 + Math.random() * 13
        this.r = instant ? this.maxR * (0.2 + Math.random() * 0.8) : 0.2
        this.alpha = 0.09 + Math.random() * 0.22
        this.growRate = 0.03 + Math.random() * 0.1
        this.slides = Math.random() < 0.26
        this.slideDelay = 160 + Math.floor(Math.random() * 380)
        this.slideSpeed = 0.12 + Math.random() * 0.52
        this.age = instant ? Math.floor(Math.random() * 600) : 0
        this.trail = []
      }
      update() {
        this.age++
        if (this.r < this.maxR) {
          this.r = Math.min(this.r + this.growRate, this.maxR)
        }
        if (this.slides && this.age > this.slideDelay && this.r >= this.maxR * 0.75) {
          const last = this.trail[this.trail.length - 1]
          if (!last || last.y !== this.y) {
            this.trail.push({ x: this.x, y: this.y })
          }
          if (this.trail.length > 110) this.trail.shift()
          this.y += this.slideSpeed
          this.r = Math.max(1.2, this.r * 0.9997)
          if (this.y > H + 80) this.reset()
        }
      }
      draw() {
        // Sliding trail
        if (this.trail.length > 2) {
          for (let i = 1; i < this.trail.length; i++) {
            const t = i / this.trail.length
            ctx.beginPath()
            ctx.moveTo(this.trail[i - 1].x, this.trail[i - 1].y)
            ctx.lineTo(this.trail[i].x, this.trail[i].y)
            ctx.strokeStyle = `rgba(182, 214, 232, ${this.alpha * t * 0.32})`
            ctx.lineWidth = Math.max(0.2, this.r * 0.42 * t)
            ctx.lineCap = 'round'
            ctx.stroke()
          }
        }

        if (this.r < 0.6) return

        // Drop body — radial gradient simulating water-on-glass refraction
        const gx = this.x - this.r * 0.3
        const gy = this.y - this.r * 0.25
        const r0 = Math.max(0.01, this.r * 0.04)
        const r1 = Math.max(0.1, this.r)
        const grd = ctx.createRadialGradient(gx, gy, r0, this.x, this.y, r1)
        grd.addColorStop(0, `rgba(238, 252, 255, ${this.alpha * 0.95})`)
        grd.addColorStop(0.42, `rgba(192, 222, 242, ${this.alpha * 0.5})`)
        grd.addColorStop(1, `rgba(145, 188, 215, ${this.alpha * 0.04})`)

        ctx.beginPath()
        ctx.arc(this.x, this.y, r1, 0, Math.PI * 2)
        ctx.fillStyle = grd
        ctx.fill()

        // Primary specular highlight
        ctx.beginPath()
        ctx.arc(this.x - this.r * 0.3, this.y - this.r * 0.26, this.r * 0.21, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(255, 255, 255, ${this.alpha * 0.52})`
        ctx.fill()

        // Secondary micro-highlight
        ctx.beginPath()
        ctx.arc(this.x + this.r * 0.18, this.y - this.r * 0.35, this.r * 0.08, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(255, 255, 255, ${this.alpha * 0.3})`
        ctx.fill()

        // Rim arc — top edge of drop catches light
        ctx.beginPath()
        ctx.arc(this.x, this.y, r1 * 0.96, Math.PI * 1.1, Math.PI * 1.9)
        ctx.strokeStyle = `rgba(220, 240, 255, ${this.alpha * 0.18})`
        ctx.lineWidth = 0.5
        ctx.stroke()
      }
    }

    // ─── Continuous water streaks running down the glass ─────────────────
    class Streak {
      constructor() {
        this.reset(true)
      }
      reset(spread = false) {
        this.x = Math.random() * W
        this.y = spread ? Math.random() * H * 0.4 : -(Math.random() * 40)
        this.speed = 0.3 + Math.random() * 1.1
        this.alpha = 0.06 + Math.random() * 0.10
        this.thick = 0.6 + Math.random() * 1.4
        this.maxPts = 70 + Math.floor(Math.random() * 110)
        this.pts = []
        this.active = Math.random() < 0.55
        this.delay = Math.floor(Math.random() * 180)
        this.age = spread ? Math.floor(Math.random() * 300) : 0
      }
      update() {
        this.age++
        if (!this.active || this.age < this.delay) return
        const last = this.pts[this.pts.length - 1]
        const nx = (last ? last.x : this.x) + (Math.random() - 0.5) * 0.6
        this.pts.push({ x: nx, y: this.y })
        if (this.pts.length > this.maxPts) this.pts.shift()
        this.y += this.speed
        if (this.y > H + 30) this.reset()
      }
      draw() {
        if (this.pts.length < 2) return
        ctx.beginPath()
        ctx.moveTo(this.pts[0].x, this.pts[0].y)
        for (let i = 1; i < this.pts.length; i++) ctx.lineTo(this.pts[i].x, this.pts[i].y)
        ctx.strokeStyle = `rgba(182, 215, 235, ${this.alpha})`
        ctx.lineWidth = this.thick
        ctx.lineCap = 'round'
        ctx.lineJoin = 'round'
        ctx.stroke()
      }
    }

    // ─── Initialise ───────────────────────────────────────────────────────
    const extDrops = Array.from({ length: 170 }, (_, i) => new ExteriorDrop(i < 130))
    const glassDrops = Array.from({ length: 95 }, () => new GlassDrop(true))
    const streaks = Array.from({ length: 28 }, () => new Streak())

    const frame = () => {
      if (!active) return
      ctx.clearRect(0, 0, W, H)

      for (const d of extDrops) { d.update(); d.draw() }
      for (const s of streaks)  { s.update(); s.draw() }
      for (const d of glassDrops) { d.update(); d.draw() }

      raf = requestAnimationFrame(frame)
    }
    frame()

    return () => {
      active = false
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', onResize)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none"
      style={{ zIndex: 10 }}
    />
  )
}
