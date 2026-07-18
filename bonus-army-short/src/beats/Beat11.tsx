import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { NewspaperPage } from "../components/NewspaperPage";
import { Scribble } from "../components/Graphics";
import { Rough } from "../components/Rough";
import { FilmTexture } from "../layers/FilmTexture";
import { beatWords, ev, wordReveal } from "../timing";
import { easeOutExpo, microLife } from "../motion";
import { H, W } from "../theme";

// B11 THE HEADLINE: the recreated page in reference motion, word-by-word marker
// highlight tracking the VO exactly; red scribble "the major was Patton."
const PAGE_W = W * 0.66;
const PAGE_H = PAGE_W * 1.34;

export const Beat11: React.FC = () => {
  const frame = useCurrentFrame();
  const quoteWords = beatWords("b11").filter((w) => w.chunk === "c2");
  const fStart = ev("b11.start");
  const fQuote = ev("b11.quoteStart");
  const ml = microLife(frame, 4);

  // map each headline word to its VO word time
  const revealFor = (w: string, idx: number): number => {
    const clean = w.replace(/[^A-Za-z]/g, "").toLowerCase();
    const match = quoteWords.find((q) => q.text.replace(/[^A-Za-z]/g, "").toLowerCase() === clean);
    return match ? wordReveal(frame, match.start, 2, 5) : 0;
  };

  // slow reference drift + a punch on "Saved His Life"
  const punchT = easeOutExpo(Math.max(0, Math.min(1, (frame - (fQuote + 40)) / 6)));
  const scale = 1.0 + 0.12 * punchT;
  const ty = -H * 0.05 * punchT;

  return (
    <AbsoluteFill style={{ background: "#0b0a09", overflow: "hidden" }}>
      <div
        style={{
          position: "absolute",
          left: (W - PAGE_W) / 2,
          top: (H - PAGE_H) / 2 - H * 0.02,
          transform: `translate(${ml.x}px, ${ty + ml.y}px) scale(${scale}) rotate(${ml.rot * 0.25}deg)`,
          transformOrigin: "50% 35%",
        }}
      >
        <NewspaperPage
          masthead="The Washington Daily News"
          date="FRIDAY, JULY 29, 1932"
          width={PAGE_W}
          seed={29}
          columns={4}
          reveal={frame >= fQuote ? revealFor : undefined}
          decks={[
            { text: "Cavalry Major Evicts Veteran", size: PAGE_W * 0.062 },
            { text: "Who Saved His Life in Battle", size: PAGE_W * 0.062 },
          ]}
        />
        {/* the reveal: the major was Patton */}
        <div style={{ position: "absolute", left: PAGE_W * 0.1, top: PAGE_H * 0.42 }}>
          <Rough shape="arrow" at={fQuote + 60} x={PAGE_W * 0.04} y={-PAGE_W * 0.12} w={PAGE_W * 0.2} h={PAGE_W * 0.12} strokeWidth={6} />
          <Scribble at={fQuote + 66} x={0} y={0} width={PAGE_W * 0.55} size={PAGE_W * 0.06} rotate={-4} underline>
            the major was Patton.
          </Scribble>
        </div>
      </div>
      <FilmTexture intensity={0.5} scratches seed={11} />
    </AbsoluteFill>
  );
};
