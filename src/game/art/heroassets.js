// FIN-2 — loading the Blender factory's output (FINAL_PASS Part 5).
//
// The factory writes GLB; this is the only place the game reads it. Two rules
// shape the design:
//
//   1. **The game must still boot if the assets are missing.** They are build
//      products, not source, and a fresh clone that has never run
//      `npm run assets` — or a browser that 404s — has to fall back to the
//      procedural path rather than showing a blank Park. Every failure here is
//      logged and swallowed.
//   2. **Geometry only.** The factory's materials are Blender's defaults and
//      have nothing to do with this game's palette. The mesh is stripped to a
//      BufferGeometry and handed to the same `litMaterial` every other surface
//      uses, so a hero tree is graded, fogged and lit exactly like the world
//      around it.

import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

const TREE_COUNT = 4
import { GLB } from './glbdata.js'

const BASE = 'assets/models/trees'

function load(url) {
  return new Promise((resolve) => {
    new GLTFLoader().load(
      url,
      (gltf) => resolve(gltf),
      undefined,
      (err) => { console.warn(`[hero] ${url} unavailable, falling back`, err?.message ?? err); resolve(null) },
    )
  })
}

/**
 * Flatten a loaded GLB into ONE geometry in the game's coordinate convention,
 * normalised so its height is exactly 1. Normalising here means the call site
 * scales by the height it wants and never has to know what the factory
 * happened to generate that run.
 */
function flatten(gltf) {
  const geos = []
  gltf.scene.updateMatrixWorld(true)
  gltf.scene.traverse((o) => {
    if (!o.isMesh || !o.geometry) return
    const g = o.geometry.clone()
    g.applyMatrix4(o.matrixWorld)
    // strip anything the merge cannot reconcile across meshes
    for (const name of Object.keys(g.attributes)) {
      if (!['position', 'normal', 'uv'].includes(name)) g.deleteAttribute(name)
    }
    if (!g.getAttribute('uv')) {
      const n = g.getAttribute('position').count
      g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(n * 2), 2))
    }
    geos.push(g)
  })
  if (!geos.length) return null
  const merged = geos.length === 1 ? geos[0] : mergeGeometries(geos, false)
  if (!merged) return null

  merged.computeBoundingBox()
  const bb = merged.boundingBox
  const h = Math.max(1e-4, bb.max.y - bb.min.y)
  // sit the base at y=0 and normalise height to 1
  merged.translate(-(bb.max.x + bb.min.x) / 2, -bb.min.y, -(bb.max.z + bb.min.z) / 2)
  merged.scale(1 / h, 1 / h, 1 / h)
  merged.computeVertexNormals()

  // Measure the TRUNK radius, not the bounding box. The bbox width is the
  // crown spread — using it to scale would size every tree by how far its
  // branches happen to reach, and the first attempt did exactly that and
  // produced trunks about 3.6x too thin. Sample only the vertices near the
  // base, which is trunk and nothing else.
  const pos = merged.getAttribute('position')
  let r2 = 0
  for (let i = 0; i < pos.count; i++) {
    if (pos.getY(i) > 0.08) continue
    const d = pos.getX(i) ** 2 + pos.getZ(i) ** 2
    if (d > r2) r2 = d
  }
  merged.userData.baseRadius = Math.max(1e-3, Math.sqrt(r2))
  return merged
}

let _trees = null

/**
 * Returns an array of normalised hero-tree geometries, or an EMPTY array if
 * the factory output is not present. Callers treat empty as "use the
 * procedural path" — never as an error.
 */
export async function loadHeroTrees() {
  if (_trees) return _trees
  // Prefer the inlined data URI. Fetching by path works in dev and in a normal
  // deploy, but a published artifact's CSP blocks it, and the failure is silent:
  // the loader returns null, the filter drops it, and the world quietly uses
  // procedural trunks. Inlining removes the failure mode rather than handling it.
  const urls = Array.from({ length: TREE_COUNT }, (_, i) => {
    const name = `tree_${String(i).padStart(2, '0')}.glb`
    return GLB[name] ?? `${BASE}/${name}`
  })
  const loaded = await Promise.all(urls.map(load))
  _trees = loaded.filter(Boolean).map(flatten).filter(Boolean)
  if (_trees.length) {
    const tris = _trees.reduce((a, g) => a + (g.index ? g.index.count : g.getAttribute('position').count) / 3, 0)
    console.info(`[hero] ${_trees.length} hero trees loaded (${Math.round(tris)} tris total)`)
  } else {
    console.info('[hero] no hero trees found — procedural trunks in use (npm run assets)')
  }
  return _trees
}

export function heroTrees() { return _trees ?? [] }
