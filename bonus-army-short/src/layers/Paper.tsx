import React from "react";
import { AbsoluteFill } from "remotion";
import { GRID, PAPER, PAPER_DEEP } from "../theme";

// Flat kraft fill + a very faint square grid + a soft warmth gradient.
// Presence, not pattern (reference paper σ≈8/255). Grid cell ≈ 96px.
export const Paper: React.FC<{ cell?: number }> = ({ cell = 96 }) => {
  return (
    <AbsoluteFill style={{ backgroundColor: PAPER }}>
      {/* uneven warmth so it doesn't read as flat digital */}
      <AbsoluteFill
        style={{
          background: `radial-gradient(120% 80% at 30% 12%, ${PAPER} 0%, ${PAPER} 55%, ${PAPER_DEEP} 130%)`,
        }}
      />
      {/* faint grid */}
      <AbsoluteFill
        style={{
          backgroundImage: `linear-gradient(${GRID} 1px, transparent 1px), linear-gradient(90deg, ${GRID} 1px, transparent 1px)`,
          backgroundSize: `${cell}px ${cell}px`,
          mixBlendMode: "multiply",
        }}
      />
      {/* paper fibre — subtle fractal noise */}
      <AbsoluteFill style={{ opacity: 0.5, mixBlendMode: "multiply" }}>
        <svg width="100%" height="100%">
          <filter id="paperFiber">
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.9"
              numOctaves={2}
              stitchTiles="stitch"
            />
            <feColorMatrix
              type="matrix"
              values="0 0 0 0 0.55  0 0 0 0 0.5  0 0 0 0 0.42  0 0 0 0.05 0"
            />
          </filter>
          <rect width="100%" height="100%" filter="url(#paperFiber)" />
        </svg>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
