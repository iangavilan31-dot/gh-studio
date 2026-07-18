import React from "react";
import { useCurrentFrame } from "remotion";
import { FONT_BODY, FONT_HEAD, INK, RED } from "../theme";
import { appear, slamIn } from "../motion";
import { Stamp } from "./Stamp";

// Senate roll-call: 62 NAY vs 18 YEA, the bonus defeated. The big red 62 slams
// first, then 18, then the DEFEATED stamp.
export const VoteTally: React.FC<{
  at: number;
  stampAt: number;
  style?: React.CSSProperties;
}> = ({ at, stampAt, style }) => {
  const frame = useCurrentFrame();
  const nay = slamIn(frame, at, 5);
  const yea = slamIn(frame, at + 8, 5);
  const num = (v: string, s: number, color: string, size: number) => (
    <div style={{ textAlign: "center", opacity: Math.min(1, s * 1.5) }}>
      <div
        style={{
          fontFamily: FONT_HEAD,
          fontWeight: 900,
          fontSize: size,
          lineHeight: 0.85,
          color,
          transform: `scale(${0.9 + s * 0.12})`,
        }}
      >
        {v}
      </div>
    </div>
  );
  return (
    <div style={{ position: "relative", ...style }}>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 70 }}>
        <div>
          {num("62", nay, RED, 340)}
          <div style={label}>NAY</div>
        </div>
        <div
          style={{
            fontFamily: FONT_HEAD,
            fontSize: 120,
            color: INK,
            opacity: 0.4,
            paddingBottom: 60,
          }}
        >
          –
        </div>
        <div>
          {num("18", yea, INK, 210)}
          <div style={label}>YEA</div>
        </div>
      </div>
      <div style={{ position: "absolute", left: 40, top: 250, opacity: appear(frame, stampAt, 2) }}>
        <Stamp at={stampAt} rotate={-8} size={64}>
          DEFEATED
        </Stamp>
      </div>
    </div>
  );
};

const label: React.CSSProperties = {
  fontFamily: FONT_BODY,
  fontWeight: 800,
  fontSize: 34,
  letterSpacing: "0.2em",
  color: INK,
  textAlign: "center",
  marginTop: 10,
};
