import React from "react";
import { useCurrentFrame } from "remotion";
import { NewspaperScene, Shot } from "../NewspaperScene";
import { Headline } from "../components/Type";
import { BigStat, Label } from "../components/Graphics";
import { PhotoCard } from "../components/PhotoCard";
import { ev } from "../timing";
import { H, MARGIN, RED, W } from "../theme";

// "Forty-three thousand broke World War One veterans marched on Washington."
export const Beat2: React.FC = () => {
  const frame = useCurrentFrame();
  const fNum = ev("b2.number");
  const fMarch = ev("b2.marched");
  const showMarch = frame >= fMarch - 3;

  const shots: Shot[] = [
    { at: ev("b2.start"), type: "cut", scale: 1.04, y: -30 },
    { at: fNum, type: "punch", scale: 1.12, y: 20, dur: 5 },
    { at: fMarch, type: "cut", scale: 1.0, y: 0 },
  ];

  return (
    <NewspaperScene shots={shots}>
      {!showMarch ? (
        <div style={{ position: "absolute", left: MARGIN, top: H * 0.2, width: W - MARGIN * 2 }}>
          <Label at={ev("b2.start")} bar>
            The Summer of 1932
          </Label>
          <BigStat
            at={fNum}
            value={
              <>
                43,<span style={{ color: RED }}>000</span>
              </>
            }
            label="Broke World War I veterans"
            size={300}
            style={{ marginTop: 30 }}
          />
        </div>
      ) : (
        <div style={{ position: "absolute", left: MARGIN, top: H * 0.1, width: W - MARGIN * 2 }}>
          <Headline size={120} style={{ marginTop: 10 }}>
            marched on <span style={{ color: RED }}>Washington.</span>
          </Headline>
          <PhotoCard
            src="assets/treated/bonus_march.png"
            at={fMarch}
            x={MARGIN - 20}
            y={H * 0.34}
            width={W - MARGIN * 2 + 40}
            height={H * 0.42}
            rotate={-1.5}
            objectPosition="center 30%"
          />
        </div>
      )}
    </NewspaperScene>
  );
};
