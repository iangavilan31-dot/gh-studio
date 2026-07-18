import React from "react";
import { MARKER, MARKER_DEEP } from "../theme";

// A hand-torn highlighter band. Wobbly top/bottom edges + ragged ends, drawn as
// an SVG path from a seeded jitter, revealed left->right by `reveal` (0..1).
// Sits UNDER the glyphs (reference §2). Slightly translucent so paper bleeds.
const rng = (seed: number) => {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
};

export const TornMarker: React.FC<{
  reveal: number; // 0..1 wipe
  seed?: number;
  color?: string;
  opacity?: number;
  overshootY?: number; // how much taller than the box (x-height feel)
}> = ({ reveal, seed = 3, color = MARKER, opacity = 0.9, overshootY = 0.16 }) => {
  const w = 100;
  const h = 100;
  const r = rng(seed);
  const steps = 14;
  const topPts: string[] = [];
  const botPts: string[] = [];
  const padY = h * overshootY;
  for (let i = 0; i <= steps; i++) {
    const x = (i / steps) * w;
    topPts.push(`${x.toFixed(2)},${(padY * 0.35 + (r() - 0.5) * padY * 1.1).toFixed(2)}`);
  }
  for (let i = steps; i >= 0; i--) {
    const x = (i / steps) * w;
    botPts.push(
      `${x.toFixed(2)},${(h - padY * 0.35 + (r() - 0.5) * padY * 1.1).toFixed(2)}`
    );
  }
  // ragged ends
  const path = `M ${topPts[0]} L ${topPts.join(" L ")} L ${botPts.join(" L ")} Z`;
  const clip = Math.max(0, Math.min(1, reveal));

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none"
      style={{
        position: "absolute",
        left: "-4%",
        top: `-${overshootY * 100}%`,
        width: "108%",
        height: `${100 + overshootY * 200}%`,
        zIndex: 0,
        opacity,
        mixBlendMode: "multiply",
      }}
    >
      <defs>
        <clipPath id={`tm-${seed}`}>
          <rect x="0" y="0" width={w * clip} height={h} />
        </clipPath>
        <linearGradient id={`tg-${seed}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} />
          <stop offset="55%" stopColor={color} />
          <stop offset="100%" stopColor={MARKER_DEEP} />
        </linearGradient>
      </defs>
      <path d={path} fill={`url(#tg-${seed})`} clipPath={`url(#tm-${seed})`} />
      {/* streaky marker core */}
      <path
        d={path}
        fill="none"
        stroke={MARKER_DEEP}
        strokeWidth={1.2}
        strokeOpacity={0.25}
        clipPath={`url(#tm-${seed})`}
      />
    </svg>
  );
};
