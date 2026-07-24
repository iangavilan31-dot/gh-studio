// Ambient particles (Rule 4: the air is never empty). One ParticleSystem per
// kind, spawn rates driven by the active zone. Rain+splashes (Park), canopy
// leaves, chimney smoke, moths at kindled lamps, snore-z for sleepers.

import * as THREE from 'three'
import { ParticleSystem } from './particles.js'
import * as TEX from '../art/textures.js'
import { worldRNG } from '../core/rng.js'

export class Ambience {
  constructor(scene, world) {
    this.world = world
    this.rng = worldRNG.fork('ambience')
    this.rain = new ParticleSystem(scene, { tex: TEX.streak(), max: 240, additive: false, stretchY: 2.6, fogInfluence: 0.4 })
    this.rings = new ParticleSystem(scene, { tex: TEX.ring(), max: 60, additive: false, fogInfluence: 0.4 })
    this.leaves = new ParticleSystem(scene, { tex: TEX.leaf(), max: 40, additive: false })
    this.smoke = new ParticleSystem(scene, { tex: TEX.puff(), max: 60, additive: false, fogInfluence: 0.8 })
    this.moths = new ParticleSystem(scene, { tex: TEX.glowDot({ color: '#d8cfae' }), max: 48, additive: true })
    this.zzz = new ParticleSystem(scene, { tex: TEX.zGlyph(), max: 14, additive: false })
    this.petals = new ParticleSystem(scene, { tex: TEX.leaf({ name: 'petal', color: '#b56ec0' }), max: 36, additive: false })
    this.arcane = new ParticleSystem(scene, { tex: TEX.glowDot({ color: '#7fd4d4' }), max: 50, additive: true })
    this.spores = new ParticleSystem(scene, { tex: TEX.glowDot({ color: '#7fa878' }), max: 44, additive: true })
    this.drips = new ParticleSystem(scene, { tex: TEX.streak({ name: 'drip', color: '#8fb8a8' }), max: 30, additive: false, stretchY: 2 })
    this.sparkle = new ParticleSystem(scene, { tex: TEX.star(), max: 60, additive: true })
    this.mist = new ParticleSystem(scene, { tex: TEX.puff({ name: 'hallmist', color: '#5a5a68' }), max: 30, additive: false, fogInfluence: 0 })
    this.rainW = 0
    this.rainAcc = 0
    this.leafAcc = 0
    this.smokeAcc = 0
    this.pAcc = 0
  }

  // cinematic teleports snap weather to the viewed zone (no cross-zone leakage)
  snapZone(zoneId) {
    this.rainW = zoneId === 'park' ? 1 : 0
    if (this.rainW === 0) { this.rain.data.length = 0; this.rings.data.length = 0 }
    if (zoneId !== 'park') this.leaves.data.length = 0
  }

  spawnZ(x, y, z) {
    this.zzz.spawn({
      pos: new THREE.Vector3(x + this.rng.range(-0.1, 0.1), y, z + this.rng.range(-0.1, 0.1)),
      vel: new THREE.Vector3(0.12, 0.4, 0.05),
      maxLife: 2.4,
      size: 0.16,
      seed: this.rng.next(),
      update(p, dt) {
        p.pos.x += Math.sin(p.life * 3 + p.seed * 9) * 0.15 * dt + p.vel.x * dt
        p.pos.y += p.vel.y * dt
        p.size = 0.16 + p.life * 0.06
      },
    })
  }

  update(dt, camera, zoneId, time) {
    const rng = this.rng
    const world = this.world

    // — rain: Park only (Part 3.2.1), eased in/out —
    const rainTarget = zoneId === 'park' ? 1 : 0
    this.rainW += (rainTarget - this.rainW) * (1 - Math.exp(-dt / 1.5))
    if (this.rainW > 0.05) {
      this.rainAcc += dt * 90 * this.rainW
      while (this.rainAcc >= 1) {
        this.rainAcc -= 1
        const x = camera.position.x + rng.range(-16, 16)
        const z = camera.position.z + rng.range(-16, 16)
        const groundY = world.heightAt(x, z)
        this.rain.spawn({
          pos: new THREE.Vector3(x, camera.position.y + rng.range(5, 10), z),
          vel: new THREE.Vector3(0.5, -8.5, 0.2),
          maxLife: 3,
          size: rng.range(0.10, 0.16),
          alpha: 0.5,
          seed: rng.next(),
          groundY,
          rings: this.rings,
          update(p, dt2) {
            p.pos.addScaledVector(p.vel, dt2)
            if (p.pos.y <= p.groundY + 0.05) {
              p.life = p.maxLife // die
              p.rings.spawn({
                pos: new THREE.Vector3(p.pos.x, p.groundY + 0.06, p.pos.z),
                vel: new THREE.Vector3(),
                maxLife: 0.5,
                size: 0.1,
                seed: 0,
                update(q, dt3) { q.size += dt3 * 0.9 },
              })
            }
          },
        })
      }
    }

    // — drifting canopy leaves (Park) —
    if (zoneId === 'park') {
      this.leafAcc += dt * 2.2
      while (this.leafAcc >= 1) {
        this.leafAcc -= 1
        const a = rng.range(0, Math.PI * 2)
        const r = rng.range(20, 27)
        const x = Math.cos(a) * r, z = Math.sin(a) * r
        this.leaves.spawn({
          pos: new THREE.Vector3(x, world.heightAt(x, z) + rng.range(4.5, 7), z),
          vel: new THREE.Vector3(rng.range(-0.2, 0.2), -0.55, rng.range(-0.2, 0.2)),
          maxLife: rng.range(6, 10),
          size: rng.range(0.12, 0.2),
          seed: rng.next(),
          update(p, dt2) {
            p.pos.x += (p.vel.x + Math.sin(p.life * 2.2 + p.seed * 10) * 0.5) * dt2
            p.pos.z += (p.vel.z + Math.cos(p.life * 1.7 + p.seed * 7) * 0.4) * dt2
            p.pos.y += p.vel.y * dt2
          },
        })
      }
    }

    // — chimney smoke (visible whenever near the village) —
    if (world.smokeAnchors?.length && camera.position.distanceTo(world.smokeAnchors[0]) < 110) {
      this.smokeAcc += dt * 3
      while (this.smokeAcc >= 1) {
        this.smokeAcc -= 1
        const anchor = world.smokeAnchors[Math.floor(rng.next() * world.smokeAnchors.length)]
        this.smoke.spawn({
          pos: anchor.clone().add(new THREE.Vector3(rng.range(-0.15, 0.15), 0, rng.range(-0.15, 0.15))),
          vel: new THREE.Vector3(rng.range(0.05, 0.25), rng.range(0.5, 0.8), rng.range(-0.1, 0.05)),
          maxLife: rng.range(4, 6),
          size: rng.range(0.5, 0.8),
          seed: rng.next(),
          update(p, dt2) {
            p.pos.addScaledVector(p.vel, dt2)
            p.size += dt2 * 0.5
            p.alpha = Math.max(0, 0.5 * (1 - p.life / p.maxLife))
          },
        })
      }
    }

    // — moths orbiting kindled lamps (Village + Rooftops flavor) —
    const mothZones = ['village', 'rooftops']
    if (mothZones.includes(zoneId) && this.moths.data.length < 30) {
      for (const l of world.lights) {
        if (!l.kindled || !mothZones.includes(l.zone)) continue
        if (Math.hypot(l.x - camera.position.x, l.z - camera.position.z) > 45) continue
        const near = this.moths.data.filter((m) => m.lightId === l.id).length
        for (let i = near; i < 3; i++) {
          this.moths.spawn({
            lightId: l.id,
            pos: new THREE.Vector3(l.x, l.y, l.z),
            vel: new THREE.Vector3(),
            maxLife: 9e9,
            size: rng.range(0.05, 0.08),
            alpha: 0.75,
            seed: rng.next(),
            cx: l.x, cy: l.y, cz: l.z,
            update(p, dt2) {
              const t2 = p.life * (1.6 + p.seed) + p.seed * 20
              p.pos.set(
                p.cx + Math.cos(t2) * (0.3 + p.seed * 0.25),
                p.cy + Math.sin(t2 * 2.3) * 0.18,
                p.cz + Math.sin(t2) * (0.3 + p.seed * 0.25)
              )
            },
          })
        }
      }
    }

    // — zone flavor particles (Rule 4 across every zone) —
    this.pAcc += dt
    const every = (interval) => { if (this.pAcc >= interval) { return true } return false }
    if (this.pAcc >= 0.25) {
      this.pAcc = 0
      // Ruins: violet petal drift + arcane motes when the moonwell burns
      if (zoneId === 'ruins') {
        if (this.petals.data.length < 30) {
          this.petals.spawn({
            pos: new THREE.Vector3(rng.range(-126, -94), rng.range(2, 5) + 1, rng.range(-10, 20)),
            vel: new THREE.Vector3(rng.range(-0.3, 0.3), -0.28, rng.range(-0.2, 0.2)),
            maxLife: rng.range(7, 11), size: rng.range(0.1, 0.16), seed: rng.next(),
            update(p, dt2) {
              p.pos.x += (p.vel.x + Math.sin(p.life * 2 + p.seed * 9) * 0.4) * dt2
              p.pos.z += p.vel.z * dt2
              p.pos.y += p.vel.y * dt2
            },
          })
        }
        const well = world.lights.find((l) => l.id === 'ruins-moonwell')
        if (well?.kindled && this.arcane.data.length < 40) {
          this.arcane.spawn({
            pos: new THREE.Vector3(well.x + rng.range(-1.6, 1.6), world.heightAt(well.x, well.z) + 0.9, well.z + rng.range(-1.6, 1.6)),
            vel: new THREE.Vector3(0, rng.range(0.35, 0.7), 0),
            maxLife: rng.range(2.5, 4), size: rng.range(0.05, 0.1), seed: rng.next(),
          })
        }
      }
      // Mosswood: spore motes + canopy drips
      if (zoneId === 'mosswood') {
        if (this.spores.data.length < 36) {
          this.spores.spawn({
            pos: new THREE.Vector3(camera.position.x + rng.range(-14, 14), world.heightAt(camera.position.x, camera.position.z) + rng.range(0.4, 3.4), camera.position.z + rng.range(-14, 14)),
            vel: new THREE.Vector3(rng.range(-0.1, 0.1), rng.range(-0.05, 0.08), rng.range(-0.1, 0.1)),
            maxLife: rng.range(5, 9), size: rng.range(0.04, 0.08), alpha: 0.5, seed: rng.next(),
            update(p, dt2) {
              p.pos.x += (p.vel.x + Math.sin(p.life * 1.4 + p.seed * 8) * 0.1) * dt2
              p.pos.y += p.vel.y * dt2
              p.pos.z += p.vel.z * dt2
            },
          })
        }
        if (rng.chance(0.5)) {
          const dx2 = camera.position.x + rng.range(-10, 10), dz2 = camera.position.z + rng.range(-10, 10)
          this.drips.spawn({
            pos: new THREE.Vector3(dx2, world.heightAt(dx2, dz2) + rng.range(5, 9), dz2),
            vel: new THREE.Vector3(0, -6.5, 0),
            maxLife: 1.4, size: 0.07, alpha: 0.5, seed: rng.next(),
            groundY: world.heightAt(dx2, dz2),
            update(p, dt2) { p.pos.y += p.vel.y * dt2; if (p.pos.y < p.groundY) p.life = p.maxLife },
          })
        }
      }
      // Isle: sea sparkle glints on the water
      if (zoneId === 'isle' || zoneId === 'foglandPI') {
        if (this.sparkle.data.length < 50) {
          const sx2 = camera.position.x + rng.range(-30, 30), sz2 = camera.position.z + rng.range(-35, 10)
          if (world.heightAt(sx2, sz2) < -1.5) {
            this.sparkle.spawn({
              pos: new THREE.Vector3(sx2, -1.05, sz2),
              vel: new THREE.Vector3(),
              maxLife: rng.range(0.8, 1.6), size: rng.range(0.08, 0.16), seed: rng.next(),
              update(p) { p.alpha = Math.sin((p.life / p.maxLife) * Math.PI) * 0.8 },
            })
          }
        }
      }
      // Hall: floor mist sheets + dust motes in the high moonbeams
      if (zoneId === 'hall') {
        if (this.mist.data.length < 24) {
          this.mist.spawn({
            pos: new THREE.Vector3(-110 + rng.range(-5.5, 5.5), 1.65, rng.range(140, 170)),
            vel: new THREE.Vector3(rng.range(-0.1, 0.1), 0, rng.range(-0.08, 0.08)),
            maxLife: rng.range(6, 10), size: rng.range(1.4, 2.4), alpha: 0.16, seed: rng.next(),
            update(p, dt2) {
              p.pos.addScaledVector(p.vel, dt2)
              p.alpha = 0.16 * Math.sin((p.life / p.maxLife) * Math.PI)
            },
          })
        }
      }
    }

    this.rain.update(dt, camera)
    this.rings.update(dt, camera)
    this.leaves.update(dt, camera)
    this.smoke.update(dt, camera)
    this.moths.update(dt, camera)
    this.zzz.update(dt, camera)
    this.petals.update(dt, camera)
    this.arcane.update(dt, camera)
    this.spores.update(dt, camera)
    this.drips.update(dt, camera)
    this.sparkle.update(dt, camera)
    this.mist.update(dt, camera)
  }
}
