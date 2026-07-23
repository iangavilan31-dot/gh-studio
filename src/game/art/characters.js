// Character factory (MASTER_PROMPT 4.1 / 7.2): the Lamplighter and variants.
// Procedural build from primitives + lathe; ONE 128×128 painted atlas + vertex
// colors; bone hierarchy in code (root/hips/spine/head/hat/arms/legs/beard).
// Silhouette first: big hat, big beard, big hands, stubby legs (Rule 7).

import * as THREE from 'three'
import { retroMaterial, ensureVertexColors } from './materials.js'
import { canvasOf, toTexture, hex, rgb, lighten, darken, mix, splotch, flameSheet, glowDot } from './textures.js'
import { worldRNG } from '../core/rng.js'

function flameSheetClone() {
  const t = flameSheet().clone()
  t.repeat.set(0.25, 1)
  return t
}
function glowDotWarm() { return glowDot({ color: '#e8a84a' }) }

// ——— The one painted atlas (regions in px): ———
// robe/hat 0,0,64,64 (near-grey, tinted by vertex color) · skin 64,0,32,32
// beard 96,0,32,32 · leather 64,32,32,32 · metal 96,32,32,32 · wood 64,64,32,32
// glass 96,64,32,32 · robe trim 0,64,64,16
let atlasTex = null
export function characterAtlas() {
  if (atlasTex) return atlasTex
  const rng = worldRNG.fork('tex/charAtlas')
  const c = canvasOf(128, (ctx) => {
    // robe: bright near-white with painted vertical folds (vertex tint colors it —
    // the tint #4B3B6E is dark, so the texture must carry the value range)
    const robe = hex('#e2dcee')
    ctx.fillStyle = rgb(robe); ctx.fillRect(0, 0, 64, 64)
    for (let i = 0; i < 10; i++) {
      const x = 3 + i * 6 + rng.range(-2, 2)
      ctx.strokeStyle = rgb(darken(robe, rng.range(0.1, 0.2)))
      ctx.lineWidth = rng.range(1.5, 3)
      ctx.beginPath(); ctx.moveTo(x, 6); ctx.bezierCurveTo(x + rng.range(-3, 3), 24, x + rng.range(-3, 3), 44, x + rng.range(-4, 4), 64); ctx.stroke()
    }
    splotch(ctx, 64, rng, { color: lighten(robe, 0.12), count: 14, rmin: 3, rmax: 9, alpha: 0.35 })
    ctx.fillStyle = rgb(darken(robe, 0.22)); ctx.fillRect(0, 60, 64, 4) // hem wear
    // skin: warm, cheek blush dabs
    const skin = hex('#d9b48f')
    ctx.fillStyle = rgb(skin); ctx.fillRect(64, 0, 32, 32)
    ctx.save(); ctx.translate(64, 0)
    splotch(ctx, 32, rng, { color: lighten(skin, 0.08), count: 6, rmin: 2, rmax: 6, alpha: 0.4 })
    ctx.fillStyle = 'rgba(200,120,90,0.35)'
    ctx.beginPath(); ctx.ellipse(8, 20, 4, 2.6, 0, 0, Math.PI * 2); ctx.fill()
    ctx.beginPath(); ctx.ellipse(24, 20, 4, 2.6, 0, 0, Math.PI * 2); ctx.fill()
    ctx.restore()
    // beard: silver strands
    const beard = hex('#cfd2d6')
    ctx.fillStyle = rgb(beard); ctx.fillRect(96, 0, 32, 32)
    for (let i = 0; i < 26; i++) {
      const x = 96 + rng.range(0, 32)
      ctx.strokeStyle = rgb(rng.chance(0.5) ? darken(beard, rng.range(0.08, 0.2)) : lighten(beard, 0.1))
      ctx.lineWidth = 1
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.bezierCurveTo(x + rng.range(-2, 2), 10, x + rng.range(-3, 3), 22, x + rng.range(-4, 4), 32); ctx.stroke()
    }
    // leather (boots/belt)
    const leather = hex('#4a3527')
    ctx.fillStyle = rgb(leather); ctx.fillRect(64, 32, 32, 32)
    ctx.save(); ctx.translate(64, 32)
    for (let i = 0; i < 12; i++) { ctx.fillStyle = rgb(rng.chance(0.5) ? lighten(leather, 0.08) : darken(leather, 0.12)); ctx.globalAlpha = 0.5; ctx.fillRect(rng.range(0, 30), rng.range(0, 30), rng.range(2, 6), rng.range(1, 3)) }
    ctx.globalAlpha = 1; ctx.restore()
    // metal (staff fittings, buckle)
    const metal = hex('#23262b')
    ctx.fillStyle = rgb(metal); ctx.fillRect(96, 32, 32, 32)
    ctx.fillStyle = rgb(lighten(metal, 0.22)); ctx.fillRect(98, 34, 28, 2)
    // wood (staff)
    const wood = hex('#5a4030')
    ctx.fillStyle = rgb(wood); ctx.fillRect(64, 64, 32, 32)
    ctx.save(); ctx.translate(64, 64)
    for (let i = 0; i < 8; i++) { ctx.strokeStyle = rgb(darken(wood, rng.range(0.1, 0.25))); ctx.lineWidth = 1; ctx.beginPath(); const x = rng.range(0, 32); ctx.moveTo(x, 0); ctx.lineTo(x + rng.range(-3, 3), 32); ctx.stroke() }
    ctx.restore()
    // warm glass
    const g = ctx.createRadialGradient(112, 96, 2, 112, 96, 16)
    g.addColorStop(0, '#ffe9b0'); g.addColorStop(1, '#c07828')
    ctx.fillStyle = g; ctx.fillRect(96, 80, 32, 32)
    // robe trim band (gold-ish, stays untinted-bright)
    ctx.fillStyle = '#8d7a4e'; ctx.fillRect(0, 64, 64, 16)
    ctx.fillStyle = '#a8925e'
    for (let i = 0; i < 10; i++) ctx.fillRect(2 + i * 6, 68, 3, 3)
  })
  atlasTex = toTexture(c)
  atlasTex.wrapS = atlasTex.wrapT = THREE.ClampToEdgeWrapping
  return atlasTex
}

// Remap a geometry's UVs into an atlas region (px coords on 128 atlas).
function uvRegion(geo, x, y, w, h) {
  const uv = geo.getAttribute('uv')
  for (let i = 0; i < uv.count; i++) {
    uv.setXY(i, (x + uv.getX(i) * w) / 128, 1 - (y + (1 - uv.getY(i)) * h) / 128)
  }
  return geo
}

function tintGeo(geo, color) {
  const c = new THREE.Color(color)
  ensureVertexColors(geo)
  const attr = geo.getAttribute('color')
  for (let i = 0; i < attr.count; i++) attr.setXYZ(i, c.r, c.g, c.b)
  return geo
}

export const PLAYER_TINTS = ['#4B3B6E', '#6B1F2A', '#1F2A44', '#2E4A34'] // wizardcore canon

// Build the Lamplighter (or a variant). Returns rig with named bones.
export function buildWizard({
  tint = PLAYER_TINTS[0],
  beardLength = 0.42,   // Beldam passes ~0.62 (beard to his knees)
  scale = 1,
  withStaff = true,
} = {}) {
  const atlas = characterAtlas()
  const mat = retroMaterial({ map: atlas, hemi: true })
  const matGlass = retroMaterial({ map: atlas, emissive: 0x905020, transparent: true, opacity: 0.8, depthWrite: false, hemi: true })

  const M = (geo) => new THREE.Mesh(geo, mat)
  let tris = 0
  const count = (geo) => { tris += (geo.index ? geo.index.count : geo.getAttribute('position').count) / 3; return geo }
  const R = (geo, ...region) => uvRegion(geo, ...region)

  const root = new THREE.Group() // at feet
  const hips = new THREE.Group(); hips.position.y = 0.46 * scale; root.add(hips)
  const spine = new THREE.Group(); hips.add(spine)

  // Robe: lathe from hem (wide) to collar (narrow). Hem at y -0.44 rel hips (near ground).
  const robePts = []
  const robeProfile = [
    [0.30, -0.375], [0.315, -0.34], [0.27, -0.26], [0.24, -0.12], [0.215, 0.04], [0.20, 0.18], [0.165, 0.32], [0.10, 0.42],
  ]
  for (const [r, y] of robeProfile) robePts.push(new THREE.Vector2(r * scale, y * scale))
  const robeGeo = count(R(new THREE.LatheGeometry(robePts, 9), 0, 0, 64, 64))
  tintGeo(robeGeo, tint)
  spine.add(M(robeGeo))
  // trim band at hem
  const trimGeo = count(R(new THREE.CylinderGeometry(0.305 * scale, 0.315 * scale, 0.045 * scale, 9, 1, true), 0, 64, 64, 16))
  tintGeo(trimGeo, '#ffffff')
  const trim = M(trimGeo); trim.position.y = -0.355 * scale; spine.add(trim)

  // Belt buckle
  const beltGeo = count(R(new THREE.BoxGeometry(0.1 * scale, 0.08 * scale, 0.02 * scale), 96, 32, 32, 32))
  tintGeo(beltGeo, '#ffffff')
  const belt = M(beltGeo); belt.position.set(0, -0.06 * scale, 0.21 * scale); spine.add(belt)

  // Head
  const headBone = new THREE.Group(); headBone.position.y = 0.5 * scale; spine.add(headBone)
  const headGeo = count(R(new THREE.SphereGeometry(0.185 * scale, 10, 8), 64, 0, 32, 32))
  tintGeo(headGeo, '#ffffff')
  const head = M(headGeo); head.position.y = 0.1 * scale; headBone.add(head)
  const noseGeo = count(R(new THREE.SphereGeometry(0.045 * scale, 6, 5), 64, 0, 32, 32))
  tintGeo(noseGeo, '#e8b890')
  const nose = M(noseGeo); nose.position.set(0, 0.07 * scale, 0.18 * scale); headBone.add(nose)

  // Beard: flattened cone hanging from the chin (apex DOWN), covers torso (Rule 7).
  const beardBone = new THREE.Group(); beardBone.position.set(0, 0.04 * scale, 0.12 * scale); headBone.add(beardBone)
  const beardGeo = R(new THREE.ConeGeometry(0.17 * scale, beardLength * scale, 7), 96, 0, 32, 32)
  beardGeo.rotateX(Math.PI) // apex points down
  beardGeo.scale(1, 1, 0.6)
  beardGeo.translate(0, -beardLength * 0.5 * scale, 0.05 * scale)
  count(beardGeo)
  tintGeo(beardGeo, '#ffffff')
  beardBone.add(M(beardGeo))
  // moustache blobs
  const mustGeo = count(R(new THREE.SphereGeometry(0.055 * scale, 6, 5), 96, 0, 32, 32))
  tintGeo(mustGeo, '#ffffff')
  const mustL = M(mustGeo); mustL.position.set(-0.05 * scale, 0.03 * scale, 0.14 * scale); mustL.scale.set(1, 0.6, 0.7); headBone.add(mustL)
  const mustR = mustL.clone(); mustR.position.x *= -1; headBone.add(mustR)

  // Hat: wide brim + tall crown with a soft bend at the tip.
  const hatBone = new THREE.Group(); hatBone.position.y = 0.24 * scale; headBone.add(hatBone)
  const brimGeo = count(R(new THREE.CylinderGeometry(0.34 * scale, 0.36 * scale, 0.035 * scale, 10), 0, 0, 64, 64))
  tintGeo(brimGeo, tint)
  const brim = M(brimGeo); hatBone.add(brim)
  // crown: cone with bent tip — displace upper vertices sideways
  const crownGeo = R(new THREE.ConeGeometry(0.21 * scale, 0.52 * scale, 9, 4), 0, 0, 64, 64)
  {
    const p = crownGeo.getAttribute('position')
    for (let i = 0; i < p.count; i++) {
      const y = p.getY(i)
      const t = Math.max(0, (y / scale + 0.26) / 0.52) // 0 base → 1 tip
      p.setX(i, p.getX(i) + Math.pow(t, 2.2) * 0.16 * scale)
      p.setZ(i, p.getZ(i) - Math.pow(t, 2.6) * 0.05 * scale)
    }
    crownGeo.computeVertexNormals()
  }
  count(crownGeo)
  tintGeo(crownGeo, tint)
  const crown = M(crownGeo); crown.position.y = 0.27 * scale; hatBone.add(crown)

  // Arms: sleeve cylinders pivoted at shoulders, big round hands.
  function buildArm(side) { // side: -1 left, +1 right
    const shoulder = new THREE.Group()
    shoulder.position.set(side * 0.20 * scale, 0.36 * scale, 0)
    const sleeveGeo = count(R(new THREE.CylinderGeometry(0.062 * scale, 0.08 * scale, 0.34 * scale, 7), 0, 0, 64, 64))
    tintGeo(sleeveGeo, tint)
    const sleeve = M(sleeveGeo)
    sleeve.position.y = -0.15 * scale
    shoulder.add(sleeve)
    const handGeo = count(R(new THREE.SphereGeometry(0.085 * scale, 7, 6), 64, 0, 32, 32))
    tintGeo(handGeo, '#ffffff')
    const hand = M(handGeo)
    hand.position.y = -0.36 * scale
    shoulder.add(hand)
    spine.add(shoulder)
    return { shoulder, hand }
  }
  const armL = buildArm(-1)
  const armR = buildArm(1)

  // Legs: stubby, with big boots; pivot at hips (hidden under robe hem mostly).
  function buildLeg(side) {
    const hip = new THREE.Group()
    hip.position.set(side * 0.11 * scale, -0.32 * scale, 0)
    const legGeo = count(R(new THREE.CylinderGeometry(0.055 * scale, 0.06 * scale, 0.2 * scale, 6), 64, 32, 32, 32))
    tintGeo(legGeo, '#ffffff')
    const leg = M(legGeo); leg.position.y = -0.08 * scale; hip.add(leg)
    const bootGeo = count(R(new THREE.BoxGeometry(0.13 * scale, 0.11 * scale, 0.22 * scale), 64, 32, 32, 32))
    tintGeo(bootGeo, '#ffffff')
    const boot = M(bootGeo); boot.position.set(0, -0.10 * scale, 0.045 * scale); hip.add(boot)
    hips.add(hip)
    return { hip }
  }
  const legL = buildLeg(-1)
  const legR = buildLeg(1)

  // Lantern-staff in the right hand. Grip = staff origin (held by the hand);
  // pole rises ~0.85 above grip and drops ~0.35 below; lantern swings from the top hook.
  let staff = null, staffLantern = null, staffFlame = null, staffHalo = null
  if (withStaff) {
    staff = new THREE.Group()
    const poleGeo = R(new THREE.CylinderGeometry(0.024 * scale, 0.032 * scale, 1.2 * scale, 6), 64, 64, 32, 32)
    poleGeo.translate(0, 0.25 * scale, 0) // grip below center
    count(poleGeo)
    tintGeo(poleGeo, '#ffffff')
    staff.add(M(poleGeo))
    // curled top hook
    const hookGeo = count(R(new THREE.TorusGeometry(0.07 * scale, 0.018 * scale, 5, 8, Math.PI * 1.25), 96, 32, 32, 32))
    tintGeo(hookGeo, '#ffffff')
    const hook = M(hookGeo); hook.position.set(0.05 * scale, 0.85 * scale, 0); hook.rotation.z = -1.1; staff.add(hook)
    // hanging mini-lantern (pivots at the hook — swings with gait)
    staffLantern = new THREE.Group(); staffLantern.position.set(0.14 * scale, 0.83 * scale, 0)
    const capGeo = count(R(new THREE.ConeGeometry(0.075 * scale, 0.07 * scale, 6), 96, 32, 32, 32))
    tintGeo(capGeo, '#ffffff')
    const cap = M(capGeo); cap.position.y = -0.03 * scale; staffLantern.add(cap)
    const cageGeo = count(R(new THREE.BoxGeometry(0.095 * scale, 0.13 * scale, 0.095 * scale), 96, 80, 32, 32))
    tintGeo(cageGeo, '#ffffff')
    const cage = new THREE.Mesh(cageGeo, matGlass)
    cage.position.y = -0.13 * scale
    staffLantern.add(cage)
    // the player's own light: small flame sprite + halo (registered by main for animation)
    const flameTex = flameSheetClone()
    staffFlame = new THREE.Mesh(new THREE.PlaneGeometry(0.14 * scale, 0.14 * scale), retroMaterial({ map: flameTex, emissive: 0xffffff, alphaTest: 0.4 }))
    ensureVertexColors(staffFlame.geometry)
    staffFlame.position.y = -0.13 * scale
    staffLantern.add(staffFlame)
    const haloMat = retroMaterial({ map: glowDotWarm(), transparent: true, depthWrite: false, opacity: 0.4 })
    haloMat.blending = THREE.AdditiveBlending
    staffHalo = new THREE.Mesh(new THREE.PlaneGeometry(0.85 * scale, 0.85 * scale), haloMat)
    ensureVertexColors(staffHalo.geometry)
    staffHalo.position.y = -0.12 * scale
    staffLantern.add(staffHalo)
    staff.add(staffLantern)
    staff.position.set(0, -0.02 * scale, 0.05 * scale)
    staff.rotation.x = 0.1
    armR.hand.add(staff)
  }

  root.traverse((o) => { if (o.isMesh) { o.frustumCulled = true } })

  return {
    group: root,
    bones: { root, hips, spine, head: headBone, hat: hatBone, beard: beardBone, armL: armL.shoulder, armR: armR.shoulder, handL: armL.hand, handR: armR.hand, legL: legL.hip, legR: legR.hip, staff, staffLantern },
    staffFlame,
    staffHalo,
    triCount: Math.round(tris),
    tint,
  }
}
