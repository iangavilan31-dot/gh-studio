import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { FullBleed, RipReveal } from "../components/Shots";
import { Cutout } from "../components/Cutout";
import { Stamp } from "../components/Stamp";
import { FilmTexture } from "../layers/FilmTexture";
import { OpenFrame } from "./openFrame";
import { ev, TOTAL_FRAMES } from "../timing";
import { FONT_HEAD, H, MARGIN, RED, W } from "../theme";
import { appear } from "../motion";

// B12 PAYOFF + LOOP: theater interior (screen-glow flicker) -> FDR cutout stamps
// in -> on "headlines" a fresh paper rips through the frame and lands on B1's
// exact opening composition. End == beginning.
export const Beat12: React.FC = () => {
  const frame = useCurrentFrame();
  const fStart = ev("b12.start");
  const fFdr = ev("b12.fdr");
  const fHeadlines = ev("b12.headlines");
  const fWon = ev("b12.won");
  const ripAt = fHeadlines;

  return (
    <AbsoluteFill style={{ background: "#000" }}>
      {/* theater interior with screen-glow flicker */}
      <FullBleed src="assets/final/theater_1930s.png" from={fStart} duration={90} dir={1} zoomFrom={1.05} zoomTo={1.1} objectPosition="center 40%" />
      <div style={{ position: "absolute", left: MARGIN, top: H * 0.1, fontFamily: FONT_HEAD, fontWeight: 700, fontStyle: "italic", fontSize: W * 0.026, color: "#efe7d6", textShadow: "0 2px 12px #000", opacity: appear(frame, fStart + 6, 4) }}>
        Newsreel audiences <span style={{ color: RED }}>booed</span> their own army.
      </div>

      {/* FDR cutout stamps in */}
      {frame >= fFdr && frame < ripAt && (
        <>
          <Cutout src="assets/final/fdr.png" at={fFdr} x={W * 0.56} y={H * 0.2} width={W * 0.4} offset={13} seed={3} fromBelow={70} />
          <div style={{ position: "absolute", left: W * 0.58, top: H * 0.78, opacity: appear(frame, fFdr + 4, 4) }}>
            <Stamp at={fFdr + 4} rotate={-4} size={W * 0.018}>F.D.R. · 1932</Stamp>
          </div>
        </>
      )}

      {/* the quote, then rip-reveal into the loop frame */}
      {frame >= fWon && frame < ripAt && (
        <div style={{ position: "absolute", left: MARGIN, bottom: H * 0.14, maxWidth: W * 0.5, opacity: appear(frame, fWon, 4) }}>
          <div style={{ fontFamily: FONT_HEAD, fontStyle: "italic", fontSize: W * 0.03, color: "#f2ead8", textShadow: "0 2px 12px #000" }}>
            &ldquo;I think I&rsquo;ve just <span style={{ color: RED }}>won</span> the election.&rdquo;
          </div>
        </div>
      )}

      {frame >= ripAt && (
        <RipReveal at={ripAt} duration={14}>
          <OpenFrame highlight={0} />
        </RipReveal>
      )}

      {/* hold the loop frame clean at the very end (== B1 frame 0) */}
      {frame >= TOTAL_FRAMES - 2 && <OpenFrame highlight={0} />}

      <FilmTexture intensity={0.55} scratches flicker seed={12} />
    </AbsoluteFill>
  );
};
