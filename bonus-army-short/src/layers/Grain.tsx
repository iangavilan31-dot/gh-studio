import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";

// Global finish: film grain (6-10%), vignette, and a 1-2px gate weave.
// Grain reseeds each frame so it shimmers like real stock.
export const Grain: React.FC<{ amount?: number }> = ({ amount = 0.08 }) => {
  const frame = useCurrentFrame();
  const seed = (frame % 12) * 0.137; // cycle a few turbulence phases
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      {/* vignette */}
      <AbsoluteFill
        style={{
          background:
            "radial-gradient(115% 85% at 50% 45%, rgba(0,0,0,0) 55%, rgba(20,16,12,0.20) 100%)",
        }}
      />
      {/* grain */}
      <AbsoluteFill style={{ opacity: amount, mixBlendMode: "overlay" }}>
        <svg width="100%" height="100%">
          <filter id={`grain-${frame % 12}`}>
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.72"
              numOctaves={2}
              seed={frame % 97}
              stitchTiles="stitch"
            />
            <feColorMatrix type="saturate" values="0" />
            <feComponentTransfer>
              <feFuncA type="linear" slope="1.4" intercept={-0.2 + seed * 0.02} />
            </feComponentTransfer>
          </filter>
          <rect width="100%" height="100%" filter={`url(#grain-${frame % 12})`} />
        </svg>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
