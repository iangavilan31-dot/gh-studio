import React from "react";
import { Composition } from "remotion";
import { BonusArmyShort } from "./BonusArmyShort";
import { FPS, TOTAL_FRAMES } from "./timing";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="BonusArmyShort"
        component={BonusArmyShort}
        durationInFrames={TOTAL_FRAMES}
        fps={FPS}
        width={1080}
        height={1920}
      />
      <Composition
        id="BonusArmyWide"
        component={BonusArmyShort}
        durationInFrames={TOTAL_FRAMES}
        fps={FPS}
        width={1920}
        height={1080}
      />
    </>
  );
};
