The camera below was solved analytically from the reference and validated by
reprojection. Do not re-derive, re-estimate, or "improve" any number. Read-only.

  Camera3D.position          Vector3(1.02, 0.92, 3.95)
  Camera3D.rotation_degrees  Vector3(6.2, 0.0, 0.0)   <- POSITIVE X = pitched UP
  Camera3D.fov               40.0                      <- VERTICAL, not horizontal
  near 0.05, far 400
  WATER_SURFACE_Y 0.30, SWAMP_FLOOR_Y 0.00, PLAYER_HEIGHT 1.20 (floor to hat top)

Godot's fov is vertical. 40 vertical = 65.8 horizontal at 16:9. Setting it to 65 or 70
gives a fisheye and nothing will match. The camera is pitched UP, not down, which is
why the horizon sits at screen y 0.649, below frame center.

Player at world origin facing -Z. Camera sits 0.62 m above the water, 3.95 m back.

WORLD PLACEMENT TABLE (position -> where it reprojects to on screen):
  player                (0.00, 0.00, 0.00)      0.300, 0.780
  ripple center         (0.02, 0.30, -0.02)     0.300, 0.870
  lily fg-left          (-0.53, 0.30, 1.02)     0.080, 0.950
  lily fg-right         (2.72, 0.30, 0.81)      0.930, 0.930
  lily mid-right        (2.34, 0.30, -1.83)     0.680, 0.800
  lily far-right        (4.26, 0.30, -5.12)     0.780, 0.745
  pink lotus            (5.90, 0.35, -8.30)     0.811, 0.714
  moss frame left       (-2.47, 3.30, -1.83)    0.050, 0.100
  moss frame right      (4.67, 3.22, -1.84)     0.970, 0.120
  torii crossbeam       (12.00, 7.20, -18.00)   0.877, 0.264
  torii lantern         (12.60, 5.30, -17.80)   0.905, 0.375
  torii base            (12.00, 0.30, -18.00)   0.890, 0.689
  shrine roof           (-15.50, 6.30, -26.00)  0.079, 0.404
  shrine lantern        (-15.60, 5.00, -26.00)  0.075, 0.463
  ally frog A           (-20.48, 0.00, -34.00)  0.060, 0.640
  ally frog B           (-19.34, 0.00, -40.00)  0.140, 0.645
  ally frog C           (-17.94, 0.00, -46.00)  0.205, 0.650
  mushroom cap LEFT     (-19.00, 15.00, -40.00) 0.158, 0.219
  mushroom cap RIGHT    (19.00, 12.80, -35.00)  0.847, 0.239
  creature face         (5.40, 13.20, -56.00)   0.556, 0.371
  creature eye LEFT     (3.90, 14.30, -56.00)   0.536, 0.346
  creature eye RIGHT    (7.60, 13.50, -56.00)   0.583, 0.364
  wingtip upper-left    (-19.50, 28.30, -54.40) 0.240, 0.029
  wingtip upper-right   (27.90, 27.40, -54.50) 0.841, 0.049
  wing root lower-left  (-5.30, 19.87, -55.35)  0.420, 0.220
  wing root lower-right (18.39, 20.75, -55.25)  0.720, 0.200
  leg L terminate FOG   (-6.00, 1.35, -50.00)   0.402, 0.638
  leg R terminate FOG   (14.00, 1.35, -52.00)   0.681, 0.638
  far trees left        (-55.57, 17.51, -110.0) 0.120, 0.450
  far trees center      (-24.74, 11.67, -95.00) 0.300, 0.500
  far trees right       (29.45, 15.17, -105.0)  0.700, 0.470

Derived: wingspan 47.4 m, wingtips 28 m above water, face 12.9 m above water and
57.9 m from the player, eye separation 3.7 m. The creature is 48x the player's height
at the wingspan.

THE WATERLINE COMPRESSION TRAP: the camera is 0.62 m above the water, so on a flat
plane the water surface at 20 m lands at screen y 0.6853, at 60 m lands at 0.6627, and
infinity lands at 0.6492. Everything past 60 m collapses into a 4-pixel band at 1080p.
Consequences: (1) never derive a distant object's position from its screen y, place by
real distance then reproject to verify; (2) the visible horizon in the reference is the
FOG WALL, not the water horizon; (3) the creature's limbs sit 1.05 m ABOVE the water at
their reference screen position and never touch it. That is forced by the perspective,
not a stylistic choice. Terminate every limb inside a FogVolume and never model a
contact point.

PHOTOMETRIC TARGETS measured from the reference:
  mean luma 0.271 | luma std 0.116 | p95 0.457 | p99 0.577 | max 0.957 (moon only)
  mean saturation 0.164 | neutral 83.4% | cool 16.3% | WARM 0.47%
  pixels below luma 0.05 = 2.8% | pixels above 0.80 = 0.00%

VERTICAL STRUCTURE, the part most people get backwards:
  luminance is INVERTED. sky 0.393, foreground water 0.109.
  saturation INCREASES downward. 0.139 top, 0.250 bottom.
  there is a BRIGHT FOG BAND at screen y 0.60-0.70 that is brighter than the sky
  directly above it. It silhouettes the creature's legs. Center-column profile of the
  reference, top to bottom: 0.537 0.479 0.345 0.276 0.283 0.336 0.381 0.263 0.205 0.184

PALETTE, eight dominant colors, none of them purple green or amber:
  #667376 #535f62 #4b5658 #424d4f #3a4343 #2f3736 #242a28 #121410
ACCENTS, all tiny: creature eyes #d3d99b, lanterns #faf5de and #e3d1ab, lotus #aa718d,
moon #f4f4f0. THREE warm lights total. Everything else that looks like a lantern in the
reference is a reflection on the water.
