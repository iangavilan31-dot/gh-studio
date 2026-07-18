import React from "react";
import { useCurrentFrame } from "remotion";
import {
  FONT_BODY,
  FONT_HEAD,
  FONT_MARKER,
  FONT_MONO,
  INK,
  MARKER,
  RED,
} from "../theme";
import { appear, slamIn, stepped } from "../motion";
import { Rough } from "./Rough";

// Small franklin/mono kicker label, optionally with a red bar.
export const Label: React.FC<{
  children: React.ReactNode;
  at?: number;
  mono?: boolean;
  bar?: boolean;
  size?: number;
  color?: string;
  style?: React.CSSProperties;
}> = ({ children, at = 0, mono, bar, size = 30, color = INK, style }) => {
  const frame = useCurrentFrame();
  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 14,
        fontFamily: mono ? FONT_MONO : FONT_BODY,
        fontWeight: mono ? 600 : 800,
        fontSize: size,
        letterSpacing: mono ? "0.04em" : "0.14em",
        textTransform: "uppercase",
        color,
        opacity: appear(frame, at, 4),
        ...style,
      }}
    >
      {bar && <span style={{ width: 46, height: 5, background: RED }} />}
      {children}
    </div>
  );
};

// Big editorial number that slams in (43,000; casualty counts).
export const BigStat: React.FC<{
  value: React.ReactNode;
  label?: React.ReactNode;
  at: number;
  size?: number;
  color?: string;
  style?: React.CSSProperties;
}> = ({ value, label, at, size = 240, color = INK, style }) => {
  const frame = useCurrentFrame();
  const s = slamIn(frame, at, 6);
  return (
    <div style={{ ...style }}>
      <div
        style={{
          fontFamily: FONT_HEAD,
          fontWeight: 900,
          fontSize: size,
          lineHeight: 0.9,
          color,
          letterSpacing: "-0.02em",
          transform: `scale(${0.9 + s * 0.1})`,
          transformOrigin: "left bottom",
          opacity: Math.min(1, s * 1.5),
        }}
      >
        {value}
      </div>
      {label && (
        <div
          style={{
            fontFamily: FONT_BODY,
            fontWeight: 800,
            fontSize: size * 0.11,
            letterSpacing: "0.16em",
            textTransform: "uppercase",
            color: INK,
            marginTop: 12,
            opacity: appear(frame, at + 3, 5),
          }}
        >
          {label}
        </div>
      )}
    </div>
  );
};

// Handwritten permanent-marker note, revealed word-ish by a clip wipe, with an
// optional rough underline/arrow. Stepped 12fps jitter on rotation.
export const Scribble: React.FC<{
  children: React.ReactNode;
  at: number;
  x: number;
  y: number;
  width?: number;
  size?: number;
  rotate?: number;
  color?: string;
  underline?: boolean;
}> = ({ children, at, x, y, width = 520, size = 54, rotate = -3, color = RED, underline }) => {
  const raw = useCurrentFrame();
  const frame = stepped(raw);
  const rel = raw - at;
  if (rel < 0) return null;
  const jitter = ((frame - at) % 4 < 2 ? 1 : -1) * 0.4;
  const reveal = Math.min(1, rel / 10);
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        width,
        transform: `rotate(${rotate + jitter}deg)`,
      }}
    >
      <div
        style={{
          fontFamily: FONT_MARKER,
          fontSize: size,
          lineHeight: 1.05,
          color,
          clipPath: `inset(0 ${(1 - reveal) * 100}% 0 0)`,
        }}
      >
        {children}
      </div>
      {underline && (
        <Rough shape="underline" at={at + 6} x={0} y={size * 0.9} w={width * 0.82} h={30} color={color} strokeWidth={5} />
      )}
    </div>
  );
};

// Marker-boxed word (yellow) — inline emphasis token used in tallies etc.
export const MarkerChip: React.FC<{ children: React.ReactNode; at?: number }> = ({
  children,
  at = 0,
}) => {
  const frame = useCurrentFrame();
  return (
    <span
      style={{
        background: MARKER,
        padding: "0.02em 0.2em",
        boxDecorationBreak: "clone",
        opacity: appear(frame, at, 3),
      }}
    >
      {children}
    </span>
  );
};
