// ============================================================
// EMBERVALE — simulation: players, enemies, combat, progression
// Runs fully on host (or locally in offline play). No DOM.
// ============================================================
import { CLASSES, ENEMIES, ZONES, TILE, COOP_HP_MULT, COOP_EMBER_MULT, UPGRADES } from './data.js'
import { World } from './world.js'

let NID = 1
const nid = () => NID++

export const REVIVE_TIME = 3
export const DOWN_BLEEDOUT = 40

export function defaultSave() {
  return {
    flags: {},
    embers: 0,
    upgrades: [{}, {}],
    checkpoint: { zone: 'village' },
    classes: ['knight', 'pyro'],
    completed: false,
  }
}

export class Game {
  constructor(save) {
    this.save = save || defaultSave()
    this.players = []
    this.enemies = []
    this.projs = []
    this.pickups = []
    this.world = null
    this.zoneId = null
    this.events = [] // drained each frame by presentation/net
    this.time = 0
    this.bossState = null
    this.pendingZone = null // {zone, entry} set when a transition should happen
    this.gameOverT = 0
  }

  emit(e) {
    this.events.push(e)
  }

  flag(k) {
    return !!this.save.flags[k]
  }

  setFlag(k, v = true) {
    this.save.flags[k] = v
  }

  // ---------- players ----------
  addPlayer(slot, clsId) {
    const cls = CLASSES[clsId]
    const ups = this.save.upgrades[slot] || {}
    const p = {
      id: slot,
      cls: clsId,
      x: 0,
      y: 0,
      fx: 0,
      fy: 1,
      hp: cls.hp + (ups.hp || 0) * 2,
      maxhp: cls.hp + (ups.hp || 0) * 2,
      stam: cls.stamina + (ups.stam || 0) * 25,
      maxstam: cls.stamina + (ups.stam || 0) * 25,
      state: 'alive', // alive | down | dead
      downT: 0,
      reviveT: 0,
      atkT: 0,
      swing: 0,
      swingDir: 0,
      combo: 0,
      dodgeT: 0,
      dashT: 0,
      iT: 0,
      hurtT: 0,
      stamDelay: 0,
      walkT: 0,
      moving: false,
      kbx: 0,
      kby: 0,
      active: true,
    }
    this.players[slot] = p
    return p
  }

  playerStats(p) {
    const cls = CLASSES[p.cls]
    const ups = this.save.upgrades[p.id] || {}
    return {
      dmg: cls.dmg + (ups.dmg || 0),
      speed: cls.speed,
      lightR: cls.lightR + (ups.light || 0) * 14,
      reviveMult: ups.revive ? 2 : 1,
      specialCost: cls.specialCost,
      attackCd: cls.attackCd,
    }
  }

  activePlayers() {
    return this.players.filter((p) => p && p.active)
  }

  alivePlayers() {
    return this.activePlayers().filter((p) => p.state === 'alive')
  }

  // ---------- zone management ----------
  loadZone(zoneId, entryId) {
    this.zoneId = zoneId
    this.world = new World(zoneId)
    this.enemies = []
    this.projs = []
    this.pickups = []
    this.bossState = null
    this.pendingZone = null

    // restore persistent prop state
    for (const pr of this.world.props) {
      if (pr.kind === 'brazier' && this.flag(`brazier_${zoneId}_${pr.tx}_${pr.ty}`)) pr.lit = true
      if (pr.kind === 'chest' && this.flag(`chest_${zoneId}_${pr.tx}_${pr.ty}`)) pr.opened = true
      if (pr.kind === 'emberpile' && this.flag(`pile_${zoneId}_${pr.tx}_${pr.ty}`)) pr.taken = true
      if (pr.kind === 'keyitem' && this.flag(pr.item.id)) pr.taken = true
      if (pr.kind === 'beacon' && this.save.completed) pr.lit = true
    }
    for (const g of this.world.gates) {
      if (this.flag(`gate_${zoneId}_${g.tx}_${g.ty}`)) g.opened = true
    }

    // spawn enemies (minibosses only if not permanently dead)
    const nP = Math.max(1, this.activePlayers().length)
    for (const s of this.world.spawns) {
      if (s.kind === 'alpha' && this.flag('alphaDead')) continue
      if (s.kind === 'sentinel' && this.flag('sentinelDead')) continue
      if (s.kind === 'paleking') {
        if (this.flag('kingDead')) continue
        this.spawnEnemy(s.kind, s.x, s.y, nP)
        continue
      }
      this.spawnEnemy(s.kind, s.x, s.y, nP)
    }

    // place players at entry
    const ep = this.world.entryPoint(entryId)
    const ps = this.activePlayers()
    ps.forEach((p, i) => {
      p.x = ep.x + (i === 0 ? -7 : 7)
      p.y = ep.y
      if (p.state === 'down') {
        p.state = 'alive'
        p.hp = Math.max(1, Math.ceil(p.maxhp * 0.3))
      }
      p.kbx = p.kby = 0
    })
    this.emit({ t: 'zone', zone: zoneId })
  }

  spawnEnemy(kind, x, y, nP) {
    const def = ENEMIES[kind]
    const hpMult = nP > 1 ? COOP_HP_MULT : 1
    this.enemies.push({
      id: nid(),
      kind,
      x,
      y,
      sx: x,
      sy: y,
      hp: Math.round(def.hp * hpMult),
      maxhp: Math.round(def.hp * hpMult),
      state: 'idle',
      t: Math.random() * 2,
      atkT: 0,
      fx: 0,
      fy: 1,
      hitFlash: 0,
      stagger: 0,
      kbx: 0,
      kby: 0,
      wanderA: Math.random() * Math.PI * 2,
      hits: 0,
      lungeX: 0,
      lungeY: 0,
      phase: 1,
      sumT: 8,
      beamT: 0,
      beam: null,
    })
  }

  // ---------- main update ----------
  update(dt, inputs) {
    this.time += dt
    this.events.length = 0

    const ps = this.activePlayers()
    for (const p of ps) this.updatePlayer(p, inputs[p.id] || {}, dt)

    for (const e of this.enemies) this.updateEnemy(e, dt)
    this.enemies = this.enemies.filter((e) => e.hp > 0)

    this.updateProjectiles(dt)
    this.updatePickups(dt)
    this.checkExits()
    this.updateBoss(dt)

    // party wipe?
    if (ps.length > 0 && ps.every((p) => p.state !== 'alive')) {
      this.gameOverT += dt
      if (this.gameOverT > 2.2) {
        this.gameOverT = 0
        this.respawnParty()
      }
    } else {
      this.gameOverT = 0
    }
  }

  respawnParty() {
    // ember tax, respawn at checkpoint bonfire
    this.save.embers = Math.floor(this.save.embers * 0.8)
    const cz = this.save.checkpoint.zone || 'village'
    for (const p of this.activePlayers()) {
      p.state = 'alive'
      p.hp = p.maxhp
      p.stam = p.maxstam
      p.downT = 0
    }
    this.loadZone(cz, '__bonfire')
    // spawn at bonfire
    const b = this.world.props.find((pr) => pr.kind === 'bonfire')
    if (b) {
      this.activePlayers().forEach((p, i) => {
        p.x = b.x + (i === 0 ? -10 : 10)
        p.y = b.y + 14
      })
    }
    this.emit({ t: 'respawn' })
  }

  // ---------- player ----------
  updatePlayer(p, inp, dt) {
    const st = this.playerStats(p)
    p.atkT = Math.max(0, p.atkT - dt)
    p.iT = Math.max(0, p.iT - dt)
    p.hurtT = Math.max(0, p.hurtT - dt)
    p.swing = Math.max(0, p.swing - dt / 0.24)
    p.stamDelay = Math.max(0, p.stamDelay - dt)
    if (p.stamDelay <= 0 && p.state === 'alive') p.stam = Math.min(p.maxstam, p.stam + 26 * dt)

    // knockback decay
    p.kbx *= Math.pow(0.001, dt)
    p.kby *= Math.pow(0.001, dt)

    if (p.state === 'down') {
      p.downT += dt
      // solo = instant fail handled by wipe check; in co-op bleed out to dead
      if (p.downT > DOWN_BLEEDOUT) {
        p.state = 'dead'
        this.emit({ t: 'pdead', id: p.id })
      }
      // getting revived?
      const ally = this.activePlayers().find(
        (a) => a !== p && a.state === 'alive' && dist(a, p) < 22 && a.reviving === p.id
      )
      if (ally) {
        const ast = this.playerStats(ally)
        p.reviveT += dt * ast.reviveMult
        if (p.reviveT >= REVIVE_TIME) {
          p.state = 'alive'
          p.hp = Math.ceil(p.maxhp * 0.5)
          p.reviveT = 0
          p.downT = 0
          p.iT = 1.2
          this.emit({ t: 'revived', id: p.id, x: p.x, y: p.y })
        }
      } else {
        p.reviveT = Math.max(0, p.reviveT - dt * 0.7)
      }
      return
    }
    if (p.state !== 'alive') return

    // dodge roll
    if (p.dodgeT > 0) {
      p.dodgeT -= dt
      const sp = 235
      const [nx, ny] = this.world.moveEntity(p.x, p.y, p.dvx * sp * dt, p.dvy * sp * dt, 5, 4)
      p.x = nx
      p.y = ny
      return
    }
    // shield charge dash
    if (p.dashT > 0) {
      p.dashT -= dt
      const sp = 330
      const [nx, ny] = this.world.moveEntity(p.x, p.y, p.fx * sp * dt, p.fy * sp * dt, 5, 4)
      const hitWall = nx === p.x && ny === p.y
      p.x = nx
      p.y = ny
      // damage enemies along path
      for (const e of this.enemies) {
        if (e.hp <= 0) continue
        if (dist(p, e) < 16) {
          this.damageEnemy(e, this.playerStats(p).dmg, p, 3.5, true)
        }
      }
      if (hitWall) p.dashT = 0
      return
    }

    // movement
    let mx = inp.mx || 0
    let my = inp.my || 0
    const mlen = Math.hypot(mx, my)
    if (mlen > 1) {
      mx /= mlen
      my /= mlen
    }
    p.moving = mlen > 0.01
    if (p.moving) {
      p.fx = mx
      p.fy = my
      p.walkT += dt * 9
    }
    const slow = p.swing > 0 ? 0.45 : 1
    const [nx, ny] = this.world.moveEntity(
      p.x,
      p.y,
      (mx * st.speed * slow + p.kbx) * dt,
      (my * st.speed * slow + p.kby) * dt,
      5,
      4
    )
    p.x = nx
    p.y = ny

    // attack
    if (inp.atk && p.atkT <= 0) {
      p.atkT = st.attackCd
      p.combo = (p.combo + 1) % 3
      p.swing = 1
      p.swingDir = Math.atan2(p.fy, p.fx)
      if (p.cls === 'knight') {
        this.meleeAttack(p, st.dmg + (p.combo === 0 ? 1 : 0), 30, 1.35)
        this.emit({ t: 'swing', id: p.id, x: p.x, y: p.y })
      } else {
        this.spawnProj('firebolt', p.x, p.y + 1, p.fx, p.fy, 235, st.dmg, 'p', p.id)
        this.emit({ t: 'cast', id: p.id, x: p.x, y: p.y })
      }
    }

    // special
    if (inp.spc && p.stam >= st.specialCost && p.atkT <= 0.1) {
      p.stam -= st.specialCost
      p.stamDelay = 1
      if (p.cls === 'knight') {
        p.dashT = 0.26
        p.iT = Math.max(p.iT, 0.3)
        this.emit({ t: 'charge', id: p.id, x: p.x, y: p.y })
      } else {
        // flame nova
        for (const e of this.enemies) {
          if (dist(p, e) < 48) this.damageEnemy(e, st.dmg + 1, p, 4, true)
        }
        for (const pr of this.world.props) {
          if (pr.kind === 'brazier' && !pr.lit && dist(p, pr) < 52) this.lightBrazier(pr)
        }
        this.emit({ t: 'nova', id: p.id, x: p.x, y: p.y })
      }
    }

    // dodge
    if (inp.dodge && p.stam >= 22 && p.dodgeT <= 0) {
      p.stam -= 22
      p.stamDelay = 0.8
      p.dodgeT = 0.26
      p.iT = 0.36
      p.dvx = p.moving ? mx : p.fx
      p.dvy = p.moving ? my : p.fy
      this.emit({ t: 'dodge', id: p.id, x: p.x, y: p.y })
    }

    // interact / revive
    p.reviving = null
    if (inp.inter || inp.interPressed) {
      const downAlly = this.activePlayers().find((a) => a !== p && a.state === 'down' && dist(a, p) < 22)
      if (downAlly && inp.inter) {
        p.reviving = downAlly.id
      } else if (inp.interPressed) {
        this.tryInteract(p)
      }
    }
  }

  meleeAttack(p, dmg, range, arcMult = 1) {
    const a0 = Math.atan2(p.fy, p.fx)
    for (const e of this.enemies) {
      if (e.hp <= 0) continue
      const d = dist(p, e)
      if (d > range + (e.kind === 'brute' || e.kind === 'paleking' ? 8 : 0)) continue
      const ang = Math.atan2(e.y - p.y, e.x - p.x)
      let da = Math.abs(angDiff(ang, a0))
      if (da < 1.25 * arcMult || d < 12) {
        this.damageEnemy(e, dmg, p, 2.2)
      }
    }
  }

  damageEnemy(e, dmg, from, kb = 2.2, heavy = false) {
    if (e.hp <= 0) return
    e.hp -= dmg
    e.hitFlash = 0.15
    e.hits++
    const big = e.kind === 'brute' || e.kind === 'sentinel' || e.kind === 'paleking'
    if (!big || heavy || e.hits % 4 === 0) {
      e.stagger = big ? 0.3 : 0.28
      const ang = Math.atan2(e.y - from.y, e.x - from.x)
      const kmul = big ? 0.35 : 1
      e.kbx += Math.cos(ang) * 60 * kb * kmul
      e.kby += Math.sin(ang) * 60 * kb * kmul
    }
    this.emit({ t: 'hit', x: e.x, y: e.y, kind: e.kind })
    if (e.hp <= 0) this.killEnemy(e)
  }

  killEnemy(e) {
    const def = ENEMIES[e.kind]
    this.emit({ t: 'die', x: e.x, y: e.y, kind: e.kind })
    const nP = this.activePlayers().length
    let embers = def.xp * (nP > 1 ? COOP_EMBER_MULT : 1)
    const n = Math.max(1, Math.round(embers / 3))
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2
      this.pickups.push({
        id: nid(),
        kind: 'ember',
        val: Math.max(1, Math.round(embers / n)),
        x: e.x,
        y: e.y,
        vx: Math.cos(a) * 40,
        vy: Math.sin(a) * 40,
        ttl: 30,
      })
    }
    if (e.kind === 'alpha') {
      this.pickups.push({ id: nid(), kind: 'key', item: 'rustkey', name: 'Rusted Key', x: e.x, y: e.y, vx: 0, vy: 0, ttl: 9999 })
      this.setFlag('alphaDead')
    }
    if (e.kind === 'sentinel') {
      this.setFlag('sentinelDead')
      this.pickups.push({ id: nid(), kind: 'heart', x: e.x, y: e.y, vx: 0, vy: 0, ttl: 9999 })
    }
    if (e.kind === 'paleking') {
      this.setFlag('kingDead')
      this.bossState = { phase: 'dying', t: 0 }
      this.emit({ t: 'bossdead' })
    }
    if (Math.random() < 0.09) {
      this.pickups.push({ id: nid(), kind: 'heart', x: e.x, y: e.y, vx: 0, vy: -20, ttl: 20 })
    }
  }

  damagePlayer(p, dmg, from) {
    if (p.state !== 'alive' || p.iT > 0) return
    p.hp -= dmg
    p.iT = 0.7
    p.hurtT = 0.3
    if (from) {
      const ang = Math.atan2(p.y - from.y, p.x - from.x)
      p.kbx += Math.cos(ang) * 130
      p.kby += Math.sin(ang) * 130
    }
    this.emit({ t: 'phit', id: p.id, x: p.x, y: p.y })
    if (p.hp <= 0) {
      p.hp = 0
      const others = this.alivePlayers().filter((a) => a !== p)
      p.state = 'down'
      p.downT = 0
      p.reviveT = 0
      this.emit({ t: 'pdown', id: p.id, x: p.x, y: p.y })
    }
  }

  // ---------- interactions ----------
  tryInteract(p) {
    // props
    for (const pr of this.world.props) {
      if (dist(p, pr) > 22) continue
      switch (pr.kind) {
        case 'bonfire': {
          for (const a of this.activePlayers()) {
            if (a.state === 'alive' || a.state === 'down') {
              a.state = 'alive'
              a.hp = a.maxhp
              a.stam = a.maxstam
              a.downT = 0
            }
          }
          this.save.checkpoint = { zone: this.zoneId }
          this.setFlag('restedOnce')
          this.emit({ t: 'bonfire', x: pr.x, y: pr.y })
          this.emit({ t: 'shop', slot: p.id }) // UI opens rest/upgrade menu
          return
        }
        case 'chest': {
          if (!pr.opened) {
            pr.opened = true
            this.setFlag(`chest_${this.zoneId}_${pr.tx}_${pr.ty}`)
            const amt = 25
            for (let i = 0; i < 6; i++) {
              const a = (i / 6) * Math.PI * 2
              this.pickups.push({ id: nid(), kind: 'ember', val: Math.ceil(amt / 6), x: pr.x, y: pr.y, vx: Math.cos(a) * 55, vy: Math.sin(a) * 55, ttl: 30 })
            }
            this.pickups.push({ id: nid(), kind: 'heart', x: pr.x, y: pr.y, vx: 0, vy: 30, ttl: 30 })
            this.emit({ t: 'chest', x: pr.x, y: pr.y })
          }
          return
        }
        case 'emberpile': {
          if (!pr.taken) {
            pr.taken = true
            this.setFlag(`pile_${this.zoneId}_${pr.tx}_${pr.ty}`)
            this.save.embers += 15
            this.emit({ t: 'text', msg: '+15 embers, still warm.' })
          }
          return
        }
        case 'keyitem': {
          if (!pr.taken) {
            pr.taken = true
            this.setFlag(pr.item.id)
            this.emit({ t: 'text', msg: pr.item.text })
            this.emit({ t: 'pickupKey', x: pr.x, y: pr.y })
          }
          return
        }
        case 'brazier': {
          if (!pr.lit && p.cls === 'knight') {
            this.lightBrazier(pr) // knight lights by hand up close
          }
          return
        }
        case 'beacon': {
          if (!pr.lit) {
            pr.lit = true
            this.save.completed = true
            this.emit({ t: 'victory' })
          }
          return
        }
      }
    }
    // npcs
    for (const n of this.world.npcs) {
      if (dist(p, n) < 24) {
        const def = (this.world.zone.npcs || [])[n.i]
        if (def) this.emit({ t: 'talk', npc: def, idx: n.i })
        return
      }
    }
    // gates
    for (const g of this.world.gates) {
      if (dist(p, g) < 26 && !g.opened) {
        this.tryOpenGate(g)
        return
      }
    }
  }

  tryOpenGate(g) {
    let ok = false
    if (g.needs === 'braziers2') {
      const lit = this.world.props.filter((pr) => pr.kind === 'brazier' && pr.lit).length
      ok = lit >= 2
    } else ok = this.flag(g.needs)
    if (ok) {
      g.opened = true
      this.setFlag(`gate_${this.zoneId}_${g.tx}_${g.ty}`)
      this.emit({ t: 'gate', x: g.x, y: g.y })
      this.emit({ t: 'text', msg: g.open || 'The gate opens.' })
    } else {
      this.emit({ t: 'text', msg: g.label || 'It will not open.' })
    }
  }

  lightBrazier(pr) {
    pr.lit = true
    this.setFlag(`brazier_${this.zoneId}_${pr.tx}_${pr.ty}`)
    this.emit({ t: 'brazier', x: pr.x, y: pr.y })
    const total = this.world.props.filter((x) => x.kind === 'brazier').length
    const lit = this.world.props.filter((x) => x.kind === 'brazier' && x.lit).length
    this.emit({ t: 'text', msg: `A watch-brazier roars to life. (${lit}/${total})` })
    // auto-open gates that need braziers
    for (const g of this.world.gates) {
      if (!g.opened && g.needs === 'braziers2' && lit >= 2) this.tryOpenGate(g)
    }
  }

  // key pickups touching players
  updatePickups(dt) {
    const ps = this.alivePlayers()
    for (const k of this.pickups) {
      k.ttl -= dt
      k.vx *= Math.pow(0.01, dt)
      k.vy *= Math.pow(0.01, dt)
      // magnet
      let best = null
      let bd = 46
      for (const p of ps) {
        const d = dist(k, p)
        if (d < bd) {
          bd = d
          best = p
        }
      }
      if (best) {
        const ang = Math.atan2(best.y - k.y, best.x - k.x)
        const pull = 190 * (1 - bd / 46)
        k.vx += Math.cos(ang) * pull * dt * 60
        k.vy += Math.sin(ang) * pull * dt * 60
      }
      k.x += k.vx * dt
      k.y += k.vy * dt
      if (best && bd < 10) {
        k.ttl = -1
        if (k.kind === 'ember') {
          this.save.embers += k.val
          this.emit({ t: 'ember', x: k.x, y: k.y })
        } else if (k.kind === 'heart') {
          best.hp = Math.min(best.maxhp, best.hp + 2)
          this.emit({ t: 'heal', id: best.id, x: k.x, y: k.y })
        } else if (k.kind === 'key') {
          this.setFlag(k.item)
          this.emit({ t: 'text', msg: `Picked up the ${k.name}.` })
          this.emit({ t: 'pickupKey', x: k.x, y: k.y })
        }
      }
    }
    this.pickups = this.pickups.filter((k) => k.ttl > 0)
  }

  // ---------- projectiles ----------
  spawnProj(kind, x, y, fx, fy, speed, dmg, side, owner) {
    const l = Math.hypot(fx, fy) || 1
    this.projs.push({
      id: nid(),
      kind,
      x,
      y,
      vx: (fx / l) * speed,
      vy: (fy / l) * speed,
      ttl: kind === 'firebolt' ? 1.1 : 2.6,
      dmg,
      side,
      owner,
    })
  }

  updateProjectiles(dt) {
    for (const pr of this.projs) {
      pr.ttl -= dt
      pr.x += pr.vx * dt
      pr.y += pr.vy * dt
      if (this.world.collides(pr.x, pr.y, 2, 2)) {
        pr.ttl = -1
        this.emit({ t: 'pfizzle', x: pr.x, y: pr.y, kind: pr.kind })
        continue
      }
      if (pr.side === 'p') {
        for (const e of this.enemies) {
          if (e.hp <= 0) continue
          if (dist(pr, e) < (e.kind === 'paleking' ? 13 : e.kind === 'brute' || e.kind === 'sentinel' ? 10 : 7)) {
            this.damageEnemy(e, pr.dmg, pr, 1.6)
            pr.ttl = -1
            break
          }
        }
        // firebolts light braziers
        if (pr.ttl > 0 && pr.kind === 'firebolt') {
          for (const b of this.world.props) {
            if (b.kind === 'brazier' && !b.lit && dist(pr, b) < 12) {
              this.lightBrazier(b)
              pr.ttl = -1
              break
            }
          }
        }
      } else {
        for (const p of this.alivePlayers()) {
          if (dist(pr, p) < 8) {
            this.damagePlayer(p, pr.dmg, pr)
            pr.ttl = -1
            break
          }
        }
      }
    }
    this.projs = this.projs.filter((p) => p.ttl > 0)
  }

  // ---------- enemies ----------
  updateEnemy(e, dt) {
    const def = ENEMIES[e.kind]
    e.hitFlash = Math.max(0, e.hitFlash - dt)
    e.t += dt
    e.atkT = Math.max(0, e.atkT - dt)
    e.kbx *= Math.pow(0.001, dt)
    e.kby *= Math.pow(0.001, dt)

    // apply knockback drift always
    if (Math.abs(e.kbx) + Math.abs(e.kby) > 4) {
      const [nx, ny] = this.world.moveEntity(e.x, e.y, e.kbx * dt, e.kby * dt, 5, 4)
      e.x = nx
      e.y = ny
    }

    if (e.stagger > 0) {
      e.stagger -= dt
      return
    }
    if (e.kind === 'paleking') return this.updateKing(e, dt)

    const target = this.nearestPlayer(e)
    const d = target ? dist(e, target) : Infinity

    switch (e.state) {
      case 'idle': {
        // gentle wander near spawn
        e.wanderA += (Math.random() - 0.5) * dt * 3
        const backX = e.sx - e.x
        const backY = e.sy - e.y
        const far = Math.hypot(backX, backY) > 40
        const wx = far ? backX : Math.cos(e.wanderA)
        const wy = far ? backY : Math.sin(e.wanderA)
        const wl = Math.hypot(wx, wy) || 1
        this.walkEnemy(e, (wx / wl) * def.speed * 0.25, (wy / wl) * def.speed * 0.25, dt)
        if (target && d < def.aggro) {
          e.state = 'chase'
          this.emit({ t: 'aggro', kind: e.kind, x: e.x, y: e.y })
        }
        break
      }
      case 'chase': {
        if (!target || d > def.aggro * 2.2) {
          e.state = 'idle'
          break
        }
        const ang = Math.atan2(target.y - e.y, target.x - e.x)
        e.fx = Math.cos(ang)
        e.fy = Math.sin(ang)
        if (e.kind === 'hound' || e.kind === 'alpha') {
          if (d < 70 && e.atkT <= 0) {
            e.state = 'wind'
            e.t = 0
            e.lungeX = Math.cos(ang)
            e.lungeY = Math.sin(ang)
          } else {
            // circle in
            const strafe = Math.sin(this.time * 2 + e.id) * 0.7
            this.walkEnemy(
              e,
              (e.fx + -e.fy * strafe) * def.speed,
              (e.fy + e.fx * strafe) * def.speed,
              dt
            )
          }
        } else if (e.kind === 'cultist') {
          // keep distance, cast
          if (d < 80) this.walkEnemy(e, -e.fx * def.speed, -e.fy * def.speed, dt)
          else if (d > 140) this.walkEnemy(e, e.fx * def.speed, e.fy * def.speed, dt)
          if (e.atkT <= 0 && d < 165) {
            e.state = 'wind'
            e.t = 0
          }
        } else if (e.kind === 'brute') {
          if (d < 30 && e.atkT <= 0) {
            e.state = 'wind'
            e.t = 0
          } else this.walkEnemy(e, e.fx * def.speed, e.fy * def.speed, dt)
        } else if (e.kind === 'wisp') {
          const s = Math.sin(this.time * 5 + e.id * 2) * 0.9
          this.walkEnemy(e, (e.fx + -e.fy * s) * def.speed, (e.fy + e.fx * s) * def.speed, dt, true)
          if (d < 9 && e.atkT <= 0) {
            this.damagePlayer(target, def.dmg, e)
            e.atkT = 1
          }
        } else {
          // husk
          this.walkEnemy(e, e.fx * def.speed, e.fy * def.speed, dt)
          if (d < 13 && e.atkT <= 0) {
            this.damagePlayer(target, def.dmg, e)
            e.atkT = 1.1
          }
        }
        break
      }
      case 'wind': {
        // telegraph
        const windDur = e.kind === 'cultist' ? 0.55 : e.kind === 'brute' ? 0.7 : 0.38
        if (e.t >= windDur) {
          e.t = 0
          if (e.kind === 'hound' || e.kind === 'alpha') {
            e.state = 'lunge'
          } else if (e.kind === 'cultist') {
            if (target) {
              const ang = Math.atan2(target.y - e.y, target.x - e.x)
              this.spawnProj('shadowbolt', e.x, e.y, Math.cos(ang), Math.sin(ang), 150, def.dmg, 'e', e.id)
              this.emit({ t: 'ecast', x: e.x, y: e.y })
            }
            e.atkT = 2.4
            e.state = 'chase'
          } else if (e.kind === 'brute') {
            // slam
            this.emit({ t: 'slam', x: e.x, y: e.y })
            for (const p of this.alivePlayers()) {
              if (dist(e, p) < 36) this.damagePlayer(p, def.dmg, e)
            }
            e.atkT = 2.2
            e.state = 'chase'
          }
        }
        break
      }
      case 'lunge': {
        const sp = def.speed * 3.2
        const [nx, ny] = this.world.moveEntity(e.x, e.y, e.lungeX * sp * dt, e.lungeY * sp * dt, 5, 4)
        e.x = nx
        e.y = ny
        for (const p of this.alivePlayers()) {
          if (dist(e, p) < 11 && e.atkT <= 0) {
            this.damagePlayer(p, def.dmg, e)
            e.atkT = 1.4
          }
        }
        if (e.t > 0.34) {
          e.state = 'chase'
          e.atkT = Math.max(e.atkT, 1.2)
          e.t = 0
        }
        break
      }
    }

    // light separation so enemies don't stack
    for (const o of this.enemies) {
      if (o === e || o.hp <= 0) continue
      const d2 = dist(e, o)
      if (d2 < 10 && d2 > 0.01) {
        const ang = Math.atan2(e.y - o.y, e.x - o.x)
        e.x += Math.cos(ang) * 14 * dt
        e.y += Math.sin(ang) * 14 * dt
      }
    }
  }

  walkEnemy(e, vx, vy, dt, ghost = false) {
    if (ghost) {
      e.x += vx * dt
      e.y += vy * dt
      if (this.world.collides(e.x, e.y, 3, 3)) {
        e.x -= vx * dt
        e.y -= vy * dt
      }
      return
    }
    const [nx, ny] = this.world.moveEntity(e.x, e.y, vx * dt, vy * dt, 5, 4)
    e.x = nx
    e.y = ny
  }

  nearestPlayer(e) {
    let best = null
    let bd = Infinity
    for (const p of this.alivePlayers()) {
      const d = dist(e, p)
      if (d < bd) {
        bd = d
        best = p
      }
    }
    return best
  }

  // ---------- the Pale King ----------
  updateBoss(dt) {
    if (this.zoneId !== 'throne') return
    const king = this.enemies.find((e) => e.kind === 'paleking')
    if (!this.bossState && king) {
      // trigger when players approach
      const near = this.alivePlayers().some((p) => dist(p, king) < 120)
      if (near) {
        this.bossState = { phase: 'intro', t: 0, hp: king.hp }
        this.emit({ t: 'bossintro' })
      }
    }
    if (this.bossState && this.bossState.phase === 'dying') {
      this.bossState.t += dt
      if (this.bossState.t > 2.5 && !this.bossState.outroSent) {
        this.bossState.outroSent = true
        this.emit({ t: 'bossoutro' })
      }
    }
  }

  updateKing(e, dt) {
    if (!this.bossState || this.bossState.phase === 'intro' || this.bossState.phase === 'dying') return
    const def = ENEMIES.paleking
    const frac = e.hp / e.maxhp
    const newPhase = frac < 0.33 ? 3 : frac < 0.66 ? 2 : 1
    if (newPhase > e.phase) {
      e.phase = newPhase
      this.emit({ t: 'bossphase', phase: newPhase })
    }
    const target = this.nearestPlayer(e)
    if (!target) return
    const d = dist(e, target)
    const speed = def.speed * (e.phase === 3 ? 1.35 : 1)

    e.sumT -= dt
    if (e.phase >= 2 && e.sumT <= 0) {
      e.sumT = e.phase === 3 ? 9 : 12
      const nAdds = this.enemies.filter((x) => x.kind !== 'paleking').length
      if (nAdds < 4) {
        const kind = e.phase === 3 ? 'wisp' : 'husk'
        for (let i = 0; i < 2; i++) {
          const a = Math.random() * Math.PI * 2
          this.spawnEnemy(kind, e.x + Math.cos(a) * 40, e.y + Math.sin(a) * 40, this.activePlayers().length)
        }
        this.emit({ t: 'summon', x: e.x, y: e.y })
      }
    }

    switch (e.state) {
      case 'idle':
        e.state = 'chase'
        break
      case 'chase': {
        const ang = Math.atan2(target.y - e.y, target.x - e.x)
        e.fx = Math.cos(ang)
        e.fy = Math.sin(ang)
        this.walkEnemy(e, e.fx * speed, e.fy * speed, dt)
        if (e.atkT <= 0) {
          if (d < 42) {
            e.state = 'wind'
            e.t = 0
            e.windKind = 'sweep'
          } else if (e.phase >= 1 && d < 190 && Math.random() < 0.012) {
            e.state = 'wind'
            e.t = 0
            e.windKind = e.phase >= 3 && Math.random() < 0.5 ? 'beam' : 'volley'
          }
        }
        break
      }
      case 'wind': {
        const durs = { sweep: 0.5, volley: 0.7, beam: 0.9 }
        if (e.windKind === 'beam' && !e.beam) {
          const ang = Math.atan2(target.y - e.y, target.x - e.x)
          e.beam = { ang, x: e.x, y: e.y }
          this.emit({ t: 'beamwarn', x: e.x, y: e.y, ang })
        }
        if (e.t >= durs[e.windKind]) {
          e.t = 0
          if (e.windKind === 'sweep') {
            this.emit({ t: 'kingsweep', x: e.x, y: e.y })
            for (const p of this.alivePlayers()) {
              if (dist(e, p) < 46) this.damagePlayer(p, def.dmg, e)
            }
            e.atkT = e.phase === 3 ? 0.9 : 1.4
          } else if (e.windKind === 'volley') {
            const n = e.phase >= 2 ? 8 : 3
            if (n === 8) {
              for (let i = 0; i < 8; i++) {
                const a = (i / 8) * Math.PI * 2
                this.spawnProj('shadowbolt', e.x, e.y, Math.cos(a), Math.sin(a), 130, 1, 'e', e.id)
              }
            } else {
              const ang = Math.atan2(target.y - e.y, target.x - e.x)
              for (let i = -1; i <= 1; i++) {
                this.spawnProj('shadowbolt', e.x, e.y, Math.cos(ang + i * 0.25), Math.sin(ang + i * 0.25), 150, 1, 'e', e.id)
              }
            }
            this.emit({ t: 'ecast', x: e.x, y: e.y })
            e.atkT = 1.8
          } else if (e.windKind === 'beam') {
            // damage along beam line
            this.emit({ t: 'beamfire', x: e.beam.x, y: e.beam.y, ang: e.beam.ang })
            for (const p of this.alivePlayers()) {
              const rel = { x: p.x - e.beam.x, y: p.y - e.beam.y }
              const along = rel.x * Math.cos(e.beam.ang) + rel.y * Math.sin(e.beam.ang)
              const across = Math.abs(-rel.x * Math.sin(e.beam.ang) + rel.y * Math.cos(e.beam.ang))
              if (along > 0 && along < 240 && across < 12) this.damagePlayer(p, 2, e)
            }
            e.beam = null
            e.atkT = 2.2
          }
          e.state = 'chase'
        }
        break
      }
    }
  }

  // ---------- exits / transitions ----------
  checkExits() {
    if (this.pendingZone) return
    for (const ex of this.world.exits) {
      for (const p of this.alivePlayers()) {
        const d = Math.hypot(p.x - ex.x, p.y - ex.y)
        if (d < 13) {
          if (!ex.to) {
            if (!this._deniedAt || this.time - this._deniedAt > 3) {
              this._deniedAt = this.time
              this.emit({ t: 'text', msg: ex.label || 'The way is sealed.' })
            }
            continue
          }
          if (ex.needs && !this.flag(ex.needs)) {
            if (!this._deniedAt || this.time - this._deniedAt > 3) {
              this._deniedAt = this.time
              this.emit({ t: 'text', msg: ex.denied || 'The way is sealed.' })
            }
            continue
          }
          this.pendingZone = { zone: ex.to, entry: ex.entry, label: ex.label }
          this.emit({ t: 'transition', ...this.pendingZone })
          return
        }
      }
    }
  }

  // ---------- shop ----------
  buyUpgrade(slot, upId) {
    const up = UPGRADES.find((u) => u.id === upId)
    const cur = (this.save.upgrades[slot] || {})[upId] || 0
    if (!up || cur >= up.max) return false
    const cost = up.costs[cur]
    if (this.save.embers < cost) return false
    this.save.embers -= cost
    this.save.upgrades[slot] = this.save.upgrades[slot] || {}
    this.save.upgrades[slot][upId] = cur + 1
    // apply immediately for hp/stam
    const p = this.players[slot]
    if (p) {
      if (upId === 'hp') {
        p.maxhp += 2
        p.hp += 2
      }
      if (upId === 'stam') {
        p.maxstam += 25
        p.stam += 25
      }
    }
    this.emit({ t: 'buy', slot, upId })
    return true
  }

  // ---------- net serialization (host -> guest) ----------
  snapshot(evts) {
    return {
      t: 'state',
      zone: this.zoneId,
      time: this.time,
      embers: this.save.embers,
      ups: this.save.upgrades,
      classes: this.save.classes,
      flags: {
        rustkey: this.flag('rustkey'),
        stormsigil: this.flag('stormsigil'),
        palesigil: this.flag('palesigil'),
      },
      players: this.players.map((p) =>
        p
          ? {
              id: p.id, cls: p.cls, x: r1(p.x), y: r1(p.y), fx: r2(p.fx), fy: r2(p.fy),
              hp: p.hp, maxhp: p.maxhp, stam: Math.round(p.stam), maxstam: p.maxstam,
              st: p.state, dT: r1(p.downT), rT: r2(p.reviveT), sw: r2(p.swing), sd: r2(p.swingDir),
              mv: p.moving ? 1 : 0, iT: r2(p.iT), dg: p.dodgeT > 0 ? 1 : 0, ds: p.dashT > 0 ? 1 : 0,
            }
          : null
      ),
      enemies: this.enemies.map((e) => ({
        id: e.id, k: e.kind, x: r1(e.x), y: r1(e.y), hp: e.hp, mhp: e.maxhp,
        st: e.state, fx: r2(e.fx), fy: r2(e.fy), hf: e.hitFlash > 0 ? 1 : 0,
        ph: e.phase, t: r2(e.t), wk: e.windKind || 0,
      })),
      projs: this.projs.map((p) => ({ id: p.id, k: p.kind, x: r1(p.x), y: r1(p.y), vx: r1(p.vx), vy: r1(p.vy) })),
      pickups: this.pickups.map((k) => ({ id: k.id, k: k.kind, x: r1(k.x), y: r1(k.y) })),
      props: this.world.props.map((pr) => ({ kind: pr.kind, tx: pr.tx, ty: pr.ty, lit: !!pr.lit, opened: !!pr.opened, taken: !!pr.taken })),
      gates: this.world.gates.map((g) => ({ tx: g.tx, ty: g.ty, o: g.opened ? 1 : 0 })),
      boss: this.bossState ? { phase: this.bossState.phase } : null,
      evts: evts || [],
    }
  }
}

function dist(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y)
}
function angDiff(a, b) {
  let d = a - b
  while (d > Math.PI) d -= Math.PI * 2
  while (d < -Math.PI) d += Math.PI * 2
  return d
}
const r1 = (v) => Math.round(v * 10) / 10
const r2 = (v) => Math.round(v * 100) / 100
