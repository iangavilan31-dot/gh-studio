import React from "react";
import { FONT_SERIF_BODY, RED, RED_DEEP } from "../theme";
import { slamIn } from "../motion";
import { useCurrentFrame } from "remotion";

// Red pinned date label — a slam-in sticker, ~4.2:1, white serif, small shadow.
export const DateTag: React.FC<{
  children: React.ReactNode;
  at?: number; // slam-in start frame (absolute)
  size?: number;
  style?: React.CSSProperties;
}> = ({ children, at = 0, size = 42, style }) => {
  const frame = useCurrentFrame();
  const s = slamIn(frame, at, 6);
  const shadow = 2 + (1 - s) * 8; // shadow tightens as it lands
  return (
    <div
      style={{
        display: "inline-block",
        background: RED,
        color: "#FBF6EC",
        fontFamily: FONT_SERIF_BODY,
        fontWeight: 700,
        fontSize: size,
        letterSpacing: "0.02em",
        padding: "0.14em 0.5em 0.2em",
        transform: `translateY(${(1 - s) * -14}px) rotate(${(1 - s) * -1.4}deg)`,
        opacity: Math.min(1, s * 1.6),
        boxShadow: `${shadow * 0.3}px ${shadow}px 0 ${RED_DEEP}66`,
        clipPath:
          "polygon(0.5% 3%, 99% 0%, 99.5% 96%, 1% 100%)", // faintly torn sticker
        ...style,
      }}
    >
      {children}
    </div>
  );
};
