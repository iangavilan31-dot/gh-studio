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
    stocks: 3,
    ko: 0,                       // ticks of KO/respawn shimmer (F3)
    prev: { jump: false, light: false, heavy: false, special: false },
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

  // — buffered jump: a press is remembered for BUFFER ticks —
  if (pressed('jump')) f.jumpBuf = FEEL.BUFFER
  else if (f.jumpBuf > 0) f.jumpBuf--

  if (f.landlag > 0) {
    f.landlag--
    f.vx = 0
  } else {
    // — horizontal control —
    const target = (inp.x ?? 0) * (f.grounded ? f.k.runSpeed : f.k.airSpeed)
    const a = (f.grounded ? f.k.accel : f.k.airAccel) * dt
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
    if (f.y < top - 1e-6 && f.y > bottom - 1.4 && f.x > x0 - 0.3 && f.x < x1 + 0.3) {
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

  f.prev = { jump: !!inp.jump, light: !!inp.light, heavy: !!inp.heavy, special: !!inp.special }
}

const a2 = (a) => a // clarity alias

// The match container: fighters + arena + tick counter.
export function makeMatch(arena, fighters) {
  return { tick: 0, arena, fighters, events: [] }
}

export function stepMatch(m, inputsById) {
  m.events.length = 0
  for (const f of m.fighters) stepFighter(f, inputsById[f.id] ?? {}, m.arena, m.events)
  m.tick++
  return m.events
}
