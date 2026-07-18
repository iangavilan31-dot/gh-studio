import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { ParallaxPhoto } from "../components/ParallaxPhoto";
import { NewspaperPage } from "../components/NewspaperPage";
import { TextMatchCut } from "../components/TextMatchCut";
import { Cutout } from "../components/Cutout";
import { Stamp } from "../components/Stamp";
import { FilmTexture } from "../layers/FilmTexture";
import { WaPoPageA, OPEN_PAGE_W } from "./openFrame";
import { beatWords, ev, wordReveal } from "../timing";
import { H, W } from "../theme";
import { appear } from "../motion";

// B1 HOOK + TEXT MATCH CUT. Two recreated 1932 front pages sharing the word
// ARMY at the same anchor; hard cut on it, page B relaxes to reveal context;
// generals cutouts stamp across the lower third; hard cut to a 2.5D parallax of
// the veterans crowd on "Against".
const PAGE_W = OPEN_PAGE_W;
const PAGE_H = PAGE_W * 1.34;
const ANCHOR = { ax: 0.5, ay: 0.315 };

export const Beat1: React.FC = () => {
  const frame = useCurrentFrame();
  const words = beatWords("b1");
  const generalsW = words.find((w) => w.text.replace(/[^a-z]/gi, "") === "generals");
  const fStart = ev("b1.start");
  const fGenerals = ev("b1.generals");
  const fAgainst = ev("b1.against");
  const cutFrame = fStart + 26; // the match cut, early in the beat

  const pageA = (
    <WaPoPageA highlight={frame < cutFrame ? wordReveal(frame, fStart + 6, 2, 10) : 0} />
  );
  const pageB = (
    <NewspaperPage
      masthead="The Evening Star"
      date="WASHINGTON — JULY 29, 1932"
      width={PAGE_W}
      seed={23}
      decks={[
        { text: "U.S. FORCES EVICT VETERANS;", size: PAGE_W * 0.05 },
        { text: "CAPITAL CLEARED BY THE", size: PAGE_W * 0.062 },
        { text: "ARMY", size: PAGE_W * 0.2, anchor: "ARMY" },
      ]}
    />
  );

  const showCrowd = frame >= fAgainst - 2;

  return (
    <AbsoluteFill style={{ background: "#0b0a09" }}>
      {!showCrowd ? (
        <TextMatchCut
          pageA={pageA}
          pageB={pageB}
          pageW={PAGE_W}
          pageH={PAGE_H}
          anchorA={ANCHOR}
          anchorB={ANCHOR}
          from={fStart}
          cutFrame={cutFrame}
          landFrames={8}
          pullback={26}
          anchorScale={2.4}
          screen={{ sx: W / 2, sy: H * 0.46 }}
        />
      ) : (
        <ParallaxPhoto mode="strip" src="assets/final/veterans_crowd.png" from={fAgainst} duration={70} dir={1} stripTop={0.5} objectPosition="center 30%" />
      )}

      {/* generals cutouts stamp across the lower third (widescreen spread) */}
      {frame >= fGenerals && frame < fAgainst && (
        <AbsoluteFill>
          {[
            { src: "macarthur", label: "MACARTHUR", x: 0.03, off: 0 },
            { src: "patton", label: "PATTON", x: 0.37, off: 4 },
            { src: "eisenhower", label: "EISENHOWER", x: 0.7, off: 8 },
          ].map((g) => (
            <div key={g.src} style={{ opacity: appear(frame, fGenerals + g.off, 2) }}>
              <Cutout src={`assets/final/${g.src}.png`} at={fGenerals + g.off} x={W * g.x} y={H * 0.42} width={W * 0.26} offset={11} seed={g.off + 2} fromBelow={70} />
              <div style={{ position: "absolute", left: W * (g.x + 0.09), top: H * 0.9 }}>
                <Stamp at={fGenerals + g.off + 1} rotate={g.off % 8 ? 3 : -4} size={W * 0.02}>{g.label}</Stamp>
              </div>
            </div>
          ))}
        </AbsoluteFill>
      )}

      <FilmTexture intensity={0.5} scratches flicker={false} flashFrames={[cutFrame]} seed={1} />
    </AbsoluteFill>
  );
};
