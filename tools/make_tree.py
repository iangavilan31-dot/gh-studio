#!/usr/bin/env blender --background --python
"""
MOONREST — hero tree generator (FINAL_PASS Part 5).

Blender headless. Builds a family of twisted, tapered trees from one seed so
the Park can be planted with variation rather than with copies, and exports GLB
for three.js.

Why meshes are built with bmesh rather than with operators: operators depend on
context (active object, mode, selection) that is fragile in `--background`, and
they fail in ways that are hard to read from a log. Building the geometry
directly is longer but it does the same thing every run, which is the property
that matters for a script the build calls.

The shape brief is DIRECTION Part 1/9: big simple forms, beveled edges so
silhouettes catch the moon, hand-painted-style albedo, minimal surface noise.
A tree here is read as a SILHOUETTE against the sky first and a surface second,
so the budget goes into the trunk's lean and taper, not into bark detail.

Usage:
    blender -b --python tools/make_tree.py -- --out public/assets/models/trees --count 4
"""

import argparse
import math
import os
import random
import sys

import bpy
import bmesh
from mathutils import Vector, Matrix


# ---------------------------------------------------------------- scene setup

def reset_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def new_mesh_object(name):
    me = bpy.data.meshes.new(name)
    ob = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(ob)
    return ob, me


# ---------------------------------------------------------------- tree shape

def spine(rng, height, lean, twist, segs):
    """
    The trunk's centre line. A tree that grows straight up reads as a cylinder;
    the lean and the slow twist are what make it read as grown. Curvature
    accumulates rather than oscillating, so the trunk bends in ONE direction
    the way a real tree answers one prevailing wind.
    """
    pts = []
    ang = rng.uniform(0, math.tau)
    drift = Vector((math.cos(ang), math.sin(ang), 0)) * lean
    for i in range(segs + 1):
        t = i / segs
        # ease so the bend lives in the upper trunk, not at the base
        bend = t * t
        p = Vector((0, 0, height * t)) + drift * bend
        # gentle helical wander
        w = twist * math.sin(t * math.pi * 1.3 + ang)
        p.x += w
        p.y += w * 0.6
        pts.append(p)
    return pts


def radius_at(t, base_r, taper):
    """Tapered, with a flare at the root so the tree meets the ground."""
    r = base_r * (1.0 - taper * t)
    flare = 1.0 + 0.55 * math.exp(-t * 9.0)
    return max(0.02, r * flare)


def add_tube(bm, pts, radius_fn, sides, rng, wobble):
    """Loft a ring of `sides` verts along `pts`. Returns the final ring."""
    rings = []
    n = len(pts)
    for i, p in enumerate(pts):
        t = i / (n - 1)
        # frame the ring perpendicular to the local direction
        if i < n - 1:
            d = (pts[i + 1] - p).normalized()
        else:
            d = (p - pts[i - 1]).normalized()
        up = Vector((0, 0, 1))
        if abs(d.dot(up)) > 0.999:
            up = Vector((1, 0, 0))
        x = d.cross(up).normalized()
        y = d.cross(x).normalized()
        r = radius_fn(t)
        ring = []
        for s in range(sides):
            a = math.tau * s / sides
            # per-vertex wobble gives the trunk an irregular cross-section, so
            # it never reads as an extruded circle
            rr = r * (1.0 + rng.uniform(-wobble, wobble))
            v = bm.verts.new(p + x * (math.cos(a) * rr) + y * (math.sin(a) * rr))
            ring.append(v)
        rings.append(ring)

    for i in range(len(rings) - 1):
        a, b = rings[i], rings[i + 1]
        for s in range(sides):
            s2 = (s + 1) % sides
            bm.faces.new((a[s], a[s2], b[s2], b[s]))
    return rings[-1], rings[0]


def cap_ring(bm, ring):
    try:
        bm.faces.new(ring)
    except ValueError:
        pass


def limb(bm, rng, origin, direction, length, r0, rise, segs=5, sides=6):
    """One branch. Returns its tip position and end radius so it can fork."""
    pts = []
    d = direction.normalized()
    for i in range(segs + 1):
        t = i / segs
        p = (origin + d * (length * t)
             + Vector((0, 0, length * rise * t * t)))
        p.x += rng.uniform(-0.04, 0.04) * length
        p.y += rng.uniform(-0.04, 0.04) * length
        pts.append(p)
    r1 = r0 * 0.30
    tip, root = add_tube(
        bm, pts, lambda t: max(0.025, r0 + (r1 - r0) * t), sides, rng, 0.10)
    cap_ring(bm, tip)
    cap_ring(bm, root)
    return pts[-1], r1


def canopy_mass(bm, rng, centre, radius):
    """
    A canopy blob. DIRECTION Part 1 asks for big simple forms read as
    silhouette — so the canopy is a few overlapping squashed masses, not a
    particle cloud. Low subdivision keeps the facets, which is what lets the
    moon pick out a plane and give the mass volume.
    """
    res = bmesh.ops.create_icosphere(bm, subdivisions=1, radius=radius)
    verts = res['verts']
    sq = rng.uniform(0.62, 0.82)          # canopies are wider than they are tall
    for v in verts:
        v.co.z *= sq
        # irregular outline: no two blobs the same, none of them a ball
        v.co += Vector((rng.uniform(-1, 1), rng.uniform(-1, 1), rng.uniform(-1, 1))) * radius * 0.16
        v.co += centre


def build_tree(seed, height=8.0, base_r=0.42, branches=3):
    rng = random.Random(seed)
    ob, me = new_mesh_object(f"hero_tree_{seed}")
    bm = bmesh.new()

    segs = 12
    lean = rng.uniform(1.1, 2.3)          # v1 leaned too little and read as a post
    twist = rng.uniform(0.10, 0.30)
    trunk_pts = spine(rng, height, lean, twist, segs)
    taper = rng.uniform(0.50, 0.66)       # v1 tapered to a cone; real trunks hold width

    top_ring, base_ring = add_tube(
        bm, trunk_pts, lambda t: radius_at(t, base_r, taper), 8, rng, 0.10)
    cap_ring(bm, top_ring)
    # the base is NOT capped: it sits below the terrain, and capping the flared
    # ring is what produced the spike artefact under v1's trees

    # Few, thick, FORKING limbs. v1 grew many thin ones and the result read as
    # a dead thornbush; a park tree's structure is a small number of decisions.
    tips = []
    for b in range(branches):
        t0 = rng.uniform(0.52, 0.86)
        origin = trunk_pts[min(int(t0 * segs), segs)]
        ang = math.tau * (b / branches) + rng.uniform(-0.4, 0.4)
        out = Vector((math.cos(ang), math.sin(ang), rng.uniform(0.15, 0.4)))
        blen = height * rng.uniform(0.26, 0.40)
        r0 = radius_at(t0, base_r, taper) * rng.uniform(0.44, 0.58)
        tip, r1 = limb(bm, rng, origin, out, blen, r0, rng.uniform(0.5, 0.9))
        tips.append((tip, r1))
        # one fork per limb — enough to read as branching, cheap in tris
        for f in range(2):
            fang = ang + (0.55 if f else -0.55) + rng.uniform(-0.2, 0.2)
            fout = Vector((math.cos(fang), math.sin(fang), rng.uniform(0.3, 0.7)))
            flen = blen * rng.uniform(0.45, 0.65)
            ftip, fr = limb(bm, rng, tip, fout, flen, r1 * 0.9,
                            rng.uniform(0.6, 1.0), segs=4, sides=5)
            tips.append((ftip, fr))

    # Canopy: one mass over the crown plus one at each primary fork tip, so the
    # silhouette is a broad crown rather than a ball on a stick.
    crown = trunk_pts[-1] + Vector((0, 0, height * 0.06))
    canopy_mass(bm, rng, crown, height * rng.uniform(0.20, 0.26))
    for tip, _ in tips:
        if rng.random() < 0.75:
            canopy_mass(bm, rng, tip + Vector((0, 0, height * 0.03)),
                        height * rng.uniform(0.11, 0.17))

    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=0.002)
    bm.normal_update()
    bm.to_mesh(me)
    bm.free()
    return ob


# ---------------------------------------------------------------- finishing

def add_bark_relief(ob, strength=0.045):
    """
    Bark as a displacement, not as a texture. DIRECTION Part 9 asks for beveled
    edges and real surface, and a shallow displace is what makes a trunk catch
    a rim of moonlight along its length instead of reading as a smooth post.
    """
    tex = bpy.data.textures.new(f"bark_{ob.name}", type='CLOUDS')
    tex.noise_scale = 0.22
    tex.noise_depth = 2
    m = ob.modifiers.new("bark", 'DISPLACE')
    m.texture = tex
    m.strength = strength
    m.mid_level = 0.5
    m.texture_coords = 'LOCAL'


def finish(ob, target_tris=2400):
    """Bevel for silhouette, shade smooth-ish, decimate into budget."""
    bev = ob.modifiers.new("bevel", 'BEVEL')
    bev.width = 0.012
    bev.segments = 2
    bev.limit_method = 'ANGLE'
    bev.angle_limit = math.radians(35)

    # Part 1's budget is 2k–20k tris per prop; a park tree is background-heavy
    # so it sits at the bottom of that range and pays its detail in silhouette.
    tris = len(ob.data.polygons) * 2
    if tris > target_tris:
        dec = ob.modifiers.new("decimate", 'DECIMATE')
        dec.ratio = max(0.15, target_tris / float(tris))

    bpy.context.view_layer.objects.active = ob
    for m in list(ob.modifiers):
        try:
            bpy.ops.object.modifier_apply(modifier=m.name)
        except RuntimeError as e:
            print(f"[make_tree] modifier {m.name} skipped: {e}", file=sys.stderr)

    for p in ob.data.polygons:
        p.use_smooth = True


def uv_unwrap(ob):
    bpy.context.view_layer.objects.active = ob
    ob.select_set(True)
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    # smart project is the only unwrap that behaves on arbitrary generated
    # topology without seams authored by hand
    bpy.ops.uv.smart_project(angle_limit=math.radians(66), island_margin=0.02)
    bpy.ops.object.mode_set(mode='OBJECT')
    ob.select_set(False)


# ---------------------------------------------------------------- entry

def main():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default="public/assets/models/trees")
    ap.add_argument("--count", type=int, default=4)
    ap.add_argument("--seed", type=int, default=7)
    args = ap.parse_args(argv)

    os.makedirs(args.out, exist_ok=True)
    made = []
    for i in range(args.count):
        reset_scene()
        seed = args.seed + i * 101
        rng = random.Random(seed)
        ob = build_tree(
            seed,
            height=rng.uniform(6.5, 10.5),
            base_r=rng.uniform(0.34, 0.52),
            branches=rng.randint(3, 4),
        )
        add_bark_relief(ob)
        finish(ob)
        uv_unwrap(ob)

        tris = sum(len(p.vertices) - 2 for p in ob.data.polygons)
        path = os.path.abspath(os.path.join(args.out, f"tree_{i:02d}.glb"))
        bpy.ops.object.select_all(action='DESELECT')
        ob.select_set(True)
        bpy.context.view_layer.objects.active = ob
        bpy.ops.export_scene.gltf(
            filepath=path,
            export_format='GLB',
            use_selection=True,
            export_apply=True,
            export_yup=True,
        )
        made.append((path, tris))
        print(f"[make_tree] {os.path.basename(path)}  tris={tris}")

    print(f"[make_tree] wrote {len(made)} trees to {args.out}")
    for p, t in made:
        if t > 20000:
            print(f"[make_tree] WARNING over poly budget: {p} = {t} tris", file=sys.stderr)


if __name__ == "__main__":
    main()
