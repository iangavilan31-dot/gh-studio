import React from "react";
import { Composition } from "remotion";
import "./fonts";
import { BonusArmyShort } from "./BonusArmyShort";
import { FPS, TOTAL_FRAMES } from "./timing";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      {/* PRIMARY / final deliverable — widescreen 1920x1080 */}
      <Composition
        id="BonusArmyShort"
        component={BonusArmyShort}
        durationInFrames={TOTAL_FRAMES}
        fps={FPS}
        width={1920}
        height={1080}
      />
      {/* Deprioritized vertical cut, kept in the repo */}
      <Composition
        id="BonusArmyPortrait"
        component={BonusArmyShort}
        durationInFrames={TOTAL_FRAMES}
        fps={FPS}
        width={1080}
        height={1920}
      />
    </>
  );
};
