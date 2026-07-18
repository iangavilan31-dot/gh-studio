import React from "react";
import { useCurrentFrame } from "remotion";
import { NewspaperScene, Shot } from "../NewspaperScene";
import { Headline, HiWord } from "../components/Type";
import { Label } from "../components/Graphics";
import { beatWords, ev, wordReveal } from "../timing";
import { H, MARGIN, RED, W } from "../theme";

// "It was the Great Depression. Men who'd survived the trenches were starving."
export const Beat4: React.FC = () => {
  const frame = useCurrentFrame();
  const words = beatWords("b4");
  const starving = words.find((w) => w.text.replace(/[^a-z]/gi, "") === "starving");
  const fTrench = ev("b4.trenches");
  const showTrench = frame >= fTrench - 3;

  const shots: Shot[] = [
    { at: ev("b4.start"), type: "cut", scale: 1.05, y: 0 },
    { at: fTrench, type: "cut", scale: 1.08, y: -30 },
    { at: ev("b4.starving"), type: "punch", scale: 1.16, y: 30, dur: 5 },
  ];

  return (
    <NewspaperScene shots={shots}>
      {!showTrench ? (
        <div style={{ position: "absolute", left: MARGIN, top: H * 0.24, width: W - MARGIN * 2 }}>
          <Label at={ev("b4.start")} bar>
            1929&ndash;1933
          </Label>
          <Headline size={168} weight={900} style={{ marginTop: 26, lineHeight: 0.96 }}>
            The Great
            <br />
            Depression.
          </Headline>
        </div>
      ) : (
        <div style={{ position: "absolute", left: MARGIN, top: H * 0.22, width: W - MARGIN * 2 }}>
          <Headline size={104} style={{ lineHeight: 1.04 }}>
            Men who&rsquo;d survived the trenches were{" "}
            <HiWord
              reveal={starving ? wordReveal(frame, starving.start, 2, 6) : 0}
              seed={9}
            >
              <span style={{ color: RED }}>starving.</span>
            </HiWord>
          </Headline>
        </div>
      )}
    </NewspaperScene>
  );
};
