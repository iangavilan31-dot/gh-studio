import React from "react";
import { staticFile, useCurrentFrame } from "remotion";
import { RED } from "../theme";
import { microLife, slamIn } from "../motion";

// A rembg subject cutout: solid-red offset silhouette behind + B&W cutout in
// front, slamming in from below with a shadow that tightens as it lands.
export const Cutout: React.FC<{
  src: string; // e.g. "assets/treated/macarthur.png"
  at: number; // absolute slam frame
  width: number;
  x: number; // world px (top-left)
  y: number;
  offset?: number; // red offset distance
  seed?: number;
  fromBelow?: number; // px it rises from
  style?: React.CSSProperties;
}> = ({ src, at, width, x, y, offset = 12, seed = 5, fromBelow = 90, style }) => {
  const frame = useCurrentFrame();
  const s = slamIn(frame, at, 7);
  const ml = microLife(frame, seed);
  const rise = (1 - s) * fromBelow;
  const url = staticFile(src);

  return (
    <div
      style={{
        position: "absolute",
        left: x + ml.x,
        top: y + rise + ml.y,
        width,
        opacity: Math.min(1, s * 1.5),
        transform: `rotate(${ml.rot * 0.5}deg)`,
        filter: `drop-shadow(0 ${6 + (1 - s) * 26}px ${8 + (1 - s) * 20}px rgba(20,16,12,${
          0.28 + (1 - s) * 0.15
        }))`,
        ...style,
      }}
    >
      {/* red offset silhouette (solid RED masked by the cutout alpha) */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          transform: `translate(${offset}px, ${offset * 0.5}px)`,
          background: RED,
          WebkitMaskImage: `url(${url})`,
          maskImage: `url(${url})`,
          WebkitMaskSize: "100% 100%",
          maskSize: "100% 100%",
          WebkitMaskRepeat: "no-repeat",
          maskRepeat: "no-repeat",
        }}
      />
      {/* the B&W subject */}
      <img src={url} style={{ position: "relative", width: "100%", display: "block" }} />
    </div>
  );
};
