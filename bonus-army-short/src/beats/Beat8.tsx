import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { FullBleed, MultiPanel } from "../components/Shots";
import { FilmTexture } from "../layers/FilmTexture";
import { ev } from "../timing";
import { FONT_BODY, H, MARGIN, RED, W } from "../theme";
import { appear } from "../motion";

// B8 THE ATTACK: fastest cutting, one cut per phrase. cavalry full-bleed ->
// multi-panel (sabers/bayonets/tank) side-by-side with red stamps -> tank
// full-bleed -> Pennsylvania Avenue wide. Flash frames between cuts.
export const Beat8: React.FC = () => {
  const frame = useCurrentFrame();
  const fSab = ev("b8.sabers");
  const fBay = ev("b8.bayonets");
  const fTank = ev("b8.tanks");
  const fAve = ev("b8.avenue");
  const stage = frame >= fAve ? "avenue" : frame >= fTank ? "tanks" : frame >= fBay ? "bayonets" : "sabers";

  const kicker = (t: string, at: number) => (
    <div style={{ position: "absolute", left: MARGIN, top: H * 0.08, fontFamily: FONT_BODY, fontWeight: 800, fontSize: W * 0.02, letterSpacing: "0.2em", color: RED, opacity: appear(frame, at, 2), textShadow: "0 2px 8px rgba(0,0,0,0.6)" }}>{t}</div>
  );

  return (
    <AbsoluteFill style={{ background: "#000" }}>
      {stage === "sabers" && (
        <>
          <FullBleed src="assets/final/bonus_march.png" from={fSab} duration={26} zoomFrom={1.08} zoomTo={1.14} objectPosition="center 35%" />
          {kicker("CAVALRY · DRAWN SABERS", fSab)}
        </>
      )}
      {stage === "bayonets" && (
        <MultiPanel
          from={fBay}
          stagger={6}
          panels={[
            { src: "assets/final/bonus_march.png", label: "INFANTRY", focus: "40% 40%" },
            { src: "assets/final/patton.png", label: "TANKS", focus: "55% 55%" },
            { src: "assets/final/bonus_burning.png", label: "THE CAMP", focus: "center" },
          ]}
        />
      )}
      {stage === "tanks" && (
        <>
          <FullBleed src="assets/final/patton.png" from={fTank} duration={22} zoomFrom={1.06} zoomTo={1.12} objectPosition="center 55%" />
          {kicker("SIX TANKS", fTank)}
        </>
      )}
      {stage === "avenue" && (
        <>
          <FullBleed src="assets/final/veterans_crowd.png" from={fAve} duration={40} zoomFrom={1.05} zoomTo={1.12} objectPosition="center 70%" />
          {kicker("DOWN PENNSYLVANIA AVENUE · JULY 28, 1932", fAve)}
        </>
      )}
      <FilmTexture intensity={0.9} scratches flicker flashFrames={[fSab, fBay, fTank, fAve]} seed={8} />
    </AbsoluteFill>
  );
};
