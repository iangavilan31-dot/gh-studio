import React from "react";
import { useCurrentFrame } from "remotion";
import { FONT_HEAD, FONT_MARKER, INK, RED } from "../theme";
import { appear, slamIn } from "../motion";
import { Rough } from "./Rough";

// A big hand-circled year (1945) with a marker annotation ("13 YEARS AWAY").
export const DateCircle: React.FC<{
  year: string;
  note?: string;
  at: number; // number slam
  circleAt: number; // rough circle draw-on
  x: number;
  y: number;
}> = ({ year, note = "13 YEARS AWAY", at, circleAt, x, y }) => {
  const frame = useCurrentFrame();
  const s = slamIn(frame, at, 6);
  return (
    <div style={{ position: "absolute", left: x, top: y }}>
      <div
        style={{
          fontFamily: FONT_HEAD,
          fontWeight: 900,
          fontSize: 280,
          color: INK,
          lineHeight: 0.9,
          transform: `scale(${0.92 + s * 0.1})`,
          opacity: Math.min(1, s * 1.5),
          position: "relative",
        }}
      >
        {year}
        <Rough
          shape="circle"
          at={circleAt}
          x={-40}
          y={-24}
          w={560}
          h={330}
          color={RED}
          strokeWidth={9}
          drawFrames={10}
        />
      </div>
      <div
        style={{
          fontFamily: FONT_MARKER,
          fontSize: 56,
          color: RED,
          transform: "rotate(-4deg)",
          marginTop: 20,
          marginLeft: 60,
          opacity: appear(frame, circleAt + 8, 5),
        }}
      >
        {note}
      </div>
    </div>
  );
};
