import React from "react";
import { useCurrentFrame } from "remotion";
import { NewspaperScene, Shot } from "../NewspaperScene";
import { Masthead } from "../components/Masthead";
import { Label, Scribble } from "../components/Graphics";
import { Rough } from "../components/Rough";
import { HiWord } from "../components/Type";
import { beatWords, ev, wordReveal } from "../timing";
import { FONT_HEAD, H, INK, MARGIN, W } from "../theme";
import { appear } from "../motion";

// "One newspaper headline said everything: 'Cavalry Major Evicts Veteran Who
//  Saved His Life in Battle.'" — word-by-word marker highlight + Patton scribble.
export const Beat11: React.FC = () => {
  const frame = useCurrentFrame();
  const quoteWords = beatWords("b11").filter((w) => w.chunk === "c2");
  const fHeadline = ev("b11.headline");
  const fQuote = ev("b11.quoteStart");
  const showQuote = frame >= fQuote - 6;

  const shots: Shot[] = [
    { at: ev("b11.start"), type: "cut", scale: 1.04 },
    { at: fQuote, type: "cut", scale: 1.0, y: 0 },
    { at: fQuote + 70, type: "punch", scale: 1.12, x: -60, y: 120, dur: 5 },
  ];

  return (
    <NewspaperScene shots={shots}>
      <div style={{ position: "absolute", left: MARGIN, top: H * 0.12, width: W - MARGIN * 2 }}>
        <Label at={ev("b11.start")} bar>
          The next morning&rsquo;s papers
        </Label>

        {!showQuote ? (
          <div
            style={{
              fontFamily: FONT_HEAD,
              fontWeight: 700,
              fontStyle: "italic",
              fontSize: 90,
              lineHeight: 1.05,
              color: INK,
              marginTop: 40,
            }}
          >
            One headline said everything&hellip;
          </div>
        ) : (
          <div style={{ marginTop: 30 }}>
            <div
              style={{
                fontFamily: FONT_HEAD,
                fontWeight: 800,
                fontSize: 78,
                lineHeight: 1.12,
                color: INK,
              }}
            >
              &ldquo;
              {quoteWords.map((w, i) => (
                <React.Fragment key={i}>
                  <HiWord reveal={wordReveal(frame, w.start, 2, 5)} seed={20 + i}>
                    {w.text.trim()}
                  </HiWord>{" "}
                </React.Fragment>
              ))}
              &rdquo;
            </div>
            <Masthead style={{ marginTop: 50 }}>The Washington Daily News</Masthead>

            {/* the reveal: the major was Patton */}
            <div style={{ position: "absolute", left: W * 0.06, top: H * 0.5 }}>
              <Scribble at={fQuote + 74} x={0} y={0} width={560} size={62} rotate={-4} underline>
                the major was Patton.
              </Scribble>
              <Rough
                shape="arrow"
                at={fQuote + 82}
                x={-40}
                y={-90}
                w={220}
                h={90}
                strokeWidth={6}
              />
            </div>
          </div>
        )}
      </div>
      {/* subtle vignette pull as the scribble lands */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "radial-gradient(60% 50% at 40% 60%, transparent, rgba(20,16,12,0.12))",
          opacity: appear(frame, fQuote + 70, 10),
        }}
      />
    </NewspaperScene>
  );
};
