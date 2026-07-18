import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { beatFrames } from "./timing";
import { Beat1 } from "./beats/Beat1";
import { Soundtrack } from "./audio/Soundtrack";

export const PAPER = "#F3EEE3";
export const INK = "#141210";
export const MARKER = "#FFE94A";
export const RED = "#D9331F";

// Beats are sequential and non-overlapping; each is gated to its own window so
// it can use ABSOLUTE event frames (ev/beatWords) directly. The switch between
// gates is the hard-cut reframe between beats.
const BeatGate: React.FC<{ id: string; children: React.ReactNode; pad?: number }> = ({
  id,
  children,
  pad = 0,
}) => {
  const frame = useCurrentFrame();
  const { from, to } = beatFrames(id);
  if (frame < from - pad || frame >= to + pad) return null;
  return <>{children}</>;
};

export const BonusArmyShort: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: "#0b0a09" }}>
      <BeatGate id="b1">
        <Beat1 />
      </BeatGate>
      <Soundtrack />
    </AbsoluteFill>
  );
};
