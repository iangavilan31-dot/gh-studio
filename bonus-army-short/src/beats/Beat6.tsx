import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { NewspaperPage } from "../components/NewspaperPage";
import { Rough } from "../components/Rough";
import { FilmTexture } from "../layers/FilmTexture";
import { beatWords, ev, wordReveal } from "../timing";
import { easeOutExpo, microLife } from "../motion";
import { FONT_HEAD, H, INK, RED, W } from "../theme";

// B6: Senate-defeat front page (reference motion), highlight sweeps the headline;
// hard cut tight, 62-18 circled in red ON the page (no card).
const PAGE_W = W * 0.6;
const PAGE_H = PAGE_W * 1.34;

export const Beat6: React.FC = () => {
  const frame = useCurrentFrame();
  const words = beatWords("b6");
  const fStart = ev("b6.start");
  const fSenate = ev("b6.senate");
  const fCard = ev("b6.voteCard");
  const hi = (w: string) =>
    ["SENATE", "KILLS", "BONUS", "BILL"].includes(w.replace(/[^A-Z]/g, ""))
      ? wordReveal(frame, fSenate, 2, 8)
      : 0;
  const tight = frame >= fCard - 2;
  const ml = microLife(frame, 4);

  // camera: wide -> headline -> tally (hard reframes), then punch on the tally
  const t = tight ? easeOutExpo(Math.min(1, (frame - fCard) / 5)) : 0;
  const scale = tight ? 1.4 + 0.06 * t : frame >= fSenate ? 1.08 : 0.95;
  const ty = tight ? H * 0.12 : frame >= fSenate ? -H * 0.02 : 0;

  return (
    <AbsoluteFill style={{ background: "#0b0a09", overflow: "hidden" }}>
      <div
        style={{
          position: "absolute",
          left: (W - PAGE_W) / 2,
          top: (H - PAGE_H) / 2,
          transform: `translate(${ml.x}px, ${ty + ml.y}px) scale(${scale}) rotate(${ml.rot * 0.3}deg)`,
          transformOrigin: "50% 30%",
        }}
      >
        <NewspaperPage
          masthead="The Evening Star"
          date="SATURDAY, JUNE 18, 1932"
          width={PAGE_W}
          seed={17}
          reveal={(w) => hi(w)}
          decks={[
            { text: "SENATE KILLS BONUS BILL", size: PAGE_W * 0.07 },
            { text: "AS VETERANS WAIT AT CAPITOL", size: PAGE_W * 0.042 },
          ]}
        />
        {/* 62-18 circled ON the page */}
        <div style={{ position: "absolute", left: PAGE_W * 0.18, top: PAGE_H * 0.5, display: "flex", alignItems: "flex-end", gap: PAGE_W * 0.06 }}>
          <div style={{ position: "relative", opacity: tight ? 1 : 0 }}>
            <div style={{ fontFamily: FONT_HEAD, fontWeight: 900, fontSize: PAGE_W * 0.24, color: RED, lineHeight: 0.85 }}>62</div>
            {tight && <Rough shape="circle" at={fCard + 2} x={-PAGE_W * 0.04} y={-PAGE_W * 0.03} w={PAGE_W * 0.28} h={PAGE_W * 0.3} color={RED} strokeWidth={9} drawFrames={9} />}
            <div style={{ fontFamily: FONT_HEAD, fontSize: PAGE_W * 0.03, color: INK, textAlign: "center" }}>NAY</div>
          </div>
          <div style={{ fontFamily: FONT_HEAD, fontSize: PAGE_W * 0.1, color: INK, opacity: 0.4, paddingBottom: PAGE_W * 0.05 }}>&ndash;</div>
          <div style={{ opacity: tight ? 1 : 0 }}>
            <div style={{ fontFamily: FONT_HEAD, fontWeight: 900, fontSize: PAGE_W * 0.15, color: INK, lineHeight: 0.85 }}>18</div>
            <div style={{ fontFamily: FONT_HEAD, fontSize: PAGE_W * 0.024, color: INK, textAlign: "center" }}>YEA</div>
          </div>
        </div>
      </div>
      <FilmTexture intensity={0.5} scratches seed={6} />
    </AbsoluteFill>
  );
};
