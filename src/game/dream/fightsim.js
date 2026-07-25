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

// ═══ F4: THE ROSTER (Part 3) — all sim-side data, rigs live in dream.js ═══
// Every fighter: light/heavy/special/toss + a Deep Dream super charged by
// landing hits. Balance philosophy: no infinites, toss-escapes at high
// wooze, and the Chicken is genuinely good. That last part is just how it is.
export const FIGHTERS = {
  lamplighter: {
    name: 'The Lamplighter', archetype: 'all-rounder',
    spec: {}, special: 'flameDart', superKind: 'moonrise',
  },
  beldam: {
    name: 'Beldam', archetype: 'drunken master',
    spec: { runSpeed: 6.0, accel: 42 },
    attacks: { light: { angleDeg: 30 }, heavy: { baseKB: 8.0, startup: 15 } },
    special: 'swig', superKind: 'bottleTornado',
  },
  nib: {
    name: 'Nib', archetype: 'tiny, fastest, lightest',
    spec: { runSpeed: 7.9, airSpeed: 6.6, weight: 0.78, jumpVel: 12.1, djVel: 11.0, accel: 60 },
    attacks: { light: { dmg: 5, baseKB: 3.9, range: 0.95 }, heavy: { dmg: 11, baseKB: 6.8, startup: 10, range: 1.2 } },
    hurtR: 0.32, special: 'hatThrow', superKind: 'constellation',
  },
  curator: {
    name: 'The Curator', archetype: 'zoner, floaty',
    spec: { gravity: -21, maxFall: -9, airSpeed: 6.0, runSpeed: 5.6, weight: 0.95 },
    special: 'dustGust', superKind: 'party',
  },
  paleking: {
    name: 'The Pale King', archetype: 'heavy, armored',
    spec: { runSpeed: 5.0, weight: 1.35, jumpVel: 10.8, accel: 38 },
    attacks: { light: { dmg: 7, baseKB: 4.8, startup: 6 }, heavy: { dmg: 16, baseKB: 8.8, startup: 16, recovery: 20, range: 1.7 } },
    special: 'capeSweep', superKind: 'chandeliers',
  },
  mote: {
    name: 'Mote', archetype: 'tank; hits like a landslide',
    spec: { runSpeed: 4.4, airSpeed: 4.0, weight: 1.6, jumpVel: 10.6, accel: 30 },
    attacks: { light: { dmg: 8, baseKB: 5.2, startup: 7, recovery: 11 }, heavy: { dmg: 18, baseKB: 9.6, startup: 19, recovery: 24, hitstop: 8 } },
    special: 'shellSpin', superKind: 'oldForest',
  },
  chicken: {
    name: 'The Chicken', archetype: 'joke character',
    spec: { runSpeed: 7.4, airSpeed: 6.2, weight: 0.85, jumpVel: 11.9, djVel: 10.9, accel: 64 },
    attacks: { light: { startup: 3, recovery: 6, dmg: 5, baseKB: 3.6, range: 0.9 }, heavy: { startup: 9, dmg: 12, baseKB: 7.2, range: 1.1 } },
    noGrab: true, hurtR: 0.3, special: 'peckFlurry', superKind: 'derby',
  },
  watcher: {
    name: 'The Watcher', archetype: 'mirror-spacing wraith', secret: true,
    spec: { runSpeed: 6.6, airSpeed: 5.8, weight: 0.92, gravity: -26 },
    special: 'fogStep', superKind: 'lightsOut',
  },
}

// Special-move frame data (phases in ticks, aerialLag = landing-lag weight).
export const SPECIALS = {
  flameDart: { startup: 9, active: 2, recovery: 12, aerialLag: 4 },
  swig: { startup: 6, active: 16, recovery: 10, aerialLag: 5 },
  hatThrow: { startup: 8, active: 2, recovery: 10, aerialLag: 4 },
  dustGust: { startup: 7, active: 14, recovery: 9, aerialLag: 4 },
  capeSweep: { startup: 12, active: 5, recovery: 16, aerialLag: 6 },
  shellSpin: { startup: 8, active: 30, recovery: 12, aerialLag: 6 },
  peckFlurry: { startup: 4, active: 18, recovery: 9, aerialLag: 3, interval: 5 },
  fogStep: { startup: 8, active: 1, recovery: 7, aerialLag: 3 },
}
// Deep Dream meter: fills by damage LANDED (dmg * FILL_PER_DMG, cap 100);
// pressing special at full lantern casts the super instead.
export const SUPER = { castStartup: 6, castActive: 1, castRecovery: 14, aerialLag: 4, fillPerDmg: 0.9 }

// Deterministic per-tick noise (Beldam's stagger, item wobble): no
// Math.random in the sim, ever — lockstep depends on it.
export function dnoise(tick, id, salt = 0) {
  let h = (tick * 374761393 + id * 668265263 + (salt + 1) * 974634541) | 0
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}

// One fighter's mutable sim state. spec.fid picks a FIGHTERS kit; other
// spec keys override kinematics directly (stocks, test tweaks).
export function makeFighter(id, spec = {}) {
  const fid = spec.fid ?? 'lamplighter'
  const def = FIGHTERS[fid] ?? FIGHTERS.lamplighter
  const { fid: _f, stocks: _s, ...kOverrides } = spec
  return {
    id,
    fid,
    k: { ...BASE, ...def.spec, ...kOverrides }, // kinematic + weight spec
    atk: {
      light: { ...ATTACKS.light, ...(def.attacks?.light ?? {}) },
      heavy: { ...ATTACKS.heavy, ...(def.attacks?.heavy ?? {}) },
      special: { ...(SPECIALS[def.special] ?? SPECIALS.flameDart) },
      super: { startup: SUPER.castStartup, active: SUPER.castActive, recovery: SUPER.castRecovery, aerialLag: SUPER.aerialLag },
    },
    noGrab: !!def.noGrab,        // the Chicken, obviously
    hurtR: def.hurtR ?? 0.45,
    deep: 0,                     // Deep Dream lantern 0..100 (fills on hits landed)
    armorT: 0,                   // armor frames: absorb launches (Beldam swig, King cape)
    ghostT: 0,                   // fog-step mist: untargetable, deals nothing
    slowFallT: 0,                // Moonrise: enemies drift (gravity x0.35)
    superFx: null,               // persistent super state {kind, t, ...}
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

  // — attacks: light/heavy/special start when free; a full lantern turns
  //   the special press into the Deep Dream super; aerials pre-pay lag —
  if (!f.move && f.landlag <= 0 && f.launched <= 0) {
    const want = pressed('light') ? 'light' : pressed('heavy') ? 'heavy'
      : pressed('special') ? (f.deep >= 100 ? 'super' : 'special') : null
    if (want) {
      f.move = { name: want, t: 0 }
      f.hitIds = new Set()
      if (!f.grounded) f.aerialWeight = f.atk[want].aerialLag
      ev?.push({ t: 'swing', id: f.id, move: want, fid: f.fid })
    }
  }
  if (f.move) {
    const A = f.atk[f.move.name]
    f.move.t++
    if (f.move.t >= A.startup + A.active + A.recovery) f.move = null
  }
  if (f.launched > 0) f.launched--
  if (f.armorT > 0) f.armorT--
  if (f.ghostT > 0) f.ghostT--
  if (f.slowFallT > 0) f.slowFallT--

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

  // — gravity, fast-fall (Moonrise slow-fall drifts its victims) —
  if (!f.grounded) {
    if (inp.down && f.vy < 2 && !f.fastfall) { f.fastfall = true; ev?.push({ t: 'fastfall', id: f.id }) }
    const drift = f.slowFallT > 0 ? 0.35 : 1
    const g = f.k.gravity * (f.fastfall ? FEEL.FASTFALL : 1) * drift * dt
    f.vy = Math.max(f.k.maxFall * (f.fastfall ? FEEL.FASTFALL : 1) * drift, f.vy + g)
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

// The match container: fighters + arena + tick counter (+ live projectiles
// and super hazards: chandeliers, waltzing ghosts, roots, the Derby).
export function makeMatch(arena, fighters) {
  return { tick: 0, arena, fighters, events: [], projs: [], hazards: [], lightsOutT: 0 }
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
    if (!f.move || f.hitstop > 0 || f.stocks <= 0 || f.ko > 0) continue
    if (f.move.name === 'light' || f.move.name === 'heavy') {
      const A = f.atk[f.move.name]
      if (f.move.t <= A.startup || f.move.t > A.startup + A.active) continue
      hitCircle(f, m, inputsById, ev, A, f.move.name)
    } else if (f.move.name === 'special') {
      stepSpecial(f, m, inputsById, ev)
    } else if (f.move.name === 'super' && f.move.t === f.atk.super.startup + 1) {
      f.deep = 0
      castSuper(f, m, inputsById, ev)
    }
  }

  // — persistent supers + hazards (tornado pulses, chandeliers, roots,
  //   waltzing nobles, the Derby) —
  stepSuperFx(m, inputsById, ev)

  // — projectiles: darts fly, hats come back (id order = determinism) —
  if (m.projs.length) {
    for (const p of m.projs) {
      p.t++
      if (p.kind === 'hat') {
        p.vx -= p.face * 0.34 // boomerang: decelerate, turn, hit on the way home
        if (!p.turned && p.vx * p.face <= 0) { p.turned = true; p.hitIds.clear() }
      }
      p.x += p.vx * TICK
      p.y += (p.vy ?? 0) * TICK
      if (p.kind === 'dart' && p.t % 6 === 0) ev.push({ t: 'dartTrail', x: +p.x.toFixed(2), y: +p.y.toFixed(2) })
      if (p.kind === 'hat' && p.turned) {
        const o = m.fighters[p.owner]
        if (o && Math.abs(o.x - p.x) < 0.7 && Math.abs(o.y + 1.3 - p.y) < 1.2) { p.dead = true; ev.push({ t: 'hatCatch', id: p.owner }) }
      }
      const bb = m.arena.blast
      if (p.x < bb.l - 1 || p.x > bb.r + 1 || p.t >= p.life) p.dead = true
      for (const d of m.fighters) {
        if (p.dead || d.id === p.owner || p.hitIds.has(d.id) || d.ko > 0 || d.invuln > 0 || d.stocks <= 0 || d.ghostT > 0) continue
        const dx = d.x - p.x, dy = d.y + 0.9 - p.y
        if (dx * dx + dy * dy > (0.5 + d.hurtR) ** 2) continue
        p.hitIds.add(d.id)
        const o = m.fighters[p.owner]
        applyHit(o ?? { id: p.owner, deep: 0, hitstop: 0, face: Math.sign(p.vx) || 1 }, d, m, inputsById, ev,
          { dmg: p.dmg, baseKB: p.kb, growth: 0.1, angleDeg: p.ang, hitstop: 3, r: 0.5 }, p.kind, Math.sign(p.vx) || 1)
        if (p.kind === 'dart') p.dead = true
      }
    }
    m.projs = m.projs.filter((p) => !p.dead)
  }

  m.tick++
  return ev
}

// ═══ F4: shared hit application (melee, specials, projectiles) ═══
// Keeps the F2 event shape exact; adds armor absorption + Deep Dream fill.
function applyHit(f, d, m, inputsById, ev, A, cause, dirOverride = null) {
  // Constellation Slam: while Nib IS the constellation, everything lands huge
  const amp = f.superFx?.kind === 'constellation' ? 1.6 : 1
  d.wooze += Math.round(A.dmg * amp)
  f.deep = Math.min(100, (f.deep ?? 0) + A.dmg * SUPER.fillPerDmg)
  if (d.grab >= 0) { m.fighters[d.grab].grabbing = -1; d.grab = -1 } // hits break grabs
  const kb = (A.baseKB * (amp > 1 ? 1.35 : 1) + d.wooze * A.growth) / d.k.weight
  const dir = dirOverride ?? f.face
  if (d.armorT > 0) {
    // armor frames: the wooze lands, the launch does not (royal/drunken poise)
    f.hitstop = Math.max(f.hitstop, 2)
    ev.push({ t: 'armored', id: d.id, cause })
  } else {
    launch(d, dir, kb, A.angleDeg, inputsById[d.id]?.x, ev, cause)
    // Part 5: BOTH parties frozen; particles keep drifting (presentation)
    d.hitstop = A.hitstop
    f.hitstop = Math.max(f.hitstop, A.hitstop)
  }
  // shake command: amplitude scales with kb, presentation-capped
  ev.push({ t: 'hit', a: f.id, d: d.id, move: cause, kb: +kb.toFixed(2), wooze: d.wooze, shake: Math.min(1, kb / 16), shakeTicks: Math.min(12, 4 + Math.round(kb)) })
}

function hitCircle(f, m, inputsById, ev, A, cause) {
  const hx = f.x + f.face * (A.range ?? 1.0), hy = f.y + 1.0
  for (const d of m.fighters) {
    if (d.id === f.id || f.hitIds.has(d.id) || d.ko > 0 || d.invuln > 0 || d.stocks <= 0 || d.ghostT > 0) continue
    const dx = d.x - hx, dy = d.y + 0.9 - hy
    if (dx * dx + dy * dy > (A.r + d.hurtR) ** 2) continue
    f.hitIds.add(d.id)
    applyHit(f, d, m, inputsById, ev, A, cause)
  }
}

// ═══ F4: the eight specials (Part 3) — each runs inside move 'special' ═══
function stepSpecial(f, m, inputsById, ev) {
  const kind = (FIGHTERS[f.fid] ?? FIGHTERS.lamplighter).special
  const S = f.atk.special
  const t = f.move.t
  const inActive = t > S.startup && t <= S.startup + S.active
  switch (kind) {
    case 'flameDart': // a warm dart that flies true and leaves a footprint trail
      if (t === S.startup + 1) {
        m.projs.push({ kind: 'dart', owner: f.id, x: f.x + f.face * 0.7, y: f.y + 1.1, vx: f.face * 11, vy: 0, life: 44, dmg: 5, kb: 3.9, ang: 30, t: 0, hitIds: new Set() })
        ev.push({ t: 'proj', kind: 'dart', id: f.id })
      }
      break
    case 'swig': { // drunken stagger-dash: armored, direction is her business
      if (t === S.startup + 1) {
        f.swigDir = dnoise(m.tick, f.id, 3) < 0.35 ? -f.face : f.face
        ev.push({ t: 'swig', id: f.id, dir: f.swigDir })
      }
      if (inActive) {
        f.armorT = 2
        f.vx = f.swigDir * (7.5 + dnoise(m.tick, f.id, 5) * 3)
        hitCircle(f, m, inputsById, ev, { range: 0.5, r: 0.9, dmg: 8, baseKB: 6.0, growth: 0.17, angleDeg: 46, hitstop: 5 }, 'swig')
      }
      break
    }
    case 'hatThrow': // the hat comes back; so does the hitbox
      if (t === S.startup + 1) {
        m.projs.push({ kind: 'hat', owner: f.id, face: f.face, x: f.x + f.face * 0.6, y: f.y + 1.3, vx: f.face * 9.5, vy: 0, life: 90, dmg: 4, kb: 3.4, ang: 42, t: 0, hitIds: new Set() })
        ev.push({ t: 'proj', kind: 'hat', id: f.id })
      }
      break
    case 'dustGust': // pushes without damage — polite, devastating near ledges
      if (inActive) {
        for (const d of m.fighters) {
          if (d.id === f.id || d.stocks <= 0 || d.ko > 0 || d.invuln > 0 || d.ghostT > 0) continue
          const dx = d.x - f.x
          if (dx * f.face > 0 && Math.abs(dx) < 2.8 && Math.abs(d.y - f.y) < 1.6) {
            // positional shove: ground friction can't eat it — the gust WINS
            d.x += f.face * 3.0 * TICK
            d.vx += f.face * 9 * TICK
            if (!d.grounded) d.vy += 5 * TICK
            if (t === S.startup + 1) ev.push({ t: 'gust', a: f.id, d: d.id })
          }
        }
      }
      break
    case 'capeSweep': // royal armor through the whole gesture
      if (t <= S.startup + S.active) f.armorT = 2
      if (inActive) hitCircle(f, m, inputsById, ev, { range: 1.75, r: 1.2, dmg: 12, baseKB: 8.2, growth: 0.22, angleDeg: 50, hitstop: 6 }, 'capeSweep')
      break
    case 'shellSpin': // rolls, bonks, can't stop well
      if (inActive) {
        f.vx = f.face * 7.2
        hitCircle(f, m, inputsById, ev, { range: 0.4, r: 1.0, dmg: 9, baseKB: 6.2, growth: 0.18, angleDeg: 40, hitstop: 5 }, 'shellSpin')
      }
      break
    case 'peckFlurry': { // many tiny nos, then one big one
      if (inActive) {
        const step = t - S.startup
        if (step % (S.interval ?? 5) === 1) f.hitIds.clear()
        const last = step > S.active - (S.interval ?? 5)
        hitCircle(f, m, inputsById, ev, last
          ? { range: 1.0, r: 0.8, dmg: 4, baseKB: 5.6, growth: 0.16, angleDeg: 42, hitstop: 4 }
          : { range: 1.0, r: 0.8, dmg: 2, baseKB: 1.6, growth: 0.02, angleDeg: 18, hitstop: 2 }, 'peck')
      }
      break
    }
    case 'fogStep': // a short step through somewhere colder
      if (t === S.startup + 1) {
        const bb = m.arena.blast
        f.x = Math.max(bb.l + 1.5, Math.min(bb.r - 1.5, f.x + f.face * 3.4))
        f.ghostT = 10
        ev.push({ t: 'fogstep', id: f.id, x: +f.x.toFixed(2) })
      }
      break
  }
}

// ═══ F4: Deep Dream supers — cast at full lantern (effects land per kind;
// the ones not yet built still cast, spend the meter, and announce) ═══
function castSuper(f, m, inputsById, ev) {
  const kind = (FIGHTERS[f.fid] ?? FIGHTERS.lamplighter).superKind
  ev.push({ t: 'super', id: f.id, kind })
  switch (kind) {
    case 'moonrise': // a mini moon rises: enemies drift for 3s + a ring at cast
      for (const d of m.fighters) {
        if (d.id === f.id || d.stocks <= 0 || d.ko > 0) continue
        d.slowFallT = 180
        const dx = d.x - f.x, dy = d.y - f.y
        if (dx * dx + dy * dy < 36 && d.invuln <= 0 && d.ghostT <= 0 && d.armorT <= 0) {
          d.wooze += 10
          launch(d, Math.sign(dx) || f.face, (9 + d.wooze * 0.12) / d.k.weight, 52, inputsById[d.id]?.x, ev, 'moonrise')
          d.hitstop = 6
          ev.push({ t: 'hit', a: f.id, d: d.id, move: 'moonrise', kb: +((9 + d.wooze * 0.12) / d.k.weight).toFixed(2), wooze: d.wooze, shake: 0.9, shakeTicks: 12 })
        }
      }
      f.hitstop = 6
      f.superFx = { kind, t: 180 } // the moon hangs for the drift's duration
      break
    case 'bottleTornado': // orbiting bottles; the screen sways for everyone
      f.superFx = { kind, t: 150 }
      break
    case 'constellation': // Nib IS the constellation, briefly enormous
      f.superFx = { kind, t: 240, restoreWeight: f.k.weight }
      f.k.weight = f.k.weight * 1.45
      break
    case 'party': // ghost nobles waltz across the stage as moving hazards
      for (let i = 0; i < 3; i++) {
        m.hazards.push({ kind: 'waltz', owner: f.id, x: m.arena.blast.l - 2 - i * 4.5, y: 0, vx: 4.6, t: 0, warn: 0, hitIds: new Set() })
      }
      break
    case 'chandeliers': // telegraphed spotlight slams (hazard law: 1.5s warm)
      for (const ox of [-4.5, 0, 4.5]) {
        const bb = m.arena.blast
        m.hazards.push({ kind: 'chand', owner: f.id, x: Math.max(bb.l + 2, Math.min(bb.r - 2, f.x + ox)), y: 14, vy: 0, t: 0, warn: 90, hitIds: new Set() })
      }
      break
    case 'oldForest': // roots erupt along the ground in sequence
      for (let i = 0; i < 5; i++) {
        m.hazards.push({ kind: 'root', owner: f.id, x: f.x + f.face * (1.8 + i * 2.2), y: 0, t: 0, warn: 30 + i * 12, hitIds: new Set() })
      }
      break
    case 'derby': { // a stampede of chickens crosses the stage
      const bb = m.arena.blast
      for (let i = 0; i < 6; i++) {
        m.hazards.push({ kind: 'derbybird', owner: f.id, x: (f.face > 0 ? bb.l - 1 : bb.r + 1) - f.face * i * 2.4, y: 0, vx: f.face * 11, t: 0, warn: 0, hitIds: new Set() })
      }
      break
    }
    case 'lightsOut': // the warm accents go out; only lantern pools remain
      m.lightsOutT = 180
      f.superFx = { kind, t: 180 }
      break
  }
}

// Persistent super effects + hazards, stepped once per tick.
function stepSuperFx(m, inputsById, ev) {
  for (const f of m.fighters) {
    const fx = f.superFx
    if (!fx) continue
    fx.t--
    if (fx.kind === 'bottleTornado' && f.stocks > 0 && f.ko <= 0) {
      if (fx.t % 12 === 0) {
        // orbiting bottles pulse a ring around Beldam herself
        const save = f.hitIds
        f.hitIds = new Set()
        for (const d of m.fighters) {
          if (d.id === f.id || d.ko > 0 || d.invuln > 0 || d.stocks <= 0 || d.ghostT > 0) continue
          const dx = d.x - f.x, dy = d.y + 0.9 - (f.y + 1.0)
          if (dx * dx + dy * dy > (2.3 + d.hurtR) ** 2) continue
          applyHit(f, d, m, inputsById, ev, { dmg: 4, baseKB: 5, growth: 0.12, angleDeg: 55, hitstop: 3, r: 2.3 }, 'bottleTornado', Math.sign(dx) || f.face)
        }
        f.hitIds = save
        ev.push({ t: 'tornadoPulse', id: f.id })
      }
    }
    if (fx.t <= 0) {
      if (fx.kind === 'constellation' && fx.restoreWeight != null) f.k.weight = fx.restoreWeight
      f.superFx = null
      ev.push({ t: 'superEnd', id: f.id, kind: fx.kind })
    }
  }
  if (m.lightsOutT > 0) m.lightsOutT--

  // — hazards —
  if (m.hazards.length) {
    const bb = m.arena.blast
    for (const h of m.hazards) {
      h.t++
      if (h.warn > 0) { h.warn--; continue } // telegraphing in the warm accent
      if (h.kind === 'waltz' || h.kind === 'derbybird') {
        h.x += h.vx * TICK
        // cull only past the FAR side — the parade spawns staggered behind
        // the near line, and the first draft culled everyone but the leader
        if (h.vx > 0 ? h.x > bb.r + 3 : h.x < bb.l - 3) h.dead = true
      } else if (h.kind === 'chand') {
        h.vy = Math.max(-22, h.vy - 60 * TICK)
        h.y += h.vy * TICK
        if (h.y <= 0.4) { h.strike = true }
      } else if (h.kind === 'root') {
        if (h.popT == null) { h.popT = h.t; ev.push({ t: 'rootPop', x: +h.x.toFixed(2) }) }
        if (h.t - h.popT > 90) h.dead = true // pops, lingers a beat, fades
      }
      // contact — one hit per fighter per hazard
      const spec = h.kind === 'waltz' ? { dmg: 6, baseKB: 5.5, growth: 0.14, angleDeg: 50, hitstop: 4, r: 0.9 }
        : h.kind === 'derbybird' ? { dmg: 5, baseKB: 6, growth: 0.14, angleDeg: 44, hitstop: 4, r: 0.7 }
          : h.kind === 'chand' ? { dmg: 14, baseKB: 9, growth: 0.2, angleDeg: 80, hitstop: 7, r: 1.4 }
            : { dmg: 8, baseKB: 7, growth: 0.16, angleDeg: 85, hitstop: 5, r: 0.9 } // root
      const active = h.kind === 'root' ? h.t - (h.popT ?? h.t) <= 26 : true
      if (active) {
        const owner = m.fighters[h.owner]
        for (const d of m.fighters) {
          if (d.id === h.owner || h.hitIds.has(d.id) || d.ko > 0 || d.invuln > 0 || d.stocks <= 0 || d.ghostT > 0 || d.armorT > 0) continue
          const dx = d.x - h.x, dy = d.y + 0.9 - (h.y + (h.kind === 'root' ? 0.6 : 0.9))
          if (dx * dx + dy * dy > (spec.r + d.hurtR) ** 2) continue
          h.hitIds.add(d.id)
          applyHit(owner ?? { id: h.owner, deep: 0, hitstop: 0, face: 1 }, d, m, inputsById, ev, spec, h.kind, Math.sign(h.vx ?? dx) || 1)
        }
      }
      if (h.strike) h.dead = true
    }
    m.hazards = m.hazards.filter((h) => !h.dead)
  }
}
