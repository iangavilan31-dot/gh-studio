import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { NewspaperScene, Shot } from "../NewspaperScene";
import { Headline } from "../components/Type";
import { Label } from "../components/Graphics";
import { Cutout } from "../components/Cutout";
import { ev } from "../timing";
import { FONT_HEAD, H, INK, MARGIN, RED, W } from "../theme";
import { slamIn } from "../motion";

// "Then President Hoover sent in the actual United States Army."
// The music CUTS DEAD on "Army": 2 frames of black, then the word slams up.
export const Beat7: React.FC = () => {
  const frame = useCurrentFrame();
  const fHoover = ev("b7.hoover");
  const fArmy = ev("b7.armyCut");
  const rel = frame - fArmy;

  // 2 frames of near-black at the cut, then the reveal
  if (rel >= 0 && rel < 2) {
    return <AbsoluteFill style={{ background: "#0b0908" }} />;
  }

  if (rel >= 2) {
    const s = slamIn(frame, fArmy + 2, 6);
    return (
      <AbsoluteFill style={{ background: "#0b0908", overflow: "hidden" }}>
        <div
          style={{
            position: "absolute",
            left: MARGIN,
            top: H * 0.3,
            opacity: Math.min(1, s * 1.6),
            transform: `translateY(${(1 - s) * 40}px)`,
          }}
        >
          <div style={{ fontFamily: FONT_HEAD, fontWeight: 700, fontSize: 60, color: "#F3EEE3" }}>
            the actual
          </div>
          <div
            style={{
              fontFamily: FONT_HEAD,
              fontWeight: 900,
              fontSize: 260,
              lineHeight: 0.9,
              color: RED,
              letterSpacing: "-0.02em",
            }}
          >
            U.S.
            <br />
            ARMY.
          </div>
        </div>
      </AbsoluteFill>
    );
  }

  // before the cut: Hoover orders it
  const shots: Shot[] = [
    { at: ev("b7.start"), type: "cut", scale: 1.03 },
    { at: fHoover, type: "punch", scale: 1.1, x: -80, y: 40, dur: 5 },
  ];
  return (
    <NewspaperScene shots={shots}>
      <div style={{ position: "absolute", left: MARGIN, top: H * 0.14, width: W * 0.66 }}>
        <Label at={ev("b7.start")} bar color={INK}>
          The order
        </Label>
        <Headline size={104} style={{ marginTop: 24 }}>
          President Hoover sent in&hellip;
        </Headline>
      </div>
      <Cutout
        src="assets/treated/hoover.png"
        at={fHoover}
        x={W * 0.4}
        y={H * 0.42}
        width={W * 0.6}
        offset={13}
        seed={6}
      />
    </NewspaperScene>
  );
};
