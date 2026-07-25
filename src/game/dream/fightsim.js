// DREAMSCRAP fight sim (DREAMSCRAP_PASS Part 5, DECISIONS #8): a PURE
// fixed-timestep 60Hz platform-fighter simulation. No three.js, no DOM, no
// wall clock — ticks are the unit of truth. The renderer poses rigs from
// this state; the feel gates step it by hand; lockstep will feed it
// mirrored input queues. Determinism is law: no Math.random anywhere.

export const TICK = 1 / 60

// Part 5 feel constants — the numeric gates live on these.
export const FEEL = {
  BUFFER: 6,        // input buffer (ticks)
  COYOTE: 5,        // coyote time after walking off a ledge (ticks)
  LEDGE_SNAP: 0.35, // horizontal forgiveness onto platform edges (m)
  FASTFALL: 1.8,    // fall-speed multiplier while holding down in air
  DI_MAX: (20 * Math.PI) / 180, // DI-lite trajectory bend cap
}

// Base kinematics (per-fighter overrides scale these — weight/speed classes).
export const BASE = {
  runSpeed: 6.4,      // m/s
  airSpeed: 5.2,
  accel: 48,          // m/s^2 ground
  airAccel: 26,
  gravity: -30,
  jumpVel: 11.5,      // apex ≈ 2.2m in 23 ticks — platforms at 3.0 need jump+dj
  djVel: 10.4,        // dj apex ≈ 1.8m; the pair clears the 3.0 shelves with margin
  maxFall: -13,
  landLagLight: 2,    // ticks (by move weight: 2..8, Part 5)
  landLagHeavy: 8,
  weight: 1,          // knockback divisor
}

// Attack data (F2): phases in ticks; hitstop per Part 5 (lights 40–70ms =
// 3–4 ticks, heavies 80–130ms = 5–8); aerialLag = landing lag by weight 2–8.
export const ATTACKS = {
  light: { startup: 4, active: 3, recovery: 8, dmg: 6, baseKB: 4.4, growth: 0.13, angleDeg: 38, hitstop: 3, aerialLag: 3, range: 1.15, r: 0.85 },
  heavy: { startup: 13, active: 4, recovery: 17, dmg: 13, baseKB: 7.6, growth: 0.24, angleDeg: 44, hitstop: 6, aerialLag: 7, range: 1.45, r: 1.05 },
}
export const TOSS = { reach: 1.25, holdTicks: 45, throwKB: 5.2, throwAngleDeg: 55, escBase: 5, escPerWooze: 20 }

// One fighter's mutable sim state.
export function makeFighter(id, spec = {}) {
  return {
    id,
    k: { ...BASE, ...spec },     // kinematic + weight spec
    x: 0, y: 0, vx: 0, vy: 0,
    face: 1,                     // +1 right, -1 left
    grounded: false,
    coyote: 0,                   // ticks remaining to forgive a late jump
    jumpsLeft: 1,                // double-jump stock (refills on land)
    jumpBuf: 0,                  // buffered jump press (ticks remaining)
    fastfall: false,
    landlag: 0,                  // ticks locked after an aerial landing
    aerialWeight: 0,             // pending landing-lag ticks (set by moves)
    hitstop: 0,                  // ticks frozen by impact (F2)
    launched: 0,                 // ticks of launch state remaining (F2)
    wooze: 0,                    // accumulated geek (F2)
    stocks: spec.stocks ?? 3,
    ko: 0,                       // ticks of KO/respawn shimmer (F3)
    invuln: 0,                   // respawn shimmer ticks (2s = 120)
    move: null,                  // {name, t} active attack state
    hitIds: null,                // opponents already struck by this swing
    grab: -1,                    // id of the fighter holding us (-1 free)
    grabbing: -1,                // id we are holding
    grabT: 0, mash: 0,
    prev: { jump: false, light: false, heavy: false, special: false, toss: false },
  }
}

// Arena collision spec: solids block from all sides; plats are one-way
// (land from above only, drop-through with down+jump). blast = KO bounds.
export function makeArena(spec) {
  return {
    solids: spec.solids ?? [],   // {x, y, w, h} — y is TOP surface
    plats: spec.plats ?? [],     // {x, y, w} — thin one-way
    blast: spec.blast ?? { l: -30, r: 30, t: 24, b: -14 },
    spawns: spec.spawns ?? [[-4, 6], [4, 6], [-8, 6], [8, 6]],
    wrap: !!spec.wrap,           // Mote's dream loops left/right
  }
}

const landTop = (f, a, prevY) => {
  // returns the surface y under the fighter if this tick crosses one
  let best = null
  const check = (top, x0, x1, oneWay) => {
    // ledge forgiveness: snap on within LEDGE_SNAP of the edge
    if (f.x < x0 - FEEL.LEDGE_SNAP || f.x > x1 + FEEL.LEDGE_SNAP) return
    if (prevY >= top - 1e-6 && f.y <= top && f.vy <= 0) {
      if (oneWay && f.dropThru > 0) return
      if (best == null || top > best) best = top
    }
  }
  for (const s of a.solids) check(s.y, s.x - s.w / 2, s.x + s.w / 2, false)
  for (const p of a.plats) check(p.y, p.x - p.w / 2, p.x + p.w / 2, true)
  return best
}

// Advance ONE tick. inputs: {x:-1..1, down, jump, light, heavy, special, toss}
// Returns a list of events for presentation ('jump','djump','land','ko',...).
export function stepFighter(f, inp, arena, ev) {
  if (f.hitstop > 0) { f.hitstop--; return } // frozen mid-impact (F2)
  const dt = TICK
  const pressed = (name) => inp[name] && !f.prev[name]

  // — held in a grab: only mashing counts (escape scales with Wooze) —
  if (f.grab >= 0) {
    if (pressed('jump') || pressed('light') || pressed('heavy') || pressed('special') || pressed('toss')) f.mash++
    f.prev = { jump: !!inp.jump, light: !!inp.light, heavy: !!inp.heavy, special: !!inp.special, toss: !!inp.toss }
    return
  }

  // — attacks: light/heavy start when free; aerials pre-pay landing lag —
  if (!f.move && f.landlag <= 0 && f.launched <= 0) {
    const want = pressed('light') ? 'light' : pressed('heavy') ? 'heavy' : null
    if (want) {
      f.move = { name: want, t: 0 }
      f.hitIds = new Set()
      if (!f.grounded) f.aerialWeight = ATTACKS[want].aerialLag
      ev?.push({ t: 'swing', id: f.id, move: want })
    }
  }
  if (f.move) {
    const A = ATTACKS[f.move.name]
    f.move.t++
    if (f.move.t >= A.startup + A.active + A.recovery) f.move = null
  }
  if (f.launched > 0) f.launched--

  // — buffered jump: a press is remembered for BUFFER ticks —
  if (pressed('jump')) f.jumpBuf = FEEL.BUFFER
  else if (f.jumpBuf > 0) f.jumpBuf--

  if (f.landlag > 0) {
    f.landlag--
    f.vx = 0
  } else {
    // — horizontal control (damped mid-move on the ground; drift in the air;
    //   reduced while launched — DI already bent the trajectory at impact) —
    const ctl = f.move && f.grounded ? 0.15 : f.launched > 0 ? 0.3 : 1
    const target = (inp.x ?? 0) * (f.grounded ? f.k.runSpeed : f.k.airSpeed) * ctl
    const a = (f.grounded ? f.k.accel : f.k.airAccel) * dt * (ctl < 1 ? ctl * 2 : 1)
    if (f.vx < target) f.vx = Math.min(target, f.vx + a)
    else if (f.vx > target) f.vx = Math.max(target, f.vx - a)
    if (inp.x) f.face = inp.x > 0 ? 1 : -1

    // — jumps: grounded (or coyote), else double-jump —
    if (f.jumpBuf > 0) {
      if (f.grounded || f.coyote > 0) {
        f.vy = f.k.jumpVel
        f.grounded = false
        f.coyote = 0
        f.jumpBuf = 0
        f.fastfall = false
        ev?.push({ t: 'jump', id: f.id })
      } else if (f.jumpsLeft > 0) {
        f.jumpsLeft--
        f.vy = f.k.djVel
        f.jumpBuf = 0
        f.fastfall = false
        ev?.push({ t: 'djump', id: f.id })
      }
    }
    // drop through one-way platforms: hold down + press jump while grounded
    if (f.grounded && inp.down && pressed('jump')) {
      f.dropThru = 8
      f.grounded = false
      f.y -= 0.02
      f.jumpBuf = 0
    }
  }

  // — gravity, fast-fall —
  if (!f.grounded) {
    if (inp.down && f.vy < 2 && !f.fastfall) { f.fastfall = true; ev?.push({ t: 'fastfall', id: f.id }) }
    const g = f.k.gravity * (f.fastfall ? FEEL.FASTFALL : 1) * dt
    f.vy = Math.max(f.k.maxFall * (f.fastfall ? FEEL.FASTFALL : 1), f.vy + g)
  }
  if (f.dropThru > 0) f.dropThru--

  // — integrate —
  const prevY = f.y
  f.x += f.vx * dt
  f.y += f.vy * dt

  // — walls of solids: push out horizontally, NEVER stick (Part 5) —
  for (const s of a2(arena).solids) {
    const x0 = s.x - s.w / 2, x1 = s.x + s.w / 2
    const top = s.y, bottom = s.y - s.h
    // side-entry only: a fighter descending from ABOVE the top is landing,
    // not wall-clipping — without the prevY guard, the frame that dips a
    // hair below the top teleported them to the slab's far END face
    if (prevY < top - 1e-6 && f.y < top - 1e-6 && f.y > bottom - 1.4 && f.x > x0 - 0.3 && f.x < x1 + 0.3) {
      // inside the slab band: push to the nearer face; vy untouched (no stick)
      f.x = (f.x - s.x < 0 ? x0 - 0.3 : x1 + 0.3)
      f.vx = 0
    }
  }

  // — arena wrap (Mote's dream) or blast walls —
  const b = arena.blast
  if (arena.wrap) {
    if (f.x < b.l) f.x = b.r - 0.01
    else if (f.x > b.r) f.x = b.l + 0.01
  }

  // — landing —
  const top = landTop(f, arena, prevY)
  if (top != null) {
    if (!f.grounded) {
      f.y = top
      f.vy = 0
      f.grounded = true
      f.jumpsLeft = 1
      f.fastfall = false
      f.landlag = Math.max(0, f.aerialWeight)
      f.aerialWeight = 0
      ev?.push({ t: 'land', id: f.id, lag: f.landlag })
    } else { f.y = top }
    f.coyote = FEEL.COYOTE
  } else if (f.grounded) {
    // walked off an edge: coyote countdown begins
    f.grounded = false
    f.coyote = FEEL.COYOTE
    ev?.push({ t: 'edge', id: f.id })
  } else if (f.coyote > 0) f.coyote--

  f.prev = { jump: !!inp.jump, light: !!inp.light, heavy: !!inp.heavy, special: !!inp.special, toss: !!inp.toss }
}

const a2 = (a) => a // clarity alias

// The match container: fighters + arena + tick counter.
export function makeMatch(arena, fighters) {
  return { tick: 0, arena, fighters, events: [] }
}

const deg = (d) => (d * Math.PI) / 180

// Apply a launch to `d` from direction `dir` with knockback kb; the
// defender's held stick bends the trajectory by up to DI_MAX (DI-lite).
function launch(d, dir, kb, angleDeg, di, ev, cause) {
  let ang = deg(angleDeg)
  const bend = Math.max(-1, Math.min(1, di ?? 0)) * FEEL.DI_MAX
  ang += bend
  d.vx = Math.cos(ang) * kb * dir
  d.vy = Math.sin(ang) * kb
  d.grounded = false
  d.launched = Math.round(kb * 2.2)
  d.fastfall = false
  ev.push({ t: 'launch', id: d.id, kb: +kb.toFixed(2), ang: +(ang * 180 / Math.PI).toFixed(2), cause })
}

const RESPAWN = { wait: 90, dropY: 13, restY: 6, invuln: 120 } // 1.5s ride, 2s shimmer

export function stepMatch(m, inputsById) {
  m.events.length = 0
  const ev = m.events
  if (m.over) { m.tick++; return ev } // the dream is settling; nobody moves

  for (const f of m.fighters) {
    if (f.stocks <= 0) continue // gone until the victory nap
    // — respawn ride: descending moon platform, drop off early with jump —
    if (f.ko > 0) {
      f.ko--
      const t = 1 - f.ko / RESPAWN.wait
      f.x = 0
      f.y = RESPAWN.dropY - (RESPAWN.dropY - RESPAWN.restY) * t
      f.vx = 0; f.vy = 0
      const inp = inputsById[f.id] ?? {}
      if ((inp.jump && !f.prev.jump) || f.ko === 0) {
        f.ko = 0
        f.grounded = false
        f.jumpsLeft = 1
        f.invuln = RESPAWN.invuln // exactly 2s of shimmer from the drop (Part 2)
        ev.push({ t: 'respawnDrop', id: f.id })
      }
      f.prev.jump = !!inp.jump
      continue
    }
    if (f.invuln > 0) f.invuln--
    stepFighter(f, inputsById[f.id] ?? {}, m.arena, ev)
  }

  // — blast zones: KO, stock loss, respawn or elimination (F3) —
  const b = m.arena.blast
  for (const f of m.fighters) {
    if (f.stocks <= 0 || f.ko > 0) continue
    const out = (!m.arena.wrap && (f.x < b.l || f.x > b.r)) || f.y < b.b || (f.y > b.t && f.vy > 4)
    if (!out) continue
    f.stocks--
    const side = f.y < b.b ? 'bottom' : f.y > b.t ? 'top' : f.x < b.l ? 'left' : 'right'
    ev.push({ t: 'ko', id: f.id, side, x: +f.x.toFixed(2), y: +f.y.toFixed(2), stocks: f.stocks })
    if (f.grab >= 0) { m.fighters[f.grab].grabbing = -1; f.grab = -1 }
    if (f.grabbing >= 0) { m.fighters[f.grabbing].grab = -1; f.grabbing = -1 }
    f.move = null; f.launched = 0; f.wooze = 0; f.fastfall = false
    if (f.stocks > 0) {
      f.ko = RESPAWN.wait
      f.invuln = RESPAWN.wait + RESPAWN.invuln // shimmer runs through the ride + 2s free
      f.x = 0; f.y = RESPAWN.dropY; f.vx = 0; f.vy = 0
    } else {
      ev.push({ t: 'eliminated', id: f.id })
    }
  }

  // — last wizard still dreaming wins —
  const alive = m.fighters.filter((f) => f.stocks > 0)
  if (alive.length <= 1 && m.fighters.length > 1 && !m.over) {
    m.over = true
    m.winner = alive[0]?.id ?? -1
    ev.push({ t: 'matchEnd', winner: m.winner })
  }

  // — grabs: start / hold / escape / throw (gentle, per Part 3) —
  for (const f of m.fighters) {
    const inp = inputsById[f.id] ?? {}
    const tossPressed = !!inp.toss && !f.tossHeld
    f.tossHeld = !!inp.toss
    if (f.grab >= 0 || f.hitstop > 0) continue
    // start a toss: press with a free opponent in reach
    if (tossPressed && f.grabbing < 0 && !f.move && f.landlag <= 0) {
      for (const d of m.fighters) {
        if (d.id === f.id || d.grab >= 0 || d.ko > 0 || d.stocks <= 0 || d.invuln > 0) continue
        if (Math.abs(d.x - f.x) <= TOSS.reach && Math.abs(d.y - f.y) < 1.2 && (d.x - f.x) * f.face >= -0.2) {
          if (d.noGrab) { ev.push({ t: 'nograb', id: d.id }); continue } // the Chicken, obviously
          f.grabbing = d.id; f.grabT = 0
          d.grab = f.id; d.mash = 0
          ev.push({ t: 'grab', a: f.id, d: d.id })
          break
        }
      }
    } else if (f.grabbing >= 0) {
      const d = m.fighters[f.grabbing]
      f.grabT++
      d.x = f.x + f.face * 0.95
      d.y = f.y
      d.vx = 0; d.vy = 0
      const need = TOSS.escBase + Math.floor(d.wooze / TOSS.escPerWooze)
      if (d.mash >= need) {
        // escaped: both shove apart, no damage — a gentle system
        d.grab = -1; f.grabbing = -1
        d.vx = f.face * 3.2; f.vx = -f.face * 2.2
        ev.push({ t: 'tossEscape', id: d.id, mashed: d.mash, needed: need })
      } else if (f.grabT >= TOSS.holdTicks || (tossPressed && f.grabT > 8)) {
        const dir = (inp.x ?? 0) < 0 ? -1 : f.face
        d.grab = -1; f.grabbing = -1
        d.wooze += 4
        launch(d, dir, TOSS.throwKB + d.wooze * 0.06, TOSS.throwAngleDeg, inputsById[d.id]?.x, ev, 'toss')
        d.hitstop = 3; f.hitstop = 3
        ev.push({ t: 'throw', a: f.id, d: d.id })
      }
    }
  }

  // — hitboxes: active swing frames vs free opponents (id order = determinism) —
  for (const f of m.fighters) {
    if (!f.move || f.hitstop > 0) continue
    const A = ATTACKS[f.move.name]
    if (f.move.t <= A.startup || f.move.t > A.startup + A.active) continue
    const hx = f.x + f.face * A.range, hy = f.y + 1.0
    for (const d of m.fighters) {
      if (d.id === f.id || f.hitIds.has(d.id) || d.ko > 0 || d.invuln > 0) continue
      const dx = d.x - hx, dy = d.y + 0.9 - hy
      if (dx * dx + dy * dy > (A.r + 0.45) ** 2) continue
      f.hitIds.add(d.id)
      d.wooze += A.dmg
      if (d.grab >= 0) { m.fighters[d.grab].grabbing = -1; d.grab = -1 } // hits break grabs
      const kb = (A.baseKB + d.wooze * A.growth) / d.k.weight
      launch(d, f.face, kb, A.angleDeg, inputsById[d.id]?.x, ev, f.move.name)
      // Part 5: BOTH parties frozen; particles keep drifting (presentation)
      d.hitstop = A.hitstop
      f.hitstop = A.hitstop
      // shake command: amplitude scales with kb, presentation-capped
      ev.push({ t: 'hit', a: f.id, d: d.id, move: f.move.name, kb: +kb.toFixed(2), wooze: d.wooze, shake: Math.min(1, kb / 16), shakeTicks: Math.min(12, 4 + Math.round(kb)) })
    }
  }

  m.tick++
  return ev
}
