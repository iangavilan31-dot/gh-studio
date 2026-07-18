import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";

// Deterministic film-stock finish: grain + gate-weave vignette (base), drifting
// dust + occasional scratch lines, projector flicker, flash frames, light leaks,
// halation and an optional hand-tint wash. Everything is seeded by frame so it
// is reproducible. Layer per shot; vary `intensity`.

const hash = (n: number): number => {
  // integer hash -> [0,1)
  let x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};

type Props = {
  intensity?: number; // 0..1 overall
  flicker?: boolean; // projector brightness dips
  scratches?: boolean; // vertical scratch lines + dust
  halation?: boolean; // glow bleed (for bright newsreel)
  flashFrames?: number[]; // absolute frames to flash near-white (1-2f)
  leakWindows?: Array<[number, number, string?]>; // [start,end,color] warm corner sweep
  tint?: string | null; // hand-tint wash color
  tintAmount?: number;
  seed?: number;
};

export const FilmTexture: React.FC<Props> = ({
  intensity = 0.5,
  flicker = false,
  scratches = false,
  halation = false,
  flashFrames = [],
  leakWindows = [],
  tint = null,
  tintAmount = 0.14,
  seed = 1,
}) => {
  const frame = useCurrentFrame();
  const grainAmt = 0.05 + intensity * 0.06;

  // projector flicker — irregular 1-2 frame brightness dips
  let flick = 0;
  if (flicker) {
    const slot = Math.floor(frame / 7);
    if (hash(slot * 3.7 + seed) > 0.72) {
      const within = frame - slot * 7;
      if (within < 2) flick = (0.06 + intensity * 0.1) * (within === 0 ? 1 : 0.5);
    }
  }

  // flash frames (hard cuts)
  const flash = flashFrames.some((f) => frame >= f && frame < f + 2)
    ? frame === (flashFrames.find((f) => frame >= f && frame < f + 2) as number)
      ? 0.85
      : 0.4
    : 0;

  // light leak sweep
  let leak: { o: number; color: string } | null = null;
  for (const [s, e, color] of leakWindows) {
    if (frame >= s && frame <= e) {
      const t = (frame - s) / Math.max(1, e - s);
      const o = Math.sin(t * Math.PI) * (0.28 + intensity * 0.12);
      leak = { o, color: color ?? "rgba(255,140,60,1)" };
    }
  }

  // scratch lines: a few short-lived vertical lines
  const scratchEls: React.ReactNode[] = [];
  if (scratches) {
    const nScr = 2 + Math.round(intensity * 2);
    for (let i = 0; i < nScr; i++) {
      const life = Math.floor(frame / (5 + i)) + i * 13 + seed;
      if (hash(life * 1.7) > 0.55) {
        const x = hash(life * 2.3) * 100;
        const w = 0.8 + hash(life * 4.1) * 1.2;
        const dark = hash(life * 5.9) > 0.5;
        const top = hash(life * 7.3) * 40;
        const h = 40 + hash(life * 8.1) * 60;
        scratchEls.push(
          <div
            key={`s${i}`}
            style={{
              position: "absolute",
              left: `${x}%`,
              top: `${top}%`,
              width: w,
              height: `${h}%`,
              background: dark ? "rgba(0,0,0,0.35)" : "rgba(255,252,240,0.5)",
              opacity: 0.4 + intensity * 0.4,
            }}
          />
        );
      }
    }
    // dust specks
    const nDust = 6 + Math.round(intensity * 10);
    for (let i = 0; i < nDust; i++) {
      const life = Math.floor(frame / 3) + i * 29 + seed * 7;
      if (hash(life * 1.1) > 0.4) {
        const x = hash(life * 2.7) * 100;
        const y = hash(life * 3.3) * 100;
        const r = 0.8 + hash(life * 6.6) * 2.2;
        const dark = hash(life * 9.2) > 0.45;
        scratchEls.push(
          <div
            key={`d${i}`}
            style={{
              position: "absolute",
              left: `${x}%`,
              top: `${y}%`,
              width: r,
              height: r,
              borderRadius: "50%",
              background: dark ? "rgba(0,0,0,0.5)" : "rgba(255,250,235,0.6)",
            }}
          />
        );
      }
    }
  }

  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      {/* vignette */}
      <AbsoluteFill
        style={{
          background:
            "radial-gradient(120% 90% at 50% 45%, rgba(0,0,0,0) 52%, rgba(18,14,10,0.24) 100%)",
        }}
      />
      {/* halation glow */}
      {halation && (
        <AbsoluteFill
          style={{
            mixBlendMode: "screen",
            opacity: 0.12 + intensity * 0.1,
            background:
              "radial-gradient(50% 40% at 50% 42%, rgba(255,244,214,0.5), transparent 70%)",
            filter: "blur(24px)",
          }}
        />
      )}
      {/* light leak */}
      {leak && (
        <AbsoluteFill
          style={{
            mixBlendMode: "screen",
            opacity: leak.o,
            background: `radial-gradient(60% 90% at ${
              frame % 2 ? 96 : 4
            }% 12%, ${leak.color}, transparent 60%)`,
          }}
        />
      )}
      {/* scratches + dust */}
      {scratchEls.length > 0 && <AbsoluteFill>{scratchEls}</AbsoluteFill>}
      {/* grain */}
      <AbsoluteFill style={{ opacity: grainAmt, mixBlendMode: "overlay" }}>
        <svg width="100%" height="100%">
          <filter id={`ft-grain-${seed}-${frame % 8}`}>
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.7"
              numOctaves={2}
              seed={frame % 71}
              stitchTiles="stitch"
            />
            <feColorMatrix type="saturate" values="0" />
          </filter>
          <rect width="100%" height="100%" filter={`url(#ft-grain-${seed}-${frame % 8})`} />
        </svg>
      </AbsoluteFill>
      {/* hand-tint wash */}
      {tint && (
        <AbsoluteFill
          style={{ background: tint, opacity: tintAmount, mixBlendMode: "soft-light" }}
        />
      )}
      {/* projector flicker dip */}
      {flick > 0 && <AbsoluteFill style={{ background: "#000", opacity: flick }} />}
      {/* flash frame */}
      {flash > 0 && <AbsoluteFill style={{ background: "#fff7ea", opacity: flash }} />}
    </AbsoluteFill>
  );
};
