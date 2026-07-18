import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { Paper } from "./layers/Paper";
import { Grain } from "./layers/Grain";
import {
  easeInOutCubic,
  microLife,
  punch,
  punchBlur,
  rotKick,
} from "./motion";
import { H, W } from "./theme";

// A camera instruction on the paper world. `at` is an ABSOLUTE frame.
// - cut:   instant snap to this framing (primary reframe grammar)
// - punch: 4-6f easeOutExpo zoom into this framing, 2% overshoot + blur + rot kick
// - glide: slow easeInOutCubic drift to this framing (max one per 15-20s)
export type Shot = {
  at: number;
  type?: "cut" | "punch" | "glide";
  scale?: number;
  x?: number; // world px shift (+ moves artwork right)
  y?: number;
  rot?: number;
  dur?: number; // punch/glide duration
};

type Framing = { scale: number; x: number; y: number; rot: number };
const base: Framing = { scale: 1, x: 0, y: 0, rot: 0 };
const framingOf = (s: Shot): Framing => ({
  scale: s.scale ?? 1,
  x: s.x ?? 0,
  y: s.y ?? 0,
  rot: s.rot ?? 0,
});
const lerpF = (a: Framing, b: Framing, t: number): Framing => ({
  scale: a.scale + (b.scale - a.scale) * t,
  x: a.x + (b.x - a.x) * t,
  y: a.y + (b.y - a.y) * t,
  rot: a.rot + (b.rot - a.rot) * t,
});

export const NewspaperScene: React.FC<{
  shots?: Shot[];
  children: React.ReactNode;
  grain?: number;
  paperCell?: number;
}> = ({ shots = [], children, grain = 0.08, paperCell = 96 }) => {
  const frame = useCurrentFrame();
  const sorted = [...shots].sort((a, b) => a.at - b.at);

  // active shot = last shot whose `at` <= frame
  let activeIdx = -1;
  for (let i = 0; i < sorted.length; i++) if (sorted[i].at <= frame) activeIdx = i;

  const prevFraming = activeIdx >= 1 ? framingOf(sorted[activeIdx - 1]) : base;
  const active = activeIdx >= 0 ? sorted[activeIdx] : undefined;
  const target = active ? framingOf(active) : base;

  let f: Framing = target;
  let blur = 0;
  let kick = 0;
  if (active) {
    const rel = frame - active.at;
    const type = active.type ?? "cut";
    if (type === "punch") {
      const dur = active.dur ?? 5;
      const p = Math.min(1.06, punch(frame, active.at, dur));
      f = lerpF(prevFraming, target, p);
      blur = punchBlur(frame, active.at, 12);
      kick = rotKick(frame, active.at, 0.5);
    } else if (type === "glide") {
      const dur = active.dur ?? 90;
      const t = easeInOutCubic(Math.min(1, rel / dur));
      f = lerpF(prevFraming, target, t);
    } else {
      // hard cut: a tiny 1-frame settle so the cut has weight, then locked
      f = target;
      blur = punchBlur(frame, active.at, 6);
    }
  }

  const ml = microLife(frame, 7); // global gate weave
  const transform = [
    `translate(${W / 2}px, ${H / 2}px)`,
    `translate(${f.x + ml.x}px, ${f.y + ml.y}px)`,
    `rotate(${f.rot + kick + ml.rot}deg)`,
    `scale(${f.scale})`,
    `translate(${-W / 2}px, ${-H / 2}px)`,
  ].join(" ");

  return (
    <AbsoluteFill style={{ backgroundColor: "#0b0a09", overflow: "hidden" }}>
      <AbsoluteFill
        style={{
          transform,
          transformOrigin: "0 0",
          filter: blur > 0.2 ? `blur(${blur}px)` : undefined,
          willChange: "transform",
        }}
      >
        <Paper cell={paperCell} />
        {children}
      </AbsoluteFill>
      <Grain amount={grain} />
    </AbsoluteFill>
  );
};
