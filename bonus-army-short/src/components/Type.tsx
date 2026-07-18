import React from "react";
import { FONT_HEAD, FONT_SERIF_BODY, INK, INK_SOFT } from "../theme";
import { TornMarker } from "./TornMarker";

// A word that can be highlighted by a torn marker wiping in at `reveal`.
export const HiWord: React.FC<{
  children: React.ReactNode;
  reveal?: number; // 0..1; undefined = no highlight
  seed?: number;
  markerOpacity?: number;
}> = ({ children, reveal, seed = 3, markerOpacity = 0.9 }) => (
  <span style={{ position: "relative", display: "inline-block", padding: "0 0.06em" }}>
    {reveal !== undefined && reveal > 0 && (
      <TornMarker reveal={reveal} seed={seed} opacity={markerOpacity} />
    )}
    <span style={{ position: "relative", zIndex: 1 }}>{children}</span>
  </span>
);

export const Headline: React.FC<{
  children: React.ReactNode;
  size?: number;
  weight?: number;
  italic?: boolean;
  style?: React.CSSProperties;
}> = ({ children, size = 118, weight = 800, italic = false, style }) => (
  <div
    style={{
      fontFamily: FONT_HEAD,
      fontWeight: weight,
      fontStyle: italic ? "italic" : "normal",
      fontSize: size,
      lineHeight: 1.02,
      letterSpacing: "-0.012em",
      color: INK,
      ...style,
    }}
  >
    {children}
  </div>
);

export const Dek: React.FC<{
  children: React.ReactNode;
  size?: number;
  style?: React.CSSProperties;
}> = ({ children, size = 40, style }) => (
  <div
    style={{
      fontFamily: FONT_SERIF_BODY,
      fontWeight: 400,
      fontSize: size,
      lineHeight: 1.32,
      color: INK_SOFT,
      ...style,
    }}
  >
    {children}
  </div>
);
