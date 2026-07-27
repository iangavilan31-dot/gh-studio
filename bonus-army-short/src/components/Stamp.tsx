import React from "react";
import { useCurrentFrame } from "remotion";
import { FONT_MONO, RED, RED_DEEP } from "../theme";
import { stepped } from "../motion";

// Rubber-stamp label: mono caps in a rough red box, stamped on with a thud.
// Decorative -> sampled at 12fps. Slight rotation + ink-bleed edges.
export const Stamp: React.FC<{
  children: React.ReactNode;
  at: number; // absolute stamp frame
  rotate?: number;
  size?: number;
  color?: string;
  style?: React.CSSProperties;
}> = ({ children, at, rotate = -4, size = 46, color = RED, style }) => {
  const raw = useCurrentFrame();
  const frame = stepped(raw);
  const rel = frame - at;
  if (rel < 0) return null;
  // impact: overshoot scale on the first 4 stepped frames, then settle
  const scale = rel <= 0 ? 1.28 : rel <= 2 ? 1.1 : rel <= 4 ? 0.97 : 1;
  const op = rel <= 0 ? 0.5 : 1;
  return (
    <div
      style={{
        display: "inline-block",
        fontFamily: FONT_MONO,
        fontWeight: 600,
        fontSize: size,
        letterSpacing: "0.06em",
        color,
        border: `3px solid ${color}`,
        padding: "0.08em 0.28em 0.14em",
        transform: `rotate(${rotate}deg) scale(${scale})`,
        opacity: op,
        boxShadow: `inset 0 0 0 1px ${RED_DEEP}55`,
        background: `${color}0d`,
        textShadow: `0 0 1px ${color}55`,
        ...style,
      }}
    >
      {children}
    </div>
  );
};
