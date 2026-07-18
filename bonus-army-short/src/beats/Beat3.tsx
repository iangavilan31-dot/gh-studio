import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { NewspaperScene, Shot } from "../NewspaperScene";
import { DetailInsert } from "../components/Shots";
import { Rough } from "../components/Rough";
import { Stamp } from "../components/Stamp";
import { HiWord } from "../components/Type";
import { FilmTexture } from "../layers/FilmTexture";
import { beatWords, ev, wordReveal } from "../timing";
import { FONT_HEAD, FONT_MONO, FONT_SERIF_BODY, INK, H, RED, W } from "../theme";
import { appear, slamIn } from "../motion";

// B3: recreated Adjusted Service Certificate slams onto desk-paper, highlight
// tracks "owed them a bonus"; detail insert of weathered hands; hard cut tight
// on the date, red circle + torn tag "13 YEARS AWAY".
export const Beat3: React.FC = () => {
  const frame = useCurrentFrame();
  const words = beatWords("b3");
  const owed = words.find((w) => w.text.replace(/[^a-z]/gi, "") === "owed");
  const fPay = ev("b3.payable");
  const f1945 = ev("b3.date1945");
  const fHands = ev("b3.start") + 34;
  const showInsert = frame >= fHands && frame < fPay - 2;
  const tight = frame >= f1945 - 4;

  const s = slamIn(frame, ev("b3.start"), 6);
  const certW = tight ? W * 0.9 : W * 0.66;

  if (showInsert) {
    return (
      <AbsoluteFill style={{ background: "#000" }}>
        <DetailInsert src="assets/final/breadline.png" from={fHands} duration={40} focus="42% 72%" zoom={3.0} />
        <FilmTexture intensity={0.6} scratches flicker seed={3} />
      </AbsoluteFill>
    );
  }

  const shots: Shot[] = [
    { at: ev("b3.start"), type: "cut", scale: 1.02 },
    { at: f1945, type: "punch", scale: 1.5, x: W * 0.02, y: -H * 0.06, dur: 5 },
  ];

  return (
    <NewspaperScene shots={shots} paperCell={120} grain={0}>
      <div
        style={{
          position: "absolute",
          left: (W - certW) / 2,
          top: H * 0.14,
          width: certW,
          transform: `rotate(${-1.4 + (1 - s) * -3}deg) translateY(${(1 - s) * 60}px)`,
          opacity: Math.min(1, s * 1.5),
          background: "#efe7d2",
          border: `10px double ${INK}`,
          boxShadow: "0 26px 50px rgba(20,16,12,0.4)",
          padding: "34px 46px 40px",
          filter: "contrast(1.02) sepia(0.08)",
        }}
      >
        <div style={{ textAlign: "center", fontFamily: FONT_MONO, fontSize: W * 0.013, letterSpacing: "0.34em", color: RED }}>UNITED STATES OF AMERICA</div>
        <div style={{ textAlign: "center", fontFamily: FONT_HEAD, fontWeight: 900, fontSize: W * 0.032, color: INK, margin: "10px 0 6px", letterSpacing: "0.02em" }}>
          Adjusted Service Certificate
        </div>
        <div style={{ textAlign: "center", fontFamily: FONT_SERIF_BODY, fontSize: W * 0.015, color: INK, opacity: 0.75, marginBottom: 22 }}>
          The government{" "}
          <HiWord reveal={owed ? wordReveal(frame, owed.start, 2, 8) : 0} seed={7}>owed them a bonus</HiWord>{" "}
          for their service —
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", borderTop: `1px solid ${INK}55`, paddingTop: 18 }}>
          <div style={{ fontFamily: FONT_SERIF_BODY, fontSize: W * 0.012, color: INK }}>
            PAYABLE ON DEMAND
            <div style={{ fontFamily: FONT_HEAD, fontWeight: 900, fontSize: W * 0.05, color: INK, position: "relative" }}>
              <span style={{ color: RED }}>1945</span>
              {tight && (
                <Rough shape="circle" at={f1945 + 4} x={-W * 0.02} y={-H * 0.02} w={W * 0.13} h={H * 0.11} color={RED} strokeWidth={9} drawFrames={10} />
              )}
            </div>
          </div>
          <div style={{ fontFamily: FONT_MONO, fontSize: W * 0.02, color: INK, opacity: 0.8 }}>$1,000.00</div>
        </div>
      </div>

      {tight && (
        <div style={{ position: "absolute", left: W * 0.58, top: H * 0.62, opacity: appear(frame, f1945 + 10, 4) }}>
          <Stamp at={f1945 + 10} rotate={-7} size={W * 0.022} color={RED}>13 YEARS AWAY</Stamp>
        </div>
      )}
      <FilmTexture intensity={0.45} scratches seed={3} />
    </NewspaperScene>
  );
};
