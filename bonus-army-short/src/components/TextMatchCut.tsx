import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { easeInOutCubic, easeOutExpo, microLife } from "../motion";
import { H, W } from "../theme";

// The text match cut: page A drifts, then over `landFrames` glides so its anchor
// word sits at the screen anchor; HARD CUT to page B whose anchor word is at the
// SAME screen point (font mismatch = good); page B then relaxes back over
// `pullback` frames to reveal its context. 1-frame paper-white flash on the cut.
// Anchor positions are normalized page coords (from layout, not fragile OCR).
type Anchor = { ax: number; ay: number };

export const TextMatchCut: React.FC<{
  pageA: React.ReactNode;
  pageB: React.ReactNode;
  pageW: number;
  pageH: number;
  anchorA: Anchor;
  anchorB: Anchor;
  from: number; // beat/scene start (absolute)
  cutFrame: number; // absolute cut frame
  landFrames?: number; // glide-in on page A before the cut
  pullback?: number; // page B relax-out
  anchorScale?: number; // scale so the anchor word is large at the cut
  screen?: { sx: number; sy: number };
  flash?: boolean;
}> = ({
  pageA,
  pageB,
  pageW,
  pageH,
  anchorA,
  anchorB,
  from,
  cutFrame,
  landFrames = 8,
  pullback = 24,
  anchorScale = 2.6,
  screen = { sx: W / 2, sy: H / 2 },
  flash = true,
}) => {
  const frame = useCurrentFrame();
  const ml = microLife(frame, 4);

  // place normalized page point (ax,ay) at screen (sx,sy) with scale k
  const place = (a: Anchor, k: number) => {
    const ox = screen.sx - k * a.ax * pageW + ml.x;
    const oy = screen.sy - k * a.ay * pageH + ml.y;
    return `translate(${ox}px, ${oy}px) scale(${k}) rotate(${ml.rot * 0.3}deg)`;
  };

  const before = frame < cutFrame;

  if (before) {
    // page A: reference drift, then glide the anchor to the screen point
    const t = easeOutExpo(
      Math.max(0, Math.min(1, (frame - (cutFrame - landFrames)) / landFrames))
    );
    // start slightly off-anchor (wider) and land on anchor
    const kStart = anchorScale * 0.82;
    const k = kStart + (anchorScale - kStart) * t;
    const aStart: Anchor = { ax: anchorA.ax - 0.06, ay: anchorA.ay + 0.02 };
    const a: Anchor = {
      ax: aStart.ax + (anchorA.ax - aStart.ax) * t,
      ay: aStart.ay + (anchorA.ay - aStart.ay) * t,
    };
    return (
      <AbsoluteFill style={{ overflow: "hidden", background: "#0b0a09" }}>
        <div style={{ position: "absolute", transformOrigin: "0 0", transform: place(a, k), width: pageW }}>
          {pageA}
        </div>
      </AbsoluteFill>
    );
  }

  // page B: start at anchor-locked framing, relax back to natural full-frame
  const t = easeInOutCubic(Math.max(0, Math.min(1, (frame - cutFrame) / pullback)));
  const naturalScale = Math.min((W * 0.92) / pageW, (H * 0.96) / pageH);
  const k = anchorScale + (naturalScale - anchorScale) * t;
  const natCenter: Anchor = { ax: 0.5, ay: 0.5 };
  const a: Anchor = {
    ax: anchorB.ax + (natCenter.ax - anchorB.ax) * t,
    ay: anchorB.ay + (natCenter.ay - anchorB.ay) * t,
  };
  const screenNow = {
    sx: screen.sx + (W / 2 - screen.sx) * t,
    sy: screen.sy + (H / 2 - screen.sy) * t,
  };
  const ox = screenNow.sx - k * a.ax * pageW + ml.x;
  const oy = screenNow.sy - k * a.ay * pageH + ml.y;
  const showFlash = flash && frame === cutFrame;
  return (
    <AbsoluteFill style={{ overflow: "hidden", background: "#0b0a09" }}>
      <div
        style={{
          position: "absolute",
          transformOrigin: "0 0",
          transform: `translate(${ox}px, ${oy}px) scale(${k}) rotate(${ml.rot * 0.3}deg)`,
          width: pageW,
        }}
      >
        {pageB}
      </div>
      {showFlash && <AbsoluteFill style={{ background: "#fdf7ea" }} />}
    </AbsoluteFill>
  );
};
