import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { DetailInsert } from "../components/Shots";
import { Rough } from "../components/Rough";
import { Stamp } from "../components/Stamp";
import { HiWord } from "../components/Type";
import { FilmTexture } from "../layers/FilmTexture";
import { beatWords, ev, wordReveal } from "../timing";
import { FONT_HEAD, FONT_MONO, FONT_SERIF_BODY, INK, H, RED, W } from "../theme";
import { appear, easeOutExpo, slamIn } from "../motion";

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
        <DetailInsert src="assets/final/breadline.png" from={fHands} duration={40} focus="44% 80%" zoom={2.7} bright={1.4} />
        <FilmTexture intensity={0.6} scratches flicker seed={3} />
      </AbsoluteFill>
    );
  }

  // clean punch onto "1945": scale the document group around the date's spot
  const pz = tight ? 1 + 0.3 * easeOutExpo(Math.min(1, (frame - f1945) / 6)) : 1;
  const DW = W * 0.62;
  const DH = H * 0.68;

  const greek =
    "For services rendered to the United States in the World War, the bearer is entitled under the Act of 1924 to the sum herein certified, this certificate maturing and payable, with interest, upon the date set forth below.";

  return (
    <AbsoluteFill style={{ background: "radial-gradient(120% 100% at 50% 40%, #23201b 0%, #100e0b 80%)" }}>
      {/* the certificate document, centred, zoomed toward 1945 on the punch */}
      <div
        style={{
          position: "absolute",
          left: (W - DW) / 2,
          top: (H - DH) / 2,
          width: DW,
          height: DH,
          transformOrigin: "24% 78%",
          transform: `rotate(${-1.5 + (1 - s) * -2}deg) translateY(${(1 - s) * 50}px) scale(${pz})`,
          opacity: Math.min(1, s * 1.5),
          background: "linear-gradient(150deg,#f3ecd8,#e7dcc0)",
          border: `3px solid ${INK}`,
          outline: `10px solid #f3ecd8`,
          boxShadow: "0 30px 70px rgba(0,0,0,0.6)",
          padding: `${DH * 0.06}px ${DW * 0.06}px`,
          boxSizing: "border-box",
          filter: "contrast(1.02) sepia(0.1)",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div style={{ textAlign: "center", fontFamily: FONT_MONO, fontSize: DW * 0.017, letterSpacing: "0.36em", color: RED }}>UNITED STATES OF AMERICA</div>
        <div style={{ textAlign: "center", fontFamily: FONT_HEAD, fontWeight: 900, fontSize: DW * 0.058, color: INK, margin: `${DH * 0.02}px 0 ${DH * 0.015}px`, letterSpacing: "0.01em" }}>
          Adjusted Service Certificate
        </div>
        <div style={{ textAlign: "center", fontFamily: FONT_SERIF_BODY, fontSize: DW * 0.026, color: INK, opacity: 0.82, marginBottom: DH * 0.03 }}>
          The government{" "}
          <HiWord reveal={owed ? wordReveal(frame, owed.start, 2, 8) : 0} seed={7}>owed them a bonus</HiWord>{" "}
          for their service.
        </div>
        <div style={{ fontFamily: FONT_SERIF_BODY, fontSize: DW * 0.019, lineHeight: 1.5, color: INK, opacity: 0.62, textAlign: "justify", margin: `0 ${DW * 0.05}px`, flex: 1 }}>
          {greek}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", borderTop: `1px solid ${INK}55`, paddingTop: DH * 0.03, marginTop: DH * 0.02 }}>
          <div style={{ fontFamily: FONT_SERIF_BODY, fontSize: DW * 0.017, color: INK, letterSpacing: "0.06em" }}>
            PAYABLE ON DEMAND
            <div style={{ fontFamily: FONT_HEAD, fontWeight: 900, fontSize: DW * 0.09, color: INK, position: "relative", lineHeight: 1 }}>
              <span style={{ color: RED }}>1945</span>
              {tight && (
                <Rough shape="circle" at={f1945 + 4} x={-DW * 0.03} y={-DH * 0.03} w={DW * 0.2} h={DH * 0.2} color={RED} strokeWidth={8} drawFrames={10} />
              )}
            </div>
          </div>
          <div style={{ textAlign: "right", fontFamily: FONT_MONO, fontSize: DW * 0.02, color: INK }}>
            <div style={{ width: DW * 0.18, borderBottom: `1px solid ${INK}`, marginBottom: 6 }} />
            <div style={{ opacity: 0.7, fontSize: DW * 0.013 }}>ADMINISTRATOR</div>
            <div style={{ fontSize: DW * 0.032, marginTop: 8 }}>$1,000.00</div>
          </div>
        </div>
      </div>

      {tight && (
        <div style={{ position: "absolute", right: W * 0.1, top: H * 0.18, opacity: appear(frame, f1945 + 10, 4) }}>
          <Stamp at={f1945 + 10} rotate={-7} size={W * 0.026} color={RED}>13 YEARS AWAY</Stamp>
        </div>
      )}
      <FilmTexture intensity={0.5} scratches seed={3} />
    </AbsoluteFill>
  );
};
