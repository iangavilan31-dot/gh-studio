// Procedural character animation (MASTER_PROMPT 4.1). No rig files: poses are
// computed each frame from gait + phase. Phase advances by distance travelled /
// stride length, so footfalls match ground speed exactly (no foot-slide).

const lerp = (a, b, t) => a + (b - a) * t
const damp = (cur, target, lambda, dt) => lerp(cur, target, 1 - Math.exp(-lambda * dt))

export function makeAnimState() {
  return {
    gait: 'idle',          // idle | walk | jog
    action: null,          // sit | lie | sleep | channel | wave | point | giggle
    actionT: 0,            // seconds since action start
    phase: 0,              // stride phase (radians)
    moveBlend: 0,          // 0 idle → 1 moving
    jogBlend: 0,
    breatheT: 0,
    speed: 0,
    airborne: false,
    // C.1 feel: smoothed acceleration (lean/settle), yaw rate (turn lean),
    // and a slow idle-shift clock so standing still never reads frozen
    accel: 0,
    yawRate: 0,
    idleShiftT: 0,
  }
}

// Advance phase by actual distance: stride ~1.1m walk, ~1.5m jog.
export function advanceAnim(st, dt, speed, airborne) {
  const rawAccel = dt > 0 ? (speed - st.speed) / dt : 0
  st.accel = damp(st.accel, Math.max(-8, Math.min(8, rawAccel)), 6, dt)
  st.speed = speed
  st.airborne = airborne
  st.breatheT += dt
  st.idleShiftT += dt
  const moving = speed > 0.05
  st.moveBlend = damp(st.moveBlend, moving ? 1 : 0, 10, dt)
  st.jogBlend = damp(st.jogBlend, speed > 2.2 ? 1 : 0, 8, dt)
  const stride = lerp(1.1, 1.5, st.jogBlend)
  if (moving) st.phase += (speed / stride) * Math.PI * dt * 2
  if (st.action) st.actionT += dt
}

export function applyPose(rig, st, time) {
  const b = rig.bones
  const breathe = Math.sin(st.breatheT * Math.PI) // 2s cycle
  const ph = st.phase
  const m = st.moveBlend, j = st.jogBlend

  // — root bob: idle breathe + gait bounce —
  const gaitBob = Math.abs(Math.sin(ph)) * lerp(0.02, 0.05, j) * m
  const hopY = st.airborne ? 0.04 : 0
  b.hips.position.y = 0.46 + breathe * 0.008 * (1 - m) + gaitBob + hopY

  // C.1: visible acceleration through body lean; letting go of speed makes
  // the robe and hat settle a beat later (the body stops, the cloth doesn't)
  const lean = st.accel * 0.045
  const turnLean = (st.yawRate ?? 0) * 0.055 * m

  // — spine lean: forward with speed + acceleration, sway with stride —
  b.spine.rotation.x = lerp(0, 0.14 + j * 0.1, m) + lean
  b.spine.rotation.z = Math.sin(ph) * 0.045 * m + turnLean
  b.spine.rotation.y = Math.sin(ph) * 0.03 * m

  // — idle weight shift (every ~8–16s): hips ease side to side, head glances —
  const shiftCycle = Math.sin(st.idleShiftT * 0.52) * Math.sin(st.idleShiftT * 0.173)
  const idleShift = shiftCycle * shiftCycle * Math.sign(shiftCycle) * (1 - m)
  b.hips.position.x = idleShift * 0.018
  b.spine.rotation.z += idleShift * 0.03 * (1 - m)

  // — head: gentle counter-tilt, looks ahead; idle glances wander —
  b.head.rotation.x = -b.spine.rotation.x * 0.5 + breathe * 0.015 * (1 - m)
  b.head.rotation.z = -b.spine.rotation.z * 0.6
  b.head.rotation.y = idleShift * 0.14 + Math.sin(st.idleShiftT * 0.31) * 0.05 * (1 - m)

  // — hat: counter-bobs the breathe; brim-flap while jogging; tip lags the lean —
  b.hat.position.y = 0.24 - breathe * 0.006 * (1 - m) - gaitBob * 0.35
  b.hat.rotation.x = Math.sin(ph * 2) * 0.05 * j - lean * 0.8
  b.hat.rotation.z = Math.sin(st.breatheT * 0.6) * 0.02 - turnLean * 0.7

  // — beard sway (lags the body, drags on acceleration) —
  b.beard.rotation.x = 0.06 + Math.sin(ph - 0.9) * 0.07 * m + breathe * 0.01 - lean * 1.1
  b.beard.rotation.z = Math.sin(ph * 0.5 + 0.4) * 0.03 * m

  // — legs: stride swing —
  const legAmp = lerp(0.5, 0.85, j) * m
  b.legL.rotation.x = Math.sin(ph) * legAmp
  b.legR.rotation.x = Math.sin(ph + Math.PI) * legAmp

  // — arms: counter-swing; right arm carries the staff (less swing) —
  b.armL.rotation.x = Math.sin(ph + Math.PI) * 0.5 * m
  b.armL.rotation.z = 0.12 + Math.sin(st.breatheT * 0.7) * 0.02
  b.armR.rotation.x = -0.35 + Math.sin(ph) * 0.16 * m // staff held forward
  b.armR.rotation.z = -0.14

  // — lantern pendulum —
  if (b.staffLantern) {
    b.staffLantern.rotation.z = Math.sin(ph + 0.6) * lerp(0.06, 0.22, m)
    b.staffLantern.rotation.x = Math.sin(ph * 0.7 + 1.2) * 0.08 * m
  }

  // — action overlays —
  const a = st.action
  if (a === 'wave') {
    // arm up and OUT to the side so it reads from every camera angle
    const t = st.actionT
    b.armL.rotation.x = -0.25 + Math.sin(t * 9) * 0.3
    b.armL.rotation.z = 2.15
  } else if (a === 'point') {
    b.armL.rotation.x = -1.5
    b.armL.rotation.z = 0.55
  } else if (a === 'channel') {
    b.armL.rotation.x = -1.9
    b.armR.rotation.x = -1.9
    b.spine.rotation.x = -0.08
  } else if (a === 'giggle') {
    const t = st.actionT
    b.spine.rotation.x = Math.sin(t * 14) * 0.06
    b.hips.position.y = 0.46 + Math.abs(Math.sin(t * 14)) * 0.03
    b.head.rotation.x = -0.15
  } else if (a === 'sit') {
    b.hips.position.y = 0.28
    b.legL.rotation.x = -1.35
    b.legR.rotation.x = -1.35
    b.spine.rotation.x = 0.06
    b.armR.rotation.x = -0.5
  } else if (a === 'lie' || a === 'sleep') {
    b.hips.position.y = 0.16
    b.hips.rotation.x = -Math.PI / 2 + 0.12
    b.legL.rotation.x = 0.15
    b.legR.rotation.x = 0.22
    b.armL.rotation.z = 0.5
    b.armR.rotation.z = -0.4
    b.head.rotation.x = 0.2 + breathe * 0.02
  }
  if (a !== 'lie' && a !== 'sleep') b.hips.rotation.x = 0
}
