import React from "react";
import { AbsoluteFill } from "remotion";
import { NewspaperPage } from "../components/NewspaperPage";
import { H, W } from "../theme";

// The shared B1 opening composition, rendered statically (no micro-life) so B12
// can loop back onto the SAME pixels. Used by B1 at frame 0 and B12's reveal.
export const OPEN_PAGE_W = W * 0.62;
const PAGE_H = OPEN_PAGE_W * 1.34;
const ANCHOR = { ax: 0.5, ay: 0.315 };
const ANCHOR_SCALE = 2.4 * 0.82; // TextMatchCut kStart
const SCREEN = { sx: W / 2, sy: H * 0.46 };
const A0 = { ax: ANCHOR.ax - 0.06, ay: ANCHOR.ay + 0.02 };

export const openTransform = (): string => {
  const k = ANCHOR_SCALE;
  const ox = SCREEN.sx - k * A0.ax * OPEN_PAGE_W;
  const oy = SCREEN.sy - k * A0.ay * PAGE_H;
  return `translate(${ox}px, ${oy}px) scale(${k})`;
};

export const WaPoPageA: React.FC<{ highlight?: number }> = ({ highlight = 0 }) => (
  <NewspaperPage
    masthead="The Washington Post"
    date="FRIDAY, JULY 29, 1932"
    width={OPEN_PAGE_W}
    seed={11}
    reveal={(w) =>
      ["TROOPS", "ROUT", "THE", "BONUS"].includes(w.replace(/[^A-Z]/g, "")) ? highlight : 0
    }
    decks={[
      { text: "ONE SLAIN, 60 HURT AS", size: OPEN_PAGE_W * 0.052 },
      { text: "TROOPS ROUT THE BONUS", size: OPEN_PAGE_W * 0.066 },
      { text: "ARMY", size: OPEN_PAGE_W * 0.2, anchor: "ARMY" },
    ]}
  />
);

// Static snapshot of B1 frame 0 (page A at the opening framing, no micro-life).
export const OpenFrame: React.FC<{ highlight?: number }> = ({ highlight = 0 }) => (
  <AbsoluteFill style={{ overflow: "hidden", background: "#0b0a09" }}>
    <div style={{ position: "absolute", transformOrigin: "0 0", transform: openTransform(), width: OPEN_PAGE_W }}>
      <WaPoPageA highlight={highlight} />
    </div>
  </AbsoluteFill>
);
