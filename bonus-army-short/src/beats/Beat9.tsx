import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { NewspaperScene, Shot } from "../NewspaperScene";
import { Headline } from "../components/Type";
import { Label } from "../components/Graphics";
import { PhotoCard } from "../components/PhotoCard";
import { ev } from "../timing";
import { H, MARGIN, RED, W } from "../theme";
import { appear } from "../motion";

// "They tear-gassed the camp. Then they burned it to the ground."
export const Beat9: React.FC = () => {
  const frame = useCurrentFrame();
  const fGas = ev("b9.gas");
  const fBurn = ev("b9.burned");
  const showBurn = frame >= fBurn - 3;

  const shots: Shot[] = [
    { at: ev("b9.start"), type: "cut", scale: 1.06 },
    { at: fBurn, type: "punch", scale: 1.05, dur: 5 },
  ];

  return (
    <NewspaperScene shots={shots} grain={0.1}>
      {/* drifting gas haze */}
      {!showBurn && (
        <AbsoluteFill style={{ opacity: appear(frame, fGas, 8) * 0.5 }}>
          <div
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              top: H * 0.4,
              height: H * 0.4,
              background:
                "radial-gradient(60% 70% at 40% 50%, rgba(20,16,12,0.28), transparent 70%)",
              filter: "blur(30px)",
              transform: `translateX(${appear(frame, fGas, 40) * 120 - 60}px)`,
            }}
          />
        </AbsoluteFill>
      )}

      {!showBurn ? (
        <div style={{ position: "absolute", left: MARGIN, top: H * 0.22, width: W - MARGIN * 2 }}>
          <Label at={ev("b9.start")} bar>
            The eviction
          </Label>
          <Headline size={132} style={{ marginTop: 24 }}>
            They <span style={{ color: RED }}>tear-gassed</span> the camp.
          </Headline>
        </div>
      ) : (
        <>
          <PhotoCard
            src="assets/treated/bonus_burning.png"
            at={fBurn}
            x={MARGIN - 30}
            y={H * 0.16}
            width={W - MARGIN * 2 + 60}
            height={H * 0.5}
            rotate={-1}
            redOffset={16}
            objectPosition="center 40%"
          />
          <div style={{ position: "absolute", left: MARGIN, top: H * 0.7, width: W - MARGIN * 2 }}>
            <Headline size={98} weight={900}>
              Then they burned it <span style={{ color: RED }}>to the ground.</span>
            </Headline>
          </div>
        </>
      )}
    </NewspaperScene>
  );
};
