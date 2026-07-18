import React from "react";
import { useCurrentFrame } from "remotion";
import { NewspaperScene, Shot } from "../NewspaperScene";
import { Dek, Headline, HiWord } from "../components/Type";
import { DateTag } from "../components/DateTag";
import { Stamp } from "../components/Stamp";
import { Masthead } from "../components/Masthead";
import { beatWords, ev, wordReveal } from "../timing";
import { H, MARGIN, RED, W } from "../theme";
import { appear } from "../motion";

export const Beat1: React.FC = () => {
  const frame = useCurrentFrame();
  const words = beatWords("b1");
  const wf = (t: string) => words.find((w) => w.text.replace(/[^a-zA-Z]/g, "") === t);

  const fGenerals = ev("b1.generals");
  const fAgainst = ev("b1.against");
  const generalsWord = wf("generals");
  const revealGenerals = generalsWord
    ? wordReveal(frame, generalsWord.start, 2, 6)
    : 0;

  const shots: Shot[] = [
    { at: ev("b1.start"), type: "cut", scale: 1.02, y: 0 },
    { at: fGenerals, type: "punch", scale: 1.16, x: 20, y: 60, dur: 5 },
    { at: fAgainst, type: "cut", scale: 1.1, x: 0, y: -40 },
  ];

  const showAgainst = frame >= fAgainst - 3;

  return (
    <NewspaperScene shots={shots}>
      {/* ---- c1: the setup headline ---- */}
      {!showAgainst && (
        <div
          style={{
            position: "absolute",
            left: MARGIN,
            top: H * 0.16,
            width: W - MARGIN * 2,
          }}
        >
          <DateTag at={ev("b1.start") + 4} size={48}>
            1932
          </DateTag>
          <Headline size={112} style={{ marginTop: 34 }}>
            America&rsquo;s three most famous{" "}
            <HiWord reveal={revealGenerals} seed={11}>
              generals
            </HiWord>{" "}
            fought their first battle&nbsp;together.
          </Headline>
          <Dek
            style={{
              marginTop: 44,
              maxWidth: W * 0.72,
              opacity: 1 - appear(frame, fGenerals, 3),
            }}
          >
            Washington, D.C. — the summer the Army was ordered against its own.
          </Dek>

          {/* three name stamps, 4 frames apart, as a tight overlapping cluster
              slapped over the copy on "generals" — too fast to catch */}
          <div
            style={{
              position: "absolute",
              left: W * 0.1,
              top: H * 0.435,
              width: W * 0.8,
              height: H * 0.14,
            }}
          >
            <Stamp at={fGenerals} rotate={-6} size={58} style={{ position: "absolute", left: 0, top: 0 }}>
              MACARTHUR
            </Stamp>
            <Stamp at={fGenerals + 4} rotate={4} size={58} style={{ position: "absolute", left: "42%", top: 40 }}>
              PATTON
            </Stamp>
            <Stamp at={fGenerals + 8} rotate={-2} size={58} style={{ position: "absolute", left: "8%", top: 96 }}>
              EISENHOWER
            </Stamp>
          </div>
        </div>
      )}

      {/* ---- c2: the dark turn ---- */}
      {showAgainst && (
        <div
          style={{
            position: "absolute",
            left: MARGIN,
            top: H * 0.3,
            width: W - MARGIN * 2,
          }}
        >
          <Headline size={150} weight={900} style={{ lineHeight: 0.98 }}>
            Against
            <br />
            American
            <br />
            <span style={{ color: RED }}>veterans.</span>
          </Headline>
          <Masthead style={{ marginTop: 80 }}>The Bonus Army · 1932</Masthead>
        </div>
      )}
    </NewspaperScene>
  );
};
