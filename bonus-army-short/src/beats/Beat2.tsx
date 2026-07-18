import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { BigCard, MapShot } from "../components/Shots";
import { FilmTexture } from "../layers/FilmTexture";
import { ev } from "../timing";
import { RED } from "../theme";

// B2: BigCard "43,000" (allowed card use #1) -> whip into the 1932 DC map,
// red routes draw in from three edges converging on DC, camp photos pin on.
export const Beat2: React.FC = () => {
  const frame = useCurrentFrame();
  const fNum = ev("b2.number");
  const fMarch = ev("b2.marched");
  const showMap = frame >= fMarch - 2;
  return (
    <AbsoluteFill style={{ background: "#0b0a09" }}>
      {!showMap ? (
        <BigCard
          from={fNum}
          value={
            <>
              43,<span style={{ color: RED }}>000</span>
            </>
          }
          sub="Broke World War I veterans"
        />
      ) : (
        <MapShot
          src="assets/final/dc_map.png"
          from={fMarch}
          duration={70}
          routes={[
            { d: "M 40 120 C 400 260, 700 380, 940 520", at: fMarch },
            { d: "M 1880 90 C 1500 300, 1150 400, 950 520", at: fMarch + 6 },
            { d: "M 120 1040 C 500 780, 780 640, 950 540", at: fMarch + 12 },
          ]}
          pins={[{ x: 50, y: 50, label: "WASHINGTON, D.C.", at: fMarch + 18 }]}
        />
      )}
      <FilmTexture intensity={0.5} scratches seed={2} />
    </AbsoluteFill>
  );
};
