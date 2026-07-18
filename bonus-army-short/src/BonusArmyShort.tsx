import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { beatFrames } from "./timing";
import { Beat1 } from "./beats/Beat1";
import { Beat2 } from "./beats/Beat2";
import { Beat3 } from "./beats/Beat3";
import { Beat4 } from "./beats/Beat4";
import { Beat5 } from "./beats/Beat5";
import { Beat6 } from "./beats/Beat6";
import { Beat7 } from "./beats/Beat7";
import { Beat8 } from "./beats/Beat8";
import { Beat9 } from "./beats/Beat9";
import { Beat10 } from "./beats/Beat10";
import { Beat11 } from "./beats/Beat11";
import { Beat12 } from "./beats/Beat12";
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

const BEATS: Array<[string, React.FC]> = [
  ["b1", Beat1],
  ["b2", Beat2],
  ["b3", Beat3],
  ["b4", Beat4],
  ["b5", Beat5],
  ["b6", Beat6],
  ["b7", Beat7],
  ["b8", Beat8],
  ["b9", Beat9],
  ["b10", Beat10],
  ["b11", Beat11],
  ["b12", Beat12],
];

export const BonusArmyShort: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: "#0b0a09" }}>
      {BEATS.map(([id, C]) => (
        <BeatGate id={id} key={id}>
          <C />
        </BeatGate>
      ))}
      <Soundtrack />
    </AbsoluteFill>
  );
};
