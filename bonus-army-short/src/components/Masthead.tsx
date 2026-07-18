import React from "react";
import { FONT_HEAD, INK } from "../theme";

// Newspaper masthead over a hairline rule (reference: right-aligned blackletter).
// We approximate the blackletter register with a heavy Playfair italic in small
// caps — reads as "old newspaper" without shipping a novelty face.
export const Masthead: React.FC<{
  children?: React.ReactNode;
  align?: "left" | "right" | "center";
  width?: number | string;
  style?: React.CSSProperties;
}> = ({ children = "The New York Times", align = "right", width = "100%", style }) => (
  <div style={{ width, ...style }}>
    <div style={{ height: 2, background: INK, opacity: 0.85, marginBottom: 16 }} />
    <div
      style={{
        textAlign: align,
        fontFamily: FONT_HEAD,
        fontStyle: "italic",
        fontWeight: 900,
        fontSize: 46,
        letterSpacing: "0.01em",
        color: INK,
        fontVariant: "small-caps",
      }}
    >
      {children}
    </div>
  </div>
);
