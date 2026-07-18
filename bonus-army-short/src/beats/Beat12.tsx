import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { NewspaperScene, Shot } from "../NewspaperScene";
import { Headline, HiWord } from "../components/Type";
import { Label } from "../components/Graphics";
import { Cutout } from "../components/Cutout";
import { Masthead } from "../components/Masthead";
import { beatWords, ev, wordReveal } from "../timing";
import { FONT_HEAD, FONT_MONO, H, INK, MARGIN, RED, W } from "../theme";
import { appear } from "../motion";

// "Newsreel audiences booed their own army. And when Franklin Roosevelt read the
//  headlines, he reportedly said: 'I think I've just won the election.'"
export const Beat12: React.FC = () => {
  const frame = useCurrentFrame();
  const fBooed = ev("b12.booed");
  const fFdr = ev("b12.fdr");
  const fQuote = ev("b12.quote");
  const fWon = ev("b12.won");
  const won = beatWords("b12").find((w) => w.text.replace(/[^a-z]/gi, "") === "election");

  const stage =
    frame >= fQuote ? "quote" : frame >= fFdr ? "fdr" : "booed";

  const shots: Shot[] = [
    { at: ev("b12.start"), type: "cut", scale: 1.05 },
    { at: fFdr, type: "cut", scale: 1.0 },
    { at: fQuote, type: "cut", scale: 1.02, y: -20 },
    { at: fWon, type: "punch", scale: 1.08, dur: 5 },
  ];

  return (
    <NewspaperScene shots={shots}>
      {stage === "booed" && (
        <>
          {/* newsreel frame flicker */}
          <AbsoluteFill style={{ opacity: 0.14 }}>
            <div
              style={{
                position: "absolute",
                inset: "18% 8%",
                border: `4px solid ${INK}`,
              }}
            />
          </AbsoluteFill>
          <div style={{ position: "absolute", left: MARGIN, top: H * 0.24, width: W - MARGIN * 2 }}>
            <Label at={ev("b12.start")} bar mono>
              IN THE NEWSREELS
            </Label>
            <Headline size={120} style={{ marginTop: 24 }}>
              Audiences{" "}
              <span style={{ color: RED }}>booed</span> their own army.
            </Headline>
          </div>
        </>
      )}

      {stage === "fdr" && (
        <>
          <div style={{ position: "absolute", left: MARGIN, top: H * 0.12, width: W * 0.62 }}>
            <Headline size={96}>
              Franklin Roosevelt read the headlines.
            </Headline>
          </div>
          <Cutout
            src="assets/treated/fdr.png"
            at={fFdr}
            x={W * 0.4}
            y={H * 0.4}
            width={W * 0.62}
            offset={13}
            seed={3}
          />
        </>
      )}

      {stage === "quote" && (
        <div style={{ position: "absolute", left: MARGIN, top: H * 0.24, width: W - MARGIN * 2 }}>
          <div style={{ fontFamily: FONT_MONO, fontSize: 28, color: RED, letterSpacing: "0.16em" }}>
            F.D.R., REPORTEDLY
          </div>
          <Headline size={112} italic style={{ marginTop: 24, lineHeight: 1.06 }}>
            &ldquo;I think I&rsquo;ve just{" "}
            <HiWord reveal={won ? wordReveal(frame, won.start, 2, 6) : 0} seed={30}>
              won
            </HiWord>{" "}
            the election.&rdquo;
          </Headline>
          {/* loop tag: a masthead landing that echoes the open */}
          <div style={{ marginTop: 90, opacity: appear(frame, fWon + 10, 8) }}>
            <Masthead>The Bonus Army · 1932</Masthead>
          </div>
        </div>
      )}
    </NewspaperScene>
  );
};
