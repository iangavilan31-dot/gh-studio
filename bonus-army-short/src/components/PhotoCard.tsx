import React from "react";
import { staticFile, useCurrentFrame } from "remotion";
import { PAPER, RED } from "../theme";
import { microLife, slamIn } from "../motion";

// A B&W scene photo as a torn-edge card with a red offset backing — the Vox
// "clipping" treatment (for scenes: burning camp, the march). Slams in.
export const PhotoCard: React.FC<{
  src: string;
  at: number;
  x: number;
  y: number;
  width: number;
  height: number;
  rotate?: number;
  redOffset?: number;
  seed?: number;
  objectPosition?: string;
  style?: React.CSSProperties;
}> = ({
  src,
  at,
  x,
  y,
  width,
  height,
  rotate = -1.5,
  redOffset = 14,
  seed = 4,
  objectPosition = "center",
  style,
}) => {
  const frame = useCurrentFrame();
  const s = slamIn(frame, at, 7);
  const ml = microLife(frame, seed);
  const torn =
    "polygon(1% 2%, 30% 0.5%, 55% 2%, 82% 0%, 99% 3%, 98.5% 40%, 100% 74%, 98% 99%, 60% 98%, 32% 100%, 4% 98.5%, 1.5% 60%, 0% 30%)";
  return (
    <div
      style={{
        position: "absolute",
        left: x + ml.x,
        top: y + (1 - s) * 70 + ml.y,
        width,
        height,
        transform: `rotate(${rotate + ml.rot * 0.4}deg)`,
        opacity: Math.min(1, s * 1.5),
        ...style,
      }}
    >
      {/* red offset backing */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          transform: `translate(${redOffset}px, ${redOffset * 0.7}px)`,
          background: RED,
          clipPath: torn,
        }}
      />
      {/* paper mat + photo */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: PAPER,
          clipPath: torn,
          padding: 10,
          boxShadow: `0 ${8 + (1 - s) * 20}px ${16 + (1 - s) * 18}px rgba(20,16,12,0.3)`,
        }}
      >
        <img
          src={staticFile(src)}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            objectPosition,
            display: "block",
            filter: "contrast(1.02)",
          }}
        />
      </div>
    </div>
  );
};
