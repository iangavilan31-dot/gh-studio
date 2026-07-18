import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { Spotlight } from "../components/Shots";
import { Stamp } from "../components/Stamp";
import { FilmTexture } from "../layers/FilmTexture";
import { ev } from "../timing";
import { FONT_HEAD, H, INK, MARGIN, RED, W } from "../theme";
import { appear } from "../motion";

// B10 THE COST: single near-still portrait, spotlight vignette, red torn tag.
// Stillness is the point after the assault. Micro-life only.
export const Beat10: React.FC = () => {
  const frame = useCurrentFrame();
  const fStart = ev("b10.start");
  const fInfant = ev("b10.infant");
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      <Spotlight src="assets/final/camp_life.png" from={fStart} duration={130} focus="50% 26%" spot={{ x: 48, y: 34 }} bright={1.2} push={0.035} />
      <div style={{ position: "absolute", left: MARGIN, top: H * 0.12, opacity: appear(frame, fStart + 8, 8) }}>
        <Stamp at={fStart + 8} rotate={-4} size={W * 0.02} color={RED}>JULY 28, 1932</Stamp>
      </div>
      <div style={{ position: "absolute", left: MARGIN, bottom: H * 0.12, maxWidth: W * 0.42, opacity: appear(frame, fStart + 14, 10) }}>
        <div style={{ fontFamily: FONT_HEAD, fontWeight: 700, fontSize: W * 0.028, color: "#efe7d6", textShadow: "0 2px 12px #000" }}>
          <span style={{ color: RED, marginRight: 12 }}>&#8224;</span>William Hushka
        </div>
        <div style={{ fontFamily: FONT_HEAD, fontWeight: 700, fontSize: W * 0.028, color: "#efe7d6", textShadow: "0 2px 12px #000", marginTop: 6 }}>
          <span style={{ color: RED, marginRight: 12 }}>&#8224;</span>Eric Carlson
        </div>
      </div>
      {frame >= fInfant && (
        <div style={{ position: "absolute", right: MARGIN, bottom: H * 0.14, maxWidth: W * 0.32, textAlign: "right", opacity: appear(frame, fInfant, 12) }}>
          <div style={{ fontFamily: FONT_HEAD, fontStyle: "italic", fontSize: W * 0.02, lineHeight: 1.3, color: "#e6ddcb", textShadow: "0 2px 12px #000" }}>
            &hellip;and an infant, reports said, died from the gas.
          </div>
        </div>
      )}
      <FilmTexture intensity={0.55} scratches seed={10} />
    </AbsoluteFill>
  );
};
