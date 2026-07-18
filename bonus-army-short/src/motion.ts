// Motion grammar from reference-analysis.md §7, as reusable primitives.
// Everything is deterministic in `frame`; nothing is time-based.
import { interpolate, spring } from "remotion";
import { noise2D } from "@remotion/noise";
import { FPS } from "./theme";

export const easeOutExpo = (t: number): number =>
  t >= 1 ? 1 : 1 - Math.pow(2, -10 * t);

export const easeInOutCubic = (t: number): number =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

/** Decorative graphics sample at 12fps; camera + highlights stay smooth. */
export const stepped = (frame: number): number => Math.floor(frame / 2) * 2;

/**
 * Punch-in scalar in [0..1+overshoot] over `dur` frames from `start`, with a
 * 2% overshoot and a damped spring settle (damping≈14). Never linear, ≤8 frames.
 */
export const punch = (
  frame: number,
  start: number,
  dur = 5,
  overshoot = 0.02
): number => {
  if (frame < start) return 0;
  const t = Math.min(1, (frame - start) / dur);
  const e = easeOutExpo(t);
  const settle =
    spring({
      frame: frame - start,
      fps: FPS,
      config: { damping: 14, stiffness: 200, mass: 0.6 },
      durationInFrames: Math.max(dur + 6, 12),
    }) - 1;
  return e + overshoot * (1 - e) * 6 * Math.max(0, settle + 0.16);
};

/** 1-frame directional blur (px) that spikes on a punch/slam and decays fast. */
export const punchBlur = (frame: number, start: number, peak = 14): number =>
  interpolate(frame - start, [0, 1, 3], [peak, peak * 0.4, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

/** 0.5° rotation kick that decays over ~6 frames. */
export const rotKick = (frame: number, start: number, deg = 0.5): number =>
  interpolate(frame - start, [0, 2, 8], [deg, deg * 0.3, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

/** Always-on micro-life: 2-3px float + slow rotation wander from smoothed noise. */
export const microLife = (
  frame: number,
  seed = 1
): { x: number; y: number; rot: number } => {
  const t = frame / FPS;
  return {
    x: noise2D(`ml-x-${seed}`, t * 0.22, 0) * 2.6,
    y: noise2D(`ml-y-${seed}`, 0, t * 0.19) * 2.6,
    rot: noise2D(`ml-r-${seed}`, t * 0.13, 5) * 0.28,
  };
};

/** Slam-in: element arrives from `dir` with an easeOutExpo over `dur` frames. */
export const slamIn = (
  frame: number,
  start: number,
  dur = 6
): number => {
  if (frame < start) return 0;
  return easeOutExpo(Math.min(1, (frame - start) / dur));
};

/** Reveal opacity that pops on then holds. */
export const appear = (frame: number, start: number, dur = 4): number =>
  interpolate(frame - start, [0, dur], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
