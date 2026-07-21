// ============================================================
// EMBERVALE — world: map parsing, collision, spawn extraction
// Pure logic (no DOM) so it can be tested in Node.
// ============================================================
import { ZONES, TILE } from './data.js'

const SOLID = new Set(['#', '~', 'R'])

export class World {
  constructor(zoneId) {
    this.zoneId = zoneId
    this.zone = ZONES[zoneId]
    const rows = this.zone.map.split('\n').filter((r) => r.trim().length > 0)
    const w = Math.max(...rows.map((r) => r.length))
    this.grid = rows.map((r) => r.padEnd(w, '#').split(''))
    this.h = this.grid.length
    this.w = w
    this.houses = [] // {tx,ty,tw,th,seed}
    this.props = [] // {kind,tx,ty,x,y,...}
    this.spawns = [] // enemy spawns {kind,x,y}
    this.npcs = [] // {i,x,y}
    this.exits = [] // {id,tx,ty,to,entry,label,needs}
    this.gates = [] // {tx,ty,needs,open,label,openText}
    this.solidExtra = new Set() // "tx,ty" from houses
    this._extract()
  }

  _extract() {
    let npcIdx = 0
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        const ch = this.grid[y][x]
        const cx = x * TILE + TILE / 2
        const cy = y * TILE + TILE / 2
        switch (ch) {
          case 'H': {
            const tx = Math.max(0, x - 1)
            const ty = Math.max(0, y - 1)
            this.houses.push({ tx, ty, tw: 3, th: 3, seed: x * 100 + y })
            for (let yy = ty; yy < ty + 3; yy++)
              for (let xx = tx; xx < tx + 3; xx++) this.solidExtra.add(xx + ',' + yy)
            break
          }
          case 'h': {
            this.houses.push({ tx: x, ty: y, tw: 2, th: 2, seed: x * 100 + y })
            for (let yy = y; yy < y + 2; yy++)
              for (let xx = x; xx < x + 2; xx++) this.solidExtra.add(xx + ',' + yy)
            break
          }
          case 'T':
            this.props.push({ kind: 'torch', tx: x, ty: y, x: cx, y: cy })
            break
          case 'B':
            this.props.push({ kind: 'bonfire', tx: x, ty: y, x: cx, y: cy })
            break
          case 'Z':
            this.props.push({ kind: 'brazier', tx: x, ty: y, x: cx, y: cy, lit: false })
            break
          case 'C':
            this.props.push({ kind: 'chest', tx: x, ty: y, x: cx, y: cy, opened: false })
            break
          case 'O':
            this.props.push({ kind: 'beacon', tx: x, ty: y, x: cx, y: cy, lit: false })
            break
          case '*':
            this.props.push({ kind: 'emberpile', tx: x, ty: y, x: cx, y: cy, taken: false })
            break
          case 'K':
            if (this.zone.boss) this.spawns.push({ kind: 'paleking', x: cx, y: cy })
            else if (this.zone.keyItem)
              this.props.push({ kind: 'keyitem', tx: x, ty: y, x: cx, y: cy, taken: false, item: this.zone.keyItem })
            break
          case 'N': {
            this.npcs.push({ i: npcIdx++, x: cx, y: cy })
            break
          }
          case 'E':
            this.spawns.push({ kind: 'husk', x: cx, y: cy })
            break
          case 'W':
            this.spawns.push({ kind: 'hound', x: cx, y: cy })
            break
          case 'U':
            this.spawns.push({ kind: 'cultist', x: cx, y: cy })
            break
          case 'M':
            this.spawns.push({ kind: 'brute', x: cx, y: cy })
            break
          case 's':
            this.spawns.push({ kind: 'wisp', x: cx, y: cy })
            break
          case 'A':
            this.spawns.push({ kind: 'alpha', x: cx, y: cy })
            break
          case 'S':
            this.spawns.push({ kind: 'sentinel', x: cx, y: cy })
            break
          case '1':
          case '2':
          case '3':
          case '4': {
            const def = (this.zone.exits || []).find((e) => e.id === ch)
            this.exits.push({ id: ch, tx: x, ty: y, x: cx, y: cy, ...(def || {}) })
            break
          }
          case 'G': {
            const gdef = (this.zone.gates || [])[this.gates.length] || (this.zone.gates || [])[0] || {}
            this.gates.push({ tx: x, ty: y, x: cx, y: cy, opened: false, ...gdef })
            break
          }
        }
      }
    }
  }

  charAt(tx, ty) {
    if (tx < 0 || ty < 0 || tx >= this.w || ty >= this.h) return '#'
    return this.grid[ty][tx]
  }

  isSolid(tx, ty) {
    const ch = this.charAt(tx, ty)
    if (SOLID.has(ch)) return true
    if (ch === 'G') {
      const gate = this.gates.find((g) => g.tx === tx && g.ty === ty)
      if (gate && !gate.opened) return true
      return false
    }
    if (this.solidExtra.has(tx + ',' + ty)) return true
    return false
  }

  // AABB (centered at x,y with half extents hw,hh) vs solid tiles
  collides(x, y, hw, hh) {
    const x0 = Math.floor((x - hw) / TILE)
    const x1 = Math.floor((x + hw) / TILE)
    const y0 = Math.floor((y - hh) / TILE)
    const y1 = Math.floor((y + hh) / TILE)
    for (let ty = y0; ty <= y1; ty++)
      for (let tx = x0; tx <= x1; tx++) if (this.isSolid(tx, ty)) return true
    return false
  }

  // move with axis-separated collision, returns [nx,ny]
  moveEntity(x, y, dx, dy, hw, hh) {
    let nx = x + dx
    if (this.collides(nx, y, hw, hh)) {
      // nudge to tile edge
      nx = x
    }
    let ny = y + dy
    if (this.collides(nx, ny, hw, hh)) {
      ny = y
    }
    return [nx, ny]
  }

  entryPoint(entryId) {
    const e = this.exits.find((ex) => ex.id === entryId)
    if (e) {
      // spawn a bit inside from the pad, toward open ground
      const dirs = [
        [0, 1], [0, -1], [1, 0], [-1, 0], [0, 2], [0, -2],
      ]
      for (const [dx, dy] of dirs) {
        if (!this.isSolid(e.tx + dx, e.ty + dy)) {
          return { x: (e.tx + dx) * TILE + TILE / 2, y: (e.ty + dy) * TILE + TILE / 2 }
        }
      }
      return { x: e.x, y: e.y }
    }
    // fallback: bonfire or center
    const b = this.props.find((p) => p.kind === 'bonfire')
    if (b) return { x: b.x, y: b.y + TILE }
    return { x: (this.w * TILE) / 2, y: (this.h * TILE) / 2 }
  }

  // used by validation script
  floodReachable(fromTx, fromTy, ignoreGates = true) {
    const seen = new Set()
    const q = [[fromTx, fromTy]]
    seen.add(fromTx + ',' + fromTy)
    while (q.length) {
      const [tx, ty] = q.pop()
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = tx + dx
        const ny = ty + dy
        const k = nx + ',' + ny
        if (seen.has(k)) continue
        const ch = this.charAt(nx, ny)
        const gateHere = ch === 'G'
        if (this.isSolid(nx, ny) && !(ignoreGates && gateHere)) continue
        seen.add(k)
        q.push([nx, ny])
      }
    }
    return seen
  }
}
