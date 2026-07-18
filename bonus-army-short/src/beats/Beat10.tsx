import React from "react";
import { useCurrentFrame } from "remotion";
import { NewspaperScene, Shot } from "../NewspaperScene";
import { Headline } from "../components/Type";
import { Label } from "../components/Graphics";
import { ev } from "../timing";
import { FONT_HEAD, FONT_MONO, H, INK, MARGIN, RED, W } from "../theme";
import { appear } from "../motion";

// "Two veterans were killed. Reports at the time said an infant died from the
//  gas." — the near-still casualty beat. Restraint: barely any motion.
export const Beat10: React.FC = () => {
  const frame = useCurrentFrame();
  const fKilled = ev("b10.killed");
  const fInfant = ev("b10.infant");

  // deliberately calm camera — a single tiny settle, no punches
  const shots: Shot[] = [{ at: ev("b10.start"), type: "cut", scale: 1.03 }];

  const Name: React.FC<{ n: string; d: string; at: number }> = ({ n, d, at }) => (
    <div style={{ opacity: appear(frame, at, 8), marginBottom: 26 }}>
      <div style={{ fontFamily: FONT_HEAD, fontWeight: 700, fontSize: 62, color: INK }}>
        <span style={{ color: RED, marginRight: 16 }}>&#8224;</span>
        {n}
      </div>
      <div style={{ fontFamily: FONT_MONO, fontSize: 26, color: INK, opacity: 0.6, marginLeft: 54 }}>
        {d}
      </div>
    </div>
  );

  return (
    <NewspaperScene shots={shots} grain={0.07}>
      <div style={{ position: "absolute", left: MARGIN, top: H * 0.14, width: W - MARGIN * 2 }}>
        <Label at={ev("b10.start")}>The dead</Label>
        <Headline size={128} weight={900} style={{ marginTop: 18 }}>
          Two veterans killed.
        </Headline>
        <div style={{ marginTop: 70 }}>
          <Name n="William Hushka" d="B.E.F. — shot, July 28 1932" at={fKilled + 6} />
          <Name n="Eric Carlson" d="B.E.F. — shot, July 28 1932" at={fKilled + 16} />
        </div>
        <div
          style={{
            marginTop: 60,
            fontFamily: FONT_HEAD,
            fontStyle: "italic",
            fontSize: 58,
            lineHeight: 1.25,
            color: INK,
            maxWidth: W * 0.8,
            opacity: appear(frame, fInfant, 10),
          }}
        >
          Reports at the time said an infant died from the gas.
        </div>
      </div>
    </NewspaperScene>
  );
};
