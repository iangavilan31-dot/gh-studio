import React from "react";
import { useCurrentFrame } from "remotion";
import { NewspaperScene, Shot } from "../NewspaperScene";
import { Headline } from "../components/Type";
import { Cutout } from "../components/Cutout";
import { Stamp } from "../components/Stamp";
import { ev } from "../timing";
import { FONT_BODY, H, INK, MARGIN, RED, W } from "../theme";
import { appear } from "../motion";

// "Cavalry with drawn sabers. Infantry with fixed bayonets. Six tanks.
//  Down Pennsylvania Avenue." — rapid hard-cut escalation.
const Card: React.FC<{
  kicker: string;
  big: React.ReactNode;
  at: number;
  children?: React.ReactNode;
}> = ({ kicker, big, at, children }) => {
  const frame = useCurrentFrame();
  return (
    <div style={{ position: "absolute", left: MARGIN, top: H * 0.2, width: W - MARGIN * 2 }}>
      <div
        style={{
          fontFamily: FONT_BODY,
          fontWeight: 800,
          fontSize: 34,
          letterSpacing: "0.2em",
          color: RED,
          opacity: appear(frame, at, 2),
        }}
      >
        {kicker}
      </div>
      <Headline size={176} weight={900} style={{ marginTop: 16, lineHeight: 0.94 }}>
        {big}
      </Headline>
      {children}
    </div>
  );
};

export const Beat8: React.FC = () => {
  const frame = useCurrentFrame();
  const fSab = ev("b8.sabers");
  const fBay = ev("b8.bayonets");
  const fTank = ev("b8.tanks");
  const fAve = ev("b8.avenue");

  const shots: Shot[] = [
    { at: fSab, type: "punch", scale: 1.14, x: -20, dur: 4 },
    { at: fBay, type: "punch", scale: 1.1, x: 20, dur: 4 },
    { at: fTank, type: "cut", scale: 1.0 },
    { at: fAve, type: "punch", scale: 1.08, y: -20, dur: 4 },
  ];

  const stage =
    frame >= fAve ? "avenue" : frame >= fTank ? "tanks" : frame >= fBay ? "bayonets" : "sabers";

  return (
    <NewspaperScene shots={shots} grain={0.1}>
      {stage === "sabers" && (
        <Card kicker="CAVALRY" big={<>Drawn sabers.</>} at={fSab}>
          <Stamp at={fSab + 3} rotate={-6} size={54} style={{ position: "absolute", left: W * 0.4, top: H * 0.36 }}>
            CHARGE
          </Stamp>
        </Card>
      )}
      {stage === "bayonets" && <Card kicker="INFANTRY" big={<>Fixed bayonets.</>} at={fBay} />}
      {stage === "tanks" && (
        <>
          <Card kicker="ARMOR" big={<span style={{ color: RED }}>Six tanks.</span>} at={fTank} />
          <Cutout
            src="assets/treated/patton.png"
            at={fTank}
            x={W * 0.28}
            y={H * 0.42}
            width={W * 0.72}
            offset={12}
            seed={8}
          />
        </>
      )}
      {stage === "avenue" && (
        <div style={{ position: "absolute", left: MARGIN, top: H * 0.3, width: W - MARGIN * 2 }}>
          <Headline size={132} style={{ lineHeight: 0.98 }}>
            Down <span style={{ color: RED }}>Pennsylvania Avenue.</span>
          </Headline>
          <div
            style={{
              marginTop: 40,
              fontFamily: FONT_BODY,
              fontWeight: 800,
              fontSize: 32,
              letterSpacing: "0.16em",
              color: INK,
              opacity: appear(frame, fAve + 6, 5),
            }}
          >
            JULY 28, 1932
          </div>
        </div>
      )}
    </NewspaperScene>
  );
};
