import React from "react";
import { AbsoluteFill, Audio, staticFile } from "remotion";

// Placeholder root composition: paper background + scratch VO only.
// Scene work is gated on reference-analysis.md approval (see follow-up brief);
// this exists so the render toolchain can be verified end-to-end.
export const PAPER = "#F3EEE3";
export const INK = "#141210";
export const MARKER = "#FFE94A";
export const RED = "#D9331F";

export const BonusArmyShort: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: PAPER }}>
      <Audio src={staticFile("audio/vo.wav")} />
    </AbsoluteFill>
  );
};
