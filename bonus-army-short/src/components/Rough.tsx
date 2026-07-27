import React, { useMemo } from "react";
import rough from "roughjs";
import { useCurrentFrame } from "remotion";
import { RED } from "../theme";
import { stepped } from "../motion";

// Hand-drawn annotations via roughjs, "drawn on" by stroke-dashoffset and
// re-seeded each 12fps step so the line boils like real marker. Decorative.
type Shape = "circle" | "underline" | "arrow" | "strike" | "bracket";

export const Rough: React.FC<{
  shape: Shape;
  at: number; // absolute draw-on start
  w: number;
  h: number;
  x: number;
  y: number;
  drawFrames?: number;
  color?: string;
  strokeWidth?: number;
  seed?: number;
}> = ({ shape, at, w, h, x, y, drawFrames = 8, color = RED, strokeWidth = 6, seed = 1 }) => {
  const raw = useCurrentFrame();
  const frame = stepped(raw);
  const boil = Math.floor((frame - at) / 2); // reseed each step
  const d = useMemo(() => {
    const rc = rough.generator({
      options: { stroke: color, strokeWidth, roughness: 2.1, bowing: 1.4, seed: seed + Math.max(0, boil) },
    });
    let drawable;
    const pad = strokeWidth;
    if (shape === "circle")
      drawable = rc.ellipse(w / 2, h / 2, w - pad, h - pad);
    else if (shape === "underline")
      drawable = rc.line(pad, h - pad, w - pad, h - pad * 1.5);
    else if (shape === "strike")
      drawable = rc.line(pad, h / 2, w - pad, h / 2);
    else if (shape === "bracket")
      drawable = rc.linearPath([
        [w * 0.3, pad],
        [pad, pad],
        [pad, h - pad],
        [w * 0.3, h - pad],
      ]);
    else
      drawable = rc.linearPath([
        [pad, h / 2],
        [w - pad, h / 2],
        [w - pad * 3, h / 2 - pad * 2],
      ]); // arrow shaft (+ head approximated)
    return rc.toPaths(drawable).map((p) => p.d);
  }, [shape, w, h, color, strokeWidth, seed, boil]);

  if (raw < at) return null;
  const t = Math.min(1, (raw - at) / drawFrames); // smooth-ish draw-on
  return (
    <svg
      width={w}
      height={h}
      style={{ position: "absolute", left: x, top: y, overflow: "visible" }}
    >
      {d.map((dd, i) => (
        <path
          key={i}
          d={dd}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          pathLength={1}
          strokeDasharray={1}
          strokeDashoffset={1 - t}
        />
      ))}
    </svg>
  );
};
